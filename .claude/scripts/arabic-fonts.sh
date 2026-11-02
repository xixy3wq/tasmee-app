#!/bin/bash
# يثبّت الخطوط العربية من Google Fonts لأي تصميم أو صورة أو فيديو يُصنع في الجلسة.
# آمن إذا تكرر: إذا الخطوط موجودة يطلع على طول.
set -uo pipefail

fams="$(fc-list : family 2>/dev/null)"
if [[ "$fams" == *"IBM Plex Sans Arabic"* && "$fams" == *"Amiri Quran"* ]]; then
  echo "الخطوط العربية مثبتة"
  exit 0
fi

dir="$HOME/.local/share/fonts/arabic"
mkdir -p "$dir" && cd "$dir" || exit 1

# خطوط الموقع أولًا (IBM Plex Sans Arabic و Amiri و Amiri Quran)، وبعدها خطوط إضافية للتصاميم
families=(
  "IBM+Plex+Sans+Arabic:wght@300;400;500;600;700"
  "Amiri:wght@400;700"
  "Amiri+Quran"
  "Almarai:wght@300;400;700;800"
  "Tajawal:wght@400;500;700;900"
  "Cairo:wght@400;600;700;900"
  "Noto+Naskh+Arabic:wght@400;700"
  "Noto+Kufi+Arabic:wght@400;700;900"
  "Reem+Kufi:wght@400;700"
  "Aref+Ruqaa:wght@400;700"
  "Lateef:wght@400;700"
  "Scheherazade+New:wght@400;700"
)

for f in "${families[@]}"; do
  curl -fsS --max-time 20 "https://fonts.googleapis.com/css2?family=$f" \
    | grep -oE "https://fonts.gstatic.com/[^)]+\.ttf" \
    | while read -r u; do curl -fsS --max-time 30 -O "$u" || true; done
done

fc-cache -f >/dev/null 2>&1
echo "تم: $(ls "$dir" | wc -l) ملف خط"
