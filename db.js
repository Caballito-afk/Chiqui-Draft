/**
 * db.js - Motor de almacenamiento ligero y aislado para ChiquiDraft
 * 
 * Implementa almacenamiento persistente estructurado en JSON con escrituras atómicas
 * y caché en memoria de alta velocidad (write-through).
 * 
 * Provee aislamiento completo de estado por:
 * 1. Sesión de usuario (data/sessions/{sessionId}.json)
 * 2. Sala de juego (data/rooms/{roomCode}.json)
 * 3. Estado de partida (data/games/{roomCode}.json)
 * 
 * Sin dependencias externas nativas (no requiere node-gyp ni compiladores C++),
 * 100% compatible con Node.js en Windows, Linux y servicios como Render.com.
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
const SESSIONS_DIR = path.join(DATA_DIR, "sessions");
const ROOMS_DIR = path.join(DATA_DIR, "rooms");
const GAMES_DIR = path.join(DATA_DIR, "games");

// Cachés en memoria para acceso ultra-rápido en tiempo real
const cache = {
  sessions: new Map(), // sessionId -> sessionData
  rooms: new Map(),    // roomCode -> roomData
  games: new Map()     // roomCode -> gameState
};

/**
 * Asegura que los directorios de almacenamiento existan.
 */
function init() {
  [DATA_DIR, SESSIONS_DIR, ROOMS_DIR, GAMES_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // Hidratar caché de salas existentes no expiradas
  try {
    const roomFiles = fs.readdirSync(ROOMS_DIR);
    for (const file of roomFiles) {
      if (file.endsWith(".json")) {
        const code = path.basename(file, ".json");
        const content = fs.readFileSync(path.join(ROOMS_DIR, file), "utf-8");
        const roomData = JSON.parse(content);
        cache.rooms.set(code, roomData);
      }
    }
  } catch (err) {
    console.error("[DB] Error al precargar salas:", err.message);
  }

  // Hidratar caché de estados de partida
  try {
    const gameFiles = fs.readdirSync(GAMES_DIR);
    for (const file of gameFiles) {
      if (file.endsWith(".json")) {
        const code = path.basename(file, ".json");
        const content = fs.readFileSync(path.join(GAMES_DIR, file), "utf-8");
        cache.games.set(code, JSON.parse(content));
      }
    }
  } catch (err) {
    console.error("[DB] Error al precargar estados de juego:", err.message);
  }

  console.log(`[DB] Inicializado correctamente. Salas cargadas: ${cache.rooms.size}`);
}

/**
 * Escritura atómica en disco para evitar corrupción por caídas a mitad de escritura.
 * Escribe a un archivo temporal .tmp y luego hace rename atómico.
 */
function atomicWriteFileSync(filePath, data) {
  const tmpPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    if (fs.existsSync(tmpPath)) {
      try { fs.unlinkSync(tmpPath); } catch (_) {}
    }
    throw err;
  }
}

// =========================================================
// MÓDULO DE SESIONES (POR JUGADOR / DISPOSITIVO)
// =========================================================

function getSession(sessionId) {
  if (!sessionId) return null;
  if (cache.sessions.has(sessionId)) {
    return cache.sessions.get(sessionId);
  }
  const filePath = path.join(SESSIONS_DIR, `${sessionId}.json`);
  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      cache.sessions.set(sessionId, data);
      return data;
    } catch (err) {
      console.error(`[DB] Error leyendo sesión ${sessionId}:`, err.message);
    }
  }
  return null;
}

function saveSession(sessionId, sessionData) {
  if (!sessionId) return;
  const current = getSession(sessionId) || {};
  const updated = {
    ...current,
    ...sessionData,
    sessionId,
    updatedAt: Date.now()
  };
  cache.sessions.set(sessionId, updated);
  try {
    const filePath = path.join(SESSIONS_DIR, `${sessionId}.json`);
    atomicWriteFileSync(filePath, updated);
  } catch (err) {
    console.error(`[DB] Error guardando sesión ${sessionId}:`, err.message);
  }
  return updated;
}

function deleteSession(sessionId) {
  if (!sessionId) return;
  cache.sessions.delete(sessionId);
  const filePath = path.join(SESSIONS_DIR, `${sessionId}.json`);
  if (fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath); } catch (_) {}
  }
}

// =========================================================
// MÓDULO DE SALAS
// =========================================================

function getRoom(code) {
  if (!code) return null;
  const normalized = String(code).trim().toUpperCase();
  if (cache.rooms.has(normalized)) {
    return cache.rooms.get(normalized);
  }
  const filePath = path.join(ROOMS_DIR, `${normalized}.json`);
  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      cache.rooms.set(normalized, data);
      return data;
    } catch (err) {
      console.error(`[DB] Error leyendo sala ${normalized}:`, err.message);
    }
  }
  return null;
}

function sanitizeRoomForDisk(room) {
  if (!room) return null;
  const clone = { ...room };
  if (Array.isArray(clone.players)) {
    clone.players = clone.players.map(p => {
      const { graceTimer, ...rest } = p;
      return rest;
    });
  }
  return clone;
}

function saveRoom(code, roomData) {
  if (!code || !roomData) return;
  const normalized = String(code).trim().toUpperCase();
  const data = {
    ...roomData,
    code: normalized,
    updatedAt: Date.now()
  };
  cache.rooms.set(normalized, data);
  try {
    const filePath = path.join(ROOMS_DIR, `${normalized}.json`);
    atomicWriteFileSync(filePath, sanitizeRoomForDisk(data));
  } catch (err) {
    console.error(`[DB] Error guardando sala ${normalized}:`, err.message);
  }
  return data;
}

function deleteRoom(code) {
  if (!code) return;
  const normalized = String(code).trim().toUpperCase();
  cache.rooms.delete(normalized);
  cache.games.delete(normalized);
  const roomFile = path.join(ROOMS_DIR, `${normalized}.json`);
  const gameFile = path.join(GAMES_DIR, `${normalized}.json`);
  if (fs.existsSync(roomFile)) {
    try { fs.unlinkSync(roomFile); } catch (_) {}
  }
  if (fs.existsSync(gameFile)) {
    try { fs.unlinkSync(gameFile); } catch (_) {}
  }
}

function getAllRooms() {
  return Array.from(cache.rooms.values());
}

// =========================================================
// MÓDULO DE ESTADO DE PARTIDA (DRAFT, FIXTURE, STANDINGS)
// =========================================================

function getGameState(code) {
  if (!code) return null;
  const normalized = String(code).trim().toUpperCase();
  if (cache.games.has(normalized)) {
    return cache.games.get(normalized);
  }
  const filePath = path.join(GAMES_DIR, `${normalized}.json`);
  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      cache.games.set(normalized, data);
      return data;
    } catch (err) {
      console.error(`[DB] Error leyendo estado de juego ${normalized}:`, err.message);
    }
  }
  return null;
}

function saveGameState(code, gameState) {
  if (!code || !gameState) return;
  const normalized = String(code).trim().toUpperCase();
  const data = {
    ...gameState,
    updatedAt: Date.now()
  };
  cache.games.set(normalized, data);
  try {
    const filePath = path.join(GAMES_DIR, `${normalized}.json`);
    atomicWriteFileSync(filePath, data);
  } catch (err) {
    console.error(`[DB] Error guardando estado de juego ${normalized}:`, err.message);
  }
  return data;
}

// =========================================================
// LIMPIEZA DE SALAS Y SESIONES EXPIRADAS
// =========================================================

function cleanup(maxAgeMs = 4 * 60 * 60 * 1000) {
  const now = Date.now();
  for (const [code, room] of cache.rooms.entries()) {
    const age = now - (room.updatedAt || room.createdAt || 0);
    if (age > maxAgeMs) {
      deleteRoom(code);
    }
  }
}

module.exports = {
  init,
  getSession,
  saveSession,
  deleteSession,
  getRoom,
  saveRoom,
  deleteRoom,
  getAllRooms,
  getGameState,
  saveGameState,
  cleanup
};
