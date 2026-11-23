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

  // Razor-sharp 24x24 dark-gold 9-slice frame (slice=6: ALL 6px of the rail are continuous sculpted metal, zero invisible gaps!)
  function makeOrnatePlaque({ outer, hi, mid, lo, fill, gem, gemHi }) {
    const S = 24;
    const { c, ctx } = makeCanvas(S, S);
    const px = (x, y, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); };
    const rect = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };

    // Interior fill
    rect(5, 5, S - 10, S - 10, fill);

    // Layer 0 (y=0, x=0): Solid dark pixel outline with 1px chamfered corner
    rect(1, 0, S - 2, 1, outer);
    rect(1, S - 1, S - 2, 1, outer);
    rect(0, 1, 1, S - 2, outer);
    rect(S - 1, 1, 1, S - 2, outer);

    // Layer 1 (y=1, x=1): Bright top/left specular brass, deep bottom/right shadow
    rect(2, 1, S - 4, 1, hi);
    rect(1, 2, 1, S - 4, hi);
    rect(2, S - 2, S - 4, 1, lo);
    rect(S - 2, 2, 1, S - 4, lo);

    // Layer 2 & 3 (2px thick solid antique gold/iron rail all 4 sides)
    rect(2, 2, S - 4, 2, mid);
    rect(2, S - 4, S - 4, 2, mid);
    rect(2, 2, 2, S - 4, mid);
    rect(S - 4, 2, 2, S - 4, mid);

    // Layer 4: Crisp inner dark recess groove (separates metal frame from obsidian panel)
    rect(4, 4, S - 8, 1, outer);
    rect(4, S - 5, S - 8, 1, outer);
    rect(4, 4, 1, S - 8, outer);
    rect(S - 5, 4, 1, S - 8, outer);

    // Layer 5: Subtle inner top-light shelf inside the obsidian well
    rect(5, 5, S - 10, 1, 'rgba(255, 240, 200, 0.14)');
    rect(5, 5, 1, S - 10, 'rgba(255, 240, 200, 0.10)');

    // 4 Corner Studded Filigree Caps + Glowing Corner Gem
    const drawCorner = (cx, cy, sx, sy) => {
      px(cx + 1 * sx, cy + 1 * sy, outer);
      px(cx + 2 * sx, cy + 1 * sy, hi);
      px(cx + 1 * sx, cy + 2 * sy, hi);
      // 2x2 corner gem inset into the 4px corner plate
      px(cx + 2 * sx, cy + 2 * sy, gemHi || '#fff6cc');
      px(cx + 3 * sx, cy + 2 * sy, gem || hi);
      px(cx + 2 * sx, cy + 3 * sy, gem || hi);
      px(cx + 3 * sx, cy + 3 * sy, lo);
      // Inner corner notch accent
      px(cx + 4 * sx, cy + 4 * sy, mid);
      px(cx + 5 * sx, cy + 4 * sy, outer);
      px(cx + 4 * sx, cy + 5 * sy, outer);
    };
    drawCorner(0, 0, 1, 1);
    drawCorner(S - 1, 0, -1, 1);
    drawCorner(0, S - 1, 1, -1);
    drawCorner(S - 1, S - 1, -1, -1);

    return c.toDataURL('image/png');
  }

  // Sculpted 24x24 Pixel-Art RPG Button 9-slice (notched corners, glossy top bevel, deep bottom lip, side rivets)
  function makePixelButton({ outer, hi, top, body, bot, rivet }) {
    const S = 24;
    const { c, ctx } = makeCanvas(S, S);
    const px = (x, y, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); };
    const rect = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };

    rect(2, 2, S - 4, S - 4, body);
    rect(2, 2, S - 4, 3, top);
    rect(2, S - 5, S - 4, 3, bot);

    // Outer pixel border with chamfered corners
    rect(2, 0, S - 4, 1, outer);
    rect(2, S - 1, S - 4, 1, outer);
    rect(0, 2, 1, S - 4, outer);
    rect(S - 1, 2, 1, S - 4, outer);
    [[1, 1], [S - 2, 1], [1, S - 2], [S - 2, S - 2]].forEach(([x, y]) => px(x, y, outer));

    // Specular highlight & shadow bevel
    rect(2, 1, S - 4, 1, hi);
    rect(1, 2, 1, S - 5, hi);
    rect(2, S - 2, S - 4, 1, outer);
    rect(S - 2, 2, 1, S - 4, bot);

    // Corner rivets
    if (rivet) {
      [[3, 3], [S - 4, 3], [3, S - 4], [S - 4, S - 4]].forEach(([x, y]) => px(x, y, rivet));
    }
    return c.toDataURL('image/png');
  }

  // Carved Recessed Pixel Socket (for Squad Slots & Gear Slots)
  function makePixelSocket({ outer, rim, inner, corner }) {
    const S = 24;
    const { c, ctx } = makeCanvas(S, S);
    const px = (x, y, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); };
    const rect = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };

    rect(2, 2, S - 4, S - 4, inner);
    rect(2, 2, S - 4, 2, 'rgba(0,0,0,0.45)');
    rect(2, 2, 2, S - 4, 'rgba(0,0,0,0.38)');

    rect(2, 0, S - 4, 1, outer);
    rect(2, S - 1, S - 4, 1, outer);
    rect(0, 2, 1, S - 4, outer);
    rect(S - 1, 2, 1, S - 4, outer);
    rect(2, 1, S - 4, 1, rim);
    rect(1, 2, 1, S - 4, rim);
    rect(2, S - 2, S - 4, 1, rim);
    rect(S - 2, 2, 1, S - 4, rim);

    // 4 pixel claw corner teeth
    [[1, 1], [2, 1], [1, 2], [S - 2, 1], [S - 3, 1], [S - 2, 2], [1, S - 2], [2, S - 2], [1, S - 3], [S - 2, S - 2], [S - 3, S - 2], [S - 2, S - 3]]
      .forEach(([x, y]) => px(x, y, corner));

    return c.toDataURL('image/png');
  }

  // ─── v5.2 Procedural Luxury Textures (100% Pure Code Canvas Drawing) ───

  function makeParchmentGrainTexture() {
    const S = 128;
    const c = document.createElement('canvas');
    c.width = S; c.height = S;
    const ctx = c.getContext('2d');
    // Subtle deterministic pseudo-random grain + woven paper fibers
    let seed = 4219;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    for (let y = 0; y < S; y += 2) {
      const rowAlpha = 0.012 + rnd() * 0.022;
      ctx.fillStyle = rnd() > 0.5 ? `rgba(255, 224, 168, ${rowAlpha})` : `rgba(8, 4, 2, ${rowAlpha * 1.4})`;
      ctx.fillRect(0, y, S, 1);
    }
    for (let i = 0; i < 420; i++) {
      const x = Math.floor(rnd() * S);
      const y = Math.floor(rnd() * S);
      const w = 1 + Math.floor(rnd() * 3);
      const a = 0.02 + rnd() * 0.035;
      ctx.fillStyle = rnd() > 0.45 ? `rgba(255, 214, 150, ${a})` : `rgba(12, 6, 4, ${a * 1.5})`;
      ctx.fillRect(x, y, w, 1);
    }
    // Delicate distressed flecks
    for (let i = 0; i < 36; i++) {
      const x = Math.floor(rnd() * S);
      const y = Math.floor(rnd() * S);
      ctx.fillStyle = `rgba(92, 54, 24, ${0.06 + rnd() * 0.07})`;
      ctx.fillRect(x, y, 2, 2);
    }
    return c.toDataURL('image/png');
  }

  function makeAstrolabeTexture() {
    const W = 540, H = 320;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const cx = W * 0.5, cy = H * 0.46;

    // Fine engraved tactical astrolabe concentric rings
    const radii = [56, 108, 164, 226];
    radii.forEach((r, idx) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = idx === 1 ? 'rgba(212, 160, 72, 0.13)' : 'rgba(155, 175, 235, 0.075)';
      ctx.lineWidth = idx === 1 ? 1.2 : 1;
      if (idx === 2) ctx.setLineDash([4, 6]);
      else ctx.setLineDash([]);
      ctx.stroke();
    });
    ctx.setLineDash([]);

    // Compass radial ticks along the primary astrolabe ring
    for (let deg = 0; deg < 360; deg += 15) {
      const rad = (deg * Math.PI) / 180;
      const major = deg % 45 === 0;
      const r1 = major ? 100 : 104;
      const r2 = major ? 116 : 112;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(rad) * r1, cy + Math.sin(rad) * r1);
      ctx.lineTo(cx + Math.cos(rad) * r2, cy + Math.sin(rad) * r2);
      ctx.strokeStyle = major ? 'rgba(212, 160, 72, 0.22)' : 'rgba(155, 175, 235, 0.09)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Subtle crosshair axes
    ctx.beginPath();
    ctx.moveTo(28, cy); ctx.lineTo(W - 28, cy);
    ctx.moveTo(cx, 18); ctx.lineTo(cx, H - 18);
    ctx.strokeStyle = 'rgba(212, 160, 72, 0.07)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Small engraved diamond markers at cardinal points
    [[cx, cy - 108], [cx, cy + 108], [cx - 108, cy], [cx + 108, cy]].forEach(([x, y]) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = 'rgba(212, 160, 72, 0.28)';
      ctx.fillRect(-3, -3, 6, 6);
      ctx.restore();
    });
    return c.toDataURL('image/png');
  }

  function makeBrassFiligreeCorner() {
    // 22x22 pixel-art ornate brass corner bracket (top-left orientation)
    return drawGrid([
      'oooooooooooooooooooooo',
      'oHHHHHHHHHHHHHHHHHHHoo',
      'oHMMMMMMGGGGGGMMMMMMHo',
      'oHMGGMMMMMMMMMMMMMMMo.',
      'oHMGGMDooooooooooooo..',
      'oHMMMMo...............',
      'oHMMMooHHHo...........',
      'oHMMM.oHGHo...........',
      'oHGMo..oHoo...........',
      'oHGMo...oo............',
      'oHGMo.................',
      'oHGMo.................',
      'oHGMo.................',
      'oHGMo.................',
      'oHMMo.................',
      'oHMMo.................',
      'oHMMo.................',
      'oHMMo.................',
      'oHMMo.................',
      'oHMHo.................',
      'oHHo..................',
      'ooo...................'
    ], {
      o: '#0c0704',
      H: '#fff0b3',
      M: '#d49a35',
      G: '#ffe07d',
      D: '#6e420e'
    });
  }

  function injectPixelTheme() {
    const root = document.documentElement.style;

    // v5.2 Procedural Luxury Textures
    root.setProperty('--tex-parchment', `url("${makeParchmentGrainTexture()}")`);
    root.setProperty('--tex-astrolabe', `url("${makeAstrolabeTexture()}")`);
    root.setProperty('--tex-filigree-corner', `url("${makeBrassFiligreeCorner()}")`);

    // Ornate 36x36 Dark-Fantasy 9-Slice Plaques
    root.setProperty('--pxf-gold', `url("${makeOrnatePlaque({
      outer: '#090612', hi: '#ffe9a3', mid: '#c68d2e', lo: '#5e390c',
      fill: '#131226', fill2: '#1a1833', gem: '#4de8e8', gemHi: '#dcffff'
    })}")`);

    root.setProperty('--pxf-plum', `url("${makeOrnatePlaque({
      outer: '#090612', hi: '#8aa4e6', mid: '#48588a', lo: '#222a48',
      fill: '#101224', fill2: '#171a33', gem: '#ffd166', gemHi: '#fff5cc'
    })}")`);

    root.setProperty('--pxf-crimson', `url("${makeOrnatePlaque({
      outer: '#14040a', hi: '#ff7a95', mid: '#a81d38', lo: '#4f0a18',
      fill: '#1f0c18', fill2: '#2b1022', gem: '#ffd966', gemHi: '#fff4c2'
    })}")`);

    root.setProperty('--pxf-wood', `url("${makeOrnatePlaque({
      outer: '#12080a', hi: '#d69952', mid: '#875224', lo: '#45240e',
      fill: '#1d121a', fill2: '#261722', gem: '#ffae42', gemHi: '#fff0b8'
    })}")`);

    root.setProperty('--pxf-parchment', `url("${makeParchmentSlice()}")`);

    // Sculpted 24x24 Pixel Buttons
    root.setProperty('--pxb-amber', `url("${makePixelButton({
      outer: '#140903', hi: '#fff0ad', top: '#d99a32', body: '#9e6416', bot: '#5c3408', rivet: '#ffe699'
    })}")`);
    root.setProperty('--pxb-cyan', `url("${makePixelButton({
      outer: '#06121a', hi: '#a8ffff', top: '#257c94', body: '#155066', bot: '#0b2c3b', rivet: '#7effef'
    })}")`);
    root.setProperty('--pxb-crimson', `url("${makePixelButton({
      outer: '#1a040a', hi: '#ff9eb0', top: '#b82844', body: '#80162c', bot: '#4a0916', rivet: '#ffd166'
    })}")`);
    root.setProperty('--pxb-iron', `url("${makePixelButton({
      outer: '#090b14', hi: '#9eb4e0', top: '#3a4668', body: '#242c47', bot: '#14192b', rivet: '#cbd8f5'
    })}")`);

    // Carved Recessed Pixel Sockets
    root.setProperty('--pxs-socket', `url("${makePixelSocket({
      outer: '#070812', rim: '#3b4870', inner: '#0d0f20', corner: '#c68d2e'
    })}")`);

    for (const [k, url] of Object.entries(ICONS)) {
      root.setProperty(`--px-${k}`, `url("${url}")`);
    }
  }

  window.MT.pixelArt = { injectPixelTheme, ICONS };
})();
