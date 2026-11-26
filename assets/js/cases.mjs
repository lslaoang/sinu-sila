import { cases } from './data.mjs';
import { t } from './locale.mjs';
import { everyone, fold, lastName, matches } from './roster.mjs';
import { state } from './state.mjs';
import { clean, esc } from './text.mjs';
import { app, av, ico, opt, sub } from './ui.mjs';

/* ---------- everyone with a case ---------- */
const CHG = {plunder: c => /plunder/i.test(c.title), graft: c => /graft|3019/i.test(c.title), malversation: c => /malversation/i.test(c.title), flood: c => /flood/i.test(c.title),
  libel: c => /libel/i.test(c.title), violence: c => /murder|homicide|killing/i.test(c.title), election: c => c.kind === 'election', admin: c => c.kind === 'administrative'};
const ST_ORDER = ['convicted', 'appealed', 'pending', 'filed', 'suspended', 'decided', 'acquitted', 'dismissed'];
const chOf = o => o.body !== 'house' ? 'senate' : o.kind === 'party-list' ? 'partylist' : 'house';
function casesPage() {
  const cs = Object.values(cases.cases).flat(), n = (f) => cs.filter(f).length;
  const people = everyone().filter(o => (cases.cases[o.id] || []).length);
  const chip = (attr, v, label, cnt, on) => `<button class="chip" ${attr}="${esc(v)}" aria-pressed="${on}">${esc(label)}${cnt != null ? ` <small class="num" data-fc>${cnt}</small>` : ''}</button>`;
  app.innerHTML = `<a class="back" href="#">${t('back')}</a><div class="ph1"><div><p class="kick">${t('csK', people.length)}</p><h1>${t('csH')}</h1><p class="note">${t('csNote')}</p></div></div>
    <div class="finder one" role="search" aria-label="${esc(t('hsL'))}">
      <label><span>${t('hsL')}</span><span class="fs">${ico('search', 18)}<input id="cq" type="search" value="${esc(state.cq)}" placeholder="${esc(t('csSearch'))}" autocomplete="off"></span></label>
      <label><span>${t('bSen')} / ${t('bHouse')}</span><select id="cchSel">${opt('', t('csAllCh'), !state.cch)}${[['senate', t('bSen')], ['house', t('bHouse')], ['partylist', t('bPL')]].map(([k, l]) => opt(k, l, state.cch === k)).join('')}</select></label></div>
    <p class="pl cspl">${t('csSt')}</p><div class="trs" role="group" aria-label="${esc(t('csSt'))}">${chip('data-cst', '', t('csAllSt'), cs.length, !state.cst)}${ST_ORDER.filter(k => n(c => c.status === k)).map(k => chip('data-cst', k, t('st_' + k), n(c => c.status === k), state.cst === k)).join('')}</div>
    <p class="pl cspl">${t('csCg')}</p><div class="trs" role="group" aria-label="${esc(t('csCg'))}">${chip('data-cg', '', t('csAllCg'), cs.length, !state.cg)}${Object.keys(CHG).map(k => chip('data-cg', k, t('cg_' + k), n(CHG[k]), state.cg === k)).join('')}</div>
    <p class="hinfo" id="csInfo" aria-live="polite"></p><ul class="cslist" id="cslist"></ul>`;
  updateCases();
}
/* cases matching the search and chamber, and optionally status / kind: a filter's own counts leave out its own choice */
const caseHits = (skip) => { const q = state.cq.trim();
  return everyone().filter(o => !state.cch || chOf(o) === state.cch).flatMap(o => (cases.cases[o.id] || []).map(c => [o, c]))
    .filter(([o, c]) => (skip === 'st' || !state.cst || c.status === state.cst) && (skip === 'cg' || !state.cg || CHG[state.cg](c)) && (!q || matches(o, q) || fold(c.title).includes(fold(q)))); };
function updateCases() {
  const l = document.getElementById('cslist'); if (!l) return;
  const q = state.cq.trim();
  const rows = everyone().filter(o => !state.cch || chOf(o) === state.cch)
    .map(o => [o, (cases.cases[o.id] || []).filter(c => (!state.cst || c.status === state.cst) && (!state.cg || CHG[state.cg](c)) && (!q || matches(o, q) || fold(c.title).includes(fold(q))))])
    .filter(([, cs]) => cs.length)
    .map(([o, cs]) => [o, cs.sort((a, b) => ST_ORDER.indexOf(a.status) - ST_ORDER.indexOf(b.status))])
    .sort((a, b) => ST_ORDER.indexOf(a[1][0].status) - ST_ORDER.indexOf(b[1][0].status) || b[1].length - a[1].length || lastName(a[0]).localeCompare(lastName(b[0])));
  l.innerHTML = rows.map(([o, cs]) => `<li class="csr"><a class="csp" href="#${esc(o.id)}">${av(o.name, o.photo)}<span><b>${esc(clean(o.name))}</b><small>${esc(sub(o))}</small></span></a>
    <ul>${cs.map(c => `<li><span class="pill cs-${esc(c.status)}">${esc(t('st_' + c.status))}</span> ${esc(c.title)}<small>${esc(t('k_' + c.kind))} · ${esc(t('r_' + c.role))}${/^(house|senate)$/i.test(c.body) ? '' : ' · ' + esc(c.body)}${c.status_date ? ` · ${t('statusAsOf')} ${esc(c.status_date)}` : ''}</small>
      <a class="cslnk2" href="#${esc(o.id)}" data-case="${esc(c.id)}">${t('csTimeline', c.events.reduce((n, e) => n + e.sources.length, 0))} →</a></li>`).join('')}</ul></li>`).join('')
    || `<li class="soon">${t('csNone')} <button class="lnk" data-f="csreset">${t('clearF')}</button></li>`;
  const filtered = !!(state.cq.trim() || state.cch || state.cst || state.cg);
  document.getElementById('csInfo').innerHTML = `<span>${esc(t('csInfo', rows.reduce((n, [, cs]) => n + cs.length, 0), rows.length))}</span>${filtered ? ` <button class="lnk" data-f="csreset">${t('clearF')}</button>` : ''}`;
  const byS = caseHits('st'), byK = caseHits('cg');
  document.querySelectorAll('[data-cst]').forEach(b => { const n = b.querySelector('[data-fc]'); if (n) n.textContent = byS.filter(([, c]) => !b.dataset.cst || c.status === b.dataset.cst).length; });
  document.querySelectorAll('[data-cg]').forEach(b => { const n = b.querySelector('[data-fc]'); if (n) n.textContent = byK.filter(([, c]) => !b.dataset.cg || CHG[b.dataset.cg](c)).length; });
  document.querySelectorAll('[data-cst]').forEach(b => b.setAttribute('aria-pressed', b.dataset.cst === state.cst));
  document.querySelectorAll('[data-cg]').forEach(b => b.setAttribute('aria-pressed', b.dataset.cg === state.cg));
}

export { casesPage, updateCases };
