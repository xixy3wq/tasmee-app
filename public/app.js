/* منصة حلقات التسميع — الواجهة. البيانات من /api/data والتعديلات عبر /api/act */
(function () {
'use strict';

/* ---------------- Quran data ---------------- */
const SN = "الفاتحة|البقرة|آل عمران|النساء|المائدة|الأنعام|الأعراف|الأنفال|التوبة|يونس|هود|يوسف|الرعد|إبراهيم|الحجر|النحل|الإسراء|الكهف|مريم|طه|الأنبياء|الحج|المؤمنون|النور|الفرقان|الشعراء|النمل|القصص|العنكبوت|الروم|لقمان|السجدة|الأحزاب|سبأ|فاطر|يس|الصافات|ص|الزمر|غافر|فصلت|الشورى|الزخرف|الدخان|الجاثية|الأحقاف|محمد|الفتح|الحجرات|ق|الذاريات|الطور|النجم|القمر|الرحمن|الواقعة|الحديد|المجادلة|الحشر|الممتحنة|الصف|الجمعة|المنافقون|التغابن|الطلاق|التحريم|الملك|القلم|الحاقة|المعارج|نوح|الجن|المزمل|المدثر|القيامة|الإنسان|المرسلات|النبأ|النازعات|عبس|التكوير|الانفطار|المطففين|الانشقاق|البروج|الطارق|الأعلى|الغاشية|الفجر|البلد|الشمس|الليل|الضحى|الشرح|التين|العلق|القدر|البينة|الزلزلة|العاديات|القارعة|التكاثر|العصر|الهمزة|الفيل|قريش|الماعون|الكوثر|الكافرون|النصر|المسد|الإخلاص|الفلق|الناس".split('|');
const AYAS = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];
const SSTART = []; let TOTAL = 0;
AYAS.forEach((n, i) => { SSTART[i] = TOTAL; TOTAL += n; });
const SUR = new Int16Array(TOTAL);
AYAS.forEach((n, s) => { for (let a = 0; a < n; a++) SUR[SSTART[s] + a] = s; });
const W = new Float64Array(TOTAL).fill(604 / TOTAL);
let PAGES_OK = false;
function buildOrder(dir) {
  const arr = new Int32Array(TOTAL); let k = 0;
  const ss = dir === 'fwd' ? [...Array(114).keys()] : [...Array(114).keys()].reverse();
  ss.forEach(s => { for (let a = 0; a < AYAS[s]; a++) arr[k++] = SSTART[s] + a; });
  const pos = new Int32Array(TOTAL); arr.forEach((g, i) => pos[g] = i);
  return { ord: arr, pos };
}
const ORD = { fwd: buildOrder('fwd'), bwd: buildOrder('bwd') };
const gOf = (surah, ayah) => SSTART[surah - 1] + ayah - 1;
async function loadPages() {
  try {
    const r = await fetch('/api/pages'); if (!r.ok) return;
    const { pages } = await r.json(); if (!pages || pages.length !== TOTAL) return;
    const cnt = new Int16Array(606); pages.forEach(p => cnt[p]++);
    for (let i = 0; i < TOTAL; i++) W[i] = 1 / cnt[pages[i]];
    PAGES_OK = true; scheduleRender();
  } catch (e) {}
}

/* ---------------- helpers ---------------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const isoDate = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const today = () => isoDate(new Date());
const addDays = (ds, n) => { const d = new Date(ds + 'T00:00'); d.setDate(d.getDate() + n); return isoDate(d); };
const DAYN = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const fmtDate = ds => { if (!ds) return ''; const d = new Date(ds + 'T00:00'); return DAYN[d.getDay()] + ' ' + d.getDate() + '/' + (d.getMonth() + 1); };
const fmtTime = t => { if (!t) return ''; let [h, m] = t.split(':').map(Number); const ap = h < 12 ? 'ص' : 'م'; h = h % 12 || 12; return h + ':' + pad(m) + ' ' + ap; };
const clock = ts => { const d = new Date(ts); return fmtTime(pad(d.getHours()) + ':' + pad(d.getMinutes())); };
const clone = o => JSON.parse(JSON.stringify(o ?? {}));
function deepMerge(a, b) { const o = clone(a); for (const k in b) { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && o[k] && typeof o[k] === 'object' && !Array.isArray(o[k])) o[k] = deepMerge(o[k], b[k]); else o[k] = b[k]; } return o; }
function normPhone(p) {
  let d = String(p || '').replace(/[^\d]/g, '');
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('05') && d.length === 10) d = '966' + d.slice(1);
  else if (d.startsWith('5') && d.length === 9) d = '966' + d;
  return d;
}
const waLink = (phone, text) => { const p = normPhone(phone); return p ? 'https://wa.me/' + p + '?text=' + encodeURIComponent(text) : ''; };
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 3500); }

/* ---------------- server ---------------- */
const COLS = ['users', 'halaqat', 'sessions', 'recs', 'joins', 'settings'];
const S = {}; COLS.forEach(c => S[c] = {});
let READY = false, OFFLINE = false;
const ST = { meId: null, view: null, sid: null, uid: null, halqa: '', range: 30, reg: false, regDone: false, q: '', regInfo: null };

async function api(path, body) {
  const r = await fetch(path, body === undefined ? { cache: 'no-store' } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  let j = {}; try { j = await r.json(); } catch {}
  if (!r.ok) { const e = new Error(j.error || 'تعذّر الاتصال، حاول مرة ثانية'); e.status = r.status; throw e; }
  return j;
}
let loading = null;
async function load() {
  if (loading) return loading;
  loading = (async () => {
    try {
      const d = await api('/api/data');
      OFFLINE = false;
      ST.meId = d.me || null;
      if (d.me) COLS.forEach(c => S[c] = d[c] || {}); else COLS.forEach(c => S[c] = {});
      READY = true; scheduleRender();
    } catch (e) { OFFLINE = true; if (!READY) { READY = true; } scheduleRender(); }
    finally { loading = null; }
  })();
  return loading;
}
async function act(t, payload, okMsg) {
  try {
    const r = await api('/api/act', { t, ...(payload || {}) });
    if (okMsg) toast(typeof okMsg === 'function' ? okMsg(r) : okMsg);
    await load();
    return r || {};
  } catch (e) {
    toast(e.message);
    if (e.status === 401) { await load(); }
    return null;
  }
}
const L = col => Object.entries(S[col]).map(([id, v]) => ({ ...v, id }));

/* ---------------- settings ---------------- */
const DEF = { center: 'حلقات التسميع', days: [0, 1, 2, 3, 4], grade: { ex: 0, vg: 2, gd: 4, alertsPer: 3 }, fields: [], tpl: { absent: '', excellent: '' } };
const SET = () => { const m = S.settings.main || {}; return { ...DEF, ...m, grade: { ...DEF.grade, ...(m.grade || {}) }, tpl: { ...DEF.tpl, ...(m.tpl || {}) }, fields: m.fields || [] }; };
const fillTpl = (t, v) => t.replace(/\{الطالب\}/g, v.student || '').replace(/\{الحلقة\}/g, v.halqa || '').replace(/\{التاريخ\}/g, v.date || '');
function gradeOf(m, al) {
  const g = SET().grade; const e = (+m || 0) + Math.floor((+al || 0) / (+g.alertsPer || 3));
  if (e <= g.ex) return { k: 'ok', t: 'ممتاز' };
  if (e <= g.vg) return { k: 'acc', t: 'جيد جدًا' };
  if (e <= g.gd) return { k: 'warn', t: 'جيد' };
  return { k: 'bad', t: 'يعاد' };
}
const GRADE_K = { 'ممتاز': 'ok', 'جيد جدًا': 'acc', 'جيد': 'warn', 'يعاد': 'bad' };
const TYPE = { new: 'حفظ جديد', review: 'مراجعة', tath: 'تثبيت' };
const ATT = { p: 'حاضر', l: 'متأخر', a: 'غائب', e: 'مستأذن' };
const ATTC = { p: 'ok', l: 'warn', a: 'bad', e: 'info' };

/* ---------------- plan logic ---------------- */
const defPlan = () => ({ mode: 'manual', manual: {}, auto: { dir: 'bwd', newPos: 0, revPos: 0, newAmt: 0.25, revAmt: 2, tathAmt: 0 } });
const planOf = st => deepMerge(defPlan(), st.plan || {});
const isAuto = st => planOf(st).mode === 'auto' && !!st.autoAllowed;
function take(ord, start, end, amount, stopAtSurah) {
  const out = []; let w = 0, p = start;
  while (p < end) {
    const g = ord[p]; out.push(g); w += W[g]; p++;
    if (w >= amount - 1e-9) break;
    if (stopAtSurah && p < end && SUR[ord[p]] !== SUR[g]) break;
  }
  return { list: out, next: p, pages: w };
}
function segs(list) {
  const out = [];
  list.forEach(g => {
    const s = SUR[g], a = g - SSTART[s] + 1, last = out[out.length - 1];
    if (last && last.s === s && last.a2 === a - 1) last.a2 = a; else out.push({ s, a1: a, a2: a });
  });
  return out;
}
function autoInfo(st) {
  const a = planOf(st).auto; const { ord } = ORD[a.dir] || ORD.bwd;
  const np = Math.max(0, Math.min(TOTAL, +a.newPos || 0));
  let memPages = 0; for (let i = 0; i < np; i++) memPages += W[ord[i]];
  const res = { memPages, done: np >= TOTAL };
  if (np < TOTAL && +a.newAmt > 0) res.new = take(ord, np, TOTAL, +a.newAmt, true);
  if (np > 0 && +a.revAmt > 0) { let rp = +a.revPos || 0; if (rp >= np) rp = 0; res.review = take(ord, rp, np, +a.revAmt, false); }
  if (np > 0 && +a.tathAmt > 0) { const out = []; let w = 0, p = np; while (p > 0) { p--; out.unshift(ord[p]); w += W[ord[p]]; if (w >= +a.tathAmt - 1e-9) break; } res.tath = { list: out }; }
  return res;
}
function planSegs(st) {
  const out = {};
  if (isAuto(st)) {
    const inf = autoInfo(st);
    ['new', 'review', 'tath'].forEach(k => { if (inf[k]) out[k] = segs(inf[k].list); });
    out._info = inf;
  } else {
    const m = planOf(st).manual || {};
    ['new', 'review', 'tath'].forEach(k => { const x = m[k]; if (x && +x.surah) { const s = +x.surah - 1; out[k] = [{ s, a1: +x.from || 1, a2: +x.to || AYAS[s] }]; } });
  }
  return out;
}
const segText = arr => arr.map(x => `<span class="por">${esc(SN[x.s])} <b>﴿${x.a1 === x.a2 ? x.a1 : x.a1 + '–' + x.a2}﴾</b></span>`).join('، ');
function fmtAmt(n) { n = +n; const m = { 0.125: 'ثمن وجه', 0.25: 'ربع وجه', 0.5: 'نصف وجه', 0.75: 'ثلاثة أرباع وجه', 1: 'وجه', 2: 'وجهان' }; return m[n] || (n + ' أوجه'); }
function posText(dir, np) { if (np >= TOTAL) return 'أتمّ'; const g = ORD[dir].ord[np]; const s = SUR[g]; return SN[s] + ' آية ' + (g - SSTART[s] + 1); }

/* ---------------- state helpers ---------------- */
const me = () => { const u = ST.meId && S.users[ST.meId]; return u ? { ...u, id: ST.meId } : null; };
const myHalaqat = u => L('halaqat').filter(h => u.role === 'admin' || h.teacherId === u.id).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
const halqaName = id => (S.halaqat[id] && S.halaqat[id].name) || '—';
const studentsOf = hid => L('users').filter(u => u.role === 'student' && u.status === 'active' && u.halqaId === hid).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
const canPlan = u => u.role === 'admin' || (u.role === 'teacher' && !!u.canPlan);
const canAutoU = u => u.role === 'admin' || (u.role === 'teacher' && !!u.canAuto);
const halqaDays = hid => { const h = S.halaqat[hid]; return (h && h.days && h.days.length) ? h.days : SET().days; };
const recsOf = uid => L('recs').filter(r => r.uid === uid).sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.at || 0) - (a.at || 0));
function attStats(st, days) {
  const from = days ? addDays(today(), -days) : '';
  const ss = L('sessions').filter(s => s.halqaId === st.halqaId && s.date <= today() && (!from || s.date >= from));
  const c = { p: 0, l: 0, a: 0, e: 0, n: 0, total: ss.length };
  ss.forEach(s => { const v = (s.att || {})[st.id]; if (v) c[v]++; else c.n++; });
  const marked = c.p + c.l + c.a + c.e; c.rate = marked ? Math.round((c.p + c.l) / marked * 100) : null;
  return c;
}

/* ---------------- render loop ---------------- */
let rq = 0;
function scheduleRender() { if (rq) return; rq = requestAnimationFrame(() => { rq = 0; render(); }); }
function render() {
  const app = $('#app'); const saved = {};
  app.querySelectorAll('[data-dirty][id]').forEach(el => saved[el.id] = (el.type === 'checkbox' || el.type === 'radio') ? { c: el.checked } : { v: el.value });
  const a = document.activeElement; const fid = app.contains(a) ? a.id : null; let sel = null;
  try { if (fid && a.selectionStart != null) sel = [a.selectionStart, a.selectionEnd]; } catch {}
  const sy = window.scrollY;
  app.innerHTML = view();
  for (const id in saved) { const el = document.getElementById(id); if (!el || !app.contains(el)) continue; el.dataset.dirty = 1; if ('c' in saved[id]) el.checked = saved[id].c; else el.value = saved[id].v; }
  if (fid) { const el = document.getElementById(fid); if (el) { el.focus({ preventScroll: true }); try { if (sel) el.setSelectionRange(sel[0], sel[1]); } catch {} } }
  window.scrollTo(0, sy);
}
function clean() { $('#app').querySelectorAll('[data-dirty]').forEach(el => delete el.dataset.dirty); }
function go(v, extra) { clean(); Object.assign(ST, { view: v }, extra || {}); render(); window.scrollTo(0, 0); }
document.addEventListener('input', e => { if (e.target.id) e.target.dataset.dirty = 1; }, true);
document.addEventListener('change', e => { if (e.target.id) e.target.dataset.dirty = 1; }, true);

const MARK = `<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="4" y="4" width="40" height="40" rx="10" fill="var(--accent)"/><path d="M14 16c4-2 7-2 10 1 3-3 6-3 10-1v17c-4-2-7-2-10 1-3-3-6-3-10-1z" fill="none" stroke="var(--accent-ink)" stroke-width="2.4" stroke-linejoin="round"/><path d="M24 17v17" stroke="var(--accent-ink)" stroke-width="2.4"/></svg>`;

/* ---------------- views ---------------- */
function joinHid() { const p = new URLSearchParams(location.search); const h = location.hash.replace('#', ''); return p.get('join') || (h.startsWith('join-') ? h.slice(5) : ''); }
function isRegRoute() { const h = location.hash.replace('#', ''); return h === 'register' || !!joinHid() || location.pathname === '/register'; }
function view() {
  if (!READY) return `<div class="center-box"><div class="row"><div class="spin"></div><span class="muted">جاري التحميل…</span></div></div>`;
  if (ST.regDone) return regDoneV();
  const u = me();
  if (!u && (ST.reg || isRegRoute())) return regV(joinHid());
  if (!u) return loginV();
  return shellV(u);
}
const banner = () => OFFLINE ? `<div class="banner">تعذّر الاتصال بالخادم. تأكد من الإنترنت، وتتحدث الصفحة تلقائيًا.</div>` : '';
function fieldHtml(f, val, pre, opt = {}) {
  const t = f.type || 'text'; const req = opt.forceReq ?? f.req;
  return `<label class="fld"><span>${esc(f.label)}${req ? ' <i>*</i>' : ''}</span><input id="${pre}${f.k}" name="${f.k}" type="${t}" ${t === 'tel' ? 'inputmode="tel" dir="ltr"' : ''} ${t === 'number' ? 'inputmode="numeric" min="0"' : ''} value="${esc(val ?? '')}" placeholder="${esc(f.ph || '')}" ${req ? 'required' : ''}></label>`;
}

function loginV() {
  return `${banner()}<div class="center-box">
  <div class="hero-mark">${MARK}<div><h1>${esc(SET().center !== DEF.center ? SET().center : 'حلقات التسميع')}</h1><div class="muted">تسميع، مراجعة، وتثبيت عن بُعد</div></div></div>
  <form class="card" data-form="login">
    <label class="fld"><span>اسم المستخدم</span><input id="lg-user" name="username" dir="ltr" autocomplete="username" autocapitalize="none" required></label>
    <label class="fld"><span>كلمة المرور</span><input id="lg-pw" name="password" type="password" autocomplete="current-password" required></label>
    <button class="btn pri big" type="submit">دخول</button>
    <div class="small muted">ولي الأمر يدخل بحساب ابنه.</div>
  </form>
  <div class="row" style="justify-content:center"><span class="muted">طالب جديد؟</span><button class="btn" data-act="to-reg">سجّل بياناتك</button></div>
  </div>`;
}
function regV(hid) {
  const info = ST.regInfo;
  if (!info) { loadRegInfo(); return `<div class="center-box"><div class="row"><div class="spin"></div><span class="muted">جاري تحميل نموذج التسجيل…</span></div></div>`; }
  const hs = info.halaqat || []; const fixedH = hid && hs.find(h => h.id === hid);
  return `${banner()}<div class="center-box" style="max-width:560px">
  <div class="hero-mark">${MARK}<div><h1>تسجيل طالب جديد</h1><div class="muted">${esc(info.center)}${fixedH ? ' · ' + esc(fixedH.name) : ''}</div></div></div>
  <form class="card" data-form="register" data-hid="${esc(fixedH ? hid : '')}">
    <label class="fld"><span>الاسم الكامل <i>*</i></span><input id="rg-name" name="name" required autocomplete="name"></label>
    <div class="fgrid">
      <label class="fld"><span>اسم المستخدم <i>*</i></span><input id="rg-username" name="username" dir="ltr" required autocapitalize="none" pattern="[A-Za-z0-9_.]{3,30}" title="حروف إنجليزية أو أرقام، 3 أحرف على الأقل"></label>
      <label class="fld"><span>كلمة المرور <i>*</i></span><input id="rg-password" name="password" type="password" required minlength="4" autocomplete="new-password"></label>
    </div>
    <div class="fgrid">${info.fields.map(f => fieldHtml(f, '', 'rg-')).join('')}</div>
    ${!fixedH && hs.length ? `<label class="fld"><span>الحلقة المطلوبة</span><select id="rg-halqa" name="reqHalqa"><option value="">تحددها الإدارة</option>${hs.map(h => `<option value="${h.id}">${esc(h.name)}</option>`).join('')}</select></label>` : ''}
    <button class="btn pri big" type="submit">إرسال الطلب</button>
    <div class="small muted">بعد الإرسال تراجع الإدارة طلبك وتعتمده، وبعدها تدخل باسم المستخدم وكلمة المرور.</div>
  </form>
  <button class="btn ghost" data-act="from-reg">رجوع لتسجيل الدخول</button></div>`;
}
let regLoading = false;
async function loadRegInfo() {
  if (regLoading) return; regLoading = true;
  try { ST.regInfo = await api('/api/register'); } catch (e) { ST.regInfo = { center: 'حلقات التسميع', fields: [], halaqat: [] }; toast(e.message); }
  regLoading = false; scheduleRender();
}
function regDoneV() {
  return `<div class="center-box"><div class="hero-mark">${MARK}<h1>وصل طلبك</h1></div><div class="card">شكرًا لك. طلبك الآن عند الإدارة، وبعد الاعتماد تقدر تدخل باسم المستخدم وكلمة المرور اللي اخترتها.</div><button class="btn" data-act="from-reg">صفحة الدخول</button></div>`;
}

const TABS = {
  admin: () => [['req', 'الطلبات', L('users').filter(u => u.role === 'student' && u.status === 'pending').length], ['sessions', 'الحصص'], ['students', 'الطلاب'], ['teachers', 'المعلمون'], ['halaqat', 'الحلقات'], ['reports', 'التقارير'], ['settings', 'الإعدادات']],
  teacher: () => [['sessions', 'الحصص'], ['students', 'طلابي'], ['reports', 'التقارير']],
  student: () => [['home', 'صفحتي']]
};
const ROLE = { admin: 'المدير', teacher: 'معلم', student: 'طالب' };
const PARENT_TAB = { session: 'sessions', student: 'students' };
function shellV(u) {
  const tabs = TABS[u.role]();
  const keys = tabs.map(t => t[0]);
  if (!ST.view || (!keys.includes(ST.view) && !PARENT_TAB[ST.view]) || (u.role === 'student' && ST.view !== 'home')) ST.view = keys[0];
  const activeTab = PARENT_TAB[ST.view] || ST.view;
  const body = ({ req: reqV, sessions: sessionsV, session: sessionV, students: studentsV, student: profileV, teachers: teachersV, halaqat: halaqatV, reports: reportsV, settings: settingsV, home: homeV })[ST.view](u);
  return `${banner()}<header class="top"><div class="top-in">
    <div class="brand-row"><div class="brand">${MARK}<span>${esc(SET().center)}</span></div>
      <div class="who"><span class="small">${esc(u.name)}</span><span class="chip acc">${ROLE[u.role]}</span><button class="btn ghost sm" data-act="my-pw">كلمة المرور</button><button class="btn ghost sm" data-act="logout">خروج</button></div></div>
    ${tabs.length > 1 ? `<nav class="tabs">${tabs.map(([k, l, c]) => `<button class="tab ${k === activeTab ? 'on' : ''}" data-act="tab" data-v="${k}">${l}${c ? ` <span class="count">${c}</span>` : ''}</button>`).join('')}</nav>` : '<div style="height:10px"></div>'}
  </div></header><main class="wrap">${body}</main>`;
}

/* ---- admin: requests ---- */
function reqV() {
  const pend = L('users').filter(u => u.role === 'student' && u.status === 'pending').sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const hs = L('halaqat'); const fields = SET().fields;
  return `<div class="sec-head"><h1>طلبات التسجيل</h1><button class="btn" data-act="copy-reg" data-h="">نسخ رابط التسجيل العام</button></div>
  ${!hs.length ? `<div class="note">أنشئ حلقة أولًا من تبويب الحلقات حتى تقدر تعتمد الطلاب عليها.</div>` : ''}
  ${!pend.length ? `<div class="empty"><b>ما فيه طلبات جديدة</b><span>أرسل رابط التسجيل للطلاب، وتوصلك طلباتهم هنا للاعتماد.</span></div>` :
    `<div class="grid2">${pend.map(p => `<div class="card" style="display:grid;gap:12px">
      <div class="sec-head"><h3>${esc(p.name)}</h3><span class="chip gold">ينتظر الاعتماد</span></div>
      <dl class="kv"><dt>اسم المستخدم</dt><dd dir="ltr" style="text-align:right">${esc(p.username)}</dd>
      ${fields.filter(f => p[f.k]).map(f => `<dt>${esc(f.label)}</dt><dd ${f.type === 'tel' ? 'dir="ltr" style="text-align:right"' : ''}>${esc(p[f.k])}</dd>`).join('')}
      <dt>تاريخ الطلب</dt><dd>${p.createdAt ? fmtDate(isoDate(new Date(p.createdAt))) : '—'}</dd></dl>
      <label class="fld"><span>الحلقة</span><select id="ap-h-${p.id}">${hs.map(h => `<option value="${h.id}" ${h.id === p.reqHalqa ? 'selected' : ''}>${esc(h.name)}</option>`).join('')}</select></label>
      <div class="row"><button class="btn pri" data-act="approve" data-id="${p.id}" ${hs.length ? '' : 'disabled'}>اعتماد</button><button class="btn danger" data-act="reject" data-id="${p.id}">رفض وحذف</button></div>
    </div>`).join('')}</div>`}`;
}

/* ---- sessions ---- */
function sessionsV(u) {
  const hs = myHalaqat(u);
  if (!hs.length) return `<h1>الحصص</h1><div class="empty"><b>${u.role === 'admin' ? 'ما فيه حلقات بعد' : 'ما عندك حلقة مسندة'}</b><span>${u.role === 'admin' ? 'ابدأ بإنشاء حلقة من تبويب الحلقات.' : 'تواصل مع المدير ليسند لك حلقة.'}</span></div>`;
  if (ST.halqa && !hs.some(h => h.id === ST.halqa)) ST.halqa = '';
  const ids = ST.halqa ? [ST.halqa] : hs.map(h => h.id);
  const all = L('sessions').filter(s => ids.includes(s.halqaId));
  const t = today();
  const up = all.filter(s => s.date >= t).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const past = all.filter(s => s.date < t).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)).slice(0, 25);
  const row = s => { const n = studentsOf(s.halqaId).length; const att = s.att || {}; const pres = Object.values(att).filter(v => v === 'p' || v === 'l').length; const recs = L('recs').filter(r => r.sid === s.id).length;
    return `<div class="item click" data-act="open-session" data-id="${s.id}"><div class="grow"><div class="name">${fmtDate(s.date)} <span class="muted small">${fmtTime(s.time)}</span></div><div class="small muted">${esc(halqaName(s.halqaId))}${s.note ? ' · ' + esc(s.note) : ''}</div></div>
      ${s.date === t ? '<span class="chip gold">اليوم</span>' : ''}${s.link ? '' : '<span class="chip warn">بدون رابط</span>'}<span class="chip num">حضور ${pres}/${n}</span><span class="chip num">تسميع ${recs}</span></div>`; };
  return `<div class="sec-head"><h1>الحصص</h1><button class="btn pri" data-act="new-session">حصة جديدة</button></div>
  ${hs.length > 1 ? `<div class="row">${['', ...hs.map(h => h.id)].map(id => `<button class="btn sm ${ST.halqa === id ? 'pri' : ''}" data-act="filter-h" data-h="${id}">${id ? esc(halqaName(id)) : 'كل الحلقات'}</button>`).join('')}</div>` : ''}
  <section class="card"><div class="sec-head"><h2>اليوم والقادمة</h2></div>
  ${up.length ? `<div class="list">${up.map(row).join('')}</div>` : `<div class="empty"><span>ما فيه حصص قادمة. أضف حصة وحط رابطها، وتظهر للطلاب في صفحتهم.</span></div>`}</section>
  ${past.length ? `<section class="card"><h2>السابقة</h2><div class="list">${past.map(row).join('')}</div></section>` : ''}`;
}
function sessionV(u) {
  const s = S.sessions[ST.sid] && { ...S.sessions[ST.sid], id: ST.sid };
  if (!s) return `<button class="back" data-act="tab" data-v="sessions">→ الحصص</button><div class="empty">هذه الحصة غير موجودة.</div>`;
  const studs = studentsOf(s.halqaId); const att = s.att || {}; const queue = (s.queue || []).filter(id => S.users[id]);
  const joins = {}; L('joins').filter(j => j.sid === s.id).forEach(j => joins[j.uid] = j.at);
  const recs = L('recs').filter(r => r.sid === s.id).sort((a, b) => (b.at || 0) - (a.at || 0));
  const hname = halqaName(s.halqaId); const tp = SET().tpl;
  const vars = st => ({ student: st.name, halqa: hname, date: fmtDate(s.date) });
  const cur = s.current && S.users[s.current] ? { ...S.users[s.current], id: s.current } : null;
  const notQueued = studs.filter(x => !queue.includes(x.id) && x.id !== s.current);
  const attRow = st => { const v = att[st.id]; const wA = st.parentPhone && waLink(st.parentPhone, fillTpl(tp.absent, vars(st))); const wE = st.parentPhone && waLink(st.parentPhone, fillTpl(tp.excellent, vars(st)));
    return `<div class="item"><div class="grow"><div class="name">${esc(st.name)}</div><div class="small muted">${joins[st.id] ? `دخل ${clock(joins[st.id])}` : 'لم يضغط دخول'}</div></div>
    <div class="seg">${Object.keys(ATT).map(k => `<button class="${k} ${v === k ? 'on' : ''}" data-act="att" data-id="${st.id}" data-v="${k}">${ATT[k]}</button>`).join('')}</div>
    ${v === 'a' && wA ? `<a class="btn wa sm" href="${wA}" target="_blank" rel="noopener">واتساب غياب</a>` : ''}${(v === 'p' || v === 'l') && wE ? `<a class="btn wa sm" href="${wE}" target="_blank" rel="noopener">واتساب تميّز</a>` : ''}</div>`; };
  const dd = new Date(s.date + 'T00:00');
  return `<button class="back" data-act="tab" data-v="sessions">→ الحصص</button>
  <div class="session-hero"><div class="datebox"><b>${dd.getDate()}</b><span>${DAYN[dd.getDay()]}</span></div>
    <div style="flex:1 1 220px;min-width:0"><h1>${esc(hname)}</h1><div class="muted">${fmtDate(s.date)} · ${fmtTime(s.time)}${s.note ? ' · ' + esc(s.note) : ''}</div></div>
    <div class="row">${s.link ? `<a class="btn pri" href="${esc(s.link)}" target="_blank" rel="noopener">افتح الحصة</a><button class="btn" data-act="copy" data-text="${esc(s.link)}">نسخ الرابط</button>` : `<span class="chip warn">ما فيه رابط</span>`}<button class="btn" data-act="edit-session" data-id="${s.id}">تعديل</button></div></div>
  <div class="grid2">
  <section class="card"><div class="sec-head"><h2>التحضير</h2><div class="row"><button class="btn sm" data-act="att-joined">تحضير من دخل</button><button class="btn sm" data-act="att-rest">الباقي غائب</button></div></div>
    ${studs.length ? `<div class="list">${studs.map(attRow).join('')}</div>` : '<div class="empty">ما فيه طلاب معتمدون في هذه الحلقة.</div>'}</section>
  <section class="card" style="display:grid;gap:12px"><h2>طابور التسميع</h2>
    ${cur ? `<div class="now"><div style="flex:1 1 160px;min-width:0"><div class="lbl">يسمّع الآن</div><div class="name">${esc(cur.name)}</div></div><button class="btn pri" data-act="rec" data-id="${cur.id}">سجّل التسميع</button><button class="btn" data-act="q-next">التالي</button></div>` : (queue.length ? `<button class="btn pri" data-act="q-next">ابدأ بأول الطابور</button>` : '')}
    ${queue.length ? `<div class="list">${queue.map((id, i) => `<div class="item"><span class="qnum">${i + 1}</span><div class="grow name">${esc(S.users[id].name)}</div><button class="btn ghost sm" data-act="q-up" data-i="${i}" aria-label="تقديم">▲</button><button class="btn ghost sm" data-act="q-down" data-i="${i}" aria-label="تأخير">▼</button><button class="btn ghost sm" data-act="rec" data-id="${id}">سجّل</button><button class="btn ghost sm" data-act="q-rm" data-i="${i}" aria-label="حذف">✕</button></div>`).join('')}</div>` : (!cur ? '<div class="empty small">الطابور فاضي. أضف الحاضرين بالترتيب اللي تبيه.</div>' : '')}
    <div class="row"><select id="q-pick" style="flex:1 1 160px"><option value="">إضافة طالب…</option>${notQueued.map(x => `<option value="${x.id}">${esc(x.name)}${att[x.id] === 'p' || att[x.id] === 'l' ? '' : ' (غير محضّر)'}</option>`).join('')}</select><button class="btn" data-act="q-add">أضف</button><button class="btn" data-act="q-all">كل الحاضرين</button></div>
  </section></div>
  <section class="card"><h2>تسميع هذه الحصة</h2>
  ${recs.length ? `<div class="tbl-wrap"><table><thead><tr><th>الطالب</th><th>النوع</th><th>المقطع</th><th class="num">أخطاء</th><th class="num">تنبيهات</th><th>التقدير</th><th></th></tr></thead><tbody>
    ${recs.map(r => `<tr><td>${esc((S.users[r.uid] || {}).name || '—')}</td><td>${TYPE[r.type] || ''}</td><td>${segText([{ s: r.surah - 1, a1: r.from, a2: r.to }])}</td><td class="num">${r.mistakes}</td><td class="num">${r.alerts}</td><td><span class="chip ${GRADE_K[r.grade] || ''}">${esc(r.grade)}</span></td><td><button class="btn ghost sm" data-act="del-rec" data-id="${r.id}">حذف</button></td></tr>`).join('')}
  </tbody></table></div>` : '<div class="empty small">ما سُجّل تسميع في هذه الحصة بعد.</div>'}</section>`;
}

/* ---- students ---- */
function studentsV(u) {
  const hs = myHalaqat(u); const hids = hs.map(h => h.id);
  let list = L('users').filter(x => x.role === 'student' && x.status !== 'pending' && (u.role === 'admin' || hids.includes(x.halqaId)));
  if (ST.halqa) list = list.filter(x => x.halqaId === ST.halqa);
  const q = (ST.q || '').trim(); if (q) list = list.filter(x => (x.name || '').includes(q) || (x.username || '').toLowerCase().includes(q.toLowerCase()));
  list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
  return `<div class="sec-head"><h1>${u.role === 'admin' ? 'الطلاب' : 'طلابي'}</h1>${u.role === 'admin' ? '<button class="btn pri" data-act="add-student">إضافة طالب</button>' : ''}</div>
  <div class="row"><input id="st-q" placeholder="ابحث بالاسم أو اسم المستخدم" value="${esc(ST.q)}" data-input="search" style="flex:1 1 220px">
  ${hs.length > 1 ? `<select id="st-h" data-change="filter-h" style="flex:0 1 200px"><option value="">كل الحلقات</option>${hs.map(h => `<option value="${h.id}" ${ST.halqa === h.id ? 'selected' : ''}>${esc(h.name)}</option>`).join('')}</select>` : ''}</div>
  <section class="card">${list.length ? `<div class="list">${list.map(x => { const a = attStats(x, 30); return `<div class="item click" data-act="open-student" data-id="${x.id}"><div class="grow"><div class="name">${esc(x.name)}</div><div class="small muted">${esc(halqaName(x.halqaId))} · <span dir="ltr">${esc(x.username)}</span></div></div>
    ${x.status === 'disabled' ? '<span class="chip bad">موقوف</span>' : ''}<span class="chip ${isAuto(x) ? 'acc' : ''}">${isAuto(x) ? 'خطة تلقائية' : 'خطة يدوية'}</span><span class="chip num">حضور ${a.rate == null ? '—' : a.rate + '٪'}</span></div>`; }).join('')}</div>` : `<div class="empty">${q ? 'ما فيه نتائج.' : 'ما فيه طلاب معتمدون بعد.'}</div>`}</section>`;
}
function planHtml(st) {
  const ps = planSegs(st); const rows = ['new', 'review', 'tath'].filter(k => ps[k]);
  const p = planOf(st); const auto = isAuto(st);
  const workday = halqaDays(st.halqaId).includes(new Date().getDay());
  const head = auto ? `<span class="chip acc">تلقائية</span> <span class="small muted">حفظ ${fmtAmt(p.auto.newAmt)}، مراجعة ${fmtAmt(p.auto.revAmt)}${+p.auto.tathAmt ? '، تثبيت ' + fmtAmt(p.auto.tathAmt) : ''} · ${p.auto.dir === 'fwd' ? 'من الفاتحة' : 'من الناس'}</span>` : `<span class="chip">يدوية</span>`;
  return `<div class="plan"><div class="row">${head}${workday ? '' : '<span class="chip gold">اليوم إجازة</span>'}</div>
  ${rows.length ? rows.map(k => `<div class="plan-row"><span class="lbl">${TYPE[k]}</span><div>${segText(ps[k])}</div></div>`).join('') : `<div class="empty small">${auto && ps._info && ps._info.done ? 'أتمّ الحفظ في هذا الاتجاه، ما شاء الله.' : 'ما حُدّد مقطع بعد.'}</div>`}
  ${auto && ps._info ? `<div class="small muted">وصل في الحفظ إلى: ${esc(posText(p.auto.dir, p.auto.newPos))} · المحفوظ تقريبًا ${Math.round(ps._info.memPages)} وجه${PAGES_OK ? '' : ' (تقدير تقريبي للأوجه)'}</div>` : ''}</div>`;
}
function profileV(u) {
  const st = S.users[ST.uid] && { ...S.users[ST.uid], id: ST.uid };
  if (!st) return `<button class="back" data-act="tab" data-v="students">→ الطلاب</button><div class="empty">الطالب غير موجود.</div>`;
  const a = attStats(st, ST.range); const rs = recsOf(st.id); const fields = SET().fields;
  const inRange = rs.filter(r => !ST.range || r.date >= addDays(today(), -ST.range));
  const avg = inRange.length ? (inRange.reduce((x, r) => x + (+r.mistakes || 0), 0) / inRange.length).toFixed(1) : '—';
  const wa = st.parentPhone ? waLink(st.parentPhone, 'السلام عليكم ورحمة الله، ') : '';
  return `<button class="back" data-act="tab" data-v="students">→ ${u.role === 'admin' ? 'الطلاب' : 'طلابي'}</button>
  <div class="sec-head"><div><h1>${esc(st.name)}</h1><div class="muted">${esc(halqaName(st.halqaId))} · <span dir="ltr">${esc(st.username)}</span>${st.status === 'disabled' ? ' · <span class="chip bad">موقوف</span>' : ''}</div></div>
    <div class="row">${wa ? `<a class="btn wa" href="${wa}" target="_blank" rel="noopener">واتساب ولي الأمر</a>` : ''}${u.role === 'admin' ? `<button class="btn" data-act="edit-student" data-id="${st.id}">تعديل البيانات</button>` : ''}</div></div>
  <div class="row">${[7, 30, 90, 0].map(d => `<button class="btn sm ${ST.range === d ? 'pri' : ''}" data-act="range" data-d="${d}">${d ? 'آخر ' + d + ' يوم' : 'الكل'}</button>`).join('')}</div>
  <div class="stats"><div class="stat"><b>${a.rate == null ? '—' : a.rate + '٪'}</b><span>نسبة الحضور</span></div><div class="stat"><b>${a.a}</b><span>غياب</span></div><div class="stat"><b>${a.l}</b><span>تأخر</span></div><div class="stat"><b>${inRange.length}</b><span>تسميع</span></div><div class="stat"><b>${avg}</b><span>متوسط الأخطاء</span></div></div>
  <div class="grid2">
  <section class="card" style="display:grid;gap:12px"><div class="sec-head"><h2>الخطة</h2>${canPlan(u) ? `<button class="btn sm" data-act="edit-plan" data-id="${st.id}">تعديل الخطة</button>` : ''}</div>
    ${planHtml(st)}
    ${u.role === 'admin' ? `<label class="check"><input type="checkbox" id="pf-auto-${st.id}" data-change="student-auto" data-id="${st.id}" ${st.autoAllowed ? 'checked' : ''}> السماح بالخطة التلقائية لهذا الطالب</label>` : ''}</section>
  <section class="card"><h2>البيانات</h2><dl class="kv">${fields.filter(f => st[f.k]).map(f => `<dt>${esc(f.label)}</dt><dd ${f.type === 'tel' ? 'dir="ltr" style="text-align:right"' : ''}>${esc(st[f.k])}</dd>`).join('') || '<dt>—</dt><dd></dd>'}</dl></section></div>
  <section class="card"><h2>سجل التسميع</h2>${historyTable(inRange)}</section>`;
}
function historyTable(rs) {
  if (!rs.length) return '<div class="empty small">ما فيه تسميع في هذه الفترة.</div>';
  return `<div class="tbl-wrap"><table><thead><tr><th>التاريخ</th><th>النوع</th><th>المقطع</th><th class="num">أخطاء</th><th class="num">تنبيهات</th><th>التقدير</th><th>ملاحظة</th></tr></thead><tbody>
  ${rs.slice(0, 60).map(r => `<tr><td>${fmtDate(r.date)}</td><td>${TYPE[r.type] || ''}</td><td>${segText([{ s: r.surah - 1, a1: r.from, a2: r.to }])}</td><td class="num">${r.mistakes}</td><td class="num">${r.alerts}</td><td><span class="chip ${GRADE_K[r.grade] || ''}">${esc(r.grade)}</span></td><td style="white-space:normal;min-width:120px">${esc(r.note || '')}</td></tr>`).join('')}</tbody></table></div>`;
}

/* ---- admin: teachers ---- */
function teachersV() {
  const ts = L('users').filter(u => u.role === 'teacher').sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
  return `<div class="sec-head"><h1>المعلمون</h1><button class="btn pri" data-act="add-teacher">إضافة معلم</button></div>
  <div class="note info">صلاحية <b>إعداد الخطط</b> تسمح للمعلم ينشئ ويعدّل خطط طلابه. صلاحية <b>الخطة التلقائية</b> تسمح له يحوّل الخطة لتلقائية، بشرط إن الطالب نفسه مسموح له من صفحته.</div>
  <section class="card">${ts.length ? `<div class="list">${ts.map(t => { const hs = L('halaqat').filter(h => h.teacherId === t.id); return `<div class="item"><div class="grow"><div class="name">${esc(t.name)}</div><div class="small muted"><span dir="ltr">${esc(t.username)}</span> · ${hs.length ? hs.map(h => esc(h.name)).join('، ') : 'بدون حلقة'}</div></div>
    ${t.status === 'disabled' ? '<span class="chip bad">موقوف</span>' : ''}
    <label class="check"><input type="checkbox" id="tc-plan-${t.id}" data-change="t-perm" data-k="canPlan" data-id="${t.id}" ${t.canPlan ? 'checked' : ''}> إعداد الخطط</label>
    <label class="check"><input type="checkbox" id="tc-auto-${t.id}" data-change="t-perm" data-k="canAuto" data-id="${t.id}" ${t.canAuto ? 'checked' : ''}> الخطة التلقائية</label>
    <button class="btn sm" data-act="edit-teacher" data-id="${t.id}">تعديل</button></div>`; }).join('')}</div>` : '<div class="empty">ما فيه معلمون بعد. أضف معلمًا ثم أسند له حلقة.</div>'}</section>`;
}

/* ---- admin: halaqat ---- */
function halaqatV() {
  const hs = L('halaqat').sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
  return `<div class="sec-head"><h1>الحلقات</h1><button class="btn pri" data-act="add-halqa">حلقة جديدة</button></div>
  ${hs.length ? `<div class="grid2">${hs.map(h => { const t = h.teacherId && S.users[h.teacherId]; return `<section class="card" style="display:grid;gap:10px">
    <div class="sec-head"><h2>${esc(h.name)}</h2><button class="btn sm" data-act="edit-halqa" data-id="${h.id}">تعديل</button></div>
    <dl class="kv"><dt>المعلم</dt><dd>${t ? esc(t.name) : '<span class="chip warn">غير مسند</span>'}</dd><dt>أيام الدوام</dt><dd>${halqaDays(h.id).map(d => DAYN[d]).join('، ')}</dd><dt>الوقت المعتاد</dt><dd>${h.time ? fmtTime(h.time) : '—'}</dd><dt>الطلاب</dt><dd class="num">${studentsOf(h.id).length}</dd></dl>
    <button class="btn sm" data-act="copy-reg" data-h="${h.id}">نسخ رابط التسجيل لهذه الحلقة</button></section>`; }).join('')}</div>` : '<div class="empty">ما فيه حلقات. أنشئ أول حلقة وحدد معلمها وأيام دوامها.</div>'}`;
}

/* ---- reports ---- */
function reportsV(u) {
  const hs = myHalaqat(u);
  if (!hs.length) return `<h1>التقارير</h1><div class="empty">ما فيه حلقات.</div>`;
  const hid = hs.some(h => h.id === ST.halqa) ? ST.halqa : hs[0].id;
  const studs = studentsOf(hid); const from = ST.range ? addDays(today(), -ST.range) : '';
  const nSess = L('sessions').filter(s => s.halqaId === hid && s.date <= today() && (!from || s.date >= from)).length;
  const rows = studs.map(st => { const a = attStats(st, ST.range); const rs = recsOf(st.id).filter(r => !from || r.date >= from); const rep = rs.filter(r => r.pass === false).length; const avg = rs.length ? (rs.reduce((x, r) => x + (+r.mistakes || 0), 0) / rs.length).toFixed(1) : '—'; return { st, a, n: rs.length, rep, avg }; });
  const tot = rows.reduce((x, r) => ({ p: x.p + r.a.p + r.a.l, m: x.m + r.a.p + r.a.l + r.a.a + r.a.e, n: x.n + r.n }), { p: 0, m: 0, n: 0 });
  return `<h1>التقارير</h1>
  <div class="row"><select id="rp-h" data-change="filter-h" style="flex:0 1 220px">${hs.map(h => `<option value="${h.id}" ${h.id === hid ? 'selected' : ''}>${esc(h.name)}</option>`).join('')}</select>
  ${[7, 30, 90, 0].map(d => `<button class="btn sm ${ST.range === d ? 'pri' : ''}" data-act="range" data-d="${d}">${d ? 'آخر ' + d + ' يوم' : 'الكل'}</button>`).join('')}</div>
  <div class="stats"><div class="stat"><b>${nSess}</b><span>حصة</span></div><div class="stat"><b>${tot.m ? Math.round(tot.p / tot.m * 100) + '٪' : '—'}</b><span>نسبة حضور الحلقة</span></div><div class="stat"><b>${tot.n}</b><span>تسميع مسجّل</span></div><div class="stat"><b>${studs.length}</b><span>طالب</span></div></div>
  <section class="card">${rows.length ? `<div class="tbl-wrap"><table><thead><tr><th>الطالب</th><th class="num">حضور</th><th class="num">تأخر</th><th class="num">غياب</th><th class="num">استئذان</th><th class="num">النسبة</th><th class="num">تسميع</th><th class="num">أعاد</th><th class="num">متوسط الأخطاء</th></tr></thead><tbody>
  ${rows.map(r => `<tr class="click" style="cursor:pointer" data-act="open-student" data-id="${r.st.id}"><td>${esc(r.st.name)}</td><td class="num">${r.a.p}</td><td class="num">${r.a.l}</td><td class="num">${r.a.a}</td><td class="num">${r.a.e}</td><td class="num"><span class="chip ${r.a.rate == null ? '' : r.a.rate >= 85 ? 'ok' : r.a.rate >= 65 ? 'warn' : 'bad'}">${r.a.rate == null ? '—' : r.a.rate + '٪'}</span></td><td class="num">${r.n}</td><td class="num">${r.rep}</td><td class="num">${r.avg}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">ما فيه طلاب في هذه الحلقة.</div>'}</section>`;
}

/* ---- admin: settings ---- */
function settingsV() {
  const st = SET();
  return `<h1>الإعدادات</h1>
  <form class="card" data-form="settings" style="gap:18px">
    <label class="fld"><span>اسم الحلقات أو المجمع</span><input id="sg-center" name="center" value="${esc(st.center)}" required></label>
    <div class="fld"><span>أيام الدوام الافتراضية</span><div class="days">${DAYN.map((d, i) => `<label><input type="checkbox" id="sg-day-${i}" name="day" value="${i}" ${st.days.includes(i) ? 'checked' : ''}> ${d}</label>`).join('')}</div><span class="small muted" style="font-weight:400">تقدر تغيّرها لكل حلقة من تبويب الحلقات.</span></div>
    <div class="fld"><span>سلّم التقدير بعدد الأخطاء</span>
      <div class="fgrid"><label class="fld"><span>ممتاز إذا الأخطاء حتى</span><input id="sg-ex" name="ex" type="number" min="0" value="${st.grade.ex}"></label><label class="fld"><span>جيد جدًا حتى</span><input id="sg-vg" name="vg" type="number" min="0" value="${st.grade.vg}"></label><label class="fld"><span>جيد حتى</span><input id="sg-gd" name="gd" type="number" min="0" value="${st.grade.gd}"></label><label class="fld"><span>كل كم تنبيه = خطأ</span><input id="sg-al" name="alertsPer" type="number" min="1" value="${st.grade.alertsPer}"></label></div>
      <span class="small muted" style="font-weight:400">ما فوق «جيد» يكون «يعاد»، ولا تتقدم الخطة التلقائية إلا بعد النجاح.</span></div>
    <div class="fld"><span>حقول التسجيل</span><div class="small muted" style="font-weight:400">الاسم واسم المستخدم وكلمة المرور ثابتة دائمًا.</div>
      <div class="tbl-wrap"><table class="fields-tbl"><thead><tr><th>الحقل</th><th class="num">ظاهر</th><th class="num">إجباري</th><th></th></tr></thead><tbody>
      ${st.fields.map(f => `<tr><td><input id="sf-lb-${f.k}" name="lb-${f.k}" value="${esc(f.label)}" style="min-width:140px"></td><td class="num"><input type="checkbox" id="sf-on-${f.k}" name="on-${f.k}" ${f.on ? 'checked' : ''}></td><td class="num"><input type="checkbox" id="sf-req-${f.k}" name="req-${f.k}" ${f.req ? 'checked' : ''}></td><td>${f.custom ? `<button type="button" class="btn ghost sm" data-act="sf-del" data-k="${f.k}">حذف</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div><div><button type="button" class="btn sm" data-act="sf-add">إضافة حقل</button></div></div>
    <div class="fld"><span>رسائل واتساب لولي الأمر</span><span class="small muted" style="font-weight:400">استخدم {الطالب} و{الحلقة} و{التاريخ} وتنعبّى تلقائيًا.</span>
      <label class="fld"><span>رسالة الغياب</span><textarea id="sg-tA" name="absent" rows="3">${esc(st.tpl.absent)}</textarea></label>
      <label class="fld"><span>رسالة التميّز</span><textarea id="sg-tE" name="excellent" rows="3">${esc(st.tpl.excellent)}</textarea></label></div>
    <div><button class="btn pri" type="submit">حفظ الإعدادات</button></div>
  </form>`;
}

/* ---- student / parent home ---- */
function homeV(u) {
  const t = today(); const hs = S.halaqat[u.halqaId];
  const sess = L('sessions').filter(s => s.halqaId === u.halqaId);
  const next = sess.filter(s => s.date >= t).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
  const joined = next && L('joins').some(j => j.sid === next.id && j.uid === u.id);
  const a = attStats(u, 30); const rs = recsOf(u.id);
  const past = sess.filter(s => s.date <= t).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)).slice(0, 6);
  return `<div><h1>السلام عليكم، ${esc((u.name || '').split(' ')[0])}</h1><div class="muted">${hs ? esc(hs.name) : ''} · هذه الصفحة يتابع منها ولي الأمر أيضًا</div></div>
  ${next ? `<div class="join-card"><div class="grow"><div class="small muted">${next.date === t ? 'حصة اليوم' : 'الحصة القادمة'}</div><h2>${fmtDate(next.date)} · ${fmtTime(next.time)}</h2>${next.note ? `<div class="small">${esc(next.note)}</div>` : ''}${(next.att || {})[u.id] ? `<span class="chip ${ATTC[next.att[u.id]]}">${ATT[next.att[u.id]]}</span>` : ''}</div>
    ${next.link ? `<a class="btn pri big" href="${esc(next.link)}" target="_blank" rel="noopener" data-act="join" data-id="${next.id}">${joined ? 'ادخل الحصة مرة ثانية' : 'ادخل الحصة'}</a>` : '<span class="chip warn">الرابط ينزل قبل الحصة</span>'}</div>` : `<div class="empty">ما فيه حصة قادمة حاليًا.</div>`}
  <div class="grid2">
    <section class="card" style="display:grid;gap:12px"><h2>المطلوب منك</h2>${planHtml(u)}</section>
    <section class="card" style="display:grid;gap:12px"><h2>آخر ٣٠ يوم</h2><div class="stats"><div class="stat"><b>${a.rate == null ? '—' : a.rate + '٪'}</b><span>الحضور</span></div><div class="stat"><b>${a.a}</b><span>غياب</span></div><div class="stat"><b>${rs.filter(r => r.date >= addDays(t, -30)).length}</b><span>تسميع</span></div></div>
    ${past.length ? `<div class="list">${past.map(s => { const v = (s.att || {})[u.id]; return `<div class="item"><div class="grow">${fmtDate(s.date)}</div><span class="chip ${v ? ATTC[v] : ''}">${v ? ATT[v] : 'لم يُحضَّر'}</span></div>`; }).join('')}</div>` : ''}</section>
  </div>
  <section class="card"><h2>سجل التسميع</h2>${historyTable(rs)}</section>`;
}

/* ---------------- modals ---------------- */
let CONFIRM = null;
function openModal(html) { const m = $('#modal'); m.innerHTML = `<div class="dlg" role="dialog" aria-modal="true">${html}</div>`; m.hidden = false; const f = m.querySelector('input:not([type=hidden]),select,textarea'); if (f) setTimeout(() => f.focus(), 30); }
function closeModal() { $('#modal').hidden = true; $('#modal').innerHTML = ''; }
const dlgHead = t => `<div class="dlg-head"><h2>${t}</h2><button class="btn ghost sm" data-act="close" aria-label="إغلاق">✕</button></div>`;
function confirmBox(text, yesLabel, fn) { CONFIRM = fn; openModal(`${dlgHead('تأكيد')}<div>${text}</div><div class="dlg-foot"><button class="btn danger" data-act="confirm-yes">${yesLabel}</button><button class="btn" data-act="close">إلغاء</button></div>`); }
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });
const surahOptions = sel => `<option value="">—</option>` + SN.map((n, i) => `<option value="${i + 1}" ${+sel === i + 1 ? 'selected' : ''}>${i + 1}. ${esc(n)}</option>`).join('');

function sessionModal(s) {
  const u = me(); const hs = myHalaqat(u); const isNew = !s;
  const h0 = s ? s.halqaId : (ST.halqa || (hs[0] && hs[0].id));
  const lastTime = (S.halaqat[h0] && S.halaqat[h0].time) || '';
  openModal(`${dlgHead(isNew ? 'حصة جديدة' : 'تعديل الحصة')}
  <form data-form="session" data-id="${s ? s.id : ''}">
    <label class="fld"><span>الحلقة</span><select name="halqaId" ${isNew ? '' : 'disabled'}>${hs.map(h => `<option value="${h.id}" ${h.id === h0 ? 'selected' : ''}>${esc(h.name)}</option>`).join('')}</select></label>
    <div class="fgrid"><label class="fld"><span>التاريخ</span><input type="date" name="date" value="${s ? s.date : today()}" required></label><label class="fld"><span>الوقت</span><input type="time" name="time" value="${s ? s.time : lastTime}" required></label></div>
    <label class="fld"><span>رابط الحصة (Zoom أو Meet أو Teams)</span><input name="link" type="url" dir="ltr" value="${esc(s ? s.link : '')}" placeholder="https://"></label>
    <label class="fld"><span>ملاحظة (اختياري)</span><input name="note" value="${esc(s ? s.note : '')}" placeholder="مثال: مراجعة جزء عمّ"></label>
    <div class="dlg-foot"><button class="btn pri" type="submit">${isNew ? 'إنشاء الحصة' : 'حفظ'}</button>${s ? `<button type="button" class="btn danger" data-act="del-session" data-id="${s.id}">حذف الحصة</button>` : ''}</div>
  </form>`);
}
let REC_PLAN = {}, REC_EXTRA = () => '';
function recModal(uid, sid) {
  const st = { ...S.users[uid], id: uid }; const ps = planSegs(st);
  const first = ['new', 'review', 'tath'].find(k => ps[k]) || 'new';
  const sug = k => ps[k] && ps[k][0];
  const s0 = sug(first);
  REC_PLAN = { new: sug('new'), review: sug('review'), tath: sug('tath') };
  REC_EXTRA = k => ps[k] && ps[k].length > 1 ? `<div class="small muted">المقطع المطلوب كامل: ${segText(ps[k])}. سجّل كل سورة لحالها.</div>` : '';
  openModal(`${dlgHead('تسجيل تسميع')}<div class="muted">${esc(st.name)}</div>
  <form data-form="rec" data-uid="${uid}" data-sid="${sid}">
    <label class="fld"><span>النوع</span><select name="type" id="rc-type" data-change="rec-type">${Object.keys(TYPE).map(k => `<option value="${k}" ${k === first ? 'selected' : ''}>${TYPE[k]}${ps[k] ? ' (في الخطة)' : ''}</option>`).join('')}</select></label>
    <div id="rc-hint">${REC_EXTRA(first)}</div>
    <label class="fld"><span>السورة</span><select name="surah" id="rc-surah" required data-change="rec-surah">${surahOptions(s0 ? s0.s + 1 : '')}</select></label>
    <div class="fgrid"><label class="fld"><span>من آية</span><input name="from" id="rc-from" type="number" min="1" value="${s0 ? s0.a1 : ''}" required></label><label class="fld"><span>إلى آية</span><input name="to" id="rc-to" type="number" min="1" value="${s0 ? s0.a2 : ''}" required></label></div>
    <div class="fgrid"><label class="fld"><span>الأخطاء</span><input name="mistakes" id="rc-m" type="number" min="0" value="0" data-input="grade"></label><label class="fld"><span>التنبيهات</span><input name="alerts" id="rc-a" type="number" min="0" value="0" data-input="grade"></label></div>
    <div class="row"><span class="muted small">التقدير:</span><span id="rc-grade" class="grade-preview"><span class="chip ok">ممتاز</span></span></div>
    <label class="fld"><span>ملاحظة للطالب وولي الأمر (اختياري)</span><input name="note" placeholder="مثال: انتبه لأحكام المد"></label>
    <div class="dlg-foot"><button class="btn pri" type="submit">حفظ التسميع</button><button type="button" class="btn" data-act="close">إلغاء</button></div>
  </form>`);
}
function studentModal(st) {
  const fields = SET().fields; const hs = L('halaqat'); const isNew = !st;
  openModal(`${dlgHead(isNew ? 'إضافة طالب' : 'تعديل بيانات الطالب')}
  <form data-form="student" data-id="${st ? st.id : ''}">
    <label class="fld"><span>الاسم الكامل</span><input name="name" value="${esc(st ? st.name : '')}" required></label>
    <div class="fgrid"><label class="fld"><span>اسم المستخدم</span><input name="username" dir="ltr" autocapitalize="none" value="${esc(st ? st.username : '')}" required pattern="[A-Za-z0-9_.]{3,30}"></label>
    <label class="fld"><span>${isNew ? 'كلمة المرور' : 'كلمة مرور جديدة (اتركها فاضية)'}</span><input name="password" type="password" ${isNew ? 'required minlength="4"' : ''} autocomplete="new-password"></label></div>
    <div class="fgrid">${fields.map(f => fieldHtml(f, st ? st[f.k] : '', 'sm-', { forceReq: false })).join('')}</div>
    <div class="fgrid"><label class="fld"><span>الحلقة</span><select name="halqaId" required>${hs.map(h => `<option value="${h.id}" ${st && st.halqaId === h.id ? 'selected' : ''}>${esc(h.name)}</option>`).join('')}</select></label>
    <label class="fld"><span>الحالة</span><select name="status"><option value="active" ${!st || st.status === 'active' ? 'selected' : ''}>نشط</option><option value="disabled" ${st && st.status === 'disabled' ? 'selected' : ''}>موقوف</option></select></label></div>
    <div class="dlg-foot"><button class="btn pri" type="submit">حفظ</button>${st ? `<button type="button" class="btn danger" data-act="del-user" data-id="${st.id}">حذف الطالب</button>` : ''}</div>
  </form>`);
}
function teacherModal(t) {
  const isNew = !t;
  openModal(`${dlgHead(isNew ? 'إضافة معلم' : 'تعديل المعلم')}
  <form data-form="teacher" data-id="${t ? t.id : ''}">
    <label class="fld"><span>الاسم</span><input name="name" value="${esc(t ? t.name : '')}" required></label>
    <div class="fgrid"><label class="fld"><span>اسم المستخدم</span><input name="username" dir="ltr" autocapitalize="none" value="${esc(t ? t.username : '')}" required pattern="[A-Za-z0-9_.]{3,30}"></label>
    <label class="fld"><span>${isNew ? 'كلمة المرور' : 'كلمة مرور جديدة (اتركها فاضية)'}</span><input name="password" type="password" ${isNew ? 'required minlength="4"' : ''} autocomplete="new-password"></label></div>
    <label class="fld"><span>الجوال</span><input name="phone" type="tel" dir="ltr" value="${esc(t ? t.phone : '')}"></label>
    <div class="row"><label class="check"><input type="checkbox" name="canPlan" ${!t || t.canPlan ? 'checked' : ''}> إعداد الخطط</label><label class="check"><input type="checkbox" name="canAuto" ${t && t.canAuto ? 'checked' : ''}> الخطة التلقائية</label></div>
    ${t ? `<label class="fld"><span>الحالة</span><select name="status"><option value="active" ${t.status !== 'disabled' ? 'selected' : ''}>نشط</option><option value="disabled" ${t.status === 'disabled' ? 'selected' : ''}>موقوف</option></select></label>` : ''}
    <div class="dlg-foot"><button class="btn pri" type="submit">حفظ</button>${t ? `<button type="button" class="btn danger" data-act="del-user" data-id="${t.id}">حذف المعلم</button>` : ''}</div>
  </form>`);
}
function halqaModal(h) {
  const ts = L('users').filter(u => u.role === 'teacher' && u.status !== 'disabled'); const days = h && h.days && h.days.length ? h.days : SET().days;
  openModal(`${dlgHead(h ? 'تعديل الحلقة' : 'حلقة جديدة')}
  <form data-form="halqa" data-id="${h ? h.id : ''}">
    <label class="fld"><span>اسم الحلقة</span><input name="name" value="${esc(h ? h.name : '')}" required placeholder="مثال: حلقة أبي بن كعب"></label>
    <label class="fld"><span>المعلم</span><select name="teacherId"><option value="">بدون معلم</option>${ts.map(t => `<option value="${t.id}" ${h && h.teacherId === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>
    <div class="fld"><span>أيام الدوام</span><div class="days">${DAYN.map((d, i) => `<label><input type="checkbox" name="day" value="${i}" ${days.includes(i) ? 'checked' : ''}> ${d}</label>`).join('')}</div></div>
    <label class="fld"><span>الوقت المعتاد للحصة</span><input type="time" name="time" value="${esc(h ? h.time : '')}"></label>
    <div class="dlg-foot"><button class="btn pri" type="submit">حفظ</button>${h ? `<button type="button" class="btn danger" data-act="del-halqa" data-id="${h.id}">حذف الحلقة</button>` : ''}</div>
  </form>`);
}
function planModal(st) {
  const u = me(); const p = planOf(st); const allowAuto = canAutoU(u) && st.autoAllowed;
  const a = p.auto; const dirO = ORD[a.dir] || ORD.bwd; const curG = a.newPos < TOTAL ? dirO.ord[a.newPos] : null;
  const curS = curG != null ? SUR[curG] + 1 : (a.dir === 'fwd' ? 1 : 114); const curA = curG != null ? curG - SSTART[curS - 1] + 1 : 1;
  const man = k => p.manual[k] || {};
  const amtSel = (name, val, opts) => `<select name="${name}">${opts.map(o => `<option value="${o}" ${+val === o ? 'selected' : ''}>${o ? fmtAmt(o) : 'بدون'}</option>`).join('')}</select>`;
  const autoOn = p.mode === 'auto' && allowAuto;
  openModal(`${dlgHead('خطة ' + esc(st.name))}
  <form data-form="plan" data-id="${st.id}">
    <div class="row"><label class="check"><input type="radio" name="mode" value="manual" data-change="plan-mode" ${autoOn ? '' : 'checked'}> يدوية</label>
    <label class="check"><input type="radio" name="mode" value="auto" data-change="plan-mode" ${autoOn ? 'checked' : ''} ${allowAuto ? '' : 'disabled'}> تلقائية</label></div>
    ${allowAuto ? '' : `<div class="note small">${!st.autoAllowed ? 'الخطة التلقائية غير مسموحة لهذا الطالب. يفعّلها المدير من صفحة الطالب.' : 'ما عندك صلاحية الخطة التلقائية. يفعّلها المدير من تبويب المعلمين.'}</div>`}
    <div id="pm-manual" ${autoOn ? 'hidden' : ''} style="display:grid;gap:12px">
      ${['new', 'review', 'tath'].map(k => `<div class="fld"><span>${TYPE[k]}</span><div class="fgrid"><select name="m-${k}-s">${surahOptions(man(k).surah)}</select><input name="m-${k}-f" type="number" min="1" placeholder="من آية" value="${man(k).from || ''}"><input name="m-${k}-t" type="number" min="1" placeholder="إلى آية" value="${man(k).to || ''}"></div></div>`).join('')}
      <div class="small muted">اترك السورة «—» إذا ما فيه مطلوب من هذا النوع.</div>
    </div>
    <div id="pm-auto" ${autoOn ? '' : 'hidden'} style="display:grid;gap:12px">
      <label class="fld"><span>اتجاه الحفظ</span><select name="dir"><option value="bwd" ${a.dir !== 'fwd' ? 'selected' : ''}>من الناس إلى البقرة</option><option value="fwd" ${a.dir === 'fwd' ? 'selected' : ''}>من الفاتحة إلى الناس</option></select></label>
      <div class="fld"><span>الحفظ الجديد يبدأ من</span><div class="fgrid"><select name="startS">${surahOptions(curS)}</select><input name="startA" type="number" min="1" value="${curA}"></div><span class="small muted" style="font-weight:400">كل ما قبل هذا الموضع (حسب الاتجاه) يُعتبر محفوظًا ويدخل في المراجعة.</span></div>
      <div class="fgrid"><label class="fld"><span>الحفظ اليومي</span>${amtSel('newAmt', a.newAmt, [0.125, 0.25, 0.5, 0.75, 1, 2])}</label>
      <label class="fld"><span>المراجعة اليومية</span>${amtSel('revAmt', a.revAmt, [0, 0.5, 1, 2, 3, 4, 5, 10, 20])}</label>
      <label class="fld"><span>التثبيت (آخر المحفوظ)</span>${amtSel('tathAmt', a.tathAmt, [0, 0.5, 1, 2, 3, 5])}</label></div>
      <div class="small muted">تتقدم الخطة فقط إذا سمّع الطالب ونجح. إذا غاب أو أعاد يبقى نفس المقطع للحصة الجاية.</div>
    </div>
    <div class="dlg-foot"><button class="btn pri" type="submit">حفظ الخطة</button><button type="button" class="btn" data-act="close">إلغاء</button></div>
  </form>`);
}
function pwModal() {
  openModal(`${dlgHead('تغيير كلمة المرور')}<form data-form="mypw"><label class="fld"><span>كلمة المرور الحالية</span><input name="old" type="password" required autocomplete="current-password"></label><label class="fld"><span>كلمة المرور الجديدة</span><input name="pw" type="password" required minlength="4" autocomplete="new-password"></label><div class="dlg-foot"><button class="btn pri" type="submit">حفظ</button></div></form>`);
}
const regLink = hid => location.origin + '/' + (hid ? '?join=' + hid : '#register');
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('تم النسخ'); }
  catch { openModal(`${dlgHead('انسخ النص')}<input id="cp-x" dir="ltr" value="${esc(text)}" readonly><div class="small muted">حدّد النص وانسخه.</div>`); setTimeout(() => { const i = $('#cp-x'); if (i) { i.focus(); i.select(); } }, 40); }
}

/* ---------------- actions ---------------- */
const curSession = () => ({ ...S.sessions[ST.sid], id: ST.sid });
const setQueue = (s, queue, current) => act('lesson.queue', current === undefined ? { id: s.id, queue } : { id: s.id, queue, current });
const ACT = {
  'tab': el => go(el.dataset.v),
  'logout': async () => { try { await api('/api/logout', {}); } catch {} ST.view = null; await load(); },
  'to-reg': () => { ST.reg = true; render(); },
  'from-reg': () => { ST.reg = false; ST.regDone = false; try { history.replaceState(null, '', '/'); } catch { location.hash = ''; } render(); },
  'close': () => closeModal(),
  'confirm-yes': async () => { const f = CONFIRM; CONFIRM = null; closeModal(); if (f) await f(); },
  'my-pw': () => pwModal(),
  'filter-h': el => { ST.halqa = el.dataset.h; render(); },
  'range': el => { ST.range = +el.dataset.d; render(); },
  'open-session': el => go('session', { sid: el.dataset.id }),
  'open-student': el => go('student', { uid: el.dataset.id }),
  'new-session': () => sessionModal(null),
  'edit-session': el => sessionModal({ ...S.sessions[el.dataset.id], id: el.dataset.id }),
  'del-session': el => confirmBox('تحذف الحصة؟ التسميع المسجّل فيها يبقى في سجل الطلاب.', 'حذف', async () => { if (await act('lesson.delete', { id: el.dataset.id }, 'حُذفت الحصة')) go('sessions'); }),
  'att': el => { const s = curSession(); const cur = (s.att || {})[el.dataset.id]; const v = cur === el.dataset.v ? null : el.dataset.v;
    S.sessions[s.id] = { ...S.sessions[s.id], att: { ...(s.att || {}), [el.dataset.id]: v || undefined } }; if (!v) delete S.sessions[s.id].att[el.dataset.id]; render();
    act('lesson.att', { id: s.id, uid: el.dataset.id, v }); },
  'att-joined': () => { const s = curSession(); const map = {}; L('joins').filter(j => j.sid === s.id).forEach(j => { if (!(s.att || {})[j.uid]) map[j.uid] = 'p'; }); if (!Object.keys(map).length) return toast('ما فيه أحد دخل من الموقع بعد'); act('lesson.att', { id: s.id, map }, 'تم تحضير ' + Object.keys(map).length); },
  'att-rest': () => { const s = curSession(); const map = {}; studentsOf(s.halqaId).forEach(x => { if (!(s.att || {})[x.id]) map[x.id] = 'a'; }); if (!Object.keys(map).length) return toast('كل الطلاب محضّرون'); act('lesson.att', { id: s.id, map }); },
  'q-add': () => { const id = $('#q-pick').value; if (!id) return; const s = curSession(); clean(); setQueue(s, [...(s.queue || []), id]); },
  'q-all': () => { const s = curSession(); const q = [...(s.queue || [])]; studentsOf(s.halqaId).forEach(x => { const v = (s.att || {})[x.id]; if ((v === 'p' || v === 'l') && !q.includes(x.id) && x.id !== s.current) q.push(x.id); }); setQueue(s, q); },
  'q-up': el => { const s = curSession(); const q = [...s.queue]; const i = +el.dataset.i; if (i > 0) { [q[i - 1], q[i]] = [q[i], q[i - 1]]; setQueue(s, q); } },
  'q-down': el => { const s = curSession(); const q = [...s.queue]; const i = +el.dataset.i; if (i < q.length - 1) { [q[i + 1], q[i]] = [q[i], q[i + 1]]; setQueue(s, q); } },
  'q-rm': el => { const s = curSession(); const q = [...s.queue]; q.splice(+el.dataset.i, 1); setQueue(s, q); },
  'q-next': () => { const s = curSession(); const q = [...(s.queue || [])]; const nx = q.shift() || null; setQueue(s, q, nx); },
  'rec': el => recModal(el.dataset.id, ST.sid),
  'del-rec': el => confirmBox('تحذف هذا التسميع؟ (الخطة التلقائية ما ترجع للخلف)', 'حذف', () => act('rec.delete', { id: el.dataset.id }, 'حُذف')),
  'join': el => { act('join', { lessonId: el.dataset.id }); },
  'copy': el => copyText(el.dataset.text),
  'copy-reg': el => copyText(regLink(el.dataset.h)),
  'approve': el => { const id = el.dataset.id; act('user.approve', { id, halqaId: $('#ap-h-' + id).value }, 'تم اعتماد الطالب'); },
  'reject': el => confirmBox('تحذف طلب التسجيل؟', 'حذف الطلب', () => act('user.delete', { id: el.dataset.id }, 'حُذف الطلب')),
  'add-student': () => { if (!L('halaqat').length) return toast('أنشئ حلقة أولًا'); studentModal(null); },
  'edit-student': el => studentModal({ ...S.users[el.dataset.id], id: el.dataset.id }),
  'del-user': el => confirmBox('تحذف هذا الحساب نهائيًا مع سجله؟', 'حذف', async () => { if (await act('user.delete', { id: el.dataset.id }, 'حُذف الحساب')) { if (ST.view === 'student') go('students'); } }),
  'add-teacher': () => teacherModal(null),
  'edit-teacher': el => teacherModal({ ...S.users[el.dataset.id], id: el.dataset.id }),
  'add-halqa': () => halqaModal(null),
  'edit-halqa': el => halqaModal({ ...S.halaqat[el.dataset.id], id: el.dataset.id }),
  'del-halqa': el => confirmBox('تحذف الحلقة؟', 'حذف', () => act('halqa.delete', { id: el.dataset.id }, 'حُذفت الحلقة')),
  'edit-plan': el => planModal({ ...S.users[el.dataset.id], id: el.dataset.id }),
  'sf-add': () => openModal(`${dlgHead('إضافة حقل تسجيل')}<form data-form="sf-add"><label class="fld"><span>اسم الحقل</span><input name="label" required placeholder="مثال: الحي"></label><label class="fld"><span>النوع</span><select name="type"><option value="text">نص</option><option value="tel">رقم جوال</option><option value="number">رقم</option></select></label><label class="check"><input type="checkbox" name="req"> إجباري</label><div class="dlg-foot"><button class="btn pri" type="submit">إضافة</button></div></form>`),
  'sf-del': el => { const st = SET(); act('settings.save', { data: { ...st, fields: st.fields.filter(f => f.k !== el.dataset.k) } }, 'حُذف الحقل'); },
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const fn = ACT[el.dataset.act]; if (!fn) return;
  if (el.tagName !== 'A') e.preventDefault();
  fn(el, e);
});

const CHG = {
  'filter-h': el => { ST.halqa = el.value; delete el.dataset.dirty; render(); },
  'student-auto': el => { delete el.dataset.dirty; act('user.flag', { id: el.dataset.id, k: 'autoAllowed', v: el.checked }, el.checked ? 'سُمح بالخطة التلقائية' : 'أُلغي السماح بالخطة التلقائية'); },
  't-perm': el => { delete el.dataset.dirty; act('user.flag', { id: el.dataset.id, k: el.dataset.k, v: el.checked }, 'تم تحديث الصلاحية'); },
  'plan-mode': el => { const auto = el.value === 'auto' && el.checked; $('#pm-auto').hidden = !auto; $('#pm-manual').hidden = auto; },
  'rec-type': el => { const s = REC_PLAN[el.value]; $('#rc-hint').innerHTML = REC_EXTRA(el.value); if (s) { $('#rc-surah').value = s.s + 1; $('#rc-from').value = s.a1; $('#rc-to').value = s.a2; } },
  'rec-surah': () => { const n = AYAS[+$('#rc-surah').value - 1]; if (n) { $('#rc-from').max = n; $('#rc-to').max = n; } },
};
document.addEventListener('change', e => { const el = e.target.closest('[data-change]'); if (el && CHG[el.dataset.change]) CHG[el.dataset.change](el, e); });
let searchT = 0;
const INP = {
  'grade': () => { const g = gradeOf($('#rc-m').value, $('#rc-a').value); $('#rc-grade').innerHTML = `<span class="chip ${g.k}">${g.t}</span>`; },
  'search': el => { ST.q = el.value; clearTimeout(searchT); searchT = setTimeout(render, 200); },
};
document.addEventListener('input', e => { const el = e.target.closest('[data-input]'); if (el && INP[el.dataset.input]) INP[el.dataset.input](el, e); });

/* ---------------- forms ---------------- */
const FORMS = {
  async login(f, d) {
    try { await api('/api/login', { username: d.get('username'), password: d.get('password') }); clean(); ST.view = null; ST.reg = false; await load(); }
    catch (e) { toast(e.message); }
  },
  async register(f, d) {
    const info = {}; (ST.regInfo?.fields || []).forEach(x => { info[x.k] = (d.get(x.k) || '').trim(); });
    try {
      await api('/api/register', { name: d.get('name'), username: d.get('username'), password: d.get('password'), info, reqHalqa: f.dataset.hid || d.get('reqHalqa') || '' });
      clean(); ST.regDone = true; render();
    } catch (e) { toast(e.message); }
  },
  async session(f, d) {
    const id = f.dataset.id;
    const data = { halqaId: d.get('halqaId'), date: d.get('date'), time: d.get('time'), link: (d.get('link') || '').trim(), note: (d.get('note') || '').trim() };
    const r = await act('lesson.save', { id, data }, id ? 'حُفظت الحصة' : 'أُنشئت الحصة');
    if (r) { closeModal(); if (!id && r.id) go('session', { sid: r.id }); }
  },
  async rec(f, d) {
    const sur = +d.get('surah'); const n = AYAS[sur - 1]; const from = +d.get('from'), to = +d.get('to');
    if (!n) return toast('اختر السورة');
    if (from < 1 || to < from || to > n) return toast('تأكد من أرقام الآيات (سورة ' + SN[sur - 1] + ' عدد آياتها ' + n + ')');
    const r = await act('rec.add', { uid: f.dataset.uid, lessonId: f.dataset.sid || '', type: d.get('type'), surah: sur, from, to, mistakes: +d.get('mistakes') || 0, alerts: +d.get('alerts') || 0, note: (d.get('note') || '').trim() }, r => 'سُجّل التسميع: ' + (r.grade || ''));
    if (r) closeModal();
  },
  async student(f, d) {
    const info = {}; SET().fields.forEach(x => { info[x.k] = (d.get(x.k) || '').trim(); });
    const r = await act('student.save', { id: f.dataset.id, data: { name: d.get('name'), username: d.get('username'), password: d.get('password'), halqaId: d.get('halqaId'), status: d.get('status'), info } }, f.dataset.id ? 'حُفظت البيانات' : 'أُضيف الطالب');
    if (r) closeModal();
  },
  async teacher(f, d) {
    const r = await act('teacher.save', { id: f.dataset.id, data: { name: d.get('name'), username: d.get('username'), password: d.get('password'), phone: d.get('phone'), canPlan: !!d.get('canPlan'), canAuto: !!d.get('canAuto'), status: d.get('status') } }, f.dataset.id ? 'حُفظ' : 'أُضيف المعلم');
    if (r) closeModal();
  },
  async halqa(f, d) {
    const days = d.getAll('day').map(Number); if (!days.length) return toast('اختر يوم دوام واحد على الأقل');
    const r = await act('halqa.save', { id: f.dataset.id, data: { name: d.get('name'), teacherId: d.get('teacherId'), days, time: d.get('time') } }, f.dataset.id ? 'حُفظت الحلقة' : 'أُنشئت الحلقة');
    if (r) closeModal();
  },
  async plan(f, d) {
    const manual = {};
    for (const k of ['new', 'review', 'tath']) { const s = +d.get('m-' + k + '-s'); if (!s) continue; const n = AYAS[s - 1]; const fr = +d.get('m-' + k + '-f') || 1, to = +d.get('m-' + k + '-t') || n; if (fr > n || to > n || fr > to) return toast('آيات ' + TYPE[k] + ' غير صحيحة (سورة ' + SN[s - 1] + ': ' + n + ' آية)'); manual[k] = { surah: s, from: fr, to }; }
    const r = await act('plan.save', { id: f.dataset.id, mode: d.get('mode'), manual, auto: { dir: d.get('dir'), startS: +d.get('startS'), startA: +d.get('startA'), newAmt: +d.get('newAmt'), revAmt: +d.get('revAmt'), tathAmt: +d.get('tathAmt') } }, 'حُفظت الخطة');
    if (r) closeModal();
  },
  async settings(f, d) {
    const st = SET(); const days = d.getAll('day').map(Number);
    if (!days.length) return toast('اختر يوم دوام واحد على الأقل');
    const fields = st.fields.map(x => ({ ...x, label: (d.get('lb-' + x.k) || x.label).trim() || x.label, on: !!d.get('on-' + x.k), req: !!d.get('req-' + x.k) && !!d.get('on-' + x.k) }));
    const data = { center: d.get('center'), days, fields, grade: { ex: +d.get('ex') || 0, vg: +d.get('vg') || 0, gd: +d.get('gd') || 0, alertsPer: Math.max(1, +d.get('alertsPer') || 3) }, tpl: { absent: d.get('absent'), excellent: d.get('excellent') } };
    if (await act('settings.save', { data }, 'حُفظت الإعدادات')) clean();
  },
  async 'sf-add'(f, d) {
    const st = SET(); const nf = { k: 'c_' + Date.now().toString(36), label: d.get('label').trim(), type: d.get('type'), on: true, req: !!d.get('req'), custom: true };
    if (await act('settings.save', { data: { ...st, fields: [...st.fields, nf] } }, 'أُضيف الحقل')) closeModal();
  },
  async mypw(f, d) { if (await act('me.password', { old: d.get('old'), pw: d.get('pw') }, 'تم تغيير كلمة المرور')) closeModal(); },
};
document.addEventListener('submit', e => {
  const f = e.target.closest('form[data-form]'); if (!f) return; e.preventDefault();
  const btn = f.querySelector('[type=submit]'); if (btn) btn.disabled = true;
  Promise.resolve(FORMS[f.dataset.form](f, new FormData(f))).finally(() => { if (btn && btn.isConnected) btn.disabled = false; });
});
window.addEventListener('hashchange', () => render());

/* ---------------- boot ---------------- */
load();
loadPages();
setInterval(() => { if (document.visibilityState === 'visible' && ST.meId && $('#modal').hidden) load(); }, 15000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && ST.meId) load(); });
})();
