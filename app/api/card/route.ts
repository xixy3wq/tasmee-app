import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSettings, localDate } from "@/lib/settings";
import { cardParse, cardOk } from "@/lib/links";
import { locDate, planPub } from "@/lib/pubdata";
export const dynamic = "force-dynamic";
// بيانات سجل الطالب الخاص (/s/...): بالرابط الموقّع فقط، وبدون أي بيانات تواصل أو دخول
const NO = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };
export async function GET(req: Request) {
  const no = () => NextResponse.json({ error: "الرابط غير صحيح أو أُلغي. اطلب رابطًا جديدًا من المعلم." }, { status: 404, headers: NO });
  const p = cardParse(new URL(req.url).searchParams.get("t") || "");
  if (!p) return no();
  const st = await prisma.user.findUnique({ where: { id: p.id } });
  if (!st || st.role !== "student" || st.status === "pending") return no();
  const plan: any = st.plan || {};
  if (!cardOk(st.id, +plan.linkV || 0, p.s)) return no();
  const s: any = await getSettings();
  const h = st.halqaId ? await prisma.halqa.findUnique({ where: { id: st.halqaId } }) : null;
  const since = localDate(-400);
  const [lessons, recs] = await Promise.all([
    h ? prisma.lesson.findMany({ where: { halqaId: h.id, date: { gte: since } }, select: { date: true, att: true, cancelled: true } }) : Promise.resolve([] as any[]),
    prisma.rec.findMany({ where: { userId: st.id, date: { gte: since } }, select: { date: true, type: true, surah: true, fromA: true, toA: true, pass: true, grade: true, at: true } }),
  ]);
  return NextResponse.json({
    id: st.id, name: st.name, center: s.center, halqa: h?.name || "", fem: h?.gender === "f", today: localDate(),
    joined: locDate(st.approvedAt || st.createdAt), plan: planPub(plan),
    set: { terms: s.terms || [], daily: s.daily || null },
    sessions: lessons.map((l: any) => { const v = ((l.att as any) || {})[st.id]; return { date: l.date, cancelled: l.cancelled, att: v ? { [st.id]: v } : {} }; }),
    recs: recs.map((r) => ({ date: r.date, type: r.type, surah: r.surah, from: r.fromA, to: r.toA, pass: r.pass, grade: r.grade, at: +r.at })),
  }, { headers: NO });
}
