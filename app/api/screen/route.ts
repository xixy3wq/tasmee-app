import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSettings, localDate, weekStart } from "@/lib/settings";
import { screenOk } from "@/lib/links";
import { genderWhere, sideVal } from "@/lib/scope";
import { locDate, planPub, shortName } from "@/lib/pubdata";
export const dynamic = "force-dynamic";
// بيانات شاشة الجامع: نتائج اليوم وأسبوعه لحلقات القسم (والمجمع إن حُدد). بالمفتاح الموقّع فقط
const NO = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const side = sideVal(q.get("side")); const b = q.get("b") || "*";
  const s: any = await getSettings();
  if (!screenOk(+s.screenV || 0, side, b, q.get("k") || "")) return NextResponse.json({ error: "رابط الشاشة غير صحيح أو أُلغي. انسخ الرابط الجديد من التقارير." }, { status: 404, headers: NO });
  const today = localDate(); const wk = weekStart(today);
  const halaqat = (await prisma.halqa.findMany({ where: genderWhere(side) })).filter((h) => b === "*" || (h.branch || "") === (b === "_" ? "" : b));
  const hids = halaqat.map((h) => h.id);
  const studs = hids.length ? await prisma.user.findMany({ where: { role: "student", status: "active", halqaId: { in: hids } }, select: { id: true, name: true, halqaId: true, plan: true, approvedAt: true, createdAt: true } }) : [];
  const [lessons, recs] = await Promise.all([
    hids.length ? prisma.lesson.findMany({ where: { halqaId: { in: hids }, date: { gte: wk, lte: today } }, select: { halqaId: true, date: true, time: true, att: true, cancelled: true } }) : Promise.resolve([] as any[]),
    studs.length ? prisma.rec.findMany({ where: { userId: { in: studs.map((x) => x.id) }, date: { gte: wk, lte: today } }, select: { userId: true, date: true, type: true, surah: true, fromA: true, toA: true, pass: true, grade: true, at: true } }) : Promise.resolve([] as any[]),
  ]);
  const teachers = await prisma.user.findMany({ where: { id: { in: halaqat.map((h) => h.teacherId).filter((x): x is string => !!x) } }, select: { id: true, name: true } });
  return NextResponse.json({
    center: s.center, side, branch: b === "*" ? "" : b === "_" ? "" : b, today, now: Date.now(),
    set: { terms: s.terms || [], daily: s.daily || null },
    halaqat: halaqat.map((h) => ({ id: h.id, name: h.name, branch: h.branch || "", teacher: shortName(teachers.find((t) => t.id === h.teacherId)?.name || "") })),
    students: studs.map((x) => ({ id: x.id, n: shortName(x.name), halqaId: x.halqaId, plan: planPub(x.plan), joined: locDate(x.approvedAt || x.createdAt) })),
    sessions: lessons.map((l: any) => ({ halqaId: l.halqaId, date: l.date, time: l.time, cancelled: l.cancelled, att: l.att || {} })),
    recs: recs.map((r: any) => ({ uid: r.userId, date: r.date, type: r.type, surah: r.surah, from: r.fromA, to: r.toA, pass: r.pass, grade: r.grade, at: +r.at })),
  }, { headers: NO });
}
