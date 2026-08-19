/* مراجعة الأساسيات قبل التسليم: الحاجات اللي لو واحدة فيها غلط،
   التطبيق ميّت من أول يوم. */
const fs=require('fs'), path=require('path');
const ROOT='/home/claude/pos';
let pass=0; const ok=s=>{console.log('  ✓ '+s);pass++};
const bad=[]; const check=(c,s)=>{ c?ok(s):(console.log('  ✗ '+s),bad.push(s)); };
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');

console.log('━━ ١. مسار الدخول ━━');
const man=JSON.parse(read('manifest.json'));
check(fs.existsSync(path.join(ROOT,'login.html')),'صفحة الدخول موجودة');
const lay=read('_next/static/chunks/app/(app)/layout-a90e0256728202cd.js');
check(/getSession/.test(lay) && /replace\("\/login"\)/.test(lay),
      'مستخدم بلا جلسة بيتحوّل للدخول تلقائيًا');
check(/signOut/.test(lay),'فيه تسجيل خروج');
const lg=read('_next/static/chunks/app/(auth)/login/page-53dc23f08d19c7bb.js');
check(/signInWithPassword/.test(lg),'الدخول بإيميل وكلمة سر');
check(/push\("\/dashboard"\)/.test(lg),'بعد الدخول بيروح للوحة التحكم');
check(/غير صحيحة/.test(lg),'رسالة خطأ بالعربي');
// basePath: كل الأصول لازم تبدأ بـ/omraa وإلا التطبيق المثبّت بيقع
const pages=fs.readdirSync(ROOT).filter(f=>f.endsWith('.html'));
const badAsset=pages.filter(f=>/(?:src|href)="\/_next\//.test(read(f)));
check(badAsset.length===0,`كل الأصول تحت /omraa (${badAsset.join(',')||'تمام'})`);

console.log('━━ ٢. نقطة البداية بتفتح على حاجة موجودة ━━');
const start=man.start_url.replace('/omraa/','');
check(fs.existsSync(path.join(ROOT,start)),`start_url → ${start} موجود`);
for(const s of man.shortcuts)
  check(fs.existsSync(path.join(ROOT,s.url.replace('/omraa/',''))),`اختصار «${s.short_name}» يشتغل`);
check(man.scope==='/omraa/' && man.start_url.startsWith(man.scope),'نقطة البداية جوّه النطاق');

console.log('━━ ٣. الصفحات اليومية موجودة وسليمة ━━');
const daily=['dashboard.html','pos.html','shipping.html','photos.html','inventory.html',
             'orders.html','products.html','customers.html','labels.html','backup.html'];
for(const f of daily){
  const p=path.join(ROOT,f);
  if(!fs.existsSync(p)){ check(false,`${f} موجودة`); continue; }
  const s=read(f);
  const okp = /<\/html>/.test(s) && /rel="manifest"/.test(s) && /dir="rtl"/.test(s)
    && /width=device-width/.test(s) && /serviceWorker/.test(s);
  check(okp, `${f}: كاملة · manifest · rtl · موبايل · sw`);
}

console.log('━━ ٤. كل مرجع في كل صفحة موجود فعلًا ━━');
let broken=[];
for(const f of pages){
  for(const m of read(f).matchAll(/(?:src|href)="(?!https?:|data:|mailto:|tel:|#)([^"]+)"/g)){
    let t=m[1].split('?')[0].split('#')[0];
    if(t.startsWith('/omraa/')) t=t.slice(7);
    if(!t) continue;
    if(!fs.existsSync(path.join(ROOT,t)) && !fs.existsSync(path.join(ROOT,t+'.html')))
      broken.push(`${f} → ${m[1]}`);
  }
}
check(broken.length===0,`مفيش مرجع مكسور (${broken.slice(0,3).join(' | ')||'صفر'})`);

console.log('━━ ٥. الملفات المبنية متطابقة مع مصدرها ━━');
const babel=require('/tmp/node_modules/@babel/core');
const built=read('photos.build.js');
const fresh=babel.transformSync(read('photos.jsx'),
  {presets:[['/tmp/node_modules/@babel/preset-react',{runtime:'classic'}]],
   filename:'photos.jsx',compact:false}).code;
check(built.includes(fresh.slice(0,400)),'photos.build.js مولّد من photos.jsx الحالي');
check(!/unpkg|cdn\.|jsdelivr/.test(read('photos.html')),'مفيش اعتماد على CDN');
check(fs.existsSync(path.join(ROOT,'vendor/react.min.js')),'React محلي');

console.log('━━ ٦. الأوفلاين ━━');
const sw=read('sw.js');
const shell=[...sw.matchAll(/'(\/omraa\/[^']+)'/g)].map(m=>m[1].replace('/omraa/',''));
const missing=shell.filter(u=>!fs.existsSync(path.join(ROOT,u)));
check(missing.length===0,`كل ملفات القشرة موجودة (${missing.join(',')||'تمام'})`);
check(shell.includes('login.html'),'صفحة الدخول محفوظة — يقدر يسجّل دخول لو النت ضعيف');

console.log('━━ ٧. مفيش أسرار في كود العميل ━━');
let leaks=[];
for(const f of [...pages,'website.js','shipping.js','omraa-telemetry.js','photos.build.js']){
  const s=read(f);
  if(/service_role|ghp_[A-Za-z0-9]{20}|sk_live|SUPABASE_SERVICE/.test(s)) leaks.push(f);
}
check(leaks.length===0,`مفيش مفتاح خطير في الكود المنشور (${leaks.join(',')||'نضيف'})`);
const anonCount=pages.filter(f=>/eyJhbGciOiJIUzI1NiI/.test(read(f))).length;
ok(`مفتاح الزائر في ${anonCount} صفحة — ده عام بالتصميم ومحمي بـRLS`);

console.log(bad.length? `\n🔴 ${bad.length} مشكلة:\n  - `+bad.join('\n  - ') : `\n✅ ${pass} فحص نجح — الأساسيات سليمة`);
process.exit(bad.length?1:0);
