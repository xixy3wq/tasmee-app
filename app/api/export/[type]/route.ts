import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { SN } from "@/lib/quran";
export const dynamic = "force-dynamic";
// تصدير CSV لـ Google Sheets: =IMPORTDATA("https://الموقع/api/export/students?key=المفتاح")
const csv = (rows: (string | number | null | undefined)[][]) => "﻿" + rows.map((r) => r.map((v) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(",")).join("\n");
export async function GET(req: Request, { params }: { params: { type: string } }) {
  const s: any = await getSettings();
  const key = new URL(req.url).searchParams.get("key");
  if (!s.exportKey || key !== s.exportKey) return new Response("unauthorized", { status: 401 });
  const halaqat = await prisma.halqa.findMany(); const hn = (id?: string | null) => halaqat.find((h) => h.id === id)?.name || "";
  const users = await prisma.user.findMany({ where: { role: "student", status: { in: ["active", "disabled", "archived"] } } });
  const un = (id: string) => users.find((u) => u.id === id)?.name || "";
  const ATT: any = { p: "حاضر", l: "متأخر", a: "غائب", e: "مستأذن" };
  const TYPE: any = { new: "حفظ", review: "مراجعة", tath: "تثبيت" };
  let rows: any[][] = [];
  if (params.type === "students") {
    rows = [["الاسم", "اسم المستخدم", "الحلقة", "الحالة", "اسم ولي الأمر", "جوال ولي الأمر", "جوال الطالب", "العمر", "تاريخ الاعتماد"]];
    users.forEach((u) => { const i: any = u.info || {}; rows.push([u.name, u.username, hn(u.halqaId), u.status, i.parentName, i.parentPhone, i.phone, i.age, u.approvedAt?.toISOString().slice(0, 10)]); });
  } else if (params.type === "attendance") {
    rows = [["التاريخ", "الحلقة", "الطالب", "الحالة"]];
    const ls = await prisma.lesson.findMany({ where: { cancelled: false }, orderBy: { date: "desc" }, take: 2000 });
    ls.forEach((l) => Object.entries((l.att as any) || {}).forEach(([uid, v]) => rows.push([l.date, hn(l.halqaId), un(uid), ATT[v as string] || v])));
  } else if (params.type === "recs") {
    rows = [["التاريخ", "الحلقة", "الطالب", "النوع", "السورة", "من", "إلى", "الأخطاء", "التنبيهات", "التقدير", "ملاحظة"]];
    const rs = await prisma.rec.findMany({ orderBy: { date: "desc" }, take: 5000 });
    rs.forEach((r) => rows.push([r.date, hn(r.halqaId), un(r.userId), TYPE[r.type], SN[r.surah - 1], r.fromA, r.toA, r.quick ? "" : r.mistakes, r.quick ? "" : r.alerts, r.grade, r.note]));
  } else return new Response("unknown type", { status: 404 });
  return new Response(csv(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "no-store" } });
}
