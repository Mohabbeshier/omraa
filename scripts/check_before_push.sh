#!/bin/bash

# ── فحص: لازم نكون على فرع main فعليًا (مش detached HEAD) ──
CUR_BRANCH=$(git -C "$(dirname "$0")/.." symbolic-ref --short -q HEAD || echo "DETACHED")
if [ "$CUR_BRANCH" != "main" ]; then
  echo "❌ HEAD مش على main (الحالي: $CUR_BRANCH) — الكوميتات هتضيع والدفع هيقول up-to-date وهو مبيدفعش حاجة"
  exit 1
fi

# check_before_push.sh — فحص إلزامي قبل أي git push على هذا المشروع.
# الاستخدام: bash scripts/check_before_push.sh

set -e
cd "$(git rev-parse --show-toplevel)"

echo "🔍 فحص 0: هل فيه secrets (GitHub tokens) في أي ملف staged؟"
if git diff --cached | grep -qE 'ghp_[A-Za-z0-9]{36}'; then
    echo "❌ توقف! فيه GitHub PAT صريح في التعديلات. لن يقبله GitHub push protection أصلاً،"
    echo "   لكن لازم نمسحه محليًا الآن قبل أي commit (استخدم git commit --amend لو الكوميت لسه محلي)."
    exit 1
fi
echo "✅ لا يوجد secrets صريحة في الـ staging"
echo ""

echo "🔍 فحص 1: هل فيه ملفات preview-* staged بالخطأ؟"
if git diff --cached --name-only | grep -q "^preview-"; then
    echo "❌ توقف! فيه ملفات preview- في الـ staging area. لازم تُشال قبل الـ commit."
    git diff --cached --name-only | grep "^preview-"
    exit 1
fi
echo "✅ لا يوجد ملفات preview- في الـ staging"
echo ""

echo "🔍 فحص 1.5: هل فيه استبدال نسخة كاملة لصفحة أساسية (يحتاج معاينة قبل النشر)؟"
needs_preview=0
# حالة 1: rename صريح يكتشفه git (نفس المحتوى أو شبيه، اسم مختلف)
renames=$(git diff --cached --name-status -M --diff-filter=R | grep '\.js$' || true)
if [ -n "$renames" ]; then
    while IFS=$'\t' read -r status old_path new_path; do
        echo "  ⚠️  استبدال (rename): $old_path → $new_path"
        needs_preview=1
    done <<< "$renames"
fi
# حالة 2: حذف + إضافة منفصلين لنفس "جذر" اسم الملف (نفس الصفحة، اسم مختلف بالكامل)
deleted=$(git diff --cached --name-only --diff-filter=D | grep '\.js$' || true)
added=$(git diff --cached --name-only --diff-filter=A | grep '\.js$' || true)
for d in $deleted; do
    d_base=$(basename "$d" | sed -E 's/(v[0-9]+[a-zA-Z0-9]*|final|fixed)?\.js$//')
    for a in $added; do
        a_base=$(basename "$a" | sed -E 's/(v[0-9]+[a-zA-Z0-9]*|final|fixed)?\.js$//')
        if [ "$d_base" = "$a_base" ] && [ -n "$d_base" ]; then
            echo "  ⚠️  استبدال كامل: $d → $a"
            needs_preview=1
        fi
    done
done
if [ "$needs_preview" -eq 1 ]; then
    if [ -z "${PREVIEWED_CONFIRM:-}" ]; then
        echo "❌ توقف! هذا استبدال نسخة كاملة لصفحة أساسية."
        echo "   لازم تعاين الملف الجديد أولاً (scripts/make_preview.py) وتتأكد بصريًا إنه شغال،"
        echo "   ثم أعد المحاولة مع: PREVIEWED_CONFIRM=1 bash scripts/check_before_push.sh"
        exit 1
    fi
    echo "  ✅ تم تأكيد المعاينة (PREVIEWED_CONFIRM=1)"
else
    echo "  (لا يوجد استبدال نسخة كاملة في هذا الـ commit)"
fi
echo ""

echo "🔍 فحص 2: كل ملفات .js المعدّلة/الجديدة صحيحة syntax-wise؟"
files=$(git diff --cached --name-only --diff-filter=ACMR | grep '\.js$' || true)
if [ -n "$files" ]; then
    for f in $files; do
        if [ -f "$f" ]; then
            if ! node --check "$f" 2>/dev/null; then
                echo "❌ خطأ صياغي في: $f"
                node --check "$f"
                exit 1
            fi
            echo "  ✅ $f"
        fi
    done
else
    echo "  (لا يوجد ملفات .js في هذا الـ commit)"
fi

echo ""
echo "🔍 فحص 3: هل فيه ملفات .js جديدة (chunks) غير مذكورة في أي .html/.txt؟"
new_js=$(git diff --cached --name-only --diff-filter=AR | grep '\.js$' || true)
if [ -n "$new_js" ]; then
    for f in $new_js; do
        basename_f=$(basename "$f")
        if ! grep -rl "$basename_f" --include="*.html" --include="*.txt" . >/dev/null 2>&1; then
            echo "⚠️  تحذير: $f جديد لكن غير مذكور في أي .html/.txt — تأكد إنه مربوط فعليًا وإلا سيكون ملف يتيم."
        fi
    done
fi

echo ""
echo "🔍 فحص 4: هل فيه ملف .js جديد بـ suffix يدوي (v3, v4fix, إلخ) على نفس"
echo "   الـhash الأساسي لملف صفحة موجود، بينما الملف 'النظيف' (بلا أي suffix"
echo "   — وهو ما يحدد التنفيذ الفعلي في React) لم يتحدّث بنفس المحتوى؟"
echo "   (هذا بالضبط النمط اللي خلّى إصلاحات labels تُفقَد لجلستين كاملتين)"
rsc_issue=0
new_or_modified_js=$(git diff --cached --name-only --diff-filter=ACMR 2>/dev/null | grep '\.js$' || true)
for f in $new_or_modified_js; do
    fname=$(basename "$f")
    dir=$(dirname "$f")
    # هل الاسم فيه suffix زيادة عن نمط النظيف (page-<16 hex>.js)؟
    if echo "$fname" | grep -qE '^page-[0-9a-f]{16}\.js$'; then
        continue  # ده نفسه الملف النظيف، مفيش مشكلة
    fi
    if ! echo "$fname" | grep -qE '^page-[0-9a-f]{16}'; then
        continue  # اسم غير متعلق بنمط الصفحات أصلاً (احتياطي)
    fi
    # استخرج الـhash الأساسي (أول 16 حرف hex بعد page-)
    base_hash=$(echo "$fname" | grep -oE '^page-[0-9a-f]{16}')
    clean_name="${base_hash}.js"
    clean_path="$dir/$clean_name"
    if [ ! -f "$clean_path" ]; then
        echo "  ⚠️  $f: عنده suffix، والملف النظيف المطابق ($clean_path) غير موجود أصلاً — تجاهل إن كان هذا مقصودًا (نمط تسمية مختلف)."
        continue
    fi
    clean_was_modified=$(echo "$new_or_modified_js" | grep -F "$clean_path" || true)
    if [ -z "$clean_was_modified" ]; then
        echo "  ❌ $f: تم تعديله في هذا الـcommit، لكن الملف النظيف ($clean_path)"
        echo "     — وهو الملف الذي React فعليًا يحمّله — لم يتحدّث في نفس الـcommit."
        echo "     تعديلك على $f لن يُنفَّذ من متصفح المستخدم أبدًا!"
        rsc_issue=1
    elif ! diff -q "$f" "$clean_path" >/dev/null 2>&1; then
        echo "  ❌ $f: مختلف المحتوى عن الملف النظيف ($clean_path) رغم تعديل"
        echo "     الأخير أيضًا في هذا الـcommit — تأكد إن المحتويين متطابقين تمامًا."
        rsc_issue=1
    fi
done
if [ "$rsc_issue" -eq 1 ]; then
    echo ""
    echo "❌ توقف! فيه تعديل لن يُنفَّذ فعليًا من المتصفح — راجع الرسائل أعلاه."
    echo "   القاعدة: الملف الذي يحدد ما يُنفَّذ في المتصفح هو دائمًا الاسم"
    echo "   'النظيف' page-<16 hex>.js بلا أي إضافة بعده. عدِّله مباشرة، أو"
    echo "   بعد إنهاء تعديلك على نسخة بـsuffix، انسخ محتواها الكامل فوق"
    echo "   الملف النظيف قبل الـcommit."
    exit 1
fi
echo "  ✅ لا يوجد تعديل معزول عن الملف النظيف (RSC module الفعلي)"

echo ""
echo "✅ كل الفحوصات نجحت — آمن للـ push"
