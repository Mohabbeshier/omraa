/* الحارس: تصحيح الساعة + علاج الصفحة الميتة — من غير ما يكسر حاجة */
const fs=require('fs');const path=require('path');
const {JSDOM}=require(process.env.JSDOM||'jsdom');
const CODE=fs.readFileSync(process.argv[2],'utf8');
const REF='mjetglnmivwphxyzflsz',SB='https://'+REF+'.supabase.co';
const b64url=t=>Buffer.from(t).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const jwt=iat=>'h.'+b64url(JSON.stringify({iat,exp:iat+3600,role:'authenticated'}))+'.s';
let pass=0;const must=(c,m)=>{if(!c){console.log('  ✗ '+m);process.exitCode=1;}else{console.log('  ✓ '+m);pass++;}};
const tick=()=>new Promise(r=>setTimeout(r,20));

function boot({page='pos.html',session,skewStored,queue,net,dev=0}={}){
  let RN;
  const dom=new JSDOM('<body></body>',{runScripts:'dangerously',url:'https://mohabbeshier.github.io/omraa/'+page});
  const w=dom.window;const timers=[];const calls={reload:0,unreg:0,cachesDel:0,fetch:[],logs:[]};
  w.setTimeout=(f,ms)=>{timers.push({f,ms});return timers.length;};
  w.setInterval=(f,ms)=>{timers.push({f,ms,iv:1});return timers.length;};
  if(session)w.localStorage.setItem(`sb-${REF}-auth-token`,JSON.stringify(session));
  if(skewStored!=null)w.localStorage.setItem('omraa.clockSkew.v1',JSON.stringify({ms:skewStored}));
  if(queue)w.localStorage.setItem('omraa.queue.v1',JSON.stringify(queue));
  net=Object.assign({reach:true,tokenIat:null},net||{});
  w.fetch=async(u)=>{u=String(u);calls.fetch.push(u);
    if(u.endsWith('/auth/v1/health')){if(!net.reach)throw new TypeError('Failed to fetch');return {ok:true,status:200};}
    if(u.includes('pos_fn_server_time')){if(net.server==null)return {ok:false,status:404};return {ok:true,status:200,json:async()=>RN()+w.__adv};}
    if(u.includes('/auth/v1/token')&&net.tok429>0){net.tok429--;return {ok:false,status:429,clone:()=>({json:async()=>({})})};}
    if(u.includes('/auth/v1/token'))return {ok:true,status:200,clone:()=>({json:async()=>({access_token:jwt(net.tokenIat)})})};
    return {ok:true,status:200,clone:()=>({json:async()=>({})})};};
  w.__omraaLog=(ctx,e,x)=>calls.logs.push(ctx);
  w.__fakeLoc={pathname:'/omraa/'+page,reload:()=>calls.reload++};
  Object.defineProperty(w.navigator,'serviceWorker',{value:{getRegistrations:async()=>[{unregister:async()=>{calls.unreg++;return true;}}]},configurable:true});
  w.caches={keys:async()=>['omraa-net-first-v5'],delete:async()=>{calls.cachesDel++;return true;}};
  w.__adv=0;RN=w.Date.now.bind(w.Date);w.Date.now=()=>RN()+w.__adv+dev;
  const el=w.document.createElement('script');el.textContent='(function(location){'+CODE+'\n})(window.__fakeLoc);';w.document.body.appendChild(el);
  const run=async ms=>{w.__adv+=ms;for(const t of timers.filter(t=>t.ms===ms))t.f();await tick();await tick();};
  return {w,calls,timers,run};
}
(async()=>{
  const now=Math.floor(Date.now()/1000);
  console.log('① الساعة');
  // ساعة الجهاز متأخرة ساعة: التوكن المحفوظ «صادر في المستقبل»
  let b=boot({session:{access_token:jwt(now+3600)}});
  must(Math.abs(b.w.Date.now()-Date.now()-3601000)<3000,'ساعة متأخرة ساعة ← Date.now اتصحّحت +١ ساعة من التوكن المحفوظ');
  // ساعة متقدمة ساعة: أول تجديد توكن بيصحّحها
  b=boot({session:{access_token:jwt(now)},net:{tokenIat:now-3600}});
  await b.w.fetch(SB+'/auth/v1/token?grant_type=refresh_token',{method:'POST'});await tick();await tick();
  must(Math.abs(b.w.Date.now()-Date.now()+3600000)<3000,'ساعة متقدمة ساعة ← بعد أول تجديد Date.now رجعت للوقت الحقيقي');
  must(JSON.parse(b.w.localStorage.getItem('omraa.clockSkew.v1')).ms<-3590000,'التصحيح اتحفظ للفتح الجاي');
  must(b.calls.logs.includes('guard.clock_skew')||b.calls.fetch.some(u=>u.includes('pos_fn_log_client_error')),'اتسجّل في لوج الأخطاء عشان نعرف');
  // التصحيح المحفوظ بيتطبق فورًا عند الفتح
  b=boot({skewStored:-3600000});
  must(Math.abs(b.w.Date.now()-Date.now()+3600000)<3000,'الفتح الجاي: التصحيح شغال من أول لحظة');
  // الساعة اتظبطت بعدين: أول تجديد يرجّع التصحيح صفر
  b=boot({skewStored:-3600000,net:{tokenIat:now}});
  await b.w.fetch(SB+'/auth/v1/token?grant_type=refresh_token');await tick();await tick();
  must(Math.abs(b.w.Date.now()-Date.now())<3000,'لو الساعة اتظبطت ← التصحيح يرجع صفر لوحده');
  // فرق صغير (١٠ ثواني) مايتلمسش
  b=boot({net:{tokenIat:now+10}});
  await b.w.fetch(SB+'/auth/v1/token');await tick();await tick();
  must(Math.abs(b.w.Date.now()-Date.now())<1500,'فرق ١٠ ثواني ← مفيش تصحيح');

  console.log('③ الوقت من السيرفر');
  for(const [dev,label] of [[3600000,'متقدمة ساعة'],[-7200000,'متأخرة ساعتين'],[86400000*3,'متقدمة ٣ أيام']]){
    b=boot({dev,net:{server:true}});await tick();await tick();
    must(Math.abs(b.w.Date.now()-(Date.now()+b.w.__adv))<3000,'ساعة الجهاز '+label+' ← اتصحّحت من السيرفر أول ما الصفحة فتحت (من غير أي تجديد جلسة)');
  }
  b=boot({dev:0,net:{server:true}});await tick();await tick();
  must(b.w.localStorage.getItem('omraa.clockSkew.v1')===null,'ساعة مظبوطة ← مفيش أي تدخّل');
  console.log('④ رفض السيرفر المؤقت (429)');
  b=boot({net:{tokenIat:now,tok429:2}});
  const pr=b.w.fetch(SB+'/auth/v1/token?grant_type=refresh_token',{method:'POST',body:'{}'});
  for(let i=0;i<6;i++){for(const t of b.timers.filter(t=>t.ms===2000||t.ms===5000).splice(0))t.f();await tick();}
  const res=await pr;
  must(res.status===200,'تجديد الجلسة اترفض مرتين ← اتعاد لوحده ونجح، والكاشير مايطلعش برّه');
  must(b.calls.fetch.filter(u=>u.includes('/auth/v1/token')).length===3,'٣ محاولات بالظبط، مش لفّة');

  console.log('② الصفحة الميتة');
  const Q=[{op:'sale',key:'k1'}];
  b=boot({session:{access_token:jwt(now)},queue:Q});
  await b.run(32000);
  must(b.calls.reload===1&&b.calls.unreg===1&&b.calls.cachesDel===1,'مفيش ولا طلب بيانات نجح + السيرفر بيرد ← شال النسخة المحفوظة وعمل تحميل');
  must(b.w.localStorage.getItem('omraa.queue.v1')===JSON.stringify(Q),'البيع المعلّق (الطابور) لسه موجود زي ما هو');
  await b.run(60000);
  must(b.calls.reload===1,'مايعيدش التحميل تاني خلال ١٠ دقايق (مستحيل يلف)');
  b=boot({session:{access_token:jwt(now)},net:{reach:false}});
  await b.run(32000);
  must(b.calls.reload===0,'النت فاصل فعلًا ← مايعملش حاجة (الأوفلاين شغله)');
  b=boot({session:{access_token:jwt(now)}});
  await b.w.fetch(SB+'/rest/v1/pos_profiles?select=*');await tick();
  await b.run(32000);
  must(b.calls.reload===0,'الصفحة جابت بيانات ← سليمة، مايلمسهاش');
  b=boot({session:{access_token:jwt(now)}});
  await b.w.fetch(SB+'/rest/v1/');await tick();     // نبضة الاتصال بس مش دليل إن الصفحة شغالة
  await b.run(32000);
  must(b.calls.reload===1,'نبضة الاتصال لوحدها مش كفاية ← اتعالجت');
  b=boot({page:'login.html'});await b.run(32000);
  must(b.calls.reload===0,'صفحة الدخول ← مايتدخلش');
  b=boot({page:'pos.html'});await b.run(32000);
  must(b.calls.reload===0,'مفيش جلسة ← مايتدخلش');
  console.log(`\n${pass} نجح`);
})();
