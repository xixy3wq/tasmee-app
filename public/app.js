/* منصة حلقات ارتق — الواجهة. البيانات من /api/data والتعديلات عبر /api/act */
(function () {
'use strict';
const MY_V = (() => { try { return new URL(document.currentScript.src).searchParams.get('v') || ''; } catch { return ''; } })();

/* ---------------- Quran data ---------------- */
const SN = "الفاتحة|البقرة|آل عمران|النساء|المائدة|الأنعام|الأعراف|الأنفال|التوبة|يونس|هود|يوسف|الرعد|إبراهيم|الحجر|النحل|الإسراء|الكهف|مريم|طه|الأنبياء|الحج|المؤمنون|النور|الفرقان|الشعراء|النمل|القصص|العنكبوت|الروم|لقمان|السجدة|الأحزاب|سبأ|فاطر|يس|الصافات|ص|الزمر|غافر|فصلت|الشورى|الزخرف|الدخان|الجاثية|الأحقاف|محمد|الفتح|الحجرات|ق|الذاريات|الطور|النجم|القمر|الرحمن|الواقعة|الحديد|المجادلة|الحشر|الممتحنة|الصف|الجمعة|المنافقون|التغابن|الطلاق|التحريم|الملك|القلم|الحاقة|المعارج|نوح|الجن|المزمل|المدثر|القيامة|الإنسان|المرسلات|النبأ|النازعات|عبس|التكوير|الانفطار|المطففين|الانشقاق|البروج|الطارق|الأعلى|الغاشية|الفجر|البلد|الشمس|الليل|الضحى|الشرح|التين|العلق|القدر|البينة|الزلزلة|العاديات|القارعة|التكاثر|العصر|الهمزة|الفيل|قريش|الماعون|الكوثر|الكافرون|النصر|المسد|الإخلاص|الفلق|الناس".split('|');
const AYAS = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];
const SSTART = []; let TOTAL = 0;
AYAS.forEach((n, i) => { SSTART[i] = TOTAL; TOTAL += n; });
const SUR = new Int16Array(TOTAL);
AYAS.forEach((n, s) => { for (let a = 0; a < n; a++) SUR[SSTART[s] + a] = s; });
const W = new Float64Array(TOTAL).fill(604 / TOTAL);
let PAGES_OK = false, PG = null;
const MUSHAF_URL = 'https://qurancomplex.gov.sa/quran-hafs/';
/* أرقام الصفحات حسب مصحف المدينة النبوية من مجمع الملك فهد (604 صفحة) */
const pageOf = (s, a) => PG ? PG[SSTART[s] + a - 1] : null;
const pageTag = (s, a1, a2) => { const p1 = pageOf(s, a1), p2 = pageOf(s, a2); return p1 ? ` <span class="pg">ص ${p1 === p2 ? p1 : p1 + '–' + p2}</span>` : ''; };
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
    const { pages, lines } = await r.json(); if (!pages || pages.length !== TOTAL) return;
    PG = pages;
    if (lines && lines.length === TOTAL) for (let i = 0; i < TOTAL; i++) W[i] = lines[i] / 15; // الوجه 15 سطر
    else { const cnt = new Int16Array(606); pages.forEach(p => cnt[p]++); for (let i = 0; i < TOTAL; i++) W[i] = 1 / cnt[pages[i]]; }
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
function toast(msg) { const t = $('#toast'); t.textContent = FEM_MODE === 'ui' ? femUiTxt(msg) : FEM_MODE === 'noun' ? femMsg(msg) : msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, Math.max(3500, String(msg).length * 75)); }

/* ---------------- server ---------------- */
const COLS = ['users', 'halaqat', 'sessions', 'recs', 'joins', 'settings', 'anns', 'wirds', 'msgs', 'dms', 'behav', 'polls', 'rewards', 'orders', 'ptx'];
const S = {}; COLS.forEach(c => S[c] = {});
let READY = false, OFFLINE = false;
const ST = { meId: null, view: null, sid: null, uid: null, halqa: '', range: 30, reg: false, regDone: false, q: '', regInfo: null };

async function api(path, body) {
  const r = await fetch(path, body === undefined ? { cache: 'no-store' } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  let j = {}; try { j = await r.json(); } catch {}
  if (!r.ok) { const e = new Error(j.error || 'تعذّر الاتصال، حاول مرة ثانية'); e.status = r.status === 503 && r.headers.get('x-irtaq-cache') ? 0 : r.status; throw e; }
  return j;
}
let loading = null;
async function load() {
  if (loading) return loading;
  loading = (async () => {
    try {
      if (outbox().length && navigator.onLine) await flushOutbox();
      const r0 = await fetch('/api/data?side=' + SEC, { cache: 'no-store' });
      if (!r0.ok && r0.status !== 200) throw new Error('net');
      const d = await r0.json();
      // نسخة جديدة من الموقع انرفعت: حدّث الصفحة مرة وحدة تلقائيًا — بس مو وهو داخل الحصة أو يسجّل تسميع أو يكتب، نأجلها لين يطلع
      const busyNow = window.__inRoom || ST.fs || ST.rec || !$('#modal').hidden || (document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName));
      if (d.appV && MY_V && d.appV !== MY_V && !busyNow) { let done = ''; try { done = sessionStorage.getItem('irtaq-upd') || ''; } catch {} if (done !== d.appV) { try { sessionStorage.setItem('irtaq-upd', d.appV); } catch {} location.reload(); return; } }
      OFFLINE = r0.headers.get('x-irtaq-cache') === '1';
      ST.meId = d.me || null;
      if (d.me) COLS.forEach(c => S[c] = d[c] || {}); else COLS.forEach(c => S[c] = {});
      S.board = d.board || null; S.backups = d.backups || []; S.push = !!d.push; S.waOn = !!d.waOn; S.waFailed = d.waFailed || 0; S.videoOn = !!d.videoOn; S.aiOn = !!d.aiOn; S.videoAlt = d.videoAlt || {}; S.tins = d.tins || {}; S.bal = d.bal || {}; S.side = d.side || 'm'; S.isSuper = !!d.isSuper; S.dayEnd = d.dayEnd || {}; S.pray = d.pray || null; S.meets = d.meets || {};
      READY = true; if (location.hash === '#meet' && d.me) { ST.view = 'meet'; try { history.replaceState(null, '', location.pathname + location.search); } catch {} } checkTurn(); scheduleRender();
    } catch (e) { OFFLINE = true; if (!READY) { READY = true; } scheduleRender(); }
    finally { loading = null; }
  })();
  return loading;
}
async function act(t, payload, okMsg, again) {
  try {
    const r = await api('/api/act', { t, _side: SEC, ...(payload || {}) });
    if (okMsg) { const m = typeof okMsg === 'function' ? okMsg(r || {}) : okMsg; if (m) toast(m); }
    await load();
    return r || {};
  } catch (e) {
    if (!e.status && OUTBOX_T.includes(t)) { queueOffline(t, payload); return { offline: true }; }
    // المعلم حضّر قبل ما يسجّل وصوله: نسجّله تلقائيًا ونكمّل نفس الإجراء بدل رسالة الخطأ
    if (e.status === 403 && !again && t !== 'teacher.checkin' && /وصلت الجامع/.test(e.message || '') && (me() || {}).role === 'teacher') {
      toast('نسجّل وصولك للجامع أول…');
      return (await checkinFlow()) ? act(t, payload, okMsg, true) : null;
    }
    toast(e.message);
    if (e.status === 401) { await load(); }
    return null;
  }
}
const L = col => Object.entries(S[col]).map(([id, v]) => ({ ...v, id }));

/* ---------------- settings ---------------- */
const DEF = { center: 'حلقات ارتق', days: [0, 1, 2, 3, 4], grade: { ex: 0, vg: 2, gd: 4, alertsPer: 3 }, fields: [], tpl: { absent: '', excellent: '' } };
const SET = () => { const m = S.settings.main || {}; return { ...DEF, ...m, grade: { ...DEF.grade, ...(m.grade || {}) }, tpl: { ...DEF.tpl, ...(m.tpl || {}) }, fields: m.fields || [] }; };
const fillTpl = (t, v) => { const o = t.replace(/\{الطالب\}/g, v.student || '').replace(/\{الحلقة\}/g, v.halqa || '').replace(/\{التاريخ\}/g, v.date || ''); return v.fem ? femMsg(o) : o; };
/* ---- الحلقات النسائية: صيغة المؤنث ---- */
const FEM_L = '\u0621-\u0652';
const FEM_MSG = [['ابنكم', 'ابنتكم'], ['ولدكم', 'ابنتكم'], ['لابنكم', 'لابنتكم'], ['ابنك', 'ابنتك'], ['ولدك', 'ابنتك'], ['بارك الله فيه', 'بارك الله فيها'], ['زاده الله', 'زادها الله'], ['وزاده', 'وزادها'], ['زاده', 'زادها'], ['حفظه الله', 'حفظها الله'], ['وفقه الله', 'وفقها الله'], ['أعانه الله', 'أعانها الله'], ['المطلوب منه', 'المطلوب منها'], ['نسأل الله له', 'نسأل الله لها'],
  ['طالب جديد', 'طالبة جديدة'], ['معلم جديد', 'معلمة جديدة'], ['المشرفون الإداريون', 'المشرفات'], ['مشرف إداري', 'مشرفة'], ['مشرفين', 'مشرفات'], ['المشرفين', 'المشرفات'], ['معلم احتياط', 'معلمة احتياط'], ['طلاب جدد', 'طالبات جدد'], ['الطالب', 'الطالبة'], ['للطالب', 'للطالبة'], ['والطالب', 'والطالبة'], ['طالب', 'طالبة'], ['الطلاب', 'الطالبات'], ['للطلاب', 'للطالبات'], ['والطلاب', 'والطالبات'], ['طلاب', 'طالبات'], ['طلابي', 'طالباتي'], ['طلابك', 'طالباتك'],
  ['المعلمون', 'المعلمات'], ['المعلمين', 'المعلمات'], ['للمعلمين', 'للمعلمات'], ['معلمين', 'معلمات'], ['المعلم', 'المعلمة'], ['للمعلم', 'للمعلمة'], ['والمعلم', 'والمعلمة'], ['معلم', 'معلمة'], ['معلمك', 'معلمتك'], ['لمعلمك', 'لمعلمتك'], ['معلمه', 'معلمتها'],
  ['غاب', 'غابت'], ['حضر', 'حضرت'], ['انصرف', 'انصرفت'], ['حاضر', 'حاضرة'], ['غائب', 'غائبة'], ['متأخر', 'متأخرة'], ['مستأذن', 'مستأذنة'], ['منقطع', 'منقطعة'], ['متميز', 'متميزة'], ['متميّز', 'متميّزة'], ['مبدع', 'مبدعة'], ['مجتهد', 'مجتهدة'], ['متفوق', 'متفوقة'], ['بطل', 'بطلة'], ['سمّعوا', 'سمّعن'], ['حضروا', 'حضرن'], ['غابوا', 'غبن'], ['تحضّروا', 'تحضّرن'], ['محفوظه', 'محفوظها'], ['لم يُحضَّر', 'لم تُحضَّر'], ['تسميعه', 'تسميعها'], ['حفظه', 'حفظها'], ['خطته', 'خطتها'], ['رصيده', 'رصيدها'], ['ولي أمره', 'ولي أمرها'], ['عنه', 'عنها'], ['بطاقته', 'بطاقتها']];
const FEM_UI = [...FEM_MSG, ['أحسنت', 'أحسنتِ'], ['أنت', 'أنتِ'], ['احفظ', 'احفظي'], ['راجع', 'راجعي'], ['اكتب', 'اكتبي'], ['اختر', 'اختاري'], ['ابدأ', 'ابدئي'], ['سجّل', 'سجّلي'], ['أرسل', 'أرسلي'], ['ادخل', 'ادخلي'], ['انضم', 'انضمي'], ['اضغط', 'اضغطي'], ['جرّب', 'جرّبي'], ['شوف', 'شوفي'], ['تقدر', 'تقدرين'], ['تبي', 'تبين'], ['تحتاج', 'تحتاجين'], ['مستعد', 'مستعدة'], ['جاهز', 'جاهزة'], ['سمّع', 'سمّعي'], ['اسأل', 'اسألي'], ['تابع', 'تابعي'], ['حمّل', 'حمّلي'], ['افتح', 'افتحي'], ['ارجع', 'ارجعي'], ['خلّك', 'خلّيك'], ['تعال', 'تعالي'], ['ما حدد لك المعلم', 'ما حددت لكِ المعلمة'], ['جائزة له', 'جائزة لها'], ['ما راجع', 'ما راجعت'], ['عندك', 'عندكِ'], ['عليك', 'عليكِ'], ['لك', 'لكِ'], ['معك', 'معكِ']];
const femRx = pairs => { const m = Object.fromEntries(pairs); const rx = new RegExp('(^|[^' + FEM_L + '])(' + pairs.map(p => p[0]).sort((a, b) => b.length - a.length).join('|') + ')(?![' + FEM_L + '])', 'g'); return s => String(s).replace(rx, (_, p, w) => p + (m[w] || w)); };
const femMsg = femRx(FEM_MSG), femUiTxt = femRx(FEM_UI);
const femSt = st => !!st && (S.halaqat[st.halqaId] || {}).gender === 'f';
/* الأقسام: البنين والبنات منفصلين. المدير العام يتنقل بينهم، والباقي قسمهم بس */
let SEC = 'm'; try { SEC = localStorage.getItem('irtaq-sec') === 'f' ? 'f' : 'm'; } catch {}
const inGirls = () => S.side === 'f';
/** منسوبات قسم البنات (طالبة، معلمة، مشرفة): الكلام موجّه لها بصيغة المؤنث */
function femMe() { const u = me(); if (!u || S.isSuper || (LANG === 'en' && u.role === 'student')) return false; return inGirls(); }
/** ui: صيغة المؤنث للمستخدمة نفسها، noun: المدير العام في قسم البنات (أسماء وأفعال عن الطالبات بس) */
let FEM_MODE = '';
function femify(root) {
  if (!root || !FEM_MODE) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => { const p = n.parentElement; return !p || p.closest('textarea,script,style,[data-nofem],.verse,.ann-body,.ai-m,.tpl-prev,.wa-pv') || !/[\u0621-\u064A]/.test(n.nodeValue) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; } });
  const ns = []; while (w.nextNode()) ns.push(w.currentNode);
  const fn = FEM_MODE === 'ui' ? femUiTxt : femMsg;
  for (const n of ns) { const v = fn(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; }
}
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
const isAuto = st => planOf(st).mode === 'auto';
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
  const np = Math.max(0, Math.min(TOTAL, +a.newPos || 0)); const ms = Math.max(0, Math.min(np, +a.memStart || 0));
  // المحفوظ بعدد صفحات المصحف اللي يغطيها (أدق من جمع الأسطر لأن عناوين السور والبسملة تاخذ أسطر)
  let memPages = 0; if (PG) { const st = new Set(); for (let i = ms; i < np; i++) st.add(PG[ord[i]]); memPages = st.size; } else for (let i = ms; i < np; i++) memPages += W[ord[i]];
  const res = { memPages, done: np >= TOTAL, ms, np };
  if (np < TOTAL && +a.newAmt > 0) res.new = take(ord, np, TOTAL, +a.newAmt, true);
  if (np > ms && +a.revAmt > 0) { let rp = +a.revPos || 0; if (rp < ms || rp >= np) rp = ms; res.review = take(ord, rp, np, +a.revAmt, false); }
  if (np > ms && +a.tathAmt > 0) { const out = []; let w = 0, p = np; while (p > ms) { p--; out.unshift(ord[p]); w += W[ord[p]]; if (w >= +a.tathAmt - 1e-9) break; } res.tath = { list: out }; }
  return res;
}
function rangeSegs(s1, a1, s2, a2) {
  s1 = +s1; s2 = +s2 || s1;
  if (s2 === s1) return [{ s: s1 - 1, a1: +a1 || 1, a2: +a2 || AYAS[s1 - 1] }];
  const out = []; const step = s2 > s1 ? 1 : -1;
  for (let x = s1; ; x += step) { const last = x === s2; out.push({ s: x - 1, a1: x === s1 ? (+a1 || 1) : 1, a2: last ? (+a2 || AYAS[x - 1]) : AYAS[x - 1] }); if (last) break; }
  return out;
}
function planSegs(st) {
  const out = {};
  if (isAuto(st)) {
    const inf = autoInfo(st);
    ['new', 'review', 'tath'].forEach(k => { if (inf[k]) out[k] = segs(inf[k].list); });
    out._info = inf;
  } else {
    const m = planOf(st).manual || {};
    ['new', 'review', 'tath'].forEach(k => { const x = m[k]; if (x && +x.surah) out[k] = rangeSegs(x.surah, x.from, x.toSurah || x.surah, x.to); });
    const near = +(planOf(st).near || 0);
    if (near > 0 && !out.tath && st.id) {
      // التثبيت القريب: آخر ما حفظه الطالب ونجح فيه
      const list = []; let w = 0;
      for (const r of recsOf(st.id).filter(r => r.type === 'new' && r.pass)) {
        for (let a = r.to; a >= r.from && w < near - 1e-9; a--) { const g = SSTART[r.surah - 1] + a - 1; if (!list.includes(g)) { list.push(g); w += W[g]; } }
        if (w >= near - 1e-9) break;
      }
      if (list.length) out.tath = segs(list.sort((a, b) => a - b));
    }
  }
  return out;
}
const segText = arr => arr.map(x => `<span class="por">${esc(SN[x.s])} <b>﴿${x.a1 === x.a2 ? x.a1 : x.a1 + '–' + x.a2}﴾</b>${pageTag(x.s, x.a1, x.a2)}</span>`).join('، ');
function fmtAmt(n) { n = +n; const m = { 0.125: 'ثمن وجه', 0.25: 'ربع وجه', 0.5: 'نصف وجه', 0.75: 'ثلاثة أرباع وجه', 1: 'وجه', 2: 'وجهان' }; return m[n] || (n + ' أوجه'); }
/* الوجه 15 سطر: ربع وجه ≈ 4 أسطر، نصف وجه 7.5 سطر */
const linesOf = segsArr => segsArr.reduce((t, x) => { for (let a = x.a1; a <= x.a2; a++) t += W[SSTART[x.s] + a - 1] * 15; return t; }, 0);
const fmtLines = n => { const r = Math.round(n * 2) / 2; return r <= 0 ? '' : (r === 1 ? 'سطر' : r === 2 ? 'سطرين' : String(r).replace('.5', '½') + (r <= 10 ? ' أسطر' : ' سطر')); };
const amtLines = n => fmtLines(+n * 15);
function posText(dir, np) { if (np >= TOTAL) return 'أتمّ'; const g = ORD[dir].ord[np]; const s = SUR[g]; return SN[s] + ' آية ' + (g - SSTART[s] + 1); }

/* ---------------- state helpers ---------------- */
const me = () => { const u = ST.meId && S.users[ST.meId]; return u ? { ...u, id: ST.meId } : null; };
const myHalaqat = u => L('halaqat').filter(h => (u.role === 'admin' && (!ST.branch || h.branch === ST.branch)) || (u.role !== 'admin' && (h.teacherId === u.id || h.sub))).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
const halqaName = id => (S.halaqat[id] && S.halaqat[id].name) || '—';
const studentsOf = hid => L('users').filter(u => u.role === 'student' && u.status === 'active' && u.halqaId === hid).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
const canPlan = u => u.role === 'admin' || (u.role === 'teacher' && !!u.canPlan);
const canAutoU = u => u.role === 'admin' || (u.role === 'teacher' && !!u.canPlan);
const halqaDays = hid => { const h = S.halaqat[hid]; return (h && h.days && h.days.length) ? h.days : SET().days; };
const recsOf = uid => L('recs').filter(r => r.uid === uid).sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.at || 0) - (a.at || 0));
function rangeFrom(days) { if (typeof days === 'string' && days[0] === 'T') { const tm = (SET().terms || []).find(x => 'T' + x.id === days); return tm ? tm.from : ''; } return days ? addDays(today(), -days) : ''; }
function attStats(st, days) {
  const from = rangeFrom(days);
  const ss = L('sessions').filter(s => s.halqaId === st.halqaId && !s.cancelled && s.date <= today() && (!from || s.date >= from));
  const c = { p: 0, l: 0, a: 0, e: 0, n: 0, total: ss.length };
  ss.forEach(s => { const v = (s.att || {})[st.id]; if (v) c[v]++; else c.n++; });
  const marked = c.p + c.l + c.a + c.e; c.rate = marked ? Math.round((c.p + c.l) / marked * 100) : null;
  return c;
}

const effLink = s => (s && (S.videoOn ? '#room' : (s.link || (S.halaqat[s.halqaId] || {}).link))) || '';
const lessonTs = s => new Date(s.date + 'T' + (s.time || '00:00')).getTime();
function recPages(r) { let w = 0; const a = SSTART[r.surah - 1]; for (let i = r.from; i <= r.to; i++) w += W[a + i - 1] || 0; return w; }
const fmtPages = n => { const q = Math.round(n * 4) / 4; return q ? String(q) : '0'; };
function pagesSum(rs) { const o = { new: 0, review: 0, tath: 0 }; rs.forEach(r => { if (r.pass !== false) o[r.type] = (o[r.type] || 0) + recPages(r); }); return o; }
const absentLimit = () => +(SET().absentAlert || 3);
function absentStreak(st) {
  const ss = L('sessions').filter(s => s.halqaId === st.halqaId && !s.cancelled && s.date <= today()).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  let n = 0; for (const s of ss) { const v = (s.att || {})[st.id]; if (!v) continue; if (v === 'a') n++; else break; } return n;
}
function retriesOf(st) {
  const rs = recsOf(st.id); const since = addDays(today(), -21); const out = [];
  rs.filter(r => r.pass === false && r.date >= since).forEach(r => {
    const fixed = rs.some(x => x.pass !== false && x.type === r.type && x.surah === r.surah && x.from <= r.from && x.to >= r.to && (x.date > r.date || (x.date === r.date && (x.at || 0) > (r.at || 0))));
    if (!fixed && !out.some(o => o.surah === r.surah && o.from === r.from && o.to === r.to && o.type === r.type)) out.push(r);
  });
  return out;
}
const isHolidayC = date => (SET().holidays || []).some(h => date >= h.from && date <= h.to);
function cdText(ts) {
  const d = ts - Date.now();
  if (d > 0) { const s = Math.floor(d / 1000); const dd = Math.floor(s / 86400); const hh = Math.floor(s % 86400 / 3600); const mm = Math.floor(s % 3600 / 60); const ss = s % 60;
    return 'تبدأ بعد ' + (dd ? dd + ' يوم و' : '') + (hh ? hh + ':' + pad(mm) + ':' + pad(ss) : mm + ':' + pad(ss)); }
  if (d > -3 * 3600000) return 'بدأت قبل ' + Math.max(1, Math.round(-d / 60000)) + ' دقيقة';
  return '';
}

/* ---------------- phase 2: shared ---------------- */
const VERSES = [
  ["إِنَّ هَٰذَا الْقُرْآنَ يَهْدِي لِلَّتِي هِيَ أَقْوَمُ", "الإسراء ٩"], ["وَقُل رَّبِّ زِدْنِي عِلْمًا", "طه ١١٤"],
  ["وَلَقَدْ يَسَّرْنَا الْقُرْآنَ لِلذِّكْرِ فَهَلْ مِن مُّدَّكِرٍ", "القمر ١٧"], ["إِنَّ اللَّهَ لَا يُغَيِّرُ مَا بِقَوْمٍ حَتَّىٰ يُغَيِّرُوا مَا بِأَنفُسِهِمْ", "الرعد ١١"],
  ["فَاذْكُرُونِي أَذْكُرْكُمْ وَاشْكُرُوا لِي وَلَا تَكْفُرُونِ", "البقرة ١٥٢"], ["وَتَعَاوَنُوا عَلَى الْبِرِّ وَالتَّقْوَىٰ", "المائدة ٢"],
  ["إِنَّ مَعَ الْعُسْرِ يُسْرًا", "الشرح ٦"], ["وَمَن يَتَّقِ اللَّهَ يَجْعَل لَّهُ مَخْرَجًا", "الطلاق ٢"],
  ["وَقُولُوا لِلنَّاسِ حُسْنًا", "البقرة ٨٣"], ["أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ", "الرعد ٢٨"],
  ["وَاصْبِرْ وَمَا صَبْرُكَ إِلَّا بِاللَّهِ", "النحل ١٢٧"], ["يَرْفَعِ اللَّهُ الَّذِينَ آمَنُوا مِنكُمْ وَالَّذِينَ أُوتُوا الْعِلْمَ دَرَجَاتٍ", "المجادلة ١١"],
  ["وَبِالْوَالِدَيْنِ إِحْسَانًا", "الإسراء ٢٣"], ["وَأَن لَّيْسَ لِلْإِنسَانِ إِلَّا مَا سَعَىٰ", "النجم ٣٩"],
  ["وَالَّذِينَ جَاهَدُوا فِينَا لَنَهْدِيَنَّهُمْ سُبُلَنَا", "العنكبوت ٦٩"], ["إِنَّ اللَّهَ مَعَ الصَّابِرِينَ", "البقرة ١٥٣"],
  ["وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا", "المزمل ٤"], ["وَمَا تُقَدِّمُوا لِأَنفُسِكُم مِّنْ خَيْرٍ تَجِدُوهُ عِندَ اللَّهِ", "البقرة ١١٠"],
  ["إِنَّمَا الْمُؤْمِنُونَ إِخْوَةٌ", "الحجرات ١٠"], ["وَسَارِعُوا إِلَىٰ مَغْفِرَةٍ مِّن رَّبِّكُمْ", "آل عمران ١٣٣"],
  ["فَإِذَا عَزَمْتَ فَتَوَكَّلْ عَلَى اللَّهِ", "آل عمران ١٥٩"], ["لَئِن شَكَرْتُمْ لَأَزِيدَنَّكُمْ", "إبراهيم ٧"],
  ["وَإِنَّكَ لَعَلَىٰ خُلُقٍ عَظِيمٍ", "القلم ٤"], ["ادْعُونِي أَسْتَجِبْ لَكُمْ", "غافر ٦٠"],
  ["وَلَا تَيْأَسُوا مِن رَّوْحِ اللَّهِ", "يوسف ٨٧"], ["وَاعْتَصِمُوا بِحَبْلِ اللَّهِ جَمِيعًا وَلَا تَفَرَّقُوا", "آل عمران ١٠٣"],
  ["إِنَّ الْحَسَنَاتِ يُذْهِبْنَ السَّيِّئَاتِ", "هود ١١٤"], ["وَاللَّهُ يُحِبُّ الْمُحْسِنِينَ", "آل عمران ١٣٤"],
  ["فَاسْتَبِقُوا الْخَيْرَاتِ", "البقرة ١٤٨"], ["وَقُل رَّبِّ ارْحَمْهُمَا كَمَا رَبَّيَانِي صَغِيرًا", "الإسراء ٢٤"],
];
function verseOfDay(ds) { const [y, m, d] = ds.split('-').map(Number); const n = Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 864e5); return VERSES[n % VERSES.length]; }
let HFMT = null; try { HFMT = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'long' }); } catch {}
const hijri = ds => { try { return HFMT ? HFMT.format(new Date(ds + 'T12:00:00')).replace(/\s*هـ$/, '') : ''; } catch { return ''; } };
const fmtDateH = ds => { const h = hijri(ds); return fmtDate(ds) + (h ? ' · ' + h : ''); };
const weekStartC = ds => { const d = new Date(ds + 'T00:00'); d.setDate(d.getDate() - d.getDay()); return isoDate(d); };
const isPaused = st => { const p = (st.plan || {}).paused; const t = today(); return !!(p && p.from && p.from <= t && (!p.to || t <= p.to)); };
const itemLabel = x => `${TYPE[x.type]} ${SN[x.surah - 1]} ${x.from === x.to ? x.from : x.from + '-' + x.to}`;

/* النقاط: نفس قواعد الخادم */
function ptsOf(st, from, to) {
  const P = SET().points || {}; let n = 0;
  L('sessions').forEach(s => { if (s.halqaId !== st.halqaId || s.cancelled || s.date < from || s.date > to) return; const v = (s.att || {})[st.id]; if (v === 'p') n += +P.present || 0; else if (v === 'l') n += +P.late || 0; });
  n += streakBonus(st, from, to);
  L('recs').forEach(r => { if (r.uid !== st.id || r.date < from || r.date > to) return; n += r.grade === 'ممتاز' ? +P.ex || 0 : r.grade === 'جيد جدًا' ? +P.vg || 0 : r.grade === 'جيد' ? +P.gd || 0 : 0; if (r.type === 'new' && r.pass) n += recPages(r) * (+P.page || 0); });
  return Math.round(n);
}
/* مكافأة سلسلة الحضور خلال فترة: كل 10 حصص متتالية، وكل 30 مكافأة أكبر (نفس حساب الخادم) */
function streakBonus(st, from, to) {
  const P = SET().points || {}; const s10 = +(P.streak10 ?? 5) || 0, s30 = +(P.streak30 ?? 15) || 0; if (!s10 && !s30) return 0;
  const ss = L('sessions').filter(s => s.halqaId === st.halqaId && !s.cancelled && s.date <= to).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  let run = 0, n = 0; for (const s of ss) { const v = (s.att || {})[st.id]; if (!v || v === 'e') continue; if (v === 'a') { run = 0; continue; } run++; if (from && s.date < from) continue; if (run % 10 === 0) n += s10; if (run % 30 === 0) n += s30; }
  return n;
}
/** الهدف الجاي في السلسلة */
function streakNext(n) { const P = SET().points || {}; const s10 = +(P.streak10 ?? 5) || 0, s30 = +(P.streak30 ?? 15) || 0; const nx = (Math.floor(n / 10) + 1) * 10; const pts = s10 + (nx % 30 === 0 ? s30 : 0); return pts ? { at: nx, left: nx - n, pts } : null; }
/* سلسلة الحضور: حصص متتالية حضرها (المستأذن ما يكسرها) */
function attendStreak(st) {
  const ss = L('sessions').filter(s => s.halqaId === st.halqaId && !s.cancelled && s.date <= today()).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  let n = 0; for (const s of ss) { const v = (s.att || {})[st.id]; if (!v || v === 'e') continue; if (v === 'a') break; n++; } return n;
}
function badgesOf(st) {
  const rs = recsOf(st.id).slice().reverse(); const out = [];
  const streak = attendStreak(st);
  [[20, 'التزام ذهبي', '20 حصة متتالية'], [10, 'التزام فضي', '10 حصص متتالية'], [5, 'ملتزم', '5 حصص متتالية']].some(([n, t, d]) => streak >= n && out.push({ t, d }));
  let run = 0, best = 0; rs.forEach(r => { if (r.grade === 'ممتاز') { run++; best = Math.max(best, run); } else run = 0; });
  if (best >= 10) out.push({ t: 'متقن', d: '10 تسميعات ممتازة متتالية' }); else if (best >= 5) out.push({ t: 'مجتهد', d: '5 تسميعات ممتازة متتالية' });
  const newPages = rs.filter(r => r.type === 'new' && r.pass).reduce((x, r) => x + recPages(r), 0);
  [[300, '300 وجه'], [100, '100 وجه'], [50, '50 وجه'], [10, '10 أوجه']].some(([n, t]) => newPages >= n && out.push({ t: 'حفظ ' + t, d: 'حفظ ' + t + ' في المنصة' }));
  const month = L('sessions').filter(s => s.halqaId === st.halqaId && !s.cancelled && s.date <= today() && s.date >= addDays(today(), -30));
  if (month.length >= 4 && month.every(s => (s.att || {})[st.id] && (s.att || {})[st.id] !== 'a')) out.push({ t: 'شهر بلا غياب', d: 'ما غاب آخر 30 يوم' });
  const fulls = new Set(rs.filter(r => r.full && r.pass).map(r => r.surah)); if (fulls.size) out.push({ t: 'سورة كاملة', d: 'سمّع ' + fulls.size + ' ' + (fulls.size === 1 ? 'سورة' : 'سور') + ' كاملة بمجلس' });
  return out;
}
function goalProgress(st) {
  const g = st.goal; if (!g || !g.pages) return null;
  const done = recsOf(st.id).filter(r => r.type === 'new' && r.pass && r.date >= g.from).reduce((x, r) => x + recPages(r), 0);
  return { ...g, done, pct: Math.min(100, Math.round(done / g.pages * 100)) };
}
const goalHtml = st => { const g = goalProgress(st); if (!g) return ''; return `<div class="goal"><div class="row" style="justify-content:space-between"><b>الهدف: ${fmtPages(g.pages)} وجه حفظ${g.by ? ' قبل ' + fmtDate(g.by) : ''}</b><span class="num">${fmtPages(g.done)} / ${fmtPages(g.pages)}</span></div><div class="bar-track"><div class="bar-fill" style="width:${g.pct}%"></div></div>${g.note ? `<div class="small muted">${esc(g.note)}</div>` : ''}</div>`; };
const wirdOf = (uid, ds) => S.wirds && S.wirds[uid + '_' + ds];
/* عدّاد التكرار: الطالب يعدّ كم مرة كرر المقطع في البيت، وينحفظ مع ورد اليوم */
const repsOf = (w, k) => +(((w && w.items) || []).find(x => x.k === k) || {}).n || 0;
let REP_T = 0;
function repBump(k, d) {
  const u = me(); if (!u) return; const t = today(); const key = u.id + '_' + t;
  const w = S.wirds[key] = { uid: u.id, date: t, items: [], read: 0, note: '', ...(S.wirds[key] || {}) };
  const groups = planGroups(u).map(g => groupKey(g));
  const f = document.querySelector('form[data-form=wird]'); const fd = f ? new FormData(f) : null; const doneNow = fd ? new Set(fd.getAll('it')) : null;
  const old = w.items || []; const items = groups.map(g => { const o = old.find(x => x.k === g) || {}; return { k: g, done: doneNow ? doneNow.has(g) : !!o.done, n: +o.n || 0 }; });
  const it = items.find(x => x.k === k); if (!it) return; it.n = Math.max(0, Math.min(9999, it.n + d));
  w.items = items; if (fd) { w.read = +fd.get('read') || w.read || 0; w.note = fd.get('note') ?? w.note; }
  document.querySelectorAll('.rep').forEach(el => { if (el.dataset.k !== k) return; el.querySelector('.rep-n').textContent = it.n; el.querySelector('.rep-m').disabled = !it.n; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); });
  if (d > 0) buzz(8);
  clearTimeout(REP_T); REP_T = setTimeout(() => api('/api/act', { t: 'wird.save', date: t, items: w.items, read: w.read || 0, note: w.note || '' }).catch(() => toast('ما انحفظ العدّاد، تأكد من النت')), 1200);
}
/** مجموع التكرار في آخر ورد (اليوم أو أمس) للمعلم */
function repsBrief(uid) { for (const [d, lbl] of [[today(), 'اليوم'], [addDays(today(), -1), 'أمس']]) { const w = wirdOf(uid, d); const n = ((w && w.items) || []).reduce((a, x) => a + (+x.n || 0), 0); if (n) return `🔁 كرر ${n} مرة ${lbl}`; } return ''; }
function wirdBrief(uid) {
  const w = wirdOf(uid, today()); if (!w) return '';
  const done = (w.items || []).filter(x => x.done).length; const all = (w.items || []).length;
  const reps = (w.items || []).reduce((a, x) => a + (+x.n || 0), 0);
  return `<span class="chip ok">في البيت: ${done}/${all}${w.read ? ' · تلاوة ' + w.read + ' وجه' : ''}${reps ? ' · 🔁 ' + reps : ''}</span>`;
}
const annTargets = a => L('users').filter(x => x.role === 'student' && x.status === 'active' && (!a.halqaId || x.halqaId === a.halqaId));
const allTpls = () => { const st = SET(); return [{ id: 'absent', name: 'غياب', text: st.tpl.absent }, { id: 'excellent', name: 'تميّز', text: st.tpl.excellent }, ...(st.tpls || [])].filter(t => t.text); };

/* ---------------- render loop ---------------- */
let rq = 0;
function scheduleRender() { if (rq) return; rq = requestAnimationFrame(() => { rq = 0; render(); }); }
function render() {
  if (DRAG.on) { DRAG.pending = true; return; }
  const app = $('#app'); const saved = {};
  app.querySelectorAll('[data-dirty][id]').forEach(el => { if (el.id.startsWith('rk-')) return; saved[el.id] = (el.type === 'checkbox' || el.type === 'radio') ? { c: el.checked } : { v: el.value }; });
  const a = document.activeElement; const fid = app.contains(a) ? a.id : null; let sel = null;
  try { if (fid && a.selectionStart != null) sel = [a.selectionStart, a.selectionEnd]; } catch {}
  const sy = window.scrollY;
  const regF = !me() && (ST.reg || isRegRoute()) && (ST.regInfo || {}).side === 'f';
  FEM_MODE = READY && me() ? (inGirls() ? (femMe() ? 'ui' : 'noun') : '') : regF ? 'ui' : '';
  const fem = !!FEM_MODE; if (fem !== document.documentElement.hasAttribute('data-fem')) { document.documentElement.toggleAttribute('data-fem', fem); const tc = document.querySelector('meta[name=theme-color]'); if (tc) tc.setAttribute('content', fem ? '#a23c6b' : '#1c6a5a'); }
  app.innerHTML = view(); applyZoom(); if (fem) femify(app);
  for (const id in saved) { const el = document.getElementById(id); if (!el || !app.contains(el)) continue; el.dataset.dirty = 1; if ('c' in saved[id]) el.checked = saved[id].c; else el.value = saved[id].v; }
  if (fid) { const el = document.getElementById(fid); if (el) { el.focus({ preventScroll: true }); try { if (sel) el.setSelectionRange(sel[0], sel[1]); } catch {} } }
  window.scrollTo(0, sy);
}
function clean() { $('#app').querySelectorAll('[data-dirty]').forEach(el => delete el.dataset.dirty); }
function go(v, extra) { clean(); Object.assign(ST, { view: v }, extra || {}); render(); window.scrollTo(0, 0); }
document.addEventListener('input', e => { if (e.target.id) e.target.dataset.dirty = 1; }, true);
document.addEventListener('change', e => { if (e.target.id) e.target.dataset.dirty = 1; }, true);

const FLOWER = `<svg class="flower" viewBox="0 0 24 24" aria-hidden="true"><g fill="currentColor"><circle cx="12" cy="6.6" r="3.4"/><circle cx="17.1" cy="10.3" r="3.4"/><circle cx="15.2" cy="16.3" r="3.4"/><circle cx="8.8" cy="16.3" r="3.4"/><circle cx="6.9" cy="10.3" r="3.4"/></g><circle cx="12" cy="12" r="2.6" fill="var(--surface)"/></svg>`;
const MARK = `<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="4" y="4" width="40" height="40" rx="10" fill="var(--accent)"/><path d="M14 16c4-2 7-2 10 1 3-3 6-3 10-1v17c-4-2-7-2-10 1-3-3-6-3-10-1z" fill="none" stroke="var(--accent-ink)" stroke-width="2.4" stroke-linejoin="round"/><path d="M24 17v17" stroke="var(--accent-ink)" stroke-width="2.4"/></svg>`;

/* ---------------- views ---------------- */
function joinHid() { const p = new URLSearchParams(location.search); const h = location.hash.replace('#', ''); return p.get('join') || (h.startsWith('join-') ? h.slice(5) : ''); }
function isRegRoute() { const h = location.hash.replace('#', ''); return h === 'register' || h === 'register-f' || !!joinHid() || location.pathname === '/register'; }
const regSideQ = () => { const j = joinHid(); return j ? '?join=' + encodeURIComponent(j) : location.hash === '#register-f' || new URLSearchParams(location.search).get('side') === 'f' ? '?side=f' : ''; };
function view() {
  if (!READY) return `<div class="center-box"><div class="row"><div class="spin"></div><span class="muted">جاري التحميل…</span></div></div>`;
  if (ST.regDone) return regDoneV();
  const u = me();
  if (!u && (ST.reg || isRegRoute())) return regV(joinHid());
  if (!u) return loginV();
  return shellV(u);
}
const banner = () => { const n = outbox().length; return OFFLINE || n ? `<div class="banner">${OFFLINE ? 'ما فيه اتصال، تعرض آخر نسخة محفوظة.' : ''}${n ? ` ${n} تعديل محفوظ على جوالك وبيترسل لحاله لما يرجع النت.` : ' التحضير والتسميع ينحفظ على الجوال لين يرجع النت.'}</div>` : ''; };
function fieldHtml(f, val, pre, opt = {}) {
  const t = f.type || 'text'; const req = opt.forceReq ?? f.req; const lab = `${esc(f.label)}${req ? ' <i>*</i>' : ''}`;
  if (t === 'choice') {
    const opts = f.options || []; const cur = String(val || '').split('،').map(x => x.trim());
    if (f.multi) return `<div class="fld fld-wide"><span>${lab} <span class="hint">(تقدر تختار أكثر من خيار)</span></span><div class="days">${opts.map((o, i) => `<label><input type="checkbox" id="${pre}${f.k}-${i}" name="${f.k}" value="${esc(o)}" ${cur.includes(o) ? 'checked' : ''}> ${esc(o)}</label>`).join('')}</div></div>`;
    return `<label class="fld"><span>${lab}</span><select id="${pre}${f.k}" name="${f.k}" ${req ? 'required' : ''}><option value="">اختر…</option>${opts.map(o => `<option ${cur[0] === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
  }
  if (t === 'memo') {
    const m = /^(\d+):(\d+)>(\d+):(\d+)$/.exec(val || ''); const none = val === 'none';
    const [fs, fa, ts, ta] = m ? m.slice(1).map(Number) : [114, 1, '', ''];
    return `<div class="fld fld-wide memo-fld"><span>${lab}</span>
      <label class="check small"><input type="checkbox" id="${pre}${f.k}-none" name="${f.k}__none" data-change="memo-none" ${none ? 'checked' : ''}> ما يحفظ شيء بعد</label>
      <div class="memo-rows" ${none ? 'hidden' : ''}><div class="pos-row"><select id="${pre}${f.k}-fs" name="${f.k}__fs" aria-label="من سورة">${surahOptions(fs)}</select><input id="${pre}${f.k}-fa" name="${f.k}__fa" type="number" min="1" inputmode="numeric" value="${fa}" aria-label="من آية" placeholder="آية"></div>
      <div class="small muted">إلى</div><div class="pos-row"><select id="${pre}${f.k}-ts" name="${f.k}__ts" aria-label="إلى سورة">${surahOptions(ts)}</select><input id="${pre}${f.k}-ta" name="${f.k}__ta" type="number" min="1" inputmode="numeric" value="${ta}" aria-label="إلى آية" placeholder="آية"></div>
      <span class="hint">مثال: من الناس آية 1 إلى الملك آية 13. تقدر تتركه فاضي ويحدده المعلم.</span></div></div>`;
  }
  return `<label class="fld"><span>${lab}</span><input id="${pre}${f.k}" name="${f.k}" type="${t}" ${t === 'tel' ? 'inputmode="tel" dir="ltr"' : ''} ${t === 'number' ? 'inputmode="numeric" min="0"' : ''} value="${esc(val ?? '')}" placeholder="${esc(f.ph || '')}" ${req ? 'required' : ''}></label>`;
}
/* قراءة قيم الحقول من النموذج حسب نوعها */
function collectInfo(d, fields) {
  const info = {};
  for (const x of fields) {
    if (x.type === 'choice' && x.multi) info[x.k] = d.getAll(x.k).join('، ');
    else if (x.type === 'memo') {
      if (d.get(x.k + '__none')) { info[x.k] = 'none'; continue; }
      const fs = +d.get(x.k + '__fs'), fa = +d.get(x.k + '__fa'), ts = +d.get(x.k + '__ts'), ta = +d.get(x.k + '__ta');
      if (!ts) { info[x.k] = ''; continue; }
      if (!fs || !fa || !ta || fa > AYAS[fs - 1] || ta > AYAS[ts - 1]) return { _err: 'تأكد من سور وآيات «' + x.label + '»' };
      info[x.k] = `${fs}:${fa}>${ts}:${ta}`;
    } else info[x.k] = (d.get(x.k) || '').trim();
    if (x.req && !info[x.k]) return { _err: 'الحقل مطلوب: ' + x.label };
  }
  return info;
}
/* عرض قيمة حقل */
function fmtField(f, v) {
  if (f.type === 'memo') { if (v === 'none') return 'ما يحفظ بعد'; const m = /^(\d+):(\d+)>(\d+):(\d+)$/.exec(v || ''); return m ? `من ${SN[m[1] - 1]} ${m[2]} إلى ${SN[m[3] - 1]} ${m[4]}` : esc(v); }
  return esc(v);
}
const FTYPE = { text: 'نص', tel: 'جوال', number: 'رقم', choice: 'اختيار من متعدد', memo: 'مقدار الحفظ' };

function loginV() {
  if (!ST.regInfo) loadRegInfo();
  return `${banner()}<div class="center-box">
  <div class="hero-mark">${MARK}<div><h1>${esc(SET().center !== DEF.center ? SET().center : 'حلقات ارتق')}</h1><div class="muted">تسميع، مراجعة، وتثبيت عن بُعد</div></div></div>
  <form class="card" data-form="login">
    <label class="fld"><span>اسم المستخدم</span><input id="lg-user" name="username" dir="ltr" autocomplete="username" autocapitalize="none" required value="${esc((() => { try { return new URLSearchParams(location.search).get('u') || ''; } catch { return ''; } })())}"></label>
    ${pwField('lg-pw', 'password', 'كلمة المرور', 'current-password')}
    <button class="btn pri big" type="submit">دخول</button>
    <div class="row" style="justify-content:space-between"><span class="small muted">ولي الأمر يدخل بحساب ابنه.</span><button type="button" class="linkbtn" data-act="forgot">نسيت كلمة المرور؟</button></div>
  </form>
  ${accounts().length ? `<div class="card" style="display:grid;gap:8px"><b>حسابات محفوظة على هذا الجهاز</b><div class="list">${accounts().map(a => `<div class="item"><div class="grow">${esc(a.name)}</div><button class="btn pri sm" data-act="switch" data-id="${a.id}">دخول</button></div>`).join('')}</div></div>` : ''}
  <div class="card guide-box"><b>أول مرة؟</b><ol class="steps"><li>اضغط «سجّل بياناتك» تحت، وعبّ النموذج.</li><li>انتظر اعتماد الإدارة، وغالبًا يكون خلال يوم.</li><li>ارجع هنا وادخل باسم المستخدم وكلمة المرور اللي اخترتها.</li></ol>
    <div class="row" style="justify-content:center"><button class="btn pri" data-act="to-reg">سجّل بياناتك</button></div></div>
  </div>`;
}
function regV(hid) {
  const info = ST.regInfo;
  if (!info) { loadRegInfo(); return `<div class="center-box"><div class="row"><div class="spin"></div><span class="muted">جاري تحميل نموذج التسجيل…</span></div></div>`; }
  const hs = info.halaqat || []; const fixedH = hid && hs.find(h => h.id === hid);
  return `${banner()}<div class="center-box" style="max-width:560px">
  <div class="hero-mark">${MARK}<div><h1>تسجيل طالب جديد</h1><div class="muted">${esc(info.center)}${fixedH ? ' · ' + esc(fixedH.name) : ''}</div></div></div>
  <ol class="stepper"><li class="on"><b>1</b><span>عبّ البيانات</span></li><li><b>2</b><span>اعتماد الإدارة</span></li><li><b>3</b><span>ادخل للموقع</span></li></ol>
  <form class="card" data-form="register" data-hid="${esc(fixedH ? hid : '')}">
    <label class="fld"><span>اسم الطالب الكامل <i>*</i></span><input id="rg-name" name="name" required autocomplete="name" placeholder="مثال: عبدالله محمد العتيبي"></label>
    <div class="fgrid">
      <label class="fld"><span>اسم المستخدم <i>*</i></span><input id="rg-username" name="username" dir="ltr" required autocapitalize="none" autocorrect="off" spellcheck="false" pattern="[A-Za-z0-9_.]{3,30}" title="حروف إنجليزية أو أرقام، 3 أحرف على الأقل" placeholder="abdullah2015"><span class="hint">حروف إنجليزية وأرقام بدون مسافات، مثل اسم الطالب وسنة ميلاده.</span></label>
      ${pwField('rg-password', 'password', 'كلمة المرور <i>*</i>', 'new-password', 'minlength="4"')}
    </div>
    <div class="fgrid">${info.fields.filter(f => f.type !== 'memo').map(f => fieldHtml(f, '', 'rg-')).join('')}</div>
    ${info.fields.filter(f => f.type === 'memo').map(f => fieldHtml(f, '', 'rg-')).join('')}
    ${!fixedH && hs.length ? `<label class="fld"><span>الحلقة المطلوبة</span><select id="rg-halqa" name="reqHalqa"><option value="">تحددها الإدارة</option>${(() => { const bs = [...new Set(hs.map(h => h.branch || ''))]; return bs.length > 1 ? bs.map(b => `<optgroup label="${esc(b || 'أخرى')}">${hs.filter(h => (h.branch || '') === b).map(h => `<option value="${h.id}">${esc(h.name)}</option>`).join('')}</optgroup>`).join('') : hs.map(h => `<option value="${h.id}">${esc(h.name)}</option>`).join(''); })()}</select></label>` : ''}
    <button class="btn pri big" type="submit">إرسال الطلب</button>
    <div class="small muted">بعد الإرسال تراجع الإدارة طلبك وتعتمده، وبعدها تدخل باسم المستخدم وكلمة المرور.</div>
  </form>
  <button class="btn ghost" data-act="from-reg">رجوع لتسجيل الدخول</button></div>`;
}
let regLoading = false;
async function loadRegInfo() {
  if (regLoading) return; regLoading = true;
  try { ST.regInfo = await api('/api/register' + regSideQ()); } catch (e) { ST.regInfo = { center: 'حلقات ارتق', fields: [], halaqat: [] }; toast(e.message); }
  regLoading = false; scheduleRender();
}
function regDoneV() {
  const c = ST.regCred || {}; const msg = `بيانات دخول ${c.name || ''} في ${(ST.regInfo || {}).center || 'الحلقة'}:\nالرابط: ${location.origin}\nاسم المستخدم: ${c.user || ''}\nكلمة المرور: ${c.pw || ''}`;
  return `<div class="center-box"><ol class="stepper"><li class="done"><b>1</b><span>عبّ البيانات</span></li><li class="on"><b>2</b><span>اعتماد الإدارة</span></li><li><b>3</b><span>ادخل للموقع</span></li></ol>
  <div class="hero-mark">${MARK}<h1>وصل طلبك</h1></div>
  <div class="card" style="display:grid;gap:10px"><div>طلبك الآن عند الإدارة. بعد الاعتماد تدخل بهذي البيانات:</div>
    <dl class="kv"><dt>اسم المستخدم</dt><dd dir="ltr" style="text-align:right"><b>${esc(c.user || '')}</b></dd><dt>كلمة المرور</dt><dd dir="ltr" style="text-align:right"><b>${esc(c.pw || '')}</b></dd></dl>
    <div class="row"><button class="btn" data-act="copy" data-text="${esc(msg)}">نسخ البيانات</button><a class="btn wa" href="https://wa.me/?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">أرسلها لنفسك بالواتساب</a></div>
    ${supportBtn()}</div>
  <button class="btn" data-act="from-reg">صفحة الدخول</button></div>`;
}

const TABS = new Proxy({}, { get: () => u => navSections(u).flatMap(x => x.items).map(i => [i.k, i.label, i.count]) });
const ROLE = { admin: 'المدير', teacher: 'معلم', student: 'طالب' };
const PARENT_TAB = { session: 'sessions', student: 'students', thread: 'inbox' };
function shellV(u) {
  const tabs = TABS[u.role](u);
  const keys = tabs.map(t => t[0]);
  if (!ST.view || (!keys.includes(ST.view) && !PARENT_TAB[ST.view]) || (u.role === 'student' && !['home', 'help', 'msgs', 'cal', 'store'].includes(ST.view))) ST.view = keys[0];
  const activeTab = PARENT_TAB[ST.view] || ST.view;
  const body = ({ req: reqV, sessions: sessionsV, session: sessionV, students: studentsV, student: profileV, teachers: teachersV, halaqat: halaqatV, reports: reportsV, settings: settingsV, home: LANG === 'en' ? homeEn : homeV, anns: annsV, dash: dashV, room: roomV, logs: logsV, help: helpV, msgs: msgsV, cal: calV, inbox: inboxV, thread: threadV, wa: waV, store: storeV, complexes: complexesV, meet: meetV })[ST.view](u);
  document.getElementById('root').style.direction = u.role === 'student' && LANG === 'en' ? 'ltr' : 'rtl';
  if (ST.fs) { const f = fsV(u); if (f) { document.body.classList.add('fs-on'); return banner() + f; } if (ST.busyFs) return `<div class="center-box"><div class="spin"></div></div>`; ST.fs = null; ST.sw = null; wake(false); }
  document.body.classList.remove('fs-on');
  if (u.role === 'student' && LANG !== 'en' && !ST.tourShown && !tourSeen(u)) { ST.tourShown = true; setTimeout(() => { if ($('#modal').hidden) showTour(0); }, 600); }
  return `${banner()}<header class="top"><div class="top-in ${S.isSuper ? 'has-sec' : ''}"><div class="brand-row ${S.isSuper ? 'has-sec' : ''}">
      <button class="hb only-n" data-act="drawer" aria-label="القائمة"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
      <div class="brand">${MARK}<span>${esc(SET().center)}</span></div>
      ${S.isSuper ? `<div class="sec-sw" role="tablist" aria-label="القسم"><button role="tab" class="${inGirls() ? '' : 'on'}" data-act="sec" data-v="m" aria-selected="${!inGirls()}">البنين</button><button role="tab" class="f ${inGirls() ? 'on' : ''}" data-act="sec" data-v="f" aria-selected="${inGirls()}">${FLOWER} البنات</button></div>` : ''}
      <div class="who">${u.role !== 'student' ? '<button class="btn ghost sm" data-act="search">بحث</button>' : ''}<span class="small hide-n">${esc(u.name)}</span><span class="chip acc hide-n">${ROLE[u.role]}</span>
        <button class="hb" data-act="theme" aria-label="تبديل المظهر" title="تبديل المظهر">${isDarkNow() ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5" fill="currentColor"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" fill="currentColor"/></svg>'}</button>
        <button class="hb" data-act="account" aria-label="حسابي" title="حسابي">${ICO.settings}</button>
        <button class="btn ghost sm" data-act="logout">خروج</button></div></div></div></header>
  <div class="shell ${SIDE_MINI ? 'mini' : ''}"><aside class="side">${sideNavHtml(u, activeTab, SIDE_MINI)}<button class="side-fold" data-act="side-mini" title="طي القائمة"><span>⇥</span>${SIDE_MINI ? '' : ' طي القائمة'}</button></aside>
  <main class="wrap">${['dash', 'sessions', 'students', 'reports', 'halaqat', 'store'].includes(ST.view) ? branchBar(u) : ''}${body}</main></div>${bottomNav(u, tabs, activeTab)}${drawerHtml(u, activeTab)}`;
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
      ${fields.filter(f => p[f.k]).map(f => `<dt>${esc(f.label)}</dt><dd ${f.type === 'tel' ? 'dir="ltr" style="text-align:right"' : ''}>${fmtField(f, p[f.k])}</dd>`).join('')}
      <dt>تاريخ الطلب</dt><dd>${p.createdAt ? fmtDate(isoDate(new Date(p.createdAt))) : '—'}</dd></dl>
      <label class="fld"><span>الحلقة</span><select id="ap-h-${p.id}">${hs.map(h => `<option value="${h.id}" ${h.id === p.reqHalqa ? 'selected' : ''}>${esc(h.name)}</option>`).join('')}</select></label>
      <div class="row"><button class="btn pri" data-act="approve" data-id="${p.id}" ${hs.length ? '' : 'disabled'}>اعتماد</button><button class="btn danger" data-act="reject" data-id="${p.id}">رفض وحذف</button></div>
    </div>`).join('')}</div>`}`;
}

/* ---- sessions ---- */
function absentAlertsHtml(hids) {
  const lim = absentLimit(); const tp = SET().tpl;
  const list = L('users').filter(x => x.role === 'student' && x.status === 'active' && hids.includes(x.halqaId)).map(x => ({ x, n: absentStreak(x) })).filter(o => o.n >= lim);
  if (!list.length) return '';
  return `<section class="card alert-card"><div class="sec-head"><h2>تنبيه الغياب المتكرر</h2><span class="small muted">${lim} غيابات متتالية أو أكثر</span></div><div class="list">
  ${list.map(({ x, n }) => { const wa = x.parentPhone && waLink(x.parentPhone, fillTpl(tp.absent, { student: x.name, halqa: halqaName(x.halqaId), date: 'آخر ' + n + ' حصص', fem: femSt(x) })); return `<div class="item"><div class="grow click" data-act="open-student" data-id="${x.id}"><div class="name">${esc(x.name)}</div><div class="small muted">${esc(halqaName(x.halqaId))}</div></div><span class="chip bad">غاب ${n} متتالية</span>${wa ? `<a class="btn wa sm" href="${wa}" target="_blank" rel="noopener">واتساب ولي الأمر</a>` : ''}</div>`; }).join('')}
  </div></section>`;
}
function sessionsV(u) {
  const hs = myHalaqat(u);
  if (!hs.length) return `<h1>الحصص</h1><div class="empty"><b>${u.role === 'admin' ? 'ما فيه حلقات بعد' : 'ما عندك حلقة مسندة'}</b><span>${u.role === 'admin' ? 'ابدأ بإنشاء حلقة من تبويب الحلقات.' : 'تواصل مع المدير ليسند لك حلقة.'}</span></div>`;
  if (ST.halqa && !hs.some(h => h.id === ST.halqa)) ST.halqa = '';
  const ids = ST.halqa ? [ST.halqa] : hs.map(h => h.id);
  const all = L('sessions').filter(s => ids.includes(s.halqaId));
  const t = today();
  // الفترة المعروضة: يوم، أسبوع، شهر، أو القادمة
  const sr = ST.sr || 'week'; const sd = ST.sd || t;
  const ws = weekStartC(sd); const ms = sd.slice(0, 8) + '01'; const me0 = (() => { const d = new Date(ms + 'T00:00'); d.setMonth(d.getMonth() + 1); d.setDate(0); return isoDate(d); })();
  const [from, to] = sr === 'day' ? [sd, sd] : sr === 'week' ? [ws, addDays(ws, 6)] : sr === 'month' ? [ms, me0] : [t, '9999-12-31'];
  const inR = all.filter(s => s.date >= from && s.date <= to).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  const past = sr === 'up' ? all.filter(s => s.date < t).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)).slice(0, 25) : [];
  const grouped = sr !== 'up';
  const row = s => { const n = studentsOf(s.halqaId).length; const att = s.att || {}; const pres = Object.values(att).filter(v => v === 'p' || v === 'l').length; const recs = L('recs').filter(r => r.sid === s.id).length; const iss = Object.keys(s.issues || {}).length;
    const sel = ST.selOn; const on = sel && ST.sel.has(s.id);
    return `<div class="item click ${s.cancelled ? 'dim' : ''} ${on ? 'sel' : ''}" data-act="${sel ? 'ses-sel' : 'open-session'}" data-id="${s.id}">${sel ? `<span class="ses-ck ${on ? 'on' : ''}" aria-hidden="true">${on ? '✓' : ''}</span>` : ''}<div class="grow"><div class="name">${grouped ? `${fmtTime(s.time) || 'بدون وقت'} <span class="muted small">· ${esc(halqaName(s.halqaId))}</span>` : `${fmtDateH(s.date)} <span class="muted small">${fmtTime(s.time)}</span>`}</div><div class="small muted">${grouped ? '' : esc(halqaName(s.halqaId))}${s.note ? (grouped ? '' : ' · ') + esc(s.note) : ''}</div></div>
      ${s.cancelled ? '<span class="chip">ملغاة</span>' : `${s.subId ? `<span class="chip info">احتياط: ${esc(subName(s.subId) || 'أنت')}</span>` : ''}${!grouped && s.date === t ? '<span class="chip gold">اليوم</span>' : ''}${iss ? `<span class="chip bad">مشكلة دخول ${iss}</span>` : ''}${lessonMode(s) !== 'onsite' ? `<span class="chip info">${MODE_L[lessonMode(s)]}</span>` : ''}${lessonMode(s) === 'onsite' || effLink(s) ? '' : '<span class="chip warn">بدون رابط</span>'}${s.closedAt ? '<span class="chip ok">انتهت</span>' : ''}<span class="chip num">حضور ${pres}/${n}</span><span class="chip num">تسميع ${recs}</span>`}</div>`; };
  const byDay = {}; inR.forEach(s => (byDay[s.date] = byDay[s.date] || []).push(s));
  const rangeLbl = sr === 'day' ? fmtDateH(sd) + (sd === t ? ' · اليوم' : sd === addDays(t, 1) ? ' · بكرة' : '') : sr === 'week' ? `${fmtDate(from)} – ${fmtDate(to)}${hijri(from) ? ` <span class="muted small">(${hijri(from)} – ${hijri(to)})</span>` : ''}` : sr === 'month' ? `${new Date(ms + 'T12:00').toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { month: 'long', year: 'numeric' })}` : 'اليوم والقادمة';
  const step = sr === 'day' ? 1 : sr === 'week' ? 7 : 0;
  const strip = sr === 'day' || sr === 'week' ? `<div class="wk-strip">${[0, 1, 2, 3, 4, 5, 6].map(i => { const d = addDays(ws, i); const n = all.filter(x => x.date === d && !x.cancelled).length; const dd = new Date(d + 'T00:00'); return `<button class="wk-d ${sr === 'day' && d === sd ? 'on' : ''} ${d === t ? 'today' : ''}" data-act="ses-day" data-d="${d}"><span>${DAYN[dd.getDay()]}</span><b>${dd.getDate()}/${dd.getMonth() + 1}</b><i>${n ? n + ' حصة' : '—'}</i></button>`; }).join('')}</div>` : '';
  const selBar = ST.selOn ? (() => { const n = ST.sel.size; return `<div class="sel-bar"><b>${n ? 'محدد ' + n + ' حصة' : 'اختر الحصص'}</b><div class="row">
      <button class="btn sm" data-act="ses-sel-all">${inR.length && inR.every(x => ST.sel.has(x.id)) ? 'إلغاء تحديد الكل' : 'تحديد الكل (' + inR.length + ')'}</button>
      ${n ? `<select id="bulk-mode" data-change="bulk-mode" aria-label="نوع الحصص"><option value="">نوع الحصة…</option><option value="onsite">حضوري</option><option value="remote">عن بعد</option><option value="hybrid">هجين</option><option value="default">حسب الحلقة</option></select><button class="btn sm" data-act="bulk-time">🕒 الوقت</button><button class="btn sm danger" data-act="bulk-cancel" data-v="1">إلغاء الحصص</button><button class="btn sm" data-act="bulk-cancel" data-v="0">استرجاع</button>` : ''}
      <button class="btn sm ghost" data-act="ses-sel-off">✕ إنهاء التحديد</button></div></div>`; })() : '';
  return `${checkinCard(u)}<div class="sec-head"><h1>الحصص</h1><div class="row"><button class="btn" data-act="cal">${ST.cal ? 'عرض القائمة' : 'عرض التقويم'}</button>${ST.cal ? '' : `<button class="btn ${ST.selOn ? 'pri' : ''}" data-act="ses-sel-on">☑ تعديل متعدد</button>`}<button class="btn" data-act="quick-rec">${ICO.reports || ''} تسجيل تسميع</button><button class="btn pri" data-act="new-session">حصة إضافية</button></div></div>
  ${hs.length > 1 ? `<div class="row">${['', ...hs.map(h => h.id)].map(id => `<button class="btn sm ${ST.halqa === id ? 'pri' : ''}" data-act="filter-h" data-h="${id}">${id ? esc(halqaName(id)) : 'كل الحلقات'}</button>`).join('')}</div>` : ''}
  ${absentAlertsHtml(ids)}
  ${ST.cal ? calendarHtml(ids) : `<div class="ses-nav card"><div class="ses-nav-top">${step ? `<button class="btn sm ghost" data-act="ses-step" data-n="-${step}" aria-label="السابق">→</button>` : ''}<div class="ses-range">${rangeLbl}</div>${step ? `<button class="btn sm ghost" data-act="ses-step" data-n="${step}" aria-label="التالي">←</button>` : ''}${sr !== 'up' && !(from <= t && t <= to) ? '<button class="btn sm" data-act="ses-today">اليوم</button>' : ''}</div>
    <div class="seg ses-seg">${[['day', 'يوم'], ['week', 'أسبوع'], ['month', 'شهر'], ['up', 'القادمة']].map(([k, l]) => `<button class="${sr === k ? 'on' : ''}" data-act="ses-r" data-v="${k}">${l}</button>`).join('')}</div>${strip}</div>
  ${selBar}
  ${sr === 'up' ? `<section class="card">${inR.length ? `<div class="list">${inR.map(row).join('')}</div>` : `<div class="empty"><span>ما فيه حصص قادمة. فعّل «الجدول الثابت» من إعدادات الحلقة وتنشأ الحصص لحالها، أو أضف حصة إضافية.</span></div>`}</section>
    ${past.length ? `<section class="card"><h2>السابقة</h2><div class="list">${past.map(row).join('')}</div></section>` : ''}`
  : Object.keys(byDay).length ? Object.entries(byDay).map(([d, ls]) => `<section class="card ses-day ${d === t ? 'is-today' : ''}"><div class="sec-head"><h2>${fmtDateH(d)}${d === t ? ' <span class="chip gold">اليوم</span>' : d === addDays(t, 1) ? ' <span class="chip">بكرة</span>' : ''}</h2>${ST.selOn ? `<button class="linkbtn" data-act="ses-sel-day" data-d="${d}">تحديد اليوم</button>` : ''}</div><div class="list">${ls.map(row).join('')}</div></section>`).join('')
  : `<div class="empty"><span>ما فيه حصص ${sr === 'day' ? 'هاليوم' : sr === 'week' ? 'هالأسبوع' : 'هالشهر'}.</span></div>`}`}`;
}
function joinText(j, s) {
  if (!j) return 'لم يضغط دخول';
  let t = 'دخل ' + clock(j.at);
  if (j.left) t += ' · خرج ' + clock(j.left) + ' (' + Math.max(1, Math.round((j.left - j.at) / 60000)) + ' د)';
  else if (s.date === today()) t += ' · داخل الآن';
  return t;
}
function planBrief(st) {
  const gs = planGroups(st);
  if (!gs.length) return '<span class="muted">ما حُدّد</span>';
  return gs.map(g => `<span class="por">${g.retry ? '<span class="chip bad">إعادة</span> ' : ''}<span class="muted small">${TYPE[g.type]}:</span> <b>${esc(partsText(g.parts))}</b>${g.parts.length > 1 ? ` <span class="small muted">(${g.parts.length} سور${partsPages(g.parts) ? '، ' + partsPages(g.parts) : ''})</span>` : ''}</span>`).join('<br>');
}
function sessionV(u) {
  const s = S.sessions[ST.sid] && { ...S.sessions[ST.sid], id: ST.sid };
  if (s && isOnsiteL(s)) return onsiteV(u, s);
  if (!s) return `<button class="back" data-act="tab" data-v="sessions">→ الحصص</button><div class="empty">هذه الحصة غير موجودة.</div>`;
  const studs = studentsOf(s.halqaId); const att = s.att || {}; const queue = (s.queue || []).filter(id => S.users[id]);
  const joins = {}; L('joins').filter(j => j.sid === s.id).forEach(j => joins[j.uid] = j);
  const recs = L('recs').filter(r => r.sid === s.id).sort((a, b) => (b.at || 0) - (a.at || 0));
  const hname = halqaName(s.halqaId); const tp = SET().tpl; const link = effLink(s); const lim = absentLimit();
  const vars = st => ({ student: st.name, halqa: hname, date: fmtDate(s.date), fem: femSt(st) });
  const cur = s.current && S.users[s.current] ? { ...S.users[s.current], id: s.current } : null;
  const notQueued = studs.filter(x => !queue.includes(x.id) && x.id !== s.current);
  const dd = new Date(s.date + 'T00:00');
  const head = `<button class="back" data-act="tab" data-v="sessions">→ الحصص</button>
  <div class="session-hero"><div class="datebox"><b>${dd.getDate()}</b><span>${DAYN[dd.getDay()]}</span></div>
    <div style="flex:1 1 220px;min-width:0"><h1>${esc(hname)}</h1><div class="muted">${fmtDateH(s.date)} · ${fmtTime(s.time)}${s.note ? ' · ' + esc(s.note) : ''}${s.auto ? ' · من الجدول الثابت' : ''}</div><div class="row" style="margin-top:4px">${s.subId ? `<span class="chip info">معلم احتياط: ${esc(subName(s.subId) || 'أنت')}</span>` : ''}${s.teacherAt ? `<span class="chip ok">المعلم فتح الحصة ${clock(s.teacherAt)}</span>` : ''}</div></div>
    <div class="row">${link && !s.cancelled ? `<a class="btn pri" href="${esc(link)}" target="_blank" rel="noopener" data-act="join" data-id="${s.id}">${S.videoOn ? ICO.live + ' ادخل الغرفة' : 'افتح الحصة'}</a>${S.videoOn ? '' : `<button class="btn" data-act="copy" data-text="${esc(link)}">نسخ الرابط</button>`}` : (s.cancelled ? '' : `<span class="chip warn">ما فيه رابط</span>`)}<button class="btn" data-act="edit-session" data-id="${s.id}">تعديل</button></div></div>`;
  if (u.role === 'teacher' && s.date === today() && !s.teacherAt && !(ST.opened || {})[s.id]) { ST.opened = { ...(ST.opened || {}), [s.id]: 1 }; act('lesson.open', { id: s.id }); }
  if (s.cancelled) return head + `<div class="note">هذه الحصة ملغاة${s.note ? ': ' + esc(s.note) : ''}. ما تنحسب في الحضور ولا تظهر للطلاب كحصة قادمة.</div><div><button class="btn" data-act="lesson-restore" data-id="${s.id}">استرجاع الحصة</button></div>`;
  const issues = Object.entries(s.issues || {}).filter(([id]) => S.users[id]);
  const attRow = st => { const v = att[st.id]; const nts = todayNotes(st.id, s.date); const wA = st.parentPhone && waLink(st.parentPhone, fillTpl(tp.absent, vars(st))); const wE = st.parentPhone && waLink(st.parentPhone, fillTpl(tp.excellent, vars(st))); const streak = absentStreak(st);
    return `<div class="item"><div class="grow"><div class="name">${esc(st.name)}${streak >= lim ? ` <span class="chip bad">غاب ${streak} متتالية</span>` : ''}</div><div class="small muted">${joinText(joins[st.id], s)}</div>${nts.map(n => `<div class="small note-chip">📌 ${esc(n.text)}</div>`).join('')}</div>
    <div class="seg">${Object.keys(ATT).map(k => `<button class="${k} ${v === k ? 'on' : ''}" data-act="att" data-id="${st.id}" data-v="${k}">${ATT[k]}</button>`).join('')}</div>
    ${v === 'a' && wA ? `<a class="btn wa sm" href="${wA}" target="_blank" rel="noopener">واتساب غياب</a>` : ''}${(v === 'p' || v === 'l') && wE ? `<a class="btn wa sm" href="${wE}" target="_blank" rel="noopener">واتساب تميّز</a>` : ''}</div>`; };
  const recHere = ST.rec && ST.rec.sid === s.id && ST.rec.where === 'inline';
  const presentFirst = [...studs].sort((a, b) => ((att[b.id] === 'p' || att[b.id] === 'l') - (att[a.id] === 'p' || att[a.id] === 'l')));
  const tools = `<div class="tools3"><button class="tool" data-act="rec1-open">${ICO.mic}<b>وضع التسميع</b><span>بإبهام واحد</span></button><button class="tool" data-act="swipe-open">${ICO.swipe}<b>التحضير بالسحب</b><span>${Object.keys(att).length}/${studs.length}</span></button><button class="tool" data-act="board-open">${ICO.grid}<b>لوحة الحصة</b><span>مباشرة</span></button></div>`;
  return head + tools + lessonSummaryHtml(s) + `
  ${issues.length ? `<div class="note bad-note"><b>مشاكل دخول:</b><div class="list">${issues.map(([id, x]) => `<div class="item"><div class="grow"><b>${esc(S.users[id].name)}</b>: ${esc(x.msg)} <span class="small muted">${clock(x.at)}</span></div><button class="btn sm" data-act="issue-clear" data-id="${id}">تم الحل</button></div>`).join('')}</div></div>` : ''}
  ${waSessionHtml(s)}
  <div class="grid2">
  <section class="card" style="display:grid;gap:12px"><div class="sec-head"><h2>طابور التسميع</h2><div class="row"><button class="btn ghost sm" data-act="q-sort" data-k="join">حسب الدخول</button><button class="btn ghost sm" data-act="q-sort" data-k="least">الأقل تسميعًا أولًا</button></div></div>
    ${recHere ? recPanelHtml() : (cur ? `<div class="now"><div style="flex:1 1 160px;min-width:0"><div class="lbl">يسمّع الآن</div><div class="name">${esc(cur.name)}</div></div><button class="btn pri" data-act="rec-start" data-id="${cur.id}">سجّل التسميع</button><button class="btn" data-act="q-next">التالي</button><button class="btn ghost" data-act="q-skip" title="ينتقل لآخر الطابور">ما رد</button></div>` : (queue.length ? `<button class="btn pri" data-act="q-next">ابدأ بأول الطابور</button>` : ''))}
    ${queue.length ? `<div class="list">${queue.map((id, i) => `<div class="item"><span class="qnum">${i + 1}</span><div class="grow name">${esc(S.users[id].name)}</div><button class="btn ghost sm" data-act="q-up" data-i="${i}" aria-label="تقديم">▲</button><button class="btn ghost sm" data-act="q-down" data-i="${i}" aria-label="تأخير">▼</button><button class="btn ghost sm" data-act="rec-start" data-id="${id}">سجّل</button><button class="btn ghost sm" data-act="q-rm" data-i="${i}" aria-label="حذف">✕</button></div>`).join('')}</div>` : (!cur && !recHere ? '<div class="empty small">الطابور فاضي. الطلاب يقدرون يضغطون «جاهز للتسميع» من صفحتهم، أو أضفهم أنت.</div>' : '')}
    <div class="row"><select id="q-pick" style="flex:1 1 160px"><option value="">إضافة طالب…</option>${notQueued.map(x => `<option value="${x.id}">${esc(x.name)}${att[x.id] === 'p' || att[x.id] === 'l' ? '' : ' (غير محضّر)'}</option>`).join('')}</select><button class="btn" data-act="q-add">أضف</button><button class="btn" data-act="q-all">كل الحاضرين</button></div>
  </section>
  <section class="card"><div class="sec-head"><h2>التحضير</h2><div class="row"><button class="btn sm" data-act="att-all">الكل حاضر</button><button class="btn sm" data-act="att-joined">من دخل</button><button class="btn sm" data-act="att-rest">الباقي غائب</button>${Object.values(att).includes('a') ? `<button class="btn wa sm" data-act="wa-absent">راسل الغائبين (${Object.values(att).filter(v => v === 'a').length})</button>` : ''}</div></div>
    ${studs.length ? `<div class="list">${studs.map(attRow).join('')}</div>` : '<div class="empty">ما فيه طلاب معتمدون في هذه الحلقة.</div>'}</section>
  </div>
  <details class="card prep" ${ST.prepOpen ? 'open' : ''} data-act-toggle="prep"><summary><h2>المطلوب اليوم من كل طالب</h2></summary>
    ${studs.length ? `<div class="tbl-wrap"><table><thead><tr><th>الطالب</th><th>المطلوب</th><th></th></tr></thead><tbody>${presentFirst.map(st => `<tr><td>${esc(st.name)}${att[st.id] ? ` <span class="chip ${ATTC[att[st.id]]}">${ATT[att[st.id]]}</span>` : ''}</td><td style="white-space:normal">${planBrief(st)}${s.date === today() ? ' ' + wirdBrief(st.id) : ''}</td><td><button class="btn ghost sm" data-act="rec-start" data-id="${st.id}">سجّل</button></td></tr>`).join('')}</tbody></table></div>` : ''}
  </details>
  <section class="card"><h2>تسميع هذه الحصة</h2>${historyTable(recs, true, true)}</section>`;
}

/* ---- students ---- */
function studentsV(u) {
  const hs = myHalaqat(u); const hids = hs.map(h => h.id); const lim = absentLimit();
  let list = L('users').filter(x => x.role === 'student' && x.status !== 'pending' && ((u.role === 'admin' && !ST.branch) || hids.includes(x.halqaId)));
  const inact = new Set(inactiveList().map(x => x.id)); const nIn = list.filter(x => inact.has(x.id)).length;
  if (ST.inact) list = list.filter(x => inact.has(x.id));
  const nArch = list.filter(x => x.status === 'archived').length;
  list = list.filter(x => ST.arch ? x.status === 'archived' : x.status !== 'archived');
  if (ST.halqa) list = list.filter(x => x.halqaId === ST.halqa);
  const q = (ST.q || '').trim(); if (q) list = list.filter(x => (x.name || '').includes(q) || (x.username || '').toLowerCase().includes(q.toLowerCase()));
  list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
  return `<div class="sec-head"><h1>${u.role === 'admin' ? 'الطلاب' : 'طلابي'}</h1><div class="row"><button class="btn" data-act="cards">🪪 بطاقات للطباعة</button>${canPlan(u) && canAutoU(u) ? '<button class="btn" data-act="tpl-apply">تطبيق قالب خطة</button>' : ''}${u.role === 'admin' ? '<button class="btn" data-act="import">استيراد</button><button class="btn pri" data-act="add-student">إضافة طالب</button>' : ''}</div></div>
  ${nArch || nIn ? `<div class="row">${nArch ? `<button class="btn sm ${ST.arch ? '' : 'pri'}" data-act="arch" data-v="0">الحاليون</button><button class="btn sm ${ST.arch ? 'pri' : ''}" data-act="arch" data-v="1">المؤرشفون (${nArch})</button>` : ''}${nIn ? `<button class="btn sm ${ST.inact ? 'pri' : ''}" data-act="inact">منقطعين أسبوعين (${nIn})</button>` : ''}</div>` : ''}
  <div class="row"><input id="st-q" placeholder="ابحث بالاسم أو اسم المستخدم" value="${esc(ST.q)}" data-input="search" style="flex:1 1 220px">
  ${hs.length > 1 ? `<select id="st-h" data-change="filter-h" style="flex:0 1 200px"><option value="">كل الحلقات</option>${hs.map(h => `<option value="${h.id}" ${ST.halqa === h.id ? 'selected' : ''}>${esc(h.name)}</option>`).join('')}</select>` : ''}</div>
  <section class="card">${list.length ? `<div class="list">${list.map(x => { const a = attStats(x, 30); const n = absentStreak(x); return `<div class="item click" data-act="open-student" data-id="${x.id}"><div class="grow"><div class="name">${esc(x.name)}</div><div class="small muted">${esc(halqaName(x.halqaId))} · <span dir="ltr">${esc(x.username)}</span>${inact.has(x.id) ? ' · ' + lastSeenText(x) : ''}</div></div>
    ${dmUnreadOf(x.id) ? `<span class="chip bad">${dmUnreadOf(x.id)} رسالة</span>` : ''}${x.status === 'disabled' ? '<span class="chip bad">موقوف</span>' : ''}${n >= lim ? `<span class="chip bad">غاب ${n} متتالية</span>` : ''}<span class="chip ${isAuto(x) ? 'acc' : ''}">${isAuto(x) ? 'خطة تلقائية' : 'خطة يدوية'}</span><span class="chip num">حضور ${a.rate == null ? '—' : a.rate + '٪'}</span>${x.status === 'active' ? `<button class="btn sm" data-act="rec-out" data-id="${x.id}" title="تسجيل تسميع بدون حصة">سمّع</button>` : ''}</div>`; }).join('')}</div>` : `<div class="empty">${q ? 'ما فيه نتائج.' : 'ما فيه طلاب معتمدون بعد.'}</div>`}</section>`;
}
function planHtml(st) {
  const ps = planSegs(st); const rows = ['new', 'review', 'tath'].filter(k => ps[k]);
  const p = planOf(st); const auto = isAuto(st); const rt = retriesOf(st);
  const t = today(); const workday = halqaDays(st.halqaId).includes(new Date().getDay()) && !isHolidayC(t);
  const head = auto ? `<span class="chip acc">تلقائية</span> <span class="small muted">حفظ ${fmtAmt(p.auto.newAmt)}${+p.auto.newAmt < 1 ? ' (' + amtLines(p.auto.newAmt) + ')' : ''}، مراجعة ${fmtAmt(p.auto.revAmt)}${+p.auto.tathAmt ? '، تثبيت ' + fmtAmt(p.auto.tathAmt) : ''} · ${p.auto.dir === 'fwd' ? 'من الفاتحة' : 'من الناس'}</span>` : `<span class="chip">يدوية</span>`;
  const pz = (st.plan || {}).paused;
  return `<div class="plan"><div class="row">${head}${workday ? '' : '<span class="chip gold">اليوم إجازة</span>'}${+p.near && !auto ? `<span class="chip">تثبيت آخر ${fmtAmt(p.near)}</span>` : ''}</div>
  ${pz && pz.from ? `<div class="note">${isPaused(st) ? 'الخطة موقوفة مؤقتًا' : 'إيقاف مجدول'} من ${fmtDate(pz.from)}${pz.to ? ' إلى ' + fmtDate(pz.to) : ''}${pz.reason ? ': ' + esc(pz.reason) : ''}</div>` : ''}
  ${rt.map(r => `<div class="plan-row retry"><span class="lbl">إعادة ${TYPE[r.type]}</span><div>${segText([{ s: r.surah - 1, a1: r.from, a2: r.to }])} <span class="small muted">من ${fmtDate(r.date)}</span></div></div>`).join('')}
  ${rows.length ? rows.map(k => `<div class="plan-row"><span class="lbl">${TYPE[k]}</span><div>${segText(ps[k])}${PAGES_OK ? ` <span class="pg">· ${fmtLines(linesOf(ps[k]))}</span>` : ''}</div></div>`).join('') : (rt.length ? '' : `<div class="empty small">${auto && ps._info && ps._info.done ? 'أتمّ الحفظ في هذا الاتجاه، ما شاء الله.' : 'ما حُدّد مقطع بعد.'}</div>`)}
  ${auto && ps._info && ps._info.np > ps._info.ms ? `<div class="small muted">الحفظ السابق: من ${esc(posText(p.auto.dir, ps._info.ms))} إلى ${esc(posText(p.auto.dir, ps._info.np - 1))}</div>` : ''}
  ${auto && ps._info ? `<div class="small muted">الحفظ الجديد يكمل من: ${esc(posText(p.auto.dir, p.auto.newPos))} · المحفوظ تقريبًا ${Math.round(ps._info.memPages)} وجه${PAGES_OK ? ' حسب مصحف المدينة' : ' (تقدير تقريبي)'}</div>` : ''}</div>`;
}
function profileV(u) {
  const st = S.users[ST.uid] && { ...S.users[ST.uid], id: ST.uid };
  if (!st) return `<button class="back" data-act="tab" data-v="students">→ الطلاب</button><div class="empty">الطالب غير موجود.</div>`;
  const a = attStats(st, ST.range); const rs = recsOf(st.id); const fields = SET().fields;
  const rf = rangeFrom(ST.range); const inRange = rs.filter(r => !rf || r.date >= rf);
  const scored = inRange.filter(r => !r.quick);
  const avg = scored.length ? (scored.reduce((x, r) => x + (+r.mistakes || 0), 0) / scored.length).toFixed(1) : '—';
  const pg = pagesSum(inRange); const streak = absentStreak(st);
  const wa = st.parentPhone ? waLink(st.parentPhone, 'السلام عليكم ورحمة الله، ') : '';
  return `<button class="back" data-act="tab" data-v="students">→ ${u.role === 'admin' ? 'الطلاب' : 'طلابي'}</button>
  <div class="sec-head"><div><h1>${esc(st.name)}</h1><div class="muted">${esc(halqaName(st.halqaId))} · <span dir="ltr">${esc(st.username)}</span>${st.status === 'disabled' ? ' · <span class="chip bad">موقوف</span>' : ''}${st.status === 'archived' ? ' · <span class="chip">مؤرشف</span>' : ''}${streak >= absentLimit() ? ` · <span class="chip bad">غاب ${streak} متتالية</span>` : ''}</div></div>
    <div class="row"><button class="btn pri" data-act="rec-out" data-id="${st.id}">تسجيل تسميع</button><button class="btn" data-act="open-thread" data-id="${st.id}">رسائل${dmUnreadOf(st.id) ? ` <span class="count">${dmUnreadOf(st.id)}</span>` : ''}</button>${st.parentPhone ? `<button class="btn wa" data-act="tpl-pick" data-id="${st.id}">واتساب ولي الأمر</button>` : ''}${u.role === 'admin' ? `<button class="btn" data-act="edit-student" data-id="${st.id}">تعديل البيانات</button><button class="btn" data-act="reset-pw" data-id="${st.id}">كلمة مرور جديدة</button>` : ''}</div></div>
  <div class="row">${[7, 30, 90, 0].map(d => `<button class="btn sm ${ST.range === d ? 'pri' : ''}" data-act="range" data-d="${d}">${d ? 'آخر ' + d + ' يوم' : 'الكل'}</button>`).join('')}</div>
  <div class="stats"><div class="stat"><b>${a.rate == null ? '—' : a.rate + '٪'}</b><span>نسبة الحضور</span></div><div class="stat"><b>${a.a}</b><span>غياب</span></div><div class="stat"><b>${inRange.length}</b><span>تسميع</span></div><div class="stat"><b>${fmtPages(pg.new)}</b><span>أوجه حفظ</span></div><div class="stat"><b>${fmtPages(pg.review + pg.tath)}</b><span>أوجه مراجعة وتثبيت</span></div><div class="stat"><b>${avg}</b><span>متوسط الأخطاء</span></div></div>
  <div class="grid2">
  <section class="card" style="display:grid;gap:12px"><div class="sec-head"><h2>الخطة</h2><div class="row">${canPlan(u) ? `<button class="btn sm" data-act="edit-plan" data-id="${st.id}">تعديل الخطة</button><button class="btn sm" data-act="edit-goal" data-id="${st.id}">${st.goal ? 'تعديل الهدف' : 'هدف'}</button>` : ''}<button class="btn ghost sm" data-act="plan-log" data-id="${st.id}">سجل الخطة</button></div></div>
    ${planHtml(st)}${goalHtml(st)}
</section>
  <section class="card" style="display:grid;gap:12px"><h2>نقاط وأوسمة</h2><div class="stats"><div class="stat"><b>${ptsOf(st, weekStartC(today()), today())}</b><span>نقاط هالأسبوع</span></div><div class="stat"><b>${attendStreak(st)}</b><span>حصص متتالية</span></div></div>${(b => b.length ? `<div class="badges">${b.map(x => `<span class="badge"><b>${esc(x.t)}</b><span>${esc(x.d)}</span></span>`).join('')}</div>` : '')(badgesOf(st))}
    <div class="small muted" style="font-weight:600">الورد في البيت، آخر 7 أيام</div><div class="wgrid">${[...Array(7).keys()].reverse().map(i => { const d = addDays(today(), -i); const w = wirdOf(st.id, d); const n = w ? (w.items || []).filter(x => x.done).length : 0; return `<div class="wday ${w ? 'on' : ''}" title="${fmtDate(d)}"><span>${['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'][new Date(d + 'T00:00').getDay()]} ${new Date(d + 'T00:00').getDate()}</span><b>${w ? n + '/' + (w.items || []).length : '—'}</b>${w && w.read ? `<span>${w.read} و</span>` : ''}</div>`; }).join('')}</div></section>
  <section class="card"><h2>البيانات</h2><dl class="kv">${fields.filter(f => st[f.k]).map(f => `<dt>${esc(f.label)}</dt><dd ${f.type === 'tel' ? 'dir="ltr" style="text-align:right"' : ''}>${fmtField(f, st[f.k])}</dd>`).join('')}<dt>آخر دخول</dt><dd>${st.lastSeen ? fmtDate(isoDate(new Date(st.lastSeen))) + ' ' + clock(st.lastSeen) : 'ما دخل بعد'}</dd></dl></section>
  ${behavStaffHtml(st)}</div>
  <section class="card"><h2>سجل التسميع</h2>${historyTable(inRange, true)}</section>`;
}
// تسميع انحفظ مرة وحدة لنفس النوع والتقدير (مقطع يمتد على أكثر من سورة) → عنصر واحد، مرتب حسب المصحف
// ترتيب سور المقطع حسب اتجاه حفظ الطالب (من الناس للبقرة، أو العكس)
const recOrder = uid => { const a = (planOf(S.users[uid] || {}).auto || {}); return a.dir === 'fwd' ? (x, y) => x.surah - y.surah || x.from - y.from : (x, y) => y.surah - x.surah || x.from - y.from; };
function recMerge(rs) {
  const out = []; rs.forEach(r => { const l = out[out.length - 1]; if (l && r.at && l.at === r.at && l.uid === r.uid && l.type === r.type && l.grade === r.grade && l.sid === r.sid) l.items.push(r); else out.push({ ...r, items: [r] }); });
  out.forEach(g => g.items.sort(recOrder(g.uid))); return out;
}
function historyTable(rs, editable, noDate) {
  if (!rs.length) return '<div class="empty small">ما فيه تسميع في هذه الفترة.</div>';
  const row = (r, sub) => `<tr${sub ? ' class="sub-row"' : ''}><td>${noDate ? esc((S.users[r.uid] || {}).name || '—') : fmtDate(r.date) + (r.sid ? '' : ' <span class="chip">خارج الحصة</span>')}</td><td>${TYPE[r.type] || ''}${r.full ? ' <span class="chip acc">سورة كاملة</span>' : ''}</td><td>${segText([{ s: r.surah - 1, a1: r.from, a2: r.to }])}</td><td class="num">${fmtPages(recPages(r))}</td><td class="num">${r.quick ? '—' : r.mistakes}</td><td class="num">${r.quick ? '—' : r.alerts}</td><td><span class="chip ${GRADE_K[r.grade] || ''}">${esc(r.grade)}</span></td><td class="num">${r.secs ? fmtDur(r.secs) : ''}</td><td style="white-space:normal;min-width:120px">${esc(r.note || '')}</td>${editable ? `<td><button class="btn ghost sm" data-act="edit-rec" data-id="${r.id}">تعديل</button><button class="btn ghost sm" data-act="del-rec" data-id="${r.id}">حذف</button></td>` : ''}</tr>`;
  // التسميع اللي انحفظ مرة وحدة ويمتد على أكثر من سورة (نفس النوع والتقدير) ينعرض سطر واحد، و«تفصيل» يفتحه
  const grp = row0 => { const it = [...row0.items].sort(recOrder(row0.uid)); const a = it[0], z = it[it.length - 1]; const k = row0.uid + '_' + row0.at + '_' + row0.type; const open = (ST.recOpen || {})[k];
    return `<tr class="grp-row"><td>${noDate ? esc((S.users[a.uid] || {}).name || '—') : fmtDate(a.date) + (a.sid ? '' : ' <span class="chip">خارج الحصة</span>')}</td><td>${TYPE[a.type] || ''}</td><td><span class="por">من ${esc(SN[a.surah - 1])} ${a.from} إلى ${esc(SN[z.surah - 1])} ${z.to}</span> <span class="small muted">(${it.length} سور)</span></td><td class="num">${fmtPages(it.reduce((t, r) => t + recPages(r), 0))}</td><td class="num">${a.quick ? '—' : it.reduce((t, r) => t + (+r.mistakes || 0), 0)}</td><td class="num">${a.quick ? '—' : it.reduce((t, r) => t + (+r.alerts || 0), 0)}</td><td><span class="chip ${GRADE_K[a.grade] || ''}">${esc(a.grade)}</span></td><td class="num">${(it.find(r => r.secs) || {}).secs ? fmtDur(it.find(r => r.secs).secs) : ''}</td><td style="white-space:normal;min-width:120px">${esc((it.find(r => r.note) || {}).note || '')}</td>${editable ? `<td><button class="btn ghost sm" data-act="rec-open" data-k="${esc(k)}">${open ? 'إخفاء' : 'تفصيل'}</button></td>` : ''}</tr>${open ? it.map(r => row(r, true)).join('') : ''}`; };
  const groups = []; rs.forEach(r => { const l = groups[groups.length - 1]; if (l && r.at && l.at === r.at && l.uid === r.uid && l.type === r.type && l.grade === r.grade && l.sid === r.sid) l.items.push(r); else groups.push({ ...r, items: [r] }); });
  return `<div class="tbl-wrap"><table><thead><tr>${noDate ? '<th>الطالب</th>' : '<th>التاريخ</th>'}<th>النوع</th><th>المقطع</th><th class="num">أوجه</th><th class="num">أخطاء</th><th class="num">تنبيهات</th><th>التقدير</th><th class="num">المدة</th><th>ملاحظة</th>${editable ? '<th></th>' : ''}</tr></thead><tbody>
  ${groups.slice(0, 80).map(g => g.items.length > 1 ? grp(g) : row(g.items[0])).join('')}</tbody></table></div>`;
}

/* ---- admin: teachers ---- */
function teachersV() {
  const ts = L('users').filter(u => u.role === 'teacher').sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
  const m = me(); const admins = L('users').filter(x => x.role === 'admin' && x.perms);
  return `<div class="sec-head"><h1>المعلمون</h1><div class="row"><button class="btn ${ST.sched ? 'pri' : ''}" data-act="sch">جدول الأسبوع</button><button class="btn pri" data-act="add-teacher">إضافة معلم</button></div></div>
  ${ST.sched ? scheduleHtml() : ''}
  ${isFullAdmin(m) ? `<section class="card" style="display:grid;gap:8px"><div class="sec-head"><h2>المشرفون الإداريون</h2><button class="btn sm" data-act="add-admin">إضافة مشرف إداري</button></div>${admins.length ? `<div class="list">${admins.map(a => `<div class="item"><div class="grow"><b>${esc(a.name)}</b><div class="small muted"><span dir="ltr">${esc(a.username)}</span> · ${(a.perms || []).filter(p => PERM_LABEL[p]).map(p => PERM_LABEL[p]).join('، ')}${(a.perms || []).some(p => /^(h|b):/.test(p)) ? ' · <span class="chip info">نطاق: ' + (a.perms || []).filter(p => /^(h|b):/.test(p)).map(p => p[0] === 'b' ? esc(p.slice(2)) : esc(halqaName(p.slice(2)))).join('، ') + '</span>' : ''}</div></div>${a.status === 'disabled' ? '<span class="chip bad">موقوف</span>' : ''}<button class="btn sm" data-act="edit-admin" data-id="${a.id}">تعديل</button></div>`).join('')}</div>` : '<div class="small muted">ما فيه مشرفين بعد.</div>'}</section>` : ''}
  <section class="card">${ts.length ? `<div class="list">${ts.map(t => { const hs = L('halaqat').filter(h => h.teacherId === t.id); return `<div class="item"><div class="grow"><div class="name">${esc(t.name)}</div><div class="small muted"><span dir="ltr">${esc(t.username)}</span> · ${hs.length ? hs.map(h => esc(h.name)).join('، ') : 'بدون حلقة'}</div></div>
    ${t.status === 'disabled' ? '<span class="chip bad">موقوف</span>' : ''}
    <label class="check"><input type="checkbox" id="tc-plan-${t.id}" data-change="t-perm" data-k="canPlan" data-id="${t.id}" ${t.canPlan ? 'checked' : ''}> إعداد الخطط</label>
    <button class="btn sm" data-act="edit-teacher" data-id="${t.id}">تعديل</button></div>`; }).join('')}</div>` : '<div class="empty">ما فيه معلمون بعد. أضف معلمًا ثم أسند له حلقة.</div>'}</section>`;
}

/* ---- admin: halaqat ---- */
function halaqatV() {
  const hs = myHalaqat(me()).sort((a, b) => ((a.branch || '') + a.name).localeCompare((b.branch || '') + b.name, 'ar'));
  return `<div class="sec-head"><h1>الحلقات</h1><div class="row">${can(me(), 'students') ? '<button class="btn" data-act="assign">توزيع الطلاب</button>' : ''}<button class="btn pri" data-act="add-halqa">حلقة جديدة</button></div></div>
  ${hs.length ? `<div class="grid2">${hs.map(h => { const t = h.teacherId && S.users[h.teacherId]; return `<section class="card" style="display:grid;gap:10px">
    <div class="sec-head"><div><h2>${esc(h.name)}</h2>${h.branch ? `<span class="chip">${esc(h.branch)}</span>` : ''}</div><button class="btn sm" data-act="edit-halqa" data-id="${h.id}">تعديل</button></div>
    <dl class="kv"><dt>المعلم</dt><dd>${t ? esc(t.name) : '<span class="chip warn">غير مسند</span>'}</dd><dt>أيام الدوام</dt><dd>${halqaDays(h.id).map(d => DAYN[d]).join('، ')}</dd><dt>الوقت</dt><dd>${h.time ? fmtTime(h.time) : '—'}</dd>
    <dt>الجدول</dt><dd>${h.auto ? '<span class="chip ok">ثابت، تنشأ الحصص لحالها</span>' : '<span class="chip">يدوي</span>'}</dd><dt>الرابط</dt><dd>${h.link ? `<span dir="ltr" class="small">${esc(h.link)}</span>` : '—'}</dd><dt>الطلاب</dt><dd class="num">${studentsOf(h.id).length}</dd></dl>
    <div class="row"><button class="btn sm" data-act="copy-reg" data-h="${h.id}">نسخ رابط التسجيل</button><button class="btn sm" data-act="handover" data-h="${h.id}">ملخص التسليم</button><button class="btn ghost sm" data-act="copy" data-text="https://${location.host}/api/ics/${h.id}.ics">رابط التقويم</button></div></section>`; }).join('')}</div>` : '<div class="empty">ما فيه حلقات. أنشئ أول حلقة وحدد معلمها وأيام دوامها.</div>'}`;
}

/* ---- reports ---- */
function reportsV(u) {
  const hs = myHalaqat(u);
  if (!hs.length) return `<h1>التقارير</h1><div class="empty">ما فيه حلقات.</div>`;
  const hid = hs.some(h => h.id === ST.halqa) ? ST.halqa : hs[0].id;
  const studs = studentsOf(hid); const from = rangeFrom(ST.range);
  const nSess = L('sessions').filter(s => s.halqaId === hid && !s.cancelled && s.date <= today() && (!from || s.date >= from)).length;
  const rows = studs.map(st => { const a = attStats(st, ST.range); const rs = recsOf(st.id).filter(r => !from || r.date >= from); const rep = rs.filter(r => r.pass === false).length; const sc = rs.filter(r => !r.quick); const avg = sc.length ? (sc.reduce((x, r) => x + (+r.mistakes || 0), 0) / sc.length).toFixed(1) : '—'; return { st, a, n: rs.length, rep, avg, pg: pagesSum(rs) }; });
  const tot = rows.reduce((x, r) => ({ p: x.p + r.a.p + r.a.l, m: x.m + r.a.p + r.a.l + r.a.a + r.a.e, n: x.n + r.n, pn: x.pn + r.pg.new, pr: x.pr + r.pg.review + r.pg.tath }), { p: 0, m: 0, n: 0, pn: 0, pr: 0 });
  const wk = weekStartC(today()); const board = studs.map(st => ({ st, p: ptsOf(st, wk, today()) })).sort((a, b) => b.p - a.p).slice(0, 5);
  return `<div class="sec-head"><h1>التقارير</h1><div class="row"><button class="btn" data-act="xlsx">⬇ Excel كامل</button>${S.waOn ? `<button class="btn pri" data-act="wa-week-h" data-h="${hid}">أرسل التقرير الأسبوعي تلقائيًا</button>` : ''}<button class="btn wa" data-act="wa-week" data-h="${hid}">${S.waOn ? 'إرسال يدوي' : 'التقرير الأسبوعي لأولياء الأمور'}</button></div></div>
  <div class="row"><select id="rp-h" data-change="filter-h" style="flex:0 1 220px">${hs.map(h => `<option value="${h.id}" ${h.id === hid ? 'selected' : ''}>${esc(h.name)}</option>`).join('')}</select>
  ${[7, 30, 90, 0].map(d => `<button class="btn sm ${ST.range === d ? 'pri' : ''}" data-act="range" data-d="${d}">${d ? 'آخر ' + d + ' يوم' : 'الكل'}</button>`).join('')}${(SET().terms || []).map(tm => `<button class="btn sm ${ST.range === 'T' + tm.id ? 'pri' : ''}" data-act="range" data-d="T${tm.id}">${esc(tm.name)}</button>`).join('')}</div>
  <div class="stats"><div class="stat"><b>${nSess}</b><span>حصة</span></div><div class="stat"><b>${tot.m ? Math.round(tot.p / tot.m * 100) + '٪' : '—'}</b><span>نسبة حضور الحلقة</span></div><div class="stat"><b>${tot.n}</b><span>تسميع مسجّل</span></div><div class="stat"><b>${fmtPages(tot.pn)}</b><span>أوجه حفظ</span></div><div class="stat"><b>${fmtPages(tot.pr)}</b><span>أوجه مراجعة</span></div></div>
  <section class="card">${rows.length ? `<div class="tbl-wrap"><table><thead><tr><th>الطالب</th><th class="num">حضور</th><th class="num">تأخر</th><th class="num">غياب</th><th class="num">استئذان</th><th class="num">النسبة</th><th class="num">تسميع</th><th class="num">أوجه حفظ</th><th class="num">أوجه مراجعة</th><th class="num">أعاد</th><th class="num">متوسط الأخطاء</th><th class="num">النقاط</th></tr></thead><tbody>
  ${rows.map(r => `<tr class="click" style="cursor:pointer" data-act="open-student" data-id="${r.st.id}"><td>${esc(r.st.name)}</td><td class="num">${r.a.p}</td><td class="num">${r.a.l}</td><td class="num">${r.a.a}</td><td class="num">${r.a.e}</td><td class="num"><span class="chip ${r.a.rate == null ? '' : r.a.rate >= 85 ? 'ok' : r.a.rate >= 65 ? 'warn' : 'bad'}">${r.a.rate == null ? '—' : r.a.rate + '٪'}</span></td><td class="num">${r.n}</td><td class="num">${fmtPages(r.pg.new)}</td><td class="num">${fmtPages(r.pg.review + r.pg.tath)}</td><td class="num">${r.rep}</td><td class="num">${r.avg}</td><td class="num">${ptsOf(r.st, from || '0000', today())}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">ما فيه طلاب في هذه الحلقة.</div>'}</section>
  ${u.role === 'admin' ? teachersReport(typeof ST.range === 'number' ? ST.range : 0) : ''}
  ${board.length ? `<section class="card"><h2>لوحة الشرف هالأسبوع</h2><ol class="board">${board.map(x => `<li><span>${esc(x.st.name)}</span><b class="num">${x.p}</b></li>`).join('')}</ol></section>` : ''}`;
}

/* ---- admin: settings ---- */
const SET_TABS = [
  ['rec', 'التسميع والتقدير', 'سلّم التقدير، قوالب الخطط، النقاط ولوحة الشرف'],
  ['days', 'الدوام والحضور', 'أيام الدوام، الفصول الدراسية، الإجازات وتنبيه الغياب'],
  ['reg', 'التسجيل', 'حقول نموذج تسجيل الطلاب الجدد'],
  ['msg', 'نصوص الرسائل', 'الرسائل الجاهزة لأولياء الأمور'],
  ['video', 'غرفة الحصة', 'الحصص بالفيديو داخل الموقع بدل Zoom وMeet'],
  ['ai', 'المساعد الذكي', 'مفتاح الذكاء الاصطناعي الخاص بالموقع'],
  ['site', 'إعدادات الموقع', 'الاسم، الفروع، حالة الخدمات، النسخ الاحتياطي'],
];
function settingsV() {
  const st = SET(); const hol = [...(st.holidays || [])].sort((a, b) => a.from.localeCompare(b.from));
  const full = isFullAdmin(me());
  const cur = SET_TABS.some(t => t[0] === ST.setTab) ? ST.setTab : 'rec';
  const P = k => k === cur ? '' : 'hidden';
  const H = (t, d) => `<div class="set-h"><h2>${t}</h2>${d ? `<span class="small muted">${d}</span>` : ''}</div>`;
  const saveBtn = `<div class="set-save"><button class="btn pri" type="submit">حفظ الإعدادات</button></div>`;
  return `<div><h1>الإعدادات</h1><div class="muted">${(SET_TABS.find(t => t[0] === cur) || [])[1] || ''}</div></div>
  <form class="card" data-form="settings" style="gap:18px" ${cur === 'video' || cur === 'ai' ? 'hidden' : ''}>
    <div class="set-pane" ${P('rec')}>${H('التسميع والتقدير', 'كيف يُحسب التقدير، ومقادير الخطط الجاهزة، ونقاط الطلاب')}
    <div class="fld"><span>سلّم التقدير بعدد الأخطاء</span>
      <div class="fgrid"><label class="fld"><span>ممتاز إذا الأخطاء حتى</span><input id="sg-ex" name="ex" type="number" min="0" value="${st.grade.ex}"></label><label class="fld"><span>جيد جدًا حتى</span><input id="sg-vg" name="vg" type="number" min="0" value="${st.grade.vg}"></label><label class="fld"><span>جيد حتى</span><input id="sg-gd" name="gd" type="number" min="0" value="${st.grade.gd}"></label><label class="fld"><span>كل كم تنبيه = خطأ</span><input id="sg-al" name="alertsPer" type="number" min="1" value="${st.grade.alertsPer}"></label></div>
</div>
    <div class="fld"><span>قوالب الخطط التلقائية</span><div class="tbl-wrap"><table class="fields-tbl"><thead><tr><th>الاسم</th><th class="num">حفظ</th><th class="num">مراجعة</th><th class="num">تثبيت</th><th></th></tr></thead><tbody>
      ${(st.planTpls || []).map((t, i) => `<tr><td><input id="pt-n-${i}" name="ptn-${i}" value="${esc(t.name)}" style="min-width:160px"></td><td><input id="pt-a-${i}" name="pta-${i}" type="number" min="0" step="0.125" value="${t.newAmt}" style="width:80px"></td><td><input id="pt-r-${i}" name="ptr-${i}" type="number" min="0" step="0.5" value="${t.revAmt}" style="width:80px"></td><td><input id="pt-t-${i}" name="ptt-${i}" type="number" min="0" step="0.5" value="${t.tathAmt}" style="width:80px"></td><td><button type="button" class="btn ghost sm" data-act="ptpl-del" data-i="${i}">حذف</button></td></tr>`).join('')}
    </tbody></table></div><div><button type="button" class="btn sm" data-act="ptpl-add">إضافة قالب</button></div><span class="hint">بالأوجه: 0.25 ربع، 0.5 نصف</span></div>
    <div class="fld"><span>النقاط التلقائية</span><div class="fgrid">${[['present', 'حضور'], ['late', 'تأخر'], ['ex', 'تسميع ممتاز'], ['vg', 'جيد جدًا'], ['gd', 'جيد'], ['page', 'لكل وجه حفظ'], ['absent', 'خصم: غياب بدون عذر'], ['bad', 'خصم: ملاحظة سلوك سلبية'], ['streak10', 'مكافأة كل 10 حصص متتالية'], ['streak30', 'مكافأة إضافية كل 30 حصة']].map(([k, l]) => `<label class="fld"><span>${l}</span><input id="sg-pt-${k}" name="pt-${k}" type="number" min="0" max="100" step="0.5" value="${(st.points || {})[k] ?? 0}"></label>`).join('')}</div></div>
    <label class="fld" style="max-width:320px"><span>وقت التسميع لكل طالب (دقائق)</span><input id="sg-recmin" name="recMin" type="number" min="0" max="60" value="${st.recMin || 0}"><span class="hint">ينبّه المعلم إذا تجاوز الطالب وقته. 0 = بدون تنبيه.</span></label>
    <label class="fld" style="max-width:320px"><span>يُحسب متأخر إذا وصل بعد كم دقيقة</span><input id="sg-latemin" name="lateMin" type="number" min="0" max="120" value="${st.lateMin ?? 10}"><span class="hint">في الحلقات الحضورية: لما المعلم يضغط «حاضر» يتسجّل وقت الوصول.</span></label>
    <label class="fld" style="max-width:320px"><span>لوحة الشرف عند الطلاب</span><select id="sg-board" name="board"><option value="show" ${st.board === 'show' ? 'selected' : ''}>أفضل 5 مع ترتيب الطالب</option><option value="top3" ${st.board === 'top3' ? 'selected' : ''}>أفضل 3 فقط</option><option value="hide" ${st.board === 'hide' ? 'selected' : ''}>مخفية: كل طالب يشوف نقاطه بس</option></select></label>
    </div>
    <div class="set-pane" ${P('days')}>${H('الدوام والحضور', 'الأيام الافتراضية للحلقات وفترات الدراسة')}
    <div class="fld"><span>أيام الدوام الافتراضية</span><div class="days">${DAYN.map((d, i) => `<label><input type="checkbox" id="sg-day-${i}" name="day" value="${i}" ${st.days.includes(i) ? 'checked' : ''}> ${d}</label>`).join('')}</div></div>
    <label class="fld" style="max-width:320px"><span>تنبيه الغياب المتكرر بعد كم غياب متتالي</span><input id="sg-abs" name="absentAlert" type="number" min="2" max="20" value="${st.absentAlert || 3}"></label>
    ${(() => { const o = { mode: 'prayer', prayer: 'asr', after: 90, time: '17:00', ...(st.teacherOut || {}) }; const PR = { fajr: 'الفجر', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء' }; const end = (S.dayEnd || {})._; const pr = S.pray || {};
      return `<div class="fld tout-set"><span>وقت انصراف المعلمين</span>
      <div class="small muted">المعلم يسجّل خروجه بنفسه، وإذا ما سجّل ينسجّل خروجه تلقائيًا عند هذا الوقت. ولو سجّل خروجه قبله يطلب منه تأكيد ويوصلك تنبيه.</div>
      <div class="fgrid"><label class="fld"><span>الطريقة</span><select id="sg-to-mode" name="to-mode"><option value="prayer" ${o.mode === 'prayer' ? 'selected' : ''}>بعد أذان صلاة بمدة (يتغير يوميًا)</option><option value="time" ${o.mode === 'time' ? 'selected' : ''}>وقت ثابت</option><option value="off" ${o.mode === 'off' ? 'selected' : ''}>بدون وقت انصراف</option></select></label>
      <label class="fld"><span>بعد أذان</span><select id="sg-to-prayer" name="to-prayer">${Object.entries(PR).map(([k, l]) => `<option value="${k}" ${o.prayer === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="fld"><span>بكم دقيقة</span><input id="sg-to-after" name="to-after" type="number" min="0" max="600" step="5" value="${o.after}" list="to-after-l"><datalist id="to-after-l"><option value="60"><option value="90"><option value="120"><option value="150"></datalist></label>
      <label class="fld"><span>الوقت الثابت</span><input id="sg-to-time" name="to-time" type="time" value="${esc(o.time)}"></label></div>
      ${o.mode !== 'off' && end ? `<div class="note small">اليوم: ${o.mode === 'prayer' && pr[o.prayer] ? `أذان ${PR[o.prayer]} ${fmtTime(pr[o.prayer])} ← ` : ''}الانصراف <b>${clock(end)}</b>. الأذان محسوب على موقع الجامع من «المجمعات»${Object.keys(st.places || {}).length ? '' : ' (ما تحدد للحين، فمحسوب على الرياض)'}.</div>` : ''}
      </div>`; })()}
    <div class="fld"><span>الفصول الدراسية</span><div class="tbl-wrap"><table class="fields-tbl"><thead><tr><th>الاسم</th><th>من</th><th>إلى</th><th></th></tr></thead><tbody>
      ${(st.terms || []).map((t, i) => `<tr><td><input id="tm-n-${i}" name="tmn-${i}" value="${esc(t.name)}" style="min-width:140px"></td><td><input id="tm-f-${i}" name="tmf-${i}" type="date" value="${t.from}"></td><td><input id="tm-t-${i}" name="tmt-${i}" type="date" value="${t.to}"></td><td><button type="button" class="btn ghost sm" data-act="term-del" data-i="${i}">حذف</button></td></tr>`).join('')}
    </tbody></table></div><div><button type="button" class="btn sm" data-act="term-add">إضافة فصل</button></div></div>
    </div>
    <div class="set-pane" ${P('reg')}>${H('نموذج التسجيل', 'وش يعبّي الطالب لما يسجل من رابط التسجيل')}
    <div class="fld"><span>حقول التسجيل</span>
      <div class="tbl-wrap"><table class="fields-tbl"><thead><tr><th>الحقل</th><th>النوع</th><th class="num">ظاهر</th><th class="num">إجباري</th><th></th></tr></thead><tbody>
      ${st.fields.map(f => `<tr><td><input id="sf-lb-${f.k}" name="lb-${f.k}" value="${esc(f.label)}" style="min-width:140px">${f.type === 'choice' ? `<input id="sf-op-${f.k}" name="opt-${f.k}" value="${esc((f.options || []).join('، '))}" placeholder="الخيارات مفصولة بفاصلة" style="margin-top:4px;min-width:140px"><label class="check small"><input type="checkbox" name="multi-${f.k}" ${f.multi ? 'checked' : ''}> أكثر من خيار</label>` : ''}</td><td class="small">${FTYPE[f.type || 'text'] || 'نص'}</td><td class="num"><input type="checkbox" id="sf-on-${f.k}" name="on-${f.k}" ${f.on ? 'checked' : ''}></td><td class="num"><input type="checkbox" id="sf-req-${f.k}" name="req-${f.k}" ${f.req ? 'checked' : ''}></td><td><button type="button" class="btn ghost sm" data-act="sf-del" data-k="${f.k}">حذف</button></td></tr>`).join('')}
      </tbody></table></div><div><button type="button" class="btn sm" data-act="sf-add">إضافة حقل</button></div></div>
    </div>
    <div class="set-pane" ${P('msg')}>${H('نصوص الرسائل', 'الرسائل الجاهزة اللي يرسلها المعلم لولي الأمر')}
    <div class="note small row"><span class="grow">الإرسال وربط الواتساب وسجل الرسائل صارت في قسم «رسائل الواتساب» بالقائمة.</span><button type="button" class="btn sm" data-act="go-wa" data-v="send">افتحه</button></div>
    <div class="fld"><span>رسائل واتساب لولي الأمر</span><span class="small muted" style="font-weight:400">استخدم {الطالب} و{الحلقة} و{التاريخ} وتنعبّى تلقائيًا.</span>
      <label class="fld"><span>رسالة الغياب</span><textarea id="sg-tA" name="absent" rows="3">${esc(st.tpl.absent)}</textarea></label>
      <label class="fld"><span>رسالة التميّز</span><textarea id="sg-tE" name="excellent" rows="3">${esc(st.tpl.excellent)}</textarea></label>
      ${(st.tpls || []).map((t, i) => `<div class="tpl-ed"><div class="row"><input id="tp-n-${i}" name="tpn-${i}" value="${esc(t.name)}" style="flex:0 1 200px" aria-label="اسم الرسالة"><button type="button" class="btn ghost sm" data-act="tpl-del" data-i="${i}">حذف</button></div><textarea id="tp-t-${i}" name="tpt-${i}" rows="2" aria-label="نص الرسالة">${esc(t.text)}</textarea></div>`).join('')}
      <div><button type="button" class="btn sm" data-act="tpl-add">إضافة رسالة جاهزة</button></div></div>
    </div>
    <div class="set-pane" ${P('site')}>${H('معلومات الموقع', 'تظهر للطلاب وأولياء الأمور')}
    <label class="fld"><span>اسم الحلقات أو المجمع</span><input id="sg-center" name="center" value="${esc(st.center)}" required></label>
    <div class="fgrid"><label class="fld"><span>جهة التواصل للطلاب وأولياء الأمور</span><input id="sg-sn" name="supportName" value="${esc(st.supportName || '')}" placeholder="مثال: إدارة الحلقة"></label><label class="fld"><span>رقم الواتساب للتواصل</span><input id="sg-sp" name="supportPhone" type="tel" dir="ltr" value="${esc(st.supportPhone || '')}" placeholder="05xxxxxxxx"></label></div>
    <label class="fld"><span>المجمعات أو الجوامع (كل واحد في سطر، اختياري، ومواقعها ومديريها من صفحة «المجمعات»)</span><textarea id="sg-br" name="branches" rows="3" placeholder="مسجد الرحمن
مسجد النور">${esc((st.branches || []).join('\n'))}</textarea></label>
    </div>
    ${saveBtn}
  </form>
    <section class="card" ${P('days')} style="display:grid;gap:12px"><div class="sec-head"><h2>الإجازات</h2><span class="small muted">ما تنشأ فيها حصص، والحصص التلقائية فيها تُلغى</span></div>
    ${hol.length ? `<div class="list">${hol.map((h, i) => `<div class="item"><div class="grow"><b>${esc(h.name)}</b> <span class="small muted">${fmtDateH(h.from)}${h.to !== h.from ? ' إلى ' + fmtDateH(h.to) : ''}</span></div>${h.to < today() ? '<span class="chip">انتهت</span>' : ''}<button class="btn ghost sm" data-act="hol-del" data-from="${h.from}" data-to="${h.to}">حذف</button></div>`).join('')}</div>` : '<div class="empty small">ما فيه إجازات مسجلة.</div>'}
    <form data-form="hol-add" class="fgrid" style="align-items:end"><label class="fld"><span>اسم الإجازة</span><input id="hl-name" name="name" required placeholder="مثال: إجازة عيد الفطر"></label><label class="fld"><span>من</span><input id="hl-from" name="from" type="date" required></label><label class="fld"><span>إلى</span><input id="hl-to" name="to" type="date"></label><button class="btn" type="submit">إضافة إجازة</button></form>
  </section>
  <section class="card" ${P('days')} style="display:grid;gap:12px"><div class="sec-head"><h2>الاختبارات والمناسبات</h2><span class="small muted">تظهر في تقويم الطلاب</span></div>
    ${(st.events || []).length ? `<div class="list">${(st.events || []).map((e, i) => ({ e, i })).sort((a, b) => a.e.date.localeCompare(b.e.date)).map(({ e, i }) => `<div class="item"><span class="chip ${e.kind === 'exam' ? 'bad' : 'acc'}">${e.kind === 'exam' ? 'اختبار' : 'مناسبة'}</span><div class="grow"><b>${esc(e.name)}</b> <span class="small muted">${fmtDateH(e.date)}</span></div><button class="btn ghost sm" data-act="ev-del" data-i="${i}">حذف</button></div>`).join('')}</div>` : ''}
    <form data-form="ev-add" class="fgrid" style="align-items:end"><label class="fld"><span>الاسم</span><input id="ev-name" name="name" required placeholder="مثال: اختبار جزء عمّ"></label><label class="fld"><span>التاريخ</span><input id="ev-date" name="date" type="date" required></label><label class="fld"><span>النوع</span><select id="ev-kind" name="kind"><option value="exam">اختبار</option><option value="event">مناسبة</option></select></label><button class="btn" type="submit">إضافة</button></form>
  </section>
  ${full && cur === 'video' ? videoSettingsHtml() : ''}
  ${full && cur === 'ai' ? aiSettingsHtml() : ''}
  ${full && cur === 'site' ? statusHtml() : ''}
  ${full && cur === 'site' ? backupHtml() : ''}
  ${full && cur === 'site' ? `<section class="card" style="display:grid;gap:10px"><h2>الربط مع Google Sheets</h2>${st.exportKey ? `<div class="small muted">الصق هذي في خلية بـ Google Sheets:</div>${['students', 'attendance', 'recs'].map(t => { const f = `=IMPORTDATA("https://${location.host}/api/export/${t}?key=${st.exportKey}")`; return `<div class="row"><span class="small" style="min-width:70px">${({ students: 'الطلاب', attendance: 'الحضور', recs: 'التسميع' })[t]}</span><code dir="ltr" class="code">${esc(f)}</code><button class="btn ghost sm" data-act="copy" data-text="${esc(f)}">نسخ</button></div>`; }).join('')}<div><button class="btn ghost sm" data-act="export-key">مفتاح جديد (يوقف الروابط القديمة)</button></div>` : '<div><button class="btn" data-act="export-key">توليد مفتاح التصدير</button></div>'}</section>` : ''}
  ${!full && (cur === 'site' || cur === 'video' || cur === 'ai') ? '<div class="note small">النسخ الاحتياطي وغرفة الحصة والمساعد للمدير الكامل فقط.</div>' : ''}`;
}

/* ---- student / parent home ---- */
function lessonCard(u, s) {
  if (isOnsiteL(s) && lessonMode(s) === 'onsite') {
    const h = S.halaqat[s.halqaId] || {}; const pl = placeOf(s.halqaId); const v = (s.att || {})[u.id]; const lf = (s.left || {})[u.id];
    return `<div class="join-card"><div class="grow"><div class="small muted">${s.date === today() ? 'حلقة اليوم' : 'الحلقة الجاية'}</div><h2>${fmtDateH(s.date)} · ${fmtTime(s.time)}</h2>
      <div class="cd" data-cd="${lessonTs(s)}">${cdText(lessonTs(s))}</div><div class="small">في ${esc(h.branch || SET().center || 'الجامع')}${h.place ? ' · ' + esc(h.place) : ''}</div>${s.note ? `<div class="small">${esc(s.note)}</div>` : ''}${v ? `<span class="chip ${ATTC[v]}">${ATT[v]}${v === 'l' && minsLate(s, u.id) ? ' ' + minsLate(s, u.id) + ' د' : ''}</span>` : ''}${lf ? `<span class="chip">انصرف ${clock(lf.at)}</span>` : ''}</div>
      ${pl ? `<div class="join-actions"><a class="btn" href="${mapUrl(pl)}" target="_blank" rel="noopener">الموقع على الخريطة</a></div>` : ''}</div>`;
  }
  const t = today(); const link = effLink(s); const j = S.joins[s.id + '_' + u.id]; const joined = j && !j.left;
  const isToday = s.date === t; const inQ = (s.queue || []).includes(u.id); const isCur = s.current === u.id;
  const pos = (s.queue || []).indexOf(u.id) + 1; const issue = (s.issues || {})[u.id];
  const qn = s.qnames || [];
  return `<div class="join-card"><div class="grow"><div class="small muted">${isToday ? 'حصة اليوم' : 'الحصة القادمة'}</div><h2>${fmtDateH(s.date)} · ${fmtTime(s.time)}</h2>
      <div class="cd" data-cd="${lessonTs(s)}">${cdText(lessonTs(s))}</div>${s.note ? `<div class="small">${esc(s.note)}</div>` : ''}${(s.att || {})[u.id] ? `<span class="chip ${ATTC[s.att[u.id]]}">${ATT[s.att[u.id]]}</span>` : ''}</div>
    <div class="join-actions">${link ? `<a class="btn pri big" href="${esc(link)}" target="_blank" rel="noopener" data-act="join" data-id="${s.id}">${j ? 'ادخل الحصة مرة ثانية' : 'ادخل الحصة'}</a>` : '<span class="chip warn">الرابط ينزل قبل الحصة</span>'}
      ${joined && isToday ? `<button class="btn" data-act="leave" data-id="${s.id}">خرجت من الحصة</button>` : ''}</div></div>
  ${isToday ? `<section class="card qcard" style="display:grid;gap:10px"><div class="sec-head"><h2>طابور التسميع</h2>${isCur ? '<span class="chip gold">دورك الآن</span>' : inQ ? `<span class="chip acc">ترتيبك ${pos}</span>` : ''}</div>
    ${isCur ? '<div class="now"><div class="name">دورك الآن، المعلم ينتظرك</div></div>' : inQ ? `<div class="row"><span>${pos === 1 ? 'أنت التالي، استعد.' : 'أنت في الطابور، قدّامك ' + (pos - 1) + ' ' + (pos - 1 === 1 ? 'طالب' : 'طلاب') + '.'}</span><button class="btn sm" data-act="ready" data-id="${s.id}" data-v="0">إلغاء الجاهزية</button></div>` : `<button class="btn pri" data-act="ready" data-id="${s.id}" data-v="1">جاهز للتسميع</button>`}
    ${s.cname || qn.length ? `<ol class="qscreen">${s.cname ? `<li class="cur"><span>يسمّع الآن</span> ${esc(s.cname)}</li>` : ''}${qn.map(x => `<li class="${x.id === u.id ? 'me' : ''}">${esc(x.n)}${x.id === u.id ? ' (أنت)' : ''}</li>`).join('')}</ol>` : '<div class="small muted">الطابور فاضي حاليًا.</div>'}
    <div class="row">${issue ? `<span class="chip warn">وصلت مشكلتك للمعلم: ${esc(issue.msg)}</span><button class="btn ghost sm" data-act="issue-cancel" data-id="${s.id}">انحلت</button>` : `<button class="btn ghost sm" data-act="issue-open" data-id="${s.id}">عندي مشكلة في الدخول</button>`}</div>
  </section>` : ''}`;
}
function homeV(u) {
  const t = today(); const hs = S.halaqat[u.halqaId];
  const sess = L('sessions').filter(s => s.halqaId === u.halqaId);
  const upcoming = sess.filter(s => s.date >= t).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const cancelledSoon = upcoming.filter(s => s.cancelled).slice(0, 2);
  const next = upcoming.find(s => !s.cancelled);
  const a = attStats(u, 30); const rs = recsOf(u.id); const pg = pagesSum(rs.filter(r => r.date >= addDays(t, -7)));
  const past = sess.filter(s => s.date <= t && !s.cancelled).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)).slice(0, 6);
  const vd = verseOfDay(t);
  return `<div><h1>السلام عليكم، ${esc((u.name || '').split(' ')[0])}</h1><div class="muted">${hs ? esc(hs.name) : ''} · ${fmtDateH(t)} · هذه الصفحة يتابع منها ولي الأمر أيضًا</div></div>
  ${parentSummary(u)}
  ${(() => { const w = u.wish && S.rewards[u.wish]; const b = balOf(u.id); return `<button class="st-chip" data-act="nav" data-v="store"><span>⭐ <b class="num">${b}</b> نقطة</span>${w ? `<span class="small">${b >= w.eff ? 'رصيدك يكفي لـ ' + esc(w.name) : 'باقي ' + (w.eff - b) + ' على ' + esc(w.name)}</span>` : '<span class="small">المتجر</span>'}</button>`; })()}
  ${studentPollsHtml(u)}
  ${afterLessonHtml(u)}
  <div class="verse"><span class="small muted">آية اليوم</span><p>﴿${vd[0]}﴾</p><span class="small muted">${vd[1]}</span></div>
  ${studentAnnsHtml(u)}
  ${cancelledSoon.map(s => `<div class="note">حصة ${fmtDate(s.date)} ملغاة${s.note ? ': ' + esc(s.note) : ''}.</div>`).join('')}
  ${liveSession(u) ? `<button class="live-cta" data-act="live-open"><span class="live-dot"></span><div class="grow"><b>الحصة قربت أو بدأت</b><span>افتح شاشة الحصة: الدخول وترتيبك في الطابور</span></div>${ICO.live}</button>` : ''}
  ${dueCard(u)}
  ${next ? lessonCard(u, next) : `<div class="empty">ما فيه حصة قادمة حاليًا.</div>`}
  <div class="grid2">
    <section class="card" style="display:grid;gap:12px"><div class="sec-head"><h2>خطتك</h2></div>${planHtml(u)}${goalHtml(u)}</section>
    ${tasksHtml(u)}
  </div>
  <div class="grid2">
    ${motivHtml(u)}
    <section class="card" style="display:grid;gap:12px"><h2>إنجازك</h2><div class="stats"><div class="stat"><b>${a.rate == null ? '—' : a.rate + '٪'}</b><span>الحضور، 30 يوم</span></div><div class="stat"><b>${a.a}</b><span>غياب</span></div><div class="stat"><b>${fmtPages(pg.new)}</b><span>أوجه حفظ هالأسبوع</span></div><div class="stat"><b>${fmtPages(pg.review + pg.tath)}</b><span>أوجه مراجعة هالأسبوع</span></div></div>
    ${past.length ? `<div class="list">${past.map(s => { const v = (s.att || {})[u.id]; return `<div class="item"><div class="grow">${fmtDate(s.date)}</div><span class="chip ${v ? ATTC[v] : ''}">${v ? ATT[v] : 'لم يُحضَّر'}</span></div>`; }).join('')}</div>` : ''}</section>
  </div>
  ${behavStudentHtml(u)}
  <section class="card"><h2>سجل التسميع</h2>${historyTable(rs)}</section>
  ${stickyJoin(u)}`;
}

/* ---- announcements ---- */
function annsV(u) {
  const hs = myHalaqat(u);
  const list = L('anns').sort((a, b) => b.at - a.at);
  return `<div class="sec-head"><h1>الإعلانات والتصويت</h1></div>
  <form class="card" data-form="ann" style="gap:10px"><h2>إعلان جديد</h2>
    <div class="fgrid"><label class="fld"><span>العنوان</span><input id="an-title" name="title" required maxlength="120" placeholder="مثال: تغيير موعد حصة الخميس"></label>
    <label class="fld"><span>لمين</span><select id="an-h" name="halqaId">${u.role === 'admin' ? '<option value="">كل الحلقات</option>' : ''}${hs.map(h => `<option value="${h.id}">${esc(h.name)}</option>`).join('')}</select></label></div>
    <label class="fld"><span>التفاصيل</span><textarea id="an-body" name="body" rows="3" maxlength="2000"></textarea></label>
    <div><button class="btn pri" type="submit">نشر الإعلان</button></div></form>
  ${staffPollsHtml(u)}
  ${list.length ? list.map(a => { const tg = annTargets(a); const rd = new Set((a.reads || []).map(r => r.uid)); const readers = tg.filter(x => rd.has(x.id)); const not = tg.filter(x => !rd.has(x.id));
    return `<section class="card" style="display:grid;gap:8px"><div class="sec-head"><div><h2>${esc(a.title)}</h2><div class="small muted">${a.halqaId ? esc(halqaName(a.halqaId)) : 'كل الحلقات'} · ${esc(a.byName)} · ${fmtDate(isoDate(new Date(a.at)))}</div></div><div class="row"><span class="chip ${readers.length === tg.length && tg.length ? 'ok' : 'warn'}">قرأه ${readers.length} من ${tg.length}</span><button class="btn ghost sm" data-act="ann-del" data-id="${a.id}">حذف</button></div></div>
      ${a.body ? `<div class="ann-body">${esc(a.body)}</div>` : ''}
      <details><summary class="small">مين قرأ ومين ما قرأ</summary><div class="fgrid small"><div><b>قرأ (${readers.length})</b><div>${readers.map(x => esc(x.name)).join('، ') || '—'}</div></div><div><b>ما قرأ (${not.length})</b><div>${not.map(x => esc(x.name)).join('، ') || '—'}</div></div></div></details></section>`; }).join('') : '<div class="empty">ما فيه إعلانات بعد.</div>'}`;
}
function studentAnnsHtml(u) {
  const list = L('anns').filter(a => !a.halqaId || a.halqaId === u.halqaId).sort((a, b) => b.at - a.at);
  const unread = list.filter(a => !(a.reads || []).some(r => r.uid === u.id));
  const read = list.filter(a => (a.reads || []).some(r => r.uid === u.id)).slice(0, 5);
  return unread.map(a => `<div class="ann-new"><div class="grow"><div class="small muted">إعلان · ${fmtDate(isoDate(new Date(a.at)))}</div><b>${esc(a.title)}</b>${a.body ? `<div class="ann-body">${esc(a.body)}</div>` : ''}</div><button class="btn pri sm" data-act="ann-read" data-id="${a.id}">قرأت</button></div>`).join('')
    + (read.length ? `<details class="card small"><summary>الإعلانات السابقة</summary><div class="list">${read.map(a => `<div class="item"><div class="grow"><b>${esc(a.title)}</b>${a.body ? `<div class="muted">${esc(a.body)}</div>` : ''}</div><span class="muted">${fmtDate(isoDate(new Date(a.at)))}</span></div>`).join('')}</div></details>` : '');
}

/* ---- student: tasks, motivation ---- */
function tasksHtml(u) {
  const t = today(); const w = wirdOf(u.id, t) || {}; const items = planGroups(u);
  const doneSet = new Set((w.items || []).filter(x => x.done).map(x => x.k));
  if (isPaused(u)) return `<section class="card"><h2>مهام اليوم</h2><div class="note">خطتك موقوفة مؤقتًا${u.plan.paused.reason ? ': ' + esc(u.plan.paused.reason) : ''}.</div></section>`;
  return `<form class="card" data-form="wird" style="gap:10px"><div class="sec-head"><h2>مهام اليوم</h2>${w.items ? '<span class="chip ok">محفوظة</span>' : ''}</div>
    ${items.length ? items.map((g, i) => { const k = groupKey(g); return `<label class="task"><input type="checkbox" id="wd-${i}" name="it" value="${esc(k)}" ${doneSet.has(k) ? 'checked' : ''}><span>${g.retry ? 'إعادة ' : ''}${g.type === 'new' ? 'احفظ' : 'راجع'} <b>${esc(partsText(g.parts))}</b>${g.parts.length > 1 && partsPages(g.parts) ? ` <span class="small muted">${partsPages(g.parts)}</span>` : ''}</span></label>${(() => { const n = repsOf(w, k); return `<div class="rep" data-k="${esc(k)}"><span class="rep-l">🔁 كررته</span><button type="button" class="rep-m" data-act="rep" data-k="${esc(k)}" data-d="-1" aria-label="أنقص التكرار" ${n ? '' : 'disabled'}>−</button><b class="num rep-n">${n}</b><button type="button" class="rep-p" data-act="rep" data-k="${esc(k)}" data-d="1" aria-label="زِد التكرار">+1</button></div>`; })()}`; }).join('') : '<div class="small muted">ما فيه مطلوب محدد اليوم.</div>'}
    <div class="row"><label class="fld" style="flex:0 1 200px"><span>ورد التلاوة اليوم (أوجه)</span><input id="wd-read" name="read" type="number" min="0" max="604" inputmode="numeric" value="${w.read || ''}"></label>
    <label class="fld" style="flex:1 1 200px"><span>ملاحظة (اختياري)</span><input id="wd-note" name="note" maxlength="200" value="${esc(w.note || '')}"></label></div>
    <div><button class="btn pri" type="submit">حفظ</button></div></form>`;
}
function motivHtml(u) {
  const B = S.board || {}; const streak = attendStreak(u); const bd = badgesOf(u);
  return `<section class="card" style="display:grid;gap:12px"><h2>نقاطك وإنجازاتك</h2>
    <div class="stats"><div class="stat"><b>${B.pts ?? 0}</b><span>نقاط هالأسبوع</span></div>${B.rank ? `<div class="stat"><b>${B.rank}</b><span>ترتيبك من ${B.total}</span></div>` : ''}<div class="stat streak-stat"><b>🔥 ${streak}</b><span>حصص متتالية حضرتها</span>${(() => { const nx = streakNext(streak); return nx ? `<i class="streak-bar"><i style="width:${Math.round((10 - nx.left) * 10)}%"></i></i><span class="small">باقي ${nx.left} ${nx.left === 1 ? 'حصة' : 'حصص'} على +${nx.pts} نقطة</span>` : ''; })()}</div></div>
    ${(B.top || []).length ? `<div><div class="small muted" style="font-weight:600">لوحة الشرف هالأسبوع</div><ol class="board">${B.top.map(x => `<li class="${x.me ? 'me' : ''}"><span>${esc(x.n)}</span><b class="num">${x.pts}</b></li>`).join('')}</ol></div>` : ''}
    ${bd.length ? `<div class="badges">${bd.map(b => `<span class="badge" title="${esc(b.d)}"><b>${esc(b.t)}</b><span>${esc(b.d)}</span></span>`).join('')}</div>` : '<div class="small muted">الأوسمة تظهر هنا مع التزامك وإتقانك.</div>'}
  </section>`;
}

/* ---- staff: WhatsApp helpers ---- */
function weekMsg(st) {
  const t = today(); const from = weekStartC(t);
  const ss = L('sessions').filter(s => s.halqaId === st.halqaId && !s.cancelled && s.date >= from && s.date <= t);
  const att = ss.map(s => (s.att || {})[st.id]); const pres = att.filter(v => v === 'p' || v === 'l').length; const abs = att.filter(v => v === 'a').length;
  const rs = recsOf(st.id).filter(r => r.date >= from); const pg = pagesSum(rs);
  const grades = rs.map(r => r.grade); const cnt = g => grades.filter(x => x === g).length;
  const o = `السلام عليكم ورحمة الله، تقرير ابنكم ${st.name} في ${halqaName(st.halqaId)} لهذا الأسبوع:
- الحضور: ${pres} من ${ss.length}${abs ? ' (غاب ' + abs + ')' : ''}
- الحفظ: ${fmtPages(pg.new)} وجه، والمراجعة والتثبيت: ${fmtPages(pg.review + pg.tath)} وجه
- التسميع: ${rs.length}${rs.length ? ' (ممتاز ' + cnt('ممتاز') + '، جيد جدًا ' + cnt('جيد جدًا') + '، جيد ' + cnt('جيد') + '، إعادة ' + cnt('يعاد') + ')' : ''}
- النقاط: ${ptsOf(st, from, t)}
جزاكم الله خيرًا على المتابعة.`;
  return femSt(st) ? femMsg(o) : o;
}
function waListModal(title, rows) {
  ST.sent = ST.sent || {};
  openModal(`${dlgHead(title)}${waAuto() ? `<div class="row"><span class="small muted grow">الرسائل تطلع من رقم الحلقة المربوط مباشرة.</span><button class="btn pri sm" data-act="wa-send-all">أرسل للكل</button></div>` : '<div class="small muted">اضغط على كل اسم يفتح واتساب برسالة جاهزة، وبعد الإرسال ارجع هنا للي بعده.</div>'}
  <div class="list">${rows.length ? rows.map(r => `<div class="item"><div class="grow"><b>${esc(r.name)}</b>${r.sub ? `<div class="small muted">${esc(r.sub)}</div>` : ''}</div>${r.link ? `<a class="btn wa sm ${ST.sent[r.key] ? 'sent' : ''}" href="${r.link}" target="_blank" rel="noopener" data-act="mark-sent" data-k="${esc(r.key)}">${ST.sent[r.key] ? 'أُرسل ✓' : 'إرسال'}</a>` : '<span class="chip warn">ما فيه رقم</span>'}</div>`).join('') : '<div class="empty small">ما فيه أحد.</div>'}</div>`);
}
function tplPickModal(st) {
  const v = { student: st.name, halqa: halqaName(st.halqaId), date: fmtDate(today()), fem: femSt(st) };
  openModal(`${dlgHead('رسالة لولي أمر ' + esc(st.name))}<div class="list">
    ${[...allTpls(), { id: 'week', name: 'التقرير الأسبوعي', text: weekMsg(st) }].map(t => { const txt = t.id === 'week' ? t.text : fillTpl(t.text, v); const l = waLink(st.parentPhone, txt); return `<div class="item"><div class="grow"><b>${esc(t.name)}</b><div class="small muted tpl-prev">${esc(txt)}</div></div>${l ? `<a class="btn wa sm" href="${l}" target="_blank" rel="noopener">إرسال</a>` : ''}</div>`; }).join('')}
    <div class="item"><div class="grow"><b>رسالة فاضية</b></div><a class="btn wa sm" href="${waLink(st.parentPhone, 'السلام عليكم ورحمة الله، ')}" target="_blank" rel="noopener">فتح</a></div>
  </div>${aiPmHtml(st)}`);
}
function tplApplyModal(u) {
  const hs = myHalaqat(u); const hids = hs.map(h => h.id);
  const studs = L('users').filter(x => x.role === 'student' && x.status === 'active' && hids.includes(x.halqaId) && (!ST.halqa || x.halqaId === ST.halqa)).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
  const tp = SET().planTpls || [];
  if (!tp.length) return toast('أضف قوالب الخطط من الإعدادات أولًا');
  openModal(`${dlgHead('تطبيق قالب خطة على عدة طلاب')}<form data-form="tpl-apply">
    <label class="fld"><span>القالب</span><select name="tpl">${tp.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></label>
    <div class="small muted">يتغير مقدار الحفظ والمراجعة والتثبيت، ويبقى موضع كل طالب وحفظه السابق كما هو، وتصير خطته تلقائية.</div>
    <div class="row"><button type="button" class="btn ghost sm" data-act="chk-all">تحديد الكل</button></div>
    <div class="list chk-list">${studs.map(x => `<label class="item check"><input type="checkbox" name="ids" value="${x.id}"> ${esc(x.name)}<span class="small muted">${esc(halqaName(x.halqaId))}</span></label>`).join('')}</div>
    <div class="dlg-foot"><button class="btn pri" type="submit">تطبيق</button></div></form>`);
}
function goalModal(st) {
  const g = st.goal || {};
  openModal(`${dlgHead('هدف ' + esc(st.name))}<form data-form="goal" data-id="${st.id}">
    <div class="fgrid"><label class="fld"><span>عدد أوجه الحفظ</span><input name="pages" type="number" min="0.25" step="0.25" value="${g.pages || ''}" required></label>
    <label class="fld"><span>يبدأ الحساب من</span><input name="from" type="date" value="${g.from || today()}"></label>
    <label class="fld"><span>قبل تاريخ (اختياري)</span><input name="by" type="date" value="${g.by || ''}"></label></div>
    ${(SET().terms || []).length ? `<label class="fld"><span>أو اختر فصل</span><select data-change="goal-term"><option value="">—</option>${SET().terms.map(t => `<option value="${t.from}|${t.to}">${esc(t.name)}</option>`).join('')}</select></label>` : ''}
    <label class="fld"><span>ملاحظة (اختياري)</span><input name="note" maxlength="120" value="${esc(g.note || '')}" placeholder="مثال: ختم جزء عمّ قبل رمضان"></label>
    <div class="dlg-foot"><button class="btn pri" type="submit">حفظ الهدف</button>${st.goal ? '<button type="button" class="btn danger" data-act="goal-del" data-id="' + st.id + '">حذف الهدف</button>' : ''}</div></form>`);
}
function searchModal() {
  openModal(`${dlgHead('بحث')}<input id="gs-q" data-input="gsearch" placeholder="اسم الطالب أو اسم المستخدم" autocomplete="off"><div id="gs-res" class="list"></div>`);
}
function searchResults(q) {
  q = q.trim().toLowerCase(); const u = me(); const hids = myHalaqat(u).map(h => h.id);
  if (!q) return '';
  const st = L('users').filter(x => x.role === 'student' && x.status !== 'pending' && (u.role === 'admin' || hids.includes(x.halqaId)) && ((x.name || '').toLowerCase().includes(q) || (x.username || '').includes(q))).slice(0, 12);
  const hs = myHalaqat(u).filter(h => (h.name || '').toLowerCase().includes(q)).slice(0, 5);
  return st.map(x => `<div class="item click" data-act="gs-open" data-id="${x.id}"><div class="grow"><b>${esc(x.name)}</b><div class="small muted">${esc(halqaName(x.halqaId))}${x.status === 'archived' ? ' · مؤرشف' : ''}</div></div></div>`).join('')
    + hs.map(h => `<div class="item click" data-act="gs-halqa" data-id="${h.id}"><div class="grow"><b>${esc(h.name)}</b><div class="small muted">حلقة</div></div></div>`).join('') || '<div class="small muted" style="padding:8px">ما فيه نتائج.</div>';
}

/* ---------------- phase 3 ---------------- */
const PERM_LABEL = { req: 'طلبات التسجيل', students: 'الطلاب', teachers: 'المعلمون', halaqat: 'الحلقات', anns: 'الإعلانات', reports: 'التقارير', store: 'المتجر والنقاط', settings: 'الإعدادات', logs: 'سجل العمليات' };
const PRESETS = { 'مدير مجمع': ['req', 'students', 'teachers', 'halaqat', 'anns', 'reports', 'store', 'logs'], 'مشرف تعليمي': ['students', 'anns', 'reports', 'halaqat'], 'مسؤول تسجيل': ['req', 'students'], 'مشرف عام': ['req', 'students', 'teachers', 'halaqat', 'anns', 'reports', 'logs'] };
const isFullAdmin = u => u.role === 'admin' && !u.perms;
const can = (u, perm) => u.role === 'admin' && (!u.perms || u.perms.includes(perm));
const TAB_PERM = { req: 'req', students: 'students', inbox: 'students', teachers: 'teachers', halaqat: 'halaqat', anns: 'anns', reports: 'reports', settings: 'settings', logs: 'logs', store: 'store' };
const subName = id => (S.users[id] || {}).name || '';
function msgsUnread(u) { let seen = 0; try { seen = +localStorage.getItem('irtaq-room-' + u.id) || 0; } catch {} return L('msgs').filter(m => m.at > seen && m.by !== u.id).length; }

/* ---- لوحة المدير ---- */
function dashV(u) {
  const t = today(); const hs = myHalaqat(u); const hset = new Set(hs.map(h => h.id)); const studs = L('users').filter(x => x.role === 'student' && x.status === 'active' && hset.has(x.halqaId));
  const todayL = L('sessions').filter(s => s.date === t && !s.cancelled && hset.has(s.halqaId));
  const wk = weekStartC(t); const recsW = L('recs').filter(r => r.date >= wk && hset.has(r.halqaId || (S.users[r.uid] || {}).halqaId));
  const pend = L('users').filter(x => x.role === 'student' && x.status === 'pending').length;
  const marked = todayL.flatMap(s => Object.values(s.att || {})); const pres = marked.filter(v => v === 'p' || v === 'l').length;
  const stuck = studs.filter(st => { const rs = recsOf(st.id).filter(r => r.date >= addDays(t, -14)); return rs.length ? rs.filter(r => r.pass === false).length >= 2 : (st.approvedAt && st.approvedAt < Date.now() - 14 * 864e5); });
  const issues = todayL.flatMap(s => Object.entries(s.issues || {}).map(([id, x]) => ({ s, id, x })));
  const pg = pagesSum(recsW);
  return `<h1>لوحة المدير</h1><div class="muted">${fmtDateH(t)}</div>
  ${todayAlertsHtml(u)}
  <div class="stats"><div class="stat"><b>${studs.length}</b><span>طالب نشط</span></div><div class="stat"><b>${hs.length}</b><span>حلقة</span></div><div class="stat"><b>${todayL.length}</b><span>حصص اليوم</span></div><div class="stat"><b>${marked.length ? Math.round(pres / marked.length * 100) + '٪' : '—'}</b><span>حضور اليوم</span></div><div class="stat"><b>${recsW.length}</b><span>تسميع هالأسبوع</span></div><div class="stat"><b>${fmtPages(pg.new)}</b><span>أوجه حفظ هالأسبوع</span></div></div>
  ${pend ? `<div class="note"><b>${pend}</b> طلب تسجيل ينتظر الاعتماد. <button class="btn sm" data-act="tab" data-v="req">اعرضها</button></div>` : ''}
  ${issues.length ? `<div class="note bad-note"><b>مشاكل دخول الآن:</b> ${issues.map(o => esc(subName(o.id)) + ' (' + esc(halqaName(o.s.halqaId)) + ')').join('، ')}</div>` : ''}
  ${todayBoardHtml(u) || '<section class="card"><h2>حصص اليوم</h2><div class="empty small">ما فيه حصص اليوم.</div></section>'}
  <div class="grid2">${absentAlertsHtml(hs.map(h => h.id)) || '<section class="card"><h2>تنبيه الغياب المتكرر</h2><div class="empty small">ما فيه أحد.</div></section>'}
  <section class="card"><h2>يحتاجون متابعة</h2><div class="small muted">أعادوا مرتين أو أكثر آخر أسبوعين، أو ما سمّعوا من أسبوعين</div>${stuck.length ? `<div class="list">${stuck.slice(0, 15).map(x => `<div class="item click" data-act="open-student" data-id="${x.id}"><div class="grow"><b>${esc(x.name)}</b><div class="small muted">${esc(halqaName(x.halqaId))}</div></div></div>`).join('')}</div>` : '<div class="empty small">ما فيه أحد.</div>'}</section></div>
  ${teachersReport(30)}`;
}
function teachersReport(days) {
  const from = days ? addDays(today(), -days) : '0000';
  const ts = L('users').filter(x => x.role === 'teacher');
  if (!ts.length) return '';
  const rows = ts.map(t => {
    const own = L('sessions').filter(s => !s.cancelled && s.date >= from && s.date <= today() && lessonTs(s) < Date.now() && ((S.halaqat[s.halqaId] || {}).teacherId === t.id && !s.subId || s.subId === t.id));
    const opened = own.filter(s => s.teacherAt && s.teacherBy === t.id); const late = opened.filter(s => s.time && s.teacherAt - lessonTs(s) > 10 * 60000).length;
    const recs = L('recs').filter(r => r.by === t.id && r.date >= from);
    const studs = L('users').filter(x => x.role === 'student' && x.status === 'active' && (S.halaqat[x.halqaId] || {}).teacherId === t.id);
    const pg = pagesSum(recs);
    return { t, n: own.length, op: opened.length, late, recs: recs.length, studs: studs.length, pg };
  });
  return `<section class="card"><h2>تقرير المعلمين${days ? ' · آخر ' + days + ' يوم' : ''}</h2><div class="tbl-wrap"><table><thead><tr><th>المعلم</th><th class="num">طلابه</th><th class="num">حصص مرّت</th><th class="num">فتحها</th><th class="num">تأخر +10د</th><th class="num">تسميع سجّله</th><th class="num">أوجه حفظ</th><th class="num">أوجه مراجعة</th></tr></thead><tbody>
  ${rows.map(r => `<tr><td>${esc(r.t.name)}${r.t.status === 'disabled' ? ' <span class="chip bad">موقوف</span>' : ''}</td><td class="num">${r.studs}</td><td class="num">${r.n}</td><td class="num"><span class="chip ${r.n && r.op < r.n ? 'warn' : 'ok'}">${r.op}</span></td><td class="num">${r.late}</td><td class="num">${r.recs}</td><td class="num">${fmtPages(r.pg.new)}</td><td class="num">${fmtPages(r.pg.review + r.pg.tath)}</td></tr>`).join('')}</tbody></table></div>
  <div class="small muted">«فتحها» يعني المعلم دخل صفحة الحصة يومها من حسابه، وهذا حضوره.</div></section>`;
}

/* ---- غرفة المعلمين ---- */
function roomV(u) {
  const rs = inGirls() ? 'f' : 'm';
  const ms = L('msgs').sort((a, b) => a.at - b.at);
  try { localStorage.setItem('irtaq-room-' + u.id, String(Date.now())); } catch {}
  return `<h1>${rs === 'f' ? 'غرفة المعلمات' : 'غرفة المعلمين'}</h1><div class="small muted">${rs === 'f' ? 'لمعلمات وإدارة قسم البنات فقط.' : 'للمعلمين والإدارة فقط، الطلاب ما يشوفونها.'}</div>
  <section class="card room">${ms.length ? ms.map(m => `<div class="msg ${m.by === u.id ? 'mine' : ''}"><div class="small muted">${esc(m.byName)} · ${fmtDate(isoDate(new Date(m.at)))} ${clock(m.at)}${m.by === u.id || u.role === 'admin' ? ` <button class="linkbtn" data-act="msg-del" data-id="${m.id}">حذف</button>` : ''}</div><div class="ann-body">${esc(m.text)}</div></div>`).join('') : '<div class="empty small">ما فيه رسائل بعد.</div>'}</section>
  <form class="card" data-form="msg" style="gap:8px"><textarea id="rm-text" name="text" rows="2" maxlength="1000" placeholder="اكتب رسالة…" required></textarea><div><button class="btn pri" type="submit">إرسال</button></div></form>`;
}

/* ---- سجل العمليات ---- */
function logsV() {
  if (!ST.logs && !ST.logsLoading) { ST.logsLoading = true; act('log.list', {}).then(r => { ST.logsLoading = false; ST.logs = (r && r.rows) || []; render(); }); }
  const q = (ST.logQ || '').trim();
  const rows = (ST.logs || []).filter(x => !q || x.text.includes(q) || (x.by || '').includes(q));
  return `<div class="sec-head"><h1>سجل العمليات</h1><button class="btn sm" data-act="logs-refresh">تحديث</button></div>
  <input id="lg-q" data-input="logq" placeholder="ابحث في السجل" value="${esc(q)}">
  <section class="card">${!ST.logs ? '<div class="row"><div class="spin"></div></div>' : rows.length ? `<div class="list">${rows.map(x => `<div class="item"><div class="grow">${esc(x.text)}<div class="small muted">${esc(x.by || '—')} · ${fmtDate(isoDate(new Date(x.at)))} ${clock(x.at)}</div></div></div>`).join('')}</div>` : '<div class="empty small">ما فيه عمليات.</div>'}</section>`;
}

/* ---- تقويم الحصص ---- */
function calendarHtml(ids) {
  const base = ST.calMonth || today().slice(0, 7); const [y, m] = base.split('-').map(Number);
  const first = new Date(y, m - 1, 1); const days = new Date(y, m, 0).getDate(); const lead = first.getDay();
  const ss = L('sessions').filter(s => ids.includes(s.halqaId) && s.date.startsWith(base));
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push('<div class="cal-c empty"></div>');
  for (let d = 1; d <= days; d++) {
    const ds = base + '-' + pad(d); const dl = ss.filter(s => s.date === ds).sort((a, b) => a.time.localeCompare(b.time)); const hol = (SET().holidays || []).find(h => ds >= h.from && ds <= h.to);
    cells.push(`<div class="cal-c ${ds === today() ? 'today' : ''} ${hol ? 'hol' : ''}"><div class="cal-d"><b>${d}</b><span>${hijri(ds).split(' ')[0] || ''}</span></div>${hol ? `<div class="cal-h">${esc(hol.name)}</div>` : ''}${dl.map(s => `<button class="cal-e ${s.cancelled ? 'x' : ''}" data-act="open-session" data-id="${s.id}">${fmtTime(s.time)} ${ids.length > 1 ? esc(halqaName(s.halqaId)) : ''}</button>`).join('')}</div>`);
  }
  const prev = isoDate(new Date(y, m - 2, 1)).slice(0, 7), next = isoDate(new Date(y, m, 1)).slice(0, 7);
  return `<section class="card" style="display:grid;gap:10px"><div class="sec-head"><button class="btn sm" data-act="cal-m" data-v="${prev}">→ السابق</button><h2>${new Intl.DateTimeFormat('ar', { month: 'long', year: 'numeric' }).format(first)}</h2><button class="btn sm" data-act="cal-m" data-v="${next}">التالي ←</button></div>
  <div class="tbl-wrap"><div class="cal">${DAYN.map(d => `<div class="cal-hd">${d}</div>`).join('')}${cells.join('')}</div></div></section>`;
}

/* ---- ملخص تسليم الحلقة ---- */
function handoverText(hid) {
  const h = S.halaqat[hid] || {}; const t = today();
  const lines = [`ملخص حلقة ${h.name} · ${fmtDate(t)}`, `أيام الدوام: ${halqaDays(hid).map(d => DAYN[d]).join('، ')} · الوقت: ${fmtTime(h.time) || '—'}`, `الرابط: ${h.link || '—'}`, ''];
  studentsOf(hid).forEach((st, i) => {
    const items = planItems(st); const rs = recsOf(st.id).slice(0, 3); const a = attStats(st, 30);
    lines.push(`${i + 1}. ${st.name}${st.parentPhone ? ' · ولي الأمر: ' + st.parentPhone : ''}`);
    lines.push(`   الخطة: ${isAuto(st) ? 'تلقائية' : 'يدوية'}${isPaused(st) ? ' (موقوفة)' : ''} · المطلوب: ${items.length ? planGroups(st).map(groupLabel).join('، ') : 'ما حُدّد'}`);
    lines.push(`   الحضور آخر 30 يوم: ${a.rate == null ? '—' : a.rate + '٪'} · آخر تسميع: ${rs.length ? rs.map(r => `${fmtDate(r.date)} ${SN[r.surah - 1]} ${r.from}-${r.to} (${r.grade})`).join(' | ') : '—'}`);
    const g = goalProgress(st); if (g) lines.push(`   الهدف: ${fmtPages(g.done)} من ${fmtPages(g.pages)} وجه`);
  });
  return lines.join('\n');
}

/* ---- الدليل ---- */
function helpV(u) {
  const host = location.host; const hid = u.halqaId || (myHalaqat(u)[0] || {}).id;
  const sec = (t, body) => `<section class="card help"><h2>${t}</h2>${body}</section>`;
  const ol = arr => `<ol>${arr.map(x => `<li>${x}</li>`).join('')}</ol>`;
  const install = sec('ثبّت الموقع كتطبيق', `${INSTALL_EVT ? '<button class="btn pri" data-act="install">تثبيت الآن</button>' : ''}${ol(['<b>آيفون:</b> افتح الموقع في Safari، اضغط زر المشاركة، ثم «إضافة إلى الشاشة الرئيسية».', '<b>أندرويد:</b> من قائمة Chrome (⋮) اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».'])}`);
  const notif = S.push ? sec('الإشعارات', `${ol(['اضغط «الإشعارات» فوق، ووافق على السماح.', 'في الآيفون: لازم تثبت الموقع على الشاشة الرئيسية أول، وبعدها تفعّل الإشعارات من داخله.', 'توصلك: تذكير قبل الحصة، و«دورك قرب» و«دورك الآن» في الطابور، والإعلانات.'])}`) : '';
  const cal = hid ? sec('مواعيد الحلقة في تقويم جوالك', `<p>يضيف حصص الحلقة لتقويم الجوال مع تنبيه قبلها بربع ساعة، ويتحدث لحاله.</p><div class="row"><a class="btn" href="webcal://${host}/api/ics/${hid}.ics">إضافة للتقويم</a><button class="btn ghost" data-act="copy" data-text="https://${host}/api/ics/${hid}.ics">نسخ الرابط</button></div>`) : '';
  const sub = (t, arr) => `<details class="card help"><summary><h2>${t}</h2></summary>${ol(arr)}</details>`;
  if (u.role === 'student') return `<h1>الدليل</h1>
    <div class="row"><button class="btn pri" data-act="tour">الجولة التعريفية</button>${supportBtn('تواصل مع الإدارة')}</div>
    ${sub('يوم الحصة', ['افتح الموقع قبل الحصة، وتشوف العدّاد في صفحتك.', 'اضغط «الحصة» تحت أو «ادخل الحصة». أول مرة ممكن يطلب تثبيت Zoom أو Meet، ثبته وارجع اضغط مرة ثانية.', 'شاشة الحصة تعرض ترتيبك في الطابور وتتحدث لحالها، والجوال يهتز لما تكون التالي ولما يجي دورك.', 'إذا صرت جاهز تسمّع اضغط «جاهز للتسميع».', 'ما قدرت تدخل؟ اضغط «عندي مشكلة في الدخول» واختر المشكلة، وتوصل للمعلم.', 'بعد الحصة يطلع لك «ملخص الحصة»: وش سمّعت، تقديرك، والمطلوب للحصة الجاية.'])}
    ${sub('الخطة والبيت', ['«خطتك» فيها الحفظ والمراجعة والتثبيت، وتتحدث لحالها بعد ما يسجل المعلم تسميعك.', 'الصفحات حسب مصحف المدينة النبوية من مجمع الملك فهد.', '«إعادة» معناها تعيد المقطع في الحصة الجاية لين تنجح فيه.', 'في «مهام اليوم» علّم على اللي خلصته في البيت، واكتب كم وجه قرأت، واضغط حفظ. المعلم يشوفها قبل الحصة.', 'نقاطك تزيد مع الحضور والتسميع الممتاز والحفظ.'])}
    ${sub('المعلم والتقويم والتصويت', ['من «المعلم» تراسل معلم الحلقة، والرد يوصلك هنا مع إشعار.', '«ملاحظة سريعة لحصة اليوم» مثل: تعبان أو بيتأخر، وتطلع للمعلم جنب اسمك في التحضير.', '«التقويم» فيه أيام الحصص وحضورك، والإجازات، والاختبارات.', 'إذا فيه تصويت يطلع في أعلى صفحتك، اختر وتقدر تغيّر صوتك لين ينقفل.', 'المساعد الذكي (الزر الدائري تحت): اسأله عن المطلوب منك وحصصك وتسميعك، أو كيف تحفظ وتراجع. ويسوي عنك اللي تقدر تسويه في الموقع: يراسل المعلم، يرسل استئذان، يصوّت، يسجل مهام اليوم، ويدخلك طابور التسميع. يجهزها وأنت تضغط «تنفيذ».'])}
    ${sub('لولي الأمر', ['ادخل بحساب ولدك نفسه، ما يحتاج حساب ثاني.', '«ملخص سريع» فوق يوضح حضوره اليوم وآخر تقدير.', 'عندك أكثر من ولد؟ من «المزيد» اضغط «إضافة ابن» مرة وحدة، وبعدها «أولادي» يعرض ملخصهم كلهم في شاشة وحدة وتنتقل بينهم.', 'زر «English» يعرض الصفحة بالإنجليزي، و«تكبير الخط» يكبّر الكلام.'])}
    ${sub('نقاطي والمتجر', ['نقاطك تزيد مع الحضور في الوقت، والتسميع الممتاز، وكل وجه حفظ جديد.', '🔥 سلسلة الحضور: كل 10 حصص متتالية تحضرها تاخذ نقاط مكافأة، والغياب بدون عذر يرجّع العداد من الصفر.', '🔁 في «مهام اليوم» اضغط +1 كل ما كررت المقطع في البيت، ومعلمك يشوف كم كررت.', 'من «المتجر» تشوف رصيدك والجوائز، وتقدر تحط جائزة في «أمنيتي» وتشوف كم باقي لك عليها.', 'لما تطلب جائزة يطلع لك كود من 4 أرقام، تعطيه المعلم أو الإدارة وتستلمها.', 'في المزاد الشهري تزايد بنقاطك، والأعلى وقت الإغلاق يفوز.', 'في الحلقة الحضورية ما تحتاج جوالك: المعلم يحضّرك ويسجل تسميعك ويطلب الجائزة عنك.'])}
    ${cal}${install}${notif}
    <section class="card help"><h2>أسئلة شائعة</h2>${FAQ.map(([q, a]) => `<details class="faq"><summary>${q}</summary><p>${a}</p></details>`).join('')}</section>`;
  const teacher = sub('للمعلم', ['الحصص تنشأ لحالها إذا الحلقة على «جدول ثابت». افتح حصة اليوم من «الحصص».', 'فوق صفحة الحصة ثلاث أدوات: «وضع التسميع» بأزرار كبيرة، و«التحضير بالسحب» (يمين حاضر، يسار غائب)، و«لوحة الحصة» تعرض مين داخل ومين جاهز ومين عنده مشكلة.', 'في الطابور: «التالي» ينقل للطالب اللي بعده، و«ما رد» يرجع الطالب لآخر الطابور.', 'إذا حدد المدير وقت لكل طالب، العداد يبدأ لحاله وينبهك لما يخلص الوقت.', '«ملخص الحصة» يعرض مين حضر وما سمّع، ومين ما دخل بعد 10 دقائق. ويوصلك إشعار بأسماء اللي ما دخلوا.', 'ملاحظات أولياء الأمور لليوم (مثل: تعبان) تطلع جنب اسم الطالب في التحضير.', '«الرسائل»: كل رسائل أولياء الأمور، والرد يوصلهم مع إشعار.', 'من صفحة الطالب: الخطة والهدف، و«السلوك» (ملاحظة إيجابية أو تنبيه، وتحدد إذا يشوفها ولي الأمر)، ورسائل الواتساب.', 'التصويت من «الإعلانات والتصويت»: سؤال وخيارات لحلقتك، وتشوف مين صوّت ومين لا.', 'إذا ربط الواتساب شغال، أزرار «إرسال» لولي الأمر ترسل من رقم الحلقة مباشرة.', '«رسائل الواتساب» في القائمة: اختر الطلاب (أو «غابوا اليوم») واكتب الرسالة أو اختر رسالة جاهزة، وتنرسل لأولياء أمورهم مرة وحدة. ومنها ترسل التقرير الأسبوعي لحلقتك.', 'المساعد الذكي (الزر الدائري تحت يسار، أو Ctrl+J): يسوي عنك أي شي تقدر عليه في الموقع إلا الحذف — تحضير، تسجيل تسميع، خطط وأهداف، رسائل وواتساب لأولياء الأمور، إعلانات وتصويت، حصص إضافية أو إلغاء — ويجاوبك عن طلابك. يجهز كل شي في بطاقة وأنت تضغط «تنفيذ».', 'في «واتساب ولي الأمر» بصفحة الطالب: «اكتبها لي بالذكاء» يكتب رسالة من حضوره وتسميعه بالنبرة اللي تختارها.']);
  const admin = u.role === 'admin' ? sub('للمدير', ['أنشئ الحلقات وفعّل «جدول ثابت» وحط الرابط الثابت.', 'أضف المعلمين، و«جدول الأسبوع» في صفحة المعلمين يعرض الحلقات بالأيام. اسحب الحلقة لصف معلم ثاني عشان تنقلها له، أو اضغط عليها في الجوال.', 'المشرفين الإداريين: حدد صلاحياتهم، ومن «يتابع» اختر حلقات أو فروع محددة، ويشوف المشرف حلقاته بس.', 'الفروع: اكتبها في الإعدادات ← إعدادات الموقع، وبعدها اختر فرع كل حلقة. يطلع فوق الصفحات شريط تختار منه الفرع.', 'الطلاب: «استيراد» يضيف طلاب من ملف إكسل أو جدول تلصقه، ويعطيك أسماء المستخدمين وكلمات المرور ترسلها لأولياء الأمور.', '«منقطعين أسبوعين» في صفحة الطلاب: اللي ما فتحوا الموقع من أسبوعين.', 'أرسل رابط التسجيل لكل حلقة، واعتمد الطلبات من «الطلبات».', '«رسائل الواتساب» في القائمة: ترسل لأولياء أمور مجموعة طلاب مرة وحدة (برسالة جاهزة أو التقرير الأسبوعي)، وفيها سجل الرسائل والربط.', 'الإعدادات مقسمة: التسميع والتقدير، الدوام والحضور (الإجازات والاختبارات)، التسجيل، نصوص الرسائل، غرفة الحصة، إعدادات الموقع.', 'لتكليف معلم احتياط: افتح الحصة ← تعديل ← المعلم الاحتياط.', 'المساعد الذكي عند المدير يقدر كمان (حسب صلاحياتك): يعتمد طلبات التسجيل، يضيف ويعدّل الطلاب والمعلمين والحلقات، ينقل طلاب، يعدّل الإعدادات والرسائل التلقائية، ويعطي كلمة مرور مؤقتة. الحذف ما يسويه أبدًا.']) +
    (isFullAdmin(u) ? sub('الواتساب وغرفة الحصة', ['الواتساب: رسائل الواتساب ← الربط والرسائل التلقائية ← الربط السريع، تدخل بحسابك في الواتس الذكي وتضغط «اربط» ثم حفظ. تأكد قبلها إن جوالك مربوط هناك.', 'الرسائل التلقائية تنرسل بعد مهلة من التحضير، وإذا عدّل المعلم التحضير خلالها تنلغي الرسالة.', 'التقرير الأسبوعي يطلع في اليوم والساعة اللي تحددها، أو بزر «أرسل الآن».', 'غرفة الحصة: الإعدادات ← غرفة الحصة. Jitsi هي الأساسية، وDaily احتياط تلقائي إذا حطيت مفتاحها. المعلم يقدر ينقل الحصة للاحتياط بزر.', '«حالة الخدمات» في إعدادات الموقع تفحص الواتساب والغرفة والإشعارات والنسخ الاحتياطي.', 'المساعد الذكي: الإعدادات ← المساعد الذكي، تسوي مفتاح من aistudio.google.com خاص بهالموقع وتلصقه وتحفظ.']) +
      `<details class="card help"><summary><h2>Google Sheets</h2></summary><p>من الإعدادات ولّد مفتاح التصدير، وبعدها في Google Sheets اكتب في خلية:</p><pre dir="ltr">=IMPORTDATA("https://${host}/api/export/students?key=المفتاح")</pre><p class="small muted">استبدل students بـ attendance للحضور أو recs للتسميع.</p></details>` +
      sub('التذكير والنسخ الاحتياطي', ['في Vercel أضف متغير CRON_SECRET بأي نص طويل، وأعد الرفع. النسخ الاحتياطي الأسبوعي يشتغل لحاله كل خميس.', 'للتذكير قبل الحصة وتنبيه «ما دخلوا»: سجّل في cron-job.org مجانًا وأضف مهمة كل 5 دقائق على: <span dir="ltr" class="small">https://' + host + '/api/cron/remind?key=CRON_SECRET</span>', 'للإشعارات أضف VAPID_PUBLIC_KEY و VAPID_PRIVATE_KEY.']) : '') : '';
  const onsite = sub('الحلقة الحضورية', ['أول ما توصل الجامع اضغط «📍 وصلت الجامع» فوق صفحة الحصص. لازم تكون داخل الجامع (الموقع يتأكد من الخريطة)، وقبلها ما تقدر تحضّر الطلاب ولا تسجل التسميع.', 'إذا طلعت اضغط «🚪 تسجيل خروج». وإذا نسيت ينسجّل خروجك لحاله عند وقت الانصراف اللي تحدده الإدارة (مثلًا ساعة ونص بعد أذان العصر). الخروج قبل الوقت يطلب تأكيد ويوصل للإدارة.', 'تسجيل تسميع بدون حصة: من «الحصص ← تسجيل تسميع» أو زر «سمّع» جنب الطالب في «طلابي». تقدر تختار يوم فات، ولو فيه حصة لحلقته بنفس اليوم ينربط فيها لحاله. وتعديل أي تسميع من صفحة الطالب ← سجل التسميع.', 'افتح حصة اليوم: كل طالب له بطاقة. «حاضر» يسجل وقت وصوله، ولو وصل بعد البداية بالمدة المحددة ينحسب متأخر لحاله.', 'في البطاقة تشوف المطلوب منه اليوم، و«سمّع» يفتح تسجيل التسميع، و«الحفظ الجديد» تختار منه الكمية بضغطة أو المقطع بالضبط.', '⋯ في البطاقة: تغيير الحالة، انصراف مبكر (يوصل ولي الأمر واتساب)، محفوظه واختبار المستوى، ورسالة لولي الأمر.', 'طالب جديد؟ «سجّل محفوظه» تحدد الأجزاء اللي يحفظها وتختبره بمقاطع عشوائية، والنتيجة تصير حفظه السابق في الخطة.', '«التسميع المتتابع» فوق شاشة الحلقة: يجيب لك الحاضرين اللي ما سمّعوا بترتيب وصولهم، واحد ورا الثاني، وتقدر تتخطى أحد للآخر.', 'آخر الحلقة: «الباقي غائب» ثم «إنهاء الحلقة»، ويطلع لك ملخص مين ما سمّع ومين يعيد.', 'بطاقات الطلاب للطباعة من «طلابي ← 🪪 بطاقات للطباعة»، وملف Excel كامل من «التقارير ← ⬇ Excel كامل».', 'مطر أو إجازة؟ من زر نوع الحصة فوق حوّلها «عن بعد» لهذي الحصة بس، أو «هجين» لو بعض الطلاب من البيت.'])
    + sub('صفحة الحصص والتعديل المتعدد', ['فوق صفحة الحصص تختار: يوم أو أسبوع أو شهر أو القادمة، وتتنقل بالأسهم، وتضغط أي يوم من شريط الأسبوع تشوف حصصه.', '«☑ تعديل متعدد»: حدد الحصص (أو «تحديد اليوم» أو «تحديد الكل») وغيّر نوعها حضوري أو عن بعد أو هجين، أو وقتها، أو ألغها، مرة وحدة.', 'وتقدر تقول للمساعد مثلًا: «حوّل حصص بكرة عن بعد» أو «ألغِ حصص الخميس».'])
    + (isFullAdmin(u) ? sub('النسخ الاحتياطي', ['كل يوم الساعة 4 الفجر تنحفظ نسخة كاملة تلقائيًا داخل الموقع، وفي قاعدة بيانات ثانية منفصلة إذا ربطتها.', 'الربط والنسخ من الإعدادات ← إعدادات الموقع ← النسخ الاحتياطي، وتقدر تنزّل أي نسخة.']) : '')
    + sub('الاجتماعات', ['من «التواصل ← الاجتماعات» تدخل اجتماع صوت وفيديو داخل الموقع.', 'اجتماع الإدارة: للمدير العام وكل المشرفين والمشرفات من الدارين. واجتماع المعلمين أو المعلمات: لكل قسم مع إدارته.', '«ادخل وأبلغهم» يرسل إشعار للمعنيين إن الاجتماع بدأ.'])
    + sub('النقاط والمتجر', ['النقاط تنحسب لحالها من الحضور والتسميع والحفظ، وتقدر تضيف أو تخصم يدويًا من ⭐ في بطاقة الطالب أو من «المتجر والنقاط ← النقاط» لأكثر من طالب.', 'الطالب ما يفتح جواله في الحلقة، فتقدر تطلب الجائزة عنه من ⭐ في بطاقته.', 'تسليم الجائزة: «المتجر والنقاط ← الطلبات»، أدخل الكود اللي عند الطالب واضغط تسليم.']);
  const adminOn = u.role === 'admin' ? sub('المجمعات وتحضير المعلمين بالموقع', ['من «المجمعات» أضف كل جامع، وحدد موقعه: وأنت في الجامع اضغط «📍 أنا في الجامع الحين»، أو الصق رابط قوقل ماب، واختر النطاق المسموح.', 'بعدها ما يقدر المعلم يسجل وصوله إلا وهو داخل النطاق، ولوحة المدير تعرض «اليوم في الجامع»: مين وصل ومتى وكم طالب حاضر.', 'تتنقل بين المجمعات من الشريط اللي فوق الصفحات.', 'مدير لكل جامع: من بطاقة المجمع اضغط «إضافة مدير للمجمع»، ويشوف مجمعه بس.'])
    + (S.isSuper ? sub('قسم البنات', ['فوق الصفحة زر «البنين | البنات» تتنقل فيه بين القسمين، وكل قسم منفصل تمامًا: حلقاته وطلابه ومعلميه وطلبات التسجيل والحصص والتقارير والمتجر والإعلانات وغرفة المعلمين.', 'لما تكون في قسم البنات: أي حلقة أو معلمة أو مشرفة أو جائزة أو إعلان تضيفه يصير للبنات.', 'إدارة قسم البنات: أضف مشرفة من «المعلمون» وأنت في قسم البنات، وتشوف قسم البنات بس. ومشرفين البنين ما يشوفون شي من البنات، والعكس.', 'رابط التسجيل العام وأنت في قسم البنات يكون خاص بالبنات، وطلباتهم توصل لقسمهم.', 'الطالبات والمعلمات يشوفون الموقع بتصميم وردي هادئ وكلام بصيغة المؤنث، ورسائل أولياء الأمور تصير «ابنتكم» و«بارك الله فيها».']) : '')
    + sub('المتجر والجوائز والميزانية', ['«المتجر والنقاط ← الجوائز»: أضف وعدّل واحذف براحتك. الأنواع: جائزة عادية، عرض لفترة محدودة، جائزة جماعية للحلقة كاملة توصلها بمجموع نقاطهم، ومزاد شهري.', 'حط التكلفة الفعلية لكل جائزة، و«الميزانية» تعرض المصروف هالشهر.', 'قواعد النقاط والخصم: الإعدادات ← التسميع والتقدير ← النقاط التلقائية.', 'التقرير الشهري لولي الأمر: رسائل الواتساب ← التقرير الشهري، ترسله الحين أو يطلع لحاله أول كل شهر.']) : '';
  return `<h1>الدليل</h1>${adminOn}${admin}${onsite}${teacher}${cal}${install}${notif}`;
}

/* ---- مودالات المرحلة 3 ---- */
function adminModal(a, preset) {
  const perms = a ? a.perms || [] : (preset || PRESETS['مشرف تعليمي']);
  openModal(`${dlgHead(a ? 'تعديل مشرف إداري' : inGirls() ? 'مشرفة جديدة · قسم البنات' : 'مشرف إداري جديد')}<form data-form="admin" data-id="${a ? a.id : ''}">${!a && inGirls() ? '<div class="note small">تتبع قسم البنات وما تشوف شي من البنين. صلاحية «الإعدادات» تعدّل إعدادات الموقع للقسمين، فالأفضل ما تعطيها.</div>' : ''}
    <label class="fld"><span>الاسم</span><input name="name" value="${esc(a ? a.name : '')}" required></label>
    <div class="fgrid"><label class="fld"><span>اسم المستخدم</span><input name="username" dir="ltr" autocapitalize="none" value="${esc(a ? a.username : '')}" required pattern="[A-Za-z0-9_.]{3,30}"></label>
    <label class="fld"><span>${a ? 'كلمة مرور جديدة (اتركها فاضية)' : 'كلمة المرور'}</span><input name="password" type="password" ${a ? '' : 'required minlength="6"'} autocomplete="new-password"></label></div>
    <div class="fld"><span>قالب جاهز</span><div class="row">${Object.keys(PRESETS).map(k => `<button type="button" class="btn sm" data-act="preset" data-k="${k}">${k}</button>`).join('')}</div></div>
    <div class="fld"><span>الصلاحيات</span><div class="days">${Object.entries(PERM_LABEL).map(([k, l]) => `<label><input type="checkbox" name="perm" value="${k}" ${perms.includes(k) ? 'checked' : ''}> ${l}</label>`).join('')}</div><span class="small muted" style="font-weight:400">الحصص ولوحة المدير متاحة للكل. إضافة المدراء والنسخ الاحتياطي للمدير الكامل فقط.</span></div>
    ${(() => { const sc = perms.filter(p => /^(h|b):/.test(p)); const on = sc.length > 0; const hs = L('halaqat').sort((x, y) => (x.name || '').localeCompare(y.name || '', 'ar'));
      return `<div class="fld"><span>يتابع</span><div class="row"><label class="check"><input type="radio" name="scope" value="all" data-change="scope-mode" ${on ? '' : 'checked'}> كل الحلقات</label><label class="check"><input type="radio" name="scope" value="some" data-change="scope-mode" ${on ? 'checked' : ''}> حلقات أو فروع محددة</label></div>
      <div id="scope-box" class="scope-box" ${on ? '' : 'hidden'}>${branches().length ? `<div class="small muted">الفروع</div><div class="days">${branches().map(b => `<label><input type="checkbox" name="perm" value="b:${esc(b)}" ${sc.includes('b:' + b) ? 'checked' : ''}> ${esc(b)}</label>`).join('')}</div>` : ''}<div class="small muted">الحلقات</div><div class="days">${hs.map(h => `<label><input type="checkbox" name="perm" value="h:${h.id}" ${sc.includes('h:' + h.id) ? 'checked' : ''}> ${esc(h.name)}</label>`).join('')}</div></div></div>`; })()}
    ${a ? `<label class="fld"><span>الحالة</span><select name="status"><option value="active" ${a.status !== 'disabled' ? 'selected' : ''}>نشط</option><option value="disabled" ${a.status === 'disabled' ? 'selected' : ''}>موقوف</option></select></label>` : ''}
    <div class="dlg-foot"><button class="btn pri" type="submit">حفظ</button>${a ? `<button type="button" class="btn danger" data-act="del-user" data-id="${a.id}">حذف</button>` : ''}</div></form>`);
}
function assignModal() {
  const hs = L('halaqat').sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
  const st = L('users').filter(x => x.role === 'student' && x.status === 'active').sort((a, b) => (halqaName(a.halqaId) + a.name).localeCompare(halqaName(b.halqaId) + b.name, 'ar'));
  openModal(`${dlgHead('توزيع الطلاب على الحلقات')}<form data-form="assign"><div class="small muted">غيّر حلقة أي طالب، وبعدها احفظ مرة وحدة. كل حلقة لها معلمها.</div>
    <div class="tbl-wrap chk-list"><table><thead><tr><th>الطالب</th><th>الحلقة</th></tr></thead><tbody>${st.map(x => `<tr><td>${esc(x.name)}</td><td><select name="h-${x.id}">${hs.map(h => `<option value="${h.id}" ${h.id === x.halqaId ? 'selected' : ''}>${esc(h.name)}${h.teacherId ? ' · ' + esc(subName(h.teacherId)) : ''}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div>
    <div class="dlg-foot"><button class="btn pri" type="submit">حفظ التوزيع</button></div></form>`);
}

/* ---- صفحة الطالب بالإنجليزي (لأولياء الأمور غير الناطقين بالعربية) ---- */
let LANG = 'ar'; try { LANG = localStorage.getItem('irtaq-lang') || 'ar'; } catch {}
const EN = {
  type: { new: 'New memorization', review: 'Review', tath: 'Consolidation' },
  att: { p: 'Present', l: 'Late', a: 'Absent', e: 'Excused' },
  grade: { 'ممتاز': 'Excellent', 'جيد جدًا': 'Very good', 'جيد': 'Good', 'يعاد': 'Repeat' },
  day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};
const fmtDateEn = ds => { const d = new Date(ds + 'T00:00'); return EN.day[d.getDay()] + ' ' + d.getDate() + '/' + (d.getMonth() + 1); };
const fmtTimeEn = t => { if (!t) return ''; let [h, m] = t.split(':').map(Number); const ap = h < 12 ? 'AM' : 'PM'; h = h % 12 || 12; return h + ':' + pad(m) + ' ' + ap; };
function cdTextEn(ts) {
  const d = ts - Date.now();
  if (d > 0) { const s = Math.floor(d / 1000); const dd = Math.floor(s / 86400); const hh = Math.floor(s % 86400 / 3600); const mm = Math.floor(s % 3600 / 60); const ss = s % 60; return 'Starts in ' + (dd ? dd + 'd ' : '') + (hh ? hh + ':' + pad(mm) + ':' + pad(ss) : mm + ':' + pad(ss)); }
  if (d > -3 * 3600000) return 'Started ' + Math.max(1, Math.round(-d / 60000)) + ' min ago';
  return '';
}
const segEn = (surah, from, to) => `Surah ${surah} <span dir="rtl">(${esc(SN[surah - 1])})</span>, ayah ${from === to ? from : from + '–' + to}`;
function homeEn(u) {
  const t = today(); const hs = S.halaqat[u.halqaId] || {};
  const sess = L('sessions').filter(s => s.halqaId === u.halqaId);
  const next = sess.filter(s => s.date >= t && !s.cancelled).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
  const a = attStats(u, 30); const rs = recsOf(u.id); const pg = pagesSum(rs.filter(r => r.date >= addDays(t, -7)));
  const items = planItems(u); const B = S.board || {}; const vd = verseOfDay(t);
  const unread = L('anns').filter(x => (!x.halqaId || x.halqaId === u.halqaId) && !(x.reads || []).some(r => r.uid === u.id));
  let card = '<div class="empty">No upcoming class right now.</div>';
  if (next) {
    const link = effLink(next); const j = S.joins[next.id + '_' + u.id]; const isToday = next.date === t;
    const inQ = (next.queue || []).includes(u.id); const pos = (next.queue || []).indexOf(u.id) + 1; const isCur = next.current === u.id; const issue = (next.issues || {})[u.id];
    card = `<div class="join-card"><div class="grow"><div class="small muted">${isToday ? "Today's class" : 'Next class'}</div><h2>${fmtDateEn(next.date)} · ${fmtTimeEn(next.time)}</h2><div class="cd" data-cd="${lessonTs(next)}" data-en="1">${cdTextEn(lessonTs(next))}</div>${(next.att || {})[u.id] ? `<span class="chip ${ATTC[next.att[u.id]]}">${EN.att[next.att[u.id]]}</span>` : ''}</div>
      <div class="join-actions">${link ? `<a class="btn pri big" href="${esc(link)}" target="_blank" rel="noopener" data-act="join" data-id="${next.id}">Join class</a>` : '<span class="chip warn">Link will be posted before class</span>'}${j && !j.left && isToday ? `<button class="btn" data-act="leave" data-id="${next.id}">I left the class</button>` : ''}</div></div>
    ${isToday ? `<section class="card" style="display:grid;gap:10px"><h2>Recitation queue</h2>${isCur ? '<div class="now"><div class="name">It is your turn now</div></div>' : inQ ? `<div class="row"><span>${pos === 1 ? 'You are next.' : 'Your position: ' + pos}</span><button class="btn sm" data-act="ready" data-id="${next.id}" data-v="0">Leave queue</button></div>` : `<button class="btn pri" data-act="ready" data-id="${next.id}" data-v="1">Ready to recite</button>`}
      <div class="row">${issue ? `<span class="chip warn">Your teacher was notified</span><button class="btn ghost sm" data-act="issue-cancel" data-id="${next.id}">Solved</button>` : `<button class="btn ghost sm" data-act="issue-open" data-id="${next.id}">I can't join the class</button>`}</div></section>` : ''}`;
  }
  return `<div><h1>Assalamu alaikum, ${esc((u.name || '').split(' ')[0])}</h1><div class="muted">${esc(hs.name || '')} · ${fmtDateEn(t)}</div></div>
  <div class="verse"><span class="small muted">Verse of the day</span><p dir="rtl">﴿${vd[0]}﴾</p><span class="small muted" dir="rtl">${vd[1]}</span></div>
  ${unread.map(x => `<div class="ann-new"><div class="grow"><div class="small muted">Announcement</div><b dir="auto">${esc(x.title)}</b>${x.body ? `<div class="ann-body" dir="auto">${esc(x.body)}</div>` : ''}</div><button class="btn pri sm" data-act="ann-read" data-id="${x.id}">Mark as read</button></div>`).join('')}
  ${card}
  <div class="grid2">
    <section class="card" style="display:grid;gap:10px"><h2>Assigned to you</h2>${isPaused(u) ? '<div class="note">The plan is paused.</div>' : items.length ? items.map(x => `<div class="plan-row ${x.retry ? 'retry' : ''}"><span class="lbl">${x.retry ? 'Repeat · ' : ''}${EN.type[x.type]}</span><div>${segEn(x.surah, x.from, x.to)}</div></div>`).join('') : '<div class="small muted">Nothing assigned yet.</div>'}
      ${(g => g ? `<div class="goal"><b>Goal: ${fmtPages(g.pages)} pages</b><div class="bar-track"><div class="bar-fill" style="width:${g.pct}%"></div></div><span class="small muted">${fmtPages(g.done)} / ${fmtPages(g.pages)}</span></div>` : '')(goalProgress(u))}</section>
    <section class="card" style="display:grid;gap:10px"><h2>Progress</h2><div class="stats"><div class="stat"><b>${a.rate == null ? '—' : a.rate + '%'}</b><span>Attendance (30 days)</span></div><div class="stat"><b>${a.a}</b><span>Absences</span></div><div class="stat"><b>${fmtPages(pg.new)}</b><span>Pages memorized this week</span></div><div class="stat"><b>${fmtPages(pg.review + pg.tath)}</b><span>Pages reviewed this week</span></div><div class="stat"><b>${B.pts ?? 0}</b><span>Points this week${B.rank ? ' · rank ' + B.rank : ''}</span></div><div class="stat"><b>${attendStreak(u)}</b><span>Classes in a row</span></div></div></section>
  </div>
  <section class="card"><h2>Recitation record</h2>${rs.length ? `<div class="tbl-wrap"><table dir="ltr"><thead><tr><th>Date</th><th>Type</th><th>Portion</th><th class="num">Mistakes</th><th>Grade</th><th>Note</th></tr></thead><tbody>${rs.slice(0, 40).map(r => `<tr><td>${fmtDateEn(r.date)}</td><td>${EN.type[r.type]}</td><td>${segEn(r.surah, r.from, r.to)}</td><td class="num">${r.quick ? '—' : r.mistakes}</td><td><span class="chip ${GRADE_K[r.grade] || ''}">${EN.grade[r.grade] || r.grade}</span></td><td dir="auto" style="white-space:normal">${esc(r.note || '')}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty small">No recitations yet.</div>'}</section>`;
}

/* ---------------- الواتساب التلقائي (الواتس الذكي) ---------------- */
const WA_STATUS = { pending: ['warn', 'بانتظار الإرسال'], sending: ['info', 'يُرسل الآن'], sent: ['ok', 'أُرسلت'], failed: ['bad', 'فشلت'], cancelled: ['', 'أُلغيت'] };
const WA_KIND = { absent: 'غياب', present: 'حضور', late: 'تأخر', rec: 'نتيجة التسميع', week: 'تقرير أسبوعي', month: 'تقرير شهري', left: 'انصراف', manual: 'رسالة' };
function waConnHtml() {
  waLoaded();
  if (!ST.wa) return `<section class="card"><h2>ربط الواتساب</h2><div class="row"><div class="spin"></div></div></section>`;
  const c = { ...(ST.wa.cfg || {}) }; if (/getpostman|documenter/i.test(c.url || '')) c.url = ''; const cnt = ST.wa.counts || {};
  return `<form class="card" data-form="wa" style="gap:12px"><div class="sec-head"><h2>ربط الواتساب (الواتس الذكي)</h2><span class="chip ${c.enabled ? 'ok' : ''}">${c.enabled ? 'مفعّل' : 'متوقف'}</span></div>
    <div class="test-box"><b>الربط السريع: ادخل بحسابك في الواتس الذكي</b><div class="small muted">نفس الرقم وكلمة المرور اللي تدخل فيها موقع الواتس الذكي. الموقع يجيب رمز الربط ورقمك المربوط ويعبي الإعدادات تحت بنفسه، وكلمة المرور ما تنحفظ.</div>
      <div class="row"><input id="wa-sl-phone" type="tel" dir="ltr" placeholder="05xxxxxxxx" autocomplete="off" style="flex:1 1 150px"><input id="wa-sl-pw" type="password" dir="ltr" placeholder="كلمة المرور" autocomplete="new-password" style="flex:1 1 150px"><button type="button" class="btn pri" data-act="wa-smart">اربط</button></div><div id="wa-sl-out" class="small muted" dir="auto"></div></div>
    <label class="check"><input type="checkbox" id="wa-enabled" name="enabled" ${c.enabled ? 'checked' : ''}> تفعيل الإرسال التلقائي</label>
    <details><summary class="small">إعدادات متقدمة (تتعبى تلقائيًا بعد الربط)</summary><div style="display:grid;gap:12px;margin-top:8px">
    <label class="fld" style="max-width:320px"><span>طريقة الطلب</span><select id="wa-method" name="method"><option value="GET" ${c.method === 'GET' ? 'selected' : ''}>رابط مباشر (GET)</option><option value="POST_FORM" ${c.method === 'POST_FORM' ? 'selected' : ''}>POST نموذج</option><option value="POST_JSON" ${c.method === 'POST_JSON' ? 'selected' : ''}>POST JSON</option></select></label>
    <label class="fld"><span>رابط الإرسال</span><textarea id="wa-url" name="url" rows="3" dir="ltr" placeholder="https://.../send?token=XXXX&phone={phone}&message={message}">${esc(c.url || '')}</textarea><span class="hint">{phone} = الرقم بصيغة 9665xxxxxxxx · {phone0} = بصيغة 05xxxxxxxx · {message} = نص الرسالة</span></label>
    <label class="fld"><span>نص الطلب (لطريقة POST فقط)</span><textarea id="wa-body" name="body" rows="3" dir="ltr" placeholder='{"phone":"{phone}","message":"{message}"}'>${esc(c.body || '')}</textarea></label>
    <label class="fld" style="max-width:320px"><span>كلمة تدل على النجاح في الرد (اختياري)</span><input id="wa-okWord" name="okWord" dir="ltr" value="${esc(c.okWord || '')}" placeholder="success"></label></div></details>
    <div class="fld"><span>متى يرسل تلقائيًا</span><div class="days">
      <label><input type="checkbox" id="wa-autoAbsent" name="autoAbsent" ${c.autoAbsent ? 'checked' : ''}> عند الغياب</label>
      <label><input type="checkbox" id="wa-autoLate" name="autoLate" ${c.autoLate ? 'checked' : ''}> عند التأخر</label>
      <label><input type="checkbox" id="wa-autoPresent" name="autoPresent" ${c.autoPresent ? 'checked' : ''}> عند الحضور</label>
      <label><input type="checkbox" id="wa-autoRec" name="autoRec" ${c.autoRec ? 'checked' : ''}> نتيجة التسميع</label></div></div>
    <label class="fld" style="max-width:320px"><span>يرسل بعد كم دقيقة من التحضير</span><input id="wa-delayMin" name="delayMin" type="number" min="0" max="240" value="${c.delayMin ?? 10}"><span class="hint">المهلة تعطي المعلم وقت يصحح التحضير. إذا غيّره خلالها تنلغي الرسالة.</span></label>
    <details><summary>نصوص الرسائل</summary><div style="display:grid;gap:10px;margin-top:8px">
      <div class="small muted">رسالة الغياب تاخذها من «رسائل واتساب لولي الأمر» فوق. استخدم {الطالب} و{الحلقة} و{التاريخ}، وفي رسالة التسميع {التسميع}.</div>
      <label class="fld"><span>رسالة الحضور</span><textarea id="wa-tplPresent" name="tplPresent" rows="2">${esc(c.tplPresent || '')}</textarea></label>
      <label class="fld"><span>رسالة التأخر</span><textarea id="wa-tplLate" name="tplLate" rows="2">${esc(c.tplLate || '')}</textarea></label>
      <label class="fld"><span>رسالة نتيجة التسميع</span><textarea id="wa-tplRec" name="tplRec" rows="3">${esc(c.tplRec || '')}</textarea></label>
      <label class="fld"><span>رسالة الانصراف بدري</span><textarea id="wa-tplLeft" name="tplLeft" rows="2">${esc(c.tplLeft || '')}</textarea><span class="hint">{الوقت} وقت الانصراف، {السبب} سبب الانصراف إذا كتبه المعلم.</span></label></div></details>
    <div class="seg-box"><b>التقرير الأسبوعي لأولياء الأمور</b>
      <label class="check"><input type="checkbox" id="wa-autoWeek" name="autoWeek" ${c.autoWeek ? 'checked' : ''}> يرسل تلقائيًا كل أسبوع</label>
      <div class="fgrid"><label class="fld"><span>اليوم</span><select id="wa-weekDay" name="weekDay">${DAYN.map((d, i) => `<option value="${i}" ${(c.weekDay ?? 4) === i ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
      <label class="fld"><span>الساعة</span><select id="wa-weekHour" name="weekHour">${[...Array(24).keys()].map(h => `<option value="${h}" ${(c.weekHour ?? 20) === h ? 'selected' : ''}>${fmtTime(pad(h) + ':00')}</option>`).join('')}</select></label></div>
      <details><summary class="small">نص التقرير</summary><label class="fld" style="margin-top:8px"><textarea id="wa-tplWeek" name="tplWeek" rows="8">${esc(c.tplWeek || '')}</textarea><span class="hint">المتغيرات: {الطالب} {الحلقة} {الحضور} {الغياب} {الحفظ} {المراجعة} {التسميع} {النقاط}</span></label></details>
      <div class="row"><button type="button" class="btn" data-act="wa-week-now">أرسل تقرير هالأسبوع الآن لكل الحلقات</button></div>
      <span class="small muted">يحسب من بداية الأسبوع (الأحد) لين يوم الإرسال. ولي الأمر ما يوصله نفس التقرير مرتين في نفس الأسبوع.</span></div>
    <div class="seg-box"><b>التقرير الشهري لأولياء الأمور</b>
      <label class="check"><input type="checkbox" id="wa-autoMonth" name="autoMonth" ${c.autoMonth ? 'checked' : ''}> يرسل تلقائيًا كل شهر</label>
      <div class="fgrid"><label class="fld"><span>يوم الشهر</span><select id="wa-monthDay" name="monthDay">${[...Array(28).keys()].map(i => `<option value="${i + 1}" ${(c.monthDay || 1) === i + 1 ? 'selected' : ''}>${i + 1}</option>`).join('')}</select></label>
      <label class="fld"><span>الساعة</span><select id="wa-monthHour" name="monthHour">${[...Array(24).keys()].map(h => `<option value="${h}" ${(c.monthHour ?? 20) === h ? 'selected' : ''}>${fmtTime(pad(h) + ':00')}</option>`).join('')}</select></label></div>
      <details><summary class="small">نص التقرير</summary><label class="fld" style="margin-top:8px"><textarea id="wa-tplMonth" name="tplMonth" rows="9">${esc(c.tplMonth || '')}</textarea><span class="hint">المتغيرات: {الطالب} {الحلقة} {الشهر} {الحضور} {الغياب} {التأخر} {الحفظ} {المراجعة} {التسميع} {الرصيد} {الجوائز}</span></label></details>
      <span class="small muted">لو انرسل في أول 5 أيام من الشهر يكون عن الشهر اللي فات.</span></div>
    <div class="row"><button class="btn pri" type="submit">حفظ ربط الواتساب</button></div>
    <div class="test-box"><b>تجربة الإرسال</b><div class="row"><input id="wa-test-phone" type="tel" dir="ltr" placeholder="05xxxxxxxx" style="flex:1 1 160px"><button type="button" class="btn" data-act="wa-test">أرسل رسالة تجريبية</button></div><div id="wa-test-out" class="small ${ST.waTest ? (ST.waTest.ok ? 'c-ok' : 'c-bad') : 'muted'}" dir="auto">${ST.waTest ? esc(ST.waTest.msg) : ''}</div></div>
  </form>`;
}
function waLogHtml() {
  if (!waLoaded()) return `<section class="card"><h2>سجل الرسائل</h2><div class="row"><div class="spin"></div></div></section>`;
  const cnt = ST.wa.counts || {};
  return `<section class="card" style="display:grid;gap:10px"><div class="sec-head"><h2>سجل الرسائل</h2><div class="row">${cnt.failed ? '<button class="btn sm" data-act="wa-retry-all">إعادة الفاشلة</button>' : ''}<button class="btn ghost sm" data-act="wa-refresh">تحديث</button></div></div>
    <div class="row">${Object.entries(WA_STATUS).map(([k, [c2, l]]) => cnt[k] ? `<span class="chip ${c2}">${l}: ${cnt[k]}</span>` : '').join('')}</div>
    ${(ST.wa.log || []).length ? `<div class="list">${ST.wa.log.map(m => { const [c2, l] = WA_STATUS[m.status] || ['', m.status]; return `<div class="item"><div class="grow"><b>${esc(m.name || m.phone)}</b> <span class="chip">${WA_KIND[m.kind] || m.kind}</span> <span class="chip ${c2}">${l}</span><div class="small muted">${m.sentAt ? 'أُرسلت ' + fmtDate(isoDate(new Date(m.sentAt))) + ' ' + clock(m.sentAt) : m.status === 'pending' ? 'موعد الإرسال ' + clock(m.sendAfter) : fmtDate(isoDate(new Date(m.at)))}</div>${m.status === 'failed' ? `<div class="small" style="color:var(--bad)" dir="auto">${esc(m.resp)}</div>` : ''}<details><summary class="small">نص الرسالة</summary><div class="small ann-body">${esc(m.text)}</div></details></div>${m.status === 'failed' || m.status === 'cancelled' ? `<button class="btn sm" data-act="wa-retry" data-id="${m.id}">إعادة</button>` : ''}${m.status === 'pending' ? `<button class="btn ghost sm" data-act="wa-cancel" data-id="${m.id}">إلغاء</button>` : ''}</div>`; }).join('')}</div>` : '<div class="empty small">ما فيه رسائل بعد.</div>'}
  </section>`;
}
function waSessionHtml(s) {
  if (!S.waOn) return '';
  const key = s.id; const st = (ST.waP || {})[key];
  if (!st || Date.now() - st.t > 20000) { if (!(ST.waPL || {})[key]) { ST.waPL = { ...(ST.waPL || {}), [key]: 1 }; act('wa.pending', { lessonId: s.id }).then(r => { ST.waPL[key] = 0; ST.waP = { ...(ST.waP || {}), [key]: { t: Date.now(), rows: (r && r.rows) || [] } }; if (ST.view === 'session' && ST.sid === key) render(); }); } }
  const rows = (st && st.rows) || []; const pend = rows.filter(r => r.status === 'pending'); const sent = rows.filter(r => r.status === 'sent').length; const fail = rows.filter(r => r.status === 'failed').length;
  const nextAt = pend.length ? Math.min(...pend.map(r => r.sendAfter)) : 0;
  return `<div class="wa-bar"><b>واتساب تلقائي لأولياء الأمور</b>${pend.length ? `<span class="chip warn">${pend.length} بانتظار الإرسال${nextAt > Date.now() ? ' · بعد ' + Math.max(1, Math.round((nextAt - Date.now()) / 60000)) + ' د' : ''}</span><button class="btn sm" data-act="wa-now" data-id="${s.id}">أرسل الآن</button>` : ''}${sent ? `<span class="chip ok">أُرسل ${sent}</span>` : ''}${fail ? `<span class="chip bad">فشل ${fail}</span>` : ''}${!rows.length ? '<span class="small muted">ترسل تلقائيًا بعد التحضير.</span>' : ''}</div>`;
}

/* ---------------- «وش عليك بكرة» للطالب ---------------- */
/* موعد الحصة القادمة اللي يتجهز لها الطالب */
function nextLessonFor(u) {
  const t = today(); const now = Date.now();
  const ls = L('sessions').filter(s => s.halqaId === u.halqaId && !s.cancelled && s.date >= t).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  // حصة اليوم إذا ما انتهت، وإلا اللي بعدها
  const sTodayDone = s => s.date === t && (lessonTs(s) + 90 * 60000 < now || L('recs').some(r => r.uid === u.id && r.sid === s.id));
  let s = ls.find(x => !sTodayDone(x));
  if (s) return { date: s.date, time: s.time };
  // ما فيه حصة منشأة: أقرب يوم دوام بعد اليوم
  const days = halqaDays(u.halqaId);
  for (let i = 1; i <= 14; i++) { const d = addDays(t, i); if (days.includes(new Date(d + 'T00:00').getDay()) && !isHolidayC(d)) return { date: d, time: (S.halaqat[u.halqaId] || {}).time || '' }; }
  return null;
}
function dayLabel(ds) { const t = today(); if (ds === t) return 'اليوم'; if (ds === addDays(t, 1)) return 'بكرة'; return 'يوم ' + DAYN[new Date(ds + 'T00:00').getDay()]; }
const TYPE_ICON = { new: 'حفظ', review: 'مراجعة', tath: 'تثبيت' };
function dueCard(u) {
  if (isPaused(u)) return '';
  const nx = nextLessonFor(u); const items = planItems(u);
  const lbl = nx ? dayLabel(nx.date) : 'الحصة الجاية';
  const head = `<div class="sec-head"><div><div class="small muted">${nx ? fmtDateH(nx.date) + (nx.time ? ' · ' + fmtTime(nx.time) : '') : ''}</div><h2>وش عليك ${lbl}؟</h2></div><a class="btn ghost sm" href="${MUSHAF_URL}" target="_blank" rel="noopener">افتح المصحف</a></div>`;
  if (!items.length) return `<section class="card due">${head}<div class="empty small">ما حدد لك المعلم مطلوب بعد. إذا عندك سؤال كلّم معلمك.</div></section>`;
  // تجميع المقاطع حسب النوع (المقطع اللي يمتد على أكثر من سورة يطلع في سطر واحد)
  const groups = []; items.forEach(x => { const k = (x.retry ? 'r' : '') + x.type; let g = groups.find(y => y.k === k); if (!g) { g = { k, type: x.type, retry: x.retry, segs: [] }; groups.push(g); } g.segs.push({ s: x.surah - 1, a1: x.from, a2: x.to }); });
  const order = { rnew: 0, rreview: 1, rtath: 2, new: 3, tath: 4, review: 5 }; groups.sort((a, b) => order[a.k] - order[b.k]);
  const span = g => { const a = g.segs[0], z = g.segs[g.segs.length - 1]; return a.s === z.s ? `سورة ${SN[a.s]} من آية ${a.a1} إلى آية ${z.a2}` : `من ${SN[a.s]} آية ${a.a1} إلى ${SN[z.s]} آية ${z.a2}`; };
  const pages = g => { const p1 = pageOf(g.segs[0].s, g.segs[0].a1), last = g.segs[g.segs.length - 1], p2 = pageOf(last.s, last.a2); return p1 ? (p1 === p2 ? 'صفحة ' + p1 : 'صفحة ' + p1 + ' إلى ' + p2) : ''; };
  const meta = g => [pages(g), PAGES_OK ? fmtLines(linesOf(g.segs)) : ''].filter(Boolean).join(' · ');
  const share = `المطلوب من ${u.name} ${lbl}${nx ? ' (' + fmtDate(nx.date) + ')' : ''}:\n` + groups.map(g => `- ${g.retry ? 'إعادة ' : ''}${TYPE_ICON[g.type]}: ${span(g)}${meta(g) ? ' (' + meta(g) + ')' : ''}`).join('\n');
  // اللي بعده في الحفظ التلقائي (إذا نجح)
  let after = '';
  if (isAuto(u)) { const inf = autoInfo(u); if (inf.new && inf.new.next < TOTAL) { const a = planOf(u).auto; const nn = take((ORD[a.dir] || ORD.bwd).ord, inf.new.next, TOTAL, +a.newAmt, true); const sg = segs(nn.list); if (sg.length) after = `<div class="small muted">وإذا سمّعت الحفظ ونجحت، اللي بعده: ${segText(sg)}</div>`; } }
  return `<section class="card due">${head}
    <div class="due-list">${groups.map(g => `<div class="due-item t-${g.retry ? 'retry' : g.type}"><span class="due-tag">${g.retry ? 'إعادة ' : ''}${TYPE_ICON[g.type]}</span><div class="due-body"><b>${span(g)}</b>${meta(g) ? `<span class="due-meta">${meta(g)}</span>` : ''}</div></div>`).join('')}</div>
    ${after}
    <div class="row"><a class="btn wa sm" href="https://wa.me/?text=${encodeURIComponent(share)}" target="_blank" rel="noopener">أرسلها بالواتساب</a><button class="btn ghost sm" data-act="copy" data-text="${esc(share)}">نسخ</button></div>
  </section>`;
}

/* ---------------- حسابات الأبناء على جهاز ولي الأمر ---------------- */
const ACC_KEY = 'irtaq-accounts';
function accounts() { try { return JSON.parse(localStorage.getItem(ACC_KEY) || '[]'); } catch { return []; } }
function saveAccounts(list) { try { localStorage.setItem(ACC_KEY, JSON.stringify(list.slice(0, 10))); } catch {} }
function saveAccount(a) { const l = accounts().filter(x => x.id !== a.id); l.push(a); saveAccounts(l); }
function accountsHtml(curId) {
  const l = accounts();
  return `<div class="list">${l.map(a => `<div class="item ${a.id === curId ? 'cur-acc' : ''}"><div class="grow"><b>${esc(a.name)}</b>${a.id === curId ? '<div class="small muted">الحساب المفتوح الآن</div>' : ''}</div>${a.id === curId ? '<span class="chip ok">مفتوح</span>' : `<button class="btn pri sm" data-act="switch" data-id="${a.id}">افتح</button>`}<button class="btn ghost sm" data-act="acc-rm" data-id="${a.id}" aria-label="إزالة من الجهاز">إزالة</button></div>`).join('') || '<div class="small muted">ما فيه حسابات محفوظة.</div>'}</div>`;
}
function kidsModal() {
  const u = me();
  openModal(`${dlgHead('حسابات الأبناء')}<div class="small muted">تنقّل بين حسابات أولادك على هذا الجهاز بدون كلمة مرور. كل حساب تدخله مرة وحدة بس.</div>
  ${accountsHtml(u && u.id)}
  <form data-form="add-kid" class="card" style="gap:10px"><b>إضافة ابن آخر</b>
    <label class="fld"><span>اسم المستخدم</span><input name="username" dir="ltr" autocapitalize="none" autocomplete="off" required></label>
    ${pwField('ak-pw', 'password', 'كلمة المرور', 'off')}
    <button class="btn pri" type="submit">إضافة وفتح الحساب</button></form>`);
}
async function switchTo(id) {
  const a = accounts().find(x => x.id === id); if (!a) return;
  try { const r = await api('/api/switch', { token: a.token }); if (r.name && r.name !== a.name) saveAccount({ ...a, name: r.name }); closeModal(); ST.view = null; ST.tourShown = true; await load(); toast('فتحت حساب ' + (r.name || a.name)); }
  catch (e) { toast(e.message); if (e.status === 401) { saveAccounts(accounts().filter(x => x.id !== id)); if (!$('#modal').hidden) kidsModal(); } }
}

/* ---------------- شرح وتسهيلات للطالب وولي الأمر ---------------- */
const ICON_I = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 11v6M12 7.5v.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
const tip = html => `<div class="tip">${ICON_I}<div>${html}</div></div>`;
const support = () => { const st = S.settings.main ? SET() : (ST.regInfo || {}); return { name: st.supportName || 'إدارة الحلقة', phone: st.supportPhone || '' }; };
const supportBtn = (label, text) => { const sp = support(); const l = sp.phone && waLink(sp.phone, text || 'السلام عليكم، احتاج مساعدة في موقع الحلقة'); return l ? `<a class="btn wa" href="${l}" target="_blank" rel="noopener">${label || 'تواصل مع ' + esc(sp.name)}</a>` : ''; };
const pwField = (id, name, label, auto, extra = '') => `<label class="fld"><span>${label}</span><div class="pw-wrap"><input id="${id}" name="${name}" type="password" autocomplete="${auto}" required ${extra}><button type="button" class="pw-eye" data-act="pw-eye" aria-label="إظهار كلمة المرور">إظهار</button></div></label>`;

/* جولة تعريفية: تظهر أول مرة على كل جهاز */
const TOUR = [
  ['أهلًا بك', 'هذي صفحتك في الحلقة، ويتابع منها ولي الأمر بنفس الحساب. خلنا نعرّفك عليها في دقيقة.'],
  ['الدخول للحصة', 'قبل الحصة يطلع عدّاد يوضح كم باقي. وقت الحصة اضغط <b>«ادخل الحصة»</b> ويفتح لك Zoom أو Meet.<br><span class="muted">أول مرة ممكن يطلب منك تثبيت التطبيق من المتجر، ثبته وارجع اضغط الزر مرة ثانية.</span>'],
  ['التسميع', 'إذا صرت جاهز تسمّع اضغط <b>«جاهز للتسميع»</b>، وتشوف ترتيبك في الطابور. لما يجي دورك يطلع لك <b>«دورك الآن»</b>.'],
  ['ما قدرت تدخل؟', 'اضغط <b>«عندي مشكلة في الدخول»</b> واختر المشكلة، وتوصل للمعلم فورًا.'],
  ['وش عليك بكرة؟', 'أول شي في صفحتك بطاقة <b>«وش عليك بكرة؟»</b>: الحفظ والمراجعة والتثبيت للحصة الجاية، بالسورة والآيات والصفحة. تقدر ترسلها لنفسك بالواتساب. وفي <b>«مهام اليوم»</b> علّم على اللي خلصته في البيت.'],
  ['لولي الأمر', 'تحت تلقى الحضور، وعدد الأوجه، والنقاط، وسجل التسميع مع ملاحظات المعلم. والإعلانات تطلع فوق باللون الذهبي.'],
  ['خلّه أسهل', 'من <b>«الدليل»</b> تقدر تثبت الموقع على شاشة الجوال مثل التطبيق، وتضيف مواعيد الحلقة لتقويمك. وزر <b>«أ+»</b> فوق يكبّر الخط.'],
];
function tourSeen(u) { try { return !!localStorage.getItem('irtaq-tour-' + u.id); } catch { return true; } }
function showTour(i = 0) {
  ST.tour = i; const [t, b] = TOUR[i]; const last = i === TOUR.length - 1;
  openModal(`<div class="tour"><div class="tour-dots">${TOUR.map((_, k) => `<span class="${k === i ? 'on' : ''}"></span>`).join('')}</div><div class="small muted">${i + 1} من ${TOUR.length}</div><h2>${t}</h2><p>${b}</p>
    <div class="dlg-foot">${last ? '<button class="btn pri big" data-act="tour-end">ابدأ</button>' : '<button class="btn pri" data-act="tour-next">التالي</button>'}${i ? '<button class="btn" data-act="tour-prev">السابق</button>' : ''}${last ? '' : '<button class="btn ghost" data-act="tour-end">تخطي</button>'}</div></div>`);
}

/* ملخص سريع لولي الأمر أعلى الصفحة */
function parentSummary(u) {
  const t = today(); const sess = L('sessions').filter(s => s.halqaId === u.halqaId && !s.cancelled);
  const todayL = sess.find(s => s.date === t); const last = recsOf(u.id)[0];
  const bits = [];
  if (todayL) { const v = (todayL.att || {})[u.id]; bits.push(`حصة اليوم ${fmtTime(todayL.time)}: ${v ? `<b class="c-${ATTC[v]}">${ATT[v]}</b>` : 'لم يُحضَّر بعد'}`); }
  else bits.push('ما فيه حصة اليوم');
  if (last) bits.push(`آخر تسميع ${fmtDate(last.date)}: <b class="c-${GRADE_K[last.grade] || ''}">${esc(last.grade)}</b>`);
  const g = goalProgress(u); if (g) bits.push(`الهدف: ${g.pct}٪`);
  const un = dmUnreadMine(u); if (un) bits.push(`<button class="linkbtn" data-act="tab" data-v="msgs">${un} رسالة من المعلم</button>`);
  return `<div class="psum"><span class="small muted">ملخص سريع</span><div>${bits.join(' · ')}</div></div>`;
}

/* شريط ثابت أسفل الجوال وقت الحصة */
function stickyJoin(u) {
  const t = today(); const s = L('sessions').filter(x => x.halqaId === u.halqaId && x.date === t && !x.cancelled && lessonMode(x) !== 'onsite').sort((a, b) => a.time.localeCompare(b.time)).find(x => { const d = lessonTs(x) - Date.now(); return d < 20 * 60000 && d > -3 * 3600000; });
  if (!s) return '';
  const link = effLink(s); const isCur = s.current === u.id; const inQ = (s.queue || []).includes(u.id);
  return `<div class="sticky-join">${isCur ? '<b class="now-tag">دورك الآن</b>' : inQ ? `<span class="small">ترتيبك ${(s.queue || []).indexOf(u.id) + 1}</span>` : `<button class="btn" data-act="ready" data-id="${s.id}" data-v="1">جاهز للتسميع</button>`}${link ? `<a class="btn pri" href="${esc(link)}" target="_blank" rel="noopener" data-act="join" data-id="${s.id}">ادخل الحصة</a>` : ''}</div>`;
}

/* حجم الخط */
let ZOOM = 1; try { ZOOM = +localStorage.getItem('irtaq-zoom') || 1; } catch {}
function applyZoom() { const r = document.getElementById('root'); if (r) r.style.zoom = ZOOM === 1 ? '' : String(ZOOM); try { localStorage.setItem('irtaq-zoom', String(ZOOM)); } catch {} }

/* أسئلة شائعة */
const FAQ = [
  ['ضغطت «ادخل الحصة» وما صار شيء', 'تأكد إن التطبيق (Zoom أو Meet) مثبت على جوالك. إذا ما فتح، اضغط مطولًا على الزر واختر «فتح في المتصفح». وإذا ما زال، اضغط «عندي مشكلة في الدخول».'],
  ['ما طلع لي زر «ادخل الحصة»', 'معناه المعلم ما حط الرابط بعد. ينزل قبل الحصة، اسحب الصفحة لتحت عشان تتحدث أو انتظر شوي.'],
  ['نسيت كلمة المرور', 'تواصل مع إدارة الحلقة، يعطونك كلمة مرور جديدة بالواتساب.'],
  ['كيف أعرف مستوى ولدي؟', 'شوف «سجل التسميع» تحت: فيه كل تسميع بتقديره وعدد أخطائه وملاحظة المعلم. و«إنجازك» فيه الحضور وعدد الأوجه.'],
  ['وش يعني «إعادة» في المطلوب؟', 'الطالب ما اجتاز هذا المقطع، فيعيد تسميعه في الحصة الجاية لين ينجح.'],
  ['هل لازم أسجل دخول كل مرة؟', 'لا، الموقع يتذكرك شهرين على نفس الجهاز. وإذا ثبته على الشاشة الرئيسية يفتح مثل التطبيق.'],
  ['عندي أكثر من ولد في الحلقة', 'اضغط «إضافة ابن» فوق وادخل بحساب ولدك الثاني مرة وحدة. بعدها تتنقل بينهم من زر «الأبناء» بدون كلمة مرور.'],
];

/* ---------------- modals ---------------- */
let CONFIRM = null;
function openModal(html) { const m = $('#modal'); m.innerHTML = `<div class="dlg" role="dialog" aria-modal="true">${html}</div>`; femify(m); m.hidden = false; const f = m.querySelector('input:not([type=hidden]),select,textarea'); if (f) setTimeout(() => f.focus(), 30); }
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
  openModal(`${dlgHead(isNew ? 'حصة إضافية' : 'تعديل الحصة')}
  <form data-form="session" data-id="${s ? s.id : ''}">
    <label class="fld"><span>الحلقة</span><select name="halqaId" ${isNew ? '' : 'disabled'}>${hs.map(h => `<option value="${h.id}" ${h.id === h0 ? 'selected' : ''}>${esc(h.name)}</option>`).join('')}</select></label>
    <div class="fgrid"><label class="fld"><span>التاريخ</span><input type="date" name="date" value="${s ? s.date : today()}" required></label><label class="fld"><span>الوقت</span><input type="time" name="time" value="${s ? s.time : lastTime}" required></label></div>
    <label class="fld"><span>رابط الحصة</span><input name="link" type="url" dir="ltr" value="${esc(s ? s.link : '')}" placeholder="اتركه فاضي لاستخدام رابط الحلقة الثابت"></label>
    <label class="fld"><span>ملاحظة (اختياري)</span><input name="note" value="${esc(s ? s.note : '')}" placeholder="مثال: مراجعة جزء عمّ"></label>
    ${u.role === 'admin' ? `<label class="fld"><span>معلم احتياط (اختياري)</span><select name="subId"><option value="">بدون، المعلم الأساسي</option>${L('users').filter(x => x.role === 'teacher' && x.status === 'active').map(x => `<option value="${x.id}" ${s && s.subId === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>` : ''}
    <div class="dlg-foot"><button class="btn pri" type="submit">${isNew ? 'إنشاء الحصة' : 'حفظ'}</button>${s ? `<button type="button" class="btn danger" data-act="del-session" data-id="${s.id}">${s.auto ? 'إلغاء الحصة' : 'حذف الحصة'}</button>` : ''}</div>
  </form>`);
}

/* ---------------- recording panel ---------------- */
function planItems(st) {
  if (isPaused(st)) return [];
  const ps = planSegs(st); const out = [];
  ['new', 'review', 'tath'].forEach(k => (ps[k] || []).forEach(x => out.push({ type: k, surah: x.s + 1, from: x.a1, to: x.a2 })));
  retriesOf(st).forEach(r => { if (!out.some(o => o.type === r.type && o.surah === r.surah && o.from === r.from && o.to === r.to)) out.unshift({ type: r.type, surah: r.surah, from: r.from, to: r.to, retry: true }); });
  return out;
}
// المقاطع المتتالية من نفس النوع (مثل مراجعة 20 وجه في جزء عمّ تمتد على 20 سورة) تنعرض كمقطع واحد بدل سطر لكل سورة
function planGroups(st) {
  const out = [];
  planItems(st).forEach(x => { const l = out[out.length - 1]; if (l && l.type === x.type && !!l.retry === !!x.retry) l.parts.push(x); else out.push({ type: x.type, retry: !!x.retry, parts: [x] }); });
  return out;
}
const partsText = ps => { const a = ps[0], z = ps[ps.length - 1]; return ps.length === 1 ? `${SN[a.surah - 1]} ${a.from === a.to ? a.from : a.from + '–' + a.to}` : `من ${SN[a.surah - 1]} ${a.from} إلى ${SN[z.surah - 1]} ${z.to}`; };
const partsPages = ps => { const a = ps[0], z = ps[ps.length - 1]; const p1 = pageOf(a.surah - 1, +a.from), p2 = pageOf(z.surah - 1, +z.to); return p1 && p2 ? (p1 === p2 ? `ص ${p1}` : `ص ${Math.min(p1, p2)}–${Math.max(p1, p2)}`) : ''; };
const groupKey = g => g.parts.length === 1 ? itemLabel(g.parts[0]) : `${TYPE[g.type]} ${partsText(g.parts)}`;
const groupLabel = g => `${g.retry ? 'إعادة ' : ''}${TYPE[g.type]}: ${partsText(g.parts)}`;
const blankSeg = (type = 'new') => ({ type, surah: '', from: '', to: '', m: 0, a: 0, full: false, q: '' });
function startRec(uid, sid, where, date) {
  const st = { ...S.users[uid], id: uid }; const items = planItems(st);
  const autoT = !!(+SET().recMin) && !!sid;
  ST.rec = { uid, sid: sid || '', where, date: date || today(), quick: false, secs: 0, run: autoT, t0: autoT ? Date.now() : 0, note: '',
    segs: items.length ? planGroups(st).map(g => g.parts.length === 1 ? ({ ...blankSeg(g.type), surah: g.parts[0].surah, from: g.parts[0].from, to: g.parts[0].to, retry: g.retry }) : ({ ...blankSeg(g.type), retry: g.retry, parts: g.parts.map(x => ({ surah: x.surah, from: x.from, to: x.to })) })) : [blankSeg()] };
}
const recSecs = () => ST.rec ? ST.rec.secs + (ST.rec.run ? Math.floor((Date.now() - ST.rec.t0) / 1000) : 0) : 0;
const fmtDur = s => Math.floor(s / 60) + ':' + pad(s % 60);
function segGrade(g) { return ST.rec.quick ? (g.q ? { k: GRADE_K[g.q], t: g.q } : null) : gradeOf(g.m, g.a); }
function tallyHtml(g, i) {
  return ST.rec.quick ? `<div class="qgrades">${['ممتاز', 'جيد جدًا', 'جيد', 'يعاد'].map(t => `<button class="btn ${g.q === t ? 'pri' : ''}" data-act="rk-q" data-i="${i}" data-v="${t}">${t}</button>`).join('')}</div>`
    : `<div class="tally"><div class="tl"><span>الأخطاء</span><div class="tl-row"><button class="btn tb" data-act="rk-inc" data-i="${i}" data-k="m" data-d="-1" aria-label="إنقاص خطأ">−</button><b class="num">${g.m}</b><button class="btn tb big-t" data-act="rk-inc" data-i="${i}" data-k="m" data-d="1">+ خطأ</button></div></div>
        <div class="tl"><span>التنبيهات</span><div class="tl-row"><button class="btn tb" data-act="rk-inc" data-i="${i}" data-k="a" data-d="-1" aria-label="إنقاص تنبيه">−</button><b class="num">${g.a}</b><button class="btn tb big-t" data-act="rk-inc" data-i="${i}" data-k="a" data-d="1">+ تنبيه</button></div></div></div>`;
}
// مقطع يمتد على أكثر من سورة: سطر واحد وتقدير واحد، و«تفصيل» يفكه سورة سورة لو احتاج المعلم
function spanHtml(g, i) {
  const gr = segGrade(g); const pg = partsPages(g.parts);
  return `<div class="seg-box span-seg">
    <div class="row" style="justify-content:space-between"><div class="row"><span class="chip acc">${TYPE[g.type]}</span>${g.retry ? '<span class="chip bad">إعادة</span>' : ''}${gr ? `<span class="chip ${gr.k}">${gr.t}</span>` : ''}</div>
      <div class="row"><button class="btn ghost sm" data-act="rk-split" data-i="${i}">تفصيل بالسور</button>${ST.rec.segs.length > 1 ? `<button class="btn ghost sm" data-act="rk-rm" data-i="${i}" aria-label="حذف المقطع">✕</button>` : ''}</div></div>
    <div class="span-t"><b>${esc(partsText(g.parts))}</b><span class="small muted">${g.parts.length} سور${pg ? ' · ' + pg : ''}</span></div>
    ${tallyHtml(g, i)}
  </div>`;
}
function segHtml(g, i) {
  if (g.parts) return spanHtml(g, i);
  const n = AYAS[+g.surah - 1]; const gr = segGrade(g);
  return `<div class="seg-box">
    <div class="row" style="justify-content:space-between"><div class="row"><select id="rk-t-${i}" data-rf="type" data-i="${i}">${Object.keys(TYPE).map(k => `<option value="${k}" ${g.type === k ? 'selected' : ''}>${TYPE[k]}</option>`).join('')}</select>${g.retry ? '<span class="chip bad">إعادة</span>' : ''}${gr ? `<span class="chip ${gr.k}">${gr.t}</span>` : ''}</div>${ST.rec.segs.length > 1 ? `<button class="btn ghost sm" data-act="rk-rm" data-i="${i}" aria-label="حذف المقطع">✕</button>` : ''}</div>
    <div class="fgrid"><select id="rk-s-${i}" data-rf="surah" data-i="${i}" aria-label="السورة">${surahOptions(g.surah)}</select>
      <input id="rk-f-${i}" data-rf="from" data-i="${i}" type="number" inputmode="numeric" min="1" ${n ? `max="${n}"` : ''} placeholder="من آية" aria-label="من آية" value="${g.full ? 1 : esc(g.from)}" ${g.full ? 'disabled' : ''}>
      <input id="rk-to-${i}" data-rf="to" data-i="${i}" type="number" inputmode="numeric" min="1" ${n ? `max="${n}"` : ''} placeholder="إلى آية" aria-label="إلى آية" value="${g.full ? (n || '') : esc(g.to)}" ${g.full ? 'disabled' : ''}></div>
    <label class="check small"><input type="checkbox" id="rk-full-${i}" data-rf="full" data-i="${i}" ${g.full ? 'checked' : ''}> السورة كاملة${n ? ` (${n} آية)` : ''}</label>
    ${tallyHtml(g, i)}
  </div>`;
}
function recPanelHtml() {
  const R = ST.rec; if (!R) return '';
  const st = S.users[R.uid] || {}; const ses = S.sessions[R.sid] || {};
  return `<div class="recp">
   <div class="sec-head"><div><div class="small muted">تسجيل تسميع${R.sid ? '' : ' بدون حصة'}</div><h3>${esc(st.name)}</h3></div>
     <div class="row"><span class="timer num timer-w ${(+SET().recMin) && recSecs() >= SET().recMin * 60 ? 'over' : ''}" data-timer>${fmtDur(recSecs())}</span><button class="btn sm" data-act="rk-timer">${R.run ? 'إيقاف' : (R.secs ? 'متابعة' : 'ابدأ التوقيت')}</button>${R.secs || R.run ? '<button class="btn ghost sm" data-act="rk-treset">تصفير</button>' : ''}</div></div>
   ${!R.sid ? `<label class="fld" style="max-width:220px"><span>التاريخ</span><input type="date" id="rk-date" data-rn="date" value="${esc(R.date)}"></label>` : ''}
   <div class="row"><label class="check"><input type="checkbox" id="rk-quick" data-rn="quick" ${R.quick ? 'checked' : ''}> تقييم سريع بدون عدّ</label><button class="btn ghost sm" data-act="rk-plan">سمّع المطلوب من الخطة</button></div>
   ${R.segs.map((g, i) => segHtml(g, i)).join('')}
   <div><button class="btn sm" data-act="rk-add">+ مقطع آخر</button></div>
   <label class="fld"><span>ملاحظة للطالب وولي الأمر (اختياري)</span><input id="rk-note" data-rn="note" value="${esc(R.note)}" placeholder="مثال: انتبه لأحكام المد"></label>
   <div class="dlg-foot"><button class="btn pri" data-act="rk-save">حفظ التسميع</button>${R.where === 'inline' && R.uid === ses.current && (ses.queue || []).length ? '<button class="btn" data-act="rk-save-next">حفظ والتالي</button>' : ''}<button class="btn ghost" data-act="rk-cancel">إلغاء</button></div>
  </div>`;
}
function refreshRec() { if (!ST.rec) return; if (ST.rec.where === 'modal') { const m = $('#modal .dlg'); if (m) m.innerHTML = recPanelHtml(); } else render(); }
async function saveRec(next) {
  const R = ST.rec; if (!R) return;
  const items = [];
  for (const [gi, g] of R.segs.entries()) {
    if (g.parts) {
      if (R.quick && !g.q) return toast('اختر التقدير لكل مقطع');
      // كل سورة تنحفظ لحالها، والتقدير واحد للمقطع كله (الأخطاء على أول سطر)
      g.parts.forEach((x, k) => items.push({ type: g.type, surah: +x.surah, from: +x.from, to: +x.to, full: +x.from === 1 && +x.to === AYAS[x.surah - 1], mistakes: k ? 0 : g.m, alerts: k ? 0 : g.a, quickGrade: R.quick ? g.q : undefined, grp: 'g' + gi }));
      continue;
    }
    const s = +g.surah; const n = AYAS[s - 1];
    if (!n) return toast('اختر السورة لكل مقطع');
    const from = g.full ? 1 : +g.from, to = g.full ? n : +g.to;
    if (!(from >= 1 && to >= from && to <= n)) return toast('تأكد من آيات ' + SN[s - 1] + ' (عدد آياتها ' + n + ')');
    if (R.quick && !g.q) return toast('اختر التقدير لكل مقطع');
    items.push({ type: g.type, surah: s, from, to, full: !!g.full, mistakes: g.m, alerts: g.a, quickGrade: R.quick ? g.q : undefined });
  }
  const r = await act('rec.addMany', { uid: R.uid, lessonId: R.sid, date: R.date, secs: recSecs(), note: R.note, items }, x => x.offline ? '' : 'سُجّل التسميع: ' + (x.grade || ''));
  if (!r) return;
  const where = R.where, sid = R.sid, after = R.after; ST.rec = null; ST.busyFs = where === 'fs';
  if (where === 'modal') closeModal();
  if (after) { after(); return; }
  if (next && sid) { const s = { ...S.sessions[sid], id: sid }; const q = [...(s.queue || [])]; const nx = q.shift() || null; await setQueue(s, q, nx); if (nx && S.users[nx]) { startRec(nx, sid, where === 'fs' ? 'fs' : 'inline'); if (where === 'fs') ST.rec.cur = 0; } }
  ST.busyFs = false;
  render();
}
function recEditModal(r) {
  openModal(`${dlgHead('تعديل التسميع')}<div class="muted">${esc((S.users[r.uid] || {}).name || '')}</div>
  <form data-form="rec-edit" data-id="${r.id}">
    <div class="fgrid"><label class="fld"><span>النوع</span><select name="type">${Object.keys(TYPE).map(k => `<option value="${k}" ${r.type === k ? 'selected' : ''}>${TYPE[k]}</option>`).join('')}</select></label>
    <label class="fld"><span>التاريخ</span><input type="date" name="date" value="${esc(r.date)}"></label></div>
    <label class="fld"><span>السورة</span><select name="surah" required>${surahOptions(r.surah)}</select></label>
    <div class="fgrid"><label class="fld"><span>من آية</span><input name="from" type="number" min="1" value="${r.from}" required></label><label class="fld"><span>إلى آية</span><input name="to" type="number" min="1" value="${r.to}" required></label></div>
    ${r.quick ? `<label class="fld"><span>التقدير</span><select name="quickGrade">${['ممتاز', 'جيد جدًا', 'جيد', 'يعاد'].map(t => `<option ${r.grade === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`
      : `<div class="fgrid"><label class="fld"><span>الأخطاء</span><input name="mistakes" type="number" min="0" value="${r.mistakes}"></label><label class="fld"><span>التنبيهات</span><input name="alerts" type="number" min="0" value="${r.alerts}"></label></div>`}
    <label class="fld"><span>ملاحظة</span><input name="note" value="${esc(r.note || '')}"></label>
    <div class="small muted">تعديل التسميع ما يرجّع الخطة التلقائية للخلف.</div>
    <div class="dlg-foot"><button class="btn pri" type="submit">حفظ</button><button type="button" class="btn" data-act="close">إلغاء</button></div>
  </form>`);
}
function issueModal(sid) {
  const opts = ['الرابط ما يفتح', 'ما يطلع صوتي أو المايك ما يشتغل', 'النت ضعيف', 'يطلب كلمة مرور للحصة'];
  openModal(`${dlgHead('مشكلة في الدخول')}<form data-form="issue" data-id="${sid}">
    <div class="small muted">اختر المشكلة، وتوصل للمعلم مباشرة.</div>
    <div class="qgrades">${opts.map((o, i) => `<label class="check"><input type="radio" name="opt" value="${esc(o)}" ${i ? '' : 'checked'}> ${esc(o)}</label>`).join('')}<label class="check"><input type="radio" name="opt" value=""> شيء ثاني</label></div>
    <label class="fld"><span>تفاصيل (اختياري)</span><input name="msg" maxlength="150"></label>
    <div class="dlg-foot"><button class="btn pri" type="submit">إرسال للمعلم</button><button type="button" class="btn" data-act="close">إلغاء</button></div>${supportBtn('أو تواصل مع الإدارة بالواتساب', 'السلام عليكم، عندي مشكلة في دخول الحصة')}</form>`);
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
    <label class="fld"><span>الحالة</span><select name="status"><option value="active" ${!st || st.status === 'active' ? 'selected' : ''}>نشط</option><option value="disabled" ${st && st.status === 'disabled' ? 'selected' : ''}>موقوف</option><option value="archived" ${st && st.status === 'archived' ? 'selected' : ''}>مؤرشف</option></select></label></div>
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
    <div class="row"><label class="check"><input type="checkbox" name="canPlan" ${!t || t.canPlan ? 'checked' : ''}> إعداد الخطط</label></div>
    ${t ? `<label class="fld"><span>الحالة</span><select name="status"><option value="active" ${t.status !== 'disabled' ? 'selected' : ''}>نشط</option><option value="disabled" ${t.status === 'disabled' ? 'selected' : ''}>موقوف</option></select></label>` : ''}
    <div class="dlg-foot"><button class="btn pri" type="submit">حفظ</button>${t ? `<button type="button" class="btn danger" data-act="del-user" data-id="${t.id}">حذف المعلم</button>` : ''}</div>
  </form>`);
}
function halqaModal(h) {
  const ts = L('users').filter(u => u.role === 'teacher' && u.status !== 'disabled'); const days = h && h.days && h.days.length ? h.days : SET().days;
  const g = inGirls() ? 'f' : 'm';
  openModal(`${dlgHead(h ? 'تعديل الحلقة' : g === 'f' ? 'حلقة جديدة · قسم البنات' : 'حلقة جديدة')}
  <form data-form="halqa" data-id="${h ? h.id : ''}">
    <label class="fld"><span>اسم الحلقة</span><input name="name" value="${esc(h ? h.name : '')}" required placeholder="${g === 'f' ? 'مثال: حلقة خديجة بنت خويلد' : 'مثال: حلقة أبي بن كعب'}"></label>
    <label class="fld"><span>المعلم</span><select name="teacherId"><option value="">بدون معلم</option>${ts.map(t => `<option value="${t.id}" ${h && h.teacherId === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>
    <div class="fld"><span>أيام الدوام</span><div class="days">${DAYN.map((d, i) => `<label><input type="checkbox" name="day" value="${i}" ${days.includes(i) ? 'checked' : ''}> ${d}</label>`).join('')}</div></div>
    <label class="fld"><span>الوقت المعتاد للحصة</span><input type="time" name="time" value="${esc(h ? h.time : '')}"></label>
    <div class="fgrid"><label class="fld"><span>نوع الحلقة</span><select name="mode">${Object.entries(MODE_L).map(([k, l]) => `<option value="${k}" ${(h ? h.mode || 'onsite' : 'onsite') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label><label class="fld"><span>مكانها في الجامع (اختياري)</span><input name="place" value="${esc(h ? h.place || '' : '')}" placeholder="مثال: القبو"></label></div>
    ${branches().length ? `<label class="fld"><span>المجمع</span><select name="branch"><option value="">—</option>${branches().map(b => `<option ${h ? (h.branch === b ? 'selected' : '') : (ST.branch === b ? 'selected' : '')}>${esc(b)}</option>`).join('')}</select></label>` : ''}
    <label class="fld"><span>رابط الحلقة الثابت (للحصص عن بعد: Zoom أو Meet)</span><input name="link" type="url" dir="ltr" value="${esc(h ? h.link : '')}" placeholder="https://"></label>
    <label class="check"><input type="checkbox" name="auto" ${!h || h.auto ? 'checked' : ''}> جدول ثابت: تنشأ الحصص لحالها حسب أيام الدوام والوقت</label>
    <div class="dlg-foot"><button class="btn pri" type="submit">حفظ</button>${h ? `<button type="button" class="btn danger" data-act="del-halqa" data-id="${h.id}">حذف الحلقة</button>` : ''}</div>
  </form>`);
}
function planModal(st) {
  const p = planOf(st); const a = p.auto; const dir = a.dir === 'fwd' ? 'fwd' : 'bwd'; const O = ORD[dir];
  const at = pos => { if (pos >= TOTAL || pos < 0) return null; const g = O.ord[pos]; const s = SUR[g] + 1; return { s, a: g - SSTART[s - 1] + 1 }; };
  const np = Math.max(0, Math.min(TOTAL, +a.newPos || 0)); const ms = Math.max(0, Math.min(np, +a.memStart || 0));
  const hasPrior = p.mode === 'auto' && np > ms;
  const pf = at(ms) || { s: dir === 'fwd' ? 1 : 114, a: 1 }; const pt = at(np - 1) || pf; const ns = at(np) || pf;
  const man = k => p.manual[k] || {};
  const amtSel = (name, val, opts) => `<select name="${name}">${opts.map(o => `<option value="${o}" ${+val === o ? 'selected' : ''}>${o ? fmtAmt(o) + (o < 1 ? ' (' + amtLines(o) + ')' : '') : 'بدون'}</option>`).join('')}</select>`;
  const autoOn = p.mode === 'auto';
  const posF = (label, sN, aN, sv, av) => `<div class="fld"><span>${label}</span><div class="pos-row"><select name="${sN}" aria-label="${label}: السورة">${surahOptions(sv)}</select><input name="${aN}" type="number" min="1" inputmode="numeric" value="${av}" aria-label="${label}: الآية" placeholder="آية"></div></div>`;
  openModal(`${dlgHead('خطة ' + esc(st.name))}
  <form data-form="plan" data-id="${st.id}">
    <div class="row"><label class="check"><input type="radio" name="mode" value="auto" data-change="plan-mode" ${autoOn ? 'checked' : ''}> تلقائية</label>
    <label class="check"><input type="radio" name="mode" value="manual" data-change="plan-mode" ${autoOn ? '' : 'checked'}> يدوية</label></div>
    <div id="pm-auto" ${autoOn ? '' : 'hidden'} style="display:grid;gap:12px">
      ${(SET().planTpls || []).length ? `<label class="fld"><span>قالب جاهز</span><select data-change="ptpl-fill"><option value="">اختر قالب…</option>${SET().planTpls.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></label>` : ''}
      <label class="fld"><span>اتجاه الحفظ</span><select name="dir"><option value="bwd" ${dir === 'bwd' ? 'selected' : ''}>من الناس إلى البقرة</option><option value="fwd" ${dir === 'fwd' ? 'selected' : ''}>من الفاتحة إلى الناس</option></select></label>
      <label class="check"><input type="checkbox" name="hasPrior" data-change="prior-toggle" ${hasPrior || !autoOn ? 'checked' : ''}> عنده حفظ سابق</label>
      <div id="pm-prior" class="prior" ${hasPrior || !autoOn ? '' : 'hidden'}>
        <div class="small muted">مثال: من الناس آية 1 إلى الملك آية 13. المراجعة تدور على هذا الحفظ من أوله، والحفظ الجديد يكمل بعد آخر آية فيه.</div>
        <div class="fgrid">${posF('من', 'pFromS', 'pFromA', pf.s, pf.a)}${posF('إلى', 'pToS', 'pToA', pt.s, pt.a)}</div>
      </div>
      <div id="pm-start" ${hasPrior || !autoOn ? 'hidden' : ''}>${posF('يبدأ الحفظ الجديد من', 'startS', 'startA', ns.s, ns.a)}</div>
      <div class="fgrid"><label class="fld"><span>الحفظ اليومي</span>${amtSel('newAmt', a.newAmt, [0, 0.125, 0.25, 0.5, 0.75, 1, 2])}</label>
      <label class="fld"><span>المراجعة اليومية</span>${amtSel('revAmt', a.revAmt, [0, 0.5, 1, 2, 3, 4, 5, 10, 20])}</label>
      <label class="fld"><span>التثبيت القريب (آخر المحفوظ)</span>${amtSel('tathAmt', a.tathAmt, [0, 0.5, 1, 2, 3, 5])}</label></div>
      <div class="small muted">تتقدم الخطة فقط إذا سمّع الطالب ونجح. إذا غاب أو أعاد يبقى نفس المقطع للحصة الجاية. وتقدر تعدّل المقادير في أي وقت.</div>
    </div>
    <div id="pm-manual" ${autoOn ? 'hidden' : ''} style="display:grid;gap:12px">
      <div class="small muted">حدد المقطع من سورة وآية إلى سورة وآية، ويقدر يمتد على أكثر من سورة. مثال: من الناس 1 إلى الملك 13.</div>
      ${['new', 'review', 'tath'].map(k => { const x = man(k); return `<div class="man-box"><b>${TYPE[k]}</b><div class="fgrid">${posF('من', `m-${k}-s`, `m-${k}-f`, x.surah || '', x.from || '')}${posF('إلى', `m-${k}-ts`, `m-${k}-t`, x.toSurah || x.surah || '', x.to || '')}</div></div>`; }).join('')}
      <div class="small muted">اترك السورة «—» إذا ما فيه مطلوب من هذا النوع.</div>
      <label class="fld"><span>التثبيت القريب: آخر ما حفظه (يُحسب لحاله إذا ما حددت تثبيت)</span><select name="near">${[0, 0.5, 1, 2, 3, 5].map(o => `<option value="${o}" ${+(p.near || 0) === o ? 'selected' : ''}>${o ? 'آخر ' + fmtAmt(o) : 'بدون'}</option>`).join('')}</select></label>
    </div>
    <details class="pause" ${p.paused && p.paused.from ? 'open' : ''}><summary>إيقاف الخطة مؤقتًا</summary>
      <div class="fgrid"><label class="fld"><span>من</span><input type="date" name="pzFrom" value="${(p.paused || {}).from || ''}"></label><label class="fld"><span>إلى (اختياري)</span><input type="date" name="pzTo" value="${(p.paused || {}).to || ''}"></label></div>
      <label class="fld"><span>السبب (اختياري)</span><input name="pzReason" maxlength="100" value="${esc((p.paused || {}).reason || '')}" placeholder="مثال: سفر"></label>
      <div class="small muted">اترك «من» فاضي عشان تلغي الإيقاف.</div></details>
    <div class="dlg-foot"><button class="btn pri" type="submit">حفظ الخطة</button><button type="button" class="btn" data-act="close">إلغاء</button></div>
  </form>`);
}
function pwModal() {
  openModal(`${dlgHead('تغيير كلمة المرور')}<form data-form="mypw"><label class="fld"><span>كلمة المرور الحالية</span><input name="old" type="password" required autocomplete="current-password"></label><label class="fld"><span>كلمة المرور الجديدة</span><input name="pw" type="password" required minlength="4" autocomplete="new-password"></label><div class="dlg-foot"><button class="btn pri" type="submit">حفظ</button></div></form>`);
}
const regLink = hid => location.origin + '/' + (hid ? '?join=' + hid : inGirls() ? '#register-f' : '#register');
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('تم النسخ'); }
  catch { openModal(`${dlgHead('انسخ النص')}<input id="cp-x" dir="ltr" value="${esc(text)}" readonly><div class="small muted">حدّد النص وانسخه.</div>`); setTimeout(() => { const i = $('#cp-x'); if (i) { i.focus(); i.select(); } }, 40); }
}

/* ---------------- actions ---------------- */
const curSession = () => ({ ...S.sessions[ST.sid], id: ST.sid });
const setQueue = (s, queue, current) => act('lesson.queue', current === undefined ? { id: s.id, queue } : { id: s.id, queue, current });
const ACT = {
  'tab': el => go(el.dataset.v),
  'pw-eye': el => { const i = el.parentElement.querySelector('input'); const show = i.type === 'password'; i.type = show ? 'text' : 'password'; el.textContent = show ? 'إخفاء' : 'إظهار'; },
  'forgot': () => openModal(`${dlgHead('نسيت كلمة المرور؟')}<p>كلمة المرور ما نقدر نرسلها، لكن الإدارة تعطيك كلمة مرور جديدة بالواتساب خلال دقائق.</p><div class="dlg-foot">${supportBtn('اطلب كلمة مرور جديدة', 'السلام عليكم، نسيت كلمة المرور لحساب الطالب: ') || '<span class="muted">تواصل مع إدارة الحلقة.</span>'}</div>`),
  'tour': () => showTour(0),
  'wa-refresh': () => { ST.wa = null; render(); },
  'wa-retry-all': () => act('wa.retryFailed', {}, r => 'رجعت ' + (r.n || 0) + ' رسالة للإرسال').then(() => { ST.wa = null; render(); }),
  'wa-c-send': async () => { const t = ($('#wa-c-text') || {}).value || ''; if (t.trim().length < 3) return toast('اكتب الرسالة'); const r = await act('wa.sendText', { phone: ST.waC, text: t }); if (r) { closeModal(); toast(r.ok ? 'انرسلت من رقم الحلقة ✓' : 'ما انرسلت الحين، بتنعاد تلقائيًا'); } },
  'wa-send-all': async el => { const as = [...document.querySelectorAll('#modal a.btn.wa:not(.sent)')]; if (!as.length) return toast('كلها مرسلة'); el.disabled = true; el.textContent = 'يرسل…'; for (const a of as) await waSendLink(a); el.textContent = 'تم'; },
  'wa-week-now': async () => { const f = document.querySelector('form[data-form=wa]'); if (f) { const ok = await act('wa.save', { data: waFormData(f) }); if (ok === null) return; } act('wa.weekNow', {}, r => 'انضاف ' + (r.n || 0) + ' تقرير للإرسال').then(() => { ST.wa = null; render(); }); },
  'wa-week-h': el => act('wa.weekNow', { halqaId: el.dataset.h }, r => 'انضاف ' + (r.n || 0) + ' تقرير للإرسال عبر الواتساب'),
  'wa-smart': async () => {
    const ph = ($('#wa-sl-phone') || {}).value, pw = ($('#wa-sl-pw') || {}).value; const out = $('#wa-sl-out');
    if (!ph || !pw) return toast('اكتب الرقم وكلمة المرور');
    out.className = 'small muted'; out.textContent = 'جاري الربط…';
    const r = await act('wa.smartLogin', { phone: ph, password: pw });
    const pwEl = $('#wa-sl-pw'); if (pwEl) { pwEl.value = ''; delete pwEl.dataset.dirty; }
    if (!r) { out.textContent = ''; return; }
    ST.waSmart = r;
    if (!r.devices.length) { out.className = 'small c-bad'; out.textContent = 'دخلنا حسابك بس ما لقينا رقم واتساب مربوط فيه. اربط جوالك من موقع الواتس الذكي (امسح الباركود) وارجع اضغط «اربط». ' + (r.raw || ''); return; }
    if (r.devices.length === 1) return waSmartFill(r.devices[0].id);
    openModal(`${dlgHead('اختر رقم الواتساب')}<p class="small muted">حسابك فيه أكثر من رقم مربوط. اختر الرقم اللي ترسل منه الحلقة.</p><div class="list">${r.devices.map((d, i) => `<div class="item"><div class="grow"><b dir="auto">${esc(d.name || 'رقم ' + (i + 1))}</b>${d.status ? ` <span class="chip">${esc(d.status)}</span>` : ''}</div><button class="btn pri sm" data-act="wa-smart-pick" data-id="${esc(d.id)}">اختر</button></div>`).join('')}</div>`);
  },
  'wa-smart-pick': el => { closeModal(); waSmartFill(el.dataset.id); },
  'wa-retry': el => act('wa.retry', { id: el.dataset.id }, 'تمت إعادة الجدولة').then(() => { ST.wa = null; render(); }),
  'wa-cancel': el => act('wa.cancel', { id: el.dataset.id }, 'أُلغيت').then(() => { ST.wa = null; render(); }),
  'wa-now': el => act('wa.sendNow', { lessonId: el.dataset.id }, r => 'جاري إرسال ' + (r.n || 0) + ' رسالة').then(() => { (ST.waP || {})[el.dataset.id] = null; render(); }),
  'wa-test': async () => { const ph = ($('#wa-test-phone') || {}).value; const f = document.querySelector('form[data-form=wa]'); const out = $('#wa-test-out'); if (!ph) return toast('اكتب رقم الجوال'); out.textContent = 'جاري الإرسال…'; const r = await act('wa.test', { phone: ph, data: waFormData(f) }); ST.waTest = r ? { ok: r.ok, msg: (r.ok ? 'وصلت للمزوّد بنجاح، شيك على جوالك. ' : 'ما نجحت: ') + (r.resp || '') } : null; render(); },
  'kids': () => accounts().length > 1 ? kidsOverview() : kidsModal(),
  'switch': el => switchTo(el.dataset.id),
  'acc-rm': el => { saveAccounts(accounts().filter(x => x.id !== el.dataset.id)); if (!$('#modal').hidden) kidsModal(); else render(); },
  'tour-next': () => showTour(Math.min(TOUR.length - 1, (ST.tour || 0) + 1)),
  'tour-prev': () => showTour(Math.max(0, (ST.tour || 0) - 1)),
  'tour-end': () => { const u = me(); try { if (u) localStorage.setItem('irtaq-tour-' + u.id, '1'); } catch {} closeModal(); },
  'zoom': () => { ZOOM = ZOOM >= 1.25 ? 1 : ZOOM >= 1.12 ? 1.25 : 1.12; render(); toast(ZOOM === 1 ? 'الخط بالحجم العادي' : 'تم تكبير الخط'); },
  'lang': () => { LANG = LANG === 'en' ? 'ar' : 'en'; try { localStorage.setItem('irtaq-lang', LANG); } catch {} render(); },
  'push': () => enablePush(),
  'install': async () => { if (!INSTALL_EVT) return toast('من قائمة المتصفح اختر «إضافة إلى الشاشة الرئيسية»'); INSTALL_EVT.prompt(); try { await INSTALL_EVT.userChoice; } catch {} INSTALL_EVT = null; render(); },
  'cal': () => { ST.cal = !ST.cal; render(); },
  'cal-m': el => { ST.calMonth = el.dataset.v; render(); },
  'add-admin': () => adminModal(null),
  'edit-admin': el => adminModal({ ...S.users[el.dataset.id], id: el.dataset.id }),
  'preset': el => { const ps = PRESETS[el.dataset.k] || []; document.querySelectorAll('#modal input[name=perm]').forEach(c => c.checked = ps.includes(c.value)); },
  'assign': () => assignModal(),
  'handover': el => { const txt = handoverText(el.dataset.h); openModal(`${dlgHead('ملخص تسليم الحلقة')}<div class="small muted">انسخه وأرسله للمعلم الجديد.</div><textarea id="ho-t" rows="14" readonly dir="rtl">${esc(txt)}</textarea><div class="dlg-foot"><button class="btn pri" data-act="copy" data-text="${esc(txt)}">نسخ</button></div>`); },
  'msg-del': el => act('msg.delete', { id: el.dataset.id }),
  'logs-refresh': () => { ST.logs = null; render(); },
  'export-key': () => confirmBox('تولّد مفتاح تصدير جديد؟ الروابط القديمة في Google Sheets تتوقف.', 'توليد', () => act('exportKey.rotate', {}, 'تم توليد المفتاح')),
  'term-add': () => saveSettingsWith(d => d.terms.push({ id: 'tm' + Date.now().toString(36), name: 'فصل جديد', from: today(), to: addDays(today(), 90) }), 'أُضيف فصل، عدّل تواريخه واحفظ'),
  'term-del': el => saveSettingsWith(d => d.terms.splice(+el.dataset.i, 1), 'حُذف الفصل'),
  'theme': () => { THEME = isDarkNow() ? 'light' : 'dark'; applyTheme(); render(); toast(THEME === 'dark' ? 'صار المظهر داكن' : 'صار المظهر فاتح'); },
  'search': () => searchModal(),
  'gs-open': el => { closeModal(); go('student', { uid: el.dataset.id }); },
  'gs-halqa': el => { closeModal(); go('students', { halqa: el.dataset.id }); },
  'arch': el => { ST.arch = el.dataset.v === '1'; render(); },
  'tpl-apply': () => tplApplyModal(me()),
  'chk-all': () => document.querySelectorAll('#modal input[name=ids]:not(:disabled)').forEach(c => c.checked = true),
  'tpl-pick': el => tplPickModal({ ...S.users[el.dataset.id], id: el.dataset.id }),
  'mark-sent': el => { ST.sent = ST.sent || {}; ST.sent[el.dataset.k] = 1; setTimeout(() => { el.classList.add('sent'); el.textContent = 'أُرسل ✓'; }, 50); },
  'wa-absent': () => { const s = curSession(); const tp = SET().tpl.absent; waListModal('رسائل الغياب', studentsOf(s.halqaId).filter(x => (s.att || {})[x.id] === 'a').map(x => ({ key: 'a' + s.id + x.id, name: x.name, sub: x.parentName || '', link: x.parentPhone && waLink(x.parentPhone, fillTpl(tp, { student: x.name, halqa: halqaName(s.halqaId), date: fmtDate(s.date), fem: femSt(x) })) }))); },
  'wa-week': el => waListModal('التقرير الأسبوعي لأولياء الأمور', studentsOf(el.dataset.h).map(x => ({ key: 'w' + weekStartC(today()) + x.id, name: x.name, sub: x.parentName || '', link: x.parentPhone && waLink(x.parentPhone, weekMsg(x)) }))),
  'edit-goal': el => goalModal({ ...S.users[el.dataset.id], id: el.dataset.id }),
  'goal-del': el => act('goal.save', { id: el.dataset.id, goal: null }, 'حُذف الهدف').then(r => r && closeModal()),
  'plan-log': async el => { const r = await act('log.list', { target: el.dataset.id }); if (!r) return; openModal(`${dlgHead('سجل الخطة والتغييرات')}<div class="list">${(r.rows || []).length ? r.rows.map(x => `<div class="item"><div class="grow">${esc(x.text)}<div class="small muted">${esc(x.by)} · ${fmtDate(isoDate(new Date(x.at)))} ${clock(x.at)}</div></div></div>`).join('') : '<div class="empty small">ما فيه تغييرات مسجلة.</div>'}</div>`); },
  'reset-pw': el => { const st = S.users[el.dataset.id]; confirmBox('تولّد كلمة مرور جديدة لـ ' + esc(st.name) + '؟ القديمة تتوقف.', 'توليد', async () => { const r = await act('user.resetpw', { id: el.dataset.id }); if (!r) return; const msg = `السلام عليكم ورحمة الله، بيانات دخول ${st.name} في ${SET().center}:\nالرابط: ${location.origin}\nاسم المستخدم: ${r.username}\nكلمة المرور: ${r.pw}`; const l = st.parentPhone && waLink(st.parentPhone, msg);
    openModal(`${dlgHead('كلمة المرور الجديدة')}<dl class="kv"><dt>اسم المستخدم</dt><dd dir="ltr" style="text-align:right">${esc(r.username)}</dd><dt>كلمة المرور</dt><dd dir="ltr" style="text-align:right"><b class="num">${r.pw}</b></dd></dl><div class="dlg-foot">${l ? `<a class="btn wa" href="${l}" target="_blank" rel="noopener">إرسال لولي الأمر بالواتساب</a>` : ''}<button class="btn" data-act="copy" data-text="${esc(r.pw)}">نسخ</button></div>`); }); },
  'ann-del': el => confirmBox('تحذف الإعلان؟', 'حذف', () => act('ann.delete', { id: el.dataset.id }, 'حُذف')),
  'ann-read': el => act('ann.read', { id: el.dataset.id }),
  'tpl-add': () => saveSettingsWith(d => d.tpls.push({ id: 'x' + Date.now().toString(36), name: 'رسالة جديدة', text: 'السلام عليكم ورحمة الله، بخصوص ابنكم {الطالب} في {الحلقة}: ' }), 'أُضيفت رسالة، عدّل نصها واحفظ'),
  'tpl-del': el => saveSettingsWith(d => d.tpls.splice(+el.dataset.i, 1), 'حُذفت الرسالة'),
  'ptpl-add': () => saveSettingsWith(d => d.planTpls.push({ id: 'p' + Date.now().toString(36), name: 'قالب جديد', newAmt: 0.5, revAmt: 2, tathAmt: 1 }), 'أُضيف قالب، عدّله واحفظ'),
  'ptpl-del': el => saveSettingsWith(d => d.planTpls.splice(+el.dataset.i, 1), 'حُذف القالب'),
  'logout': async () => { try { await api('/api/logout', {}); } catch {} ST.view = null; await load(); },
  'to-reg': () => { ST.reg = true; render(); },
  'from-reg': () => { ST.reg = false; ST.regDone = false; try { history.replaceState(null, '', '/'); } catch { location.hash = ''; } render(); },
  'close': () => closeModal(),
  'confirm-yes': async () => { const f = CONFIRM; CONFIRM = null; closeModal(); if (f) await f(); },
  'my-pw': () => pwModal(),
  'filter-h': el => { ST.halqa = el.dataset.h; render(); },
  'set-tab': el => { ST.setTab = el.dataset.k; render(); window.scrollTo({ top: 0 }); },
  'range': el => { ST.range = el.dataset.d[0] === 'T' ? el.dataset.d : +el.dataset.d; render(); },
  'open-session': el => go('session', { sid: el.dataset.id }),
  'open-student': el => go('student', { uid: el.dataset.id }),
  'new-session': () => sessionModal(null),
  'edit-session': el => sessionModal({ ...S.sessions[el.dataset.id], id: el.dataset.id }),
  'del-session': el => { const s = S.sessions[el.dataset.id] || {}; confirmBox(s.auto ? 'تلغي هذه الحصة؟ تبقى في القائمة كحصة ملغاة وتقدر تسترجعها.' : 'تحذف الحصة؟ التسميع المسجّل فيها يبقى في سجل الطلاب.', s.auto ? 'إلغاء الحصة' : 'حذف', async () => { if (await act('lesson.delete', { id: el.dataset.id }, s.auto ? 'أُلغيت الحصة' : 'حُذفت الحصة')) { if (s.auto) render(); else go('sessions'); } }); },
  'lesson-restore': el => act('lesson.cancel', { id: el.dataset.id, v: false }, 'رجعت الحصة'),
  'att-all': () => { const s = curSession(); const map = {}; studentsOf(s.halqaId).forEach(x => { if (!(s.att || {})[x.id]) map[x.id] = 'p'; }); if (!Object.keys(map).length) return toast('كل الطلاب محضّرون'); act('lesson.att', { id: s.id, map }, 'تم تحضير ' + Object.keys(map).length); },
  'issue-clear': el => act('issue.clear', { id: ST.sid, uid: el.dataset.id }),
  'q-sort': el => { const s = curSession(); const q = [...(s.queue || [])]; if (!q.length) return toast('الطابور فاضي');
    if (el.dataset.k === 'join') { const jt = id => (S.joins[s.id + '_' + id] || {}).at || Infinity; q.sort((a, b) => jt(a) - jt(b)); }
    else { const wk = addDays(today(), -7); const cnt = id => L('recs').filter(r => r.uid === id && r.date >= wk).length; q.sort((a, b) => cnt(a) - cnt(b)); }
    setQueue(s, q).then(r => r && toast(el.dataset.k === 'join' ? 'رُتّب حسب وقت الدخول' : 'رُتّب: الأقل تسميعًا هالأسبوع أولًا')); },
  'rec-start': el => { startRec(el.dataset.id, ST.sid, 'inline'); render(); const p = document.querySelector('.recp'); if (p) p.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); },
  'rec-out': el => { startRec(el.dataset.id, '', 'modal'); openModal(recPanelHtml()); },
  'rk-timer': () => { const R = ST.rec; if (R.run) { R.secs = recSecs(); R.run = false; } else { R.run = true; R.t0 = Date.now(); } refreshRec(); },
  'rk-treset': () => { Object.assign(ST.rec, { secs: 0, run: false }); refreshRec(); },
  'rk-plan': () => { const R = ST.rec; const keep = { quick: R.quick, secs: R.secs, run: R.run, t0: R.t0, note: R.note, date: R.date }; startRec(R.uid, R.sid, R.where); Object.assign(ST.rec, keep); refreshRec(); },
  'rec-open': el => { ST.recOpen = ST.recOpen || {}; ST.recOpen[el.dataset.k] = !ST.recOpen[el.dataset.k]; render(); },
  'rk-add': () => { ST.rec.segs.push(blankSeg('review')); refreshRec(); },
  'rk-split': el => { const i = +el.dataset.i; const g = ST.rec.segs[i]; if (!g || !g.parts) return; ST.rec.segs.splice(i, 1, ...g.parts.map((x, k) => ({ ...blankSeg(g.type), surah: x.surah, from: x.from, to: x.to, retry: g.retry, m: k ? 0 : g.m, a: k ? 0 : g.a, q: g.q }))); refreshRec(); },
  'rk-rm': el => { ST.rec.segs.splice(+el.dataset.i, 1); refreshRec(); },
  'rk-inc': el => { const g = ST.rec.segs[+el.dataset.i]; g[el.dataset.k] = Math.max(0, (+g[el.dataset.k] || 0) + +el.dataset.d); refreshRec(); },
  'rk-q': el => { ST.rec.segs[+el.dataset.i].q = el.dataset.v; refreshRec(); },
  'rk-save': () => saveRec(false),
  'rk-save-next': () => saveRec(true),
  'rk-cancel': () => { const w = ST.rec && ST.rec.where; ST.rec = null; if (ST.seq && ST.seq.on) { ST.seq.on = false; toast('وقّفنا التسميع المتتابع، تقدر تكمّل من «كمّل»'); } if (w === 'modal') closeModal(); else render(); },
  'edit-rec': el => recEditModal({ ...S.recs[el.dataset.id], id: el.dataset.id }),
  'leave': el => act('leave', { lessonId: el.dataset.id }, 'تم تسجيل خروجك من الحصة'),
  'ready': el => act('queue.ready', { lessonId: el.dataset.id, v: el.dataset.v === '1' }, el.dataset.v === '1' ? 'انضفت للطابور' : 'طلعت من الطابور'),
  'issue-open': el => issueModal(el.dataset.id),
  'issue-cancel': el => act('issue', { lessonId: el.dataset.id, clear: true }),
  'hol-del': el => { const st = SET(); act('holidays.save', { list: (st.holidays || []).filter(h => !(h.from === el.dataset.from && h.to === el.dataset.to)) }, 'حُذفت الإجازة'); },
  'att': el => { const s = curSession(); const cur = (s.att || {})[el.dataset.id]; const v = cur === el.dataset.v ? null : el.dataset.v;
    S.sessions[s.id] = { ...S.sessions[s.id], att: { ...(s.att || {}), [el.dataset.id]: v || undefined } }; if (!v) delete S.sessions[s.id].att[el.dataset.id]; render();
    act('lesson.att', { id: s.id, uid: el.dataset.id, v }); },
  'att-joined': () => { const s = curSession(); const map = {}; L('joins').filter(j => j.sid === s.id && S.users[j.uid]).forEach(j => { if (!(s.att || {})[j.uid]) map[j.uid] = 'p'; }); if (!Object.keys(map).length) return toast('ما فيه أحد دخل من الموقع بعد'); act('lesson.att', { id: s.id, map }, 'تم تحضير ' + Object.keys(map).length); },
  'att-rest': () => { const s = curSession(); const map = {}; studentsOf(s.halqaId).forEach(x => { if (!(s.att || {})[x.id]) map[x.id] = 'a'; }); if (!Object.keys(map).length) return toast('كل الطلاب محضّرون'); act('lesson.att', { id: s.id, map }); },
  'q-add': () => { const id = $('#q-pick').value; if (!id) return; const s = curSession(); clean(); setQueue(s, [...(s.queue || []), id]); },
  'q-all': () => { const s = curSession(); const q = [...(s.queue || [])]; studentsOf(s.halqaId).forEach(x => { const v = (s.att || {})[x.id]; if ((v === 'p' || v === 'l') && !q.includes(x.id) && x.id !== s.current) q.push(x.id); }); setQueue(s, q); },
  'q-up': el => { const s = curSession(); const q = [...s.queue]; const i = +el.dataset.i; if (i > 0) { [q[i - 1], q[i]] = [q[i], q[i - 1]]; setQueue(s, q); } },
  'q-down': el => { const s = curSession(); const q = [...s.queue]; const i = +el.dataset.i; if (i < q.length - 1) { [q[i + 1], q[i]] = [q[i], q[i + 1]]; setQueue(s, q); } },
  'q-rm': el => { const s = curSession(); const q = [...s.queue]; q.splice(+el.dataset.i, 1); setQueue(s, q); },
  'q-next': () => { const s = curSession(); const q = [...(s.queue || [])]; const nx = q.shift() || null; setQueue(s, q, nx); },
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
  'sec': async el => { const v = el.dataset.v === 'f' ? 'f' : 'm'; if (v === S.side) return; SEC = v; try { localStorage.setItem('irtaq-sec', v); } catch {} Object.assign(ST, { sid: null, uid: null, halqa: '', branch: '', q: '', logs: null, fs: null, selOn: false, sel: new Set() }); if (!['dash', 'sessions', 'students', 'halaqat', 'teachers', 'reports', 'store', 'anns', 'room', 'req', 'inbox', 'wa', 'complexes', 'settings', 'logs', 'help', 'meet'].includes(ST.view)) ST.view = 'dash'; document.body.classList.add('sec-switching'); await load(); document.body.classList.remove('sec-switching'); window.scrollTo(0, 0); toast(v === 'f' ? 'انتقلت لقسم البنات' : 'انتقلت لقسم البنين'); },
  'edit-halqa': el => halqaModal({ ...S.halaqat[el.dataset.id], id: el.dataset.id }),
  'del-halqa': el => confirmBox('تحذف الحلقة؟', 'حذف', () => act('halqa.delete', { id: el.dataset.id }, 'حُذفت الحلقة')),
  'edit-plan': el => planModal({ ...S.users[el.dataset.id], id: el.dataset.id }),
  'sf-add': () => { const hasMemo = SET().fields.some(f => f.type === 'memo'); openModal(`${dlgHead('إضافة حقل تسجيل')}<form data-form="sf-add"><label class="fld"><span>النوع</span><select name="type" data-change="sf-type"><option value="text">نص</option><option value="tel">رقم جوال</option><option value="number">رقم</option><option value="choice">اختيار من متعدد</option>${hasMemo ? '' : '<option value="memo">مقدار الحفظ (من سورة وآية إلى سورة وآية)</option>'}</select></label>
    <label class="fld"><span>اسم الحقل</span><input name="label" required placeholder="مثال: المرحلة الدراسية"></label>
    <div id="sf-choice" hidden style="display:grid;gap:8px"><label class="fld"><span>الخيارات (كل خيار في سطر)</span><textarea name="options" rows="4" placeholder="ابتدائي\nمتوسط\nثانوي"></textarea></label><label class="check"><input type="checkbox" name="multi"> يقدر يختار أكثر من خيار</label></div>
    <label class="check"><input type="checkbox" name="req"> إجباري</label><div class="dlg-foot"><button class="btn pri" type="submit">إضافة</button></div></form>`); },
  'sf-del': el => saveSettingsWith(d => { d.fields = d.fields.filter(f => f.k !== el.dataset.k); }, 'حُذف الحقل'),
};
/* لما يكون ربط الواتساب شغال: أي زر واتساب لولي أمر يرسل من رقم الحلقة مباشرة بدل ما يفتح واتساب المعلم */
const waAuto = () => S.waOn && me() && me().role !== 'student';
function waParse(href) { const m = /^https:\/\/wa\.me\/(\d{8,15})(?:\?text=(.*))?$/.exec(href || ''); if (!m) return null; let t = ''; try { t = decodeURIComponent(m[2] || ''); } catch {} return { phone: m[1], text: t }; }
async function waSendLink(a) {
  const w = waParse(a.getAttribute('href')); if (!w) return false;
  if (a.dataset.busy) return true;
  if (!w.text.trim() || w.text.trim() === 'السلام عليكم ورحمة الله،') { waCompose(w.phone, w.text); return true; }
  a.dataset.busy = 1; const old = a.textContent; a.textContent = 'يرسل…';
  const r = await act('wa.sendText', { phone: w.phone, text: w.text });
  delete a.dataset.busy;
  if (r && r.ok) { a.textContent = 'أُرسل ✓'; a.classList.add('sent'); if (a.dataset.k) { ST.sent = ST.sent || {}; ST.sent[a.dataset.k] = 1; } toast('انرسلت من رقم الحلقة ✓'); }
  else { a.textContent = old; if (r) toast('ما انرسلت الحين، بتنعاد تلقائيًا. ' + (r.resp || '')); }
  return true;
}
function waCompose(phone, text) {
  ST.waC = phone;
  openModal(`${dlgHead('رسالة لولي الأمر')}<div class="small muted">تنرسل من رقم الحلقة المربوط.</div><textarea id="wa-c-text" rows="5">${esc(text || 'السلام عليكم ورحمة الله، ')}</textarea><div class="dlg-foot"><button class="btn pri" data-act="wa-c-send">إرسال</button><button class="btn ghost" data-act="close">إلغاء</button></div>`);
}
document.addEventListener('click', e => {
  if (!waAuto()) return;
  const a = e.target.closest('a[href^="https://wa.me/"]'); const w = a && waParse(a.getAttribute('href')); if (!w) return;
  if (!L('users').some(x => x.role === 'student' && [x.parentPhone, x.phone].some(v => v && normPhone(v) === w.phone))) return;
  e.preventDefault(); e.stopPropagation(); waSendLink(a);
}, true);
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const fn = ACT[el.dataset.act]; if (!fn) return;
  if (el.tagName !== 'A') e.preventDefault();
  if (el.classList.contains('ms-it')) closeModal();
  fn(el, e);
});

const CHG = {
  'filter-h': el => { ST.halqa = el.value; delete el.dataset.dirty; render(); },
  'student-auto': el => { delete el.dataset.dirty; act('user.flag', { id: el.dataset.id, k: 'autoAllowed', v: el.checked }, el.checked ? 'سُمح بالخطة التلقائية' : 'أُلغي السماح بالخطة التلقائية'); },
  't-perm': el => { delete el.dataset.dirty; act('user.flag', { id: el.dataset.id, k: el.dataset.k, v: el.checked }, 'تم تحديث الصلاحية'); },
  'ptpl-fill': el => { const t = (SET().planTpls || []).find(x => x.id === el.value); if (!t) return; const f = el.closest('form'); [['newAmt', t.newAmt], ['revAmt', t.revAmt], ['tathAmt', t.tathAmt]].forEach(([n, v]) => { const sel = f.querySelector(`[name=${n}]`); if (!sel) return; if (![...sel.options].some(o => +o.value === +v)) sel.add(new Option(fmtAmt(v), v)); sel.value = String(v); [...sel.options].forEach(o => { if (+o.value === +v) o.selected = true; }); }); },
  'goal-term': el => { if (!el.value) return; const [a, b] = el.value.split('|'); const f = el.closest('form'); f.querySelector('[name=from]').value = a; f.querySelector('[name=by]').value = b; },
  'prior-toggle': el => { $('#pm-prior').hidden = !el.checked; $('#pm-start').hidden = el.checked; },
  'sf-type': el => { const c = $('#sf-choice'); if (c) c.hidden = el.value !== 'choice'; const lb = el.form.querySelector('[name=label]'); if (el.value === 'memo' && !lb.value) lb.value = 'مقدار الحفظ السابق'; },
  'memo-none': el => { const r = el.closest('.memo-fld').querySelector('.memo-rows'); if (r) r.hidden = el.checked; },
  'scope-mode': el => { const b = $('#scope-box'); if (b) b.hidden = el.value !== 'some'; },
  'plan-mode': el => { const auto = el.value === 'auto' && el.checked; $('#pm-auto').hidden = !auto; $('#pm-manual').hidden = auto; },
};
document.addEventListener('change', e => { const el = e.target.closest('[data-change]'); if (el && CHG[el.dataset.change]) CHG[el.dataset.change](el, e); });
let searchT = 0;
const INP = {
  'logq': el => { ST.logQ = el.value; clearTimeout(searchT); searchT = setTimeout(render, 250); },
  'gsearch': el => { const r = document.getElementById('gs-res'); if (r) r.innerHTML = searchResults(el.value); },
  'search': el => { ST.q = el.value; clearTimeout(searchT); searchT = setTimeout(render, 200); },
};
function recInput(el) {
  if (!ST.rec) return false;
  if (el.dataset.rf != null) { const g = ST.rec.segs[+el.dataset.i]; if (!g) return false; if (el.dataset.rf === 'full') g.full = el.checked; else g[el.dataset.rf] = el.value; return true; }
  if (el.dataset.rn) { if (el.dataset.rn === 'quick') ST.rec.quick = el.checked; else ST.rec[el.dataset.rn] = el.value; return true; }
  return false;
}
document.addEventListener('input', e => { recInput(e.target); });
document.addEventListener('change', e => { const el = e.target; if (recInput(el) && (['type', 'surah', 'full'].includes(el.dataset.rf) || el.dataset.rn === 'quick')) { const g = ST.rec.segs[+el.dataset.i]; if (g && el.dataset.rf === 'surah') { g.from = g.from || 1; const n = AYAS[+g.surah - 1]; if (n && (+g.to > n || !g.to)) g.to = n; } refreshRec(); } });
document.addEventListener('toggle', e => { if (e.target.dataset && e.target.dataset.actToggle === 'prep') ST.prepOpen = e.target.open; }, true);
document.addEventListener('input', e => { const el = e.target.closest('[data-input]'); if (el && INP[el.dataset.input]) INP[el.dataset.input](el, e); });

function waSmartFill(dev) {
  const jwt = (ST.waSmart || {}).jwt; if (!jwt || !dev) return;
  const set = (id, v) => { const el = document.getElementById(id); if (!el) return; if (el.type === 'checkbox') el.checked = v; else el.value = v; el.dataset.dirty = 1; };
  set('wa-method', 'POST_FORM'); set('wa-url', 'https://server.smart-whats.com/user/messages/send');
  set('wa-body', `jwt=${jwt}&devices=${dev}&message={message}&numbers={phone}`); set('wa-okWord', ''); set('wa-enabled', true);
  const out = $('#wa-sl-out'); if (out) { out.className = 'small c-ok'; out.textContent = 'تم الربط ✓ اضغط «حفظ ربط الواتساب» تحت، وبعدها جرّب رسالة على رقمك.'; }
  toast('تم الربط، باقي تضغط حفظ');
}
function waFormData(f) {
  const d = new FormData(f); const b = k => !!d.get(k);
  return { enabled: b('enabled'), method: d.get('method'), url: (d.get('url') || '').trim(), body: (d.get('body') || '').trim(), okWord: (d.get('okWord') || '').trim(), autoAbsent: b('autoAbsent'), autoLate: b('autoLate'), autoPresent: b('autoPresent'), autoRec: b('autoRec'), delayMin: +d.get('delayMin') || 0, autoWeek: b('autoWeek'), weekDay: +d.get('weekDay'), weekHour: +d.get('weekHour'), tplWeek: d.get('tplWeek'), tplPresent: d.get('tplPresent'), tplLate: d.get('tplLate'), tplRec: d.get('tplRec'), autoMonth: b('autoMonth'), monthDay: +d.get('monthDay') || 1, monthHour: +d.get('monthHour'), tplMonth: d.get('tplMonth'), tplLeft: d.get('tplLeft') };
}
function settingsData(f) {
  const d = new FormData(f); const st = SET();
  const fields = st.fields.map(x => ({ ...x, label: (d.get('lb-' + x.k) || x.label).trim() || x.label, on: !!d.get('on-' + x.k), req: !!d.get('req-' + x.k) && !!d.get('on-' + x.k),
    ...(x.type === 'choice' ? { options: String(d.get('opt-' + x.k) ?? (x.options || []).join('،')).split(/[،,\n]/).map(o => o.trim()).filter(Boolean), multi: d.has('opt-' + x.k) ? !!d.get('multi-' + x.k) : !!x.multi } : {}) }));
  const tpls = (st.tpls || []).map((t, i) => ({ id: t.id, name: (d.get('tpn-' + i) ?? t.name), text: (d.get('tpt-' + i) ?? t.text) }));
  const planTpls = (st.planTpls || []).map((t, i) => ({ id: t.id, name: d.get('ptn-' + i) ?? t.name, newAmt: +(d.get('pta-' + i) ?? t.newAmt), revAmt: +(d.get('ptr-' + i) ?? t.revAmt), tathAmt: +(d.get('ptt-' + i) ?? t.tathAmt) }));
  const points = {}; ['present', 'late', 'ex', 'vg', 'gd', 'page', 'absent', 'bad', 'streak10', 'streak30'].forEach(k => points[k] = +d.get('pt-' + k) || 0);
  const terms = (st.terms || []).map((t, i) => ({ id: t.id, name: d.get('tmn-' + i) ?? t.name, from: d.get('tmf-' + i) ?? t.from, to: d.get('tmt-' + i) ?? t.to }));
  const to0 = st.teacherOut || {}; const teacherOut = { mode: d.get('to-mode') || to0.mode || 'prayer', prayer: d.get('to-prayer') || to0.prayer || 'asr', after: d.has('to-after') ? +d.get('to-after') || 0 : (to0.after ?? 90), time: d.get('to-time') || to0.time || '17:00' };
  return { teacherOut, supportName: d.get('supportName') || '', supportPhone: d.get('supportPhone') || '', center: d.get('center'), days: d.getAll('day').map(Number), fields, tpls, planTpls, points, terms, board: d.get('board'), absentAlert: +d.get('absentAlert') || 3, recMin: +d.get('recMin') || 0, lateMin: d.get('lateMin') === '' || d.get('lateMin') == null ? 10 : +d.get('lateMin'), branches: String(d.get('branches') || '').split('\n').map(x => x.trim()).filter(Boolean),
    grade: { ex: +d.get('ex') || 0, vg: +d.get('vg') || 0, gd: +d.get('gd') || 0, alertsPer: Math.max(1, +d.get('alertsPer') || 3) }, tpl: { absent: d.get('absent'), excellent: d.get('excellent') } };
}
async function saveSettingsWith(mut, msg) {
  const f = document.querySelector('form[data-form=settings]'); const data = f ? settingsData(f) : { ...SET() };
  mut(data); if (await act('settings.save', { data }, msg)) clean();
}
/* ---------------- forms ---------------- */
const FORMS = {
  async login(f, d) {
    try { const r = await api('/api/login', { username: d.get('username'), password: d.get('password'), remember: true }); if (r.account) saveAccount(r.account); clean(); ST.view = null; ST.reg = false; await load(); }
    catch (e) { toast(e.message); }
  },
  async register(f, d) {
    const info = collectInfo(d, ST.regInfo?.fields || []); if (info._err) return toast(info._err);
    try {
      await api('/api/register', { name: d.get('name'), username: d.get('username'), password: d.get('password'), info, reqHalqa: f.dataset.hid || d.get('reqHalqa') || '', side: (ST.regInfo || {}).side || 'm' });
      ST.regCred = { name: d.get('name'), user: String(d.get('username')).trim().toLowerCase(), pw: d.get('password') };
      clean(); ST.regDone = true; render();
    } catch (e) { toast(e.message); }
  },
  async session(f, d) {
    const id = f.dataset.id;
    const data = { halqaId: d.get('halqaId'), date: d.get('date'), time: d.get('time'), link: (d.get('link') || '').trim(), note: (d.get('note') || '').trim() };
    if (d.has('subId')) data.subId = d.get('subId') || '';
    const r = await act('lesson.save', { id, data }, id ? 'حُفظت الحصة' : 'أُنشئت الحصة');
    if (r) { closeModal(); if (!id && r.id) go('session', { sid: r.id }); }
  },
  async 'rec-edit'(f, d) {
    const data = { type: d.get('type'), date: d.get('date'), surah: +d.get('surah'), from: +d.get('from'), to: +d.get('to'), mistakes: +d.get('mistakes') || 0, alerts: +d.get('alerts') || 0, quickGrade: d.get('quickGrade') || undefined, note: (d.get('note') || '').trim() };
    const n = AYAS[data.surah - 1]; if (!n || data.from < 1 || data.to < data.from || data.to > n) return toast('تأكد من أرقام الآيات');
    if (await act('rec.update', { id: f.dataset.id, data }, 'حُفظ التعديل')) closeModal();
  },
  async issue(f, d) {
    const msg = [d.get('opt'), (d.get('msg') || '').trim()].filter(Boolean).join(': ') || 'ما أقدر أدخل الحصة';
    if (await act('issue', { lessonId: f.dataset.id, msg }, 'وصلت للمعلم')) closeModal();
  },
  async 'hol-add'(f, d) {
    const from = d.get('from'), to = d.get('to') || from; if (to < from) return toast('تاريخ النهاية قبل البداية');
    const st = SET(); if (await act('holidays.save', { list: [...(st.holidays || []), { name: d.get('name'), from, to }] }, 'أُضيفت الإجازة')) { f.reset(); clean(); }
  },
  async student(f, d) {
    const info = collectInfo(d, SET().fields.map(x => ({ ...x, req: false }))); if (info._err) return toast(info._err);
    const r = await act('student.save', { id: f.dataset.id, data: { name: d.get('name'), username: d.get('username'), password: d.get('password'), halqaId: d.get('halqaId'), status: d.get('status'), info } }, f.dataset.id ? 'حُفظت البيانات' : 'أُضيف الطالب');
    if (r) closeModal();
  },
  async teacher(f, d) {
    const r = await act('teacher.save', { id: f.dataset.id, data: { name: d.get('name'), username: d.get('username'), password: d.get('password'), phone: d.get('phone'), canPlan: !!d.get('canPlan'), status: d.get('status') } }, f.dataset.id ? 'حُفظ' : 'أُضيف المعلم');
    if (r) closeModal();
  },
  async halqa(f, d) {
    const days = d.getAll('day').map(Number); if (!days.length) return toast('اختر يوم دوام واحد على الأقل');
    const r = await act('halqa.save', { id: f.dataset.id, data: { name: d.get('name'), teacherId: d.get('teacherId'), days, time: d.get('time'), link: (d.get('link') || '').trim(), auto: !!d.get('auto'), mode: d.get('mode') || 'onsite', place: d.get('place') || '', branch: d.has('branch') ? d.get('branch') : ((S.halaqat[f.dataset.id] || {}).branch || '') } }, r => (f.dataset.id ? 'حُفظت الحلقة' : 'أُنشئت الحلقة') + (r.fixed ? ` وتعدّل وقت ${r.fixed} حصة جاية` : ''));
    if (r) closeModal();
  },
  async plan(f, d) {
    const manual = {};
    for (const k of ['new', 'review', 'tath']) {
      const s1 = +d.get('m-' + k + '-s'); if (!s1) continue;
      const s2 = +d.get('m-' + k + '-ts') || s1; const a1 = +d.get('m-' + k + '-f') || 1; const a2 = +d.get('m-' + k + '-t') || AYAS[s2 - 1];
      if (a1 > AYAS[s1 - 1] || a2 > AYAS[s2 - 1] || (s1 === s2 && a1 > a2)) return toast('آيات ' + TYPE[k] + ' غير صحيحة');
      manual[k] = { surah: s1, from: a1, toSurah: s2, to: a2 };
    }
    const pz = d.get('pzFrom') ? { from: d.get('pzFrom'), to: d.get('pzTo') || '', reason: d.get('pzReason') || '' } : null;
    if (pz && pz.to && pz.to < pz.from) return toast('تاريخ نهاية الإيقاف قبل بدايته');
    const auto = { dir: d.get('dir'), hasPrior: !!d.get('hasPrior'), pFromS: +d.get('pFromS'), pFromA: +d.get('pFromA'), pToS: +d.get('pToS'), pToA: +d.get('pToA'), startS: +d.get('startS'), startA: +d.get('startA'), newAmt: +d.get('newAmt'), revAmt: +d.get('revAmt'), tathAmt: +d.get('tathAmt') };
    if (d.get('mode') === 'auto') {
      const O = ORD[auto.dir === 'fwd' ? 'fwd' : 'bwd'];
      const ok = (sv, av) => sv >= 1 && sv <= 114 && av >= 1 && av <= AYAS[sv - 1];
      if (auto.hasPrior) {
        if (!ok(auto.pFromS, auto.pFromA) || !ok(auto.pToS, auto.pToA)) return toast('تأكد من سور وآيات الحفظ السابق');
        if (O.pos[gOf(auto.pToS, auto.pToA)] < O.pos[gOf(auto.pFromS, auto.pFromA)]) return toast('نهاية الحفظ السابق قبل بدايته حسب اتجاه الحفظ');
      } else if (!ok(auto.startS, auto.startA)) return toast('تأكد من موضع بداية الحفظ');
    }
    const r = await act('plan.save', { id: f.dataset.id, mode: d.get('mode'), near: +d.get('near') || 0, paused: pz, manual, auto }, 'حُفظت الخطة');
    if (r) closeModal();
  },
  async settings(f, d) {
    const data0 = settingsData(f); if (!data0.days.length) return toast('اختر يوم دوام واحد على الأقل');
    if (await act('settings.save', { data: data0 }, 'حُفظت الإعدادات')) clean(); return;
    const st = SET(); const days = d.getAll('day').map(Number);
    const fields = st.fields.map(x => ({ ...x, label: (d.get('lb-' + x.k) || x.label).trim() || x.label, on: !!d.get('on-' + x.k), req: !!d.get('req-' + x.k) && !!d.get('on-' + x.k) }));
    const data = { center: d.get('center'), days, fields, absentAlert: +d.get('absentAlert') || 3, grade: { ex: +d.get('ex') || 0, vg: +d.get('vg') || 0, gd: +d.get('gd') || 0, alertsPer: Math.max(1, +d.get('alertsPer') || 3) }, tpl: { absent: d.get('absent'), excellent: d.get('excellent') } };
    if (await act('settings.save', { data }, 'حُفظت الإعدادات')) clean();
  },
  async 'sf-add'(f, d) {
    const type = d.get('type'); const opts = String(d.get('options') || '').split(/\n|،|,/).map(o => o.trim()).filter(Boolean);
    if (type === 'choice' && opts.length < 2) return toast('اكتب خيارين على الأقل');
    const nf = { k: type === 'memo' ? 'memo' : 'c_' + Date.now().toString(36), label: d.get('label').trim(), type, on: true, req: !!d.get('req'), custom: true, ...(type === 'choice' ? { options: opts, multi: !!d.get('multi') } : {}) };
    closeModal(); await saveSettingsWith(x => x.fields.push(nf), 'أُضيف الحقل');
  },
  async ann(f, d) {
    if (await act('ann.save', { title: d.get('title'), body: d.get('body'), halqaId: d.get('halqaId') || '' }, 'نُشر الإعلان')) { f.reset(); clean(); }
  },
  async wird(f, d) {
    const done = new Set(d.getAll('it')); const w0 = wirdOf(ST.meId, today()); const items = planGroups(me()).map(g => ({ k: groupKey(g), done: done.has(groupKey(g)), n: repsOf(w0, groupKey(g)) }));
    if (await act('wird.save', { date: today(), items, read: +d.get('read') || 0, note: d.get('note') || '' }, 'حُفظت مهام اليوم')) clean();
  },
  async 'tpl-apply'(f, d) {
    const t = (SET().planTpls || []).find(x => x.id === d.get('tpl')); const ids = d.getAll('ids');
    if (!ids.length) return toast('اختر طالب واحد على الأقل');
    const r = await act('plan.applyTpl', { tpl: t, ids }, r => 'طُبّق على ' + r.done + (r.skipped ? '، وتُرك ' + r.skipped : ''));
    if (r) closeModal();
  },
  async goal(f, d) {
    if (await act('goal.save', { id: f.dataset.id, goal: { pages: +d.get('pages'), from: d.get('from'), by: d.get('by'), note: d.get('note') } }, 'حُفظ الهدف')) closeModal();
  },
  async admin(f, d) {
    const perms = d.getAll('perm').filter(p => d.get('scope') === 'some' || !/^(h|b):/.test(p));
    if (d.get('scope') === 'some' && !perms.some(p => /^(h|b):/.test(p))) return toast('اختر الحلقات أو الفروع اللي يتابعها');
    const r = await act('admin.save', { id: f.dataset.id, data: { name: d.get('name'), username: d.get('username'), password: d.get('password'), perms, status: d.get('status') } }, 'حُفظ');
    if (r) closeModal();
  },
  async assign(f, d) {
    const map = {}; for (const [k, v] of d.entries()) if (k.startsWith('h-')) { const id = k.slice(2); if ((S.users[id] || {}).halqaId !== v) map[id] = v; }
    if (!Object.keys(map).length) return closeModal();
    if (await act('students.assign', { map }, r => 'نُقل ' + r.n + ' طالب')) closeModal();
  },
  async 'add-kid'(f, d) {
    try { const r = await api('/api/login', { username: d.get('username'), password: d.get('password'), remember: true }); if (!r.account) return toast('هذا الحساب ليس حساب طالب'); saveAccount(r.account); closeModal(); ST.view = null; ST.tourShown = true; await load(); toast('أُضيف حساب ' + r.account.name); }
    catch (e) { toast(e.message); }
  },
  async wa(f, d) { if (await act('wa.save', { data: waFormData(f) }, 'حُفظ ربط الواتساب')) { ST.wa = null; clean(); render(); } },
  async msg(f, d) { if (await act('msg.send', { text: d.get('text') })) { f.reset(); clean(); } },
  async mypw(f, d) { if (await act('me.password', { old: d.get('old'), pw: d.get('pw') }, 'تم تغيير كلمة المرور')) closeModal(); },
};
document.addEventListener('submit', e => {
  const f = e.target.closest('form[data-form]'); if (!f) return; e.preventDefault();
  const btn = f.querySelector('[type=submit]'); if (btn) btn.disabled = true;
  Promise.resolve(FORMS[f.dataset.form](f, new FormData(f))).finally(() => { if (btn && btn.isConnected) btn.disabled = false; });
});
window.addEventListener('hashchange', () => render());

/* ================= تجربة الجوال: شاشات كاملة، سحب، اهتزاز، بدون نت ================= */
const buzz = p => { try { if (navigator.vibrate) navigator.vibrate(p); } catch {} };
let WAKE = null;
async function wake(on) { try { if (on && !WAKE && navigator.wakeLock) { WAKE = await navigator.wakeLock.request('screen'); WAKE.addEventListener('release', () => { WAKE = null; }); } else if (!on && WAKE) { await WAKE.release(); WAKE = null; } } catch {} }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && ST.fs) wake(true); });

const ICO = (() => {
  const s = d => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  return {
    dash: s('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>'), home: s('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>'),
    req: s('<path d="M4 4h16v12H4z"/><path d="M4 13h5l1 2h4l1-2h5"/>'), sessions: s('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
    students: s('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14c2.3 0 4 1.5 4.6 4"/>'),
    teachers: s('<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>'), halaqat: s('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>'),
    anns: s('<path d="M3 10v4h4l6 4V6L7 10z"/><path d="M17 9a4 4 0 0 1 0 6"/>'), room: s('<path d="M4 5h16v11H9l-5 4z"/>'),
    reports: s('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'), logs: s('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'),
    settings: s('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    help: s('<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01"/>'),
    more: s('<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>'),
    live: s('<rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10l6-3v10l-6-3"/>'),
    back: s('<path d="M9 6l6 6-6 6"/>'), undo: s('<path d="M9 14l-5-5 5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'),
    search: s('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'), kids: s('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M19 8v6M16 11h6"/>'),
    zoom: s('<path d="M4 20l6-16 6 16M6.5 14h7"/><path d="M19 7v6M16 10h6"/>'), lang: s('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>'),
    bell: s('<path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 20a2 2 0 0 0 4 0"/>'), install: s('<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>'),
    theme: s('<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>'), key: s('<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3"/>'),
    logout: s('<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11"/>'), mic: s('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'),
    swipe: s('<path d="M7 12h10M13 8l4 4-4 4"/><rect x="3" y="4" width="18" height="16" rx="3"/>'), grid: s('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
    check: s('<path d="M5 12l5 5 9-10"/>'),
    store: s('<rect x="3" y="9" width="18" height="12" rx="2"/><path d="M12 9v12M3 13h18"/><path d="M12 9C10.5 5.5 7 5 7 7.2 7 9 12 9 12 9s5 0 5-1.8C17 5 13.5 5.5 12 9z"/>'),
    meet: s('<rect x="2" y="7" width="13" height="11" rx="2.5"/><path d="M15 11l6-3.5v10L15 14"/><circle cx="8.5" cy="11" r="2"/><path d="M5.5 16c.6-1.4 1.7-2 3-2s2.4.6 3 2"/>'),
    complexes: s('<path d="M4 21V10.5l8-6 8 6V21"/><path d="M9.5 21v-5a2.5 2.5 0 0 1 5 0v5"/><path d="M12 2v2.5"/>'),
    wa: s('<path d="M4 20l1.2-3.6A8.5 8.5 0 1 1 8 19.3z"/><path d="M9.2 8.6c0 3.2 2.8 6.1 6.1 6.2l.9-1.6-2-1-1 .9c-1-.4-2.1-1.5-2.5-2.5l.9-1-1-2z"/>'),
  };
})();

/* ---------- بدون نت: التعديلات المهمة تنحفظ على الجوال وتنرسل لما يرجع الاتصال ---------- */
const OUTBOX_T = ['lesson.att', 'rec.addMany', 'wird.save', 'queue.ready'];
const outbox = () => { try { return JSON.parse(localStorage.getItem('irtaq-outbox') || '[]'); } catch { return []; } };
const saveOutbox = a => { try { localStorage.setItem('irtaq-outbox', JSON.stringify(a)); } catch {} };
let flushing = false;
async function flushOutbox() {
  if (flushing) return; const box = outbox(); if (!box.length || !navigator.onLine) return;
  flushing = true; let sent = 0; const left = [];
  for (const it of box) {
    if (left.length) { left.push(it); continue; }
    try { await api('/api/act', it.body); sent++; }
    catch (e) { if (e.status) { sent++; } else left.push(it); } // خطأ من الخادم = ما فيه فايدة نعيده
  }
  saveOutbox(left); flushing = false;
  if (sent) { toast('انرسلت ' + sent + ' تعديلات كانت محفوظة على الجوال ✓'); buzz(20); }
}
window.addEventListener('online', () => { flushOutbox().then(load); });
function queueOffline(t, payload) {
  const box = outbox(); box.push({ at: Date.now(), body: { t, ...(payload || {}) } }); saveOutbox(box);
  OFFLINE = true; toast('ما فيه نت. انحفظ على جوالك وبيترسل لحاله لما يرجع الاتصال'); buzz([20, 60, 20]); scheduleRender();
}

/* ---------- تنبيه دور الطالب ---------- */
function liveSession(u) {
  const t = today();
  return L('sessions').filter(x => x.halqaId === u.halqaId && x.date === t && !x.cancelled && lessonMode(x) !== 'onsite').sort((a, b) => a.time.localeCompare(b.time))
    .find(x => { const d = lessonTs(x) - Date.now(); return d < 30 * 60000 && d > -3 * 3600000; }) || null;
}
function checkTurn() {
  const u = me(); if (!u || u.role !== 'student') return;
  const s = liveSession(u); if (!s) { ST.lastTurn = null; return; }
  const pos = (s.queue || []).indexOf(u.id) + 1; const st = s.current === u.id ? 'cur' : pos ? 'q' + pos : '';
  const prev = ST.lastTurn; ST.lastTurn = st;
  if (prev === undefined || prev === null || prev === st) return;
  if (st === 'cur') { buzz([300, 120, 300, 120, 400]); toast('دورك الآن! المعلم ينتظرك'); notifyLocal('دورك الآن', 'المعلم ينتظرك في الحصة'); }
  else if (st === 'q1') { buzz([150, 80, 150]); toast('أنت التالي، استعد'); notifyLocal('أنت التالي', 'استعد، دورك بعد اللي يسمّع الحين'); }
}
function notifyLocal(title, body) {
  try { if (document.visibilityState === 'visible' || !SW_REG || Notification.permission !== 'granted') return; SW_REG.showNotification(title, { body, tag: 'turn', renotify: true, vibrate: [300, 100, 300], icon: '/icon-192.png' }); } catch {}
}

/* ---------- الشاشات الكاملة ---------- */
function fsWrap(title, sub, body, foot = '', cls = '') {
  return `<div class="fs ${cls}"><header class="fs-top"><button class="fs-x" data-act="fs-close" aria-label="رجوع">${ICO.back}</button><div class="fs-t"><b>${title}</b>${sub ? `<span>${sub}</span>` : ''}</div></header>
  <div class="fs-body">${body}</div>${foot ? `<footer class="fs-foot">${foot}</footer>` : ''}</div>`;
}
function fsV(u) {
  if (ST.fs === 'live') return u.role === 'student' ? liveV(u) : '';
  const s = S.sessions[ST.sid] && { ...S.sessions[ST.sid], id: ST.sid };
  if (!s || u.role === 'student') return '';
  if (ST.fs === 'rec1') return rec1V(s);
  if (ST.fs === 'swipe') return swipeV(s);
  if (ST.fs === 'board') return boardV(s);
  return '';
}
function openFs(k, extra) { clean(); Object.assign(ST, { fs: k }, extra || {}); wake(true); render(); window.scrollTo(0, 0); }
function closeFs() { ST.fs = null; ST.sw = null; if (ST.rec && ST.rec.where === 'fs') ST.rec = null; wake(false); render(); window.scrollTo(0, 0); }

/* شاشة الحصة الحية للطالب وولي الأمر */
function liveV(u) {
  const s = liveSession(u); const hs = S.halaqat[u.halqaId] || {};
  if (!s) return fsWrap('شاشة الحصة', esc(hs.name || ''), `<div class="lv-empty">${ICO.live}<b>ما فيه حصة الحين</b><span>هالشاشة تشتغل قبل الحصة بنص ساعة. ارجع لها وقت الحصة.</span></div>`);
  const link = effLink(s); const q = s.queue || []; const pos = q.indexOf(u.id) + 1; const isCur = s.current === u.id;
  const issue = (s.issues || {})[u.id]; const j = S.joins[s.id + '_' + u.id]; const ts = lessonTs(s); const started = ts <= Date.now(); const v = (s.att || {})[u.id];
  const qn = s.qnames || [];
  let ring;
  if (isCur) ring = `<div class="lv-ring cur"><b>الآن</b><span>دورك، المعلم ينتظرك</span></div>`;
  else if (pos) ring = `<div class="lv-ring q"><b class="num">${pos}</b><span>${pos === 1 ? 'أنت التالي، استعد' : 'ترتيبك في الطابور'}</span></div>`;
  else if (!started) ring = `<div class="lv-ring wait"><b class="lv-cd" data-cd="${ts}">${cdText(ts)}</b><span>${fmtTime(s.time)}</span></div>`;
  else ring = `<div class="lv-ring idle"><b>${ICO.mic}</b><span>${j ? 'إذا جاهز تسمّع اضغط تحت' : 'الحصة بدأت، ادخل الحين'}</span></div>`;
  const body = `
    <div class="lv-stage">${ring}
      ${pos > 1 ? `<div class="lv-sub">قدامك ${pos - 1} ${pos - 1 === 1 ? 'طالب' : 'طلاب'}، نعلمك بالاهتزاز لما يقرب دورك.</div>` : ''}
      ${v ? `<span class="chip ${ATTC[v]}">${ATT[v]}</span>` : ''}
    </div>
    ${(s.cname || qn.length) ? `<section class="lv-q"><div class="small muted">طابور التسميع</div><ol>${s.cname ? `<li class="cur"><span class="dot"></span>${esc(s.cname)} <em>يسمّع الآن</em></li>` : ''}${qn.map((x, i) => `<li class="${x.id === u.id ? 'me' : ''}"><span class="n">${i + 1}</span>${esc(x.n)}${x.id === u.id ? ' <em>(أنت)</em>' : ''}</li>`).join('')}</ol></section>` : ''}
    <div class="lv-actions">
      ${isCur ? '' : pos ? `<button class="btn" data-act="ready" data-id="${s.id}" data-v="0">اطلع من الطابور</button>` : `<button class="btn big lv-ready" data-act="ready" data-id="${s.id}" data-v="1">${ICO.mic} جاهز للتسميع</button>`}
      ${issue ? `<div class="note">وصلت مشكلتك للمعلم: ${esc(issue.msg)} <button class="btn ghost sm" data-act="issue-cancel" data-id="${s.id}">انحلت</button></div>` : `<button class="btn ghost" data-act="issue-open" data-id="${s.id}">عندي مشكلة في الدخول</button>`}
    </div>`;
  const foot = link ? `<a class="btn pri huge" href="${esc(link)}" target="_blank" rel="noopener" data-act="join" data-id="${s.id}">${ICO.live} ${j ? 'ارجع للحصة' : 'ادخل الحصة'}</a>` : '<span class="chip warn">الرابط ينزل قبل الحصة</span>';
  return fsWrap(esc(hs.name || 'الحصة'), fmtDate(s.date) + ' · ' + fmtTime(s.time), body, foot, isCur ? 'lv-hot' : '');
}

/* وضع التسميع بإبهام واحد */
function rec1V(s) {
  const R = ST.rec; if (!R || R.where !== 'fs') return '';
  const st = S.users[R.uid] || {}; const q = (s.queue || []).filter(id => S.users[id] && id !== R.uid); const nx = q[0] ? S.users[q[0]] : null;
  const i = Math.min(R.cur || 0, R.segs.length - 1); R.cur = i; const g = R.segs[i]; if (!g.surah && !g.parts && R.edit === undefined) R.edit = true; const gr = segGrade(g); const n = AYAS[+g.surah - 1];
  const segLabel = x => x.parts ? esc(partsText(x.parts)) + ` <span class="small muted">(${x.parts.length} سور)</span>` : x.surah ? `${esc(SN[x.surah - 1])} ${x.full ? 'كاملة' : '﴿' + (x.from === x.to ? x.from : x.from + '–' + x.to) + '﴾'}` : 'حدد المقطع';
  const tabs = R.segs.length > 1 ? `<div class="r1-tabs">${R.segs.map((x, k) => { const gk = segGrade(x); return `<button class="r1-tab ${k === i ? 'on' : ''}" data-act="r1-seg" data-i="${k}"><span>${TYPE[x.type]}</span>${gk ? `<i class="c-${gk.k}">${gk.t}</i>` : ''}</button>`; }).join('')}</div>` : '';
  const counters = R.quick
    ? `<div class="r1-quick">${['ممتاز', 'جيد جدًا', 'جيد', 'يعاد'].map(t => `<button class="r1-q ${g.q === t ? 'on ' + GRADE_K[t] : ''}" data-act="rk-q" data-i="${i}" data-v="${t}">${t}</button>`).join('')}</div>`
    : `<div class="r1-pads">
        <div class="r1-pad bad"><button class="r1-hit" data-act="r1-inc" data-k="m" data-d="1"><b class="num">${g.m}</b><span>+ خطأ</span></button><button class="r1-undo" data-act="r1-inc" data-k="m" data-d="-1" aria-label="إنقاص خطأ">−</button></div>
        <div class="r1-pad warn"><button class="r1-hit" data-act="r1-inc" data-k="a" data-d="1"><b class="num">${g.a}</b><span>+ تنبيه</span></button><button class="r1-undo" data-act="r1-inc" data-k="a" data-d="-1" aria-label="إنقاص تنبيه">−</button></div>
      </div>`;
  const body = `
    <div class="r1-head"><div class="r1-who"><b>${esc(st.name || '')}</b>${nx ? `<span>التالي: ${esc((nx.name || '').split(' ').slice(0, 2).join(' '))}</span>` : '<span>آخر واحد في الطابور</span>'}</div>
      <button class="r1-timer ${R.run ? 'run' : ''}" data-act="rk-timer"><span class="num" data-timer>${fmtDur(recSecs())}</span><small>${R.run ? 'إيقاف' : 'توقيت'}</small></button></div>
    ${tabs}
    <div class="r1-seg"><div class="r1-seg-t"><span class="chip">${TYPE[g.type]}</span>${g.retry ? '<span class="chip bad">إعادة</span>' : ''}<b>${segLabel(g)}</b>${g.parts ? (partsPages(g.parts) ? ` <span class="pg">${partsPages(g.parts)}</span>` : '') : g.surah ? pageTag(+g.surah, g.full ? 1 : +g.from, g.full ? n : +g.to) : ''}</div>
      <button class="btn ghost sm" data-act="r1-edit">${R.edit ? 'تم' : 'تعديل'}</button></div>
    ${R.edit ? `${segHtml(g, i)}<div class="row"><button class="btn sm" data-act="rk-add">+ مقطع</button><label class="check small"><input type="checkbox" id="rk-quick" data-rn="quick" ${R.quick ? 'checked' : ''}> تقييم سريع بدون عدّ</label></div>` : counters}
    <div class="r1-grade ${gr ? gr.k : ''}">${gr ? gr.t : 'اختر التقدير'}</div>
    <label class="fld"><span>ملاحظة (اختياري)</span><input id="rk-note" data-rn="note" value="${esc(R.note)}" placeholder="مثال: انتبه للمدود"></label>`;
  const foot = `${nx ? `<button class="btn pri huge" data-act="r1-save" data-next="1">حفظ والتالي</button>` : `<button class="btn pri huge" data-act="r1-save">حفظ وإنهاء</button>`}${nx ? `<button class="btn" data-act="r1-skip">ما رد</button>` : ''}`;
  return fsWrap('وضع التسميع', esc(halqaName(s.halqaId)), body, foot, 'r1');
}

/* تحضير بالسحب */
function swipeV(s) {
  const studs = studentsOf(s.halqaId); const att = s.att || {};
  if (!ST.sw || ST.sw.sid !== s.id) ST.sw = { sid: s.id, order: [...studs].sort((a, b) => (!!att[a.id]) - (!!att[b.id])).map(x => x.id), i: 0, hist: [] };
  const W = ST.sw; const ids = W.order.filter(id => S.users[id]); const done = ids.filter(id => att[id]).length;
  const joins = {}; L('joins').filter(j => j.sid === s.id).forEach(j => joins[j.uid] = j);
  const prog = `<div class="sw-prog"><div style="width:${ids.length ? Math.round(done / ids.length * 100) : 0}%"></div></div><div class="sw-count small muted">محضّر ${done} من ${ids.length}</div>`;
  if (!ids.length) return fsWrap('التحضير', '', '<div class="empty">ما فيه طلاب في هالحلقة.</div>');
  if (W.i >= ids.length) {
    const c = k => Object.values(att).filter(v => v === k).length;
    const body = `${prog}<div class="sw-done">${ICO.check}<b>خلص التحضير</b><div class="stats"><div class="stat"><b>${c('p')}</b><span>حاضر</span></div><div class="stat"><b>${c('l')}</b><span>متأخر</span></div><div class="stat"><b>${c('a')}</b><span>غائب</span></div><div class="stat"><b>${c('e')}</b><span>مستأذن</span></div></div></div>`;
    const foot = `${c('a') ? `<button class="btn wa" data-act="wa-absent">راسل الغائبين (${c('a')})</button>` : ''}<button class="btn" data-act="sw-again">راجع من البداية</button><button class="btn pri" data-act="fs-close">تم</button>`;
    return fsWrap('التحضير', esc(halqaName(s.halqaId)), body, foot);
  }
  const uid = ids[W.i]; const st = S.users[uid]; const v = att[uid]; const nxt = ids[W.i + 1] && S.users[ids[W.i + 1]]; const streak = absentStreak({ ...st, id: uid });
  const body = `${prog}
    <div class="sw-stack">
      ${nxt ? `<div class="sw-card back"><b>${esc(nxt.name)}</b></div>` : ''}
      <div class="sw-card" data-uid="${uid}"><span class="sw-tag p">حاضر</span><span class="sw-tag a">غائب</span>
        <div class="sw-av">${esc((st.name || '?').trim()[0] || '?')}</div><b class="sw-name">${esc(st.name)}</b>
        <div class="small muted">${joinText(joins[uid], s)}</div>
        ${streak >= absentLimit() ? `<span class="chip bad">غاب ${streak} متتالية</span>` : ''}${v ? `<span class="chip ${ATTC[v]}">الحين: ${ATT[v]}</span>` : ''}
        <div class="sw-hint"><span>← غائب</span><span>حاضر →</span></div></div>
    </div>`;
  const foot = `<div class="sw-btns"><button class="sw-b a" data-act="sw-mark" data-v="a">غائب</button><button class="sw-b e" data-act="sw-mark" data-v="e">مستأذن</button><button class="sw-b l" data-act="sw-mark" data-v="l">متأخر</button><button class="sw-b p" data-act="sw-mark" data-v="p">حاضر</button></div>
    <div class="row sw-sub"><button class="btn ghost sm" data-act="sw-undo" ${W.hist.length ? '' : 'disabled'}>${ICO.undo} تراجع</button><button class="btn ghost sm" data-act="sw-skip">تخطي</button></div>`;
  return fsWrap('التحضير بالسحب', esc(halqaName(s.halqaId)) + ' · ' + fmtTime(s.time), body, foot, 'sw');
}
function swMark(v) {
  const s = curSession(); const W = ST.sw; if (!W) return; const ids = W.order.filter(id => S.users[id]); const uid = ids[W.i]; if (!uid) return;
  const prev = (s.att || {})[uid] || null; W.hist.push({ uid, prev, i: W.i });
  const att = { ...(s.att || {}), [uid]: v }; S.sessions[s.id] = { ...S.sessions[s.id], att };
  W.i++; buzz(v === 'a' ? [25, 50, 25] : 18); render();
  act('lesson.att', { id: s.id, uid, v });
}

/* لوحة الحصة المباشرة للمعلم */
function boardV(s) {
  const studs = studentsOf(s.halqaId); const att = s.att || {}; const q = (s.queue || []).filter(id => S.users[id]); const iss = s.issues || {};
  const joins = {}; L('joins').filter(j => j.sid === s.id).forEach(j => joins[j.uid] = j);
  const inNow = studs.filter(x => joins[x.id] && !joins[x.id].left).length;
  const tile = x => {
    const j = joins[x.id]; const qi = q.indexOf(x.id); const cur = s.current === x.id; const is = iss[x.id]; const v = att[x.id];
    const cls = cur ? 'cur' : is ? 'iss' : qi >= 0 ? 'q' : j && !j.left ? 'in' : v === 'a' ? 'abs' : '';
    const line = cur ? 'يسمّع الآن' : is ? 'مشكلة: ' + esc(is.msg) : qi >= 0 ? 'الطابور ' + (qi + 1) : j ? (j.left ? 'طلع ' + clock(j.left) : 'داخل من ' + clock(j.at)) : 'ما دخل';
    return `<button class="bd-tile ${cls}" data-act="bd-tile" data-id="${x.id}">${qi >= 0 ? `<i class="bd-n">${qi + 1}</i>` : ''}<b>${esc((x.name || '').split(' ').slice(0, 2).join(' '))}</b><span>${line}</span>${v ? `<em class="c-${ATTC[v]}">${ATT[v]}</em>` : ''}</button>`;
  };
  const order = [...studs].sort((a, b) => { const r = x => s.current === x.id ? 0 : iss[x.id] ? 1 : q.includes(x.id) ? 2 + q.indexOf(x.id) / 1000 : joins[x.id] && !joins[x.id].left ? 3 : 4; return r(a) - r(b); });
  const body = `<div class="bd-stats"><div><b class="num">${inNow}/${studs.length}</b><span>داخلين</span></div><div><b class="num">${q.length}</b><span>بالطابور</span></div><div class="${Object.keys(iss).length ? 'bad' : ''}"><b class="num">${Object.keys(iss).length}</b><span>مشاكل</span></div><div><b class="num">${Object.keys(att).length}</b><span>محضّر</span></div></div>
    <div class="bd-grid">${order.map(tile).join('')}</div><div class="small muted center">تتحدث لحالها كل كم ثانية. اضغط على أي طالب للخيارات.</div>`;
  const foot = `<button class="btn pri" data-act="rec1-open">${ICO.mic} وضع التسميع</button><button class="btn" data-act="swipe-open">${ICO.swipe} التحضير</button>`;
  return fsWrap('لوحة الحصة', esc(halqaName(s.halqaId)) + ' · ' + fmtTime(s.time), body, foot, 'bd');
}
function boardSheet(uid) {
  const s = curSession(); const st = S.users[uid]; if (!st) return; const v = (s.att || {})[uid]; const inQ = (s.queue || []).includes(uid); const is = (s.issues || {})[uid];
  openModal(`${dlgHead(esc(st.name))}<div class="sheet">
    ${is ? `<div class="note bad-note">مشكلة دخول: ${esc(is.msg)}</div>` : ''}
    <div class="sw-btns">${['a', 'e', 'l', 'p'].map(k => `<button class="sw-b ${k} ${v === k ? 'on' : ''}" data-act="bd-att" data-id="${uid}" data-v="${k}">${ATT[k]}</button>`).join('')}</div>
    <button class="btn pri big" data-act="bd-rec" data-id="${uid}">${ICO.mic} سمّعه الحين</button>
    <button class="btn big" data-act="bd-q" data-id="${uid}">${inQ ? 'اطلعه من الطابور' : 'أضفه للطابور'}</button>
    ${is ? `<button class="btn big" data-act="bd-iss" data-id="${uid}">تم حل المشكلة</button>` : ''}
    <button class="btn ghost" data-act="open-student-fs" data-id="${uid}">ملف الطالب</button></div>`);
}

/* تنبيهات اليوم للمدير: كل تنبيه معه زر يحله */
function todayAlertsHtml(u) {
  const t = today(); const now = Date.now(); const todayL = L('sessions').filter(s => s.date === t && !s.cancelled);
  const items = [];
  todayL.filter(s => lessonMode(s) !== 'onsite' && !effLink(s) && lessonTs(s) + 3600000 > now).forEach(s => items.push({ k: 'warn', t: `حصة ${halqaName(s.halqaId)} ${fmtTime(s.time)} بدون رابط`, b: `<button class="btn sm" data-act="edit-session" data-id="${s.id}">أضف الرابط</button>` }));
  todayL.filter(s => !s.teacherAt && lessonTs(s) + 10 * 60000 < now && lessonTs(s) + 3 * 3600000 > now).forEach(s => {
    const h = S.halaqat[s.halqaId] || {}; const tid = s.subId || h.teacherId; const tch = S.users[tid] || {};
    const l = tch.phone && waLink(tch.phone, h.gender === 'f' ? `السلام عليكم، حصة ${h.name || ''} بدأت ${fmtTime(s.time)}، الطالبات ينتظرنكِ.` : `السلام عليكم، حصة ${h.name || ''} بدأت ${fmtTime(s.time)}، الطلاب ينتظرونك.`);
    items.push({ k: 'bad', t: `معلم ${halqaName(s.halqaId)} ما فتح الحصة (${esc(tch.name || 'بدون معلم')})`, b: l ? `<a class="btn wa sm" href="${l}" target="_blank" rel="noopener">راسله</a>` : `<button class="btn sm" data-act="open-session" data-id="${s.id}">افتح</button>` });
  });
  todayL.filter(s => lessonTs(s) + 25 * 60000 < now && !Object.keys(s.att || {}).length && studentsOf(s.halqaId).length).forEach(s => items.push({ k: 'warn', t: `حصة ${halqaName(s.halqaId)} ما تحضّرت`, b: `<button class="btn sm" data-act="open-session" data-id="${s.id}">حضّرها</button>` }));
  todayL.forEach(s => { const n = Object.keys(s.issues || {}).length; if (n) items.push({ k: 'bad', t: `${n} ${n === 1 ? 'طالب عنده' : 'طلاب عندهم'} مشكلة دخول في ${halqaName(s.halqaId)}`, b: `<button class="btn sm" data-act="open-session" data-id="${s.id}">شوف</button>` }); });
  const pend = L('users').filter(x => x.role === 'student' && x.status === 'pending').length;
  if (pend) items.push({ k: 'info', t: `${pend} طلب تسجيل ينتظرك`, b: `<button class="btn sm" data-act="tab" data-v="req">راجعها</button>` });
  if (S.waFailed) items.push({ k: 'bad', t: `${S.waFailed} رسالة واتساب ما انرسلت`, b: `<button class="btn sm" data-act="go-wa" data-v="log">السجل</button>` });
  if (isFullAdmin(u) && !S.waOn) items.push({ k: 'info', t: 'ربط الواتساب متوقف: رسائل الغياب والتقارير ما تطلع تلقائي', b: `<button class="btn sm" data-act="go-wa" data-v="conn">اربطه</button>` });
  const inact = inactiveList().length;
  if (inact) items.push({ k: 'info', t: `${inact} طالب ما دخلوا الموقع من أسبوعين`, b: `<button class="btn sm" data-act="go-inact">شوفهم</button>` });
  const unr = dmUnreadStaff(); if (unr) items.push({ k: 'info', t: `${unr} رسالة من أولياء الأمور ما انقرت`, b: `<button class="btn sm" data-act="tab" data-v="inbox">افتح</button>` });
  const lim = absentLimit(); const abs = L('users').filter(x => x.role === 'student' && x.status === 'active' && absentStreak(x) >= lim).length;
  if (abs) items.push({ k: 'warn', t: `${abs} ${abs === 1 ? 'طالب غاب' : 'طلاب غابوا'} ${lim} حصص متتالية أو أكثر`, b: `<button class="btn sm" data-act="scroll-abs">شوفهم</button>` });
  return `<section class="card al-card"><div class="sec-head"><h2>تنبيهات اليوم</h2>${items.length ? `<span class="chip ${items.some(x => x.k === 'bad') ? 'bad' : 'warn'}">${items.length}</span>` : ''}</div>
    ${items.length ? `<div class="al-list">${items.map(x => `<div class="al-item ${x.k}"><span class="al-dot"></span><div class="grow">${x.t}</div>${x.b}</div>`).join('')}</div>` : `<div class="al-ok">${ICO.check}<span>كل شي تمام اليوم</span></div>`}</section>`;
}

/* شريط التنقل السفلي في الجوال + قائمة «المزيد» */
function bottomNav(u, tabs, active) {
  const prim = u.role === 'student' ? tabs.slice(0, 3) : tabs.slice(0, 4);
  const live = u.role === 'student' && liveSession(u);
  const cnt = tabs.slice(prim.length).reduce((a, t) => a + (+t[2] || 0), 0);
  return `<nav class="bnav" aria-label="التنقل">${prim.map(([k, l, c]) => `<button class="bn ${k === active ? 'on' : ''}" data-act="tab" data-v="${k}">${ICO[k] || ICO.more}<span>${l}</span>${c ? `<i>${c}</i>` : ''}</button>`).join('')}
    ${u.role === 'student' ? `<button class="bn ${live ? 'hot' : ''}" data-act="live-open">${ICO.live}<span>${LANG === 'en' ? 'Class' : 'الحصة'}</span>${live ? '<i class="pulse"></i>' : ''}</button>` : ''}
    <button class="bn" data-act="drawer">${ICO.more}<span>${LANG === 'en' ? 'Menu' : 'القائمة'}</span>${cnt ? `<i>${cnt}</i>` : ''}</button></nav>`;
}
function moreSheet() {
  const u = me(); if (!u) return; const tabs = TABS[u.role](u); const prim = u.role === 'student' ? 3 : 4;
  const it = (act, icon, label, extra = '') => `<button class="ms-it" data-act="${act}" ${extra}>${ICO[icon] || ICO.more}<span>${label}</span></button>`;
  const rest = tabs.slice(prim).map(([k, l, c]) => it('tab-m', k, l + (c ? ` (${c})` : ''), `data-v="${k}"`)).join('');
  openModal(`${dlgHead(esc(u.name))}<div class="ms-grid">${rest}
    ${u.role !== 'student' ? it('search-m', 'search', 'بحث') : it('kids-m', 'kids', accounts().length > 1 ? 'أولادي (' + accounts().length + ')' : 'إضافة ابن') + it('zoom', 'zoom', ZOOM > 1 ? 'تصغير الخط' : 'تكبير الخط') + it('lang', 'lang', LANG === 'en' ? 'عربي' : 'English')}
    ${S.push && 'PushManager' in window ? it('push', 'bell', PUSH_ON ? 'إيقاف الإشعارات' : 'تفعيل الإشعارات') : ''}
    ${INSTALL_EVT ? it('install', 'install', 'تثبيت كتطبيق') : ''}
    ${it('theme', 'theme', isDarkNow() ? 'المظهر الفاتح' : 'المظهر الداكن')}${it('my-pw', 'key', 'كلمة المرور')}${it('logout', 'logout', 'خروج')}</div>`);
}

/* ---------- السحب: بطاقة التحضير، سحب للتحديث، والتنقل بين الأقسام ---------- */
const DRAG = { on: false, pending: false };
document.addEventListener('pointerdown', e => {
  const c = e.target.closest('.sw-card:not(.back)'); if (!c || e.target.closest('button')) return;
  Object.assign(DRAG, { on: true, el: c, x0: e.clientX, y0: e.clientY, dx: 0, id: e.pointerId }); try { c.setPointerCapture(e.pointerId); } catch {} c.style.transition = 'none';
});
document.addEventListener('pointermove', e => {
  if (!DRAG.on || e.pointerId !== DRAG.id) return; const dx = e.clientX - DRAG.x0; DRAG.dx = dx;
  DRAG.el.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`; const d = dx > 50 ? 'p' : dx < -50 ? 'a' : '';
  if (DRAG.el.dataset.dir !== d) { DRAG.el.dataset.dir = d; if (d) buzz(8); }
});
function dragEnd(e) {
  if (!DRAG.on || (e && e.pointerId !== DRAG.id)) return; DRAG.on = false; const el = DRAG.el; const dx = DRAG.dx; el.style.transition = '';
  if (Math.abs(dx) > 95) { el.style.transform = `translateX(${dx > 0 ? 700 : -700}px) rotate(${dx > 0 ? 25 : -25}deg)`; el.style.opacity = '0'; setTimeout(() => { DRAG.pending = false; swMark(dx > 0 ? 'p' : 'a'); }, 170); }
  else { el.style.transform = ''; el.dataset.dir = ''; if (DRAG.pending) { DRAG.pending = false; scheduleRender(); } }
}
document.addEventListener('pointerup', dragEnd); document.addEventListener('pointercancel', dragEnd);

let PTR = null;
function ptrEl() { if (!PTR) { PTR = document.createElement('div'); PTR.className = 'ptr'; PTR.innerHTML = '<div class="spin"></div>'; document.body.appendChild(PTR); } return PTR; }
const TOUCH = {};
const noSwipeZone = t => t.closest('.tbl-wrap, input, textarea, select, .sw-card, .seg, .tabs, .bnav, .set-tabs, .qgrades, .r1-tabs, .fs, #modal:not([hidden]), .tally, .cal');
document.addEventListener('touchstart', e => {
  if (e.touches.length !== 1) return; const t = e.touches[0];
  Object.assign(TOUCH, { x: t.clientX, y: t.clientY, at: Date.now(), top: window.scrollY <= 0, ok: !noSwipeZone(e.target), dy: 0 });
}, { passive: true });
document.addEventListener('touchmove', e => {
  if (!TOUCH.ok || !TOUCH.top || ST.fs || !$('#modal').hidden) return; const dy = e.touches[0].clientY - TOUCH.y; const dx = e.touches[0].clientX - TOUCH.x; TOUCH.dy = dy;
  if (dy > 10 && Math.abs(dx) < dy) { const p = ptrEl(); const h = Math.min(90, dy * 0.5); p.style.transform = `translate(-50%, ${h - 50}px) rotate(${dy * 2}deg)`; p.style.opacity = Math.min(1, dy / 140); p.classList.toggle('ready', dy > 150); }
}, { passive: true });
document.addEventListener('touchend', e => {
  const t = e.changedTouches[0]; const dx = t.clientX - TOUCH.x; const dy = t.clientY - TOUCH.y;
  if (PTR && PTR.style.opacity) {
    if (TOUCH.dy > 150 && TOUCH.top) { buzz(12); PTR.classList.add('busy'); PTR.style.transform = 'translate(-50%, 24px)'; flushOutbox().then(load).finally(() => { PTR.classList.remove('busy', 'ready'); PTR.style.opacity = ''; PTR.style.transform = ''; }); }
    else { PTR.style.opacity = ''; PTR.style.transform = ''; PTR.classList.remove('ready'); }
  }
}, { passive: true });

/* ---------- أزرار الشاشات الجديدة ---------- */
Object.assign(ACT, {
  'fs-close': () => { const R = ST.rec; if (ST.fs === 'rec1' && R && R.segs.some(g => g.m || g.a || g.q)) return confirmBox('تطلع بدون حفظ التسميع؟', 'اطلع', async () => closeFs()); closeFs(); },
  'live-open': () => { openFs('live'); const u = me(); const s = u && liveSession(u); if (s) ST.lastTurn = s.current === u.id ? 'cur' : ((s.queue || []).indexOf(u.id) + 1 ? 'q' + ((s.queue || []).indexOf(u.id) + 1) : ''); },
  'more': () => moreSheet(),
  'tab-m': el => { closeModal(); go(el.dataset.v); },
  'search-m': () => { closeModal(); setTimeout(() => searchModal(), 30); },
  'kids-m': () => { closeModal(); setTimeout(() => accounts().length > 1 ? kidsOverview() : kidsModal(), 30); },
  'scroll-abs': () => { const el = document.querySelector('.alert-card'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
  'rec1-open': async () => {
    let s = curSession(); let uid = s.current;
    if (!uid) { const q = [...(s.queue || [])]; if (!q.length) return toast('الطابور فاضي. أضف طلاب أو خلهم يضغطون «جاهز للتسميع»'); uid = q.shift(); await setQueue(s, q, uid); }
    closeModal(); startRec(uid, ST.sid, 'fs'); ST.rec.cur = 0; openFs('rec1');
  },
  'swipe-open': () => { closeModal(); ST.sw = null; openFs('swipe'); },
  'board-open': () => openFs('board'),
  'r1-seg': el => { ST.rec.cur = +el.dataset.i; ST.rec.edit = false; render(); },
  'r1-edit': () => { ST.rec.edit = !ST.rec.edit; render(); },
  'r1-inc': el => { const R = ST.rec; const g = R.segs[R.cur || 0]; const k = el.dataset.k; const d = +el.dataset.d; g[k] = Math.max(0, (+g[k] || 0) + d); buzz(d > 0 ? (k === 'm' ? 35 : 15) : 8); if (!R.run && !R.secs && d > 0) { R.run = true; R.t0 = Date.now(); } render(); },
  'r1-save': async el => { buzz(20); await saveRec(el.dataset.next === '1'); if (ST.fs === 'rec1' && !ST.rec) closeFs(); else render(); },
  'r1-skip': async () => { const s = curSession(); const me0 = ST.rec.uid; const q = [...(s.queue || [])].filter(id => id !== me0); const nx = q.shift() || null; q.push(me0); await setQueue(s, q, nx); if (nx) { startRec(nx, s.id, 'fs'); ST.rec.cur = 0; toast('انتقل لآخر الطابور'); render(); } else closeFs(); },
  'sw-mark': el => swMark(el.dataset.v),
  'sw-skip': () => { ST.sw.i++; buzz(8); render(); },
  'sw-again': () => { ST.sw.i = 0; ST.sw.hist = []; render(); },
  'sw-undo': () => { const W = ST.sw; const h = W && W.hist.pop(); if (!h) return; const s = curSession(); const att = { ...(s.att || {}) }; if (h.prev) att[h.uid] = h.prev; else delete att[h.uid]; S.sessions[s.id] = { ...S.sessions[s.id], att }; W.i = h.i; buzz(10); render(); act('lesson.att', { id: s.id, uid: h.uid, v: h.prev }); },
  'bd-tile': el => boardSheet(el.dataset.id),
  'bd-att': el => { const s = curSession(); const uid = el.dataset.id; const v = el.dataset.v; S.sessions[s.id] = { ...S.sessions[s.id], att: { ...(s.att || {}), [uid]: v } }; closeModal(); buzz(15); render(); act('lesson.att', { id: s.id, uid, v }); },
  'bd-q': el => { const s = curSession(); const uid = el.dataset.id; let q = [...(s.queue || [])]; q = q.includes(uid) ? q.filter(x => x !== uid) : [...q, uid]; closeModal(); setQueue(s, q); },
  'bd-rec': el => { closeModal(); startRec(el.dataset.id, ST.sid, 'fs'); ST.rec.cur = 0; openFs('rec1'); },
  'bd-iss': el => { closeModal(); act('issue.clear', { id: ST.sid, uid: el.dataset.id }); },
  'open-student-fs': el => { closeModal(); ST.fs = null; wake(false); go('student', { uid: el.dataset.id }); },
});

/* ================= غرفة الحصة داخل الموقع (فيديو) ================= */
// الغرفة في عنصر ثابت خارج #app، عشان ما تنقطع المكالمة لما تتنقل في الموقع أو تفتح التسميع والتحضير.
/* ---- الاجتماعات بالصوت والفيديو ---- */
const MEET_L = { admins: ['اجتماع الإدارة', 'للمدير العام وكل المشرفين والمشرفات من الدارين'], 't-m': ['اجتماع المعلمين', 'لمعلمي قسم البنين وإدارته'], 't-f': ['اجتماع المعلمات', 'لمعلمات قسم البنات وإدارته'] };
function meetV(u) {
  if (!S.videoOn) return `<h1>الاجتماعات</h1><div class="empty"><b>غرفة الفيديو متوقفة</b><span>${isFullAdmin(u) ? 'فعّلها من الإعدادات ← غرفة الحصة.' : 'تواصل مع المدير.'}</span></div>`;
  const keys = Object.keys(S.meets || {}).filter(k => MEET_L[k]);
  return `<div class="sec-head"><h1>الاجتماعات</h1></div><div class="small muted">اجتماع بالصوت والفيديو داخل الموقع مثل غرفة الحصة. «ادخل وأبلغهم» يرسل إشعار للمعنيين إن الاجتماع بدأ.</div>
  <div class="meet-grid">${keys.map(k => { const m = S.meets[k] || {}; const ppl = m.ppl || []; const live = ppl.length > 0; const [t, d] = MEET_L[k];
    return `<section class="card meet ${live ? 'live' : ''}"><div class="sec-head"><div><h2>${t}</h2><div class="small muted">${d}</div></div>${live ? '<span class="chip ok"><i class="dot-live"></i> شغّال الحين</span>' : '<span class="chip">ما بدأ</span>'}</div>
      ${live ? `<div class="small">داخل الاجتماع: <b>${ppl.map(p => esc(p.n)).join('، ')}</b>${m.by ? ` <span class="muted">· بدأه ${esc(m.by)} ${clock(m.at)}</span>` : ''}</div>` : ''}
      <div class="row"><button class="btn pri" data-act="meet-join" data-k="${k}">${ICO.live} ${live ? 'انضم للاجتماع' : 'ادخل'}</button>${live ? '' : `<button class="btn" data-act="meet-join" data-k="${k}" data-notify="1">ادخل وأبلغهم</button>`}</div></section>`; }).join('')}</div>`;
}
const ROOM = { sid: null, mode: 'full', url: '' };
function roomEl() {
  let r = document.getElementById('room');
  if (!r) { r = document.createElement('div'); r.id = 'room'; r.hidden = true; r.innerHTML = '<div class="room-bar"></div><div class="room-frame"></div>'; document.body.appendChild(r); }
  return r;
}
function roomBar() {
  const r = document.getElementById('room'); if (!r || r.hidden) return;
  const u = me(); const s = ROOM.sid && S.sessions[ROOM.sid]; const mini = ROOM.mode === 'mini';
  let extra = '';
  if (u && u.role === 'student' && s && ROOM.sid !== 'test') {
    const pos = (s.queue || []).indexOf(u.id) + 1;
    extra = s.current === u.id ? '<span class="chip gold">دورك الآن</span>' : pos ? `<span class="chip acc">ترتيبك ${pos}</span>` : `<button class="btn sm" data-act="ready" data-id="${ROOM.sid}" data-v="1">${ICO.mic} جاهز</button>`;
  } else if (u && u.role !== 'student' && s) {
    const cur = s.current && S.users[s.current];
    extra = `<button class="btn sm" data-act="room-tool" data-k="rec1">${ICO.mic} ${cur ? esc((cur.name || '').split(' ')[0]) : 'التسميع'}</button><button class="btn sm" data-act="room-tool" data-k="swipe">${ICO.swipe}</button><button class="btn sm" data-act="room-tool" data-k="board">${ICO.grid}</button>`;
  }
  const ext = s && (s.link || (S.halaqat[s.halqaId] || {}).link);
  const PV = { jaas: 'Jitsi', daily: 'Daily' };
  // المعلم نقل الحصة لخدمة ثانية والطالب للحين في القديمة
  const moved = u && u.role === 'student' && ROOM.sid !== 'test' && ROOM.hasAlt && !!(S.videoAlt || {})[ROOM.sid] !== !!ROOM.alt;
  if (moved && !ROOM.movedToast) { ROOM.movedToast = 1; buzz([200, 100, 200]); toast('المعلم نقل الحصة للخدمة الثانية، اضغط «انتقل»'); }
  if (moved) extra = `<button class="btn pri sm" data-act="room-follow">انتقل مع المعلم</button>` + extra;
  if (u && u.role !== 'student' && ROOM.hasAlt) extra += `<button class="btn sm" data-act="room-switch" title="لو الصوت أو الصورة فيها مشكلة">بدّل لـ ${PV[ROOM.provider === 'jaas' ? 'daily' : 'jaas']}</button>`;
  r.querySelector('.room-bar').innerHTML = mini
    ? `<button class="room-ib" data-act="room-full" aria-label="تكبير">⤢</button><button class="room-ib bad" data-act="room-close" aria-label="خروج">✕</button>`
    : `<button class="btn sm danger" data-act="room-close">خروج</button><b class="room-t">${s ? esc(halqaName(s.halqaId)) : String(ROOM.sid || '').startsWith('meet:') ? (MEET_L[ROOM.sid.slice(5)] || ['اجتماع'])[0] : 'تجربة الغرفة'}</b><div class="room-x">${extra}${ROOM.slow ? '<button class="btn sm" data-act="room-help">ما فتحت؟</button>' : ''}<a class="btn ghost sm" href="${esc(ROOM.url)}" target="_blank" rel="noopener" data-act="room-newwin" title="افتح الغرفة في نافذة مستقلة لو ما اشتغلت هنا">↗ نافذة جديدة</a></div>${ext ? `<a class="btn ghost sm" href="${esc(ext)}" target="_blank" rel="noopener" title="لو ما اشتغلت الغرفة">رابط بديل</a>` : ''}<button class="btn sm" data-act="room-mini">تصغير</button>`;
  r.className = 'vroom ' + ROOM.mode;
  document.body.classList.toggle('room-full', !mini);
  document.body.classList.toggle('room-mini', mini);
}
async function openRoom(sid, alt) {
  if (alt === undefined && ROOM.sid === sid && ROOM.url) { ROOM.mode = 'full'; roomBar(); return; }
  if (ROOM.sid) closeRoom(true);
  toast('جاري تجهيز الغرفة…');
  const isMeet = String(sid).startsWith('meet:');
  let r; try { r = await api('/api/act', isMeet ? { t: 'meet.join', room: sid.slice(5), ...(alt !== undefined ? { alt } : {}), ...(ROOM.notify ? { notify: true } : {}) } : { t: 'video.join', lessonId: sid, ...(alt !== undefined ? { alt } : {}) }); } catch (e) { ROOM.notify = false; return toast(e.message); }
  ROOM.notify = false;
  try { if (navigator.brave && await navigator.brave.isBrave()) setTimeout(() => toast('متصفح Brave: إذا ما فتحت الغرفة اضغط أيقونة الأسد 🦁 وطفّ الحماية للموقع، أو افتحها في نافذة جديدة'), 2500); } catch {}
  if (!r || !r.url) return;
  const el = roomEl(); Object.assign(ROOM, { sid, mode: 'full', url: r.url, provider: r.provider, hasAlt: !!r.hasAlt, alt: !!r.alt, movedToast: 0 });
  el.querySelector('.room-frame').innerHTML = `<iframe src="${esc(r.url)}" allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write; screen-wake-lock" allowfullscreen title="غرفة الحصة"></iframe>`;
  el.hidden = false; window.__inRoom = true; wake(true); buzz(20); $('#toast').hidden = true; ROOM.t0 = Date.now(); roomBar(); load();
  clearTimeout(ROOM.slowT); ROOM.slowT = setTimeout(() => { if (ROOM.url && ROOM.mode === 'full') { ROOM.slow = true; roomBar(); } }, 15000);
}
function closeRoom(silent) {
  const el = document.getElementById('room'); if (!el) return;
  const sid = ROOM.sid; el.querySelector('.room-frame').innerHTML = ''; el.hidden = true; clearTimeout(ROOM.slowT); ROOM.slow = false;
  if (sid && String(sid).startsWith('meet:')) api('/api/act', { t: 'meet.leave', room: sid.slice(5) }).catch(() => {});
  Object.assign(ROOM, { sid: null, url: '', mode: 'full' }); window.__inRoom = false;
  document.body.classList.remove('room-full', 'room-mini'); if (!ST.fs) wake(false);
  if (!silent) { render(); load(); }
  const u = me(); if (!silent && u && u.role === 'student' && sid && sid !== 'test') act('leave', { lessonId: sid });
}
window.addEventListener('beforeunload', () => { if (ROOM.sid && ROOM.sid !== 'test') { const u = me(); if (u && u.role === 'student') try { navigator.sendBeacon('/api/act', new Blob([JSON.stringify({ t: 'leave', lessonId: ROOM.sid })], { type: 'application/json' })); } catch {} } });
// أزرار «ادخل الحصة» تفتح الغرفة داخل الموقع لما تكون مفعّلة
document.addEventListener('click', e => {
  if (!S.videoOn) return;
  const a = e.target.closest('a[data-act=join][data-id], a[data-room]'); if (!a) return;
  e.preventDefault(); e.stopPropagation(); openRoom(a.dataset.id || a.dataset.room);
}, true);
Object.assign(ACT, {
  'room-close': () => { if (me() && me().role !== 'student') return confirmBox('تطلع من الحصة؟ المكالمة تنقفل عندك بس، والطلاب يكملون.', 'اطلع', async () => closeRoom()); closeRoom(); },
  'room-mini': () => { ROOM.mode = 'mini'; if (ROOM.stale) render(); else roomBar(); },
  'room-full': () => { ROOM.mode = 'full'; roomBar(); },
  'room-tool': el => { const k = el.dataset.k; ROOM.mode = 'mini'; roomBar(); ST.sid = ROOM.sid; ST.view = 'session'; if (k === 'rec1') ACT['rec1-open'](); else if (k === 'swipe') ACT['swipe-open'](); else openFs('board'); },
  'video-test': () => openRoom('test'),
  'video-test-alt': () => { if (ROOM.sid) closeRoom(true); openRoom('test', true); },
  'room-follow': () => { const sid = ROOM.sid; ROOM.movedToast = 0; closeRoom(true); openRoom(sid); },
  'room-switch': () => confirmBox(String(ROOM.sid || '').startsWith('meet:') ? 'تنقل الاجتماع للخدمة الثانية؟ اللي يدخل بعدك يدخل عليها، واللي داخل الحين يطلع ويدخل من جديد.' : 'تنقل الحصة كلها للخدمة الثانية؟ الطلاب يطلع لهم زر «انتقل مع المعلم».', 'انقل', async () => { const sid = ROOM.sid; const to = !ROOM.alt; closeRoom(true); await openRoom(sid, to); }),
  'room-newwin': () => { setTimeout(() => { closeRoom(true); render(); }, 400); },
  'room-help': () => { ROOM.mode = 'mini'; roomBar(); openModal(`${dlgHead('الغرفة ما فتحت؟')}<ol class="steps"><li><b>افتحها في نافذة جديدة</b> من زر «↗ نافذة جديدة» فوق الغرفة.</li>${ROOM.hasAlt ? `<li><b>بدّل الخدمة</b> من زر «بدّل لـ…» فوق الغرفة.</li>` : ''}<li><b>متصفح Brave:</b> اضغط أيقونة الأسد 🦁 جنب الرابط وطفّ الحماية (Shields) للموقع، أو استخدم Chrome أو Safari.</li><li><b>اسمح بالكاميرا والمايك</b> للموقع من إعدادات المتصفح أو الجوال.</li><li>في الآيفون: افتح الموقع من Safari مو من داخل تطبيق ثاني (مثل واتساب أو تيليجرام).</li></ol><div class="dlg-foot"><button class="btn" data-act="close">تمام</button></div>`); },
  'meet-join': el => { ROOM.notify = !!el.dataset.notify; openRoom('meet:' + el.dataset.k); },
});
const _render0 = render;
// وهو داخل الغرفة بالشاشة الكاملة الصفحة مغطاة: ما نعيد رسمها كل شوي (يخفف الجوال ويمنع التعليق)، نحدّث شريط الغرفة بس
render = function () {
  if (window.__inRoom && ROOM.mode === 'full' && $('#modal').hidden) { ROOM.stale = true; roomBar(); return; }
  ROOM.stale = false; _render0(); roomBar();
};

/* إعدادات الغرفة (المدير الكامل) */
function videoSettingsHtml() {
  if (!ST.video && !ST.videoLoading) { ST.videoLoading = true; act('video.get', {}).then(r => { ST.videoLoading = false; ST.video = r || {}; render(); }); }
  if (!ST.video) return `<section class="card"><div class="row"><div class="spin"></div></div></section>`;
  const c = ST.video; const pv = ST.videoPv || c.provider || 'none';
  const radio = (v, t, d) => `<label class="pv ${pv === v ? 'on' : ''}"><input type="radio" name="provider" value="${v}" ${pv === v ? 'checked' : ''} data-change="video-pv"><b>${t}</b><span>${d}</span></label>`;
  return `<form class="card" data-form="video" style="gap:14px"><div class="sec-head"><h2>غرفة الحصة داخل الموقع</h2><span class="chip ${c.on ? 'ok' : ''}">${c.on ? 'مفعّلة' : 'متوقفة'}</span></div>
    <div class="pv-grid">${radio('none', 'بدون', 'الحصص تفتح برابط Zoom أو Meet مثل الحين')}${radio('jaas', 'Jitsi (JaaS)', 'مجاني لين 25 مستخدم بالشهر بدون حد دقائق')}${radio('daily', 'Daily', 'مجاني لين 10,000 دقيقة مشارك بالشهر')}</div>
    ${pv !== 'none' ? `<div class="small muted">الخدمة اللي تختارها فوق هي الأساسية. إذا حطيت مفاتيح الخدمتين، الثانية تصير احتياط: إذا تعطلت الأساسية يتحول الموقع لها تلقائيًا، والمعلم يقدر ينقل الحصة لها بزر.</div>` : ''}
    <div ${pv !== 'none' ? '' : 'hidden'} class="pv-box"><b>Jitsi (JaaS) ${pv === 'jaas' ? '<span class="chip acc">الأساسية</span>' : c.jaasOn ? '<span class="chip">احتياط</span>' : '<span class="chip">اختياري</span>'}</b><ol class="steps small"><li>سجّل في <a href="https://jaas.8x8.vc" target="_blank" rel="noopener">jaas.8x8.vc</a> (الخطة المجانية).</li><li>من <b>API Keys</b> اضغط <b>Add API key</b> ثم <b>Generate API key pair</b>، ونزّل الملف اللي ينتهي بـ <span dir="ltr">.pk</span>.</li><li>انسخ <b>AppID</b> و <b>Key ID</b> من الصفحة، وافتح ملف المفتاح وانسخ كل اللي فيه.</li></ol>
      <label class="fld"><span>AppID</span><input id="vd-app" name="jaasApp" dir="ltr" value="${esc(c.jaasApp || '')}" placeholder="vpaas-magic-cookie-xxxxxxxx"></label>
      <label class="fld"><span>Key ID</span><input id="vd-kid" name="jaasKid" dir="ltr" value="${esc(c.jaasKid || '')}" placeholder="vpaas-magic-cookie-xxxx/xxxxxx"></label>
      <label class="fld"><span>المفتاح الخاص ${c.hasJaasKey ? '<span class="chip ok">محفوظ</span>' : ''}</span><textarea id="vd-key" name="jaasKey" dir="ltr" rows="4" placeholder="${c.hasJaasKey ? 'اتركه فاضي عشان يبقى المحفوظ' : '-----BEGIN PRIVATE KEY-----'}"></textarea></label></div>
    <div ${pv !== 'none' ? '' : 'hidden'} class="pv-box"><b>Daily ${pv === 'daily' ? '<span class="chip acc">الأساسية</span>' : c.dailyOn ? '<span class="chip">احتياط</span>' : '<span class="chip">اختياري</span>'}</b><ol class="steps small"><li>سجّل في <a href="https://dashboard.daily.co" target="_blank" rel="noopener">dashboard.daily.co</a>.</li><li>من القائمة اضغط <b>Developers</b>، وانسخ <b>API key</b> (اضغط على العين عشان يبان، وانسخه كامل).</li><li>الصقه تحت واضغط حفظ.</li></ol>
      <label class="fld"><span>API key ${c.hasDailyKey ? '<span class="chip ok">محفوظ</span>' : ''}</span><input id="vd-daily" name="dailyKey" dir="ltr" type="password" autocomplete="off" placeholder="${c.hasDailyKey ? 'اتركه فاضي عشان يبقى المحفوظ' : ''}"></label></div>
    <div class="row"><button class="btn pri" type="submit">حفظ</button>${c.on ? '<button type="button" class="btn" data-act="video-test">جرّب الغرفة</button>' : ''}${c.jaasOn && c.dailyOn ? '<button type="button" class="btn" data-act="video-test-alt">جرّب الاحتياط</button>' : ''}</div>
    <div class="small muted">المفاتيح تنحفظ في قاعدة البيانات وما تطلع لأحد. لو تبي ترجع لـ Zoom أو Meet اختر «بدون».</div>
  </form>`;
}
CHG['video-pv'] = el => { ST.videoPv = el.value; render(); };
FORMS.video = async (f, d) => {
  const r = await act('video.save', { data: { provider: d.get('provider'), jaasApp: d.get('jaasApp') || '', jaasKid: d.get('jaasKid') || '', jaasKey: d.get('jaasKey') || '', dailyKey: d.get('dailyKey') || '' } }, 'حُفظت إعدادات الغرفة');
  if (r) { ST.video = r; ST.videoPv = null; clean(); render(); }
};

/* ================= الدفعة الرابعة: الرسائل، التقويم، التصويت، السلوك، الإدارة ================= */
Object.assign(ICO, (() => {
  const s = d => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  return {
    msgs: s('<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>'), inbox: s('<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>'), thread: s('<path d="M4 5h16v11H9l-5 4z"/>'),
    cal: s('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M8 14h2M12 14h2M16 14h0"/>'),
  };
})());

/* ---------- رسائل الطالب وولي الأمر مع المعلم ---------- */
const dmsOf = sid => L('dms').filter(m => m.sid === sid).sort((a, b) => a.at - b.at);
const dmUnreadStaff = () => L('dms').filter(m => !m.staff && !m.read && S.users[m.sid]).length;
const dmUnreadOf = sid => L('dms').filter(m => m.sid === sid && !m.staff && !m.read).length;
const dmUnreadMine = u => L('dms').filter(m => m.sid === u.id && m.staff && !m.read).length;
const todayNotes = (sid, date) => L('dms').filter(m => m.sid === sid && m.kind === 'note' && m.date === date);
const NOTE_Q = ['تعبان اليوم', 'عنده ظرف وبيتأخر', 'بيغيب اليوم', 'ما راجع زين، خففوا عليه'];
function markDmRead(sid, staffSide) {
  const unread = L('dms').some(m => m.sid === sid && m.staff !== staffSide && !m.read);
  if (!unread) return; ST.dmRead = ST.dmRead || {}; if (Date.now() - (ST.dmRead[sid] || 0) < 15000) return;
  ST.dmRead[sid] = Date.now(); api('/api/act', staffSide ? { t: 'dm.read', studentId: sid } : { t: 'dm.read' }).then(load).catch(() => {});
}
function threadHtml(sid, staffSide) {
  const ms = dmsOf(sid);
  setTimeout(() => { const t = document.getElementById('thread'); if (t) t.scrollTop = t.scrollHeight; }, 0);
  return `<div class="thread" id="thread">${ms.length ? ms.map(m => `<div class="dm ${m.staff === staffSide ? 'mine' : ''} ${m.kind === 'note' ? 'note' : ''}">${m.kind === 'note' ? `<span class="chip gold">ملاحظة ليوم ${fmtDate(m.date)}</span>` : ''}<div class="ann-body">${esc(m.text)}</div><div class="dm-meta">${esc(m.byName)} · ${fmtDate(isoDate(new Date(m.at)))} ${clock(m.at)}${m.staff === staffSide && m.read ? ' · قُرئت' : ''}${m.by === ST.meId ? ` · <button class="linkbtn" data-act="dm-del" data-id="${m.id}">حذف</button>` : ''}</div></div>`).join('') : '<div class="empty small">ما فيه رسائل بعد.</div>'}</div>`;
}
const dmForm = sid => `<form class="dm-form" data-form="dm" data-sid="${sid || ''}"><textarea id="dm-text-${sid || 'me'}" name="text" rows="2" maxlength="1000" placeholder="اكتب رسالة…" required></textarea><button class="btn pri" type="submit">إرسال</button></form>`;
function msgsV(u) {
  markDmRead(u.id, false);
  const h = S.halaqat[u.halqaId] || {}; const t = subName(h.teacherId);
  return `<h1>المعلم</h1><div class="muted">${t ? esc(t) + ' · ' : ''}${esc(h.name || '')}</div>
  <section class="card" style="display:grid;gap:8px"><b>ملاحظة سريعة لحصة اليوم</b><div class="qnotes">${NOTE_Q.map(q => `<button class="btn sm" data-act="dm-note" data-t="${esc(q)}">${esc(q)}</button>`).join('')}</div></section>
  <section class="card" style="display:grid;gap:10px">${threadHtml(u.id, false)}${dmForm('')}</section>`;
}
function inboxV(u) {
  const studs = L('users').filter(x => x.role === 'student' && x.status === 'active' && myHalaqat(u).some(h => h.id === x.halqaId));
  const rows = studs.map(x => { const ms = dmsOf(x.id); return { x, last: ms[ms.length - 1], un: dmUnreadOf(x.id) }; }).filter(r => r.last).sort((a, b) => b.last.at - a.last.at);
  return `<div class="sec-head"><h1>الرسائل</h1><select id="ib-new" data-change="dm-new" style="flex:0 1 240px"><option value="">رسالة جديدة لـ…</option>${studs.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar')).map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></div>
  <section class="card">${rows.length ? `<div class="list">${rows.map(({ x, last, un }) => `<div class="item click" data-act="open-thread" data-id="${x.id}"><div class="grow"><b>${esc(x.name)}</b><div class="small muted ellip">${last.kind === 'note' ? '📌 ' : ''}${esc(last.text)}</div></div><span class="small muted">${fmtDate(isoDate(new Date(last.at)))}</span>${un ? `<span class="chip bad">${un}</span>` : ''}</div>`).join('')}</div>` : '<div class="empty small">ما فيه رسائل بعد.</div>'}</section>`;
}
function threadV(u) {
  const st = S.users[ST.uid] && { ...S.users[ST.uid], id: ST.uid };
  if (!st) return `<button class="back" data-act="tab" data-v="inbox">→ الرسائل</button><div class="empty">الطالب غير موجود.</div>`;
  markDmRead(st.id, true);
  return `<button class="back" data-act="tab" data-v="inbox">→ الرسائل</button>
  <div class="sec-head"><div><h1>${esc(st.name)}</h1><div class="muted">${esc(halqaName(st.halqaId))}</div></div><button class="btn sm" data-act="open-student" data-id="${st.id}">ملف الطالب</button></div>
  <section class="card" style="display:grid;gap:10px">${threadHtml(st.id, true)}${dmForm(st.id)}</section>`;
}

/* ---------- ملخص بعد الحصة للطالب ---------- */
function afterLessonHtml(u) {
  const t = today();
  const s = L('sessions').filter(x => x.halqaId === u.halqaId && x.date <= t && !x.cancelled).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))[0];
  if (!s || s.date < addDays(t, -1)) return '';
  const rs = L('recs').filter(r => r.uid === u.id && (r.sid === s.id || (!r.sid && r.date === s.date)));
  const v = (s.att || {})[u.id];
  if (!rs.length && !v) return '';
  const next = planGroups(u);
  return `<section class="card after"><div class="sec-head"><h2>ملخص حصة ${s.date === t ? 'اليوم' : fmtDate(s.date)}</h2>${v ? `<span class="chip ${ATTC[v]}">${ATT[v]}</span>` : ''}</div>
    ${rs.length ? `<div class="list">${recMerge(rs).map(r => `<div class="item"><div class="grow"><span class="small muted">${TYPE[r.type]}</span> ${r.items.length > 1 ? `<span class="por">${esc(partsText(r.items))}</span> <span class="small muted">(${r.items.length} سور)</span>` : segText([{ s: r.surah - 1, a1: r.from, a2: r.to }])}${r.note ? `<div class="small">${esc(r.note)}</div>` : ''}</div><span class="chip ${GRADE_K[r.grade] || ''}">${esc(r.grade)}</span></div>`).join('')}</div>` : '<div class="small muted">ما سمّع في هالحصة.</div>'}
    ${next.length ? `<div class="after-next"><b>المطلوب للحصة الجاية</b><div>${next.map(g => esc(groupLabel(g))).join(' · ')}</div></div>` : ''}</section>`;
}
function behavStudentHtml(u) {
  const bs = L('behav').filter(b => b.uid === u.id).sort((a, b) => b.at - a.at).slice(0, 3);
  if (!bs.length) return '';
  return `<section class="card" style="display:grid;gap:8px"><h2>ملاحظات المعلم</h2><div class="list">${bs.map(b => `<div class="item"><span class="bh ${b.kind}">${b.kind === 'good' ? '＋' : '−'}</span><div class="grow">${esc(b.text)}<div class="small muted">${esc(b.byName)} · ${fmtDate(isoDate(new Date(b.at)))}</div></div></div>`).join('')}</div></section>`;
}

/* ---------- التصويت ---------- */
function pollBars(p) {
  const tot = Math.max(1, p.total || 0);
  return `<div class="pbars">${p.options.map((o, i) => { const c = (p.counts || [])[i] || 0; const mine = (p.mine || []).includes(i); return `<div class="pbar ${mine ? 'mine' : ''}"><div class="pfill" style="width:${Math.round(c / tot * 100)}%"></div><span>${esc(o)}${mine ? ' ✓' : ''}</span><b class="num">${c}</b></div>`; }).join('')}</div>`;
}
function studentPollsHtml(u) {
  const ps = L('polls').filter(p => !p.halqaId || p.halqaId === u.halqaId).sort((a, b) => b.at - a.at).filter(p => !p.closed || p.mine).slice(0, 3);
  return ps.map(p => `<section class="card poll"><div class="sec-head"><div><div class="small muted">تصويت${p.closed ? ' · انتهى' : ''}</div><h2>${esc(p.question)}</h2></div></div>
    ${p.mine && !ST.repoll?.[p.id] || p.closed ? `${p.counts ? pollBars(p) : ''}<div class="row"><span class="small muted">${p.total} صوّت</span>${!p.closed ? `<button class="linkbtn" data-act="poll-change" data-id="${p.id}">غيّر صوتك</button>` : ''}</div>`
      : p.multi ? `<form data-form="poll" data-id="${p.id}" class="popts">${p.options.map((o, i) => `<label class="check popt"><input type="checkbox" name="c" value="${i}" ${(p.mine || []).includes(i) ? 'checked' : ''}> ${esc(o)}</label>`).join('')}<button class="btn pri sm" type="submit">صوّت</button></form>`
      : `<div class="popts">${p.options.map((o, i) => `<button class="btn popt" data-act="poll-vote" data-id="${p.id}" data-i="${i}">${esc(o)}</button>`).join('')}</div>`}</section>`).join('');
}
function staffPollsHtml(u) {
  const hs = myHalaqat(u); const ps = L('polls').sort((a, b) => b.at - a.at);
  return `<details class="card" ${ST.pollOpen ? 'open' : ''}><summary><h2 style="display:inline">تصويت جديد</h2></summary>
    <form data-form="poll-new" style="display:grid;gap:10px;margin-top:10px"><label class="fld"><span>السؤال</span><input id="pl-q" name="question" required maxlength="200" placeholder="مثال: أي وقت يناسبكم لحصة السبت؟"></label>
    <label class="fld"><span>الخيارات (كل خيار في سطر)</span><textarea id="pl-o" name="options" rows="3" required placeholder="4 العصر\n5 العصر\nبعد المغرب"></textarea></label>
    <div class="row"><select id="pl-h" name="halqaId" style="flex:1 1 180px">${u.role === 'admin' && !(u.perms || []).some(p => /^(h|b):/.test(p)) ? '<option value="">كل الحلقات</option>' : ''}${hs.map(h => `<option value="${h.id}">${esc(h.name)}</option>`).join('')}</select><label class="check"><input type="checkbox" name="multi"> أكثر من خيار</label><button class="btn pri" type="submit">نشر التصويت</button></div></form></details>
  ${ps.map(p => { const tg = L('users').filter(x => x.role === 'student' && x.status === 'active' && (!p.halqaId || x.halqaId === p.halqaId)); const voted = new Set((p.voters || []).map(v => v.uid)); const not = tg.filter(x => !voted.has(x.id));
    return `<section class="card poll"><div class="sec-head"><div><div class="small muted">تصويت · ${p.halqaId ? esc(halqaName(p.halqaId)) : 'كل الحلقات'} · ${esc(p.byName)}${p.closed ? ' · <span class="chip">منتهي</span>' : ''}</div><h2>${esc(p.question)}</h2></div><div class="row"><span class="chip ${not.length ? 'warn' : 'ok'}">صوّت ${voted.size} من ${tg.length}</span><button class="btn ghost sm" data-act="poll-close" data-id="${p.id}">${p.closed ? 'افتح' : 'أنهِ'}</button><button class="btn ghost sm" data-act="poll-del" data-id="${p.id}">حذف</button></div></div>
      ${pollBars(p)}${not.length ? `<details><summary class="small">ما صوّتوا (${not.length})</summary><div class="small">${not.map(x => esc(x.name)).join('، ')}</div></details>` : ''}</section>`; }).join('')}`;
}

/* ---------- تقويم الحلقة للطالب ---------- */
function calV(u) {
  const st = SET(); const base = ST.calMonth || today().slice(0, 7); const [y, m] = base.split('-').map(Number);
  const first = new Date(y, m - 1, 1); const days = new Date(y, m, 0).getDate(); const lead = first.getDay();
  const ss = L('sessions').filter(s => s.halqaId === u.halqaId && s.date.startsWith(base));
  const ev = (st.events || []); const terms = st.terms || [];
  const cells = []; for (let i = 0; i < lead; i++) cells.push('<div class="cal-c empty"></div>');
  for (let d = 1; d <= days; d++) {
    const ds = base + '-' + pad(d); const l = ss.find(s => s.date === ds); const hol = (st.holidays || []).find(h => ds >= h.from && ds <= h.to); const es = ev.filter(e => e.date === ds);
    const tm = terms.find(x => x.from === ds || x.to === ds);
    const v = l && (l.att || {})[u.id];
    cells.push(`<div class="cal-c ${ds === today() ? 'today' : ''} ${hol ? 'hol' : ''}"><div class="cal-d"><b>${d}</b></div>${hol ? `<div class="cal-h">${esc(hol.name)}</div>` : ''}${l ? `<div class="cal-l ${l.cancelled ? 'x' : ''} ${v ? 'c-' + ATTC[v] : ''}">${l.cancelled ? 'ملغاة' : v ? ATT[v] : fmtTime(l.time)}</div>` : ''}${es.map(e => `<div class="cal-ev ${e.kind}">${esc(e.name)}</div>`).join('')}${tm ? `<div class="cal-ev">${tm.from === ds ? 'بداية' : 'نهاية'} ${esc(tm.name)}</div>` : ''}</div>`);
  }
  const prev = isoDate(new Date(y, m - 2, 1)).slice(0, 7), next = isoDate(new Date(y, m, 1)).slice(0, 7); const t = today();
  const up = [...ev.filter(e => e.date >= t).map(e => ({ d: e.date, t: e.name, k: e.kind === 'exam' ? 'اختبار' : 'مناسبة' })), ...(st.holidays || []).filter(h => h.to >= t).map(h => ({ d: h.from, t: h.name, k: 'إجازة' }))].sort((a, b) => a.d.localeCompare(b.d)).slice(0, 6);
  return `<h1>التقويم</h1>
  ${up.length ? `<section class="card"><h2>القادم</h2><div class="list">${up.map(x => `<div class="item"><span class="chip ${x.k === 'إجازة' ? 'gold' : x.k === 'اختبار' ? 'bad' : 'acc'}">${x.k}</span><div class="grow">${esc(x.t)}</div><span class="small muted">${fmtDateH(x.d)}</span></div>`).join('')}</div></section>` : ''}
  <section class="card" style="display:grid;gap:10px"><div class="sec-head"><button class="btn sm" data-act="cal-m" data-v="${prev}">→</button><h2>${new Intl.DateTimeFormat('ar', { month: 'long', year: 'numeric' }).format(first)}</h2><button class="btn sm" data-act="cal-m" data-v="${next}">←</button></div>
  <div class="tbl-wrap"><div class="cal scal">${DAYN.map(d => `<div class="cal-hd">${d.replace('ال', '')}</div>`).join('')}${cells.join('')}</div></div></section>`;
}

/* ---------- سجل السلوك (للمعلم والإدارة) ---------- */
function behavStaffHtml(st) {
  const bs = L('behav').filter(b => b.uid === st.id).sort((a, b) => b.at - a.at);
  return `<section class="card" style="display:grid;gap:10px"><h2>السلوك</h2>
    <form data-form="behav" data-id="${st.id}" class="row behav-f"><div class="seg"><label class="sg-r"><input type="radio" name="kind" value="good" checked><span>إيجابي</span></label><label class="sg-r"><input type="radio" name="kind" value="bad"><span>ملاحظة</span></label></div><input id="bh-t-${st.id}" name="text" required maxlength="300" placeholder="مثال: ساعد زميله في المراجعة" style="flex:1 1 200px"><label class="check small"><input type="checkbox" name="visible" checked> يشوفها ولي الأمر</label><button class="btn sm pri" type="submit">إضافة</button></form>
    ${bs.length ? `<div class="list">${bs.slice(0, 30).map(b => `<div class="item"><span class="bh ${b.kind}">${b.kind === 'good' ? '＋' : '−'}</span><div class="grow">${esc(b.text)}<div class="small muted">${esc(b.byName)} · ${fmtDate(isoDate(new Date(b.at)))}${b.visible ? '' : ' · خاصة'}</div></div>${b.by === ST.meId || me().role === 'admin' ? `<button class="btn ghost sm" data-act="behav-del" data-id="${b.id}">حذف</button>` : ''}</div>`).join('')}</div>` : ''}</section>`;
}

/* ---------- ملخص الحصة للمعلم ---------- */
function lessonSummaryHtml(s) {
  if (lessonTs(s) > Date.now()) return '';
  const studs = studentsOf(s.halqaId); const att = s.att || {}; const recs = L('recs').filter(r => r.sid === s.id);
  const joined = new Set(L('joins').filter(j => j.sid === s.id).map(j => j.uid));
  const recited = new Set(recs.map(r => r.uid));
  const pres = studs.filter(x => att[x.id] === 'p' || att[x.id] === 'l');
  const missed = pres.filter(x => !recited.has(x.id));
  const absentNow = Date.now() - lessonTs(s) > 10 * 60000 && s.date === today() ? studs.filter(x => !joined.has(x.id) && !['p', 'l', 'e'].includes(att[x.id])) : [];
  const nm = arr => arr.map(x => esc((x.name || '').split(' ').slice(0, 2).join(' '))).join('، ');
  return `<details class="card sumc" ${ST.sumOpen ? 'open' : ''} data-act-toggle="sum"><summary><h2>ملخص الحصة</h2><span class="row"><span class="chip num">حضر ${pres.length}/${studs.length}</span><span class="chip num ${missed.length ? 'warn' : 'ok'}">سمّع ${recited.size}</span>${absentNow.length ? `<span class="chip bad">ما دخل ${absentNow.length}</span>` : ''}</span></summary>
    <div style="display:grid;gap:8px;margin-top:10px">
    ${missed.length ? `<div><b>حضروا وما سمّعوا (${missed.length})</b><div class="small">${nm(missed)}</div><button class="btn sm" data-act="q-missed">أضفهم للطابور</button></div>` : '<div class="small c-ok">كل الحاضرين سمّعوا.</div>'}
    ${absentNow.length ? `<div><b>ما دخلوا بعد 10 دقائق (${absentNow.length})</b><div class="small">${nm(absentNow)}</div></div>` : ''}
    </div></details>`;
}

/* ---------- ملخص كل الأبناء ---------- */
async function kidsOverview() {
  const acc = accounts(); openModal(`${dlgHead('أولادي')}<div class="row"><div class="spin"></div></div>`);
  let r; try { r = await api('/api/kids', { tokens: acc.map(a => a.token) }); } catch (e) { closeModal(); return toast(e.message); }
  if ($('#modal').hidden) return;
  const kids = (r.kids || []);
  const card = k => {
    if (k.error) return '';
    const a = acc.find(x => x.id === k.id) || {}; const last = (k.recs || [])[0];
    if (k.status) return `<div class="kid"><b>${esc(k.name)}</b><span class="chip warn">${k.status === 'pending' ? 'بانتظار الاعتماد' : 'موقوف'}</span></div>`;
    return `<div class="kid"><div class="kid-h"><div><b>${esc(k.name)}</b><div class="small muted">${esc(k.halqa)}</div></div>${k.unreadDm ? `<span class="chip bad">${k.unreadDm} رسالة</span>` : ''}</div>
      <div class="kid-s"><div><span>اليوم</span><b>${k.today ? (k.today.att ? `<span class="c-${ATTC[k.today.att]}">${ATT[k.today.att]}</span>` : fmtTime(k.today.time)) : 'ما فيه حصة'}</b></div><div><span>الحضور 30 يوم</span><b>${k.rate == null ? '—' : k.rate + '٪'}</b></div><div><span>آخر تقدير</span><b>${last ? `<span class="c-${GRADE_K[last.grade] || ''}">${esc(last.grade)}</span>` : '—'}</b></div></div>
      ${last ? `<div class="small muted">${fmtDate(last.date)} · ${TYPE[last.type] || ''} ${esc(SN[last.surah - 1])} ${last.from}–${last.to}</div>` : ''}
      ${a.id && a.id !== ST.meId ? `<button class="btn sm" data-act="switch" data-id="${a.id}">افتح حسابه</button>` : '<span class="chip acc">مفتوح الحين</span>'}</div>`;
  };
  const dead = kids.filter(k => k.error).length;
  $('#modal .dlg').innerHTML = `${dlgHead('أولادي')}<div class="kids">${kids.map(card).join('')}</div>${dead ? `<div class="small muted">${dead} حساب انتهت صلاحيته على هالجهاز، أضفه من جديد.</div>` : ''}<div class="dlg-foot"><button class="btn" data-act="kids-manage">إضافة أو حذف ابن</button></div>`;
}

/* ---------- المنقطعين ---------- */
const DAY = 864e5;
const inactiveList = () => L('users').filter(x => x.role === 'student' && x.status === 'active' && (x.lastSeen || x.approvedAt || x.createdAt || Date.now()) < Date.now() - 14 * DAY);
const lastSeenText = x => x.lastSeen ? 'آخر دخول ' + fmtDate(isoDate(new Date(x.lastSeen))) : 'ما دخل الموقع أبد';

/* ---------- الفروع ---------- */
const branches = () => SET().branches || [];
function branchBar(u) {
  if (u.role !== 'admin' || !branches().length) return '';
  return `<div class="row brbar">${['', ...branches()].map(b => `<button class="btn sm ${(ST.branch || '') === b ? 'pri' : ''}" data-act="branch" data-b="${esc(b)}">${b ? esc(b) : 'كل المجمعوع'}</button>`).join('')}</div>`;
}

/* ---------- جدول المعلمين الأسبوعي ---------- */
function scheduleHtml() {
  const ts = L('users').filter(x => x.role === 'teacher' && x.status !== 'disabled').sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
  const hs = myHalaqat(me());
  const rows = [...ts.map(t => ({ id: t.id, name: t.name })), { id: '', name: 'بدون معلم' }];
  const chip = (h, d, tid) => { const clash = hs.some(o => o.id !== h.id && (o.teacherId || '') === tid && tid && halqaDays(o.id).includes(d) && o.time && o.time === h.time); return `<button class="sch-h ${clash ? 'clash' : ''}" draggable="true" data-hid="${h.id}" data-act="sch-pick" title="${clash ? 'تعارض وقت' : ''}">${esc(h.name)}<span>${fmtTime(h.time)}</span></button>`; };
  return `<section class="card" style="display:grid;gap:10px"><div class="sec-head"><h2>جدول الأسبوع</h2><span class="small muted">اسحب الحلقة لصف معلم ثاني، أو اضغط عليها</span></div>
  <div class="tbl-wrap"><table class="sch"><thead><tr><th>المعلم</th>${DAYN.map(d => `<th>${d}</th>`).join('')}</tr></thead><tbody>
  ${rows.map(r => { const own = hs.filter(h => (h.teacherId || '') === r.id); if (!r.id && !own.length) return ''; return `<tr data-tid="${r.id}" class="sch-row"><th>${esc(r.name)}<span class="small muted"> · ${own.length}</span></th>${DAYN.map((_, d) => `<td>${own.filter(h => halqaDays(h.id).includes(d)).map(h => chip(h, d, r.id)).join('')}</td>`).join('')}</tr>`; }).join('')}
  </tbody></table></div></section>`;
}
let SCH_DRAG = null;
document.addEventListener('dragstart', e => { const c = e.target.closest && e.target.closest('.sch-h'); if (!c) return; SCH_DRAG = c.dataset.hid; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', SCH_DRAG); } catch {} });
document.addEventListener('dragover', e => { const r = e.target.closest && e.target.closest('.sch-row'); if (!r || !SCH_DRAG) return; e.preventDefault(); document.querySelectorAll('.sch-row.over').forEach(x => x !== r && x.classList.remove('over')); r.classList.add('over'); });
document.addEventListener('dragend', () => { SCH_DRAG = null; document.querySelectorAll('.sch-row.over').forEach(x => x.classList.remove('over')); });
document.addEventListener('drop', e => { const r = e.target.closest && e.target.closest('.sch-row'); if (!r || !SCH_DRAG) return; e.preventDefault(); const hid = SCH_DRAG; SCH_DRAG = null; r.classList.remove('over'); moveHalqa(hid, r.dataset.tid); });
function moveHalqa(hid, tid) {
  const h = S.halaqat[hid]; if (!h || (h.teacherId || '') === tid) return;
  confirmBox(`تنقل «${esc(h.name)}» إلى ${tid ? esc(subName(tid)) : 'بدون معلم'}؟`, 'انقل', () => act('halqa.teacher', { id: hid, teacherId: tid }, 'تم نقل الحلقة'));
}

/* ---------- استيراد الطلاب ---------- */
let XLSX_P = null;
const loadXlsx = () => XLSX_P || (XLSX_P = new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload = () => ok(window.XLSX); s.onerror = () => { XLSX_P = null; no(new Error('تعذّر تحميل قارئ ملفات إكسل، الصق الجدول بدل الملف')); }; document.head.appendChild(s); }));
function parseTable(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim());
  const delim = lines.some(l => l.includes('\t')) ? '\t' : lines.some(l => l.includes(';')) && !lines.some(l => l.includes(',')) ? ';' : ',';
  return lines.map(l => l.split(delim).map(c => c.trim().replace(/^"|"$/g, '')));
}
function mapImport(grid, defH) {
  const fields = SET().fields.filter(f => f.type !== 'memo'); const hs = L('halaqat');
  const norm = s => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const head = (grid[0] || []).map(norm);
  const find = keys => head.findIndex(h => keys.some(k => h === k));
  let col = { name: find(['الاسم', 'اسم الطالب', 'الطالب', 'name', 'الاسم الكامل']), username: find(['اسم المستخدم', 'username', 'المستخدم']), password: find(['كلمة المرور', 'password', 'الرقم السري']), halqa: find(['الحلقة', 'halqa', 'اسم الحلقة']) };
  fields.forEach(f => { col['f:' + f.k] = head.findIndex(h => h === norm(f.label)); });
  let rows = grid;
  if (col.name >= 0) rows = grid.slice(1); else { col = { name: 0 }; const ph = fields.find(f => f.k === 'parentPhone'); if (ph) col['f:parentPhone'] = 1; }
  return rows.filter(r => (r[col.name] || '').trim()).map(r => {
    const info = {}; fields.forEach(f => { const i = col['f:' + f.k]; if (i != null && i >= 0 && r[i]) info[f.k] = r[i]; });
    const hn = col.halqa >= 0 ? r[col.halqa] : ''; const h = hn ? hs.find(x => norm(x.name) === norm(hn)) : null;
    return { name: r[col.name], username: col.username >= 0 ? r[col.username] : '', password: col.password >= 0 ? r[col.password] : '', halqaId: h ? h.id : defH, halqaName: h ? h.name : halqaName(defH), info, badH: !!hn && !h };
  });
}
function importModal() {
  const hs = myHalaqat(me()); if (!hs.length) return toast('أنشئ حلقة أولًا');
  ST.imp = null;
  openModal(`${dlgHead('استيراد طلاب')}<div class="small muted">ملف إكسل أو CSV، أو انسخ الجدول من إكسل والصقه. أول صف أسماء الأعمدة: الاسم، جوال ولي الأمر، الحلقة…</div>
    <label class="fld"><span>الحلقة (إذا ما فيه عمود للحلقة)</span><select id="imp-h">${hs.map(h => `<option value="${h.id}">${esc(h.name)}</option>`).join('')}</select></label>
    <input type="file" id="imp-file" accept=".xlsx,.xls,.csv,.txt" data-change="imp-file">
    <textarea id="imp-text" rows="5" placeholder="أو الصق الجدول هنا" data-input="imp-text"></textarea>
    <div id="imp-prev"></div>`);
}
function importPreview(grid) {
  const rows = mapImport(grid, ($('#imp-h') || {}).value); ST.imp = rows;
  const box = $('#imp-prev'); if (!box) return;
  const fields = SET().fields.filter(f => f.type !== 'memo');
  box.innerHTML = rows.length ? `<div class="small"><b>${rows.length}</b> طالب جاهز للاستيراد${rows.some(r => r.badH) ? ' · <span class="c-bad">فيه حلقات ما عرفناها، بتنحط في الحلقة المختارة فوق</span>' : ''}</div>
    <div class="tbl-wrap" style="max-height:240px"><table><thead><tr><th>الاسم</th><th>الحلقة</th>${fields.map(f => `<th>${esc(f.label)}</th>`).join('')}</tr></thead><tbody>${rows.slice(0, 50).map(r => `<tr><td>${esc(r.name)}</td><td>${esc(r.badH ? halqaName(($('#imp-h') || {}).value) : r.halqaName)}</td>${fields.map(f => `<td>${esc(r.info[f.k] || '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <div class="dlg-foot"><button class="btn pri" data-act="imp-go">استيراد ${rows.length}</button></div>` : '<div class="small c-bad">ما لقينا أسماء في الجدول.</div>';
}

/* ---------- حالة الخدمات ---------- */
function statusHtml() {
  const s = ST.status; const row = (ok, t, d) => `<div class="item"><span class="st-dot ${ok === true ? 'ok' : ok === false ? 'bad' : 'warn'}"></span><div class="grow"><b>${t}</b><div class="small muted">${d}</div></div></div>`;
  const ago = ts => { if (!ts) return 'أبد'; const m = Math.round((Date.now() - ts) / 60000); return m < 60 ? `قبل ${m} دقيقة` : m < 1440 ? `قبل ${Math.round(m / 60)} ساعة` : `قبل ${Math.round(m / 1440)} يوم`; };
  return `<section class="card" style="display:grid;gap:10px"><div class="sec-head"><h2>حالة الخدمات</h2><button class="btn sm" data-act="status-check">${s ? 'افحص مرة ثانية' : 'افحص الآن'}</button></div>
  ${!s ? '' : `<div class="list">
    ${row(s.db.ok && s.db.ms < 1500, 'الموقع وقاعدة البيانات', `الاستجابة ${s.db.ms} ملي ثانية`)}
    ${row(s.wa.on ? (s.wa.failed || s.wa.stuck ? null : true) : null, 'الواتساب', s.wa.on ? `أُرسل ${s.wa.sent7} آخر أسبوع · آخر رسالة ${ago(s.wa.last)}${s.wa.failed ? ' · فشلت ' + s.wa.failed : ''}${s.wa.stuck ? ' · ' + s.wa.stuck + ' متأخرة' : ''}` : 'غير مربوط')}
    ${row(s.video.on ? true : null, 'غرفة الحصة', s.video.on ? 'مفعّلة: ' + s.video.order.map(x => x === 'jaas' ? 'Jitsi' : 'Daily').join(' ثم ') : 'متوقفة، الحصص تفتح بالروابط الخارجية')}
    ${row(s.push ? true : null, 'الإشعارات', s.push ? 'مفعّلة' : 'غير مفعّلة')}
    ${row(s.cron.secret && s.cron.last && Date.now() - s.cron.last < 30 * 60000 ? true : s.cron.secret ? false : null, 'المهمة الدورية (التذكير والتنبيهات)', s.cron.secret ? 'آخر تشغيل ' + ago(s.cron.last) : 'CRON_SECRET غير مضاف')}
    ${row(s.backup && Date.now() - s.backup < 2 * DAY ? true : null, 'النسخ الاحتياطي', 'آخر نسخة ' + ago(s.backup))}
    ${row(s.backupExt && s.backupExt.on ? (s.backupExt.last && s.backupExt.last.ok && Date.now() - s.backupExt.last.at < 2 * DAY ? true : null) : false, 'النسخ في قاعدة خارجية', s.backupExt && s.backupExt.on ? (s.backupExt.last ? (s.backupExt.last.ok ? 'آخر نسخة ' + ago(s.backupExt.last.at) : 'آخر محاولة ما نجحت') : 'ما انحفظ فيها شي بعد') : 'مو مربوطة')}
  </div>`}</section>`;
}

/* ---------- الأحداث ---------- */
Object.assign(ACT, {
  'dm-note': el => confirmBox(`ترسل للمعلم: «${esc(el.dataset.t)}»؟`, 'أرسل', () => act('dm.send', { text: el.dataset.t, kind: 'note' }, 'وصلت للمعلم')),
  'dm-del': el => act('dm.delete', { id: el.dataset.id }),
  'open-thread': el => go('thread', { uid: el.dataset.id }),
  'behav-del': el => act('behav.delete', { id: el.dataset.id }),
  'poll-vote': el => { buzz(15); act('poll.vote', { id: el.dataset.id, choice: [+el.dataset.i] }, 'وصل صوتك').then(() => { if (ST.repoll) delete ST.repoll[el.dataset.id]; render(); }); },
  'poll-change': el => { ST.repoll = { ...(ST.repoll || {}), [el.dataset.id]: 1 }; render(); },
  'poll-close': el => act('poll.close', { id: el.dataset.id }),
  'poll-del': el => confirmBox('تحذف التصويت ونتائجه؟', 'حذف', () => act('poll.delete', { id: el.dataset.id }, 'حُذف')),
  'kids-manage': () => kidsModal(),
  'branch': el => { ST.branch = el.dataset.b; ST.halqa = ''; render(); },
  'sch': () => { ST.sched = !ST.sched; render(); },
  'sch-pick': el => { const hid = el.dataset.hid; const h = S.halaqat[hid]; const ts = L('users').filter(x => x.role === 'teacher' && x.status !== 'disabled'); openModal(`${dlgHead('معلم ' + esc(h.name))}<div class="list">${[...ts, { id: '', name: 'بدون معلم' }].map(t => `<button class="item click ${t.id === (h.teacherId || '') ? 'on' : ''}" data-act="sch-to" data-hid="${hid}" data-tid="${t.id}"><span class="grow">${esc(t.name)}</span>${t.id === (h.teacherId || '') ? '<span class="chip acc">الحالي</span>' : ''}</button>`).join('')}</div>`); },
  'sch-to': el => { closeModal(); moveHalqa(el.dataset.hid, el.dataset.tid); },
  'import': () => importModal(),
  'imp-go': async el => {
    const rows = ST.imp || []; if (!rows.length) return; el.disabled = true; el.textContent = 'جاري الاستيراد…';
    const defH = ($('#imp-h') || {}).value;
    const r = await act('students.import', { rows: rows.map(x => ({ name: x.name, username: x.username, password: x.password, halqaId: x.badH ? defH : x.halqaId, info: x.info })) });
    if (!r) { el.disabled = false; el.textContent = 'استيراد'; return; }
    const txt = r.created.map(c => `${c.name}\t${c.username}\t${c.password}`).join('\n');
    $('#modal .dlg').innerHTML = `${dlgHead('تم الاستيراد')}<div><b>${r.created.length}</b> طالب انضافوا.</div>${r.errors.length ? `<details open><summary class="c-bad">${r.errors.length} ما انضافوا</summary><div class="small">${r.errors.map(esc).join('<br>')}</div></details>` : ''}
      ${r.created.length ? `<div class="tbl-wrap" style="max-height:260px"><table><thead><tr><th>الطالب</th><th>اسم المستخدم</th><th>كلمة المرور</th><th></th></tr></thead><tbody>${r.created.map(c => { const l = c.parentPhone && waLink(c.parentPhone, `السلام عليكم ورحمة الله، بيانات دخول ${c.name} في ${SET().center}:\nالرابط: ${location.origin}\nاسم المستخدم: ${c.username}\nكلمة المرور: ${c.password}`); return `<tr><td>${esc(c.name)}</td><td dir="ltr">${esc(c.username)}</td><td dir="ltr">${esc(c.password)}</td><td>${l ? `<a class="btn wa sm" href="${l}" target="_blank" rel="noopener">إرسال</a>` : ''}</td></tr>`; }).join('')}</tbody></table></div><div class="dlg-foot"><button class="btn" data-act="copy" data-text="${esc(txt)}">نسخ الكل</button></div>` : ''}`;
  },
  'status-check': async () => { const r = await act('status.check', {}); if (r) { ST.status = r; render(); } },
  'q-skip': () => { const s = curSession(); if (!s.current) return; const q = [...(s.queue || [])].filter(x => x !== s.current); const nx = q.shift() || null; q.push(s.current); buzz(12); setQueue(s, q, nx).then(r => r && toast('انتقل لآخر الطابور')); },
  'q-missed': () => { const s = curSession(); const att = s.att || {}; const rec = new Set(L('recs').filter(r => r.sid === s.id).map(r => r.uid)); const q = [...(s.queue || [])]; studentsOf(s.halqaId).forEach(x => { if ((att[x.id] === 'p' || att[x.id] === 'l') && !rec.has(x.id) && !q.includes(x.id) && x.id !== s.current) q.push(x.id); }); setQueue(s, q).then(r => r && toast('انضافوا للطابور')); },
  'ev-del': el => { const st = SET(); act('events.save', { list: (st.events || []).filter((e, i) => i !== +el.dataset.i) }, 'حُذفت'); },
  'inact': () => { ST.inact = !ST.inact; render(); },
  'go-inact': () => go('students', { inact: true, arch: false }),
});
Object.assign(CHG, {
  'dm-new': el => { if (el.value) go('thread', { uid: el.value }); },
  'imp-file': async el => {
    const f = el.files && el.files[0]; if (!f) return;
    try {
      if (/\.(xlsx|xls)$/i.test(f.name)) { const X = await loadXlsx(); const wb = X.read(await f.arrayBuffer(), { type: 'array' }); const ws = wb.Sheets[wb.SheetNames[0]]; importPreview(X.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' }).map(r => r.map(c => String(c ?? '').trim()))); }
      else importPreview(parseTable(await f.text()));
    } catch (e) { toast(e.message || 'تعذّر قراءة الملف'); }
  },
});
INP['imp-text'] = el => { clearTimeout(INP._it); INP._it = setTimeout(() => importPreview(parseTable(el.value)), 250); };
Object.assign(FORMS, {
  async dm(f, d) { const sid = f.dataset.sid; const r = await act('dm.send', { text: d.get('text'), ...(sid ? { studentId: sid } : {}) }); if (r) { f.reset(); clean(); buzz(10); } },
  async behav(f, d) { if (await act('behav.add', { userId: f.dataset.id, kind: d.get('kind'), text: d.get('text'), visible: !!d.get('visible') }, 'انضافت')) { f.reset(); clean(); } },
  async 'poll-new'(f, d) { const r = await act('poll.save', { question: d.get('question'), options: String(d.get('options') || '').split('\n'), halqaId: d.get('halqaId') || '', multi: !!d.get('multi') }, 'نُشر التصويت'); if (r) { f.reset(); clean(); ST.pollOpen = false; render(); } },
  async poll(f, d) { const c = d.getAll('c').map(Number); if (!c.length) return toast('اختر خيار'); if (await act('poll.vote', { id: f.dataset.id, choice: c }, 'وصل صوتك')) { if (ST.repoll) delete ST.repoll[f.dataset.id]; render(); } },
  async 'ev-add'(f, d) { const st = SET(); if (await act('events.save', { list: [...(st.events || []), { date: d.get('date'), name: d.get('name'), kind: d.get('kind') }] }, 'أُضيفت')) { f.reset(); clean(); } },
});
document.addEventListener('toggle', e => { if (e.target.dataset && e.target.dataset.actToggle === 'sum') ST.sumOpen = e.target.open; }, true);

/* ================= القائمة الجانبية (يمين): أقسام ← صفحات ← خيارات داخلية ================= */
// نفس ترتيب منصة الحلقة التربوية: قائمة ثابتة يمين للكمبيوتر وتنطوي، ودرج من اليمين للجوال
function navSections(u) {
  const has = k => !TAB_PERM[k] || can(u, TAB_PERM[k]);
  const I = (k, label, count, subs) => ({ k, label, count: count || 0, subs });
  const S_ = (label, set, extra = {}) => ({ label, set, ...extra });
  if (u.role === 'student') {
    const en = LANG === 'en';
    return [
      { title: en ? 'My day' : 'يومي', items: [I('home', en ? 'My page' : 'صفحتي'), I('msgs', en ? 'Teacher' : 'المعلم', dmUnreadMine(u)), I('cal', en ? 'Calendar' : 'التقويم'), I('store', en ? 'Rewards' : 'المتجر')] },
      { title: '', items: [I('help', en ? 'Help' : 'الدليل')] },
    ];
  }
  const sessions = I('sessions', 'الحصص', 0, [S_('القائمة', { cal: false }), S_('التقويم', { cal: true })]);
  const students = I('students', u.role === 'admin' ? 'الطلاب' : 'طلابي', 0, [S_('كل الطلاب', { inact: false, arch: false }), S_('المنقطعين', { inact: true, arch: false }), S_('المؤرشفون', { arch: true, inact: false }), ...(u.role === 'admin' && has('students') ? [S_('استيراد طلاب', null, { act: 'import' })] : [])]);
  const inbox = I('inbox', 'الرسائل', dmUnreadStaff());
  const anns = I('anns', 'الإعلانات والتصويت');
  const room = I('room', inGirls() ? 'غرفة المعلمات' : 'غرفة المعلمين', msgsUnread(u));
  const liveMeet = Object.values(S.meets || {}).reduce((n, m) => n + ((m.ppl || []).some(p => p.id !== u.id) ? 1 : 0), 0);
  const meet = I('meet', 'الاجتماعات', liveMeet);
  const reports = I('reports', 'التقارير');
  const pendOrd = L('orders').filter(o => o.status === 'pending' && S.users[o.uid]).length;
  const store = I('store', 'المتجر والنقاط', pendOrd, [S_('الطلبات', { stTab: 'orders' }), S_('الجوائز', { stTab: 'rewards' }), S_('النقاط', { stTab: 'points' }), ...(u.role === 'admin' ? [S_('الميزانية', { stTab: 'budget' })] : [])]);
  const wa = I('wa', 'رسائل الواتساب', isFullAdmin(u) ? S.waFailed || 0 : 0, waTabsFor(u).map(([k, l]) => S_(l, { waTab: k })));
  if (u.role === 'teacher') return [
    { title: 'الحلقة', items: [sessions, students] },
    { title: 'التواصل', items: [inbox, wa, anns, room, ...(S.videoOn ? [meet] : [])] },
    { title: 'المتابعة', items: [reports, store] },
    { title: '', items: [I('help', 'الدليل')] },
  ];
  const pend = L('users').filter(x => x.role === 'student' && x.status === 'pending').length;
  const sec = [
    { title: 'الرئيسية', items: [I('dash', 'لوحة المدير')] },
    { title: 'الحلقات', items: [sessions, students, I('req', 'طلبات التسجيل', pend), I('halaqat', 'الحلقات')] },
    { title: 'التواصل', items: [inbox, wa, anns, room, ...(S.videoOn ? [meet] : [])] },
    { title: 'الإدارة', items: [...(isFullAdmin(u) || (u.perms || []).some(x => x.startsWith('b:')) ? [I('complexes', isFullAdmin(u) ? 'المجمعات' : 'مجمعي')] : []), I('teachers', 'المعلمون', 0, [S_('المعلمون والمشرفون', { sched: false }), S_('جدول الأسبوع', { sched: true })]), reports, store, I('logs', 'سجل العمليات'),
      I('settings', 'الإعدادات', 0, SET_TABS.map(([k, t]) => S_(t, { setTab: k })))] },
    { title: '', items: [I('help', 'الدليل')] },
  ];
  return sec.map(s => ({ ...s, items: s.items.filter(i => has(i.k)) })).filter(s => s.items.length);
}
const subOn = x => x.set && Object.entries(x.set).every(([k, v]) => k === 'setTab' ? (ST.setTab || 'rec') === v : k === 'waTab' ? (ST.waTab || 'send') === v : k === 'stTab' ? (ST.stTab || 'orders') === v : !!ST[k] === !!v);
let SIDE_MINI = false; try { SIDE_MINI = localStorage.getItem('irtaq-side-mini') === '1'; } catch {}
function sideNavHtml(u, active, mini) {
  const secs = navSections(u); ST.navOpen = ST.navOpen || {};
  if (mini) return `<nav class="sn mini" aria-label="القائمة">${secs.map(s => `<ul>${s.items.map(i => `<li><button class="sn-ic ${i.k === active ? 'on' : ''}" data-act="nav" data-v="${i.k}" title="${esc(i.label)}" aria-label="${esc(i.label)}">${ICO[i.k] || ICO.more}${i.count ? '<i></i>' : ''}</button><span>${esc(i.label)}</span></li>`).join('')}</ul>`).join('')}</nav>`;
  return `<nav class="sn" aria-label="القائمة">${secs.map(s => `<div class="sn-sec">${s.title ? `<div class="sn-t">${esc(s.title)}</div>` : ''}<ul>${s.items.map(i => {
    const on = i.k === active; const exp = ST.navOpen[i.k] ?? on;
    return `<li><div class="sn-row ${on ? 'on' : ''}"><button class="sn-link" data-act="nav" data-v="${i.k}">${ICO[i.k] || ICO.more}<span class="sn-l">${esc(i.label)}</span>${i.count ? `<b class="sn-c">${i.count}</b>` : ''}</button>${i.subs && i.subs.length ? `<button class="sn-x ${exp ? 'open' : ''}" data-act="nav-exp" data-k="${i.k}" aria-expanded="${exp}" aria-label="${exp ? 'إخفاء' : 'إظهار'} خيارات ${esc(i.label)}">▾</button>` : ''}</div>
      ${i.subs && exp ? `<ul class="sn-subs">${i.subs.map((x, j) => `<li><button class="sn-sub ${on && subOn(x) ? 'on' : ''}" data-act="nav-sub" data-v="${i.k}" data-j="${j}">${esc(x.label)}</button></li>`).join('')}</ul>` : ''}</li>`;
  }).join('')}</ul></div>`).join('')}</nav>`;
}
function drawerHtml(u, active) {
  if (!ST.drawer) return '';
  return `<div class="drawer" role="dialog" aria-modal="true" aria-label="القائمة"><div class="drawer-bg" data-act="drawer-x"></div>
    <div class="drawer-p"><div class="drawer-h"><div><b>${esc(u.name)}</b><div class="small muted">${ROLE[u.role]}${u.halqaId && S.halaqat[u.halqaId] ? ' · ' + esc(S.halaqat[u.halqaId].name) : ''}</div></div><button class="btn ghost sm" data-act="drawer-x" aria-label="إغلاق">✕</button></div>
    <div class="drawer-b">${sideNavHtml(u, active, false)}</div>
    <div class="drawer-f"><button class="btn ghost" data-act="account">${ICO.settings} حسابي</button><button class="btn ghost" data-act="logout">${ICO.logout} خروج</button></div></div></div>`;
}
function accountSheet() {
  const u = me(); if (!u) return;
  const it = (act, icon, label, extra = '') => `<button class="ms-it" data-act="${act}" ${extra}>${ICO[icon] || ICO.more}<span>${label}</span></button>`;
  openModal(`${dlgHead(esc(u.name))}<div class="ms-grid">
    ${u.role !== 'student' ? it('search-m', 'search', 'بحث') : it('kids-m', 'kids', accounts().length > 1 ? 'أولادي (' + accounts().length + ')' : 'إضافة ابن') + it('zoom', 'zoom', ZOOM > 1 ? 'تصغير الخط' : 'تكبير الخط') + it('lang', 'lang', LANG === 'en' ? 'عربي' : 'English')}
    ${S.push && 'PushManager' in window ? it('push', 'bell', PUSH_ON ? 'إيقاف الإشعارات' : 'تفعيل الإشعارات') : ''}
    ${INSTALL_EVT ? it('install', 'install', 'تثبيت كتطبيق') : ''}
    ${it('theme', 'theme', isDarkNow() ? 'المظهر الفاتح' : 'المظهر الداكن')}${it('my-pw', 'key', 'كلمة المرور')}${it('logout', 'logout', 'خروج')}</div>`);
}
Object.assign(ACT, {
  'nav': el => { ST.drawer = false; const v = el.dataset.v; const def = { students: { inact: false, arch: false }, teachers: { sched: false }, sessions: { cal: false } }[v] || {}; go(v, def); },
  'nav-exp': el => { ST.navOpen = ST.navOpen || {}; const k = el.dataset.k; const u = me(); const on = (PARENT_TAB[ST.view] || ST.view) === k; ST.navOpen[k] = !(ST.navOpen[k] ?? on); render(); },
  'nav-sub': el => {
    const u = me(); const item = navSections(u).flatMap(s => s.items).find(i => i.k === el.dataset.v); const x = item && item.subs[+el.dataset.j]; if (!x) return;
    ST.drawer = false;
    if (x.act) { if (ST.view !== item.k) go(item.k); return ACT[x.act](el); }
    go(item.k, x.set);
  },
  'drawer': () => { ST.drawer = true; buzz(8); render(); },
  'drawer-x': () => { ST.drawer = false; render(); },
  'side-mini': () => { SIDE_MINI = !SIDE_MINI; try { localStorage.setItem('irtaq-side-mini', SIDE_MINI ? '1' : '0'); } catch {} render(); },
  'account': () => { ST.drawer = false; render(); accountSheet(); },
});
// السحب من حافة الشاشة اليمنى يفتح القائمة، والسحب لليمين يقفلها
(() => {
  let sx = null, sy = 0, fromEdge = false;
  document.addEventListener('touchstart', e => { if (e.touches.length !== 1) return; const t = e.touches[0]; sx = t.clientX; sy = t.clientY; fromEdge = t.clientX > window.innerWidth - 22; }, { passive: true });
  document.addEventListener('touchend', e => {
    if (sx == null) return; const t = e.changedTouches[0]; const dx = t.clientX - sx, dy = t.clientY - sy; sx = null;
    if (window.innerWidth >= 1024 || !me() || ST.fs) return;
    if (!ST.drawer && fromEdge && dx < -60 && Math.abs(dy) < 60 && $('#modal').hidden) { ST.drawer = true; buzz(8); render(); }
    else if (ST.drawer && dx > 70 && Math.abs(dy) < 60) { ST.drawer = false; render(); }
  }, { passive: true });
})();
document.addEventListener('keydown', e => { if (e.key === 'Escape' && ST.drawer) { ST.drawer = false; render(); } });

/* ================= المساعد الذكي (مساعد ارتق) ================= */
// يتكلم معك، ويجاوب من بيانات حلقاتك، ويجهز إجراءات (إعلان، تصويت، إجازة، حصة…) تنفذها بعد تأكيدك.
const AI = { open: false, msgs: [], busy: false };
try { AI.msgs = JSON.parse(sessionStorage.getItem('irtaq-ai') || '[]'); } catch {}
const AI_SUGGEST = {
  admin: ['مين يحتاج متابعة ومن أي حلقة؟', 'أرسل واتساب لأولياء أمور الغايبين اليوم', 'اعتمد طلبات التسجيل كلها', 'أضف اختبار جزء عمّ يوم الخميس الجاي', 'اقترح 5 أفكار تحفيزية للطلاب هالشهر'],
  student: ['وش المطلوب مني للحصة الجاية؟', 'خلصت مهام اليوم كلها وقريت 3 أوجه', 'أبي أستأذن من حصة بكرة', 'كيف أثبّت حفظي وما أنساه؟', 'أبي جدول مراجعة يومي يناسبني'],
  teacher: ['مين من طلابي ما سمّع هالأسبوع؟', 'حضّر حصة اليوم: الكل حاضر', 'أرسل التقرير الأسبوعي لأولياء أمور حلقتي', 'ألغِ حصة بكرة لظرف', 'اقترح طريقة تساعد طالب يعيد كثير'],
};
const AI_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"/><path d="M19 15l.8 1.9 1.9.8-1.9.8L19 20.4l-.8-1.9-1.9-.8 1.9-.8zM5 15.5l.6 1.4 1.4.6-1.4.6L5 19.5l-.6-1.4-1.4-.6 1.4-.6z"/></svg>';
function aiEl() {
  let r = document.getElementById('ai');
  if (!r) { r = document.createElement('div'); r.id = 'ai'; document.body.appendChild(r); }
  return r;
}
function aiSave() { try { sessionStorage.setItem('irtaq-ai', JSON.stringify(AI.msgs.slice(-30))); } catch {} }
function aiRender() {
  const u = me(); const el = aiEl();
  if (!u || !S.aiOn || ST.fs) { el.innerHTML = ''; el._h = ''; return; }
  const ta = document.getElementById('ai-q'); const keep = ta ? ta.value : ''; const hadFocus = ta && document.activeElement === ta;
  const listEl = el.querySelector('.ai-list'); const atBottom = !listEl || listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight < 40; const st0 = listEl ? listEl.scrollTop : 0;
  const card = (a, mi, ai) => `<div class="ai-act ${a.state || ''} ${a.error ? 'err' : ''}"><b>${esc(a.summary)}</b>${a.error || a.msg ? `<div class="c-bad small">${esc(a.error || a.msg)}</div>` : ''}
    ${!a.error && !a.state ? `<div class="row"><button class="btn pri sm" data-act="ai-run" data-m="${mi}" data-a="${ai}">تنفيذ</button><button class="btn ghost sm" data-act="ai-skip" data-m="${mi}" data-a="${ai}">إلغاء</button></div>` : ''}
    ${a.state === 'busy' ? '<div class="small muted">جاري التنفيذ…</div>' : a.state === 'done' ? `<div class="small c-ok">✓ تم${a.res ? ' — <span class="ai-res">' + esc(a.res) + '</span>' : ''}</div>` : a.state === 'skip' ? '<div class="small muted">أُلغي</div>' : a.state === 'err' ? `<button class="linkbtn" data-act="ai-run" data-m="${mi}" data-a="${ai}">إعادة المحاولة</button>` : ''}</div>`;
  const html = `<button class="ai-fab ${AI.open ? 'on' : ''}" data-act="ai-toggle" aria-label="المساعد الذكي" title="المساعد الذكي (Ctrl+J)">${AI.open ? '✕' : AI_ICON}</button>
  ${AI.open ? `<div class="ai-panel" role="dialog" aria-label="المساعد الذكي"><div class="ai-h"><span class="ai-badge">${AI_ICON}</span><div class="grow"><b>مساعد ارتق</b><span>${u.role === 'student' ? (AI.left != null ? 'باقي لك اليوم ' + AI.left + ' سؤال' : 'اسألني أي شي عن حفظك وحصصك') : 'يجاوب ويجهز لك، وأنت تأكد قبل التنفيذ'}</span></div>${AI.msgs.length ? '<button class="linkbtn" data-act="ai-new">محادثة جديدة</button>' : ''}</div>
    <div class="ai-list">${!AI.msgs.length ? `<div class="ai-hello"><p>هلا ${esc((u.name || '').split(' ')[0])}، ${u.role === 'student' ? 'اسألني عن المطلوب منك وحصصك وتسميعك، أو كيف تحفظ وتراجع. وأقدر أسوي عنك اللي تسويه في الموقع: أراسل المعلم، أرسل استئذان، أصوّت، وأسجل مهام اليوم. جرّب:' : 'أسوي عنك أي شي تقدر عليه في الموقع (إلا الحذف): تحضير وتسميع وخطط، رسائل وواتساب، إعلانات وتصويت، حصص وحلقات وطلاب… وأجاوبك عن طلابك. أجهزه وأنت تضغط «تنفيذ». جرّب:'}</p>${(AI_SUGGEST[u.role] || AI_SUGGEST.teacher).map(s => `<button class="ai-sg" data-act="ai-sg" data-t="${esc(s)}">${esc(s)}</button>`).join('')}</div>` : ''}
      ${AI.msgs.map((m, mi) => `<div class="ai-m ${m.role}${m.err ? ' err' : ''}"><div class="ai-b">${esc(m.text)}${m.err && mi === AI.msgs.length - 1 && !AI.busy ? '<button class="btn sm ai-rt" data-act="ai-retry">↻ إعادة المحاولة</button>' : ''}</div>${(m.actions || []).length ? `<div class="ai-acts">${m.actions.map((a, ai) => card(a, mi, ai)).join('')}${m.actions.filter(a => !a.state && !a.error).length > 1 ? `<button class="btn pri sm" data-act="ai-all" data-m="${mi}">تنفيذ الكل</button>` : ''}</div>` : ''}</div>`).join('')}
      ${AI.busy ? '<div class="ai-m assistant"><div class="ai-b ai-think">يفكر…</div></div>' : ''}</div>
    <form class="ai-f" data-form="ai"><textarea id="ai-q" rows="1" placeholder="${u.role === 'student' ? 'اكتب سؤالك… مثل: كيف أراجع جزء عمّ؟' : 'اكتب طلبك… مثل: مين غاب أكثر هالأسبوع؟'}" aria-label="رسالة للمساعد"></textarea><button class="btn pri" type="submit" ${AI.busy ? 'disabled' : ''} aria-label="إرسال">➤</button></form></div>` : ''}`;
  if (el._h === html) return; el._h = html; el.innerHTML = html;
  const t2 = document.getElementById('ai-q'); if (t2) { t2.value = keep; if (hadFocus) t2.focus(); }
  const l2 = el.querySelector('.ai-list'); if (l2) l2.scrollTop = atBottom ? l2.scrollHeight : st0;
}
// طلب المساعد بمهلة واضحة: سفاري الآيفون يقطع الطلب الطويل ويطلع «Load failed»
async function aiApi(body) {
  const c = new AbortController(); const tm = setTimeout(() => c.abort(), 58000);
  try {
    const r = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _side: SEC, ...body }), signal: c.signal });
    let j = {}; try { j = await r.json(); } catch {}
    if (!r.ok) throw new Error(j.error || (r.status >= 500 ? 'خدمة الذكاء الاصطناعي مزحومة الحين، جرّب بعد دقيقة' : 'تعذّر الاتصال، حاول مرة ثانية'));
    return j;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('تأخر الرد كثير، الخدمة مزحومة. جرّب بعد شوي');
    if (e instanceof TypeError) throw new Error(navigator.onLine ? 'انقطع الاتصال قبل ما يوصل الرد، جرّب مرة ثانية' : 'ما فيه إنترنت، تأكد من الاتصال');
    throw e;
  } finally { clearTimeout(tm); }
}
async function aiSend(text, retry) {
  const q = String(text || '').trim(); if ((!q && !retry) || AI.busy) return;
  if (!retry) AI.msgs.push({ role: 'user', text: q });
  AI.busy = true; aiSave(); aiRender();
  const ta = document.getElementById('ai-q'); if (ta && !retry) ta.value = '';
  try {
    const u0 = me(); const due = u0 && u0.role === 'student' ? planGroups(u0).map(g => groupLabel(g) + (g.parts.length > 1 && partsPages(g.parts) ? ` (${partsPages(g.parts)})` : '')).join('، ') : '';
    const tasks = u0 && u0.role === 'student' ? planGroups(u0).map(groupKey) : undefined;
    const r = await aiApi({ t: 'chat', due, tasks, messages: AI.msgs.filter(m => !m.err && !/^⚠ /.test(m.text)).map(m => ({ role: m.role, text: m.text + ((m.actions || []).length ? '\n[إجراءات: ' + m.actions.map(a => `${a.summary} (${a.state === 'done' ? 'نُفّذ' : a.state === 'skip' ? 'أُلغي' : 'لم يُنفذ'})`).join('؛ ') + ']' : '') })) });
    AI.msgs.push({ role: 'assistant', text: r.text || '…', actions: r.actions || [] }); if (r.left != null) AI.left = r.left;
  } catch (e) { AI.msgs.push({ role: 'assistant', text: '⚠ ' + e.message, err: true }); }
  AI.busy = false; aiSave(); aiRender();
}
const aiResTxt = (t, r) => t === 'lessons.bulk' ? `تعدّلت ${r.n || 0} حصة` : t === 'halqa.mode' && r.n > 1 ? `تعدّلت ${r.n} حلقات` : t === 'user.resetpw' && r.pw ? `اسم الدخول: ${r.username} · كلمة المرور المؤقتة: ${r.pw}` : t === 'wa.bulk' ? `انرسلت ${r.sent || 0}${r.queued ? ' · ' + r.queued + ' تطلع خلال دقائق' : ''}${r.skipped ? ' · ' + r.skipped + ' بدون رقم' : ''}` : t === 'wa.weekNow' ? `انضاف ${r.n || 0} تقرير للإرسال` : t === 'wa.retryFailed' ? `رجعت ${r.n || 0} رسالة للإرسال` : t === 'students.assign' ? `انتقل ${r.n || 0}` : t === 'plan.applyTpl' ? `تطبقت على ${r.done || 0}` : t === 'dm.bulk' ? `وصلت لـ ${r.n || 0}` : t === 'rec.addMany' && r.grade ? 'التقدير: ' + r.grade : t === 'lessons.time' ? `تعدّل وقت ${r.n || 0} حصة` : t === 'halqa.time' ? `تعدّلت ${r.n || 0} حلقة و${r.fixed || 0} حصة جاية` : t === 'halqa.save' && r.fixed ? `وتعدّل وقت ${r.fixed} حصة جاية` : '';
async function aiRun(mi, ai, batch) {
  const a = AI.msgs[mi] && AI.msgs[mi].actions[ai]; if (!a || a.state === 'done' || a.error) return;
  a.state = 'busy'; aiRender();
  try { const r = await api('/api/act', { t: a.t, _side: SEC, ...(a.payload || {}) }); a.state = 'done'; a.res = aiResTxt(a.t, r || {}); buzz(15); if (!batch) await load(); }
  catch (e) { a.state = 'err'; a.msg = e.message; }
  aiSave(); aiRender();
}
Object.assign(ACT, {
  'ai-toggle': () => { AI.open = !AI.open; aiRender(); if (AI.open) setTimeout(() => { const t = document.getElementById('ai-q'); if (t && window.innerWidth > 760) t.focus(); }, 30); },
  'ai-new': () => { AI.msgs = []; aiSave(); aiRender(); },
  'ai-sg': el => aiSend(el.dataset.t),
  'ai-retry': () => { while (AI.msgs.length && AI.msgs[AI.msgs.length - 1].err) AI.msgs.pop(); aiSend('', true); },
  'ai-run': el => aiRun(+el.dataset.m, +el.dataset.a),
  'ai-skip': el => { const a = AI.msgs[+el.dataset.m].actions[+el.dataset.a]; a.state = 'skip'; aiSave(); aiRender(); },
  'ai-all': async el => { const mi = +el.dataset.m; const acts = AI.msgs[mi].actions; for (let i = 0; i < acts.length; i++) if (!acts[i].state && !acts[i].error) await aiRun(mi, i, true); await load(); },
});
FORMS.ai = async (f) => { const t = document.getElementById('ai-q'); await aiSend(t ? t.value : ''); };
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && ['j', 'J', 'ت'].includes(e.key) && S.aiOn) { e.preventDefault(); ACT['ai-toggle'](); }
  if (e.key === 'Enter' && !e.shiftKey && e.target && e.target.id === 'ai-q') { e.preventDefault(); aiSend(e.target.value); }
});
{ const _r = render; render = function () { _r(); aiRender(); }; }

/* ---- رسالة لولي الأمر بالذكاء ---- */
async function aiParentMsg(sid, tone) {
  const box = document.getElementById('aipm'); if (!box) return;
  box.innerHTML = '<div class="row"><div class="spin"></div><span class="small muted">يكتب الرسالة…</span></div>';
  try {
    const r = await aiApi({ t: 'parentMsg', studentId: sid, tone, extra: (document.getElementById('aipm-x') || {}).value || '' });
    const st = S.users[sid] || {};
    box.innerHTML = `<textarea id="aipm-t" rows="6">${esc(r.text)}</textarea><div class="row">${st.parentPhone ? `<button class="btn wa" data-act="aipm-send" data-id="${sid}">إرسال لولي الأمر</button>` : '<span class="small muted">ما فيه رقم ولي أمر</span>'}<button class="btn" data-act="aipm-dm" data-id="${sid}">إرسال داخل الموقع</button><button class="btn ghost" data-act="copy-aipm">نسخ</button></div>`;
  } catch (e) { box.innerHTML = `<div class="c-bad small">${esc(e.message)}</div>`; }
}
Object.assign(ACT, {
  'aipm': el => aiParentMsg(el.dataset.id, el.dataset.tone),
  'aipm-send': el => { const st = S.users[el.dataset.id] || {}; const t = (document.getElementById('aipm-t') || {}).value || ''; if (!t.trim()) return; if (waAuto()) act('wa.sendText', { phone: st.parentPhone, text: t }).then(r => r && (closeModal(), toast(r.ok ? 'انرسلت من رقم الحلقة ✓' : 'بتنعاد تلقائيًا'))); else window.open(waLink(st.parentPhone, t), '_blank', 'noopener'); },
  'aipm-dm': el => { const t = (document.getElementById('aipm-t') || {}).value || ''; if (!t.trim()) return; act('dm.send', { studentId: el.dataset.id, text: t }, 'انرسلت داخل الموقع').then(r => r && closeModal()); },
  'copy-aipm': () => copyText((document.getElementById('aipm-t') || {}).value || ''),
});
const aiPmHtml = st => S.aiOn ? `<div class="aipm"><b>${AI_ICON} اكتبها لي بالذكاء</b><input id="aipm-x" maxlength="200" placeholder="شي تبي تضيفه (اختياري)"><div class="row"><button class="btn sm" data-act="aipm" data-id="${st.id}" data-tone="praise">ثناء وتشجيع</button><button class="btn sm" data-act="aipm" data-id="${st.id}" data-tone="neutral">اطمئنان</button><button class="btn sm" data-act="aipm" data-id="${st.id}" data-tone="concern">طلب تعاون</button></div><div id="aipm"></div></div>` : '';

/* ---- إعداد المساعد ---- */
function aiSettingsHtml() {
  if (!ST.aiCfg && !ST.aiLoading) { ST.aiLoading = true; api('/api/ai', { t: 'get' }).then(r => { ST.aiLoading = false; ST.aiCfg = r; render(); }).catch(e => { ST.aiLoading = false; ST.aiCfg = { err: e.message }; render(); }); }
  const c = ST.aiCfg; if (!c) return '<section class="card"><div class="row"><div class="spin"></div></div></section>';
  return `<section class="card" style="display:grid;gap:12px"><div class="sec-head"><h2>المساعد الذكي</h2><span class="chip ${c.on ? 'ok' : ''}">${c.on ? 'مفعّل' + (c.gemini ? ' · Gemini ' + esc(c.gemini) : ' · Claude ' + esc(c.claude || '')) : 'متوقف'}</span></div>
    <ol class="steps small"><li>ادخل <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com</a> بحساب قوقل، واضغط <b>Create API key</b>.</li><li>سوّ مفتاح جديد خاص بهالموقع (لا تستخدم مفتاح الموقع الثاني)، وانسخه والصقه تحت واضغط حفظ.</li></ol>
    <div class="row"><input id="ai-key" type="password" dir="ltr" autocomplete="off" placeholder="AIza…" style="flex:1 1 220px"><button class="btn pri" data-act="ai-key-save">حفظ</button></div>
    <div class="row"><label class="small">النموذج</label><select id="ai-model" data-change="ai-model"><option value="" ${!c.model ? 'selected' : ''}>تلقائي: الأسرع المتاح (مستحسن)</option><option value="gemini-flash-latest" ${c.model === 'gemini-flash-latest' ? 'selected' : ''}>Flash (الأذكى)</option><option value="gemini-2.5-flash" ${c.model === 'gemini-2.5-flash' ? 'selected' : ''}>Flash 2.5 (سريع جدًا)</option><option value="gemini-flash-lite-latest" ${c.model === 'gemini-flash-lite-latest' ? 'selected' : ''}>Flash-Lite (حد مجاني أعلى، أبطأ)</option></select></div>
    <div class="row"><label class="check"><input type="checkbox" id="ai-stu" data-change="ai-stu" ${c.students !== false ? 'checked' : ''}> متاح للطلاب وأولياء الأمور</label><label class="small">حد الطالب اليومي</label><input id="ai-lim" type="number" min="1" max="200" value="${c.studentLimit || 25}" data-change="ai-lim" style="width:80px"></div>
    <details><summary class="small">أو استخدم مفتاح Claude</summary><div class="row" style="margin-top:8px"><input id="ai-ckey" type="password" dir="ltr" autocomplete="off" placeholder="sk-ant-…" style="flex:1 1 220px"><button class="btn" data-act="ai-ckey-save">حفظ</button></div></details>
    <div class="row">${c.on ? '<button class="btn" data-act="ai-test">جرّب الاتصال</button>' : ''}${c.gemini && !c.fromEnv ? '<button class="btn ghost danger" data-act="ai-key-del">حذف مفتاح Gemini</button>' : ''}${c.claude && !c.fromEnv ? '<button class="btn ghost danger" data-act="ai-ckey-del">حذف مفتاح Claude</button>' : ''}</div>
    <div id="ai-msg" class="small"></div>
    <div class="note small">في باقة Gemini المجانية، قوقل تستخدم المحادثات لتحسين خدماتها. المساعد يرسل أسماء الطلاب وحضورهم وتسميعهم عشان يقدر يجاوب.</div></section>`;
}
async function aiCfgSave(body, msg) { try { await api('/api/ai', { t: 'save', ...body }); ST.aiCfg = null; await load(); toast(msg); } catch (e) { toast(e.message); } }
Object.assign(ACT, {
  'ai-key-save': () => { const k = ($('#ai-key') || {}).value || ''; if (k.trim().length < 20) return toast('الصق المفتاح كامل'); aiCfgSave({ gemini: k.trim() }, 'حُفظ المفتاح، جرّب الاتصال'); },
  'ai-ckey-save': () => { const k = ($('#ai-ckey') || {}).value || ''; if (k.trim().length < 20) return toast('الصق المفتاح كامل'); aiCfgSave({ claude: k.trim() }, 'حُفظ المفتاح، جرّب الاتصال'); },
  'ai-key-del': () => confirmBox('تحذف مفتاح Gemini؟ المساعد يتوقف إذا ما فيه مفتاح ثاني.', 'حذف', () => aiCfgSave({ gemini: null }, 'حُذف')),
  'ai-ckey-del': () => confirmBox('تحذف مفتاح Claude؟', 'حذف', () => aiCfgSave({ claude: null }, 'حُذف')),
  'ai-test': async () => { const m = $('#ai-msg'); if (m) { m.className = 'small muted'; m.textContent = 'جاري التجربة…'; } try { const r = await api('/api/ai', { t: 'test' }); if (m) { m.className = 'small c-ok'; m.textContent = 'الاتصال شغال ✓ الرد: ' + (r.reply || ''); } } catch (e) { if (m) { m.className = 'small c-bad'; m.textContent = e.message; } } },
});
CHG['ai-model'] = el => aiCfgSave({ geminiModel: el.value || null }, 'حُفظ النموذج');
CHG['ai-stu'] = el => aiCfgSave({ students: el.checked }, el.checked ? 'صار متاح للطلاب' : 'انقفل عن الطلاب');
CHG['ai-lim'] = el => aiCfgSave({ studentLimit: +el.value || 25 }, 'حُفظ الحد');

/* ================= رسائل الواتساب: قسم رئيسي مستقل في القائمة ================= */
// إرسال لأولياء أمور مجموعة طلاب، والتقرير الأسبوعي، وسجل الرسائل، والربط والرسائل التلقائية — كلها في مكان واحد
const WA_TABS = [['send', 'إرسال رسالة'], ['week', 'التقرير الأسبوعي'], ['log', 'سجل الرسائل', 1], ['conn', 'الربط والرسائل التلقائية', 1]];
const waTabsFor = u => WA_TABS.filter(t => !t[2] || isFullAdmin(u));
function waLoaded() {
  if (!ST.wa && !ST.waLoading) { ST.waLoading = true; act('wa.get', {}).then(r => { ST.waLoading = false; ST.wa = r || { cfg: {}, log: [], counts: {} }; render(); }); }
  return !!ST.wa;
}
function waV(u) {
  const tabs = waTabsFor(u); const cur = tabs.some(t => t[0] === ST.waTab) ? ST.waTab : 'send';
  const body = cur === 'week' ? waWeekHtml(u) : cur === 'log' ? waLogHtml() : cur === 'conn' ? waConnHtml() : waSendHtml(u);
  return `<div class="sec-head"><div><h1>رسائل الواتساب</h1><div class="muted small">${S.waOn ? 'الرسائل تطلع من رقم الحلقة المربوط مباشرة.' : 'الربط متوقف: الرسائل تفتح واتسابك وترسلها بنفسك.'}</div></div><span class="chip ${S.waOn ? 'ok' : 'warn'}">${S.waOn ? 'مربوط' : 'غير مربوط'}</span></div>
  <div class="ptabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" aria-selected="${k === cur}" class="${k === cur ? 'on' : ''}" data-act="wa-tab" data-v="${k}">${l}${k === 'log' && S.waFailed ? ` <b class="sn-c">${S.waFailed}</b>` : ''}</button>`).join('')}</div>
  ${!S.waOn && isFullAdmin(u) && cur !== 'conn' ? `<div class="note small row"><span class="grow">اربط الواتساب عشان الرسائل تطلع من رقم الحلقة تلقائيًا بدل ما ترسلها وحدة وحدة.</span><button class="btn sm" data-act="wa-tab" data-v="conn">اربطه الحين</button></div>` : ''}
  ${body}`;
}
function waSendHtml(u) {
  const hs = myHalaqat(u); const hid = hs.some(h => h.id === ST.waH) ? ST.waH : '';
  const studs = L('users').filter(x => x.role === 'student' && x.status === 'active' && (hid ? x.halqaId === hid : hs.some(h => h.id === x.halqaId))).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
  const sel = ST.waSel || (ST.waSel = {}); const t = today();
  const absent = new Set(L('sessions').filter(s => s.date === t && !s.cancelled).flatMap(s => Object.entries(s.att || {}).filter(([, v]) => v === 'a').map(([k]) => k)));
  const chosen = studs.filter(x => sel[x.id] && x.parentPhone); const tplId = ST.waTpl || '';
  const text = ST.waText ?? 'السلام عليكم ورحمة الله، ';
  const first = chosen[0] || studs.find(x => x.parentPhone);
  const preview = first ? (tplId === 'week' ? weekMsg(first) : fillTpl(text, { student: first.name, halqa: halqaName(first.halqaId), date: fmtDate(t), fem: femSt(first) })) : '';
  const noPhone = studs.filter(x => !x.parentPhone).length; ST.waPvId = first ? first.id : '';
  return `<section class="card" style="display:grid;gap:12px"><div class="sec-head"><h2>1. لمين؟</h2><span class="chip ${chosen.length ? 'acc' : ''}">${chosen.length} مختار</span></div>
    <div class="row">${hs.length > 1 ? `<select data-change="wa-h" aria-label="الحلقة" style="flex:0 1 220px"><option value="">كل الحلقات</option>${hs.map(h => `<option value="${h.id}" ${h.id === hid ? 'selected' : ''}>${esc(h.name)}</option>`).join('')}</select>` : ''}
      <button class="btn sm" data-act="wa-pick" data-v="all">الكل</button>${absent.size ? `<button class="btn sm" data-act="wa-pick" data-v="absent">غابوا اليوم</button>` : ''}<button class="btn ghost sm" data-act="wa-pick" data-v="none">إلغاء التحديد</button></div>
    ${studs.length ? `<div class="wa-pick">${studs.map(x => `<label class="wa-st ${x.parentPhone ? '' : 'off'}"><input type="checkbox" data-change="wa-sel" data-id="${x.id}" ${sel[x.id] && x.parentPhone ? 'checked' : ''} ${x.parentPhone ? '' : 'disabled'}><span class="grow">${esc(x.name)}${absent.has(x.id) ? ' <span class="chip bad">غاب اليوم</span>' : ''}<span class="small muted">${hs.length > 1 && !hid ? esc(halqaName(x.halqaId)) + ' · ' : ''}${x.parentPhone ? '<span dir="ltr">' + esc(x.parentPhone) + '</span>' : 'ما فيه رقم ولي أمر'}</span></span></label>`).join('')}</div>` : '<div class="empty small">ما فيه طلاب.</div>'}
    ${noPhone ? `<div class="small muted">${noPhone} طالب بدون رقم ولي أمر، تقدر تضيفه من صفحة الطالب.</div>` : ''}</section>
  <section class="card" style="display:grid;gap:12px"><h2>2. وش الرسالة؟</h2>
    <label class="fld"><span>رسالة جاهزة</span><select data-change="wa-tpl"><option value="">رسالة جديدة</option>${allTpls().map(x => `<option value="${esc(x.id)}" ${tplId === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}<option value="week" ${tplId === 'week' ? 'selected' : ''}>التقرير الأسبوعي (لكل طالب تقريره)</option></select></label>
    ${tplId === 'week' ? '<div class="small muted">كل ولي أمر يوصله تقرير ولده: الحضور والحفظ والتسميع والنقاط لهالأسبوع.</div>' : `<label class="fld"><span>النص</span><textarea id="wa-text" rows="5" data-input="wa-text">${esc(text)}</textarea><span class="hint">{الطالب} و{الحلقة} و{التاريخ} تتعبى لكل واحد تلقائيًا.</span></label>`}
    ${preview ? `<details ${tplId === 'week' ? 'open' : ''}><summary class="small">معاينة (${esc(first.name)})</summary><div class="small ann-body wa-pv">${esc(preview)}</div></details>` : ''}
    ${ST.waProg ? `<div class="wa-prog"><div class="bar-track"><div class="bar-fill" style="width:${Math.round(ST.waProg.n / ST.waProg.of * 100)}%"></div></div><span class="small">${ST.waProg.done ? 'خلص ✓ ' : 'يرسل… '}${ST.waProg.ok} انرسلت${ST.waProg.bad ? ' · ' + ST.waProg.bad + ' بتنعاد تلقائيًا' : ''} من ${ST.waProg.of}</span></div>` : ''}
    <div class="row"><button class="btn pri" data-act="wa-send-sel" ${chosen.length && !(ST.waProg && !ST.waProg.done) ? '' : 'disabled'}>${S.waOn ? 'أرسل' : 'جهّز الروابط'} لـ ${chosen.length} ${chosen.length === 1 ? 'ولي أمر' : 'أولياء أمور'}</button>${isFullAdmin(u) || can(u, 'settings') ? '<button class="btn ghost sm" data-act="go-tpls">تعديل الرسائل الجاهزة</button>' : ''}</div></section>`;
}
function waWeekHtml(u) {
  const hs = myHalaqat(u); const c = (ST.wa && ST.wa.cfg) || {};
  if (isFullAdmin(u)) waLoaded();
  return `<section class="card" style="display:grid;gap:12px"><h2>التقرير الأسبوعي لأولياء الأمور</h2>
    <div class="small muted">يوصل كل ولي أمر تقرير ولده: الحضور، الحفظ والمراجعة، التسميع والتقديرات، والنقاط — من بداية الأسبوع لين اليوم. وما يوصله نفس التقرير مرتين في نفس الأسبوع.</div>
    ${isFullAdmin(u) ? `<div class="row"><span class="chip ${c.autoWeek ? 'ok' : ''}">${c.autoWeek ? `تلقائي كل ${DAYN[c.weekDay ?? 4]} ${fmtTime(pad(c.weekHour ?? 20) + ':00')}` : 'الإرسال التلقائي متوقف'}</span><button class="btn ghost sm" data-act="wa-tab" data-v="conn">تغيير</button></div>` : ''}
    ${S.waOn && isFullAdmin(u) ? '<div><button class="btn pri" data-act="wa-week-all">أرسل الآن لكل الحلقات</button></div>' : ''}
    <div class="list">${hs.map(h => `<div class="item"><div class="grow"><b>${esc(h.name)}</b><div class="small muted">${studentsOf(h.id).filter(x => x.parentPhone).length} ولي أمر</div></div>${S.waOn ? `<button class="btn sm" data-act="wa-week-h" data-h="${h.id}">أرسل الآن</button>` : `<button class="btn wa sm" data-act="wa-week-man" data-h="${h.id}">روابط الإرسال</button>`}</div>`).join('') || '<div class="empty small">ما فيه حلقات.</div>'}</div></section>
  ${S.waOn ? `<section class="card" style="display:grid;gap:12px"><h2>التقرير الشهري</h2><div class="small muted">الحضور والتأخر، الحفظ والمراجعة، التسميع، رصيد النقاط والجوائز اللي أخذها خلال الشهر.</div>
    ${isFullAdmin(u) ? `<div class="row"><span class="chip ${c.autoMonth ? 'ok' : ''}">${c.autoMonth ? `تلقائي يوم ${c.monthDay || 1} من كل شهر ${fmtTime(pad(c.monthHour ?? 20) + ':00')}` : 'الإرسال التلقائي متوقف'}</span><button class="btn ghost sm" data-act="wa-tab" data-v="conn">تغيير</button></div><div><button class="btn" data-act="wa-month" data-h="">أرسل الآن لكل الحلقات</button></div>` : ''}
    <div class="list">${hs.map(h => `<div class="item"><div class="grow"><b>${esc(h.name)}</b></div><button class="btn sm" data-act="wa-month" data-h="${h.id}">أرسل الآن</button></div>`).join('')}</div></section>` : ''}`;
}
Object.assign(ACT, {
  'wa-tab': el => { ST.waTab = el.dataset.v; if (ST.view !== 'wa') go('wa'); else render(); },
  'wa-pick': el => {
    const u = me(); const hs = myHalaqat(u); const hid = hs.some(h => h.id === ST.waH) ? ST.waH : ''; const t = today();
    const studs = L('users').filter(x => x.role === 'student' && x.status === 'active' && x.parentPhone && (hid ? x.halqaId === hid : hs.some(h => h.id === x.halqaId)));
    const absent = new Set(L('sessions').filter(s => s.date === t && !s.cancelled).flatMap(s => Object.entries(s.att || {}).filter(([, v]) => v === 'a').map(([k]) => k)));
    const v = el.dataset.v; ST.waSel = {};
    if (v === 'all') studs.forEach(x => { ST.waSel[x.id] = true; });
    if (v === 'absent') { studs.filter(x => absent.has(x.id)).forEach(x => { ST.waSel[x.id] = true; }); const ab = allTpls().find(x => x.id === 'absent'); if (ab && !ST.waTpl && !(ST.waText || '').trim().replace('السلام عليكم ورحمة الله،', '')) { ST.waTpl = 'absent'; ST.waText = ab.text; const ta = $('#wa-text'); if (ta) delete ta.dataset.dirty; } }
    ST.waProg = null; render();
  },
  'wa-send-sel': async () => {
    const u = me(); const t = today(); const tpl = ST.waTpl || '';
    const ids = Object.keys(ST.waSel || {}).filter(id => ST.waSel[id] && S.users[id] && S.users[id].parentPhone);
    const text = (($('#wa-text') || {}).value ?? ST.waText ?? '').trim();
    if (!ids.length) return toast('اختر طالب واحد على الأقل');
    if (tpl !== 'week' && text.length < 3) return toast('اكتب الرسالة');
    const msgFor = st => tpl === 'week' ? weekMsg(st) : fillTpl(text, { student: st.name, halqa: halqaName(st.halqaId), date: fmtDate(t), fem: femSt(st) });
    const list = ids.map(id => ({ ...S.users[id], id }));
    if (!S.waOn) { waListModal('إرسال واتساب', list.map(st => ({ name: st.name, sub: halqaName(st.halqaId), link: waLink(st.parentPhone, msgFor(st)), key: 'wsel-' + st.id }))); return; }
    ST.waProg = { n: 0, of: list.length, ok: 0, bad: 0 }; render();
    for (const st of list) {
      let r = null; try { r = await api('/api/act', { t: 'wa.sendText', phone: st.parentPhone, text: msgFor(st) }); } catch (e) { r = null; }
      ST.waProg.n++; if (r && r.ok) ST.waProg.ok++; else ST.waProg.bad++; if (ST.view === 'wa') render();
    }
    ST.waProg.done = true; buzz(20); toast(ST.waProg.bad ? `انرسلت ${ST.waProg.ok}، والباقي بتنعاد تلقائيًا` : `انرسلت ${ST.waProg.ok} رسالة ✓`); ST.wa = null; render();
  },
  'wa-week-all': () => confirmBox('يرسل التقرير الأسبوعي الحين لكل أولياء الأمور في كل الحلقات؟', 'أرسل', () => act('wa.weekNow', {}, r => 'انضاف ' + (r.n || 0) + ' تقرير للإرسال').then(() => { ST.wa = null; render(); })),
  'wa-week-man': el => { const list = studentsOf(el.dataset.h); waListModal('التقرير الأسبوعي — ' + halqaName(el.dataset.h), list.map(st => ({ name: st.name, sub: st.parentPhone ? '' : 'ما فيه رقم', link: st.parentPhone ? waLink(st.parentPhone, weekMsg(st)) : '', key: 'wk-' + st.id }))); },
  'go-tpls': () => go('settings', { setTab: 'msg' }),
  'wa-month': el => confirmBox('يرسل التقرير الشهري الحين لأولياء الأمور' + (el.dataset.h ? ' في ' + esc(halqaName(el.dataset.h)) : ' في كل الحلقات') + '؟', 'أرسل', () => act('wa.monthNow', { halqaId: el.dataset.h || '' }, r => 'انضاف ' + (r.n || 0) + ' تقرير للإرسال')),
  'go-wa': el => go('wa', { waTab: el.dataset.v || (S.waOn ? 'log' : 'conn') }),
});
CHG['wa-h'] = el => { ST.waH = el.value; ST.waSel = {}; ST.waProg = null; render(); };
CHG['wa-sel'] = el => { ST.waSel = ST.waSel || {}; ST.waSel[el.dataset.id] = el.checked; ST.waProg = null; render(); };
CHG['wa-tpl'] = el => { const ta = $('#wa-text'); if (ta) { ST.waText = ta.value; delete ta.dataset.dirty; } ST.waTpl = el.value; const x = allTpls().find(y => y.id === el.value); if (x) ST.waText = x.text; ST.waProg = null; render(); };
INP['wa-text'] = el => { ST.waText = el.value; const st = S.users[ST.waPvId]; const pv = $('.wa-pv'); if (st && pv) pv.textContent = fillTpl(el.value, { student: st.name, halqa: halqaName(st.halqaId), date: fmtDate(today()), fem: femSt(st) }); };

/* ================= الحلقات الحضورية: المعلم في الجامع ================= */
// الحلقة الحضورية: المعلم يسوي كل شي من جواله (الطالب داخل الحلقة ما يفتح جواله)، وخيارات «عن بعد» تبقى للحلقة اللي تحتاجها
const MODE_L = { onsite: 'حضوري', remote: 'عن بعد', hybrid: 'هجين' };
const lessonMode = s => (s && s.mode) || ((S.halaqat[s && s.halqaId] || {}).mode) || 'onsite';
const isOnsiteL = s => lessonMode(s) !== 'remote';
const placeKeyOf = hid => ((S.halaqat[hid] || {}).branch) || '_';
const placeOf = hid => (SET().places || {})[placeKeyOf(hid)] || null;
const mapUrl = p => p ? `https://www.google.com/maps?q=${p.lat},${p.lng}` : '';
const myTin = () => (S.tins || {})[ST.meId];
/** وقت انصراف المعلمين اليوم لمجمع الحلقة (ms) */
const dayEndOf = hid => { const b = (S.halaqat[hid] || {}).branch || '_'; const m = S.dayEnd || {}; return m[b] || m._ || null; };
const balOf = uid => (S.bal || {})[uid] || 0;
const minsLate = (s, uid) => { const a = (s.arr || {})[uid]; return a ? Math.max(0, Math.round((a - lessonTs(s)) / 60000)) : 0; };
const MGR_PERMS = ['req', 'students', 'teachers', 'halaqat', 'anns', 'reports', 'store', 'logs'];

/* تسجيل تسميع بدون ما ينشئ حصة: يختار الطالب ويسجّل، وإذا فيه حصة لحلقته بنفس اليوم ينربط فيها تلقائيًا */
function qrItems() {
  const hs = myHalaqat(me()).map(h => h.id); const q = (ST.qrq || '').trim();
  const list = L('users').filter(x => x.role === 'student' && x.status === 'active' && hs.includes(x.halqaId) && (!q || (x.name || '').includes(q))).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar')).slice(0, 80);
  const recToday = new Set(L('recs').filter(r => r.date === today()).map(r => r.uid));
  return list.length ? list.map(x => `<button class="item click qr-it" data-act="rec-out" data-id="${x.id}"><div class="grow"><div class="name">${esc(x.name)}</div><div class="small muted">${esc(halqaName(x.halqaId))}</div></div>${recToday.has(x.id) ? '<span class="chip ok">سمّع اليوم</span>' : ''}<span class="chip acc">سمّع</span></button>`).join('') : '<div class="empty small">ما فيه نتائج.</div>';
}
function quickRecModal() {
  openModal(`${dlgHead('تسجيل تسميع')}<div class="small muted">بدون ما تنشئ حصة. اختر الطالب، وتقدر تغيّر التاريخ لو تسجّل تسميع يوم فات. ولو فيه حصة لحلقته بنفس اليوم ينربط فيها لحاله.</div>
  <input id="qr-q" data-input="qr-q" placeholder="ابحث بالاسم" value="${esc(ST.qrq || '')}" autocomplete="off"><div class="list qr-list" id="qr-list">${qrItems()}</div>`);
}
function sesInView() {
  const hs = myHalaqat(me()); const ids = ST.halqa ? [ST.halqa] : hs.map(h => h.id); const t = today();
  const sr = ST.sr || 'week'; const sd = ST.sd || t; const ws = weekStartC(sd); const ms = sd.slice(0, 8) + '01';
  const me0 = (() => { const d = new Date(ms + 'T00:00'); d.setMonth(d.getMonth() + 1); d.setDate(0); return isoDate(d); })();
  const [from, to] = sr === 'day' ? [sd, sd] : sr === 'week' ? [ws, addDays(ws, 6)] : sr === 'month' ? [ms, me0] : [t, '9999-12-31'];
  return L('sessions').filter(s => ids.includes(s.halqaId) && s.date >= from && s.date <= to);
}
async function bulkDo(payload, msg) {
  const ids = [...ST.sel]; if (!ids.length) return toast('اختر الحصص أول');
  const r = await act('lessons.bulk', { ids, ...payload }, x => msg || `تعدّلت ${x.n || 0} حصة`);
  if (r) { closeModal(); ST.sel = new Set(); ST.selOn = false; render(); }
}
CHG['bulk-mode'] = el => { const v = el.value; if (!v) return; el.value = ''; const L0 = { onsite: 'حضوري', remote: 'عن بعد', hybrid: 'هجين', default: 'حسب نوع الحلقة' }; confirmBox(`${ST.sel.size} حصة تصير «${L0[v]}»؟`, 'غيّر', () => bulkDo({ mode: v === 'default' ? '' : v }, `صارت ${L0[v]}`)); };
FORMS['bulk-time'] = async (f, d) => bulkDo({ time: d.get('time') });
FORMS['bulk-cancel'] = async (f, d) => bulkDo({ cancel: true, note: (d.get('note') || '').trim() }, 'انلغت الحصص');
INP['qr-q'] = el => { ST.qrq = el.value; const box = document.getElementById('qr-list'); if (box) { box.innerHTML = qrItems(); femify(box); } };
/** حالة المعلم بعد تسجيل وصوله: زر تسجيل الخروج، أو وقت انصرافه */
function tinState(t, end) {
  if (t.out) return `<div class="tin ok out">${ICO.check}<span>وصلت ${clock(t.at)} · انصرفت ${clock(t.out)}${t.outAuto ? ' (تلقائي مع وقت الانصراف)' : ''}${t.outEarly ? ` · <b class="c-warn">قبل الوقت بـ ${t.outEarly} د</b>` : ''}</span>${!t.outAuto && Date.now() - t.out < 30 * 60000 ? '<button class="linkbtn" data-act="tout-undo">تراجع</button>' : ''}</div>`;
  return `<div class="tin in"><div class="grow"><b>${ICO.check} سجّلت وصولك ${clock(t.at)}${t.dist != null ? ` <span class="small muted">· على بعد ${t.dist} م</span>` : ''}</b><span class="small">${end ? `وقت الانصراف ${clock(end)}، وإذا ما سجّلت خروجك ينسجّل لحاله` : 'سجّل خروجك إذا طلعت من الجامع'}</span></div><button class="btn" data-act="tout">🚪 تسجيل خروج</button></div>`;
}
function checkinBar(u, s) {
  if (u.role !== 'teacher' || s.date !== today() || !isOnsiteL(s)) return '';
  const t = myTin(); const need = !!placeOf(s.halqaId); const end = dayEndOf(s.halqaId);
  if (t) return tinState(t, end);
  return `<div class="tin ${need ? 'need' : ''}"><div class="grow"><b>سجّل وصولك للجامع</b><span class="small">${need ? 'لازم تكون داخل الجامع، وما تقدر تحضّر أو تسجّل تسميع قبلها' : 'ينحفظ وقت وصولك للحلقة'}${end ? ` · الانصراف اليوم ${clock(end)}` : ''}</span></div><button class="btn pri" data-act="tin">📍 وصلت الجامع</button></div>`;
}
/** بطاقة تسجيل الوصول أعلى الصفحة الأساسية للمعلم: تطلع في أي يوم عنده فيه حلقة حضورية، حتى لو الحصة ما انفتحت بعد */
function checkinCard(u) {
  if (u.role !== 'teacher') return '';
  const t = today(); const wd = new Date().getDay(); const hs = myHalaqat(u);
  const allT = L('sessions').filter(s => s.date === t && (hs.some(h => h.id === s.halqaId) || s.subId === ST.meId));
  const onsiteToday = allT.some(s => !s.cancelled && isOnsiteL(s)) || (!isHolidayC(t) && hs.some(h => (h.mode || 'onsite') !== 'remote' && halqaDays(h.id).includes(wd) && !allT.some(s => s.halqaId === h.id)));
  const tn = myTin();
  if (tn) return tinState(tn, (S.dayEnd || {})[(hs.find(h => (h.mode || 'onsite') !== 'remote') || hs[0] || {}).branch || '_'] || (S.dayEnd || {})._);
  if (!onsiteToday) return '';
  return `<section class="tin-card"><div class="tin-ico" aria-hidden="true">📍</div><div class="grow"><b>سجّل حضورك اليوم</b><span class="small">${needLoc() ? 'ضغطة وحدة داخل الجامع، والتحضير والتسميع يفتح بعدها' : 'ضغطة وحدة وينحفظ وقت وصولك'}</span></div><button class="btn pri tin-go" data-act="tin">وصلت الجامع</button></section>`;
}
/** هل لازم موقع للتسجيل؟ (إذا موقع الجامع محدد لأي حلقة من حلقات المعلم) */
const needLoc = () => { const u = me(); return !!u && myHalaqat(u).some(h => placeOf(h.id)); };
/** الموقع: يحاول بالـGPS الدقيق، وإذا تأخر (مثل داخل الجامع) يرجع لموقع الواي فاي والشبكة. يرجع { pos } أو { err } */
function getPos() {
  if (!navigator.geolocation) return Promise.resolve({ err: 'nosupport' });
  const once = (hi, timeout) => new Promise(res => navigator.geolocation.getCurrentPosition(p => res({ pos: p }), e => res({ err: e && e.code === 1 ? 'denied' : 'unavail' }), { enableHighAccuracy: hi, timeout, maximumAge: hi ? 20000 : 120000 }));
  return once(true, 12000).then(r => (r.pos || r.err === 'denied') ? r : once(false, 10000).then(r2 => r2.pos ? r2 : r));
}
const IOS_DEV = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const STANDALONE = (() => { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch { return false; } })();
/** نافذة تشرح ليش ما وصلنا الموقع وكيف يتصلح، حسب السبب ونوع الجوال */
function locHelp(err, retryAct) {
  const steps = err === 'denied'
    ? (IOS_DEV
      ? (STANDALONE
        ? ['الإعدادات ← الخصوصية والأمن ← خدمات الموقع: تكون شغّالة.', 'في نفس الصفحة: مواقع سفاري ← «أثناء استخدام التطبيق»، مع «الموقع الدقيق».', 'بعدها «جرّب مرة ثانية»، ولما يسأل الجوال: «سماح».']
        : ['زر «aA» (أو ⋯) بجنب الرابط ← إعدادات موقع الويب ← الموقع ← «سماح».', 'وإذا ما ضبط: الإعدادات ← الخصوصية والأمن ← خدمات الموقع ← مواقع سفاري ← «أثناء استخدام التطبيق».', 'بعدها «جرّب مرة ثانية».'])
      : ['أيقونة القفل يسار الرابط ← الأذونات ← الموقع ← «سماح».', 'والموقع يكون شغّال في الجوال (من الشريط اللي ينزل من فوق).', 'بعدها «جرّب مرة ثانية».'])
    : err === 'nosupport'
      ? ['الموقع يشتغل من سفاري أو كروم، مو من المتصفح اللي داخل واتساب أو التطبيقات.']
      : ['خدمات الموقع تكون شغّالة في الجوال.', 'تشغيل الواي فاي يساعد الجوال يحدد مكانه داخل المباني، حتى بدون ما يتصل بشبكة.', 'القرب من الباب أو الشباك يسرّع تحديد المكان.'];
  const title = err === 'denied' ? 'الجوال رافض يعطي الموقع' : err === 'nosupport' ? 'المتصفح ما يدعم الموقع' : 'ما تحدد المكان';
  openModal(`${dlgHead(title)}<ol class="loc-steps">${steps.map(s => `<li>${s}</li>`).join('')}</ol><div class="dlg-foot">${retryAct ? `<button class="btn pri" data-act="${retryAct}">جرّب مرة ثانية</button>` : ''}<button class="btn" data-act="close">إغلاق</button></div>`);
}
/** تسجيل وصول المعلم بضغطة: يجيب الموقع بس إذا موقع الجامع محدد. يرجع true إذا تسجّل */
async function checkinFlow(el) {
  if (myTin()) return true;
  const old = el ? el.textContent : '';
  if (el) { el.disabled = true; el.textContent = 'يحدد موقعك…'; }
  const done = ok => { if (el && el.isConnected) { el.disabled = false; el.textContent = old; } return ok; };
  let body = {};
  if (needLoc()) {
    const r = await getPos();
    if (!r.pos) { done(false); locHelp(r.err, 'tin'); return false; }
    body = { lat: r.pos.coords.latitude, lng: r.pos.coords.longitude, acc: r.pos.coords.accuracy };
  }
  const res = await act('teacher.checkin', body, x => x.already ? 'مسجّل من قبل' : 'سجّلت وصولك ✓');
  if (res) buzz(20);
  return done(!!res);
}

function onsiteV(u, s) {
  const studs = studentsOf(s.halqaId); const att = s.att || {}; const left = s.left || {};
  const h = S.halaqat[s.halqaId] || {}; const mode = lessonMode(s);
  const recs = L('recs').filter(r => r.sid === s.id); const recBy = new Set(recs.map(r => r.uid));
  const cnt = v => studs.filter(x => att[x.id] === v).length;
  const f = ST.osf || 'all';
  const state = st => left[st.id] ? 'out' : att[st.id] === 'a' ? 'a' : att[st.id] === 'e' ? 'e' : (att[st.id] === 'p' || att[st.id] === 'l') ? (recBy.has(st.id) ? 'done' : 'here') : 'none';
  const order = { here: 0, none: 1, done: 2, out: 3, e: 4, a: 5 };
  let list = [...studs].sort((a, b) => order[state(a)] - order[state(b)] || (a.name || '').localeCompare(b.name || '', 'ar'));
  if (f === 'left') list = list.filter(x => ['here', 'none'].includes(state(x)));
  if (f === 'done') list = list.filter(x => state(x) === 'done');
  if (f === 'abs') list = list.filter(x => ['a', 'e', 'out'].includes(state(x)));
  const head = `<button class="back" data-act="tab" data-v="sessions">→ الحصص</button>
  <div class="os-head"><div class="grow" style="min-width:0"><h1>${esc(h.name || '')}</h1><div class="muted small">${fmtDateH(s.date)} · ${fmtTime(s.time)}${h.place ? ' · ' + esc(h.place) : ''}${s.note ? ' · ' + esc(s.note) : ''}</div></div>
    <div class="row"><button class="chip mode-chip" data-act="os-mode" data-id="${s.id}" title="تحويل نوع هذي الحصة">${MODE_L[mode]} ▾</button>${s.closedAt ? '<span class="chip ok">انتهت</span>' : ''}${u.role === 'admin' ? `<button class="btn ghost sm" data-act="edit-session" data-id="${s.id}">تعديل</button>` : ''}</div></div>`;
  if (s.cancelled) return head + `<div class="note">هذه الحصة ملغاة${s.note ? ': ' + esc(s.note) : ''}.</div><div><button class="btn" data-act="lesson-restore" data-id="${s.id}">استرجاع الحصة</button></div>`;
  const stats = `<div class="os-stats"><div><b class="num">${cnt('p') + cnt('l')}<small>/${studs.length}</small></b><span>حاضر</span></div><div><b class="num">${cnt('l')}</b><span>متأخر</span></div><div><b class="num">${cnt('a')}</b><span>غائب</span></div><div><b class="num">${recBy.size}</b><span>سمّعوا</span></div></div>`;
  const tabs = `<div class="ptabs">${[['all', 'الكل'], ['left', 'باقي ما سمّعوا'], ['done', 'سمّعوا'], ['abs', 'غياب وانصراف']].map(([k, l]) => `<button class="${f === k ? 'on' : ''}" data-act="os-f" data-v="${k}">${l}</button>`).join('')}</div>`;
  const link = effLink(s);
  const hybrid = mode === 'hybrid' && link ? `<div class="row"><a class="btn" href="${esc(link)}" target="_blank" rel="noopener" data-act="join" data-id="${s.id}">${ICO.live} غرفة الطلاب اللي من البيت</a></div>` : '';
  const card = st => {
    const v = att[st.id]; const lf = left[st.id]; const ml = v === 'l' ? minsLate(s, st.id) : 0; const arr = (s.arr || {})[st.id];
    const rs = recs.filter(r => r.uid === st.id); const here = (v === 'p' || v === 'l') && !lf;
    const last = recsOf(st.id).find(r => r.sid !== s.id);
    const p = planOf(st); const noMem = !(+p.auto.newPos > +p.auto.memStart) && !Object.keys(p.manual || {}).length && !recsOf(st.id).length;
    const chip = lf ? `<span class="chip">انصرف ${clock(lf.at)}</span>` : v ? `<span class="chip ${ATTC[v]}">${ATT[v]}${ml ? ' ' + ml + ' د' : ''}</span>` : '';
    const stk = attendStreak(st); const rb = repsBrief(st.id);
    return `<div class="os-card st-${state(st)}">
      <div class="os-top"><div class="grow" style="min-width:0"><b>${esc(st.name)}</b><div class="small muted">${[arr ? 'وصل ' + clock(arr) : '', last ? 'آخر تسميع ' + fmtDate(last.date) + ' · ' + last.grade : '', stk >= 3 ? '🔥 ' + stk : '', rb].filter(Boolean).join(' · ') || '&nbsp;'}</div></div>${chip}<button class="btn ghost sm" data-act="os-more" data-id="${st.id}" aria-label="خيارات ${esc(st.name)}">⋯</button></div>
      ${!v && !lf ? `<div class="os-att"><button class="btn pri" data-act="os-arr" data-id="${st.id}">✓ حاضر</button><button class="btn" data-act="os-att" data-id="${st.id}" data-v="a">غائب</button><button class="btn" data-act="os-att" data-id="${st.id}" data-v="e">مستأذن</button></div>` : ''}
      ${here ? `<div class="os-due">${planBrief(st)}</div>` : ''}
      ${rs.length ? `<div class="row">${recMerge(rs).map(r => `<span class="chip ${GRADE_K[r.grade] || ''}">${TYPE[r.type]}${r.items.length > 1 ? ' (' + r.items.length + ' سور)' : ''}: ${esc(r.grade)}</span>`).join('')}</div>` : ''}
      ${here ? `<div class="os-act"><button class="btn pri" data-act="os-rec" data-id="${st.id}">${ICO.mic} ${rs.length ? 'تسميع ثاني' : 'سمّع'}</button><button class="btn" data-act="os-new" data-id="${st.id}">الحفظ الجديد</button><button class="btn" data-act="os-pts" data-id="${st.id}" aria-label="نقاط ${esc(st.name)}">⭐ <span class="num">${balOf(st.id)}</span></button></div>` : ''}
      ${noMem ? `<button class="linkbtn" data-act="os-level" data-id="${st.id}">طالب جديد؟ سجّل محفوظه</button>` : ''}
    </div>`;
  };
  const isToday = s.date === today();
  const foot = `<div class="row os-foot">${studs.some(x => !att[x.id]) ? '<button class="btn" data-act="att-rest">الباقي غائب</button>' : ''}${s.closedAt ? `<button class="btn ghost" data-act="os-close" data-id="${s.id}" data-undo="1">تراجع عن الإنهاء</button>` : `<button class="btn pri" data-act="os-close" data-id="${s.id}">إنهاء الحلقة وإرسال الملخص</button>`}</div>`;
  const waiting = seqQueue(s).length;
  const seqBar = s.date === today() && !s.closedAt && waiting ? `<div class="seq-bar"><div class="grow"><b>التسميع المتتابع</b><span class="small muted">${waiting} حاضر ما سمّع، بترتيب وصولهم${ST.seq && ST.seq.sid === s.id && ST.seq.on ? ' · شغّال' : ''}</span></div><button class="btn pri" data-act="seq-start">${ICO.mic} ${ST.seq && ST.seq.sid === s.id && ST.seq.on ? 'كمّل' : 'ابدأ'}</button></div>` : '';
  return head + checkinBar(u, s) + stats + seqBar + hybrid + tabs + `<div class="os-grid">${list.map(card).join('') || '<div class="empty">ما فيه طلاب هنا.</div>'}</div>` + (isToday || s.date < today() ? foot : '') + `<section class="card"><h2>تسميع هذه الحصة</h2>${historyTable(recs, true, true)}</section>`;
}

/* ---- التسميع المتتابع: الحاضرين اللي ما سمّعوا بترتيب وصولهم، واحد ورا الثاني ---- */
function seqQueue(s) {
  const att = s.att || {}; const left = s.left || {}; const arr = s.arr || {};
  const done = new Set(L('recs').filter(r => r.sid === s.id).map(r => r.uid)); const skip = (ST.seq && ST.seq.sid === s.id && ST.seq.skip) || [];
  return studentsOf(s.halqaId).filter(x => (att[x.id] === 'p' || att[x.id] === 'l') && !left[x.id] && !done.has(x.id) && !skip.includes(x.id))
    .sort((a, b) => (arr[a.id] || 9e15) - (arr[b.id] || 9e15) || (a.name || '').localeCompare(b.name || '', 'ar'));
}
function seqNext() {
  const s = curSession(); if (!ST.seq || !ST.seq.on || ST.seq.sid !== s.id) return;
  let q = seqQueue(s);
  if (!q.length && (ST.seq.skip || []).length) { ST.seq.skip = []; q = seqQueue(s); }
  if (!q.length) { ST.seq = null; closeModal(); render(); return toast('خلص التسميع: كل الحاضرين سمّعوا ✓'); }
  const st = q[0]; const arr = (s.arr || {})[st.id]; const n = ST.seq.n = (ST.seq.n || 0) + 1;
  openModal(`${dlgHead('التسميع المتتابع')}<div class="seq-next"><span class="small muted">التالي${arr ? ' · وصل ' + clock(arr) : ''}</span><b>${esc(st.name)}</b><div class="os-due">${planBrief(st)}</div>${q[1] ? `<span class="small muted">وبعده: ${esc(q[1].name)}${q.length > 2 ? ' و' + (q.length - 2) + ' غيره' : ''}</span>` : '<span class="small muted">آخر واحد في الدور</span>'}</div>
    <div class="dlg-foot"><button class="btn pri" data-act="seq-go" data-id="${st.id}">${ICO.mic} سمّع</button><button class="btn" data-act="seq-skip" data-id="${st.id}">تخطَّه للآخر</button><button class="btn ghost" data-act="seq-stop">إيقاف</button></div>`);
}
Object.assign(ACT, {
  'seq-start': () => { const s = curSession(); if (!ST.seq || ST.seq.sid !== s.id) ST.seq = { sid: s.id, skip: [], n: 0 }; ST.seq.on = true; seqNext(); },
  'seq-go': el => { const uid = el.dataset.id; closeModal(); startRec(uid, ST.sid, 'modal'); ST.rec.after = () => newMemModal(uid); openModal(recPanelHtml()); },
  'seq-skip': el => { const s = curSession(); if (!ST.seq) return; ST.seq.skip = [...(ST.seq.skip || []), el.dataset.id]; if (!seqQueue(s).length) ST.seq.skip = []; seqNext(); },
  'seq-stop': () => { if (ST.seq) ST.seq.on = false; closeModal(); render(); },
  'seq-after': () => { closeModal(); seqNext(); },
});
/* ---- الحفظ الجديد للحصة الجاية ---- */
const AMTS = [[0, 'بدون'], [0.25, 'ربع'], [0.5, 'نصف'], [1, 'وجه'], [2, 'وجهين']];
function nmStart(st) {
  const p = planOf(st); const dir = p.auto.dir === 'fwd' ? 'fwd' : 'bwd'; const O = ORD[dir];
  const lastNew = recsOf(st.id).find(r => r.type === 'new' && r.pass);
  if (lastNew) return { dir, pos: O.pos[gOf(lastNew.surah, lastNew.to)] + 1 };
  const mn = p.manual && p.manual.new; if (mn) return { dir, pos: O.pos[gOf(mn.toSurah || mn.surah, mn.to)] + 1 };
  return { dir, pos: Math.max(0, +p.auto.newPos || 0) };
}
function nmSeg(st, amt) {
  const { dir, pos } = nmStart(st); const O = ORD[dir]; if (pos >= TOTAL) return null;
  const t = take(O.ord, pos, TOTAL, amt, false); const sg = segs(t.list); if (!sg.length) return null;
  const a = sg[0], z = sg[sg.length - 1];
  return { surah: a.s + 1, from: a.a1, toSurah: z.s + 1, to: z.a2, text: a.s === z.s ? `${SN[a.s]} ${a.a1}–${z.a2}` : `من ${SN[a.s]} ${a.a1} إلى ${SN[z.s]} ${z.a2}` };
}
function newMemModal(uid) {
  const st = { ...S.users[uid], id: uid }; if (!st.name) return;
  const p = planOf(st); const auto = isAuto(st); const custom = ST.nmCustom === uid;
  const g = planGroups(st).find(x => x.type === 'new' && !x.retry);
  const now = g ? `<div class="nm-now"><span class="small muted">الحفظ الجديد للحصة الجاية</span><b>${esc(partsText(g.parts))}</b>${partsPages(g.parts) ? `<span class="small muted">${partsPages(g.parts)}</span>` : ''}</div>` : '<div class="nm-now"><span class="small muted">الحفظ الجديد للحصة الجاية</span><b>ما فيه حفظ جديد</b></div>';
  let body = '';
  if (auto && !custom) {
    const cur = +p.auto.newAmt || 0;
    body = `<div class="small muted">الخطة تلقائية وتكمل بعد آخر حفظ نجح فيه. المقدار:</div><div class="amt-row">${AMTS.map(([a, l]) => `<button class="btn ${cur === a ? 'pri' : ''}" data-act="nm-amt" data-id="${uid}" data-v="${a}">${l}</button>`).join('')}</div>`;
  } else {
    const sug = AMTS.filter(([a]) => a > 0).map(([a, l]) => ({ a, l, seg: nmSeg(st, a) })).filter(x => x.seg);
    const mn = p.manual && p.manual.new;
    body = `${sug.length ? `<div class="small muted">يكمل بعد آخر حفظ نجح فيه. اختر المقدار:</div><div class="nm-sug">${sug.map(x => `<button class="btn" data-act="nm-seg" data-id="${uid}" data-s="${x.seg.surah}" data-f="${x.seg.from}" data-ts="${x.seg.toSurah}" data-t="${x.seg.to}"><b>${x.l}</b><span>${esc(x.seg.text)}</span></button>`).join('')}</div>` : ''}
      <details ${sug.length ? '' : 'open'}><summary class="small">حدد المقطع بنفسك</summary><form data-form="nm" data-id="${uid}" class="fgrid" style="margin-top:8px;align-items:end">
        <label class="fld"><span>السورة</span><select name="surah" required>${surahOptions(mn ? mn.surah : '')}</select></label>
        <label class="fld"><span>من آية</span><input name="from" type="number" min="1" inputmode="numeric" value="${mn ? mn.from : ''}" required></label>
        <label class="fld"><span>إلى آية</span><input name="to" type="number" min="1" inputmode="numeric" value="${mn && (!mn.toSurah || mn.toSurah === mn.surah) ? mn.to : ''}" required></label>
        <button class="btn pri" type="submit">حفظ</button></form></details>
      ${mn ? `<button class="linkbtn" data-act="nm-clear" data-id="${uid}">بدون حفظ جديد</button>` : ''}`;
  }
  openModal(`${dlgHead('الحفظ الجديد · ' + esc(st.name))}${now}${body}
    <div class="dlg-foot">${auto ? `<button class="btn ghost sm" data-act="nm-custom" data-id="${uid}">${custom ? 'رجوع للتلقائي' : 'حدد مقطع بنفسك'}</button>` : ''}${ST.seq && ST.seq.on && ST.seq.sid === ST.sid ? '<button class="btn pri" data-act="seq-after">التالي ←</button>' : '<button class="btn" data-act="close">تم</button>'}</div>`);
}

/* ---- النقاط من بطاقة الطالب ---- */
const PT_REASONS = { '+': ['انضباط', 'تميّز في الحفظ', 'مساعدة زميل', 'هدوء وأدب'], '-': ['إزعاج', 'تأخر', 'ما راجع', 'جوال في الحلقة'] };
function ptsModal(uid) {
  const st = S.users[uid]; if (!st) return; const pm = ST.pm && ST.pm.uid === uid ? ST.pm : (ST.pm = { uid, amt: 1, reason: '' });
  const sign = pm.amt > 0 ? '+' : '-';
  const items = L('rewards').filter(r => r.kind === 'item' && r.active && !r.closed && (!r.branch || r.branch === ((S.halaqat[st.halqaId] || {}).branch || '')) && (r.stock == null || r.stock > 0)).sort((a, b) => a.eff - b.eff);
  const tx = L('ptx').filter(t => t.uid === uid).slice(0, 4);
  openModal(`${dlgHead('النقاط · ' + esc(st.name))}
    <div class="pm-bal"><b class="num">${balOf(uid)}</b><span>نقطة رصيده الحين</span></div>
    <div class="amt-row">${[5, 2, 1, -1, -2, -5].map(a => `<button class="btn ${pm.amt === a ? (a > 0 ? 'pri' : 'danger') : ''}" data-act="pm-amt" data-v="${a}">${a > 0 ? '+' + a : a}</button>`).join('')}</div>
    <div class="row">${PT_REASONS[sign].map(r => `<button class="btn sm ${pm.reason === r ? 'pri' : 'ghost'}" data-act="pm-r" data-v="${esc(r)}">${esc(r)}</button>`).join('')}</div>
    <input id="pm-reason" placeholder="أو اكتب السبب" value="${esc(PT_REASONS[sign].includes(pm.reason) ? '' : pm.reason)}" data-input="pm-reason">
    <div class="row"><button class="btn pri" data-act="pm-save" data-id="${uid}">${pm.amt > 0 ? 'أضف ' + pm.amt : 'اخصم ' + -pm.amt} ${Math.abs(pm.amt) === 1 ? 'نقطة' : 'نقاط'}</button></div>
    ${tx.length ? `<div class="list">${tx.map(t => `<div class="item small"><b class="num ${t.amount > 0 ? 'c-ok' : 'c-bad'}">${t.amount > 0 ? '+' : ''}${t.amount}</b><div class="grow">${esc(t.reason)}</div><span class="muted">${fmtDate(isoDate(new Date(t.at)))}</span></div>`).join('')}</div>` : ''}
    ${items.length ? `<details><summary class="small">اطلب جائزة له</summary><div class="list" style="margin-top:8px">${items.map(r => `<div class="item"><div class="grow"><b>${esc(r.name)}</b></div><span class="chip num">${r.eff} نقطة</span><button class="btn sm" data-act="ord-for" data-id="${r.id}" data-uid="${uid}" ${r.eff > balOf(uid) ? 'disabled' : ''}>اطلب</button></div>`).join('')}</div></details>` : ''}`);
}

/* ---- تسجيل المحفوظ واختبار تحديد المستوى ---- */
const JUZ = [[1, 1], [2, 142], [2, 253], [3, 93], [4, 24], [4, 148], [5, 82], [6, 111], [7, 88], [8, 41], [9, 93], [11, 6], [12, 53], [15, 1], [17, 1], [18, 75], [21, 1], [23, 1], [25, 21], [27, 56], [29, 46], [33, 31], [36, 28], [39, 32], [41, 47], [46, 1], [51, 31], [58, 1], [67, 1], [78, 1]];
function juzRange(dir, n) {
  if (!n) return null;
  if (dir === 'bwd') { const [s, a] = JUZ[30 - n]; const es = a === 1 ? s : s + 1; return { fromS: 114, fromA: 1, toS: es, toA: AYAS[es - 1] }; }
  if (n >= 30) return { fromS: 1, fromA: 1, toS: 114, toA: 6 };
  const [s, a] = JUZ[n]; return a > 1 ? { fromS: 1, fromA: 1, toS: s, toA: a - 1 } : { fromS: 1, fromA: 1, toS: s - 1, toA: AYAS[s - 2] };
}
function lvRange(lv) {
  const r = juzRange(lv.dir, lv.juz); if (!r) return null;
  if (lv.toS) { r.toS = +lv.toS; r.toA = Math.min(AYAS[r.toS - 1], +lv.toA || AYAS[r.toS - 1]); }
  const O = ORD[lv.dir]; const ms = O.pos[gOf(r.fromS, r.fromA)], me = O.pos[gOf(r.toS, r.toA)]; if (me < ms) return null;
  const pages = new Set(); if (PG) for (let i = ms; i <= me; i++) pages.add(PG[O.ord[i]]);
  return { ...r, ms, me, pages: PG ? pages.size : Math.round((me - ms + 1) * 604 / TOTAL) };
}
function levelModal(uid) {
  const st = S.users[uid]; if (!st) return;
  const p = planOf({ ...st, id: uid });
  if (!ST.lv || ST.lv.uid !== uid) ST.lv = { uid, step: 1, dir: p.auto.dir === 'fwd' ? 'fwd' : 'bwd', juz: 1, toS: '', toA: '', marks: [], spots: [] };
  const lv = ST.lv; const r = lvRange(lv);
  const steps = `<ol class="stepper small"><li class="${lv.step === 1 ? 'on' : 'done'}"><b>1</b><span>المحفوظ</span></li><li class="${lv.step === 2 ? 'on' : lv.step > 2 ? 'done' : ''}"><b>2</b><span>اختبار سريع</span></li><li class="${lv.step === 3 ? 'on' : ''}"><b>3</b><span>الخطة</span></li></ol>`;
  let body = '';
  if (lv.step === 1) {
    body = `<div class="row"><button class="btn sm ${lv.dir === 'bwd' ? 'pri' : ''}" data-act="lv-dir" data-v="bwd">يحفظ من الناس</button><button class="btn sm ${lv.dir === 'fwd' ? 'pri' : ''}" data-act="lv-dir" data-v="fwd">يحفظ من البقرة</button></div>
      <div class="fld"><span>كم جزء حافظ؟</span><div class="juz-grid">${[...Array(31).keys()].map(n => `<button class="btn sm ${lv.juz === n ? 'pri' : ''}" data-act="lv-juz" data-v="${n}">${n}</button>`).join('')}</div></div>
      ${r ? `<div class="nm-now"><span class="small muted">محفوظه</span><b>من ${SN[r.fromS - 1]} ${r.fromA} إلى ${SN[r.toS - 1]} ${r.toA}</b><span class="small muted">≈ ${r.pages} وجه</span></div>
      <details><summary class="small">عدّل نهاية المحفوظ بالضبط</summary><div class="fgrid" style="margin-top:8px"><label class="fld"><span>إلى سورة</span><select id="lv-tos" data-change="lv-to">${surahOptions(r.toS)}</select></label><label class="fld"><span>آية</span><input id="lv-toa" type="number" min="1" inputmode="numeric" value="${r.toA}" data-change="lv-to"></label></div></details>` : '<div class="note small">ما يحفظ شي: يبدأ الحفظ من أول ' + (lv.dir === 'bwd' ? 'سورة الناس' : 'الفاتحة') + '.</div>'}
      <div class="dlg-foot">${r ? '<button class="btn pri" data-act="lv-step" data-v="2">التالي: اختبار سريع</button><button class="btn ghost" data-act="lv-step" data-v="3">تخطّى الاختبار</button>' : '<button class="btn pri" data-act="lv-step" data-v="3">التالي</button>'}</div>`;
  } else if (lv.step === 2) {
    if (!lv.spots.length && r) { const O = ORD[lv.dir]; const n = Math.min(3, r.me - r.ms + 1); const set = new Set(); while (set.size < n) set.add(r.ms + Math.floor(Math.random() * (r.me - r.ms + 1))); lv.spots = [...set].sort((a, b) => a - b).map(i => O.ord[i]); lv.marks = lv.spots.map(() => ''); }
    body = `<div class="small muted">اطلب من الطالب يقرأ من هالمواضع، وقيّم كل واحد:</div>
      <div class="list">${lv.spots.map((g, i) => { const s = SUR[g]; const a = g - SSTART[s] + 1; return `<div class="item lv-spot"><div class="grow"><b>${esc(SN[s])} · آية ${a}</b>${PG ? `<div class="small muted">صفحة ${PG[g]}</div>` : ''}</div><div class="seg">${[['g', 'متقن', 'p'], ['m', 'متوسط', 'l'], ['w', 'ضعيف', 'a']].map(([k, l, c]) => `<button class="${c} ${lv.marks[i] === k ? 'on' : ''}" data-act="lv-mark" data-i="${i}" data-v="${k}">${l}</button>`).join('')}</div></div>`; }).join('')}</div>
      <button class="linkbtn" data-act="lv-shuffle">مواضع ثانية</button>
      <div class="dlg-foot"><button class="btn pri" data-act="lv-step" data-v="3" ${lv.marks.every(Boolean) ? '' : 'disabled'}>التالي: الخطة</button><button class="btn ghost" data-act="lv-step" data-v="1">رجوع</button></div>`;
  } else {
    const ms = lv.marks.filter(Boolean); const w = ms.filter(x => x === 'w').length, g = ms.filter(x => x === 'g').length;
    const res = !ms.length ? '' : w >= 2 ? 'ضعيف' : g === ms.length ? 'متقن' : 'متوسط'; lv.result = res;
    const M = r ? r.pages : 0;
    if (!lv.amounts) { const base = res === 'ضعيف' ? { newAmt: 0.25, revAmt: 2, tathAmt: 1 } : res === 'متقن' ? { newAmt: 1, revAmt: 5, tathAmt: 2 } : { newAmt: 0.5, revAmt: 3, tathAmt: 1 }; lv.amounts = { newAmt: base.newAmt, revAmt: M ? Math.min(base.revAmt, Math.max(1, Math.round(M / 4))) : 0, tathAmt: M ? Math.min(base.tathAmt, M) : 0 }; }
    const row = (k, l, opts) => `<div class="fld"><span>${l}</span><div class="amt-row">${opts.map(a => `<button class="btn sm ${lv.amounts[k] === a ? 'pri' : ''}" data-act="lv-amt" data-k="${k}" data-v="${a}">${a === 0 ? 'بدون' : a === 0.25 ? 'ربع' : a === 0.5 ? 'نصف' : a}</button>`).join('')}</div></div>`;
    body = `${res ? `<div class="nm-now"><span class="small muted">نتيجة الاختبار</span><b>${res}</b></div>` : ''}
      ${row('newAmt', 'الحفظ الجديد (وجه)', [0, 0.25, 0.5, 1, 2])}${M ? row('revAmt', 'المراجعة (وجه)', [1, 2, 3, 5, 10, 20]) + row('tathAmt', 'التثبيت (وجه)', [0, 0.5, 1, 2, 3]) : ''}
      <div class="dlg-foot"><button class="btn pri" data-act="lv-save">حفظ المحفوظ والخطة</button><button class="btn ghost" data-act="lv-step" data-v="${lv.spots.length ? 2 : 1}">رجوع</button></div>`;
  }
  openModal(`${dlgHead('محفوظ ' + esc(st.name))}${steps}${body}`);
}

/* ---- وضع الحصة وإنهاؤها ---- */
function osSummaryModal(sum, s) {
  openModal(`${dlgHead('ملخص ' + esc(halqaName(s.halqaId)))}<div class="os-stats"><div><b class="num">${sum.p + sum.l}<small>/${sum.total}</small></b><span>حاضر</span></div><div><b class="num">${sum.l}</b><span>متأخر</span></div><div><b class="num">${sum.a}</b><span>غائب</span></div><div><b class="num">${sum.rec}</b><span>سمّع</span></div></div>
    ${sum.retry ? `<div class="small">إعادة: ${sum.retry} طالب</div>` : ''}${sum.out ? `<div class="small">انصرف بدري: ${sum.out}</div>` : ''}
    ${sum.notRec.length ? `<div class="note small">حضروا وما سمّعوا: ${sum.notRec.map(esc).join('، ')}</div>` : ''}
    <div class="small muted">وصل الملخص للإدارة.</div><div class="dlg-foot"><button class="btn pri" data-act="close">تم</button></div>`);
}

Object.assign(ACT, {
  'tin': async el => {
    const inModal = !!el.closest('#modal'); if (inModal) closeModal();
    await checkinFlow(inModal ? null : el);
  },
  'tout': async el => {
    el.disabled = true; const old = el.textContent; el.textContent = 'لحظة…';
    const g = await Promise.race([getPos(), new Promise(r => setTimeout(() => r({}), 8000))]); const pos = g && g.pos;
    const body = pos ? { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy } : {};
    const r = await act('teacher.checkout', body, x => x.needConfirm ? '' : x.already ? 'مسجّل خروجك من قبل' : 'سجّلت خروجك ✓');
    el.disabled = false; el.textContent = old;
    if (r && r.needConfirm) confirmBox(`وقت الانصراف ${clock(r.end)}، باقي ${r.left} دقيقة. تسجّل خروجك الحين؟ ينرسل تنبيه للإدارة.`, 'سجّل خروجي', () => act('teacher.checkout', { ...body, early: true }, 'سجّلت خروجك'));
  },
  'tout-undo': () => act('teacher.checkout', { undo: true }, 'رجّعنا تسجيل الخروج'),
  'quick-rec': () => { ST.qrq = ''; quickRecModal(); },
  'rep': el => repBump(el.dataset.k, +el.dataset.d),
  // صفحة الحصص: الفترة والتنقل والتعديل المتعدد
  'ses-r': el => { ST.sr = el.dataset.v; if (ST.sr === 'up') ST.sd = today(); render(); },
  'ses-step': el => { ST.sd = addDays(ST.sd || today(), +el.dataset.n); render(); },
  'ses-day': el => { ST.sd = el.dataset.d; ST.sr = 'day'; render(); },
  'ses-today': () => { ST.sd = today(); render(); },
  'ses-sel-on': () => { ST.selOn = !ST.selOn; ST.sel = new Set(); render(); },
  'ses-sel-off': () => { ST.selOn = false; ST.sel = new Set(); render(); },
  'ses-sel': el => { const id = el.dataset.id; if (ST.sel.has(id)) ST.sel.delete(id); else ST.sel.add(id); render(); },
  'ses-sel-day': el => { const ids = sesInView().filter(s => s.date === el.dataset.d).map(s => s.id); const all = ids.every(id => ST.sel.has(id)); ids.forEach(id => all ? ST.sel.delete(id) : ST.sel.add(id)); render(); },
  'ses-sel-all': () => { const ids = sesInView().map(s => s.id); const all = ids.length && ids.every(id => ST.sel.has(id)); ids.forEach(id => all ? ST.sel.delete(id) : ST.sel.add(id)); render(); },
  'bulk-time': () => openModal(`${dlgHead('وقت ' + ST.sel.size + ' حصة')}<form data-form="bulk-time" class="fld"><label class="fld"><span>الوقت الجديد</span><input type="time" name="time" required></label><div class="small muted">يتغير لهذي الحصص بس، ووقت الحلقة الدائم ما يتغير.</div><div class="dlg-foot"><button class="btn pri" type="submit">تغيير</button></div></form>`),
  'bulk-cancel': el => { const v = el.dataset.v === '1'; const n = ST.sel.size; if (!v) return bulkDo({ cancel: false }, `استرجعت ${n} حصة`); openModal(`${dlgHead('إلغاء ' + n + ' حصة')}<form data-form="bulk-cancel"><label class="fld"><span>السبب (يطلع للطلاب)</span><input name="note" placeholder="مثال: مطر، إجازة، اختبارات"></label><div class="dlg-foot"><button class="btn danger" type="submit">إلغاء الحصص</button></div></form>`); },
  'os-f': el => { ST.osf = el.dataset.v; render(); },
  'os-arr': async el => { const s = curSession(); el.disabled = true; const r = await act('lesson.arrive', { id: s.id, uid: el.dataset.id }); if (r && r.v === 'l') toast(`متأخر ${r.min} دقيقة`); buzz(12); },
  'os-att': el => { const s = curSession(); act('lesson.att', { id: s.id, uid: el.dataset.id, v: el.dataset.v }); },
  'os-rec': el => { const uid = el.dataset.id; startRec(uid, ST.sid, 'modal'); ST.rec.after = () => newMemModal(uid); openModal(recPanelHtml()); },
  'os-new': el => { ST.nmCustom = null; newMemModal(el.dataset.id); },
  'os-pts': el => { ST.pm = null; ptsModal(el.dataset.id); },
  'os-level': el => { ST.lv = null; levelModal(el.dataset.id); },
  'os-more': el => {
    const s = curSession(); const uid = el.dataset.id; const st = S.users[uid]; const v = (s.att || {})[uid]; const lf = (s.left || {})[uid];
    openModal(`${dlgHead(esc(st.name))}<div class="fld"><span>الحالة</span><div class="seg">${Object.keys(ATT).map(k => `<button class="${k} ${v === k ? 'on' : ''}" data-act="os-set" data-id="${uid}" data-v="${k}">${ATT[k]}</button>`).join('')}</div></div>
      ${(v === 'p' || v === 'l') ? (lf ? `<div class="row"><span class="chip">انصرف ${clock(lf.at)}${lf.reason ? ': ' + esc(lf.reason) : ''}</span><button class="btn sm ghost" data-act="os-out" data-id="${uid}" data-undo="1">تراجع</button></div>` : `<form data-form="os-out" data-id="${uid}" class="row" style="align-items:end"><label class="fld" style="flex:1 1 160px"><span>انصراف بدري (يوصل ولي الأمر)</span><input name="reason" placeholder="السبب (اختياري)"></label><button class="btn" type="submit">انصرف</button></form>`) : ''}
      <div class="ms-grid">${`<button class="ms-it" data-act="os-level" data-id="${uid}">${ICO.reports || ICO.more}<span>محفوظه واختبار المستوى</span></button><button class="ms-it" data-act="open-student" data-id="${uid}">${ICO.students}<span>صفحة الطالب</span></button>${st.parentPhone ? `<button class="ms-it" data-act="tpl-pick" data-id="${uid}">${ICO.wa}<span>رسالة لولي الأمر</span></button>` : ''}`}</div>`);
  },
  'os-set': el => { const s = curSession(); const uid = el.dataset.id; const cur = (s.att || {})[uid]; const v = cur === el.dataset.v ? null : el.dataset.v; closeModal(); if (v === 'p' || v === 'l') act('lesson.arrive', { id: s.id, uid, v }); else act('lesson.att', { id: s.id, uid, v }); },
  'os-out': el => { const s = curSession(); closeModal(); act('lesson.out', { id: s.id, uid: el.dataset.id, undo: true }, 'تراجعت'); },
  'os-close': async el => {
    const s = curSession(); if (el.dataset.undo) return act('lesson.close', { id: s.id, undo: true });
    const studs = studentsOf(s.halqaId); const none = studs.filter(x => !(s.att || {})[x.id]).length;
    const go = async () => { const r = await act('lesson.close', { id: s.id }); if (r) osSummaryModal(r, s); };
    if (none) return confirmBox(`${none} طالب ما تحضّروا. تنهي الحلقة كذا؟`, 'أنهِ الحلقة', go);
    go();
  },
  'os-mode': el => {
    const s = curSession(); const cur = s.mode || '';
    openModal(`${dlgHead('نوع حصة ' + fmtDate(s.date))}<div class="small muted">يتغير لهذي الحصة بس. نوع الحلقة الدائم من صفحة الحلقات.</div><div class="list">${[['', 'حسب الحلقة (' + MODE_L[(S.halaqat[s.halqaId] || {}).mode || 'onsite'] + ')'], ['onsite', 'حضوري'], ['remote', 'عن بعد (مطر، إجازة…)'], ['hybrid', 'هجين: الحلقة في الجامع وبعضهم من البيت']].map(([k, l]) => `<button class="item click ${cur === k ? 'cur-acc' : ''}" data-act="os-mode-set" data-v="${k}"><div class="grow">${l}</div>${cur === k ? '<span class="chip ok">الحالي</span>' : ''}</button>`).join('')}</div>`);
  },
  'os-mode-set': el => { const s = curSession(); closeModal(); act('lesson.mode', { id: s.id, mode: el.dataset.v }, 'تغيّر نوع الحصة'); },
  'nm-amt': async el => { await act('plan.next', { id: el.dataset.id, newAmt: +el.dataset.v }, 'انحفظ'); newMemModal(el.dataset.id); },
  'nm-seg': async el => { const d = el.dataset; await act('plan.next', { id: d.id, seg: { surah: +d.s, from: +d.f, toSurah: +d.ts, to: +d.t } }, 'انحفظ الحفظ الجديد'); newMemModal(d.id); },
  'nm-clear': async el => { await act('plan.next', { id: el.dataset.id, seg: {} }, 'بدون حفظ جديد'); newMemModal(el.dataset.id); },
  'nm-custom': el => { ST.nmCustom = ST.nmCustom === el.dataset.id ? null : el.dataset.id; newMemModal(el.dataset.id); },
  'pm-amt': el => { ST.pm.amt = +el.dataset.v; const sign = ST.pm.amt > 0 ? '+' : '-'; if (!PT_REASONS[sign].includes(ST.pm.reason)) ST.pm.reason = ''; ptsModal(ST.pm.uid); },
  'pm-r': el => { ST.pm.reason = el.dataset.v; ptsModal(ST.pm.uid); },
  'pm-save': async el => { const pm = ST.pm; const reason = (pm.reason || ($('#pm-reason') || {}).value || '').trim(); if (!reason) return toast('اختر السبب'); const r = await act('points.add', { ids: [pm.uid], amount: pm.amt, reason }, (pm.amt > 0 ? '+' : '') + pm.amt + ' نقطة ✓'); if (r) { buzz(15); ST.pm.reason = ''; ptsModal(pm.uid); } },
  'ord-for': async el => { const r = await act('order.create', { rewardId: el.dataset.id, uid: el.dataset.uid }); if (r) { toast('انطلبت الجائزة · رمز الاستلام ' + r.code); ptsModal(el.dataset.uid); } },
  'lv-dir': el => { ST.lv.dir = el.dataset.v; ST.lv.toS = ''; ST.lv.spots = []; levelModal(ST.lv.uid); },
  'lv-juz': el => { ST.lv.juz = +el.dataset.v; ST.lv.toS = ''; ST.lv.spots = []; levelModal(ST.lv.uid); },
  'lv-step': el => { ST.lv.step = +el.dataset.v; if (ST.lv.step === 3) ST.lv.amounts = null; levelModal(ST.lv.uid); },
  'lv-mark': el => { ST.lv.marks[+el.dataset.i] = el.dataset.v; levelModal(ST.lv.uid); },
  'lv-shuffle': () => { ST.lv.spots = []; levelModal(ST.lv.uid); },
  'lv-amt': el => { ST.lv.amounts[el.dataset.k] = +el.dataset.v; levelModal(ST.lv.uid); },
  'lv-save': async () => {
    const lv = ST.lv; const r = lvRange(lv);
    const body = { id: lv.uid, dir: lv.dir, amounts: lv.amounts, ...(r ? { fromS: r.fromS, fromA: r.fromA, toS: r.toS, toA: r.toA } : { none: true }), ...(lv.marks.some(Boolean) ? { test: { marks: lv.marks, result: lv.result } } : {}) };
    const ok = await act('student.level', body, 'انحفظ المحفوظ والخطة ✓'); if (ok) { ST.lv = null; closeModal(); }
  },
});
CHG['lv-to'] = () => { ST.lv.toS = ($('#lv-tos') || {}).value || ''; ST.lv.toA = ($('#lv-toa') || {}).value || ''; ST.lv.spots = []; levelModal(ST.lv.uid); };
INP['pm-reason'] = el => { ST.pm.reason = el.value; };
FORMS.nm = async (f, d) => { const uid = f.dataset.id; const s = +d.get('surah'), fr = +d.get('from'), to = +d.get('to'); if (await act('plan.next', { id: uid, seg: { surah: s, from: fr, toSurah: s, to } }, 'انحفظ الحفظ الجديد')) newMemModal(uid); };
FORMS['os-out'] = async (f, d) => { const s = curSession(); closeModal(); act('lesson.out', { id: s.id, uid: f.dataset.id, reason: d.get('reason') || '' }, 'سجّلت الانصراف'); };

/* ================= لوحة اليوم في الجامع (المدير) ================= */
function todayBoardHtml(u) {
  const t = today(); const hs = myHalaqat(u);
  const rows = hs.map(h => { const s = L('sessions').find(x => x.halqaId === h.id && x.date === t && !x.cancelled); return s ? { h, s } : null; }).filter(Boolean).sort((a, b) => (a.s.time || '').localeCompare(b.s.time || ''));
  if (!rows.length) return '';
  const now = Date.now();
  const noPlace = hs.some(h => (h.mode || 'onsite') !== 'remote' && !placeOf(h.id));
  return `<section class="card" style="display:grid;gap:10px"><div class="sec-head"><h2>اليوم في الجامع</h2><span class="small muted">يتحدث لحاله</span></div>
    ${noPlace && isFullAdmin(u) ? `<div class="note small row"><span class="grow">حدد موقع الجامع عشان ما يقدر المعلم يسجّل وصوله إلا وهو فيه.</span><button class="btn sm" data-act="nav" data-v="complexes">حدد الموقع</button></div>` : ''}
    <div class="tbl-wrap"><table><thead><tr><th>الحلقة</th><th>الوقت</th><th>المعلم</th><th class="num">حاضر</th><th class="num">متأخر</th><th class="num">سمّع</th><th></th></tr></thead><tbody>
    ${rows.map(({ h, s }) => { const studs = studentsOf(h.id); const att = s.att || {}; const pres = studs.filter(x => att[x.id] === 'p' || att[x.id] === 'l').length; const late = studs.filter(x => att[x.id] === 'l').length; const rec = new Set(L('recs').filter(r => r.sid === s.id).map(r => r.uid)).size;
      const tid = s.subId || h.teacherId; const tin = (S.tins || {})[tid]; const start = lessonTs(s); const remote = lessonMode(s) === 'remote';
      const tTxt = remote ? '<span class="chip">عن بعد</span>' : tin ? `<span class="chip ${tin.at > start + 5 * 60000 ? 'warn' : 'ok'}">${clock(tin.at)}${tin.at > start + 5 * 60000 ? ' متأخر ' + Math.round((tin.at - start) / 60000) + ' د' : ''}</span>${tin.out ? ` <span class="chip ${tin.outEarly ? 'warn' : ''}">انصرف ${clock(tin.out)}${tin.outEarly ? ' مبكر ' + tin.outEarly + ' د' : tin.outAuto ? ' تلقائي' : ''}</span>` : ''}` : now > start ? '<span class="chip bad">ما وصل</span>' : '<span class="chip">ما بعد</span>';
      return `<tr class="click" data-act="open-session" data-id="${s.id}"><td><b>${esc(h.name)}</b>${h.place ? `<div class="small muted">${esc(h.place)}</div>` : ''}</td><td>${fmtTime(s.time)}</td><td>${esc((S.users[tid] || {}).name || '—')} ${tTxt}</td><td class="num">${pres}/${studs.length}</td><td class="num">${late || ''}</td><td class="num">${rec}</td><td>${s.closedAt ? '<span class="chip ok">انتهت</span>' : ''}</td></tr>`; }).join('')}
    </tbody></table></div></section>`;
}

/* ================= المجمعات ================= */
function complexesV(u) {
  const full = isFullAdmin(u); const sp = u.perms ? (u.perms || []).filter(x => x.startsWith('b:')).map(x => x.slice(2)) : null;
  const names = full ? branches() : (sp || []);
  const keys = names.length ? names : ['_'];
  const admins = L('users').filter(x => x.role === 'admin' && x.perms);
  const card = k => {
    const name = k === '_' ? (SET().center || 'الجامع') : k; const hs = L('halaqat').filter(h => (h.branch || '_') === k || (k === '_' && !h.branch));
    const studs = L('users').filter(x => x.role === 'student' && x.status === 'active' && hs.some(h => h.id === x.halqaId)).length;
    const p = (SET().places || {})[k]; const mgrs = admins.filter(a => (a.perms || []).includes('b:' + k));
    return `<section class="card cx" style="display:grid;gap:12px"><div class="sec-head"><div><h2>${esc(name)}</h2><span class="small muted">${hs.length} حلقة · ${studs} طالب</span></div>${full && k !== '_' ? `<div class="row"><button class="btn ghost sm" data-act="cx-rename" data-k="${esc(k)}">تغيير الاسم</button><button class="btn ghost sm" data-act="cx-del" data-k="${esc(k)}">حذف</button></div>` : ''}</div>
      <div class="cx-loc"><div class="grow"><b>موقع الجامع</b><div class="small ${p ? 'c-ok' : 'muted'}">${p ? `محدد · نطاق ${p.radius} م · <a href="${mapUrl(p)}" target="_blank" rel="noopener">شوفه على الخريطة</a>` : 'غير محدد: المعلم يسجّل وصوله بدون شرط الموقع'}</div></div>
        <button class="btn pri sm" data-act="cx-here" data-k="${esc(k)}">📍 أنا في الجامع الحين</button></div>
      <form data-form="cx-link" data-k="${esc(k)}" class="row" style="align-items:end"><label class="fld" style="flex:1 1 220px"><span>أو الصق رابط خرائط قوقل</span><input name="link" dir="ltr" placeholder="https://maps.app.goo.gl/…"></label>
        <label class="fld" style="flex:0 1 120px"><span>النطاق</span><select name="radius">${[100, 150, 250, 400].map(r => `<option value="${r}" ${(p ? p.radius : 150) === r ? 'selected' : ''}>${r} م</option>`).join('')}</select></label><button class="btn" type="submit">حفظ</button></form>
      ${k !== '_' || !names.length ? `<div class="fld"><span>مدير المجمع</span>${mgrs.length ? `<div class="list">${mgrs.map(a => `<div class="item"><div class="grow"><b>${esc(a.name)}</b><div class="small muted" dir="ltr">${esc(a.username)}</div></div>${full ? `<button class="btn ghost sm" data-act="edit-admin" data-id="${a.id}">تعديل</button>` : ''}</div>`).join('')}</div>` : '<div class="small muted">ما فيه مدير لهالمجمع.</div>'}${full && k !== '_' ? `<div><button class="btn sm" data-act="cx-mgr" data-k="${esc(k)}">إضافة مدير للمجمع</button></div>` : ''}</div>` : ''}
      ${hs.length ? `<div class="row">${hs.map(h => `<span class="chip">${esc(h.name)} · ${MODE_L[h.mode || 'onsite']}</span>`).join('')}</div>` : ''}
    </section>`;
  };
  return `<div class="sec-head"><div><h1>${full ? 'المجمعات' : 'مجمعي'}</h1><div class="muted small">${full ? 'كل مجمع له موقعه ومديره، وتتنقل بينها من الشريط فوق الصفحات' : ''}</div></div></div>
    ${keys.map(card).join('')}
    ${full ? `<form data-form="cx-add" class="card row" style="align-items:end"><label class="fld" style="flex:1 1 220px"><span>مجمع جديد</span><input name="name" required placeholder="مثال: جامع الرحمن"></label>${!branches().length && L('halaqat').length ? '<label class="check small"><input type="checkbox" name="moveAll" checked> انقل الحلقات الحالية له</label>' : ''}<button class="btn pri" type="submit">إضافة</button></form>` : ''}`;
}
Object.assign(ACT, {
  'cx-here': async el => {
    el.disabled = true; const old = el.textContent; el.textContent = 'يحدد موقعك…';
    const g = await getPos(); if (!g.pos) { el.disabled = false; el.textContent = old; return locHelp(g.err); }
    const pos = g.pos; const k = el.dataset.k; const sel = el.closest('.cx').querySelector('select[name=radius]');
    await act('place.save', { branch: k === '_' ? '' : k, lat: pos.coords.latitude, lng: pos.coords.longitude, radius: sel ? +sel.value : 150 }, 'انحفظ موقع الجامع ✓');
  },
  'cx-rename': el => { const k = el.dataset.k; openModal(`${dlgHead('تغيير اسم المجمع')}<form data-form="cx-rename" data-k="${esc(k)}"><label class="fld"><span>الاسم الجديد</span><input name="to" value="${esc(k)}" required></label><div class="dlg-foot"><button class="btn pri" type="submit">حفظ</button></div></form>`); },
  'cx-del': el => confirmBox('تحذف المجمع «' + esc(el.dataset.k) + '»؟', 'حذف', () => act('branch.delete', { name: el.dataset.k }, 'انحذف المجمع')),
  'cx-mgr': el => adminModal(null, [...MGR_PERMS, 'b:' + el.dataset.k]),
});
FORMS['cx-link'] = async (f, d) => { const k = f.dataset.k; if (await act('place.save', { branch: k === '_' ? '' : k, link: (d.get('link') || '').trim() || undefined, radius: +d.get('radius'), ...(!(d.get('link') || '').trim() ? { lat: ((SET().places || {})[k] || {}).lat, lng: ((SET().places || {})[k] || {}).lng } : {}) }, 'انحفظ ✓')) clean(); };
FORMS['cx-add'] = async (f, d) => { if (await act('branch.add', { name: d.get('name'), moveAll: !!d.get('moveAll') }, 'انضاف المجمع')) clean(); };
FORMS['cx-rename'] = async (f, d) => { if (await act('branch.rename', { from: f.dataset.k, to: d.get('to') }, 'تغيّر الاسم')) closeModal(); };

/* ================= المتجر والنقاط ================= */
const RW_KIND = { item: 'جائزة', group: 'جائزة للحلقة', auction: 'مزاد' };
const ORD_ST = { pending: ['warn', 'بانتظار التسليم'], delivered: ['ok', 'استلمها'], rejected: ['bad', 'مرفوض'], cancelled: ['', 'ملغي'] };
const cdLeft = ms => { const d = ms - Date.now(); if (d <= 0) return 'انتهى'; const h = Math.floor(d / 3600000); return h >= 24 ? 'باقي ' + Math.floor(h / 24) + ' يوم' : h ? 'باقي ' + h + ' ساعة' : 'باقي ' + Math.max(1, Math.round(d / 60000)) + ' دقيقة'; };
function rewardsFor(u) {
  const br = u.role === 'student' ? ((S.halaqat[u.halqaId] || {}).branch || '') : null;
  return L('rewards').filter(r => (u.role !== 'student' || (r.active && (!r.branch || r.branch === br))) && (u.role !== 'admin' || !ST.branch || !r.branch || r.branch === ST.branch)).sort((a, b) => (b.at || 0) - (a.at || 0));
}
function storeStudentV(u) {
  const bal = balOf(u.id); const rws = rewardsFor(u); const wish = u.wish && S.rewards[u.wish];
  const items = rws.filter(r => r.kind === 'item' && !r.closed); const aucs = rws.filter(r => r.kind === 'auction' && (!r.closed || r.winnerId === u.id)); const groups = rws.filter(r => r.kind === 'group' && !r.closed);
  const myOrders = L('orders').filter(o => o.uid === u.id).sort((a, b) => b.at - a.at);
  const tx = L('ptx').filter(t => t.uid === u.id).sort((a, b) => b.at - a.at).slice(0, 15);
  return `<div class="sec-head"><h1>المتجر</h1></div>
  <section class="card st-bal"><div><b class="num">${bal}</b><span>نقطة في رصيدك</span></div>${wish ? `<div class="grow"><div class="small">تجمع لـ <b>${esc(wish.name)}</b></div><div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, Math.round(bal / Math.max(1, wish.eff) * 100))}%"></div></div><div class="small muted">${bal >= wish.eff ? 'رصيدك يكفي، اطلبها!' : 'باقي ' + (wish.eff - bal) + ' نقطة'}</div></div>` : '<div class="grow small muted">اختر جائزة واضغط ♡ عشان تشوف كم باقي لك عليها.</div>'}</section>
  ${groups.map(r => { const v = (r.progress || {})[u.halqaId] || 0; return `<section class="card rw-group"><div class="sec-head"><div><span class="chip acc">جائزة الحلقة</span><h2>${esc(r.name)}</h2></div><b class="num">${v}/${r.target}</b></div>${r.note ? `<div class="small">${esc(r.note)}</div>` : ''}<div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, Math.round(v / Math.max(1, r.target) * 100))}%"></div></div><div class="small muted">${v >= r.target ? 'تحققت! بارك الله فيكم' : 'كل نقطة تكسبها تقرّب حلقتك منها'}</div></section>`; }).join('')}
  ${aucs.length ? `<h2>المزاد</h2><div class="rw-grid">${aucs.map(r => `<div class="rw-card"><div class="row"><span class="chip gold">مزاد</span><span class="small muted">${r.closed ? (r.winnerId === u.id ? 'فزت فيه 🎉' : 'انتهى') : cdLeft(r.endsAt)}</span></div><b>${esc(r.name)}</b>${r.note ? `<span class="small muted">${esc(r.note)}</span>` : ''}
    <div class="small">أعلى مزايدة: <b class="num">${r.top || r.price || 0}</b>${r.n ? ` · ${r.n} مزايدين` : ''}${r.mine ? ` · مزايدتك <b class="num">${r.mine}</b>${r.lead ? ' (الأعلى)' : ''}` : ''}</div>
    ${r.closed ? '' : `<form data-form="bid" data-id="${r.id}" class="row"><input name="amount" type="number" inputmode="numeric" min="${Math.max(r.price || 1, (r.top || 0) + 1)}" value="${Math.max(r.price || 1, (r.top || 0) + 1)}" style="flex:1 1 90px" aria-label="مزايدتك"><button class="btn pri" type="submit">زايد</button></form>`}</div>`).join('')}</div>` : ''}
  <h2>الجوائز</h2>${items.length ? `<div class="rw-grid">${items.map(r => { const sale = r.eff < r.price; const out = r.stock != null && r.stock <= 0; return `<div class="rw-card ${out ? 'out' : ''}"><div class="row"><span class="num rw-price">${r.eff}${sale ? ` <s>${r.price}</s>` : ''} نقطة</span>${sale ? `<span class="chip bad">عرض لين ${fmtDate(r.saleUntil)}</span>` : ''}<button class="linkbtn rw-wish ${u.wish === r.id ? 'on' : ''}" data-act="wish" data-id="${u.wish === r.id ? '' : r.id}" aria-label="أجمع لها">${u.wish === r.id ? '♥' : '♡'}</button></div><b>${esc(r.name)}</b>${r.note ? `<span class="small muted">${esc(r.note)}</span>` : ''}${r.stock != null ? `<span class="small muted">${out ? 'خلصت' : 'باقي ' + r.stock}</span>` : ''}<button class="btn ${bal >= r.eff && !out ? 'pri' : ''}" data-act="ord" data-id="${r.id}" ${bal >= r.eff && !out ? '' : 'disabled'}>${out ? 'خلصت' : bal >= r.eff ? 'اطلبها' : 'باقي ' + (r.eff - bal)}</button></div>`; }).join('')}</div>` : '<div class="empty small">ما فيه جوائز للحين.</div>'}
  ${myOrders.length ? `<section class="card"><h2>طلباتي</h2><div class="list">${myOrders.map(o => { const r = S.rewards[o.rid] || {}; const [c, l] = ORD_ST[o.status] || ['', o.status]; return `<div class="item"><div class="grow"><b>${esc(r.name || 'جائزة')}</b><div class="small muted">${fmtDate(isoDate(new Date(o.at)))} · ${o.price} نقطة</div></div>${o.status === 'pending' ? `<span class="code-chip" title="رمز الاستلام">${esc(o.code)}</span>` : ''}<span class="chip ${c}">${l}</span>${o.status === 'pending' ? `<button class="btn ghost sm" data-act="ord-cancel" data-id="${o.id}">إلغاء</button>` : ''}</div>`; }).join('')}</div><div class="small muted">اعرض رمز الاستلام للمعلم وقت ما يسلّمك الجائزة.</div></section>` : ''}
  ${tx.length ? `<details class="card"><summary><h2>حركات النقاط</h2></summary><div class="list">${tx.map(t => `<div class="item small"><b class="num ${t.amount > 0 ? 'c-ok' : 'c-bad'}">${t.amount > 0 ? '+' : ''}${t.amount}</b><div class="grow">${esc(t.reason)}${t.byName ? ` <span class="muted">· ${esc(t.byName)}</span>` : ''}</div><span class="muted">${fmtDate(isoDate(new Date(t.at)))}</span></div>`).join('')}</div><div class="small muted">والنقاط التلقائية تنحسب من حضورك وتسميعك.</div></details>` : ''}`;
}
function storeStaffV(u) {
  const admin = u.role === 'admin' && can(u, 'store'); const tab = ST.stTab || 'orders';
  const pend = L('orders').filter(o => o.status === 'pending' && S.users[o.uid]);
  const tabs = [['orders', 'الطلبات' + (pend.length ? ` (${pend.length})` : '')], ['rewards', 'الجوائز'], ['points', 'النقاط'], ...(admin ? [['budget', 'الميزانية']] : [])];
  let body = '';
  if (tab === 'orders') {
    const done = L('orders').filter(o => o.status !== 'pending' && S.users[o.uid]).sort((a, b) => (b.doneAt || b.at) - (a.doneAt || a.at)).slice(0, 20);
    body = `<section class="card" style="display:grid;gap:10px"><h2>بانتظار التسليم</h2>${pend.length ? `<div class="list">${pend.sort((a, b) => a.at - b.at).map(o => { const r = S.rewards[o.rid] || {}; const st = S.users[o.uid]; return `<div class="item"><div class="grow"><b>${esc(st.name)}</b> · ${esc(r.name || 'جائزة')}<div class="small muted">${esc(halqaName(st.halqaId))} · ${fmtDate(isoDate(new Date(o.at)))} · ${o.price} نقطة</div></div><span class="code-chip">${esc(o.code)}</span><button class="btn pri sm" data-act="ord-done" data-id="${o.id}">سلّمته</button><button class="btn ghost sm" data-act="ord-rej" data-id="${o.id}">رفض</button></div>`; }).join('')}</div>` : '<div class="empty small">ما فيه طلبات.</div>'}</section>
      ${done.length ? `<section class="card"><h2>آخر الطلبات</h2><div class="list">${done.map(o => { const r = S.rewards[o.rid] || {}; const [c, l] = ORD_ST[o.status] || ['', o.status]; return `<div class="item small"><div class="grow"><b>${esc((S.users[o.uid] || {}).name || '')}</b> · ${esc(r.name || 'جائزة')}</div><span class="chip ${c}">${l}</span></div>`; }).join('')}</div></section>` : ''}`;
  } else if (tab === 'rewards') {
    const rws = rewardsFor(u);
    body = `${admin ? '<div class="row"><button class="btn pri" data-act="rw-add">إضافة جائزة</button></div>' : ''}${rws.length ? `<div class="rw-grid">${rws.map(r => `<div class="rw-card ${r.active ? '' : 'out'}"><div class="row"><span class="chip ${r.kind === 'auction' ? 'gold' : r.kind === 'group' ? 'acc' : ''}">${RW_KIND[r.kind]}</span>${r.branch ? `<span class="chip">${esc(r.branch)}</span>` : ''}${r.active ? '' : '<span class="chip">مخفية</span>'}${r.closed ? '<span class="chip ok">انتهت</span>' : ''}</div><b>${esc(r.name)}</b>
        <span class="small muted">${r.kind === 'group' ? 'هدف الحلقة ' + r.target + ' نقطة' + Object.entries(r.progress || {}).map(([h, v]) => `<br>${esc(halqaName(h))}: ${v}`).join('') : r.kind === 'auction' ? `يبدأ من ${r.price} · أعلى ${r.top || 0}${r.n ? ` (${esc((S.users[(r.bids || [])[0] && r.bids[0].uid] || {}).name || '')})` : ''} · ${r.closed ? (r.winnerId ? 'فاز ' + esc((S.users[r.winnerId] || {}).name || '') : 'بدون فائز') : cdLeft(r.endsAt)}` : `${r.eff} نقطة${r.eff < r.price ? ` (بدل ${r.price})` : ''}${r.stock != null ? ' · باقي ' + r.stock : ''}`}${admin && r.cost ? ' · ' + r.cost + ' ريال' : ''}</span>
        ${admin ? `<div class="row"><button class="btn sm" data-act="rw-edit" data-id="${r.id}">تعديل</button>${r.kind === 'auction' && !r.closed ? `<button class="btn sm" data-act="rw-close" data-id="${r.id}">أقفل المزاد الحين</button>` : ''}${r.kind === 'group' ? `<button class="btn sm" data-act="rw-close" data-id="${r.id}">${r.closed ? 'رجّعها' : 'تحققت'}</button>` : ''}</div>` : ''}</div>`).join('')}</div>` : '<div class="empty small">ما فيه جوائز.</div>'}`;
  } else if (tab === 'points') {
    const studs = L('users').filter(x => x.role === 'student' && x.status === 'active' && myHalaqat(u).some(h => h.id === x.halqaId)).sort((a, b) => balOf(b.id) - balOf(a.id));
    const tx = L('ptx').filter(t => S.users[t.uid]).sort((a, b) => b.at - a.at).slice(0, 30);
    body = `<section class="card" style="display:grid;gap:10px"><div class="sec-head"><h2>الأرصدة</h2><button class="btn sm" data-act="pts-bulk">نقاط لأكثر من طالب</button></div><div class="list">${studs.map((x, i) => `<div class="item click" data-act="os-pts" data-id="${x.id}"><span class="qnum">${i + 1}</span><div class="grow"><b>${esc(x.name)}</b><div class="small muted">${esc(halqaName(x.halqaId))}</div></div><b class="num">${balOf(x.id)}</b></div>`).join('') || '<div class="empty small">ما فيه طلاب.</div>'}</div></section>
      ${tx.length ? `<section class="card"><h2>آخر الحركات</h2><div class="list">${tx.map(t => `<div class="item small"><b class="num ${t.amount > 0 ? 'c-ok' : 'c-bad'}">${t.amount > 0 ? '+' : ''}${t.amount}</b><div class="grow"><b>${esc(S.users[t.uid].name)}</b> · ${esc(t.reason)}${t.byName ? ` <span class="muted">· ${esc(t.byName)}</span>` : ''}</div><span class="muted">${fmtDate(isoDate(new Date(t.at)))}</span></div>`).join('')}</div></section>` : ''}`;
  } else {
    const m0 = today().slice(0, 7); const del = L('orders').filter(o => o.status === 'delivered' && o.doneAt && isoDate(new Date(o.doneAt)).slice(0, 7) === m0);
    const sum = del.reduce((t, o) => t + (+(S.rewards[o.rid] || {}).cost || 0), 0);
    const byR = {}; del.forEach(o => { byR[o.rid] = (byR[o.rid] || 0) + 1; });
    const low = L('rewards').filter(r => r.kind === 'item' && r.active && r.stock != null && r.stock <= 3);
    body = `<section class="card"><div class="stats"><div class="stat"><b class="num">${Math.round(sum)}</b><span>ريال مصروف هالشهر</span></div><div class="stat"><b class="num">${del.length}</b><span>جائزة تسلّمت</span></div><div class="stat"><b class="num">${pend.length}</b><span>بانتظار التسليم</span></div></div></section>
      ${Object.keys(byR).length ? `<section class="card"><h2>تفصيل الشهر</h2><div class="list">${Object.entries(byR).map(([rid, n]) => { const r = S.rewards[rid] || {}; return `<div class="item"><div class="grow">${esc(r.name || 'جائزة محذوفة')}</div><span class="num">${n} × ${r.cost || 0} = ${Math.round(n * (r.cost || 0))} ريال</span></div>`; }).join('')}</div></section>` : ''}
      ${low.length ? `<section class="card"><h2>المخزون قارب يخلص</h2><div class="list">${low.map(r => `<div class="item"><div class="grow">${esc(r.name)}</div><span class="chip ${r.stock ? 'warn' : 'bad'}">باقي ${r.stock}</span><button class="btn sm" data-act="rw-edit" data-id="${r.id}">تعديل</button></div>`).join('')}</div></section>` : ''}`;
  }
  return `<div class="sec-head"><h1>المتجر والنقاط</h1></div><div class="ptabs">${tabs.map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="st-tab" data-v="${k}">${l}</button>`).join('')}</div>${body}`;
}
function storeV(u) { return u.role === 'student' ? storeStudentV(u) : storeStaffV(u); }
function rewardModal(r) {
  const k = ST.rwKind || (r ? r.kind : 'item'); const hs = myHalaqat(me());
  const dtl = ms => { if (!ms) return ''; const d = new Date(ms); return isoDate(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  openModal(`${dlgHead(r ? 'تعديل جائزة' : 'جائزة جديدة')}<form data-form="reward" data-id="${r ? r.id : ''}">
    <div class="seg">${Object.entries(RW_KIND).map(([x, l]) => `<button type="button" class="${k === x ? 'on p' : ''}" data-act="rw-kind" data-v="${x}" ${r ? 'disabled' : ''}>${l}</button>`).join('')}</div>
    <label class="fld"><span>الاسم</span><input name="name" required value="${esc(r ? r.name : '')}" placeholder="${k === 'group' ? 'مثال: رحلة للحلقة' : k === 'auction' ? 'مثال: مصحف فاخر' : 'مثال: قسيمة مكتبة 20 ريال'}"></label>
    <label class="fld"><span>وصف (اختياري)</span><input name="note" value="${esc(r ? r.note : '')}"></label>
    ${k === 'group' ? `<div class="fgrid"><label class="fld"><span>هدف النقاط للحلقة</span><input name="target" type="number" min="1" required value="${r ? r.target || '' : ''}"></label><label class="fld"><span>الحلقة</span><select name="halqaId"><option value="">كل حلقة لحالها</option>${hs.map(h => `<option value="${h.id}" ${r && r.halqaId === h.id ? 'selected' : ''}>${esc(h.name)}</option>`).join('')}</select></label></div>`
      : `<div class="fgrid"><label class="fld"><span>${k === 'auction' ? 'يبدأ المزاد من (نقطة)' : 'السعر بالنقاط'}</span><input name="price" type="number" min="${k === 'auction' ? 0 : 1}" required value="${r ? r.price : ''}"></label>${k === 'item' ? `<label class="fld"><span>الكمية (فاضي = بدون حد)</span><input name="stock" type="number" min="0" value="${r && r.stock != null ? r.stock : ''}"></label>` : `<label class="fld"><span>ينتهي المزاد</span><input name="endsAt" type="datetime-local" required value="${r ? dtl(r.endsAt) : ''}"></label>`}</div>`}
    ${k === 'item' ? `<details ${r && r.salePrice != null ? 'open' : ''}><summary class="small">عرض مؤقت</summary><div class="fgrid" style="margin-top:8px"><label class="fld"><span>سعر العرض</span><input name="salePrice" type="number" min="1" value="${r && r.salePrice != null ? r.salePrice : ''}"></label><label class="fld"><span>لين تاريخ</span><input name="saleUntil" type="date" value="${r && r.saleUntil ? r.saleUntil : ''}"></label></div></details>` : ''}
    <div class="fgrid"><label class="fld"><span>التكلفة بالريال (للميزانية)</span><input name="cost" type="number" min="0" step="0.5" value="${r ? r.cost || '' : ''}"></label>${branches().length ? `<label class="fld"><span>المجمع</span><select name="branch"><option value="">كل المجمعات</option>${branches().map(b => `<option ${r && r.branch === b ? 'selected' : (!r && ST.branch === b ? 'selected' : '')}>${esc(b)}</option>`).join('')}</select></label>` : ''}</div>
    <label class="check"><input type="checkbox" name="active" ${!r || r.active ? 'checked' : ''}> ظاهرة للطلاب</label>
    <div class="dlg-foot"><button class="btn pri" type="submit">حفظ</button>${r ? `<button type="button" class="btn danger" data-act="rw-del" data-id="${r.id}">حذف</button>` : ''}</div></form>`);
}
function ptsBulkModal() {
  const u = me(); const hs = myHalaqat(u); const hid = ST.pbH && hs.some(h => h.id === ST.pbH) ? ST.pbH : (hs[0] || {}).id;
  const studs = studentsOf(hid);
  openModal(`${dlgHead('نقاط لأكثر من طالب')}<form data-form="pts-bulk">${hs.length > 1 ? `<label class="fld"><span>الحلقة</span><select data-change="pb-h">${hs.map(h => `<option value="${h.id}" ${h.id === hid ? 'selected' : ''}>${esc(h.name)}</option>`).join('')}</select></label>` : ''}
    <div class="wa-pick">${studs.map(x => `<label class="wa-st"><input type="checkbox" name="ids" value="${x.id}"><span class="grow">${esc(x.name)} <span class="small muted num">${balOf(x.id)}</span></span></label>`).join('')}</div>
    <div class="fgrid"><label class="fld"><span>النقاط (بالسالب للخصم)</span><input name="amount" type="number" required value="2"></label><label class="fld"><span>السبب</span><input name="reason" required placeholder="مثال: مسابقة الحلقة"></label></div>
    <div class="dlg-foot"><button class="btn pri" type="submit">سجّل</button></div></form>`);
}
Object.assign(ACT, {
  'st-tab': el => { ST.stTab = el.dataset.v; render(); },
  'ord': el => { const r = S.rewards[el.dataset.id]; confirmBox(`تطلب «${esc(r.name)}» بـ ${r.eff} نقطة؟`, 'اطلبها', async () => { const x = await act('order.create', { rewardId: el.dataset.id }); if (x) { buzz(30); toast('انطلبت 🎁 رمز الاستلام ' + x.code); } }); },
  'ord-cancel': el => confirmBox('تلغي الطلب وترجع نقاطك؟', 'ألغِ الطلب', () => act('order.cancel', { id: el.dataset.id }, 'انلغى ورجعت نقاطك')),
  'ord-done': el => act('order.done', { id: el.dataset.id, status: 'delivered' }, 'تم التسليم ✓'),
  'ord-rej': el => confirmBox('ترفض الطلب؟ النقاط ترجع للطالب.', 'رفض', () => act('order.done', { id: el.dataset.id, status: 'rejected' }, 'انرفض ورجعت النقاط')),
  'wish': el => act('wish.set', { rewardId: el.dataset.id || '' }, el.dataset.id ? 'صرت تجمع لها ♥' : 'شلتها'),
  'rw-add': () => { ST.rwKind = 'item'; rewardModal(null); },
  'rw-edit': el => { ST.rwKind = null; rewardModal({ ...S.rewards[el.dataset.id], id: el.dataset.id }); },
  'rw-kind': el => { ST.rwKind = el.dataset.v; rewardModal(null); },
  'rw-del': el => confirmBox('تحذف الجائزة؟ الطلبات اللي ما تسلّمت ترجع نقاطها.', 'حذف', async () => { if (await act('reward.delete', { id: el.dataset.id }, 'انحذفت')) closeModal(); }),
  'rw-close': el => act('reward.done', { id: el.dataset.id }, x => x.winner ? 'انقفل المزاد وفاز ' + ((S.users[x.winner] || {}).name || '') : 'تم'),
  'pts-bulk': () => ptsBulkModal(),
});
CHG['pb-h'] = el => { ST.pbH = el.value; ptsBulkModal(); };
FORMS.reward = async (f, d) => {
  const k = ST.rwKind || (S.rewards[f.dataset.id] || {}).kind || 'item';
  const data = { kind: k, name: d.get('name'), note: d.get('note') || '', price: d.get('price') ?? 0, stock: d.get('stock') ?? '', cost: d.get('cost') || 0, branch: d.get('branch') || '', salePrice: d.get('salePrice') || '', saleUntil: d.get('saleUntil') || '', endsAt: d.get('endsAt') ? new Date(d.get('endsAt')).toISOString() : '', target: d.get('target') || '', halqaId: d.get('halqaId') || '', active: !!d.get('active') };
  if (await act('reward.save', { id: f.dataset.id || undefined, data }, 'انحفظت الجائزة')) closeModal();
};
FORMS.bid = async (f, d) => { if (await act('bid.place', { rewardId: f.dataset.id, amount: +d.get('amount') }, 'انحفظت مزايدتك ✓')) clean(); };
FORMS['pts-bulk'] = async (f, d) => { const ids = d.getAll('ids'); if (!ids.length) return toast('اختر طالب'); if (await act('points.add', { ids, amount: +d.get('amount'), reason: d.get('reason') }, 'تم ✓')) closeModal(); };

/* ---------------- النسخ الاحتياطي: داخل الموقع + قاعدة بيانات ثانية منفصلة ---------------- */
function backupHtml() {
  if (!ST.bkx && !ST.bkxLoading) { ST.bkxLoading = true; act('backup.ext', {}).then(r => { ST.bkxLoading = false; ST.bkx = r || { on: false, list: [] }; render(); }); }
  const x = ST.bkx; const last = x && x.last;
  const loc = (S.backups || []);
  return `<section class="card" style="display:grid;gap:12px"><div class="sec-head"><h2>النسخ الاحتياطي</h2><div class="row"><button class="btn pri" data-act="backup-now">انسخ الحين</button><a class="btn" href="/api/backup" download>تنزيل نسخة الحين</a></div></div>
    <div class="small muted">كل يوم الساعة 4 الفجر تنحفظ نسخة كاملة تلقائيًا: داخل قاعدة الموقع (آخر 7 أيام)، وفي قاعدة بيانات ثانية منفصلة (آخر 30 يوم) عشان لو صار شي لقاعدة الموقع تبقى النسخ سليمة.</div>
    <div class="bk-box ${x && x.on ? 'ok' : ''}"><b>القاعدة الخارجية: ${!x ? '…' : x.on ? '<span class="c-ok">مربوطة ✓</span>' : '<span class="c-warn">مو مربوطة</span>'}</b>
      ${x && x.err ? `<div class="small c-bad">${esc(x.err)}</div>` : ''}
      ${last ? `<div class="small muted">آخر محاولة ${fmtDate(isoDate(new Date(last.at)))} ${clock(last.at)}: ${last.ok ? 'نجحت (' + Math.round((last.size || 0) / 1024) + ' ك.ب)' : 'ما نجحت' + (last.err ? ' — ' + esc(last.err) : '')}</div>` : ''}
      ${x && !x.on ? `<ol class="steps small"><li>في Vercel افتح مشروع الموقع ← <b>Storage</b> ← <b>Create Database</b> ← <b>Neon</b>.</li><li>اختر منطقة غير فرانكفورت (مثل <b>Washington</b>) عشان تكون النسخ في مكان ثاني، وسمّها مثل irtaq-backup.</li><li>لما يسألك تربطها بالمشروع: اكتب في <b>Custom Prefix</b> كلمة <b dir="ltr">BACKUP</b> ووافق.</li><li>اضغط <b>Redeploy</b> للموقع، وبعدها ارجع هنا واضغط «انسخ الحين».</li></ol><div class="small muted">لا تربط قاعدة موقع ثاني، لازم قاعدة جديدة فاضية.</div>` : ''}
      ${x && x.on && (x.list || []).length ? `<details><summary class="small">النسخ الخارجية (${x.list.length})</summary><div class="list">${x.list.map(b => `<div class="item"><div class="grow">${fmtDate(isoDate(new Date(b.at)))} ${clock(b.at)} <span class="small muted">${Math.round(b.size / 1024)} ك.ب${b.kind === 'manual' ? ' · يدوية' : ''}</span></div><a class="btn sm" href="/api/backup?ext=${b.id}" download>تنزيل</a></div>`).join('')}</div></details>` : ''}
    </div>
    ${loc.length ? `<details><summary class="small">النسخ داخل الموقع (${loc.length})</summary><div class="list">${loc.map(b => `<div class="item"><div class="grow">${fmtDate(isoDate(new Date(b.at)))} ${clock(b.at)} <span class="small muted">${Math.round(b.size / 1024)} ك.ب</span></div><a class="btn sm" href="/api/backup?id=${b.id}" download>تنزيل</a></div>`).join('')}</div></details>` : '<div class="small muted">ما فيه نسخ تلقائية بعد. تحتاج CRON_SECRET في Vercel.</div>'}
  </section>`;
}
Object.assign(ACT, { 'backup-now': async el => { el.disabled = true; const old = el.textContent; el.textContent = 'ينسخ…'; const r = await act('backup.now', {}, x => x.ext && x.ext.ok ? 'انحفظت النسخة داخل الموقع وفي القاعدة الخارجية ✓' : 'انحفظت داخل الموقع' + (x.ext && x.ext.err ? '، والخارجية: ' + x.ext.err : '')); el.disabled = false; el.textContent = old; if (r) { ST.bkx = null; render(); } } });

/* ---------------- مكتبات خارجية عند الحاجة ---------------- */
const LIBS = {};
function loadScript(src) {
  if (!LIBS[src]) LIBS[src] = new Promise((ok, no) => { const el = document.createElement('script'); el.src = src; el.async = true; el.onload = () => ok(); el.onerror = () => { delete LIBS[src]; no(new Error('ما قدرنا نحمّل الأداة، تأكد من النت وجرّب مرة ثانية')); }; document.head.appendChild(el); });
  return LIBS[src];
}
const QR_LIB = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
const XLSX_LIB = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';

/* ---------------- بطاقات الطلاب للطباعة ---------------- */
function cardsModal() {
  const u = me(); const hs = myHalaqat(u); const adm = u.role === 'admin' && can(u, 'students');
  openModal(`${dlgHead('بطاقات الطلاب')}<form data-form="cards" style="display:grid;gap:12px">
    <div class="small muted">بطاقة لكل طالب بحجم بطاقة البنك، 10 بطاقات في الورقة. فيها اسمه وحلقته ومعلمه ووقت الحلقة واسم الدخول، ورمز يفتح الموقع واسمه مكتوب.</div>
    <label class="fld"><span>الحلقة</span><select name="halqa">${hs.length > 1 ? '<option value="">كل الحلقات</option>' : ''}${hs.map(h => `<option value="${h.id}" ${ST.halqa === h.id ? 'selected' : ''}>${esc(h.name)} (${studentsOf(h.id).length})</option>`).join('')}</select></label>
    <label class="check"><input type="checkbox" name="qr" checked> رمز QR للدخول</label>
    <label class="check"><input type="checkbox" name="sched" checked> أيام الحلقة ووقتها</label>
    ${adm ? `<label class="check"><input type="checkbox" name="pw"> كلمة مرور جديدة لكل طالب تنطبع في البطاقة</label><div class="small c-warn">انتبه: كلمة المرور القديمة تتوقف للطلاب المختارين، وأي جهاز داخل بحسابهم يحتاج يدخل من جديد.</div>` : '<div class="small muted">كلمة المرور تنكتب باليد، أو يطبعها المدير جديدة.</div>'}
    <div class="dlg-foot"><button class="btn pri" type="submit">جهّز البطاقات</button></div></form>`);
}
FORMS.cards = async (f, d) => {
  const hid = d.get('halqa') || ''; const hs = hid ? [hid] : myHalaqat(me()).map(h => h.id);
  const studs = hs.flatMap(h => studentsOf(h)); if (!studs.length) return toast('ما فيه طلاب في هالحلقة');
  const btn = f.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = 'لحظة…';
  let pws = {};
  try {
    if (d.get('pw')) { const r = await act('students.resetpw', { ids: studs.map(x => x.id) }); if (!r) return; (r.list || []).forEach(x => pws[x.id] = x.pw); }
    let qr = null; if (d.get('qr')) { try { await loadScript(QR_LIB); qr = window.qrcode; } catch { toast('ما انحمّل الرمز، بتنطبع البطاقات بدونه'); } }
    const html = cardsHtml(studs, { qr, sched: !!d.get('sched'), pws });
    const w = window.open('', '_blank');
    if (!w) return toast('المتصفح منع فتح نافذة الطباعة، اسمح بالنوافذ المنبثقة للموقع وجرّب');
    w.document.open(); w.document.write(html); w.document.close(); closeModal();
  } finally { btn.disabled = false; btn.textContent = 'جهّز البطاقات'; }
};
function cardsHtml(studs, o) {
  const center = SET().center || 'حلقات ارتق'; const host = location.host; const fem = inGirls();
  const card = st => {
    const h = S.halaqat[st.halqaId] || {}; const t = h.teacherId && S.users[h.teacherId];
    const link = location.origin + '/?u=' + encodeURIComponent(st.username || '');
    let svg = ''; if (o.qr) { try { const q = o.qr(0, 'M'); q.addData(link); q.make(); svg = q.createSvgTag(2, 0); } catch {} }
    const days = halqaDays(st.halqaId).map(d => DAYN[d]).join('، ');
    return `<div class="c"><div class="top"><span class="mk">${MARK}</span><b>${esc(center)}</b></div>
      <div class="body"><div class="info"><div class="nm">${esc(st.name)}</div>
        <div class="ln">${esc(h.name || '')}${t ? ' · ' + (fem ? 'المعلمة ' : 'المعلم ') + esc(t.name) : ''}</div>
        ${o.sched && (days || h.time) ? `<div class="ln">${esc(days)}${h.time ? ' · ' + fmtTime(h.time) : ''}${h.place ? ' · ' + esc(h.place) : ''}</div>` : ''}
        <div class="cred"><span>اسم الدخول</span><b dir="ltr">${esc(st.username || '')}</b></div>
        <div class="cred"><span>كلمة المرور</span>${o.pws[st.id] ? `<b dir="ltr">${o.pws[st.id]}</b>` : '<i></i>'}</div></div>
        ${svg ? `<div class="qr">${svg}<span>امسح للدخول</span></div>` : ''}</div>
      <div class="ft" dir="ltr">${esc(host)}</div></div>`;
  };
  const acc = fem ? '#a23c6b' : '#1c6a5a';
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>بطاقات الطلاب</title><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&family=Reem+Kufi:wght@600&display=swap">
<style>@page{size:A4;margin:10mm}*{box-sizing:border-box}body{margin:0;font-family:"IBM Plex Sans Arabic",Tahoma,sans-serif;color:#15302a;--accent:${acc};--accent-ink:#fff}
.bar{display:flex;gap:10px;align-items:center;justify-content:space-between;padding:12px 16px;background:#f2f6f4;border-bottom:1px solid #d5e1db;font-size:14px}.bar button{font:inherit;font-weight:700;background:${acc};color:#fff;border:0;border-radius:10px;padding:10px 18px;cursor:pointer}
.grid{display:grid;grid-template-columns:repeat(2,85.6mm);gap:6mm 8mm;justify-content:center;padding:8mm 0}
.c{width:85.6mm;height:54mm;border:1px solid #c9d6cf;border-radius:3.5mm;overflow:hidden;display:grid;grid-template-rows:auto 1fr auto;break-inside:avoid;page-break-inside:avoid;background:#fff}
.top{display:flex;align-items:center;gap:2mm;padding:1.8mm 3mm;background:${acc};color:#fff;font-family:"Reem Kufi","IBM Plex Sans Arabic",sans-serif;font-size:9.5pt}.mk svg{width:4.5mm;height:4.5mm;display:block}.mk rect{fill:#fff}.mk path{stroke:${acc}}
.body{display:flex;gap:2.5mm;padding:2mm 3mm;min-height:0}.info{flex:1;min-width:0;display:grid;align-content:start;gap:.6mm}
.nm{font-weight:700;font-size:11.5pt;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ln{font-size:7.5pt;color:#4b5f58;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cred{display:flex;align-items:baseline;gap:2mm;font-size:7.5pt;margin-top:.6mm}.cred span{color:#5a6f68;min-width:15mm}.cred b{font-size:9.5pt;letter-spacing:.3px}.cred i{flex:1;border-bottom:1px dotted #8aa298;height:3.5mm}
.qr{width:21mm;display:grid;justify-items:center;align-content:start;gap:.5mm}.qr svg{width:21mm;height:21mm}.qr span{font-size:6pt;color:#5a6f68}
.ft{font-size:6.5pt;color:#7a8e87;padding:0 3mm 1.5mm;text-align:left}
@media print{.bar{display:none}.grid{padding:0}}</style></head><body>
<div class="bar"><span>${studs.length} بطاقة · اطبعها على ورق مقوّى وقصّها</span><button onclick="print()">اطبع</button></div>
<div class="grid">${studs.map(card).join('')}</div>
<script>document.fonts && document.fonts.ready.then(function(){setTimeout(function(){try{print()}catch(e){}},300)})<\/script></body></html>`;
}

/* ---------------- تصدير Excel كامل ---------------- */
async function exportExcel(el) {
  const old = el ? el.textContent : ''; if (el) { el.disabled = true; el.textContent = 'يجهّز الملف…'; }
  try {
    await loadScript(XLSX_LIB); const X = window.XLSX;
    const u = me(); const hs = myHalaqat(u); const hids = new Set(hs.map(h => h.id)); const hn = id => (S.halaqat[id] || {}).name || '';
    const studs = L('users').filter(x => x.role === 'student' && (hids.has(x.halqaId) || (u.role === 'admin' && !x.halqaId))).sort((a, b) => (hn(a.halqaId) + a.name).localeCompare(hn(b.halqaId) + b.name, 'ar'));
    const nm = id => (S.users[id] || {}).name || '';
    const ST_L = { active: 'نشط', pending: 'بانتظار الاعتماد', disabled: 'موقوف', archived: 'مؤرشف' };
    const sheets = [];
    sheets.push(['الطلاب', studs.map(x => { const a = attStats(x, 0); const h = S.halaqat[x.halqaId] || {}; return {
      'الاسم': x.name, 'اسم الدخول': x.username, 'الحلقة': hn(x.halqaId), 'المعلم': nm(h.teacherId), 'المجمع': h.branch || '', 'الحالة': ST_L[x.status] || x.status,
      'جوال الطالب': x.phone || '', 'ولي الأمر': x.parentName || '', 'جوال ولي الأمر': x.parentPhone || '', 'المحفوظ (أوجه)': isAuto(x) ? autoInfo(x).memPages : '', 'الخطة': isAuto(x) ? 'تلقائية' : 'يدوية',
      'نسبة الحضور %': a.rate == null ? '' : a.rate, 'حضور': a.p, 'تأخر': a.l, 'غياب': a.a, 'استئذان': a.e, 'سلسلة الحضور': attendStreak(x), 'رصيد النقاط': x.status === 'pending' ? '' : balOf(x.id),
      'تاريخ الاعتماد': x.approvedAt ? isoDate(new Date(x.approvedAt)) : '', 'آخر دخول': x.lastSeen ? isoDate(new Date(x.lastSeen)) : '' }; })]);
    const sids = new Set(studs.map(x => x.id));
    const recs = L('recs').filter(r => sids.has(r.uid)).sort((a, b) => (b.date + (b.at || 0)).localeCompare(a.date + (a.at || 0)));
    sheets.push(['التسميع', recs.map(r => ({ 'التاريخ': r.date, 'الطالب': nm(r.uid), 'الحلقة': hn(r.halqaId || (S.users[r.uid] || {}).halqaId), 'النوع': TYPE[r.type] || r.type, 'السورة': SN[r.surah - 1] || '', 'من آية': r.from, 'إلى آية': r.to, 'الأوجه': Math.round(recPages(r) * 100) / 100, 'الأخطاء': r.quick ? '' : r.mistakes, 'التنبيهات': r.quick ? '' : r.alerts, 'التقدير': r.grade, 'ناجح': r.pass ? 'نعم' : 'إعادة', 'داخل حصة': r.sid ? 'نعم' : 'لا', 'سجّله': nm(r.by), 'ملاحظة': r.note || '' }))]);
    const ses = L('sessions').filter(x => hids.has(x.halqaId) && x.date <= today()).sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));
    const att = []; ses.filter(x => !x.cancelled).forEach(x => studentsOf(x.halqaId).concat(Object.keys(x.att || {}).map(id => ({ ...S.users[id], id })).filter(y => y.name && y.halqaId !== x.halqaId)).forEach(st => { const v = (x.att || {})[st.id]; const arr = (x.arr || {})[st.id]; const lf = (x.left || {})[st.id];
      att.push({ 'التاريخ': x.date, 'اليوم': DAYN[new Date(x.date + 'T00:00').getDay()], 'الحلقة': hn(x.halqaId), 'الطالب': st.name, 'الحالة': v ? ATT[v] : 'ما تحضّر', 'وقت الوصول': arr ? clock(arr) : '', 'تأخر (دقيقة)': v === 'l' ? minsLate(x, st.id) || '' : '', 'انصرف': lf ? clock(lf.at) + (lf.reason ? ' — ' + lf.reason : '') : '' }); }));
    sheets.push(['الحضور', att]);
    sheets.push(['الحصص', ses.map(x => { const st = studentsOf(x.halqaId); const a = x.att || {}; return { 'التاريخ': x.date, 'الحلقة': hn(x.halqaId), 'الوقت': fmtTime(x.time), 'النوع': MODE_L[lessonMode(x)] || '', 'الحالة': x.cancelled ? 'ملغاة' : x.closedAt ? 'انتهت' : '', 'المعلم': nm(x.subId || (S.halaqat[x.halqaId] || {}).teacherId), 'وصول المعلم': x.teacherAt ? clock(x.teacherAt) : '', 'حاضر': st.filter(y => a[y.id] === 'p' || a[y.id] === 'l').length, 'غائب': st.filter(y => a[y.id] === 'a').length, 'سمّعوا': new Set(L('recs').filter(r => r.sid === x.id).map(r => r.uid)).size, 'ملاحظة': x.note || '' }; })]);
    const ptx = L('ptx').filter(x => sids.has(x.uid)).sort((a, b) => (b.at || 0) - (a.at || 0));
    sheets.push(['حركات النقاط', ptx.map(x => ({ 'التاريخ': x.at ? isoDate(new Date(x.at)) : '', 'الطالب': nm(x.uid), 'النقاط': x.amount, 'النوع': ({ manual: 'يدوي', spend: 'شراء من المتجر', refund: 'استرجاع', auction: 'مزاد' })[x.kind] || x.kind, 'السبب': x.reason || '', 'بواسطة': x.byName || '' }))]);
    const ords = L('orders').filter(o => sids.has(o.uid));
    if (ords.length) sheets.push(['طلبات المتجر', ords.map(o => ({ 'التاريخ': o.at ? isoDate(new Date(o.at)) : '', 'الطالب': nm(o.uid), 'الجائزة': (S.rewards[o.rid] || {}).name || '', 'السعر': o.price, 'الحالة': ({ pending: 'بانتظار التسليم', delivered: 'تسلّمها', rejected: 'مرفوض', cancelled: 'ملغي' })[o.status] || o.status }))]);
    sheets.push(['الحلقات', hs.map(h => ({ 'الحلقة': h.name, 'المعلم': nm(h.teacherId), 'الأيام': halqaDays(h.id).map(d => DAYN[d]).join('، '), 'الوقت': fmtTime(h.time), 'النوع': MODE_L[h.mode || 'onsite'], 'المجمع': h.branch || '', 'المكان': h.place || '', 'الطلاب': studentsOf(h.id).length }))]);
    if (u.role === 'admin') sheets.push(['المعلمون', L('users').filter(x => x.role === 'teacher').map(t => ({ 'الاسم': t.name, 'اسم الدخول': t.username, 'الحالة': ST_L[t.status] || t.status, 'الجوال': t.phone || '', 'الحلقات': hs.filter(h => h.teacherId === t.id).map(h => h.name).join('، '), 'وصل اليوم': ((S.tins || {})[t.id] || {}).at ? clock(S.tins[t.id].at) : '', 'انصرف اليوم': ((S.tins || {})[t.id] || {}).out ? clock(S.tins[t.id].out) : '' }))]);
    const wb = X.utils.book_new(); wb.Workbook = { Views: [{ RTL: true }] };
    for (const [name, rows] of sheets) { const ws = X.utils.json_to_sheet(rows.length ? rows : [{ 'ما فيه بيانات': '' }]); const keys = Object.keys(rows[0] || { x: 1 }); ws['!cols'] = keys.map(k => ({ wch: Math.min(40, Math.max(k.length + 2, ...rows.slice(0, 200).map(r => String(r[k] ?? '').length + 1))) })); X.utils.book_append_sheet(wb, ws, name); }
    X.writeFile(wb, `${(SET().center || 'ارتق').replace(/[\\/:*?"<>|]/g, '')}${inGirls() && S.isSuper ? ' - البنات' : ''} ${today()}.xlsx`);
    toast('نزل الملف ✓');
  } catch (e) { toast(e.message || 'ما قدرنا نجهّز الملف'); }
  finally { if (el) { el.disabled = false; el.textContent = old; } }
}
Object.assign(ACT, { 'cards': () => cardsModal(), 'xlsx': el => exportExcel(el) });

/* ---------------- theme ---------------- */
let THEME = ''; try { THEME = localStorage.getItem('irtaq-theme') || ''; } catch {}
function isDarkNow() { if (THEME) return THEME === 'dark'; try { return matchMedia('(prefers-color-scheme: dark)').matches; } catch { return false; } }
function applyTheme() { if (THEME) document.documentElement.setAttribute('data-theme', THEME); else document.documentElement.removeAttribute('data-theme'); try { localStorage.setItem('irtaq-theme', THEME); } catch {} }
applyTheme();
/* ---------------- PWA: تثبيت، بدون إنترنت، إشعارات ---------------- */
let INSTALL_EVT = null, PUSH_ON = false, SW_REG = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); INSTALL_EVT = e; scheduleRender(); });
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(async reg => { SW_REG = reg; try { const sub = reg.pushManager && await reg.pushManager.getSubscription(); PUSH_ON = !!sub; scheduleRender(); } catch {} }).catch(() => {});
}
const b64u = s => { const p = '='.repeat((4 - s.length % 4) % 4); const raw = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...raw].map(c => c.charCodeAt(0))); };
async function enablePush() {
  try {
    if (!SW_REG) return toast('المتصفح ما يدعم الإشعارات. في الآيفون ثبّت الموقع على الشاشة الرئيسية أول.');
    if (PUSH_ON) { const sub = await SW_REG.pushManager.getSubscription(); if (sub) { await api('/api/push', { off: true, endpoint: sub.endpoint }); await sub.unsubscribe(); } PUSH_ON = false; render(); return toast('أُوقفت الإشعارات على هذا الجهاز'); }
    const perm = await Notification.requestPermission(); if (perm !== 'granted') return toast('ما تم السماح بالإشعارات من المتصفح');
    const { key } = await api('/api/push'); if (!key) return toast('الإشعارات غير مفعّلة في الموقع بعد');
    const sub = await SW_REG.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(key) });
    await api('/api/push', { sub: sub.toJSON(), test: true }); PUSH_ON = true; render(); toast('تم تفعيل الإشعارات');
  } catch (e) { toast('تعذّر تفعيل الإشعارات: ' + (e.message || '')); }
}
/* ---------------- boot ---------------- */
load();
loadPages();
function liveNow() {
  const u = me(); if (!u) return false; const t = today();
  if (ST.view === 'session' || ST.fs) { const s = S.sessions[ST.sid]; if (s && s.date === t) return true; }
  if (u.role === 'student') return L('sessions').some(s => s.halqaId === u.halqaId && s.date === t && !s.cancelled && Math.abs(lessonTs(s) - Date.now()) < 3 * 3600000);
  return false;
}
// توفير تشغيل قاعدة البيانات: إذا الجهاز ما انلمس 10 دقايق وما فيه حصة شغالة، يوقف التحديث التلقائي لين يرجع أحد يستخدمه
let LAST_ACT = Date.now(), LAST_LOAD = Date.now(); const IDLE_MS = 10 * 60000;
['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev => document.addEventListener(ev, () => { const was = Date.now() - LAST_ACT > IDLE_MS; LAST_ACT = Date.now(); if (was && ST.meId && Date.now() - LAST_LOAD > 30000) load(); }, { passive: true, capture: true }));
const idleNow = () => Date.now() - LAST_ACT > IDLE_MS && !window.__inRoom && !ST.fs && !liveNow();
async function pollLoop() {
  if (document.visibilityState === 'visible' && ST.meId && !DRAG.on && !idleNow() && ($('#modal').hidden || (ST.rec && ST.rec.where === 'modal'))) { if (!(ST.rec && ST.rec.where === 'modal')) { await load(); LAST_LOAD = Date.now(); } }
  setTimeout(pollLoop, window.__inRoom && ROOM.mode === 'full' ? 12000 : liveNow() ? 8000 : 30000);
}
setTimeout(pollLoop, 8000);
setInterval(() => {
  document.querySelectorAll('[data-cd]').forEach(el => { el.textContent = el.dataset.en ? cdTextEn(+el.dataset.cd) : cdText(+el.dataset.cd); });
  if (ST.rec && ST.rec.run) {
    const sec = recSecs(); const lim = (+SET().recMin || 0) * 60; const over = lim && sec >= lim;
    document.querySelectorAll('[data-timer]').forEach(el => { el.textContent = fmtDur(sec); const b = el.closest('.r1-timer, .timer-w') || el; b.classList.toggle('over', !!over); });
    if (over && !ST.rec.warned) { ST.rec.warned = 1; buzz([200, 100, 200]); toast('انتهى وقت الطالب (' + SET().recMin + ' د)'); }
  }
}, 1000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && ST.meId) load(); });
})();
