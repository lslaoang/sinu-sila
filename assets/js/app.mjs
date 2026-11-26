import { ALLTR, CHECKED } from './case-status.mjs';
import { casesPage, updateCases } from './cases.mjs';
import { data, loadRecords } from './data.mjs';
import { buildGroups, housePage, initSeatTooltip, plPage, senPage, updateAll, updateHouse } from './directory.mjs';
import { explore } from './explore.mjs';
import { dropPlace, home, homeOut, selectPlace } from './home.mjs';
import { guidePage, newsPage, prose } from './information.mjs';
import { loadTerms } from './legislation.mjs';
import { initLanguage, lang, t } from './locale.mjs';
import { profile, selectBillTerm } from './profile.mjs';
import { initReportForm } from './report.mjs';
import { findPerson } from './roster.mjs';
import { closeSearch, initSearch, takeHomeSearchFocus } from './search.mjs';
import { hashName, state } from './state.mjs';
import { clean } from './text.mjs';
import { app, q, tip } from './ui.mjs';

const PAGES = {'': home, explore, senado: senPage, kamara: housePage, 'party-list': plPage, 'mga-kaso': casesPage, gabay: guidePage, bago: newsPage};
/* each directory keeps its own filters and sort: switching chambers starts fresh, coming back (or Back) restores them */
const DIRS = ['senado', 'kamara', 'party-list', 'explore'], DIR_KEYS = ['sel', 'rank', 'rdir', 'rterm', 'hpl', 'hp', 'hs', 'ss', 'ps', 'school', 'leaders', 'sort', 'ch'];
const dirDefaults = () => ({sel: 'everyone', tr: new Set(ALLTR), rank: '', rdir: 'desc', rterm: 20, hpl: null, hp: null, hs: '', ss: '', ps: '', school: null, leaders: false, sort: 'az', ch: 'all'});
const dirSaved = {}; let dirNow = null, pendingCase = '';
function notFound() { prose(t('nfH'), 'Sino Sila?', `<p class="lede">${t('nfP')}</p><p><a href="#">${t('back')}</a></p>`); }
document.addEventListener('click', e => { const a = e.target.closest?.('a[data-case]'); if (a) pendingCase = a.dataset.case; }, true);
function route(e) {
  const h = hashName(), o = findPerson(h);
  tip.classList.remove('on'); closeSearch();
  const page = o ? null : PAGES[h] || (h ? notFound : home);
  const key = o ? null : h;
  if (DIRS.includes(dirNow)) dirSaved[dirNow] = Object.fromEntries([...DIR_KEYS.map(k => [k, state[k]]), ['tr', new Set(state.tr)]]);
  if (DIRS.includes(key) && key !== dirNow) Object.assign(state, dirSaved[key] ? {...dirSaved[key], tr: new Set(dirSaved[key].tr)} : dirDefaults());
  dirNow = key;
  o ? profile(o) : page();
  document.body.classList.toggle('home', page === home);
  const sec = o ? (o.body === 'house' ? (o.kind === 'party-list' ? 'party-list' : 'kamara') : 'senado') : h;
  document.querySelectorAll('.nav a.lnk').forEach(a => a.getAttribute('href') === '#' + sec ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
  document.title = o ? clean(o.name) + ' – Sino Sila?' : page === home ? t('title') : `${app.querySelector('h1')?.textContent || ''} – Sino Sila?`;
  app.removeAttribute('aria-busy'); scrollTo({top: 0, behavior: 'instant'});
  const focusHomeSearch = takeHomeSearchFocus();
  if (e?.type === 'hashchange') focusTarget(page === home && focusHomeSearch ? document.getElementById('hq') : app.querySelector('h1'));
  if (o && pendingCase) { const c = document.getElementById('case-' + pendingCase); if (c) { focusTarget(c); c.scrollIntoView({block: 'start', behavior: 'instant'}); } }   // from the cases list: land on that case's timeline
  pendingCase = '';
  count(o ? 'p:' + o.id : h || 'home');
}

/* visit counter: daily totals only (tools/stats_lambda). No cookies, no IDs; "first page of this tab" is a sessionStorage flag. */
function count(page) {
  if (!/(^|\.)sinu-sila\.com$/.test(location.hostname) || location.pathname.includes('/staging/') || !navigator.sendBeacon) return;
  let first = false; try { first = !sessionStorage.getItem('ss-v'); sessionStorage.setItem('ss-v', '1'); } catch {}
  try { navigator.sendBeacon('/e', JSON.stringify({p: page.slice(0, 60), r: first ? document.referrer : '', n: first ? 1 : 0, l: lang})); } catch {}
}
function focusTarget(el) {
  if (!el) return;
  if (!el.matches('input')) el.tabIndex = -1;
  el.focus({preventScroll: true});
}
function jumpTo(id) {
  const el = document.getElementById(id);
  focusTarget(el); el?.scrollIntoView();
}
document.querySelector('.skip').onclick = e => { e.preventDefault(); jumpTo('app'); };

app.onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  const d = b.dataset;
  if (d.f === 'retry') return load();
  if (d.jump) return jumpTo(d.jump);
  if (d.f === 'hclear') { Object.assign(state, {hs: '', hpl: null, hp: null, sel: 'everyone', tr: new Set(ALLTR)}); housePage(); return document.getElementById('hs')?.focus(); }
  if (d.try != null) { const hq = document.getElementById('hq'); hq.value = q.value = state.q = d.try; dropPlace(); hq.focus(); return homeOut(); }
  if (d.f === 'share') { const url = location.href, ti = document.title;
    if (navigator.share) navigator.share({title: ti, url}).catch(() => {}); else navigator.clipboard?.writeText(url).then(() => { b.textContent = t('copied'); setTimeout(() => b.textContent = t('share'), 2000); }); return; }
  if (d.go) { if (state.ch !== 'all') { state.ch = 'all'; updateAll(); } jumpTo(d.go); return; }
  if (d.lens) state.lens = d.lens;
  if (d.ch) state.ch = d.ch;
  if (d.tr) { state.sel = state.sel === d.tr ? 'everyone' : d.tr; state.tr = new Set(state.sel === 'everyone' ? ALLTR : state.sel === 'checked' ? CHECKED : [state.sel]); }
  if (d.school) state.school = state.school === d.school ? null : d.school;
  if (d.sort) state.sort = d.sort;
  if (d.f === 'csreset') { Object.assign(state, {cq: '', cch: '', cst: '', cg: ''}); casesPage(); return document.getElementById('cq')?.focus(); }
  if (d.cst != null) { state.cst = d.cst; return updateCases(); }
  if (d.cg != null) { state.cg = d.cg; return updateCases(); }
  if (d.sbterm != null) return selectBillTerm(+d.sbterm);
  if (d.rank != null) { if (d.rank && d.rank === state.rank) state.rdir = state.rdir === 'asc' ? 'desc' : 'asc'; else { state.rank = d.rank; state.rdir = 'desc'; }
    document.querySelectorAll('.rdir').forEach(x => x.hidden = !state.rank); }
  if (d.rdir != null) state.rdir = state.rdir === 'asc' ? 'desc' : 'asc';
  document.querySelectorAll('.rdir').forEach(x => x.textContent = state.rdir === 'asc' ? '↑ ' + t('rkFewest') : '↓ ' + t('rkMost'));
  if (d.lead != null) state.leaders = d.lead === '1';
  const rankFocused = b.closest('.rhead') && b === document.activeElement;
  updateAll();
  if (rankFocused) app.querySelector(`.rhead [data-rank="${d.rank}"]`)?.focus();
};
app.onchange = e => { const v = e.target.value;
  if (e.target.id === 'placeSel') { selectPlace(v);   // picking a place replaces any typed search
    state.q = q.value = ''; const hq = document.getElementById('hq'); if (hq) hq.value = ''; return homeOut(); }
  if (e.target.id === 'cchSel') { state.cch = v; return updateCases(); }
  if (e.target.id === 'rtSel') { state.rterm = +v; if (!state.rank) state.rank = 'filed'; document.querySelectorAll('.rdir').forEach(x => x.hidden = false);
    return loadTerms().then(() => { document.querySelectorAll('[data-rank]').forEach(b => b.setAttribute('aria-pressed', b.dataset.rank === state.rank)); updateAll(); }); }
  if (e.target.id === 'hplSel') { state.hpl = e.target.value || null; updateAll(); } if (e.target.id === 'hpSel') { state.hp = e.target.value || null; updateAll(); } };

app.oninput = e => { if (e.target.id === 'hq') { state.q = q.value = e.target.value; if (state.q.trim()) dropPlace(); homeOut(); } if (e.target.id === 'hs') { state.hs = e.target.value; updateHouse(); }
  if (e.target.id === 'ss' || e.target.id === 'ps') { state[e.target.id] = e.target.value; updateAll(); }
  if (e.target.id === 'cq') { state.cq = e.target.value; updateCases(); } };
(() => { const t = document.getElementById('top'); if (!t) return; addEventListener('scroll', () => { t.hidden = scrollY < 1500; }, {passive: true}); t.onclick = () => { document.querySelector('.brand').focus({preventScroll: true}); scrollTo({top: 0}); }; })();

async function load() {
  try {
    await loadRecords();
    buildGroups();
    route();
  } catch {
    app.removeAttribute('aria-busy');
    app.innerHTML = '<div class="err" role="alert"><b>Couldn’t load the records.</b><p>Check your connection and try again.</p><button class="chip" data-f="retry">Retry</button></div>';
  }
}

initReportForm();
initSeatTooltip();
initSearch(updateAll);
initLanguage(() => { if (data.length) route(); });
window.addEventListener('hashchange', route);
load();
