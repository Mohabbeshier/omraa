/*! Al-Omraa System — © 2026 Mohab Beshier (Head of Performance) & Axis Marketing Agency.
    All rights reserved. Proprietary — licensed to the Al-Omraa shop only; resale or use
    for any other business is prohibited. See LICENSE.md. */

const { useState, useEffect, useRef, useCallback } = React;

const SUPABASE_URL = "https://mjetglnmivwphxyzflsz.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qZXRnbG5taXZ3cGh4eXpmbHN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NTcwODgsImV4cCI6MjA5NjQzMzA4OH0.X6Rvxo4owPcBwE4HqXLm5fuPDSdEo8PV9oBV-bHsGrg";
const BUCKET = "product-images";

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

async function rpc(fn, args) {
  const tok = accessToken();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY, Authorization: `Bearer ${tok || ANON_KEY}` },
    body: JSON.stringify(args || {}),
  });
  const txt = await res.text();
  let data = null; try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = txt; }
  if (!res.ok) throw new Error((data && (data.message || data.hint)) || `HTTP ${res.status}`);
  return data;
}

/* ── الجودة مقابل الوزن ────────────────────────────────────────────
   الباقة المجانية بتدّي ٥ ج.ب نقل شهريًا. صورة ٢٤٠٠ بكسل ≈ ٦٠٠ ك.ب،
   وصفحة المتجر فيها ٢٤ كارت — يعني ١٤ م.ب للزيارة الواحدة، والباقة
   بتخلص بعد ٣٥٠ زيارة تقريبًا. ده مش تحسين، ده الفرق بين موقع شغّال
   وموقع بيقف.

   خدمة تصغير الصور في Supabase مدفوعة، فبنولّد المقاسات هنا في المتصفح
   ونرفع تلاتة لكل لقطة:

     _400  ← كارت الشبكة والمصغّرات   ≈ ٤٠ ك.ب
     _900  ← الصورة الكبيرة على الموبايل ≈ ١٥٠ ك.ب
     الأصل ← ديسكتوب وريتينا (≤١٨٠٠)   ≈ ٤٠٠ ك.ب

   ١٨٠٠ مش ٢٤٠٠: عمود صورة المنتج ~٦٠٠ بكسل CSS، وريتينا بيطلب الضعف.
   ١٨٠٠ بيغطّي ده بهامش، واللي فوقه بيتدفع من داتا العميلة بلا فايدة. */
const FULL_DIM = 1800;
const RENDITIONS = [400, 900];
const KEEP_AS_IS_BYTES = 1.2 * 1024 * 1024;
const OK_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { img.__url = url; resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("الملف مش قادر يتفتح كصورة")); };
    img.src = url;
  });
}

function scaleTo(img, maxDim, quality) {
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise((res, rej) =>
    canvas.toBlob((b) => b ? res(b) : rej(new Error("فشل تجهيز الصورة")), "image/jpeg", quality));
}

/* بترجع النسخة الكبيرة + النسخ الأصغر. النسخة الكبيرة بترفع بالبايت
   بتاعها لو الأصل مظبوط أصلًا — إعادة الترميز خسارة جودة من غير مقابل. */
async function prepareImage(file) {
  const ext = OK_TYPES[file.type];
  if (!ext) throw new Error("ده مش ملف صورة (JPG أو PNG أو WEBP بس)");

  const img = await loadImage(file);
  try {
    const untouched = Math.max(img.width, img.height) <= FULL_DIM && file.size <= KEEP_AS_IS_BYTES;
    const full = untouched
      ? { blob: file, ext, type: file.type }
      : { blob: await scaleTo(img, FULL_DIM, 0.9), ext: "jpg", type: "image/jpeg" };

    const small = {};
    for (const w of RENDITIONS) {
      // مفيش لزوم لنسخة أكبر من الأصل — بتكبر الحجم من غير أي جودة زيادة
      if (Math.max(img.width, img.height) <= w) continue;
      small[w] = { blob: await scaleTo(img, w, w <= 400 ? 0.78 : 0.85), ext: "jpg", type: "image/jpeg" };
    }
    return { full, small, untouched, w: img.width, h: img.height };
  } finally {
    URL.revokeObjectURL(img.__url);
  }
}

/* اسم الملف UUID، يعني المحتوى ما بيتغيّرش أبدًا تحت نفس الاسم.
   الكاش الافتراضي ساعة واحدة — يعني الزائر الراجع بيحمّل كل الصور من
   أول وجديد. سنة كاملة هي الصح هنا، وبتقطع من فاتورة النقل مباشرة. */
const CACHE_ONE_YEAR = "public, max-age=31536000, immutable";

async function uploadToStorage(productId, blob, ext, type) {
  const tok = accessToken();
  const path = `${productId}/${crypto.randomUUID()}.${ext || "jpg"}`;
  await putObject(path, blob, type, tok);
  return path;
}

async function putObject(path, blob, type, tok) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": type || "image/jpeg", apikey: ANON_KEY,
      Authorization: `Bearer ${tok || accessToken() || ANON_KEY}`,
      "x-upsert": "false", "cache-control": CACHE_ONE_YEAR,
    },
    body: blob,
  });
  if (!res.ok) { const t = await res.text().catch(() => ""); throw new Error(`رفع الصورة فشل: ${res.status} ${t.slice(0,120)}`); }
  return path;
}

/* رفع لقطة كاملة: الأصل + نسخه، تحت نفس الاسم بلاحقة المقاس، عشان
   يفضلوا مربوطين ببعض في التخزين ويسهل تنضيفهم مع بعض. */
async function uploadShot(productId, prep) {
  const tok = accessToken();
  const base = crypto.randomUUID();
  const fullPath = `${productId}/${base}.${prep.full.ext}`;
  await putObject(fullPath, prep.full.blob, prep.full.type, tok);

  const sizes = {};
  for (const [w, r] of Object.entries(prep.small)) {
    const p = `${productId}/${base}_${w}.${r.ext}`;
    try { await putObject(p, r.blob, r.type, tok); sizes[w] = p; }
    catch (e) { /* نسخة صغيرة فشلت؟ الموقع بيرجع للكبيرة، مش نوقف الرفع */ }
  }
  return { fullPath, sizes };
}

/* حذف صورة لازم يشيل ملفاتها من التخزين كمان. من غير ده كل حذف بيسيب
   ملف يتيم بياكل من الـ١ ج.ب المجانية للأبد. */
async function deleteObjects(paths) {
  if (!paths.length) return;
  await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY,
               Authorization: `Bearer ${accessToken() || ANON_KEY}` },
    body: JSON.stringify({ prefixes: paths }),
  }).catch(() => {});
}

const pathOf = (url) => {
  const m = String(url || "").split(`/public/${BUCKET}/`)[1];
  return m || null;
};

const fmtSize = (b) => b >= 1048576 ? `${(b / 1048576).toFixed(1)} م.ب` : `${Math.round(b / 1024)} ك.ب`;

/* سحب مجلد بيدّي DataTransferItem مش File — من غير القراءة دي، رمي مجلد
   على الصفحة مكان بيعمل حاجة خالص وهي ساكتة. */
function readEntry(entry) {
  return new Promise((resolve) => {
    if (!entry) return resolve([]);
    if (entry.isFile) return entry.file((f) => resolve([f]), () => resolve([]));
    if (entry.isDirectory) {
      const reader = entry.createReader();
      const all = [];
      const step = () => reader.readEntries(async (batch) => {
        if (!batch.length) {
          const nested = await Promise.all(all.map(readEntry));
          return resolve(nested.flat());
        }
        all.push(...batch); step();
      }, () => resolve([]));
      step();
    } else resolve([]);
  });
}

async function filesFromDrop(dt) {
  const items = dt && dt.items ? [...dt.items] : [];
  const entries = items
    .map((it) => (it.webkitGetAsEntry ? it.webkitGetAsEntry() : null))
    .filter(Boolean);
  if (entries.length) {
    const nested = await Promise.all(entries.map(readEntry));
    return nested.flat();
  }
  return [...(dt.files || [])];
}

/* ── تخمين اللون من اسم الملف ──────────────────────────────────────
   اللي بيصوّر بيسمّي الملفات باللون غالبًا: "صندل-اسود-1.jpg" أو
   "sandal_black_02.jpg". التخمين ده بيوفّر عشرات النقرات على ٤٠ صورة،
   وبيفضل مجرد اقتراح — كل صورة قدامها قائمة تقدر تغيّرها قبل الرفع. */
const COLOR_ALIASES = {
  "أسود": ["اسود","أسود","سودا","سوداء","black","blk"],
  "أبيض": ["ابيض","أبيض","بيضا","بيضاء","white","wht"],
  "بيج":  ["بيج","beige","nude","بينك بيج"],
  "بني":  ["بني","بنى","brown","تان","tan"],
  "دهبي": ["دهبي","ذهبي","دهبى","gold","golden"],
  "فضي":  ["فضي","فضى","silver"],
  "أحمر": ["احمر","أحمر","حمرا","red"],
  "أزرق": ["ازرق","أزرق","زرقا","blue","navy","كحلي"],
  "أخضر": ["اخضر","أخضر","خضرا","green"],
  "رمادي":["رمادي","رمادى","جراي","grey","gray"],
  "وردي": ["وردي","وردى","بينك","pink","روز","rose"],
  "جملي": ["جملي","جملى","camel"],
  "نبيتي":["نبيتي","نبيتى","برجندي","burgundy","maroon"],
};
const stripName = (n) => n.replace(/\.[a-z0-9]+$/i, "")
  .replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
  .replace(/[_\-.()\[\]0-9]+/g, " ").toLowerCase();

function guessColor(filename, colors) {
  const hay = " " + stripName(filename) + " ";
  // ١) اسم اللون بحاله في اسم الملف
  for (const c of colors) {
    const norm = stripName(c);
    if (norm && hay.includes(" " + norm + " ")) return c;
  }
  // ٢) مرادف معروف (إنجليزي أو كتابة مختلفة)
  for (const c of colors) {
    const key = Object.keys(COLOR_ALIASES).find((k) => stripName(k) === stripName(c));
    for (const alias of (COLOR_ALIASES[key] || [])) {
      if (hay.includes(" " + stripName(alias) + " ")) return c;
    }
  }
  return null;
}

/* ── تخمين اللون من الصورة نفسها ─────────────────────────────────────
   لما اسم الملف مايقولش اللون، بنبص على ألوان الصورة: بنشيل الخلفية
   (لون حواف الصورة)، وبنشيل الحاجات المشتركة بين صور الدفعة كلها
   (النعل والبطانة غالبًا نفس اللون في كل ألوان الموديل)، واللي فاضل هو
   لون الجزمة. بنقارنه بألوان الموديل ده بس، مش بكل الألوان.
   ده تخمين: الصورة بتظهر عليها «تخمين» عشان تتراجع. الألوان الفاتحة
   القريبة من بعض (أبيض/بيج/دهبي/فضي) أصعب حاجة، وبنسيبها من غير لون
   لو مش واثقين بدل ما نحط لون غلط. وكده كده الصور كلها بتظهر في معرض
   الموديل على الموقع؛ اللون بس بيخلّي الزبونة توصل للصورة بضغطة. */
const COLOR_REF = [
  [["روز جولد", "روزجولد"], [210, 150, 130]],
  [["اسود"], [28, 28, 30]], [["ابيض", "اوف وايت"], [238, 236, 228]],
  [["بيج", "شمواه", "نود"], [222, 200, 170]], [["هافان", "كونياك"], [176, 100, 50]],
  [["بني"], [95, 62, 42]], [["فضي", "قضي", "سيلفر"], [196, 198, 200]],
  [["ذهبي", "دهبي", "هبي", "جولد"], [212, 175, 110]], [["كحلي"], [32, 40, 70]],
  [["رمادي", "رصاصي"], [128, 126, 124]], [["نبيتي", "برجندي", "عنابي"], [120, 30, 40]],
  [["كافيه"], [150, 115, 90]], [["روز", "بينك", "وردي"], [228, 170, 170]],
  [["احمر"], [185, 40, 40]], [["زيتي"], [85, 95, 50]], [["ازرق"], [60, 100, 175]],
  [["لبني"], [160, 195, 225]], [["نحاسي"], [180, 105, 60]], [["فوشيا"], [205, 45, 130]],
  [["موف", "بنفسجي"], [150, 110, 170]], [["جملي"], [190, 140, 85]],
  [["اخضر"], [45, 120, 65]], [["اورنج", "برتقالي"], [230, 120, 35]],
];
function toLab([r, g, b]) {
  const f = (u) => { u /= 255; return u > 0.04045 ? ((u + 0.055) / 1.055) ** 2.4 : u / 12.92; };
  const R = f(r), G = f(g), B = f(b);
  const x = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047, y = 0.2126 * R + 0.7152 * G + 0.0722 * B,
        z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const h = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = h(x), fy = h(y), fz = h(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
/* الألوان الفاتحة والمعدنية شبه بعض جدًا في الصور (وبتتلخبط مع الخلفية
   الفاتحة والبطانة)، فمابنخمّنهاش خالص — أحسن من تخمين غلط. */
const NO_GUESS = new Set(["ابيض", "اوف وايت", "بيج", "شمواه", "نود", "ذهبي", "دهبي", "هبي", "جولد",
  "فضي", "قضي", "سيلفر", "روز", "بينك", "وردي", "لبني", "روز جولد", "روزجولد"]);
const guessable = (c) => !NO_GUESS.has(normColorName(c));
const labDist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const normColorName = (c) => String(c || "").trim().toLowerCase()
  .replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
  .split(/\s*[x×]\s*/)[0].trim();
function refLab(colorName) {
  const n = normColorName(colorName);
  if (!n) return null;
  for (const [keys, rgb] of COLOR_REF) if (keys.some((k) => n === k || n.startsWith(k + " ") || n === k.replace(/\s/g, ""))) return toLab(rgb);
  for (const [keys, rgb] of COLOR_REF) if (keys.some((k) => n.startsWith(k))) return toLab(rgb);
  return null;
}
async function imageHist(file) {
  const N = 64;
  let src;
  try { src = await createImageBitmap(file); }
  catch (_) {
    src = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = URL.createObjectURL(file); });
  }
  const cv = document.createElement("canvas"); cv.width = N; cv.height = N;
  const cx = cv.getContext("2d", { willReadFrequently: true });
  cx.drawImage(src, 0, 0, N, N);
  const px = cx.getImageData(0, 0, N, N).data;
  const at = (x, y) => { const i = (y * N + x) * 4; return toLab([px[i], px[i + 1], px[i + 2]]); };
  const border = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++)
    if (x < 3 || y < 3 || x > N - 4 || y > N - 4) border.push(at(x, y));
  const med = [0, 1, 2].map((k) => border.map((v) => v[k]).sort((a, b) => a - b)[border.length >> 1]);
  const h = new Map(); let tot = 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const L = at(x, y);
    if (labDist(L, med) < 18) continue;                       // الخلفية
    const k = `${Math.round(L[0] / 12)},${Math.round(L[1] / 10)},${Math.round(L[2] / 10)}`;
    const e = h.get(k) || [0, 0, 0, 0]; e[0]++; e[1] += L[0]; e[2] += L[1]; e[3] += L[2]; h.set(k, e); tot++;
  }
  const out = new Map();
  h.forEach((e, k) => out.set(k, [e[0] / Math.max(tot, 1), e[1] / e[0], e[2] / e[0], e[3] / e[0]]));
  return out;
}
/* rows: [{key, file}] — targets: مفاتيح الصور اللي محتاجة تخمين.
   بيرجّع {key: color} للصور اللي واثقين من لونها بس. */
async function detectColors(rows, colors, targets) {
  const refs = colors.map((c) => [c, refLab(c)]).filter((x) => x[1]);
  if (refs.length < 2 || !rows.length) return {};
  const H = new Map();
  for (const r of rows) { try { H.set(r.key, await imageHist(r.file)); } catch (_) {} }
  const keys = [...H.keys()];
  const all = new Set(); H.forEach((h) => h.forEach((_, k) => all.add(k)));
  const medOf = new Map();
  if (keys.length >= 3) all.forEach((k) => {
    const v = keys.map((r) => (H.get(r).get(k) || [0])[0]).sort((a, b) => a - b);
    medOf.set(k, v[v.length >> 1]);
  });
  const want = targets.filter((k) => H.has(k));
  const lab = new Map();
  for (const key of want) {
    const h = H.get(key);
    const cand = [];
    h.forEach((v, k) => { const s = v[0] - (medOf.get(k) || 0); if (s > 0) cand.push([s, [v[1], v[2], v[3]]]); });
    if (!cand.length) continue;
    cand.sort((a, b) => b[0] - a[0]);
    let best = cand[0];
    /* البطانة السودا بتغلب في الجزم الغامقة (زيتي/نبيتي/كحلي). لو الأقوى أسود
       وفيه لون تاني واضح وقوي كفاية، هو ده لون الجزمة. */
    if (best[1][0] < 20) {
      const alt = cand.find((c) => c[1][0] >= 20 && labDist(c[1], best[1]) > 20);
      if (alt && alt[0] >= 0.35 * best[0]) best = alt;
    }
    const acc = [0, 0, 0, 0];
    h.forEach((v, k) => { const s = v[0] - (medOf.get(k) || 0); const L = [v[1], v[2], v[3]];
      if (s > 0 && labDist(L, best[1]) < 20) { acc[0] += s; acc[1] += L[0] * s; acc[2] += L[1] * s; acc[3] += L[2] * s; } });
    lab.set(key, [acc[1] / acc[0], acc[2] / acc[0], acc[3] / acc[0]]);
  }
  const out = {};
  const ids = [...lab.keys()];
  if (ids.length > 1 && ids.length <= refs.length) {
    // صورة لكل لون (أشهر حالة): كل لون لصورة واحدة، الأقرب الأول
    const pairs = [];
    ids.forEach((k) => refs.forEach(([c, L]) => pairs.push([labDist(lab.get(k), L), k, c])));
    pairs.sort((a, b) => a[0] - b[0]);
    const uk = new Set(), uc = new Set();
    for (const [d, k, c] of pairs) { if (uk.has(k) || uc.has(c)) continue; uk.add(k); uc.add(c); if (d < 32 && guessable(c)) out[k] = c; }
  }
  /* صور أكتر من عدد الألوان = غالبًا كذا زاوية لنفس اللون. التخمين
     الفردي هنا جاب نتايج غلط في التجربة، فبنسيبها من غير لون. */
  return out;
}

/* رفع متوازي بسقف ٣ — أسرع بكتير من واحدة ورا واحدة على ٤٠ صورة،
   ومن غير ما يخنق اتصال بيتي أو يرمي الرفعات على بعض. */
async function runPool(items, limit, worker) {
  let idx = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (idx < items.length) {
      const i = idx++;
      await worker(items[i], i);
    }
  });
  await Promise.all(runners);
}

function toast(msg, kind) {
  const el = document.getElementById("toast");
  el.textContent = msg; el.className = kind || "";
  el.style.display = "block";
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.style.display = "none"; }, 3200);
}

const GENERIC = "__generic__";

/* ── تفضيلات الفلاتر بتتحفظ على الجهاز ──────────────────────────────
   localStorage ممكن يرمي (وضع خاص أو مقفول) — ساعتها نكمل بالافتراضي. */
const PREF_KEY = "omraa.photos.prefs.v1";
function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(PREF_KEY) || "{}") || {}; } catch (e) { return {}; }
}
function savePrefs(p) {
  try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch (e) {}
}

/* أرقام عربي → إنجليزي، وتطبيع الحروف للبحث المحلي */
const toLatinDigits = (s) => String(s || "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
  .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));
const normQ = (s) => toLatinDigits(s).trim().toLowerCase()
  .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/[ؤ]/g, "و");

function stateOf(p) {
  const total = (p.colors || []).length;
  const covered = total
    ? p.colors.filter((c) => (p.by_color || {})[c] > 0).length
    : (p.photo_count > 0 ? 1 : 0);
  const target = total || 1;
  if (p.photo_count === 0) return { key: "none", covered: 0, target };
  if (covered < target) return { key: "partial", covered, target };
  return { key: "done", covered, target };
}

/* ── اختيار موديل بالاسم أو الـSKU ───────────────────────────────────
   بيتستخدم في الرفع الجماعي لما اسم الملف ما يتعرّفش. */
function ModelPicker({ products, onPick, autoFocus, placeholder }) {
  const [q, setQ] = useState("");
  const n = normQ(q);
  // الترتيب: الـSKU بالظبط أولًا، بعده اللي بيبدأ بيه، وبعده الاسم
  const rank = (p) => normQ(p.base_sku) === n ? 0 : normQ(p.base_sku).startsWith(n) ? 1
    : normQ(p.name).startsWith(n) ? 2 : normQ(p.name).includes(n) ? 3 : 9;
  const hits = n
    ? products.map((p) => [rank(p), p]).filter(([r]) => r < 9)
        .sort((a, b) => a[0] - b[0] || String(a[1].base_sku).length - String(b[1].base_sku).length)
        .slice(0, 8).map(([, p]) => p)
    : [];
  return (
    <div className="picker">
      <input autoFocus={autoFocus} value={q} onChange={(e) => setQ(e.target.value)}
             placeholder={placeholder || "اكتبي اسم الموديل أو الـSKU…"} />
      {hits.length > 0 && (
        <div className="picker-list">
          {hits.map((p) => (
            <button key={p.id} type="button" className="picker-row"
                    onClick={() => { onPick(p); setQ(""); }}>
              <span className="sku">{p.base_sku}</span>
              <span className="pname">{p.name}</span>
              <span className="pcat">{p.category || ""}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── قائمة المنتجات ───────────────────────────────────────────────
   الترتيب مقصود: اللي محتاج صور فوق. ده هو الطابور، مش قائمة تصفّح.
   الفلاتر: حالة الصور، القسم، الظهور على الموقع، المخزون، اللون، والترتيب.
   البحث بالاسم أو الـSKU أو أي باركود للموديل. */
function ProductGrid({ products, onOpen, prefs, setPref, barcodeHit }) {
  const { q = "", tab = "none", cat = "", pub = "", stock = "", color = "", sort = "need" } = prefs;
  const n = normQ(q);

  const withState = products.map((p) => ({ ...p, st: stateOf(p) }));
  const cats = [...new Set(products.map((p) => p.category).filter(Boolean))].sort();
  const allColors = [...new Set(products.flatMap((p) => p.colors || []))].sort();

  // الفلاتر كلها ماعدا الحالة — عشان أرقام الحالة تبقى صح للاختيار الحالي
  let base = withState;
  if (cat) base = base.filter((p) => p.category === cat);
  if (pub === "on") base = base.filter((p) => p.is_published);
  if (pub === "off") base = base.filter((p) => !p.is_published);
  if (stock === "in") base = base.filter((p) => (p.in_stock || 0) > 0);
  if (stock === "out") base = base.filter((p) => !(p.in_stock > 0));
  if (color) base = base.filter((p) => (p.colors || []).includes(color));
  if (n) base = base.filter((p) => normQ(p.name).includes(n) || normQ(p.base_sku) === n
                              || (barcodeHit && barcodeHit.has(p.id)));

  const counts = {
    none: base.filter((p) => p.st.key === "none").length,
    partial: base.filter((p) => p.st.key === "partial").length,
    done: base.filter((p) => p.st.key === "done").length,
  };
  let list = tab === "all" ? base : base.filter((p) => p.st.key === tab);
  const by = {
    need: (a, b) => (a.st.key === "none" ? 0 : a.st.key === "partial" ? 1 : 2) - (b.st.key === "none" ? 0 : b.st.key === "partial" ? 1 : 2)
                    || (b.is_published - a.is_published) || (b.in_stock || 0) - (a.in_stock || 0),
    stock: (a, b) => (b.in_stock || 0) - (a.in_stock || 0),
    newest: (a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")),
    name: (a, b) => String(a.name).localeCompare(String(b.name), "ar"),
    sku: (a, b) => String(a.base_sku).localeCompare(String(b.base_sku), "en", { numeric: true }),
  };
  list = [...list].sort(by[sort] || by.need);
  const active = [cat, pub, stock, color].filter(Boolean).length;

  return (
    <>
      <div className="search-row">
        <input placeholder="دوّري بالاسم أو الـSKU أو امسحي باركود…" value={q}
               onChange={(e) => setPref("q", e.target.value)} />
        {q && <button className="btn-ghost btn-sm" onClick={() => setPref("q", "")}>مسح</button>}
      </div>

      <div className="fbar">
        <select value={cat} onChange={(e) => setPref("cat", e.target.value)} aria-label="القسم">
          <option value="">كل الأقسام</option>
          {cats.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={pub} onChange={(e) => setPref("pub", e.target.value)} aria-label="الظهور على الموقع">
          <option value="">الموقع: الكل</option>
          <option value="on">ظاهر على الموقع</option>
          <option value="off">مخفي عن الموقع</option>
        </select>
        <select value={stock} onChange={(e) => setPref("stock", e.target.value)} aria-label="المخزون">
          <option value="">المخزون: الكل</option>
          <option value="in">فيه مخزون</option>
          <option value="out">خلصان</option>
        </select>
        <select value={color} onChange={(e) => setPref("color", e.target.value)} aria-label="اللون">
          <option value="">كل الألوان</option>
          {allColors.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={sort} onChange={(e) => setPref("sort", e.target.value)} aria-label="الترتيب">
          <option value="need">الترتيب: المحتاج صور الأول</option>
          <option value="stock">الترتيب: الأكتر مخزون</option>
          <option value="newest">الترتيب: الأحدث</option>
          <option value="name">الترتيب: الاسم</option>
          <option value="sku">الترتيب: الـSKU</option>
        </select>
        {active > 0 && (
          <button className="btn-ghost btn-sm" onClick={() => { ["cat","pub","stock","color"].forEach((k) => setPref(k, "")); }}>
            شيل الفلاتر ({active})
          </button>
        )}
      </div>

      <div className="filters">
        {[["none", "محتاج صور", counts.none],
          ["partial", "ناقص ألوان", counts.partial],
          ["done", "تمام", counts.done],
          ["all", "الكل", base.length]].map(([k, label, c]) => (
          <button key={k} className={`fchip${tab === k ? " on" : ""}`}
                  onClick={() => setPref("tab", k)}>{label} ({c})</button>
        ))}
      </div>

      <div className="grid">
        {list.map((p) => {
          const pct = Math.round((p.st.covered / p.st.target) * 100);
          return (
            <div className={`pcard${p.st.key === "done" ? " done" : ""}`} key={p.id}
                 onClick={() => onOpen(p)}>
              <div className="thumb">
                {p.st.key === "none" && <span className="needs">محتاج صور</span>}
                {!p.is_published && <span className="pill-hidden">مخفي</span>}
                {p.cover ? <img src={p.cover_thumb || p.cover} alt="" loading="lazy" />
                         : <span className="no-img">بلا صورة</span>}
                {p.photo_count > 0 && <span className="ph-count">{p.photo_count} صورة</span>}
              </div>
              <div className="body">
                <p className="name">{p.name}</p>
                <p className="meta">
                  <span className="sku">{p.base_sku}</span>
                  {" · "}
                  {(p.colors || []).length
                    ? `${p.st.covered}/${p.st.target} ألوان`
                    : (p.photo_count ? `${p.photo_count} صورة` : "لسه")}
                  {" · "}{p.in_stock || 0} قطعة
                </p>
                <div className="bar"><span style={{ width: `${pct}%` }} /></div>
              </div>
            </div>
          );
        })}
        {list.length === 0 && <div className="empty" style={{ gridColumn: "1/-1" }}>
          مفيش موديل بالفلاتر دي</div>}
      </div>
    </>
  );
}

/* ── محرّر صور منتج واحد ──────────────────────────────────────────
   الفلو: تسحب الصور → تراجعها وألوانها في صينية → ترفع الكل مرة واحدة.
   الترتيب ده مقصود: تصحيح لون قبل الرفع مجاني، وبعد الرفع بيتكلّف
   نداء شبكة لكل صورة. */
function Editor({ product, onClose, onChanged, initialColor }) {
  const [images, setImages] = useState(product.images || []);
  const colors = product.colors || [];
  // لو جاي من مسح باركود، اللون معروف — نفتح عليه على طول
  const [sel, setSel] = useState(
    initialColor && colors.includes(initialColor) ? initialColor
      : colors.length === 1 ? colors[0] : null);
  const camRef = useRef(null);
  const [tray, setTray] = useState([]);          // الصور المستنية الرفع
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(0);
  const [over, setOver] = useState(false);
  const [acting, setActing] = useState(null);
  const [published, setPublished] = useState(!!product.is_published);
  const [publishing, setPublishing] = useState(false);
  const fileRef = useRef(null);
  const dirRef = useRef(null);

  /* رفع الصور مكانش بينشر المنتج، والصفحة مكانش فيها أي زرار نشر — كانت
     بتكتب "مخفي عن الموقع" وخلاص. فالصور بتترفع صح والمنتج يفضل مخفي،
     ومحدش يعرف إن فاضل خطوة. الزرار ده هو الخطوة الناقصة. */
  async function togglePublish() {
    if (publishing) return;
    setPublishing(true);
    try {
      const res = await rpc("shop_fn_set_published", {
        p_product_ids: [product.id], p_published: !published,
      });
      if (!res || res.ok === false) throw new Error((res && res.error) || "مقدرناش نغيّر الحالة");
      setPublished(!published);
      toast(!published ? "المنتج ظهر على الموقع ✓" : "المنتج اتخفى عن الموقع", "ok");
      onChanged && onChanged();
    } catch (e) {
      toast(e.message || "مقدرناش نغيّر الحالة", "err");
    } finally {
      setPublishing(false);
    }
  }

  const countFor = (c) => images.filter((i) => c === GENERIC ? !i.color : i.color === c).length;
  const firstFor = (c) => images.find((i) => c === GENERIC ? !i.color : i.color === c);
  const shown = sel === null ? images
    : images.filter((i) => (sel === GENERIC ? !i.color : i.color === sel));

  // لصق من الكليببورد — أسرع طريقة لصورة واحدة على الديسكتوب
  useEffect(() => {
    const onPaste = (e) => {
      const files = [...(e.clipboardData?.files || [])];
      if (files.length) { e.preventDefault(); addToTray(files); }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  const addToTray = useCallback(async (fileList) => {
    const incoming = Array.from(fileList || []).filter(Boolean);
    if (!incoming.length) return;

    // نوع مش مدعوم بيترفض هنا، مش بعد ما يقف في الصينية ويفشل عند الرفع.
    // صور الآيفون HEIC أشهر حالة — الرسالة لازم تقول له يعمل إيه.
    const wrongType = incoming.filter((f) => !OK_TYPES[f.type]);
    const usable = incoming.filter((f) => OK_TYPES[f.type]);

    setTray((t) => {
      // نفس الملف مرتين (رمي نفس المجلد تاني) بيتخطّى بدل ما يتكرّر على الموقع
      const seen = new Set(t.map((r) => `${r.file.name}|${r.file.size}`));
      const fresh = [];
      let dupes = 0;
      for (const file of usable) {
        const sig = `${file.name}|${file.size}`;
        if (seen.has(sig)) { dupes++; continue; }
        seen.add(sig);
        const guessed = colors.length ? guessColor(file.name, colors) : null;
        fresh.push({
          key: crypto.randomUUID(), file,
          preview: URL.createObjectURL(file),
          // الأولوية: تخمين من اسم الملف، وإلا اللون المفتوح دلوقتي
          color: guessed || (sel && sel !== GENERIC ? sel : ""),
          guessed: !!guessed,
          size: file.size, status: "ready", error: "",
        });
      }
      if (wrongType.length) {
        const heic = wrongType.some((f) => /hei[cf]/i.test(f.type) || /\.hei[cf]$/i.test(f.name));
        toast(heic
          ? `${wrongType.length} صورة بصيغة HEIC — حوّلها لـJPG الأول`
          : `${wrongType.length} ملف مش صورة مدعومة (JPG/PNG/WEBP بس)`, "err");
      } else if (dupes && !fresh.length) {
        toast("الصور دي موجودة في القايمة أصلًا", "err");
      } else if (dupes) {
        toast(`اتخطّت ${dupes} صورة مكرّرة`);
      }
      return [...t, ...fresh];
    });
  }, [colors, sel]);

  /* اللي اسم ملفه ماقالش لونه: نخمّن من ألوان الصورة نفسها (مقارنةً بباقي
     صور الدفعة). مابنلمسش صورة اختاري لونها بإيدك. */
  const guessing = useRef(false);
  const guessFromPixels = async (rows) => {
    if (guessing.current) return;
    const targets = rows.filter((r) => !r.color && !r.manual && r.status !== "error").map((r) => r.key);
    if (!targets.length || colors.length < 2) return;
    let sug = {};
    guessing.current = true;
    try { sug = await detectColors(rows, colors, targets); } catch (_) { return; }
    finally { guessing.current = false; }
    if (!Object.keys(sug).length) return;
    setTray((t) => t.map((r) => (!r.color && !r.manual && sug[r.key])
      ? { ...r, color: sug[r.key], guessed: "pixel" } : r));
  };

  const setTrayColor = (key, color) =>
    setTray((t) => t.map((r) => r.key === key ? { ...r, color, guessed: false, manual: true } : r));
  const applyToAll = (color) =>
    setTray((t) => t.map((r) => ({ ...r, color, guessed: false, manual: true })));
  const dropFromTray = (key) =>
    setTray((t) => {
      const row = t.find((r) => r.key === key);
      if (row) URL.revokeObjectURL(row.preview);
      return t.filter((r) => r.key !== key);
    });

  // ٤٠ صورة = ٤٠ blob URL محجوزة في الذاكرة لحد ما التاب يتقفل.
  const trayRef = useRef([]);
  useEffect(() => { trayRef.current = tray; }, [tray]);
  // صور جديدة دخلت الصينية ⇐ خمّن لون اللي من غير لون
  useEffect(() => { if (tray.length) guessFromPixels(tray); }, [tray.length]);
  useEffect(() => () => trayRef.current.forEach((r) => URL.revokeObjectURL(r.preview)), []);

  const untagged = colors.length ? tray.filter((r) => !r.color).length : 0;

  const uploadAll = async () => {
    if (!tray.length || uploading) return;
    setUploading(true); setDone(0);
    const results = [];
    await runPool(tray, 3, async (row) => {
      try {
        const prep = await prepareImage(row.file);
        const { fullPath, sizes } = await uploadShot(product.id, prep);
        const res = await rpc("shop_fn_attach_product_image", {
          p_product_id: product.id, p_path: fullPath,
          p_color: row.color && row.color !== GENERIC ? row.color : null,
          p_sizes: Object.keys(sizes).length ? sizes : null,
          // الأصل الحقيقي للصورة على جهازك. الاسم ده بيتحفظ في النسخة
          // الاحتياطية عشان لو التخزين ضاع، تعرف أنهي ملف يرجع لأنهي
          // منتج ولون بدل ما تخمّن على مئات الملفات.
          p_original_name: row.file.name,
        });
        if (!res || res.ok === false) throw new Error((res && res.error) || "فشل الحفظ");
        results.push({ key: row.key, ok: true,
          img: { id: res.id, url: res.url, color: row.color === GENERIC ? null : row.color } });
      } catch (e) {
        results.push({ key: row.key, ok: false, error: e.message || "فشل الرفع" });
      } finally {
        setDone((d) => d + 1);
      }
    });

    const good = results.filter((r) => r.ok);
    const bad = results.filter((r) => !r.ok);
    if (good.length) {
      good.forEach((r) => { const row = tray.find((x) => x.key === r.key); if (row) URL.revokeObjectURL(row.preview); });
      // نقرا من السيرفر بدل ما نبني الحالة محليًا: الغلاف والترتيب بيتحدّدوا
      // هناك (أول صورة بتبقى الغلاف تلقائيًا)، والتخمين هنا كان بيوريه غلط.
      try {
        const fresh = await rpc("shop_fn_admin_product_images", { p_product_id: product.id });
        setImages(Array.isArray(fresh) ? fresh : []);
      } catch (e) {
        setImages((imgs) => [...imgs, ...good.map((r) => r.img)]);
      }
    }
    // الناجح بيختفي من الصينية، والفاشل بيفضل ومعاه سببه عشان يتعاد
    setTray((t) => t.filter((r) => bad.some((b) => b.key === r.key))
                    .map((r) => {
                      const b = bad.find((x) => x.key === r.key);
                      return { ...r, status: "error", error: b ? b.error : "" };
                    }));
    setUploading(false);
    onChanged();
    if (bad.length === 0) toast(`اترفعت ${good.length} صورة ✓`, "ok");
    else toast(`اترفع ${good.length} — فضل ${bad.length} فيهم مشكلة`, "err");
  };

  const removeImage = async (img) => {
    if (!confirm("تأكيد حذف الصورة؟")) return;
    try {
      const res = await rpc("shop_fn_remove_product_image", { p_image_id: img.id });
      if (!res || res.ok === false) throw new Error((res && res.error) || "فشل الحذف");
      // الصف اتمسح — الملفات كمان، وإلا بتفضل تاكل من المساحة للأبد
      await deleteObjects([pathOf(img.url), ...Object.values(img.sizes || {}).map(pathOf)]
        .filter(Boolean));
      setImages((imgs) => imgs.filter((i) => i.id !== img.id));
      setActing(null); onChanged();
    } catch (e) { toast(e.message, "err"); }
  };

  const retag = async (img, color) => {
    try {
      const res = await rpc("shop_fn_update_product_image", {
        p_image_id: img.id,
        p_color: color === GENERIC ? null : color,
        p_clear_color: color === GENERIC,
      });
      if (!res || res.ok === false) throw new Error((res && res.error) || "فشل التعديل");
      setImages((imgs) => imgs.map((i) => i.id === img.id
        ? { ...i, color: color === GENERIC ? null : color } : i));
      setActing(null); onChanged(); toast("اتظبط ✓", "ok");
    } catch (e) { toast(e.message, "err"); }
  };

  const makeCover = async (img) => {
    try {
      const res = await rpc("shop_fn_update_product_image",
        { p_image_id: img.id, p_make_cover: true });
      if (!res || res.ok === false) throw new Error((res && res.error) || "فشل التعديل");
      setImages((imgs) => imgs.map((i) => ({ ...i, is_cover: i.id === img.id })));
      setActing(null); onChanged(); toast("بقت صورة الغلاف ✓", "ok");
    } catch (e) { toast(e.message, "err"); }
  };

  // نقل صورة لأول اللون: أول صورة هي اللي العميلة بتشوفها فورًا
  const moveFirst = async (img) => {
    try {
      const minSort = Math.min(...images.map((i) => i.sort ?? 0), 0);
      const res = await rpc("shop_fn_update_product_image",
        { p_image_id: img.id, p_sort: minSort - 1 });
      if (!res || res.ok === false) throw new Error((res && res.error) || "فشل التعديل");
      setImages((imgs) => [img, ...imgs.filter((i) => i.id !== img.id)]
        .map((i, n) => ({ ...i, sort: n })));
      setActing(null); onChanged(); toast("بقت أول صورة ✓", "ok");
    } catch (e) { toast(e.message, "err"); }
  };

  const missing = colors.filter((c) => countFor(c) === 0);
  const guessedCount = tray.filter((r) => r.guessed).length;
  const pixelCount = tray.filter((r) => r.guessed === "pixel").length;

  return (
    <>
      <div className="veil on" onClick={uploading ? undefined : onClose} />
      <div className="sheet on">
        <div className="sheet-inner">
          <div className="sheet-head">
            <div>
              <h2>{product.name}</h2>
              <p className="sub">
                <span className="sku">SKU {product.base_sku || "—"}</span>
                {" · "}{product.category || "—"}
                {sel && sel !== GENERIC ? <> · اللون: <strong>{sel}</strong></> : null}
              </p>
            </div>
            <button className="sheet-close" onClick={onClose} disabled={uploading}>✕</button>
          </div>

          {/* حالة الظهور + زرار النشر. المهم إن الحالة نفسها تبان من غير ما
              حد يدوّر عليها: قبل كده كانت كلمة رمادية جنب القسم. */}
          <div className={`pubbar${published ? " on" : ""}`}>
            <div className="pubtxt">
              <strong>{published ? "ظاهر على الموقع" : "مخفي عن الموقع"}</strong>
              <span>{published
                ? "العميلة تقدر تشوفه وتطلبه دلوقتي."
                : (images.length
                    ? "الصور اترفعت — فاضل تنشره عشان العميلة تشوفه."
                    : "ارفعي الصور الأول، وبعدين انشريه.")}</span>
            </div>
            <button
              className={`pubbtn${published ? " off" : ""}`}
              onClick={togglePublish}
              disabled={publishing || uploading || (!published && images.length === 0)}
              title={!published && images.length === 0 ? "محتاج صورة واحدة على الأقل" : ""}
            >
              {publishing ? "…" : published ? "إخفاء من الموقع" : "انشر على الموقع"}
            </button>
          </div>

          {colors.length > 0 ? (
            <>
              <div className="tip" style={{ marginTop: 0 }}>
                كل صور الموديل بتظهر مع بعض في معرض واحد على الموقع، والزبونة بتقلّب فيهم.
                اللون <strong>اختياري</strong>: لو علّمتي صورة بلون، الزبونة لما تدوس على اللون ده
                بتروح للصورة بتاعته على طول.
              </div>
              {missing.length > 0 && images.length > 0 && (
                <div className="warnbox">
                  ألوان مالهاش صورة متعلّمة: <strong>{missing.join("، ")}</strong>.
                  مش مشكلة لو صورها موجودة من غير لون — بس الضغط على اللون مش هينقلها لصورته.
                </div>
              )}
              <div className="clist">
                {colors.map((c) => {
                  const n = countFor(c); const f = firstFor(c);
                  return (
                    <div key={c} className={`crow${sel === c ? " on" : ""}`} onClick={() => setSel(c)}>
                      {f ? <img className="cthumb" src={f.thumb || f.url} alt="" />
                         : <span className="cthumb empty">＋</span>}
                      <span className="cname">{c}</span>
                      <span className={`ccount${n ? " has" : ""}`}>{n ? `${n} صورة` : "لسه"}</span>
                    </div>
                  );
                })}
                <div className={`crow${sel === GENERIC ? " on" : ""}`} onClick={() => setSel(GENERIC)}>
                  {firstFor(GENERIC) ? <img className="cthumb" src={firstFor(GENERIC).thumb || firstFor(GENERIC).url} alt="" />
                                     : <span className="cthumb empty">＋</span>}
                  <span className="cname">من غير لون</span>
                  <span className={`ccount${countFor(GENERIC) ? " has" : ""}`}>
                    {countFor(GENERIC) ? `${countFor(GENERIC)} صورة` : "لسه"}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="tip">
              الموديل ده مسجّل من غير ألوان في المخزون، فالصور هتبقى عامة لكل الموديل.
            </div>
          )}

          {/* التصوير المباشر: على الموبايل بيفتح الكاميرا الخلفية على طول.
              الصورة بتدخل الصينية باللون المختار فوق، زي أي صورة تانية. */}
          <button className="btn-primary cam-btn" disabled={uploading}
                  onClick={() => camRef.current && camRef.current.click()}>
            📷 صوّري دلوقتي{sel && sel !== GENERIC ? ` — ${sel}` : ""}
          </button>
          <input ref={camRef} type="file" accept="image/*" capture="environment"
                 style={{ display: "none" }}
                 onChange={(e) => { addToTray(e.target.files); e.target.value = ""; }} />

          {/* منطقة السحب والإفلات */}
          <div className={`drop${over ? " over" : ""}`}
               onClick={() => fileRef.current && fileRef.current.click()}
               onDragOver={(e) => { e.preventDefault(); setOver(true); }}
               onDragLeave={() => setOver(false)}
               onDrop={async (e) => {
                 e.preventDefault(); setOver(false);
                 addToTray(await filesFromDrop(e.dataTransfer));
               }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 16V4m0 0L8 8m4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" strokeLinecap="round" />
            </svg>
            <p className="big">اسحب الصور هنا أو اضغط للاختيار</p>
            <p className="small">
              تقدر ترمي مجلد كامل، أو تعمل لصق (Ctrl+V). JPG أو PNG أو WEBP.
            </p>
            <button className="btn-ghost btn-sm" style={{ marginTop: 10 }}
                    onClick={(e) => { e.stopPropagation(); dirRef.current && dirRef.current.click(); }}>
              أو اختار مجلد من الجهاز
            </button>
          </div>

          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple
                 style={{ display: "none" }}
                 onChange={(e) => { addToTray(e.target.files); e.target.value = ""; }} />
          <input ref={dirRef} type="file" multiple webkitdirectory="" directory=""
                 style={{ display: "none" }}
                 onChange={(e) => { addToTray(e.target.files); e.target.value = ""; }} />

          {/* صينية المراجعة */}
          {tray.length > 0 && (
            <div className="tray">
              <div className="tray-head">
                <div>
                  <strong>{tray.length} صورة جاهزة للرفع</strong>
                  {guessedCount > 0 && (
                    <p className="sub" style={{ margin: 0 }}>
                      خمّنت لون {guessedCount} منهم {pixelCount ? (pixelCount === guessedCount ? "من ألوان الصورة" : "من اسم الملف وألوان الصورة") : "من اسم الملف"} — راجعيهم بسرعة.
                    </p>
                  )}
                </div>
                {colors.length > 0 && (
                  <select style={{ width: "auto", minWidth: 150 }}
                          disabled={uploading}
                          onChange={(e) => { if (e.target.value) applyToAll(e.target.value); e.target.value = ""; }}>
                    <option value="">طبّق لون على الكل…</option>
                    {colors.map((c) => <option key={c} value={c}>{c}</option>)}
                    <option value={GENERIC}>عامة (كل الألوان)</option>
                  </select>
                )}
              </div>

              <div className="tray-grid">
                {tray.map((r) => (
                  <div className={`tcard${r.status === "error" ? " err" : ""}`} key={r.key}>
                    <img src={r.preview} alt="" />
                    {r.guessed && <span className="guess">{r.guessed === "pixel" ? "تخمين من الصورة" : "تخمين"}</span>}
                    <span className="sz">{fmtSize(r.size)}</span>
                    {!uploading && <button className="x" onClick={() => dropFromTray(r.key)}>✕</button>}
                    {colors.length > 0 ? (
                      <select value={r.color} disabled={uploading}
                              onChange={(e) => setTrayColor(r.key, e.target.value)}>
                        <option value="">من غير لون (معرض الموديل)</option>
                        {colors.map((c) => <option key={c} value={c}>{c}</option>)}
                        <option value={GENERIC}>عامة</option>
                      </select>
                    ) : (
                      <div style={{ fontSize: 11, padding: "6px 7px", color: "var(--muted)" }}>عامة</div>
                    )}
                    {r.status === "error" && <div className="bad">{r.error}</div>}
                  </div>
                ))}
              </div>

              {uploading && (
                <div className="tprog">
                  <span style={{ width: `${Math.round((done / tray.length) * 100)}%` }} />
                </div>
              )}
            </div>
          )}

          <div className="tip">
            من كل صورة بيتعمل ٣ نسخ تلقائيًا: صغيرة للشبكة، متوسطة للموبايل،
            وكبيرة للشاشات الكبيرة — العميلة بتحمّل المناسب لشاشتها بس.
            دوسي على أي صورة مرفوعة عشان تغيّري لونها أو تخليها الغلاف.
          </div>

          <div className="shot-grid">
            {shown.map((img) => (
              <div className={`shot${img.is_cover ? " cover" : ""}`} key={img.id}
                   onClick={() => setActing(img)}>
                <img src={img.thumb || img.url} alt="" loading="lazy" />
                {img.is_cover && <span className="cov">الغلاف</span>}
                <span className="color-tag">{img.color || "عام"}</span>
              </div>
            ))}
            {shown.length === 0 && (
              <div className="empty" style={{ gridColumn: "1/-1" }}>
                {sel ? "مفيش صور للاختيار ده لسه" : "مفيش صور لسه"}
              </div>
            )}
          </div>
        </div>

        <div className="stickybar">
          <button className="btn-primary" onClick={uploadAll}
                  disabled={!tray.length || uploading}>
            {uploading ? `بيرفع… ${done} من ${tray.length}`
              : tray.length ? `ارفع ${tray.length} صورة` : "اسحب الصور فوق عشان تبدأ"}
          </button>
        </div>
      </div>

      {acting && (
        <div className="pactions" onClick={() => setActing(null)}>
          <div className="pabox" onClick={(e) => e.stopPropagation()}>
            <h3>الصورة دي</h3>
            <p className="sub" style={{ marginBottom: 12 }}>
              اللون الحالي: {acting.color || "عام (كل الألوان)"}</p>
            {!acting.is_cover && (
              <button className="pa-btn" onClick={() => makeCover(acting)}>خليها صورة الغلاف</button>
            )}
            <button className="pa-btn" onClick={() => moveFirst(acting)}>خليها أول صورة</button>
            {colors.filter((c) => c !== acting.color).map((c) => (
              <button key={c} className="pa-btn" onClick={() => retag(acting, c)}>
                غيّر اللون لـ «{c}»</button>
            ))}
            {acting.color && (
              <button className="pa-btn" onClick={() => retag(acting, GENERIC)}>
                خليها عامة (كل الألوان)</button>
            )}
            <button className="pa-btn danger" onClick={() => removeImage(acting)}>احذف الصورة</button>
            <button className="pa-btn" onClick={() => setActing(null)}>إلغاء</button>
          </div>
        </div>
      )}
    </>
  );
}

/* ── امسح وصوّر ────────────────────────────────────────────────────
   أسرع طريقة: تمسكي أي قطعة، تمسحي باركودها، فالسيستم يعرف الموديل
   واللون لوحده ويفتح التصوير عليهم. بيشتغل بثلاث طرق:
     • كاميرا الموبايل (أندرويد/كروم — BarcodeDetector)
     • قارئ الباركود العادي (بيكتب في الخانة ويدوس Enter)
     • كتابة الباركود أو الـSKU بالإيد */
function ScanPanel({ onResolved }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [camOn, setCamOn] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const inputRef = useRef(null);
  const canDetect = typeof window !== "undefined" && "BarcodeDetector" in window;

  const stopCam = () => {
    try { (streamRef.current?.getTracks() || []).forEach((t) => t.stop()); } catch (e) {}
    streamRef.current = null; setCamOn(false);
  };
  useEffect(() => () => stopCam(), []);

  const lookup = async (raw) => {
    const v = toLatinDigits(String(raw || "")).trim();
    if (!v || busy) return;
    setBusy(true); setMsg("");
    try {
      const res = await rpc("shop_fn_photo_resolve", { p_inputs: [v] });
      const r = Array.isArray(res) ? res[0] : null;
      if (r && r.product) { stopCam(); setCode(""); onResolved(r.product, r.color); }
      else if (r && r.candidates) setMsg("فيه أكتر من موديل بالـSKU ده — اكتبيه بالظبط زي ما هو (حروف كبيرة/صغيرة)");
      else setMsg(`«${v}» مش متسجّل — جرّبي باركود قطعة تانية أو اكتبي الـSKU`);
    } catch (e) { setMsg(e.message || "حصل خطأ"); }
    finally { setBusy(false); inputRef.current && inputRef.current.focus(); }
  };

  const startCam = async () => {
    setMsg("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream; setCamOn(true);
      await new Promise((r) => setTimeout(r, 50));
      const v = videoRef.current; if (!v) return;
      v.srcObject = stream; await v.play();
      const det = new window.BarcodeDetector({ formats: ["code_128", "ean_13", "ean_8", "upc_a", "code_39", "itf", "qr_code"] });
      const tick = async () => {
        if (!streamRef.current) return;
        try {
          const found = await det.detect(v);
          if (found && found[0] && found[0].rawValue) { lookup(found[0].rawValue); return; }
        } catch (e) {}
        setTimeout(tick, 250);
      };
      tick();
    } catch (e) {
      stopCam();
      setMsg("مقدرناش نفتح الكاميرا — اسمحي للصفحة بالكاميرا، أو استخدمي القارئ أو اكتبي الرقم");
    }
  };

  return (
    <div className="panel">
      <h2>امسحي باركود أي قطعة</h2>
      <p className="sub" style={{ marginBottom: 12 }}>
        السيستم بيعرف الموديل واللون من الباركود، ويفتح لك التصوير عليهم على طول.
      </p>
      <form className="search-row" onSubmit={(e) => { e.preventDefault(); lookup(code); }}>
        <input ref={inputRef} autoFocus inputMode="text" value={code} disabled={busy}
               onChange={(e) => setCode(e.target.value)}
               placeholder="امسحي بالقارئ، أو اكتبي الباركود / الـSKU" />
        <button className="btn-primary" type="submit" disabled={busy || !code.trim()}>
          {busy ? "…" : "افتح"}</button>
      </form>
      {canDetect ? (
        camOn ? (
          <div className="cam">
            <video ref={videoRef} playsInline muted />
            <div className="cam-frame" />
            <button className="btn-ghost" onClick={stopCam}>اقفل الكاميرا</button>
          </div>
        ) : (
          <button className="btn-primary cam-btn" onClick={startCam}>📷 امسحي بكاميرا الموبايل</button>
        )
      ) : (
        <div className="tip">
          الجهاز ده مش بيقرا باركود من الكاميرا (آيفون مثلًا) — استخدمي قارئ الباركود
          أو اكتبي الرقم اللي تحت الباركود، والباقي زي ما هو.
        </div>
      )}
      {msg && <div className="warnbox" style={{ marginTop: 12 }}>{msg}</div>}
    </div>
  );
}

/* ── الرفع الجماعي ───────────────────────────────────────────────────
   ترمي صور كتير مرة واحدة (أو مجلد كامل)، والسيستم يوزّعها لوحده:
     • اسم الملف: «15-اسود.jpg» ← موديل SKU 15، لون أسود
     • اسم المجلد: مجلد «15» جواه «اسود.jpg» ← نفس النتيجة
     • اسم الملف = اسم الموديل، أو باركود قطعة
   اللي ما يتعرّفش بيفضل في الجدول تختاري له الموديل بإيدك. ومفيش رفع
   غير لما تراجعي وتدوسي «ارفع». */
function BulkPanel({ products, onDone }) {
  const [rows, setRows] = useState([]);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [only, setOnly] = useState("");     // فلتر الجدول: "" | "ok" | "missing"
  const fileRef = useRef(null);
  const dirRef = useRef(null);
  const byId = new Map(products.map((p) => [p.id, p]));

  const rowsRef = useRef([]);
  useEffect(() => { rowsRef.current = rows; }, [rows]);
  useEffect(() => () => rowsRef.current.forEach((r) => URL.revokeObjectURL(r.preview)), []);

  const addFiles = async (fileList) => {
    const incoming = Array.from(fileList || []).filter(Boolean);
    const usable = incoming.filter((f) => OK_TYPES[f.type]);
    const bad = incoming.length - usable.length;
    if (bad) toast(`${bad} ملف مش صورة مدعومة (JPG/PNG/WEBP) — اتخطّوا`, "err");
    if (!usable.length) return;
    const seen = new Set(rows.map((r) => `${r.file.name}|${r.file.size}`));
    const fresh = usable.filter((f) => !seen.has(`${f.name}|${f.size}`)).map((f) => {
      const rel = f.webkitRelativePath || "";
      const parts = rel.split("/").filter(Boolean);
      return { key: crypto.randomUUID(), file: f, preview: URL.createObjectURL(f),
               folder: parts.length > 1 ? parts[parts.length - 2] : "",
               product: null, color: "", how: "", status: "ready", error: "", cands: null };
    });
    if (!fresh.length) { toast("الصور دي موجودة في القايمة أصلًا", "err"); return; }
    setBusy(true);
    try {
      // ١) اسم الملف  ٢) اللي ما اتعرّفش: اسم المجلد + اسم الملف
      const resolved = new Map();
      for (let i = 0; i < fresh.length; i += 200) {
        const part = fresh.slice(i, i + 200);
        const res = await rpc("shop_fn_photo_resolve", { p_inputs: part.map((r) => r.file.name) });
        (res || []).forEach((x, n) => resolved.set(part[n].key, x));
      }
      const retry = fresh.filter((r) => !(resolved.get(r.key) || {}).product && r.folder);
      for (let i = 0; i < retry.length; i += 200) {
        const part = retry.slice(i, i + 200);
        const res = await rpc("shop_fn_photo_resolve",
          { p_inputs: part.map((r) => `${r.folder} ${r.file.name}`) });
        (res || []).forEach((x, n) => { if (x && x.product) resolved.set(part[n].key, { ...x, kind: "folder" }); });
      }
      const ready = fresh.map((r) => {
        const x = resolved.get(r.key) || {};
        const prod = x.product ? (byId.get(x.product.id) || x.product) : null;
        const color = x.color || (prod ? guessColor(r.file.name, prod.colors || []) : null) || "";
        return { ...r, product: prod, color: color || "", how: x.kind || "none", cands: x.candidates || null };
      });
      setRows((t) => [...t, ...ready]);
      guessBulkPixels([...rows, ...ready]);
      const okN = ready.filter((r) => r.product).length;
      toast(`اتعرّف ${okN} من ${ready.length} صورة تلقائيًا${okN < ready.length ? " — الباقي اختاري موديله" : " ✓"}`,
            okN < ready.length ? "" : "ok");
    } catch (e) { toast(e.message || "تعذّر التعرّف على الصور", "err"); }
    finally { setBusy(false); }
  };

  const setRow = (key, patch) => setRows((t) => t.map((r) => r.key === key ? { ...r, ...patch } : r));
  /* نفس تخمين ألوان الصورة، لكل موديل لوحده (الصور بتتقارن بصور نفس الموديل بس). */
  const guessBulkPixels = async (all) => {
    const groups = new Map();
    all.forEach((r) => { if (r.product && r.status !== "done") {
      const g = groups.get(r.product.id) || []; g.push(r); groups.set(r.product.id, g); } });
    for (const g of groups.values()) {
      const cols = g[0].product.colors || [];
      const targets = g.filter((r) => !r.color && !r.manual).map((r) => r.key);
      if (!targets.length || cols.length < 2) continue;
      let sug = {};
      try { sug = await detectColors(g, cols, targets); } catch (_) { continue; }
      if (Object.keys(sug).length)
        setRows((t) => t.map((r) => (!r.color && !r.manual && sug[r.key]) ? { ...r, color: sug[r.key], how: r.how, guessed: "pixel" } : r));
    }
  };
  const dropRow = (key) => setRows((t) => {
    const r = t.find((x) => x.key === key); if (r) URL.revokeObjectURL(r.preview);
    return t.filter((x) => x.key !== key);
  });

  const missing = rows.filter((r) => !r.product).length;
  const noColor = rows.filter((r) => r.product && (r.product.colors || []).length && !r.color).length;
  const shown = only === "ok" ? rows.filter((r) => r.product) : only === "missing" ? rows.filter((r) => !r.product) : rows;

  const uploadAll = async () => {
    const todo = rows.filter((r) => r.product && r.status !== "done");
    if (!todo.length || busy) return;
    setBusy(true); setDone(0);
    await runPool(todo, 3, async (row) => {
      try {
        const prep = await prepareImage(row.file);
        const { fullPath, sizes } = await uploadShot(row.product.id, prep);
        const res = await rpc("shop_fn_attach_product_image", {
          p_product_id: row.product.id, p_path: fullPath,
          p_color: row.color && row.color !== GENERIC ? row.color : null,
          p_sizes: Object.keys(sizes).length ? sizes : null,
          p_original_name: row.file.name,
        });
        if (!res || res.ok === false) throw new Error((res && res.error) || "فشل الحفظ");
        setRow(row.key, { status: "done", error: "" });
      } catch (e) {
        setRow(row.key, { status: "error", error: e.message || "فشل الرفع" });
      } finally { setDone((d) => d + 1); }
    });
    setBusy(false);
    setRows((t) => {
      t.filter((r) => r.status === "done").forEach((r) => URL.revokeObjectURL(r.preview));
      const left = t.filter((r) => r.status !== "done");
      const up = t.length - left.length;
      toast(left.some((r) => r.status === "error")
        ? `اترفع ${up} — فضل ${left.filter((r) => r.status === "error").length} فيهم مشكلة` : `اترفعت ${up} صورة ✓`,
        left.some((r) => r.status === "error") ? "err" : "ok");
      return left;
    });
    onDone && onDone();
  };

  return (
    <div className="panel">
      <h2>رفع جماعي — السيستم يوزّع الصور لوحده</h2>
      <div className="tip">
        سمّي الصورة بالـSKU واللون: <b>15-اسود.jpg</b> أو <b>16X بني 2.jpg</b>.
        أو اعملي مجلد باسم الـSKU (مثلًا <b>15</b>) وجواه الصور باسم اللون.
        ولو الاسم مش مفهوم، هتختاري الموديل بإيدك قبل الرفع.
      </div>
      <div className={`drop${over ? " over" : ""}`}
           onClick={() => fileRef.current && fileRef.current.click()}
           onDragOver={(e) => { e.preventDefault(); setOver(true); }}
           onDragLeave={() => setOver(false)}
           onDrop={async (e) => { e.preventDefault(); setOver(false); addFiles(await filesFromDrop(e.dataTransfer)); }}>
        <p className="big">{busy && !rows.length ? "بيتعرّف على الصور…" : "اسحبي الصور أو المجلدات هنا"}</p>
        <p className="small">أو اضغطي للاختيار من الجهاز</p>
        <button className="btn-ghost btn-sm" style={{ marginTop: 10 }}
                onClick={(e) => { e.stopPropagation(); dirRef.current && dirRef.current.click(); }}>
          اختاري مجلد كامل</button>
      </div>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple style={{ display: "none" }}
             onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
      <input ref={dirRef} type="file" multiple webkitdirectory="" directory="" style={{ display: "none" }}
             onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />

      {rows.length > 0 && (
        <>
          <div className="filters">
            {[["", `الكل (${rows.length})`], ["ok", `اتعرّفت (${rows.length - missing})`],
              ["missing", `محتاجة موديل (${missing})`]].map(([k, label]) => (
              <button key={k} className={`fchip${only === k ? " on" : ""}`} onClick={() => setOnly(k)}>{label}</button>
            ))}
          </div>
          <div className="brows">
            {shown.map((r) => (
              <div key={r.key} className={`brow${!r.product ? " miss" : ""}${r.status === "error" ? " err" : ""}`}>
                <img src={r.preview} alt="" />
                <div className="binfo">
                  <div className="fname" title={r.file.webkitRelativePath || r.file.name}>
                    {r.folder ? `${r.folder}/` : ""}{r.file.name}</div>
                  {r.product ? (
                    <div className="bprod">
                      <span className="sku">{r.product.base_sku}</span> {r.product.name}
                      <button className="link" disabled={busy}
                              onClick={() => setRow(r.key, { product: null, color: "" })}>غيّر</button>
                    </div>
                  ) : r.cands ? (
                    <select value="" onChange={(e) => { const p = byId.get(e.target.value); if (p) setRow(r.key, { product: p, cands: null, color: guessColor(r.file.name, p.colors || []) || "" }); }}>
                      <option value="">أكتر من موديل بنفس الـSKU — اختاري…</option>
                      {r.cands.map((c) => <option key={c.id} value={c.id}>{c.base_sku} — {c.name}</option>)}
                    </select>
                  ) : (
                    <ModelPicker products={products}
                                 onPick={(p) => setRow(r.key, { product: p, how: "manual", color: guessColor(r.file.name, p.colors || []) || "" })} />
                  )}
                  {r.product && (r.product.colors || []).length > 0 && (
                    <select value={r.color} disabled={busy} onChange={(e) => setRow(r.key, { color: e.target.value, manual: true, guessed: false })}>
                      <option value="">من غير لون</option>
                      {r.product.colors.map((c) => <option key={c} value={c}>{c}</option>)}
                      <option value={GENERIC}>عامة (كل الألوان)</option>
                    </select>
                  )}
                  {r.guessed === "pixel" && (
                    <span style={{ fontSize: 11, color: "var(--warn, #b45309)" }}>تخمين من الصورة — راجعيه</span>
                  )}
                  {r.status === "error" && <div className="bad-inline">{r.error}</div>}
                </div>
                {!busy && <button className="x-inline" onClick={() => dropRow(r.key)} aria-label="شيل">✕</button>}
              </div>
            ))}
          </div>
          {busy && rows.some((r) => r.product) && (
            <div className="tprog"><span style={{ width: `${Math.round((done / Math.max(1, rows.filter((r) => r.product).length)) * 100)}%` }} /></div>
          )}
          <div className="stickybar">
            <button className="btn-primary" onClick={uploadAll} disabled={busy || rows.length === missing}>
              {busy ? `بيرفع… ${done}` : `ارفع ${rows.length - missing} صورة${missing ? ` (و${missing} لسه من غير موديل)` : ""}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ── تنضيف التخزين ───────────────────────────────────────────────────
   أي ملف في التخزين مفيش صورة بتشاور عليه (رفع اتقطع، أو صورة اتمسحت)
   بيتشال هنا بهدوء — عشان المساحة المجانية ما تتاكلش. السيرفر بيستثني
   أي ملف عمره أقل من ١٠ دقايق، فمستحيل يلمس رفع شغال. */
async function cleanOrphans() {
  try {
    const list = await rpc("shop_fn_photo_orphans", {});
    if (!Array.isArray(list) || !list.length) return 0;
    for (let i = 0; i < list.length; i += 100) await deleteObjects(list.slice(i, i + 100));
    try { window.__omraaLog && window.__omraaLog("photos.orphans_cleaned", { message: `${list.length} files` }, { severity: "info" }); } catch (e) {}
    return list.length;
  } catch (e) { return 0; }
}

function App() {
  const [products, setProducts] = useState(null);
  const [prefs, setPrefs] = useState(() => ({ mode: "grid", tab: "none", sort: "need", ...loadPrefs() }));
  const [open, setOpen] = useState(null);
  const [error, setError] = useState("");
  const [barcodeHit, setBarcodeHit] = useState(null);

  const setPref = (k, v) => setPrefs((p) => { const n = { ...p, [k]: v }; savePrefs(n); return n; });

  const load = useCallback(async () => {
    try {
      // طابور إداري: بيشمل غير المنشور كمان — ده بالظبط اللي بيتصوّر
      // قبل ما ينزل الموقع. الكتالوج العام كان بيخفيه.
      const rows = await rpc("shop_fn_admin_photo_queue", { p_q: null });
      setProducts(Array.isArray(rows) ? rows : []);
    } catch (e) { setError(e.message || "تعذّر تحميل المنتجات"); }
  }, []);

  useEffect(() => { load(); cleanOrphans(); }, [load]);

  // البحث بباركود: الأرقام الطويلة بتتدوّر على السيرفر (الباركود مش محمّل محليًا)
  useEffect(() => {
    const v = toLatinDigits(prefs.q || "").trim();
    if (!/^[0-9]{6,20}$/.test(v)) { setBarcodeHit(null); return; }
    let live = true;
    rpc("shop_fn_admin_photo_queue", { p_q: v })
      .then((rows) => { if (live) setBarcodeHit(new Set((rows || []).map((r) => r.id))); })
      .catch(() => {});
    return () => { live = false; };
  }, [prefs.q]);

  const openProduct = async (p, color) => {
    try {
      const full = (products || []).find((x) => x.id === p.id) || p;
      const imgs = await rpc("shop_fn_admin_product_images", { p_product_id: p.id });
      setOpen({ ...full, images: imgs || [], initialColor: color || null });
    } catch (e) { toast(e.message, "err"); }
  };

  if (error) return <div className="center"><p style={{ color: "var(--danger)" }}>{error}</p></div>;
  if (!products) return <div className="center"><div className="spin-big" /><p className="muted">جارٍ التحميل…</p></div>;

  const withPhotos = products.filter((p) => p.photo_count > 0).length;
  const mode = prefs.mode || "grid";

  return (
    <>
      <div className="stats">
        <div><b>{products.length}</b><span>موديل</span></div>
        <div><b>{withPhotos}</b><span>عليه صور</span></div>
        <div><b>{products.length - withPhotos}</b><span>محتاج صور</span></div>
        <div><b>{products.filter((p) => p.is_published).length}</b><span>ظاهر على الموقع</span></div>
      </div>

      <div className="modes" role="tablist">
        {[["grid", "🗂️ الموديلات"], ["scan", "📷 امسحي وصوّري"], ["bulk", "⬆️ رفع جماعي"]].map(([k, label]) => (
          <button key={k} role="tab" aria-selected={mode === k} className={`mode${mode === k ? " on" : ""}`}
                  onClick={() => setPref("mode", k)}>{label}</button>
        ))}
      </div>

      {mode === "grid" && (
        <ProductGrid products={products} prefs={prefs} setPref={setPref}
                     barcodeHit={barcodeHit} onOpen={(p) => openProduct(p)} />
      )}
      {mode === "scan" && <ScanPanel onResolved={(p, color) => openProduct(p, color)} />}
      {mode === "bulk" && <BulkPanel products={products} onDone={load} />}

      {open && (
        <Editor product={open} initialColor={open.initialColor}
                onClose={() => { setOpen(null); load(); }}
                onChanged={load} />
      )}
    </>
  );
}

ReactDOM.createRoot(document.getElementById("app")).render(<App />);
