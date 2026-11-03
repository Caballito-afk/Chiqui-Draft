/* Entrada (inicio y multijugador): flecha de cada tarjeta y onda al tocar.
   Solo decoración: no toca clics, estado ni lógica de juego. */
(function(){
  var CARDS="#screen-home .home-card, #screen-online .home-card";
  var BTNS="#screen-home .home-card, #screen-online .home-card, #screen-online .btn, #screen-home .home-back .btn";

  function arrow(btn){
    if(btn.querySelector(".ember-go")) return;
    var i=document.createElement("i");
    i.className="ember-go"; i.setAttribute("aria-hidden","true");
    btn.appendChild(i);
  }
  Array.prototype.forEach.call(document.querySelectorAll(CARDS),arrow);

  var reduce=window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
  document.addEventListener("pointerdown",function(e){
    if(reduce && reduce.matches) return;
    var t=e.target && e.target.closest ? e.target.closest(BTNS) : null;
    if(!t || t.disabled) return;
    var r=t.getBoundingClientRect(), s=document.createElement("span");
    s.className="ember-ripple";
    s.style.left=(e.clientX-r.left)+"px"; s.style.top=(e.clientY-r.top)+"px";
    t.appendChild(s);
    setTimeout(function(){ if(s.parentNode) s.parentNode.removeChild(s); },700);
  },{passive:true});
})();
