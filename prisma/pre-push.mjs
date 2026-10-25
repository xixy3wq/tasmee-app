// يُشغَّل قبل prisma db push: يجهّز التعديلات اللي يرفضها db push بدون موافقة (مثل إضافة فهرس فريد).
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const steps = [
  `ALTER TABLE "Lesson" ADD COLUMN IF NOT EXISTS "autoKey" TEXT`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Lesson_autoKey_key" ON "Lesson"("autoKey")`,
];
try {
  const t = await prisma.$queryRawUnsafe(`SELECT to_regclass('"Lesson"') AS t`);
  if (t?.[0]?.t) for (const q of steps) { await prisma.$executeRawUnsafe(q); }
  console.log("PRE_PUSH_OK");
} catch (e) {
  console.warn("PRE_PUSH skipped:", e.message);
} finally {
  await prisma.$disconnect();
}
