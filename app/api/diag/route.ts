import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
export const dynamic = "force-dynamic";

// فحص السرعة: مكان الخادم ومكان قاعدة البيانات وزمن الاستعلام (لا يعرض أي بيانات سرية)
export async function GET() {
  const pings: number[] = [];
  for (let i = 0; i < 3; i++) { const t = Date.now(); await prisma.$queryRaw`SELECT 1`; pings.push(Date.now() - t); }
  const host = (process.env.DATABASE_URL ?? "").match(/@([^/:?]+)/)?.[1] ?? "";
  const db = host.match(/\.([a-z]{2}-[a-z]+-\d)\.aws/)?.[1] ?? "غير معروف";
  return NextResponse.json({ "مكان الخادم (Vercel)": process.env.VERCEL_REGION ?? "غير معروف", "مكان قاعدة البيانات (Neon)": db, "زمن الاستعلام (ms)": pings });
}
