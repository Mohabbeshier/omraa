/* ══════════════════════════════════════════════════════════════════
   مركز تحكّم الموقع — الأمراء
   مكان واحد يتحكم في كل حاجة على الويبسايت: المحتوى، المنتجات،
   العروض، الشحن، الإعدادات، والتقييمات.

   المبدأ: أي حاجة كانت بتتعمل بـSQL يدوي أو متزرّعة في كود الموقع
   لازم يبقى ليها زرار هنا.
   ══════════════════════════════════════════════════════════════════ */

const SUPABASE_URL = "https://mjetglnmivwphxyzflsz.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qZXRnbG5taXZ3cGh4eXpmbHN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NTcwODgsImV4cCI6MjA5NjQzMzA4OH0.X6Rvxo4owPcBwE4HqXLm5fuPDSdEo8PV9oBV-bHsGrg";
const SITE_URL = "https://mohabbeshier.github.io/omraa-store-preview/";

/* نفس الجلسة اللي الـPOS فتحها على نفس الأصل — بلا تسجيل دخول تاني. */
function accessToken(){
  try{
    for(let i=0;i<localStorage.length;i++){
      const k = localStorage.key(i);
      if(/^sb-.*-auth-token$/.test(k)){
        const v = JSON.parse(localStorage.getItem(k));
        if(v && v.access_token) return v.access_token;
      }
    }
  }catch(e){}
  return null;
}

async function rpc(fn, args){
  const tok = accessToken();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`,{
    method:"POST",
    headers:{ "Content-Type":"application/json", apikey: ANON_KEY,
              Authorization:`Bearer ${tok || ANON_KEY}` },
    body: JSON.stringify(args||{})
  });
  const txt = await res.text();
  let data=null; try{ data = txt?JSON.parse(txt):null; }catch(e){ data = txt; }
  if(!res.ok) throw new Error((data && (data.message||data.hint)) || `HTTP ${res.status}`);
  return data;
}

/* ── حالة الصفحة ───────────────────────────────────────────────── */
let S = {
  tab: "home", data:null, backup:null, busy:false, dirty:{},
  draft:{},            // نسخة تحت التعديل من الإعدادات
  ship:null,           // نسخة تحت التعديل من أسعار الشحن
  pq:"", pfilter:"all", psel:[],   // شاشة المنتجات
  editC:null, editB:null, discSel:[], q_c:"", q_b:"", q_d:""
};

const $ = s => document.querySelector(s);
const esc = s => String(s??"").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money = n => new Intl.NumberFormat("ar-EG",{style:"currency",currency:"EGP",maximumFractionDigits:2}).format(Number(n)||0);
const num = n => new Intl.NumberFormat("ar-EG").format(Number(n)||0);
const dIn = t => t ? new Date(t).toISOString().slice(0,10) : "";
const clone = o => JSON.parse(JSON.stringify(o??null));

function toast(msg, err){
  const t=$("#toast"); t.textContent=msg; t.className=err?"err":"";
  t.style.display="block"; clearTimeout(t._h);
  t._h=setTimeout(()=>t.style.display="none", err?5600:2600);
}

/* كل عملية كتابة بتعدي من هنا: قفل ضد الدبل-كليك + إعادة تحميل + رسالة خطأ واضحة */
async function guard(fn){
  if(S.busy) return;
  S.busy=true; render();
  try{ await fn(); await load(false); }
  catch(e){ toast(e.message||"حصلت مشكلة", true); S.busy=false; render(); return; }
  S.busy=false; render();
}

async function load(first){
  try{
    S.data = await rpc("shop_fn_admin_site",{});
    // حالة النسخ نداء منفصل عن قصد: لو فشل، الداشبورد تفضل شغّالة
    try{ S.backup = await rpc("pos_fn_backup_health",{}); }catch(e){ S.backup = null; }
    // نسخة العمل تتبني من السيرفر كل مرة، إلا لو فيه تعديلات لسه ما اتحفظتش
    if(first || !Object.keys(S.dirty).length){
      S.draft = clone(S.data.settings);
      S.ship  = clone(S.data.shipping);
      S.dirty = {};
    }
    render();
  }catch(e){
    $("#app").innerHTML = `<div class="card"><h2>مش قادر أفتح البيانات</h2>
      <p class="sub">${esc(e.message)}</p>
      <p class="sub">لو الرسالة بتقول <code>owner only</code> أو <code>unauthorised</code>،
      افتح <a href="login.html">صفحة الدخول</a> وسجّل دخول بحساب المالك، وبعدين ارجع هنا.</p></div>`;
  }
}

/* ══ نظرة عامة ══════════════════════════════════════════════════ */
function homeTab(){
  const h = S.data.health;
  const paused = !!(S.data.settings.flags||{}).orders_paused;
  const disc = S.data.products.find(p=>p.is_published && Number(p.live_pct)>0);

  const todos = [];
  if(h.no_image>0) todos.push({c:"red", t:`${num(h.no_image)} منتج منشور من غير أي صورة`,
    d:"المنتج من غير صورة بيتفرّج عليه وما يتشتريش. ارفع الصور من صفحة الصور.",
    a:`<a class="btn-ghost btn-sm" style="text-decoration:none;padding:5px 11px;border:1px solid var(--line);border-radius:8px;color:var(--ink)" href="photos.html">ارفع الصور</a>`});
  if(h.no_desc>0) todos.push({c:"red", t:`${num(h.no_desc)} منتج منشور من غير وصف`,
    d:"الوصف بيجاوب على أسئلة العميلة قبل ما تسأل، وبيرفع ظهورك في جوجل.",
    a:`<button class="btn-ghost btn-sm" onclick="go('products','nodesc')">اكتب الأوصاف</button>`});
  if(h.no_stock>0) todos.push({c:"amber", t:`${num(h.no_stock)} منتج منشور مفيش منه مخزون`,
    d:"لسه بيظهر على الموقع كـ«تحت الطلب». لو مش هتوفّره، اخفيه.",
    a:`<button class="btn-ghost btn-sm" onclick="go('products','nostock')">راجعهم</button>`});
  if(h.reviews_pending>0) todos.push({c:"amber", t:`${num(h.reviews_pending)} تقييم مستني موافقتك`,
    d:"التقييم ما بيظهرش على الموقع غير لما توافق عليه.",
    a:`<button class="btn-ghost btn-sm" onclick="go('reviews')">راجعهم</button>`});
  if(h.published===0) todos.push({c:"red", t:"مفيش أي منتج منشور على الموقع",
    d:"الموقع شغال بس الكتالوج فاضي.",
    a:`<button class="btn-ghost btn-sm" onclick="go('products')">انشر منتجات</button>`});
  if(paused) todos.push({c:"red", t:"الطلبات متوقفة على الموقع دلوقتي",
    d:"الزوار بيشوفوا الموقع بس مش قادرين يطلبوا.",
    a:`<button class="btn-ghost btn-sm" onclick="go('settings')">شغّل الطلبات</button>`});
  if(!todos.length) todos.push({c:"green", t:"كل حاجة تمام", d:"مفيش حاجة ناقصة على الموقع دلوقتي.", a:""});

  return `
  <div class="tiles">
    <div class="tile ${h.published?'good':'bad'} link" onclick="go('products')">
      <div class="n">${num(h.published)}</div><div class="l">منتج منشور</div></div>
    <div class="tile ${h.no_image?'bad':'good'} link" onclick="go('products','noimg')">
      <div class="n">${num(h.no_image)}</div><div class="l">من غير صورة</div></div>
    <div class="tile ${h.no_desc?'bad':'good'} link" onclick="go('products','nodesc')">
      <div class="n">${num(h.no_desc)}</div><div class="l">من غير وصف</div></div>
    <div class="tile ${h.on_discount?'warn':''} link" onclick="go('offers')">
      <div class="n">${num(h.on_discount)}</div><div class="l">عليه خصم دلوقتي</div></div>
    <div class="tile"><div class="n">${num(h.orders_7d)}</div><div class="l">طلب من الموقع (٧ أيام)</div></div>
    <div class="tile"><div class="n">${num(h.orders_total)}</div><div class="l">إجمالي طلبات الموقع</div></div>
    <div class="tile ${h.reviews_pending?'warn':''} link" onclick="go('reviews')">
      <div class="n">${num(h.reviews_pending)}</div><div class="l">تقييم مستني</div></div>
    <div class="tile"><div class="n">${num(h.unpublished)}</div><div class="l">مخفي عن الموقع</div></div>
  </div>

  <div class="card">
    <h2>حالة الموقع</h2>
    <div class="list-item">
      <div class="grow">
        <div class="name">استقبال الطلبات</div>
        <div class="meta">${paused?"الموقع بيعرض المنتجات بس مش بيقبل طلبات":"الموقع بيقبل طلبات عادي"}</div>
      </div>
      <span class="pill ${paused?'off':'on'}">${paused?"متوقفة":"شغّالة"}</span>
      <button class="${paused?'btn-ok':'btn-danger'} btn-sm" onclick="togglePaused(${paused?'false':'true'})">
        ${paused?"شغّل الطلبات":"أوقف الطلبات"}</button>
    </div>
    <div class="list-item">
      <div class="grow">
        <div class="name">شريط الإعلانات فوق</div>
        <div class="meta">${((S.data.settings.announce||{}).items||[]).length} رسالة</div>
      </div>
      <span class="pill ${(S.data.settings.announce||{}).active?'on':'off'}">
        ${(S.data.settings.announce||{}).active?"ظاهر":"مخفي"}</span>
      <button class="btn-ghost btn-sm" onclick="go('content')">عدّله</button>
    </div>
    <div class="list-item">
      <div class="grow">
        <div class="name">خصم الموقع</div>
        <div class="meta">${disc?`${Math.round(disc.live_pct)}٪ على ${num(h.on_discount)} منتج`:"مفيش خصم شغّال"}</div>
      </div>
      <span class="pill ${disc?'sale':''}">${disc?`-${Math.round(disc.live_pct)}٪`:"مطفي"}</span>
      <button class="btn-ghost btn-sm" onclick="go('offers')">اظبطه</button>
    </div>
    <div class="list-item">
      <div class="grow">
        <div class="name">الموقع نفسه</div>
        <div class="meta" dir="ltr" style="text-align:right">${SITE_URL}</div>
      </div>
      <a class="btn-ghost btn-sm" style="text-decoration:none;border:1px solid var(--line);border-radius:8px;padding:5px 11px;color:var(--ink)"
         href="${SITE_URL}" target="_blank" rel="noopener">افتح الموقع</a>
    </div>
  </div>

  ${backupCard()}

  <div class="card">
    <h2>محتاج منك حاجة</h2>
    ${todos.map(t=>`<div class="todo"><span class="dot ${t.c}"></span>
      <div class="body"><div class="t">${esc(t.t)}</div><div class="d">${esc(t.d)}</div></div>
      ${t.a||""}</div>`).join("")}
  </div>`;
}

async function togglePaused(v){
  await guard(async()=>{
    const flags = Object.assign({}, S.data.settings.flags||{}, {orders_paused:!!v});
    await rpc("shop_fn_save_site_config",{p_patch:{flags}});
    toast(v?"الطلبات اتوقفت على الموقع":"الطلبات رجعت تشتغل ✓");
  });
}

/* ══ الواجهة (شريط الإعلانات + السلايدر + بيانات التواصل) ═══════ */
function contentTab(){
  const d = S.draft;
  const ann = d.announce||{}; const items = ann.items||[];
  const hero = d.hero||{}; const slides = hero.slides||[];
  const c = d.contact||{}; const seo = d.seo||{}; const flags = d.flags||{};

  return `
  <div class="card">
    <h2>شريط الإعلانات (أعلى كل صفحة)</h2>
    <p class="sub">الرسايل بتلف ورا بعض. خليها وعود حقيقية تقدر تلتزم بيها كل يوم.</p>
    <label class="switch" style="margin:10px 0">
      <input type="checkbox" ${ann.active?"checked":""} onchange="setIn('announce.active',this.checked)">
      يظهر على الموقع</label>
    ${items.map((it,i)=>`
      <div class="row" style="align-items:flex-end;margin-bottom:8px">
        <div class="field" style="margin:0"><label>رسالة ${num(i+1)} — عربي</label>
          <input value="${esc(it.ar||"")}" oninput="setIn('announce.items.${i}.ar',this.value)"></div>
        <div class="field" style="margin:0"><label>English</label>
          <input dir="ltr" value="${esc(it.en||"")}" oninput="setIn('announce.items.${i}.en',this.value)"></div>
        <button class="btn-danger btn-sm" style="flex:0 0 auto;min-width:0" onclick="delAnnounce(${i})">حذف</button>
      </div>`).join("") || `<div class="empty">مفيش رسايل — الشريط هيختفي</div>`}
    <div class="actions"><button class="btn-ghost" onclick="addAnnounce()">+ رسالة جديدة</button></div>
  </div>

  <div class="card">
    <h2>سلايدر الصفحة الرئيسية</h2>
    <p class="sub">أول حاجة العميلة بتشوفها. كل سلايد المفروض يشيل اعتراض حقيقي: السعر، الثقة، أو المقاس.</p>
    ${slides.map((s,i)=>`
      <div class="slide-card">
        <div class="slide-head">
          <strong>سلايد ${num(i+1)}</strong>
          <div style="display:flex;gap:6px">
            ${i>0?`<button class="btn-ghost btn-sm" onclick="moveSlide(${i},-1)">▲</button>`:""}
            ${i<slides.length-1?`<button class="btn-ghost btn-sm" onclick="moveSlide(${i},1)">▼</button>`:""}
            <button class="btn-danger btn-sm" onclick="delSlide(${i})">حذف</button>
          </div>
        </div>
        <div class="row">
          <div class="field"><label>سطر صغير فوق (عربي)</label>
            <input value="${esc(s.kicker_ar||"")}" oninput="setIn('hero.slides.${i}.kicker_ar',this.value)"></div>
          <div class="field"><label>Kicker (EN)</label>
            <input dir="ltr" value="${esc(s.kicker_en||"")}" oninput="setIn('hero.slides.${i}.kicker_en',this.value)"></div>
        </div>
        <div class="row">
          <div class="field"><label>العنوان الكبير (عربي)</label>
            <input value="${esc(s.title_ar||"")}" oninput="setIn('hero.slides.${i}.title_ar',this.value)"></div>
          <div class="field"><label>Title (EN)</label>
            <input dir="ltr" value="${esc(s.title_en||"")}" oninput="setIn('hero.slides.${i}.title_en',this.value)"></div>
        </div>
        <div class="row">
          <div class="field"><label>سطر توضيحي (عربي)</label>
            <input value="${esc(s.sub_ar||"")}" oninput="setIn('hero.slides.${i}.sub_ar',this.value)"></div>
          <div class="field"><label>Subtitle (EN)</label>
            <input dir="ltr" value="${esc(s.sub_en||"")}" oninput="setIn('hero.slides.${i}.sub_en',this.value)"></div>
        </div>
        <div class="row">
          <div class="field"><label>نص الزرار (عربي)</label>
            <input value="${esc(s.cta_ar||"")}" oninput="setIn('hero.slides.${i}.cta_ar',this.value)"></div>
          <div class="field"><label>Button (EN)</label>
            <input dir="ltr" value="${esc(s.cta_en||"")}" oninput="setIn('hero.slides.${i}.cta_en',this.value)"></div>
          <div class="field"><label>الزرار بيودّي فين</label>
            <input dir="ltr" value="${esc(s.href||"/shop")}" oninput="setIn('hero.slides.${i}.href',this.value)"></div>
          <div class="field"><label>اللون</label>
            <select onchange="setIn('hero.slides.${i}.tone',this.value)">
              ${["rose","navy","coral"].map(t=>`<option value="${t}" ${s.tone===t?"selected":""}>${
                t==="rose"?"وردي":t==="navy"?"كحلي":"مرجاني"}</option>`).join("")}
            </select></div>
        </div>
      </div>`).join("") || `<div class="empty">مفيش سلايدات</div>`}
    <div class="actions"><button class="btn-ghost" onclick="addSlide()">+ سلايد جديد</button></div>
  </div>

  <div class="card">
    <h2>بيانات التواصل (الفوتر وزرار الواتساب)</h2>
    <p class="sub">دي بتظهر لكل زائر. رقم غلط هنا = طلبات ضايعة.</p>
    <div class="row">
      <div class="field"><label>واتساب (بصيغة دولية بدون +)</label>
        <input dir="ltr" placeholder="201035318747" value="${esc(c.whatsapp||"")}" oninput="setIn('contact.whatsapp',this.value)">
        <p class="hint">سيبها فاضية = زرار الواتساب يختفي من الموقع.</p></div>
      <div class="field"><label>تليفون للاتصال</label>
        <input dir="ltr" value="${esc(c.phone||"")}" oninput="setIn('contact.phone',this.value)"></div>
    </div>
    <div class="row">
      <div class="field"><label>العنوان (عربي)</label>
        <input value="${esc(c.address_ar||"")}" oninput="setIn('contact.address_ar',this.value)"></div>
      <div class="field"><label>Address (EN)</label>
        <input dir="ltr" value="${esc(c.address_en||"")}" oninput="setIn('contact.address_en',this.value)"></div>
    </div>
    <div class="row">
      <div class="field"><label>المواعيد (عربي)</label>
        <input value="${esc(c.hours_ar||"")}" oninput="setIn('contact.hours_ar',this.value)"></div>
      <div class="field"><label>Hours (EN)</label>
        <input dir="ltr" value="${esc(c.hours_en||"")}" oninput="setIn('contact.hours_en',this.value)"></div>
    </div>
    <div class="row">
      <div class="field"><label>إنستجرام (لينك كامل)</label>
        <input dir="ltr" placeholder="https://instagram.com/…" value="${esc(c.instagram||"")}" oninput="setIn('contact.instagram',this.value)"></div>
      <div class="field"><label>فيسبوك (لينك كامل)</label>
        <input dir="ltr" placeholder="https://facebook.com/…" value="${esc(c.facebook||"")}" oninput="setIn('contact.facebook',this.value)"></div>
      <div class="field"><label>تيك توك (لينك كامل)</label>
        <input dir="ltr" placeholder="https://tiktok.com/@…" value="${esc(c.tiktok||"")}" oninput="setIn('contact.tiktok',this.value)"></div>
    </div>
    <p class="hint">أي خانة سايبها فاضية بتختفي من الموقع تلقائيًا — مفيش placeholders وهمية.</p>
  </div>

  <div class="card">
    <h2>سياسة الاستبدال</h2>
    <div class="row">
      <div class="field"><label>عدد أيام التبديل</label>
        <input type="number" min="0" max="90" value="${flags.exchange_days??14}" oninput="setIn('flags.exchange_days',Number(this.value))">
        <p class="hint">بتظهر في السلايدر وشريط الطمأنة وصفحة السياسات.</p></div>
    </div>
  </div>

  <div class="card">
    <h2>ظهور الموقع في جوجل (SEO)</h2>
    <div class="field"><label>عنوان الموقع في نتيجة البحث</label>
      <input value="${esc(seo.title_ar||"")}" placeholder="سيبها فاضية = العنوان الافتراضي" oninput="setIn('seo.title_ar',this.value)"></div>
    <div class="field"><label>الوصف في نتيجة البحث</label>
      <textarea placeholder="سيبها فاضية = الوصف الافتراضي" oninput="setIn('seo.description_ar',this.value)">${esc(seo.description_ar||"")}</textarea>
      <p class="hint">خليها بين ١٢٠ و ١٦٠ حرف. اكتبها بالكلمات اللي الناس بتدوّر بيها فعلًا.</p></div>
  </div>

  ${saveBar()}`;
}

/* تعديل قيمة جوّا الـdraft بمسار زي 'hero.slides.0.title_ar' */
function setIn(path, val){
  const parts = path.split(".");
  let o = S.draft;
  for(let i=0;i<parts.length-1;i++){
    const k = parts[i];
    if(o[k]==null || typeof o[k]!=="object") o[k] = /^\d+$/.test(parts[i+1]) ? [] : {};
    o = o[k];
  }
  o[parts[parts.length-1]] = val;
  const root = parts[0];
  if(!S.dirty[root]){ S.dirty[root]=true; renderSaveBar(); }
}
function markDirty(root){ S.dirty[root]=true; }

function addAnnounce(){ S.draft.announce = S.draft.announce||{active:true,items:[]};
  S.draft.announce.items = S.draft.announce.items||[];
  S.draft.announce.items.push({ar:"",en:""}); markDirty("announce"); render(); }
function delAnnounce(i){ S.draft.announce.items.splice(i,1); markDirty("announce"); render(); }
function addSlide(){ S.draft.hero = S.draft.hero||{slides:[]};
  S.draft.hero.slides = S.draft.hero.slides||[];
  S.draft.hero.slides.push({id:"s"+Date.now(),tone:"navy",kicker_ar:"",kicker_en:"",
    title_ar:"",title_en:"",sub_ar:"",sub_en:"",cta_ar:"اطلبي الآن",cta_en:"Order now",href:"/shop"});
  markDirty("hero"); render(); }
function delSlide(i){ if(!confirm("تحذف السلايد ده؟")) return;
  S.draft.hero.slides.splice(i,1); markDirty("hero"); render(); }
function moveSlide(i,d){ const a=S.draft.hero.slides; const j=i+d;
  if(j<0||j>=a.length) return; [a[i],a[j]]=[a[j],a[i]]; markDirty("hero"); render(); }

function configDirtyKeys(){ return Object.keys(S.dirty).filter(k=>k!=="ship"); }

function saveBar(){
  const n = configDirtyKeys().length;
  return `<div class="savebar">
    ${n?`<span class="sub" style="align-self:center"><span class="dirty-dot"></span>فيه تعديلات لسه ما اتحفظتش</span>`:""}
    <button class="btn-ghost" onclick="discard()" ${n?"":"disabled"}>تراجع</button>
    <button class="btn-primary" onclick="saveConfig()" ${n&&!S.busy?"":"disabled"}>
      ${S.busy?"بيحفظ…":"احفظ وانشر على الموقع"}</button>
  </div>`;
}
function renderSaveBar(){ const b=document.querySelector(".savebar"); if(b) b.outerHTML = saveBar(); }

function discard(){ S.draft = clone(S.data.settings);
  const keepShip = S.dirty.ship; S.dirty = keepShip ? {ship:true} : {};
  render(); toast("رجّعنا آخر نسخة محفوظة"); }

async function saveConfig(){
  const patch = {};
  for(const k of configDirtyKeys()){
    if(["announce","hero","contact","flags","seo"].includes(k)) patch[k]=S.draft[k];
    else patch[k]=S.draft[k];
  }
  await guard(async()=>{
    await rpc("shop_fn_save_site_config",{p_patch:patch});
    const keepShip = S.dirty.ship; S.dirty = keepShip ? {ship:true} : {};
    toast("اتحفظ وظهر على الموقع ✓");
  });
}

/* ══ المنتجات على الموقع ═══════════════════════════════════════ */
function productsTab(){
  const all = S.data.products;
  const f = S.pfilter;
  let list = all.filter(p=>{
    if(f==="live") return p.is_published;
    if(f==="hidden") return !p.is_published;
    if(f==="noimg") return p.is_published && p.image_count===0;
    if(f==="nodesc") return p.is_published && !p.has_description;
    if(f==="nostock") return p.is_published && p.stock===0;
    return true;
  });
  const q = S.pq.trim();
  if(q) list = list.filter(p=>(p.name||"").includes(q)||(p.category||"").includes(q));

  const chips = [["all","الكل",all.length],
    ["live","على الموقع",all.filter(p=>p.is_published).length],
    ["hidden","مخفي",all.filter(p=>!p.is_published).length],
    ["noimg","من غير صورة",S.data.health.no_image],
    ["nodesc","من غير وصف",S.data.health.no_desc],
    ["nostock","من غير مخزون",S.data.health.no_stock]];

  return `
  <div class="card tight">
    <div class="tabs" style="margin:0 0 10px">
      ${chips.map(([k,l,n])=>`<button class="tab ${S.pfilter===k?"on":""}"
        onclick="S.pfilter='${k}';S.psel=[];render()">${l} (${num(n)})</button>`).join("")}
    </div>
    <input placeholder="ابحث باسم المنتج أو التصنيف…" value="${esc(S.pq)}"
      oninput="S.pq=this.value;render()">
    ${S.psel.length?`<div class="actions">
        <span class="sub" style="align-self:center">مختار ${num(S.psel.length)}</span>
        <button class="btn-ok btn-sm" onclick="bulkPublish(true)">انشر على الموقع</button>
        <button class="btn-danger btn-sm" onclick="bulkPublish(false)">اخفي من الموقع</button>
        <button class="btn-ghost btn-sm" onclick="S.psel=[];render()">إلغاء التحديد</button>
      </div>`:""}
  </div>

  <div class="card tight scroller">
    <table>
      <thead><tr>
        <th style="width:28px"><input type="checkbox" onchange="selAll(this.checked)"
          ${list.length&&S.psel.length===list.length?"checked":""}></th>
        <th>المنتج</th><th>السعر</th><th>مخزون</th><th>صور</th><th>وصف</th><th>على الموقع</th><th></th>
      </tr></thead>
      <tbody>
      ${list.length? list.map(p=>`
        <tr>
          <td><input type="checkbox" ${S.psel.includes(p.id)?"checked":""} onchange="selOne('${p.id}')"></td>
          <td><div class="name">${esc(p.name)}</div>
              <div class="meta">${esc(p.category||"بلا تصنيف")}${Number(p.live_pct)>0?` · <span class="pill sale">-${Math.round(p.live_pct)}٪</span>`:""}</div></td>
          <td>${money(p.price)}</td>
          <td>${p.stock>0?num(p.stock):`<span class="pill warn">صفر</span>`}</td>
          <td>${p.image_count>0?num(p.image_count):`<span class="pill off">٠</span>`}</td>
          <td>${p.has_description?`<span class="pill on">✓</span>`:`<span class="pill off">ناقص</span>`}</td>
          <td><label class="switch"><input type="checkbox" ${p.is_published?"checked":""}
              onchange="onePublish('${p.id}',this.checked)"></label></td>
          <td><button class="btn-ghost btn-sm" onclick="editProd('${p.id}')">تعديل</button></td>
        </tr>`).join("")
        : `<tr><td colspan="8"><div class="empty">مفيش منتجات مطابقة</div></td></tr>`}
      </tbody>
    </table>
  </div>

  <div class="note info">الصور بترفعها من <a href="photos.html">صفحة صور المنتجات</a> —
  فيها ضغط تلقائي وربط الصورة باللون.</div>

  ${S.editP? prodModal() : ""}`;
}

function prodModal(){
  const p = S.editP;
  const cats = (S.data.categories||[]).filter(Boolean);
  return `<div class="card" style="border-color:var(--brand)">
    <h2>تعديل «${esc(p._orig_name)}» على الموقع</h2>
    <div class="field"><label>الاسم اللي بيظهر على الموقع</label>
      <input value="${esc(p.name||"")}" oninput="S.editP.name=this.value"></div>
    <div class="field"><label>الوصف</label>
      <textarea placeholder="اكتبي الخامة، القاعدة، ارتفاع الكعب، وإمتى تلبسيه — ده اللي بيقنع العميلة."
        oninput="S.editP.description=this.value">${esc(p.description||"")}</textarea>
      <p class="hint">الوصف الحقيقي بيقلّل الأسئلة على الواتساب وبيرفع ظهورك في جوجل. ٢٠ حرف على الأقل.</p></div>
    <div class="row">
      <div class="field"><label>التصنيف</label>
        <input list="catlist" value="${esc(p.category||"")}" oninput="S.editP.category=this.value">
        <datalist id="catlist">${cats.map(c=>`<option value="${esc(c)}">`).join("")}</datalist></div>
      <div class="field"><label>على الموقع؟</label>
        <select onchange="S.editP.is_published=this.value==='1'">
          <option value="1" ${p.is_published?"selected":""}>ظاهر</option>
          <option value="0" ${!p.is_published?"selected":""}>مخفي</option>
        </select></div>
    </div>
    <div class="actions">
      <button class="btn-primary" onclick="saveProd()" ${S.busy?"disabled":""}>${S.busy?"بيحفظ…":"احفظ"}</button>
      <button class="btn-ghost" onclick="S.editP=null;render()">إلغاء</button>
    </div>
  </div>`;
}
function editProd(id){ const p=S.data.products.find(x=>x.id===id);
  S.editP = Object.assign(clone(p), {_orig_name:p.name}); render();
  window.scrollTo({top:document.body.scrollHeight,behavior:"smooth"}); }
async function saveProd(){
  const p=S.editP;
  if(!String(p.name||"").trim()) return toast("الاسم ما ينفعش يبقى فاضي", true);
  await guard(async()=>{
    await rpc("shop_fn_save_product_web",{p:{id:p.id,name:p.name,description:p.description,
      category:p.category,is_published:!!p.is_published}});
    S.editP=null; toast("اتحفظ ✓");
  });
}
function selOne(id){ const i=S.psel.indexOf(id); i>=0?S.psel.splice(i,1):S.psel.push(id); render(); }
function selAll(on){
  const f=S.pfilter, q=S.pq.trim();
  let list=S.data.products.filter(p=>{
    if(f==="live") return p.is_published; if(f==="hidden") return !p.is_published;
    if(f==="noimg") return p.is_published&&p.image_count===0;
    if(f==="nodesc") return p.is_published&&!p.has_description;
    if(f==="nostock") return p.is_published&&p.stock===0; return true;});
  if(q) list=list.filter(p=>(p.name||"").includes(q)||(p.category||"").includes(q));
  S.psel = on? list.map(p=>p.id) : []; render();
}
async function onePublish(id,on){
  await guard(async()=>{ const r=await rpc("shop_fn_set_published",{p_product_ids:[id],p_published:on});
    toast(on?"ظهر على الموقع ✓":"اتخفى من الموقع ✓"); });
}
async function bulkPublish(on){
  const n=S.psel.length;
  if(!on && !confirm(`تخفي ${n} منتج من على الموقع؟`)) return;
  await guard(async()=>{ const r=await rpc("shop_fn_set_published",{p_product_ids:S.psel,p_published:on});
    S.psel=[]; toast(`${on?"اتنشر":"اتخفى"} ${num(r.updated)} منتج ✓`); });
}

/* ══ العروض ════════════════════════════════════════════════════ */
function offersTab(){
  const pub = S.data.products.filter(p=>p.is_published);
  const live = pub.filter(p=>Number(p.live_pct)>0);
  const pct = live.length? Math.round(live[0].live_pct) : "";
  const ends = live.length? dIn(live[0].discount_ends_at) : "";
  const allSame = live.length===pub.length && pub.length>0;

  return `
  <div class="card">
    <h2>خصم عام على كل الموقع</h2>
    <p class="sub">بيتطبّق على كل المنتجات المنشورة مرة واحدة. السعر المعلن هو السعر اللي بيتحاسب عليه فعلًا.</p>
    ${live.length? `<div class="note">شغّال دلوقتي: خصم على ${num(live.length)} من ${num(pub.length)} منتج منشور${allSame?"":" — مش كلهم، يعني فيه خصومات فردية كمان"}.</div>`:""}
    <div class="row">
      <div class="field"><label>نسبة الخصم ٪</label>
        <input id="gpct" type="number" min="1" max="90" value="${pct}"></div>
      <div class="field"><label>ينتهي في (اختياري)</label>
        <input id="gend" type="date" value="${ends}">
        <p class="hint">سيبها فاضية = مستمر لحد ما توقفه بنفسك.</p></div>
    </div>
    <div class="actions">
      <button class="btn-primary" onclick="applyGlobal()" ${S.busy?"disabled":""}>طبّق على كل المنشور</button>
      <button class="btn-danger" onclick="clearGlobal()" ${S.busy?"disabled":""}>شيل الخصم من كل المنتجات</button>
    </div>
  </div>

  <div class="card">
    <h2>خصم على تصنيف</h2>
    <div class="row">
      <div class="field"><label>التصنيف</label>
        <select id="dcat">${(S.data.categories||[]).filter(Boolean).map(c=>`<option>${esc(c)}</option>`).join("")}</select></div>
      <div class="field"><label>النسبة ٪</label><input id="dpct" type="number" min="1" max="90"></div>
      <div class="field"><label>ينتهي في</label><input id="dend" type="date"></div>
    </div>
    <div class="actions">
      <button class="btn-primary" onclick="applyCat()">طبّق</button>
      <button class="btn-danger" onclick="clearCat()">شيل عن التصنيف</button>
    </div>
  </div>

  <div class="card">
    <h2>خصم على منتجات مختارة</h2>
    ${picker(S.discSel,"toggleD","d")}
    <div class="row" style="margin-top:10px">
      <div class="field"><label>النسبة ٪</label><input id="spct" type="number" min="1" max="90"></div>
      <div class="field"><label>ينتهي في</label><input id="send" type="date"></div>
    </div>
    <div class="actions">
      <button class="btn-primary" onclick="applySel()" ${S.discSel.length?"":"disabled"}>طبّق على ${num(S.discSel.length)} منتج</button>
      <button class="btn-danger" onclick="clearSel()" ${S.discSel.length?"":"disabled"}>شيل الخصم عنهم</button>
    </div>
  </div>

  ${collectionsCard()}
  ${bundlesCard()}`;
}

async function applyGlobal(){
  const pct=Number($("#gpct").value), end=$("#gend").value;
  if(!pct||pct<1||pct>90) return toast("اكتب نسبة بين ١ و ٩٠", true);
  await guard(async()=>{
    const r=await rpc("shop_fn_set_global_discount",{p_percent:pct,
      p_starts_at:new Date().toISOString(),
      p_ends_at:end?new Date(end+"T23:59:59").toISOString():null,p_published_only:true});
    toast(`الخصم اتطبّق على ${num(r.updated)} منتج ✓`);
  });
}
async function clearGlobal(){
  if(!confirm("تشيل الخصم عن كل المنتجات؟ ده هيشيل الخصومات الفردية كمان.")) return;
  await guard(async()=>{ const r=await rpc("shop_fn_set_global_discount",{p_percent:null,p_published_only:false});
    toast(`الخصم اتشال عن ${num(r.updated)} منتج ✓`); });
}
async function applyCat(){
  const cat=$("#dcat").value, pct=Number($("#dpct").value), end=$("#dend").value;
  if(!pct||pct<1||pct>90) return toast("اكتب نسبة بين ١ و ٩٠", true);
  await guard(async()=>{ const r=await rpc("shop_fn_set_discount",
    {p_category:cat,p_percent:pct,p_starts_at:new Date().toISOString(),
     p_ends_at:end?new Date(end+"T23:59:59").toISOString():null});
    toast(`اتطبّق على ${num(r.updated)} منتج ✓`); });
}
async function clearCat(){
  const cat=$("#dcat").value;
  if(!confirm(`تشيل الخصم عن كل منتجات «${cat}»؟`)) return;
  await guard(async()=>{ const r=await rpc("shop_fn_set_discount",{p_category:cat,p_percent:null});
    toast(`اتشال عن ${num(r.updated)} منتج ✓`); });
}
function toggleD(id){ const i=S.discSel.indexOf(id); i>=0?S.discSel.splice(i,1):S.discSel.push(id); render(); }
async function applySel(){
  const pct=Number($("#spct").value), end=$("#send").value;
  if(!pct||pct<1||pct>90) return toast("اكتب نسبة بين ١ و ٩٠", true);
  await guard(async()=>{ const r=await rpc("shop_fn_set_discount",
    {p_product_ids:S.discSel,p_percent:pct,p_starts_at:new Date().toISOString(),
     p_ends_at:end?new Date(end+"T23:59:59").toISOString():null});
    S.discSel=[]; toast(`اتطبّق على ${num(r.updated)} منتج ✓`); });
}
async function clearSel(){
  await guard(async()=>{ const r=await rpc("shop_fn_set_discount",{p_product_ids:S.discSel,p_percent:null});
    S.discSel=[]; toast(`اتشال عن ${num(r.updated)} منتج ✓`); });
}

function picker(selected, onToggle, idPrefix){
  const q = (S["q_"+idPrefix]||"").trim();
  const list = S.data.products.filter(p=>p.is_published && (!q || (p.name||"").includes(q)));
  return `
    <input placeholder="ابحث باسم المنتج…" value="${esc(q)}"
      oninput="S.q_${idPrefix}=this.value;render()" style="margin-bottom:8px">
    <div class="picker">
      ${list.length? list.map(p=>`
        <label class="pick-row">
          <input type="checkbox" ${selected.includes(p.id)?"checked":""} onchange="${onToggle}('${p.id}')">
          <span class="pick-name">${esc(p.name)}</span>
          <span class="pick-meta">${money(p.price)}${Number(p.live_pct)>0?` · -${Math.round(p.live_pct)}٪`:""}</span>
        </label>`).join("")
        : `<div class="empty">مفيش منتجات منشورة مطابقة</div>`}
    </div>`;
}

/* ── المجموعات (سكاشن الصفحة الرئيسية) ── */
const KIND_LABEL = {manual:"أنا أختار المنتجات",best_sellers:"تلقائي — الأكثر مبيعًا",
  newest:"تلقائي — الأحدث",discounted:"تلقائي — عليه خصم",low_stock:"تلقائي — على وشك يخلص"};

function collectionsCard(){
  if(S.editC){
    const c=S.editC, manual=c.kind==="manual";
    return `<div class="card" style="border-color:var(--brand)">
      <h2>${c.id?"تعديل سكشن":"سكشن جديد على الصفحة الرئيسية"}</h2>
      <div class="row">
        <div class="field"><label>العنوان (عربي)</label>
          <input value="${esc(c.title_ar)}" oninput="S.editC.title_ar=this.value"></div>
        <div class="field"><label>Title (EN)</label>
          <input dir="ltr" value="${esc(c.title_en)}" oninput="S.editC.title_en=this.value"></div>
      </div>
      <div class="row">
        <div class="field"><label>وصف صغير (عربي)</label>
          <input value="${esc(c.subtitle_ar||"")}" oninput="S.editC.subtitle_ar=this.value"></div>
        <div class="field"><label>Subtitle (EN)</label>
          <input dir="ltr" value="${esc(c.subtitle_en||"")}" oninput="S.editC.subtitle_en=this.value"></div>
      </div>
      <div class="row">
        <div class="field"><label>بيتملى إزاي؟</label>
          <select onchange="S.editC.kind=this.value;render()">
            ${Object.entries(KIND_LABEL).map(([k,l])=>`<option value="${k}" ${c.kind===k?"selected":""}>${l}</option>`).join("")}
          </select></div>
        <div class="field"><label>الترتيب</label>
          <input type="number" value="${c.sort||0}" oninput="S.editC.sort=this.value"></div>
        <div class="field"><label>أقصى عدد منتجات</label>
          <input type="number" min="1" max="24" value="${c.max_items||8}" oninput="S.editC.max_items=this.value"></div>
      </div>
      <div class="row">
        <div class="field"><label>يبدأ في (اختياري)</label>
          <input type="date" value="${dIn(c.starts_at)}" oninput="S.editC.starts_at=this.value"></div>
        <div class="field"><label>ينتهي في (اختياري)</label>
          <input type="date" value="${dIn(c.ends_at)}" oninput="S.editC.ends_at=this.value"></div>
      </div>
      ${manual? `<h3>اختار المنتجات</h3>${picker(c.product_ids,"toggleCp","c")}`:""}
      <div class="actions">
        <button class="btn-primary" onclick="saveC()" ${S.busy?"disabled":""}>احفظ</button>
        <button class="btn-ghost" onclick="S.editC=null;render()">إلغاء</button>
      </div>
    </div>`;
  }
  return `<div class="card">
    <h2>سكاشن الصفحة الرئيسية</h2>
    <p class="sub">كل شريط منتجات على الرئيسية = سكشن هنا. تقدر تضيف سكاشن جديدة من غير كود.</p>
    ${(S.data.collections||[]).map(c=>`
      <div class="list-item">
        <div class="grow"><div class="name">${esc(c.title_ar)}</div>
          <div class="meta">${KIND_LABEL[c.kind]||c.kind} · ترتيب ${num(c.sort)} ·
            ${c.kind==="manual"?`${num((c.product_ids||[]).length)} منتج`:`أقصى ${num(c.max_items)}`}</div></div>
        <span class="pill ${c.active?"on":"off"}">${c.active?"ظاهر":"مخفي"}</span>
        <button class="btn-ghost btn-sm" onclick="toggleCActive('${c.id}',${c.active?"false":"true"})">${c.active?"اخفي":"اظهر"}</button>
        <button class="btn-ghost btn-sm" onclick="editC('${c.id}')">تعديل</button>
        <button class="btn-danger btn-sm" onclick="delC('${c.id}')">حذف</button>
      </div>`).join("") || `<div class="empty">مفيش سكاشن</div>`}
    <div class="actions"><button class="btn-ghost" onclick="newC()">+ سكشن جديد</button></div>
  </div>`;
}
function newC(){ S.editC={id:null,slug:"",title_ar:"",title_en:"",subtitle_ar:"",subtitle_en:"",
  kind:"manual",sort:(S.data.collections||[]).length,active:true,max_items:8,product_ids:[],
  starts_at:null,ends_at:null}; render(); }
function editC(id){ S.editC=clone((S.data.collections||[]).find(x=>x.id===id)); render(); }
function toggleCp(id){ const a=S.editC.product_ids; const i=a.indexOf(id); i>=0?a.splice(i,1):a.push(id); render(); }
async function saveC(){
  const c=S.editC;
  if(!String(c.title_ar).trim()||!String(c.title_en).trim()) return toast("لازم عنوان بالعربي والإنجليزي", true);
  await guard(async()=>{ await rpc("shop_fn_save_collection",{p:c}); S.editC=null; toast("اتحفظ ✓"); });
}
async function toggleCActive(id,val){
  const c=(S.data.collections||[]).find(x=>x.id===id);
  await guard(async()=>{ await rpc("shop_fn_save_collection",{p:Object.assign({},c,{active:val})});
    toast(val?"ظهر على الموقع ✓":"اتخفى ✓"); });
}
async function delC(id){
  const name = ((S.data.collections||[]).find(x=>x.id===id)||{}).title_ar || "";
  if(!confirm(`تحذف سكشن «${name}»؟ ده مش هيحذف المنتجات نفسها.`)) return;
  await guard(async()=>{ await rpc("shop_fn_delete_collection",{p_id:id}); toast("اتحذف ✓"); });
}

/* ── الباندلز ── */
function bundlesCard(){
  if(S.editB){
    const b=S.editB;
    const sel=b.items.map(i=>i.product_id);
    return `<div class="card" style="border-color:var(--brand)">
      <h2>${b.id?"تعديل باندل":"باندل جديد"}</h2>
      <div class="row">
        <div class="field"><label>الاسم (عربي)</label>
          <input value="${esc(b.title_ar)}" oninput="S.editB.title_ar=this.value"></div>
        <div class="field"><label>Title (EN)</label>
          <input dir="ltr" value="${esc(b.title_en)}" oninput="S.editB.title_en=this.value"></div>
      </div>
      <div class="row">
        <div class="field"><label>سعر الباندل</label>
          <input type="number" value="${b.bundle_price||""}" oninput="S.editB.bundle_price=this.value"></div>
        <div class="field"><label>ينتهي في (اختياري)</label>
          <input type="date" value="${dIn(b.ends_at)}" oninput="S.editB.ends_at=this.value"></div>
      </div>
      <h3>منتجات الباندل (اتنين على الأقل)</h3>
      ${picker(sel,"toggleBp","b")}
      ${b.items.length?`<div style="margin-top:8px">${b.items.map(it=>{
        const p=S.data.products.find(x=>x.id===it.product_id)||{};
        return `<div class="list-item"><span class="grow">${esc(p.name||"—")}</span>
          <button class="btn-ghost btn-sm" onclick="bQty('${it.product_id}',-1)">−</button>
          <span>${num(it.qty)}</span>
          <button class="btn-ghost btn-sm" onclick="bQty('${it.product_id}',1)">+</button></div>`;}).join("")}</div>`:""}
      <div class="actions">
        <button class="btn-primary" onclick="saveB()" ${S.busy?"disabled":""}>احفظ</button>
        <button class="btn-ghost" onclick="S.editB=null;render()">إلغاء</button>
      </div>
    </div>`;
  }
  return `<div class="card">
    <h2>الباندلز (اشتري اتنين بسعر)</h2>
    ${(S.data.bundles||[]).map(b=>`
      <div class="list-item">
        <div class="grow"><div class="name">${esc(b.title_ar)}</div>
          <div class="meta">${money(b.bundle_price)} · ${num((b.items||[]).length)} منتج</div></div>
        <span class="pill ${b.active?"on":"off"}">${b.active?"ظاهر":"مخفي"}</span>
        <button class="btn-ghost btn-sm" onclick="editB('${b.id}')">تعديل</button>
        <button class="btn-danger btn-sm" onclick="delB('${b.id}')">حذف</button>
      </div>`).join("") || `<div class="empty">مفيش باندلز</div>`}
    <div class="actions"><button class="btn-ghost" onclick="newB()">+ باندل جديد</button></div>
  </div>`;
}
function newB(){ S.editB={id:null,title_ar:"",title_en:"",subtitle_ar:"",subtitle_en:"",
  bundle_price:"",active:true,sort:0,items:[],starts_at:null,ends_at:null}; render(); }
function editB(id){ S.editB=clone((S.data.bundles||[]).find(x=>x.id===id)); render(); }
function toggleBp(id){ const it=S.editB.items; const i=it.findIndex(x=>x.product_id===id);
  i>=0?it.splice(i,1):it.push({product_id:id,qty:1}); render(); }
function bQty(id,d){ const it=S.editB.items.find(x=>x.product_id===id);
  if(it){ it.qty=Math.max(1,Math.min(5,it.qty+d)); render(); } }
async function saveB(){
  const b=S.editB;
  if(!String(b.title_ar).trim()||!String(b.title_en).trim()) return toast("لازم اسم بالعربي والإنجليزي", true);
  if(!Number(b.bundle_price)) return toast("اكتب سعر الباندل", true);
  if(b.items.length<2) return toast("الباندل لازم فيه منتجين على الأقل", true);
  await guard(async()=>{ await rpc("shop_fn_save_bundle",{p:b}); S.editB=null; toast("اتحفظ ✓"); });
}
async function delB(id){
  const name = ((S.data.bundles||[]).find(x=>x.id===id)||{}).title_ar || "";
  if(!confirm(`تحذف باندل «${name}»؟`)) return;
  await guard(async()=>{ await rpc("shop_fn_delete_bundle",{p_id:id}); toast("اتحذف ✓"); });
}

/* ══ الشحن ═════════════════════════════════════════════════════ */
function shippingTab(){
  const rows = S.ship||[];
  const off = rows.filter(r=>!r.active).length;
  return `
  <div class="card tight">
    <h2>أسعار الشحن لكل محافظة</h2>
    <p class="sub">السعر ده اللي بيتحسب للعميلة في الشيك أوت، ومدة الوصول اللي بتظهر لها.
      المحافظة المقفولة مش بتظهر في قائمة الشحن أصلًا.</p>
    ${off?`<div class="note">${num(off)} محافظة مقفولة — العميلة فيها مش هتقدر تطلب.</div>`:""}
    <div class="row" style="margin:10px 0">
      <div class="field" style="margin:0"><label>عدّل كل الأسعار مرة واحدة</label>
        <input id="bulkprice" type="number" placeholder="سعر موحّد لكل المحافظات"></div>
      <div style="flex:0 0 auto;align-self:flex-end">
        <button class="btn-ghost" onclick="bulkPrice()">طبّق على الكل</button></div>
    </div>
  </div>

  <div class="card tight scroller">
    <table>
      <thead><tr><th>المحافظة</th><th>السعر</th><th>من (يوم)</th><th>لـ (يوم)</th><th>شغّالة</th></tr></thead>
      <tbody>
      ${rows.map((r,i)=>`<tr>
        <td>${esc(r.governorate)}</td>
        <td><input class="w-num" type="number" min="0" value="${r.price}" oninput="shipSet(${i},'price',Number(this.value))"></td>
        <td><input class="w-num" type="number" min="1" value="${r.eta_min_days??2}" oninput="shipSet(${i},'eta_min_days',Number(this.value))"></td>
        <td><input class="w-num" type="number" min="1" value="${r.eta_max_days??3}" oninput="shipSet(${i},'eta_max_days',Number(this.value))"></td>
        <td><label class="switch"><input type="checkbox" ${r.active?"checked":""}
             onchange="shipSet(${i},'active',this.checked)"></label></td>
      </tr>`).join("")}
      </tbody>
    </table>
  </div>
  ${shipBar()}`;
}
function shipSet(i,k,v){
  const first = !S.dirty.ship;
  S.ship[i][k]=v; S.dirty.ship=true;
  /* رسم الشريط بس — إعادة رسم الجدول كلها كانت بتضيّع مكان المؤشر أثناء الكتابة */
  if(first) renderShipBar();
}
function renderShipBar(){
  const b=document.querySelector(".savebar");
  if(b && S.tab==="shipping") b.outerHTML = shipBar();
}
function shipBar(){
  return `<div class="savebar">
    ${S.dirty.ship?`<span class="sub" style="align-self:center"><span class="dirty-dot"></span>فيه تعديلات لسه ما اتحفظتش</span>`:""}
    <button class="btn-ghost" onclick="discardShip()" ${S.dirty.ship?"":"disabled"}>تراجع</button>
    <button class="btn-primary" onclick="saveShip()" ${S.dirty.ship&&!S.busy?"":"disabled"}>
      ${S.busy?"بيحفظ…":"احفظ أسعار الشحن"}</button>
  </div>`;
}
function discardShip(){ S.ship = clone(S.data.shipping); delete S.dirty.ship; render(); }
function bulkPrice(){
  const v=Number($("#bulkprice").value);
  if(!v && v!==0) return toast("اكتب سعر", true);
  S.ship.forEach(r=>r.price=v); S.dirty.ship=true; render();
  toast("اتغيّر مؤقتًا — اضغط احفظ عشان يظهر على الموقع");
}
async function saveShip(){
  await guard(async()=>{ const r=await rpc("shop_fn_save_shipping_rates",{p_rows:S.ship});
    delete S.dirty.ship; toast(`اتحفظت ${num(r.updated)} محافظة ✓`); });
}

/* ══ الإعدادات ═════════════════════════════════════════════════ */
function settingsTab(){
  const d=S.draft, flags=d.flags||{};
  return `
  <div class="card">
    <h2>استقبال الطلبات</h2>
    <label class="switch"><input type="checkbox" ${flags.orders_paused?"checked":""}
      onchange="setIn('flags.orders_paused',this.checked)"> أوقف الطلبات مؤقتًا</label>
    <p class="hint">الموقع هيفضل شغّال ويعرض المنتجات، بس زرار الطلب هيتقفل ويظهر النص اللي تحت.</p>
    <div class="field" style="margin-top:10px"><label>الرسالة اللي تظهر وقت التوقف (عربي)</label>
      <input value="${esc(flags.paused_msg_ar||"")}" oninput="setIn('flags.paused_msg_ar',this.value)"></div>
    <div class="field"><label>Message (EN)</label>
      <input dir="ltr" value="${esc(flags.paused_msg_en||"")}" oninput="setIn('flags.paused_msg_en',this.value)"></div>
  </div>

  <div class="card">
    <h2>مواعيد التوصيل</h2>
    <p class="sub">دي اللي بتحسب «هيوصلك يوم كذا» على صفحة المنتج والشيك أوت.</p>
    <div class="row">
      <div class="field"><label>أقل عدد أيام (للمتوفر)</label>
        <input type="number" min="1" value="${d.default_lead_min??3}" oninput="setIn('default_lead_min',Number(this.value))"></div>
      <div class="field"><label>أكبر عدد أيام</label>
        <input type="number" min="1" value="${d.default_lead_max??5}" oninput="setIn('default_lead_max',Number(this.value))"></div>
      <div class="field"><label>أيام التحت الطلب</label>
        <input type="number" min="1" value="${d.extended_lead_days??7}" oninput="setIn('extended_lead_days',Number(this.value))"></div>
    </div>
    <div class="row">
      <div class="field"><label>آخر ساعة للشحن في نفس اليوم</label>
        <input type="number" min="0" max="23" value="${d.dispatch_cutoff_hour??18}" oninput="setIn('dispatch_cutoff_hour',Number(this.value))">
        <p class="hint">الطلب بعد الساعة دي بيتحسب على اليوم اللي بعده.</p></div>
      <div class="field"><label>يوم راحة شركة الشحن</label>
        <select onchange="setIn('courier_rest_dow',this.value===''?null:Number(this.value))">
          <option value="" ${d.courier_rest_dow==null?"selected":""}>مفيش</option>
          ${["الأحد","الإثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"].map((n,i)=>
            `<option value="${i}" ${d.courier_rest_dow===i?"selected":""}>${n}</option>`).join("")}
        </select></div>
    </div>
  </div>

  <div class="card">
    <h2>حجز المخزون للطلبات الأونلاين</h2>
    <div class="row">
      <div class="field"><label>مدة الحجز (دقيقة)</label>
        <input type="number" min="5" value="${d.hold_duration_minutes??60}" oninput="setIn('hold_duration_minutes',Number(this.value))">
        <p class="hint">الطلب اللي ما اتأكدش خلال المدة دي بيرجع المخزون تلقائيًا.</p></div>
      <div class="field"><label>أقصى عدد قطع محجوزة في نفس الوقت</label>
        <input type="number" min="1" value="${d.max_web_holds??40}" oninput="setIn('max_web_holds',Number(this.value))"></div>
    </div>
  </div>

  <div class="card">
    <h2>أكواد التتبع والإعلانات</h2>
    <p class="sub">سيبها فاضية = مفيش أي تتبع بيتحمّل على الموقع.</p>
    <div class="row">
      <div class="field"><label>Google Analytics 4</label>
        <input dir="ltr" placeholder="G-XXXXXXX" value="${esc(d.ga4_id||"")}" oninput="setIn('ga4_id',this.value)"></div>
      <div class="field"><label>Meta Pixel</label>
        <input dir="ltr" placeholder="1234567890" value="${esc(d.meta_pixel_id||"")}" oninput="setIn('meta_pixel_id',this.value)"></div>
      <div class="field"><label>TikTok Pixel</label>
        <input dir="ltr" placeholder="CXXXXXXXXXX" value="${esc(d.tiktok_pixel_id||"")}" oninput="setIn('tiktok_pixel_id',this.value)"></div>
    </div>
  </div>

  ${saveBar()}`;
}

/* ══ التقييمات ═════════════════════════════════════════════════ */
function reviewsTab(){
  const list = S.data.reviews_pending||[];
  return `<div class="card">
    <h2>تقييمات مستنية موافقتك</h2>
    <p class="sub">التقييم ما بيظهرش على الموقع غير لما توافق عليه. كلها من مشتريين متحقّق منهم.</p>
    ${list.length? list.map(r=>`
      <div class="list-item" style="align-items:flex-start">
        <div class="grow">
          <div class="name">${"★".repeat(r.rating)}${"☆".repeat(5-r.rating)} — ${esc(r.author_name||"بدون اسم")}</div>
          <div class="meta">${esc(r.product_name||"—")}${r.size_bought?` · مقاس ${esc(r.size_bought)}`:""}${r.fit_feedback?` · ${esc(r.fit_feedback)}`:""}</div>
          ${r.body?`<p style="margin:6px 0 0;font-size:13px">${esc(r.body)}</p>`:""}
        </div>
        <button class="btn-ok btn-sm" onclick="modReview('${r.id}','approved')">وافق</button>
        <button class="btn-danger btn-sm" onclick="modReview('${r.id}','rejected')">ارفض</button>
      </div>`).join("")
      : `<div class="empty">مفيش تقييمات مستنية</div>`}
  </div>`;
}
async function modReview(id,st){
  await guard(async()=>{ await rpc("shop_fn_moderate_review",{p_review_id:id,p_status:st});
    toast(st==="approved"?"ظهر على الموقع ✓":"اترفض ✓"); });
}

/* ══ الرسم ═════════════════════════════════════════════════════ */
const TABS = [
  ["home","نظرة عامة"], ["content","الواجهة والمحتوى"], ["products","المنتجات"],
  ["offers","العروض والسكاشن"], ["shipping","الشحن"], ["settings","الإعدادات"], ["reviews","التقييمات"]
];

function go(tab, filter){
  S.tab=tab; if(filter) S.pfilter=filter; S.psel=[]; render();
  window.scrollTo({top:0,behavior:"smooth"});
}

/* ══ تذكير النسخة الاحتياطية ═════════════════════════════════════
   النسخ اليومية عايشة جوّه نفس قاعدة البيانات. دي بتحمي من الغلط
   البشري، بس مش بتحمي لو المشروع نفسه ضاع — والباقة المجانية مفيهاش
   نسخ من Supabase. النسخة اللي بتتنزّل على جهازه هي الحماية الوحيدة
   ضد ده، ومحدش غيره يقدر ينزّلها.

   اللافتة بتظهر فوق كل تاب لما توصل ٧ أيام، وبتقفل بضغطة واحدة. */
function backupBanner(){
  const b = S.backup;
  if(!b) return "";
  const lvl = b.offsite_level;
  if(lvl === "ok") return "";

  const days = b.offsite_days == null ? null : Math.floor(b.offsite_days);
  const title = lvl === "never" ? "لسه ما نزّلتش ولا نسخة على جهازك"
    : lvl === "overdue" ? `بقى ${num(days)} يوم من غير نسخة على جهازك`
    : `عدّى ${num(days)} يوم على آخر نسخة نزّلتها`;
  const detail = lvl === "never"
    ? "فيه نسخة يومية تلقائية، بس هي جوّه نفس قاعدة البيانات. لو المشروع ضاع، تضيع معاه."
    : "النسخة اليومية شغّالة، بس جوّه نفس القاعدة. النسخة اللي على جهازك هي الوحيدة اللي بتحميك لو المشروع نفسه ضاع.";

  return `<div class="bkp ${lvl}">
    <div class="grow"><p class="t">${esc(title)}</p><p class="d">${esc(detail)}</p></div>
    <button class="btn-primary" onclick="downloadBackup()" ${S.dl?"disabled":""}>
      ${S.dl?"بيجهّز…":"نزّل نسخة دلوقتي"}</button>
  </div>`;
}

/* بطاقة دائمة في «نظرة عامة» — حتى وهي سليمة، عشان يشوف الأرقام
   ويثق فيها بدل ما يفتكر إن مفيش نسخ. */
function backupCard(){
  const b = S.backup;
  if(!b) return "";
  const lvl = b.offsite_level;
  const when = (t) => t ? new Date(t).toLocaleDateString("ar-EG",
    {year:"numeric",month:"long",day:"numeric"}) : "—";
  return `<div class="card">
    <h2>النسخ الاحتياطي</h2>
    <div class="list-item">
      <div class="grow"><div class="name">النسخة التلقائية اليومية</div>
        <div class="meta">آخر واحدة ${esc(when(b.last_snapshot))} · ${num(b.snapshot_tables)} جدول ·
          ${num(b.total_rows)} صف · محفوظ ${num(b.snapshot_count)} نسخة</div></div>
      <span class="pill ${b.coverage_ok?'on':'off'}">${b.coverage_ok?"كاملة":"ناقصة"}</span>
    </div>
    <div class="list-item">
      <div class="grow"><div class="name">النسخة اللي على جهازك</div>
        <div class="meta">${lvl==="never" ? "ولا مرة"
          : `آخر واحدة ${esc(when(b.last_offsite))} · من ${num(Math.floor(b.offsite_days))} يوم`}</div></div>
      <span class="pill ${lvl==="ok"?"on":lvl==="due"?"warn":"off"}">
        ${lvl==="ok"?"حديثة":lvl==="due"?"وقتها":"متأخرة"}</span>
      <button class="btn-ghost btn-sm" onclick="downloadBackup()" ${S.dl?"disabled":""}>
        ${S.dl?"بيجهّز…":"نزّل"}</button>
    </div>
    ${b.coverage_ok?"":`<div class="note">النسخة اليومية غطّت ${num(b.snapshot_tables)} جدول من
      ${num(b.expected_tables)} — فيه جدول مش بيتحفظ. بلّغني.</div>`}
    <p class="hint">النسخة اليومية بتحميك من الغلط البشري. النسخة اللي بتنزّلها على جهازك
      هي اللي بتحميك لو مشروع القاعدة نفسه ضاع — خليها كل أسبوع في مكانين.</p>
  </div>`;
}

async function downloadBackup(){
  if(S.dl) return;
  S.dl = true; render();
  try{
    const doc = await rpc("pos_fn_export_all",{});
    const stamp = new Date().toISOString().slice(0,10);
    const blob = new Blob([JSON.stringify(doc)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `omraa-backup-${stamp}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    // المتصفح لسه بيكتب الملف لحظة الضغط — التفكيك بعد شوية
    setTimeout(()=>URL.revokeObjectURL(url), 4000);
    toast(`نزّلت ${num(doc.total_rows)} صف — احفظه في مكانين ✓`);
    S.backup = await rpc("pos_fn_backup_health",{});
  }catch(e){
    toast(e.message||"مش قادر أجهّز النسخة", true);
  }finally{
    S.dl = false; render();
  }
}

function render(){
  if(!S.data) return;
  const pend = S.data.health.reviews_pending;
  const body = {home:homeTab, content:contentTab, products:productsTab,
                offers:offersTab, shipping:shippingTab, settings:settingsTab, reviews:reviewsTab}[S.tab]();
  $("#app").innerHTML = `
    ${backupBanner()}
    <div class="tabs">
      ${TABS.map(([k,l])=>`<button class="tab ${S.tab===k?"on":""}" onclick="go('${k}')">${l}${
        k==="reviews"&&pend?`<span class="badge">${num(pend)}</span>`:""}</button>`).join("")}
    </div>
    ${body}`;
}

/* أمان: تحذير قبل الخروج ومعاه تعديلات ما اتحفظتش */
window.addEventListener("beforeunload", e=>{
  if(Object.keys(S.dirty).length){ e.preventDefault(); e.returnValue=""; }  // يشمل الشحن
});

load(true);
