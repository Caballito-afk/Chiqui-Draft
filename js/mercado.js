/* =========================================================
   MERCADO
========================================================= */
function setupMarket(){
  state.market={target:null, bidder:(state.teams.find(t=>t.isHuman)||state.teams[0]).id, offers:[], offerSeq:0, log:[], filter:"all",
    tab:"teams", freeTarget:null, freePos:"all", freeLog:[]};
  document.getElementById("marketTabs").style.display = state.useFreeMarket ? "" : "none";
  document.getElementById("freePosFilter").value="all";
  setMarketTab("teams");
  const sel=document.getElementById("marketTeamFilter");
  sel.innerHTML=`<option value="all">Todos los equipos</option>`+state.teams.map(t=>`<option value="${t.id}">${t.name}</option>`).join("");
  sel.value="all";
  marketBotsInit();
  renderMarket();
}
function marketBotsInit(){
  const m=state.market; if(!m) return;
  m.botSent=0; m.botHist={}; m.botTimer=null; m.botDeals=0; m.botMktTimer=null;
  const d=document.getElementById("marketDesc");
  const base="Ofertá con la plata que te quedó por jugadores de otros equipos. Cada operación es dinero + un jugador tuyo a cambio (así las plantillas siguen completas) y el dueño decide si acepta (los equipos CPU deciden solos). Podés mandar varias ofertas a la vez. Podés saltearte el mercado cuando quieras.";
  const botsOffer = state.botOffers && state.mode==="ia";
  const botsTrade = state.mode==="ia";
  d.textContent = base + (botsOffer ? " Ojo: los bots también te van a mandar ofertas por tus jugadores." : "")
    + (botsTrade ? " Los bots además se ofertan entre ellos" + (state.useFreeMarket ? " y fichan jugadores libres." : ".") : "");
  botScheduleOffer(true);
  botMarketSchedule(true);
}
document.getElementById("marketTeamFilter").addEventListener("change",(e)=>{
  state.market.filter=e.target.value; renderMarket();
});
document.getElementById("endMarketBtn").addEventListener("click",()=>{
  if(!state.market) return;
  state.market=null;
  proceedAfterMarket();
});


/* ---- MERCADO LIBRE: jugadores que nadie tiene (no salieron en la puja), a precios caros ---- */
const FREE_PRICE_MULT=2.5;
function freePrice(p){
  const base=20+(Math.max(30,p.ovr)-30)*(180/69); // mismo valor base que usan los bots
  return Math.max(50, Math.round(base*FREE_PRICE_MULT/5)*5);
}
function freeAgents(){
  const owned=new Set(); state.teams.forEach(t=>t.roster.forEach(id=>owned.add(id)));
  return poolPlayers().filter(p=>!owned.has(p.id));
}
function setMarketTab(tab){
  const m=state.market; if(!m) return;
  if(tab==="free" && !state.useFreeMarket) tab="teams";
  m.tab=tab;
  document.querySelectorAll("#marketTabs .mk-tab").forEach(b=>b.classList.toggle("on",b.dataset.tab===tab));
  document.getElementById("marketTeamsLayout").style.display = tab==="teams" ? "" : "none";
  document.getElementById("marketFreeLayout").style.display = tab==="free" ? "" : "none";
  if(tab==="free") renderFreeMarket(); else renderMarket();
}
document.querySelectorAll("#marketTabs .mk-tab").forEach(b=>b.addEventListener("click",()=>setMarketTab(b.dataset.tab)));
document.getElementById("freePosFilter").addEventListener("change",(e)=>{
  if(!state.market) return; state.market.freePos=e.target.value; renderFreeMarket();
});
function freeLog(msg, cls){
  state.market.freeLog.push({msg, cls:cls||""});
  if(state.market.freeLog.length>40) state.market.freeLog.shift();
}

function renderFreeMarket(){
  const m=state.market; if(!m) return;
  renderFreeSide();
  renderFreeOfferCard();
}
function renderFreeSide(){
  const m=state.market; if(!m) return;
  if(m.freeTarget!==null && !freeAgents().some(p=>p.id===m.freeTarget)) m.freeTarget=null;

  const tBox=document.getElementById("freeTeams");
  tBox.innerHTML="";
  state.teams.forEach(t=>{
    const row=document.createElement("div");
    row.className="auction-team";
    row.innerHTML=`<span class="dot" style="background:${t.color}"></span><span class="nm">${t.name}${state.mode==="ia" && !t.isHuman ? ' <span class="cpu-badge">BOT</span>' : ''}</span><span class="cnt">${t.roster.length} jug.</span><span class="bud">${fmtM(t.budget)}</span>`;
    tBox.appendChild(row);
  });

  const list=document.getElementById("freeList");
  const sc=list.scrollTop;
  list.innerHTML="";
  let agents=freeAgents();
  if(m.freePos!=="all") agents=agents.filter(p=>p.pos===m.freePos);
  agents.sort((a,b)=>b.ovr-a.ovr);
  if(!agents.length) list.innerHTML='<div style="color:var(--muted-2); font-size:13px; padding:10px;">No quedan jugadores libres en esta posición.</div>';
  agents.forEach(p=>{
    const row=document.createElement("div");
    row.className="mk-row"+(m.freeTarget===p.id?" sel":"");
    row.innerHTML=`<span class="pos-badge pos-${p.pos}">${p.pos}</span>
      <span class="mk-name">${p.name}<div class="mk-owner">${p.country} · ${p.club}</div></span>
      <span class="mk-ovr tier-${squadAvgTier(p.ovr)}">${p.ovr}</span><span class="mk-price">${fmtM(freePrice(p))}</span>`;
    const btn=document.createElement("button");
    btn.className="btn sm"; btn.textContent="Fichar";
    btn.addEventListener("click",()=>{ m.freeTarget=p.id; renderFreeMarket(); });
    row.appendChild(btn);
    list.appendChild(row);
  });
  list.scrollTop=sc;

  const lg=document.getElementById("freeLog");
  lg.innerHTML=m.freeLog.length ? m.freeLog.slice().reverse().map(e=>`<div class="${e.cls}">${e.msg}</div>`).join("") : '<div class="no">Todavía no hubo fichajes.</div>';
}

function renderFreeOfferCard(){
  const m=state.market;
  m.freeSig=freeFormSig();
  const card=document.getElementById("freeOfferCard");
  const humans=state.teams.filter(t=>t.isHuman);
  const bidderOpts=humans.map(t=>`<option value="${t.id}" ${t.id===m.bidder?"selected":""}>${t.name} (${fmtM(t.budget)})</option>`).join("");
  const bidderSel=`<div class="offer-field"><label>Equipo que ficha</label><select id="freeBidder">${bidderOpts}</select></div>`;
  const bindBidder=()=>document.getElementById("freeBidder").addEventListener("change",(e)=>{ m.bidder=Number(e.target.value); renderFreeMarket(); });

  if(m.freeTarget===null){
    card.innerHTML=`<h3 class="section-title">Nuevo fichaje</h3>${bidderSel}
      <div style="color:var(--muted-2); font-size:13px;">Elegí un jugador libre de la lista y tocá "Fichar". Son jugadores que no salieron en la puja, por eso cuestan caro.</div>`;
    bindBidder();
    return;
  }

  const buyer=teamById(m.bidder);
  const tp=playerById(m.freeTarget), price=freePrice(tp);
  const giveOpts=buyer.roster.map(pid=>{ const p=playerById(pid); return `<option value="${pid}">${p.name} (${p.pos} · ${p.ovr})</option>`; }).join("");
  card.innerHTML=`<h3 class="section-title">Nuevo fichaje</h3>${bidderSel}
    <div class="offer-field" style="font-size:14px;">Jugador: <b>${tp.name}</b> (${tp.pos} · ${tp.ovr}) · ${tp.country}<br>
      Precio: <b style="color:var(--gold)">${fmtM(price)}</b> (tenés ${fmtM(buyer.budget)})</div>
    <div class="offer-field"><label>Jugador tuyo a liberar (vuelve al mercado libre, sin reembolso)</label><select id="freeGive">${giveOpts}</select></div>
    <div class="offer-err" id="freeErr"></div>
    <div class="btn-row" style="margin-top:0">
      <button class="btn primary" id="freeBuyBtn">Comprar por ${fmtM(price)}</button>
      <button class="btn" id="freeCancelBtn">Cancelar</button>
    </div>`;
  bindBidder();
  document.getElementById("freeCancelBtn").addEventListener("click",()=>{ m.freeTarget=null; renderFreeMarket(); });
  document.getElementById("freeBuyBtn").addEventListener("click",()=>{
    const giveId=Number(document.getElementById("freeGive").value);
    const err=validateFreeSigning(buyer, tp, giveId, price);
    if(err){ document.getElementById("freeErr").textContent=err; return; }
    const gp=playerById(giveId);
    buyer.roster=buyer.roster.filter(id=>id!==giveId).concat(tp.id);
    buyer.budget-=price;
    freeLog(`✅ ${buyer.name} ficha a ${tp.name} (${tp.pos} · ${tp.ovr}) por ${fmtM(price)} y libera a ${gp.name}`,"ok");
    m.freeTarget=null;
    renderFreeMarket();
  });
}

function validateFreeSigning(buyer, target, giveId, price){
  if(!freeAgents().some(p=>p.id===target.id)) return "Ese jugador ya no está libre.";
  if(!buyer.roster.includes(giveId)) return "Elegí un jugador tuyo para liberar.";
  if(price>buyer.budget) return `${buyer.name} solo tiene ${fmtM(buyer.budget)}.`;
  const after=buyer.roster.filter(id=>id!==giveId).concat(target.id);
  if(!rosterHasPor(after)) return `${buyer.name} se quedaría sin arquero.`;
  return null;
}

function ownerOf(playerId){ return state.teams.find(t=>t.roster.includes(playerId)); }
let _PBI=null;
function playerById(id){ if(!_PBI) _PBI=new Map(PLAYERS.map(p=>[p.id,p])); return _PBI.get(id); }
function rosterHasPor(ids){ return ids.some(id=>playerById(id).pos==="POR"); }

function validateTrade(o){
  const buyer=teamById(o.buyerId), owner=teamById(o.ownerId);
  if(!buyer || !owner || buyer.id===owner.id) return "Elegí un jugador de otro equipo.";
  if(!owner.roster.includes(o.targetId)) return "Ese jugador ya no está en ese equipo.";
  if(!buyer.roster.includes(o.giveId)) return "Elegí un jugador tuyo para entregar a cambio.";
  if(!Number.isInteger(o.amount) || o.amount<0) return "El monto tiene que ser un número entero (0 o más).";
  if(o.amount>buyer.budget) return `${buyer.name} solo tiene ${fmtM(buyer.budget)}.`;
  const buyerAfter=buyer.roster.filter(id=>id!==o.giveId).concat(o.targetId);
  const ownerAfter=owner.roster.filter(id=>id!==o.targetId).concat(o.giveId);
  if(!rosterHasPor(buyerAfter)) return `${buyer.name} se quedaría sin arquero.`;
  if(!rosterHasPor(ownerAfter)) return `${owner.name} se quedaría sin arquero.`;
  return null;
}

function marketLog(msg, cls){
  state.market.log.push({msg, cls:cls||""});
  if(state.market.log.length>40) state.market.log.shift();
}

/* ---------- Ofertas múltiples: lista de ofertas en curso (state.market.offers) ---------- */
const MAX_HUMAN_OFFERS=8;      // ofertas simultáneas máximas por equipo humano
const SLOPE=180/69;            // millones por punto de media (mismo valor base que usan los bots)

function renderMarketSide(){
  const m=state.market; if(!m) return;
  if(m.target!==null){
    const ow=ownerOf(m.target);
    if(!ow || ow.id===m.bidder) m.target=null;
  }

  const tBox=document.getElementById("marketTeams");
  tBox.innerHTML="";
  state.teams.forEach(t=>{
    const row=document.createElement("div");
    row.className="auction-team";
    row.innerHTML=`<span class="dot" style="background:${t.color}"></span><span class="nm">${t.name}${state.mode==="ia" && !t.isHuman ? ' <span class="cpu-badge">BOT</span>' : ''}</span><span class="cnt">${t.roster.length} jug.</span><span class="bud">${fmtM(t.budget)}</span>`;
    tBox.appendChild(row);
  });

  const list=document.getElementById("marketList");
  const sc=list.scrollTop;
  list.innerHTML="";
  let players=[];
  state.teams.forEach(t=>{
    if(m.filter!=="all" && String(t.id)!==String(m.filter)) return;
    t.roster.forEach(pid=>players.push({p:playerById(pid), owner:t}));
  });
  players.sort((a,b)=>b.p.ovr-a.p.ovr);
  players.forEach(({p,owner})=>{
    const row=document.createElement("div");
    row.className="mk-row"+(m.target===p.id?" sel":"");
    const already=m.offers.some(x=>x.buyerId===m.bidder && x.targetId===p.id);
    const canOffer = owner.id!==m.bidder && !already;
    row.innerHTML=`<span class="pos-badge pos-${p.pos}">${p.pos}</span>
      <span class="mk-name">${p.name}<div class="mk-owner" style="color:${owner.color}">${owner.name}</div></span>
      <span class="mk-ovr tier-${squadAvgTier(p.ovr)}">${p.ovr}</span>`;
    const btn=document.createElement("button");
    const online=!!(window.ONL && ONL.active); // online: la lista la ve cada jugador, así que se valida al tocar (según quién opera)
    btn.className="btn sm"; btn.textContent=(!online && already)?"Ofertado":"Ofertar"; btn.disabled=online ? false : !canOffer;
    btn.addEventListener("click",()=>{ if(online && (owner.id===m.bidder || m.offers.some(x=>x.buyerId===m.bidder && x.targetId===p.id))) return; m.target=p.id; renderMarket(); });
    row.appendChild(btn);
    list.appendChild(row);
  });
  list.scrollTop=sc;

  const lg=document.getElementById("marketLog");
  lg.innerHTML=m.log.length ? m.log.slice().reverse().map(e=>`<div class="${e.cls}">${e.msg}</div>`).join("") : '<div class="no">Todavía no hubo movimientos.</div>';
}

function renderMarket(){
  const m=state.market; if(!m) return;
  renderMarketSide();
  renderOfferCard();
  renderOffersPanel();
}
/* Refresco liviano (lo disparan los bots): no pisa el formulario de oferta que estás completando */
function marketFormSig(){
  const m=state.market; const b=teamById(m.bidder); const ow=m.target!==null?ownerOf(m.target):null;
  return m.target+"|"+(ow?ow.id:"-")+"|"+b.budget+"|"+b.roster.join(",");
}
function refreshMarket(){
  const m=state.market; if(!m || m.tab!=="teams") return;
  const before=m.target;
  renderMarketSide();
  if(m.target!==before || marketFormSig()!==m.formSig) renderOfferCard();
  renderOffersPanel();
}
function freeFormSig(){
  const m=state.market; const b=teamById(m.bidder);
  return m.freeTarget+"|"+b.budget+"|"+b.roster.join(",");
}
function refreshFree(){
  const m=state.market; if(!m || m.tab!=="free") return;
  const before=m.freeTarget;
  renderFreeSide();
  if(m.freeTarget!==before || freeFormSig()!==m.freeSig) renderFreeOfferCard();
}
function refreshMarketAll(){ refreshMarket(); refreshFree(); }

/* Panel con todas las ofertas en curso que involucran a un humano (las que mandás vos y las que te mandan) */
function renderOffersPanel(){
  const m=state.market; if(!m) return;
  const card=document.getElementById("offersPanel");
  const list=m.offers.filter(o=>teamById(o.ownerId).isHuman || teamById(o.buyerId).isHuman);
  if(!list.length){ card.style.display="none"; card.innerHTML=""; return; }
  card.style.display="";
  card.innerHTML=`<h3 class="section-title">Ofertas en curso (${list.length})</h3>`;
  list.forEach(o=>{
    const buyer=teamById(o.buyerId), owner=teamById(o.ownerId);
    const tp=playerById(o.targetId), gp=playerById(o.giveId);
    const ownerHuman=owner.isHuman, mine=buyer.isHuman;
    const el=document.createElement("div");
    el.className="offer-item"+(ownerHuman?" incoming":"");
    el.innerHTML=`<div class="oi-tag">${ownerHuman ? (o.fromBot ? "📨 Oferta recibida" : "Oferta para "+owner.name) : "📤 Oferta enviada"}</div>
      <div><b style="color:${buyer.color}">${buyer.name}</b> ofrece <b style="color:var(--gold)">${fmtM(o.amount)}</b> + <b>${gp.name}</b> (${gp.pos} · ${gp.ovr})
      por <b>${tp.name}</b> (${tp.pos} · ${tp.ovr}) de <b style="color:${owner.color}">${owner.name}</b>.</div>`;
    if(ownerHuman){
      const row=document.createElement("div");
      row.className="btn-row"; row.style.marginTop="8px";
      const ok=document.createElement("button"); ok.className="btn primary sm"; ok.textContent="Aceptar";
      ok.addEventListener("click",()=>acceptOffer(o.id));
      const no=document.createElement("button"); no.className="btn sm"; no.textContent="Rechazar";
      no.addEventListener("click",()=>rejectOffer(o.id));
      row.appendChild(ok); row.appendChild(no);
      ok.dataset.team=owner.id; no.dataset.team=owner.id;
      if(mine){
        const wd=document.createElement("button"); wd.className="btn sm"; wd.textContent="Retirar";
        wd.addEventListener("click",()=>withdrawOffer(o.id));
        row.appendChild(wd);
        wd.dataset.team=buyer.id;
      }
      const who=document.createElement("div"); who.style.cssText="font-size:12px; color:var(--muted); margin-top:6px;";
      who.innerHTML=`Decide <b style="color:${owner.color}">${owner.name}</b>`;
      el.appendChild(who); el.appendChild(row);
    } else {
      const st=document.createElement("div"); st.style.cssText="font-size:12.5px; color:var(--muted); margin-top:4px;";
      st.innerHTML=`<b style="color:${owner.color}">${owner.name}</b> (CPU) está evaluando la oferta...`;
      el.appendChild(st);
    }
    card.appendChild(el);
  });
}

function renderOfferCard(){
  const m=state.market;
  const card=document.getElementById("offerCard");

  const humans=state.teams.filter(t=>t.isHuman);
  const bidderOpts=humans.map(t=>`<option value="${t.id}" ${t.id===m.bidder?"selected":""}>${t.name} (${fmtM(t.budget)})</option>`).join("");
  m.formSig=marketFormSig();
  if(m.target===null){
    card.innerHTML=`<h3 class="section-title">Nueva oferta</h3>
      <div class="offer-field"><label>Equipo que oferta</label><select id="offBidder">${bidderOpts}</select></div>
      <div style="color:var(--muted-2); font-size:13px;">Elegí un jugador de la lista y tocá "Ofertar". Podés mandar varias ofertas a la vez.</div>`;
    document.getElementById("offBidder").addEventListener("change",(e)=>{ m.bidder=Number(e.target.value); renderMarket(); });
    return;
  }

  const buyer=teamById(m.bidder);
  const tp=playerById(m.target), owner=ownerOf(m.target);
  const taken=new Set(m.offers.filter(x=>x.buyerId===buyer.id).map(x=>x.giveId));
  const giveOpts=buyer.roster.filter(pid=>!taken.has(pid)).map(pid=>{ const p=playerById(pid); return `<option value="${pid}">${p.name} (${p.pos} · ${p.ovr})</option>`; }).join("");
  card.innerHTML=`<h3 class="section-title">Nueva oferta</h3>
    <div class="offer-field"><label>Equipo que oferta</label><select id="offBidder">${bidderOpts}</select></div>
    <div class="offer-field" style="font-size:14px;">Objetivo: <b>${tp.name}</b> (${tp.pos} · ${tp.ovr}) de <b style="color:${owner.color}">${owner.name}</b></div>
    <div class="offer-field"><label>Dinero a ofrecer en M (tenés ${fmtM(buyer.budget)})</label><input type="number" id="offAmount" min="0" max="${buyer.budget}" step="1" value="0"></div>
    <div class="offer-field"><label>Jugador tuyo a entregar a cambio</label><select id="offGive">${giveOpts}</select></div>
    <div class="offer-err" id="offerErr"></div>
    <div class="btn-row" style="margin-top:0">
      <button class="btn primary" id="sendOfferBtn">Enviar oferta</button>
      <button class="btn" id="cancelOfferBtn">Cancelar</button>
    </div>`;
  document.getElementById("offBidder").addEventListener("change",(e)=>{ m.bidder=Number(e.target.value); renderMarket(); });
  document.getElementById("cancelOfferBtn").addEventListener("click",()=>{ m.target=null; renderMarket(); });
  document.getElementById("sendOfferBtn").addEventListener("click",()=>{
    const o={buyerId:m.bidder, ownerId:owner.id, targetId:m.target,
      giveId:Number(document.getElementById("offGive").value),
      amount:Number(document.getElementById("offAmount").value)};
    const err=validateTrade(o) || offerConflict(o);
    if(err){ document.getElementById("offerErr").textContent=err; return; }
    submitOffer(o); m.target=null;
    renderMarket();
  });
}

/* Evita duplicados entre las ofertas simultáneas de un mismo equipo */
function offerConflict(o){
  const m=state.market;
  const mine=m.offers.filter(x=>x.buyerId===o.buyerId);
  if(mine.some(x=>x.targetId===o.targetId)) return "Ya tenés una oferta pendiente por ese jugador.";
  if(mine.some(x=>x.giveId===o.giveId)) return "Ese jugador tuyo ya está ofrecido en otra oferta pendiente.";
  if(teamById(o.buyerId).isHuman && mine.length>=MAX_HUMAN_OFFERS) return `Máximo ${MAX_HUMAN_OFFERS} ofertas pendientes a la vez.`;
  return null;
}
/* Registra una oferta; si el dueño es CPU, la responde solo después de "pensarla" un rato */
function submitOffer(o){
  const m=state.market;
  o.id=++m.offerSeq;
  m.offers.push(o);
  if(!teamById(o.ownerId).isHuman) setTimeout(()=>cpuRespondOffer(m,o.id), rndIn(1000,2800));
}

/* ---------- Cómo piensa un bot cuando le llega una oferta ----------
   Compara la plata + el jugador que recibe contra lo que vale el jugador que pierde (según su media, con más o menos
   error al tasarlo según la dificultad) y además mira cómo le afecta al equipo:
     - once ideal: cuánto pierde (o gana) en la suma de sus titulares por puesto,
     - equilibrio: si el plantel queda más desbalanceado (o si le deja una línea vacía),
     - figuras: si es de sus 3 mejores, lo cotiza más caro,
     - rival: venderle al puntero lo piensa dos veces,
     - plata: si anda corto de presupuesto, la plata le pesa más.
   Fácil casi no mira nada de eso (y a veces se le da por aceptar por impulso); Difícil lo mira todo y exige margen. */
function lineupScore(ids){
  const targets = squadSize()===5 ? {POR:1,DEF:2,MED:1,DEL:1} : {POR:1,DEF:4,MED:4,DEL:2};
  const by={POR:[],DEF:[],MED:[],DEL:[]};
  ids.forEach(pid=>{ const p=playerById(pid); if(p) by[p.pos].push(p.ovr); });
  let s=0;
  Object.keys(targets).forEach(k=>{
    by[k].sort((a,b)=>b-a);
    for(let i=0;i<targets[k];i++) s+=(by[k][i]!==undefined ? by[k][i] : 35); // puesto vacío = como un jugador de 35
  });
  return s;
}
function emptyLines(c){
  const n=c.DEF+c.MED+c.DEL, big=n>=8;
  return (c.DEF===0?1:0)+(c.DEL===0?1:0)+(big&&c.MED===0?1:0);
}
function evaluateOffer(owner, o, det){
  const L=botLvl();
  const tp=playerById(o.targetId), gp=playerById(o.giveId), buyer=teamById(o.buyerId);
  const see=p=> det ? baseValue(p) : botSees(p);   // det = estimación sin error (para que un bot arme ofertas razonables)
  const before=owner.roster, after=before.filter(id=>id!==tp.id).concat(gp.id);

  // 1) lo que pide: valor del jugador x margen de venta de su dificultad
  let asked=see(tp)*(det ? (L.sellAsk[0]+L.sellAsk[1])/2 : rndIn(L.sellAsk[0],L.sellAsk[1]));
  // 2) ¿es una de sus figuras?
  const top=before.map(playerById).sort((a,b)=>b.ovr-a.ovr).slice(0,3).map(p=>p.id);
  if(top.includes(tp.id)) asked*=1+L.starPremium;
  // 3) efecto en el once ideal
  const dLine=lineupScore(before)-lineupScore(after);
  const penLine = dLine>0 ? dLine*SLOPE*L.lineupSense : Math.max(-asked*0.3, dLine*SLOPE*L.lineupSense*0.5);
  asked+=penLine;
  // 4) equilibrio del plantel
  const bB=teamBalance({roster:before}), bA=teamBalance({roster:after});
  const dx=bA.x-bB.x;
  const balMult = dx>0 ? 1+L.balanceSense*dx*1.4 : Math.max(0.9, 1+L.balanceSense*dx*0.4);
  const penBal=asked*(balMult-1);
  asked+=penBal;
  // 5) rival directo: no le gusta fortalecer a los de arriba
  const ranked=state.teams.slice().sort((a,b)=>teamPower(b)-teamPower(a));
  if(ranked.indexOf(buyer)<=1 && teamPower(buyer)>=teamPower(owner)) asked*=1+L.rivalSense;
  // 6) valor de la plata para él
  const avgBud=Math.max(1,state.teams.reduce((s,t)=>s+t.budget,0)/state.teams.length);
  const moneyMult=1+L.cashSense*Math.max(-0.5,Math.min(0.5,1-owner.budget/avgBud));
  // 7) lo que recibe: la plata + el jugador a cambio (con descuento)
  const gpCredit=see(gp)*L.swapDisc;
  const received=o.amount*moneyMult+gpCredit;
  const need=asked*(1+L.acceptMargin);

  let accept=received>=need, reason=null;
  const gapsB=emptyLines(bB.counts), gapsA=emptyLines(bA.counts);
  if(L.vetoGaps && gapsA>gapsB){ accept=false; reason="lo dejaría sin jugadores en una línea"; }
  else if(L.vetoBad && bA.level==="bad" && bB.level!=="bad"){ accept=false; reason="le desequilibraría demasiado el plantel"; }
  else if(!det && !accept && L.mood && Math.random()<L.mood){ accept=received>=asked*0.75; } // impulso (solo Fácil)
  if(!accept && !reason){
    const short=need-received;
    if(penBal>=penLine && penBal>short*0.6) reason="le desequilibra el plantel";
    else if(penLine>short*0.6) reason="le debilitaría el once";
    else reason="no alcanza para lo que vale el jugador";
  }
  return {accept, asked:need, received, reason, gpCredit, moneyMult};
}
function cpuRespondOffer(m,id){
  if(state.market!==m) return;
  const o=m.offers.find(x=>x.id===id); if(!o) return;
  const owner=teamById(o.ownerId);
  const ev=evaluateOffer(owner,o,false);
  if(ev.accept) acceptOffer(id); else rejectOffer(id, ev.reason);
}

/* ---- Los bots te mandan ofertas por tus jugadores (pueden llegar varias a la vez) ---- */
function botScheduleOffer(first){
  const m=state.market; if(!m || !state.botOffers || state.mode!=="ia") return;
  const L=botLvl();
  clearTimeout(m.botTimer);
  const wait = first ? rndIn(3500,6500) : rndIn(L.offerEvery[0],L.offerEvery[1]);
  m.botTimer=setTimeout(()=>botOfferTick(m), wait);
}
function botOfferTick(m){
  if(state.market!==m) return;                       // el mercado ya terminó
  if(m.botSent>=botLvl().maxOffers) return;          // ya mandaron todas las ofertas que podían
  const open=m.offers.filter(o=>o.fromBot && teamById(o.ownerId).isHuman).length;
  // si estás en el mercado libre o ya tenés muchas ofertas sin responder, esperan un rato
  if(m.tab!=="teams" || open>=botLvl().maxConcurrent){ m.botTimer=setTimeout(()=>botOfferTick(m),2500); return; }
  if(botSendOffer()) m.botSent++;
  botScheduleOffer(false);
}
/* Arma (sin enviar) la mejor oferta de un bot b por algún jugador de `owners`. Devuelve {o,hist,key,score} o null. */
function botBuildOffer(b, owners, toHuman){
  const m=state.market; const L=botLvl(); const lvl=state.botLevel;
  m.botHist=m.botHist||{};
  const needs=neededPositions(b);
  const cands=[];
  owners.forEach(h=>h.roster.forEach(pid=>{
    const tp=playerById(pid);
    const key=b.id+"-"+pid;
    const hist=m.botHist[key]||{tries:0};
    if(hist.tries>=(lvl==="dificil"?2:1)) return;                 // no insisten con lo que ya rechazaron
    if(m.offers.some(x=>x.buyerId===b.id && x.targetId===pid)) return; // ya tiene una oferta abierta por ese jugador
    const same=b.roster.map(playerById).filter(p=>p.pos===tp.pos);
    const worst=same.length ? Math.min(...same.map(p=>p.ovr)) : 40;
    const upgrade=tp.ovr-worst;
    const need=needs.includes(tp.pos);
    if(upgrade<L.minUpgrade && !(need && upgrade>=0)) return;
    let score;
    if(lvl==="facil") score=Math.random()*10+upgrade*0.3;           // a veces apuntan sin sentido
    else if(lvl==="regular") score=upgrade+(need?2:0)+Math.random()*6;
    else score=upgrade+(need?4:0)+Math.random()*2;                   // el difícil va por lo que de verdad mejora
    cands.push({h,tp,score,hist,key});
  }));
  if(!cands.length) return null;
  cands.sort((x,y)=>y.score-x.score);
  const order = lvl==="dificil" ? cands.slice(0,6) : shuffle(cands.slice(0,3)).concat(cands.slice(3,6));
  for(const c of order){
    const o=botMakeOffer(b,c,toHuman);
    if(o) return {o, hist:c.hist, key:c.key, score:c.score};
  }
  return null;
}
function botMakeOffer(b, c, toHuman){
  const m=state.market; const L=botLvl(); const lvl=state.botLevel;
  const {h,tp,hist}=c;
  const V=baseValue(tp);
  // qué jugador entrega: el que menos le duele, sin quedarse sin arquero ni regalar a sus figuras
  const stars=b.roster.map(playerById).sort((x,y)=>y.ovr-x.ovr).slice(0,3).map(p=>p.id);
  let gives=b.roster.map(playerById).filter(p=>p.id!==tp.id);
  gives = tp.pos!=="POR" ? gives.filter(p=>p.pos!=="POR") : gives.filter(p=>p.pos==="POR");
  if(lvl!=="facil"){ const safe=gives.filter(p=>!stars.includes(p.id)); if(safe.length) gives=safe; }
  gives=gives.filter(p=>!m.offers.some(x=>x.buyerId===b.id && x.giveId===p.id));
  const bBefore=teamBalance(b), lineBefore=lineupScore(b.roster);
  const reserve=Math.max(0,(squadSize()-b.roster.length)*MIN_PRICE);
  const options=[];
  shuffle(gives.slice()).forEach(gp=>{
    const afterIds=b.roster.filter(id=>id!==gp.id).concat(tp.id);
    const gain=lineupScore(afterIds)-lineBefore;
    if(lvl!=="facil"){
      if(gain<L.buyerGain) return;                                           // tiene que mejorarle el once
      if(teamBalance({roster:afterIds}).x>bBefore.x+0.02) return;            // y no desequilibrarlo
      if(gp.ovr>=tp.ovr) return;                                             // no entrega algo mejor que lo que pide
    }
    const credit=baseValue(gp)*0.85;
    let amount, total;
    if(toHuman){
      let factor=rndIn(L.offerFactor[0],L.offerFactor[1]);
      if(lvl==="dificil") factor*=1+0.12*hist.tries;                          // si rechazaste, vuelve con algo más
      total=V*factor;
      if(lvl!=="facil" && credit>total) return;
      amount=Math.max(0,Math.round(total-credit));
    } else {
      // oferta a otro bot: calcula cuánto le va a pedir ese bot (misma lógica con que responde) y paga justo eso
      const probe={buyerId:b.id, ownerId:h.id, targetId:tp.id, giveId:gp.id, amount:0};
      const ev=evaluateOffer(h,probe,true);
      const needMoney=Math.max(0,(ev.asked-ev.gpCredit)/ev.moneyMult);
      const f = lvl==="facil" ? rndIn(0.55,1.2) : lvl==="regular" ? rndIn(0.95,1.10) : rndIn(0.99,1.06)*(1+0.05*hist.tries);
      amount=Math.max(0,Math.ceil(needMoney*f));
      total=amount+credit;
      if(total>V*L.buyCap) return;                                           // no paga de más
    }
    if(amount>b.budget-reserve) return;                                      // no se queda sin plata
    const o={buyerId:b.id, ownerId:h.id, targetId:tp.id, giveId:gp.id, amount, fromBot:true};
    if(validateTrade(o) || offerConflict(o)) return;
    options.push({o,gain});
  });
  if(!options.length) return null;
  if(lvl==="dificil") options.sort((x,y)=>(y.gain-x.gain)||(x.o.amount-y.o.amount));
  return options[0].o;
}
function botSendOffer(){
  const m=state.market;
  const humans=state.teams.filter(t=>t.isHuman);
  const bots=state.teams.filter(t=>!t.isHuman && t.roster.length>0);
  if(!humans.length || !bots.length) return false;
  const res=bots.map(b=>botBuildOffer(b,humans,true)).filter(Boolean);
  if(!res.length) return false;
  const pick = state.botLevel==="dificil" ? res.sort((x,y)=>y.score-x.score)[0] : res[Math.floor(Math.random()*res.length)];
  pick.hist.tries++; m.botHist[pick.key]=pick.hist;
  const b=teamById(pick.o.buyerId), tp=playerById(pick.o.targetId), gp=playerById(pick.o.giveId);
  submitOffer(pick.o);
  marketLog(`📨 ${b.name} te ofrece ${fmtM(pick.o.amount)} + ${gp.name} por ${tp.name}`,"");
  refreshMarket();
  return true;
}

/* ---- Los bots también operan entre ellos: se ofertan jugadores y fichan libres ---- */
function botMarketSchedule(first){
  const m=state.market; if(!m || state.mode!=="ia") return;
  const L=botLvl();
  clearTimeout(m.botMktTimer);
  const wait = first ? rndIn(5000,9000) : rndIn(L.botDealEvery[0],L.botDealEvery[1]);
  m.botMktTimer=setTimeout(()=>botMarketTick(m), wait);
}
function botMarketTick(m){
  if(state.market!==m) return;
  if(m.botDeals>=botLvl().maxBotDeals) return;
  const bots=state.teams.filter(t=>!t.isHuman);
  let done=false;
  for(const b of shuffle(bots.slice())){
    const acts = (state.useFreeMarket && Math.random()<0.4) ? ["free","trade"] : ["trade","free"];
    for(const a of acts){
      if(a==="free" && state.useFreeMarket) done=botSignFree(b);
      else if(a==="trade" && bots.length>=2) done=botTradeOffer(b,bots);
      if(done) break;
    }
    if(done) break;
  }
  if(done) m.botDeals++;
  botMarketSchedule(false);
}
function botTradeOffer(b, bots){
  const m=state.market;
  const owners=bots.filter(t=>t.id!==b.id && t.roster.length>0);
  const r=botBuildOffer(b,owners,false);
  if(!r) return false;
  r.hist.tries++; m.botHist[r.key]=r.hist;
  submitOffer(r.o);   // el otro bot la evalúa con sus propios criterios
  return true;
}
function botSignFree(b){
  const m=state.market; const L=botLvl(); const lvl=state.botLevel;
  const agents=freeAgents(); if(!agents.length) return false;
  const lineBefore=lineupScore(b.roster), balBefore=teamBalance(b);
  const needs=neededPositions(b);
  const pool = lvl==="facil" ? shuffle(agents.slice()).slice(0,8) : agents;
  let best=null;
  pool.forEach(p=>{
    const price=freePrice(p);
    if(price>b.budget*L.freeBudgetCap) return;                               // no gasta de más en un libre (salen caros)
    b.roster.forEach(gid=>{
      if(validateFreeSigning(b,p,gid,price)) return;
      const afterIds=b.roster.filter(id=>id!==gid).concat(p.id);
      const gain=lineupScore(afterIds)-lineBefore;
      if(lvl!=="facil"){
        if(gain<L.freeGain) return;                                          // solo ficha si mejora de verdad
        if(teamBalance({roster:afterIds}).x>balBefore.x+0.02) return;
      }
      const score = lvl==="facil" ? Math.random()
        : gain*10 - price/10 + (needs.includes(p.pos)?5:0) + (lvl==="regular"?Math.random()*20:0);
      if(!best || score>best.score) best={p,gid,price,score};
    });
  });
  if(!best) return false;
  const g=playerById(best.gid);
  b.roster=b.roster.filter(id=>id!==best.gid).concat(best.p.id);
  b.budget-=best.price;
  freeLog(`🤖 ${b.name} ficha a ${best.p.name} (${best.p.pos} · ${best.p.ovr}) por ${fmtM(best.price)} y libera a ${g.name}`,"ok");
  pruneOffers();
  refreshMarketAll();
  return true;
}

/* Saca las ofertas que dejaron de ser válidas (alguien vendió al jugador, se quedó sin plata, etc.) */
function pruneOffers(){
  const m=state.market; if(!m) return;
  m.offers=m.offers.filter(o=>{
    const err=validateTrade(o);
    if(!err) return true;
    const buyer=teamById(o.buyerId), owner=teamById(o.ownerId);
    if(buyer.isHuman || owner.isHuman) marketLog(`⚠️ Se cayó la oferta de ${buyer.name} por ${playerById(o.targetId).name}: ${err}`,"no");
    return false;
  });
}
function acceptOffer(id){
  const m=state.market; if(!m) return;
  const idx=m.offers.findIndex(x=>x.id===id); if(idx<0) return;
  const o=m.offers[idx];
  const err=validateTrade(o);
  m.offers.splice(idx,1);
  if(err){ marketLog(`Operación cancelada: ${err}`,"no"); pruneOffers(); refreshMarketAll(); return; }
  const buyer=teamById(o.buyerId), owner=teamById(o.ownerId);
  const tp=playerById(o.targetId), gp=playerById(o.giveId);
  buyer.roster=buyer.roster.filter(id2=>id2!==o.giveId).concat(o.targetId);
  owner.roster=owner.roster.filter(id2=>id2!==o.targetId).concat(o.giveId);
  buyer.budget-=o.amount; owner.budget+=o.amount;
  const botDeal=!buyer.isHuman && !owner.isHuman;
  marketLog(`${botDeal?"🤖 ":""}✅ ${buyer.name} se queda con ${tp.name} (${owner.name}) por ${fmtM(o.amount)} + ${gp.name}`,"ok");
  pruneOffers();
  refreshMarketAll();
}
function rejectOffer(id, reason){
  const m=state.market; if(!m) return;
  const idx=m.offers.findIndex(x=>x.id===id); if(idx<0) return;
  const o=m.offers[idx]; m.offers.splice(idx,1);
  const buyer=teamById(o.buyerId), owner=teamById(o.ownerId);
  const why = reason && buyer.isHuman && !owner.isHuman ? ` (${reason})` : "";
  marketLog(`❌ ${owner.name} rechazó la oferta de ${buyer.name} por ${playerById(o.targetId).name}${why}`,"no");
  refreshMarketAll();
}
function withdrawOffer(id){
  const m=state.market; if(!m) return;
  const idx=m.offers.findIndex(x=>x.id===id); if(idx<0) return;
  const o=m.offers[idx]; m.offers.splice(idx,1);
  marketLog(`↩️ ${teamById(o.buyerId).name} retiró su oferta por ${playerById(o.targetId).name}`,"no");
  refreshMarketAll();
}
