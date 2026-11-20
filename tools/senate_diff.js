/* Runs in the same senate.gov.ph tab after senate_fetch.js has finished (window.__ss.payload exists).
   Don't paste by hand: `python3 tools/apply_senate.py --print-diff-js [--page N]` prints it with our current hashes filled in.

   It builds each senator's bills.json entry in the page, exactly as tools/apply_senate.py would, hashes it
   (SHA-256 of sorted-key JSON) and returns ONLY the entries whose hash differs from ours, plus the raw law rows if those
   changed. Every returned item carries its hash, and apply_senate.py --patch refuses any item that does not match it,
   so a copying mistake can never reach the site. Results are paged (8 senators per page) to keep each reply small. */
async (OURS, PAGE) => {
  const ss = window.__ss;
  if (!ss || !ss.payload) return JSON.stringify({error: 'run senate_fetch.js first and wait for status done'});
  const P = JSON.parse(ss.payload);
  const CYR = {'А': 'A', 'В': 'B', 'С': 'C', 'Е': 'E', 'Н': 'H', 'К': 'K', 'М': 'M', 'О': 'O', 'Р': 'P', 'Т': 'T', 'Х': 'X', 'І': 'I',
               'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'х': 'x', 'у': 'y', 'і': 'i'};
  const ta = document.createElement('textarea');
  const unescape = s => { ta.innerHTML = s; return ta.value; };
  const title = t => unescape(t || '').replace(/[АВСЕНКМОРТХІаеорсхуі]/g, c => CYR[c]).replace(/\s+/g, ' ').trim();
  const MON = {January: '01', February: '02', March: '03', April: '04', May: '05', June: '06', July: '07', August: '08',
               September: '09', October: '10', November: '11', December: '12'};
  const iso = s => { const m = s.trim().match(/^([A-Za-z]+) (\d{1,2}), (\d{4})$/); if (!m || !MON[m[1]]) throw new Error('bad date ' + s); return `${m[3]}-${MON[m[1]]}-${m[2].padStart(2, '0')}`; };
  const canon = v => Array.isArray(v) ? '[' + v.map(canon).join(',') + ']'
    : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}' : JSON.stringify(v);
  const sha = async v => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canon(v))))].map(b => b.toString(16).padStart(2, '0')).join('');
  const entries = {};
  for (const [id, raw] of Object.entries(P.bills)) {
    const rows = raw.map(([no, t, d, st, bid]) => [no, title(t), iso(d), st, bid]).sort((a, b) => a[2] < b[2] ? 1 : a[2] > b[2] ? -1 : +b[4] - +a[4]);
    const byMonth = {}, byStatus = {};
    rows.forEach(r => { byMonth[r[2].slice(0, 7)] = (byMonth[r[2].slice(0, 7)] || 0) + 1; byStatus[r[3]] = (byStatus[r[3]] || 0) + 1; });
    entries[id] = {total: rows.length, byMonth, byStatus, latest: rows.slice(0, 5)};
  }
  const ids = Object.keys(entries).sort(), changed = [];
  for (const id of ids) { const h = await sha(entries[id]); if (h !== OURS.bills[id]) changed.push([id, h]); }
  const lawsHash = await sha(P.laws), size = 8, pages = Math.max(1, Math.ceil(changed.length / size));
  const out = {retrieved: P.retrieved, senators: ids.length, bills_total: Object.values(entries).reduce((s, e) => s + e.total, 0),
    changed_ids: changed.map(c => c[0]), page: PAGE, pages,
    entries: Object.fromEntries(changed.slice(PAGE * size, PAGE * size + size).map(([id, h]) => [id, {sha: h, entry: entries[id]}]))};
  if (PAGE === 0 && lawsHash !== OURS.laws_raw) out.laws_raw = {sha: lawsHash, rows: P.laws};
  return JSON.stringify(out);
}
