/* ══════════════════════════════════════════════════════════════════
   اللوجو الحقيقي (حذاء دهبي + خط الأمراء) اتطبّق بدل الصندوق البنفسجي
   بحرف "أ" — في: أيقونات PWA، صفحة الدخول، وسايدبار كل صفحة داخلية.

   فخ حقيقي وقعت فيه ووثّقته: تعديل HTML الثابت المُصدَّر بس مش كفاية.
   Next.js بيعمل hydration بعد التحميل، ولو مكوّن React الفعلي (جوّه
   شانك الـJS) لسه فيه الماركب القديم، الـhydration بترجّعه فورًا —
   حتى لو HTML الأساسي كان صح. لازم تتعدّل السورس في الشانك نفسه.
   ══════════════════════════════════════════════════════════════════ */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const { spawn } = require('child_process');
const fs = require('fs');

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

(async () => {
  const server = spawn('python3', ['-m', 'http.server', '8899'], { cwd: '/tmp/servedir' });
  await new Promise((r) => setTimeout(r, 900));
  const browser = await chromium.launch();

  try {
    console.log('\n━━ ملفات الأيقونات موجودة فعليًا وحجمها معقول ━━');
    const ROOT = '/home/claude/pos';
    for (const f of ['icon-192.png', 'icon-512.png', 'icon-maskable-192.png',
      'icon-maskable-512.png', 'apple-touch-icon.png', 'icon.svg', 'brand-assets/login-hero.png']) {
      const p = `${ROOT}/${f}`;
      if (!fs.existsSync(p)) { bad(`${f} مفقود`); continue; }
      const size = fs.statSync(p).size;
      if (size < 500) bad(`${f} صغير جدًا (${size} بايت) — يمكن فاضي`);
      else ok(`${f} موجود (${(size / 1024).toFixed(1)} ك.ب)`);
    }

    console.log('\n━━ صفحة الدخول: اللوجو ظاهر ومش بيرجع للصندوق القديم بعد hydration ━━');
    let ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ar-EG' });
    let p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto('http://localhost:8899/omraa/login.html', { waitUntil: 'networkidle' });
    await p.waitForTimeout(300);
    const immediate = await p.evaluate(() => ({
      old: !!document.querySelector('.bg-indigo-600.rounded-2xl'),
      img: !!document.querySelector('img[src*="login-hero"]'),
    }));
    // الفحص الحاسم: بعد الـhydration بوقت كافي، لسه اللوجو الجديد ولا رجع القديم؟
    await p.waitForTimeout(1500);
    const settled = await p.evaluate(() => ({
      old: !!document.querySelector('.bg-indigo-600.rounded-2xl'),
      img: !!document.querySelector('img[src*="login-hero"]'),
    }));
    if (immediate.img && settled.img && !settled.old)
      ok('اللوجو ظاهر فورًا وفاضل ظاهر بعد الـhydration — مفيش رجوع للصندوق القديم');
    else bad(`فشل: فوري=${JSON.stringify(immediate)} بعد الاستقرار=${JSON.stringify(settled)}`);
    if (errs.length) bad(`أخطاء JS: ${errs.slice(0, 2).join(' | ')}`);
    else ok('مفيش أخطاء JS');
    await ctx.close();

    console.log('\n━━ سايدبار كل صفحة داخلية: نفس الفحص بجلسة مالك حقيقية ━━');
    ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'ar-EG' });
    await ctx.addCookies([{ name: `sb-${REF}-auth-token`, value: COOKIE_VAL, url: 'http://localhost:8899' }]);
    p = await ctx.newPage();
    await p.route('**/auth/v1/user**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USER) }));
    await p.route('**/rest/v1/pos_profiles**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(OWNER_PROFILE) }));
    await p.route('**/rest/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await p.route('**/rest/v1/rpc/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await p.goto('http://localhost:8899/omraa/dashboard.html', { waitUntil: 'networkidle' });
    await p.waitForTimeout(1500);
    const sidebar = await p.evaluate(() => ({
      old: !!document.querySelector('.bg-indigo-600.rounded-xl'),
      img: !!document.querySelector('img[src*="icon-192"]'),
    }));
    if (sidebar.img && !sidebar.old) ok('سايدبار لوحة التحكم: أيقونة الحذاء ظاهرة، مفيش صندوق بنفسجي');
    else bad(`سايدبار فيه مشكلة: ${JSON.stringify(sidebar)}`);
    await ctx.close();

    console.log('\n━━ فحص مصدري: نفس الأزرار والوظائف اللي حواليه ما اتلمستش ━━');
    const loginChunk = fs.readFileSync(`${ROOT}/_next/static/chunks/app/(auth)/login/page-53dc23f08d19c7bb.js`, 'utf8');
    if (loginChunk.includes('signInWithPassword') && loginChunk.includes('تسجيل الدخول'))
      ok('منطق تسجيل الدخول والزرار لسه سليمين في نفس الملف');
    else bad('منطق الدخول اتأثر غلط');

  } finally {
    await browser.close();
    server.kill();
  }

  console.log(fail ? `\n🔴 ${pass} نجح · ${fail} فشل\n` : `\n✅ ${pass} فحص نجح\n`);
  process.exit(fail ? 1 : 0);
})();
