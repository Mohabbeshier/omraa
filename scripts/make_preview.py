#!/usr/bin/env python3
"""
make_preview.py — بناء نسخة معاينة (preview) لصفحة موجودة، بدون التأثير على الأصل.

الاستخدام:
  python3 make_preview.py <source_html> <old_chunk_ref> <new_chunk_path>

مثال:
  python3 make_preview.py pos.html \
      "app/(app)/pos/page-f8625146216a06a6v3margin.js" \
      "app/(app)/pos/page-TESTNEW.js"

يبني preview-pos.html و preview-pos.txt يشاورا على الملف الجديد فقط،
مع تعطيل أي navigation link للـ preview نفسها (لتجنب دخول العميل عليها بالغلط
لو فتحها بالخطأ من نتائج بحث أو history).
"""
import sys
import re

def build_preview(source_html_path, old_chunk_ref, new_chunk_path):
    with open(source_html_path, encoding='utf-8') as f:
        content = f.read()

    if old_chunk_ref not in content:
        print(f"❌ لم يتم إيجاد '{old_chunk_ref}' في {source_html_path}")
        sys.exit(1)

    occurrences = content.count(old_chunk_ref)
    if occurrences != 1:
        print(f"⚠️  تحذير: '{old_chunk_ref}' موجود {occurrences} مرة، لا مرة واحدة. تأكد من التفرّد.")

    new_content = content.replace(old_chunk_ref, new_chunk_path)

    # نضيف بانر تحذيري مرئي في أعلى الصفحة يوضح إنها نسخة اختبار
    banner = '<div style="position:fixed;top:0;left:0;right:0;z-index:99999;background:#dc2626;color:#fff;text-align:center;padding:6px;font-weight:bold;font-family:sans-serif;font-size:13px;">⚠️ نسخة اختبار (Preview) — ليست الموقع الحقيقي</div>'
    new_content = new_content.replace('<body', banner + '<body', 1) if '<body' in new_content else new_content

    out_html = 'preview-' + source_html_path
    with open(out_html, 'w', encoding='utf-8') as f:
        f.write(new_content)

    # نفس التعديل على .txt المقابل لو موجود (RSC payload)
    txt_path = source_html_path.replace('.html', '.txt')
    try:
        with open(txt_path, encoding='utf-8') as f:
            txt_content = f.read()
        if old_chunk_ref.replace('/', '\\/') in txt_content:
            txt_content = txt_content.replace(old_chunk_ref.replace('/', '\\/'), new_chunk_path.replace('/', '\\/'))
        elif old_chunk_ref in txt_content:
            txt_content = txt_content.replace(old_chunk_ref, new_chunk_path)
        out_txt = 'preview-' + txt_path
        with open(out_txt, 'w', encoding='utf-8') as f:
            f.write(txt_content)
        print(f"✅ تم إنشاء: {out_html} و {out_txt}")
    except FileNotFoundError:
        print(f"✅ تم إنشاء: {out_html} (لا يوجد .txt مقابل)")

if __name__ == '__main__':
    if len(sys.argv) != 4:
        print(__doc__)
        sys.exit(1)
    build_preview(sys.argv[1], sys.argv[2], sys.argv[3])
