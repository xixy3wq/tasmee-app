import { NextResponse } from "next/server";
import { APP_V } from "@/lib/version";
import { processQueue, waCfg } from "@/lib/wa";
import { videoCfg, videoOn } from "@/lib/video";
import { scopeHalqaIds, viewSide, sideVal, isSuper, genderWhere } from "@/lib/scope";
import { aiCfg, aiOn } from "@/lib/ai";
import { checkLate } from "@/lib/late";
import { syncAutoLessons } from "@/lib/lessons";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { getSettings, isHoliday, localDate, weekday, weekStart, type Settings } from "@/lib/settings";
import { halqaPoints, balances, groupProgress } from "@/lib/points";
import { closeAuction } from "@/lib/store";
import { autoCheckout } from "@/lib/tout";
import { dayEndMs, prayerToday } from "@/lib/prayer";
import { scopeSpec } from "@/lib/scope";
export const dynamic = "force-dynamic";

// كل ما يحتاجه المستخدم الحالي، مفلترًا حسب دوره
const userOut = (u: any) => ({
  role: u.role, status: u.status, name: u.name, username: u.username, halqaId: u.halqaId, reqHalqa: u.reqHalqaId || "",
  canPlan: u.canPlan, canAuto: u.canAuto, autoAllowed: u.autoAllowed, plan: u.plan || null,
  goal: u.goal || null, wish: u.wish || "", level: u.level || null, perms: u.role === "admin" ? (u.perms ?? null) : undefined, createdAt: +u.createdAt, approvedAt: u.approvedAt ? +u.approvedAt : null, lastSeen: u.lastSeenAt ? +u.lastSeenAt : null, ...((u.info as object) || {}),
});
const lessonOut = (l: any) => ({
  halqaId: l.halqaId, date: l.date, time: l.time, link: l.link, note: l.note, att: l.att || {}, queue: l.queue || [], current: l.currentId || null,
  auto: !!l.autoKey, cancelled: !!l.cancelled, mode: l.mode || "", arr: l.arr || {}, left: l.left || {}, closedAt: l.closedAt ? +l.closedAt : null, issues: l.issues || {}, subId: l.subId || "", teacherAt: l.teacherAt ? +l.teacherAt : null, teacherBy: l.teacherBy || "", ...(l.qnames ? { qnames: l.qnames, cname: l.cname } : {}),
});
const recOut = (r: any) => ({ uid: r.userId, sid: r.lessonId, halqaId: r.halqaId, date: r.date, type: r.type, surah: r.surah, from: r.fromA, to: r.toA, mistakes: r.mistakes, alerts: r.alerts, grade: r.grade, pass: r.pass, note: r.note, by: r.byId || "", secs: r.secs ?? null, full: !!r.full, quick: !!r.quick, at: +r.at });
const map = <T,>(rows: any[], f: (r: any) => T) => Object.fromEntries(rows.map((r) => [r.id, f(r)]));

// إنشاء حصص الأيام القادمة للحلقات ذات الجدول الثابت (مرة كل 10 دقائق لكل نسخة خادم)
const g = globalThis as unknown as { lastEnsure?: Record<string, number> };
async function ensureLessons(halaqat: any[], s: Settings) {
  g.lastEnsure ??= {};
  const now = Date.now();
  const rows: any[] = [];
  const due = halaqat.filter((h) => now - (g.lastEnsure![h.id] || 0) >= 10 * 60000);
  due.forEach((h) => { g.lastEnsure![h.id] = now; });
  // الحصص الجاية تتبع جدول الحلقة لو تغيّر وقتها أو أيامها
  await Promise.all(due.map((h) => syncAutoLessons(h).catch(() => null)));
  for (const h of due) {
    if (!h.auto || !h.days?.length) continue;
    for (let i = 0; i < 7; i++) {
      const date = localDate(i);
      if (!h.days.includes(weekday(date)) || isHoliday(s, date)) continue;
      rows.push({ halqaId: h.id, date, time: h.time || "", autoKey: h.id + "_" + date });
    }
  }
  if (rows.length) await prisma.lesson.createMany({ data: rows, skipDuplicates: true });
}

export async function GET(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ me: null, appV: APP_V });
  const settings = await getSettings();
  let users: any[], halaqat: any[], lessons: any[], recs: any[], joins: any[];
  let board: any = null;
  // القسم المعروض: البنين أو البنات (المدير العام يختار، والباقي قسمهم)
  const view = await viewSide(me as any, new URL(req.url).searchParams.get("side"));

  // آخر دخول (يتحدث كل نص ساعة بالكثير)
  if (!me.lastSeenAt || Date.now() - +me.lastSeenAt > 30 * 60000) await prisma.user.update({ where: { id: me.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  if (me.role === "admin") {
    const sc = await scopeHalqaIds(me); const sp = scopeSpec(me);
    halaqat = await prisma.halqa.findMany({ where: sc ? { id: { in: sc } } : genderWhere(view) });
    await ensureLessons(halaqat, settings);
    const hset = new Set(halaqat.map((h) => h.id));
    const allH = await prisma.halqa.findMany({ select: { teacherId: true, gender: true } });
    const tSide = (x: any) => { if (x.side === "f") return "f"; const g = allH.filter((h) => h.teacherId === x.id); return g.length && g.every((h) => h.gender === "f") ? "f" : "m"; };
    const tIds = new Set(halaqat.map((h) => h.teacherId).filter(Boolean));
    users = (await prisma.user.findMany()).filter((x) => {
      if (x.id === me.id) return true;
      if (x.role === "student") return x.halqaId ? hset.has(x.halqaId) : x.reqHalqaId ? hset.has(x.reqHalqaId) : sideVal(x.side) === view && (x.status === "pending" || !sp);
      if (x.role === "teacher") return tIds.has(x.id) || (!sp && tSide(x) === view);
      if (x.role === "admin") return !sp && (isSuper(x as any) || sideVal(x.side) === view);
      return false;
    });
    const sinceKey = localDate(-400);
    const hIds = halaqat.map((h) => h.id); const sIds = users.filter((x) => x.role === "student").map((x) => x.id);
    [lessons, recs] = await Promise.all([prisma.lesson.findMany({ where: { date: { gte: sinceKey }, halqaId: { in: hIds } } }), prisma.rec.findMany({ where: { date: { gte: sinceKey }, userId: { in: sIds } } })]);
    joins = await prisma.join.findMany({ where: { lessonId: { in: lessons.map((l) => l.id) } } });
  } else if (me.role === "teacher") {
    halaqat = await prisma.halqa.findMany({ where: { teacherId: me.id } });
    await ensureLessons(halaqat, settings);
    const own = halaqat.map((h) => h.id);
    // حصص الاحتياط: يشوف الحصة وطلاب حلقتها فقط
    const subLessons = await prisma.lesson.findMany({ where: { subId: me.id, date: { gte: localDate(-1) } } });
    const subH = [...new Set(subLessons.map((l) => l.halqaId))].filter((x) => !own.includes(x));
    if (subH.length) halaqat = [...halaqat, ...(await prisma.halqa.findMany({ where: { id: { in: subH } } })).map((h) => ({ ...h, sub: true }))];
    const hids = halaqat.map((h) => h.id);
    const studs = await prisma.user.findMany({ where: { role: "student", halqaId: { in: hids }, status: { not: "pending" } } });
    const teachersOfSub = await prisma.user.findMany({ where: { id: { in: halaqat.map((h) => h.teacherId).filter((x): x is string => !!x && x !== me.id) } } });
    users = [me, ...studs, ...teachersOfSub.map((t) => ({ ...t, info: {}, plan: null }))];
    lessons = [...(await prisma.lesson.findMany({ where: { halqaId: { in: own } } })), ...subLessons.filter((l) => !own.includes(l.halqaId))];
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
    // لوحة الشرف الأسبوعية لحلقة الطالب
    if (me.halqaId) {
      const today = localDate(); const list = await halqaPoints(me.halqaId, weekStart(today), today, settings);
      const rank = list.findIndex((x) => x.id === me.id) + 1;
      const mine = list.find((x) => x.id === me.id)?.pts ?? 0;
      const top = settings.board === "hide" ? [] : list.slice(0, settings.board === "top3" ? 3 : 5).map((x) => ({ n: x.id === me.id ? x.name : (x.name || "").split(" ")[0], pts: x.pts, me: x.id === me.id }));
      board = { pts: mine, rank: settings.board === "hide" ? null : rank, total: list.length, top };
    }
  }

  // الإعلانات وقراءتها
  const hidsAll = halaqat.map((h) => h.id);
  const anns = await prisma.ann.findMany({ where: { OR: [{ halqaId: null, side: view }, { halqaId: { in: hidsAll } }] }, orderBy: { at: "desc" }, take: 40 });
  const reads = me.role === "student"
    ? await prisma.annRead.findMany({ where: { userId: me.id, annId: { in: anns.map((a) => a.id) } } })
    : await prisma.annRead.findMany({ where: { annId: { in: anns.map((a) => a.id) } } });
  // الورد اليومي: آخر 14 يوم
  const wUsers = me.role === "student" ? [me.id] : users.filter((x) => x.role === "student").map((x) => x.id);
  const wirds = await prisma.wird.findMany({ where: { userId: { in: wUsers }, date: { gte: localDate(-14) } } });

  const staff = me.role !== "student";
  if (staff) { await processQueue(6); await checkLate().catch(() => 0); }
  // رسائل الطالب مع المعلم + السلوك + التصويت
  const stuIds = me.role === "student" ? [me.id] : users.filter((x) => x.role === "student").map((x) => x.id);
  const since60 = new Date(Date.now() - 60 * 864e5);
  const [dms, behav, polls] = await Promise.all([
    prisma.dm.findMany({ where: { studentId: { in: stuIds }, at: { gte: since60 } }, orderBy: { at: "asc" }, take: 2000 }),
    prisma.behav.findMany({ where: { userId: { in: stuIds }, ...(me.role === "student" ? { visible: true } : {}) }, orderBy: { at: "desc" }, take: 1000 }),
    prisma.poll.findMany({ where: { OR: [{ halqaId: null, side: view }, { halqaId: { in: hidsAll } }] }, orderBy: { at: "desc" }, take: 30 }),
  ]);
  const votes = polls.length ? await prisma.pollVote.findMany({ where: { pollId: { in: polls.map((p) => p.id) } } }) : [];
  const msgs = staff ? await prisma.msg.findMany({ where: { side: view }, orderBy: { at: "desc" }, take: 100 }) : [];
  // ---------- الحضوري: وصول المعلمين اليوم ----------
  const today0 = localDate();
  if (staff) await autoCheckout(settings).catch(() => 0);
  const tinRows = me.role === "student" ? [] : await prisma.teacherIn.findMany({ where: { date: today0, ...(me.role === "teacher" ? { userId: me.id } : {}) } });
  const tins = Object.fromEntries(tinRows.filter((t) => me.role === "teacher" || users.some((x) => x.id === t.userId)).map((t) => [t.userId, { at: +t.at, dist: t.dist, noLoc: t.noLoc, branch: t.branch, out: t.outAt ? +t.outAt : null, outAuto: t.outAuto, outEarly: t.outEarly, outDist: t.outDist }]));
  // وقت انصراف المعلمين اليوم لكل مجمع، وأوقات الصلاة
  const pKeys = [...new Set(["_", ...halaqat.map((h) => h.branch || "_"), ...Object.keys((settings as any).places || {})])];
  const dayEnd = staff ? Object.fromEntries(pKeys.map((k) => [k, dayEndMs(settings, today0, k)])) : {};
  const pray = staff ? prayerToday(settings, today0, "_") : null;
  // الاجتماعات الشغالة الحين
  const meetKeys = !staff ? [] : me.role === "admin" ? ["admins", "t-" + view] : ["t-" + view];
  const meetRows = meetKeys.length ? await prisma.setting.findMany({ where: { key: { in: meetKeys.map((k) => "meet:" + k) } } }) : [];
  const dayK = today0.replace(/-/g, "");
  const meets = Object.fromEntries(meetKeys.map((k) => { const v: any = meetRows.find((r) => r.key === "meet:" + k)?.value || {}; const ppl = v.day === dayK ? Object.entries(v.ppl || {}).filter(([, p]: any) => Date.now() - p.at < 3 * 3600000).map(([id, p]: any) => ({ id, n: p.n, at: p.at })) : []; return [k, { ppl, by: ppl.length ? v.by : "", at: ppl.length ? v.at : 0 }]; }));
  // ---------- النقاط والمتجر ----------
  const studsVis = users.filter((x) => x.role === "student" && x.status !== "pending");
  const cache = ((globalThis as any).__balCache ??= new Map<string, { t: number; v: any }>());
  const bkey = studsVis.map((x) => x.id).sort().join(",");
  let balMap: Record<string, any> = {};
  const hitB = cache.get(bkey);
  if (hitB && Date.now() - hitB.t < 20000) balMap = hitB.v; else { balMap = await balances(studsVis.map((x) => ({ id: x.id, halqaId: x.halqaId })), settings, today0); cache.set(bkey, { t: Date.now(), v: balMap }); if (cache.size > 200) cache.clear(); }
  const brs = [...new Set(halaqat.map((h) => h.branch || ""))];
  const sp = me.role === "admin" ? scopeSpec(me) : null;
  let rewards = await prisma.reward.findMany({ where: { side: view, ...(me.role === "admin" ? (sp && sp.b.length ? { branch: { in: [...sp.b, ""] } } : {}) : { branch: { in: [...brs, ""] }, ...(me.role === "student" ? { active: true } : {}) }) }, orderBy: { at: "desc" }, take: 200 });
  for (const r of rewards) if (r.kind === "auction" && !r.closed && r.endsAt && +r.endsAt < Date.now()) { await closeAuction(r).catch(() => null); }
  if (rewards.some((r) => r.kind === "auction" && !r.closed && r.endsAt && +r.endsAt < Date.now())) rewards = await prisma.reward.findMany({ where: { id: { in: rewards.map((r) => r.id) } }, orderBy: { at: "desc" } });
  const aucIds = rewards.filter((r) => r.kind === "auction").map((r) => r.id);
  const bids = aucIds.length ? await prisma.bid.findMany({ where: { rewardId: { in: aucIds } }, orderBy: { amount: "desc" } }) : [];
  const gcache = ((globalThis as any).__grpCache ??= new Map<string, { t: number; v: number }>());
  const prog = async (r: any, hid: string) => { const k = r.id + "_" + hid; const h = gcache.get(k); if (h && Date.now() - h.t < 60000) return h.v; const v = await groupProgress([hid], new Date(+r.at + 3 * 3600000).toISOString().slice(0, 10), today0, settings); gcache.set(k, { t: Date.now(), v }); return v; };
  const rewardsOut: Record<string, any> = {};
  for (const r of rewards) {
    const o: any = { name: r.name, note: r.note, kind: r.kind, price: r.price, eff: r.salePrice != null && r.saleUntil && r.saleUntil >= today0 ? r.salePrice : r.price, stock: r.stock, branch: r.branch, salePrice: r.salePrice, saleUntil: r.saleUntil, endsAt: r.endsAt ? +r.endsAt : null, target: r.target, halqaId: r.halqaId || "", closed: r.closed, active: r.active, winnerId: r.winnerId || "", at: +r.at };
    if (staff) o.cost = r.cost;
    if (r.kind === "auction") { const bs = bids.filter((x) => x.rewardId === r.id); o.top = bs[0]?.amount || 0; o.n = bs.length; o.mine = bs.find((x) => x.userId === me.id)?.amount || 0; o.lead = bs[0]?.userId === me.id; if (staff) o.bids = bs.slice(0, 5).map((x) => ({ uid: x.userId, amount: x.amount })); }
    if (r.kind === "group") { const hs = r.halqaId ? halaqat.filter((h) => h.id === r.halqaId) : halaqat.filter((h) => !r.branch || h.branch === r.branch); o.progress = {}; for (const h of hs.slice(0, 30)) o.progress[h.id] = await prog(r, h.id); }
    rewardsOut[r.id] = o;
  }
  const visIds = studsVis.map((x) => x.id);
  const [orders, ptx] = await Promise.all([
    prisma.rewardOrder.findMany({ where: { userId: { in: me.role === "student" ? [me.id] : visIds } }, orderBy: { at: "desc" }, take: 300 }),
    prisma.pointTx.findMany({ where: { userId: { in: me.role === "student" ? [me.id] : visIds } }, orderBy: { at: "desc" }, take: me.role === "student" ? 100 : 400 }),
  ]);
  const full = me.role === "admin" && !me.perms;
  const backups = full ? await prisma.backup.findMany({ orderBy: { at: "desc" }, select: { id: true, at: true, size: true } }) : [];
  const { exportKey, ...pubSettings } = settings as any;
  const out = {
    me: me.id,
    appV: APP_V,
    today: localDate(),
    users: map(users, userOut),
    halaqat: map(halaqat, (h) => ({ name: h.name, teacherId: h.teacherId || "", days: h.days, time: h.time, link: h.link || "", auto: !!h.auto, sub: !!h.sub, branch: h.branch || "", mode: h.mode || "onsite", place: h.place || "", gender: h.gender === "f" ? "f" : "m" })),
    sessions: map(lessons, lessonOut),
    recs: map(recs, recOut),
    joins: Object.fromEntries(joins.map((j) => [j.lessonId + "_" + j.userId, { sid: j.lessonId, uid: j.userId, at: +j.at, left: j.leftAt ? +j.leftAt : null }])),
    settings: { main: full ? settings : pubSettings },
    msgs: map(msgs, (m) => ({ by: m.byId, byName: m.byName, text: m.text, at: +m.at })),
    side: view, isSuper: isSuper(me as any), dayEnd, pray, meets,
    backups: backups.map((b) => ({ id: b.id, at: +b.at, size: b.size })),
    push: !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
    waOn: staff ? (await waCfg()).enabled : false,
    videoOn: videoOn(await videoCfg()),
    aiOn: aiOn(await aiCfg()) && (staff || ((await prisma.setting.findUnique({ where: { key: "ai" } }))?.value as any)?.students !== false),
    videoAlt: ((await prisma.setting.findUnique({ where: { key: "videoAlt" } }))?.value as any) || {},
    waFailed: full ? await prisma.outMsg.count({ where: { status: "failed" } }) : 0,
    anns: map(anns, (a) => ({ halqaId: a.halqaId || "", title: a.title, body: a.body, byName: a.byName, at: +a.at, reads: reads.filter((r) => r.annId === a.id).map((r) => ({ uid: r.userId, at: +r.at })) })),
    wirds: Object.fromEntries(wirds.map((w) => [w.userId + "_" + w.date, { uid: w.userId, date: w.date, items: w.items, read: w.read, note: w.note }])),
    board,
    tins,
    bal: Object.fromEntries(Object.entries(balMap).map(([k, v]: any) => [k, v.bal])),
    rewards: rewardsOut,
    orders: map(orders, (o) => ({ rid: o.rewardId, uid: o.userId, price: o.price, code: me.role === "student" || staff ? o.code : "", status: o.status, byName: o.byName, at: +o.at, doneAt: o.doneAt ? +o.doneAt : null })),
    ptx: map(ptx, (t) => ({ uid: t.userId, amount: t.amount, kind: t.kind, reason: t.reason, byName: t.byName, at: +t.at })),
    dms: map(dms, (m) => ({ sid: m.studentId, by: m.byId, byName: m.byName, staff: m.fromStaff, kind: m.kind, date: m.date, text: m.text, at: +m.at, read: m.readAt ? +m.readAt : null })),
    behav: map(behav, (x) => ({ uid: x.userId, by: x.byId, byName: x.byName, kind: x.kind, text: x.text, visible: x.visible, at: +x.at })),
    polls: map(polls, (p) => {
      const vs = votes.filter((v) => v.pollId === p.id); const counts = (p.options as string[]).map((_, i) => vs.filter((v) => (v.choice as number[]).includes(i)).length);
      const mine = vs.find((v) => v.userId === me.id);
      return { halqaId: p.halqaId || "", question: p.question, options: p.options, multi: p.multi, closed: p.closed, byId: p.byId, byName: p.byName, at: +p.at, total: vs.length, counts: me.role === "student" && !mine && !p.closed ? null : counts, mine: mine ? mine.choice : null, ...(me.role !== "student" ? { voters: vs.map((v) => ({ uid: v.userId, choice: v.choice })) } : {}) };
    }),
  };
  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}
