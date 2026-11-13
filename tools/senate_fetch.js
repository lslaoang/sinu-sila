/* Runs INSIDE a senate.gov.ph tab (the site blocks plain scripts but serves its own pages' JSON).
   Don't paste this by hand: `python3 tools/apply_senate.py --print-js` prints it with the senator codes filled in.
   It starts in the background and returns at once; poll `window.__ss.status` until it reads "done: ..." or "error: ...".
   When done, a yellow "Copy Sino Sila data" button appears at the top left. Clicking it (a real click, which the
   clipboard requires) copies the data; then `python3 tools/apply_senate.py --clipboard` reads it.
   Chrome blocks repeated automatic downloads from a site, so the clipboard is used instead of a file. */
(LIS, STAMP) => {
  const ss = window.__ss = {status: 'starting'};
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const get = async url => {
    for (let i = 0; i < 5; i++) {
      try { const r = await fetch(url); if (r.ok) return await r.json(); } catch (e) {}
      await sleep(1500 * (i + 1));
    }
    throw new Error('failed: ' + url);
  };
  const all = async q => {          // every page of one query, ~600 ms apart
    const out = [];
    for (let p = 1; p < 50; p++) {
      const j = await get(`/lis/documents_v2?document_type=bills&congress=20th+Congress&${q}&page=${p}&per_page=100`);
      out.push(...(j.data || []));
      if (!j.pagination || !j.pagination.has_next) break;
      await sleep(600);
    }
    return out;
  };
  (async () => {
    const bills = {}, laws = {};
    const ids = Object.keys(LIS);
    for (const [n, id] of ids.entries()) {
      ss.status = `bills ${n + 1}/${ids.length} (${id})`;
      const seen = new Map();       // several lis codes per senator: de-duplicate by bill id
      for (const c of LIS[id]) { for (const d of await all('author_code=' + encodeURIComponent(c))) seen.set(d.id, d); await sleep(600); }
      bills[id] = [...seen.values()].map(d => [d.no, d.title, d.dateFiled, d.legislativeStatus, d.id]);
    }
    for (const code of ['6-200', '6-210', '6-220', '6-320', '4-590']) {   // enacted, then "enrolled, awaiting signature" last
      ss.status = 'laws ' + code;
      for (const d of await all('status_code=' + code))
        if (!laws[d.id] || code !== '4-590') laws[d.id] = [code, d.no, d.title, d.legislativeStatus, d.id, d.author, d.coAuthor, d.coSponsor];
      await sleep(600);
    }
    ss.payload = JSON.stringify({retrieved: STAMP, bills, laws: Object.values(laws)});
    document.getElementById('ss-copy')?.remove();
    const b = document.createElement('button');
    b.id = 'ss-copy'; b.textContent = 'Copy Sino Sila data';
    b.style.cssText = 'position:fixed;top:120px;left:20px;z-index:2147483647;padding:16px 24px;font:700 18px sans-serif;color:#000;background:#fcd116;border:3px solid #000;border-radius:8px;cursor:pointer';
    b.onclick = async () => { try { await navigator.clipboard.writeText(ss.payload); b.textContent = 'Copied'; ss.copied = true; } catch (e) { b.textContent = 'Copy failed: ' + e.name; } };
    document.body.appendChild(b);
    ss.status = `done: ${Object.values(bills).reduce((s, b) => s + b.length, 0)} bills for ${ids.length} senators, ${Object.keys(laws).length} laws. Click the yellow "Copy Sino Sila data" button.`;
  })().catch(e => { ss.status = 'error: ' + e.message; });
  return 'started';
}
