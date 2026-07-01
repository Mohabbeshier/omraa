-- ============================================================
-- diagnose_now.sql
-- شغّل هذا فورًا لحظة ما العميل يبلّغ عن بطء/تعليق في مسح الباركود.
-- الهدف: مسك دليل رقمي مباشر بدل التحليل النظري بعد ساعات.
-- ============================================================

-- 1. أعلى 15 استعلام حقيقي بطء (أي استعلام، لا margin_warning فقط)
--    خلال آخر فترة نشاط — يكشف فورًا أي استعلام تجاوز الحد الطبيعي (<10ms)
SELECT
  left(query, 100) as query_snippet,
  calls,
  round(mean_exec_time::numeric, 2) as mean_ms,
  round(max_exec_time::numeric, 2) as max_ms,
  round(stddev_exec_time::numeric, 2) as stddev_ms
FROM pg_stat_statements
WHERE query ILIKE '%pos_items%' 
   OR query ILIKE '%margin_warning%'
   OR query ILIKE '%pos_fn_%'
ORDER BY max_exec_time DESC
LIMIT 15;

-- 2. الاتصالات المفتوحة حاليًا — أي blocking أو queries طويلة شغالة الآن؟
SELECT
  pid, usename, application_name, client_addr, state,
  now() - query_start as running_since,
  left(query, 80) as query_snippet
FROM pg_stat_activity
WHERE datname = current_database()
  AND state != 'idle'
ORDER BY query_start ASC;

-- 3. هل فيه أي lock حاليًا؟
SELECT
  locktype, relation::regclass, mode, granted, pid
FROM pg_locks
WHERE NOT granted;

-- 4. حالة GitHub Pages (يُفحص عبر bash_tool لا SQL — تذكير: 
--    curl -s -H "Authorization: token $TOKEN" 
--    "https://api.github.com/repos/Mohabbeshier/omraa/pages" | grep status
--    *** الدرس من الليلة: commit ناجح على git ≠ نشر ناجح على Pages ***)
