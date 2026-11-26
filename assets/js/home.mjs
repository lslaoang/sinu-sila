import { casesAsOf, data, house, membersAsOf } from './data.mjs';
import { fmtDay, lang, t } from './locale.mjs';
import { districts, everyone, findAll, lastName, partylist, places } from './roster.mjs';
import { state } from './state.mjs';
import { clean, esc } from './text.mjs';
import { app, ico, initials, meaning, opt, pcard, pv } from './ui.mjs';

let place = (() => { try { return localStorage.getItem('place') || ''; } catch { return ''; } })();

const bc = (href, name, n, sub, cta, c, ct) => `<a class="bc" href="${href}" style="--bcc:${c};--bct:${ct}"><span class="bh"><b>${name}</b><span class="bn">${n}</span></span><small>${sub}</small><em>${cta} →</em></a>`;

function home() {
  const plm = partylist(), groupsN = new Set(plm.map(o => o.party)).size;
  app.innerHTML = `<section class="hero2" aria-labelledby="h1"><div>
      <p class="kick">${t('kicker')}</p><h1 class="big" id="h1">${t('h1')}</h1><p class="lede">${esc(t('lede'))}</p>
      <div class="hsearch" role="search"><label for="hq">${t('searchL')}</label>
        <div class="box">${ico('search', 20)}
        <input id="hq" type="search" aria-keyshortcuts="Alt+/" value="${esc(state.q)}" placeholder="${esc(t('searchPh'))}" autocomplete="off"></div>
        <p class="try"><span>${t('tryL')}</span>${['Pampanga', 'Quezon City', 'Risa Hontiveros', 'Akbayan'].map(x => `<button type="button" data-try="${esc(x)}">${esc(x)}</button>`).join('')}</p></div>
      <label class="bigsel"><span>${t('where')}</span><select id="placeSel">${opt('', t('pickPlace'), !place)}${places().map(p => opt(p, p, p === place)).join('')}</select></label>
      <div class="out" id="homeOut" aria-live="polite"></div></div>
      <aside class="glance2" aria-labelledby="gH"><h2 id="gH">${t('glanceH')}</h2><p>${t('glanceS')}</p><dl>
        <div><dt>${t('bSen')}</dt><span class="dots"></span><dd>${data.length}</dd></div>
        <div><dt>${t('gDist')}</dt><span class="dots"></span><dd>${districts().length}</dd></div>
        <div><dt>Party-list <small>(${t('gGroups', groupsN)})</small></dt><span class="dots"></span><dd>${plm.length}</dd></div>
        <div class="when"><dt>${t('gMembers')}</dt><span class="dots"></span><dd>${fmtDay(membersAsOf())}</dd></div>
        <div class="when"><dt>${t('gCases')}</dt><span class="dots"></span><dd>${fmtDay(casesAsOf())}</dd></div></dl></aside></section>
    <a class="newbar" href="#bago"><span class="pill">${lang === 'en' ? 'New' : t('newPill')}</span> ${t('newBar')} <b>${t('newSee')} →</b></a>
    <section class="out faces" aria-labelledby="fH"><div class="shead"><h2 id="fH">${t('facesH', data.length)}</h2><a href="#senado">${t('facesAll')} →</a></div>
      <ul>${[...data].sort((a, b) => lastName(a).localeCompare(lastName(b))).map((o, _, all) => `<li><a href="#${esc(o.id)}" aria-label="${esc(clean(o.name))}"><span class="ph">${o.photo ? `<img src="${esc(pv(o.photo))}" alt="" loading="lazy">` : `<span class="ini" aria-hidden="true">${initials(o.name)}</span>`}</span><small aria-hidden="true">${all.filter(x => lastName(x) === lastName(o)).length > 1 ? esc(clean(o.name)[0]) + '. ' : ''}${esc(lastName(o))}</small></a></li>`).join('')}</ul></section>
    <div class="out"><div class="shead"><h2>${t('browse')}</h2><small>${data.length + house.length} ${t('lawmakers')}</small></div><div class="browse">
      ${bc('#senado', t('bSen'), data.length, t('bSenS2'), t('ctaSen'), 'var(--navy)', 'var(--blue)')}
      ${bc('#kamara', t('bHouse'), districts().length, t('bHouseS2'), t('ctaHouse'), 'var(--sage)', 'var(--blue)')}
      ${bc('#party-list', t('bPL'), plm.length, t('bPLS2', groupsN), t('ctaPL'), 'var(--gold)', 'var(--blue)')}</div></div>
    ${meaning()}
    <section class="vows" aria-label="${esc(t('vowsAl'))}">
      <div><p class="kick" style="color:var(--ink);font-weight:700">${t('v1k')}</p><p>${t('v1')}</p></div>
      <div><p class="kick" style="color:var(--ink);font-weight:700">${t('v2k')}</p><p>${t('v2')}</p></div>
      <div><p class="kick" style="color:var(--ink);font-weight:700">${t('v3k')}</p><p>${t('v3')}</p></div></section>
    <p class="exp">${t('explore')}</p>`;
  homeOut();
}
function homeOut() {
  const el = document.getElementById('homeOut'); if (!el) return;
  const qq = state.q.trim().toLowerCase();
  const pm = qq && (places().find(p => p.toLowerCase() === qq) || (qq.length > 2 && places().filter(p => p.toLowerCase().startsWith(qq)).length === 1 ? places().find(p => p.toLowerCase().startsWith(qq)) : null));
  if (pm) { el.innerHTML = placeView(pm); return; }   // "Pampanga", "quezon c…": same answer as picking it in the dropdown
  if (qq) {
    const hits = findAll(everyone(), qq).slice(0, 80);
    el.innerHTML = `<h2>${esc(t('results', hits.length, state.q.trim()))}</h2>` + (hits.length ? `<ul class="pcs">${hits.map(pcard).join('')}</ul>` : `<p class="soon">${t('noResults')}</p>`);
    return;
  }
  el.innerHTML = place ? placeView(place) : '';
}
function placeView(place) {
  const reps = districts().filter(o => o.place === place).sort((a, b) => (a.district || 0) - (b.district || 0));
  const sens = [...data].sort((a, b) => lastName(a).localeCompare(lastName(b)));
  return `<h2>${t('yourRep')}</h2><p class="note">${esc(reps.length > 1 ? t('repMany', reps.length, place) : t('repOne', place))}</p><ul class="pcs">${reps.map(pcard).join('')}</ul>
    <h2>${t('yourSen')}</h2><p class="note">${t('yourSenNote')}</p><ul class="pcs">${sens.map(pcard).join('')}</ul>
    <h2>${t('bPL')}</h2><p class="note">${t('plNote')} <a href="#party-list">${t('plAll', partylist().length)}</a></p>`;
}

function selectPlace(value) {
  place = value;
  try { localStorage.setItem('place', value); } catch {}
}

function dropPlace() {
  place = '';
  const field = document.getElementById('placeSel');
  if (field) field.value = '';
}

export { dropPlace, home, homeOut, selectPlace };
