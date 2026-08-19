/* مولّد آليًا من photos.jsx — عدّل الـjsx وشغّل scripts/build_photos.js */
const {
  useState,
  useEffect,
  useRef,
  useCallback
} = React;
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
function b64urlToText(s) {
  const pad = s.length % 4 ? "=".repeat(4 - s.length % 4) : "";
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
function readCookieChunks(name) {
  const jar = {};
  for (const part of String(document.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    jar[part.slice(0, i).trim()] = part.slice(i + 1);
  }
  if (jar[name] !== undefined) return jar[name];
  // الكوكي الكبيرة بتتقسّم لأجزاء مرقّمة، ولازم تترص بالترتيب
  let out = "",
    n = 0;
  while (jar[`${name}.${n}`] !== undefined) {
    out += jar[`${name}.${n}`];
    n++;
  }
  return n > 0 ? out : null;
}
function parseSession(raw) {
  if (!raw) return null;
  let v = raw;
  try {
    v = decodeURIComponent(v);
  } catch (e) {}
  if (v.startsWith("base64-")) {
    try {
      v = b64urlToText(v.slice(7));
    } catch (e) {
      return null;
    }
  }
  let o;
  try {
    o = JSON.parse(v);
  } catch (e) {
    return null;
  }
  if (Array.isArray(o)) return {
    access_token: o[0],
    expires_at: o[2]
  };
  if (o && o.currentSession) o = o.currentSession;
  return o && o.access_token ? o : null;
}
function session() {
  const s = parseSession(readCookieChunks(`sb-${SB_REF}-auth-token`));
  if (s) return s;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (/^sb-.*-auth-token(\.\d+)?$/.test(k)) {
        const t = parseSession(localStorage.getItem(k));
        if (t) return t;
      }
    }
  } catch (e) {}
  return null;
}
function accessToken() {
  const s = session();
  return s ? s.access_token : null;
}

/* التوكن بيقع بعد ساعة. لو الـPOS مقفول في التابات التانية، الجلسة
   ما بتتجددش، والنداء بيرجع 401 برسالة مالهاش معنى. بنكشف ده هنا
   ونقول له يعمل إيه. */
function sessionExpired() {
  const s = session();
  return !!(s && s.expires_at && Number(s.expires_at) * 1000 < Date.now());
}
async function rpc(fn, args) {
  const tok = accessToken();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${tok || ANON_KEY}`
    },
    body: JSON.stringify(args || {})
  });
  const txt = await res.text();
  let data = null;
  try {
    data = txt ? JSON.parse(txt) : null;
  } catch (e) {
    data = txt;
  }
  if (!res.ok) throw new Error(data && (data.message || data.hint) || `HTTP ${res.status}`);
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
const OK_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      img.__url = url;
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("الملف مش قادر يتفتح كصورة"));
    };
    img.src = url;
  });
}
function scaleTo(img, maxDim, quality) {
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error("فشل تجهيز الصورة")), "image/jpeg", quality));
}

/* بترجع النسخة الكبيرة + النسخ الأصغر. النسخة الكبيرة بترفع بالبايت
   بتاعها لو الأصل مظبوط أصلًا — إعادة الترميز خسارة جودة من غير مقابل. */
async function prepareImage(file) {
  const ext = OK_TYPES[file.type];
  if (!ext) throw new Error("ده مش ملف صورة (JPG أو PNG أو WEBP بس)");
  const img = await loadImage(file);
  try {
    const untouched = Math.max(img.width, img.height) <= FULL_DIM && file.size <= KEEP_AS_IS_BYTES;
    const full = untouched ? {
      blob: file,
      ext,
      type: file.type
    } : {
      blob: await scaleTo(img, FULL_DIM, 0.9),
      ext: "jpg",
      type: "image/jpeg"
    };
    const small = {};
    for (const w of RENDITIONS) {
      // مفيش لزوم لنسخة أكبر من الأصل — بتكبر الحجم من غير أي جودة زيادة
      if (Math.max(img.width, img.height) <= w) continue;
      small[w] = {
        blob: await scaleTo(img, w, w <= 400 ? 0.78 : 0.85),
        ext: "jpg",
        type: "image/jpeg"
      };
    }
    return {
      full,
      small,
      untouched,
      w: img.width,
      h: img.height
    };
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
      "Content-Type": type || "image/jpeg",
      apikey: ANON_KEY,
      Authorization: `Bearer ${tok || accessToken() || ANON_KEY}`,
      "x-upsert": "false",
      "cache-control": CACHE_ONE_YEAR
    },
    body: blob
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`رفع الصورة فشل: ${res.status} ${t.slice(0, 120)}`);
  }
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
    try {
      await putObject(p, r.blob, r.type, tok);
      sizes[w] = p;
    } catch (e) {/* نسخة صغيرة فشلت؟ الموقع بيرجع للكبيرة، مش نوقف الرفع */}
  }
  return {
    fullPath,
    sizes
  };
}

/* حذف صورة لازم يشيل ملفاتها من التخزين كمان. من غير ده كل حذف بيسيب
   ملف يتيم بياكل من الـ١ ج.ب المجانية للأبد. */
async function deleteObjects(paths) {
  if (!paths.length) return;
  await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${accessToken() || ANON_KEY}`
    },
    body: JSON.stringify({
      prefixes: paths
    })
  }).catch(() => {});
}
const pathOf = url => {
  const m = String(url || "").split(`/public/${BUCKET}/`)[1];
  return m || null;
};
const fmtSize = b => b >= 1048576 ? `${(b / 1048576).toFixed(1)} م.ب` : `${Math.round(b / 1024)} ك.ب`;

/* سحب مجلد بيدّي DataTransferItem مش File — من غير القراءة دي، رمي مجلد
   على الصفحة مكان بيعمل حاجة خالص وهي ساكتة. */
function readEntry(entry) {
  return new Promise(resolve => {
    if (!entry) return resolve([]);
    if (entry.isFile) return entry.file(f => resolve([f]), () => resolve([]));
    if (entry.isDirectory) {
      const reader = entry.createReader();
      const all = [];
      const step = () => reader.readEntries(async batch => {
        if (!batch.length) {
          const nested = await Promise.all(all.map(readEntry));
          return resolve(nested.flat());
        }
        all.push(...batch);
        step();
      }, () => resolve([]));
      step();
    } else resolve([]);
  });
}
async function filesFromDrop(dt) {
  const items = dt && dt.items ? [...dt.items] : [];
  const entries = items.map(it => it.webkitGetAsEntry ? it.webkitGetAsEntry() : null).filter(Boolean);
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
  "أسود": ["اسود", "أسود", "سودا", "سوداء", "black", "blk"],
  "أبيض": ["ابيض", "أبيض", "بيضا", "بيضاء", "white", "wht"],
  "بيج": ["بيج", "beige", "nude", "بينك بيج"],
  "بني": ["بني", "بنى", "brown", "تان", "tan"],
  "دهبي": ["دهبي", "ذهبي", "دهبى", "gold", "golden"],
  "فضي": ["فضي", "فضى", "silver"],
  "أحمر": ["احمر", "أحمر", "حمرا", "red"],
  "أزرق": ["ازرق", "أزرق", "زرقا", "blue", "navy", "كحلي"],
  "أخضر": ["اخضر", "أخضر", "خضرا", "green"],
  "رمادي": ["رمادي", "رمادى", "جراي", "grey", "gray"],
  "وردي": ["وردي", "وردى", "بينك", "pink", "روز", "rose"],
  "جملي": ["جملي", "جملى", "camel"],
  "نبيتي": ["نبيتي", "نبيتى", "برجندي", "burgundy", "maroon"]
};
const stripName = n => n.replace(/\.[a-z0-9]+$/i, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/[_\-.()\[\]0-9]+/g, " ").toLowerCase();
function guessColor(filename, colors) {
  const hay = " " + stripName(filename) + " ";
  // ١) اسم اللون بحاله في اسم الملف
  for (const c of colors) {
    const norm = stripName(c);
    if (norm && hay.includes(" " + norm + " ")) return c;
  }
  // ٢) مرادف معروف (إنجليزي أو كتابة مختلفة)
  for (const c of colors) {
    const key = Object.keys(COLOR_ALIASES).find(k => stripName(k) === stripName(c));
    for (const alias of COLOR_ALIASES[key] || []) {
      if (hay.includes(" " + stripName(alias) + " ")) return c;
    }
  }
  return null;
}

/* رفع متوازي بسقف ٣ — أسرع بكتير من واحدة ورا واحدة على ٤٠ صورة،
   ومن غير ما يخنق اتصال بيتي أو يرمي الرفعات على بعض. */
async function runPool(items, limit, worker) {
  let idx = 0;
  const runners = Array.from({
    length: Math.min(limit, items.length)
  }, async () => {
    while (idx < items.length) {
      const i = idx++;
      await worker(items[i], i);
    }
  });
  await Promise.all(runners);
}
function toast(msg, kind) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = kind || "";
  el.style.display = "block";
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    el.style.display = "none";
  }, 3200);
}
const GENERIC = "__generic__";

/* ── قائمة المنتجات ───────────────────────────────────────────────
   الترتيب مقصود: اللي محتاج صور فوق. ده هو الطابور، مش قائمة تصفّح. */
function ProductGrid({
  products,
  onOpen,
  filter,
  setFilter,
  tab,
  setTab
}) {
  const q = filter.trim();
  const stateOf = p => {
    const total = (p.colors || []).length;
    const covered = total ? p.colors.filter(c => (p.by_color || {})[c] > 0).length : p.photo_count > 0 ? 1 : 0;
    const target = total || 1;
    if (p.photo_count === 0) return {
      key: "none",
      covered: 0,
      target
    };
    if (covered < target) return {
      key: "partial",
      covered,
      target
    };
    return {
      key: "done",
      covered,
      target
    };
  };
  const withState = products.map(p => ({
    ...p,
    st: stateOf(p)
  }));
  const counts = {
    none: withState.filter(p => p.st.key === "none").length,
    partial: withState.filter(p => p.st.key === "partial").length,
    done: withState.filter(p => p.st.key === "done").length
  };
  let list = withState;
  if (tab !== "all") list = list.filter(p => p.st.key === tab);
  if (q) list = list.filter(p => (p.name || "").includes(q));
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "search-row"
  }, /*#__PURE__*/React.createElement("input", {
    placeholder: "دوّري على موديل…",
    value: filter,
    onChange: e => setFilter(e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    className: "filters"
  }, [["none", "محتاج صور", counts.none], ["partial", "ناقص ألوان", counts.partial], ["done", "تمام", counts.done], ["all", "الكل", withState.length]].map(([k, label, n]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    className: `fchip${tab === k ? " on" : ""}`,
    onClick: () => setTab(k)
  }, label, " (", n, ")"))), tab === "none" && counts.none > 0 && /*#__PURE__*/React.createElement("div", {
    className: "queue-banner"
  }, "ابدئي بـ", /*#__PURE__*/React.createElement("strong", null, "خمسة"), " بس — أحسن خمس موديلات عندك. الموقع بيبيع بالصورة، والموديل من غير صورة زي ما يكون مش موجود."), /*#__PURE__*/React.createElement("div", {
    className: "grid"
  }, list.map(p => {
    const pct = Math.round(p.st.covered / p.st.target * 100);
    return /*#__PURE__*/React.createElement("div", {
      className: `pcard${p.st.key === "done" ? " done" : ""}`,
      key: p.id,
      onClick: () => onOpen(p)
    }, /*#__PURE__*/React.createElement("div", {
      className: "thumb"
    }, p.st.key === "none" && /*#__PURE__*/React.createElement("span", {
      className: "needs"
    }, "محتاج صور"), !p.is_published && /*#__PURE__*/React.createElement("span", {
      className: "pill-hidden"
    }, "مخفي"), p.cover ? /*#__PURE__*/React.createElement("img", {
      src: p.cover_thumb || p.cover,
      alt: "",
      loading: "lazy"
    }) : /*#__PURE__*/React.createElement("span", {
      className: "no-img"
    }, "بلا صورة"), p.photo_count > 0 && /*#__PURE__*/React.createElement("span", {
      className: "ph-count"
    }, p.photo_count, " صورة")), /*#__PURE__*/React.createElement("div", {
      className: "body"
    }, /*#__PURE__*/React.createElement("p", {
      className: "name"
    }, p.name), /*#__PURE__*/React.createElement("p", {
      className: "meta"
    }, (p.colors || []).length ? `${p.st.covered} من ${p.st.target} ألوان` : p.photo_count ? `${p.photo_count} صورة` : "لسه"), /*#__PURE__*/React.createElement("div", {
      className: "bar"
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: `${pct}%`
      }
    }))));
  }), list.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "empty",
    style: {
      gridColumn: "1/-1"
    }
  }, "مفيش موديل هنا")));
}

/* ── محرّر صور منتج واحد ──────────────────────────────────────────
   الفلو: تسحب الصور → تراجعها وألوانها في صينية → ترفع الكل مرة واحدة.
   الترتيب ده مقصود: تصحيح لون قبل الرفع مجاني، وبعد الرفع بيتكلّف
   نداء شبكة لكل صورة. */
function Editor({
  product,
  onClose,
  onChanged
}) {
  const [images, setImages] = useState(product.images || []);
  const colors = product.colors || [];
  const [sel, setSel] = useState(colors.length === 1 ? colors[0] : null);
  const [tray, setTray] = useState([]); // الصور المستنية الرفع
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(0);
  const [over, setOver] = useState(false);
  const [acting, setActing] = useState(null);
  const fileRef = useRef(null);
  const dirRef = useRef(null);
  const countFor = c => images.filter(i => c === GENERIC ? !i.color : i.color === c).length;
  const firstFor = c => images.find(i => c === GENERIC ? !i.color : i.color === c);
  const shown = sel === null ? images : images.filter(i => sel === GENERIC ? !i.color : i.color === sel);

  // لصق من الكليببورد — أسرع طريقة لصورة واحدة على الديسكتوب
  useEffect(() => {
    const onPaste = e => {
      const files = [...(e.clipboardData?.files || [])];
      if (files.length) {
        e.preventDefault();
        addToTray(files);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });
  const addToTray = useCallback(async fileList => {
    const incoming = Array.from(fileList || []).filter(Boolean);
    if (!incoming.length) return;

    // نوع مش مدعوم بيترفض هنا، مش بعد ما يقف في الصينية ويفشل عند الرفع.
    // صور الآيفون HEIC أشهر حالة — الرسالة لازم تقول له يعمل إيه.
    const wrongType = incoming.filter(f => !OK_TYPES[f.type]);
    const usable = incoming.filter(f => OK_TYPES[f.type]);
    setTray(t => {
      // نفس الملف مرتين (رمي نفس المجلد تاني) بيتخطّى بدل ما يتكرّر على الموقع
      const seen = new Set(t.map(r => `${r.file.name}|${r.file.size}`));
      const fresh = [];
      let dupes = 0;
      for (const file of usable) {
        const sig = `${file.name}|${file.size}`;
        if (seen.has(sig)) {
          dupes++;
          continue;
        }
        seen.add(sig);
        const guessed = colors.length ? guessColor(file.name, colors) : null;
        fresh.push({
          key: crypto.randomUUID(),
          file,
          preview: URL.createObjectURL(file),
          // الأولوية: تخمين من اسم الملف، وإلا اللون المفتوح دلوقتي
          color: guessed || (sel && sel !== GENERIC ? sel : ""),
          guessed: !!guessed,
          size: file.size,
          status: "ready",
          error: ""
        });
      }
      if (wrongType.length) {
        const heic = wrongType.some(f => /hei[cf]/i.test(f.type) || /\.hei[cf]$/i.test(f.name));
        toast(heic ? `${wrongType.length} صورة بصيغة HEIC — حوّلها لـJPG الأول` : `${wrongType.length} ملف مش صورة مدعومة (JPG/PNG/WEBP بس)`, "err");
      } else if (dupes && !fresh.length) {
        toast("الصور دي موجودة في القايمة أصلًا", "err");
      } else if (dupes) {
        toast(`اتخطّت ${dupes} صورة مكرّرة`);
      }
      return [...t, ...fresh];
    });
  }, [colors, sel]);
  const setTrayColor = (key, color) => setTray(t => t.map(r => r.key === key ? {
    ...r,
    color,
    guessed: false
  } : r));
  const applyToAll = color => setTray(t => t.map(r => ({
    ...r,
    color,
    guessed: false
  })));
  const dropFromTray = key => setTray(t => {
    const row = t.find(r => r.key === key);
    if (row) URL.revokeObjectURL(row.preview);
    return t.filter(r => r.key !== key);
  });

  // ٤٠ صورة = ٤٠ blob URL محجوزة في الذاكرة لحد ما التاب يتقفل.
  const trayRef = useRef([]);
  useEffect(() => {
    trayRef.current = tray;
  }, [tray]);
  useEffect(() => () => trayRef.current.forEach(r => URL.revokeObjectURL(r.preview)), []);
  const untagged = colors.length ? tray.filter(r => !r.color).length : 0;
  const uploadAll = async () => {
    if (!tray.length || uploading) return;
    if (untagged > 0) {
      toast(`${untagged} صورة لسه من غير لون — حدّديه أو خليها «عامة»`, "err");
      return;
    }
    setUploading(true);
    setDone(0);
    const results = [];
    await runPool(tray, 3, async row => {
      try {
        const prep = await prepareImage(row.file);
        const {
          fullPath,
          sizes
        } = await uploadShot(product.id, prep);
        const res = await rpc("shop_fn_attach_product_image", {
          p_product_id: product.id,
          p_path: fullPath,
          p_color: row.color && row.color !== GENERIC ? row.color : null,
          p_sizes: Object.keys(sizes).length ? sizes : null,
          // الأصل الحقيقي للصورة على جهازك. الاسم ده بيتحفظ في النسخة
          // الاحتياطية عشان لو التخزين ضاع، تعرف أنهي ملف يرجع لأنهي
          // منتج ولون بدل ما تخمّن على مئات الملفات.
          p_original_name: row.file.name
        });
        if (!res || res.ok === false) throw new Error(res && res.error || "فشل الحفظ");
        results.push({
          key: row.key,
          ok: true,
          img: {
            id: res.id,
            url: res.url,
            color: row.color === GENERIC ? null : row.color
          }
        });
      } catch (e) {
        results.push({
          key: row.key,
          ok: false,
          error: e.message || "فشل الرفع"
        });
      } finally {
        setDone(d => d + 1);
      }
    });
    const good = results.filter(r => r.ok);
    const bad = results.filter(r => !r.ok);
    if (good.length) {
      good.forEach(r => {
        const row = tray.find(x => x.key === r.key);
        if (row) URL.revokeObjectURL(row.preview);
      });
      // نقرا من السيرفر بدل ما نبني الحالة محليًا: الغلاف والترتيب بيتحدّدوا
      // هناك (أول صورة بتبقى الغلاف تلقائيًا)، والتخمين هنا كان بيوريه غلط.
      try {
        const fresh = await rpc("shop_fn_admin_product_images", {
          p_product_id: product.id
        });
        setImages(Array.isArray(fresh) ? fresh : []);
      } catch (e) {
        setImages(imgs => [...imgs, ...good.map(r => r.img)]);
      }
    }
    // الناجح بيختفي من الصينية، والفاشل بيفضل ومعاه سببه عشان يتعاد
    setTray(t => t.filter(r => bad.some(b => b.key === r.key)).map(r => {
      const b = bad.find(x => x.key === r.key);
      return {
        ...r,
        status: "error",
        error: b ? b.error : ""
      };
    }));
    setUploading(false);
    onChanged();
    if (bad.length === 0) toast(`اترفعت ${good.length} صورة ✓`, "ok");else toast(`اترفع ${good.length} — فضل ${bad.length} فيهم مشكلة`, "err");
  };
  const removeImage = async img => {
    if (!confirm("تأكيد حذف الصورة؟")) return;
    try {
      const res = await rpc("shop_fn_remove_product_image", {
        p_image_id: img.id
      });
      if (!res || res.ok === false) throw new Error(res && res.error || "فشل الحذف");
      // الصف اتمسح — الملفات كمان، وإلا بتفضل تاكل من المساحة للأبد
      await deleteObjects([pathOf(img.url), ...Object.values(img.sizes || {}).map(pathOf)].filter(Boolean));
      setImages(imgs => imgs.filter(i => i.id !== img.id));
      setActing(null);
      onChanged();
    } catch (e) {
      toast(e.message, "err");
    }
  };
  const retag = async (img, color) => {
    try {
      const res = await rpc("shop_fn_update_product_image", {
        p_image_id: img.id,
        p_color: color === GENERIC ? null : color,
        p_clear_color: color === GENERIC
      });
      if (!res || res.ok === false) throw new Error(res && res.error || "فشل التعديل");
      setImages(imgs => imgs.map(i => i.id === img.id ? {
        ...i,
        color: color === GENERIC ? null : color
      } : i));
      setActing(null);
      onChanged();
      toast("اتظبط ✓", "ok");
    } catch (e) {
      toast(e.message, "err");
    }
  };
  const makeCover = async img => {
    try {
      const res = await rpc("shop_fn_update_product_image", {
        p_image_id: img.id,
        p_make_cover: true
      });
      if (!res || res.ok === false) throw new Error(res && res.error || "فشل التعديل");
      setImages(imgs => imgs.map(i => ({
        ...i,
        is_cover: i.id === img.id
      })));
      setActing(null);
      onChanged();
      toast("بقت صورة الغلاف ✓", "ok");
    } catch (e) {
      toast(e.message, "err");
    }
  };

  // نقل صورة لأول اللون: أول صورة هي اللي العميلة بتشوفها فورًا
  const moveFirst = async img => {
    try {
      const minSort = Math.min(...images.map(i => i.sort ?? 0), 0);
      const res = await rpc("shop_fn_update_product_image", {
        p_image_id: img.id,
        p_sort: minSort - 1
      });
      if (!res || res.ok === false) throw new Error(res && res.error || "فشل التعديل");
      setImages(imgs => [img, ...imgs.filter(i => i.id !== img.id)].map((i, n) => ({
        ...i,
        sort: n
      })));
      setActing(null);
      onChanged();
      toast("بقت أول صورة ✓", "ok");
    } catch (e) {
      toast(e.message, "err");
    }
  };
  const missing = colors.filter(c => countFor(c) === 0);
  const guessedCount = tray.filter(r => r.guessed).length;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "veil on",
    onClick: uploading ? undefined : onClose
  }), /*#__PURE__*/React.createElement("div", {
    className: "sheet on"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sheet-inner"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sheet-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", null, product.name), /*#__PURE__*/React.createElement("p", {
    className: "sub"
  }, product.category || "—", !product.is_published && " · مخفي عن الموقع")), /*#__PURE__*/React.createElement("button", {
    className: "sheet-close",
    onClick: onClose,
    disabled: uploading
  }, "✕")), colors.length > 0 ? /*#__PURE__*/React.createElement(React.Fragment, null, missing.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "warnbox"
  }, "لسه من غير صور: ", /*#__PURE__*/React.createElement("strong", null, missing.join("، ")), ". العميلة لما تختار لون من دول هتشوف صورة لون تاني."), /*#__PURE__*/React.createElement("div", {
    className: "clist"
  }, colors.map(c => {
    const n = countFor(c);
    const f = firstFor(c);
    return /*#__PURE__*/React.createElement("div", {
      key: c,
      className: `crow${sel === c ? " on" : ""}`,
      onClick: () => setSel(c)
    }, f ? /*#__PURE__*/React.createElement("img", {
      className: "cthumb",
      src: f.thumb || f.url,
      alt: ""
    }) : /*#__PURE__*/React.createElement("span", {
      className: "cthumb empty"
    }, "＋"), /*#__PURE__*/React.createElement("span", {
      className: "cname"
    }, c), /*#__PURE__*/React.createElement("span", {
      className: `ccount${n ? " has" : ""}`
    }, n ? `${n} صورة` : "لسه"));
  }), /*#__PURE__*/React.createElement("div", {
    className: `crow${sel === GENERIC ? " on" : ""}`,
    onClick: () => setSel(GENERIC)
  }, firstFor(GENERIC) ? /*#__PURE__*/React.createElement("img", {
    className: "cthumb",
    src: firstFor(GENERIC).thumb || firstFor(GENERIC).url,
    alt: ""
  }) : /*#__PURE__*/React.createElement("span", {
    className: "cthumb empty"
  }, "＋"), /*#__PURE__*/React.createElement("span", {
    className: "cname"
  }, "صور عامة (كل الألوان)"), /*#__PURE__*/React.createElement("span", {
    className: `ccount${countFor(GENERIC) ? " has" : ""}`
  }, countFor(GENERIC) ? `${countFor(GENERIC)} صورة` : "لسه")))) : /*#__PURE__*/React.createElement("div", {
    className: "tip"
  }, "الموديل ده مسجّل من غير ألوان في المخزون، فالصور هتبقى عامة لكل الموديل."), /*#__PURE__*/React.createElement("div", {
    className: `drop${over ? " over" : ""}`,
    onClick: () => fileRef.current && fileRef.current.click(),
    onDragOver: e => {
      e.preventDefault();
      setOver(true);
    },
    onDragLeave: () => setOver(false),
    onDrop: async e => {
      e.preventDefault();
      setOver(false);
      addToTray(await filesFromDrop(e.dataTransfer));
    }
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 16V4m0 0L8 8m4-4 4 4",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3",
    strokeLinecap: "round"
  })), /*#__PURE__*/React.createElement("p", {
    className: "big"
  }, "اسحب الصور هنا أو اضغط للاختيار"), /*#__PURE__*/React.createElement("p", {
    className: "small"
  }, "تقدر ترمي مجلد كامل، أو تعمل لصق (Ctrl+V). JPG أو PNG أو WEBP."), /*#__PURE__*/React.createElement("button", {
    className: "btn-ghost btn-sm",
    style: {
      marginTop: 10
    },
    onClick: e => {
      e.stopPropagation();
      dirRef.current && dirRef.current.click();
    }
  }, "أو اختار مجلد من الجهاز")), /*#__PURE__*/React.createElement("input", {
    ref: fileRef,
    type: "file",
    accept: "image/jpeg,image/png,image/webp",
    multiple: true,
    style: {
      display: "none"
    },
    onChange: e => {
      addToTray(e.target.files);
      e.target.value = "";
    }
  }), /*#__PURE__*/React.createElement("input", {
    ref: dirRef,
    type: "file",
    multiple: true,
    webkitdirectory: "",
    directory: "",
    style: {
      display: "none"
    },
    onChange: e => {
      addToTray(e.target.files);
      e.target.value = "";
    }
  }), tray.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "tray"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tray-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", null, tray.length, " صورة جاهزة للرفع"), guessedCount > 0 && /*#__PURE__*/React.createElement("p", {
    className: "sub",
    style: {
      margin: 0
    }
  }, "خمّنت لون ", guessedCount, " منهم من اسم الملف — راجعيهم بسرعة.")), colors.length > 0 && /*#__PURE__*/React.createElement("select", {
    style: {
      width: "auto",
      minWidth: 150
    },
    disabled: uploading,
    onChange: e => {
      if (e.target.value) applyToAll(e.target.value);
      e.target.value = "";
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "طبّق لون على الكل…"), colors.map(c => /*#__PURE__*/React.createElement("option", {
    key: c,
    value: c
  }, c)), /*#__PURE__*/React.createElement("option", {
    value: GENERIC
  }, "عامة (كل الألوان)"))), /*#__PURE__*/React.createElement("div", {
    className: "tray-grid"
  }, tray.map(r => /*#__PURE__*/React.createElement("div", {
    className: `tcard${r.status === "error" ? " err" : ""}`,
    key: r.key
  }, /*#__PURE__*/React.createElement("img", {
    src: r.preview,
    alt: ""
  }), r.guessed && /*#__PURE__*/React.createElement("span", {
    className: "guess"
  }, "تخمين"), /*#__PURE__*/React.createElement("span", {
    className: "sz"
  }, fmtSize(r.size)), !uploading && /*#__PURE__*/React.createElement("button", {
    className: "x",
    onClick: () => dropFromTray(r.key)
  }, "✕"), colors.length > 0 ? /*#__PURE__*/React.createElement("select", {
    value: r.color,
    disabled: uploading,
    onChange: e => setTrayColor(r.key, e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "— اختاري اللون —"), colors.map(c => /*#__PURE__*/React.createElement("option", {
    key: c,
    value: c
  }, c)), /*#__PURE__*/React.createElement("option", {
    value: GENERIC
  }, "عامة")) : /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      padding: "6px 7px",
      color: "var(--muted)"
    }
  }, "عامة"), r.status === "error" && /*#__PURE__*/React.createElement("div", {
    className: "bad"
  }, r.error)))), uploading && /*#__PURE__*/React.createElement("div", {
    className: "tprog"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: `${Math.round(done / tray.length * 100)}%`
    }
  }))), /*#__PURE__*/React.createElement("div", {
    className: "tip"
  }, "من كل صورة بيتعمل ٣ نسخ تلقائيًا: صغيرة للشبكة، متوسطة للموبايل، وكبيرة للشاشات الكبيرة — العميلة بتحمّل المناسب لشاشتها بس. دوسي على أي صورة مرفوعة عشان تغيّري لونها أو تخليها الغلاف."), /*#__PURE__*/React.createElement("div", {
    className: "shot-grid"
  }, shown.map(img => /*#__PURE__*/React.createElement("div", {
    className: `shot${img.is_cover ? " cover" : ""}`,
    key: img.id,
    onClick: () => setActing(img)
  }, /*#__PURE__*/React.createElement("img", {
    src: img.thumb || img.url,
    alt: "",
    loading: "lazy"
  }), img.is_cover && /*#__PURE__*/React.createElement("span", {
    className: "cov"
  }, "الغلاف"), /*#__PURE__*/React.createElement("span", {
    className: "color-tag"
  }, img.color || "عام"))), shown.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "empty",
    style: {
      gridColumn: "1/-1"
    }
  }, sel ? "مفيش صور للاختيار ده لسه" : "مفيش صور لسه"))), /*#__PURE__*/React.createElement("div", {
    className: "stickybar"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn-primary",
    onClick: uploadAll,
    disabled: !tray.length || uploading
  }, uploading ? `بيرفع… ${done} من ${tray.length}` : tray.length ? `ارفع ${tray.length} صورة` : "اسحب الصور فوق عشان تبدأ"))), acting && /*#__PURE__*/React.createElement("div", {
    className: "pactions",
    onClick: () => setActing(null)
  }, /*#__PURE__*/React.createElement("div", {
    className: "pabox",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("h3", null, "الصورة دي"), /*#__PURE__*/React.createElement("p", {
    className: "sub",
    style: {
      marginBottom: 12
    }
  }, "اللون الحالي: ", acting.color || "عام (كل الألوان)"), !acting.is_cover && /*#__PURE__*/React.createElement("button", {
    className: "pa-btn",
    onClick: () => makeCover(acting)
  }, "خليها صورة الغلاف"), /*#__PURE__*/React.createElement("button", {
    className: "pa-btn",
    onClick: () => moveFirst(acting)
  }, "خليها أول صورة"), colors.filter(c => c !== acting.color).map(c => /*#__PURE__*/React.createElement("button", {
    key: c,
    className: "pa-btn",
    onClick: () => retag(acting, c)
  }, "غيّر اللون لـ «", c, "»")), acting.color && /*#__PURE__*/React.createElement("button", {
    className: "pa-btn",
    onClick: () => retag(acting, GENERIC)
  }, "خليها عامة (كل الألوان)"), /*#__PURE__*/React.createElement("button", {
    className: "pa-btn danger",
    onClick: () => removeImage(acting)
  }, "احذف الصورة"), /*#__PURE__*/React.createElement("button", {
    className: "pa-btn",
    onClick: () => setActing(null)
  }, "إلغاء"))));
}
function App() {
  const [products, setProducts] = useState(null);
  const [filter, setFilter] = useState("");
  const [tab, setTab] = useState("none");
  const [open, setOpen] = useState(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      // طابور إداري: بيشمل غير المنشور كمان — ده بالظبط اللي بيتصوّر
      // قبل ما ينزل الموقع. الكتالوج العام كان بيخفيه.
      const rows = await rpc("shop_fn_admin_photo_queue", {
        p_q: null
      });
      setProducts(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setError(e.message || "تعذّر تحميل المنتجات");
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const openProduct = async p => {
    try {
      const imgs = await rpc("shop_fn_admin_product_images", {
        p_product_id: p.id
      });
      setOpen({
        ...p,
        images: imgs || []
      });
    } catch (e) {
      toast(e.message, "err");
    }
  };
  if (error) return /*#__PURE__*/React.createElement("div", {
    className: "center"
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      color: "var(--danger)"
    }
  }, error));
  if (!products) return /*#__PURE__*/React.createElement("div", {
    className: "center"
  }, /*#__PURE__*/React.createElement("div", {
    className: "spin-big"
  }), /*#__PURE__*/React.createElement("p", {
    className: "muted"
  }, "جارٍ التحميل…"));
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(ProductGrid, {
    products: products,
    filter: filter,
    setFilter: setFilter,
    tab: tab,
    setTab: setTab,
    onOpen: openProduct
  }), open && /*#__PURE__*/React.createElement(Editor, {
    product: open,
    onClose: () => {
      setOpen(null);
      load();
    },
    onChanged: load
  }));
}
ReactDOM.createRoot(document.getElementById("app")).render(/*#__PURE__*/React.createElement(App, null));