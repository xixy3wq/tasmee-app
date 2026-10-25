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
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, Math.max(3500, String(msg).length * 75)); }

/* ---------------- server ---------------- */
const COLS = ['users', 'halaqat', 'sessions', 'recs', 'joins', 'settings', 'anns', 'wirds', 'msgs'];
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
      const r0 = await fetch('/api/data', { cache: 'no-store' });
      if (!r0.ok && r0.status !== 200) throw new Error('net');
      const d = await r0.json();
      // نسخة جديدة من الموقع انرفعت: حدّث الصفحة مرة وحدة تلقائيًا
      if (d.appV && MY_V && d.appV !== MY_V) { let done = ''; try { done = sessionStorage.getItem('irtaq-upd') || ''; } catch {} if (done !== d.appV) { try { sessionStorage.setItem('irtaq-upd', d.appV); } catch {} location.reload(); return; } }
      OFFLINE = r0.headers.get('x-irtaq-cache') === '1';
      ST.meId = d.me || null;
      if (d.me) COLS.forEach(c => S[c] = d[c] || {}); else COLS.forEach(c => S[c] = {});
      S.board = d.board || null; S.backups = d.backups || []; S.push = !!d.push; S.waOn = !!d.waOn;
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
const DEF = { center: 'حلقات ارتق', days: [0, 1, 2, 3, 4], grade: { ex: 0, vg: 2, gd: 4, alertsPer: 3 }, fields: [], tpl: { absent: '', excellent: '' } };
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
  let memPages = 0; for (let i = ms; i < np; i++) memPages += W[ord[i]];
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
const myHalaqat = u => L('halaqat').filter(h => u.role === 'admin' || h.teacherId === u.id || h.sub).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
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

const effLink = s => (s && (s.link || (S.halaqat[s.halqaId] || {}).link)) || '';
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
  L('recs').forEach(r => { if (r.uid !== st.id || r.date < from || r.date > to) return; n += r.grade === 'ممتاز' ? +P.ex || 0 : r.grade === 'جيد جدًا' ? +P.vg || 0 : r.grade === 'جيد' ? +P.gd || 0 : 0; if (r.type === 'new' && r.pass) n += recPages(r) * (+P.page || 0); });
  return Math.round(n);
}
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
function wirdBrief(uid) {
  const w = wirdOf(uid, today()); if (!w) return '';
  const done = (w.items || []).filter(x => x.done).length; const all = (w.items || []).length;
  return `<span class="chip ok">في البيت: ${done}/${all}${w.read ? ' · تلاوة ' + w.read + ' وجه' : ''}</span>`;
}
const annTargets = a => L('users').filter(x => x.role === 'student' && x.status === 'active' && (!a.halqaId || x.halqaId === a.halqaId));
const allTpls = () => { const st = SET(); return [{ id: 'absent', name: 'غياب', text: st.tpl.absent }, { id: 'excellent', name: 'تميّز', text: st.tpl.excellent }, ...(st.tpls || [])].filter(t => t.text); };

/* ---------------- render loop ---------------- */
let rq = 0;
function scheduleRender() { if (rq) return; rq = requestAnimationFrame(() => { rq = 0; render(); }); }
function render() {
  const app = $('#app'); const saved = {};
  app.querySelectorAll('[data-dirty][id]').forEach(el => { if (el.id.startsWith('rk-')) return; saved[el.id] = (el.type === 'checkbox' || el.type === 'radio') ? { c: el.checked } : { v: el.value }; });
  const a = document.activeElement; const fid = app.contains(a) ? a.id : null; let sel = null;
  try { if (fid && a.selectionStart != null) sel = [a.selectionStart, a.selectionEnd]; } catch {}
  const sy = window.scrollY;
  app.innerHTML = view(); applyZoom();
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
const banner = () => OFFLINE ? `<div class="banner">ما فيه اتصال، تعرض آخر نسخة محفوظة. التعديلات تحتاج إنترنت.</div>` : '';
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
    <label class="fld"><span>اسم المستخدم</span><input id="lg-user" name="username" dir="ltr" autocomplete="username" autocapitalize="none" required></label>
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
    ${tip('احفظ اسم المستخدم وكلمة المرور عندك. بعد الإرسال نعطيك زر تنسخها فيه أو ترسلها لنفسك بالواتساب.')}
    <div class="fgrid">${info.fields.filter(f => f.type !== 'memo').map(f => fieldHtml(f, '', 'rg-')).join('')}</div>
    ${info.fields.filter(f => f.type === 'memo').map(f => fieldHtml(f, '', 'rg-')).join('')}
    ${!fixedH && hs.length ? `<label class="fld"><span>الحلقة المطلوبة</span><select id="rg-halqa" name="reqHalqa"><option value="">تحددها الإدارة</option>${hs.map(h => `<option value="${h.id}">${esc(h.name)}</option>`).join('')}</select></label>` : ''}
    <button class="btn pri big" type="submit">إرسال الطلب</button>
    <div class="small muted">بعد الإرسال تراجع الإدارة طلبك وتعتمده، وبعدها تدخل باسم المستخدم وكلمة المرور.</div>
  </form>
  <button class="btn ghost" data-act="from-reg">رجوع لتسجيل الدخول</button></div>`;
}
let regLoading = false;
async function loadRegInfo() {
  if (regLoading) return; regLoading = true;
  try { ST.regInfo = await api('/api/register'); } catch (e) { ST.regInfo = { center: 'حلقات ارتق', fields: [], halaqat: [] }; toast(e.message); }
  regLoading = false; scheduleRender();
}
function regDoneV() {
  const c = ST.regCred || {}; const msg = `بيانات دخول ${c.name || ''} في ${(ST.regInfo || {}).center || 'الحلقة'}:\nالرابط: ${location.origin}\nاسم المستخدم: ${c.user || ''}\nكلمة المرور: ${c.pw || ''}`;
  return `<div class="center-box"><ol class="stepper"><li class="done"><b>1</b><span>عبّ البيانات</span></li><li class="on"><b>2</b><span>اعتماد الإدارة</span></li><li><b>3</b><span>ادخل للموقع</span></li></ol>
  <div class="hero-mark">${MARK}<h1>وصل طلبك</h1></div>
  <div class="card" style="display:grid;gap:10px"><div>طلبك الآن عند الإدارة. بعد الاعتماد تدخل بهذي البيانات:</div>
    <dl class="kv"><dt>اسم المستخدم</dt><dd dir="ltr" style="text-align:right"><b>${esc(c.user || '')}</b></dd><dt>كلمة المرور</dt><dd dir="ltr" style="text-align:right"><b>${esc(c.pw || '')}</b></dd></dl>
    <div class="row"><button class="btn" data-act="copy" data-text="${esc(msg)}">نسخ البيانات</button><a class="btn wa" href="https://wa.me/?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">أرسلها لنفسك بالواتساب</a></div>
    ${tip('ما يوصلك إشعار بالاعتماد، جرّب تدخل بعد ساعات. وإذا طال الانتظار تواصل مع الإدارة.')}${supportBtn()}</div>
  <button class="btn" data-act="from-reg">صفحة الدخول</button></div>`;
}

const TABS = {
  admin: u => [['dash', 'الرئيسية'], ['req', 'الطلبات', L('users').filter(x => x.role === 'student' && x.status === 'pending').length], ['sessions', 'الحصص'], ['students', 'الطلاب'], ['teachers', 'المعلمون'], ['halaqat', 'الحلقات'], ['anns', 'الإعلانات'], ['room', 'غرفة المعلمين', msgsUnread(u)], ['reports', 'التقارير'], ['logs', 'السجل'], ['settings', 'الإعدادات'], ['help', 'الدليل']].filter(([k]) => !TAB_PERM[k] || can(u, TAB_PERM[k])),
  teacher: u => [['sessions', 'الحصص'], ['students', 'طلابي'], ['anns', 'الإعلانات'], ['room', 'غرفة المعلمين', msgsUnread(u)], ['reports', 'التقارير'], ['help', 'الدليل']],
  student: () => [['home', LANG === 'en' ? 'My page' : 'صفحتي'], ['help', LANG === 'en' ? 'Help' : 'الدليل']]
};
const ROLE = { admin: 'المدير', teacher: 'معلم', student: 'طالب' };
const PARENT_TAB = { session: 'sessions', student: 'students' };
function shellV(u) {
  const tabs = TABS[u.role](u);
  const keys = tabs.map(t => t[0]);
  if (!ST.view || (!keys.includes(ST.view) && !PARENT_TAB[ST.view]) || (u.role === 'student' && !['home', 'help'].includes(ST.view))) ST.view = keys[0];
  const activeTab = PARENT_TAB[ST.view] || ST.view;
  const body = ({ req: reqV, sessions: sessionsV, session: sessionV, students: studentsV, student: profileV, teachers: teachersV, halaqat: halaqatV, reports: reportsV, settings: settingsV, home: LANG === 'en' ? homeEn : homeV, anns: annsV, dash: dashV, room: roomV, logs: logsV, help: helpV })[ST.view](u);
  document.getElementById('root').style.direction = u.role === 'student' && LANG === 'en' ? 'ltr' : 'rtl';
  if (u.role === 'student' && LANG !== 'en' && !ST.tourShown && !tourSeen(u)) { ST.tourShown = true; setTimeout(() => { if ($('#modal').hidden) showTour(0); }, 600); }
  return `${banner()}<header class="top"><div class="top-in">
    <div class="brand-row"><div class="brand">${MARK}<span>${esc(SET().center)}</span></div>
      <div class="who"><span class="small">${esc(u.name)}</span><span class="chip acc">${ROLE[u.role]}</span>${u.role !== 'student' ? '<button class="btn ghost sm" data-act="search">بحث</button>' : `<button class="btn ghost sm" data-act="kids">${accounts().length > 1 ? 'الأبناء (' + accounts().length + ')' : 'إضافة ابن'}</button><button class="btn ghost sm" data-act="zoom" aria-label="تكبير الخط">أ${ZOOM > 1 ? '−' : '+'}</button><button class="btn ghost sm" data-act="lang">${LANG === 'en' ? 'عربي' : 'English'}</button>`}${S.push && 'PushManager' in window ? `<button class="btn ghost sm" data-act="push">${PUSH_ON ? 'الإشعارات مفعّلة' : 'الإشعارات'}</button>` : ''}${INSTALL_EVT ? '<button class="btn ghost sm" data-act="install">تثبيت</button>' : ''}<button class="btn ghost sm theme-btn" data-act="theme" aria-label="تبديل المظهر">${isDarkNow() ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5" fill="currentColor"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> فاتح' : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" fill="currentColor"/></svg> داكن'}</button><button class="btn ghost sm" data-act="my-pw">كلمة المرور</button><button class="btn ghost sm" data-act="logout">خروج</button></div></div>
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
  ${list.map(({ x, n }) => { const wa = x.parentPhone && waLink(x.parentPhone, fillTpl(tp.absent, { student: x.name, halqa: halqaName(x.halqaId), date: 'آخر ' + n + ' حصص' })); return `<div class="item"><div class="grow click" data-act="open-student" data-id="${x.id}"><div class="name">${esc(x.name)}</div><div class="small muted">${esc(halqaName(x.halqaId))}</div></div><span class="chip bad">غاب ${n} متتالية</span>${wa ? `<a class="btn wa sm" href="${wa}" target="_blank" rel="noopener">واتساب ولي الأمر</a>` : ''}</div>`; }).join('')}
  </div></section>`;
}
function sessionsV(u) {
  const hs = myHalaqat(u);
  if (!hs.length) return `<h1>الحصص</h1><div class="empty"><b>${u.role === 'admin' ? 'ما فيه حلقات بعد' : 'ما عندك حلقة مسندة'}</b><span>${u.role === 'admin' ? 'ابدأ بإنشاء حلقة من تبويب الحلقات.' : 'تواصل مع المدير ليسند لك حلقة.'}</span></div>`;
  if (ST.halqa && !hs.some(h => h.id === ST.halqa)) ST.halqa = '';
  const ids = ST.halqa ? [ST.halqa] : hs.map(h => h.id);
  const all = L('sessions').filter(s => ids.includes(s.halqaId));
  const t = today();
  const up = all.filter(s => s.date >= t).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const past = all.filter(s => s.date < t).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)).slice(0, 25);
  const row = s => { const n = studentsOf(s.halqaId).length; const att = s.att || {}; const pres = Object.values(att).filter(v => v === 'p' || v === 'l').length; const recs = L('recs').filter(r => r.sid === s.id).length; const iss = Object.keys(s.issues || {}).length;
    return `<div class="item click ${s.cancelled ? 'dim' : ''}" data-act="open-session" data-id="${s.id}"><div class="grow"><div class="name">${fmtDateH(s.date)} <span class="muted small">${fmtTime(s.time)}</span></div><div class="small muted">${esc(halqaName(s.halqaId))}${s.note ? ' · ' + esc(s.note) : ''}</div></div>
      ${s.cancelled ? '<span class="chip">ملغاة</span>' : `${s.subId ? `<span class="chip info">احتياط: ${esc(subName(s.subId) || 'أنت')}</span>` : ''}${s.date === t ? '<span class="chip gold">اليوم</span>' : ''}${iss ? `<span class="chip bad">مشكلة دخول ${iss}</span>` : ''}${effLink(s) ? '' : '<span class="chip warn">بدون رابط</span>'}<span class="chip num">حضور ${pres}/${n}</span><span class="chip num">تسميع ${recs}</span>`}</div>`; };
  return `<div class="sec-head"><h1>الحصص</h1><div class="row"><button class="btn" data-act="cal">${ST.cal ? 'عرض القائمة' : 'عرض التقويم'}</button><button class="btn pri" data-act="new-session">حصة إضافية</button></div></div>
  ${hs.length > 1 ? `<div class="row">${['', ...hs.map(h => h.id)].map(id => `<button class="btn sm ${ST.halqa === id ? 'pri' : ''}" data-act="filter-h" data-h="${id}">${id ? esc(halqaName(id)) : 'كل الحلقات'}</button>`).join('')}</div>` : ''}
  ${absentAlertsHtml(ids)}
  ${ST.cal ? calendarHtml(ids) : `<section class="card"><div class="sec-head"><h2>اليوم والقادمة</h2></div>
  ${up.length ? `<div class="list">${up.map(row).join('')}</div>` : `<div class="empty"><span>ما فيه حصص قادمة. فعّل «الجدول الثابت» من إعدادات الحلقة وتنشأ الحصص لحالها، أو أضف حصة إضافية.</span></div>`}</section>
  ${past.length ? `<section class="card"><h2>السابقة</h2><div class="list">${past.map(row).join('')}</div></section>` : ''}`}`;
}
function joinText(j, s) {
  if (!j) return 'لم يضغط دخول';
  let t = 'دخل ' + clock(j.at);
  if (j.left) t += ' · خرج ' + clock(j.left) + ' (' + Math.max(1, Math.round((j.left - j.at) / 60000)) + ' د)';
  else if (s.date === today()) t += ' · داخل الآن';
  return t;
}
function planBrief(st) {
  const items = planItems(st);
  if (!items.length) return '<span class="muted">ما حُدّد</span>';
  return items.map(x => `<span class="por">${x.retry ? '<span class="chip bad">إعادة</span> ' : ''}<span class="muted small">${TYPE[x.type]}:</span> ${esc(SN[x.surah - 1])} <b>﴿${x.from === x.to ? x.from : x.from + '–' + x.to}﴾</b></span>`).join('<br>');
}
function sessionV(u) {
  const s = S.sessions[ST.sid] && { ...S.sessions[ST.sid], id: ST.sid };
  if (!s) return `<button class="back" data-act="tab" data-v="sessions">→ الحصص</button><div class="empty">هذه الحصة غير موجودة.</div>`;
  const studs = studentsOf(s.halqaId); const att = s.att || {}; const queue = (s.queue || []).filter(id => S.users[id]);
  const joins = {}; L('joins').filter(j => j.sid === s.id).forEach(j => joins[j.uid] = j);
  const recs = L('recs').filter(r => r.sid === s.id).sort((a, b) => (b.at || 0) - (a.at || 0));
  const hname = halqaName(s.halqaId); const tp = SET().tpl; const link = effLink(s); const lim = absentLimit();
  const vars = st => ({ student: st.name, halqa: hname, date: fmtDate(s.date) });
  const cur = s.current && S.users[s.current] ? { ...S.users[s.current], id: s.current } : null;
  const notQueued = studs.filter(x => !queue.includes(x.id) && x.id !== s.current);
  const dd = new Date(s.date + 'T00:00');
  const head = `<button class="back" data-act="tab" data-v="sessions">→ الحصص</button>
  <div class="session-hero"><div class="datebox"><b>${dd.getDate()}</b><span>${DAYN[dd.getDay()]}</span></div>
    <div style="flex:1 1 220px;min-width:0"><h1>${esc(hname)}</h1><div class="muted">${fmtDateH(s.date)} · ${fmtTime(s.time)}${s.note ? ' · ' + esc(s.note) : ''}${s.auto ? ' · من الجدول الثابت' : ''}</div><div class="row" style="margin-top:4px">${s.subId ? `<span class="chip info">معلم احتياط: ${esc(subName(s.subId) || 'أنت')}</span>` : ''}${s.teacherAt ? `<span class="chip ok">المعلم فتح الحصة ${clock(s.teacherAt)}</span>` : ''}</div></div>
    <div class="row">${link && !s.cancelled ? `<a class="btn pri" href="${esc(link)}" target="_blank" rel="noopener">افتح الحصة</a><button class="btn" data-act="copy" data-text="${esc(link)}">نسخ الرابط</button>` : (s.cancelled ? '' : `<span class="chip warn">ما فيه رابط</span>`)}<button class="btn" data-act="edit-session" data-id="${s.id}">تعديل</button></div></div>`;
  if (u.role === 'teacher' && s.date === today() && !s.teacherAt && !(ST.opened || {})[s.id]) { ST.opened = { ...(ST.opened || {}), [s.id]: 1 }; act('lesson.open', { id: s.id }); }
  if (s.cancelled) return head + `<div class="note">هذه الحصة ملغاة${s.note ? ': ' + esc(s.note) : ''}. ما تنحسب في الحضور ولا تظهر للطلاب كحصة قادمة.</div><div><button class="btn" data-act="lesson-restore" data-id="${s.id}">استرجاع الحصة</button></div>`;
  const issues = Object.entries(s.issues || {}).filter(([id]) => S.users[id]);
  const attRow = st => { const v = att[st.id]; const wA = st.parentPhone && waLink(st.parentPhone, fillTpl(tp.absent, vars(st))); const wE = st.parentPhone && waLink(st.parentPhone, fillTpl(tp.excellent, vars(st))); const streak = absentStreak(st);
    return `<div class="item"><div class="grow"><div class="name">${esc(st.name)}${streak >= lim ? ` <span class="chip bad">غاب ${streak} متتالية</span>` : ''}</div><div class="small muted">${joinText(joins[st.id], s)}</div></div>
    <div class="seg">${Object.keys(ATT).map(k => `<button class="${k} ${v === k ? 'on' : ''}" data-act="att" data-id="${st.id}" data-v="${k}">${ATT[k]}</button>`).join('')}</div>
    ${v === 'a' && wA ? `<a class="btn wa sm" href="${wA}" target="_blank" rel="noopener">واتساب غياب</a>` : ''}${(v === 'p' || v === 'l') && wE ? `<a class="btn wa sm" href="${wE}" target="_blank" rel="noopener">واتساب تميّز</a>` : ''}</div>`; };
  const recHere = ST.rec && ST.rec.sid === s.id && ST.rec.where === 'inline';
  const presentFirst = [...studs].sort((a, b) => ((att[b.id] === 'p' || att[b.id] === 'l') - (att[a.id] === 'p' || att[a.id] === 'l')));
  return head + `
  ${issues.length ? `<div class="note bad-note"><b>مشاكل دخول:</b><div class="list">${issues.map(([id, x]) => `<div class="item"><div class="grow"><b>${esc(S.users[id].name)}</b>: ${esc(x.msg)} <span class="small muted">${clock(x.at)}</span></div><button class="btn sm" data-act="issue-clear" data-id="${id}">تم الحل</button></div>`).join('')}</div></div>` : ''}
  ${waSessionHtml(s)}
  <div class="grid2">
  <section class="card" style="display:grid;gap:12px"><div class="sec-head"><h2>طابور التسميع</h2><div class="row"><button class="btn ghost sm" data-act="q-sort" data-k="join">حسب الدخول</button><button class="btn ghost sm" data-act="q-sort" data-k="least">الأقل تسميعًا أولًا</button></div></div>
    ${recHere ? recPanelHtml() : (cur ? `<div class="now"><div style="flex:1 1 160px;min-width:0"><div class="lbl">يسمّع الآن</div><div class="name">${esc(cur.name)}</div></div><button class="btn pri" data-act="rec-start" data-id="${cur.id}">سجّل التسميع</button><button class="btn" data-act="q-next">التالي</button></div>` : (queue.length ? `<button class="btn pri" data-act="q-next">ابدأ بأول الطابور</button>` : ''))}
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
  let list = L('users').filter(x => x.role === 'student' && x.status !== 'pending' && (u.role === 'admin' || hids.includes(x.halqaId)));
  const nArch = list.filter(x => x.status === 'archived').length;
  list = list.filter(x => ST.arch ? x.status === 'archived' : x.status !== 'archived');
  if (ST.halqa) list = list.filter(x => x.halqaId === ST.halqa);
  const q = (ST.q || '').trim(); if (q) list = list.filter(x => (x.name || '').includes(q) || (x.username || '').toLowerCase().includes(q.toLowerCase()));
  list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
  return `<div class="sec-head"><h1>${u.role === 'admin' ? 'الطلاب' : 'طلابي'}</h1><div class="row">${canPlan(u) && canAutoU(u) ? '<button class="btn" data-act="tpl-apply">تطبيق قالب خطة</button>' : ''}${u.role === 'admin' ? '<button class="btn pri" data-act="add-student">إضافة طالب</button>' : ''}</div></div>
  ${nArch ? `<div class="row"><button class="btn sm ${ST.arch ? '' : 'pri'}" data-act="arch" data-v="0">الحاليون</button><button class="btn sm ${ST.arch ? 'pri' : ''}" data-act="arch" data-v="1">المؤرشفون (${nArch})</button></div>` : ''}
  <div class="row"><input id="st-q" placeholder="ابحث بالاسم أو اسم المستخدم" value="${esc(ST.q)}" data-input="search" style="flex:1 1 220px">
  ${hs.length > 1 ? `<select id="st-h" data-change="filter-h" style="flex:0 1 200px"><option value="">كل الحلقات</option>${hs.map(h => `<option value="${h.id}" ${ST.halqa === h.id ? 'selected' : ''}>${esc(h.name)}</option>`).join('')}</select>` : ''}</div>
  <section class="card">${list.length ? `<div class="list">${list.map(x => { const a = attStats(x, 30); const n = absentStreak(x); return `<div class="item click" data-act="open-student" data-id="${x.id}"><div class="grow"><div class="name">${esc(x.name)}</div><div class="small muted">${esc(halqaName(x.halqaId))} · <span dir="ltr">${esc(x.username)}</span></div></div>
    ${x.status === 'disabled' ? '<span class="chip bad">موقوف</span>' : ''}${n >= lim ? `<span class="chip bad">غاب ${n} متتالية</span>` : ''}<span class="chip ${isAuto(x) ? 'acc' : ''}">${isAuto(x) ? 'خطة تلقائية' : 'خطة يدوية'}</span><span class="chip num">حضور ${a.rate == null ? '—' : a.rate + '٪'}</span></div>`; }).join('')}</div>` : `<div class="empty">${q ? 'ما فيه نتائج.' : 'ما فيه طلاب معتمدون بعد.'}</div>`}</section>`;
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
    <div class="row"><button class="btn pri" data-act="rec-out" data-id="${st.id}">تسجيل تسميع</button>${st.parentPhone ? `<button class="btn wa" data-act="tpl-pick" data-id="${st.id}">واتساب ولي الأمر</button>` : ''}${u.role === 'admin' ? `<button class="btn" data-act="edit-student" data-id="${st.id}">تعديل البيانات</button><button class="btn" data-act="reset-pw" data-id="${st.id}">كلمة مرور جديدة</button>` : ''}</div></div>
  <div class="row">${[7, 30, 90, 0].map(d => `<button class="btn sm ${ST.range === d ? 'pri' : ''}" data-act="range" data-d="${d}">${d ? 'آخر ' + d + ' يوم' : 'الكل'}</button>`).join('')}</div>
  <div class="stats"><div class="stat"><b>${a.rate == null ? '—' : a.rate + '٪'}</b><span>نسبة الحضور</span></div><div class="stat"><b>${a.a}</b><span>غياب</span></div><div class="stat"><b>${inRange.length}</b><span>تسميع</span></div><div class="stat"><b>${fmtPages(pg.new)}</b><span>أوجه حفظ</span></div><div class="stat"><b>${fmtPages(pg.review + pg.tath)}</b><span>أوجه مراجعة وتثبيت</span></div><div class="stat"><b>${avg}</b><span>متوسط الأخطاء</span></div></div>
  <div class="grid2">
  <section class="card" style="display:grid;gap:12px"><div class="sec-head"><h2>الخطة</h2><div class="row">${canPlan(u) ? `<button class="btn sm" data-act="edit-plan" data-id="${st.id}">تعديل الخطة</button><button class="btn sm" data-act="edit-goal" data-id="${st.id}">${st.goal ? 'تعديل الهدف' : 'هدف'}</button>` : ''}<button class="btn ghost sm" data-act="plan-log" data-id="${st.id}">سجل الخطة</button></div></div>
    ${planHtml(st)}${goalHtml(st)}
</section>
  <section class="card" style="display:grid;gap:12px"><h2>نقاط وأوسمة</h2><div class="stats"><div class="stat"><b>${ptsOf(st, weekStartC(today()), today())}</b><span>نقاط هالأسبوع</span></div><div class="stat"><b>${attendStreak(st)}</b><span>حصص متتالية</span></div></div>${(b => b.length ? `<div class="badges">${b.map(x => `<span class="badge"><b>${esc(x.t)}</b><span>${esc(x.d)}</span></span>`).join('')}</div>` : '')(badgesOf(st))}
    <div class="small muted" style="font-weight:600">الورد في البيت، آخر 7 أيام</div><div class="wgrid">${[...Array(7).keys()].reverse().map(i => { const d = addDays(today(), -i); const w = wirdOf(st.id, d); const n = w ? (w.items || []).filter(x => x.done).length : 0; return `<div class="wday ${w ? 'on' : ''}" title="${fmtDate(d)}"><span>${['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'][new Date(d + 'T00:00').getDay()]} ${new Date(d + 'T00:00').getDate()}</span><b>${w ? n + '/' + (w.items || []).length : '—'}</b>${w && w.read ? `<span>${w.read} و</span>` : ''}</div>`; }).join('')}</div></section>
  <section class="card"><h2>البيانات</h2><dl class="kv">${fields.filter(f => st[f.k]).map(f => `<dt>${esc(f.label)}</dt><dd ${f.type === 'tel' ? 'dir="ltr" style="text-align:right"' : ''}>${fmtField(f, st[f.k])}</dd>`).join('') || '<dt>—</dt><dd></dd>'}</dl></section></div>
  <section class="card"><h2>سجل التسميع</h2>${historyTable(inRange, true)}</section>`;
}
function historyTable(rs, editable, noDate) {
  if (!rs.length) return '<div class="empty small">ما فيه تسميع في هذه الفترة.</div>';
  return `<div class="tbl-wrap"><table><thead><tr>${noDate ? '<th>الطالب</th>' : '<th>التاريخ</th>'}<th>النوع</th><th>المقطع</th><th class="num">أوجه</th><th class="num">أخطاء</th><th class="num">تنبيهات</th><th>التقدير</th><th class="num">المدة</th><th>ملاحظة</th>${editable ? '<th></th>' : ''}</tr></thead><tbody>
  ${rs.slice(0, 80).map(r => `<tr><td>${noDate ? esc((S.users[r.uid] || {}).name || '—') : fmtDate(r.date) + (r.sid ? '' : ' <span class="chip">خارج الحصة</span>')}</td><td>${TYPE[r.type] || ''}${r.full ? ' <span class="chip acc">سورة كاملة</span>' : ''}</td><td>${segText([{ s: r.surah - 1, a1: r.from, a2: r.to }])}</td><td class="num">${fmtPages(recPages(r))}</td><td class="num">${r.quick ? '—' : r.mistakes}</td><td class="num">${r.quick ? '—' : r.alerts}</td><td><span class="chip ${GRADE_K[r.grade] || ''}">${esc(r.grade)}</span></td><td class="num">${r.secs ? fmtDur(r.secs) : ''}</td><td style="white-space:normal;min-width:120px">${esc(r.note || '')}</td>${editable ? `<td><button class="btn ghost sm" data-act="edit-rec" data-id="${r.id}">تعديل</button><button class="btn ghost sm" data-act="del-rec" data-id="${r.id}">حذف</button></td>` : ''}</tr>`).join('')}</tbody></table></div>`;
}

/* ---- admin: teachers ---- */
function teachersV() {
  const ts = L('users').filter(u => u.role === 'teacher').sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
  const m = me(); const admins = L('users').filter(x => x.role === 'admin' && x.perms);
  return `<div class="sec-head"><h1>المعلمون</h1><button class="btn pri" data-act="add-teacher">إضافة معلم</button></div>
  ${isFullAdmin(m) ? `<section class="card" style="display:grid;gap:8px"><div class="sec-head"><h2>المشرفون الإداريون</h2><button class="btn sm" data-act="add-admin">إضافة مشرف إداري</button></div>${admins.length ? `<div class="list">${admins.map(a => `<div class="item"><div class="grow"><b>${esc(a.name)}</b><div class="small muted"><span dir="ltr">${esc(a.username)}</span> · ${(a.perms || []).map(p => PERM_LABEL[p]).join('، ')}</div></div>${a.status === 'disabled' ? '<span class="chip bad">موقوف</span>' : ''}<button class="btn sm" data-act="edit-admin" data-id="${a.id}">تعديل</button></div>`).join('')}</div>` : '<div class="small muted">مدراء مساعدين بصلاحيات محددة، مثل مشرف تعليمي أو مسؤول تسجيل.</div>'}</section>` : ''}
  <div class="note info">صلاحية <b>إعداد الخطط</b> تسمح للمعلم ينشئ ويعدّل خطط طلابه، يدوية أو تلقائية.</div>
  <section class="card">${ts.length ? `<div class="list">${ts.map(t => { const hs = L('halaqat').filter(h => h.teacherId === t.id); return `<div class="item"><div class="grow"><div class="name">${esc(t.name)}</div><div class="small muted"><span dir="ltr">${esc(t.username)}</span> · ${hs.length ? hs.map(h => esc(h.name)).join('، ') : 'بدون حلقة'}</div></div>
    ${t.status === 'disabled' ? '<span class="chip bad">موقوف</span>' : ''}
    <label class="check"><input type="checkbox" id="tc-plan-${t.id}" data-change="t-perm" data-k="canPlan" data-id="${t.id}" ${t.canPlan ? 'checked' : ''}> إعداد الخطط</label>
    <button class="btn sm" data-act="edit-teacher" data-id="${t.id}">تعديل</button></div>`; }).join('')}</div>` : '<div class="empty">ما فيه معلمون بعد. أضف معلمًا ثم أسند له حلقة.</div>'}</section>`;
}

/* ---- admin: halaqat ---- */
function halaqatV() {
  const hs = L('halaqat').sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
  return `<div class="sec-head"><h1>الحلقات</h1><div class="row">${can(me(), 'students') ? '<button class="btn" data-act="assign">توزيع الطلاب</button>' : ''}<button class="btn pri" data-act="add-halqa">حلقة جديدة</button></div></div>
  ${hs.length ? `<div class="grid2">${hs.map(h => { const t = h.teacherId && S.users[h.teacherId]; return `<section class="card" style="display:grid;gap:10px">
    <div class="sec-head"><h2>${esc(h.name)}</h2><button class="btn sm" data-act="edit-halqa" data-id="${h.id}">تعديل</button></div>
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
  return `<div class="sec-head"><h1>التقارير</h1><div class="row">${S.waOn ? `<button class="btn pri" data-act="wa-week-h" data-h="${hid}">أرسل التقرير الأسبوعي تلقائيًا</button>` : ''}<button class="btn wa" data-act="wa-week" data-h="${hid}">${S.waOn ? 'إرسال يدوي' : 'التقرير الأسبوعي لأولياء الأمور'}</button></div></div>
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
  ['msg', 'الرسائل والواتساب', 'نصوص الرسائل لأولياء الأمور وربط الواتس الذكي'],
  ['site', 'إعدادات الموقع', 'الاسم، جهة التواصل، النسخ الاحتياطي، Google Sheets'],
];
function settingsV() {
  const st = SET(); const hol = [...(st.holidays || [])].sort((a, b) => a.from.localeCompare(b.from));
  const full = isFullAdmin(me());
  const cur = SET_TABS.some(t => t[0] === ST.setTab) ? ST.setTab : 'rec';
  const P = k => k === cur ? '' : 'hidden';
  const H = (t, d) => `<div class="set-h"><h2>${t}</h2>${d ? `<span class="small muted">${d}</span>` : ''}</div>`;
  const saveBtn = `<div class="set-save"><button class="btn pri" type="submit">حفظ الإعدادات</button></div>`;
  return `<h1>الإعدادات</h1>
  <nav class="set-tabs" aria-label="أقسام الإعدادات">${SET_TABS.map(([k, t, d]) => `<button type="button" class="set-tab ${k === cur ? 'on' : ''}" data-act="set-tab" data-k="${k}" aria-pressed="${k === cur}"><b>${t}</b><span>${d}</span></button>`).join('')}</nav>
  <form class="card" data-form="settings" style="gap:18px">
    <div class="set-pane" ${P('rec')}>${H('التسميع والتقدير', 'كيف يُحسب التقدير، ومقادير الخطط الجاهزة، ونقاط الطلاب')}
    <div class="fld"><span>سلّم التقدير بعدد الأخطاء</span>
      <div class="fgrid"><label class="fld"><span>ممتاز إذا الأخطاء حتى</span><input id="sg-ex" name="ex" type="number" min="0" value="${st.grade.ex}"></label><label class="fld"><span>جيد جدًا حتى</span><input id="sg-vg" name="vg" type="number" min="0" value="${st.grade.vg}"></label><label class="fld"><span>جيد حتى</span><input id="sg-gd" name="gd" type="number" min="0" value="${st.grade.gd}"></label><label class="fld"><span>كل كم تنبيه = خطأ</span><input id="sg-al" name="alertsPer" type="number" min="1" value="${st.grade.alertsPer}"></label></div>
      <span class="small muted" style="font-weight:400">ما فوق «جيد» يكون «يعاد»، ولا تتقدم الخطة التلقائية إلا بعد النجاح.</span></div>
    <div class="fld"><span>قوالب الخطط التلقائية</span><div class="tbl-wrap"><table class="fields-tbl"><thead><tr><th>الاسم</th><th class="num">حفظ</th><th class="num">مراجعة</th><th class="num">تثبيت</th><th></th></tr></thead><tbody>
      ${(st.planTpls || []).map((t, i) => `<tr><td><input id="pt-n-${i}" name="ptn-${i}" value="${esc(t.name)}" style="min-width:160px"></td><td><input id="pt-a-${i}" name="pta-${i}" type="number" min="0" step="0.125" value="${t.newAmt}" style="width:80px"></td><td><input id="pt-r-${i}" name="ptr-${i}" type="number" min="0" step="0.5" value="${t.revAmt}" style="width:80px"></td><td><input id="pt-t-${i}" name="ptt-${i}" type="number" min="0" step="0.5" value="${t.tathAmt}" style="width:80px"></td><td><button type="button" class="btn ghost sm" data-act="ptpl-del" data-i="${i}">حذف</button></td></tr>`).join('')}
    </tbody></table></div><div><button type="button" class="btn sm" data-act="ptpl-add">إضافة قالب</button></div><span class="small muted" style="font-weight:400">المقادير بالأوجه: 0.25 ربع وجه، 0.5 نصف وجه.</span></div>
    <div class="fld"><span>النقاط التلقائية</span><div class="fgrid">${[['present', 'حضور'], ['late', 'تأخر'], ['ex', 'تسميع ممتاز'], ['vg', 'جيد جدًا'], ['gd', 'جيد'], ['page', 'لكل وجه حفظ']].map(([k, l]) => `<label class="fld"><span>${l}</span><input id="sg-pt-${k}" name="pt-${k}" type="number" min="0" max="100" step="0.5" value="${(st.points || {})[k] ?? 0}"></label>`).join('')}</div></div>
    <label class="fld" style="max-width:320px"><span>لوحة الشرف عند الطلاب</span><select id="sg-board" name="board"><option value="show" ${st.board === 'show' ? 'selected' : ''}>أفضل 5 مع ترتيب الطالب</option><option value="top3" ${st.board === 'top3' ? 'selected' : ''}>أفضل 3 فقط</option><option value="hide" ${st.board === 'hide' ? 'selected' : ''}>مخفية: كل طالب يشوف نقاطه بس</option></select></label>
    </div>
    <div class="set-pane" ${P('days')}>${H('الدوام والحضور', 'الأيام الافتراضية للحلقات وفترات الدراسة')}
    <div class="fld"><span>أيام الدوام الافتراضية</span><div class="days">${DAYN.map((d, i) => `<label><input type="checkbox" id="sg-day-${i}" name="day" value="${i}" ${st.days.includes(i) ? 'checked' : ''}> ${d}</label>`).join('')}</div><span class="small muted" style="font-weight:400">تقدر تغيّرها لكل حلقة من تبويب الحلقات.</span></div>
    <label class="fld" style="max-width:320px"><span>تنبيه الغياب المتكرر بعد كم غياب متتالي</span><input id="sg-abs" name="absentAlert" type="number" min="2" max="20" value="${st.absentAlert || 3}"></label>
    <div class="fld"><span>الفصول الدراسية</span><div class="tbl-wrap"><table class="fields-tbl"><thead><tr><th>الاسم</th><th>من</th><th>إلى</th><th></th></tr></thead><tbody>
      ${(st.terms || []).map((t, i) => `<tr><td><input id="tm-n-${i}" name="tmn-${i}" value="${esc(t.name)}" style="min-width:140px"></td><td><input id="tm-f-${i}" name="tmf-${i}" type="date" value="${t.from}"></td><td><input id="tm-t-${i}" name="tmt-${i}" type="date" value="${t.to}"></td><td><button type="button" class="btn ghost sm" data-act="term-del" data-i="${i}">حذف</button></td></tr>`).join('')}
    </tbody></table></div><div><button type="button" class="btn sm" data-act="term-add">إضافة فصل</button></div><span class="small muted" style="font-weight:400">تطلع الفصول كفترات في التقارير، وفي تحديد أهداف الطلاب.</span></div>
    </div>
    <div class="set-pane" ${P('reg')}>${H('نموذج التسجيل', 'وش يعبّي الطالب لما يسجل من رابط التسجيل')}
    <div class="fld"><span>حقول التسجيل</span><div class="small muted" style="font-weight:400">الاسم واسم المستخدم وكلمة المرور ثابتة دائمًا.</div>
      <div class="tbl-wrap"><table class="fields-tbl"><thead><tr><th>الحقل</th><th>النوع</th><th class="num">ظاهر</th><th class="num">إجباري</th><th></th></tr></thead><tbody>
      ${st.fields.map(f => `<tr><td><input id="sf-lb-${f.k}" name="lb-${f.k}" value="${esc(f.label)}" style="min-width:140px">${f.type === 'choice' ? `<input id="sf-op-${f.k}" name="opt-${f.k}" value="${esc((f.options || []).join('، '))}" placeholder="الخيارات مفصولة بفاصلة" style="margin-top:4px;min-width:140px"><label class="check small"><input type="checkbox" name="multi-${f.k}" ${f.multi ? 'checked' : ''}> أكثر من خيار</label>` : ''}</td><td class="small">${FTYPE[f.type || 'text'] || 'نص'}</td><td class="num"><input type="checkbox" id="sf-on-${f.k}" name="on-${f.k}" ${f.on ? 'checked' : ''}></td><td class="num"><input type="checkbox" id="sf-req-${f.k}" name="req-${f.k}" ${f.req ? 'checked' : ''}></td><td><button type="button" class="btn ghost sm" data-act="sf-del" data-k="${f.k}">حذف</button></td></tr>`).join('')}
      </tbody></table></div><div><button type="button" class="btn sm" data-act="sf-add">إضافة حقل</button></div></div>
    </div>
    <div class="set-pane" ${P('msg')}>${H('نصوص الرسائل', 'الرسائل الجاهزة اللي يرسلها المعلم لولي الأمر')}
    <div class="fld"><span>رسائل واتساب لولي الأمر</span><span class="small muted" style="font-weight:400">استخدم {الطالب} و{الحلقة} و{التاريخ} وتنعبّى تلقائيًا.</span>
      <label class="fld"><span>رسالة الغياب</span><textarea id="sg-tA" name="absent" rows="3">${esc(st.tpl.absent)}</textarea></label>
      <label class="fld"><span>رسالة التميّز</span><textarea id="sg-tE" name="excellent" rows="3">${esc(st.tpl.excellent)}</textarea></label>
      ${(st.tpls || []).map((t, i) => `<div class="tpl-ed"><div class="row"><input id="tp-n-${i}" name="tpn-${i}" value="${esc(t.name)}" style="flex:0 1 200px" aria-label="اسم الرسالة"><button type="button" class="btn ghost sm" data-act="tpl-del" data-i="${i}">حذف</button></div><textarea id="tp-t-${i}" name="tpt-${i}" rows="2" aria-label="نص الرسالة">${esc(t.text)}</textarea></div>`).join('')}
      <div><button type="button" class="btn sm" data-act="tpl-add">إضافة رسالة جاهزة</button></div></div>
    </div>
    <div class="set-pane" ${P('site')}>${H('معلومات الموقع', 'تظهر للطلاب وأولياء الأمور')}
    <label class="fld"><span>اسم الحلقات أو المجمع</span><input id="sg-center" name="center" value="${esc(st.center)}" required></label>
    <div class="fgrid"><label class="fld"><span>جهة التواصل للطلاب وأولياء الأمور</span><input id="sg-sn" name="supportName" value="${esc(st.supportName || '')}" placeholder="مثال: إدارة الحلقة"></label><label class="fld"><span>رقم الواتساب للتواصل</span><input id="sg-sp" name="supportPhone" type="tel" dir="ltr" value="${esc(st.supportPhone || '')}" placeholder="05xxxxxxxx"></label></div>
    </div>
    ${saveBtn}
  </form>
    <section class="card" ${P('days')} style="display:grid;gap:12px"><div class="sec-head"><h2>الإجازات</h2><span class="small muted">ما تنشأ فيها حصص، والحصص التلقائية فيها تُلغى</span></div>
    ${hol.length ? `<div class="list">${hol.map((h, i) => `<div class="item"><div class="grow"><b>${esc(h.name)}</b> <span class="small muted">${fmtDateH(h.from)}${h.to !== h.from ? ' إلى ' + fmtDateH(h.to) : ''}</span></div>${h.to < today() ? '<span class="chip">انتهت</span>' : ''}<button class="btn ghost sm" data-act="hol-del" data-from="${h.from}" data-to="${h.to}">حذف</button></div>`).join('')}</div>` : '<div class="empty small">ما فيه إجازات مسجلة.</div>'}
    <form data-form="hol-add" class="fgrid" style="align-items:end"><label class="fld"><span>اسم الإجازة</span><input id="hl-name" name="name" required placeholder="مثال: إجازة عيد الفطر"></label><label class="fld"><span>من</span><input id="hl-from" name="from" type="date" required></label><label class="fld"><span>إلى</span><input id="hl-to" name="to" type="date"></label><button class="btn" type="submit">إضافة إجازة</button></form>
  </section>
  ${full && cur === 'msg' ? waSettingsHtml() : ''}
  ${full && cur === 'site' ? `<section class="card" style="display:grid;gap:10px"><h2>النسخ الاحتياطي</h2><div class="row"><a class="btn" href="/api/backup" download>تنزيل نسخة الآن</a></div>
    ${(S.backups || []).length ? `<div class="small muted" style="font-weight:600">النسخ الأسبوعية التلقائية</div><div class="list">${S.backups.map(b => `<div class="item"><div class="grow">${fmtDate(isoDate(new Date(b.at)))} ${clock(b.at)} <span class="small muted">${Math.round(b.size / 1024)} ك.ب</span></div><a class="btn sm" href="/api/backup?id=${b.id}" download>تنزيل</a></div>`).join('')}</div>` : '<div class="small muted">النسخ الأسبوعية تشتغل لحالها كل خميس بعد ما تضيف CRON_SECRET في Vercel (الشرح في الدليل).</div>'}</section>
  <section class="card" style="display:grid;gap:10px"><h2>الربط مع Google Sheets</h2>${st.exportKey ? `<div class="small muted">الصق هذي في خلية بـ Google Sheets:</div>${['students', 'attendance', 'recs'].map(t => { const f = `=IMPORTDATA("https://${location.host}/api/export/${t}?key=${st.exportKey}")`; return `<div class="row"><span class="small" style="min-width:70px">${({ students: 'الطلاب', attendance: 'الحضور', recs: 'التسميع' })[t]}</span><code dir="ltr" class="code">${esc(f)}</code><button class="btn ghost sm" data-act="copy" data-text="${esc(f)}">نسخ</button></div>`; }).join('')}<div><button class="btn ghost sm" data-act="export-key">مفتاح جديد (يوقف الروابط القديمة)</button></div>` : '<div><button class="btn" data-act="export-key">توليد مفتاح التصدير</button></div>'}</section>` : ''}
  ${!full && (cur === 'msg' || cur === 'site') ? '<div class="note small">ربط الواتساب والنسخ الاحتياطي للمدير الكامل فقط.</div>' : ''}`;
}

/* ---- student / parent home ---- */
function lessonCard(u, s) {
  const t = today(); const link = effLink(s); const j = S.joins[s.id + '_' + u.id]; const joined = j && !j.left;
  const isToday = s.date === t; const inQ = (s.queue || []).includes(u.id); const isCur = s.current === u.id;
  const pos = (s.queue || []).indexOf(u.id) + 1; const issue = (s.issues || {})[u.id];
  const qn = s.qnames || [];
  return `<div class="join-card"><div class="grow"><div class="small muted">${isToday ? 'حصة اليوم' : 'الحصة القادمة'}</div><h2>${fmtDateH(s.date)} · ${fmtTime(s.time)}</h2>
      <div class="cd" data-cd="${lessonTs(s)}">${cdText(lessonTs(s))}</div>${s.note ? `<div class="small">${esc(s.note)}</div>` : ''}${(s.att || {})[u.id] ? `<span class="chip ${ATTC[s.att[u.id]]}">${ATT[s.att[u.id]]}</span>` : ''}</div>
    <div class="join-actions">${link ? `<a class="btn pri big" href="${esc(link)}" target="_blank" rel="noopener" data-act="join" data-id="${s.id}">${j ? 'ادخل الحصة مرة ثانية' : 'ادخل الحصة'}</a>` : '<span class="chip warn">الرابط ينزل قبل الحصة</span>'}
      ${joined && isToday ? `<button class="btn" data-act="leave" data-id="${s.id}">خرجت من الحصة</button>` : ''}</div></div>
  ${link ? tip('أول مرة ممكن يطلب منك تثبيت Zoom أو Meet من المتجر. ثبته وارجع اضغط «ادخل الحصة».') : ''}
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
  <div class="verse"><span class="small muted">آية اليوم</span><p>﴿${vd[0]}﴾</p><span class="small muted">${vd[1]}</span></div>
  ${studentAnnsHtml(u)}
  ${cancelledSoon.map(s => `<div class="note">حصة ${fmtDate(s.date)} ملغاة${s.note ? ': ' + esc(s.note) : ''}.</div>`).join('')}
  ${dueCard(u)}
  ${next ? lessonCard(u, next) : `<div class="empty">ما فيه حصة قادمة حاليًا.</div>`}
  <div class="grid2">
    <section class="card" style="display:grid;gap:12px"><div class="sec-head"><h2>خطتك</h2></div>${tip('المطلوب يتحدث لحاله بعد ما يسجل المعلم تسميعك. الصفحات حسب مصحف المدينة النبوية من مجمع الملك فهد.')}${planHtml(u)}${goalHtml(u)}</section>
    ${tasksHtml(u)}
  </div>
  <div class="grid2">
    ${motivHtml(u)}
    <section class="card" style="display:grid;gap:12px"><h2>إنجازك</h2><div class="stats"><div class="stat"><b>${a.rate == null ? '—' : a.rate + '٪'}</b><span>الحضور، 30 يوم</span></div><div class="stat"><b>${a.a}</b><span>غياب</span></div><div class="stat"><b>${fmtPages(pg.new)}</b><span>أوجه حفظ هالأسبوع</span></div><div class="stat"><b>${fmtPages(pg.review + pg.tath)}</b><span>أوجه مراجعة هالأسبوع</span></div></div>
    ${past.length ? `<div class="list">${past.map(s => { const v = (s.att || {})[u.id]; return `<div class="item"><div class="grow">${fmtDate(s.date)}</div><span class="chip ${v ? ATTC[v] : ''}">${v ? ATT[v] : 'لم يُحضَّر'}</span></div>`; }).join('')}</div>` : ''}</section>
  </div>
  <section class="card"><h2>سجل التسميع</h2>${tip('كل تسميع مع تقديره وعدد الأخطاء وملاحظة المعلم. «إعادة» معناها يعيد المقطع في الحصة الجاية.')}${historyTable(rs)}</section>
  <div class="row" style="justify-content:center"><button class="btn ghost" data-act="tour">كيف أستخدم الصفحة؟</button>${supportBtn('تواصل مع الإدارة')}</div>
  ${stickyJoin(u)}`;
}

/* ---- announcements ---- */
function annsV(u) {
  const hs = myHalaqat(u);
  const list = L('anns').sort((a, b) => b.at - a.at);
  return `<div class="sec-head"><h1>الإعلانات</h1></div>
  <form class="card" data-form="ann" style="gap:10px"><h2>إعلان جديد</h2>
    <div class="fgrid"><label class="fld"><span>العنوان</span><input id="an-title" name="title" required maxlength="120" placeholder="مثال: تغيير موعد حصة الخميس"></label>
    <label class="fld"><span>لمين</span><select id="an-h" name="halqaId">${u.role === 'admin' ? '<option value="">كل الحلقات</option>' : ''}${hs.map(h => `<option value="${h.id}">${esc(h.name)}</option>`).join('')}</select></label></div>
    <label class="fld"><span>التفاصيل</span><textarea id="an-body" name="body" rows="3" maxlength="2000"></textarea></label>
    <div><button class="btn pri" type="submit">نشر الإعلان</button></div></form>
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
  const t = today(); const w = wirdOf(u.id, t) || {}; const items = planItems(u);
  const doneSet = new Set((w.items || []).filter(x => x.done).map(x => x.k));
  if (isPaused(u)) return `<section class="card"><h2>مهام اليوم</h2><div class="note">خطتك موقوفة مؤقتًا${u.plan.paused.reason ? ': ' + esc(u.plan.paused.reason) : ''}.</div></section>`;
  return `<form class="card" data-form="wird" style="gap:10px"><div class="sec-head"><h2>مهام اليوم</h2>${w.items ? '<span class="chip ok">محفوظة</span>' : ''}</div>
    ${tip('علّم على اللي خلصته في البيت، واكتب كم وجه قرأت، واضغط «حفظ». المعلم يشوفها قبل الحصة.')}
    ${items.length ? items.map((x, i) => { const k = itemLabel(x); return `<label class="task"><input type="checkbox" id="wd-${i}" name="it" value="${esc(k)}" ${doneSet.has(k) ? 'checked' : ''}><span>${x.retry ? 'إعادة ' : ''}${x.type === 'new' ? 'احفظ' : 'راجع'} ${esc(SN[x.surah - 1])} <b class="num">${x.from === x.to ? x.from : x.from + '–' + x.to}</b></span></label>`; }).join('') : '<div class="small muted">ما فيه مطلوب محدد اليوم.</div>'}
    <div class="row"><label class="fld" style="flex:0 1 200px"><span>ورد التلاوة اليوم (أوجه)</span><input id="wd-read" name="read" type="number" min="0" max="604" inputmode="numeric" value="${w.read || ''}"></label>
    <label class="fld" style="flex:1 1 200px"><span>ملاحظة (اختياري)</span><input id="wd-note" name="note" maxlength="200" value="${esc(w.note || '')}"></label></div>
    <div><button class="btn pri" type="submit">حفظ</button></div></form>`;
}
function motivHtml(u) {
  const B = S.board || {}; const streak = attendStreak(u); const bd = badgesOf(u);
  return `<section class="card" style="display:grid;gap:12px"><h2>نقاطك وإنجازاتك</h2>
    <div class="stats"><div class="stat"><b>${B.pts ?? 0}</b><span>نقاط هالأسبوع</span></div>${B.rank ? `<div class="stat"><b>${B.rank}</b><span>ترتيبك من ${B.total}</span></div>` : ''}<div class="stat"><b>${streak}</b><span>حصص متتالية حضرتها</span></div></div>
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
  return `السلام عليكم ورحمة الله، تقرير ابنكم ${st.name} في ${halqaName(st.halqaId)} لهذا الأسبوع:
- الحضور: ${pres} من ${ss.length}${abs ? ' (غاب ' + abs + ')' : ''}
- الحفظ: ${fmtPages(pg.new)} وجه، والمراجعة والتثبيت: ${fmtPages(pg.review + pg.tath)} وجه
- التسميع: ${rs.length}${rs.length ? ' (ممتاز ' + cnt('ممتاز') + '، جيد جدًا ' + cnt('جيد جدًا') + '، جيد ' + cnt('جيد') + '، إعادة ' + cnt('يعاد') + ')' : ''}
- النقاط: ${ptsOf(st, from, t)}
جزاكم الله خيرًا على المتابعة.`;
}
function waListModal(title, rows) {
  ST.sent = ST.sent || {};
  openModal(`${dlgHead(title)}<div class="small muted">اضغط على كل اسم يفتح واتساب برسالة جاهزة، وبعد الإرسال ارجع هنا للي بعده.</div>
  <div class="list">${rows.length ? rows.map(r => `<div class="item"><div class="grow"><b>${esc(r.name)}</b>${r.sub ? `<div class="small muted">${esc(r.sub)}</div>` : ''}</div>${r.link ? `<a class="btn wa sm ${ST.sent[r.key] ? 'sent' : ''}" href="${r.link}" target="_blank" rel="noopener" data-act="mark-sent" data-k="${esc(r.key)}">${ST.sent[r.key] ? 'أُرسل ✓' : 'إرسال'}</a>` : '<span class="chip warn">ما فيه رقم</span>'}</div>`).join('') : '<div class="empty small">ما فيه أحد.</div>'}</div>`);
}
function tplPickModal(st) {
  const v = { student: st.name, halqa: halqaName(st.halqaId), date: fmtDate(today()) };
  openModal(`${dlgHead('رسالة لولي أمر ' + esc(st.name))}<div class="list">
    ${[...allTpls(), { id: 'week', name: 'التقرير الأسبوعي', text: weekMsg(st) }].map(t => { const txt = t.id === 'week' ? t.text : fillTpl(t.text, v); const l = waLink(st.parentPhone, txt); return `<div class="item"><div class="grow"><b>${esc(t.name)}</b><div class="small muted tpl-prev">${esc(txt)}</div></div>${l ? `<a class="btn wa sm" href="${l}" target="_blank" rel="noopener">إرسال</a>` : ''}</div>`; }).join('')}
    <div class="item"><div class="grow"><b>رسالة فاضية</b></div><a class="btn wa sm" href="${waLink(st.parentPhone, 'السلام عليكم ورحمة الله، ')}" target="_blank" rel="noopener">فتح</a></div>
  </div>`);
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
const PERM_LABEL = { req: 'طلبات التسجيل', students: 'الطلاب', teachers: 'المعلمون', halaqat: 'الحلقات', anns: 'الإعلانات', reports: 'التقارير', settings: 'الإعدادات', logs: 'سجل العمليات' };
const PRESETS = { 'مشرف تعليمي': ['students', 'anns', 'reports', 'halaqat'], 'مسؤول تسجيل': ['req', 'students'], 'مشرف عام': ['req', 'students', 'teachers', 'halaqat', 'anns', 'reports', 'logs'] };
const isFullAdmin = u => u.role === 'admin' && !u.perms;
const can = (u, perm) => u.role === 'admin' && (!u.perms || u.perms.includes(perm));
const TAB_PERM = { req: 'req', students: 'students', teachers: 'teachers', halaqat: 'halaqat', anns: 'anns', reports: 'reports', settings: 'settings', logs: 'logs' };
const subName = id => (S.users[id] || {}).name || '';
function msgsUnread(u) { let seen = 0; try { seen = +localStorage.getItem('irtaq-room-' + u.id) || 0; } catch {} return L('msgs').filter(m => m.at > seen && m.by !== u.id).length; }

/* ---- لوحة المدير ---- */
function dashV(u) {
  const t = today(); const hs = L('halaqat'); const studs = L('users').filter(x => x.role === 'student' && x.status === 'active');
  const todayL = L('sessions').filter(s => s.date === t && !s.cancelled);
  const wk = weekStartC(t); const recsW = L('recs').filter(r => r.date >= wk);
  const pend = L('users').filter(x => x.role === 'student' && x.status === 'pending').length;
  const marked = todayL.flatMap(s => Object.values(s.att || {})); const pres = marked.filter(v => v === 'p' || v === 'l').length;
  const stuck = studs.filter(st => { const rs = recsOf(st.id).filter(r => r.date >= addDays(t, -14)); return rs.length ? rs.filter(r => r.pass === false).length >= 2 : (st.approvedAt && st.approvedAt < Date.now() - 14 * 864e5); });
  const issues = todayL.flatMap(s => Object.entries(s.issues || {}).map(([id, x]) => ({ s, id, x })));
  const pg = pagesSum(recsW);
  return `<h1>لوحة المدير</h1><div class="muted">${fmtDateH(t)}</div>
  <div class="stats"><div class="stat"><b>${studs.length}</b><span>طالب نشط</span></div><div class="stat"><b>${hs.length}</b><span>حلقة</span></div><div class="stat"><b>${todayL.length}</b><span>حصص اليوم</span></div><div class="stat"><b>${marked.length ? Math.round(pres / marked.length * 100) + '٪' : '—'}</b><span>حضور اليوم</span></div><div class="stat"><b>${recsW.length}</b><span>تسميع هالأسبوع</span></div><div class="stat"><b>${fmtPages(pg.new)}</b><span>أوجه حفظ هالأسبوع</span></div></div>
  ${pend ? `<div class="note"><b>${pend}</b> طلب تسجيل ينتظر الاعتماد. <button class="btn sm" data-act="tab" data-v="req">اعرضها</button></div>` : ''}
  ${issues.length ? `<div class="note bad-note"><b>مشاكل دخول الآن:</b> ${issues.map(o => esc(subName(o.id)) + ' (' + esc(halqaName(o.s.halqaId)) + ')').join('، ')}</div>` : ''}
  <section class="card"><h2>حصص اليوم</h2>${todayL.length ? `<div class="list">${todayL.sort((a, b) => a.time.localeCompare(b.time)).map(s => { const n = studentsOf(s.halqaId).length; const att = Object.values(s.att || {}); const p = att.filter(v => v === 'p' || v === 'l').length; const h = S.halaqat[s.halqaId] || {}; const late = s.teacherAt && s.time ? Math.round((s.teacherAt - lessonTs(s)) / 60000) : null;
    return `<div class="item click" data-act="open-session" data-id="${s.id}"><div class="grow"><b>${esc(h.name || '')}</b><div class="small muted">${fmtTime(s.time)} · ${esc(subName(s.subId || h.teacherId) || 'بدون معلم')}${s.subId ? ' (احتياط)' : ''}</div></div>
      ${s.teacherAt ? `<span class="chip ${late > 10 ? 'warn' : 'ok'}">المعلم دخل ${clock(s.teacherAt)}</span>` : (lessonTs(s) < Date.now() ? '<span class="chip bad">المعلم ما فتح الحصة</span>' : '<span class="chip">لم تبدأ</span>')}<span class="chip num">حضور ${p}/${n}</span><span class="chip num">تسميع ${L('recs').filter(r => r.sid === s.id).length}</span></div>`; }).join('')}</div>` : '<div class="empty small">ما فيه حصص اليوم.</div>'}</section>
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
  const ms = L('msgs').sort((a, b) => a.at - b.at);
  try { localStorage.setItem('irtaq-room-' + u.id, String(Date.now())); } catch {}
  return `<h1>غرفة المعلمين</h1><div class="small muted">للمعلمين والإدارة فقط، الطلاب ما يشوفونها.</div>
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
    lines.push(`   الخطة: ${isAuto(st) ? 'تلقائية' : 'يدوية'}${isPaused(st) ? ' (موقوفة)' : ''} · المطلوب: ${items.length ? items.map(itemLabel).join('، ') : 'ما حُدّد'}`);
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
  if (u.role === 'student') return `<h1>الدليل</h1>
    <div class="row"><button class="btn pri" data-act="tour">شاهد الجولة التعريفية</button>${supportBtn('تواصل مع الإدارة')}</div>
    ${sec('للطالب: يوم الحصة خطوة بخطوة', ol(['افتح الموقع قبل الحصة بدقائق، وتشوف العدّاد في صفحتك.', 'وقت الحصة اضغط «ادخل الحصة»، ويفتح Zoom أو Meet.', 'إذا صرت جاهز تسمّع اضغط «جاهز للتسميع»، وتشوف ترتيبك في الطابور.', 'لما يطلع «دورك الآن» افتح المايك وسمّع المطلوب منك.', 'إذا ما قدرت تدخل اضغط «عندي مشكلة في الدخول» واختر المشكلة.', 'بعد الحصة شوف تقديرك وملاحظة المعلم في «سجل التسميع».']))}
    ${sec('في البيت', ol(['افتح «المطلوب منك» وجهّز الحفظ والمراجعة للحصة الجاية.', 'في «مهام اليوم» علّم على اللي خلصته، واكتب كم وجه قرأت، واضغط «حفظ».', 'نقاطك تزيد مع الحضور والتسميع الممتاز والحفظ، وتطلع لك أوسمة مع الالتزام.']))}
    ${sec('لولي الأمر', ol(['ادخل بحساب ولدك نفسه، ما يحتاج حساب ثاني.', '«ملخص سريع» فوق يوضح حضوره اليوم وآخر تقدير له.', '«إنجازك» فيه نسبة الحضور، وعدد الأوجه المحفوظة والمراجعة هالأسبوع.', '«سجل التسميع» فيه كل تسميع بتقديره وأخطائه وملاحظة المعلم.', 'الإعلانات تطلع فوق باللون الذهبي، اضغط «قرأت» بعد ما تقراها.', 'زر «English» فوق يعرض الصفحة بالإنجليزي، وزر «أ+» يكبّر الخط.', 'عندك أكثر من ولد؟ اضغط «إضافة ابن» وادخل حسابه مرة وحدة، وبعدها تتنقل بينهم من «الأبناء».']))}
    ${cal}${install}${notif}
    <section class="card help"><h2>أسئلة شائعة</h2>${FAQ.map(([q, a]) => `<details class="faq"><summary>${q}</summary><p>${a}</p></details>`).join('')}</section>`;
  const teacher = sec('للمعلم', ol(['الحصص تنشأ لحالها إذا كانت الحلقة على «جدول ثابت». افتح حصة اليوم من «الحصص».', 'في التحضير: «الكل حاضر» ثم عدّل الغائبين، أو «من دخل» يحضّر اللي ضغطوا دخول.', 'الطابور: الطلاب يدخلونه بأنفسهم، أو أضفهم. «التالي» ينقل للطالب اللي بعده ويوصله إشعار.', 'لوحة التسجيل: اضغط «+ خطأ» و«+ تنبيه» وأنت تسمع، والتقدير يطلع لحاله. «حفظ والتالي» يوفر عليك.', '«المطلوب اليوم» يعرض خطة كل طالب وهل راجع في البيت.', 'من صفحة الطالب: الخطة والهدف ورسائل واتساب لولي الأمر.']));
  const admin = u.role === 'admin' ? sec('للمدير', ol(['أنشئ الحلقات وفعّل «جدول ثابت» وحط الرابط الثابت.', 'أضف المعلمين وحدد صلاحياتهم، وأضف مشرفين إداريين بصلاحيات محددة من صفحة المعلمين.', 'أرسل رابط التسجيل لكل حلقة، واعتمد الطلبات من «الطلبات».', 'الإجازات والفصول والنقاط والرسائل الجاهزة من «الإعدادات».', 'لتكليف معلم احتياط: افتح الحصة ← تعديل ← المعلم الاحتياط.'])) +
    (isFullAdmin(u) ? sec('Google Sheets', `<p>من الإعدادات ولّد مفتاح التصدير، وبعدها في Google Sheets اكتب في خلية:</p><pre dir="ltr">=IMPORTDATA("https://${host}/api/export/students?key=المفتاح")</pre><p class="small muted">استبدل students بـ attendance للحضور أو recs للتسميع. الجدول يتحدث لحاله كل ساعة تقريبًا.</p>`) +
      sec('الرابط المختصر', ol(['من Vercel افتح المشروع ← Settings ← Domains.', 'اكتب اسم مثل irtaq.vercel.app واضغط Add (إذا كان متاح)، أو اربط دومين اشتريته.'])) +
      sec('تذكير الحصة والنسخ الاحتياطي', ol(['في Vercel أضف متغير CRON_SECRET بأي نص طويل، وأعد الرفع. النسخ الاحتياطي الأسبوعي يشتغل لحاله كل خميس.', 'للتذكير قبل الحصة: سجّل في cron-job.org مجانًا وأضف مهمة كل 5 دقائق على الرابط: <span dir="ltr" class="small">https://' + host + '/api/cron/remind?key=CRON_SECRET</span>', 'للإشعارات أضف VAPID_PUBLIC_KEY و VAPID_PRIVATE_KEY (أرسلتها لك في المحادثة).'])) : '') : '';
  return `<h1>الدليل</h1>${admin}${teacher}${cal}${install}${notif}`;
}

/* ---- مودالات المرحلة 3 ---- */
function adminModal(a) {
  const perms = a ? a.perms || [] : PRESETS['مشرف تعليمي'];
  openModal(`${dlgHead(a ? 'تعديل مشرف إداري' : 'مشرف إداري جديد')}<form data-form="admin" data-id="${a ? a.id : ''}">
    <label class="fld"><span>الاسم</span><input name="name" value="${esc(a ? a.name : '')}" required></label>
    <div class="fgrid"><label class="fld"><span>اسم المستخدم</span><input name="username" dir="ltr" autocapitalize="none" value="${esc(a ? a.username : '')}" required pattern="[A-Za-z0-9_.]{3,30}"></label>
    <label class="fld"><span>${a ? 'كلمة مرور جديدة (اتركها فاضية)' : 'كلمة المرور'}</span><input name="password" type="password" ${a ? '' : 'required minlength="6"'} autocomplete="new-password"></label></div>
    <div class="fld"><span>قالب جاهز</span><div class="row">${Object.keys(PRESETS).map(k => `<button type="button" class="btn sm" data-act="preset" data-k="${k}">${k}</button>`).join('')}</div></div>
    <div class="fld"><span>الصلاحيات</span><div class="days">${Object.entries(PERM_LABEL).map(([k, l]) => `<label><input type="checkbox" name="perm" value="${k}" ${perms.includes(k) ? 'checked' : ''}> ${l}</label>`).join('')}</div><span class="small muted" style="font-weight:400">الحصص ولوحة المدير متاحة للكل. إضافة المدراء والنسخ الاحتياطي للمدير الكامل فقط.</span></div>
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
const WA_KIND = { absent: 'غياب', present: 'حضور', late: 'تأخر', rec: 'نتيجة التسميع', week: 'تقرير أسبوعي' };
function waSettingsHtml() {
  if (!ST.wa && !ST.waLoading) { ST.waLoading = true; act('wa.get', {}).then(r => { ST.waLoading = false; ST.wa = r || { cfg: {}, log: [], counts: {} }; render(); }); }
  if (!ST.wa) return `<section class="card"><h2>ربط الواتساب</h2><div class="row"><div class="spin"></div></div></section>`;
  const c = { ...(ST.wa.cfg || {}) }; if (/getpostman|documenter/i.test(c.url || '')) c.url = ''; const cnt = ST.wa.counts || {};
  return `<form class="card" data-form="wa" style="gap:12px"><div class="sec-head"><h2>ربط الواتساب (الواتس الذكي)</h2><span class="chip ${c.enabled ? 'ok' : ''}">${c.enabled ? 'مفعّل' : 'متوقف'}</span></div>
    ${tip('الموقع يرسل من رقمك المربوط في الواتس الذكي مباشرة لولي الأمر. اربط بخطوتين: ادخل بحسابك تحت واضغط «اربط»، بعدين «حفظ ربط الواتساب». تأكد قبلها إن جوالك مربوط في الواتس الذكي (مسحت الباركود).')}
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
      <label class="fld"><span>رسالة نتيجة التسميع</span><textarea id="wa-tplRec" name="tplRec" rows="3">${esc(c.tplRec || '')}</textarea></label></div></details>
    <div class="seg-box"><b>التقرير الأسبوعي لأولياء الأمور</b>
      <label class="check"><input type="checkbox" id="wa-autoWeek" name="autoWeek" ${c.autoWeek ? 'checked' : ''}> يرسل تلقائيًا كل أسبوع</label>
      <div class="fgrid"><label class="fld"><span>اليوم</span><select id="wa-weekDay" name="weekDay">${DAYN.map((d, i) => `<option value="${i}" ${(c.weekDay ?? 4) === i ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
      <label class="fld"><span>الساعة</span><select id="wa-weekHour" name="weekHour">${[...Array(24).keys()].map(h => `<option value="${h}" ${(c.weekHour ?? 20) === h ? 'selected' : ''}>${fmtTime(pad(h) + ':00')}</option>`).join('')}</select></label></div>
      <details><summary class="small">نص التقرير</summary><label class="fld" style="margin-top:8px"><textarea id="wa-tplWeek" name="tplWeek" rows="8">${esc(c.tplWeek || '')}</textarea><span class="hint">المتغيرات: {الطالب} {الحلقة} {الحضور} {الغياب} {الحفظ} {المراجعة} {التسميع} {النقاط}</span></label></details>
      <div class="row"><button type="button" class="btn" data-act="wa-week-now">أرسل تقرير هالأسبوع الآن لكل الحلقات</button></div>
      <span class="small muted">يحسب من بداية الأسبوع (الأحد) لين يوم الإرسال. ولي الأمر ما يوصله نفس التقرير مرتين في نفس الأسبوع.</span></div>
    <div class="row"><button class="btn pri" type="submit">حفظ ربط الواتساب</button></div>
    <div class="test-box"><b>تجربة الإرسال</b><div class="row"><input id="wa-test-phone" type="tel" dir="ltr" placeholder="05xxxxxxxx" style="flex:1 1 160px"><button type="button" class="btn" data-act="wa-test">أرسل رسالة تجريبية</button></div><div id="wa-test-out" class="small ${ST.waTest ? (ST.waTest.ok ? 'c-ok' : 'c-bad') : 'muted'}" dir="auto">${ST.waTest ? esc(ST.waTest.msg) : ''}</div></div>
  </form>
  <section class="card" style="display:grid;gap:10px"><div class="sec-head"><h2>سجل رسائل الواتساب</h2><button class="btn ghost sm" data-act="wa-refresh">تحديث</button></div>
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
  return `<div class="psum"><span class="small muted">ملخص سريع</span><div>${bits.join(' · ')}</div></div>`;
}

/* شريط ثابت أسفل الجوال وقت الحصة */
function stickyJoin(u) {
  const t = today(); const s = L('sessions').filter(x => x.halqaId === u.halqaId && x.date === t && !x.cancelled).sort((a, b) => a.time.localeCompare(b.time)).find(x => { const d = lessonTs(x) - Date.now(); return d < 20 * 60000 && d > -3 * 3600000; });
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
const blankSeg = (type = 'new') => ({ type, surah: '', from: '', to: '', m: 0, a: 0, full: false, q: '' });
function startRec(uid, sid, where, date) {
  const st = { ...S.users[uid], id: uid }; const items = planItems(st);
  ST.rec = { uid, sid: sid || '', where, date: date || today(), quick: false, secs: 0, run: false, t0: 0, note: '',
    segs: items.length ? items.map(x => ({ ...blankSeg(x.type), surah: x.surah, from: x.from, to: x.to, retry: !!x.retry })) : [blankSeg()] };
}
const recSecs = () => ST.rec ? ST.rec.secs + (ST.rec.run ? Math.floor((Date.now() - ST.rec.t0) / 1000) : 0) : 0;
const fmtDur = s => Math.floor(s / 60) + ':' + pad(s % 60);
function segGrade(g) { return ST.rec.quick ? (g.q ? { k: GRADE_K[g.q], t: g.q } : null) : gradeOf(g.m, g.a); }
function segHtml(g, i) {
  const n = AYAS[+g.surah - 1]; const gr = segGrade(g);
  return `<div class="seg-box">
    <div class="row" style="justify-content:space-between"><div class="row"><select id="rk-t-${i}" data-rf="type" data-i="${i}">${Object.keys(TYPE).map(k => `<option value="${k}" ${g.type === k ? 'selected' : ''}>${TYPE[k]}</option>`).join('')}</select>${g.retry ? '<span class="chip bad">إعادة</span>' : ''}${gr ? `<span class="chip ${gr.k}">${gr.t}</span>` : ''}</div>${ST.rec.segs.length > 1 ? `<button class="btn ghost sm" data-act="rk-rm" data-i="${i}" aria-label="حذف المقطع">✕</button>` : ''}</div>
    <div class="fgrid"><select id="rk-s-${i}" data-rf="surah" data-i="${i}" aria-label="السورة">${surahOptions(g.surah)}</select>
      <input id="rk-f-${i}" data-rf="from" data-i="${i}" type="number" inputmode="numeric" min="1" ${n ? `max="${n}"` : ''} placeholder="من آية" aria-label="من آية" value="${g.full ? 1 : esc(g.from)}" ${g.full ? 'disabled' : ''}>
      <input id="rk-to-${i}" data-rf="to" data-i="${i}" type="number" inputmode="numeric" min="1" ${n ? `max="${n}"` : ''} placeholder="إلى آية" aria-label="إلى آية" value="${g.full ? (n || '') : esc(g.to)}" ${g.full ? 'disabled' : ''}></div>
    <label class="check small"><input type="checkbox" id="rk-full-${i}" data-rf="full" data-i="${i}" ${g.full ? 'checked' : ''}> السورة كاملة${n ? ` (${n} آية)` : ''}</label>
    ${ST.rec.quick ? `<div class="qgrades">${['ممتاز', 'جيد جدًا', 'جيد', 'يعاد'].map(t => `<button class="btn ${g.q === t ? 'pri' : ''}" data-act="rk-q" data-i="${i}" data-v="${t}">${t}</button>`).join('')}</div>`
      : `<div class="tally"><div class="tl"><span>الأخطاء</span><div class="tl-row"><button class="btn tb" data-act="rk-inc" data-i="${i}" data-k="m" data-d="-1" aria-label="إنقاص خطأ">−</button><b class="num">${g.m}</b><button class="btn tb big-t" data-act="rk-inc" data-i="${i}" data-k="m" data-d="1">+ خطأ</button></div></div>
        <div class="tl"><span>التنبيهات</span><div class="tl-row"><button class="btn tb" data-act="rk-inc" data-i="${i}" data-k="a" data-d="-1" aria-label="إنقاص تنبيه">−</button><b class="num">${g.a}</b><button class="btn tb big-t" data-act="rk-inc" data-i="${i}" data-k="a" data-d="1">+ تنبيه</button></div></div></div>`}
  </div>`;
}
function recPanelHtml() {
  const R = ST.rec; if (!R) return '';
  const st = S.users[R.uid] || {}; const ses = S.sessions[R.sid] || {};
  return `<div class="recp">
   <div class="sec-head"><div><div class="small muted">تسجيل تسميع${R.sid ? '' : ' خارج الحصة'}</div><h3>${esc(st.name)}</h3></div>
     <div class="row"><span class="timer num" data-timer>${fmtDur(recSecs())}</span><button class="btn sm" data-act="rk-timer">${R.run ? 'إيقاف' : (R.secs ? 'متابعة' : 'ابدأ التوقيت')}</button>${R.secs || R.run ? '<button class="btn ghost sm" data-act="rk-treset">تصفير</button>' : ''}</div></div>
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
  for (const g of R.segs) {
    const s = +g.surah; const n = AYAS[s - 1];
    if (!n) return toast('اختر السورة لكل مقطع');
    const from = g.full ? 1 : +g.from, to = g.full ? n : +g.to;
    if (!(from >= 1 && to >= from && to <= n)) return toast('تأكد من آيات ' + SN[s - 1] + ' (عدد آياتها ' + n + ')');
    if (R.quick && !g.q) return toast('اختر التقدير لكل مقطع');
    items.push({ type: g.type, surah: s, from, to, full: !!g.full, mistakes: g.m, alerts: g.a, quickGrade: R.quick ? g.q : undefined });
  }
  const r = await act('rec.addMany', { uid: R.uid, lessonId: R.sid, date: R.date, secs: recSecs(), note: R.note, items }, x => 'سُجّل التسميع: ' + (x.grade || ''));
  if (!r) return;
  const where = R.where, sid = R.sid; ST.rec = null;
  if (where === 'modal') closeModal();
  if (next && sid) { const s = { ...S.sessions[sid], id: sid }; const q = [...(s.queue || [])]; const nx = q.shift() || null; await setQueue(s, q, nx); if (nx && S.users[nx]) startRec(nx, sid, 'inline'); }
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
  openModal(`${dlgHead(h ? 'تعديل الحلقة' : 'حلقة جديدة')}
  <form data-form="halqa" data-id="${h ? h.id : ''}">
    <label class="fld"><span>اسم الحلقة</span><input name="name" value="${esc(h ? h.name : '')}" required placeholder="مثال: حلقة أبي بن كعب"></label>
    <label class="fld"><span>المعلم</span><select name="teacherId"><option value="">بدون معلم</option>${ts.map(t => `<option value="${t.id}" ${h && h.teacherId === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>
    <div class="fld"><span>أيام الدوام</span><div class="days">${DAYN.map((d, i) => `<label><input type="checkbox" name="day" value="${i}" ${days.includes(i) ? 'checked' : ''}> ${d}</label>`).join('')}</div></div>
    <label class="fld"><span>الوقت المعتاد للحصة</span><input type="time" name="time" value="${esc(h ? h.time : '')}"></label>
    <label class="fld"><span>رابط الحلقة الثابت (Zoom أو Meet أو Teams)</span><input name="link" type="url" dir="ltr" value="${esc(h ? h.link : '')}" placeholder="https://"></label>
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
  'pw-eye': el => { const i = el.parentElement.querySelector('input'); const show = i.type === 'password'; i.type = show ? 'text' : 'password'; el.textContent = show ? 'إخفاء' : 'إظهار'; },
  'forgot': () => openModal(`${dlgHead('نسيت كلمة المرور؟')}<p>كلمة المرور ما نقدر نرسلها، لكن الإدارة تعطيك كلمة مرور جديدة بالواتساب خلال دقائق.</p><div class="dlg-foot">${supportBtn('اطلب كلمة مرور جديدة', 'السلام عليكم، نسيت كلمة المرور لحساب الطالب: ') || '<span class="muted">تواصل مع إدارة الحلقة.</span>'}</div>`),
  'tour': () => showTour(0),
  'wa-refresh': () => { ST.wa = null; render(); },
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
  'kids': () => kidsModal(),
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
  'wa-absent': () => { const s = curSession(); const tp = SET().tpl.absent; waListModal('رسائل الغياب', studentsOf(s.halqaId).filter(x => (s.att || {})[x.id] === 'a').map(x => ({ key: 'a' + s.id + x.id, name: x.name, sub: x.parentName || '', link: x.parentPhone && waLink(x.parentPhone, fillTpl(tp, { student: x.name, halqa: halqaName(s.halqaId), date: fmtDate(s.date) })) }))); },
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
  'rk-add': () => { ST.rec.segs.push(blankSeg('review')); refreshRec(); },
  'rk-rm': el => { ST.rec.segs.splice(+el.dataset.i, 1); refreshRec(); },
  'rk-inc': el => { const g = ST.rec.segs[+el.dataset.i]; g[el.dataset.k] = Math.max(0, (+g[el.dataset.k] || 0) + +el.dataset.d); refreshRec(); },
  'rk-q': el => { ST.rec.segs[+el.dataset.i].q = el.dataset.v; refreshRec(); },
  'rk-save': () => saveRec(false),
  'rk-save-next': () => saveRec(true),
  'rk-cancel': () => { const w = ST.rec && ST.rec.where; ST.rec = null; if (w === 'modal') closeModal(); else render(); },
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
  'edit-halqa': el => halqaModal({ ...S.halaqat[el.dataset.id], id: el.dataset.id }),
  'del-halqa': el => confirmBox('تحذف الحلقة؟', 'حذف', () => act('halqa.delete', { id: el.dataset.id }, 'حُذفت الحلقة')),
  'edit-plan': el => planModal({ ...S.users[el.dataset.id], id: el.dataset.id }),
  'sf-add': () => { const hasMemo = SET().fields.some(f => f.type === 'memo'); openModal(`${dlgHead('إضافة حقل تسجيل')}<form data-form="sf-add"><label class="fld"><span>النوع</span><select name="type" data-change="sf-type"><option value="text">نص</option><option value="tel">رقم جوال</option><option value="number">رقم</option><option value="choice">اختيار من متعدد</option>${hasMemo ? '' : '<option value="memo">مقدار الحفظ (من سورة وآية إلى سورة وآية)</option>'}</select></label>
    <label class="fld"><span>اسم الحقل</span><input name="label" required placeholder="مثال: المرحلة الدراسية"></label>
    <div id="sf-choice" hidden style="display:grid;gap:8px"><label class="fld"><span>الخيارات (كل خيار في سطر)</span><textarea name="options" rows="4" placeholder="ابتدائي\nمتوسط\nثانوي"></textarea></label><label class="check"><input type="checkbox" name="multi"> يقدر يختار أكثر من خيار</label></div>
    <label class="check"><input type="checkbox" name="req"> إجباري</label><div class="dlg-foot"><button class="btn pri" type="submit">إضافة</button></div></form>`); },
  'sf-del': el => saveSettingsWith(d => { d.fields = d.fields.filter(f => f.k !== el.dataset.k); }, 'حُذف الحقل'),
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
  'ptpl-fill': el => { const t = (SET().planTpls || []).find(x => x.id === el.value); if (!t) return; const f = el.closest('form'); [['newAmt', t.newAmt], ['revAmt', t.revAmt], ['tathAmt', t.tathAmt]].forEach(([n, v]) => { const sel = f.querySelector(`[name=${n}]`); if (!sel) return; if (![...sel.options].some(o => +o.value === +v)) sel.add(new Option(fmtAmt(v), v)); sel.value = String(v); [...sel.options].forEach(o => { if (+o.value === +v) o.selected = true; }); }); },
  'goal-term': el => { if (!el.value) return; const [a, b] = el.value.split('|'); const f = el.closest('form'); f.querySelector('[name=from]').value = a; f.querySelector('[name=by]').value = b; },
  'prior-toggle': el => { $('#pm-prior').hidden = !el.checked; $('#pm-start').hidden = el.checked; },
  'sf-type': el => { const c = $('#sf-choice'); if (c) c.hidden = el.value !== 'choice'; const lb = el.form.querySelector('[name=label]'); if (el.value === 'memo' && !lb.value) lb.value = 'مقدار الحفظ السابق'; },
  'memo-none': el => { const r = el.closest('.memo-fld').querySelector('.memo-rows'); if (r) r.hidden = el.checked; },
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
  return { enabled: b('enabled'), method: d.get('method'), url: (d.get('url') || '').trim(), body: (d.get('body') || '').trim(), okWord: (d.get('okWord') || '').trim(), autoAbsent: b('autoAbsent'), autoLate: b('autoLate'), autoPresent: b('autoPresent'), autoRec: b('autoRec'), delayMin: +d.get('delayMin') || 0, autoWeek: b('autoWeek'), weekDay: +d.get('weekDay'), weekHour: +d.get('weekHour'), tplWeek: d.get('tplWeek'), tplPresent: d.get('tplPresent'), tplLate: d.get('tplLate'), tplRec: d.get('tplRec') };
}
function settingsData(f) {
  const d = new FormData(f); const st = SET();
  const fields = st.fields.map(x => ({ ...x, label: (d.get('lb-' + x.k) || x.label).trim() || x.label, on: !!d.get('on-' + x.k), req: !!d.get('req-' + x.k) && !!d.get('on-' + x.k),
    ...(x.type === 'choice' ? { options: String(d.get('opt-' + x.k) ?? (x.options || []).join('،')).split(/[،,\n]/).map(o => o.trim()).filter(Boolean), multi: d.has('opt-' + x.k) ? !!d.get('multi-' + x.k) : !!x.multi } : {}) }));
  const tpls = (st.tpls || []).map((t, i) => ({ id: t.id, name: (d.get('tpn-' + i) ?? t.name), text: (d.get('tpt-' + i) ?? t.text) }));
  const planTpls = (st.planTpls || []).map((t, i) => ({ id: t.id, name: d.get('ptn-' + i) ?? t.name, newAmt: +(d.get('pta-' + i) ?? t.newAmt), revAmt: +(d.get('ptr-' + i) ?? t.revAmt), tathAmt: +(d.get('ptt-' + i) ?? t.tathAmt) }));
  const points = {}; ['present', 'late', 'ex', 'vg', 'gd', 'page'].forEach(k => points[k] = +d.get('pt-' + k) || 0);
  const terms = (st.terms || []).map((t, i) => ({ id: t.id, name: d.get('tmn-' + i) ?? t.name, from: d.get('tmf-' + i) ?? t.from, to: d.get('tmt-' + i) ?? t.to }));
  return { supportName: d.get('supportName') || '', supportPhone: d.get('supportPhone') || '', center: d.get('center'), days: d.getAll('day').map(Number), fields, tpls, planTpls, points, terms, board: d.get('board'), absentAlert: +d.get('absentAlert') || 3,
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
      await api('/api/register', { name: d.get('name'), username: d.get('username'), password: d.get('password'), info, reqHalqa: f.dataset.hid || d.get('reqHalqa') || '' });
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
    const r = await act('halqa.save', { id: f.dataset.id, data: { name: d.get('name'), teacherId: d.get('teacherId'), days, time: d.get('time'), link: (d.get('link') || '').trim(), auto: !!d.get('auto') } }, f.dataset.id ? 'حُفظت الحلقة' : 'أُنشئت الحلقة');
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
    const done = new Set(d.getAll('it')); const items = planItems(me()).map(x => ({ k: itemLabel(x), done: done.has(itemLabel(x)) }));
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
    const r = await act('admin.save', { id: f.dataset.id, data: { name: d.get('name'), username: d.get('username'), password: d.get('password'), perms: d.getAll('perm'), status: d.get('status') } }, 'حُفظ');
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
  if (ST.view === 'session') { const s = S.sessions[ST.sid]; return !!s && s.date === t; }
  if (u.role === 'student') return L('sessions').some(s => s.halqaId === u.halqaId && s.date === t && !s.cancelled && Math.abs(lessonTs(s) - Date.now()) < 3 * 3600000);
  return false;
}
async function pollLoop() {
  if (document.visibilityState === 'visible' && ST.meId && ($('#modal').hidden || (ST.rec && ST.rec.where === 'modal'))) { if (!(ST.rec && ST.rec.where === 'modal')) await load(); }
  setTimeout(pollLoop, liveNow() ? 8000 : 30000);
}
setTimeout(pollLoop, 8000);
setInterval(() => {
  document.querySelectorAll('[data-cd]').forEach(el => { el.textContent = el.dataset.en ? cdTextEn(+el.dataset.cd) : cdText(+el.dataset.cd); });
  if (ST.rec && ST.rec.run) document.querySelectorAll('[data-timer]').forEach(el => { el.textContent = fmtDur(recSecs()); });
}, 1000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && ST.meId) load(); });
})();
