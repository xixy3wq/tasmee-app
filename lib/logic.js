// منطق الخادم: تسجيل الدخول، الصلاحيات، وكل عمليات القراءة والكتابة.
// لا يعتمد على نوع قاعدة البيانات؛ يستقبل كائن store (انظر lib/store.js).
import crypto from 'node:crypto';

export const COLS = ['users', 'halaqat', 'sessions', 'recs', 'joins', 'settings'];
const AYAS = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];
const SSTART = []; let TOTAL = 0;
AYAS.forEach((n, i) => { SSTART[i] = TOTAL; TOTAL += n; });
// موضع الآية في ترتيب الحفظ: fwd من الفاتحة، bwd من الناس (الآيات داخل السورة تصاعدية)
export function posOf(dir, surah, ayah) {
  if (dir === 'fwd') return SSTART[surah - 1] + ayah - 1;
  let p = 0; for (let k = 113; k > surah - 1; k--) p += AYAS[k];
  return p + ayah - 1;
}

const DEF_FIELDS = [
  { k: 'phone', label: 'جوال الطالب', on: true, req: false, type: 'tel' },
  { k: 'parentName', label: 'اسم ولي الأمر', on: true, req: true },
  { k: 'parentPhone', label: 'جوال ولي الأمر', on: true, req: true, type: 'tel' },
  { k: 'age', label: 'العمر', on: true, req: false, type: 'number' },
  { k: 'memorized', label: 'مقدار الحفظ الحالي', on: true, req: false },
];
const DEF_GRADE = { ex: 0, vg: 2, gd: 4, alertsPer: 3 };
const TYPES = ['new', 'review', 'tath'];
const ATT = ['p', 'l', 'a', 'e'];
const defPlan = () => ({ mode: 'manual', manual: {}, auto: { dir: 'bwd', newPos: 0, revPos: 0, newAmt: 0.25, revAmt: 2, tathAmt: 0 } });

class Fail extends Error { constructor(msg, status = 400) { super(msg); this.status = status; } }
const fail = (m, s) => { throw new Fail(m, s); };

export const newId = () => Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
export function hashPw(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(String(pw), salt, 32).toString('hex');
}
export function checkPw(pw, h) {
  if (!h || !String(h).includes(':')) return false;
  const [salt, hx] = String(h).split(':');
  const a = Buffer.from(hx, 'hex'); const b = crypto.scryptSync(String(pw), salt, 32);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
function deepMerge(a, b) {
  const o = { ...(isObj(a) ? a : {}) };
  for (const k of Object.keys(b)) o[k] = isObj(b[k]) && isObj(o[k]) ? deepMerge(o[k], b[k]) : b[k];
  return o;
}
const str = (v, max = 500) => String(v ?? '').trim().slice(0, max);
const int = (v, min, max) => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n >= min && n <= max ? n : null; };
const validId = id => typeof id === 'string' && /^[A-Za-z0-9_\-]{1,80}$/.test(id);
const USER_RE = /^[A-Za-z0-9_.]{3,40}$/;

function settingsOf(db) {
  const m = db.settings.main || {};
  return { center: m.center || 'حلقات التسميع', days: m.days || [0, 1, 2, 3, 4], fields: m.fields || DEF_FIELDS, grade: { ...DEF_GRADE, ...(m.grade || {}) }, tpl: m.tpl || null };
}
export function gradeOf(db, m, al) {
  const g = settingsOf(db).grade; const e = (+m || 0) + Math.floor((+al || 0) / (+g.alertsPer || 3));
  if (e <= g.ex) return { t: 'ممتاز', pass: true };
  if (e <= g.vg) return { t: 'جيد جدًا', pass: true };
  if (e <= g.gd) return { t: 'جيد', pass: true };
  return { t: 'يعاد', pass: false };
}
const hasAdmin = db => Object.values(db.users).some(u => u.role === 'admin');
const usernameTaken = (db, un, exceptId) => Object.entries(db.users).some(([id, u]) => id !== exceptId && String(u.username || '').toLowerCase() === un.toLowerCase());
const ownHalaqat = (db, me) => Object.keys(db.halaqat).filter(id => me.role === 'admin' || db.halaqat[id].teacherId === me.id);
const stripUser = u => { const o = { ...u }; delete o.pw; return o; };

// ما يراه كل شخص
export function visibleData(db, me) {
  const out = {}; COLS.forEach(c => out[c] = {});
  const st = settingsOf(db);
  if (!me || me.status !== 'active') {
    out.settings.main = { center: st.center, fields: st.fields, days: st.days };
    for (const [id, h] of Object.entries(db.halaqat)) out.halaqat[id] = { name: h.name };
    if (me) out.users[me.id] = stripUser(db.users[me.id]);
    return out;
  }
  out.settings = { ...db.settings };
  if (me.role === 'admin') {
    for (const c of COLS) out[c] = { ...db[c] };
    for (const id of Object.keys(out.users)) out.users[id] = stripUser(out.users[id]);
    return out;
  }
  if (me.role === 'teacher') {
    const hs = new Set(ownHalaqat(db, me));
    for (const [id, h] of Object.entries(db.halaqat)) out.halaqat[id] = hs.has(id) ? h : { name: h.name };
    for (const [id, u] of Object.entries(db.users)) if (id === me.id || (u.role === 'student' && hs.has(u.halqaId) && u.status !== 'pending')) out.users[id] = stripUser(u);
    const sids = new Set();
    for (const [id, s] of Object.entries(db.sessions)) if (hs.has(s.halqaId)) { out.sessions[id] = s; sids.add(id); }
    for (const [id, r] of Object.entries(db.recs)) if (hs.has(r.halqaId)) out.recs[id] = r;
    for (const [id, j] of Object.entries(db.joins)) if (sids.has(j.sid)) out.joins[id] = j;
    return out;
  }
  // طالب (وولي أمره)
  out.users[me.id] = stripUser(db.users[me.id]);
  if (db.halaqat[me.halqaId]) out.halaqat[me.halqaId] = db.halaqat[me.halqaId];
  for (const [id, s] of Object.entries(db.sessions)) if (s.halqaId === me.halqaId) {
    const v = (s.att || {})[me.id];
    out.sessions[id] = { halqaId: s.halqaId, date: s.date, time: s.time, link: s.link, note: s.note, att: v ? { [me.id]: v } : {} };
  }
  for (const [id, r] of Object.entries(db.recs)) if (r.uid === me.id) out.recs[id] = r;
  for (const [id, j] of Object.entries(db.joins)) if (j.uid === me.id) out.joins[id] = j;
  const t = db.halaqat[me.halqaId] && db.halaqat[me.halqaId].teacherId;
  if (t && db.users[t]) out.users[t] = { name: db.users[t].name, role: 'teacher' };
  return out;
}

function cleanPlan(plan, canAuto) {
  const p = deepMerge(defPlan(), isObj(plan) ? {} : {});
  const manual = {};
  for (const k of TYPES) {
    const x = plan && plan.manual && plan.manual[k]; if (!isObj(x)) continue;
    const s = int(x.surah, 1, 114); if (!s) continue;
    const n = AYAS[s - 1]; const fr = int(x.from, 1, n) || 1; const to = int(x.to, fr, n) || n;
    manual[k] = { surah: s, from: fr, to };
  }
  p.manual = manual;
  const a = (plan && plan.auto) || {};
  p.auto = {
    dir: a.dir === 'fwd' ? 'fwd' : 'bwd',
    newPos: int(a.newPos, 0, TOTAL) ?? 0, revPos: int(a.revPos, 0, TOTAL) ?? 0,
    newAmt: Math.min(20, Math.max(0, +a.newAmt || 0)), revAmt: Math.min(60, Math.max(0, +a.revAmt || 0)), tathAmt: Math.min(60, Math.max(0, +a.tathAmt || 0)),
  };
  p.mode = plan && plan.mode === 'auto' && canAuto ? 'auto' : 'manual';
  return p;
}

function prepUserFields(db, data, id, isNew) {
  const o = {};
  if (data.name != null) o.name = str(data.name, 120);
  if (data.username != null) {
    const un = str(data.username, 40);
    if (!USER_RE.test(un)) fail('اسم المستخدم لازم يكون حروف إنجليزية أو أرقام، 3 أحرف على الأقل');
    if (usernameTaken(db, un, id)) fail('اسم المستخدم مستخدم، اختر غيره');
    o.username = un;
  }
  if (data.password) { if (String(data.password).length < 4) fail('كلمة المرور قصيرة (4 أحرف على الأقل)'); o.pw = hashPw(data.password); }
  else if (isNew) fail('اكتب كلمة المرور');
  if (isNew && (!o.name || !o.username)) fail('الاسم واسم المستخدم مطلوبة');
  for (const f of settingsOf(db).fields) if (data[f.k] != null) o[f.k] = str(data[f.k], 300);
  if (data.phone != null) o.phone = str(data.phone, 30);
  return o;
}

async function saveRec(store, db, me, id, data) {
  const st = db.users[data.uid]; const ses = db.sessions[data.sid];
  if (!st || st.role !== 'student') fail('الطالب غير موجود');
  if (!ses) fail('الحصة غير موجودة');
  if (me.role === 'teacher' && !ownHalaqat(db, me).includes(ses.halqaId)) fail('هذه الحصة ليست من حلقاتك', 403);
  const type = TYPES.includes(data.type) ? data.type : fail('نوع التسميع غير صحيح');
  const surah = int(data.surah, 1, 114) || fail('اختر السورة');
  const n = AYAS[surah - 1]; const from = int(data.from, 1, n); const to = int(data.to, from || 1, n);
  if (!from || !to) fail('تأكد من أرقام الآيات (عدد آيات السورة ' + n + ')');
  const mistakes = int(data.mistakes, 0, 999) ?? 0, alerts = int(data.alerts, 0, 999) ?? 0;
  const g = gradeOf(db, mistakes, alerts);
  const rec = { uid: data.uid, sid: data.sid, halqaId: ses.halqaId, date: ses.date, type, surah, from, to, mistakes, alerts, grade: g.t, pass: g.pass, note: str(data.note, 400), by: me.id, at: Date.now() };
  await store.set('recs', id, rec);
  // تقدّم الخطة التلقائية بعد النجاح فقط
  const plan = deepMerge(defPlan(), st.plan || {});
  if (g.pass && plan.mode === 'auto' && st.autoAllowed && (type === 'new' || type === 'review')) {
    const a = plan.auto; const p = posOf(a.dir, surah, to);
    if (type === 'new') { if (p + 1 > a.newPos) a.newPos = p + 1; }
    else { let np = p + 1; if (np >= a.newPos) np = 0; a.revPos = np; }
    await store.set('users', data.uid, { ...st, plan });
  }
}

async function write(store, db, me, op, col, id, data) {
  if (!COLS.includes(col) || !validId(id)) fail('طلب غير صحيح');
  data = isObj(data) ? data : {};
  const cur = db[col][id];
  const role = me.role;
  const admin = role === 'admin', teacher = role === 'teacher';
  const own = new Set(ownHalaqat(db, me));

  if (col === 'joins') {
    if (op !== 'put') fail('غير مسموح', 403);
    const sid = str(data.sid, 80); const ses = db.sessions[sid];
    if (!ses) fail('الحصة غير موجودة');
    const uid = admin ? str(data.uid, 80) : me.id;
    if (id !== sid + '_' + uid) fail('طلب غير صحيح');
    if (!admin && ses.halqaId !== me.halqaId) fail('غير مسموح', 403);
    if (cur) return;
    return store.set('joins', id, { sid, uid, at: Date.now() });
  }
  if (!admin && !teacher) fail('غير مسموح', 403);

  if (col === 'settings') {
    if (!admin || id !== 'main' || op !== 'put') fail('غير مسموح', 403);
    const s = { ...(cur || {}) };
    if (data.center != null) s.center = str(data.center, 80) || 'حلقات التسميع';
    if (Array.isArray(data.days)) s.days = [...new Set(data.days.map(Number).filter(d => d >= 0 && d <= 6))];
    if (isObj(data.grade)) s.grade = { ex: int(data.grade.ex, 0, 99) ?? 0, vg: int(data.grade.vg, 0, 99) ?? 2, gd: int(data.grade.gd, 0, 99) ?? 4, alertsPer: int(data.grade.alertsPer, 1, 99) ?? 3 };
    if (Array.isArray(data.fields)) s.fields = data.fields.slice(0, 30).filter(f => isObj(f) && validId(f.k) && !['name', 'username', 'password', 'pw', 'role', 'status', 'plan', 'halqaId'].includes(f.k)).map(f => ({ k: f.k, label: str(f.label, 60) || f.k, on: !!f.on, req: !!f.req && !!f.on, type: ['text', 'tel', 'number'].includes(f.type) ? f.type : 'text', ...(f.custom ? { custom: true } : {}), ...(f.ph ? { ph: str(f.ph, 80) } : {}) }));
    if (isObj(data.tpl)) s.tpl = { absent: str(data.tpl.absent, 600), excellent: str(data.tpl.excellent, 600) };
    return store.set('settings', 'main', s);
  }

  if (col === 'halaqat') {
    if (!admin) fail('غير مسموح', 403);
    if (op === 'del') { if (Object.values(db.users).some(u => u.role === 'student' && u.halqaId === id && u.status !== 'pending')) fail('انقل طلاب الحلقة لحلقة ثانية قبل حذفها'); return store.del(col, id); }
    const h = op === 'put' && !cur ? { createdAt: Date.now() } : { ...(cur || fail('الحلقة غير موجودة')) };
    if (data.name != null) h.name = str(data.name, 80);
    if (!h.name) fail('اكتب اسم الحلقة');
    if (data.teacherId != null) { const t = str(data.teacherId, 80); if (t && (!db.users[t] || db.users[t].role !== 'teacher')) fail('المعلم غير موجود'); h.teacherId = t; }
    if (Array.isArray(data.days)) h.days = [...new Set(data.days.map(Number).filter(d => d >= 0 && d <= 6))];
    if (data.time != null) h.time = /^\d\d:\d\d$/.test(data.time) ? data.time : '';
    return store.set(col, id, h);
  }

  if (col === 'sessions') {
    if (op === 'put' && !cur) {
      const hid = str(data.halqaId, 80);
      if (!db.halaqat[hid] || !own.has(hid)) fail('اختر حلقة من حلقاتك', 403);
      if (!/^\d{4}-\d\d-\d\d$/.test(data.date || '')) fail('التاريخ غير صحيح');
      return store.set(col, id, { halqaId: hid, date: data.date, time: /^\d\d:\d\d$/.test(data.time || '') ? data.time : '', link: str(data.link, 500), note: str(data.note, 200), att: {}, queue: [], current: null, createdBy: me.id, createdAt: Date.now() });
    }
    if (!cur) fail('الحصة غير موجودة');
    if (!own.has(cur.halqaId)) fail('غير مسموح', 403);
    if (op === 'del') return store.del(col, id);
    const s = { ...cur };
    if (data.date != null) { if (!/^\d{4}-\d\d-\d\d$/.test(data.date)) fail('التاريخ غير صحيح'); s.date = data.date; }
    if (data.time != null) s.time = /^\d\d:\d\d$/.test(data.time) ? data.time : '';
    if (data.link != null) s.link = str(data.link, 500);
    if (data.note != null) s.note = str(data.note, 200);
    if (isObj(data.att)) { s.att = { ...(s.att || {}) }; for (const [uid, v] of Object.entries(data.att)) { if (!validId(uid)) continue; if (v == null) delete s.att[uid]; else if (ATT.includes(v)) s.att[uid] = v; } }
    if (Array.isArray(data.queue)) s.queue = data.queue.filter(x => validId(x) && db.users[x]).slice(0, 100);
    if ('current' in data) s.current = data.current && db.users[data.current] ? data.current : null;
    return store.set(col, id, s);
  }

  if (col === 'recs') {
    if (op === 'del') { if (!cur) return; if (!own.has(cur.halqaId)) fail('غير مسموح', 403); return store.del(col, id); }
    if (op !== 'put' || cur) fail('غير مسموح', 403);
    return saveRec(store, db, me, id, data);
  }

  if (col === 'users') {
    if (teacher) {
      if (op !== 'patch' || !cur || cur.role !== 'student' || !own.has(cur.halqaId)) fail('غير مسموح', 403);
      if (!me.canPlan) fail('ما عندك صلاحية تعديل الخطط', 403);
      if (!isObj(data.plan)) fail('طلب غير صحيح');
      return store.set(col, id, { ...cur, plan: cleanPlan(data.plan, !!me.canAuto && !!cur.autoAllowed) });
    }
    // المدير
    if (op === 'del') { if (id === me.id) fail('ما تقدر تحذف حسابك'); return store.del(col, id); }
    if (op === 'put' && !cur) {
      const role2 = data.role === 'teacher' ? 'teacher' : 'student';
      const u = { ...prepUserFields(db, data, id, true), role: role2, status: 'active', createdAt: Date.now() };
      if (role2 === 'student') { const h = str(data.halqaId, 80); if (!db.halaqat[h]) fail('اختر الحلقة'); Object.assign(u, { halqaId: h, plan: defPlan(), autoAllowed: false, approvedAt: Date.now() }); }
      else Object.assign(u, { canPlan: !!data.canPlan, canAuto: !!data.canAuto });
      return store.set(col, id, u);
    }
    if (!cur) fail('الحساب غير موجود');
    const u = { ...cur, ...prepUserFields(db, data, id, false) };
    if (data.status != null && id !== me.id) u.status = ['active', 'disabled', 'pending'].includes(data.status) ? data.status : u.status;
    if (cur.role === 'student') {
      if (data.halqaId != null) { const h = str(data.halqaId, 80); if (!db.halaqat[h]) fail('الحلقة غير موجودة'); u.halqaId = h; }
      if ('autoAllowed' in data) u.autoAllowed = !!data.autoAllowed;
      if (data.status === 'active' && cur.status === 'pending') { u.approvedAt = Date.now(); if (!u.halqaId || !db.halaqat[u.halqaId]) fail('اختر الحلقة'); }
      if (isObj(data.plan)) u.plan = cleanPlan(data.plan, !!u.autoAllowed);
    }
    if (cur.role === 'teacher') { if ('canPlan' in data) u.canPlan = !!data.canPlan; if ('canAuto' in data) u.canAuto = !!data.canAuto; }
    return store.set(col, id, u);
  }
  fail('غير مسموح', 403);
}

// نقطة الدخول: ترجع { status, body, cookie? }
export async function handle(store, body, token) {
  try {
    body = isObj(body) ? body : {};
    const db = await store.load();
    let me = null;
    if (token) { const uid = await store.sessGet(token); if (uid && db.users[uid]) me = { ...db.users[uid], id: uid }; }
    const op = body.op;
    const newSession = async uid => { const t = crypto.randomBytes(32).toString('hex'); await store.sessSet(t, uid); return t; };

    if (op === 'sync') return { status: 200, body: { me: me ? me.id : null, setup: !hasAdmin(db), data: visibleData(db, me) } };

    if (op === 'setup') {
      if (hasAdmin(db)) fail('المنصة مجهزة مسبقًا', 403);
      const id = newId();
      const u = { ...prepUserFields(db, body, id, true), role: 'admin', status: 'active', createdAt: Date.now() };
      await store.set('settings', 'main', { ...(db.settings.main || {}), center: str(body.center, 80) || 'حلقات التسميع' });
      await store.set('users', id, u);
      return { status: 200, body: { ok: true }, cookie: await newSession(id) };
    }
    if (op === 'login') {
      const un = str(body.username, 40).toLowerCase();
      const hit = Object.entries(db.users).find(([, u]) => String(u.username || '').toLowerCase() === un);
      if (!hit || !checkPw(body.password, hit[1].pw)) fail('اسم المستخدم أو كلمة المرور غير صحيحة', 401);
      return { status: 200, body: { ok: true }, cookie: await newSession(hit[0]) };
    }
    if (op === 'logout') { if (token) await store.sessDel(token); return { status: 200, body: { ok: true }, cookie: '' }; }
    if (op === 'register') {
      const id = newId(); const st = settingsOf(db);
      const u = prepUserFields(db, body, id, true);
      for (const f of st.fields) if (f.on && f.req && !str(body[f.k])) fail('الحقل «' + f.label + '» مطلوب');
      for (const f of st.fields) if (!f.on) delete u[f.k];
      const req = str(body.reqHalqa, 80);
      await store.set('users', id, { ...u, role: 'student', status: 'pending', reqHalqa: db.halaqat[req] ? req : '', halqaId: '', plan: defPlan(), autoAllowed: false, createdAt: Date.now() });
      return { status: 200, body: { ok: true } };
    }
    if (!me) fail('سجّل دخولك أولًا', 401);
    if (op === 'mypw') {
      if (!checkPw(body.old, db.users[me.id].pw)) fail('كلمة المرور الحالية غير صحيحة');
      if (!body.pw || String(body.pw).length < 4) fail('كلمة المرور الجديدة قصيرة');
      await store.set('users', me.id, { ...db.users[me.id], pw: hashPw(body.pw) });
      return { status: 200, body: { ok: true } };
    }
    if (me.status !== 'active') fail('الحساب غير مفعّل', 403);
    if (op === 'put' || op === 'patch' || op === 'del') {
      await write(store, db, me, op, body.col, body.id, body.data);
      return { status: 200, body: { ok: true } };
    }
    fail('طلب غير معروف');
  } catch (e) {
    if (e instanceof Fail) return { status: e.status, body: { error: e.message } };
    console.error(e);
    return { status: 500, body: { error: 'صار خطأ في الخادم، حاول مرة ثانية.' } };
  }
}
