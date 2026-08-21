/* ═══════════════════════════════════════════════════════════════════
   omraa-net.js — طبقة الصمود أمام انقطاع النت.

   الفلسفة: النظام يفضل «متصل لحظيًا» (عشان مستحيل تتباع قطعة مرتين)،
   بس ما يضيّعش شغل الكاشير ولا يسيبه في الضلمة لما النت يقع.

   بيتحمّل في كل صفحة. ما بيغيّرش أي منطق موجود — بيضيف فوقه.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.OmraaNet) return;

  var SUPA = 'https://mjetglnmivwphxyzflsz.supabase.co';
  var ANON = (window.__OMRAA_ANON__ || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qZXRnbG5taXZ3cGh4eXpmbHN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NTcwODgsImV4cCI6MjA5NjQzMzA4OH0.X6Rvxo4owPcBwE4HqXLm5fuPDSdEo8PV9oBV-bHsGrg');
  var LS = {
    queue: 'omraa.queue.v1',
    drafts: 'omraa.drafts.v1',
    catalog: 'omraa.catalog.v1',
    outages: 'omraa.outages.v1',
    codes: 'omraa.codes.v1',
  };

  /* ---------- أدوات تخزين آمنة (الوضع الخاص بيرمي استثناء) ---------- */
  function read(k, dflt) {
    try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : dflt; }
    catch (_) { return dflt; }
  }
  function write(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch (_) { return false; }   // ممتلئ أو محظور — منكسرش الصفحة
  }

  /* ---------- قراءة الجلسة (كوكي أولًا زي باقي النظام) ---------- */
  function cookieChunks(name) {
    var out = [], all = document.cookie ? document.cookie.split('; ') : [];
    var exact = null, parts = [];
    for (var i = 0; i < all.length; i++) {
      var eq = all[i].indexOf('='); if (eq < 0) continue;
      var k = all[i].slice(0, eq), v = all[i].slice(eq + 1);
      if (k === name) exact = v;
      else if (k.indexOf(name + '.') === 0) {
        var idx = parseInt(k.slice(name.length + 1), 10);
        if (!isNaN(idx)) parts.push([idx, v]);
      }
    }
    if (exact !== null) return exact;
    if (!parts.length) return null;
    parts.sort(function (a, b) { return a[0] - b[0]; });
    for (var j = 0; j < parts.length; j++) out.push(parts[j][1]);
    return out.join('');
  }
  function b64urlToText(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);   // atob وحده بيكسر العربي
  }
  function token() {
    try {
      var keys = [], i;
      for (i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf('sb-') === 0 && k.indexOf('-auth-token') > 0) keys.push(k);
      }
      var raw = null;
      var m = document.cookie.match(/sb-([a-z0-9]+)-auth-token/);
      if (m) raw = cookieChunks('sb-' + m[1] + '-auth-token');
      if (!raw && keys.length) raw = localStorage.getItem(keys[0]);
      if (!raw) return null;
      if (raw.indexOf('base64-') === 0) raw = b64urlToText(raw.slice(7));
      var o = JSON.parse(raw);
      if (Array.isArray(o)) o = o[0];
      if (o && o.currentSession) o = o.currentSession;
      return (o && o.access_token) || null;
    } catch (_) { return null; }
  }

  /* ---------- مفتاح فريد لكل عملية (أساس عدم التكرار) ---------- */
  function newKey(prefix) {
    var rnd;
    try {
      var a = new Uint8Array(16); crypto.getRandomValues(a);
      rnd = Array.prototype.map.call(a, function (x) {
        return ('0' + x.toString(16)).slice(-2); }).join('');
    } catch (_) { rnd = String(Math.random()).slice(2) + String(Date.now()); }
    return (prefix || 'op') + '-' + Date.now().toString(36) + '-' + rnd;
  }

  /* ═══════════ ① كشف الاتصال الحقيقي ═══════════
     navigator.onLine بيكدب: بيقول "متصل" طالما فيه واي-فاي حتى لو
     الراوتر مقطوع عن النت. الطريقة الوحيدة الموثوقة: نبض فعلي. */
  var state = {
    online: navigator.onLine !== false,
    quality: 'good',            // good | slow | down
    lastOk: Date.now(),
    rtts: [],                   // آخر أزمنة استجابة
    flaps: [],                  // أوقات التغيّر — لكشف التقطّع
    outageStart: null,
    cautious: false,
  };
  var listeners = [];
  function emit() {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](state); } catch (_) {}
    }
    paintBadge();
  }

  function setOnline(ok, rtt) {
    var was = state.online;
    state.online = ok;
    if (ok) {
      state.lastOk = Date.now();
      if (typeof rtt === 'number') {
        state.rtts.push(rtt);
        if (state.rtts.length > 5) state.rtts.shift();
        /* ② إنذار مبكر: متوسط آخر ٣ نبضات فوق ٢.٥ ثانية = النت بيضعف */
        var last3 = state.rtts.slice(-3);
        var avg = last3.reduce(function (a, b) { return a + b; }, 0) / last3.length;
        state.quality = (last3.length >= 3 && avg > 2500) ? 'slow' : 'good';
      }
    } else {
      state.quality = 'down';
    }

    if (was !== ok) {
      state.flaps.push(Date.now());
      state.flaps = state.flaps.filter(function (t) { return Date.now() - t < 60000; });
      /* ③ نت متقطّع: ٣ تغيّرات في دقيقة = وضع حذر */
      state.cautious = state.flaps.length >= 3;

      if (!ok) {
        state.outageStart = Date.now();
      } else if (state.outageStart) {
        /* ④ سجل الانقطاع — بيتبعت لما النت يرجع */
        var dur = Date.now() - state.outageStart;
        state.outageStart = null;
        if (dur > 3000 && dur < 3600000) queueOutage(dur);
        flush();   // النت رجع: ابعت المعلّق
      }
    }
    emit();
  }

  var pinging = false;
  function ping() {
    if (pinging) return Promise.resolve(state.online);
    pinging = true;
    var t0 = Date.now();
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 8000);
    // نداء خفيف جدًا على Supabase نفسه — مش على موقع تاني، عشان يقيس
    // الوصول للسيرفر اللي فعلًا بنحتاجه
    return fetch(SUPA + '/rest/v1/', {
      method: 'HEAD', cache: 'no-store', signal: ctrl.signal,
      headers: ANON ? { apikey: ANON } : {},
    }).then(function () {
      clearTimeout(timer); pinging = false; setOnline(true, Date.now() - t0); return true;
    }).catch(function () {
      clearTimeout(timer); pinging = false; setOnline(false); return false;
    });
  }

  /* ═══════════ ④ طابور سجل الانقطاعات ═══════════ */
  function queueOutage(durationMs) {
    var list = read(LS.outages, []);
    list.push({ started_at: new Date(Date.now() - durationMs).toISOString(),
                duration_ms: Math.round(durationMs),
                page: (location.pathname.split('/').pop() || '') });
    if (list.length > 50) list = list.slice(-50);
    write(LS.outages, list);
  }
  function flushOutages() {
    var list = read(LS.outages, []);
    if (!list.length || !token()) return Promise.resolve();
    var item = list[0];
    return rpc('pos_fn_log_outage', {
      p_started_at: item.started_at, p_duration_ms: item.duration_ms, p_page: item.page,
    }, { raw: true }).then(function () {
      write(LS.outages, read(LS.outages, []).slice(1));
    }).catch(function () { /* هنحاول تاني بعدين */ });
  }

  /* ═══════════ نداء RPC مع إعادة محاولة ذكية (⑭) ═══════════ */
  function rpc(fn, body, opts) {
    opts = opts || {};
    var tk = token();
    if (!tk) return Promise.reject(new Error('انتهت الجلسة'));
    var attempt = 0, max = opts.retries == null ? 3 : opts.retries;

    function go() {
      attempt++;
      var ctrl = new AbortController();
      var timer = setTimeout(function () { ctrl.abort(); }, opts.timeout || 15000);
      var t0 = Date.now();
      return fetch(SUPA + '/rest/v1/rpc/' + fn, {
        method: 'POST', signal: ctrl.signal, cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          apikey: ANON, Authorization: 'Bearer ' + tk,
        },
        body: JSON.stringify(body || {}),
      }).then(function (r) {
        clearTimeout(timer);
        setOnline(true, Date.now() - t0);
        if (r.status === 401) throw Object.assign(new Error('انتهت الجلسة'), { fatal: true });
        if (r.status >= 500 || r.status === 429) throw new Error('السيرفر مشغول');
        if (!r.ok) return r.text().then(function (t) {
          throw Object.assign(new Error(t || ('خطأ ' + r.status)), { fatal: true });
        });
        return r.json();
      }).catch(function (e) {
        clearTimeout(timer);
        var isNet = /Failed to fetch|NetworkError|aborted|load failed/i.test(e.message || '');
        if (isNet) setOnline(false);
        // الأخطاء النهائية (٤٠١، ٤٠٠) ما بنعيدهاش — إعادتها مالهاش لزمة
        if (e.fatal || attempt > max) throw e;
        // فواصل متزايدة مع عشوائية بسيطة (تمنع ازدحام كل الأجهزة مرة واحدة)
        var wait = Math.min(1000 * Math.pow(2, attempt - 1), 8000) + Math.random() * 300;
        return new Promise(function (res) { setTimeout(res, wait); }).then(go);
      });
    }
    return go();
  }

  /* ═══════════ ⑤⑥ حفظ المسودات ═══════════
     البيانات اللي بيكتبها لسه ما اتبعتتش — حفظها محليًا صفر مخاطرة. */
  function saveDraft(name, data) {
    var d = read(LS.drafts, {});
    d[name] = { data: data, at: Date.now() };
    write(LS.drafts, d);
    bc('draft', { name: name });
  }
  function loadDraft(name, maxAgeMs) {
    var d = read(LS.drafts, {})[name];
    if (!d) return null;
    if (maxAgeMs && Date.now() - d.at > maxAgeMs) return null;
    return d.data;
  }
  function clearDraft(name) {
    var d = read(LS.drafts, {});
    delete d[name];
    write(LS.drafts, d);
    bc('draft', { name: name, cleared: true });
  }

  /* ═══════════ ⑦ مزامنة بين التابات ═══════════ */
  var chan = null;
  try { chan = new BroadcastChannel('omraa'); } catch (_) {}
  function bc(type, payload) {
    if (!chan) return;
    try { chan.postMessage({ type: type, payload: payload, from: tabId }); } catch (_) {}
  }
  var tabId = newKey('tab');
  if (chan) {
    chan.onmessage = function (e) {
      if (!e.data || e.data.from === tabId) return;
      if (e.data.type === 'queue') renderPending();
      if (e.data.type === 'claim') {
        // تاب تاني بعت نفس العملية — امسحها من طابورنا عشان ما تتبعتش مرتين
        var q = read(LS.queue, []).filter(function (x) { return x.key !== e.data.payload.key; });
        write(LS.queue, q);
      }
    };
  }

  /* ═══════════ ⑧⑨⑩⑪ كاش الكتالوج (قراءة فقط) ═══════════ */
  function cacheCatalog(rows) {
    if (!rows || !rows.length) return;
    write(LS.catalog, { at: Date.now(), rows: rows.slice(0, 3000) });
  }
  function getCatalog() {
    var c = read(LS.catalog, null);
    if (!c) return null;
    return { rows: c.rows, at: c.at, ageMs: Date.now() - c.at };
  }
  function lookupBarcode(code) {
    var c = getCatalog();
    if (!c) return null;
    var hit = null;
    for (var i = 0; i < c.rows.length; i++) {
      var r = c.rows[i];
      if (r.barcode === code || r.sku === code) { hit = r; break; }
    }
    return hit ? { item: hit, ageMs: c.ageMs, stale: c.ageMs > 600000 } : null;
  }

  /* ═══════════ ⑮⑯ طابور العمليات الآمنة ═══════════
     البيع **مش** في الطابور — لازم فحص مخزون حي. الطابور للعمليات
     اللي ممكن تستنى: تحديث شحنة وتحصيل. وكل واحدة بمفتاح عدم تكرار،
     والسيرفر هو اللي بيقرر في الآخر. */
  var QUEUEABLE = { pos_fn_update_shipment: 1, pos_fn_settle_money: 1, pos_fn_log_outage: 1 };

  function enqueue(fn, body, label) {
    if (!QUEUEABLE[fn]) throw new Error('العملية دي مش مسموح تستنى في طابور');
    var q = read(LS.queue, []);
    var key = body.p_idem_key || newKey(fn);
    body.p_idem_key = key;
    q.push({ key: key, fn: fn, body: body, label: label || fn,
             at: Date.now(), tries: 0, error: null });
    write(LS.queue, q);
    bc('queue', {});
    renderPending();
    return key;
  }

  var flushing = false;
  function flush() {
    if (flushing) return Promise.resolve();
    var q = read(LS.queue, []);
    if (!q.length) { flushOutages(); return Promise.resolve(); }
    if (!token()) return Promise.resolve();
    flushing = true;

    function step() {
      var list = read(LS.queue, []);
      if (!list.length) return Promise.resolve();
      var job = list[0];
      bc('claim', { key: job.key });
      return rpc(job.fn, job.body, { retries: 1 }).then(function (res) {
        // نجح (أو اترفض نهائيًا من السيرفر) — شيله من الطابور
        var rest = read(LS.queue, []).filter(function (x) { return x.key !== job.key; });
        write(LS.queue, rest);
        bc('queue', {});
        renderPending();
        return step();
      }).catch(function (e) {
        var list2 = read(LS.queue, []);
        if (list2.length && list2[0].key === job.key) {
          list2[0].tries = (list2[0].tries || 0) + 1;
          list2[0].error = String(e.message || e).slice(0, 120);
          // بعد ٦ محاولات فاشلة بنوقف الأوتوماتيك ونسيبها للمستخدم
          if (list2[0].tries >= 6) list2[0].stuck = true;
          write(LS.queue, list2);
          renderPending();
        }
        return Promise.reject(e);
      });
    }

    return step().catch(function () {}).then(function () {
      flushing = false;
      return flushOutages();
    });
  }

  function pending() { return read(LS.queue, []); }
  function removeJob(key) {
    write(LS.queue, read(LS.queue, []).filter(function (x) { return x.key !== key; }));
    bc('queue', {}); renderPending();
  }

  /* ═══════════ ⑰ مؤشر الحالة + ⑱ شاشة المعلّق ═══════════ */
  var badge = null;
  function paintBadge() {
    if (typeof document === 'undefined' || !document.body) return;
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'omraa-net-badge';
      badge.setAttribute('dir', 'rtl');
      badge.style.cssText =
        'position:fixed;z-index:99997;bottom:calc(8px + env(safe-area-inset-bottom));' +
        'inset-inline-start:8px;font:600 12px/1 Alexandria,system-ui,sans-serif;' +
        'padding:7px 11px;border-radius:99px;cursor:pointer;user-select:none;' +
        'box-shadow:0 2px 10px rgba(0,0,0,.16);transition:background .2s';
      badge.onclick = togglePanel;
      document.body.appendChild(badge);
    }
    var n = pending().length;
    var label, bg, fg;
    if (!state.online) { label = 'مفيش نت'; bg = '#b91c1c'; fg = '#fff'; }
    else if (state.quality === 'slow') { label = 'النت بطيء'; bg = '#b45309'; fg = '#fff'; }
    else if (state.cautious) { label = 'النت متقطّع'; bg = '#b45309'; fg = '#fff'; }
    else { label = 'متصل'; bg = '#065f46'; fg = '#fff'; }
    if (n) label += ' · ' + n + ' معلّق';
    // متصل وكل حاجة تمام؟ خليه باهت عشان ما يشغلش الانتباه
    badge.style.background = (state.online && state.quality === 'good' && !state.cautious && !n)
      ? 'rgba(15,23,42,.45)' : bg;
    badge.style.color = fg;
    badge.textContent = label;
  }

  var panel = null;
  function togglePanel() {
    if (panel) { panel.remove(); panel = null; return; }
    panel = document.createElement('div');
    panel.setAttribute('dir', 'rtl');
    panel.style.cssText =
      'position:fixed;z-index:99999;inset-inline:10px;bottom:calc(52px + env(safe-area-inset-bottom));' +
      'max-width:420px;margin-inline:auto;background:#fff;border-radius:14px;padding:14px;' +
      'box-shadow:0 10px 40px rgba(0,0,0,.28);font:14px/1.6 Alexandria,system-ui,sans-serif;color:#0f172a';
    document.body.appendChild(panel);
    renderPending();
  }

  function renderPending() {
    paintBadge();
    if (!panel) return;
    var q = pending();
    var cat = getCatalog();
    var html = '<div style="font-weight:700;margin-bottom:8px">حالة الاتصال</div>' +
      '<div style="font-size:13px;color:#475569;margin-bottom:10px">' +
      (state.online ? (state.quality === 'slow' ? 'متصل بس النت بطيء' : 'متصل') : 'مفيش نت دلوقتي') +
      (state.cautious ? ' · النت بيقطع ويرجع' : '') + '</div>';

    if (cat) {
      var mins = Math.round(cat.ageMs / 60000);
      html += '<div style="font-size:12px;color:#64748b;margin-bottom:10px">' +
        'نسخة المنتجات المحفوظة: ' + (mins < 1 ? 'من شوية' : 'من ' + mins + ' دقيقة') +
        (cat.ageMs > 600000 ? ' <b style="color:#b45309">(قديمة)</b>' : '') + '</div>';
    }

    if (!q.length) {
      html += '<div style="color:#065f46;font-size:13px">مفيش عمليات معلّقة ✓</div>';
    } else {
      html += '<div style="font-weight:700;margin:10px 0 6px">عمليات مستنية (' + q.length + ')</div>';
      for (var i = 0; i < q.length; i++) {
        var j = q[i];
        html += '<div style="border:1px solid #e2e8f0;border-radius:9px;padding:8px;margin-bottom:6px">' +
          '<div style="font-size:13px;font-weight:600">' + esc(j.label) + '</div>' +
          '<div style="font-size:11px;color:#64748b">' +
          new Date(j.at).toLocaleTimeString('ar-EG') +
          (j.tries ? ' · حاول ' + j.tries + ' مرة' : '') +
          (j.stuck ? ' · <b style="color:#b91c1c">متعلّقة</b>' : '') + '</div>' +
          (j.error ? '<div style="font-size:11px;color:#b91c1c">' + esc(j.error) + '</div>' : '') +
          '</div>';
      }
      html += '<button id="omraa-flush" style="border:0;border-radius:9px;padding:9px 14px;' +
        'font:inherit;font-weight:700;background:#0f172a;color:#fff;cursor:pointer">ابعتهم دلوقتي</button>';
    }
    /* ⑳ وضع الطوارئ: النت مقطوع؟ وريه أرقام الفواتير المحجوزة عشان
       يكتب البيعة على ورق برقم مضمون مش هيتكرر، ويدخلها بعدين. */
    if (!state.online) {
      var free = reservedCodes().filter(function (c) { return !c.used; });
      html += '<div style="margin-top:12px;padding-top:10px;border-top:1px solid #e2e8f0">' +
        '<div style="font-weight:700;margin-bottom:6px">وضع الطوارئ</div>';
      if (free.length) {
        html += '<div style="font-size:12px;color:#475569;margin-bottom:6px">' +
          'اكتب البيعة على ورق بالرقم ده، وسجّلها في النظام لما النت يرجع:</div>' +
          '<div style="font:700 18px/1.5 ui-monospace,monospace;color:#0f172a;' +
          'background:#f1f5f9;border-radius:8px;padding:8px;text-align:center">' +
          esc(free[0].code) + '</div>' +
          '<div style="font-size:11px;color:#64748b;margin-top:4px">' +
          'عندك ' + free.length + ' رقم محجوز</div>';
      } else {
        html += '<div style="font-size:12px;color:#b45309">مفيش أرقام محجوزة — ' +
          'هتتحجز تلقائيًا أول ما النت يرجع.</div>';
      }
      html += '</div>';
    }

    html += '<button id="omraa-close" style="border:0;background:transparent;color:#64748b;' +
      'font:inherit;cursor:pointer;padding:8px;float:left">إغلاق</button>';
    panel.innerHTML = html;
    var fb = panel.querySelector('#omraa-flush');
    if (fb) fb.onclick = function () { ping().then(flush); };
    panel.querySelector('#omraa-close').onclick = togglePanel;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ═══════════ ⑲ تحذير آخر قطعة + ⑳ وضع الطوارئ ═══════════ */

  /* آخر قطعة: لو النت متقطّع أو مقطوع، القطعة الأخيرة أخطر حاجة —
     ممكن حد تاني يكون خدها ولسه ما وصلناش الخبر. */
  function lastItemRisk(inStock) {
    if (inStock == null || inStock > 1) return null;
    if (state.online && state.quality === 'good' && !state.cautious) return null;
    return inStock <= 0
      ? 'القطعة دي نفدت حسب آخر نسخة عندك — والنت مش مستقر، أكّد قبل ما تبيع'
      : 'دي آخر قطعة، والنت مش مستقر — ممكن حد يكون أخدها';
  }

  /* وضع الطوارئ: النت وقع خالص. بنحجز أكواد فواتير من السيرفر وقت ما
     يكون شغّال، فيفضل عنده أرقام مضمونة يكتب عليها ورق. */
  function reservedCodes() { return read(LS.codes, []); }
  function topUpCodes(n) {
    if (!token()) return Promise.resolve([]);
    return rpc('pos_fn_reserve_codes', { p_count: n || 5 }, { retries: 1 })
      .then(function (r) {
        if (!r || r.ok === false || !r.codes) return [];
        var have = reservedCodes();
        var add = r.codes.map(function (c) { return { code: c, at: Date.now(), used: false }; });
        write(LS.codes, have.concat(add));
        return r.codes;
      }).catch(function () { return []; });
  }
  function useCode() {
    var list = reservedCodes();
    for (var i = 0; i < list.length; i++) {
      if (!list[i].used) { list[i].used = true; write(LS.codes, list); return list[i].code; }
    }
    return null;
  }
  /* لما النت يبقى كويس، نتأكد إن عنده رصيد أكواد للطوارئ */
  function ensureCodes() {
    var free = reservedCodes().filter(function (c) { return !c.used; }).length;
    if (state.online && state.quality === 'good' && free < 3) topUpCodes(5);
  }

  /* ═══════════ التشغيل ═══════════ */
  function start() {
    paintBadge();
    ping();
    setInterval(ping, 20000);                 // ① نبض كل ٢٠ ثانية
    window.addEventListener('online', function () { ping().then(flush); });
    window.addEventListener('offline', function () { setOnline(false); });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') ping().then(flush);
    });
    setTimeout(flush, 2500);                  // ابعت أي معلّق من جلسة فاتت
    setTimeout(ensureCodes, 6000);            // جهّز أكواد طوارئ وقت النت الكويس
    setInterval(ensureCodes, 300000);
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', start);
  else start();

  /* ═══════════ الواجهة العامة ═══════════ */
  window.OmraaNet = {
    // الحالة
    state: function () { return JSON.parse(JSON.stringify(state)); },
    isOnline: function () { return state.online; },
    onChange: function (fn) { listeners.push(fn); return function () {
      listeners = listeners.filter(function (f) { return f !== fn; }); }; },
    ping: ping,
    // العمليات
    rpc: rpc,
    newKey: newKey,
    enqueue: enqueue,
    flush: flush,
    pending: pending,
    removeJob: removeJob,
    // المسودات
    saveDraft: saveDraft, loadDraft: loadDraft, clearDraft: clearDraft,
    // الكتالوج
    cacheCatalog: cacheCatalog, getCatalog: getCatalog, lookupBarcode: lookupBarcode,
    // الطوارئ وآخر قطعة
    lastItemRisk: lastItemRisk, reservedCodes: reservedCodes,
    topUpCodes: topUpCodes, useCode: useCode, ensureCodes: ensureCodes,
    // داخلي للاختبار
    _read: read, _write: write, _keys: LS,
  };
})();
