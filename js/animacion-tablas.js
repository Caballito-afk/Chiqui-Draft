/* Animación de tablas de posiciones para los modos que reconstruyen o copian la tabla
   (grupos de Champions en modo local y pantalla espejada del multijugador).
   Es la misma animación que ya tenía el modo local:
     · cada fila se desliza desde su puesto anterior hasta el nuevo,
     · su color de zona (verde / dorado / rojo) cambia durante el recorrido,
     · los puntos "saltan" y aparece ▲/▼ con los puestos ganados o perdidos.
   Uso:  const s = chiquiRowsSnap(tbody);  ...cambiar la tabla...  chiquiRowsPlay(tbody, s);
   Todo se hace con la Web Animations API, así que sobrevive a que el multijugador reescriba
   las clases y los atributos de la fila en cada actualización. */
(function(){
  var ZONES=["q-zone","q-clinched","q-last","q-third"];
  var EASE="cubic-bezier(.22,.9,.25,1)";

  function zoneOf(tr){ for(var i=0;i<ZONES.length;i++) if(tr.classList.contains(ZONES[i])) return ZONES[i]; return ""; }
  function rowsOf(tbody){
    return Array.prototype.filter.call(tbody.rows,function(tr){ return !tr.classList.contains("grp-head") && tr.querySelector(".team-cell"); });
  }
  function keyOf(tr){
    return tr.querySelector(".team-cell").textContent.replace(/\s+/g," ").replace(/\s*TÚ$/,"").trim();
  }
  function numOf(el){ var n=parseInt(el&&el.textContent,10); return isNaN(n)?0:n; }
  function reduced(){ return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); }

  /* Foto de la tabla antes del cambio. Devuelve null si no hay nada que animar (tabla vacía u oculta). */
  window.chiquiRowsSnap=function(tbody){
    if(!tbody || !tbody.offsetWidth) return null;
    var rows=rowsOf(tbody); if(!rows.length) return null;
    var base=tbody.getBoundingClientRect().top, m={};
    rows.forEach(function(tr){
      var rk=tr.querySelector(".rank-num"), pc=tr.querySelector("td.pts");
      m[keyOf(tr)]={top:tr.getBoundingClientRect().top-base, rank:numOf(rk), pts:pc?numOf(pc):0, zone:zoneOf(tr)};
    });
    return m;
  };

  /* Reproduce la animación comparando contra la foto anterior. */
  window.chiquiRowsPlay=function(tbody, snap){
    if(!snap || !tbody || !tbody.offsetWidth) return;
    var rows=rowsOf(tbody); if(!rows.length) return;
    // Si algún equipo perdió puntos es un torneo nuevo: se muestra la tabla sin animar.
    for(var i=0;i<rows.length;i++){
      var o=snap[keyOf(rows[i])], pc=rows[i].querySelector("td.pts");
      if(o && pc && numOf(pc)<o.pts) return;
    }
    var base=tbody.getBoundingClientRect().top, reduce=reduced(), moved=false;
    // aspecto (fondo y franja) que tendría la fila con una zona determinada
    function look(tr,zone){
      var cur=zoneOf(tr);
      if(cur) tr.classList.remove(cur);
      if(zone) tr.classList.add(zone);
      var cs=getComputedStyle(tr), r={backgroundColor:cs.backgroundColor, boxShadow:cs.boxShadow};
      if(zone) tr.classList.remove(zone);
      if(cur) tr.classList.add(cur);
      return r;
    }
    rows.forEach(function(tr){
      var o=snap[keyOf(tr)]; if(!o) return;
      var rk=tr.querySelector(".rank-num"), pc=tr.querySelector("td.pts");
      var diff=o.rank-numOf(rk); // >0 sube, <0 baja
      if(pc && numOf(pc)!==o.pts && pc.animate && !reduce){
        pc.animate([{transform:"scale(1)"},{transform:"scale(1.55)",color:"var(--grass)",offset:.35},{transform:"scale(1)"}],{duration:900,easing:"ease-out"});
      }
      var zNow=zoneOf(tr), zPrev=o.zone;
      if(diff===0 && zNow===zPrev) return;
      var k0={}, k1={};
      if(diff!==0){
        moved=true;
        if(rk){
          var d=document.createElement("span");
          d.className="rk-delta "+(diff>0?"up":"down");
          d.setAttribute("data-keep","1");
          d.textContent=(diff>0?"▲":"▼")+Math.abs(diff);
          rk.after(d);
          setTimeout(function(){ if(d.parentNode) d.parentNode.removeChild(d); },2700);
        }
        if(!reduce){
          var dy=(o.top+base)-tr.getBoundingClientRect().top;
          if(dy){ k0.transform="translateY("+dy+"px)"; k1.transform="translateY(0)"; tr.classList.add("moving"); }
        }
      }
      if(zNow!==zPrev){ Object.assign(k0,look(tr,zPrev)); Object.assign(k1,look(tr,zNow)); }
      if(tr.animate && Object.keys(k0).length){
        var a=tr.animate([k0,k1],{duration:900,easing:EASE});
        a.onfinish=a.oncancel=function(){ tr.classList.remove("moving"); };
      }
    });
    if(moved && window.chiquiSfx){ try{ window.chiquiSfx.play("rank",300); }catch(e){} }
  };

  /* Para el multijugador: foto y reproducción de todas las tablas de posiciones dentro de un contenedor. */
  window.chiquiTablesSnap=function(root){
    if(!root) return [];
    return Array.prototype.map.call(root.querySelectorAll("#standingsTable tbody"),function(tb){ return window.chiquiRowsSnap(tb); });
  };
  window.chiquiTablesPlay=function(root, snaps){
    if(!root || !snaps || !snaps.length) return;
    var tbs=root.querySelectorAll("#standingsTable tbody");
    snaps.forEach(function(s,i){ if(s && tbs[i]) window.chiquiRowsPlay(tbs[i],s); });
  };
})();
