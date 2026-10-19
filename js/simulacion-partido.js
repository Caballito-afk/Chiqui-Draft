const OCCASION_TYPES = ["Penal","Tiro libre","Situación de peligro","Jugada preparada","Córner","Contraataque","Cabezazo","Disparo desde lejos","Mano a mano con el arquero"];
const MISS_OUTCOMES = ["pero el arquero ataja","pero se va por arriba del travesaño","pero da en el palo","pero el remate sale desviado","pero la defensa rechaza sobre la línea","pero el arquero saca una tapada increíble"];
const PEN_GOAL_TXT = ["define con categoría y marca","engaña al arquero y convierte","la clava en el ángulo","cruza el remate y es gol","patea fuerte al medio y anota"];
const PEN_MISS_TXT = ["se lo ataja el arquero","la manda por arriba del travesaño","pega en el palo y se pierde","tira desviado, ¡lo falla!","el arquero adivina y la desvía"];

function pickWeightedPlayer(team){
  const weighted=bestAttackers(team,11);
  const total=weighted.reduce((s,x)=>s+x.w,0);
  let r=Math.random()*total, chosen=weighted[0];
  for(const x of weighted){ r-=x.w; if(r<=0){ chosen=x; break; } }
  return chosen.p;
}
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

// Tanda de penales: 5 por equipo (se corta si uno ya no puede ser alcanzado) y luego muerte súbita
function simulatePens(home, away){
  const order=t=>{
    const fld=shuffle(t.roster.filter(id=>playerById(id).pos!=="POR"));
    const gk=shuffle(t.roster.filter(id=>playerById(id).pos==="POR"));
    return fld.concat(gk);
  };
  const oH=order(home), oA=order(away);
  const dp=(teamPower(home)-teamPower(away))*0.003;
  let pH=clamp(0.75+dp,0.6,0.88), pA=clamp(0.75-dp,0.6,0.88);
  const kicks=[]; let hs=0, as=0, hk=0, ak=0, guard=0;
  const decided=()=>{
    if(hk<5 || ak<5){ const hL=5-hk, aL=5-ak; return hs>as+aL || as>hs+hL; }
    return hk===ak && hs!==as;
  };
  const shoot=(team,ord,idx,p)=>{
    const player=playerById(ord[idx%ord.length]);
    const scored=Math.random()<p;
    return {teamId:team.id, player:player.name, scored};
  };
  for(;;){
    guard++;
    if(guard>25){ pH=0.99; pA=0.01; } // seguridad: la muerte súbita no puede ser infinita
    let k=shoot(home,oH,hk,pH); hk++; if(k.scored) hs++; k.ph=hs; k.pa=as; kicks.push(k);
    if(decided()) break;
    k=shoot(away,oA,ak,pA); ak++; if(k.scored) as++; k.ph=hs; k.pa=as; kicks.push(k);
    if(decided()) break;
  }
  return {kicks, home:hs, away:as};
}

// Planifica un partido completo (90', prórroga y penales si hacen falta)
function planLeg(homeId, awayId, opts){
  const home=playoffTeam(homeId), away=playoffTeam(awayId);
  const needWinner=!!opts.needWinner, cH=opts.carryHome||0, cA=opts.carryAway||0;
  const aw=!!opts.awayRule && !!opts.isSecondLeg, useET=opts.et!==false;
  const awayDec=(hgT,agT)=> aw && cH!==agT; // global igualado pero decide el gol de visitante (el local de la vuelta marcó cH de visitante en la ida)
  const hp=teamPower(home), ap=teamPower(away);
  const diff=hp-ap;
  const hm=opts.neutral ? 1 : HOME_MULT_CUP, am=opts.neutral ? 1 : AWAY_MULT_CUP; // la final a partido único (cancha neutral) no da ventaja de local; en la final de ida y vuelta sí
  const hb=teamBalance(home), ab=teamBalance(away); // castigo por planteles desequilibrados
  const fx=cardFx(home,away);
  let hg=poissonish(clamp(Math.max(0.1,1.2+diff*0.1+(Math.random()-0.3)*1.3)*hm*hb.own*ab.conc*fx.h,0,7));
  let ag=poissonish(clamp(Math.max(0.1,1.2-diff*0.1+(Math.random()-0.3)*1.3)*am*ab.own*hb.conc*fx.a,0,7));

  // línea de tiempo del tiempo reglamentario (con tiempo añadido)
  const labels=[];
  const h1=randInt(0,4), h2=randInt(0,7);
  for(let m=1;m<=45;m++) labels.push(String(m));
  for(let k=1;k<=h1;k++) labels.push("45+"+k);
  const firstHalfEnd=labels.length-1;
  for(let m=46;m<=90;m++) labels.push(String(m));
  for(let k=1;k<=h2;k++) labels.push("90+"+k);
  const T90=labels.length;
  const agonicStart=labels.indexOf("89"); // agónico = del 89' en adelante

  const events=[];
  const mk=(team,isGoal,tick,agonicFrom)=>{
    const player=pickWeightedPlayer(team);
    const type=pick(OCCASION_TYPES);
    const agonic=isGoal && tick>=agonicFrom;
    const assistId = isGoal ? pickAssister(team, player.id) : null;
    const asTxt = assistId!==null ? ` (asist. ${playerById(assistId).name})` : "";
    const outcome=isGoal
      ? (agonic ? `¡¡GOL AGÓNICO de ${player.name}!!${asTxt}` : `¡GOL de ${player.name}!${asTxt}`)
      : `${player.name} remata, ${pick(MISS_OUTCOMES)}`;
    return {tick, minute:labels[tick], teamId:team.id, type, isGoal, agonic, outcome, playerId:player.id, assistId};
  };
  const lateTick=()=>randInt(agonicStart,T90-1);
  const goalTick=()=> Math.random()<0.12 ? lateTick() : randInt(0,T90-1);
  for(let i=0;i<hg;i++) events.push(mk(home,true,goalTick(),agonicStart));
  for(let i=0;i<ag;i++) events.push(mk(away,true,goalTick(),agonicStart));
  const extra=8+randInt(0,6);
  for(let i=0;i<extra;i++) events.push(mk(Math.random()<0.5?home:away,false,randInt(0,T90-1),agonicStart));

  // prórroga: si tras los 90' sigue el empate (en el global, si es vuelta)
  let et=false, etStart=-1, etHalfEnd=-1, etEnd=-1;
  if(needWinner && useET && cH+hg===cA+ag && !awayDec(hg,ag)){
    et=true;
    etStart=labels.length;
    const e1=randInt(0,2), e2=randInt(0,3);
    for(let m=91;m<=105;m++) labels.push(String(m));
    for(let k=1;k<=e1;k++) labels.push("105+"+k);
    etHalfEnd=labels.length-1;
    for(let m=106;m<=120;m++) labels.push(String(m));
    for(let k=1;k<=e2;k++) labels.push("120+"+k);
    etEnd=labels.length-1;
    const agonicET=labels.indexOf("119"); // en la prórroga también hay goles agónicos
    const etTick=()=> Math.random()<0.3 ? randInt(agonicET,etEnd) : randInt(etStart,etEnd);
    const eh=Math.min(3,poissonish(clamp((0.45+diff*0.02)*hm*hb.own*ab.conc,0.1,1.6)));
    const ea=Math.min(3,poissonish(clamp((0.45-diff*0.02)*am*ab.own*hb.conc,0.1,1.6)));
    for(let i=0;i<eh;i++) events.push(mk(home,true,etTick(),agonicET));
    for(let i=0;i<ea;i++) events.push(mk(away,true,etTick(),agonicET));
    const exET=3+randInt(0,3);
    for(let i=0;i<exET;i++) events.push(mk(Math.random()<0.5?home:away,false,randInt(etStart,etEnd),agonicET));
    hg+=eh; ag+=ea;
  }

  // penales: si aun así sigue empatado
  let pens=null;
  if(needWinner && cH+hg===cA+ag && !awayDec(hg,ag)) pens=simulatePens(home,away);

  const feed=[{tick:0, ord:-1, neutral:true, minute:"0", text:"🔔 ¡Comienza el partido!"}];
  events.forEach(e=>feed.push({...e, neutral:false, ord:0}));
  feed.push({tick:firstHalfEnd, ord:1, neutral:true, minute:labels[firstHalfEnd], text:"⏸ Final del primer tiempo"});
  const globalTxt = (cH+cA>0 || opts.isSecondLeg) ? "el global sigue igualado" : "hay empate";
  if(et){
    feed.push({tick:T90-1, ord:1, neutral:true, big:true, minute:labels[T90-1], text:`⏱ Terminaron los 90': ${globalTxt}, ¡se juega la prórroga!`});
    feed.push({tick:etStart, ord:-1, neutral:true, minute:labels[etStart], text:"▶ Comienza la prórroga"});
    feed.push({tick:etHalfEnd, ord:1, neutral:true, minute:labels[etHalfEnd], text:"⏸ Final del primer tiempo de la prórroga"});
  }
  if(pens){
    const pt = et ? etEnd : T90-1;
    feed.push({tick:pt, ord:1, neutral:true, big:true, minute:labels[pt], text: et ? "⏱ Fin de la prórroga y sigue el empate: ¡vamos a los penales!" : "⏱ Terminaron los 90' y sigue el empate: ¡sin prórroga, vamos directo a los penales!"});
    labels.push("PEN");
    feed.push({tick:labels.length-1, ord:0, neutral:true, big:true, minute:"PEN", text:"🥅 ¡Comienza la tanda de penales!"});
    pens.kicks.forEach(k=>{
      const t=playoffTeam(k.teamId);
      const tick=labels.length; labels.push("PEN","PEN");
      feed.push({tick, ord:0, pen:true, neutral:false, minute:"PEN", teamId:k.teamId, scored:k.scored, ph:k.ph, pa:k.pa,
        outcome: k.scored ? `${k.player} ${pick(PEN_GOAL_TXT)} (${k.ph}-${k.pa})` : `${k.player}: ${pick(PEN_MISS_TXT)} (${k.ph}-${k.pa})`});
    });
    labels.push("PEN");
    const winner = pens.home>pens.away ? home : away;
    const hi=Math.max(pens.home,pens.away), lo=Math.min(pens.home,pens.away);
    feed.push({tick:labels.length-1, ord:5, neutral:true, big:true, minute:"PEN", text:`🏁 ¡Final! ${winner.name} gana por penales ${hi}–${lo}`});
  } else {
    feed.push({tick:labels.length-1, ord:5, neutral:true, minute:labels[labels.length-1], text: et ? "🏁 Fin de la prórroga: ¡final del partido!" : "🏁 ¡Final del partido!"});
    if(needWinner && cH+hg===cA+ag && awayDec(hg,ag)){ const w = cH>ag ? home : away; feed.push({tick:labels.length-1, ord:6, neutral:true, big:true, minute:labels[labels.length-1], text:`⚖️ Global igualado: avanza ${w.name} por la regla del gol de visitante`}); }
  }
  addDiscFeed(feed,fx,home,away,T90,labels,events);
  applyDisc(fx);
  feed.sort((a,b)=>a.tick-b.tick || a.ord-b.ord);
  return {hg, ag, et, pens: pens ? {home:pens.home, away:pens.away} : null, feed, labels, T:labels.length};
}
