/* =========================================================
   SONIDOS (sintetizados con Web Audio: no usa archivos externos)
   - Clics de menús y botones, hover suave en tarjetas
   - Puja, fichajes, ofertas, cuenta regresiva
   - Partidos: pitidos, goles, penales, festejos y campeón
   El botón 🔊 (abajo a la derecha) abre el panel de audio (volumen de efectos y de música).
========================================================= */
(function(){
"use strict";
var ctx=null, master=null, nbuf=null, unlocked=false, muted=false, last={}, vol=1;
/* Volumen de los efectos (0 a 1). Antes solo había silenciar: si estaba silenciado, arranca en 0. */
try{
  var sv=localStorage.getItem("chiquiSfxVol");
  if(sv!==null && !isNaN(parseFloat(sv))) vol=Math.max(0,Math.min(1,parseFloat(sv)));
  else if(localStorage.getItem("chiquiSfxMuted")==="1") vol=0;
}catch(e){}
muted=vol===0;

function init(){
  if(ctx){ if(ctx.state==="suspended") ctx.resume(); return ctx; }
  var C=window.AudioContext||window.webkitAudioContext; if(!C) return null;
  ctx=new C();
  var comp=ctx.createDynamicsCompressor(); comp.threshold.value=-14; comp.ratio.value=6;
  master=ctx.createGain(); master.gain.value=.7*vol;
  master.connect(comp); comp.connect(ctx.destination);
  nbuf=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);
  var d=nbuf.getChannelData(0); for(var i=0;i<d.length;i++) d[i]=Math.random()*2-1;
  return ctx;
}

/* Nota simple: f=frecuencia, t=inicio, d=duración. o: type, v(volumen), a(ataque), to(glissando), lp(filtro), vib:[hz,prof] */
function tone(f,t,d,o){
  o=o||{}; var a=o.a||.008, v=o.v||.2;
  var os=ctx.createOscillator(), g=ctx.createGain(), out=g;
  os.type=o.type||"sine";
  os.frequency.setValueAtTime(f,t);
  if(o.to) os.frequency.exponentialRampToValueAtTime(o.to,t+a+d);
  if(o.vib){
    var l=ctx.createOscillator(), lg=ctx.createGain();
    l.frequency.value=o.vib[0]; lg.gain.value=o.vib[1];
    l.connect(lg); lg.connect(os.frequency); l.start(t); l.stop(t+a+d+.05);
  }
  g.gain.setValueAtTime(.0001,t);
  g.gain.exponentialRampToValueAtTime(v,t+a);
  g.gain.exponentialRampToValueAtTime(.0001,t+a+d);
  os.connect(g);
  if(o.lp){ var fl=ctx.createBiquadFilter(); fl.type="lowpass"; fl.frequency.value=o.lp; g.connect(fl); out=fl; }
  out.connect(master);
  os.start(t); os.stop(t+a+d+.05);
}

/* Ruido filtrado: público, aplausos, soplidos, estallidos */
function noise(t,d,o){
  o=o||{}; var a=Math.min(o.a||.02,d*.9);
  var s=ctx.createBufferSource(); s.buffer=nbuf; s.loop=true;
  var fl=ctx.createBiquadFilter(); fl.type=o.type||"bandpass"; fl.Q.value=o.q||1;
  fl.frequency.setValueAtTime(o.f||1000,t);
  if(o.to) fl.frequency.exponentialRampToValueAtTime(o.to,t+d);
  var g=ctx.createGain();
  g.gain.setValueAtTime(.0001,t);
  g.gain.exponentialRampToValueAtTime(o.v||.15,t+a);
  g.gain.exponentialRampToValueAtTime(.0001,t+d);
  s.connect(fl); fl.connect(g); g.connect(master);
  s.start(t,Math.random()); s.stop(t+d+.05);
}

function whistle(t,len){
  tone(2850,t,len,{v:.15,a:.01,vib:[30,140]});
  tone(3120,t,len,{v:.08,a:.01,vib:[27,120]});
  noise(t,len,{f:3000,q:6,v:.05,a:.01});
}
function pop(t){ noise(t,.09,{f:900,q:.8,a:.005,v:.3}); tone(220,t,.1,{to:60,v:.2}); }
function jingle(t,notes,step,vol){
  notes.forEach(function(f,i){ tone(f,t+i*step,.18,{type:"triangle",v:vol||.14}); });
}
function crowd(t,d,v){
  noise(t,d,{f:800,q:.5,a:d*.18,v:v||.3});
  noise(t,d*.9,{f:2400,q:.6,a:d*.15,v:(v||.3)*.38});
}
function horn(t){
  [440,554.37,659.25].forEach(function(f,i){
    tone(f*(1+i*.002),t,.8,{type:"sawtooth",v:.07,lp:2200,a:.03});
  });
}

var S={
  /* ---------- Interfaz ---------- */
  click:function(t){ tone(700,t,.05,{type:"triangle",v:.17}); },
  tick:function(t){ tone(1500,t,.025,{v:.07}); },
  hover:function(t){ tone(1100,t,.03,{v:.035}); },
  tab:function(t){ tone(880,t,.04,{v:.15}); tone(1175,t+.04,.06,{v:.15}); },
  select:function(t){ tone(523.25,t,.08,{type:"triangle",v:.2}); tone(783.99,t+.07,.13,{type:"triangle",v:.2}); },
  confirm:function(t){ jingle(t,[523.25,659.25,783.99,1046.5],.06,.18); },
  back:function(t){ tone(520,t,.08,{type:"triangle",to:330,v:.17}); },
  toggle:function(t){ tone(600,t,.07,{type:"square",to:900,v:.09,lp:2200}); },
  open:function(t){ noise(t,.22,{f:300,to:2000,q:1,a:.08,v:.12}); tone(660,t+.1,.1,{type:"triangle",v:.15}); },
  whoosh:function(t){ noise(t,.26,{f:400,to:1800,q:1,a:.1,v:.08}); },

  /* ---------- Puja / fichajes / mercado ---------- */
  drum:function(t){ tone(130,t,.16,{to:55,v:.3}); noise(t,.05,{f:1500,q:1,a:.003,v:.08}); },
  bid:function(t){ tone(988,t,.07,{type:"square",v:.1,lp:3000}); tone(1318.5,t+.07,.14,{type:"square",v:.1,lp:3000}); },
  pass:function(t){ tone(300,t,.2,{type:"sawtooth",to:180,v:.1,lp:1200}); },
  coin:function(t){ tone(1568,t,.25,{v:.14}); tone(2093,t+.07,.35,{v:.12}); },
  sold:function(t){ /* caja registradora + festejo corto */
    noise(t,.04,{f:3000,q:1,a:.002,v:.2});
    tone(1568,t+.02,.5,{v:.17}); tone(2093,t+.1,.7,{v:.17}); tone(2637,t+.2,.6,{v:.09});
    crowd(t+.1,1,.12); jingle(t+.35,[659.25,783.99,1046.5],.08,.11);
  },
  unsold:function(t){
    [392,370,349,330].forEach(function(f,i){
      tone(f,t+i*.24,.26,{type:"sawtooth",v:.1,lp:900,to:i===3?290:undefined});
    });
  },
  ok:function(t){ jingle(t,[523.25,659.25,783.99],.07,.18); tone(1046.5,t+.24,.4,{v:.16}); },
  no:function(t){ tone(160,t,.12,{type:"square",v:.12,lp:800}); tone(140,t+.15,.2,{type:"square",v:.12,lp:800}); },
  beep:function(t){ tone(880,t,.1,{type:"square",v:.1,lp:2500}); },
  cheer:function(t){ crowd(t,1.6,.22); jingle(t,[523.25,659.25,783.99,1046.5],.09,.14); },

  /* ---------- Partidos ---------- */
  whistle:function(t){ whistle(t,.5); },
  whistle2:function(t){ whistle(t,.25); whistle(t+.34,.25); },
  finalWhistle:function(t){ whistle(t,.22); whistle(t+.3,.22); whistle(t+.6,.7); crowd(t+.6,1.6,.18); },
  rank:function(t){ tone(520,t,.08,{type:"triangle",to:780,v:.09}); tone(780,t+.08,.1,{type:"triangle",to:600,v:.07}); },
  matchday:function(t){ whistle(t,.25); crowd(t,.8,.1); },
  chance:function(t){ noise(t,.6,{f:1000,q:.8,a:.2,v:.1}); },
  goal:function(t){ crowd(t,2.2,.32); horn(t+.02); jingle(t+.9,[523.25,659.25,783.99,1046.5,1318.5],.09,.14); },
  goalLate:function(t){
    crowd(t,3.4,.38); horn(t+.02); horn(t+.9);
    jingle(t+.9,[523.25,659.25,783.99,1046.5,1318.5,1568],.09,.15);
    [.3,.7,1.2,1.8].forEach(function(o){ pop(t+o); });
  },
  penOk:function(t){ crowd(t,1.3,.22); jingle(t,[659.25,783.99,1046.5],.08,.14); },
  penMiss:function(t){ noise(t,.9,{f:500,to:300,q:.6,a:.2,v:.2}); tone(400,t,.55,{type:"sawtooth",to:200,v:.08,lp:900}); },

  /* ---------- Campeón ---------- */
  fanfare:function(t){
    var N=[[392,0,.14],[392,.17,.14],[392,.34,.14],[523.25,.51,.5],[440,1.05,.14],[523.25,1.22,.2],[659.25,1.5,.35],[783.99,1.9,1.3]];
    N.forEach(function(n){
      tone(n[0],t+n[1],n[2],{type:"sawtooth",v:.12,lp:2600,a:.02});
      tone(n[0]/2,t+n[1],n[2],{type:"triangle",v:.12});
    });
    [523.25,659.25,1046.5].forEach(function(f){ tone(f,t+1.9,1.4,{type:"sawtooth",v:.06,lp:2400,a:.05}); });
    noise(t,4.5,{f:900,q:.5,a:.6,v:.28});
    for(var i=0;i<70;i++) noise(t+.8+Math.random()*4.2,.05,{type:"highpass",f:2800,a:.004,v:.04+Math.random()*.05});
    [.15,.55,1,1.5,2.1,2.8,3.6].forEach(function(o){ pop(t+o); });
  }
};

function play(name,gap){
  if(muted||!unlocked) return;
  var c=init(); if(!c || !S[name]) return;
  if(gap){ var n=performance.now(); if(last[name] && n-last[name]<gap) return; last[name]=n; }
  try{ S[name](c.currentTime+.005); }catch(e){}
}

/* El navegador solo deja sonar el audio tras un gesto del usuario */
function unlock(){ if(unlocked) return; unlocked=true; init(); }
["pointerdown","keydown","touchstart"].forEach(function(ev){
  document.addEventListener(ev,unlock,{capture:true,passive:true});
});

/* ---------- Volumen de los efectos (lo maneja el panel de audio de musica.js) ---------- */
function setVolume(v){
  vol=Math.max(0,Math.min(1,+v||0)); muted=vol===0;
  try{ localStorage.setItem("chiquiSfxVol",String(vol)); }catch(e){}
  if(master) master.gain.value=.7*vol;
}

/* ---------- Clics en cualquier botón / menú / tarjeta ---------- */
var CLICKABLE="button,[role=button],.home-card,.opt-card,.step,.mk-tab,.speed-btn,.clock-btn,summary,a[href],label[for],[data-pm],.events-toggle";
function findClickable(el){
  for(var i=0; el && el!==document.body && i<7; i++, el=el.parentElement){
    if(el.matches && el.matches(CLICKABLE)) return el;
    var cur=""; try{ cur=getComputedStyle(el).cursor; }catch(e){}
    if(cur==="pointer") return el;
  }
  return null;
}
function kindOf(el){
  var id=el.id||"", cl=el.classList, txt=(el.textContent||"").trim();
  if(id==="sfxToggle"||id==="easterStar") return null;
  if(cl.contains("clock-btn")||cl.contains("bid-go")||cl.contains("bid-pass")) return null; // tienen su propio sonido
  if(id==="confirmOk") return "confirm";
  if(id==="confirmCancel") return "back";
  if(id==="themeToggle") return "toggle";
  if(cl.contains("home-card")) return "select";
  if(/back|volver/i.test(id) || /^[←‹◀]/.test(txt)) return "back";
  if(cl.contains("step")) return "tick";
  if(cl.contains("mk-tab")||cl.contains("speed-btn")||cl.contains("opt-card")||el.hasAttribute("data-pm")) return "tab";
  if(cl.contains("primary")||cl.contains("gold")) return "confirm";
  return "click";
}
document.addEventListener("click",function(e){
  var el=findClickable(e.target); if(!el) return;
  if(el.disabled || el.getAttribute("aria-disabled")==="true") return;
  var k=kindOf(el); if(k) play(k,40);
},true);

/* Selectores, casillas y números */
document.addEventListener("change",function(e){
  var t=e.target; if(!t||!t.matches) return;
  if(t.matches("select,input[type=checkbox],input[type=radio],input[type=range]")) play("tab",60);
},true);
document.addEventListener("input",function(e){
  var t=e.target; if(t && t.matches && t.matches("input[type=number]")) play("tick",80);
},true);

/* Hover suave en tarjetas del menú (solo con mouse) */
var lastHover=null, canHover=window.matchMedia && window.matchMedia("(hover:hover)").matches;
if(canHover){
  document.addEventListener("mouseover",function(e){
    var c=e.target.closest && e.target.closest(".home-card,.opt-card");
    if(c===lastHover) return;
    lastHover=c;
    if(c) play("hover",60);
  },true);
}

/* ---------- Enganche a los eventos del juego ---------- */
function wrap(name,before,after){
  var orig=window[name]; if(typeof orig!=="function") return;
  window[name]=function(){
    var ctxv=null;
    try{ if(before) ctxv=before.apply(this,arguments); }catch(e){}
    var r=orig.apply(this,arguments);
    try{ if(after) after(ctxv,r,arguments); }catch(e){}
    return r;
  };
}
function isHumanTeam(id){ try{ var t=teamById(id); return !!(t&&t.isHuman); }catch(e){ return false; } }
function offerHuman(id){
  try{
    var o=state.market.offers.find(function(x){ return x.id===id; });
    return !!o && (isHumanTeam(o.buyerId)||isHumanTeam(o.ownerId));
  }catch(e){ return false; }
}

/* Navegación y ventanas */
wrap("goToScreen",null,function(){ play("whoosh",150); });
wrap("askConfirm",function(){ play("open"); });
wrap("openSquadModal",function(){ play("open"); });

/* Puja */
wrap("startPlayerAuction",null,function(){ if(!(state.auction&&state.auction.instant)) play("drum",120); });
wrap("humanBid",function(){ if(state.auction&&state.auction.waitingHuman!==null) play("bid"); });
wrap("humanPass",function(){ if(state.auction&&state.auction.waitingHuman!==null) play("pass"); });
wrap("freeBid",function(id){ if(isHumanTeam(id)) play("bid",80); });
wrap("freePass",function(id){ if(isHumanTeam(id) && (typeof freeCanPass!=="function" || freeCanPass(id))) play("pass",80); });
wrap("sellPlayerTo",
  function(id){ return {human:isHumanTeam(id), instant:!!(state.auction&&state.auction.instant)}; },
  function(c){ if(c && !c.instant) play(c.human?"sold":"coin",80); });
wrap("logUnsoldAndContinue",function(){ if(!(state.auction&&state.auction.instant)) play("unsold",300); });
wrap("finishAuction",null,function(){ play("cheer",800); });

/* El Reloj */
wrap("miniStartPlayer",null,function(){ play("drum",120); });
wrap("miniBuy",
  function(){ return !!(state.mini && state.mini.phase==="running"); },
  function(was,_r,args){
    if(was && state.mini && state.mini.phase==="sold") play(isHumanTeam(args[0])?"sold":"coin",80);
  });
wrap("miniUnsold",function(){ play("unsold",300); });
wrap("miniFinish",null,function(){ play("cheer",800); });

/* Mercado de pases */
wrap("acceptOffer",function(id){ return offerHuman(id); },function(h){ if(h) play("ok",150); });
wrap("rejectOffer",function(id){ return offerHuman(id); },function(h){ if(h) play("no",150); });

/* Cuenta regresiva de tu turno (últimos 3 segundos) */
var lastSec=null;
function countdown(){
  var el=document.getElementById("auctionTimer"); if(!el) return;
  var n=parseInt(el.textContent,10);
  if(isNaN(n)||n>3||n<=0){ if(n>3) lastSec=null; return; }
  if(n!==lastSec){ lastSec=n; play("beep"); }
}
wrap("turnTick",null,countdown);
wrap("freeTick",null,countdown);

/* Liga y partidos */
wrap("simulateMatchday",null,function(){ play("matchday",400); });
wrap("addFeedItem",function(run,f){
  if(!f) return;
  if(f.neutral){
    var tx=f.text||"";
    if(tx.indexOf("🏁")>=0) play("finalWhistle",600);
    else if(tx.indexOf("🥅")>=0) play("drum",600);
    else if(tx.indexOf("🔔")>=0||tx.indexOf("▶")>=0) play("whistle",300);
    else if(tx.indexOf("⏸")>=0||tx.indexOf("⏱")>=0) play("whistle2",300);
  } else if(f.pen){ play(f.scored?"penOk":"penMiss",250); }
  else if(f.isGoal){ play(f.agonic?"goalLate":"goal",350); }
  else play("chance",500);
});

/* Campeón */
wrap("showCelebration",null,function(){ play("fanfare"); });

window.chiquiSfx={ play:play, isMuted:function(){ return muted; }, setVolume:setVolume, getVolume:function(){ return vol; } };
})();
