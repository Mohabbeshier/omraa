/* ══════════════════════════════════════════════════════════════════
   مراجعة شاملة بمتصفح Chromium حقيقي.

   ⛔ أمان الداتا: **كل** نداء لـsupabase.co بيتعمله intercept ويترد
   محليًا. ولا بايت واحد بيوصل القاعدة الحقيقية. أي نداء كتابة
   (POST/PATCH/DELETE) بيتسجّل ويترفض — فمستحيل أي تعديل يحصل.
   ══════════════════════════════════════════════════════════════════ */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const ROOT = '/home/claude/pos';
const BASE = 'http://localhost:8899/omraa';
const REF = 'mjetglnmivwphxyzflsz';
const b64 = (t) => Buffer.from(t, 'utf8').toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const COOKIE = 'base64-' + b64(JSON.stringify({ access_token: 'TOK', refresh_token: 'r',
  expires_at: Math.floor(Date.now() / 1000) + 3600 }));
const UID = '08338ab4-e3bb-4f07-83e7-a4603ed919c8';
const USER = { id: UID, aud: 'authenticated', role: 'authenticated', email: 'owner@khutwa.store' };
const PROFILE = [{ id: UID, full_name: 'المالك', role: 'owner', active: true }];

const findings = [];
const note = (page, sev, what) => findings.push({ page, sev, what });

/* ردود واقعية عشان الصفحات ترسم فعلًا بدل ما تفضل فاضية */
const CANNED = {
  pos_fn_dashboard_stats: { todaySales: 3250, todayProfit: 900, weekSales: 21000,
    invoicesToday: 4, lowStock: 937 },
  pos_fn_backup_health: { ship_pending: 107, cod_waiting: 128800, offsite_level: 'ok',
    offsite_days: 0.3, snapshot_count: 24, coverage_ok: true, snapshot_tables: 35,
    expected_tables: 35, depth_days: 56, rpo_hours: 3, verify: { ok: true }, issues: [] },
  pos_fn_integrity_check: { checked_at: new Date().toISOString(), issues: 1, list: [
    { code: 'PLACEHOLDER_COLOR', severity: 'medium', count: 1,
      detail: 'حذاء جلد طبيعي 3سم — 3 قطعة بلون افتراضي',
      href: '/omraa/products', action_label: 'صحّح اللون', focus_id: 'p1' }] },
  pos_fn_app_badges: { pending_orders: 2 },
  pos_fn_shipments: { ok: true, shipments: [{ id: 's1', customer: 'سلوى', phone: '0100',
    address: 'وسط البلد', cod: 550, total: 550, status: 'preparing',
    status_label: 'تحت التجهيز للشحن', money: 'waiting', money_label: 'لسه معلقة',
    courier: 'RO.R', sale_code: 'INV-1', created_at: new Date().toISOString(), stage: 1 }] },
  pos_fn_inventory_summary: [{ product_id: 'p1', name: 'حذاء جلد طبيعي', category: 'كلاسيك',
    size: 42, color: 'أسود', inStock: 3, price: 900, sold: 5 }],
  pos_fn_list_customers: [{ id: 'c1', name: 'سلوى', phone: '0100', loyalty_points: 10,
    total_spent: 5400, orders: 3 }],
  pos_fn_pos_search: [],
  pos_fn_couriers: [{ id: 'k1', name: 'RO.R' }],
  pos_fn_reserve_codes: { ok: true, codes: ['INV-000901'] },
  pos_fn_outage_report: { ok: true, total: 0, total_minutes: 0, by_day: [] },
  // الصفحات دي بتعمل .reduce/.map/.filter على الرد مباشرة — لازم مصفوفة.
  // الرد الافتراضي {ok:true} كان بيرمي TypeError وهو خطأ في المحاكاة
  // مش في الصفحة.
  pos_fn_daily_ledger: [], pos_fn_list_expenses: [],
  pos_fn_list_backups: [], pos_fn_audit_recent: [], pos_fn_offsite_status: { ok: true },
  pos_fn_reorder_report: [], pos_fn_product_performance: [],
  pos_fn_strategy_insights: { ok: true, insights: [], top: [], slow: [] },
  pos_fn_list_suppliers: [], pos_fn_supplier_performance: [],
  pos_fn_customer_history: [],
};
const TABLES = {
  pos_profiles: PROFILE,
  pos_products: [{ id: 'p1', name: 'حذاء جلد طبيعي 3سم', category: 'كلاسيك',
    sell_price: 900, base_sku: 'SKU-1', is_published: true, status: 'active' }],
  pos_app_settings: [{ key: 'LOW_STOCK_ALERT_SATURATED', value: '3' }],
  pos_suppliers: [], pos_product_costs: [],
};

const writes = [];   // أي محاولة كتابة بتتسجّل هنا وتترفض

async function wire(page) {
  const SESSION = { access_token: 'TOK', token_type: 'bearer', expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user: USER };

  // ① الـcatch-all الأول — في Playwright آخر route متسجّل هو اللي بيكسب،
  //    فلازم العام يتسجّل قبل المحدّد وإلا هيبلعه.
  await page.route('**supabase.co/**', (route) => {
    const req = route.request();
    const url = req.url();
    const method = req.method();

    // ⛔ حاجز الأمان: أي كتابة تترفض وتتسجّل
    if (method !== 'GET' && method !== 'HEAD' && !url.includes('/rpc/')) {
      writes.push(method + ' ' + url);
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    if (url.includes('/rpc/')) {
      const fn = url.split('/rpc/')[1].split('?')[0];
      const body = CANNED[fn];
      if (/_fn_(sale|settle|update|delete|create|save|upsert|wipe|restore|import|toggle|process|exchange|pick|ship)/.test(fn))
        writes.push('RPC ' + fn);
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(body !== undefined ? body : (fn.includes('list') || fn.includes('search') ? [] : { ok: true })) });
    }
    const m = url.match(/\/rest\/v1\/([a-z_]+)/);
    const t = m && TABLES[m[1]];
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(t !== undefined ? t : []) });
  });

  // ② نقاط المصادقة بعد كده — كل واحدة بالشكل اللي supabase-js متوقعه
  await page.route('**/auth/v1/**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SESSION) }));
  await page.route('**/auth/v1/token**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SESSION) }));
  await page.route('**/auth/v1/user**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USER) }));
}

(async () => {
  const browser = await chromium.launch();
  const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')).sort();
  console.log(`سيتم فحص ${pages.length} صفحة على مقاس موبايل وديسك توب\n`);

  for (const file of pages) {
    for (const [vpName, vp] of [['موبايل', { width: 390, height: 844 }],
                                 ['ديسك توب', { width: 1280, height: 800 }]]) {
      const ctx = await browser.newContext({ viewport: vp, locale: 'ar-EG' });
      await ctx.addCookies([{ name: `sb-${REF}-auth-token`, value: COOKIE, url: 'http://localhost:8899' }]);
      const page = await ctx.newPage();
      const errs = [], bad4xx = [];
      page.on('pageerror', (e) => errs.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|403|Failed to load resource/.test(m.text())) errs.push(m.text()); });
      page.on('response', (r) => {
        if (r.status() >= 400 && !/fonts\.g|supabase\.co/.test(r.url()))
          bad4xx.push(r.status() + ' ' + r.url().replace(BASE, ''));
      });
      await wire(page);

      try {
        await page.goto(`${BASE}/${file}`, { waitUntil: 'networkidle', timeout: 15000 });
      } catch (e) {
        note(file, 'HIGH', `${vpName}: ما فتحتش — ${e.message.split('\n')[0]}`);
        await ctx.close(); continue;
      }
      await page.waitForTimeout(1200);

      const tag = `${file} [${vpName}]`;

      if (errs.length) note(file, 'HIGH', `${vpName}: أخطاء JS — ${[...new Set(errs)].slice(0, 2).join(' | ')}`);
      if (bad4xx.length) note(file, 'HIGH', `${vpName}: ملفات مفقودة — ${[...new Set(bad4xx)].slice(0, 3).join(' | ')}`);

      const audit = await page.evaluate((vw) => {
        const out = { overflow: 0, offscreen: [], tinyTargets: [], emptyLinks: [],
          imgNoAlt: [], inputNoLabel: [], badHref: [], ltrLeak: [], lowContrast: [],
          dupIds: [], emptyButtons: [] };
        const de = document.documentElement;
        out.overflow = Math.max(0, de.scrollWidth - de.clientWidth);

        const vis = (el) => {
          const cs = getComputedStyle(el);
          return cs.display !== 'none' && cs.visibility !== 'hidden' && el.getBoundingClientRect().width > 0;
        };

        document.querySelectorAll('body *').forEach((el) => {
          if (!vis(el)) return;
          const r = el.getBoundingClientRect();
          if (r.right > vw + 3 || r.left < -3) {
            // العنصر جوّه حاوية بتتمرّر أفقيًا عن قصد؟ ده مش عيب.
            let sc = el.parentElement, inScroller = false;
            while (sc) { const o = getComputedStyle(sc).overflowX;
              if (o === 'auto' || o === 'scroll') { inScroller = true; break; } sc = sc.parentElement; }
            if (!inScroller) out.offscreen.push(el.tagName + '.' + String(el.className).slice(0, 20));
          }
        });

        document.querySelectorAll('a,button,[role=button]').forEach((el) => {
          if (!vis(el)) return;
          const r = el.getBoundingClientRect();
          const txt = (el.textContent || '').trim();
          const aria = el.getAttribute('aria-label') || el.getAttribute('title') || '';
          if (r.height > 0 && r.height < 28) out.tinyTargets.push(`${txt || aria || el.tagName} h=${Math.round(r.height)}`);
          if (!txt && !aria && !el.querySelector('svg,img'))
            out.emptyButtons.push(el.tagName + '.' + String(el.className).slice(0, 20));
          if (el.tagName === 'A') {
            const h = el.getAttribute('href');
            if (h === '#' || h === '' || h === 'javascript:void(0)') out.emptyLinks.push(txt || '(بلا نص)');
            if (h && /^\/(?!omraa)/.test(h) && !h.startsWith('//')) out.badHref.push(h);
          }
        });

        document.querySelectorAll('img').forEach((el) => {
          if (vis(el) && !el.getAttribute('alt')) out.imgNoAlt.push(el.getAttribute('src') || '?');
        });

        document.querySelectorAll('input,select,textarea').forEach((el) => {
          if (!vis(el)) return;
          if (el.type === 'hidden') return;
          const id = el.id;
          const lab = (id && document.querySelector(`label[for="${id}"]`)) ||
                      el.closest('label') || el.getAttribute('aria-label') ||
                      el.getAttribute('placeholder');
          if (!lab) out.inputNoLabel.push(el.name || el.type || el.tagName);
        });

        const ids = {};
        document.querySelectorAll('[id]').forEach((el) => {
          ids[el.id] = (ids[el.id] || 0) + 1;
          if (ids[el.id] === 2) out.dupIds.push(el.id);
        });

        // نص عربي داخل عنصر اتجاهه ltr = محاذاة غلط
        document.querySelectorAll('body *').forEach((el) => {
          if (!vis(el) || el.children.length) return;
          const t = (el.textContent || '').trim();
          if (t.length > 3 && /[\u0600-\u06FF]/.test(t) && getComputedStyle(el).direction === 'ltr')
            out.ltrLeak.push(t.slice(0, 25));
        });

        return out;
      }, vp.width);

      if (audit.overflow > 5) note(file, 'MED', `${vpName}: تمرير أفقي ${audit.overflow}px`);
      if (audit.offscreen.length) note(file, 'MED', `${vpName}: ${audit.offscreen.length} عنصر برّه الشاشة — ${[...new Set(audit.offscreen)].slice(0,2).join(', ')}`);
      if (vpName === 'موبايل' && audit.tinyTargets.length)
        note(file, 'LOW', `موبايل: ${audit.tinyTargets.length} هدف لمس <28px — ${[...new Set(audit.tinyTargets)].slice(0,3).join(', ')}`);
      if (audit.emptyButtons.length) note(file, 'MED', `${vpName}: ${audit.emptyButtons.length} زرار بلا نص ولا وصف`);
      if (audit.imgNoAlt.length) note(file, 'LOW', `${vpName}: ${audit.imgNoAlt.length} صورة بلا alt`);
      if (audit.inputNoLabel.length) note(file, 'LOW', `${vpName}: ${audit.inputNoLabel.length} حقل بلا تسمية — ${[...new Set(audit.inputNoLabel)].slice(0,3).join(', ')}`);
      if (audit.dupIds.length) note(file, 'MED', `${vpName}: id مكرر — ${audit.dupIds.slice(0,3).join(', ')}`);
      if (audit.badHref.length) note(file, 'HIGH', `${vpName}: رابط برّه /omraa — ${[...new Set(audit.badHref)].slice(0,3).join(', ')}`);
      if (audit.ltrLeak.length) note(file, 'LOW', `${vpName}: نص عربي باتجاه ltr — ${audit.ltrLeak.slice(0,2).join(' / ')}`);

      await ctx.close();
    }
    process.stdout.write('.');
  }

  await browser.close();

  console.log('\n\n══════════ النتائج ══════════');
  console.log(`\n⛔ محاولات كتابة وصلت القاعدة: ${writes.length ? writes.length + ' (كلها اتحجزت محليًا — صفر تأثير)' : 'صفر'}`);
  if (writes.length) console.log('   ' + [...new Set(writes)].slice(0, 8).join('\n   '));

  const bySev = { HIGH: [], MED: [], LOW: [] };
  findings.forEach((f) => bySev[f.sev].push(f));
  for (const sev of ['HIGH', 'MED', 'LOW']) {
    const list = bySev[sev];
    console.log(`\n${sev === 'HIGH' ? '🔴' : sev === 'MED' ? '🟠' : '🟡'} ${sev} — ${list.length}`);
    const grouped = {};
    list.forEach((f) => { (grouped[f.page] = grouped[f.page] || []).push(f.what); });
    Object.keys(grouped).sort().forEach((p) => {
      console.log(`  ${p}`);
      [...new Set(grouped[p])].forEach((w) => console.log(`    · ${w}`));
    });
  }
  fs.writeFileSync('/tmp/audit-findings.json', JSON.stringify(findings, null, 2));
  console.log(`\nالتفاصيل الكاملة: /tmp/audit-findings.json (${findings.length} ملاحظة)`);
})();
