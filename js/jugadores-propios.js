/* =========================================================
   JUGADORES PROPIOS
   Cada usuario crea sus jugadores (nombre, media y posición). Se guardan en localStorage y se agregan al final
   de PLAYERS, así que Puja, Aleatorio, El Reloj, el mercado y el multijugador online (los corre el anfitrión)
   los usan igual que al resto. En Ajustes se elige: Sin propios / Con propios / Solo propios (state.customMode).
   Los ids son estables: borrar un jugador lo marca como borrado (no se reacomodan los ids de una partida guardada).
========================================================= */
const CUSTOM_KEY = "chiquidraft.jugadoresPropios";
const CUSTOM_COUNTRY = "Creado por vos";
const CUSTOM_CLUB = "Jugador propio";
const CUSTOM_WEIGHT = 40;   // en "Con propios" salen mucho antes que el resto (ver shuffleTrollBoost)
const CUSTOM_MAX = 200;     // tope de jugadores propios activos
const CUSTOM_POS = [["POR", "Arquero"], ["DEF", "Defensor"], ["MED", "Mediocampista"], ["DEL", "Delantero"]];
const CUSTOM_BASE = PLAYERS.length; // el primer id de un jugador propio

let customDefs = [];        // [{n:nombre, p:posición, o:media, d:1 si está borrado}]
let customEditIdx = -1;     // índice en customDefs del jugador que se está editando (-1 = alta nueva)

function customClean(name) {
  // nada de <, >, &, comillas dobles ni acentos graves: los nombres se insertan como HTML en toda la interfaz
  return String(name == null ? "" : name).replace(/[<>&"`\\]/g, "").replace(/\s+/g, " ").trim().slice(0, 28);
}
/* País del jugador: texto libre (con sugerencias); vacío = «Creado por vos». Las banderas salen de COUNTRY_CODES; si no lo conoce, una bandera genérica */
function customCountry(c) {
  return customClean(c).slice(0, 24).replace(/'/g, "");
}
function customValid(d) {
  return d && typeof d === "object" && customClean(d.n) && CUSTOM_POS.some(x => x[0] === d.p)
    && Number.isFinite(+d.o) && +d.o >= 1 && +d.o <= 99;
}
function loadCustomDefs() {
  try {
    const a = JSON.parse(localStorage.getItem(CUSTOM_KEY) || "[]");
    customDefs = Array.isArray(a) ? a.filter(customValid).map(d => ({ n: customClean(d.n), p: d.p, o: Math.round(+d.o), c: customCountry(d.c), d: d.d ? 1 : 0 })) : [];
  } catch (e) { customDefs = []; }
}
function saveCustomDefs() {
  try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(customDefs)); } catch (e) {}
}
/* Vuelca customDefs en PLAYERS (id = CUSTOM_BASE + posición en la lista) */
function syncCustomPlayers() {
  customDefs.forEach((d, i) => {
    const id = CUSTOM_BASE + i;
    const obj = { id, name: d.n, pos: d.p, ovrBase: d.o, ovr: d.o, country: d.c || CUSTOM_COUNTRY, club: CUSTOM_CLUB,
      troll: false, trollish: false, custom: true, deleted: !!d.d };
    PLAYERS[id] = obj;
  });
  if (typeof _PBI !== "undefined") _PBI = null; // se vuelve a armar el índice de playerById
}
/* Predio online: mientras dura la sala, los jugadores propios son los que crearon todos (list = [[nombre, pos, media, país], ...]).
   No toca los que cada uno tiene guardados: se recuperan con customRestoreLocal() al salir de la sala. */
function customUseOnline(list) {
  PLAYERS.length = CUSTOM_BASE;
  (list || []).forEach((d, i) => {
    const id = CUSTOM_BASE + i;
    PLAYERS[id] = { id, name: d[0], pos: d[1], ovrBase: d[2], ovr: d[2], country: customCountry(d[3]) || CUSTOM_COUNTRY, club: CUSTOM_CLUB,
      troll: false, trollish: false, custom: true, deleted: false };
  });
  if (typeof _PBI !== "undefined") _PBI = null;
}
function customRestoreLocal() {
  PLAYERS.length = CUSTOM_BASE;
  syncCustomPlayers();
}
function customActive() { return PLAYERS.filter(p => p.custom && !p.deleted); }
function customCount() { return customDefs.filter(d => !d.d).length; }

/* ---------- Ajustes: Sin propios / Con propios / Solo propios ---------- */
function selectCustomMode(m) {
  state.customMode = m;
  ["off", "on", "only"].forEach(k => {
    const el = document.getElementById("opt-custom-" + k); if (el) el.classList.toggle("sel", m === k);
  });
  refreshCount();
}
/* ¿Se está armando una sala online? (el anfitrión elige acá Sin / Con / Solo propios; en Local se elige antes: Normal o Predio) */
function customOnline() {
  return typeof ONL !== "undefined" && !!ONL && (ONL.stage === "config" || ONL.active === true);
}
/* Texto de ayuda de la tarjeta + botón con la cantidad creada */
function refreshCustomNote() {
  const online = customOnline(), m = state.customMode || "off";
  const card = document.getElementById("customCard");
  if (card) {
    // Local: la tarjeta solo aparece en Predio y sin el selector de 3 opciones (eso ya lo decidió el botón del inicio)
    // Online no se usa: ahí cada uno crea sus jugadores en la sala (pantalla de Predio) después de empezar la partida
    card.style.display = (!online && m === "only") ? "" : "none";
    const sel = card.querySelector(".mode-options"); if (sel) sel.style.display = "none";
    const lbl = card.querySelector("label"); if (lbl) lbl.textContent = "Jugadores del predio";
  }
  // En Predio los jugadores troll no entran en juego: se oculta esa tarjeta para no confundir
  const troll = document.getElementById("trollCard");
  if (troll) troll.style.display = (m === "only") ? "none" : "";
  const btn = document.getElementById("customManageBtn");
  if (btn) btn.textContent = "Crear y editar jugadores (" + customCount() + ")";
  const el = document.getElementById("customNote"); if (!el) return;
  const pool = customActive();
  if (m === "off") { el.style.display = "none"; return; }
  el.style.display = "";
  if (!pool.length) { el.textContent = "Todavía no creaste ningún jugador: tocá «Crear y editar jugadores» para armar los tuyos."; return; }
  const gks = pool.filter(p => p.pos === "POR").length;
  if (m === "on") {
    el.textContent = "Tenés " + pool.length + " jugador" + (pool.length === 1 ? "" : "es") + " propio" + (pool.length === 1 ? "" : "s") + " (" + gks + " arquero" + (gks === 1 ? "" : "s") + ").";
  } else {
    el.textContent = "Solo hay " + pool.length + " jugadores propios (" + gks + " arquero" + (gks === 1 ? "" : "s") + "): con plantel de " + squadSize() + " el máximo es de " + maxTeamsAllowed() + " equipos.";
  }
}
/* Devuelve un texto si el pool de "Solo propios" no alcanza para la cantidad de equipos elegida (si no, null) */
function customPoolProblem() {
  if ((state.customMode || "off") !== "only") return null;
  if (customOnline()) return null; // online: los jugadores se crean en la sala, no se usan los guardados
  const pool = customActive(), n = state.numTeams, size = squadSize();
  const gks = pool.filter(p => p.pos === "POR").length;
  if (gks < n) return "Para " + n + " equipos necesitás al menos " + n + " arquero" + (n === 1 ? "" : "s") + " propios y tenés " + gks + ".";
  if (pool.length < n * size) return "Para " + n + " equipos con plantel de " + size + " necesitás al menos " + (n * size) + " jugadores propios y tenés " + pool.length + ".";
  return null;
}

/* ---------- Editor ---------- */
function customTier(v) { return typeof squadAvgTier === "function" ? squadAvgTier(v) : "silver"; }
function customPosLabel(p) { const x = CUSTOM_POS.find(q => q[0] === p); return x ? x[1] : p; }
function customSetError(msg) {
  const e = document.getElementById("cpError"); if (!e) return;
  e.textContent = msg || ""; e.style.display = msg ? "" : "none";
}
function customRenderList() {
  const box = document.getElementById("cpList"), sum = document.getElementById("cpCount"); if (!box) return;
  const act = customDefs.map((d, i) => ({ d, i })).filter(x => !x.d.d);
  const by = pos => act.filter(x => x.d.p === pos).length;
  sum.textContent = act.length ? (act.length + " jugador" + (act.length === 1 ? "" : "es") + " · " + by("POR") + " POR · " + by("DEF") + " DEF · " + by("MED") + " MED · " + by("DEL") + " DEL") : "Todavía no creaste jugadores.";
  const order = { POR: 0, DEF: 1, MED: 2, DEL: 3 };
  act.sort((a, b) => order[a.d.p] - order[b.d.p] || b.d.o - a.d.o || a.d.n.localeCompare(b.d.n));
  box.innerHTML = act.map(x => `
    <div class="cp-row${x.i === customEditIdx ? " editing" : ""}">
      <span class="cp-pos">${x.d.p}</span>
      <span class="cp-name">${x.d.n}${x.d.c ? ` <small>· ${x.d.c}</small>` : ""}</span>
      <span class="cp-ovr tier-${customTier(x.d.o)}">${x.d.o}</span>
      <button class="btn sm" type="button" data-cp-edit="${x.i}">Editar</button>
      <button class="btn sm cp-del" type="button" data-cp-del="${x.i}">Borrar</button>
    </div>`).join("");
  const clr = document.getElementById("cpClearBtn"); if (clr) clr.style.display = act.length ? "" : "none";
}
function customResetForm() {
  customEditIdx = -1;
  document.getElementById("cpName").value = "";
  document.getElementById("cpOvr").value = "";
  document.getElementById("cpCountry").value = "";
  document.getElementById("cpAddBtn").textContent = "Agregar jugador";
  document.getElementById("cpCancelEdit").style.display = "none";
  customSetError("");
}
function customSubmit() {
  const name = customClean(document.getElementById("cpName").value);
  const raw = document.getElementById("cpOvr").value.trim();
  const ovr = Math.round(Number(raw));
  const pos = document.getElementById("cpPos").value;
  if (!name) return customSetError("Escribí el nombre del jugador.");
  if (raw === "" || !Number.isFinite(ovr) || ovr < 1 || ovr > 99) return customSetError("La media tiene que ser un número de 1 a 99.");
  if (!CUSTOM_POS.some(x => x[0] === pos)) return customSetError("Elegí una posición.");
  const low = name.toLowerCase();
  const dupBase = PLAYERS.some(p => !p.custom && p.name.toLowerCase() === low);
  const dupCustom = customDefs.some((d, i) => !d.d && i !== customEditIdx && d.n.toLowerCase() === low);
  if (dupBase || dupCustom) return customSetError("Ya existe un jugador con ese nombre.");
  if (customEditIdx < 0 && customCount() >= CUSTOM_MAX) return customSetError("Llegaste al máximo de " + CUSTOM_MAX + " jugadores propios.");
  const country = customCountry(document.getElementById("cpCountry").value);
  if (customEditIdx >= 0) customDefs[customEditIdx] = { n: name, p: pos, o: ovr, c: country, d: 0 };
  else customDefs.push({ n: name, p: pos, o: ovr, c: country, d: 0 });
  saveCustomDefs(); syncCustomPlayers();
  const keepPos = pos;
  customResetForm();
  document.getElementById("cpPos").value = keepPos; // para cargar varios de la misma posición seguidos
  customRenderList(); refreshCount();
  document.getElementById("cpName").focus();
}
function customStartEdit(i) {
  const d = customDefs[i]; if (!d || d.d) return;
  customEditIdx = i;
  document.getElementById("cpName").value = d.n;
  document.getElementById("cpOvr").value = d.o;
  document.getElementById("cpPos").value = d.p;
  document.getElementById("cpCountry").value = d.c || "";
  document.getElementById("cpAddBtn").textContent = "Guardar cambios";
  document.getElementById("cpCancelEdit").style.display = "";
  customSetError("");
  customRenderList();
  document.getElementById("cpName").focus();
}
function customDelete(i) {
  const d = customDefs[i]; if (!d || d.d) return;
  d.d = 1; // se conserva el lugar para que los ids no se muevan
  saveCustomDefs(); syncCustomPlayers();
  if (customEditIdx === i) customResetForm();
  customRenderList(); refreshCount();
}
async function customClearAll() {
  if (!customCount()) return;
  const ok = await askConfirm({ icon: "", title: "¿Borrar todos tus jugadores?", msg: "Se borran los " + customCount() + " jugadores propios que creaste.", okText: "Borrar todos", cancelText: "Cancelar" });
  if (!ok) return;
  customDefs.forEach(d => { d.d = 1; });
  saveCustomDefs(); syncCustomPlayers(); customResetForm(); customRenderList(); refreshCount();
}

/* Sugerencias de países para el campo «País» (también lo usa la pantalla de Predio online) */
function customFillCountryList() {
  const dl = document.getElementById("countryList");
  if (dl && !dl.options.length) dl.innerHTML = Object.keys(COUNTRY_CODES).sort((a, b) => a.localeCompare(b, "es")).map(c => `<option value="${c}">`).join("");
}
let _cpCloseT = null;
function openCustomEditor() {
  const ov = document.getElementById("customOverlay");
  const sel = document.getElementById("cpPos");
  if (!sel.options.length) sel.innerHTML = CUSTOM_POS.map(x => `<option value="${x[0]}">${x[1]} (${x[0]})</option>`).join("");
  customFillCountryList();
  customResetForm(); customRenderList();
  clearTimeout(_cpCloseT);
  ov.classList.remove("closing"); ov.classList.add("open");
  document.getElementById("cpName").focus();
}
function closeCustomEditor() {
  const ov = document.getElementById("customOverlay");
  if (!ov.classList.contains("open")) return;
  ov.classList.add("closing");
  clearTimeout(_cpCloseT);
  _cpCloseT = setTimeout(() => ov.classList.remove("open", "closing"), 150);
  refreshCount();
}

/* ---------- Cableado ---------- */
loadCustomDefs();
syncCustomPlayers();
document.getElementById("opt-custom-off").addEventListener("click", () => selectCustomMode("off"));
document.getElementById("opt-custom-on").addEventListener("click", () => selectCustomMode("on"));
document.getElementById("opt-custom-only").addEventListener("click", () => selectCustomMode("only"));
document.getElementById("customManageBtn").addEventListener("click", openCustomEditor);
document.getElementById("cpAddBtn").addEventListener("click", customSubmit);
document.getElementById("cpCancelEdit").addEventListener("click", () => { customResetForm(); customRenderList(); });
document.getElementById("cpClearBtn").addEventListener("click", customClearAll);
document.getElementById("cpDone").addEventListener("click", closeCustomEditor);
document.getElementById("customOverlay").addEventListener("click", e => { if (e.target.id === "customOverlay") closeCustomEditor(); });
document.getElementById("cpList").addEventListener("click", e => {
  const ed = e.target.closest("[data-cp-edit]"), del = e.target.closest("[data-cp-del]");
  if (ed) customStartEdit(+ed.dataset.cpEdit); else if (del) customDelete(+del.dataset.cpDel);
});
["cpName", "cpOvr"].forEach(id => document.getElementById(id).addEventListener("keydown", e => {
  if (e.key === "Enter") { e.preventDefault(); customSubmit(); }
}));
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if (document.getElementById("confirmOverlay").classList.contains("open")) return; // Escape cierra primero el cuadro de confirmación
  closeCustomEditor();
});
refreshCustomNote();
