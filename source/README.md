# أرشيف الكود المصدري (JSX) — نظام الأمراء

## ⚠️ الحقيقة الأساسية التي يجب معرفتها أولاً

**لا يوجد مصدر TSX/JSX أصلي لأي صفحة من صفحات النظام الأساسية** (products, pos, customers,
labels, orders, إلخ). الـ repo الفعلي هو فقط مخرجات Next.js static export
(HTML + JS مُصغَّر/minified). أي تعديل على هذه الصفحات الأساسية **يجب أن يتم مباشرة
على الكود المُصغَّر**، بحذر شديد، لأنه المصدر الوحيد الموجود.

هذا المجلد (`source/`) يحتوي فقط على المكوّنات (components) الجديدة التي بنيناها نحن
من الصفر خلال الجلسات، وليست جزءًا من الكود الأصلي الذي بناه المطوّر السابق.

## الملفات الموجودة هنا وحالتها الفعلية

| الملف | حالة النشر | ملاحظات |
|---|---|---|
| `products/QuickAddModal.jsx` | ✅ منشور فعليًا | مُصرَّف إلى `_next/static/chunks/app/(app)/products/quickadd-8801.js`، مُحمَّل ديناميكيًا من `page-af0ae61df8622aa8v4fixed.js` |
| `products/CollectionsModal.jsx` | ✅ منشور فعليًا | مُصرَّف إلى `collections-8804fix.js`، نفس آلية التحميل الديناميكي |

> **ملاحظة تاريخية:** كان يوجد أيضًا `ProductTools.jsx` يحتوي `EditProductModal`,
> `BulkEditModal`, و`CollectionsModal` (نسخة قديمة). تم حذفه من هذا الأرشيف بعد
> التأكد أن كل محتواه إما مكرّر لميزات موجودة أصلاً في `page-*.js` الرئيسية
> للمنتجات (Edit/Bulk-edit للفئة والتاجر والنشر) أو نسخة قديمة استُبدلت بالملف
> المستقل أعلاه. لا تُعِد بناءه.

## ⚠️ تحذير حرج: خطوة الـ compile ناقصة تحويل واحد يجب تطبيقه يدويًا

عند إعادة بناء أي ملف من هذه، خطوات Babel المعتادة (انظر منهجية العمل الموثقة سابقًا)
**لا تكفي بمفردها**. تم اكتشاف فعليًا أن نسخة `.compiled.js` الوسيطة (مخرجات Babel مباشرة)
لا تطابق الملف المنشور فعليًا لأن خطوة إضافية ضرورية لم تُوثَّق بدقة كافية سابقًا:

```bash
# بعد Babel، ولا تنسَ:
sed -i 's/React\.createElement/n.createElement/g' file.compiled.js
sed -i 's/React\.Fragment/n.Fragment/g' file.compiled.js
sed -i 's/\buseState(/n.useState(/g; s/\buseEffect(/n.useEffect(/g' file.compiled.js
# ⚠️ كرّر لأي hook آخر مستخدم في الملف (useRef, useCallback, useMemo...)
```

**السبب:** babel.config.json يستخدم `pragma: "React.createElement"` (لأن React نفسه
غير مستورد باسم `React` في السياق النهائي — الاسم الفعلي هو `n` أو أي حرف آخر
حسب الـ webpack module numbering في تلك الصفحة بالذات). نسيان هذه الخطوة كان
يعني أن أي ملف `.compiled.js` محفوظ محليًا من جلسة سابقة **غير موثوق كمصدر نهائي**
— فقط الـ `.jsx` الأصلي (قبل Babel) هو المصدر الموثوق 100%.

## طريقة إعادة البناء الكاملة والمُتحقَّق منها

```bash
# 1. Babel
npx babel source/products/QuickAddModal.jsx --out-file /tmp/out.compiled.js

# 2. إزالة import، وتحويل أسماء React (احذف السطر الأول، ثم:)
sed -i '1d' /tmp/out.compiled.js
sed -i 's/React\.createElement/n.createElement/g; s/React\.Fragment/n.Fragment/g' /tmp/out.compiled.js
sed -i 's/\buseState(/n.useState(/g; s/\buseEffect(/n.useEffect(/g' /tmp/out.compiled.js
# ⚠️ لو الملف يستخدم useRef, useCallback, useMemo إلخ، أضف كل واحد بنفس الطريقة —
# هذا كان أكبر مصدر أخطاء صامتة (نسيان تحويل hook واحد يترك اسمه العام غير معرَّف).

# 3. تغليف webpack (module ID والمتغيرات حسب الصفحة المستهدفة — راجع أي chunk مشابه منشور بالفعل لمعرفة رقم الـ module الصحيح المتاح)
cat > /tmp/final.js << 'HEADER'
(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[XXXX],{MODULE_ID:(e,t,s)=>{"use strict";s.r(t),s.d(t,{default:()=>ComponentName});var n=s(12115);
HEADER
cat /tmp/out.compiled.js >> /tmp/final.js
echo '}}]);' >> /tmp/final.js

# 4. تحقق الصحة الصياغية
node --check /tmp/final.js

# 5. تحقق التطابق مع أي نسخة منشورة قديمة (إن وجدت) قبل الاستبدال
```

**✅ تم اختبار هذه الخطوات بالضبط، بالكامل، من الصفر** على `QuickAddModal.jsx` —
النتيجة مطابقة وظيفيًا 100% للملف المنشور فعليًا على GitHub (فرق سطر فاضٍ واحد
لا أثر له). لو أي خطوة هنا فشلت معك مستقبلاً، فمعنى ذلك أن شيئًا تغيّر (مثلاً
hook جديد لم يُذكر) — لا تخمّن الحل، افحص الفرق بـ `diff` كما فعلنا هنا.

## القاعدة الذهبية

**أي ملف `.jsx` جديد يُبنى من الآن فصاعدًا يجب حفظه في هذا المجلد فورًا بعد
التأكد من نشره بنجاح** — لا تتركه في `/home/claude` المؤقت وحده. هذا هو الدرس
المباشر من اكتشاف أن `QuickAddModal.jsx` و `CollectionsModal.jsx` لم يكونا محفوظين
في الـ repo رغم أنهما منشوران وحيويان لصفحة المنتجات.
