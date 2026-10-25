import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "./db";
import { SESSION_COOKIE, verifySession } from "./session";

export async function currentUser() {
  const id = await verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (!id) return null;
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u || u.status !== "active") return null;
  return u;
}
export type Me = NonNullable<Awaited<ReturnType<typeof currentUser>>>;

export class ApiError extends Error { status: number; constructor(msg: string, status = 400) { super(msg); this.status = status; } }
export const fail = (msg: string, status = 400): never => { throw new ApiError(msg, status); };
export function handle(fn: () => Promise<unknown>) {
  return fn().then(
    (r) => NextResponse.json(r ?? { ok: true }),
    (e) => {
      if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status });
      console.error(e);
      return NextResponse.json({ error: "حدث خطأ في الخادم، حاول مرة ثانية" }, { status: 500 });
    }
  );
}
export const USERNAME_RE = /^[a-z0-9_.]{3,30}$/;
export const cleanUsername = (s: unknown) => String(s ?? "").trim().toLowerCase();
export const str = (v: unknown, max = 300) => String(v ?? "").trim().slice(0, max);
export const int = (v: unknown, def = 0) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? n : def; };
