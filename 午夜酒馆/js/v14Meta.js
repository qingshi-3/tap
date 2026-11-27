// v14.2 Meta Progression: Orbs + Shards (10->1), 10 Neutral Heroes, 6 Live Theme Packs (3 Free + 3 Unlockable),
// Achievements (12), Active-Run Resume Snapshot, and TapTap Cloud Save Sync.
(function () {
  window.MT = window.MT || {};

  const STORAGE_KEY = 'mt_v14_2_meta_v1';
  const LEGACY_KEY = 'mt_v14_1_meta_v1';

  const HEROES_META = [
    { id: 'hero_01', code: '01', codename: 'CRIMSON BLADE', accent: '#ffd966', accent2: '#ff5c8a', portrait: './assets/heroes/hero_01_char.png?v=243', portraitBg: './assets/heroes/hero_01_bg.jpg?v=243', portraitChar: './assets/heroes/hero_01_char.png?v=243', name: '英雄01 · 标准',     cost: 0,  unitId: 'f1_spellbladeadept', desc: '标准 8 张起手，每波 2 次换桌，无额外修正。' },
    { id: 'hero_02', code: '02', codename: 'AEGIS MAIDEN',  accent: '#6be5ff', accent2: '#3a88ff', portrait: './assets/heroes/hero_02_char.png?v=243', portraitBg: './assets/heroes/hero_02_bg.jpg?v=243', portraitChar: './assets/heroes/hero_02_char.png?v=243', name: '英雄02 · 护盾',     cost: 20, unitId: 'f1_3rdgeneral',      desc: '每波开局自带 15 蓝盾，小队血量上限 +15（变为 115）。', startShield: 15, maxHpBonus: 15 },
    { id: 'hero_03', code: '03', codename: 'PHANTOM DEAL',  accent: '#4ef0c4', accent2: '#38a6e8', portrait: './assets/heroes/hero_03_char.png?v=243', portraitBg: './assets/heroes/hero_03_bg.jpg?v=243', portraitChar: './assets/heroes/hero_03_char.png?v=243', name: '英雄03 · 换桌+1',   cost: 30, unitId: 'f2_altgeneral',      desc: '每波基础换桌次数 +1，但每波基础赏金 -1G。', extraDiscards: 1, rewardDelta: -1 },
    { id: 'hero_05', code: '04', codename: 'LONE ECLIPSE',  accent: '#ff7a52', accent2: '#ffd24c', portrait: './assets/heroes/hero_05_char.png?v=243', portraitBg: './assets/heroes/hero_05_bg.jpg?v=243', portraitChar: './assets/heroes/hero_05_char.png?v=243', name: '英雄05 · 孤狼',     cost: 35, unitId: 'f5_rancour',         desc: '场上每留 1 个空战位，全队伤害额外 ×1.25。', emptySlotExtraMult: 1.25 },
    { id: 'hero_07', code: '05', codename: 'VENOM ROSE',    accent: '#7ef28a', accent2: '#a855f0', portrait: './assets/heroes/hero_07_char.png?v=243', portraitBg: './assets/heroes/hero_07_bg.jpg?v=243', portraitChar: './assets/heroes/hero_07_char.png?v=243', name: '英雄07 · 挂毒',     cost: 45, unitId: 'f4_blacksolus',      desc: 'Boss 每波开局自带 6 层【剧毒】。', startBossPoison: 6 },
    { id: 'hero_08', code: '06', codename: 'RUNE WEAVER',   accent: '#c97dff', accent2: '#ff7aa8', portrait: './assets/heroes/hero_08_char.png?v=243', portraitBg: './assets/heroes/hero_08_bg.jpg?v=243', portraitChar: './assets/heroes/hero_08_char.png?v=243', name: '英雄08 · 铭文',     cost: 50, unitId: 'f3_grandmasternoshrak',desc: '黑市铭文匣价格 -2G，招募包 40% 概率自带随机铭文。', inscriptionDiscount: 2, bonusHeroInscripRate: 0.40 },
    { id: 'hero_09', code: '07', codename: 'VAULT KEEPER',  accent: '#ffe066', accent2: '#6be5ff', portrait: './assets/heroes/hero_09_char.png?v=243', portraitBg: './assets/heroes/hero_09_bg.jpg?v=243', portraitChar: './assets/heroes/hero_09_char.png?v=243', name: '英雄09 · 6秘宝槽',  cost: 55, unitId: 'f1_altgeneral',      desc: '秘宝栏位上限直接 +1（变为 6 槽）。', extraRelicSlots: 1 },
    { id: 'hero_10', code: '08', codename: 'ABYSS CROWN',   accent: '#ff5286', accent2: '#c97dff', portrait: './assets/heroes/hero_10_char.png?v=243', portraitBg: './assets/heroes/hero_10_bg.jpg?v=243', portraitChar: './assets/heroes/hero_10_char.png?v=243', name: '英雄10 · 开局S秘宝',cost: 60, unitId: 'f4_reaperninemoons', desc: '开局自带 1 件随机 S/SSS 秘宝，但小队血量上限降至 80。', startHighRelic: true, maxHpBonus: -20 },
    { id: 'hero_04', code: '09', codename: 'GILDED QUEEN',  accent: '#f5b841', accent2: '#fff2a6', portrait: './assets/heroes/hero_04_char.png?v=243', portraitBg: './assets/heroes/hero_04_bg.jpg?v=243', portraitChar: './assets/heroes/hero_04_char.png?v=243', name: '英雄04 · 经济',     cost: 70, unitId: 'f3_allomancer',      desc: '开局自带 12G（原 6G），黑市利息上限提升至 8G。', startGold: 12, maxInterest: 8 },
    { id: 'hero_06', code: '10', codename: 'ECHO DANCER',   accent: '#ff8c42', accent2: '#ff5286', portrait: './assets/heroes/hero_06_char.png?v=243', portraitBg: './assets/heroes/hero_06_bg.jpg?v=243', portraitChar: './assets/heroes/hero_06_char.png?v=243', name: '英雄06 · 3号复读',  cost: 80, unitId: 'f2_grandmasterzendo',desc: '每手 3 号位首次出手后，额外触发 2 号位再出手 1 次。', slot3TriggersSlot2: true }
  ];

  const THEME_PACKS_META = [
    { id: 'discard', name: '主题包 · 换桌', cost: 0,  live: true,  desc: '免费开放 · 弃牌飞刀、磨刃注能与跨阶段导流' },
    { id: 'shield',  name: '主题包 · 盾反', cost: 0,  live: true,  desc: '免费开放 · 叠盾挨打、借势电池与荆棘盾击' },
    { id: 'poison',  name: '主题包 · 剧毒', cost: 0,  live: true,  desc: '免费开放 · 叠毒翻倍、吞毒注能与回合末毒伤炼金' },
    { id: 'frost',   name: '主题包 · 极寒', cost: 40, live: true,  desc: '已实装 · 叠冰减伤、10层冻结破冰与冰甲接口' },
    { id: 'hand',    name: '主题包 · 留手', cost: 50, live: true,  desc: '已实装 · 钢牌助威、场下协同援护与满手乘区' },
    { id: 'summon',  name: '主题包 · 献祭', cost: 60, live: true,  desc: '已实装 · 吞噬继承战力、空位召灵与亡魂再动' },
    { id: 'blood',   name: '主题包 · 燃血', cost: 70, live: true,  desc: '已实装 · 自残换暴伤、残血重触发与不灭血契锁血' },
    { id: 'dice',    name: '主题包 · 赌博', cost: 80, live: true,  desc: '已实装 · 抛币掷骰翻倍、灌铅改命与筹码重触发' }
  ];

  const ASCENSIONS = [
    { lv: 0, name: '标准难度', firstClearOrbs: 0,  hpMult: 1.0,  dmgMult: 1.0,  rerollCost: 3, handDelta: 0,  discardDelta: 0,  desc: '标准 8 波平衡体验。' },
    { lv: 1, name: '进阶 1',   firstClearOrbs: 5,  hpMult: 1.20, dmgMult: 1.0,  rerollCost: 3, handDelta: 0,  discardDelta: 0,  desc: 'Boss 血量 +20%（首通赠 +5 宝珠）。' },
    { lv: 2, name: '进阶 2',   firstClearOrbs: 8,  hpMult: 1.25, dmgMult: 1.0,  rerollCost: 4, handDelta: 0,  discardDelta: 0,  desc: '血量 +25% · 商店刷新涨至 4G（首通赠 +8 宝珠）。' },
    { lv: 3, name: '进阶 3',   firstClearOrbs: 10, hpMult: 1.30, dmgMult: 1.15, rerollCost: 4, handDelta: 0,  discardDelta: 0,  desc: '血量 +30% · Boss 攻击 +15%（首通赠 +10 宝珠）。' },
    { lv: 4, name: '进阶 4',   firstClearOrbs: 12, hpMult: 1.35, dmgMult: 1.15, rerollCost: 4, handDelta: -1, discardDelta: 0,  desc: '手牌上限 6→5 张（首通赠 +12 宝珠）。' },
    { lv: 5, name: '进阶 5',   firstClearOrbs: 15, hpMult: 1.45, dmgMult: 1.20, rerollCost: 4, handDelta: -1, discardDelta: -1, desc: '基础换桌 2→1 次 · 终极挑战（首通赠 +15 宝珠）。' }
  ];

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  function defaultSave() {
    return {
      schemaVersion: 2,
      revision: 1,
      savedAt: Date.now(),
      playtimeSec: 0,
      orbs: 10,
      shards: 0,
      unlockedHeroes: ['hero_01'],
      trialedHeroes: [],
      unlockedThemes: ['discard', 'shield', 'poison'],
      themeMode: 'pick', // 'pick' | 'random' (+25% shard bonus when >=4 themes unlocked)
      selectedThemes: ['discard', 'shield', 'poison'],
      unlockedAchievements: [],
      maxAscensionUnlocked: 0,
      clearedAscensions: [],
      selectedAscension: 0,
      dailyDate: todayKey(),
      dailyCheckedIn: false,
      dailyCheckinBase: 0,
      dailyCheckinDoubled: false,
      selectedHeroId: 'hero_01',
      totalAdsWatched: 0,
      activeRun: null // Mid-run resume snapshot!
    };
  }

  class MetaManager {
    constructor() {
      this.data = this.load();
      this.checkDailyReset();
      this.sessionStartTs = Date.now();
    }

    load() {
      try {
        let raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) raw = localStorage.getItem(LEGACY_KEY);
        if (!raw) return defaultSave();
        const parsed = JSON.parse(raw);
        return { ...defaultSave(), ...parsed };
      } catch (_) {
        return defaultSave();
      }
    }

    save(skipCloud = false) {
      this.data.revision = (this.data.revision || 0) + 1;
      this.data.savedAt = Date.now();
      const elapsedSec = Math.floor((Date.now() - this.sessionStartTs) / 1000);
      if (elapsedSec > 0) {
        this.data.playtimeSec = (this.data.playtimeSec || 0) + elapsedSec;
        this.sessionStartTs = Date.now();
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      } catch (_) {}
      if (!skipCloud && window.MT.V14_TAP && window.MT.V14_TAP.bridge) {
        window.MT.V14_TAP.bridge.scheduleCloudSync({
          schemaVersion: 2,
          revision: this.data.revision,
          savedAt: this.data.savedAt,
          playtimeSec: this.data.playtimeSec,
          meta: this.data
        });
      }
    }

    syncFromCloud(onUpdated) {
      if (!window.MT.V14_TAP || !window.MT.V14_TAP.bridge) return;
      window.MT.V14_TAP.bridge.pullCloudSave(
        { revision: this.data.revision, savedAt: this.data.savedAt },
        (remote) => {
          if (remote && remote.meta && remote.revision > this.data.revision) {
            this.data = { ...defaultSave(), ...remote.meta };
            this.save(true);
            if (onUpdated) onUpdated(this.data);
          }
        }
      );
    }

    checkDailyReset() {
      const k = todayKey();
      if (this.data.dailyDate !== k) {
        this.data.dailyDate = k;
        this.data.dailyCheckedIn = false;
        this.data.dailyCheckinBase = 0;
        this.data.dailyCheckinDoubled = false;
        this.save(true);
      }
    }

    getHero(id) {
      return HEROES_META.find((h) => h.id === id) || HEROES_META[0];
    }

    isHeroUnlocked(id) {
      return this.data.unlockedHeroes.includes(id);
    }

    canTrialHero(id) {
      return !this.isHeroUnlocked(id) && !this.data.trialedHeroes.includes(id);
    }

    buyHero(id) {
      const h = this.getHero(id);
      if (!h || this.isHeroUnlocked(id)) return false;
      if (this.data.orbs < h.cost) return false;
      this.data.orbs -= h.cost;
      this.data.unlockedHeroes.push(id);
      this.data.selectedHeroId = id;
      this.save();
      if (this.data.unlockedHeroes.length >= 3) this.unlockAchievement('ach_hero_3');
      return true;
    }

    markHeroTrialed(id) {
      if (!this.data.trialedHeroes.includes(id)) {
        this.data.trialedHeroes.push(id);
      }
      this.save();
    }

    // Theme Packs Unlock & Selection (Random 3 vs Pick 3)
    isThemeUnlocked(id) {
      return this.data.unlockedThemes.includes(id);
    }

    buyThemePack(id) {
      const tp = THEME_PACKS_META.find((t) => t.id === id);
      if (!tp || !tp.live || this.isThemeUnlocked(id)) return false;
      if (this.data.orbs < tp.cost) return false;
      this.data.orbs -= tp.cost;
      this.data.unlockedThemes.push(id);
      this.save();
      this.unlockAchievement('ach_pack_unlock');
      return true;
    }

    toggleSelectTheme(id) {
      if (!this.isThemeUnlocked(id)) return false;
      this.data.themeMode = 'pick';
      const sel = this.data.selectedThemes.slice();
      const idx = sel.indexOf(id);
      if (idx >= 0) {
        if (sel.length <= 1) return false;
        sel.splice(idx, 1);
      } else {
        if (sel.length >= 3) sel.shift();
        sel.push(id);
      }
      this.data.selectedThemes = sel;
      this.save(true);
      return true;
    }

    setThemeMode(mode) {
      this.data.themeMode = mode === 'random' ? 'random' : 'pick';
      this.save(true);
    }

    resolveRunThemes() {
      const unlocked = this.data.unlockedThemes.filter((id) => {
        const tp = THEME_PACKS_META.find((t) => t.id === id);
        return tp && tp.live;
      });
      if (this.data.themeMode === 'random' && unlocked.length >= 4) {
        const shuffled = unlocked.slice().sort(() => Math.random() - 0.5);
        return { themes: shuffled.slice(0, 3), bonusMult: 1.25 };
      }
      let picked = (this.data.selectedThemes || []).filter((id) => unlocked.includes(id));
      for (const id of unlocked) {
        if (picked.length >= 3) break;
        if (!picked.includes(id)) picked.push(id);
      }
      return { themes: picked.slice(0, 3), bonusMult: 1.0 };
    }

    // Orbs & Shards (10 shards -> 1 orb)
    addOrbs(n) {
      this.data.orbs = Math.max(0, (this.data.orbs || 0) + n);
      this.save();
    }

    addShards(n) {
      if (n <= 0) return { mergedOrbs: 0, shards: this.data.shards };
      this.data.shards = (this.data.shards || 0) + n;
      const mergedOrbs = Math.floor(this.data.shards / 10);
      if (mergedOrbs > 0) {
        this.data.orbs = (this.data.orbs || 0) + mergedOrbs;
        this.data.shards = this.data.shards % 10;
      }
      this.save();
      return { mergedOrbs, shards: this.data.shards };
    }

    claimDailyCheckin() {
      this.checkDailyReset();
      if (this.data.dailyCheckedIn) return { base: 0, mergedOrbs: 0 };
      const base = 3 + Math.floor(Math.random() * 8);
      this.data.dailyCheckedIn = true;
      this.data.dailyCheckinBase = base;
      const res = this.addShards(base);
      return { base, mergedOrbs: res.mergedOrbs };
    }

    doubleDailyCheckin() {
      this.checkDailyReset();
      if (!this.data.dailyCheckedIn || this.data.dailyCheckinDoubled) return { extra: 0, mergedOrbs: 0 };
      const extra = this.data.dailyCheckinBase || 5;
      this.data.dailyCheckinDoubled = true;
      const res = this.addShards(extra);
      return { extra, mergedOrbs: res.mergedOrbs };
    }

    recordAdWatch() {
      this.data.totalAdsWatched += 1;
      this.save();
    }

    // 2 shards/wave + 4 clear bonus => W8 = 20 shards (2 orbs; 4 orbs with ad!)
    calcRunShards(kills, clearedAll, bonusMult = 1.0) {
      const base = kills * 2 + (clearedAll ? 4 : 0);
      return Math.round(base * bonusMult);
    }

    // Achievements
    unlockAchievement(achId) {
      if (this.data.unlockedAchievements.includes(achId)) return null;
      const list = (window.MT.V14_TAP && window.MT.V14_TAP.ACHIEVEMENTS) || [];
      const ach = list.find((a) => a.id === achId);
      if (!ach) return null;
      this.data.unlockedAchievements.push(achId);
      const res = this.addShards(ach.shards);
      if (window.MT.V14_TAP && window.MT.V14_TAP.bridge) {
        window.MT.V14_TAP.bridge.reportAchievement(achId);
      }
      return { ach, mergedOrbs: res.mergedOrbs };
    }

    getAscension(lv) {
      return ASCENSIONS.find((a) => a.lv === lv) || ASCENSIONS[0];
    }

    setSelectedAscension(lv) {
      if (lv < 0 || lv > (this.data.maxAscensionUnlocked || 0)) return false;
      this.data.selectedAscension = lv;
      this.save(true);
      return true;
    }

    recordAscensionClear(lv) {
      let bonusOrbs = 0;
      const asc = this.getAscension(lv);
      if (!this.data.clearedAscensions.includes(lv)) {
        this.data.clearedAscensions.push(lv);
        if (asc && asc.firstClearOrbs > 0) {
          bonusOrbs = asc.firstClearOrbs;
          this.data.orbs += bonusOrbs;
        }
      }
      if (lv >= (this.data.maxAscensionUnlocked || 0) && lv < ASCENSIONS.length - 1) {
        this.data.maxAscensionUnlocked = lv + 1;
      }
      this.save();
      return { bonusOrbs, nextUnlocked: this.data.maxAscensionUnlocked };
    }

    // Mid-run Resume Snapshot
    saveActiveRun(runSnapshot) {
      this.data.activeRun = runSnapshot;
      this.save();
    }

    clearActiveRun() {
      this.data.activeRun = null;
      this.save();
    }
  }

  window.MT.V14_META = {
    HEROES_META,
    THEME_PACKS_META,
    ASCENSIONS,
    manager: new MetaManager()
  };
})();
