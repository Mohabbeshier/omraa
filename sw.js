/* Omraa POS service worker — network-first + قشرة محفوظة للأوفلاين.
   الاستراتيجية: كل طلب بيروح للشبكة الأول بـno-store، فالتحديث بيوصل
   من غير ما المستخدم يعمل حاجة. الكاش للأوفلاين بس. */
const VERSION = 'v4';
const CACHE = 'omraa-net-first-' + VERSION;

/* الصفحات الأساسية بتتحفظ وقت التثبيت. من غير كده، أول مرة يفتح فيها
   صفحة ما زارهاش قبل كده والنت مقطوع = شاشة خطأ. الكاشير في المحل
   بيقع النت عنده، فده مش سيناريو نادر. */
const SHELL = [
  '/omraa/dashboard.html', '/omraa/shipping.html', '/omraa/pos.html',
  '/omraa/login.html', '/omraa/manifest.json', '/omraa/icon-192.png',
  '/omraa/photos.html', '/omraa/photos.build.js',
  '/omraa/vendor/react.min.js', '/omraa/vendor/react-dom.min.js',
  '/omraa/shipping.js', '/omraa/omraa-telemetry.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    try {
      const c = await caches.open(CACHE);
      // كل واحدة لوحدها: لو ملف واحد فشل، الباقي يفضل يتحفظ
      await Promise.all(SHELL.map((u) =>
        fetch(u, { cache: 'no-store' })
          .then((r) => (r.ok ? c.put(u, r) : null))
          .catch(() => null)));
    } catch (_) {}
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k === CACHE ? null : caches.delete(k))));
    await self.clients.claim();
    // الصفحة ممكن تفضل مفتوحة طول اليوم؛ من غير الإشارة دي هيفضل شغّال
    // على كود قديم لحد ما يقفلها ويفتحها من تاني.
    const cs = await self.clients.matchAll({ type: 'window' });
    for (const c of cs) { try { c.postMessage({ type: 'sw-updated', version: VERSION }); } catch (_) {} }
  })());
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) return;

  e.respondWith((async () => {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12000);
      let fresh;
      try { fresh = await fetch(req, { cache: 'no-store', signal: ctrl.signal }); }
      finally { clearTimeout(timer); }
      if (fresh && fresh.status === 200 && fresh.type === 'basic') {
        try { const c = await caches.open(CACHE); await c.put(req, fresh.clone()); } catch (_) {}
      }
      return fresh;
    } catch (err) {
      const cached = await caches.match(req);
      if (cached) return cached;
      // صفحة مش محفوظة والنت مقطوع: صفحة واضحة أحسن من خطأ المتصفح
      if (req.mode === 'navigate') {
        const shell = await caches.match('/omraa/dashboard.html');
        if (shell) return shell;
        return new Response(
          '<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8">' +
          '<meta name="viewport" content="width=device-width,initial-scale=1">' +
          '<body style="font-family:system-ui;text-align:center;padding:60px 24px;color:#0f172a">' +
          '<h2>مفيش نت</h2><p style="color:#64748b">الصفحة دي مش محفوظة على الجهاز. ' +
          'افتحها تاني أول ما النت يرجع.</p>' +
          '<button onclick="location.reload()" style="padding:12px 22px;border:0;border-radius:10px;' +
          'background:#0f172a;color:#fff;font:inherit;font-weight:700">جرّب تاني</button></body></html>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 });
      }
      throw err;
    }
  })());
});
