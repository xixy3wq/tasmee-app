import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { getSettings, isHoliday, localDate, weekday, type Settings } from "@/lib/settings";
export const dynamic = "force-dynamic";

// كل ما يحتاجه المستخدم الحالي، مفلترًا حسب دوره
const userOut = (u: any) => ({
  role: u.role, status: u.status, name: u.name, username: u.username, halqaId: u.halqaId, reqHalqa: u.reqHalqaId || "",
  canPlan: u.canPlan, canAuto: u.canAuto, autoAllowed: u.autoAllowed, plan: u.plan || null,
  createdAt: +u.createdAt, approvedAt: u.approvedAt ? +u.approvedAt : null, ...((u.info as object) || {}),
});
const lessonOut = (l: any) => ({
  halqaId: l.halqaId, date: l.date, time: l.time, link: l.link, note: l.note, att: l.att || {}, queue: l.queue || [], current: l.currentId || null,
  auto: !!l.autoKey, cancelled: !!l.cancelled, issues: l.issues || {}, ...(l.qnames ? { qnames: l.qnames, cname: l.cname } : {}),
});
const recOut = (r: any) => ({ uid: r.userId, sid: r.lessonId, halqaId: r.halqaId, date: r.date, type: r.type, surah: r.surah, from: r.fromA, to: r.toA, mistakes: r.mistakes, alerts: r.alerts, grade: r.grade, pass: r.pass, note: r.note, secs: r.secs ?? null, full: !!r.full, quick: !!r.quick, at: +r.at });
const map = <T,>(rows: any[], f: (r: any) => T) => Object.fromEntries(rows.map((r) => [r.id, f(r)]));

// إنشاء حصص الأيام القادمة للحلقات ذات الجدول الثابت (مرة كل 10 دقائق لكل نسخة خادم)
const g = globalThis as unknown as { lastEnsure?: Record<string, number> };
async function ensureLessons(halaqat: any[], s: Settings) {
  g.lastEnsure ??= {};
  const now = Date.now();
  const rows: any[] = [];
  for (const h of halaqat) {
    if (!h.auto || !h.days?.length) continue;
    if (now - (g.lastEnsure[h.id] || 0) < 10 * 60000) continue;
    g.lastEnsure[h.id] = now;
    for (let i = 0; i < 7; i++) {
      const date = localDate(i);
      if (!h.days.includes(weekday(date)) || isHoliday(s, date)) continue;
      rows.push({ halqaId: h.id, date, time: h.time || "", autoKey: h.id + "_" + date });
    }
  }
  if (rows.length) await prisma.lesson.createMany({ data: rows, skipDuplicates: true });
}

export async function GET() {
  const me = await currentUser();
  if (!me) return NextResponse.json({ me: null });
  const settings = await getSettings();
  let users: any[], halaqat: any[], lessons: any[], recs: any[], joins: any[];

  if (me.role === "admin") {
    halaqat = await prisma.halqa.findMany();
    await ensureLessons(halaqat, settings);
    users = await prisma.user.findMany();
    const sinceKey = localDate(-400);
    [lessons, recs] = await Promise.all([prisma.lesson.findMany({ where: { date: { gte: sinceKey } } }), prisma.rec.findMany({ where: { date: { gte: sinceKey } } })]);
    joins = await prisma.join.findMany({ where: { lessonId: { in: lessons.map((l) => l.id) } } });
  } else if (me.role === "teacher") {
    halaqat = await prisma.halqa.findMany({ where: { teacherId: me.id } });
    await ensureLessons(halaqat, settings);
    const hids = halaqat.map((h) => h.id);
    const studs = await prisma.user.findMany({ where: { role: "student", halqaId: { in: hids }, status: { not: "pending" } } });
    users = [me, ...studs];
    lessons = await prisma.lesson.findMany({ where: { halqaId: { in: hids } } });
    recs = await prisma.rec.findMany({ where: { userId: { in: studs.map((s) => s.id) } } });
    joins = await prisma.join.findMany({ where: { lessonId: { in: lessons.map((l) => l.id) } } });
  } else {
    users = [me];
    halaqat = me.halqaId ? await prisma.halqa.findMany({ where: { id: me.halqaId } }) : [];
    await ensureLessons(halaqat, settings);
    lessons = me.halqaId ? await prisma.lesson.findMany({ where: { halqaId: me.halqaId } }) : [];
    // أسماء الزملاء الأولى فقط، لشاشة الطابور في حصص اليوم
    const today = localDate(), yday = localDate(-1);
    const names: Record<string, string> = {};
    if (lessons.some((l) => l.date >= yday && ((l.queue as any[])?.length || l.currentId))) {
      const mates = await prisma.user.findMany({ where: { halqaId: me.halqaId!, role: "student" }, select: { id: true, name: true } });
      mates.forEach((m) => (names[m.id] = m.id === me.id ? m.name : (m.name || "").split(" ")[0]));
    }
    lessons = lessons.map((l) => {
      const att = (l.att as any) || {}; const iss = (l.issues as any) || {};
      const live = l.date >= yday && l.date <= today;
      return {
        ...l, att: att[me.id] ? { [me.id]: att[me.id] } : {}, issues: iss[me.id] ? { [me.id]: iss[me.id] } : {},
        queue: live ? ((l.queue as string[]) || []).filter((x) => names[x]) : [], currentId: live ? l.currentId : null,
        qnames: live ? ((l.queue as string[]) || []).filter((x) => names[x]).map((x) => ({ id: x, n: names[x] })) : [],
        cname: live && l.currentId ? names[l.currentId] || "" : "",
      };
    });
    recs = await prisma.rec.findMany({ where: { userId: me.id } });
    joins = await prisma.join.findMany({ where: { userId: me.id } });
  }

  const out = {
    me: me.id,
    today: localDate(),
    users: map(users, userOut),
    halaqat: map(halaqat, (h) => ({ name: h.name, teacherId: h.teacherId || "", days: h.days, time: h.time, link: h.link || "", auto: !!h.auto })),
    sessions: map(lessons, lessonOut),
    recs: map(recs, recOut),
    joins: Object.fromEntries(joins.map((j) => [j.lessonId + "_" + j.userId, { sid: j.lessonId, uid: j.userId, at: +j.at, left: j.leftAt ? +j.leftAt : null }])),
    settings: { main: settings },
  };
  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}
