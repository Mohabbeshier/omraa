(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[8813],{88813:(e,t,s)=>{"use strict";s.r(t),s.d(t,{default:()=>CollectionsModal});var n=s(12115);
function CollectionsModal(props) {
  props = props || {};
  const {
    open,
    onClose,
    supabase,
    productId,
    onSaved
  } = props;
  const [collections, setCollections] = n.useState([]);
  const [selected, setSelected] = n.useState([]);
  const [newName, setNewName] = n.useState("");
  const [loading, setLoading] = n.useState(true);
  const [saving, setSaving] = n.useState(false);
  const [error, setError] = n.useState("");
  n.useEffect(() => {
    if (open) {
      setLoading(true);
      setError("");
      supabase.rpc("pos_fn_list_collections_for_product", {
        p_product_id: productId
      }).then(({
        data
      }) => {
        setCollections(data || []);
        setSelected((data || []).filter(c => c.is_selected).map(c => c.id));
        setLoading(false);
      });
    }
  }, [open, supabase, productId]);
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
}},e=>{self.__webpack_require__=e}]);
