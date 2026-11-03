/* =========================================================
   PREDIO (online y local)
   Al crear una sala se elige Normal o Predio. En Predio, cuando el anfitrión toca «Empezar partida» en la sala de espera,
   todos pasan a una pantalla donde cada club crea sus jugadores (tantos como el plantel: 11 o 5, con al menos un arquero).
   Cuando todos terminan, el anfitrión empieza la puja / el reloj / el reparto aleatorio y se juega SOLO con esos jugadores.

   Cómo viaja (sin cambios en server.js):
   - Invitado -> anfitrión: acción "player_action" con kind "predio" y su lista (nombre, posición, media).
   - Anfitrión -> invitados: "host_sync" con pp (quién terminó) durante la creación, y con pl (lista final) en cada pantalla
     de la partida: los invitados la necesitan para armar sus plantillas, que se calculan en cada navegador con los ids.
   Los jugadores de Predio reemplazan a los «jugadores propios» guardados mientras dura la sala (customUseOnline) y
   se restauran al salir (customRestoreLocal). Los guardados de cada uno no se tocan.

   LOCAL: con «Crear ahora» (Ajustes > Jugadores del predio), al darle a Comenzar se usa esta misma pantalla, equipo por equipo
   (cada uno crea sus jugadores, con al menos un arquero) y al terminar el último arranca la puja / reloj / aleatorio.
   La lista de la partida queda en state.predioPool para que se guarde con el torneo (guardado.js).
========================================================= */
(function () {
  const PD = {
    phase: false,     // true mientras se crean los jugadores
    size: 11,         // jugadores por club
    mine: [],         // [{n,p,o,c}] los que creé yo (c = país, vacío = «Custom»)
    ready: false,
    editIdx: -1,
    subs: {},         // solo anfitrión: { idJugador: {l:[[n,p,o,c]], r:0|1} }
    st: {},           // solo invitado: { idJugador: [cantidad, listo] }
    list: null,       // lista final [[n,p,o,c]] (ids = CUSTOM_BASE + lugar)
    applied: "",
    used: false,
    saved: false,     // online con «Usar ya creados»: cada club aporta los que tiene guardados (en vez de crear)
    local: null       // Predio local: { names, colors, extras, idx, lists:[[{n,p,o,c}]|null] }
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
  function isSaved() {
    if (isHost()) return state.customSource === "saved";
    const s = ONL.lobby && ONL.lobby.settings;
    return !!(s && s.customSource === "saved");
  }
  const savedMine = () => customDefs.filter(d => !d.d).map(d => ({ n: d.n, p: d.p, o: d.o, c: d.c || "" }));
  const gkCount = () => PD.mine.filter(x => x.p === "POR").length;
  const valid = () => PD.saved ? PD.mine.length >= 1 : (PD.mine.length === PD.size && gkCount() > 0);
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
    PD.phase = false; PD.list = null; PD.applied = ""; PD.subs = {}; PD.st = {}; PD.mine = []; PD.ready = false; PD.editIdx = -1; PD.saved = false;
    if (PD.used) { PD.used = false; customRestoreLocal(); }
  }

  /* ---------- Fase de creación ---------- */
  function begin() {
    PD.local = null; PD.saved = isSaved();
    PD.phase = true; PD.size = sizeNow(); PD.mine = PD.saved ? savedMine() : []; PD.ready = false; PD.editIdx = -1;
    PD.subs = {}; PD.st = {}; PD.list = null; PD.applied = "";
    const sel = $("pdPos");
    if (!sel.options.length) sel.innerHTML = CUSTOM_POS.map(x => `<option value="${x[0]}">${x[1]} (${x[0]})</option>`).join("");
    customFillCountryList();
    resetForm();
    if (isHost()) PD.subs[ONL.myId] = { l: PD.saved ? triple() : [], r: 0 };
    render();
    onlShow("onl-predio");
    if (isHost()) push();
    else if (PD.saved) send(); // el invitado aporta de entrada los que tiene guardados
  }
  /* «Ya creados»: al cerrar el editor se actualiza la lista y hay que volver a darle a Listo */
  function afterEditor() {
    if (!PD.phase || PD.local || !PD.saved) return;
    PD.mine = savedMine(); PD.ready = false;
    send();
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
    if (PD.local) { render(); return; } // local: no hay a quién mandarle nada
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
    if (PD.local) { localNext(); return; } // local: el botón es «Siguiente equipo» / «Empezar partida»
    if (!PD.ready && !valid()) return;
    PD.ready = !PD.ready;
    if (PD.ready) resetForm();
    send();
  }

  /* ---------- Anfitrión: recibe las listas y las difunde ---------- */
  function cleanList(raw, max) {
    const out = [], seen = new Set();
    if (!Array.isArray(raw)) return out;
    for (const e of raw) {
      if (out.length >= max) break;
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
    const l = cleanList(act.l, PD.saved ? CUSTOM_MAX : PD.size);
    const ok = PD.saved ? l.length >= 1 : (l.length === PD.size && l.some(x => x[1] === "POR"));
    PD.subs[id] = { l, r: (act.r && ok) ? 1 : 0 };
    push(); render();
  }
  function push() {
    if (!isHost() || !PD.phase || !ONL.socket || !ONL.socket.connected) return;
    const st = {};
    Object.keys(PD.subs).forEach(k => { st[k] = [PD.subs[k].l.length, PD.subs[k].r]; });
    ONL.socket.emit("host_sync", { pp: { size: PD.size, st } });
  }

  const n0 = () => PD.mine.length;
  /* «Ya creados»: entre todos tienen que alcanzar para los equipos (1 arquero por equipo y equipos × plantel jugadores) */
  function poolProblem(alive) {
    let total = 0, gks = 0;
    alive.forEach(p => { const s = PD.subs[p.id]; if (!s) return; total += s.l.length; gks += s.l.filter(x => x[1] === "POR").length; });
    const n = alive.length, need = n * PD.size;
    if (gks < n) return "Entre todos hay " + plural(gks, "arquero", "arqueros") + " y hacen falta " + n + " (uno por equipo).";
    if (total < need) return "Entre todos hay " + total + " jugadores y hacen falta " + need + " (" + n + " equipos × " + PD.size + ").";
    return "";
  }

  /* El anfitrión arma la lista final (ids estables) y arranca la puja / reloj / aleatorio con los clubes conectados */
  function launch() {
    if (!isHost() || !PD.phase || !ONL.lobby) return;
    const alive = ONL.lobby.players.filter(p => p.connected);
    if (!onlStartValid(alive.length)) { onlToast("Faltan clubes conectados para empezar."); return; }
    if (!alive.every(p => PD.subs[p.id] && PD.subs[p.id].r)) { onlToast("Todavía hay clubes que no terminaron."); return; }
    const lack = PD.saved ? poolProblem(alive) : "";
    if (lack) { onlToast(lack, 5000); return; }
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
    $("pdPrev").style.display = (PD.local && PD.local.idx > 0) ? "" : "none";
    $("pdCreateCard").style.display = PD.saved ? "none" : "";
    $("pdSavedBox").style.display = PD.saved ? "" : "none";
    if (PD.local) renderLocal(n, gk); else renderOnline(n, gk);
  }

  function missingHint(n, gk) {
    if (n < PD.size) return "Te " + (PD.size - n === 1 ? "falta 1 jugador" : "faltan " + (PD.size - n) + " jugadores") + ".";
    if (gk === 0) return "Tenés que crear al menos un arquero (POR).";
    return "";
  }

  /* Local: un equipo por vez; todos los jugadores creados se reparten entre todos los equipos */
  function renderLocal(n, gk) {
    const L = PD.local, last = L.names.length - 1, size = PD.size;
    $("pdIntro").textContent = "Equipo " + (L.idx + 1) + " de " + L.names.length + ": " + teamLabel(L.idx) + ". Creá " + size
      + " jugadores, con al menos un arquero. Después se reparten entre todos los equipos con el modo que elegiste.";
    $("pdStatusTitle").textContent = "Equipos";
    $("pdStatus").innerHTML = L.names.map((nm, i) => {
      const done = i === L.idx ? valid() : !!(L.lists[i] && L.lists[i].length === size && L.lists[i].some(x => x.p === "POR"));
      const tag = i === L.idx ? (n + "/" + size) : (done ? "Listo ✓" : "Pendiente");
      return `<div class="onl-player"><span class="nm">${onlEsc(teamLabel(i))}</span>${i === L.idx ? '<span class="bd">Ahora</span>' : ""}<span class="bd${done && i !== L.idx ? " pd-ok" : ""}">${tag}</span></div>`;
    }).join("");
    const hint = missingHint(n, gk);
    onlMsg("pdMsg", hint || (L.idx < last ? "Listo: tocá «Siguiente equipo»." : "Listo: tocá «Empezar partida»."), false);
    const next = $("pdReady");
    next.textContent = L.idx < last ? "Siguiente equipo" : "Empezar partida";
    next.disabled = !valid();
    next.classList.toggle("primary", valid());
    $("pdLaunch").style.display = "none";
    $("pdLeave").textContent = "← Volver a ajustes";
  }

  function renderOnline(n, gk) {
    const modo = ONL_GAMES[ONL.game || (ONL.lobby && ONL.lobby.game)] || "puja";
    $("pdIntro").textContent = PD.saved
      ? "Se juega con los jugadores ya creados: cada club aporta los que tiene guardados. Después se reparten entre todos los clubes con el modo que elegiste: " + modo + "."
      : "Creá " + PD.size + " jugadores para tu club, con al menos un arquero. Después se reparten entre todos los clubes con el modo que elegiste: " + modo + ".";
    $("pdStatusTitle").textContent = "Equipos";
    if (PD.saved) {
      $("pdSavedInfo").textContent = n0() ? "Aportás " + plural(n0(), "jugador", "jugadores") + " (" + plural(gkCount(), "arquero", "arqueros") + ")." : "Todavía no tenés jugadores creados: tocá «Crear y editar jugadores» para armar los tuyos.";
      $("pdManage").textContent = "Crear y editar jugadores (" + customCount() + ")";
      $("pdManage").disabled = PD.ready;
    }

    const ready = $("pdReady");
    ready.textContent = PD.ready ? "Seguir editando" : "Listo";
    ready.disabled = !PD.ready && !valid();
    ready.classList.toggle("primary", !PD.ready && valid());

    const L = ONL.lobby || { players: [] };
    $("pdStatus").innerHTML = L.players.map(p => {
      const s = statusOf(p.id);
      const tag = !p.connected ? "Desconectado" : (s[1] ? "Listo ✓" : (PD.saved ? plural(s[0], "jugador", "jugadores") : s[0] + "/" + PD.size));
      return `<div class="onl-player${p.connected ? "" : " off"}"><span class="nm">${onlEsc(p.name)}</span>${p.id === ONL.myId ? '<span class="bd">Vos</span>' : ""}<span class="bd${s[1] && p.connected ? " pd-ok" : ""}">${tag}</span></div>`;
    }).join("");

    let hint = PD.ready ? "" : (PD.saved ? (n ? "" : "Necesitás al menos un jugador creado para quedar listo.") : missingHint(n, gk));
    const alive = L.players.filter(p => p.connected);
    const pending = alive.filter(p => !statusOf(p.id)[1]).length;
    const host = isHost();
    if (!hint) {
      if (!pending) hint = host ? "Todos listos: cuando quieras, empezá la partida." : "Todos listos. Esperando a que el anfitrión empiece…";
      else if (PD.ready) hint = "Esperando a " + plural(pending, "club", "clubes") + "…";
    }
    onlMsg("pdMsg", hint, false);

    const lack = (host && PD.saved && !pending) ? poolProblem(alive) : "";
    if (lack) onlMsg("pdMsg", lack, true);
    const go = $("pdLaunch");
    go.style.display = host ? "" : "none";
    go.disabled = !host || pending > 0 || !onlStartValid(alive.length) || !!lack;
    $("pdLeave").textContent = host ? "Cerrar sala" : "Salir de la sala";
  }

  /* ---------- Local ---------- */
  const teamLabel = i => PD.local.names[i] + ((state.mode === "ia" && i !== humanIdx) ? " · CPU" : "");
  const copyList = a => a.map(x => ({ n: x.n, p: x.p, o: x.o, c: x.c || "" }));

  function loadTeam(i) {
    PD.local.idx = i;
    PD.mine = copyList(PD.local.lists[i] || []);
    PD.ready = false;
    resetForm();
  }
  function beginLocal(names, colors, extras) {
    PD.phase = true; PD.size = squadSize(); PD.list = null; PD.saved = false;
    PD.local = { names, colors, extras, idx: 0, lists: names.map(() => null) };
    const sel = $("pdPos");
    if (!sel.options.length) sel.innerHTML = CUSTOM_POS.map(x => `<option value="${x[0]}">${x[1]} (${x[0]})</option>`).join("");
    customFillCountryList();
    loadTeam(0);
    render();
    onlShow("onl-predio");
  }
  function localPrev() {
    if (!PD.local || PD.local.idx === 0) return;
    PD.local.lists[PD.local.idx] = copyList(PD.mine); // se guarda lo que llevaba, aunque esté incompleto
    loadTeam(PD.local.idx - 1);
    render();
  }
  function localNext() {
    const L = PD.local; if (!L || !valid()) return;
    L.lists[L.idx] = copyList(PD.mine);
    if (L.idx < L.names.length - 1) { loadTeam(L.idx + 1); render(); $("pdName").focus(); return; }
    // último equipo: se arma la lista de la partida y arranca el modo elegido
    const list = [], seen = new Set();
    L.lists.forEach(l => l.forEach(x => {
      let name = x.n, c = 2;
      while (seen.has(name.toLowerCase())) name = x.n.slice(0, 24) + " " + (c++); // repetidos entre equipos: se numeran
      seen.add(name.toLowerCase());
      list.push([name, x.p, x.o, x.c || ""]);
    }));
    state.predioPool = list;
    localUse(list);
    PD.local = null; PD.phase = false;
    startDraftFromSettings(L.names, L.colors, L.extras);
  }
  function localLeave() {
    PD.local = null; PD.phase = false; PD.mine = [];
    goToScreen("settings");
  }
  /* Predio local: usa estos jugadores (no toca los guardados) / vuelve a los guardados */
  function localUse(list) {
    PD.used = true; PD.applied = ""; // (no es la lista online: no se difunde)
    customUseOnline(list);
  }
  function localRestore() {
    if (PD.used && !ONL.active) { PD.used = false; PD.applied = ""; customRestoreLocal(); }
  }

  /* ---------- Cableado ---------- */
  $("pdAdd").addEventListener("click", submit);
  $("pdCancelEdit").addEventListener("click", () => { resetForm(); render(); });
  $("pdReady").addEventListener("click", toggleReady);
  $("pdLaunch").addEventListener("click", launch);
  $("pdLeave").addEventListener("click", () => { if (PD.local) localLeave(); else onlLeaveRoom(); });
  $("pdPrev").addEventListener("click", localPrev);
  $("pdManage").addEventListener("click", () => { if (!PD.ready) openCustomEditor(); });
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
    isPredio, begin, reset, render, push, hostRecv, guestSync, beginLocal, localUse, localRestore, afterEditor,
    phase: () => PD.phase,
    list: () => PD.list
  };
})();
