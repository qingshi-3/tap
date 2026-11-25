// v8.4 Indoor Midnight Tavern Hall Renderer (1280x720 = 320x180 x 4 crisp integer pixel scale)
// 100% Distinct Indoor Tavern Setting (ZERO outdoor eclipse/pines/lake, ZERO Landlady!)
// Unified Art DNA with v7.5 Battle Theater: Bold #090712 pixel ink outlines, warm-hearth vs cool-moonlight contrast,
// handcrafted multi-tone pixel-matrix furniture/props, crackling fireplace, swaying chandeliers, rainy gothic windows & steel pixel nameplates!
(function () {
  window.MT = window.MT || {};

  const STAGE_W = 1280;
  const STAGE_H = 720;
  const VW = 320;
  const VH = 180;
  const FLOOR_VY = 106;           // Virtual Y of main oak tavern floor walkway
  const FLOOR_Y = FLOOR_VY * 4;   // 424px: Duelyst mercenaries stand right on the tavern oak floor!

  function hash2(x, y, seed = 1) {
    let n = Math.imul(x + 37, 374761393) + Math.imul(y + 17, 668265263) + Math.imul(seed, 1442695041);
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }

  const PAL = {
    'K': '#090712', // crisp bold pixel ink outline
    'I': '#1e2236', // dark wrought iron
    'i': '#3c4461', // iron midtone
    's': '#7e8ab3', // steel highlight
    'D': '#28140b', // deepest oak
    'd': '#4c2815', // oak midtone
    'w': '#7d4623', // oak warm wood
    'H': '#b06d3b', // oak top highlight
    'G': '#e0a238', // brass gold
    'B': '#7a4917', // dark brass
    'Y': '#fff1a6', // pale gold highlight
    'A': '#ffaa38', // warm amber flame
    'O': '#db561c', // deep fire orange
    'W': '#ffffff', // hot white core
    'R': '#9e1f38', // crimson velvet/wax
    'r': '#5c1022', // crimson shadow
    'M': '#de4562', // crimson highlight
    'P': '#e8d7b5', // parchment
    'p': '#b59d78', // parchment shadow
    'S': '#2b243b', // hearth stone dark
    'z': '#473e5e', // hearth stone mid
    'Z': '#6e648c', // hearth stone rim
    'g': '#3ec47c', // emerald bottle
    'b': '#52b8ff', // sapphire bottle
    'v': '#c678ff', // violet elixir bottle
    'c': '#ff667d', // ruby wine bottle
    'C': '#2289b8', // cool cyan glass
    'L': '#8ef0ff'  // moonlight rim
  };

  // Handcrafted Black-Outlined Multi-Tone Indoor Tavern Props (ZERO simple geometric rectangles!)
  const PROPS = {
    // Hanging Wrought-Iron Candle Chandelier (27x16)
    chandelier: [
      '.............K.............',
      '............KiK............',
      '.............K.............',
      '............KiK............',
      '.....KK.....KiK.....KK.....',
      '....KPPK...KPPPK...KPPK....',
      '....KPPK...KPPPK...KPPK....',
      '...KBBBBK.KBBBBBK.KBBBBK...',
      '..KiiiiiiKiiiiiiiKiiiiiiK..',
      '.KisssssssssssssssssssssiK.',
      '..KiiK..KiiKiiiKiiK..KiiK..',
      '...KK....KK.KiK.KK....KK...',
      '............KsK............',
      '.............K.............'
    ],
    // Tall Back-Bar Oak Liquor Shelf packed with glowing elixir bottles & kegs (44x32)
    liquorShelf: [
      'KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK',
      'KHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHK',
      'KDwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwDK',
      'KDwKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKwDK',
      'KDwK..KK..KK..KK..KK....KK..KK..KK..KK..KwDK',
      'KDwK.KggKKbbKKvvKKccK..KggKKYYKKbbKKvvK.KwDK',
      'KDwK.KgWKKbWKKvWKKcWK..KgWKKYWKKbWKKvWK.KwDK',
      'KDwK.KggKKbbKKvvKKccK..KggKKYYKKbbKKvvK.KwDK',
      'KDwKDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKwDK',
      'KDwKHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHKwDK',
      'KDwKddddddddddddddddddddddddddddddddddddKwDK',
      'KDwK...KK...KK....KKKKKK....KK...KK.....KwDK',
      'KDwK..KccK.KggK..KDDwwDDK..KvvK.KbbK....KwDK',
      'KDwK.KcWWcKgWWgK.KiiiiiiK.KvWWvKbWWbK...KwDK',
      'KDwK.KccccKggggK.KDwHHwDK.KvvvvKbbbbK...KwDK',
      'KDwK.KccccKggggK.KiiiiiiK.KvvvvKbbbbK...KwDK',
      'KDwKDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKwDK',
      'KDwKHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHKwDK',
      'KDwKddddddddddddddddddddddddddddddddddddKwDK',
      'KDwK..KKKKKK....KKKKKK....KKKKKK........KwDK',
      'KDwK.KDDwwDDK..KDDwwDDK..KDDwwDDK..KK...KwDK',
      'KDwK.KiiiiiiK..KiiiiiiK..KiiiiiiK.KGGK..KwDK',
      'KDwK.KDwHHwDK..KDwHHwDK..KDwHHwDK.KGYK..KwDK',
      'KDwK.KiiiiiiK..KiiiiiiK..KiiiiiiK.KGBK..KwDK',
      'KDwK.KDDDDDDK..KDDDDDDK..KDDDDDDK..KK...KwDK',
      'KDwKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKwDK',
      'KDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDK',
      'KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK'
    ],
    // Open Carved Oak Bar Counter with glowing brass lantern, bottles & frothy mugs (54x20, NO Landlady!)
    barCounter: [
      '.....KK...KK.....KKKK......KK...KK......KK....KK......',
      '....KggK.KvvK...KGAWGK....KWWK.KWWK....KbbK..KccK.....',
      '....KggK.KvvK...KGYWGK...KWAWKKWAWK....KbbK..KccK.....',
      '...KgWWgKvWWvK..KGAOGK...KWAWKKWAWKK..KbWWbKKcWWcK....',
      '...KggggKvvvvK...KKKK.....KKKK..KKKK..KbbbbKKccccK....',
      'KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK',
      'KHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHK',
      'KwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwK',
      'KddddddddddddddddddddddddddddddddddddddddddddddddddddK',
      'KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK',
      '.KDdwwdDKDddddddddddDKGGGGGGKddddddddddDKDdwwdDKDddDK.',
      '.KDdwwdDKDdwwwwwwwwdDKGYYYYGKdwwwwwwwwdDKDdwwdDKDdwDK.',
      '.KDdwwdDKDdwDDDDDDdwDKGYRMRYGKdwDDDDDDdwDKDdwwdDKDdwDK',
      '.KDdwwdDKDdwDDDDDDdwDKGYRMRYGKdwDDDDDDdwDKDdwwdDKDdwDK',
      '.KDdwwdDKDdwDDDDDDdwDKGYYYYGKdwDDDDDDdwDKDdwwdDKDdwDK.',
      '.KDdwwdDKDddddddddddDKGGGGGGKddddddddddDKDdwwdDKDddDK.',
      '.KDDDDDDKDDDDDDDDDDDDKDDDDDDKDDDDDDDDDDDKDDDDDDKDDDDK.',
      '.KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK.'
    ],
    // Iron-Hooped Curved Oak Barrel (14x15)
    oakBarrel: [
      '...KKKKKKKK...',
      '..KDDdwwdDDK..',
      '.KiiiiiiiiiiK.',
      '.KDDdwHHwdDDK.',
      'KDDdwHwwHwdDDK',
      'KDDdwHwwHwdDDK',
      'KiiiiiiiiiiiiK',
      'KDDdwHwwHwdDDK',
      'KDDdwHwwHwdDDK',
      'KDDdwHwwHwdDDK',
      'KiiiiiiiiiiiiK',
      '.KDDdwwwwdDDK.',
      '.KiiiiiiiiiiK.',
      '..KDDDDDDDDK..',
      '...KKKKKKKK...'
    ],
    // Crossed Greatswords & Golden Guild Crest mounted above Fireplace Hearth (24x15)
    hearthCrest: [
      '..KK................KK..',
      '.KssK..............KssK.',
      '..KssK....KKKK....KssK..',
      '...KssK..KGGGGK..KssK...',
      '....KssKKGYRRYGKKssK....',
      '.....KssKGRMMRGKssK.....',
      '......KssGRYYRGssK......',
      '.......KsGRMMRGsk.......',
      '......KssKGRRGKssK......',
      '.....KGGsKGGGGKsGGK.....',
      '....KGK.KsKGGKsK.KGK....',
      '...KDK...KK..KK...KDK...',
      '...KK..............KK...'
    ],
    // Interactive Wall Guild Bounty Notice Board with Wanted Scrolls & Crimson Wax Seal (30x22)
    bountyBoard: [
      '.KKKKKKKKKKKKKKKKKKKKKKKKKKKK.',
      'KBGwwwwwwwwwwwwwwwwwwwwwwwwGBK',
      'KGwKKKKKKKKKKKKKKKKKKKKKKKKwGK',
      'KwKDDDDDDDDDDDDDDDDDDDDDDDDKwK',
      'KwKDKPPPPPKDDKPPPPPPPKDDKKDKwK',
      'KwKDKPpppPKDDKPppRRppKDKPPKwDK',
      'KwKDKPpRpPKDDKPpRMMRpKDKpPKwDK',
      'KwKDKPpppPKDDKPppRRppKDKPPKwDK',
      'KwKDKPPPPPKDDKPPPPPPPKDKKKKwDK',
      'KwKDKKKKKKKDDKKKKKKKKKDDDDDKwK',
      'KwKDDDKPPPPPPKDDDKPPPPPPKDDKwK',
      'KwKDDDKPppppPKDDDKPppppPKDDKwK',
      'KwKDDDKPpRRpPKDDDKPpRRpPKDDKwK',
      'KwKDDDKPpMMpPKDDDKPpMMpPKDDKwK',
      'KwKDDDKPppppPKDDDKPppppPKDDKwK',
      'KwKDDDKPPPPPPKDDDKPPPPPPKDDKwK',
      'KwKDDDKKKKKKKKDDDKKKKKKKKDDKwK',
      'KwKDDDDDDDDDDDDDDDDDDDDDDDDKwK',
      'KGwKKKKKKKKKKKKKKKKKKKKKKKKwGK',
      'KBGddddddddddddddddddddddddGBK',
      '.KKKKKKKKKKKKKKKKKKKKKKKKKKKK.'
    ],
    // Carved Tavern Round Oak Table with Brass Candelabra & Frothy Beer Mugs (30x18)
    tavernTable: [
      '....KK........KK........KK....',
      '...KWWK......KPPK......KWWK...',
      '..KWAWKK....KPPPPK....KWAWKK..',
      '..KWAWKK...KBGYYGBK...KWAWKK..',
      '...KKKK...KGGGGGGGGK...KKKK...',
      'KKKKKKKKKKKKKKKKKKKKKKKKKKKKKK',
      'KHHHHHHHHHHHHHHHHHHHHHHHHHHHHK',
      'KwwwwwwwwwwwwwwwwwwwwwwwwwwwwK',
      'KddddddddddddddddddddddddddddK',
      'KKKKKKKKKKKKKKKKKKKKKKKKKKKKKK',
      '....KDDwDK..........KDwDDK....',
      '....KDDwDK..........KDwDDK....',
      '....KDDwDK..........KDwDDK....',
      '....KDDwDK..........KDwDDK....',
      '...KDDwwDDK........KDDwwDDK...',
      '...KKKKKKKK........KKKKKKKK...'
    ],
    // Crimson Velvet Gold-Studded Barstool (12x12)
    velvetStool: [
      '..KKKKKKKK..',
      '.KMMRRRRMMK.',
      'KMRRRRRRRRMK',
      'KrrrrrrrrrrK',
      '.KBGKGGKGBK.',
      '..KKKKKKKK..',
      '..KDwKKwDK..',
      '..KDwKKwDK..',
      '.KDwK..KwDK.',
      '.KKK....KKK.'
    ],
    // Tattered Crimson-Gold Tavern Guild Pennant (11x16)
    pennant: [
      'KKKKKKKKKKK',
      'KBBGGGGGGBK',
      'KrrrrrrrrrK',
      '.KrRMMMRrK.',
      '.KrRGGGRrK.',
      '.KrRGYGRrK.',
      '.KrRGGGRrK.',
      '.KrRRRRRrK.',
      '.KrRMMMRrK.',
      '.KrRRRRRrK.',
      '.KrRR.RRrK.',
      '.KrR...RrK.',
      '.KK.....KK.'
    ]
  };

  function drawMatrix(ctx, rows, ox, oy, flipX = false) {
    const w = rows[0] ? rows[0].length : 0;
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        const col = PAL[ch];
        if (!col) continue;
        const dx = flipX ? (ox + (w - 1 - x)) : (ox + x);
        ctx.fillStyle = col;
        ctx.fillRect(dx, oy + y, 1, 1);
      }
    }
  }

  class TavernCanvas {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.canvas.width = STAGE_W;
      this.canvas.height = STAGE_H;

      this.bgCache = {};
      this.fxRainImg = new Image();
      this.fxRainImg.src = './assets/vfx/rain.png';

      this.time = 0;
      this.lastTs = 0;
      this.shakeTime = 0;
      this.shakeAmp = 0;

      this.dust = Array.from({ length: 30 }, (_, i) => ({
        x: 40 + Math.random() * 1200,
        y: 60 + Math.random() * 440,
        vx: (Math.random() - 0.5) * 10,
        vy: -6 - Math.random() * 8,
        r: i % 3 === 0 ? 4 : 3,
        phase: Math.random() * 6.28
      }));

      this.hearthSparks = Array.from({ length: 12 }, (_, i) => ({
        t: i / 12,
        seed: i * 2.1
      }));

      this.particles = [];
      this.floaters = [];
      this.activeVfx = [];
      this.lights = [];
      this.ripples = [];
      this.actors = [];

      this.selectedMercId = null;
      this.synergyHighlightIds = new Set();
      this.drinkReadyColor = null;
      this.dragTargetMercId = null;
      this.dragDrinkColor = null;
      this.upgrades = new Set();

      this.tavernLevel = 1;
      this.scrollX = 0;
      this.maxScroll = 0;
    }

    setTavernLevel(lv) {
      this.tavernLevel = Math.max(1, Math.min(3, lv || 1));
      this.scrollX = 0;
      this.maxScroll = 0;
    }

    panBy() {}
    setUpgrades(upgradeSet) { this.upgrades = upgradeSet; }

    // Landlady removed per user request
    landladySay() {}
    hitTestLandlady() { return false; }

    // Click Open-Air Oak Bar Counter (left zone) -> toggles Bar Drink Menu!
    hitTestBarCounter(stageX, stageY) {
      return stageX >= 48 && stageX <= 310 && stageY >= 245 && stageY <= 440;
    }

    // Click Hanging Guild Bounty Board (center-right wall) -> opens Bounty Dossier!
    hitTestBountyBoard(stageX, stageY) {
      return stageX >= 696 && stageX <= 828 && stageY >= 198 && stageY <= 300;
    }

    // Place mercenaries naturally across the Indoor Tavern Oak Floor (framed cleanly beside hearth & candlelit tables!)
    computeFloorPositions(count) {
      if (count <= 0) return [];
      const minX = 370;
      const maxX = 1100;
      if (count === 1) return [{ x: 640, y: FLOOR_Y, facing: 1 }];
      if (count === 2) return [
        { x: 520, y: FLOOR_Y, facing: 1 },
        { x: 880, y: FLOOR_Y, facing: -1 }
      ];
      if (count === 3) return [
        { x: 392, y: FLOOR_Y, facing: 1 },
        { x: 752, y: FLOOR_Y, facing: -1 },
        { x: 1052, y: FLOOR_Y, facing: -1 }
      ];
      if (count === 5) return [
        { x: 218, y: FLOOR_Y, facing: 1 },
        { x: 430, y: FLOOR_Y, facing: 1 },
        { x: 640, y: FLOOR_Y, facing: 1 },
        { x: 850, y: FLOOR_Y, facing: -1 },
        { x: 1062, y: FLOOR_Y, facing: -1 }
      ];
      const step = (maxX - minX) / (count - 1);
      return Array.from({ length: count }, (_, i) => ({
        x: Math.round(minX + i * step),
        y: FLOOR_Y,
        facing: i % 2 === 0 ? 1 : -1
      }));
    }

    syncMercenaries(mercs, assignedIds = new Set()) {
      const seats = this.computeFloorPositions(mercs.length);
      const existing = new Map(this.actors.map((a) => [a.merc.id, a]));
      const nextActors = [];

      mercs.forEach((m, idx) => {
        const spot = seats[idx] || { x: 640, y: FLOOR_Y, facing: 1 };
        const prev = existing.get(m.id);
        if (prev) {
          prev.merc = m;
          prev.assigned = assignedIds.has(m.id);
          prev.homeX = spot.x;
          prev.homeY = spot.y;
          prev.facing = spot.facing;
          if (!prev.marching && !prev.lifted) {
            prev.x = spot.x;
            prev.y = spot.y;
          }
          nextActors.push(prev);
        } else {
          const bark = m.barks && m.barks.length ? m.barks[Math.floor(Math.random() * m.barks.length)] : '';
          nextActors.push({
            merc: m,
            x: spot.x,
            y: spot.y,
            homeX: spot.x,
            homeY: spot.y,
            facing: spot.facing,
            bubble: idx === 1 ? bark : '',
            bubbleTimer: idx === 1 ? 4.6 : 0,
            nextBarkIn: 5 + Math.random() * 7,
            anim: 'idle',
            animTimer: 0,
            lifted: false,
            assigned: assignedIds.has(m.id),
            marching: false,
            alpha: 1,
            tapPop: 0,
            phase: Math.random() * 6
          });
        }
      });
      this.actors = nextActors;
    }

    say(mercId, text, duration = 4.2) {
      const a = this.actors.find((x) => x.merc.id === mercId);
      if (!a) return;
      a.bubble = text;
      a.bubbleTimer = duration;
    }

    triggerAnim(mercId, anim, duration = 0.8) {
      const a = this.actors.find((x) => x.merc.id === mercId);
      if (!a) return;
      a.anim = anim;
      a.animTimer = duration;
    }

    triggerTapFeedback(mercId, color = '#58e0ff') {
      const a = this.actors.find((x) => x.merc.id === mercId);
      if (!a) return;
      a.tapPop = 1.0;
      this.ripples.push({ x: a.x, y: a.y - 4, r: 12, maxR: 56, color, life: 0.34, maxLife: 0.34 });
      this.lights.push({ x: a.x, y: a.y - 44, color, radius: 135, life: 0.42, maxLife: 0.42 });
      this.burstParticles(a.x, a.y - 44, color, 12, 110);
    }

    shake(amp = 8, duration = 0.28) {
      this.shakeAmp = Math.max(this.shakeAmp, amp);
      this.shakeTime = Math.max(this.shakeTime, duration);
    }

    burstParticles(x, y, color, count = 20, speed = 150) {
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = (0.35 + Math.random() * 0.85) * speed;
        this.particles.push({
          x, y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 62,
          size: 4,
          color,
          life: 0.5 + Math.random() * 0.4,
          maxLife: 0.9
        });
      }
    }

    spawnFloater(x, y, text, color = '#ffd97d') {
      this.floaters.push({ x, y, text, color, life: 1.65, maxLife: 1.65 });
    }

    playVfx(key, x, y, opts = {}) {
      if (!window.MT.vfx) return;
      const inst = window.MT.vfx.createInstance(key, x, y, opts);
      if (inst) {
        this.activeVfx.push(inst);
        const lCol = key.includes('flame') ? '#ff7b29' : key.includes('holy') ? '#ffe378' : key.includes('shadow') ? '#c07aff' : key.includes('Icy') ? '#5ce6ff' : '#ffd966';
        this.lights.push({ x, y, color: lCol, radius: 190, life: 0.58, maxLife: 0.58 });
      }
    }

    startSquadMarchOut(mercIds) {
      const set = new Set(mercIds);
      for (const a of this.actors) {
        if (set.has(a.merc.id)) {
          a.marching = true;
          a.facing = 1;
          a.bubble = '推门出征！天亮前凯旋！';
          a.bubbleTimer = 1.6;
        }
      }
    }

    resetMarch() {
      for (const a of this.actors) {
        a.marching = false;
        a.alpha = 1;
        a.x = a.homeX;
        a.y = a.homeY;
      }
    }

    getMercActor(mercId) {
      return this.actors.find((a) => a.merc.id === mercId) || null;
    }

    hitTestMerc(stageX, stageY) {
      const sorted = [...this.actors].sort((a, b) => b.y - a.y);
      for (const a of sorted) {
        if (a.marching || a.alpha < 0.2) continue;
        if (Math.abs(stageX - a.x) <= 62 && stageY >= a.y - 135 && stageY <= a.y + 42) {
          return a;
        }
      }
      return null;
    }

    clientToStage(clientX, clientY) {
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: ((clientX - rect.left) / rect.width) * STAGE_W,
        y: ((clientY - rect.top) / rect.height) * STAGE_H
      };
    }

    start() {
      const loop = (ts) => {
        if (!this.lastTs) this.lastTs = ts;
        const dt = Math.min(0.05, (ts - this.lastTs) / 1000);
        this.lastTs = ts;
        this.update(dt);
        this.render();
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }

    update(dt) {
      this.time += dt;
      if (this.shakeTime > 0) {
        this.shakeTime = Math.max(0, this.shakeTime - dt);
        if (this.shakeTime === 0) this.shakeAmp = 0;
      }

      for (const d of this.dust) {
        d.x += (d.vx + Math.sin(this.time + d.phase) * 7) * dt;
        d.y += d.vy * dt;
        if (d.y < 48) {
          d.y = FLOOR_Y + 40;
          d.x = 40 + Math.random() * 1200;
        }
      }
      for (const sp of this.hearthSparks) {
        sp.t = (sp.t + dt * 0.55) % 1;
      }
      for (let i = this.ripples.length - 1; i >= 0; i--) {
        const rp = this.ripples[i];
        rp.life -= dt;
        rp.r = 12 + (1 - rp.life / rp.maxLife) * (rp.maxR - 12);
        if (rp.life <= 0) this.ripples.splice(i, 1);
      }
      for (let i = this.lights.length - 1; i >= 0; i--) {
        this.lights[i].life -= dt;
        if (this.lights[i].life <= 0) this.lights.splice(i, 1);
      }

      for (const a of this.actors) {
        if (a.tapPop > 0) a.tapPop = Math.max(0, a.tapPop - dt * 4.5);
        if (a.animTimer > 0) {
          a.animTimer -= dt;
          if (a.animTimer <= 0) a.anim = 'idle';
        }
        if (a.bubbleTimer > 0) {
          a.bubbleTimer -= dt;
          if (a.bubbleTimer <= 0) a.bubble = '';
        } else if (!a.marching && !a.lifted) {
          a.nextBarkIn -= dt;
          if (a.nextBarkIn <= 0) {
            a.nextBarkIn = 7 + Math.random() * 10;
            const activeBubbles = this.actors.filter((x) => x.bubbleTimer > 0).length;
            if (activeBubbles < 1 && a.merc.barks && a.merc.barks.length) {
              a.bubble = a.merc.barks[Math.floor(Math.random() * a.merc.barks.length)];
              a.bubbleTimer = 3.8;
            }
          }
        }
        if (a.marching) {
          a.x += 340 * dt;
          if (a.x > 1160) a.alpha = Math.max(0, a.alpha - dt * 3.8);
        }
      }

      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 310 * dt;
        p.life -= dt;
        if (p.life <= 0) this.particles.splice(i, 1);
      }
      for (let i = this.floaters.length - 1; i >= 0; i--) {
        const f = this.floaters[i];
        f.y -= 42 * dt;
        f.life -= dt;
        if (f.life <= 0) this.floaters.splice(i, 1);
      }
      if (window.MT.vfx) {
        for (let i = this.activeVfx.length - 1; i >= 0; i--) {
          window.MT.vfx.update(this.activeVfx[i], dt);
          if (this.activeVfx[i].done) this.activeVfx.splice(i, 1);
        }
      }
    }

    // ─── Bake Full 320x180 Indoor Midnight Tavern Hall (Bold #090712 Outlined Pixel Art!) ───
    getHallCanvas(lv) {
      if (this.bgCache[lv]) return this.bgCache[lv];
      const c = document.createElement('canvas');
      c.width = VW;
      c.height = VH;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;

      // 1. Dark Timber Ceiling & Exposed Rafters (vy = 0..24)
      ctx.fillStyle = '#120d1d';
      ctx.fillRect(0, 0, VW, 24);
      // Heavy horizontal ceiling beam with crisp ink border
      ctx.fillStyle = '#090712';
      ctx.fillRect(0, 18, VW, 8);
      ctx.fillStyle = '#4a2815';
      ctx.fillRect(0, 19, VW, 5);
      ctx.fillStyle = '#734122';
      ctx.fillRect(0, 19, VW, 2);
      // Ceiling plank rafters & vertical brackets
      for (let rx = 18; rx < VW; rx += 38) {
        ctx.fillStyle = '#090712';
        ctx.fillRect(rx, 0, 8, 19);
        ctx.fillStyle = '#361c10';
        ctx.fillRect(rx + 1, 0, 6, 18);
        ctx.fillStyle = '#5c321a';
        ctx.fillRect(rx + 2, 0, 2, 18);
      }

      // 2. Indoor Stone & Plum-Slate Tavern Back Wall (vy = 26..80)
      const wallTop = lv >= 3 ? '#2c1e42' : lv === 2 ? '#251e3b' : '#211c33';
      const wallBot = lv >= 3 ? '#3b2654' : lv === 2 ? '#31264a' : '#2b2340';
      const wg = ctx.createLinearGradient(0, 26, 0, 84);
      wg.addColorStop(0, wallTop);
      wg.addColorStop(1, wallBot);
      ctx.fillStyle = wg;
      ctx.fillRect(0, 26, VW, 58);

      // Subtle weathered tavern ashlar stone blocks on upper wall
      for (let row = 0; row < 9; row++) {
        const wy = 26 + row * 6;
        for (let bx = (row % 2) * 8; bx < VW; bx += 16) {
          const n = hash2(bx, row, 19);
          if (n > 0.65) {
            ctx.fillStyle = 'rgba(255, 224, 180, 0.05)';
            ctx.fillRect(bx, wy, 15, 5);
          } else if (n < 0.28) {
            ctx.fillStyle = 'rgba(6, 4, 16, 0.18)';
            ctx.fillRect(bx, wy, 15, 5);
          }
          ctx.fillStyle = 'rgba(9, 7, 18, 0.28)';
          ctx.fillRect(bx, wy + 5, 16, 1);
          ctx.fillRect(bx, wy, 1, 6);
        }
      }

      // 3. Lower Oak Wainscoting Paneling along Back Wall (vy = 80..FLOOR_VY)
      ctx.fillStyle = '#090712';
      ctx.fillRect(0, 80, VW, 3);
      ctx.fillStyle = '#8a512a';
      ctx.fillRect(0, 81, VW, 2);
      ctx.fillStyle = '#381e10';
      ctx.fillRect(0, 83, VW, FLOOR_VY - 83);
      for (let px = 0; px < VW; px += 12) {
        ctx.fillStyle = '#090712';
        ctx.fillRect(px, 83, 1, FLOOR_VY - 83);
        ctx.fillStyle = '#4c2a17';
        ctx.fillRect(px + 2, 85, 8, FLOOR_VY - 88);
        ctx.fillStyle = '#63371e';
        ctx.fillRect(px + 2, 85, 8, 2);
      }

      // Vertical Structural Timber Columns dividing Tavern Zones (Bar | Hearth | Lounge | Exit Door)
      for (const tx of [2, 82, 166, 286]) {
        ctx.fillStyle = '#090712';
        ctx.fillRect(tx, 24, 7, FLOOR_VY - 24);
        ctx.fillStyle = '#522c16';
        ctx.fillRect(tx + 1, 24, 5, FLOOR_VY - 24);
        ctx.fillStyle = '#824b26';
        ctx.fillRect(tx + 1, 24, 2, FLOOR_VY - 24);
        // Decorative wooden corbel bracket at column top
        ctx.fillStyle = '#090712';
        ctx.fillRect(tx - 3, 25, 13, 5);
        ctx.fillStyle = '#6e3d1e';
        ctx.fillRect(tx - 2, 26, 11, 3);
      }

      // 4. GIANT STONE HEARTH FIREPLACE (Center-Left: vx = 104..148, Warm Focal Anchor!)
      this.drawStoneHearth(ctx, 102, FLOOR_VY);

      // 5. TALL ARCHED GOTHIC RAIN WINDOWS (Right Wall: vx = 214..242 & vx = 250..278, Cool Moonlight Contrast!)
      this.drawGothicWindow(ctx, 214, 38, 28, 36);
      this.drawGothicWindow(ctx, 250, 38, 28, 36);

      // 6. HEAVY IRON-STUDDED ARCHED OAK EXIT DOOR (Far Right: vx = 294..318 -> Squad marches out here!)
      this.drawExitDoor(ctx, 294, FLOOR_VY);

      // 7. HANDCRAFTED BLACK-OUTLINED INDOOR PROPS
      // Hanging wrought-iron chandeliers (suspended cleanly below ceiling beam!)
      drawMatrix(ctx, PROPS.chandelier, 48, 25);
      drawMatrix(ctx, PROPS.chandelier, 174, 25);
      if (lv >= 2) {
        drawMatrix(ctx, PROPS.pennant, 90, 28);
        drawMatrix(ctx, PROPS.pennant, 152, 28);
        drawMatrix(ctx, PROPS.pennant, 200, 28);
      }
      // Left Bar Zone: Tall Liquor Shelf + Open Carved Oak Bar Counter + Oak Barrel (NO Landlady!)
      drawMatrix(ctx, PROPS.liquorShelf, 16, 44);
      drawMatrix(ctx, PROPS.oakBarrel, 64, FLOOR_VY - 15);
      drawMatrix(ctx, PROPS.barCounter, 14, FLOOR_VY - 18);

      // Crossed Greatswords & Golden Guild Crest above Hearth Mantle
      drawMatrix(ctx, PROPS.hearthCrest, 114, 30);

      // Interactive Hanging Guild Bounty Notice Board (vx = 175..205, vy = 50..72)
      drawMatrix(ctx, PROPS.bountyBoard, 175, 50);

      // Midground Carved Tavern Tables & Velvet Stools (offset cleanly between mercenaries so candelabras & mugs shine!)
      drawMatrix(ctx, PROPS.velvetStool, 74, FLOOR_VY - 11);
      drawMatrix(ctx, PROPS.tavernTable, 146, FLOOR_VY - 16);
      drawMatrix(ctx, PROPS.tavernTable, 214, FLOOR_VY - 16);

      // 8. CRISP BASEBOARD & FULL-WIDTH POLISHED DARK-OAK TAVERN FLOOR (vy = FLOOR_VY..VH, ZERO outdoor lake!)
      // Crisp horizontal ink baseboard separating back wall from oak floor
      ctx.fillStyle = '#090712';
      ctx.fillRect(0, FLOOR_VY - 1, VW, 2);
      ctx.fillStyle = '#995e33';
      ctx.fillRect(0, FLOOR_VY + 1, VW, 2);

      // Rich warm-to-deep polished oak floorboards (vy = 109..180)
      const flGrad = ctx.createLinearGradient(0, FLOOR_VY, 0, VH);
      flGrad.addColorStop(0, '#3d2218');
      flGrad.addColorStop(0.28, '#2b1719');
      flGrad.addColorStop(0.68, '#1a0f1c');
      flGrad.addColorStop(1, '#0e0814');
      ctx.fillStyle = flGrad;
      ctx.fillRect(0, FLOOR_VY + 3, VW, VH - FLOOR_VY - 3);

      // Crisp perspective-stepped horizontal oak plank lines & vertical plank joints
      let py = FLOOR_VY + 3;
      let plankH = 5;
      let rowIdx = 0;
      while (py < VH) {
        ctx.fillStyle = 'rgba(9, 7, 18, 0.72)';
        ctx.fillRect(0, py + plankH - 1, VW, 1);
        // Subtle waxed wood sheen highlight along top edge of each plank
        const sheenA = Math.max(0.03, 0.14 - rowIdx * 0.015);
        ctx.fillStyle = `rgba(255, 206, 138, ${sheenA})`;
        ctx.fillRect(0, py, VW, 1);
        // Staggered vertical plank seams
        const off = (rowIdx % 2) * 24 + (rowIdx % 3) * 9;
        for (let sx = off; sx < VW; sx += 44) {
          ctx.fillStyle = 'rgba(9, 7, 18, 0.65)';
          ctx.fillRect(sx, py, 1, plankH);
        }
        py += plankH;
        plankH = Math.min(11, plankH + 1);
        rowIdx++;
      }

      // Woven Crimson-Gold Guild Runner Carpet with Golden Fringe Tassels stretching across the tavern walkway!
      ctx.fillStyle = '#090712';
      ctx.fillRect(88, FLOOR_VY + 7, 198, 18);
      ctx.fillStyle = '#6e162a';
      ctx.fillRect(90, FLOOR_VY + 8, 194, 16);
      ctx.fillStyle = '#9e233c';
      ctx.fillRect(92, FLOOR_VY + 10, 190, 12);
      // Golden woven border stripe & diamond motif along carpet
      ctx.fillStyle = '#e0a238';
      ctx.fillRect(91, FLOOR_VY + 9, 192, 1);
      ctx.fillRect(91, FLOOR_VY + 22, 192, 1);
      // Golden fringe tassels on left & right ends of carpet
      for (let ty = FLOOR_VY + 9; ty <= FLOOR_VY + 22; ty += 2) {
        ctx.fillStyle = '#ffd966';
        ctx.fillRect(85, ty, 3, 1);
        ctx.fillRect(286, ty, 3, 1);
      }
      for (let cx = 104; cx < 276; cx += 18) {
        ctx.fillStyle = '#ffd966';
        ctx.fillRect(cx, FLOOR_VY + 15, 2, 2);
        ctx.fillStyle = '#b57b24';
        ctx.fillRect(cx - 2, FLOOR_VY + 15, 1, 2);
        ctx.fillRect(cx + 3, FLOOR_VY + 15, 1, 2);
      }

      // Waxed-Oak Floor Diagonal Window Moonlight Patches (cool indigo pools on right-side planks!)
      ctx.save();
      ctx.fillStyle = 'rgba(92, 175, 240, 0.14)';
      for (const wx of [200, 236]) {
        ctx.beginPath();
        ctx.moveTo(wx, FLOOR_VY + 26);
        ctx.lineTo(wx + 24, FLOOR_VY + 26);
        ctx.lineTo(wx + 12, FLOOR_VY + 52);
        ctx.lineTo(wx - 12, FLOOR_VY + 52);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // Cozy foreground oak barrels & velvet stool tucked in bottom corners (framing the bottom steel tray!)
      drawMatrix(ctx, PROPS.oakBarrel, 6, VH - 22);
      drawMatrix(ctx, PROPS.oakBarrel, 22, VH - 17);
      drawMatrix(ctx, PROPS.velvetStool, 38, VH - 15);
      drawMatrix(ctx, PROPS.oakBarrel, VW - 22, VH - 22);
      drawMatrix(ctx, PROPS.oakBarrel, VW - 36, VH - 17);

      this.bgCache[lv] = c;
      return c;
    }

    drawStoneHearth(ctx, ox, baseY) {
      // Tapered Medieval Cobblestone Chimney Hood (staggered weathered stone blocks, zero ladder stripes!)
      for (let i = 0; i < 34; i++) {
        const inset = Math.max(0, Math.round((1 - i / 34) * 8));
        const rowY = 24 + i;
        const left = ox + inset;
        const w = 48 - inset * 2;
        ctx.fillStyle = '#090712';
        ctx.fillRect(left - 1, rowY, w + 2, 2);
        ctx.fillStyle = '#3c3452';
        ctx.fillRect(left, rowY, w, 1);
      }
      // Staggered ashlar masonry joints & stone highlights on hood
      for (let row = 0; row < 6; row++) {
        const ry = 25 + row * 5;
        const inset = Math.max(0, Math.round((1 - (row * 5) / 34) * 8));
        const left = ox + inset + 1;
        const right = ox + 48 - inset - 1;
        ctx.fillStyle = '#1b1629';
        ctx.fillRect(left, ry + 4, right - left, 1);
        for (let bx = left + (row % 2) * 5; bx < right - 4; bx += 10) {
          const n = hash2(bx, row, 73);
          ctx.fillStyle = n > 0.55 ? '#554b73' : '#453d5e';
          ctx.fillRect(bx, ry, Math.min(9, right - bx), 4);
          if (n > 0.6) {
            ctx.fillStyle = '#6f6494';
            ctx.fillRect(bx, ry, Math.min(8, right - bx), 1);
          }
          ctx.fillStyle = '#1b1629';
          ctx.fillRect(bx, ry, 1, 4);
        }
      }
      // Carved timber fireplace mantle shelf
      ctx.fillStyle = '#090712';
      ctx.fillRect(ox - 4, 57, 56, 7);
      ctx.fillStyle = '#7d4623';
      ctx.fillRect(ox - 3, 58, 54, 4);
      ctx.fillStyle = '#b5713d';
      ctx.fillRect(ox - 3, 58, 54, 1);
      // Lower hearth stone pillars & arched fire opening
      ctx.fillStyle = '#090712';
      ctx.fillRect(ox, 64, 48, baseY - 64);
      ctx.fillStyle = '#473e5e';
      ctx.fillRect(ox + 1, 64, 46, baseY - 64);
      for (let wy = 66; wy < baseY - 2; wy += 6) {
        ctx.fillStyle = '#685e85';
        ctx.fillRect(ox + 2, wy, 9, 4);
        ctx.fillRect(ox + 37, wy, 9, 4);
      }
      // Deep charred firebox arch
      ctx.fillStyle = '#0c070d';
      ctx.fillRect(ox + 11, 74, 26, baseY - 74);
      ctx.fillRect(ox + 14, 70, 20, 5);
      ctx.fillRect(ox + 17, 68, 14, 3);
      // Glowing embers & stacked oak logs at hearth base
      ctx.fillStyle = '#3d1c0e';
      ctx.fillRect(ox + 14, baseY - 6, 20, 5);
      ctx.fillStyle = '#e04f16';
      ctx.fillRect(ox + 16, baseY - 4, 16, 3);
      ctx.fillStyle = '#ffba38';
      ctx.fillRect(ox + 19, baseY - 3, 10, 2);
    }

    drawGothicWindow(ctx, x, y, w, h) {
      // Stone arch outer frame
      ctx.fillStyle = '#090712';
      ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
      ctx.fillRect(x + 2, y - 6, w - 4, 5);
      ctx.fillRect(x + 6, y - 9, w - 12, 4);

      // Deep rainy midnight night sky visible through tavern window panes!
      const sg = ctx.createLinearGradient(x, y - 8, x, y + h);
      sg.addColorStop(0, '#0f1638');
      sg.addColorStop(0.55, '#1d3269');
      sg.addColorStop(1, '#3974a8');
      ctx.fillStyle = sg;
      ctx.fillRect(x, y, w, h);
      ctx.fillRect(x + 3, y - 5, w - 6, 5);
      ctx.fillRect(x + 7, y - 8, w - 14, 3);

      // Distant silhouetted midnight pine tips at bottom of window pane (hints at outdoor forest!)
      ctx.fillStyle = '#0d1b33';
      for (let px = x + 3; px < x + w - 2; px += 7) {
        const ph = 6 + (px % 5);
        for (let r = 0; r < ph; r++) {
          const hw = Math.max(1, Math.round((r / ph) * 3));
          ctx.fillRect(Math.max(x, px - hw), y + h - ph + r, Math.min(w - (Math.max(x, px - hw) - x), hw * 2 + 1), 1);
        }
      }

      // Soft round pixel moon with crater shading in right window (ZERO square L-block!)
      if (x > 240) {
        const mx = x + 19, my = y + 8;
        for (let dy = -4; dy <= 4; dy++) {
          for (let dx = -4; dx <= 4; dx++) {
            if (dx * dx + dy * dy <= 16) {
              // Carve gentle crescent shadow on left-top edge
              const inCut = (dx + 2) * (dx + 2) + (dy + 1) * (dy + 1) <= 11;
              if (!inCut) {
                ctx.fillStyle = (dx > 0 && dy > -2) ? '#ffffff' : '#bfe8ff';
                ctx.fillRect(mx + dx, my + dy, 1, 1);
              }
            }
          }
        }
      }

      // Stone windowsill
      ctx.fillStyle = '#090712';
      ctx.fillRect(x - 3, y + h, w + 6, 4);
      ctx.fillStyle = '#7382ab';
      ctx.fillRect(x - 2, y + h + 1, w + 4, 2);
    }

    drawWindowMullions(ctx, x, y, w, h) {
      ctx.fillStyle = '#110f1f';
      ctx.fillRect(x + Math.floor(w / 2), y - 8, 2, h + 8);
      ctx.fillRect(x, y + Math.floor(h * 0.36), w, 2);
      ctx.fillRect(x, y + Math.floor(h * 0.70), w, 2);
    }

    drawExitDoor(ctx, x, baseY) {
      const w = 24, h = 42;
      const y = baseY - h;
      ctx.fillStyle = '#090712';
      ctx.fillRect(x - 2, y - 2, w + 4, h + 2);
      ctx.fillRect(x + 2, y - 6, w - 4, 5);
      // Heavy iron-bound oak planks
      ctx.fillStyle = '#472512';
      ctx.fillRect(x, y, w, h);
      ctx.fillRect(x + 3, y - 5, w - 6, 5);
      for (let px = x + 5; px < x + w; px += 6) {
        ctx.fillStyle = '#090712';
        ctx.fillRect(px, y - 4, 1, h + 4);
        ctx.fillStyle = '#6b3b1e';
        ctx.fillRect(px + 1, y, 2, h);
      }
      // Wrought-iron hinge straps & brass ring handle
      ctx.fillStyle = '#1d2133';
      ctx.fillRect(x, y + 10, w, 3);
      ctx.fillRect(x, y + 28, w, 3);
      ctx.fillStyle = '#7e8ab3';
      ctx.fillRect(x + 2, y + 11, 2, 1);
      ctx.fillRect(x + 2, y + 29, 2, 1);
      // Glowing cyan moonlight crack under door & brass ring pull
      ctx.fillStyle = '#ffd966';
      ctx.fillRect(x + 4, y + 20, 4, 4);
      ctx.fillStyle = '#28140b';
      ctx.fillRect(x + 5, y + 21, 2, 2);
      // Small arched peephole glowing cool night-blue
      ctx.fillStyle = '#090712';
      ctx.fillRect(x + 9, y + 2, 6, 6);
      ctx.fillStyle = '#6ce2ff';
      ctx.fillRect(x + 10, y + 3, 4, 4);
    }

    // Native procedural pixel-grid crackling fire (snapped cleanly to 4px grid!)
    drawPixelFlame(ctx, cx, baseY, widthCells, heightCells, seed, isHearth = false) {
      const t = this.time;
      const px = 4;
      const palette = isHearth
        ? ['#a82218', '#e04a1b', '#ff8c29', '#ffd147', '#fff5b8', '#ffffff']
        : ['#e85a1c', '#ff9e2c', '#ffdf66', '#ffffff'];
      const halfW = Math.floor(widthCells / 2);
      const sway = Math.sin(t * (4.6 + seed) + seed) * 1.1 + Math.sin(t * 9.8 + seed * 2) * 0.45;
      const breath = 0.86 + Math.sin(t * (6.2 + seed) + seed) * 0.14;
      const maxH = heightCells * breath;

      for (let row = 0; row < Math.ceil(maxH) + 1; row++) {
        const v = row / Math.max(1, maxH);
        const rowSway = sway * v * v * 1.5;
        const tongue = Math.sin(t * 12.2 - row * 0.8 + seed * 3) * 0.65 * v;
        const rowHalf = halfW * (1 - Math.pow(v, 1.35)) * (0.92 + 0.15 * Math.sin(t * 8.4 + row + seed));
        if (rowHalf < 0.25) continue;
        for (let col = -halfW; col <= halfW; col++) {
          const dist = Math.abs(col - (rowSway + tongue)) / Math.max(0.35, rowHalf);
          if (dist > 1.0) continue;
          const heat = (1 - dist * 0.72) * (1 - v * 0.58);
          const pIdx = Math.max(0, Math.min(palette.length - 1, Math.floor(heat * palette.length)));
          ctx.fillStyle = palette[pIdx];
          ctx.fillRect(Math.round((cx + col * px) / px) * px, Math.round((baseY - row * px) / px) * px, px, px);
        }
      }
    }

    drawArcaneFloorRing(ctx, x, y, color, radius = 44) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(x, y);
      ctx.scale(1, 0.30);
      const bloom = ctx.createRadialGradient(0, 0, 4, 0, 0, radius + 16);
      bloom.addColorStop(0, `${color}66`);
      bloom.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = bloom;
      ctx.beginPath();
      ctx.arc(0, 0, radius + 16, 0, Math.PI * 2);
      ctx.fill();

      ctx.rotate(this.time * 0.6);
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.88;
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // ─── Master Render: Cozy Indoor Midnight Tavern Hall + Dynamic Hearth/Moon Lighting + Duelyst Mercenaries ───
    render() {
      const ctx = this.ctx;
      const { sprites } = window.MT;
      ctx.save();
      ctx.imageSmoothingEnabled = false;

      if (this.shakeTime > 0) {
        ctx.translate(
          Math.round((Math.random() - 0.5) * this.shakeAmp * 2),
          Math.round((Math.random() - 0.5) * this.shakeAmp * 2)
        );
      }

      // 1. Baked 320x180 Indoor Midnight Tavern Hall scaled 4x crisp to 1280x720!
      ctx.drawImage(this.getHallCanvas(this.tavernLevel), 0, 0, STAGE_W, STAGE_H);

      // 2. Live Falling Pixel Rain visible strictly INSIDE the two arched Gothic Tavern Windows!
      if (this.fxRainImg.complete && this.fxRainImg.naturalWidth) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.65;
        const winBoxes = [{ x: 214 * 4, y: 38 * 4, w: 28 * 4, h: 36 * 4 }, { x: 250 * 4, y: 38 * 4, w: 28 * 4, h: 36 * 4 }];
        winBoxes.forEach((wb, idx) => {
          const fIdx = Math.floor((this.time + idx * 2.1) * 28) % 240;
          const sx = (fIdx % 12) * 320 + 60;
          const sy = Math.floor(fIdx / 12) * 180 + 30;
          ctx.save();
          ctx.beginPath();
          ctx.rect(wb.x, wb.y, wb.w, wb.h);
          ctx.clip();
          ctx.drawImage(this.fxRainImg, sx, sy, wb.w, wb.h, wb.x, wb.y, wb.w, wb.h);
          ctx.restore();
        });
        ctx.restore();
      }
      // Draw crisp iron mullions IN FRONT of window rain!
      ctx.save();
      ctx.scale(4, 4);
      this.drawWindowMullions(ctx, 214, 38, 28, 36);
      this.drawWindowMullions(ctx, 250, 38, 28, 36);
      ctx.restore();

      // 3. LIVE CRACKLING PIXEL HEARTH FIRE + SWAYING CHANDELIER & TABLE CANDLE FLAMES!
      // Roaring fireplace hearth (vx=126, vy=100 -> px=504, py=400)
      this.drawPixelFlame(ctx, 504, 404, 13, 14, 0.9, true);
      // Rising crackling fireplace sparks
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const sp of this.hearthSparks) {
        const sx = 504 + Math.sin(sp.t * 7 + sp.seed) * 22;
        const sy = 392 - sp.t * 82;
        ctx.globalAlpha = (1 - sp.t) * 0.9;
        ctx.fillStyle = sp.t < 0.45 ? '#fff2a6' : '#ff7b29';
        ctx.fillRect(Math.round(sx / 4) * 4, Math.round(sy / 4) * 4, 4, 4);
      }
      ctx.restore();

      // Chandelier candle flames (left chandelier vx=48, right vx=174, hung cleanly at vy=25 -> py=114!)
      for (const cx of [48 * 4, 174 * 4]) {
        this.drawPixelFlame(ctx, cx + 22, 114, 2, 4, cx * 0.01 + 0.3, false);
        this.drawPixelFlame(ctx, cx + 54, 114, 2, 5, cx * 0.01 + 1.4, false);
        this.drawPixelFlame(ctx, cx + 86, 114, 2, 4, cx * 0.01 + 2.5, false);
      }
      // Table candelabra flames (vx=146+15=161, vx=214+15=229)
      this.drawPixelFlame(ctx, 161 * 4, 362, 2, 4, 4.1, false);
      this.drawPixelFlame(ctx, 229 * 4, 362, 2, 4, 6.2, false);

      // 4. VOLUMETRIC COOL MOONLIGHT SHAFTS + WARM ORGANIC HEARTH & CHANDELIER LIGHTING!
      const f1 = 0.90 + Math.sin(this.time * 5.8) * 0.06 + Math.sin(this.time * 11.4) * 0.04;
      const f2 = 0.92 + Math.sin(this.time * 4.2 + 1.9) * 0.05;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      // Cool cyan-indigo diagonal moonlight streaming through the two gothic rain windows onto the oak floor!
      for (const wx of [856, 1000]) {
        const ray = ctx.createLinearGradient(wx + 50, 152, wx - 40, 520);
        ray.addColorStop(0, 'rgba(130, 215, 255, 0.22)');
        ray.addColorStop(0.55, 'rgba(95, 175, 240, 0.09)');
        ray.addColorStop(1, 'rgba(70, 140, 220, 0)');
        ctx.fillStyle = ray;
        ctx.beginPath();
        ctx.moveTo(wx, 152);
        ctx.lineTo(wx + 112, 152);
        ctx.lineTo(wx + 32, 520);
        ctx.lineTo(wx - 92, 520);
        ctx.closePath();
        ctx.fill();
      }

      // Roaring Warm Hearth Fire Glow Pool (illuminates stone chimney + polished oak floor!)
      const hg = ctx.createRadialGradient(504, 384, 12, 504, 384, 275 * f1);
      hg.addColorStop(0, `rgba(255, 198, 92, ${0.42 * f1})`);
      hg.addColorStop(0.45, `rgba(255, 125, 38, ${0.18 * f1})`);
      hg.addColorStop(1, 'rgba(255, 90, 20, 0)');
      ctx.fillStyle = hg;
      ctx.fillRect(220, 110, 570, 530);

      // Warm Bar Lantern & Liquor Shelf Glow (left bar area)
      const bg = ctx.createRadialGradient(136, 354, 8, 136, 354, 175 * f2);
      bg.addColorStop(0, `rgba(255, 208, 110, ${0.32 * f2})`);
      bg.addColorStop(0.5, `rgba(255, 148, 48, ${0.12 * f2})`);
      bg.addColorStop(1, 'rgba(255, 110, 20, 0)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 170, 340, 360);

      // Chandelier overhead warm pools
      for (const cx of [246, 750]) {
        const cg = ctx.createRadialGradient(cx, 108, 6, cx, 108, 165);
        cg.addColorStop(0, `rgba(255, 214, 124, ${0.26 * f2})`);
        cg.addColorStop(1, 'rgba(255, 150, 45, 0)');
        ctx.fillStyle = cg;
        ctx.fillRect(cx - 170, 0, 340, 280);
      }

      // Interactive Bounty Board subtle golden focus highlight (x=760, y=246)
      const bbG = ctx.createRadialGradient(760, 246, 8, 760, 246, 82);
      bbG.addColorStop(0, `rgba(255, 220, 120, ${0.16 + Math.sin(this.time * 3.2) * 0.05})`);
      bbG.addColorStop(1, 'rgba(255, 180, 60, 0)');
      ctx.fillStyle = bbG;
      ctx.fillRect(675, 165, 170, 165);
      ctx.restore();

      // 5. Tap Ripples on Tavern Oak Floor
      for (const rp of this.ripples) {
        const p = rp.life / rp.maxLife;
        ctx.save();
        ctx.strokeStyle = rp.color;
        ctx.globalAlpha = p * 0.9;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(rp.x, rp.y, rp.r, rp.r * 0.3, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // 6. All Living Duelyst Mercenaries standing & chatting on the Oak Tavern Floor!
      const hasFocus = Boolean(this.selectedMercId);
      const sorted = [...this.actors].sort((a, b) => a.x - b.x);
      for (const a of sorted) {
        const isSelected = this.selectedMercId === a.merc.id;
        const isSynergyPeer = !isSelected && this.synergyHighlightIds.has(a.merc.id);
        const isDrinkTarget = this.dragTargetMercId === a.merc.id;
        const isDrinkReady = Boolean(this.drinkReadyColor) && !a.marching;
        const bob = a.lifted ? Math.round(Math.sin(this.time * 16) * 4) : 0;
        const pop = a.tapPop || 0;

        // Ground contact shadow on oak planks
        ctx.fillStyle = 'rgba(6, 3, 12, 0.65)';
        ctx.beginPath();
        ctx.ellipse(a.x, a.y + 4, 34, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        if ((isDrinkTarget || isSelected || a.assigned || isDrinkReady || isSynergyPeer) && !a.marching) {
          const ringCol = isDrinkTarget ? (this.dragDrinkColor || '#5ef29b')
            : isSelected ? '#5ce6ff'
            : a.assigned ? '#ffd966'
            : isDrinkReady ? this.drinkReadyColor
            : '#f5c249';
          this.drawArcaneFloorRing(ctx, a.x, a.y + 2, ringCol, isSelected ? 48 : 42);
        }

        let unitAlpha = a.alpha;
        if (a.lifted) unitAlpha = 0.25;
        else if (hasFocus && !isSelected && !isSynergyPeer && !isDrinkReady) unitAlpha = 0.78;

        const anim = a.lifted || isSelected || isDrinkTarget ? 'selected' : a.anim;
        sprites.drawUnit(ctx, a.merc.unitId, anim, this.time + a.phase, a.x, a.y + bob - (a.lifted ? 14 : 0) - Math.round(pop * 10), {
          scale: isSelected || isDrinkTarget ? 1.58 : 1.46,
          flipX: a.facing < 0,
          alpha: unitAlpha,
          outlineColor: isDrinkTarget ? (this.dragDrinkColor || '#5ef29b') : isSelected ? '#5ce6ff' : isSynergyPeer ? '#ffd966' : a.assigned ? '#ffd966' : null,
          squashX: a.lifted ? 0.92 : 1 - pop * 0.1,
          squashY: a.lifted ? 1.08 : 1 + pop * 0.14
        });
      }

      // 7. Live Duelyst Drink-Enchant VFX, Dynamic Light Blooms, Dust Motes & Particles
      if (window.MT.vfx) {
        for (const inst of this.activeVfx) window.MT.vfx.draw(ctx, inst);
      }
      if (this.lights.length > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const l of this.lights) {
          const a = Math.max(0, l.life / l.maxLife);
          const lg2 = ctx.createRadialGradient(l.x, l.y, 4, l.x, l.y, l.radius);
          lg2.addColorStop(0, l.color);
          lg2.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.globalAlpha = a * 0.45;
          ctx.fillStyle = lg2;
          ctx.beginPath();
          ctx.arc(l.x, l.y, l.radius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Floating warm hearth dust motes & cool window dust
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < this.dust.length; i++) {
        const d = this.dust[i];
        const pulse = 0.22 + 0.52 * (0.5 + 0.5 * Math.sin(this.time * (1.8 + (i % 4) * 0.4) + d.phase));
        ctx.globalAlpha = pulse;
        ctx.fillStyle = d.x > 820 ? '#9cf4ff' : '#ffe294';
        ctx.fillRect(Math.round(d.x), Math.round(d.y), d.r, d.r);
      }
      ctx.restore();

      for (const p of this.particles) {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      }
      ctx.globalAlpha = 1;

      // 8. Chunky Black-Outlined Steel Pixel Nameplates, Synergy Badges, Bubbles & Floaters!
      this.drawMercOverlays(ctx);

      // Subtle atmospheric outer vignette framing the indoor tavern cozy glow
      const vig = ctx.createRadialGradient(STAGE_W * 0.5, STAGE_H * 0.48, 340, STAGE_W * 0.5, STAGE_H * 0.5, 780);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(5, 3, 12, 0.44)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, STAGE_W, STAGE_H);

      ctx.restore();
    }

    drawMercOverlays(ctx) {
      const { TIERS } = window.MT.DATA || {};
      const sorted = [...this.actors].sort((a, b) => a.x - b.x);

      for (const a of sorted) {
        if (a.marching || a.alpha <= 0.3) continue;
        const isSynergyPeer = this.selectedMercId !== a.merc.id && this.synergyHighlightIds.has(a.merc.id);

        if (a.assigned && a.merc.factionTag) {
          ctx.fillStyle = '#090712';
          ctx.fillRect(Math.round(a.x - 32), Math.round(a.y - 134), 64, 22);
          ctx.fillStyle = '#ffd966';
          ctx.fillRect(Math.round(a.x - 30), Math.round(a.y - 132), 60, 18);
          ctx.fillStyle = '#140c04';
          ctx.font = '900 11px "Noto Sans SC", monospace';
          ctx.textAlign = 'center';
          ctx.fillText('★ 已选定', Math.round(a.x), Math.round(a.y - 119));
        } else if (isSynergyPeer && !a.assigned) {
          ctx.fillStyle = '#090712';
          ctx.fillRect(Math.round(a.x - 36), Math.round(a.y - 134), 72, 24);
          ctx.fillStyle = '#ffd966';
          ctx.fillRect(Math.round(a.x - 34), Math.round(a.y - 132), 68, 20);
          ctx.fillStyle = '#140c04';
          ctx.font = '900 12px "Noto Sans SC", monospace';
          ctx.textAlign = 'center';
          ctx.fillText('可凑羁绊', Math.round(a.x), Math.round(a.y - 118));
        }

        const tierCfg = (TIERS && TIERS[a.merc.tier]) || { grade: 'C', color: '#5ef29b' };
        const gemCol = a.merc.factionColor || (a.assigned ? '#ffd966' : tierCfg.color);
        const nameTxt = `${a.merc.redSeal ? '◈' : (a.merc.isSigned ? '★' : '')}${a.merc.name}`;
        const pwrTxt = a.merc.roleTag ? `${a.merc.roleTag} ${a.merc.effectivePower ?? a.merc.power}` : `${a.merc.effectivePower ?? a.merc.power}`;

        ctx.font = '900 13px "Noto Sans SC", monospace';
        const nameW = Math.ceil(ctx.measureText(nameTxt).width);
        const pwrW = Math.ceil(ctx.measureText(pwrTxt).width);
        const nw = Math.max(108, nameW + pwrW + 44);
        const nh = 26;
        const lx = Math.round(a.x - nw / 2);
        const ly = Math.round(a.y + 10);

        ctx.save();
        ctx.fillStyle = '#090712';
        ctx.fillRect(lx - 3, ly - 3, nw + 6, nh + 6);
        ctx.fillStyle = a.assigned ? '#423118' : '#252a40';
        ctx.fillRect(lx, ly, nw, nh);
        ctx.fillStyle = a.assigned ? '#ffe388' : '#737ea3';
        ctx.fillRect(lx, ly, nw, 2);
        ctx.fillStyle = '#121524';
        ctx.fillRect(lx, ly + nh - 2, nw, 2);

        ctx.fillStyle = '#090712';
        ctx.fillRect(lx + 7, ly + 8, 10, 10);
        ctx.fillStyle = gemCol;
        ctx.fillRect(lx + 9, ly + 10, 6, 6);

        ctx.fillStyle = a.assigned ? '#fff4cc' : '#f2f5ff';
        ctx.textAlign = 'left';
        ctx.fillText(nameTxt, lx + 21, ly + 18);

        const divX = lx + nw - pwrW - 16;
        ctx.fillStyle = '#090712';
        ctx.fillRect(divX, ly + 4, 2, nh - 8);
        ctx.fillStyle = a.merc.drinkBuff ? a.merc.drinkBuff.glow : '#ffd966';
        ctx.textAlign = 'right';
        ctx.fillText(pwrTxt, lx + nw - 8, ly + 18);
        ctx.restore();
      }

      for (const a of sorted) {
        if (a.bubble && a.bubbleTimer > 0 && a.alpha > 0.3) {
          this.drawPixelBubble(ctx, a.x, a.y - 148, a.bubble);
        }
      }

      for (const f of this.floaters) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, f.life * 1.4);
        ctx.font = '900 17px "Noto Sans SC", monospace';
        ctx.textAlign = 'center';
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#090712';
        ctx.strokeText(f.text, Math.round(f.x), Math.round(f.y));
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, Math.round(f.x), Math.round(f.y));
        ctx.restore();
      }
    }

    drawPixelBubble(ctx, x, y, text) {
      ctx.save();
      ctx.font = '900 13px "Noto Sans SC", monospace';
      const maxW = 248;
      const tokens = text.match(/[A-Za-z0-9]+|./g) || [];
      const lines = [];
      let cur = '';
      for (const tok of tokens) {
        if (cur && ctx.measureText(cur + tok).width > maxW - 22) { lines.push(cur.trimEnd()); cur = tok.trimStart(); }
        else cur += tok;
      }
      if (cur) lines.push(cur);

      const bw = Math.min(maxW, Math.max(96, Math.ceil(Math.max(...lines.map((l) => ctx.measureText(l).width))) + 24));
      const bh = lines.length * 18 + 14;
      const bx = Math.max(16, Math.min(STAGE_W - 16 - bw, Math.round(x - bw / 2)));
      const by = Math.max(76, Math.round(y - bh));

      ctx.fillStyle = '#090712';
      ctx.fillRect(bx - 3, by - 3, bw + 6, bh + 6);
      ctx.fillStyle = '#21263b';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = '#7581a6';
      ctx.fillRect(bx, by, bw, 2);
      ctx.fillStyle = '#121524';
      ctx.fillRect(bx, by + bh - 2, bw, 2);

      ctx.fillStyle = '#f5f7ff';
      ctx.textAlign = 'left';
      lines.forEach((line, idx) => ctx.fillText(line, bx + 12, by + 19 + idx * 18));
      ctx.restore();
    }
  }

  window.MT.STAGE_W = STAGE_W;
  window.MT.STAGE_H = STAGE_H;
  window.MT.TavernCanvas = TavernCanvas;
})();
