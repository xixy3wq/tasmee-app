import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { signSession, SESSION_COOKIE } from "@/lib/session";
import { cleanUsername } from "@/lib/auth";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const username = cleanUsername(b.username);
  const u = username ? await prisma.user.findUnique({ where: { username } }) : null;
  const ok = u && (await bcrypt.compare(String(b.password ?? ""), u.passwordHash));
  if (!u || !ok) return NextResponse.json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" }, { status: 401 });
  if (u.status === "pending") return NextResponse.json({ error: "طلب تسجيلك بانتظار اعتماد الإدارة" }, { status: 403 });
  if (u.status !== "active") return NextResponse.json({ error: "هذا الحساب موقوف، تواصل مع إدارة الحلقة" }, { status: 403 });
  const token = await signSession(u.id);
  // للطالب: رمز يحفظه جهاز ولي الأمر للتنقل بين حسابات الأبناء بدون كلمة مرور
  const res = NextResponse.json({ ok: true, ...(u.role === "student" && b.remember ? { account: { id: u.id, name: u.name, token } } : {}) });
  res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 60 });
  return res;
}
