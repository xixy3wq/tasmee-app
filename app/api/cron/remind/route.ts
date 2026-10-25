import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { notify } from "@/lib/push";
import { processQueue } from "@/lib/wa";
import { localDate } from "@/lib/settings";
export const dynamic = "force-dynamic";
// تذكير قبل الحصة بـ 15 دقيقة تقريبًا. يُستدعى كل 5 دقائق من خدمة مجانية مثل cron-job.org:
// https://الموقع/api/cron/remind?key=CRON_SECRET
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET; const url = new URL(req.url);
  const auth = req.headers.get("authorization") === `Bearer ${secret}` || url.searchParams.get("key") === secret;
  if (!secret || !auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const off = Number(process.env.APP_TZ_OFFSET_MIN ?? 180);
  const nowLocal = new Date(Date.now() + off * 60000);
  const mins = nowLocal.getUTCHours() * 60 + nowLocal.getUTCMinutes();
  const lessons = await prisma.lesson.findMany({ where: { date: localDate(), cancelled: false, reminded: false } });
  let sent = 0;
  for (const l of lessons) {
    if (!/^\d{2}:\d{2}$/.test(l.time)) continue;
    const [h, m] = l.time.split(":").map(Number); const diff = h * 60 + m - mins;
    if (diff > 20 || diff < -5) continue;
    const studs = await prisma.user.findMany({ where: { halqaId: l.halqaId, role: "student", status: "active" }, select: { id: true } });
    const halqa = await prisma.halqa.findUnique({ where: { id: l.halqaId } });
    const ids = [...studs.map((s) => s.id), ...(halqa?.teacherId ? [halqa.teacherId] : []), ...(l.subId ? [l.subId] : [])];
    sent += await notify(ids, { title: "تذكير بالحصة", body: `${halqa?.name || "الحلقة"} تبدأ ${diff > 0 ? "بعد " + diff + " دقيقة" : "الآن"}`, url: "/", tag: "remind-" + l.id });
    await prisma.lesson.update({ where: { id: l.id }, data: { reminded: true } });
  }
  const wa = await processQueue(30);
  return NextResponse.json({ ok: true, sent, wa });
}
