const REPORT_URL = 'https://nx3hxaffgkf7ufau7cyb6zfa6i0wigzc.lambda-url.ap-southeast-1.on.aws/';   // set to the Lambda function URL printed by tools/create_contact_form.sh

function initReportForm() { const b = document.getElementById('repB'), dlg = document.getElementById('rep'), f = document.getElementById('repF'), msg = document.getElementById('repMsg');
  if (!REPORT_URL) return; b.hidden = false;
  let opener;
  document.addEventListener('click', e => {
    const trigger = e.target.closest('#repB,[data-f="report"]'); if (!trigger) return;
    opener = trigger; msg.textContent = ''; dlg.showModal();
  });
  dlg.addEventListener('close', () => (opener?.isConnected ? opener : b).focus());
  dlg.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const fields = [...f.querySelectorAll('textarea,input:not([tabindex="-1"]),button')].filter(el => !el.disabled);
    const first = fields[0], last = fields.at(-1);
    if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
      e.preventDefault(); (e.shiftKey ? last : first).focus();
    }
  });
  document.getElementById('repX').onclick = () => dlg.close();
  f.onsubmit = async e => { e.preventDefault(); const go = document.getElementById('repGo'); if (document.activeElement === go) document.getElementById('repX').focus(); go.disabled = true; msg.textContent = 'Sending…';
    try { const r = await fetch(REPORT_URL, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({...Object.fromEntries(new FormData(f)), page: location.href})});
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) { msg.textContent = j.message || 'Sent. Thank you.'; f.reset(); } else msg.textContent = j.message || 'Could not send. Your note is still here; please try again.'; }
    catch { msg.textContent = 'Could not send. Please try again later.'; } go.disabled = false; };
}

export { initReportForm };
