/* =========================================================
   SORTEO ANIMADO (Copa y Champions)
   Va después de ajustes / puja / reloj / mercado y antes de la pantalla de liga o de la copa.
   El resultado ya está definido en el estado (state.groups o state.playoffs): acá solo se "revela" con animación.
========================================================= */
let drawRun=null;

// Hay sorteo en Champions (grupos) y en Copa (cruces de la primera ronda). Con 2 equipos no hay nada que sortear.
function drawApplies(){ return (state.champions || state.comp==="cup") && state.teams.length>=3; }

function drawSfx(name,gap){ try{ if(window.chiquiSfx) window.chiquiSfx.play(name,gap||0); }catch(e){} }
function drawChip(t){ return `<span class="dot" style="background:${t.color}"></span><span class="dn">${t.name}</span>${meBadge(t)}`; }
function drawReduced(){ try{ return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(e){ return false; } }

function stopDraw(){
  if(!drawRun) return;
  drawRun.dead=true;
  clearTimeout(drawRun.timer); clearInterval(drawRun.spin);
  drawRun=null;
}

// dest: "league" (Champions) | "playoffs" (Copa)
function showDraw(dest){
  stopDraw();
  const champ=!!state.champions;
  const board=document.getElementById("drawBoard");
  const ball=document.getElementById("drawBall");
  const label=document.getElementById("drawLabel");
  const goBtn=document.getElementById("drawGoBtn");
  const skipBtn=document.getElementById("drawSkipBtn");
  const steps=[]; // {team, slot, card, text}

  document.getElementById("drawTitle").textContent = champ ? "Sorteo de grupos" : "Sorteo de la Copa";
  goBtn.textContent = champ ? "Continuar a la fase de grupos →" : "Continuar a la Copa →";
  goBtn.disabled=true; goBtn.style.display="none";
  skipBtn.style.display="";

  if(champ){
    document.getElementById("drawDesc").textContent=`${state.groups.length} grupo${state.groups.length===1?"":"s"} de 4 equipos. Los grupos se sortean totalmente al azar.`;
    board.className="draw-board draw-groups";
    board.innerHTML=state.groups.map((g,gi)=>`<div class="draw-card" data-gi="${gi}"><h3>Grupo ${GROUP_LETTERS[gi]}</h3>${g.map(()=>'<div class="draw-slot"><span class="ph">?</span></div>').join("")}</div>`).join("");
    const cards=[...board.querySelectorAll(".draw-card")];
    const maxLen=Math.max(...state.groups.map(g=>g.length));
    for(let s=0;s<maxLen;s++) state.groups.forEach((g,gi)=>{ // se sortea de a una "fila": primero uno por grupo, y así
      if(g[s]===undefined) return;
      steps.push({team:teamById(g[s]), slot:cards[gi].querySelectorAll(".draw-slot")[s], card:cards[gi], text:"→ Grupo "+GROUP_LETTERS[gi]});
    });
  } else {
    const r0=state.playoffs.rounds[0];
    document.getElementById("drawDesc").textContent=`Cruces sorteados al azar con ${state.teams.length} equipos; en cada ronda se vuelve a sortear.`+(r0.byes&&r0.byes.length?" Los equipos sin rival pasan directo (bye).":"");
    board.className="draw-board draw-ties";
    board.innerHTML=r0.slots.map((sl,i)=> sl.tie
      ? `<div class="draw-card tie"><h3>${titleForTeams(r0.teamsInRound)} · Cruce ${i+1}</h3><div class="draw-slot"><span class="ph">?</span></div><div class="draw-vs">VS</div><div class="draw-slot"><span class="ph">?</span></div></div>`
      : `<div class="draw-card tie bye"><h3>${titleForTeams(r0.teamsInRound)} · Cruce ${i+1}</h3><div class="draw-slot"><span class="ph">?</span></div><div class="draw-vs">pasa directo</div></div>`
    ).join("");
    const cards=[...board.querySelectorAll(".draw-card")];
    r0.slots.forEach((sl,i)=>{
      const slots=cards[i].querySelectorAll(".draw-slot");
      if(sl.tie){
        steps.push({team:teamById(sl.tie.home), slot:slots[0], card:cards[i], text:"→ Cruce "+(i+1)});
        steps.push({team:teamById(sl.tie.away), slot:slots[1], card:cards[i], text:"vs. su rival"});
      } else steps.push({team:teamById(sl.bye), slot:slots[0], card:cards[i], text:"→ Pasa directo (bye)"});
    });
  }

  ball.className="draw-ball"; ball.innerHTML='<span class="dball-ico">🎲</span>';
  label.textContent="Preparando el sorteo…";
  goToScreen("draw");

  const run=drawRun={dead:false, timer:null, spin:null};
  const alive=()=>!run.dead && drawRun===run && document.getElementById("screen-draw").classList.contains("active");
  const reduced=drawReduced();

  const fill=st=>{
    st.slot.innerHTML=drawChip(st.team);
    st.slot.classList.add("filled");
    if(isMe(st.team)) st.slot.classList.add("you");
    st.card.classList.add("flash");
    setTimeout(()=>st.card.classList.remove("flash"),500);
  };
  const finish=()=>{
    clearInterval(run.spin);
    ball.className="draw-ball done"; ball.innerHTML='<span class="dball-ico">✅</span>';
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
        const t=state.teams[Math.floor(Math.random()*state.teams.length)];
        ball.innerHTML=drawChip(t); drawSfx("tick",30);
      },55);
    }
    run.timer=setTimeout(()=>{
      clearInterval(run.spin);
      if(!alive()) return;
      ball.className="draw-ball lock"; ball.innerHTML=drawChip(st.team); label.textContent=st.text;
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
    steps.forEach(st=>{ if(!st.slot.classList.contains("filled")){ st.slot.innerHTML=drawChip(st.team); st.slot.classList.add("filled"); if(isMe(st.team)) st.slot.classList.add("you"); } });
    finish();
  };
  goBtn.onclick=()=>{
    if(goBtn.disabled) return;
    stopDraw();
    goToScreen(dest);
    if(dest==="playoffs") renderPlayoffs(); else renderLeague();
  };

  run.timer=setTimeout(()=>{ drawSfx("whoosh",0); step(0); }, reduced?200:700);
}
