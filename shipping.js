/* ══════════════════════════════════════════════════════════════════
   شاشة الشحن — مبنية لإبراهيم، على الموبايل، بإيد واحدة.

   ليه اتعملت: ١٠٧ شحنة كلها واقفة على «تحت التجهيز» و١٢٨٬٨٠٠ جنيه
   تحصيل مش متتبّع — مش لأن حد مقصّر، لأن **مكانش فيه شاشة أصلًا**.
   الدوال في القاعدة كانت جاهزة من زمان (pos_fn_shipments،
   pos_fn_update_shipment، pos_fn_bulk_ship_update، pos_fn_settle_money)
   بس محدش وصّلها بواجهة.

   المبدأ: الحالة الطبيعية = **ضغطة واحدة**. الشحنة بتمشي في خط واحد
   تجهيز ← مع المندوب ← تحت التسليم ← اتسلّمت ← اتحصّل، والزرار الكبير
   دايمًا بيعمل الخطوة اللي بعدها. أي حاجة غير كده (رجّعت، ضاعت) في
   لوحة جانبية عشان ما تزحمش الشاشة ولا تتضغط بالغلط.
   ══════════════════════════════════════════════════════════════════ */

const SUPABASE_URL = "https://mjetglnmivwphxyzflsz.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qZXRnbG5taXZ3cGh4eXpmbHN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NTcwODgsImV4cCI6MjA5NjQzMzA4OH0.X6Rvxo4owPcBwE4HqXLm5fuPDSdEo8PV9oBV-bHsGrg";

/* ── الجلسة ────────────────────────────────────────────────────────
   الـPOS بيستخدم @supabase/ssr، وده بيخزّن الجلسة في **كوكي** مش في
   localStorage — والكوكي ممكن تكون:
     • متقسّمة على أجزاء:  sb-<ref>-auth-token.0 / .1 / …
     • مبدوءة بـ"base64-" ومكوّدة base64url
     • JSON عادي، أو مصفوفة أول عنصر فيها الـaccess_token
   القراءة القديمة كانت بتدوّر في localStorage وتعمل JSON.parse على طول،
   فكانت بترجع null وتقع على مفتاح anon — والنتيجة رسالة
   "permission denied for function …" مالهاش أي علاقة بالمشكلة الحقيقية.

   بنقرا من الكوكي أولًا ومن localStorage كاحتياطي، وبنقرا **مع كل نداء**
   عشان لو الـPOS جدّد الجلسة في تاب تاني نمشي على الجديد. */
const SB_REF = SUPABASE_URL.replace(/^https?:\/\//, "").split(".")[0];

function b64urlToText(s){
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function readCookieChunks(name){
  const jar = {};
  for(const part of String(document.cookie || "").split(";")){
    const i = part.indexOf("=");
    if(i < 0) continue;
    jar[part.slice(0, i).trim()] = part.slice(i + 1);
  }
  if(jar[name] !== undefined) return jar[name];
  // الكوكي الكبيرة بتتقسّم لأجزاء مرقّمة، ولازم تترص بالترتيب
  let out = "", n = 0;
  while(jar[`${name}.${n}`] !== undefined){ out += jar[`${name}.${n}`]; n++; }
  return n > 0 ? out : null;
}

function parseSession(raw){
  if(!raw) return null;
  let v = raw;
  try{ v = decodeURIComponent(v); }catch(e){}
  if(v.startsWith("base64-")){
    try{ v = b64urlToText(v.slice(7)); }catch(e){ return null; }
  }
  let o; try{ o = JSON.parse(v); }catch(e){ return null; }
  if(Array.isArray(o)) return { access_token: o[0], expires_at: o[2] };
  if(o && o.currentSession) o = o.currentSession;
  return o && o.access_token ? o : null;
}

function session(){
  const s = parseSession(readCookieChunks(`sb-${SB_REF}-auth-token`));
  if(s) return s;
  try{
    for(let i = 0; i < localStorage.length; i++){
      const k = localStorage.key(i);
      if(/^sb-.*-auth-token(\.\d+)?$/.test(k)){
        const t = parseSession(localStorage.getItem(k));
        if(t) return t;
      }
    }
  }catch(e){}
  return null;
}

function accessToken(){
  const s = session();
  return s ? s.access_token : null;
}

/* التوكن بيقع بعد ساعة. لو الـPOS مقفول في التابات التانية، الجلسة
   ما بتتجددش، والنداء بيرجع 401 برسالة مالهاش معنى. بنكشف ده هنا
   ونقول له يعمل إيه. */
function sessionExpired(){
  const s = session();
  return !!(s && s.expires_at && Number(s.expires_at) * 1000 < Date.now());
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
  if(!res.ok){
    const raw = (data && (data.message||data.hint)) || `HTTP ${res.status}`;
    throw new Error(explainAuth(raw, res.status));
  }
  return data;
}
function explainAuth(raw, status){
  const s = String(raw||"");
  if(!accessToken()) return "مش لاقي جلستك — سجّل دخول تاني.";
  if(sessionExpired() || status === 401) return "الجلسة انتهت. افتح النظام تاني وحدّث الصفحة.";
  if(/permission denied|owner only|unauthorised/i.test(s)) return "الحساب ده مش مصرّح له.";
  return s;
}

/* ── الحالة ─────────────────────────────────────────────────────── */
const FLOW = ["preparing","with_courier","out_for_delivery","delivered"];
const NEXT_LABEL = {
  preparing:        "طلعت مع المندوب",
  with_courier:     "بيوصّلها دلوقتي",
  out_for_delivery: "وصلت للعميلة",
};
const TABS = [
  ["todo",  "محتاج حاجة"],
  ["out",   "مع المندوب"],
  ["money", "فلوس مستنية"],
  ["done",  "خلصت"],
];

let S = { tab:"todo", rows:[], q:"", sel:[], busy:false, sheet:null, loaded:false };

const $  = (s) => document.querySelector(s);
const esc = (s) => String(s??"").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num = (n) => new Intl.NumberFormat("ar-EG").format(Number(n)||0);
const money = (n) => num(Math.round(Number(n)||0)) + " ج";
const daysAgo = (t) => t ? Math.floor((Date.now()-new Date(t).getTime())/86400000) : 0;

function toast(msg, err){
  const t=$("#toast"); t.textContent=msg; t.className=err?"err":"";
  t.style.display="block"; clearTimeout(t._h);
  t._h=setTimeout(()=>t.style.display="none", err?5000:2200);
}

async function load(){
  try{
    // بنجيب الاتنين مرة واحدة: الشحنات الشغّالة واللي فلوسها مستنية
    const [a,m] = await Promise.all([ rpc("pos_fn_shipments",{p_view:"active"}),
                                      rpc("pos_fn_shipments",{p_view:"money"}) ]);
    const byId = {};
    for(const r of (a&&a.shipments)||[]) byId[r.id]=r;
    for(const r of (m&&m.shipments)||[]) byId[r.id]=r;
    S.rows = Object.values(byId);
    S.loaded = true;
    render();
  }catch(e){
    $("#app").innerHTML = `<div class="center">
      <p style="color:var(--danger);font-weight:600">${esc(e.message)}</p>
      <p><a href="login.html">سجّل دخول</a></p></div>`;
  }
}

/* ── تقسيم الشحنات على التبويبات ─────────────────────────────────
   «محتاج حاجة» هو التبويب الافتراضي عن قصد: هو اللي فيه شغل النهارده. */
function bucket(r){
  if(r.status==="preparing") return "todo";
  if(r.status==="delivered" && r.money==="waiting") return "money";
  if(r.status==="with_courier" || r.status==="out_for_delivery") return "out";
  return "done";
}
function rowsFor(tab){
  const q = S.q.trim();
  let list = S.rows.filter(r=>bucket(r)===tab);
  if(q){
    const nq = q.replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d));
    list = list.filter(r =>
      (r.customer||"").includes(q) || (r.phone||"").includes(nq) ||
      (r.sale_code||"").toLowerCase().includes(q.toLowerCase()) ||
      (r.address||"").includes(q));
  }
  // الأقدم فوق: اللي مستني من أسبوع أهم من اللي اتعمل النهارده
  return list.sort((x,y)=> new Date(x.created_at) - new Date(y.created_at));
}

/* ── الرسم ──────────────────────────────────────────────────────── */
function render(){
  if(!S.loaded) return;
  const counts = {};
  for(const [k] of TABS) counts[k] = S.rows.filter(r=>bucket(r)===k).length;

  $("#tabs").innerHTML = TABS.map(([k,l])=>
    `<button class="tab ${S.tab===k?"on":""}" onclick="go('${k}')">${l}<span class="n">${num(counts[k])}</span></button>`
  ).join("");

  const list = rowsFor(S.tab);
  const totalCod = list.reduce((s,r)=>s+(Number(r.cod)||0),0);

  $("#app").innerHTML = `
    <input class="search" placeholder="دوّر باسم العميلة أو الموبايل…" value="${esc(S.q)}"
           oninput="S.q=this.value;render()">
    ${S.tab==="money" && list.length ? `<div class="sum">
        <span>فلوس مستنية التحصيل</span><b>${money(totalCod)}</b></div>` : ""}
    ${list.length ? list.map(card).join("") : emptyState()}`;

  renderBulk();
}

function emptyState(){
  const msg = { todo:["✅","مفيش حاجة مستنية — كله اتشحن"],
                out:["🚚","مفيش شحنات مع المندوب دلوقتي"],
                money:["💰","مفيش فلوس مستنية"],
                done:["📦","لسه مفيش شحنات خلصت"] }[S.tab];
  return `<div class="empty"><div class="big">${msg[0]}</div>${msg[1]}</div>`;
}

function card(r){
  const d = daysAgo(r.created_at);
  const late = d >= 3 && r.status !== "delivered";
  const nextS = FLOW[FLOW.indexOf(r.status)+1];
  const on = S.sel.includes(r.id);
  const stage = { preparing:1, with_courier:2, out_for_delivery:3, delivered:4 }[r.status]||1;

  // الزرار الكبير = الخطوة الطبيعية اللي بعدها. مفيش قوائم ولا اختيارات.
  let main = "";
  if(r.status==="delivered" && r.money==="waiting")
    main = `<button class="money" onclick="askMoney('${r.id}')">حصّلت الفلوس</button>`;
  else if(nextS)
    main = `<button class="go" onclick="advance('${r.id}','${nextS}')">${NEXT_LABEL[r.status]}</button>`;

  return `<div class="ship ${late?"late":""} ${on?"sel":""}">
    <div class="s-head">
      ${r.status!=="delivered" || r.money==="waiting"
        ? `<div class="pick ${on?"on":""}" onclick="pick('${r.id}')">${on?"✓":""}</div>` : ""}
      <div class="who">
        <div class="name">${esc(r.customer||"بدون اسم")}</div>
        <div class="addr">${esc(r.address||"—")}</div>
      </div>
      <div class="cod">${money(r.cod)}<small>${esc(r.money_label||"")}</small></div>
    </div>
    <div class="meta">
      <span class="chip st${stage}">${esc(r.status_label||"")}</span>
      <span class="chip ${late?"late":""}">${d===0?"النهارده":`من ${num(d)} يوم`}</span>
      ${r.courier?`<span class="chip">${esc(r.courier)}</span>`:""}
      ${r.sale_code?`<span>${esc(r.sale_code)}</span>`:""}
    </div>
    <div class="acts">
      ${main}
      ${r.phone?`<a class="alt" style="text-decoration:none;text-align:center"
          href="tel:${esc(r.phone)}">اتصل</a>`:""}
      <button class="alt" onclick="more('${r.id}')">…</button>
    </div>
  </div>`;
}

function renderBulk(){
  const n = S.sel.length;
  if(!n){ $("#bulk").innerHTML=""; return; }
  const sel = S.rows.filter(r=>S.sel.includes(r.id));
  const allPrep = sel.every(r=>r.status==="preparing");
  const allOut  = sel.every(r=>r.status==="with_courier"||r.status==="out_for_delivery");
  const allPaid = sel.every(r=>r.status==="delivered" && r.money==="waiting");
  const total = sel.reduce((s,r)=>s+(Number(r.cod)||0),0);

  let act = "";
  if(allPrep) act = `<button onclick="bulkAdvance('with_courier')">كلهم طلعوا مع المندوب</button>`;
  else if(allOut) act = `<button onclick="bulkAdvance('delivered')">كلهم وصلوا</button>`;
  else if(allPaid) act = `<button onclick="askMoney(null)">حصّلت ${money(total)}</button>`;
  else act = `<button disabled>اختار شحنات في نفس المرحلة</button>`;

  $("#bulk").innerHTML = `<div class="bulkbar">
    <span class="cnt">${num(n)} مختارة</span>
    ${act}
    <button class="ghost" onclick="S.sel=[];render()">إلغاء</button>
  </div>`;
}

/* ── الأفعال ────────────────────────────────────────────────────── */
function go(t){ S.tab=t; S.sel=[]; render(); window.scrollTo({top:0}); }
function pick(id){
  const i=S.sel.indexOf(id);
  i>=0 ? S.sel.splice(i,1) : S.sel.push(id);
  render();
}

async function guard(fn){
  if(S.busy) return;
  S.busy=true;
  try{ await fn(); await load(); }
  catch(e){ toast(e.message||"حصلت مشكلة", true); }
  finally{ S.busy=false; }
}

async function advance(id, status){
  await guard(async ()=>{
    const r = await rpc("pos_fn_update_shipment",{p_shipment:id, p_status:status});
    if(!r || r.ok===false) throw new Error(errText(r));
    toast("اتسجّل ✓");
  });
}

async function bulkAdvance(status){
  const ids=[...S.sel];
  await guard(async ()=>{
    const r = await rpc("pos_fn_bulk_ship_update",{p_ids:ids, p_status:status});
    if(!r || r.ok===false) throw new Error(errText(r));
    S.sel=[];
    toast(`اتسجّلت ${num(r.updated)} شحنة ✓`);
  });
}

function errText(r){
  const e = r && r.error;
  return ({ unauthorized:"مش مسجّل دخول", not_found:"الشحنة مش موجودة",
    bad_status:"حالة غير مقبولة", not_settleable:"في شحنات لسه ما وصلتش",
    bad_amount:"المبلغ غلط", empty:"مفيش شحنات مختارة",
    too_many:"عدد كبير مرة واحدة" }[e]) || e || "حصلت مشكلة";
}

/* ── تحصيل الفلوس ───────────────────────────────────────────────── */
function askMoney(id){
  const ids = id ? [id] : [...S.sel];
  const sel = S.rows.filter(r=>ids.includes(r.id));
  const expected = sel.reduce((s,r)=>s+(Number(r.cod)||0),0);
  S.sheet = { kind:"money", ids, expected, value:String(Math.round(expected)) };
  renderSheet();
}

async function confirmMoney(){
  const sh = S.sheet; if(!sh) return;
  const got = Number(sh.value);
  if(!Number.isFinite(got) || got < 0) return toast("اكتب المبلغ", true);
  const ids=[...sh.ids];
  S.sheet=null; renderSheet();
  await guard(async ()=>{
    const r = await rpc("pos_fn_settle_money",{p_ids:ids, p_received:got});
    if(!r || r.ok===false) throw new Error(errText(r));
    S.sel=[];
    const diff = Number(r.diff||0);
    toast(diff===0 ? `اتحصّل ${money(got)} ✓`
                   : `اتسجّل ${money(got)} — فرق ${money(Math.abs(diff))} ${diff<0?"ناقص":"زيادة"}`);
  });
}

/* ── لوحة «…» للحالات النادرة ───────────────────────────────────── */
function more(id){ S.sheet={ kind:"more", id }; renderSheet(); }

function renderSheet(){
  const sh = S.sheet;
  if(!sh){ $("#sheet").innerHTML=""; return; }

  if(sh.kind==="money"){
    $("#sheet").innerHTML = `<div class="sheet" onclick="closeSheet(event)">
      <div class="sheet-box" onclick="event.stopPropagation()">
        <h3>تحصيل فلوس ${num(sh.ids.length)} شحنة</h3>
        <p class="sub">المفروض ${money(sh.expected)} — لو استلمت مبلغ مختلف اكتبه زي ما هو.</p>
        <label class="lbl">المبلغ اللي استلمته</label>
        <input type="number" inputmode="numeric" value="${esc(sh.value)}"
               oninput="S.sheet.value=this.value">
        <button class="opt" style="background:var(--money);color:#fff;border:0;text-align:center"
                onclick="confirmMoney()">تأكيد التحصيل</button>
        <button class="opt" onclick="closeSheet()">إلغاء</button>
      </div></div>`;
    return;
  }

  const r = S.rows.find(x=>x.id===sh.id) || {};
  const back = FLOW[FLOW.indexOf(r.status)-1];
  $("#sheet").innerHTML = `<div class="sheet" onclick="closeSheet(event)">
    <div class="sheet-box" onclick="event.stopPropagation()">
      <h3>${esc(r.customer||"الشحنة")}</h3>
      <p class="sub">${esc(r.status_label||"")}${r.sale_code?` · ${esc(r.sale_code)}`:""}</p>
      ${r.phone?`<a class="opt" style="text-decoration:none;color:inherit" href="https://wa.me/2${esc(r.phone)}"
          target="_blank" rel="noopener">واتساب العميلة<small>${esc(r.phone)}</small></a>`:""}
      ${back?`<button class="opt" onclick="advance('${r.id}','${back}');closeSheet()">
          رجّع خطوة لورا<small>لو سجّلت الحالة بالغلط</small></button>`:""}
      <button class="opt danger" onclick="confirmReturn('${r.id}')">
        رجعت — العميلة رفضت<small>البضاعة هترجع للمخزون تلقائيًا</small></button>
      <button class="opt danger" onclick="advance('${r.id}','lost');closeSheet()">
        ضاعت<small>مش هترجع للمخزون</small></button>
      <button class="opt" onclick="closeSheet()">إغلاق</button>
    </div></div>`;
}
function closeSheet(e){ if(e && e.target !== e.currentTarget) return; S.sheet=null; renderSheet(); }
function confirmReturn(id){
  if(!confirm("ترجّع الشحنة دي؟ البضاعة هترجع للمخزون.")) return;
  closeSheet(); advance(id,"returned");
}

/* تحديث لما يرجع للصفحة — بيبقى فاتحها طول اليوم */
document.addEventListener("visibilitychange", ()=>{
  if(document.visibilityState==="visible" && S.loaded && !S.busy) load();
});

load();
