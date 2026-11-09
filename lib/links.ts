import crypto from "node:crypto";
// روابط تعمل بدون دخول: سجل الطالب لولي الأمر (/s/...) وشاشة الجامع (/screen?k=...).
// موقّعة بـ AUTH_SECRET فلا يمكن تخمينها، ورقم النسخة يلغي الرابط القديم عند تجديده.
const key = () => process.env.AUTH_SECRET || "";
const sig = (s: string) => crypto.createHmac("sha256", key()).update(s).digest("base64url").slice(0, 22);
const same = (a: string, b: string) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** رابط سجل الطالب: <id>.<توقيع> */
export function cardToken(id: string, v: number) { return key() ? id + "." + sig(`card:${id}:${v || 0}`) : ""; }
export function cardParse(tok: string) { const i = tok.lastIndexOf("."); return i > 0 ? { id: tok.slice(0, i), s: tok.slice(i + 1) } : null; }
export function cardOk(id: string, v: number, s: string) { return !!key() && same(s, sig(`card:${id}:${v || 0}`)); }

/** مفتاح شاشة الجامع: خاص بالقسم (m/f) والمجمع («*» كل المجمعات، «_» الأساسي)، فلا يفتح رابطُ مجمعٍ مجمعًا آخر */
const scr = (v: number, side: string, b: string) => `screen:${v || 0}:${side}:${b}`;
export function screenKey(v: number, side: string, b: string) { return key() ? sig(scr(v, side, b)) : ""; }
export function screenOk(v: number, side: string, b: string, k: string) { return !!key() && !!k && same(k, sig(scr(v, side, b))); }
