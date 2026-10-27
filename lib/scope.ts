import { prisma } from "./db";
// الموقع قسمين منفصلين: البنين (m) والبنات (f). المدير العام بس يشوف القسمين ويتنقل بينهم،
// وكل مشرف أو معلم أو طالب يشوف قسمه بس.
// نطاق المشرف داخل قسمه: "h:<halqaId>" أو "b:<اسم الفرع>" داخل perms. بدونها = كل حلقات قسمه.
type U = { id?: string; role: string; perms?: unknown; side?: string | null; halqaId?: string | null };
export type Side = "m" | "f";
export const isSuper = (u: U) => u.role === "admin" && !Array.isArray(u.perms);
export const sideVal = (v: unknown): Side => (v === "f" ? "f" : "m");
/** شرط الحلقات حسب القسم */
export const genderWhere = (s: Side) => (s === "f" ? { gender: "f" } : { gender: { not: "f" } });

export function scopeSpec(u: U): { h: string[]; b: string[] } | null {
  if (u.role !== "admin" || !Array.isArray(u.perms)) return null;
  const p = u.perms as string[];
  const h = p.filter((x) => typeof x === "string" && x.startsWith("h:")).map((x) => x.slice(2));
  const b = p.filter((x) => typeof x === "string" && x.startsWith("b:")).map((x) => x.slice(2));
  return h.length || b.length ? { h, b } : null;
}

/** قسم المستخدم، أو null للمدير العام */
export async function sideOf(u: U): Promise<Side | null> {
  if (isSuper(u)) return null;
  if (u.role === "student" && u.halqaId) {
    const h = await prisma.halqa.findUnique({ where: { id: u.halqaId }, select: { gender: true } });
    if (h) return sideVal(h.gender);
  }
  if (u.role === "teacher" && u.side !== "f" && u.id) {
    // معلمة أُسندت لها حلقات بنات قبل ما يكون لها قسم
    const hs = await prisma.halqa.findMany({ where: { teacherId: u.id }, select: { gender: true } });
    if (hs.length && hs.every((h) => h.gender === "f")) return "f";
  }
  return sideVal(u.side);
}
/** القسم المعروض: المدير العام يختار، والباقي قسمهم */
export async function viewSide(u: U, want?: unknown): Promise<Side> {
  return (await sideOf(u)) ?? sideVal(want);
}

/** الحلقات اللي يقدر يشوفها المدير، أو null = كل الحلقات (المدير العام) */
export async function scopeHalqaIds(u: U): Promise<string[] | null> {
  if (u.role !== "admin" || isSuper(u)) return null;
  const s = scopeSpec(u);
  const where: any = genderWhere(sideVal(u.side));
  if (s) where.OR = [{ id: { in: s.h } }, { branch: { in: s.b } }];
  return (await prisma.halqa.findMany({ where, select: { id: true } })).map((x) => x.id);
}
