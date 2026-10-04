/* =========================================================
   GUARDADO AUTOMÁTICO (localStorage)
========================================================= */
const SAVE_KEY="chiquiSave_v1";
function activeScreenName(){ const a=document.querySelector(".screen.active"); return a ? a.id.replace("screen-","") : ""; }
function saveTournament(){
  try{
    if(window.ONL && ONL.active) return;
    const scr=activeScreenName();
    if(!state.teams.length || (scr!=="league" && scr!=="playoffs")) return;
    if(!state.fixture.length && !state.playoffs) return;
    let fin=false; try{ fin=tournamentFinished(); }catch(e){}
    const json=JSON.stringify(state,(k,v)=> v instanceof Set ? {__set:[...v]} : v);
    localStorage.setItem(SAVE_KEY,JSON.stringify({screen:scr,finished:fin,at:Date.now(),state:json}));
  }catch(e){}
}
setInterval(saveTournament,2000);
window.addEventListener("beforeunload",saveTournament);
document.addEventListener("visibilitychange",()=>{ if(document.hidden) saveTournament(); });
function restoreTournament(sv){
  state=JSON.parse(sv.state,(k,v)=> (v && typeof v==="object" && Array.isArray(v.__set)) ? new Set(v.__set) : v);
  if(state.playoffs && !(state.playoffs.expanded instanceof Set)) state.playoffs.expanded=new Set();
  goToScreen(sv.screen);
  if(sv.screen==="playoffs") renderPlayoffs(); else renderLeague();
}
setTimeout(async()=>{
  let sv=null; try{ sv=JSON.parse(localStorage.getItem(SAVE_KEY)||"null"); }catch(e){}
  if(!sv) return;
  if(sv.finished){ localStorage.removeItem(SAVE_KEY); return; }
  const when=new Date(sv.at).toLocaleString();
  if(await askConfirm({icon:"💾",title:"¿Retomar tu torneo?",msg:"Encontramos un torneo guardado ("+when+"). Podés seguir donde lo dejaste.",okText:"Retomar",cancelText:"Empezar de nuevo"})){
    try{ restoreTournament(sv); }catch(e){ localStorage.removeItem(SAVE_KEY); alert("No se pudo restaurar el torneo guardado."); }
  } else localStorage.removeItem(SAVE_KEY);
},700);
