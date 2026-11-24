/* Collect every bill each current senator authored in the current (20th) Congress, plus the House counterpart of
   each bill that moved past committee. Earlier terms come from BetterGov's open-congress-data instead. Run inside a senate.gov.ph tab (the site sits behind a bot
   check, so plain scripts are refused); it paces itself at under one request a second and backs off on HTTP 429.
   Usage: python3 tools/import_bill_history.py --print-js  -> paste into the tab; it keeps the result in
   window.__sh and offers a "Save Sino Sila history" button that downloads sinosila-senate-20th.json. */
async (CODES) => {
  const sh = window.__sh = {status: 'running', done: 0, rows: [], cp: {}, err: []};
  const C = [['20th', 'twentieth']];
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const get = async u => { for (let t = 0; t < 6; t++) {
      const r = await fetch(u); if (r.status === 429) { await sleep(15000 * (t + 1)); continue; }   // the site asked us to slow down
      if (r.status === 400) return {data: [], pagination: {has_next: false}};   // a Congress the site does not hold
      if (!r.ok) throw new Error(r.status + ' ' + u); await sleep(800); return r.json(); }
    throw new Error('429 ' + u); };
  const QUIET = /PENDING IN THE COMMITTEE|WITHDRAWN|CONSOLIDATED|SUBSTITUTED/i;   // no counterpart to look for
  try {
    for (const [id, codes] of Object.entries(CODES)) for (const [c, word] of C) for (const code of codes) {
      for (let page = 1; ; page++) {
        const j = await get(`/lis/documents_v2?document_type=bills&congress=${encodeURIComponent(c + ' Congress')}&author_code=${code}&page=${page}&per_page=100`);
        for (const d of j.data || []) {
          sh.rows.push([id, parseInt(c), d.no, d.title, d.dateFiled, d.legislativeStatus || '', String(d.id)]);
          if (d.legislativeStatus && !QUIET.test(d.legislativeStatus) && !sh.cp[d.id]) {
            try { const x = await get(`/lis/bills/${d.id}/comprehensive?congress=${word}`);
              const hits = (JSON.stringify(x).match(/HBN?-?\s?0*(\d{2,5})/g) || []).map(h => 'HBN-' + h.replace(/\D/g, '').replace(/^0+/, ''));
              const top = Object.entries(hits.reduce((m, h) => (m[h] = (m[h] || 0) + 1, m), {})).sort((a, b) => b[1] - a[1])[0];
              sh.cp[d.id] = top ? top[0] : '';
            } catch (e) { sh.err.push(String(e.message).slice(0, 120)); }
          }
        }
        sh.status = `running: ${id} ${c} page ${page}, ${sh.rows.length} bills`;
        if (!j.pagination || !j.pagination.has_next) break;
      }
      sh.done++;
    }
    sh.status = `done: ${sh.rows.length} bills, ${Object.values(sh.cp).filter(Boolean).length} counterparts, ${sh.err.length} errors`;
  } catch (e) { sh.status = 'error: ' + e.message; }
  const b = document.createElement('button'); b.textContent = 'Save Sino Sila history';
  b.style.cssText = 'position:fixed;top:12px;right:12px;z-index:99999;padding:14px 18px;background:#0b4fd9;color:#fff;font:600 16px sans-serif;border:0;border-radius:8px';
  b.onclick = () => { const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify({retrieved: new Date().toISOString().slice(0, 10), rows: sh.rows, cp: sh.cp})], {type: 'application/json'}));
    a.download = 'sinosila-senate-20th.json'; a.click(); };
  document.body.appendChild(b);
  return sh.status;
}
