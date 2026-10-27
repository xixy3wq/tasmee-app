// دفتر مجالس المشايخ: صلاحية المدير، وإضافة مجلس الشيخ مساعد الطيار أول مرة
import { prisma } from "./db";
import { currentUser, fail } from "./auth";
import seed from "@/prisma/majalis-seed.json";

export async function requireAdmin() {
  const u = await currentUser();
  if (!u) fail("سجّل دخولك", 401);
  if (u!.role !== "admin") fail("هذا القسم لحساب المدير فقط", 403);
  return u!;
}

export async function seedMasaedFor(userId: string) {
  const key = "majalis_seeded_" + userId;
  const done = await prisma.setting.findUnique({ where: { key } });
  if (done) return;
  const m: any = (seed as any).majlis;
  await prisma.majlis.create({
    data: {
      userId, sheikh: m.sheikh, topic: m.topic || "", date: m.date || "", place: m.place || "",
      opening: m.opening || "", briefing: m.briefing || "", books: m.books || "", general: m.general || "",
      questions: { create: (seed as any).questions.map((q: any) => ({ text: q.text, why: q.why || "", grp: q.group || "core", pos: q.order || 0 })) },
    },
  });
  await prisma.setting.create({ data: { key, value: true } });
}

export const mtext = (v: unknown, max = 20000) => String(v ?? "").slice(0, max);
export const MID_RE = /^[a-z0-9]{6,40}$/;
