import { prisma } from "./db";
// إشعارات الجوال (Web Push). تحتاج VAPID_PUBLIC_KEY و VAPID_PRIVATE_KEY في Vercel، وإلا تُتجاهل بهدوء.
let ready: any = null;
async function wp() {
  if (ready !== null) return ready;
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return (ready = false);
  const m: any = await import("web-push");
  const w = m.default || m;
  w.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", pub, priv);
  return (ready = w);
}
export const pushEnabled = () => !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
export async function notify(userIds: string[], msg: { title: string; body: string; url?: string; tag?: string }) {
  const w = await wp(); if (!w || !userIds.length) return 0;
  const subs = await prisma.pushSub.findMany({ where: { userId: { in: userIds } } });
  let n = 0;
  await Promise.all(subs.map(async (s) => {
    try { await w.sendNotification({ endpoint: s.endpoint, keys: s.keys as any }, JSON.stringify(msg), { TTL: 3600 }); n++; }
    catch (e: any) { if (e?.statusCode === 404 || e?.statusCode === 410) await prisma.pushSub.delete({ where: { id: s.id } }).catch(() => {}); }
  }));
  return n;
}
