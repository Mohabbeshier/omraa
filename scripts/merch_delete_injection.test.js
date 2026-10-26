/* SEC-FE-04 regression: a collection title containing quotes/JS must not execute
   when the owner presses Delete; the confirm dialog must still show the real title. */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/omraa/merchandising.html';
const EVIL = "x');window.__pwned=1;//\"<b>";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { console.log('  ✓ ' + m); pass++; } else { console.log('  ✗ ' + m); fail++; } };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext(); const p = await ctx.newPage();
  const tok = Buffer.from(JSON.stringify({ access_token: 'TOK', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600 })).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  await ctx.addCookies([{ name: 'sb-mjetglnmivwphxyzflsz-auth-token', value: 'base64-' + tok, url: 'http://127.0.0.1:8765/' }]);
  const calls = [];
  await p.route(/supabase\.co/, async r => {
    const u = r.request().url(); calls.push(u);
    if (u.includes('shop_fn_admin_merch')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      collections: [{ id: 'c1', title_ar: EVIL, subtitle_ar: '', active: true, kind: 'manual', product_ids: [], sort: 1, ends_at: null }],
      products: [], bundles: [], categories: [], discounts: [] }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  let dialogMsg = null;
  p.on('dialog', async d => { dialogMsg = d.message(); await d.dismiss(); });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  const btn = p.locator('button.btn-danger', { hasText: 'حذف' }).first();
  ok(await btn.count() === 1, 'زرار الحذف ظاهر');
  await btn.click(); await p.waitForTimeout(300);
  ok(!(await p.evaluate(() => window.__pwned)), 'العنوان الخبيث ماتنفّذش ككود');
  ok(dialogMsg && dialogMsg.includes(EVIL), 'رسالة التأكيد فيها العنوان الحقيقي');
  ok(!calls.some(u => u.includes('shop_fn_delete_collection')), 'الإلغاء ماحذفش حاجة');
  ok(errs.length === 0, 'مفيش أخطاء في الصفحة ' + errs.join('|'));
  console.log(`\n${pass} passed, ${fail} failed`); await b.close(); process.exit(fail ? 1 : 0);
})();
