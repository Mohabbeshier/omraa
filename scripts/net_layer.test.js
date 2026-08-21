/* اختبار طبقة الصمود — بيغطي الحالات الحقيقية اللي بتحصل في المحل. */
const fs = require('fs');
const { JSDOM } = require('/tmp/node_modules/jsdom');

let pass = 0, fail = 0;
const ok = (s) => { console.log('  ✓ ' + s); pass++; };
const bad = (s) => { console.log('  ✗ ' + s); fail++; };
const must = (c, s) => (c ? ok(s) : bad(s));
const T = (ms) => new Promise((r) => setTimeout(r, ms));

const SRC = fs.readFileSync('/home/claude/pos/omraa-net.js', 'utf8');
const REF = 'mjetglnmivwphxyzflsz';
const b64 = (t) => Buffer.from(t, 'utf8').toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function boot(opts) {
  opts = opts || {};
  const dom = new JSDOM('<body></body>', { runScripts: 'dangerously',
    url: 'https://x.test/omraa/pos.html' });
  const w = dom.window;
  w.crypto = { getRandomValues: (a) => { for (let i = 0; i < a.length; i++) a[i] = (i * 37) % 256; return a; } };
  w.TextDecoder = TextDecoder;
  w.AbortController = AbortController;
  w.BroadcastChannel = function () { this.postMessage = () => {}; this.onmessage = null; };
  const sess = { access_token: 'TOK', refresh_token: 'r',
    expires_at: Math.floor(Date.now() / 1000) + 3600 };
  Object.defineProperty(w.document, 'cookie', {
    get: () => opts.noSession ? '' : `sb-${REF}-auth-token=base64-${b64(JSON.stringify(sess))}`,
    set: () => {}, configurable: true });
  const calls = [];
  w.fetch = (url, o) => {
    calls.push({ url: String(url), opts: o });
    return opts.fetch ? opts.fetch(String(url), o, calls)
      : Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true }), text: async () => '{}' });
  };
  const el = w.document.createElement('script');
  el.textContent = SRC;
  w.document.body.appendChild(el);
  return { w, calls, N: () => w.OmraaNet };
}
const visible = (w) => {
  const c = w.document.body.cloneNode(true);
  c.querySelectorAll('script').forEach((n) => n.remove());
  return c.textContent.replace(/\s+/g, ' ');
};

(async () => {
  console.log('━━ ١. الوحدة بتحمّل وبتعرض واجهتها ━━');
  {
    const { w, N } = boot();
    await T(50);
    must(typeof N() === 'object', 'OmraaNet متاحة');
    for (const fn of ['rpc', 'enqueue', 'flush', 'pending', 'saveDraft', 'loadDraft',
      'cacheCatalog', 'lookupBarcode', 'newKey', 'onChange'])
      must(typeof N()[fn] === 'function', `${fn}() موجودة`);
  }

  console.log('\n━━ ٢. مفاتيح عدم التكرار فريدة ━━');
  {
    const { N } = boot(); await T(30);
    const keys = new Set();
    for (let i = 0; i < 200; i++) keys.add(N().newKey('sale'));
    must(keys.size === 200, `٢٠٠ مفتاح كلهم مختلفين`);
    must([...keys][0].startsWith('sale-'), 'المفتاح بيحمل نوع العملية');
    must([...keys].every((k) => k.length >= 8 && k.length <= 100),
      'كل المفاتيح داخل الطول اللي السيرفر بيقبله (٨-١٠٠)');
  }

  console.log('\n━━ ٣. المسودات: بتتحفظ وبترجع ━━');
  {
    const { N } = boot(); await T(30);
    N().saveDraft('cart', { items: ['a', 'b'], total: 900 });
    const back = N().loadDraft('cart');
    must(back && back.total === 900 && back.items.length === 2, 'المسودة رجعت زي ما هي');
    await T(12);   // المسودة اتحفظت في نفس الميلي ثانية — نستنى شوية عشان تبقى "قديمة"
    must(N().loadDraft('cart', 5) === null, 'مسودة قديمة بتترفض لو حددنا عمر أقصى');
    must(N().loadDraft('cart') !== null, 'وبترجع عادي من غير حد للعمر');
    N().clearDraft('cart');
    must(N().loadDraft('cart') === null, 'المسح شغّال');
  }

  console.log('\n━━ ٤. كاش الكتالوج + فحص السعر أوفلاين ━━');
  {
    const { N } = boot(); await T(30);
    N().cacheCatalog([{ barcode: '6221', name: 'حذاء جلد', price: 900, inStock: 3 }]);
    const hit = N().lookupBarcode('6221');
    must(hit && hit.item.price === 900, 'الباركود اتلاقى في الكاش');
    must(hit.stale === false, 'متعلّم إنه جديد مش قديم');
    must(N().lookupBarcode('nope') === null, 'باركود مش موجود بيرجّع null');
    const c = N().getCatalog();
    must(c && typeof c.ageMs === 'number', 'عمر الكاش متاح للعرض للمستخدم');
  }

  console.log('\n━━ ٥. الطابور: بيقبل المسموح ويرفض البيع ━━');
  {
    const { N } = boot(); await T(30);
    const k = N().enqueue('pos_fn_update_shipment',
      { p_shipment: 'x', p_status: 'with_courier' }, 'شحنة لسلوى');
    must(N().pending().length === 1, 'العملية دخلت الطابور');
    must(N().pending()[0].key === k, 'ومعاها مفتاح عدم تكرار');
    must(N().pending()[0].body.p_idem_key === k, 'المفتاح اتحقن في جسم الطلب');
    let threw = false;
    try { N().enqueue('pos_fn_sale', {}, 'بيعة'); } catch (_) { threw = true; }
    must(threw, '🔴 الأهم: البيع مرفوض يدخل الطابور (لازم مخزون حي)');
  }

  console.log('\n━━ ٦. إعادة المحاولة بفواصل متزايدة ━━');
  {
    let n = 0;
    const { N } = boot({ fetch: (url) => {
      if (url.includes('/rpc/')) { n++;
        return n < 3 ? Promise.reject(new TypeError('Failed to fetch'))
                     : Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true }) }); }
      return Promise.resolve({ ok: true, status: 200 });
    } });
    await T(30);
    const t0 = Date.now();
    const res = await N().rpc('pos_fn_shipments', {});
    must(res && res.ok === true, `نجح بعد ${n} محاولات`);
    must(Date.now() - t0 >= 1000, 'استنى بين المحاولات (مش هجوم على السيرفر)');
  }

  console.log('\n━━ ٧. الأخطاء النهائية ما بتتعادش ━━');
  {
    let n = 0;
    const { N } = boot({ fetch: (url) => {
      if (url.includes('/rpc/')) { n++;
        return Promise.resolve({ ok: false, status: 401, text: async () => 'JWT expired' }); }
      return Promise.resolve({ ok: true, status: 200 });
    } });
    await T(30);
    let msg = '';
    try { await N().rpc('pos_fn_shipments', {}); } catch (e) { msg = e.message; }
    must(n === 1, `٤٠١ اتحاول مرة واحدة بس (${n}) — إعادتها مالهاش لزمة`);
    must(/انتهت الجلسة/.test(msg), 'رسالة عربية مفهومة مش كود');
  }

  console.log('\n━━ ٨. مؤشر الحالة بيظهر ويتغيّر ━━');
  {
    const { w, N } = boot({ fetch: () => Promise.reject(new TypeError('Failed to fetch')) });
    await T(300);
    const b = w.document.querySelector('#omraa-net-badge');
    must(!!b, 'المؤشر اتحط في الصفحة');
    must(/مفيش نت/.test(b.textContent), `بيقول «مفيش نت» (${b.textContent})`);
    must(N().isOnline() === false, 'الحالة الداخلية متسقة');
  }

  console.log('\n━━ ٩. المؤشر بيعد المعلّق ━━');
  {
    const { w, N } = boot(); await T(200);
    N().enqueue('pos_fn_settle_money', { p_ids: ['a'], p_received: 500 }, 'تحصيل ٥٠٠');
    await T(50);
    const b = w.document.querySelector('#omraa-net-badge');
    must(/معلّق/.test(b.textContent), `بيعرض العدد (${b.textContent})`);
  }

  console.log('\n━━ ١٠. الطابور بيتفرّغ لما النت يرجع ━━');
  {
    const sent = [];
    const { N } = boot({ fetch: (url, o) => {
      if (url.includes('/rpc/')) { sent.push(JSON.parse(o.body));
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true }) }); }
      return Promise.resolve({ ok: true, status: 200 });
    } });
    await T(50);
    N().enqueue('pos_fn_update_shipment', { p_shipment: 's1', p_status: 'delivered' }, 'شحنة ١');
    N().enqueue('pos_fn_update_shipment', { p_shipment: 's2', p_status: 'delivered' }, 'شحنة ٢');
    must(N().pending().length === 2, 'اتنين في الطابور');
    await N().flush();
    await T(100);
    must(N().pending().length === 0, 'الطابور فضي بعد الإرسال');
    must(sent.length >= 2, `اتبعتوا (${sent.length})`);
    must(sent.every((b) => b.p_idem_key), '🔴 كل عملية اتبعتت بمفتاح عدم تكرار');
    must(new Set(sent.map((b) => b.p_idem_key)).size === sent.length, 'المفاتيح مختلفة عن بعض');
  }

  console.log('\n━━ ١١. عملية فاشلة بتفضل في الطابور مش بتضيع ━━');
  {
    const { N } = boot({ fetch: (url) => {
      if (url.includes('/rpc/')) return Promise.reject(new TypeError('Failed to fetch'));
      return Promise.resolve({ ok: true, status: 200 });
    } });
    await T(50);
    N().enqueue('pos_fn_settle_money', { p_ids: ['a'], p_received: 300 }, 'تحصيل ٣٠٠');
    await N().flush().catch(() => {});
    await T(100);
    must(N().pending().length === 1, '🔴 العملية لسه موجودة — ما ضاعتش');
    must(N().pending()[0].tries > 0, 'وعدد المحاولات اتسجّل');
  }

  console.log('\n━━ ١٢. من غير جلسة: ما بيحاولش يبعت ━━');
  {
    const { N } = boot({ noSession: true }); await T(50);
    let msg = '';
    try { await N().rpc('pos_fn_shipments', {}); } catch (e) { msg = e.message; }
    must(/انتهت الجلسة/.test(msg), 'بيرفض بوضوح بدل ما يبعت بلا صلاحية');
  }

  console.log('\n━━ ١٣. الوحدة ما بتكسرش الصفحة لو التخزين محظور ━━');
  {
    const dom = new JSDOM('<body></body>', { runScripts: 'dangerously', url: 'https://x.test/omraa/pos.html' });
    const w = dom.window;
    w.crypto = { getRandomValues: (a) => a };
    w.TextDecoder = TextDecoder; w.AbortController = AbortController;
    Object.defineProperty(w, 'localStorage', {
      get: () => { throw new Error('blocked'); }, configurable: true });
    Object.defineProperty(w.document, 'cookie', { get: () => '', set: () => {}, configurable: true });
    w.fetch = () => Promise.resolve({ ok: true, status: 200 });
    const errs = [];
    w.onerror = (m) => errs.push(m);
    const el = w.document.createElement('script'); el.textContent = SRC;
    w.document.body.appendChild(el);
    await T(80);
    must(errs.length === 0, `مفيش استثناء وقّع الصفحة (${errs.join('|') || 'نضيف'})`);
    must(typeof w.OmraaNet === 'object', 'والوحدة لسه شغّالة');
  }


  console.log('\n━━ ١٤. تحذير آخر قطعة ━━');
  {
    const { N } = boot({ fetch: () => Promise.resolve({ ok: true, status: 200 }) });
    await T(250);
    must(N().lastItemRisk(5) === null, 'مخزون وفير: مفيش تحذير');
    must(N().lastItemRisk(1) === null, 'آخر قطعة + النت كويس: مفيش تحذير (منزعّجش بلا داعي)');
  }
  {
    const { N } = boot({ fetch: () => Promise.reject(new TypeError('Failed to fetch')) });
    await T(300);
    const w1 = N().lastItemRisk(1);
    must(w1 && /آخر قطعة/.test(w1), `آخر قطعة + نت مقطوع: فيه تحذير (${w1})`);
    const w0 = N().lastItemRisk(0);
    must(w0 && /نفدت/.test(w0), 'نفدت + نت مقطوع: تحذير أقوى');
    must(N().lastItemRisk(9) === null, 'مخزون وفير: مفيش تحذير حتى لو النت مقطوع');
  }

  console.log('\n━━ ١٥. وضع الطوارئ: أكواد محجوزة ━━');
  {
    const { N } = boot({ fetch: (url) => {
      if (url.includes('pos_fn_reserve_codes'))
        return Promise.resolve({ ok: true, status: 200,
          json: async () => ({ ok: true, codes: ['INV-000401', 'INV-000402'] }) });
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    } });
    await T(250);
    const got = await N().topUpCodes(2);
    must(got.length === 2, 'اتحجزوا كودين من السيرفر');
    must(N().reservedCodes().length === 2, 'واتخزنوا محليًا للطوارئ');
    const c1 = N().useCode();
    must(c1 === 'INV-000401', `أول كود اتاخد (${c1})`);
    const c2 = N().useCode();
    must(c2 === 'INV-000402', 'والتاني بعده');
    must(N().useCode() === null, 'خلصوا: بيرجّع null مش كود مكرر');
  }

  console.log(fail ? `\n🔴 ${pass} نجح · ${fail} فشل\n` : `\n✅ ${pass} فحص نجح\n`);
  process.exit(fail ? 1 : 0);
})();
