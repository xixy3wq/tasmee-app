// أدوات مشتركة لبيانات الصفحات العامة (سجل الطالب وشاشة الجامع)
const off = () => Number(process.env.APP_TZ_OFFSET_MIN ?? 180) * 60000;
/** التاريخ المحلي (السعودية افتراضيًا) لوقت معيّن */
export const locDate = (d: Date) => new Date(+d + off()).toISOString().slice(0, 10);
/** الخطة بالحد اللازم فقط: الهدف اليومي والمحفوظ والسورة الحالية */
export const planPub = (p: any) => {
  p = p || {}; const a = p.auto || {};
  return {
    mode: p.mode === "auto" ? "auto" : "manual",
    auto: { dir: a.dir === "fwd" ? "fwd" : "bwd", memStart: +a.memStart || 0, newPos: +a.newPos || 0, newAmt: +a.newAmt || 0, revAmt: +a.revAmt || 0, tathAmt: +a.tathAmt || 0 },
    manual: p.manual?.new ? { new: { surah: +p.manual.new.surah || 0 } } : {},
    daily: p.daily || null, hafiz: !!p.hafiz, paused: p.paused || null,
  };
};
/** الاسم الأول واسم العائلة فقط (للشاشة العامة) */
export const shortName = (n: string) => { const w = String(n || "").trim().split(/\s+/); return w.length > 2 ? w[0] + " " + w[w.length - 1] : w.join(" "); };
