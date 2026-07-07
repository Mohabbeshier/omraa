/* ============================================================
   Omraa Plus v2 — تحسينات داخل صفحات النظام (سورس نضيف)
   ------------------------------------------------------------
   • بيقرا جلسة الدخول من كوكيز التطبيق نفسها (@supabase/ssr) → نفس تسجيل دخولك.
   • بيتركّب جوّه الصفحة بنفس ستايل الموقع (slate/indigo/Tajawal) — مش عنصر منفصل.
   • v2: صفحة البيع — «بيع بالاسم بدون باركود».
   • الرجوع: احذف الملف + سطر <script> من الصفحات.
   ============================================================ */
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const URL0 = "https://mjetglnmivwphxyzflsz.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qZXRnbG5taXZ3cGh4eXpmbHN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NTcwODgsImV4cCI6MjA5NjQzMzA4OH0.X6Rvxo4owPcBwE4HqXLm5fuPDSdEo8PV9oBV-bHsGrg";
console.log("[omraa-plus] v2 loaded");

/* ---- قراءة توكن الجلسة من كوكيز التطبيق (يدعم base64- والتقسيم .0/.1) ---- */
function readAccessToken() {
  try {
    const parts = document.cookie.split(/;\s*/).map(c => {
      const i = c.indexOf("="); return [c.slice(0, i), c.slice(i + 1)];
    });
    const chunks = parts
      .filter(([k]) => /^sb-mjetglnmivwphxyzflsz-auth-token(\.\d+)?$/.test(k))
      .sort((a, b) => (a[0].split(".")[1] | 0) - (b[0].split(".")[1] | 0))
      .map(([, v]) => v).join("");
    if (!chunks) return null;
    let raw = decodeURIComponent(chunks);
    if (raw.startsWith("base64-")) {
      const b = raw.slice(7).replace(/-/g, "+").replace(/_/g, "/");
      raw = atob(b + "=".repeat((4 - b.length % 4) % 4));
    }
    const j = JSON.parse(raw);
    return (Array.isArray(j) ? j[0] : j.access_token) || null;
  } catch { return null; }
}
const sb = createClient(URL0, ANON, { accessToken: async () => readAccessToken() });

/* ---- أدوات ---- */
const esc = s => String(s ?? "").replace(/[&<>"]/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
const norm = s => String(s ?? "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).toLowerCase().trim();
function setReactInput(el, val) {
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  set.call(el, val);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/* ---- ستايل مطابق للموقع (slate-50/white/indigo-600) ---- */
const CSS = `
.opx-card{background:#fff;border:1px solid #f1f5f9;border-radius:16px;box-shadow:0 1px 2px rgba(2,6,23,.05);margin-top:12px;overflow:hidden;font-family:inherit}
.opx-toggle{width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;background:#fff;border:0;padding:14px 16px;cursor:pointer;font:inherit;font-weight:700;color:#0f172a;font-size:15px}
.opx-toggle .opx-sub{color:#64748b;font-weight:500;font-size:12.5px}
.opx-body{display:none;padding:0 16px 14px}
.opx-open .opx-body{display:block}
.opx-inp{width:100%;box-sizing:border-box;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;font:inherit;font-size:15px;background:#fff;color:#0f172a}
.opx-inp:focus{outline:none;border-color:#4f46e5;box-shadow:0 0 0 3px rgba(79,70,229,.12)}
.opx-prod{padding:12px 2px 4px;border-bottom:1px solid #f1f5f9}
.opx-prod:last-child{border-bottom:0}
.opx-pname{font-weight:700;color:#0f172a;font-size:14.5px;margin-bottom:8px}
.opx-pname .opx-price{color:#4f46e5;font-weight:800;margin-inline-start:8px;font-size:13.5px}
.opx-chips{display:flex;flex-wrap:wrap;gap:8px;padding-bottom:8px}
.opx-chip{border:1px solid #e2e8f0;background:#f8fafc;border-radius:9999px;padding:7px 13px;font:inherit;font-size:13px;font-weight:700;color:#334155;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.opx-chip:active{transform:scale(.97)}
.opx-chip .opx-q{background:#eef2ff;color:#4f46e5;border-radius:9999px;padding:0 8px;font-size:12px}
.opx-chip.opx-lo .opx-q{background:#fffbeb;color:#d97706}
.opx-muted{color:#94a3b8;font-size:13px;text-align:center;padding:14px 0}
.opx-ok{background:#ecfdf5;color:#059669;border-radius:12px;padding:10px 12px;font-size:13.5px;font-weight:700;margin-top:8px;display:none}
.opx-spin{width:16px;height:16px;border:2px solid #e2e8f0;border-top-color:#4f46e5;border-radius:50%;display:block;margin:12px auto;animation:opxs .7s linear infinite}
@keyframes opxs{to{transform:rotate(360deg)}}
`;

/* ============ ميزة البيع بالاسم (صفحة نقطة البيع) ============ */
let mounted = null, cache = null, cacheAt = 0;

function findScanInput() {
  return [...document.querySelectorAll("input")].find(i => (i.placeholder || "").includes("امسح"));
}
function findAddButton(near) {
  const btns = [...document.querySelectorAll("button")].filter(b => b.textContent.trim() === "إضافة");
  if (!btns.length) return null;
  if (!near) return btns[0];
  const r = near.getBoundingClientRect();
  return btns.sort((a, b) => {
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    return Math.abs(ra.top - r.top) - Math.abs(rb.top - r.top);
  })[0];
}

async function loadStock(force) {
  if (!force && cache && Date.now() - cacheAt < 60000) return cache;
  const { data, error } = await sb.from("pos_items_scan")
    .select("product_id,product_name,size,color,barcode,sell_price,status")
    .eq("status", "in_stock").limit(5000);
  if (error) throw error;
  const map = new Map();
  for (const it of data || []) {
    let p = map.get(it.product_id);
    if (!p) { p = { name: it.product_name, price: it.sell_price, n: norm(it.product_name), vars: new Map() }; map.set(it.product_id, p); }
    const k = it.size + "|" + it.color;
    let v = p.vars.get(k);
    if (!v) { v = { size: it.size, color: it.color, barcodes: [] }; p.vars.set(k, v); }
    v.barcodes.push(it.barcode);
  }
  cache = [...map.values()]; cacheAt = Date.now();
  return cache;
}

function buildCard(scanInput) {
  const card = document.createElement("div");
  card.className = "opx-card"; card.id = "opx-namesell"; card.setAttribute("dir", "rtl");
  card.innerHTML = `
    <button type="button" class="opx-toggle">
      <span>🔍 بيع بالاسم <span class="opx-sub">— من غير باركود</span></span><span class="opx-sub">▾</span>
    </button>
    <div class="opx-body">
      <input class="opx-inp" placeholder="اكتب اسم المنتج..." autocomplete="off" inputmode="search">
      <div class="opx-res"><div class="opx-muted">اكتب حرفين على الأقل</div></div>
      <div class="opx-ok"></div>
    </div>`;
  const body = card.querySelector(".opx-body"), inp = card.querySelector(".opx-inp"),
        res = card.querySelector(".opx-res"), ok = card.querySelector(".opx-ok");

  card.querySelector(".opx-toggle").onclick = async () => {
    card.classList.toggle("opx-open");
    if (card.classList.contains("opx-open")) {
      inp.focus();
      try { res.innerHTML = '<div class="opx-spin"></div>'; await loadStock(); res.innerHTML = '<div class="opx-muted">اكتب حرفين على الأقل</div>'; }
      catch (e) { res.innerHTML = `<div class="opx-muted">تعذّر التحميل — اتأكد إنك مسجّل دخول (${esc(e.message || "")})</div>`; }
    }
  };

  inp.oninput = () => {
    const t = norm(inp.value);
    if (t.length < 2) { res.innerHTML = '<div class="opx-muted">اكتب حرفين على الأقل</div>'; return; }
    const hits = (cache || []).filter(p => p.n.includes(t)).slice(0, 8);
    if (!hits.length) { res.innerHTML = '<div class="opx-muted">مافيش منتج بالاسم ده متاح في المخزون</div>'; return; }
    res.innerHTML = hits.map((p, pi) => `
      <div class="opx-prod">
        <div class="opx-pname">${esc(p.name)}<span class="opx-price">${(+p.price || 0).toLocaleString("en-US")} ج.م</span></div>
        <div class="opx-chips">${[...p.vars.values()].map((v, vi) =>
          `<button type="button" class="opx-chip ${v.barcodes.length <= 1 ? "opx-lo" : ""}" data-p="${pi}" data-v="${vi}">
             ${esc(v.size)} · ${esc(v.color)} <span class="opx-q">${v.barcodes.length}</span></button>`).join("")}
        </div>
      </div>`).join("");
    const shown = hits;
    res.querySelectorAll(".opx-chip").forEach(ch => ch.onclick = () => {
      const p = shown[+ch.dataset.p], v = [...p.vars.values()][+ch.dataset.v];
      const bc = v.barcodes.shift();          // استهلاك محلي لتفادي تكرار نفس القطعة
      ch.querySelector(".opx-q").textContent = v.barcodes.length;
      if (!v.barcodes.length) ch.disabled = true, ch.style.opacity = .45;
      const scan = findScanInput(); if (!scan) return;
      setReactInput(scan, bc);
      const add = findAddButton(scan);
      if (add) add.click();
      else scan.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      ok.style.display = "block";
      ok.textContent = `✓ اتضافت للفاتورة: ${p.name} — ${v.size} ${v.color}`;
      setTimeout(() => ok.style.display = "none", 2500);
    });
  };
  return card;
}

function mountPos() {
  if (!/\/pos(\/|\.html)?$/.test(location.pathname)) { mounted = null; return; }
  if (mounted && document.contains(mounted)) return;
  const scan = findScanInput(); if (!scan) return;           // الصفحة لسه بتحمّل
  // نركّب بعد كارت المسح: نطلع لأقرب حاوية فيها زرار "إضافة"
  let host = scan.parentElement, hops = 0;
  while (host && hops < 6 && !host.querySelector("button")) { host = host.parentElement; hops++; }
  const anchor = host || scan.parentElement;
  mounted = buildCard(scan);
  anchor.insertAdjacentElement("afterend", mounted);
}

/* ---- إقلاع + صمود ضد إعادة رسم React + تنقّل Next ---- */
(function boot() {
  const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
  let t; const kick = () => { clearTimeout(t); t = setTimeout(mountPos, 250); };
  new MutationObserver(kick).observe(document.documentElement, { childList: true, subtree: true });
  for (const m of ["pushState", "replaceState"]) {
    const o = history[m]; history[m] = function () { const r = o.apply(this, arguments); kick(); return r; };
  }
  addEventListener("popstate", kick);
  kick();
})();
