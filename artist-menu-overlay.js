(() => {
  const panel = document.getElementById('bu-panel');
  const picker = panel?.querySelector('.bu-artist-picker');
  if (!picker) return;
  for (const link of picker.querySelectorAll('a[href*="#"]')) {
    const url = new URL(link.href);
    url.searchParams.set('artist', url.hash.slice(1));
    link.href = url.href;
  }
  if (!window.CSS?.supports('selector(:has(*))')) return;
  const summary = picker.querySelector('summary');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const ns = 'http://www.w3.org/2000/svg';
  const perimeter = [[0,0],[50,0],[100,0],[100,50],[100,100],[50,100],[0,100],[0,50]];
  const colours = ['#68dfff','#936cff','#ed8fff','#ffd07e'];
  let overlay;

  picker.addEventListener('toggle', () => {
    summary.textContent = picker.open ? '← Back to Explore' : 'Artists';
    overlay?.remove();
    if (!picker.open || motion.matches || typeof Element.prototype.animate !== 'function') return;
    const svg = document.createElementNS(ns, 'svg');
    svg.classList.add('bu-artist-neon');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    const slices = perimeter.map((point, i) => {
      const slice = document.createElementNS(ns, 'polygon');
      slice.setAttribute('points', ['50,50', point.join(','), perimeter[(i + 1) % perimeter.length].join(',')].join(' '));
      slice.style.color = colours[i % colours.length];
      svg.append(slice);
      return slice;
    });
    overlay = svg;
    panel.append(svg);
    slices.forEach((slice, i) => slice.animate([
      {fill:'#050505', strokeOpacity:0, opacity:1},
      {fill:'#050505', strokeOpacity:1, opacity:1, offset:.42},
      {fill:'#050505', strokeOpacity:.8, opacity:1, offset:.57},
      {fill:'#050505', strokeOpacity:0, opacity:0}
    ], {duration:620, delay:((i * 3) % slices.length) * 72, fill:'both'}));
    setTimeout(() => svg.remove(), 1150);
  });

  panel.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !picker.open) return;
    event.stopPropagation();
    picker.open = false;
    summary.focus();
  });
  new MutationObserver(() => {
    if (panel.hidden) picker.open = false;
  }).observe(panel, {attributes:true, attributeFilter:['hidden']});
})();
