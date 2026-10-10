/* =========================================================
   MODO AUTOMÁTICO: simula las jornadas una por una, solas
========================================================= */
const AUTO_PREVIEW_MS=700;   // se muestra la jornada con los partidos pendientes
const AUTO_DWELL_MS=3000;    // se dejan ver los resultados (y la tabla moviéndose) antes de pasar a la siguiente
let autoOn=false, autoTimer=null;
function nextUnplayedMd(){ return state.fixture.findIndex(md=>md.some(m=>!m.played)); }
function setSimBtn(id,label,off,why){
  const b=document.getElementById(id); if(!b) return;
  b.disabled=!!off;
  b.textContent=(off?"🚫 ":"")+label;
  b.title=off?why:"";
}
function refreshAutoBtn(){
  const b=document.getElementById("autoMdBtn"); if(!b) return;
  const done = !state.fixture.length || nextUnplayedMd()<0;
  b.disabled = done && !autoOn;
  b.classList.toggle("running",autoOn);
  b.textContent = autoOn ? "⏸ Pausar auto" : (done ? "🚫 Auto jornadas" : "⏩ Auto jornadas");
  b.title = autoOn ? "Pausar y volver a usar los demás botones" : (done ? "La liga ya terminó" : "Simula las jornadas una por una, solo");
  document.body.classList.toggle("auto-sim",autoOn);
}
function stopAuto(){
  clearTimeout(autoTimer); autoTimer=null;
  autoOn=false; refreshAutoBtn();
}
function autoStep(){
  if(!autoOn) return;
  const idx=nextUnplayedMd();
  if(idx<0 || !document.getElementById("screen-league").classList.contains("active")){ stopAuto(); return; }
  state.currentMd=idx; renderLeague();                       // muestra la jornada con los partidos pendientes
  autoTimer=setTimeout(()=>{
    if(!autoOn) return;
    simulateMatchday(idx); renderLeague();                    // resultados + tabla animada
    if(nextUnplayedMd()<0){ stopAuto(); return; }             // se jugó la última jornada
    autoTimer=setTimeout(autoStep, AUTO_DWELL_MS);
  }, AUTO_PREVIEW_MS);
}
document.getElementById("autoMdBtn").addEventListener("click",()=>{
  if(autoOn){ stopAuto(); return; }                           // segundo toque: pausa y se liberan los demás botones
  if(nextUnplayedMd()<0) return;
  autoOn=true; refreshAutoBtn(); autoStep();
});
/* Con el modo automático activo, los demás botones no responden (el de la tabla, el tema y el sonido sí) */
document.addEventListener("click",(e)=>{
  if(!autoOn) return;
  const b=e.target.closest("button,[role=button]"); if(!b) return;
  if(b.id==="autoMdBtn" || b.id==="sideHandle" || b.id==="themeToggle" || b.id==="sfxToggle" ||
     b.closest("#statsToggle") || b.closest("#audioPanel") || b.closest("#confirmOverlay")) return;
  e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
  if(window.chiquiSfx) window.chiquiSfx.play("no",200);
},true);
function simulateMatchday(mdIndex){
  const md = state.fixture[mdIndex];
  md.forEach(m=>{
    if(m.played) return;
    simulateMatch(m);
  });
}

function simulateMatch(m){
  const home=state.teams.find(t=>t.id===m.home);
  const away=state.teams.find(t=>t.id===m.away);
  const hp=teamPower(home), ap=teamPower(away);
  const diff=hp-ap; // diferencia de media
  // expectativa de goles = media + aleatoriedad, multiplicada por la localía y por el equilibrio de cada plantel
  const hb=teamBalance(home), ab=teamBalance(away); // castigo por planteles desequilibrados
  const baseHome = clamp(Math.max(0.1, 1.1 + diff*0.09 + (Math.random()-0.35)*1.3)*HOME_MULT_LEAGUE*hb.own*ab.conc, 0, 7);
  const baseAway = clamp(Math.max(0.1, 1.1 - diff*0.09 + (Math.random()-0.35)*1.3)*AWAY_MULT_LEAGUE*ab.own*hb.conc, 0, 7);
  const fx=cardFx(home,away);
  let hg = poissonish(baseHome*fx.h);
  let ag = poissonish(baseAway*fx.a);
  // pequeña chance de goleada sorpresa
  if(Math.random()<0.05) hg+=Math.floor(Math.random()*3)+1;
  if(Math.random()<0.05) ag+=Math.floor(Math.random()*3)+1;

  m.homeGoals=hg; m.awayGoals=ag; m.played=true;
  m.homeScorers = pickScorers(home, hg);
  m.awayScorers = pickScorers(away, ag);

  m.homeAssists = m.homeScorers.map(id=>pickAssister(home,id));
  m.awayAssists = m.awayScorers.map(id=>pickAssister(away,id));

  registerScorers(m.homeScorers, m.homeAssists);
  registerScorers(m.awayScorers, m.awayAssists);
  if(ag===0) registerCleanSheet(home);
  if(hg===0) registerCleanSheet(away);
  m.cards=fx.hc.concat(fx.ac).map(c=>({pid:c.pid,type:c.type,min:c.minute}));
  applyDisc(fx,true);
  updateStandings(m);
}
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function poissonish(lambda){
  // aproximación simple de distribución de goles a partir de un valor esperado
  let l=Math.exp(-lambda), k=0, p=1;
  do{ k++; p*=Math.random(); }while(p>l && k<10);
  return Math.max(0,k-1);
}
function pickScorers(team, goals){
  if(goals<=0) return [];
  const weighted=bestAttackers(team,11);
  const scorers=[];
  for(let i=0;i<goals;i++){
    const total=weighted.reduce((s,x)=>s+x.w,0);
    let r=Math.random()*total, chosen=weighted[0];
    for(const x of weighted){ r-=x.w; if(r<=0){ chosen=x; break; } }
    scorers.push(chosen.p.id);
  }
  return scorers;
}
function statRec(pid){
  return state.scorers[pid] || (state.scorers[pid]={goals:0, assists:0, cs:0, extra:0});
}
function registerGoal(scorerId, assistId){
  statRec(scorerId).goals++;
  if(assistId!==null && assistId!==undefined) statRec(assistId).assists++;
}
function registerScorers(scorerIds, assistIds){
  scorerIds.forEach((pid,i)=>registerGoal(pid, assistIds ? assistIds[i] : null));
}
// Valla invicta: suma para el mejor arquero y los 2 mejores defensores del equipo (cuenta para "Mejor jugador")
function registerCleanSheet(team){
  const ps=team.roster.map(playerById).filter(Boolean);
  const gk=ps.filter(p=>p.pos==="POR").sort((a,b)=>b.ovr-a.ovr)[0];
  if(gk){ const r=statRec(gk.id); r.cs++; r.extra+=3; }
  ps.filter(p=>p.pos==="DEF").sort((a,b)=>b.ovr-a.ovr).slice(0,2).forEach(p=>{
    const r=statRec(p.id); r.cs++; r.extra+=1.5;
  });
}
// Asistente de un gol: no todos los goles tienen asistencia (~78%); sale sobre todo de mediocampistas y delanteros
function pickAssister(team, scorerId){
  if(Math.random()>0.78) return null;
  const w = p => p.pos==="MED"?4 : p.pos==="DEL"?2.5 : p.pos==="DEF"?1.2 : 0.05;
  const cand=team.roster.map(playerById).filter(p=>p && p.id!==scorerId && !isSusp(p.id)).map(p=>({p, w:w(p)*(p.ovr/90)}));
  if(!cand.length) return null;
  const total=cand.reduce((s,x)=>s+x.w,0);
  let r=Math.random()*total, chosen=cand[0];
  for(const x of cand){ r-=x.w; if(r<=0){ chosen=x; break; } }
  return chosen.p.id;
}
function updateStandings(m){
  const hs=state.standings[m.home], as=state.standings[m.away];
  hs.pj++; as.pj++;
  hs.gf+=m.homeGoals; hs.gc+=m.awayGoals;
  as.gf+=m.awayGoals; as.gc+=m.homeGoals;
  if(m.homeGoals>m.awayGoals){ hs.pg++; hs.pts+=3; as.pp++; }
  else if(m.homeGoals<m.awayGoals){ as.pg++; as.pts+=3; hs.pp++; }
  else { hs.pe++; as.pe++; hs.pts++; as.pts++; }
}

/* Dibuja una jornada en `box`. Reutilizable: el anfitrión la usa con su estado; cada invitado con los datos recibidos (navegación local). */
function renderMatchdayBox(box, md, findTeam, champions){
  box.innerHTML="";
  // Con varios partidos se compacta en una grilla (máx. 4 por fila); con 1 o 2 se ven como siempre
  const compact = md.length>=3;
  box.className = compact ? "match-grid" : "";
  if(compact) box.style.setProperty("--cols", md.length<=4 ? md.length : Math.min(4, Math.ceil(md.length/2)));
  md.forEach(m=>{
    const home=findTeam(m.home);
    const away=findTeam(m.away);
    const row=document.createElement("div");
    if(compact){
      row.className="match-card compact";
      const sc=(g)=>m.played?`<b>${g}</b>`:'<b class="pend">–</b>';
      row.innerHTML=`
        <div class="mc-row"><div class="match-team"><span class="dot" style="background:${home.color}"></span><span class="tn">${home.name}<small class="side-tag">(Local)</small></span>${meBadge(home)}</div>${sc(m.homeGoals)}</div>
        <div class="mc-row"><div class="match-team"><span class="dot" style="background:${away.color}"></span><span class="tn">${away.name}<small class="side-tag">(Visitante)</small></span>${meBadge(away)}</div>${sc(m.awayGoals)}</div>`;
    } else {
      row.className="match-card";
      row.innerHTML=`
      <div class="match-team"><span class="dot" style="background:${home.color}"></span><span class="tn">${home.name}<small class="side-tag">(Local)</small></span>${meBadge(home)}</div>
      <div class="score">${m.played?`<span>${m.homeGoals}</span><span class="dash">–</span><span>${m.awayGoals}</span>`:'<span class="score-pending">vs</span>'}</div>
      <div class="match-team right"><span class="dot" style="background:${away.color}"></span><span class="tn">${away.name}<small class="side-tag">(Visitante)</small></span>${meBadge(away)}</div>
    `;
    }
    if(isMe(home)||isMe(away)) row.classList.add("has-me");
    if(m.g!==undefined && champions) row.dataset.grp=GROUP_LETTERS[m.g];
    box.appendChild(row);
  });
}

function renderLeague(){
  document.getElementById("mdLabel").textContent=state.currentMd+1;
  document.getElementById("mdTotal").textContent=state.fixture.length;
  renderMatchdayBox(document.getElementById("matchdayBox"), state.fixture[state.currentMd], id=>state.teams.find(t=>t.id===id), state.champions);

  renderStandings();
  renderScorers();

  const allPlayed = state.fixture.every(md=>md.every(m=>m.played));
  // Botones de simulación: si ya no tienen nada para simular quedan prohibidos (🚫) y no responden
  const curMd = state.fixture[state.currentMd];
  setSimBtn("simMdBtn","Simular jornada", !curMd || curMd.every(m=>m.played), "Esta jornada ya se jugó");
  setSimBtn("simAllBtn","Simular liga completa", allPlayed, "La liga ya terminó");
  const gb=document.getElementById("goPlayoffsBtn");
  if(state.comp==="leaguecup"){
    gb.textContent = state.playoffs ? "Volver a la fase eliminatoria →" : "Ir a la fase eliminatoria →";
    gb.disabled = state.playoffs ? false : !allPlayed;
  }
  renderRelegated(allPlayed);
  renderLeagueChampion(allPlayed);
  renderAwards("awardsBox");
  checkHumanLeagueElimination(allPlayed);
  refreshAutoBtn();
}

/* Modo "Un jugador": tu equipo lleva el distintivo TÚ (en multijugador local todos son humanos, así que no se marca ninguno) */
function isMe(t){ return !!(t && state.mode==="ia" && t.isHuman); }
function meBadge(t){ return isMe(t) ? '<span class="you-tag">TÚ</span>' : ''; }
function standingsRows(){
  const rows=state.teams.map(t=>({t,...state.standings[t.id]}));
  // Orden de la tabla = siembra de la fase eliminatoria: 1° más puntos, 2° mejor diferencia de gol, 3° más goles a favor
  rows.sort((a,b)=> b.pts-a.pts || (b.gf-b.gc)-(a.gf-a.gc) || b.gf-a.gf);
  if(state.champions && state.groups){ // clasificados primero: 1° de cada grupo, luego 2°, etc. (cada grupo por rendimiento)
    rows.forEach(r=>{ r.gi=groupOf(r.t.id); });
    rows.forEach(r=>{ r.gr=rows.filter(o=>o.gi===r.gi).indexOf(r); });
    rows.sort((a,b)=> a.gr-b.gr || champCmp(a.t.id,b.t.id));
  }
  return rows;
}

// Equipos que ya aseguraron su lugar entre los clasificados (aunque pierdan todo lo que les queda)
function computeClinched(rows, Q){
  const set=new Set();
  const allPlayed=state.fixture.every(md=>md.every(m=>m.played));
  if(allPlayed){ rows.slice(0,Q).forEach(r=>set.add(r.t.id)); return set; }
  const left={}; state.teams.forEach(t=>left[t.id]=0);
  state.fixture.forEach(md=>md.forEach(m=>{ if(!m.played){ left[m.home]++; left[m.away]++; } }));
  rows.forEach(r=>{
    let can=0; // rivales que todavía podrían igualarlo o superarlo en puntos
    rows.forEach(o=>{ if(o.t.id!==r.t.id && o.pts+3*left[o.t.id]>=r.pts) can++; });
    if(can<=Q-1) set.add(r.t.id);
  });
  return set;
}

// Cantidad de equipos que descienden en el modo Liga (máximo 3, según cuántos jueguen)
function relegationCount(n){
  if(n<=3) return 0;
  if(n<=7) return 1;
  if(n<=11) return 2;
  return 3;
}
// Equipos ya eliminados de la fase eliminatoria (no pueden alcanzar el top Q)
function computeEliminated(rows, Q){
  const set=new Set();
  const allPlayed=state.fixture.every(md=>md.every(m=>m.played));
  if(allPlayed){ rows.slice(Q).forEach(r=>set.add(r.t.id)); return set; }
  const left={}; state.teams.forEach(t=>left[t.id]=0);
  state.fixture.forEach(md=>md.forEach(m=>{ if(!m.played){ left[m.home]++; left[m.away]++; } }));
  rows.forEach(r=>{
    const maxPts=r.pts+3*left[r.t.id];
    let above=0; // rivales que ya tienen más puntos de los que él puede llegar a sumar
    rows.forEach(o=>{ if(o.t.id!==r.t.id && o.pts>maxPts) above++; });
    if(above>=Q) set.add(r.t.id);
  });
  return set;
}

// ¿El líder ya es campeón matemáticamente? (nadie lo puede alcanzar aunque gane todo lo que le queda)
function leagueChampionClinched(rows){
  if(!rows.length) return false;
  const allPlayed=state.fixture.length>0 && state.fixture.every(md=>md.every(m=>m.played));
  if(allPlayed) return true;
  const left={}; state.teams.forEach(t=>left[t.id]=0);
  state.fixture.forEach(md=>md.forEach(m=>{ if(!m.played){ left[m.home]++; left[m.away]++; } }));
  const lead=rows[0];
  const anyPlayed=state.fixture.some(md=>md.some(m=>m.played));
  if(!anyPlayed) return false;
  return rows.slice(1).every(o=> lead.pts > o.pts+3*left[o.t.id]);
}

let _stPrev=null; // {rank:Map(teamId->posición), pts:Map(teamId->puntos)} del último render, para animar los cambios
function renderStandings(){
  if(state.champions && state.groups) return renderGroupStandings();
  const tbody=document.querySelector("#standingsTable tbody");
  tbody.innerHTML="";
  const rows=standingsRows();
  const isLC = state.comp==="leaguecup";
  const isLeague = state.comp==="league";
  const Q = isLC ? qualifiersFor(rows.length) : 0;
  const clinched = isLC ? computeClinched(rows,Q) : new Set();
  const eliminated = isLC ? computeEliminated(rows,Q) : new Set();
  const D = isLeague ? relegationCount(rows.length) : 0;
  const leagueClinched = isLeague ? leagueChampionClinched(rows) : false;
  rows.forEach((r,i)=>{
    const tr=document.createElement("tr");
    if(r.t.isHuman) tr.classList.add("you");
    if(isMe(r.t)) tr.classList.add("me");
    if(isLC){
      if(clinched.has(r.t.id)) tr.classList.add("q-clinched");
      else if(eliminated.has(r.t.id)) tr.classList.add("q-last");
      else if(i<Q) tr.classList.add("q-zone");
    } else if(isLeague){
      if(i===0 && rows.some(x=>x.pj>0)) tr.classList.add(leagueClinched ? "q-clinched" : "q-zone");
      else if(D>0 && i>=rows.length-D) tr.classList.add("q-last");
    }
    tr.innerHTML=`<td><span class="rank-num">${i+1}</span></td>
      <td><div class="team-cell"><span class="dot" style="background:${r.t.color}"></span>${r.t.name}${meBadge(r.t)}</div></td>
      <td>${r.pj}</td><td>${r.pg}</td><td>${r.pe}</td><td>${r.pp}</td>
      <td>${r.gf}</td><td>${r.gc}</td><td>${r.gf-r.gc}</td><td class="pts">${r.pts}</td>`;
    tbody.appendChild(tr);
    r._tr=tr;
  });
  /* Animación: cada fila se desliza desde su posición anterior hasta la nueva, y su color de zona
     (verde / dorado / rojo) se va transformando durante el recorrido, no de golpe al empezar. */
  const ZC=["q-zone","q-clinched","q-last"];
  const zoneOf=tr=>ZC.find(c=>tr.classList.contains(c))||"";
  const prev=_stPrev;
  _stPrev={rank:new Map(rows.map((r,i)=>[r.t.id,i])), pts:new Map(rows.map(r=>[r.t.id,r.pts])),
           zone:new Map(rows.map(r=>[r.t.id,zoneOf(r._tr)]))};
  if(prev){
    const visible=document.getElementById("standingsTable").offsetWidth>0;
    const reduce=window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const trs=rows.map(r=>r._tr);
    // apariencia (fondo y franja lateral) que tendría la fila con una zona determinada
    const look=(tr,zone)=>{
      const cur=zoneOf(tr);
      if(cur) tr.classList.remove(cur);
      if(zone) tr.classList.add(zone);
      const cs=getComputedStyle(tr);
      const o={backgroundColor:cs.backgroundColor, boxShadow:cs.boxShadow};
      if(zone) tr.classList.remove(zone);
      if(cur) tr.classList.add(cur);
      return o;
    };
    let moved=false;
    rows.forEach((r,i)=>{
      const old=prev.rank.get(r.t.id);
      if(old===undefined) return;
      const diff=old-i; // >0 sube, <0 baja
      if(diff!==0) moved=true;
      if(!visible) return;
      if(prev.pts.get(r.t.id)!==r.pts){
        const pc=r._tr.querySelector("td.pts"); if(pc) pc.classList.add("pts-up");
      }
      const zNow=zoneOf(r._tr), zPrev=prev.zone.get(r.t.id)||"";
      if(diff===0 && zNow===zPrev) return;
      const k0={}, k1={};
      if(diff!==0){
        const rk=r._tr.querySelector(".rank-num");
        if(rk){ const d=document.createElement("span"); d.className="rk-delta "+(diff>0?"up":"down"); d.textContent=(diff>0?"▲":"▼")+Math.abs(diff); rk.after(d); }
        if(!reduce){
          const dy=trs[old].getBoundingClientRect().top-trs[i].getBoundingClientRect().top;
          if(dy){ k0.transform=`translateY(${dy}px)`; k1.transform="translateY(0)"; r._tr.classList.add("moving"); }
        }
      }
      if(zNow!==zPrev){ Object.assign(k0,look(r._tr,zPrev)); Object.assign(k1,look(r._tr,zNow)); }
      if(r._tr.animate && Object.keys(k0).length){
        const a=r._tr.animate([k0,k1],{duration:900, easing:"cubic-bezier(.22,.9,.25,1)"});
        a.onfinish=a.oncancel=()=>r._tr.classList.remove("moving");
      }
    });
    if(moved && visible && window.chiquiSfx) window.chiquiSfx.play("rank",300);
  }
  const lg=document.getElementById("qLegend");
  requestAnimationFrame(fitStandingsSidebar);
  lg.innerHTML = isLC
    ? `<span><i class="lg-sw z"></i>Zona de clasificación (top ${Q})</span><span><i class="lg-sw c"></i>Ya clasificado</span><span><i class="lg-sw l"></i>Eliminado</span>`
    : (isLeague ? `<span><i class="lg-sw z"></i>Líder</span><span><i class="lg-sw c"></i>Campeón matemático</span>` + (D>0 ? `<span><i class="lg-sw l"></i>Descenso (${D===1?"último":"últimos "+D})</span>` : "") : "");
}

function renderLeagueChampion(allPlayed){
  const box=document.getElementById("leagueChampionBox");
  if(state.comp!=="league" || !allPlayed){ box.innerHTML=""; return; }
  const champ=standingsRows()[0].t;
  box.innerHTML=`<div class="champion-card"><div class="trophy">🏆</div><div style="color:var(--muted);margin-top:6px;">Campeón de la Liga</div><div class="name">${champ.name}${meBadge(champ)}</div><div class="btn-row" style="justify-content:center"><button class="btn gold sm" id="celLeagueBtn">🎉 Festejar de nuevo</button></div></div>`;
  document.getElementById("celLeagueBtn").addEventListener("click",()=>showCelebration(champ.id));
  if(!state.leagueCelebrated){ state.leagueCelebrated=true; if(!humanRelegatedInLeague()) setTimeout(()=>showCelebration(champ.id),1800); }
}

/* Modo Liga: al terminar, se marcan los equipos que descienden (arriba del campeón; sin animación triste) */
function renderRelegated(allPlayed){
  const box=document.getElementById("relegatedBox"); if(!box) return;
  if(state.comp!=="league" || !allPlayed){ box.innerHTML=""; return; }
  const rows=standingsRows();
  const D=relegationCount(rows.length);
  if(D<=0){ box.innerHTML=""; return; }
  const first=rows.length-D;
  const items=rows.slice(first).map((r,k)=>`<span class="rel-team"><span class="dot" style="background:${r.t.color}"></span>${r.t.name}${meBadge(r.t)}<small>${first+k+1}°</small></span>`).join("");
  const rel=humanRelegatedInLeague();
  const btn=`<div class="btn-row" style="justify-content:center"><button class="btn sm" id="relMsgBtn" type="button">😭 Ver mensaje</button></div>`;
  box.innerHTML=`<div class="relegated-card"><div class="rel-icon">⬇️</div><div class="rel-kicker">${D===1?"Descendió":"Descendieron"}</div><div class="rel-list">${items}</div>${btn}</div>`;
  document.getElementById("relMsgBtn").addEventListener("click",()=>showHumanRelegation(humanRelegatedInLeague()));
}

function showHumanRelegation(rel){
  const champ=standingsRows()[0].t;
  const btns=[{label:"🏆 Ver campeón", cls:"", fn:()=>showCelebration(champ.id)}, {label:"Ver la tabla", cls:"gold", fn:null}];
  if(rel && relegationCount(standingsRows().length)<=1){ // Un jugador y descendiste vos
    showEliminated(rel.me,{
      icon:"😭", kicker:"Terminaste "+rel.pos+"° y", title:"DESCENDISTE", sadder:true,
      sub:`<b style="color:${rel.me.color}">${rel.me.name}</b> pierde la categoría.`,
      extra:"Una temporada para olvidar... ya habrá revancha.",
      buttons:btns
    });
    return;
  }
  // Cualquier otro caso (multijugador, o descendió un bot): se muestra el descenso de los equipos que bajan
  const rows=standingsRows(); const D=relegationCount(rows.length);
  if(D<=0) return;
  const rel2=rows.slice(rows.length-D);
  const names=rel2.map(r=>`<b style="color:${r.t.color}">${r.t.name}</b>`);
  const list = names.length>1 ? names.slice(0,-1).join(", ")+" y "+names[names.length-1] : names[0];
  showEliminated(rel2[rel2.length-1].t,{
    icon:"😭", teams:rel2.map(r=>r.t), kicker: rel ? ("Terminaste "+rel.pos+"° y") : (D===1?"Terminó ":"Terminaron ")+(D===1?(rows.length+"°"):"últimos")+" y", title:D===1?"DESCENDIÓ":"DESCENDIERON", sadder:true,
    sub:`${list} ${D===1?"pierde":"pierden"} la categoría.`,
    extra:"Una temporada para olvidar... ya habrá revancha.",
    buttons:btns
  });
}

/* Liga (Un jugador): ¿tu equipo terminó en zona de descenso? (solo cuando ya se jugó todo) */
function humanRelegatedInLeague(){
  if(state.comp!=="league" || state.mode!=="ia") return null;
  const me=state.teams.find(t=>t.isHuman); if(!me) return null;
  if(!state.fixture.length || !state.fixture.every(md=>md.every(m=>m.played))) return null;
  const rows=standingsRows(); const D=relegationCount(rows.length);
  const idx=rows.findIndex(r=>r.t.id===me.id);
  if(D<=0 || idx<0 || idx<rows.length-D) return null;
  return {me, pos:idx+1, total:rows.length};
}

/* Copa de la liga (Un jugador): si tu equipo ya no puede clasificar a la fase eliminatoria */
function checkHumanLeagueElimination(allPlayed){
  const rel=humanRelegatedInLeague();
  if(rel){
    if(state.humanElimLeague) return;
    state.humanElimLeague=true;
    setTimeout(()=>showHumanRelegation(rel),1200);
    return;
  }
  if(state.comp!=="leaguecup" || state.mode!=="ia" || state.humanElimLeague) return;
  const me=state.teams.find(t=>t.isHuman); if(!me) return;
  if(!state.fixture.length || !state.fixture.some(md=>md.some(m=>m.played))) return;
  const rows=standingsRows();
  if(!(state.champions ? champOutSet() : computeEliminated(rows,qualifiersFor(rows.length))).has(me.id)) return;
  state.humanElimLeague=true;
  setTimeout(()=>{
    const done=state.fixture.length>0 && state.fixture.every(md=>md.every(m=>m.played));
    const buttons=[];
    if(done) buttons.push({label:"Ver los playoffs →", cls:"gold", fn:()=>{ const gb=document.getElementById("goPlayoffsBtn"); if(gb && !gb.disabled && !document.body.classList.contains("auto-sim")) gb.click(); }});
    buttons.push({label: done ? "Ver la tabla" : "Seguir viendo la liga", cls: done ? "" : "gold", fn:null});
    showEliminated(me,{
      sub:`<b style="color:${me.color}">${me.name}</b> ${done ? "quedó afuera de la fase eliminatoria." : "ya no puede clasificar a la fase eliminatoria."}`,
      buttons
    });
  },1200);
}

function renderScorers(){
  const view = state.statsView==="assists" ? "assists" : "goals";
  const other = view==="goals" ? "assists" : "goals";
  document.querySelectorAll("#statsToggle .speed-btn").forEach(b=>b.classList.toggle("on", b.dataset.sv===view));
  document.getElementById("scorersTitle").textContent = view==="assists" ? "Tabla de asistentes" : "Tabla de goleadores";
  const box=document.getElementById("scorersBox");
  const entries=Object.entries(state.scorers)
    .map(([pid,d])=>({p:PLAYERS.find(x=>x.id==pid), goals:d.goals||0, assists:d.assists||0}))
    .filter(e=>e.p && e[view]>0);
  entries.sort((a,b)=>b[view]-a[view] || b[other]-a[other] || b.p.ovr-a.p.ovr);
  if(entries.length===0){
    box.classList.remove("scorers-2col");
    box.innerHTML = view==="assists" ? '<div class="empty-note">Todavía no hay asistencias registradas.</div>' : '<div class="empty-note">Todavía no hay goles registrados.</div>';
    return;
  }
  box.innerHTML="";
  const shown=entries.slice(0,15);
  box.classList.toggle("scorers-2col", shown.length>=6);
  shown.forEach((e,i)=>{
    const teamOwner = state.teams.find(t=>t.roster.includes(e.p.id));
    const row=document.createElement("div");
    row.className="scorers-row";
    row.innerHTML=`<span class="rank-num">${i+1}</span><span class="pos-badge pos-${e.p.pos}" style="width:28px;font-size:10px;">${e.p.pos}</span>
      <span>${e.p.name}</span><span style="color:var(--muted);font-size:12px;">${teamOwner?teamOwner.name:""}</span>
      <span class="goals">${e[view]}</span>`;
    box.appendChild(row);
  });
}
document.querySelectorAll("#statsToggle .speed-btn").forEach(b=>{
  b.addEventListener("click",()=>{ state.statsView=b.dataset.sv; renderScorers(); });
});

/* ---------- Premios individuales (al terminar el torneo) ---------- */
function tournamentFinished(){
  if(state.comp==="league") return state.fixture.length>0 && state.fixture.every(md=>md.every(m=>m.played));
  return !!(state.playoffs && state.playoffs.champion!==null && state.playoffs.champion!==undefined);
}
function computeAwards(){
  const champId = state.comp==="league" ? standingsRows()[0].t.id : state.playoffs.champion;
  const list=Object.entries(state.scorers).map(([pid,d])=>{
    const p=PLAYERS.find(x=>x.id==pid); if(!p) return null;
    const team=state.teams.find(t=>t.roster.includes(p.id));
    const goals=d.goals||0, assists=d.assists||0, cs=d.cs||0;
    // Mejor jugador: goles (3) + asistencias (2) + vallas invictas + bonus por jugar en el campeón
    const score=goals*3 + assists*2 + (d.extra||0) + (team && team.id===champId ? 2 : 0);
    return {p, team, goals, assists, cs, score};
  }).filter(Boolean);
  const top=(arr,cmp)=>arr.slice().sort(cmp)[0] || null;
  return {
    pichichi: top(list.filter(e=>e.goals>0), (a,b)=>b.goals-a.goals || b.assists-a.assists || b.p.ovr-a.p.ovr),
    asistente: top(list.filter(e=>e.assists>0), (a,b)=>b.assists-a.assists || b.goals-a.goals || b.p.ovr-a.p.ovr),
    mvp: top(list.filter(e=>e.score>0), (a,b)=>b.score-a.score || (b.goals+b.assists)-(a.goals+a.assists) || b.p.ovr-a.p.ovr)
  };
}
function awardCard(cls, icon, kicker, e, statTxt, emptyTxt){
  if(!e) return `<div class="award-card ${cls}"><div class="a-icon">${icon}</div><div class="a-kicker">${kicker}</div><div class="a-none">${emptyTxt}</div></div>`;
  return `<div class="award-card ${cls}"><div class="a-icon">${icon}</div><div class="a-kicker">${kicker}</div>
    <div class="a-name">${e.p.name}</div>
    <div class="a-team"><span class="pos-badge pos-${e.p.pos}" style="width:28px;font-size:10px;">${e.p.pos}</span>${e.team?`<span class="dot" style="background:${e.team.color}"></span>${e.team.name}`:""}</div>
    <div class="a-stat">${statTxt}</div></div>`;
}
function renderAwards(boxId){
  const box=document.getElementById(boxId); if(!box) return;
  if(!tournamentFinished()){ box.innerHTML=""; return; }
  const a=computeAwards();
  const pl=(n,s,p)=>n+" "+(n===1?s:p);
  const mvpTxt = a.mvp ? [pl(a.mvp.goals,"gol","goles"), pl(a.mvp.assists,"asistencia","asistencias")].concat(a.mvp.cs>0 ? [pl(a.mvp.cs,"valla invicta","vallas invictas")] : []).join(" · ") : "";
  box.innerHTML=`<h3 class="awards-title">🏅 Premios individuales</h3>
    <div class="awards-grid">
      ${awardCard("", "⚽", "Pichichi", a.pichichi, a.pichichi ? pl(a.pichichi.goals,"gol","goles") : "", "Nadie convirtió goles")}
      ${awardCard("", "🅰️", "Máx. asistente", a.asistente, a.asistente ? pl(a.asistente.assists,"asistencia","asistencias") : "", "No hubo asistencias")}
      ${awardCard("mvp", "⭐", "Mejor jugador", a.mvp, mvpTxt, "Sin datos")}
    </div>` + xiHTML();
}
