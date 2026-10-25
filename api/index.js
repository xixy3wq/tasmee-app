// نقطة API واحدة: POST /api  { op: ... }
import { handle } from '../lib/logic.js';
import { store } from '../lib/store.js';

const COOKIE = 'tasmee_sid';
function readCookie(req) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE) return decodeURIComponent(v.join('='));
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const out = await handle(store, body || {}, readCookie(req));
  if (out.cookie !== undefined) {
    res.setHeader('Set-Cookie', out.cookie
      ? `${COOKIE}=${out.cookie}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 120}`
      : `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
  }
  res.status(out.status || 200).json(out.body);
}
