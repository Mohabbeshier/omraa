/* سجل الأخطاء: لو اترفض وقت الجلسة بايظة يتحفظ، ويتبعت أول ما الجلسة تتجدد.
   الاستخدام: JSDOM=<path to jsdom> node scripts/log_queue.test.js omraa-telemetry.js */
const fs=require('fs');const {JSDOM}=require(process.env.JSDOM||'jsdom');
const CODE=fs.readFileSync(process.argv[2]||'omraa-telemetry.js','utf8');
const REF='mjetglnmivwphxyzflsz',SB='https://'+REF+'.supabase.co';
const b64url=t=>Buffer.from(t).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const iat=Math.floor(Date.now()/1000);
const TOK='h.'+b64url(JSON.stringify({iat,exp:iat+3600,role:'authenticated'}))+'.s';
let pass=0;const must=(c,m)=>{if(!c){console.log('  ✗ '+m);process.exitCode=1;}else{console.log('  ✓ '+m);pass++;}};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function boot(logStatus){
  const dom=new JSDOM('<body></body>',{runScripts:'dangerously',url:'https://mohabbeshier.github.io/omraa/dashboard.html'});
  const w=dom.window;
  Object.defineProperty(w.document,'cookie',{get:()=>`sb-${REF}-auth-token=base64-${b64url(JSON.stringify({access_token:TOK,expires_at:iat+3600}))}`,set:()=>{},configurable:true});
  if(!w.TextDecoder)w.TextDecoder=require('util').TextDecoder; // JSDOM مافيهوش
  const st={log:logStatus,sent:[]};
  const resp=(s,b)=>({ok:s>=200&&s<300,status:s,clone(){return resp(s,b)},text:async()=>b||'{}',json:async()=>JSON.parse(b||'{}'),headers:{get:()=>null}});
  w.fetch=async(u,o)=>{u=String((u&&u.url)||u);
    if(u.includes('pos_fn_log_client_error')){st.sent.push(JSON.parse(o.body).p_context);return resp(st.log,st.log===401?'{"code":"PGRST301","message":"JWT expired"}':'{}');}
    if(u.includes('/auth/v1/token'))return resp(200,JSON.stringify({access_token:TOK}));
    if(u.includes('pos_fn_server_time'))return resp(200,JSON.stringify(Date.now()));
    return resp(200,'[]');};
  const el=w.document.createElement('script');el.textContent=CODE;w.document.body.appendChild(el);
  return {w,st};
}
(async()=>{
  console.log('━━ رفض مؤقت (401) ⇐ يتحفظ، ومايتسجّلش فشل التسجيل نفسه');
  let {w,st}=boot(401);
  w.__omraaLog('test.one',new Error('x'));await wait(50);
  const q=JSON.parse(w.localStorage.getItem('omraa_err_queue')||'[]');
  must(q.some(r=>r.context==='test.one'),'الخطأ اتحفظ في الطابور');
  must(!st.sent.includes('rpc.pos_fn_log_client_error'),'مفيش سطر «log_client_error 401» اتعمل');
  must(![...w.document.querySelectorAll('div')].some(d=>(d.textContent||'').startsWith('⚠️ انتهت الجلسة')),'فشل التسجيل مابيطلّعش بانر الجلسة');
  console.log('━━ الجلسة اتجددت ⇐ الطابور يتبعت لوحده');
  st.log=200;st.sent.length=0;
  await w.fetch(SB+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{}});
  await wait(2500);
  must(st.sent.includes('test.one'),'اتبعت بعد تجديد الجلسة من غير إعادة تحميل');
  must(JSON.parse(w.localStorage.getItem('omraa_err_queue')||'[]').length===0,'الطابور فضي');
  console.log('━━ رفض دائم (400) ⇐ مايلفّش للأبد');
  ({w,st}=boot(400));
  w.__omraaLog('test.bad',new Error('y'));await wait(50);
  must(!JSON.parse(w.localStorage.getItem('omraa_err_queue')||'[]').some(r=>r.context==='test.bad'),'السجل البايظ مااتحفظش');
  console.log(`\n${pass} نجح`);process.exit(process.exitCode||0);
})();
