import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifySession, SESSION_COOKIE } from "@/lib/session";
export const dynamic = "force-dynamic";
// التنقل بين حسابات الأبناء المحفوظة على جهاز ولي الأمر
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const id = await verifySession(String(b.token || ""));
  const u = id ? await prisma.user.findUnique({ where: { id } }) : null;
  if (!u || u.role !== "student") return NextResponse.json({ error: "انتهت صلاحية هذا الحساب على الجهاز، ادخل بكلمة المرور مرة ثانية" }, { status: 401 });
  if (u.status !== "active") return NextResponse.json({ error: u.status === "pending" ? "حساب هذا الابن بانتظار الاعتماد" : "هذا الحساب موقوف" }, { status: 403 });
  const res = NextResponse.json({ ok: true, name: u.name });
  res.cookies.set(SESSION_COOKIE, String(b.token), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 60 });
  return res;
}
