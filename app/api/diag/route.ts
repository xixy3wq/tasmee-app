import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { aiCfg, aiOn, callLlm } from "@/lib/ai";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const g = globalThis as unknown as { aiDiagAt?: number };

// فحص السرعة: مكان الخادم ومكان قاعدة البيانات وزمن الاستعلام (لا يعرض أي بيانات سرية)
export async function GET(req: Request) {
  // فحص المساعد الذكي: مرة كل دقيقة بالكثير، ولا يعرض المفتاح ولا أي بيانات
  if (new URL(req.url).searchParams.get("ai") === "1") {
    if (Date.now() - (g.aiDiagAt || 0) < 60000) return NextResponse.json({ ai: "انتظر دقيقة" });
    g.aiDiagAt = Date.now();
    const c = await aiCfg(); if (!aiOn(c)) return NextResponse.json({ ai: "غير مفعّل" });
    const t0 = Date.now();
    try { const o = await callLlm("رد بكلمة واحدة.", [{ role: "user", text: "قل: تمام" }], [], c); return NextResponse.json({ ai: "ok", provider: c.gemini ? "gemini" : "claude", model: c.geminiModel || "default", ms: Date.now() - t0, len: o.text.length }); }
    catch (e: any) { return NextResponse.json({ ai: "error", ms: Date.now() - t0, error: String(e?.message || e).slice(0, 300) }); }
  }
  const pings: number[] = [];
  for (let i = 0; i < 3; i++) { const t = Date.now(); await prisma.$queryRaw`SELECT 1`; pings.push(Date.now() - t); }
  const host = (process.env.DATABASE_URL ?? "").match(/@([^/:?]+)/)?.[1] ?? "";
  const db = host.match(/\.([a-z]{2}-[a-z]+-\d)\.aws/)?.[1] ?? "غير معروف";
  return NextResponse.json({ "مكان الخادم (Vercel)": process.env.VERCEL_REGION ?? "غير معروف", "مكان قاعدة البيانات (Neon)": db, "زمن الاستعلام (ms)": pings });
}
