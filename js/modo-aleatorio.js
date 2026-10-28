/* =========================================================
   MODO ALEATORIO (planteles al azar; después mercado opcional)
========================================================= */
function setupRandomRosters(){
  randomizePlayerValues();
  const size=squadSize();
  const porPool=shuffleTrollBoost(poolPlayers().filter(p=>p.pos==="POR").map(p=>p.id));
  const restPool=shuffleTrollBoost(poolPlayers().filter(p=>p.pos!=="POR").map(p=>p.id));
  state.teams.forEach(t=>{ t.roster=[]; t.budget=state.startBudget; });
  state.teams.forEach(t=>{ const pid=porPool.shift(); if(pid!==undefined) t.roster.push(pid); });
  state.teams.forEach(t=>{
    while(t.roster.length<size && restPool.length) t.roster.push(restPool.shift());
  });
}

/* =========================================================
   MODO CUSTOM (Predio local): los planteles los arma el usuario a mano (js/custom-local.js)
   state.customRosters[i] = ids de los jugadores que eligió para el equipo i (los sobrantes quedan como jugadores libres)
========================================================= */
function setupCustomRosters(){
  const size=squadSize(), rs=state.customRosters||[];
  state.teams.forEach((t,i)=>{
    t.budget=state.startBudget;
    const ids=(rs[i]||[]).slice(0,size);
    // el arquero primero y después de mayor a menor media, como en los demás modos
    ids.sort((a,b)=>{ const pa=playerById(a), pb=playerById(b); return (pb.pos==="POR")-(pa.pos==="POR") || pb.ovr-pa.ovr; });
    t.roster=ids;
  });
  state.customRosters=null;
}
