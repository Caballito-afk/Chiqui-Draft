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
