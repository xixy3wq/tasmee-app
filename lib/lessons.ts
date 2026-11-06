import { prisma } from "./db";
import { getSettings, isHoliday, localDate, weekday, type Settings } from "./settings";

type H = { id: string; auto: boolean; days: number[]; time: string };
/** الجدول الفعلي للحلقة: «الحصص التلقائية لكل الحلقات» من الإعدادات يشغّلها للكل، والحلقة بدون أيام تاخذ أيام الدوام الافتراضية */
export const autoOf = (h: H, s: Settings) => ({ auto: !!h.auto || !!(s as any).autoAll, days: h.days?.length ? h.days : s.days || [] });
/**
 * يخلي الحصص التلقائية القادمة مطابقة لجدول الحلقة: الوقت والأيام وتشغيل الجدول الثابت.
 * ما يلمس حصة بدأها المعلم، أو فيها تحضير أو دخول أو تسميع أو معلم احتياط، أو عدّلها أحد يدويًا.
 * create: ينشئ حصص الأسبوع الجاي على الجدول الجديد مباشرة.
 */
export async function syncAutoLessons(h0: H, opts: { create?: boolean; s?: Settings } = {}) {
  const today = localDate();
  const s = opts.s || (await getSettings()); const h = { ...h0, ...autoOf(h0, s) };
  const ls = await prisma.lesson.findMany({ where: { halqaId: h.id, autoKey: { not: null }, date: { gte: today }, custom: false, teacherAt: null } });
  let dropped = 0, fixed = 0;
  if (ls.length) {
    const ids = ls.map((l) => l.id);
    const [joins, recs] = await Promise.all([
      prisma.join.findMany({ where: { lessonId: { in: ids } }, select: { lessonId: true } }),
      prisma.rec.findMany({ where: { lessonId: { in: ids } }, select: { lessonId: true } }),
    ]);
    const used = new Set<string>([...joins, ...recs].map((x) => String(x.lessonId)));
    const free = ls.filter((l) => !used.has(l.id) && !Object.keys((l.att as any) || {}).length);
    const drop = free.filter((l) => l.date > today && !l.subId && (!h.auto || !h.days.includes(weekday(l.date))));
    const fix = free.filter((l) => !drop.includes(l) && h.time && l.time !== h.time);
    if (drop.length) { await prisma.lesson.deleteMany({ where: { id: { in: drop.map((l) => l.id) } } }); dropped = drop.length; }
    if (fix.length) { await prisma.lesson.updateMany({ where: { id: { in: fix.map((l) => l.id) } }, data: { time: h.time, reminded: false, lateAlerted: false } }); fixed = fix.length; }
  }
  if (opts.create && h.auto && h.days.length) {
    const rows: any[] = [];
    for (let i = 0; i < 7; i++) { const date = localDate(i); if (h.days.includes(weekday(date)) && !isHoliday(s, date)) rows.push({ halqaId: h.id, date, time: h.time || "", autoKey: h.id + "_" + date }); }
    if (rows.length) await prisma.lesson.createMany({ data: rows, skipDuplicates: true });
  }
  return { dropped, fixed };
}
