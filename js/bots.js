/* =========================================================
   INTELIGENCIA DE LOS BOTS
   Se usa SOLO en la Puja, El Reloj y el Mercado (state.botLevel: facil | regular | dificil).
   - ovrNoise: error al "ver" la media de un jugador (los bots se equivocan más en Fácil).
   - jitter: cuánto varía lo que están dispuestos a pagar.
   - needSense: cuánto les importa cubrir las posiciones que les faltan.
   - reserve: parte de la plata por plantilla que guardan para completar el plantel (Puja).
   - flake / impulse: distracciones y arrebatos (Fácil).
   - clockLo/clockHi/clockNeed/clockOff/clockCap/react: cuándo y a qué precio fichan en El Reloj.
   - sellAsk: cuánto piden por sus jugadores en el Mercado (× su valor), swapDisc: cuánto valoran el jugador que les das a cambio,
     starPremium: sobreprecio por sus mejores jugadores.
   - Al evaluar una oferta (evaluateOffer): lineupSense = cuánto pesa lo que pierde/gana su once, balanceSense = cuánto pesa que el plantel quede
     desequilibrado, rivalSense = recargo por venderle a un rival de arriba, cashSense = cuánto le pesa la plata según su presupuesto,
     acceptMargin = margen extra que exige (negativo = acepta algo menos de lo que pedía), vetoGaps/vetoBad = rechaza si deja una línea vacía /
     muy desbalanceado, mood = impulso de aceptar ofertas flojas (Fácil).
   - offerFactor: precio de las ofertas que te mandan (× valor del jugador), offerEvery: cada cuánto mandan ofertas, maxConcurrent: cuántas te pueden
     llegar sin responder a la vez.
   - Entre bots: buyCap = máximo que pagan (× valor), buyerGain = cuánto tiene que mejorarles el once, freeGain/freeBudgetCap = cuándo y a qué precio
     fichan libres, botDealEvery/maxBotDeals = ritmo y cantidad de operaciones.
========================================================= */
const BOT_LEVELS={
  facil:{ ovrNoise:14, jitter:0.35, needSense:0.10, reserve:0,    flake:0.10, impulse:0.12,
          clockLo:0.55, clockHi:1.25, clockNeed:1.0,  clockOff:0.9,  clockCap:3.6, clockCapOff:3.6, react:[700,1700], clockFlake:0.12,
          sellAsk:[0.75,1.10], swapDisc:1.0,  starPremium:0,
          lineupSense:0.15, balanceSense:0.15, rivalSense:0,    cashSense:0,   acceptMargin:-0.05, vetoGaps:false, vetoBad:false, mood:0.12,
          offerFactor:[0.5,1.2],  offerEvery:[14000,24000], maxOffers:4, maxConcurrent:2, minUpgrade:-99,
          buyCap:2.1,  buyerGain:-99, freeGain:-99, freeBudgetCap:0.60, botDealEvery:[10000,17000], maxBotDeals:4 },
  regular:{ ovrNoise:6, jitter:0.20, needSense:0.30, reserve:0.25, flake:0,    impulse:0,
          clockLo:0.60, clockHi:0.95, clockNeed:1.15, clockOff:0.75, clockCap:2.2, clockCapOff:2.2, react:[250,700],  clockFlake:0,
          sellAsk:[1.05,1.35], swapDisc:0.85, starPremium:0.10,
          lineupSense:0.6,  balanceSense:0.6,  rivalSense:0.05, cashSense:0.10, acceptMargin:0.05,  vetoGaps:true,  vetoBad:false, mood:0,
          offerFactor:[0.9,1.15], offerEvery:[10000,18000], maxOffers:6, maxConcurrent:3, minUpgrade:1,
          buyCap:1.75, buyerGain:1,   freeGain:4,   freeBudgetCap:0.35, botDealEvery:[8000,14000],  maxBotDeals:7 },
  dificil:{ ovrNoise:1.5, jitter:0.05, needSense:0.35, reserve:0.60, flake:0,    impulse:0,
          clockLo:0.90, clockHi:1.00, clockNeed:1.10, clockOff:0.70, clockCap:2.6, clockCapOff:1.7, react:[60,220],   clockFlake:0,
          sellAsk:[1.25,1.50], swapDisc:0.78, starPremium:0.25,
          lineupSense:1.0,  balanceSense:1.0,  rivalSense:0.12, cashSense:0.20, acceptMargin:0.10,  vetoGaps:true,  vetoBad:true,  mood:0,
          offerFactor:[1.10,1.30], offerEvery:[8000,14000],  maxOffers:8, maxConcurrent:4, minUpgrade:3,
          buyCap:2.0,  buyerGain:3,   freeGain:6,   freeBudgetCap:0.25, botDealEvery:[6500,11000],  maxBotDeals:12 }
};
function botLvl(){ return BOT_LEVELS[state.botLevel] || BOT_LEVELS.regular; }
function rndIn(a,b){ return a+Math.random()*(b-a); }
function baseValue(p){ return 20+(Math.max(30,p.ovr)-30)*(180/69); } // ovr 30 -> 20M, ovr 99 -> ~200M
/* Valor que el bot "cree" que tiene el jugador (con error según la dificultad) */
function botSees(p){
  const o=Math.max(30,Math.min(99,p.ovr+(Math.random()*2-1)*botLvl().ovrNoise));
  return 20+(o-30)*(180/69);
}
/* Multiplicador por posición: paga más por lo que le falta y menos por lo que ya tiene cubierto */
function botNeedMult(team,pos){
  const ns=botLvl().needSense;
  return neededPositions(team).includes(pos) ? 1+ns : 1-ns*0.6;
}
/* Cuántos puestos le faltan a una lista de jugadores respecto del equilibrio objetivo */
function posShortage(ids){
  const counts={POR:0,DEF:0,MED:0,DEL:0};
  ids.forEach(pid=>{ const p=playerById(pid); if(p) counts[p.pos]++; });
  const targets = squadSize()===5 ? {POR:1,DEF:2,MED:1,DEL:1} : {POR:1,DEF:4,MED:4,DEL:2};
  let miss=0; Object.keys(targets).forEach(k=>{ miss+=Math.max(0,targets[k]-counts[k]); });
  return miss;
}
/* Precio máximo que un bot está dispuesto a pagar en la Puja (se calcula una vez por jugador) */
function botReservation(team, player){
  const L=botLvl();
  const slotsLeft=Math.max(1, squadSize()-team.roster.length);
  let v=botSees(player)*botNeedMult(team,player.pos);
  v*=(1-L.jitter)+Math.random()*2*L.jitter;
  // administra la plata: guarda una parte para los puestos que le quedan por cubrir
  const perSlot=team.budget/slotsLeft;
  const reserve=Math.max(MIN_PRICE, perSlot*L.reserve)*(slotsLeft-1);
  return Math.max(0, Math.min(v, team.budget-reserve));
}
/* Plan de un bot en El Reloj: a qué precio compra (T) y cuánto tarda en reaccionar */
function botClockPlan(team, p){
  const L=botLvl();
  const need=neededPositions(team).includes(p.pos);
  const slots=Math.max(1, squadSize()-team.roster.length);
  const perSlot=team.budget/slots;
  const fair=botSees(p);
  let T=fair*(need?L.clockNeed:L.clockOff)*rndIn(L.clockLo,L.clockHi);
  if(L.clockFlake && Math.random()<L.clockFlake) T=0;          // se distrae y no lo ve
  const cap = perSlot*(need?L.clockCap:L.clockCapOff); // el difícil no malgasta plata en lo que no necesita
  T=Math.min(T, cap);
  return {T: T<=0 ? 0 : Math.max(CLOCK_FLOOR, Math.round(T)), react:rndIn(L.react[0],L.react[1])};
}
