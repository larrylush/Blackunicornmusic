(() => {
  const bandcamp = /^(https:\/\/f[0-9]+\.bcbits\.com\/img\/(?:[ap]?\d+))_\d+(\.(?:jpg|png))$/i;
  const localRaw = /^https:\/\/raw\.githubusercontent\.com\/larrylush\/Blackunicornmusic\/nov26\/(assets\/images\/)/i;
  const localPages = /^https:\/\/larrylush\.github\.io\/Blackunicornmusic\/(assets\/images\/)/i;
  function local(url) {
    return (url || '').replace(localRaw, '$1').replace(localPages, '$1');
  }
  function constrained() {
    const connection = navigator.connection;
    return Boolean(connection && (connection.saveData || /^(slow-2g|2g|3g)$/.test(connection.effectiveType)));
  }
  function thumbnail(url, compact = false) {
    const source = local(url);
    return source.replace(bandcamp, compact ? '$1_9$2' : '$1_2$2');
  }
  function setArtwork(img, record, detail = false) {
    const original = local(record.img);
    const small = constrained() || matchMedia('(max-width: 600px)').matches;
    const source = detail && !small ? original :
      (small && bandcamp.test(original) ? thumbnail(original, true) :
        local(record.thumb) || thumbnail(original));
    if (!source) return;
    img.loading = detail ? 'eager' : 'lazy';
    img.decoding = 'async';
    if (source !== original && original) {
      img.addEventListener('error', () => { img.src = original; }, {once:true});
    }
    img.src = source;
  }
  window.BUImages = { constrained, thumbnail, setArtwork };
})();
