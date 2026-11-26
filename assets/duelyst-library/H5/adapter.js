(() => {
  const catalog = globalThis.DUELYST_DATA;
  const index = new Map(Object.entries(catalog.assets).map(([type, rows]) => [type, new Map(rows.map(row => [row.id, row]))]));
  const base = new URL('../', document.currentScript.src);
  const folders = {unit:'单位', fx:'特效', icon:'图标'};
  const get = (type, id) => index.get(type)?.get(id);
  function assetURL(type, relative) {
    return new URL(`${folders[type]}/${relative}`, base).href;
  }
  function createPreview(type, id, action = 'idle', scale = 2) {
    const item = get(type,id);
    if (!item) return null;
    if (type === 'unit') {
      const motion = item.actions[action];
      if (!motion) return null;
      const canvas = document.createElement('canvas');
      canvas.width = motion.width; canvas.height = motion.height;
      canvas.style.cssText = `width:${motion.width*scale}px;height:${motion.height*scale}px;image-rendering:pixelated`;
      canvas.setAttribute('role','img'); canvas.setAttribute('aria-label',`${id} ${action}`);
      const context = canvas.getContext('2d'); const strip = new Image();
      let active = false, timer, frame = 0;
      function draw() {
        context.clearRect(0,0,motion.width,motion.height);
        context.drawImage(strip,frame*motion.width,0,motion.width,motion.height,0,0,motion.width,motion.height);
      }
      function update() {
        clearInterval(timer);
        if (!active || !strip.complete || !strip.naturalWidth) return;
        draw();timer=setInterval(()=>{frame=(frame+1)%motion.count;draw()},motion.ms);
      }
      const observer = new IntersectionObserver(entries=>{active=entries[0].isIntersecting;update()});
      observer.observe(canvas); strip.onload=update; strip.src=assetURL(type,motion.path);
      return {element:canvas, dispose(){observer.disconnect();active=false;clearInterval(timer);strip.onload=null}};
    }
    if (!item.preview) return null;
    const image = new Image(); image.loading='lazy'; image.alt=item.name; image.src=assetURL(type,item.preview);
    return {element:image,dispose(){}};
  }
  globalThis.DuelystLibrary = {list:type=>catalog.assets[type]||[], get, assetURL, createPreview, original:catalog.original};
})();
