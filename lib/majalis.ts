// دفتر مجالس المشايخ: صلاحية المدير، وإضافة المجالس الجاهزة (مرة وحدة لكل مجلس)
import { prisma } from "./db";
import { currentUser, fail } from "./auth";
import masaed from "@/prisma/majalis-seed.json";
import shahri from "@/prisma/majalis-seed-shahri.json";
import khudairi from "@/prisma/majalis-seed-khudairi.json";

// كل مجلس جاهز له مفتاح في Setting؛ لو حذفه المدير ما يرجع
const SEEDS: { key: string; data: any }[] = [
  { key: "majalis_seeded_", data: masaed },
  { key: "majalis_seeded_shahri_", data: shahri },
  { key: "majalis_seeded_khudairi_", data: khudairi },
];

export async function requireAdmin() {
  const u = await currentUser();
  if (!u) fail("سجّل دخولك", 401);
  if (u!.role !== "admin") fail("هذا القسم لحساب المدير فقط", 403);
  return u!;
}

export async function seedMajalisFor(userId: string) {
  for (const sd of SEEDS) {
    const key = sd.key + userId;
    const done = await prisma.setting.findUnique({ where: { key } });
    if (done) continue;
    const m: any = sd.data.majlis;
    await prisma.majlis.create({
      data: {
        userId, sheikh: m.sheikh, topic: m.topic || "", date: m.date || "", place: m.place || "",
        opening: m.opening || "", briefing: m.briefing || "", books: m.books || "", general: m.general || "",
        questions: { create: sd.data.questions.map((q: any) => ({ text: q.text, why: q.why || "", grp: q.group || "core", pos: q.order || 0 })) },
      },
    });
    await prisma.setting.create({ data: { key, value: true } });
  }
}

export const mtext = (v: unknown, max = 20000) => String(v ?? "").slice(0, max);
export const MID_RE = /^[a-z0-9]{6,40}$/;
