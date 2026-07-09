/* Omraa POS service worker — network-first, self-healing cache.
   يمنع نهائيًا مشكلة الكاش القديم: كل طلب بيروح للشبكة الأول (no-store)،
   والكاش بيُستخدم فقط لو النت فصل (offline fallback). */
const CACHE = 'omraa-net-first-v2';

self.addEventListener('install', (e) => {
  // فعّل النسخة الجديدة فورًا من غير انتظار
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    // امسح أي كاش قديم تمامًا
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k === CACHE ? null : caches.delete(k))));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) return; // نفس الأصل فقط

  e.respondWith((async () => {
    try {
      // network-first مع تجاوز كامل لكاش HTTP
      const fresh = await fetch(req, { cache: 'no-store' });
      if (fresh && fresh.status === 200 && fresh.type === 'basic') {
        try { const c = await caches.open(CACHE); await c.put(req, fresh.clone()); } catch (_) {}
      }
      return fresh;
    } catch (err) {
      // النت فصل → رجّع من الكاش لو موجود
      const cached = await caches.match(req);
      if (cached) return cached;
      throw err;
    }
  })());
});
