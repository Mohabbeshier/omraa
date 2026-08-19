/* ══════════════════════════════════════════════════════════════════
   يفتح كل صفحة مستقلة بجلسة حقيقية الشكل، وبيضغط على **كل** زرار
   وعنصر تحكّم فيها، وبيمسك أي استثناء أو وعد مرفوض.

   ده اللي كان هيمسك مشكلة الجلسة قبل ما توصله: مفيش تحليل ساكن
   بيكشف إن الداتا اتقريت من المكان الغلط.
   ══════════════════════════════════════════════════════════════════ */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("/tmp/node_modules/jsdom");
const babel = require("/tmp/node_modules/@babel/core");

const ROOT = "/home/claude/pos";
const REF = "mjetglnmivwphxyzflsz";
const b64url = (t) => Buffer.from(t, "utf8").toString("base64")
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const SESSION = { access_token: "TOK", refresh_token: "r",
                  expires_at: Math.floor(Date.now() / 1000) + 3600 };
const COOKIE = `sb-${REF}-auth-token=base64-${b64url(JSON.stringify(SESSION))}`;

/* ردود واقعية الشكل لكل دالة تنادى من الصفحات دي */
const PID = "11111111-1111-1111-1111-111111111111";
const IMG = { id: "i1", url: "https://x/i1.jpg", color: "أسود", sort: 0,
              sizes: { "400": "https://x/i1_400.jpg" }, thumb: "https://x/i1_400.jpg", is_cover: true };
const RPC = {
  shop_fn_admin_site: () => ({
    settings: { id: 1, announce: { active: true, items: [{ ar: "ر", en: "m" }] },
      hero: { slides: [{ id: "a", tone: "rose", title_ar: "ع", sub_ar: "س", cta_ar: "ز", href: "/shop" }] },
      contact: { whatsapp: "201", phone: "01" }, flags: {}, seo: {}, hero_content: {},
      default_lead_min: 3, default_lead_max: 5, extended_lead_days: 7,
      hold_duration_minutes: 60, max_web_holds: 40, dispatch_cutoff_hour: 18, courier_rest_dow: 5 },
    shipping: [{ governorate: "القاهرة", price: 60, active: true, eta_min_days: 2, eta_max_days: 3 }],
    products: [{ id: PID, name: "صندل", category: "كلاسيك", sell_price: 900, is_published: true,
      description: null, has_description: false, image_count: 1, stock: 3, live_pct: 5, price: 855 }],
    collections: [{ id: "c1", slug: "s", title_ar: "ت", title_en: "t", kind: "manual", sort: 0,
      active: true, max_items: 8, product_ids: [PID] }],
    bundles: [{ id: "b1", title_ar: "ب", title_en: "b", bundle_price: 1000, active: true, sort: 0,
      items: [{ product_id: PID, qty: 2 }] }],
    reviews_pending: [{ id: "r1", product_id: PID, product_name: "صندل", rating: 5,
      body: "حلو", author_name: "م", size_bought: "42", fit_feedback: "مظبوط", created_at: new Date().toISOString() }],
    categories: ["كلاسيك"],
    health: { published: 1, unpublished: 0, no_image: 0, no_desc: 1, no_stock: 0, on_discount: 1,
      reviews_pending: 1, shipping_off: 0, orders_7d: 0, orders_total: 0, visits_7d: 0 },
  }),
  pos_fn_backup_health: () => ({ last_snapshot: new Date().toISOString(), snapshot_tables: 35,
    expected_tables: 35, coverage_ok: true, snapshot_count: 23, total_rows: 13529,
    oldest_snapshot: "2026-06-25T00:00:00Z", depth_days: 55, rpo_hours: 6, cdc_since: "2026-06-25T00:00:00Z",
    last_offsite: new Date().toISOString(), offsite_days: 0.2, offsite_level: "ok",
    verify: { ok: true, tables: 35, rows: 13529, bad: [] }, photos: 1, photos_mapped: 1, issues: [] }),
  pos_fn_export_all: () => ({ total_rows: 13529, tables: {} }),
  shop_fn_admin_photo_queue: () => ([{ id: PID, name: "صندل", category: "ك", is_published: true,
    cover: IMG.url, cover_thumb: IMG.thumb, photo_count: 1, colors: ["أسود", "بيج"], by_color: { "أسود": 1 } },
    { id: "22222222-2222-2222-2222-222222222222", name: "بوت", category: null, is_published: false,
      cover: null, cover_thumb: null, photo_count: 0, colors: ["بني"], by_color: {} }]),
  shop_fn_admin_product_images: () => ([IMG]),
  shop_fn_attach_product_image: () => ({ ok: true, id: "i9", url: "https://x/i9.jpg" }),
  shop_fn_remove_product_image: () => ({ ok: true }),
  shop_fn_update_product_image: () => ({ ok: true }),
  shop_fn_save_site_config: () => ({ ok: true, settings: {} }),
  shop_fn_save_shipping_rates: () => ({ ok: true, updated: 1 }),
  shop_fn_set_global_discount: () => ({ ok: true, updated: 1 }),
  shop_fn_set_discount: () => ({ ok: true, updated: 1 }),
  shop_fn_set_published: () => ({ ok: true, updated: 1 }),
  shop_fn_save_product_web: () => ({ ok: true }),
  shop_fn_save_collection: () => ({ ok: true }),
  shop_fn_delete_collection: () => ({ ok: true }),
  shop_fn_save_bundle: () => ({ ok: true }),
  shop_fn_delete_bundle: () => ({ ok: true }),
  shop_fn_moderate_review: () => ({ ok: true }),
  shop_fn_admin_merch: () => ({ products: [{ id: PID, name: "صندل", category: "كلاسيك",
      sell_price: 900, discount_percent: null, live_pct: 0, price: 900, is_published: true }],
    collections: [], bundles: [], categories: ["كلاسيك"] }),
};

function bootPage(file) {
  const full = path.join(ROOT, file);
  let html = fs.readFileSync(full, "utf8");
  const errors = [];

  // babel-standalone مش هيشتغل هنا، فبنترجم الـJSX بنفسنا ونحقنه
  const babelScripts = [...html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)];
  const plainScripts = [...html.matchAll(/<script(?![^>]*type="text\/babel")(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
  const externals = [...html.matchAll(/<script[^>]*\bsrc="([^"]+)"[^>]*>/g)].map((m) => m[1]);
  html = html.replace(/<script[\s\S]*?<\/script>/g, "");

  const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true,
    url: `https://mohabbeshier.github.io/omraa/${file}` });
  const w = dom.window;
  Object.defineProperty(w.document, "cookie", { get: () => COOKIE, set: () => {}, configurable: true });
  w.onerror = (m) => errors.push("onerror: " + m);
  w.addEventListener("unhandledrejection", (e) => errors.push("rejection: " + (e.reason && e.reason.message)));
  w.confirm = () => true;
  w.scrollTo = () => {};
  w.URL.createObjectURL = () => "blob:x";
  w.URL.revokeObjectURL = () => {};
  w.crypto = w.crypto || {}; w.crypto.randomUUID = () => "u" + Math.random().toString(16).slice(2, 12);

  const calls = [];
  w.fetch = async (url, opts) => {
    const u = String(url);
    if (u.includes("/rpc/")) {
      const fn = u.split("/rpc/")[1];
      const auth = (opts.headers.Authorization || "").replace("Bearer ", "");
      calls.push({ fn, auth });
      if (!RPC[fn]) { errors.push("رد ناقص في الهارنس: " + fn); return { ok: true, text: async () => "null" }; }
      return { ok: true, status: 200, text: async () => JSON.stringify(RPC[fn](JSON.parse(opts.body || "{}"))) };
    }
    return { ok: true, status: 200, text: async () => "{}" };
  };

  // React + ReactDOM للصفحات اللي بتستخدمهم
  for (const src of externals) {
    const put = (code) => { const el = w.document.createElement("script"); el.textContent = code; w.document.body.appendChild(el); };
    if (/react-dom/.test(src)) put(fs.readFileSync("/tmp/node_modules/react-dom/umd/react-dom.development.js", "utf8"));
    else if (/react/.test(src)) put(fs.readFileSync("/tmp/node_modules/react/umd/react.development.js", "utf8"));
    else if (/babel/.test(src)) { /* بنترجم بنفسنا */ }
    else if (!/^https?:/.test(src)) {
      try { put(fs.readFileSync(path.join(ROOT, src), "utf8")); } catch (e) { errors.push("سكربت خارجي: " + e.message); }
    }
  }
  /* لازم تتحقن كـ<script> حقيقي مش w.eval: تصريحات let/const جوّه eval
     بتتعمل في نطاق منفصل، فالـinline handlers مش بتشوفها — وده بيولّد
     "S is not defined" وهمي مش موجود في المتصفح أصلًا. */
  const inject = (code, tag) => {
    try {
      const el = w.document.createElement("script");
      el.textContent = code;
      w.document.body.appendChild(el);
    } catch (e) { errors.push(tag + ": " + e.message); }
  };
  for (const [, code] of plainScripts) inject(code, "script");
  for (const [, code] of babelScripts) {
    const out = babel.transformSync(code, {
      presets: [["/tmp/node_modules/@babel/preset-react", { runtime: "classic" }]], filename: file });
    inject(out.code, "babel script");
  }
  return { dom, w, errors, calls };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function clickEverything(w, errors, label) {
  const d = w.document;
  const seen = new Set();
  let clicked = 0, changed = 0;
  for (let round = 0; round < 3; round++) {
    const controls = [...d.querySelectorAll("button, [onclick], .crow, .pcard, .fchip, .tab, .shot, .pick-row, .list-item button")];
    for (const el of controls) {
      const key = (el.tagName || "") + "|" + (el.className || "") + "|" + (el.textContent || "").slice(0, 30);
      if (seen.has(key)) continue;
      seen.add(key);
      if (el.disabled) continue;
      try {
        el.dispatchEvent(new w.MouseEvent("click", { bubbles: true, cancelable: true }));
        clicked++;
        await sleep(12);
      } catch (e) { errors.push(`${label} · ضغط «${(el.textContent || "").slice(0, 25)}»: ${e.message}`); }
    }
    for (const el of [...d.querySelectorAll("input, select, textarea")]) {
      const key = "F|" + (el.name || el.id || el.className) + "|" + el.type;
      if (seen.has(key)) continue;
      seen.add(key);
      try {
        if (el.type === "checkbox") el.checked = !el.checked;
        else if (el.tagName === "SELECT" && el.options.length) el.selectedIndex = el.options.length - 1;
        else if (el.type === "number") el.value = "5";
        else if (el.type === "date") el.value = "2026-12-31";
        else el.value = "اختبار";
        el.dispatchEvent(new w.Event("input", { bubbles: true }));
        el.dispatchEvent(new w.Event("change", { bubbles: true }));
        changed++;
        await sleep(8);
      } catch (e) { errors.push(`${label} · حقل ${el.type}: ${e.message}`); }
    }
    await sleep(40);
  }
  return { clicked, changed };
}

(async () => {
  let fail = 0;
  for (const file of ["website.html", "photos.html", "merchandising.html"]) {
    console.log(`\n━━ ${file} ━━`);
    const { w, errors, calls } = bootPage(file);
    await sleep(300);

    /* نص الصفحة المرئي فقط: حقن السكربتات كعناصر <script> بيخلّي
       textContent يشمل كود المصدر، فكان بيتلغبط مع نص الشاشة. */
    const txt = () => {
      const c = w.document.body.cloneNode(true);
      c.querySelectorAll("script,style").forEach((n) => n.remove());
      return c.textContent.replace(/\s+/g, " ");
    };
    if (/مش قادر أفتح|permission denied|unauthorised/.test(txt())) {
      console.log("  ✗ الصفحة رفضت الجلسة:", txt().slice(0, 140)); fail++; continue;
    }
    const anonCalls = calls.filter((c) => c.auth !== "TOK");
    if (anonCalls.length) { console.log("  ✗ نداءات راحت بمفتاح الزائر:", anonCalls.map((c) => c.fn)); fail++; }
    else console.log(`  ✓ كل النداءات (${calls.length}) اتبعتت بجلسة المالك`);

    // زيارة كل تاب صراحةً — الضغط العشوائي مش بيوصل لكل الشاشات
    let clicked = 0, changed = 0;
    const tabs = file === "website.html"
      ? ["home","content","products","offers","shipping","settings","reviews"]
      : file === "merchandising.html" ? ["collections","discounts","bundles"] : [null];
    for (const t of tabs) {
      if (t) { try { w.eval(`typeof go==='function' && go(${JSON.stringify(t)})`); } catch (e) {} await sleep(40); }
      const r = await clickEverything(w, errors, `${file}#${t || "-"}`);
      clicked += r.clicked; changed += r.changed;
    }
    await sleep(200);
    console.log(`  ✓ اتضغط ${clicked} زرار · اتغيّر ${changed} حقل`);

    const real = errors.filter((e) => !/رد ناقص في الهارنس/.test(e));
    if (real.length) { console.log("  ✗ أخطاء:", [...new Set(real)].slice(0, 8)); fail++; }
    else console.log("  ✓ مفيش أي استثناء");

    const missing = [...new Set(errors.filter((e) => /رد ناقص/.test(e)))];
    if (missing.length) console.log("  · دوال مالهاش رد في الهارنس:", missing.map((m) => m.split(": ")[1]));

    if (/undefined|\[object Object\]|NaN/.test(txt())) {
      const m = txt().match(/.{0,60}(undefined|\[object Object\]|NaN).{0,60}/);
      console.log("  ✗ قيمة مكسورة على الشاشة:", m[0]); fail++;
    } else console.log("  ✓ مفيش قيم مكسورة على الشاشة");
    console.log(`  · الدوال اللي اتنادت: ${[...new Set(calls.map((c) => c.fn))].join(", ")}`);
  }
  console.log(fail === 0 ? "\n✅ التلات صفحات عدّت بالكامل\n" : `\n🔴 ${fail} مشكلة\n`);
  process.exit(fail ? 1 : 0);
})();
