import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser, handle, fail, str } from "@/lib/auth";
import { pushEnabled, notify } from "@/lib/push";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json({ key: pushEnabled() ? process.env.VAPID_PUBLIC_KEY : null });
}
export async function POST(req: Request) {
  return handle(async () => {
    const u = await currentUser(); if (!u) fail("سجّل دخولك", 401);
    const b = await req.json().catch(() => ({}));
    if (b.off) { await prisma.pushSub.deleteMany({ where: { endpoint: str(b.endpoint, 800) } }); return { ok: true }; }
    const sub = b.sub || {};
    if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) fail("اشتراك غير صالح");
    await prisma.pushSub.upsert({ where: { endpoint: sub.endpoint }, create: { userId: u!.id, endpoint: sub.endpoint, keys: sub.keys }, update: { userId: u!.id, keys: sub.keys } });
    if (b.test) await notify([u!.id], { title: "حلقات ارتق", body: "تم تفعيل الإشعارات على هذا الجهاز", tag: "test" });
    return { ok: true };
  });
}
