import { prisma } from "@/lib/db";
import { handle } from "@/lib/auth";
import { requireAdmin, seedMasaedFor } from "@/lib/majalis";
export const dynamic = "force-dynamic";

// قائمة المجالس مع عدد الأسئلة وعدد اللي انسألت
export async function GET() {
  return handle(async () => {
    const me = await requireAdmin();
    await seedMasaedFor(me.id).catch((e) => console.error("majalis seed", e));
    const list = await prisma.majlis.findMany({
      where: { userId: me.id },
      select: { id: true, sheikh: true, topic: true, date: true, place: true, createdAt: true, _count: { select: { questions: true } } },
      orderBy: { createdAt: "desc" },
    });
    const asked = await prisma.majlisQ.groupBy({ by: ["majlisId"], where: { asked: true, majlis: { userId: me.id } }, _count: { _all: true } });
    const am: Record<string, number> = {};
    asked.forEach((a) => { am[a.majlisId] = a._count._all; });
    return {
      me: { name: me.name },
      majalis: list.map((m) => ({ id: m.id, sheikh: m.sheikh, topic: m.topic, date: m.date, place: m.place, createdAt: m.createdAt.getTime(), qCount: m._count.questions, askedCount: am[m.id] || 0 })),
    };
  });
}
