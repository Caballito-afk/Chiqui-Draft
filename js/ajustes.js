/* =========================================================
   PANTALLA DE AJUSTES
========================================================= */
const COMP_IDS=["league","cup","leaguecup","champions"];
document.getElementById("changeModeBtn").addEventListener("click",()=>{ showHomeMain(); goToScreen("home"); window.scrollTo(0,0); });
document.getElementById("opt-f11").addEventListener("click",()=>selectFormat(11));
document.getElementById("opt-f5").addEventListener("click",()=>selectFormat(5));
COMP_IDS.forEach(c=>document.getElementById("opt-comp-"+c).addEventListener("click",()=>selectComp(c)));
document.getElementById("opt-final-1").addEventListener("click",()=>selectFinalLegs(false));
document.getElementById("opt-final-2").addEventListener("click",()=>selectFinalLegs(true));
document.getElementById("opt-leg-1").addEventListener("click",()=>selectLegs(false));
document.getElementById("opt-leg-2").addEventListener("click",()=>selectLegs(true));
document.getElementById("opt-leg-3").addEventListener("click",()=>selectLegsAll());
document.getElementById("opt-leg-4").addEventListener("click",()=>selectLegsLeagueOnly());
document.getElementById("opt-mk-on").addEventListener("click",()=>selectMarket(true));
document.getElementById("opt-mk-off").addEventListener("click",()=>selectMarket(false));

function selectFormat(n){
  state.squadSize=n;
  document.getElementById("opt-f11").classList.toggle("sel",n===11);
  document.getElementById("opt-f5").classList.toggle("sel",n===5);
  refreshBudgetNote();
  if(typeof refreshCount==="function") refreshCount();
}
function squadSize(){ return state.squadSize; }
function isHumanIdx(i){ return state.mode==="ia" ? i===0 : true; }
const GAME_TEXT={
  "puja:ia":{t:"🔨 Puja · Un Jugador (Con Bots)", d:"Pujás contra bots por jugadores misteriosos."},
  "puja:local":{t:"🔨 Puja · Multijugador Local", d:"Puja libre entre amigos, sin turnos."},
  "random:ia":{t:"🎲 Aleatorio · Un Jugador (Con Bots)", d:"Plantel al azar; el resto son bots."},
  "random:local":{t:"🎲 Aleatorio · Multijugador Local", d:"Planteles al azar para cada amigo."},
  "reloj:ia":{t:"⏱️ El Reloj · Un Jugador (Con Bots)", d:"El precio baja en vivo: fichá con la barra espaciadora."},
  "reloj:local":{t:"⏱️ El Reloj · Multijugador Local", d:"Cada equipo tiene su tecla: el más rápido ficha."}
};
function startGameMode(game, mode){
  state.game=game; state.mode=mode;
  const info=GAME_TEXT[game+":"+mode];
  document.getElementById("modeBannerTitle").textContent=info.t;
  document.getElementById("modeBannerDesc").textContent=info.d;
  refreshStartBtn();
  renderTimeOptions();
  renderPassOptions();
  renderSkipOptions();
  renderTeamNameInputs();
  refreshBudgetNote();
  refreshBotOptions();
  goToScreen("settings");
  window.scrollTo(0,0);
}

/* ---- Menú de inicio ---- */
let homePending=null;
const HOME_SUB={
  puja:{t:"🔨 Puja", d:"Subasta con nombre, club y media ocultos. Ofertá, pasá o tirá el farol.", local:"Puja libre entre amigos, sin turnos."},
  random:{t:"🎲 Aleatorio", d:"Sin subasta: los jugadores se reparten al azar.", local:"Planteles al azar para cada amigo."},
  reloj:{t:"⏱️ El Reloj", d:"Subasta al revés: el precio baja en vivo y el primero en apretar ¡FICHAR! se lo queda.", local:"Cada equipo con su tecla. ¡Gana el más rápido!"}
};
const HOME_PANELS=["homeRoot","homeMain","homeSub"];
let homeAnimating=false;
function homeCurrent(){ return HOME_PANELS.find(id=>document.getElementById(id).style.display!=="none"); }
// dir: "down" (avanzar: los botones bajan y entran los siguientes) | "up" (volver) | null (sin animación)
function showHomePanel(target, dir){
  const cur=homeCurrent();
  const to=document.getElementById(target);
  const clean=el=>el.classList.remove("hp-out-down","hp-in-down","hp-out-up","hp-in-up");
  HOME_PANELS.forEach(id=>clean(document.getElementById(id)));
  const reduce=window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(!dir || reduce || !cur || cur===target){
    HOME_PANELS.forEach(id=>{ document.getElementById(id).style.display = id===target ? "" : "none"; });
    homeAnimating=false;
    return;
  }
  const from=document.getElementById(cur);
  homeAnimating=true;
  from.classList.add(dir==="down" ? "hp-out-down" : "hp-out-up");
  setTimeout(()=>{
    clean(from); from.style.display="none";
    to.style.display="";
    to.classList.add(dir==="down" ? "hp-in-down" : "hp-in-up");
    setTimeout(()=>{ clean(to); homeAnimating=false; }, 340);
  }, 250);
}
function showHomeRoot(animate){ homePending=null; showHomePanel("homeRoot", animate===true ? "up" : null); }
function showHomeMain(animate){
  homePending=null;
  const dir = animate===true ? (homeCurrent()==="homeRoot" ? "down" : "up") : null;
  showHomePanel("homeMain", dir);
}
document.getElementById("home-local").addEventListener("click",()=>{ if(!homeAnimating) showHomeMain(true); });
// "Multijugador": por ahora sin función (se agregará más adelante)
document.getElementById("homeMainBackBtn").addEventListener("click",()=>{ if(!homeAnimating) showHomeRoot(true); });
function openHomeSub(game){
  homePending=game;
  const inf=HOME_SUB[game];
  document.getElementById("homeSubTitle").textContent=inf.t;
  document.getElementById("homeSubDesc").textContent=inf.d;
  document.getElementById("homeSubLocalDesc").textContent=inf.local;
  showHomePanel("homeSub","down");
}
document.getElementById("home-puja").addEventListener("click",()=>{ if(!homeAnimating) openHomeSub("puja"); });
document.getElementById("home-reloj").addEventListener("click",()=>{ if(!homeAnimating) openHomeSub("reloj"); });
document.getElementById("home-random").addEventListener("click",()=>{ if(!homeAnimating) openHomeSub("random"); });
document.getElementById("home-sub-ia").addEventListener("click",()=>{ if(homePending) startGameMode(homePending,"ia"); });
document.getElementById("home-sub-local").addEventListener("click",()=>{ if(homePending) startGameMode(homePending,"local"); });
document.getElementById("homeBackBtn").addEventListener("click",()=>{ if(!homeAnimating) showHomeMain(true); });

let _legsBeforeChamp=null; // ida/vuelta elegidos antes de entrar a Champions, para devolverlos al salir
function selectComp(c){
  const wasChamp=state.champions;
  state.champions = c==="champions";
  state.comp = state.champions ? "leaguecup" : c;
  if(state.comp!=="leaguecup") state.leagueDouble=false;
  if(state.champions && !wasChamp){
    _legsBeforeChamp={doubleLeg:state.doubleLeg, leagueDouble:state.leagueDouble};
    state.leagueDouble=false;  // grupos a una vuelta
  }
  if(state.champions) state.doubleLeg=true;   // Champions / Libertadores: los playoffs son siempre de ida y vuelta
  if(!state.champions && wasChamp && _legsBeforeChamp){
    state.doubleLeg=_legsBeforeChamp.doubleLeg; state.leagueDouble = state.comp==="leaguecup" ? _legsBeforeChamp.leagueDouble : false;
    _legsBeforeChamp=null;
  }
  COMP_IDS.forEach(x=>document.getElementById("opt-comp-"+x).classList.toggle("sel",x===c));
  if(state.champions){ let n=Math.max(8,Math.round(state.numTeams/4)*4); const mx=maxTeamsAllowed(); while(n>mx && n>4) n-=4; state.numTeams=n; }
  document.getElementById("champBox").style.display = state.champions ? "" : "none";
  refreshChampCards();
  refreshLegCards(); updateSteps(); refreshCount();
}
function refreshChampCards(){
  const t=(id,on)=>document.getElementById(id).classList.toggle("sel",!!on);
  t("opt-grp-1",!state.leagueDouble); t("opt-grp-2",state.leagueDouble);
  t("opt-away-0",!state.awayGoals); t("opt-away-1",state.awayGoals);
  t("opt-et-1",state.champET); t("opt-et-0",!state.champET);
  const g=Math.floor(state.numTeams/4);
  document.getElementById("champNote").textContent = `${state.numTeams} equipos → ${g} grupo${g===1?"":"s"} de 4, ${state.leagueDouble?"a ida y vuelta (6 partidos por equipo)":"a una sola vuelta (3 partidos por equipo)"}. Clasifican los 2 primeros de cada grupo${champThirds(state.numTeams)?" + los "+champThirds(state.numTeams)+" mejores terceros":""} (${qualifiersFor(state.numTeams)}).`;
}
document.getElementById("opt-grp-1").addEventListener("click",()=>{ state.leagueDouble=false; refreshChampCards(); refreshCountNote(); });
document.getElementById("opt-grp-2").addEventListener("click",()=>{ state.leagueDouble=true; refreshChampCards(); refreshCountNote(); });
document.getElementById("opt-away-0").addEventListener("click",()=>{ state.awayGoals=false; refreshChampCards(); });
document.getElementById("opt-away-1").addEventListener("click",()=>{ state.awayGoals=true; refreshChampCards(); });
document.getElementById("opt-et-1").addEventListener("click",()=>{ state.champET=true; refreshChampCards(); });
document.getElementById("opt-et-0").addEventListener("click",()=>{ state.champET=false; refreshChampCards(); });
function selectLegs(d){
  if(state.champions) return; // en Champions los playoffs son siempre de ida y vuelta (la tarjeta está oculta)
  state.doubleLeg=d; state.leagueDouble=false;
  refreshLegCards();
}
function selectFinalLegs(d){
  state.finalDouble=d;
  refreshLegCards();
}
// ¿Esa ronda (por cantidad de equipos que quedan) se juega a ida y vuelta? La final (2 equipos) depende solo de "finalDouble".
function roundIsTwoLeg(teamsN){ return teamsN>2 ? state.doubleLeg : state.finalDouble; }
// Cancha neutral (sin ventaja de local):
// - la final a partido único, siempre (Copa y Copa de la liga);
// - en Copa, también todos los demás partidos únicos.
// En Copa de la liga el resto de los cruces mantiene la localía según la posición en la tabla de la liga.
function roundIsNeutral(round){ return !round.twoLeg && (state.comp==="cup" || round.teamsInRound<=2); }
function selectLegsAll(){
  state.doubleLeg=true; state.leagueDouble=true;
  refreshLegCards();
}
function selectLegsLeagueOnly(){
  state.doubleLeg=false; state.leagueDouble=true;
  refreshLegCards();
}
function refreshLegCards(){
  document.getElementById("legCard").style.display = state.champions ? "none" : "";
  const lc=state.comp==="leaguecup" && !state.champions;
  const ld=lc && state.leagueDouble;
  document.getElementById("opt-leg-3").style.display = lc ? "" : "none";
  document.getElementById("opt-leg-4").style.display = lc ? "" : "none";
  document.getElementById("leg2Title").textContent = lc ? "🔁 Ida y vuelta de copa" : "🔁 Ida y vuelta";
  const cmp=state.comp;
  document.getElementById("leg1Desc").textContent =
    cmp==="league" ? "Cada rival se enfrenta una vez." :
    cmp==="cup" ? "Cada cruce se juega una vez, en cancha neutral." :
    "Liga a una vuelta y eliminatorias a partido único.";
  document.getElementById("leg2Desc").textContent =
    lc ? "Liga a una vuelta; eliminatorias de ida y vuelta." :
    cmp==="league" ? "Cada rival se enfrenta dos veces." :
    "Cada cruce es de ida y vuelta.";
  document.getElementById("opt-leg-1").classList.toggle("sel",!state.doubleLeg && !ld);
  document.getElementById("opt-leg-2").classList.toggle("sel",state.doubleLeg && !ld);
  document.getElementById("opt-leg-3").classList.toggle("sel",state.doubleLeg && ld);
  document.getElementById("opt-leg-4").classList.toggle("sel",!state.doubleLeg && ld);
  // la final existe en Copa y Copa de la liga (en Liga pura no hay final)
  document.getElementById("finalLegCard").style.display = state.comp==="league" ? "none" : "";
    document.getElementById("opt-final-1").classList.toggle("sel",!state.finalDouble);
  document.getElementById("opt-final-2").classList.toggle("sel",state.finalDouble);
  updateLegNote();
  refreshCountNote();
}

/* ---- Presupuesto inicial ---- */
function selectBudget(v){
  state.startBudget=v;
  document.querySelectorAll("#budgetOptions .opt-card").forEach(c=>c.classList.toggle("sel",Number(c.dataset.budget)===v));
  refreshBudgetNote();
}
function refreshBudgetNote(){
  // Aleatorio sin mercado: la plata no se usa para nada, así que no se muestra la opción
  const bc=document.getElementById("budgetCard");
  if(bc) bc.style.display = (state.game==="random" && !state.useMarket) ? "none" : "";
  const v=state.startBudget, n=squadSize(), per=Math.round(v/n);
  const el=document.getElementById("budgetNote"); if(!el) return;
  if(state.game==="random"){
    el.textContent = state.useMarket ? "Solo se usa para pagar ofertas en el mercado." : "Sin mercado, no se usa en este modo.";
    return;
  }
  const feel = v<1000 ? "Ajustado: hay que elegir bien." : v===1000 ? "Estándar." : v===1500 ? "Holgado: sobra para el mercado." : "Sin aprietos.";
  el.textContent = `${feel} Unos ${fmtM(per)} por jugador.`;
}

document.querySelectorAll("#budgetOptions .opt-card").forEach(c=>c.addEventListener("click",()=>selectBudget(Number(c.dataset.budget))));
selectBudget(state.startBudget);

/* ---- Duración de la puja / del reloj ---- */
const BID_TIME_OPTS=[5,10,15,0]; // 0 = sin tiempo
const CLOCK_TIME_OPTS=[8,10,15];
function renderTimeOptions(){
  const card=document.getElementById("timeCard");
  if(state.game==="random"){ card.style.display="none"; return; }
  card.style.display="";
  const isClock=state.game==="reloj";
  const opts=isClock?CLOCK_TIME_OPTS:BID_TIME_OPTS;
  const cur=isClock?state.clockSecs:state.bidSecs;
  document.getElementById("timeLabel").textContent = isClock ? "Duración del reloj (tiempo que tarda el precio en bajar)" : "Duración de cada puja";
  const box=document.getElementById("timeOptions"); box.innerHTML="";
  opts.forEach(v=>{
    const d=document.createElement("div");
    d.className="opt-card"+(v===cur?" sel":""); d.dataset.secs=v;
    let title, hint;
    if(!isClock && v===0){
      title="♾️ Sin tiempo";
      hint = state.mode==="ia" ? "Pensás cuanto quieras" : "Cada uno se planta cuando quiere";
    } else {
      title=`⏱️ ${v}s`;
      hint = isClock ? ({8:"Cae rápido",10:"Equilibrado",15:"Cae lento"}[v])
                     : ({5:"Vertiginoso",10:"Normal",15:"Con calma"}[v]);
    }
    d.innerHTML=`<div class="t">${title}</div><div class="d">${hint||""}</div>`;
    d.addEventListener("click",()=>{ if(isClock) state.clockSecs=v; else state.bidSecs=v; renderTimeOptions(); });
    box.appendChild(d);
  });
  let note;
  if(isClock) note="Tiempo que tarda el precio en bajar: menos segundos, más rápido.";
  else if(state.bidSecs===0) note = state.mode==="ia"
      ? "Sin reloj: en tu turno decidís cuándo ofertar o pasar, sin apuro."
      : "Sin reloj: cada equipo oferta cuando quiere y se planta cuando no quiere seguir. La puja se cierra sola cuando todos los demás se plantaron.";
  else note = state.mode==="ia"
      ? "Tiempo para decidir en tu turno; si se acaba, pasás."
      : "Tiempo sin ofertas antes de cerrar la puja.";
  document.getElementById("timeNote").textContent = note;
}
/* ---- Un jugador (Puja y El Reloj): cuántas veces se puede usar "Pasar x10" ---- */
const SKIP_USE_OPTS=[null,10,5,3,1,0];
function renderSkipOptions(){
  const card=document.getElementById("skipCard");
  const show = state.mode==="ia" && (state.game==="puja" || state.game==="reloj");
  card.style.display = show ? "" : "none";
  if(!show) return;
  const box=document.getElementById("skipOptions"); box.innerHTML="";
  SKIP_USE_OPTS.forEach(v=>{
    const d=document.createElement("div");
    d.className="opt-card"+(v===state.skipUses?" sel":"");
    const title = v===null ? "♾️ Infinito" : v===0 ? "🚫 Ninguno" : `⏭ ${v}`;
    const hint  = v===null ? "Sin límite" : v===0 ? "Sin el botón" : (v===1 ? "vez" : "veces");
    d.innerHTML=`<div class="t">${title}</div><div class="d">${hint}</div>`;
    d.addEventListener("click",()=>{ state.skipUses=v; renderSkipOptions(); });
    box.appendChild(d);
  });
  document.getElementById("skipNote").textContent =
    state.skipUses===null ? "Podés usar \"Pasar x10\" todas las veces que quieras: tu equipo se saltea 10 jugadores y los bots fichan solos."
    : state.skipUses===0 ? "No hay botón \"Pasar x10\": tenés que decidir en cada jugador."
    : `Podés usar \"Pasar x10\" ${state.skipUses} ${state.skipUses===1?"vez":"veces"} en toda la partida (cada uso saltea 10 jugadores).`;
}
/* ---- Puja multijugador: cuántas veces puede cada equipo saltear (plantarse) ---- */
const PASS_LIMIT_OPTS=[null,30,15,10,5,3,0];
function renderPassOptions(){
  const card=document.getElementById("passCard");
  const show = state.game==="puja" && state.mode==="local";
  card.style.display = show ? "" : "none";
  if(!show) return;
  const box=document.getElementById("passOptions"); box.innerHTML="";
  PASS_LIMIT_OPTS.forEach(v=>{
    const d=document.createElement("div");
    d.className="opt-card"+(v===state.passLimit?" sel":"");
    const title = v===null ? "♾️ Infinitas" : v===0 ? "🚫 Ninguno tiene" : `✋ ${v}`;
    const hint  = v===null ? "Sin límite" : v===0 ? "Nadie puede plantarse" : "por equipo";
    d.innerHTML=`<div class="t">${title}</div><div class="d">${hint}</div>`;
    d.addEventListener("click",()=>{ state.passLimit=v; renderPassOptions(); });
    box.appendChild(d);
  });
  document.getElementById("passNote").textContent =
    state.passLimit===null ? "Cada equipo puede plantarse (✋) todas las veces que quiera."
    : state.passLimit===0 ? "Nadie puede plantarse: para sacarse de encima una puja hay que dejar que se acabe el tiempo o quedarse sin saldo."
    : `Cada equipo puede plantarse ${state.passLimit} ${state.passLimit===1?"vez":"veces"} en toda la subasta. Cuando se le acaban, ya no puede plantarse (el botón "Todos pasan" tampoco lo cuenta).`;
}
function selectMarket(v){
  state.useMarket=v;
  document.getElementById("opt-mk-on").classList.toggle("sel",v);
  document.getElementById("opt-mk-off").classList.toggle("sel",!v);
  refreshFreeMarketBox();
  refreshBotOptions();
  refreshStartBtn();
  refreshBudgetNote();
}
/* Jugadores troll: "on" = mezclados, "off" = ninguno, "only" = solo troll */
function selectTrollMode(m){
  state.trollMode=m;
  document.getElementById("opt-troll-on").classList.toggle("sel",m==="on");
  document.getElementById("opt-troll-off").classList.toggle("sel",m==="off");
  document.getElementById("opt-troll-only").classList.toggle("sel",m==="only");
  refreshCount();
}
/* Jugadores disponibles según la opción de jugadores troll de la configuración */
function poolPlayers(){
  if(state.trollMode==="off") return PLAYERS.filter(p=>!p.trollish);
  if(state.trollMode==="only") return PLAYERS.filter(p=>p.trollish);
  return PLAYERS;
}
/* Máximo de equipos: normalmente 16; en "Solo troll" lo limita la cantidad de troll (y de arqueros) disponibles */
function maxTeamsAllowed(){
  if(state.trollMode!=="only") return 16;
  const pool=PLAYERS.filter(p=>p.trollish);
  const gks=pool.filter(p=>p.pos==="POR").length;
  return Math.max(2, Math.min(16, gks, Math.floor(pool.length/squadSize())));
}
function selectFreeMarket(v){
  state.useFreeMarket=v;
  document.getElementById("opt-fm-on").classList.toggle("sel",v);
  document.getElementById("opt-fm-off").classList.toggle("sel",!v);
}
function refreshFreeMarketBox(){
  document.getElementById("freeMarketBox").style.display = state.useMarket ? "" : "none";
}

/* ---- Bots: dificultad (solo Puja, El Reloj y Mercado) y ofertas de los bots ---- */
const BOT_LEVEL_NOTE={
  facil:"Los bots valoran mal a los jugadores, gastan sin pensar y tardan en reaccionar. En el mercado piden poco, casi no miran cómo les queda el equipo y a veces aceptan por impulso.",
  regular:"Los bots valoran razonablemente, cuidan algo la plata y cubren las posiciones que les faltan. En el mercado miran qué pierde su once y no aceptan dejar una línea vacía.",
  dificil:"Los bots calculan el valor real, reservan plata para completar el plantel, pujan y fichan en el momento justo, y no regalan a sus figuras. En el mercado analizan el once, el equilibrio del plantel, la plata y a qué rival le venden."
};
function selectBotLevel(v){
  state.botLevel=v;
  document.querySelectorAll("#botLevelOptions .opt-card").forEach(c=>c.classList.toggle("sel",c.dataset.level===v));
  refreshBotOptions();
}
function selectBotOffers(v){
  state.botOffers=v;
  document.getElementById("opt-bo-on").classList.toggle("sel",v);
  document.getElementById("opt-bo-off").classList.toggle("sel",!v);
}
function refreshBotOptions(){
  // La dificultad solo importa si hay bots y se juega Puja, El Reloj o Mercado
  const withBots = state.mode==="ia";
  const lvlCard=document.getElementById("botLevelCard");
  const usesBots = withBots && (state.game!=="random" || state.useMarket);
  lvlCard.style.display = usesBots ? "" : "none";
  const where=[];
  if(state.game==="puja") where.push("la Puja");
  if(state.game==="reloj") where.push("El Reloj");
  if(state.useMarket) where.push("el Mercado");
  document.getElementById("botLevelNote").textContent=(BOT_LEVEL_NOTE[state.botLevel]||"")+" Solo afecta a "+where.join(" y ")+".";
  document.getElementById("botOffersBox").style.display = (withBots && state.useMarket) ? "" : "none";
}
document.querySelectorAll("#botLevelOptions .opt-card").forEach(c=>c.addEventListener("click",()=>selectBotLevel(c.dataset.level)));
document.getElementById("opt-bo-on").addEventListener("click",()=>selectBotOffers(true));
document.getElementById("opt-bo-off").addEventListener("click",()=>selectBotOffers(false));
document.getElementById("opt-troll-on").addEventListener("click",()=>selectTrollMode("on"));
document.getElementById("opt-troll-off").addEventListener("click",()=>selectTrollMode("off"));
document.getElementById("opt-troll-only").addEventListener("click",()=>selectTrollMode("only"));
document.getElementById("opt-fm-on").addEventListener("click",()=>selectFreeMarket(true));
document.getElementById("opt-fm-off").addEventListener("click",()=>selectFreeMarket(false));
function refreshStartBtn(){
  const b=document.getElementById("startDraftBtn");
  if(state.game==="random") b.textContent = state.useMarket ? "Repartir planteles →" : "Empezar torneo →";
  else if(state.game==="reloj") b.textContent="Comenzar fichajes →";
  else b.textContent="Comenzar Subasta →";
}
function updateLegNote(){
  const c=state.comp, d=state.doubleLeg, ld=state.leagueDouble;
  let t;
  if(state.champions) t = (state.leagueDouble ? "Grupos a ida y vuelta" : "Grupos a una vuelta") + "; playoffs de ida y vuelta.";
  else if(c==="league") t = d ? "Doble vuelta: cada rival, de local y de visitante." : "Una vuelta: cada rival se enfrenta una vez.";
  else if(c==="cup") t = d ? "Cada cruce es de ida y vuelta." : "Cada cruce es a partido único, en cancha neutral (sin ventaja de local).";
  else if(!d) t = ld ? "Liga a doble vuelta; eliminatorias a partido único." : "Liga a una vuelta; eliminatorias a partido único.";
  else t = ld ? "Liga y eliminatorias de ida y vuelta." : "Liga a una vuelta; eliminatorias de ida y vuelta.";
  document.getElementById("legNote").textContent=t;
}
function updateSteps(){
  const c=state.comp;
  const lg=document.querySelector('.step[data-step="league"]');
  const po=document.querySelector('.step[data-step="playoffs"]');
  lg.style.display = c==="cup" ? "none" : "";
  po.style.display = c==="league" ? "none" : "";
  po.querySelector(".label").textContent = c==="cup" ? "Copa" : "Eliminatoria";
  let n=0;
  document.querySelectorAll(".step").forEach(s=>{
    if(s.style.display!=="none"){ n++; s.querySelector(".num").textContent=n; }
  });
}
document.getElementById("countMinus").addEventListener("click",()=>{
  state.numTeams = state.champions ? Math.max(8,state.numTeams-4) : Math.max(2,state.numTeams-1); refreshCount();
});
document.getElementById("countPlus").addEventListener("click",()=>{
  state.numTeams = state.champions ? Math.min(maxTeamsAllowed()-maxTeamsAllowed()%4 || 4, state.numTeams+4) : Math.min(maxTeamsAllowed(),state.numTeams+1); refreshCount();
});
function refreshCount(){
  const mx=maxTeamsAllowed();
  if(state.numTeams>mx) state.numTeams=mx;
  document.getElementById("countVal").textContent=state.numTeams;
  const lbl=document.getElementById("countLabel"); if(lbl) lbl.textContent=`Cantidad de participantes (2 a ${mx})`;
  const tn=document.getElementById("trollNote");
  if(tn){
    tn.style.display = state.trollMode==="only" ? "" : "none";
    const pool=PLAYERS.filter(p=>p.trollish);
    tn.textContent = `Solo hay ${pool.length} jugadores troll (${pool.filter(p=>p.pos==="POR").length} arqueros): con plantel de ${squadSize()} el máximo es de ${mx} equipos.`;
  }
  renderTeamNameInputs();
  refreshCountNote();
}
function refreshCountNote(){
  const el=document.getElementById("countNote"); if(!el) return;
  const n=state.numTeams, c=state.comp;
  if(state.champions){ el.textContent=`${n/4|0} grupos de 4 (${state.leagueDouble?"ida y vuelta":"solo ida"}) · ${qualifiersFor(n)} clasifican a los playoffs`+(champThirds(n)?` (2 por grupo + ${champThirds(n)} mejores terceros).`:`.`); return; }
  const gm=(n-1)*(((c==="league" && state.doubleLeg) || (c==="leaguecup" && state.leagueDouble)) ? 2 : 1); // partidos por equipo en la liga
  let t;
  if(c==="league") t=`${gm} partido${gm===1?"":"s"} por equipo.`;
  else if(c==="cup"){
    if(n===2) t="Final directa.";
    else { const size=nextPow2(n), b=size-n; t=`${Math.ceil(Math.log2(n))} rondas`+(b>0?`, con ${b} pase${b===1?"":"s"} directo${b===1?"":"s"}.`:"."); }
  } else {
    if(n===2) t="Sin liga: final directa.";
    else if(n===3) t="Es campeón el 1° de la liga.";
    else t=`${gm} partidos por equipo; clasifican ${qualifiersFor(n)}.`;
  }
  el.textContent=t;
}
function refreshNamesNote(){
  const el=document.getElementById("namesNote"); if(!el) return;
  if(state.mode==="ia") el.textContent="Vos sos el equipo 1; el resto son bots.";
  else el.textContent = state.game==="reloj" ? "Cada equipo usa su tecla: 1 al 9, 0, Q, W, E…" : "Cada equipo lo maneja una persona.";
}
const customNames=[]; // nombres escritos por el usuario (se conservan al cambiar la cantidad)
function renderTeamNameInputs(){
  const box=document.getElementById("teamNamesBox");
  box.innerHTML="";
  refreshNamesNote();
  for(let i=0;i<state.numTeams;i++){
    const isHuman = isHumanIdx(i);
    const row=document.createElement("div");
    row.className="team-row";
    row.innerHTML=`
      <div class="tag" style="background:${TEAM_COLORS[i%TEAM_COLORS.length]}">${i+1}</div>
      <input type="text" data-idx="${i}" class="teamNameInput" value="${escAttr(customNames[i]!==undefined ? customNames[i] : defaultTeamName(i))}" style="flex:1">
      ${isHuman?(state.mode==="ia"?'<span class="human-badge">TÚ</span>':''):'<span class="cpu-badge">CPU</span>'}
    `;
    box.appendChild(row);
    row.querySelector("input").addEventListener("input",(e)=>{ customNames[i]=e.target.value; });
  }
}
function escAttr(v){ return String(v).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;"); }
function defaultTeamName(i){
  const names=["Boca Juniors","River Plate","Independiente","Racing Club","San Lorenzo","Estudiantes de La Plata","Vélez Sarsfield","Rosario Central","Newell's Old Boys","Talleres de Córdoba","Belgrano de Córdoba","Lanús","Argentinos Juniors","Huracán","Defensa y Justicia","Gimnasia y Esgrima La Plata"];
  return names[i]||`Equipo ${i+1}`;
}

document.getElementById("startDraftBtn").addEventListener("click",()=>{
  if(typeof onlineConfigSubmit==="function" && onlineConfigSubmit()) return; // multijugador online: crea la sala en vez de empezar
  const inputs=document.querySelectorAll(".teamNameInput");
  startDraftFromSettings(Array.from(inputs).map((inp,i)=>inp.value.trim()||defaultTeamName(i)));
});
/* Arma los equipos y arranca el modo elegido (lo usan el botón de ajustes y la sala online) */
function startDraftFromSettings(names){
  state.teams=[];
  names.forEach((nm,i)=>{
    state.teams.push({
      id:i,
      name:nm,
      color:TEAM_COLORS[i%TEAM_COLORS.length],
      isHuman: isHumanIdx(i),
      roster:[],
      budget:state.startBudget
    });
  });
  state.playoffs=null; state.disc={}; state.leagueCelebrated=false; state.humanElimLeague=false;
  updateSteps();
  if(state.game==="random"){
    setupRandomRosters();
    if(state.useMarket){ setupMarket(); goToScreen("market"); }
    else proceedAfterMarket();
  } else if(state.game==="reloj"){
    setupMini();
    goToScreen("mini");
  } else {
    document.getElementById("draftDesc").textContent=`Cada equipo arranca con ${fmtM(state.startBudget)}. Los jugadores salen a la venta desde ${fmtM(MIN_PRICE)}, sin tope de precio.`;
    setupAuction();
    goToScreen("draft");
  }
}
