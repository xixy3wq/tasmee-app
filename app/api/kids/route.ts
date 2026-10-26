import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/session";
import { localDate } from "@/lib/settings";
export const dynamic = "force-dynamic";
// ملخص كل الأبناء المحفوظين على جهاز ولي الأمر في شاشة وحدة
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const tokens: string[] = (Array.isArray(b.tokens) ? b.tokens : []).slice(0, 10).map(String);
  const t = localDate(); const since = localDate(-30);
  const out: any[] = [];
  for (const tok of tokens) {
    const id = await verifySession(tok);
    const u = id ? await prisma.user.findUnique({ where: { id } }) : null;
    if (!u || u.role !== "student") { out.push({ token: tok, error: "expired" }); continue; }
    if (u.status !== "active") { out.push({ id: u.id, name: u.name, status: u.status }); continue; }
    const h = u.halqaId ? await prisma.halqa.findUnique({ where: { id: u.halqaId } }) : null;
    const lessons = u.halqaId ? await prisma.lesson.findMany({ where: { halqaId: u.halqaId, date: { gte: since }, cancelled: false }, orderBy: [{ date: "asc" }, { time: "asc" }] }) : [];
    const past = lessons.filter((l) => l.date <= t);
    const att = past.map((l) => ((l.att as any) || {})[u.id]).filter(Boolean);
    const pres = att.filter((v: string) => v === "p" || v === "l").length; const abs = att.filter((v: string) => v === "a").length;
    const todayL = lessons.find((l) => l.date === t) || null;
    const next = (await prisma.lesson.findFirst({ where: { halqaId: u.halqaId || "-", cancelled: false, date: { gt: t } }, orderBy: [{ date: "asc" }, { time: "asc" }] })) || null;
    const recs = await prisma.rec.findMany({ where: { userId: u.id }, orderBy: { at: "desc" }, take: 3 });
    const unreadDm = await prisma.dm.count({ where: { studentId: u.id, fromStaff: true, readAt: null } });
    out.push({
      id: u.id, name: u.name, halqa: h?.name || "",
      today: todayL ? { time: todayL.time, att: ((todayL.att as any) || {})[u.id] || null } : null,
      next: next ? { date: next.date, time: next.time } : null,
      rate: att.length ? Math.round((pres / att.length) * 100) : null, abs,
      recs: recs.map((r) => ({ date: r.date, type: r.type, surah: r.surah, from: r.fromA, to: r.toA, grade: r.grade, note: r.note })),
      unreadDm,
    });
  }
  return NextResponse.json({ kids: out }, { headers: { "Cache-Control": "no-store" } });
}
