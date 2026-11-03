/* =========================================================
   CHIQUI-MAFIA
   Una Copa de la liga dividida en 2 zonas sorteadas:
   - cada club juega solo contra los de su zona;
   - la anteúltima jornada es la fecha INTERZONA: cada club enfrenta a uno de la otra zona;
   - clasifican los mismos equipos que en la Copa de la liga (qualifiersFor), repartidos entre las 2 zonas;
   - los cruces son entre zonas: el 1° de una zona contra el último clasificado de la otra, el 2° contra el anteúltimo, y así.
   Internamente es comp="leaguecup" con state.mafia=true; state.groups guarda las 2 zonas y m.g de cada partido
   es la zona (0 = A, 1 = B) o 2 = interzona.
========================================================= */
const ZONE_LETTERS=["A","B"];
const MAFIA_MIN_TEAMS=4;
function zoneName(gi){ return gi===2 ? "Interzona" : "Zona "+ZONE_LETTERS[gi]; }
function zonesOn(){ return !!(state.mafia && state.groups && state.groups.length===2); }

/* ---------- Sorteo de zonas + fixture ---------- */
function setupZones(){
  const n=state.teams.length;
  const sh=shuffle(state.teams.slice());
  const a=Math.ceil(n/2);                       // con cantidad impar la Zona A tiene un equipo más
  state.groups=[sh.slice(0,a).map(t=>t.id), sh.slice(a).map(t=>t.id)];
  const per=state.groups.map((ids,gi)=>generateFixture(ids.map(teamById)).map(md=>md.map(m=>({...m,g:gi}))));
  const kz=Math.max(per[0].length, per[1].length);
  // fecha interzona: cada equipo de una zona contra uno de la otra (al azar); si sobra uno, descansa esa fecha
  const A=shuffle(state.groups[0].slice()), B=shuffle(state.groups[1].slice());
  const iz=[];
  for(let i=0;i<Math.min(A.length,B.length);i++){
    const h=(i%2===0)?A[i]:B[i], v=(i%2===0)?B[i]:A[i];
    iz.push({home:h, away:v, played:false, homeGoals:null, awayGoals:null, homeScorers:[], awayScorers:[], g:2});
  }
  state.fixture=[];
  for(let r=0;r<kz;r++){
    if(r===kz-1) state.fixture.push(iz);        // anteúltima fecha de todo el torneo
    state.fixture.push([].concat(per[0][r]||[], per[1][r]||[]));
  }
}

/* ---------- Orden dentro de cada zona y entre zonas ---------- */
function zoneSort(a,b){ const A=state.standings[a], B=state.standings[b]; return (B.pts-A.pts)||((B.gf-B.gc)-(A.gf-A.gc))||(B.gf-A.gf); }
// Comparación entre equipos de zonas distintas (jugaron distinta cantidad de partidos): promedios por partido
function perGameCmp(a,b){
  const A=state.standings[a], B=state.standings[b];
  const pa=A.pj?A.pts/A.pj:0, pb=B.pj?B.pts/B.pj:0;
  if(pa!==pb) return pb-pa;
  const da=A.pj?(A.gf-A.gc)/A.pj:0, db=B.pj?(B.gf-B.gc)/B.pj:0;
  if(da!==db) return db-da;
  const ga=A.pj?A.gf/A.pj:0, gb=B.pj?B.gf/B.pj:0;
  return (gb-ga)||(teamPower(teamById(b))-teamPower(teamById(a)));
}
function zoneSorted(){ return state.groups.map(g=>g.slice().sort(zoneSort)); }

/* Cupos: qualifiersFor() en total, mitad por zona. Con cantidad impar, el cupo extra va a la zona
   cuyo primer no clasificado viene mejor (promedio por partido). */
function mafiaQuota(){
  const n=state.teams.length, q=qualifiersFor(n), base=Math.floor(q/2);
  const k=[base,base]; let extra=-1;
  if(q%2){
    const Z=zoneSorted();
    const ca=Z[0][base], cb=Z[1][base];
    if(ca===undefined) extra=1; else if(cb===undefined) extra=0;
    else{
      const c=perGameCmp(ca,cb);
      extra = c<0 ? 0 : c>0 ? 1 : (state.groups[0].length>=state.groups[1].length ? 0 : 1);
    }
    k[extra]++;
  }
  return {q, base, k, extra};
}

/* Clasificados en orden de siembra: se intercalan las zonas (1°A, 1°B, 2°A, 2°B…) arrancando por la zona
   con el cupo extra o, si no hay, por la del mejor primero. Con la llave estándar (1 vs último, 2 vs anteúltimo…)
   eso da siempre cruces entre zonas: el 1° de una zona contra el último clasificado de la otra, etc. */
function mafiaRankingIds(){
  const Z=zoneSorted(), Q=mafiaQuota();
  let X = Q.extra>=0 ? Q.extra : (perGameCmp(Z[0][0],Z[1][0])<=0 ? 0 : 1);
  const seq=[], order=[X,1-X];
  for(let i=0; seq.length<Q.q; i++){
    order.forEach(gi=>{ if(seq.length<Q.q && i<Q.k[gi] && Z[gi][i]!==undefined) seq.push(Z[gi][i]); });
  }
  const rest=[];
  Z.forEach((z,gi)=>z.slice(Q.k[gi]).forEach((id,i)=>rest.push({id,pos:Q.k[gi]+i})));
  rest.sort((a,b)=>a.pos-b.pos || perGameCmp(a.id,b.id));
  return seq.concat(rest.map(r=>r.id));
}

/* ---------- Clasificados / eliminados ---------- */
function zoneLeft(){
  const left={}; state.teams.forEach(t=>left[t.id]=0);
  state.fixture.forEach(md=>md.forEach(m=>{ if(!m.played){ left[m.home]++; left[m.away]++; } }));
  return left;
}
function zoneAllDone(){ return state.fixture.length>0 && state.fixture.every(md=>md.every(m=>m.played)); }
// Ya aseguraron su lugar dentro de los cupos fijos de su zona (aunque pierdan todo lo que les queda)
function zoneClinchedSet(){
  const out=new Set(); if(!zonesOn()) return out;
  const Q=mafiaQuota(), left=zoneLeft();
  if(zoneAllDone()){ mafiaRankingIds().slice(0,Q.q).forEach(id=>out.add(id)); return out; }
  state.groups.forEach(g=>g.forEach(id=>{
    const pts=state.standings[id].pts;
    const can=g.filter(o=>o!==id && state.standings[o].pts+3*left[o]>=pts).length;
    if(can<=Q.base-1) out.add(id);
  }));
  return out;
}
// Ya no pueden clasificar
function zoneOutSet(){
  const out=new Set(); if(!zonesOn()) return out;
  const Q=mafiaQuota(), left=zoneLeft();
  if(zoneAllDone()){ const ok=new Set(mafiaRankingIds().slice(0,Q.q)); state.teams.forEach(t=>{ if(!ok.has(t.id)) out.add(t.id); }); return out; }
  const slots=Q.base+(Q.q%2?1:0);   // con cupo extra posible, hasta el puesto base+1 de la zona todavía tiene chances
  state.groups.forEach(g=>g.forEach(id=>{
    const mx=state.standings[id].pts+3*left[id];
    if(g.filter(o=>o!==id && state.standings[o].pts>mx).length>=slots) out.add(id);
  }));
  return out;
}

/* ---------- Tabla por zona ---------- */
function renderZoneStandings(){
  const tbody=document.querySelector("#standingsTable tbody");
  const rowsSnap=window.chiquiRowsSnap ? window.chiquiRowsSnap(tbody) : null;
  tbody.innerHTML="";
  _stPrev=null;
  const Q=mafiaQuota(), cl=zoneClinchedSet(), out=zoneOutSet(), anyP=state.fixture.some(md=>md.some(m=>m.played)), done=zoneAllDone();
  const fin=done ? new Set(mafiaRankingIds().slice(0,Q.q)) : null;
  zoneSorted().forEach((g,gi)=>{
    const h=document.createElement("tr"); h.className="grp-head";
    h.innerHTML=`<td colspan="10" style="text-align:left;font-weight:800;color:var(--gold);padding:8px 6px;">${zoneName(gi)}</td>`;
    tbody.appendChild(h);
    g.forEach((id,i)=>{
      const t=teamById(id), r=state.standings[id];
      const tr=document.createElement("tr");
      if(t.isHuman) tr.classList.add("you");
      if(isMe(t)) tr.classList.add("me");
      let cls="";
      if(done){
        if(fin.has(id)) cls = "q-clinched";   // con todo jugado, el del cupo extra también queda como ya clasificado (amarillo)
        else cls="q-last";
      } else if(out.has(id)) cls="q-last";
      else if(cl.has(id)) cls="q-clinched";
      else if(i<Q.base) cls="q-zone";
      else if(i===Q.base && Q.extra===gi && anyP) cls="q-zone";
      if(cls) tr.classList.add(cls);
      tr.innerHTML=`<td><span class="rank-num">${i+1}</span></td>
      <td><div class="team-cell">${chiquiDotHtml(t)}${t.name}${meBadge(t)}</div></td>
      <td>${r.pj}</td><td>${r.pg}</td><td>${r.pe}</td><td>${r.pp}</td><td>${r.gf}</td><td>${r.gc}</td><td>${r.gf-r.gc}</td><td class="pts">${r.pts}</td>`;
      tbody.appendChild(tr);
    });
  });
  document.getElementById("qLegend").innerHTML=`<span><i class="lg-sw z"></i>Zona de clasificación (top ${Q.base} de cada zona${Q.q%2?" + cupo extra":""})</span><span><i class="lg-sw c"></i>Ya clasificado</span><span><i class="lg-sw l"></i>Eliminado</span>`;
  if(rowsSnap && window.chiquiRowsPlay) window.chiquiRowsPlay(tbody,rowsSnap);
  requestAnimationFrame(fitStandingsSidebar);
}

/* ---------- Textos ---------- */
function mafiaSizes(n){ const a=Math.ceil(n/2); return [a,n-a]; }
function mafiaCountText(n){
  const [a,b]=mafiaSizes(n), q=qualifiersFor(n);
  const split = q%2 ? `${Math.floor(q/2)} por zona + 1 cupo extra` : `${q/2} por zona`;
  return `Zona A: ${a} · Zona B: ${b}. Clasifican ${q} (${split}); fecha interzona en la anteúltima jornada.`;
}
// Tarjeta de pie del partido en la jornada: "Zona A" / "Zona B" / "Interzona"
function mafiaDayHasInterzone(md){ return !!(md && md.some(m=>m.g===2)); }
