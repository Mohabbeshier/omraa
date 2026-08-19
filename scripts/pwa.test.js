/* معايير التثبيت الفعلية اللي المتصفحات بتطبقها. */
const fs=require('fs'),path=require('path');
const R='/home/claude/pos';
const m=JSON.parse(fs.readFileSync(R+'/manifest.webmanifest','utf8'));
let pass=0; const ok=s=>{console.log('  ✓ '+s);pass++};
const must=(c,s)=>{if(!c)throw new Error('✗ '+s);ok(s)};

console.log('━━ شروط التثبيت على أندرويد ━━');
must(m.name && m.short_name,'الاسم والاسم المختصر');
must(['standalone','fullscreen','minimal-ui'].includes(m.display),`display=${m.display}`);
must(m.start_url,'فيه start_url');
const p192=m.icons.find(i=>i.sizes==='192x192'&&i.type==='image/png');
const p512=m.icons.find(i=>i.sizes==='512x512'&&i.type==='image/png');
must(p192,'أيقونة PNG 192 (أندرويد ما بيثبّتش من غيرها)');
must(p512,'أيقونة PNG 512');
must(m.icons.some(i=>i.purpose==='maskable'),'أيقونة maskable (عشان ما تتقصّش غلط)');

console.log('━━ الملفات موجودة فعلًا ━━');
for(const i of m.icons){
  const f=path.join(R, i.src.replace(/^\/omraa\//,''));
  must(fs.existsSync(f), `${i.src} موجود`);
}
must(fs.existsSync(R+'/apple-touch-icon.png'),'أيقونة iOS موجودة');

console.log('━━ start_url وscope ━━');
const su=m.start_url.replace(/^\/omraa\//,'');
must(fs.existsSync(path.join(R,su)), `start_url بيفتح صفحة موجودة (${m.start_url})`);
must(m.scope==='/omraa/','الـscope مضبوط على مجلد النظام');
must(m.start_url.startsWith(m.scope),'start_url جوّه الـscope');
for(const s of m.shortcuts||[]){
  must(fs.existsSync(path.join(R,s.url.replace(/^\/omraa\//,''))), `اختصار «${s.short_name}» شغّال`);
}

console.log('━━ كل صفحة جاهزة للتثبيت ━━');
const pages=fs.readdirSync(R).filter(f=>f.endsWith('.html'));
let bad=[];
for(const f of pages){
  const s=fs.readFileSync(path.join(R,f),'utf8');
  if(!/rel="manifest"/.test(s)) bad.push(f+':manifest');
  if(!/apple-touch-icon/.test(s)) bad.push(f+':apple');
  if(!/viewport/.test(s)) bad.push(f+':viewport');
}
must(bad.length===0, `${pages.length} صفحة كلها فيها manifest + أيقونة iOS + viewport${bad.length?' — ناقص: '+bad.slice(0,4):''}`);

console.log('━━ الـservice worker ━━');
const sw=fs.readFileSync(R+'/sw.js','utf8');
must(/network-first|no-store/.test(sw),'network-first — مفيش خطر نسخة قديمة محبوسة');
must(/caches\.match/.test(sw),'فيه fallback للأوفلاين');
let noSW=pages.filter(f=>!/serviceWorker/.test(fs.readFileSync(path.join(R,f),'utf8')));
must(noSW.length===0,`كل الصفحات بتسجّل الـSW${noSW.length?' — ناقص: '+noSW:''}`);

console.log(`\n✅ ${pass} فحص نجح — النظام قابل للتثبيت كتطبيق`);
