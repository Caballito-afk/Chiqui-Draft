/* =========================================================
   MÚSICA DE FONDO + PANEL DE AUDIO
   - Reproduce los temas de js/data/musica.js (CHIQUI_TRACKS) en orden aleatorio, uno tras otro, en bucle.
   - Cartelito arriba a la derecha: "Artista - Tema".
   - El botón 🔊 (abajo a la derecha) abre el panel: volumen de sonidos/botones, volumen de música y control de temas.
   - El navegador solo deja sonar audio después de un clic/toque: la música arranca con la primera interacción.
========================================================= */
(function(){
"use strict";
var TR=(window.CHIQUI_TRACKS||[]).slice();
var $=function(id){ return document.getElementById(id); };
var btn=$("sfxToggle"), panel=$("audioPanel"), np=$("nowPlaying"), npText=$("npText");
var sfxR=$("sfxVol"), musR=$("musVol"), sfxO=$("sfxVolOut"), musO=$("musVolOut");
var bPrev=$("musPrev"), bPlay=$("musPlay"), bNext=$("musNext");
if(!btn||!panel||!TR.length) return;

var KEY_VOL="chiquiMusVol", KEY_PAUSE="chiquiMusPaused";
var musVol=0.4, userPaused=false, started=false, order=[], pos=-1, errRun=0;
try{
  var v=localStorage.getItem(KEY_VOL); if(v!==null && !isNaN(parseFloat(v))) musVol=Math.max(0,Math.min(1,parseFloat(v)));
  userPaused=localStorage.getItem(KEY_PAUSE)==="1";
}catch(e){}

var audio=new Audio(); audio.preload="auto"; audio.volume=musVol;

/* ---------- Lista aleatoria (sin repetir hasta terminar la vuelta) ---------- */
function shuffle(lastIdx){
  order=TR.map(function(_,i){ return i; });
  for(var i=order.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)), t=order[i]; order[i]=order[j]; order[j]=t; }
  if(order.length>1 && order[0]===lastIdx){ var k=order.pop(); order.unshift(k); order.push(order.shift()); } // que no arranque con el mismo tema
}
function load(p){
  pos=(p+order.length)%order.length;
  var t=TR[order[pos]];
  audio.src=t.src;
  setNow(t);
}
function setNow(t){
  var txt=t.artist+" - "+t.title;
  npText.textContent=txt; np.title=txt;
  np.classList.remove("np-in"); void np.offsetWidth; np.classList.add("np-in");
}
function tryPlay(){
  var pr=audio.play();
  if(pr && pr.catch) pr.catch(function(){ started=false; }); // sin gesto del usuario: se reintenta en el próximo toque
}
function next(auto){
  if(!auto){ userPaused=false; saveP(); }
  if(pos+1>=order.length){ shuffle(order[pos]); load(0); } else load(pos+1);
  if(!userPaused) tryPlay();
  paint();
}
function prev(){
  if(audio.currentTime>4){ audio.currentTime=0; return; }
  load(pos>0?pos-1:order.length-1); userPaused=false; saveP(); tryPlay(); paint();
}
function saveP(){ try{ localStorage.setItem(KEY_PAUSE,userPaused?"1":"0"); }catch(e){} }

audio.addEventListener("ended",function(){ errRun=0; next(true); });
audio.addEventListener("playing",function(){ errRun=0; paint(); });
audio.addEventListener("pause",paint);
audio.addEventListener("error",function(){
  if(++errRun>=TR.length) return;          // ningún tema carga: no insistir
  setTimeout(function(){ next(true); },400);
});

/* ---------- Arranque con la primera interacción ---------- */
function start(){
  if(started) return; started=true;
  shuffle(-1); load(0);
  if(!userPaused) tryPlay();
  paint();
}
["pointerdown","keydown","touchstart"].forEach(function(ev){
  document.addEventListener(ev,function(){ if(!started) start(); else if(!userPaused && audio.paused && audio.src) tryPlay(); },{capture:true,passive:true});
});

/* ---------- Panel ---------- */
function pct(x){ return Math.round(x*100)+"%"; }
function paint(){
  var sv=window.chiquiSfx?window.chiquiSfx.getVolume():1;
  sfxR.value=Math.round(sv*100); sfxO.textContent=pct(sv);
  musR.value=Math.round(musVol*100); musO.textContent=pct(musVol);
  sfxR.style.setProperty("--p",sfxR.value+"%"); musR.style.setProperty("--p",musR.value+"%");
  var silent=sv===0 && musVol===0;
  btn.textContent=silent?"🔇":"🔊";
  btn.title="Opciones de audio";
  var playing=started && !audio.paused && musVol>0;
  bPlay.textContent=(userPaused||audio.paused)?"▶":"⏸";
  bPlay.title=(userPaused||audio.paused)?"Reanudar música":"Pausar música";
  np.hidden=!(started && playing);
}
function openPanel(open){
  panel.hidden=!open; btn.setAttribute("aria-expanded",open?"true":"false");
  if(open) paint();
}
btn.addEventListener("click",function(e){ e.stopPropagation(); openPanel(panel.hidden); });
document.addEventListener("pointerdown",function(e){
  if(!panel.hidden && !panel.contains(e.target) && !btn.contains(e.target)) openPanel(false);
},true);
document.addEventListener("keydown",function(e){ if(e.key==="Escape" && !panel.hidden) openPanel(false); });

sfxR.addEventListener("input",function(){
  if(window.chiquiSfx) window.chiquiSfx.setVolume(sfxR.value/100);
  paint();
});
sfxR.addEventListener("change",function(){ if(window.chiquiSfx) window.chiquiSfx.play("tab"); });
musR.addEventListener("input",function(){
  musVol=musR.value/100; audio.volume=musVol;
  try{ localStorage.setItem(KEY_VOL,String(musVol)); }catch(e){}
  paint();
});
bNext.addEventListener("click",function(){ if(!started) start(); else next(false); });
bPrev.addEventListener("click",function(){ if(!started) start(); else prev(); });
bPlay.addEventListener("click",function(){
  if(!started){ userPaused=false; saveP(); start(); return; }
  if(audio.paused){ userPaused=false; saveP(); tryPlay(); } else { userPaused=true; saveP(); audio.pause(); }
  paint();
});

window.chiquiMusic={ next:function(){ next(false); }, setVolume:function(v){ musVol=Math.max(0,Math.min(1,v)); audio.volume=musVol; paint(); } };
paint();
})();
