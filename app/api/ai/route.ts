import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { currentUser, handle, fail, str, cleanUsername, USERNAME_RE } from "@/lib/auth";
import { getSettings, localDate, GRADES } from "@/lib/settings";
import { scopeHalqaIds, viewSide, genderWhere, sideVal } from "@/lib/scope";
import { audit } from "@/lib/audit";
import { SN, AYAS, validRange, ORD, TOTAL, SSTART, gOf } from "@/lib/quran";
import { mushafData } from "@/lib/pages";
import { waCfg, fillVars } from "@/lib/wa";
import { aiCfg, aiOn, callLlm, type ToolSpec, type ChatMsg } from "@/lib/ai";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/*
  المساعد الذكي يقدر يسوي عن المستخدم كل شي يقدر عليه هو في الموقع — ما عدا الحذف.
  - كل أداة لها شرط صلاحية (نفس صلاحيات الموقع)، فما يعرض على المعلم إلا أدوات المعلم، وعلى الطالب أدوات الطالب.
  - المساعد ما ينفذ شي بنفسه: يجهز «بطاقة» والمستخدم يضغط «تنفيذ»، والتنفيذ يمر على /api/act بجلسة المستخدم نفسه،
    فالخادم يتحقق من الصلاحية مرة ثانية. وما فيه ولا أداة حذف.
*/

const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const TYPE: Record<string, string> = { new: "حفظ", review: "مراجعة", tath: "تثبيت" };
const ATT_AR: Record<string, string> = { p: "حاضر", l: "متأخر", a: "غائب", e: "مستأذن" };
const PERM_AR: Record<string, string> = { req: "طلبات التسجيل", students: "الطلاب", teachers: "المعلمون", halaqat: "الحلقات", anns: "الإعلانات", reports: "التقارير", settings: "الإعدادات", logs: "سجل العمليات" };
const wd = (d: string) => DAYS[new Date(d + "T12:00:00Z").getUTCDay()];
const hj = (d: string) => { try { return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(d + "T12:00:00Z")); } catch { return ""; } };
const norm = (s: unknown) => String(s ?? "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/[ًٌٍَُِّْـ]/g, "").replace(/\s+/g, " ").trim();
const isDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const isTime = (s: unknown) => /^\d{1,2}:\d{2}$/.test(String(s || ""));
// الحلقات ما تكون بين 1 و3 الفجر: «3:20» يقصد فيها العصر
const hhmm = (s: unknown) => { let [h, m] = String(s).split(":").map(Number); if (h >= 1 && h <= 3) h += 12; return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0"); };
const t12 = (t: string) => { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "ص" : "م"}`; };
const mask = (k?: string) => (k ? "••••" + k.slice(-4) : null);
const ALL_RE = /^(الكل|الجميع|كل الطلاب|كلهم|all)$/i;
const rnd = (a: number, b: number) => String(crypto.randomInt(a, b));
const fmtPg = (n: number) => (n === 0.25 ? "ربع" : n === 0.5 ? "نصف" : n === 0.75 ? "ثلاثة أرباع" : String(n));

/* ---------- البحث بالأسماء ---------- */
function one(list: any[], name: unknown, what = "الاسم"): any {
  const n = norm(name); if (!n) throw new Error("حدد " + what);
  const ex = list.filter((x) => norm(x.name) === n); if (ex.length === 1) return ex[0];
  const pa = (ex.length ? ex : list.filter((x) => { const a = norm(x.name); return a.startsWith(n) || a.includes(n) || n.includes(a); }));
  if (pa.length === 1) return pa[0];
  if (!pa.length) throw new Error(`ما لقيت «${name}»`);
  throw new Error(`فيه أكثر من واحد باسم «${name}»: ${pa.slice(0, 4).map((x) => x.name).join("، ")} — اكتب الاسم كامل`);
}
function many(list: any[], names: unknown): any[] {
  const arr = Array.isArray(names) ? names.map(String) : typeof names === "string" ? [names] : [];
  if (arr.some((n) => ALL_RE.test(n.trim()))) return list;
  const out = new Map<string, any>(); for (const n of arr) { const x = one(list, n); out.set(x.id, x); }
  if (!out.size) throw new Error("حدد الأسماء");
  return [...out.values()];
}
function surahOf(v: unknown): number {
  const n0 = Number(v); if (Number.isInteger(n0) && n0 >= 1 && n0 <= 114) return n0;
  const n = norm(v).replace(/^سوره\s+/, "");
  const names = SN.map((x) => norm(x));
  let i = names.indexOf(n); if (i < 0) i = names.findIndex((x) => x.replace(/^ال/, "") === n.replace(/^ال/, ""));
  if (i < 0) i = names.findIndex((x) => x.includes(n) || n.includes(x));
  if (i < 0) throw new Error(`ما عرفت السورة «${v}»`);
  return i + 1;
}
const dayIdx = (v: unknown) => { const n0 = Number(v); if (Number.isInteger(n0) && n0 >= 0 && n0 <= 6) return n0; const n = norm(v).replace(/^يوم\s+/, ""); const i = DAYS.findIndex((d) => norm(d) === n || norm(d).replace(/^ال/, "") === n.replace(/^ال/, "")); if (i < 0) throw new Error(`ما عرفت اليوم «${v}»`); return i; };
async function freeUsername(prefix: string) { for (let i = 0; i < 20; i++) { const c = prefix + rnd(10000, 99999); if (!(await prisma.user.findUnique({ where: { username: c } }))) return c; } return prefix + Date.now().toString().slice(-7); }
async function checkUsername(v: unknown, prefix: string) {
  if (!v) return freeUsername(prefix);
  const un = cleanUsername(v); if (!USERNAME_RE.test(un)) throw new Error("اسم الدخول لازم حروف إنجليزية أو أرقام (3 على الأقل)");
  if (await prisma.user.findUnique({ where: { username: un } })) throw new Error(`اسم الدخول ${un} مستخدم`);
  return un;
}

/* ---------- الصلاحيات (نفس شروط /api/act) ---------- */
type U = any;
const isAdm = (u: U) => u.role === "admin";
const full = (u: U) => isAdm(u) && !u.perms;
const perm = (p: string) => (u: U) => isAdm(u) && (!u.perms || (u.perms as string[]).includes(p));
const staff = (u: U) => u.role === "admin" || u.role === "teacher";
const planner = (u: U) => isAdm(u) || (u.role === "teacher" && !!u.canPlan);

/* ---------- بيانات المحادثة للمعلم والمدير ---------- */
async function context(u: U, want?: unknown) {
  const sc = isAdm(u) ? await scopeHalqaIds(u) : null;
  const view = await viewSide(u as any, want);
  const halaqat = await prisma.halqa.findMany({ where: isAdm(u) ? (sc ? { id: { in: sc } } : genderWhere(view)) : { teacherId: u.id }, orderBy: { name: "asc" } });
  const hIds = halaqat.map((h) => h.id);
  const allStuds = await prisma.user.findMany({ where: { role: "student", status: { in: ["active", "disabled", "archived"] }, halqaId: { in: hIds } }, orderBy: { name: "asc" }, take: 600 });
  const studs = allStuds.filter((x) => x.status === "active");
  const since = localDate(-30), to = localDate(21);
  const [lessons, recs, teachers, pending, polls, wa, recAll] = await Promise.all([
    prisma.lesson.findMany({ where: { halqaId: { in: hIds }, date: { gte: since, lte: to } }, orderBy: [{ date: "asc" }, { time: "asc" }] }),
    prisma.rec.findMany({ where: { userId: { in: studs.map((s) => s.id) }, date: { gte: since } }, orderBy: { at: "desc" } }),
    isAdm(u) ? prisma.user.findMany({ where: { role: "teacher" }, orderBy: { name: "asc" } }).then((ts) => ts.filter((t) => halaqat.some((h) => h.teacherId === t.id) || (!sc && sideVal(t.side) === view))) : Promise.resolve([] as any[]),
    perm("req")(u) ? prisma.user.findMany({ where: { role: "student", status: "pending" }, orderBy: { createdAt: "asc" }, take: 100 }) : Promise.resolve([] as any[]),
    prisma.poll.findMany({ where: { closed: false, OR: [{ halqaId: { in: hIds } }, ...(isAdm(u) ? [{ halqaId: null, side: view }] : [])] }, orderBy: { at: "desc" }, take: 20 }),
    waCfg(),
    prisma.rec.groupBy({ by: ["userId"], where: { userId: { in: studs.map((x) => x.id) } }, _count: { _all: true } }),
  ]);
  const recTotal: Record<string, number> = Object.fromEntries((recAll as any[]).map((x) => [x.userId, x._count?._all || 0]));
  return { halaqat, studs, allStuds, lessons, recs, recTotal, teachers, pending: pending.filter((p: any) => (p.reqHalqaId ? hIds.includes(p.reqHalqaId) : sideVal(p.side) === view)), view, polls, waOn: !!(wa.enabled && wa.url), wa, sc, settings: await getSettings() };
}
type Ctx = Awaited<ReturnType<typeof context>>;
type Act = { summary: string; t: string; payload: any; error?: string };
type Tool = { spec: ToolSpec; ok: (u: U) => boolean; build: (a: any, c: Ctx, u: U) => Act | Act[] | Promise<Act | Act[]> };

const S = (d: string) => ({ type: "string", description: d });
const N = (d: string) => ({ type: "number", description: d });
const B = (d: string) => ({ type: "boolean", description: d });
const SA = (d: string) => ({ type: "array", items: { type: "string" }, description: d });
const P = (props: Record<string, unknown>, required: string[] = []) => ({ type: "object" as const, properties: props, ...(required.length ? { required } : {}) });
const T = (name: string, description: string, parameters: ToolSpec["parameters"]): ToolSpec => ({ name, description, parameters });

// الحلقة بالاسم، وإذا ما انذكرت نستنتجها: حلقة وحدة، أو الحلقة الوحيدة اللي عندها حصة بهالتاريخ، أو حلقة الطلاب المذكورين
const halqaOf = (c: Ctx, name: unknown, hint: { date?: string; cancelled?: boolean; names?: unknown[] } = {}) => {
  if (name) return one(c.halaqat, name, "الحلقة");
  if (c.halaqat.length === 1) return c.halaqat[0];
  if (hint.date) { const hs = c.halaqat.filter((h) => c.lessons.some((l) => l.halqaId === h.id && l.date === hint.date && !!l.cancelled === !!hint.cancelled)); if (hs.length === 1) return hs[0]; }
  for (const n of (hint.names || []).flat()) { if (!n || ALL_RE.test(String(n).trim())) continue; try { const st = one(c.studs, n); const h = c.halaqat.find((x) => x.id === st.halqaId); if (h) return h; } catch {} }
  throw new Error("حدد الحلقة");
};
const lessonOf = (c: Ctx, h: any, date: string, wantCancelled = false) => {
  const l = c.lessons.find((x) => x.halqaId === h.id && x.date === date && !!x.cancelled === wantCancelled);
  if (!l) throw new Error(wantCancelled ? `ما فيه حصة ملغاة لـ${h.name} يوم ${date}` : `ما فيه حصة لـ${h.name} يوم ${wd(date)} ${date}. أضفها أول`);
  return l;
};
const planOf = (st: any) => { const p: any = st.plan || {}; return { mode: p.mode || "manual", manual: p.manual || {}, auto: p.auto || {}, near: p.near || 0, paused: p.paused || null }; };
const seg = (m: any) => m && m.surah ? `${SN[m.surah - 1]} ${m.from}${m.toSurah && m.toSurah !== m.surah ? " إلى " + SN[m.toSurah - 1] + " " : "-"}${m.to}` : "";
/* مقدار المحفوظ: من الخطة التلقائية (الحفظ السابق + اللي حفظه في الموقع)، أو من «الحفظ السابق» اللي كتبه عند التسجيل */
const PGS = mushafData().pages;
const surOf = (g: number) => { let lo = 0, hi = 113; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (SSTART[m] <= g) lo = m; else hi = m - 1; } return lo; };
const posTxt = (g: number) => { const x = surOf(g); return `${SN[x]} ${g - SSTART[x] + 1}`; };
function memInfo(st: any) {
  const p: any = st.plan || {}; const a = p.auto || {};
  let dir: "fwd" | "bwd" = a.dir === "fwd" ? "fwd" : "bwd"; let ms = +a.memStart || 0, np = +a.newPos || 0;
  if (!(p.mode === "auto" && np > ms)) {
    const mm = /^(\d+):(\d+)>(\d+):(\d+)$/.exec(String(((st.info as any) || {}).memo || ""));
    if (!mm) return "";
    const [fs, fa, ts, ta] = mm.slice(1).map(Number);
    const tryDir = (d: "fwd" | "bwd") => { const x = ORD[d].pos[gOf(fs, fa)], z = ORD[d].pos[gOf(ts, ta)]; return x != null && z != null && z >= x ? { d, x, z: z + 1 } : null; };
    const r = (fs === 114 || fs > ts ? tryDir("bwd") : tryDir("fwd")) || tryDir("bwd") || tryDir("fwd");
    if (!r) return ""; dir = r.d; ms = r.x; np = r.z;
  }
  // عدد صفحات المصحف اللي يغطيها المحفوظ
  const ord = ORD[dir].ord; const set = new Set<number>(); for (let i = ms; i < np && i < TOTAL; i++) set.add(PGS[ord[i]]); const pg = set.size;
  return `محفوظه ≈ ${Math.round(pg)} وجه (≈ ${Math.round(pg / 2.01) / 10} جزء) من ${posTxt(ord[ms])} إلى ${posTxt(ord[Math.min(np, TOTAL) - 1])}`;
}
// تقويم مختصر: التاريخ واليوم واليوم الهجري (واسم الشهر الهجري أول ما يتغير)
function calTxt(n: number) {
  let lastM = "";
  return Array.from({ length: n }, (_, i) => {
    const d = localDate(i); let hd = "";
    try { const f = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-latn", { day: "numeric", month: "long", timeZone: "UTC" }).formatToParts(new Date(d + "T12:00:00Z")); const day = f.find((x) => x.type === "day")?.value || "", mo = f.find((x) => x.type === "month")?.value || ""; hd = day + (mo !== lastM ? " " + mo : ""); lastM = mo; } catch {}
    return `${d} ${wd(d)} ${hd}`.trim();
  }).join("، ");
}
const recLine = (r: any) => `${TYPE[r.type] || ""} ${SN[r.surah - 1]} ${r.fromA}-${r.toA} (${r.grade}${r.quick ? "" : r.mistakes ? "، " + r.mistakes + " أخطاء" : ""})`;

/* ---------- أدوات المعلم والمدير ---------- */
const STAFF_TOOLS: Tool[] = [
  // الحصص والحضور
  { ok: staff, spec: T("add_lesson", "إضافة حصة إضافية لحلقة", P({ halqa: S("اسم الحلقة"), date: S("YYYY-MM-DD"), time: S("HH:MM بنظام 24 ساعة"), link: S("رابط الحصة (اختياري)"), note: S("ملاحظة") }, ["date"])),
    build: (a, c) => { const h = halqaOf(c, a.halqa); if (!isDay(a.date)) throw new Error("تاريخ غير صالح"); const tm = isTime(a.time) ? hhmm(a.time) : h.time; return { summary: `➕ حصة إضافية لـ${h.name}: ${wd(a.date)} ${a.date} ${tm ? t12(tm) : ""}${a.note ? " — " + a.note : ""}`, t: "lesson.save", payload: { data: { halqaId: h.id, date: a.date, time: tm, link: str(a.link, 600), note: str(a.note, 200) } } }; } },
  { ok: staff, spec: T("edit_lesson", "تعديل حصة موجودة: تغيير وقتها أو تاريخها أو رابطها أو ملاحظتها، أو تكليف معلم احتياط (للمدير)", P({ halqa: S("اسم الحلقة"), date: S("تاريخ الحصة الحالي YYYY-MM-DD"), new_date: S("التاريخ الجديد"), new_time: S("الوقت الجديد HH:MM"), link: S("الرابط"), note: S("ملاحظة"), substitute_teacher: S("اسم المعلم الاحتياط، أو «بدون» لإلغائه") }, ["date"])),
    build: (a, c, u) => {
      const h = halqaOf(c, a.halqa, { date: a.date }); const l = lessonOf(c, h, a.date);
      const date = isDay(a.new_date) ? a.new_date : l.date, time = isTime(a.new_time) ? hhmm(a.new_time) : l.time;
      const data: any = { date, time, link: a.link !== undefined ? str(a.link, 600) : l.link, note: a.note !== undefined ? str(a.note, 200) : l.note };
      let subTxt = "";
      if (a.substitute_teacher !== undefined && isAdm(u)) { if (/^(بدون|لا|لا يوجد|none)$/i.test(norm(a.substitute_teacher))) { data.subId = ""; subTxt = " · إلغاء الاحتياط"; } else { const t = one(c.teachers, a.substitute_teacher, "المعلم"); data.subId = t.id; subTxt = " · احتياط: " + t.name; } }
      return { summary: `✎ تعديل حصة ${h.name} (${l.date}): ${wd(date)} ${date} ${time ? t12(time) : ""}${subTxt}${a.note ? " — " + a.note : ""}`, t: "lesson.save", payload: { id: l.id, data } };
    } },
  { ok: staff, spec: T("cancel_lesson", "إلغاء حصة حلقة في تاريخ معيّن", P({ halqa: S("اسم الحلقة"), date: S("YYYY-MM-DD"), note: S("سبب الإلغاء") }, ["date"])),
    build: (a, c) => { const h = halqaOf(c, a.halqa, { date: a.date }); const l = lessonOf(c, h, a.date); return { summary: `✖ إلغاء حصة ${h.name}: ${wd(a.date)} ${a.date}${a.note ? " — " + a.note : ""}`, t: "lesson.cancel", payload: { id: l.id, v: true, note: str(a.note, 200) } }; } },
  { ok: staff, spec: T("restore_lesson", "إرجاع حصة ملغاة", P({ halqa: S("اسم الحلقة"), date: S("YYYY-MM-DD") }, ["date"])),
    build: (a, c) => { const h = halqaOf(c, a.halqa, { date: a.date, cancelled: true }); const l = lessonOf(c, h, a.date, true); return { summary: `↺ إرجاع حصة ${h.name}: ${wd(a.date)} ${a.date}`, t: "lesson.cancel", payload: { id: l.id, v: false } }; } },
  { ok: staff, spec: T("take_attendance", "تحضير الطلاب في حصة: حاضر/متأخر/غائب/مستأذن. others = حالة باقي طلاب الحلقة اللي ما انذكروا", P({ halqa: S("اسم الحلقة"), date: S("YYYY-MM-DD، الافتراضي اليوم"), present: SA("الحاضرين، أو [\"الكل\"]"), late: SA("المتأخرين"), absent: SA("الغائبين"), excused: SA("المستأذنين"), others: { type: "string", enum: ["present", "absent", "none"], description: "حالة الباقين" } })),
    build: (a, c) => {
      const date = isDay(a.date) ? a.date : localDate(); const h = halqaOf(c, a.halqa, { date, names: [a.present, a.absent, a.late, a.excused].map((x) => (Array.isArray(x) ? x : x ? [x] : [])) }); const l = lessonOf(c, h, date);
      const hs = c.studs.filter((x) => x.halqaId === h.id); const map: Record<string, string> = {};
      const put = (names: unknown, v: string) => { if (names && (!Array.isArray(names) || names.length)) for (const x of many(hs, names)) map[x.id] = v; };
      put(a.present, "p"); put(a.late, "l"); put(a.absent, "a"); put(a.excused, "e");
      if (a.others === "present" || a.others === "absent") for (const x of hs) if (!map[x.id]) map[x.id] = a.others === "present" ? "p" : "a";
      if (!Object.keys(map).length) throw new Error("حدد مين حاضر ومين غائب");
      const grp = (v: string) => hs.filter((x) => map[x.id] === v);
      const parts = ["p", "l", "a", "e"].map((v) => { const g = grp(v); return g.length ? `${ATT_AR[v]} ${g.length}${v !== "p" && g.length <= 6 ? " (" + g.map((x) => x.name.split(" ")[0]).join("، ") + ")" : ""}` : ""; }).filter(Boolean);
      return { summary: `✅ تحضير ${h.name} — ${wd(date)} ${date}: ${parts.join(" · ")}${c.waOn && grp("a").length ? " · بتروح رسالة غياب لأولياء الأمور تلقائيًا" : ""}`, t: "lesson.att", payload: { id: l.id, map } };
    } },
  // التسميع
  { ok: staff, spec: T("record_recitation", "تسجيل تسميع طالب (حفظ/مراجعة/تثبيت). التقدير إما grade جاهز أو عدد الأخطاء والتنبيهات", P({
      student: S("اسم الطالب"), date: S("YYYY-MM-DD، الافتراضي اليوم"), note: S("ملاحظة المعلم"),
      items: { type: "array", description: "المقاطع المسمّعة", items: P({ type: { type: "string", enum: ["new", "review", "tath"], description: "new حفظ، review مراجعة، tath تثبيت" }, surah: S("اسم السورة أو رقمها"), from: N("من آية"), to: N("إلى آية"), full: B("السورة كاملة"), grade: { type: "string", enum: GRADES, description: "التقدير" }, mistakes: N("عدد الأخطاء"), alerts: N("عدد التنبيهات") }, ["surah"]) },
    }, ["student", "items"])),
    build: (a, c) => {
      const st = one(c.studs, a.student, "الطالب"); const date = isDay(a.date) ? a.date : localDate();
      const its = (Array.isArray(a.items) ? a.items : []).slice(0, 10).map((x: any) => {
        const surah = surahOf(x.surah); const full = !!x.full || (!x.from && !x.to);
        const from = full ? 1 : Number(x.from) || 1, to = full ? AYAS[surah - 1] : Number(x.to) || from;
        if (!validRange(surah, from, to)) throw new Error(`آيات ${SN[surah - 1]} غير صحيحة (عددها ${AYAS[surah - 1]})`);
        const type = ["new", "review", "tath"].includes(x.type) ? x.type : "new";
        const g = GRADES.includes(x.grade) ? x.grade : "";
        return { type, surah, from, to, full: from === 1 && to === AYAS[surah - 1], ...(g ? { quickGrade: g } : { mistakes: Math.max(0, Number(x.mistakes) || 0), alerts: Math.max(0, Number(x.alerts) || 0) }), _g: g };
      });
      if (!its.length) throw new Error("حدد المقطع");
      const l = c.lessons.find((x) => x.halqaId === st.halqaId && x.date === date && !x.cancelled);
      const txt = its.map((x: any) => `${TYPE[x.type]} ${SN[x.surah - 1]} ${x.full ? "كاملة" : x.from + "-" + x.to} (${x._g || (x.mistakes ? x.mistakes + " أخطاء" : "بدون أخطاء")})`).join("، ");
      return { summary: `📖 تسميع ${st.name} — ${date}: ${txt}${a.note ? " — " + a.note : ""}`, t: "rec.addMany", payload: { uid: st.id, ...(l ? { lessonId: l.id } : { date }), note: str(a.note, 300), items: its.map(({ _g, ...x }: any) => x) } };
    } },
  { ok: staff, spec: T("edit_recitation", "تعديل تسميع مسجّل (آخر 30 يوم): التقدير أو الأخطاء أو الآيات أو الملاحظة", P({ student: S("اسم الطالب"), date: S("تاريخ التسميع"), surah: S("السورة"), grade: { type: "string", enum: GRADES }, mistakes: N("الأخطاء"), alerts: N("التنبيهات"), from: N("من آية"), to: N("إلى آية"), type: { type: "string", enum: ["new", "review", "tath"] }, note: S("ملاحظة") }, ["student"])),
    build: (a, c) => {
      const st = one(c.studs, a.student, "الطالب"); const sn = a.surah ? surahOf(a.surah) : 0;
      const r = c.recs.find((x) => x.userId === st.id && (!isDay(a.date) || x.date === a.date) && (!sn || x.surah === sn));
      if (!r) throw new Error("ما لقيت هالتسميع");
      const quick = GRADES.includes(a.grade) ? a.grade : a.mistakes !== undefined || a.alerts !== undefined ? "" : r.quick ? r.grade : "";
      const data: any = { type: a.type || r.type, surah: r.surah, from: Number(a.from) || r.fromA, to: Number(a.to) || r.toA, note: a.note !== undefined ? str(a.note, 300) : r.note, date: r.date, ...(quick ? { quickGrade: quick } : { mistakes: a.mistakes !== undefined ? Number(a.mistakes) : r.mistakes, alerts: a.alerts !== undefined ? Number(a.alerts) : r.alerts }) };
      return { summary: `✎ تعديل تسميع ${st.name} (${r.date} ${SN[r.surah - 1]}): ${quick || (data.mistakes + " أخطاء")} · ${data.from}-${data.to}`, t: "rec.update", payload: { id: r.id, data } };
    } },
  // الخطط والأهداف
  { ok: planner, spec: T("set_plan_amounts", "تحديد مقادير الخطة التلقائية لطالب أو أكثر (بالأوجه: 0.25 ربع، 0.5 نصف)", P({ students: SA("أسماء الطلاب أو [\"الكل\"]"), new_pages: N("الحفظ"), review_pages: N("المراجعة"), tath_pages: N("التثبيت") }, ["students"])),
    build: (a, c) => { const ss = many(c.studs, a.students); const t = { name: "من المساعد", newAmt: Number(a.new_pages) || 0, revAmt: Number(a.review_pages) || 0, tathAmt: Number(a.tath_pages) || 0 }; const man = ss.filter((x) => planOf(x).mode !== "auto"); return { summary: `🗓 خطة تلقائية لـ ${ss.length === 1 ? ss[0].name : ss.length + " طلاب"}: حفظ ${fmtPg(t.newAmt)} · مراجعة ${fmtPg(t.revAmt)} · تثبيت ${fmtPg(t.tathAmt)} وجه${man.length ? ` (تنبيه: ${man.length} خطتهم الحين يدوية وبتتحول تلقائية)` : ""}`, t: "plan.applyTpl", payload: { tpl: t, ids: ss.map((x) => x.id) } }; } },
  { ok: planner, spec: T("set_manual_plan", "تحديد المطلوب من طالب يدويًا (مقطع الحفظ و/أو المراجعة و/أو التثبيت)", P({ student: S("اسم الطالب"),
      new: P({ surah: S("السورة"), from: N("من آية"), to_surah: S("إلى سورة (إذا يمتد)"), to: N("إلى آية") }), review: P({ surah: S("السورة"), from: N("من آية"), to_surah: S("إلى سورة"), to: N("إلى آية") }), tath: P({ surah: S("السورة"), from: N("من آية"), to_surah: S("إلى سورة"), to: N("إلى آية") }) }, ["student"])),
    build: (a, c) => {
      const st = one(c.studs, a.student, "الطالب"); const old = planOf(st); const manual: any = { ...old.manual }; const parts: string[] = [];
      for (const k of ["new", "review", "tath"]) { const m = a[k]; if (!m || !m.surah) continue; const s = surahOf(m.surah), ts = m.to_surah ? surahOf(m.to_surah) : s; const v = { surah: s, from: Number(m.from) || 1, toSurah: ts, to: Number(m.to) || AYAS[ts - 1] }; manual[k] = v; parts.push(`${TYPE[k]}: ${seg(v)}`); }
      if (!parts.length) throw new Error("حدد المقطع");
      return { summary: `🗓 خطة يدوية لـ${st.name}: ${parts.join(" · ")}`, t: "plan.save", payload: { id: st.id, mode: "manual", manual, near: old.near, paused: old.paused } };
    } },
  { ok: planner, spec: T("pause_plan", "إيقاف خطة طالب أو أكثر مؤقتًا (سفر، مرض...) أو استئنافها", P({ students: SA("الأسماء أو [\"الكل\"]"), resume: B("true للاستئناف"), from: S("من تاريخ YYYY-MM-DD"), to: S("إلى تاريخ (اختياري)"), reason: S("السبب") }, ["students"])),
    build: (a, c) => many(c.studs, a.students).map((st) => a.resume ? { summary: `▶ استئناف خطة ${st.name}`, t: "plan.pause", payload: { id: st.id, paused: null } } : { summary: `⏸ إيقاف خطة ${st.name} من ${isDay(a.from) ? a.from : localDate()}${isDay(a.to) ? " إلى " + a.to : ""}${a.reason ? " — " + a.reason : ""}`, t: "plan.pause", payload: { id: st.id, paused: { from: isDay(a.from) ? a.from : localDate(), to: isDay(a.to) ? a.to : "", reason: str(a.reason, 100) } } }) },
  { ok: planner, spec: T("set_goal", "تحديد هدف حفظ لطالب (عدد أوجه قبل تاريخ)", P({ student: S("اسم الطالب"), pages: N("عدد الأوجه، 0 لإلغاء الهدف"), by: S("قبل تاريخ YYYY-MM-DD"), note: S("ملاحظة") }, ["student", "pages"])),
    build: (a, c) => { const st = one(c.studs, a.student, "الطالب"); const pg = Number(a.pages) || 0; return { summary: pg ? `🎯 هدف ${st.name}: ${pg} وجه${isDay(a.by) ? " قبل " + a.by : ""}` : `🎯 إلغاء هدف ${st.name}`, t: "goal.save", payload: { id: st.id, goal: pg ? { pages: pg, from: localDate(), by: isDay(a.by) ? a.by : "", note: str(a.note, 120) } : null } }; } },
  // التواصل
  { ok: (u) => u.role === "teacher" || perm("anns")(u), spec: T("post_announcement", "نشر إعلان للطلاب وأولياء الأمور", P({ title: S("العنوان"), body: S("النص"), halqa: S("اسم الحلقة، أو فارغ لكل الحلقات (للمدير)") }, ["title"])),
    build: (a, c, u) => { const h = a.halqa ? halqaOf(c, a.halqa) : (isAdm(u) ? null : halqaOf(c, "")); return { summary: `📣 إعلان ${h ? "لـ" + h.name : "لكل الحلقات"}: ${a.title}${a.body ? " — " + String(a.body).slice(0, 140) : ""}`, t: "ann.save", payload: { title: str(a.title, 120), body: str(a.body, 2000), halqaId: h ? h.id : "" } }; } },
  { ok: staff, spec: T("create_poll", "تصويت للطلاب وأولياء الأمور", P({ question: S("السؤال"), options: SA("الخيارات"), halqa: S("اسم الحلقة، أو فارغ للكل (للمدير)"), multi: B("يقدر يختار أكثر من خيار") }, ["question", "options"])),
    build: (a, c, u) => { const h = a.halqa ? halqaOf(c, a.halqa) : (isAdm(u) && !c.sc ? null : halqaOf(c, "")); const opts = (Array.isArray(a.options) ? a.options : []).map(String).filter(Boolean); if (opts.length < 2) throw new Error("يحتاج خيارين"); return { summary: `🗳 تصويت ${h ? "لـ" + h.name : "لكل الحلقات"}: ${a.question} (${opts.join(" / ")})`, t: "poll.save", payload: { question: a.question, options: opts, halqaId: h ? h.id : "", multi: !!a.multi } }; } },
  { ok: staff, spec: T("close_poll", "قفل تصويت مفتوح", P({ question: S("سؤال التصويت أو جزء منه") }, ["question"])),
    build: (a, c) => { const p = one(c.polls.map((x) => ({ ...x, name: x.question })), a.question, "التصويت"); return { summary: `🔒 قفل التصويت: ${p.question}`, t: "poll.close", payload: { id: p.id } }; } },
  { ok: staff, spec: T("message_students", "رسالة داخل الموقع لطلاب وأولياء أمورهم (تظهر في صفحة الرسائل)", P({ students: SA("الأسماء أو [\"الكل\"]"), text: S("نص الرسالة") }, ["students", "text"])),
    build: (a, c) => { const ss = many(c.studs, a.students); return { summary: `✉ رسالة داخل الموقع لـ ${ss.length === 1 ? ss[0].name : ss.length + " طلاب"}: ${String(a.text).slice(0, 140)}`, t: "dm.bulk", payload: { studentIds: ss.map((x) => x.id), text: a.text } }; } },
  { ok: staff, spec: T("whatsapp_parents", "رسالة واتساب لأولياء أمور طلاب من رقم الحلقة المربوط. تقدر تكتب {الطالب} و{الحلقة} و{التاريخ} وتنعبّى لكل واحد", P({ students: SA("الأسماء أو [\"الكل\"]"), text: S("نص الرسالة") }, ["students", "text"])),
    build: (a, c) => {
      if (!c.waOn) throw new Error("ربط الواتساب متوقف، فعّله من صفحة «رسائل الواتساب»");
      const ss = many(c.studs, a.students); const ok = ss.filter((x) => ((x.info as any) || {}).parentPhone); const no = ss.length - ok.length;
      if (!ok.length) throw new Error("ما فيه أرقام أولياء أمور للطلاب المختارين");
      const hn = (id: string | null) => c.halaqat.find((h) => h.id === id)?.name || "";
      const items = ok.map((x) => ({ studentId: x.id, text: fillVars(str(a.text, 3000), { student: x.name, halqa: hn(x.halqaId), date: localDate() }) }));
      return { summary: `🟢 واتساب لأولياء أمور ${ok.length === 1 ? ok[0].name : ok.length + " طلاب"}${no ? ` (${no} بدون رقم)` : ""}: ${items[0].text.slice(0, 160)}`, t: "wa.bulk", payload: { items } };
    } },
  { ok: staff, spec: T("send_weekly_report", "إرسال التقرير الأسبوعي الآن لأولياء الأمور بالواتساب (لحلقة، أو لكل الحلقات للمدير الكامل)", P({ halqa: S("اسم الحلقة، أو فارغ للكل") })),
    build: (a, c, u) => { if (!c.waOn) throw new Error("ربط الواتساب متوقف"); const h = a.halqa || !full(u) ? halqaOf(c, a.halqa) : null; return { summary: `📊 التقرير الأسبوعي بالواتساب ${h ? "لأولياء أمور " + h.name : "لكل الحلقات"}`, t: "wa.weekNow", payload: { halqaId: h ? h.id : "" } }; } },
  { ok: staff, spec: T("teachers_room_message", "رسالة في غرفة المعلمين", P({ text: S("النص") }, ["text"])),
    build: (a) => ({ summary: `💬 غرفة المعلمين: ${String(a.text).slice(0, 160)}`, t: "msg.send", payload: { text: str(a.text, 1000) } }) },
  { ok: staff, spec: T("add_behavior", "تسجيل ملاحظة سلوك لطالب", P({ student: S("اسم الطالب"), kind: { type: "string", enum: ["good", "bad"] }, text: S("الملاحظة"), visible: B("يشوفها ولي الأمر") }, ["student", "text"])),
    build: (a, c) => { const st = one(c.studs, a.student, "الطالب"); return { summary: `${a.kind === "bad" ? "⚠ تنبيه" : "⭐ ملاحظة إيجابية"} لـ${st.name}: ${a.text}${a.visible === false ? " (للمعلمين فقط)" : ""}`, t: "behav.add", payload: { userId: st.id, kind: a.kind === "bad" ? "bad" : "good", text: a.text, visible: a.visible !== false } }; } },

  // الإدارة
  { ok: perm("req"), spec: T("approve_request", "اعتماد طلب تسجيل طالب جديد وتحديد حلقته", P({ student: S("اسم صاحب الطلب أو [\"الكل\"] لاعتماد الكل على حلقاتهم المطلوبة"), halqa: S("الحلقة (اختياري إذا اختارها الطالب)") }, ["student"])),
    build: (a, c) => { const list = ALL_RE.test(String(a.student || "").trim()) ? c.pending : [one(c.pending, a.student, "الطلب")]; if (!list.length) throw new Error("ما فيه طلبات"); return list.map((p: any) => { const h = a.halqa ? halqaOf(c, a.halqa) : c.halaqat.find((x) => x.id === p.reqHalqaId); if (!h) throw new Error(`حدد حلقة ${p.name}`); return { summary: `✔ اعتماد ${p.name} في ${h.name}`, t: "user.approve", payload: { id: p.id, halqaId: h.id } }; }); } },
  { ok: perm("students"), spec: T("add_student", "إضافة طالب جديد مباشرة (بدون طلب تسجيل)", P({ name: S("الاسم"), halqa: S("الحلقة"), username: S("اسم الدخول بالإنجليزي (اختياري، ينولد تلقائي)"), password: S("كلمة المرور (اختياري، تنولد تلقائي)"), parent_name: S("اسم ولي الأمر"), parent_phone: S("جوال ولي الأمر") }, ["name", "halqa"])),
    build: async (a, c) => { const h = halqaOf(c, a.halqa); const un = await checkUsername(a.username, "s"); const pw = str(a.password, 60).length >= 4 ? str(a.password, 60) : rnd(100000, 999999); const info: any = {}; if (a.parent_name) info.parentName = str(a.parent_name, 120); if (a.parent_phone) info.parentPhone = str(a.parent_phone, 30); return { summary: `👤 طالب جديد: ${a.name} في ${h.name} · اسم الدخول: ${un} · كلمة المرور: ${pw}${info.parentPhone ? " · ولي الأمر " + info.parentPhone : ""}`, t: "student.save", payload: { data: { name: str(a.name, 120), username: un, password: pw, halqaId: h.id, status: "active", info } } }; } },
  { ok: perm("students"), spec: T("edit_student", "تعديل بيانات طالب: الاسم، الحلقة (نقل)، الحالة (نشط/موقوف/مؤرشف)، ولي الأمر، كلمة المرور", P({ student: S("اسم الطالب الحالي"), name: S("الاسم الجديد"), halqa: S("نقله لحلقة"), status: { type: "string", enum: ["active", "disabled", "archived"] }, parent_name: S("اسم ولي الأمر"), parent_phone: S("جوال ولي الأمر"), password: S("كلمة مرور جديدة") }, ["student"])),
    build: (a, c) => {
      const st = one(c.allStuds, a.student, "الطالب"); const h = a.halqa ? halqaOf(c, a.halqa) : null; const info: any = { ...((st.info as any) || {}) };
      if (a.parent_name !== undefined) info.parentName = str(a.parent_name, 120); if (a.parent_phone !== undefined) info.parentPhone = str(a.parent_phone, 30);
      const ch = [a.name && "الاسم: " + a.name, h && "الحلقة: " + h.name, a.status && "الحالة: " + ({ active: "نشط", disabled: "موقوف", archived: "مؤرشف" } as any)[a.status], a.parent_phone !== undefined && "جوال ولي الأمر: " + a.parent_phone, a.parent_name !== undefined && "ولي الأمر: " + a.parent_name, a.password && "كلمة مرور جديدة: " + a.password].filter(Boolean);
      if (!ch.length) throw new Error("وش التعديل المطلوب؟");
      return { summary: `✎ تعديل ${st.name}: ${ch.join(" · ")}`, t: "student.save", payload: { id: st.id, data: { name: str(a.name, 120) || st.name, username: st.username, halqaId: h ? h.id : st.halqaId, status: a.status || st.status, info, ...(a.password ? { password: str(a.password, 60) } : {}) } } };
    } },
  { ok: perm("students"), spec: T("move_students", "نقل طالب أو أكثر لحلقة ثانية", P({ students: SA("الأسماء"), halqa: S("الحلقة الجديدة") }, ["students", "halqa"])),
    build: (a, c) => { const h = halqaOf(c, a.halqa); const ss = many(c.studs, a.students).filter((x) => x.halqaId !== h.id); if (!ss.length) throw new Error("الطلاب أصلًا في هالحلقة"); return { summary: `⇄ نقل ${ss.length === 1 ? ss[0].name : ss.length + " طلاب"} إلى ${h.name}`, t: "students.assign", payload: { map: Object.fromEntries(ss.map((x) => [x.id, h.id])) } }; } },
  { ok: perm("teachers"), spec: T("add_teacher", "إضافة معلم", P({ name: S("الاسم"), username: S("اسم الدخول بالإنجليزي (اختياري)"), password: S("كلمة المرور (اختياري)"), phone: S("الجوال"), can_plan: B("يقدر يعدّل الخطط"), can_auto: B("يقدر يشغّل الحصص التلقائية") }, ["name"])),
    build: async (a) => { const un = await checkUsername(a.username, "t"); const pw = str(a.password, 60).length >= 4 ? str(a.password, 60) : rnd(100000, 999999); return { summary: `👤 معلم جديد: ${a.name} · اسم الدخول: ${un} · كلمة المرور: ${pw}${a.can_plan ? " · يعدّل الخطط" : ""}`, t: "teacher.save", payload: { data: { name: str(a.name, 120), username: un, password: pw, phone: str(a.phone, 30), canPlan: !!a.can_plan, canAuto: !!a.can_auto } } }; } },
  { ok: perm("teachers"), spec: T("edit_teacher", "تعديل معلم: الاسم، الجوال، صلاحية الخطط، الحالة (نشط/موقوف)، كلمة المرور", P({ teacher: S("اسم المعلم"), name: S("الاسم الجديد"), phone: S("الجوال"), can_plan: B("يعدّل الخطط"), can_auto: B("الحصص التلقائية"), status: { type: "string", enum: ["active", "disabled"] }, password: S("كلمة مرور جديدة") }, ["teacher"])),
    build: (a, c) => { const t = one(c.teachers, a.teacher, "المعلم"); const inf: any = t.info || {}; const data = { name: str(a.name, 120) || t.name, username: t.username, phone: a.phone !== undefined ? str(a.phone, 30) : inf.phone || "", canPlan: a.can_plan !== undefined ? !!a.can_plan : t.canPlan, canAuto: a.can_auto !== undefined ? !!a.can_auto : t.canAuto, status: a.status || t.status, ...(a.password ? { password: str(a.password, 60) } : {}) }; const ch = [a.name && "الاسم: " + a.name, a.phone !== undefined && "الجوال: " + a.phone, a.can_plan !== undefined && (a.can_plan ? "يعدّل الخطط" : "بدون تعديل الخطط"), a.can_auto !== undefined && (a.can_auto ? "الحصص التلقائية" : "بدون الحصص التلقائية"), a.status && (a.status === "active" ? "تفعيل" : "إيقاف"), a.password && "كلمة مرور جديدة: " + a.password].filter(Boolean); if (!ch.length) throw new Error("وش التعديل المطلوب؟"); return { summary: `✎ تعديل المعلم ${t.name}: ${ch.join(" · ")}`, t: "teacher.save", payload: { id: t.id, data } }; } },
  { ok: perm("halaqat"), spec: T("add_halqa", "إنشاء حلقة جديدة", P({ name: S("اسم الحلقة"), days: SA("أيام الحلقة بالعربي"), time: S("الوقت HH:MM"), teacher: S("اسم المعلم"), link: S("رابط الحصة"), branch: S("الفرع أو المسجد"), auto: B("تنشأ حصصها تلقائيًا") }, ["name", "days"])),
    build: (a, c) => { const days = (Array.isArray(a.days) ? a.days : []).map(dayIdx); if (!days.length) throw new Error("حدد الأيام"); const t = a.teacher ? one(c.teachers, a.teacher, "المعلم") : null; const time = isTime(a.time) ? hhmm(a.time) : ""; return { summary: `🟢 حلقة جديدة «${a.name}» · ${days.map((d: number) => DAYS[d]).join("، ")}${time ? " " + time : ""}${t ? " · المعلم " + t.name : ""}${a.auto ? " · حصص تلقائية" : ""}`, t: "halqa.save", payload: { data: { name: str(a.name, 80), days, time, teacherId: t ? t.id : "", link: str(a.link, 600), branch: str(a.branch, 60), auto: !!a.auto } } }; } },
  { ok: perm("halaqat"), spec: T("edit_halqa", "تعديل حلقة: الاسم، الأيام، الوقت، المعلم، الرابط، الفرع، الحصص التلقائية", P({ halqa: S("اسم الحلقة الحالي"), name: S("الاسم الجديد"), days: SA("الأيام"), time: S("HH:MM"), teacher: S("اسم المعلم أو «بدون»"), link: S("الرابط"), branch: S("الفرع"), auto: B("حصص تلقائية") }, ["halqa"])),
    build: (a, c) => {
      const h = halqaOf(c, a.halqa); let teacherId = h.teacherId || ""; let tTxt = "";
      if (a.teacher !== undefined) { if (/^(بدون|لا|none)$/i.test(norm(a.teacher))) { teacherId = ""; tTxt = "بدون معلم"; } else { const t = one(c.teachers, a.teacher, "المعلم"); teacherId = t.id; tTxt = "المعلم " + t.name; } }
      const days = Array.isArray(a.days) && a.days.length ? a.days.map(dayIdx) : h.days;
      const data = { name: str(a.name, 80) || h.name, days, time: isTime(a.time) ? hhmm(a.time) : h.time, teacherId, link: a.link !== undefined ? str(a.link, 600) : h.link, branch: a.branch !== undefined ? str(a.branch, 60) : (h as any).branch || "", auto: a.auto !== undefined ? !!a.auto : h.auto };
      const ch = [a.name && "الاسم: " + a.name, Array.isArray(a.days) && a.days.length && "الأيام: " + days.map((d: number) => DAYS[d]).join("، "), isTime(a.time) && "الوقت: " + t12(data.time) + (data.time !== h.time ? " (والحصص الجاية تتعدل معها)" : ""), tTxt, a.link !== undefined && "الرابط", a.branch !== undefined && "الفرع: " + a.branch, a.auto !== undefined && (a.auto ? "حصص تلقائية" : "بدون حصص تلقائية")].filter(Boolean);
      if (!ch.length) throw new Error("وش التعديل المطلوب؟");
      return { summary: `✎ تعديل ${h.name}: ${ch.join(" · ")}`, t: "halqa.save", payload: { id: h.id, data } };
    } },
  { ok: staff, spec: T("set_lessons_time", "تغيير وقت حصص يوم معيّن أو فترة (مثل حصص اليوم أو بكرة أو هالأسبوع) لكل الحلقات أو حلقات محددة، بدون ما يتغير وقت الحلقة الدائم", P({ date: S("اليوم YYYY-MM-DD، الافتراضي اليوم"), to_date: S("إلى تاريخ (اختياري للفترة)"), halaqat: SA("أسماء الحلقات أو [\"الكل\"] (الافتراضي الكل)"), time: S("الوقت الجديد HH:MM بنظام 24 ساعة") }, ["time"])),
    build: (a, c) => {
      if (!isTime(a.time)) throw new Error("حدد الوقت"); const time = hhmm(a.time);
      const from = isDay(a.date) ? a.date : localDate(), to = isDay(a.to_date) && a.to_date >= from ? a.to_date : from;
      const hs = Array.isArray(a.halaqat) && a.halaqat.length ? many(c.halaqat, a.halaqat) : c.halaqat; const hset = new Set(hs.map((h) => h.id));
      const ls = c.lessons.filter((l) => hset.has(l.halqaId) && l.date >= from && l.date <= to && !l.cancelled);
      if (!ls.length) throw new Error(`ما فيه حصص ${from === to ? "يوم " + wd(from) + " " + from : "من " + from + " إلى " + to}`);
      const hn = (id: string) => c.halaqat.find((h) => h.id === id)?.name || "";
      return { summary: `🕒 ${from === to ? (from === localDate() ? "حصص اليوم" : "حصص " + wd(from) + " " + from) : `الحصص من ${from} إلى ${to}`} (${ls.length}: ${[...new Set(ls.map((l) => hn(l.halqaId)))].join("، ")}) تبدأ ${t12(time)}`, t: "lessons.time", payload: { ids: ls.map((l) => l.id), time } };
    } },
  { ok: perm("halaqat"), spec: T("set_halaqat_time", "تغيير وقت بداية حلقة أو أكثر (أو كل الحلقات)، وكل الحصص الجاية تتعدل معها مباشرة", P({ halaqat: SA("أسماء الحلقات أو [\"الكل\"]"), time: S("الوقت الجديد HH:MM بنظام 24 ساعة") }, ["halaqat", "time"])),
    build: (a, c) => { if (!isTime(a.time)) throw new Error("حدد الوقت"); const time = hhmm(a.time); const hs = many(c.halaqat, a.halaqat); const ch = hs.filter((h) => h.time !== time); return { summary: `🕒 وقت ${ch.length === c.halaqat.length && ch.length > 1 ? "كل الحلقات" : hs.map((h) => h.name).join("، ")} يصير ${t12(time)}، والحصص الجاية تتعدل معها`, t: "halqa.time", payload: { ids: hs.map((h) => h.id), time } }; } },
  { ok: perm("settings"), spec: T("add_event", "إضافة اختبار أو مناسبة في تقويم الطلاب", P({ name: S("الاسم"), date: S("YYYY-MM-DD ميلادي"), kind: { type: "string", enum: ["exam", "event"] } }, ["name", "date"])),
    build: (a) => { if (!isDay(a.date)) throw new Error("تاريخ غير صالح"); return { summary: `🗓 ${a.kind === "exam" ? "اختبار" : "مناسبة"}: «${a.name}» — ${wd(a.date)} ${a.date} (${hj(a.date)})`, t: "events.add", payload: { name: a.name, date: a.date, kind: a.kind === "exam" ? "exam" : "event" } }; } },
  { ok: perm("settings"), spec: T("add_holiday", "إضافة إجازة (ما تنعقد فيها حصص)", P({ name: S("الاسم"), from: S("YYYY-MM-DD"), to: S("YYYY-MM-DD") }, ["name", "from"])),
    build: (a) => { if (!isDay(a.from)) throw new Error("تاريخ غير صالح"); const to = isDay(a.to) ? a.to : a.from; return { summary: `🏖 إجازة: «${a.name}» من ${a.from} (${hj(a.from)})${to !== a.from ? ` إلى ${to}` : ""}`, t: "holidays.add", payload: { name: a.name, from: a.from, to } }; } },
  { ok: perm("settings"), spec: T("update_settings", "تعديل إعدادات عامة: اسم الموقع، أيام الدوام، تنبيه الغياب، وقت التسميع، لوحة الشرف، سلّم التقدير، جهة التواصل", P({ center: S("اسم الحلقات"), work_days: SA("أيام الدوام الافتراضية"), absent_alert: N("تنبيه بعد كم غياب متتالي"), rec_minutes: N("دقائق التسميع لكل طالب، 0 بدون"), board: { type: "string", enum: ["show", "top3", "hide"], description: "لوحة الشرف" }, excellent_max: N("ممتاز إذا الأخطاء حتى"), very_good_max: N("جيد جدًا حتى"), good_max: N("جيد حتى"), support_name: S("جهة التواصل"), support_phone: S("رقم التواصل") })),
    build: (a, c) => {
      const cur: any = c.settings; const d: any = { ...cur, grade: { ...cur.grade }, tpl: cur.tpl }; const ch: string[] = [];
      if (a.center) { d.center = str(a.center, 80); ch.push("الاسم: " + d.center); }
      if (Array.isArray(a.work_days) && a.work_days.length) { d.days = a.work_days.map(dayIdx); ch.push("الدوام: " + d.days.map((x: number) => DAYS[x]).join("، ")); }
      if (a.absent_alert !== undefined) { d.absentAlert = Number(a.absent_alert); ch.push("تنبيه الغياب بعد " + d.absentAlert); }
      if (a.rec_minutes !== undefined) { d.recMin = Number(a.rec_minutes); ch.push("وقت التسميع " + d.recMin + " د"); }
      if (a.board) { d.board = a.board; ch.push("لوحة الشرف: " + ({ show: "أفضل 5", top3: "أفضل 3", hide: "مخفية" } as any)[a.board]); }
      if (a.excellent_max !== undefined) d.grade.ex = Number(a.excellent_max); if (a.very_good_max !== undefined) d.grade.vg = Number(a.very_good_max); if (a.good_max !== undefined) d.grade.gd = Number(a.good_max);
      if ([a.excellent_max, a.very_good_max, a.good_max].some((x) => x !== undefined)) ch.push(`التقدير: ممتاز ≤${d.grade.ex} · جيد جدًا ≤${d.grade.vg} · جيد ≤${d.grade.gd}`);
      if (a.support_name !== undefined) { d.supportName = str(a.support_name, 60); ch.push("جهة التواصل: " + d.supportName); }
      if (a.support_phone !== undefined) { d.supportPhone = str(a.support_phone, 20); ch.push("رقم التواصل: " + d.supportPhone); }
      if (!ch.length) throw new Error("وش الإعداد المطلوب؟");
      return { summary: `⚙ الإعدادات: ${ch.join(" · ")}`, t: "settings.save", payload: { data: d } };
    } },
  { ok: (u) => perm("students")(u) || perm("teachers")(u), spec: T("reset_password", "كلمة مرور مؤقتة جديدة لطالب أو معلم نسي كلمته", P({ person: S("اسم الطالب أو المعلم") }, ["person"])),
    build: (a, c) => { const p = one([...c.allStuds, ...c.teachers], a.person, "الاسم"); return { summary: `🔑 كلمة مرور مؤقتة لـ${p.name} (تطلع لك بعد التنفيذ)`, t: "user.resetpw", payload: { id: p.id } }; } },
  { ok: full, spec: T("add_supervisor", "إضافة مشرف إداري بصلاحيات محددة", P({ name: S("الاسم"), username: S("اسم الدخول بالإنجليزي"), password: S("كلمة المرور (6 على الأقل، اختياري)"), perms: { type: "array", items: { type: "string", enum: Object.keys(PERM_AR) }, description: "الأقسام" }, halaqat: SA("يقتصر على هالحلقات (اختياري)") }, ["name", "perms"])),
    build: async (a, c) => { const un = await checkUsername(a.username, "m"); const pw = str(a.password, 60).length >= 6 ? str(a.password, 60) : rnd(10000000, 99999999); const ps = (Array.isArray(a.perms) ? a.perms : []).filter((x: string) => PERM_AR[x]); if (!ps.length) throw new Error("حدد الصلاحيات"); const hs = Array.isArray(a.halaqat) && a.halaqat.length ? many(c.halaqat, a.halaqat) : []; return { summary: `🛡 مشرف جديد: ${a.name} · ${ps.map((x: string) => PERM_AR[x]).join("، ")}${hs.length ? " · حلقات: " + hs.map((h) => h.name).join("، ") : ""} · اسم الدخول: ${un} · كلمة المرور: ${pw}`, t: "admin.save", payload: { data: { name: str(a.name, 120), username: un, password: pw, perms: [...ps, ...hs.map((h) => "h:" + h.id)], status: "active" } } }; } },
  { ok: full, spec: T("whatsapp_auto", "تشغيل أو إيقاف رسائل الواتساب التلقائية لأولياء الأمور", P({ absent: B("عند الغياب"), late: B("عند التأخر"), present: B("عند الحضور"), recitation: B("نتيجة التسميع"), weekly: B("التقرير الأسبوعي"), delay_minutes: N("يرسل بعد كم دقيقة") })),
    build: (a, c) => { const m: any = { absent: "autoAbsent", late: "autoLate", present: "autoPresent", recitation: "autoRec", weekly: "autoWeek" }; const ar: any = { absent: "الغياب", late: "التأخر", present: "الحضور", recitation: "التسميع", weekly: "التقرير الأسبوعي" }; const d: any = {}; const ch: string[] = []; for (const k of Object.keys(m)) if (typeof a[k] === "boolean") { d[m[k]] = a[k]; ch.push(`${ar[k]}: ${a[k] ? "تشغيل" : "إيقاف"}`); } if (a.delay_minutes !== undefined) { d.delayMin = Number(a.delay_minutes); ch.push("المهلة " + d.delayMin + " د"); } if (!ch.length) throw new Error("وش تبي تشغل أو توقف؟"); return { summary: `🟢 الرسائل التلقائية: ${ch.join(" · ")}${c.waOn ? "" : " (الربط نفسه متوقف)"}`, t: "wa.auto", payload: { data: d } }; } },
  { ok: full, spec: T("retry_failed_whatsapp", "إعادة إرسال كل رسائل الواتساب اللي فشلت", P({})),
    build: () => ({ summary: "↻ إعادة إرسال رسائل الواتساب الفاشلة", t: "wa.retryFailed", payload: {} }) },
];

/* ---------- أدوات الطالب وولي الأمر ---------- */
type SCtx = { u: U; lessonToday: any; polls: any[]; tasks: string[]; wird: any; hasTeacher: boolean };
const STU_TOOLS: { spec: ToolSpec; ok: (c: SCtx) => boolean; build: (a: any, c: SCtx) => Act | Act[] }[] = [
  { ok: (c) => c.hasTeacher, spec: T("message_teacher", "إرسال رسالة لمعلم الحلقة", P({ text: S("نص الرسالة") }, ["text"])),
    build: (a) => ({ summary: `✉ رسالة للمعلم: ${String(a.text).slice(0, 200)}`, t: "dm.send", payload: { text: str(a.text, 1000) } }) },
  { ok: (c) => c.hasTeacher, spec: T("parent_note", "ملاحظة من ولي الأمر للمعلم مرتبطة بيوم (مثل استئذان أو غياب متوقع)", P({ date: S("اليوم المقصود YYYY-MM-DD"), text: S("الملاحظة") }, ["text"])),
    build: (a) => { const d = isDay(a.date) ? a.date : localDate(); return { summary: `📝 ملاحظة ولي الأمر ليوم ${wd(d)} ${d}: ${String(a.text).slice(0, 200)}`, t: "dm.send", payload: { kind: "note", date: d, text: str(a.text, 1000) } }; } },
  { ok: (c) => c.polls.length > 0, spec: T("vote_poll", "التصويت في تصويت مفتوح", P({ question: S("سؤال التصويت أو جزء منه"), choices: SA("الخيار أو الخيارات المختارة بنصها") }, ["choices"])),
    build: (a, c) => { const p: any = c.polls.length === 1 && !a.question ? c.polls[0] : one(c.polls.map((x) => ({ ...x, name: x.question })), a.question, "التصويت"); const opts = p.options as string[]; const idx = (Array.isArray(a.choices) ? a.choices : [a.choices]).map((ch: any) => { const n = norm(ch); const i = opts.findIndex((o) => norm(o) === n || norm(o).includes(n) || n.includes(norm(o))); if (i < 0) throw new Error(`ما لقيت الخيار «${ch}»`); return i; }); return { summary: `🗳 تصويت «${p.question}»: ${idx.map((i: number) => opts[i]).join("، ")}`, t: "poll.vote", payload: { id: p.id, choice: idx } }; } },
  { ok: (c) => !!c.lessonToday, spec: T("ready_for_recitation", "دخول طابور التسميع في حصة اليوم (أنا جاهز) أو الخروج منه", P({ ready: B("true جاهز، false خروج") })),
    build: (a, c) => ({ summary: a.ready === false ? "↩ الخروج من طابور التسميع" : "🙋 أنا جاهز للتسميع (دخول الطابور)", t: "queue.ready", payload: { lessonId: c.lessonToday.id, v: a.ready !== false } }) },
  { ok: (c) => !!c.lessonToday, spec: T("report_issue", "إبلاغ المعلم بمشكلة في دخول حصة اليوم", P({ msg: S("وصف المشكلة") })),
    build: (a, c) => ({ summary: `⚠ بلاغ للمعلم: ${str(a.msg, 200) || "ما أقدر أدخل الحصة"}`, t: "issue", payload: { lessonId: c.lessonToday.id, msg: str(a.msg, 200) } }) },
  { ok: () => true, spec: T("log_wird", "تسجيل مهام اليوم والورد: المهام اللي خلصها وعدد أوجه التلاوة", P({ done: SA("المهام اللي خلصها بنصها أو [\"الكل\"]"), read_pages: N("أوجه التلاوة اليوم"), note: S("ملاحظة") })),
    build: (a, c) => {
      const prev = new Set(((c.wird?.items as any[]) || []).filter((x) => x.done).map((x) => x.k)); const all = Array.isArray(a.done) && a.done.some((x: string) => ALL_RE.test(String(x).trim()));
      const want = (Array.isArray(a.done) ? a.done : []).map(norm);
      const items = c.tasks.map((k) => ({ k, done: all || prev.has(k) || want.some((w: string) => w && (norm(k).includes(w) || w.includes(norm(k)))) }));
      const read = a.read_pages !== undefined ? Math.max(0, Number(a.read_pages) || 0) : c.wird?.read || 0;
      const n = items.filter((x) => x.done).length;
      return { summary: `☑ مهام اليوم: ${n} من ${items.length}${read ? " · تلاوة " + read + " وجه" : ""}${a.note ? " — " + a.note : ""}`, t: "wird.save", payload: { date: localDate(), items, read, note: a.note !== undefined ? str(a.note, 200) : c.wird?.note || "" } };
    } },
];

// إذا قال إنه سوّى شي وهو ما استخدم أداة، نطلب منه مرة ثانية يستخدمها (بدل ما يوهم المستخدم)
const CLAIM = /(أضفت|ألغيت|عدّلت|عدلت|غيّرت|غيرت|أرسلت|نشرت|حضّرت|نقلت|اعتمدت|تم (ال)?(إضافة|تعديل|تغيير|إرسال|نشر|إلغاء|تسجيل|اعتماد))/;
async function llmActs(system: string, messages: ChatMsg[], specs: ToolSpec[], cfg: any) {
  let out = await callLlm(system, messages, specs, cfg);
  if (specs.length && !(out.calls || []).length && CLAIM.test(out.text || "")) {
    try {
      const again = await callLlm(system, [...messages, { role: "assistant", text: out.text }, { role: "user", text: "ما استخدمت أي أداة، فما تنفذ شي. استخدم الأداة المناسبة الحين لطلبي، وإذا ما فيه أداة تناسبه قل ذلك بصراحة." }], specs, cfg);
      if ((again.calls || []).length) out = again; else if (/ما (أقدر|اقدر|عندي|فيه أداة)|ما يمديني|غير متاح/.test(again.text || "")) out = { ...out, text: again.text };
    } catch {}
  }
  return out;
}
function runTools(calls: { name: string; args: any }[], find: (n: string) => ((a: any) => Promise<Act | Act[]> | Act | Act[]) | null) {
  return (async () => {
    const actions: Act[] = [];
    for (const c of calls) {
      const fn = find(c.name);
      try { if (!fn) throw new Error("هذا الإجراء مو من صلاحياتك"); const r = await fn(c.args || {}); actions.push(...(Array.isArray(r) ? r : [r])); }
      catch (e: any) { actions.push({ summary: `⚠ ما قدرت أجهز الطلب`, t: "", payload: null, error: String(e?.message || e) }); }
    }
    return actions;
  })();
}

/* ---------- المساعد للطالب وولي الأمر: بياناته هو فقط، وإجراءاته هو فقط ---------- */
async function studentChat(u: U, b: any) {
  const row = await prisma.setting.findUnique({ where: { key: "ai" } }); const raw: any = (row?.value as any) || {};
  if (raw.students === false) fail("المساعد غير متاح للطلاب حاليًا");
  const cfg = await aiCfg(); if (!aiOn(cfg)) fail("المساعد غير مفعّل");
  // حد يومي لكل طالب عشان ما تخلص الباقة المجانية
  const today = localDate(); const lim = Math.min(200, Math.max(1, Number(raw.studentLimit) || 25)); const qk = "aiq:" + today;
  const qrow = await prisma.setting.findUnique({ where: { key: qk } }); const used: Record<string, number> = { ...((qrow?.value as any) || {}) };
  if ((used[u.id] || 0) >= lim) fail(`وصلت حد اليوم (${lim} سؤال). ارجع بكرة إن شاء الله`);
  const messages: ChatMsg[] = (Array.isArray(b.messages) ? b.messages : []).slice(-10).map((m: any) => ({ role: m.role === "assistant" ? "assistant" : "user", text: str(m.text, 2000) })).filter((m: ChatMsg) => m.text);
  if (!messages.length || messages[messages.length - 1].role !== "user") fail("اكتب سؤالك");
  const s = await getSettings();
  const h = u.halqaId ? await prisma.halqa.findUnique({ where: { id: u.halqaId } }) : null;
  const teacher = h?.teacherId ? await prisma.user.findUnique({ where: { id: h.teacherId }, select: { name: true } }) : null;
  const [lessons, recs, behav, polls, wird, votes] = await Promise.all([
    u.halqaId ? prisma.lesson.findMany({ where: { halqaId: u.halqaId, date: { gte: localDate(-30), lte: localDate(14) } }, orderBy: [{ date: "asc" }, { time: "asc" }] }) : Promise.resolve([] as any[]),
    prisma.rec.findMany({ where: { userId: u.id }, orderBy: { at: "desc" }, take: 25 }),
    prisma.behav.findMany({ where: { userId: u.id, visible: true }, orderBy: { at: "desc" }, take: 5 }),
    prisma.poll.findMany({ where: { closed: false, OR: [{ halqaId: u.halqaId }, { halqaId: null }] }, orderBy: { at: "desc" }, take: 10 }),
    prisma.wird.findUnique({ where: { userId_date: { userId: u.id, date: today } } }),
    prisma.pollVote.findMany({ where: { userId: u.id } }),
  ]);
  const past = lessons.filter((l: any) => l.date <= today && !l.cancelled); const att = past.map((l: any) => ((l.att as any) || {})[u.id]).filter(Boolean);
  const pres = att.filter((v: string) => v === "p" || v === "l").length, abs = att.filter((v: string) => v === "a").length;
  const next = lessons.filter((l: any) => l.date >= today && !l.cancelled).slice(0, 5).map((l: any) => `${l.date} ${wd(l.date)} ${l.time}`);
  const due = str(b.due, 600);
  const sc: SCtx = { u, lessonToday: lessons.find((l: any) => l.date === today && !l.cancelled) || null, polls, tasks: (Array.isArray(b.tasks) ? b.tasks : []).map((x: any) => str(x, 120)).filter(Boolean).slice(0, 12), wird, hasTeacher: !!h };
  const tools = STU_TOOLS.filter((t) => t.ok(sc));
  const system = [
    `أنت «مساعد ارتق»: مساعد لطيف للطالب وولي أمره في موقع «${s.center}» لحلقات تسميع القرآن عن بعد. ترد بلهجة سعودية بسيطة ومختصرة تناسب الطلاب.`,
    `${(h as any)?.gender === "f" ? "الطالبة" : "الطالب"}: ${u.name}. الحلقة: ${h?.name || "—"}${teacher ? ` (${(h as any)?.gender === "f" ? "المعلمة" : "المعلم"}: ${teacher.name})` : ""}. أيام الحلقة: ${h ? h.days.map((d: number) => DAYS[d]).join("، ") + " " + h.time : "—"}. اليوم ${today} = ${hj(today)} (${wd(today)}).`,
    "قواعد: جاوب عن بيانات هذا الطالب فقط من المعطى. ساعده في طرق الحفظ والمراجعة والتثبيت وتنظيم الوقت بنصائح عملية. لأسئلة المعاني اعطِ معنى عام مختصر مما هو معروف في التفاسير، وانصحه يسأل معلمه للتفصيل، ولا تفتِ في الأحكام. لا تكتب نص آيات من ذاكرتك (قد تخطئ)؛ اذكر اسم السورة ورقم الآية وانصحه يرجع للمصحف. لا تخترع أرقاماً غير موجودة.",
    `تقدر تسوي عنه كل شي يقدر يسويه في الموقع باستخدام الأدوات (${tools.map((t) => t.spec.description.split(" (")[0]).join("، ")}). إذا طلب شي منها استخدم الأداة مباشرة، وهو يأكد بزر قبل التنفيذ. ما تقدر تحذف شي ولا تغيّر كلمة المرور.`,
    (h as any)?.gender === "f" ? "مهم: هذي طالبة في حلقة نسائية. خاطبها بصيغة المؤنث دائمًا (أحسنتِ، تقدرين، عليكِ، سمّعتِ)، وقل «المعلمة» بدل «المعلم»، وكن لطيفًا ومشجعًا بأسلوب يناسب البنات." : "",
    due ? `المطلوب منه في خطته الحالية: ${due}` : "",
    sc.tasks.length ? `مهام اليوم (لأداة الورد): ${sc.tasks.join("؛ ")}${wird ? ` — المسجّل اليوم: ${((wird.items as any[]) || []).filter((x) => x.done).length} منجزة، تلاوة ${wird.read || 0} وجه` : ""}` : "",
    memInfo(u) ? memInfo(u) + "." : "",
    `الحضور آخر 30 يوم: ${pres} من ${past.length}${abs ? ` (غاب ${abs})` : ""}.`,
    `الحصص القادمة: ${next.join("؛ ") || "لا يوجد"}.${sc.lessonToday ? " عنده حصة اليوم." : ""}`,
    `آخر تسميعاته: ${recs.map((r) => `${r.date} ${TYPE[r.type] || ""} ${SN[r.surah - 1]} ${r.fromA}-${r.toA}: ${r.grade}${r.mistakes ? ` (${r.mistakes} أخطاء)` : ""}${r.note ? ` — ملاحظة: ${r.note}` : ""}`).join("؛ ") || "ما فيه"}.`,
    behav.length ? `ملاحظات المعلم: ${behav.map((x) => x.text).join("؛ ")}.` : "",
    polls.length ? `التصويتات المفتوحة: ${polls.map((p: any) => `«${p.question}» (${(p.options as string[]).join(" / ")})${votes.some((v) => v.pollId === p.id) ? " — صوّت" : ""}`).join("؛ ")}.` : "",
    `الإجازات القادمة: ${(s.holidays || []).filter((x) => x.to >= today).map((x) => `${x.name} ${x.from}→${x.to}`).join("؛ ") || "لا يوجد"}. الاختبارات والمناسبات: ${((s as any).events || []).filter((e: any) => e.date >= today).map((e: any) => `${e.date} ${e.name}`).join("؛ ") || "لا يوجد"}.`,
    `التقويم للأيام الـ 14 القادمة: ${Array.from({ length: 14 }, (_, i) => { const d = localDate(i); return `${d}=${wd(d)}`; }).join("، ")}`,
  ].filter(Boolean).join("\n\n");
  let out: any;
  try { out = await llmActs(system, messages, tools.map((t) => t.spec), cfg); } catch (e: any) { fail(String(e.message), 503); }
  used[u.id] = (used[u.id] || 0) + 1;
  await prisma.setting.upsert({ where: { key: qk }, create: { key: qk, value: used }, update: { value: used } }).catch(() => {});
  const actions = await runTools(out.calls || [], (n) => { const t = tools.find((x) => x.spec.name === n); return t ? (a: any) => t.build(a, sc) : null; });
  return { text: out.text || (actions.length ? "جهزت لك التالي، راجعه واضغط «تنفيذ»:" : "…"), actions, left: lim - used[u.id] };
}

export async function POST(req: Request) {
  return handle(async () => {
    const u = await currentUser(); if (!u) fail("انتهت الجلسة", 401);
    const b = await req.json().catch(() => ({}));
    const isFullAdm = u!.role === "admin" && !u!.perms;
    const t = String(b.t || "");
    if (t === "get" || t === "save" || t === "test") {
      if (!isFullAdm) fail("إعداد المساعد للمدير الكامل فقط", 403);
      const row = await prisma.setting.findUnique({ where: { key: "ai" } }); const c: any = { ...((row?.value as any) || {}) };
      if (t === "get") { const e = await aiCfg(); return { gemini: mask(e.gemini), claude: mask(e.claude), model: c.geminiModel || "", on: aiOn(e), students: c.students !== false, studentLimit: c.studentLimit || 25, fromEnv: !!(process.env.IRTAQ_GEMINI_KEY || process.env.IRTAQ_ANTHROPIC_KEY) }; }
      if (t === "save") {
        if (b.gemini !== undefined) c.gemini = str(b.gemini, 200).trim() || undefined;
        if (b.claude !== undefined) c.claude = str(b.claude, 300).trim() || undefined;
        if (b.geminiModel !== undefined) c.geminiModel = str(b.geminiModel, 60).trim() || undefined;
        if (b.students !== undefined) c.students = !!b.students;
        if (b.studentLimit !== undefined) c.studentLimit = Math.min(200, Math.max(1, Number(b.studentLimit) || 25));
        await prisma.setting.upsert({ where: { key: "ai" }, create: { key: "ai", value: c }, update: { value: c } });
        await audit(u!, "ai.save", null, "إعداد المساعد الذكي");
        return { ok: true };
      }
      // التجربة ترسل الأدوات كلها كمان، عشان لو فيه مشكلة بتعريفها تطلع هنا
      const out = await callLlm("رد بكلمة واحدة بدون أدوات.", [{ role: "user", text: "قل: تمام" }], STAFF_TOOLS.map((x) => x.spec)).catch((e) => fail(String(e.message), 422));
      return { reply: (out as any).text || "تمام" };
    }
    if (u!.role === "student") {
      if (t !== "chat") fail("غير مصرح", 403);
      return await studentChat(u!, b);
    }

    if (t === "parentMsg") {
      const st = await prisma.user.findUnique({ where: { id: str(b.studentId) } });
      if (!st || st.role !== "student") fail("الطالب غير موجود", 404);
      const ctx = await context(u, b._side); if (!ctx.studs.some((x) => x.id === st!.id)) fail("الطالب خارج نطاقك", 403);
      const since = localDate(-14);
      const ls = ctx.lessons.filter((l) => l.halqaId === st!.halqaId && !l.cancelled && l.date >= since && l.date <= localDate());
      const att = ls.map((l) => ((l.att as any) || {})[st!.id]).filter(Boolean);
      const pres = att.filter((v: string) => v === "p" || v === "l").length, abs = att.filter((v: string) => v === "a").length;
      const rs = ctx.recs.filter((r) => r.userId === st!.id && r.date >= since);
      const notes = rs.map((r) => r.note).filter(Boolean).slice(0, 3);
      const fem = (await prisma.halqa.findUnique({ where: { id: st!.halqaId || "" }, select: { gender: true } }).catch(() => null))?.gender === "f";
      const facts = [`${fem ? "الطالبة (حلقة نسائية، اكتب الرسالة بصيغة المؤنث: ابنتكم)" : "الطالب"}: ${st!.name}`, `الحضور آخر أسبوعين: ${pres} من ${ls.length}${abs ? ` (غاب ${abs})` : ""}`,
        `التسميع: ${rs.length ? rs.slice(0, 8).map((r) => `${TYPE[r.type] || ""} ${SN[r.surah - 1]} ${r.fromA}-${r.toA}: ${r.grade}`).join("، ") : "ما سمّع"}`,
        notes.length ? `ملاحظات المعلم: ${notes.join(" / ")}` : "", b.extra ? `إضافة من المعلم: ${str(b.extra, 300)}` : ""].filter(Boolean).join("\n");
      const tone = b.tone === "praise" ? "ثناء وتشجيع" : b.tone === "concern" ? "قلق بلطف وطلب تعاون" : "اطمئنان";
      const cfg = await aiCfg(); if (!aiOn(cfg)) fail("المساعد غير مفعّل");
      const out = await callLlm("أنت تكتب رسائل واتساب من معلم حلقة تحفيظ قرآن لولي أمر الطالب. اكتب بعربية واضحة ودودة، بدون مبالغة، ولا تخترع معلومات غير موجودة. أعد نص الرسالة فقط.", [{ role: "user", text: `اكتب رسالة قصيرة (أقل من 80 كلمة) نبرتها: ${tone}. ابدأ بالسلام، واذكر اسم الطالب الأول، ووقّعها باسم ${u!.name}.\n\nالمعلومات:\n${facts}` }], [], cfg).catch((e) => fail(String(e.message), 503));
      return { text: (out as any).text };
    }

    if (t !== "chat") fail("طلب غير معروف");
    const messages: ChatMsg[] = (Array.isArray(b.messages) ? b.messages : []).slice(-12).map((m: any) => ({ role: m.role === "assistant" ? "assistant" : "user", text: str(m.text, 4000) })).filter((m: ChatMsg) => m.text);
    if (!messages.length || messages[messages.length - 1].role !== "user") fail("اكتب سؤالك");
    const cfg = await aiCfg(); if (!aiOn(cfg)) fail("المساعد غير مفعّل. المدير يضيف المفتاح من الإعدادات ← المساعد الذكي");
    const ctx = await context(u, b._side);
    const today = localDate(); const s = ctx.settings;
    const tools = STAFF_TOOLS.filter((x) => x.ok(u));
    const hName = (id: string | null) => ctx.halaqat.find((h) => h.id === id)?.name || "";
    const studLines = ctx.studs.map((st) => {
      const ls = ctx.lessons.filter((l) => l.halqaId === st.halqaId && !l.cancelled && l.date <= today);
      const att = ls.map((l) => ((l.att as any) || {})[st.id]).filter(Boolean);
      const p = att.filter((v: string) => v === "p" || v === "l").length, a = att.filter((v: string) => v === "a").length;
      const rs = ctx.recs.filter((r) => r.userId === st.id); const last = rs[0]; const re = rs.filter((r) => !r.pass).length;
      const pl = planOf(st); const plTxt = pl.paused ? "موقوفة" : pl.mode === "auto" ? `تلقائية ح${fmtPg(+pl.auto.newAmt || 0)}/م${fmtPg(+pl.auto.revAmt || 0)}/ت${fmtPg(+pl.auto.tathAmt || 0)}` : Object.keys(pl.manual).length ? "يدوية " + Object.entries(pl.manual).map(([k, v]: any) => TYPE[k] + " " + seg(v)).join("، ") : "بدون";
      const ph = ((st.info as any) || {}).parentPhone ? "" : " | بدون رقم ولي أمر";
      const mem = memInfo(st); const tot = ctx.recTotal[st.id] || 0;
      return `${st.name} | ${hName(st.halqaId)} | حضور ${p}/${ls.length}${a ? ` غاب ${a}` : ""} | تسميع ${rs.length}${tot > rs.length ? ` (الكل ${tot})` : ""}${last ? ` آخره ${last.date} ${recLine(last)}` : ""}${re ? ` | إعادات ${re}` : ""} | ${mem || "المحفوظ غير مسجل"} | خطة ${plTxt} | آخر دخول ${st.lastSeenAt ? st.lastSeenAt.toISOString().slice(0, 10) : "أبد"}${ph}`;
    });
    const otherStuds = ctx.allStuds.filter((x) => x.status !== "active");
    const lessonLines = ctx.lessons.filter((l) => l.date >= localDate(-7) && l.date <= localDate(10)).slice(0, 70).map((l) => {
      const att = (l.att as any) || {}; const n = Object.values(att).length; const ab = Object.entries(att).filter(([, v]) => v === "a").map(([k]) => ctx.studs.find((x) => x.id === k)?.name.split(" ")[0]).filter(Boolean);
      return `${l.date} ${wd(l.date)} ${l.time} ${hName(l.halqaId)}${l.cancelled ? " (ملغاة)" : ""}${n ? ` — محضّر ${n}${ab.length ? "، غاب: " + ab.join("، ") : ""}` : l.date <= today && !l.cancelled ? " — ما تحضّرت" : ""}`;
    });
    const roleTxt = u!.role === "admin" ? (u!.perms ? `مشرف إداري (صلاحياته: ${(u!.perms as string[]).filter((x) => PERM_AR[x]).map((x) => PERM_AR[x]).join("، ")}${ctx.sc ? "، على حلقات محددة" : ""})` : "المدير العام") : `معلم${u!.canPlan ? " (يعدّل الخطط)" : ""}`;
    const system = [
      `أنت «مساعد ارتق»: مساعد ذكي داخل موقع «${s.center}» لحلقات تسميع القرآن عن بعد (حفظ ومراجعة وتثبيت). تتكلم بلهجة سعودية مهذبة ومختصرة.`,
      `المستخدم: ${u!.name} — ${roleTxt}. اليوم ${today} ميلادي = ${hj(today)} (${wd(today)}).`,
      `صلاحياتك: تقدر تسوي عن المستخدم كل شي يقدر يسويه هو في الموقع باستخدام الأدوات، ما عدا الحذف. إذا طلب حذف قل له إن الحذف يسويه بنفسه من الصفحة، ولا تستخدم أداة بديلة. الأدوات المتاحة له: ${tools.map((x) => x.spec.name).join("، ")}.`,
      "قواعد: إذا طلب إجراء استخدم الأداة مباشرة (لا تكتفِ بالكلام ولا تسأل «أنفذ؟»)، فهو يراجع البطاقة ويضغط «تنفيذ». لا تقول «أضفت» أو «عدّلت» أو «تم» أبدًا إلا إذا استخدمت الأداة فعلًا. لتغيير وقت حصص يوم أو فترة (اليوم، بكرة، هالأسبوع) استخدم set_lessons_time. لتغيير الوقت الدائم للحلقات استخدم set_halaqat_time (وحصصها الجاية تتعدل معها). لحصة وحدة edit_lesson. تقدر تستخدم أكثر من أداة في رد واحد. حوّل التواريخ الهجرية والأيام النسبية (اليوم، بكرة، الخميس الجاي…) لميلادي YYYY-MM-DD بدقة من التقويم المعطى. استخدم أسماء الطلاب والحلقات كما هي في القوائم. لأسئلة المتابعة (مين غاب، مين يحتاج متابعة، وش وضع طالب، كم حافظ) جاوب من البيانات بالأرقام وباختصار. لا تخترع طلاباً أو أرقاماً. إذا الطلب ناقص معلومة ضرورية اسأل سؤالاً واحداً.",
      ctx.view === "f" ? `أنت الحين في قسم البنات (الدار النسائية)، منفصل تمامًا عن البنين.${!(u!.role === "admin" && !Array.isArray(u!.perms)) ? " والمستخدمة من منسوبات القسم: خاطبها بصيغة المؤنث." : ""}` : "",
      ctx.halaqat.some((h: any) => h.gender === "f") ? `الحلقات النسائية: تكلّم عن طالباتها بصيغة المؤنث، وأي رسالة لأولياء أمورهن تكون بصيغة المؤنث (ابنتكم، بارك الله فيها).${u!.role === "teacher" && ctx.halaqat.length && ctx.halaqat.every((h: any) => h.gender === "f") ? " والمستخدمة معلمة: خاطبها بصيغة المؤنث." : ""}` : "",
      ctx.waOn ? "ربط الواتساب شغال: الرسائل لأولياء الأمور تطلع من رقم الحلقة." : "ربط الواتساب متوقف حاليًا (رسائل الواتساب ما تنرسل من الموقع).",
      `الحلقات: ${ctx.halaqat.map((h) => `${h.name} (${h.days.map((d) => DAYS[d]).join("، ")} ${h.time}${isAdm(u) ? " · المعلم: " + (ctx.teachers.find((t: any) => t.id === h.teacherId)?.name || "بدون") : ""}${(h as any).branch ? " · " + (h as any).branch : ""}${h.auto ? " · تلقائية" : ""}${(h as any).gender === "f" ? " · نسائية" : ""})`).join("؛ ") || "لا يوجد"}`,
      isAdm(u) && ctx.teachers.length ? `المعلمون: ${ctx.teachers.map((t: any) => `${t.name}${t.status === "disabled" ? " (موقوف)" : ""}${t.canPlan ? " (يعدّل الخطط)" : ""}`).join("، ")}` : "",
      ctx.pending.length ? `طلبات التسجيل المعلّقة: ${ctx.pending.map((p: any) => `${p.name}${p.reqHalqaId ? " (طلب حلقة " + hName(p.reqHalqaId) + ")" : ""}`).join("، ")}` : "",
      `الحصص (آخر أسبوع والقادمة): ${lessonLines.join("؛ ") || "لا يوجد"}`,
      `الإجازات: ${(s.holidays || []).filter((h) => h.to >= today).map((h) => `${h.name} ${h.from}→${h.to}`).join("؛ ") || "لا يوجد"}`,
      `الاختبارات والمناسبات: ${((s as any).events || []).filter((e: any) => e.date >= today).map((e: any) => `${e.date} ${e.name}`).join("؛ ") || "لا يوجد"}`,
      ctx.polls.length ? `التصويتات المفتوحة: ${ctx.polls.map((p) => `«${p.question}»${p.halqaId ? " (" + hName(p.halqaId) + ")" : ""}`).join("؛ ")}` : "",
      `الطلاب النشطين (${ctx.studs.length}) — الاسم | الحلقة | الحضور آخر 30 يوم | التسميع آخر 30 يوم | المحفوظ (الحفظ السابق + الجديد) | الخطة | آخر دخول:\n${studLines.join("\n") || "لا يوجد"}`,
      otherStuds.length ? `طلاب موقوفين أو مؤرشفين: ${otherStuds.map((x) => `${x.name} (${x.status === "archived" ? "مؤرشف" : "موقوف"})`).join("، ")}` : "",
      `التقويم للأيام الـ 21 القادمة (ميلادي، اليوم، هجري): ${calTxt(21)}`,
    ].filter(Boolean).join("\n\n");
    let out: any;
    try { out = await llmActs(system, messages, tools.map((x) => x.spec), cfg); } catch (e: any) { fail(String(e.message), 503); }
    const actions = await runTools(out.calls || [], (n) => { const x = tools.find((y) => y.spec.name === n); return x ? (a: any) => x.build(a, ctx, u) : null; });
    return { text: out.text || (actions.length ? "جهزت لك التالي، راجعه واضغط «تنفيذ»:" : "…"), actions };
  });
}
