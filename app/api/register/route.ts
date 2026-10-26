import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getSettings, cleanFieldValue } from "@/lib/settings";
import { handle, fail, cleanUsername, USERNAME_RE, str } from "@/lib/auth";
export const dynamic = "force-dynamic";

// الحقول العامة لنموذج التسجيل (بدون تسجيل دخول)
export async function GET() {
  return handle(async () => {
    const s = await getSettings();
    const halaqat = await prisma.halqa.findMany({ select: { id: true, name: true, branch: true }, orderBy: { name: "asc" } });
    const x: any = s;
    return { center: s.center, fields: s.fields.filter((f) => f.on), halaqat, supportName: x.supportName || "", supportPhone: x.supportPhone || "" };
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const b = await req.json().catch(() => ({}));
    const name = str(b.name, 120);
    const username = cleanUsername(b.username);
    const password = String(b.password ?? "");
    if (!name) fail("اكتب الاسم الكامل");
    if (!USERNAME_RE.test(username)) fail("اسم المستخدم: حروف إنجليزية أو أرقام، 3 أحرف على الأقل");
    if (password.length < 4) fail("كلمة المرور 4 أحرف على الأقل");
    if (await prisma.user.findUnique({ where: { username } })) fail("اسم المستخدم مستخدم، اختر غيره");
    const s = await getSettings();
    const info: Record<string, string> = {};
    for (const f of s.fields.filter((x) => x.on)) {
      const v = cleanFieldValue(f, b.info?.[f.k]);
      if (f.req && !v) fail("الحقل مطلوب: " + f.label);
      if (v) info[f.k] = v;
    }
    let reqHalqaId: string | null = str(b.reqHalqa, 40) || null;
    if (reqHalqaId && !(await prisma.halqa.findUnique({ where: { id: reqHalqaId } }))) reqHalqaId = null;
    const pending = await prisma.user.count({ where: { status: "pending" } });
    if (pending > 200) fail("طلبات التسجيل كثيرة حاليًا، تواصل مع الإدارة");
    await prisma.user.create({ data: { role: "student", status: "pending", name, username, passwordHash: await bcrypt.hash(password, 10), info, reqHalqaId } });
    return { ok: true };
  });
}
