// حلقات ارتق: العمل بدون إنترنت + الإشعارات
const V = 'irtaq-v3';
const SHELL = ['/', '/app.js?v=7', '/manifest.webmanifest', '/icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
async function netFirst(req, key) {
  const c = await caches.open(V);
  try {
    const r = await fetch(req);
    if (r.ok) c.put(key || req, r.clone());
    return r;
  } catch (e) {
    const hit = await c.match(key || req);
    if (!hit) throw e;
    if ((key || req.url || '').toString().includes('/api/data')) {
      const h = new Headers(hit.headers); h.set('x-irtaq-cache', '1');
      return new Response(await hit.blob(), { status: 200, headers: h });
    }
    return hit;
  }
}
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const u = new URL(req.url); if (u.origin !== location.origin) return;
  if (u.pathname === '/api/data') { e.respondWith(netFirst(req, '/api/data')); return; }
  if (u.pathname.startsWith('/api/')) return;
  if (req.mode === 'navigate') { e.respondWith(netFirst(req, '/')); return; }
  if (u.pathname.startsWith('/_next/static/') || /\.(png|svg|js|css|webmanifest)$/.test(u.pathname)) {
    e.respondWith(caches.open(V).then(async c => { const hit = await c.match(req); const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit); return hit || net; }));
  }
});
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'حلقات ارتق', body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'حلقات ارتق', { body: d.body || '', tag: d.tag, icon: '/icon-192.png', badge: '/icon-192.png', dir: 'rtl', lang: 'ar', data: { url: d.url || '/' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => { for (const w of ws) { if ('focus' in w) { w.focus(); return; } } return self.clients.openWindow(url); }));
});
