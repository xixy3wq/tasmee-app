import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { snapshot } from "@/lib/backup";
export const dynamic = "force-dynamic";
// تنزيل نسخة احتياطية (المدير الكامل فقط). ?id= لتنزيل نسخة أسبوعية محفوظة
export async function GET(req: Request) {
  const u = await currentUser();
  if (!u || u.role !== "admin" || u.perms) return NextResponse.json({ error: "للمدير فقط" }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id");
  const data = id ? (await prisma.backup.findUnique({ where: { id } }))?.data : await snapshot();
  if (!data) return NextResponse.json({ error: "غير موجودة" }, { status: 404 });
  const name = "irtaq-backup-" + new Date().toISOString().slice(0, 10) + ".json";
  return new NextResponse(JSON.stringify(data), { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" } });
}
