/* ============================================================
   Omraa Plus — طبقة تحسينات نضيفة (Source-of-truth للميزات الجديدة)
   ------------------------------------------------------------
   • تُحقن كـ <script type="module"> في صفحات النظام.
   • بتشتغل بنفس جلسة دخول المستخدم تلقائيًا (نفس storageKey الافتراضي).
   • إضافية 100%: بتتركب في حاوية خارج جذر React، فمابتصطدمش بالتطبيق المتبني.
   • الرجوع بالكامل: احذف الملف ده + سطر <script> المحقون في الصفحات.
   • لإضافة ميزة لصفحة تانية: سطر واحد في ROUTES + دالة render.
   ============================================================ */
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL  = "https://mjetglnmivwphxyzflsz.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qZXRnbG5taXZ3cGh4eXpmbHN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NTcwODgsImV4cCI6MjA5NjQzMzA4OH0.X6Rvxo4owPcBwE4HqXLm5fuPDSdEo8PV9oBV-bHsGrg";
// إعداد افتراضي => بيقرا نفس جلسة الدخول المخزّنة للتطبيق:
const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

/* ---------- أدوات مساعدة ---------- */
const mk  = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
const esc = s => String(s ?? "").replace(/[&<>"]/g, m => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[m]));
const norm = s => String(s ?? "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").trim();

/* ---------- ستايل (كله مسبوق بـ op- عشان مايأثرش على الموقع) ---------- */
const CSS = `
#op-fab{position:fixed;left:16px;bottom:16px;z-index:2147483000;font-family:Tajawal,system-ui,sans-serif}
#op-fab button{background:#4f46e5;color:#fff;border:0;border-radius:9999px;padding:11px 16px;font-weight:800;font-size:14px;
  box-shadow:0 10px 26px rgba(79,70,229,.4);cursor:pointer;display:flex;gap:8px;align-items:center}
#op-fab .op-badge{background:#ef4444;color:#fff;border-radius:9999px;padding:1px 8px;font-size:12px;min-width:20px;text-align:center}
#op-panel{position:fixed;left:16px;bottom:72px;z-index:2147483000;width:min(380px,92vw);max-height:76vh;overflow:auto;
  background:#fff;color:#0f172a;border:1px solid #e2e8f0;border-radius:16px;box-shadow:0 24px 60px rgba(2,6,23,.28);
  font-family:Tajawal,system-ui,sans-serif;display:none;direction:rtl}
#op-panel.op-open{display:block}
#op-panel .op-hd{position:sticky;top:0;background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:12px 14px;font-weight:800;
  display:flex;justify-content:space-between;align-items:center}
#op-panel .op-hd button{border:0;background:transparent;font-size:18px;cursor:pointer;color:#64748b;padding:0 4px}
#op-panel .op-sec{padding:12px 14px;border-bottom:1px solid #f1f5f9}
#op-panel .op-sec h4{margin:0 0 8px;font-size:13px;color:#475569}
#op-panel .op-inp{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:10px;padding:9px 11px;font:inherit}
#op-panel .op-row{display:flex;justify-content:space-between;gap:8px;padding:7px 2px;border-bottom:1px dashed #eef2f7;font-size:13.5px}
#op-panel .op-row:last-child{border-bottom:0}
#op-panel .op-name{font-weight:600}
#op-panel .op-pill{border-radius:9999px;padding:1px 9px;font-size:12px;font-weight:700;white-space:nowrap}
#op-panel .op-low{background:#fef2f2;color:#dc2626}
#op-panel .op-muted{color:#94a3b8;font-size:12.5px;text-align:center;padding:14px}
#op-panel .op-spin{width:15px;height:15px;border:2px solid #e2e8f0;border-top-color:#4f46e5;border-radius:50%;
  display:inline-block;animation:opsp .7s linear infinite;vertical-align:middle;margin:8px auto;display:block}
@keyframes opsp{to{transform:rotate(360deg)}}
`;

/* ---------- الحاوية (مرة واحدة، خارج جذر React) ---------- */
let host, panel, bodyEl, built = false;
function ensureHost() {
  if (built) return;
  built = true;
  const st = mk("style"); st.id = "op-css"; st.textContent = CSS; document.head.appendChild(st);
  host = mk("div"); host.id = "op-fab";
  host.innerHTML = `<button type="button">🛠️ أدوات <span class="op-badge" id="op-badge">·</span></button>`;
  panel = mk("div"); panel.id = "op-panel";
  panel.innerHTML = `<div class="op-hd"><span id="op-title">أدوات</span><button type="button" title="إغلاق">✕</button></div><div id="op-body"></div>`;
  document.body.appendChild(host);
  document.body.appendChild(panel);
  bodyEl = panel.querySelector("#op-body");
  host.querySelector("button").onclick = () => panel.classList.toggle("op-open");
  panel.querySelector(".op-hd button").onclick = () => panel.classList.remove("op-open");
}
const setTitle = t => panel.querySelector("#op-title").textContent = t;
const setBadge = n => { const b = document.getElementById("op-badge"); if (b) b.textContent = n > 0 ? n : "·"; };

/* ---------- ميزة: صفحة المنتجات ---------- */
async function renderProducts() {
  setTitle("أدوات المنتجات");
  bodyEl.innerHTML = `
    <div class="op-sec">
      <h4>🔍 بحث سريع في المنتجات</h4>
      <input class="op-inp" id="op-q" placeholder="اكتب اسم المنتج..." autocomplete="off">
      <div id="op-qres"></div>
    </div>
    <div class="op-sec">
      <h4>⚠️ قرب يخلّص / محتاج إعادة طلب</h4>
      <div id="op-low"><span class="op-spin"></span></div>
    </div>`;

  // نواقص المخزون (من الباك مباشرة)
  (async () => {
    const low = document.getElementById("op-low");
    try {
      const { data, error } = await sb.rpc("pos_fn_reorder_report");
      if (error) throw error;
      const rows = Array.isArray(data) ? data : (data ? [data] : []);
      if (!rows.length) { low.innerHTML = `<div class="op-muted">مافيش نواقص حاليًا 👌</div>`; setBadge(0); return; }
      low.innerHTML = rows.slice(0, 60).map(r => {
        const name = r.name ?? r.product_name ?? r.product ?? "—";
        const q = r.in_stock ?? r.stock ?? r.qty ?? r.quantity ?? r.remaining ?? "";
        return `<div class="op-row"><span class="op-name">${esc(name)}</span><span class="op-pill op-low">${esc(q)} متبقّي</span></div>`;
      }).join("");
      setBadge(rows.length);
    } catch (e) {
      low.innerHTML = `<div class="op-muted">تعذّر التحميل: ${esc(e.message || e.hint || "")}</div>`;
    }
  })();

  // بحث سريع (تحميل مرة، فلترة لحظية بتطبيع عربي)
  let prods = [];
  try { const { data } = await sb.from("pos_products").select("*").limit(3000); prods = data || []; } catch {}
  const nameKey = prods[0] ? (["name", "product_name", "title"].find(k => k in prods[0]) || "name") : "name";
  const q = document.getElementById("op-q"), res = document.getElementById("op-qres");
  if (q) q.oninput = () => {
    const t = norm(q.value);
    if (!t) { res.innerHTML = ""; return; }
    const hits = prods.filter(p => norm(p[nameKey]).includes(t)).slice(0, 25);
    res.innerHTML = hits.length
      ? hits.map(p => `<div class="op-row"><span class="op-name">${esc(p[nameKey])}</span><span class="op-muted">${esc(p.category ?? p.brand ?? "")}</span></div>`).join("")
      : `<div class="op-muted">مافيش نتيجة</div>`;
  };
}

/* ---------- سجل الميزات (أضف صفحة جديدة بسطر واحد) ---------- */
const ROUTES = [
  { match: /\/products(\/|\.html|$)/, render: renderProducts },
  // مثال لاحق: { match: /\/pos(\/|\.html|$)/, render: renderPos },
];

let mountedFor = null;
async function route() {
  const r = ROUTES.find(x => x.match.test(location.pathname));
  if (!r) { if (host) { host.style.display = "none"; panel.style.display = ""; panel.classList.remove("op-open"); } mountedFor = null; return; }
  ensureHost();
  host.style.display = "";
  if (mountedFor === location.pathname) return;
  mountedFor = location.pathname;
  try { await r.render(); } catch (e) { bodyEl.innerHTML = `<div class="op-muted">خطأ: ${esc(e.message || "")}</div>`; }
}

/* ---------- إقلاع + متابعة تنقّل Next (History API) ---------- */
function boot() {
  route();
  const fire = () => setTimeout(route, 80);
  for (const m of ["pushState", "replaceState"]) {
    const orig = history[m];
    history[m] = function () { const out = orig.apply(this, arguments); fire(); return out; };
  }
  window.addEventListener("popstate", fire);
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
