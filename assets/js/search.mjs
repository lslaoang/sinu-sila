import { t } from './locale.mjs';
import { everyone, findAll, fold, places } from './roster.mjs';
import { onExplore, onHome, state } from './state.mjs';
import { clean, esc } from './text.mjs';
import { av, ico, q, sub } from './ui.mjs';

/* header search: a live list on every page; Enter opens the one match, else all results on the home page */
const qd = document.getElementById('qd'), qEmpty = document.getElementById('qEmpty'), qStatus = document.getElementById('qStatus'); let qi = -1, qopts = [], qn = 0, qToHome = false;
const pin = ico('pin');
function closeSearch() {
  if (qi >= 0) qopts[qi]?.setAttribute('aria-selected', 'false');
  qd.hidden = qEmpty.hidden = true; qi = -1; qStatus.textContent = ''; q.setAttribute('aria-expanded', 'false'); q.removeAttribute('aria-activedescendant'); }
function drawSearch() {
  const v = q.value.trim(); if (!v || onHome() || onExplore()) return closeSearch();
  const hits = findAll(everyone(), v), pl = places().filter(p => fold(p).includes(fold(v))).slice(0, 3); qn = hits.length + pl.length;
  const grp = (h, xs) => xs.length ? `<div role="group" aria-label="${esc(h)}"><div class="qh" aria-hidden="true">${esc(h)}</div>${xs.join('')}</div>` : '';
  const row = o => `<div role="option" aria-selected="false" class="qo" data-href="#${esc(o.id)}">${av(o.name, o.photo)}<span><b>${esc(clean(o.name))}</b><small>${esc(sub(o))}</small></span></div>`;
  const sen = hits.filter(o => o.body !== 'house').slice(0, 4), hd = hits.filter(o => o.body === 'house' && o.kind !== 'party-list').slice(0, 4), pls = hits.filter(o => o.kind === 'party-list').slice(0, 3);
  qd.innerHTML = grp(t('qPlaces'), pl.map(p => `<div role="option" aria-selected="false" class="qo" data-place="${esc(p)}"><span class="qp" aria-hidden="true">${pin}</span><span><b>${esc(p)}</b><small>${esc(t('qPlaceS'))}</small></span></div>`))
    + grp(t('bSen'), sen.map(row))
    + grp(t('bHouse'), hd.map(row))
    + grp(t('bPL'), pls.map(row))
    + (hits.length > sen.length + hd.length + pls.length ? `<div role="option" aria-selected="false" class="qo qall" data-all>${t('qAll', hits.length)}</div>` : '');
  qopts = [...qd.querySelectorAll('.qo')]; qopts.forEach((e, i) => e.id = 'qo' + i); qi = -1;
  q.removeAttribute('aria-activedescendant');
  qd.hidden = !qopts.length; q.setAttribute('aria-expanded', !qd.hidden);
  qEmpty.hidden = !!qopts.length; qEmpty.textContent = qStatus.textContent = qopts.length ? '' : t('qNone');
}
function pickSearchResult(el) {
  if (!el) return; const d = el.dataset;
  if (d.href) { q.value = state.q = ''; closeSearch(); location.hash = d.href; return; }
  if (d.place) q.value = d.place;
  state.q = q.value.trim(); qToHome = true; closeSearch(); location.hash = '';
}

function takeHomeSearchFocus() {
  const shouldFocus = qToHome;
  qToHome = false;
  return shouldFocus;
}

function initSearch(onExploreInput) {
  q.oninput = () => { state.q = q.value; if (onExplore()) return onExploreInput(); drawSearch(); };
  q.onfocus = drawSearch;
  q.onblur = closeSearch;
  q.onkeydown = e => {
    if (e.isComposing) return;
    if (e.key === 'Escape' && (!qd.hidden || !qEmpty.hidden)) { e.preventDefault(); closeSearch(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (qd.hidden) drawSearch();
      if (qd.hidden) return;
    } else if (qd.hidden) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault();
      qi = (qi + (e.key === 'ArrowDown' ? 1 : qopts.length - 1 + (qi < 0 ? 1 : 0))) % qopts.length;
      qopts.forEach((o, i) => o.setAttribute('aria-selected', i === qi)); q.setAttribute('aria-activedescendant', qopts[qi].id); const item = qopts[qi].getBoundingClientRect(), box = qd.getBoundingClientRect();
      if (item.bottom > box.bottom) qd.scrollTop += item.bottom - box.bottom + 4;
      if (item.top < box.top) qd.scrollTop += item.top - box.top - 4; }
    if (e.key === 'Enter') { e.preventDefault(); pickSearchResult(qopts[qi] || (qn === 1 ? qopts[0] : qd.querySelector('[data-all]') || qopts[0])); }
  };
  qd.onmousedown = e => { if (e.target.closest('.qo')) e.preventDefault(); };   // keep focus in the box so the click lands
  qd.onclick = e => pickSearchResult(e.target.closest('.qo'));
  addEventListener('keydown', e => { if (e.code !== 'Slash' || !e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) return;
    if (document.getElementById('rep').open) return;
    e.preventDefault(); (onHome() ? document.getElementById('hq') : q)?.focus(); });
}

export { closeSearch, initSearch, takeHomeSearchFocus };
