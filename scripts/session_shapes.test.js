/* اختبار قراءة الجلسة بكل الأشكال اللي supabase بيخزّن بيها. */
const fs=require('fs'); const {JSDOM}=require('/tmp/node_modules/jsdom');
const PAGE=fs.readFileSync('/home/claude/pos/website.html','utf8').replace(/<script[\s\S]*?<\/script>/g,'');
const CODE=fs.readFileSync('/home/claude/pos/website.js','utf8').replace(/\napplyHash\(\);\nload\(true\);\s*$/,'\n');
let pass=0; const ok=m=>{console.log('  ✓ '+m);pass++};
const must=(c,m)=>{if(!c) throw new Error('✗ '+m); ok(m)};

const REF='mjetglnmivwphxyzflsz';
const b64url=(t)=>Buffer.from(t,'utf8').toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');

function boot(cookies, localItems){
  const dom=new JSDOM(PAGE,{runScripts:'dangerously',url:'https://mohabbeshier.github.io/omraa/website.html'});
  const w=dom.window;
  Object.defineProperty(w.document,'cookie',{get:()=>cookies||'',configurable:true});
  for(const [k,v] of Object.entries(localItems||{})) w.localStorage.setItem(k,v);
  w.fetch=async()=>({ok:true,text:async()=>'{}'});
  w.eval(CODE);
  return w;
}
const SESSION={access_token:'TOKEN_OK',refresh_token:'r',expires_at:Math.floor(Date.now()/1000)+3600};
const EXPIRED={...SESSION,expires_at:Math.floor(Date.now()/1000)-60};

// ① الشكل الحالي فعلًا: كوكي base64url
let w=boot(`sb-${REF}-auth-token=base64-${b64url(JSON.stringify(SESSION))}`);
must(w.eval('accessToken()')==='TOKEN_OK','كوكي base64url — ده اللي كان بيفشل');

// ② كوكي متقسّمة على أجزاء
const enc='base64-'+b64url(JSON.stringify(SESSION));
const half=Math.ceil(enc.length/2);
w=boot(`sb-${REF}-auth-token.0=${enc.slice(0,half)}; sb-${REF}-auth-token.1=${enc.slice(half)}`);
must(w.eval('accessToken()')==='TOKEN_OK','كوكي متقسّمة على جزئين');

// ٣ أجزاء + ترتيب مقلوب في الجار
w=boot(`sb-${REF}-auth-token.1=${enc.slice(3,7)}; sb-${REF}-auth-token.0=${enc.slice(0,3)}; sb-${REF}-auth-token.2=${enc.slice(7)}`);
must(w.eval('accessToken()')==='TOKEN_OK','٣ أجزاء بترتيب مبعثر في الكوكي');

// ③ كوكي JSON عادي (نسخة أقدم)
w=boot(`sb-${REF}-auth-token=${encodeURIComponent(JSON.stringify(SESSION))}`);
must(w.eval('accessToken()')==='TOKEN_OK','كوكي JSON عادي');

// ④ مصفوفة
w=boot(`sb-${REF}-auth-token=base64-${b64url(JSON.stringify(['TOKEN_OK','r',SESSION.expires_at]))}`);
must(w.eval('accessToken()')==='TOKEN_OK','الشكل المصفوفة');

// ⑤ localStorage (الشكل القديم) لسه شغّال
w=boot('', {[`sb-${REF}-auth-token`]: JSON.stringify(SESSION)});
must(w.eval('accessToken()')==='TOKEN_OK','localStorage القديم لسه بيشتغل');

// ⑥ currentSession المتداخل
w=boot('', {[`sb-${REF}-auth-token`]: JSON.stringify({currentSession:SESSION})});
must(w.eval('accessToken()')==='TOKEN_OK','الشكل المتداخل currentSession');

// ⑦ كوكيز فيها حاجات تانية كتير
w=boot(`_ga=x; other=y; sb-${REF}-auth-token=base64-${b64url(JSON.stringify(SESSION))}; z=1`);
must(w.eval('accessToken()')==='TOKEN_OK','بيلاقيها وسط كوكيز تانية');

// ⑧ مفيش جلسة
w=boot('_ga=x');
must(w.eval('accessToken()')===null,'مفيش جلسة → null (مش بيرمي)');
must(w.eval('explainAuth("permission denied for function shop_fn_admin_site",403)').includes('مش لاقي جلستك'),
     'الرسالة بتشرح السبب الحقيقي مش عرض القاعدة');

// ⑨ جلسة منتهية
w=boot(`sb-${REF}-auth-token=base64-${b64url(JSON.stringify(EXPIRED))}`);
must(w.eval('sessionExpired()')===true,'بيكتشف الجلسة المنتهية');
must(w.eval('explainAuth("JWT expired",401)').includes('انتهت'),'رسالة الجلسة المنتهية واضحة');

// ⑩ كوكي بايظة ما تكسرش الصفحة
w=boot(`sb-${REF}-auth-token=base64-!!!not-base64!!!`);
must(w.eval('accessToken()')===null,'كوكي بايظة → null بدل استثناء');
w=boot(`sb-${REF}-auth-token=%7Bbroken`);
must(w.eval('accessToken()')===null,'JSON بايظ → null');

console.log(`\n✅ ${pass} فحص نجح`);
