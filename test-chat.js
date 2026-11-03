/**
 * test-chat.js - Pruebas del chat de la sala (server.js).
 * No necesita instalar nada: reemplaza express y socket.io por versiones mínimas en memoria,
 * carga el server.js real y le conecta sockets simulados.
 *   node test-chat.js
 */
const assert = require("assert");
const Module = require("module");

/* ---------- socket.io simulado ---------- */
const rooms = new Map();                 // sala -> Set(socket)
const sockets = new Map();               // id -> socket
let connectionHandler = null;

function emitToRoom(room, event, payload, except) {
  (rooms.get(room) || new Set()).forEach(s => { if (s !== except) s._got.push({ event, payload }); });
}
class FakeIO {
  constructor() {}
  on(ev, fn) { if (ev === "connection") connectionHandler = fn; }
  to(target) {
    return { emit: (event, payload) => {
      if (sockets.has(target)) sockets.get(target)._got.push({ event, payload });
      else emitToRoom(target, event, payload);
    } };
  }
}
let nextId = 1;
function fakeSocket(sessionId) {
  const handlers = {};
  const s = {
    id: "sock" + nextId++,
    _got: [],
    handshake: { auth: { sessionId }, query: {}, address: "127.0.0.1" },
    on(ev, fn) { handlers[ev] = fn; },
    emit(event, payload) { s._got.push({ event, payload }); },     // servidor -> cliente
    join(r) { if (!rooms.has(r)) rooms.set(r, new Set()); rooms.get(r).add(s); },
    leave(r) { if (rooms.has(r)) rooms.get(r).delete(s); },
    to(r) { return { emit: (event, payload) => emitToRoom(r, event, payload, s) }; },
    // cliente -> servidor: devuelve la respuesta del callback
    call(event, data) {
      return new Promise(res => {
        const h = handlers[event];
        if (!h) return res({ _noHandler: true });
        if (data === undefined) h(res); else h(data, res);
      });
    },
    got(event) { return s._got.filter(g => g.event === event).map(g => g.payload); }
  };
  sockets.set(s.id, s);
  connectionHandler(s);
  return s;
}

/* ---------- express / socket.io falsos ---------- */
const origLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === "express") {
    const app = { use() {}, get() {}, post() {}, listen() {} };
    const ex = () => app;
    ex.json = () => (() => {}); ex.static = () => (() => {});
    return ex;
  }
  if (request === "socket.io") return { Server: FakeIO };
  return origLoad.call(this, request, ...rest);
};

process.env.PORT = "0";
const http = require("http");
const realCreate = http.createServer;
http.createServer = function () { const srv = realCreate.apply(http, arguments); srv.listen = (p, cb) => { cb && cb(); return srv; }; return srv; };

const db = require("./db");
require("./server.js");

const sleep = ms => new Promise(r => setTimeout(r, ms));
let passed = 0;
function ok(msg) { passed++; console.log("✔ " + msg); }

(async () => {
  const host = fakeSocket("sess-host");
  const guest = fakeSocket("sess-guest");
  const outsider = fakeSocket("sess-out");

  // Sin sala no se puede chatear
  let r = await outsider.call("chat_send", { text: "hola" });
  assert.strictEqual(r.ok, false);
  ok("Quien no está en una sala no puede chatear.");

  const created = await host.call("create_room", { club: "Boca", game: "puja", min: 2, max: 4 });
  assert.ok(created.ok);
  const code = created.code;
  const joined = await guest.call("join_room", { code, club: "River" });
  assert.ok(joined.ok);

  // Mensaje de texto: llega a todos (anfitrión incluido) con el nombre verificado
  r = await guest.call("chat_send", { text: "  Hola   a todos  ", name: "Falso", playerId: 0 });
  assert.strictEqual(r.ok, true);
  let m = host.got("chat_msg").pop();
  assert.ok(m, "el anfitrión recibe el mensaje");
  assert.strictEqual(m.text, "Hola a todos", "espacios normalizados");
  assert.strictEqual(m.name, "River", "el nombre lo pone el servidor");
  assert.strictEqual(m.playerId, joined.youId, "el id lo pone el servidor");
  assert.strictEqual(m.kind, "text");
  assert.ok(/^#[0-9a-f]{6}$/.test(m.color));
  assert.ok(guest.got("chat_msg").length === 1, "el que envía también lo recibe");
  assert.strictEqual(guest.got("chat_msg")[0].mine, true, "para quien lo escribió es suyo (\"Vos\", a la derecha)");
  assert.strictEqual(m.mine, false, "para el anfitrión es de otro (con el nombre del club, a la izquierda)");
  assert.strictEqual("sid" in m, false, "la sesión privada no se filtra a los demás");
  assert.strictEqual(outsider.got("chat_msg").length, 0, "otra sala no lo recibe");
  ok("El texto llega a toda la sala con nombre e id verificados (no se puede suplantar).");

  // Texto vacío, solo espacios / caracteres de control, y largo máximo
  await sleep(650);
  r = await guest.call("chat_send", { text: "   \u0000\u202e  " });
  assert.strictEqual(r.ok, false);
  await sleep(650);
  r = await guest.call("chat_send", { text: "x".repeat(500) });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(guest.got("chat_msg").pop().text.length, 200);
  await sleep(650);
  r = await guest.call("chat_send", { text: "a\u202eb\u200bc" });
  assert.strictEqual(guest.got("chat_msg").pop().text, "a b c", "se quitan los caracteres que invierten/ocultan texto");
  ok("Se rechaza el texto vacío, se corta a 200 y se limpian caracteres de control.");

  // Frases rápidas: solo las de la lista, el texto lo pone el servidor
  await sleep(650);
  r = await host.call("chat_send", { quick: "golazo", text: "otra cosa" });
  assert.strictEqual(r.ok, true);
  m = guest.got("chat_msg").pop();
  assert.strictEqual(m.kind, "quick");
  assert.strictEqual(m.text, "¡Golazo! ⚽");
  assert.strictEqual(m.mine, false, "el mensaje del anfitrión NO es \"mío\" para el invitado");
  assert.strictEqual(host.got("chat_msg").pop().mine, true, "y sí lo es para el propio anfitrión");
  await sleep(650);
  r = await host.call("chat_send", { quick: "__proto__" });
  assert.strictEqual(r.ok, false);
  await sleep(650);
  r = await host.call("chat_send", { quick: "constructor" });
  assert.strictEqual(r.ok, false);
  ok("Chat rápido: solo frases permitidas (y no se cuela __proto__ / constructor).");

  // Reacciones: lista fija, no quedan en el historial
  await sleep(650);
  r = await guest.call("chat_send", { react: "🔥" });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(host.got("chat_msg").pop().kind, "react");
  await sleep(650);
  r = await guest.call("chat_send", { react: "<img src=x>" });
  assert.strictEqual(r.ok, false);
  const hist = await guest.call("chat_history");
  assert.ok(hist.ok && hist.messages.length >= 3);
  assert.ok(hist.messages.every(x => x.kind !== "react"), "las reacciones no se guardan");
  assert.ok(hist.messages.some(x => x.text === "Hola a todos"));
  assert.ok(hist.messages.filter(x => x.text === "¡Golazo! ⚽").every(x => x.mine === false), "historial del invitado: lo del anfitrión no es suyo");
  assert.ok(hist.messages.filter(x => x.text === "Hola a todos").every(x => x.mine === true), "historial del invitado: lo suyo es suyo");
  const hh = await host.call("chat_history");
  assert.ok(hh.messages.filter(x => x.text === "¡Golazo! ⚽").every(x => x.mine === true), "historial del anfitrión: lo suyo es suyo");
  assert.ok(hh.messages.every(x => !("sid" in x)), "el historial tampoco filtra sesiones");
  const poo = fakeSocket("sess-poo"); // socket nuevo: el tope de 8 mensajes cada 10 s ya se gastó en las pruebas anteriores
  assert.ok((await poo.call("join_room", { code, club: "Poop" })).ok);
  r = await poo.call("chat_send", { react: "💩" });
  assert.strictEqual(r.ok, true, "la reacción 💩 está permitida");
  assert.strictEqual(host.got("chat_msg").pop().text, "💩");
  ok("Reacciones: solo emojis permitidos (incluido 💩) y no se guardan en el historial.");

  // Entradas inválidas
  await sleep(650);
  for (const bad of [null, "texto", 42, [1, 2], {}]) {
    r = await guest.call("chat_send", bad);
    assert.strictEqual(r.ok, false);
    await sleep(650);
  }
  ok("Cargas inválidas rechazadas sin romper el servidor.");

  // Límite de frecuencia
  r = await guest.call("chat_send", { text: "uno" });
  assert.strictEqual(r.ok, true);
  r = await guest.call("chat_send", { text: "dos" });
  assert.strictEqual(r.ok, false, "dos mensajes pegados se rechazan");
  ok("Límite de frecuencia: no se puede spamear.");

  const flood = fakeSocket("sess-flood");
  const fj = await flood.call("join_room", { code, club: "Flood" });
  assert.ok(fj.ok);
  let accepted = 0;
  for (let i = 0; i < 12; i++) {
    r = await flood.call("chat_send", { text: "m" + i });
    if (r.ok) accepted++;
    await sleep(620);
  }
  assert.ok(accepted <= 8, "máximo 8 mensajes cada 10 s (aceptados: " + accepted + ")");
  ok("Tope de 8 mensajes cada 10 segundos por jugador.");

  // Historial acotado a 50 y se limpia al cerrar la sala
  const hs = await host.call("chat_history");
  assert.ok(hs.messages.length <= 50);
  const last = hs.messages[hs.messages.length - 1];
  assert.ok(last && typeof last.id === "string");
  ok("Historial acotado (últimos 50).");

  // Un invitado nuevo (o que se reconecta) recupera el historial; quien no está en sala, no
  const out = await outsider.call("chat_history");
  assert.strictEqual(out.ok, false);
  assert.deepStrictEqual(out.messages, []);
  ok("Fuera de una sala no se ve el historial de nadie.");

  // Cerrar la sala antes de empezar borra el historial
  host.call("leave_room"); // este evento no tiene callback: no se espera la respuesta
  await sleep(50);
  const g2 = await guest.call("chat_history");
  assert.deepStrictEqual(g2.messages, [], "el historial de la sala cerrada se borró");
  await sleep(650);
  const g3 = await guest.call("chat_send", { text: "¿hay alguien?" });
  assert.strictEqual(g3.ok, false, "no se puede escribir en una sala que ya no existe");
  assert.ok(guest.got("room_closed").length === 1, "el invitado recibió el aviso de sala cerrada");
  ok("Al cerrar la sala se borra el chat y ya no se puede escribir en ella.");

  db.deleteRoom(code);
  console.log("\n=== " + passed + " pruebas de chat OK ===");
  process.exit(0);
})().catch(e => { console.error("✘ " + (e && e.stack || e)); try { process.exit(1); } catch (_) {} });
