/*! Al-Omraa System — © 2026 Mohab Beshier (Head of Performance) & Axis Marketing Agency.
    All rights reserved. Proprietary — licensed to the Al-Omraa shop only; resale or use
    for any other business is prohibited. See LICENSE.md. */
/* Omraa POS — client error telemetry (decoupled · fail-safe · resilient).
   يسجّل أخطاء الفرونت في pos.omraa_error_log عبر RPC آمن (authenticated فقط).
   مبدأ أساسي: التتبّع ممنوع يكسر أو يبطّئ أي أكشن — بيبلع كل أخطائه. */
(function(){"use strict";
  var SB="https://mjetglnmivwphxyzflsz.supabase.co",REF="mjetglnmivwphxyzflsz";
  var ANON="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qZXRnbG5taXZ3cGh4eXpmbHN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NTcwODgsImV4cCI6MjA5NjQzMzA4OH0.X6Rvxo4owPcBwE4HqXLm5fuPDSdEo8PV9oBV-bHsGrg";
  var RPC=SB+"/rest/v1/rpc/pos_fn_log_client_error",QKEY="omraa_err_queue",MAXQ=50;
  /* الجلسة في **كوكي** مش localStorage (@supabase/ssr): ممكن تكون مقسّمة
     على أجزاء ومكوّدة base64url. القراءة القديمة كانت بترجع null دايمًا،
     يعني كل خطأ كان بيتحط في طابور محلي وما يوصلش أبدًا — وده سبب إن
     pos.omraa_error_log فاضي رغم إن النظام شغّال يوميًا. */
  function b64t(x){try{var pad=x.length%4?new Array(5-x.length%4).join("="):"";
    var bin=atob(x.replace(/-/g,"+").replace(/_/g,"/")+pad);
    var b=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)b[i]=bin.charCodeAt(i);
    return new TextDecoder().decode(b);}catch(_){return null;}}
  function cookieVal(name){try{var jar={},p=String(document.cookie||"").split(";");
    for(var i=0;i<p.length;i++){var q=p[i].indexOf("=");if(q<0)continue;jar[p[i].slice(0,q).trim()]=p[i].slice(q+1);}
    if(jar[name]!==undefined)return jar[name];
    var out="",n=0;while(jar[name+"."+n]!==undefined){out+=jar[name+"."+n];n++;}
    return n?out:null;}catch(_){return null;}}
  function parseSess(raw){if(!raw)return null;var v=raw;
    try{v=decodeURIComponent(v);}catch(_){}
    if(v.indexOf("base64-")===0){v=b64t(v.slice(7));if(!v)return null;}
    var j;try{j=JSON.parse(v);}catch(_){return null;}
    if(Array.isArray(j))return j[0]||null;
    if(j&&j.currentSession)j=j.currentSession;
    return (j&&j.access_token)||null;}
  function token(){
    var t=parseSess(cookieVal("sb-"+REF+"-auth-token"));
    if(t)return t;
    try{return parseSess(localStorage.getItem("sb-"+REF+"-auth-token"));}catch(_){return null;}}
  function appVersion(){try{var s=document.querySelector('script[src*="/page-"]');if(!s)return null;
    var m=/([\w()-]+\/page-[\w-]+)\.js/.exec(s.src);return m?m[1].slice(-60):null;}catch(_){return null;}}
  function readQ(){try{return JSON.parse(localStorage.getItem(QKEY)||"[]");}catch(_){return[];}}
  function writeQ(q){try{localStorage.setItem(QKEY,JSON.stringify(q.slice(-MAXQ)));}catch(_){}}
  function enqueue(rec){var q=readQ();q.push(rec);writeQ(q);}
  function post(rec,onFail){var tk=token();if(!tk){onFail&&onFail(rec);return;}
    var ac=null,tm=null;try{ac=new AbortController();tm=setTimeout(function(){try{ac.abort();}catch(_){}},10000);}catch(_){}
    try{fetch(RPC,{signal:ac&&ac.signal,method:"POST",headers:{"Content-Type":"application/json","apikey":ANON,"Authorization":"Bearer "+tk},
      body:JSON.stringify({p_context:rec.context,p_message:rec.message,p_detail:rec.detail||{},p_severity:rec.severity||"error",
        p_app_version:rec.app_version||null,p_ua:(navigator.userAgent||"").slice(0,400),p_online:!!navigator.onLine}),keepalive:true})
      .then(function(r){tm&&clearTimeout(tm);if(!r.ok)onFail&&onFail(rec);}).catch(function(){tm&&clearTimeout(tm);onFail&&onFail(rec);});
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

/* === العين الشاملة (v2): مراقب استجابات Supabase + بانر انتهاء الجلسة ===
   يلقط أي RPC فاشل من أي صفحة تلقائيًا (تغطية 100% بلا لمس chunks)،
   ويكتشف الجلسة المنتهية (فشل auth متكرر) فيعرض بانر تسجيل دخول واضح. */
(function(){try{
  if(window.__omraaEye)return;window.__omraaEye=1;
  var SB="https://mjetglnmivwphxyzflsz.supabase.co",SEEN={},A401=0,BAN=0;
  function once(k){if(SEEN[k])return!1;SEEN[k]=1;return!0;}
  function banner(){try{
    if(BAN||A401<2)return;BAN=1;
    if(location.pathname.indexOf("/login")>=0)return;
    var d=document.createElement("div");d.setAttribute("dir","rtl");
    d.style.cssText="position:fixed;top:0;left:0;right:0;z-index:99999;background:#b45309;color:#fff;padding:10px 14px;font:14px/1.5 system-ui,-apple-system,sans-serif;text-align:center;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.35)";
    d.textContent="⚠️ انتهت الجلسة — اضغط هنا لتسجيل الدخول من جديد";
    d.onclick=function(){location.href="/omraa/login";};
    (document.body||document.documentElement).appendChild(d);
    window.__omraaLog&&window.__omraaLog("session.expired.banner",{message:"auth failures x"+A401},{severity:"warn"});
  }catch(_){}}
  window.__omraaAuthFail=function(){A401++;banner();};
  var OF=window.fetch;
  window.fetch=function(u,o){
    var url="";try{url=String((u&&u.url)||u);}catch(_){}
    var p=OF.apply(this,arguments);
    try{if(url.indexOf(SB)===0&&url!==SB+"/rest/v1/"){p.then(function(r){try{
      if(!r||r.ok)return;
      var st=r.status;
      if(url.indexOf("/auth/v1/")>=0){if(st===400||st===401||st===403){A401++;banner();}return;}
      if(st===401){
        // «JWT expired» بيتعالج في الحارس (بيستنى الجلسة تتجدد ويعيد الطلب)؛
        // بنعدّه فشل بس لو الحارس نفسه قال إنه فشل.
        if(window.__omraaGuard){r.clone().text().then(function(b){if(String(b).indexOf("PGRST303")<0){A401++;banner();}}).catch(function(){});}
        else{A401++;banner();}
      }
      var fn=(url.split("/rpc/")[1]||url.slice(-60)).split("?")[0];
      var k="rpc:"+fn+":"+st;if(!once(k))return;
      var sev=st>=500?"error":"warn";
      r.clone().text().then(function(b){
        window.__omraaLog&&window.__omraaLog("rpc."+fn,{message:"HTTP "+st},{severity:sev,body:String(b).slice(0,250)});
      }).catch(function(){
        window.__omraaLog&&window.__omraaLog("rpc."+fn,{message:"HTTP "+st},{severity:sev});
      });
    }catch(_){}},function(){});}}catch(_){}
    return p;
  };
}catch(_){}})();


/* === شريط «فيه تحديث» =============================================
   الاستراتيجية network-first بتجيب أحدث كود عند كل **فتح** للصفحة. بس
   إبراهيم بيسيب التطبيق مفتوح طول اليوم — يعني ممكن يفضل شغّال على
   كود قديم لساعات. الـservice worker بيبعت إشارة أول ما نسخة جديدة
   تشتغل، وبنعرض شريط بسيط بدل ما نعمل reload تحته وهو بيكتب. */
(function(){try{
  if(!("serviceWorker" in navigator) || window.__omraaUpd) return;
  window.__omraaUpd = 1;
  var shown = 0;
  navigator.serviceWorker.addEventListener("message", function(e){
    if(!e.data || e.data.type !== "sw-updated" || shown) return;
    // أول تسجيل للـSW بيبعت نفس الإشارة — مش تحديث، فبنتجاهله
    if(!navigator.serviceWorker.controller) return;
    shown = 1;
    var d = document.createElement("div");
    d.setAttribute("dir","rtl");
    d.style.cssText = "position:fixed;inset-inline:0;bottom:0;z-index:99998;background:#0f172a;"+
      "color:#fff;padding:12px 14px calc(12px + env(safe-area-inset-bottom));"+
      "font:14px/1.5 Alexandria,system-ui,sans-serif;display:flex;gap:10px;align-items:center;"+
      "box-shadow:0 -4px 18px rgba(0,0,0,.3)";
    d.innerHTML = '<span style="flex:1">فيه نسخة جديدة من النظام</span>';
    var b = document.createElement("button");
    b.textContent = "حدّث دلوقتي";
    b.style.cssText = "border:0;border-radius:9px;padding:9px 16px;font:inherit;font-weight:700;"+
      "background:#fff;color:#0f172a;cursor:pointer";
    b.onclick = function(){ location.reload(); };
    var x = document.createElement("button");
    x.textContent = "بعدين";
    x.setAttribute("aria-label","إخفاء");
    x.style.cssText = "border:0;background:transparent;color:#94a3b8;font:inherit;cursor:pointer;padding:9px";
    x.onclick = function(){ d.remove(); };
    d.appendChild(b); d.appendChild(x);
    (document.body||document.documentElement).appendChild(d);
  });
}catch(_){}})();
/* === الحارس: النظام يصلّح نفسه من غير ما حد يعمل حاجة ======================
   ① ساعة الجهاز غلط: بناخد الوقت الحقيقي من السيرفر (من التوكن نفسه) ونصحّح
      Date.now عليه. كده لو ساعة الجهاز متقدمة أو متأخرة، الجلسة متتلخبطش
      ومفيش دوامة تجديد توكن (اللي وقّعت جهاز المحل ١١ و١٣ أكتوبر).
   ② الصفحة تعلق: لو الصفحة اتفتحت وسيرفر Supabase بيرد عادي، بس ولا طلب
      بيانات واحد نجح خلال ٣٠ ثانية، يبقى الصفحة ميتة (نسخة محفوظة قديمة أو
      جلسة معلّقة). بنشيل النسخة المحفوظة ونعيد التحميل لوحدنا — مرة كل ١٠ دقايق
      بالكتير. الطابور الأوفلاين والمسودات في localStorage ومش بيتلمسوا.
   مبدأ: الحارس بيبلع كل أخطائه — ممنوع يكسر أي حاجة. */
(function(){try{
  if(window.__omraaGuard)return;window.__omraaGuard=1;
  var SB="https://mjetglnmivwphxyzflsz.supabase.co";
  var ANON="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qZXRnbG5taXZ3cGh4eXpmbHN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NTcwODgsImV4cCI6MjA5NjQzMzA4OH0.X6Rvxo4owPcBwE4HqXLm5fuPDSdEo8PV9oBV-bHsGrg";
  var OF0=window.fetch;
  var SKEW_KEY="omraa.clockSkew.v1",HEAL_KEY="omraa.guard.healAt",MIN_SKEW=30000;
  var realNow=Date.now.bind(Date),skew=0;
  function lsGet(k){try{return localStorage.getItem(k);}catch(_){return null;}}
  function lsSet(k,v){try{localStorage.setItem(k,v);}catch(_){}}
  function log(ctx,msg,extra){try{window.__omraaLog&&window.__omraaLog(ctx,{message:msg},Object.assign({severity:"warn"},extra||{}));}catch(_){}}

  /* ---------- ① تصحيح الساعة ---------- */
  try{var s=JSON.parse(lsGet(SKEW_KEY)||"null");
    if(s&&typeof s.ms==="number"&&Math.abs(s.ms)<30*864e5)skew=s.ms;}catch(_){}
  Date.now=function(){return realNow()+skew;};
  function setSkew(ms,src){
    if(typeof ms!=="number"||!isFinite(ms)||Math.abs(ms)>30*864e5)return;
    var next=Math.abs(ms)<MIN_SKEW?0:Math.round(ms);
    if(Math.abs(next-skew)<5000)return;          // نفس القيمة تقريبًا — متلعبش في الوقت
    var old=skew;skew=next;
    lsSet(SKEW_KEY,JSON.stringify({ms:skew,at:realNow(),src:src}));
    if(skew||old)log("guard.clock_skew","device clock off by "+Math.round(skew/1000)+"s",{skew_s:Math.round(skew/1000),src:src});
  }
  function b64(x){try{x=x.replace(/-/g,"+").replace(/_/g,"/");while(x.length%4)x+="=";return atob(x);}catch(_){return null;}}
  function iatOf(tok){try{var p=JSON.parse(b64(String(tok).split(".")[1])||"null");return p&&p.iat?p.iat*1000:null;}catch(_){return null;}}
  /* المصدر الأساسي للوقت: السيرفر نفسه (مش مرتبط بالجلسة ولا بمكتبة الدخول) */
  var syncing=false,lastSync=0;
  function syncClock(){
    if(syncing||realNow()-lastSync<60000)return;syncing=true;
    var t0=realNow();
    try{(OF0||fetch).call(window,SB+"/rest/v1/rpc/pos_fn_server_time",{method:"POST",cache:"no-store",
      headers:{"Content-Type":"application/json",apikey:ANON},body:"{}"})
      .then(function(r){return r&&r.ok?r.json():null;})
      .then(function(ms){syncing=false;var t1=realNow();
        if(typeof ms==="number"&&t1-t0<5000){lastSync=t1;setSkew(ms-(t0+t1)/2,"server");}},
        function(){syncing=false;});
    }catch(_){syncing=false;}
  }
  window.__omraaClock=function(){return{skew_ms:skew,device:new Date(realNow()).toISOString(),server:new Date(realNow()+skew).toISOString()};};

  /* ---------- مراقبة الطلبات (تصحيح الساعة + علامة إن الصفحة حيّة) ---------- */
  var bootAt=realNow(),dataOkAt=0,reachOkAt=0,refreshes=[];
  var OF=window.fetch;
  if(typeof OF==="function"){
    window.fetch=function(u,o){
      var url="";try{url=String((u&&u.url)||u);}catch(_){}
      var sentAt=realNow();
      var self=this,args=arguments,p=OF.apply(self,args);
      /* ③ السيرفر رفض تجديد الجلسة بسبب ضغط (429): الطلب ما اتنفذش أصلًا، فإعادته
         آمنة. بنعيدها بهدوء بدل ما مكتبة الدخول تفتكر الجلسة باظت وتطلّع الكاشير برّه. */
      if(url.indexOf(SB+"/auth/v1/token")===0){
        p=p.then(function(r){
          if(!r||r.status!==429)return r;
          var tries=0;
          function again(){tries++;
            return new Promise(function(res){setTimeout(res,[2000,5000,10000][tries-1]);})
              .then(function(){return OF.apply(self,args);})
              .then(function(r2){return (r2&&r2.status===429&&tries<3)?again():r2;},function(){return r;});}
          log("guard.auth_429_retry","token endpoint rate-limited, retrying",{});
          syncClock();
          return again();
        });
      }
      if(url.indexOf(SB+"/rest/v1/")===0&&url!==SB+"/rest/v1/"&&typeof u==="string"&&o&&(o.body==null||typeof o.body==="string")){
        var sentAuth=authOf(o);
        if(sentAuth&&sentAuth.indexOf(ANON)<0)p=p.then(function(r){
          if(!r||r.status!==401)return r;
          return r.clone().text().then(function(b){
            if(String(b).indexOf("PGRST303")<0)return r;
            return waitFreshToken(sentAuth,8000).then(function(tk){
              if(!tk){window.__omraaAuthFail&&window.__omraaAuthFail();log("guard.jwt_expired_no_refresh","no fresh token in 8s",{});return r;}
              var h=new Headers(o.headers||{});h.set("Authorization","Bearer "+tk);
              return OF.call(self,u,Object.assign({},o,{headers:h})).then(function(r2){
                if(r2&&r2.status===401)window.__omraaAuthFail&&window.__omraaAuthFail();
                return r2;
              });
            });
          },function(){return r;});
        });
      }
      if(url.indexOf(SB)===0){try{
        var isTok=url.indexOf("/auth/v1/token")>=0;
        if(isTok){refreshes.push(sentAt);refreshes=refreshes.filter(function(t){return sentAt-t<60000;});
          if(refreshes.length>=3){lastSync=0;syncClock();}
          if(refreshes.length===6)log("guard.refresh_storm","6 token refreshes in 60s",{skew_s:Math.round(skew/1000)});}
        p.then(function(r){try{
          if(!r)return;
          if(r.status<500)reachOkAt=realNow();
          var path=url.slice(SB.length).split("?")[0];
          if(r.ok&&path.indexOf("/rest/v1/")===0&&path!=="/rest/v1/")dataOkAt=realNow();
          if(isTok&&r.ok){
            var mid=(sentAt+realNow())/2;
            r.clone().json().then(function(j){var iat=iatOf(j&&j.access_token);if(iat)setSkew(iat-mid,"token");}).catch(function(){});
          }
        }catch(_){}},function(){});
      }catch(_){}}
      return p;
    };
  }
  function readSession(){try{var REF="mjetglnmivwphxyzflsz",c=String(document.cookie||"").split(";"),jar={},raw;
    for(var i=0;i<c.length;i++){var q=c[i].indexOf("=");if(q>0)jar[c[i].slice(0,q).trim()]=c[i].slice(q+1);}
    var nm="sb-"+REF+"-auth-token";raw=jar[nm];
    if(raw===undefined){raw="";for(var n=0;jar[nm+"."+n]!==undefined;n++)raw+=jar[nm+"."+n];}
    if(!raw)raw=lsGet(nm)||"";
    try{raw=decodeURIComponent(raw);}catch(_){}
    if(raw.indexOf("base64-")===0)raw=b64(raw.slice(7))||"";
    var o=raw?JSON.parse(raw):null;if(Array.isArray(o))o={access_token:o[0]};if(o&&o.currentSession)o=o.currentSession;
    return o&&o.access_token?o:null;}catch(_){return null;}}
  function authOf(o){try{var h=o&&o.headers;if(!h)return"";
    if(typeof h.get==="function")return h.get("Authorization")||h.get("authorization")||"";
    return h.Authorization||h.authorization||"";}catch(_){return"";}}
  /* ④ «JWT expired»: التاب كان في الخلفية أو الجهاز نايم، فالطلب خرج بتوكن قديم
     قبل ما مكتبة الدخول تلحق تجدده. PostgREST بيرفضه قبل ما ينفّذ أي حاجة، فإعادته
     آمنة. بنستنى التوكن الجديد (لحد ٨ ثواني) ونعيد الطلب بيه مرة واحدة، بدل ما
     الكاشير يشوف «انتهت الجلسة» وهي ما انتهتش. */
  function waitFreshToken(old,ms){return new Promise(function(res){var t0=realNow();
    (function poll(){var s=readSession(),tk=s&&s.access_token;
      if(tk&&("Bearer "+tk)!==old){var exp=s.expires_at?s.expires_at*1000:0;if(!exp||exp>Date.now()+5000)return res(tk);}
      if(realNow()-t0>ms)return res(null);setTimeout(poll,400);})();});}
  window.__omraaGuardJwt=1;
  /* لو التوكن المحفوظ صادر «في المستقبل» بالنسبة لساعة الجهاز، يبقى الساعة متأخرة أكيد */
  try{var raw=null,REF="mjetglnmivwphxyzflsz",c=String(document.cookie||"").split(";"),jar={};
    for(var i=0;i<c.length;i++){var q=c[i].indexOf("=");if(q>0)jar[c[i].slice(0,q).trim()]=c[i].slice(q+1);}
    var nm="sb-"+REF+"-auth-token";raw=jar[nm];
    if(raw===undefined){raw="";for(var n=0;jar[nm+"."+n]!==undefined;n++)raw+=jar[nm+"."+n];}
    if(!raw)raw=lsGet(nm)||"";
    try{raw=decodeURIComponent(raw);}catch(_){}
    if(raw.indexOf("base64-")===0)raw=b64(raw.slice(7))||"";
    var sess=raw?JSON.parse(raw):null;if(sess&&sess.currentSession)sess=sess.currentSession;
    var iat0=sess&&iatOf(sess.access_token);
    if(iat0&&iat0-realNow()>MIN_SKEW&&skew<iat0-realNow())setSkew(iat0-realNow()+1000,"stored-token");
  }catch(_){}

  /* ---------- ② الصفحة الميتة ---------- */
  var page=(location.pathname.split("/").pop()||"index").replace(/\.html$/,"");
  var WATCH=/^(index|pos|dashboard|products|inventory|returns-v2|returns-classic|shipping|orders|customers|labels|stocktake|settings|reorder|accounting|backup|users|suppliers|strategy|merchandising|website|photos)$/;
  function hasSession(){try{return document.cookie.indexOf("auth-token")>=0||!!lsGet("sb-mjetglnmivwphxyzflsz-auth-token");}catch(_){return false;}}
  function heal(reason){
    var last=+(lsGet(HEAL_KEY)||0);
    if(realNow()-last<600000)return;               // مرة كل ١٠ دقايق بالكتير — مستحيل يدخل في لفّة
    lsSet(HEAL_KEY,String(realNow()));
    log("guard.self_heal",reason,{page:page});
    var done=function(){try{location.reload();}catch(_){}};
    var jobs=[];
    try{if(navigator.serviceWorker&&navigator.serviceWorker.getRegistrations)
      jobs.push(navigator.serviceWorker.getRegistrations().then(function(rs){return Promise.all(rs.map(function(r){return r.unregister();}));}));}catch(_){}
    try{if(window.caches&&caches.keys)
      jobs.push(caches.keys().then(function(ks){return Promise.all(ks.map(function(k){return caches.delete(k);}));}));}catch(_){}
    Promise.all(jobs).then(done,done);
    setTimeout(done,4000);                          // لو حاجة علّقت، نعيد التحميل برضه
  }
  function probe(){
    var ctrl=null;try{ctrl=new AbortController();setTimeout(function(){try{ctrl.abort();}catch(_){}},8000);}catch(_){}
    return (OF||fetch).call(window,SB+"/auth/v1/health",{cache:"no-store",signal:ctrl&&ctrl.signal})
      .then(function(r){return !!r&&r.status<500;},function(){return false;});
  }
  function check(){
    try{
      if(!WATCH.test(page)||!hasSession())return;
      if(document.visibilityState==="hidden")return;
      if(dataOkAt&&realNow()-dataOkAt<120000)return;            // الصفحة شغالة
      if(!dataOkAt&&realNow()-bootAt<30000)return;              // لسه بتحمّل
      if(navigator.onLine===false)return;                        // النت فاصل فعلًا — الأوفلاين شغله
      probe().then(function(reach){
        if(!reach)return;                                        // السيرفر مش بيرد = مشكلة نت، مش الصفحة
        if(dataOkAt&&realNow()-dataOkAt<120000)return;
        if(!dataOkAt)heal("no data request succeeded in "+Math.round((realNow()-bootAt)/1000)+"s while server reachable");
      });
    }catch(_){}
  }
  syncClock();
  setInterval(function(){lastSync=0;syncClock();},600000);
  try{document.addEventListener("visibilitychange",function(){if(document.visibilityState==="visible")syncClock();});
    window.addEventListener("online",function(){lastSync=0;syncClock();});}catch(_){}
  setTimeout(check,32000);
  setInterval(check,60000);
}catch(_){}})();


/* === فلاتر الجداول + البحث الشامل ===================================
   ملف منفصل، بيتحمّل من هنا عشان كل الصفحات بتحمّل الملف ده أصلًا
   (ومنه بيفضل شغال مع التنقّل الداخلي بين الصفحات من غير إعادة تحميل). */
(function(){try{
  if(window.__omraaFiltersLoader)return;window.__omraaFiltersLoader=1;
  var s=document.createElement("script");
  s.src="/omraa/omraa-filters.js?v=1";s.async=true;
  (document.head||document.documentElement).appendChild(s);
}catch(_){}})();
