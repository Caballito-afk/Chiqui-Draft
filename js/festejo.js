/* =========================================================
   FESTEJO DEL CAMPEÓN
========================================================= */
let confettiAnim=null, confettiCleanup=null;

/* Miniatura del plantel campeón, tal como quedó armado en "Ver plantillas" (o por posición si nunca se tocó) */
function celebrationPitchHTML(t){
  const L=squadEnsureLayout(t);
  const tokens=t.roster.map((pid,i)=>{
    const p=playerById(pid); const pos=L[pid]; if(!p||!pos) return "";
    return `<div class="ptoken p-${p.pos}" style="left:${pos.x}%;top:${pos.y}%;--i:${i}"><div class="disc"><small>${p.pos}</small><b>${p.ovr}</b></div><div class="pn">${p.name}</div></div>`;
  }).join("");
  return `<div class="pitch cel-pitch"><div class="ln mid"></div><div class="ln circle"></div><div class="ln boxT"></div><div class="ln boxB"></div><div class="ln goalT"></div><div class="ln goalB"></div>${tokens}</div>`;
}
/* opt (solo invitados, 100% local): { team:{id,name,color,roster}, label, local:true } */
function showCelebration(teamId, opt){
  opt=opt||{};
  const t=opt.team||playoffTeam(teamId);
  const label=opt.label||compLabel();
  const ov=document.getElementById("celebrate");
  ov.classList.remove("sad","sadder");
  ov.innerHTML=`<canvas id="confettiCanvas"></canvas>
    <div class="cel-card">
      <div class="cel-trophy">🏆</div>
      <div class="cel-kicker">¡Campeón de la ${label}!</div>
      <div class="cel-name" style="color:${t.color}">${t.name}</div>
      ${celebrationPitchHTML(t)}
      <div class="btn-row" style="justify-content:center">
        <button class="btn gold" id="celCloseBtn">Ver cuadro</button>
      </div>
      ${opt.local?"":`<div class="bottom-actions" style="margin-top:46px;">
        <button class="btn sm" id="celNewBtn" type="button">🔄 Nuevo torneo</button>
      </div>`}
    </div>`;
  ov.classList.add("show");
  document.getElementById("celCloseBtn").addEventListener("click",hideCelebration);
  const newBtn=document.getElementById("celNewBtn");
  if(newBtn) newBtn.addEventListener("click",async()=>{
    if(await askConfirm({icon:"🏆", title:"¿Empezar un torneo nuevo?", msg:"Se pierde este cuadro y todos los resultados."})) (localStorage.removeItem('chiquiSave_v1'),location.reload());
  });
  startConfetti(document.getElementById("confettiCanvas"), [t.color,"#f0b90b","#ffffff","#35d17c","#5b8def","#e5484d"]);
}

function hideCelebration(){
  const ov=document.getElementById("celebrate");
  ov.classList.remove("show","sad","sadder");
  if(confettiAnim){ cancelAnimationFrame(confettiAnim); confettiAnim=null; }
  if(confettiCleanup){ confettiCleanup(); confettiCleanup=null; }
}

function startConfetti(canvas, colors){
  if(confettiAnim){ cancelAnimationFrame(confettiAnim); confettiAnim=null; }
  if(confettiCleanup){ confettiCleanup(); confettiCleanup=null; }
  if(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const ctx=canvas.getContext("2d");
  const fit=()=>{ canvas.width=window.innerWidth; canvas.height=window.innerHeight; };
  fit();
  window.addEventListener("resize",fit);
  confettiCleanup=()=>window.removeEventListener("resize",fit);
  const parts=[];
  const rnd=(a,b)=>a+Math.random()*(b-a);
  const spawn=(x,y,vx,vy)=>parts.push({x,y,vx,vy,w:rnd(6,12),h:rnd(4,8),rot:rnd(0,6.28),vr:rnd(-.3,.3),c:colors[Math.floor(Math.random()*colors.length)]});
  const burst=()=>{
    for(let i=0;i<70;i++){
      spawn(0,canvas.height,rnd(6,16),-rnd(12,26));
      spawn(canvas.width,canvas.height,-rnd(6,16),-rnd(12,26));
    }
  };
  burst();
  const start=performance.now();
  let lastBurst=start;
  const frame=(now)=>{
    const el=now-start;
    if(el<12000){
      for(let i=0;i<3;i++) spawn(rnd(0,canvas.width),-10,rnd(-1.5,1.5),rnd(2,5));
      if(now-lastBurst>2500){ burst(); lastBurst=now; }
    }
    ctx.clearRect(0,0,canvas.width,canvas.height);
    for(let i=parts.length-1;i>=0;i--){
      const p=parts[i];
      p.vy+=0.35; p.vx*=0.992; p.x+=p.vx; p.y+=p.vy; p.rot+=p.vr;
      if(p.y>canvas.height+30){ parts.splice(i,1); continue; }
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot);
      ctx.fillStyle=p.c; ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);
      ctx.restore();
    }
    if(el<12000 || parts.length) confettiAnim=requestAnimationFrame(frame);
    else confettiAnim=null;
  };
  confettiAnim=requestAnimationFrame(frame);
}
document.addEventListener("keydown",(e)=>{ if(e.key==="Escape") hideCelebration(); });

/* ---------- ELIMINADO (modo Un jugador): como el festejo, pero triste ---------- */
function startRain(canvas,heavy){
  if(confettiAnim){ cancelAnimationFrame(confettiAnim); confettiAnim=null; }
  if(confettiCleanup){ confettiCleanup(); confettiCleanup=null; }
  if(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const ctx=canvas.getContext("2d");
  const fit=()=>{ canvas.width=window.innerWidth; canvas.height=window.innerHeight; };
  fit();
  window.addEventListener("resize",fit);
  confettiCleanup=()=>window.removeEventListener("resize",fit);
  const rnd=(a,b)=>a+Math.random()*(b-a);
  const N=Math.min(heavy?300:160,Math.round(window.innerWidth/(heavy?4.5:8)));
  const drops=Array.from({length:N},()=>({x:rnd(0,canvas.width), y:rnd(0,canvas.height), l:rnd(10,22), v:rnd(9,16)}));
  const frame=()=>{
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.strokeStyle=heavy?"rgba(130,155,195,.28)":"rgba(150,175,215,.32)"; ctx.lineWidth=1.2; ctx.beginPath();
    drops.forEach(d=>{
      ctx.moveTo(d.x,d.y); ctx.lineTo(d.x-2,d.y+d.l);
      d.y+=d.v*(heavy?.8:1); d.x-=0.6;
      if(d.y>canvas.height+20){ d.y=-rnd(10,60); d.x=rnd(0,canvas.width+40); }
    });
    ctx.stroke();
    confettiAnim=requestAnimationFrame(frame);
  };
  confettiAnim=requestAnimationFrame(frame);
}
function showEliminated(t,o){
  const ov=document.getElementById("celebrate");
  const btns=(o.buttons||[]).map((b,i)=>`<button class="btn ${b.cls||""}" id="elimBtn${i}" type="button">${b.label}</button>`).join("");
  ov.innerHTML=`<canvas id="confettiCanvas"></canvas>
    <div class="cel-card${(o.teams&&o.teams.length>1)?" wide":""}">
      <div class="cel-trophy">${o.icon||"😢"}</div>
      <div class="cel-kicker">${o.kicker||"Quedaste"}</div>
      <div class="cel-name">${o.title||"ELIMINADO"}</div>
      <div class="sad-sub">${o.sub||""}</div>
      ${o.extra?`<div class="sad-extra">${o.extra}</div>`:""}
      ${(o.teams&&o.teams.length>1) ? '<div class="multi-pitch" style="--mw:clamp(105px,min(340px,calc((96vw - 56px) / '+o.teams.length+' - 12px),calc((var(--vh) - 330px) * .8333)),340px)">'+o.teams.map(x=>'<div class="mp-team"><div class="mp-name" style="color:'+x.color+'">'+x.name+'</div>'+celebrationPitchHTML(x)+'</div>').join('')+'</div>' : celebrationPitchHTML(t)}
      <div class="btn-row sad-actions">${btns}</div>
      <div class="bottom-actions" style="margin-top:46px;">
        <button class="btn sm" id="celNewBtn" type="button">🔄 Nuevo torneo</button>
      </div>
    </div>`;
  ov.classList.add("show","sad");
  ov.classList.toggle("sadder",!!o.sadder);
  (o.buttons||[]).forEach((b,i)=>{
    document.getElementById("elimBtn"+i).addEventListener("click",()=>{ hideCelebration(); if(b.fn) b.fn(); });
  });
  document.getElementById("celNewBtn").addEventListener("click",async()=>{
    if(await askConfirm({icon:"🏆", title:"¿Empezar un torneo nuevo?", msg:"Se pierde este cuadro y todos los resultados."})) (localStorage.removeItem('chiquiSave_v1'),location.reload());
  });
  startRain(document.getElementById("confettiCanvas"),!!o.sadder);
  if(window.chiquiSfx) window.chiquiSfx.play("penMiss");
}

/* Eliminatoria: ¿tu equipo (Un jugador) perdió algún cruce? */
function humanPlayoffsElimination(pf){
  if(state.mode!=="ia") return null;
  const me=state.teams.find(t=>t.isHuman); if(!me) return null;
  for(const r of pf.rounds){
    for(const tie of (r.ties||[])){
      if(tie.played && tie.winner!==me.id && (tie.home===me.id || tie.away===me.id)) return {me, tie, round:r};
    }
  }
  return null;
}
function showHumanPlayoffsElimination(el){
  const pf=state.playoffs; if(!pf) return;
  const opp=playoffTeam(el.tie.home===el.me.id ? el.tie.away : el.tie.home);
  const title=el.round.teamsInRound ? titleForTeams(el.round.teamsInRound).toLowerCase() : "";
  const done = pf.champion!==null && pf.champion!==undefined;
  const buttons=[];
  if(done) buttons.push({label:"🏆 Ver campeón", cls:"gold", fn:()=>showCelebration(pf.champion)});
  buttons.push({label: done ? "Ver cuadro" : "Seguir viendo el torneo", cls: done ? "" : "gold", fn:null});
  showEliminated(el.me,{
    sub:`<b style="color:${el.me.color}">${el.me.name}</b> cayó ante ${opp?opp.name:"su rival"}${title?" en "+title:""}.`,
    buttons
  });
}
/* ---------- Easter egg: festejo de Argentina (estrella del medio del inicio) ---------- */
function showArgentinaCelebration(){
  const ov=document.getElementById("celebrate");
  ov.classList.remove("sad","sadder");
  ov.innerHTML=`<canvas id="confettiCanvas"></canvas>
    <div class="cel-card">
      <div class="cel-trophy">🏆</div>
      <div class="arg-flag" aria-hidden="true"></div>
      <div class="cel-name arg-name" aria-label="Argentina">${"ARGENTINA".split("").map((ch,i)=>`<span class="${i%2?"w":"c"}" aria-hidden="true">${ch}</span>`).join("")}</div>
      <div class="arg-stars" aria-hidden="true">★ ★ ★</div>
      <div class="arg-years"><div class="arg-year">1978</div><div class="arg-year">1986</div><div class="arg-year">2022</div></div>
      <div class="btn-row" style="justify-content:center">
        <button class="btn gold" id="argCloseBtn" type="button">Salir del festejo</button>
      </div>
    </div>`;
  ov.classList.add("show");
  document.getElementById("argCloseBtn").addEventListener("click",hideCelebration);
  startConfetti(document.getElementById("confettiCanvas"), ["#75aadb","#ffffff","#f6c515","#75aadb","#ffffff","#a9cdee"]);
  if(window.chiquiSfx) window.chiquiSfx.play("fanfare");
}
document.getElementById("easterStar").addEventListener("click",showArgentinaCelebration);


// Vuelve a la pantalla de ajustes y limpia la partida (los nombres escritos se conservan)
let _themeT=null;
function applyTheme(t,animate){
  if(animate){ // fundido suave de colores solo cuando el usuario cambia el tema
    document.documentElement.classList.add("theme-anim");
    clearTimeout(_themeT);
    _themeT=setTimeout(()=>document.documentElement.classList.remove("theme-anim"),500);
  }
  document.documentElement.setAttribute("data-theme",t);
  try{ localStorage.setItem("ligaTheme",t); }catch(e){}
  const b=document.getElementById("themeToggle");
  b.textContent = t==="light" ? "🌙" : "☀️";
  b.title = t==="light" ? "Cambiar a modo oscuro" : "Cambiar a modo claro";
}
(function initTheme(){
  const cur=document.documentElement.getAttribute("data-theme")||"dark";
  applyTheme(cur);
  document.getElementById("themeToggle").addEventListener("click",()=>{
    applyTheme(document.documentElement.getAttribute("data-theme")==="light" ? "dark" : "light", true);
  });
})();

function backToMenu(){
  stopAuto(); _stPrev=null;
  if(liveRun){ clearInterval(liveRun.timer); liveRun=null; }
  if(state.auction) clearFreeTimer();
  clearMiniTimers();
  hideCelebration();
  state.auction=null; state.market=null; state.mini=null;
  state.fixture=[]; state.currentMd=0; state.standings={}; state.scorers={};
  state.playoffs=null; state.disc={}; state.leagueCelebrated=false; state.humanElimLeague=false; state.skipLeague=false;
  state.teams=[];
  document.getElementById("liveBox").innerHTML="";
  document.getElementById("championBox").innerHTML="";
  document.getElementById("relegatedBox").innerHTML="";
  document.getElementById("leagueChampionBox").innerHTML="";
  document.getElementById("awardsBox").innerHTML="";
  document.getElementById("playoffsAwardsBox").innerHTML="";
  document.getElementById("bracketBox").innerHTML="";
  updateSteps();
  showHomeRoot();
  goToScreen("home");
  window.scrollTo(0,0);
}

// Reinicia la partida y vuelve a la pantalla de configuración del mismo modo (Puja / Aleatorio / El Reloj, con bots o local)
function restartGame(){
  const g=state.game, m=state.mode;
  backToMenu();
  if(g && m) startGameMode(g,m);
}
document.querySelectorAll(".restart-btn").forEach(b=>{
  b.addEventListener("click",()=>{
    askConfirm({icon:"🔄", title:"¿Reiniciar la partida?", msg:"Se pierde todo el progreso y volvés a la configuración del modo actual."}).then(ok=>{ if(ok) restartGame(); });
  });
});
const MENU_CONFIRM={icon:"🏠", title:"¿Volver al menú?", msg:"Se pierde el progreso de la partida actual."};
document.getElementById("marketMenuBtn").addEventListener("click",()=>{
  askConfirm(MENU_CONFIRM).then(ok=>{ if(ok) backToMenu(); });
});
document.querySelectorAll(".menu-btn").forEach(b=>{
  b.addEventListener("click",()=>{
    askConfirm(MENU_CONFIRM).then(ok=>{ if(ok) backToMenu(); });
  });
});

// Ajusta tipografía y espaciado de la tabla de posiciones para que entre completa en la barra, sin scroll y sin quitar columnas
function fitStandingsSidebar(){
  const inner=document.querySelector("#leagueSide .league-side-inner");
  if(!inner || !inner.clientHeight) return;
  let fs=12, pad=4;
  const apply=()=>{ inner.style.setProperty("--st-fs",fs+"px"); inner.style.setProperty("--st-pad",pad+"px"); };
  apply();
  while(inner.scrollHeight>inner.clientHeight+1 && (pad>1 || fs>9)){
    if(pad>1) pad=Math.max(1,pad-0.5); else fs-=0.5;
    apply();
  }
}
window.addEventListener("resize",fitStandingsSidebar);

function feedRowSaved(f){
  if(f.neutral) return `<div class="event-row neutral"><span class="min">${minTxt(f.minute)}</span><span class="txt">${f.text}</span></div>`;
  const t=playoffTeam(f.teamId);
  if(f.pen) return `<div class="event-row ${f.scored?'goal':''}"><span class="min">PEN</span><span class="type-tag">Penal</span><span class="txt">(${t.name}) ${f.outcome}</span></div>`;
  return `<div class="event-row ${f.isGoal?'goal':''}${f.agonic?' agonic':''}"><span class="min">${f.minute}'</span><span class="type-tag">${f.type}</span><span class="txt">(${t.name}) ${f.outcome}</span></div>`;
}

function playBtnLabel(){
  const pf=state.playoffs; const r=pf.rounds[pf.currentRound];
  const legTxt = r && r.twoLeg ? (r.leg===0 ? " · ida" : " · vuelta") : "";
  if(state.playMode==="one") return "Jugar siguiente partido"+legTxt;
  const pend = r ? r.ties.filter(t=>!t.legs[r.leg].played).length : 0;
  const partial = r && pend>0 && pend<r.ties.length;   // ya se jugó una tanda de esta ronda
  const more = pend>MAX_LIVE ? ` (${MAX_LIVE} de ${pend})` : "";
  if(r && r.twoLeg) return (partial ? "Jugar siguientes partidos de " : "Jugar partidos de ") + (r.leg===0 ? "ida" : "vuelta") + more;
  return (partial ? "Jugar siguientes partidos" : (pend>MAX_LIVE ? "Jugar partidos" : "Jugar siguiente ronda")) + more;
}

function renderPlayoffs(){
  const pf=state.playoffs;
  const box=document.getElementById("bracketBox");
  box.innerHTML="";

  const prevScroll=box.scrollLeft;

  // Tarjeta de un cruce (solo nombres y resultados)
  const tieCard=(t,ri,si)=>{
    const home=playoffTeam(t.home), away=playoffTeam(t.away);
    const two=t.legs.length>1;
    const anyPlayed=t.legs.some(l=>l.played);
    const lastLeg=t.legs[t.legs.length-1];
    const rd=pf.rounds[ri]; const singleHome = !two && !(rd && roundIsNeutral(rd)); // en ida y vuelta la localía cambia por partido, así que solo se marca en cruces de partido único
    const row=(team)=>{
      const win=t.played && t.winner===team.id;
      let tag = singleHome && t.legs[0] ? (t.legs[0].home===team.id ? '<small class="side-tag">(Local)</small>' : '<small class="side-tag">(Visitante)</small>') : '';
      if(two && team.id===t.home) tag = '<small class="side-tag">(Cierra de local)</small>'; // el mejor sembrado juega la vuelta en su cancha
      let sc="";
      if(anyPlayed){
        const parts=t.legs.map(l=>l.played ? legGoalsFor(l,team.id) : "–");
        const pen=(t.played && lastLeg.pens) ? `<span class="bm-pen">(${lastLeg.home===team.id?lastLeg.pens.home:lastLeg.pens.away})</span>` : "";
        sc = two
          ? `<span class="bm-legs">${parts.join(" · ")}</span><span class="bm-score">${tieAgg(t,team.id)}</span>${pen}`
          : `<span class="bm-score">${parts[0]}</span>${pen}`;
      }
      const gv = (win && t.byAway) ? '<span class="bm-gv" title="Avanza por gol de visitante">GV</span>' : "";
      return `<div class="bm-row ${win?'winner':''}${isMe(team)?' me':''}"><span title="${team.name}">${meBadge(team)}${team.name}${tag}</span><span class="bm-right">${gv}${sc}</span></div>`;
    };
    let html=row(home)+row(away);
    if(t.played){
      if(t.byAway) html+=`<div class="bm-note">Pasa por gol de visitante (GV)</div>`;
      else if(lastLeg.pens) html+=`<div class="bm-note">Definido por penales</div>`;
      else if(lastLeg.et) html+=`<div class="bm-note">Definido en la prórroga</div>`;
    }
    // "Ver jugadas": una sola fila compacta (ida | vuelta lado a lado) y debajo los paneles abiertos
    const withEv=t.legs.map((l,li)=>({l,li})).filter(x=>x.l.played && x.l.events.length);
    if(withEv.length){
      html+=`<div class="events-toggles">`+withEv.map(({li})=>{
        const key=`${ri}-${si}-${li}`;
        const isOpen=pf.expanded.has(key);
        const lbl = two ? (li===0?"ida":"vuelta") : "jugadas";
        return `<button class="events-toggle" data-key="${key}">${isOpen?"Ocultar":"Ver"} ${lbl} ${isOpen?"▲":"▼"}</button>`;
      }).join("")+`</div>`;
      withEv.forEach(({l,li})=>{
        const key=`${ri}-${si}-${li}`;
        if(!pf.expanded.has(key)) return;
        html+=`<div class="events-panel">`+(two?`<div class="ev-leg">${li===0?"Ida":"Vuelta"}</div>`:"")+l.events.map(feedRowSaved).join("")+`</div>`;
      });
    }
    const div=document.createElement("div");
    div.className="bracket-match"+((isMe(home)||isMe(away))?" has-me":"");
    div.innerHTML=html;
    return div;
  };

  if(!pf.size){
    // 3 participantes: el 1° es campeón directo
    const t=playoffTeam(pf.champion);
    box.innerHTML=`<div class="bracket-match" style="max-width:280px;margin:0 auto;"><div class="bm-row winner${isMe(t)?' me':''}"><span>${meBadge(t)}${t.name}</span><span>Campeón directo</span></div></div>`;
  } else {
    const R=pf.rounds.length, nRows=pf.size/2;
    const grid=document.createElement("div");
    grid.className="bk-grid";
    grid.style.gridTemplateColumns=`repeat(${R}, var(--bk-w))`;
    grid.style.gridTemplateRows=`auto repeat(${nRows}, auto)`;

    pf.rounds.forEach((round,ri)=>{
      const teamsN=pf.size/Math.pow(2,ri);
      const span=Math.pow(2,ri);
      const title=document.createElement("div");
      title.className="bk-title";
      title.style.gridColumn=String(ri+1);
      title.textContent=titleForTeams(teamsN)+(roundIsTwoLeg(teamsN) ? " (ida y vuelta)" : "");
      grid.appendChild(title);

      const count=teamsN/2;
      for(let si=0;si<count;si++){
        const cell=document.createElement("div");
        const cupDraw = state.comp==="cup"; // en Copa los cruces de cada ronda se sortean, así que no se dibujan las llaves que unen cruces
        cell.className="bk-cell"+(!cupDraw && ri<R-1?(si%2===0?" has-next top":" has-next bot"):"")+(!cupDraw && ri>0?" has-prev":"");
        cell.style.gridColumn=String(ri+1);
        cell.style.gridRow=`${2+si*span} / span ${span}`;
        const sl=round.slots && round.slots[si];
        if(sl && sl.tie){
          cell.appendChild(tieCard(sl.tie,ri,si));
        } else if(sl && sl.bye!==undefined){
          const div=document.createElement("div");
          div.className="bracket-match";
          div.innerHTML=`<div class="bm-row bye${isMe(playoffTeam(sl.bye))?' me':''}"><span>${meBadge(playoffTeam(sl.bye))}${playoffTeam(sl.bye).name}</span><span>bye</span></div>`;
          cell.appendChild(div);
        } else {
          // cruce todavía sin definir; si un rival ya viene con bye se muestra su nombre
          const nm=(j)=>{
            if(cupDraw) return "Por sortear";
            const prev=ri>0 && pf.rounds[ri-1].slots ? pf.rounds[ri-1].slots[si*2+j] : null;
            if(prev && prev.bye!==undefined){ const bt=playoffTeam(prev.bye); return meBadge(bt)+bt.name; }
            return "Por definir";
          };
          const div=document.createElement("div");
          div.className="bracket-match tbd";
          div.innerHTML=`<div class="bm-row"><span>${nm(0)}</span></div><div class="bm-row"><span>${nm(1)}</span></div>`;
          cell.appendChild(div);
        }
        grid.appendChild(cell);
      }
    });
    box.appendChild(grid);
    box.scrollLeft=prevScroll;
  }

  const champBox=document.getElementById("championBox");
  const simBtn=document.getElementById("simPlayoffsBtn");
  // Un jugador: si tu equipo perdió un cruce, aparece el cartel de "ELIMINADO" (una sola vez)
  let elimNow=false;
  if(!liveRun && !pf.elimShown){
    const el=humanPlayoffsElimination(pf);
    if(el){ elimNow=true; pf.elimShown=true; setTimeout(()=>showHumanPlayoffsElimination(el),1800); }
  }
  if(pf.champion!==null){
    const t=playoffTeam(pf.champion);
    champBox.innerHTML=`<div class="champion-card"><div class="trophy">🏆</div><div style="color:var(--muted);margin-top:6px;">Campeón de la ${compLabel()}</div><div class="name">${t.name}${meBadge(t)}</div><div class="btn-row" style="justify-content:center"><button class="btn gold sm" id="celAgainBtn">🎉 Festejar de nuevo</button></div></div>`;
    document.getElementById("celAgainBtn").addEventListener("click",()=>showCelebration(pf.champion));
    if(!pf.celebrated){ pf.celebrated=true; if(!elimNow) setTimeout(()=>showCelebration(pf.champion), 1800); } // si perdiste la final, primero va tu cartel (con botón para ver al campeón)
    simBtn.disabled=true;
    simBtn.textContent="Torneo finalizado";
  } else {
    champBox.innerHTML="";
    simBtn.disabled=!!liveRun;
    simBtn.textContent=liveRun ? "Partidos en juego..." : playBtnLabel();
  }
  renderAwards("playoffsAwardsBox");
}
