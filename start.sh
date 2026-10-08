#!/bin/bash
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js غير مثبت. سيُفتح موقع التحميل؛ ثبّت نسخة LTS ثم أعد التشغيل."
  open https://nodejs.org 2>/dev/null || xdg-open https://nodejs.org 2>/dev/null
  exit 1
fi
node server/server.js
