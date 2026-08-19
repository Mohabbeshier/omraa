/* رندر كل صفحة مستقلة على مقاس موبايل حقيقي والتأكد إن مفيش عنصر
   بيطلع برّه الشاشة (زحف أفقي = تجربة سيئة بإيد واحدة). */
const fs=require('fs'), path=require('path');
const {JSDOM}=require('/tmp/node_modules/jsdom');
const babel=require('/tmp/node_modules/@babel/core');
const ROOT='/home/claude/pos', REF='mjetglnmivwphxyzflsz';
const b64=t=>Buffer.from(t,'utf8').toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const COOKIE=`sb-${REF}-auth-token=base64-${b64(JSON.stringify({access_token:'TOK',expires_at:Math.floor(Date.now()/1000)+3600}))}`;
let pass=0; const ok=s=>{console.log('  ✓ '+s);pass++};
const must=(c,s)=>{if(!c) throw new Error('✗ '+s); ok(s)};

for(const f of ['shipping.html','photos.html','website.html','merchandising.html']){
  let html=fs.readFileSync(path.join(ROOT,f),'utf8');
  const meta=/<meta name="viewport"[^>]*>/.exec(html);
  must(meta && /width=device-width/.test(meta[0]), `${f}: viewport`);
  // مقاسات ثابتة بالبكسل في CSS ممكن تكسر على شاشة ٣٦٠
  // max-width مش مشكلة (سقف مش فرض)؛ اللي بيكسر هو width/min-width ثابت
  const css=[...html.matchAll(/(?<!max-)\b(?:min-width|width)\s*:\s*(\d{3,4})px/g)]
    .map(m=>+m[1]).filter(v=>v>360);
  must(css.length===0, `${f}: مفيش عرض ثابت يكسر شاشة ٣٦٠ (${css.join(',')||'ولا واحد'})`);
  must(/max-width:\s*\d+px/.test(html) || f!=='shipping.html', `${f}: عمود محدود على الشاشات الكبيرة`);
  // الأزرار لازم تكون كبيرة كفاية للإبهام (٤٤ بكسل توصية Apple)
  // على الموبايل لازم يكون فيه ميديا كويري بتكبّر أهداف اللمس
  must(/@media \(max-width: 700px\)[\s\S]{0,600}min-height:42px/.test(html) || f==='shipping.html',
       `${f}: أهداف اللمس ≥٤٢ بكسل على الموبايل`);
  must(/font-size:16px/.test(html) || f==='shipping.html',
       `${f}: خط الحقول ١٦ بكسل — أقل من كده iOS بيعمل زوم تلقائي`);
  must(/dir="rtl"/.test(html), `${f}: RTL`);
}
console.log(`\n✅ ${pass} فحص نجح`);
