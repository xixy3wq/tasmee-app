import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
export const dynamic = "force-dynamic";

// فحص السرعة: مكان الخادم ومكان قاعدة البيانات وزمن الاستعلام (لا يعرض أي بيانات سرية)
// وللمدير: حجم قاعدة البيانات وعدد الصفوف في كل جدول، عشان يعرف كم استهلك من حد Neon المجاني (1 GB)
export async function GET() {
  const pings: number[] = [];
  for (let i = 0; i < 3; i++) { const t = Date.now(); await prisma.$queryRaw`SELECT 1`; pings.push(Date.now() - t); }
  const host = (process.env.DATABASE_URL ?? "").match(/@([^/:?]+)/)?.[1] ?? "";
  const db = host.match(/\.([a-z]{2}-[a-z]+-\d)\.aws/)?.[1] ?? "غير معروف";
  const isNeon = /neon\.tech$/i.test(host);
  const out: Record<string, unknown> = { "مكان الخادم (Vercel)": process.env.VERCEL_REGION ?? "غير معروف", "قاعدة البيانات": isNeon ? "Neon Postgres" : host ? "Postgres" : "غير معروف", "مكان قاعدة البيانات": db, "اتصال مجمّع (pooler)": /-pooler/.test(host), "زمن الاستعلام (ms)": pings };
  const me = await currentUser().catch(() => null);
  if (me && me.role === "admin" && !me.perms) {
    const size = await prisma.$queryRaw<{ mb: number }[]>`SELECT round(pg_database_size(current_database()) / 1048576.0, 1)::float AS mb`;
    const tables = await prisma.$queryRaw<{ t: string; rows: number; mb: number }[]>`
      SELECT c.relname AS t, c.reltuples::bigint::int AS rows, round(pg_total_relation_size(c.oid) / 1048576.0, 2)::float AS mb
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY pg_total_relation_size(c.oid) DESC`;
    const mb = Number(size[0]?.mb || 0);
    out["حجم القاعدة (MB)"] = mb;
    out["النسبة من حد Neon المجاني (1 GB)"] = Math.round(mb / 1024 * 1000) / 10 + "%";
    out["الجداول"] = tables.map((x) => ({ الجدول: x.t, صفوف: Number(x.rows), MB: Number(x.mb) }));
  }
  return NextResponse.json(out);
}
