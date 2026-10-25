// خادم تجربة محلي بدون قاعدة بيانات (البيانات في الذاكرة): node test/dev-server.js ثم افتح http://localhost:3000
import http from 'node:http';
import fs from 'node:fs';
import { handle, COLS } from '../lib/logic.js';

const mem = { docs: {}, sess: {} }; COLS.forEach(c => mem.docs[c] = {});
const store = {
  async load() { return JSON.parse(JSON.stringify(mem.docs)); },
  async set(c, id, d) { mem.docs[c][id] = JSON.parse(JSON.stringify(d)); },
  async del(c, id) { delete mem.docs[c][id]; },
  async sessGet(t) { return mem.sess[t] || null; },
  async sessSet(t, u) { mem.sess[t] = u; },
  async sessDel(t) { delete mem.sess[t]; },
};
http.createServer(async (req, res) => {
  if (req.url.startsWith('/api')) {
    let raw = ''; for await (const ch of req) raw += ch;
    const tok = (req.headers.cookie || '').match(/tasmee_sid=([^;]+)/);
    const out = await handle(store, raw ? JSON.parse(raw) : {}, tok && tok[1]);
    const h = { 'content-type': 'application/json; charset=utf-8' };
    if (out.cookie !== undefined) h['set-cookie'] = `tasmee_sid=${out.cookie}; Path=/; HttpOnly; SameSite=Lax`;
    res.writeHead(out.status, h); return res.end(JSON.stringify(out.body));
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(fs.readFileSync(new URL('../public/index.html', import.meta.url)));
}).listen(process.env.PORT || 3000, () => console.log('http://localhost:' + (process.env.PORT || 3000)));
