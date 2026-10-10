/* ---------- Partidos en vivo ---------- */
const MAX_LIVE=4; // máximo de partidos simulados en vivo a la vez en la fase eliminatoria
let liveRun=null;
const TICK_MS=620; // cada "minuto" dura 0,62 s reales a velocidad x1 (un partido de 90' ≈ 1 minuto)

function roundTitle(round){
  const n=round.teamsInRound;
  if(n<=1) return "Campeón directo";
  if(n<=2) return "Final";
  if(n<=4) return "Semifinales";
  if(n<=8) return "Cuartos de final";
  if(n<=16) return "Octavos de final";
  return "Ronda";
}
function minTxt(m){ return m==="PEN" ? "PEN" : m+"'"; }
function clockTxt(m){ return m==="PEN" ? "PEN" : m+"'"; }

function updateLiveSub(run){
  const parts=[];
  if(run.carryOn) parts.push(`Global: ${run.carryHome+run.hs} – ${run.carryAway+run.as}`);
  if(run.penOn) parts.push(`Penales: ${run.ph} – ${run.pa}`);
  run.el.querySelector(".live-sub").textContent=parts.join(" · ");
}

function buildLiveCard(run, grid){
  const leg=run.leg;
  const home=playoffTeam(leg.home), away=playoffTeam(leg.away);
  const div=document.createElement("div");
  div.className="live-card"+((isMe(home)||isMe(away))?" has-me":"");
  div.innerHTML=`
    <div class="live-head"><span class="live-badge">● EN VIVO</span><span class="live-round">${run.label}</span><span class="live-clock">0'</span></div>
    <div class="live-score"><span class="lt" style="color:${home.color}">${meBadge(home)}${home.name}${run.neutral?'':'<small class="side-tag">(Local)</small>'}</span><b class="ls">0 – 0</b><span class="lt right" style="color:${away.color}">${meBadge(away)}${away.name}${run.neutral?'':'<small class="side-tag">(Visitante)</small>'}</span></div>
    <div class="live-sub"></div>
    <div class="live-feed"></div>`;
  grid.appendChild(div);
  return div;
}

function addFeedItem(run, f){
  const feedEl=run.el.querySelector(".live-feed");
  const row=document.createElement("div");
  if(f.neutral){
    row.className="fe neutral"+(f.big?" big":"");
    row.innerHTML=`<span class="fm">${minTxt(f.minute)}</span><span>${f.text}</span>`;
  } else if(f.pen){
    const t=playoffTeam(f.teamId);
    row.className="fe pen "+(f.scored?"pen-ok":"pen-no");
    row.innerHTML=`<span class="fm">PEN</span><span class="ftag">Penal</span><span>(${t.name}) ${f.outcome}</span>`;
  } else {
    const t=playoffTeam(f.teamId);
    row.className="fe"+(f.isGoal?" goal":"")+(f.agonic?" agonic":"");
    row.innerHTML=`<span class="fm">${f.minute}'</span><span class="ftag">${f.type}</span><span>(${t.name}) ${f.outcome}</span>`;
  }
  // los mensajes se agregan ABAJO y el cuadro baja solo (si no estás leyendo más arriba)
  const nearBottom = feedEl.scrollHeight-feedEl.scrollTop-feedEl.clientHeight < 60;
  feedEl.appendChild(row);
  if(nearBottom) feedEl.scrollTop=feedEl.scrollHeight;
}

function startLiveRound(ties, round){
  const btn=document.getElementById("simPlayoffsBtn");
  btn.disabled=true; btn.textContent="Partidos en juego...";
  const box=document.getElementById("liveBox");
  const spd=state.liveSpeed||1;
  box.innerHTML=`<div class="live-controls">
      <div class="speed-group"><span class="speed-lbl">Velocidad</span>${[1,2,4,8].map(v=>`<button class="speed-btn${v===spd?" on":""}" data-speed="${v}">x${v}</button>`).join("")}</div>
      <button class="btn sm" id="pauseLiveBtn">⏸ Pausar</button>
      <button class="btn sm" id="skipLiveBtn">Saltar al final</button>
    </div><div class="live-grid" id="liveGrid"></div>`;
  const grid=document.getElementById("liveGrid");
  // Con varios partidos: todos en la misma fila (máx. 4) y tarjetas compactas
  if(ties.length>=2){ grid.classList.add("cols"); grid.style.setProperty("--cols",Math.min(4,ties.length)); }
  if(ties.length>=3) grid.classList.add("compact");
  const runs=ties.map(tie=>{
    const legIdx=round.leg, leg=tie.legs[legIdx];
    const isLast=legIdx===tie.legs.length-1;
    const second=legIdx>0;
    const carryHome = second ? legGoalsFor(tie.legs[0], leg.home) : 0;
    const carryAway = second ? legGoalsFor(tie.legs[0], leg.away) : 0;
    const neutral=roundIsNeutral(round);
    const plan=planLeg(leg.home, leg.away, {needWinner:isLast, carryHome, carryAway, isSecondLeg:second, neutral, awayRule:state.champions&&state.awayGoals, et:!(state.champions&&!state.champET)});
    const label=roundTitle(round)+(tie.legs.length>1 ? (legIdx===0?" · Ida":" · Vuelta") : "");
    return {tie, leg, plan, neutral, isLast, carryHome, carryAway, carryOn:second, penOn:false, label, el:null, shown:0, hs:0, as:0, ph:0, pa:0, done:false};
  });
  runs.forEach(r=>{ r.el=buildLiveCard(r, grid); updateLiveSub(r); });
  liveRun={runs, round, last:Date.now(), virtual:0, speed:spd, timer:null, paused:false};
  document.getElementById("pauseLiveBtn").addEventListener("click",()=>togglePauseLive());
  document.getElementById("skipLiveBtn").addEventListener("click",()=>{ if(liveRun){ togglePauseLive(false); liveRun.virtual=1e9; } });
  document.querySelectorAll("#liveBox .speed-btn").forEach(b=>{
    b.addEventListener("click",()=>{
      const v=Number(b.dataset.speed);
      state.liveSpeed=v;
      if(liveRun) liveRun.speed=v;
      document.querySelectorAll("#liveBox .speed-btn").forEach(x=>x.classList.toggle("on",x===b));
    });
  });
  liveRun.timer=setInterval(liveTick,100);
  liveTick();
}

function togglePauseLive(force){
  const lr=liveRun; if(!lr) return;
  lr.paused = (typeof force==="boolean") ? force : !lr.paused;
  lr.last=Date.now();
  const btn=document.getElementById("pauseLiveBtn");
  if(btn){
    btn.textContent = lr.paused ? "▶ Reanudar" : "⏸ Pausar";
    btn.classList.toggle("pause-on", lr.paused);
  }
  lr.runs.forEach(run=>{
    if(run.done) return;
    const b=run.el.querySelector(".live-badge");
    b.textContent = lr.paused ? "⏸ EN PAUSA" : "● EN VIVO";
    b.className = "live-badge"+(lr.paused?" paused":"");
  });
}

function commitLeg(run){
  const {tie, leg, plan}=run;
  leg.homeGoals=plan.hg; leg.awayGoals=plan.ag; leg.played=true;
  leg.et=plan.et; leg.pens=plan.pens; leg.events=plan.feed;
  // estadísticas individuales (los penales de la tanda no cuentan como goles)
  plan.feed.forEach(f=>{ if(!f.neutral && !f.pen && f.isGoal) registerGoal(f.playerId, f.assistId); });
  if(plan.ag===0) registerCleanSheet(playoffTeam(leg.home));
  if(plan.hg===0) registerCleanSheet(playoffTeam(leg.away));
  if(tie.legs.every(l=>l.played)){
    const aH=tieAgg(tie,tie.home), aA=tieAgg(tie,tie.away);
    if(aH!==aA) tie.winner = aH>aA ? tie.home : tie.away;
    else if(leg.pens) tie.winner = leg.pens.home>leg.pens.away ? leg.home : leg.away; // definido por penales
    else { const a0=tie.legs[0]; const awH=(a0.away===tie.home?a0.awayGoals:0)+(leg.away===tie.home?leg.awayGoals:0), awA=(a0.away===tie.away?a0.awayGoals:0)+(leg.away===tie.away?leg.awayGoals:0); tie.winner = awH>=awA ? tie.home : tie.away; tie.byAway=true; } // gol de visitante
    tie.played=true;
  }
}

function liveTick(){
  const lr=liveRun; if(!lr) return;
  const nowT=Date.now();
  if(lr.paused){ lr.last=nowT; return; }
  lr.virtual+=(nowT-lr.last)*lr.speed; lr.last=nowT;
  lr.runs.forEach(run=>{
    if(run.done) return;
    const {plan}=run;
    const tickNow=Math.min(plan.T-1, Math.floor(lr.virtual/TICK_MS));
    while(run.shown<plan.feed.length && plan.feed[run.shown].tick<=tickNow){
      const f=plan.feed[run.shown++];
      addFeedItem(run,f);
      if(f.pen){
        run.penOn=true; run.ph=f.ph; run.pa=f.pa; updateLiveSub(run);
      } else if(!f.neutral && f.isGoal){
        if(f.teamId===run.leg.home) run.hs++; else run.as++;
        const lsEl=run.el.querySelector(".ls");
        lsEl.textContent=`${run.hs} – ${run.as}`;
        lsEl.classList.remove("bump"); void lsEl.offsetWidth; lsEl.classList.add("bump"); // reinicia la animación del gol
        updateLiveSub(run);
      }
    }
    const finished = tickNow>=plan.T-1;
    run.el.querySelector(".live-clock").textContent = finished ? "FT" : clockTxt(plan.labels[tickNow]);
    if(finished){
      run.done=true;
      const b=run.el.querySelector(".live-badge"); b.textContent="FINALIZADO"; b.className="live-badge done";
      commitLeg(run);
    }
  });
  if(lr.runs.every(r=>r.done)){
    const pb=document.getElementById("pauseLiveBtn"); if(pb) pb.disabled=true;
    clearInterval(lr.timer);
    liveRun=null;
    afterLiveFinish();
  }
}

function afterLiveFinish(){
  const pf=state.playoffs; const r=pf.rounds[pf.currentRound];
  const legDone=r.ties.every(t=>t.legs[r.leg].played);
  if(!legDone){ renderPlayoffs(); return; }                 // faltan partidos (modo uno por uno)
  if(r.twoLeg && r.leg===0){ r.leg=1; renderPlayoffs(); return; } // ahora vienen las vueltas
  buildNextRound();
}

/* ---------- Controles ---------- */
document.getElementById("simPlayoffsBtn").addEventListener("click",()=>{ advancePlayoffs(); });
/* ---------- Fase de liga: mostrar/ocultar la barra lateral de posiciones ---------- */
(function(){
  const layout=document.getElementById("leagueLayout");
  const handle=document.getElementById("sideHandle");
  let animT=null;
  function setHidden(h,save){
    if(save){ // acción del usuario: animar el cambio de tamaño del contenido
      document.documentElement.classList.add("side-anim");
      clearTimeout(animT);
      animT=setTimeout(()=>document.documentElement.classList.remove("side-anim"),400);
    }
    layout.classList.toggle("side-hidden",h);
    handle.textContent = h ? "◂ Tabla" : "Tabla ▸";
    if(save){ try{ localStorage.setItem("ligaSideHidden",h?"1":"0"); }catch(e){} }
  }
  let saved=null;
  try{ saved=localStorage.getItem("ligaSideHidden"); }catch(e){}
  setHidden(saved===null ? window.innerWidth<=1100 : saved==="1", false);
  const toggle=()=>setHidden(!layout.classList.contains("side-hidden"),true);
  handle.addEventListener("click",toggle);
})();
document.getElementById("viewLeagueBtn").addEventListener("click",()=>{ goToScreen("league"); renderLeague(); });
document.getElementById("goPlayoffsBtn").addEventListener("click",()=>{
  if(state.playoffs){ goToScreen("playoffs"); renderPlayoffs(); return; } // vuelve sin borrar resultados
  setupPlayoffs();
  goToScreen("playoffs");
});
document.querySelectorAll("[data-pm]").forEach(b=>{
  b.addEventListener("click",()=>{
    state.playMode=b.dataset.pm;
    document.querySelectorAll("[data-pm]").forEach(x=>x.classList.toggle("on",x===b));
    if(state.playoffs) renderPlayoffs();
  });
});
document.getElementById("bracketBox").addEventListener("click",(e)=>{
  const btn=e.target.closest(".events-toggle"); if(!btn) return;
  const key=btn.dataset.key;
  const pf=state.playoffs;
  if(pf.expanded.has(key)) pf.expanded.delete(key); else pf.expanded.add(key);
  renderPlayoffs();
});
