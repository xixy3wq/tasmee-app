import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { currentUser, handle, fail, cleanUsername, USERNAME_RE, str, int, type Me } from "@/lib/auth";
import { getSettings, gradeOf, GRADES, localDate, type Field } from "@/lib/settings";
import { AYAS, ORD, TOTAL, gOf, validRange } from "@/lib/quran";
export const dynamic = "force-dynamic";

const isAdmin = (u: Me) => u.role === "admin";
const ATT = ["p", "l", "a", "e"];
const AMT = (v: unknown, max = 40) => { const n = Number(v); return Number.isFinite(n) && n >= 0 && n <= max ? n : 0; };
const defPlan = () => ({ mode: "manual", manual: {}, auto: { dir: "bwd", newPos: 0, revPos: 0, newAmt: 0.25, revAmt: 2, tathAmt: 0 } });
const planOf = (u: any) => { const p: any = u.plan || {}; const d = defPlan(); return { ...d, ...p, manual: p.manual || {}, auto: { ...d.auto, ...(p.auto || {}) } }; };

const needAdmin = (u: Me) => { if (!isAdmin(u)) fail("هذا الإجراء للمدير فقط", 403); };
async function halqaFor(u: Me, halqaId: string) {
  const h = await prisma.halqa.findUnique({ where: { id: halqaId } });
  if (!h) fail("الحلقة غير موجودة", 404);
  if (!isAdmin(u) && h!.teacherId !== u.id) fail("هذه الحلقة ليست من حلقاتك", 403);
  return h!;
}
async function lessonFor(u: Me, id: string) {
  const l = await prisma.lesson.findUnique({ where: { id } });
  if (!l) fail("الحصة غير موجودة", 404);
  await halqaFor(u, l!.halqaId);
  return l!;
}
async function studentFor(u: Me, id: string) {
  const s = await prisma.user.findUnique({ where: { id } });
  if (!s || s.role !== "student") fail("الطالب غير موجود", 404);
  if (!isAdmin(u)) {
    if (!s!.halqaId) fail("الطالب ليس في حلقتك", 403);
    await halqaFor(u, s!.halqaId!);
  }
  return s!;
}
async function uniqueUsername(username: string, exceptId?: string) {
  if (!USERNAME_RE.test(username)) fail("اسم المستخدم: حروف إنجليزية أو أرقام، 3 أحرف على الأقل");
  const ex = await prisma.user.findUnique({ where: { username } });
  if (ex && ex.id !== exceptId) fail("اسم المستخدم مستخدم");
}
function cleanInfo(fields: Field[], src: any) {
  const info: Record<string, string> = {};
  for (const f of fields) { const v = str(src?.[f.k], 200); if (v) info[f.k] = v; }
  return info;
}
const validDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
const validLink = (s: string) => !s || /^https?:\/\//i.test(s);

type H = (u: Me, b: any) => Promise<unknown>;
const A: Record<string, H> = {
  // ---------- الإعدادات ----------
  async "settings.save"(u, b) {
    needAdmin(u);
    const d = b.data || {};
    const days = (Array.isArray(d.days) ? d.days : []).map(Number).filter((x: number) => x >= 0 && x <= 6);
    if (!days.length) fail("اختر يوم دوام واحد على الأقل");
    const g = { ex: int(d.grade?.ex), vg: int(d.grade?.vg), gd: int(d.grade?.gd), alertsPer: Math.max(1, int(d.grade?.alertsPer, 3)) };
    if (!(g.ex >= 0 && g.ex <= g.vg && g.vg <= g.gd)) fail("حدود التقدير لازم تكون متصاعدة");
    const fields: Field[] = (Array.isArray(d.fields) ? d.fields : []).slice(0, 30).map((f: any) => ({
      k: str(f.k, 40).replace(/[^A-Za-z0-9_]/g, "") || "c_" + Math.random().toString(36).slice(2, 8),
      label: str(f.label, 60) || "حقل", on: !!f.on, req: !!f.req && !!f.on,
      type: ["tel", "number", "text"].includes(f.type) ? f.type : "text", ph: str(f.ph, 80), custom: !!f.custom,
    }));
    const cur = await getSettings();
    const value = { center: str(d.center, 80) || "حلقات ارتق", days, grade: g, absentAlert: Math.min(20, Math.max(2, int(d.absentAlert, 3))), holidays: cur.holidays || [], fields, tpl: { absent: str(d.tpl?.absent, 600), excellent: str(d.tpl?.excellent, 600) } };
    await prisma.setting.upsert({ where: { key: "main" }, create: { key: "main", value }, update: { value } });
  },

  async "holidays.save"(u, b) {
    needAdmin(u);
    const list = (Array.isArray(b.list) ? b.list : []).slice(0, 60).map((h: any) => ({ from: str(h.from, 10), to: str(h.to, 10) || str(h.from, 10), name: str(h.name, 60) || "إجازة" }))
      .filter((h: any) => validDate(h.from) && validDate(h.to) && h.to >= h.from);
    const cur = await getSettings();
    const value = { ...cur, holidays: list };
    await prisma.setting.upsert({ where: { key: "main" }, create: { key: "main", value }, update: { value } });
    // الحصص التلقائية القادمة داخل الإجازة تُلغى
    const today = localDate();
    for (const h of list) {
      if (h.to < today) continue;
      await prisma.lesson.updateMany({ where: { autoKey: { not: null }, date: { gte: h.from > today ? h.from : today, lte: h.to } }, data: { cancelled: true, note: h.name } });
    }
  },

  // ---------- المستخدمون ----------
  async "user.approve"(u, b) {
    needAdmin(u);
    const s = await prisma.user.findUnique({ where: { id: str(b.id) } });
    if (!s || s.status !== "pending") fail("الطلب غير موجود");
    if (!(await prisma.halqa.findUnique({ where: { id: str(b.halqaId) } }))) fail("اختر الحلقة");
    await prisma.user.update({ where: { id: s!.id }, data: { status: "active", halqaId: str(b.halqaId), approvedAt: new Date(), plan: s!.plan ?? defPlan() } });
  },
  async "user.delete"(u, b) {
    needAdmin(u);
    const id = str(b.id);
    if (id === u.id) fail("ما تقدر تحذف حسابك");
    const t = await prisma.user.findUnique({ where: { id } });
    if (!t) return;
    if (t.role === "admin") fail("ما يمكن حذف حساب مدير من هنا");
    await prisma.$transaction([
      prisma.rec.deleteMany({ where: { userId: id } }),
      prisma.join.deleteMany({ where: { userId: id } }),
      prisma.halqa.updateMany({ where: { teacherId: id }, data: { teacherId: null } }),
      prisma.user.delete({ where: { id } }),
    ]);
  },
  async "user.flag"(u, b) {
    needAdmin(u);
    const k = str(b.k);
    const t = await prisma.user.findUnique({ where: { id: str(b.id) } });
    if (!t) fail("الحساب غير موجود", 404);
    if (k === "autoAllowed" && t!.role === "student") await prisma.user.update({ where: { id: t!.id }, data: { autoAllowed: !!b.v } });
    else if ((k === "canPlan" || k === "canAuto") && t!.role === "teacher") await prisma.user.update({ where: { id: t!.id }, data: { [k]: !!b.v } });
    else fail("طلب غير صحيح");
  },
  async "student.save"(u, b) {
    needAdmin(u);
    const d = b.data || {}; const id = str(b.id) || undefined;
    const username = cleanUsername(d.username); await uniqueUsername(username, id);
    const name = str(d.name, 120); if (!name) fail("اكتب الاسم");
    const halqaId = str(d.halqaId); if (!(await prisma.halqa.findUnique({ where: { id: halqaId } }))) fail("اختر الحلقة");
    const s = await getSettings();
    const data: any = { name, username, halqaId, status: d.status === "disabled" ? "disabled" : "active", info: cleanInfo(s.fields, d.info) };
    const pw = String(d.password ?? "");
    if (pw) { if (pw.length < 4) fail("كلمة المرور 4 أحرف على الأقل"); data.passwordHash = await bcrypt.hash(pw, 10); }
    if (id) {
      const ex = await prisma.user.findUnique({ where: { id } });
      if (!ex || ex.role !== "student") fail("الطالب غير موجود", 404);
      await prisma.user.update({ where: { id }, data });
    } else {
      if (!pw) fail("اكتب كلمة المرور");
      await prisma.user.create({ data: { ...data, role: "student", plan: defPlan(), approvedAt: new Date() } });
    }
  },
  async "teacher.save"(u, b) {
    needAdmin(u);
    const d = b.data || {}; const id = str(b.id) || undefined;
    const username = cleanUsername(d.username); await uniqueUsername(username, id);
    const name = str(d.name, 120); if (!name) fail("اكتب الاسم");
    const data: any = { name, username, canPlan: !!d.canPlan, canAuto: !!d.canAuto, info: { phone: str(d.phone, 30) } };
    if (id) data.status = d.status === "disabled" ? "disabled" : "active";
    const pw = String(d.password ?? "");
    if (pw) { if (pw.length < 4) fail("كلمة المرور 4 أحرف على الأقل"); data.passwordHash = await bcrypt.hash(pw, 10); }
    if (id) {
      const ex = await prisma.user.findUnique({ where: { id } });
      if (!ex || ex.role !== "teacher") fail("المعلم غير موجود", 404);
      await prisma.user.update({ where: { id }, data });
    } else {
      if (!pw) fail("اكتب كلمة المرور");
      await prisma.user.create({ data: { ...data, role: "teacher", status: "active" } });
    }
  },
  async "me.password"(u, b) {
    if (!(await bcrypt.compare(String(b.old ?? ""), u.passwordHash))) fail("كلمة المرور الحالية غير صحيحة");
    const pw = String(b.pw ?? ""); if (pw.length < 4) fail("كلمة المرور 4 أحرف على الأقل");
    await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash(pw, 10) } });
  },

  // ---------- الحلقات ----------
  async "halqa.save"(u, b) {
    needAdmin(u);
    const d = b.data || {}; const id = str(b.id);
    const name = str(d.name, 80); if (!name) fail("اكتب اسم الحلقة");
    const days = (Array.isArray(d.days) ? d.days : []).map(Number).filter((x: number) => x >= 0 && x <= 6);
    if (!days.length) fail("اختر يوم دوام واحد على الأقل");
    let teacherId: string | null = str(d.teacherId) || null;
    if (teacherId) { const t = await prisma.user.findUnique({ where: { id: teacherId } }); if (!t || t.role !== "teacher") teacherId = null; }
    const link = str(d.link, 600); if (!validLink(link)) fail("الرابط لازم يبدأ بـ https://");
    const data = { name, days, teacherId, link, auto: !!d.auto, time: /^\d{2}:\d{2}$/.test(str(d.time)) ? str(d.time) : "" };
    if (id) await prisma.halqa.update({ where: { id }, data });
    else await prisma.halqa.create({ data });
  },
  async "halqa.delete"(u, b) {
    needAdmin(u);
    const id = str(b.id);
    const n = await prisma.user.count({ where: { halqaId: id, role: "student", status: { not: "pending" } } });
    if (n) fail(`انقل طلاب الحلقة (${n}) لحلقة ثانية قبل حذفها`);
    await prisma.halqa.delete({ where: { id } });
  },

  // ---------- الحصص ----------
  async "lesson.save"(u, b) {
    const d = b.data || {}; const id = str(b.id);
    const date = str(d.date), time = str(d.time), link = str(d.link, 600), note = str(d.note, 200);
    if (!validDate(date)) fail("اختر التاريخ");
    if (!validLink(link)) fail("الرابط لازم يبدأ بـ https://");
    if (id) {
      await lessonFor(u, id);
      await prisma.lesson.update({ where: { id }, data: { date, time, link, note } });
      return { id };
    }
    await halqaFor(u, str(d.halqaId));
    const l = await prisma.lesson.create({ data: { halqaId: str(d.halqaId), date, time, link, note, createdBy: u.id } });
    return { id: l.id };
  },
  async "lesson.cancel"(u, b) {
    const l = await lessonFor(u, str(b.id));
    await prisma.lesson.update({ where: { id: l.id }, data: { cancelled: !!b.v, ...(b.v && b.note ? { note: str(b.note, 200) } : {}) } });
  },
  async "lesson.delete"(u, b) {
    const l = await lessonFor(u, str(b.id));
    if (l.autoKey) { await prisma.lesson.update({ where: { id: l.id }, data: { cancelled: true } }); return; }
    await prisma.$transaction([prisma.join.deleteMany({ where: { lessonId: l.id } }), prisma.lesson.delete({ where: { id: l.id } })]);
  },
  async "lesson.att"(u, b) {
    const l = await lessonFor(u, str(b.id));
    const studs = new Set((await prisma.user.findMany({ where: { halqaId: l.halqaId, role: "student" }, select: { id: true } })).map((s) => s.id));
    const att: Record<string, string> = { ...((l.att as any) || {}) };
    const changes = b.map && typeof b.map === "object" ? b.map : { [str(b.uid)]: b.v };
    for (const [k, v] of Object.entries(changes)) {
      if (!studs.has(k)) continue;
      if (v && ATT.includes(String(v))) att[k] = String(v); else delete att[k];
    }
    await prisma.lesson.update({ where: { id: l.id }, data: { att } });
  },
  async "lesson.queue"(u, b) {
    const l = await lessonFor(u, str(b.id));
    const studs = new Set((await prisma.user.findMany({ where: { halqaId: l.halqaId, role: "student", status: "active" }, select: { id: true } })).map((s) => s.id));
    const queue = [...new Set<string>((Array.isArray(b.queue) ? b.queue : []).map(String))].filter((x) => studs.has(x));
    const data: any = { queue };
    if ("current" in b) data.currentId = b.current && studs.has(String(b.current)) ? String(b.current) : null;
    await prisma.lesson.update({ where: { id: l.id }, data });
  },
  async "join"(u, b) {
    if (u.role !== "student") return;
    const l = await prisma.lesson.findUnique({ where: { id: str(b.lessonId) } });
    if (!l || l.halqaId !== u.halqaId) fail("الحصة غير موجودة", 404);
    await prisma.join.upsert({ where: { lessonId_userId: { lessonId: l!.id, userId: u.id } }, create: { lessonId: l!.id, userId: u.id }, update: { leftAt: null } });
  },
  async "leave"(u, b) {
    if (u.role !== "student") return;
    await prisma.join.updateMany({ where: { lessonId: str(b.lessonId), userId: u.id }, data: { leftAt: new Date() } });
  },
  async "queue.ready"(u, b) {
    if (u.role !== "student") fail("غير مصرح", 403);
    const l = await prisma.lesson.findUnique({ where: { id: str(b.lessonId) } });
    if (!l || l.halqaId !== u.halqaId || l.cancelled) fail("الحصة غير متاحة", 404);
    if (l!.date !== localDate()) fail("الطابور متاح يوم الحصة فقط");
    const q = ((l!.queue as string[]) || []).filter((x) => x !== u.id);
    if (b.v !== false && l!.currentId !== u.id) q.push(u.id);
    await prisma.lesson.update({ where: { id: l!.id }, data: { queue: q } });
  },
  async "issue"(u, b) {
    if (u.role !== "student") fail("غير مصرح", 403);
    const l = await prisma.lesson.findUnique({ where: { id: str(b.lessonId) } });
    if (!l || l.halqaId !== u.halqaId) fail("الحصة غير موجودة", 404);
    const iss: any = { ...((l!.issues as any) || {}) };
    if (b.clear) delete iss[u.id]; else iss[u.id] = { at: Date.now(), msg: str(b.msg, 200) || "ما أقدر أدخل الحصة" };
    await prisma.lesson.update({ where: { id: l!.id }, data: { issues: iss } });
  },
  async "issue.clear"(u, b) {
    const l = await lessonFor(u, str(b.id));
    const iss: any = { ...((l.issues as any) || {}) }; delete iss[str(b.uid)];
    await prisma.lesson.update({ where: { id: l.id }, data: { issues: iss } });
  },

  // ---------- التسميع ----------
  async "rec.add"(u, b) {
    return A["rec.addMany"](u, { ...b, items: [b] });
  },
  async "rec.addMany"(u, b) {
    if (u.role === "student") fail("غير مصرح", 403);
    const st = await studentFor(u, str(b.uid));
    let lesson: any = null;
    if (b.lessonId) { lesson = await lessonFor(u, str(b.lessonId)); if (lesson.halqaId !== st.halqaId) fail("الطالب ليس في حلقة هذه الحصة"); }
    const items = (Array.isArray(b.items) ? b.items : []).slice(0, 10);
    if (!items.length) fail("أضف مقطع واحد على الأقل");
    const settings = await getSettings();
    const date = lesson ? lesson.date : validDate(str(b.date)) ? str(b.date) : localDate();
    const secs = Math.max(0, Math.min(6 * 3600, int(b.secs))) || null;
    const rows: any[] = [];
    for (const it of items) {
      const type = ["new", "review", "tath"].includes(it.type) ? it.type : "new";
      const surah = int(it.surah); const full = !!it.full;
      const from = full ? 1 : int(it.from), to = full ? AYAS[surah - 1] : int(it.to);
      if (!validRange(surah, from, to)) fail(`تأكد من أرقام الآيات (السورة ${surah || "?"} عدد آياتها ${AYAS[surah - 1] ?? "?"})`);
      const quick = GRADES.includes(it.quickGrade);
      const mistakes = quick ? 0 : Math.max(0, int(it.mistakes)), alerts = quick ? 0 : Math.max(0, int(it.alerts));
      const g = quick ? { t: it.quickGrade, pass: it.quickGrade !== "يعاد" } : gradeOf(settings, mistakes, alerts);
      rows.push({ userId: st.id, lessonId: lesson?.id ?? null, halqaId: st.halqaId, date, type, surah, fromA: from, toA: to, mistakes, alerts, grade: g.t, pass: g.pass, full, quick, note: str(b.note ?? it.note, 300), secs: rows.length ? null : secs, byId: u.id });
    }
    await prisma.rec.createMany({ data: rows });
    // تقدّم الخطة التلقائية بعد النجاح فقط
    const p = planOf(st); let moved = false;
    if (p.mode === "auto" && st.autoAllowed) {
      const dir = p.auto.dir === "fwd" ? "fwd" : "bwd";
      for (const r of rows) {
        if (!r.pass || (r.type !== "new" && r.type !== "review")) continue;
        const pos = ORD[dir].pos[gOf(r.surah, r.toA)];
        if (r.type === "new" && pos + 1 > p.auto.newPos) { p.auto.newPos = pos + 1; moved = true; }
        if (r.type === "review") { let np = pos + 1; if (np >= p.auto.newPos) np = 0; p.auto.revPos = np; moved = true; }
      }
      if (moved) await prisma.user.update({ where: { id: st.id }, data: { plan: p } });
    }
    return { grade: rows.map((r) => r.grade).join("، ") };
  },
  async "rec.update"(u, b) {
    if (u.role === "student") fail("غير مصرح", 403);
    const r = await prisma.rec.findUnique({ where: { id: str(b.id) } });
    if (!r) fail("التسميع غير موجود", 404);
    await studentFor(u, r!.userId);
    const d = b.data || {};
    const type = ["new", "review", "tath"].includes(d.type) ? d.type : r!.type;
    const surah = int(d.surah) || r!.surah, from = int(d.from) || r!.fromA, to = int(d.to) || r!.toA;
    if (!validRange(surah, from, to)) fail("تأكد من أرقام الآيات");
    const quick = GRADES.includes(d.quickGrade);
    const mistakes = quick ? 0 : Math.max(0, int(d.mistakes)), alerts = quick ? 0 : Math.max(0, int(d.alerts));
    const g = quick ? { t: d.quickGrade, pass: d.quickGrade !== "يعاد" } : gradeOf(await getSettings(), mistakes, alerts);
    await prisma.rec.update({ where: { id: r!.id }, data: { type, surah, fromA: from, toA: to, mistakes, alerts, quick, grade: g.t, pass: g.pass, full: from === 1 && to === AYAS[surah - 1], note: str(d.note, 300), ...(validDate(str(d.date)) ? { date: str(d.date) } : {}) } });
  },
  async "rec.delete"(u, b) {
    if (u.role === "student") fail("غير مصرح", 403);
    const r = await prisma.rec.findUnique({ where: { id: str(b.id) } });
    if (!r) return;
    await studentFor(u, r.userId);
    await prisma.rec.delete({ where: { id: r.id } });
  },

  // ---------- الخطة ----------
  async "plan.save"(u, b) {
    const st = await studentFor(u, str(b.id));
    if (!(isAdmin(u) || (u.role === "teacher" && u.canPlan))) fail("ما عندك صلاحية إعداد الخطط", 403);
    const canAuto = (isAdmin(u) || u.canAuto) && st.autoAllowed;
    const mode = b.mode === "auto" && canAuto ? "auto" : "manual";
    const old = planOf(st);
    const manual: any = {};
    for (const k of ["new", "review", "tath"]) {
      const m = b.manual?.[k]; if (!m || !int(m.surah)) continue;
      const s = int(m.surah); const n = AYAS[s - 1]; const fr = int(m.from) || 1, to = int(m.to) || n;
      if (!validRange(s, fr, to)) fail("آيات المقطع غير صحيحة");
      manual[k] = { surah: s, from: fr, to };
    }
    let auto = old.auto;
    if (mode === "auto") {
      const a = b.auto || {}; const dir = a.dir === "fwd" ? "fwd" : "bwd";
      const ss = int(a.startS), sa = int(a.startA) || 1;
      if (!(ss >= 1 && ss <= 114 && sa >= 1 && sa <= AYAS[ss - 1])) fail("تأكد من موضع بداية الحفظ");
      const np = Math.min(TOTAL, ORD[dir].pos[gOf(ss, sa)]);
      auto = { dir, newPos: np, revPos: dir === old.auto.dir && np === old.auto.newPos ? old.auto.revPos : 0, newAmt: AMT(a.newAmt, 5), revAmt: AMT(a.revAmt), tathAmt: AMT(a.tathAmt, 10) };
    }
    await prisma.user.update({ where: { id: st.id }, data: { plan: { mode, manual, auto } } });
  },
};

export async function POST(req: Request) {
  return handle(async () => {
    const u = await currentUser();
    if (!u) fail("انتهت الجلسة، سجّل دخولك مرة ثانية", 401);
    const b = await req.json().catch(() => ({}));
    const h = A[String(b.t)];
    if (!h) fail("إجراء غير معروف");
    return (await h(u!, b)) ?? { ok: true };
  });
}
