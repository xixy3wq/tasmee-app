import { prisma } from "./db";
// نطاق المشرف: مدير مساعد يتابع حلقات أو فروع محددة فقط.
// يُخزن داخل perms كعناصر "h:<halqaId>" أو "b:<اسم الفرع>". بدونها = كل الحلقات.
type U = { role: string; perms?: unknown };
export function scopeSpec(u: U): { h: string[]; b: string[] } | null {
  if (u.role !== "admin" || !Array.isArray(u.perms)) return null;
  const p = u.perms as string[];
  const h = p.filter((x) => typeof x === "string" && x.startsWith("h:")).map((x) => x.slice(2));
  const b = p.filter((x) => typeof x === "string" && x.startsWith("b:")).map((x) => x.slice(2));
  return h.length || b.length ? { h, b } : null;
}
/** الحلقات اللي يقدر يشوفها المدير، أو null = كلها.
 *  حلقات البنات يشوفها المدير العام بس، أو المشرف اللي اختيرت له بالاسم (h:) */
export async function scopeHalqaIds(u: U): Promise<string[] | null> {
  if (u.role !== "admin" || !Array.isArray(u.perms)) return null;
  const s = scopeSpec(u);
  if (!s) {
    const all = await prisma.halqa.findMany({ select: { id: true, gender: true } });
    if (!all.some((h) => h.gender === "f")) return null;
    return all.filter((h) => h.gender !== "f").map((h) => h.id);
  }
  const hs = await prisma.halqa.findMany({ where: { OR: [{ id: { in: s.h } }, { branch: { in: s.b }, gender: { not: "f" } }] }, select: { id: true } });
  return hs.map((x) => x.id);
}
/** جهة الموظف لغرفة المعلمين: f معلمات ومشرفات حلقات البنات، m الباقي، all المدير العام */
export async function staffSide(u: U & { id: string }): Promise<"all" | "f" | "m"> {
  if (u.role === "admin" && !Array.isArray(u.perms)) return "all";
  let ids: string[] = [];
  if (u.role === "teacher") ids = (await prisma.halqa.findMany({ where: { teacherId: u.id }, select: { id: true } })).map((h) => h.id);
  else if (u.role === "admin") { const s = scopeSpec(u); if (!s || s.b.length) return "m"; ids = s.h; }
  if (!ids.length) return "m";
  const hs = await prisma.halqa.findMany({ where: { id: { in: ids } }, select: { gender: true } });
  return hs.length && hs.every((h) => h.gender === "f") ? "f" : "m";
}
