import { APP_V } from "./version";
// صفحات مستقلة خفيفة تعمل بدون دخول (سجل الطالب لولي الأمر، شاشة الجامع): صفحة HTML بسيطة
// تحمّل منطق الإنجاز المشترك (public/ach.js) ثم واجهتها، والتصميم في public/card.css
export function shellHtml(title: string, script: string) {
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<meta name="theme-color" content="#1f2a5a">
<title>${title}</title>
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Amiri:wght@400;700&display=swap">
<link rel="stylesheet" href="/card.css?v=${APP_V}">
</head>
<body>
<div id="app"><p class="boot">جاري التحميل…</p></div>
<script src="/ach.js?v=${APP_V}"></script>
<script src="/${script}.js?v=${APP_V}"></script>
</body>
</html>`;
}
export const htmlResponse = (html: string) => new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow", "referrer-policy": "no-referrer" } });
