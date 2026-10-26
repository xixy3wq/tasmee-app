import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { currentUser, handle, fail, cleanUsername, USERNAME_RE, str, int, type Me } from "@/lib/auth";
import { getSettings, gradeOf, GRADES, localDate, cleanFieldValue, type Field } from "@/lib/settings";
import { AYAS, ORD, TOTAL, gOf, validRange } from "@/lib/quran";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/push";
import { videoCfg, videoOn, videoPublic, roomUrl, roomUrlAny } from "@/lib/video";
import { waCfg, WA_DEF, waSend, queueMsg, cancelMsg, processQueue, fillVars, intlPhone, queueWeekly } from "@/lib/wa";
import { SN } from "@/lib/quran";
import { scopeHalqaIds } from "@/lib/scope";
const DAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const fmtD = (d: string) => { const x = new Date(d + "T00:00:00Z"); return `${DAYS_AR[x.getUTCDay()]} ${x.getUTCDate()}/${x.getUTCMonth() + 1}`; };
const TYPE_AR: Record<string, string> = { new: "حفظ", review: "مراجعة", tath: "تثبيت" };
import crypto from "node:crypto";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const isAdmin = (u: Me) => u.role === "admin";
const ATT = ["p", "l", "a", "e"];
const AMT = (v: unknown, max = 40) => { const n = Number(v); return Number.isFinite(n) && n >= 0 && n <= max ? n : 0; };
const defPlan = () => ({ mode: "manual", manual: {}, auto: { dir: "bwd", memStart: 0, newPos: 0, revPos: 0, newAmt: 0.25, revAmt: 2, tathAmt: 0 } });
const planOf = (u: any) => { const p: any = u.plan || {}; const d = defPlan(); return { ...d, ...p, manual: p.manual || {}, auto: { ...d.auto, ...(p.auto || {}) } }; };

const PERMS = ["req", "students", "teachers", "halaqat", "anns", "reports", "settings", "logs"];
const isFull = (u: Me) => isAdmin(u) && !u.perms;
const needAdmin = (u: Me, perm?: string) => {
  if (!isAdmin(u)) fail("هذا الإجراء للمدير فقط", 403);
  if (perm && u.perms && !(u.perms as string[]).includes(perm)) fail("ما عندك صلاحية لهذا القسم", 403);
};
async function inScope(u: Me, halqaId: string | null | undefined) {
  if (!isAdmin(u)) return true;
  const sc = await scopeHalqaIds(u); if (!sc) return true;
  return !!halqaId && sc.includes(halqaId);
}
async function needScope(u: Me, halqaId: string | null | undefined) { if (!(await inScope(u, halqaId))) fail("هذه الحلقة خارج نطاقك", 403); }
async function halqaFor(u: Me, halqaId: string) {
  const h = await prisma.halqa.findUnique({ where: { id: halqaId } });
  if (!h) fail("الحلقة غير موجودة", 404);
  if (!isAdmin(u) && h!.teacherId !== u.id) fail("هذه الحلقة ليست من حلقاتك", 403);
  await needScope(u, h!.id);
  return h!;
}
async function lessonFor(u: Me, id: string) {
  const l = await prisma.lesson.findUnique({ where: { id } });
  if (!l) fail("الحصة غير موجودة", 404);
  if (l!.subId && l!.subId === u.id) return l!; // المعلم الاحتياط
  await halqaFor(u, l!.halqaId);
  return l!;
}
async function studentFor(u: Me, id: string, lesson?: any) {
  const s = await prisma.user.findUnique({ where: { id } });
  if (!s || s.role !== "student") fail("الطالب غير موجود", 404);
  if (lesson && lesson.subId === u.id && s!.halqaId === lesson.halqaId) return s!;
  if (!isAdmin(u)) {
    if (!s!.halqaId) fail("الطالب ليس في حلقتك", 403);
    await halqaFor(u, s!.halqaId!);
  } else await needScope(u, s!.halqaId || s!.reqHalqaId);
  return s!;
}
async function uniqueUsername(username: string, exceptId?: string) {
  if (!USERNAME_RE.test(username)) fail("اسم المستخدم: حروف إنجليزية أو أرقام، 3 أحرف على الأقل");
  const ex = await prisma.user.findUnique({ where: { username } });
  if (ex && ex.id !== exceptId) fail("اسم المستخدم مستخدم");
}
function cleanInfo(fields: Field[], src: any) {
  const info: Record<string, string> = {};
  for (const f of fields) { const v = cleanFieldValue(f, src?.[f.k]); if (v) info[f.k] = v; }
  return info;
}
const validDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
const validLink = (s: string) => !s || /^https?:\/\//i.test(s);

type H = (u: Me, b: any) => Promise<unknown>;
const A: Record<string, H> = {
  // ---------- الإعدادات ----------
  async "settings.save"(u, b) {
    needAdmin(u, "settings");
    const d = b.data || {};
    const days = (Array.isArray(d.days) ? d.days : []).map(Number).filter((x: number) => x >= 0 && x <= 6);
    if (!days.length) fail("اختر يوم دوام واحد على الأقل");
    const g = { ex: int(d.grade?.ex), vg: int(d.grade?.vg), gd: int(d.grade?.gd), alertsPer: Math.max(1, int(d.grade?.alertsPer, 3)) };
    if (!(g.ex >= 0 && g.ex <= g.vg && g.vg <= g.gd)) fail("حدود التقدير لازم تكون متصاعدة");
    const fields: Field[] = (Array.isArray(d.fields) ? d.fields : []).slice(0, 30).map((f: any) => ({
      k: str(f.k, 40).replace(/[^A-Za-z0-9_]/g, "") || "c_" + Math.random().toString(36).slice(2, 8),
      label: str(f.label, 60) || "حقل", on: !!f.on, req: !!f.req && !!f.on,
      type: ["tel", "number", "text", "choice", "memo"].includes(f.type) ? f.type : "text", ph: str(f.ph, 80), custom: !!f.custom,
      ...(f.type === "choice" ? { options: (Array.isArray(f.options) ? f.options : []).map((o: any) => str(o, 60)).filter(Boolean).slice(0, 30), multi: !!f.multi } : {}),
    }));
    const memoRemoved = !fields.some((f) => f.type === "memo");
    const cur = await getSettings();
    const tpls = Array.isArray(d.tpls) ? d.tpls.slice(0, 20).map((t: any, i: number) => ({ id: str(t.id, 20) || "x" + i, name: str(t.name, 40) || "رسالة", text: str(t.text, 800) })).filter((t: any) => t.text) : cur.tpls;
    const planTpls = Array.isArray(d.planTpls) ? d.planTpls.slice(0, 20).map((t: any, i: number) => ({ id: str(t.id, 20) || "p" + i, name: str(t.name, 60) || "قالب", newAmt: AMT(t.newAmt, 5), revAmt: AMT(t.revAmt), tathAmt: AMT(t.tathAmt, 10) })) : cur.planTpls;
    const pp = d.points || {}; const points = { present: AMT(pp.present ?? cur.points.present, 100), late: AMT(pp.late ?? cur.points.late, 100), ex: AMT(pp.ex ?? cur.points.ex, 100), vg: AMT(pp.vg ?? cur.points.vg, 100), gd: AMT(pp.gd ?? cur.points.gd, 100), page: AMT(pp.page ?? cur.points.page, 100) };
    const board = ["show", "top3", "hide"].includes(d.board) ? d.board : cur.board;
    const terms = Array.isArray(d.terms) ? d.terms.slice(0, 12).map((t: any, i: number) => ({ id: str(t.id, 20) || "tm" + i, name: str(t.name, 60) || "فصل", from: str(t.from, 10), to: str(t.to, 10) })).filter((t: any) => validDate(t.from) && validDate(t.to) && t.to >= t.from) : (cur as any).terms || [];
    const value = { ...cur, center: str(d.center, 80) || "حلقات ارتق", days, grade: g, absentAlert: Math.min(20, Math.max(2, int(d.absentAlert, 3))), holidays: cur.holidays || [], fields, memoRemoved, tpls, planTpls, points, board, terms, supportName: str(d.supportName, 60), supportPhone: str(d.supportPhone, 20), recMin: Math.min(60, Math.max(0, int(d.recMin ?? (cur as any).recMin ?? 0))), branches: Array.isArray(d.branches) ? ([...new Set<string>((d.branches as any[]).map((x: any) => str(x, 60).trim()).filter(Boolean))] as string[]).slice(0, 30) : ((cur as any).branches || []), tpl: { absent: str(d.tpl?.absent, 600), excellent: str(d.tpl?.excellent, 600) } };
    await prisma.setting.upsert({ where: { key: "main" }, create: { key: "main", value }, update: { value } });
    await audit(u, "settings", null, "تعديل الإعدادات");
  },
  async "exportKey.rotate"(u) {
    if (!isFull(u)) fail("للمدير الكامل فقط", 403);
    const cur = await getSettings(); const value = { ...cur, exportKey: crypto.randomBytes(12).toString("hex") };
    await prisma.setting.upsert({ where: { key: "main" }, create: { key: "main", value }, update: { value } });
    await audit(u, "settings", null, "توليد مفتاح تصدير جديد");
    return { key: value.exportKey };
  },

  async "holidays.save"(u, b) {
    needAdmin(u, "settings");
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
    needAdmin(u, "req");
    const s = await prisma.user.findUnique({ where: { id: str(b.id) } });
    if (!s || s.status !== "pending") fail("الطلب غير موجود");
    if (!(await prisma.halqa.findUnique({ where: { id: str(b.halqaId) } }))) fail("اختر الحلقة");
    await needScope(u, str(b.halqaId));
    // إذا حدد الطالب حفظه السابق عند التسجيل: تنضبط خطته التلقائية عليه
    let plan: any = s!.plan ?? defPlan();
    const memo = String(((s!.info as any) || {}).memo || "");
    const mm = /^(\d+):(\d+)>(\d+):(\d+)$/.exec(memo);
    if (mm && !s!.plan) {
      const [fs, fa, ts, ta] = mm.slice(1).map(Number);
      const tryDir = (dir: "fwd" | "bwd") => { const a = ORD[dir].pos[gOf(fs, fa)], z = ORD[dir].pos[gOf(ts, ta)]; return z >= a ? { dir, ms: a, np: Math.min(TOTAL, z + 1) } : null; };
      const r = (fs === 114 || fs > ts ? tryDir("bwd") : tryDir("fwd")) || tryDir("bwd") || tryDir("fwd");
      const st = await getSettings(); const t0 = (st.planTpls || [])[0];
      if (r) plan = { mode: "auto", manual: {}, auto: { dir: r.dir, memStart: r.ms, newPos: r.np, revPos: r.ms, newAmt: t0 ? t0.newAmt : 0.25, revAmt: t0 ? t0.revAmt : 2, tathAmt: t0 ? t0.tathAmt : 1 } };
    }
    await prisma.user.update({ where: { id: s!.id }, data: { status: "active", halqaId: str(b.halqaId), approvedAt: new Date(), plan } });
    await audit(u, "approve", s!.id, `اعتماد ${s!.name}`);
  },
  async "user.delete"(u, b) {
    needAdmin(u);
    const id = str(b.id);
    if (id === u.id) fail("ما تقدر تحذف حسابك");
    const t = await prisma.user.findUnique({ where: { id } });
    if (!t) return;
    if (t.role === "admin" && !isFull(u)) fail("حذف المدراء للمدير الكامل فقط", 403);
    if (t.role === "admin" && !t.perms) fail("ما يمكن حذف مدير كامل من هنا");
    needAdmin(u, t.role === "teacher" ? "teachers" : t.status === "pending" ? "req" : t.role === "student" ? "students" : undefined);
    if (t.role === "student") await needScope(u, t.halqaId || t.reqHalqaId);
    await audit(u, "user.delete", id, `حذف ${t.name}`);
    await prisma.$transaction([
      prisma.rec.deleteMany({ where: { userId: id } }),
      prisma.join.deleteMany({ where: { userId: id } }),
      prisma.wird.deleteMany({ where: { userId: id } }),
      prisma.annRead.deleteMany({ where: { userId: id } }),
      prisma.halqa.updateMany({ where: { teacherId: id }, data: { teacherId: null } }),
      prisma.user.delete({ where: { id } }),
    ]);
  },
  async "user.flag"(u, b) {
    const k = str(b.k);
    needAdmin(u, k === "autoAllowed" ? "students" : "teachers");
    const t = await prisma.user.findUnique({ where: { id: str(b.id) } });
    if (!t) fail("الحساب غير موجود", 404);
    if (k === "autoAllowed" && t!.role === "student") await prisma.user.update({ where: { id: t!.id }, data: { autoAllowed: !!b.v } });
    else if ((k === "canPlan" || k === "canAuto") && t!.role === "teacher") await prisma.user.update({ where: { id: t!.id }, data: { [k]: !!b.v } });
    else fail("طلب غير صحيح");
  },
  async "student.save"(u, b) {
    needAdmin(u, "students");
    const d = b.data || {}; const id = str(b.id) || undefined;
    const username = cleanUsername(d.username); await uniqueUsername(username, id);
    const name = str(d.name, 120); if (!name) fail("اكتب الاسم");
    const halqaId = str(d.halqaId); if (!(await prisma.halqa.findUnique({ where: { id: halqaId } }))) fail("اختر الحلقة");
    await needScope(u, halqaId);
    if (id) { const ex0 = await prisma.user.findUnique({ where: { id } }); if (ex0) await needScope(u, ex0.halqaId); }
    const s = await getSettings();
    const data: any = { name, username, halqaId, status: ["disabled", "archived"].includes(d.status) ? d.status : "active", info: cleanInfo(s.fields, d.info) };
    const pw = String(d.password ?? "");
    if (pw) { if (pw.length < 4) fail("كلمة المرور 4 أحرف على الأقل"); data.passwordHash = await bcrypt.hash(pw, 10); }
    if (id) {
      const ex = await prisma.user.findUnique({ where: { id } });
      if (!ex || ex.role !== "student") fail("الطالب غير موجود", 404);
      await prisma.user.update({ where: { id }, data });
      if (ex!.halqaId !== halqaId) {
        const [a, c] = await Promise.all([ex!.halqaId ? prisma.halqa.findUnique({ where: { id: ex!.halqaId } }) : null, prisma.halqa.findUnique({ where: { id: halqaId } })]);
        await audit(u, "student.move", id, `نقل ${name} من ${a?.name || "—"} إلى ${c?.name || "—"}`);
      }
      if (ex!.status !== data.status) await audit(u, "student.status", id, `${name}: ${({ active: "نشط", disabled: "موقوف", archived: "مؤرشف" } as any)[data.status]}`);
    } else {
      if (!pw) fail("اكتب كلمة المرور");
      await prisma.user.create({ data: { ...data, role: "student", plan: defPlan(), approvedAt: new Date() } });
    }
  },
  async "teacher.save"(u, b) {
    needAdmin(u, "teachers");
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
    await audit(u, "teacher.save", id || null, (id ? "تعديل المعلم " : "إضافة المعلم ") + name);
  },
  async "admin.save"(u, b) {
    if (!isFull(u)) fail("إضافة المدراء للمدير الكامل فقط", 403);
    const d = b.data || {}; const id = str(b.id) || undefined;
    const username = cleanUsername(d.username); await uniqueUsername(username, id);
    const name = str(d.name, 120); if (!name) fail("اكتب الاسم");
    const raw = (Array.isArray(d.perms) ? d.perms : []).map((x: any) => String(x).slice(0, 120));
    const perms = [...raw.filter((x: string) => PERMS.includes(x)), ...raw.filter((x: string) => /^(h|b):./.test(x))];
    if (!perms.some((x: string) => PERMS.includes(x))) fail("اختر صلاحية واحدة على الأقل");
    const data: any = { name, username, perms, status: d.status === "disabled" ? "disabled" : "active" };
    const pw = String(d.password ?? "");
    if (pw) { if (pw.length < 6) fail("كلمة مرور المدراء 6 أحرف على الأقل"); data.passwordHash = await bcrypt.hash(pw, 10); }
    if (id) {
      const ex = await prisma.user.findUnique({ where: { id } });
      if (!ex || ex.role !== "admin" || !ex.perms) fail("الحساب غير موجود", 404);
      await prisma.user.update({ where: { id }, data });
    } else {
      if (!pw) fail("اكتب كلمة المرور");
      await prisma.user.create({ data: { ...data, role: "admin" } });
    }
    await audit(u, "admin.save", id || null, (id ? "تعديل صلاحيات " : "إضافة مشرف إداري ") + name + ": " + perms.filter((x: string) => PERMS.includes(x)).join("، ") + (perms.some((x: string) => x.includes(":")) ? " (نطاق محدد)" : ""));
  },
  async "students.assign"(u, b) {
    needAdmin(u, "students");
    const map = b.map && typeof b.map === "object" ? b.map : {};
    const hs = new Set((await prisma.halqa.findMany({ select: { id: true } })).map((h) => h.id));
    let n = 0;
    for (const [uid, hid] of Object.entries(map)) {
      if (!hs.has(String(hid)) || !(await inScope(u, String(hid)))) continue;
      const st = await prisma.user.findUnique({ where: { id: uid } });
      if (st && !(await inScope(u, st.halqaId))) continue;
      if (!st || st.role !== "student" || st.halqaId === hid) continue;
      await prisma.user.update({ where: { id: uid }, data: { halqaId: String(hid) } }); n++;
    }
    await audit(u, "students.assign", null, `توزيع الطلاب: نقل ${n} طالب`);
    return { n };
  },
  async "me.password"(u, b) {
    if (!(await bcrypt.compare(String(b.old ?? ""), u.passwordHash))) fail("كلمة المرور الحالية غير صحيحة");
    const pw = String(b.pw ?? ""); if (pw.length < 4) fail("كلمة المرور 4 أحرف على الأقل");
    await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash(pw, 10) } });
  },

  // ---------- الحلقات ----------
  async "halqa.save"(u, b) {
    needAdmin(u, "halaqat");
    const d = b.data || {}; const id = str(b.id);
    const name = str(d.name, 80); if (!name) fail("اكتب اسم الحلقة");
    const days = (Array.isArray(d.days) ? d.days : []).map(Number).filter((x: number) => x >= 0 && x <= 6);
    if (!days.length) fail("اختر يوم دوام واحد على الأقل");
    let teacherId: string | null = str(d.teacherId) || null;
    if (teacherId) { const t = await prisma.user.findUnique({ where: { id: teacherId } }); if (!t || t.role !== "teacher") teacherId = null; }
    const link = str(d.link, 600); if (!validLink(link)) fail("الرابط لازم يبدأ بـ https://");
    const data = { name, days, teacherId, link, auto: !!d.auto, time: /^\d{2}:\d{2}$/.test(str(d.time)) ? str(d.time) : "", branch: str(d.branch, 60) };
    if (id) await needScope(u, id); else if (await scopeHalqaIds(u)) fail("إنشاء الحلقات للمدير بدون نطاق محدد", 403);
    if (id) {
      const old = await prisma.halqa.findUnique({ where: { id } });
      await prisma.halqa.update({ where: { id }, data });
      if (old && old.teacherId !== teacherId) await audit(u, "halqa.teacher", id, `${name}: تغيير المعلم`);
    } else await prisma.halqa.create({ data });
    await audit(u, "halqa.save", id || null, (id ? "تعديل حلقة " : "إنشاء حلقة ") + name);
  },
  // جدول المعلمين: تغيير معلم الحلقة بالسحب
  async "halqa.teacher"(u, b) {
    needAdmin(u, "halaqat");
    const id = str(b.id); await needScope(u, id);
    const h = await prisma.halqa.findUnique({ where: { id } }); if (!h) fail("الحلقة غير موجودة", 404);
    let teacherId: string | null = str(b.teacherId) || null;
    if (teacherId) { const t = await prisma.user.findUnique({ where: { id: teacherId } }); if (!t || t.role !== "teacher") fail("المعلم غير موجود"); }
    await prisma.halqa.update({ where: { id }, data: { teacherId } });
    await audit(u, "halqa.teacher", id, `${h!.name}: تغيير المعلم`);
  },
  async "halqa.delete"(u, b) {
    needAdmin(u, "halaqat");
    const id = str(b.id); await needScope(u, id);
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
    let subId: string | null | undefined = undefined;
    if ("subId" in d) {
      subId = str(d.subId) || null;
      if (subId) { const t = await prisma.user.findUnique({ where: { id: subId } }); if (!t || t.role !== "teacher") subId = null; }
    }
    if (id) {
      const l = await lessonFor(u, id);
      if (subId !== undefined && l.subId === u.id && !isAdmin(u)) subId = undefined;
      await prisma.lesson.update({ where: { id }, data: { date, time, link, note, ...(subId !== undefined ? { subId } : {}) } });
      if (subId !== undefined && subId !== l.subId) {
        await audit(u, "lesson.sub", id, subId ? `تكليف معلم احتياط لحصة ${date}` : `إلغاء المعلم الاحتياط لحصة ${date}`);
        if (subId) await notify([subId], { title: "تكليف بحصة احتياط", body: `عندك حصة احتياط يوم ${date} الساعة ${time}`, url: "/" });
      }
      return { id };
    }
    await halqaFor(u, str(d.halqaId));
    const l = await prisma.lesson.create({ data: { halqaId: str(d.halqaId), date, time, link, note, createdBy: u.id, subId: subId || null } });
    return { id: l.id };
  },
  async "lesson.open"(u, b) {
    if (u.role !== "teacher") return;
    const l = await lessonFor(u, str(b.id));
    if (l.teacherAt || l.date !== localDate()) return;
    await prisma.lesson.update({ where: { id: l.id }, data: { teacherAt: new Date(), teacherBy: u.id } });
  },
  async "lesson.cancel"(u, b) {
    const l = await lessonFor(u, str(b.id));
    await audit(u, "lesson.cancel", l.id, (b.v ? "إلغاء" : "استرجاع") + ` حصة ${l.date}`);
    await prisma.lesson.update({ where: { id: l.id }, data: { cancelled: !!b.v, ...(b.v && b.note ? { note: str(b.note, 200) } : {}) } });
  },
  async "lesson.delete"(u, b) {
    const l = await lessonFor(u, str(b.id));
    await audit(u, "lesson.delete", l.id, (l.autoKey ? "إلغاء" : "حذف") + ` حصة ${l.date}`);
    if (l.autoKey) { await prisma.lesson.update({ where: { id: l.id }, data: { cancelled: true } }); return; }
    await prisma.$transaction([prisma.join.deleteMany({ where: { lessonId: l.id } }), prisma.lesson.delete({ where: { id: l.id } })]);
  },
  async "lesson.att"(u, b) {
    const l = await lessonFor(u, str(b.id));
    const studs = new Set((await prisma.user.findMany({ where: { halqaId: l.halqaId, role: "student" }, select: { id: true } })).map((s) => s.id));
    const att: Record<string, string> = { ...((l.att as any) || {}) };
    const changes = b.map && typeof b.map === "object" ? b.map : { [str(b.uid)]: b.v };
    const changed: [string, string | null][] = [];
    for (const [k, v] of Object.entries(changes)) {
      if (!studs.has(k)) continue;
      const nv = v && ATT.includes(String(v)) ? String(v) : null;
      if ((att[k] || null) !== nv) changed.push([k, nv]);
      if (nv) att[k] = nv; else delete att[k];
    }
    await prisma.lesson.update({ where: { id: l.id }, data: { att } });
    // رسائل الواتساب التلقائية لولي الأمر (تُرسل بعد مهلة، وتنلغي إذا تغيّر التحضير)
    if (changed.length) {
      const cfg = await waCfg();
      if (cfg.enabled) {
        const st = await getSettings(); const h = await prisma.halqa.findUnique({ where: { id: l.halqaId } });
        const us = await prisma.user.findMany({ where: { id: { in: changed.map((c) => c[0]) } } });
        for (const [uid, v] of changed) {
          const usr = us.find((x) => x.id === uid); const phone = String(((usr?.info as any) || {}).parentPhone || "");
          const key = `att-${l.id}-${uid}`; const vars = { student: usr?.name || "", halqa: h?.name || "", date: fmtD(l.date) };
          const want = v === "a" && cfg.autoAbsent ? ["absent", st.tpl.absent] : v === "p" && cfg.autoPresent ? ["present", cfg.tplPresent] : v === "l" && cfg.autoLate ? ["late", cfg.tplLate] : null;
          if (!want || !phone) { await cancelMsg(key); continue; }
          await queueMsg(key, want[0], phone, fillVars(want[1], vars), cfg.delayMin, { userId: uid, lessonId: l.id });
        }
      }
    }
  },
  async "lesson.queue"(u, b) {
    const l = await lessonFor(u, str(b.id));
    const studs = new Set((await prisma.user.findMany({ where: { halqaId: l.halqaId, role: "student", status: "active" }, select: { id: true } })).map((s) => s.id));
    const queue = [...new Set<string>((Array.isArray(b.queue) ? b.queue : []).map(String))].filter((x) => studs.has(x));
    const data: any = { queue };
    if ("current" in b) data.currentId = b.current && studs.has(String(b.current)) ? String(b.current) : null;
    await prisma.lesson.update({ where: { id: l.id }, data });
    const cur = "current" in b ? data.currentId : l.currentId;
    const oldQ = ((l.queue as string[]) || []);
    if (cur && cur !== l.currentId) await notify([cur], { title: "دورك الآن", body: "المعلم ينتظرك للتسميع", url: "/", tag: "q-" + l.id });
    if (queue[0] && queue[0] !== oldQ[0] && queue[0] !== cur) await notify([queue[0]], { title: "دورك قرب", body: "أنت التالي في طابور التسميع، استعد", url: "/", tag: "q-" + l.id });
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
    let lesson: any = null;
    if (b.lessonId) lesson = await lessonFor(u, str(b.lessonId));
    const st = await studentFor(u, str(b.uid), lesson);
    if (lesson && lesson.halqaId !== st.halqaId) fail("الطالب ليس في حلقة هذه الحصة");
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
    const wcfg = await waCfg();
    if (wcfg.enabled && wcfg.autoRec) {
      const phone = String(((st.info as any) || {}).parentPhone || "");
      const all = await prisma.rec.findMany({ where: { userId: st.id, ...(lesson ? { lessonId: lesson.id } : { date }) }, orderBy: { at: "asc" } });
      const h = st.halqaId ? await prisma.halqa.findUnique({ where: { id: st.halqaId } }) : null;
      const lines = all.map((r) => `- ${TYPE_AR[r.type]}: ${SN[r.surah - 1]} ${r.fromA}-${r.toA} (${r.grade}${r.quick ? "" : "، أخطاء " + r.mistakes}${r.note ? "، " + r.note : ""})`).join("\n");
      if (phone) await queueMsg(`rec-${lesson ? lesson.id : date}-${st.id}`, "rec", phone, fillVars(wcfg.tplRec, { student: st.name, halqa: h?.name || "", date: fmtD(date), rec: lines }), wcfg.delayMin, { userId: st.id, lessonId: lesson?.id });
    }
    // تقدّم الخطة التلقائية بعد النجاح فقط
    const p = planOf(st); let moved = false;
    if (p.mode === "auto") {
      const dir = p.auto.dir === "fwd" ? "fwd" : "bwd";
      for (const r of rows) {
        if (!r.pass || (r.type !== "new" && r.type !== "review")) continue;
        const pos = ORD[dir].pos[gOf(r.surah, r.toA)];
        if (r.type === "new" && pos + 1 > p.auto.newPos) { p.auto.newPos = pos + 1; moved = true; }
        if (r.type === "review") { let np = pos + 1; if (np >= p.auto.newPos || np < (p.auto.memStart || 0)) np = p.auto.memStart || 0; p.auto.revPos = np; moved = true; }
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
    await audit(u, "rec.update", r!.userId, `تعديل تسميع ${r!.date}`);
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
    await audit(u, "rec.delete", r.userId, `حذف تسميع ${r.date} (${r.grade})`);
  },

  // ---------- الخطة ----------
  async "plan.save"(u, b) {
    const st = await studentFor(u, str(b.id));
    if (!(isAdmin(u) || (u.role === "teacher" && u.canPlan))) fail("ما عندك صلاحية إعداد الخطط", 403);
    const mode = b.mode === "auto" ? "auto" : "manual";
    const old = planOf(st);
    const manual: any = {};
    for (const k of ["new", "review", "tath"]) {
      const m = b.manual?.[k]; if (!m || !int(m.surah)) continue;
      const s = int(m.surah); const ts = int(m.toSurah) || s;
      if (ts < 1 || ts > 114) fail("السورة غير صحيحة");
      const fr = int(m.from) || 1, to = int(m.to) || AYAS[ts - 1];
      if (ts === s ? !validRange(s, fr, to) : (fr < 1 || fr > AYAS[s - 1] || to < 1 || to > AYAS[ts - 1])) fail("آيات المقطع غير صحيحة");
      manual[k] = { surah: s, from: fr, toSurah: ts, to };
    }
    let auto = old.auto;
    if (mode === "auto") {
      const a = b.auto || {}; const dir = a.dir === "fwd" ? "fwd" : "bwd";
      const okPos = (sv: number, av: number) => sv >= 1 && sv <= 114 && av >= 1 && av <= AYAS[sv - 1];
      let ms: number, np: number;
      if (a.hasPrior) {
        // الحفظ السابق: من (سورة، آية) إلى (سورة، آية) حسب اتجاه الحفظ
        const fs = int(a.pFromS), fa = int(a.pFromA) || 1, ts = int(a.pToS), ta = int(a.pToA) || 1;
        if (!okPos(fs, fa) || !okPos(ts, ta)) fail("تأكد من سور وآيات الحفظ السابق");
        ms = ORD[dir].pos[gOf(fs, fa)]; const me = ORD[dir].pos[gOf(ts, ta)];
        if (me < ms) fail("نهاية الحفظ السابق قبل بدايته حسب اتجاه الحفظ");
        np = Math.min(TOTAL, me + 1);
      } else {
        const ss = int(a.startS), sa = int(a.startA) || 1;
        if (!okPos(ss, sa)) fail("تأكد من موضع بداية الحفظ");
        np = ORD[dir].pos[gOf(ss, sa)]; ms = np;
      }
      const same = dir === old.auto.dir && np === old.auto.newPos && ms === (old.auto.memStart || 0);
      auto = { dir, memStart: ms, newPos: np, revPos: same ? old.auto.revPos : ms, newAmt: AMT(a.newAmt, 5), revAmt: AMT(a.revAmt), tathAmt: AMT(a.tathAmt, 10) };
    }
    const near = AMT(b.near, 10);
    const pz = b.paused && validDate(str(b.paused.from)) ? { from: str(b.paused.from), to: validDate(str(b.paused.to)) ? str(b.paused.to) : "", reason: str(b.paused.reason, 100) } : null;
    const plan = { mode, manual, auto, near, paused: pz };
    await prisma.user.update({ where: { id: st.id }, data: { plan } });
    const desc = (p: any) => p.mode === "auto" ? `تلقائية: حفظ ${p.auto.newAmt} ومراجعة ${p.auto.revAmt} وتثبيت ${p.auto.tathAmt} وجه` : `يدوية${Object.keys(p.manual || {}).length ? " (" + Object.entries(p.manual).map(([k, v]: any) => `${({ new: "حفظ", review: "مراجعة", tath: "تثبيت" } as any)[k]} ${v.surah}:${v.from}-${v.toSurah && v.toSurah !== v.surah ? v.toSurah + ":" : ""}${v.to}`).join("، ") + ")" : ""}`;
    await audit(u, "plan", st.id, `${st.name}: ${desc(old)} ← ${desc(plan)}${pz ? ` · موقوفة من ${pz.from}${pz.to ? " إلى " + pz.to : ""}` : ""}`, { before: old, after: plan });
  },
  async "plan.applyTpl"(u, b) {
    if (!(isAdmin(u) || (u.role === "teacher" && u.canPlan))) fail("ما عندك صلاحية إعداد الخطط", 403);
    const t = b.tpl || {}; const ids = (Array.isArray(b.ids) ? b.ids : []).map(String).slice(0, 200);
    let done = 0, skipped = 0;
    for (const id of ids) {
      const st = await studentFor(u, id);
      const p = planOf(st);
      p.mode = "auto"; p.auto = { ...p.auto, newAmt: AMT(t.newAmt, 5), revAmt: AMT(t.revAmt), tathAmt: AMT(t.tathAmt, 10) };
      await prisma.user.update({ where: { id: st.id }, data: { plan: p } });
      done++;
    }
    await audit(u, "plan.tpl", null, `تطبيق قالب «${str(t.name, 60)}» على ${done} طالب`);
    return { done, skipped };
  },
  async "goal.save"(u, b) {
    const st = await studentFor(u, str(b.id));
    if (!(isAdmin(u) || (u.role === "teacher" && u.canPlan))) fail("ما عندك صلاحية الخطط", 403);
    const g = b.goal;
    const goal = g && AMT(g.pages, 604) > 0 ? { pages: AMT(g.pages, 604), from: validDate(str(g.from)) ? str(g.from) : localDate(), by: validDate(str(g.by)) ? str(g.by) : "", note: str(g.note, 120) } : null;
    await prisma.user.update({ where: { id: st.id }, data: { goal: goal as any } });
    await audit(u, "goal", st.id, goal ? `${st.name}: هدف ${goal.pages} وجه${goal.by ? " قبل " + goal.by : ""}` : `${st.name}: حذف الهدف`);
  },
  async "log.list"(u, b) {
    const target = str(b.target);
    if (target) await studentFor(u, target); else needAdmin(u, "logs");
    const rows = await prisma.auditLog.findMany({ where: target ? { targetId: target } : {}, orderBy: { at: "desc" }, take: target ? 50 : 200 });
    return { rows: rows.map((r) => ({ at: +r.at, by: r.byName, action: r.action, text: r.text })) };
  },

  // ---------- الإعلانات ----------
  async "ann.save"(u, b) {
    if (u.role === "student") fail("غير مصرح", 403);
    const halqaId = str(b.halqaId) || null;
    if (halqaId) await halqaFor(u, halqaId); else if (!isAdmin(u)) fail("المعلم ينشر لحلقته فقط");
    if (isAdmin(u)) needAdmin(u, "anns");
    const title = str(b.title, 120); if (!title) fail("اكتب عنوان الإعلان");
    const data = { halqaId, title, body: str(b.body, 2000), byId: u.id, byName: u.name };
    if (b.id) {
      const a = await prisma.ann.findUnique({ where: { id: str(b.id) } });
      if (!a || (!isAdmin(u) && a.byId !== u.id)) fail("الإعلان غير موجود", 404);
      await prisma.ann.update({ where: { id: a!.id }, data });
    } else {
      await prisma.ann.create({ data });
      const ids = (await prisma.user.findMany({ where: { role: "student", status: "active", ...(halqaId ? { halqaId } : {}) }, select: { id: true } })).map((x) => x.id);
      await notify(ids, { title: "إعلان: " + title, body: data.body.slice(0, 120), url: "/", tag: "ann" });
    }
  },
  async "ann.delete"(u, b) {
    const a = await prisma.ann.findUnique({ where: { id: str(b.id) } });
    if (!a) return;
    if (!isAdmin(u) && a.byId !== u.id) fail("غير مصرح", 403);
    await prisma.$transaction([prisma.annRead.deleteMany({ where: { annId: a.id } }), prisma.ann.delete({ where: { id: a.id } })]);
  },
  async "ann.read"(u, b) {
    const a = await prisma.ann.findUnique({ where: { id: str(b.id) } });
    if (!a || (a.halqaId && a.halqaId !== u.halqaId && u.role === "student")) fail("الإعلان غير موجود", 404);
    await prisma.annRead.upsert({ where: { annId_userId: { annId: a!.id, userId: u.id } }, create: { annId: a!.id, userId: u.id }, update: {} });
  },

  // ---------- الواتساب (الواتس الذكي) ----------
  async "wa.get"(u) {
    if (!isFull(u)) fail("للمدير الكامل فقط", 403);
    const cfg = await waCfg();
    const log = await prisma.outMsg.findMany({ orderBy: { at: "desc" }, take: 60 });
    const users = await prisma.user.findMany({ where: { id: { in: [...new Set(log.map((m) => m.userId).filter((x): x is string => !!x))] } }, select: { id: true, name: true } });
    const counts = await prisma.outMsg.groupBy({ by: ["status"], _count: true });
    return { cfg, counts: Object.fromEntries(counts.map((c: any) => [c.status, c._count])), log: log.map((m) => ({ id: m.id, kind: m.kind, name: users.find((x) => x.id === m.userId)?.name || "", phone: m.toPhone, text: m.text, status: m.status, at: +m.at, sendAfter: +m.sendAfter, sentAt: m.sentAt ? +m.sentAt : null, resp: m.resp, tries: m.tries })) };
  },
  async "wa.save"(u, b) {
    if (!isFull(u)) fail("للمدير الكامل فقط", 403);
    const d = b.data || {};
    const value = {
      enabled: !!d.enabled, method: ["GET", "POST_FORM", "POST_JSON"].includes(d.method) ? d.method : "GET",
      url: str(d.url, 1500), body: str(d.body, 2000), okWord: str(d.okWord, 60),
      autoAbsent: !!d.autoAbsent, autoPresent: !!d.autoPresent, autoLate: !!d.autoLate, autoRec: !!d.autoRec,
      delayMin: Math.min(240, Math.max(0, int(d.delayMin, 10))),
      tplPresent: str(d.tplPresent, 800) || WA_DEF.tplPresent, tplLate: str(d.tplLate, 800) || WA_DEF.tplLate, tplRec: str(d.tplRec, 800) || WA_DEF.tplRec,
      autoWeek: !!d.autoWeek, weekDay: Math.min(6, Math.max(0, int(d.weekDay, 4))), weekHour: Math.min(23, Math.max(0, int(d.weekHour, 20))), tplWeek: str(d.tplWeek, 1200) || WA_DEF.tplWeek,
    };
    if (value.url && !/^https:\/\//i.test(value.url)) fail("رابط الإرسال لازم يبدأ بـ https://");
    const HOW = "اطلع لأول قسم «ربط الواتساب»، في مربع «الربط السريع» اكتب رقمك وكلمة مرورك في الواتس الذكي واضغط «اربط»، وبعدها اضغط حفظ.";
    if (value.enabled && !value.url) fail("ما تم الربط بعد. " + HOW);
    if (value.enabled && (!(value.url + value.body).includes("{message}") || !(value.url + value.body).match(/\{phone0?\}/))) fail("رابط الإرسال المكتوب غلط (غالبًا رابط صفحة الشرح). " + HOW);
    await prisma.setting.upsert({ where: { key: "wa" }, create: { key: "wa", value }, update: { value } });
    await audit(u, "wa.save", null, `إعدادات الواتساب: ${value.enabled ? "مفعّل" : "متوقف"}`);
  },
  async "wa.test"(u, b) {
    if (!isFull(u)) fail("للمدير الكامل فقط", 403);
    const cfg = { ...(await waCfg()), ...(b.data || {}) };
    if (!intlPhone(str(b.phone))) fail("اكتب رقم جوال صحيح");
    return await waSend(cfg as any, str(b.phone), str(b.text, 500) || "رسالة تجريبية من حلقات ارتق");
  },
  // ربط سريع مع الواتس الذكي: يدخل بحساب المدير هناك ويجيب رمز jwt والأجهزة (كلمة المرور ما تنحفظ)
  async "wa.smartLogin"(u, b) {
    if (!isFull(u)) fail("للمدير الكامل فقط", 403);
    const phone = intlPhone(str(b.phone)); const password = str(b.password, 200);
    if (!phone || !password) fail("اكتب رقم الجوال وكلمة المرور حق حسابك في الواتس الذكي");
    const post = async (path: string, data: Record<string, string>) => {
      try {
        const r = await fetch("https://server.smart-whats.com" + path, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body: new URLSearchParams(data).toString(), signal: AbortSignal.timeout(15000) });
        const hdr = [r.headers.get("authorization"), r.headers.get("set-cookie"), r.headers.get("x-auth-token")].filter(Boolean).join(" ");
        return { status: r.status, t: await r.text(), hdr };
      } catch (e: any) { return { status: 0, t: "تعذّر الاتصال بالواتس الذكي: " + String(e?.message || e), hdr: "" }; }
    };
    const JWT = /eyJ[\w-]+\.[\w-]+\.[\w-]+/;
    let l = await post("/user/auth/login", { phone, password });
    let jwt = ((l.t + " " + l.hdr).match(JWT) || [])[0];
    if (!jwt && phone.startsWith("966")) { l = await post("/user/auth/login", { phone: "0" + phone.slice(3), password }); jwt = ((l.t + " " + l.hdr).match(JWT) || [])[0]; }
    if (!jwt) fail("ما قدرت أدخل حسابك في الواتس الذكي. تأكد من الرقم وكلمة المرور. الرد: " + l.status + " " + l.t.slice(0, 200));
    const d = await post("/user/devices/api/list", { jwt });
    let devices: { id: string; name: string; status: string }[] = [];
    try {
      const walk = (x: any) => {
        if (Array.isArray(x)) x.forEach(walk);
        else if (x && typeof x === "object") {
          if (typeof x._id === "string" && /^[a-f0-9]{24}$/i.test(x._id) && (x.name || x.phone || x.number || x.status !== undefined || x.connected !== undefined)) devices.push({ id: x._id, name: String(x.name || x.title || x.phone || x.number || ""), status: String(x.status ?? x.connected ?? "") });
          else Object.values(x).forEach(walk);
        }
      };
      walk(JSON.parse(d.t));
    } catch {}
    if (!devices.length) devices = [...new Set(d.t.match(/\b[a-f0-9]{24}\b/gi) || [])].map((id) => ({ id, name: "", status: "" }));
    return { jwt, devices, raw: devices.length ? "" : (d.status + " " + d.t.slice(0, 300)) };
  },

  // ---------- رسائل الطالب وولي الأمر مع المعلم ----------
  async "dm.send"(u, b) {
    const text = str(b.text, 1000).trim(); if (!text) fail("اكتب الرسالة");
    let sid: string, fromStaff = false; let st: any;
    if (u.role === "student") { sid = u.id; st = u; }
    else { st = await studentFor(u, str(b.studentId)); sid = st.id; fromStaff = true; }
    const kind = !fromStaff && b.kind === "note" ? "note" : "msg";
    const date = kind === "note" ? (validDate(str(b.date)) ? str(b.date) : localDate()) : "";
    const m = await prisma.dm.create({ data: { studentId: sid, byId: u.id, byName: u.name, fromStaff, kind, date, text } });
    // إشعار للطرف الثاني
    if (fromStaff) await notify([sid], { title: "رسالة من " + u.name, body: text.slice(0, 120), url: "/", tag: "dm-" + sid });
    else if (st.halqaId) { const h = await prisma.halqa.findUnique({ where: { id: st.halqaId } }); if (h?.teacherId) await notify([h.teacherId], { title: (kind === "note" ? "ملاحظة من ولي أمر " : "رسالة من ") + st.name, body: text.slice(0, 120), url: "/", tag: "dm-" + sid }); }
    return { id: m.id };
  },
  async "dm.read"(u, b) {
    const sid = u.role === "student" ? u.id : (await studentFor(u, str(b.studentId))).id;
    await prisma.dm.updateMany({ where: { studentId: sid, fromStaff: u.role !== "student", readAt: null }, data: { readAt: new Date() } });
  },
  async "dm.delete"(u, b) {
    const m = await prisma.dm.findUnique({ where: { id: str(b.id) } });
    if (!m || (m.byId !== u.id && !isAdmin(u))) fail("الرسالة غير موجودة", 404);
    await prisma.dm.delete({ where: { id: m!.id } });
  },

  // ---------- سجل السلوك ----------
  async "behav.add"(u, b) {
    if (u.role === "student") fail("غير مصرح", 403);
    const st = await studentFor(u, str(b.userId));
    const text = str(b.text, 300).trim(); if (!text) fail("اكتب الملاحظة");
    await prisma.behav.create({ data: { userId: st.id, byId: u.id, byName: u.name, kind: b.kind === "bad" ? "bad" : "good", text, visible: b.visible !== false } });
  },
  async "behav.delete"(u, b) {
    const x = await prisma.behav.findUnique({ where: { id: str(b.id) } });
    if (!x || (x.byId !== u.id && !isAdmin(u))) fail("الملاحظة غير موجودة", 404);
    await prisma.behav.delete({ where: { id: x!.id } });
  },

  // ---------- التصويت ----------
  async "poll.save"(u, b) {
    if (u.role === "student") fail("غير مصرح", 403);
    const halqaId = str(b.halqaId) || null;
    if (halqaId) await halqaFor(u, halqaId); else if (!isAdmin(u) || (await scopeHalqaIds(u))) fail("اختر الحلقة");
    const question = str(b.question, 200).trim(); if (!question) fail("اكتب السؤال");
    const options = (Array.isArray(b.options) ? b.options : []).map((o: any) => str(o, 80).trim()).filter(Boolean).slice(0, 8);
    if (options.length < 2) fail("اكتب خيارين على الأقل");
    const p = await prisma.poll.create({ data: { halqaId, question, options, multi: !!b.multi, byId: u.id, byName: u.name } });
    const studs = await prisma.user.findMany({ where: { role: "student", status: "active", ...(halqaId ? { halqaId } : {}) }, select: { id: true } });
    await notify(studs.map((x) => x.id), { title: "تصويت جديد", body: question, url: "/", tag: "poll-" + p.id });
    return { id: p.id };
  },
  async "poll.close"(u, b) {
    const p = await prisma.poll.findUnique({ where: { id: str(b.id) } });
    if (!p || (p.byId !== u.id && !isAdmin(u))) fail("التصويت غير موجود", 404);
    await prisma.poll.update({ where: { id: p!.id }, data: { closed: !p!.closed } });
  },
  async "poll.delete"(u, b) {
    const p = await prisma.poll.findUnique({ where: { id: str(b.id) } });
    if (!p || (p.byId !== u.id && !isAdmin(u))) fail("التصويت غير موجود", 404);
    await prisma.$transaction([prisma.pollVote.deleteMany({ where: { pollId: p!.id } }), prisma.poll.delete({ where: { id: p!.id } })]);
  },
  async "poll.vote"(u, b) {
    if (u.role !== "student") fail("التصويت للطلاب وأولياء الأمور");
    const p = await prisma.poll.findUnique({ where: { id: str(b.id) } });
    if (!p || (p.halqaId && p.halqaId !== u.halqaId)) fail("التصويت غير موجود", 404);
    if (p!.closed) fail("التصويت انقفل");
    const n = (p!.options as string[]).length;
    let choice = (Array.isArray(b.choice) ? b.choice : []).map(Number).filter((i: number) => Number.isInteger(i) && i >= 0 && i < n);
    choice = [...new Set(choice)]; if (!p!.multi) choice = choice.slice(0, 1);
    if (!choice.length) fail("اختر خيار");
    await prisma.pollVote.upsert({ where: { pollId_userId: { pollId: p!.id, userId: u.id } }, create: { pollId: p!.id, userId: u.id, choice }, update: { choice, at: new Date() } });
  },

  // ---------- إضافات المساعد الذكي (تنفذ بعد تأكيد المستخدم) ----------
  async "events.add"(u, b) {
    needAdmin(u, "settings");
    const date = str(b.date, 10); if (!validDate(date)) fail("تاريخ غير صالح");
    const cur = await getSettings(); const list = [...((cur as any).events || []), { date, name: str(b.name, 80) || "مناسبة", kind: b.kind === "exam" ? "exam" : "event" }];
    await prisma.setting.upsert({ where: { key: "main" }, create: { key: "main", value: { ...cur, events: list } }, update: { value: { ...cur, events: list } } });
  },
  async "holidays.add"(u, b) {
    const cur = await getSettings();
    return A["holidays.save"](u, { list: [...(cur.holidays || []), { name: b.name, from: b.from, to: b.to || b.from }] });
  },
  async "dm.bulk"(u, b) {
    if (u.role === "student") fail("غير مصرح", 403);
    const ids = (Array.isArray(b.studentIds) ? b.studentIds : []).map(String).slice(0, 300); let n = 0;
    for (const id of ids) { await A["dm.send"](u, { studentId: id, text: b.text }); n++; }
    return { n };
  },
  // ---------- مناسبات التقويم ----------
  async "events.save"(u, b) {
    needAdmin(u, "settings");
    const list = (Array.isArray(b.list) ? b.list : []).slice(0, 100).map((e: any) => ({ date: str(e.date, 10), name: str(e.name, 80) || "مناسبة", kind: ["exam", "event"].includes(e.kind) ? e.kind : "event" })).filter((e: any) => validDate(e.date));
    const cur = await getSettings();
    await prisma.setting.upsert({ where: { key: "main" }, create: { key: "main", value: { ...cur, events: list } }, update: { value: { ...cur, events: list } } });
  },

  // ---------- استيراد الطلاب ----------
  async "students.import"(u, b) {
    needAdmin(u, "students");
    const rows = (Array.isArray(b.rows) ? b.rows : []).slice(0, 500);
    if (!rows.length) fail("ما فيه صفوف");
    const halaqat = await prisma.halqa.findMany(); const s = await getSettings();
    const sc = await scopeHalqaIds(u);
    const out: any[] = []; const errors: string[] = [];
    for (const [i, r] of rows.entries()) {
      const name = str(r.name, 120).trim(); if (!name) { errors.push(`صف ${i + 1}: بدون اسم`); continue; }
      const h = halaqat.find((x) => x.id === str(r.halqaId)) || halaqat.find((x) => x.name.trim() === str(r.halqa).trim());
      if (!h) { errors.push(`صف ${i + 1} (${name}): الحلقة غير معروفة`); continue; }
      if (sc && !sc.includes(h.id)) { errors.push(`صف ${i + 1} (${name}): الحلقة خارج نطاقك`); continue; }
      let username = cleanUsername(r.username);
      if (!username || !USERNAME_RE.test(username)) username = "";
      if (username && (await prisma.user.findUnique({ where: { username } }))) { errors.push(`صف ${i + 1} (${name}): اسم المستخدم ${username} مستخدم`); continue; }
      while (!username) { const c = "t" + Math.floor(10000 + Math.random() * 89999); if (!(await prisma.user.findUnique({ where: { username: c } }))) username = c; }
      const pw = str(r.password, 60) && str(r.password, 60).length >= 4 ? str(r.password, 60) : String(Math.floor(100000 + Math.random() * 899999));
      const info = cleanInfo(s.fields, r.info || {});
      await prisma.user.create({ data: { role: "student", status: "active", name, username, passwordHash: await bcrypt.hash(pw, 10), halqaId: h.id, info, plan: defPlan(), approvedAt: new Date() } });
      out.push({ name, username, password: pw, halqa: h.name, parentPhone: (info as any).parentPhone || "" });
    }
    await audit(u, "students.import", null, `استيراد ${out.length} طالب`);
    return { created: out, errors };
  },

  // ---------- حالة الخدمات ----------
  async "status.check"(u) {
    if (!isFull(u)) fail("للمدير الكامل فقط", 403);
    const t0 = Date.now(); await prisma.$queryRaw`SELECT 1`; const dbMs = Date.now() - t0;
    const wa = await waCfg();
    const [waSent, waFailed, waPending, lastSent] = await Promise.all([
      prisma.outMsg.count({ where: { status: "sent", sentAt: { gte: new Date(Date.now() - 7 * 864e5) } } }),
      prisma.outMsg.count({ where: { status: "failed" } }),
      prisma.outMsg.count({ where: { status: "pending", sendAfter: { lte: new Date(Date.now() - 15 * 60000) } } }),
      prisma.outMsg.findFirst({ where: { status: "sent" }, orderBy: { sentAt: "desc" }, select: { sentAt: true } }),
    ]);
    const vc = await videoCfg();
    const cronRow = await prisma.setting.findUnique({ where: { key: "cronLast" } });
    const lastBackup = await prisma.backup.findFirst({ orderBy: { at: "desc" }, select: { at: true } });
    return {
      db: { ok: true, ms: dbMs },
      wa: { on: wa.enabled && !!wa.url, sent7: waSent, failed: waFailed, stuck: waPending, last: lastSent?.sentAt ? +lastSent.sentAt : null },
      video: { on: videoOn(vc), order: videoPublic(vc).order },
      push: !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
      cron: { secret: !!process.env.CRON_SECRET, last: (cronRow?.value as any)?.at || null },
      backup: lastBackup ? +lastBackup.at : null,
    };
  },
  // ---------- غرفة الحصة داخل الموقع ----------
  async "video.get"(u) {
    if (!isFull(u)) fail("للمدير الكامل فقط", 403);
    return videoPublic(await videoCfg());
  },
  async "video.save"(u, b) {
    if (!isFull(u)) fail("للمدير الكامل فقط", 403);
    const d = b.data || {}; const old = await videoCfg();
    const value = {
      provider: ["none", "jaas", "daily"].includes(d.provider) ? d.provider : "none",
      jaasApp: str(d.jaasApp, 200).trim(), jaasKid: str(d.jaasKid, 300).trim(),
      jaasKey: str(d.jaasKey, 6000).trim() || old.jaasKey, dailyKey: str(d.dailyKey, 300).trim() || old.dailyKey,
    };
    if (d.clearKeys) { value.jaasKey = ""; value.dailyKey = ""; }
    if (value.provider === "jaas" && !(value.jaasApp && value.jaasKid && value.jaasKey)) fail("عبّ معرّف التطبيق ومعرّف المفتاح والمفتاح الخاص");
    if (value.provider === "daily" && !value.dailyKey) fail("الصق مفتاح Daily");
    if (value.dailyKey && value.dailyKey !== old.dailyKey) {
      const r = await fetch("https://api.daily.co/v1/rooms?limit=1", { headers: { Authorization: "Bearer " + value.dailyKey }, signal: AbortSignal.timeout(12000) }).catch(() => null);
      if (!r || r.status === 401 || r.status === 403) fail("مفتاح Daily غير صحيح، تأكد إنك نسخته كامل");
    }
    if (value.jaasApp && value.jaasKid && value.jaasKey) { try { await roomUrl(value as any, "test", { id: u.id, name: u.name }, true, 1, "jaas"); } catch (e: any) { fail("المفتاح الخاص غير صالح: " + String(e?.message || e).slice(0, 120)); } }
    await prisma.setting.upsert({ where: { key: "video" }, create: { key: "video", value }, update: { value } });
    await audit(u, "video.save", null, "غرفة الحصة: " + value.provider);
    return videoPublic(value as any);
  },
  async "video.join"(u, b) {
    const c = await videoCfg(); if (!videoOn(c)) fail("غرفة الحصة غير مفعّلة");
    if (str(b.lessonId) === "test") { if (!isFull(u)) fail("غير مسموح", 403); try { return await roomUrlAny(c, "test-" + u.id.slice(-6), { id: u.id, name: u.name }, true, !!b.alt); } catch (e: any) { fail(String(e?.message || e)); } }
    const l = await prisma.lesson.findUnique({ where: { id: str(b.lessonId) } });
    if (!l) fail("الحصة غير موجودة", 404);
    if (l!.cancelled) fail("هذه الحصة ملغاة");
    let mod = false;
    if (u.role === "student") {
      if (l!.halqaId !== u.halqaId) fail("الحصة غير موجودة", 404);
      await prisma.join.upsert({ where: { lessonId_userId: { lessonId: l!.id, userId: u.id } }, create: { lessonId: l!.id, userId: u.id }, update: { leftAt: null } });
    } else {
      await lessonFor(u, l!.id); mod = true;
      if (u.role === "teacher" && !l!.teacherAt) await prisma.lesson.update({ where: { id: l!.id }, data: { teacherAt: new Date(), teacherBy: u.id } });
    }
    // المعلم يقدر ينقل الحصة كلها للخدمة الثانية، والطلاب يتبعونه
    const altRow = await prisma.setting.findUnique({ where: { key: "videoAlt" } }); const altMap: Record<string, boolean> = { ...((altRow?.value as any) || {}) };
    if (mod && b.alt !== undefined) {
      if (b.alt) altMap[l!.id] = true; else delete altMap[l!.id];
      for (const k of Object.keys(altMap)) if (!(await prisma.lesson.findFirst({ where: { id: k, date: { gte: localDate(-1) } }, select: { id: true } }))) delete altMap[k];
      await prisma.setting.upsert({ where: { key: "videoAlt" }, create: { key: "videoAlt", value: altMap }, update: { value: altMap } });
    }
    try { return { ...(await roomUrlAny(c, l!.id, { id: u.id, name: u.name }, mod, !!altMap[l!.id])), alt: !!altMap[l!.id] }; }
    catch (e: any) { fail(String(e?.message || e)); }
  },
  // رسالة يدوية لولي الأمر تطلع من رقم الحلقة المربوط (بدل واتساب المعلم)
  async "wa.sendText"(u, b) {
    if (u.role === "student") fail("غير مسموح", 403);
    const cfg = await waCfg(); if (!cfg.enabled || !cfg.url) fail("ربط الواتساب متوقف. فعّله من الإعدادات");
    const phone = intlPhone(str(b.phone)); const text = str(b.text, 3000).trim();
    if (!phone) fail("رقم غير صالح"); if (!text) fail("الرسالة فاضية");
    // المعلم يرسل لأولياء أمور طلاب حلقاته فقط، والمدير لأي طالب
    const where: any = { role: "student" };
    if (u.role === "teacher") { const hs = await prisma.halqa.findMany({ where: { teacherId: u.id }, select: { id: true } }); where.halqaId = { in: hs.map((h) => h.id) }; }
    const studs = await prisma.user.findMany({ where, select: { id: true, info: true } });
    const st = studs.find((x) => [(x.info as any)?.parentPhone, (x.info as any)?.phone].some((v) => v && intlPhone(String(v)) === phone));
    if (!st) fail("هذا الرقم مو لأحد طلابك", 403);
    const r = await waSend(cfg, phone, text);
    await prisma.outMsg.create({ data: { key: "m-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8), kind: "manual", userId: st!.id, toPhone: phone, text, sendAfter: new Date(Date.now() + 2 * 60000), status: r.ok ? "sent" : "pending", sentAt: r.ok ? new Date() : null, tries: 1, resp: r.resp } });
    return { ok: r.ok, resp: r.resp };
  },
  // إرسال التقرير الأسبوعي الآن عبر الواتساب (لكل الحلقات أو لحلقة وحدة)
  async "wa.weekNow"(u, b) {
    const hid = str(b.halqaId);
    if (hid) {
      const h = await prisma.halqa.findUnique({ where: { id: hid } }); if (!h) fail("الحلقة غير موجودة", 404);
      if (u.role !== "admin" && h!.teacherId !== u.id) fail("ما عندك صلاحية على هذه الحلقة", 403);
    } else if (!isFull(u)) fail("للمدير الكامل فقط", 403);
    const cfg = await waCfg(); if (!cfg.enabled || !cfg.url) fail("فعّل ربط الواتساب أول من الإعدادات");
    const n = await queueWeekly(hid || undefined);
    await audit(u, "wa.week", null, `إرسال التقرير الأسبوعي (${n} رسالة)`);
    return { n };
  },
  async "wa.retry"(u, b) {
    if (!isFull(u)) fail("للمدير الكامل فقط", 403);
    await prisma.outMsg.updateMany({ where: { id: str(b.id), status: { in: ["failed", "pending", "cancelled"] } }, data: { status: "pending", sendAfter: new Date(), tries: 0 } });
  },
  async "wa.cancel"(u, b) {
    if (!isFull(u)) fail("للمدير الكامل فقط", 403);
    await prisma.outMsg.updateMany({ where: { id: str(b.id), status: "pending" }, data: { status: "cancelled" } });
  },
  async "wa.sendNow"(u, b) {
    const l = await lessonFor(u, str(b.lessonId));
    const r = await prisma.outMsg.updateMany({ where: { lessonId: l.id, status: "pending" }, data: { sendAfter: new Date() } });
    return { n: r.count };
  },
  async "wa.pending"(u, b) {
    const l = await lessonFor(u, str(b.lessonId));
    const rows = await prisma.outMsg.findMany({ where: { lessonId: l.id }, orderBy: { at: "asc" } });
    return { rows: rows.map((m) => ({ id: m.id, kind: m.kind, userId: m.userId, status: m.status, sendAfter: +m.sendAfter, sentAt: m.sentAt ? +m.sentAt : null })) };
  },

  // ---------- غرفة المعلمين ----------
  async "msg.send"(u, b) {
    if (u.role === "student") fail("غير مصرح", 403);
    const text = str(b.text, 1000); if (!text) fail("اكتب الرسالة");
    await prisma.msg.create({ data: { byId: u.id, byName: u.name, text } });
    const old = await prisma.msg.findMany({ orderBy: { at: "desc" }, skip: 500, select: { id: true } });
    if (old.length) await prisma.msg.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
  },
  async "msg.delete"(u, b) {
    const m = await prisma.msg.findUnique({ where: { id: str(b.id) } });
    if (!m) return;
    if (m.byId !== u.id && !isAdmin(u)) fail("غير مصرح", 403);
    await prisma.msg.delete({ where: { id: m.id } });
  },

  // ---------- الورد اليومي ----------
  async "wird.save"(u, b) {
    if (u.role !== "student") fail("للطالب فقط", 403);
    const date = validDate(str(b.date)) ? str(b.date) : localDate();
    if (date > localDate() || date < localDate(-7)) fail("التاريخ غير متاح");
    const items = (Array.isArray(b.items) ? b.items : []).slice(0, 12).map((x: any) => ({ k: str(x.k, 120), done: !!x.done }));
    const data = { items, read: Math.min(604, Math.max(0, int(b.read))), note: str(b.note, 200) };
    await prisma.wird.upsert({ where: { userId_date: { userId: u.id, date } }, create: { userId: u.id, date, ...data }, update: data });
  },

  // ---------- إضافات صفحة الواتساب والمساعد الذكي ----------
  // إرسال رسائل لأولياء أمور عدة طلاب من رقم الحلقة: اللي يلحق ينرسل الحين، والباقي يدخل الطابور ويطلع خلال دقائق
  async "wa.bulk"(u, b) {
    if (u.role === "student") fail("غير مسموح", 403);
    const cfg = await waCfg(); if (!cfg.enabled || !cfg.url) fail("ربط الواتساب متوقف. فعّله من صفحة «رسائل الواتساب»");
    const items = (Array.isArray(b.items) ? b.items : []).slice(0, 300);
    if (!items.length) fail("اختر طالب واحد على الأقل");
    const t0 = Date.now(); let sent = 0, queued = 0, skipped = 0;
    for (const it of items) {
      const st = await studentFor(u, str(it.studentId));
      const phone = intlPhone(String(((st.info as any) || {}).parentPhone || ""));
      const text = str(it.text, 3000).trim();
      if (!phone || !text) { skipped++; continue; }
      const key = "m-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
      if (Date.now() - t0 < 20000) {
        const r = await waSend(cfg, phone, text);
        await prisma.outMsg.create({ data: { key, kind: "manual", userId: st.id, toPhone: phone, text, sendAfter: new Date(Date.now() + 2 * 60000), status: r.ok ? "sent" : "pending", sentAt: r.ok ? new Date() : null, tries: 1, resp: r.resp } });
        if (r.ok) sent++; else queued++;
      } else { await queueMsg(key, "manual", phone, text, 0, { userId: st.id }); queued++; }
    }
    await audit(u, "wa.bulk", null, `رسالة واتساب لأولياء أمور ${sent + queued} طالب`);
    return { sent, queued, skipped };
  },
  // تشغيل وإيقاف الرسائل التلقائية بدون ما نلمس بيانات الربط
  async "wa.auto"(u, b) {
    if (!isFull(u)) fail("للمدير الكامل فقط", 403);
    const cur: any = await waCfg(); const d = b.data || {};
    for (const k of ["autoAbsent", "autoLate", "autoPresent", "autoRec", "autoWeek"]) if (typeof d[k] === "boolean") cur[k] = d[k];
    if (d.delayMin !== undefined) cur.delayMin = Math.min(240, Math.max(0, int(d.delayMin, 10)));
    if (d.weekDay !== undefined) cur.weekDay = Math.min(6, Math.max(0, int(d.weekDay, 4)));
    if (d.weekHour !== undefined) cur.weekHour = Math.min(23, Math.max(0, int(d.weekHour, 20)));
    if (typeof d.enabled === "boolean") { if (d.enabled && !cur.url) fail("اربط الواتساب أول من صفحة «رسائل الواتساب»"); cur.enabled = d.enabled; }
    await prisma.setting.upsert({ where: { key: "wa" }, create: { key: "wa", value: cur }, update: { value: cur } });
    await audit(u, "wa.save", null, "تعديل الرسائل التلقائية");
  },
  async "wa.retryFailed"(u) {
    if (!isFull(u)) fail("للمدير الكامل فقط", 403);
    const r = await prisma.outMsg.updateMany({ where: { status: "failed" }, data: { status: "pending", sendAfter: new Date(), tries: 0 } });
    return { n: r.count };
  },
  // إيقاف الخطة مؤقتًا أو إرجاعها (بدون ما تتغير مقاديرها)
  async "plan.pause"(u, b) {
    const st = await studentFor(u, str(b.id));
    if (!(isAdmin(u) || (u.role === "teacher" && u.canPlan))) fail("ما عندك صلاحية إعداد الخطط", 403);
    const p: any = planOf(st);
    const pz = b.paused && validDate(str(b.paused.from)) ? { from: str(b.paused.from), to: validDate(str(b.paused.to)) ? str(b.paused.to) : "", reason: str(b.paused.reason, 100) } : null;
    p.paused = pz;
    await prisma.user.update({ where: { id: st.id }, data: { plan: p } });
    await audit(u, "plan", st.id, pz ? `${st.name}: إيقاف الخطة من ${pz.from}${pz.to ? " إلى " + pz.to : ""}` : `${st.name}: استئناف الخطة`);
  },

  // ---------- كلمة مرور مؤقتة ----------
  async "user.resetpw"(u, b) {
    needAdmin(u);
    const t = await prisma.user.findUnique({ where: { id: str(b.id) } });
    if (!t || t.role === "admin") fail("الحساب غير موجود", 404);
    needAdmin(u, t!.role === "teacher" ? "teachers" : "students");
    const pw = String(crypto.randomInt(100000, 1000000));
    await prisma.user.update({ where: { id: t!.id }, data: { passwordHash: await bcrypt.hash(pw, 10) } });
    await audit(u, "user.resetpw", t!.id, `كلمة مرور مؤقتة لـ ${t!.name}`);
    return { pw, username: t!.username };
  },
};

export async function POST(req: Request) {
  return handle(async () => {
    const u = await currentUser();
    if (!u) fail("انتهت الجلسة، سجّل دخولك مرة ثانية", 401);
    const b = await req.json().catch(() => ({}));
    const h = A[String(b.t)];
    if (!h) fail("إجراء غير معروف");
    const out = (await h(u!, b)) ?? { ok: true };
    await processQueue(6);
    return out;
  });
}
