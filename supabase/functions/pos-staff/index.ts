// Al-Omraa System — © 2026 Mohab Beshier & Axis Marketing Agency. Licensed per LICENSE.md.
// pos-staff: the owner adds a staff account or changes a staff password from the app,
// without opening the Supabase dashboard. Only an active owner can call it.
// actions:
//   { action: "create", email, password, full_name, role: "employee" | "owner" }
//   { action: "reset_password", user_id, password }
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};
const out = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const URL_ = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const svc = { apikey: SERVICE, Authorization: "Bearer " + SERVICE, "Content-Type": "application/json" };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return out(405, { ok: false, message: "method" });
  const auth = req.headers.get("authorization") || "";
  if (!/^Bearer\s+\S+/.test(auth)) return out(401, { ok: false, message: "سجّل دخول الأول" });

  // ١) اللي طالب لازم يكون مالك فعّال — بنسأل قاعدة البيانات بجلسته هو
  const me = await fetch(URL_ + "/rest/v1/rpc/pos_fn_my_role", {
    method: "POST", headers: { apikey: ANON, Authorization: auth, "Content-Type": "application/json" }, body: "{}",
  });
  const role = me.ok ? await me.json().catch(() => null) : null;
  if (!role || role.is_owner !== true) return out(403, { ok: false, message: "إضافة الموظفين للمالك بس" });

  let b: Record<string, unknown> = {};
  try { b = await req.json(); } catch (_) { return out(400, { ok: false, message: "طلب غير صحيح" }); }
  const password = typeof b.password === "string" ? b.password : "";
  if (password.length < 8 || password.length > 72) return out(400, { ok: false, message: "كلمة السر لازم تكون من ٨ حروف أو أكتر" });

  if (b.action === "create") {
    const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
    const name = typeof b.full_name === "string" ? b.full_name.trim() : "";
    const r = b.role === "owner" ? "owner" : "employee";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return out(400, { ok: false, message: "الإيميل مش صحيح" });
    if (!name || name.length > 100) return out(400, { ok: false, message: "اكتب الاسم" });
    const cr = await fetch(URL_ + "/auth/v1/admin/users", {
      method: "POST", headers: svc,
      body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: name } }),
    });
    const cj = await cr.json().catch(() => ({}));
    if (!cr.ok) {
      const msg = String(cj.msg || cj.message || cj.error_description || "");
      if (/already|exists|registered/i.test(msg)) return out(409, { ok: false, message: "الإيميل ده عليه حساب بالفعل" });
      if (/weak|pwned|leaked/i.test(msg)) return out(400, { ok: false, message: "كلمة السر ضعيفة أو مسرّبة قبل كده — اختار واحدة تانية" });
      return out(502, { ok: false, message: "مقدرناش ننشئ الحساب: " + msg.slice(0, 120) });
    }
    const uid = cj.id || (cj.user && cj.user.id);
    const pr = await fetch(URL_ + "/rest/v1/rpc/pos_fn_admin_upsert_profile", {
      method: "POST", headers: svc, body: JSON.stringify({ p_id: uid, p_full_name: name, p_role: r }),
    });
    if (!pr.ok) return out(502, { ok: false, message: "الحساب اتعمل بس ملف الموظف مااتسجّلش — كلّم الدعم", user_id: uid });
    return out(200, { ok: true, user_id: uid, email, role: r });
  }

  if (b.action === "reset_password") {
    const uid = typeof b.user_id === "string" ? b.user_id : "";
    if (!/^[0-9a-f-]{36}$/.test(uid)) return out(400, { ok: false, message: "اختار الموظف" });
    // نغيّر كلمة سر حسابات الموظفين المسجّلين في النظام بس
    const chk = await fetch(URL_ + "/rest/v1/pos_profiles?select=id&id=eq." + uid, { headers: svc });
    const rows = chk.ok ? await chk.json().catch(() => []) : [];
    if (!Array.isArray(rows) || !rows.length) return out(404, { ok: false, message: "الموظف ده مش مسجّل في النظام" });
    const ur = await fetch(URL_ + "/auth/v1/admin/users/" + uid, {
      method: "PUT", headers: svc, body: JSON.stringify({ password }),
    });
    if (!ur.ok) {
      const j = await ur.json().catch(() => ({}));
      const msg = String(j.msg || j.message || "");
      if (/weak|pwned|leaked/i.test(msg)) return out(400, { ok: false, message: "كلمة السر ضعيفة أو مسرّبة قبل كده — اختار واحدة تانية" });
      return out(502, { ok: false, message: "مقدرناش نغيّر كلمة السر" });
    }
    return out(200, { ok: true });
  }
  return out(400, { ok: false, message: "action غير معروف" });
});
