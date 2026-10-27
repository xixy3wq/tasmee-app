import { PrismaClient } from "@prisma/client";
import { prisma } from "./db";

/** نسخة كاملة من بيانات الموقع (كل الجداول المهمة) */
export async function snapshot() {
  const p: any = prisma;
  const opt = (m: string, q: any = {}) => (p[m] ? p[m].findMany(q).catch(() => []) : Promise.resolve([]));
  const [users, halaqat, lessons, joins, recs, settings, anns, annReads, wirds, logs, msgs, dms, behav, polls, pollVotes, teacherIns, pointTx, rewards, rewardOrders, bids, majalis, majalisQ] = await Promise.all([
    prisma.user.findMany(), prisma.halqa.findMany(), prisma.lesson.findMany(), prisma.join.findMany(), prisma.rec.findMany(),
    prisma.setting.findMany(), prisma.ann.findMany(), prisma.annRead.findMany(), prisma.wird.findMany(), prisma.auditLog.findMany({ take: 3000, orderBy: { at: "desc" } }), prisma.msg.findMany({ take: 1000, orderBy: { at: "desc" } }),
    opt("dm"), opt("behav"), opt("poll"), opt("pollVote"), opt("teacherIn"), opt("pointTx"), opt("reward"), opt("rewardOrder"), opt("bid"), opt("majlis"), opt("majlisQ"),
  ]);
  return { version: 2, at: new Date().toISOString(), users, halaqat, lessons, joins, recs, settings, anns, annReads, wirds, logs, msgs, dms, behav, polls, pollVotes, teacherIns, pointTx, rewards, rewardOrders, bids, majalis, majalisQ };
}

/* ---------- النسخ الخارجية: قاعدة بيانات ثانية منفصلة ----------
   رابطها في Vercel باسم BACKUP_DATABASE_URL (أو أي متغير يبدأ بـ BACKUP_ من ربط Neon بالبادئة BACKUP).
   تنحفظ فيها نسخة كل يوم، ويبقى آخر 30 يوم. */
const KEEP = 30;
const hostOf = (u: string) => (u.match(/@([^/:?]+)/)?.[1] || "").replace(/-pooler/, "");
export function backupUrl(): string {
  const e = process.env;
  return e.BACKUP_DATABASE_URL_UNPOOLED || e.BACKUP_DATABASE_URL || e.BACKUP_POSTGRES_URL_NON_POOLING || e.BACKUP_POSTGRES_URL || e.BACKUP_URL || "";
}
export function backupState(): { on: boolean; host: string; err?: string } {
  const url = backupUrl(); if (!url) return { on: false, host: "" };
  const h = hostOf(url);
  if (h && h === hostOf(process.env.DATABASE_URL || "")) return { on: false, host: h, err: "رابط النسخ هو نفس قاعدة الموقع، لازم قاعدة ثانية" };
  return { on: true, host: h };
}
async function withBackupDb<T>(fn: (db: PrismaClient) => Promise<T>): Promise<T> {
  const st = backupState(); if (!st.on) throw new Error(st.err || "قاعدة النسخ الخارجية غير مربوطة");
  const db = new PrismaClient({ datasourceUrl: backupUrl() });
  try {
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS irtaq_backup (id text PRIMARY KEY, at timestamptz NOT NULL DEFAULT now(), size integer NOT NULL DEFAULT 0, kind text NOT NULL DEFAULT 'auto', data jsonb NOT NULL)`);
    return await fn(db);
  } finally { await db.$disconnect().catch(() => {}); }
}
export async function offsiteSave(data: unknown, kind = "auto") {
  const json = JSON.stringify(data); const id = "b" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return withBackupDb(async (db) => {
    await db.$executeRawUnsafe(`INSERT INTO irtaq_backup (id, size, kind, data) VALUES ($1, $2, $3, $4::jsonb)`, id, json.length, kind, json);
    await db.$executeRawUnsafe(`DELETE FROM irtaq_backup WHERE id NOT IN (SELECT id FROM irtaq_backup ORDER BY at DESC LIMIT ${KEEP})`);
    return { id, size: json.length };
  });
}
export async function offsiteList() {
  return withBackupDb(async (db) => {
    const rows = await db.$queryRawUnsafe<{ id: string; at: Date; size: number; kind: string }[]>(`SELECT id, at, size, kind FROM irtaq_backup ORDER BY at DESC LIMIT ${KEEP}`);
    return rows.map((r) => ({ id: r.id, at: +new Date(r.at), size: Number(r.size), kind: r.kind }));
  });
}
export async function offsiteGet(id: string) {
  return withBackupDb(async (db) => {
    const rows = await db.$queryRawUnsafe<{ data: unknown }[]>(`SELECT data FROM irtaq_backup WHERE id = $1`, id);
    return rows[0]?.data ?? null;
  });
}
/** النسخة اليومية: داخل قاعدة الموقع (آخر 7) + القاعدة الخارجية (آخر 30) */
export async function runBackup(kind = "auto") {
  const data = await snapshot(); const json = JSON.stringify(data);
  await prisma.backup.create({ data: { data: data as any, size: json.length } });
  const old = await prisma.backup.findMany({ orderBy: { at: "desc" }, skip: 7, select: { id: true } });
  if (old.length) await prisma.backup.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
  let ext: { ok: boolean; size?: number; err?: string } = { ok: false, err: "غير مربوطة" };
  if (backupState().on) { try { const r = await offsiteSave(data, kind); ext = { ok: true, size: r.size }; } catch (e: any) { ext = { ok: false, err: String(e?.message || e).slice(0, 200) }; console.error("offsite backup", e); } }
  await prisma.setting.upsert({ where: { key: "backupExt" }, create: { key: "backupExt", value: { at: Date.now(), ...ext } }, update: { value: { at: Date.now(), ...ext } } }).catch(() => {});
  return { size: json.length, ext };
}
