#!/bin/bash
# ربط نسخة النظام بمشروع Supabase جديد (نقل الاستضافة أو التركيبة الثانية).
# الاستخدام:
#   bash scripts/retarget_supabase.sh <NEW_PROJECT_REF> <NEW_ANON_KEY>
# بيبدّل معرّف المشروع القديم ومفتاح anon القديم في كل ملفات الموقع.
# مابيلمسش:
#   - omraa-license.js: عنوان سجل التراخيص بتاع المالك، لازم يفضل زي ما هو.
#   - license.json: ده بيتغيّر بس بمفتاح جديد من المالك (DEPLOYMENT.md §٤).
#   - scripts/ و.git
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
NEW_REF="${1:?اكتب معرّف المشروع الجديد}"; NEW_KEY="${2:?اكتب مفتاح anon الجديد}"
[[ "$NEW_REF" =~ ^[a-z0-9]{20}$ ]] || { echo "❌ معرّف المشروع لازم يبقى 20 حرف/رقم صغير"; exit 1; }
[[ "$NEW_KEY" == eyJ* || "$NEW_KEY" == sb_publishable_* ]] || { echo "❌ ده مش شكل مفتاح anon/publishable"; exit 1; }
OLD_REF="mjetglnmivwphxyzflsz"
OLD_KEY=$(grep -rhoE "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+" omraa-telemetry.js | head -1)
mapfile -t FILES < <(grep -rlE "$OLD_REF|${OLD_KEY:-__none__}" --include=*.js --include=*.html --include=*.txt --include=*.json . \
  | grep -v '^\./\.git/' | grep -v '^\./scripts/' | grep -v '^\./omraa-license\.js$' | grep -v '^\./license\.json$')
echo "هيتعدّل ${#FILES[@]} ملف:"; printf '  %s\n' "${FILES[@]}"
read -r -p "نكمّل؟ (y/N) " ok; [[ "$ok" == y ]] || exit 1
for f in "${FILES[@]}"; do
  python3 - "$f" "$OLD_REF" "$NEW_REF" "$OLD_KEY" "$NEW_KEY" <<'PY'
import sys
f, old_ref, new_ref, old_key, new_key = sys.argv[1:]
s = open(f, encoding='utf8').read()
t = s.replace(old_key, new_key) if old_key else s
t = t.replace(old_ref, new_ref)
if t != s: open(f, 'w', encoding='utf8').write(t)
PY
done
left=$(grep -rl "$OLD_REF" --include=*.js --include=*.html --include=*.txt . | grep -v '^\./\.git/' | grep -v '^\./scripts/' | grep -v '^\./omraa-license\.js$' || true)
[ -z "$left" ] && echo "✅ اتربط بالمشروع $NEW_REF" || { echo "⚠️ لسه فيه إشارات للمشروع القديم:"; echo "$left"; }
echo "الخطوة الجاية: اطلب من المالك مفتاح ترخيص للمشروع والدومين الجديد، وحطّه مكان license.json."
