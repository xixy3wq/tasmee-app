/* شاشة الجامع: تعرض نتائج اليوم لكل حلقة مباشرة بعد تسجيل التسميع، وتتحدّث لحالها كل نصف دقيقة.
   الحساب من public/ach.js، وهو نفس حساب تقارير الإنجاز في الموقع */
(function () {
'use strict';
const A = window.ACH;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DAYN = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const GK = { 'ممتاز': 'ok', 'جيد جدًا': 'acc', 'جيد': 'warn', 'يعاد': 'bad' };
const TYPE = { new: 'حفظ', review: 'مراجعة', tath: 'تثبيت' };
const q = new URLSearchParams(location.search);
const API = '/api/screen?k=' + encodeURIComponent(q.get('k') || '') + '&side=' + (q.get('side') === 'f' ? 'f' : 'm') + '&b=' + encodeURIComponent(q.get('b') || '*');
let HF = null; try { HF = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) {}
const hij = ds => { try { return HF ? HF.format(new Date(ds + 'T12:00:00Z')) : ''; } catch (e) { return ''; } };
const fmtD = ds => { const d = new Date(ds + 'T00:00:00Z'); return DAYN[d.getUTCDay()] + ' ' + d.getUTCDate() + '/' + (d.getUTCMonth() + 1); };
const pad = n => String(n).padStart(2, '0');
const clockTxt = () => { const d = new Date(); let h = d.getHours(); const ap = h < 12 ? 'ص' : 'م'; h = h % 12 || 12; return h + ':' + pad(d.getMinutes()) + ' ' + ap; };
const bar = (p, cls) => `<div class="bar ${cls || ''}"><i style="width:${Math.max(0, Math.min(100, p || 0))}%"></i></div>`;
const pctT = p => (p == null ? '—' : p + '٪');
let D = null, OFF = false, SEEN = null, FRESH = new Set(), LINES = false; const BOOT = Date.now();

async function load() {
  try {
    if (!LINES) { const pg = await fetch('/api/pages').then(x => (x.ok ? x.json() : null)).catch(() => null); if (pg && pg.lines) { A.setLines(pg.lines); LINES = true; } }
    const r = await fetch(API, { cache: 'no-store' }); const j = await r.json().catch(() => ({}));
    if (!r.ok) { if (r.status === 404) { $('#app').innerHTML = `<div class="box err big"><b>تعذّر فتح الشاشة</b><span>${esc(j.error || '')}</span></div>`; return; } throw new Error('net'); }
    // التسميع الجديد منذ آخر تحديث يتلوّن لحظة
    const keys = new Set(j.recs.map(r => r.uid + '_' + r.at));
    FRESH = SEEN ? new Set([...keys].filter(k => !SEEN.has(k))) : new Set(); SEEN = keys;
    D = j; OFF = false;
    if (D.side === 'f') document.documentElement.setAttribute('data-fem', ''); else document.documentElement.removeAttribute('data-fem');
    render();
  } catch (e) { OFF = true; if (D) render(); else $('#app').innerHTML = '<p class="boot">تعذّر الاتصال، تُعاد المحاولة…</p>'; }
}
function compute() {
  const set = D.set; const t = D.today; const wk = A.weekStart(t);
  const byH = {}; D.sessions.forEach(s => (byH[s.halqaId] = byH[s.halqaId] || []).push(s));
  const byU = {}; D.recs.forEach(r => (byU[r.uid] = byU[r.uid] || []).push(r));
  return D.halaqat.map(h => {
    const studs = D.students.filter(s => s.halqaId === h.id);
    const ss = byH[h.id] || []; const todayL = ss.filter(s => s.date === t && !s.cancelled);
    const rows = studs.map(st => {
      const c = { st: { id: st.id, plan: st.plan, joined: st.joined }, sessions: ss, recs: byU[st.id] || [], set, today: t };
      const d = A.sum(A.days(c, t, t)); const w = A.sum(A.days(c, wk, t));
      const rs = (byU[st.id] || []).filter(r => r.date === t).sort((a, b) => b.at - a.at);
      return { st, d, w, rs, last: rs[0] || null, hz: A.target(c.st, set).hafiz };
    });
    const sumOf = k => rows.reduce((o, r) => { const x = r[k]; o.tLines += x.tLines; o.lines += x.lines; o.tPages += x.tPages; o.pages += x.pages; o.att += x.att; o.marked += x.marked; return o; }, { tLines: 0, lines: 0, tPages: 0, pages: 0, att: 0, marked: 0 });
    const td = sumOf('d'), tw = sumOf('w');
    const pct = o => ({ pL: A.pct(o.lines, o.tLines), pP: A.pct(o.pages, o.tPages), pA: o.marked ? Math.round(o.att / o.marked * 100) : null });
    const pd = pct(td), pw = pct(tw);
    return { h, rows, today: todayL.length > 0, time: (todayL[0] || {}).time || '', td, pd, sd: A.score(pd), pw, sw: A.score(pw), recited: rows.filter(r => r.rs.length).length, n: rows.length };
  });
}
function render() {
  const t = D.today; const H = compute();
  const live = H.filter(x => x.today).sort((a, b) => (b.sd ?? -1) - (a.sd ?? -1) || b.recited - a.recited);
  const week = H.filter(x => x.sw != null).sort((a, b) => b.sw - a.sw);
  const feed = D.recs.filter(r => r.date === t).sort((a, b) => b.at - a.at).slice(0, 8);
  const stu = id => D.students.find(s => s.id === id) || {};
  const hn = id => (D.halaqat.find(h => h.id === id) || {}).name || '';
  const fem = D.side === 'f';
  $('#app').innerHTML = `<div class="scr">
  <header class="s-hd"><div><span class="eyebrow">${esc(D.center)}${D.branch ? ' · ' + esc(D.branch) : ''}</span><h1>نتائج ${fem ? 'الطالبات' : 'الطلاب'} اليوم</h1></div>
    <div class="s-time"><b>${clockTxt()}</b><span>${fmtD(t)}${hij(t) ? ' · ' + hij(t) : ''}</span>${OFF ? '<span class="off">انقطع الاتصال، تُعاد المحاولة…</span>' : ''}</div></header>
  <div class="s-body">
    <section class="s-main">${live.length ? live.map((x, i) => circle(x, i + 1)).join('') : `<div class="box empty big">لا توجد حلقات اليوم.${week.length ? ' وهذا ترتيب الحلقات في هذا الأسبوع.' : ''}</div>`}</section>
    <aside class="s-side">
      <section class="box"><h2>آخر التسميع</h2>${feed.length ? `<ul class="feed">${feed.map(r => `<li class="${FRESH.has(r.uid + '_' + r.at) ? 'new' : ''}"><div><b>${esc(stu(r.uid).n || '')}</b><span>${esc(hn(stu(r.uid).halqaId))} · ${TYPE[r.type] || ''} ${esc(A.SN[r.surah - 1])} ${r.from}–${r.to}</span></div><span class="chip ${GK[r.grade] || ''}">${esc(r.grade)}</span></li>`).join('')}</ul>` : '<div class="empty">لم يُسجَّل تسميع بعد.</div>'}</section>
      ${week.length ? `<section class="box"><h2>ترتيب الحلقات هذا الأسبوع</h2><ol class="rank">${week.map((x, i) => `<li><span class="r${i < 3 ? i + 1 : ''}">${i + 1}</span><b>${esc(x.h.name)}</b><em>${x.sw}٪</em></li>`).join('')}</ol><p class="mut small">متوسط نسبتي إنجاز الحفظ والمراجعة من الهدف.</p></section>` : ''}
    </aside>
  </div></div>`;
}
function circle(x, rank) {
  const done = x.rows.filter(r => r.rs.length).sort((a, b) => b.last.at - a.last.at);
  const wait = x.rows.filter(r => !r.rs.length && x.today).length;
  return `<article class="box circ"><div class="c-hd"><span class="rk r${rank <= 3 ? rank : ''}">${rank}</span><div class="grow"><h2>${esc(x.h.name)}</h2><span class="mut">${x.h.teacher ? esc(x.h.teacher) + ' · ' : ''}${x.td.att} من ${x.n} حضورًا</span></div><b class="sc">${pctT(x.sd)}</b></div>
    <div class="c-bars"><div><span>الحفظ</span>${bar(x.pd.pL)}<em>${pctT(x.pd.pL)}</em></div><div><span>المراجعة</span>${bar(x.pd.pP, 'b2')}<em>${pctT(x.pd.pP)}</em></div></div>
    ${done.length ? `<ul class="c-list">${done.map(r => `<li class="${r.rs.some(z => FRESH.has(r.st.id + '_' + z.at)) ? 'new' : ''}"><b>${esc(r.st.n)}</b><span class="mut">${r.hz ? '' : r.d.lines ? A.n1(r.d.lines) + ' سطر' : ''}${!r.hz && r.d.lines && r.d.pages ? ' · ' : ''}${r.d.pages ? A.n1(r.d.pages) + ' وجه' : ''}</span><span class="chip ${GK[r.last.grade] || ''}">${esc(r.last.grade)}</span></li>`).join('')}</ul>` : '<div class="mut small">لم يُسمِّع أحد بعد.</div>'}
    ${wait ? `<div class="mut small">${wait} ${D.side === 'f' ? 'لم يُسمِّعن' : 'لم يُسمِّعوا'} بعد</div>` : ''}</article>`;
}
load(); setInterval(load, 30000);
setInterval(() => { const c = document.querySelector('.s-time b'); if (c) c.textContent = clockTxt(); }, 15000);
// الشاشة تبقى شغالة: يُعاد تحميل الصفحة مرة يوميًا بعد منتصف الليل لتحديث النسخة
setInterval(() => { if (new Date().getHours() === 0 && Date.now() - BOOT > 3600000) location.reload(); }, 600000);
})();
