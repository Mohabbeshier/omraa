(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[8801],{88801:(e,t,s)=>{"use strict";s.r(t),s.d(t,{default:()=>QuickAddModal});var n=s(12115);

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
export default function QuickAddModal(props) {
  const {
    open,
    onClose,
    onSaved,
    supabase
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
  n.useEffect(() => {
    if (open) {
      setStep(1);
      setName("");
      setBrand("");
      setSellPrice("");
      setCostPrice("");
      setSku("");
      setSelectedColors([]);
      setCustomColor("");
      setSelectedSizes([]);
      setCustomSize("");
      setMatrix({});
      setError("");
      setLastCreated(null);
      // جلب بيانات ذاتية: الفئات المتاحة + الألوان/المقاسات المستخدمة فعلياً في المتجر
      supabase.from("pos_app_settings").select("categories").maybeSingle().then(({
        data
      }) => {
        if (data && data.categories && data.categories.length) {
          setCategories(data.categories);
          setCategory(data.categories[0]);
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
    }
  }, [open, supabase]);
  if (!open) return null;
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
        p_variants: JSON.stringify(variants)
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
  }, [1, 2, 3].map(n => /*#__PURE__*/n.createElement("span", {
    key: n,
    className: "h-1.5 rounded-full transition-all " + (n === step ? "w-8 bg-indigo-600" : n < step ? "w-4 bg-indigo-300" : "w-4 bg-slate-200")
  })))), /*#__PURE__*/n.createElement("button", {
    onClick: onClose,
    className: "text-slate-400 hover:text-slate-600 p-1"
  }, "✕")), /*#__PURE__*/n.createElement("div", {
    className: "p-4 space-y-4"
  }, error && /*#__PURE__*/n.createElement("div", {
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
  }, /*#__PURE__*/n.createElement("div", null, /*#__PURE__*/n.createElement("label", {
    className: "text-xs text-slate-500 mb-1 block"
  }, "اسم المنتج *"), /*#__PURE__*/n.createElement("input", {
    autoFocus: true,
    value: name,
    onChange: e => setName(e.target.value),
    className: "w-full text-sm",
    placeholder: "مثال: حذاء طبي مخيط"
  })), /*#__PURE__*/n.createElement("div", {
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
}}]);
