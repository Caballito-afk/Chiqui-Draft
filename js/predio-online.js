/* =========================================================
   PREDIO ONLINE
   Al crear una sala se elige Normal o Predio. En Predio, cuando el anfitrión toca «Empezar partida» en la sala de espera,
   todos pasan a una pantalla donde cada club crea sus jugadores (tantos como el plantel: 11 o 5, con al menos un arquero).
   Cuando todos terminan, el anfitrión empieza la puja / el reloj / el reparto aleatorio y se juega SOLO con esos jugadores.

   Cómo viaja (sin cambios en server.js):
   - Invitado -> anfitrión: acción "player_action" con kind "predio" y su lista (nombre, posición, media).
   - Anfitrión -> invitados: "host_sync" con pp (quién terminó) durante la creación, y con pl (lista final) en cada pantalla
     de la partida: los invitados la necesitan para armar sus plantillas, que se calculan en cada navegador con los ids.
   Los jugadores de Predio reemplazan a los «jugadores propios» guardados mientras dura la sala (customUseOnline) y
   se restauran al salir (customRestoreLocal). Los guardados de cada uno no se tocan.
========================================================= */
(function () {
  const PD = {
    phase: false,     // true mientras se crean los jugadores
    size: 11,         // jugadores por club
    mine: [],         // [{n,p,o,c}] los que creé yo (c = país, vacío = «Creado por vos»)
    ready: false,
    editIdx: -1,
    subs: {},         // solo anfitrión: { idJugador: {l:[[n,p,o,c]], r:0|1} }
    st: {},           // solo invitado: { idJugador: [cantidad, listo] }
    list: null,       // lista final [[n,p,o,c]] (ids = CUSTOM_BASE + lugar)
    applied: "",
    used: false
  };
  const $ = id => document.getElementById(id);
  const isHost = () => ONL.role === "host";

  function isPredio() {
    if (!ONL.active) return false;
    if (isHost()) return state.customMode === "only";
    const s = ONL.lobby && ONL.lobby.settings;
    return !!(s && s.customMode === "only");
  }
  function sizeNow() {
    if (isHost()) return squadSize();
    const s = ONL.lobby && ONL.lobby.settings;
    return (s && Number(s.squadSize)) || PD.size || 11;
  }
  const gkCount = () => PD.mine.filter(x => x.p === "POR").length;
  const valid = () => PD.mine.length === PD.size && gkCount() > 0;
  const plural = (n, a, b) => n + " " + (n === 1 ? a : b);

  /* ---------- Lista de jugadores creados (todos los clubes) ---------- */
  function applyList(pl) {
    if (!Array.isArray(pl)) return;
    const sig = JSON.stringify(pl);
    if (sig === PD.applied) return;
    PD.applied = sig; PD.list = pl; PD.used = true;
    customUseOnline(pl);
  }
  function reset() {
    PD.phase = false; PD.list = null; PD.applied = ""; PD.subs = {}; PD.st = {}; PD.mine = []; PD.ready = false; PD.editIdx = -1;
    if (PD.used) { PD.used = false; customRestoreLocal(); }
  }

  /* ---------- Fase de creación ---------- */
  function begin() {
    PD.phase = true; PD.size = sizeNow(); PD.mine = []; PD.ready = false; PD.editIdx = -1;
    PD.subs = {}; PD.st = {}; PD.list = null; PD.applied = "";
    const sel = $("pdPos");
    if (!sel.options.length) sel.innerHTML = CUSTOM_POS.map(x => `<option value="${x[0]}">${x[1]} (${x[0]})</option>`).join("");
    customFillCountryList();
    resetForm();
    if (isHost()) PD.subs[ONL.myId] = { l: [], r: 0 };
    render();
    onlShow("onl-predio");
    if (isHost()) push();
  }

  function setError(msg) {
    const e = $("pdError"); e.textContent = msg || ""; e.style.display = msg ? "" : "none";
  }
  function resetForm() {
    PD.editIdx = -1;
    $("pdName").value = ""; $("pdOvr").value = ""; $("pdCountry").value = "";
    $("pdAdd").textContent = "Agregar jugador";
    $("pdCancelEdit").style.display = "none";
    setError("");
  }

  function triple() { return PD.mine.map(x => [x.n, x.p, x.o, x.c || ""]); }
  /* Manda mi lista (y si estoy listo) al anfitrión; el anfitrión la guarda directo */
  function send() {
    if (isHost()) { PD.subs[ONL.myId] = { l: triple(), r: PD.ready ? 1 : 0 }; push(); }
    else onlSendAction({ kind: "predio", l: triple(), r: PD.ready ? 1 : 0 });
    render();
  }

  function submit() {
    if (PD.ready) return;
    const name = customClean($("pdName").value);
    const raw = $("pdOvr").value.trim();
    const ovr = Math.round(Number(raw));
    const pos = $("pdPos").value;
    if (!name) return setError("Escribí el nombre del jugador.");
    if (raw === "" || !Number.isFinite(ovr) || ovr < 1 || ovr > 99) return setError("La media tiene que ser un número de 1 a 99.");
    if (!CUSTOM_POS.some(x => x[0] === pos)) return setError("Elegí una posición.");
    const low = name.toLowerCase();
    if (PLAYERS.some(p => !p.custom && p.name.toLowerCase() === low) || PD.mine.some((x, i) => i !== PD.editIdx && x.n.toLowerCase() === low))
      return setError("Ya existe un jugador con ese nombre.");
    if (PD.editIdx < 0 && PD.mine.length >= PD.size) return setError("Ya tenés los " + PD.size + " jugadores.");
    const c = customCountry($("pdCountry").value);
    if (PD.editIdx >= 0) PD.mine[PD.editIdx] = { n: name, p: pos, o: ovr, c };
    else PD.mine.push({ n: name, p: pos, o: ovr, c });
    const keep = pos;
    resetForm();
    $("pdPos").value = keep; // para cargar varios de la misma posición seguidos
    send();
    $("pdName").focus();
  }

  function startEdit(i) {
    const d = PD.mine[i]; if (!d || PD.ready) return;
    PD.editIdx = i;
    $("pdName").value = d.n; $("pdOvr").value = d.o; $("pdPos").value = d.p; $("pdCountry").value = d.c || "";
    $("pdAdd").textContent = "Guardar cambios";
    $("pdCancelEdit").style.display = "";
    setError("");
    render();
    $("pdName").focus();
  }
  function del(i) {
    if (PD.ready || !PD.mine[i]) return;
    PD.mine.splice(i, 1);
    if (PD.editIdx === i) resetForm(); else if (PD.editIdx > i) PD.editIdx--;
    send();
  }
  function toggleReady() {
    if (!PD.ready && !valid()) return;
    PD.ready = !PD.ready;
    if (PD.ready) resetForm();
    send();
  }

  /* ---------- Anfitrión: recibe las listas y las difunde ---------- */
  function cleanList(raw) {
    const out = [], seen = new Set();
    if (!Array.isArray(raw)) return out;
    for (const e of raw) {
      if (out.length >= PD.size) break;
      if (!Array.isArray(e)) continue;
      const n = customClean(e[0]), p = e[1], o = Math.round(Number(e[2]));
      if (!n || !CUSTOM_POS.some(x => x[0] === p) || !(o >= 1 && o <= 99)) continue;
      const k = n.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k); out.push([n, p, o, customCountry(e[3])]);
    }
    return out;
  }
  function hostRecv(act) {
    if (!PD.phase || !isHost() || !ONL.lobby) return;
    const id = Number(act.playerId);
    if (!ONL.lobby.players.some(p => p.id === id)) return;
    const l = cleanList(act.l);
    const ok = l.length === PD.size && l.some(x => x[1] === "POR");
    PD.subs[id] = { l, r: (act.r && ok) ? 1 : 0 };
    push(); render();
  }
  function push() {
    if (!isHost() || !PD.phase || !ONL.socket || !ONL.socket.connected) return;
    const st = {};
    Object.keys(PD.subs).forEach(k => { st[k] = [PD.subs[k].l.length, PD.subs[k].r]; });
    ONL.socket.emit("host_sync", { pp: { size: PD.size, st } });
  }

  /* El anfitrión arma la lista final (ids estables) y arranca la puja / reloj / aleatorio con los clubes conectados */
  function launch() {
    if (!isHost() || !PD.phase || !ONL.lobby) return;
    const alive = ONL.lobby.players.filter(p => p.connected);
    if (!onlStartValid(alive.length)) { onlToast("Faltan clubes conectados para empezar."); return; }
    if (!alive.every(p => PD.subs[p.id] && PD.subs[p.id].r)) { onlToast("Todavía hay clubes que no terminaron."); return; }
    const list = [], seen = new Set();
    alive.forEach(p => PD.subs[p.id].l.forEach(x => {
      let n = x[0], c = 2;
      while (seen.has(n.toLowerCase())) n = x[0].slice(0, 24) + " " + (c++); // nombres repetidos entre clubes: se numeran
      seen.add(n.toLowerCase());
      list.push([n, x[1], x[2], x[3] || ""]);
    }));
    applyList(list);
    PD.phase = false;
    onlLaunchDraft(alive);
  }

  /* ---------- Invitado: recibe la fase de creación y la lista final ---------- */
  function guestSync(data) {
    if (data.pl) applyList(data.pl);
    if (data.pp && !ONL.mirrorOn) {
      if (!PD.phase) begin(); // por ejemplo, al reconectar en plena creación
      PD.st = data.pp.st || {}; PD.size = data.pp.size || PD.size;
      render();
    }
    if (typeof data.html === "string" && PD.phase && !ONL.mirrorOn) { // el anfitrión empezó: se pasa a ver la partida
      PD.phase = false;
      ONL.started = true;
      onlApplyCrests();
      onlEnterMirror();
    }
  }

  /* ---------- Pantalla ---------- */
  function statusOf(id) {
    if (id === ONL.myId) return [PD.mine.length, PD.ready ? 1 : 0];
    if (isHost()) { const s = PD.subs[id]; return s ? [s.l.length, s.r] : [0, 0]; }
    return PD.st[id] || [0, 0];
  }
  function render() {
    if (!PD.phase || !$("pdList")) return;
    const n = PD.mine.length, gk = gkCount();
    $("pdIntro").textContent = "Creá " + PD.size + " jugadores para tu club, con al menos un arquero. Después se reparten entre todos los clubes con el modo que elegiste: " + (ONL_GAMES[ONL.game || (ONL.lobby && ONL.lobby.game)] || "puja") + ".";
    $("pdCount").textContent = n + " de " + PD.size + " jugadores · " + plural(gk, "arquero", "arqueros");

    const order = { POR: 0, DEF: 1, MED: 2, DEL: 3 };
    const rows = PD.mine.map((d, i) => ({ d, i })).sort((a, b) => order[a.d.p] - order[b.d.p] || b.d.o - a.d.o || a.d.n.localeCompare(b.d.n));
    $("pdList").innerHTML = rows.map(x => `
      <div class="cp-row${x.i === PD.editIdx ? " editing" : ""}">
        <span class="cp-pos">${x.d.p}</span>
        <span class="cp-name">${onlEsc(x.d.n)}${x.d.c ? ` <small>· ${onlEsc(x.d.c)}</small>` : ""}</span>
        <span class="cp-ovr tier-${customTier(x.d.o)}">${x.d.o}</span>
        ${PD.ready ? "" : `<button class="btn sm" type="button" data-pd-edit="${x.i}">Editar</button><button class="btn sm cp-del" type="button" data-pd-del="${x.i}">Borrar</button>`}
      </div>`).join("");

    ["pdName", "pdOvr", "pdPos", "pdCountry"].forEach(id => { $(id).disabled = PD.ready; });
    $("pdAdd").disabled = PD.ready || (PD.editIdx < 0 && n >= PD.size);

    const ready = $("pdReady");
    ready.textContent = PD.ready ? "Seguir editando" : "Listo";
    ready.disabled = !PD.ready && !valid();
    ready.classList.toggle("primary", !PD.ready && valid());

    const L = ONL.lobby || { players: [] };
    $("pdStatus").innerHTML = L.players.map(p => {
      const s = statusOf(p.id);
      const tag = !p.connected ? "Desconectado" : (s[1] ? "Listo ✓" : s[0] + "/" + PD.size);
      return `<div class="onl-player${p.connected ? "" : " off"}"><span class="nm">${onlEsc(p.name)}</span>${p.id === ONL.myId ? '<span class="bd">Vos</span>' : ""}<span class="bd${s[1] && p.connected ? " pd-ok" : ""}">${tag}</span></div>`;
    }).join("");

    let hint = "";
    if (!PD.ready) {
      if (n < PD.size) hint = "Te " + (PD.size - n === 1 ? "falta 1 jugador" : "faltan " + (PD.size - n) + " jugadores") + ".";
      else if (gk === 0) hint = "Tenés que crear al menos un arquero (POR).";
    }
    const alive = L.players.filter(p => p.connected);
    const pending = alive.filter(p => !statusOf(p.id)[1]).length;
    const host = isHost();
    if (!hint) {
      if (!pending) hint = host ? "Todos listos: cuando quieras, empezá la partida." : "Todos listos. Esperando a que el anfitrión empiece…";
      else if (PD.ready) hint = "Esperando a " + plural(pending, "club", "clubes") + "…";
    }
    onlMsg("pdMsg", hint, false);

    const go = $("pdLaunch");
    go.style.display = host ? "" : "none";
    go.disabled = !host || pending > 0 || !onlStartValid(alive.length);
    $("pdLeave").textContent = host ? "Cerrar sala" : "Salir de la sala";
  }

  /* ---------- Cableado ---------- */
  $("pdAdd").addEventListener("click", submit);
  $("pdCancelEdit").addEventListener("click", () => { resetForm(); render(); });
  $("pdReady").addEventListener("click", toggleReady);
  $("pdLaunch").addEventListener("click", launch);
  $("pdLeave").addEventListener("click", () => onlLeaveRoom());
  $("pdList").addEventListener("click", e => {
    const ed = e.target.closest("[data-pd-edit]"), dl = e.target.closest("[data-pd-del]");
    if (ed) startEdit(+ed.dataset.pdEdit); else if (dl) del(+dl.dataset.pdDel);
  });
  ["pdName", "pdOvr", "pdCountry"].forEach(id => $(id).addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); submit(); }
  }));

  // si alguien entra o sale, o cambia su club, se refresca el estado de la pantalla
  const baseRenderLobby = onlRenderLobby;
  onlRenderLobby = function () {
    const r = baseRenderLobby.apply(this, arguments);
    if (PD.phase) render();
    return r;
  };

  window.PD_ONL = {
    isPredio, begin, reset, render, push, hostRecv, guestSync,
    phase: () => PD.phase,
    list: () => PD.list
  };
})();
