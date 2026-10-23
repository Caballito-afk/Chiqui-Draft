/* =========================================================
   ANOTADOR
   Modo sin puja ni simulación: se elige el campeonato, la cantidad de equipos,
   se escriben los nombres y cada resultado lo carga la persona a mano.
   Es independiente del resto del juego (usa su propio estado) y se guarda solo.
   Reglas iguales a las del otro modo: clasificados de la Copa de la liga y de
   Champions, byes, siembra del cuadro, ida y vuelta, final doble y gol de visitante.
========================================================= */
(function(){
"use strict";

var KEY="chiquidraft_anotador_v1";
var KEY_CFG="chiquidraft_anotador_cfg_v1";
var COMPS=[
  {id:"leaguecup", t:"Copa de la liga", d:"Liga y después eliminatorias con los mejores."},
  {id:"league", t:"Liga", d:"Todos contra todos. Campeón: el primero de la tabla."},
  {id:"champions", t:"Champions / Libertadores", d:"Fase de grupos de 4 equipos y playoffs."},
  {id:"cup", t:"Copa", d:"Solo eliminatorias, con cuadro por orden de la lista."}
];
var MAXN=16;

/* ---------- utilidades ---------- */
function h(tag,cls,text){ var e=document.createElement(tag); if(cls) e.className=cls; if(text!=null) e.textContent=text; return e; }
function add(p){ for(var i=1;i<arguments.length;i++){ if(arguments[i]) p.appendChild(arguments[i]); } return p; }
function $(id){ return document.getElementById(id); }
function np2(n){ var p=1; while(p<n) p*=2; return p; }
function seedOrder(size){ var o=[1]; while(o.length<size){ var n=o.length*2; var next=[]; for(var i=0;i<o.length;i++){ next.push(o[i]); next.push(n+1-o[i]); } o=next; } return o; }
function isInt(v){ return typeof v==="number" && isFinite(v); }
function parseGoal(txt){ if(txt==null||String(txt).trim()==="") return null; var n=parseInt(txt,10); if(isNaN(n)||n<0) return null; return Math.min(99,n); }
function clone(o){ return JSON.parse(JSON.stringify(o)); }
function save(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }
function load(k){ try{ var r=localStorage.getItem(k); return r?JSON.parse(r):null; }catch(e){ return null; } }
function drop(k){ try{ localStorage.removeItem(k); }catch(e){} }

/* ---------- estado ---------- */
var DEFCFG={comp:"leaguecup", n:6, names:[], legsLeague:false, legsKo:false, finalDouble:false, awayGoals:false, relegations:null};
var cfg=Object.assign({},DEFCFG,load(KEY_CFG)||{});
var S=null;          // partida en curso: {cfg,names,scores,ko,stage,md}
var setupMsg="";

function isChampions(c){ return c.comp==="champions"; }
/* Sorteo: posición -> equipo (partidas viejas sin sorteo siguen en orden) */
function orderAt(pos){ return (S&&S.order)?S.order[pos]:pos; }
function drawApplies(c){ return (isChampions(c)||c.comp==="cup") && c.n>=3; }
function shuffled(n){ var a=[],i,j,t; for(i=0;i<n;i++) a.push(i); for(i=n-1;i>0;i--){ j=Math.floor(Math.random()*(i+1)); t=a[i]; a[i]=a[j]; a[j]=t; } return a; }
function esc(s){ return String(s).replace(/[&<>"]/g,function(ch){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]; }); }
function drawChipOf(id){ return window.chiquiDotHtml({color:colorOf(id),color2:color2Of(id)})+'<span class="dn">'+esc(nameOf(id))+'</span>'; }
/* Animación del sorteo (la misma que los otros modos): revela grupos (Champions) o cruces (Copa) */
function anShowDraw(onGo){
  var c=S.cfg, spin=[], i, steps=[], spec;
  for(i=0;i<c.n;i++) spin.push(drawChipOf(i));
  var chip=function(id){ return {chip:drawChipOf(id), you:false}; };
  if(isChampions(c)){
    var groups=fixture().groups, maxLen=4, s;
    spec={title:"Sorteo de grupos", goLabel:"Continuar a la fase de grupos", anotador:true,
      desc:groups.length+" grupo"+(groups.length===1?"":"s")+" de 4 equipos. Los grupos se sortean totalmente al azar.",
      boardClass:"draw-board draw-groups",
      boardHtml:groups.map(function(g,gi){ return '<div class="draw-card" data-gi="'+gi+'"><h3>Grupo '+"ABCDEFGHIJKLMNOP".charAt(gi)+'</h3>'+g.map(function(){ return '<div class="draw-slot"><span class="ph">?</span></div>'; }).join("")+'</div>'; }).join("")};
    for(s=0;s<maxLen;s++) groups.forEach(function(g,gi){ steps.push(Object.assign({card:gi,slot:s,text:"→ Grupo "+"ABCDEFGHIJKLMNOP".charAt(gi)},chip(g[s]))); });
  } else {
    var r0=resolveBracket()[0];
    spec={title:"Sorteo de la Copa", goLabel:"Continuar a la Copa", anotador:true,
      desc:"Cruces sorteados al azar con "+c.n+" equipos."+(r0.ties.some(function(t){ return t.bye; })?" Los equipos sin rival pasan directo (bye).":""),
      boardClass:"draw-board draw-ties",
      boardHtml:r0.ties.map(function(t,k){ return t.bye
        ? '<div class="draw-card tie bye"><h3>'+roundTitle(r0.teams)+' · Cruce '+(k+1)+'</h3><div class="draw-slot"><span class="ph">?</span></div><div class="draw-vs">pasa directo</div></div>'
        : '<div class="draw-card tie"><h3>'+roundTitle(r0.teams)+' · Cruce '+(k+1)+'</h3><div class="draw-slot"><span class="ph">?</span></div><div class="draw-vs">VS</div><div class="draw-slot"><span class="ph">?</span></div></div>'; }).join("")};
    r0.ties.forEach(function(t,k){
      if(t.bye) steps.push(Object.assign({card:k,slot:0,text:"→ Pasa directo (bye)"},chip(t.A!=null?t.A:t.B)));
      else { steps.push(Object.assign({card:k,slot:0,text:"→ Cruce "+(k+1)},chip(t.A))); steps.push(Object.assign({card:k,slot:1,text:"vs. su rival"},chip(t.B))); }
    });
  }
  spec.spin=spin; spec.steps=steps; spec.onGo=onGo;
  runDraw(spec);
}
function normCfg(c){
  if(isChampions(c)){ c.n=Math.max(8,Math.min(MAXN,Math.round(c.n/4)*4)); c.legsKo=true; }
  else c.n=Math.max(2,Math.min(MAXN,c.n|0));
  if(c.relegations===undefined || c.relegations===null || c.comp!=="league") c.relegations=null;
  else c.relegations=Math.max(0,Math.min(c.relegations|0,c.n-2));
  if(!c.names) c.names=[];
  if(!c.colors) c.colors=[];
  if(!c.colors2) c.colors2=[];
  return c;
}
function thirdsFor(n){ var G=Math.floor(n/4), base=Math.max(2,G*2), size=np2(base), t=size-base; return (t>0&&t<=G)?t:0; }
/* clasificados a la eliminatoria */
function qualCount(c){
  var n=c.n;
  if(c.comp==="cup") return n;
  if(c.comp==="champions") return Math.max(2,Math.floor(n/4)*2)+thirdsFor(n);
  if(c.comp==="league") return 0;
  if(n===2) return 2;
  if(n===3) return 1;
  if(n<=6) return 2;
  var q=Math.max(2,Math.ceil(n/2)); if(q===6) q=8; return q;
}
function hasLeaguePhase(c){ return c.comp==="league" || c.comp==="champions" || (c.comp==="leaguecup" && c.n>=3); }
function hasKnockout(c){ var q=qualCount(c); return c.comp!=="league" && q>=2; }
function legsLeagueDouble(c){ return (c.comp==="league"||c.comp==="leaguecup"||c.comp==="champions") && c.legsLeague; }

/* Color del club (el elegido en la configuración o el de siempre por orden) */
function colorOf(i){ var a=S?S.colors:cfg.colors; return (a&&a[i])||TEAM_COLORS[i%TEAM_COLORS.length]; }
function color2Of(i){ var a=S?S.colors2:cfg.colors2; return (a&&a[i])||null; }
function dotEl(id){ var d=h("i","an-dot"); d.style.background=window.chiquiDotBg?chiquiDotBg(colorOf(id),color2Of(id)):colorOf(id); d.setAttribute("aria-hidden","true"); return d; }
/* etiqueta de equipo con su punto de color */
function setTeamLabel(node,id,label){
  while(node.firstChild) node.removeChild(node.firstChild);
  if(id!=null) node.appendChild(dotEl(id));
  node.appendChild(document.createTextNode(label));
}
function teamEl(cls,id){ var s=h("span",cls); setTeamLabel(s,id,nameOf(id)); return s; }
function nameOf(i){ var s=S?S.names:cfg.names; var v=(s[i]||"").trim(); return v||("Equipo "+(i+1)); }

/* ---------- fixture ---------- */
function roundRobin(ids,dbl){
  var arr=ids.slice(); if(arr.length%2){ arr.push(null); }
  var n=arr.length, half=n/2, mds=[];
  for(var r=0;r<n-1;r++){
    var md=[];
    for(var i=0;i<half;i++){
      var a=arr[i], b=arr[n-1-i];
      if(a!==null && b!==null){ md.push(((r+i)%2===0)?{home:a,away:b}:{home:b,away:a}); }
    }
    mds.push(md);
    var last=arr.pop(); arr.splice(1,0,last);
  }
  if(dbl){ var second=mds.map(function(md){ return md.map(function(m){ return {home:m.away,away:m.home}; }); }); mds=mds.concat(second); }
  return mds;
}
var _fx=null, _fxKey="";
function fixture(){
  var c=S.cfg, key=c.comp+"|"+c.n+"|"+(c.legsLeague?1:0)+"|"+(S.order?S.order.join(","):"");
  if(_fx && _fxKey===key) return _fx;
  var groups=null, mds=[], g, i;
  if(isChampions(c)){
    var G=c.n/4; groups=[];
    for(g=0;g<G;g++){ var ids=[]; for(i=0;i<4;i++) ids.push(orderAt(g*4+i)); groups.push(ids); }
    var per=groups.map(function(ids,gi){ return roundRobin(ids,c.legsLeague).map(function(md){ return md.map(function(m){ return {home:m.home,away:m.away,g:gi}; }); }); });
    var nMd=Math.max.apply(null,per.map(function(f){ return f.length; }));
    for(i=0;i<nMd;i++){ var row=[]; per.forEach(function(f){ if(f[i]) row=row.concat(f[i]); }); mds.push(row); }
  } else if(hasLeaguePhase(c)){
    var all=[]; for(i=0;i<c.n;i++) all.push(i);
    mds=roundRobin(all,legsLeagueDouble(c));
  }
  var k=0; mds=mds.map(function(md){ return md.map(function(m){ m.id="m"+(k++); return m; }); });
  _fx={groups:groups,mds:mds,total:k}; _fxKey=key; return _fx;
}
function scoreOf(id){ var s=S.scores[id]; return s&&isInt(s[0])&&isInt(s[1])?s:null; }
function leagueComplete(){
  if(!hasLeaguePhase(S.cfg)) return true;
  var fx=fixture();
  for(var i=0;i<fx.mds.length;i++) for(var j=0;j<fx.mds[i].length;j++) if(!scoreOf(fx.mds[i][j].id)) return false;
  return true;
}
function playedCount(){ var fx=fixture(), n=0; fx.mds.forEach(function(md){ md.forEach(function(m){ if(scoreOf(m.id)) n++; }); }); return n; }

/* ---------- tabla ---------- */
function tableFor(ids){
  var rows={}; ids.forEach(function(id){ rows[id]={id:id,pj:0,pg:0,pe:0,pp:0,gf:0,gc:0,pts:0}; });
  var fx=fixture();
  fx.mds.forEach(function(md){ md.forEach(function(m){
    var s=scoreOf(m.id); if(!s||!rows[m.home]||!rows[m.away]) return;
    var H=rows[m.home], A=rows[m.away];
    H.pj++; A.pj++; H.gf+=s[0]; H.gc+=s[1]; A.gf+=s[1]; A.gc+=s[0];
    if(s[0]>s[1]){ H.pg++; A.pp++; H.pts+=3; } else if(s[0]<s[1]){ A.pg++; H.pp++; A.pts+=3; } else { H.pe++; A.pe++; H.pts++; A.pts++; }
  }); });
  var list=ids.map(function(id){ return rows[id]; });
  list.sort(cmpRow);
  return list;
}
function cmpRow(a,b){
  return (b.pts-a.pts)||((b.gf-b.gc)-(a.gf-a.gc))||(b.gf-a.gf)||nameOf(a.id).localeCompare(nameOf(b.id),"es");
}
function allIds(){ var a=[]; for(var i=0;i<S.cfg.n;i++) a.push(i); return a; }

/* Champions: clasificados por grupo y mejores terceros */
function groupTables(){ return fixture().groups.map(function(ids){ return tableFor(ids); }); }
function champSeeds(){
  var gts=groupTables(), G=gts.length, k=thirdsFor(S.cfg.n);
  var firsts=[], seconds=[], thirds=[];
  gts.forEach(function(t,gi){ if(t[0]) firsts.push(Object.assign({g:gi,pos:0},t[0])); if(t[1]) seconds.push(Object.assign({g:gi,pos:1},t[1])); if(t[2]) thirds.push(Object.assign({g:gi,pos:2},t[2])); });
  firsts.sort(cmpRow); seconds.sort(cmpRow); thirds.sort(cmpRow);
  var seeds=firsts.concat(seconds).concat(thirds.slice(0,k));
  return {seeds:seeds.map(function(r){ return r.id; }), thirdsIn:thirds.slice(0,k).map(function(r){ return r.id; }), groups:G};
}
function groupOfTeam(id){ var g=fixture().groups; for(var i=0;i<g.length;i++) if(g[i].indexOf(id)>=0) return i; return -1; }

/* ---------- eliminatoria ---------- */
function getSeeds(){
  var c=S.cfg;
  if(c.comp==="cup") return S.order?S.order.slice():allIds();   // el orden sorteado define los cruces
  if(c.comp==="leaguecup"){
    if(c.n===2) return [0,1];
    if(!leagueComplete()) return null;
    return tableFor(allIds()).slice(0,qualCount(c)).map(function(r){ return r.id; });
  }
  if(c.comp==="champions"){
    if(!leagueComplete()) return null;
    return champSeeds().seeds;
  }
  return null;
}
function pairUp(seeds,size,order){
  var pairs=[]; for(var i=0;i<size;i+=2) pairs.push([order[i]-1,order[i+1]-1]);
  if(!isChampions(S.cfg)) return pairs;
  function same(a,b){ return seeds[a]!=null && seeds[b]!=null && groupOfTeam(seeds[a])===groupOfTeam(seeds[b]); }
  for(var pass=0;pass<20;pass++){
    var changed=false;
    for(var p=0;p<pairs.length;p++){
      if(!same(pairs[p][0],pairs[p][1])) continue;
      for(var q=0;q<pairs.length && !changed;q++){
        if(q===p) continue;
        var cand=[[pairs[p][0],pairs[q][1],pairs[q][0],pairs[p][1]],[pairs[p][0],pairs[q][0],pairs[q][1],pairs[p][1]]];
        for(var ci=0;ci<cand.length && !changed;ci++){
          var x=cand[ci];
          if(seeds[x[1]]==null||seeds[x[3]]==null) continue;
          if(!same(x[0],x[1]) && !same(x[2],x[3])){ pairs[p]=[x[0],x[1]]; pairs[q]=[x[2],x[3]]; changed=true; }
        }
      }
      if(changed) break;
    }
    if(!changed) break;
  }
  return pairs;
}
function roundTitle(teamsInRound){
  if(teamsInRound<=2) return "Final";
  if(teamsInRound<=4) return "Semifinales";
  if(teamsInRound<=8) return "Cuartos de final";
  if(teamsInRound<=16) return "Octavos de final";
  return "Ronda";
}
function emptyLegs(two){ return two?[[null,null],[null,null]]:[[null,null]]; }
function resolveTie(r,t,A,B,two){
  var tie={r:r,t:t,A:A,B:B,bye:false,two:two,legs:emptyLegs(two),pens:null,complete:false,needPens:false,winner:null,aggA:0,aggB:0};
  if(A==null||B==null){ return tie; }
  var inp=S.ko[r+"-"+t], sig=A+"-"+B;
  if(inp && inp.sig===sig){
    tie.legs=inp.legs.map(function(l){ return [isInt(l[0])?l[0]:null,isInt(l[1])?l[1]:null]; });
    while(tie.legs.length<(two?2:1)) tie.legs.push([null,null]);
    tie.pens=inp.pens||null;
  }
  var done=tie.legs.every(function(l){ return isInt(l[0])&&isInt(l[1]); });
  var aggA=0, aggB=0;
  tie.legs.forEach(function(l,i){
    if(!isInt(l[0])||!isInt(l[1])) return;
    if(two){ if(i===0){ aggB+=l[0]; aggA+=l[1]; } else { aggA+=l[0]; aggB+=l[1]; } }
    else { aggA+=l[0]; aggB+=l[1]; }
  });
  tie.aggA=aggA; tie.aggB=aggB; tie.complete=done;
  if(done){
    if(aggA>aggB) tie.winner=A; else if(aggB>aggA) tie.winner=B;
    else {
      if(two && isChampions(S.cfg) && S.cfg.awayGoals){
        var awA=tie.legs[0][1], awB=tie.legs[1][1]; // A de visitante en la ida, B de visitante en la vuelta
        if(awA>awB) tie.winner=A; else if(awB>awA) tie.winner=B;
      }
      if(tie.winner==null){
        tie.needPens=true;
        if(tie.pens==="A") tie.winner=A; else if(tie.pens==="B") tie.winner=B;
      }
    }
  }
  return tie;
}
function resolveBracket(){
  var seeds=getSeeds(); if(!seeds||seeds.length<2) return null;
  var c=S.cfg, size=np2(seeds.length), order=seedOrder(size), pairs=pairUp(seeds,size,order);
  var rounds=[], prev=null, teamsInRound=size, r=0;
  while(teamsInRound>=2){
    var two=teamsInRound>2 ? c.legsKo : c.finalDouble;
    var ties=[];
    if(r===0){
      pairs.forEach(function(p,t){
        var A=seeds[p[0]], B=seeds[p[1]];
        if(A==null&&B==null) A=B=null;
        var a=(A!=null)?A:null, b=(B!=null)?B:null;
        if(a!=null&&b!=null){ ties.push(resolveTie(0,t,a,b,two)); }
        else { var only=(a!=null)?a:b; var bye=resolveTie(0,t,only,null,two); bye.bye=true; bye.winner=only; ties.push(bye); }
      });
    } else {
      for(var t2=0;t2<teamsInRound/2;t2++){
        var X=prev[2*t2].winner, Y=prev[2*t2+1].winner;
        var xi=seeds.indexOf(X), yi=seeds.indexOf(Y);
        var A2=X, B2=Y;
        if(X!=null&&Y!=null&&yi<xi){ A2=Y; B2=X; }
        ties.push(resolveTie(r,t2,A2,B2,two));
      }
    }
    rounds.push({r:r,teams:teamsInRound,title:roundTitle(teamsInRound),ties:ties});
    prev=ties; teamsInRound/=2; r++;
  }
  return rounds;
}

/* ---------- campeón ---------- */
function champion(){
  var c=S.cfg;
  if(c.comp==="league"){ if(!leagueComplete()) return null; var t=tableFor(allIds()); return t[0]?t[0].id:null; }
  if(c.comp==="leaguecup" && c.n===3){ if(!leagueComplete()) return null; return tableFor(allIds())[0].id; }
  var br=resolveBracket(); if(!br) return null;
  var fin=br[br.length-1].ties[0];
  return fin.winner!=null?fin.winner:null;
}

/* ---------- pantallas ---------- */
function show(name){ if(typeof goToScreen==="function") goToScreen(name); }
function confirmAsk(o){ return (typeof askConfirm==="function") ? askConfirm(o) : Promise.resolve(window.confirm(o.title+"\n"+(o.msg||""))); }

/* ===== Configuración ===== */
function optGroup(label,key,opts,sub){
  var wrap=h("div","an-opt-group");
  add(wrap,h("div","an-opt-label",label));
  if(sub) add(wrap,h("div","an-opt-sub",sub));
  var row=h("div","mode-options");
  opts.forEach(function(o){
    var sel=(cfg[key]===o.v);
    var card=h("button","opt-card"+(sel?" sel":""));
    card.type="button";
    add(card,h("div","t",o.t),h("div","d",o.d));
    card.dataset.fk=key+":"+String(o.v);
    card.addEventListener("click",function(){ cfg[key]=o.v; save(KEY_CFG,cfg); renderSetup(true); });
    row.appendChild(card);
  });
  wrap.appendChild(row);
  return wrap;
}
function countNote(){
  var n=cfg.n, c=cfg.comp;
  var dbl=legsLeagueDouble(cfg);
  var gm=(n-1)*(dbl?2:1);
  if(c==="league") return gm+" partido"+(gm===1?"":"s")+" por equipo.";
  if(c==="cup"){ if(n===2) return "Final directa."; var size=np2(n), b=size-n; return Math.ceil(Math.log2(n))+" rondas"+(b>0?", con "+b+" pase"+(b===1?"":"s")+" directo"+(b===1?"":"s")+" (bye).":"."); }
  if(c==="champions"){ var G=n/4, th=thirdsFor(n); return G+" grupos de 4 ("+(cfg.legsLeague?"ida y vuelta":"solo ida")+"). Clasifican "+qualCount(cfg)+" a los playoffs"+(th?" (2 por grupo + "+th+" mejores terceros).":"."); }
  if(n===2) return "Sin liga: final directa.";
  if(n===3) return "Es campeón el 1° de la liga.";
  return gm+" partidos por equipo; clasifican "+qualCount(cfg)+" a la eliminatoria.";
}
function focusKey(){ var a=document.activeElement; return a&&a.dataset?a.dataset.fk||"":""; }
function restoreFocus(root,k){ if(!k) return; var el=root.querySelector('[data-fk="'+k+'"]'); if(el) el.focus({preventScroll:true}); }
function renderSetup(rerender){
  normCfg(cfg);
  var root=$("screen-anotador-setup"); var fk=rerender?focusKey():"";
  var keepY=rerender?window.scrollY:null;
  root.classList.toggle("an-static",!!rerender);
  root.innerHTML="";
  var top=h("div","topbar"), tb=h("div");
  add(tb,h("h1",null,"Anotador"));
  top.appendChild(tb); root.appendChild(top);

  var mb=h("div","card mode-banner"), mbd=h("div");
  add(mbd,h("div","mb-title","Anotador"));
  var chg=h("button","btn sm","← Cambiar modo"); chg.type="button";
  chg.addEventListener("click",function(){ show("home"); });
  add(mb,mbd,chg); root.appendChild(mb);

  var saved=load(KEY);
  if(saved && saved.cfg){
    var sc=h("div","card an-saved");
    var comp=COMPS.filter(function(x){ return x.id===saved.cfg.comp; })[0];
    var info=h("div"); add(info,h("div","an-saved-t","Tenés un anotador guardado"),h("div","an-saved-d",(comp?comp.t:"")+" · "+saved.cfg.n+" equipos"));
    var acts=h("div","an-saved-acts");
    var go=h("button","btn primary sm","Continuar"); go.type="button";
    go.addEventListener("click",function(){ S=saved; _fx=null; normCfg(S.cfg); openMain(); });
    var del=h("button","btn sm","Descartar"); del.type="button";
    del.addEventListener("click",function(){
      confirmAsk({title:"¿Descartar el anotador guardado?",msg:"Se borran todos los resultados cargados.",okText:"Descartar"}).then(function(ok){ if(ok){ drop(KEY); renderSetup(true); } });
    });
    add(acts,go,del); add(sc,info,acts); root.appendChild(sc);
  }

  var c1=h("div","card"); add(c1,h("label",null,"Competencia"));
  var m1=h("div","mode-options mode-options-3");
  COMPS.forEach(function(o){
    var card=h("button","opt-card"+(cfg.comp===o.id?" sel":"")); card.type="button";
    add(card,h("div","t",o.t),h("div","d",o.d));
    card.dataset.fk="comp:"+o.id;
    card.addEventListener("click",function(){ cfg.comp=o.id; normCfg(cfg); save(KEY_CFG,cfg); renderSetup(true); });
    m1.appendChild(card);
  });
  add(c1,m1); root.appendChild(c1);

  /* ida y vuelta según el campeonato */
  var yesNo=function(a,b){ return [{v:false,t:a[0],d:a[1]},{v:true,t:b[0],d:b[1]}]; };
  var rows=[];
  var q=qualCount(cfg);
  if(cfg.comp==="league"){
    var relOpts=[{v:null,t:"Automático",d:"Según los equipos (de 0 a 3)."},{v:0,t:"Sin descensos",d:"Nadie pierde la categoría."}];
    for(var rv=1;rv<=5;rv++){ if(rv<=cfg.n-2) relOpts.push({v:rv,t:String(rv),d:rv===1?"Desciende el último.":"Descienden los últimos "+rv+"."}); }
    rows.push(optGroup("Descensos","relegations",relOpts,"Cuántos equipos pierden la categoría al terminar la liga."));
  }
  if(cfg.comp==="league") rows.push(optGroup("Partidos","legsLeague",yesNo(["Solo ida","Cada rival se enfrenta una vez."],["Ida y vuelta","Cada rival se enfrenta dos veces."])));
  if(cfg.comp==="leaguecup" && cfg.n>=3) rows.push(optGroup("Fase de liga","legsLeague",yesNo(["Solo ida","Cada rival se enfrenta una vez."],["Ida y vuelta","Cada rival se enfrenta dos veces."])));
  if(cfg.comp==="champions") rows.push(optGroup("Fase de grupos","legsLeague",yesNo(["Solo ida","3 partidos por equipo."],["Ida y vuelta","6 partidos por equipo."])));
  if(cfg.comp!=="league" && q>2 && cfg.comp!=="champions") rows.push(optGroup("Cruces eliminatorios","legsKo",yesNo(["Partido único","Un solo partido por cruce."],["Ida y vuelta","Se suma el resultado de los dos partidos."])));
  if(cfg.comp!=="league" && q>=2) rows.push(optGroup("Final","finalDouble",yesNo(["Partido único","Se define en un solo partido."],["Ida y vuelta","Se suma el resultado de los dos partidos."])));
  if(cfg.comp==="champions") rows.push(optGroup("Regla del gol de visitante","awayGoals",yesNo(["No rige","Si empatan en el global, se define por penales."],["Rige","En las series de ida y vuelta, desempata el gol de visitante."]),"Los playoffs son siempre de ida y vuelta, salvo la final si la dejás a partido único."));
  if(rows.length){ var c2=h("div","card"); rows.forEach(function(r){ c2.appendChild(r); }); root.appendChild(c2); }

  var c3=h("div","card");
  var lim=isChampions(cfg)?"8 a "+MAXN+", de a 4":"2 a "+MAXN;
  add(c3,h("label",null,"Cantidad de equipos ("+lim+")"));
  var cr=h("div","count-row");
  var minus=h("button","count-btn","−"), val=h("div","count-val",String(cfg.n)), plus=h("button","count-btn","+");
  minus.type=plus.type="button"; minus.setAttribute("aria-label","Un equipo menos"); plus.setAttribute("aria-label","Un equipo más");
  var step=isChampions(cfg)?4:1;
  minus.dataset.fk="minus"; plus.dataset.fk="plus";
  minus.addEventListener("click",function(){ cfg.n-=step; normCfg(cfg); save(KEY_CFG,cfg); renderSetup(true); });
  plus.addEventListener("click",function(){ cfg.n+=step; normCfg(cfg); save(KEY_CFG,cfg); renderSetup(true); });
  add(cr,minus,val,plus); add(c3,cr,h("div","an-note",countNote())); root.appendChild(c3);

  var c4=h("div","card");
  add(c4,h("label",null,"Nombres de los equipos"));
  var note="Si dejás uno vacío se llama \"Equipo 1\", \"Equipo 2\"…";
  if(cfg.comp==="cup") note+=" Los cruces siguen el orden de la lista: el 1° contra el último, y así.";
  else if(isChampions(cfg)) note+=" Los grupos se arman en orden: A con los equipos 1 a 4, B con los 5 a 8…";
  add(c4,h("div","an-note an-note-top",note));
  var grid=h("div","an-names");
  for(var i=0;i<cfg.n;i++){
    (function(i){
      var lab=h("label","an-name");
      var num=h("button","an-name-n tag tag-btn",String(i+1)); num.type="button"; num.dataset.fk="color:"+i;
      num.setAttribute("aria-label","Cambiar el color del equipo "+(i+1)); num.title="Cambiar color del club";
      function paint(){ var c=colorOf(i), c2=color2Of(i); num.style.background=c; num.style.color=window.chiquiColorInk?chiquiColorInk(c):"#0b0b0b"; num.style.boxShadow=c2?"inset 0 0 0 3px "+c2:""; }
      paint();
      num.addEventListener("click",function(){
        var taken=[]; for(var j=0;j<cfg.n;j++) if(j!==i) taken.push({color:colorOf(j),label:(cfg.names[j]||"").trim()||("Equipo "+(j+1))});
        var nm=(cfg.names[i]||"").trim()||("Equipo "+(i+1));
        chiquiClubPopover({anchor:num,taken:taken,fields:["color","color2"],title:"Club · "+nm,
          club:{color:colorOf(i),color2:color2Of(i)},
          onReset:function(){},
          onChange:function(c){ cfg.colors[i]=c.color||null; cfg.colors2[i]=c.color2||null; save(KEY_CFG,cfg); paint(); }});
      });
      var inp=h("input"); inp.type="text"; inp.maxLength=24; inp.autocomplete="off"; inp.placeholder="Equipo "+(i+1); inp.value=cfg.names[i]||"";
      inp.setAttribute("aria-label","Nombre del equipo "+(i+1));
      inp.addEventListener("input",function(){ cfg.names[i]=inp.value; save(KEY_CFG,cfg); setupMsg=""; var m=$("anMsg"); if(m) m.textContent=""; });
      add(lab,num,inp); grid.appendChild(lab);
    })(i);
  }
  c4.appendChild(grid);
  var shuf=h("button","btn sm an-shuffle","Mezclar orden"); shuf.type="button"; shuf.dataset.fk="shuffle";
  shuf.addEventListener("click",function(){
    var arr=[], cols=[], cols2=[]; for(var k=0;k<cfg.n;k++){ arr.push(cfg.names[k]||""); cols.push(cfg.colors[k]||null); cols2.push(cfg.colors2[k]||null); }
    for(var a=arr.length-1;a>0;a--){ var b=Math.floor(Math.random()*(a+1)); var tmp=arr[a]; arr[a]=arr[b]; arr[b]=tmp; var tc=cols[a]; cols[a]=cols[b]; cols[b]=tc; var tc2=cols2[a]; cols2[a]=cols2[b]; cols2[b]=tc2; }
    cfg.names=arr; cfg.colors=cols; cfg.colors2=cols2; save(KEY_CFG,cfg); renderSetup(true);
  });
  var clr=h("button","btn sm an-shuffle","Borrar nombres"); clr.type="button"; clr.dataset.fk="clearNames";
  clr.addEventListener("click",function(){ cfg.names=[]; save(KEY_CFG,cfg); setupMsg=""; renderSetup(true); });
  c4.appendChild(clr);
  c4.appendChild(shuf);
  root.appendChild(c4);

  var msg=h("div","an-msg"); msg.id="anMsg"; msg.setAttribute("role","alert"); msg.textContent=setupMsg;
  root.appendChild(msg);
  var br=h("div","btn-row an-row");
  var start=h("button","btn primary","Empezar"); start.type="button";
  start.addEventListener("click",startNew);
  add(br,start); root.appendChild(br);
  if(rerender){ restoreFocus(root,fk); if(keepY!=null) window.scrollTo(0,keepY); }
}
function startNew(){
  normCfg(cfg);
  var names=[], seen={}, dup=null;
  for(var i=0;i<cfg.n;i++){
    var nm=(cfg.names[i]||"").trim()||("Equipo "+(i+1));
    var k=nm.toLowerCase();
    if(seen[k]!==undefined){ dup=nm; break; }
    seen[k]=i; names.push(nm);
  }
  if(dup){ setupMsg="Hay dos equipos llamados \""+dup+"\". Cambiá uno para poder distinguirlos en la tabla."; var m=$("anMsg"); if(m) m.textContent=setupMsg; return; }
  setupMsg="";
  var c=clone(cfg); c.names=names.slice(); c.colors=names.map(function(_,i){ return cfg.colors[i]||TEAM_COLORS[i%TEAM_COLORS.length]; }); c.colors2=names.map(function(_,i){ return cfg.colors2[i]||null; });
  var stage=(c.comp==="cup"||!hasLeaguePhase(c))?"playoffs":"league";
  S={cfg:c,names:names,colors:c.colors.slice(),colors2:c.colors2.slice(),scores:{},ko:{},stage:stage,md:0};
  if(drawApplies(c)) S.order=shuffled(c.n);   // sorteo al azar: define los grupos (Champions) o los cruces (Copa)
  _fx=null;
  persist();
  if(S.order && typeof runDraw==="function") anShowDraw(openMain); else openMain();
}
function persist(){ if(S) save(KEY,S); }

/* ===== Pantalla principal ===== */
var ui={};   // referencias a nodos para actualizar sin redibujar
var _prevT={};      // posiciones anteriores de cada tabla (para animar los cambios)
var _lastChamp;     // campeón mostrado (la tarjeta solo se anima cuando cambia)
function compTitle(){ var o=COMPS.filter(function(x){ return x.id===S.cfg.comp; })[0]; return o?o.t:"Anotador"; }
function openMain(){
  show("anotador");
  if(S.stage==="playoffs" && !koAvailable()) S.stage="league";
  if(S.stage==="league" && !hasLeaguePhase(S.cfg)) S.stage="playoffs";
  renderMain();
}
function koAvailable(){ return hasKnockout(S.cfg) && (S.cfg.comp==="cup" || (S.cfg.comp==="leaguecup" && S.cfg.n===2) || leagueComplete()); }
function firstPendingMd(){
  var fx=fixture();
  for(var i=0;i<fx.mds.length;i++) for(var j=0;j<fx.mds[i].length;j++) if(!scoreOf(fx.mds[i][j].id)) return i;
  return -1;
}
function renderMain(rerender){
  var root=$("screen-anotador"); var keepY=rerender?window.scrollY:null;
  root.classList.toggle("an-static",!!rerender);
  root.innerHTML=""; ui={}; _prevT={}; _lastChamp=undefined;
  var c=S.cfg;
  var top=h("div","topbar"), tb=h("div");
  add(tb,h("h1",null,compTitle()),h("div","desc",describe()));
  top.appendChild(tb); root.appendChild(top);

  var bar=h("div","an-bar");
  var back=h("button","btn sm","← Cambiar modo"); back.type="button"; back.title="Se guarda solo: podés continuar después";
  back.addEventListener("click",function(){ show("home"); });
  var reset=h("button","btn sm","Borrar resultados"); reset.type="button";
  reset.addEventListener("click",function(){
    confirmAsk({title:"¿Borrar todos los resultados?",msg:"Los equipos y el formato se mantienen.",okText:"Borrar"}).then(function(ok){ if(!ok) return; S.scores={}; S.ko={}; S.md=0; S.stage=(c.comp==="cup"||!hasLeaguePhase(c))?"playoffs":"league"; persist(); renderMain(true); });
  });
  var nuevo=h("button","btn sm","Nuevo anotador"); nuevo.type="button";
  nuevo.addEventListener("click",function(){
    confirmAsk({title:"¿Empezar un anotador nuevo?",msg:"Este queda guardado hasta que armes el nuevo.",okText:"Nuevo anotador"}).then(function(ok){ if(ok){ renderSetup(); show("anotador-setup"); } });
  });
  add(bar,back,reset,nuevo); root.appendChild(bar);

  ui.champ=h("div","an-champ"); ui.champ.setAttribute("aria-live","polite"); root.appendChild(ui.champ);

  /* pestañas */
  var tabs=[];
  if(hasLeaguePhase(c) && hasKnockout(c)) tabs=[{id:"league",t:isChampions(c)?"Grupos":"Liga"},{id:"playoffs",t:isChampions(c)?"Playoffs":"Eliminatoria"}];
  if(tabs.length){
    var tr=h("div","an-tabs"); ui.tabs={};
    tabs.forEach(function(t){
      var b=h("button","mk-tab",t.t); b.type="button";
      b.addEventListener("click",function(){ if(b.disabled) return; S.stage=t.id; persist(); renderMain(true); });
      ui.tabs[t.id]=b; tr.appendChild(b);
    });
    root.appendChild(tr);
    ui.tabNote=h("div","an-note an-tabnote"); root.appendChild(ui.tabNote);
  }
  ui.body=h("div","an-body"); root.appendChild(ui.body);
  if(S.stage==="league") buildLeague(); else buildKo();
  refreshAll();
  if(keepY!=null) window.scrollTo(0,keepY);
}
function describe(){
  var c=S.cfg, n=c.n;
  if(c.comp==="league") return n+" equipos · "+(c.legsLeague?"ida y vuelta":"solo ida")+". Campeón: el primero de la tabla.";
  if(c.comp==="cup") return n+" equipos · eliminatorias"+(c.legsKo&&n>2?" de ida y vuelta":"")+(c.finalDouble?" y final a ida y vuelta":"")+".";
  if(c.comp==="champions") return n+" equipos · "+(n/4)+" grupos de 4 · "+qualCount(c)+" clasifican a los playoffs.";
  if(n===2) return "Dos equipos: final directa.";
  if(n===3) return "Tres equipos: es campeón el 1° de la liga.";
  return n+" equipos · clasifican "+qualCount(c)+" a la eliminatoria.";
}

/* ----- Liga / grupos ----- */
function buildLeague(){
  var fx=fixture(), c=S.cfg;
  if(S.md>=fx.mds.length) S.md=0;
  var layout=h("div","league-layout");
  var left=h("div","card an-matches");
  var head=h("div","an-md-head");
  var prev=h("button","btn sm","← Anterior"); prev.type="button";
  var next=h("button","btn sm","Siguiente"); next.type="button";
  ui.mdLabel=h("div","an-md-label");
  var nav=h("div","an-md-nav"); add(nav,prev,ui.mdLabel,next);
  var pend=h("button","btn sm","Ir a la próxima pendiente"); pend.type="button";
  add(head,nav,pend); left.appendChild(head);
  ui.mdProg=h("div","an-note an-md-prog"); left.appendChild(ui.mdProg);
  ui.matches=h("div","an-match-list"); left.appendChild(ui.matches);
  prev.addEventListener("click",function(){ if(S.md>0){ S.md--; persist(); drawMatches(); } });
  next.addEventListener("click",function(){ if(S.md<fx.mds.length-1){ S.md++; persist(); drawMatches(); } });
  pend.addEventListener("click",function(){ var i=firstPendingMd(); if(i>=0){ S.md=i; persist(); drawMatches(); } });
  ui.prev=prev; ui.next=next; ui.pend=pend;
  /* Tabla: barra lateral fija a la derecha con pestaña, igual que en el modo local */
  var main=h("div","league-main"); main.appendChild(left);
  var side=h("aside","league-side");
  var handle=h("button","side-handle"); handle.type="button"; handle.title="Mostrar u ocultar la tabla de posiciones";
  var inner=h("div","league-side-inner");
  var sh=h("div","league-side-head"); sh.appendChild(h("h3","section-title",isChampions(c)?"Grupos":"Tabla de posiciones"));
  var right=h("div","an-tables"); ui.tables=right;
  add(inner,sh,right); add(side,handle,inner);
  ui.layout=layout;
  add(layout,main,side); ui.body.appendChild(layout);
  setupSide(layout,handle);
  drawMatches();
}
/* Mostrar/ocultar la barra lateral (se recuerda; comparte la preferencia con la liga del modo local) */
var _sideHidden=null, _sideT=null;
function setupSide(layout,handle){
  if(_sideHidden===null){
    var sv=null; try{ sv=localStorage.getItem("ligaSideHidden"); }catch(e){}
    _sideHidden = sv===null ? window.innerWidth<=1100 : sv==="1";
  }
  function paint(){ layout.classList.toggle("side-hidden",_sideHidden); handle.textContent=_sideHidden?"◂ Tabla":"Tabla ▸"; }
  paint();
  handle.addEventListener("click",function(){
    _sideHidden=!_sideHidden;
    document.documentElement.classList.add("side-anim"); clearTimeout(_sideT);
    _sideT=setTimeout(function(){ document.documentElement.classList.remove("side-anim"); },400);
    paint();
    try{ localStorage.setItem("ligaSideHidden",_sideHidden?"1":"0"); }catch(e){}
  });
}
function drawMatches(){
  var fx=fixture(), md=fx.mds[S.md]||[], c=S.cfg;
  ui.matches.innerHTML="";
  ui.mdLabel.textContent="Jornada "+(S.md+1)+" de "+fx.mds.length;
  ui.prev.disabled=S.md===0; ui.next.disabled=S.md>=fx.mds.length-1;
  md.forEach(function(m){
    var row=h("div","an-match"); row.dataset.id=m.id;
    if(isChampions(c)) add(row,h("span","an-grp","Grupo "+String.fromCharCode(65+m.g)));
    var home=teamEl("an-team an-home",m.home);
    var ih=goalInput("Goles de "+nameOf(m.home)), ia=goalInput("Goles de "+nameOf(m.away));
    var away=teamEl("an-team an-away",m.away);
    var s=S.scores[m.id]||[null,null];
    ih.value=isInt(s[0])?s[0]:""; ia.value=isInt(s[1])?s[1]:"";
    var sep=h("span","an-sep","-");
    var clear=h("button","an-clear","Borrar"); clear.type="button"; clear.title="Borrar este resultado"; clear.setAttribute("aria-label","Borrar el resultado de "+nameOf(m.home)+" contra "+nameOf(m.away));
    function onChange(){
      var a=parseGoal(ih.value), b=parseGoal(ia.value);
      if(ih.value!==""&&String(a)!==ih.value) ih.value=a==null?"":a;
      if(ia.value!==""&&String(b)!==ia.value) ia.value=b==null?"":b;
      if(a==null&&b==null) delete S.scores[m.id]; else S.scores[m.id]=[a,b];
      persist(); row.classList.toggle("done",isInt(a)&&isInt(b)); refreshAll();
    }
    ih.addEventListener("input",onChange); ia.addEventListener("input",onChange);
    clear.addEventListener("click",function(){ ih.value=""; ia.value=""; onChange(); ih.focus(); });
    row.classList.toggle("done",isInt(s[0])&&isInt(s[1]));
    var mid=h("div","an-score"); add(mid,ih,sep,ia);
    add(row,home,mid,away,clear); ui.matches.appendChild(row);
  });
  refreshLeague();
}
function goalInput(label){
  var i=h("input","an-goal"); i.type="text"; i.inputMode="numeric"; i.pattern="[0-9]*"; i.maxLength=2; i.autocomplete="off"; i.setAttribute("aria-label",label);
  i.addEventListener("focus",function(){ i.select(); });
  i.addEventListener("keydown",function(e){ if(e.key.length===1 && !/[0-9]/.test(e.key) && !e.ctrlKey && !e.metaKey) e.preventDefault(); });
  return i;
}
var _anim=[];
function tableCard(title,rows,zones,opts){
  var card=h("div","card an-tcard");
  if(title) card.appendChild(h("div","an-ttitle",title));
  var wrap=h("div","an-twrap");
  var tbl=h("table","an-table");
  var thead=h("thead"), trh=h("tr");
  ["#","Equipo","PJ","PG","PE","PP","GF","GC","DG","Pts"].forEach(function(t,i){ var th=h("th",null,t); if(i===1) th.className="l"; trh.appendChild(th); });
  thead.appendChild(trh); tbl.appendChild(thead);
  var tb=h("tbody");
  rows.forEach(function(r,i){
    var tr=h("tr"); var z=zones[i]; if(z) tr.className="an-z-"+z;
    var cells=[String(i+1),nameOf(r.id),r.pj,r.pg,r.pe,r.pp,r.gf,r.gc,(r.gf-r.gc>0?"+":"")+(r.gf-r.gc),r.pts];
    cells.forEach(function(v,k){
      var td=h("td",null,k===0?null:String(v));
      if(k===0){ td.appendChild(h("span","rank-num",String(v))); }
      if(k===1){ td.className="l nm"; setTeamLabel(td,r.id,nameOf(r.id)); } if(k===9) td.className="pts"; tr.appendChild(td);
    });
    tb.appendChild(tr);
  });
  if(opts&&opts.key!=null) _anim.push({key:opts.key,rows:rows,tbl:tbl});
  tbl.appendChild(tb); wrap.appendChild(tbl); card.appendChild(wrap);
  if(opts&&opts.legend){ var lg=h("div","an-legend"); opts.legend.forEach(function(l){ var s=h("span","an-lg"); var sw=h("i","an-sw an-z-"+l[0]); add(s,sw,document.createTextNode(l[1])); lg.appendChild(s); }); card.appendChild(lg); }
  return card;
}
/* ---- Zonas de la tabla (igual que en el modo local) ----
   q = zona de clasificación · k = ya clasificado · e = eliminado · t = mejor tercero · c = campeón */
function leftMatches(){
  var left={}; allIds().forEach(function(id){ left[id]=0; });
  fixture().mds.forEach(function(md){ md.forEach(function(m){ if(!scoreOf(m.id)){ left[m.home]++; left[m.away]++; } }); });
  return left;
}
function anRelegation(n){
  var auto=n<=3?0:(n<=7?1:(n<=11?2:3)), v=S&&S.cfg?S.cfg.relegations:null;
  if(v===null||v===undefined) return auto;
  return Math.max(0,Math.min(v,n-2));
}
/* Liga o Copa de la liga: una sola tabla */
function zonesSingle(rows){
  var c=S.cfg, left=leftMatches(), allPlayed=leagueComplete(), anyP=playedCount()>0, Q;
  if(c.comp==="league"){
    var D=anRelegation(rows.length), lead=rows[0];
    var champ=!!lead && anyP && (allPlayed || rows.slice(1).every(function(o){ return lead.pts>o.pts+3*left[o.id]; }));
    return rows.map(function(r,i){ if(i===0&&anyP) return champ?"k":"q"; if(D>0&&i>=rows.length-D) return "e"; return ""; });
  }
  Q=qualCount(c); if(!Q) return rows.map(function(){ return ""; });
  return rows.map(function(r,i){
    var clinched, elim;
    if(allPlayed){ clinched=i<Q; elim=i>=Q; }
    else{
      var can=0, above=0, maxPts=r.pts+3*left[r.id];
      rows.forEach(function(o){ if(o.id!==r.id){ if(o.pts+3*left[o.id]>=r.pts) can++; if(o.pts>maxPts) above++; } });
      clinched=can<=Q-1; elim=above>=Q;
    }
    return clinched?"k":(elim?"e":(i<Q?"q":""));
  });
}
function legendSingle(zones){
  var c=S.cfg, lg=[];
  if(c.comp==="league"){ lg.push(["q","Líder"],["k","Campeón matemático"]); if(anRelegation(S.cfg.n)>0) lg.push(["e","Descenso"]); return lg; }
  return [["q","Zona de clasificación (top "+qualCount(c)+")"],["k","Ya clasificado"],["e","Eliminado"]];
}
/* Champions: cada grupo (top 2 + mejores terceros) */
function zonesGroup(rows,cs,anyP,allDone){
  var left=leftMatches(), nTh=thirdsFor(S.cfg.n);
  var gDone=rows.every(function(r){ return left[r.id]===0; });
  return rows.map(function(r,i){
    var clinched=rows.filter(function(o){ return o.id!==r.id && o.pts+3*left[o.id]>=r.pts; }).length<=1;
    var mx=r.pts+3*left[r.id];
    var elim=rows.filter(function(o){ return o.id!==r.id && o.pts>mx; }).length>=(nTh>0?3:2);
    var third=cs.thirdsIn.indexOf(r.id)>=0;
    if(gDone){
      if(i<2) return "k";
      if(i===2 && nTh) return third?"t":(allDone?"e":"");
      return "e";
    }
    if(i<2) return clinched?"k":(elim?"e":"q");
    if(i===2 && nTh && third && anyP && !elim) return "t";
    return elim?"e":"";
  });
}
/* Las filas se deslizan a su nueva posición, la zona cambia de color en el camino, los puntos "saltan" y aparece ▲/▼ con los puestos ganados o perdidos (igual que en el modo local). */
var ZC=["an-z-q","an-z-k","an-z-e","an-z-t","an-z-c"];
function zoneOf(tr){ for(var i=0;i<ZC.length;i++) if(tr.classList.contains(ZC[i])) return ZC[i]; return ""; }
function animateTable(a){
  var trs=[].slice.call(a.tbl.tBodies[0].rows), rows=a.rows;
  var prev=_prevT[a.key];
  var cur={rank:{},pts:{},zone:{}};
  rows.forEach(function(r,i){ cur.rank[r.id]=i; cur.pts[r.id]=r.pts; cur.zone[r.id]=zoneOf(trs[i]); });
  _prevT[a.key]=cur;
  if(!prev) return;
  var visible=a.tbl.offsetWidth>0;
  var reduce=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function look(tr,zone){
    var now=zoneOf(tr); if(now) tr.classList.remove(now); if(zone) tr.classList.add(zone);
    var cs=getComputedStyle(tr), o={backgroundColor:cs.backgroundColor,boxShadow:cs.boxShadow};
    if(zone) tr.classList.remove(zone); if(now) tr.classList.add(now); return o;
  }
  var moved=false;
  rows.forEach(function(r,i){
    var old=prev.rank[r.id]; if(old===undefined) return;
    var diff=old-i; if(diff!==0) moved=true;
    if(!visible) return;
    var tr=trs[i];
    if(prev.pts[r.id]!==r.pts){ var pc=tr.querySelector("td.pts"); if(pc) pc.classList.add("pts-up"); }
    var zNow=zoneOf(tr), zPrev=prev.zone[r.id]||"";
    if(diff===0 && zNow===zPrev) return;
    var k0={}, k1={};
    if(diff!==0){
      var rk=tr.querySelector(".rank-num");
      if(rk){ var d=document.createElement("span"); d.className="rk-delta "+(diff>0?"up":"down"); d.textContent=(diff>0?"▲":"▼")+Math.abs(diff); rk.after(d); }
      if(!reduce && trs[old]){
        var dy=trs[old].getBoundingClientRect().top-tr.getBoundingClientRect().top;
        if(dy){ k0.transform="translateY("+dy+"px)"; k1.transform="translateY(0)"; tr.classList.add("moving"); }
      }
    }
    if(zNow!==zPrev){ Object.assign(k0,look(tr,zPrev)); Object.assign(k1,look(tr,zNow)); }
    if(tr.animate && Object.keys(k0).length){
      var an=tr.animate([k0,k1],{duration:900,easing:"cubic-bezier(.22,.9,.25,1)"});
      an.onfinish=an.oncancel=function(){ tr.classList.remove("moving"); };
    }
  });
  if(moved && visible && window.chiquiSfx) window.chiquiSfx.play("rank",300);
}
function refreshLeague(){
  if(!ui.tables) return;
  var c=S.cfg, fx=fixture(); ui.tables.innerHTML=""; _anim=[];
  var complete=leagueComplete();
  if(isChampions(c)){
    var gts=groupTables(), cs=champSeeds(), anyP=playedCount()>0;
    gts.forEach(function(rows,gi){
      var zones=zonesGroup(rows,cs,anyP,complete);
      ui.tables.appendChild(tableCard("Grupo "+String.fromCharCode(65+gi),rows,zones,{key:"g"+gi,legend:gi===gts.length-1?[["q","Zona de clasificación (top 2 de cada grupo)"],["k","Ya clasificado"]].concat(thirdsFor(c.n)?[["t","Mejor tercero"]]:[]).concat([["e","Eliminado"]]):null}));
    });
  } else {
    var rows=tableFor(allIds());
    var zones=zonesSingle(rows);
    ui.tables.appendChild(tableCard(null,rows,zones,{key:"main",legend:legendSingle(zones)}));
  }
  _anim.forEach(animateTable);
  var played=playedCount();
  if(ui.mdProg) ui.mdProg.textContent=played+" de "+fx.total+" partidos cargados.";
  if(ui.pend) ui.pend.disabled=firstPendingMd()<0;
}

/* ----- Eliminatoria ----- */
function buildKo(){
  var br=resolveBracket();
  var wrap=h("div","an-ko"); ui.ko=wrap; ui.tieNodes={};
  if(!br){ ui.body.appendChild(h("div","card an-empty","Completá todos los partidos de la fase anterior para armar el cuadro.")); return; }
  // Misma grilla que el cuadro del modo local: cada ronda ocupa el doble de filas que la anterior,
  // así cada cruce queda centrado entre los dos que lo alimentan y las líneas los unen.
  var R=br.length, grid=h("div","bk-grid");
  grid.style.gridTemplateColumns="repeat("+R+", var(--bk-w))";
  grid.style.gridTemplateRows="auto repeat("+br[0].ties.length+", auto)";
  br.forEach(function(round,ri){
    var span=Math.pow(2,ri);
    var title=h("div","bk-title",round.title); title.style.gridColumn=String(ri+1); grid.appendChild(title);
    round.ties.forEach(function(tie,si){
      var cell=h("div","bk-cell"); cell.dataset.r=String(ri); cell.dataset.s=String(si);
      if(ri<R-1) cell.dataset.next="1";
      cell.style.gridColumn=String(ri+1); cell.style.gridRow=(2+si*span)+" / span "+span;
      var node=buildTie(tie); ui.tieNodes[tie.r+"-"+tie.t]=node; cell.appendChild(node.root); grid.appendChild(cell);
    });
  });
  wrap.appendChild(grid);
  ui.body.appendChild(wrap);
  if(window.chiquiBracketLines) window.chiquiBracketLines(grid,"an");
}
function buildTie(tie){
  var root=h("div","an-tie"); root.dataset.r=tie.r; root.dataset.t=tie.t;
  var grid=h("div","an-tie-grid"+(tie.two?" two":""));
  var node={root:root,rows:{},inputs:[],pens:null};
  if(tie.two){ add(grid,h("span","an-th"),h("span","an-th","Ida"),h("span","an-th","Vuelta"),h("span","an-th","Global")); }
  ["A","B"].forEach(function(side){
    var nm=h("span","an-tn"); var legsIn=[];
    var agg=tie.two?h("span","an-agg","-"):null;
    add(grid,nm);
    var nLegs=tie.two?2:1;
    for(var li=0;li<nLegs;li++){
      (function(li){
        var inp=goalInput("Goles"); inp.dataset.leg=li; inp.dataset.side=side;
        inp.addEventListener("input",function(){ onKoInput(node,tie.r,tie.t,li,side,inp); });
        legsIn.push(inp); grid.appendChild(inp);
      })(li);
    }
    if(agg) grid.appendChild(agg);
    node.rows[side]={name:nm,inputs:legsIn,agg:agg};
  });
  root.appendChild(grid);
  node.info=h("div","an-tie-info"); root.appendChild(node.info);
  node.pens=h("div","an-pens"); node.pens.hidden=true;
  node.pensLabel=h("div","an-pens-l","Empate global. ¿Quién ganó por penales?");
  node.pensA=h("button","btn sm"); node.pensA.type="button"; node.pensB=h("button","btn sm"); node.pensB.type="button";
  node.pensA.addEventListener("click",function(){ setPens(tie.r,tie.t,"A"); });
  node.pensB.addEventListener("click",function(){ setPens(tie.r,tie.t,"B"); });
  add(node.pens,node.pensLabel,h("div","an-pens-b"));
  node.pens.lastChild.appendChild(node.pensA); node.pens.lastChild.appendChild(node.pensB);
  root.appendChild(node.pens);
  return node;
}
function koInput(r,t,sig,two){
  var key=r+"-"+t, cur=S.ko[key];
  if(!cur||cur.sig!==sig){ cur={sig:sig,legs:emptyLegs(two),pens:null}; S.ko[key]=cur; }
  return cur;
}
function onKoInput(node,r,t,li,side,inp){
  var br=resolveBracket(); if(!br) return;
  var tie=br[r].ties[t]; if(tie.A==null||tie.B==null) return;
  var v=parseGoal(inp.value);
  if(inp.value!==""&&String(v)!==inp.value) inp.value=v==null?"":v;
  var cur=koInput(r,t,tie.A+"-"+tie.B,tie.two);
  /* en la ida juega de local B (el peor sembrado); en la vuelta, A */
  var pos;
  if(tie.two){ pos=(li===0)?(side==="A"?1:0):(side==="A"?0:1); } else { pos=(side==="A")?0:1; }
  cur.legs[li][pos]=v;
  cur.pens=null;
  persist(); refreshAll();
}
function setPens(r,t,who){
  var br=resolveBracket(); if(!br) return;
  var tie=br[r].ties[t]; if(!tie.needPens) return;
  var cur=koInput(r,t,tie.A+"-"+tie.B,tie.two);
  cur.pens=(cur.pens===who)?null:who;
  persist(); refreshAll();
}
function refreshKo(){
  var br=resolveBracket();
  if(!br){ ui.body.innerHTML=""; buildKo(); return; }
  var structural=false;
  br.forEach(function(round){ round.ties.forEach(function(tie){ if(!ui.tieNodes||!ui.tieNodes[tie.r+"-"+tie.t]) structural=true; }); });
  if(structural){ ui.body.innerHTML=""; buildKo(); br=resolveBracket(); }
  br.forEach(function(round){
    round.ties.forEach(function(tie){
      var node=ui.tieNodes[tie.r+"-"+tie.t]; if(!node) return;
      var ready=tie.A!=null&&tie.B!=null&&!tie.bye;
      node.root.classList.toggle("bye",!!tie.bye);
      node.root.classList.toggle("pending",!ready&&!tie.bye);
      node.root.classList.toggle("decided",tie.winner!=null);
      ["A","B"].forEach(function(side){
        var id=(side==="A")?tie.A:tie.B, row=node.rows[side];
        var label=id!=null?nameOf(id):(tie.bye?"Pasa directo":"Por definir");
        setTeamLabel(row.name,id,label);
        row.name.classList.toggle("tbd",id==null);
        row.name.classList.toggle("win",tie.winner!=null&&id===tie.winner);
        row.name.classList.toggle("lose",tie.winner!=null&&id!=null&&id!==tie.winner);
        row.inputs.forEach(function(inp,li){
          inp.disabled=!ready;
          inp.setAttribute("aria-label","Goles de "+(id!=null?nameOf(id):"equipo por definir")+(tie.two?(li===0?" en la ida":" en la vuelta"):""));
          var pos=tie.two?((li===0)?(side==="A"?1:0):(side==="A"?0:1)):(side==="A"?0:1);
          var val=ready&&tie.legs[li]&&isInt(tie.legs[li][pos])?String(tie.legs[li][pos]):"";
          /* no se pisa lo que la persona está escribiendo en este momento */
          if(inp===document.activeElement && ready){ if(parseGoal(inp.value)!==(val===""?null:Number(val))) inp.value=val; }
          else if(inp.value!==val) inp.value=val;
        });
        if(row.agg){ var ag=side==="A"?tie.aggA:tie.aggB; row.agg.textContent=ready&&tie.legs.some(function(l){ return isInt(l[0])&&isInt(l[1]); })?String(ag):"-"; }
      });
      var info="";
      if(tie.bye) info="Sin rival en esta ronda.";
      else if(ready&&tie.two) info="Ida en "+nameOf(tie.B)+" · vuelta en "+nameOf(tie.A)+".";
      else if(ready) info="Partido único.";
      node.info.textContent=info;
      node.pens.hidden=!(ready&&tie.needPens);
      if(ready&&tie.needPens){
        node.pensA.textContent=nameOf(tie.A); node.pensB.textContent=nameOf(tie.B);
        node.pensA.classList.toggle("primary",tie.pens==="A"); node.pensB.classList.toggle("primary",tie.pens==="B");
        node.pensA.setAttribute("aria-pressed",tie.pens==="A"?"true":"false"); node.pensB.setAttribute("aria-pressed",tie.pens==="B"?"true":"false");
      }
    });
  });
}

/* ----- común ----- */
function refreshAll(){
  var c=S.cfg;
  if(ui.tabs){
    var avail=koAvailable();
    ui.tabs.league.classList.toggle("on",S.stage==="league");
    ui.tabs.playoffs.classList.toggle("on",S.stage==="playoffs");
    ui.tabs.playoffs.disabled=!avail;
    ui.tabs.playoffs.setAttribute("aria-disabled",avail?"false":"true");
    ui.tabNote.textContent=avail?"":(isChampions(c)?"Los playoffs se habilitan cuando cargues todos los partidos de los grupos.":"La eliminatoria se habilita cuando cargues todos los partidos de la liga.");
    if(!avail && S.stage==="playoffs"){ S.stage="league"; persist(); renderMain(true); return; }
  }
  if(S.stage==="league") refreshLeague(); else refreshKo();
  var ch=champion();
  var sig=(ch==null)?"":(ch+"|"+nameOf(ch));
  if(sig!==_lastChamp){
    _lastChamp=sig; ui.champ.innerHTML="";
    if(ch!=null){
      var box=h("div","an-champ-box");
      var chn=h("div","an-champ-n"); setTeamLabel(chn,ch,nameOf(ch));
      add(box,h("div","an-champ-k","Campeón"),chn);
      ui.champ.appendChild(box);
    }
  }
}

/* ---------- conexión con el inicio ---------- */
function openFromHome(){
  S=null; _fx=null;
  var saved=load(KEY);
  cfg=Object.assign({},DEFCFG,load(KEY_CFG)||{});
  normCfg(cfg);
  renderSetup();
  show("anotador-setup");
}
var btn=$("home-anotador");
if(btn) btn.addEventListener("click",openFromHome);

/* para pruebas y depuración */
window.__anotador={ get state(){ return S; }, get cfg(){ return cfg; }, champion:function(){ return champion(); }, bracket:function(){ return resolveBracket(); } };
})();
