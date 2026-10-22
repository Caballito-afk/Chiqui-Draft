/* =========================================================
   MERCADO ONLINE — cada jugador tiene SU propia pantalla del mercado
   - El anfitrión sigue corriendo el mercado, pero ya no copia su pantalla a los invitados:
     arma una vista aparte por cada jugador (en un contenedor fuera de la página) y se la manda solo a él.
   - Cada vista tiene su propio estado (pestaña, filtros, oferta que está armando) y siempre opera
     para el equipo de ese jugador: no hay selector de equipo ni forma de actuar por otro club.
   - Ofertas, novedades, movimientos y avisos se filtran por equipo: nadie ve las operaciones de los demás.
   - Los clics del invitado se aplican sobre SU vista (no sobre la del anfitrión) y solo sobre su equipo.
========================================================= */
var MK_VIEW_KEYS = ["target", "tab", "view", "filter", "posFilter", "giveSel", "offAmount",
  "freeTarget", "freePos", "freeGive", "whoOpen", "formSig", "freeSig"];

var MK_ONL = {
  ctx: null,        // id del equipo para el que se está armando/ejecutando algo (null = el anfitrión o modo local)
  roots: {},        // vista de cada invitado (contenedor fuera de la página)
  out: {},          // avisos pendientes de enviar, por equipo
  last: {},         // última pantalla enviada a cada invitado
  dataSig: null,
  reset() { this.ctx = null; this.roots = {}; this.out = {}; this.last = {}; this.dataSig = null; },
  queueToast(tid, t) {
    const q = (this.out[tid] = this.out[tid] || []);
    q.push(t);
    if (q.length > 8) q.shift();
  }
};

function mkDefaultView() {
  return { target: null, tab: "teams", view: "main", filter: "all", posFilter: "all", giveSel: null, offAmount: 0,
    freeTarget: null, freePos: "all", freeGive: null, whoOpen: false, formSig: null, freeSig: null };
}

/* Contenedor propio de cada invitado: una copia limpia de la pantalla del mercado */
function mkGuestRoot(pid) {
  let root = MK_ONL.roots[pid];
  if (root) return root;
  const src = document.getElementById("screen-market");
  root = src.cloneNode(true);
  root.className = "screen active";
  root.removeAttribute("style");
  ["marketOfferView", "marketList", "marketTeams", "offersPanel", "mkNotesCard", "marketLog",
   "freeList", "freeTeams", "freeOfferCard", "freeLog", "mkToasts", "mkAlert", "mkWho"].forEach(id => {
    const e = root.querySelector("#" + id);
    if (e) e.innerHTML = ""; // nada de lo que tenga el anfitrión en pantalla viaja
  });
  const sel = root.querySelector("#marketTeamFilter");
  if (sel) {
    sel.innerHTML = `<option value="all">Todos los equipos</option>` + state.teams.map(t => `<option value="${t.id}">${mkEsc(t.name)}</option>`).join("");
    sel.value = "all";
  }
  root._fresh = true;
  MK_ONL.roots[pid] = root;
  return root;
}

/* Valores de los selectores de esa vista (los listeners de la copia no existen: se resuelven en onlMarketGuestAct) */
function mkSyncStatic(root, m) {
  const set = (id, v) => { const e = root.querySelector("#" + id); if (e && e.value !== String(v)) e.value = String(v); };
  set("marketTeamFilter", m.filter);
  set("marketPosFilter", m.posFilter);
  set("freePosFilter", m.freePos);
  const ft = root.querySelector("#mkFreeTab");
  if (ft) ft.style.display = state.useFreeMarket ? "" : "none";
}

/* Ejecuta fn "como" ese jugador: su estado de vista y su equipo, escribiendo en su contenedor y no en la página */
function mkRunAs(pid, fn) {
  const m = state.market;
  if (!m) return null;
  if (pid === ONL.myId) return fn(null);
  if (MK_ONL.ctx !== null) return fn(MK_ONL.roots[MK_ONL.ctx]);
  const v = m.views[pid] || (m.views[pid] = mkDefaultView());
  const root = mkGuestRoot(pid);
  const saved = {};
  MK_VIEW_KEYS.forEach(k => { saved[k] = m[k]; m[k] = v[k]; });
  const savedBidder = m.bidder;
  m.bidder = pid;
  MK_ONL.ctx = pid;
  const D = document, W = window, savedScroll = W.scrollTo;
  D.getElementById = id => root.querySelector("#" + id);
  D.querySelector = s => root.querySelector(s);
  D.querySelectorAll = s => root.querySelectorAll(s);
  W.scrollTo = () => {};
  try {
    mkSyncStatic(root, m);
    return fn(root);
  } finally {
    delete D.getElementById; delete D.querySelector; delete D.querySelectorAll;
    W.scrollTo = savedScroll;
    MK_VIEW_KEYS.forEach(k => { v[k] = m[k]; m[k] = saved[k]; });
    m.bidder = savedBidder;
    MK_ONL.ctx = null;
  }
}

/* Foto de una vista: lo que se manda es solo el HTML de ESA pantalla */
function mkSnapshot(root) {
  root.querySelectorAll("select").forEach(s => {
    Array.from(s.options).forEach(o => { if (o.selected) o.setAttribute("selected", ""); else o.removeAttribute("selected"); });
  });
  root.querySelectorAll("input").forEach(i => {
    if (i.type !== "checkbox" && i.type !== "radio") i.setAttribute("value", i.value);
  });
  const cl = root.cloneNode(true);
  cl.querySelectorAll("script").forEach(n => n.remove());
  // "Mi plantilla": el invitado recibe el plantel de SU equipo (y solo ese) para abrirlo cuando quiera
  const pid = MK_ONL.ctx;
  cl.querySelectorAll(".squad-btn").forEach(b => { if (pid) b.textContent = "Mi plantilla"; });
  const sq = pid ? onlSquadCompute(pid) : null;
  const squadHtml = sq ? `<div id="onlSquadData" hidden data-d="${onlEsc(JSON.stringify(sq))}"></div>` : "";
  return `<div class="screen active" id="screen-market">${cl.innerHTML}</div>${squadHtml}`;
}

function mkRenderFor(pid, light) {
  return mkRunAs(pid, root => {
    const m = state.market;
    if (light && !root._fresh) refreshMarketAll();
    else if (m.tab === "free") renderFreeMarket();
    else renderMarket();
    root._fresh = false;
    return mkSnapshot(root);
  });
}

function mkActive() {
  const scr = document.getElementById("screen-market");
  return !!(window.ONL && ONL.active && ONL.role === "host" && ONL.started && state.market && scr && scr.classList.contains("active"));
}

/* Firma barata de lo que ven los jugadores (equipos, ofertas, novedades y movimientos): solo se vuelve a armar si cambió */
function mkDataSig() {
  const m = state.market;
  return state.teams.map(t => t.id + ":" + t.budget + ":" + t.roster.join(",")).join("|") +
    "#" + m.offers.map(o => o.id).join(",") + "#" + m.notes.length + "/" + m.noteSeq +
    "#" + m.log.length + "#" + m.freeLog.length + "#" + (state.useFreeMarket ? 1 : 0) +
    "#v" + Object.keys(m.votes || {}).join(",") + "/" + ((ONL.players || []).filter(p => p.connected !== false).length);
}

function mkSend(pid, html, toasts) {
  if (!ONL.socket || !ONL.socket.connected) return;
  ONL.socket.emit("host_sync_player", { playerId: pid, html: html, toasts: toasts && toasts.length ? toasts : undefined });
}

/* Anfitrión: cada invitado recibe solo su pantalla del mercado (y sus avisos) */
function onlMarketPush() {
  if (!mkActive()) { MK_ONL.out = {}; return; }
  if (mkOnlineTick()) return; // se acabó el tiempo o la mayoría votó saltar: arranca el torneo
  const changed = mkDataSig();
  const dataChanged = changed !== MK_ONL.dataSig;
  MK_ONL.dataSig = changed;
  (ONL.players || []).forEach(p => {
    if (p.host || p.id === ONL.myId) return;
    const pid = p.id;
    let html = null;
    if (p.connected !== false && (dataChanged || !(pid in MK_ONL.last))) {
      html = mkRenderFor(pid, pid in MK_ONL.last);
      if (html === MK_ONL.last[pid]) html = null; else MK_ONL.last[pid] = html;
    }
    const toasts = p.connected !== false ? MK_ONL.out[pid] : null;
    if (toasts) delete MK_ONL.out[pid];
    if (html !== null || (toasts && toasts.length)) mkSend(pid, html, toasts);
  });
}

/* Anfitrión: un clic / dato de un invitado se aplica sobre SU vista y solo para su equipo */
function onlMarketGuestAct(pid, act) {
  if (!state.market) return;
  let html = null;
  mkRunAs(pid, root => {
    const path = act.path;
    if (!Array.isArray(path) || path.length < 1 || path.length > 40 || path[0] !== 0) return;
    let el = root;
    for (let k = 1; k < path.length && el; k++) el = el.children[path[k]];
    if (!el || el === root) return;
    const m = state.market;
    if (act.kind === "click") {
      const tab = el.closest(".mk-tab");
      if (el.closest("#endMarketBtn")) mkVoteToggle(pid);   // saltar el mercado se vota: cada uno solo vota por su equipo
      else if (el.closest("#marketMenuBtn,.squad-btn")) { /* del anfitrión / locales: no hace nada */ }
      else if (tab) setMarketTab(tab.dataset.tab);
      else if (typeof el.click === "function") el.click();
    } else if (act.kind === "set") {
      const v = String(act.value == null ? "" : act.value).slice(0, 200);
      if (el.id === "marketTeamFilter") { el.value = v; m.filter = el.value; renderMarket(); }
      else if (el.id === "marketPosFilter") { el.value = v; m.posFilter = el.value; renderMarket(); }
      else if (el.id === "freePosFilter") { el.value = v; m.freePos = el.value; renderFreeMarket(); }
      else if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) {
        el.value = v;
        el.dispatchEvent(new Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
      }
    } else if (act.kind === "key" && act.key === "Enter") {
      el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true, cancelable: true }));
    }
    html = mkSnapshot(root);
  });
  refreshMarketAll(); // la pantalla del anfitrión también se actualiza (compró / vendió alguien)
  if (html !== null) {
    MK_ONL.last[pid] = html;
    const q = MK_ONL.out[pid];
    if (q) delete MK_ONL.out[pid];
    mkSend(pid, html, q);
  }
  MK_ONL.dataSig = null; // los demás jugadores se actualizan en el próximo ciclo
}

/* Reloj del mercado: se actualiza en pantalla entre cuadros (cada cuadro trae el tiempo que queda en data-left) */
function mkClockTick() {
  document.querySelectorAll(".mk-clock[data-left]").forEach(el => {
    const L = el.getAttribute("data-left");
    if (el._L !== L) { el._L = L; el._t0 = Date.now(); }
    const rem = Math.max(0, Number(L) - (Date.now() - el._t0));
    const t = mkFmtClock(rem);
    if (el.textContent !== t) el.textContent = t;
    el.classList.toggle("warn", rem <= 30000);
  });
}
setInterval(mkClockTick, 250);
