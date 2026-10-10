/* =========================================================
   TARJETAS, SUSPENSIONES Y VAR
========================================================= */
/* Frecuencia de tarjetas por equipo y partido (antes: 1.5 amarillas de promedio y 5% de roja directa) */
const CARD_YELLOW_AVG = 0.7;   // amarillas promedio por equipo en un partido
const CARD_RED_CHANCE = 0.015; // chance de roja directa por equipo en un partido
/* Las suspensiones SOLO existen en la fase eliminatoria. En liga / fase de liga / fase de grupos no hay suspendidos ni se acumulan amarillas. */
function suspensionsOn(){ return !!state.playoffs; }
function discRec(pid){ const D=state.disc||(state.disc={}); return D[pid]||(D[pid]={y:0,susp:0,r:0}); }
function isSusp(pid){ return suspensionsOn() && !!(state.disc && state.disc[pid] && state.disc[pid].susp>0); }
function suspPen(team){ let m=1; team.roster.forEach(pid=>{ if(isSusp(pid)){ const p=playerById(pid); m-=clamp((p.ovr-55)/400,0.02,0.1); } }); return Math.max(0.7,m); }
function rollCards(team){
  const pool=team.roster.map(playerById).filter(p=>p && !isSusp(p.id));
  if(!pool.length) return [];
  const w=p=>p.pos==="DEF"?3:p.pos==="MED"?3:p.pos==="DEL"?1.5:0.4;
  const pickP=()=>{ const tot=pool.reduce((a,p)=>a+w(p),0); let r=Math.random()*tot; for(const p of pool){ r-=w(p); if(r<=0) return p; } return pool[0]; };
  const raw=[];
  const nY=poissonish(CARD_YELLOW_AVG);
  for(let i=0;i<nY;i++) raw.push({pid:pickP().id,type:"Y",minute:randInt(6,89)});
  if(Math.random()<CARD_RED_CHANCE) raw.push({pid:pickP().id,type:"R",minute:randInt(10,89)});
  raw.sort((a,b)=>a.minute-b.minute);
  const yc={}, out_={}, out=[];
  raw.forEach(c=>{
    if(out_[c.pid]) return;
    if(c.type==="R"){ out_[c.pid]=1; out.push(c); return; }
    yc[c.pid]=(yc[c.pid]||0)+1;
    if(yc[c.pid]>=2){ out_[c.pid]=1; out.push({pid:c.pid,type:"Y2",minute:c.minute}); }
    else out.push(c);
  });
  return out;
}
function cardFx(home,away){
  const hc=rollCards(home), ac=rollCards(away);
  let h=suspPen(home), a=suspPen(away);
  hc.forEach(c=>{ if(c.type==="Y") return; const r=(90-c.minute)/90; h*=1-0.32*r; a*=1+0.15*r; });
  ac.forEach(c=>{ if(c.type==="Y") return; const r=(90-c.minute)/90; a*=1-0.32*r; h*=1+0.15*r; });
  const sh=home.roster.filter(isSusp), sa=away.roster.filter(isSusp);
  return {h:clamp(h,0.35,1.5), a:clamp(a,0.35,1.5), hc, ac, sh, sa, home, away};
}
function applyDisc(fx,noSusp){
  if(noSusp || !suspensionsOn()) return; // liga / fase de liga / fase de grupos: sin suspensiones ni acumulación de amarillas
  fx.sh.concat(fx.sa).forEach(pid=>{ const d=discRec(pid); d.susp=Math.max(0,d.susp-1); }); // cumplieron la fecha
  fx.hc.concat(fx.ac).forEach(c=>{
    const d=discRec(c.pid);
    if(c.type==="Y"){ d.y++; if(d.y>=3){ d.y=0; d.susp=1; } }          // 3 amarillas = 1 fecha
    else if(c.type==="Y2"){ d.y=Math.max(0,d.y-1); d.susp=1; d.r++; } // doble amarilla
    else { d.susp=1; d.r++; }                                          // roja directa
  });
}
function addDiscFeed(feed,fx,home,away,T90,labels,events){
  const tickOf=m=>{ let i=m<=45 ? m-1 : labels.indexOf(String(m)); if(i<0) i=Math.min(T90-1,m); return clamp(i,0,T90-1); };
  const nm=pid=>playerById(pid).name;
  const addC=(list,team)=>list.forEach(c=>{
    const tk=tickOf(c.minute), mn=labels[tk];
    const t=c.type==="Y" ? `🟨 Amarilla para ${nm(c.pid)} (${team.name})`
      : c.type==="Y2" ? `🟨🟥 Segunda amarilla: ¡EXPULSADO ${nm(c.pid)}! ${team.name} juega con uno menos`
      : `🟥 ¡ROJA DIRECTA para ${nm(c.pid)}! ${team.name} se queda con diez`;
    feed.push({tick:tk,ord:0,neutral:true,big:c.type!=="Y",minute:mn,text:t});
  });
  addC(fx.hc,home); addC(fx.ac,away);
  const sus=[].concat(fx.sh.map(id=>nm(id)+" ("+home.name+")"),fx.sa.map(id=>nm(id)+" ("+away.name+")"));
  if(sus.length) feed.push({tick:0,ord:-0.5,neutral:true,minute:"0",text:"🚫 Ausentes por suspensión: "+sus.join(", ")});
  // VAR: confirma goles reales
  (events||[]).forEach(e=>{ if(e.isGoal && Math.random()<0.07){
    feed.push({tick:Math.min(T90-1,e.tick+1),ord:0,neutral:true,minute:labels[Math.min(T90-1,e.tick+1)],text:`📺 El VAR revisa la jugada del gol de ${nm(e.playerId)}... ¡GOL CONFIRMADO!`}); } });
  // VAR: gol anulado (no suma)
  [home,away].forEach(team=>{ if(Math.random()<0.16){
    const pl=pickWeightedPlayer(team), tk=randInt(5,T90-3);
    feed.push({tick:tk,ord:0,neutral:true,minute:labels[tk],text:`🚨 ¿Gol de ${pl.name}? (${team.name}) ¡Ya lo gritaban!`});
    feed.push({tick:tk+1,ord:1,neutral:true,big:true,minute:labels[tk+1],text:`📺 VAR: gol ANULADO por ${pick(["fuera de juego milimétrico","falta previa en la jugada","mano en la acción"])}. El marcador no cambia.`});
  }});
  // VAR: penal revisado
  if(Math.random()<0.12){
    const team=Math.random()<0.5?home:away, pl=pickWeightedPlayer(team), tk=randInt(5,T90-3);
    feed.push({tick:tk,ord:0,neutral:true,minute:labels[tk],text:`📺 El VAR llama al árbitro por un posible penal sobre ${pl.name} (${team.name})...`});
    feed.push({tick:tk+1,ord:1,neutral:true,minute:labels[tk+1],text:`🙅 Tras revisar la imagen, el árbitro decide: no hay penal. Sigue el juego.`});
  }
}
