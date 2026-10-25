import { prisma } from "@/lib/db";
import { getSettings, isHoliday, localDate, weekday } from "@/lib/settings";
export const dynamic = "force-dynamic";
// تقويم الحلقة بصيغة ICS للإضافة لتقويم الجوال (يتحدث تلقائيًا)
const esc = (s: string) => s.replace(/[\;,]/g, (m) => "\\" + m).replace(/\n/g, "\\n");
export async function GET(_req: Request, { params }: { params: { hid: string } }) {
  const hid = params.hid.replace(/\.ics$/, "");
  const h = await prisma.halqa.findUnique({ where: { id: hid } });
  if (!h) return new Response("not found", { status: 404 });
  const s = await getSettings();
  const from = localDate(-7), to = localDate(60);
  const lessons = await prisma.lesson.findMany({ where: { halqaId: hid, date: { gte: from, lte: to } } });
  const byDate = new Map(lessons.map((l) => [l.date, l]));
  const events: { date: string; time: string; id: string; note: string; link: string }[] = [];
  lessons.filter((l) => !l.cancelled).forEach((l) => events.push({ date: l.date, time: l.time || h.time, id: l.id, note: l.note, link: l.link || h.link }));
  if (h.auto && h.days.length && h.time) {
    for (let i = 0; i <= 60; i++) {
      const d = localDate(i);
      if (byDate.has(d) || !h.days.includes(weekday(d)) || isHoliday(s, d)) continue;
      events.push({ date: d, time: h.time, id: "auto-" + hid + "-" + d, note: "", link: h.link });
    }
  }
  const off = Number(process.env.APP_TZ_OFFSET_MIN ?? 180);
  const utc = (date: string, time: string, addMin = 0) => {
    const [hh, mm] = (time || "00:00").split(":").map(Number);
    const t = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), hh, mm) - off * 60000 + addMin * 60000;
    return new Date(t).toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  };
  const now = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//irtaq//halaqat//AR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:" + esc(h.name), "REFRESH-INTERVAL;VALUE=DURATION:PT6H"];
  for (const e of events) {
    if (!e.time) continue;
    lines.push("BEGIN:VEVENT", "UID:" + e.id + "@irtaq", "DTSTAMP:" + now, "DTSTART:" + utc(e.date, e.time), "DTEND:" + utc(e.date, e.time, 60),
      "SUMMARY:" + esc("حصة " + h.name), ...(e.link ? ["URL:" + e.link, "DESCRIPTION:" + esc((e.note ? e.note + "\n" : "") + "رابط الحصة: " + e.link)] : e.note ? ["DESCRIPTION:" + esc(e.note)] : []),
      "BEGIN:VALARM", "TRIGGER:-PT15M", "ACTION:DISPLAY", "DESCRIPTION:" + esc("تبدأ حصة " + h.name + " بعد 15 دقيقة"), "END:VALARM", "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return new Response(lines.join("\r\n"), { headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "public, max-age=1800" } });
}
