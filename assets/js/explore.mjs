import { TRACKS, trackColor, trackLabel, trackOf } from './case-status.mjs';
import { bills, data, house } from './data.mjs';
import { crest, groups, updateAll } from './directory.mjs';
import { billCount, lawCount } from './legislation.mjs';
import { t } from './locale.mjs';
import { everyone, isLead, nameOf } from './roster.mjs';
import { state } from './state.mjs';
import { clean, dayLabel, esc, monthName, title } from './text.mjs';
import { app, av } from './ui.mjs';

/* ---------- explore (the detailed dashboard) ---------- */
const maxBy = (xs, f) => xs.reduce((b, x) => f(x) > f(b) ? x : b, xs[0]);
function explore() {
  const ids = Object.keys(bills).filter(k => k !== '_meta');
  const total = ids.reduce((n, k) => n + bills[k].total, 0);
  const seen = new Set();
  const recent = ids.flatMap(k => bills[k].latest.map(b => ({id: k, no: b[0], t: b[1], d: b[2], bid: b[4]})))
    .sort((x, y) => y.d.localeCompare(x.d) || y.no.localeCompare(x.no, undefined, {numeric: true})).filter(r => !seen.has(r.no) && seen.add(r.no)).slice(0, 10);
  let peak = {n: 0}; ids.forEach(k => Object.entries(bills[k].byMonth).forEach(([m, n]) => { if (n > peak.n) peak = {n, m, id: k}; }));
  const topB = maxBy(ids, billCount), topL = maxBy(ids, lawCount);
  const o = id => data.find(x => x.id === id);
  const fact = (id, value, label, sub) => `<div class="fact">${av(nameOf(id), o(id).photo)}<div class="n">${value.toLocaleString()}</div>
      <div class="l">${label}</div><div class="s"><a href="#${esc(id)}">${esc(nameOf(id))}</a>${sub ? ' · ' + sub : ''}</div></div>`;
  const chip = (attr, val, label, on) => `<button class="chip" ${attr}="${esc(val)}" aria-pressed="${on}">${label}</button>`;
  const dist = house.filter(o => o.kind !== 'party-list'), plm = house.filter(o => o.kind === 'party-list');
  const glance = (go, n, label, sub, people) => `<button class="gl" data-go="${go}"><span class="n">${n}</span><b>${label}</b><small>${sub}</small>
      <span class="bar" role="img" aria-label="Court-case record: ${TRACKS.map(([k, l]) => people.filter(p => trackOf(p.id) === k).length + ' ' + l.toLowerCase()).join(', ')}">${TRACKS.map(([k, , c]) => `<i style="width:${100 * people.filter(p => trackOf(p.id) === k).length / people.length}%;background:${c}"></i>`).join('')}</span></button>`;
  app.innerHTML = `<p class="exp">${t('exploreBanner')}</p>
    <section aria-labelledby="h1" class="herogrid"><div class="htxt">
      <p class="kick">${t('kicker')}</p>
      <h1 class="big" id="h1">${t('h1')}</h1>
      <p class="lede"><b>${everyone().length} lawmakers.</b> Who they are, what they filed, which laws they backed, where they studied and what the courts have said. Every fact links to its source.</p></div>
      <div class="glance">
        ${glance('senate', data.length, 'Senate', 'senators, elected nationwide', data)}
        ${glance('house', dist.length, 'House of Representatives', 'district seats', dist)}
        ${glance('partylist', plm.length, 'Party-list', `representatives from ${new Set(plm.map(o => o.party)).size} groups`, plm)}
      </div></section>
    <div class="fbar" role="group" aria-label="Filters">
      <div class="frow"><p class="pl" id="plc">Chamber</p><div class="seg seg4" role="group" aria-labelledby="plc">
        ${[['all', 'All'], ['senate', 'Senate'], ['house', 'House'], ['partylist', 'Party-list']].map(([k, l]) => `<button data-ch="${k}" aria-pressed="${k === state.ch}">${l}</button>`).join('')}</div></div>
      <div class="frow"><p class="pl" id="plt">Court-case record <small>pick one to focus on it · tap it again to show everyone</small></p>
        <div class="tgs" role="group" aria-labelledby="plt">${TRACKS.map(([k, l, c]) => `<button class="tg" data-tr="${k}" aria-pressed="${state.sel === k}" style="--tb:${c};--tc:${c}"><span>${esc(l)}</span><b data-n="${k}"></b></button>`).join('')}</div></div>
      <p class="info" id="trInfo" aria-live="polite"></p></div>

    <div id="secSenate">
    <h2 class="sec" id="senate">The Senate <small>${data.length} senators</small></h2>
    <div class="senviz">
      <div class="hemi trk" id="hemi" role="group" aria-label="The ${data.length} senators. Each face links to a profile.">
        ${data.map(s => `<a class="seat ${isLead(s) ? 'lead' : ''}" data-id="${esc(s.id)}" style="--tc:${trackColor(s.id)}" href="#${esc(s.id)}" aria-label="${esc(clean(s.name))}, ${esc(s.position)}, ${esc(trackLabel(s.id))}, ${billCount(s.id)} bills, ${lawCount(s.id)} laws backed">${av(s.name, s.photo, true)}</a>`).join('')}
      </div>
      <div class="panel">
        <div><p class="pl" id="plv">Faces show</p><div class="seg" role="group" aria-labelledby="plv">
          ${[['track', 'Court cases'], ['bills', 'Bills'], ['laws', 'Laws']].map(([k, l]) => `<button data-lens="${k}" aria-pressed="${k === state.lens}">${l}</button>`).join('')}</div></div>
        <div><p class="pl" id="pls">Where senators studied</p><div class="studs" role="group" aria-labelledby="pls">
          ${Object.entries(groups).sort((a, b) => b[1].size - a[1].size).map(([g, s]) => `<button class="sch" data-school="${esc(g)}" aria-pressed="false" aria-label="${esc(g)}: ${s.size} senators" title="${esc(g)}">${crest(g)}<small>${s.size}</small></button>`).join('')}</div></div>
        <p class="info" id="hemiInfo" aria-live="polite"></p>
      </div>
    </div>
    <h3 class="sub">Standouts <small>volume, not quality or importance</small></h3>
    <div class="facts">
      ${fact(topB, billCount(topB), 'Most bills filed', '20th Congress')}
      ${fact(topL, lawCount(topL), 'Most laws backed', 'any role')}
      ${fact(peak.id, peak.n, 'Most bills in a single month', monthName(peak.m))}
      ${fact(recent[0].id, dayLabel(recent[0].d), 'Newest filing', esc(title(recent[0].t)))}
    </div>
    <h3 class="sub">Just filed <small>the newest bills in the Senate</small></h3>
    <div class="feed">${recent.map(r => `<a class="fcard" href="https://senate.gov.ph/legislative-documents/bills/${esc(r.bid)}" target="_blank" rel="noopener">${av(nameOf(r.id), o(r.id).photo)}
      <b>${esc(title(r.t))}</b><small>${esc(nameOf(r.id))} · ${esc(dayLabel(r.d))}<span class="sr"> (opens the Senate site)</span></small></a>`).join('')}</div>
    <h3 class="sub">All senators</h3>
    <div class="chips">${chip('data-lead', '0', 'All', true)}${chip('data-lead', '1', 'Leadership', false)}<span class="sp"></span>
      ${chip('data-sort', 'az', 'A–Z', true)}${chip('data-sort', 'bills', 'Most bills', false)}${chip('data-sort', 'laws', 'Most laws', false)}</div>
    <ul class="wall" id="wall"></ul>
    </div>

    <div id="secHouse">
    <h2 class="sec" id="house">House of Representatives <small>${dist.length} district seats</small></h2>
    <p class="note">Names, districts and parties come from Wikipedia and were spot-checked against news and election sources (32 members, no mismatches). Parties change during a term, so labels are as of the roster date, and some leadership roles may be missing. Bills and laws for House members come from BatasWatch (20th Congress, principal authors) and BetterGov open-congress-data (earlier terms). Education is not added yet.</p>
    <div class="hfilters"><label class="sel"><span class="sr">Province or city</span><select id="hplSel" aria-label="Filter by province or city"><option value="">All provinces and cities</option>${[...new Set(dist.map(o => o.place))].sort((a, b) => a.localeCompare(b)).map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('')}</select></label>
      <label class="sel"><span class="sr">Party</span><select id="hpSel" aria-label="Filter by party"><option value="">All parties</option>${Object.entries(dist.reduce((m, o) => (m[o.party] = (m[o.party] || 0) + 1, m), {})).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([p, n]) => `<option value="${esc(p)}">${esc(p)} (${n})</option>`).join('')}</select></label></div>
    <p class="info" id="houseInfo" aria-live="polite" style="text-align:left;min-height:0"></p>
    <ul class="hlist" id="hlist"></ul>
    </div>

    <div id="secPL">
    <h2 class="sec" id="partylist">Party-list <small>${plm.length} representatives · ${new Set(plm.map(o => o.party)).size} groups</small></h2>
    <p class="note">Party-list seats go to groups that represent sectors such as labour, farmers or youth. Each group below lists its representatives in the 20th Congress. Same roster source as the rest of the House.</p>
    <p class="info" id="plInfo" aria-live="polite" style="text-align:left;min-height:0"></p>
    <ul class="plgrid" id="plgrid"></ul>
    </div>`;
  updateAll();

}

export { explore };
