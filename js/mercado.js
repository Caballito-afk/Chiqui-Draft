/* =========================================================
   MERCADO
========================================================= */
function setupMarket(){
  state.market={target:null, bidder:(state.teams.find(t=>t.isHuman)||state.teams[0]).id, offers:[], offerSeq:0, log:[], filter:"all",
    tab:"teams", freeTarget:null, freePos:"all", freeLog:[],
    view:"main", posFilter:"all", notes:[], noteSeq:0, giveSel:null, offAmount:0, freeGive:null,
    ui:{}, toasts:{}, toastSeq:0}; // ui: pantalla propia de cada jugador online; toasts: avisos de cada jugador
  if(mkOnline() && window.ONL && ONL.myId!==undefined) state.market.bidder=ONL.myId;
  document.getElementById("mkFreeTab").style.display = state.useFreeMarket ? "" : "none";
  document.getElementById("mkToasts").innerHTML="";
  document.getElementById("freePosFilter").value="all";
  document.getElementById("marketPosFilter").value="all";
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
/* Controles fijos del mercado: se escuchan de forma delegada para que funcionen igual en la pantalla
   de cada jugador online (cada uno tiene su propia copia de la pantalla). */
document.addEventListener("change",(e)=>{
  const t=e.target; if(!t || !t.id || !state.market) return;
  if(t.id==="marketTeamFilter"){ state.market.filter=t.value; renderMarket(); }
  else if(t.id==="marketPosFilter"){ state.market.posFilter=t.value; renderMarket(); }
  else if(t.id==="freePosFilter"){ state.market.freePos=t.value; renderFreeMarket(); }
});
document.addEventListener("click",(e)=>{
  const b=e.target && e.target.closest ? e.target.closest("#marketTabs .mk-tab") : null;
  if(b && state.market) setMarketTab(b.dataset.tab);
});
/* Terminar el mercado. Online: cada jugador conectado vota y el mercado termina cuando votaron todos (no depende del anfitrión) */
function mkEndMarket(){
  if(!state.market) return;
  state.market=null;
  proceedAfterMarket();
}
function mkVoters(){ return (window.ONL && ONL.players ? ONL.players : []).filter(p=>p.connected!==false).map(p=>p.id); }
function mkSkipVotes(){
  const m=state.market; const v=mkVoters();
  m.skipVotes=(m.skipVotes||[]).filter(id=>v.includes(id));
  return m.skipVotes;
}
function mkToggleSkipVote(){
  const m=state.market; if(!m) return;
  const votes=mkSkipVotes(), id=m.bidder, voters=mkVoters();
  const i=votes.indexOf(id);
  if(i>=0) votes.splice(i,1); else votes.push(id);
  if(voters.length && voters.every(v=>votes.includes(v))){ mkEndMarket(); return; }
  mkSyncEndBtn();
  try{ refreshMarketAll(); }catch(e){}
}
/* Si alguien se desconecta, ya no se lo espera: si los que quedan ya votaron, el mercado termina */
function mkCheckSkipDone(){
  const m=state.market; if(!m || !mkOnline()) return;
  const votes=mkSkipVotes(), voters=mkVoters();
  if(voters.length && votes.length && voters.every(v=>votes.includes(v))) mkEndMarket(); else { mkSyncEndBtn(); }
}
function mkSyncEndBtn(){
  const m=state.market; const b=document.getElementById("endMarketBtn"); if(!m || !b) return;
  if(!mkOnline()){ b.textContent="Saltar / terminar mercado →"; b.classList.add("primary"); return; }
  const votes=mkSkipVotes(), n=mkVoters().length, me=votes.includes(m.bidder);
  b.textContent = me ? `✓ Votaste saltar el mercado (${votes.length}/${n}) · tocá para retirar` : `✋ Votar para saltar el mercado (${votes.length}/${n})`;
  b.classList.toggle("primary",!me);
}
document.addEventListener("click",(e)=>{
  const b=e.target && e.target.closest ? e.target.closest("#endMarketBtn") : null;
  if(!b || !state.market) return;
  if(mkOnline()) mkToggleSkipVote(); else mkEndMarket();
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
function freeLog(msg, cls){
  state.market.freeLog.push({msg, cls:cls||""});
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
    btn.addEventListener("click",()=>{ openFreeView(p.id); });
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
  const giveOpts=buyer.roster.filter(pid=>gkSwapOk(tp,playerById(pid))).map(pid=>{ const p=playerById(pid); return `<option value="${pid}">${p.name} (${p.pos} · ${p.ovr})</option>`; }).join("");
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
    .filter(p=>gkSwapOk(tp,p) && rosterHasPor(buyer.roster.filter(id=>id!==p.id).concat(tp.id)))
    .sort((a,b)=>(order[a.pos]-order[b.pos]) || (b.ovr-a.ovr));
  if(m.freeGive!==null && !cands.some(p=>p.id===m.freeGive)) m.freeGive=null;

  let asHtml;
  if(!online && humans.length>1){
    asHtml=`<label for="freeBidder" style="margin:0;">Ficha como</label><select id="freeBidder">${humans.map(t=>`<option value="${t.id}" ${t.id===m.bidder?"selected":""}>${mkEsc(t.name)} (${fmtM(t.budget)})</option>`).join("")}</select>`;
  } else {
    asHtml=`Ficha como <span class="mk-chip on static"><span class="dot" style="background:${buyer.color}"></span>${mkEsc(buyer.name)} <span class="bud">${fmtM(buyer.budget)}</span></span>`;
  }
  const giveHtml=cands.map(p=>`<button type="button" class="of-give${m.freeGive===p.id?" on":""}" data-pid="${p.id}"><span class="tick">✓</span><span class="pos-badge pos-${p.pos}">${p.pos}</span><span class="nm">${p.name}</span><span class="ov tier-${squadAvgTier(p.ovr)}">${p.ovr}</span></button>`).join("");

  box.innerHTML=`<div class="of-top">
      <button class="btn sm" id="ofBackBtn" type="button">← Volver al mercado libre</button>
      <div class="of-as">${asHtml}</div>
    </div>
    <div class="of-title">Nuevo fichaje<small>Jugador libre: pagás su precio y liberás a uno de los tuyos (vuelve al mercado libre, sin reembolso).</small></div>
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
          <div class="of-hint">${tp.pos==="POR" ? "Es un arquero: solo podés liberar a uno de tus arqueros (máximo "+MAX_GK+" por equipo)." : "Los arqueros no se liberan por jugadores de campo: solo aparecen tus jugadores de campo."}</div>
          ${cands.length ? `<div class="of-give-list">${giveHtml}</div>` : `<div class="of-none">No tenés ${tp.pos==="POR"?"arqueros":"jugadores de campo"} que se puedan liberar.</div>`}
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
    freeLog(`✅ ${buyer.name} ficha a ${tp.name} (${tp.pos} · ${tp.ovr}) por ${fmtM(price)} y libera a ${gp.name}`,"ok");
    mkToast("ok", humans.length>1 ? buyer : null, `Fichaste a ${tp.name} por ${fmtM(price)} y liberaste a ${gp.name}.`);
    closeFreeView();
  });
}

function validateFreeSigning(buyer, target, giveId, price){
  if(!freeAgents().some(p=>p.id===target.id)) return "Ese jugador ya no está libre.";
  if(!buyer.roster.includes(giveId)) return "Elegí un jugador tuyo para liberar.";
  if(price>buyer.budget) return `${buyer.name} solo tiene ${fmtM(buyer.budget)}.`;
  const gp=playerById(giveId);
  if(!gkSwapOk(target,gp)) return gkSwapMsg();
  const after=buyer.roster.filter(id=>id!==giveId).concat(target.id);
  if(!rosterHasPor(after)) return `${buyer.name} se quedaría sin arquero.`;
  if(rosterGkCount(after)>MAX_GK) return `${buyer.name} no puede tener más de ${MAX_GK} arqueros.`;
  return null;
}

function ownerOf(playerId){ return state.teams.find(t=>t.roster.includes(playerId)); }
let _PBI=null;
function playerById(id){ if(!_PBI) _PBI=new Map(PLAYERS.map(p=>[p.id,p])); return _PBI.get(id); }
function rosterHasPor(ids){ return ids.some(id=>playerById(id).pos==="POR"); }
/* Regla de arqueros: máximo 2 por equipo y los arqueros solo se cambian por arqueros (nunca por jugadores de campo) */
const MAX_GK=2;
function rosterGkCount(ids){ return ids.filter(id=>playerById(id).pos==="POR").length; }
function gkSwapOk(a,b){ return !a || !b || (a.pos==="POR")===(b.pos==="POR"); } // true si ambos son arqueros o ninguno lo es
function gkSwapMsg(){ return "Los arqueros solo se intercambian por arqueros."; }

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
  if(rosterGkCount(buyerAfter)>MAX_GK && rosterGkCount(buyerAfter)>rosterGkCount(buyer.roster)) return `${buyer.name} no puede tener más de ${MAX_GK} arqueros.`;
  if(rosterGkCount(ownerAfter)>MAX_GK && rosterGkCount(ownerAfter)>rosterGkCount(owner.roster)) return `${owner.name} no puede tener más de ${MAX_GK} arqueros.`;
  return null;
}

function marketLog(msg, cls){
  state.market.log.push({msg, cls:cls||""});
  if(state.market.log.length>40) state.market.log.shift();
}

/* ---------- Ofertas múltiples: lista de ofertas en curso (state.market.offers) ---------- */
const MAX_HUMAN_OFFERS=8;      // ofertas simultáneas máximas por equipo humano
const SLOPE=180/69;            // millones por punto de media (mismo valor base que usan los bots)

/* =========================================================
   MERCADO — INTERFAZ (barra de equipo, pestañas, notificaciones y pantalla de oferta)
========================================================= */
function mkHumans(){ return state.teams.filter(t=>t.isHuman); }
function mkOnline(){ return !!(window.ONL && ONL.active); } // online: el equipo que opera es el de quien toca (lo fija el anfitrión)
function mkEsc(s){ return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }

/* ---------- Notificaciones: contadores ---------- */
function mkPending(teamId){ const m=state.market; return m.offers.filter(o=>o.ownerId===teamId).length; }            // ofertas por responder
function mkUnread(teamId){ const m=state.market; return m.notes.filter(n=>n.teamId===teamId && !n.read && n.kind!=="in").length; } // novedades sin ver
function mkBadgeCount(teamId){ return mkPending(teamId)+mkUnread(teamId); }
function mkTotalBadge(){
  const m=state.market;
  if(mkOnline() && m){ const b=teamById(m.bidder); return b ? mkBadgeCount(b.id) : 0; } // online: cada uno ve solo lo suyo
  return mkHumans().reduce((s,t)=>s+mkBadgeCount(t.id),0);
}

/* Aviso emergente (desaparece solo) */
function mkToastEl(kind, who, msg){
  const ico={in:"📨", ok:"✅", no:"❌", warn:"⚠️", sent:"📤"}[kind]||"🔔";
  const el=document.createElement("div"); el.className="mk-toast "+kind;
  const i=document.createElement("span"); i.className="t-ico"; i.textContent=ico;
  const b=document.createElement("div");
  if(who){ const w=document.createElement("div"); w.className="t-who"; w.style.color=who.color; w.textContent=who.name; b.appendChild(w); }
  const t=document.createElement("div"); t.textContent=msg; b.appendChild(t);
  el.appendChild(i); el.appendChild(b);
  return el;
}
/* Online: los avisos se guardan por jugador y cada uno ve solo los suyos */
const MK_TOAST_MS=5200;
function mkLiveToasts(teamId){ const m=state.market; const now=Date.now(); return ((m && m.toasts && m.toasts[teamId])||[]).filter(x=>x.exp>now); }
function mkRenderToasts(){
  const m=state.market; const box=document.getElementById("mkToasts"); if(!m || !box || !mkOnline()) return;
  box.innerHTML="";
  mkLiveToasts(m.bidder).slice(-4).forEach(x=>box.appendChild(mkToastEl(x.kind,null,x.msg)));
}
function mkToast(kind, who, msg, teamId){
  if(mkOnline() && state.market){
    const m=state.market;
    const tid = teamId!==undefined ? teamId : (who ? who.id : m.bidder);
    m.toasts=m.toasts||{};
    const arr=mkLiveToasts(tid); arr.push({id:++m.toastSeq, kind, msg, exp:Date.now()+MK_TOAST_MS});
    m.toasts[tid]=arr;
    if(tid===m.bidder) mkRenderToasts();
    setTimeout(()=>{ if(!MK_SCRATCH && state.market) mkRenderToasts(); }, MK_TOAST_MS+120);
    return;
  }
  const box=document.getElementById("mkToasts"); if(!box) return;
  const el=mkToastEl(kind,who,msg);
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
  mkToast(kind, mkHumans().length>1 ? t : null, msg, t.id);
  const mine = !mkOnline() || t.id===ONL.myId; // online: el sonido suena solo en el dispositivo de quien recibe
  if(kind==="in" && mine){ try{ if(window.chiquiSfx) chiquiSfx.play("open",300); }catch(e){} }
  renderMarketBar();
}

/* ---------- Barra: quién ofertá + puntos rojos + aviso ---------- */
function renderMarketBar(){
  const m=state.market; if(!m) return;
  mkSyncEndBtn();
  const humans=mkHumans(), online=mkOnline();
  const who=document.getElementById("mkWho");
  who.innerHTML="";
  const addStatic=(t)=>{
    const c=document.createElement("span"); c.className="mk-chip on static";
    c.innerHTML=`<span class="dot" style="background:${t.color}"></span>${mkEsc(t.name)} <span class="bud">${fmtM(t.budget)}</span>`;
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
    tg.innerHTML=`<span class="mk-who-lbl">Ofertar como</span><span class="dot" style="background:${cur.color}"></span><b>${mkEsc(cur.name)}</b> <span class="bud">${fmtM(cur.budget)}</span><span class="car">${open?"▴":"▾"}</span>`;
    const others=humans.filter(t=>t.id!==cur.id).reduce((n,t)=>n+mkBadgeCount(t.id),0);
    if(others && !open){ const bd=document.createElement("span"); bd.className="mk-badge"; bd.textContent=others>99?"99+":String(others); tg.appendChild(bd); }
    tg.addEventListener("click",()=>{ m.whoOpen=!m.whoOpen; renderMarketBar(); });
    wrap.appendChild(tg);
    if(open){
      const panel=document.createElement("div"); panel.className="mk-whopanel";
      humans.forEach(t=>{
        const c=document.createElement("button"); c.type="button";
        c.className="mk-chip"+(t.id===m.bidder?" on":"");
        c.innerHTML=`<span class="dot" style="background:${t.color}"></span>${mkEsc(t.name)} <span class="bud">${fmtM(t.budget)}</span>`;
        const n=mkBadgeCount(t.id);
        if(n){ const bd=document.createElement("span"); bd.className="mk-badge"; bd.textContent=n>99?"99+":String(n); c.appendChild(bd); }
        c.addEventListener("click",()=>{ m.bidder=t.id; m.whoOpen=false; renderMarket(); });
        panel.appendChild(c);
      });
      wrap.appendChild(panel);
    }
    who.appendChild(wrap);
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
  (online ? [teamById(m.bidder)].filter(Boolean) : humans).forEach(t=>{
    const pend=mkPending(t.id), un=mkUnread(t.id);
    if(!pend && !un) return;
    const parts=[];
    if(pend) parts.push(`${pend} oferta${pend>1?"s":""} por responder`);
    if(un) parts.push(`${un} novedad${un>1?"es":""} sin ver`);
    const line=document.createElement("div");
    line.innerHTML=`🔔 <b style="color:${t.color}">${humans.length>1&&!online?mkEsc(t.name):"Tenés"}</b>${humans.length>1&&!online?":":""} ${parts.join(" y ")}`;
    txt.appendChild(line);
  });
  const go=document.createElement("button"); go.type="button"; go.className="btn primary sm"; go.textContent="Ver ofertas →";
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
  mkRenderToasts();
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
    row.innerHTML=`<span class="dot" style="background:${t.color}"></span><span class="nm">${t.name}${state.mode==="ia" && !t.isHuman ? ' <span class="cpu-badge">BOT</span>' : ''}</span><span class="cnt">${t.roster.length} jug.</span><span class="bud">${fmtM(t.budget)}</span>`;
    tBox.appendChild(row);
  });

  const online=mkOnline(); // online: la lista la ve cada jugador, así que se valida al tocar (según quién opera)
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
      <span class="mk-name">${p.name}<div class="mk-meta"><span class="own" style="color:${owner.color}"><i style="background:${owner.color}"></i>${owner.name}</span></div></span>
      <span class="mk-ovr tier-${squadAvgTier(p.ovr)}">${p.ovr}</span>`;
    const btn=document.createElement("button");
    btn.className="btn sm";
    if(online){ btn.textContent="Ofertar"; }
    else if(mine){ btn.textContent="Tuyo"; btn.disabled=true; }
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
function refreshMarketAll(){ refreshMarket(); refreshFree(); }

/* ---------- Pestaña "Ofertas": recibidas, enviadas y novedades ---------- */
function mkPlayerChip(p){
  return `<div class="oi-pl"><span class="pos-badge pos-${p.pos}">${p.pos}</span><span class="nm">${p.name}</span><span class="ov">${p.ovr}</span></div>`;
}
function mkMyNotes(){ const m=state.market; return mkOnline() ? m.notes.filter(n=>n.teamId===m.bidder) : m.notes; }
function renderOffersTab(){
  const m=state.market; if(!m) return;
  const fresh=new Set(mkMyNotes().filter(n=>!n.read).map(n=>n.id));
  renderOffersPanel();
  renderNotesCard(fresh);
  mkMyNotes().forEach(n=>{ n.read=true; });   // al ver la pestaña, las novedades pasan a leídas
  const lg=document.getElementById("marketLog");
  lg.innerHTML=m.log.length ? m.log.slice().reverse().map(e=>`<div class="${e.cls}">${e.msg}</div>`).join("") : '<div class="no">Todavía no hubo movimientos.</div>';
  renderMarketBar();
}
/* Panel con todas las ofertas en curso que involucran a un humano (las que mandás vos y las que te mandan) */
function renderOffersPanel(){
  const m=state.market; if(!m) return;
  const card=document.getElementById("offersPanel");
  const humans=mkHumans();
  const onl=mkOnline();
  // online: cada jugador ve solo las ofertas que recibió o que mandó él
  const incoming=m.offers.filter(o=>teamById(o.ownerId).isHuman && (!onl || o.ownerId===m.bidder));
  const sent=m.offers.filter(o=>(!onl ? (!teamById(o.ownerId).isHuman && teamById(o.buyerId).isHuman) : (o.buyerId===m.bidder && o.ownerId!==m.bidder)));
  card.innerHTML=`<h3 class="section-title">Ofertas en curso (${incoming.length+sent.length})</h3>`;

  const section=(title,n,emptyMsg,items)=>{
    const h=document.createElement("div"); h.className="mk-sec"; h.innerHTML=`${title} <span class="cnt">${n}</span>`;
    card.appendChild(h);
    if(!items.length){ const e=document.createElement("div"); e.className="mk-empty"; e.textContent=emptyMsg; card.appendChild(e); return; }
    items.forEach(o=>card.appendChild(offerItemEl(o)));
  };
  section("📥 Recibidas",incoming.length,"No tenés ofertas por responder.",incoming);
  section("📤 Enviadas",sent.length,"No tenés ofertas esperando respuesta.",sent);
  const sk=onl ? "seen"+m.bidder : "seen";
  m.offers.forEach(o=>{ o[sk]=true; });
}
function offerItemEl(o){
  const buyer=teamById(o.buyerId), owner=teamById(o.ownerId);
  const tp=playerById(o.targetId), gp=playerById(o.giveId);
  const ownerHuman=owner.isHuman, mine=buyer.isHuman;
  const el=document.createElement("div");
  el.className="offer-item"+(ownerHuman?" incoming":"")+(!o[mkOnline()?"seen"+state.market.bidder:"seen"]?" is-new":"");
  el.innerHTML=`<div class="oi-head"><div class="oi-tag">${ownerHuman ? (o.fromBot ? "📨 Oferta recibida" : "📨 Oferta para "+mkEsc(owner.name)) : "📤 Oferta enviada"}</div>
      <div class="oi-for" style="color:${(ownerHuman?owner:buyer).color}">${mkEsc((ownerHuman?owner:buyer).name)}</div></div>
    <div class="oi-body">
      <div class="oi-side"><span class="oi-lbl"><span style="color:${buyer.color}">${mkEsc(buyer.name)}</span> da</span><div class="oi-money">${fmtM(o.amount)}</div>${mkPlayerChip(gp)}</div>
      <div class="oi-arrow">⇄</div>
      <div class="oi-side"><span class="oi-lbl">por (de <span style="color:${owner.color}">${mkEsc(owner.name)}</span>)</span>${mkPlayerChip(tp)}</div>
    </div>`;
  const onl=mkOnline(), viewer=state.market.bidder;
  if(ownerHuman){
    const row=document.createElement("div");
    row.className="btn-row"; row.style.marginTop="10px";
    if(!onl || viewer===owner.id){
      const ok=document.createElement("button"); ok.className="btn primary sm"; ok.textContent="Aceptar";
      ok.addEventListener("click",()=>acceptOffer(o.id));
      const no=document.createElement("button"); no.className="btn sm"; no.textContent="Rechazar";
      no.addEventListener("click",()=>rejectOffer(o.id));
      row.appendChild(ok); row.appendChild(no);
      ok.dataset.team=owner.id; no.dataset.team=owner.id;
    }
    if(mine && (!onl || viewer===buyer.id)){
      const wd=document.createElement("button"); wd.className="btn sm"; wd.textContent="Retirar";
      wd.addEventListener("click",()=>withdrawOffer(o.id));
      row.appendChild(wd);
      wd.dataset.team=buyer.id;
    }
    const who=document.createElement("div"); who.className="oi-wait";
    who.innerHTML=onl && viewer===buyer.id ? `Esperando la respuesta de <b style="color:${owner.color}">${mkEsc(owner.name)}</b>` : `Decide <b style="color:${owner.color}">${mkEsc(owner.name)}</b>`;
    el.appendChild(who); el.appendChild(row);
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
  const humans=mkHumans(), onl=mkOnline();
  const mine=mkMyNotes();
  card.innerHTML=`<div class="mk-notes-head"><h3 class="section-title">🔔 Novedades</h3></div>`;
  if(mine.length){
    const clr=document.createElement("button"); clr.type="button"; clr.className="btn sm"; clr.textContent="Limpiar";
    clr.addEventListener("click",()=>{ m.notes = onl ? m.notes.filter(n=>n.teamId!==m.bidder) : []; renderOffersTab(); });
    card.querySelector(".mk-notes-head").appendChild(clr);
  }
  if(!mine.length){
    const e=document.createElement("div"); e.className="mk-empty";
    e.textContent="Todavía no hay novedades. Acá vas a ver cuándo te llega una oferta o te aceptan o rechazan una.";
    card.appendChild(e); return;
  }
  const ico={in:"📨", ok:"✅", no:"❌", warn:"⚠️"};
  mine.slice().reverse().slice(0,25).forEach(n=>{
    const t=teamById(n.teamId);
    const el=document.createElement("div"); el.className="mk-note "+n.kind;
    el.innerHTML=`<span class="t-ico">${ico[n.kind]||"🔔"}</span><div class="n-body">${humans.length>1 && !onl && t ? `<div class="n-who" style="color:${t.color}">${mkEsc(t.name)}</div>` : ""}${mkEsc(n.msg)}</div>${fresh && fresh.has(n.id) ? '<span class="n-new">NUEVO</span>' : ""}`;
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
    asHtml=`Ofertando como <span class="mk-chip on static"><span class="dot" style="background:${buyer.color}"></span>${mkEsc(buyer.name)} <span class="bud">${fmtM(buyer.budget)}</span></span>`;
  }

  const quick=[0,10,25,50,100,200];
  const hint = tp.pos==="POR"
    ? "El objetivo es un arquero: solo podés entregar arqueros a cambio."
    : "Los arqueros no se ofrecen a cambio de jugadores de campo.";
  const giveHtml = cands.length
    ? cands.map(p=>`<button type="button" class="of-give${m.giveSel===p.id?" on":""}" data-pid="${p.id}"><span class="tick">✓</span><span class="pos-badge pos-${p.pos}">${p.pos}</span><span class="nm">${p.name}</span><span class="ov tier-${squadAvgTier(p.ovr)}">${p.ovr}</span></button>`).join("")
    : "";

  box.innerHTML=`<div class="of-top">
      <button class="btn sm" id="ofBackBtn" type="button">← Volver al mercado</button>
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
        <div class="of-owner"><i style="background:${owner.color}"></i>${mkEsc(owner.name)}</div>
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
    if(buyer.isHuman) marketNotify(buyer.id,"warn",`Se cayó tu oferta por ${playerById(o.targetId).name}: ${err}`);
    if(owner.isHuman && owner.id!==buyer.id) marketNotify(owner.id,"warn",`Se cayó la oferta de ${buyer.name} por ${playerById(o.targetId).name}: ${err}`);
    return false;
  });
}
function acceptOffer(id){
  const m=state.market; if(!m) return;
  const idx=m.offers.findIndex(x=>x.id===id); if(idx<0) return;
  const o=m.offers[idx];
  const err=validateTrade(o);
  m.offers.splice(idx,1);
  if(err){
    marketLog(`Operación cancelada: ${err}`,"no");
    const bb=teamById(o.buyerId); if(bb && bb.isHuman) marketNotify(bb.id,"warn",`Operación cancelada: ${err}`);
    pruneOffers(); refreshMarketAll(); return;
  }
  const buyer=teamById(o.buyerId), owner=teamById(o.ownerId);
  const tp=playerById(o.targetId), gp=playerById(o.giveId);
  buyer.roster=buyer.roster.filter(id2=>id2!==o.giveId).concat(o.targetId);
  owner.roster=owner.roster.filter(id2=>id2!==o.targetId).concat(o.giveId);
  buyer.budget-=o.amount; owner.budget+=o.amount;
  const botDeal=!buyer.isHuman && !owner.isHuman;
  marketLog(`${botDeal?"🤖 ":""}✅ ${buyer.name} se queda con ${tp.name} (${owner.name}) por ${fmtM(o.amount)} + ${gp.name}`,"ok");
  if(buyer.isHuman) marketNotify(buyer.id,"ok",`${owner.name} aceptó tu oferta: ${tp.name} ya es tuyo (${fmtM(o.amount)} + ${gp.name}).`);
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
  if(buyer.isHuman) marketNotify(buyer.id,"no",`${owner.name} rechazó tu oferta por ${playerById(o.targetId).name}${why}.`);
  refreshMarketAll();
}
function withdrawOffer(id){
  const m=state.market; if(!m) return;
  const idx=m.offers.findIndex(x=>x.id===id); if(idx<0) return;
  const o=m.offers[idx]; m.offers.splice(idx,1);
  marketLog(`↩️ ${teamById(o.buyerId).name} retiró su oferta por ${playerById(o.targetId).name}`,"no");
  { const ow2=teamById(o.ownerId); if(ow2 && ow2.isHuman) marketNotify(ow2.id,"warn",`${teamById(o.buyerId).name} retiró su oferta por ${playerById(o.targetId).name}.`); }
  refreshMarketAll();
}


/* =========================================================
   MERCADO ONLINE — CADA JUGADOR TIENE SU PROPIA PANTALLA
   El anfitrión corre el juego, pero la pestaña, el filtro, la oferta que se está armando, el mercado libre y
   los avisos son de cada jugador: nada de eso se comparte. Para armar el cuadro de un invitado, el anfitrión
   renderiza el mercado "como" ese jugador en una copia aparte de la pantalla (la suya no se toca).
========================================================= */
let MK_SCRATCH=false;
const MK_UI_KEYS=["tab","view","target","giveSel","offAmount","freeTarget","freeGive","filter","posFilter","freePos","whoOpen","formSig","freeSig"];
function mkUiDefaults(){ return {tab:"teams",view:"main",target:null,giveSel:null,offAmount:0,freeTarget:null,freeGive:null,filter:"all",posFilter:"all",freePos:"all",whoOpen:false,formSig:"",freeSig:""}; }
function mkSyncStatic(){
  const m=state.market; if(!m) return;
  const setSel=(id,val)=>{ const e=document.getElementById(id); if(!e) return; e.value=val; Array.from(e.options).forEach(o=>{ if(o.value===String(val)) o.setAttribute("selected",""); else o.removeAttribute("selected"); }); };
  setSel("marketTeamFilter",m.filter); setSel("marketPosFilter",m.posFilter); setSel("freePosFilter",m.freePos);
  const fr=document.getElementById("mkFreeTab"); if(fr) fr.style.display = state.useFreeMarket ? "" : "none";
}
/* Dibuja el mercado completo con el estado propio de quien está mirando */
function mkRenderFull(){
  const m=state.market; if(!m) return;
  mkSyncStatic();
  if(m.tab==="free" && state.useFreeMarket){ applyMarketLayout(); renderFreeMarket(); } else renderMarket();
  mkRenderToasts();
}
/* Ejecuta fn() con el estado de pantalla de otro jugador, sobre una copia de la pantalla del mercado */
function mkAsViewer(teamId, fn){
  const m=state.market, scr=document.getElementById("screen-market");
  if(!m || !scr) return fn();
  m.ui=m.ui||{};
  const ui=m.ui[teamId] || (m.ui[teamId]=mkUiDefaults());
  const host={bidder:m.bidder}; MK_UI_KEYS.forEach(k=>{ host[k]=m[k]; });
  const sx=window.scrollX, sy=window.scrollY, ae=document.activeElement;
  let sel=null; try{ if(ae && scr.contains(ae) && ae.selectionStart!==undefined) sel=[ae.selectionStart,ae.selectionEnd]; }catch(e){}
  const scratch=scr.cloneNode(true);
  scr.replaceWith(scratch);
  MK_SCRATCH=true;
  MK_UI_KEYS.forEach(k=>{ m[k]=ui[k]; }); m.bidder=teamId;
  try{ return fn(scratch); }
  finally{
    MK_UI_KEYS.forEach(k=>{ ui[k]=m[k]; });
    MK_UI_KEYS.forEach(k=>{ m[k]=host[k]; }); m.bidder=host.bidder;
    MK_SCRATCH=false;
    scr.classList.toggle("active",scratch.classList.contains("active")); // si el mercado terminó dentro de la acción, la pantalla ya no está activa
    scratch.replaceWith(scr);
    try{ window.scrollTo(sx,sy); }catch(e){}
    if(ae && ae.isConnected && ae!==document.activeElement){ try{ ae.focus({preventScroll:true}); if(sel) ae.setSelectionRange(sel[0],sel[1]); }catch(e){} }
  }
}
/* Firma barata de todo lo que cambia lo que ve un jugador (para no redibujar si no cambió nada) */
function mkGlobalSig(){
  const m=state.market; if(!m) return "";
  return JSON.stringify([m.offers.map(o=>[o.id,o.buyerId,o.ownerId,o.targetId,o.giveId,o.amount]),
    state.teams.map(t=>[t.budget,t.roster]), m.log.length, m.log.length?m.log[m.log.length-1].msg:"",
    m.freeLog.length, m.freeLog.length?m.freeLog[m.freeLog.length-1].msg:"", state.useFreeMarket?freeAgents().length:0, m.skipVotes||[], mkVoters()]);
}
function mkViewerSig(teamId, gsig){
  const m=state.market; if(!m) return "";
  const u=(m.ui&&m.ui[teamId])||mkUiDefaults();
  return (gsig||mkGlobalSig())+"|"+JSON.stringify([MK_UI_KEYS.filter(k=>k!=="formSig"&&k!=="freeSig").map(k=>u[k]),
    m.notes.filter(n=>n.teamId===teamId).map(n=>[n.id,n.read]), mkLiveToasts(teamId).map(x=>x.id)]);
}
