// 100% Pure-Code 16-Bit Pixel-Art Midnight Tavern Scene Renderer (320x180 virtual grid -> 4x 1280x720)
// Zero static AI background patches, zero seam mismatches, unified pixel grid across architecture, props & live VFX.
(function () {
  window.MT = window.MT || {};

  const VW = 320;
  const VH = 180;

  // Deterministic pseudo-random helper for wood grain & stone brick variation
  function hash2(x, y, seed = 1) {
    let n = Math.imul(x + 37, 374761393) + Math.imul(y + 17, 668265263) + Math.imul(seed, 1442695041);
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }

  // Handcrafted pixel-art matrix stamp helper (zero blocky fillRect boxes!)
  function drawMatrix(ctx, ox, oy, rows, pal) {
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        const col = pal[ch];
        if (col) {
          ctx.fillStyle = col;
          ctx.fillRect(ox + x, oy + y, 1, 1);
        }
      }
    }
  }

  // Handcrafted 16-bit Pixel-Art Tavern Props (curved silhouettes, 3-tone shading, specular highlights!)
  const PROP_MATRICES = {
    barstool: {
      rows: [
        '....oooooooo....',
        '..ooHHHHHHHHoo..',
        '.oHHRRRRRRRRHHo.',
        'oHRRRRRRRRRRRHRo',
        'oRRRRRRRRRRRRRRo',
        'oDDDDDDDDDDDDDDo',
        '.ooGoDGoGoDGoGo.',
        '..oooooooooooo..',
        '...oWLo..oLWo...',
        '...oWDo..oDWo...',
        '...oWDo..oDWo...',
        '..oWWDo..oDWWo..',
        '..oWDo....oDWo..',
        '..ooo......ooo..'
      ],
      pal: { o: '#150809', H: '#e34256', R: '#a61c32', D: '#6b1020', G: '#ffd966', W: '#592c14', L: '#9c5628' }
    },
    oakStool: {
      rows: [
        '..oooooooo..',
        '.oHHHHHHHHo.',
        'oHMMMMMMMMHo',
        'oMMMMMMMMMMo',
        '.oDDDDDDDDo.',
        '..oooooooo..',
        '..oMDo.oDMo.',
        '..oMDo.oDMo.',
        '..oDDo.oDDo.',
        '..ooo...ooo.'
      ],
      pal: { o: '#160906', H: '#d68c3e', M: '#945222', D: '#542a12' }
    },
    barrel: {
      rows: [
        '....oooooooooo....',
        '..ooMMHHHHHHMMoo..',
        '.oMMHHHHHHHHHHMMo.',
        '.oIIIIIIIIIIIIIIo.',
        'oIMMHSMMHSMMHSMMIo',
        'oMHHSMMHSMMHSMMHMo',
        'oMHHSMMHSMMHSMMHMo',
        'oMHHSMMHSMMHSGGBBo',
        'oMHHSMMHSMMHSMGGGo',
        'oMHHSMMHSMMHSMMHMo',
        'oDDDSDDDSDDDSDDDMo',
        '.oIIIIIIIIIIIIIIo.',
        '.oDDDDDDDDDDDDDDo.',
        '..ooDDDDDDDDDDoo..',
        '....oooooooooo....'
      ],
      pal: { o: '#140806', H: '#b36b32', M: '#874b20', S: '#4a240e', D: '#5e3114', I: '#464159', G: '#ffd966', B: '#9c6419' }
    },
    poinsettia: {
      rows: [
        '.....oo..oo.....',
        '....oRRo.oRRo...',
        '..ooRLLRoRLLRoo.',
        '.oGRRLLYYLLRRGo.',
        '.oGGRRYYYYRRGGo.',
        '..oGRRLLRRLLGo..',
        '...ooGRRRRGo....',
        '....oPPPPPpo....',
        '....oPLLLPPo....',
        '.....oPPPPo.....',
        '.....oDDDDpo....',
        '......oooo......'
      ],
      pal: { o: '#140808', R: '#c92638', L: '#ff596c', Y: '#ffd966', G: '#356e28', P: '#8a4f38', p: '#5c3122', D: '#4a2518' }
    },
    pitcher: {
      rows: [
        '....ooooo....',
        '...oGHHGGo...',
        '....oGHGo....',
        '...oGHHHGo...',
        '..oGHHGGGoGo.',
        '..oGHHGGGGoGo',
        '..oGHGGGDGoGo',
        '..oGGGGDDGoo.',
        '...oGGDDDo...',
        '....ooooo....'
      ],
      pal: { o: '#180c06', H: '#fff2b3', G: '#e0a238', D: '#8c5316' }
    },
    lantern: {
      rows: [
        '....oooo....',
        '...oGHHGo...',
        '..oooooooo..',
        '..oGYYYYGo..',
        '..oGYWWYGo..',
        '..oGYWWYGo..',
        '..oGYYYYGo..',
        '..oGDDDDGo..',
        '..oooooooo..',
        '...oGGGGoo..',
        '....oooo....'
      ],
      pal: { o: '#160b06', H: '#fff2b3', G: '#cf9130', Y: '#ffd966', W: '#ffffff', D: '#e88b25' }
    },
    mug: {
      rows: [
        '.oooooo...',
        'oWWWWWWo..',
        'oWWFFWWooo',
        'oAAHHAAoAo',
        'oAAHHAAoAo',
        'oAAHHAAooo',
        'oDDDDDDo..',
        '.oooooo...'
      ],
      pal: { o: '#160906', W: '#ffffff', F: '#ffe8bd', H: '#f7c14d', A: '#c97c24', D: '#784114' }
    },
    candelabra: {
      rows: [
        '......oWJo......',
        '..oWo.oWJo.oWo..',
        '..oWJoWJJooWJo..',
        '..oWJoWJJooWJo..',
        '..oWJoWJJooWJo..',
        '..oWJoWJJooWJo..',
        '.ooGGooGGooGGoo.',
        'oGHHHHHHHHHHHHGo',
        '.oGGGGDDDDGGGGo.',
        '..oooooooooooo..'
      ],
      pal: { o: '#170b06', W: '#fff6de', J: '#d9c39a', H: '#ffe699', G: '#cf9130', D: '#804c14' }
    }
  };

  class TavernScene {
    constructor() {
      this.cache = {}; // level -> offscreen 320x180 static architecture canvas
    }

    getRoomCanvas(level) {
      const lv = Math.max(1, Math.min(3, level || 1));
      if (!this.cache[lv]) {
        const c = document.createElement('canvas');
        c.width = VW;
        c.height = VH;
        const ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        this.bakeRoom(ctx, lv);
        this.cache[lv] = c;
      }
      return this.cache[lv];
    }

    // ─── Bake 320x180 16-Bit Pixel-Art Architecture & Static Props ───
    bakeRoom(ctx, lv) {
      this.drawFloorboards(ctx, lv);
      this.drawBackWall(ctx, lv);
      this.drawBountyBoard(ctx);
      this.drawBackWallSconces(ctx);
      this.drawLeftBarArea(ctx, lv);
      this.drawTables(ctx, lv);
    }

    drawFloorboards(ctx, lv) {
      const plankH = 10;
      const woodBase = lv === 3
        ? ['#5c321c', '#663820', '#542d18', '#60351e']
        : ['#61361e', '#6b3c22', '#58301a', '#653920'];

      for (let row = 0; row < 16; row++) {
        const y = 26 + row * plankH;
        const offset = (row % 2) * 24 + Math.floor(hash2(row, 1, 7) * 14);
        let x = -offset;
        let idx = 0;
        while (x < VW) {
          const pw = 42 + Math.floor(hash2(idx, row, 13) * 26);
          const col = woodBase[Math.floor(hash2(idx, row, 29) * woodBase.length)];

          // Plank fill
          ctx.fillStyle = col;
          ctx.fillRect(x, y, pw, plankH);

          // Top warm bevel highlight
          ctx.fillStyle = 'rgba(255, 196, 130, 0.10)';
          ctx.fillRect(x + 1, y + 1, pw - 2, 1);

          // Subtle pixel wood-grain streaks
          for (let g = 0; g < 3; g++) {
            const gx = x + 4 + Math.floor(hash2(idx * 7 + g, row, 41) * Math.max(4, pw - 10));
            const gy = y + 3 + (g % 2) * 3;
            const gw = 5 + Math.floor(hash2(g, row * 3 + idx, 53) * 10);
            ctx.fillStyle = g % 2 === 0 ? 'rgba(28, 12, 6, 0.24)' : 'rgba(255, 188, 115, 0.06)';
            ctx.fillRect(gx, gy, Math.min(gw, x + pw - gx - 2), 1);
          }

          // Plank dark grooves (bottom & right seam)
          ctx.fillStyle = '#24110a';
          ctx.fillRect(x, y + plankH - 1, pw, 1);
          ctx.fillRect(x + pw - 1, y, 1, plankH);

          // Iron nail heads near plank joints
          ctx.fillStyle = '#1d0d08';
          ctx.fillRect(x + 2, y + 2, 1, 1);
          ctx.fillRect(x + 2, y + plankH - 3, 1, 1);
          ctx.fillRect(x + pw - 3, y + 2, 1, 1);
          ctx.fillRect(x + pw - 3, y + plankH - 3, 1, 1);

          x += pw;
          idx++;
        }
      }

      // Lv.2 / Lv.3 Center Crimson & Gold Tavern Carpet
      if (lv >= 2) {
        const rx = 186, ry = 42, rw = 34, rh = 118;
        ctx.fillStyle = '#18080c';
        ctx.fillRect(rx - 1, ry - 1, rw + 2, rh + 2);
        ctx.fillStyle = '#6e1928';
        ctx.fillRect(rx, ry, rw, rh);
        ctx.fillStyle = '#d49a35';
        ctx.fillRect(rx + 2, ry + 2, rw - 4, 1);
        ctx.fillRect(rx + 2, ry + rh - 3, rw - 4, 1);
        ctx.fillRect(rx + 2, ry + 2, 1, rh - 4);
        ctx.fillRect(rx + rw - 3, ry + 2, 1, rh - 4);
        // Repeating gold diamond motif
        for (let cy = ry + 14; cy < ry + rh - 12; cy += 22) {
          ctx.fillStyle = '#8c2235';
          ctx.fillRect(rx + 10, cy - 4, 14, 9);
          ctx.fillStyle = '#e8b954';
          ctx.fillRect(rx + 16, cy - 3, 2, 7);
          ctx.fillRect(rx + 13, cy, 8, 1);
        }
      }

      // Wall cast shadow onto top floorboards
      ctx.fillStyle = 'rgba(10, 5, 16, 0.48)';
      ctx.fillRect(0, 26, VW, 5);
      ctx.fillStyle = 'rgba(10, 5, 16, 0.22)';
      ctx.fillRect(0, 31, VW, 4);
    }

    drawBackWall(ctx, lv) {
      const wallH = 26;
      ctx.fillStyle = '#201828';
      ctx.fillRect(0, 0, VW, wallH);

      // Staggered carved stone bricks
      const brickH = 6;
      const stoneCols = ['#3c2f42', '#44354a', '#35293b', '#48384e'];
      for (let row = 0; row < 4; row++) {
        const y = row * brickH;
        const off = (row % 2) * 8;
        for (let x = -off; x < VW; x += 16) {
          const bw = 15;
          const col = stoneCols[Math.floor(hash2(x, row, 71) * stoneCols.length)];
          ctx.fillStyle = col;
          ctx.fillRect(x, y, bw, brickH - 1);
          // Top stone edge highlight
          ctx.fillStyle = 'rgba(210, 195, 235, 0.12)';
          ctx.fillRect(x, y, bw, 1);
          // Bottom bevel shadow
          ctx.fillStyle = 'rgba(12, 8, 20, 0.35)';
          ctx.fillRect(x, y + brickH - 2, bw, 1);
        }
      }

      // Dark oak trim molding along base of stone wall
      ctx.fillStyle = '#180d12';
      ctx.fillRect(0, 24, VW, 3);
      ctx.fillStyle = '#4f2c1b';
      ctx.fillRect(0, 25, VW, 1);

      // Hanging tavern ivy vines near left wall
      const ivy = [[24, 2, 5], [30, 4, 8], [36, 1, 6], [44, 3, 7], [50, 2, 4]];
      for (const [ix, iy, ih] of ivy) {
        ctx.fillStyle = '#1d3a1f';
        ctx.fillRect(ix, iy, 3, ih);
        ctx.fillStyle = '#386b2d';
        ctx.fillRect(ix, iy + 1, 2, Math.max(2, ih - 2));
        ctx.fillStyle = '#5a943d';
        ctx.fillRect(ix, iy + 1, 1, 2);
      }

      // 2 Gothic Arched Window Frames (Glass interior is kept deep night-blue; rain draws LIVE inside!)
      for (const wx of [112, 202]) {
        const ww = 35, wh = 19;
        // Stone recess outer border
        ctx.fillStyle = '#140e1c';
        ctx.fillRect(wx - 2, 0, ww + 4, wh + 3);
        ctx.fillStyle = '#4e3f57';
        ctx.fillRect(wx - 1, 0, ww + 2, wh + 1);
        // Deep midnight glass backing
        ctx.fillStyle = '#111a3d';
        ctx.fillRect(wx, 0, ww, wh);
        ctx.fillStyle = '#19295c';
        ctx.fillRect(wx + 2, 2, ww - 4, wh - 5);
        ctx.fillStyle = '#243c7a';
        ctx.fillRect(wx + 4, 11, ww - 8, 5);
        // Beveled stone windowsill
        ctx.fillStyle = '#120c18';
        ctx.fillRect(wx - 3, wh, ww + 6, 4);
        ctx.fillStyle = '#62526d';
        ctx.fillRect(wx - 2, wh, ww + 4, 2);
        ctx.fillStyle = '#3d3147';
        ctx.fillRect(wx - 2, wh + 2, ww + 4, 1);
      }
    }

    // Drawn AFTER live window rain so iron window mullions sit crisply IN FRONT of the falling rain!
    drawWindowMullions(ctx) {
      ctx.save();
      for (const wx of [112, 202]) {
        const ww = 35, wh = 19;
        ctx.fillStyle = '#14101e';
        // Vertical iron bars
        ctx.fillRect(wx + 11, 0, 2, wh);
        ctx.fillRect(wx + 22, 0, 2, wh);
        // Horizontal iron bars
        ctx.fillRect(wx, 6, ww, 2);
        ctx.fillRect(wx, 13, ww, 2);
        // Subtle moonlight glint on inner bar edge
        ctx.fillStyle = 'rgba(160, 205, 255, 0.25)';
        ctx.fillRect(wx + 12, 0, 1, wh);
        ctx.fillRect(wx + 23, 0, 1, wh);
      }
      ctx.restore();
    }

    drawBackWallSconces(ctx) {
      // Center forged iron wall sconce between the two arched windows (zero HUD overlap!)
      const xs = [176];
      for (const cx of xs) {
        // Wall iron backplate with bevel & rivets
        ctx.fillStyle = '#110d17';
        ctx.fillRect(cx - 3, 9, 6, 13);
        ctx.fillStyle = '#3b354a';
        ctx.fillRect(cx - 2, 10, 4, 11);
        ctx.fillStyle = '#6b6380';
        ctx.fillRect(cx - 2, 10, 1, 10);
        // Wooden handle
        ctx.fillStyle = '#160b07';
        ctx.fillRect(cx - 2, 11, 4, 8);
        ctx.fillStyle = '#784624';
        ctx.fillRect(cx - 1, 12, 2, 6);
        // Iron ring & pitch cup rim
        ctx.fillStyle = '#120d17';
        ctx.fillRect(cx - 4, 9, 8, 4);
        ctx.fillStyle = '#5c546e';
        ctx.fillRect(cx - 3, 10, 6, 2);
        ctx.fillStyle = '#9c92b0';
        ctx.fillRect(cx - 3, 10, 6, 1);
      }
    }

    drawBountyBoard(ctx) {
      // Positioned cleanly above the bar counter (vx: 56..102, vy: 13..39 -> 1280x720: x 224..408, y 52..156, clear below top HUD!)
      const bx = 56, by = 13, bw = 46, bh = 24;
      // Brass hanging chains from upper wall
      ctx.fillStyle = '#8a5d20';
      ctx.fillRect(bx + 7, 10, 1, 4);
      ctx.fillRect(bx + bw - 8, 10, 1, 4);
      ctx.fillStyle = '#ffd966';
      ctx.fillRect(bx + 7, 11, 1, 1);
      ctx.fillRect(bx + bw - 8, 11, 1, 1);

      // Cast wall shadow
      ctx.fillStyle = 'rgba(8, 4, 14, 0.58)';
      ctx.fillRect(bx + 1, by + 2, bw, bh);

      // Outer dark ink frame
      ctx.fillStyle = '#140805';
      ctx.fillRect(bx, by, bw, bh);
      // Carved golden-oak frame with corner brass rivets
      ctx.fillStyle = '#8f5222';
      ctx.fillRect(bx + 1, by + 1, bw - 2, bh - 2);
      ctx.fillStyle = '#d48d3b';
      ctx.fillRect(bx + 2, by + 1, bw - 4, 1);
      ctx.fillRect(bx + 1, by + 2, 1, bh - 4);
      ctx.fillStyle = '#542a10';
      ctx.fillRect(bx + 2, by + bh - 2, bw - 4, 1);
      // 4 brass corner studs
      ctx.fillStyle = '#ffe082';
      ctx.fillRect(bx + 2, by + 2, 1, 1);
      ctx.fillRect(bx + bw - 3, by + 2, 1, 1);
      ctx.fillRect(bx + 2, by + bh - 3, 1, 1);
      ctx.fillRect(bx + bw - 3, by + bh - 3, 1, 1);

      // Recessed dark corkboard interior
      ctx.fillStyle = '#29150d';
      ctx.fillRect(bx + 3, by + 3, bw - 6, bh - 6);
      ctx.fillStyle = '#3d2215';
      ctx.fillRect(bx + 4, by + 4, bw - 8, bh - 8);

      // 3 Rich Pinned Parchment Wanted Notices with wax seals & scribble lines
      const notes = [
        { x: bx + 5,  y: by + 5,  w: 10, h: 12, pin: '#e02b3b' },
        { x: bx + 17, y: by + 6,  w: 12, h: 13, pin: '#ffd966' },
        { x: bx + 31, y: by + 5,  w: 10, h: 11, pin: '#c07aff' }
      ];
      for (const n of notes) {
        ctx.fillStyle = '#170b07';
        ctx.fillRect(n.x, n.y + 1, n.w, n.h);
        ctx.fillStyle = '#e6cea1';
        ctx.fillRect(n.x, n.y, n.w, n.h - 1);
        ctx.fillStyle = '#c4a472';
        ctx.fillRect(n.x + n.w - 1, n.y + 1, 1, n.h - 2);
        ctx.fillRect(n.x + 1, n.y + n.h - 2, n.w - 2, 1);
        // Faux wanted portrait & text lines
        ctx.fillStyle = '#7d5a38';
        ctx.fillRect(n.x + 2, n.y + 4, n.w - 4, 3);
        ctx.fillRect(n.x + 2, n.y + 8, n.w - 4, 1);
        ctx.fillRect(n.x + 2, n.y + 10, Math.max(2, n.w - 6), 1);
        // Colored wax pin
        ctx.fillStyle = n.pin;
        ctx.fillRect(n.x + Math.floor(n.w / 2) - 1, n.y + 1, 2, 2);
      }
    }

    drawLeftBarArea(ctx, lv) {
      // 1. Ornate Mahogany Back Liquor Cabinet (x: 0..24, y: 14..102)
      ctx.fillStyle = '#140807';
      ctx.fillRect(0, 14, 25, 88);
      ctx.fillStyle = '#331710';
      ctx.fillRect(0, 16, 23, 84);
      // Side carved wood pillar with highlight
      ctx.fillStyle = '#6e3a1c';
      ctx.fillRect(21, 15, 3, 86);
      ctx.fillStyle = '#a8622a';
      ctx.fillRect(21, 16, 1, 84);

      const shelfYs = [36, 58, 80, 99];
      const bottleSets = [
        ['#d9344c', '#45b2f0', '#b556f0'],
        ['#4dd47e', '#f0a630', '#e0487a'],
        ['#5ce0e0', '#d95826', '#9e6bff'],
        ['#ffd152', '#c42b3c', '#4ca6e8']
      ];
      shelfYs.forEach((sy, sIdx) => {
        // Wooden shelf plank with front bevel
        ctx.fillStyle = '#160906';
        ctx.fillRect(0, sy, 22, 4);
        ctx.fillStyle = '#7d441e';
        ctx.fillRect(0, sy, 21, 3);
        ctx.fillStyle = '#c47d34';
        ctx.fillRect(0, sy, 21, 1);

        // 3 varied-silhouette pixel bottles (flask, tall wine, jug)
        for (let b = 0; b < 3; b++) {
          const bx = 2 + b * 6;
          const col = bottleSets[sIdx][b];
          const shape = (sIdx + b) % 3;
          if (shape === 0) {
            // Round potion flask
            ctx.fillStyle = '#14080a';
            ctx.fillRect(bx, sy - 7, 5, 7);
            ctx.fillRect(bx + 1, sy - 10, 3, 3);
            ctx.fillStyle = col;
            ctx.fillRect(bx + 1, sy - 6, 3, 5);
            ctx.fillStyle = '#e8d8b5';
            ctx.fillRect(bx + 2, sy - 10, 1, 2);
            ctx.fillStyle = 'rgba(255,255,255,0.65)';
            ctx.fillRect(bx + 1, sy - 5, 1, 2);
          } else if (shape === 1) {
            // Tall slender wine bottle
            ctx.fillStyle = '#14080a';
            ctx.fillRect(bx + 1, sy - 12, 3, 5);
            ctx.fillRect(bx, sy - 8, 5, 8);
            ctx.fillStyle = col;
            ctx.fillRect(bx + 1, sy - 7, 3, 6);
            ctx.fillStyle = '#fff0c2'; // paper label
            ctx.fillRect(bx + 1, sy - 5, 3, 2);
            ctx.fillStyle = '#d49a35'; // foil neck
            ctx.fillRect(bx + 2, sy - 11, 1, 2);
          } else {
            // Squat amber/ruby rum jug
            ctx.fillStyle = '#14080a';
            ctx.fillRect(bx, sy - 8, 5, 8);
            ctx.fillStyle = col;
            ctx.fillRect(bx + 1, sy - 7, 3, 6);
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            ctx.fillRect(bx + 1, sy - 6, 1, 3);
            ctx.fillStyle = '#c49664';
            ctx.fillRect(bx + 2, sy - 9, 1, 2);
          }
        }
      });

      // 2. Handcrafted Shaded Oak Ale Barrels (x: 1..22, y: 106..168)
      drawMatrix(ctx, 2, 106, PROP_MATRICES.barrel.rows, PROP_MATRICES.barrel.pal);
      drawMatrix(ctx, 3, 126, PROP_MATRICES.barrel.rows, PROP_MATRICES.barrel.pal);
      drawMatrix(ctx, 2, 146, PROP_MATRICES.barrel.rows, PROP_MATRICES.barrel.pal);
      // Shiny red apple basket resting on the bottom barrel
      ctx.fillStyle = '#160906';
      ctx.fillRect(5, 142, 11, 6);
      ctx.fillStyle = '#a86528';
      ctx.fillRect(6, 144, 9, 3);
      ctx.fillStyle = '#d92638';
      ctx.fillRect(6, 142, 3, 3);
      ctx.fillRect(9, 141, 3, 3);
      ctx.fillRect(12, 142, 3, 3);
      ctx.fillStyle = '#ff7080';
      ctx.fillRect(7, 142, 1, 1);
      ctx.fillRect(10, 141, 1, 1);

      // 3. Rich Carved Oak Bar Counter (starts at vy: 40 cleanly below Bounty Board!)
      const cx = 56, cw = 20, cyTop = 40;
      // Floor cast shadow right & below counter
      ctx.fillStyle = 'rgba(7, 3, 12, 0.52)';
      ctx.fillRect(cx + cw + 1, cyTop + 2, 5, VH - cyTop - 2);

      // Outer dark ink outline
      ctx.fillStyle = '#140805';
      ctx.fillRect(cx - 1, cyTop - 1, cw + 2, VH - cyTop + 1);
      // Outer golden-oak bevel moulding
      ctx.fillStyle = '#c98234';
      ctx.fillRect(cx, cyTop, cw, VH - cyTop);
      // Bright top-left bevel specular edge
      ctx.fillStyle = '#f0b85c';
      ctx.fillRect(cx + 1, cyTop, cw - 2, 1);
      ctx.fillRect(cx, cyTop + 1, 1, VH - cyTop - 1);
      // Dark right/inner shadow rim
      ctx.fillStyle = '#6e3814';
      ctx.fillRect(cx + cw - 1, cyTop + 1, 1, VH - cyTop - 1);

      // Inner recessed oak plank surface with horizontal wood seams
      ctx.fillStyle = '#87481c';
      ctx.fillRect(cx + 2, cyTop + 2, cw - 4, 112);
      for (let py = cyTop + 12; py < 150; py += 12) {
        ctx.fillStyle = '#5c2e11';
        ctx.fillRect(cx + 2, py, cw - 4, 1);
        ctx.fillStyle = 'rgba(255, 200, 125, 0.14)';
        ctx.fillRect(cx + 2, py + 1, cw - 4, 1);
      }
      // Subtle brass corner rivets along bar rail
      ctx.fillStyle = '#ffe28a';
      for (let ry = cyTop + 6; ry < 150; ry += 24) {
        ctx.fillRect(cx + 1, ry, 1, 1);
        ctx.fillRect(cx + cw - 2, ry, 1, 1);
      }

      // Carved Front Arch Panel at bottom end of bar (y: 152..179)
      ctx.fillStyle = '#180a05';
      ctx.fillRect(cx, 151, cw, 29);
      ctx.fillStyle = '#633114';
      ctx.fillRect(cx + 1, 152, cw - 2, 26);
      ctx.fillStyle = '#47210c';
      ctx.fillRect(cx + 3, 154, cw - 6, 22);
      // Ornate gold fleur-de-lis crest on front panel
      ctx.fillStyle = '#e8b042';
      ctx.fillRect(cx + 9, 159, 2, 11);
      ctx.fillRect(cx + 6, 163, 8, 2);
      ctx.fillStyle = '#fff0a6';
      ctx.fillRect(cx + 9, 159, 2, 3);
      ctx.fillRect(cx + 7, 162, 1, 2);
      ctx.fillRect(cx + 12, 162, 1, 2);

      // Draped Crimson & Gold Velvet Runner with Pointed Tail & Fringe (y: 108..146)
      ctx.fillStyle = '#17060a';
      ctx.fillRect(cx + 4, 108, 12, 34);
      ctx.fillRect(cx + 6, 142, 8, 3);
      ctx.fillRect(cx + 8, 145, 4, 2);
      ctx.fillStyle = '#8f1b30';
      ctx.fillRect(cx + 5, 109, 10, 32);
      ctx.fillRect(cx + 7, 141, 6, 3);
      ctx.fillRect(cx + 9, 144, 2, 2);
      ctx.fillStyle = '#c42b42';
      ctx.fillRect(cx + 6, 110, 4, 30);
      // Gold embroidered trim & tassel
      ctx.fillStyle = '#ffd966';
      ctx.fillRect(cx + 5, 109, 10, 1);
      ctx.fillRect(cx + 5, 111, 1, 29);
      ctx.fillRect(cx + 14, 111, 1, 29);
      ctx.fillRect(cx + 9, 145, 2, 2);

      // Rich Handcrafted Countertop Props!
      // a) Glowing Forged Brass Bar Lantern (top of counter)
      drawMatrix(ctx, cx + 4, cyTop + 2, PROP_MATRICES.lantern.rows, PROP_MATRICES.lantern.pal);
      // b) Potted Crimson Tavern Poinsettia
      drawMatrix(ctx, cx + 2, cyTop + 16, PROP_MATRICES.poinsettia.rows, PROP_MATRICES.poinsettia.pal);
      // c) Curved Brass Pitcher with Spout & Handle
      drawMatrix(ctx, cx + 4, cyTop + 34, PROP_MATRICES.pitcher.rows, PROP_MATRICES.pitcher.pal);
      // d) Two Shaped Bottles + Tiny Shot Glass beside runner
      ctx.fillStyle = '#140808';
      ctx.fillRect(cx + 4, 92, 5, 11);
      ctx.fillRect(cx + 5, 89, 3, 3);
      ctx.fillStyle = '#e08d28';
      ctx.fillRect(cx + 5, 94, 3, 8);
      ctx.fillStyle = '#fff0b3';
      ctx.fillRect(cx + 5, 96, 3, 2);
      ctx.fillStyle = '#140808';
      ctx.fillRect(cx + 10, 95, 5, 8);
      ctx.fillStyle = '#7f8ab0';
      ctx.fillRect(cx + 11, 97, 3, 5);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(cx + 11, 97, 1, 2);

      // 4. 3 Handcrafted Red-Velvet Barstools with Gold Studs (x: 86, y: 72 / 108 / 144)
      for (const sy of [72, 108, 144]) {
        ctx.fillStyle = 'rgba(8, 4, 12, 0.48)';
        ctx.fillRect(80, sy + 7, 14, 4);
        drawMatrix(ctx, 79, sy - 6, PROP_MATRICES.barstool.rows, PROP_MATRICES.barstool.pal);
      }
    }

    drawVelvetBarstool(ctx, cx, cy) {
      drawMatrix(ctx, cx - 8, cy - 7, PROP_MATRICES.barstool.rows, PROP_MATRICES.barstool.pal);
    }

    drawOakStool(ctx, cx, cy) {
      ctx.fillStyle = 'rgba(8, 4, 12, 0.45)';
      ctx.fillRect(cx - 6, cy + 5, 12, 3);
      drawMatrix(ctx, cx - 6, cy - 4, PROP_MATRICES.oakStool.rows, PROP_MATRICES.oakStool.pal);
    }

    drawTables(ctx, lv) {
      const tables = lv === 1
        ? [{ x: 148, y: 98 }, { x: 256, y: 98 }]
        : [
            { x: 148, y: 64 }, { x: 258, y: 64 },
            { x: 147, y: 128 }, { x: 258, y: 128 }
          ];

      for (const t of tables) {
        this.drawOctagonalTable(ctx, t.x, t.y, lv);
      }
    }

    drawOctagonalTable(ctx, cx, cy, lv) {
      const rx = 26, ry = 18;

      // Ground drop shadow
      ctx.fillStyle = 'rgba(8, 4, 14, 0.55)';
      ctx.fillRect(cx - rx + 2, cy + ry - 1, rx * 2 - 4, 7);

      // Left & Right stools flanking the table
      this.drawOakStool(ctx, cx - rx - 6, cy + 10);
      this.drawOakStool(ctx, cx + rx + 6, cy + 10);

      // Octagonal wooden tabletop body (stepped pixel bevels!)
      const drawOct = (x, y, w, h, col) => {
        ctx.fillStyle = col;
        ctx.fillRect(x - w + 5, y - h, (w - 5) * 2, h * 2);
        ctx.fillRect(x - w + 2, y - h + 3, (w - 2) * 2, (h - 3) * 2);
        ctx.fillRect(x - w, y - h + 6, w * 2, (h - 6) * 2);
      };

      // Front wooden skirt / depth apron
      drawOct(cx, cy + 4, rx, ry, '#190b06');
      drawOct(cx, cy + 3, rx - 1, ry - 1, '#542a12');
      // Tabletop outer dark ink border
      drawOct(cx, cy, rx, ry, '#190b06');
      // Golden oak bevel rim
      drawOct(cx, cy, rx - 1, ry - 1, '#b8722d');
      // Rich oak plank interior
      drawOct(cx, cy, rx - 3, ry - 3, '#78411e');

      // Tabletop vertical wood plank seams
      ctx.fillStyle = '#4a2410';
      for (let px = cx - 16; px <= cx + 16; px += 8) {
        ctx.fillRect(px, cy - ry + 4, 1, (ry - 4) * 2);
      }
      // Subtle top rim gleam
      ctx.fillStyle = '#e0a24c';
      ctx.fillRect(cx - rx + 7, cy - ry + 1, (rx - 7) * 2, 1);

      // Lv.2 / Lv.3 Embroidered Crimson Table Runner
      if (lv >= 2) {
        ctx.fillStyle = '#18070a';
        ctx.fillRect(cx - 7, cy - ry + 2, 14, ry * 2 + 2);
        ctx.fillStyle = '#8c1d30';
        ctx.fillRect(cx - 6, cy - ry + 3, 12, ry * 2);
        ctx.fillStyle = '#e8b954';
        ctx.fillRect(cx - 5, cy - ry + 3, 1, ry * 2);
        ctx.fillRect(cx + 4, cy - ry + 3, 1, ry * 2);
        ctx.fillRect(cx - 1, cy + ry - 4, 2, 4);
      }

      // Center Handcrafted Brass 3-Candle Candelabra (ZERO static painted flames!)
      drawMatrix(ctx, cx - 8, cy - 8, PROP_MATRICES.candelabra.rows, PROP_MATRICES.candelabra.pal);

      // 2 Handcrafted Frothy Beer Mugs with handles flanking the candelabra
      drawMatrix(ctx, cx - 18, cy - 5, PROP_MATRICES.mug.rows, PROP_MATRICES.mug.pal);
      drawMatrix(ctx, cx + 10, cy - 5, PROP_MATRICES.mug.rows, PROP_MATRICES.mug.pal);
    }
  }

  window.MT.TavernScene = TavernScene;
})();
