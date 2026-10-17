/* Personalización del club: color.
   Un solo selector que usan Local (ajustes), la sala del Multijugador y el Anotador.

   chiquiColorPicker({anchor, current, taken, onPick, onReset, title})
     · anchor   botón que lo abre (el selector se ubica junto a él y le devuelve el foco al cerrar)
     · current  color actual (hex)
     · taken    [{color, label}] colores que ya tienen otros equipos: se muestran apagados y no se pueden elegir
     · onPick(hex) se llama al elegir; si devuelve un texto, se muestra como aviso y el selector queda abierto
     · onReset()   si se pasa, aparece "Color original"
   Los colores propios se ajustan a un rango de luminosidad legible sobre fondo negro y blanco
   (el color del club se usa como texto en marcadores, subastas y festejos). */
(function(){
  var PALETTE=["#35d17c","#5b8def","#f0b90b","#e5484d","#a78bfa","#22d3ee","#fb923c","#f472b6",
               "#84cc16","#38bdf8","#f97316","#c084fc","#2dd4bf","#eab308","#f87171","#818cf8",
               "#d946ef","#14b8a6","#0ea5e9","#a3e635","#fbbf24","#fb7185","#94a3b8","#cbd5e1"];
  var LMIN=.40, LMAX=.72;

  function hexToRgb(h){ h=h.replace("#",""); return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]; }
  function rgbToHex(r,g,b){ return "#"+[r,g,b].map(function(v){ v=Math.max(0,Math.min(255,Math.round(v))); return (v<16?"0":"")+v.toString(16); }).join(""); }
  function toHsl(r,g,b){
    r/=255; g/=255; b/=255;
    var mx=Math.max(r,g,b), mn=Math.min(r,g,b), l=(mx+mn)/2, h=0, s=0, d=mx-mn;
    if(d){ s=l>.5?d/(2-mx-mn):d/(mx+mn);
      h = mx===r ? (g-b)/d+(g<b?6:0) : mx===g ? (b-r)/d+2 : (r-g)/d+4; h/=6; }
    return [h,s,l];
  }
  function fromHsl(h,s,l){
    function f(p,q,t){ if(t<0)t+=1; if(t>1)t-=1; if(t<1/6) return p+(q-p)*6*t; if(t<1/2) return q; if(t<2/3) return p+(q-p)*(2/3-t)*6; return p; }
    if(!s){ var v=l*255; return rgbToHex(v,v,v); }
    var q=l<.5?l*(1+s):l+s-l*s, p=2*l-q;
    return rgbToHex(f(p,q,h+1/3)*255,f(p,q,h)*255,f(p,q,h-1/3)*255);
  }
  /* "#RRGGBB" válido (o null) */
  function clean(hex){ hex=String(hex||"").trim(); if(/^#[0-9a-f]{3}$/i.test(hex)) hex="#"+hex[1]+hex[1]+hex[2]+hex[2]+hex[3]+hex[3]; return /^#[0-9a-f]{6}$/i.test(hex)?hex.toLowerCase():null; }
  /* Lleva el color a un rango legible sobre los dos temas */
  function readable(hex){
    hex=clean(hex); if(!hex) return null;
    var c=hexToRgb(hex), hsl=toHsl(c[0],c[1],c[2]);
    return fromHsl(hsl[0],hsl[1],Math.max(LMIN,Math.min(LMAX,hsl[2])));
  }
  /* Color de texto (negro o blanco) que se lee mejor sobre el color del club */
  window.chiquiColorInk=function(hex){
    hex=clean(hex); if(!hex) return "#0b0b0b";
    var c=hexToRgb(hex).map(function(v){ v/=255; return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4); });
    var L=.2126*c[0]+.7152*c[1]+.0722*c[2];
    return L>.30 ? "#0b0b0b" : "#ffffff";
  };
  window.CHIQUI_PALETTE=PALETTE;
  window.chiquiColorReadable=readable;
  window.chiquiColorClean=clean;
  /* Color guardado de "mi club" (se recuerda entre partidas en este dispositivo) */
  window.chiquiSavedColor=function(){ try{ return clean(localStorage.getItem("chiquidraft.miColor")); }catch(e){ return null; } };
  window.chiquiSaveColor=function(hex){ try{ if(hex) localStorage.setItem("chiquidraft.miColor",hex); else localStorage.removeItem("chiquidraft.miColor"); }catch(e){} };

  var pop=null, lastAnchor=null, offOutside=null, offKey=null;
  function onResize(){ close(false); }
  function close(restoreFocus){
    if(!pop) return;
    document.removeEventListener("pointerdown",offOutside,true); document.removeEventListener("keydown",offKey,true);
    window.removeEventListener("resize",onResize);
    pop.remove(); pop=null;
    if(restoreFocus && lastAnchor && document.body.contains(lastAnchor)) try{ lastAnchor.focus(); }catch(e){}
  }
  window.chiquiColorPickerClose=close;

  window.chiquiColorPicker=function(o){
    close(false);
    lastAnchor=o.anchor;
    var cur=clean(o.current), taken=(o.taken||[]).map(function(t){ return {color:clean(t.color),label:t.label}; });
    function takenBy(hex){ for(var i=0;i<taken.length;i++) if(taken[i].color===hex) return taken[i]; return null; }

    pop=document.createElement("div");
    pop.className="color-pop"; pop.setAttribute("role","dialog"); pop.setAttribute("aria-label",o.title||"Color del club");
    var head=document.createElement("div"); head.className="cp-head"; head.textContent=o.title||"Color del club"; pop.appendChild(head);
    var grid=document.createElement("div"); grid.className="cp-grid"; pop.appendChild(grid);
    var msg=document.createElement("div"); msg.className="cp-msg"; msg.setAttribute("aria-live","polite");

    function pick(hex){
      var r=o.onPick && o.onPick(hex);
      if(typeof r==="string" && r){ msg.textContent=r; return; }
      close(true);
    }
    PALETTE.forEach(function(hex){
      var b=document.createElement("button"); b.type="button"; b.className="cp-sw"; b.style.background=hex;
      var tk=takenBy(hex);
      b.setAttribute("aria-label",hex+(tk?" (en uso: "+tk.label+")":""));
      if(hex===cur){ b.classList.add("sel"); b.setAttribute("aria-pressed","true"); }
      if(tk && hex!==cur){ b.disabled=true; b.classList.add("used"); b.title="En uso: "+tk.label; }
      b.addEventListener("click",function(){ pick(hex); });
      grid.appendChild(b);
    });

    var foot=document.createElement("div"); foot.className="cp-foot"; pop.appendChild(foot);
    var lab=document.createElement("label"); lab.className="cp-custom";
    var inp=document.createElement("input"); inp.type="color"; inp.value=cur||"#35d17c"; inp.setAttribute("aria-label","Elegir otro color");
    var sp=document.createElement("span"); sp.textContent="Otro color";
    lab.appendChild(inp); lab.appendChild(sp); foot.appendChild(lab);
    inp.addEventListener("change",function(){
      var fixed=readable(inp.value), tk=takenBy(fixed);
      if(tk){ msg.textContent="Ese color ya lo usa "+tk.label+"."; return; }
      pick(fixed);
    });
    if(o.onReset){
      var rs=document.createElement("button"); rs.type="button"; rs.className="cp-reset"; rs.textContent="Color original";
      rs.addEventListener("click",function(){ o.onReset(); close(true); });
      foot.appendChild(rs);
    }
    var hint=document.createElement("div"); hint.className="cp-hint"; hint.textContent="Los colores muy claros u oscuros se ajustan para que se lean bien.";
    pop.appendChild(hint); pop.appendChild(msg);
    document.body.appendChild(pop);

    // ubicación junto al botón, sin salirse de la pantalla
    var r=o.anchor.getBoundingClientRect(), w=pop.offsetWidth, h=pop.offsetHeight, vw=document.documentElement.clientWidth, vh=window.innerHeight;
    var left=Math.max(8,Math.min(r.left,vw-w-8)), top=r.bottom+8;
    if(top+h>vh-8) top=Math.max(8,r.top-h-8);
    pop.style.left=left+"px"; pop.style.top=top+"px";

    offOutside=function(e){ if(pop && !pop.contains(e.target) && e.target!==o.anchor && !(o.anchor.contains&&o.anchor.contains(e.target))) close(false); };
    offKey=function(e){ if(e.key==="Escape"){ e.stopPropagation(); close(true); } };
    document.addEventListener("pointerdown",offOutside,true); document.addEventListener("keydown",offKey,true);
    window.addEventListener("resize",onResize);
    var first=grid.querySelector(".sel")||grid.querySelector(".cp-sw:not(:disabled)"); if(first) first.focus();
  };
})();
