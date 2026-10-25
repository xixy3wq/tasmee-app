// تخزين البيانات في Neon (Postgres). الجداول تُنشأ تلقائيًا أول مرة.
import { neon } from '@neondatabase/serverless';
import { COLS } from './logic.js';

let sql = null, ready = null;
async function db() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  if (!sql) sql = neon(process.env.DATABASE_URL);
  if (!ready) {
    ready = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS docs (col text NOT NULL, id text NOT NULL, data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (col, id))`;
      await sql`CREATE TABLE IF NOT EXISTS sessions (token text PRIMARY KEY, uid text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`;
    })().catch(e => { ready = null; throw e; });
  }
  await ready;
  return sql;
}

export const store = {
  async load() {
    const s = await db();
    const rows = await s`SELECT col, id, data FROM docs`;
    const out = {}; COLS.forEach(c => out[c] = {});
    for (const r of rows) if (out[r.col]) out[r.col][r.id] = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
    return out;
  },
  async set(col, id, data) {
    const s = await db();
    await s`INSERT INTO docs (col, id, data) VALUES (${col}, ${id}, ${JSON.stringify(data)}::jsonb)
            ON CONFLICT (col, id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`;
  },
  async del(col, id) { const s = await db(); await s`DELETE FROM docs WHERE col = ${col} AND id = ${id}`; },
  async sessGet(token) {
    const s = await db();
    const r = await s`SELECT uid FROM sessions WHERE token = ${token} AND created_at > now() - interval '120 days'`;
    return r[0] ? r[0].uid : null;
  },
  async sessSet(token, uid) { const s = await db(); await s`INSERT INTO sessions (token, uid) VALUES (${token}, ${uid})`; },
  async sessDel(token) { const s = await db(); await s`DELETE FROM sessions WHERE token = ${token}`; },
};
