/* بانر «انتهت الجلسة»: مايظهرش لو الجلسة رجعت خلال 12 ثانية، ويختفي لوحده لو رجعت بعد ما ظهر.
   الاستخدام: JSDOM=<path to jsdom> node scripts/banner_defer.test.js omraa-telemetry.js */
const fs=require('fs');const {JSDOM}=require(process.env.JSDOM||'jsdom');
const CODE=fs.readFileSync(process.argv[2]||'omraa-telemetry.js','utf8');
const REF='mjetglnmivwphxyzflsz',SB='https://'+REF+'.supabase.co';
const b64url=t=>Buffer.from(t).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const iat=Math.floor(Date.now()/1000);
const USER='h.'+b64url(JSON.stringify({iat,exp:iat+3600,role:'authenticated'}))+'.s';
const ANON='h.'+b64url(JSON.stringify({iat,exp:iat+3600,role:'anon'}))+'.s';
let pass=0;const must=(c,m)=>{if(!c){console.log('  ✗ '+m);process.exitCode=1;}else{console.log('  ✓ '+m);pass++;}};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function boot(){
  const dom=new JSDOM('<body></body>',{runScripts:'dangerously',url:'https://mohabbeshier.github.io/omraa/dashboard.html'});
  const w=dom.window;if(!w.TextDecoder)w.TextDecoder=require('util').TextDecoder;
  Object.defineProperty(w.document,'cookie',{get:()=>`sb-${REF}-auth-token=base64-${b64url(JSON.stringify({access_token:USER,expires_at:iat+3600}))}`,set:()=>{},configurable:true});
  const resp=(s,b)=>({ok:s>=200&&s<300,status:s,clone(){return resp(s,b)},text:async()=>b||'[]',json:async()=>JSON.parse(b||'[]'),headers:{get:()=>null}});
  w.fetch=async(u)=>{u=String((u&&u.url)||u);if(u.includes('server_time'))return resp(200,String(Date.now()));return resp(200,'[]');};
  const el=w.document.createElement('script');el.textContent=CODE;w.document.body.appendChild(el);
  const shown=()=>[...w.document.querySelectorAll('div')].some(d=>(d.textContent||'').startsWith('⚠️ انتهت الجلسة'));
  const ok=(tok)=>w.fetch(SB+'/rest/v1/rpc/pos_fn_dashboard_stats',{method:'POST',headers:{Authorization:'Bearer '+tok,apikey:'x'},body:'{}'});
  return {w,shown,ok};
}
(async()=>{
  console.log('━━ فشلين وبعدهم الجلسة رجعت خلال ثواني (نت موبايل بطيء)');
  let b=boot();b.w.__omraaAuthFail();b.w.__omraaAuthFail();
  await wait(300);must(!b.shown(),'مفيش بانر فورًا');
  await wait(2000);await b.ok(USER);await wait(11000);
  must(!b.shown(),'مفيش بانر خالص لأن طلب بصلاحية الدخول نجح');
  console.log('━━ الجلسة ماتت فعلًا');
  b=boot();b.w.__omraaAuthFail();b.w.__omraaAuthFail();
  await b.ok(ANON); // طلب عام بمفتاح anon نجح — ده مش دليل إن الجلسة رجعت
  await wait(12600);
  must(b.shown(),'البانر ظهر بعد 12 ثانية');
  console.log('━━ البانر ظاهر والجلسة رجعت');
  await b.ok(USER);await wait(100);
  must(!b.shown(),'البانر اختفى لوحده');
  console.log(`\n${pass} نجح`);process.exit(process.exitCode||0);
})();
