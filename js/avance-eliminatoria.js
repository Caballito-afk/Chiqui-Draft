function advancePlayoffs(){
  if(liveRun) return;
  const pf=state.playoffs;
  if(!pf || pf.champion!==null) return;
  const r=pf.rounds[pf.currentRound];
  if(!r) return;
  const pending=r.ties.filter(t=>!t.legs[r.leg].played);
  if(!pending.length){ afterLiveFinish(); return; }
  const batch = state.playMode==="one" ? [pending[0]] : pending.slice(0,MAX_LIVE);
  startLiveRound(batch, r);
}

function buildNextRound(){
  const pf=state.playoffs;
  const r=pf.rounds[pf.currentRound];
  let advancing = r.slots.map(sl=> sl.tie ? sl.tie.winner : sl.bye); // en orden de llave
  if(advancing.length===1){
    pf.champion = advancing[0];
    renderPlayoffs();
    return;
  }
  pf.currentRound++;
  const twoLeg = roundIsTwoLeg(advancing.length);
  const next = pf.rounds[pf.currentRound] || {};
  const rank=id=>pf.seeds.indexOf(id);
  const nslots=[];
  for(let i=0;i<advancing.length;i+=2){
    let a=advancing[i], b=advancing[i+1];
    if(state.champions && state.groups){ if(champCmp(b,a)<0){ const t=a; a=b; b=t; } }
    else if(rank(b)<rank(a)){ const t=a; a=b; b=t; } // el mejor sembrado es el "local"; solo se sortean los primeros cruces de la Copa, después sigue el orden de la llave
    nslots.push({tie:makeTie(a,b,twoLeg)});
  }
  next.slots=nslots; next.ties=nslots.map(x=>x.tie);
  next.byes=[]; next.leg=0; next.twoLeg=twoLeg; next.teamsInRound=advancing.length;
  pf.rounds[pf.currentRound]=next;
  renderPlayoffs();
}
