/*! Al-Omraa System — © 2026 Mohab Beshier (Head of Performance) & Axis Marketing Agency.
    All rights reserved. Proprietary — licensed to the Al-Omraa shop only, for at most two
    installations, each with its own signed license key. See LICENSE.md. */
/* ── التحقق من ترخيص التركيبة ─────────────────────────────────────────
   كل تركيبة من النظام ليها ملف license.json موقّع رقميًا (Ed25519) من المالك،
   فيه: رقم الترخيص، ورقم التركيبة (١ من ٢ أو ٢ من ٢)، والدومين، ومشروع
   Supabase اللي النظام شغال عليه. الملف ده مايتعملش ولا يتعدّل من غير المفتاح
   السري اللي مع المالك بس — أي تعديل فيه بيبوّظ التوقيع.

   لو الترخيص مش موجود أو مش مطابق للدومين/المشروع: بيظهر شريط ثابت
   «نسخة غير مرخّصة» (مابيوقفش الشغل عشان مايضرّش أي تركيبة شرعية بالغلط).
   ومرة في اليوم (لكل جهاز ولكل حالة ترخيص) بيبعت لسجل تراخيص المالك: رقم
   الترخيص، والدومين، ومسار الصفحة، ومعرّف مشروع قاعدة البيانات، والحالة —
   ومعاهم بحكم الاتصال نفسه عنوان IP ونوع المتصفح (LICENSE.md البند ٥).
   مفيش أي بيانات مبيعات أو عملاء أو منتجات. */
(function () {
  "use strict";
  if (window.__omraaLicense) return;
  window.__omraaLicense = { status: "pending" };
  var PUB = "1k3nceBHjtnG7yjWCb61ujf3P4G20nhMz50FLJUINRM=";
  var PING = "https://mjetglnmivwphxyzflsz.supabase.co/functions/v1/license-ping";
  var me = document.currentScript;
  var BASE = (me && me.getAttribute("data-base")) || "/omraa";
  var REF = (me && me.getAttribute("data-ref")) || "";
  var host = location.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host === "") { window.__omraaLicense.status = "dev"; return; }

  function canon(o) {
    if (Array.isArray(o)) return "[" + o.map(canon).join(",") + "]";
    if (o && typeof o === "object") return "{" + Object.keys(o).sort().map(function (k) {
      return JSON.stringify(k) + ":" + canon(o[k]); }).join(",") + "}";
    return JSON.stringify(o);
  }
  function b64(s) { var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function loadNacl() {
    return new Promise(function (res, rej) {
      if (window.nacl && window.nacl.sign) return res(window.nacl);
      var s = document.createElement("script");
      s.src = BASE + "/vendor/nacl.min.js"; s.async = true;
      s.onload = function () { window.nacl && window.nacl.sign ? res(window.nacl) : rej(new Error("nacl")); };
      s.onerror = function () { rej(new Error("nacl load")); };
      (document.head || document.documentElement).appendChild(s);
    });
  }
  function bar(text) {
    try {
      if (document.getElementById("omraa-unlicensed")) return;
      var d = document.createElement("div");
      d.id = "omraa-unlicensed"; d.setAttribute("dir", "rtl"); d.setAttribute("role", "alert");
      d.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:99997;background:#7f1d1d;color:#fff;" +
        "padding:9px 14px calc(9px + env(safe-area-inset-bottom));font:13px/1.6 system-ui,-apple-system,sans-serif;" +
        "text-align:center;box-shadow:0 -2px 12px rgba(0,0,0,.35)";
      d.textContent = text;
      (document.body || document.documentElement).appendChild(d);
    } catch (_) {}
  }
  function ping(id, status) {
    try {
      var day = new Date().toISOString().slice(0, 10), k = "omraa.lic.ping." + status;
      try { if (localStorage.getItem(k) === day) return; localStorage.setItem(k, day); } catch (_) {}
      // text/plain = طلب بسيط من غير preflight
      fetch(PING, { method: "POST", keepalive: true, headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ id: id || "none", status: status, host: host, path: location.pathname.slice(0, 120), ref: REF }) })
        .catch(function () {});
    } catch (_) {}
  }
  var OWNER = "Axis Marketing Agency — mohabbeshier@gmail.com";
  function verdict(status, id, why) {
    window.__omraaLicense = { status: status, id: id || null, why: why || null };
    ping(id, status);
    if (status !== "valid" && status !== "error")
      bar("⚠️ نسخة غير مرخّصة من «نظام الأمراء» (" + why + ") — النظام ملك " + OWNER);
  }

  function run() {
    fetch(BASE + "/license.json", { cache: "no-store" })
      .then(function (r) {
        if (r.status === 404) return verdict("missing", null, "مفيش ملف ترخيص");
        if (!r.ok) return; // مشكلة شبكة مؤقتة: مانحكمش
        return r.json().then(function (lic) {
          var p = lic && lic.payload;
          if (!p || !lic.sig) return verdict("invalid", null, "ملف الترخيص بايظ");
          return loadNacl().then(function (nacl) {
            var ok = false;
            try { ok = nacl.sign.detached.verify(new TextEncoder().encode(canon(p)), b64(lic.sig), b64(PUB)); } catch (_) {}
            if (!ok) return verdict("invalid", p.id, "توقيع الترخيص مش صحيح");
            if (!Array.isArray(p.hosts) || p.hosts.indexOf(host) < 0) return verdict("mismatch", p.id, "الترخيص مش للدومين ده");
            if (REF && p.supabase_ref !== REF) return verdict("mismatch", p.id, "الترخيص مش لقاعدة البيانات دي");
            if (!(p.slot >= 1 && p.slot <= 2)) return verdict("invalid", p.id, "رقم تركيبة غير مسموح");
            verdict("valid", p.id);
          }, function () { window.__omraaLicense = { status: "error" }; });
        }, function () { verdict("invalid", null, "ملف الترخيص بايظ"); });
      })
      .catch(function () { window.__omraaLicense = { status: "error" }; });
  }
  // بعد ما الصفحة تفتح وتستقر — التحقق عمره ما يأخّر الشغل
  if (document.readyState === "complete") setTimeout(run, 2500);
  else window.addEventListener("load", function () { setTimeout(run, 2500); });
})();
