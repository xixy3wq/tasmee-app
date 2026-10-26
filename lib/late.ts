import { prisma } from "./db";
import { notify } from "./push";
import { localDate } from "./settings";
// تنبيه المعلم بمن ما دخل الحصة بعد 10 دقائق من بدايتها (مرة وحدة لكل حصة)
const g = globalThis as unknown as { lateCheckAt?: number };
export async function checkLate(force = false) {
  if (!force && Date.now() - (g.lateCheckAt || 0) < 60000) return 0;
  g.lateCheckAt = Date.now();
  const off = Number(process.env.APP_TZ_OFFSET_MIN ?? 180);
  const now = new Date(Date.now() + off * 60000); const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
  const lessons = await prisma.lesson.findMany({ where: { date: localDate(), cancelled: false, lateAlerted: false } });
  let n = 0;
  for (const l of lessons) {
    if (!/^\d{2}:\d{2}$/.test(l.time)) continue;
    const [h, m] = l.time.split(":").map(Number); const since = mins - (h * 60 + m);
    if (since < 10 || since > 60) continue;
    const claim = await prisma.lesson.updateMany({ where: { id: l.id, lateAlerted: false }, data: { lateAlerted: true } });
    if (claim.count !== 1) continue;
    const halqa = await prisma.halqa.findUnique({ where: { id: l.halqaId } });
    const tid = l.subId || halqa?.teacherId; if (!tid) continue;
    const studs = await prisma.user.findMany({ where: { halqaId: l.halqaId, role: "student", status: "active" }, select: { id: true, name: true } });
    const joined = new Set((await prisma.join.findMany({ where: { lessonId: l.id }, select: { userId: true } })).map((j) => j.userId));
    const att = (l.att as Record<string, string>) || {};
    const missing = studs.filter((s) => !joined.has(s.id) && !["p", "l", "e"].includes(att[s.id]));
    if (!missing.length) continue;
    const names = missing.map((s) => s.name.split(" ")[0]).join("، ");
    n += await notify([tid], { title: `${missing.length} ما دخلوا ${halqa?.name || "الحصة"}`, body: names, url: "/", tag: "late-" + l.id });
  }
  return n;
}
