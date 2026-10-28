/* Configuración de partida (Local, Multijugador y Anotador): solo presentación.
   · Debajo de cada grupo de opciones muestra UNA explicación: la de la opción elegida.
     Lee el texto que ya existe en cada opción (.d), así que no se duplica nada ni se pierde.
   · Arma el resumen de lo elegido que va junto al botón de empezar.
   · Hace "saltar" el número cuando se cambia la cantidad de equipos.
   No toca ids, clics ni estado del juego. */
(function(){
  var IDS=["screen-settings","screen-anotador-setup"];
  var skipSummary={timeCard:1,infoCard:1,passCard:1,skipCard:1,botLevelCard:1,budgetCard:1};
  var lastCount={};
  var raf=0;

  function txt(el){ return ((el&&el.textContent)||"").replace(/\s+/g," ").trim(); }
  function shown(el){ return !!el && el.offsetParent!==null; }

  function hints(root){
    Array.prototype.forEach.call(root.querySelectorAll(".mode-options"),function(g){
      var sel=g.querySelector(".opt-card.sel"), t=txt(sel&&sel.querySelector(".d"));
      var h=g.nextElementSibling, has=!!(h&&h.classList.contains("opt-hint"));
      // si la fila ya tiene una nota con el mismo texto, no se repite
      var dup=false;
      if(t){ Array.prototype.forEach.call(g.parentNode.querySelectorAll('[id$="Note"]'),function(n){ if(txt(n)===t) dup=true; }); }
      if(!t||dup){ if(has) h.parentNode.removeChild(h); return; }
      if(!has){ h=document.createElement("div"); h.className="opt-hint"; h.setAttribute("aria-live","polite"); g.parentNode.insertBefore(h,g.nextSibling); }
      if(h.textContent!==t){
        h.textContent=t;
        if(has){ h.classList.remove("flash"); void h.offsetWidth; h.classList.add("flash"); }
      }
    });
  }

  function summary(root){
    var bar=root.id==="screen-settings" ? root.querySelector(":scope > .btn-row:last-child") : root.querySelector(":scope > .an-row");
    if(!bar) return;
    var chips=[], unit=root.id==="screen-settings" ? " participantes" : " equipos";
    Array.prototype.forEach.call(root.querySelectorAll(":scope > .card"),function(card){
      if(!shown(card) || card.classList.contains("mode-banner") || card.classList.contains("an-saved")) return;
      if(card.id==="onlineRoomCard"){
        var a=txt(root.querySelector("#onlMinVal")), b=txt(root.querySelector("#onlMaxVal"));
        if(a&&b) chips.push(a+"–"+b+" equipos en la sala");
        return;
      }
      var cr=card.querySelector(".count-row");
      if(cr){ var v=txt(cr.querySelector(".count-val")); if(v) chips.push(v+unit); return; }
      if(skipSummary[card.id]) return;
      var g=card.querySelector(".mode-options"), s=g&&g.querySelector(".opt-card.sel .t");
      if(s&&txt(s)) chips.push(txt(s));
    });
    var box=bar.querySelector(".cfg-summary");
    if(!chips.length){ if(box) box.parentNode.removeChild(box); return; }
    if(!box){ box=document.createElement("div"); box.className="cfg-summary"; box.setAttribute("aria-label","Resumen de la partida"); bar.insertBefore(box,bar.firstChild); }
    var key=chips.join("|");
    if(box.dataset.s===key) return;
    box.dataset.s=key; box.innerHTML="";
    chips.forEach(function(c){ var e=document.createElement("span"); e.className="cfg-chip"; e.textContent=c; box.appendChild(e); });
  }

  function bumps(root){
    Array.prototype.forEach.call(root.querySelectorAll(".count-val"),function(el,i){
      var k=root.id+":"+i, t=txt(el);
      if(lastCount[k]!==undefined && lastCount[k]!==t){ el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }
      lastCount[k]=t;
    });
  }

  function run(){
    raf=0;
    IDS.forEach(function(id){
      var r=document.getElementById(id); if(!r) return;
      hints(r); summary(r); bumps(r);
    });
  }
  function schedule(){ if(!raf) raf=requestAnimationFrame(run); }

  IDS.forEach(function(id){
    var r=document.getElementById(id); if(!r) return;
    new MutationObserver(schedule).observe(r,{subtree:true,childList:true,attributes:true,attributeFilter:["class","style"],characterData:true});
  });
  schedule();
})();
