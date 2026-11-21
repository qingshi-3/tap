// Procedural 16-bit Pixel-Art 9-Slice Frame & Icon Factory (Zero emojis, Zero border-radius)
(function () {
  window.MT = window.MT || {};

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    return { c, ctx };
  }

  function drawGrid(grid, palette, scale = 1) {
    const h = grid.length;
    const w = grid[0].length;
    const { c, ctx } = makeCanvas(w * scale, h * scale);
    for (let y = 0; y < h; y++) {
      const row = grid[y];
      for (let x = 0; x < w; x++) {
        const ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        const col = palette[ch];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
    return c.toDataURL('image/png');
  }

  // Generate 24x24 pixel-art 9-slice frame with chamfered corners, bevels, and corner rivets
  function makeNineSlice({ outer, hi, mid, lo, fill, rivet, dither }) {
    const S = 24;
    const { c, ctx } = makeCanvas(S, S);
    const px = (x, y, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); };

    // Fill interior
    ctx.fillStyle = fill;
    ctx.fillRect(2, 2, S - 4, S - 4);
    if (dither) {
      ctx.fillStyle = dither;
      for (let y = 4; y < S - 4; y++) {
        for (let x = 4; x < S - 4; x++) {
          if ((x + y) % 2 === 0) ctx.fillRect(x, y, 1, 1);
        }
      }
    }

    // Chamfered outer dark pixel outline (2px notch at corners)
    for (let i = 2; i < S - 2; i++) {
      px(i, 0, outer);
      px(i, S - 1, outer);
      px(0, i, outer);
      px(S - 1, i, outer);
    }
    // Corner diagonal pixels
    [[1, 1], [S - 2, 1], [1, S - 2], [S - 2, S - 2]].forEach(([x, y]) => px(x, y, outer));

    // Inner bright/mid/dark bevel ring
    for (let i = 2; i < S - 2; i++) {
      px(i, 1, hi);
      px(1, i, hi);
      px(i, S - 2, lo);
      px(S - 2, i, lo);
    }
    for (let i = 3; i < S - 3; i++) {
      px(i, 2, mid);
      px(2, i, mid);
      px(i, S - 3, mid);
      px(S - 3, i, mid);
    }
    // Inner dark inset line
    for (let i = 3; i < S - 3; i++) {
      px(i, 3, outer);
      px(3, i, outer);
      px(i, S - 4, outer);
      px(S - 4, i, outer);
    }

    // Corner ornamental brass/gold rivets
    if (rivet) {
      [[2, 2], [S - 3, 2], [2, S - 3], [S - 3, S - 3]].forEach(([x, y]) => px(x, y, rivet));
    }
    return c.toDataURL('image/png');
  }

  // Torn pixel parchment 9-slice frame
  function makeParchmentSlice() {
    const S = 24;
    const { c, ctx } = makeCanvas(S, S);
    const px = (x, y, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); };
    ctx.fillStyle = '#e7d2a4';
    ctx.fillRect(2, 2, S - 4, S - 4);
    // Subtle aged paper pixel grain
    ctx.fillStyle = '#ddc38d';
    for (let y = 4; y < S - 4; y += 2) {
      for (let x = 4; x < S - 4; x += 3) px(x + (y % 2), y, '#ddc38d');
    }
    // Dark ink border + burnt amber inner edge
    for (let i = 2; i < S - 2; i++) {
      px(i, 0, '#2a1610');
      px(i, S - 1, '#2a1610');
      px(0, i, '#2a1610');
      px(S - 1, i, '#2a1610');
      px(i, 1, '#a9773f');
      px(i, S - 2, '#7c5227');
      px(1, i, '#9a6b37');
      px(S - 2, i, '#7c5227');
      px(i, 2, '#f5e7c4');
      px(2, i, '#f5e7c4');
      px(i, S - 3, '#c8aa74');
      px(S - 3, i, '#c8aa74');
    }
    [[1, 1], [S - 2, 1], [1, S - 2], [S - 2, S - 2]].forEach(([x, y]) => px(x, y, '#2a1610'));
    // Corner nails
    [[3, 3], [S - 4, 3], [3, S - 4], [S - 4, S - 4]].forEach(([x, y]) => px(x, y, '#54321c'));
    return c.toDataURL('image/png');
  }

  // Hand-pixelated 16x16 icons (zero emojis!)
  const ICONS = {
    moon: drawGrid([
      '......oooo......',
      '....ooYYYYoo....',
      '...oYYWWWWYYo...',
      '..oYYWWoo....o..',
      '.oYYWWo.........',
      '.oYYWo..........',
      'oYYWWo..........',
      'oYYWWo..........',
      'oYYWWo..........',
      'oYYWWo..........',
      '.oYYWo......o...',
      '.oYYWWo...ooYo..',
      '..oYYWWoooYYYo..',
      '...oYYYYYYYYo...',
      '....ooGGGGoo....',
      '......oooo......'
    ], { o: '#160b24', Y: '#ffd452', W: '#fff5c2', G: '#c9881c' }),

    coin: drawGrid([
      '.....oooooo.....',
      '...ooYYYYYYoo...',
      '..oYYWWWWWWYYo..',
      '.oYWWGGGGGGWWYo.',
      '.oYWGGYYYYGGWYo.',
      'oYWGYYWWWWYYGWYo',
      'oYWGYYWGGWYYGWYo',
      'oYWGYYWGGWYYGWYo',
      'oYWGYYWGGWYYGWYo',
      'oYWGYYWWWWYYGWYo',
      '.oYWGGYYYYGGWYo.',
      '.oYWWGGGGGGWWYo.',
      '..oYYGGGGGGYYo..',
      '...ooGGGGGGoo...',
      '.....oooooo.....',
      '................'
    ], { o: '#1b0d1e', Y: '#f7c948', W: '#fff4b8', G: '#b87414' }),

    star: drawGrid([
      '.......oo.......',
      '......oWWo......',
      '......oYYo......',
      '.....oWYYYo.....',
      '.ooooWYYYYYoooo.',
      'oWWYYYYYYYYYYGG.',
      '.oWYYYYYYYYYGGo.',
      '..oYYYYYYYYGGo..',
      '...oYYYYYYGGo...',
      '...oYYYYYYGGo...',
      '..oYYYGGGGYYGo..',
      '..oYYGo..oGYGo..',
      '.oYYGo....oGGo..',
      '.oGGo......oGo..',
      '..oo........oo..',
      '................'
    ], { o: '#170a24', W: '#fff7cc', Y: '#ffd452', G: '#c47e18' }),

    scroll: drawGrid([
      '...oooooooooo...',
      '..oBBBBBBBBBBoo.',
      '.oBPPPPPPPPPPBBo',
      '..ooPPPPPPPPoo..',
      '...oPPIIIIPPo...',
      '...oPPPPPPPPo...',
      '...oPPIIIIPPo...',
      '...oPPPPPPPPo...',
      '...oPPIIIRPPo...',
      '...oPPPPPRRPo...',
      '...oPPPPPPPPo...',
      '..ooPPPPPPPPoo..',
      '.oBPPPPPPPPPPBBo',
      '..oBBBBBBBBBBoo.',
      '...oooooooooo...',
      '................'
    ], { o: '#1a0c1c', B: '#94622b', P: '#f2dfb4', I: '#6e4726', R: '#d62828' }),

    rum: drawGrid([
      '......oRRoo.....',
      '.....oRYYRRo....',
      '....oRYWWYRo....',
      '.....oRRRRo.....',
      '....oooooooo....',
      '...oGWWWWWWGo...',
      '...oGFFFFFFGo...',
      '...oGFFYYFFGo...',
      '...oGFFFFFFGo...',
      '....oGFFFFGo....',
      '.....oGGGGoo....',
      '......oGGoo.....',
      '......oGGoo.....',
      '....ooBBBBoo....',
      '...oBBBBBBBBo...',
      '...oooooooooo...'
    ], { o: '#180a1c', R: '#ff4d24', Y: '#ffd166', W: '#fff6cc', G: '#b8d4e8', F: '#e85d22', B: '#c98e2d' }),

    absinthe: drawGrid([
      '......oooo......',
      '.....oBBBBo.....',
      '.....oBYYBo.....',
      '......oooo......',
      '.....oGWWGo.....',
      '....oGWWWWGo....',
      '...oGGEEEEGGo...',
      '..oGEELLLLLEGo..',
      '..oGELWWWWLEGo..',
      '..oGEEEEEEEEGo..',
      '..oGEEEEEEDEGo..',
      '..oGDDDDDDDDGo..',
      '...oGDDDDDDGo...',
      '....oGGGGGGoo...',
      '.....oooooo.....',
      '................'
    ], { o: '#130b1f', B: '#9c632b', Y: '#e8b954', G: '#88c9c2', W: '#d9fff5', E: '#35d495', L: '#7effcc', D: '#17875c' }),

    ale: drawGrid([
      '....oooooooo....',
      '...oWWWWWWWWo...',
      '..oWWYYYYYYWWo..',
      '..oWWWWWWWWWWoo.',
      '..oBCCCCCCCCBBo.',
      '..oBCLLLLLLCBBo.',
      '..oBCLLLLLLCB.o.',
      '..oBCCCCCCCCB.o.',
      '..oBCCCCCCCCBBo.',
      '..oBCCCCCCCCBBo.',
      '..oBDDDDDDDDBoo.',
      '..oBDDDDDDDDBo..',
      '..oBBBBBBBBBBo..',
      '...oooooooooo...',
      '................',
      '................'
    ], { o: '#160b22', W: '#ffffff', Y: '#d9f2ff', B: '#c9933b', C: '#49b6ff', L: '#9ce0ff', D: '#2272b8' }),

    sword: drawGrid([
      '.............oo.',
      '............oWWo',
      '...........oWSSo',
      '..........oWSSo.',
      '.........oWSSo..',
      '........oWSSo...',
      '.......oWSSo....',
      '...oo.oWSSo.....',
      '..oGGoSSSo......',
      '...oGGSSo.......',
      '....oGGGo.......',
      '...oBBGGGo......',
      '..oBBo.oGGo.....',
      '.oGGo...oo......',
      '.ooo............',
      '................'
    ], { o: '#160b20', W: '#ffffff', S: '#9fb7d6', G: '#f5cb5c', B: '#7d4427' }),

    skull: drawGrid([
      '....oooooooo....',
      '..ooWWWWWWWWoo..',
      '.oWWCCCCCCCCWWo.',
      '.oWCCCCCCCCCCWo.',
      'oWCCCCCCCCCCCCWo',
      'oWCCooCCCCooCCWo',
      'oWCoRRoCCoRRoCWo',
      'oWCCooCCCCooCCWo',
      '.oWCCCCooCCCCWo.',
      '.oWCCCooooCCCWo.',
      '..ooCCCCCCCCoo..',
      '...oCCoCCoCCo...',
      '...oCCoCCoCCo...',
      '....oooooooo....',
      '................',
      '................'
    ], { o: '#1a0814', W: '#fff2f2', C: '#d6c5d9', R: '#ff3b5c' }),

    wax: drawGrid([
      '.....oooooo.....',
      '...ooRRRRRRoo...',
      '..oRRLLLLLLRRo..',
      '.oRLLRRRRRRLLRo.',
      '.oRLRYYYYYYRLRo.',
      'oRLRYYWWWWYYRLRo',
      'oRLRYWYYYYWYRLRo',
      'oRLRYYYYYYYYRLRo',
      'oRLRYRYYYYRYRLRo',
      'oRLRYYRRRRYYRLRo',
      '.oRLRRRRRRRRLRo.',
      '.oRDDDDDDDDDDRo.',
      '..oRRDDDDDDRRo..',
      '...ooDDDDDDoo...',
      '.....oooooo.....',
      '................'
    ], { o: '#2b050b', R: '#c9182b', L: '#ff5c72', D: '#780816', Y: '#ffd166', W: '#fff4c2' }),

    hammer: drawGrid([
      '......oooooo....',
      '.....oSSSSSSo...',
      '....oSWWWWWSSo..',
      '....oSSSSSSSSo..',
      '.....ooGGooSSo..',
      '......oBBo.oo...',
      '.....oBBoo......',
      '....oBBoo.......',
      '...oBBoo........',
      '..oBBoo.........',
      '.oBBoo..........',
      '.oGGo...........',
      '..oo............',
      '................',
      '................',
      '................'
    ], { o: '#160b20', S: '#9db4cc', W: '#e6f2ff', G: '#f5cb5c', B: '#8c5228' }),

    eye: drawGrid([
      '................',
      '................',
      '....oooooooo....',
      '..ooGGGGGGGGoo..',
      '.oGGWWWWWWWWGGo.',
      'oGWWEEEEEEEEWWGo',
      'oGWEEooLLooEEWGo',
      'oGWEEoLWWLoEEWGo',
      'oGWEEooLLooEEWGo',
      'oGWWEEEEEEEEWWGo',
      '.oGGWWWWWWWWGGo.',
      '..ooGGGGGGGGoo..',
      '....oooooooo....',
      '................',
      '................',
      '................'
    ], { o: '#0e0a1a', G: '#4de8a8', W: '#e0fff5', E: '#1fa372', L: '#8affd4' }),

    lock: drawGrid([
      '.....oooooo.....',
      '....oSSSSSSo....',
      '...oSSooooSSo...',
      '...oSo....oSo...',
      '...oSo....oSo...',
      '..oooooooooooo..',
      '..oGGGGGGGGGGoo.',
      '..oGYYYYYYYYGGo.',
      '..oGYooYYooYGGo.',
      '..oGYooYYooYGGo.',
      '..oGYYYooYYYGGo.',
      '..oGYYYooYYYGGo.',
      '..oGGGGGGGGGGGo.',
      '..ooooooooooooo.',
      '................',
      '................'
    ], { o: '#1c0e18', S: '#9aa7b8', G: '#b87d28', Y: '#f5cb5c' }),

    sack: drawGrid([
      '.....oooooo.....',
      '....oBBYYBBo....',
      '.....oBBBBoo....',
      '....ooRRRRoo....',
      '...oBYYYYYYBo...',
      '..oBYYYYYYYYBo..',
      '.oBYYBBBBBBYYBo.',
      '.oBYBBGGGGGBYBo.',
      '.oBYBGGYYGGBYBo.',
      '.oBYBBGGGGGBYBo.',
      '.oBYYBBBBBBYYBo.',
      '..oBYYYYYYYYBo..',
      '..oBDDDDDDDDBo..',
      '...oDDDDDDDDoo..',
      '....oooooooo....',
      '................'
    ], { o: '#1e0e14', B: '#a36b32', Y: '#d9a45b', D: '#6e421c', R: '#d62828', G: '#ffd452' })
  };

  function injectPixelTheme() {
    const root = document.documentElement.style;

    // 9-slice pixel frames
    root.setProperty('--pxf-gold', `url("${makeNineSlice({
      outer: '#12081c', hi: '#fff0ad', mid: '#d69e32', lo: '#7d4f12',
      fill: '#201233', rivet: '#fff6cc', dither: 'rgba(255,215,120,0.03)'
    })}")`);

    root.setProperty('--pxf-plum', `url("${makeNineSlice({
      outer: '#0e0717', hi: '#7c53a8', mid: '#4b2f6e', lo: '#26153b',
      fill: '#180e28', rivet: '#d4a348', dither: 'rgba(190,140,255,0.03)'
    })}")`);

    root.setProperty('--pxf-wood', `url("${makeNineSlice({
      outer: '#170a10', hi: '#b5763c', mid: '#7d4924', lo: '#472514',
      fill: '#2a151c', rivet: '#f5cb5c', dither: 'rgba(255,190,120,0.03)'
    })}")`);

    root.setProperty('--pxf-crimson', `url("${makeNineSlice({
      outer: '#1f050c', hi: '#ff758f', mid: '#b5172a', lo: '#5e0814',
      fill: '#330c19', rivet: '#ffd166', dither: null
    })}")`);

    root.setProperty('--pxf-parchment', `url("${makeParchmentSlice()}")`);

    for (const [k, url] of Object.entries(ICONS)) {
      root.setProperty(`--px-${k}`, `url("${url}")`);
    }
  }

  window.MT.pixelArt = { injectPixelTheme, ICONS };
})();
