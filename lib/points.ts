import { prisma } from "./db";
import { rangePages } from "./pages";
import type { Settings } from "./settings";

/** نقاط الطلاب من الحضور والتسميع خلال فترة. نفس القواعد المستخدمة في الواجهة. */
export async function halqaPoints(halqaId: string, from: string, to: string, s: Settings) {
  const P = s.points;
  const studs = await prisma.user.findMany({ where: { halqaId, role: "student", status: "active" }, select: { id: true, name: true } });
  const pts: Record<string, number> = {}; studs.forEach((x) => (pts[x.id] = 0));
  const lessons = await prisma.lesson.findMany({ where: { halqaId, cancelled: false, date: { gte: from, lte: to } }, select: { att: true } });
  for (const l of lessons) for (const [uid, v] of Object.entries((l.att as any) || {})) {
    if (!(uid in pts)) continue;
    if (v === "p") pts[uid] += +P.present || 0; else if (v === "l") pts[uid] += +P.late || 0;
  }
  const recs = await prisma.rec.findMany({ where: { userId: { in: studs.map((x) => x.id) }, date: { gte: from, lte: to } } });
  for (const r of recs) {
    const g = r.grade === "ممتاز" ? +P.ex : r.grade === "جيد جدًا" ? +P.vg : r.grade === "جيد" ? +P.gd : 0;
    pts[r.userId] += g || 0;
    if (r.type === "new" && r.pass) pts[r.userId] += (await rangePages(r.surah, r.fromA, r.toA)) * (+P.page || 0);
  }
  return studs.map((x) => ({ id: x.id, name: x.name, pts: Math.round(pts[x.id]) })).sort((a, b) => b.pts - a.pts);
}
