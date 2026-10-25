// يُشغَّل مع كل رفع على Vercel: يضمن وجود حساب المدير من متغيرات SEED_ADMIN_*.
// كلمة المرور تُضبط عند الإنشاء فقط. لإعادة ضبطها: أضف SEED_ADMIN_FORCE_PASSWORD=1 ثم Redeploy (واحذفه بعدها).
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const prisma = new PrismaClient();
const username = (process.env.SEED_ADMIN_USERNAME || "").trim().toLowerCase();
const password = (process.env.SEED_ADMIN_PASSWORD || "").trim();
const name = (process.env.SEED_ADMIN_NAME || "المدير").trim();
const force = process.env.SEED_ADMIN_FORCE_PASSWORD === "1";
try {
  if (!username || password.length < 8) {
    console.warn("SEED_ADMIN_USERNAME / SEED_ADMIN_PASSWORD (8+) missing - admin not changed");
  } else {
    const ex = await prisma.user.findUnique({ where: { username } });
    if (!ex) {
      await prisma.user.create({ data: { role: "admin", status: "active", name, username, passwordHash: await bcrypt.hash(password, 10) } });
      console.log("ADMIN_OK created");
    } else {
      await prisma.user.update({ where: { username }, data: { role: "admin", status: "active", ...(force ? { passwordHash: await bcrypt.hash(password, 10) } : {}) } });
      console.log(force ? "ADMIN_OK password reset" : "ADMIN_OK exists");
    }
  }
} finally {
  await prisma.$disconnect();
}
