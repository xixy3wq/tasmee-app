import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { snapshot, offsiteGet } from "@/lib/backup";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
// تنزيل نسخة احتياطية (المدير الكامل فقط). ?id= نسخة محفوظة داخل الموقع، ?ext= نسخة من قاعدة النسخ الخارجية
export async function GET(req: Request) {
  const u = await currentUser();
  if (!u || u.role !== "admin" || u.perms) return NextResponse.json({ error: "للمدير فقط" }, { status: 403 });
  const q = new URL(req.url).searchParams; const id = q.get("id"); const ext = q.get("ext");
  let data: unknown = null;
  try { data = ext ? await offsiteGet(ext) : id ? (await prisma.backup.findUnique({ where: { id } }))?.data : await snapshot(); }
  catch (e: any) { return NextResponse.json({ error: String(e?.message || e) }, { status: 500 }); }
  if (!data) return NextResponse.json({ error: "غير موجودة" }, { status: 404 });
  const at = (data as any).at ? String((data as any).at).slice(0, 10) : new Date().toISOString().slice(0, 10);
  const name = "irtaq-backup-" + at + ".json";
  return new NextResponse(JSON.stringify(data), { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" } });
}
