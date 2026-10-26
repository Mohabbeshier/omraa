/* ترخيص التركيبة: صحيح / متعدّل / ناقص / دومين تاني / نت قاطع.
   الاستخدام: PW=<playwright> CHROME=<chromium> node scripts/license.test.js */
const path=require('path'),fs=require('fs');
const { chromium } = require(process.env.PW || 'playwright'); // PW=<path to playwright>
const ROOT=path.join(__dirname,'..');
let pass=0,fail=0;const must=(c,m)=>{if(c){pass++;console.log('  ✓ '+m);}else{fail++;console.log('  ✗ '+m);}};
const mime=(f)=>f.endsWith('.js')?'application/javascript':f.endsWith('.json')?'application/json':f.endsWith('.css')?'text/css':f.endsWith('.html')?'text/html':f.endsWith('.png')?'image/png':'application/octet-stream';
async function run(b,{host,license,licenseFail}){
  const ctx=await b.newContext({viewport:{width:390,height:844}});const page=await ctx.newPage();
  const pings=[];const errs=[];page.on('pageerror',e=>errs.push(String(e)));
  await page.route(/supabase\.co/,r=>{const u=r.request().url();
    if(u.includes('/functions/v1/license-ping')){pings.push(JSON.parse(r.request().postData()));return r.fulfill({status:200,body:'ok'});}
    return r.fulfill({status:200,contentType:'application/json',body:u.includes('server_time')?String(Date.now()):'[]'});});
  await page.route(/fonts\.(googleapis|gstatic)/,r=>r.fulfill({status:200,body:''}));
  await page.route(new RegExp('^https://'+host.replace(/\./g,'\\.')+'/'),r=>{
    let p=new URL(r.request().url()).pathname.replace(/^\/omraa\/?/,'');if(!p||p.endsWith('/'))p+='index.html';
    if(p==='license.json'){ if(licenseFail) return r.abort(); if(license===null) return r.fulfill({status:404,body:'nf'}); return r.fulfill({status:200,contentType:'application/json',body:license}); }
    const f=path.join(ROOT,p);if(!fs.existsSync(f))return r.fulfill({status:404,body:''});
    return r.fulfill({status:200,contentType:mime(f),body:fs.readFileSync(f)});});
  await page.goto('https://'+host+'/omraa/login.html');await page.waitForTimeout(5000);
  const st=await page.evaluate(()=>window.__omraaLicense);const bar=await page.locator('#omraa-unlicensed').count();
  const barText=bar?await page.textContent('#omraa-unlicensed'):'';
  // ريفرش: البنج مايتكررش في نفس اليوم
  await page.reload();await page.waitForTimeout(5000);
  await ctx.close();return {st,bar,barText,pings,errs};
}
(async()=>{
  const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
  const good=fs.readFileSync(path.join(ROOT,'license.json'),'utf8');
  const tampered=good.replace('"slot": 1','"slot": 2');
  console.log('== الترخيص الصحيح على الدومين الصحيح');
  let r=await run(b,{host:'mohabbeshier.github.io',license:good});
  must(r.st.status==='valid'&&r.st.id==='OMR-2026-A','الحالة valid برقم OMR-2026-A');
  must(r.bar===0,'مفيش شريط');
  must(r.pings.length===1&&r.pings[0].status==='valid'&&r.pings[0].ref==='mjetglnmivwphxyzflsz','بلاغ واحد بس في اليوم (حتى بعد الريفرش)');
  must(r.errs.length===0,'مفيش أخطاء');
  console.log('== ترخيص متعدّل باليد');
  r=await run(b,{host:'mohabbeshier.github.io',license:tampered});
  must(r.st.status==='invalid'&&r.bar===1&&/غير مرخّصة/.test(r.barText),'اتكشف وظهر الشريط: '+r.barText.slice(0,60));
  console.log('== مفيش ملف ترخيص');
  r=await run(b,{host:'mohabbeshier.github.io',license:null});
  must(r.st.status==='missing'&&r.bar===1,'missing + شريط');
  console.log('== نفس الملفات على دومين تاني (نسخة مسروقة)');
  r=await run(b,{host:'stolen-copy.example.com',license:good});
  must(r.st.status==='mismatch'&&r.bar===1,'mismatch + شريط');
  must(r.pings.some(p=>p.status==='mismatch'&&p.host==='stolen-copy.example.com'&&p.id==='OMR-2026-A'),'المالك وصله بلاغ بالدومين ورقم الترخيص المنسوخ');
  console.log('== النت قاطع ومش قادر يجيب الترخيص');
  r=await run(b,{host:'mohabbeshier.github.io',licenseFail:true});
  must(r.bar===0,'مفيش شريط غلط وقت قطع النت');
  await b.close();console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0);
})();
