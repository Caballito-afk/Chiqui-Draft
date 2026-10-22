/* =========================================================
   SORTEO ANIMADO (Copa y Champions)
   Va después de ajustes / puja / reloj / mercado y antes de la pantalla de liga o de la copa.
   El resultado ya está definido en el estado (state.groups o state.playoffs): acá solo se "revela" con animación.
   runDraw(spec) es la animación en sí y la usan los modos normales (showDraw) y el Anotador (anShowDraw).
========================================================= */
let drawRun=null;

// Hay sorteo en Champions (grupos) y en Copa (cruces de la primera ronda). Con 2 equipos no hay nada que sortear.
function drawApplies(){ return (state.champions || state.comp==="cup") && state.teams.length>=3; }

function drawSfx(name,gap){ try{ if(window.chiquiSfx) window.chiquiSfx.play(name,gap||0); }catch(e){} }
function drawChip(t){ return `${chiquiDotHtml(t)}<span class="dn">${t.name}</span>${meBadge(t)}`; }
function drawReduced(){ try{ return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(e){ return false; } }

function stopDraw(){
  if(!drawRun) return;
  drawRun.dead=true;
  clearTimeout(drawRun.timer); clearInterval(drawRun.spin);
  drawRun=null;
}

// dest: "league" (Champions) | "playoffs" (Copa)
function showDraw(dest){
  const champ=!!state.champions;
  const spec={
    title: champ ? "Sorteo de grupos" : "Sorteo de la Copa",
    goLabel: champ ? "Continuar a la fase de grupos" : "Continuar a la Copa",
    spin: state.teams.map(drawChip),
    steps: [],
    onGo(){ goToScreen(dest); if(dest==="playoffs") renderPlayoffs(); else renderLeague(); }
  };
  const chip=t=>({chip:drawChip(t), you:isMe(t)});
  if(champ){
    spec.desc=`${state.groups.length} grupo${state.groups.length===1?"":"s"} de 4 equipos. Los grupos se sortean totalmente al azar.`;
    spec.boardClass="draw-board draw-groups";
    spec.boardHtml=state.groups.map((g,gi)=>`<div class="draw-card" data-gi="${gi}"><h3>Grupo ${GROUP_LETTERS[gi]}</h3>${g.map(()=>'<div class="draw-slot"><span class="ph">?</span></div>').join("")}</div>`).join("");
    const maxLen=Math.max(...state.groups.map(g=>g.length));
    for(let s=0;s<maxLen;s++) state.groups.forEach((g,gi)=>{ // se sortea de a una "fila": primero uno por grupo, y así
      if(g[s]===undefined) return;
      spec.steps.push(Object.assign({card:gi, slot:s, text:"→ Grupo "+GROUP_LETTERS[gi]}, chip(teamById(g[s]))));
    });
  } else {
    const r0=state.playoffs.rounds[0];
    spec.desc=`Cruces sorteados al azar con ${state.teams.length} equipos; en cada ronda se vuelve a sortear.`+(r0.byes&&r0.byes.length?" Los equipos sin rival pasan directo (bye).":"");
    spec.boardClass="draw-board draw-ties";
    spec.boardHtml=r0.slots.map((sl,i)=> sl.tie
      ? `<div class="draw-card tie"><h3>${titleForTeams(r0.teamsInRound)} · Cruce ${i+1}</h3><div class="draw-slot"><span class="ph">?</span></div><div class="draw-vs">VS</div><div class="draw-slot"><span class="ph">?</span></div></div>`
      : `<div class="draw-card tie bye"><h3>${titleForTeams(r0.teamsInRound)} · Cruce ${i+1}</h3><div class="draw-slot"><span class="ph">?</span></div><div class="draw-vs">pasa directo</div></div>`
    ).join("");
    r0.slots.forEach((sl,i)=>{
      if(sl.tie){
        spec.steps.push(Object.assign({card:i, slot:0, text:"→ Cruce "+(i+1)}, chip(teamById(sl.tie.home))));
        spec.steps.push(Object.assign({card:i, slot:1, text:"vs. su rival"}, chip(teamById(sl.tie.away))));
      } else spec.steps.push(Object.assign({card:i, slot:0, text:"→ Pasa directo (bye)"}, chip(teamById(sl.bye))));
    });
  }
  runDraw(spec);
}

/* spec: {title, desc, goLabel, boardClass, boardHtml, spin:[html de fichas],
          steps:[{card, slot, chip, you, text}], onGo(), anotador?} */
function runDraw(spec){
  stopDraw();
  const board=document.getElementById("drawBoard");
  const ball=document.getElementById("drawBall");
  const label=document.getElementById("drawLabel");
  const goBtn=document.getElementById("drawGoBtn");
  const skipBtn=document.getElementById("drawSkipBtn");
  document.getElementById("screen-draw").classList.toggle("an-draw",!!spec.anotador);

  document.getElementById("drawTitle").textContent=spec.title;
  document.getElementById("drawDesc").textContent=spec.desc;
  goBtn.textContent=spec.goLabel;
  goBtn.disabled=true; goBtn.style.display="none";
  skipBtn.style.display="";
  board.className=spec.boardClass;
  board.innerHTML=spec.boardHtml;
  const cards=[...board.querySelectorAll(".draw-card")];
  const steps=spec.steps.map(st=>Object.assign({}, st, {slotEl:cards[st.card].querySelectorAll(".draw-slot")[st.slot], cardEl:cards[st.card]}));

  ball.className="draw-ball"; ball.innerHTML='<span class="dball-ico">?</span>';
  label.textContent="Preparando el sorteo…";
  goToScreen("draw");

  const run=drawRun={dead:false, timer:null, spin:null};
  const alive=()=>!run.dead && drawRun===run && document.getElementById("screen-draw").classList.contains("active");
  const reduced=drawReduced();

  const fill=st=>{
    st.slotEl.innerHTML=st.chip;
    st.slotEl.classList.add("filled");
    if(st.you) st.slotEl.classList.add("you");
    st.cardEl.classList.add("flash");
    setTimeout(()=>st.cardEl.classList.remove("flash"),500);
  };
  const finish=()=>{
    clearInterval(run.spin);
    ball.className="draw-ball done"; ball.innerHTML='<span class="dball-ico">✓</span>';
    label.textContent="¡Sorteo completo!";
    skipBtn.style.display="none";
    goBtn.style.display=""; goBtn.disabled=false;
    drawSfx("rank");
  };
  const step=i=>{
    if(!alive()) return;
    if(i>=steps.length){ finish(); return; }
    const st=steps[i];
    const spinMs = reduced ? 0 : (i<4 ? 440 : 300);
    ball.className="draw-ball spin"; label.textContent="Sorteando…";
    if(spinMs){
      run.spin=setInterval(()=>{
        if(!alive()){ clearInterval(run.spin); return; }
        ball.innerHTML=spec.spin[Math.floor(Math.random()*spec.spin.length)]; drawSfx("tick",30);
      },55);
    }
    run.timer=setTimeout(()=>{
      clearInterval(run.spin);
      if(!alive()) return;
      ball.className="draw-ball lock"; ball.innerHTML=st.chip; label.textContent=st.text;
      drawSfx("select",0);
      run.timer=setTimeout(()=>{
        if(!alive()) return;
        fill(st);
        run.timer=setTimeout(()=>step(i+1), reduced?120:140);
      }, reduced?160:300);
    }, spinMs);
  };

  skipBtn.onclick=()=>{
    if(!alive()) return;
    clearTimeout(run.timer); clearInterval(run.spin);
    steps.forEach(st=>{ if(!st.slotEl.classList.contains("filled")){ st.slotEl.innerHTML=st.chip; st.slotEl.classList.add("filled"); if(st.you) st.slotEl.classList.add("you"); } });
    finish();
  };
  goBtn.onclick=()=>{
    if(goBtn.disabled) return;
    stopDraw();
    spec.onGo();
  };

  run.timer=setTimeout(()=>{ drawSfx("whoosh",0); step(0); }, reduced?200:700);
}
