import { prisma } from "./db";
import { localDate } from "./settings";
import { dayEndMs } from "./prayer";
const key = (b: string | null | undefined) => b || "_";
/** المعلم اللي ما سجّل خروجه: ينسجّل خروجه تلقائيًا عند وقت الانصراف (مرة كل دقيقة بالكثير) */
export async function autoCheckout(s: any) {
  const g = globalThis as any; if (g.__tout && Date.now() - g.__tout < 60000) return 0; g.__tout = Date.now();
  const open = await prisma.teacherIn.findMany({ where: { outAt: null, date: { gte: localDate(-14) } } });
  let n = 0;
  for (const t of open) {
    const end = dayEndMs(s, t.date, key(t.branch));
    if (!end || Date.now() < end) continue;
    await prisma.teacherIn.update({ where: { id: t.id }, data: { outAt: new Date(Math.max(end, +t.at)), outAuto: true } }); n++;
  }
  return n;
}
