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

  const settings = document.createElement('a');
  settings.href = '#analytics-preferences';
  settings.textContent = 'Privacy & analytics preferences';
  settings.setAttribute('data-analytics-preferences','');
  const dialog = document.createElement('dialog');
  dialog.setAttribute('aria-label', 'Analytics preferences');
  const copy = document.createElement('p');
  copy.textContent = "Optional analytics help us understand visits, returning visitors, referral sources, general location and device information. A random browser identifier is stored for up to 90 days. It's entirely your choice, and you can change your choice anytime under Privacy & analytics preferences in the Explore menu or under Information in the footer.";
  dialog.id = 'bu-analytics-dialog';
  const heading = document.createElement('h2');
  heading.textContent = 'Help us make Black Unicorn even better';
  const intro = document.createElement('p');
  intro.textContent = "We're an independent music label and audio software developer. With your permission, we'd love to understand how people explore our website and how we can improve their experience.";
  const style = document.createElement('style');
  style.textContent = '#bu-analytics-dialog{box-sizing:border-box;width:min(92vw,460px);padding:26px;border:1px solid #555;border-radius:12px;background:#181818;color:#f5f2ed;font:15px/1.55 system-ui,sans-serif;margin:auto}#bu-analytics-dialog::backdrop{background:#0007}#bu-analytics-dialog h2{font-size:24px;line-height:1.2;color:#e8bb77;margin:0 0 14px}#bu-analytics-dialog p{margin:0 0 14px;color:inherit}#bu-analytics-dialog button{background:#292929;color:#fff;border:1px solid #888;border-radius:5px;padding:10px 14px;margin:5px 8px 0 0;font:inherit;cursor:pointer}#bu-analytics-dialog button:hover{border-color:#e8bb77}#bu-analytics-dialog a{color:#e8bb77}';
  document.head.append(style);
  const privacy = document.createElement('a');
  privacy.href = '/Blackunicornmusic/legal.html';
  privacy.textContent = 'Privacy information';
  const details = document.createElement('p');
  details.append(privacy);
  dialog.append(heading,intro,copy,details);
  for (const [name,value] of [['No thanks','decline'],['Happy to help','allow']]) {
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
  const openPreferences = () => { if (!dialog.open) dialog.showModal(); };
  document.addEventListener('click', event => {
    const link = event.target.closest?.('[data-analytics-preferences]');
    if (!link) return;
    event.preventDefault();
    openPreferences();
  }, true);
  if (location.hash === '#analytics-preferences') openPreferences();
  if (!document.querySelector('footer [data-analytics-preferences]')) {
    const information = [...document.querySelectorAll('footer h2,footer h3,footer h4')].find(h => h.textContent.trim() === 'Information');
    if (information) information.parentElement.append(settings);
  }
  document.body.append(dialog);
  if (!localStorage.getItem(preference)) {
    const openDialog = document.querySelector('dialog[open]');
    if (openDialog) openDialog.addEventListener('close', () => dialog.showModal(), {once:true});
    else dialog.showModal();
  }
  pageView();
})();
