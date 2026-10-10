/* =========================================================
   XI IDEAL DEL TORNEO (aparece solo al terminar, como el campeón)
========================================================= */
function computeBestXI(){
  const champId = state.comp==="league" ? standingsRows()[0].t.id : state.playoffs.champion;
  const f = state.squadSize===5 ? {POR:1,DEF:1,MED:2,DEL:1,key:"1-2-1"} : {POR:1,DEF:4,MED:3,DEL:3,key:"4-3-3"};
  const all=[];
  state.teams.forEach(t=>t.roster.forEach(pid=>{
    const p=playerById(pid); if(!p) return;
    const d=state.scorers[pid]||{};
    const perf=(d.goals||0)*3+(d.assists||0)*2+(d.extra||0)+(t.id===champId?2:0);
    all.push({p,t,r:perf*1.6+p.ovr*0.3});
  }));
  all.sort((a,b)=>b.r-a.r);
  const chosen=[], total=f.POR+f.DEF+f.MED+f.DEL;
  ["POR","DEF","MED","DEL"].forEach(pos=>{ all.filter(e=>e.p.pos===pos).slice(0,f[pos]).forEach(e=>chosen.push(e)); });
  all.filter(e=>e.p.pos!=="POR" && !chosen.includes(e)).forEach(e=>{ if(chosen.length<total) chosen.push(e); });
  return {list:chosen, key:f.key};
}
function xiHTML(){
  const xi=computeBestXI();
  const spots=squadFormationSpots(xi.list.map(e=>e.p.id), xi.key);
  const tokens=xi.list.map((e,i)=>{ const pos=spots[e.p.id]; if(!pos) return "";
    return `<div class="ptoken p-${e.p.pos}" style="left:${pos.x}%;top:${pos.y}%;--i:${i}" title="${e.t.name}"><div class="pc" style="background:${e.t.color}">${e.t.name}</div><div class="disc" style="border-color:${e.t.color}"><small>${e.p.pos}</small><b>${e.p.ovr}</b></div><div class="pn">${e.p.name}</div></div>`; }).join("");
  return `<h3 class="awards-title">⭐ XI Ideal del Torneo</h3>
    <div class="xi-inline"><div class="xi-sub">Formación ${xi.key} · los mejores rendimientos de todos los clubes</div>
    <div class="pitch"><div class="ln mid"></div><div class="ln circle"></div><div class="ln boxT"></div><div class="ln boxB"></div><div class="ln goalT"></div><div class="ln goalB"></div>${tokens}</div></div>`;
}
