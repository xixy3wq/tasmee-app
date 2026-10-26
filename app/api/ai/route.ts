import { prisma } from "@/lib/db";
import { currentUser, handle, fail, str } from "@/lib/auth";
import { getSettings, localDate } from "@/lib/settings";
import { scopeHalqaIds } from "@/lib/scope";
import { audit } from "@/lib/audit";
import { SN } from "@/lib/quran";
import { aiCfg, aiOn, callLlm, type ToolSpec, type ChatMsg } from "@/lib/ai";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const TYPE: Record<string, string> = { new: "حفظ", review: "مراجعة", tath: "تثبيت" };
const wd = (d: string) => DAYS[new Date(d + "T12:00:00Z").getUTCDay()];
const hj = (d: string) => { try { return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(d + "T12:00:00Z")); } catch { return ""; } };
const norm = (s: string) => String(s || "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/\s+/g, " ").trim();
const isDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const mask = (k?: string) => (k ? "••••" + k.slice(-4) : null);

const TOOLS: ToolSpec[] = [
  { name: "add_event", description: "إضافة اختبار أو مناسبة في تقويم الطلاب", parameters: { type: "object", properties: { name: { type: "string" }, date: { type: "string", description: "YYYY-MM-DD ميلادي" }, kind: { type: "string", enum: ["exam", "event"] } }, required: ["name", "date"] } },
  { name: "add_holiday", description: "إضافة إجازة (ما تنعقد فيها حصص)", parameters: { type: "object", properties: { name: { type: "string" }, from: { type: "string", description: "YYYY-MM-DD" }, to: { type: "string", description: "YYYY-MM-DD" } }, required: ["name", "from"] } },
  { name: "post_announcement", description: "نشر إعلان للطلاب وأولياء الأمور", parameters: { type: "object", properties: { title: { type: "string" }, body: { type: "string" }, halqa: { type: "string", description: "اسم الحلقة، أو فارغ لكل الحلقات (للمدير)" } }, required: ["title"] } },
  { name: "create_poll", description: "تصويت سريع للطلاب وأولياء الأمور", parameters: { type: "object", properties: { question: { type: "string" }, options: { type: "array", items: { type: "string" } }, halqa: { type: "string" } }, required: ["question", "options"] } },
  { name: "message_students", description: "رسالة داخل الموقع لطلاب محددين وأولياء أمورهم (أسماؤهم من القائمة، أو [\"الكل\"])", parameters: { type: "object", properties: { students: { type: "array", items: { type: "string" } }, text: { type: "string" } }, required: ["students", "text"] } },
  { name: "add_behavior", description: "تسجيل ملاحظة سلوك لطالب", parameters: { type: "object", properties: { student: { type: "string" }, kind: { type: "string", enum: ["good", "bad"] }, text: { type: "string" }, visible: { type: "boolean", description: "يشوفها ولي الأمر" } }, required: ["student", "text"] } },
  { name: "add_lesson", description: "إضافة حصة إضافية لحلقة", parameters: { type: "object", properties: { halqa: { type: "string" }, date: { type: "string", description: "YYYY-MM-DD" }, time: { type: "string", description: "HH:MM بنظام 24 ساعة" }, note: { type: "string" } }, required: ["date"] } },
  { name: "cancel_lesson", description: "إلغاء حصة حلقة في تاريخ معيّن", parameters: { type: "object", properties: { halqa: { type: "string" }, date: { type: "string" }, note: { type: "string", description: "سبب الإلغاء" } }, required: ["date"] } },
];

async function context(u: any) {
  const sc = u.role === "admin" ? await scopeHalqaIds(u) : null;
  const halaqat = await prisma.halqa.findMany({ where: u.role === "admin" ? (sc ? { id: { in: sc } } : {}) : { teacherId: u.id }, orderBy: { name: "asc" } });
  const hIds = halaqat.map((h) => h.id);
  const studs = await prisma.user.findMany({ where: { role: "student", status: "active", halqaId: { in: hIds } }, orderBy: { name: "asc" }, take: 400 });
  const since = localDate(-30), to = localDate(14);
  const [lessons, recs] = await Promise.all([
    prisma.lesson.findMany({ where: { halqaId: { in: hIds }, date: { gte: since, lte: to } }, orderBy: [{ date: "asc" }, { time: "asc" }] }),
    prisma.rec.findMany({ where: { userId: { in: studs.map((s) => s.id) }, date: { gte: since } }, orderBy: { at: "desc" } }),
  ]);
  return { halaqat, studs, lessons, recs, settings: await getSettings() };
}
const findH = (halaqat: any[], name: unknown) => { if (typeof name !== "string" || !name.trim()) return halaqat.length === 1 ? halaqat[0] : null; const n = norm(name); return halaqat.find((h) => norm(h.name) === n) || halaqat.find((h) => norm(h.name).includes(n) || n.includes(norm(h.name))) || null; };
const findS = (studs: any[], names: unknown) => {
  const arr = Array.isArray(names) ? names.map(String) : typeof names === "string" ? [names] : [];
  if (arr.some((n) => /^(الكل|الجميع|كل الطلاب|all)$/i.test(n.trim()))) return studs;
  return studs.filter((s) => arr.some((n) => { const a = norm(s.name), b = norm(n); return a === b || a.includes(b) || b.includes(a.split(" ").slice(0, 2).join(" ")); }));
};

/* ---------- المساعد للطالب وولي الأمر: يجاوب عن بياناته هو فقط ---------- */
const STU_TOOLS: ToolSpec[] = [
  { name: "message_teacher", description: "إرسال رسالة لمعلم الحلقة (بعد تأكيد الطالب)", parameters: { type: "object", properties: { text: { type: "string" } }, required: ["text"] } },
];
async function studentChat(u: any, b: any) {
  const row = await prisma.setting.findUnique({ where: { key: "ai" } }); const raw: any = (row?.value as any) || {};
  if (raw.students === false) fail("المساعد غير متاح للطلاب حاليًا");
  const cfg = await aiCfg(); if (!aiOn(cfg)) fail("المساعد غير مفعّل");
  // حد يومي لكل طالب عشان ما تخلص الباقة المجانية
  const today = localDate(); const lim = Math.min(200, Math.max(1, Number(raw.studentLimit) || 25)); const qk = "aiq:" + today;
  const qrow = await prisma.setting.findUnique({ where: { key: qk } }); const used: Record<string, number> = { ...((qrow?.value as any) || {}) };
  if ((used[u.id] || 0) >= lim) fail(`وصلت حد اليوم (${lim} سؤال). ارجع بكرة إن شاء الله`);
  const messages: ChatMsg[] = (Array.isArray(b.messages) ? b.messages : []).slice(-10).map((m: any) => ({ role: m.role === "assistant" ? "assistant" : "user", text: str(m.text, 2000) })).filter((m: ChatMsg) => m.text);
  if (!messages.length || messages[messages.length - 1].role !== "user") fail("اكتب سؤالك");
  const s = await getSettings();
  const h = u.halqaId ? await prisma.halqa.findUnique({ where: { id: u.halqaId } }) : null;
  const teacher = h?.teacherId ? await prisma.user.findUnique({ where: { id: h.teacherId }, select: { name: true } }) : null;
  const [lessons, recs, behav] = await Promise.all([
    u.halqaId ? prisma.lesson.findMany({ where: { halqaId: u.halqaId, date: { gte: localDate(-30), lte: localDate(14) } }, orderBy: [{ date: "asc" }, { time: "asc" }] }) : Promise.resolve([] as any[]),
    prisma.rec.findMany({ where: { userId: u.id }, orderBy: { at: "desc" }, take: 25 }),
    prisma.behav.findMany({ where: { userId: u.id, visible: true }, orderBy: { at: "desc" }, take: 5 }),
  ]);
  const past = lessons.filter((l: any) => l.date <= today && !l.cancelled); const att = past.map((l: any) => ((l.att as any) || {})[u.id]).filter(Boolean);
  const pres = att.filter((v: string) => v === "p" || v === "l").length, abs = att.filter((v: string) => v === "a").length;
  const next = lessons.filter((l: any) => l.date >= today && !l.cancelled).slice(0, 5).map((l: any) => `${l.date} ${wd(l.date)} ${l.time}`);
  const due = str(b.due, 600);
  const system = [
    `أنت «مساعد ارتق»: مساعد لطيف للطالب وولي أمره في موقع «${s.center}» لحلقات تسميع القرآن عن بعد. ترد بلهجة سعودية بسيطة ومختصرة تناسب الطلاب.`,
    `الطالب: ${u.name}. الحلقة: ${h?.name || "—"}${teacher ? ` (المعلم: ${teacher.name})` : ""}. أيام الحلقة: ${h ? h.days.map((d: number) => DAYS[d]).join("، ") + " " + h.time : "—"}. اليوم ${today} = ${hj(today)} (${wd(today)}).`,
    "قواعد: جاوب عن بيانات هذا الطالب فقط من المعطى. ساعده في طرق الحفظ والمراجعة والتثبيت وتنظيم الوقت بنصائح عملية. لأسئلة المعاني اعطِ معنى عام مختصر مما هو معروف في التفاسير، وانصحه يسأل معلمه للتفصيل، ولا تفتِ في الأحكام. لا تكتب نص آيات من ذاكرتك (قد تخطئ)؛ اذكر اسم السورة ورقم الآية وانصحه يرجع للمصحف. إذا طلب يراسل المعلم استخدم أداة الرسالة. لا تخترع أرقاماً غير موجودة.",
    due ? `المطلوب منه في خطته الحالية: ${due}` : "",
    `الحضور آخر 30 يوم: ${pres} من ${past.length}${abs ? ` (غاب ${abs})` : ""}.`,
    `الحصص القادمة: ${next.join("؛ ") || "لا يوجد"}.`,
    `آخر تسميعاته: ${recs.map((r) => `${r.date} ${TYPE[r.type] || ""} ${SN[r.surah - 1]} ${r.fromA}-${r.toA}: ${r.grade}${r.mistakes ? ` (${r.mistakes} أخطاء)` : ""}${r.note ? ` — ملاحظة: ${r.note}` : ""}`).join("؛ ") || "ما فيه"}.`,
    behav.length ? `ملاحظات المعلم: ${behav.map((x) => x.text).join("؛ ")}.` : "",
    `الإجازات القادمة: ${(s.holidays || []).filter((x) => x.to >= today).map((x) => `${x.name} ${x.from}→${x.to}`).join("؛ ") || "لا يوجد"}. الاختبارات والمناسبات: ${((s as any).events || []).filter((e: any) => e.date >= today).map((e: any) => `${e.date} ${e.name}`).join("؛ ") || "لا يوجد"}.`,
    `التقويم للأيام الـ 14 القادمة: ${Array.from({ length: 14 }, (_, i) => { const d = localDate(i); return `${d}=${wd(d)}`; }).join("، ")}`,
  ].filter(Boolean).join("\n\n");
  let out: any;
  try { out = await callLlm(system, messages, h ? STU_TOOLS : [], cfg); } catch (e: any) { fail(String(e.message), 503); }
  used[u.id] = (used[u.id] || 0) + 1;
  await prisma.setting.upsert({ where: { key: qk }, create: { key: qk, value: used }, update: { value: used } }).catch(() => {});
  const actions = (out.calls || []).filter((c: any) => c.name === "message_teacher" && c.args?.text).map((c: any) => ({ summary: `✉ رسالة للمعلم: ${String(c.args.text).slice(0, 200)}`, t: "dm.send", payload: { text: String(c.args.text).slice(0, 1000) } }));
  return { text: out.text || (actions.length ? "جهزت الرسالة، راجعها واضغط «تنفيذ»:" : "…"), actions, left: lim - used[u.id] };
}

export async function POST(req: Request) {
  return handle(async () => {
    const u = await currentUser(); if (!u) fail("انتهت الجلسة", 401);
    const b = await req.json().catch(() => ({}));
    const full = u!.role === "admin" && !u!.perms;
    const t = String(b.t || "");
    if (t === "get" || t === "save" || t === "test") {
      if (!full) fail("إعداد المساعد للمدير الكامل فقط", 403);
      const row = await prisma.setting.findUnique({ where: { key: "ai" } }); const c: any = { ...((row?.value as any) || {}) };
      if (t === "get") { const e = await aiCfg(); return { gemini: mask(e.gemini), claude: mask(e.claude), model: c.geminiModel || "", on: aiOn(e), students: c.students !== false, studentLimit: c.studentLimit || 25, fromEnv: !!(process.env.IRTAQ_GEMINI_KEY || process.env.IRTAQ_ANTHROPIC_KEY) }; }
      if (t === "save") {
        if (b.gemini !== undefined) c.gemini = str(b.gemini, 200).trim() || undefined;
        if (b.claude !== undefined) c.claude = str(b.claude, 300).trim() || undefined;
        if (b.geminiModel !== undefined) c.geminiModel = str(b.geminiModel, 60).trim() || undefined;
        if (b.students !== undefined) c.students = !!b.students;
        if (b.studentLimit !== undefined) c.studentLimit = Math.min(200, Math.max(1, Number(b.studentLimit) || 25));
        await prisma.setting.upsert({ where: { key: "ai" }, create: { key: "ai", value: c }, update: { value: c } });
        await audit(u!, "ai.save", null, "إعداد المساعد الذكي");
        return { ok: true };
      }
      const out = await callLlm("رد بكلمة واحدة.", [{ role: "user", text: "قل: تمام" }]).catch((e) => fail(String(e.message), 422));
      return { reply: (out as any).text };
    }
    if (u!.role === "student") {
      if (t !== "chat") fail("غير مصرح", 403);
      return await studentChat(u!, b);
    }

    if (t === "parentMsg") {
      const st = await prisma.user.findUnique({ where: { id: str(b.studentId) } });
      if (!st || st.role !== "student") fail("الطالب غير موجود", 404);
      const ctx = await context(u); if (!ctx.studs.some((x) => x.id === st!.id)) fail("الطالب خارج نطاقك", 403);
      const since = localDate(-14);
      const ls = ctx.lessons.filter((l) => l.halqaId === st!.halqaId && !l.cancelled && l.date >= since && l.date <= localDate());
      const att = ls.map((l) => ((l.att as any) || {})[st!.id]).filter(Boolean);
      const pres = att.filter((v: string) => v === "p" || v === "l").length, abs = att.filter((v: string) => v === "a").length;
      const rs = ctx.recs.filter((r) => r.userId === st!.id && r.date >= since);
      const notes = rs.map((r) => r.note).filter(Boolean).slice(0, 3);
      const facts = [`الطالب: ${st!.name}`, `الحضور آخر أسبوعين: ${pres} من ${ls.length}${abs ? ` (غاب ${abs})` : ""}`,
        `التسميع: ${rs.length ? rs.slice(0, 8).map((r) => `${TYPE[r.type] || ""} ${SN[r.surah - 1]} ${r.fromA}-${r.toA}: ${r.grade}`).join("، ") : "ما سمّع"}`,
        notes.length ? `ملاحظات المعلم: ${notes.join(" / ")}` : "", b.extra ? `إضافة من المعلم: ${str(b.extra, 300)}` : ""].filter(Boolean).join("\n");
      const tone = b.tone === "praise" ? "ثناء وتشجيع" : b.tone === "concern" ? "قلق بلطف وطلب تعاون" : "اطمئنان";
      const cfg = await aiCfg(); if (!aiOn(cfg)) fail("المساعد غير مفعّل");
      const out = await callLlm("أنت تكتب رسائل واتساب من معلم حلقة تحفيظ قرآن لولي أمر الطالب. اكتب بعربية واضحة ودودة، بدون مبالغة، ولا تخترع معلومات غير موجودة. أعد نص الرسالة فقط.", [{ role: "user", text: `اكتب رسالة قصيرة (أقل من 80 كلمة) نبرتها: ${tone}. ابدأ بالسلام، واذكر اسم الطالب الأول، ووقّعها باسم ${u!.name}.\n\nالمعلومات:\n${facts}` }], [], cfg).catch((e) => fail(String(e.message), 503));
      return { text: (out as any).text };
    }

    if (t !== "chat") fail("طلب غير معروف");
    const messages: ChatMsg[] = (Array.isArray(b.messages) ? b.messages : []).slice(-12).map((m: any) => ({ role: m.role === "assistant" ? "assistant" : "user", text: str(m.text, 4000) })).filter((m: ChatMsg) => m.text);
    if (!messages.length || messages[messages.length - 1].role !== "user") fail("اكتب سؤالك");
    const cfg = await aiCfg(); if (!aiOn(cfg)) fail("المساعد غير مفعّل. المدير يضيف المفتاح من الإعدادات ← المساعد الذكي");
    const ctx = await context(u);
    const today = localDate(); const s = ctx.settings;
    const hName = (id: string | null) => ctx.halaqat.find((h) => h.id === id)?.name || "";
    const studLines = ctx.studs.map((st) => {
      const ls = ctx.lessons.filter((l) => l.halqaId === st.halqaId && !l.cancelled && l.date <= today);
      const att = ls.map((l) => ((l.att as any) || {})[st.id]).filter(Boolean);
      const p = att.filter((v: string) => v === "p" || v === "l").length, a = att.filter((v: string) => v === "a").length;
      const rs = ctx.recs.filter((r) => r.userId === st.id); const last = rs[0]; const re = rs.filter((r) => !r.pass).length;
      return `${st.name} | ${hName(st.halqaId)} | حضور ${p}/${ls.length}${a ? ` غاب ${a}` : ""} | تسميع ${rs.length}${last ? ` آخره ${last.date} ${last.grade}` : ""}${re ? ` | إعادات ${re}` : ""} | آخر دخول ${st.lastSeenAt ? st.lastSeenAt.toISOString().slice(0, 10) : "أبد"}`;
    });
    const up = ctx.lessons.filter((l) => l.date >= today).slice(0, 40).map((l) => `${l.date} ${wd(l.date)} ${l.time} ${hName(l.halqaId)}${l.cancelled ? " (ملغاة)" : ""}`);
    const system = [
      `أنت «مساعد ارتق»: مساعد ذكي داخل موقع «${s.center}» لحلقات تسميع القرآن عن بعد (حفظ ومراجعة وتثبيت). تتكلم بلهجة سعودية مهذبة ومختصرة.`,
      `المستخدم: ${u!.name} (${u!.role === "admin" ? "مدير" : "معلم"}). اليوم ${today} ميلادي = ${hj(today)} (${wd(today)}).`,
      "قواعد: إذا طلب المستخدم إضافة أو نشر أو إلغاء شيء استخدم الأدوات (لا تكتفِ بالكلام)، والإجراءات ما تنفذ إلا بعد تأكيده بزر. حوّل التواريخ الهجرية والأيام النسبية (الخميس الجاي…) لميلادي YYYY-MM-DD بدقة من التقويم المعطى. لأسئلة المتابعة (مين غاب، مين يحتاج متابعة، وش وضع طالب) جاوب من البيانات المعطاة بالأرقام. إذا طلب أفكار تحفيز أو طرق حفظ اقترح أفكار عملية مناسبة. لا تخترع طلاباً أو أرقاماً غير موجودة. إذا الطلب ناقص اسأل سؤالاً واحداً.",
      u!.role === "admin" ? "" : "تنبيه: المعلم ما يقدر يضيف إجازات أو مناسبات أو إعلانات لكل الحلقات — لا تقترح هذي الأدوات له إلا الإعلان والتصويت لحلقته.",
      `الحلقات: ${ctx.halaqat.map((h) => `${h.name} (${h.days.map((d) => DAYS[d]).join("، ")} ${h.time})`).join("؛ ") || "لا يوجد"}`,
      `الحصص (آخر 30 يوم مرّت، والقادمة): ${up.join("؛ ") || "لا يوجد"}`,
      `الإجازات: ${(s.holidays || []).filter((h) => h.to >= today).map((h) => `${h.name} ${h.from}→${h.to}`).join("؛ ") || "لا يوجد"}`,
      `الاختبارات والمناسبات: ${((s as any).events || []).filter((e: any) => e.date >= today).map((e: any) => `${e.date} ${e.name}`).join("؛ ") || "لا يوجد"}`,
      `الطلاب (${ctx.studs.length}) — الاسم | الحلقة | الحضور آخر 30 يوم | التسميع | آخر دخول:\n${studLines.join("\n") || "لا يوجد"}`,
      `التقويم للأيام الـ 21 القادمة: ${Array.from({ length: 21 }, (_, i) => { const d = localDate(i); return `${d}=${wd(d)} ${hj(d)}`; }).join("، ")}`,
    ].filter(Boolean).join("\n\n");
    let out: any;
    try { out = await callLlm(system, messages, TOOLS, cfg); } catch (e: any) { fail(String(e.message), 503); }

    const actions: { summary: string; t: string; payload: any; error?: string }[] = [];
    for (const c of out.calls) {
      const a: any = c.args || {};
      try {
        if (c.name === "add_event") { if (!isDay(a.date)) throw new Error("تاريخ غير صالح"); actions.push({ summary: `🗓 ${a.kind === "exam" ? "اختبار" : "مناسبة"}: «${a.name}» — ${wd(a.date)} ${a.date} (${hj(a.date)})`, t: "events.add", payload: { name: a.name, date: a.date, kind: a.kind === "exam" ? "exam" : "event" } }); }
        else if (c.name === "add_holiday") { if (!isDay(a.from)) throw new Error("تاريخ غير صالح"); const to = isDay(a.to) ? a.to : a.from; actions.push({ summary: `🏖 إجازة: «${a.name}» من ${a.from} (${hj(a.from)})${to !== a.from ? ` إلى ${to}` : ""}`, t: "holidays.add", payload: { name: a.name, from: a.from, to } }); }
        else if (c.name === "post_announcement") { const h = a.halqa ? findH(ctx.halaqat, a.halqa) : (u!.role === "admin" ? null : findH(ctx.halaqat, "")); if (a.halqa && !h) throw new Error("ما لقيت الحلقة"); actions.push({ summary: `📣 إعلان ${h ? "لـ" + h.name : "لكل الحلقات"}: ${a.title}${a.body ? " — " + String(a.body).slice(0, 100) : ""}`, t: "ann.save", payload: { title: a.title, body: a.body || "", halqaId: h ? h.id : "" } }); }
        else if (c.name === "create_poll") { const h = a.halqa ? findH(ctx.halaqat, a.halqa) : (u!.role === "admin" ? null : findH(ctx.halaqat, "")); const opts = (Array.isArray(a.options) ? a.options : []).map(String).filter(Boolean); if (opts.length < 2) throw new Error("يحتاج خيارين"); actions.push({ summary: `🗳 تصويت ${h ? "لـ" + h.name : "لكل الحلقات"}: ${a.question} (${opts.join(" / ")})`, t: "poll.save", payload: { question: a.question, options: opts, halqaId: h ? h.id : "" } }); }
        else if (c.name === "message_students") { const ss = findS(ctx.studs, a.students); if (!ss.length) throw new Error("ما لقيت الطلاب المذكورين"); actions.push({ summary: `✉ رسالة لـ ${ss.length === 1 ? ss[0].name : ss.length + " طلاب"}: ${String(a.text).slice(0, 120)}`, t: "dm.bulk", payload: { studentIds: ss.map((x) => x.id), text: a.text } }); }
        else if (c.name === "add_behavior") { const ss = findS(ctx.studs, a.student); if (ss.length !== 1) throw new Error("حدد الطالب بالاسم"); actions.push({ summary: `${a.kind === "bad" ? "⚠ تنبيه" : "⭐ ملاحظة إيجابية"} لـ ${ss[0].name}: ${a.text}`, t: "behav.add", payload: { userId: ss[0].id, kind: a.kind === "bad" ? "bad" : "good", text: a.text, visible: a.visible !== false } }); }
        else if (c.name === "add_lesson") { const h = findH(ctx.halaqat, a.halqa); if (!h) throw new Error("حدد الحلقة"); if (!isDay(a.date)) throw new Error("تاريخ غير صالح"); const tm = /^\d{1,2}:\d{2}$/.test(String(a.time || "")) ? String(a.time).padStart(5, "0") : h.time; actions.push({ summary: `➕ حصة إضافية لـ${h.name}: ${wd(a.date)} ${a.date} ${tm}${a.note ? " — " + a.note : ""}`, t: "lesson.save", payload: { data: { halqaId: h.id, date: a.date, time: tm, link: "", note: a.note || "" } } }); }
        else if (c.name === "cancel_lesson") { const h = findH(ctx.halaqat, a.halqa); if (!h) throw new Error("حدد الحلقة"); const l = ctx.lessons.find((x) => x.halqaId === h.id && x.date === a.date && !x.cancelled); if (!l) throw new Error("ما فيه حصة بهالتاريخ"); actions.push({ summary: `✖ إلغاء حصة ${h.name}: ${wd(a.date)} ${a.date}${a.note ? " — " + a.note : ""}`, t: "lesson.cancel", payload: { id: l.id, v: true, note: a.note || "" } }); }
      } catch (e: any) { actions.push({ summary: `⚠ ما قدرت أجهز: ${c.name}`, t: "", payload: null, error: e.message }); }
    }
    return { text: out.text || (actions.length ? "جهزت لك التالي، راجعه واضغط «تنفيذ»:" : "…"), actions };
  });
}
