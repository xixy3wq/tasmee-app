// أوقات الصلاة حسب الموقع (طريقة أم القرى: الفجر 18.5°، العصر بالمذهب الجمهور، العشاء بعد المغرب بـ 90 دقيقة و120 في رمضان)
// الخوارزمية من PrayTimes.org، والتوقيت بتوقيت السعودية (+3)
const rad = (d: number) => (d * Math.PI) / 180, deg = (r: number) => (r * 180) / Math.PI;
const sin = (d: number) => Math.sin(rad(d)), cos = (d: number) => Math.cos(rad(d)), tan = (d: number) => Math.tan(rad(d));
const asin = (x: number) => deg(Math.asin(x)), acos = (x: number) => deg(Math.acos(Math.max(-1, Math.min(1, x)))), atan2 = (y: number, x: number) => deg(Math.atan2(y, x));
const acot = (x: number) => deg(Math.atan(1 / x));
const fix = (a: number, b: number) => { a = a - b * Math.floor(a / b); return a < 0 ? a + b : a; };

function julian(y: number, m: number, d: number) {
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}
function sunPos(jd: number) {
  const D = jd - 2451545.0;
  const g = fix(357.529 + 0.98560028 * D, 360), q = fix(280.459 + 0.98564736 * D, 360);
  const L = fix(q + 1.915 * sin(g) + 0.02 * sin(2 * g), 360);
  const e = 23.439 - 0.00000036 * D;
  const RA = atan2(cos(e) * sin(L), cos(L)) / 15;
  return { decl: asin(sin(e) * sin(L)), eqt: q / 15 - fix(RA, 24) };
}

export type Prayer = "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";
export const PRAYER_AR: Record<Prayer, string> = { fajr: "الفجر", dhuhr: "الظهر", asr: "العصر", maghrib: "المغرب", isha: "العشاء" };

/** أوقات صلوات يوم (YYYY-MM-DD) بالدقائق من منتصف الليل بتوقيت السعودية */
export function prayerMinutes(date: string, lat: number, lng: number, tz = 3, ramadan = false): Record<Prayer, number> {
  const [y, m, d] = date.split("-").map(Number);
  const jd = julian(y, m, d) - lng / (15 * 24);
  const midDay = (t: number) => fix(12 - sunPos(jd + t).eqt, 24);
  const angleTime = (angle: number, t: number, ccw = false) => {
    const { decl } = sunPos(jd + t);
    const h = acos((-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat))) / 15;
    return midDay(t) + (ccw ? -h : h);
  };
  const asrAt = (t: number) => { const { decl } = sunPos(jd + t); return angleTime(-acot(1 + tan(Math.abs(lat - decl))), t); };
  // تقدير أولي ثم تحسين
  let fajr = 5 / 24, dhuhr = 12 / 24, asr = 13 / 24, maghrib = 18 / 24;
  for (let i = 0; i < 2; i++) {
    const f = angleTime(18.5, fajr, true), dh = midDay(dhuhr), a = asrAt(asr), mg = angleTime(0.833, maghrib);
    fajr = f / 24; dhuhr = dh / 24; asr = a / 24; maghrib = mg / 24;
  }
  const adj = (h: number) => (h + tz - lng / 15) * 60;
  const out = { fajr: adj(fajr * 24), dhuhr: adj(dhuhr * 24), asr: adj(asr * 24), maghrib: adj(maghrib * 24), isha: 0 } as Record<Prayer, number>;
  out.isha = Math.floor(out.maghrib) + (ramadan ? 120 : 90);
  for (const k of Object.keys(out) as Prayer[]) out[k] = Math.floor(out[k]);
  return out;
}
export const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(Math.round(min) % 60).padStart(2, "0")}`;
const isRamadan = (date: string) => { try { return new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { month: "numeric" }).format(new Date(date + "T12:00:00+03:00")) === "9"; } catch { return false; } };

// موقع افتراضي إذا ما تحدد موقع الجامع (الرياض)
const DEF_LOC = { lat: 24.7136, lng: 46.6753 };
export type OutCfg = { mode: "prayer" | "time" | "off"; prayer: Prayer; after: number; time: string };
export const OUT_DEF: OutCfg = { mode: "prayer", prayer: "asr", after: 90, time: "17:00" };
export function outCfg(s: any): OutCfg { const c = { ...OUT_DEF, ...((s && s.teacherOut) || {}) }; return c; }
/** موقع المجمع لحساب الأذان: موقعه، أو أي موقع محدد، أو الرياض */
export function locFor(s: any, key: string) { const pl = (s && s.places) || {}; return pl[key] || pl["_"] || Object.values(pl)[0] || DEF_LOC; }
/** وقت انصراف المعلمين ليوم معيّن (ms) أو null إذا متوقف */
export function dayEndMs(s: any, date: string, key: string): number | null {
  const c = outCfg(s);
  if (c.mode === "off") return null;
  if (c.mode === "time") return /^\d{2}:\d{2}$/.test(c.time) ? Date.parse(`${date}T${c.time}:00+03:00`) : null;
  const l = locFor(s, key) as { lat: number; lng: number };
  const p = prayerMinutes(date, l.lat, l.lng, 3, isRamadan(date));
  const base = Date.parse(`${date}T00:00:00+03:00`);
  return base + (p[c.prayer] + Math.max(0, Math.min(600, Number(c.after) || 0))) * 60000;
}
export function prayerToday(s: any, date: string, key: string) { const l = locFor(s, key) as { lat: number; lng: number }; const p = prayerMinutes(date, l.lat, l.lng, 3, isRamadan(date)); return Object.fromEntries(Object.entries(p).map(([k, v]) => [k, hhmm(v)])) as Record<Prayer, string>; }
