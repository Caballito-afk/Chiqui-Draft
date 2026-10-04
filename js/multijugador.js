/* =========================================================
   MULTIJUGADOR ONLINE (Salas en tiempo real con Socket.io)
   - El anfitrión corre el juego en modo local sincronizado.
   - Los invitados se conectan por WebSocket seguro (Socket.io)
     usando un código de 6 letras (ej: ABC123).
   - Funciona entre celulares y PCs en cualquier red (WiFi, 4G, 5G),
     sin problemas de NAT, STUN ni caídas de WebRTC.
   - Transmisión ligera de pantalla activa y acciones en milisegundos.
========================================================= */

var ONL = {
  active: false,
  role: null, // "host" | "guest"
  stage: null, // "config" | "lobby"
  code: null,
  club: "",
  game: null,
  myId: 0,
  started: false,
  players: [],
  cfg: { min: 2, max: 6 },
  socket: null,
  connected: false,
  mirrorOn: false,
  timer: null,
  lastHtml: "",
  lobby: null,
  _restarting: false,
  _closing: false
};

const ONL_GAMES = { puja: "🔨 Puja", random: "🎲 Aleatorio", reloj: "⏱️ El Reloj" };

// Controles que solo maneja el anfitrión
const ONL_HOST_ONLY = "[data-host-only],#startDraftBtn,#changeModeBtn,#auctionBackBtn,#miniBackBtn,#endMarketBtn,#marketMenuBtn,#drawSkipBtn,#drawGoBtn,#goPlayoffsBtn,#prevMd,#nextMd,#simMdBtn,#autoMdBtn,#simAllBtn,#simPlayoffsBtn,#viewLeagueBtn,#sideHandle,#themeToggle,#sfxToggle,.restart-btn,.squad-btn,#squadModal,#confirmOverlay,#celebrate,#offBidder,#freeBidder,#screen-settings,.speed-btn,#pauseLiveBtn,#skipLiveBtn";

// Botones 100% locales: cada cliente los resuelve solo; si llegan al anfitrión por red se descartan
const ONL_LOCAL_ONLY = "#celAgainBtn,#celLeagueBtn,#relMsgBtn,#prevMd,#nextMd,#onlMdNow,#sideHandle,#goPlayoffsBtn,#viewLeagueBtn";

const $o = id => document.getElementById(id);

(function onlFillTitleImgs() {
  const src = document.getElementById("homeTitleImg");
  if (!src) return;
  document.querySelectorAll("img[data-title-clone]").forEach(i => { i.src = src.src; });
})();

/* ---------- Utilidades ---------- */
function onlClean(n) {
  return String(n || "").replace(/[<>&"'`\\]/g, "").replace(/\s+/g, " ").trim().slice(0, 24);
}

function onlEsc(v) {
  return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

let _onlToastT = null;
function onlToast(msg, ms) {
  const t = $o("onlToast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(_onlToastT);
  _onlToastT = setTimeout(() => t.classList.remove("show"), ms || 3500);
}

function onlShow(panel) {
  document.querySelectorAll("#screen-online .onl-panel").forEach(p => p.classList.toggle("on", p.id === panel));
  goToScreen("online");
  window.scrollTo(0, 0);
}

function onlMsg(id, txt, err) {
  const el = $o(id);
  if (!el) return;
  el.textContent = txt || "";
  el.classList.toggle("err", !!err);
}

/* =========================================================
   CONEXIÓN SOCKET.IO
========================================================= */
// URL predeterminada del backend para salas online
// (Cuando despliegues tu backend en Render.com, colocá tu URL aquí, ej: "https://chiqui-draft.onrender.com")
const ONL_DEFAULT_SERVER_URL = "";

function getSocketServerUrl() {
  if (window.CHIQUI_SOCKET_URL && String(window.CHIQUI_SOCKET_URL).trim()) {
    return String(window.CHIQUI_SOCKET_URL).trim();
  }
  try {
    const saved = localStorage.getItem("chiquiSocketUrl");
    if (saved && saved.trim()) return saved.trim();
  } catch (e) {}

  if (ONL_DEFAULT_SERVER_URL && ONL_DEFAULT_SERVER_URL.trim()) {
    return ONL_DEFAULT_SERVER_URL.trim();
  }

  // En GitHub Pages (sitio estático), location.origin no corre Node.js ni Socket.io
  if (typeof location !== "undefined" && location.hostname && location.hostname.endsWith("github.io")) {
    return "";
  }

  if (typeof location !== "undefined" && location.protocol && location.protocol.startsWith("http")) {
    return location.origin;
  }
  return "http://localhost:3000";
}

function onlPromptServerUrl(cb) {
  const current = getSocketServerUrl() || "";
  const input = prompt(
    "Configuración del servidor de salas (Opcional):\n\n" +
    "GitHub Pages solo aloja la página web. Para crear y unirte a salas online, necesitás que server.js esté corriendo (ej: en Render.com).\n\n" +
    "Ingresá la URL de tu backend (ej: https://tu-servicio.onrender.com):",
    current
  );

  if (input !== null) {
    let clean = input.trim();
    if (clean) {
      if (!/^https?:\/\//i.test(clean)) clean = "https://" + clean;
      clean = clean.replace(/\/+$/, "");
      try { localStorage.setItem("chiquiSocketUrl", clean); } catch (e) {}
      onlToast("Servidor guardado: " + clean, 3000);
    } else {
      try { localStorage.removeItem("chiquiSocketUrl"); } catch (e) {}
      onlToast("Configuración de servidor restablecida.", 2500);
    }

    if (ONL.socket) {
      try { ONL.socket.disconnect(); } catch (e) {}
      ONL.socket = null;
    }

    if (clean && cb) {
      ensureSocket(cb);
      return true;
    }
  }
  return false;
}

function ensureSocket(cb) {
  if (ONL.socket && ONL.socket.connected) {
    return cb && cb(ONL.socket);
  }

  if (typeof io !== "function") {
    onlToast("Error: No se pudo cargar la librería de conexión en tiempo real.", 4000);
    return cb && cb(null);
  }

  let sUrl = getSocketServerUrl();

  // Si estamos en un hosting estático (como GitHub Pages) y no hay backend en la nube configurado
  if (!sUrl) {
    if (cb) cb(null);
    return;
  }

  if (!ONL.socket) {
    ONL.socket = io(sUrl, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 12000
    });

    ONL.socket.on("connect", () => {
      ONL.connected = true;
      if (ONL.role === "host") onlRenderLobby();
    });

    ONL.socket.on("disconnect", () => {
      ONL.connected = false;
      if (ONL.active && ONL.started) {
        onlToast("Conexión perdida con el servidor. Reintentando...", 2000);
      }
    });

    ONL.socket.on("room_updated", (room) => {
      if (!ONL.active) return;
      const prevLines = ONL.lobby ? (ONL.lobby.lines || []).join("|") : null;
      ONL.lobby = room;
      ONL.players = room.players;
      if (ONL.role === "guest") {
        ONL.cfg.min = room.min; ONL.cfg.max = room.max;
        if (ONL.started && prevLines !== null && prevLines !== (room.lines || []).join("|")) {
          onlToast("El anfitrión actualizó los ajustes de la sala.", 2500);
        }
      }
      onlRenderLobby();
      onlRenderChip();
    });

    ONL.socket.on("game_started", (data) => {
      if (ONL.role === "guest") {
        ONL.started = true;
        onlEnterMirror();
        onlToast("¡Partida comenzada!", 2000);
      }
    });

    ONL.socket.on("player_action", (act) => {
      if (ONL.active && ONL.role === "host" && ONL.started) {
        onlHostAct(act.playerId, act);
      }
    });

    ONL.socket.on("guest_sync", (data) => {
      if (ONL.active && ONL.role === "guest" && ONL.mirrorOn && data) {
        onlGuestFrame(data);
      }
    });

    ONL.socket.on("player_disconnected", (data) => {
      if (ONL.active) {
        onlToast(`${data.name} se ha desconectado.`, 3000);
        onlRenderChip();
      }
    });

    ONL.socket.on("room_closed", (data) => {
      if (ONL.active && ONL.role === "guest") {
        onlGuestClosed(data.reason || "La sala se cerró.");
      }
    });
  }

  if (ONL.socket.connected) {
    return cb && cb(ONL.socket);
  } else {
    if (ONL.socket.disconnected) {
      ONL.socket.connect();
    }
    const onConnect = () => {
      cleanup();
      cb && cb(ONL.socket);
    };
    const onErr = () => {
      cleanup();
      cb && cb(null);
    };
    const cleanup = () => {
      if (ONL.socket) {
        ONL.socket.off("connect", onConnect);
        ONL.socket.off("connect_error", onErr);
      }
    };
    ONL.socket.once("connect", onConnect);
    ONL.socket.once("connect_error", onErr);
  }
}

/* =========================================================
   1) PANTALLAS PREVIAS: Nombre -> Unirte / Crear
========================================================= */
$o("home-online").addEventListener("click", () => {
  let saved = "";
  try { saved = localStorage.getItem("chiquiClub") || ""; } catch (e) {}
  if (!$o("onlClubName").value) $o("onlClubName").value = ONL.club || saved;
  onlMsg("onlNameMsg", "");
  onlShow("onl-name");
  ensureSocket();
});

$o("onlNameBack").addEventListener("click", () => {
  showHomeRoot();
  goToScreen("home");
});

function onlNameNext() {
  const nm = onlClean($o("onlClubName").value);
  if (nm.length < 2) {
    onlMsg("onlNameMsg", "Poné un nombre de al menos 2 letras.", true);
    return;
  }
  ONL.club = nm;
  try { localStorage.setItem("chiquiClub", nm); } catch (e) {}
  $o("onlClubShow").textContent = "Tu club: " + nm;
  onlShow("onl-choice");
}

$o("onlNameNext").addEventListener("click", onlNameNext);
$o("onlClubName").addEventListener("keydown", e => { if (e.key === "Enter") onlNameNext(); });
$o("onlChoiceBack").addEventListener("click", () => onlShow("onl-name"));
const srvBtn = $o("onlServerBtn");
if (srvBtn) srvBtn.addEventListener("click", () => onlPromptServerUrl());
$o("onlJoinBtn").addEventListener("click", () => {
  onlMsg("onlJoinMsg", "");
  $o("onlCode").value = "";
  onlShow("onl-join");
  setTimeout(() => $o("onlCode").focus(), 50);
});
$o("onlCreateBtn").addEventListener("click", () => onlShow("onl-mode"));
$o("onlJoinBack").addEventListener("click", () => onlShow("onl-choice"));
$o("onlModeBack").addEventListener("click", () => onlShow("onl-choice"));

document.querySelectorAll("#onl-mode .home-card").forEach(c =>
  c.addEventListener("click", () => onlineEnterConfig(c.dataset.game))
);

$o("onlCode").addEventListener("input", e => {
  e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
});
$o("onlCode").addEventListener("keydown", e => { if (e.key === "Enter") onlJoinGo(); });
$o("onlJoinGo").addEventListener("click", onlJoinGo);

/* =========================================================
   2) CONFIGURACIÓN DE LA SALA
========================================================= */
function onlineEnterConfig(game) {
  ONL.stage = "config";
  ONL.game = game;
  ONL.role = "host";
  startGameMode(game, "local");
  $o("modeBannerTitle").textContent = ONL_GAMES[game] + " · Multijugador Online";
  $o("modeBannerDesc").textContent = "Cada jugador entra desde su dispositivo y maneja su propio club.";
  $o("countCard").style.display = "none";
  $o("namesCard").style.display = "none";
  $o("onlineRoomCard").style.display = "";
  refreshStartBtn();
  refreshCount();
}

function onlineLeaveConfig() {
  $o("countCard").style.display = "";
  $o("namesCard").style.display = "";
  $o("onlineRoomCard").style.display = "none";
}

$o("changeModeBtn").addEventListener("click", e => {
  if (ONL.stage !== "config") return;
  e.stopImmediatePropagation();
  onlineLeaveConfig();
  ONL.stage = null;
  onlShow("onl-mode");
}, true);

function onlRoomRender() {
  ONL.cfg.max = state.numTeams;
  const floor = state.champions ? 8 : 2;
  if (ONL.cfg.min < floor) ONL.cfg.min = floor;
  if (ONL.cfg.min > ONL.cfg.max) ONL.cfg.min = ONL.cfg.max;
  $o("onlMinVal").textContent = ONL.cfg.min;
  $o("onlMaxVal").textContent = ONL.cfg.max;
  $o("onlRoomNote").textContent = state.champions
    ? "Champions / Libertadores se juega con 8, 12 o 16 equipos (grupos de 4): la partida solo puede empezar con una de esas cantidades."
    : `Podrán entrar entre ${ONL.cfg.min} y ${ONL.cfg.max} clubes (vos incluido). Podés empezar cuando haya al menos ${ONL.cfg.min}.`;
}

$o("onlMinMinus").addEventListener("click", () => {
  ONL.cfg.min = Math.max(state.champions ? 8 : 2, ONL.cfg.min - 1);
  onlRoomRender();
});
$o("onlMinPlus").addEventListener("click", () => {
  ONL.cfg.min = Math.min(ONL.cfg.max, ONL.cfg.min + 1);
  onlRoomRender();
});
$o("onlMaxMinus").addEventListener("click", () => { $o("countMinus").click(); });
$o("onlMaxPlus").addEventListener("click", () => { $o("countPlus").click(); });

const _onlRefreshCount = refreshCount;
refreshCount = function() {
  _onlRefreshCount.apply(this, arguments);
  if (ONL.stage === "config") onlRoomRender();
};

const _onlRefreshStartBtn = refreshStartBtn;
refreshStartBtn = function() {
  _onlRefreshStartBtn.apply(this, arguments);
  if (ONL.stage === "config") $o("startDraftBtn").textContent = "Crear sala →";
};

const _onlGoToScreen = goToScreen;
goToScreen = function(name) {
  if (ONL.active && ONL.role === "host" && name === "home" && !ONL._restarting) {
    onlineCloseRoom("El anfitrión cerró la sala.");
  }
  const r = _onlGoToScreen.apply(this, arguments);
  // las pantallas del multijugador (antes de la partida) se ven como el inicio
  document.querySelector(".app").classList.toggle("on-home", name === "home" || name === "online");
  return r;
};

const _onlRestartGame = restartGame;
restartGame = function() {
  if (ONL.active && ONL.role === "host" && ONL.started) {
    ONL._restarting = true;
    try { backToMenu(); } finally { ONL._restarting = false; }
    onlineBackToLobby();
    return;
  }
  return _onlRestartGame.apply(this, arguments);
};

function onlCfgLines() {
  const L = [];
  L.push("Modo: " + (ONL_GAMES[state.game] || state.game));
  L.push("Formato: Fútbol " + state.squadSize);
  L.push("Competencia: " + (state.champions ? "⭐ Champions / Libertadores" : ({ leaguecup: "🏟️ Copa de la liga", league: "📊 Liga", cup: "🏆 Copa" })[state.comp]));
  if (state.champions) L.push((state.leagueDouble ? "Grupos a ida y vuelta" : "Grupos a una vuelta") + (state.awayGoals ? " · gol de visitante" : "") + (state.champET ? " · prórroga y penales" : " · directo a penales"));
  else if (state.comp === "league") L.push(state.doubleLeg ? "Liga a ida y vuelta" : "Liga a una vuelta");
  else if (state.comp === "cup") L.push(state.doubleLeg ? "Copa a ida y vuelta" : "Copa a partido único");
  else L.push("Liga " + (state.leagueDouble ? "a ida y vuelta" : "a una vuelta") + " · eliminatorias " + (state.doubleLeg ? "a ida y vuelta" : "a partido único"));
  if (state.finalDouble) L.push("Final a ida y vuelta");
  L.push(state.useMarket ? "Mercado de pases: sí" + (state.useFreeMarket ? " (con mercado libre)" : "") : "Sin mercado de pases");
  if (state.game !== "random" || state.useMarket) L.push("Presupuesto inicial: " + fmtM(state.startBudget));
  if (state.game === "puja") {
    L.push(state.bidSecs === 0 ? "Puja sin límite de tiempo" : "Tiempo por puja: " + state.bidSecs + " s");
    L.push(state.passLimit === null ? "Pases ilimitados" : (state.passLimit === 0 ? "Sin pases" : state.passLimit + " pase" + (state.passLimit === 1 ? "" : "s") + " por equipo"));
  }
  if (state.game === "reloj") L.push("El Reloj: " + state.clockSecs + " s");
  if (state.trollMode === "on") L.push("Con jugadores troll"); else if (state.trollMode === "only") L.push("Solo jugadores troll");
  L.push("Cupos: entre " + ONL.cfg.min + " y " + ONL.cfg.max + " clubes");
  return L;
}

/* =========================================================
   3a) AJUSTES EN VIVO DEL ANFITRIÓN
   Cambiar opciones con la sala abierta (en la sala de espera o con la partida en curso) NO recrea la sala
   ni reinicia sockets: se emite "update_room" por el mismo socket y el servidor reenvía "room_updated" a todos.
========================================================= */
const ONL_LIVE_KEYS = ["bidSecs", "passLimit", "clockSecs", "botLevel", "botOffers", "startBudget", "useMarket", "useFreeMarket", "trollMode", "squadSize"];
let _onlPushT = null;

function onlLiveSettings() {
  const o = {};
  ONL_LIVE_KEYS.forEach(k => { o[k] = state[k] === undefined ? null : state[k]; });
  return o;
}

function onlPushRoomUpdate() {
  if (!ONL.active || ONL.role !== "host" || !ONL.socket || !ONL.socket.connected) return;
  clearTimeout(_onlPushT);
  _onlPushT = setTimeout(() => {
    ONL.socket.emit("update_room", {
      min: ONL.cfg.min,
      max: ONL.cfg.max,
      champions: !!state.champions,
      lines: onlCfgLines(),
      settings: onlLiveSettings()
    }, (res) => {
      if (!res || !res.ok) { onlToast(res && res.error ? res.error : "No se pudieron actualizar los ajustes."); return; }
      ONL.lobby = res.room;               // el servidor es la fuente de verdad (p. ej. corrige el máximo)
      ONL.cfg.min = res.room.min; ONL.cfg.max = res.room.max;
      onlRenderLobby();
    });
  }, 120); // junta varios clics seguidos en un solo envío
}

/* Aplica un cambio de ajustes del anfitrión directamente sobre `state` (la partida corre en su navegador) y lo difunde. */
function onlHostApplyLive(patch) {
  if (ONL.role !== "host") return;
  Object.keys(patch || {}).forEach(k => { if (ONL_LIVE_KEYS.includes(k)) state[k] = patch[k]; });
  onlPushRoomUpdate();
}

// Cualquier cambio de ajuste del anfitrión se difunde solo (los selectores existentes siguen funcionando igual)
["selectBudget", "selectBotLevel", "selectBotOffers", "selectTrollMode", "selectMarket", "selectFreeMarket",
 "selectLegs", "selectFinalLegs", "selectLegsAll", "selectLegsLeagueOnly", "selectComp", "selectBid", "selectClock", "selectSkip", "selectPass"]
  .forEach(name => {
    const orig = window[name];
    if (typeof orig !== "function") return;
    window[name] = function () {
      const r = orig.apply(this, arguments);
      if (ONL.role === "host" && ONL.active) onlPushRoomUpdate();
      return r;
    };
  });

const _onlRoomRenderBase = onlRoomRender;
onlRoomRender = function () {
  const r = _onlRoomRenderBase.apply(this, arguments);
  if (ONL.active && ONL.role === "host") onlPushRoomUpdate();
  return r;
};

/* =========================================================
   3) ANFITRIÓN: Crear y controlar la sala
========================================================= */
function onlineConfigSubmit() {
  if (ONL.stage !== "config") return false;
  const b = $o("startDraftBtn");
  b.disabled = true;
  b.textContent = "Creando sala…";

  ensureSocket((socket) => {
    if (!socket) {
      b.disabled = false;
      refreshStartBtn();
      if (typeof location !== "undefined" && location.hostname && location.hostname.endsWith("github.io") && !getSocketServerUrl()) {
        onlToast("En GitHub Pages necesitás configurar la URL de tu backend en Render.", 4500);
      } else {
        onlToast("Error de conexión al servidor. Si está alojado en Render, puede tardar unos segundos en despertar. Reintentando...", 4500);
      }
      return;
    }

    socket.emit("create_room", {
      club: ONL.club,
      game: state.game,
      min: ONL.cfg.min,
      max: ONL.cfg.max,
      champions: !!state.champions,
      lines: onlCfgLines()
    }, (res) => {
      b.disabled = false;
      refreshStartBtn();
      if (!res || !res.ok) {
        onlToast("No se pudo crear la sala: " + (res ? res.error : "Sin respuesta del servidor."));
        return;
      }
      ONL.active = true;
      ONL.role = "host";
      ONL.code = res.code;
      ONL.started = false;
      ONL._closing = false;
      ONL.myId = 0;
      ONL.lobby = res.room;
      ONL.players = res.room.players;
      ONL.stage = "lobby";
      onlineLeaveConfig();
      document.body.classList.add("onl-on");
      onlRenderLobby();
      onlShow("onl-lobby");
    });
  });
  return true;
}

function onlStartValid(n) {
  if (n < ONL.cfg.min || n > ONL.cfg.max) return false;
  if (state.champions && (n < 8 || n % 4 !== 0)) return false;
  return true;
}

$o("onlStart").addEventListener("click", () => {
  if (ONL.role !== "host" || ONL.started) return;
  const alive = (ONL.lobby && ONL.lobby.players) ? ONL.lobby.players.filter(p => p.connected) : [];
  if (!onlStartValid(alive.length)) {
    onlRenderLobby();
    return;
  }

  ensureSocket((socket) => {
    if (!socket) return;
    socket.emit("start_game", { code: ONL.code }, (res) => {
      if (!res || !res.ok) {
        onlToast(res ? res.error : "Error al iniciar partida.");
        return;
      }
      ONL.started = true;
      ONL_ELIM.gen++;
      onlElimHide();
      state.mode = "local";
      state.numTeams = alive.length;

      onlApplyMine();
      onlRenderChip();
      ONL.lastHtml = "";

      // Transmisión optimizada periódica y ante cambios
      clearInterval(ONL.timer);
      ONL.timer = setInterval(onlBroadcastFrame, 160);

      startDraftFromSettings(alive.map(p => p.name));
      setTimeout(onlBroadcastFrame, 50);
    });
  });
});

/* Captura optimizada de pantalla (sólo la pantalla activa + modales abiertos) */
function onlSnapshot(elim, scrOverride) {
  const scr = scrOverride || document.querySelector(".screen.active");
  if (!scr) return "";

  const cloneScr = scr.cloneNode(true);
  cloneScr.querySelectorAll("script, #onlineUI").forEach(n => n.remove());

  // Estado de UI LOCAL del anfitrión: no viaja (tabla visible/oculta, jornada que está mirando).
  // Cada cliente lo resuelve solo; el cuadro que se transmite es siempre el mismo para todos.
  const lay = cloneScr.querySelector("#leagueLayout");
  if (lay) {
    lay.classList.remove("side-hidden");
    const h = lay.querySelector("#sideHandle");
    if (h) h.textContent = "Tabla ▸";
  }
  const mdBox = cloneScr.querySelector("#matchdayBox");
  if (mdBox) { mdBox.innerHTML = ""; mdBox.removeAttribute("class"); mdBox.removeAttribute("style"); }
  const mdL = cloneScr.querySelector("#mdLabel"); if (mdL) mdL.textContent = "";
  const mdT = cloneScr.querySelector("#mdTotal"); if (mdT) mdT.textContent = "";
  const mdNav = cloneScr.querySelector(".matchday-nav");
  if (mdNav) { // al final del contenedor: no corre los índices de los demás botones (las rutas de clic siguen válidas)
    const b = document.createElement("button");
    b.className = "btn sm"; b.id = "onlMdNow"; b.type = "button"; b.hidden = true;
    b.textContent = "⟲ Jornada actual";
    mdNav.appendChild(b);
  }

  let modalHtml = "";
  const squad = $o("squadModal");
  if (squad && squad.classList.contains("on")) {
    modalHtml += squad.outerHTML;
  }
  const conf = $o("confirmOverlay");
  if (conf && conf.classList.contains("on")) {
    modalHtml += conf.outerHTML;
  }

  // nodo oculto con los eliminados: cada invitado muestra su propio cartel (no se puede hacer clic en él)
  const elimHtml = elim ? `<div id="onlElimData" hidden data-d="${onlEsc(JSON.stringify(elim))}"></div>` : "";

  // nodo oculto con los planteles: cada invitado arma su propia plantilla en su pantalla ("Mi plantilla")
  const sq = onlSquadCompute();
  const squadHtml = sq ? `<div id="onlSquadData" hidden data-d="${onlEsc(JSON.stringify(sq))}"></div>` : "";

  // datos para que cada invitado navegue jornadas y festeje por su cuenta (nodo oculto #onlLocalData)
  const lc = onlLocalCompute();
  const localHtml = lc ? `<div id="onlLocalData" hidden data-d="${onlEsc(JSON.stringify(lc))}"></div>` : "";

  return `<div class="screen active" id="${scr.id}">${cloneScr.innerHTML}</div>${modalHtml}${elimHtml}${squadHtml}${localHtml}`;
}

/* Datos que el invitado usa para su UI local: historial de jornadas y campeón (para "Festejar de nuevo") */
function onlLocalCompute() {
  try {
    if (!state.teams || !state.teams.length) return null;
    const tm = {};
    state.teams.forEach(t => { tm[t.id] = [t.name, t.color]; });
    const fx = (state.fixture || []).map(md => md.map(m => [m.home, m.away, m.homeGoals, m.awayGoals, m.played ? 1 : 0, m.g === undefined ? -1 : m.g]));
    let live = fx.findIndex(md => md.some(m => !m[4]));
    if (live < 0) live = Math.max(0, fx.length - 1);
    let champ = null;
    const pf = state.playoffs;
    if (!liveRun) { // en pleno partido en vivo no se adelanta el campeón (spoiler)
      if (pf && pf.champion !== null && pf.champion !== undefined) champ = pf.champion;
      else if (state.comp === "league" && fx.length && fx.every(md => md.every(m => m[4]))) champ = standingsRows()[0].t.id;
    }
    return {
      tm, fx, live, champions: !!state.champions,
      champ: champ === null ? null : { id: champ, key: ONL_ELIM.gen + ":" + champ, lbl: compLabel() }
    };
  } catch (e) {
    return null;
  }
}

function onlSquadCompute() {
  try {
    if (!state.teams || !state.teams.length) return null;
    return {
      size: state.squadSize,
      teams: state.teams.map(t => ({
        id: t.id, n: t.name, c: t.color, r: t.roster.slice(),
        s: t.roster.filter(pid => isSusp(pid))
      }))
    };
  } catch (e) {
    return null;
  }
}

function onlBroadcastFrame() {
  if (!ONL.active || ONL.role !== "host" || !ONL.started) return;
  const elim = onlElimCompute();
  onlElimApply(elim); // el anfitrión también ve su propio cartel
  if (!ONL.socket || !ONL.socket.connected) return;
  const html = onlSnapshot(elim);
  // Si el anfitrión ya pasó a sorteo / eliminatorias, se manda también la liga: el invitado decide cuándo ir a verlas
  let league = "";
  const act = document.querySelector(".screen.active");
  const lg = $o("screen-league");
  if (act && lg && (act.id === "screen-playoffs" || act.id === "screen-draw") &&
      state.comp !== "cup" && state.fixture && state.fixture.length && lg.querySelector("#mdTotal") && lg.querySelector("#mdTotal").textContent !== "-") {
    league = onlSnapshot(elim, lg);
  }
  const sig = html + "\u0001" + league;
  if (sig === ONL.lastHtml) return;
  ONL.lastHtml = sig;
  ONL.socket.emit("host_sync", { html, league });
}

/* El invitado arma el camino del botón dentro de lo que recibió: [pantalla | ventanas abiertas, ...hijos].
   Acá se recorre la misma estructura que armó onlSnapshot (pantalla activa y ventanas abiertas). */
function onlResolvePath(path) {
  const roots = [];
  const scr = document.querySelector(".screen.active");
  if (scr) roots.push(scr);
  const squad = $o("squadModal");
  if (squad && squad.classList.contains("on")) roots.push(squad);
  const conf = $o("confirmOverlay");
  if (conf && conf.classList.contains("on")) roots.push(conf);
  let el = roots[path[0]];
  for (let k = 1; k < path.length && el; k++) el = el.children[path[k]];
  return el || null;
}

function onlAllowed(el, teamId) {
  const own = el.closest("[data-team]");
  if (own) return Number(own.dataset.team) === teamId;
  if (el.closest(ONL_LOCAL_ONLY)) return false;
  if (el.closest(ONL_HOST_ONLY)) return false;
  return true;
}

function onlHostAct(playerId, m) {
  if (!ONL.started) return;
  if (m.kind === "clockbuy") {
    const scr = $o("screen-mini");
    if (state.mini && scr && scr.classList.contains("active")) {
      miniBuy(playerId);
      setTimeout(onlBroadcastFrame, 30);
    }
    return;
  }

  if (!Array.isArray(m.path) || m.path.length > 40) return;
  const el = onlResolvePath(m.path);
  if (!el || el === document.body || !onlAllowed(el, playerId)) return;

  if (state.market && el.closest("#screen-market")) state.market.bidder = playerId;

  if (m.kind === "click") {
    if (typeof el.click === "function") el.click();
  } else if (m.kind === "set") {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) {
      el.value = String(m.value == null ? "" : m.value).slice(0, 200);
      el.dispatchEvent(new Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
    }
  } else if (m.kind === "key" && m.key === "Enter") {
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true, cancelable: true }));
  }

  setTimeout(onlBroadcastFrame, 40);
}

document.addEventListener("click", e => {
  if (ONL.active && ONL.role === "host" && ONL.started && e.isTrusted && state.market && e.target.closest && e.target.closest("#screen-market")) {
    state.market.bidder = ONL.myId;
  }
}, true);

function onlineBackToLobby() {
  onlElimHide();
  clearInterval(ONL.timer);
  ONL.timer = null;
  ONL.started = false;
  onlRenderChip();
  onlRenderLobby();
  onlShow("onl-lobby");
}

function onlineCloseRoom(reason) {
  if (!ONL.active || ONL._closing) return;
  ONL._closing = true;
  onlElimHide();
  clearInterval(ONL.timer);
  ONL.timer = null;

  if (ONL.socket && ONL.socket.connected) {
    ONL.socket.emit("leave_room");
  }

  ONL.active = false;
  ONL.started = false;
  ONL.stage = null;
  ONL.players = [];
  ONL.code = null;
  document.body.classList.remove("onl-on");
  onlRenderChip();
  onlApplyMine();
  ONL._closing = false;
}

/* =========================================================
   4) INVITADO: Unirse y jugar en vivo
========================================================= */
function onlJoinGo() {
  const code = $o("onlCode").value.trim().toUpperCase();
  if (code.length !== 6) {
    onlMsg("onlJoinMsg", "El código tiene 6 letras o números.", true);
    return;
  }

  const btn = $o("onlJoinGo");
  btn.disabled = true;
  onlMsg("onlJoinMsg", "Conectando a la sala…");

  ensureSocket((socket) => {
    if (!socket) {
      btn.disabled = false;
      if (typeof location !== "undefined" && location.hostname && location.hostname.endsWith("github.io") && !getSocketServerUrl()) {
        onlMsg("onlJoinMsg", "En GitHub Pages necesitás configurar el servidor backend.", true);
      } else {
        onlMsg("onlJoinMsg", "No se pudo conectar al servidor. Si está en Render, puede tardar unos segundos en despertar.", true);
      }
      return;
    }

    socket.emit("join_room", { code, club: ONL.club }, (res) => {
      btn.disabled = false;
      if (!res || !res.ok) {
        onlMsg("onlJoinMsg", res ? res.error : "No se pudo entrar a la sala.", true);
        return;
      }
      ONL.active = true;
      ONL.role = "guest";
      ONL.code = code;
      ONL.myId = res.youId;
      ONL.started = false;
      ONL._closing = false;
      ONL.lobby = res.room;
      ONL.players = res.room.players;
      document.body.classList.add("onl-on");
      onlRenderLobby();
      onlShow("onl-lobby");
      onlMsg("onlJoinMsg", "");
    });
  });
}

function onlGuestClosed(reason) {
  if (ONL._closing || ONL.role !== "guest" || !ONL.active) return;
  ONL._closing = true;
  onlToast(reason, 2500);
  setTimeout(() => location.reload(), 1800);
}

function onlEnterMirror() {
  ONL.mirrorOn = true;
  ONL_VIEW.frame = null; ONL_VIEW.pinLeague = false; ONL_VIEW.shown = null;
  document.body.classList.add("onl-guest");
  let root = $o("mirrorRoot");
  if (!root) {
    root = document.createElement("div");
    root.id = "mirrorRoot";
    document.body.insertBefore(root, document.body.firstChild);
  }
  root.textContent = "";
  onlApplyMine();
  onlRenderChip();
}

function onlLeaveMirror() {
  onlElimHide();
  ONL_SQ.data = null; ONL_SQ.team = null;
  ONL_SIDE.mine = null;
  ONL_LOCAL.data = null; ONL_LOCAL.mdMine = null; ONL_LOCAL.champSeen.clear();
  ONL_VIEW.frame = null; ONL_VIEW.pinLeague = false; ONL_VIEW.shown = null;
  try { const m = $o("squadModal"); if (m) m.classList.remove("open", "closing"); } catch (e) {}
  ONL.mirrorOn = false;
  ONL.started = false;
  document.body.classList.remove("onl-guest");
  const root = $o("mirrorRoot");
  if (root) root.textContent = "";
  onlRenderChip();
}

function onlCleanNode(n) {
  if (n.nodeType !== 1) return;
  n.removeAttribute("onclick");
  Array.from(n.attributes || []).forEach(a => { if (/^on/i.test(a.name)) n.removeAttribute(a.name); });
  n.querySelectorAll("*").forEach(x => Array.from(x.attributes).forEach(a => { if (/^on/i.test(a.name)) x.removeAttribute(a.name); }));
}

function onlSyncAttrs(f, t) {
  Array.from(f.attributes).forEach(a => { if (!t.hasAttribute(a.name)) f.removeAttribute(a.name); });
  Array.from(t.attributes).forEach(a => {
    if (/^on/i.test(a.name)) return;
    if (f.getAttribute(a.name) !== a.value) f.setAttribute(a.name, a.value);
  });
  if (f.nodeName === "OPTION") f.selected = t.hasAttribute("selected");
}

function onlMorph(from, to) {
  const tc = to.childNodes;
  for (let i = 0; i < tc.length; i++) {
    const t = tc[i], f = from.childNodes[i];
    if (!f) {
      const c = t.cloneNode(true);
      onlCleanNode(c);
      from.appendChild(c);
      continue;
    }
    if (f.nodeType !== t.nodeType || f.nodeName !== t.nodeName) {
      const c = t.cloneNode(true);
      onlCleanNode(c);
      from.replaceChild(c, f);
      continue;
    }
    if (t.nodeType !== 1) {
      if (f.nodeValue !== t.nodeValue) f.nodeValue = t.nodeValue;
      continue;
    }
    onlSyncAttrs(f, t);
    if (f.nodeName === "SELECT" && document.activeElement === f) continue;
    onlMorph(f, t);
  }
  while (from.childNodes.length > tc.length) from.removeChild(from.lastChild);
}

/* Pantalla propia del invitado: no lo arrastra el anfitrión de la liga a las eliminatorias.
   - Si estaba mirando la liga y el anfitrión pasa a sorteo / eliminatorias, se queda en la liga ("pinLeague").
   - "Ir a la fase eliminatoria" lo lleva a lo que el anfitrión tenga en pantalla (si está simulando, lo ve en vivo).
   - "Ver tablas de la liga" (desde las eliminatorias) lo vuelve a fijar en la liga. */
const ONL_VIEW = { frame: null, pinLeague: false, shown: null };

function onlFrameScreenId(html) {
  const m = /^<div class="screen active" id="([^"]+)"/.exec(html || "");
  return m ? m[1] : null;
}

function onlGuestFrame(data) {
  const V = ONL_VIEW;
  const hostScr = onlFrameScreenId(data.html);
  if (!V.pinLeague && data.league && V.shown === "screen-league" && hostScr !== "screen-league") {
    V.pinLeague = true;
    onlToast("El anfitrión pasó a la fase eliminatoria. Tocá «Ir a la fase eliminatoria» cuando quieras verla.", 3500);
  }
  if (V.pinLeague && !data.league) V.pinLeague = false; // el anfitrión volvió a la liga: se vuelve a seguirlo
  V.frame = data;
  onlGuestRender();
}

function onlGuestRender() {
  const V = ONL_VIEW, d = V.frame;
  if (!d) return;
  const html = (V.pinLeague && d.league) ? d.league : d.html;
  V.shown = onlFrameScreenId(html);
  onlApplyFrame(html);
  if (V.pinLeague) { // el botón siempre habilitado: es local
    const root = $o("mirrorRoot");
    const gb = root && root.querySelector("#goPlayoffsBtn");
    if (gb) { gb.disabled = false; gb.textContent = "Ir a la fase eliminatoria →"; }
    const row = root && root.querySelector("#goPlayoffsRow");
    if (row) row.style.display = "";
  }
}

function onlGuestGoPlayoffs() {
  if (ONL_VIEW.pinLeague) { ONL_VIEW.pinLeague = false; onlGuestRender(); window.scrollTo(0, 0); return; }
  onlToast("El anfitrión todavía no pasó a la fase eliminatoria.", 2200);
}

function onlGuestViewLeague() {
  if (ONL_VIEW.frame && ONL_VIEW.frame.league) { ONL_VIEW.pinLeague = true; onlGuestRender(); window.scrollTo(0, 0); }
}

function onlApplyFrame(html) {
  const root = $o("mirrorRoot");
  if (!root) return;
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  onlMorph(root, tpl.content);
  onlElimFromMirror(root);
  onlSquadFromMirror(root);
  onlSideFromMirror(root);
  onlLocalFromMirror(root);
}

function onlPathOf(el, root) {
  const p = [];
  while (el && el !== root) {
    const par = el.parentElement;
    if (!par) return null;
    p.unshift(Array.prototype.indexOf.call(par.children, el));
    el = par;
  }
  return p;
}

let _onlSetT = null, _onlPendingSet = null, _onlPD = null;
function onlFlushSet() {
  clearTimeout(_onlSetT);
  if (_onlPendingSet && ONL.socket) {
    ONL.socket.emit("player_action", _onlPendingSet);
    _onlPendingSet = null;
  }
}

function onlInMirror(t) {
  const r = $o("mirrorRoot");
  return ONL.mirrorOn && r && t && t.nodeType === 1 && r.contains(t);
}

/* Tabla de posiciones (barra lateral de la liga): estado de UI 100% LOCAL.
   Cada cliente (anfitrión e invitados) la muestra/oculta a su gusto; nada de esto viaja por red
   y un cambio del anfitrión ya no pisa a los invitados (el snapshot sale siempre sin "side-hidden"). */
const ONL_SIDE = { mine: null, animT: null };

function onlSideSet(root, hidden, animate) {
  const lay = root && root.querySelector("#leagueLayout");
  if (!lay) return;
  if (animate) {
    document.documentElement.classList.add("side-anim");
    clearTimeout(ONL_SIDE.animT);
    ONL_SIDE.animT = setTimeout(() => document.documentElement.classList.remove("side-anim"), 400);
  }
  lay.classList.toggle("side-hidden", hidden);
  const h = lay.querySelector("#sideHandle");
  if (h) h.textContent = hidden ? "◂ Tabla" : "Tabla ▸";
}

function onlSideFromMirror(root) {
  if (!root || !root.querySelector("#leagueLayout")) return;
  // primera vez: en pantallas angostas arranca oculta, igual que en el modo local
  if (ONL_SIDE.mine === null) ONL_SIDE.mine = window.innerWidth <= 1100;
  onlSideSet(root, ONL_SIDE.mine, false); // se reaplica en cada frame: el morph la pisaría
}

function onlGuestToggleSide() {
  const root = $o("mirrorRoot");
  const lay = root && root.querySelector("#leagueLayout");
  if (!lay) return;
  ONL_SIDE.mine = !lay.classList.contains("side-hidden");
  onlSideSet(root, ONL_SIDE.mine, true);
}

/* =========================================================
   UI LOCAL DEL INVITADO: navegación de jornadas y festejo
   (el anfitrión usa sus propios botones; el poder de SIMULAR sigue siendo solo suyo)
========================================================= */
const ONL_LOCAL = { data: null, mdMine: null, champSeen: new Set(), champTimer: null };

function onlLocalFromMirror(root) {
  const el = root && root.querySelector("#onlLocalData");
  let d = null;
  if (el) { try { d = JSON.parse(el.getAttribute("data-d")); } catch (e) {} }
  ONL_LOCAL.data = d;
  onlMdRender(root);
  onlChampAuto(d && d.champ);
}

function onlMdCurrent() {
  const d = ONL_LOCAL.data;
  if (!d || !d.fx.length) return -1;
  return ONL_LOCAL.mdMine === null ? d.live : Math.min(Math.max(ONL_LOCAL.mdMine, 0), d.fx.length - 1);
}

function onlMdRender(root) {
  const d = ONL_LOCAL.data;
  const box = root && root.querySelector("#matchdayBox");
  if (!d || !box) return;
  const cur = onlMdCurrent();
  if (cur < 0) return;
  root.querySelector("#mdLabel").textContent = cur + 1;
  root.querySelector("#mdTotal").textContent = d.fx.length;
  const md = d.fx[cur].map(r => ({ home: r[0], away: r[1], homeGoals: r[2], awayGoals: r[3], played: !!r[4], g: r[5] < 0 ? undefined : r[5] }));
  renderMatchdayBox(box, md, id => ({ id, name: d.tm[id][0], color: d.tm[id][1] }), d.champions);
  const prev = root.querySelector("#prevMd"), next = root.querySelector("#nextMd"), now = root.querySelector("#onlMdNow");
  if (prev) prev.disabled = cur <= 0;
  if (next) next.disabled = cur >= d.fx.length - 1;
  if (now) now.hidden = cur === d.live;
}

function onlMdStep(delta) {
  const d = ONL_LOCAL.data;
  if (!d) return;
  const cur = onlMdCurrent();
  const n = Math.min(Math.max(cur + delta, 0), d.fx.length - 1);
  ONL_LOCAL.mdMine = n === d.live ? null : n; // volver a la jornada en juego = volver a "seguir al anfitrión"
  onlMdRender($o("mirrorRoot"));
}

function onlMdNow() {
  ONL_LOCAL.mdMine = null;
  onlMdRender($o("mirrorRoot"));
}

/* Festejo local: lo dispara cada cliente con sus propios datos (nada se emite) */
function onlChampTeam() {
  const c = ONL_LOCAL.data && ONL_LOCAL.data.champ;
  const sq = ONL_SQ.data;
  const t = c && sq && sq.teams.find(x => x.id === c.id);
  return t ? { id: t.id, name: t.n, color: t.c, roster: t.r.slice() } : null;
}

function onlGuestCelebrate() {
  const c = ONL_LOCAL.data && ONL_LOCAL.data.champ;
  const team = onlChampTeam();
  if (!c || !team) return;
  showCelebration(team.id, { team, label: c.lbl, local: true });
}

function onlChampAuto(c) {
  if (!c || ONL.role !== "guest" || ONL_LOCAL.champSeen.has(c.key)) return;
  ONL_LOCAL.champSeen.add(c.key);
  clearTimeout(ONL_LOCAL.champTimer);
  ONL_LOCAL.champTimer = setTimeout(() => {
    if (ONL_ELIM.shown || ONL_ELIM.pend) return; // si quedaste eliminado, primero va tu cartel
    onlGuestCelebrate();
  }, 1800);
}

/* "Ver mensaje" de descenso: lo resuelve el invitado con su propio cartel */
function onlGuestRelegation() {
  const d = ONL_ELIM.data;
  const m = d && d.list.find(x => x.id === ONL.myId && /:rel:/.test(x.key));
  if (!m) { onlToast("Tu club no descendió."); return; }
  onlElimHide();
  ONL_ELIM.shown = { key: m.key, tick: d.tick };
  onlElimShow(m);
}

function onlGuestClick(el) {
  const root = $o("mirrorRoot");
  if (el.closest("#sideHandle")) { onlGuestToggleSide(); return; }
  if (el.closest("#goPlayoffsBtn")) { onlGuestGoPlayoffs(); return; }
  if (el.closest("#viewLeagueBtn")) { onlGuestViewLeague(); return; }
  if (el.closest("#prevMd")) { onlMdStep(-1); return; }
  if (el.closest("#nextMd")) { onlMdStep(1); return; }
  if (el.closest("#onlMdNow")) { onlMdNow(); return; }
  if (el.closest("#celAgainBtn,#celLeagueBtn")) { onlGuestCelebrate(); return; }
  if (el.closest("#relMsgBtn")) { onlGuestRelegation(); return; }
  if (el.closest("#themeToggle")) {
    const cur = document.documentElement.getAttribute("data-theme");
    if (typeof applyTheme === "function") applyTheme(cur === "light" ? "dark" : "light", true);
    return;
  }
  if (el.closest("#sfxToggle")) return;
  if (el.closest(".squad-btn")) { onlGuestOpenSquad(); return; }

  if (ONL_VIEW.pinLeague) return; // mirando la liga por su cuenta: las rutas de clic serían las de otra pantalla
  const path = onlPathOf(el, root);
  if (!path) return;
  onlFlushSet();
  if (ONL.socket) {
    ONL.socket.emit("player_action", { kind: "click", path });
  }
  if (el.closest(".bid-go")) {
    const row = el.closest("[data-team]");
    if (row) row.querySelectorAll("input").forEach(i => { i.value = ""; });
  }
}

document.addEventListener("pointerdown", e => {
  if (!onlInMirror(e.target)) return;
  const b = e.target.closest(".clock-btn");
  if (b) {
    e.preventDefault();
    _onlPD = { el: b, t: performance.now() };
    onlGuestClick(b);
  }
}, true);

document.addEventListener("click", e => {
  if (!onlInMirror(e.target)) return;
  // campos de texto y selectores: que el navegador los maneje solo (en el celular abren teclado / lista)
  if (e.target.closest && e.target.closest("input,select,textarea,label")) return;
  e.preventDefault();
  e.stopPropagation();
  if (_onlPD && performance.now() - _onlPD.t < 700 && e.target.closest(".clock-btn")) {
    _onlPD = null;
    return;
  }
  onlGuestClick(e.target);
}, true);

document.addEventListener("input", e => {
  const t = e.target;
  if (!onlInMirror(t) || !/^(INPUT|TEXTAREA)$/.test(t.tagName)) return;
  const path = onlPathOf(t, $o("mirrorRoot"));
  if (!path) return;
  _onlPendingSet = { kind: "set", path, value: t.value };
  clearTimeout(_onlSetT);
  _onlSetT = setTimeout(onlFlushSet, 80);
}, true);

document.addEventListener("change", e => {
  const t = e.target;
  if (!onlInMirror(t) || t.tagName !== "SELECT") return;
  const path = onlPathOf(t, $o("mirrorRoot"));
  if (!path) return;
  onlFlushSet();
  if (ONL.socket) {
    ONL.socket.emit("player_action", { kind: "set", path, value: t.value });
  }
}, true);

document.addEventListener("keydown", e => {
  if (!ONL.mirrorOn || ONL.role !== "guest") return;
  const t = e.target;
  if (onlInMirror(t) && t.tagName === "INPUT" && e.key === "Enter") {
    const path = onlPathOf(t, $o("mirrorRoot"));
    if (!path) return;
    e.preventDefault();
    onlFlushSet();
    if (ONL.socket) {
      ONL.socket.emit("player_action", { kind: "key", key: "Enter", path });
    }
    const row = t.closest("[data-team]");
    if (row) row.querySelectorAll("input").forEach(i => { i.value = ""; });
    return;
  }
  if (e.code === "Space" && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && !/^(INPUT|TEXTAREA|SELECT)$/.test((t && t.tagName) || "") && $o("mirrorRoot").querySelector("#screen-mini.active .clock-btn")) {
    e.preventDefault();
    if (ONL.socket) {
      ONL.socket.emit("player_action", { kind: "clockbuy" });
    }
  }
}, true);


/* =========================================================
   CARTEL DE ELIMINADO (todos los jugadores)
   - El anfitrión calcula quién quedó afuera y lo manda dentro de la pantalla (nodo oculto #onlElimData).
   - Cada jugador (anfitrión e invitados) muestra solo el cartel de su propio club.
   - El cartel se cierra solo cuando empieza el siguiente partido / ronda (cambia el "tick").
========================================================= */
const ONL_ELIM = { gen: 0, data: null, seen: new Set(), shown: null, pend: null, timer: null };

function onlElimCompute() {
  try {
    if (!state.teams || !state.teams.length) return null;
    const pf = state.playoffs;
    let played = 0;
    (state.fixture || []).forEach(md => md.forEach(m => { if (m.played) played++; }));
    if (pf) pf.rounds.forEach(r => (r.ties || []).forEach(t => t.legs.forEach(l => { if (l.played) played++; })));
    // mientras se juega una ronda en vivo no se muestra nada (sería un spoiler); el tick cambia al empezar y al terminar
    const tick = played + (liveRun ? 100000 : 0);
    const out = { g: ONL_ELIM.gen, tick, list: [] };
    if (liveRun) return out;

    const tm = id => state.teams.find(t => t.id === id);
    const add = (id, key, o) => {
      const t = tm(id); if (!t) return;
      out.list.push(Object.assign({ id, key: ONL_ELIM.gen + ":" + key + ":" + id, name: t.name, color: t.color, icon: "😢", kicker: "Quedaste", title: "ELIMINADO" }, o));
    };

    // 1) eliminatorias: perdió un cruce
    if (pf) {
      pf.rounds.forEach(r => (r.ties || []).forEach(tie => {
        if (!tie.played || tie.winner === null || tie.winner === undefined) return;
        const loser = tie.home === tie.winner ? tie.away : tie.home;
        const opp = tm(tie.winner);
        let ttl = r.teamsInRound ? titleForTeams(r.teamsInRound).toLowerCase() : "";
        if (ttl === "final") ttl = "la final";
        add(loser, "po", { rest: "cayó ante " + (opp ? opp.name : "su rival") + (ttl ? " en " + ttl : "") + "." });
      }));
    }

    const allLeague = state.fixture && state.fixture.length > 0 && state.fixture.every(md => md.every(m => m.played));
    const anyLeague = state.fixture && state.fixture.some(md => md.some(m => m.played));

    // 2) Copa de la liga / Champions: ya no puede clasificar a la fase eliminatoria
    if (state.comp === "leaguecup" && !state.skipLeague && anyLeague) {
      const rows = standingsRows();
      const outSet = state.champions ? champOutSet() : computeEliminated(rows, qualifiersFor(rows.length));
      outSet.forEach(id => add(id, "lg", { rest: allLeague ? "quedó afuera de la fase eliminatoria." : "ya no puede clasificar a la fase eliminatoria." }));
    }

    // 3) Liga: descenso al terminar
    if (state.comp === "league" && allLeague) {
      const rows = standingsRows();
      const D = relegationCount(rows.length);
      if (D > 0) {
        const first = rows.length - D;
        rows.slice(first).forEach((r, k) => add(r.t.id, "rel", { icon: "😭", kicker: "Terminaste " + (first + k + 1) + "° y", title: "DESCENDISTE", sadder: true, rest: "pierde la categoría.", extra: "Una temporada para olvidar... ya habrá revancha." }));
      }
    }
    return out;
  } catch (e) {
    return null;
  }
}

function onlElimHide() {
  const E = ONL_ELIM;
  clearTimeout(E.timer);
  E.pend = null;
  E.shown = null;
  const ov = $o("onlElim");
  if (ov) { ov.classList.remove("show", "sad", "sadder"); ov.innerHTML = ""; }
  if (typeof confettiAnim !== "undefined" && confettiAnim) { cancelAnimationFrame(confettiAnim); confettiAnim = null; }
  if (typeof confettiCleanup !== "undefined" && confettiCleanup) { confettiCleanup(); confettiCleanup = null; }
}

function onlElimShow(e) {
  let ov = $o("onlElim");
  if (!ov) {
    ov = document.createElement("div");
    ov.id = "onlElim";
    $o("onlineUI").appendChild(ov);
  }
  ov.className = "celebrate show sad" + (e.sadder ? " sadder" : "");
  ov.innerHTML =
    `<canvas id="onlElimCanvas"></canvas><div class="cel-card">` +
    `<div class="cel-trophy">${onlEsc(e.icon || "😢")}</div>` +
    `<div class="cel-kicker">${onlEsc(e.kicker || "Quedaste")}</div>` +
    `<div class="cel-name">${onlEsc(e.title || "ELIMINADO")}</div>` +
    `<div class="sad-sub"><b style="color:${onlEsc(e.color || "inherit")}">${onlEsc(e.name || "")}</b> ${onlEsc(e.rest || "")}</div>` +
    (e.extra ? `<div class="sad-extra">${onlEsc(e.extra)}</div>` : "") +
    `<div class="btn-row sad-actions"><button class="btn gold" id="onlElimClose" type="button">Seguir viendo el torneo</button></div>` +
    `</div>`;
  $o("onlElimClose").addEventListener("click", onlElimHide);
  try { startRain($o("onlElimCanvas"), !!e.sadder); } catch (err) {}
  try { if (window.chiquiSfx) window.chiquiSfx.play("penMiss"); } catch (err) {}
}

function onlElimApply(data) {
  const E = ONL_ELIM;
  E.data = data;
  if (!data || !ONL.active) { if (E.shown || E.pend) onlElimHide(); return; }
  if (data.g !== undefined && E.gen !== data.g && ONL.role === "guest") E.gen = data.g;

  // arrancó el siguiente partido / ronda: el cartel se cierra solo
  if (E.shown && E.shown.tick !== data.tick) onlElimHide();
  // si llegó a cambiar el tick antes de mostrarse, ya no tiene sentido mostrarlo
  if (E.pend && E.pend.tick !== data.tick) { E.seen.add(E.pend.key); clearTimeout(E.timer); E.pend = null; }
  if (E.shown || E.pend) return;

  const mine = data.list.find(x => x.id === ONL.myId && !E.seen.has(x.key));
  if (!mine) return;
  E.pend = { key: mine.key, tick: data.tick };
  E.timer = setTimeout(() => {
    const p = E.pend;
    E.pend = null;
    if (!p) return;
    const d = E.data;
    const m = d && d.tick === p.tick ? d.list.find(x => x.key === p.key) : null;
    E.seen.add(p.key);
    if (!m) return;
    E.shown = { key: m.key, tick: p.tick };
    onlElimShow(m);
  }, 1300); // un instante para ver el resultado antes del cartel
}

function onlElimFromMirror(root) {
  const el = root && root.querySelector("#onlElimData");
  if (!el) { onlElimApply(null); return; }
  let d = null;
  try { d = JSON.parse(el.getAttribute("data-d")); } catch (e) {}
  onlElimApply(d);
}


/* =========================================================
   MI PLANTILLA (invitados)
   El anfitrión manda los planteles dentro de la pantalla (nodo oculto #onlSquadData).
   El invitado abre su propia plantilla en su celular, sin tocar la pantalla de los demás.
   El anfitrión usa directamente la misma ventana del modo de un jugador (js/plantillas.js).
========================================================= */
const ONL_SQ = { data: null, team: null, key: "" };

function onlSquadFromMirror(root) {
  const el = root && root.querySelector("#onlSquadData");
  let d = null;
  if (el) { try { d = JSON.parse(el.getAttribute("data-d")); } catch (e) {} }
  ONL_SQ.data = d;
  const modal = $o("squadModal");
  if (!d || !modal || !modal.classList.contains("open")) return;
  onlSquadBuild();
  const key = ONL_SQ.team ? ONL_SQ.team.roster.join(",") + "|" + ONL_SQ.team.suspSet.size : "";
  if (ONL_SQ.team && key !== ONL_SQ.key) { ONL_SQ.key = key; showSquadTeam(ONL_SQ.team.id, ONL_SQ.team); }
}

// arma (o actualiza) el plantel propio conservando la formación y las posiciones que el jugador movió
function onlSquadBuild() {
  const d = ONL_SQ.data;
  const mine = d && d.teams.find(t => t.id === ONL.myId);
  if (!mine) return null;
  if (!ONL_SQ.team || ONL_SQ.team.id !== mine.id) {
    ONL_SQ.team = { id: mine.id, viewFormation: null, viewLayout: null };
    ONL_SQ.key = "";
  }
  const t = ONL_SQ.team;
  t.name = mine.n; t.color = mine.c; t.roster = mine.r.slice();
  t.suspSet = new Set(mine.s || []); t.squadSize = d.size;
  return t;
}

function onlGuestOpenSquad() {
  const t = onlSquadBuild();
  if (!t) { onlToast("Todavía no tenés jugadores en tu plantilla."); return; }
  const modal = $o("squadModal");
  clearTimeout(_squadT);
  modal.classList.remove("closing");
  modal.classList.add("open");
  ONL_SQ.key = t.roster.join(",") + "|" + t.suspSet.size;
  showSquadTeam(t.id, t);
}

/* =========================================================
   5) SALA DE ESPERA, CHIP DE ESTADO Y SALIDA
========================================================= */
function onlRenderLobby() {
  const L = ONL.lobby;
  if (!L) return;
  const host = (ONL.role === "host");

  $o("onlLobbyTitle").textContent = (ONL_GAMES[L.game] || "Sala") + " · Sala de espera";
  $o("onlLobbyCode").textContent = L.code;

  const k = $o("onlKind");
  k.classList.remove("warn");
  k.textContent = "🌐 Servidor en tiempo real (Socket.io) activo. Pasales el código a tus amigos.";

  $o("onlCfgList").innerHTML = (L.lines || []).map(x => "<li>" + onlEsc(x) + "</li>").join("");
  $o("onlPlayersTitle").textContent = `Jugadores (${L.players.length}/${L.max} · mínimo ${L.min})`;

  $o("onlPlayers").innerHTML = L.players.map((p, i) =>
    `<div class="onl-player${p.connected ? "" : " off"}"><span class="tag" style="background:${onlEsc(TEAM_COLORS[i % TEAM_COLORS.length])}">${i + 1}</span><span class="nm">${onlEsc(p.name)}</span>` +
    `${p.host ? '<span class="bd">Anfitrión</span>' : ""}${p.id === ONL.myId && !p.host ? '<span class="bd">Vos</span>' : ""}</div>`
  ).join("");

  const n = L.players.length;
  let msg = "", ok = true;
  if (n < L.min) {
    ok = false;
    msg = `Faltan ${L.min - n} jugador${L.min - n === 1 ? "" : "es"} para poder empezar.`;
  } else if (L.champions && (n < 8 || n % 4 !== 0)) {
    ok = false;
    msg = "Champions / Libertadores necesita 8, 12 o 16 equipos.";
  } else {
    msg = host ? "Listo: cuando quieras, empezá la partida." : "Esperando a que el anfitrión empiece la partida…";
  }

  onlMsg("onlLobbyMsg", msg, false);
  const st = $o("onlStart");
  st.style.display = host ? "" : "none";
  st.disabled = !ok;
  $o("onlLeave").textContent = host ? "🚪 Cerrar sala" : "🚪 Salir de la sala";
}

$o("onlCopy").addEventListener("click", () => {
  const c = ONL.code || "";
  const done = () => onlToast("Código copiado: " + c, 1800);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(c).then(done, () => onlToast("Código: " + c));
  } else {
    onlToast("Código: " + c);
  }
});

function onlLeaveRoom() {
  if (ONL.role === "guest") {
    if (ONL.socket) ONL.socket.emit("leave_room");
    ONL._closing = true;
    try { history.scrollRestoration = "manual"; } catch (e) {} // que al recargar no vuelva a la posición anterior
    window.scrollTo(0, 0);
    location.reload();
  } else {
    onlineCloseRoom("El anfitrión cerró la sala.");
    onlShow("onl-choice");
  }
}

$o("onlLeave").addEventListener("click", onlLeaveRoom);
$o("onlChipLeave").addEventListener("click", () => {
  if (ONL.role === "guest") {
    if (window.confirm("¿Volver al inicio? Salís de la sala.")) onlLeaveRoom();
    return;
  }
  // anfitrión: cierra la sala para todos y vuelve al inicio (backToMenu ya sube al principio de la página)
  askConfirm({ icon: "🏠", title: "¿Volver al inicio?", msg: "Se cierra la sala para todos los jugadores y se pierde el progreso de la partida." })
    .then(ok => { if (ok) { backToMenu(); window.scrollTo(0, 0); } });
});

window.addEventListener("beforeunload", () => {
  if (ONL.active && ONL.socket) {
    try { ONL.socket.emit("leave_room"); } catch (e) {}
  }
});

function onlRenderChip() {
  const chip = $o("onlChip");
  if (!chip) return;
  const show = ONL.active && ONL.started;
  chip.style.display = show ? "flex" : "none";
  if (!show) return;

  const L = (ONL.lobby && ONL.lobby.players) ? ONL.lobby.players : [];
  const off = L.filter(p => p.connected === false).map(p => p.name);
  $o("onlChipTxt").innerHTML = "🌐 Sala <b>" + onlEsc(ONL.code) + "</b> · " + L.length + " clubes" + (off.length ? ' · <span class="warn">⚠ ' + onlEsc(off.join(", ")) + ' desconectado</span>' : "");
  $o("onlChipLeave").style.display = "";
}

function onlApplyMine() {
  let st = $o("onlMineStyle");
  if (!ONL.active || !ONL.started) {
    if (st) st.remove();
    return;
  }
  if (!st) {
    st = document.createElement("style");
    st.id = "onlMineStyle";
    document.head.appendChild(st);
  }
  const n = Number(ONL.myId);
  st.textContent =
    `body.onl-on [data-team]:not([data-team="${n}"]), body.onl-on [data-team]:not([data-team="${n}"]) :is(button,input,select,textarea){pointer-events:none !important; opacity:.42;}` +
    `body.onl-on .bid-row[data-team="${n}"], body.onl-on .clock-btn[data-team="${n}"]{outline:2px solid var(--tc,#4ade80); outline-offset:2px; border-radius:10px;}`;
}

setInterval(() => {
  if (ONL.active && ONL.started && ONL.role === "host") onlRenderChip();
}, 2000);
