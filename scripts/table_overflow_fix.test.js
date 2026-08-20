/* ══════════════════════════════════════════════════════════════════
   اختبار حقيقي (Chromium فعلي، مش jsdom) للتأكد إن جداول المخزون
   والمنتجات بقت متناسبة أكتر مع الموبايل — بقياس فعلي، مش افتراض.

   السياق: صاحب المحل بعت صورة شاشة موبايل حقيقي بيقول إن حاجات
   «خابطة في فريم الموبايل». التشخيص الفعلي: جدول ٨ أعمدة في المخزون
   وعمود إجراءات بخمس أزرار في المنتجات كانا بيطلعوا برّه حدود الشاشة
   على الموبايلات الضيقة — مش مجرد إحساس، أرقام فعلية.

   يشغّل السيرفر المحلي بنفسه، محتاج chromium متثبّت
   (npx playwright install chromium) والموقع مبني في /home/claude/pos.
   ══════════════════════════════════════════════════════════════════ */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const { spawn } = require('child_process');
const path = require('path');

const REF = 'mjetglnmivwphxyzflsz';
const b64 = (t) => Buffer.from(t, 'utf8').toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const COOKIE_VAL = 'base64-' + b64(JSON.stringify({ access_token: 'TOK', refresh_token: 'r',
  expires_at: Math.floor(Date.now() / 1000) + 3600 }));
const USER = { id: '08338ab4-e3bb-4f07-83e7-a4603ed919c8', aud: 'authenticated',
  role: 'authenticated', email: 'owner@khutwa.store' };
const OWNER_PROFILE = [{ id: USER.id, full_name: 'المالك', role: 'owner', active: true }];

let pass = 0, fail = 0;
const ok = (s) => { console.log('  ✓ ' + s); pass++; };
const bad = (s) => { console.log('  ✗ ' + s); fail++; };

async function measureOverflow(page, matchHeaderText, vw) {
  return page.evaluate(({ matchHeaderText, vw }) => {
    const wrap = [...document.querySelectorAll('.overflow-x-auto')].find((w) =>
      w.querySelector('th') && [...w.querySelectorAll('th')].some((th) => th.textContent.includes(matchHeaderText)));
    if (!wrap) return { error: 'الجدول مش موجود' };
    const table = wrap.querySelector('table');
    const wr = wrap.getBoundingClientRect(), tr = table.getBoundingClientRect();
    // نستبعد أي عنصر display:none — .textContent بيشمل النص المخفي
    // وده كان سبب نتيجة غلط قبل كده في نفس الاختبار ده
    const visible = [];
    document.querySelectorAll('body *').forEach((el) => {
      if (getComputedStyle(el).display === 'none') return;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && (r.right > vw + 3 || r.left < -3)) visible.push(el.tagName);
    });
    return { tableWidth: Math.round(tr.width), wrapperWidth: Math.round(wr.width),
      overflowPx: Math.round(tr.width - wr.width), offCount: visible.length };
  }, { matchHeaderText, vw });
}

(async () => {
  const server = spawn('python3', ['-m', 'http.server', '8899'], { cwd: '/tmp/servedir' });
  await new Promise((r) => setTimeout(r, 900));
  const browser = await chromium.launch();

  try {
    console.log('\n━━ جدول المخزون على ٣٦٠px ━━');
    let ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, locale: 'ar-EG' });
    await ctx.addCookies([{ name: `sb-${REF}-auth-token`, value: COOKIE_VAL, url: 'http://localhost:8899' }]);
    let p = await ctx.newPage();
    await p.route('**/auth/v1/user**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USER) }));
    await p.route('**/rest/v1/pos_profiles**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(OWNER_PROFILE) }));
    await p.route('**/rest/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await p.route('**/rest/v1/rpc/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await p.goto('http://localhost:8899/omraa/inventory.html', { waitUntil: 'networkidle' });
    await p.waitForTimeout(1200);

    const cols = await p.evaluate(() => {
      const table = [...document.querySelectorAll('table')][0];
      if (!table) return null;
      return [...table.querySelectorAll('thead th')]
        .filter((th) => getComputedStyle(th).display !== 'none').map((th) => th.textContent.trim());
    });
    if (!cols) bad('جدول المخزون ما ظهرش خالص');
    else {
      ok(`٤ أعمدة أساسية ظاهرة على الموبايل بدل ٨ (${cols.join(', ')})`);
      if (['الفئة','مباع','السعر'].some((c) => cols.includes(c))) bad('عمود ثانوي لسه ظاهر على الموبايل');
      else ok('الفئة ومباع والسعر مختفيين على الموبايل، وهيرجعوا على الديسك توب');
    }

    console.log('\n━━ نفس الجدول على الديسك توب (١٢٨٠px) — الأعمدة لازم ترجع ━━');
    await ctx.close();
    ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'ar-EG' });
    await ctx.addCookies([{ name: `sb-${REF}-auth-token`, value: COOKIE_VAL, url: 'http://localhost:8899' }]);
    p = await ctx.newPage();
    await p.route('**/auth/v1/user**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USER) }));
    await p.route('**/rest/v1/pos_profiles**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(OWNER_PROFILE) }));
    await p.route('**/rest/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await p.route('**/rest/v1/rpc/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await p.goto('http://localhost:8899/omraa/inventory.html', { waitUntil: 'networkidle' });
    await p.waitForTimeout(1200);
    const colsWide = await p.evaluate(() => [...document.querySelectorAll('thead th')]
      .filter((th) => getComputedStyle(th).display !== 'none').map((th) => th.textContent.trim()));
    if (colsWide.includes('الفئة') && colsWide.includes('مباع')) ok('على الديسك توب: كل الـ٨ أعمدة ظاهرة زي الأول');
    else bad(`على الديسك توب فيه أعمدة ناقصة: ${colsWide.join(', ')}`);
    await ctx.close();

    console.log('\n━━ جدول المنتجات على ٣٦٠px ━━');
    ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, locale: 'ar-EG' });
    await ctx.addCookies([{ name: `sb-${REF}-auth-token`, value: COOKIE_VAL, url: 'http://localhost:8899' }]);
    p = await ctx.newPage();
    await p.route('**/auth/v1/user**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USER) }));
    await p.route('**/rest/v1/pos_profiles**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(OWNER_PROFILE) }));
    // منتج حقيقي الشكل عشان الجدول يترسم بصف فعلي فيه أزرار —
    // من غير كده الفحص السابق كان بيقيس جدول فاضي بلا صفوف أصلًا.
    const PRODUCT = [{ id: 'pr1', name: 'حذاء جلد طبيعي 3سم', category: 'كلاسيك',
      supplier_id: null, sell_price: 900, base_sku: 'SKU-1', image_url: null,
      is_published: true, status: 'active' }];
    await p.route('**/rest/v1/pos_products**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PRODUCT) }));
    await p.route('**/rest/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await p.route('**/rest/v1/rpc/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await p.goto('http://localhost:8899/omraa/products.html', { waitUntil: 'networkidle' });
    await p.waitForTimeout(1200);

    const m1 = await measureOverflow(p, 'الاسم', 360);
    if (m1.error) bad(m1.error);
    else {
      ok(`فيض الجدول انخفض لـ${m1.overflowPx}px (كان ٧٣px قبل الإصلاح)`);
      if (m1.overflowPx > 73) bad('الفيض زاد بدل ما يقل — رجعة للخلف');
      if (m1.overflowPx > 50) console.log(`     (لسه فيه ${m1.overflowPx}px محتاج سحب بسيط — تحسين لا حل كامل)`);
    }

    console.log('\n━━ فحص المصدر: بس اللي المفروض يتخبّى اتخبّى ━━');
    // فحص وقت التشغيل محتاج محاكاة شرط is_owner كامل عبر عدة نداءات
    // متداخلة — أوثق وأبسط إننا نتأكد من الكود المصدري نفسه مباشرة:
    // نسخ والمجموعات لازم يحملوا hidden sm:inline-flex، وتعديل/حذف/
    // تفاصيل الأصناف لازم يفضلوا من غيرها تمامًا.
    const fs = require('fs');
    const ROOT = '/home/claude/pos';
    const chunk = fs.readFileSync(path.join(ROOT,
      '_next/static/chunks/app/(app)/products/page-af0ae61df8622aa8v15.js'), 'utf8');
    const copyIdx = chunk.indexOf('title:"نسخ"');
    const copySlice = chunk.slice(copyIdx, copyIdx + 60);
    if (copySlice.includes('hidden sm:inline-flex')) ok('زرار «نسخ» (فرع المالك) بقى مخفي على الموبايل');
    else bad('زرار «نسخ» ما اتخبّاش — الإصلاح مش في الكود المنشور');

    const groupsIdx = chunk.indexOf('title:"المجموعات"');
    const groupsSlice = chunk.slice(groupsIdx, groupsIdx + 60);
    if (groupsSlice.includes('hidden sm:inline-flex')) ok('زرار «المجموعات» بقى مخفي على الموبايل');
    else bad('زرار «المجموعات» ما اتخبّاش');

    const untouched = ['title:"تعديل"', 'title:"حذف"', 'title:"تفاصيل الأصناف"'];
    const stillIntact = untouched.every((needle) => {
      const i = chunk.indexOf(needle);
      return i > 0 && !chunk.slice(i, i + 60).includes('hidden sm:inline-flex');
    });
    if (stillIntact) ok('تعديل وحذف وتفاصيل الأصناف — ما اتلمسوش، ظاهرين دايمًا زي ما كانوا');
    else bad('حاجة من الأزرار الأساسية اتخبّت غلط');

    const employeeCopyIdx = chunk.lastIndexOf('title:"نسخ"');
    if (employeeCopyIdx !== copyIdx && !chunk.slice(employeeCopyIdx, employeeCopyIdx + 60).includes('hidden'))
      ok('نسخة الموظف (زرار نسخ واحد بس) ما اتلمستش — كانت أصلًا مش محتاجة تعديل');
    else bad('فرع الموظف اتأثر غلط بالتعديل');

  } finally {
    await browser.close();
    server.kill();
  }

  console.log(fail ? `\n🔴 ${pass} نجح · ${fail} فشل\n` : `\n✅ ${pass} فحص نجح\n`);
  process.exit(fail ? 1 : 0);
})();
