/* =========================================================
   NAVEGACIÓN ENTRE PANTALLAS
========================================================= */
function goToScreen(name){
  if(typeof refreshSquadBtns==="function") refreshSquadBtns();
  document.querySelector(".app").classList.toggle("on-home", name==="home");
  const stepKey = (name==="market" || name==="mini") ? "draft" : (name==="draw" ? (state.champions ? "league" : "playoffs") : name);
  const _prev=document.querySelector(".screen.active");
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  const _next=document.getElementById("screen-"+name);
  _next.classList.add("active");
  // al pasar de una pantalla a otra siempre se arranca desde arriba (sin animación)
  if(_prev!==_next){
    window.scrollTo({top:0,left:0,behavior:"instant"});
    document.documentElement.scrollTop=0; document.body.scrollTop=0;
  }
  if(name==="league") requestAnimationFrame(fitStandingsSidebar);
  document.querySelectorAll(".step").forEach(s=>{
    s.classList.remove("active");
    if(s.dataset.step===stepKey) s.classList.add("active");
  });
  const order=["settings","draft","league","playoffs"];
  const idx=order.indexOf(stepKey);
  order.forEach((n,i)=>{
    const el=document.querySelector(`.step[data-step="${n}"]`);
    if(i<idx) el.classList.add("done"); else el.classList.remove("done");
  });
}
