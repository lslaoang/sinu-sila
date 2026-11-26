import { trackOf } from './case-status.mjs';
import {
  MONTHS,
  bills,
  cases,
  contacts,
  edu,
  elec,
  facts,
  fam,
  hb,
  houseMeta,
  loadBudget,
  loadCareer,
  loadHbd,
  loadPairs,
  loadSb,
  saln,
} from './data.mjs';
import { BUCKETS, bucketOf, lawCount, rec, rolesOf } from './legislation.mjs';
import { fmtDay, lang, t } from './locale.mjs';
import { fold, isLead, places } from './roster.mjs';
import { hashName, state } from './state.mjs';
import { clean, dayLabelFull, esc, monthName, title } from './text.mjs';
import { app, av, tkHtml } from './ui.mjs';

const NAMES = [[/wikipedia/, 'Wikipedia'], [/tribune\.net/, 'Daily Tribune'], [/politiko/, 'Politiko'], [/inquirer/, 'Inquirer'], [/rappler/, 'Rappler'], [/sunstar/, 'SunStar'], [/pna\.gov/, 'PNA'], [/mb\.com/, 'Manila Bulletin'], [/abs-cbn/, 'ABS-CBN'], [/manilatimes/, 'Manila Times'], [/ombudsman\.gov/, 'Office of the Ombudsman'], [/judiciary\.gov|lawphil/, 'Court record'], [/senatorpiacayetano/, 'Pia Cayetano\'s own CV (archived 2016)'], [/votepilipinas/, 'Vote Pilipinas (archived 2022)'], [/senate\.gov\.ph/, 'Senate profile'], [/gmanetwork/, 'GMA News'], [/halalan\.up/, 'UP sa Halalan'], [/philstar/, 'Philstar'], [/lorenlegarda/, "Legarda's office (self-published)"], [/atenews/, 'Atenews'], [/positivelyfilipino/, 'Positively Filipino'], [/verafiles/, 'Vera Files'], [/tsek/, 'Tsek.ph'], [/canvas\.ph/, 'Canvas.ph'], [/martiallaw/, 'Martial Law Chronicles'], [/bluevote/, 'ADDU BlueVote'], [/benildean/, 'The Benildean'], [/lifestyleasia/, 'Lifestyle Asia'], [/ust\.edu/, 'UST'], [/mmsu/, 'MMSU'], [/pccr/, 'PCCR']];
const LEVELS = ['Basic', 'College', 'Law', 'Graduate', 'Military', 'Honorary', 'Other'];
function eduHtml(id) {
  const items = (edu[id] || []).slice().sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level));
  const src = u => (NAMES.find(([re]) => re.test(u)) || [0, new URL(u).hostname])[1];
  const links = i => [i.source_url, ...(i.more_sources || [])].map(u => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(src(u))}<span class="sr"> (opens in a new tab)</span> ↗</a>`).join('<br>');
  return `<h2 class="h" id="aral">${t('hEdu')}</h2>` + (items.length ? `<ul class="edu">${items.map(i => `<li><span class="pill">${esc(i.level)}</span>
      <div><b>${esc(i.school)}</b><br><small>${esc(i.detail)}</small>${i.note ? `<br><small class="warn">${esc(i.note)}</small>` : ''}</div>
      <div class="srcs">${links(i)}</div></li>`).join('')}</ul>`
    : `<p class="soon">${t('eduNone')}</p>`);
}
const more = (items, n = 3) => items.slice(0, n).join('') + (items.length > n ? `<details class="more"><summary>${t('showMore', items.length - n)}</summary>${items.slice(n).join('')}</details>` : '');
function lawsHtml(id) {
  const rs = rolesOf(id);
  return `<h2 class="h" id="batas">${t('hLaws')}</h2>` + (rs.length ? lawMix(rs.map(l => l.title)) + more(rs.map(l => `<a class="bill" href="https://senate.gov.ph/legislative-documents/bills/${esc(l.id)}" target="_blank" rel="noopener">
      <b>${esc(title(l.title))}</b><br><small>${esc(l.no)} · ${esc(l.status)}</small>
      ${l.roles.map(r => `<span class="pill">${r}</span>`).join(' ')} ${lawTags(l.title)}</a>`))
    : `<p class="soon">${t('lawsNone')}</p>`)
    + `<p class="note">As listed by the Senate for the 20th Congress. Bills folded into another bill are not detected unless the Senate marks them so.</p>`;
}
function billsHtml(id) {
  const b = bills[id]; if (!b) return '';
  const counts = {}; for (const [st, n] of Object.entries(b.byStatus)) counts[bucketOf(st)] = (counts[bucketOf(st)] || 0) + n;
  const max = Math.max(...MONTHS.map(m => b.byMonth[m] || 0), 1);
  const r = rec({id, body: 'senate'});
  return `<h2 class="h" id="panukala">${t('hBills')}</h2><p class="ladder">${esc(t('ladder', r.filed, r.passed, r.law, lawCount(id)))}</p><div class="panel"><h3>Filed per month</h3>
      <div class="chart" role="img" aria-label="Bills filed per month: ${MONTHS.map(m => `${monthName(m)} ${b.byMonth[m] || 0}`).join(', ')}">${MONTHS.map(m => { const n = b.byMonth[m] || 0;
        return `<span title="${monthName(m)}: ${n}"><small>${n || ''}</small><i style="height:${n / max * 85}%"></i></span>`; }).join('')}</div>
      <div class="axis"><span>${monthName(MONTHS[0])}</span><span>${monthName(MONTHS[Math.floor(MONTHS.length / 2)])}</span><span>${monthName(MONTHS[MONTHS.length - 1])}</span></div></div>
    <div class="panel"><h3>Where the bills stand</h3>
      <div class="stack" role="img" aria-label="Bill status: ${BUCKETS.filter(x => counts[x[0]]).map(x => counts[x[0]] + ' ' + x[0]).join(', ')}">${BUCKETS.map(x => counts[x[0]] ? `<span title="${x[0]}: ${counts[x[0]]}" style="flex:${counts[x[0]]};background:${x[1]}"></span>` : '').join('')}</div>
      <div class="legend">${BUCKETS.filter(x => counts[x[0]]).map(x => `<span><span class="dot" style="background:${x[1]}"></span><b>${counts[x[0]]}</b> ${x[0]}</span>`).join('')}</div></div>
    <h3>Latest bills</h3>${b.latest.map(([no, t, d, st, bid]) => `<a class="bill" href="https://senate.gov.ph/legislative-documents/bills/${esc(bid)}" target="_blank" rel="noopener">
      <b>${esc(title(t))}</b><br><small>${esc(no)} · filed ${esc(d)}</small> <span class="pill">${esc(bucketOf(st))}</span></a>`).join('')}
    <p class="note">Bills where this senator is listed as author, 20th Congress. Source: <a href="${esc(bills._meta.source)}" target="_blank" rel="noopener">Senate Legislative Information System</a>, retrieved ${esc(bills._meta.retrieved)}.</p><div id="sbBox" aria-live="polite"></div>`;
}
const KIND = {criminal: 'Criminal', administrative: 'Administrative', election: 'Election', other: 'Other'};
const STATUS = {filed: 'Filed', pending: 'Pending', suspended: 'Suspended', appealed: 'On appeal', dismissed: 'Dismissed', acquitted: 'Acquitted', convicted: 'Convicted', decided: 'Decided'};
const srcName = u => (NAMES.find(([re]) => re.test(u)) || [0, new URL(u).hostname.replace(/^www\./, '')])[1];
function casesHtml(o) {
  const list = cases.cases[o.id] || [], ck = cases._meta.checked[o.id], checked = ck && ck.date;
  const links = e => e.sources.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(srcName(u))}<span class="sr"> (opens in a new tab)</span> ↗</a>`).join(' · ');
  const body = list.length ? `<p class="note">${t('casesNote')}</p>`
      + list.map(c => `<article class="case" id="case-${esc(c.id)}"><div class="ch"><span class="pill">${esc(t('st_' + c.status))}</span><span class="pill">${esc(t('k_' + c.kind))}</span>${lang !== 'en' ? `<span class="pill">${t('inEnglish')}</span>` : ''}</div><h3>${esc(c.title)}</h3>
        <small>${esc(t('r_' + c.role))}${c.status_date ? ` · ${t('statusAsOf')} ${esc(c.status_date)}` : ''}</small>
        <ol class="ev">${c.events.map(e => `<li><time>${esc(e.date)}</time>${esc(e.text)}<div class="srcs">${links(e)}</div></li>`).join('')}</ol></article>`).join('')
    : checked ? `<p class="soon">${esc(t('noneFound', checked, ck.queries))}</p>` : `<p class="soon">${t('uncheckedMsg')}</p>`;
  return `<h2 class="h" id="kaso">${t('hCases')}</h2>${body}`;
}
function famHtml(o) {
  const ls = fam[o.id]; if (!ls) return '';
  return `<h2 class="h" id="pamilya">${t('hFam')}</h2>
    <p>Pulitiklan, a map of Philippine political families, lists ${esc(clean(o.name))} in: ${ls.map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.place)} family ↗<span class="sr"> (opens Pulitiklan)</span></a>`).join(', ')}.</p>
    <p class="note">A link out only: we do not copy Pulitiklan's data. Relationships and their evidence are on their page. Matched by surname and place, with the name found on the page.</p>`;
}
const summary = (o, stats) => { const k = trackOf(o.id); return `<section class="sum" aria-labelledby="sumH">${tkHtml(o.id, 'band')}
    <div class="sb"><div class="st"><h2 id="sumH">${t('inShort')}</h2><p>${esc(t('s_' + k))}</p>${(cases.cases[o.id] || []).length ? `<button class="lnk" data-jump="kaso">${t('seeCases')}</button>` : ''}</div>
    ${stats ? `<dl>${stats.map(([n, l]) => `<div><dt>${l}</dt><dd>${n}</dd></div>`).join('')}</dl>` : ''}</div></section>`; };
const ptabs = tabs => `<nav class="ptabs" aria-label="${esc(t('sectionsAl'))}">${tabs.map(([id, l, n]) => `<button type="button" data-jump="${id}">${l}${n != null ? `<small>${n}</small>` : ''}</button>`).join('')}</nav>`;
const phero = (o, sub, meta) => `<a class="back" href="#${o.body === 'house' ? (o.kind === 'party-list' ? 'party-list' : 'kamara') : 'senado'}">${t('backTo', o.body === 'house' ? (o.kind === 'party-list' ? t('plH') : t('houseH')) : t('senH'))}</a>
    <div class="phero">${av(o.name, o.photo, true)}<div><p class="kick">${esc(sub)}</p><h1>${esc(o.name)}</h1>${isLead(o) ? `<span class="role">${esc(o.position)}</span>` : ''}${meta ? `<p class="meta">${meta}</p>` : ''}</div>
      <button class="chip share" data-f="share">${t('share')}</button></div>`;
const loc = () => lang === 'en' ? 'en-PH' : 'fil-PH';
const peso = n => n == null ? '–' : new Intl.NumberFormat(loc(), {style: 'currency', currency: 'PHP', notation: 'compact', maximumFractionDigits: 1}).format(n);
const num = n => n == null ? '–' : n.toLocaleString(loc());
const srcA = (u, label) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(label)}<span class="sr"> (opens in a new tab)</span> ↗</a>`;
function elecHtml(o) {
  const credit = `<p class="note">${t('elecSrc')} ${srcA('https://robertrleung.github.io/OpenHalalan/', 'Open Halalan')} · ${srcA(elec._meta.source || 'https://dynasties.bettergov.ph/developers', 'BetterGov Dynasties')}</p>`;
  const card = (big, rows) => `<div class="elec"><div class="eb">${big}</div><dl>${rows.filter(Boolean).map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl></div>`;
  let r, body;
  if (o.body !== 'house' && (r = elec.senate[o.id]))
    body = card(`<span class="num">${num(r.votes)}</span><small>${t('votes')}</small>`, [[t('eYear'), r.year], [t('eRank'), t('rankOf', r.rank, r.of)], [t('eSeats'), t('seatsN', r.seats)]]);
  else if (o.kind === 'party-list' && (r = elec.partylist[o.party]))
    body = card(`<span class="num">${num(r.votes)}</span><small>${t('votesGroup', o.party)}</small>`, [[t('eYear'), r.year], [t('eRank'), t('rankOfPL', r.rank, r.of)]]);
  else if ((r = elec.house[o.id]))
    body = r.uncontested ? card(`<span class="ub">${t('unopposed')}</span>`, [[t('eYear'), r.year], [t('votes'), num(r.votes)]])
      : card(`<span class="num">${num(r.votes)}</span><small>${t('votes')}${r.total && r.seats === 1 ? ` · ${Math.round(100 * r.votes / r.total)}%` : ''}</small>`,
          [[t('eYear'), r.year], [t('eRank'), r.seats > 1 ? t('rankOfSeats', r.rank, r.candidates, r.seats) : t('rankOf', r.rank, r.candidates)],
           r.runner_up && [t('eRunner'), `${esc(r.runner_up.name)}${r.runner_up.party ? ` (${esc(r.runner_up.party)})` : ''} · ${num(r.runner_up.votes)}`],
           r.margin != null && [t('eMargin'), num(r.margin)]]);
  else return `<h2 class="h" id="halalan">${t('hElec')}</h2><p class="soon">${t('elecNone')}</p>`;
  return `<h2 class="h" id="halalan">${t('hElec')}</h2>${body}${credit}`;
}
function salnHtml(o) {
  const rs = saln.people[o.id]; if (!rs) return `<h2 class="h" id="saln">${t('hSaln')}</h2><p class="soon">${t('salnNone')}</p>`;
  const max = Math.max(...rs.map(r => r.net_worth || 0), 1);
  const row = r => `<div class="srow" role="row"><span role="cell" class="sw">${when(r.date_filed)}</span>
      <span role="cell" class="sn"><b class="num">${peso(r.net_worth)}</b><i style="width:${Math.max(2, 100 * (r.net_worth || 0) / max)}%" aria-hidden="true"></i></span>
      <span role="cell" class="num" data-l="${esc(t('sAssets'))}">${peso(r.total_assets)}</span><span role="cell" class="num" data-l="${esc(t('sLiab'))}">${peso(r.total_liabilities)}</span>
      <span role="cell">${srcA(r.source_url, srcName(r.source_url))}</span></div>`;
  const when = d => d.endsWith('-12-31') ? t('asOfDec', d.slice(0, 4)) : t('reported', fmtDay(d));
  return `<h2 class="h" id="saln">${t('hSaln')}</h2><p class="note">${t('salnNote')}</p>
    <div class="saln" role="table" aria-label="${esc(t('hSaln'))}"><div class="sr-h" role="row"><span role="columnheader">${t('sWhen')}</span><span role="columnheader">${t('sNet')}</span><span role="columnheader">${t('sAssets')}</span><span role="columnheader">${t('sLiab')}</span><span role="columnheader">${t('source')}</span></div>
    ${rs.slice(0, 3).map(row).join('')}</div>${rs.length > 3 ? `<details class="more"><summary>${t('showMore', rs.length - 3)}</summary><div class="saln" role="table" aria-label="${esc(t('hSaln'))}">${rs.slice(3).map(row).join('')}</div></details>` : ''}
    <p class="note">${t('salnSrc')} ${srcA(saln._meta.source || 'https://github.com/bettergovph/saln-tracker-ph', 'BetterGov SALN Tracker')}${saln._meta.upstream_updated ? ` (${t('updated')} ${fmtDay(saln._meta.upstream_updated.slice(0, 10))})` : ''}.</p>`;
}
/* "data as of": the newest refresh of the data this profile shows (the weekly agent moves it), plus the case check */
const asOfLine = (o, dates) => { const d = [...dates, ...o.records.map(r => r.retrieved)].filter(Boolean).sort().pop(), ck = cases._meta.checked[o.id]?.date;
  return `${t('dataAsOf')} ${esc(fmtDay(d))}${ck ? ` · ${t('casesChecked')} ${esc(fmtDay(ck))}` : ''}`; };
const ageOf = d => { if (!/^\d{4}-\d\d-\d\d$/.test(d)) return null; const b = new Date(d + 'T00:00:00'), n = new Date(); return n.getFullYear() - b.getFullYear() - (n < new Date(n.getFullYear(), b.getMonth(), b.getDate()) ? 1 : 0); };
const SOCIAL = [[/facebook/, 'Facebook'], [/instagram/, 'Instagram'], [/(^|\/\/|\.)(x|twitter)\.com/, 'X'], [/youtube/, 'YouTube'], [/tiktok/, 'TikTok']];
function contactHtml(o) {
  const c = contacts.senate[o.id] || contacts.house?.[o.id], f = facts.people[o.id], off = hb.official?.[o.id], ext = (u, l) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(l)} ↗</a>`;
  const rows = [];
  if (f?.born || f?.place) { const a = ageOf(f.born || ''); rows.push([t('cBorn'), [f.born ? (f.born.length === 4 ? f.born : fmtDay(f.born)) : '', a != null ? `(${t('cAge', a)})` : '', f.place ? `· ${f.place}` : ''].filter(Boolean).map(esc).join(' ')]); }
  if (c) {
    if (c.office) rows.push([t('cOffice'), esc(c.office)]);
    if (c.phones.length) rows.push([t('cPhone'), c.phones.map(esc).join('<br>')]);
    if (c.emails.length) rows.push([t('cEmail'), c.emails.map(([l, e]) => `${l ? esc(l) + ': ' : ''}<a href="mailto:${esc(e)}">${esc(e)}</a>`).join('<br>')]);
    if (c.web.length) rows.push([t('cWeb'), c.web.map(u => ext(u, u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))).join('<br>')]);
    if (c.social.length) rows.push([t('cSocial'), c.social.map(u => ext(u, (SOCIAL.find(([re]) => re.test(u)) || [0, new URL(u).hostname])[1])).join(' · ')]);
  }
  if (off) rows.push([t('cOfficial'), ext(off, 'congress.gov.ph')]);
  return `<h2 class="h" id="kontak">${t('hContact')}</h2>` + (rows.length ? `<dl class="cinfo">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>` : `<p class="soon">${t('cNone')}</p>`)
    + `<p class="note">${c ? (o.body === 'house' ? t('cSrcH2', fmtDay(c.updated)) : t('cSrcS', fmtDay(c.updated))) + ' ' : o.body === 'house' ? t('cSrcH') + ' ' : ''}${f?.born || f?.place ? t('cBornSrc') : ''}</p>`;
}

function hbHtml(o) {
  const r = rec(o); if (!r) return `<h2 class="h" id="panukala">${t('hBills')}</h2><p class="soon">${t('hbNone')}</p>`;
  return `<h2 class="h" id="panukala">${t('hBills')}</h2>
    <div class="tiles"><div class="tile"><strong class="num">${r.filed}</strong><span>${t('hbFiled')} · ${t('hbLead', r.lead)}</span></div>
      <div class="tile"><strong class="num">${r.passed}</strong><span>${t('hbPassed')}</span></div><div class="tile"><strong class="num">${r.law}</strong><span>${t('hbLaw')}</span></div></div>
    <div id="hbBox" aria-live="polite"></div><div id="sbBox" aria-live="polite"></div><p class="note">${t('rkNoteH', fmtDay(hb._meta.discovered_as_of || ''))}</p>`;
}
const hbDetail = (o, D, P) => { const m = D?.members[o.id]; if (!m) return ''; const pr = P?.pairs || {};
  const sv = no => { const x = pr['HBN-' + parseInt(String(no).replace(/\D/g, ''), 10)]; return x ? `<span class="ver">${t('sVer')}: <a href="https://senate.gov.ph/legislative-documents/bills/${esc(x[1])}" target="_blank" rel="noopener">${esc(x[0])} ↗</a></span>` : ''; };
  const row = ([no, ti, d, st, u]) => `<div class="bill sbr"><a href="${esc(u || `https://bills.juris.ph/bills/house/${no.toLowerCase()}`)}" target="_blank" rel="noopener"><b>${esc(title(ti))}</b><span class="sr"> (opens BatasWatch)</span></a><br><small>${esc(no)}${d ? ' · ' + esc(fmtDay(d)) : ''}</small>${st ? ` <span class="pill">${esc(st.length > 60 ? st.slice(0, 58) + '…' : st)}</span>` : ''} ${lawTags(ti)}${sv(no)}</div>`;
  return (m.laws.length ? `<h3>${t('hbLaws')}</h3>${lawMix(m.laws.map(l => l[1]))}${more(m.laws.map(([no, ti, st]) => row([no, ti, '', st])))}` : '')
    + `<p class="note"><a href="${esc(m.bw)}" target="_blank" rel="noopener">${t('hbAll')} ↗</a></p>`; };
/* what kind of law: from title words (the Senate's short titles put the place in brackets: "REGIONAL TRIAL COURT (DANAO, CEBU)") */
const LK_FR = /franchise|telecom|\bcompany\b|electric cooperative|broadcast|\bradio\b|television|\bcable\b|communications,? inc|\binc\.?\s*$|incorporated\s*$|\bco\.,? inc/i;
const LK_DAY = /(^|[^-\d])\b(day|week|month)\b|holiday|anniversary|araw ng|of every year/i;
const LK_LOC = /hospital|medical center|high school|integrated school|elementary school|\bcampus|engineering office|trial court|\brtc\b|charter of the city|\bcity of\b|municipality of|province of|barangay|\broad\b|highway|bridge|\bave(nue)?\b|\bstreet\b|state university|state college|tourism development area|schools division|district office|extension office|\brenam|\bconvert|\bseparat|bed capacity|\bport\b|airport|protected (area|landscape)|watershed|cityhood/i;
let placeRe_; const placeRe = () => placeRe_ ||= new RegExp(`\\b(${places().map(p => fold(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'i');
const lawKind = ti => { const p = ti.match(/\(([^)]*)\)\s*$/);
  if (LK_FR.test(ti) || /corporation\s*$/i.test(ti) && !/^(extending|amending|creating|strengthening)|charter|code/i.test(ti)) return 'franchise';
  if (LK_DAY.test(ti)) return 'day';
  return LK_LOC.test(ti) || p && (p[1].includes(',') || /city/i.test(p[1]) || placeRe().test(fold(p[1]))) ? 'local' : 'national'; };
const lawTags = ti => `<span class="pill lk lk-${lawKind(ti)}">${t('lk_' + lawKind(ti))}</span>${/\bamend|\brepeal/i.test(ti) ? ` <span class="pill lk">${t('lkAmends')}</span>` : ''}`;
const lawMix = titles => { if (!titles.length) return ''; const c = {}; titles.forEach(x => c[lawKind(x)] = (c[lawKind(x)] || 0) + 1);
  return `<p class="note lkmix">${t('lkMix', ['national', 'local', 'franchise', 'day'].filter(k => c[k]).map(k => `<b>${c[k]}</b> ${esc(t('lk_' + k).toLowerCase())}`).join(' · '))} <span class="lkn">${esc(t('lkNote'))}</span></p>`; };

const hbUrl = no => `https://bills.juris.ph/bills/house/hb${String(no).replace(/\D/g, '').padStart(5, '0')}`;   // 20th Congress House bill on BatasWatch
function sbHtml(D) {   // a lawmaker's bills in every term (both chambers), filterable by Congress, with the other chamber's version
  if (!D || !D.bills.length) return '';
  const rows = D.bills, terms = [...new Set(rows.map(r => r[0]))].sort((a, b) => b - a), k = state.sbterm && terms.includes(state.sbterm) ? state.sbterm : 0;
  const both = new Set(rows.map(r => r[1])).size > 1, shown = k ? rows.filter(r => r[0] === k) : rows;
  const senUrl = no => { const x = Object.values(D.pairs).find(v => v[0] === no); return x ? `https://senate.gov.ph/legislative-documents/bills/${x[1]}` : ''; };
  const verLink = (c, ch, no, cp) => { if (!cp) return '';
    const u = c !== 20 ? '' : ch === 'S' ? hbUrl(cp) : senUrl(cp);
    return `<span class="ver">${t(ch === 'S' ? 'hVer' : 'sVer')}: ${u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(cp)} ↗</a>` : esc(cp)}</span>`; };
  const isLaw = st => /PRESIDENT|LAPSED|Republic Act|enacted/i.test(st || '');
  const stat = (st, ti) => { if (!st) return ''; const bk = bucketOf(st);
    return ` <span class="pill">${esc(isLaw(st) ? t('rkLaw') : bk !== 'Other' ? bk : st.length > 48 ? st.slice(0, 46) + '…' : st)}</span>${isLaw(st) ? ' ' + lawTags(ti) : ''}`; };
  const row = ([c, ch, no, ti, d, st, cp, url]) => `<div class="bill sbr"><a href="${esc(url)}" target="_blank" rel="noopener"><b>${esc(title(ti))}</b><span class="sr"> (opens the source)</span></a><br>
      <small>${both ? `<span class="chb">${ch === 'S' ? 'Senate' : 'House'}</span> ` : ''}${esc(no)} · ${esc(t('sbCong', c))}${d ? ' · ' + esc(/^\d{4}-\d\d-\d\d/.test(d) ? fmtDay(d.slice(0, 10)) : d) : ''}</small>${stat(st, ti)}${verLink(c, ch, no, cp)}</div>`;
  return `<h3>${t('sbH')}</h3><div class="chips sbt" role="group" aria-label="${esc(t('sbTerm'))}">
      <button class="chip" data-sbterm="0" aria-pressed="${!k}">${esc(t('sbAllT', rows.length))}</button>${terms.map(c => `<button class="chip" data-sbterm="${c}" aria-pressed="${k === c}">${esc(t('sbCong', c))} <span class="n">${rows.filter(r => r[0] === c).length}</span></button>`).join('')}</div>
    ${lawMix(shown.filter(r => isLaw(r[5])).map(r => r[3]))}${more(shown.map(row), 10)}<p class="note">${esc(t('sbNote', fmtDay(D._meta.retrieved)))}</p>`;
}
const showSb = id => loadSb(id).then(D => { const el = document.getElementById('sbBox'); if (el && hashName() === id) el.innerHTML = sbHtml(D); });   // senators and House members

const congYears = n => n === 8 ? [1987, 1992] : [1992 + 3 * (n - 9), 1995 + 3 * (n - 9)];
function careerHtml(o, C) {
  const c = C?.people?.[o.id], site = C?._meta?.site || 'https://dynasties.bettergov.ph';
  if (!c) return `<p class="soon">${t('cNone')}</p>`;
  const runs = ns => { const out = []; ns.forEach(n => out.length && out.at(-1)[1] === n - 1 ? out.at(-1)[1] = n : out.push([n, n])); return out; };
  const span = ([a, b]) => { const y0 = congYears(a)[0], y1 = congYears(b)[1]; return `${a === b ? t('sbCong', a) : `${t('sbCong', a).replace(/ .*/, '')}–${t('sbCong', b)}`} <span>(${y0}–${y1 > new Date().getFullYear() ? t('cNow') : y1})</span>`; };
  const terms = c.terms ? `<p class="cterms"><b>${t('cInCong')}:</b>${[['house', t('cHouse')], ['senate', t('cSenate')]].filter(([k]) => c.terms[k]).map(([k, l]) => `<span><b>${l}</b> ${runs(c.terms[k]).map(span).join(', ')}</span>`).join('')}</p>` : '';
  const rs = c.races || [];
  const row = ([y, pos, place, w, v, rank, party, path]) => `<li><span class="yr">${y}</span><a href="${esc(site + path)}" target="_blank" rel="noopener"><b>${esc(pos)}</b><small>${esc(place)}${party ? ' · ' + esc(party) : ''}${v ? ' · ' + num(v) + ' ' + t('votes') : ''}</small><span class="sr"> (opens in a new tab)</span></a>
    <span class="res ${w === 1 ? 'w' : w === 0 ? 'l' : 'u'}">${w === 1 ? t('cWon') : w === 0 ? t('cLost') : t('cUnk')}</span></li>`;
  return terms + (rs.length ? `<p class="note">${t('cRaces', rs.length)} · ${t('cWins', rs.filter(r => r[3] === 1).length)}</p><ol class="career">${more(rs.map(row), 8)}</ol>` : '')
    + `<p class="note">${t('cNote')} ${srcA(site, 'BetterGov Dynasties')}</p>`;
}
const showCareer = o => loadCareer().then(C => { const el = document.getElementById('careerBox'); if (el && hashName() === o.id) el.innerHTML = careerHtml(o, C); });

const bil = n => (n / 1e9).toFixed(n < 1e10 ? 1 : 0) + 'B';
const pesoD = n => n == null ? '–' : (n > 0 ? '+' : n < 0 ? '−' : '') + peso(Math.abs(n));
function budgetHtml(o, B) {
  if (!B) return `<p class="soon">${t('bFail')}</p>`;
  const d = B.districts[o.id];
  if (!d || d.tier === 'none' || !d.offices.length) return `<p class="soon">${t('bNone')}</p>`;
  const shared = [...new Set(d.offices.flatMap(f => f.shared_with))];
  const G = [['house_only', 'gHouse', 'gHouseS'], ['nep_only', 'gNep', 'gNepS'], ['increased', 'gUp'], ['decreased', 'gDown'], ['unchanged', 'gSame'], ['scope_review', 'gReview']];
  const yrs = Object.keys(d.gaa), max = Math.max(...Object.values(d.gaa), 1);
  /* a shared office's list holds every district's projects: say which district each title names (data/district_places.json) */
  const named = (label, title) => (B.places?.[label] || []).some(pl => new RegExp(`\\b${fold(pl).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(fold(title)));
  const where = p => { if (!shared.length) return ''; const all = [d.label, ...shared], one = txt => { const h = all.filter(l => named(l, txt)); return h.length === 1 ? h[0] : ''; };
    const brgy = p.t.match(/\b(?:barangay|brgy\.?)\s+([^,()]+)/i);   // "Villa Lourdes, Barangay Culiat": the barangay decides
    return (brgy && one(brgy[1])) || one(p.t); };
  const tagOf = p => { if (!shared.length) return ''; const w = where(p);
    return ` <span class="pill ${w === d.label ? 'bhere' : 'bthere'}">${esc(w === d.label ? t('bHere2') : w ? t('bIn', w) : t('bNoDist'))}</span>`; };
  const topHtml = () => { if (!shared.length) return `<h3>${t('bTop')}</h3><p class="note">${t('bTopNote')}</p>${more(d.top.map(proj))}`;
    const rank = p => where(p) === d.label ? 0 : where(p) ? 2 : 1, rows = [...d.top].sort((a, b) => rank(a) - rank(b));
    return `<h3>${t('bTopShared')}</h3><p class="note">${esc(t('bTopSharedNote', shared.join(', '), rows.filter(p => !rank(p)).length, rows.length))}</p>${more(rows.map(proj), 4)}`; };
  const proj = p => `<a class="bill" href="${esc(p.url)}" target="_blank" rel="noopener"><b>${esc(p.t)}</b><br>
      <small>${esc(p.office)}${p.pap ? ' · ' + esc(p.pap) : ''} · ${p.g === 'nep_only' ? `NEP ${peso(p.nep)}` : p.g === 'house_only' ? `${t('bHB')} ${peso(p.house)}` : `${peso(p.nep)} → ${peso(p.house)}`}</small>
      <span class="pill">${esc(t({house_only: 'gHouse', nep_only: 'gNep', increased: 'gUp', decreased: 'gDown'}[p.g]))}</span>${tagOf(p)}<span class="sr"> (opens BetterGov)</span></a>`;
  return `<p class="note">${t('budgetIntro')}</p>
    <div class="bhow"><h3>${t('bHow')}</h3><ol class="bsteps">${t('bSteps').map(([k, v], i) => `<li${i === 1 ? ' aria-current="step"' : ''}><b>${k}</b><span>${v}</span>${i === 1 ? `<em>${t('bHere')}</em>` : ''}</li>`).join('')}</ol>
      <dl class="bterms">${t('bTerms').map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl></div>
    <p class="btier"><span class="pill">${t(d.tier === 'A' ? 'pLone' : 'pShared')}</span> ${shared.length ? esc(t('bShared', shared.join(', '))) : t('bLone')}</p>
    <div class="panel"><h3>${t('b27')}</h3>
      <div class="tiles bt"><div class="tile"><strong class="num">${peso(d.cmp27.nep)}</strong><span>${t('bNep')}</span></div>
        <div class="tile"><strong class="num">${peso(d.cmp27.house)}</strong><span>${t('bHB')}</span></div>
        <div class="tile"><strong class="num">${pesoD(d.cmp27.delta)}</strong><span>${t('bNet')}</span></div></div>
      <p class="note">${t('bGaa27')}</p>
      <h3>${t('bGroups')}</h3>
      <ul class="bgrp">${G.filter(([k]) => d.groups[k]?.[0]).map(([k, l, sub]) => `<li><b class="num">${d.groups[k][0]}</b> ${t(l)}${sub ? ` <small>(${t(sub)})</small>` : ''} <span class="num">${peso(d.groups[k][1])}</span></li>`).join('')}</ul></div>
    ${d.top.length ? topHtml() : ''}
    <p class="note">${d.offices.map(f => `<a href="${esc(f.url)}" target="_blank" rel="noopener">${t('bAll')}: ${esc(f.name)} ↗</a>`).join(' · ')}</p>
    ${yrs.length ? `<div class="panel"><h3>${t('bHist')}</h3>
      <div class="chart" role="img" aria-label="${esc(t('bHist'))}: ${yrs.map(y => `${y} ${peso(d.gaa[y])}`).join(', ')}">${yrs.map(y => `<span title="${y}: ${peso(d.gaa[y])}"><small>${bil(d.gaa[y])}</small><i style="height:${d.gaa[y] / max * 85}%"></i></span>`).join('')}</div>
      <div class="axis"><span>${yrs[0]}</span><span>₱, billions</span><span>${yrs[yrs.length - 1]}</span></div></div>` : ''}
    <p class="bnote">${t('bNotice')} <a href="${esc(B._meta.methodology)}" target="_blank" rel="noopener">${t('bMethod')} ↗</a></p>
    <p class="note">${t('bSrc')} ${esc(fmtDay(B._meta.retrieved))}. <a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.label)} ↗</a></p>`;
}
function houseProfile(o) {
  app.innerHTML = `${phero(o, `${o.constituency} · ${o.term}`, asOfLine(o, [houseMeta.retrieved]))}
    ${summary(o)}
    <div class="tiles">
      <div class="tile txt"><strong>${esc(o.party)}</strong><span>${o.kind === 'party-list' ? t('tPLGroup') : t('tParty')}</span></div>
      <div class="tile txt"><strong>${esc(o.bloc || '–')}</strong><span>${t('tBloc')}</span></div>
      <div class="tile txt"><strong>${{district: t('kDistrict'), 'at-large': t('kLone'), 'party-list': t('kPL')}[o.kind] || '–'}</strong><span>${t('tSeat')}</span></div></div>
    <p class="note">${esc(t('partyNote', o.records[0]?.retrieved || ''))}</p>
    ${ptabs([['kaso', t('tabCases'), (cases.cases[o.id] || []).length], ['kontak', t('tabContact')], ['panukala', t('tabBills'), rec(o)?.filed], ...(o.kind !== 'party-list' ? [['pera', t('tabBudget')]] : []), ['halalan', t('tabElec')], ['karera', t('tabCareer')], ...(fam[o.id] ? [['pamilya', t('tabFam')]] : []), ['puwesto', t('tabOffice')]])}
    ${casesHtml(o)}${contactHtml(o)}${hbHtml(o)}${o.kind !== 'party-list' ? `<h2 class="h" id="pera">${t('hBudget')}</h2><div id="budgetBox" aria-live="polite"><p class="soon">${t('bLoading')}</p></div>` : ''}${elecHtml(o)}<h2 class="h" id="karera">${t('hCareer')}</h2><div id="careerBox" aria-live="polite"><p class="soon">${t('cLoading')}</p></div>${famHtml(o)}<h2 class="h" id="puwesto">${t('hOffice')}</h2>${recordsHtml(o)}
    <p class="note">${o.wikipedia ? `More about ${esc(clean(o.name))}: <a href="${esc(o.wikipedia)}" target="_blank" rel="noopener">Wikipedia ↗</a>. ` : ''}${o.photo_credit_url ? `Photo: <a href="${esc(o.photo_credit_url)}" target="_blank" rel="noopener">Wikimedia Commons ↗</a>, background removed (see the file page for author and licence).` : ''}</p>
    <p class="note">${t('houseLater')}</p>`;
  Promise.all([loadHbd(), loadPairs()]).then(([D, P]) => { const el = document.getElementById('hbBox'); if (el && hashName() === o.id) el.innerHTML = hbDetail(o, D, P); });
  state.sbterm = 0; showSb(o.id); showCareer(o);
  if (o.kind !== 'party-list') loadBudget().then(B => { const el = document.getElementById('budgetBox'); if (el && hashName() === o.id) el.innerHTML = budgetHtml(o, B); });
}
const recordsHtml = o => `<ul class="offices">${o.records.map(r => `<li><b>${esc(r.title)}</b><small>${r.type === 'membership' ? t('since') : esc(r.type) + ' · '}${esc(dayLabelFull(r.date))}</small><a href="${esc(r.source_url)}" rel="noopener" target="_blank">${t('source')}<span class="sr"> (opens in a new tab)</span> ↗</a></li>`).join('')}</ul>`;
function profile(o) {
  if (o.body === 'house') return houseProfile(o);
  const nc = (cases.cases[o.id] || []).length;
  app.innerHTML = `${phero(o, `${o.chamber === 'Senate' ? t('senator') : o.chamber} · ${o.term}`, asOfLine(o, [bills._meta?.retrieved, saln._meta?.retrieved]))}
    ${summary(o, [[bills[o.id]?.total ?? '–', t('tBills')], [lawCount(o.id), t('tLaws')], [nc, t('tCases')]])}
    ${ptabs([['kaso', t('tabCases'), nc], ['kontak', t('tabContact')], ['batas', t('tabLaws'), lawCount(o.id)], ['panukala', t('tabBills'), bills[o.id]?.total], ['saln', 'SALN'], ['halalan', t('tabElec')], ['karera', t('tabCareer')], ['aral', t('tabEdu')], ...(fam[o.id] ? [['pamilya', t('tabFam')]] : []), ['puwesto', t('tabOffice')]])}
    ${casesHtml(o)}${contactHtml(o)}${lawsHtml(o.id)}${billsHtml(o.id)}${salnHtml(o)}${elecHtml(o)}<h2 class="h" id="karera">${t('hCareer')}</h2><div id="careerBox" aria-live="polite"><p class="soon">${t('cLoading')}</p></div>${eduHtml(o.id)}
    ${famHtml(o)}<h2 class="h" id="puwesto">${t('hOffice')}</h2>${recordsHtml(o)}
    <p class="note">${o.photo_credit_url ? `Photo: <a href="${esc(o.photo_credit_url)}" target="_blank" rel="noopener">Wikimedia Commons ↗</a>${o.photo_license ? ` (${esc(o.photo_license)})` : ''}, background removed. ` : ''}${t('laterVotes')}</p>`;
  state.sbterm = 0; showSb(o.id); showCareer(o);
}

function selectBillTerm(term) {
  state.sbterm = term;
  const id = hashName();
  return loadSb(id).then(records => {
    const el = document.getElementById('sbBox');
    if (!el || hashName() !== id) return;
    const focused = el.contains(document.activeElement) ? document.activeElement.dataset.sbterm : null;
    el.innerHTML = sbHtml(records);
    if (focused != null) el.querySelector(`[data-sbterm="${focused}"]`)?.focus();
  });
}

export { profile, selectBillTerm };
