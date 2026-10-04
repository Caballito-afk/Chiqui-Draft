/* =========================================================
   LIGA
========================================================= */
// Ventaja de local: multiplica los goles esperados (local más, visitante menos). Para dos equipos parejos en liga
// el local gana ~52%, empatan ~23% y el visitante gana ~26%, pero un equipo claramente más fuerte (media)
// sigue siendo favorito aunque juegue de visitante. En cancha neutral no se aplica.
const HOME_MULT_LEAGUE=1.32, AWAY_MULT_LEAGUE=0.82;
const HOME_MULT_CUP=1.25,    AWAY_MULT_CUP=0.86;
function teamPower(team){
  const players=team.roster.map(pid=>playerById(pid));
  const avg = players.reduce((s,p)=>s+p.ovr,0)/players.length;
  return avg;
}
/* Equilibrio del plantel: un equipo con demasiados jugadores en una sola zona (p. ej. 7 delanteros, 2 medios y 1 defensa)
   mete más goles pero recibe muchos más; uno ultradefensivo casi no convierte. Y dejar una línea vacía también se paga.
   Devuelve multiplicadores sobre la expectativa de goles: own = goles a favor, conc = goles que recibe. */
function teamBalance(team){
  const ps=team.roster.map(playerById).filter(Boolean);
  const c={POR:0,DEF:0,MED:0,DEL:0};
  ps.forEach(p=>{ c[p.pos]=(c[p.pos]||0)+1; });
  const n=c.DEF+c.MED+c.DEL;
  const res={own:1, conc:1, x:0, level:"ok", title:"Plantel equilibrado", msg:"", counts:c};
  if(n<3) return res;
  const big=n>=8;                                   // fútbol 11 (en fútbol 5 no se exige mediocampo)
  const a=(c.DEL+0.5*c.MED)/n;                      // peso ofensivo: 0 = todo defensa, 1 = todo delantero (0.45 ≈ 4-3-3)
  // Tolerancia asimétrica: jugar con línea de 5 (5-4-1, 5-3-2) es un estilo defensivo válido, no un desequilibrio;
  // en cambio ir muy arriba se castiga antes.
  const tol = a>0.45 ? (big?0.12:0.17) : (big?0.17:0.22);
  const excess=Math.max(0,Math.abs(a-0.45)-tol);
  const x=Math.min(1.5, excess/0.32);
  const gaps=[];
  if(c.DEF===0) gaps.push("defensores");
  if(c.DEL===0) gaps.push("delanteros");
  if(big && c.MED===0) gaps.push("mediocampistas");
  const gapPen=gaps.length*(big?0.35:0.2);
  // Pocos defensores: con menos de 3 atrás (ej. 2-3-5) la defensa se rompe, aunque el resto del plantel esté "parejo"
  const defShort = (big && c.DEF>0) ? Math.max(0,3-c.DEF) : 0;
  const defPen = defShort*0.45;
  const noGK = c.POR===0;
  let own=1, conc=1;
  if(a>0.45){ own=1+0.10*x; conc=1+1.1*x; }        // muy ofensivo: marca algo más, pero le hacen muchos
  else { own=1-0.6*x; conc=1-0.10*x; }              // muy defensivo: casi no convierte
  own*=(1-0.6*gapPen); conc*=(1+0.6*gapPen);
  conc*=(1+0.8*defPen); own*=(1-0.1*defPen);
  if(noGK) conc*=1.5;
  const total=x+gapPen+defPen+(noGK?0.5:0);
  res.own=own; res.conc=conc; res.x=total;
  const f=v=>Math.round(Math.abs(v-1)*100);
  const parts=[];
  if(x>0.04){
    if(a>0.45) parts.push(`Plantel demasiado ofensivo (${c.DEF} DEF · ${c.MED} MED · ${c.DEL} DEL): marca un poco más (+${f(own)}%) pero recibe muchísimos más goles (+${f(conc)}% en contra).`);
    else parts.push(`Plantel demasiado defensivo (${c.DEF} DEF · ${c.MED} MED · ${c.DEL} DEL): recibe menos goles, pero le cuesta muchísimo convertir (−${f(own)}% de goles a favor).`);
  }
  if(defShort>0) parts.push(`Muy pocos defensores (${c.DEF}): con ${c.DEF===1?"un solo central":"solo "+c.DEF+" centrales"} la defensa queda expuesta y recibe muchos más goles.`);
  if(gaps.length) parts.push(`No tiene ${gaps.join(" ni ")}: esa zona queda vacía y el equipo se desarma (menos goles a favor y más en contra).`);
  if(noGK) parts.push("No tiene arquero: recibe muchos más goles.");
  if(parts.length){
    res.msg=parts.join(" ");
    res.level=total>=0.6 ? "bad" : "warn";
    res.title=res.level==="bad" ? "Plantel muy desequilibrado" : "Plantel algo desequilibrado";
  } else if(a<=0.33){
    res.title="Plantel defensivo";
    res.msg=`Estilo defensivo (${c.DEF} DEF · ${c.MED} MED · ${c.DEL} DEL): sólido atrás, con menos peso en ataque. No se castiga.`;
  } else {
    res.msg=`Distribución pareja (${c.DEF} DEF · ${c.MED} MED · ${c.DEL} DEL): sin castigo.`;
  }
  return res;
}
function bestAttackers(team,n){
  let players=team.roster.filter(pid=>!isSusp(pid)).map(pid=>playerById(pid)); if(players.length<3) players=team.roster.map(pid=>playerById(pid));
  const weight = p => p.pos==="DEL"?4 : p.pos==="MED"?2 : p.pos==="DEF"?0.6 : 0.1;
  return players.map(p=>({p,w:weight(p)*(p.ovr/90)})).sort((a,b)=>b.w-a.w);
}

/* ---------- Champions: sorteo de grupos (4 por grupo, totalmente al azar: cualquiera puede enfrentarse a cualquiera) ---------- */
const GROUP_LETTERS="ABCDEFGHIJKLMNOP";
function setupGroups(){
  const G=Math.max(1,Math.floor(state.teams.length/4));
  const groups=Array.from({length:G},()=>[]);
  shuffle(state.teams.slice()).forEach((t,i)=>groups[i%G].push(t)); // sin bombos: los grupos se arman puramente al azar
  state.groups=groups.map(g=>g.map(t=>t.id));
  const perGroup=state.groups.map((ids,gi)=>generateFixture(ids.map(teamById)).map(md=>md.map(m=>({...m,g:gi}))));
  const nMd=Math.max(...perGroup.map(f=>f.length));
  state.fixture=[];
  for(let i=0;i<nMd;i++) state.fixture.push([].concat(...perGroup.map(f=>f[i]||[])));
}
/* Mejores terceros: se suman cuando 2 por grupo no completan un cuadro (p. ej. 12 equipos: 6 + 2 mejores terceros = 8) */
function champThirds(n){
  const G=Math.floor(n/4), base=Math.max(2,G*2), size=nextPow2(base), t=size-base;
  return (t>0 && t<=G) ? t : 0;
}
function bestThirdsSet(){
  const out=new Set(); if(!state.groups) return out;
  const k=champThirds(state.teams.length); if(!k) return out;
  const thirds=state.groups.map(g=>g.slice().sort(grpSort)[2]).filter(id=>id!==undefined);
  thirds.sort(champCmp).slice(0,k).forEach(id=>out.add(id));
  return out;
}
function groupOf(id){ if(!state.groups) return -1; return state.groups.findIndex(g=>g.includes(id)); }
function champCmp(a,b){ // <0 si a rindió mejor que b en la fase de grupos
  const A=state.standings[a], B=state.standings[b];
  if(!A||!B) return 0;
  const gr=id=>{ const g=state.groups&&state.groups[groupOf(id)]; if(!g) return 9; return g.slice().sort(grpSort).indexOf(id); };
  return (B.pts-A.pts) || ((B.gf-B.gc)-(A.gf-A.gc)) || (B.gf-A.gf) || (gr(a)-gr(b)) || (teamPower(teamById(b))-teamPower(teamById(a)));
}
function grpSort(a,b){ const A=state.standings[a], B=state.standings[b]; return (B.pts-A.pts)||((B.gf-B.gc)-(A.gf-A.gc))||(B.gf-A.gf); }
function champElimSet(){ // equipos que ya no pueden quedar entre los 2 primeros de su grupo
  const out=new Set(); if(!state.groups) return out;
  const left={}; state.teams.forEach(t=>left[t.id]=0);
  state.fixture.forEach(md=>md.forEach(m=>{ if(!m.played){ left[m.home]++; left[m.away]++; } }));
  state.groups.forEach(g=>g.forEach(id=>{
    const mx=state.standings[id].pts+3*left[id];
    if(g.filter(o=>o!==id && state.standings[o].pts>mx).length>=(champThirds(state.teams.length)>0?3:2)) out.add(id);
  }));
  return out;
}
/* Champions: equipos que ya quedaron afuera de los playoffs.
   Antes de terminar los grupos: los que matemáticamente no llegan (champElimSet).
   Con todos los grupos jugados: por posición final, así también cuentan los empates en puntos
   (3° que no es de los mejores terceros, o 4°). */
function champOutSet(){
  const out=champElimSet();
  if(!state.groups) return out;
  const allDone=state.fixture.length>0 && state.fixture.every(md=>md.every(m=>m.played));
  if(!allDone) return out;
  const th=bestThirdsSet();
  state.groups.forEach(g=>g.slice().sort(grpSort).forEach((id,i)=>{ if(i>=3 || (i===2 && !th.has(id))) out.add(id); }));
  return out;
}
function champClinchedSet(){
  const out=new Set(); if(!state.groups) return out;
  const left={}; state.teams.forEach(t=>left[t.id]=0);
  state.fixture.forEach(md=>md.forEach(m=>{ if(!m.played){ left[m.home]++; left[m.away]++; } }));
  state.groups.forEach(g=>g.forEach(id=>{
    const pts=state.standings[id].pts;
    if(g.filter(o=>o!==id && state.standings[o].pts+3*left[o]>=pts).length<=1) out.add(id);
  }));
  return out;
}
function renderGroupStandings(){
  const tbody=document.querySelector("#standingsTable tbody");
  tbody.innerHTML="";
  _stPrev=null;
  const cl=champClinchedSet(), el=champElimSet(), th=bestThirdsSet(), anyP=state.fixture.some(md=>md.some(m=>m.played));
  const left={}; state.teams.forEach(t=>left[t.id]=0);
  state.fixture.forEach(md=>md.forEach(m=>{ if(!m.played){ left[m.home]++; left[m.away]++; } }));
  const allDone=state.fixture.length>0 && state.fixture.every(md=>md.every(m=>m.played));
  const nTh=champThirds(state.teams.length);
  state.groups.forEach((g,gi)=>{
    const h=document.createElement("tr"); h.className="grp-head";
    h.innerHTML=`<td colspan="10" style="text-align:left;font-weight:800;color:var(--gold);padding:8px 6px;">Grupo ${GROUP_LETTERS[gi]}</td>`;
    tbody.appendChild(h);
    g.slice().sort(grpSort).forEach((id,i)=>{
      const t=teamById(id), r=state.standings[id];
      const tr=document.createElement("tr");
      if(t.isHuman) tr.classList.add("you");
      if(isMe(t)) tr.classList.add("me");
      const gDone=g.every(x=>left[x]===0);
      let cls="";
      if(gDone){ // grupo terminado: el color depende de la posición final (sin dudas de empates ni de cuentas matemáticas)
        if(i<2) cls="q-clinched";
        else if(i===2 && nTh) cls = th.has(id) ? (allDone ? "q-third" : "q-third") : (allDone ? "q-last" : "");
        else cls="q-last";
      } else if(i<2) cls = cl.has(id) ? "q-clinched" : (el.has(id) ? "q-last" : "q-zone");
      else if(i===2 && nTh && th.has(id) && anyP && !el.has(id)) cls="q-third";
      else if(el.has(id)) cls="q-last";
      if(cls) tr.classList.add(cls);
      tr.innerHTML=`<td><span class="rank-num">${i+1}</span></td>
      <td><div class="team-cell"><span class="dot" style="background:${t.color}"></span>${t.name}${meBadge(t)}</div></td>
      <td>${r.pj}</td><td>${r.pg}</td><td>${r.pe}</td><td>${r.pp}</td><td>${r.gf}</td><td>${r.gc}</td><td>${r.gf-r.gc}</td><td class="pts">${r.pts}</td>`;
      tbody.appendChild(tr);
    });
  });
  document.getElementById("qLegend").innerHTML=`<span><i class="lg-sw z"></i>Zona de clasificación (top 2 de cada grupo)</span>${champThirds(state.teams.length)?`<span><i class="lg-sw t"></i>Mejor tercero (clasifican ${champThirds(state.teams.length)})</span>`:""}<span><i class="lg-sw c"></i>Ya clasificado</span><span><i class="lg-sw l"></i>Eliminado</span>`;
  requestAnimationFrame(fitStandingsSidebar);
}
function generateFixture(teams){
  // Round robin (círculo), con "descanso" (bye) si es impar
  let ids = teams.map(t=>t.id);
  let bye = null;
  if(ids.length % 2 !== 0){ ids.push(null); bye="BYE"; }
  const n = ids.length;
  const rounds = n-1;
  const half = n/2;
  let arr = ids.slice();
  const matchdays=[];
  for(let r=0;r<rounds;r++){
    const md=[];
    for(let i=0;i<half;i++){
      const a=arr[i], b=arr[n-1-i];
      if(a!==null && b!==null){
        // alternar local/visitante para variar
        if((r+i)%2===0) md.push({home:a, away:b, played:false, homeGoals:null, awayGoals:null, homeScorers:[], awayScorers:[]});
        else md.push({home:b, away:a, played:false, homeGoals:null, awayGoals:null, homeScorers:[], awayScorers:[]});
      }
    }
    matchdays.push(md);
    // rotar (fijo el primero)
    const last=arr.pop();
    arr.splice(1,0,last);
  }
  // ida y vuelta (opción de la pantalla de ajustes)
  if((state.comp==="league" && state.doubleLeg) || (state.comp==="leaguecup" && state.leagueDouble)){ // en Copa de la liga depende de la opción "Todo ida y vuelta"
    const secondLeg = matchdays.map(md=>md.map(m=>({home:m.away, away:m.home, played:false, homeGoals:null, awayGoals:null, homeScorers:[], awayScorers:[]})));
    return matchdays.concat(secondLeg);
  }
  return matchdays;
}

function setupLeague(){
  if(typeof stopAuto==="function") stopAuto();
  _stPrev=null; // liga nueva: la tabla arranca sin animar
  state.groups=null;
  if(state.champions) setupGroups(); else state.fixture = generateFixture(state.teams);
  state.currentMd = 0;
  state.standings={};
  state.teams.forEach(t=>{
    state.standings[t.id]={pj:0,pg:0,pe:0,pp:0,gf:0,gc:0,pts:0};
  });
  state.scorers={};
  const lc=state.comp==="leaguecup";
  document.getElementById("leagueTitle").textContent = lc ? "Fase de Liga" : "Liga";
  const q=qualifiersFor(state.teams.length);
  if(state.champions) document.getElementById("leagueTitle").textContent="Fase de Grupos";
  document.getElementById("leagueDesc").textContent = state.champions ?
    `${state.groups.length} grupo${state.groups.length===1?"":"s"} de 4 equipos${state.leagueDouble?", a ida y vuelta":", a una vuelta"}. Los 2 primeros de cada grupo clasifican a los playoffs${champThirds(state.teams.length)?` y también los ${champThirds(state.teams.length)} mejores terceros`:""}. Simulá fecha por fecha o todo.` :
    "Todos contra todos" + ((lc ? state.leagueDouble : state.doubleLeg) ? " a doble vuelta" : "") + ". " +
    (lc ? (state.teams.length===3 ? "El 1° de la liga sale campeón directo." : `Los ${q} mejores clasifican a la fase eliminatoria.`) : ("El que termina primero es el campeón." + (relegationCount(state.teams.length)>0 ? (relegationCount(state.teams.length)===1 ? " Desciende el último." : ` Descienden los últimos ${relegationCount(state.teams.length)}.`) : ""))) +
    " Simulá jornada por jornada o toda la liga.";
  document.getElementById("mdTotal").textContent=state.fixture.length;
  const gb=document.getElementById("goPlayoffsBtn");
  gb.style.display = lc ? "" : "none";
  document.getElementById("goPlayoffsRow").style.display = lc ? "" : "none";
  gb.disabled=true;
  gb.textContent="Ir a la fase eliminatoria →";
  document.getElementById("relegatedBox").innerHTML="";
  document.getElementById("leagueChampionBox").innerHTML="";
  document.getElementById("awardsBox").innerHTML="";
  renderLeague();
}

document.getElementById("prevMd").addEventListener("click",()=>{
  if(state.currentMd>0){ state.currentMd--; renderLeague(); }
});
document.getElementById("nextMd").addEventListener("click",()=>{
  if(state.currentMd<state.fixture.length-1){ state.currentMd++; renderLeague(); }
});
document.getElementById("simMdBtn").addEventListener("click",()=>{
  simulateMatchday(state.currentMd);
  renderLeague();
});
document.getElementById("simAllBtn").addEventListener("click",()=>{
  for(let i=0;i<state.fixture.length;i++) simulateMatchday(i);
  state.currentMd=state.fixture.length-1;
  renderLeague();
});
