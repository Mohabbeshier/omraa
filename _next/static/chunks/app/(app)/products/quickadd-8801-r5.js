(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[8811],{88811:(e,t,s)=>{"use strict";s.r(t),s.d(t,{default:()=>QuickAddModal});var n=s(12115);

const BASE_COLORS = [{
  name: "أسود",
  hex: "#111827"
}, {
  name: "أبيض",
  hex: "#f8fafc"
}, {
  name: "أحمر",
  hex: "#dc2626"
}, {
  name: "أزرق",
  hex: "#2563eb"
}, {
  name: "بني",
  hex: "#78350f"
}, {
  name: "بيج",
  hex: "#d6c7a1"
}, {
  name: "كحلي",
  hex: "#1e3a5f"
}, {
  name: "رمادي",
  hex: "#6b7280"
}, {
  name: "جملي",
  hex: "#c19a6b"
}, {
  name: "فضي",
  hex: "#c0c0c0"
}];
const BASE_SIZES = ["36", "37", "38", "39", "40", "41", "42", "43"];

// ---- مولّد أسماء موديلات (client-side بالكامل، بدون أي API خارجي) ----
const NAME_TYPES = ["سليبر", "سواريه", "حذاء", "هيلز", "صندل", "شبشب", "بلارينا", "سابوه", "كلاسيك"];
const NAME_MATERIALS = ["بدون", "جلد طبيعي", "دانتيل", "شفاف", "قماش", "جلد لامع", "مخمل", "ستان", "شعر", "كريستال"];
const NAME_HEELS = ["بدون", "فلات", "3 سم", "5 سم", "7 سم", "كتلة"];

// توحيد الاسم العربي للمقارنة: إزالة التشكيل والتطويل، توحيد أشكال الألف/الياء،
// وتقليص المسافات — نفس منطق shop.norm_ar المستخدم في قاعدة البيانات.
function normalizeAr(str) {
  return (str || "").replace(/[\u064B-\u0652\u0670\u0640]/g, "") // تشكيل + تطويل
  .replace(/[إأآا]/g, "ا").replace(/ى/g, "ي").replace(/\s+/g, " ").trim().toLowerCase();
}
function buildSuggestedName(type, material, heel, existingNormSet) {
  const parts = [type, material !== "بدون" ? material : null, heel !== "بدون" ? heel : null].filter(Boolean);
  const base = parts.join(" ").trim();
  if (!base) return "";
  if (!existingNormSet.has(normalizeAr(base))) return base;
  for (let n = 2; n <= 50; n++) {
    const candidate = base + " " + n;
    if (!existingNormSet.has(normalizeAr(candidate))) return candidate;
  }
  return base;
}
function QuickAddModal(props) {
  const {
    open,
    onClose,
    onSaved,
    supabase,
    cloneData
  } = props;
  const [step, setStep] = n.useState(1);
  const [name, setName] = n.useState("");
  const [categories, setCategories] = n.useState(["عام"]);
  const [category, setCategory] = n.useState("عام");
  const [knownColors, setKnownColors] = n.useState([]);
  const [knownSizes, setKnownSizes] = n.useState([]);
  const [brand, setBrand] = n.useState("");
  const [sellPrice, setSellPrice] = n.useState("");
  const [costPrice, setCostPrice] = n.useState("");
  const [sku, setSku] = n.useState("");
  const [selectedColors, setSelectedColors] = n.useState([]);
  const [customColor, setCustomColor] = n.useState("");
  const [selectedSizes, setSelectedSizes] = n.useState([]);
  const [customSize, setCustomSize] = n.useState("");
  const [matrix, setMatrix] = n.useState({});
  const [saving, setSaving] = n.useState(false);
  const [error, setError] = n.useState("");
  const [lastCreated, setLastCreated] = n.useState(null);
  const [existingNames, setExistingNames] = n.useState([]);
  const [dupConfirmed, setDupConfirmed] = n.useState(false);
  const [showAssistant, setShowAssistant] = n.useState(false);
  const [nameType, setNameType] = n.useState(NAME_TYPES[0]);
  const [nameMaterial, setNameMaterial] = n.useState("بدون");
  const [nameHeel, setNameHeel] = n.useState("بدون");
  n.useEffect(() => {
    if (open) {
      setStep(1);
      if (cloneData) {
        setName(cloneData.name ? cloneData.name + " (نسخة)" : "");
        setBrand(cloneData.brand || "");
        setSellPrice(cloneData.sell_price != null ? String(cloneData.sell_price) : "");
        setCostPrice("");
        setCategory(cloneData.category || "عام");
      } else {
        setName("");
        setBrand("");
        setSellPrice("");
        setCostPrice("");
      }
      setSku("");
      setSelectedColors([]);
      setCustomColor("");
      setSelectedSizes([]);
      setCustomSize("");
      setMatrix({});
      setError("");
      setLastCreated(null);
      setExistingNames([]);
      setDupConfirmed(false);
      setShowAssistant(false);
      setNameType(NAME_TYPES[0]);
      setNameMaterial("بدون");
      setNameHeel("بدون");
      // جلب بيانات ذاتية: الفئات المتاحة + الألوان/المقاسات المستخدمة فعلياً في المتجر
      supabase.from("pos_app_settings").select("categories").maybeSingle().then(({
        data
      }) => {
        if (data && data.categories && data.categories.length) {
          setCategories(data.categories);
          if (!cloneData) setCategory(data.categories[0]);
        }
      });
      supabase.rpc("pos_fn_known_variants").then(({
        data
      }) => {
        if (data) {
          setKnownColors(data.colors || []);
          setKnownSizes(data.sizes || []);
        }
      });
      // أسماء المنتجات الحالية — تُستخدم لكشف التكرار ولتوليد اقتراحات فريدة،
      // بالكامل client-side، بدون أي استدعاء خارجي أو تكلفة إضافية.
      supabase.from("pos_products").select("name").then(({
        data
      }) => {
        if (data) setExistingNames(data.map(r => r.name).filter(Boolean));
      });
    }
  }, [open, supabase, cloneData]);
  if (!open) return null;
  const existingNormSet = new Set(existingNames.map(normalizeAr));
  const normalizedName = normalizeAr(name);
  const duplicateNames = normalizedName ? existingNames.filter(n => normalizeAr(n) === normalizedName) : [];
  const suggestedName = buildSuggestedName(nameType, nameMaterial, nameHeel, existingNormSet);
  const colorPool = [...new Set([...BASE_COLORS.map(c => c.name), ...(knownColors || [])])];
  const sizePool = [...new Set([...BASE_SIZES, ...(knownSizes || [])])].sort((a, b) => {
    const na = Number(a),
      nb = Number(b);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return String(a).localeCompare(String(b), "ar");
  });
  function colorHex(nm) {
    const f = BASE_COLORS.find(c => c.name === nm);
    return f ? f.hex : "#9ca3af";
  }
  function setNameAndClearDup(v) {
    setName(v);
    setDupConfirmed(false);
  }
  function useSuggestedName() {
    if (suggestedName) setNameAndClearDup(suggestedName);
  }
  function toggleColor(c) {
    setSelectedColors(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  }
  function toggleSize(sz) {
    setSelectedSizes(prev => prev.includes(sz) ? prev.filter(x => x !== sz) : [...prev, sz]);
  }
  function addCustomColor() {
    const v = customColor.trim();
    if (v && !selectedColors.includes(v)) {
      setSelectedColors(prev => [...prev, v]);
      setCustomColor("");
    }
  }
  function addCustomSize() {
    const v = customSize.trim();
    if (v && !selectedSizes.includes(v)) {
      setSelectedSizes(prev => [...prev, v]);
      setCustomSize("");
    }
  }
  function matrixKey(sz, cl) {
    return sz + "__" + cl;
  }
  function setQty(sz, cl, val) {
    const v = Math.max(0, Math.min(999, Number(val) || 0));
    setMatrix(prev => ({
      ...prev,
      [matrixKey(sz, cl)]: v
    }));
  }
  function getQty(sz, cl) {
    return matrix[matrixKey(sz, cl)] || 0;
  }
  const totalPieces = Object.values(matrix).reduce((a, b) => a + (Number(b) || 0), 0);
  const sell = Number(sellPrice) || 0;
  const cost = Number(costPrice) || 0;
  const margin = sell > 0 ? (sell - cost) / sell * 100 : 0;
  const marginColor = margin >= 30 ? "text-green-600" : margin >= 15 ? "text-amber-600" : cost > 0 ? "text-rose-600" : "text-slate-400";
  const marginLabel = cost === 0 ? "—" : margin.toFixed(0) + "%";
  function canGoStep2() {
    return name.trim().length > 0 && sell > 0;
  }
  function canGoStep3() {
    return selectedColors.length > 0 && selectedSizes.length > 0 && totalPieces > 0;
  }
  async function save() {
    setError("");
    if (!canGoStep2()) {
      setError("الاسم والسعر مطلوبان");
      setStep(1);
      return;
    }
    if (!canGoStep3()) {
      setError("حدد لون ومقاس وكمية واحدة على الأقل");
      setStep(2);
      return;
    }
    if (duplicateNames.length > 0 && !dupConfirmed) {
      setDupConfirmed(true);
      setError('فيه منتج بنفس الاسم "' + name.trim() + '" بالظبط بالفعل — اضغط "حفظ المنتج" تاني للتأكيد، أو غيّر الاسم');
      setStep(1);
      return;
    }
    setSaving(true);
    try {
      const variants = [];
      selectedSizes.forEach(sz => {
        selectedColors.forEach(cl => {
          const q = getQty(sz, cl);
          if (q > 0) variants.push({
            size: sz,
            color: cl,
            qty: q
          });
        });
      });
      const {
        data,
        error: err
      } = await supabase.rpc("pos_fn_create_product_full", {
        p_name: name.trim(),
        p_category: category,
        p_sell: sell,
        p_cost: cost > 0 ? cost : null,
        p_brand: brand.trim() || null,
        p_sku: sku.trim() || null,
        // ⚠️ لازم array حقيقي وليس نص JSON — pos.fn_create_product_full بيستخدم
        // jsonb_array_elements(p_variants) واللي بيتوقع jsonb array فعلي، مش
        // scalar string. JSON.stringify هنا كان يكسر إنشاء أي منتج جديد.
        p_variants: variants
      });
      if (err) {
        setError(err.message);
        setSaving(false);
        return;
      }
      setLastCreated(data);
      setSaving(false);
      onSaved && onSaved(data);
    } catch (e) {
      setError("حدث خطأ غير متوقع");
      setSaving(false);
    }
  }
  function cloneForNext() {
    setStep(1);
    setName("");
    setSellPrice("");
    setCostPrice("");
    setSku("");
    setSelectedColors([]);
    setSelectedSizes([]);
    setMatrix({});
    setLastCreated(null);
    setError("");
    setDupConfirmed(false);
  }
  function nextStep() {
    if (step === 1 && !canGoStep2()) {
      setError("الاسم والسعر مطلوبان");
      return;
    }
    if (step === 2 && !canGoStep3()) {
      setError("حدد لون ومقاس وكمية واحدة على الأقل");
      return;
    }
    setError("");
    setStep(step + 1);
  }
  return /*#__PURE__*/n.createElement("div", {
    className: "fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-3",
    onClick: onClose
  }, /*#__PURE__*/n.createElement("div", {
    className: "bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/n.createElement("div", {
    className: "sticky top-0 bg-white border-b border-slate-100 p-4 flex items-center justify-between z-10"
  }, /*#__PURE__*/n.createElement("div", null, /*#__PURE__*/n.createElement("h2", {
    className: "font-bold text-slate-900 flex items-center gap-2"
  }, "⚡ إضافة سريعة"), /*#__PURE__*/n.createElement("div", {
    className: "flex gap-1.5 mt-1.5"
  }, [1, 2, 3].map(stepN => /*#__PURE__*/n.createElement("span", {
    key: stepN,
    className: "h-1.5 rounded-full transition-all " + (stepN === step ? "w-8 bg-indigo-600" : stepN < step ? "w-4 bg-indigo-300" : "w-4 bg-slate-200")
  })))), /*#__PURE__*/n.createElement("button", {
    onClick: onClose,
    className: "text-slate-400 hover:text-slate-600 p-1"
  }, "✕")), /*#__PURE__*/n.createElement("div", {
    className: "p-4 space-y-4"
  }, cloneData && !lastCreated && /*#__PURE__*/n.createElement("div", {
    className: "bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs rounded-xl p-2.5"
  }, "📋 نسخ من \"", cloneData.name, "\" — البيانات الأساسية مُعبّاة، حدد الكميات الجديدة"), error && /*#__PURE__*/n.createElement("div", {
    className: "bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl p-3"
  }, error), lastCreated ? /*#__PURE__*/n.createElement("div", {
    className: "text-center py-6 space-y-3"
  }, /*#__PURE__*/n.createElement("div", {
    className: "text-4xl"
  }, "✅"), /*#__PURE__*/n.createElement("p", {
    className: "font-semibold text-slate-900"
  }, "تم إضافة \"", name, "\" بنجاح"), /*#__PURE__*/n.createElement("p", {
    className: "text-sm text-slate-500"
  }, lastCreated.items_created, " قطعة · SKU: ", lastCreated.sku), /*#__PURE__*/n.createElement("div", {
    className: "flex gap-2 justify-center pt-2"
  }, /*#__PURE__*/n.createElement("button", {
    onClick: cloneForNext,
    className: "btn-primary text-sm px-4"
  }, "➕ منتج آخر"), /*#__PURE__*/n.createElement("button", {
    onClick: onClose,
    className: "text-sm text-slate-500 px-4 py-2"
  }, "إغلاق"))) : /*#__PURE__*/n.createElement(n.Fragment, null, step === 1 && /*#__PURE__*/n.createElement("div", {
    className: "space-y-3"
  }, /*#__PURE__*/n.createElement("div", null, /*#__PURE__*/n.createElement("div", {
    className: "flex items-center justify-between mb-1"
  }, /*#__PURE__*/n.createElement("label", {
    className: "text-xs text-slate-500 block"
  }, "اسم المنتج *"), /*#__PURE__*/n.createElement("button", {
    type: "button",
    onClick: () => setShowAssistant(v => !v),
    className: "text-xs text-indigo-600 hover:text-indigo-700"
  }, "🧠 ", showAssistant ? "إخفاء المساعد" : "مساعد اسم الموديل")), /*#__PURE__*/n.createElement("input", {
    autoFocus: true,
    value: name,
    onChange: e => setNameAndClearDup(e.target.value),
    className: "w-full text-sm",
    placeholder: "مثال: حذاء طبي مخيط"
  }), duplicateNames.length > 0 && /*#__PURE__*/n.createElement("div", {
    className: "mt-1.5 text-xs bg-amber-50 border border-amber-200 text-amber-700 rounded-lg p-2"
  }, "⚠️ فيه ", duplicateNames.length, " منتج بنفس الاسم بالظبط بالفعل. لو مش مقصود، غيّر الاسم أو استخدم المساعد تحت."), showAssistant && /*#__PURE__*/n.createElement("div", {
    className: "mt-2 bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2"
  }, /*#__PURE__*/n.createElement("div", {
    className: "grid grid-cols-3 gap-2"
  }, /*#__PURE__*/n.createElement("div", null, /*#__PURE__*/n.createElement("label", {
    className: "text-[10px] text-slate-400 mb-0.5 block"
  }, "النوع"), /*#__PURE__*/n.createElement("select", {
    value: nameType,
    onChange: e => setNameType(e.target.value),
    className: "w-full text-xs py-1"
  }, NAME_TYPES.map(t => /*#__PURE__*/n.createElement("option", {
    key: t,
    value: t
  }, t)))), /*#__PURE__*/n.createElement("div", null, /*#__PURE__*/n.createElement("label", {
    className: "text-[10px] text-slate-400 mb-0.5 block"
  }, "الخامة"), /*#__PURE__*/n.createElement("select", {
    value: nameMaterial,
    onChange: e => setNameMaterial(e.target.value),
    className: "w-full text-xs py-1"
  }, NAME_MATERIALS.map(m => /*#__PURE__*/n.createElement("option", {
    key: m,
    value: m
  }, m)))), /*#__PURE__*/n.createElement("div", null, /*#__PURE__*/n.createElement("label", {
    className: "text-[10px] text-slate-400 mb-0.5 block"
  }, "الكعب"), /*#__PURE__*/n.createElement("select", {
    value: nameHeel,
    onChange: e => setNameHeel(e.target.value),
    className: "w-full text-xs py-1"
  }, NAME_HEELS.map(h => /*#__PURE__*/n.createElement("option", {
    key: h,
    value: h
  }, h))))), /*#__PURE__*/n.createElement("div", {
    className: "flex items-center justify-between gap-2 pt-1"
  }, /*#__PURE__*/n.createElement("span", {
    className: "text-xs text-slate-600 font-medium truncate"
  }, suggestedName || "—"), /*#__PURE__*/n.createElement("button", {
    type: "button",
    onClick: useSuggestedName,
    disabled: !suggestedName,
    className: "text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg disabled:opacity-40 shrink-0"
  }, "استخدام هذا الاسم")), /*#__PURE__*/n.createElement("p", {
    className: "text-[10px] text-slate-400"
  }, "الاقتراح يتولّد تلقائيًا من (النوع + الخامة + الكعب)، ولو الاسم مكرر بيضيف رقم تسلسلي تلقائيًا — كله محليًا بدون أي تكلفة."))), /*#__PURE__*/n.createElement("div", {
    className: "grid grid-cols-2 gap-3"
  }, /*#__PURE__*/n.createElement("div", null, /*#__PURE__*/n.createElement("label", {
    className: "text-xs text-slate-500 mb-1 block"
  }, "الفئة"), /*#__PURE__*/n.createElement("select", {
    value: category,
    onChange: e => setCategory(e.target.value),
    className: "w-full text-sm"
  }, (categories || ["عام"]).map(c => /*#__PURE__*/n.createElement("option", {
    key: c,
    value: c
  }, c)))), /*#__PURE__*/n.createElement("div", null, /*#__PURE__*/n.createElement("label", {
    className: "text-xs text-slate-500 mb-1 block"
  }, "الماركة (اختياري)"), /*#__PURE__*/n.createElement("input", {
    value: brand,
    onChange: e => setBrand(e.target.value),
    className: "w-full text-sm"
  }))), /*#__PURE__*/n.createElement("div", {
    className: "grid grid-cols-2 gap-3"
  }, /*#__PURE__*/n.createElement("div", null, /*#__PURE__*/n.createElement("label", {
    className: "text-xs text-slate-500 mb-1 block"
  }, "سعر البيع *"), /*#__PURE__*/n.createElement("input", {
    type: "number",
    min: "0",
    value: sellPrice,
    onChange: e => setSellPrice(e.target.value),
    className: "w-full text-sm",
    placeholder: "550"
  })), /*#__PURE__*/n.createElement("div", null, /*#__PURE__*/n.createElement("label", {
    className: "text-xs text-slate-500 mb-1 block"
  }, "سعر التكلفة (اختياري)"), /*#__PURE__*/n.createElement("input", {
    type: "number",
    min: "0",
    value: costPrice,
    onChange: e => setCostPrice(e.target.value),
    className: "w-full text-sm",
    placeholder: "350"
  }))), /*#__PURE__*/n.createElement("div", {
    className: "bg-slate-50 rounded-xl p-3 flex items-center justify-between"
  }, /*#__PURE__*/n.createElement("span", {
    className: "text-sm text-slate-500"
  }, "هامش الربح المتوقع"), /*#__PURE__*/n.createElement("span", {
    className: "font-bold text-lg " + marginColor
  }, marginLabel, cost > 0 && sell > 0 && /*#__PURE__*/n.createElement("span", {
    className: "text-xs text-slate-400 mr-1 font-normal"
  }, "(", (sell - cost).toFixed(0), " ج.م/قطعة)"))), /*#__PURE__*/n.createElement("div", null, /*#__PURE__*/n.createElement("label", {
    className: "text-xs text-slate-500 mb-1 block"
  }, "كود المنتج SKU (اختياري — يُولّد تلقائيًا)"), /*#__PURE__*/n.createElement("input", {
    value: sku,
    onChange: e => setSku(e.target.value),
    className: "w-full text-sm",
    dir: "ltr",
    placeholder: "سيُولّد تلقائيًا حسب الفئة"
  }))), step === 2 && /*#__PURE__*/n.createElement("div", {
    className: "space-y-4"
  }, /*#__PURE__*/n.createElement("div", null, /*#__PURE__*/n.createElement("label", {
    className: "text-xs text-slate-500 mb-2 block"
  }, "الألوان"), /*#__PURE__*/n.createElement("div", {
    className: "flex flex-wrap gap-2"
  }, colorPool.map(c => /*#__PURE__*/n.createElement("button", {
    key: c,
    onClick: () => toggleColor(c),
    className: "flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border transition-all " + (selectedColors.includes(c) ? "border-indigo-500 bg-indigo-50 text-indigo-700 font-medium" : "border-slate-200 text-slate-600 hover:border-slate-300")
  }, /*#__PURE__*/n.createElement("span", {
    className: "w-3 h-3 rounded-full border border-slate-300",
    style: {
      background: colorHex(c)
    }
  }), c))), /*#__PURE__*/n.createElement("div", {
    className: "flex gap-2 mt-2"
  }, /*#__PURE__*/n.createElement("input", {
    value: customColor,
    onChange: e => setCustomColor(e.target.value),
    onKeyDown: e => e.key === "Enter" && addCustomColor(),
    placeholder: "لون آخر...",
    className: "flex-1 text-xs py-1.5"
  }), /*#__PURE__*/n.createElement("button", {
    onClick: addCustomColor,
    className: "text-xs px-3 py-1.5 bg-slate-100 rounded-lg text-slate-600"
  }, "إضافة"))), /*#__PURE__*/n.createElement("div", null, /*#__PURE__*/n.createElement("label", {
    className: "text-xs text-slate-500 mb-2 block"
  }, "المقاسات"), /*#__PURE__*/n.createElement("div", {
    className: "flex flex-wrap gap-2"
  }, sizePool.map(sz => /*#__PURE__*/n.createElement("button", {
    key: sz,
    onClick: () => toggleSize(sz),
    className: "text-xs px-3 py-1.5 rounded-full border transition-all " + (selectedSizes.includes(sz) ? "border-indigo-500 bg-indigo-50 text-indigo-700 font-medium" : "border-slate-200 text-slate-600 hover:border-slate-300")
  }, sz))), /*#__PURE__*/n.createElement("div", {
    className: "flex gap-2 mt-2"
  }, /*#__PURE__*/n.createElement("input", {
    value: customSize,
    onChange: e => setCustomSize(e.target.value),
    onKeyDown: e => e.key === "Enter" && addCustomSize(),
    placeholder: "مقاس آخر...",
    className: "flex-1 text-xs py-1.5",
    dir: "ltr"
  }), /*#__PURE__*/n.createElement("button", {
    onClick: addCustomSize,
    className: "text-xs px-3 py-1.5 bg-slate-100 rounded-lg text-slate-600"
  }, "إضافة"))), selectedColors.length > 0 && selectedSizes.length > 0 && /*#__PURE__*/n.createElement("div", null, /*#__PURE__*/n.createElement("label", {
    className: "text-xs text-slate-500 mb-2 block"
  }, "جدول الكميات — إجمالي القطع: ", /*#__PURE__*/n.createElement("b", {
    className: "text-indigo-600"
  }, totalPieces)), /*#__PURE__*/n.createElement("div", {
    className: "overflow-x-auto border border-slate-200 rounded-xl"
  }, /*#__PURE__*/n.createElement("table", {
    className: "w-full text-xs"
  }, /*#__PURE__*/n.createElement("thead", null, /*#__PURE__*/n.createElement("tr", {
    className: "bg-slate-50"
  }, /*#__PURE__*/n.createElement("th", {
    className: "p-2 text-right"
  }, "المقاس \\ اللون"), selectedColors.map(c => /*#__PURE__*/n.createElement("th", {
    key: c,
    className: "p-2 text-center"
  }, c)))), /*#__PURE__*/n.createElement("tbody", null, selectedSizes.map(sz => /*#__PURE__*/n.createElement("tr", {
    key: sz,
    className: "border-t border-slate-100"
  }, /*#__PURE__*/n.createElement("td", {
    className: "p-2 font-medium text-slate-700"
  }, sz), selectedColors.map(cl => /*#__PURE__*/n.createElement("td", {
    key: cl,
    className: "p-1 text-center"
  }, /*#__PURE__*/n.createElement("input", {
    type: "number",
    min: "0",
    max: "999",
    value: getQty(sz, cl) || "",
    onChange: e => setQty(sz, cl, e.target.value),
    className: "w-14 text-center text-xs py-1",
    placeholder: "0"
  })))))))))), step === 3 && /*#__PURE__*/n.createElement("div", {
    className: "space-y-3"
  }, /*#__PURE__*/n.createElement("div", {
    className: "bg-slate-50 rounded-xl p-4 space-y-2 text-sm"
  }, /*#__PURE__*/n.createElement("div", {
    className: "flex justify-between"
  }, /*#__PURE__*/n.createElement("span", {
    className: "text-slate-500"
  }, "المنتج"), /*#__PURE__*/n.createElement("span", {
    className: "font-medium"
  }, name)), /*#__PURE__*/n.createElement("div", {
    className: "flex justify-between"
  }, /*#__PURE__*/n.createElement("span", {
    className: "text-slate-500"
  }, "الفئة"), /*#__PURE__*/n.createElement("span", null, category)), /*#__PURE__*/n.createElement("div", {
    className: "flex justify-between"
  }, /*#__PURE__*/n.createElement("span", {
    className: "text-slate-500"
  }, "السعر / الهامش"), /*#__PURE__*/n.createElement("span", null, sell, " ج.م", cost > 0 && /*#__PURE__*/n.createElement("span", {
    className: " " + marginColor
  }, " · ", marginLabel))), /*#__PURE__*/n.createElement("div", {
    className: "flex justify-between"
  }, /*#__PURE__*/n.createElement("span", {
    className: "text-slate-500"
  }, "الألوان"), /*#__PURE__*/n.createElement("span", null, selectedColors.join("، "))), /*#__PURE__*/n.createElement("div", {
    className: "flex justify-between"
  }, /*#__PURE__*/n.createElement("span", {
    className: "text-slate-500"
  }, "المقاسات"), /*#__PURE__*/n.createElement("span", {
    dir: "ltr"
  }, selectedSizes.join(", "))), /*#__PURE__*/n.createElement("div", {
    className: "flex justify-between border-t border-slate-200 pt-2 mt-1"
  }, /*#__PURE__*/n.createElement("span", {
    className: "text-slate-700 font-medium"
  }, "إجمالي القطع"), /*#__PURE__*/n.createElement("span", {
    className: "font-bold text-indigo-600"
  }, totalPieces))))), !lastCreated && /*#__PURE__*/n.createElement("div", {
    className: "flex gap-2 pt-2"
  }, step > 1 && /*#__PURE__*/n.createElement("button", {
    onClick: () => setStep(step - 1),
    className: "px-4 py-2 text-sm text-slate-500"
  }, "رجوع"), /*#__PURE__*/n.createElement("div", {
    className: "flex-1"
  }), step < 3 && /*#__PURE__*/n.createElement("button", {
    onClick: nextStep,
    className: "btn-primary text-sm px-5"
  }, "التالي"), step === 3 && /*#__PURE__*/n.createElement("button", {
    onClick: save,
    disabled: saving,
    className: "btn-primary text-sm px-5 disabled:opacity-50"
  }, saving ? "جارٍ الحفظ..." : "حفظ المنتج")))));
}

}},e=>{self.__webpack_require__=e}]);
