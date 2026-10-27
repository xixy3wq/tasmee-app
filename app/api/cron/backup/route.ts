import { NextResponse } from "next/server";
import { runBackup } from "@/lib/backup";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
// يشغّله Vercel Cron كل يوم (vercel.json). يحتاج CRON_SECRET في Vercel.
// ينسخ داخل قاعدة الموقع (آخر 7) وفي قاعدة النسخ الخارجية إذا مربوطة (آخر 30)
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const r = await runBackup("auto");
  return NextResponse.json({ ok: true, ...r });
}
