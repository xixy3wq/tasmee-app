import crypto from "node:crypto";
import { prisma } from "./db";
import { getSettings, localDate } from "./settings";
import { balanceOf } from "./points";
import { notify } from "./push";

/** إقفال المزاد: أعلى مزايدة رصيده يكفي يفوز، والنقاط تنخصم وينضاف طلب للتسليم */
export async function closeAuction(r: any, by?: { id: string; name: string }) {
  if (r.closed) return null;
  const bids = await prisma.bid.findMany({ where: { rewardId: r.id }, orderBy: [{ amount: "desc" }, { at: "asc" }] });
  const s = await getSettings();
  let winner: any = null;
  for (const bd of bids) {
    const st = await prisma.user.findUnique({ where: { id: bd.userId } }); if (!st) continue;
    const bal = await balanceOf({ id: st.id, halqaId: st.halqaId }, s, localDate());
    if (bal.bal >= bd.amount) { winner = { st, amount: bd.amount }; break; }
  }
  const done = await prisma.reward.updateMany({ where: { id: r.id, closed: false }, data: { closed: true, winnerId: winner ? winner.st.id : null } });
  if (!done.count || !winner) return null;
  const code = String(crypto.randomInt(1000, 10000));
  const o = await prisma.rewardOrder.create({ data: { rewardId: r.id, userId: winner.st.id, price: winner.amount, code, byId: by?.id || null, byName: by?.name || "المزاد" } });
  await prisma.pointTx.create({ data: { userId: winner.st.id, amount: -winner.amount, kind: "auction", reason: "فاز بمزاد: " + r.name, byId: by?.id || null, byName: by?.name || "", ref: o.id } });
  await notify([winner.st.id], { title: "فزت بالمزاد 🎉", body: `${r.name} بـ ${winner.amount} نقطة. رمز الاستلام ${code}`, url: "/", tag: "auc-" + r.id }).catch(() => {});
  return winner.st.id as string;
}
