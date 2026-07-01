(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[8802],{88802:(e,t,s)=>{"use strict";s.r(t),s.d(t,{EditProductModal:()=>EditProductModal,BulkEditModal:()=>BulkEditModal,CollectionsModal:()=>CollectionsModal});var n=s(12115);
// ===================== Edit Product Modal =====================
function EditProductModal(props) {
  const {
    open,
    onClose,
    onSaved,
    supabase,
    productId,
    categories
  } = props;
  const [loading, setLoading] = (0, n.useState)(true);
  const [saving, setSaving] = (0, n.useState)(false);
  const [error, setError] = (0, n.useState)("");
  const [detail, setDetail] = (0, n.useState)(null);
  const [name, setName] = (0, n.useState)("");
  const [category, setCategory] = (0, n.useState)("");
  const [brand, setBrand] = (0, n.useState)("");
  const [sellPrice, setSellPrice] = (0, n.useState)("");
  const [costPrice, setCostPrice] = (0, n.useState)("");
  const [sku, setSku] = (0, n.useState)("");
  const [description, setDescription] = (0, n.useState)("");
  const [confirmDelete, setConfirmDelete] = (0, n.useState)(false);
  const [deleting, setDeleting] = (0, n.useState)(false);
  (0, n.useEffect)(() => {
    if (open && productId) {
      setLoading(true);
      setError("");
      setConfirmDelete(false);
      supabase.rpc("pos_fn_product_detail", {
        p_id: productId
      }).then(({
        data,
        error: err
      }) => {
        if (err) {
          setError(err.message);
          setLoading(false);
          return;
        }
        setDetail(data);
        setName(data.name || "");
        setCategory(data.category || "");
        setBrand(data.brand || "");
        setSellPrice(data.sell_price != null ? String(data.sell_price) : "");
        setCostPrice(data.cost_price != null ? String(data.cost_price) : "");
        setSku(data.base_sku || "");
        setDescription(data.description || "");
        setLoading(false);
      });
    }
  }, [open, productId, supabase]);
  if (!open) return null;
  async function save() {
    setError("");
    const nm = name.trim();
    if (!nm) {
      setError("اسم المنتج مطلوب");
      return;
    }
    const sell = Number(sellPrice) || 0;
    if (sell < 0) {
      setError("سعر البيع غير صحيح");
      return;
    }
    setSaving(true);
    const {
      data,
      error: err
    } = await supabase.rpc("pos_fn_update_product", {
      p_id: productId,
      p_name: nm,
      p_category: category || null,
      p_sell: sell,
      p_cost: costPrice !== "" ? Number(costPrice) : null,
      p_brand: brand.trim() || null,
      p_description: description.trim() || null,
      p_sku: sku.trim() || null
    });
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    onSaved && onSaved(data);
    onClose();
  }
  async function doDelete() {
    setDeleting(true);
    const {
      data,
      error: err
    } = await supabase.rpc("pos_fn_delete_product", {
      p_id: productId
    });
    setDeleting(false);
    if (err) {
      setError(err.message);
      return;
    }
    onSaved && onSaved(data);
    onClose();
  }
  const skuChanged = detail && sku.trim() !== (detail.base_sku || "");
  return /*#__PURE__*/n.createElement("div", {
    className: "fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-3",
    onClick: onClose
  }, /*#__PURE__*/n.createElement("div", {
    className: "bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/n.createElement("div", {
    className: "sticky top-0 bg-white border-b border-slate-100 p-4 flex items-center justify-between z-10"
  }, /*#__PURE__*/n.createElement("h2", {
    className: "font-bold text-slate-900"
  }, "تعديل المنتج"), /*#__PURE__*/n.createElement("button", {
    onClick: onClose,
    className: "text-slate-400 hover:text-slate-600 p-1"
  }, "✕")), /*#__PURE__*/n.createElement("div", {
    className: "p-4 space-y-3"
  }, loading ? /*#__PURE__*/n.createElement("div", {
    className: "py-8 text-center text-slate-400 text-sm"
  }, "جارٍ التحميل...") : /*#__PURE__*/n.createElement(n.Fragment, null, error && /*#__PURE__*/n.createElement("div", {
    className: "bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl p-3"
  }, error), detail && detail.sales_count > 0 && /*#__PURE__*/n.createElement("div", {
    className: "bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl p-2.5"
  }, "⚠️ هذا المنتج له ", detail.sales_count, " عملية بيع مسجّلة — التعديلات هنا لن تؤثر على الفواتير القديمة"), /*#__PURE__*/n.createElement("div", null, /*#__PURE__*/n.createElement("label", {
    className: "text-xs text-slate-500 mb-1 block"
  }, "اسم المنتج *"), /*#__PURE__*/n.createElement("input", {
    value: name,
    onChange: e => setName(e.target.value),
    className: "w-full text-sm"
  })), /*#__PURE__*/n.createElement("div", {
    className: "grid grid-cols-2 gap-3"
  }, /*#__PURE__*/n.createElement("div", null, /*#__PURE__*/n.createElement("label", {
    className: "text-xs text-slate-500 mb-1 block"
  }, "الفئة"), /*#__PURE__*/n.createElement("select", {
    value: category,
    onChange: e => setCategory(e.target.value),
    className: "w-full text-sm"
  }, (categories || []).map(c => /*#__PURE__*/n.createElement("option", {
    key: c,
    value: c
  }, c)))), /*#__PURE__*/n.createElement("div", null, /*#__PURE__*/n.createElement("label", {
    className: "text-xs text-slate-500 mb-1 block"
  }, "الماركة"), /*#__PURE__*/n.createElement("input", {
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
    className: "w-full text-sm"
  })), /*#__PURE__*/n.createElement("div", null, /*#__PURE__*/n.createElement("label", {
    className: "text-xs text-slate-500 mb-1 block"
  }, "سعر التكلفة"), /*#__PURE__*/n.createElement("input", {
    type: "number",
    min: "0",
    value: costPrice,
    onChange: e => setCostPrice(e.target.value),
    className: "w-full text-sm"
  }))), /*#__PURE__*/n.createElement("div", null, /*#__PURE__*/n.createElement("label", {
    className: "text-xs text-slate-500 mb-1 block"
  }, "كود SKU", skuChanged && /*#__PURE__*/n.createElement("span", {
    className: "text-amber-600 mr-1"
  }, "— سيتم تغييره")), /*#__PURE__*/n.createElement("input", {
    value: sku,
    onChange: e => setSku(e.target.value),
    className: "w-full text-sm",
    dir: "ltr"
  })), /*#__PURE__*/n.createElement("div", null, /*#__PURE__*/n.createElement("label", {
    className: "text-xs text-slate-500 mb-1 block"
  }, "الوصف (للموقع)"), /*#__PURE__*/n.createElement("textarea", {
    value: description,
    onChange: e => setDescription(e.target.value),
    className: "w-full text-sm",
    rows: 3
  })), /*#__PURE__*/n.createElement("div", {
    className: "flex gap-2 pt-2"
  }, /*#__PURE__*/n.createElement("button", {
    onClick: save,
    disabled: saving,
    className: "flex-1 btn-primary text-sm disabled:opacity-50"
  }, saving ? "جارٍ الحفظ..." : "حفظ التعديلات")), /*#__PURE__*/n.createElement("div", {
    className: "border-t border-slate-100 pt-3 mt-2"
  }, !confirmDelete ? /*#__PURE__*/n.createElement("button", {
    onClick: () => setConfirmDelete(true),
    className: "text-xs text-rose-500 hover:text-rose-700"
  }, "🗑️ حذف المنتج") : /*#__PURE__*/n.createElement("div", {
    className: "bg-rose-50 border border-rose-200 rounded-xl p-3 space-y-2"
  }, /*#__PURE__*/n.createElement("p", {
    className: "text-xs text-rose-700"
  }, detail && detail.sales_count > 0 ? "هذا المنتج له مبيعات سابقة — سيتم أرشفته وإخفاؤه (لن يُحذف نهائيًا حفاظًا على السجل المالي)" : "لا يوجد مبيعات لهذا المنتج — سيتم حذفه نهائيًا ولا يمكن التراجع"), /*#__PURE__*/n.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/n.createElement("button", {
    onClick: doDelete,
    disabled: deleting,
    className: "text-xs bg-rose-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
  }, deleting ? "..." : "تأكيد"), /*#__PURE__*/n.createElement("button", {
    onClick: () => setConfirmDelete(false),
    className: "text-xs text-slate-500 px-3 py-1.5"
  }, "إلغاء"))))))));
}

// ===================== Bulk Edit Modal =====================
function BulkEditModal(props) {
  const {
    open,
    onClose,
    onSaved,
    supabase,
    productIds
  } = props;
  const [mode, setMode] = (0, n.useState)("price_percent");
  const [value, setValue] = (0, n.useState)("");
  const [preview, setPreview] = (0, n.useState)(null);
  const [loading, setLoading] = (0, n.useState)(false);
  const [applying, setApplying] = (0, n.useState)(false);
  const [error, setError] = (0, n.useState)("");
  (0, n.useEffect)(() => {
    if (open) {
      setMode("price_percent");
      setValue("");
      setPreview(null);
      setError("");
    }
  }, [open]);
  if (!open) return null;
  async function loadPreview() {
    setError("");
    if (!value.trim()) {
      setError("أدخل القيمة أولاً");
      return;
    }
    setLoading(true);
    const {
      data,
      error: err
    } = await supabase.rpc("pos_fn_bulk_update_preview", {
      p_product_ids: productIds,
      p_mode: mode,
      p_value: value.trim()
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      setPreview(null);
      return;
    }
    setPreview(data);
  }
  async function apply() {
    setApplying(true);
    const {
      data,
      error: err
    } = await supabase.rpc("pos_fn_bulk_update_products", {
      p_product_ids: productIds,
      p_mode: mode,
      p_value: value.trim()
    });
    setApplying(false);
    if (err) {
      setError(err.message);
      return;
    }
    onSaved && onSaved(data);
    onClose();
  }
  return /*#__PURE__*/n.createElement("div", {
    className: "fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-3",
    onClick: onClose
  }, /*#__PURE__*/n.createElement("div", {
    className: "bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/n.createElement("div", {
    className: "sticky top-0 bg-white border-b border-slate-100 p-4 flex items-center justify-between z-10"
  }, /*#__PURE__*/n.createElement("h2", {
    className: "font-bold text-slate-900"
  }, "تعديل جماعي — ", productIds.length, " منتج"), /*#__PURE__*/n.createElement("button", {
    onClick: onClose,
    className: "text-slate-400 hover:text-slate-600 p-1"
  }, "✕")), /*#__PURE__*/n.createElement("div", {
    className: "p-4 space-y-3"
  }, error && /*#__PURE__*/n.createElement("div", {
    className: "bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl p-3"
  }, error), /*#__PURE__*/n.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/n.createElement("button", {
    onClick: () => {
      setMode("price_percent");
      setPreview(null);
    },
    className: "flex-1 text-sm py-2 rounded-lg border " + (mode === "price_percent" ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600")
  }, "تغيير السعر %"), /*#__PURE__*/n.createElement("button", {
    onClick: () => {
      setMode("category");
      setPreview(null);
    },
    className: "flex-1 text-sm py-2 rounded-lg border " + (mode === "category" ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600")
  }, "تغيير الفئة")), mode === "price_percent" ? /*#__PURE__*/n.createElement("div", null, /*#__PURE__*/n.createElement("label", {
    className: "text-xs text-slate-500 mb-1 block"
  }, "نسبة التغيير % (سالبة للتخفيض، موجبة للزيادة)"), /*#__PURE__*/n.createElement("input", {
    type: "number",
    value: value,
    onChange: e => {
      setValue(e.target.value);
      setPreview(null);
    },
    className: "w-full text-sm",
    placeholder: "مثال: 10 أو -15"
  })) : /*#__PURE__*/n.createElement("div", null, /*#__PURE__*/n.createElement("label", {
    className: "text-xs text-slate-500 mb-1 block"
  }, "الفئة الجديدة"), /*#__PURE__*/n.createElement("input", {
    value: value,
    onChange: e => {
      setValue(e.target.value);
      setPreview(null);
    },
    className: "w-full text-sm"
  })), /*#__PURE__*/n.createElement("button", {
    onClick: loadPreview,
    disabled: loading,
    className: "w-full text-sm py-2 bg-slate-100 rounded-lg text-slate-700 disabled:opacity-50"
  }, loading ? "جارٍ التحميل..." : "معاينة التغيير"), preview && preview.length > 0 && /*#__PURE__*/n.createElement("div", {
    className: "border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto"
  }, /*#__PURE__*/n.createElement("table", {
    className: "w-full text-xs"
  }, /*#__PURE__*/n.createElement("thead", null, /*#__PURE__*/n.createElement("tr", {
    className: "bg-slate-50 sticky top-0"
  }, /*#__PURE__*/n.createElement("th", {
    className: "p-2 text-right"
  }, "المنتج"), /*#__PURE__*/n.createElement("th", {
    className: "p-2 text-center"
  }, mode === "price_percent" ? "السعر" : "الفئة"))), /*#__PURE__*/n.createElement("tbody", null, preview.map(p => /*#__PURE__*/n.createElement("tr", {
    key: p.id,
    className: "border-t border-slate-100"
  }, /*#__PURE__*/n.createElement("td", {
    className: "p-2"
  }, p.name), /*#__PURE__*/n.createElement("td", {
    className: "p-2 text-center"
  }, mode === "price_percent" ? /*#__PURE__*/n.createElement("span", null, /*#__PURE__*/n.createElement("span", {
    className: "text-slate-400 line-through"
  }, p.old_price), " → ", /*#__PURE__*/n.createElement("span", {
    className: "font-bold text-indigo-600"
  }, p.new_price)) : /*#__PURE__*/n.createElement("span", null, /*#__PURE__*/n.createElement("span", {
    className: "text-slate-400 line-through"
  }, p.old_category), " → ", /*#__PURE__*/n.createElement("span", {
    className: "font-bold text-indigo-600"
  }, p.new_category)))))))), preview && /*#__PURE__*/n.createElement("button", {
    onClick: apply,
    disabled: applying,
    className: "w-full btn-primary text-sm disabled:opacity-50"
  }, applying ? "جارٍ التطبيق..." : "تطبيق على " + preview.length + " منتج"))));
}

// ===================== Collections Manager =====================
function CollectionsModal(props) {
  const {
    open,
    onClose,
    supabase,
    productId,
    onSaved
  } = props;
  const [collections, setCollections] = (0, n.useState)([]);
  const [selected, setSelected] = (0, n.useState)([]);
  const [newName, setNewName] = (0, n.useState)("");
  const [loading, setLoading] = (0, n.useState)(true);
  const [saving, setSaving] = (0, n.useState)(false);
  const [error, setError] = (0, n.useState)("");
  (0, n.useEffect)(() => {
    if (open) {
      setLoading(true);
      setError("");
      supabase.rpc("pos_fn_list_collections").then(({
        data
      }) => {
        setCollections(data || []);
        setLoading(false);
      });
    }
  }, [open, supabase]);
  if (!open) return null;
  function toggle(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }
  async function addNew() {
    const nm = newName.trim();
    if (!nm) return;
    const {
      data,
      error: err
    } = await supabase.rpc("pos_fn_upsert_collection", {
      p_name: nm
    });
    if (err) {
      setError(err.message);
      return;
    }
    setCollections(prev => [...prev, {
      id: data,
      name: nm,
      product_count: 0
    }]);
    setSelected(prev => [...prev, data]);
    setNewName("");
  }
  async function save() {
    setSaving(true);
    setError("");
    const {
      error: err
    } = await supabase.rpc("pos_fn_set_product_collections", {
      p_product_id: productId,
      p_collection_ids: selected
    });
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    onSaved && onSaved();
    onClose();
  }
  return /*#__PURE__*/n.createElement("div", {
    className: "fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-3",
    onClick: onClose
  }, /*#__PURE__*/n.createElement("div", {
    className: "bg-white rounded-2xl w-full max-w-sm max-h-[80vh] overflow-y-auto",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/n.createElement("div", {
    className: "sticky top-0 bg-white border-b border-slate-100 p-4 flex items-center justify-between z-10"
  }, /*#__PURE__*/n.createElement("h2", {
    className: "font-bold text-slate-900"
  }, "المجموعات"), /*#__PURE__*/n.createElement("button", {
    onClick: onClose,
    className: "text-slate-400 hover:text-slate-600 p-1"
  }, "✕")), /*#__PURE__*/n.createElement("div", {
    className: "p-4 space-y-3"
  }, error && /*#__PURE__*/n.createElement("div", {
    className: "bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl p-3"
  }, error), loading ? /*#__PURE__*/n.createElement("div", {
    className: "py-6 text-center text-slate-400 text-sm"
  }, "جارٍ التحميل...") : /*#__PURE__*/n.createElement(n.Fragment, null, /*#__PURE__*/n.createElement("div", {
    className: "space-y-1.5 max-h-48 overflow-y-auto"
  }, collections.map(c => /*#__PURE__*/n.createElement("label", {
    key: c.id,
    className: "flex items-center gap-2 text-sm p-2 rounded-lg hover:bg-slate-50 cursor-pointer"
  }, /*#__PURE__*/n.createElement("input", {
    type: "checkbox",
    checked: selected.includes(c.id),
    onChange: () => toggle(c.id)
  }), /*#__PURE__*/n.createElement("span", null, c.name), /*#__PURE__*/n.createElement("span", {
    className: "text-xs text-slate-400 mr-auto"
  }, c.product_count))), collections.length === 0 && /*#__PURE__*/n.createElement("p", {
    className: "text-xs text-slate-400 text-center py-3"
  }, "لا توجد مجموعات بعد")), /*#__PURE__*/n.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/n.createElement("input", {
    value: newName,
    onChange: e => setNewName(e.target.value),
    onKeyDown: e => e.key === "Enter" && addNew(),
    placeholder: "مجموعة جديدة...",
    className: "flex-1 text-sm"
  }), /*#__PURE__*/n.createElement("button", {
    onClick: addNew,
    className: "text-sm px-3 bg-slate-100 rounded-lg text-slate-600"
  }, "إضافة")), /*#__PURE__*/n.createElement("button", {
    onClick: save,
    disabled: saving,
    className: "w-full btn-primary text-sm disabled:opacity-50"
  }, saving ? "جارٍ الحفظ..." : "حفظ")))));
}
}}]);
