import { SignJWT, importPKCS8 } from "jose";
import { prisma } from "./db";
// غرفة الحصة داخل الموقع: JaaS (من فريق Jitsi) أو Daily.
// المفاتيح محفوظة في جدول Setting بالمفتاح "video" وما تطلع للواجهة أبد.
export type VideoCfg = {
  provider: "none" | "jaas" | "daily";
  jaasApp: string; jaasKid: string; jaasKey: string;
  dailyKey: string;
};
export const VIDEO_DEF: VideoCfg = { provider: "none", jaasApp: "", jaasKid: "", jaasKey: "", dailyKey: "" };
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
export const videoPublic = (c: VideoCfg) => ({ provider: c.provider, jaasApp: c.jaasApp, jaasKid: c.jaasKid, hasJaasKey: !!c.jaasKey, hasDailyKey: !!c.dailyKey, on: videoOn(c), jaasOn: jaasOk(c), dailyOn: dailyOk(c), order: videoOrder(c) });

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
    const cfg = ["config.prejoinConfig.enabled=false", "config.defaultLanguage=%22ar%22", "config.disableDeepLinking=true", `userInfo.displayName=%22${encodeURIComponent(user.name)}%22`].join("&");
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
    const t = await fetch("https://api.daily.co/v1/meeting-tokens", { method: "POST", headers: H, signal: AbortSignal.timeout(12000), body: JSON.stringify({ properties: { room_name: room, user_name: user.name, user_id: user.id.slice(0, 36), is_owner: moderator, exp } }) });
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
    try { return { url: await roomUrl(c, lessonId, user, moderator, 4, p), provider: p, hasAlt: videoOrder(c).length > 1 }; }
    catch (e) { lastErr = e; console.error("video " + p, e); }
  }
  throw lastErr || new Error("غرفة الحصة غير مفعّلة");
}
