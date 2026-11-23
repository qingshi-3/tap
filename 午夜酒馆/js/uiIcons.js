// Unified 16-bit Pixel-Art Icon Library (DOM & Canvas share the EXACT same generated pixel PNGs!)
(function () {
  window.MT = window.MT || {};

  const EL_KEYS = ['fire', 'grass', 'ice', 'light', 'dark', 'bolt', 'fog'];
  const ROLE_KEYS = ['tank', 'warrior', 'assassin', 'ranged', 'support'];

  const images = new Map();

  async function load() {
    const paths = [
      ...EL_KEYS.map((k) => [`el_${k}`, `./assets/icons/el_${k}.png`]),
      ...ROLE_KEYS.map((k) => [`role_${k}`, `./assets/icons/role_${k}.png`])
    ];
    await Promise.all(paths.map(([key, src]) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { images.set(key, img); resolve(); };
      img.onerror = () => resolve();
      img.src = src;
    })));
  }

  function elBadge(elId, opts = {}) {
    const { DATA } = window.MT;
    const size = opts.size || 22;
    const isFog = elId === 'fog';
    const ec = !isFog && DATA && DATA.ELEMENTS && DATA.ELEMENTS[elId];
    const col = isFog ? '#c07aff' : (ec ? ec.color : '#ffd966');
    const bg = isFog ? '#25113d' : (ec ? ec.bg : '#1c1630');
    const title = isFog ? '迷雾未知属性' : (ec ? `${ec.name}属性` : '');
    return `<span class="ico-el-gem ${isFog ? 'fog' : ''}" style="width:${size}px;height:${size}px;--el-col:${col};--el-bg:${bg}" title="${title}"><img src="./assets/icons/el_${elId}.png" alt="${title}" /></span>`;
  }

  function roleBadge(roleId, size = 20) {
    const { DATA } = window.MT;
    const rc = DATA && DATA.ROLES && DATA.ROLES[roleId];
    const title = rc ? `${rc.name} (${rc.desc})` : '';
    return `<span class="ico-role-gem" style="width:${size}px;height:${size}px" title="${title}"><img src="./assets/icons/role_${roleId}.png" alt="${title}" /></span>`;
  }

  function slotPlaceholder(slot) {
    if (slot === 'weapon') {
      return `<svg class="slot-ghost-ico" viewBox="0 0 24 24"><path fill="currentColor" d="M18.5 3.5l2 2-10 10 1.8 1.8-1.5 1.5-2.3-2.3-2.5 2.5-1.5-1.5 2.5-2.5-2.3-2.3 1.5-1.5 1.8 1.8z"/></svg>`;
    }
    return `<svg class="slot-ghost-ico" viewBox="0 0 24 24"><path fill="currentColor" d="M12 3l8 3.5v5.8c0 4.8-3.4 8-8 9.2-4.6-1.2-8-4.4-8-9.2V6.5L12 3zm0 3.2L6.8 8.5v3.6c0 3.2 2.2 5.4 5.2 6.4 3-1 5.2-3.2 5.2-6.4V8.5L12 6.2z"/></svg>`;
  }

  // Canvas helper: draws the EXACT SAME generated pixel PNG icon as DOM!
  function drawCanvasElementIcon(ctx, elId, cx, cy, r = 6) {
    const img = images.get(`el_${elId}`);
    const s = Math.round(r * 2.5);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (img) {
      ctx.drawImage(img, Math.round(cx - s / 2), Math.round(cy - s / 2), s, s);
    } else {
      const ec = window.MT.DATA && window.MT.DATA.ELEMENTS && window.MT.DATA.ELEMENTS[elId];
      ctx.fillStyle = ec ? ec.color : '#ffd966';
      ctx.fillRect(Math.round(cx - 3), Math.round(cy - 3), 6, 6);
    }
    ctx.restore();
  }

  window.MT.uiIcons = { load, elBadge, roleBadge, slotPlaceholder, drawCanvasElementIcon };
})();
