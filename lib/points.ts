import { prisma } from "./db";
import { rangePages } from "./pages";
import type { Settings } from "./settings";

/** النقاط التلقائية من الحضور والتسميع والسلوك خلال فترة (نفس قواعد الواجهة). to/from بصيغة YYYY-MM-DD، وfrom فارغ = من البداية */
async function autoPoints(studs: { id: string; halqaId: string | null }[], from: string, to: string, s: Settings) {
  const P: any = s.points;
  const pts: Record<string, number> = {}; studs.forEach((x) => (pts[x.id] = 0));
  if (!studs.length) return pts;
  const hids = [...new Set(studs.map((x) => x.halqaId).filter((x): x is string => !!x))];
  const halqaOf: Record<string, string | null> = Object.fromEntries(studs.map((x) => [x.id, x.halqaId]));
  const dw = { ...(from ? { gte: from } : {}), lte: to };
  const [lessons, recs, bads] = await Promise.all([
    prisma.lesson.findMany({ where: { halqaId: { in: hids }, cancelled: false, date: dw }, select: { att: true, halqaId: true } }),
    prisma.rec.findMany({ where: { userId: { in: studs.map((x) => x.id) }, date: dw }, select: { userId: true, grade: true, type: true, pass: true, surah: true, fromA: true, toA: true } }),
    +P.bad ? prisma.behav.findMany({ where: { userId: { in: studs.map((x) => x.id) }, kind: "bad", at: { ...(from ? { gte: new Date(from + "T00:00:00+03:00") } : {}), lte: new Date(to + "T23:59:59+03:00") } }, select: { userId: true } }) : Promise.resolve([] as { userId: string }[]),
  ]);
  for (const l of lessons) for (const [uid, v] of Object.entries((l.att as any) || {})) {
    if (!(uid in pts) || halqaOf[uid] !== l.halqaId) continue;
    if (v === "p") pts[uid] += +P.present || 0; else if (v === "l") pts[uid] += +P.late || 0; else if (v === "a") pts[uid] -= +P.absent || 0;
  }
  // مكافأة سلسلة الحضور: كل 10 حصص متتالية، وكل 30 فوقها مكافأة أكبر (الغياب يقطع السلسلة، والمستأذن ما يقطعها)
  const s10 = +P.streak10 || 0, s30 = +P.streak30 || 0;
  if (s10 || s30) {
    const all = await prisma.lesson.findMany({ where: { halqaId: { in: hids }, cancelled: false, date: { lte: to } }, select: { att: true, halqaId: true, date: true, time: true }, orderBy: [{ date: "asc" }, { time: "asc" }] });
    for (const st of studs) {
      let run = 0;
      for (const l of all) {
        if (l.halqaId !== st.halqaId) continue;
        const v = ((l.att as any) || {})[st.id];
        if (!v || v === "e") continue;
        if (v === "a") { run = 0; continue; }
        run++;
        if (from && l.date < from) continue;
        if (run % 10 === 0) pts[st.id] += s10;
        if (run % 30 === 0) pts[st.id] += s30;
      }
    }
  }
  for (const r of recs) {
    const g = r.grade === "ممتاز" ? +P.ex : r.grade === "جيد جدًا" ? +P.vg : r.grade === "جيد" ? +P.gd : 0;
    pts[r.userId] += g || 0;
    if (r.type === "new" && r.pass) pts[r.userId] += (await rangePages(r.surah, r.fromA, r.toA)) * (+P.page || 0);
  }
  for (const b of bads) pts[b.userId] -= +P.bad || 0;
  return pts;
}

/** لوحة الشرف: نقاط طلاب الحلقة خلال فترة */
export async function halqaPoints(halqaId: string, from: string, to: string, s: Settings) {
  const studs = await prisma.user.findMany({ where: { halqaId, role: "student", status: "active" }, select: { id: true, name: true, halqaId: true } });
  const pts = await autoPoints(studs, from, to, s);
  return studs.map((x) => ({ id: x.id, name: x.name, pts: Math.round(pts[x.id]) })).sort((a, b) => b.pts - a.pts);
}

/** رصيد كل طالب = النقاط التلقائية من البداية + الحركات اليدوية والمتجر (الشراء بالسالب) */
export async function balances(studs: { id: string; halqaId: string | null }[], s: Settings, today: string) {
  const [auto, tx] = await Promise.all([
    autoPoints(studs, "", today, s),
    studs.length ? prisma.pointTx.groupBy({ by: ["userId"], where: { userId: { in: studs.map((x) => x.id) } }, _sum: { amount: true } }) : Promise.resolve([] as any[]),
  ]);
  const out: Record<string, { auto: number; tx: number; bal: number }> = {};
  for (const st of studs) { const a = Math.round(auto[st.id] || 0); const t = (tx as any[]).find((x) => x.userId === st.id)?._sum?.amount || 0; out[st.id] = { auto: a, tx: t, bal: a + t }; }
  return out;
}
export async function balanceOf(st: { id: string; halqaId: string | null }, s: Settings, today: string) {
  return (await balances([st], s, today))[st.id];
}

/** تقدّم الجائزة الجماعية: مجموع نقاط طلاب الحلقة (الموجبة) من تاريخ إضافتها */
export async function groupProgress(halqaIds: string[], from: string, to: string, s: Settings) {
  const studs = await prisma.user.findMany({ where: { halqaId: { in: halqaIds }, role: "student", status: "active" }, select: { id: true, halqaId: true } });
  const pts = await autoPoints(studs, from, to, s);
  return Math.round(Object.values(pts).reduce((t, v) => t + Math.max(0, v), 0));
}
