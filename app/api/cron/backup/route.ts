import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { snapshot } from "@/lib/backup";
export const dynamic = "force-dynamic";
// يشغّله Vercel Cron أسبوعيًا (vercel.json). يحتاج CRON_SECRET في Vercel.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const data = await snapshot(); const json = JSON.stringify(data);
  await prisma.backup.create({ data: { data: data as any, size: json.length } });
  const old = await prisma.backup.findMany({ orderBy: { at: "desc" }, skip: 8, select: { id: true } });
  if (old.length) await prisma.backup.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
  return NextResponse.json({ ok: true, size: json.length });
}
