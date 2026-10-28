const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const crypto = require("crypto");
const db = require("./db");

// Inicializar el sistema de base de datos / almacenamiento aislado
db.init();

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

// Middleware para parsear JSON y habilitar CORS
app.use(express.json({ limit: "5mb" }));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", Array.isArray(CORS_ORIGIN) ? (CORS_ORIGIN.includes(req.headers.origin) ? req.headers.origin : CORS_ORIGIN[0]) : "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// Servir todos los archivos estáticos de ChiquiDraft
app.use(express.static(path.join(__dirname)));

// =========================================================
// RUTAS REST DE SESIÓN Y SALAS
// =========================================================

// Monitoreo del servidor
app.get("/health", (req, res) => {
  const activeRooms = db.getAllRooms();
  res.json({
    status: "ok",
    activeRooms: activeRooms.length,
    timestamp: Date.now()
  });
});

// Obtener datos de sesión/usuario
app.get("/api/session/:sessionId", (req, res) => {
  const session = db.getSession(req.params.sessionId);
  if (!session) return res.status(404).json({ ok: false, error: "Sesión no encontrada" });
  res.json({ ok: true, session });
});

// Guardar/actualizar datos de sesión/usuario
app.post("/api/session/:sessionId", (req, res) => {
  const updated = db.saveSession(req.params.sessionId, req.body || {});
  res.json({ ok: true, session: updated });
});

// Consultar estado de una sala
app.get("/api/room/:code", (req, res) => {
  const room = db.getRoom(req.params.code);
  if (!room) return res.status(404).json({ ok: false, error: "Sala no encontrada" });
  res.json({ ok: true, room: sanitizeRoom(room) });
});

// SPA fallback: index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// =========================================================
// GESTOR DE CONEXIONES Y SESIONES EN TIEMPO REAL
// =========================================================

// Mapa de sockets activos a sus sesiones correspondientes: socket.id -> { code, playerId, sessionId }
const socketToSession = new Map();

/* Pantallas propias por jugador (mercado): el anfitrión le manda a cada invitado solo la suya.
   Se guarda la última en memoria para devolvérsela si el jugador se reconecta. */
const playerFrames = new Map();
function clearPlayerFrames(code) {
  for (const k of Array.from(playerFrames.keys())) if (k.startsWith(code + ":")) playerFrames.delete(k);
  chatHistory.delete(code);
}

/* ---- Chat de la sala ----
   Mensajes de texto y frases rápidas entre todos los jugadores (lobby, mercado, liga y partidos en vivo).
   El servidor arma el mensaje con el nombre y el color VERIFICADOS del jugador (el cliente no puede suplantar a otro),
   limpia el texto, limita la frecuencia y guarda solo los últimos mensajes en memoria para quien se reconecta. */
const CHAT_MAX_LEN = 200;
const CHAT_HISTORY = 50;
const chatHistory = new Map(); // código de sala -> [mensajes]
const QUICK_CHAT = {           // frases rápidas permitidas (id -> texto); solo se acepta una de esta lista
  gg: "¡Buen partido!",
  golazo: "¡Golazo! ⚽",
  suerte: "¡Qué suerte! 🍀",
  jaja: "Jajaja 😂",
  apura: "¡Apurate! ⏱️",
  buena: "¡Buena jugada! 👏",
  revancha: "¡Revancha! 🔥",
  ni: "Ni lo sueñes 😏",
  gracias: "¡Gracias!",
  ups: "Uy, me equivoqué 😅",
  calma: "Tranqui, todavía no terminó",
  mala: "Mala suerte 😬"
};
const QUICK_REACT = ["👏", "😂", "🔥", "😮", "😭", "🤝", "💪", "🙌", "💩"];

function cleanChatText(t) {
  return String(t == null ? "" : t)
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, " ") // controles y caracteres que invierten/ocultan texto
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, CHAT_MAX_LEN);
}
function chatPush(code, msg) {
  let h = chatHistory.get(code);
  if (!h) { h = []; chatHistory.set(code, h); }
  h.push(msg);
  if (h.length > CHAT_HISTORY) h.splice(0, h.length - CHAT_HISTORY);
}

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

// Colores disponibles para los clubes
const DEFAULT_COLORS = ["#35d17c","#5b8def","#f0b90b","#e5484d","#a78bfa","#22d3ee","#fb923c","#f472b6","#84cc16","#38bdf8","#f97316","#c084fc","#2dd4bf","#eab308","#f87171","#818cf8"];
function cleanColor(c) {
  c = String(c || "").trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(c) ? c : null;
}
function effectiveColor(room, p) {
  return p.color || DEFAULT_COLORS[room.players.indexOf(p) % DEFAULT_COLORS.length];
}

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

/* ---- Votación para empezar la partida ----
   El anfitrión la propone (su voto cuenta como "Sí"). Empieza cuando vota "Sí" más de la mitad de los jugadores
   conectados; se rechaza si ya no se puede llegar a esa mayoría, si el anfitrión la cancela o si se acaba el tiempo.
   Vive solo en memoria (dura segundos): no se guarda con la sala. Los votos se asocian a la sesión del jugador
   porque los números de jugador se reasignan cuando alguien sale de la sala. */
const START_VOTE_MS = Number(process.env.START_VOTE_MS) || 30000;
const startVotes = new Map(); // código de sala -> { yes:Set(sessionId), no:Set(sessionId), endsAt, timer }

function voteClear(code) {
  const v = startVotes.get(code);
  if (v) { clearTimeout(v.timer); startVotes.delete(code); }
}
function voteView(room) {
  const v = room && startVotes.get(room.code);
  if (!v) return null;
  const conn = room.players.filter(p => p.connected);
  return {
    total: conn.length,
    need: Math.floor(conn.length / 2) + 1,
    yes: conn.filter(p => v.yes.has(p.sessionId)).map(p => p.id),
    no: conn.filter(p => v.no.has(p.sessionId)).map(p => p.id),
    endsAt: v.endsAt,
    leftMs: Math.max(0, v.endsAt - Date.now())
  };
}
/* Termina la votación. result: "passed" | "rejected" | "cancelled" */
function voteFinish(room, result, msg) {
  voteClear(room.code);
  if (result === "passed") {
    room.started = true;
    db.saveRoom(room.code, room);
    io.to(room.code).emit("game_started", { code: room.code, room: sanitizeRoom(room), teams: room.players.map(p => p.name) });
  }
  io.to(room.code).emit("start_vote_end", { result, msg: msg || "" });
  io.to(room.code).emit("room_updated", sanitizeRoom(room));
}
/* Revisa si la votación ya se decidió (cada voto, cada baja de un jugador) */
function voteEval(room) {
  const v = startVotes.get(room.code);
  if (!v || room.started) return;
  const conn = room.players.filter(p => p.connected);
  if (!conn.some(p => p.host)) return voteFinish(room, "cancelled", "El anfitrión se desconectó: se canceló la votación.");
  const total = conn.length, need = Math.floor(total / 2) + 1;
  const yes = conn.filter(p => v.yes.has(p.sessionId)).length;
  const no = conn.filter(p => v.no.has(p.sessionId)).length;
  if (yes >= need) {
    if (total < room.min || total > room.max) return voteFinish(room, "rejected", "Cantidad de jugadores inválida: no se empieza.");
    return voteFinish(room, "passed");
  }
  if (total - no < need) return voteFinish(room, "rejected", "No se llegó a la mayoría: no se empieza la partida.");
  io.to(room.code).emit("room_updated", sanitizeRoom(room));
}

function sanitizeRoom(room) {
  if (!room) return null;
  return {
    code: room.code,
    game: room.game,
    min: room.min,
    max: room.max,
    champions: !!room.champions,
    lines: room.lines || [],
    settings: room.settings || {},
    started: room.started,
    vote: voteView(room),
    players: (room.players || []).map(p => ({
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
  // Extraer o generar identificador único de sesión para este cliente
  const handshakeSessionId = (socket.handshake.auth && socket.handshake.auth.sessionId) ||
                            (socket.handshake.query && socket.handshake.query.sessionId);
  const sessionId = handshakeSessionId ? String(handshakeSessionId).trim() : newToken();
  
  // Guardar/recuperar sesión en base de datos
  let userSession = db.getSession(sessionId);
  if (!userSession) {
    userSession = db.saveSession(sessionId, {
      createdAt: Date.now(),
      lastIp: socket.handshake.address
    });
  }
  
  // Asignar bucket de tasa de acciones EXCLUSIVO para este socket (aislamiento de rate limit)
  socket._rateBucket = { n: 0, t: Date.now() };

  // Notificar al cliente de su sessionId asignado
  socket.emit("session_ready", { sessionId });

  // 1. CREAR SALA
  socket.on("create_room", (data, callback) => {
    try {
      let code = generateRoomCode();
      let attempts = 0;
      while (db.getRoom(code) && attempts < 15) {
        code = generateRoomCode();
        attempts++;
      }

      const clubName = cleanName(data.club) || "Anfitrión";
      const hostToken = newToken();
      const room = {
        code,
        hostSocketId: socket.id,
        hostSessionId: sessionId,
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
            sessionId,
            name: clubName,
            color: cleanColor(data.color),
            color2: cleanColor(data.color2),
            stadium: cleanStadium(data.stadium),
            crest: cleanCrest(data.crest),
            host: true,
            connected: true,
            socketId: socket.id,
            token: hostToken
          }
        ],
        createdAt: Date.now()
      };

      // Guardar en la base de datos de salas
      db.saveRoom(code, room);

      // Vincular el socket del usuario a su sesión y sala
      socketToSession.set(socket.id, { code, playerId: 0, sessionId });
      
      // Actualizar sesión del usuario
      db.saveSession(sessionId, {
        activeRoom: code,
        playerId: 0,
        clubName
      });

      socket.join(code);

      if (typeof callback === "function") {
        callback({ ok: true, code, youId: 0, token: hostToken, room: sanitizeRoom(room), sessionId });
      }
    } catch (err) {
      if (typeof callback === "function") callback({ ok: false, error: err.message });
    }
  });

  // 2. UNIRSE A SALA
  socket.on("join_room", (data, callback) => {
    try {
      const code = String(data.code || "").trim().toUpperCase();
      const room = db.getRoom(code);

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
      if (wanted && colorOwner(room, wanted, null)) wanted = null; // ya lo usa otro club
      const playerToken = newToken();
      const player = {
        id: newId,
        sessionId,
        name: clubName,
        color: wanted,
        color2: cleanColor(data.color2),
        stadium: cleanStadium(data.stadium),
        crest: cleanCrest(data.crest),
        host: false,
        connected: true,
        socketId: socket.id,
        token: playerToken
      };

      room.players.push(player);

      // Persistir sala actualizada en la base de datos
      db.saveRoom(code, room);

      // Mapear sesión del socket
      socketToSession.set(socket.id, { code, playerId: newId, sessionId });

      // Guardar en la sesión del usuario
      db.saveSession(sessionId, {
        activeRoom: code,
        playerId: newId,
        clubName
      });

      socket.join(code);

      const sRoom = sanitizeRoom(room);
      if (typeof callback === "function") {
        callback({ ok: true, code, youId: newId, token: playerToken, room: sRoom, sessionId });
      }

      // Notificar a todos en la sala del nuevo jugador
      io.to(code).emit("room_updated", sRoom);
    } catch (err) {
      if (typeof callback === "function") callback({ ok: false, error: err.message });
    }
  });

  // 2b. CAMBIAR COLOR DEL CLUB
  socket.on("set_color", (data, callback) => {
    try {
      const mapping = socketToSession.get(socket.id);
      if (!mapping) return callback && callback({ ok: false, error: "No estás en una sala." });
      const room = db.getRoom(mapping.code);
      const me = room && room.players.find(p => p.id === mapping.playerId);
      if (!room || !me) return callback && callback({ ok: false, error: "No estás en una sala." });
      if (room.started) return callback && callback({ ok: false, error: "La partida ya empezó." });

      const color = data && data.color ? cleanColor(data.color) : null;
      if (data && data.color && !color) return callback && callback({ ok: false, error: "Color inválido." });
      if (color) {
        const owner = colorOwner(room, color, me);
        if (owner) return callback && callback({ ok: false, error: "Ese color ya lo tiene " + owner.name + "." });
      }

      me.color = color;
      db.saveRoom(room.code, room);

      const sRoom = sanitizeRoom(room);
      io.to(room.code).emit("room_updated", sRoom);
      if (typeof callback === "function") callback({ ok: true, room: sRoom });
    } catch (err) {
      if (typeof callback === "function") callback({ ok: false, error: err.message });
    }
  });

  // 2c. CAMBIAR DATOS COMPLETOS DEL CLUB
  socket.on("set_club", (data, callback) => {
    try {
      const mapping = socketToSession.get(socket.id);
      if (!mapping) return callback && callback({ ok: false, error: "No estás en una sala." });
      const room = db.getRoom(mapping.code);
      const me = room && room.players.find(p => p.id === mapping.playerId);
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

      db.saveRoom(room.code, room);

      const sRoom = sanitizeRoom(room);
      io.to(room.code).emit("room_updated", sRoom);
      if (typeof callback === "function") callback({ ok: true, room: sRoom });
    } catch (err) {
      if (typeof callback === "function") callback({ ok: false, error: err.message });
    }
  });

  // 2d. RECONECTAR / RETOMAR LUGAR EN LA SALA
  socket.on("rejoin_room", (data, callback) => {
    try {
      data = data || {};
      const code = String(data.code || "").trim().toUpperCase();
      const room = db.getRoom(code);
      const player = room && room.players.find(p => (p.token && p.token === String(data.token || "")) || (p.sessionId && p.sessionId === sessionId));

      if (!room || !player) {
        return callback && callback({ ok: false, error: "La sala ya no existe o se te quitó el lugar." });
      }

      // Cancelar temporizador de gracia si estaba activo
      if (player.graceTimer) {
        clearTimeout(player.graceTimer);
        player.graceTimer = null;
      }

      // Limpiar socket anterior si quedó registrado
      if (player.socketId && player.socketId !== socket.id) {
        socketToSession.delete(player.socketId);
      }

      player.socketId = socket.id;
      player.sessionId = sessionId;
      player.connected = true;
      if (player.host) room.hostSocketId = socket.id;

      // Persistir estado de reconexión en la base de datos
      db.saveRoom(code, room);

      socketToSession.set(socket.id, { code, playerId: player.id, sessionId });
      socket.join(code);

      const sRoom = sanitizeRoom(room);
      io.to(code).emit("room_updated", sRoom);
      io.to(code).emit("player_reconnected", { playerId: player.id, name: player.name });

      // Si la partida ya empezó, recuperar snapshot guardado en DB para hidratar al jugador
      const cachedGameState = db.getGameState(code);
      if (cachedGameState && !player.host) {
        socket.emit("guest_sync", cachedGameState);
      }
      const own = !player.host && playerFrames.get(code + ":" + player.id);
      if (own) socket.emit("guest_sync_player", { html: own });
      if (room.started && !player.host) {
        // Se le pide al anfitrión que reenvíe la pantalla (y la propia de este jugador)
        io.to(room.hostSocketId).emit("resync_request", { playerId: player.id });
      }

      if (typeof callback === "function") {
        callback({
          ok: true,
          code,
          youId: player.id,
          host: !!player.host,
          started: !!room.started,
          room: sRoom
        });
      }
    } catch (err) {
      if (typeof callback === "function") callback({ ok: false, error: err.message });
    }
  });

  // 3. EMPEZAR PARTIDA
  socket.on("start_game", (data, callback) => {
    try {
      const mapping = socketToSession.get(socket.id);
      if (!mapping) return;
      const room = db.getRoom(mapping.code);
      if (!room || room.hostSocketId !== socket.id) return;

      const activePlayers = room.players.filter(p => p.connected);
      if (activePlayers.length < room.min || activePlayers.length > room.max) {
        return callback && callback({ ok: false, error: "Cantidad de jugadores inválida." });
      }

      room.started = true;
      db.saveRoom(room.code, room);

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

  // 3a. VOTACIÓN PARA EMPEZAR: la propone el anfitrión, vota cada jugador conectado
  socket.on("start_vote", (data, callback) => {
    try {
      const mapping = socketToSession.get(socket.id);
      const room = mapping && db.getRoom(mapping.code);
      if (!room || room.hostSocketId !== socket.id) return callback && callback({ ok: false, error: "Solo el anfitrión puede proponer empezar." });
      if (room.started) return callback && callback({ ok: false, error: "La partida ya empezó." });
      const conn = room.players.filter(p => p.connected);
      if (conn.length < room.min || conn.length > room.max) return callback && callback({ ok: false, error: "Cantidad de jugadores inválida." });
      if (startVotes.has(room.code)) return callback && callback({ ok: true });
      const host = room.players.find(p => p.host);
      const code = room.code;
      startVotes.set(code, {
        yes: new Set([host.sessionId]), no: new Set(), endsAt: Date.now() + START_VOTE_MS,
        timer: setTimeout(() => {
          const r = db.getRoom(code);
          if (r && startVotes.has(code)) voteFinish(r, "rejected", "Se acabó el tiempo sin llegar a la mayoría: no se empieza.");
          else voteClear(code);
        }, START_VOTE_MS)
      });
      voteEval(room);
      if (typeof callback === "function") callback({ ok: true });
    } catch (err) {
      if (typeof callback === "function") callback({ ok: false, error: err.message });
    }
  });

  socket.on("cast_vote", (data, callback) => {
    try {
      const mapping = socketToSession.get(socket.id);
      const room = mapping && db.getRoom(mapping.code);
      const v = room && startVotes.get(room.code);
      if (!room || !v || room.started) return callback && callback({ ok: false, error: "No hay una votación abierta." });
      const me = room.players.find(p => p.sessionId === mapping.sessionId && p.connected);
      if (!me) return callback && callback({ ok: false, error: "No estás en la sala." });
      if (me.host) return callback && callback({ ok: true }); // el voto del anfitrión es el que propone empezar
      const yes = !!(data && data.yes);
      v.yes.delete(me.sessionId); v.no.delete(me.sessionId);
      (yes ? v.yes : v.no).add(me.sessionId);
      voteEval(room);
      if (typeof callback === "function") callback({ ok: true });
    } catch (err) {
      if (typeof callback === "function") callback({ ok: false, error: err.message });
    }
  });

  socket.on("cancel_vote", (data, callback) => {
    try {
      const mapping = socketToSession.get(socket.id);
      const room = mapping && db.getRoom(mapping.code);
      if (!room || room.hostSocketId !== socket.id || !startVotes.has(room.code)) return callback && callback({ ok: false });
      voteFinish(room, "cancelled", "El anfitrión canceló la votación.");
      if (typeof callback === "function") callback({ ok: true });
    } catch (err) {
      if (typeof callback === "function") callback({ ok: false, error: err.message });
    }
  });

  // 3b. AJUSTES EN VIVO (Solo anfitrión)
  socket.on("update_room", (data, callback) => {
    try {
      const mapping = socketToSession.get(socket.id);
      const room = mapping && db.getRoom(mapping.code);
      if (!room || room.hostSocketId !== socket.id || !data) {
        return callback && callback({ ok: false, error: "Solo el anfitrión puede cambiar los ajustes." });
      }

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

      db.saveRoom(room.code, room);

      const sRoom = sanitizeRoom(room);
      io.to(room.code).emit("room_updated", sRoom);
      if (typeof callback === "function") callback({ ok: true, room: sRoom });
    } catch (err) {
      if (typeof callback === "function") callback({ ok: false, error: err.message });
    }
  });

  // 4. ACCIÓN DE JUGADOR (Invitado -> Anfitrión)
  // Cada socket tiene su propio limitador de frecuencia (socket._rateBucket)
  socket.on("player_action", (act, callback) => {
    const reply = (r) => { if (typeof callback === "function") callback(r); };
    const mapping = socketToSession.get(socket.id);
    if (!mapping) return reply({ ok: false, error: "No estás en una sala." });
    const room = db.getRoom(mapping.code);
    if (!room || !room.started) return reply({ ok: false, error: "La partida no empezó." });
    if (!act || typeof act !== "object" || Array.isArray(act)) return reply({ ok: false, error: "Acción inválida." });

    // Rate limit aislado por socket individual (40 acciones por segundo)
    const now = Date.now();
    if (now - socket._rateBucket.t > 1000) {
      socket._rateBucket.t = now;
      socket._rateBucket.n = 0;
    }
    if (++socket._rateBucket.n > 40) return reply({ ok: false, error: "Demasiadas acciones seguidas." });

    let size = 0;
    try { size = JSON.stringify(act).length; } catch (e) { size = Infinity; }
    if (size > 20000) return reply({ ok: false, error: "Acción demasiado grande." });

    const host = room.players.find(p => p.host);
    if (!host || !host.connected) return reply({ ok: false, error: "El anfitrión se está reconectando…" });

    // Se asegura de que la acción lleve el ID verificado del jugador en la sala
    act.playerId = mapping.playerId;
    io.to(room.hostSocketId).emit("player_action", act);
    reply({ ok: true });
  });

  // 5. SINCRONIZACIÓN DE PANTALLA / ESTADO (Anfitrión -> Invitados)
  socket.on("host_sync", (data) => {
    const mapping = socketToSession.get(socket.id);
    if (!mapping) return;
    const room = db.getRoom(mapping.code);
    if (!room || room.hostSocketId !== socket.id) return;

    // Guardar el último estado en base de datos para recuperación inmediata de invitados
    db.saveGameState(room.code, data);

    // Transmitir a todos los sockets de la sala excepto al anfitrión
    socket.to(room.code).emit("guest_sync", data);
  });

  // 5b. PANTALLA PROPIA DE UN JUGADOR (Anfitrión -> un solo invitado): mercado privado de cada equipo
  socket.on("host_sync_player", (data) => {
    const mapping = socketToSession.get(socket.id);
    if (!mapping || !data || typeof data !== "object") return;
    const room = db.getRoom(mapping.code);
    if (!room || room.hostSocketId !== socket.id) return;
    const target = room.players.find(p => p.id === data.playerId && !p.host);
    if (!target || !target.socketId || !target.connected) return;
    const payload = {};
    if (typeof data.html === "string") {
      payload.html = data.html;
      playerFrames.set(room.code + ":" + target.id, data.html);
    }
    if (Array.isArray(data.toasts)) payload.toasts = data.toasts.slice(0, 8);
    // va SOLO al socket de ese jugador: los demás no reciben nada
    io.to(target.socketId).emit("guest_sync_player", payload);
  });

  // 5c. CHAT DE LA SALA (cualquier jugador -> todos los de la sala, incluido el anfitrión)
  // data: { text } para un mensaje escrito, { quick: "<id>" } para una frase rápida o { react: "<emoji>" } para una reacción
  socket.on("chat_send", (data, callback) => {
    const reply = (r) => { if (typeof callback === "function") callback(r); };
    const mapping = socketToSession.get(socket.id);
    if (!mapping) return reply({ ok: false, error: "No estás en una sala." });
    const room = db.getRoom(mapping.code);
    if (!room) return reply({ ok: false, error: "La sala ya no existe." });
    const player = room.players.find(p => p.id === mapping.playerId);
    if (!player) return reply({ ok: false, error: "No estás en esta sala." });
    if (!data || typeof data !== "object" || Array.isArray(data)) return reply({ ok: false, error: "Mensaje inválido." });

    // Límite propio del chat: 1 mensaje cada 600 ms y 8 cada 10 s por jugador
    const now = Date.now();
    const cb = socket._chatBucket || (socket._chatBucket = { last: 0, t: now, n: 0 });
    if (now - cb.last < 600) return reply({ ok: false, error: "Esperá un instante antes de escribir de nuevo." });
    if (now - cb.t > 10000) { cb.t = now; cb.n = 0; }
    if (++cb.n > 8) return reply({ ok: false, error: "Estás escribiendo muy rápido." });

    let kind = "text", text = "";
    if (typeof data.react === "string") {
      if (!QUICK_REACT.includes(data.react)) return reply({ ok: false, error: "Reacción inválida." });
      kind = "react"; text = data.react;
    } else if (typeof data.quick === "string") {
      if (!Object.prototype.hasOwnProperty.call(QUICK_CHAT, data.quick)) return reply({ ok: false, error: "Frase inválida." });
      kind = "quick"; text = QUICK_CHAT[data.quick];
    } else {
      text = cleanChatText(data.text);
      if (!text) return reply({ ok: false, error: "Escribí algo primero." });
    }
    cb.last = now;

    const msg = {
      id: crypto.randomBytes(6).toString("hex"),
      playerId: player.id,
      name: player.name,
      color: effectiveColor(room, player),
      kind,
      text,
      ts: now
    };
    if (kind !== "react") chatPush(room.code, msg); // las reacciones son pasajeras: no quedan en el historial
    io.to(room.code).emit("chat_msg", msg);
    reply({ ok: true });
  });

  // El cliente pide el historial al entrar o reconectarse
  socket.on("chat_history", (callback) => {
    const mapping = socketToSession.get(socket.id);
    if (typeof callback !== "function") return;
    if (!mapping) return callback({ ok: false, messages: [] });
    callback({ ok: true, messages: chatHistory.get(mapping.code) || [] });
  });

  // 6. GUARDAR Y LEER ESTADO DE PARTIDA PERSONALIZADO
  socket.on("save_state", (stateData, callback) => {
    try {
      const mapping = socketToSession.get(socket.id);
      const code = mapping ? mapping.code : (data && data.code);
      if (code) {
        db.saveGameState(code, stateData);
      } else {
        db.saveSession(sessionId, { state: stateData });
      }
      if (typeof callback === "function") callback({ ok: true });
    } catch (err) {
      if (typeof callback === "function") callback({ ok: false, error: err.message });
    }
  });

  socket.on("get_state", (callback) => {
    try {
      const mapping = socketToSession.get(socket.id);
      let state = null;
      if (mapping && mapping.code) {
        state = db.getGameState(mapping.code);
      } else {
        const sess = db.getSession(sessionId);
        state = sess ? sess.state : null;
      }
      if (typeof callback === "function") callback({ ok: true, state });
    } catch (err) {
      if (typeof callback === "function") callback({ ok: false, error: err.message });
    }
  });

  // 7. CERRAR O SALIR DE LA SALA
  socket.on("leave_room", () => {
    handleDisconnect(socket, true);
  });

  socket.on("disconnect", () => {
    handleDisconnect(socket, false);
  });
});

/* Aplica la salida definitiva de un jugador */
function finalizeLeave(code, player) {
  const room = db.getRoom(code);
  if (!room || !room.players.some(p => p.id === player.id)) return;
  if (player.graceTimer) {
    clearTimeout(player.graceTimer);
    player.graceTimer = null;
  }
  const isHost = !!player.host;

  if (!room.started) {
    if (isHost) {
      voteClear(code);
      io.to(code).emit("room_closed", { reason: "El anfitrión cerró la sala." });
      db.deleteRoom(code); clearPlayerFrames(code);
    } else {
      room.players = room.players.filter(p => p.id !== player.id);
      room.players.forEach((p, idx) => {
        p.id = idx;
        const entry = socketToSession.get(p.socketId);
        if (entry) entry.playerId = idx;
      });
      db.saveRoom(code, room);
      io.to(code).emit("room_updated", sanitizeRoom(room));
      voteEval(room); // si alguien se va en medio de la votación, la mayoría se recalcula
    }
  } else {
    player.connected = false;
    db.saveRoom(code, room);
    io.to(code).emit("player_disconnected", { playerId: player.id, name: player.name });
    if (isHost) {
      voteClear(code);
      io.to(code).emit("room_closed", { reason: "El anfitrión se desconectó." });
      db.deleteRoom(code); clearPlayerFrames(code);
    }
  }
}

function handleDisconnect(socket, explicit) {
  const mapping = socketToSession.get(socket.id);
  if (!mapping) return;

  const { code, playerId } = mapping;
  socketToSession.delete(socket.id);
  socket.leave(code);

  const room = db.getRoom(code);
  if (!room) return;
  const player = room.players.find(p => p.id === playerId && p.socketId === socket.id);
  if (!player) return; // ya se reconectó con otro socket

  if (explicit) return finalizeLeave(code, player);

  // Caída de conexión: queda marcado como desconectado y se espera a que vuelva
  player.connected = false;
  db.saveRoom(code, room);

  io.to(code).emit("room_updated", sanitizeRoom(room));
  io.to(code).emit("player_disconnected", { playerId, name: player.name, waiting: true, graceMs: RECONNECT_GRACE_MS });
  voteEval(room); // un jugador caído deja de contar en la votación

  if (player.graceTimer) clearTimeout(player.graceTimer);
  player.graceTimer = setTimeout(() => finalizeLeave(code, player), RECONNECT_GRACE_MS);
}

// Limpiar salas inactivas cada 30 minutos desde la base de datos
setInterval(() => {
  db.cleanup(4 * 60 * 60 * 1000); // 4 horas de inactividad
  for (const code of Array.from(chatHistory.keys())) if (!db.getRoom(code)) chatHistory.delete(code);
}, 30 * 60 * 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[ChiquiDraft] Servidor listo y escuchando en http://localhost:${PORT}`);
});
