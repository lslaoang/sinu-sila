import { TRACKS, trackLabel, trackOf, trackRank } from './case-status.mjs';
import { data, edu, hb, house } from './data.mjs';
import { billCount, lawCount, rec, termRec } from './legislation.mjs';
import { fmtDay, t } from './locale.mjs';
import { districts, everyone, isLead, lastName, matches, nameOf, partylist, places, posRank } from './roster.mjs';
import { hashName, onExplore, onHome, state } from './state.mjs';
import { clean, esc } from './text.mjs';
import { app, av, distBar, distLabel, ico, initials, opt, pv, tip, tkHtml, trChips } from './ui.mjs';

const RANKS = [['', 'rkName'], ['filed', 'rkFiled'], ['passed', 'rkPassed'], ['law', 'rkLaw']];
const rankBar = ch => `<div class="rankbar"><p class="pl" id="rkL">${t('rkL')}</p><div class="seg seg4" role="group" aria-labelledby="rkL">${RANKS.map(([k, l]) => `<button data-rank="${k}" aria-pressed="${state.rank === k}">${t(l, ch)}</button>`).join('')}</div><button type="button" class="rdir" data-rdir title="${esc(t('rkDirAl'))}" ${state.rank ? '' : 'hidden'}>${state.rdir === 'asc' ? '↑ ' + t('rkFewest') : '↓ ' + t('rkMost')}</button>
  <label class="rterm"><span>${t('rkTerm')}</span><select id="rtSel">${[20, 19, 18, 17, 16, 15, 14, 13].map(c => opt(c, t('sbCong', c) + (c === 20 ? ` (${t('cNow')})` : ''), state.rterm === c)).join('')}</select></label>
  <p class="note">${t('rkVol')}</p><details class="more rhow"><summary>${t('rkHow')}</summary><p class="note">${ch === 'senate' ? t('rkNoteS') : t('rkNoteH', fmtDay(hb._meta.discovered_as_of || hb._meta.retrieved || ''))}</p></details></div>`;
const ranked = pool => { const k = state.rank, d = state.rdir === 'asc' ? -1 : 1;
  return pool.map(o => [o, state.rterm < 20 ? termRec(o) : rec(o)]).filter(([, r]) => r).sort((a, b) => d * (b[1][k] - a[1][k]) || lastName(a[0]).localeCompare(lastName(b[0]))); };
const rkCol = (k, ch) => ({filed: t('rkFiled'), passed: t('rkPassed', ch).replace(/<[^>]+>/g, ''), law: t('rkLaw')})[k];
const rankList = (rows, ch) => { if (!rows.length) return '';
  const k = state.rank, max = Math.max(...rows.map(([, r]) => r[k]), 1), arrow = state.rdir === 'asc' ? ' ↑' : ' ↓';
  return `<li class="rhead"><span></span><span></span><span>${t('rkWho')}</span><span class="rvs">${RANKS.slice(1).map(([c]) => `<button type="button" class="rkv${c === k ? ' on' : ''}" data-rank="${c}" aria-pressed="${c === k}">${esc(rkCol(c, ch))}<span aria-hidden="true">${c === k ? arrow : ''}</span></button>`).join('')}</span></li>`
    + rows.map(([o, r], i) => { const n = 1 + rows.filter(([, x]) => x[k] > r[k]).length;   // equal counts share a rank; rank counts from the top either way
      return `<li><a class="rrow" href="#${esc(o.id)}" aria-label="${n}. ${esc(clean(o.name))}: ${esc(t('rkLine', r))}"><span class="rn num">${n}</span>${av(o.name, o.photo)}
      <span class="hn"><b>${esc(clean(o.name))}</b><small>${esc(o.body === 'house' ? (o.kind === 'party-list' ? o.party : o.constituency) : o.position)}</small><span class="rbar" aria-hidden="true"><i style="width:${r[k] ? Math.max(1.5, 100 * r[k] / max).toFixed(1) : 0}%"></i></span></span>
      <span class="rvs">${RANKS.slice(1).map(([c]) => `<span class="rkv num${c === k ? ' on' : ''}" data-l="${esc(rkCol(c, ch))}">${r[c]}</span>`).join('')}</span></a></li>`; }).join(''); };

/* where they studied: group schools, skipping items flagged match:false */
const GROUPS = [['Ateneo', /ateneo/i], ['UP', /university of the philippines/i], ['La Salle', /la salle/i], ['UST', /santo tomas/i], ['Harvard', /harvard/i], ['UE', /university of the east/i], ['PMA', /military academy/i], ['Georgetown', /georgetown/i]];
const CREST = {Ateneo: ['#0b3b8c', '#fff', 'AdMU'], UP: ['#7b1113', '#fff', 'UP'], 'La Salle': ['#00573f', '#fff', 'DLSU'], UST: ['#fdb913', '#1a1200', 'UST'], Harvard: ['#a51c30', '#fff', 'H'], UE: ['#c8102e', '#fff', 'UE'], PMA: ['#1b2a49', '#f2c94c', 'PMA'], Georgetown: ['#041e42', '#c5c9d3', 'GU']};
const LOGO = {Ateneo: 'ateneo', UP: 'up', 'La Salle': 'lasalle', UST: 'ust', Harvard: 'harvard', UE: 'ue', PMA: 'pma', Georgetown: 'georgetown'};
const crest = g => { const [bg, fg, ab] = CREST[g] || ['#444', '#fff', g.slice(0, 3)];
  return `<span class="lg" aria-hidden="true"><span class="crest" style="--cb:${bg};--cf:${fg}"><span>${esc(ab)}</span></span>${LOGO[g] ? `<img src="assets/schools/${LOGO[g]}.png" alt="" onload="this.parentNode.classList.add('ok')" onerror="this.remove()">` : ''}</span>`; };
let groups = {};
function buildGroups() {
  groups = {};
  for (const [name, re] of GROUPS) {
    const ids = data.filter(o => (edu[o.id] || []).some(i => i.level !== 'Honorary' && i.match !== false && re.test(i.school))).map(o => o.id);
    if (ids.length >= 2) groups[name] = new Set(ids);
  }
}

/* ---------- hemicycle ---------- */
const ASPECT = 0.56;
const ARCS = [[6, 22], [8, 34], [10, 46]];
const SLOTS = ARCS.flatMap(([n, r], a) => Array.from({length: n}, (_, i) => { const th = Math.PI * (1 - (i + .5) / n); return {a, th, x: 50 + r * Math.cos(th), y: 94 - r * Math.sin(th) / ASPECT}; }))
  .sort((p, c) => p.a - c.a || Math.abs(p.th - Math.PI / 2) - Math.abs(c.th - Math.PI / 2));
const lensVal = (id) => state.lens === 'bills' ? billCount(id) : state.lens === 'laws' ? lawCount(id) : 0;

function layoutSeats() {
  const chart = document.getElementById('hemi');
  if (!chart) return;
  const lensChanged = chart.dataset.lens != null && chart.dataset.lens !== state.lens;
  chart.dataset.lens = state.lens;
  const eq = state.lens === 'equal' || state.lens === 'track';
  const order = [...data].sort((a, b) => state.lens === 'track' ? trackRank(a.id) - trackRank(b.id) || lastName(a).localeCompare(lastName(b)) : eq ? posRank(a) - posRank(b) || lastName(a).localeCompare(lastName(b))
    : lensVal(b.id) - lensVal(a.id) || lastName(a).localeCompare(lastName(b)));
  const max = Math.max(...order.map(o => lensVal(o.id)), 1);
  order.forEach((o, i) => {
    const el = chart.querySelector(`.seat[data-id="${o.id}"]`); if (!el) return;
    el.style.setProperty('--x', SLOTS[i].x); el.style.setProperty('--y', SLOTS[i].y);
    el.style.setProperty('--k', eq ? 1 : (.78 + .42 * lensVal(o.id) / max).toFixed(3));
    el.style.zIndex = eq ? 1 : Math.round(lensVal(o.id) / max * 20);
  });
  if (!lensChanged || !matchMedia('(prefers-reduced-motion: no-preference)').matches) return;

  // Make room for portraits crossing the chart, then restore their full size at the destination.
  const duration = parseFloat(getComputedStyle(chart).getPropertyValue('--motion-seat'));
  for (const portrait of chart.querySelectorAll('.seat .av')) {
    portrait.getAnimations().find(animation => animation.id === 'lens-reorder')?.cancel();
    portrait.animate([
      {transform: 'scale(1)'},
      {transform: 'scale(.68)', offset: .13},
      {transform: 'scale(.78)', offset: .35},
      {transform: 'scale(1)'},
    ], {duration, id: 'lens-reorder'});
  }
}
const visibleIds = () => { const g = onHome() || onExplore() ? state.q.trim() : '', s = hashName() === 'senado' ? state.ss : '';
  return new Set(data.filter(o => matches(o, g + ' ' + s) && (!state.school || groups[state.school]?.has(o.id)) && (!state.leaders || isLead(o)) && (g || state.tr.has(trackOf(o.id)))).map(o => o.id)); };

function updateInfo() {
  const el = document.getElementById('hemiInfo'); if (!el) return;
  const names = ids => ids.map(id => `<a href="#${esc(id)}">${esc(nameOf(id))}</a>`).join(', ');
  const top = [...data].sort((a, b) => lensVal(b.id) - lensVal(a.id))[0];
  if (state.school) { const ids = data.filter(o => groups[state.school].has(o.id)).map(o => o.id);
    el.innerHTML = `<b>${ids.length} senators</b> studied at <b>${esc(state.school)}</b> (any level, per the cited sources): ${names(ids)}.`; }
  else if (state.q) el.innerHTML = `<b>${visibleIds().size}</b> senators and <b>${visibleHouse().length + visiblePL().length}</b> House members match “${esc(state.q)}”.`;
  else if (state.lens === 'track') { const n = k => data.filter(o => trackOf(o.id) === k).length;
    el.innerHTML = `Ring colour shows the court-case record in the sources we checked. Among senators: <b>${n('pending')}</b> pending, <b>${n('resolved')}</b> dismissed, acquitted or decided, <b>${n('convicted')}</b> convicted in a case, <b>${n('none')}</b> none found, <b>${n('unchecked')}</b> not yet checked. A charge is not a finding of guilt.`; }
  else if (state.lens === 'bills') el.innerHTML = `Bigger face = more bills filed. <b>${esc(nameOf(top.id))}</b> filed the most: <b>${billCount(top.id)}</b>.`;
  else if (state.lens === 'laws') el.innerHTML = `Bigger face = more laws backed (as author, co-author or co-sponsor). <b>${esc(nameOf(top.id))}</b> leads with <b>${lawCount(top.id)}</b>.`;
  else el.innerHTML = `Hover or tap a face to meet a senator. Gold ring = Senate leadership.`;
}
function visibleHouse() {
  const t = (onExplore() ? state.q : state.hs).trim().toLowerCase();
  return house.filter(o => o.kind !== 'party-list' && (!state.hpl || o.place === state.hpl) && (!state.hp || o.party === state.hp) && (onExplore() && t || state.tr.has(trackOf(o.id)))
    && matches(o, t));
}

const hFiltered = () => !!(state.hs.trim() || state.hpl || state.hp || state.sel !== 'everyone');
function updateHouse() {
  const l = document.getElementById('hlist'); if (!l) return;
  if (showRank('hlist', 'hrank', visibleHouse(), 'house')) { const i = document.getElementById('houseInfo'); if (i) i.textContent = ''; return; }
  const rows = visibleHouse(), by = new Map();
  rows.forEach(o => by.has(o.place) ? by.get(o.place).push(o) : by.set(o.place, [o]));
  const h = onExplore() ? 'h3' : 'h2';
  l.innerHTML = [...by].sort((a, b) => a[0].localeCompare(b[0])).map(([p, m]) => `<li class="hgrp"><${h}>${esc(p)}<small>${t('seats', m.length)}</small></${h}><ul>
    ${m.sort((a, b) => (a.district || 0) - (b.district || 0)).map(o => `<li><a class="hrow" href="#${esc(o.id)}" aria-label="${esc(clean(o.name))}, ${esc(o.constituency)}, ${esc(o.party)}, ${esc(trackLabel(o.id))}">${av(o.name, o.photo)}
      <span class="hn"><b>${esc(clean(o.name))}</b>${isLead(o) ? `<span class="role">${esc(o.position)}</span>` : ''}</span>
      <span class="hm"><span class="dn">${esc(distLabel(o))}</span> · ${esc(o.party)}</span>${tkHtml(o.id)}</a></li>`).join('')}</ul></li>`).join('')
    || `<li class="soon">${t('noMatch')}</li>`;
  const info = document.getElementById('houseInfo');
  if (info) { const tot = districts().length;
    info.innerHTML = `<span>${t('showingB', rows.length, tot, by.size)}</span>${hFiltered() ? `<button class="lnk" data-f="hclear">${t('clearF')}</button>` : ''}`; }
}
function visiblePL() { const t = (onExplore() ? state.q : state.ps).trim();
  return house.filter(o => o.kind === 'party-list' && matches(o, t) && (onExplore() && t || state.tr.has(trackOf(o.id)))); }
function updatePL() {
  const l = document.getElementById('plgrid'); if (!l) return;
  if (showRank('plgrid', 'plrank', visiblePL(), 'house')) { const i = document.getElementById('plInfo'); if (i) i.textContent = ''; return; }
  const rows = visiblePL(), by = {};
  rows.forEach(o => (by[o.party] = by[o.party] || []).push(o));
  const list = Object.entries(by).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  const h = onExplore() ? 'h3' : 'h2';   // Explore nests groups under its own "Party-list" h2
  l.innerHTML = list.map(([p, m]) => `<li class="plc"><${h}><span>${esc(p)}</span><small>${t('seats', m.length)}</small></${h}>
    ${m.map(o => `<a href="#${esc(o.id)}" aria-label="${esc(clean(o.name))}, ${esc(p)}, ${esc(trackLabel(o.id))}">${av(o.name, o.photo)}<b>${esc(clean(o.name))}</b>${tkHtml(o.id)}</a>`).join('')}</li>`).join('')
    || `<li class="soon" style="grid-column:1/-1">${t('noMatch')}</li>`;
  const info = document.getElementById('plInfo'), all = house.filter(o => o.kind === 'party-list').length;
  if (info) info.textContent = t('showing', rows.length, all);
}
function showRank(listId, rankId, pool, ch) {   // true when the ranked list is shown instead of the usual one
  const l = document.getElementById(listId), r = document.getElementById(rankId); if (!l || !r) return false;
  const on = !!state.rank && !onExplore(); l.hidden = on; r.hidden = !on; if (!on) return false;
  const rows = ranked(pool.filter(o => state.tr.has(trackOf(o.id))));
  r.innerHTML = `<li class="rinfo">${esc(t('rkShow', rows.filter(([, x]) => x[state.rank] > 0).length, state.rterm < 20 ? rows.length : pool.length, state.rank, ch))}${state.rterm < 20 ? `<br><small>${esc(t('rkPast', t('sbCong', state.rterm)))}</small>` : ''}</li>` + (rankList(rows, ch) || `<li class="soon">${t('noMatch')}</li>`);
  return true;
}
function updateAll() {
  const vis = visibleIds();
  document.querySelectorAll('.seat').forEach(s => s.classList.toggle('dim', !vis.has(s.dataset.id)));
  document.getElementById('hemi')?.classList.toggle('trk', state.lens === 'track');
  layoutSeats(); updateInfo(); updateWall(); updateHouse(); updatePL();
  document.querySelectorAll('[data-lens]').forEach(b => b.setAttribute('aria-pressed', b.dataset.lens === state.lens));
  document.querySelectorAll('[data-tr]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tr === state.sel));
  document.querySelectorAll('[data-ch]').forEach(b => b.setAttribute('aria-pressed', b.dataset.ch === state.ch));
  const pool = state.ch === 'senate' ? data : state.ch === 'house' ? house.filter(o => o.kind !== 'party-list') : state.ch === 'partylist' ? house.filter(o => o.kind === 'party-list') : everyone();
  const cnt = k => k === 'everyone' ? pool.length : k === 'checked' ? pool.filter(o => trackOf(o.id) !== 'unchecked').length : pool.filter(o => trackOf(o.id) === k).length;
  document.querySelectorAll('[data-n]').forEach(e => e.textContent = cnt(e.dataset.n));
  [['secSenate', 'senate'], ['secHouse', 'house'], ['secPL', 'partylist']].forEach(([id, k]) => { const e = document.getElementById(id); if (e) e.hidden = state.ch !== 'all' && state.ch !== k; });
  const ti = document.getElementById('trInfo');
  if (ti) { const who = {all: 'lawmakers', senate: 'senators', house: 'House members (district seats)', partylist: 'party-list representatives'}[state.ch];
    const n = pool.filter(o => state.tr.has(trackOf(o.id))).length;
    ti.textContent = state.sel === 'everyone' ? `Showing all ${pool.length} ${who}.`
      : `Showing only “${(TRACKS.find(t => t[0] === state.sel) || [0, ''])[1]}”: ${n} of ${pool.length} ${who}. Faces and cards that don't match are dimmed or hidden.`; }
  document.querySelectorAll('[data-school]').forEach(b => b.setAttribute('aria-pressed', b.dataset.school === state.school));
  document.querySelectorAll('[data-rank]').forEach(b => b.setAttribute('aria-pressed', b.dataset.rank === (state.rank || '')));
}
function updateWall() {
  if (showRank('wall', 'srank', data.filter(o => matches(o, state.ss)), 'senate')) return;
  const vis = visibleIds();
  const rows = data.filter(o => vis.has(o.id) && (!state.leaders || isLead(o)))
    .sort((x, y) => state.sort === 'bills' ? billCount(y.id) - billCount(x.id) : state.sort === 'laws' ? lawCount(y.id) - lawCount(x.id) : lastName(x).localeCompare(lastName(y)));
  const w = document.getElementById('wall'); if (!w) return;
  w.innerHTML = rows.map(o => `<li><a class="pt" href="#${esc(o.id)}" aria-label="${esc(clean(o.name))}, ${esc(o.position)}, ${esc(trackLabel(o.id))}, ${billCount(o.id)} bills, ${lawCount(o.id)} laws backed">
      ${isLead(o) ? `<span class="tag" aria-hidden="true">${esc(o.position.replace(/^Senate /, ''))}</span>` : ''}
      <span class="ph"><span class="ini" aria-hidden="true">${initials(o.name)}</span>${o.photo ? `<img src="${esc(pv(o.photo))}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</span>
      <span class="cap"><b>${esc(lastName(o))}</b><span class="pos">${esc(clean(o.name))}</span>
        <span class="bd">${t('billsLaws', billCount(o.id), lawCount(o.id))}</span></span>${tkHtml(o.id, 'band')}</a></li>`).join('')
    || '<li class="soon" style="grid-column:1/-1">No senator matches that.</li>';
  document.querySelectorAll('[data-sort]').forEach(b => b.setAttribute('aria-pressed', b.dataset.sort === state.sort));
  document.querySelectorAll('[data-lead]').forEach(b => b.setAttribute('aria-pressed', (b.dataset.lead === '1') === state.leaders));
}

const pageHead = (kick, h, note, pool, distLabel) => `<a class="back" href="#">${t('back')}</a><div class="ph1"><div><p class="kick">${kick}</p><h1>${h}</h1><p class="note">${note}</p></div>${distBar(pool, distLabel)}</div>${trChips(pool)}`;
function senPage() {
  app.innerHTML = pageHead(t('senK', data.length), t('senH'), t('senNote'), data, t('distSen', data.length)) + `<div class="finder one" role="search" aria-label="${esc(t('hsL'))}"><label><span>${t('hsL')}</span><span class="fs">${ico('search', 18)}<input id="ss" type="search" value="${esc(state.ss)}" placeholder="${esc(t('ssPh'))}" autocomplete="off"></span></label></div>` + rankBar('senate') + `<ul class="wall" id="wall"></ul><ol class="rlist" id="srank" hidden></ol>`;
  state.school = null; state.leaders = false; updateAll();
}
function housePage() {
  const dist = districts();
  app.innerHTML = `<a class="back" href="#">${t('back')}</a><div class="ph1"><div><p class="kick">${t('houseS', dist.length)}</p><h1>${t('houseH')}</h1><p class="note">${t('houseNote')}</p></div>${distBar(dist, t('distHouse', dist.length))}</div>
    <div class="finder" role="search" aria-label="${esc(t('hsL'))}">
      <label><span>${t('hsL')}</span><span class="fs">${ico('search', 18)}<input id="hs" type="search" value="${esc(state.hs)}" placeholder="${esc(t('hsPh'))}" autocomplete="off"></span></label>
      <label><span>${t('fPlace')}</span><select id="hplSel">${opt('', t('allPlaces'), !state.hpl)}${places().map(p => opt(p, p, p === state.hpl)).join('')}</select></label>
      <label><span>${t('fParty')}</span><select id="hpSel">${opt('', t('allParties'), !state.hp)}${Object.entries(dist.reduce((m, o) => (m[o.party] = (m[o.party] || 0) + 1, m), {})).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([p, n]) => opt(p, `${p} (${n})`, p === state.hp)).join('')}</select></label></div>
    ${trChips(dist)}${rankBar('house')}
    <p class="hinfo" id="houseInfo" aria-live="polite"></p><ul class="hlist" id="hlist"></ul><ol class="rlist" id="hrank" hidden></ol>`;
  updateAll();
}
function plPage() {
  const plm = partylist();
  app.innerHTML = pageHead(t('plS', plm.length, new Set(plm.map(o => o.party)).size), t('plH'), t('plNote'), plm, t('distPL', plm.length)) + `
    <div class="finder one" role="search" aria-label="${esc(t('hsL'))}"><label><span>${t('hsL')}</span><span class="fs">${ico('search', 18)}<input id="ps" type="search" value="${esc(state.ps)}" placeholder="${esc(t('psPh'))}" autocomplete="off"></span></label></div>${rankBar('house')}<p class="info" id="plInfo" aria-live="polite" style="text-align:left;min-height:0"></p><ul class="plgrid" id="plgrid"></ul><ol class="rlist" id="plrank" hidden></ol>`;
  updateAll();
}

function initSeatTooltip() {
  document.addEventListener('mouseover', e => {
    const seat = e.target.closest?.('.seat'); if (seat && !seat.contains(e.relatedTarget)) showTip(seat);
  });
  document.addEventListener('focusin', e => showTip(e.target.closest?.('.seat')));
  document.addEventListener('mouseout', e => {
    const seat = e.target.closest?.('.seat');
    if ((seat && !seat.contains(e.relatedTarget) || tip.contains(e.target)) && !tip.contains(e.relatedTarget) && !e.relatedTarget?.closest?.('.seat')) tip.classList.remove('on');
  });
  document.addEventListener('focusout', () => tip.classList.remove('on'));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') tip.classList.remove('on'); });
}

function showTip(s) {
  if (!s) return; const id = s.dataset.id, o = data.find(x => x.id === id), r = s.getBoundingClientRect();
  tip.innerHTML = `<b>${esc(clean(o.name))}</b><br>${esc(o.position)} · ${billCount(id)} bills · ${lawCount(id)} laws`;
  tip.classList.add('on');
  const half = tip.offsetWidth / 2 + 8;
  tip.style.left = Math.min(Math.max(r.left + r.width / 2, half), innerWidth - half) + 'px';
  const below = r.top < tip.offsetHeight + 8;
  tip.classList.toggle('below', below); tip.style.top = (below ? r.bottom : r.top) + 'px';
}

export { buildGroups, crest, groups, housePage, initSeatTooltip, plPage, senPage, updateAll, updateHouse };
