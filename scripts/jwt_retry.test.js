/* «JWT expired»: الطلب يتعاد مرة واحدة بالتوكن الجديد، ومفيش بانر «انتهت الجلسة»
   إلا لو التجديد فشل فعلًا. تشغيل: JSDOM=<path> node scripts/jwt_retry.test.js omraa-telemetry.js */
const fs = require('fs');
const { JSDOM } = require(process.env.JSDOM || 'jsdom');
const CODE = fs.readFileSync(process.argv[2] || 'omraa-telemetry.js', 'utf8');
const SB = 'https://mjetglnmivwphxyzflsz.supabase.co', REF = 'mjetglnmivwphxyzflsz';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qZXRnbG5taXZ3cGh4eXpmbHN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NTcwODgsImV4cCI6MjA5NjQzMzA4OH0.X6Rvxo4owPcBwE4HqXLm5fuPDSdEo8PV9oBV-bHsGrg';
const tok = (n) => 'h.' + Buffer.from(JSON.stringify({ n, iat: Math.floor(Date.now() / 1000) })).toString('base64url') + '.s';
let pass = 0, fail = 0;
const must = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function boot() {
  const dom = new JSDOM('<body></body>', { runScripts: 'dangerously', url: 'https://mohabbeshier.github.io/omraa/inventory.html' });
  const w = dom.window, calls = [];
  w.localStorage.setItem(`sb-${REF}-auth-token`, JSON.stringify({ access_token: tok('A'), expires_at: Math.floor(Date.now() / 1000) + 3600 }));
  w.fetch = async (u, o) => {
    const auth = o && o.headers ? (typeof o.headers.get === 'function' ? o.headers.get('Authorization') : o.headers.Authorization) : '';
    calls.push({ u: String(u), auth, body: o && o.body });
    const body = String(u).includes('pos_fn_server_time') ? String(Date.now()) : (auth && auth.includes(tok('A')) ? '{"code":"PGRST303","message":"JWT expired"}' : '{"ok":true}');
    const status = String(u).includes('pos_fn_server_time') ? 200 : (auth && auth.includes(tok('A')) ? 401 : 200);
    const mk = () => ({ ok: status < 300, status, text: async () => body, json: async () => JSON.parse(body), clone: mk });
    return mk();
  };
  w.__omraaLog = () => {};
  const el = w.document.createElement('script'); el.textContent = CODE; w.document.body.appendChild(el);
  let fails = 0; const orig = w.__omraaAuthFail; w.__omraaAuthFail = () => { fails++; orig && orig(); };
  return { w, calls, fails: () => fails };
}

(async () => {
  console.log('① التوكن اتجدد أثناء الانتظار');
  let b = boot();
  setTimeout(() => b.w.localStorage.setItem(`sb-${REF}-auth-token`, JSON.stringify({ access_token: tok('B'), expires_at: Math.floor(Date.now() / 1000) + 3600 })), 700);
  let r = await b.w.fetch(SB + '/rest/v1/rpc/pos_fn_inventory_summary', { method: 'POST', headers: { Authorization: 'Bearer ' + tok('A'), apikey: ANON }, body: '{}' });
  must(r.status === 200, 'الطلب رجع ناجح بعد إعادته');
  const rpcCalls = b.calls.filter((c) => c.u.includes('inventory_summary'));
  must(rpcCalls.length === 2 && rpcCalls[1].auth === 'Bearer ' + tok('B') && rpcCalls[1].body === '{}', 'اتعاد مرة واحدة بالتوكن الجديد ونفس البيانات');
  await sleep(50);
  must(b.fails() === 0 && ![...b.w.document.querySelectorAll('div')].some((d) => d.textContent.startsWith('⚠️ انتهت الجلسة')), 'مفيش بانر «انتهت الجلسة» (fails=' + b.fails() + ')');

  console.log('② التوكن ما اتجددش');
  b = boot();
  r = await b.w.fetch(SB + '/rest/v1/pos_products?select=id', { headers: { Authorization: 'Bearer ' + tok('A'), apikey: ANON } });
  must(r.status === 401, 'الرد الأصلي بيرجع زي ما هو بعد ٨ ثواني');
  must(b.fails() === 1, 'اتحسب فشل جلسة واحد');

  console.log('③ طلبات مالهاش علاقة');
  b = boot();
  await b.w.fetch(SB + '/rest/v1/rpc/shop_fn_catalog', { method: 'POST', headers: { Authorization: 'Bearer ' + ANON, apikey: ANON }, body: '{}' });
  must(b.calls.filter((c) => c.u.includes('shop_fn_catalog')).length === 1, 'طلب بمفتاح anon ما بيتعادش');
  console.log(`\n${pass} نجح، ${fail} فشل`);
  process.exit(fail ? 1 : 0);
})();
