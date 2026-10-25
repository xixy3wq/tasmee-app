import { prisma } from "./db";
// ربط الواتساب عبر مزوّد خارجي (مثل الواتس الذكي smart-whats.com).
// الإعداد في جدول Setting بالمفتاح "wa" ولا يُرسل للواجهة إلا للمدير الكامل.
export type WaCfg = {
  enabled: boolean; method: "GET" | "POST_FORM" | "POST_JSON"; url: string; body: string; okWord: string;
  autoAbsent: boolean; autoPresent: boolean; autoLate: boolean; autoRec: boolean; delayMin: number;
  tplPresent: string; tplLate: string; tplRec: string;
};
export const WA_DEF: WaCfg = {
  enabled: false, method: "GET", url: "", body: "", okWord: "",
  autoAbsent: true, autoPresent: false, autoLate: false, autoRec: false, delayMin: 10,
  tplPresent: "السلام عليكم ورحمة الله، نفيدكم بحضور ابنكم {الطالب} حلقة {الحلقة} اليوم {التاريخ}. جزاكم الله خيرًا.",
  tplLate: "السلام عليكم ورحمة الله، نفيدكم بتأخر ابنكم {الطالب} عن حلقة {الحلقة} اليوم {التاريخ}.",
  tplRec: "السلام عليكم ورحمة الله، تسميع ابنكم {الطالب} في حلقة {الحلقة} يوم {التاريخ}:\n{التسميع}",
};
export async function waCfg(): Promise<WaCfg> {
  const r = await prisma.setting.findUnique({ where: { key: "wa" } });
  return { ...WA_DEF, ...((r?.value as any) || {}) };
}
/** رقم دولي بدون + (السعودية افتراضيًا) */
export function intlPhone(p: string) {
  let d = String(p || "").replace(/[^\d]/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("05") && d.length === 10) d = "966" + d.slice(1);
  else if (d.startsWith("5") && d.length === 9) d = "966" + d;
  return d;
}
export const fillVars = (t: string, v: Record<string, string>) =>
  t.replace(/\{الطالب\}/g, v.student || "").replace(/\{الحلقة\}/g, v.halqa || "").replace(/\{التاريخ\}/g, v.date || "").replace(/\{التسميع\}/g, v.rec || "");

/** إرسال رسالة واحدة حسب قالب المزوّد. المتغيرات: {phone} {phone0} {message} */
export async function waSend(cfg: WaCfg, phone: string, text: string): Promise<{ ok: boolean; resp: string }> {
  const p = intlPhone(phone); if (!p) return { ok: false, resp: "رقم غير صالح" };
  const p0 = p.startsWith("966") ? "0" + p.slice(3) : p;
  const enc = (s: string) => encodeURIComponent(s);
  const sub = (tpl: string, mode: "url" | "json" | "raw") => tpl
    .replace(/\{phone\}/g, mode === "url" ? enc(p) : p).replace(/\{phone0\}/g, mode === "url" ? enc(p0) : p0)
    .replace(/\{message\}/g, mode === "url" ? enc(text) : mode === "json" ? JSON.stringify(text).slice(1, -1) : text);
  if (!/^https:\/\//i.test(cfg.url)) return { ok: false, resp: "رابط الإرسال لازم يبدأ بـ https://" };
  try {
    const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 15000);
    let r: Response;
    if (cfg.method === "GET") r = await fetch(sub(cfg.url, "url"), { signal: ctl.signal });
    else if (cfg.method === "POST_FORM") r = await fetch(sub(cfg.url, "url"), { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: sub(cfg.body, "url"), signal: ctl.signal });
    else r = await fetch(sub(cfg.url, "url"), { method: "POST", headers: { "Content-Type": "application/json" }, body: sub(cfg.body, "json"), signal: ctl.signal });
    clearTimeout(tm);
    const body = (await r.text()).slice(0, 400);
    const ok = r.ok && !/"(success|status|ok)"\s*:\s*(false|"(error|fail|failed)")/i.test(body) && (!cfg.okWord || body.toLowerCase().includes(cfg.okWord.toLowerCase()));
    return { ok, resp: `${r.status} ${body}` };
  } catch (e: any) { return { ok: false, resp: "تعذّر الاتصال: " + (e?.name === "AbortError" ? "انتهت المهلة" : String(e?.message || e)) }; }
}

/** إضافة أو تحديث رسالة في الطابور (نفس المفتاح يستبدل الرسالة المعلقة) */
export async function queueMsg(key: string, kind: string, phone: string, text: string, delayMin: number, meta: { userId?: string; lessonId?: string } = {}) {
  if (!intlPhone(phone)) return;
  const sendAfter = new Date(Date.now() + Math.max(0, delayMin) * 60000);
  const ex = await prisma.outMsg.findUnique({ where: { key } });
  if (ex && ex.status === "sent") {
    if (ex.kind === kind) return; // أُرسلت نفس الرسالة من قبل
    // تغيّرت الحالة بعد الإرسال (مثلًا من غائب إلى حاضر): رسالة جديدة بمفتاح مختلف
    key = key + "-" + kind;
    const ex2 = await prisma.outMsg.findUnique({ where: { key } });
    if (ex2 && ex2.status === "sent") return;
  }
  await prisma.outMsg.upsert({ where: { key }, create: { key, kind, toPhone: phone, text, sendAfter, userId: meta.userId, lessonId: meta.lessonId }, update: { kind, toPhone: phone, text, sendAfter, status: "pending", tries: 0, resp: "" } });
}
export async function cancelMsg(key: string) {
  await prisma.outMsg.updateMany({ where: { key: { startsWith: key }, status: "pending" }, data: { status: "cancelled" } });
}
/** إرسال الرسائل المستحقة (يُستدعى مع طلبات الموقع ومن المهمة الدورية) */
let busy = false;
export async function processQueue(limit = 8) {
  if (busy) return 0; busy = true;
  try {
    const cfg = await waCfg(); if (!cfg.enabled || !cfg.url) return 0;
    const due = await prisma.outMsg.findMany({ where: { status: "pending", sendAfter: { lte: new Date() } }, orderBy: { sendAfter: "asc" }, take: limit });
    let n = 0;
    for (const m of due) {
      const claim = await prisma.outMsg.updateMany({ where: { id: m.id, status: "pending" }, data: { status: "sending" } });
      if (claim.count !== 1) continue;
      const r = await waSend(cfg, m.toPhone, m.text);
      const tries = m.tries + 1;
      await prisma.outMsg.update({ where: { id: m.id }, data: r.ok ? { status: "sent", sentAt: new Date(), resp: r.resp, tries } : { status: tries >= 3 ? "failed" : "pending", sendAfter: new Date(Date.now() + 2 * 60000), resp: r.resp, tries } });
      if (r.ok) n++;
    }
    return n;
  } catch (e) { console.error("wa queue", e); return 0; }
  finally { busy = false; }
}
