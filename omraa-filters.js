/*! Al-Omraa System — © 2026 Mohab Beshier (Head of Performance) & Axis Marketing Agency.
    All rights reserved. Proprietary — licensed to the Al-Omraa shop only; resale or use
    for any other business is prohibited. See LICENSE.md. */
/* ═══════════════════════════════════════════════════════════════════
   omraa-filters.js — فلاتر لكل جدول في النظام + بحث شامل في الرئيسية.

   ١) أي جدول فيه ٦ صفوف أو أكتر بياخد شريط فلاتر فوقه لوحده:
      • بحث (لو الصفحة مافيهاش بحث أصلًا)
      • قوائم من قيم الأعمدة نفسها (القسم، المقاس، اللون، النوع، الحالة…)
      • المخزون: فيه / خلصان
      • التاريخ: النهارده / آخر ٧ أيام / آخر ٣٠ يوم / أقدم
      • «عرض X من Y» وزرار يشيل كل الفلاتر
      الفلتر بيخفي صفوف بس — مش بيلمس أي داتا، ومش بيتحفظ بين الفتحات
      (عشان محدش يفتح الصفحة يلاقي نص الداتا مستخبية وهو مش واخد باله).
   ٢) الرئيسية: خانة واحدة تدوّر في الموديلات والعملاء والفواتير والشحنات،
      وكل نتيجة بتفتح صفحتها على البحث ده.
   ٣) ?q= في رابط أي صفحة بيتكتب في خانة البحث بتاعتها لوحده.

   مبدأ: الملف ده بيبلع كل أخطائه — ممنوع يكسر أي صفحة.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.__omraaFilters) return;
  window.__omraaFilters = 1;

  var MIN_ROWS = 6;
  // صفحات ليها فلاتر خاصة بيها أو مالهاش جداول قوائم
  var SKIP = /\/(pos|products|photos|shipping|merchandising|website|login|labels|returns-v2|returns|diagnose|guide|settings|index|404)(\.html)?\/?$/;
  var page = function () { return location.pathname.replace(/\/+$/, ''); };

  /* ---------- أدوات ---------- */
  var AR_DIG = '٠١٢٣٤٥٦٧٨٩', FA_DIG = '۰۱۲۳۴۵۶۷۸۹';
  function latin(s) {
    return String(s == null ? '' : s).replace(/[٠-٩]/g, function (d) { return AR_DIG.indexOf(d); })
      .replace(/[۰-۹]/g, function (d) { return FA_DIG.indexOf(d); });
  }
  function norm(s) {
    return latin(s).toLowerCase()
      .replace(/[ً-ْٰـ‌-‏‪-‮]/g, '')
      .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
      .replace(/\s+/g, ' ').trim();
  }
  function clean(s) {   // نص الخلية للعرض في القايمة
    return String(s || '').replace(/[‌-‏‪-‮]/g, '').replace(/\s+/g, ' ').trim();
  }
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    for (var k in (attrs || {})) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'on') for (var ev in attrs.on) e.addEventListener(ev, attrs.on[ev]);
      else e.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }
  function log(ctx, err) { try { window.__omraaLog && window.__omraaLog(ctx, err, { severity: 'warn' }); } catch (_) {} }

  /* ---------- التواريخ ---------- */
  var MONTHS = { 'يناير': 1, 'فبراير': 2, 'مارس': 3, 'ابريل': 4, 'مايو': 5, 'يونيو': 6, 'يوليو': 7,
                 'اغسطس': 8, 'سبتمبر': 9, 'اكتوبر': 10, 'نوفمبر': 11, 'ديسمبر': 12 };
  function parseDate(txt) {
    var s = norm(txt);
    var m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (m) return new Date(+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[2] - 1, +m[1]);
    m = s.match(/(\d{1,2})\s+([^\s،,\d]+)(?:[\s،,]+(\d{4}))?/);
    if (m && MONTHS[m[2]]) {
      var now = new Date(), y = m[3] ? +m[3] : now.getFullYear();
      var d = new Date(y, MONTHS[m[2]] - 1, +m[1]);
      if (!m[3] && d - now > 2 * 864e5) d.setFullYear(y - 1);   // «٣ ديسمبر» في يناير = السنة اللي فاتت
      return d;
    }
    if (/النهارده|اليوم/.test(s)) return new Date();
    if (/امبارح|أمس|امس/.test(s)) return new Date(Date.now() - 864e5);
    return null;
  }
  function dayDiff(d) {
    var a = new Date(); a.setHours(0, 0, 0, 0);
    var b = new Date(d); b.setHours(0, 0, 0, 0);
    return Math.round((a - b) / 864e5);
  }

  /* ---------- CSS ---------- */
  function css() {
    if (document.getElementById('omraa-filters-css')) return;
    var st = document.createElement('style');
    st.id = 'omraa-filters-css';
    st.textContent =
      'tr[data-omraa-hide]{display:none!important}' +
      '.ofb{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 10px;padding:10px;background:#f8fafc;' +
      'border:1px solid #e2e8f0;border-radius:12px;direction:rtl;font-family:inherit}' +
      '.ofb input,.ofb select{border:1px solid #e2e8f0;border-radius:9px;padding:8px 10px;font:inherit;font-size:13px;' +
      'background:#fff;color:#0f172a;min-height:38px;min-width:0}' +
      '.ofb input{flex:1 1 200px}.ofb select{flex:0 1 auto;max-width:200px}' +
      '.ofb select.on{border-color:#4f46e5;background:#eef2ff;font-weight:600}' +
      '.ofb .ofb-n{font-size:12px;color:#64748b;white-space:nowrap;margin-inline-start:auto}' +
      '.ofb .ofb-x{border:0;background:#0f172a;color:#fff;border-radius:9px;padding:8px 12px;font:inherit;font-size:12.5px;cursor:pointer;min-height:38px}' +
      '.ofb .ofb-none{width:100%;text-align:center;color:#64748b;font-size:13px;padding:6px 0 0}' +
      '@media (max-width:700px){.ofb select{flex:1 1 140px;max-width:none}.ofb input,.ofb select{font-size:16px;min-height:42px}}' +
      '.ogs{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:14px;margin:0 0 16px;direction:rtl}' +
      '.ogs h3{margin:0 0 8px;font-size:15px}' +
      '.ogs input{width:100%;box-sizing:border-box;border:1px solid #e2e8f0;border-radius:11px;padding:11px 13px;font:inherit;font-size:15px}' +
      '.ogs .ogs-r{margin-top:10px;display:grid;gap:10px}' +
      '.ogs .ogs-g h4{margin:0 0 6px;font-size:12.5px;color:#64748b;font-weight:600}' +
      '.ogs a{display:flex;gap:8px;align-items:center;padding:9px 11px;border:1px solid #f1f5f9;border-radius:10px;' +
      'text-decoration:none;color:#0f172a;font-size:13.5px;margin-bottom:6px;background:#fff}' +
      '.ogs a:hover{border-color:#4f46e5;background:#f5f7ff}' +
      '.ogs a small{color:#64748b;margin-inline-start:auto;font-size:12px;white-space:nowrap}' +
      '.ogs .ogs-sku{font-family:ui-monospace,Menlo,monospace;font-size:11px;font-weight:700;background:#eef2ff;color:#3730a3;' +
      'border-radius:6px;padding:0 6px;direction:ltr;unicode-bidi:isolate}' +
      '.ogs .ogs-m{color:#64748b;font-size:13px}' +
      '.ogs .ogs-q{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}' +
      '.ogs .ogs-q a{margin:0;padding:7px 11px;font-size:12.5px;border-color:#e2e8f0}';
    (document.head || document.documentElement).appendChild(st);
  }

  /* ═══════════ ١) فلاتر الجداول ═══════════ */
  var FACET_HEAD = /الفئه|القسم|المقاس|اللون|النوع|الحاله|الجدول|الدور|طريقه الدفع|الدفع|المندوب|التاجر|المحافظه/;
  var SKIP_HEAD = /الهاتف|الموبايل|العميل|الاسم|المنتج|الوصف|العنصر|الملاحظه|اجراءات|الباركود|مباع|مبيعات|متوسط|توقع|تغطيه|صفوف|ربح|تكلفه|صافي|مصروف|اجمالي|المبلغ|نسبه|النقاط/;
  var STOCK_HEAD = /^(المخزون|المتاح|بالمخزون)/;
  var DATE_HEAD = /التاريخ|اخر زياره|الوقت|تاريخ/;

  function hasOwnSearch(table) {
    // خانة بحث موجودة في نفس الكارت فوق الجدول؟ يبقى مش هنكرّرها
    var box = table.parentElement;
    for (var i = 0; i < 4 && box; i++, box = box.parentElement) {
      var ins = box.querySelectorAll('input[type=text],input[type=search],input:not([type])');
      for (var j = 0; j < ins.length; j++) {
        if (table.contains(ins[j]) || ins[j].closest('.ofb')) continue;
        if (ins[j].compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING) return ins[j];
      }
    }
    return null;
  }

  function rowsOf(t) {
    var b = t.tBodies && t.tBodies[0];
    if (!b) return [];
    return [].filter.call(b.rows, function (r) { return r.cells.length > 1; });   // صف «مفيش بيانات» بخلية واحدة
  }

  function attach(table, idx) {
    var heads = [].map.call(table.querySelectorAll('thead th'), function (th) { return clean(th.textContent).replace(/[⇅↑↓▲▼]/g, '').trim(); });
    var state = { q: '', f: {} };
    var ownSearch = hasOwnSearch(table);
    var bar = el('div', { class: 'ofb', role: 'search', 'aria-label': 'فلاتر الجدول' });
    var search = null;
    if (!ownSearch) {
      search = el('input', { type: 'search', placeholder: 'دوّري في الجدول…', 'aria-label': 'بحث في الجدول' });
      search.addEventListener('input', function () { state.q = search.value; apply(); });
      bar.appendChild(search);
    }
    var cols = [];   // {i, kind, sel}
    heads.forEach(function (h, i) {
      var nh = norm(h);
      if (!nh) return;
      var kind = STOCK_HEAD.test(nh) ? 'stock' : DATE_HEAD.test(nh) ? 'date'
        : (!SKIP_HEAD.test(nh) ? 'facet' : null);
      if (!kind) return;
      var sel = el('select', { 'aria-label': h });
      sel.addEventListener('change', function () {
        state.f[i] = sel.value; sel.classList.toggle('on', !!sel.value); apply();
      });
      cols.push({ i: i, kind: kind, sel: sel, head: h, nh: nh });
    });
    var count = el('span', { class: 'ofb-n' });
    var reset = el('button', { type: 'button', class: 'ofb-x', text: 'شيل الفلاتر', on: { click: function () {
      state.q = ''; state.f = {};
      if (search) search.value = '';
      cols.forEach(function (c) { c.sel.value = ''; c.sel.classList.remove('on'); });
      apply();
    } } });
    var none = el('div', { class: 'ofb-none', text: 'مفيش صفوف بالفلاتر دي' });

    function cellText(r, i) { var c = r.cells[i]; return c ? clean(c.textContent) : ''; }

    function rebuildOptions() {
      var rows = rowsOf(table);
      cols.forEach(function (c) {
        var cur = c.sel.value;
        var opts;
        if (c.kind === 'stock') {
          opts = [['', c.head + ': الكل'], ['in', 'فيه مخزون'], ['out', 'خلصان']];
        } else if (c.kind === 'date') {
          opts = [['', c.head + ': الكل'], ['0', 'النهارده'], ['7', 'آخر ٧ أيام'], ['30', 'آخر ٣٠ يوم'],
                  ['90', 'آخر ٣ شهور'], ['old', 'أقدم من ٣ شهور']];
        } else {
          var seen = {}, list = [];
          rows.forEach(function (r) { var v = cellText(r, c.i); if (v && !seen[v]) { seen[v] = 1; list.push(v); } });
          var limit = FACET_HEAD.test(c.nh) ? 60 : 15;
          // عمود فيه قيمة مختلفة في كل صف (أو قيمة وحدة) مش فلتر مفيد
          if (list.length < 2 || list.length > limit || list.length > rows.length * 0.8) { c.off = true; return; }
          c.off = false;
          list.sort(function (a, b) {
            var na = parseFloat(latin(a)), nb = parseFloat(latin(b));
            return (!isNaN(na) && !isNaN(nb)) ? na - nb : a.localeCompare(b, 'ar');
          });
          opts = [['', c.head + ': الكل']].concat(list.map(function (v) { return [v, v]; }));
        }
        c.sel.innerHTML = '';
        opts.forEach(function (o) { c.sel.appendChild(el('option', { value: o[0], text: o[1] })); });
        c.sel.value = opts.some(function (o) { return o[0] === cur; }) ? cur : '';
        if (c.sel.value !== cur) { delete state.f[c.i]; c.sel.classList.remove('on'); }
      });
      // ترتيب الإدراج: البحث، القوائم، العدد، زرار المسح
      cols.forEach(function (c) {
        if (c.off) { if (c.sel.parentNode) c.sel.parentNode.removeChild(c.sel); }
        else if (!c.sel.parentNode) bar.insertBefore(c.sel, count);
      });
    }

    function matches(r) {
      if (state.q) {
        var nq = norm(state.q);
        if (norm(r.textContent).indexOf(nq) < 0) return false;
      }
      for (var k = 0; k < cols.length; k++) {
        var c = cols[k], v = state.f[c.i];
        if (!v || c.off) continue;
        var t = cellText(r, c.i);
        if (c.kind === 'facet') { if (t !== v) return false; }
        else if (c.kind === 'stock') {
          var n = parseFloat(latin(t).replace(/[^\d.-]/g, '')) || 0;
          if (v === 'in' && !(n > 0)) return false;
          if (v === 'out' && n > 0) return false;
        } else if (c.kind === 'date') {
          var d = parseDate(t);
          if (!d) return false;
          var dd = dayDiff(d);
          if (v === 'old') { if (dd <= 90) return false; }
          else if (dd > +v || dd < 0 && +v === 0) return false;
        }
      }
      return true;
    }

    var applying = false;
    function apply() {
      applying = true;
      try {
        var rows = rowsOf(table), shown = 0;
        var active = !!state.q || Object.keys(state.f).some(function (k) { return state.f[k]; });
        rows.forEach(function (r) {
          var ok = !active || matches(r);
          if (ok) { shown++; if (r.hasAttribute('data-omraa-hide')) r.removeAttribute('data-omraa-hide'); }
          else if (!r.hasAttribute('data-omraa-hide')) r.setAttribute('data-omraa-hide', '1');
        });
        count.textContent = active ? ('عرض ' + shown.toLocaleString('ar-EG') + ' من ' + rows.length.toLocaleString('ar-EG'))
                                   : (rows.length.toLocaleString('ar-EG') + ' صف');
        if (active && !reset.parentNode) bar.appendChild(reset);
        if (!active && reset.parentNode) bar.removeChild(reset);
        if (active && shown === 0) { if (!none.parentNode) bar.appendChild(none); }
        else if (none.parentNode) bar.removeChild(none);
      } finally { applying = false; }
    }

    bar.appendChild(count);
    rebuildOptions();
    // البار يتحط فوق الحاوية اللي بتعمل سكرول للجدول (لو موجودة)، مش جوّاها
    var anchor = table;
    var p = table.parentElement;
    if (p && p.children.length === 1 && p !== document.body) anchor = p;
    anchor.parentNode.insertBefore(bar, anchor);
    apply();

    // React بيعيد رسم الصفوف (بحث الصفحة، تحديث، ترتيب) — نعيد التطبيق بعده
    var t = null;
    var mo = new MutationObserver(function () {
      if (applying) return;
      clearTimeout(t);
      t = setTimeout(function () { try { rebuildOptions(); apply(); } catch (e) { log('filters.apply', e); } }, 80);
    });
    mo.observe(table, { childList: true, subtree: true, characterData: true });
    table.__omraaFilter = { bar: bar, mo: mo };
    return bar;
  }

  function scanTables() {
    if (SKIP.test(page())) return;
    var tables = document.querySelectorAll('table');
    for (var i = 0; i < tables.length; i++) {
      var t = tables[i];
      if (t.__omraaFilter) {
        // الجدول اتشال واتحط تاني (تنقّل بين صفحات)؟ البار لازم يفضل جنبه
        if (!t.__omraaFilter.bar.isConnected) { try { t.__omraaFilter.mo.disconnect(); } catch (_) {} t.__omraaFilter = null; }
        else continue;
      }
      if (t.closest('[role=dialog],dialog,.modal,[data-omraa-nofilter]')) continue;
      if (!t.querySelector('thead th')) continue;
      if (rowsOf(t).length < MIN_ROWS) continue;
      try { attach(t, i); } catch (e) { log('filters.attach', e); }
    }
  }

  /* ═══════════ ٣) ?q= بيتكتب في خانة البحث ═══════════ */
  var qDone = {};
  function prefillQ() {
    var q = '';
    try { q = new URLSearchParams(location.search).get('q') || ''; } catch (_) {}
    if (!q || qDone[location.pathname + location.search]) return;
    var inputs = [].filter.call(document.querySelectorAll('input[type=text],input[type=search],input:not([type])'),
      function (x) { return (x.offsetWidth || x.offsetHeight) && !x.closest('.ogs'); });
    // الأولوية لخانة «بحث» الصريحة، بعدها خانة الاسم، وآخر حاجة خانة المسح
    var rank = function (x) {
      var p = x.placeholder || '';
      return /بحث|ابحث|دور|دوّر/.test(p) ? 0 : /اسم|SKU/i.test(p) ? 1 : /امسح/.test(p) ? 2 : 9;
    };
    inputs.sort(function (a, b) { return rank(a) - rank(b); });
    for (var i = 0; i < inputs.length; i++) {
      var inp = inputs[i];
      if (rank(inp) === 9) continue;
      // لازم نكتب بالطريقة اللي React بيسمعها
      var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(inp, q);
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      qDone[location.pathname + location.search] = 1;
      return;
    }
  }

  /* ═══════════ ٢) البحث الشامل في الرئيسية ═══════════ */
  function rpc(fn, body) {
    if (window.OmraaNet && window.OmraaNet.rpc) return window.OmraaNet.rpc(fn, body || {}, { retries: 1, timeout: 12000 });
    return Promise.reject(new Error('net layer missing'));
  }
  var gsBuilt = false;
  function buildGlobalSearch() {
    if (!/\/dashboard(\.html)?$/.test(page())) return;
    var box = document.querySelector('.ogs');
    if (box && box.isConnected) return;
    // نلاقي عنوان «لوحة التحكم» ونحط الخانة بعد الصف بتاعه
    var h = [].find.call(document.querySelectorAll('h1,h2'), function (x) { return /لوحة التحكم/.test(x.textContent); });
    if (!h) return;
    var row = h.parentElement && h.parentElement.children.length <= 3 ? h.parentElement : h;
    if (!row.parentNode) return;
    gsBuilt = true;

    var input = el('input', { type: 'search', placeholder: 'دوّري في كل السيستم: موديل، SKU، باركود، عميلة، موبايل، فاتورة…',
                              'aria-label': 'بحث في كل السيستم' });
    var res = el('div', { class: 'ogs-r', 'aria-live': 'polite' });
    var quick = el('div', { class: 'ogs-q' }, [
      ['inventory.html', '📦 المخزون'], ['products.html', '👟 المنتجات'], ['photos.html', '🖼️ صور المنتجات'],
      ['customers.html', '👥 العملاء'], ['shipping.html', '🚚 الشحن'], ['returns-v2.html', '↩️ المرتجعات'],
      ['orders.html', '🛒 طلبات الموقع'], ['accounting.html', '📊 الحسابات']
    ].map(function (x) { return el('a', { href: x[0], text: x[1] }); }));
    box = el('section', { class: 'ogs' }, [el('h3', { text: 'دوّري في كل حاجة' }), input, res, quick]);
    row.parentNode.insertBefore(box, row.nextSibling);

    var seq = 0, timer = null;
    function group(title, items) {
      if (!items.length) return null;
      return el('div', { class: 'ogs-g' }, [el('h4', { text: title })].concat(items));
    }
    function link(href, label, small, sku) {
      var a = el('a', { href: href });
      if (sku) a.appendChild(el('span', { class: 'ogs-sku', text: sku }));
      a.appendChild(document.createTextNode(label));
      if (small) a.appendChild(el('small', { text: small }));
      return a;
    }
    function run() {
      var q = latin(input.value).trim();
      var mine = ++seq;
      res.innerHTML = '';
      if (q.length < 2) return;
      res.appendChild(el('div', { class: 'ogs-m', text: 'بيدوّر…' }));
      var enc = encodeURIComponent(q);
      var tasks = [
        rpc('shop_fn_admin_photo_queue', { p_q: q }).then(function (rows) {
          return group('الموديلات', (rows || []).slice(0, 6).map(function (p) {
            return link('products.html?q=' + encodeURIComponent(p.base_sku || p.name), p.name,
              (p.in_stock || 0).toLocaleString('ar-EG') + ' قطعة' + (p.photo_count ? '' : ' · من غير صور'), p.base_sku);
          }));
        }),
        rpc('pos_fn_search_customers', { p_query: q }).then(function (rows) {
          return group('العملاء', (rows || []).slice(0, 5).map(function (c) {
            return link('customers.html?q=' + encodeURIComponent(c.phone || c.name), c.name || 'بدون اسم', c.phone || '');
          }));
        }),
        rpc('pos_fn_find_returnable', { p_query: q }).then(function (r) {
          var seen = {}, items = [];
          ((r && r.candidates) || []).forEach(function (x) {
            if (seen[x.sale_code] || items.length >= 5) return; seen[x.sale_code] = 1;
            items.push(link('returns-v2.html?q=' + encodeURIComponent(x.sale_code), (x.sale_code || '') + ' — ' + (x.customer || ''),
              (x.product || '') + (x.size ? ' · ' + x.size : '') + (x.color ? ' · ' + x.color : '')));
          });
          return group('الفواتير (للمرتجع)', items);
        }),
        Promise.all([rpc('pos_fn_shipments', { p_view: 'active' }), rpc('pos_fn_shipments', { p_view: 'money' })]).then(function (rs) {
          var nq = norm(q), seen = {}, items = [];
          rs.forEach(function (r) { ((r && r.shipments) || []).forEach(function (s) {
            if (seen[s.id] || items.length >= 5) return;
            var hay = norm([s.customer, s.phone, s.sale_code, s.address, s.courier].join(' '));
            if (hay.indexOf(nq) < 0) return;
            seen[s.id] = 1;
            items.push(link('shipping.html?q=' + encodeURIComponent(s.phone || s.sale_code || s.customer), (s.customer || 'شحنة') + (s.sale_code ? ' — ' + s.sale_code : ''),
              s.status_label || ''));
          }); });
          return group('الشحنات', items);
        })
      ].map(function (p) { return p.catch(function () { return null; }); });
      Promise.all(tasks).then(function (groups) {
        if (mine !== seq) return;
        res.innerHTML = '';
        var any = false;
        groups.forEach(function (g) { if (g) { res.appendChild(g); any = true; } });
        if (!any) res.appendChild(el('div', { class: 'ogs-m', text: 'مفيش نتايج لـ «' + q + '»' }));
      });
    }
    input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(run, 300); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { clearTimeout(timer); run(); } });
  }

  /* ---------- التشغيل ---------- */
  var pending = null;
  function tick() {
    pending = null;
    try { css(); scanTables(); prefillQ(); buildGlobalSearch(); } catch (e) { log('filters.tick', e); }
  }
  function schedule() { if (!pending) pending = setTimeout(tick, 250); }
  function start() {
    schedule();
    try {
      new MutationObserver(function (muts) {
        // تغييراتنا إحنا (البار والإخفاء) مش محتاجة فحص جديد
        for (var i = 0; i < muts.length; i++) {
          var t = muts[i].target;
          if (t && t.closest && (t.closest('.ofb') || t.closest('.ogs'))) continue;
          schedule(); return;
        }
      }).observe(document.body, { childList: true, subtree: true });
    } catch (e) { log('filters.observe', e); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
