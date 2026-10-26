/* =========================================================
   CUSTOM (solo Local, dentro de Predio)
   Se juega únicamente con jugadores creados por el usuario, pero acá los planteles NO se reparten con puja, reloj ni azar:
   los equipos ya están configurados en Ajustes (nombre, color, estadio) y cada jugador se crea eligiendo en qué equipo juega.
   Se puede:
   - crear el jugador y elegir el equipo en el mismo formulario («mientras los creás»),
   - dejarlo «Sin equipo» y asignarlo después desde la lista («después de crearlos»),
   - descargar la lista en un .txt y volver a cargarla (el juego lee el archivo y asigna cada jugador a su equipo por nombre),
   - traer los jugadores que ya tenías guardados con el editor de Ajustes (llegan sin equipo).
   Para empezar, cada equipo necesita exactamente el plantel (11 o 5) con al menos un arquero. Los jugadores sin equipo
   no juegan. En Custom no hay mercado de pases: el plantel queda como lo armaste.
   Al empezar se arma la lista de la partida (state.predioPool, que se guarda con el torneo) y state.customRosters con los ids de cada equipo.
========================================================= */
(function () {
  const CL = {
    names: [], colors: [], extras: [],
    size: 11,
    players: [],   // [{n,p,o,c,t}] t = índice del equipo, o -1 si todavía no tiene equipo
    editIdx: -1,
    pick: 0        // equipo elegido en el formulario (-1 = sin equipo)
  };
  const $ = id => document.getElementById(id);
  const MAX = 400;
  const ORDER = { POR: 0, DEF: 1, MED: 2, DEL: 3 };
  const plural = (n, a, b) => n + " " + (n === 1 ? a : b);

  const inTeam = t => CL.players.map((x, i) => ({ x, i })).filter(e => e.x.t === t);
  const count = t => CL.players.filter(x => x.t === t).length;
  const gks = t => CL.players.filter(x => x.t === t && x.p === "POR").length;
  const isFull = (t, ignoreIdx) => t >= 0 && CL.players.filter((x, i) => x.t === t && i !== ignoreIdx).length >= CL.size;
  const teamDone = t => count(t) === CL.size && gks(t) > 0;
  const allDone = () => CL.names.length >= 2 && CL.names.every((_, t) => teamDone(t));
  /* Primer equipo (desde `from`) al que todavía le faltan jugadores; si no queda ninguno, -1 */
  function nextOpen(from) {
    const n = CL.names.length;
    for (let k = 0; k < n; k++) { const t = (from + k) % n; if (count(t) < CL.size) return t; }
    return -1;
  }

  function reset() { CL.players = []; CL.editIdx = -1; CL.pick = 0; }

  function begin(names, colors, extras) {
    CL.names = names.slice(); CL.colors = (colors || []).slice(); CL.extras = (extras || []).slice();
    CL.size = squadSize();
    // si se vuelve desde Ajustes con menos equipos, los jugadores de los equipos que ya no existen quedan sin equipo
    CL.players.forEach(x => { if (x.t >= CL.names.length) x.t = -1; });
    CL.editIdx = -1;
    CL.pick = nextOpen(0);
    const pos = $("clPos");
    if (!pos.options.length) pos.innerHTML = CUSTOM_POS.map(x => `<option value="${x[0]}">${x[1]} (${x[0]})</option>`).join("");
    customFillCountryList();
    resetForm();
    render();
    onlShow("onl-custom");
  }

  /* ---------- Formulario ---------- */
  function setError(msg) { const e = $("clError"); e.textContent = msg || ""; e.style.display = msg ? "" : "none"; }
  function resetForm() {
    CL.editIdx = -1;
    $("clName").value = ""; $("clOvr").value = ""; $("clCountry").value = "";
    $("clAdd").textContent = "Agregar jugador";
    $("clCancelEdit").style.display = "none";
    setError("");
  }
  function teamOptions(selected) {
    return `<option value="-1"${selected === -1 ? " selected" : ""}>Sin equipo (asignar después)</option>`
      + CL.names.map((nm, t) => `<option value="${t}"${selected === t ? " selected" : ""}>${onlEsc(nm)} (${count(t)}/${CL.size})</option>`).join("");
  }
  function nameTaken(low, ignoreIdx) {
    return PLAYERS.some(p => !p.custom && p.name.toLowerCase() === low) || CL.players.some((x, i) => i !== ignoreIdx && x.n.toLowerCase() === low);
  }

  function submit() {
    const name = customClean($("clName").value);
    const raw = $("clOvr").value.trim();
    const ovr = Math.round(Number(raw));
    const pos = $("clPos").value;
    const t = Number($("clTeam").value);
    if (!name) return setError("Escribí el nombre del jugador.");
    if (raw === "" || !Number.isFinite(ovr) || ovr < 1 || ovr > 99) return setError("La media tiene que ser un número de 1 a 99.");
    if (!CUSTOM_POS.some(x => x[0] === pos)) return setError("Elegí una posición.");
    if (nameTaken(name.toLowerCase(), CL.editIdx)) return setError("Ya existe un jugador con ese nombre.");
    if (CL.editIdx < 0 && CL.players.length >= MAX) return setError("Llegaste al máximo de " + MAX + " jugadores.");
    if (isFull(t, CL.editIdx)) return setError(CL.names[t] + " ya tiene sus " + CL.size + " jugadores. Elegí otro equipo o dejalo sin equipo.");
    const c = customCountry($("clCountry").value);
    if (CL.editIdx >= 0) CL.players[CL.editIdx] = { n: name, p: pos, o: ovr, c, t };
    else CL.players.push({ n: name, p: pos, o: ovr, c, t });
    const keepPos = pos;
    resetForm();
    $("clPos").value = keepPos; // para cargar varios de la misma posición seguidos
    // si el equipo se completó, el formulario pasa solo al siguiente que todavía tenga lugar
    CL.pick = (t >= 0 && count(t) >= CL.size) ? nextOpen(t) : t;
    render();
    $("clName").focus();
  }

  function startEdit(i) {
    const d = CL.players[i]; if (!d) return;
    CL.editIdx = i;
    $("clName").value = d.n; $("clOvr").value = d.o; $("clPos").value = d.p; $("clCountry").value = d.c || "";
    CL.pick = d.t;
    $("clAdd").textContent = "Guardar cambios";
    $("clCancelEdit").style.display = "";
    setError("");
    render();
    $("clName").focus();
  }
  function del(i) {
    if (!CL.players[i]) return;
    CL.players.splice(i, 1);
    if (CL.editIdx === i) resetForm(); else if (CL.editIdx > i) CL.editIdx--;
    render();
  }
  /* Asignar o cambiar de equipo desde la lista («después de crearlos») */
  function assign(i, t) {
    const d = CL.players[i]; if (!d) return;
    if (isFull(t, i)) { setError(CL.names[t] + " ya tiene sus " + CL.size + " jugadores."); render(); return; }
    setError("");
    d.t = t;
    render();
  }
  /* Trae los jugadores guardados con el editor de Ajustes (sin equipo, para repartirlos a mano) */
  function importSaved() {
    const saved = customDefs.filter(d => !d.d);
    if (!saved.length) { setError("Todavía no tenés jugadores guardados: creá algunos acá o desde «Crear y editar jugadores» en otro modo de Predio."); return; }
    let added = 0;
    saved.forEach(d => {
      const low = d.n.toLowerCase();
      if (CL.players.length >= MAX || CL.players.some(x => x.n.toLowerCase() === low)) return;
      CL.players.push({ n: d.n, p: d.p, o: d.o, c: d.c || "", t: -1 });
      added++;
    });
    setError(added ? "" : "Tus jugadores guardados ya están todos en la lista.");
    render();
  }

  /* ---------- Descargar / cargar en un archivo de texto (bloc de notas) ----------
     Una línea por jugador:  Nombre | Posición | Media | País | Equipo   (País y Equipo son opcionales; # = comentario) */
  const POS_ALIAS = { POR: "POR", ARQUERO: "POR", ARQ: "POR", GK: "POR", DEF: "DEF", DEFENSOR: "DEF", MED: "MED", MEDIOCAMPISTA: "MED", VOLANTE: "MED", DEL: "DEL", DELANTERO: "DEL" };
  const noBar = v => String(v == null ? "" : v).replace(/\|/g, "/");
  /* rows: [{n,p,o,c,team}] -> baja jugadores-custom.txt */
  function saveTxt(rows) {
    const lines = ["# ChiquiDraft · jugadores Custom", "# Formato: Nombre | Posición | Media | País | Equipo",
      "# Posición: POR, DEF, MED o DEL. País y Equipo son opcionales (sin equipo = vacío).",
      "# El equipo se une por nombre: si no existe en la partida, el jugador queda sin equipo.", ""];
    rows.forEach(x => lines.push([noBar(x.n), x.p, x.o, noBar(x.c || ""), noBar(x.team || "")].join(" | ")));
    const blob = new Blob(["\ufeff" + lines.join("\r\n") + "\r\n"], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "jugadores-custom.txt";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function download() {
    if (!CL.players.length) { setError("Todavía no hay jugadores para descargar."); return; }
    saveTxt(CL.players.slice().sort((a, b) => a.t - b.t || ORDER[a.p] - ORDER[b.p] || b.o - a.o)
      .map(x => ({ n: x.n, p: x.p, o: x.o, c: x.c, team: x.t >= 0 ? CL.names[x.t] : "" })));
    setError("");
  }
  /* Al final de la partida: baja los jugadores de la partida con el equipo en el que terminó cada uno */
  function downloadFinal() {
    const pool = state.predioPool || [];
    if (!pool.length) return;
    const rows = pool.map((d, i) => {
      const t = state.teams.find(tm => tm.roster.includes(CUSTOM_BASE + i));
      return { n: d[0], p: d[1], o: d[2], c: d[3], team: t ? t.name : "", ti: t ? t.id : 99 };
    }).sort((a, b) => a.ti - b.ti || ORDER[a.p] - ORDER[b.p] || b.o - a.o);
    saveTxt(rows);
  }
  /* Los botones «Descargar jugadores» del final solo se ven en Custom, con el torneo terminado */
  function refreshFinalButtons() {
    let show = false;
    try { show = state.game === "custom" && !!(state.predioPool && state.predioPool.length) && tournamentFinished(); } catch (e) {}
    document.querySelectorAll(".dl-players-btn").forEach(b => { b.style.display = show ? "" : "none"; });
  }
  document.addEventListener("click", e => { if (e.target.closest(".dl-players-btn")) downloadFinal(); });
  ["renderLeague", "renderPlayoffs"].forEach(fn => {
    const base = window[fn]; if (typeof base !== "function") return;
    window[fn] = function () { const r = base.apply(this, arguments); refreshFinalButtons(); return r; };
  });
  const baseCel = window.showCelebration;
  if (typeof baseCel === "function") window.showCelebration = function () { const r = baseCel.apply(this, arguments); refreshFinalButtons(); return r; };
  function parseFile(text) {
    const ok = [], bad = [];
    text.replace(/^\ufeff/, "").split(/\r?\n/).forEach((raw, k) => {
      const line = raw.trim();
      if (!line || line[0] === "#") return;
      const f = line.split("|").map(s => s.trim());
      const n = customClean(f[0]), p = POS_ALIAS[String(f[1] || "").toUpperCase()], o = Math.round(Number(f[2]));
      if (!n || !p || !(o >= 1 && o <= 99)) { bad.push(k + 1); return; }
      ok.push({ n, p, o, c: customCountry(f[3] || ""), team: (f[4] || "").toLowerCase() });
    });
    return { ok, bad };
  }
  function loadText(text) {
    const { ok, bad } = parseFile(text);
    let added = 0, dup = 0, noTeam = 0;
    ok.forEach(d => {
      const low = d.n.toLowerCase();
      if (CL.players.length >= MAX || nameTaken(low, -1)) { dup++; return; }
      let t = d.team ? CL.names.findIndex(nm => nm.toLowerCase() === d.team) : -1;
      if (t >= 0 && isFull(t, -1)) t = -1;
      if (d.team && t < 0) noTeam++;
      CL.players.push({ n: d.n, p: d.p, o: d.o, c: d.c, t });
      added++;
    });
    const parts = ["Se cargaron " + plural(added, "jugador", "jugadores") + "."];
    if (dup) parts.push(plural(dup, "se salteó", "se saltearon") + " por nombre repetido.");
    if (noTeam) parts.push(plural(noTeam, "quedó", "quedaron") + " sin equipo (no existe o ya está completo).");
    if (bad.length) parts.push("Líneas con error: " + bad.slice(0, 8).join(", ") + (bad.length > 8 ? "…" : "") + ".");
    CL.pick = nextOpen(CL.pick < 0 ? 0 : CL.pick);
    render();
    setError(added && !dup && !noTeam && !bad.length ? "" : parts.join(" "));
    if (added && !dup && !noTeam && !bad.length) onlMsg("clMsg", parts[0], false);
  }
  function upload(file) {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => loadText(String(r.result || ""));
    r.onerror = () => setError("No se pudo leer el archivo.");
    r.readAsText(file, "utf-8");
  }

  /* ---------- Pantalla ---------- */
  function row(e) {
    const { x, i } = e;
    return `
      <div class="cp-row${i === CL.editIdx ? " editing" : ""}">
        <span class="cp-pos">${x.p}</span>
        <span class="cp-name">${onlEsc(x.n)}${x.c ? ` <small>· ${onlEsc(x.c)}</small>` : ""}</span>
        <span class="cp-ovr tier-${customTier(x.o)}">${x.o}</span>
        <select class="cl-team-sel" data-cl-assign="${i}" aria-label="Equipo de ${onlEsc(x.n)}">${teamOptions(x.t)}</select>
        <button class="btn sm" type="button" data-cl-edit="${i}">Editar</button>
        <button class="btn sm cp-del" type="button" data-cl-del="${i}">Borrar</button>
      </div>`;
  }
  function render() {
    if (!$("clList")) return;
    const n = CL.names.length, size = CL.size;
    $("clIntro").textContent = "Creá los jugadores y elegí en qué equipo juega cada uno. Cada equipo necesita " + size
      + " jugadores, con al menos un arquero. Podés elegir el equipo al crearlo o dejarlo sin equipo y asignarlo después desde la lista.";

    // formulario: equipo elegido
    const keep = CL.pick >= n ? -1 : CL.pick;
    $("clTeam").innerHTML = teamOptions(keep);
    $("clAdd").disabled = false;

    // estado de cada equipo (tocar uno lo elige en el formulario)
    $("clStatus").innerHTML = CL.names.map((nm, t) => {
      const done = teamDone(t), c = count(t), isPick = t === keep;
      const tag = done ? "Listo ✓" : (c === size ? "Falta arquero" : c + "/" + size);
      return `<div class="onl-player cl-team${isPick ? " pick" : ""}" data-cl-pick="${t}" role="button" tabindex="0">`
        + `<span class="cl-dot" style="background:${CL.colors[t] || "var(--muted)"};${CL.extras[t] && CL.extras[t].color2 ? `box-shadow:inset 0 0 0 3px ${CL.extras[t].color2}` : ""}"></span>`
        + `<span class="nm">${onlEsc(nm)}</span>${isPick ? '<span class="bd">Eligido</span>' : ""}`
        + `<span class="bd${done ? " pd-ok" : ""}">${tag}</span></div>`;
    }).join("");

    // lista agrupada: primero los sin equipo y después cada equipo
    const groups = [];
    const sorter = (a, b) => ORDER[a.x.p] - ORDER[b.x.p] || b.x.o - a.x.o || a.x.n.localeCompare(b.x.n);
    const free = inTeam(-1).sort(sorter);
    if (free.length) groups.push(`<div class="cl-group">Sin equipo · ${free.length}</div>` + free.map(row).join(""));
    CL.names.forEach((nm, t) => {
      const l = inTeam(t).sort(sorter);
      if (l.length) groups.push(`<div class="cl-group">${onlEsc(nm)} · ${l.length}/${size} · ${plural(gks(t), "arquero", "arqueros")}</div>` + l.map(row).join(""));
    });
    $("clList").innerHTML = groups.join("");
    const total = CL.players.length, assigned = CL.players.filter(x => x.t >= 0).length;
    $("clCount").textContent = total
      ? plural(total, "jugador", "jugadores") + " · " + assigned + " con equipo · " + (total - assigned) + " sin equipo"
      : "Todavía no creaste jugadores.";

    // mensaje y botón de empezar
    let msg = "", ok = allDone();
    if (n < 2) msg = "Hacen falta al menos 2 equipos.";
    else if (!ok) {
      const lack = CL.names.map((nm, t) => ({ nm, t })).filter(e => !teamDone(e.t));
      const first = lack[0];
      msg = count(first.t) < size
        ? "A " + first.nm + " le " + (size - count(first.t) === 1 ? "falta 1 jugador" : "faltan " + (size - count(first.t)) + " jugadores") + (lack.length > 1 ? " (y hay " + (lack.length - 1) + " equipo" + (lack.length === 2 ? "" : "s") + " más incompleto" + (lack.length === 2 ? "" : "s") + ")" : "") + "."
        : first.nm + " necesita al menos un arquero (POR).";
    } else msg = free.length
      ? "Todo listo. " + (free.length === 1 ? "1 jugador sin equipo queda" : free.length + " jugadores sin equipo quedan") + " fuera."
      : "Todo listo: tocá «Empezar torneo».";
    onlMsg("clMsg", msg, false);
    $("clStart").disabled = !ok;
    $("clStart").classList.toggle("primary", ok);
    $("clStart").textContent = "Empezar torneo";
  }

  function start() {
    if (!allDone()) return;
    const list = CL.players.map(x => [x.n, x.p, x.o, x.c || ""]);   // id de jugador = CUSTOM_BASE + lugar en la lista
    const rosters = CL.names.map((_, t) => CL.players.map((x, i) => x.t === t ? CUSTOM_BASE + i : -1).filter(id => id >= 0));
    state.predioPool = list;
    state.customRosters = rosters;
    PD_ONL.localUse(list);   // los jugadores de esta partida reemplazan a los guardados (que no se tocan)
    const names = CL.names.slice(), colors = CL.colors.slice(), extras = CL.extras.slice();
    reset();
    startDraftFromSettings(names, colors, extras);
  }
  function leave() { goToScreen("settings"); window.scrollTo(0, 0); }

  /* ---------- Cableado ---------- */
  $("clAdd").addEventListener("click", submit);
  $("clCancelEdit").addEventListener("click", () => { resetForm(); render(); });
  $("clImport").addEventListener("click", importSaved);
  $("clDownload").addEventListener("click", download);
  $("clUpload").addEventListener("click", () => $("clFile").click());
  $("clFile").addEventListener("change", e => { upload(e.target.files[0]); e.target.value = ""; });
  $("clStart").addEventListener("click", start);
  $("clLeave").addEventListener("click", leave);
  $("clTeam").addEventListener("change", e => { CL.pick = Number(e.target.value); render(); });
  ["clName", "clOvr", "clCountry"].forEach(id => $(id).addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); submit(); }
  }));
  $("clList").addEventListener("click", e => {
    const ed = e.target.closest("[data-cl-edit]"), dl = e.target.closest("[data-cl-del]");
    if (ed) startEdit(+ed.dataset.clEdit); else if (dl) del(+dl.dataset.clDel);
  });
  $("clList").addEventListener("change", e => {
    const s = e.target.closest("[data-cl-assign]");
    if (s) assign(+s.dataset.clAssign, Number(s.value));
  });
  const pickTeam = e => {
    const el = e.target.closest("[data-cl-pick]"); if (!el) return;
    if (e.type === "keydown" && e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    CL.pick = Number(el.dataset.clPick); render();
  };
  $("clStatus").addEventListener("click", pickTeam);
  $("clStatus").addEventListener("keydown", pickTeam);

  window.CUSTOM_LOCAL = { begin, reset, downloadFinal, refreshFinalButtons };
})();
