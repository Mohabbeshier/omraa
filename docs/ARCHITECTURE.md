# معمارية النظام

## المكوّنات
```
المتصفح (كاشير / مالك / موبايل)
   │  /omraa/*.html  ← GitHub Pages (ريبو omraa)
   │     ├─ صفحات Next.js مُصدَّرة (dashboard, pos, products, inventory, …)
   │     └─ صفحات مكتوبة باليد: returns-v2, shipping, photos, website, merchandising
   │     + سكريبتات عامة على كل صفحة: omraa-telemetry.js · omraa-net.js · omraa-filters.js · omraa-license.js
   │
   │  HTTPS (anon key + جلسة المستخدم JWT)
   ▼
Supabase (PostgreSQL + Auth + Storage + Edge Functions + pg_cron)
   ├─ schema pos        البيانات: products, items (قطعة = صف), sales, sale_items, returns, shipments, customers, …
   ├─ schema shop       المتجر: إعدادات الموقع، الصور، الطلبات الأونلاين، الأحداث
   ├─ schema pos_backup النسخ الاحتياطي + سجل التغييرات اللحظي (change_log)
   └─ public.pos_fn_* / shop_fn_*  الواجهة الوحيدة المسموح بيها من المتصفح
   ▲
   │  shop_fn_* (anon — قراءة كتالوج + إنشاء طلب)
المتجر الإلكتروني (ريبو omraa-store-src → مبني في omraa-store-preview)
```

## قواعد البيانات الأساسية
- **كل قطعة = صف في `pos.items`** بحالة: `in_stock` / `sold` / `reserved` / `lost`. الباركود بيمسك الموديل والمقاس واللون (`pos.variant_barcodes`)، والقطعة نفسها بتتحدد وقت البيع.
- **البيع** (`pos_fn_sale`) بيقفل القطع، ويكتب `sales` و`sale_items` و`stock_movements` و`sale_profit` في معاملة واحدة، وعنده مفتاح ثبات (`p_idem_key`) ضد التكرار لو النت قطع.
- **المرتجع** (`pos_fn_process_return_item`) بيرجّع القطعة للمخزون، وبيتحقق من نفسه (`fn_verify_return`).
  - **مهلة الإرجاع:** من `app_settings.return_window_days`. بعدها لازم المالك يأكّد صراحة (`p_override`).
  - **إلغاء فاتورة غلط:** خلال أول ٣٠ دقيقة بـ `pos_fn_void_sale`، ويتسجّل «إلغاء فاتورة».
- **الشحن:** `pos_fn_ship_sale` و`pos_fn_update_shipment` و`pos_fn_settle_money` و`pos_fn_return_shipment`.
- **الصلاحيات:** `pos.profiles.role` = `owner` (مالك) / `employee` (موظف).
  - كل دالة حساسة بتتحقق جوّاها بـ `pos.assert_staff()`، أو `pos.current_app_role()`، أو `pos.is_owner()`.
  - الاعتماد على إخفاء الزرار في الواجهة بس ممنوع.
- **تطبيع الإدخال:** الأرقام العربي في المقاسات والتليفونات بتتحوّل لإنجليزي في الدوال وبـ triggers (`aa_norm_size`).

## طبقة المتصفح
| الملف | الدور |
|---|---|
| `omraa-net.js` | `OmraaNet.rpc`: إعادة محاولة، وطابور أوفلاين للعمليات الآمنة، ورسائل عربي |
| `omraa-telemetry.js` | سجل الأخطاء (`pos.omraa_error_log`)، والحارس (ساعة الجهاز، وتجديد الجلسة، والصفحة الميتة)، وبانر الجلسة، وتحويل المرتجعات للشاشة الجديدة |
| `omraa-filters.js` | فلاتر الجداول، والبحث الشامل في الرئيسية |
| `omraa-license.js` | التحقق من مفتاح الترخيص |
| `sw.js` | Service worker: الشبكة أولًا، وقشرة أوفلاين |

## حقيقة مهمة عن صفحات Next.js
صفحات الإدارة الأساسية في ريبو `omraa` **ملفات مترجمة (minified)**، والسورس الأصلي بتاعها (TSX) مش جزء من الريبو. أي تعديل عليها بيتعمل على الملف المترجم نفسه، بتعديل نصّي دقيق. الأدوات والقواعد في `scripts/` و`DEVELOPER_NOTES.md`:
- `scope_locate.js` لتحديد نطاق المتغيّر.
- `check_before_push.sh` إلزامي قبل أي نشر.

الصفحات الجديدة بتتكتب HTML/JS عادي أو JSX بيتبني (`photos.jsx` → `photos.build.js`).

## المهام المجدولة (pg_cron)
| المهمة | الموعد | الوظيفة |
|---|---|---|
| `alomraa_daily_dr` | ٢ صباحًا UTC يوميًا | نسخة احتياطية كاملة + فحص صحة |
| `alomraa_order_notify` | كل دقيقة | إشعارات الطلبات الأونلاين |
| `shop_release_expired` | كل ١٠ دقايق | فك حجز قطع الطلبات الأونلاين المنتهية |
