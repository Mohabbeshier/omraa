import { useState, useEffect } from "react";

export default function CollectionsModal(props) {
  const { open, onClose, supabase, productId, onSaved } = props;
  const [collections, setCollections] = useState([]);
  const [selected, setSelected] = useState([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setLoading(true);
      setError("");
      supabase.rpc("pos_fn_list_collections").then(({ data }) => {
        setCollections(data || []);
        setLoading(false);
      });
    }
  }, [open, supabase]);

  if (!open) return null;

  function toggle(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function addNew() {
    const nm = newName.trim();
    if (!nm) return;
    const { data, error: err } = await supabase.rpc("pos_fn_upsert_collection", { p_name: nm });
    if (err) {
      setError(err.message);
      return;
    }
    setCollections((prev) => [...prev, { id: data, name: nm, product_count: 0 }]);
    setSelected((prev) => [...prev, data]);
    setNewName("");
  }

  async function save() {
    setSaving(true);
    setError("");
    const { error: err } = await supabase.rpc("pos_fn_set_product_collections", {
      p_product_id: productId,
      p_collection_ids: selected,
    });
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    onSaved && onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-3" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 p-4 flex items-center justify-between z-10">
          <h2 className="font-bold text-slate-900">المجموعات</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            ✕
          </button>
        </div>
        <div className="p-4 space-y-3">
          {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl p-3">{error}</div>}
          {loading ? (
            <div className="py-6 text-center text-slate-400 text-sm">جارٍ التحميل...</div>
          ) : (
            <>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {collections.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                    <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} />
                    <span>{c.name}</span>
                    <span className="text-xs text-slate-400 mr-auto">{c.product_count}</span>
                  </label>
                ))}
                {collections.length === 0 && <p className="text-xs text-slate-400 text-center py-3">لا توجد مجموعات بعد</p>}
              </div>
              <div className="flex gap-2">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addNew()}
                  placeholder="مجموعة جديدة..."
                  className="flex-1 text-sm"
                />
                <button onClick={addNew} className="text-sm px-3 bg-slate-100 rounded-lg text-slate-600">
                  إضافة
                </button>
              </div>
              <button onClick={save} disabled={saving} className="w-full btn-primary text-sm disabled:opacity-50">
                {saving ? "جارٍ الحفظ..." : "حفظ"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
