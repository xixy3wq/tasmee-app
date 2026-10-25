// اختبار منطق الخادم بتخزين في الذاكرة: node test/logic.test.js
import assert from 'node:assert/strict';
import { handle, COLS, posOf } from '../lib/logic.js';

const mem = { docs: {}, sess: {} }; COLS.forEach(c => mem.docs[c] = {});
const store = {
  async load() { return JSON.parse(JSON.stringify(mem.docs)); },
  async set(c, id, d) { mem.docs[c][id] = JSON.parse(JSON.stringify(d)); },
  async del(c, id) { delete mem.docs[c][id]; },
  async sessGet(t) { return mem.sess[t] || null; },
  async sessSet(t, u) { mem.sess[t] = u; },
  async sessDel(t) { delete mem.sess[t]; },
};
const call = (tok, op, extra = {}) => handle(store, { op, ...extra }, tok);
const ok = r => { assert.equal(r.status, 200, JSON.stringify(r.body)); return r; };
const no = (r, st) => { assert.ok(r.status >= 400, 'expected failure, got ' + JSON.stringify(r.body)); if (st) assert.equal(r.status, st); return r; };
const find = (col, pred) => Object.entries(mem.docs[col]).find(([, v]) => pred(v));

// تجهيز
let r = ok(await call(null, 'sync')); assert.equal(r.body.setup, true);
const admin = ok(await call(null, 'setup', { center: 'مجمع التجربة', name: 'المدير', username: 'admin', password: 'pass1' })).cookie;
no(await call(null, 'setup', { name: 'x', username: 'x2', password: 'pass1' }), 403);
// حلقة ومعلم
ok(await call(admin, 'put', { col: 'users', id: 't1', data: { role: 'teacher', name: 'المعلم', username: 'teacher', password: 'pass1', canPlan: true, canAuto: true } }));
ok(await call(admin, 'put', { col: 'halaqat', id: 'h1', data: { name: 'حلقة أبي', teacherId: 't1', days: [0, 1, 2], time: '17:00' } }));
ok(await call(admin, 'put', { col: 'halaqat', id: 'h2', data: { name: 'حلقة زيد' } }));
// تسجيل طالب عام
no(await call(null, 'register', { name: 'سالم', username: 'salem', password: 'pass1' })); // ولي الأمر إجباري
ok(await call(null, 'register', { name: 'سالم', username: 'salem', password: 'pass1', parentName: 'أبو سالم', parentPhone: '0501234567', reqHalqa: 'h1', pw: 'hack', role: 'admin' }));
no(await call(null, 'register', { name: 'سالم2', username: 'SALEM', password: 'pass1', parentName: 'a', parentPhone: '1' }));
const [sid1, s1] = find('users', u => u.username === 'salem');
assert.equal(s1.status, 'pending'); assert.equal(s1.role, 'student'); assert.notEqual(s1.pw, 'hack');
// الطالب المعلّق يدخل لكن ما يرى شيء
const stTok = ok(await call(null, 'login', { username: 'Salem', password: 'pass1' })).cookie;
r = ok(await call(stTok, 'sync')); assert.equal(Object.keys(r.body.data.users).length, 1); assert.equal(r.body.data.users[sid1].pw, undefined);
no(await call(stTok, 'put', { col: 'joins', id: 'x_' + sid1, data: { sid: 'x' } }), 403);
// اعتماد
ok(await call(admin, 'patch', { col: 'users', id: sid1, data: { status: 'active', halqaId: 'h1' } }));
// المعلم
const tTok = ok(await call(null, 'login', { username: 'teacher', password: 'pass1' })).cookie;
r = ok(await call(tTok, 'sync'));
assert.ok(r.body.data.users[sid1]); assert.equal(r.body.data.halaqat.h2.teacherId, undefined);
no(await call(tTok, 'put', { col: 'sessions', id: 'sx', data: { halqaId: 'h2', date: '2026-10-25' } }), 403);
ok(await call(tTok, 'put', { col: 'sessions', id: 's1', data: { halqaId: 'h1', date: '2026-10-25', time: '17:00', link: 'https://zoom.us/j/1' } }));
ok(await call(tTok, 'patch', { col: 'sessions', id: 's1', data: { att: { [sid1]: 'p' }, queue: [sid1] } }));
no(await call(tTok, 'patch', { col: 'users', id: sid1, data: { status: 'disabled' } }));
no(await call(tTok, 'put', { col: 'settings', id: 'main', data: { center: 'x' } }), 403);
// الطالب يضغط دخول
ok(await call(stTok, 'put', { col: 'joins', id: 's1_' + sid1, data: { sid: 's1' } }));
no(await call(stTok, 'put', { col: 'joins', id: 's1_t1', data: { sid: 's1' } }));
r = ok(await call(stTok, 'sync'));
assert.deepEqual(r.body.data.sessions.s1.queue, undefined); assert.equal(r.body.data.sessions.s1.att[sid1], 'p');
no(await call(stTok, 'patch', { col: 'sessions', id: 's1', data: { att: { [sid1]: 'p' } } }), 403);
// خطة تلقائية: المعلم ما يقدر يفعّلها قبل سماح المدير للطالب
ok(await call(tTok, 'patch', { col: 'users', id: sid1, data: { plan: { mode: 'auto', auto: { dir: 'bwd', newPos: posOf('bwd', 78, 1), newAmt: 0.25, revAmt: 2 } } } }));
assert.equal(mem.docs.users[sid1].plan.mode, 'manual');
ok(await call(admin, 'patch', { col: 'users', id: sid1, data: { autoAllowed: true } }));
ok(await call(tTok, 'patch', { col: 'users', id: sid1, data: { plan: { mode: 'auto', auto: { dir: 'bwd', newPos: posOf('bwd', 78, 1), newAmt: 0.25, revAmt: 2 } } } }));
assert.equal(mem.docs.users[sid1].plan.mode, 'auto');
// تسميع ناجح يقدّم الخطة، والإعادة ما تقدّمها
ok(await call(tTok, 'put', { col: 'recs', id: 'r1', data: { uid: sid1, sid: 's1', type: 'new', surah: 78, from: 1, to: 5, mistakes: 6, alerts: 0 } }));
assert.equal(mem.docs.recs.r1.grade, 'يعاد'); assert.equal(mem.docs.users[sid1].plan.auto.newPos, posOf('bwd', 78, 1));
ok(await call(tTok, 'put', { col: 'recs', id: 'r2', data: { uid: sid1, sid: 's1', type: 'new', surah: 78, from: 1, to: 5, mistakes: 1, alerts: 3 } }));
assert.equal(mem.docs.recs.r2.grade, 'جيد جدًا'); assert.equal(mem.docs.users[sid1].plan.auto.newPos, posOf('bwd', 78, 6));
ok(await call(tTok, 'put', { col: 'recs', id: 'r3', data: { uid: sid1, sid: 's1', type: 'review', surah: 114, from: 1, to: 6, mistakes: 0, alerts: 0 } }));
assert.equal(mem.docs.users[sid1].plan.auto.revPos, posOf('bwd', 113, 1));
no(await call(tTok, 'put', { col: 'recs', id: 'r4', data: { uid: sid1, sid: 's1', type: 'new', surah: 78, from: 1, to: 99 } }));
// سحب صلاحية الخطط من المعلم
ok(await call(admin, 'patch', { col: 'users', id: 't1', data: { canPlan: false } }));
no(await call(tTok, 'patch', { col: 'users', id: sid1, data: { plan: { mode: 'manual' } } }), 403);
// الطالب لا يرى كلمات المرور ولا بيانات غيره
r = ok(await call(admin, 'sync')); assert.ok(Object.values(r.body.data.users).every(u => u.pw === undefined));
// تغيير كلمة المرور
no(await call(stTok, 'mypw', { old: 'bad', pw: 'newpw' }));
ok(await call(stTok, 'mypw', { old: 'pass1', pw: 'newpw' }));
ok(await call(null, 'login', { username: 'salem', password: 'newpw' }));
// حذف حلقة فيها طلاب ممنوع
no(await call(admin, 'del', { col: 'halaqat', id: 'h1' }));
ok(await call(null, 'logout'));
console.log('كل الاختبارات نجحت ✓');
