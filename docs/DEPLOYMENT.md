# النشر ونقل الاستضافة والتركيبة الثانية

## ١. الوضع الحالي (التركيبة الأولى OMR-2026-A)
| الجزء | المكان |
|---|---|
| نقطة البيع والإدارة | ريبو `omraa` ← GitHub Pages من فرع `main` (من غير build) ← `https://<الحساب>.github.io/omraa/` |
| سورس المتجر | ريبو `omraa-store-src` (Next.js 15، `output: export`) |
| المتجر المنشور | ريبو `omraa-store-preview` ← GitHub Pages ← `https://<الحساب>.github.io/omraa-store-preview/` |
| قاعدة البيانات | مشروع Supabase واحد: الجداول، والدوال، والصلاحيات، والتخزين، والمهام المجدولة |
| مفتاح الترخيص | `license.json` في ريبو `omraa` و`public/license.json` في سورس المتجر |

**⚠️ المسار `/omraa/` ثابت جوّه الملفات المترجمة.** عشان كده كل تركيبة لازم تبقى في ريبو اسمه `omraa` على حساب أو منظمة GitHub خاصة بيها:
- `org1.github.io/omraa/` للتركيبة الأولى.
- `org2.github.io/omraa/` للتركيبة الثانية.

## ٢. نشر تعديل على نقطة البيع
```bash
bash scripts/check_before_push.sh   # إلزامي
git push origin main                 # GitHub Pages بينشر في دقيقة أو اتنين
```
الأجهزة بتجيب النسخة الجديدة لوحدها (`sw.js` بيجيب من الشبكة الأول).

## ٣. نشر تعديل على المتجر
```bash
cd omraa-store-src
npm ci
BASE_PATH=/omraa-store-preview npx next build        # المخرجات في out/
# انسخ محتوى out/ لريبو omraa-store-preview (سيب .nojekyll وLICENSE.md وNOTICE.md وLEGAL/ زي ما هم)
```
بيانات الاتصال بقاعدة البيانات في `omraa-store-src/.env.production`: الرابط ومفتاح anon العام.

## ٤. مفاتيح الترخيص
- **الإصدار:** المفتاح بيصدر من المالك بس (مهاب بشير — Axis Marketing Agency). كل مفتاح مربوط بـ: رقم التركيبة (١ أو ٢)، والدومين، ومعرّف مشروع Supabase.
- **لو اتغيّر الدومين أو مشروع قاعدة البيانات لنفس النشاط:** اطلب مفتاح بديل كتابيًا، وحطّه مكان `license.json` (نقطة البيع) و`public/license.json` (المتجر).
- **من غير مفتاح صحيح:** بيظهر شريط أحمر «نسخة غير مرخّصة»، والنظام بيفضل شغال.
- **التأكد من حالة الترخيص:** افتح أي صفحة واكتب في الـ Console:
  ```js
  window.__omraaLicense   // { status: "valid", id: "OMR-2026-A" }
  ```

## ٥. نقل التركيبة لحسابات جديدة (أو تجهيز التركيبة الثانية)
> التركيبة الثانية لازم تتسجّل الأول بـ «نموذج تسجيل التركيبة الثانية» الموقّع. ده شرط عشان يصدر مفتاحها OMR-2026-B.

1. **قاعدة البيانات:**
   - أنشئ مشروع Supabase جديد على حساب صاحب النشاط. أقرب منطقة لمصر: `eu-central-1` (فرانكفورت).
   - طبّق هيكل قاعدة البيانات `schema.sql`. النسخة المحدّثة بتتطلع وقت التسليم بـ `supabase db dump --schema pos,shop,pos_backup` (فيها الجداول، والدوال، والصلاحيات، وRLS، والـ triggers).
   - **للتركيبة الثانية:** ابدأ من غير بيانات (نشاط جديد).
   - **لنقل نفس النشاط:** انقل البيانات بالنسخة الخارجية من صفحة «النسخ الاحتياطي».
2. **إعدادات الدخول (Authentication):**
   - اقفل التسجيل الذاتي: Email ← Allow new users to sign up = **Off**.
   - شغّل **Leaked password protection**.
   - Site URL = رابط النظام الجديد.
3. **تخزين الصور (Storage):** أنشئ bucket عام اسمه `product-images`.
4. **المهام المجدولة (pg_cron):** فعّل امتداد `pg_cron`، وأنشئ المهام دي:
   ```sql
   select cron.schedule('alomraa_daily_dr',     '0 2 * * *',    'select pos_backup.cron_daily();');
   select cron.schedule('alomraa_order_notify', '* * * * *',    'select pos.fn_send_order_notifications(20);');
   select cron.schedule('shop_release_expired', '*/10 * * * *', 'select public.shop_fn_release_expired_web_orders();');
   ```
5. **Edge Function إضافة الموظفين:** انشر `supabase/functions/pos-staff` على المشروع الجديد (مع JWT verification):
   ```bash
   supabase functions deploy pos-staff --project-ref <NEW_PROJECT_REF>
   ```
6. **أول مستخدم مالك:**
   - أنشئه من Authentication ← Users ← Add user (إيميل + كلمة سر، Auto confirm).
   - بعدها اربطه بملف المالك:
   ```sql
   insert into pos.profiles(id, full_name, role, active)
   select id, 'المالك', 'owner', true from auth.users where email = '<الإيميل>';
   ```
   - باقي الموظفين بيضيفهم المالك من النظام نفسه (`staff.html`).
7. **الكود:**
   - **نقطة البيع:** اعمل fork أو انسخ ريبو `omraa` على حساب GitHub الجديد **بنفس الاسم `omraa`**، وبعدين:
   ```bash
   bash scripts/retarget_supabase.sh <NEW_PROJECT_REF> <NEW_ANON_KEY>
   ```
     فعّل GitHub Pages: Settings ← Pages ← Deploy from branch `main`، المجلد `/`.
   - **المتجر:** عدّل `omraa-store-src/.env.production` بالرابط والمفتاح الجديد، وابنيه وانشره (§٣).
8. **مفتاح الترخيص:** ابعت للمالك الدومين ومعرّف المشروع الجديد، وحط المفتاح اللي يوصلك مكان `license.json` و`public/license.json`.
9. **الاختبار قبل التشغيل:**
   - دخول.
   - إضافة منتج، وطباعة ملصق، وبيع، ومرتجع.
   - «أخذ نسخة الآن» وبعدها «تنزيل نسخة خارجية».
   - فتح المتجر وعمل طلب تجربة، ثم إلغاؤه.
   - التأكد إن `window.__omraaLicense.status === "valid"`.

## ٦. ممنوعات النشر
- ماتنشرش ملفات `preview-*`، ولا أي ملف فيه مفاتيح سرية (service role، أو كلمات مرور).
- مفتاح `service_role` بتاع Supabase **مايتحطّش أبدًا** في أي ملف في الموقع. مكانه Edge Functions بس.
- ماتعدّلش أو تشيل `omraa-license.js` أو `license.json` أو إشارات الملكية. ده مخالف للترخيص (البند ٤).
