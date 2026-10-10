/* =========================================================
   VER PLANTILLAS (alineación con jugadores arrastrables)
========================================================= */
const SQUAD_ROW_Y={POR:90, DEF:68, MED:44, DEL:20};
// En una sala online cada jugador ve solo su propia plantilla (igual que en el modo de un jugador)
function squadOwnOnly(){ return typeof ONL!=="undefined" && !!ONL.active; }
function refreshSquadBtns(){
  const single = state.mode==="ia" || squadOwnOnly();
  document.querySelectorAll(".squad-btn").forEach(b=>{ b.textContent = single ? "👥 Mi plantilla" : "👥 Ver plantillas"; });
}
function squadDefaultSpots(pids){
  const groups={POR:[],DEF:[],MED:[],DEL:[]};
  pids.forEach(pid=>{ const p=playerById(pid); (groups[p.pos]||groups.MED).push(pid); });
  const out={};
  Object.keys(groups).forEach(pos=>{
    const g=groups[pos]; const n=g.length;
    g.forEach((pid,i)=>{ out[pid]={x:(i+1)/(n+1)*100, y:SQUAD_ROW_Y[pos]}; });
  });
  return out;
}
function squadEnsureLayout(t){
  const L = t.viewLayout || (t.viewLayout={});
  const ids=new Set(t.roster);
  const freed=[];
  Object.keys(L).forEach(k=>{ if(!ids.has(Number(k))){ freed.push(L[k]); delete L[k]; } });
  const missing=t.roster.filter(pid=>!L[pid]);
  if(!missing.length) return L;
  if(!freed.length){
    Object.assign(L, (t.viewFormation && missing.length===t.roster.length) ? squadFormationSpots(missing,t.viewFormation) : squadDefaultSpots(missing));
  } else {
    const rest=[];
    missing.forEach(pid=>{ if(freed.length) L[pid]=freed.shift(); else rest.push(pid); });
    if(rest.length) Object.assign(L, squadDefaultSpots(rest));
  }
  return L;
}
function squadShortName(n){ return n; } // nombre completo, sin abreviar
const SQUAD_FORMATIONS={
  11:["5-3-2","3-4-3","4-3-1-2","4-3-2-1","4-5-1"],
  5:["1-3-0","2-1-1","0-4-0","2-2-0","1-1-1-1"]
};
function squadFormationSpots(pids,key){
  const rows=key.split("-").map(Number).filter(n=>n>0);
  const rank={POR:0,DEF:1,MED:2,DEL:3};
  const list=pids.slice().sort((a,b)=>{
    const pa=playerById(a), pb=playerById(b);
    return (rank[pa.pos]-rank[pb.pos])||(pb.ovr-pa.ovr);
  });
  const out={};
  const gk=list.findIndex(pid=>playerById(pid).pos==="POR");
  if(gk>=0){ out[list[gk]]={x:50,y:90}; list.splice(gk,1); }
  const nRows=rows.length;
  rows.forEach((n,ri)=>{
    const y = nRows===1 ? 45 : 68 - ri*(50/(nRows-1));
    const gap = n<=2 ? 34 : n===3 ? 30 : n===4 ? 24 : 19;
    for(let i=0;i<n && list.length;i++){
      out[list.shift()]={x:50+(i-(n-1)/2)*gap, y};
    }
  });
  // por si sobran jugadores (no debería pasar): quedan en una fila extra
  const extra=list.length;
  list.forEach((pid,i)=>{ out[pid]={x:(i+1)/(extra+1)*100, y:90}; });
  return out;
}
function squadTeamAvg(t){
  return t.roster.length ? Math.round(t.roster.reduce((a,pid)=>a+playerById(pid).ovr,0)/t.roster.length) : 0;
}
function squadAvgTier(v){
  if(v>=96) return "red";      // 96-97 (y cualquier valor superior)
  if(v>=90) return "orange";   // 90-95
  if(v>=80) return "yellow";   // 80-89
  return "silver";             // 1-79
}
const squadUI={teamId:null};
function openSquadModal(){
  if(typeof ONL!=="undefined" && ONL.active && ONL.role==="guest"){ if(typeof onlGuestOpenSquad==="function") onlGuestOpenSquad(); return; }
  const single = state.mode==="ia" || squadOwnOnly();
  if(!state.teams.length) return;
  clearTimeout(_squadT);
  document.getElementById("squadModal").classList.remove("closing");
  document.getElementById("squadModal").classList.add("open");
  if(single){
    const me=(squadOwnOnly() && state.teams.find(t=>t.id===ONL.myId)) || state.teams.find(t=>t.isHuman)||state.teams[0];
    showSquadTeam(me.id);
  } else {
    showSquadMenu();
  }
}
let _squadT=null;
function closeSquadModal(){
  const m=document.getElementById("squadModal");
  m.classList.add("closing"); // se quita "open" recién cuando termina el fundido
  clearTimeout(_squadT);
  _squadT=setTimeout(()=>m.classList.remove("open","closing"),200);
  squadUI.teamId=null;
}
function showSquadMenu(){
  squadUI.teamId=null;
  document.getElementById("squadTitle").textContent="Elegí un club";
  document.getElementById("squadBack").style.display="none";
  const body=document.getElementById("squadBody");
  body.innerHTML='<div class="squad-menu"></div>';
  const grid=body.firstChild;
  state.teams.forEach(t=>{
    const b=document.createElement("button");
    b.type="button"; b.className="squad-team-btn";
    const avg=t.roster.length ? Math.round(t.roster.reduce((a,pid)=>a+playerById(pid).ovr,0)/t.roster.length) : 0;
    b.innerHTML=`<span class="dot" style="background:${t.color}"></span><span class="nm">${t.name}</span><span class="cnt">${t.roster.length} jug. · Media <span class="av tier-${squadAvgTier(avg)}">${avg}</span>${teamBalance(t).level!=="ok"?' · ⚠️':''}</span>`;
    b.addEventListener("click",()=>showSquadTeam(t.id));
    grid.appendChild(b);
  });
}
function showSquadTeam(teamId, teamObj){
  // teamObj: plantel armado a partir de los datos que manda el anfitrión (invitados online); si no, se busca en el estado
  const t=teamObj||teamById(teamId); if(!t) return;
  squadUI.teamId=teamId;
  const single = state.mode==="ia" || squadOwnOnly() || !!teamObj;
  const avg=squadTeamAvg(t);
  document.getElementById("squadTitle").innerHTML=`<span style="color:${t.color}">${t.name}</span><span class="squad-avg tier-${squadAvgTier(avg)}" title="Media del equipo"><span class="av-lbl">Media</span><span class="av-num">${avg}</span></span>`;
  document.getElementById("squadBack").style.display = single ? "none" : "";
  const L=squadEnsureLayout(t);
  const body=document.getElementById("squadBody");
  const forms=SQUAD_FORMATIONS[t.squadSize||state.squadSize]||SQUAD_FORMATIONS[11];
  body.innerHTML='<div class="squad-forms" id="squadForms"><span class="lbl">Formación</span></div><div class="pitch" id="squadPitch"><div class="ln mid"></div><div class="ln circle"></div><div class="ln boxT"></div><div class="ln boxB"></div><div class="ln goalT"></div><div class="ln goalB"></div></div>';
  const formsBox=document.getElementById("squadForms");
  [{key:null,label:"Por posición"}].concat(forms.map(f=>({key:f,label:f}))).forEach(f=>{
    const b=document.createElement("button");
    b.type="button"; b.className="squad-chip"+((t.viewFormation||null)===f.key?" on":""); b.textContent=f.label;
    b.dataset.form=f.key||"";
    b.addEventListener("click",()=>{ t.viewFormation=f.key; t.viewLayout=null; squadApplyLayout(t); }); // las fichas se deslizan a su nueva posición
    formsBox.appendChild(b);
  });
  const bal=teamBalance(t);
  const balEl=document.createElement("div");
  balEl.className="squad-balance "+bal.level;
  balEl.innerHTML=`<b>${bal.level==="ok"?"✅":bal.level==="warn"?"⚠️":"🚨"} ${bal.title}.</b> ${bal.msg}`;
  body.insertBefore(balEl, document.getElementById("squadPitch"));
  const pitch=document.getElementById("squadPitch");
  t.roster.forEach((pid,i)=>{
    const p=playerById(pid); const pos=L[pid];
    const el=document.createElement("div");
    el.className="ptoken p-"+p.pos;
    el.dataset.pid=pid; el.style.setProperty("--i",i);
    el.style.left=pos.x+"%"; el.style.top=pos.y+"%";
    el.innerHTML=`<div class="disc"><small>${p.pos}</small><b>${p.ovr}</b></div><div class="pn" title="${p.name}">${squadShortName(p.name)}</div>`;
    if(t.suspSet ? t.suspSet.has(pid) : isSusp(pid)){ el.classList.add("susp"); el.title=p.name+" está suspendido: no juega la próxima fecha"; el.insertAdjacentHTML("beforeend",'<div class="susp-tag">🚫 Suspendido</div>'); }
    else attachSquadDrag(el, pitch, t, pid);
    pitch.appendChild(el);
  });
}
// Reubica las fichas existentes (sin redibujar) para que la transición CSS las deslice suavemente
function squadApplyLayout(t){
  const L=squadEnsureLayout(t);
  document.querySelectorAll("#squadPitch .ptoken").forEach(el=>{
    const pos=L[el.dataset.pid];
    if(pos){ el.style.left=pos.x+"%"; el.style.top=pos.y+"%"; }
  });
  document.querySelectorAll("#squadForms .squad-chip").forEach(c=>c.classList.toggle("on",(c.dataset.form||"")===(t.viewFormation||"")));
}
function attachSquadDrag(el, pitch, team, pid){
  let dx=0, dy=0;
  el.addEventListener("pointerdown",(e)=>{
    e.preventDefault();
    const r=pitch.getBoundingClientRect();
    const cur=team.viewLayout[pid];
    dx=cur.x-((e.clientX-r.left)/r.width*100);
    dy=cur.y-((e.clientY-r.top)/r.height*100);
    el.setPointerCapture(e.pointerId);
    el.classList.add("drag");
  });
  el.addEventListener("pointermove",(e)=>{
    if(!el.classList.contains("drag")) return;
    const r=pitch.getBoundingClientRect();
    const x=Math.max(5,Math.min(95,(e.clientX-r.left)/r.width*100+dx));
    const y=Math.max(5,Math.min(95,(e.clientY-r.top)/r.height*100+dy));
    team.viewLayout[pid]={x,y};
    el.style.left=x+"%"; el.style.top=y+"%";
  });
  const end=(e)=>{ el.classList.remove("drag"); try{ el.releasePointerCapture(e.pointerId); }catch(_){} };
  el.addEventListener("pointerup",end);
  el.addEventListener("pointercancel",end);
}
document.addEventListener("click",(e)=>{
  if(e.target.closest && e.target.closest(".squad-btn")) openSquadModal();
});
document.getElementById("squadClose").addEventListener("click",closeSquadModal);
document.getElementById("squadBack").addEventListener("click",showSquadMenu);
document.getElementById("squadModal").addEventListener("click",(e)=>{ if(e.target.id==="squadModal") closeSquadModal(); });
document.addEventListener("keydown",(e)=>{ if(e.key==="Escape" && document.getElementById("squadModal").classList.contains("open")) closeSquadModal(); });

/* ---- Volver a ajustes desde la puja / El Reloj (se conservan las opciones y los nombres) ---- */
async function backToSettingsFromDraft(){
  const a=state.auction, m=state.mini;
  const progress = (a && a.totalDone>0) || (m && m.totalDone>0);
  if(progress && !(await askConfirm({icon:"⚙️", title:"¿Volver a los ajustes?", msg:"Se pierden los fichajes hechos hasta ahora."}))) return;
  if(state.auction) clearFreeTimer();
  clearMiniTimers();
  state.auction=null; state.mini=null; state.market=null;
  state.teams=[];
  state.playoffs=null; state.disc={}; state.leagueCelebrated=false; state.humanElimLeague=false;
  updateSteps();
  goToScreen("settings");
  window.scrollTo(0,0);
}
document.getElementById("auctionBackBtn").addEventListener("click",backToSettingsFromDraft);
document.getElementById("miniBackBtn").addEventListener("click",backToSettingsFromDraft);
