/* فحص عميق: المانيفست، الـSW، الأوفلاين، شريط التحديث، والوضع المستقل. */
const fs=require('fs'), path=require('path'), vm=require('vm');
const {JSDOM}=require('/tmp/node_modules/jsdom');
const ROOT='/home/claude/pos';
let pass=0; const ok=s=>{console.log('  ✓ '+s);pass++};
const must=(c,s)=>{if(!c) throw new Error('✗ '+s); ok(s)};

console.log('━━ المانيفست: النسختين متطابقتين ━━');
const a=JSON.parse(fs.readFileSync(ROOT+'/manifest.json','utf8'));
const b=JSON.parse(fs.readFileSync(ROOT+'/manifest.webmanifest','utf8'));
must(JSON.stringify(a)===JSON.stringify(b),'manifest.json و .webmanifest متطابقين حرفيًا');
must(a.prefer_related_applications===false,'مش بيقترح تطبيق تاني بدالنا');
must(!('orientation' in a),'مفيش قفل اتجاه — التقارير محتاجة العرض');
must(a.start_url.startsWith(a.scope),'start_url جوّه النطاق (لو برّه، المتصفح بيرفض المانيفست)');
const anyIc=a.icons.filter(i=>i.purpose==='any'&&i.type==='image/png');
const mask=a.icons.filter(i=>i.purpose==='maskable');
must(anyIc.some(i=>i.sizes==='192x192')&&anyIc.some(i=>i.sizes==='512x512'),'192+512 PNG بغرض any');
must(mask.length>=1,'maskable منفصلة (مش "any maskable" — ده بيصغّر الأيقونة)');
must(!a.icons.some(i=>String(i.purpose).includes(' ')),'مفيش أيقونة بغرضين مدموجين');

console.log('━━ كل الصفحات بتشاور على المانيفست ━━');
const pages=fs.readdirSync(ROOT).filter(f=>f.endsWith('.html'));
const noman=pages.filter(f=>!/rel="manifest"[^>]*manifest\.json/.test(fs.readFileSync(path.join(ROOT,f),'utf8')));
must(noman.length===0,`الـ${pages.length} صفحة كلها (${noman.join(',')||'مفيش ناقص'})`);

console.log('━━ الـservice worker ━━');
const sw=fs.readFileSync(ROOT+'/sw.js','utf8');
new vm.Script(sw);
must(/addEventListener\('fetch'/.test(sw),'فيه fetch handler (شرط التثبيت)');
must(/cache:\s*'no-store'/.test(sw),'بيجيب من الشبكة الأول — التحديث بيوصل لوحده');
must(/skipWaiting/.test(sw)&&/clients\.claim/.test(sw),'النسخة الجديدة بتشتغل فورًا');
// كل ملف في القشرة لازم يكون موجود فعلًا
const shell=[...sw.matchAll(/'(\/omraa\/[^']+)'/g)].map(m=>m[1])
  .filter(u=>/\.(html|json|png)$/.test(u));
for(const u of new Set(shell)){
  must(fs.existsSync(path.join(ROOT,u.replace('/omraa/',''))),`القشرة: ${u} موجود`);
}
must(/req\.mode === 'navigate'/.test(sw),'صفحة أوفلاين واضحة بدل خطأ المتصفح');

console.log('━━ الوضع المستقل: كل صفحة تشتغل على مقاس موبايل ━━');
for(const f of ['dashboard.html','shipping.html','photos.html','website.html']){
  const s=fs.readFileSync(path.join(ROOT,f),'utf8');
  must(/width=device-width/.test(s), `${f}: viewport للموبايل`);
  must(/apple-mobile-web-app-capable/.test(s), `${f}: بيفتح بملء الشاشة على iOS`);
}

console.log('━━ شريط التحديث ━━');
const tel=fs.readFileSync(ROOT+'/omraa-telemetry.js','utf8');
new vm.Script(tel);
must(/sw-updated/.test(tel),'بيسمع إشارة التحديث');
must(/navigator\.serviceWorker\.controller/.test(tel),'أول تسجيل مش بيتحسب تحديث');
must(/safe-area-inset-bottom/.test(tel),'مراعي حواف الشاشة على الأيفون');

// محاكاة: الشريط يظهر مرة واحدة بس، وما يظهرش عند أول تسجيل
const dom=new JSDOM('<body></body>',{runScripts:'dangerously',url:'https://x.test/omraa/dashboard.html'});
const w=dom.window; const L={};
w.navigator.serviceWorker={controller:null,addEventListener:(t,f)=>{L[t]=f},register:()=>Promise.resolve()};
w.fetch=async()=>({ok:true,text:async()=>'{}'});
const el=w.document.createElement('script'); el.textContent=tel; w.document.body.appendChild(el);
// نص الشاشة المرئي بس — عنصر <script> المحقون بيحط الكود نفسه في textContent
const vis=()=>{const c=w.document.body.cloneNode(true);
  c.querySelectorAll('script').forEach(n=>n.remove()); return c.textContent;};
L.message && L.message({data:{type:'sw-updated'}});
must(!/نسخة جديدة/.test(vis()),'أول تسجيل: مفيش شريط');
w.navigator.serviceWorker.controller={};
L.message({data:{type:'sw-updated'}});
must(/نسخة جديدة/.test(vis()),'تحديث حقيقي: الشريط ظهر');
const n1=vis().split('نسخة جديدة').length;
L.message({data:{type:'sw-updated'}});
must(vis().split('نسخة جديدة').length===n1,'ما بيتكررش لو الإشارة جت تاني');
must(/حدّث دلوقتي/.test(vis()) && /بعدين/.test(vis()),
     'زرار تحديث وزرار تأجيل');
console.log(`\n✅ ${pass} فحص نجح`);
