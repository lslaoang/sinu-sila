const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const clean = n => n.replace(/"[^"]*"/g, '').replace(/\s+/g, ' ').trim();

const monthName = k => new Date(k + '-01T00:00:00').toLocaleString('en', {month: 'short', year: '2-digit'});
const ACRONYMS = new Set('PNP BJMP BFP GSIS SK VAT SUC PWD HIV AIDS ID PRC MSME ZIP CHR CHED RTC EDCOM GIDA II III IV R.A. SBN'.split(' '));
const SMALL = new Set('OF THE AND FOR IN ON TO A AN OR'.split(' '));
const title = t => t.split(/\s+/).map((w, i) => {
  const core = w.replace(/^\(+|[),.]+$/g, '');
  if (/^\(.+\)$/.test(w) && core.length <= 7 || ACRONYMS.has(w.replace(/^\(|[),]+$/g, '')) || /^\d/.test(w)) return w;
  return i && SMALL.has(w) ? w.toLowerCase() : w.toLowerCase().replace(/(^|[(\-/])([a-z])/g, (m, a, b) => a + b.toUpperCase());
}).join(' ');
const dayLabelFull = d => /^\d{4}-\d\d-\d\d$/.test(d) ? new Date(d + 'T00:00:00').toLocaleDateString('en', {month: 'long', day: 'numeric', year: 'numeric'}) : d;
const dayLabel = d => new Date(d + 'T00:00:00').toLocaleDateString('en', {month: 'short', day: 'numeric'});

export { clean, dayLabel, dayLabelFull, esc, monthName, title };
