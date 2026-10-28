/* =========================================================
   MERCADO
========================================================= */
function setupMarket(){
  state.market={target:null, bidder:(mkOnline() ? ONL.myId : (state.teams.find(t=>t.isHuman)||state.teams[0]).id), views:{}, offers:[], offerSeq:0, log:[], filter:"all",
    tab:"teams", freeTarget:null, freePos:"all", freeLog:[],
    view:"main", posFilter:"all", notes:[], noteSeq:0, giveSel:null, offAmount:0, freeGive:null};
  document.getElementById("mkFreeTab").style.display = state.useFreeMarket ? "" : "none";
  document.getElementById("mkToasts").innerHTML="";
  document.getElementById("freePosFilter").value="all";
  document.getElementById("marketPosFilter").value="all";
  setMarketTab("teams");
  const sel=document.getElementById("marketTeamFilter");
  sel.innerHTML=`<option value="all">Todos los equipos</option>`+state.teams.map(t=>`<option value="${t.id}">${t.name}</option>`).join("");
  sel.value="all";
  marketBotsInit();
  if(window.MK_ONL) MK_ONL.reset();   // online: cada jugador arranca con su propia vista del mercado
  if(mkOnline()){ state.market.deadline=mkTimeMs() ? Date.now()+mkTimeMs() : null; state.market.votes={}; }   // online: 3 minutos y votación para saltarlo
  renderMarket();
}
/* ¿hay equipos manejados por bots? (un jugador con bots, o multijugador local con CPU) */
function hasBotTeams(){ return state.teams.some(t=>!t.isHuman); }
function marketBotsInit(){
  const m=state.market; if(!m) return;
  m.botSent=0; m.botHist={}; m.botTimer=null; m.botDeals=0; m.botMktTimer=null;
  const d=document.getElementById("marketDesc");
  const base="Ofertá con la plata que te quedó por jugadores de otros equipos. Cada operación es dinero + un jugador tuyo a cambio (así las plantillas siguen completas) y el dueño decide si acepta (los equipos CPU deciden solos). Podés mandar varias ofertas a la vez. Podés saltearte el mercado de pases cuando quieras.";
  const botsOffer = state.botOffers && hasBotTeams();
  const botsTrade = hasBotTeams();
  d.textContent = base + (botsOffer ? " Ojo: los bots también te van a mandar ofertas por tus jugadores." : "")
    + (botsTrade ? " Los bots además se ofertan entre ellos" + (state.useFreeMarket ? " y fichan jugadores libres." : ".") : "");
  botScheduleOffer(true);
  botMarketSchedule(true);
}
document.getElementById("marketTeamFilter").addEventListener("change",(e)=>{
  state.market.filter=e.target.value; renderMarket();
});
document.getElementById("marketPosFilter").addEventListener("change",(e)=>{
  if(!state.market) return; state.market.posFilter=e.target.value; renderMarket();
});
document.getElementById("endMarketBtn").addEventListener("click",()=>{
  if(!state.market) return;
  if(mkOnline()){ mkVoteToggle(ONL.myId); return; }   // online: se vota, no lo decide solo el anfitrión
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
  m.tab=tab; m.view="main"; m.target=null; m.freeTarget=null; m.freeGive=null;
  if(tab==="free"){ applyMarketLayout(); renderFreeMarket(); } else renderMarket();
}
document.querySelectorAll("#marketTabs .mk-tab").forEach(b=>b.addEventListener("click",()=>setMarketTab(b.dataset.tab)));
document.getElementById("freePosFilter").addEventListener("change",(e)=>{
  if(!state.market) return; state.market.freePos=e.target.value; renderFreeMarket();
});
function freeLog(msg, cls, ids){
  state.market.freeLog.push({msg, cls:cls||"", ids:ids||null});
  if(state.market.freeLog.length>40) state.market.freeLog.shift();
}

function renderFreeMarket(){
  const m=state.market; if(!m) return;
  if(m.view==="free" && (m.freeTarget===null || !freeAgents().some(p=>p.id===m.freeTarget))){ m.freeTarget=null; m.view="main"; }
  applyMarketLayout();
  if(m.view==="free"){ renderFreeView(); return; }
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
    row.innerHTML=`${chiquiDotHtml(t)}<span class="nm">${t.name}${!t.isHuman ? ' <span class="cpu-badge">BOT</span>' : ''}</span><span class="cnt">${t.roster.length} jug.</span><span class="bud">${fmtM(t.budget)}</span>`;
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
    btn.addEventListener("click",()=>{ openFreeView(p.id); });
    row.appendChild(btn);
    list.appendChild(row);
  });
  list.scrollTop=sc;

  const lg=document.getElementById("freeLog");
  const fl=mkVisibleLog(m.freeLog);
  lg.innerHTML=fl.length ? fl.slice().reverse().map(e=>`<div class="${e.cls}">${e.msg}</div>`).join("") : '<div class="no">Todavía no hubo fichajes.</div>';
}

function renderFreeOfferCard(){
  const m=state.market;
  m.freeSig=freeFormSig();
  const card=document.getElementById("freeOfferCard");
  const humans=state.teams.filter(t=>t.isHuman);
  const bidderOpts=humans.map(t=>`<option value="${t.id}" ${t.id===m.bidder?"selected":""}>${t.name} (${fmtM(t.budget)})</option>`).join("");
  const onlFree=mkOnline();
  const meT=teamById(m.bidder);
  const bidderSel=onlFree
    ? `<div class="offer-field">Ficha como <span class="mk-chip on static">${chiquiDotHtml(meT)}${mkEsc(meT.name)} <span class="bud">${fmtM(meT.budget)}</span></span></div>`
    : `<div class="offer-field"><label>Equipo que ficha</label><select id="freeBidder">${bidderOpts}</select></div>`;
  const bindBidder=()=>{ const sel=document.getElementById("freeBidder"); if(sel) sel.addEventListener("change",(e)=>{ m.bidder=Number(e.target.value); renderFreeMarket(); }); };

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
    <div class="offer-field"><label>Jugador tuyo a liberar (vuelve a Jugadores Libres, sin reembolso)</label><select id="freeGive">${giveOpts}</select></div>
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
    freeLog(`${buyer.name} ficha a ${tp.name} (${tp.pos} · ${tp.ovr}) por ${fmtM(price)} y libera a ${gp.name}`,"ok",[buyer.id]);
    m.freeTarget=null;
    renderFreeMarket();
  });
}

/* ---------- Pantalla dedicada: fichar un jugador libre ---------- */
function openFreeView(pid){
  const m=state.market; if(!m) return;
  m.freeTarget=pid; m.view="free"; m.freeGive=null;
  renderFreeMarket();
  try{ window.scrollTo({top:0,left:0,behavior:"instant"}); }catch(e){ window.scrollTo(0,0); }
}
function closeFreeView(){
  const m=state.market; if(!m) return;
  m.freeTarget=null; m.view="main"; m.freeGive=null;
  renderFreeMarket();
}
function renderFreeView(){
  const m=state.market;
  const box=document.getElementById("marketOfferView");
  if(!m || m.freeTarget===null){ if(box) box.innerHTML=""; return; }
  m.freeSig=freeFormSig();
  const humans=mkHumans(), online=mkOnline();
  const buyer=teamById(m.bidder);
  const tp=playerById(m.freeTarget), price=freePrice(tp);
  const order={POR:0, DEF:1, MED:2, DEL:3};
  // no se puede liberar al único arquero si el fichaje no es otro arquero
  const cands=buyer.roster.map(playerById)
    .filter(p=>rosterHasPor(buyer.roster.filter(id=>id!==p.id).concat(tp.id)))
    .sort((a,b)=>(order[a.pos]-order[b.pos]) || (b.ovr-a.ovr));
  if(m.freeGive!==null && !cands.some(p=>p.id===m.freeGive)) m.freeGive=null;

  let asHtml;
  if(!online && humans.length>1){
    asHtml=`<label for="freeBidder" style="margin:0;">Ficha como</label><select id="freeBidder">${humans.map(t=>`<option value="${t.id}" ${t.id===m.bidder?"selected":""}>${mkEsc(t.name)} (${fmtM(t.budget)})</option>`).join("")}</select>`;
  } else {
    asHtml=`Ficha como <span class="mk-chip on static">${chiquiDotHtml(buyer)}${mkEsc(buyer.name)} <span class="bud">${fmtM(buyer.budget)}</span></span>`;
  }
  const giveHtml=cands.map(p=>`<button type="button" class="of-give${m.freeGive===p.id?" on":""}" data-pid="${p.id}"><span class="tick">✓</span><span class="pos-badge pos-${p.pos}">${p.pos}</span><span class="nm">${p.name}</span><span class="ov tier-${squadAvgTier(p.ovr)}">${p.ovr}</span></button>`).join("");

  box.innerHTML=`<div class="of-top">
      <button class="btn sm" id="ofBackBtn" type="button">← Volver a Jugadores Libres</button>
      <div class="of-as">${asHtml}</div>
    </div>
    <div class="of-title">Nuevo fichaje<small>Jugador libre: pagás su precio y liberás a uno de los tuyos (vuelve a Jugadores Libres, sin reembolso).</small></div>
    <div class="of-grid" style="margin-top:16px;">
      <div class="card of-target">
        <div class="of-kicker">Jugador libre</div>
        <span class="pos-badge pos-${tp.pos}">${tp.pos}</span>
        <div class="of-ovr tier-${squadAvgTier(tp.ovr)}">${tp.ovr}</div>
        <div class="of-ovr-lbl">Media</div>
        <div class="of-name">${tp.name}</div>
        <div class="of-sub">${tp.country||""}${tp.country&&tp.club?" · ":""}${tp.club||""}</div>
        <div class="of-owner">Precio: <b style="color:var(--gold)">${fmtM(price)}</b></div>
      </div>
      <div class="card of-form">
        <div class="of-step">
          <div class="of-step-h"><span class="n">1</span>Precio</div>
          <div class="of-hint">Tenés ${fmtM(buyer.budget)}. El precio es fijo: ${fmtM(price)}.</div>
        </div>
        <div class="of-step">
          <div class="of-step-h"><span class="n">2</span>Jugador tuyo a liberar</div>
          <div class="of-hint">${tp.pos==="POR" ? "Podés liberar a cualquiera de tus jugadores." : "No aparece tu único arquero: te quedarías sin uno."}</div>
          ${cands.length ? `<div class="of-give-list">${giveHtml}</div>` : `<div class="of-none">No tenés jugadores que se puedan liberar.</div>`}
        </div>
        <div class="of-summary">
          <div><span class="lbl">Pagás y liberás</span><div class="val" id="ofSumGive"></div></div>
          <div class="arrow">⇄</div>
          <div><span class="lbl">Fichás</span><div class="val"><b>${tp.name}</b> (${tp.pos} · ${tp.ovr})</div></div>
        </div>
        <div class="offer-err" id="freeErr" style="margin-top:10px;"></div>
        <div class="of-actions">
          <button class="btn primary" id="freeBuyBtn" type="button">Comprar por ${fmtM(price)}</button>
          <button class="btn" id="freeCancelBtn" type="button">Cancelar</button>
        </div>
      </div>
    </div>`;

  const sum=document.getElementById("ofSumGive");
  const upd=()=>{
    const g=m.freeGive!==null ? playerById(m.freeGive) : null;
    sum.innerHTML=`<b class="gold">${fmtM(price)}</b> + `+(g ? `<b>${g.name}</b> (${g.pos} · ${g.ovr})` : `<i>elegí un jugador</i>`);
  };
  upd();
  box.querySelectorAll(".of-give").forEach(b=>b.addEventListener("click",()=>{
    m.freeGive=Number(b.dataset.pid);
    box.querySelectorAll(".of-give").forEach(x=>x.classList.toggle("on",x===b));
    upd();
  }));
  const bidSel=document.getElementById("freeBidder");
  if(bidSel) bidSel.addEventListener("change",(e)=>{ m.bidder=Number(e.target.value); m.freeGive=null; renderFreeMarket(); });
  document.getElementById("ofBackBtn").addEventListener("click",closeFreeView);
  document.getElementById("freeCancelBtn").addEventListener("click",closeFreeView);
  document.getElementById("freeBuyBtn").addEventListener("click",()=>{
    if(m.freeGive===null){ document.getElementById("freeErr").textContent="Elegí el jugador que vas a liberar."; return; }
    const giveId=m.freeGive;
    const err=validateFreeSigning(buyer, tp, giveId, price);
    if(err){ document.getElementById("freeErr").textContent=err; return; }
    const gp=playerById(giveId);
    buyer.roster=buyer.roster.filter(id=>id!==giveId).concat(tp.id);
    buyer.budget-=price;
    freeLog(`${buyer.name} ficha a ${tp.name} (${tp.pos} · ${tp.ovr}) por ${fmtM(price)} y libera a ${gp.name}`,"ok",[buyer.id]);
    mkToast("ok", humans.length>1 ? buyer : null, `Fichaste a ${tp.name} por ${fmtM(price)} y liberaste a ${gp.name}.`);
    closeFreeView();
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
  const tpPos=playerById(o.targetId), gpPos=playerById(o.giveId);
  if(tpPos && gpPos && (tpPos.pos==="POR")!==(gpPos.pos==="POR")) return "Los arqueros solo se intercambian por arqueros.";
  if(!Number.isInteger(o.amount) || o.amount<0) return "El monto tiene que ser un número entero (0 o más).";
  if(o.amount>buyer.budget) return `${buyer.name} solo tiene ${fmtM(buyer.budget)}.`;
  const buyerAfter=buyer.roster.filter(id=>id!==o.giveId).concat(o.targetId);
  const ownerAfter=owner.roster.filter(id=>id!==o.targetId).concat(o.giveId);
  if(!rosterHasPor(buyerAfter)) return `${buyer.name} se quedaría sin arquero.`;
  if(!rosterHasPor(ownerAfter)) return `${owner.name} se quedaría sin arquero.`;
  return null;
}

/* Online: cada jugador solo ve los movimientos en los que participa su equipo (ids = equipos involucrados) */
function mkVisibleLog(list){
  if(!mkOnline()) return list;
  const me=state.market.bidder;
  return list.filter(e=>e.ids && e.ids.includes(me));
}
function marketLog(msg, cls, ids){
  state.market.log.push({msg, cls:cls||"", ids:ids||null});
  if(state.market.log.length>40) state.market.log.shift();
}

/* ---------- Ofertas múltiples: lista de ofertas en curso (state.market.offers) ---------- */
const MAX_HUMAN_OFFERS=8;      // ofertas simultáneas máximas por equipo humano
const SLOPE=180/69;            // millones por punto de media (mismo valor base que usan los bots)

/* =========================================================
   MERCADO — INTERFAZ (barra de equipo, pestañas, notificaciones y pantalla de oferta)
========================================================= */
function mkHumans(){ return state.teams.filter(t=>t.isHuman); }
/* ---------- Online: tiempo límite y votación para saltar el mercado ---------- */
function mkTimeMs(){ return (state.marketSecs===undefined ? 180 : state.marketSecs)*1000; }   // online: 3 / 5 / 10 min o 0 = sin límite
function mkVoteStats(){
  const m=state.market;
  const ids=((window.ONL && ONL.players)||[]).filter(p=>p.connected!==false).map(p=>p.id);
  const n=Math.max(1,ids.length), need=Math.floor(n/2)+1;          // mayoría de los jugadores conectados
  const yes=ids.filter(id=>m.votes && m.votes[id]).length;
  return {n,need,yes};
}
function mkEndMarket(){
  if(!state.market) return;
  // Si se está armando la vista de un invitado, document apunta a SU copia: el pase al torneo se hace después, sobre la pantalla real
  if(window.MK_ONL && MK_ONL.ctx!==null){ MK_ONL.endNow=true; return; }
  state.market=null;
  if(window.MK_ONL) MK_ONL.reset();
  proceedAfterMarket();                                              // arranca el torneo (liga / eliminatorias)
}
function mkVoteToggle(tid){
  const m=state.market; if(!m || !mkOnline()) return;
  m.votes=m.votes||{};
  if(m.votes[tid]) delete m.votes[tid]; else m.votes[tid]=true;
  const s=mkVoteStats();
  if(s.yes>=s.need){ mkEndMarket(); return; }
  refreshMarketAll();
}
/* Lo llama el anfitrión en cada ciclo: se acabó el tiempo o la mayoría ya votó */
function mkOnlineTick(){
  const m=state.market; if(!m || !mkOnline()) return false;
  const s=mkVoteStats();
  if((m.deadline && Date.now()>=m.deadline) || s.yes>=s.need){ mkEndMarket(); return true; }
  return false;
}
function mkOnline(){ return !!(window.ONL && ONL.active); } // online: el equipo que opera es el de quien toca (lo fija el anfitrión)
function mkFmtClock(ms){ const s=Math.ceil(ms/1000); return "⏱ "+Math.floor(s/60)+":"+String(s%60).padStart(2,"0"); }
function mkEsc(s){ return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }

/* ---------- Notificaciones: contadores ---------- */
function mkPending(teamId){ const m=state.market; return m.offers.filter(o=>o.ownerId===teamId).length; }            // ofertas por responder
function mkUnread(teamId){ const m=state.market; return m.notes.filter(n=>n.teamId===teamId && !n.read && n.kind!=="in").length; } // novedades sin ver
function mkBadgeCount(teamId){ return mkPending(teamId)+mkUnread(teamId); }
function mkTotalBadge(){
  if(mkOnline()) return mkBadgeCount(state.market.bidder);   // online: solo lo de tu equipo
  return mkHumans().reduce((s,t)=>s+mkBadgeCount(t.id),0);
}

/* Aviso emergente (desaparece solo).
   Online: el aviso le llega solo al jugador al que corresponde (teamId, o el que está operando en ese momento);
   si es un invitado, el anfitrión se lo manda a él y no sale en ninguna otra pantalla. */
function mkToast(kind, who, msg, teamId){
  if(mkOnline() && window.ONL && ONL.role==="host" && window.MK_ONL){
    const tid=(teamId!==undefined && teamId!==null) ? teamId : (MK_ONL.ctx!==null ? MK_ONL.ctx : ONL.myId);
    if(tid!==ONL.myId){ MK_ONL.queueToast(tid, {kind, who:who?{name:who.name,color:who.color}:null, msg}); return; }
  }
  mkToastShow(kind, who, msg);
}
function mkToastShow(kind, who, msg){
  const box=document.getElementById("mkToasts"); if(!box) return;
  const ico={in:"", ok:"", no:"", warn:"", sent:""}[kind]||"";
  const el=document.createElement("div"); el.className="mk-toast "+kind; el.setAttribute("data-keep","");
  const i=document.createElement("span"); i.className="t-ico"; i.textContent=ico;
  const b=document.createElement("div");
  if(who){ const w=document.createElement("div"); w.className="t-who"; w.style.color=who.color; w.textContent=who.name; b.appendChild(w); }
  const t=document.createElement("div"); t.textContent=msg; b.appendChild(t);
  el.appendChild(i); el.appendChild(b);
  box.appendChild(el);
  while(box.children.length>4) box.removeChild(box.firstChild);
  setTimeout(()=>{ el.classList.add("out"); setTimeout(()=>{ if(el.parentNode) el.parentNode.removeChild(el); },320); }, 5200);
}
/* Novedad para un jugador humano: queda en la pestaña Ofertas (con aviso rojo) y sale un aviso emergente */
function marketNotify(teamId, kind, msg){
  const m=state.market; if(!m) return;
  const t=teamById(teamId); if(!t || !t.isHuman) return;
  m.notes.push({id:++m.noteSeq, teamId:t.id, kind, msg, read:false});
  if(m.notes.length>60) m.notes.shift();
  mkToast(kind, (!mkOnline() && mkHumans().length>1) ? t : null, msg, t.id);
  if(kind==="in" && (!mkOnline() || t.id===ONL.myId)){ try{ if(window.chiquiSfx) chiquiSfx.play("open",300); }catch(e){} }
  renderMarketBar();
}

/* ---------- Barra: quién ofertá + puntos rojos + aviso ---------- */
function renderMarketBar(){
  const m=state.market; if(!m) return;
  const humans=mkHumans(), online=mkOnline();
  const who=document.getElementById("mkWho");
  who.innerHTML="";
  const addStatic=(t)=>{
    const c=document.createElement("span"); c.className="mk-chip on static";
    c.innerHTML=`${chiquiDotHtml(t)}${mkEsc(t.name)} <span class="bud">${fmtM(t.budget)}</span>`;
    who.appendChild(c);
  };
  if(online || humans.length<2){
    const t=teamById(m.bidder) || humans[0];
    if(t){
      const l=document.createElement("span"); l.className="mk-who-lbl"; l.textContent=online?"Operando como":"Tu equipo"; who.appendChild(l);
      addStatic(t);
    }
  } else {
    // multijugador local: pestaña plegable para elegir el equipo con el que se oferta
    const cur=teamById(m.bidder) || humans[0];
    const open=!!m.whoOpen;
    const wrap=document.createElement("div"); wrap.className="mk-who-wrap";
    const tg=document.createElement("button"); tg.type="button"; tg.className="mk-whotoggle"+(open?" open":"");
    tg.innerHTML=`<span class="mk-who-lbl">Ofertar como</span>${chiquiDotHtml(cur)}<b>${mkEsc(cur.name)}</b> <span class="bud">${fmtM(cur.budget)}</span><span class="car">${open?"▴":"▾"}</span>`;
    const others=humans.filter(t=>t.id!==cur.id).reduce((n,t)=>n+mkBadgeCount(t.id),0);
    if(others && !open){ const bd=document.createElement("span"); bd.className="mk-badge"; bd.textContent=others>99?"99+":String(others); tg.appendChild(bd); }
    tg.addEventListener("click",()=>{ m.whoOpen=!m.whoOpen; renderMarketBar(); });
    wrap.appendChild(tg);
    if(open){
      const panel=document.createElement("div"); panel.className="mk-whopanel";
      humans.forEach(t=>{
        const c=document.createElement("button"); c.type="button";
        c.className="mk-chip"+(t.id===m.bidder?" on":"");
        c.innerHTML=`${chiquiDotHtml(t)}${mkEsc(t.name)} <span class="bud">${fmtM(t.budget)}</span>`;
        const n=mkBadgeCount(t.id);
        if(n){ const bd=document.createElement("span"); bd.className="mk-badge"; bd.textContent=n>99?"99+":String(n); c.appendChild(bd); }
        c.addEventListener("click",()=>{ m.bidder=t.id; m.whoOpen=false; renderMarket(); });
        panel.appendChild(c);
      });
      wrap.appendChild(panel);
    }
    who.appendChild(wrap);
  }

  if(online){
    const clk=document.getElementById("mkClock"), eb=document.getElementById("endMarketBtn"), ds=document.getElementById("marketDesc");
    const timed=!!m.deadline, left=Math.max(0,(m.deadline||0)-Date.now()), vs=mkVoteStats(), mine=!!(m.votes && m.votes[m.bidder]);
    if(clk){
      clk.style.display=timed?"":"none";
      if(timed){ clk.setAttribute("data-left",String(left)); clk.textContent=mkFmtClock(left); clk.classList.toggle("warn",left<=30000); }
      else clk.removeAttribute("data-left");
    }
    if(eb){ eb.textContent=(mine?"Quitar mi voto":"Votar para saltar el mercado de pases")+" ("+vs.yes+"/"+vs.need+")"; eb.classList.toggle("voted",mine); eb.disabled=false; }
    if(ds){
      const mins=Math.round((state.marketSecs||0)/60);
      ds.textContent="Ofertá con la plata que te quedó por jugadores de otros equipos. Cada operación es dinero + un jugador tuyo a cambio y el dueño decide si acepta (los equipos CPU deciden solos). Solo ves lo de tu equipo. "+
        (timed ? "El mercado de pases dura "+mins+" minutos: se termina antes si la mayoría vota saltarlo, y cuando se acaba el tiempo arranca el torneo."
               : "El mercado de pases no tiene tiempo: se termina cuando la mayoría vota saltarlo.");
    }
  }
  const total=mkTotalBadge();
  const tb=document.getElementById("mkOffersBadge");
  tb.style.display=total?"":"none"; tb.textContent=total>99?"99+":String(total);

  const al=document.getElementById("mkAlert");
  const show=total>0 && m.tab!=="offers" && m.view==="main";
  if(!show){ al.style.display="none"; al.innerHTML=""; return; }
  al.style.display="";
  al.innerHTML="";
  const txt=document.createElement("div"); txt.className="mk-alert-txt";
  const alertTeams=online ? [teamById(m.bidder)].filter(Boolean) : humans;   // online: solo tu equipo
  const multi=!online && humans.length>1;
  alertTeams.forEach(t=>{
    const pend=mkPending(t.id), un=mkUnread(t.id);
    if(!pend && !un) return;
    const parts=[];
    if(pend) parts.push(`${pend} oferta${pend>1?"s":""} por responder`);
    if(un) parts.push(`${un} novedad${un>1?"es":""} sin ver`);
    const line=document.createElement("div");
    line.innerHTML=`<b style="color:${t.color}">${multi?mkEsc(t.name):"Tenés"}</b>${multi?":":""} ${parts.join(" y ")}`;
    txt.appendChild(line);
  });
  const go=document.createElement("button"); go.type="button"; go.className="btn primary sm"; go.textContent="Ver ofertas";
  go.addEventListener("click",()=>setMarketTab("offers"));
  al.appendChild(txt); al.appendChild(go);
}

/* ---------- Qué parte del mercado se ve (lista / ofertas / mercado libre / pantalla de oferta) ---------- */
function applyMarketLayout(){
  const m=state.market; if(!m) return;
  const offer=(m.view==="offer" && m.target!==null) || (m.view==="free" && m.freeTarget!==null);
  const set=(id,on)=>{ const e=document.getElementById(id); if(e) e.style.display=on?"":"none"; };
  set("mkBar",!offer);
  set("marketDesc",!offer);
  set("marketTeamsLayout",!offer && m.tab==="teams");
  set("marketOffersLayout",!offer && m.tab==="offers");
  set("marketFreeLayout",!offer && m.tab==="free");
  set("marketOfferView",offer);
  document.querySelectorAll("#marketTabs .mk-tab").forEach(b=>b.classList.toggle("on",b.dataset.tab===m.tab));
  renderMarketBar();
}
/* Si el jugador objetivo ya no está disponible (o pasó a ser del que oferta), se vuelve a la lista */
function marketSanitizeTarget(){
  const m=state.market; if(!m) return;
  if(m.target===null){ if(m.view==="offer") m.view="main"; return; }
  const ow=ownerOf(m.target);
  if(!ow || ow.id===m.bidder){
    const gone=!ow && m.view==="offer";
    m.target=null; m.view="main";
    if(gone) mkToast("warn",null,"Ese jugador ya no está en ningún equipo.");
  }
}
function openOfferView(pid){
  const m=state.market; if(!m) return;
  m.target=pid; m.view="offer"; m.giveSel=null; m.offAmount=0;
  renderMarket();
  try{ window.scrollTo({top:0,left:0,behavior:"instant"}); }catch(e){ window.scrollTo(0,0); }
}
function closeOfferView(){
  const m=state.market; if(!m) return;
  m.target=null; m.view="main"; m.giveSel=null; m.offAmount=0;
  renderMarket();
}

/* ---------- Pestaña "Jugadores": lista de jugadores de otros equipos ---------- */
function renderMarketSide(){
  const m=state.market; if(!m) return;
  marketSanitizeTarget();

  const tBox=document.getElementById("marketTeams");
  tBox.innerHTML="";
  state.teams.forEach(t=>{
    const row=document.createElement("div");
    row.className="auction-team"+(t.id===m.bidder && t.isHuman ? " leading" : "");
    row.innerHTML=`${chiquiDotHtml(t)}<span class="nm">${t.name}${!t.isHuman ? ' <span class="cpu-badge">BOT</span>' : ''}</span><span class="cnt">${t.roster.length} jug.</span><span class="bud">${fmtM(t.budget)}</span>`;
    tBox.appendChild(row);
  });

  const list=document.getElementById("marketList");
  const sc=list.scrollTop;
  list.innerHTML="";
  let players=[];
  state.teams.forEach(t=>{
    if(m.filter!=="all" && String(t.id)!==String(m.filter)) return;
    t.roster.forEach(pid=>{
      const p=playerById(pid);
      if(m.posFilter!=="all" && p.pos!==m.posFilter) return;
      players.push({p, owner:t});
    });
  });
  players.sort((a,b)=>b.p.ovr-a.p.ovr);
  if(!players.length) list.innerHTML='<div class="mk-empty">No hay jugadores con esos filtros.</div>';
  players.forEach(({p,owner})=>{
    const row=document.createElement("div");
    row.className="mk-row";
    const already=m.offers.some(x=>x.buyerId===m.bidder && x.targetId===p.id);
    const mine=owner.id===m.bidder;
    row.innerHTML=`<span class="pos-badge pos-${p.pos}">${p.pos}</span>
      <span class="mk-name">${p.name}<div class="mk-meta"><span class="own" style="color:${owner.color}">${chiquiDotHtml(owner)}${owner.name}</span></div></span>
      <span class="mk-ovr tier-${squadAvgTier(p.ovr)}">${p.ovr}</span>`;
    const btn=document.createElement("button");
    btn.className="btn sm";
    if(mine){ btn.textContent="Tuyo"; btn.disabled=true; }
    else if(already){ btn.textContent="Ofertado ✓"; btn.disabled=true; }
    else btn.textContent="Ofertar";
    btn.addEventListener("click",()=>{
      if(owner.id===m.bidder || m.offers.some(x=>x.buyerId===m.bidder && x.targetId===p.id)) return;
      openOfferView(p.id);
    });
    row.appendChild(btn);
    list.appendChild(row);
  });
  list.scrollTop=sc;
}

function renderMarket(){
  const m=state.market; if(!m) return;
  marketSanitizeTarget();
  applyMarketLayout();
  if(m.view==="offer") renderOfferView();
  else if(m.tab==="offers") renderOffersTab();
  else renderMarketSide();
}
/* Refresco liviano (lo disparan los bots): no pisa el formulario de oferta que estás completando */
function marketFormSig(){
  const m=state.market; const b=teamById(m.bidder); const ow=m.target!==null?ownerOf(m.target):null;
  return m.target+"|"+(ow?ow.id:"-")+"|"+b.budget+"|"+b.roster.join(",")+"|"+m.offers.filter(x=>x.buyerId===b.id).map(x=>x.giveId).join(",");
}
function refreshMarket(){
  const m=state.market; if(!m) return;
  marketSanitizeTarget();
  if(m.tab==="free"){ renderMarketBar(); return; }   // el mercado libre se refresca con refreshFree
  applyMarketLayout();
  if(m.view==="offer"){ if(marketFormSig()!==m.formSig) renderOfferView(); return; }
  if(m.tab==="offers") renderOffersTab(); else renderMarketSide();
}
function freeFormSig(){
  const m=state.market; const b=teamById(m.bidder);
  return m.freeTarget+"|"+b.budget+"|"+b.roster.join(",");
}
function refreshFree(){
  const m=state.market; if(!m || m.tab!=="free") return;
  if(m.view==="free"){
    if(!freeAgents().some(p=>p.id===m.freeTarget)){
      m.freeTarget=null; m.view="main";
      mkToast("warn",null,"Ese jugador libre ya fue fichado.");
      applyMarketLayout(); renderFreeSide(); renderFreeOfferCard(); return;
    }
    if(freeFormSig()!==m.freeSig) renderFreeView();
    return;
  }
  const before=m.freeTarget;
  renderFreeSide();
  if(m.freeTarget!==before || freeFormSig()!==m.freeSig) renderFreeOfferCard();
}
function refreshMarketAll(){ refreshMarket(); refreshFree(); if(mkOnline()) renderMarketBar(); }

/* ---------- Pestaña "Ofertas": recibidas, enviadas y novedades ---------- */
function mkPlayerChip(p){
  return `<div class="oi-pl"><span class="pos-badge pos-${p.pos}">${p.pos}</span><span class="nm">${p.name}</span><span class="ov">${p.ovr}</span></div>`;
}
function renderOffersTab(){
  const m=state.market; if(!m) return;
  const online=mkOnline(), me=m.bidder;
  const mineNote=n=>!online || n.teamId===me;      // online: solo las novedades de tu equipo
  const fresh=new Set(m.notes.filter(n=>!n.read && mineNote(n)).map(n=>n.id));
  renderOffersPanel();
  renderNotesCard(fresh);
  m.notes.forEach(n=>{ if(mineNote(n)) n.read=true; });   // al ver la pestaña, tus novedades pasan a leídas
  const lg=document.getElementById("marketLog");
  const ml=mkVisibleLog(m.log);
  lg.innerHTML=ml.length ? ml.slice().reverse().map(e=>`<div class="${e.cls}">${e.msg}</div>`).join("") : '<div class="no">Todavía no hubo movimientos.</div>';
  renderMarketBar();
}
/* Panel con las ofertas en curso que involucran a un humano (las que mandás vos y las que te mandan).
   Online: cada jugador ve SOLO las de su equipo (recibidas y enviadas); las de los demás no existen en su pantalla. */
function renderOffersPanel(){
  const m=state.market; if(!m) return;
  const card=document.getElementById("offersPanel");
  const me=mkOnline() ? m.bidder : null;
  const incoming = me!==null ? m.offers.filter(o=>o.ownerId===me) : m.offers.filter(o=>teamById(o.ownerId).isHuman);
  const sent = me!==null ? m.offers.filter(o=>o.buyerId===me && o.ownerId!==me)
                         : m.offers.filter(o=>!teamById(o.ownerId).isHuman && teamById(o.buyerId).isHuman);
  card.innerHTML=`<h3 class="section-title">Ofertas en curso (${incoming.length+sent.length})</h3>`;

  const section=(title,n,emptyMsg,items)=>{
    const h=document.createElement("div"); h.className="mk-sec"; h.innerHTML=`${title} <span class="cnt">${n}</span>`;
    card.appendChild(h);
    if(!items.length){ const e=document.createElement("div"); e.className="mk-empty"; e.textContent=emptyMsg; card.appendChild(e); return; }
    items.forEach(o=>card.appendChild(offerItemEl(o,me)));
  };
  section("Recibidas",incoming.length,"No tenés ofertas por responder.",incoming);
  section("Enviadas",sent.length,"No tenés ofertas esperando respuesta.",sent);
  incoming.concat(sent).forEach(o=>{ if(me!==null){ o.seenBy=o.seenBy||{}; o.seenBy[me]=true; } else o.seen=true; });
  if(me===null) m.offers.forEach(o=>{ o.seen=true; });
}
function offerItemEl(o, me){
  const buyer=teamById(o.buyerId), owner=teamById(o.ownerId);
  const tp=playerById(o.targetId), gp=playerById(o.giveId);
  const online=(me!==undefined && me!==null);
  const ownerHuman=owner.isHuman, mine=buyer.isHuman;
  const isNew = online ? !(o.seenBy && o.seenBy[me]) : !o.seen;
  const el=document.createElement("div");
  // online: "recibida" solo si el dueño sos vos; si la mandaste vos es "enviada" aunque el dueño sea otro jugador
  const recv = online ? (o.ownerId===me) : ownerHuman;
  el.className="offer-item"+(recv?" incoming":"")+(isNew?" is-new":"");
  el.innerHTML=`<div class="oi-head"><div class="oi-tag">${recv ? (o.fromBot ? "Oferta recibida" : (online ? "Oferta recibida" : "Oferta para "+mkEsc(owner.name))) : "Oferta enviada"}</div>
      <div class="oi-for" style="color:${(recv?owner:buyer).color}">${mkEsc((recv?owner:buyer).name)}</div></div>
    <div class="oi-body">
      <div class="oi-side"><span class="oi-lbl"><span style="color:${buyer.color}">${mkEsc(buyer.name)}</span> da</span><div class="oi-money">${fmtM(o.amount)}</div>${mkPlayerChip(gp)}</div>
      <div class="oi-arrow">⇄</div>
      <div class="oi-side"><span class="oi-lbl">por (de <span style="color:${owner.color}">${mkEsc(owner.name)}</span>)</span>${mkPlayerChip(tp)}</div>
    </div>`;
  if(recv){
    const row=document.createElement("div");
    row.className="btn-row"; row.style.marginTop="10px";
    const ok=document.createElement("button"); ok.className="btn primary sm"; ok.textContent="Aceptar";
    ok.addEventListener("click",()=>acceptOffer(o.id));
    const no=document.createElement("button"); no.className="btn sm"; no.textContent="Rechazar";
    no.addEventListener("click",()=>rejectOffer(o.id));
    row.appendChild(ok); row.appendChild(no);
    ok.dataset.team=owner.id; no.dataset.team=owner.id;
    if(mine && !online){
      const wd=document.createElement("button"); wd.className="btn sm"; wd.textContent="Retirar";
      wd.addEventListener("click",()=>withdrawOffer(o.id));
      row.appendChild(wd);
      wd.dataset.team=buyer.id;
    }
    const who=document.createElement("div"); who.className="oi-wait";
    who.innerHTML=`Decide <b style="color:${owner.color}">${mkEsc(owner.name)}</b>`;
    el.appendChild(who); el.appendChild(row);
  } else if(online && ownerHuman){
    // la mandaste vos a otro jugador: esperás su respuesta y la podés retirar
    const st=document.createElement("div"); st.className="oi-wait";
    st.innerHTML=`Decide <b style="color:${owner.color}">${mkEsc(owner.name)}</b>`;
    const row=document.createElement("div"); row.className="btn-row"; row.style.marginTop="10px";
    const wd=document.createElement("button"); wd.className="btn sm"; wd.textContent="Retirar";
    wd.addEventListener("click",()=>withdrawOffer(o.id));
    wd.dataset.team=buyer.id;
    row.appendChild(wd);
    el.appendChild(st); el.appendChild(row);
  } else {
    const st=document.createElement("div"); st.className="oi-wait";
    st.innerHTML=`<b style="color:${owner.color}">${mkEsc(owner.name)}</b> (CPU) está evaluando la oferta...`;
    el.appendChild(st);
  }
  return el;
}
function renderNotesCard(fresh){
  const m=state.market; if(!m) return;
  const card=document.getElementById("mkNotesCard");
  const humans=mkHumans(), online=mkOnline();
  const notes=online ? m.notes.filter(n=>n.teamId===m.bidder) : m.notes;
  card.innerHTML=`<div class="mk-notes-head"><h3 class="section-title">Novedades</h3></div>`;
  if(notes.length){
    const clr=document.createElement("button"); clr.type="button"; clr.className="btn sm"; clr.textContent="Limpiar";
    clr.addEventListener("click",()=>{ m.notes=online ? m.notes.filter(n=>n.teamId!==m.bidder) : []; renderOffersTab(); });
    card.querySelector(".mk-notes-head").appendChild(clr);
  }
  if(!notes.length){
    const e=document.createElement("div"); e.className="mk-empty";
    e.textContent="Todavía no hay novedades. Acá vas a ver cuándo te llega una oferta o te aceptan o rechazan una.";
    card.appendChild(e); return;
  }
  const ico={in:"", ok:"", no:"", warn:""};
  notes.slice().reverse().slice(0,25).forEach(n=>{
    const t=teamById(n.teamId);
    const el=document.createElement("div"); el.className="mk-note "+n.kind;
    el.innerHTML=`<span class="t-ico">${ico[n.kind]||""}</span><div class="n-body">${!online && humans.length>1 && t ? `<div class="n-who" style="color:${t.color}">${mkEsc(t.name)}</div>` : ""}${mkEsc(n.msg)}</div>${fresh && fresh.has(n.id) ? '<span class="n-new">NUEVO</span>' : ""}`;
    card.appendChild(el);
  });
}

/* ---------- Pantalla dedicada: nueva oferta ---------- */
/* Jugadores tuyos que se pueden entregar a cambio: los arqueros solo se ofrecen por un arquero y,
   si el objetivo es un arquero, solo se pueden entregar arqueros. */
function offerGiveCandidates(buyer, tp){
  const m=state.market;
  const taken=new Set(m.offers.filter(x=>x.buyerId===buyer.id).map(x=>x.giveId));
  const order={POR:0, DEF:1, MED:2, DEL:3};
  return buyer.roster.filter(pid=>!taken.has(pid)).map(playerById)
    .filter(p=> tp.pos==="POR" ? p.pos==="POR" : p.pos!=="POR")
    .sort((a,b)=>(order[a.pos]-order[b.pos]) || (b.ovr-a.ovr));
}
function renderOfferView(){
  const m=state.market;
  const box=document.getElementById("marketOfferView");
  if(!m || m.target===null){ if(box) box.innerHTML=""; return; }
  m.formSig=marketFormSig();
  const humans=mkHumans(), online=mkOnline();
  const buyer=teamById(m.bidder);
  const tp=playerById(m.target), owner=ownerOf(m.target);
  const cands=offerGiveCandidates(buyer,tp);
  if(m.giveSel!==null && !cands.some(p=>p.id===m.giveSel)) m.giveSel=null;
  m.offAmount=Math.max(0,Math.min(buyer.budget,Math.floor(Number(m.offAmount)||0)));

  // equipo que oferta: selector (multijugador local) o etiqueta fija (un jugador / online)
  const bidders=humans.filter(t=>t.id!==owner.id);
  let asHtml;
  if(!online && bidders.length>1){
    asHtml=`<label for="offBidder" style="margin:0;">Ofertando como</label><select id="offBidder">${bidders.map(t=>`<option value="${t.id}" ${t.id===m.bidder?"selected":""}>${mkEsc(t.name)} (${fmtM(t.budget)})</option>`).join("")}</select>`;
  } else {
    asHtml=`Ofertando como <span class="mk-chip on static">${chiquiDotHtml(buyer)}${mkEsc(buyer.name)} <span class="bud">${fmtM(buyer.budget)}</span></span>`;
  }

  const quick=[0,10,25,50,100,200];
  const hint = tp.pos==="POR"
    ? "El objetivo es un arquero: solo podés entregar arqueros a cambio."
    : "Los arqueros no se ofrecen a cambio de jugadores de campo.";
  const giveHtml = cands.length
    ? cands.map(p=>`<button type="button" class="of-give${m.giveSel===p.id?" on":""}" data-pid="${p.id}"><span class="tick">✓</span><span class="pos-badge pos-${p.pos}">${p.pos}</span><span class="nm">${p.name}</span><span class="ov tier-${squadAvgTier(p.ovr)}">${p.ovr}</span></button>`).join("")
    : "";

  box.innerHTML=`<div class="of-top">
      <button class="btn sm" id="ofBackBtn" type="button">← Volver al mercado de pases</button>
      <div class="of-as">${asHtml}</div>
    </div>
    <div class="of-title">Nueva oferta<small>Armá tu propuesta: dinero + un jugador tuyo a cambio. ${mkEsc(owner.name)} decide si acepta.</small></div>
    <div class="of-grid" style="margin-top:16px;">
      <div class="card of-target">
        <div class="of-kicker">Jugador objetivo</div>
        <span class="pos-badge pos-${tp.pos}">${tp.pos}</span>
        <div class="of-ovr tier-${squadAvgTier(tp.ovr)}">${tp.ovr}</div>
        <div class="of-ovr-lbl">Media</div>
        <div class="of-name">${tp.name}</div>
        <div class="of-sub">${tp.country||""}${tp.country&&tp.club?" · ":""}${tp.club||""}</div>
        <div class="of-owner">${chiquiDotHtml(owner)}${mkEsc(owner.name)}</div>
      </div>
      <div class="card of-form">
        <div class="of-step">
          <div class="of-step-h"><span class="n">1</span>Dinero a ofrecer</div>
          <div class="of-hint">Tenés ${fmtM(buyer.budget)}. Podés ofrecer 0 y pagar solo con un jugador.</div>
          <div class="of-money"><div class="of-inp"><span>$</span><input type="number" id="offAmount" min="0" max="${buyer.budget}" step="1" value="${m.offAmount}"><span>M</span></div></div>
          <div class="of-quick">${quick.map(v=>`<button type="button" class="btn sm of-q" data-v="${v}"${v>buyer.budget?" disabled":""}>${v===0?"Sin dinero":fmtM(v)}</button>`).join("")}<button type="button" class="btn sm of-q" data-v="${buyer.budget}">Todo (${fmtM(buyer.budget)})</button></div>
        </div>
        <div class="of-step">
          <div class="of-step-h"><span class="n">2</span>Jugador tuyo a entregar</div>
          <div class="of-hint">${hint}</div>
          ${cands.length ? `<div class="of-give-list">${giveHtml}</div>` : `<div class="of-none">No tenés ${tp.pos==="POR"?"arqueros":"jugadores de campo"} disponibles para entregar (puede que ya estén en otras ofertas pendientes).</div>`}
        </div>
        <div class="of-summary">
          <div><span class="lbl">Entregás</span><div class="val" id="ofSumGive"></div></div>
          <div class="arrow">⇄</div>
          <div><span class="lbl">Recibís</span><div class="val"><b>${tp.name}</b> (${tp.pos} · ${tp.ovr})</div></div>
        </div>
        <div class="offer-err" id="offerErr" style="margin-top:10px;"></div>
        <div class="of-actions">
          <button class="btn primary" id="sendOfferBtn" type="button">Enviar oferta</button>
          <button class="btn" id="cancelOfferBtn" type="button">Cancelar</button>
        </div>
      </div>
    </div>`;

  const inp=document.getElementById("offAmount");
  const sum=document.getElementById("ofSumGive");
  const upd=()=>{
    const g=m.giveSel!==null ? playerById(m.giveSel) : null;
    const amt=Math.max(0,Math.floor(Number(inp.value)||0));
    sum.innerHTML=`<b class="gold">${fmtM(amt)}</b> + `+(g ? `<b>${g.name}</b> (${g.pos} · ${g.ovr})` : `<i>elegí un jugador</i>`);
  };
  upd();
  inp.addEventListener("input",()=>{ m.offAmount=Math.max(0,Math.floor(Number(inp.value)||0)); upd(); });
  box.querySelectorAll(".of-q").forEach(b=>b.addEventListener("click",()=>{
    inp.value=b.dataset.v; m.offAmount=Number(b.dataset.v); upd();
  }));
  box.querySelectorAll(".of-give").forEach(b=>b.addEventListener("click",()=>{
    m.giveSel=Number(b.dataset.pid);
    box.querySelectorAll(".of-give").forEach(x=>x.classList.toggle("on",x===b));
    upd();
  }));
  const bidSel=document.getElementById("offBidder");
  if(bidSel) bidSel.addEventListener("change",(e)=>{ m.bidder=Number(e.target.value); m.giveSel=null; renderMarket(); });
  document.getElementById("ofBackBtn").addEventListener("click",closeOfferView);
  document.getElementById("cancelOfferBtn").addEventListener("click",closeOfferView);
  document.getElementById("sendOfferBtn").addEventListener("click",()=>{
    const err0=(m.giveSel===null) ? "Elegí el jugador que vas a entregar a cambio." : null;
    const o={buyerId:m.bidder, ownerId:owner.id, targetId:m.target,
      giveId:m.giveSel===null ? NaN : m.giveSel,
      amount:Number(document.getElementById("offAmount").value)};
    const err=err0 || validateTrade(o) || offerConflict(o);
    if(err){ document.getElementById("offerErr").textContent=err; return; }
    submitOffer(o);
    mkToast("sent", mkHumans().length>1 ? buyer : null, `Oferta enviada a ${owner.name} por ${tp.name}.`);
    closeOfferView();
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
  const ow=teamById(o.ownerId);
  if(ow.isHuman) marketNotify(ow.id,"in",`${teamById(o.buyerId).name} te ofrece ${fmtM(o.amount)} + ${playerById(o.giveId).name} por ${playerById(o.targetId).name}`);
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
  const m=state.market; if(!m || !state.botOffers || !hasBotTeams()) return;
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
  if(m.tab==="free" || open>=botLvl().maxConcurrent){ m.botTimer=setTimeout(()=>botOfferTick(m),2500); return; }
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
  marketLog(`${b.name} te ofrece ${fmtM(pick.o.amount)} + ${gp.name} por ${tp.name}`,"",[pick.o.ownerId]);
  refreshMarket();
  return true;
}

/* ---- Los bots también operan entre ellos: se ofertan jugadores y fichan libres ---- */
function botMarketSchedule(first){
  const m=state.market; if(!m || !hasBotTeams()) return;
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
  freeLog(`${b.name} ficha a ${best.p.name} (${best.p.pos} · ${best.p.ovr}) por ${fmtM(best.price)} y libera a ${g.name}`,"ok",[b.id]);
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
    if(buyer.isHuman || owner.isHuman) marketLog(`Se cayó la oferta de ${buyer.name} por ${playerById(o.targetId).name}: ${err}`,"no",[o.buyerId,o.ownerId]);
    if(buyer.isHuman) marketNotify(buyer.id,"warn",`Se cayó tu oferta por ${playerById(o.targetId).name}: ${err}`);
    if(owner.isHuman && owner.id!==buyer.id) marketNotify(owner.id,"warn",`Se cayó la oferta de ${buyer.name} por ${playerById(o.targetId).name}: ${err}`);
    return false;
  });
}
/* Online: solo el dueño decide (aceptar / rechazar) y solo el que ofertó retira. Si una acción la hace un jugador
   (invitado o anfitrión), tiene que ser sobre una oferta de su propio equipo. Los bots (sin contexto) no tienen límite. */
function mkActor(){ return (mkOnline() && window.MK_ONL && MK_ONL.ctx!==null) ? MK_ONL.ctx : null; }
function mkMay(o, who){ const a=mkActor(); if(a===null) return true; return who==="owner" ? o.ownerId===a : o.buyerId===a; }
function acceptOffer(id){
  const m=state.market; if(!m) return;
  const idx=m.offers.findIndex(x=>x.id===id); if(idx<0) return;
  const o=m.offers[idx];
  if(!mkMay(o,"owner")) return;
  const err=validateTrade(o);
  m.offers.splice(idx,1);
  if(err){
    marketLog(`Operación cancelada: ${err}`,"no",[o.buyerId,o.ownerId]);
    const bb=teamById(o.buyerId); if(bb && bb.isHuman) marketNotify(bb.id,"warn",`Operación cancelada: ${err}`);
    pruneOffers(); refreshMarketAll(); return;
  }
  const buyer=teamById(o.buyerId), owner=teamById(o.ownerId);
  const tp=playerById(o.targetId), gp=playerById(o.giveId);
  buyer.roster=buyer.roster.filter(id2=>id2!==o.giveId).concat(o.targetId);
  owner.roster=owner.roster.filter(id2=>id2!==o.targetId).concat(o.giveId);
  buyer.budget-=o.amount; owner.budget+=o.amount;
  const botDeal=!buyer.isHuman && !owner.isHuman;
  marketLog(`${botDeal?"(bot) ":""}${buyer.name} se queda con ${tp.name} (${owner.name}) por ${fmtM(o.amount)} + ${gp.name}`,"ok",[o.buyerId,o.ownerId]);
  if(buyer.isHuman) marketNotify(buyer.id,"ok",`${owner.name} aceptó tu oferta: ${tp.name} ya es tuyo (${fmtM(o.amount)} + ${gp.name}).`);
  pruneOffers();
  refreshMarketAll();
}
function rejectOffer(id, reason){
  const m=state.market; if(!m) return;
  const idx=m.offers.findIndex(x=>x.id===id); if(idx<0) return;
  if(!mkMay(m.offers[idx],"owner")) return;
  const o=m.offers[idx]; m.offers.splice(idx,1);
  const buyer=teamById(o.buyerId), owner=teamById(o.ownerId);
  const why = reason && buyer.isHuman && !owner.isHuman ? ` (${reason})` : "";
  marketLog(`${owner.name} rechazó la oferta de ${buyer.name} por ${playerById(o.targetId).name}${why}`,"no",[o.buyerId,o.ownerId]);
  if(buyer.isHuman) marketNotify(buyer.id,"no",`${owner.name} rechazó tu oferta por ${playerById(o.targetId).name}${why}.`);
  refreshMarketAll();
}
function withdrawOffer(id){
  const m=state.market; if(!m) return;
  const idx=m.offers.findIndex(x=>x.id===id); if(idx<0) return;
  if(!mkMay(m.offers[idx],"buyer")) return;
  const o=m.offers[idx]; m.offers.splice(idx,1);
  marketLog(`${teamById(o.buyerId).name} retiró su oferta por ${playerById(o.targetId).name}`,"no",[o.buyerId,o.ownerId]);
  { const ow2=teamById(o.ownerId); if(ow2 && ow2.isHuman) marketNotify(ow2.id,"warn",`${teamById(o.buyerId).name} retiró su oferta por ${playerById(o.targetId).name}.`); }
  refreshMarketAll();
}
