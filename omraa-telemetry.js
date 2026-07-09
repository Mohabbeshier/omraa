/* Omraa POS — client error telemetry (decoupled · fail-safe · resilient).
   يسجّل أخطاء الفرونت في pos.omraa_error_log عبر RPC آمن (authenticated فقط).
   مبدأ أساسي: التتبّع ممنوع يكسر أو يبطّئ أي أكشن — بيبلع كل أخطائه. */
(function(){"use strict";
  var SB="https://mjetglnmivwphxyzflsz.supabase.co",REF="mjetglnmivwphxyzflsz";
  var ANON="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qZXRnbG5taXZ3cGh4eXpmbHN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NTcwODgsImV4cCI6MjA5NjQzMzA4OH0.X6Rvxo4owPcBwE4HqXLm5fuPDSdEo8PV9oBV-bHsGrg";
  var RPC=SB+"/rest/v1/rpc/pos_fn_log_client_error",QKEY="omraa_err_queue",MAXQ=50;
  function token(){try{var raw=localStorage.getItem("sb-"+REF+"-auth-token");if(!raw)return null;
    var j=JSON.parse(raw);return j.access_token||(j.currentSession&&j.currentSession.access_token)||(Array.isArray(j)&&j[0])||null;}catch(_){return null;}}
  function appVersion(){try{var s=document.querySelector('script[src*="/page-"]');if(!s)return null;
    var m=/([\w()-]+\/page-[\w-]+)\.js/.exec(s.src);return m?m[1].slice(-60):null;}catch(_){return null;}}
  function readQ(){try{return JSON.parse(localStorage.getItem(QKEY)||"[]");}catch(_){return[];}}
  function writeQ(q){try{localStorage.setItem(QKEY,JSON.stringify(q.slice(-MAXQ)));}catch(_){}}
  function enqueue(rec){var q=readQ();q.push(rec);writeQ(q);}
  function post(rec,onFail){var tk=token();if(!tk){onFail&&onFail(rec);return;}
    try{fetch(RPC,{method:"POST",headers:{"Content-Type":"application/json","apikey":ANON,"Authorization":"Bearer "+tk},
      body:JSON.stringify({p_context:rec.context,p_message:rec.message,p_detail:rec.detail||{},p_severity:rec.severity||"error",
        p_app_version:rec.app_version||null,p_ua:(navigator.userAgent||"").slice(0,400),p_online:!!navigator.onLine}),keepalive:true})
      .then(function(r){if(!r.ok)onFail&&onFail(rec);}).catch(function(){onFail&&onFail(rec);});
    }catch(_){onFail&&onFail(rec);}}
  function flush(){var q=readQ();if(!q.length)return;writeQ([]);q.forEach(function(rec){post(rec,enqueue);});}
  function sanitize(x){if(!x||typeof x!=="object")return{};var o={},drop=/pass|token|secret|cost|price|جمله|تكلف/i;
    for(var k in x){if(k==="severity")continue;if(drop.test(k))continue;try{var v=x[k];o[k]=(typeof v==="object")?JSON.parse(JSON.stringify(v)):v;}catch(_){}}return o;}
  window.__omraaLog=function(context,err,extra){try{
    var msg=(err&&err.message)?err.message:(typeof err==="string"?err:(function(){try{return JSON.stringify(err);}catch(_){return String(err);}})());
    post({context:String(context||"unknown").slice(0,120),message:String(msg||"(no message)").slice(0,2000),
      severity:(extra&&extra.severity)||"error",app_version:appVersion(),
      detail:Object.assign({stack:(err&&err.stack)?String(err.stack).slice(0,1500):null,path:location.pathname},sanitize(extra))},enqueue);
  }catch(_){}};
  window.addEventListener("error",function(e){try{window.__omraaLog("global.window.onerror",e.error||e.message,{file:e.filename,line:e.lineno,col:e.colno});}catch(_){}});
  window.addEventListener("unhandledrejection",function(e){try{window.__omraaLog("global.unhandledrejection",e.reason,{});}catch(_){}});
  window.addEventListener("online",flush);try{flush();}catch(_){}
})();
