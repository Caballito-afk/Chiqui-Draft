/* =========================================================
   CUADRO DE CONFIRMACIÓN (en lugar de confirm() del navegador)
   askConfirm({title,msg,icon}) -> Promise<boolean>
========================================================= */
let _confirmResolve=null;
let _confirmT=null;
function askConfirm(opts){
  const o=opts||{};
  return new Promise(resolve=>{
    if(_confirmResolve) _confirmResolve(false);      // si ya había uno abierto, se cancela
    _confirmResolve=resolve;
    document.getElementById("confirmIcon").textContent=o.icon||"⚠️";
    document.getElementById("confirmTitle").textContent=o.title||"¿Estás seguro?";
    document.getElementById("confirmMsg").textContent=o.msg||"";
    document.getElementById("confirmOk").textContent=o.okText||"Aceptar";
    document.getElementById("confirmCancel").textContent=o.cancelText||"Cancelar";
    clearTimeout(_confirmT);
    document.getElementById("confirmOverlay").classList.remove("closing");
    document.getElementById("confirmOverlay").classList.add("open");
    document.getElementById("confirmCancel").focus();  // el foco arranca en Cancelar para no aceptar sin querer
  });
}
function _closeConfirm(v){
  const ov=document.getElementById("confirmOverlay");
  ov.classList.add("closing"); // se quita "open" recién cuando termina el fundido
  clearTimeout(_confirmT);
  _confirmT=setTimeout(()=>ov.classList.remove("open","closing"),150);
  const r=_confirmResolve; _confirmResolve=null;
  if(r) r(v);
}
document.getElementById("confirmOk").addEventListener("click",()=>_closeConfirm(true));
document.getElementById("confirmCancel").addEventListener("click",()=>_closeConfirm(false));
document.getElementById("confirmOverlay").addEventListener("click",(e)=>{ if(e.target.id==="confirmOverlay") _closeConfirm(false); });
document.addEventListener("keydown",(e)=>{
  if(!document.getElementById("confirmOverlay").classList.contains("open")) return;
  if(e.key==="Escape"){ e.preventDefault(); e.stopPropagation(); _closeConfirm(false); }
  else if(e.key==="Tab"){ // el foco no se escapa del cuadro
    e.preventDefault();
    const a=document.getElementById("confirmOk"), b=document.getElementById("confirmCancel");
    (document.activeElement===a ? b : a).focus();
  }
},true);
