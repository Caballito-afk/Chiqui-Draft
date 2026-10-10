/* =========================================================
   MINIJUEGO: EL RELOJ (subasta holandesa / al revés)
   - El jugador se muestra completo y el precio arranca alto y BAJA en vivo.
   - El primero que aprieta ¡FICHAR! se lo queda al precio del momento.
   - Los bots compran cuando el precio baja de lo que "valoran" al jugador.
   - Al terminar, deja los planteles listos y sigue el flujo normal
     (mercado opcional -> liga / copa / copa de la liga), en Fútbol 11 o 5.
========================================================= */
const CLOCK_FLOOR=10, CLOCK_HOLD_MS=2500, CLOCK_TICK_MS=50;
const CLOCK_HOLD_SOLO_MS=1000; // un jugador: cuánto se queda el reloj en el mínimo antes de dar el jugador por no vendido
function clockDur(){ return state.clockSecs*1000; }
const CLOCK_KEYS="1234567890qwertyuiop";

function clockFair(p){ return 20+(Math.max(30,p.ovr)-30)*(180/69); }
function miniAfford(team){ return team.budget - CLOCK_FLOOR*Math.max(0, squadSize()-team.roster.length-1); }
function clearMiniTimers(){
  const m=state.mini; if(!m) return;
  if(m.timerId){ clearInterval(m.timerId); m.timerId=null; }
  if(m.nextId){ clearTimeout(m.nextId); m.nextId=null; }
}
function miniLog(msg, cls){
  const m=state.mini; m.log.push({msg, cls:cls||""});
  if(m.log.length>40) m.log.shift();
}
function updateMiniPill(){
  const m=state.mini;
  document.getElementById("miniProgressPill").innerHTML=`<b>${m.totalDone}/${m.totalNeeded}</b>&nbsp;fichados`;
}

function setupMini(){
  clearMiniTimers();
  randomizePlayerValues();
  state.teams.forEach(t=>{ t.roster=[]; t.budget=state.startBudget; });
  state.mini={
    stage:"por", // primero arqueros (1 por equipo), después ronda libre
    porPool:shuffleTrollBoost(poolPlayers().filter(p=>p.pos==="POR").map(p=>p.id)), porIndex:0,
    restPool:shuffleTrollBoost(poolPlayers().filter(p=>p.pos!=="POR").map(p=>p.id)), restIndex:0,
    player:null, phase:"idle", // idle | running | sold
    startPrice:0, price:0, t0:0, holdAt:null,
    elig:[], botT:{}, botDelay:{}, botReact:{}, botCross:{},
    log:[], reveal:null, recycled:{}, timerId:null, nextId:null, lastBuyer:null, awaitNext:false, nextReadyAt:0,
    totalNeeded:state.teams.length*squadSize(), totalDone:0, skipLeft:0, skipping:false, skipUses:(state.skipUses===null?Infinity:state.skipUses)
  };
  document.getElementById("miniDesc").textContent =
    `Cada equipo arranca con ${fmtM(state.startBudget)}. Sale un jugador anónimo (solo se ve su posición y su país) con un precio altísimo que baja en vivo: el primero en apretar ¡FICHAR! se lo queda a ese precio. `
    + (state.mode==="ia" ? "Atajo: barra espaciadora." : "Cada equipo tiene su botón y su tecla.");
  document.getElementById("miniHint").textContent =
    "Si esperás a que baje, un rival puede llevárselo antes. Ojo: siempre te tiene que quedar plata para completar el plantel.";
  updateMiniPill();
  updateMiniSkipBtn();
  miniNext();
}

function miniNext(){
  const m=state.mini; if(!m) return;
  m.nextId=null; m.reveal=null;
  if(teamsNeedingPlayers().length===0){ miniFinish(); return; }
  let pid, eligible;
  if(m.stage==="por"){
    const needy=state.teams.filter(t=>!teamHasPos(t,"POR"));
    if(needy.length===0 || m.porIndex>=m.porPool.length){ m.stage="general"; miniNext(); return; }
    pid=m.porPool[m.porIndex++]; eligible=needy;
  } else {
    if(m.restIndex>=m.restPool.length){ miniFill(); miniFinish(); return; }
    pid=m.restPool[m.restIndex++];
    eligible=state.teams.filter(t=>t.roster.length<squadSize());
  }
  miniStartPlayer(playerById(pid), eligible);
}

function miniStartPlayer(p, eligible){
  const m=state.mini;
  m.player=p; m.phase="running"; m.reveal=null; m.holdAt=null; m.awaitNext=false;
  m.elig=eligible.filter(t=>miniAfford(t)>=CLOCK_FLOOR).map(t=>t.id);
  m.startPrice=Math.max(60, Math.round(clockFair(p)*2.2/5)*5);
  m.price=m.startPrice;
  m.botT={}; m.botDelay={}; m.botReact={}; m.botCross={};
  m.elig.forEach(id=>{
    const t=teamById(id); if(t.isHuman) return;
    const plan=botClockPlan(t,p); // precio al que compra y tiempo de reacción, según la dificultad
    m.botT[id]=plan.T;
    m.botReact[id]=plan.react;
    m.botDelay[id]=250+Math.random()*350;
  });
  m.t0=Date.now();
  // Un jugador vs bots: si el humano no está en juego por este jugador (o ya completó su plantel) no hace falta
  // esperar el reloj en vivo: se resuelve al instante. Si ningún humano necesita jugadores, ni se muestra.
  m.humanIn = m.elig.some(id=>teamById(id).isHuman);
  // "Pasar x10": si hay bots en juego, tu equipo no compra este jugador y se resuelve rápido entre los bots
  m.skipping = state.mode==="ia" && (m.skipLeft||0)>0 && m.elig.some(id=>!teamById(id).isHuman);
  if(m.skipping) m.skipLeft--;
  updateMiniSkipBtn();
  m.quick = state.mode==="ia" && (!m.humanIn || m.skipping);
  m.instant = state.mode==="ia" && !state.teams.some(t=>t.isHuman && t.roster.length<squadSize());
  if(m.quick || m.instant){ miniQuickResolve(); return; }
  miniRender();
  if(m.elig.length===0){ miniUnsold(); return; }
  m.timerId=setInterval(miniTick, CLOCK_TICK_MS);
}

function miniPriceNow(){
  const m=state.mini;
  const frac=Math.min(1,(Date.now()-m.t0)/clockDur());
  return Math.max(CLOCK_FLOOR, Math.round(m.startPrice-(m.startPrice-CLOCK_FLOOR)*frac));
}

function miniTick(){
  const m=state.mini;
  if(!m || m.phase!=="running"){ if(m && m.timerId){ clearInterval(m.timerId); m.timerId=null; } return; }
  const el=Date.now()-m.t0;
  m.price=miniPriceNow();
  // ¿algún bot se anima a comprar? gana el que más valora al jugador
  const ready=m.elig.filter(id=>{
    const t=teamById(id);
    if(t.isHuman || el<m.botDelay[id]) return false;
    if(!(m.price<=m.botT[id] && m.price<=miniAfford(t))) return false;
    // el bot ve que el precio llegó a lo que quería, pero tarda un rato en apretar (más en Fácil, casi nada en Difícil)
    if(m.botCross[id]===undefined) m.botCross[id]=Date.now();
    return Date.now()-m.botCross[id]>=m.botReact[id];
  });
  if(ready.length){
    ready.sort((a,b)=>(m.botT[b]-m.botT[a]) || (Math.random()-0.5));
    miniBuy(ready[0]); return;
  }
  if(el>=clockDur()){
    if(m.holdAt===null) m.holdAt=Date.now();
    else if(Date.now()-m.holdAt>=(state.mode==="ia" ? CLOCK_HOLD_SOLO_MS : CLOCK_HOLD_MS)){ miniUnsold(); return; }
  }
  miniTickUI();
}

/* Resolución instantánea de una ronda sin humanos: compra el bot que más valora al jugador (a lo que pagaría) */
function miniQuickResolve(){
  const m=state.mini;
  const cands=m.elig.filter(id=>!teamById(id).isHuman && m.botT[id]>0)
    .map(id=>({id, eff:Math.min(m.botT[id], miniAfford(teamById(id)))}));
  if(!cands.length){ miniUnsold(); return; }
  cands.sort((a,b)=>(b.eff-a.eff)||(Math.random()-0.5));
  const price=Math.max(CLOCK_FLOOR, Math.min(m.startPrice, Math.round(cands[0].eff)));
  miniBuy(cands[0].id, price);
}

function miniBuy(teamId, forcedPrice){
  const m=state.mini;
  if(!m || m.phase!=="running") return;
  const t=teamById(teamId);
  if(!t || !m.elig.includes(teamId)) return;
  const price=forcedPrice!==undefined ? forcedPrice : miniPriceNow();
  if(price>miniAfford(t)) return;
  if(m.timerId){ clearInterval(m.timerId); m.timerId=null; }
  m.phase="sold";
  const p=m.player;
  t.roster.push(p.id); t.budget-=price; m.totalDone++;
  m.lastBuyer=t.id;
  miniLog(`⏱️ ${t.name} fichó un ${p.pos} de ${p.country} por ${fmtM(price)}`,"sold");
  m.reveal={player:p, team:t, price, unsold:false};
  m.player=null;
  updateMiniPill();
  if(m.instant){ miniNext(); return; } // simulación al instante: sin mostrar nada
  const held=miniHoldReveal();
  miniRender();
  if(!held) m.nextId=setTimeout(miniNext, m.skipping ? 120 : (m.quick ? 600 : 2000));
}

function miniUnsold(){
  const m=state.mini; if(!m) return;
  if(m.timerId){ clearInterval(m.timerId); m.timerId=null; }
  m.phase="sold";
  const p=m.player;
  miniLog(`Nadie fichó al ${p.pos} de ${p.country}. Vuelve al final de la lista.`,"unsold");
  m.recycled[p.id]=(m.recycled[p.id]||0)+1;
  if(m.recycled[p.id]<=2) (p.pos==="POR" ? m.porPool : m.restPool).push(p.id);
  m.reveal={player:p, team:null, price:0, unsold:true};
  m.player=null; m.lastBuyer=null;
  if(m.instant){ miniNext(); return; }
  const held=miniHoldReveal();
  miniRender();
  if(!held) m.nextId=setTimeout(miniNext, m.skipping ? 120 : (m.quick ? 500 : 1600));
}

function miniFill(){
  // Seguridad: si se agotó la lista, se completan los planteles por sorteo al precio mínimo
  const m=state.mini;
  const owned=new Set(); state.teams.forEach(t=>t.roster.forEach(id=>owned.add(id)));
  const free=shuffle(poolPlayers().filter(p=>!owned.has(p.id)));
  const take=(team,pred)=>{
    const i=free.findIndex(pred); if(i<0) return;
    const p=free.splice(i,1)[0];
    team.roster.push(p.id); team.budget=Math.max(0,team.budget-CLOCK_FLOOR); m.totalDone++;
    miniLog(`${team.name} recibe un ${p.pos} por sorteo (${fmtM(CLOCK_FLOOR)})`,"sold");
  };
  state.teams.forEach(t=>{ if(!teamHasPos(t,"POR")) take(t,p=>p.pos==="POR"); });
  state.teams.forEach(t=>{ while(t.roster.length<squadSize() && free.length) take(t,p=>p.pos!=="POR"); });
}

/* Tras revelar al jugador, El Reloj queda en pausa hasta que se toque "Siguiente oferta".
   Si ningún humano estaba en juego por ese jugador (solo bots), sigue solo como antes. */
function miniHoldReveal(){
  const m=state.mini;
  const hold = (state.mode!=="ia" || m.elig.some(id=>teamById(id).isHuman)) && !m.skipping;
  m.awaitNext = hold;
  m.nextReadyAt = Date.now()+NEXT_LOCK_MS;
  return hold;
}
function miniContinue(){
  const m=state.mini;
  if(!m || !m.awaitNext || Date.now()<m.nextReadyAt) return;
  m.awaitNext=false;
  miniNext();
}

function miniFinish(){
  clearMiniTimers();
  state.mini=null;
  finishAuction(); // mercado (si está activado) -> competencia elegida
}

/* Botón "Pasar x10" (El Reloj, un jugador) */
function updateMiniSkipBtn(){
  const b=document.getElementById("miniSkipBtn"); if(!b) return;
  const m=state.mini;
  const on = !!m && state.mode==="ia" && state.skipUses!==0;
  b.style.display = on ? "" : "none";
  if(!on) return;
  b.textContent = skipBtnText(m.skipLeft, m.skipUses);
  b.disabled = m.skipLeft<=0 && m.skipUses<=0;
}
function miniSkip10(){
  const m=state.mini; if(!m || state.mode!=="ia") return;
  if(m.skipLeft>0){ m.skipLeft=0; m.skipping=false; updateMiniSkipBtn(); return; } // Detener (el uso ya gastado no se devuelve)
  if(m.skipUses<=0 || state.skipUses===0) return;
  if(m.skipUses!==Infinity) m.skipUses--;
  m.skipLeft=10;
  if(m.phase==="running" && m.player){
    if(m.elig.some(id=>!teamById(id).isHuman)){ // el jugador en curso también se lo dejás a los bots
      if(m.timerId){ clearInterval(m.timerId); m.timerId=null; }
      m.skipLeft=9; m.skipping=true; m.quick=true;
      miniQuickResolve();
    }
  } else if(m.awaitNext){ m.nextReadyAt=0; miniContinue(); }
  updateMiniSkipBtn();
}
document.getElementById("miniSkipBtn").addEventListener("click",function(){ this.blur(); miniSkip10(); });

function miniRender(){
  const m=state.mini; if(!m) return;
  updateMiniSkipBtn();
  const box=document.getElementById("miniPlayerBox");
  if(m.player){
    const p=m.player;
    box.innerHTML=`
      <div class="country-tag">${countryFlag(p.country)} ${p.country}</div>
      <div class="pos-tag" style="background:${posBg(p.pos)};color:${posFg(p.pos)}">${p.pos}</div>
      <div class="mystery">???</div>
      <div style="color:var(--muted-2); font-size:12px; margin-top:2px;">nombre, club y media anónimos</div>
      <div class="auction-price"><span class="amount" id="miniPrice">${fmtM(m.price)}</span><span class="cap">y bajando… (${state.clockSecs}s)</span></div>
      <div class="clock-bar"><div class="clock-fill" id="miniFill"></div></div>
      <div class="auction-bidder">${m.stage==="por" ? "Ronda de arqueros (solo equipos sin arquero)" : "Ronda libre"}</div>`;
  } else if(m.reveal){
    const r=m.reveal;
    box.innerHTML=`
      <div class="reveal-box">
        <div class="reveal-tag">${r.unsold ? "Sin comprador" : "¡Fichaje cerrado!"}</div>
        <div class="reveal-name">${r.player.name}</div>
        <div class="ovr">${r.player.pos} · Media <b>${r.player.ovr}</b> · ${r.player.club} (${r.player.country})</div>
        <div class="reveal-result" style="margin-top:10px;">
          ${r.unsold ? "El reloj llegó al mínimo y nadie lo quiso." : `Se lo llevó <b style="color:${r.team.color}">${r.team.name}</b> por <b>${fmtM(r.price)}</b>`}
        </div>
      </div>`;
  } else {
    box.innerHTML='<div class="empty-note">Preparando el próximo jugador...</div>';
  }

  // botones de los equipos humanos
  const btns=document.getElementById("miniButtons");
  btns.innerHTML="";
  if(m.awaitNext && !m.player) btns.appendChild(makeNextBtn(teamsNeedingPlayers().length===0, m.nextReadyAt, miniContinue));
  else state.teams.forEach((t,i)=>{
    if(!t.isHuman) return;
    const b=document.createElement("button");
    b.type="button"; b.className="clock-btn"; b.dataset.team=t.id;
    b.style.setProperty("--tc", t.color);
    const key = (state.mode==="ia" || (window.ONL && ONL.active)) ? "Espacio" : (CLOCK_KEYS[i]||"");
    b.innerHTML=`<span class="ck">${key}</span><span class="nm">${t.name}</span>
      <span class="sub">${fmtM(t.budget)} · ${t.roster.length}/${squadSize()}</span><span class="go">¡FICHAR!</span>`;
    const fire=(e)=>{ e.preventDefault(); miniBuy(t.id); };
    b.addEventListener("pointerdown",fire);
    b.addEventListener("click",fire);
    btns.appendChild(b);
  });
  miniTickUI();

  // log
  document.getElementById("miniLog").innerHTML = m.log.slice().reverse().map(e=>`<div class="entry ${e.cls}">${e.msg}</div>`).join("");

  // lista de equipos
  const tb=document.getElementById("miniTeams");
  tb.innerHTML="";
  state.teams.forEach(t=>{
    const row=document.createElement("div");
    row.className="auction-team"+(m.lastBuyer===t.id?" leading":"")+(t.roster.length>=squadSize()?" full":"");
    row.innerHTML=`<span class="dot" style="background:${t.color}"></span>
      <span class="nm">${t.name}${t.isHuman?(state.mode==="ia"?' <span class="human-badge">TÚ</span>':''):' <span class="cpu-badge">BOT</span>'}${t.roster.length>=squadSize() && teamBalance(t).level!=="ok" ? '<span class="bal-chip" title="Plantel desequilibrado: será castigado en los partidos">⚠️ desequilibrado</span>' : ''}</span>
      <span class="cnt">${teamHasPos(t,"POR")?"🧤":""} ${t.roster.length}/${squadSize()}</span>
      <span class="bud">${fmtM(t.budget)}</span>`;
    tb.appendChild(row);
  });
}

// Actualiza solo precio, barra y botones (sin reconstruir el DOM, para no perder clics)
function miniTickUI(){
  const m=state.mini; if(!m) return;
  const running = m.phase==="running" && m.player;
  const pe=document.getElementById("miniPrice");
  if(pe) pe.textContent=fmtM(m.price);
  const fill=document.getElementById("miniFill");
  if(fill){
    const pct=Math.max(0,Math.min(100,(m.price-CLOCK_FLOOR)/Math.max(1,m.startPrice-CLOCK_FLOOR)*100));
    fill.style.width=pct+"%";
    fill.className="clock-fill"+(pct<25?" lo":pct<55?" mid":"");
  }
  document.querySelectorAll("#miniButtons .clock-btn").forEach(b=>{
    const t=teamById(Number(b.dataset.team));
    b.disabled = !(running && t && m.elig.includes(t.id) && m.price<=miniAfford(t));
  });
}

document.addEventListener("keydown",(e)=>{
  const m=state.mini;
  if(!m || m.phase!=="running") return;
  if(e.repeat) return; // mantener apretada la tecla no debe fichar de golpe al arrancar el próximo jugador
  if(!document.getElementById("screen-mini").classList.contains("active")) return;
  const tag=(e.target && e.target.tagName ? e.target.tagName : "").toLowerCase();
  if(tag==="input" || tag==="select" || tag==="textarea") return;
  if(e.ctrlKey || e.metaKey || e.altKey) return;
  if(state.mode==="ia"){
    if(e.code==="Space"){ e.preventDefault(); const me=state.teams.find(t=>t.isHuman); if(me) miniBuy(me.id); }
    return;
  }
  if(window.ONL && ONL.active){ if(e.code==="Space"){ e.preventDefault(); miniBuy(ONL.myId); } return; } // online: tu equipo, tecla Espacio
  const idx=CLOCK_KEYS.indexOf(e.key.toLowerCase());
  if(idx>=0 && idx<state.teams.length && state.teams[idx].isHuman) miniBuy(state.teams[idx].id);
});

/* Atajo para "Siguiente oferta" (Puja y El Reloj): Enter o Espacio.
   Va DESPUÉS del atajo de fichar a propósito: así la misma pulsación no ficha al jugador que recién arranca. */
document.addEventListener("keydown",(e)=>{
  if(e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if(e.key!=="Enter" && e.code!=="Space") return;
  const tag=(e.target && e.target.tagName ? e.target.tagName : "").toLowerCase();
  if(["input","select","textarea","button","a"].includes(tag)) return;
  const on=id=>document.getElementById(id).classList.contains("active");
  if(state.mini && state.mini.awaitNext && on("screen-mini")){ e.preventDefault(); miniContinue(); }
  else if(state.auction && state.auction.awaitNext && on("screen-draft")){ e.preventDefault(); auctionContinue(); }
});
