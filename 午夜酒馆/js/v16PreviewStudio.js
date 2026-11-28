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
      this.cardTheme = (typeof localStorage !== 'undefined' && localStorage.getItem('mt_card_theme')) || document.documentElement.dataset.cardTheme || 'eclipse_tarot';
      document.documentElement.dataset.cardTheme = this.cardTheme;
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
      const THEME_CATALOG = {
        eclipse_tarot: {
          label: '★ 融合·星蚀塔罗',
          titles: { C: 'C · 星尘手札', B: 'B · 青铜星图', A: 'A · 紫蚀星盘', S: 'S · 烫金日环', SSS: 'SSS · 黑日禁印' }
        },
        eclipse: {
          label: '现版·星蚀',
          titles: { C: 'C · 静谧星光', B: 'B · 蓝晶折光', A: 'A · 紫蚀星环', S: 'S · 黄金日环食', SSS: 'SSS · 黑日蚀暴' }
        },
        glass: {
          label: '1·教堂彩窗',
          titles: { C: 'C · 灰铅毛玻璃', B: 'B · 钴蓝尖拱窗', A: 'A · 紫罗兰玫瑰窗', S: 'S · 金箔圣坛窗', SSS: 'SSS · 神谕万花窗' }
        },
        tarot: {
          label: '2·炼金塔罗',
          titles: { C: 'C · 旧羊皮手札', B: 'B · 青铜星图尺', A: 'A · 秘银炼金阵', S: 'S · 烫金大阿卡纳', SSS: 'SSS · 猩红禁书印' }
        },
        gem: {
          label: '3·暗黑晶矿',
          titles: { C: 'C · 锻铁原矿', B: 'B · 寒冰海蓝晶', A: 'A · 裂隙紫水晶', S: 'S · 熔金太阳石', SSS: 'SSS · 虹彩星核镜' }
        },
        cyber: {
          label: '4·霓虹赛博',
          titles: { C: 'C · 灰终端', B: 'B · 青电矩阵', A: 'A · 紫电脉冲', S: 'S · 金频超载', SSS: 'SSS · 虹膜故障' }
        },
        ink: {
          label: '5·水墨描金',
          titles: { C: 'C · 淡墨宣纸', B: 'B · 青绿远山', A: 'A · 紫雾祥云', S: 'S · 金箔屏风', SSS: 'SSS · 朱砂流金' }
        },
        velvet: {
          label: '6·皇室织锦',
          titles: { C: 'C · 暗麻压线', B: 'B · 深蓝丝绒', A: 'A · 紫罗兰锦缎', S: 'S · 御用金丝绒', SSS: 'SSS · 绯红王袍' }
        }
      };
      const curThemeObj = THEME_CATALOG[this.cardTheme] || THEME_CATALOG.eclipse;
      const tierTitles = curThemeObj.titles;

      // Theme switcher + Seal toggles
      const sealsWrap = document.getElementById('ps-seals-bar');
      if (sealsWrap) {
        const sealDefs = [
          { key: 'redSeal',    label: '红印' },
          { key: 'glassBlade', label: '琉璃' },
          { key: 'ironPlated', label: '镀铁' },
          { key: 'greedBadge', label: '贪欲' }
        ];
        const themeBtns = Object.entries(THEME_CATALOG).map(([id, cfg]) => `
          <button type="button" class="ps-theme-btn ${this.cardTheme === id ? 'active' : ''}" data-card-theme-pick="${id}">${cfg.label}</button>
        `).join('');
        const appliedTheme = document.documentElement.dataset.cardTheme || 'eclipse_tarot';
        const isApplied = appliedTheme === this.cardTheme;
        sealsWrap.innerHTML =
          `<div class="ps-theme-strip">${themeBtns}<button type="button" class="ps-theme-apply ${isApplied ? 'applied' : ''}" id="ps-btn-apply-card-theme">${isApplied ? '已应用全局 ✓' : '应用到全局'}</button></div>` +
          `<div class="ps-seal-strip">` +
          sealDefs.map((s) => `
            <button type="button" class="ps-seal-btn ${this.seals[s.key] ? 'active' : ''}" data-seal="${s.key}">${s.label}</button>
          `).join('') +
          `<button type="button" class="ps-seal-btn ps-cycle-btn" id="ps-btn-cycle-cards">换队员 ↻</button></div>`;

        sealsWrap.querySelectorAll('[data-card-theme-pick]').forEach((btn) => {
          btn.onclick = () => {
            this.cardTheme = btn.dataset.cardThemePick;
            if (this.app && this.app.audio && this.app.audio.playPickup) this.app.audio.playPickup();
            this._renderCardsPane();
          };
        });
        const applyBtn = document.getElementById('ps-btn-apply-card-theme');
        if (applyBtn) {
          applyBtn.onclick = () => {
            document.documentElement.dataset.cardTheme = this.cardTheme;
            try { localStorage.setItem('mt_card_theme', this.cardTheme); } catch (_) {}
            if (this.app && this.app.audio && this.app.audio.playPickup) this.app.audio.playPickup();
            if (this.app && this.app.toast) this.app.toast(`已切换全局卡面风格：${curThemeObj.label}`);
            this._renderCardsPane();
          };
        }
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

      // 5 Tier Cards Showcase (tagged with data-card-theme so live CSS + Canvas update immediately!)
      const row = document.getElementById('ps-cards-row');
      if (row) row.dataset.cardTheme = this.cardTheme;
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

  // Alternate & Fused 5-Tier Card Visual Themes: 'eclipse_tarot' | 'glass' | 'tarot' | 'gem' | 'cyber' | 'ink' | 'velvet'
  function paintAltCardTheme(theme, ctx, kind, W, H, cx, cy, t, dt, pts) {
    const tickPts = (speedMult = 1) => {
      if (!pts) return;
      pts.forEach((p) => {
        p.y += p.vy * dt * speedMult;
        p.x += (p.vx + Math.sin(t * 1.8 + p.ph) * 4) * dt;
        if (p.y < -3) { p.y = H + 2; p.x = Math.random() * W; }
        if (p.x < 0) p.x += W;
        if (p.x >= W) p.x -= W;
      });
    };

    if (theme === 'eclipse_tarot') {
      // ═══ FUSED EDITION: ECLIPSE × ALCHEMICAL TAROT (星蚀塔罗融合版) ═══
      if (kind === 'C') {
        // C · 星尘手札: Aged sepia-slate parchment folio + corner brackets + faint meridian crosshairs + warm lunar mist
        const bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, '#2a221b'); bg.addColorStop(0.52, '#1b1716'); bg.addColorStop(1, '#0d0c10');
        ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
        // Subtle antique parchment vertical weave bands
        ctx.fillStyle = 'rgba(218, 194, 158, 0.035)';
        for (let x = 6; x < W - 6; x += 6) ctx.fillRect(x, 6, 2, H - 12);
        // Fine tarot inner rule + delicate corner notches
        ctx.strokeStyle = 'rgba(198, 174, 140, 0.42)';
        ctx.lineWidth = 1;
        ctx.strokeRect(4.5, 4.5, W - 9, H - 9);
        ctx.fillStyle = 'rgba(222, 198, 162, 0.55)';
        [[7, 7], [W - 9, 7], [7, H - 9], [W - 9, H - 9]].forEach(([x, y]) => ctx.fillRect(x, y, 2, 2));
        // Faint etched celestial meridian crosshair behind hero
        ctx.strokeStyle = 'rgba(206, 186, 156, 0.14)';
        ctx.beginPath();
        ctx.moveTo(cx, 12); ctx.lineTo(cx, H - 28);
        ctx.moveTo(10, cy); ctx.lineTo(W - 10, cy);
        ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.stroke();
        // Warm-silver candlelit mist behind sprite
        const mist = ctx.createRadialGradient(cx, cy, 2, cx, cy, 34);
        mist.addColorStop(0, `rgba(226, 214, 192, ${(0.24 + Math.sin(t * 1.5) * 0.04).toFixed(3)})`);
        mist.addColorStop(0.55, 'rgba(148, 136, 118, 0.10)');
        mist.addColorStop(1, 'rgba(20, 18, 22, 0)');
        ctx.fillStyle = mist; ctx.fillRect(0, 0, W, H);
        tickPts(0.75);
        if (pts) pts.forEach((p) => {
          const tw = 0.30 + 0.55 * (0.5 + 0.5 * Math.sin(t * 2.2 + p.ph));
          ctx.fillStyle = `rgba(232, 222, 204, ${tw.toFixed(2)})`;
          ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
        });
      } else if (kind === 'B') {
        // B · 青铜星图: Deep sapphire-bronze astrolabe + double tarot rule + compass ticks + meridian arcs + slanted prism beam
        const bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, '#0f2b44'); bg.addColorStop(0.52, '#0a1c30'); bg.addColorStop(1, '#050d18');
        ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
        // Slanted sapphire prism light beam
        const shift = Math.sin(t * 0.9) * 5;
        const b1 = ctx.createLinearGradient(0, 0, W, H);
        b1.addColorStop(0, 'rgba(98, 214, 255, 0)');
        b1.addColorStop(0.46, 'rgba(116, 228, 255, 0.16)');
        b1.addColorStop(0.62, 'rgba(204, 248, 255, 0.08)');
        b1.addColorStop(1, 'rgba(98, 214, 255, 0)');
        ctx.fillStyle = b1;
        ctx.beginPath();
        ctx.moveTo(W * 0.08 + shift, 0); ctx.lineTo(W * 0.42 + shift, 0);
        ctx.lineTo(W * 0.90 + shift, H); ctx.lineTo(W * 0.52 + shift, H);
        ctx.closePath(); ctx.fill();
        // Double sapphire-bronze tarot frame + corner cross ticks
        ctx.strokeStyle = 'rgba(136, 214, 238, 0.50)';
        ctx.lineWidth = 1;
        ctx.strokeRect(4.5, 4.5, W - 9, H - 9);
        ctx.strokeStyle = 'rgba(214, 188, 138, 0.28)';
        ctx.strokeRect(7.5, 7.5, W - 15, H - 15);
        // Volumetric sapphire backlight
        const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, 40);
        glow.addColorStop(0, `rgba(156, 236, 255, ${(0.42 + Math.sin(t * 2.1) * 0.07).toFixed(3)})`);
        glow.addColorStop(0.48, 'rgba(56, 168, 242, 0.22)');
        glow.addColorStop(1, 'rgba(8, 24, 52, 0)');
        ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
        // Slowly rotating bronze-sapphire astrolabe compass ring with 12 degree ticks + inner meridian diamond
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(t * 0.14);
        ctx.strokeStyle = 'rgba(156, 232, 255, 0.54)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(0, 0, 20.5, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = 'rgba(222, 196, 146, 0.38)';
        ctx.beginPath(); ctx.arc(0, 0, 16.5, 0, Math.PI * 2); ctx.stroke();
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2;
          const major = k % 3 === 0;
          ctx.strokeStyle = major ? 'rgba(232, 248, 255, 0.72)' : 'rgba(136, 214, 240, 0.42)';
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * (major ? 16 : 18), Math.sin(a) * (major ? 16 : 18));
          ctx.lineTo(Math.cos(a) * 22.5, Math.sin(a) * 22.5);
          ctx.stroke();
        }
        ctx.restore();
        tickPts(0.95);
        if (pts) pts.forEach((p, idx) => {
          const tw = 0.42 + 0.58 * (0.5 + 0.5 * Math.sin(t * 3.2 + p.ph));
          const ix = Math.round(p.x), iy = Math.round(p.y);
          ctx.fillStyle = tw > 0.8 ? `rgba(236,252,255,${tw.toFixed(2)})` : `rgba(124,218,255,${(tw * 0.92).toFixed(2)})`;
          if (idx % 4 === 0 && tw > 0.68) { ctx.fillRect(ix - 1, iy, 3, 1); ctx.fillRect(ix, iy - 1, 1, 3); }
          else ctx.fillRect(ix, iy, p.s, p.s);
        });
      } else if (kind === 'A') {
        // A · 紫蚀星盘: Royal amethyst nebula + double tarot frame + rotating alchemical hexagram + segmented rune arcs
        const bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, '#250e3c'); bg.addColorStop(0.52, '#2b104a'); bg.addColorStop(1, '#11061e');
        ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = 'rgba(222, 168, 255, 0.48)';
        ctx.lineWidth = 1;
        ctx.strokeRect(4.5, 4.5, W - 9, H - 9);
        ctx.strokeStyle = 'rgba(222, 168, 255, 0.24)';
        ctx.strokeRect(7.5, 7.5, W - 15, H - 15);
        const ag = ctx.createRadialGradient(cx, cy, 4, cx, cy, 42);
        ag.addColorStop(0, `rgba(242, 188, 255, ${(0.58 + Math.sin(t * 2.5) * 0.1).toFixed(3)})`);
        ag.addColorStop(0.45, 'rgba(176, 82, 248, 0.34)');
        ag.addColorStop(1, 'rgba(22, 6, 42, 0)');
        ctx.fillStyle = ag; ctx.fillRect(0, 0, W, H);
        // Rotating alchemical hexagram + outer segmented eclipse rune arcs
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(t * 0.22);
        ctx.strokeStyle = 'rgba(232, 184, 255, 0.48)';
        const drawTri = (ph) => {
          ctx.beginPath();
          for (let i = 0; i <= 3; i++) {
            const a = (i / 3) * Math.PI * 2 + ph;
            const px = Math.cos(a) * 18.5, py = Math.sin(a) * 18.5;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.stroke();
        };
        drawTri(-Math.PI / 2); drawTri(Math.PI / 2);
        ctx.restore();
        ctx.strokeStyle = 'rgba(244, 204, 255, 0.72)';
        ctx.lineWidth = 1.3;
        for (let k = 0; k < 4; k++) {
          const st = (k * Math.PI) / 2 - t * 0.38;
          ctx.beginPath(); ctx.arc(cx, cy, 22.5, st, st + 0.92); ctx.stroke();
        }
        tickPts(1.0);
        if (pts) pts.forEach((p) => {
          const tw = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 4.2 + p.ph));
          ctx.fillStyle = tw > 0.78 ? `rgba(252,238,255,${tw.toFixed(2)})` : `rgba(214,140,255,${(tw * 0.92).toFixed(2)})`;
          ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
        });
      } else if (kind === 'S') {
        // S · 烫金日环: Major Arcana gilded velvet + double gold tarot frame + 4 corner gold stars + golden annular eclipse & sunburst rays!
        const bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, '#362308'); bg.addColorStop(0.48, '#201305'); bg.addColorStop(1, '#0d0702');
        ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
        // Rotating volumetric golden god-rays
        ctx.save();
        ctx.translate(cx, cy);
        for (let i = 0; i < 10; i++) {
          const ang = (i / 10) * Math.PI * 2 + t * 0.22;
          const rayA = 0.09 + 0.05 * Math.sin(t * 2.4 + i * 1.3);
          ctx.fillStyle = `rgba(255, 224, 118, ${rayA.toFixed(3)})`;
          ctx.beginPath(); ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(ang - 0.13) * 78, Math.sin(ang - 0.13) * 78);
          ctx.lineTo(Math.cos(ang + 0.13) * 78, Math.sin(ang + 0.13) * 78);
          ctx.closePath(); ctx.fill();
        }
        ctx.restore();
        // Double gilded tarot frame + 4 corner 4-point stars
        ctx.strokeStyle = 'rgba(255, 218, 112, 0.68)';
        ctx.lineWidth = 1;
        ctx.strokeRect(4.5, 4.5, W - 9, H - 9);
        ctx.strokeStyle = 'rgba(255, 218, 112, 0.34)';
        ctx.strokeRect(7.5, 7.5, W - 15, H - 15);
        ctx.fillStyle = '#ffe89c';
        [[10, 10], [W - 10, 10], [10, H - 10], [W - 10, H - 10]].forEach(([sx, sy]) => {
          ctx.fillRect(sx - 3, sy, 7, 1); ctx.fillRect(sx, sy - 3, 1, 7);
        });
        // Radiant golden annular eclipse + subtle rotating alchemical hexagram inside
        const sg = ctx.createRadialGradient(cx, cy, 8, cx, cy, 44);
        sg.addColorStop(0, `rgba(255, 244, 182, ${(0.76 + Math.sin(t * 3.0) * 0.1).toFixed(3)})`);
        sg.addColorStop(0.45, 'rgba(255, 192, 58, 0.44)');
        sg.addColorStop(1, 'rgba(28, 14, 2, 0)');
        ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(t * 0.16);
        ctx.strokeStyle = 'rgba(255, 232, 148, 0.52)';
        const drawTriS = (ph) => {
          ctx.beginPath();
          for (let i = 0; i <= 3; i++) {
            const a = (i / 3) * Math.PI * 2 + ph;
            const px = Math.cos(a) * 20.5, py = Math.sin(a) * 20.5;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.stroke();
        };
        drawTriS(-Math.PI / 2); drawTriS(Math.PI / 2);
        ctx.restore();
        ctx.strokeStyle = '#fff5c8';
        ctx.lineWidth = 2.0;
        ctx.beginPath(); ctx.arc(cx, cy, 21.5, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = 'rgba(255, 196, 64, 0.65)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cx, cy, 25.5, 0, Math.PI * 2); ctx.stroke();
        tickPts(1.2);
        if (pts) pts.forEach((p) => {
          const tw = 0.5 + 0.5 * (0.5 + 0.5 * Math.sin(t * 4.5 + p.ph));
          ctx.fillStyle = tw > 0.78 ? `rgba(255,252,226,${tw.toFixed(2)})` : `rgba(255,212,84,${(tw * 0.94).toFixed(2)})`;
          ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
        });
      } else if (kind === 'SSS') {
        // SSS · 黑日禁印: Original sleek Black Sun Eclipse Storm + Crimson Grimoire Tarot double gold-red frame & rotating hexagram seal!
        const bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, '#12030a'); bg.addColorStop(0.50, '#260614'); bg.addColorStop(1, '#360718');
        ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
        // Double gold-crimson tarot grimoire frame + 4 corner gold stars
        ctx.strokeStyle = 'rgba(255, 208, 112, 0.76)';
        ctx.lineWidth = 1;
        ctx.strokeRect(4.5, 4.5, W - 9, H - 9);
        ctx.strokeStyle = 'rgba(255, 92, 138, 0.48)';
        ctx.strokeRect(7.5, 7.5, W - 15, H - 15);
        ctx.fillStyle = '#ffe89c';
        [[10, 10], [W - 10, 10], [10, H - 10], [W - 10, H - 10]].forEach(([sx, sy]) => {
          ctx.fillRect(sx - 3, sy, 7, 1); ctx.fillRect(sx, sy - 3, 1, 7);
        });
        // Original sleek Black Sun aura
        const aura = ctx.createRadialGradient(cx, cy, 10, cx, cy, 40);
        aura.addColorStop(0, 'rgba(255, 232, 130, 0.94)');
        aura.addColorStop(0.32, 'rgba(255, 72, 112, 0.72)');
        aura.addColorStop(0.68, 'rgba(180, 18, 62, 0.30)');
        aura.addColorStop(1, 'rgba(40, 4, 18, 0)');
        ctx.fillStyle = aura; ctx.fillRect(0, 0, W, H);
        // Rotating crimson-gold alchemical hexagram seal orbiting outside the Black Sun
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(t * 0.28);
        ctx.strokeStyle = 'rgba(255, 214, 118, 0.68)';
        ctx.lineWidth = 1;
        const drawTriX = (ph) => {
          ctx.beginPath();
          for (let i = 0; i <= 3; i++) {
            const a = (i / 3) * Math.PI * 2 + ph;
            const px = Math.cos(a) * 23, py = Math.sin(a) * 23;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.stroke();
        };
        drawTriX(-Math.PI / 2); drawTriX(Math.PI / 2);
        ctx.beginPath(); ctx.arc(0, 0, 24.5, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        // Original sleek Black Sun core & solar flares
        for (let i = 0; i < 16; i++) {
          const ang = (i / 16) * Math.PI * 2 + t * 0.55;
          const flare = 14 + Math.sin(t * 5.2 + i * 1.9) * 3.2 + (i % 2 ? 2.2 : 0);
          ctx.fillStyle = i % 2 === 0 ? '#ffd966' : '#ff4d7a';
          ctx.fillRect(Math.round(cx + Math.cos(ang) * flare) - 1, Math.round(cy + Math.sin(ang) * flare) - 1, 2, 2);
        }
        ctx.fillStyle = '#fff0b0'; ctx.beginPath(); ctx.arc(cx, cy, 13.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ff3d6e'; ctx.beginPath(); ctx.arc(cx, cy, 12.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#070208'; ctx.beginPath(); ctx.arc(cx, cy, 11.2, 0, Math.PI * 2); ctx.fill();
        // Whipping crimson-gold ember storm
        if (pts) pts.forEach((p) => {
          p.x += p.vx * dt; p.y += p.vy * dt;
          if (p.y < -4 || p.x > W + 4) {
            if (Math.random() < 0.5) { p.x = Math.random() * W * 0.7; p.y = H + 2; }
            else { p.x = -2; p.y = H * 0.35 + Math.random() * H * 0.65; }
          }
          const ix = Math.round(p.x), iy = Math.round(p.y);
          ctx.fillStyle = 'rgba(255, 58, 102, 0.65)'; ctx.fillRect(ix - 2, iy + 2, 2, 1);
          ctx.fillStyle = p.s > 1 ? '#fff4c2' : '#ff8aa8'; ctx.fillRect(ix, iy, p.s, p.s);
        });
      }
      return true;
    }

    if (theme === 'glass') {
      // ═══ THEME 1: STAINED GLASS CATHEDRAL (教堂彩窗风) ═══
      const pals = {
        C:   { top: '#1a1e2b', mid: '#121520', bot: '#090b12', panes: ['rgba(120,136,168,0.14)', 'rgba(92,106,136,0.10)'], lead: 'rgba(18,22,34,0.85)', glow: '168,186,216' },
        B:   { top: '#0c294a', mid: '#0b1e3b', bot: '#050e1f', panes: ['rgba(68,196,255,0.22)', 'rgba(42,146,218,0.16)', 'rgba(124,234,255,0.14)'], lead: 'rgba(8,18,34,0.88)', glow: '96,216,255' },
        A:   { top: '#2c0e4a', mid: '#1f0a38', bot: '#0d041a', panes: ['rgba(208,108,255,0.28)', 'rgba(142,52,224,0.22)', 'rgba(255,112,188,0.18)'], lead: 'rgba(16,6,28,0.9)', glow: '216,132,255' },
        S:   { top: '#4a2e08', mid: '#2c1904', bot: '#120902', panes: ['rgba(255,216,88,0.34)', 'rgba(235,148,36,0.26)', 'rgba(255,244,168,0.22)'], lead: 'rgba(28,16,4,0.88)', glow: '255,218,96' },
        SSS: { top: '#4a0c26', mid: '#24082c', bot: '#0d0414', panes: ['rgba(255,76,132,0.36)', 'rgba(255,214,88,0.30)', 'rgba(88,226,255,0.24)'], lead: 'rgba(18,4,14,0.9)', glow: '255,112,158' }
      };
      const pal = pals[kind] || pals.C;
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, pal.top); bg.addColorStop(0.55, pal.mid); bg.addColorStop(1, pal.bot);
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

      // Diamond leaded glass lattice across card
      const cell = kind === 'C' ? 16 : 13;
      for (let gy = -cell; gy < H + cell; gy += cell) {
        for (let gx = -cell; gx < W + cell; gx += cell) {
          const idx = Math.abs(Math.floor(gx / cell) * 7 + Math.floor(gy / cell) * 13);
          const shimmer = 0.72 + 0.28 * Math.sin(t * 2.2 + idx * 0.9);
          ctx.fillStyle = pal.panes[idx % pal.panes.length];
          ctx.globalAlpha = shimmer;
          ctx.beginPath();
          ctx.moveTo(gx, gy - cell * 0.5);
          ctx.lineTo(gx + cell * 0.5, gy);
          ctx.lineTo(gx, gy + cell * 0.5);
          ctx.lineTo(gx - cell * 0.5, gy);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.strokeStyle = pal.lead;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // B+: Gothic pointed arch lead framing
      if (kind !== 'C') {
        ctx.strokeStyle = kind === 'S' ? 'rgba(255,224,124,0.58)' : kind === 'SSS' ? 'rgba(255,186,118,0.68)' : `rgba(${pal.glow},0.46)`;
        ctx.lineWidth = kind === 'S' || kind === 'SSS' ? 1.6 : 1.1;
        ctx.beginPath();
        ctx.moveTo(6, H - 10); ctx.lineTo(6, 26); ctx.quadraticCurveTo(6, 6, cx, 4);
        ctx.quadraticCurveTo(W - 6, 6, W - 6, 26); ctx.lineTo(W - 6, H - 10);
        ctx.stroke();
      }

      // A / S / SSS: Cathedral Rose Window geometry behind hero!
      if (kind === 'A' || kind === 'S' || kind === 'SSS') {
        const petals = kind === 'SSS' ? 12 : kind === 'S' ? 10 : 8;
        const rOut = kind === 'SSS' ? 26 : kind === 'S' ? 24 : 21;
        const rot = kind === 'SSS' ? t * 0.28 : kind === 'S' ? t * 0.14 : 0;
        const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, rOut + 16);
        glow.addColorStop(0, `rgba(${pal.glow}, ${kind === 'SSS' ? 0.65 : kind === 'S' ? 0.56 : 0.42})`);
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rot);
        for (let i = 0; i < petals; i++) {
          const a0 = (i / petals) * Math.PI * 2;
          const a1 = ((i + 1) / petals) * Math.PI * 2;
          ctx.fillStyle = pal.panes[i % pal.panes.length];
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, rOut, a0, a1); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = pal.lead; ctx.lineWidth = 1.1; ctx.stroke();
        }
        ctx.strokeStyle = `rgba(${pal.glow}, 0.85)`;
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(0, 0, rOut, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, rOut * 0.52, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }

      // S / SSS: Diagonal sunlit cathedral shafts piercing through glass
      if (kind === 'S' || kind === 'SSS') {
        const shift = Math.sin(t * 1.1) * 6;
        const beam = ctx.createLinearGradient(0, 0, W, H);
        beam.addColorStop(0, 'rgba(255,244,188,0)');
        beam.addColorStop(0.45, kind === 'SSS' ? 'rgba(255,224,148,0.22)' : 'rgba(255,232,142,0.20)');
        beam.addColorStop(1, 'rgba(255,244,188,0)');
        ctx.fillStyle = beam;
        ctx.beginPath();
        ctx.moveTo(W * 0.1 + shift, 0); ctx.lineTo(W * 0.46 + shift, 0);
        ctx.lineTo(W * 0.92 + shift, H); ctx.lineTo(W * 0.56 + shift, H);
        ctx.closePath(); ctx.fill();
      }

      tickPts(kind === 'SSS' ? 1.3 : 0.9);
      if (pts) {
        pts.forEach((p, i) => {
          const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 3.5 + p.ph));
          ctx.fillStyle = kind === 'SSS' && i % 3 === 0 ? `rgba(138,238,255,${tw.toFixed(2)})` : `rgba(${pal.glow},${tw.toFixed(2)})`;
          ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
        });
      }
      return true;
    }

    if (theme === 'tarot') {
      // ═══ THEME 2: ALCHEMICAL TAROT & PARCHMENT (炼金塔罗风 — echoes Sdorica portraits!) ═══
      const pals = {
        C:   { top: '#241d17', mid: '#1a1410', bot: '#100c09', line: 'rgba(182,158,126,0.34)', acc: '#c9b496', glow: '188,164,128' },
        B:   { top: '#17232c', mid: '#101920', bot: '#090e13', line: 'rgba(126,196,214,0.44)', acc: '#9ee4f5', glow: '116,204,228' },
        A:   { top: '#261830', mid: '#1b1024', bot: '#0e0814', line: 'rgba(216,162,248,0.52)', acc: '#e8c4ff', glow: '210,148,255' },
        S:   { top: '#2b2010', mid: '#1a1308', bot: '#0d0904', line: 'rgba(255,214,108,0.68)', acc: '#ffe699', glow: '255,214,108' },
        SSS: { top: '#3a0d1a', mid: '#240710', bot: '#100308', line: 'rgba(255,198,108,0.78)', acc: '#ffe499', glow: '255,108,136' }
      };
      const pal = pals[kind] || pals.C;
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, pal.top); bg.addColorStop(0.55, pal.mid); bg.addColorStop(1, pal.bot);
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

      // Subtle parchment / velvet vignette + double-ruled Tarot inner border
      ctx.strokeStyle = pal.line;
      ctx.lineWidth = 1;
      ctx.strokeRect(4.5, 4.5, W - 9, H - 9);
      if (kind !== 'C') {
        ctx.strokeRect(7.5, 7.5, W - 15, H - 15);
      }

      // Warm central tarot radiance
      const rad = ctx.createRadialGradient(cx, cy, 4, cx, cy, kind === 'C' ? 28 : 42);
      rad.addColorStop(0, `rgba(${pal.glow}, ${kind === 'C' ? 0.16 : kind === 'B' ? 0.28 : kind === 'A' ? 0.40 : 0.56})`);
      rad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rad; ctx.fillRect(0, 0, W, H);

      // B+: Celestial astrolabe meridian arcs & degree ticks
      if (kind !== 'C') {
        ctx.save();
        ctx.translate(cx, cy);
        const r1 = kind === 'SSS' ? 25 : kind === 'S' ? 23 : kind === 'A' ? 21 : 17;
        ctx.strokeStyle = pal.line;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(0, 0, r1, 0, Math.PI * 2); ctx.stroke();

        // A / S / SSS: Rotating Alchemical Hexagram / Astrolabe Geometry!
        if (kind === 'A' || kind === 'S' || kind === 'SSS') {
          ctx.rotate(t * (kind === 'SSS' ? 0.34 : 0.18));
          const drawPoly = (sides, r, phase) => {
            ctx.beginPath();
            for (let i = 0; i <= sides; i++) {
              const a = (i / sides) * Math.PI * 2 + phase;
              const px = Math.cos(a) * r, py = Math.sin(a) * r;
              if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.stroke();
          };
          ctx.strokeStyle = kind === 'SSS' ? 'rgba(255,214,118,0.72)' : pal.line;
          drawPoly(3, r1 - 1, -Math.PI / 2);
          drawPoly(3, r1 - 1, Math.PI / 2);
          if (kind === 'S' || kind === 'SSS') {
            ctx.beginPath(); ctx.arc(0, 0, r1 + 4, 0, Math.PI * 2); ctx.stroke();
            for (let k = 0; k < 8; k++) {
              const a = (k / 8) * Math.PI * 2;
              const px = Math.round(Math.cos(a) * (r1 + 4));
              const py = Math.round(Math.sin(a) * (r1 + 4));
              ctx.fillStyle = pal.acc;
              ctx.fillRect(px - 1, py - 1, 2, 2);
            }
          }
        }
        ctx.restore();
      }

      // Corner 4-point tarot gold stars on S / SSS
      if (kind === 'S' || kind === 'SSS') {
        const corners = [[10, 10], [W - 10, 10], [10, H - 10], [W - 10, H - 10]];
        ctx.fillStyle = pal.acc;
        for (const [sx, sy] of corners) {
          ctx.fillRect(sx - 3, sy, 7, 1);
          ctx.fillRect(sx, sy - 3, 1, 7);
        }
      }

      tickPts(kind === 'SSS' ? 1.25 : 0.8);
      if (pts) {
        pts.forEach((p) => {
          const tw = 0.32 + 0.68 * (0.5 + 0.5 * Math.sin(t * 3.0 + p.ph));
          ctx.fillStyle = `rgba(${pal.glow}, ${tw.toFixed(2)})`;
          ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
        });
      }
      return true;
    }

    if (theme === 'gem') {
      // ═══ THEME 3: OBSIDIAN FORGE & GEMCRAFT (暗黑晶矿风 — zero circles, pure faceted crystal & molten veins!) ═══
      const pals = {
        C:   { top: '#1d2026', mid: '#13151a', bot: '#090a0e', facet: 'rgba(148,162,186,0.10)', vein: 'rgba(156,170,196,0.22)', glow: '164,178,202' },
        B:   { top: '#0c2336', mid: '#081726', bot: '#040a14', facet: 'rgba(92,212,255,0.16)',  vein: 'rgba(128,232,255,0.45)', glow: '102,222,255' },
        A:   { top: '#241036', mid: '#170924', bot: '#0a0412', facet: 'rgba(202,114,255,0.18)', vein: 'rgba(224,148,255,0.58)', glow: '208,124,255' },
        S:   { top: '#291708', mid: '#170c04', bot: '#0a0502', facet: 'rgba(255,186,58,0.18)',  vein: 'rgba(255,214,88,0.82)',  glow: '255,198,64' },
        SSS: { top: '#1a0a24', mid: '#14081e', bot: '#09040e', facet: 'rgba(255,96,158,0.18)',  vein: 'rgba(136,242,255,0.78)', glow: '255,118,176' }
      };
      const pal = pals[kind] || pals.C;
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, pal.top); bg.addColorStop(0.55, pal.mid); bg.addColorStop(1, pal.bot);
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

      // Angular crystal facet planes (geometric polygonal sheen, no round rings!)
      const sweep = Math.sin(t * (kind === 'SSS' ? 2.4 : 1.3));
      const facets = [
        [[0, 0], [W * 0.62, 0], [W * 0.28, H * 0.48], [0, H * 0.34]],
        [[W, 0], [W * 0.56, 0], [W * 0.78, H * 0.52], [W, H * 0.38]],
        [[0, H], [W * 0.38, H * 0.58], [W * 0.72, H], [0, H]]
      ];
      facets.forEach((poly, i) => {
        ctx.fillStyle = kind === 'SSS'
          ? (i === 0 ? 'rgba(255,86,148,0.22)' : i === 1 ? 'rgba(92,232,255,0.20)' : 'rgba(255,218,96,0.20)')
          : pal.facet;
        ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t * 2.0 + i * 2.1);
        ctx.beginPath();
        poly.forEach(([px, py], idx) => idx === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py));
        ctx.closePath();
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // Central crystalline glow
      const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, 38);
      glow.addColorStop(0, `rgba(${pal.glow}, ${kind === 'C' ? 0.14 : kind === 'B' ? 0.34 : kind === 'A' ? 0.42 : 0.60})`);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

      // A / S / SSS: Glowing crystalline fracture veins / molten gold fissures!
      if (kind === 'A' || kind === 'S' || kind === 'SSS') {
        const pulse = 0.68 + 0.32 * Math.sin(t * 3.4);
        ctx.save();
        ctx.strokeStyle = pal.vein;
        ctx.globalAlpha = pulse;
        ctx.lineWidth = kind === 'S' || kind === 'SSS' ? 1.5 : 1.1;
        const cracks = [
          [[2, 18], [16, 26], [24, 38], [cx - 8, cy]],
          [[W - 2, 22], [W - 14, 32], [W - 22, 44], [cx + 8, cy + 2]],
          [[10, H - 14], [22, H - 28], [cx - 4, cy + 12]],
          [[W - 8, H - 18], [W - 20, H - 30], [cx + 6, cy + 10]]
        ];
        cracks.forEach((ptsArr) => {
          ctx.beginPath();
          ptsArr.forEach(([x, y], idx) => idx === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
          ctx.stroke();
        });
        ctx.restore();
      }

      // SSS: Diagonal iridescent prism wave sweeping across obsidian facets
      if (kind === 'SSS') {
        const px = ((t * 34) % (W + 40)) - 20;
        const prism = ctx.createLinearGradient(px - 18, 0, px + 18, H * 0.6);
        prism.addColorStop(0, 'rgba(255,76,142,0)');
        prism.addColorStop(0.35, 'rgba(255,86,154,0.28)');
        prism.addColorStop(0.50, 'rgba(255,238,148,0.34)');
        prism.addColorStop(0.65, 'rgba(102,238,255,0.28)');
        prism.addColorStop(1, 'rgba(102,238,255,0)');
        ctx.fillStyle = prism;
        ctx.fillRect(0, 0, W, H);
      }

      tickPts(kind === 'S' || kind === 'SSS' ? 1.35 : 0.9);
      if (pts) {
        pts.forEach((p, i) => {
          const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 4.2 + p.ph + sweep));
          ctx.fillStyle = kind === 'SSS'
            ? (i % 3 === 0 ? `rgba(255,236,142,${tw.toFixed(2)})` : i % 3 === 1 ? `rgba(255,96,158,${tw.toFixed(2)})` : `rgba(118,242,255,${tw.toFixed(2)})`)
            : `rgba(${pal.glow},${tw.toFixed(2)})`;
          ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
        });
      }
      return true;
    }

    if (theme === 'cyber') {
      // ═══ THEME 4: NEON CYBER HOLOGRAM (霓虹赛博风) ═══
      const pals = {
        C:   { top: '#11161f', bot: '#070a0f', main: '142,164,196', hi: '#b8cde8' },
        B:   { top: '#062030', bot: '#030c14', main: '56,226,255',  hi: '#9ef6ff' },
        A:   { top: '#1e0836', bot: '#090314', main: '216,86,255',  hi: '#f2b8ff' },
        S:   { top: '#2b1c04', bot: '#0c0702', main: '255,204,56',  hi: '#fff09c' },
        SSS: { top: '#22061c', bot: '#06030c', main: '255,64,148',  hi: '#7cf6ff' }
      };
      const pal = pals[kind] || pals.C;
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, pal.top); bg.addColorStop(1, pal.bot);
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

      // CRT horizontal scanlines
      ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
      for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);

      // B+: Retro-wave perspective grid floor at lower half
      if (kind !== 'C') {
        ctx.strokeStyle = `rgba(${pal.main}, ${kind === 'B' ? 0.20 : 0.30})`;
        ctx.lineWidth = 1;
        const horizon = Math.round(H * 0.56);
        for (let i = -4; i <= 4; i++) {
          ctx.beginPath(); ctx.moveTo(cx + i * 7, horizon); ctx.lineTo(cx + i * 22, H); ctx.stroke();
        }
        const scroll = (t * 14) % 8;
        for (let y = horizon; y < H; y += 8) {
          const yy = Math.min(H, y + scroll);
          ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke();
        }
      }

      // Sweeping horizontal laser scanner bar
      const scanY = ((t * (kind === 'SSS' ? 42 : 24)) % (H + 12)) - 6;
      const sg = ctx.createLinearGradient(0, scanY - 8, 0, scanY + 8);
      sg.addColorStop(0, `rgba(${pal.main}, 0)`);
      sg.addColorStop(0.5, `rgba(${pal.main}, ${kind === 'C' ? 0.14 : 0.34})`);
      sg.addColorStop(1, `rgba(${pal.main}, 0)`);
      ctx.fillStyle = sg; ctx.fillRect(0, scanY - 8, W, 16);

      // A / S / SSS: HUD corner targeting brackets + frequency waveform bars
      if (kind === 'A' || kind === 'S' || kind === 'SSS') {
        ctx.strokeStyle = `rgba(${pal.main}, 0.72)`;
        ctx.lineWidth = 1.2;
        const b = 8;
        [[4, 4, 1, 1], [W - 4, 4, -1, 1], [4, H - 4, 1, -1], [W - 4, H - 4, -1, -1]].forEach(([x, y, dx, dy]) => {
          ctx.beginPath(); ctx.moveTo(x, y + dy * b); ctx.lineTo(x, y); ctx.lineTo(x + dx * b, y); ctx.stroke();
        });
        // Equalizer / pulse bars behind hero
        const bars = 11;
        for (let i = 0; i < bars; i++) {
          const bh = 6 + Math.round((0.5 + 0.5 * Math.sin(t * 6.5 + i * 0.9)) * (kind === 'SSS' ? 18 : 13));
          const bx = Math.round(cx - (bars * 4) / 2 + i * 4);
          ctx.fillStyle = kind === 'SSS' && i % 3 === 0 ? 'rgba(98,242,255,0.42)' : `rgba(${pal.main}, 0.32)`;
          ctx.fillRect(bx, cy + 12 - bh, 2, bh);
        }
      }

      // SSS: Chromatic RGB glitch slices
      if (kind === 'SSS') {
        const gY = Math.round(((Math.sin(t * 7.3) * 0.5 + 0.5) * H));
        ctx.fillStyle = 'rgba(82, 246, 255, 0.28)'; ctx.fillRect(0, gY, W, 2);
        ctx.fillStyle = 'rgba(255, 64, 148, 0.32)'; ctx.fillRect(4, gY + 2, W - 4, 2);
      }

      // Falling/rising matrix data bits
      tickPts(kind === 'SSS' ? 1.6 : 1.1);
      if (pts) {
        pts.forEach((p, i) => {
          ctx.fillStyle = kind === 'SSS' && i % 2 === 0 ? '#7cf6ff' : pal.hi;
          ctx.globalAlpha = 0.55;
          ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, p.s + 2);
        });
        ctx.globalAlpha = 1;
      }
      return true;
    }

    if (theme === 'ink') {
      // ═══ THEME 5: ORIENTAL INK WASH & GOLD LEAF (水墨描金风) ═══
      const pals = {
        C:   { top: '#24262b', mid: '#17191e', bot: '#0c0d11', ink: 'rgba(182,190,204,0.16)', gold: '204,210,222' },
        B:   { top: '#10282e', mid: '#0b1c22', bot: '#060f14', ink: 'rgba(96,204,196,0.22)',  gold: '132,232,220' },
        A:   { top: '#251530', mid: '#170d22', bot: '#0b0612', ink: 'rgba(202,138,242,0.24)', gold: '226,184,255' },
        S:   { top: '#261d10', mid: '#161108', bot: '#0a0704', ink: 'rgba(248,202,92,0.26)',  gold: '255,218,108' },
        SSS: { top: '#360c14', mid: '#1c060b', bot: '#0a0305', ink: 'rgba(255,86,96,0.32)',   gold: '255,210,96' }
      };
      const pal = pals[kind] || pals.C;
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, pal.top); bg.addColorStop(0.55, pal.mid); bg.addColorStop(1, pal.bot);
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

      // Soft ink-wash mountain / cloud silhouettes
      const drawInkWave = (baseY, amp, freq, spd, fill) => {
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.moveTo(0, H);
        for (let x = 0; x <= W; x += 4) {
          const y = baseY + Math.sin(x * freq + t * spd) * amp + Math.cos(x * freq * 1.7 - t * spd * 0.6) * (amp * 0.5);
          ctx.lineTo(x, y);
        }
        ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
      };
      drawInkWave(H * 0.56, 5, 0.08, 0.3, pal.ink);
      if (kind !== 'C') drawInkWave(H * 0.44, 6, 0.06, -0.4, pal.ink);

      // Warm ink-wash moon / gilded sun disc behind hero (soft painterly, zero harsh vector ring)
      const discR = kind === 'SSS' ? 24 : kind === 'S' ? 22 : kind === 'A' ? 18 : 15;
      const dg = ctx.createRadialGradient(cx, cy - 2, 2, cx, cy - 2, discR + 12);
      dg.addColorStop(0, `rgba(${pal.gold}, ${kind === 'C' ? 0.16 : kind === 'B' ? 0.28 : kind === 'A' ? 0.36 : 0.62})`);
      dg.addColorStop(0.6, `rgba(${pal.gold}, ${kind === 'S' || kind === 'SSS' ? 0.22 : 0.10})`);
      dg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = dg; ctx.fillRect(0, 0, W, H);

      // S / SSS: Floating gilded gold-leaf flakes (碎金箔) + crimson cinnabar brush arc on SSS
      if (kind === 'SSS') {
        ctx.strokeStyle = 'rgba(255, 78, 92, 0.65)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, 22, -Math.PI * 0.75 + Math.sin(t) * 0.2, Math.PI * 0.45 + Math.sin(t) * 0.2);
        ctx.stroke();
      }
      tickPts(kind === 'SSS' ? 1.1 : 0.7);
      if (pts) {
        pts.forEach((p, i) => {
          const tw = 0.38 + 0.62 * (0.5 + 0.5 * Math.sin(t * 2.8 + p.ph));
          const isLeaf = (kind === 'S' || kind === 'SSS') && i % 2 === 0;
          ctx.fillStyle = isLeaf ? `rgba(255, 224, 118, ${tw.toFixed(2)})` : `rgba(${pal.gold}, ${(tw * 0.8).toFixed(2)})`;
          ctx.fillRect(Math.round(p.x), Math.round(p.y), isLeaf ? 3 : p.s, isLeaf ? 2 : p.s);
        });
      }
      return true;
    }

    if (theme === 'velvet') {
      // ═══ THEME 6: ROYAL VELVET & GOLD DAMASK (皇室丝绒织锦风) ═══
      const pals = {
        C:   { top: '#1e1f26', mid: '#14151a', bot: '#0a0b0e', stitch: 'rgba(164,172,192,0.14)', thread: '188,196,214' },
        B:   { top: '#0e2242', mid: '#09162e', bot: '#040b18', stitch: 'rgba(138,214,255,0.18)', thread: '152,226,255' },
        A:   { top: '#2b1142', mid: '#1b092b', bot: '#0d0416', stitch: 'rgba(224,158,255,0.22)', thread: '234,186,255' },
        S:   { top: '#332208', mid: '#1f1404', bot: '#0e0902', stitch: 'rgba(255,218,108,0.26)', thread: '255,226,124' },
        SSS: { top: '#420a1c', mid: '#260510', bot: '#100207', stitch: 'rgba(255,214,116,0.32)', thread: '255,222,128' }
      };
      const pal = pals[kind] || pals.C;
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, pal.top); bg.addColorStop(0.55, pal.mid); bg.addColorStop(1, pal.bot);
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

      // Quilted diamond damask embroidery across velvet background
      const step = kind === 'C' ? 14 : 11;
      ctx.strokeStyle = pal.stitch;
      ctx.lineWidth = 1;
      for (let x = -H; x < W + H; x += step) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + H, H); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + H, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      // Gold/silver tufted pinpoints at diamond intersections for B+
      if (kind !== 'C') {
        ctx.fillStyle = `rgba(${pal.thread}, ${kind === 'B' ? 0.34 : kind === 'A' ? 0.44 : 0.62})`;
        for (let y = step / 2; y < H; y += step) {
          for (let x = step / 2; x < W; x += step) {
            ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
          }
        }
      }

      // Silk sheen wave undulating softly across the velvet
      const silkX = cx + Math.sin(t * 1.1) * (W * 0.25);
      const sg = ctx.createRadialGradient(silkX, cy, 4, silkX, cy, 44);
      sg.addColorStop(0, `rgba(${pal.thread}, ${kind === 'C' ? 0.12 : kind === 'B' ? 0.22 : kind === 'A' ? 0.30 : 0.44})`);
      sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);

      // S / SSS: Ornate stitched inner filigree frame
      if (kind === 'S' || kind === 'SSS') {
        ctx.strokeStyle = `rgba(${pal.thread}, 0.72)`;
        ctx.setLineDash([3, 2]);
        ctx.strokeRect(5.5, 5.5, W - 11, H - 11);
        ctx.setLineDash([]);
      }

      tickPts(0.75);
      if (pts) {
        pts.forEach((p) => {
          const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 3.0 + p.ph));
          ctx.fillStyle = `rgba(${pal.thread}, ${(tw * 0.85).toFixed(2)})`;
          ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
        });
      }
      return true;
    }
    return false;
  }

  window.MT.paintAltCardTheme = paintAltCardTheme;
  window.MT.PreviewStudio = PreviewStudio;
})();
