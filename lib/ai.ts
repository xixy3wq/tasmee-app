import { prisma } from "./db";
// المساعد الذكي لحلقات ارتق: Gemini (له باقة مجانية) أو Claude — بمفتاح خاص بهذا الموقع، مستقل عن أي موقع ثاني.
// المفتاح يُحفظ في جدول Setting بالمفتاح "ai" (أو من متغيرات Vercel) ولا يُرسل للمتصفح أبداً.
export type ToolSpec = { name: string; description: string; parameters: { type: "object"; properties: Record<string, unknown>; required?: string[] } };
export type ChatMsg = { role: "user" | "assistant"; text: string };
export type LlmOut = { text: string; calls: { name: string; args: Record<string, unknown> }[] };
export type AiCfg = { gemini?: string; claude?: string; geminiModel?: string };

export async function aiCfg(): Promise<AiCfg> {
  const r = await prisma.setting.findUnique({ where: { key: "ai" } });
  const db = ((r?.value as any) || {}) as AiCfg;
  return { gemini: process.env.IRTAQ_GEMINI_KEY || db.gemini, claude: process.env.IRTAQ_ANTHROPIC_KEY || db.claude, geminiModel: db.geminiModel };
}
export const aiOn = (c: AiCfg) => !!(c.gemini || c.claude);

function toGemini(s: unknown): unknown {
  if (Array.isArray(s)) return s.map(toGemini);
  if (s && typeof s === "object") { const o: Record<string, unknown> = {}; for (const [k, v] of Object.entries(s)) o[k] = k === "type" && typeof v === "string" ? v.toUpperCase() : toGemini(v); return o; }
  return s;
}

// النماذج البديلة: إذا كان نموذج مزحوم أو بطيء ننتقل للي بعده تلقائياً
const GEMINI_FALLBACK = ["gemini-flash-lite-latest", "gemini-2.5-flash-lite", "gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash"];
const busyErr = (status: number, msg: string) => [429, 500, 502, 503, 504].includes(status) || /overload|high demand|unavailable|try again|timeout|aborted/i.test(msg);
async function geminiOnce(key: string, model: string, system: string, history: ChatMsg[], tools: ToolSpec[], ms: number): Promise<LlmOut> {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: history.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.text }] })),
      ...(tools.length ? { tools: [{ functionDeclarations: tools.map((t) => ({ name: t.name, description: t.description, ...(Object.keys(t.parameters.properties || {}).length ? { parameters: toGemini(t.parameters) } : {}) })) }] } : {}),
      generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
    }),
    signal: AbortSignal.timeout(ms),
  });
  const d: any = await r.json().catch(() => ({}));
  if (!r.ok) { const e: any = new Error(d.error?.message ?? String(r.status)); e.status = r.status; throw e; }
  const parts: any[] = d.candidates?.[0]?.content?.parts ?? [];
  return { text: parts.filter((x) => !x.thought).map((x) => x.text ?? "").join("").trim(), calls: parts.filter((x) => x.functionCall).map((x) => ({ name: x.functionCall.name, args: x.functionCall.args ?? {} })) };
}

export async function callLlm(system: string, history: ChatMsg[], tools: ToolSpec[] = [], cfg?: AiCfg): Promise<LlmOut> {
  const c = cfg || (await aiCfg());
  // دمج الرسائل المتتالية من نفس الطرف (مثلاً سؤال فشل ثم سؤال جديد) وأول رسالة لازم تكون من المستخدم
  history = history.reduce((a: ChatMsg[], m) => { const l = a[a.length - 1]; if (l && l.role === m.role) l.text += "\n\n" + m.text; else a.push({ ...m }); return a; }, []);
  while (history.length && history[0].role !== "user") history.shift();
  const deadline = Date.now() + 48000; // نرد قبل ما ينقطع اتصال الجوال (60 ثانية)
  let lastErr: any = null;
  if (c.gemini) {
    const models = [...new Set([c.geminiModel || GEMINI_FALLBACK[0], ...GEMINI_FALLBACK])];
    for (const model of models) {
      const left = deadline - Date.now(); if (left < 4000) break;
      try { return await geminiOnce(c.gemini, model, system, history, tools, Math.min(20000, left)); }
      catch (e: any) {
        lastErr = e; const st = Number(e.status || 0);
        if (st === 400 && /api key|API_KEY/i.test(e.message)) throw new Error("مفتاح Gemini غير صحيح، تأكد منه في الإعدادات ← المساعد الذكي");
        if (st === 403) throw new Error("مفتاح Gemini ما له صلاحية، سوّ مفتاح جديد من aistudio.google.com");
        if (!(busyErr(st, String(e.message)) || st === 404)) break; // خطأ غير الزحمة: لا تكرر
      }
    }
    if (!c.claude) {
      const m = String(lastErr?.message || "");
      throw new Error(busyErr(Number(lastErr?.status || 0), m) ? "خدمة الذكاء الاصطناعي مزحومة الحين، جرّب بعد دقيقة" : "تعذّر الرد من Gemini: " + m.slice(0, 160));
    }
  }
  if (c.claude) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: { "content-type": "application/json", "x-api-key": c.claude, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: process.env.IRTAQ_ANTHROPIC_MODEL || "claude-haiku-5-5", max_tokens: 2048, system,
        messages: history.map((m) => ({ role: m.role, content: m.text })),
        ...(tools.length ? { tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })) } : {}),
      }),
      signal: AbortSignal.timeout(Math.max(5000, deadline - Date.now())),
    });
    const d: any = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(r.status === 529 || r.status === 503 ? "خدمة الذكاء الاصطناعي مزحومة الحين، جرّب بعد دقيقة" : `خطأ من Claude: ${d.error?.message ?? r.status}`);
    const cc: any[] = d.content ?? [];
    return { text: cc.filter((x) => x.type === "text").map((x) => x.text).join("").trim(), calls: cc.filter((x) => x.type === "tool_use").map((x) => ({ name: x.name, args: x.input ?? {} })) };
  }
  throw new Error("المساعد غير مفعّل. المدير يضيف المفتاح من الإعدادات ← المساعد الذكي");
}
