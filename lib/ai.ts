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

export async function callLlm(system: string, history: ChatMsg[], tools: ToolSpec[] = [], cfg?: AiCfg): Promise<LlmOut> {
  const c = cfg || (await aiCfg());
  if (c.gemini) {
    const model = c.geminiModel || "gemini-flash-lite-latest";
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": c.gemini },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: history.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.text }] })),
        ...(tools.length ? { tools: [{ functionDeclarations: tools.map((t) => ({ name: t.name, description: t.description, parameters: toGemini(t.parameters) })) }] } : {}),
        generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
      }),
      signal: AbortSignal.timeout(45000),
    });
    const d: any = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(r.status === 429 ? "وصلنا حد الاستخدام المجاني للحين، جرّب بعد شوي" : `خطأ من Gemini: ${d.error?.message ?? r.status}`);
    const parts: any[] = d.candidates?.[0]?.content?.parts ?? [];
    return { text: parts.map((x) => x.text ?? "").join("").trim(), calls: parts.filter((x) => x.functionCall).map((x) => ({ name: x.functionCall.name, args: x.functionCall.args ?? {} })) };
  }
  if (c.claude) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: { "content-type": "application/json", "x-api-key": c.claude, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: process.env.IRTAQ_ANTHROPIC_MODEL || "claude-haiku-5-5", max_tokens: 2048, system,
        messages: history.map((m) => ({ role: m.role, content: m.text })),
        ...(tools.length ? { tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })) } : {}),
      }),
      signal: AbortSignal.timeout(45000),
    });
    const d: any = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`خطأ من Claude: ${d.error?.message ?? r.status}`);
    const cc: any[] = d.content ?? [];
    return { text: cc.filter((x) => x.type === "text").map((x) => x.text).join("").trim(), calls: cc.filter((x) => x.type === "tool_use").map((x) => ({ name: x.name, args: x.input ?? {} })) };
  }
  throw new Error("المساعد غير مفعّل. المدير يضيف المفتاح من الإعدادات ← المساعد الذكي");
}
