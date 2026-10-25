import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
export const dynamic = "force-dynamic";

// كل ما يحتاجه المستخدم الحالي، مفلترًا حسب دوره
const userOut = (u: any) => ({
  role: u.role, status: u.status, name: u.name, username: u.username, halqaId: u.halqaId, reqHalqa: u.reqHalqaId || "",
  canPlan: u.canPlan, canAuto: u.canAuto, autoAllowed: u.autoAllowed, plan: u.plan || null,
  createdAt: +u.createdAt, approvedAt: u.approvedAt ? +u.approvedAt : null, ...((u.info as object) || {}),
});
const lessonOut = (l: any) => ({ halqaId: l.halqaId, date: l.date, time: l.time, link: l.link, note: l.note, att: l.att || {}, queue: l.queue || [], current: l.currentId || null });
const recOut = (r: any) => ({ uid: r.userId, sid: r.lessonId, halqaId: r.halqaId, date: r.date, type: r.type, surah: r.surah, from: r.fromA, to: r.toA, mistakes: r.mistakes, alerts: r.alerts, grade: r.grade, pass: r.pass, note: r.note, at: +r.at });
const map = <T,>(rows: any[], f: (r: any) => T) => Object.fromEntries(rows.map((r) => [r.id, f(r)]));

export async function GET() {
  const me = await currentUser();
  if (!me) return NextResponse.json({ me: null });
  const settings = await getSettings();
  let users: any[], halaqat: any[], lessons: any[], recs: any[], joins: any[];

  if (me.role === "admin") {
    [users, halaqat] = await Promise.all([prisma.user.findMany(), prisma.halqa.findMany()]);
    const since = new Date(); since.setDate(since.getDate() - 400);
    const sinceKey = since.toISOString().slice(0, 10);
    [lessons, recs] = await Promise.all([prisma.lesson.findMany({ where: { date: { gte: sinceKey } } }), prisma.rec.findMany({ where: { date: { gte: sinceKey } } })]);
    joins = await prisma.join.findMany({ where: { lessonId: { in: lessons.map((l) => l.id) } } });
  } else if (me.role === "teacher") {
    halaqat = await prisma.halqa.findMany({ where: { teacherId: me.id } });
    const hids = halaqat.map((h) => h.id);
    const studs = await prisma.user.findMany({ where: { role: "student", halqaId: { in: hids }, status: { not: "pending" } } });
    users = [me, ...studs];
    lessons = await prisma.lesson.findMany({ where: { halqaId: { in: hids } } });
    recs = await prisma.rec.findMany({ where: { userId: { in: studs.map((s) => s.id) } } });
    joins = await prisma.join.findMany({ where: { lessonId: { in: lessons.map((l) => l.id) } } });
  } else {
    users = [me];
    halaqat = me.halqaId ? await prisma.halqa.findMany({ where: { id: me.halqaId } }) : [];
    lessons = me.halqaId ? await prisma.lesson.findMany({ where: { halqaId: me.halqaId } }) : [];
    // الطالب يرى حضوره فقط، بدون الطابور
    lessons = lessons.map((l) => ({ ...l, att: (l.att as any)?.[me.id] ? { [me.id]: (l.att as any)[me.id] } : {}, queue: [], currentId: null }));
    recs = await prisma.rec.findMany({ where: { userId: me.id } });
    joins = await prisma.join.findMany({ where: { userId: me.id } });
  }

  const out = {
    me: me.id,
    users: map(users, userOut),
    halaqat: map(halaqat, (h) => ({ name: h.name, teacherId: h.teacherId || "", days: h.days, time: h.time })),
    sessions: map(lessons, lessonOut),
    recs: map(recs, recOut),
    joins: Object.fromEntries(joins.map((j) => [j.lessonId + "_" + j.userId, { sid: j.lessonId, uid: j.userId, at: +j.at }])),
    settings: { main: settings },
  };
  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}
