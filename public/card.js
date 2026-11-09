/* سجل الطالب الخاص لولي الأمر: يُفتح بالرابط بدون اسم مستخدم ولا كلمة مرور.
   الحساب كله من public/ach.js، وهو نفس حساب تقارير الإنجاز في الموقع */
(function () {
'use strict';
const A = window.ACH;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DAYN = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const ATT = { p: 'حاضر', l: 'متأخر', a: 'غائب', e: 'مستأذن' };
const ATTF = { p: 'حاضرة', l: 'متأخرة', a: 'غائبة', e: 'مستأذنة' };
const ATTC = { p: 'ok', l: 'warn', a: 'bad', e: 'info' };
const fmtD = ds => { const d = new Date(ds + 'T00:00:00Z'); return DAYN[d.getUTCDay()] + ' ' + d.getUTCDate() + '/' + (d.getUTCMonth() + 1); };
let HF = null; try { HF = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) {}
const hij = ds => { try { return HF ? HF.format(new Date(ds + 'T12:00:00Z')) : ''; } catch (e) { return ''; } };
const pctC = p => p == null ? '<span class="mut">—</span>' : `<b class="pc ${p >= 100 ? 'ok' : p >= 70 ? 'warn' : 'bad'}">${p}٪</b>`;
const of = (d, t) => t > 0 ? `${A.n1(d)} / ${A.n1(t)}` : d > 0 ? A.n1(d) : '—';
const tok = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || '');
let D = null; const ST = { v: 'rec', ws: '' };
const daysW = n => n === 1 ? 'يوم واحد' : n === 2 ? 'يومان' : n + ' ' + (n <= 10 ? 'أيام' : 'يومًا');
const T = (m, f) => (D && D.fem ? f : m);

async function boot() {
  try {
    const [r, pg] = await Promise.all([
      fetch('/api/card?t=' + encodeURIComponent(tok), { cache: 'no-store' }),
      fetch('/api/pages').then(x => (x.ok ? x.json() : null)).catch(() => null),
    ]);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'تعذّر فتح السجل، حاول مرة أخرى.');
    if (pg && pg.lines) A.setLines(pg.lines);
    D = j;
    if (D.fem) document.documentElement.setAttribute('data-fem', '');
    document.title = 'سجل ' + D.name + ' · ' + D.center;
    render();
  } catch (e) {
    $('#app').innerHTML = `<div class="box err"><b>تعذّر فتح السجل</b><span>${esc(e.message)}</span></div>`;
  }
}
const ctx = () => ({ st: { id: D.id, plan: D.plan, joined: D.joined }, sessions: D.sessions, recs: D.recs, set: D.set, today: D.today });
/** بداية الحساب التراكمي: بداية الفصل الحالي، أو انضمام الطالب إن كان بعده */
function cumFrom() { const w = A.weeks(D.set, D.today); const f = w ? w.term.from : ''; return f && f > D.joined ? f : D.joined || f || A.addDays(D.today, -29); }

function card(label, d, t, p) { return `<div class="kc"><span>${label}</span><div><b class="num">${of(d, t)}</b>${pctC(p)}</div></div>`; }
function recV() {
  const c = ctx(); const t = A.target(c.st, D.set);
  const cw = A.weekStart(D.today); const ws = ST.ws && ST.ws <= cw ? ST.ws : cw; const we = A.addDays(ws, 6);
  const wt = A.weeks(D.set, D.today);
  const inT = wt && ws >= wt.w1 && ws <= wt.start(wt.total);
  const n = inT ? A.daysBetween(wt.w1, ws) / 7 + 1 : null;
  const nowN = wt ? Math.min(wt.total, A.daysBetween(wt.w1, cw) / 7 + 1) : 0;
  const ds = A.days(c, ws, we); const o = A.sum(ds);
  const cum = A.sum(A.days(c, cumFrom(), D.today));
  const weeksBar = wt && nowN >= 1 ? `<div class="wks" role="tablist" aria-label="أسابيع ${esc(wt.term.name)}">${[...Array(nowN).keys()].map(i => i + 1).map(k => `<button class="${k === n ? 'on' : ''}" data-ws="${wt.start(k)}" aria-label="الأسبوع ${k}">${k}</button>`).join('')}</div>` : '';
  const nav = `<div class="wk-nav"><button data-ws="${A.addDays(ws, -7)}" aria-label="الأسبوع السابق">→ السابق</button><b>${n ? 'الأسبوع ' + n + ' من ' + esc(wt.term.name) : fmtD(ws) + ' – ' + fmtD(we)}</b><button data-ws="${A.addDays(ws, 7)}" ${ws >= cw ? 'disabled' : ''} aria-label="الأسبوع التالي">التالي ←</button></div>`;
  const goals = `<div class="goals">${t.hafiz ? `<span class="g gold">${T('حافظ للقرآن', 'حافظة للقرآن')}</span>` : `<span class="g">هدف الحفظ اليومي <b>${A.n1(t.lines)}</b> ${t.lines > 0 && t.lines <= 10 ? 'أسطر' : 'سطر'}</span>`}<span class="g">هدف المراجعة اليومي <b>${A.n1(t.pages)}</b> ${t.pages > 0 && t.pages <= 10 ? 'أوجه' : 'وجه'}</span></div>`;
  const dir = (D.plan.auto || {}).dir;
  const row = d => `<tr><td><b>${fmtD(d.date)}</b></td><td>${d.lesson ? (d.att ? `<span class="chip ${ATTC[d.att]}">${(D.fem ? ATTF : ATT)[d.att]}</span>` : '<span class="mut">لم يُحضَّر</span>') : '<span class="mut">خارج الحصة</span>'}</td>
    <td class="rng">${esc(A.rangeText(d.revR, dir)) || '—'}</td><td class="num">${of(d.pages, d.tPages)}</td><td class="num">${pctC(A.pct(d.pages, d.tPages))}</td>
    ${t.hafiz ? '' : `<td class="rng">${esc(A.rangeText(d.newR, dir)) || '—'}</td><td class="num">${of(d.lines, d.tLines)}</td><td class="num">${pctC(A.pct(d.lines, d.tLines))}</td>`}</tr>`;
  return `${weeksBar}${nav}${goals}
  <section class="box">${ds.length ? `<div class="tw"><table><thead><tr><th>اليوم</th><th>الحضور</th><th>المراجعة</th><th class="num">الأوجه</th><th class="num">الإنجاز</th>${t.hafiz ? '' : '<th>الحفظ</th><th class="num">الأسطر</th><th class="num">الإنجاز</th>'}</tr></thead><tbody>${ds.map(row).join('')}</tbody></table></div>` : '<div class="empty">لا توجد حصص ولا تسميع في هذا الأسبوع.</div>'}</section>
  <div class="kcs">${card('مراجعة الأسبوع (أوجه)', o.pages, o.tPages, o.pP)}${t.hafiz ? '' : card('حفظ الأسبوع (أسطر)', o.lines, o.tLines, o.pL)}${card('حضور الأسبوع', o.att, o.marked, o.pA)}
  ${card('المعدل التراكمي للمراجعة', cum.pages, cum.tPages, cum.pP)}${t.hafiz ? '' : card('المعدل التراكمي للحفظ', cum.lines, cum.tLines, cum.pL)}${card('الحضور التراكمي', cum.att, cum.marked, cum.pA)}</div>
  <p class="note">التراكمي منذ ${fmtD(cumFrom())}. الحفظ يُقاس بالأسطر، والمراجعة بالأوجه (الوجه ١٥ سطرًا)، ولا يُحتسب إلا ما اجتازه ${T('الطالب', 'الطالبة')}.</p>`;
}
function surV() {
  const c = ctx(); const mem = A.memorized(c.st, D.recs); const ss = A.surahs(mem);
  const full = ss.filter(x => x === 2).length, part = ss.filter(x => x === 1).length;
  return `<div class="kcs three"><div class="kc"><span>سور محفوظة كاملة</span><div><b class="num">${full}</b></div></div><div class="kc"><span>سور ${T('حفظ', 'حفظت')} بعضها</span><div><b class="num">${part}</b></div></div><div class="kc"><span>المحفوظ تقريبًا</span><div><b class="num">${Math.round(A.memPages(mem))}</b><span class="mut">وجه</span></div></div></div>
  <div class="legend"><span><i class="s2"></i>محفوظة</span><span><i class="s1"></i>بعضها</span><span><i class="s0"></i>لم تُحفظ بعد</span></div>
  <section class="sgrid">${A.SN.map((nm, i) => `<div class="sr s${ss[i]}"><small>${i + 1}</small><span>${esc(nm)}</span></div>`).join('')}</section>`;
}
function mapV() {
  const c = ctx(); const mem = A.memorized(c.st, D.recs);
  const j = A.journey(c.st, D.recs, mem); const cur = A.current(c.st, D.recs);
  const curH = cur ? `<div class="now"><span>${T('يحفظ الآن', 'تحفظ الآن')}</span><b class="q">سورة ${esc(A.SN[cur.surah - 1])}</b>${cur.since ? `<span>منذ ${daysW(A.daysBetween(cur.since, D.today) + 1)}</span>` : ''}</div>` : A.hafiz(c.st) ? `<div class="now"><b class="q">${T('حافظ لكتاب الله', 'حافظة لكتاب الله')}</b><span>نسأل الله أن يجعله حجة ${T('له', 'لها')}</span></div>` : '';
  return `${curH}<section class="box">${j.length ? `<ol class="tl">${j.slice().reverse().map(x => `<li class="${x.done ? 'done' : ''}"><i></i><div><b class="q">${esc(A.SN[x.surah - 1])}</b><span>${x.from === x.to ? fmtD(x.from) : fmtD(x.from) + ' ← ' + fmtD(x.to)} · ${daysW(x.days)}</span></div>${x.done ? '<span class="chip ok">أتمّها</span>' : '<span class="chip">بعضها</span>'}</li>`).join('')}</ol>` : '<div class="empty">لم يُسجَّل حفظ جديد في المنصة بعد.</div>'}</section>
  <p class="note">رحلة الحفظ في المنصة: كل سورة ${T('حفظ', 'حفظت')} منها، من أول تسميع لها إلى آخر تسميع.</p>`;
}
function render() {
  const tabs = [['rec', 'سجل الإنجاز'], ['sur', 'إنجاز السور'], ['map', 'رحلة الحفظ']];
  $('#app').innerHTML = `<header class="hd"><div class="hd-in"><span class="eyebrow">${esc(D.center)}</span><h1>سجل إنجاز ${T('الطالب', 'الطالبة')}</h1><div class="who"><b>${esc(D.name)}</b>${D.halqa ? `<span>${esc(D.halqa)}</span>` : ''}</div><div class="date">${fmtD(D.today)}${hij(D.today) ? ' · ' + hij(D.today) : ''}</div></div></header>
  <nav class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" aria-selected="${ST.v === k}" class="${ST.v === k ? 'on' : ''}" data-v="${k}">${l}</button>`).join('')}</nav>
  <main class="wrap">${ST.v === 'sur' ? surV() : ST.v === 'map' ? mapV() : recV()}</main>
  <footer class="ft">هذا الرابط خاص ${T('بالطالب', 'بالطالبة')}، فلا تشاركه إلا مع من تثق به.</footer>`;
}
document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled || !D) return;
  if (b.dataset.v) { ST.v = b.dataset.v; render(); window.scrollTo(0, 0); }
  else if (b.dataset.ws) { ST.ws = b.dataset.ws; render(); }
});
boot();
})();
