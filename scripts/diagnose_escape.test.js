/* diagnose.html: scan-log entries from localStorage are shown as text, never as HTML. */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/omraa/diagnose.html';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { console.log('  ✓ ' + m); pass++; } else { console.log('  ✗ ' + m); fail++; } };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext(); const p = await ctx.newPage();
  await p.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await p.addInitScript(() => { try { localStorage.setItem('omraa_scan_log', JSON.stringify([
    { t: Date.now(), src: '<img src=x onerror="window.__pwned=1">', ms: 40 }, { t: Date.now(), src: 'keyboard', ms: 20 }])); } catch (e) {} });
  await p.goto(BASE, { waitUntil: 'networkidle' }); await p.waitForTimeout(500);
  const r = await p.evaluate(() => ({ pw: !!window.__pwned, img: !!document.querySelector('#scanlog img'), txt: (document.getElementById('scanlog') || {}).textContent || '' }));
  ok(!r.pw && !r.img, 'نص السجل ماتنفّذش كـHTML');
  ok(r.txt.includes('keyboard') && r.txt.includes('<img'), 'السجل لسه ظاهر كنص زي الأول');
  console.log(`\n${pass} passed, ${fail} failed`); await b.close(); process.exit(fail ? 1 : 0);
})();
