/* شاشة الشحن وقت انقطاع النت: هل بتحفظ العملية بدل ما تضيّعها؟
   وهل كل عملية بتتبعت بمفتاح عدم تكرار؟ */
const fs = require('fs');
const { JSDOM } = require('/tmp/node_modules/jsdom');
const ROOT = '/home/claude/pos', REF = 'mjetglnmivwphxyzflsz';
const b64 = (t) => Buffer.from(t, 'utf8').toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const SESSION = b64(JSON.stringify({ access_token: 'TOK', refresh_token: 'r',
  expires_at: Math.floor(Date.now() / 1000) + 3600 }));

let pass = 0, fail = 0;
const ok = (s) => { console.log('  ✓ ' + s); pass++; };
const bad = (s) => { console.log('  ✗ ' + s); fail++; };
const must = (c, s) => (c ? ok(s) : bad(s));
const T = (ms) => new Promise((r) => setTimeout(r, ms));

const ROWS = { ok: true, shipments: [{ id: 's1', customer: 'سلوى', phone: '01', address: 'ع',
  cod: 550, total: 550, status: 'preparing', status_label: 'تحت التجهيز للشحن',
  money: 'waiting', money_label: 'لسه معلقة', courier: 'RO.R', sale_code: 'INV-1',
  created_at: new Date().toISOString(), stage: 1 }] };

function boot(online) {
  const dom = new JSDOM(fs.readFileSync(ROOT + '/shipping.html', 'utf8')
    .replace(/<script[\s\S]*?<\/script>/g, ''), {
    runScripts: 'dangerously', url: 'https://x.test/omraa/shipping.html', pretendToBeVisual: true });
  const w = dom.window;
  w.crypto = { getRandomValues: (a) => { for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256); return a; } };
  w.TextDecoder = TextDecoder; w.AbortController = AbortController;
  w.BroadcastChannel = function () { this.postMessage = () => {}; this.onmessage = null; };
  w.confirm = () => true; w.scrollTo = () => {};
  Object.defineProperty(w.document, 'cookie', {
    get: () => `sb-${REF}-auth-token=base64-${SESSION}`, set: () => {}, configurable: true });

  const sent = [];
  w.fetch = (url, o) => {
    const u = String(url);
    if (u.includes('/rest/v1/rpc/')) {
      const fn = u.split('/rpc/')[1];
      const body = JSON.parse((o && o.body) || '{}');
      if (fn === 'pos_fn_shipments')
        return Promise.resolve({ ok: true, status: 200, text: async () => JSON.stringify(ROWS) });
      sent.push({ fn, body });
      if (!online) return Promise.reject(new TypeError('Failed to fetch'));
      return Promise.resolve({ ok: true, status: 200, text: async () => JSON.stringify({ ok: true }) });
    }
    if (!online) return Promise.reject(new TypeError('Failed to fetch'));
    return Promise.resolve({ ok: true, status: 200, text: async () => '{}' });
  };

  for (const f of ['omraa-net.js', 'shipping.js']) {
    const el = w.document.createElement('script');
    el.textContent = fs.readFileSync(ROOT + '/' + f, 'utf8');
    w.document.body.appendChild(el);
  }
  const vis = () => { const c = w.document.body.cloneNode(true);
    c.querySelectorAll('script').forEach((n) => n.remove());
    return c.textContent.replace(/\s+/g, ' '); };
  return { w, sent, vis };
}

(async () => {
  console.log('━━ ١. أونلاين: التحديث بيتبعت ومعاه مفتاح عدم تكرار ━━');
  {
    const { w, sent, vis } = boot(true);
    await T(400);
    must(vis().includes('سلوى'), 'الشحنات ظهرت');
    const btn = [...w.document.querySelectorAll('button')].find((b) => b.textContent.includes('طلعت'));
    btn.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await T(400);
    const upd = sent.filter((x) => x.fn === 'pos_fn_update_shipment');
    must(upd.length >= 1, 'التحديث اتبعت');
    must(upd[0].body.p_idem_key, '🔴 الأهم: اتبعت بمفتاح عدم تكرار');
    must(/^ship-/.test(upd[0].body.p_idem_key), 'المفتاح متعلّم بنوع العملية');
  }

  console.log('\n━━ ٢. أوفلاين: العملية بتتحفظ مش بتضيع ━━');
  {
    const { w, sent, vis } = boot(true);
    await T(400);
    // نخلي الوحدة تعرف إن النت وقع
    w.OmraaNet.ping && (w.fetch = () => Promise.reject(new TypeError('Failed to fetch')));
    await w.OmraaNet.ping();
    await T(100);
    must(w.OmraaNet.isOnline() === false, 'الوحدة عرفت إن النت مقطوع');

    const before = sent.length;
    const btn = [...w.document.querySelectorAll('button')].find((b) => b.textContent.includes('طلعت'));
    btn.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await T(400);

    const q = w.OmraaNet.pending();
    must(q.length === 1, '🔴 العملية اتحفظت في الطابور');
    must(q[0].fn === 'pos_fn_update_shipment', 'بنوعها الصح');
    must(!!q[0].body.p_idem_key, 'ومعاها مفتاح عدم تكرار');
    must(/سلوى/.test(q[0].label), `والوصف مفهوم للمستخدم (${q[0].label})`);
    must(/اتحفظت|مفيش نت/.test(vis()), 'والمستخدم شاف رسالة واضحة');
  }

  console.log('\n━━ ٣. النت رجع: الطابور بيتفرّغ بنفس المفتاح ━━');
  {
    const { w, sent } = boot(true);
    await T(400);
    w.fetch = () => Promise.reject(new TypeError('Failed to fetch'));
    await w.OmraaNet.ping(); await T(80);
    const btn = [...w.document.querySelectorAll('button')].find((b) => b.textContent.includes('طلعت'));
    btn.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await T(300);
    const key = w.OmraaNet.pending()[0].body.p_idem_key;
    must(!!key, 'العملية مستنية بمفتاحها');

    // النت رجع
    const afterSent = [];
    w.fetch = (url, o) => {
      const u = String(url);
      if (u.includes('/rest/v1/rpc/')) {
        const fn = u.split('/rpc/')[1];
        const body = JSON.parse((o && o.body) || '{}');
        if (fn === 'pos_fn_shipments')
          return Promise.resolve({ ok: true, status: 200, text: async () => JSON.stringify(ROWS) });
        afterSent.push({ fn, body });
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true }), text: async () => '{}' });
      }
      return Promise.resolve({ ok: true, status: 200, text: async () => '{}' });
    };
    await w.OmraaNet.ping();
    await w.OmraaNet.flush();
    await T(300);
    must(w.OmraaNet.pending().length === 0, 'الطابور فضي');
    const resent = afterSent.filter((x) => x.fn === 'pos_fn_update_shipment');
    must(resent.length >= 1, 'العملية اتبعتت فعلًا');
    must(resent[0].body.p_idem_key === key,
      '🔴 الأهم: نفس المفتاح بالظبط — فلو كانت وصلت قبل كده السيرفر هيرفض التكرار');
  }

  console.log('\n━━ ٤. التحصيل (فلوس) — نفس الحماية ━━');
  {
    const DELIVERED = { ok: true, shipments: [{ ...ROWS.shipments[0],
      status: 'delivered', status_label: 'تم التسليم', stage: 4 }] };
    const dom = boot(true);
    const { w } = dom;
    w.fetch = (url, o) => {
      const u = String(url);
      if (u.includes('/rpc/pos_fn_shipments'))
        return Promise.resolve({ ok: true, status: 200, text: async () => JSON.stringify(DELIVERED) });
      return Promise.reject(new TypeError('Failed to fetch'));
    };
    await w.eval('load()'); await T(300);
    await w.OmraaNet.ping(); await T(80);
    w.eval('go("money")'); await T(100);
    const btn = [...w.document.querySelectorAll('button')].find((b) => b.textContent.includes('حصّلت'));
    if (!btn) { bad('زرار التحصيل مش موجود'); }
    else {
      btn.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
      await T(120);
      const conf = [...w.document.querySelectorAll('button')].find((b) => b.textContent.includes('تأكيد التحصيل'));
      conf.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
      await T(300);
      const q = w.OmraaNet.pending();
      must(q.length === 1 && q[0].fn === 'pos_fn_settle_money', 'التحصيل اتحفظ في الطابور');
      must(!!q[0].body.p_idem_key, '🔴 بمفتاح عدم تكرار — فلوس ما تتسجّلش مرتين');
    }
  }

  console.log(fail ? `\n🔴 ${pass} نجح · ${fail} فشل\n` : `\n✅ ${pass} فحص نجح\n`);
  process.exit(fail ? 1 : 0);
})();
