/* منطق الإنجاز المشترك: الهدف اليومي (الحفظ بالأسطر والمراجعة بالأوجه)، ونسبة الإنجاز اليومية والأسبوعية
   والتراكمية، وأسابيع الفصل الدراسي، وإنجاز السور، وخريطة الحفظ.
   تستخدمه الواجهة (app.js) وصفحة سجل الطالب (card.js) وشاشة الجامع (screen.js)، فالحساب واحد في الثلاث. */
(function (G) {
'use strict';
const SN = "الفاتحة|البقرة|آل عمران|النساء|المائدة|الأنعام|الأعراف|الأنفال|التوبة|يونس|هود|يوسف|الرعد|إبراهيم|الحجر|النحل|الإسراء|الكهف|مريم|طه|الأنبياء|الحج|المؤمنون|النور|الفرقان|الشعراء|النمل|القصص|العنكبوت|الروم|لقمان|السجدة|الأحزاب|سبأ|فاطر|يس|الصافات|ص|الزمر|غافر|فصلت|الشورى|الزخرف|الدخان|الجاثية|الأحقاف|محمد|الفتح|الحجرات|ق|الذاريات|الطور|النجم|القمر|الرحمن|الواقعة|الحديد|المجادلة|الحشر|الممتحنة|الصف|الجمعة|المنافقون|التغابن|الطلاق|التحريم|الملك|القلم|الحاقة|المعارج|نوح|الجن|المزمل|المدثر|القيامة|الإنسان|المرسلات|النبأ|النازعات|عبس|التكوير|الانفطار|المطففين|الانشقاق|البروج|الطارق|الأعلى|الغاشية|الفجر|البلد|الشمس|الليل|الضحى|الشرح|التين|العلق|القدر|البينة|الزلزلة|العاديات|القارعة|التكاثر|العصر|الهمزة|الفيل|قريش|الماعون|الكوثر|الكافرون|النصر|المسد|الإخلاص|الفلق|الناس".split('|');
const AYAS = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];
const SSTART = []; let TOTAL = 0;
AYAS.forEach((n, i) => { SSTART[i] = TOTAL; TOTAL += n; });
const SUR = new Int16Array(TOTAL);
AYAS.forEach((n, s) => { for (let a = 0; a < n; a++) SUR[SSTART[s] + a] = s; });
/* وزن كل آية بالأوجه (أسطرها ÷ 15). تقديري حتى تصل أسطر مصحف المدينة */
let W = new Float64Array(TOTAL).fill(604 / TOTAL);
function order(dir) {
  const ord = new Int32Array(TOTAL); let k = 0;
  const ss = [...Array(114).keys()]; if (dir === 'bwd') ss.reverse();
  ss.forEach(s => { for (let a = 0; a < AYAS[s]; a++) ord[k++] = SSTART[s] + a; });
  return ord;
}
const ORD = { fwd: order('fwd'), bwd: order('bwd') };

/* التواريخ بصيغة YYYY-MM-DD، والحساب بتوقيت موحّد عشان ما يتأثر بالتوقيت الصيفي */
const ms = ds => Date.parse(ds + 'T00:00:00Z');
const addDays = (ds, n) => new Date(ms(ds) + n * 864e5).toISOString().slice(0, 10);
const dow = ds => new Date(ms(ds)).getUTCDay();
const weekStart = ds => addDays(ds, -dow(ds));
const daysBetween = (a, b) => Math.round((ms(b) - ms(a)) / 864e5);

function setLines(lines) { if (lines && lines.length === TOTAL) for (let i = 0; i < TOTAL; i++) W[i] = lines[i] / 15; }
/* الواجهة تشارك مصفوفة الأوزان نفسها (تتعبأ لحالها لما توصل صفحات المصحف) */
function setW(arr) { if (arr && arr.length === TOTAL) W = arr; }
function recPages(r) { let w = 0; const b = SSTART[r.surah - 1]; for (let i = r.from; i <= r.to; i++) w += W[b + i - 1] || 0; return w; }
const recLines = r => recPages(r) * 15;

const P = st => (st && st.plan) || {};
/** حافظ للقرآن: حدده المعلم، أو أتمّ الخطة التلقائية. الحافظ يراجع فقط */
function hafiz(st) { const p = P(st); if (p.hafiz) return true; return p.mode === 'auto' && +((p.auto || {}).newPos || 0) >= TOTAL; }
/** الهدف اليومي: الخاص بالطالب، وإلا مقادير خطته التلقائية، وإلا الهدف العام من الإعدادات */
function target(st, set) {
  const p = P(st); const hz = hafiz(st);
  const d = p.daily && typeof p.daily === 'object' ? p.daily : null;
  const def = (set && set.daily) || {};
  const a = p.mode === 'auto' ? (p.auto || {}) : null;
  let lines = d ? +d.lines || 0 : a ? (+a.newAmt || 0) * 15 : +def.lines || 0;
  const pages = d ? +d.pages || 0 : a ? (+a.revAmt || 0) + (+a.tathAmt || 0) : +def.pages || 0;
  if (hz) lines = 0;
  return { lines, pages, hafiz: hz, src: d ? 'own' : a ? 'plan' : (+def.lines || +def.pages) ? 'def' : '' };
}
const paused = (st, date) => { const z = P(st).paused; return !!(z && z.from && date >= z.from && (!z.to || date <= z.to)); };
const ATT_RANK = { a: 1, e: 2, l: 3, p: 4 };
const mk = date => ({ date, lesson: false, att: null, off: false, tLines: 0, tPages: 0, lines: 0, pages: 0, newR: [], revR: [], bad: 0 });

/** أيام الطالب في فترة: أيام الحصص (عليها الهدف) وأي يوم سمّع فيه.
 *  c = { st: { id, plan, joined }, sessions: [{ date, att, cancelled }], recs: [{ date, type, surah, from, to, pass }], set, today }
 *  يوم الاستئذان ويوم إيقاف الخطة بلا هدف، ولا يُحسب قبل انضمام الطالب ولا بعد اليوم */
function days(c, from, to) {
  const t = target(c.st, c.set); const end = to < c.today ? to : c.today; const j = c.st.joined || ''; const out = new Map();
  for (const s of c.sessions) {
    if (s.cancelled || s.date < from || s.date > end || (j && s.date < j)) continue;
    const v = (s.att || {})[c.st.id] || null; const d = out.get(s.date) || mk(s.date);
    d.lesson = true; if (v && (!d.att || ATT_RANK[v] > ATT_RANK[d.att])) d.att = v; out.set(s.date, d);
  }
  for (const d of out.values()) { d.off = d.att === 'e' || paused(c.st, d.date); d.tLines = d.off ? 0 : t.lines; d.tPages = d.off ? 0 : t.pages; }
  for (const r of c.recs) {
    if (r.date < from || r.date > to) continue;
    let d = out.get(r.date); if (!d) { d = mk(r.date); out.set(r.date, d); }
    if (r.pass === false) { d.bad++; continue; }
    if (r.type === 'new') { d.lines += recLines(r); d.newR.push(r); } else { d.pages += recPages(r); d.revR.push(r); }
  }
  return [...out.values()].sort((a, b) => a.date.localeCompare(b.date));
}
const pct = (d, t) => (t > 0 ? Math.round(d / t * 100) : null);
function sum(ds) {
  const o = { tLines: 0, lines: 0, tPages: 0, pages: 0, lessons: 0, att: 0, marked: 0, abs: 0 };
  ds.forEach(d => {
    o.tLines += d.tLines; o.lines += d.lines; o.tPages += d.tPages; o.pages += d.pages;
    if (d.lesson) { o.lessons++; if (d.att) { if (d.att !== 'e') o.marked++; if (d.att === 'p' || d.att === 'l') o.att++; if (d.att === 'a') o.abs++; } }
  });
  o.pL = pct(o.lines, o.tLines); o.pP = pct(o.pages, o.tPages); o.pA = o.marked ? Math.round(o.att / o.marked * 100) : null;
  return o;
}
/** نسبة واحدة للترتيب والمقارنة: متوسط نسبتي الحفظ والمراجعة المتوفرتين */
function score(o) { const xs = [o.pL, o.pP].filter(x => x != null); return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null; }

/** الفصل الدراسي (الدورة) اللي فيه التاريخ، وإلا آخر فصل بدأ قبله */
function termOf(set, date) {
  const ts = ((set && set.terms) || []).filter(t => t && t.from && t.to).slice().sort((a, b) => a.from.localeCompare(b.from));
  return ts.find(t => date >= t.from && date <= t.to) || ts.filter(t => t.from <= date).pop() || null;
}
/** أسابيع الفصل: الأسبوع يبدأ الأحد، والأول هو أسبوع بداية الفصل */
function weeks(set, date) {
  const term = termOf(set, date); if (!term) return null;
  const w1 = weekStart(term.from); const total = Math.max(1, Math.floor(daysBetween(w1, weekStart(term.to)) / 7) + 1);
  const n = Math.max(1, Math.min(total, Math.floor(daysBetween(w1, weekStart(date)) / 7) + 1));
  return { term, w1, total, n, start: k => addDays(w1, (k - 1) * 7) };
}

/** نص المقطع: «الملك 1–10» أو «النبأ 1 – عبس 20» حسب اتجاه الحفظ */
function rangeText(rs, dir) {
  if (!rs || !rs.length) return '';
  const fwd = dir === 'fwd';
  const it = rs.slice().sort((x, y) => (fwd ? x.surah - y.surah : y.surah - x.surah) || x.from - y.from);
  const a = it[0], z = it[it.length - 1];
  if (a.surah === z.surah) return SN[a.surah - 1] + ' ' + Math.min(...it.map(r => r.from)) + '–' + Math.max(...it.map(r => r.to));
  return SN[a.surah - 1] + ' ' + a.from + ' – ' + SN[z.surah - 1] + ' ' + z.to;
}

/** المحفوظ: الحفظ السابق في الخطة التلقائية + كل حفظ جديد نجح فيه */
function memorized(st, recs) {
  const m = new Uint8Array(TOTAL); const p = P(st);
  if (p.hafiz) { m.fill(1); return m; }
  if (p.mode === 'auto' && p.auto) {
    const a = p.auto; const o = ORD[a.dir === 'fwd' ? 'fwd' : 'bwd'];
    const s0 = Math.max(0, +a.memStart || 0), np = Math.min(TOTAL, +a.newPos || 0);
    for (let i = s0; i < np; i++) m[o[i]] = 1;
  }
  for (const r of recs || []) if (r.type === 'new' && r.pass !== false) { const b = SSTART[r.surah - 1]; for (let x = r.from; x <= r.to; x++) m[b + x - 1] = 1; }
  return m;
}
/** مقدار المحفوظ بالأوجه */
function memPages(m) { let w = 0; for (let i = 0; i < TOTAL; i++) if (m[i]) w += W[i]; return w; }
/** حالة كل سورة: 2 محفوظة كاملة، 1 بعضها، 0 لا */
function surahs(m) { return AYAS.map((n, s) => { let k = 0; for (let a = 0; a < n; a++) k += m[SSTART[s] + a]; return k === n ? 2 : k ? 1 : 0; }); }
/** رحلة الحفظ: كل سورة حفظ منها في المنصة، متى بدأها ومتى آخر مرة، وهل أتمّها */
function journey(st, recs, mem) {
  const by = new Map();
  (recs || []).filter(r => r.type === 'new' && r.pass !== false).slice().sort((a, b) => a.date.localeCompare(b.date)).forEach(r => {
    const o = by.get(r.surah) || { surah: r.surah, from: r.date, to: r.date }; o.to = r.date; by.set(r.surah, o);
  });
  const st2 = mem ? surahs(mem) : null;
  return [...by.values()].map(o => ({ ...o, days: daysBetween(o.from, o.to) + 1, done: st2 ? st2[o.surah - 1] === 2 : false })).sort((a, b) => a.from.localeCompare(b.from) || a.surah - b.surah);
}
/** السورة اللي يحفظ فيها الآن، ومن متى بدأها */
function current(st, recs) {
  if (hafiz(st)) return null;
  const p = P(st); let s = 0;
  if (p.mode === 'auto' && p.auto) { const np = +p.auto.newPos || 0; if (np < TOTAL) s = SUR[ORD[p.auto.dir === 'fwd' ? 'fwd' : 'bwd'][np]] + 1; }
  if (!s) {
    const last = (recs || []).filter(r => r.type === 'new').slice().sort((a, b) => b.date.localeCompare(a.date) || (b.at || 0) - (a.at || 0))[0];
    if (last) s = last.surah; else if (p.manual && p.manual.new && +p.manual.new.surah) s = +p.manual.new.surah;
  }
  if (!s) return null;
  const since = (recs || []).filter(r => r.type === 'new' && r.surah === s).map(r => r.date).sort()[0] || null;
  return { surah: s, since };
}
/** رقم بمنزلة عشرية واحدة بالكثير */
const n1 = x => { const r = Math.round((+x || 0) * 10) / 10; return String(r); };

G.ACH = { SN, AYAS, SSTART, TOTAL, setLines, setW, recPages, recLines, hafiz, target, days, sum, pct, score, termOf, weeks, rangeText, memorized, memPages, surahs, journey, current, addDays, weekStart, daysBetween, dow, n1 };
})(typeof window !== 'undefined' ? window : globalThis);
