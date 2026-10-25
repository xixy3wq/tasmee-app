import { prisma } from "./db";
export async function snapshot() {
  const [users, halaqat, lessons, joins, recs, settings, anns, annReads, wirds, logs, msgs] = await Promise.all([
    prisma.user.findMany(), prisma.halqa.findMany(), prisma.lesson.findMany(), prisma.join.findMany(), prisma.rec.findMany(),
    prisma.setting.findMany(), prisma.ann.findMany(), prisma.annRead.findMany(), prisma.wird.findMany(), prisma.auditLog.findMany({ take: 2000, orderBy: { at: "desc" } }), prisma.msg.findMany({ take: 500, orderBy: { at: "desc" } }),
  ]);
  return { version: 1, at: new Date().toISOString(), users, halaqat, lessons, joins, recs, settings, anns, annReads, wirds, logs, msgs };
}
