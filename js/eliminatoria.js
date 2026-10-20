/* =========================================================
   ELIMINATORIA / COPA
========================================================= */
function nextPow2(n){ let p=1; while(p<n) p*=2; return p; }

// Cantidad de clasificados a la fase eliminatoria en la Copa de la liga
function qualifiersFor(n){
  if(state.champions) return Math.max(2,Math.floor(n/4)*2)+champThirds(n);
  if(n===3) return 1;                 // 3 participantes: el 1° es campeón directo
  if([4,5,6].includes(n)) return 2;   // siempre juegan la final los 2 primeros
  let q=Math.max(2,Math.ceil(n/2));
  if(q===6) q=8;                      // nunca clasifican 6 (con 11 o 12 equipos pasan 8)
  return q;
}
function compLabel(){ return state.champions ? "Champions" : {league:"Liga", cup:"Copa", leaguecup:"Copa de la liga"}[state.comp]; }
function playoffTeam(id){ return state.teams.find(t=>t.id===id); }
// Orden de siembra del cuadro: [1,8,4,5,2,7,3,6] para 8 lugares, etc.
function seedOrder(size){
  let o=[1];
  while(o.length<size){ const n=o.length*2; o=o.flatMap(x=>[x,n+1-x]); }
  return o;
}
function titleForTeams(n){
  if(n<=2) return "Final";
  if(n<=4) return "Semifinales";
  if(n<=8) return "Cuartos de final";
  if(n<=16) return "Octavos de final";
  return "Ronda";
}

function newLeg(h,a){ return {home:h, away:a, played:false, homeGoals:null, awayGoals:null, et:false, pens:null, events:[]}; }
// homeId = equipo mejor sembrado. En ida y vuelta abre de visitante y cierra de local.
function makeTie(homeId, awayId, twoLeg){
  const legs = twoLeg ? [newLeg(awayId,homeId), newLeg(homeId,awayId)] : [newLeg(homeId,awayId)];
  return {home:homeId, away:awayId, legs, played:false, winner:null};
}
function legGoalsFor(leg,teamId){ return leg.home===teamId ? leg.homeGoals : leg.awayGoals; }
function tieAgg(tie,teamId){ return tie.legs.reduce((s,l)=>s+(l.played?legGoalsFor(l,teamId):0),0); }

function setupPlayoffs(){
  state.disc={}; // la eliminatoria arranca con la disciplina en cero (nada de la fase de liga se arrastra)
  if(state.champions) state.doubleLeg=true; // Champions / Libertadores: playoffs siempre de ida y vuelta (también en partidas guardadas viejas)
  if(liveRun){ clearInterval(liveRun.timer); liveRun=null; }
  document.getElementById("liveBox").innerHTML="";
  const c=state.comp;
  let rankedTeams;
  if(state.skipLeague){
    rankedTeams = c==="cup" ? shuffle(state.teams) : state.teams.slice().sort((a,b)=>teamPower(b)-teamPower(a));
  } else {
    rankedTeams = standingsRows().map(r=>r.t);
  }
  const n=rankedTeams.length;
  document.getElementById("playoffsTitle").textContent = c==="cup" ? "Copa" : "Fase Eliminatoria";
  const vb=document.getElementById("viewLeagueBtn");
  vb.style.display = (c==="leaguecup" && !state.skipLeague) ? "" : "none";

  if(c==="leaguecup" && n===3){
    document.getElementById("playoffsDesc").textContent = "Con 3 participantes no se juega la final: el 1° de la liga sale campeón directo.";
    state.playoffs = { seeds:[rankedTeams[0].id], rounds:[{ties:[], byes:[rankedTeams[0].id], leg:0, twoLeg:false, teamsInRound:1}], champion:rankedTeams[0].id, currentRound:0, expanded:new Set() };
    renderPlayoffs();
    return;
  }

  const qualifiers = c==="cup" ? n : qualifiersFor(n);
  const seeds = rankedTeams.slice(0,qualifiers);
  const size = nextPow2(seeds.length);
  const byes = size - seeds.length;
  const byeTeams = seeds.slice(0,byes);
  const playIn = seeds.slice(byes);
  const twoLeg = roundIsTwoLeg(size);

  let desc;
  if(state.skipLeague && c!=="cup") desc="Con 2 participantes no hay liga: van directo a la final.";
  else if(c==="cup") desc=`Cruces sorteados al azar con ${n} equipos; en cada ronda se vuelve a sortear.` + (byes>0 ? " Los equipos sin rival pasan directo (bye)." : "") + (!state.doubleLeg ? " Los partidos únicos se juegan en cancha neutral." : "");
  else desc = state.champions ? `Clasifican los 2 primeros de cada grupo${champThirds(n)?" y los "+champThirds(n)+" mejores terceros":""} (${qualifiers}). Local: el que más puntos sumó en la fase de grupos; no hay cruces del mismo grupo en octavos.` : `Clasifican los ${qualifiers} mejores de la liga.` + (byes>0 ? " Los mejor ubicados arrancan con bye." : "") + " En cada cruce, el mejor ubicado en la liga (más puntos; si empatan, mejor diferencia de gol) es local" + (size>2 && state.doubleLeg ? " y cierra la serie en su cancha." : ".") + (size>2 && !state.doubleLeg && !state.finalDouble ? " Incluida la final." : "");
  if(size>2 && state.doubleLeg) desc+=" Cada cruce es ida y vuelta" + (state.finalDouble ? ", incluida la final." : " (la final es a partido único).");
  else if(state.finalDouble) desc+=" La final es de ida y vuelta.";
  desc+= state.champions ? ((size>2&&state.doubleLeg||state.finalDouble) && state.awayGoals ? " Rige el gol de visitante en las series de ida y vuelta." : "") + (state.champET ? " Si hay empate: prórroga y penales." : " Si hay empate: directo a penales.") : " Si hay empate: prórroga y penales.";
  document.getElementById("playoffsDesc").textContent = desc;

  // Cuadro fijo: siembra estándar (1 vs último, etc.). Los mejores sembrados reciben bye si sobran lugares.
  const order=seedOrder(size);
  if(state.champions && state.groups && !state.skipLeague){ // evitar cruces entre equipos del mismo grupo
    const pairs=()=>{ const o=[]; for(let i=0;i<size;i+=2) o.push([order[i]-1,order[i+1]-1]); return o; };
    const same=(i,j)=>seeds[i]&&seeds[j]&&groupOf(seeds[i].id)===groupOf(seeds[j].id);
    for(let pass=0;pass<20;pass++){
      let changed=false;
      pairs().forEach(([a,b])=>{
        if(!same(a,b)) return;
        for(const [c,d] of pairs()){
          if(c===a) continue;
          for(const [x,y] of [[d,b],[c,b]]){ // intercambiar el rival b con alguno del otro cruce
            const other=(x===d)?c:d; // el que se queda
            if(!seeds[x]||!seeds[other]) continue;
            if(groupOf(seeds[x].id)!==groupOf(seeds[a].id) && groupOf(seeds[b].id)!==groupOf(seeds[other].id)){
              const tmp=seeds[b]; seeds[b]=seeds[x]; seeds[x]=tmp; changed=true; return;
            }
          }
        }
      });
      if(!changed) break;
    }
  }
  const slots=[];
  for(let i=0;i<size;i+=2){
    let A=seeds[order[i]-1], B=seeds[order[i+1]-1];
    if(A && B && state.champions && state.groups && champCmp(B.id,A.id)<0){ const t=A; A=B; B=t; } // local: el mejor puntaje de la fase de grupos
    if(A && B) slots.push({tie:makeTie(A.id,B.id,twoLeg)});
    else slots.push({bye:(A||B).id});
  }
  const ties=slots.filter(x=>x.tie).map(x=>x.tie);
  const byeIds=slots.filter(x=>x.bye!==undefined).map(x=>x.bye);
  const rounds=[{ties, slots, byes:byeIds, leg:0, twoLeg, teamsInRound:size}];
  const totalRounds=Math.log2(size);
  while(rounds.length<totalRounds) rounds.push({ties:[], slots:[], byes:[], leg:0, twoLeg:false, teamsInRound:size/Math.pow(2,rounds.length)});

  state.playoffs = { seeds:seeds.map(t=>t.id), size, rounds, champion:null, currentRound:0, expanded:new Set() };
  renderPlayoffs();
}
