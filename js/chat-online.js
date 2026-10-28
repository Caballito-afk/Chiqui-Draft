/* =========================================================
   CHAT ONLINE: chat de la sala + chat rápido
   - Visible en cualquier momento de una sala (sala de espera, puja, mercado, liga, partidos en vivo).
   - Vive dentro de #onlineUI, fuera de la pantalla espejada: no se mezcla con lo que el anfitrión transmite.
   - El servidor (server.js, evento "chat_send") arma cada mensaje con el nombre y color verificados del jugador,
     limpia el texto y limita la frecuencia. Acá todo el texto se pinta con textContent (nunca como HTML).
========================================================= */
(function () {
"use strict";

/* Los ids tienen que coincidir con QUICK_CHAT de server.js (el servidor es quien manda el texto final) */
var QUICK = [
  ["gg", "¡Buen partido!"], ["golazo", "¡Golazo! ⚽"],
  ["suerte", "¡Qué suerte! 🍀"], ["jaja", "Jajaja 😂"],
  ["apura", "¡Apurate! ⏱️"], ["buena", "¡Buena jugada! 👏"],
  ["revancha", "¡Revancha! 🔥"], ["ni", "Ni lo sueñes 😏"],
  ["gracias", "¡Gracias!"], ["ups", "Uy, me equivoqué 😅"],
  ["calma", "Tranqui, todavía no terminó"], ["mala", "Mala suerte 😬"]
];
var REACTS = ["👏", "😂", "🔥", "😮", "😭", "🤝", "💪", "🙌", "💩"];
var MAX_LEN = 200;      // igual que el servidor
var MAX_LOG = 100;      // mensajes que se dibujan a la vez
var MAX_BUBBLES = 3;    // avisos flotantes a la vez
var BUBBLE_MS = 6000;

var C = { code: null, msgs: [], seen: {}, unread: 0, open: false, quickOpen: false, bound: null, built: false, muted: false, el: {} };
try { C.muted = localStorage.getItem("chiquiChatMute") === "1"; } catch (e) {}

function $(id) { return document.getElementById(id); }
function mk(tag, cls, txt) {
  var n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt != null) n.textContent = txt;
  return n;
}
function okColor(c) { return /^#[0-9a-f]{6}$/i.test(String(c || "")) ? c : "#5b8def"; }
function toast(m) { if (typeof window.onlToast === "function") window.onlToast(m, 2500); }
function hhmm(ts) {
  var d = new Date(ts || Date.now());
  return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
}
function myId() { return window.ONL ? Number(ONL.myId) : -1; }

/* ---------- Construcción (una sola vez) ---------- */
function build() {
  var host = $("onlineUI");
  if (!host) return false;
  var E = C.el;

  E.root = mk("div"); E.root.id = "chatOnl";
  E.bubbles = mk("div", "chat-bubbles");
  E.bubbles.setAttribute("aria-hidden", "true");

  /* Chat rápido */
  E.quick = mk("div", "chat-quick"); E.quick.hidden = true;
  E.quick.setAttribute("role", "dialog"); E.quick.setAttribute("aria-label", "Chat rápido");
  E.quick.appendChild(mk("span", "chat-title", "Chat rápido"));
  var ph = mk("div", "chat-phrases");
  QUICK.forEach(function (q) {
    var b = mk("button", "chat-phrase", q[1]); b.type = "button";
    b.addEventListener("click", function () { send({ quick: q[0] }); toggleQuick(false); });
    ph.appendChild(b);
  });
  E.quick.appendChild(ph);
  var rc = mk("div", "chat-reacts");
  REACTS.forEach(function (r) {
    var b = mk("button", "chat-react-btn", r); b.type = "button"; b.setAttribute("aria-label", "Reaccionar " + r);
    b.addEventListener("click", function () { send({ react: r }); });
    rc.appendChild(b);
  });
  E.quick.appendChild(rc);

  /* Chat */
  E.panel = mk("div", "chat-panel"); E.panel.hidden = true;
  E.panel.setAttribute("role", "dialog"); E.panel.setAttribute("aria-label", "Chat de la sala");
  var head = mk("div", "chat-head");
  head.appendChild(mk("span", "chat-title", "Chat de la sala"));
  E.mute = mk("button", "chat-icon-btn"); E.mute.type = "button";
  E.mute.addEventListener("click", function () {
    C.muted = !C.muted;
    try { localStorage.setItem("chiquiChatMute", C.muted ? "1" : "0"); } catch (e) {}
    paintMute();
    if (C.muted) clearBubbles();
    toast(C.muted ? "Avisos del chat silenciados" : "Avisos del chat activados");
  });
  var close = mk("button", "chat-icon-btn", "✕"); close.type = "button"; close.setAttribute("aria-label", "Cerrar chat");
  close.addEventListener("click", function () { togglePanel(false); });
  head.appendChild(E.mute); head.appendChild(close);
  E.log = mk("div", "chat-log"); E.log.setAttribute("role", "log"); E.log.setAttribute("aria-live", "polite");
  E.empty = mk("div", "chat-empty", "Todavía no hay mensajes. ¡Rompé el hielo!");
  E.log.appendChild(E.empty);
  var form = mk("form", "chat-form"); form.setAttribute("autocomplete", "off");
  E.input = mk("input", "chat-input"); E.input.type = "text"; E.input.maxLength = MAX_LEN;
  E.input.placeholder = "Escribí un mensaje…"; E.input.setAttribute("aria-label", "Mensaje");
  E.input.setAttribute("enterkeyhint", "send");
  var sendBtn = mk("button", "btn primary chat-send", "Enviar"); sendBtn.type = "submit";
  form.appendChild(E.input); form.appendChild(sendBtn);
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var t = E.input.value.replace(/\s+/g, " ").trim();
    if (!t) return;
    send({ text: t }, function (ok) { if (ok) E.input.value = ""; });
  });
  E.panel.appendChild(head); E.panel.appendChild(E.log); E.panel.appendChild(form);

  /* Botones */
  var bar = mk("div", "chat-bar");
  E.qFab = mk("button", "chat-fab"); E.qFab.type = "button";
  E.qFab.setAttribute("aria-expanded", "false"); E.qFab.setAttribute("aria-label", "Chat rápido");
  E.qFab.appendChild(mk("span", "ico", "⚡")); E.qFab.appendChild(mk("span", "lbl", "Rápido"));
  E.qFab.addEventListener("click", function () { toggleQuick(!C.quickOpen); });
  E.fab = mk("button", "chat-fab"); E.fab.type = "button";
  E.fab.setAttribute("aria-expanded", "false"); E.fab.setAttribute("aria-label", "Chat");
  E.fab.appendChild(mk("span", "ico", "💬")); E.fab.appendChild(mk("span", "lbl", "Chat"));
  E.badge = mk("span", "chat-badge"); E.fab.appendChild(E.badge);
  E.fab.addEventListener("click", function () { togglePanel(!C.open); });
  bar.appendChild(E.qFab); bar.appendChild(E.fab);

  E.root.appendChild(E.bubbles); E.root.appendChild(E.quick); E.root.appendChild(E.panel); E.root.appendChild(bar);
  host.appendChild(E.root);

  E.float = mk("div"); E.float.id = "chatFloat"; E.float.setAttribute("aria-hidden", "true");
  host.appendChild(E.float);

  /* Que escribir o apretar teclas en el chat no dispare los atajos del juego (Espacio ficha en El Reloj, etc.) */
  E.root.addEventListener("keydown", function (e) {
    e.stopPropagation();
    if (e.key === "Escape") { if (C.quickOpen) toggleQuick(false); else if (C.open) togglePanel(false); }
  });
  /* Tocar fuera cierra el chat rápido */
  document.addEventListener("pointerdown", function (e) {
    if (C.quickOpen && E.root && !E.quick.contains(e.target) && !E.qFab.contains(e.target)) toggleQuick(false);
  }, true);

  var chipEl = $("onlChip");
  if (chipEl && window.ResizeObserver) { try { new ResizeObserver(function () { if (C.built) placeAboveChip(); }).observe(chipEl); } catch (e) {} }

  paintMute();
  C.built = true;
  return true;
}

function paintMute() {
  var m = C.el.mute; if (!m) return;
  m.textContent = C.muted ? "🔕" : "🔔";
  m.title = C.muted ? "Activar avisos y sonido del chat" : "Silenciar avisos y sonido del chat";
  m.setAttribute("aria-label", m.title);
}

/* ---------- Abrir / cerrar ---------- */
function toggleQuick(on) {
  C.quickOpen = !!on;
  C.el.quick.hidden = !on;
  C.el.qFab.setAttribute("aria-expanded", on ? "true" : "false");
  if (on) togglePanel(false);
}
function togglePanel(on) {
  C.open = !!on;
  C.el.panel.hidden = !on;
  C.el.fab.setAttribute("aria-expanded", on ? "true" : "false");
  if (on) {
    toggleQuick(false);
    clearBubbles();
    C.unread = 0; paintBadge();
    scrollDown(true);
    // en el celular no se enfoca solo: abriría el teclado y taparía la pantalla
    try { if (window.matchMedia && matchMedia("(pointer:fine)").matches) C.el.input.focus(); } catch (e) {}
  }
}
function paintBadge() {
  var b = C.el.badge; if (!b) return;
  b.textContent = C.unread > 9 ? "9+" : String(C.unread);
  b.classList.toggle("on", C.unread > 0);
  C.el.fab.setAttribute("aria-label", C.unread > 0 ? "Chat, " + C.unread + " mensajes nuevos" : "Chat");
}

/* ---------- Envío ---------- */
function send(payload, done) {
  var s = window.ONL && ONL.socket;
  if (!s || !s.connected) { toast("Sin conexión con el servidor. Probá de nuevo en un momento."); if (done) done(false); return; }
  s.emit("chat_send", payload, function (res) {
    if (res && !res.ok && res.error) toast(res.error);
    if (done) done(!!(res && res.ok));
  });
}

/* ---------- Recepción ---------- */
function validMsg(m) {
  return m && typeof m === "object" && typeof m.id === "string" && typeof m.text === "string" && typeof m.name === "string" &&
    (m.kind === "text" || m.kind === "quick" || m.kind === "react");
}

function onMsg(m, silent) {
  if (!validMsg(m) || C.seen[m.id]) return;
  C.seen[m.id] = 1;
  if (m.kind === "react") { if (!silent && !C.muted) fly(m); return; }
  var mine = Number(m.playerId) === myId();
  C.msgs.push(m);
  if (C.msgs.length > MAX_LOG) C.msgs.shift();
  addRow(m, mine);
  if (silent || mine) return;
  if (C.open) return;
  C.unread++; paintBadge();
  if (!C.muted) {
    bubble(m);
    try { if (window.chiquiSfx) chiquiSfx.play("chat", 250); } catch (e) {}
  }
}

function addRow(m, mine) {
  var E = C.el;
  if (E.empty && E.empty.parentNode) E.empty.parentNode.removeChild(E.empty);
  var near = E.log.scrollHeight - E.log.scrollTop - E.log.clientHeight < 60;
  var row = mk("div", "chat-msg" + (mine ? " mine" : "") + (m.kind === "quick" ? " quick" : ""));
  row.style.setProperty("--cc", okColor(m.color));
  var meta = mk("div", "chat-meta");
  meta.appendChild(mk("b", null, mine ? "Vos" : m.name));
  meta.appendChild(mk("time", null, hhmm(m.ts)));
  row.appendChild(meta);
  row.appendChild(mk("div", "chat-text", m.text));
  E.log.appendChild(row);
  while (E.log.children.length > MAX_LOG) E.log.removeChild(E.log.firstChild);
  if (mine || near) scrollDown(false);
}
function scrollDown(instant) {
  var l = C.el.log; if (!l) return;
  if (instant) { var p = l.style.scrollBehavior; l.style.scrollBehavior = "auto"; l.scrollTop = l.scrollHeight; l.style.scrollBehavior = p; }
  else l.scrollTop = l.scrollHeight;
}

/* ---------- Avisos flotantes y reacciones ---------- */
function bubble(m) {
  var E = C.el;
  var b = mk("div", "chat-bubble");
  b.style.setProperty("--cc", okColor(m.color));
  b.appendChild(mk("b", null, m.name));
  b.appendChild(document.createTextNode(m.text.length > 90 ? m.text.slice(0, 90) + "…" : m.text));
  E.bubbles.appendChild(b);
  while (E.bubbles.children.length > MAX_BUBBLES) E.bubbles.removeChild(E.bubbles.firstChild);
  setTimeout(function () {
    b.classList.add("out");
    setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 400);
  }, BUBBLE_MS);
}
function clearBubbles() { if (C.el.bubbles) C.el.bubbles.textContent = ""; }

function fly(m) {
  var E = C.el;
  if (!E.float) return;
  var f = mk("div", "chat-fly");
  f.style.left = (14 + Math.random() * Math.min(160, window.innerWidth * 0.35)) + "px";
  f.appendChild(mk("span", "em", m.text));
  f.appendChild(mk("span", "nm", Number(m.playerId) === myId() ? "Vos" : m.name));
  E.float.appendChild(f);
  while (E.float.children.length > 12) E.float.removeChild(E.float.firstChild);
  setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 3000);
}

/* ---------- Conexión con la sala ---------- */
function reset() {
  C.msgs = []; C.seen = {}; C.unread = 0; C.code = null;
  if (!C.built) return;
  var E = C.el;
  E.log.textContent = ""; E.log.appendChild(E.empty);
  E.float.textContent = ""; clearBubbles();
  if (C.quickOpen) toggleQuick(false);
  if (C.open) togglePanel(false);
  paintBadge();
}

function fetchHistory() {
  var s = window.ONL && ONL.socket;
  if (!s || !s.connected) return;
  s.emit("chat_history", function (res) {
    if (!res || !res.ok || !Array.isArray(res.messages)) return;
    res.messages.forEach(function (m) { onMsg(m, true); });
  });
}

function bind(sock) {
  if (C.bound === sock) return;
  C.bound = sock;
  sock.on("chat_msg", function (m) { onMsg(m, false); });
  // tras una reconexión se piden los mensajes que pasaron mientras no estaba (los repetidos se descartan por id)
  sock.on("connect", function () { if (C.code) setTimeout(fetchHistory, 600); });
}

/* Se llama desde multijugador.js (onlRenderChip) y cada segundo como respaldo */
function sync() {
  var on = !!(window.ONL && ONL.active && ONL.code && ONL.socket);
  if (!on) {
    if (C.code || (C.built && C.el.root.classList.contains("on"))) { reset(); if (C.built) C.el.root.classList.remove("on"); }
    document.body.classList.remove("onl-chip-on");
    return;
  }
  if (!C.built && !build()) return;
  if (C.code !== ONL.code) { reset(); C.code = ONL.code; fetchHistory(); }
  bind(ONL.socket);
  C.el.root.classList.add("on");
  placeAboveChip();
}

/* El chip de la sala (abajo a la izquierda) cambia de alto: en el celular el texto se parte en varias líneas.
   El chat se apoya justo encima de lo que mida en ese momento. */
function placeAboveChip() {
  var chip = $("onlChip"), r = C.el.root;
  var vis = !!(chip && chip.style.display !== "none" && chip.offsetHeight > 0);
  document.body.classList.toggle("onl-chip-on", vis);
  r.style.bottom = vis ? "calc(" + Math.ceil(12 + chip.offsetHeight + 8) + "px + env(safe-area-inset-bottom,0px))" : "";
}

setInterval(sync, 1000);
window.CHAT_ONL = { sync: sync, open: function () { if (C.built) togglePanel(true); } };
})();
