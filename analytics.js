(() => {
  const endpoint = document.currentScript.dataset.endpoint;
  if (!endpoint || !endpoint.startsWith('https://')) return;
  const preference = 'bu-analytics-preference';
  const browserKey = 'bu-analytics-browser';
  const lifetime = 90 * 86400000;
  const page = location.pathname.replace(/^\/Blackunicornmusic(?=\/|$)/, '') || '/';
  const ua = navigator.userAgent;
  const os = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'iOS/iPadOS' :
    /Android/i.test(ua) ? 'Android' : /Windows/i.test(ua) ? 'Windows' :
    /Mac OS/i.test(ua) ? 'macOS' : /Linux/i.test(ua) ? 'Linux' : 'Other';
  const device = /iPad|Tablet/i.test(ua) || (os === 'iOS/iPadOS' && !/iPhone|iPod/i.test(ua)) ||
    (os === 'Android' && !/Mobile/i.test(ua)) ? 'Tablet' : /Mobile/i.test(ua) ? 'Mobile' : 'Desktop';
  const browser = /Edg/i.test(ua) ? 'Edge' : /Firefox|FxiOS/i.test(ua) ? 'Firefox' :
    /Chrome|CriOS/i.test(ua) ? 'Chrome' : /Safari/i.test(ua) ? 'Safari' : 'Other';
  const source = new URL(location.href).searchParams.get('utm_campaign') || '';
  const campaign = /^[a-z0-9_.-]{1,80}$/i.test(source) ? source : '';
  const from = document.referrer ? new URL(document.referrer) : null;
  const referrer = from && from.origin !== location.origin ? from.hostname : '';
  let tracked = false;

  function send(events) {
    fetch(endpoint, {method:'POST', body:JSON.stringify(events), keepalive:true, credentials:'omit', referrerPolicy:'no-referrer'}).catch(() => {});
  }

  function traffic(type) {
    if (localStorage.getItem(preference) !== 'allow') return;
    const now = Date.now();
    const prior = JSON.parse(localStorage.getItem(browserKey) || 'null');
    const existing = prior && prior.expires > now;
    const record = existing ? prior : {id:crypto.randomUUID(),expires:now + lifetime,last:0};
    const types = [type];
    if (!existing) types.push('first_visit');
    if (!existing || now - record.last >= 1800000) {
      types.push('session');
      if (existing) types.push('return_visit');
    }
    record.last = now;
    localStorage.setItem(browserKey, JSON.stringify(record));
    send(types.map(type => ({type,page,referrer,campaign,device,visitor:record.id,os,browser})));
  }

  function pageView() {
    if (tracked || localStorage.getItem(preference) !== 'allow') return;
    tracked = true;
    traffic('page_view');
  }

  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href]');
    if (!link) return;
    const target = new URL(link.href, location.href);
    if (/(^|\.)bandcamp\.com$/.test(target.hostname)) traffic('bandcamp_click');
    else if (link.hasAttribute('download') || /\.(zip|dmg|pkg|msi|vst3|component)$/i.test(target.pathname)) traffic('download_click');
  });

  const settings = document.createElement('button');
  settings.type = 'button';
  settings.textContent = 'Analytics preferences';
  const dialog = document.createElement('dialog');
  dialog.setAttribute('aria-label', 'Analytics preferences');
  const copy = document.createElement('p');
  copy.textContent = 'Allow optional analytics to measure visits, repeat visits, referring sites, broad location and device type. A random browser ID lasts up to 90 days. You can change this choice anytime.';
  dialog.append(copy);
  for (const [name,value] of [['Decline analytics','decline'],['Allow analytics','allow']]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = name;
    button.addEventListener('click', () => {
      localStorage.setItem(preference,value);
      if (value === 'decline') {
        localStorage.removeItem(browserKey);
        tracked = false;
      }
      dialog.close();
      pageView();
    });
    dialog.append(button);
  }
  settings.addEventListener('click', () => dialog.showModal());
  (document.querySelector('footer') || document.body).append(settings);
  document.body.append(dialog);
  if (!localStorage.getItem(preference)) {
    const openDialog = document.querySelector('dialog[open]');
    if (openDialog) openDialog.addEventListener('close', () => dialog.showModal(), {once:true});
    else dialog.showModal();
  }
  pageView();
})();
