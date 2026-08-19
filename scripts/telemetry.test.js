/* التليمتري لازم تلاقي الجلسة وتبعت الخطأ فعلًا، وتفضّي الطابور المتراكم. */
const fs=require('fs'); const {JSDOM}=require('/tmp/node_modules/jsdom');
const CODE=fs.readFileSync('/home/claude/pos/omraa-telemetry.js','utf8');
const REF='mjetglnmivwphxyzflsz';
const b64url=t=>Buffer.from(t,'utf8').toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const SESSION={access_token:'TOK',expires_at:Math.floor(Date.now()/1000)+3600};
let pass=0; const ok=m=>{console.log('  ✓ '+m);pass++};
const must=(c,m)=>{if(!c) throw new Error('✗ '+m); ok(m)};

function boot({cookie,local,queue}={}){
  const dom=new JSDOM('<body></body>',{runScripts:'dangerously',url:'https://mohabbeshier.github.io/omraa/dashboard.html'});
  const w=dom.window;
  Object.defineProperty(w.document,'cookie',{get:()=>cookie||'',set:()=>{},configurable:true});
  if(local) w.localStorage.setItem(`sb-${REF}-auth-token`, local);
  if(queue) w.localStorage.setItem('omraa_err_queue', JSON.stringify(queue));
  const sent=[];
  w.fetch=async(u,o)=>{ sent.push({url:String(u),auth:(o&&o.headers&&o.headers.Authorization)||null,
    body:o&&o.body?JSON.parse(o.body):null}); return {ok:true,status:200,clone:()=>({text:async()=>'{}'}),text:async()=>'{}'}; };
  w.AbortController=class{constructor(){this.signal={}}abort(){}};
  const el=w.document.createElement('script'); el.textContent=CODE; w.document.body.appendChild(el);
  return {w,sent};
}
const COOKIE=`sb-${REF}-auth-token=base64-${b64url(JSON.stringify(SESSION))}`;

// ① الحالة الحقيقية: كوكي base64 — كانت بتفشل
let {w,sent}=boot({cookie:COOKIE});
w.eval('__omraaLog("test.ctx", new Error("خطأ تجريبي"), {extra:1})');
await0();
async function await0(){}
setTimeout(()=>{},0);
must(sent.length>=1, 'الخطأ اتبعت فعلًا (كان بيتحبس في الطابور)');
must(sent[0].auth==='Bearer TOK','اتبعت بجلسة المالك مش anon');
must(sent[0].url.includes('pos_fn_log_client_error'),'على الدالة الصح');
must(sent[0].body.p_message.includes('خطأ تجريبي'),'الرسالة العربية سليمة');
must(w.JSON.parse(w.localStorage.getItem('omraa_err_queue')||'[]').length===0,'مفيش طابور متراكم');

// ② الطابور القديم المتراكم بيتفضّى أول ما الجلسة تتقري
({w,sent}=boot({cookie:COOKIE, queue:[{context:'old1',message:'م١'},{context:'old2',message:'م٢'}]}));
must(sent.length===2,`الطابور المتراكم اتبعت (${sent.length} رسالة)`);

// ③ كوكي متقسّمة
const enc='base64-'+b64url(JSON.stringify(SESSION)); const h=Math.ceil(enc.length/2);
({w,sent}=boot({cookie:`sb-${REF}-auth-token.0=${enc.slice(0,h)}; sb-${REF}-auth-token.1=${enc.slice(h)}`}));
w.eval('__omraaLog("c","x")');
must(sent.length===1 && sent[0].auth==='Bearer TOK','كوكي متقسّمة');

// ④ localStorage القديم لسه بيشتغل
({w,sent}=boot({local:JSON.stringify(SESSION)}));
w.eval('__omraaLog("c","x")');
must(sent.length===1,'localStorage القديم fallback');

// ⑤ مفيش جلسة → يتخزن في الطابور مش يضيع
({w,sent}=boot({}));
w.eval('__omraaLog("c","x")');
must(sent.length===0,'من غير جلسة ما بيبعتش');
must(w.JSON.parse(w.localStorage.getItem('omraa_err_queue')||'[]').length===1,'بس بيتخزن للطابور ما يضيعش');

// ⑥ خطأ عام غير ممسوك بيتسجّل
({w,sent}=boot({cookie:COOKIE}));
w.dispatchEvent(Object.assign(new w.Event('error'),{error:new Error('انهيار'),filename:'x.js',lineno:1,colno:2}));
must(sent.some(s=>s.body&&/انهيار/.test(s.body.p_message)),'window.onerror بيتسجّل');

console.log(`\n✅ ${pass} فحص نجح`);
