/* Personalización del club: color principal, color secundario, estadio y escudo (PNG).
   Todo se edita en un solo lugar: el editor del club, que se abre desde el número/color de cada equipo
   (Local, sala del Multijugador y Anotador) y se muestra directo junto al nombre del club al entrar a una sala.

   Datos de un club:  { color, color2, stadium, crest }
     color     principal, "#rrggbb". Se usa como texto en marcadores y subastas, por eso se ajusta a un rango legible.
     color2    secundario, "#rrggbb" o null. Solo se usa como relleno (mitad del punto de color), así que no se ajusta.
     stadium   nombre del estadio. Vacío = "<Nombre del equipo>'s Stadium".
     crest     escudo PNG como data URL (solo Multijugador).

   chiquiClubPopover({anchor, club, defaultStadium, taken, fields, title, onChange, onReset})
     fields: lista con "color", "color2", "stadium", "crest" (lo que se puede editar en ese lugar)
     onChange(club) se llama con cada cambio; si devuelve un texto se muestra como aviso (ej. color repetido). */
(function(){
  var PALETTE=["#35d17c","#5b8def","#f0b90b","#e5484d","#a78bfa","#22d3ee","#fb923c","#f472b6",
               "#84cc16","#38bdf8","#f97316","#c084fc","#2dd4bf","#eab308","#f87171","#818cf8",
               "#d946ef","#14b8a6","#0ea5e9","#a3e635","#fbbf24","#fb7185","#94a3b8","#cbd5e1"];
  var SEC_PALETTE=["#ffffff","#0b0b0b"].concat(PALETTE.slice(0,22));
  var LMIN=.40, LMAX=.72;
  var CREST_MAX=70000;           // largo máximo del data URL del escudo (el servidor aplica el mismo límite)
  var STADIUM_MAX=60;

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
  function clean(hex){ hex=String(hex||"").trim(); if(/^#[0-9a-f]{3}$/i.test(hex)) hex="#"+hex[1]+hex[1]+hex[2]+hex[2]+hex[3]+hex[3]; return /^#[0-9a-f]{6}$/i.test(hex)?hex.toLowerCase():null; }
  function readable(hex){
    hex=clean(hex); if(!hex) return null;
    var c=hexToRgb(hex), hsl=toHsl(c[0],c[1],c[2]);
    return fromHsl(hsl[0],hsl[1],Math.max(LMIN,Math.min(LMAX,hsl[2])));
  }
  window.CHIQUI_PALETTE=PALETTE;
  window.chiquiColorReadable=readable;
  window.chiquiColorClean=clean;
  /* Color de texto (negro o blanco) que se lee mejor sobre un color */
  window.chiquiColorInk=function(hex){
    hex=clean(hex); if(!hex) return "#0b0b0b";
    var c=hexToRgb(hex).map(function(v){ v/=255; return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4); });
    return (.2126*c[0]+.7152*c[1]+.0722*c[2])>.30 ? "#0b0b0b" : "#ffffff";
  };

  /* ---------- Presentación del club ---------- */
  /* fondo del punto/etiqueta del club: un color, o dos mitades si hay color secundario */
  window.chiquiDotBg=function(c1,c2){
    c1=clean(c1)||"#888888"; c2=clean(c2);
    return c2 ? "linear-gradient(135deg,"+c1+" 50%,"+c2+" 50%)" : c1;
  };
  /* ---------- Clubes de fábrica: estadio y colores de los 16 equipos que vienen por defecto ---------- */
  var AZ="#2f67d8", AM="#f5c400", BL="#c9ccd1", RO="#e0383d", CE="#5cc8f0", GR="#a3274f", VE="#2fa84f", NE="#0e0e10";
  var CLUBES=[
    ["Boca Juniors","La Bombonera",AZ,AM],
    ["River Plate","El Monumental",BL,RO],
    ["Independiente","Libertadores de América",RO,BL],
    ["Racing Club","El Cilindro",CE,BL],
    ["San Lorenzo","Nuevo Gasómetro",AZ,RO],
    ["Estudiantes de La Plata","UNO",RO,BL],
    ["Vélez Sarsfield","José Amalfitani",BL,AZ],
    ["Rosario Central","Gigante de Arroyito",AM,AZ],
    ["Newell's Old Boys","El Coloso del Parque",RO,NE],
    ["Talleres de Córdoba","Mario Alberto Kempes",AZ,BL],
    ["Belgrano de Córdoba","Gigante de Alberdi",CE,BL],
    ["Lanús","La Fortaleza",GR,BL],
    ["Argentinos Juniors","Diego Armando Maradona",RO,BL],
    ["Huracán","Tomás Adolfo Ducó",BL,RO],
    ["Defensa y Justicia","Norberto Tomaghello",VE,AM],
    ["Gimnasia y Esgrima La Plata","El Bosque",BL,AZ]
  ];
  function norm(n){ return String(n||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim(); }
  var PRESETS={};
  CLUBES.forEach(function(c){ PRESETS[norm(c[0])]={ name:c[0], s:c[1], c:c[2], c2:c[3] }; });
  /* Devuelve {s, c, c2} si el nombre es uno de los clubes de fábrica (sin importar mayúsculas ni tildes), o null */
  window.chiquiClubPreset=function(name){ return PRESETS[norm(name)]||null; };

  /* nombre del estadio (el elegido, o "<Equipo>'s Stadium") */
  window.chiquiStadium=function(t){
    var s=String((t&&t.stadium)||"").trim();
    return s || String((t&&t.name)||"Equipo")+"'s Stadium";
  };

  /* Escudos: cada cliente guarda los escudos de la sala y los aplica con una hoja de estilos.
     El HTML solo lleva data-crest="<clave>", así las pantallas copiadas al invitado pesan lo mismo. */
  var crests={}, crestStyle=null;
  function safeKey(k){ return String(k).replace(/[^0-9A-Za-z_-]/g,""); }
  window.chiquiSetCrests=function(map){
    crests={};
    Object.keys(map||{}).forEach(function(k){
      var v=map[k];
      if(typeof v==="string" && /^data:image\/png;base64,[A-Za-z0-9+\/=]+$/.test(v) && v.length<=CREST_MAX) crests[safeKey(k)]=v;
    });
    if(!crestStyle){ crestStyle=document.createElement("style"); crestStyle.id="crestStyles"; document.head.appendChild(crestStyle); }
    crestStyle.textContent=Object.keys(crests).map(function(k){
      return '[data-crest="'+k+'"]{background-image:url("'+crests[k]+'") !important;}';
    }).join("\n");
  };
  window.chiquiCrestOf=function(key){ return crests[safeKey(key)]||null; };
  /* atributo / elemento del escudo de un equipo (vacío si no tiene): se usa en partidos, cruces, puja, etc. */
  window.chiquiCrestAttr=function(t){
    return (t && t.crestKey!=null && crests[safeKey(t.crestKey)]) ? ' data-crest="'+safeKey(t.crestKey)+'"' : "";
  };
  window.chiquiCrestHtml=function(t,cls){
    var a=window.chiquiCrestAttr(t);
    return a ? '<span class="crest '+(cls||"")+'"'+a+'></span>' : "";
  };
  /* punto de color de un equipo (con escudo si lo tiene): tablas, subasta, mercado, etc. */
  window.chiquiDotHtml=function(t){
    var ck=(t && t.crestKey!=null && crests[safeKey(t.crestKey)]) ? ' data-crest="'+safeKey(t.crestKey)+'"' : "";
    return '<span class="dot"'+ck+' style="background:'+window.chiquiDotBg(t&&t.color,t&&t.color2)+'"></span>';
  };

  /* ---------- Escudo armado dentro del juego: forma + diseño + símbolo ----------
     Se dibuja con los colores del club (principal y secundario) y se convierte a PNG chico,
     así viaja por el mismo camino que un PNG subido: no hace falta tener ningún archivo. */
  var SHAPES=[
    {id:"shield", label:"Escudo", d:"M50 4 L92 15 V50 C92 75 72 91 50 98 C28 91 8 75 8 50 V15 Z"},
    {id:"round",  label:"Redondo", d:"M50 4 A46 46 0 1 1 49.9 4 Z"},
    {id:"diamond",label:"Rombo", d:"M50 3 L97 50 L50 97 L3 50 Z"},
    {id:"hex",    label:"Hexágono", d:"M50 3 L91 26 V74 L50 97 L9 74 V26 Z"},
    {id:"pennant",label:"Banderín", d:"M8 6 H92 V58 L50 97 L8 58 Z"},
    {id:"square", label:"Cuadrado", d:"M20 6 H80 Q94 6 94 20 V80 Q94 94 80 94 H20 Q6 94 6 80 V20 Q6 6 20 6 Z"}
  ];
  var PATTERNS=[
    {id:"solid",   label:"Liso"},
    {id:"halves",  label:"Mitades"},
    {id:"stripes", label:"Franjas"},
    {id:"band",    label:"Banda"},
    {id:"diag",    label:"Diagonal"}
  ];
  var SYMBOLS=[
    {id:"none",    label:"Nada"},
    {id:"initial", label:"Inicial"},
    {id:"star",    label:"Estrella"},
    {id:"bolt",    label:"Rayo"},
    {id:"crown",   label:"Corona"},
    {id:"ball",    label:"Balón"}
  ];
  function inList(list,id){ for(var i=0;i<list.length;i++) if(list[i].id===id) return true; return false; }
  window.chiquiCrestSpecClean=function(sp){
    if(!sp || typeof sp!=="object") return null;
    return { shape:inList(SHAPES,sp.shape)?sp.shape:"shield", pattern:inList(PATTERNS,sp.pattern)?sp.pattern:"halves", symbol:inList(SYMBOLS,sp.symbol)?sp.symbol:"none" };
  };
  function crestSvg(sp,c1,c2,initial){
    var shape=SHAPES.filter(function(x){ return x.id===sp.shape; })[0]||SHAPES[0];
    var a=clean(c1)||"#5b8def", b=clean(c2)||"#ffffff", out='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="128" height="128">';
    out+='<defs><clipPath id="k"><path d="'+shape.d+'"/></clipPath></defs><g clip-path="url(#k)"><rect width="100" height="100" fill="'+a+'"/>';
    if(sp.pattern==="halves")  out+='<rect x="50" width="50" height="100" fill="'+b+'"/>';
    if(sp.pattern==="stripes") out+='<rect x="20" width="20" height="100" fill="'+b+'"/><rect x="60" width="20" height="100" fill="'+b+'"/>';
    if(sp.pattern==="band")    out+='<rect y="36" width="100" height="28" fill="'+b+'"/>';
    if(sp.pattern==="diag")    out+='<polygon points="0,100 0,68 68,0 100,0 100,32 32,100" fill="'+b+'"/>';
    out+='</g><path d="'+shape.d+'" fill="none" stroke="#0b0b0b" stroke-width="5" stroke-linejoin="round"/>';
    var st=' fill="#ffffff" stroke="#0b0b0b" stroke-width="3" stroke-linejoin="round" paint-order="stroke"';
    if(sp.symbol==="star"){
      var pts=[]; for(var i=0;i<10;i++){ var r=i%2?10:24, an=-Math.PI/2+i*Math.PI/5; pts.push((50+r*Math.cos(an)).toFixed(1)+","+(52+r*Math.sin(an)).toFixed(1)); }
      out+='<polygon points="'+pts.join(" ")+'"'+st+'/>';
    } else if(sp.symbol==="bolt"){
      out+='<polygon points="56,26 38,56 49,56 43,78 64,46 52,46"'+st+'/>';
    } else if(sp.symbol==="crown"){
      out+='<path d="M30 68 L28 38 L41 52 L50 34 L59 52 L72 38 L70 68 Z"'+st+'/>';
    } else if(sp.symbol==="ball"){
      out+='<circle cx="50" cy="52" r="22"'+st+'/><polygon points="50,42 59,48 56,59 44,59 41,48" fill="#0b0b0b"/>';
    } else if(sp.symbol==="initial"){
      var ch=String(initial||"").trim().charAt(0).toUpperCase().replace(/[<>&"]/g,"")||"C";
      out+='<text x="50" y="68" text-anchor="middle" font-family="Jost,Inter,Arial,sans-serif" font-weight="800" font-size="46"'+st+'>'+ch+'</text>';
    }
    return out+'</svg>';
  }
  window.chiquiCrestFromSpec=function(spec,c1,c2,initial){
    return new Promise(function(resolve,reject){
      var sp=window.chiquiCrestSpecClean(spec); if(!sp) return reject("Sin diseño.");
      var img=new Image();
      img.onerror=function(){ reject("No se pudo dibujar el escudo."); };
      img.onload=function(){
        var cv=document.createElement("canvas"); cv.width=128; cv.height=128;
        cv.getContext("2d").drawImage(img,0,0,128,128);
        var url=cv.toDataURL("image/png");
        url.length<=CREST_MAX ? resolve(url) : reject("El escudo quedó demasiado pesado.");
      };
      img.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(crestSvg(sp,c1,c2,initial));
    });
  };
  window.CHIQUI_CREST_OPTS={shapes:SHAPES,patterns:PATTERNS,symbols:SYMBOLS};

  /* ---------- Escudo: archivo PNG -> data URL liviano ---------- */
  window.chiquiCrestFromFile=function(file){
    return new Promise(function(resolve,reject){
      if(!file) return reject("No elegiste ningún archivo.");
      if(!(file.type==="image/png" || /\.png$/i.test(file.name||""))) return reject("El escudo tiene que ser un archivo PNG.");
      if(file.size>4*1024*1024) return reject("El archivo pesa demasiado (máximo 4 MB).");
      var fr=new FileReader();
      fr.onerror=function(){ reject("No se pudo leer el archivo."); };
      fr.onload=function(){
        if(!/^data:image\/png/.test(String(fr.result))) return reject("Ese archivo no es un PNG.");
        var img=new Image();
        img.onerror=function(){ reject("No se pudo abrir la imagen: probá con otro PNG."); };
        img.onload=function(){
          var sizes=[128,96,64];
          for(var i=0;i<sizes.length;i++){
            var n=sizes[i], cv=document.createElement("canvas"); cv.width=n; cv.height=n;
            var cx=cv.getContext("2d"), k=Math.min(n/img.width,n/img.height), w=img.width*k, h=img.height*k;
            cx.clearRect(0,0,n,n); cx.drawImage(img,(n-w)/2,(n-h)/2,w,h);
            var url=cv.toDataURL("image/png");
            if(url.length<=CREST_MAX) return resolve(url);
          }
          reject("El escudo es demasiado detallado: probá con una versión más simple.");
        };
        img.src=fr.result;
      };
      fr.readAsDataURL(file);
    });
  };

  /* ---------- Guardado del club propio (Multijugador) ---------- */
  window.chiquiSavedClub=function(){
    try{
      var o=JSON.parse(localStorage.getItem("chiquidraft.miClub")||"null"); if(!o) return null;
      return { color:clean(o.color), color2:clean(o.color2), stadium:String(o.stadium||"").slice(0,STADIUM_MAX),
               crest:(typeof o.crest==="string" && /^data:image\/png;base64,/.test(o.crest) && o.crest.length<=CREST_MAX)?o.crest:null,
               crestSpec:window.chiquiCrestSpecClean(o.crestSpec) };
    }catch(e){ return null; }
  };
  window.chiquiSaveClub=function(c){
    try{ if(c) localStorage.setItem("chiquidraft.miClub",JSON.stringify(c)); else localStorage.removeItem("chiquidraft.miClub"); }catch(e){}
  };

  /* ---------- Editor del club ---------- */
  function el(tag,cls,txt){ var e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e; }

  function swatchGrid(palette,selected,isTaken,pick,withNone){
    var g=el("div","cp-grid"), btns=[];
    function mark(cur){ btns.forEach(function(b){ var on=(b.dataset.v||null)===(cur||null); b.classList.toggle("sel",on); if(on) b.setAttribute("aria-pressed","true"); else b.removeAttribute("aria-pressed"); }); }
    if(withNone){
      var n=el("button","cp-sw cp-none"); n.type="button"; n.setAttribute("aria-label","Sin color secundario"); n.title="Sin color secundario";
      n.addEventListener("click",function(){ pick(null); mark(null); });
      g.appendChild(n); btns.push(n);
    }
    palette.forEach(function(hex){
      var b=el("button","cp-sw"); b.type="button"; b.style.background=hex; b.dataset.v=hex;
      var tk=isTaken&&isTaken(hex);
      b.setAttribute("aria-label",hex+(tk?" (en uso: "+tk.label+")":""));
      if(hex==="#ffffff") b.classList.add("cp-light");
      if(tk && hex!==selected){ b.disabled=true; b.classList.add("used"); b.title="En uso: "+tk.label; }
      b.addEventListener("click",function(){ pick(hex); mark(hex); });
      g.appendChild(b); btns.push(b);
    });
    mark(selected);
    g.mark=mark;
    return g;
  }
  function customPicker(label,value,onPick,fix){
    var lab=el("label","cp-custom"), inp=el("input"); inp.type="color"; inp.value=clean(value)||"#35d17c"; inp.setAttribute("aria-label",label);
    lab.appendChild(inp); lab.appendChild(el("span",null,label));
    inp.addEventListener("change",function(){ onPick(fix?fix(inp.value):clean(inp.value)); });
    return lab;
  }

  /* Construye el editor. Devuelve el elemento; o.onChange(club) se llama con cada cambio. */
  window.chiquiClubEditor=function(o){
    var f=o.fields||["color"], has=function(k){ return f.indexOf(k)>=0; };
    var club={ color:clean(o.club&&o.club.color), color2:clean(o.club&&o.club.color2), stadium:String((o.club&&o.club.stadium)||""), crest:(o.club&&o.club.crest)||null, crestSpec:window.chiquiCrestSpecClean(o.club&&o.club.crestSpec) };
    var taken=(o.taken||[]).map(function(t){ return {color:clean(t.color),label:t.label}; });
    function takenBy(h){ for(var i=0;i<taken.length;i++) if(taken[i].color===h) return taken[i]; return null; }
    var root=el("div","club-ed"), msg=el("div","cp-msg"); msg.setAttribute("aria-live","polite");
    var regenCrest=null;   // lo define la sección de escudo (si existe)
    function emit(){
      var r=o.onChange && o.onChange({color:club.color,color2:club.color2,stadium:club.stadium,crest:club.crest,crestSpec:club.crestSpec});
      msg.textContent=(typeof r==="string")?r:"";
      // el escudo armado en el juego usa los colores del club: si cambian, se vuelve a dibujar
      if(regenCrest && club.crestSpec && !emit._busy){ regenCrest(); }
      return r;
    }

    if(has("color")){
      root.appendChild(el("div","cp-sec","Color principal"));
      var g1=swatchGrid(PALETTE,club.color,takenBy,function(hex){
        var prev=club.color; club.color=hex; var r=emit();
        if(typeof r==="string"){ club.color=prev; g1.mark(prev); }
      },false);
      root.appendChild(g1);
      var foot1=el("div","cp-foot");
      foot1.appendChild(customPicker("Otro color",club.color,function(hex){
        var tk=takenBy(hex); if(tk){ msg.textContent="Ese color ya lo usa "+tk.label+"."; return; }
        var prev=club.color; club.color=hex; var r=emit(); if(typeof r==="string"){ club.color=prev; } else g1.mark(hex);
      },readable));
      if(o.onReset){
        var rs=el("button","cp-reset","Color original"); rs.type="button";
        rs.addEventListener("click",function(){ club.color=null; o.onReset(); emit(); g1.mark(null); });
        foot1.appendChild(rs);
      }
      root.appendChild(foot1);
      root.appendChild(el("div","cp-hint","Los colores muy claros u oscuros se ajustan para que se lean bien."));
    }
    if(has("color2")){
      root.appendChild(el("div","cp-sec","Color secundario"));
      var g2=swatchGrid(SEC_PALETTE,club.color2,null,function(hex){ club.color2=hex; emit(); },true);
      root.appendChild(g2);
      var foot2=el("div","cp-foot");
      foot2.appendChild(customPicker("Otro color",club.color2,function(hex){ club.color2=hex; emit(); g2.mark(hex); }));
      root.appendChild(foot2);
    }
    if(has("stadium")){
      root.appendChild(el("div","cp-sec","Estadio"));
      var si=el("input","cp-input"); si.type="text"; si.maxLength=STADIUM_MAX; si.value=club.stadium;
      si.placeholder=o.defaultStadium||"Nombre del estadio"; si.setAttribute("aria-label","Nombre del estadio");
      var tm=0;
      si.addEventListener("input",function(){ club.stadium=si.value; clearTimeout(tm); tm=setTimeout(emit,250); });
      si.addEventListener("blur",function(){ clearTimeout(tm); emit(); });
      root.appendChild(si);
      root.appendChild(el("div","cp-hint","Si lo dejás vacío se llama “"+(o.defaultStadium||"Nombre del equipo's Stadium")+"”."));
    }
    if(has("crest")){
      root.appendChild(el("div","cp-sec","Escudo"));
      var row=el("div","cp-crest"), prev=el("span","cp-crest-prev"), col=el("div","cp-crest-btns");
      var paintCrest=function(){ prev.style.backgroundImage=club.crest?'url("'+club.crest+'")':""; prev.classList.toggle("empty",!club.crest); };
      paintCrest();
      var file=el("input"); file.type="file"; file.accept="image/png,.png"; file.hidden=true; file.setAttribute("aria-label","Elegir escudo PNG");
      var up=el("button","cp-reset",club.crest&&!club.crestSpec?"Cambiar PNG":"Subir un PNG"); up.type="button";
      var rm=el("button","cp-reset","Quitar escudo"); rm.type="button"; rm.hidden=!club.crest;
      up.addEventListener("click",function(){ file.click(); });
      col.appendChild(up); col.appendChild(rm); row.appendChild(prev); row.appendChild(col); row.appendChild(file);
      root.appendChild(row);

      /* Armar el escudo acá mismo: forma + diseño + símbolo, con los colores del club */
      var O=window.CHIQUI_CREST_OPTS;
      root.appendChild(el("div","cp-subsec","O armalo en el juego"));
      var groups={};
      function group(key,label,list,withIcon){
        var g=el("div","cp-optrow"); g.appendChild(el("span","cp-optlbl",label));
        var wrap=el("div","cp-opts"); groups[key]={};
        list.forEach(function(it){
          var b=el("button","cp-opt"); b.type="button"; b.dataset.v=it.id;
          if(withIcon){ b.innerHTML='<svg viewBox="0 0 100 100" width="22" height="22" aria-hidden="true"><path d="'+it.d+'" fill="currentColor"/></svg>'; b.setAttribute("aria-label",it.label); b.title=it.label; b.classList.add("icon"); }
          else b.textContent=it.label;
          b.addEventListener("click",function(){ pickOpt(key,it.id); });
          wrap.appendChild(b); groups[key][it.id]=b;
        });
        g.appendChild(wrap); root.appendChild(g);
      }
      group("shape","Forma",O.shapes,true);
      group("pattern","Diseño",O.patterns,false);
      group("symbol","Símbolo",O.symbols,false);
      function markOpts(){
        var sp=club.crestSpec||{};
        ["shape","pattern","symbol"].forEach(function(k){
          Object.keys(groups[k]).forEach(function(id){
            var on=sp[k]===id, b=groups[k][id]; b.classList.toggle("sel",on);
            if(on) b.setAttribute("aria-pressed","true"); else b.removeAttribute("aria-pressed");
          });
        });
      }
      function initialOf(){ return typeof o.getInitial==="function" ? o.getInitial() : (o.initial||""); }
      var genSeq=0;
      regenCrest=function(){
        var my=++genSeq;
        window.chiquiCrestFromSpec(club.crestSpec,club.color||"#5b8def",club.color2||"#ffffff",initialOf()).then(function(url){
          if(my!==genSeq) return;
          club.crest=url; paintCrest(); rm.hidden=false; up.textContent="Subir un PNG";
          emit._busy=true; emit(); emit._busy=false;
        },function(err){ if(my===genSeq) msg.textContent=String(err); });
      };
      function pickOpt(k,id){
        var sp=club.crestSpec||{shape:"shield",pattern:club.color2?"halves":"solid",symbol:"none"};
        sp[k]=id; club.crestSpec=window.chiquiCrestSpecClean(sp); markOpts(); regenCrest();
      }
      markOpts();
      root.regenCrest=function(){ if(club.crestSpec) regenCrest(); };   // el paso del nombre lo llama cuando cambia la inicial

      file.addEventListener("change",function(){
        var fl=file.files&&file.files[0]; file.value="";
        if(!fl) return;
        msg.textContent="Procesando escudo…";
        window.chiquiCrestFromFile(fl).then(function(url){
          club.crest=url; club.crestSpec=null; markOpts(); paintCrest(); up.textContent="Cambiar PNG"; rm.hidden=false; emit();
        },function(err){ msg.textContent=String(err); });
      });
      rm.addEventListener("click",function(){ club.crest=null; club.crestSpec=null; genSeq++; markOpts(); paintCrest(); up.textContent="Subir un PNG"; rm.hidden=true; emit(); });
      root.appendChild(el("div","cp-hint","Podés subir un PNG o armar uno acá. Siempre se ajusta a un tamaño chico para que cargue rápido."));
    }
    root.appendChild(msg);
    return root;
  };

  /* ---------- Ventana flotante ---------- */
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

  window.chiquiClubPopover=function(o){
    close(false);
    lastAnchor=o.anchor;
    pop=el("div","color-pop club-pop"); pop.setAttribute("role","dialog"); pop.setAttribute("aria-label",o.title||"Personalizar club");
    pop.appendChild(el("div","cp-head",o.title||"Personalizar club"));
    pop.appendChild(window.chiquiClubEditor(o));
    var ok=el("button","cp-done","Listo"); ok.type="button"; ok.addEventListener("click",function(){ close(true); });
    pop.appendChild(ok);
    document.body.appendChild(pop);

    var r=o.anchor.getBoundingClientRect(), w=pop.offsetWidth, h=pop.offsetHeight, vw=document.documentElement.clientWidth, vh=window.innerHeight;
    var left=Math.max(8,Math.min(r.left,vw-w-8)), top=r.bottom+8;
    if(top+h>vh-8) top=Math.max(8,r.top-h-8);
    pop.style.left=left+"px"; pop.style.top=top+"px";

    offOutside=function(e){ if(pop && !pop.contains(e.target) && e.target!==o.anchor && !(o.anchor.contains&&o.anchor.contains(e.target))) close(false); };
    offKey=function(e){ if(e.key==="Escape"){ e.stopPropagation(); close(true); } };
    document.addEventListener("pointerdown",offOutside,true); document.addEventListener("keydown",offKey,true);
    window.addEventListener("resize",onResize);
    var first=pop.querySelector(".cp-sw.sel")||pop.querySelector(".cp-sw:not(:disabled)")||pop.querySelector("input"); if(first) first.focus();
  };
})();
