import { prisma } from "./db";
import { AYAS } from "./quran";
/** type: text | tel | number | choice (اختيار من متعدد) | memo (مقدار الحفظ: من سورة وآية إلى سورة وآية) */
export type Field = { k: string; label: string; on: boolean; req: boolean; type?: string; ph?: string; custom?: boolean; options?: string[]; multi?: boolean };
export const MEMO_FIELD: Field = { k: "memo", label: "مقدار الحفظ السابق", on: true, req: false, type: "memo", custom: true };
/** تنظيف قيمة حقل تسجيل حسب نوعه */
export function cleanFieldValue(f: Field, v: unknown): string {
  if (f.type === "choice") {
    const opts = f.options || [];
    const arr = (Array.isArray(v) ? v : String(v ?? "").split("،")).map((x) => String(x).trim()).filter((x) => opts.includes(x));
    return f.multi ? [...new Set(arr)].join("، ") : arr[0] || "";
  }
  if (f.type === "memo") {
    const m = /^(\d{1,3}):(\d{1,3})>(\d{1,3}):(\d{1,3})$/.exec(String(v ?? "").trim());
    if (!m) return String(v ?? "").trim() === "none" ? "none" : "";
    const [fs, fa, ts, ta] = m.slice(1).map(Number);
    if (fs < 1 || fs > 114 || ts < 1 || ts > 114 || fa < 1 || fa > AYAS[fs - 1] || ta < 1 || ta > AYAS[ts - 1]) return "";
    return `${fs}:${fa}>${ts}:${ta}`;
  }
  return String(v ?? "").trim().slice(0, 200);
}
export const DEF_FIELDS: Field[] = [
  { k: "phone", label: "جوال الطالب", on: true, req: false, type: "tel" },
  { k: "parentName", label: "اسم ولي الأمر", on: true, req: true },
  { k: "parentPhone", label: "جوال ولي الأمر", on: true, req: true, type: "tel" },
  { k: "age", label: "العمر", on: true, req: false, type: "number" },
  { k: "memorized", label: "مقدار الحفظ الحالي", on: true, req: false, ph: "مثال: جزء عمّ وجزء تبارك" },
];
export const DEF = {
  center: "حلقات ارتق",
  days: [0, 1, 2, 3, 4],
  grade: { ex: 0, vg: 2, gd: 4, alertsPer: 3 },
  /// تنبيه الغياب بعد كم غياب متتالي
  absentAlert: 3,
  /// الإجازات: [{ from, to, name }] بصيغة YYYY-MM-DD
  holidays: [] as { from: string; to: string; name: string }[],
  fields: DEF_FIELDS,
  /// رسائل واتساب الجاهزة الإضافية
  tpls: [
    { id: "late", name: "تأخر", text: "السلام عليكم ورحمة الله، نفيدكم بتأخر ابنكم {الطالب} عن حلقة {الحلقة} يوم {التاريخ}. نرجو الحرص على الحضور في الوقت." },
    { id: "done", name: "إنجاز", text: "السلام عليكم ورحمة الله، نبشركم بإنجاز ابنكم {الطالب} في حلقة {الحلقة}. بارك الله فيه وزاده حرصًا." },
    { id: "remind", name: "تذكير بالمراجعة", text: "السلام عليكم ورحمة الله، نذكّركم بمتابعة ابنكم {الطالب} في مراجعة المطلوب منه قبل الحصة القادمة. جزاكم الله خيرًا." },
  ] as { id: string; name: string; text: string }[],
  /// قوالب الخطط التلقائية
  planTpls: [
    { id: "t1", name: "ربع وجه حفظ ووجهان مراجعة", newAmt: 0.25, revAmt: 2, tathAmt: 1 },
    { id: "t2", name: "نصف وجه حفظ و3 أوجه مراجعة", newAmt: 0.5, revAmt: 3, tathAmt: 2 },
    { id: "t3", name: "وجه حفظ و5 أوجه مراجعة", newAmt: 1, revAmt: 5, tathAmt: 3 },
  ] as { id: string; name: string; newAmt: number; revAmt: number; tathAmt: number }[],
  /// قواعد النقاط التلقائية (absent و bad خصم: الغياب بدون عذر، وملاحظة السلوك السلبية)
  points: { present: 2, late: 1, ex: 3, vg: 2, gd: 1, page: 2, absent: 0, bad: 0 },
  /// يُحسب الطالب متأخر إذا وصل بعد بداية الحلقة بكم دقيقة
  lateMin: 10,
  /// مواقع الجوامع لتسجيل حضور المعلم: { "<المجمع>" أو "_" للأساسي: { lat, lng, radius } }
  places: {} as Record<string, { lat: number; lng: number; radius: number }>,
  /// لوحة الشرف للطلاب: show | top3 | hide
  board: "show",
  /// وقت التسميع المقترح لكل طالب بالدقائق (0 = بدون تنبيه)
  recMin: 0,
  /// المجمعات أو الجوامع
  branches: [] as string[],
  /// مناسبات التقويم: [{ date, name, kind: exam | event }]
  events: [] as { date: string; name: string; kind: string }[],
  tpl: {
    absent: "السلام عليكم ورحمة الله، نفيدكم بغياب ابنكم {الطالب} عن حلقة {الحلقة} يوم {التاريخ}. نرجو الحرص على الحضور، وجزاكم الله خيرًا.",
    excellent: "السلام عليكم ورحمة الله، يسعدنا إبلاغكم بتميّز ابنكم {الطالب} في حلقة {الحلقة} يوم {التاريخ}. بارك الله فيه وفيكم.",
  },
};
export type Settings = typeof DEF;
export async function getSettings(): Promise<Settings> {
  const row = await prisma.setting.findUnique({ where: { key: "main" } });
  const m = ((row?.value as any) || {}) as Partial<Settings>;
  // الاسم القديم المحفوظ قبل تغيير الاسم يتحول للاسم الجديد
  if (!m.center || m.center === "حلقات التسميع") m.center = DEF.center;
  const fields = ((m.fields as Field[]) || DEF_FIELDS).slice();
  if (!fields.some((f) => f.type === "memo") && !(m as any).memoRemoved) fields.push(MEMO_FIELD);
  m.fields = fields;
  return { ...DEF, ...m, grade: { ...DEF.grade, ...(m.grade || {}) }, points: { ...DEF.points, ...(m.points || {}) }, tpl: { ...DEF.tpl, ...(m.tpl || {}) }, fields: (m.fields as Field[]) || DEF_FIELDS };
}
export function gradeOf(s: Settings, m: number, al: number) {
  const g = s.grade;
  const e = m + Math.floor(al / (g.alertsPer || 3));
  if (e <= g.ex) return { t: "ممتاز", pass: true };
  if (e <= g.vg) return { t: "جيد جدًا", pass: true };
  if (e <= g.gd) return { t: "جيد", pass: true };
  return { t: "يعاد", pass: false };
}

export const GRADES = ["ممتاز", "جيد جدًا", "جيد", "يعاد"];
export const isHoliday = (s: Settings, date: string) => (s.holidays || []).some((h) => date >= h.from && date <= h.to);

/** التاريخ المحلي (السعودية افتراضيًا) بصيغة YYYY-MM-DD مع إزاحة أيام */
export function localDate(addDays = 0) {
  const off = Number(process.env.APP_TZ_OFFSET_MIN ?? 180);
  const d = new Date(Date.now() + off * 60000 + addDays * 86400000);
  return d.toISOString().slice(0, 10);
}
export const weekday = (date: string) => new Date(date + "T00:00:00Z").getUTCDay();

/** بداية الأسبوع (الأحد) لتاريخ YYYY-MM-DD */
export function weekStart(date: string) {
  const d = new Date(date + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
}
