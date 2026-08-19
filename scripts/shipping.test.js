/* شاشة الشحن في DOM حقيقي: كل تبويب، كل زرار، والفلو من أول ما تتشحن
   لحد ما الفلوس تتحصّل. */
const fs=require('fs'); const {JSDOM}=require('/tmp/node_modules/jsdom');
const ROOT='/home/claude/pos';
const REF='mjetglnmivwphxyzflsz';
const b64=t=>Buffer.from(t,'utf8').toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const COOKIE=`sb-${REF}-auth-token=base64-${b64(JSON.stringify({access_token:'TOK',expires_at:Math.floor(Date.now()/1000)+3600}))}`;

const day=86400000;
let DB=[
 {id:'s1',customer:'سلوي محسن',phone:'01112697619',address:'العبور',cod:550,total:550,
  status:'preparing',status_label:'تحت التجهيز للشحن',money:'waiting',money_label:'لسه معلقة',
  courier:'RO.R',sale_code:'INV-313',created_at:new Date(Date.now()-9*day).toISOString(),stage:1},
 {id:'s2',customer:'هاجر السيد',phone:'01060971283',address:'دمياط',cod:1500,total:1500,
  status:'preparing',status_label:'تحت التجهيز للشحن',money:'waiting',money_label:'لسه معلقة',
  courier:'RO.R',sale_code:'INV-312',created_at:new Date(Date.now()-1*day).toISOString(),stage:1},
 {id:'s3',customer:'منى',phone:'0100',address:'طنطا',cod:800,total:800,
  status:'with_courier',status_label:'تم الشحن',money:'waiting',money_label:'لسه معلقة',
  courier:'الامراء',sale_code:'INV-300',created_at:new Date(Date.now()-4*day).toISOString(),stage:2},
 {id:'s4',customer:'ريم',phone:'0102',address:'المنصورة',cod:1200,total:1200,
  status:'delivered',status_label:'تم التسليم',money:'waiting',money_label:'لسه معلقة',
  courier:'RO.R',sale_code:'INV-290',created_at:new Date(Date.now()-6*day).toISOString(),stage:4},
];
const calls=[];
function rpc(fn,a){
  calls.push({fn,a});
  if(fn==='pos_fn_shipments'){
    const v=a.p_view;
    const rows=DB.filter(r=> v==='active' ? ['preparing','with_courier','out_for_delivery'].includes(r.status)
      : r.money==='waiting' && !['returned','lost'].includes(r.status));
    return {ok:true,shipments:JSON.parse(JSON.stringify(rows))};
  }
  if(fn==='pos_fn_update_shipment'){
    const r=DB.find(x=>x.id===a.p_shipment); if(!r) return {ok:false,error:'not_found'};
    if(!['preparing','with_courier','out_for_delivery','delivered','returned','lost'].includes(a.p_status))
      return {ok:false,error:'bad_status'};
    r.status=a.p_status;
    r.status_label={preparing:'تحت التجهيز للشحن',with_courier:'تم الشحن',out_for_delivery:'تحت التسليم',
      delivered:'تم التسليم',returned:'لم يُسلَّم — رجعت للمخزون',lost:'مفقودة'}[a.p_status];
    return {ok:true};
  }
  if(fn==='pos_fn_bulk_ship_update'){
    if(!a.p_ids||!a.p_ids.length) return {ok:false,error:'empty'};
    let n=0; for(const id of a.p_ids){ const r=rpc('pos_fn_update_shipment',{p_shipment:id,p_status:a.p_status}); if(r.ok)n++; }
    return {ok:true,updated:n,failed:[]};
  }
  if(fn==='pos_fn_settle_money'){
    const bad=a.p_ids.filter(id=>{const r=DB.find(x=>x.id===id);return !r||r.status!=='delivered'||r.money!=='waiting';});
    if(bad.length) return {ok:false,error:'not_settleable',count:bad.length};
    const exp=a.p_ids.reduce((s,id)=>s+DB.find(x=>x.id===id).cod,0);
    a.p_ids.forEach(id=>{const r=DB.find(x=>x.id===id);r.money='received';r.money_label='تم التحصيل';});
    return {ok:true,count:a.p_ids.length,expected:exp,received:a.p_received,diff:a.p_received-exp};
  }
  throw new Error('unstubbed '+fn);
}

const dom=new JSDOM(fs.readFileSync(ROOT+'/shipping.html','utf8').replace(/<script[\s\S]*?<\/script>/g,''),
  {runScripts:'dangerously',url:'https://mohabbeshier.github.io/omraa/shipping.html',pretendToBeVisual:true});
const w=dom.window;
Object.defineProperty(w.document,'cookie',{get:()=>COOKIE,set:()=>{},configurable:true});
const errs=[]; w.onerror=(m)=>errs.push(m);
w.addEventListener('unhandledrejection',e=>errs.push('rej:'+(e.reason&&e.reason.message)));
w.confirm=()=>true; w.scrollTo=()=>{};
w.fetch=async(u,o)=>{ const fn=String(u).split('/rpc/')[1];
  const auth=(o.headers.Authorization||'').replace('Bearer ','');
  if(auth!=='TOK') errs.push('نداء بمفتاح الزائر: '+fn);
  try{ return {ok:true,status:200,text:async()=>JSON.stringify(rpc(fn,JSON.parse(o.body||'{}')))}; }
  catch(e){ return {ok:false,status:400,text:async()=>JSON.stringify({message:e.message})}; } };
const el=w.document.createElement('script'); el.textContent=fs.readFileSync(ROOT+'/shipping.js','utf8');
w.document.body.appendChild(el);

const T=ms=>new Promise(r=>setTimeout(r,ms));
const txt=()=>{const c=w.document.body.cloneNode(true);c.querySelectorAll('script').forEach(n=>n.remove());
  return c.textContent.replace(/\s+/g,' ');};
const btns=sel=>[...w.document.querySelectorAll(sel)];
const clickText=(t)=>{const b=btns('button,a').find(x=>x.textContent.includes(t));
  if(!b) throw new Error('✗ مفيش زرار: '+t); b.dispatchEvent(new w.MouseEvent('click',{bubbles:true})); return b;};
let pass=0; const ok=m=>{console.log('  ✓ '+m);pass++};
const must=(c,m)=>{if(!c) throw new Error('✗ '+m); ok(m)};

(async()=>{
  await T(150);
  console.log('━━ الفتح ━━');
  must(txt().includes('سلوي محسن'),'الشحنات ظهرت');
  must(txt().includes('محتاج حاجة'),'التبويب الافتراضي «محتاج حاجة»');
  must(/سلوي محسن[\s\S]{0,400}هاجر السيد/.test(txt()),'الأقدم فوق (٩ أيام قبل ١ يوم)');
  must(txt().includes('من ٩ يوم'),'بيقول بقالها كام يوم');
  must(txt().includes('طلعت مع المندوب'),'الزرار الكبير = الخطوة اللي بعدها');
  must(txt().includes('٥٥٠ ج'),'المبلغ ظاهر بالعربي');

  console.log('━━ ضغطة واحدة تحرّك الشحنة ━━');
  clickText('طلعت مع المندوب'); await T(120);
  must(DB.find(r=>r.id==='s1').status==='with_courier','اتحركت لـ«مع المندوب»');
  must(!txt().includes('سلوي محسن'),'خرجت من «محتاج حاجة»');
  clickText('مع المندوب'); await T(80);   // التبويب
  must(txt().includes('سلوي محسن'),'ظهرت في «مع المندوب»');
  must(txt().includes('بيوصّلها دلوقتي'),'الزرار بقى الخطوة التالية');

  console.log('━━ الفلو كامل لحد التسليم ━━');
  clickText('بيوصّلها دلوقتي'); await T(120);
  must(DB.find(r=>r.id==='s1').status==='out_for_delivery','تحت التسليم');
  clickText('وصلت للعميلة'); await T(120);
  must(DB.find(r=>r.id==='s1').status==='delivered','اتسلّمت');

  console.log('━━ الفلوس ━━');
  clickText('فلوس مستنية'); await T(80);
  must(txt().includes('ريم'),'اللي اتسلّمت وفلوسها مستنية بتظهر هنا');
  must(txt().includes('حصّلت الفلوس'),'زرار التحصيل');
  must(/فلوس مستنية التحصيل/.test(txt()),'إجمالي المستحق ظاهر');
  clickText('حصّلت الفلوس'); await T(80);
  must(w.document.querySelector('.sheet'),'لوحة التحصيل فتحت');
  must(txt().includes('المفروض'),'بيقول المبلغ المتوقع');
  clickText('تأكيد التحصيل'); await T(150);
  // القايمة مرتّبة بالأقدم، فأول كارت هو s1 (٩ أيام) مش ريم (٦)
  must(DB.find(r=>r.id==='s1').money==='received','الفلوس اتسجّلت لأول كارت');
  must(!txt().includes('سلوي محسن'),'خرجت من «فلوس مستنية» بعد التحصيل');
  must(txt().includes('ريم'),'الباقي لسه ظاهر');

  console.log('━━ التحديد الجماعي ━━');
  clickText('محتاج حاجة'); await T(80);
  const picks=btns('.pick'); must(picks.length>=1,'فيه مربعات تحديد');
  picks.forEach(p=>p.dispatchEvent(new w.MouseEvent('click',{bubbles:true}))); await T(80);
  must(w.document.querySelector('.bulkbar'),'شريط التحديد ظهر');
  must(txt().includes('كلهم طلعوا مع المندوب'),'فعل جماعي مناسب للمرحلة');
  clickText('كلهم طلعوا مع المندوب'); await T(200);
  must(DB.filter(r=>r.status==='with_courier').length>=1,'الجماعي اشتغل');

  console.log('━━ لوحة الحالات النادرة ━━');
  clickText('مع المندوب'); await T(80);
  clickText('…'); await T(80);
  must(w.document.querySelector('.sheet'),'لوحة «…» فتحت');
  must(txt().includes('رجعت — العميلة رفضت'),'خيار الرجيع موجود');
  must(txt().includes('رجّع خطوة لورا'),'ينفع يصلّح غلطة');
  must(txt().includes('واتساب'),'واتساب العميلة');
  const before=DB.filter(r=>r.status==='returned').length;
  clickText('رجعت — العميلة رفضت'); await T(200);
  must(DB.filter(r=>r.status==='returned').length===before+1,'الرجيع اتسجّل');

  console.log('━━ البحث ━━');
  clickText('محتاج حاجة'); await T(60);
  const s=w.document.querySelector('.search');
  if(s){ s.value='هاجر'; s.dispatchEvent(new w.Event('input',{bubbles:true})); await T(80); }

  console.log('━━ السلامة ━━');
  must(errs.length===0,`مفيش أخطاء (${errs.join(' | ')})`);
  must(!/undefined|NaN|\[object Object\]/.test(txt()),'مفيش قيم مكسورة');
  console.log(`\n✅ ${pass} فحص نجح · ${calls.length} نداء`);
})().catch(e=>{console.error('\n'+e.message+'\n---\n'+txt().slice(0,600));process.exit(1);});
