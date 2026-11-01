import { SignJWT, importPKCS8 } from "jose";
import { prisma } from "./db";
import { localDate } from "./settings";
// غرفة الحصة داخل الموقع: JaaS (من فريق Jitsi) أو Daily.
// المفاتيح محفوظة في جدول Setting بالمفتاح "video" وما تطلع للواجهة أبد.
export type VideoCfg = {
  provider: "none" | "jaas" | "daily";
  jaasApp: string; jaasKid: string; jaasKey: string;
  dailyKey: string;
  /** حد الباقة لشريط الاستهلاك: مستخدمين بالشهر لـ JaaS، ودقائق مشارك بالشهر لـ Daily */
  jaasCap: number; dailyCap: number;
};
export const VIDEO_DEF: VideoCfg = { provider: "none", jaasApp: "", jaasKid: "", jaasKey: "", dailyKey: "", jaasCap: 25, dailyCap: 10000 };
export async function videoCfg(): Promise<VideoCfg> {
  const r = await prisma.setting.findUnique({ where: { key: "video" } });
  return { ...VIDEO_DEF, ...((r?.value as any) || {}) };
}
const jaasOk = (c: VideoCfg) => !!(c.jaasApp && c.jaasKid && c.jaasKey);
const dailyOk = (c: VideoCfg) => !!c.dailyKey;
/** ترتيب الخدمات: الأساسية أولًا، وبعدها الاحتياطية إذا مفاتيحها موجودة */
export function videoOrder(c: VideoCfg): ("jaas" | "daily")[] {
  if (c.provider === "none") return [];
  const all: ("jaas" | "daily")[] = c.provider === "daily" ? ["daily", "jaas"] : ["jaas", "daily"];
  return all.filter((p) => (p === "jaas" ? jaasOk(c) : dailyOk(c)));
}
export const videoOn = (c: VideoCfg) => videoOrder(c).length > 0;
/** النسخة اللي تنرسل للمدير: بدون المفاتيح السرية */
export const videoPublic = (c: VideoCfg) => ({ provider: c.provider, jaasApp: c.jaasApp, jaasKid: c.jaasKid, hasJaasKey: !!c.jaasKey, hasDailyKey: !!c.dailyKey, jaasCap: c.jaasCap, dailyCap: c.dailyCap, on: videoOn(c), jaasOn: jaasOk(c), dailyOn: dailyOk(c), order: videoOrder(c) });

const roomName = (lessonId: string) => "irtaq-" + lessonId.toLowerCase().replace(/[^a-z0-9-]/g, "");

/** رابط الدخول للغرفة لمستخدم معيّن (المعلم مشرف الغرفة) */
export async function roomUrl(c: VideoCfg, lessonId: string, user: { id: string; name: string }, moderator: boolean, hours = 4, only?: "jaas" | "daily"): Promise<string> {
  if (only) c = { ...c, provider: only };
  const room = roomName(lessonId);
  const exp = Math.floor(Date.now() / 1000) + hours * 3600;
  if (c.provider === "jaas") {
    const pem = c.jaasKey.includes("BEGIN") ? c.jaasKey : `-----BEGIN PRIVATE KEY-----\n${c.jaasKey.replace(/\s+/g, "")}\n-----END PRIVATE KEY-----`;
    const key = await importPKCS8(pem.replace(/\\n/g, "\n"), "RS256");
    const jwt = await new SignJWT({
      aud: "jitsi", iss: "chat", sub: c.jaasApp, room,
      context: { user: { id: user.id, name: user.name, avatar: "", email: "", moderator: moderator ? "true" : "false" }, features: { livestreaming: "false", recording: "false", transcription: "false", "outbound-call": "false" } },
    }).setProtectedHeader({ alg: "RS256", kid: c.jaasKid, typ: "JWT" }).setExpirationTime(exp).setNotBefore(Math.floor(Date.now() / 1000) - 10).sign(key);
    // إعدادات تخفف الحمل على الجوالات والنت الضعيف: جودة 360، استقبال 4 كاميرات بالكثير، والطلاب يدخلون والكاميرا مقفلة (الأهم الصوت)
    const cfg = ["config.prejoinConfig.enabled=false", "config.defaultLanguage=%22ar%22", "config.disableDeepLinking=true", `userInfo.displayName=%22${encodeURIComponent(user.name)}%22`,
      "config.channelLastN=4", "config.resolution=360", "config.constraints.video.height.ideal=360", "config.constraints.video.height.max=480", "config.disableAudioLevels=true", "config.enableNoisyMicDetection=false",
      ...(moderator ? [] : ["config.startWithVideoMuted=true"])].join("&");
    return `https://8x8.vc/${encodeURIComponent(c.jaasApp)}/${room}?jwt=${jwt}#${cfg}`;
  }
  if (c.provider === "daily") {
    const H = { Authorization: "Bearer " + c.dailyKey, "Content-Type": "application/json" };
    let r = await fetch("https://api.daily.co/v1/rooms/" + room, { headers: H, signal: AbortSignal.timeout(12000) });
    let info: any;
    if (r.status === 404) {
      r = await fetch("https://api.daily.co/v1/rooms", { method: "POST", headers: H, signal: AbortSignal.timeout(12000), body: JSON.stringify({ name: room, privacy: "private", properties: { exp: exp + 3600, enable_prejoin_ui: false, enable_chat: true, enable_screenshare: true, lang: "en", eject_at_room_exp: true } }) });
    }
    info = await r.json().catch(() => ({}));
    if (!r.ok || !info.url) throw new Error("تعذّر تجهيز الغرفة: " + (info.error || info.info || r.status));
    // الغرفة انفتحت قبل (تجربة أو دخول بدري) وانتهت صلاحيتها: نمددها، وإلا تعلّق على شاشة التحميل
    const rexp = Number(info.config?.exp || 0);
    if (rexp && rexp < Math.floor(Date.now() / 1000) + 3600) {
      const up = await fetch("https://api.daily.co/v1/rooms/" + room, { method: "POST", headers: H, signal: AbortSignal.timeout(12000), body: JSON.stringify({ properties: { exp: exp + 3600, eject_at_room_exp: true } }) });
      if (!up.ok) { const ej: any = await up.json().catch(() => ({})); throw new Error("تعذّر تجديد الغرفة: " + (ej.error || ej.info || up.status)); }
    }
    // الطالب يدخل والكاميرا مقفلة (الأهم الصوت) عشان ما تثقل الحصة على الجوالات
    const t = await fetch("https://api.daily.co/v1/meeting-tokens", { method: "POST", headers: H, signal: AbortSignal.timeout(12000), body: JSON.stringify({ properties: { room_name: room, user_name: user.name, user_id: user.id.slice(0, 36), is_owner: moderator, exp, ...(moderator ? {} : { start_video_off: true }) } }) });
    const tj: any = await t.json().catch(() => ({}));
    if (!t.ok || !tj.token) throw new Error("تعذّر إصدار تصريح الدخول: " + (tj.error || tj.info || t.status));
    return info.url + "?t=" + tj.token;
  }
  throw new Error("غرفة الحصة غير مفعّلة");
}

/** يجرب الخدمة الأساسية، وإذا فشلت ينتقل للاحتياطية. alt = ابدأ بالثانية */
export async function roomUrlAny(c: VideoCfg, lessonId: string, user: { id: string; name: string }, moderator: boolean, alt = false) {
  let order = videoOrder(c); if (alt && order.length > 1) order = [order[1], order[0]];
  let lastErr: any = null;
  for (const p of order) {
    try { const url = await roomUrl(c, lessonId, user, moderator, 4, p); await trackUse(p, user.id).catch(() => {}); return { url, provider: p, hasAlt: videoOrder(c).length > 1 }; }
    catch (e) { lastErr = e; console.error("video " + p, e); }
  }
  throw lastErr || new Error("غرفة الحصة غير مفعّلة");
}

// ---------- شريط الاستهلاك ----------
// JaaS تحسب كل شخص دخل ولو مرة بالشهر، فنسجّل بأنفسنا مين دخل غرفها هالشهر.
// Daily تحسب الدقائق، ونجيبها من حسابهم مباشرة.
const useKey = () => "videoUse:" + localDate().slice(0, 7);
async function trackUse(p: "jaas" | "daily", userId: string) {
  if (p !== "jaas") return;
  const key = useKey(); const row = await prisma.setting.findUnique({ where: { key } });
  const v: any = { ...((row?.value as any) || {}) }; const ids: string[] = v.jaas || [];
  if (ids.includes(userId)) return;
  v.jaas = [...ids, userId];
  await prisma.setting.upsert({ where: { key }, create: { key, value: v }, update: { value: v } });
}
async function dailyMinutes(key: string) {
  // من أول الشهر بتوقيت المنصة، وكل مشارك بحسبة Daily: الدقيقة الناقصة تنحسب كاملة
  const off = Number(process.env.APP_TZ_OFFSET_MIN ?? 180);
  const start = Math.floor((Date.parse(localDate().slice(0, 8) + "01T00:00:00Z") - off * 60000) / 1000);
  let sec = 0, mins = 0, after = "";
  for (let i = 0; i < 50; i++) {
    const r = await fetch(`https://api.daily.co/v1/meetings?timeframe_start=${start}&limit=100${after ? "&starting_after=" + after : ""}`, { headers: { Authorization: "Bearer " + key }, signal: AbortSignal.timeout(12000) });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || j.info || "HTTP " + r.status);
    const data: any[] = j.data || [];
    for (const m of data) for (const p of m.participants || []) { const d = Number(p.duration || 0); sec += d; mins += Math.ceil(d / 60); }
    if (data.length < 100) break;
    after = data[data.length - 1].id;
  }
  return { mins, sec };
}
export async function videoUsage(c: VideoCfg) {
  const key = useKey(); const row = await prisma.setting.findUnique({ where: { key } });
  const out: any = { month: key.slice(10) };
  if (jaasOk(c)) out.jaas = { used: (((row?.value as any) || {}).jaas || []).length, cap: c.jaasCap };
  if (dailyOk(c)) { try { out.daily = { used: (await dailyMinutes(c.dailyKey)).mins, cap: c.dailyCap }; } catch (e: any) { out.daily = { err: String(e?.message || e).slice(0, 120), cap: c.dailyCap }; } }
  return out;
}
