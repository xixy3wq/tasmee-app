export const dynamic = "force-dynamic";

// أخطاء المتصفح (جوالات الطلاب والمعلمين): تنكتب في سجلات Vercel بس، بدون قاعدة البيانات،
// وتطلع في تجميع الأخطاء عند Vercel لمدة 7 أيام عشان تنقرا وتنحل.
// حد أعلى لكل خادم: 30 خطأ بالدقيقة، عشان ما ينملأ السجل لو صار خلل عند الكل مرة وحدة.
const g = globalThis as unknown as { errWin?: { t: number; n: number } };
const cut = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const done = () => new Response(null, { status: 204 });

export async function POST(req: Request) {
  const now = Date.now();
  const w = (g.errWin = g.errWin && now - g.errWin.t < 60_000 ? g.errWin : { t: now, n: 0 });
  if (++w.n > 30) return done();
  let b: Record<string, unknown> = {};
  try { b = JSON.parse((await req.text()).slice(0, 6000)); } catch { return done(); }
  const m = cut(b.m, 300);
  if (!m) return done();
  const stack = String(b.s ?? "").slice(0, 1500).split("\n").filter((l) => l.trim() && !l.includes(m)).map((l) => "    " + l.trim()).join("\n");
  const e = new Error(m);
  e.stack = `${m}\n${stack}\n    الصفحة=${cut(b.u, 100)} النسخة=${cut(b.v, 10)} الجهاز=${cut(req.headers.get("user-agent"), 160)}`;
  console.error("client", e);
  return done();
}
