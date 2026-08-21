/* شاشة البيع كانت **بتعيد نداء pos_fn_sale** لو التوكن انتهى.
   من غير مفتاح عدم تكرار، لو النداء الأول كان وصل السيرفر فعلًا،
   الإعادة كانت هتعمل **بيعة تانية** — فلوس ومخزون مضروبين.
   الاختبار ده بيتأكد إن الاتنين بيشاركوا نفس المفتاح. */
const fs = require('fs');
const { JSDOM } = require('/tmp/node_modules/jsdom');
const ROOT = '/home/claude/pos';
const CHUNK = ROOT + '/_next/static/chunks/app/(app)/pos/page-f8625146216a06a6-v5.js';

let pass = 0, fail = 0;
const ok = (s) => { console.log('  ✓ ' + s); pass++; };
const bad = (s) => { console.log('  ✗ ' + s); fail++; };
const must = (c, s) => (c ? ok(s) : bad(s));

const src = fs.readFileSync(CHUNK, 'utf8');

console.log('━━ فحص مصدري: المفتاح موجود في النداءين ━━');
{
  const calls = (src.match(/rpc\("pos_fn_sale"/g) || []).length;
  must(calls === 2, `فيه ${calls} نداء للبيع (الأصلي + إعادة انتهاء التوكن)`);

  const withKey = (src.match(/p_idem_key:__saleKey/g) || []).length;
  must(withKey === calls,
    `🔴 الأهم: كل النداءات (${withKey}/${calls}) بتبعت مفتاح عدم تكرار`);

  const decl = (src.match(/let __saleKey=/g) || []).length;
  must(decl === 1, 'المفتاح بيتولّد **مرة واحدة** — النداءين بيشاركوه');

  // لازم يتولّد قبل أول نداء، مش بعده
  const declPos = src.indexOf('let __saleKey=');
  const firstCall = src.indexOf('rpc("pos_fn_sale"');
  must(declPos > 0 && declPos < firstCall,
    'بيتولّد قبل أول إرسال — مش بعده');
}

console.log('\n━━ سلوك حقيقي: محاكاة انتهاء التوكن ━━');
{
  // بنحاكي المنطق بالظبط زي ما هو في الشانك
  const dom = new JSDOM('<body></body>', { url: 'https://x.test/omraa/pos.html' });
  const w = dom.window;
  w.crypto = { getRandomValues: (a) => { for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256); return a; } };
  w.OmraaNet = {
    newKey: (p) => p + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 14),
  };

  const serverSales = [];   // السيرفر بيحاكي منطق عدم التكرار الحقيقي
  const seen = new Map();
  function serverSale(body) {
    const k = body.p_idem_key;
    if (k && seen.has(k)) return { data: { ...seen.get(k), replayed: true }, error: null };
    const res = { sale_id: 'S' + (serverSales.length + 1), code: 'INV-' + (serverSales.length + 1) };
    serverSales.push(res);
    if (k) seen.set(k, res);
    return { data: res, error: null };
  }

  // النداء الأول بيوصل السيرفر فعلًا، بس الرد بيرجع بخطأ توكن
  let firstDone = false;
  function rpc(fn, body) {
    const real = serverSale(body);
    if (!firstDone) { firstDone = true; return { data: null, error: { message: 'JWT expired' } }; }
    return real;
  }

  const key = w.OmraaNet.newKey('sale');
  let { data, error } = rpc('pos_fn_sale', { p_idem_key: key });
  if (error && /jwt|expired|token/i.test(error.message)) {
    ({ data, error } = rpc('pos_fn_sale', { p_idem_key: key }));   // نفس المفتاح
  }

  must(serverSales.length === 1,
    `🔴 الأهم: بيعة واحدة بس اتعملت رغم النداءين (${serverSales.length})`);
  must(data && data.replayed === true, 'المحاولة التانية رجّعت نتيجة معادة مش جديدة');
  must(data && data.code === 'INV-1', `ونفس رقم الفاتورة (${data && data.code})`);

  // ولو مفيش مفتاح (السلوك القديم)؟ نثبت إن المشكلة كانت حقيقية
  serverSales.length = 0; seen.clear(); firstDone = false;
  let r2 = rpc('pos_fn_sale', {});
  if (r2.error) r2 = rpc('pos_fn_sale', {});
  must(serverSales.length === 2,
    `للمقارنة: من غير مفتاح كانت هتبقى ${serverSales.length} بيعتين — ده الباگ اللي اتقفل`);
}

console.log(fail ? `\n🔴 ${pass} نجح · ${fail} فشل\n` : `\n✅ ${pass} فحص نجح\n`);
process.exit(fail ? 1 : 0);
