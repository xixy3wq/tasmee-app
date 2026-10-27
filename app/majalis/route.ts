// دفتر مجالس المشايخ: صفحة مستقلة عن واجهة حلقات ارتق (بدون تصميمها)، للمدير فقط.
// الواجهة في public/majalis.js والتصميم في public/majalis.css، والبيانات من /api/majalis/*
const V = "1";
const HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#1D6A56">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="المجالس">
<title>مجالس المشايخ</title>
<link rel="icon" href="/majalis-icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/majalis-180.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600&display=swap">
<link rel="stylesheet" href="/majalis.css?v=${V}">
</head>
<body>
<div id="app" dir="rtl" lang="ar"><p class="boot">جاري التحميل</p></div>
<script src="/majalis.js?v=${V}"></script>
</body>
</html>`;

export async function GET() {
  return new Response(HTML, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
