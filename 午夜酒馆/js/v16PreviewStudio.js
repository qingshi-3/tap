// v16.6 Effect Preview Studio — Live Showcase for all 8 Pixel Maps, 8 Dynamic Weathers,
// 5 Celestial Eclipse Card Tiers (C -> SSS) + Seals, and MIT pixelfx Combat VFX!
(function () {
  window.MT = window.MT || {};

  const WEATHER_CATALOG = [
    { id: 'drizzle',       label: '夜雨',       group: 'everyday', desc: '像素斜雨 + 桥面水花' },
    { id: 'snow',          label: '飞雪',       group: 'everyday', desc: '多层像素飘雪' },
    { id: 'fireflies',     label: '萤火',       group: 'everyday', desc: '暖光萤火虫浮游' },
    { id: 'mist',          label: '幽雾',       group: 'everyday', desc: '低空漂移浓雾' },
    { id: 'blood_embers',  label: '血蚀余烬暴', group: 'fantasy',  desc: '血月压迫 + 疾风火星' },
    { id: 'arcane_storm',  label: '奥术紫电暴', group: 'fantasy',  desc: '暴雨 + 像素分叉落雷' },
    { id: 'meteor_shower', label: '星陨流星雨', group: 'fantasy',  desc: '斜掠金青像素流星' },
    { id: 'void_rift',     label: '虚空裂隙尘', group: 'fantasy',  desc: '反重力浮升虚空碎片' }
  ];

  const VFX_SHOWCASE = [
    { id: 'pfx_sword_slash',      label: '剑刃斩击', cat: '近战' },
    { id: 'pfx_double_slash',     label: '黄金双连', cat: '近战' },
    { id: 'pfx_heavy_cleave',     label: '烈焰重劈', cat: '近战' },
    { id: 'pfx_blood_claws',      label: '血爪撕裂', cat: '近战' },
    { id: 'pfx_scythe_reap',      label: '死神镰割', cat: '近战' },
    { id: 'pfx_shield_block',     label: '寒冰盾防', cat: '防御' },
    { id: 'pfx_crit_hit',         label: '金光暴击', cat: '冲击' },
    { id: 'pfx_ground_slam',      label: '裂地震击', cat: '冲击' },
    { id: 'pfx_acid_splash',      label: '剧毒溅射', cat: '剧毒' },
    { id: 'pfx_venom_blast',      label: '毒雾爆裂', cat: '剧毒' },
    { id: 'pfx_frost_nova',       label: '冰霜新星', cat: '冰霜' },
    { id: 'pfx_ice_shatter',      label: '碎冰爆破', cat: '冰霜' },
    { id: 'pfx_blood_drain',      label: '血契汲魂', cat: '暗影' },
    { id: 'pfx_dark_explosion',   label: '暗影湮灭', cat: '暗影' },
    { id: 'pfx_holy_smite',       label: '圣光惩戒', cat: '奥术' },
    { id: 'pfx_star_fall',        label: '星陨天降', cat: '奥术' },
    { id: 'pfx_lightning_strike', label: '雷霆落雷', cat: '雷电' },
    { id: 'pfx_flame_pillar',     label: '炎柱爆发', cat: '火焰' },
    { id: 'pfx_coin_drop',        label: '金币雨落', cat: '增益' },
    { id: 'pfx_plasma_death',     label: '终结处决', cat: '终结' }
  ];

  class PreviewStudio {
    constructor(app) {
      this.app = app;
      this.modal = document.getElementById('preview-studio-modal');
      this.isOpen = false;
      this.tab = 'scene'; // 'scene' | 'cards'

      this.mapId = 'mirror_lake';
      this.weather = 'arcane_storm';
      this.seals = { redSeal: false, glassBlade: false, ironPlated: false, greedBadge: false };
      this.sampleOffset = 0;

      this.rafId = 0;
      this.lastTs = 0;
      this.time = 0;
      this.activeVfx = [];
      this.bossFlash = 0;
      this.bossKnock = 0;
      this.heroAnimTimer = 0;
      this.lastVfxLabel = '点击右侧特效或上方任意卡牌即可在舞台预览';

      this.sceneBuf = document.createElement('canvas');
      this.sceneBuf.width = 860;
      this.sceneBuf.height = 300;
      this.sceneBufCtx = this.sceneBuf.getContext('2d');

      this.reflBuf = document.createElement('canvas');
      this.reflBuf.width = 860;
      this.reflBuf.height = 200;
      this.reflBufCtx = this.reflBuf.getContext('2d');

      this._bindChrome();
    }

    _bindChrome() {
      if (!this.modal) return;
      const closeBtn = document.getElementById('ps-close-btn');
      if (closeBtn) closeBtn.onclick = () => this.close();
      const tabScene = document.getElementById('ps-tab-scene');
      const tabCards = document.getElementById('ps-tab-cards');
      if (tabScene) tabScene.onclick = () => this.switchTab('scene');
      if (tabCards) tabCards.onclick = () => this.switchTab('cards');
      this.modal.addEventListener('click', (ev) => {
        if (ev.target === this.modal) this.close();
      });
    }

    open(initialTab = 'scene') {
      if (!this.modal) return;
      // Sync initial map & weather to current wave scene if in a run
      const cur = this.app && this.app.run && this.app.run.waveScene;
      if (cur && cur.mapId) this.mapId = cur.mapId;
      if (cur && cur.weather) this.weather = cur.weather;

      this.isOpen = true;
      this.modal.classList.remove('hidden');
      this.switchTab(initialTab);
      this._startLoop();
    }

    close() {
      if (!this.modal) return;
      this.isOpen = false;
      this.modal.classList.add('hidden');
      this._stopLoop();
      this.activeVfx = [];
    }

    switchTab(tab) {
      this.tab = tab === 'cards' ? 'cards' : 'scene';
      const tabScene = document.getElementById('ps-tab-scene');
      const tabCards = document.getElementById('ps-tab-cards');
      const paneScene = document.getElementById('ps-pane-scene');
      const paneCards = document.getElementById('ps-pane-cards');
      if (tabScene) tabScene.classList.toggle('active', this.tab === 'scene');
      if (tabCards) tabCards.classList.toggle('active', this.tab === 'cards');
      if (paneScene) paneScene.classList.toggle('hidden', this.tab !== 'scene');
      if (paneCards) paneCards.classList.toggle('hidden', this.tab !== 'cards');

      this.activeVfx = [];
      if (this.tab === 'scene') {
        this._renderSceneControls();
      } else {
        this._renderCardsPane();
      }
    }

    _getAllHeroes() {
      const D = window.MT.V14_DATA || {};
      if (D.ALL_HERO_MAP) return Object.values(D.ALL_HERO_MAP);
      return [...(D.STARTER_TEMPLATES || []), ...(D.SHOP_HEROES || [])];
    }

    _getSampleSquad() {
      const D = window.MT.V14_DATA || {};
      const all = this._getAllHeroes();
      const bosses = D.BOSS_POOL || [];
      const heroes = [
        all.find((h) => h.tier === 'C') || all[0],
        all.find((h) => h.tier === 'A') || all[4],
        all.find((h) => h.tier === 'SSS') || all[all.length - 1]
      ].filter(Boolean);
      const boss = bosses[1] || bosses[0] || { unitId: 'boss_ironclad', name: '幻影构装' };
      return { heroes, boss };
    }

    _renderSceneControls() {
      const maps = window.MT.BATTLE_MAPS || [];
      const mapGrid = document.getElementById('ps-map-grid');
      if (mapGrid) {
        mapGrid.innerHTML = maps.map((m, idx) => `
          <button type="button" class="ps-chip ${m.id === this.mapId ? 'active' : ''}" data-map="${m.id}">
            <span class="ps-chip-num">0${idx + 1}</span>
            <span class="ps-chip-name">${m.name}</span>
          </button>
        `).join('');
        mapGrid.querySelectorAll('[data-map]').forEach((btn) => {
          btn.onclick = () => {
            this.mapId = btn.dataset.map;
            if (window.MT.getBattleMapImage) window.MT.getBattleMapImage(this.mapId);
            if (this.app && this.app.audio && this.app.audio.playPickup) this.app.audio.playPickup();
            this._renderSceneControls();
          };
        });
      }

      const everydayGrid = document.getElementById('ps-weather-everyday');
      const fantasyGrid = document.getElementById('ps-weather-fantasy');
      const renderW = (list) => list.map((w) => `
        <button type="button" class="ps-chip ps-weather-chip ${w.group === 'fantasy' ? 'is-fantasy' : ''} ${w.id === this.weather ? 'active' : ''}" data-weather="${w.id}" title="${w.desc}">
          <span class="ps-chip-name">${w.label}</span>
          <span class="ps-chip-sub">${w.desc}</span>
        </button>
      `).join('');
      if (everydayGrid) everydayGrid.innerHTML = renderW(WEATHER_CATALOG.filter((w) => w.group === 'everyday'));
      if (fantasyGrid) fantasyGrid.innerHTML = renderW(WEATHER_CATALOG.filter((w) => w.group === 'fantasy'));

      document.querySelectorAll('#ps-pane-scene [data-weather]').forEach((btn) => {
        btn.onclick = () => {
          this.weather = btn.dataset.weather;
          if (this.app && this.app.audio && this.app.audio.playPickup) this.app.audio.playPickup();
          this._renderSceneControls();
        };
      });

      const randomBtn = document.getElementById('ps-btn-random-scene');
      if (randomBtn) {
        randomBtn.onclick = () => {
          if (maps.length > 1) {
            const others = maps.filter((m) => m.id !== this.mapId);
            this.mapId = others[Math.floor(Math.random() * others.length)].id;
          }
          const wOthers = WEATHER_CATALOG.filter((w) => w.id !== this.weather);
          this.weather = wOthers[Math.floor(Math.random() * wOthers.length)].id;
          if (this.app && this.app.audio && this.app.audio.playPickup) this.app.audio.playPickup();
          this._renderSceneControls();
        };
      }

      const applyBtn = document.getElementById('ps-btn-apply-scene');
      if (applyBtn) {
        const hasRun = Boolean(this.app && this.app.run);
        applyBtn.disabled = !hasRun;
        applyBtn.textContent = hasRun ? '应用到当前波' : '开局后可应用';
        applyBtn.onclick = () => {
          if (!this.app || !this.app.run) return;
          const mapCfg = window.MT.getBattleMapConfig ? window.MT.getBattleMapConfig(this.mapId) : null;
          const scene = {
            wave: this.app.run.wave || 1,
            mapId: this.mapId,
            mapName: mapCfg ? mapCfg.name : this.mapId,
            biome: (mapCfg && mapCfg.biome) || 'default',
            weather: this.weather
          };
          this.app.run.waveScene = scene;
          if (this.app.battleStage) {
            this.app.battleStage.mapCfg = mapCfg || this.app.battleStage.mapCfg;
            this.app.battleStage.biome = scene.biome;
            this.app.battleStage.weather = scene.weather;
            if (window.MT.getBattleMapImage) window.MT.getBattleMapImage(this.mapId);
          }
          if (this.app.tavernShopStage) {
            this.app.tavernShopStage.campMapId = this.mapId;
            this.app.tavernShopStage.campBiome = scene.biome;
            this.app.tavernShopStage.campWeather = scene.weather;
            this.app.tavernShopStage._campStatic = null;
          }
          const wObj = WEATHER_CATALOG.find((w) => w.id === this.weather);
          if (this.app.toast) {
            this.app.toast(`已切换场景：${scene.mapName} · ${wObj ? wObj.label : this.weather}`);
          }
        };
      }

      const canvas = document.getElementById('ps-scene-canvas');
      if (canvas && !canvas._psBound) {
        canvas._psBound = true;
        canvas.onclick = () => {
          const pick = VFX_SHOWCASE[Math.floor(Math.random() * VFX_SHOWCASE.length)];
          this._triggerVfx(pick.id, pick.label, 'scene');
        };
      }

      const mapCfg = window.MT.getBattleMapConfig ? window.MT.getBattleMapConfig(this.mapId) : null;
      const wObj = WEATHER_CATALOG.find((w) => w.id === this.weather);
      const caption = document.getElementById('ps-scene-caption');
      if (caption) {
        caption.innerHTML = `<b>${mapCfg ? mapCfg.name : this.mapId}</b><span>·</span><b>${wObj ? wObj.label : this.weather}</b><small>（点击画面可试放战斗特效）</small>`;
      }
    }

    _renderCardsPane() {
      const D = window.MT.V14_DATA || {};
      const all = this._getAllHeroes();
      const tiers = ['C', 'B', 'A', 'S', 'SSS'];
      const tierTitles = {
        C: 'C · 静谧星光',
        B: 'B · 蓝月星尘',
        A: 'A · 紫蚀月环',
        S: 'S · 黄金日环食',
        SSS: 'SSS · 黑日蚀暴'
      };

      // Seal toggles
      const sealsWrap = document.getElementById('ps-seals-bar');
      if (sealsWrap) {
        const sealDefs = [
          { key: 'redSeal',    label: '红印 (伤害×2)' },
          { key: 'glassBlade', label: '琉璃 (伤害×2)' },
          { key: 'ironPlated', label: '镀铁 (+18盾)' },
          { key: 'greedBadge', label: '贪欲 (+2G)' }
        ];
        sealsWrap.innerHTML = sealDefs.map((s) => `
          <button type="button" class="ps-seal-btn ${this.seals[s.key] ? 'active' : ''}" data-seal="${s.key}">${s.label}</button>
        `).join('') + `<button type="button" class="ps-seal-btn ps-cycle-btn" id="ps-btn-cycle-cards">换一批队员 ↻</button>`;

        sealsWrap.querySelectorAll('[data-seal]').forEach((btn) => {
          btn.onclick = () => {
            const k = btn.dataset.seal;
            this.seals[k] = !this.seals[k];
            if (this.app && this.app.audio && this.app.audio.playPickup) this.app.audio.playPickup();
            this._renderCardsPane();
          };
        });
        const cyc = document.getElementById('ps-btn-cycle-cards');
        if (cyc) {
          cyc.onclick = () => {
            this.sampleOffset += 1;
            if (this.app && this.app.audio && this.app.audio.playPickup) this.app.audio.playPickup();
            this._renderCardsPane();
          };
        }
      }

      // 5 Tier Cards Showcase
      const row = document.getElementById('ps-cards-row');
      if (row && this.app && this.app._unitCardInner) {
        const cardsHtml = tiers.map((tier) => {
          const pool = all.filter((h) => h.tier === tier);
          const base = pool.length ? pool[this.sampleOffset % pool.length] : all[0];
          if (!base) return '';
          const theme = (D.THEMES && D.THEMES[base.theme]) || { bg: 'rgba(255,217,102,0.18)' };
          const h = Object.assign({}, base, {
            uid: `preview_${tier}`,
            atk: this.seals.redSeal || this.seals.glassBlade ? base.atk + 25 : base.atk,
            baseAtk: base.atk,
            redSeal: this.seals.redSeal,
            glassBlade: this.seals.glassBlade,
            ironPlated: this.seals.ironPlated,
            greedBadge: this.seals.greedBadge
          });
          return `
            <div class="ps-card-col">
              <div class="ps-tier-label tier-${tier}">${tierTitles[tier]}</div>
              <div class="v14-card v14-card-tier-${tier} ps-preview-card" data-vfx="${base.vfx || 'pfx_sword_slash'}" data-name="${base.shortName || base.name}" style="--card-glow:${theme.bg}">
                ${this.app._unitCardInner(h, '', { packMode: true })}
              </div>
            </div>
          `;
        }).join('');
        row.innerHTML = cardsHtml;
        row.querySelectorAll('.v14-card-sprite').forEach((sp) => {
          if (this.app.sprites && this.app.sprites.createDomSprite) {
            sp.appendChild(this.app.sprites.createDomSprite(sp.dataset.unit, 'idle', 76));
          }
        });
        // Reuse the EXACT same 3D holographic pointer tilt & Celestial Eclipse canvas loop as Battle Hand!
        row.querySelectorAll('.ps-preview-card').forEach((cardEl) => {
          const isB = cardEl.classList.contains('v14-card-tier-B');
          const maxY = isB ? 8 : 15;
          const maxX = isB ? 6 : 12;
          if (!cardEl.classList.contains('v14-card-tier-C')) {
            cardEl.onpointermove = (ev) => {
              const rect = cardEl.getBoundingClientRect();
              if (!rect.width || !rect.height) return;
              cardEl._hoveringTilt = true;
              const nx = Math.max(-1, Math.min(1, ((ev.clientX - rect.left) / rect.width) * 2 - 1));
              const ny = Math.max(-1, Math.min(1, ((ev.clientY - rect.top) / rect.height) * 2 - 1));
              const ry = nx * maxY;
              const rx = -ny * maxX;
              cardEl.style.setProperty('--rx', `${rx.toFixed(2)}deg`);
              cardEl.style.setProperty('--ry', `${ry.toFixed(2)}deg`);
              cardEl.style.setProperty('--mx', `${(50 + nx * 42).toFixed(1)}%`);
              cardEl.style.setProperty('--my', `${(50 + ny * 42).toFixed(1)}%`);
              cardEl.style.setProperty('--sh-x', `${(-ry * 0.8).toFixed(1)}px`);
              cardEl.style.setProperty('--sh-y', `${(9 + rx * 0.6).toFixed(1)}px`);
            };
            cardEl.onpointerleave = () => {
              cardEl._hoveringTilt = false;
              if (isB) {
                cardEl.style.setProperty('--rx', '0deg');
                cardEl.style.setProperty('--ry', '0deg');
                cardEl.style.setProperty('--mx', '50%');
                cardEl.style.setProperty('--my', '35%');
              }
            };
          }
          cardEl.onclick = () => {
            const vfxId = cardEl.dataset.vfx || 'pfx_sword_slash';
            const nm = cardEl.dataset.name || '技能';
            this._triggerVfx(vfxId, `${nm} · ${vfxId}`, 'cards');
          };
        });
        if (this.app && this.app.startCardFxLoop) {
          this.app.startCardFxLoop();
        }
      }

      // VFX Buttons Grid
      const vfxGrid = document.getElementById('ps-vfx-grid');
      if (vfxGrid) {
        vfxGrid.innerHTML = VFX_SHOWCASE.map((v) => `
          <button type="button" class="ps-vfx-btn" data-vfx="${v.id}" data-label="${v.label}">
            <span class="ps-vfx-cat">${v.cat}</span>
            <span class="ps-vfx-name">${v.label}</span>
          </button>
        `).join('');
        vfxGrid.querySelectorAll('[data-vfx]').forEach((btn) => {
          btn.onclick = () => {
            this._triggerVfx(btn.dataset.vfx, btn.dataset.label, 'cards');
          };
        });
      }
      const vfxLabel = document.getElementById('ps-vfx-status');
      if (vfxLabel) vfxLabel.textContent = this.lastVfxLabel;
    }

    _triggerVfx(vfxId, label, mode) {
      const vfx = window.MT.vfx;
      if (!vfx) return;
      const fn = vfx.spawn || vfx.createInstance;
      if (!fn) return;
      const x = mode === 'scene' ? 660 : 340;
      const y = mode === 'scene' ? 228 : 112;
      const scale = mode === 'scene' ? 1.55 : 1.45;
      const inst = fn.call(vfx, vfxId, x, y, { scale });
      if (inst) this.activeVfx.push(inst);
      this.bossFlash = 0.16;
      this.bossKnock = 14;
      this.heroAnimTimer = 0.48;
      this.lastVfxLabel = `正在播放：${label}`;
      const vfxLabel = document.getElementById('ps-vfx-status');
      if (vfxLabel) vfxLabel.textContent = this.lastVfxLabel;
      if (this.app && this.app.audio && this.app.audio.playSlash) this.app.audio.playSlash();
    }

    _startLoop() {
      if (this.rafId) return;
      this.lastTs = performance.now();
      const tick = (now) => {
        if (!this.isOpen) { this.rafId = 0; return; }
        const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTs) / 1000));
        this.lastTs = now;
        this.time += dt;
        this._update(dt);
        if (this.tab === 'scene') this._renderSceneCanvas();
        else this._renderVfxCanvas();
        this.rafId = requestAnimationFrame(tick);
      };
      this.rafId = requestAnimationFrame(tick);
    }

    _stopLoop() {
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = 0;
      }
    }

    _update(dt) {
      if (this.bossFlash > 0) this.bossFlash = Math.max(0, this.bossFlash - dt);
      this.bossKnock *= Math.pow(0.001, dt);
      if (this.heroAnimTimer > 0) this.heroAnimTimer = Math.max(0, this.heroAnimTimer - dt);
      if (window.MT.vfx && window.MT.vfx.update) {
        for (let i = this.activeVfx.length - 1; i >= 0; i--) {
          window.MT.vfx.update(this.activeVfx[i], dt);
          if (this.activeVfx[i].done) this.activeVfx.splice(i, 1);
        }
      }
    }

    _renderSceneCanvas() {
      const canvas = document.getElementById('ps-scene-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const W = canvas.width;  // 860
      const H = canvas.height; // 484
      const bridgeY = Math.round(H * 0.56); // 271px — flat stone road center
      const t = this.time;

      const mapCfg = window.MT.getBattleMapConfig ? window.MT.getBattleMapConfig(this.mapId) : null;
      const mapImg = (mapCfg && window.MT.getBattleMapImage) ? window.MT.getBattleMapImage(mapCfg.id) : null;
      const hasMap = Boolean(mapImg && mapImg.complete && mapImg.naturalWidth > 0 && window.MT.drawBattleMapAligned);
      const layout = hasMap ? window.MT.getBattleMapLayout(mapCfg, H, bridgeY) : { shiftY: 0, waterY: bridgeY + 28 };
      const waterY = layout.waterY;

      // 1. Render Upper World (sky + weather + units standing squarely on stone road) into sceneBuf for water reflection
      const sctx = this.sceneBufCtx;
      sctx.save();
      sctx.imageSmoothingEnabled = false;
      sctx.clearRect(0, 0, W, this.sceneBuf.height);

      if (hasMap) {
        sctx.save();
        sctx.beginPath(); sctx.rect(0, 0, W, bridgeY + 18); sctx.clip();
        window.MT.drawBattleMapAligned(sctx, mapCfg, mapImg, W, H, bridgeY);
        sctx.restore();
      } else {
        const g = sctx.createLinearGradient(0, 0, 0, bridgeY);
        g.addColorStop(0, '#070912'); g.addColorStop(1, '#1b263b');
        sctx.fillStyle = g; sctx.fillRect(0, 0, W, bridgeY);
      }

      // Dynamic Weather on upper world
      if (window.MT.renderPixelWeather) {
        window.MT.renderPixelWeather(sctx, this.weather, t, W, bridgeY, {
          biome: (mapCfg && mapCfg.biome) || 'default',
          intensity: 1.0
        });
      }

      // Ground shadows + Sample Heroes & Boss standing dead-center on the stone road (y = bridgeY)
      const sprites = this.app && this.app.sprites;
      const { heroes, boss } = this._getSampleSquad();
      if (sprites && sprites.drawUnit) {
        const xs = [155, 275, 395];
        sctx.fillStyle = 'rgba(5, 4, 12, 0.54)';
        for (const ux of xs) {
          sctx.beginPath(); sctx.ellipse(ux, bridgeY + 2, 24, 5, 0, 0, Math.PI * 2); sctx.fill();
        }
        sctx.beginPath(); sctx.ellipse(Math.round(660 + this.bossKnock), bridgeY + 2, 36, 6, 0, 0, Math.PI * 2); sctx.fill();

        heroes.forEach((h, i) => {
          sprites.drawUnit(sctx, h.unitId, 'idle', t + i * 0.45, xs[i], bridgeY, {
            scale: 1.45,
            flipX: false,
            outlineColor: i === 2 ? '#ff5e8e' : i === 1 ? '#d48cff' : '#e6eefc'
          });
        });
        sprites.drawUnit(sctx, boss.unitId, 'idle', t, Math.round(660 + this.bossKnock), bridgeY, {
          scale: 1.88,
          flipX: true,
          flashWhite: this.bossFlash > 0 ? Math.min(0.85, this.bossFlash / 0.14) : 0,
          outlineColor: this.bossFlash > 0 ? '#ffffff' : '#f2f6ff'
        });
      }

      // Active pixelfx VFX
      if (window.MT.vfx && window.MT.vfx.draw) {
        for (const inst of this.activeVfx) window.MT.vfx.draw(sctx, inst);
      }
      sctx.restore();

      // 2. Composite Full Undistorted Map + Upper Units + Mirror-Lake Reflection strictly below waterY!
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, W, H);
      if (hasMap) {
        window.MT.drawBattleMapAligned(ctx, mapCfg, mapImg, W, H, bridgeY);
      }
      // Draw upper world (weather + units on road) cleanly down to bridgeY + 8
      ctx.drawImage(this.sceneBuf, 0, 0, W, bridgeY + 8, 0, 0, W, bridgeY + 8);

      // Lower Lake Reflection strictly below the bridge stone parapet (y >= waterY)
      const lakeH = Math.max(24, H - waterY);
      ctx.save();
      ctx.beginPath(); ctx.rect(0, waterY, W, lakeH); ctx.clip();
      const rctx = this.reflBufCtx;
      rctx.save();
      rctx.clearRect(0, 0, W, this.reflBuf.height);
      rctx.translate(0, lakeH);
      rctx.scale(1, -1);
      rctx.drawImage(this.sceneBuf, 0, bridgeY - lakeH, W, lakeH, 0, 0, W, lakeH);
      rctx.restore();

      ctx.globalAlpha = 0.40;
      for (let sy = 0; sy < lakeH; sy += 10) {
        const h = Math.min(10, lakeH - sy);
        const ripple = Math.round(Math.sin(sy * 0.09 + t * 3.4) * (1.2 + (sy / lakeH) * 2.0));
        ctx.drawImage(this.reflBuf, 0, sy, W, h, ripple, waterY + sy, W, h);
      }
      ctx.globalAlpha = 1;
      const wg = ctx.createLinearGradient(0, waterY, 0, H);
      wg.addColorStop(0, 'rgba(6, 10, 20, 0.22)');
      wg.addColorStop(1, 'rgba(4, 5, 12, 0.68)');
      ctx.fillStyle = wg;
      ctx.fillRect(0, waterY, W, lakeH);
      ctx.restore();
      ctx.restore();
    }

    _renderVfxCanvas() {
      const canvas = document.getElementById('ps-vfx-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const W = canvas.width;  // 480
      const H = canvas.height; // 196
      const floorY = H - 30;
      const t = this.time;

      ctx.save();
      ctx.imageSmoothingEnabled = false;
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#090c18');
      bg.addColorStop(0.76, '#141c2e');
      bg.addColorStop(1, '#080912');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Stone floor strip
      ctx.fillStyle = '#242c42';
      ctx.fillRect(0, floorY, W, 6);
      ctx.fillStyle = '#141929';
      ctx.fillRect(0, floorY + 6, W, H - floorY - 6);
      for (let x = 0; x < W; x += 36) {
        ctx.fillStyle = '#0a0d17';
        ctx.fillRect(x, floorY, 2, 18);
      }

      const sprites = this.app && this.app.sprites;
      const { heroes, boss } = this._getSampleSquad();
      const hero = heroes[2] || heroes[0];
      if (sprites && sprites.drawUnit) {
        // Ground shadows
        ctx.fillStyle = 'rgba(4, 4, 10, 0.6)';
        ctx.beginPath(); ctx.ellipse(130, floorY + 2, 26, 5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(340 + this.bossKnock, floorY + 2, 38, 6, 0, 0, Math.PI * 2); ctx.fill();

        const hAnim = this.heroAnimTimer > 0 ? 'attack' : 'idle';
        if (hero && hero.unitId) {
          sprites.drawUnit(ctx, hero.unitId, hAnim, hAnim === 'attack' ? (0.48 - this.heroAnimTimer) : t, 130, floorY, {
            scale: 1.65,
            flipX: false,
            loop: hAnim !== 'attack',
            elapsedOverride: hAnim === 'attack' ? (0.48 - this.heroAnimTimer) : null,
            outlineColor: '#ffd966'
          });
        }
        if (boss && boss.unitId) {
          sprites.drawUnit(ctx, boss.unitId, 'idle', t, Math.round(340 + this.bossKnock), floorY, {
            scale: 1.9,
            flipX: true,
            flashWhite: this.bossFlash > 0 ? Math.min(0.85, this.bossFlash / 0.14) : 0,
            outlineColor: this.bossFlash > 0 ? '#ffffff' : '#ff8a9e'
          });
        }
      }

      if (window.MT.vfx && window.MT.vfx.draw) {
        for (const inst of this.activeVfx) window.MT.vfx.draw(ctx, inst);
      }
      ctx.restore();
    }
  }

  window.MT.PreviewStudio = PreviewStudio;
})();
