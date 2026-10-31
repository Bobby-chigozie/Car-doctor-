/* AI Car Doctor runtime diagnostics v3.2 — temporary troubleshooting overlay.
   This reports browser/runtime state; it does not fix errors by itself. */
(function () {
  'use strict';
  var errors = [], started = Date.now();
  function el(tag, text) { var n=document.createElement(tag); if(text)n.textContent=text; return n; }
  function record(msg) { errors.push(String(msg)); if(errors.length>8) errors.shift(); render(); }
  function scriptState(file) {
    var list=[].slice.call(document.scripts);
    var s=list.find(function(x){return (x.src||'').split('/').pop().split('?')[0]===file;});
    return s ? (s.dataset.diag==='error'?'ERROR':s.dataset.diag==='ok'?'OK':'LOADED/TAG') : 'NOT FOUND';
  }
  function nativeState() {
    try { return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.ObdBluetoothPlugin) ? 'YES' : ((window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) ? 'NATIVE; plugin not exposed' : 'NO (web/browser)'); }
    catch(e) { return 'CHECK ERROR'; }
  }
  function render() {
    var box=document.getElementById('acdDiagBox'); if(!box)return;
    var db=typeof window.DTC_DATABASE!=='undefined' ? 'READY ('+Object.keys(window.DTC_DATABASE||{}).length+' keys)' : 'NOT READY';
    var lines=['AI Car Doctor • Diagnostic mode','Build: runtime-diagnostics v3.2','WebView: '+(navigator.userAgent.match(/; wv\)/i)?'Android WebView':'browser/unknown'),
      'app.js: '+scriptState('app.js'),'database: '+db,'obd.js: '+scriptState('obd.js'),'scanner.js: '+scriptState('scanner.js'),'Native Bluetooth plugin: '+nativeState(),
      'Make dropdown options: '+(document.getElementById('make')?document.getElementById('make').options.length:'ELEMENT MISSING'),
      'Scan card: '+(document.getElementById('scanCard')?'PRESENT':'NOT PRESENT'),'Elapsed: '+Math.round((Date.now()-started)/1000)+'s'];
    if(errors.length) lines.push('RUNTIME ERRORS:',errors.join('\n'));
    box.textContent=lines.join('\n'); box.style.borderColor=errors.length?'#ff4d5e':'#55b7ff';
  }
  function init(){
    if(document.getElementById('acdDiagBox'))return;
    var css=el('style'); css.textContent='#acdDiagBox{position:fixed;z-index:2147483647;left:6px;right:6px;bottom:6px;max-height:38vh;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;background:#101820f2;color:#e9f3ff;border:2px solid #55b7ff;border-radius:8px;padding:9px;font:11px/1.4 monospace;box-shadow:0 2px 14px #0008}#acdDiagBox .acdClose{float:right;background:#333;color:white;border:1px solid #777;border-radius:4px;padding:3px 8px}'; document.head.appendChild(css);
    var box=el('div');box.id='acdDiagBox'; var close=el('button','Hide');close.className='acdClose';close.onclick=function(){box.style.display='none';var reopen=document.getElementById('acdDiagReopen');if(reopen)reopen.style.display='block';};box.appendChild(close); document.body.appendChild(box);
    var reopen=el('button','Show diagnostics');reopen.id='acdDiagReopen';reopen.style.cssText='display:none;position:fixed;z-index:2147483647;bottom:6px;right:6px;background:#101820;color:white;padding:8px;border-radius:6px';reopen.onclick=function(){box.style.display='block';reopen.style.display='none';render();};document.body.appendChild(reopen);
    render(); setInterval(render,1000);
  }
  window.addEventListener('error',function(e){record((e.filename?e.filename.split('/').pop()+':':'')+(e.message||'Script error')+(e.lineno?':'+e.lineno:''));});
  window.addEventListener('unhandledrejection',function(e){var r=e.reason;record('Promise rejection: '+(r&&r.message?r.message:String(r)));});
  document.addEventListener('DOMContentLoaded',function(){
    [].slice.call(document.scripts).forEach(function(s){ if(!s.src)return; s.addEventListener('load',function(){s.dataset.diag='ok';render();}); s.addEventListener('error',function(){s.dataset.diag='error';record('Failed to load '+s.src);}); });
    init();
  });
})();
