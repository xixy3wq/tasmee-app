import { prisma } from "./db";
export type Field = { k: string; label: string; on: boolean; req: boolean; type?: string; ph?: string; custom?: boolean };
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
  tpl: {
    absent: "السلام عليكم ورحمة الله، نفيدكم بغياب ابنكم {الطالب} عن حلقة {الحلقة} يوم {التاريخ}. نرجو الحرص على الحضور، وجزاكم الله خيرًا.",
    excellent: "السلام عليكم ورحمة الله، يسعدنا إبلاغكم بتميّز ابنكم {الطالب} في حلقة {الحلقة} يوم {التاريخ}. بارك الله فيه وفيكم.",
  },
};
export type Settings = typeof DEF;
export async function getSettings(): Promise<Settings> {
  const row = await prisma.setting.findUnique({ where: { key: "main" } });
  const m = ((row?.value as any) || {}) as Partial<Settings>;
  return { ...DEF, ...m, grade: { ...DEF.grade, ...(m.grade || {}) }, tpl: { ...DEF.tpl, ...(m.tpl || {}) }, fields: (m.fields as Field[]) || DEF_FIELDS };
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
