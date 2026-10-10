/* =========================================================
   SUBASTA
========================================================= */
const BID_STEP=10;

/* Pausa tras revelar al jugador (Puja y El Reloj): no se pasa solo a la siguiente oferta,
   hay que tocar "Siguiente oferta" (o Enter / Espacio). El botón tarda un instante en activarse
   para que un doble clic apurado, o seguir apretando Ofertar/Fichar, no se salte la revelación. */
const NEXT_LOCK_MS=450;
function makeNextBtn(isLast, readyAt, onClick){
  const b=document.createElement("button");
  b.type="button"; b.className="btn primary next-offer-btn";
  b.textContent = isLast ? "Continuar ▶" : "Siguiente oferta ▶";
  b.title="Atajo: Enter o Espacio";
  b.addEventListener("click",onClick);
  const wait=readyAt-Date.now();
  if(wait>0){ b.disabled=true; setTimeout(()=>{ b.disabled=false; },wait); }
  return b;
}

function setupAuction(){
  randomizePlayerValues();
  const porPool = shuffleTrollBoost(poolPlayers().filter(p=>p.pos==="POR").map(p=>p.id));
  const restPool = shuffleTrollBoost(poolPlayers().filter(p=>p.pos!=="POR").map(p=>p.id));
  state.auction = {skipLeft:0, skipping:false, skipUses:(state.skipUses===null?Infinity:state.skipUses), 
    stage:"por", // "por" primero (garantiza 1 arquero por equipo), luego "general" (libre)
    porPool, porIndex:0,
    restPool, restIndex:0,
    player:null,
    price:0,
    highBidder:null,
    activeSet:new Set(),
    order: state.teams.map(t=>t.id),
    waitingHuman:null,
    passLeft:Object.fromEntries(state.teams.map(t=>[t.id, state.passLimit===null ? Infinity : state.passLimit])), // pases que le quedan a cada equipo (puja libre)
    log:[],
    reveal:null,
    totalNeeded: state.teams.length*squadSize(),
    totalDone:0
  };
  updateAuctionProgressPill();
  nextAuctionPlayer();
}

/* Probabilidad extra de los jugadores troll: 1 = igual que el resto, 4 = salen unas 4 veces más seguido.
   (se puede subir o bajar este número a gusto) */
const TROLL_WEIGHT = 4;
/* Mezcla una lista de ids dando más chances de salir temprano a los troll (Efraimidis-Spirakis) */
function shuffleTrollBoost(ids){
  return ids
    .map(id=>{ const p=PLAYERS[id]; const w=(p&&p.trollish)?TROLL_WEIGHT:1; return {id, k:-Math.log(1-Math.random())/w}; })
    .sort((a,b)=>a.k-b.k)
    .map(x=>x.id);
}
function shuffle(arr){
  const a=arr.slice();
  for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}

function updateAuctionProgressPill(){
  const a=state.auction;
  document.getElementById("draftProgressPill").innerHTML=`<b>${a.totalDone}/${a.totalNeeded}</b>&nbsp;fichados`;
}

function teamsNeedingPlayers(){
  return state.teams.filter(t=>t.roster.length<squadSize());
}
function teamHasPos(team,pos){
  return team.roster.some(pid=>playerById(pid).pos===pos);
}
function maxAffordable(team){
  const slotsLeftAfter = squadSize() - team.roster.length - 1;
  return team.budget - MIN_PRICE*Math.max(0,slotsLeftAfter);
}

function startPlayerAuction(player, eligibleTeams){
  const a=state.auction;
  a.reveal=null; a.awaitNext=false;
  a.player=player;
  a.price=MIN_PRICE;
  a.highBidder=null;
  a.waitingHuman=null;
  a.activeSet=new Set(eligibleTeams.filter(t=>maxAffordable(t)>=MIN_PRICE).map(t=>t.id));
  a.baseEligible=[...a.activeSet];
  // cada bot decide de antemano hasta cuánto paga por este jugador (según su dificultad, su plata y lo que le falta)
  a.botMax={};
  eligibleTeams.forEach(t=>{ if(!t.isHuman) a.botMax[t.id]=botReservation(t,player); });
  a.free = state.mode==="local"; // multijugador: puja libre, sin turnos
  a.controlsFor=null; a.freeUI=null;
  a.passed=new Set();   // equipos que ya se plantaron en esta puja
  a.humanBid=false;
  a.humanIn=eligibleTeams.some(t=>t.isHuman && maxAffordable(t)>=MIN_PRICE);
  // Un jugador vs bots: si ningún humano necesita más jugadores, se simula todo al instante
  a.instant = state.mode==="ia" && !state.teams.some(t=>t.isHuman && t.roster.length<squadSize());
  // "Pasar x10": tu equipo se planta solo en este jugador y los bots pujan y fichan rápido
  a.skipping = state.mode==="ia" && !a.free && (a.skipLeft||0)>0;
  if(a.skipping) a.skipLeft--;
  updateAuctionSkipBtn();
  a.deadline = noTimer() ? null : Date.now()+bidMs();

  if(a.free) renderAuction();

  if(a.activeSet.size===0){ logUnsoldAndContinue(); return; }
  if(a.activeSet.size===1){ sellPlayerTo([...a.activeSet][0]); return; }
  if(a.free){ startFreeTimer(); return; }
  a.turnPtr = a.order.findIndex(id=>a.activeSet.has(id));
  processAuctionTurn();
}

function bidMs(){ return state.bidSecs*1000; }
function noTimer(){ return !state.bidSecs; } // bidSecs===0 -> puja sin tiempo
function startFreeTimer(){
  const a=state.auction; clearFreeTimer();
  if(noTimer()){ a.deadline=null; return; }
  a.deadline=Date.now()+bidMs();
  a.timerId=setInterval(freeTick,200);
}
function auctionLater(fn,ms){
  const a=state.auction;
  setTimeout(()=>{ if(a && state.auction===a) fn(); }, ms);
}
function clearFreeTimer(){
  const a=state.auction;
  if(a && a.timerId){ clearInterval(a.timerId); a.timerId=null; }
  clearTurnTimer();
}
function clearTurnTimer(){
  const a=state.auction;
  if(a && a.turnTimerId){ clearInterval(a.turnTimerId); a.turnTimerId=null; }
}
function startTurnTimer(){
  const a=state.auction; clearTurnTimer();
  if(noTimer()){ a.deadline=null; return; }
  a.deadline=Date.now()+bidMs();
  a.turnTimerId=setInterval(turnTick,200);
}
function turnTick(){
  const a=state.auction;
  if(!a || a.waitingHuman===null || !a.player){ clearTurnTimer(); return; }
  const ms=a.deadline-Date.now();
  const el=document.getElementById("auctionTimer");
  if(el) el.textContent=Math.max(0,Math.ceil(ms/1000));
  if(ms<=0){
    const t=teamById(a.waitingHuman);
    logAuction(`${t.name} se quedó sin tiempo y pasa`,"unsold");
    humanPass();
  }
}
function freeTick(){
  const a=state.auction;
  if(!a.player || !a.free){ clearFreeTimer(); return; }
  const ms=a.deadline-Date.now();
  const el=document.getElementById("auctionTimer");
  if(el) el.textContent=Math.max(0,Math.ceil(ms/1000));
  if(ms<=0){ clearFreeTimer(); closeFreeAuction(); }
}
function closeFreeAuction(){
  const a=state.auction;
  if(a.highBidder!==null) sellPlayerTo(a.highBidder); else logUnsoldAndContinue();
}
/* Oferta automática (casillero vacío): el precio original si nadie ofertó, o +10M sobre la oferta actual */
function freeAutoBid(){ const a=state.auction; return a.highBidder===null ? MIN_PRICE : a.price+BID_STEP; }
function freeMinBid(){ const a=state.auction; return a.highBidder===null ? MIN_PRICE : a.price+1; }
/* Equipos que todavía pueden (y quieren) superar la oferta actual */
function freeLiveTeams(){
  const a=state.auction, minBid=freeMinBid();
  return a.baseEligible.filter(tid=>tid!==a.highBidder && !a.passed.has(tid) && maxAffordable(teamById(tid))>=minBid);
}
/* Si ya nadie más puede o quiere ofertar, se cierra la puja sin esperar al reloj */
function checkFreeClose(){
  const a=state.auction;
  if(!a || !a.player || !a.free) return;
  if(freeLiveTeams().length===0){ clearFreeTimer(); closeFreeAuction(); }
}
function freeBid(teamId, raw){
  const a=state.auction;
  if(!a.player || !a.free) return false;
  const team=teamById(teamId);
  const amount=Math.floor(Number(raw));
  const minBid=freeMinBid();
  let err=null;
  if(!raw || isNaN(amount)) err="monto inválido";
  else if(a.passed.has(teamId)) err="ya te plantaste en esta puja";
  else if(a.highBidder===teamId) err="ya lideras la puja";
  else if(amount<minBid) err=`tenés que ofrecer al menos ${fmtM(minBid)}`;
  else if(amount>maxAffordable(team)) err=`tu tope disponible es ${fmtM(Math.max(0,maxAffordable(team)))}`;
  if(err){ logAuction(`${team.name}: ${err}`, "unsold"); renderAuction(); return false; }
  a.price=amount; a.highBidder=teamId;
  logAuction(`${team.name} ofrece ${fmtM(amount)}`, "you");
  a.deadline = noTimer() ? null : Date.now()+bidMs();
  renderAuction();
  checkFreeClose();
  return true;
}
/* Botón "Todos pasan": todos los que no lideran se plantan; si alguien ya ofertó se lo queda el que lidera, si no queda sin vender */
/* Pases (plantarse) que le quedan a un equipo; Infinity si no hay límite */
function freePassesLeft(teamId){
  const a=state.auction;
  if(!a || !a.passLeft || a.passLeft[teamId]===undefined) return Infinity;
  return a.passLeft[teamId];
}
function freeCanPass(teamId){ return freePassesLeft(teamId)>0; }
function freeSpendPass(teamId){
  const a=state.auction;
  if(a && a.passLeft && a.passLeft[teamId]!==undefined && a.passLeft[teamId]!==Infinity) a.passLeft[teamId]--;
}
function freePassAll(){
  const a=state.auction;
  if(!a || !a.player || !a.free) return;
  let n=0, blocked=[];
  a.baseEligible.forEach(tid=>{
    if(tid===a.highBidder || a.passed.has(tid)) return;
    if(!freeCanPass(tid)){ if(maxAffordable(teamById(tid))>=freeMinBid()) blocked.push(teamById(tid).name); return; }
    a.passed.add(tid); freeSpendPass(tid); n++;
  });
  let msg = a.highBidder!==null ? `Todos pasan: se lo queda ${teamById(a.highBidder).name}` : "Todos pasan";
  if(blocked.length) msg = `Pasan los que pueden (siguen en la puja por no tener pases: ${blocked.join(", ")})`;
  logAuction(msg, "unsold");
  renderAuction();
  checkFreeClose();
}
function freePass(teamId){
  const a=state.auction;
  if(!a || !a.player || !a.free) return;
  if(a.highBidder===teamId || a.passed.has(teamId)) return;
  if(!freeCanPass(teamId)){ logAuction(`${teamById(teamId).name} no tiene más pases para saltear`, "unsold"); renderAuction(); return; }
  a.passed.add(teamId);
  freeSpendPass(teamId);
  const left=freePassesLeft(teamId);
  logAuction(`${teamById(teamId).name} se planta`+(left===Infinity?"":` (le quedan ${left})`), "unsold");
  renderAuction();
  checkFreeClose();
}

function nextAuctionPlayer(){
  const a=state.auction;
  a.reveal=null;

  if(teamsNeedingPlayers().length===0){ finishAuction(); return; }

  if(a.stage==="por"){
    const needy = state.teams.filter(t=>!teamHasPos(t,"POR"));
    if(needy.length===0 || a.porIndex>=a.porPool.length){
      a.stage="general";
      nextAuctionPlayer();
      return;
    }
    const pid=a.porPool[a.porIndex++];
    const player=playerById(pid);
    startPlayerAuction(player, needy);
    return;
  }

  // etapa general: libre, cualquiera puede pujar por cualquiera
  if(a.restIndex>=a.restPool.length){ fillRemaining(); finishAuction(); return; }
  const pid=a.restPool[a.restIndex++];
  const player=playerById(pid);
  const eligible = state.teams.filter(t=>t.roster.length<squadSize());
  startPlayerAuction(player, eligible);
}

/* Los bots juegan al toque: se resuelven todos sus turnos seguidos y recién se frena cuando te toca a vos o se vende el jugador */
function processAuctionTurn(){
  const a=state.auction;
  if(!a || !a.player) return;
  const verbose = !a.instant && !a.skipping && a.humanIn!==false; // sin humanos en la puja no se llena el registro con cada oferta
  for(let guard=0; guard<20000; guard++){
    const remaining=[...a.activeSet];
    if(remaining.length<=1){
      if(remaining.length===1) sellPlayerTo(remaining[0]);
      else logUnsoldAndContinue();
      return;
    }
    let tid=null, attempts=0;
    while(attempts<a.order.length){
      const cand=a.order[a.turnPtr % a.order.length];
      a.turnPtr++; attempts++;
      if(!a.activeSet.has(cand)) continue;
      if(cand===a.highBidder) continue; // no se contraoferta a sí mismo
      const team=teamById(cand);
      if(a.price+BID_STEP>maxAffordable(team)){ a.activeSet.delete(cand); continue; }
      tid=cand; break;
    }
    if(tid===null) continue; // nadie más para actuar: se re-evalúa quién queda
    const team=teamById(tid);
    const nextPrice=a.price+BID_STEP;
    if(team.isHuman && a.skipping){ a.activeSet.delete(tid); continue; } // Pasar x10: te plantás solo
    if(team.isHuman){
      a.waitingHuman=tid;
      startTurnTimer();
      renderAuction();
      return;
    }
    if(cpuDecideBid(team, a.player, nextPrice)){
      a.price=nextPrice;
      a.highBidder=tid;
      if(verbose) logAuction(`${team.name} (CPU) oferta ${fmtM(nextPrice)} por el misterioso ${a.player.pos}`, "");
    } else {
      a.activeSet.delete(tid);
    }
  }
  // seguro anti-bucle
  if(a.highBidder!==null) sellPlayerTo(a.highBidder); else logUnsoldAndContinue();
}

function finalizeIfResolved(){
  const a=state.auction;
  const remaining=[...a.activeSet];
  if(a.highBidder!==null && remaining.length<=1){
    sellPlayerTo(a.highBidder);
  } else if(a.highBidder===null && remaining.length<=1){
    logUnsoldAndContinue();
  } else {
    processAuctionTurn();
  }
}

function logUnsoldAndContinue(){
  const a=state.auction;
  clearFreeTimer();
  const player=a.player;
  // equipos "ajustados" (solo les alcanza para el precio base) se quedan al jugador a $20
  const squeezed=(a.baseEligible||[]).map(teamById).filter(t=>t.roster.length<squadSize() && maxAffordable(t)>=MIN_PRICE && maxAffordable(t)<MIN_PRICE+BID_STEP);
  if(squeezed.length){
    a.price=MIN_PRICE; a.highBidder=null;
    sellPlayerTo(squeezed[0].id);
    return;
  }
  logAuction(`Nadie pujó por el ${player.pos} misterioso. Vuelve al final de la lista.`, "unsold");
  a.recycled=a.recycled||{};
  a.recycled[player.id]=(a.recycled[player.id]||0)+1;
  if(a.recycled[player.id]<=2){
    (player.pos==="POR" && a.stage==="por" ? a.porPool : a.restPool).push(player.id);
  }
  a.reveal={player, team:null, price:0, unsold:true};
  a.player=null;
  const held=auctionHoldReveal();
  if(!a.instant) renderAuction();
  if(!held) auctionLater(nextAuctionPlayer, revealDelayMs(null,true));
}

function fillRemaining(){
  // Seguridad: si se agotó la lista, se completan las plantillas por sorteo a $20
  const a=state.auction;
  const owned=new Set(); state.teams.forEach(t=>t.roster.forEach(id=>owned.add(id)));
  const free=shuffle(poolPlayers().filter(p=>!owned.has(p.id)));
  const take=(team,pred)=>{
    const i=free.findIndex(pred);
    if(i<0) return;
    const p=free.splice(i,1)[0];
    team.roster.push(p.id); team.budget=Math.max(0,team.budget-MIN_PRICE); a.totalDone++;
    logAuction(`${team.name} recibe un ${p.pos} por sorteo (${fmtM(MIN_PRICE)})`, "sold");
  };
  state.teams.forEach(t=>{ if(!teamHasPos(t,"POR")) take(t,p=>p.pos==="POR"); });
  state.teams.forEach(t=>{ while(t.roster.length<squadSize() && free.length) take(t,p=>p.pos!=="POR"); });
}

function cpuDecideBid(team, player, price){
  const a=state.auction, L=botLvl();
  if(price>maxAffordable(team)) return false;
  let max = a && a.botMax ? a.botMax[team.id] : undefined;
  if(max===undefined) max=botReservation(team,player);
  if(price<=max) return !(L.flake && Math.random()<L.flake);   // en Fácil a veces se distraen y se bajan
  if(L.impulse && price<=max*1.3 && Math.random()<L.impulse) return true; // en Fácil a veces se calientan y pagan de más
  return false;
}

function neededPositions(team){
  const counts={POR:0,DEF:0,MED:0,DEL:0};
  team.roster.forEach(pid=>{ const p=playerById(pid); counts[p.pos]++; });
  const targets = squadSize()===5 ? {POR:1,DEF:2,MED:1,DEL:1} : {POR:1,DEF:4,MED:4,DEL:2};
  const need=[];
  Object.keys(targets).forEach(pos=>{ if(counts[pos]<targets[pos]) need.push(pos); });
  return need;
}

function teamById(id){ return state.teams.find(t=>t.id===id); }

function sellPlayerTo(teamId){
  const a=state.auction;
  clearFreeTimer();
  const team=teamById(teamId);
  const player=a.player;
  team.roster.push(player.id);
  team.budget-=a.price;
  a.totalDone++;
  if(team.isHuman && a.skipping){ a.skipping=false; a.skipLeft=0; updateAuctionSkipBtn(); } // si te quedaste un jugador, se corta el salto para que lo veas
  logAuction(`¡Vendido por ${fmtM(a.price)} a ${team.name}! (${player.pos} misterioso)`, "sold");
  updateAuctionProgressPill();
  a.reveal={player, team, price:a.price, unsold:false};
  a.player=null;
  const held=auctionHoldReveal();
  if(!a.instant) renderAuction();
  if(!held) auctionLater(nextAuctionPlayer, revealDelayMs(teamId,false));
}

/* Tras revelar al jugador la puja queda en pausa hasta que se toque "Siguiente oferta".
   No se pausa si se simula todo al instante (nadie lo ve) ni cuando juegan solo bots (no hay humano metido en esa puja). */
function auctionHoldReveal(){
  const a=state.auction;
  const hold = !a.instant && !a.skipping && (state.mode!=="ia" || a.humanIn);
  a.awaitNext = hold;
  a.nextReadyAt = Date.now()+NEXT_LOCK_MS;
  return hold;
}
function auctionContinue(){
  const a=state.auction;
  if(!a || !a.awaitNext || Date.now()<a.nextReadyAt) return;
  a.awaitNext=false;
  nextAuctionPlayer();
}

/* Cuánto se muestra el jugador revelado antes de pasar al siguiente.
   Contra bots es cortito (y casi nulo si no estás metido en la puja); en multijugador se deja leer. */
function revealDelayMs(winnerId, unsold){
  if(state.mode!=="ia") return unsold ? 2000 : 2200;
  const a=state.auction;
  if(a.instant) return 0;
  if(a.skipping) return 120;
  if(winnerId!==null && teamById(winnerId).isHuman) return 1100;
  if(a.humanBid) return 650;
  return unsold ? 250 : 140;
}
function logAuction(msg, cls){
  state.auction.log.push({msg, cls:cls||""});
  if(state.auction.log.length>40) state.auction.log.shift();
}

/* Acciones del humano */
function humanBid(){
  const a=state.auction;
  if(a.waitingHuman===null) return;
  clearTurnTimer();
  const team=teamById(a.waitingHuman);
  const nextPrice=a.price+BID_STEP;
  a.price=nextPrice;
  a.highBidder=a.waitingHuman;
  a.humanBid=true;
  logAuction(`${team.name} ofrece ${fmtM(nextPrice)}`, "you");
  a.waitingHuman=null;
  renderAuction();
  auctionLater(processAuctionTurn, 40);
}
function humanPass(){
  const a=state.auction;
  if(a.waitingHuman===null) return;
  clearTurnTimer();
  a.activeSet.delete(a.waitingHuman);
  a.waitingHuman=null;
  renderAuction();
  auctionLater(finalizeIfResolved, 40);
}

function bidEsc(v){ return String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

/* Menú de puja libre (multijugador): una fila compacta por equipo, se arma una vez por jugador y después solo se actualiza (así no se pierde lo que se está tipeando) */
function buildFreeControls(actions){
  const a=state.auction;
  actions.innerHTML="";
  a.freeUI={};
  const allBtn=document.createElement("button");
  allBtn.type="button"; allBtn.className="btn bid-all";
  allBtn.addEventListener("click",freePassAll);
  allBtn.dataset.hostOnly="1";
  actions.appendChild(allBtn);
  a.freeAll=allBtn;
  a.baseEligible.forEach(tid=>{
    const t=teamById(tid);
    const row=document.createElement("div");
    row.className="bid-row"; row.dataset.team=tid;
    row.style.setProperty("--tc", t.color);
    row.innerHTML=`
      <div class="who"><span class="nm"></span><span class="sub"></span></div>
      <label class="amt"><input type="number" inputmode="numeric" min="${MIN_PRICE}" aria-label="Monto (vacío = oferta automática)"><span>M</span></label>
      <button class="btn primary bid-go" type="button">Ofertar</button>
      <button class="btn bid-pass" type="button" title="Me planto" aria-label="Me planto">✋</button>`;
    row.querySelector(".nm").textContent=t.name;
    const input=row.querySelector("input"), go=row.querySelector(".bid-go"), pass=row.querySelector(".bid-pass");
    const send=()=>{ const raw=String(input.value).trim(); if(freeBid(tid, raw==="" ? freeAutoBid() : raw)) input.value=""; };
    go.addEventListener("click",send);
    input.addEventListener("keydown",e=>{ if(e.key==="Enter"){ e.preventDefault(); send(); } });
    pass.addEventListener("click",()=>freePass(tid));
    actions.appendChild(row);
    a.freeUI[tid]={row, sub:row.querySelector(".sub"), input, go, pass};
  });
}
function updateFreeControls(){
  const a=state.auction;
  if(!a || !a.freeUI) return;
  const minBid=freeMinBid();
  if(a.freeAll){
    const ld=a.highBidder!==null ? teamById(a.highBidder) : null;
    const cands=a.baseEligible.filter(tid=>tid!==a.highBidder && !a.passed.has(tid));
    const allOut = cands.length>0 && cands.every(tid=>freePassesLeft(tid)<=0);
    a.freeAll.disabled = allOut;
    a.freeAll.innerHTML = (allOut ? "🚫" : "✋")+" Todos pasan <small>"+(allOut ? "· nadie tiene pases" : (ld ? "· se lo queda "+bidEsc(ld.name)+" por "+fmtM(a.price) : "· queda sin vender"))+"</small>";
  }
  a.baseEligible.forEach(tid=>{
    const ui=a.freeUI[tid]; if(!ui) return;
    const cap=maxAffordable(teamById(tid));
    const isLead=a.highBidder===tid, isPassed=a.passed.has(tid), broke=!isLead && cap<minBid;
    const canAct=!isLead && !isPassed && !broke;
    ui.row.classList.toggle("lead", isLead);
    ui.row.classList.toggle("out", !isLead && (isPassed||broke));
    const pl=freePassesLeft(tid), limited=pl!==Infinity;
    const passTxt = limited ? (pl>0 ? ` · ✋ ${pl}` : " · sin pases") : "";
    ui.sub.textContent = isLead ? "👑 Lidera" : isPassed ? "✋ Plantado" : broke ? "Sin saldo" : "Disponible "+fmtM(Math.max(0,cap))+passTxt;
    ui.input.placeholder="auto "+freeAutoBid();
    ui.input.disabled=!canAct; ui.go.disabled=!canAct;
    ui.pass.disabled=isLead || isPassed || pl<=0;
    ui.pass.textContent = !limited ? "✋" : (pl>0 ? "✋ "+pl : "🚫");
    ui.pass.title = limited ? (pl>0 ? `Me planto (te quedan ${pl})` : "No te quedan pases") : "Me planto";
  });
}

/* Botón "Pasar x10" (Puja, un jugador): salta los próximos 10 jugadores; mientras corre se convierte en "Detener" */
function updateAuctionSkipBtn(){
  const b=document.getElementById("auctionSkipBtn"); if(!b) return;
  const a=state.auction;
  const on = !!a && state.mode==="ia" && !a.free && state.skipUses!==0;
  b.style.display = on ? "" : "none";
  if(!on) return;
  b.textContent = skipBtnText(a.skipLeft, a.skipUses);
  b.disabled = a.skipLeft<=0 && a.skipUses<=0;
}
/* Texto del botón: "Detener (n)" mientras salta; si no, "Pasar x10" con los usos que quedan */
function skipBtnText(left, uses){
  if(left>0) return `⏹ Detener (${left})`;
  if(uses===Infinity) return "⏭ Pasar x10";
  return uses>0 ? `⏭ Pasar x10 (${uses})` : "🚫 Pasar x10";
}
function auctionSkip10(){
  const a=state.auction; if(!a || state.mode!=="ia" || a.free) return;
  if(a.skipLeft>0){ a.skipLeft=0; a.skipping=false; updateAuctionSkipBtn(); return; } // Detener (el uso ya gastado no se devuelve)
  if(a.skipUses<=0 || state.skipUses===0) return;
  if(a.skipUses!==Infinity) a.skipUses--;
  a.skipLeft=10;
  if(a.player && a.waitingHuman!==null){ a.skipLeft=9; a.skipping=true; humanPass(); } // este jugador cuenta como el primero
  else if(a.awaitNext){ a.nextReadyAt=0; auctionContinue(); }
  updateAuctionSkipBtn();
}
/* El botón vive en la fila de acciones (al lado de "Pasar"), que se rearma en cada renderAuction */
function appendAuctionSkipBtn(actions){
  const a=state.auction;
  if(!a || state.mode!=="ia" || a.free || state.skipUses===0) return;
  if(!_auctionSkipEl){ // un único botón que se vuelve a colgar en cada render (así un clic no se pierde mientras se rearma la fila)
    const b=document.createElement("button");
    b.type="button"; b.className="btn"; b.id="auctionSkipBtn";
    b.title="Pasás los próximos 10 jugadores: los bots pujan y fichan solos";
    b.addEventListener("click",function(){ this.blur(); auctionSkip10(); });
    _auctionSkipEl=b;
  }
  const b=_auctionSkipEl;
  b.textContent=skipBtnText(a.skipLeft, a.skipUses);
  b.disabled = a.skipLeft<=0 && a.skipUses<=0;
  actions.appendChild(b);
}
let _auctionSkipEl=null;

function renderAuction(){
  const a=state.auction;
  updateAuctionSkipBtn();
  const box=document.getElementById("auctionPlayerBox");
  const actions=document.getElementById("auctionActions");
  actions.className = a.free ? "bid-grid" : "btn-row";
  const mainCard=box.closest(".auction-main"); if(mainCard) mainCard.classList.toggle("free-mode", !!(a.free && a.player));

  if(a.player){
    const p=a.player;
    const bidder = a.highBidder!==null ? teamById(a.highBidder) : null;
    const stageNote = (a.stage==="por" ? "Ronda de arqueros" : "Ronda libre") + (a.free ? " · puja libre, sin turnos" : "");
    let timerHtml="";
    if(a.free || a.waitingHuman!==null){
      timerHtml = noTimer()
        ? `<div class="auction-timer none">♾️ Sin límite de tiempo</div>`
        : `<div class="auction-timer">⏱ <span id="auctionTimer">${Math.max(0,Math.ceil((a.deadline-Date.now())/1000))}</span>s</div>`;
    }
    let statusHtml="";
    if(a.free && noTimer()) statusHtml=`<div class="bid-status">Cierra cuando todos los demás se plantan (✋).</div>`;
    box.innerHTML=`
      <div class="country-tag">${countryFlag(p.country)} ${p.country}</div>
      <div class="pos-tag" style="background:${posBg(p.pos)};color:${posFg(p.pos)}">${p.pos}</div>
      <div class="mystery">???</div>
      <div style="color:var(--muted-2); font-size:12px; margin-top:2px;">${stageNote} · nombre, club y media anónimos</div>
      <div class="ovr">Club: ???</div>
      <div class="ovr">Media global: <b>??</b></div>
      <div class="auction-price"><span class="amount">${fmtM(a.price)}</span><span class="cap">(sin tope)</span></div>
      <div class="auction-bidder">${bidder ? `Lidera <b style="color:${bidder.color}">${bidEsc(bidder.name)}</b>` : "Sin ofertas todavía"}</div>
      ${timerHtml}${statusHtml}
    `;
    if(a.free){
      if(a.controlsFor!==p.id || !a.freeUI){
        buildFreeControls(actions);
        a.controlsFor=p.id;
      }
      updateFreeControls();
    } else {
      actions.innerHTML="";
      if(a.waitingHuman!==null){
        const team=teamById(a.waitingHuman);
        const nextPrice=a.price+BID_STEP;
        const bidBtn=document.createElement("button");
        bidBtn.className="btn primary";
        bidBtn.textContent=`${team.name}: Ofertar ${fmtM(nextPrice)}`;
        bidBtn.addEventListener("click",humanBid);
        const passBtn=document.createElement("button");
        passBtn.className="btn";
        passBtn.textContent="Pasar";
        passBtn.addEventListener("click",humanPass);
        actions.appendChild(bidBtn); actions.appendChild(passBtn);
      }
    }
  } else if(a.reveal){
    const r=a.reveal;
    box.innerHTML=`
      <div class="reveal-box">
        <div class="reveal-tag">¡Se revela el jugador!</div>
        <div class="reveal-name">${r.player.name}</div>
        <div class="ovr">${r.player.pos} · Media <b>${r.player.ovr}</b> · ${r.player.club} (${r.player.country})</div>
        <div class="reveal-result" style="margin-top:10px;">
          ${r.unsold ? "No recibió ofertas y quedó libre." : `Fue a <b style="color:${r.team.color}">${r.team.name}</b> por <b>${fmtM(r.price)}</b>`}
        </div>
      </div>`;
    actions.innerHTML=""; a.controlsFor=null; a.freeUI=null;
    if(a.awaitNext) actions.appendChild(makeNextBtn(teamsNeedingPlayers().length===0, a.nextReadyAt, auctionContinue));
  } else {
    box.innerHTML='<div class="empty-note">Preparando el próximo jugador...</div>';
    actions.innerHTML=""; a.controlsFor=null; a.freeUI=null;
  }

  appendAuctionSkipBtn(actions);

  const logBox=document.getElementById("auctionLog");
  logBox.innerHTML = a.log.slice().reverse().map(e=>`<div class="entry ${e.cls}">${e.msg}</div>`).join("");

  const teamsBox=document.getElementById("auctionTeams");
  teamsBox.innerHTML="";
  state.teams.forEach(t=>{
    const row=document.createElement("div");
    row.className="auction-team"+(a.highBidder===t.id?" leading":"")+(t.roster.length>=squadSize()?" full":"")+((a.free && a.player && a.passed && a.passed.has(t.id))?" passed":"");
    row.innerHTML=`<span class="dot" style="background:${t.color}"></span>
      <span class="nm">${t.name}${state.mode==="ia" ? (t.isHuman ? ' <span class="human-badge">TÚ</span>' : ' <span class="cpu-badge">BOT</span>') : ''}${t.roster.length>=squadSize() && teamBalance(t).level!=="ok" ? '<span class="bal-chip" title="Plantel desequilibrado: será castigado en los partidos">⚠️ desequilibrado</span>' : ''}</span>
      <span class="cnt">${teamHasPos(t,"POR")?"🧤":""} ${t.roster.length}/${squadSize()}</span>
      <span class="bud">${fmtM(t.budget)}</span>`;
    teamsBox.appendChild(row);
  });
}
function posBg(pos){ return {POR:"rgba(240,185,11,.18)",DEF:"rgba(91,141,239,.18)",MED:"rgba(53,209,124,.18)",DEL:"rgba(229,72,77,.18)"}[pos]; }
function posFg(pos){ return {POR:"var(--gold)",DEF:"var(--blue)",MED:"var(--grass)",DEL:"#ff8b8e"}[pos]; }

function finishAuction(){
  if(state.useMarket){
    // antes de arrancar el torneo hay un Mercado para ofertar con la plata sobrante
    setupMarket();
    goToScreen("market");
    return;
  }
  proceedAfterMarket();
}

function proceedAfterMarket(){
  const c=state.comp, n=state.teams.length;
  state.playoffs=null; state.disc={}; state.leagueCelebrated=false; state.humanElimLeague=false; state.scorers={};
  // sin fase de liga: copa pura, o 2 participantes (directo a la final)
  state.skipLeague = (c==="cup") || (c==="leaguecup" && n===2);
  const dest = state.skipLeague ? "playoffs" : "league";
  if(state.skipLeague) setupPlayoffs(); else setupLeague();
  // Copa y Champions: antes de arrancar hay una pantalla animada con el sorteo de los cruces / grupos
  if(typeof drawApplies==="function" && drawApplies()) showDraw(dest);
  else goToScreen(dest);
}
