#!/bin/bash
# check_before_push.sh — فحص إلزامي قبل أي git push على هذا المشروع.
# الاستخدام: bash scripts/check_before_push.sh

set -e
cd "$(git rev-parse --show-toplevel)"

echo "🔍 فحص 1: هل فيه ملفات preview-* staged بالخطأ؟"
if git diff --cached --name-only | grep -q "^preview-"; then
    echo "❌ توقف! فيه ملفات preview- في الـ staging area. لازم تُشال قبل الـ commit."
    git diff --cached --name-only | grep "^preview-"
    exit 1
fi
echo "✅ لا يوجد ملفات preview- في الـ staging"

echo ""
echo "🔍 فحص 2: كل ملفات .js المعدّلة/الجديدة صحيحة syntax-wise؟"
files=$(git diff --cached --name-only --diff-filter=ACM | grep '\.js$' || true)
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
new_js=$(git diff --cached --name-only --diff-filter=A | grep '\.js$' || true)
if [ -n "$new_js" ]; then
    for f in $new_js; do
        basename_f=$(basename "$f")
        if ! grep -rl "$basename_f" --include="*.html" --include="*.txt" . >/dev/null 2>&1; then
            echo "⚠️  تحذير: $f جديد لكن غير مذكور في أي .html/.txt — تأكد إنه مربوط فعليًا وإلا سيكون ملف يتيم."
        fi
    done
fi

echo ""
echo "✅ كل الفحوصات نجحت — آمن للـ push"
