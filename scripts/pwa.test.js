/* معايير التثبيت الحقيقية اللي أندرويد و iOS بيطبقوها. */
const fs=require('fs'), path=require('path');
const ROOT='/home/claude/pos';
const m=JSON.parse(fs.readFileSync(ROOT+'/manifest.webmanifest','utf8'));
let pass=0; const ok=s=>{console.log('  ✓ '+s);pass++};
const must=(c,s)=>{if(!c) throw new Error('✗ '+s); ok(s)};

console.log('━━ شروط أندرويد للتثبيت ━━');
must(m.name && m.short_name,'الاسم والاسم المختصر');
must(m.display==='standalone','بيفتح كتطبيق مش تاب متصفح');
must(m.start_url && m.start_url.startsWith('/omraa/'),`start_url تحت /omraa/ (${m.start_url})`);
// أهم واحدة: الملف اللي هيفتح لازم يكون موجود فعلًا
must(fs.existsSync(path.join(ROOT, m.start_url.replace('/omraa/',''))),
     'الملف اللي بيفتحه موجود فعلًا — كان /dashboard وده 404');
must(m.scope==='/omraa/','النطاق مضبوط');
const png=m.icons.filter(i=>i.type==='image/png');
must(png.some(i=>i.sizes==='192x192'),'أيقونة 192 PNG (أندرويد بيرفض التثبيت من غيرها)');
must(png.some(i=>i.sizes==='512x512'),'أيقونة 512 PNG');
must(m.icons.some(i=>i.purpose==='maskable'),'أيقونة maskable — عشان ما تتقصش غلط');
for(const i of m.icons){
  const f=path.join(ROOT,i.src.replace('/omraa/',''));
  must(fs.existsSync(f), `الملف موجود: ${i.src}`);
}
must(fs.existsSync(ROOT+'/sw.js'),'service worker موجود');

console.log('━━ اختصارات الضغط المطوّل ━━');
must(m.shortcuts && m.shortcuts.length===3,'٣ اختصارات');
for(const s of m.shortcuts){
  must(fs.existsSync(path.join(ROOT,s.url.replace('/omraa/',''))), `${s.short_name} → ${s.url}`);
}

console.log('━━ iOS ━━');
const d=fs.readFileSync(ROOT+'/dashboard.html','utf8');
must(/apple-touch-icon/.test(d),'أيقونة الشاشة الرئيسية (من غيرها بيحط صورة الصفحة)');
must(/apple-mobile-web-app-capable/.test(d),'بيفتح بملء الشاشة');
must(/apple-mobile-web-app-title/.test(d),'الاسم تحت الأيقونة');

console.log('━━ كل الصفحات ━━');
const pages=fs.readdirSync(ROOT).filter(f=>f.endsWith('.html'));
const bad=pages.filter(f=>{const s=fs.readFileSync(path.join(ROOT,f),'utf8');
  return !/rel="manifest"/.test(s)||!/apple-touch-icon/.test(s)||!/serviceWorker/.test(s);});
must(bad.length===0,`الـ${pages.length} صفحة كلها قابلة للتثبيت (${bad.join(',')||'مفيش ناقص'})`);
must(m.dir==='rtl'&&m.lang==='ar','عربي ومن اليمين');
console.log(`\n✅ ${pass} فحص نجح`);
