/* Líneas que unen los cruces del cuadro de eliminatorias (Local, Multijugador y Anotador).

   Antes cada tarjeta dibujaba su pedazo de línea con CSS suponiendo que todas las filas medían lo mismo.
   Cuando un cruce era más alto que su vecino (resultado de ida y vuelta, nota de penales, botón de
   "ver jugadas", penales por cargar en el Anotador…) las piezas dejaban de encontrarse y la línea quedaba
   corrida. Ahora se mide la posición real de cada tarjeta y se traza un conector de la salida del cruce
   hasta la entrada del siguiente, así que siempre coincide.

   Cómo se usa: el contenedor tiene celdas  .bk-cell[data-r][data-s]  (ronda y lugar). Una celda con
   data-next="1" se une con la celda (r+1, s>>1). La celda se considera decidida con data-done="1" o si
   contiene un elemento .decided. Los conectores decididos van llenos y los pendientes en punteado;
   cuando un cruce se decide, su línea se dibuja con una animación corta.
   El SVG va como ÚLTIMO hijo (y con data-keep) para no correr los índices que usa el multijugador. */
(function(){
  var NS="http://www.w3.org/2000/svg";
  var seen={};   // por ámbito: conectores que ya se mostraron decididos (solo se animan los nuevos)
  var first={};  // por ámbito: ya hubo un primer dibujo (el primero nunca anima)
  var running={};// por ámbito: animaciones de dibujo en curso {clave: instante de inicio}
  var DUR=750;   // ms, igual que en css/21-llaves.css

  function reduced(){ return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); }
  function el(name,attrs){
    var n=document.createElementNS(NS,name);
    for(var k in attrs) n.setAttribute(k,attrs[k]);
    return n;
  }

  function draw(grid,scope){
    var box=grid.getBoundingClientRect();
    if(!box.width || !box.height) return;       // oculto: se dibuja cuando aparezca (lo avisa el ResizeObserver)
    var svg=grid._bkSvg;
    if(!svg || svg.parentNode!==grid){
      svg=el("svg",{"class":"bk-lines","aria-hidden":"true","data-keep":"1"});
      grid.appendChild(svg); grid._bkSvg=svg;
    } else if(svg!==grid.lastElementChild){ grid.appendChild(svg); }
    while(svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute("width",box.width); svg.setAttribute("height",box.height);
    svg.setAttribute("viewBox","0 0 "+box.width+" "+box.height);

    var cells={}, list=Array.prototype.slice.call(grid.querySelectorAll(".bk-cell[data-r]"));
    list.forEach(function(c){ cells[c.dataset.r+"-"+c.dataset.s]=c; });
    var seenS=seen[scope]||(seen[scope]={}), run=running[scope]||(running[scope]={}), animate=!!first[scope] && !reduced();

    list.forEach(function(c){
      if(c.dataset.next!=="1") return;
      var r=+c.dataset.r, s=+c.dataset.s, nx=cells[(r+1)+"-"+(s>>1)];
      var a=c.firstElementChild, b=nx && nx.firstElementChild;
      if(!a || !b) return;
      var ra=a.getBoundingClientRect(), rb=b.getBoundingClientRect();
      var x1=ra.right-box.left, y1=ra.top+ra.height/2-box.top;
      var x2=rb.left-box.left,  y2=rb.top+rb.height/2-box.top;
      if(x2-x1<8) return;
      var xm=x1+(x2-x1)/2, dy=y2-y1, d;
      if(Math.abs(dy)<1){ d="M"+x1+" "+y1+"H"+x2; }
      else{
        var q=Math.min(12,Math.abs(dy)/2,(x2-x1)/2-1), sg=dy>0?1:-1;
        d="M"+x1+" "+y1+"H"+(xm-q)+"Q"+xm+" "+y1+" "+xm+" "+(y1+sg*q)+"V"+(y2-sg*q)+"Q"+xm+" "+y2+" "+(xm+q)+" "+y2+"H"+x2;
      }
      var done=c.dataset.done==="1" || !!c.querySelector(".decided");
      var key=r+"-"+s, fresh=done && !seenS[key];
      if(done) seenS[key]=true; else { delete seenS[key]; delete run[key]; }
      if(fresh && animate) run[key]=performance.now();
      // Si el cuadro se redibuja mientras la línea todavía se está trazando (otro cruce cambió de tamaño,
      // entró un nombre en la ronda siguiente…), la animación continúa desde donde iba en lugar de cortarse.
      var elapsed = run[key]!==undefined ? performance.now()-run[key] : -1;
      if(elapsed>=DUR){ delete run[key]; elapsed=-1; }
      var anim = done && elapsed>=0;
      var p=el("path",{"d":d,"class":"bk-ln"+(done?" done":"")});
      if(anim){
        p.setAttribute("pathLength","1"); p.setAttribute("class","bk-ln done draw");
        p.style.animationDelay=(-elapsed)+"ms";
      }
      svg.appendChild(p);
      if(done){
        var dot=el("circle",{"cx":x1,"cy":y1,"r":3.5,"class":"bk-dot"+(anim?" pop":"")});
        if(anim) dot.style.animationDelay=(-elapsed)+"ms";
        svg.appendChild(dot);
      }
    });
    first[scope]=true;
  }

  /* Dibuja y se mantiene al día: tamaños (ResizeObserver), cambios de estado (MutationObserver) y fuentes */
  window.chiquiBracketLines=function(grid,scope){
    if(!grid) return;
    scope=scope||"po";
    var raf=0;
    function again(){ if(raf) return; raf=requestAnimationFrame(function(){ raf=0; draw(grid,scope); }); }
    grid._bkAgain=again;
    if(!grid._bkWatch){
      grid._bkWatch=true;
      if(window.ResizeObserver){
        var ro=new ResizeObserver(again);
        ro.observe(grid);
        Array.prototype.forEach.call(grid.querySelectorAll(".bk-cell"),function(c){ if(c.firstElementChild) ro.observe(c.firstElementChild); });
        grid._bkRo=ro;
      }
      if(window.MutationObserver){
        new MutationObserver(function(muts){
          for(var i=0;i<muts.length;i++){ if(muts[i].target.closest && muts[i].target.closest(".bk-lines")) continue; again(); return; }
        }).observe(grid,{subtree:true,childList:true,attributes:true,attributeFilter:["class","data-done"]});
      }
      if(document.fonts && document.fonts.ready) document.fonts.ready.then(again);
    } else if(grid._bkRo){
      Array.prototype.forEach.call(grid.querySelectorAll(".bk-cell"),function(c){ if(c.firstElementChild) grid._bkRo.observe(c.firstElementChild); });
    }
    draw(grid,scope);
    again();
  };

  /* El multijugador copia la pantalla del anfitrión sin las líneas: cada cliente las dibuja con sus propias medidas */
  window.chiquiBracketsRedraw=function(root){
    if(!root) return;
    Array.prototype.forEach.call(root.querySelectorAll(".bk-grid"),function(g){ window.chiquiBracketLines(g,"po"); });
  };
})();
