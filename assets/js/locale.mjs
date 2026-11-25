import { TRACKS } from './case-status.mjs';
import { fetchOptionalJson } from './data.mjs';
import { T } from './messages.mjs';
import { esc } from './text.mjs';

/* Languages: English and Filipino are built in. The local languages are drafts in i18n/<code>.json, fetched when picked;
   a string they do not have yet falls back to Filipino, then English. "{0}" in a draft string is the first value passed in. */
const LANGS = ['en', 'fil', 'ceb', 'ilo', 'hil', 'war', 'bcl', 'pam'], isLocal = l => !['en', 'fil'].includes(l);
let lang = (() => { try { const l = localStorage.getItem('lang'); return LANGS.includes(l) ? l : 'en'; } catch { return 'en'; } })();   // English unless the visitor picked another

const t = (k, ...a) => { const v = T[lang]?.[k] ?? (lang !== 'en' ? T.fil[k] : undefined) ?? T.en[k] ?? k;
  return typeof v === 'function' ? v(...a) : a.length && typeof v === 'string' ? v.replace(/\{(\d)\}/g, (m, i) => a[i] ?? m) : v; };
const loadLang = l => T[l] || !isLocal(l) ? Promise.resolve() : fetchOptionalJson(`i18n/${l}.json`, {}).then(j => { T[l] = j; });
function applyLang() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach(e => e.textContent = t(e.dataset.i18n));
  document.querySelectorAll('[data-i18n-html]').forEach(e => e.innerHTML = t(e.dataset.i18nHtml));
  document.querySelectorAll('[data-i18n-ph]').forEach(e => e.placeholder = t(e.dataset.i18nPh));
  document.querySelectorAll('[data-i18n-al]').forEach(e => e.setAttribute('aria-label', t(e.dataset.i18nAl)));
  document.getElementById('langSel').value = lang;
  const n = document.getElementById('langNote'), draft = isLocal(lang) && !T[lang]?._meta?.reviewed; n.hidden = !draft;   // reviewed languages drop the note
  if (draft) n.innerHTML = `${esc(T[lang]?._draft || 'Draft translation, still being checked. Parts not translated yet are in Filipino.')} <button class="lnk" type="button" data-f="report">${esc(T[lang]?._fix || t('repB'))}</button> · <a href="https://github.com/lslaoang/sinu-sila/blob/main/i18n/${lang}.json" target="_blank" rel="noopener">GitHub ↗</a>`;
  TRACKS.forEach(r => r[1] = t('tr_' + r[0]));
}

function initLanguage(onChange) {
  document.getElementById('langSel').onchange = e => {
    const l = e.target.value;
    try { localStorage.setItem('lang', l); } catch {}
    loadLang(l).then(() => {
      lang = l;
      applyLang();
      onChange();
    });
  };
  applyLang();
  if (isLocal(lang)) loadLang(lang).then(() => {
    applyLang();
    onChange();
  });
}

const fmtDay = d => d ? new Date(d + 'T00:00:00').toLocaleDateString(lang === 'en' ? 'en-US' : 'fil-PH', {month: 'short', day: 'numeric', year: 'numeric'}) : '–';

export { fmtDay, initLanguage, isLocal, lang, t };
