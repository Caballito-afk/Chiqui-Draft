const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
/* Orígenes permitidos: "*" por defecto (el cliente se sirve desde este mismo servidor).
   Si el cliente está en otro dominio (por ejemplo GitHub Pages) se puede restringir con la variable
   CORS_ORIGIN="https://usuario.github.io" (varios separados por coma). */
const CORS_ORIGIN = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map(x => x.trim()).filter(Boolean)
  : "*";
/* Tiempo que se le guarda el lugar a un jugador que se cae (red móvil, instancia de Render lenta, cambio de wifi)
   antes de sacarlo de la sala. Si es el anfitrión, la sala se cierra recién pasado este tiempo. */
const RECONNECT_GRACE_MS = Number(process.env.RECONNECT_GRACE_MS) || 60000;

const io = new Server(server, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ["GET", "POST"]
  },
  // Keep-alive holgado: Render puede demorar en responder y con valores cortos Socket.io daba por muerta la conexión
  pingInterval: 25000,
  pingTimeout: 60000,
  transports: ["websocket", "polling"],
  maxHttpBufferSize: 5e6 // 5MB para snapshots y sincronización
});

// Los balanceadores de Render cortan conexiones ociosas: el servidor Node tiene que aguantar más que ellos
server.keepAliveTimeout = 120000;
server.headersTimeout = 125000;

// Habilitar CORS para peticiones HTTP
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", Array.isArray(CORS_ORIGIN) ? (CORS_ORIGIN.includes(req.headers.origin) ? req.headers.origin : CORS_ORIGIN[0]) : "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// Servir todos los archivos estáticos de ChiquiDraft
app.use(express.static(path.join(__dirname)));

// Rutas auxiliares
app.get("/health", (req, res) => {
  res.json({ status: "ok", activeRooms: rooms.size, timestamp: Date.now() });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// =========================================================
// GESTOR DE SALAS EN MEMORIA
// =========================================================
const rooms = new Map();
const socketToRoom = new Map(); // socket.id -> { code, playerId }

const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generateRoomCode() {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  }
  return code;
}

function cleanName(n) {
  return String(n || "").replace(/[<>&"'`\\]/g, "").replace(/\s+/g, " ").trim().slice(0, 24);
}

// Color del club: cada jugador puede elegir el suyo (#rrggbb). Si no elige, se usa uno por orden.
const DEFAULT_COLORS = ["#35d17c","#5b8def","#f0b90b","#e5484d","#a78bfa","#22d3ee","#fb923c","#f472b6","#84cc16","#38bdf8","#f97316","#c084fc","#2dd4bf","#eab308","#f87171","#818cf8"];
function cleanColor(c) {
  c = String(c || "").trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(c) ? c : null;
}
function effectiveColor(room, p) {
  return p.color || DEFAULT_COLORS[room.players.indexOf(p) % DEFAULT_COLORS.length];
}
// Personalización del club: color secundario, estadio y escudo (PNG chico en data URL)
const CREST_MAX = 70000;     // mismo límite que el cliente (js/colores-equipos.js)
const STADIUM_MAX = 60;
function cleanStadium(v) {
  return String(v == null ? "" : v).replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, STADIUM_MAX) || null;
}
function cleanCrest(v) {
  if (typeof v !== "string" || v.length > CREST_MAX) return null;
  return /^data:image\/png;base64,[A-Za-z0-9+\/=]+$/.test(v) ? v : null;
}
function colorOwner(room, color, except) {
  return room.players.find(q => q !== except && effectiveColor(room, q) === color) || null;
}

function newToken() { return crypto.randomBytes(16).toString("hex"); }

function sanitizeRoom(room) {
  return {
    code: room.code,
    game: room.game,
    min: room.min,
    max: room.max,
    champions: !!room.champions,
    lines: room.lines || [],
    settings: room.settings || {},
    started: room.started,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      connected: p.connected,
      host: !!p.host,
      color: p.color || null,
      color2: p.color2 || null,
      stadium: p.stadium || null,
      crest: p.crest || null
    }))
  };
}

io.on("connection", (socket) => {
  // 1. CREAR SALA
  socket.on("create_room", (data, callback) => {
    try {
      let code = generateRoomCode();
      let attempts = 0;
      while (rooms.has(code) && attempts < 10) {
        code = generateRoomCode();
        attempts++;
      }

      const clubName = cleanName(data.club) || "Anfitrión";
      const room = {
        code,
        hostSocketId: socket.id,
        game: data.game || "puja",
        min: Number(data.min) || 2,
        max: Number(data.max) || 6,
        champions: !!data.champions,
        lines: Array.isArray(data.lines) ? data.lines : [],
        settings: {},
        started: false,
        players: [
          {
            id: 0,
            name: clubName,
            color: cleanColor(data.color),
            color2: cleanColor(data.color2),
            stadium: cleanStadium(data.stadium),
            crest: cleanCrest(data.crest),
            host: true,
            connected: true,
            socketId: socket.id,
            token: newToken()
          }
        ],
        createdAt: Date.now()
      };

      rooms.set(code, room);
      socketToRoom.set(socket.id, { code, playerId: 0 });
      socket.join(code);

      if (typeof callback === "function") {
        callback({ ok: true, code, youId: 0, token: room.players[0].token, room: sanitizeRoom(room) });
      }
    } catch (err) {
      if (typeof callback === "function") callback({ ok: false, error: err.message });
    }
  });

  // 2. UNIRSE A SALA
  socket.on("join_room", (data, callback) => {
    try {
      const code = String(data.code || "").trim().toUpperCase();
      const room = rooms.get(code);

      if (!room) {
        return callback && callback({ ok: false, error: "No existe ninguna sala con ese código." });
      }
      if (room.started) {
        return callback && callback({ ok: false, error: "La partida ya empezó." });
      }
      if (room.players.length >= room.max) {
        return callback && callback({ ok: false, error: "La sala está llena." });
      }

      let clubName = cleanName(data.club) || "Club";
      let base = clubName;
      let counter = 2;
      while (room.players.some(p => p.name.toLowerCase() === clubName.toLowerCase())) {
        clubName = `${base.slice(0, 20)} (${counter++})`;
      }

      const newId = room.players.length;
      let wanted = cleanColor(data.color);
      if (wanted && colorOwner(room, wanted, null)) wanted = null; // ya lo usa otro club: se le asigna uno por orden
      const player = {
        id: newId,
        name: clubName,
        color: wanted,
        color2: cleanColor(data.color2),
        stadium: cleanStadium(data.stadium),
        crest: cleanCrest(data.crest),
        host: false,
        connected: true,
        socketId: socket.id,
        token: newToken()
      };

      room.players.push(player);
      socketToRoom.set(socket.id, { code, playerId: newId });
      socket.join(code);

      const sRoom = sanitizeRoom(room);
      if (typeof callback === "function") {
        callback({ ok: true, code, youId: newId, token: player.token, room: sRoom });
      }

      // Notificar a todos en la sala del nuevo jugador
      io.to(code).emit("room_updated", sRoom);
    } catch (err) {
      if (typeof callback === "function") callback({ ok: false, error: err.message });
    }
  });

  // 2b. CAMBIAR EL COLOR DE MI CLUB (antes de empezar; null = volver al color original)
  socket.on("set_color", (data, callback) => {
    try {
      const mapping = socketToRoom.get(socket.id);
      const room = mapping && rooms.get(mapping.code);
      const me = room && room.players.find(p => p.socketId === socket.id);
      if (!room || !me) return callback && callback({ ok: false, error: "No estás en una sala." });
      if (room.started) return callback && callback({ ok: false, error: "La partida ya empezó." });
      const color = data && data.color ? cleanColor(data.color) : null;
      if (data && data.color && !color) return callback && callback({ ok: false, error: "Color inválido." });
      if (color) {
        const owner = colorOwner(room, color, me);
        if (owner) return callback && callback({ ok: false, error: "Ese color ya lo tiene " + owner.name + "." });
      }
      me.color = color;
      const sRoom = sanitizeRoom(room);
      io.to(room.code).emit("room_updated", sRoom);
      if (typeof callback === "function") callback({ ok: true, room: sRoom });
    } catch (err) {
      if (typeof callback === "function") callback({ ok: false, error: err.message });
    }
  });

  // 2c. CAMBIAR TODO MI CLUB JUNTO: color, color secundario, estadio y escudo (antes de empezar)
  socket.on("set_club", (data, callback) => {
    try {
      const mapping = socketToRoom.get(socket.id);
      const room = mapping && rooms.get(mapping.code);
      const me = room && room.players.find(p => p.socketId === socket.id);
      if (!room || !me) return callback && callback({ ok: false, error: "No estás en una sala." });
      if (room.started) return callback && callback({ ok: false, error: "La partida ya empezó." });
      data = data || {};
      const color = data.color ? cleanColor(data.color) : null;
      if (data.color && !color) return callback && callback({ ok: false, error: "Color inválido." });
      if (color) {
        const owner = colorOwner(room, color, me);
        if (owner) return callback && callback({ ok: false, error: "Ese color ya lo tiene " + owner.name + "." });
      }
      if (data.crest && !cleanCrest(data.crest)) return callback && callback({ ok: false, error: "El escudo tiene que ser un PNG liviano." });
      me.color = color;
      me.color2 = data.color2 ? cleanColor(data.color2) : null;
      me.stadium = cleanStadium(data.stadium);
      me.crest = data.crest ? cleanCrest(data.crest) : null;
      const sRoom = sanitizeRoom(room);
      io.to(room.code).emit("room_updated", sRoom);
      if (typeof callback === "function") callback({ ok: true, room: sRoom });
    } catch (err) {
      if (typeof callback === "function") callback({ ok: false, error: err.message });
    }
  });

  // 2d. VOLVER A LA SALA tras una caída de conexión (el cliente manda el código y el token que recibió al entrar)
  socket.on("rejoin_room", (data, callback) => {
    try {
      data = data || {};
      const code = String(data.code || "").trim().toUpperCase();
      const room = rooms.get(code);
      const player = room && room.players.find(p => p.token && p.token === String(data.token || ""));
      if (!room || !player) {
        return callback && callback({ ok: false, error: "La sala ya no existe o se te quitó el lugar." });
      }
      // se suelta el socket viejo (si todavía figuraba) y se ata el nuevo al mismo jugador
      if (player.graceTimer) { clearTimeout(player.graceTimer); player.graceTimer = null; }
      if (player.socketId && player.socketId !== socket.id) socketToRoom.delete(player.socketId);
      player.socketId = socket.id;
      player.connected = true;
      if (player.host) room.hostSocketId = socket.id;
      socketToRoom.set(socket.id, { code, playerId: player.id });
      socket.join(code);

      const sRoom = sanitizeRoom(room);
      io.to(code).emit("room_updated", sRoom);
      io.to(code).emit("player_reconnected", { playerId: player.id, name: player.name });
      // si volvió un invitado en plena partida, el anfitrión reenvía la pantalla para que no quede en blanco
      if (room.started && !player.host) io.to(room.hostSocketId).emit("resync_request", { playerId: player.id });
      if (typeof callback === "function") callback({ ok: true, code, youId: player.id, host: !!player.host, started: !!room.started, room: sRoom });
    } catch (err) {
      if (typeof callback === "function") callback({ ok: false, error: err.message });
    }
  });

  // 3. EMPEZAR PARTIDA
  socket.on("start_game", (data, callback) => {
    try {
      const mapping = socketToRoom.get(socket.id);
      if (!mapping) return;
      const room = rooms.get(mapping.code);
      if (!room || room.hostSocketId !== socket.id) return;

      const activePlayers = room.players.filter(p => p.connected);
      if (activePlayers.length < room.min || activePlayers.length > room.max) {
        return callback && callback({ ok: false, error: "Cantidad de jugadores inválida." });
      }

      room.started = true;
      const sRoom = sanitizeRoom(room);

      io.to(room.code).emit("game_started", {
        code: room.code,
        room: sRoom,
        teams: room.players.map(p => p.name)
      });

      if (typeof callback === "function") callback({ ok: true });
    } catch (err) {
      if (typeof callback === "function") callback({ ok: false, error: err.message });
    }
  });

  // 3b. AJUSTES EN VIVO (solo anfitrión): actualiza la sala y la reenvía a todos, sin tocar sockets ni jugadores
  socket.on("update_room", (data, callback) => {
    try {
      const mapping = socketToRoom.get(socket.id);
      const room = mapping && rooms.get(mapping.code);
      if (!room || room.hostSocketId !== socket.id || !data) {
        return callback && callback({ ok: false, error: "Solo el anfitrión puede cambiar los ajustes." });
      }
      // Descriptivo (siempre editable, también con la partida en curso)
      if (Array.isArray(data.lines)) {
        room.lines = data.lines.slice(0, 30).map(l => String(l).slice(0, 120));
      }
      if (data.settings && typeof data.settings === "object") {
        const next = {};
        for (const k of Object.keys(data.settings).slice(0, 40)) {
          const v = data.settings[k];
          if (/^[a-zA-Z]{1,24}$/.test(k) && (v === null || ["number", "boolean", "string"].includes(typeof v))) {
            next[k] = typeof v === "string" ? v.slice(0, 40) : v;
          }
        }
        room.settings = Object.assign(room.settings || {}, next);
      }
      // Cupos / formato: solo antes de empezar, y nunca por debajo de los jugadores ya conectados
      if (!room.started) {
        const connected = room.players.filter(p => p.connected).length;
        let min = Number(data.min) || room.min;
        let max = Number(data.max) || room.max;
        max = Math.max(max, connected, 2);
        min = Math.min(Math.max(min, 2), max);
        room.min = min;
        room.max = max;
        if (typeof data.champions === "boolean") room.champions = data.champions;
      }
      const sRoom = sanitizeRoom(room);
      io.to(room.code).emit("room_updated", sRoom);   // mismos sockets: nadie se desconecta
      if (typeof callback === "function") callback({ ok: true, room: sRoom });
    } catch (err) {
      if (typeof callback === "function") callback({ ok: false, error: err.message });
    }
  });

  // 4. ACCIÓN DE JUGADOR (Invitado -> Anfitrión). El servidor valida y reenvía solo dentro de SU sala.
  const bucket = { n: 0, t: Date.now() };
  socket.on("player_action", (act, callback) => {
    const reply = (r) => { if (typeof callback === "function") callback(r); };
    const mapping = socketToRoom.get(socket.id);
    if (!mapping) return reply({ ok: false, error: "No estás en una sala." });
    const room = rooms.get(mapping.code);
    if (!room || !room.started) return reply({ ok: false, error: "La partida no empezó." });
    if (!act || typeof act !== "object" || Array.isArray(act)) return reply({ ok: false, error: "Acción inválida." });
    // límite de frecuencia (40 acciones por segundo) y de tamaño
    const now = Date.now();
    if (now - bucket.t > 1000) { bucket.t = now; bucket.n = 0; }
    if (++bucket.n > 40) return reply({ ok: false, error: "Demasiadas acciones seguidas." });
    let size = 0; try { size = JSON.stringify(act).length; } catch (e) { size = Infinity; }
    if (size > 20000) return reply({ ok: false, error: "Acción demasiado grande." });
    const host = room.players.find(p => p.host);
    if (!host || !host.connected) return reply({ ok: false, error: "El anfitrión se está reconectando…" });

    // Se asegura de que la acción lleve el ID verificado del jugador
    act.playerId = mapping.playerId;
    io.to(room.hostSocketId).emit("player_action", act);
    reply({ ok: true });
  });

  // 5. SINCRONIZACIÓN DE PANTALLA / ESTADO (Anfitrión -> Invitados)
  socket.on("host_sync", (data) => {
    const mapping = socketToRoom.get(socket.id);
    if (!mapping) return;
    const room = rooms.get(mapping.code);
    if (!room || room.hostSocketId !== socket.id) return;

    // Transmitir a todos los sockets de la sala excepto al anfitrión
    socket.to(room.code).emit("guest_sync", data);
  });

  // 6. CERRAR O SALIR DE LA SALA
  socket.on("leave_room", () => {
    handleDisconnect(socket, true);   // salida a propósito: se aplica en el momento
  });

  socket.on("disconnect", () => {
    handleDisconnect(socket, false);  // caída de conexión: se le guarda el lugar un rato
  });
});

/* Aplica la salida definitiva de un jugador (la que antes pasaba apenas se caía el socket) */
function finalizeLeave(code, player) {
  const room = rooms.get(code);
  if (!room || !room.players.includes(player)) return;
  if (player.graceTimer) { clearTimeout(player.graceTimer); player.graceTimer = null; }
  const isHost = !!player.host;

  if (!room.started) {
    if (isHost) {
      io.to(code).emit("room_closed", { reason: "El anfitrión cerró la sala." });
      rooms.delete(code);
    } else {
      room.players = room.players.filter(p => p !== player);
      room.players.forEach((p, idx) => {   // se reindexan los IDs
        p.id = idx;
        const entry = socketToRoom.get(p.socketId);
        if (entry) entry.playerId = idx;
      });
      io.to(code).emit("room_updated", sanitizeRoom(room));
    }
  } else {
    player.connected = false;
    io.to(code).emit("player_disconnected", { playerId: player.id, name: player.name });
    if (isHost) {
      io.to(code).emit("room_closed", { reason: "El anfitrión se desconectó." });
      rooms.delete(code);
    }
  }
}

function handleDisconnect(socket, explicit) {
  const mapping = socketToRoom.get(socket.id);
  if (!mapping) return;

  const { code, playerId } = mapping;
  socketToRoom.delete(socket.id);
  socket.leave(code);

  const room = rooms.get(code);
  if (!room) return;
  const player = room.players.find(p => p.id === playerId && p.socketId === socket.id);
  if (!player) return;   // ya se reconectó con otro socket

  if (explicit) return finalizeLeave(code, player);

  // Caída de conexión: queda marcado como desconectado y se espera a que vuelva
  player.connected = false;
  io.to(code).emit("room_updated", sanitizeRoom(room));
  io.to(code).emit("player_disconnected", { playerId, name: player.name, waiting: true, graceMs: RECONNECT_GRACE_MS });
  if (player.graceTimer) clearTimeout(player.graceTimer);
  player.graceTimer = setTimeout(() => finalizeLeave(code, player), RECONNECT_GRACE_MS);
}

// Limpiar salas inactivas cada 30 minutos
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (now - room.createdAt > 4 * 60 * 60 * 1000) { // 4 horas
      rooms.delete(code);
    }
  }
}, 30 * 60 * 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[ChiquiDraft] Servidor listo y escuchando en http://localhost:${PORT}`);
});
