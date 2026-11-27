(() => {
  'use strict';
  const code = 'Friday26';
  const endsAt = Date.parse('2026-11-30T00:00:00Z');
  const key = 'black-unicorn-black-friday-2026';
  if (Date.now() >= endsAt || typeof HTMLDialogElement === 'undefined') return;
  try { if (sessionStorage.getItem(key)) return; } catch {}
  const style = document.createElement('style');
  style.textContent = `
    #black-friday-offer{box-sizing:border-box;width:min(92vw,490px);max-height:90vh;margin:auto;padding:clamp(22px,6vw,42px);border:1px solid #e8bb77;border-radius:10px;background:#151515;color:#faf6f0;font:16px/1.5 system-ui,sans-serif;text-align:left}
    #black-friday-offer::backdrop{background:rgba(0,0,0,.76)}
    #black-friday-offer h2{font:800 clamp(38px,10vw,64px)/1 system-ui,sans-serif;letter-spacing:-.06em;margin:0 36px 12px 0;color:#fff;text-align:left}
    #black-friday-offer p{margin:0 0 15px;color:#faf6f0}
    #black-friday-offer .bf-label{font-size:12px;color:#e8bb77;letter-spacing:.1em}
    #black-friday-offer .bf-actions{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0 0}
    #black-friday-offer button,#black-friday-offer a{box-sizing:border-box;border:1px solid #e8bb77;border-radius:4px;padding:9px 13px;color:#fff;background:#151515;font:inherit;cursor:pointer;text-decoration:none}
    #black-friday-offer a{background:#e8bb77;color:#151515;font-weight:700}
    #black-friday-offer .bf-close{position:absolute;right:12px;top:12px;border-color:#777;padding:4px 10px}
    #black-friday-offer code{display:inline-block;padding:5px 10px;background:#282828;color:#fff;font:700 19px/1.4 ui-monospace,monospace;user-select:all}
    #black-friday-offer :focus-visible{outline:2px solid #fff;outline-offset:3px}
    #black-friday-offer .bf-status:empty{display:none}
    #black-friday-offer .bf-status{margin:10px 0 0;font-size:13px}
  `;
  const dialog = document.createElement('dialog');
  dialog.id = 'black-friday-offer';
  dialog.setAttribute('aria-labelledby', 'black-friday-title');
  dialog.setAttribute('aria-describedby', 'black-friday-description');
  dialog.innerHTML = `
    <form method="dialog"><button class="bf-close" aria-label="Close Black Friday offer" autofocus>×</button></form>
    <p class="bf-label">BLACK UNICORN RECORDS</p>
    <h2 id="black-friday-title">Black Friday</h2>
    <p id="black-friday-description"><strong>30% off on Bandcamp</strong><br>Through Sunday 29 November, Lisbon time.</p>
    <p>Use code <code>${code}</code> at checkout.</p>
    <div class="bf-actions"><button type="button" data-copy>Copy code</button><a href="https://larrylush.bandcamp.com/">Shop on Bandcamp →</a></div>
    <p class="bf-status" role="status"></p>
  `;
  const status = dialog.querySelector('.bf-status');
  dialog.querySelector('[data-copy]').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(code);
      status.textContent = 'Code copied.';
    } catch {
      status.textContent = 'Select the code above to copy it.';
    }
  });
  document.head.append(style);
  document.body.append(dialog);
  dialog.addEventListener('close', () => {
    try { sessionStorage.setItem(key, '1'); } catch {}
    dialog.remove();
    style.remove();
  }, { once: true });
  dialog.showModal();
  // Close the offer at the deadline even if the page remains open.
  setTimeout(() => { if (dialog.open) dialog.close(); }, Math.max(0, endsAt - Date.now()));
})();
