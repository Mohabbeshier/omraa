/* سيناريوهات الخطر الحقيقية في شاشة الشحن:
   نت مقطوع · ضغط مزدوج · جلسة منتهية · رد متأخر · خطأ سيرفر. */
const fs=require('fs'); const {JSDOM}=require('/tmp/node_modules/jsdom');
const ROOT='/home/claude/pos', REF='mjetglnmivwphxyzflsz';
const b64=t=>Buffer.from(t,'utf8').toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const sess=(exp)=>`sb-${REF}-auth-token=base64-${b64(JSON.stringify({access_token:'TOK',expires_at:exp}))}`;
const FUTURE=Math.floor(Date.now()/1000)+3600, PAST=Math.floor(Date.now()/1000)-60;
let pass=0; const ok=s=>{console.log('  ✓ '+s);pass++};
const must=(c,s)=>{if(!c) throw new Error('✗ '+s); ok(s)};
const T=ms=>new Promise(r=>setTimeout(r,ms));

function boot(handler, cookie){
  const dom=new JSDOM(fs.readFileSync(ROOT+'/shipping.html','utf8').replace(/<script[\s\S]*?<\/script>/g,''),
    {runScripts:'dangerously',url:'https://x.test/omraa/shipping.html',pretendToBeVisual:true});
  const w=dom.window; const errs=[];
  Object.defineProperty(w.document,'cookie',{get:()=>cookie||sess(FUTURE),set:()=>{},configurable:true});
  w.onerror=m=>errs.push('onerror:'+m);
  w.addEventListener('unhandledrejection',e=>errs.push('rej:'+(e.reason&&e.reason.message)));
  w.confirm=()=>true; w.scrollTo=()=>{};
  const calls=[];
  w.fetch=async(u,o)=>{ const fn=String(u).split('/rpc/')[1]; calls.push(fn); return handler(fn,JSON.parse(o.body||'{}')); };
  const el=w.document.createElement('script'); el.textContent=fs.readFileSync(ROOT+'/shipping.js','utf8');
  w.document.body.appendChild(el);
  const vis=()=>{const c=w.document.body.cloneNode(true);c.querySelectorAll('script').forEach(n=>n.remove());
    return c.textContent.replace(/\s+/g,' ');};
  return {w,errs,calls,vis};
}
const ROWS={ok:true,shipments:[{id:'s1',customer:'سلوي',phone:'01',address:'ع',cod:550,total:550,
  status:'preparing',status_label:'تحت التجهيز للشحن',money:'waiting',money_label:'لسه معلقة',
  courier:'RO.R',sale_code:'INV-1',created_at:new Date().toISOString(),stage:1}]};
const okRes=d=>({ok:true,status:200,text:async()=>JSON.stringify(d)});

(async()=>{
  console.log('━━ ١. النت اتقطع وهو بيضغط ━━');
  let net=true;
  let t=boot((fn)=>{ if(!net) return Promise.reject(new TypeError('Failed to fetch'));
    return okRes(fn==='pos_fn_shipments'?ROWS:{ok:true}); });
  await T(150);
  must(t.vis().includes('سلوي'),'الشحنات ظهرت');
  net=false;
  [...t.w.document.querySelectorAll('button')].find(b=>b.textContent.includes('طلعت'))
    .dispatchEvent(new t.w.MouseEvent('click',{bubbles:true}));
  await T(200);
  must(t.errs.length===0,`مفيش استثناء غير ممسوك (${t.errs.join('|')})`);
  must(/Failed to fetch|مشكلة|مش لاقي/.test(t.vis()),'ظهرت رسالة للمستخدم مش فشل صامت');
  must(t.vis().includes('سلوي'),'الشحنة فضلت في مكانها — ما اتحركتش بالغلط');

  console.log('━━ ٢. ضغط مزدوج سريع (خطر تسجيل مرتين) ━━');
  let n=0;
  t=boot(async(fn)=>{ if(fn==='pos_fn_shipments') return okRes(ROWS);
    n++; await T(120); return okRes({ok:true}); });
  await T(150);
  const b=[...t.w.document.querySelectorAll('button')].find(x=>x.textContent.includes('طلعت'));
  b.dispatchEvent(new t.w.MouseEvent('click',{bubbles:true}));
  b.dispatchEvent(new t.w.MouseEvent('click',{bubbles:true}));
  b.dispatchEvent(new t.w.MouseEvent('click',{bubbles:true}));
  await T(400);
  must(n===1,`اتنفّذ مرة واحدة رغم ٣ ضغطات (${n})`);

  console.log('━━ ٣. تحصيل فلوس مرتين (أخطر واحدة — بيعمل تسوية) ━━');
  let settles=0;
  const DELIVERED={ok:true,shipments:[{...ROWS.shipments[0],status:'delivered',
    status_label:'تم التسليم',stage:4}]};
  t=boot(async(fn)=>{ if(fn==='pos_fn_shipments') return okRes(DELIVERED);
    if(fn==='pos_fn_settle_money'){ settles++; await T(120); return okRes({ok:true,count:1,expected:550,received:550,diff:0}); }
    return okRes({ok:true}); });
  await T(150);
  // الشحنة المسلَّمة بتقع في تبويب «فلوس مستنية» مش الافتراضي
  t.w.eval('go("money")'); await T(80);
  [...t.w.document.querySelectorAll('button')].find(x=>x.textContent.includes('حصّلت'))
    .dispatchEvent(new t.w.MouseEvent('click',{bubbles:true}));
  await T(80);
  const conf=[...t.w.document.querySelectorAll('button')].find(x=>x.textContent.includes('تأكيد التحصيل'));
  conf.dispatchEvent(new t.w.MouseEvent('click',{bubbles:true}));
  conf.dispatchEvent(new t.w.MouseEvent('click',{bubbles:true}));
  await T(400);
  must(settles===1,`تسوية واحدة بس رغم ضغطتين (${settles})`);

  console.log('━━ ٤. الجلسة انتهت وهو شغّال ━━');
  t=boot((fn)=>{ if(fn==='pos_fn_shipments') return okRes(ROWS);
    return {ok:false,status:401,text:async()=>JSON.stringify({message:'JWT expired'})}; }, sess(PAST));
  await T(150);
  const b4=[...t.w.document.querySelectorAll('button')].find(x=>x.textContent.includes('طلعت'));
  if(b4){ b4.dispatchEvent(new t.w.MouseEvent('click',{bubbles:true})); await T(200); }
  must(/انتهت|سجّل دخول/.test(t.vis()),'بيقوله الجلسة انتهت مش رسالة تقنية');

  console.log('━━ ٥. السيرفر رفض العملية ━━');
  t=boot((fn)=>{ if(fn==='pos_fn_shipments') return okRes(ROWS);
    return okRes({ok:false,error:'not_settleable'}); });
  await T(150);
  [...t.w.document.querySelectorAll('button')].find(x=>x.textContent.includes('طلعت'))
    .dispatchEvent(new t.w.MouseEvent('click',{bubbles:true}));
  await T(250);
  must(/لسه ما وصلتش|مشكلة/.test(t.vis()),'رسالة عربية مفهومة مش كود إنجليزي');
  must(t.errs.length===0,'مفيش استثناء');

  console.log('━━ ٦. النت رجع بعد الفشل ━━');
  net=false; let loads=0;
  t=boot((fn)=>{ if(!net) return Promise.reject(new TypeError('Failed to fetch'));
    if(fn==='pos_fn_shipments'){loads++; return okRes(ROWS);} return okRes({ok:true}); });
  await T(200);
  must(/مفيش نت/.test(t.vis()),'شاشة «مفيش نت» واضحة بالعربي');
  must(/جرّب تاني/.test(t.vis()),'فيه زرار إعادة محاولة');
  net=true;
  // الرجوع للتطبيق بعد ما النت رجع لازم يحمّل لوحده
  Object.defineProperty(t.w.document,'visibilityState',{get:()=>'visible',configurable:true});
  t.w.document.dispatchEvent(new t.w.Event('visibilitychange'));
  await T(300);
  must(loads>=1,`الرجوع للتطبيق حمّل لوحده (${loads})`);
  must(t.vis().includes('سلوي'),'الشحنات ظهرت من غير ما يعمل حاجة');

  console.log('━━ ٧. حدث online بيحمّل لوحده ━━');
  net=false; let l2=0;
  const t2=boot((fn)=>{ if(!net) return Promise.reject(new TypeError('Failed to fetch'));
    if(fn==='pos_fn_shipments'){l2++; return okRes(ROWS);} return okRes({ok:true}); });
  await T(200);
  net=true;
  t2.w.dispatchEvent(new t2.w.Event('online'));
  await T(300);
  must(l2>=1,`رجوع النت حمّل لوحده (${l2})`);

  console.log(`\n✅ ${pass} فحص نجح`);
})().catch(e=>{console.error('\n'+e.message);process.exit(1);});
