import { ALLTR, TRACKS, trackLabel, trackOf } from './case-status.mjs';
import { casesAsOf } from './data.mjs';
import { fmtDay, t } from './locale.mjs';
import { state } from './state.mjs';
import { clean, esc } from './text.mjs';

const initials = n => { const p = clean(n).split(' ').filter(w => /^[A-Za-z]/.test(w) && !/^(Jr\.?|Sr\.?|II|III|IV)$/.test(w)); return (p[0][0] + (p[p.length-1][0] || '')).toUpperCase(); };
const hue = s => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
// Bump PHOTO_V whenever photos are replaced under the same file names, so every browser downloads the new ones
const PHOTO_V = '2026-11-21', pv = u => u.startsWith('assets/') ? `${u}?v=${PHOTO_V}` : u;
const av = (n, photo, eager) => `<div class="av" style="background:hsl(${hue(n)} 60% 28%)" aria-hidden="true">${initials(n)}${photo ? `<img src="${esc(pv(photo))}" alt="" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} referrerpolicy="no-referrer" onload="this.parentNode.classList.add('ph')" onerror="this.remove()">` : ''}</div>`;
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const app = document.getElementById('app'), q = document.getElementById('q'), tip = document.getElementById('tip');

/* icons: one set on a 24px grid with 2px round strokes (assets/icons has the brand mark). Status: gavel, hourglass, check, nothing found, not yet checked */
const ICO = {search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.8-4.8"/>', pin: '<path d="M12 21c-3.6-3.4-6.5-7-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 14 15.6 17.6 12 21z"/><circle cx="12" cy="10.5" r="2.3"/>'};
const ico = (k, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[k]}</svg>`;
const TR_ICON = {convicted: '<path d="M8.3 5.9L11.9 2.3 19.7 10.1 16.1 13.7Z"/><path d="M12.2 9.8L3.8 18.2"/><path d="M12 21h9"/>', pending: '<path d="M6 3h12M6 21h12"/><path d="M7 3c0 5 10 4.5 10 9s-10 4-10 9M17 3c0 5-10 4.5-10 9s10 4 10 9"/>',
  resolved: '<path d="M4 8h16v11.5H4z"/><path d="M3 4.5h18V8H3zM10 12h4"/>', none: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.8-4.8M8 10.5h5"/>', unchecked: '<circle cx="12" cy="12" r="8.5" stroke-dasharray="2.4 3"/>'};
const trChip = (k, label, cls = '') => `<span class="tk st-${k} ${cls}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TR_ICON[k]}</svg>${esc(label)}</span>`;

const distLabel = o => o.kind === 'at-large' ? t('kLone') : t('kNth', o.district);

const tkHtml = (id, cls) => trChip(trackOf(id), trackLabel(id), cls);
/* status chips with counts (replaces the status dropdown) and a stacked bar of the same counts */
const trCounts = pool => Object.fromEntries(ALLTR.map(k => [k, pool.filter(o => trackOf(o.id) === k).length]));
const trChips = pool => { const c = trCounts(pool);
  return `<div class="trs" role="group" aria-label="${esc(t('fStatus'))}"><button class="chip" data-tr="everyone" aria-pressed="${state.sel === 'everyone'}">${t('allStatus')} <small class="num">${pool.length}</small></button>`
    + TRACKS.filter(([k]) => c[k] || state.sel === k).map(([k, l]) => `<button class="chip" data-tr="${k}" aria-pressed="${state.sel === k}">${esc(l)} <small class="num">${c[k]}</small></button>`).join('') + `<a class="lnk cslnk" href="#mga-kaso">${t('csLink')} →</a></div>`; };
const distBar = (pool, label) => { const c = trCounts(pool), on = TRACKS.filter(([k]) => c[k]);
  return `<figure class="dist"><figcaption><b>${esc(label)}</b><span class="num">${fmtDay(casesAsOf())}</span></figcaption>
    <div class="stack" role="img" aria-label="${esc(on.map(([k, l]) => `${c[k]} ${l}`).join(', '))}">${on.map(([k]) => `<span class="st-${k}" style="flex:${c[k]}"></span>`).join('')}</div>
    <ul>${on.map(([k, l]) => `<li><b class="num">${c[k]}</b> ${esc(l)}</li>`).join('')}</ul></figure>`; };
const sub = o => o.body === 'house' ? (o.kind === 'party-list' ? o.party : `${o.constituency} · ${o.party}`) : o.position;
const pcard = o => `<li><a class="pc" href="#${esc(o.id)}" aria-label="${esc(clean(o.name))}, ${esc(sub(o))}, ${esc(trackLabel(o.id))}">${av(o.name, o.photo)}
    <b>${esc(clean(o.name))}</b><small>${esc(sub(o))}</small>${tkHtml(o.id)}</a></li>`;
const opt = (v, label, on) => `<option value="${esc(v)}"${on ? ' selected' : ''}>${esc(label)}</option>`;
const meaning = () => `<section class="howto" aria-labelledby="mH"><h2 id="mH">${t('meaningH')}</h2><p>${t('meaningS')}</p>
  <ul class="meaning">${TRACKS.map(([k, l]) => `<li>${trChip(k, l)}<span>${esc(t('m_' + k))}</span></li>`).join('')}</ul></section>`;

export { app, av, distBar, distLabel, ico, initials, meaning, motion, opt, pcard, pv, q, sub, tip, tkHtml, trChips };
