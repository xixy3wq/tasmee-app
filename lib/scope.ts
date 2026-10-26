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
/** الحلقات اللي يقدر يشوفها المدير، أو null = كلها */
export async function scopeHalqaIds(u: U): Promise<string[] | null> {
  const s = scopeSpec(u); if (!s) return null;
  const hs = await prisma.halqa.findMany({ where: { OR: [{ id: { in: s.h } }, { branch: { in: s.b } }] }, select: { id: true } });
  return hs.map((x) => x.id);
}
