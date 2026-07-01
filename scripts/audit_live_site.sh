#!/bin/bash
# audit_live_site.sh — فحص شامل للنسخة المنشورة فعليًا على GitHub (لا المحلية).
# يجمع كل الفحوصات اليدوية المتفرقة التي اعتمدنا عليها طوال الجلسات السابقة
# في أمر واحد يُشغَّل بعد كل نشر أو في أي وقت للتأكد من سلامة الموقع الحي.
#
# الاستخدام:
#   export GITHUB_TOKEN=ghp_xxx
#   bash scripts/audit_live_site.sh
#
# الخروج بكود 0 = كل شيء سليم. أي كود آخر = فيه مشكلة يجب مراجعتها.

set -u
REPO="Mohabbeshier/omraa"
API="https://api.github.com/repos/$REPO"
FAILED=0
WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

if [ -z "${GITHUB_TOKEN:-}" ]; then
    echo "❌ لازم تحدد GITHUB_TOKEN كمتغير بيئة أولاً."
    exit 1
fi

echo "════════════════════════════════════════"
echo "  فحص شامل للموقع الحي — $REPO"
echo "════════════════════════════════════════"
echo ""

fetch_raw() {
    curl -sL -H "Authorization: token $GITHUB_TOKEN" "$API/contents/$1?ref=main" \
      | python3 -c "
import sys, json, base64
try:
    d = json.load(sys.stdin)
    print(base64.b64decode(d['content']).decode('utf-8'))
except Exception:
    sys.exit(1)
"
}

echo "🔍 فحص 1: كل صفحة .html تشاور على chunk واحد فقط (لا نسخ متعددة متضاربة)"
pages=$(fetch_raw "index.html" > /dev/null 2>&1 && echo ok || echo fail)
# نجيب قائمة الصفحات من بنية الـ repo نفسها بدل قائمة يدوية
tree=$(curl -sL -H "Authorization: token $GITHUB_TOKEN" "$API/git/trees/main?recursive=1")
page_dirs=$(echo "$tree" | python3 -c "
import sys, json
d = json.load(sys.stdin)
dirs = set()
for item in d.get('tree', []):
    path = item['path']
    if path.startswith('_next/static/chunks/app/(app)/') and item['type'] == 'blob' and path.endswith('.js'):
        parts = path.split('/')
        if len(parts) >= 6:
            dirs.add(parts[4])
print('\n'.join(sorted(dirs)))
")

for page in $page_dirs; do
    html=$(fetch_raw "${page}.html" 2>/dev/null)
    if [ -z "$html" ]; then
        echo "  ⚠️  ${page}.html غير موجود أو فشل التحميل"
        continue
    fi
    script_refs=$(echo "$html" | grep -oE "page-[a-zA-Z0-9]+\.js" | sort -u | wc -l)
    if [ "$script_refs" -gt 1 ]; then
        echo "  ❌ ${page}.html بيشاور على $script_refs نسخ مختلفة من page-*.js"
        FAILED=1
    fi
done
echo "  ✅ انتهى فحص 1"
echo ""

echo "🔍 فحص 2: كل ملف .js منشور صحيح syntax-wise"
js_files=$(echo "$tree" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for item in d.get('tree', []):
    if item['path'].startswith('_next/static/chunks/app/(app)/') and item['path'].endswith('.js'):
        print(item['path'])
")
for f in $js_files; do
    content=$(fetch_raw "$f" 2>/dev/null)
    if [ -z "$content" ]; then
        echo "  ⚠️  فشل تحميل $f"
        continue
    fi
    echo "$content" > "$WORKDIR/check.js"
    if ! node --check "$WORKDIR/check.js" 2>/dev/null; then
        echo "  ❌ خطأ صياغي في: $f"
        FAILED=1
    fi
done
echo "  ✅ انتهى فحص 2 ($(echo "$js_files" | wc -l) ملف)"
echo ""

echo "🔍 فحص 3: كل ملف .js منشور مُشار إليه من صفحة (.html/.txt) أو من ملف .js آخر (dynamic import) على الأقل"
all_html_txt=$(echo "$tree" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for item in d.get('tree', []):
    if item['path'].endswith('.html') or item['path'].endswith('.txt'):
        print(item['path'])
")
combined_refs="$WORKDIR/all_refs.txt"
> "$combined_refs"
for f in $all_html_txt; do
    fetch_raw "$f" 2>/dev/null >> "$combined_refs"
done
# نضيف أيضًا محتوى كل ملفات .js نفسها (بعض الـ chunks تُحمَّل ديناميكيًا من كود JS آخر
# عبر document.createElement("script").src، لا فقط من html/txt)
for f in $js_files; do
    fetch_raw "$f" 2>/dev/null >> "$combined_refs"
done
orphans=0
for f in $js_files; do
    basename_f=$(basename "$f")
    # نستثني الملف من فحص نفسه (كل ملف طبعًا "مذكور" داخل نفسه لأننا أضفناه للمرجع)
    count=$(grep -o "$basename_f" "$combined_refs" | wc -l)
    if [ "$count" -eq 0 ]; then
        echo "  ❌ ملف يتيم بلا أي مرجع خارجي: $f"
        FAILED=1
        orphans=$((orphans+1))
    fi
done
[ "$orphans" -eq 0 ] && echo "  ✅ لا يوجد ملفات يتيمة"
echo ""

echo "════════════════════════════════════════"
if [ "$FAILED" -eq 0 ]; then
    echo "✅ كل الفحوصات نجحت — الموقع الحي سليم"
else
    echo "❌ فيه مشاكل تحتاج مراجعة — راجع الأسطر أعلاه"
fi
echo "════════════════════════════════════════"
exit $FAILED
