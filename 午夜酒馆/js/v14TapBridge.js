// v14.2 TapTap H5 Host Capability Bridge (Ads, Cloud Save, Leaderboard, Achievements)
// Strictly follows TapTap H5 SOP:
// - Per-capability feature detection on globalThis.tap (never bare `if (tap)`).
// - Zero hardcoded private tokens or fake IDs; public business IDs injected from live MCP query.
// - Rewarded ads grant ONLY on result?.isEnded === true with valid request context.
// - Cloud Save writes local first, then throttled serial sync (<= 1/min) to tap.env.USER_DATA_PATH.
(function () {
  window.MT = window.MT || {};

  // Public business IDs populated ONLY from verified live MCP queries for appId 1091768
  const PUBLIC_CONFIG = {
    developerId: '488823',
    appId: '1091768',
    rewardedAdUnitId: '',     // Populated only when check_ads_status returns active space_id
    leaderboardId: '',        // Populated only when list_leaderboards / create_leaderboard returns public ID
    allowLocalPreviewMock: true // Only for local browser playtest; NEVER treated as real ad acceptance!
  };

  const LOCAL_BOARD_KEY = 'mt_v14_local_leaderboard_v1';
  const CLOUD_FILE_NAME = 'mt_v14_save.json';

  function detectCapabilities() {
    const t = globalThis.tap;
    return {
      hasTapHost: Boolean(t && typeof t === 'object'),
      canAds: Boolean(t && typeof t.createRewardedVideoAd === 'function'),
      canBoards: Boolean(t && typeof t.getLeaderboardManager === 'function'),
      canCloud: Boolean(t && typeof t.getCloudSaveManager === 'function' && typeof t.getFileSystemManager === 'function'),
      canShare: Boolean(t && typeof t.showShareboard === 'function'),
      canDesktop: Boolean(t && typeof t.createHomeScreenWidget === 'function'),
      canAchievements: Boolean(t && typeof t.getAchievementManager === 'function')
    };
  }

  // === 12 Built-in Achievements (with one-time Orb Shard rewards + optional Host sync) ===
  const ACHIEVEMENTS = [
    { id: 'ach_first_w1',    name: '初战告捷',   shards: 5,  desc: '首次击败第 1 波 Boss。' },
    { id: 'ach_clear_w4',    name: '半程破阵',   shards: 8,  desc: '单局击败第 4 波 Boss。' },
    { id: 'ach_clear_w8',    name: '八波制霸',   shards: 20, desc: '首次完整通关第 8 波 Boss！' },
    { id: 'ach_hit_1k',      name: '千伤初现',   shards: 5,  desc: '单手直伤达到 1,000 以上。' },
    { id: 'ach_hit_5k',      name: '五千裂空',   shards: 10, desc: '单手直伤达到 5,000 以上。' },
    { id: 'ach_hit_20k',     name: '两万绝杀',   shards: 15, desc: '单手直伤达到 20,000 以上。' },
    { id: 'ach_shield_100',  name: '不动如山',   shards: 8,  desc: '单回合小队蓝盾累计达到 100 以上。' },
    { id: 'ach_poison_kill', name: '蚀骨绝命',   shards: 8,  desc: '通过回合末【剧毒】结算击杀任意 Boss。' },
    { id: 'ach_freeze_boss', name: '绝对零度',   shards: 8,  desc: '通过【极寒】冻结或碎冰重创 Boss。' },
    { id: 'ach_sac_eat',     name: '吞噬进化',   shards: 8,  desc: '触发【献祭】吞噬队友继承永久战力。' },
    { id: 'ach_hero_3',      name: '广纳英才',   shards: 10, desc: '累计解锁 3 位开局英雄。' },
    { id: 'ach_pack_unlock', name: '卡池拓展',   shards: 10, desc: '使用宝珠解锁任意 1 个拓展主题包。' }
  ];

  class TapBridge {
    constructor() {
      this.caps = detectCapabilities();
      this.config = { ...PUBLIC_CONFIG };
      this.adBusy = false;
      this.adSeq = 0;

      // Cloud Save sync state
      this.syncStatus = this.caps.canCloud ? '待同步' : '已保存(本机)';
      this.cloudArchiveUUID = null;
      this.syncInFlight = false;
      this.pendingSyncPayload = null;
      this.lastUploadTs = 0;
      this.syncTimer = null;
      this.onSyncStatusChange = null;
    }

    setPublicIds(ids = {}) {
      if (ids.rewardedAdUnitId !== undefined) this.config.rewardedAdUnitId = ids.rewardedAdUnitId;
      if (ids.leaderboardId !== undefined) this.config.leaderboardId = ids.leaderboardId;
    }

    getStatusSummary() {
      return {
        caps: this.caps,
        adReady: Boolean(this.caps.canAds && this.config.rewardedAdUnitId),
        boardReady: Boolean(this.caps.canBoards && this.config.leaderboardId),
        cloudReady: Boolean(this.caps.canCloud),
        syncStatus: this.syncStatus
      };
    }

    // ─── 1. Rewarded Video Ad (SOP Section 6 strict callback contract) ───
    requestRewardedAd({ title, contextCheck, onGranted, onCancelled, onMockShow }) {
      if (this.adBusy) {
        if (onCancelled) onCancelled('广告请求进行中，请稍候');
        return;
      }
      const reqId = ++this.adSeq;
      let settled = false;
      const finishOnce = (granted, reason = '') => {
        if (settled) return;
        settled = true;
        this.adBusy = false;
        if (granted) {
          if (typeof contextCheck === 'function' && !contextCheck()) {
            if (onCancelled) onCancelled('上下文已失效，未发放奖励');
            return;
          }
          if (onGranted) onGranted({ reqId, mode: this.caps.canAds && this.config.rewardedAdUnitId ? 'taptap' : 'local_mock' });
        } else {
          if (onCancelled) onCancelled(reason || '未看完广告，不发放奖励');
        }
      };

      // Real TapTap Host Path
      if (this.caps.canAds && this.config.rewardedAdUnitId) {
        this.adBusy = true;
        let ad = null;
        let retried = false;
        const cleanup = () => {
          if (!ad) return;
          try { if (ad.offLoad) ad.offLoad(onLoad); } catch (_) {}
          try { if (ad.offError) ad.offError(onError); } catch (_) {}
          try { if (ad.offClose) ad.offClose(onClose); } catch (_) {}
          try { if (ad.destroy) ad.destroy(); } catch (_) {}
          ad = null;
        };
        const onLoad = () => {};
        const onError = (err) => {
          cleanup();
          finishOnce(false, `广告加载失败(${(err && err.errCode) || 'err'})`);
        };
        const onClose = (res) => {
          cleanup();
          const ended = Boolean(res && res.isEnded === true);
          finishOnce(ended, ended ? '' : '中途关闭广告，未发放奖励');
        };
        try {
          ad = globalThis.tap.createRewardedVideoAd({ adUnitId: this.config.rewardedAdUnitId });
          ad.onLoad(onLoad);
          ad.onError(onError);
          ad.onClose(onClose);
          ad.show().catch(() => {
            if (retried || !ad) {
              cleanup();
              finishOnce(false, '广告播放失败');
              return;
            }
            retried = true;
            ad.load()
              .then(() => ad && ad.show())
              .catch(() => {
                cleanup();
                finishOnce(false, '广告重试播放失败');
              });
          });
        } catch (_) {
          cleanup();
          finishOnce(false, '创建广告实例失败');
        }
        return;
      }

      // TapTap host exists but adUnitId not configured yet -> NEVER fake reward!
      if (this.caps.hasTapHost) {
        finishOnce(false, '广告位尚未在开发者后台生效');
        return;
      }

      // Local browser playtest fallback (clearly labeled as local mock, not real TapTap ad)
      if (this.config.allowLocalPreviewMock && typeof onMockShow === 'function') {
        this.adBusy = true;
        onMockShow(title, (completed) => finishOnce(Boolean(completed), completed ? '' : '已取消模拟广告'));
      } else {
        finishOnce(false, '当前非 TapTap 宿主环境，暂不支持激励视频');
      }
    }

    // ─── 2. Cloud Save (SOP Section 7: Local-first + Throttled Serial Cloud Sync) ───
    setSyncStatus(txt) {
      this.syncStatus = txt;
      if (typeof this.onSyncStatusChange === 'function') this.onSyncStatusChange(txt);
    }

    scheduleCloudSync(envelope) {
      if (!this.caps.canCloud) {
        this.setSyncStatus('已保存(本机)');
        return;
      }
      this.pendingSyncPayload = envelope;
      this.setSyncStatus('待同步');
      const elapsed = Date.now() - this.lastUploadTs;
      const delay = Math.max(200, 62000 - elapsed); // Respect <= 1 upload / minute limit
      if (this.syncTimer) clearTimeout(this.syncTimer);
      this.syncTimer = setTimeout(() => this.flushCloudSync(), this.lastUploadTs === 0 ? 400 : delay);
    }

    flushCloudSync() {
      if (!this.caps.canCloud || this.syncInFlight || !this.pendingSyncPayload) return;
      const payload = this.pendingSyncPayload;
      this.pendingSyncPayload = null;
      this.syncInFlight = true;
      this.setSyncStatus('同步中...');

      try {
        const fs = globalThis.tap.getFileSystemManager();
        const cloud = globalThis.tap.getCloudSaveManager();
        const filePath = `${globalThis.tap.env.USER_DATA_PATH}/${CLOUD_FILE_NAME}`;
        const jsonStr = JSON.stringify(payload);

        fs.writeFile({
          filePath,
          data: jsonStr,
          encoding: 'utf8',
          success: () => {
            const meta = {
              name: 'main_save',
              summary: `宝珠${(payload.meta && payload.meta.orbs) || 0}·R${payload.revision || 1}`,
              playtime: Math.max(0, Math.round(payload.playtimeSec || 0))
            };
            const onDone = (ok, res) => {
              this.syncInFlight = false;
              if (ok) {
                this.lastUploadTs = Date.now();
                if (res && res.uuid) this.cloudArchiveUUID = res.uuid;
                this.setSyncStatus(this.pendingSyncPayload ? '待同步' : '已同步云端');
              } else {
                this.pendingSyncPayload = this.pendingSyncPayload || payload;
                this.setSyncStatus('已保存(待同步)');
              }
            };
            if (this.cloudArchiveUUID && typeof cloud.updateArchive === 'function') {
              cloud.updateArchive({
                archiveUUID: this.cloudArchiveUUID,
                archiveMetaData: meta,
                archiveFilePath: filePath,
                success: (res) => onDone(true, res),
                fail: () => onDone(false)
              });
            } else {
              cloud.createArchive({
                archiveMetaData: meta,
                archiveFilePath: filePath,
                success: (res) => onDone(true, res),
                fail: () => onDone(false)
              });
            }
          },
          fail: () => {
            this.syncInFlight = false;
            this.pendingSyncPayload = this.pendingSyncPayload || payload;
            this.setSyncStatus('已保存(待同步)');
          }
        });
      } catch (_) {
        this.syncInFlight = false;
        this.setSyncStatus('已保存(待同步)');
      }
    }

    pullCloudSave(localEnvelope, onResolved) {
      if (!this.caps.canCloud) {
        if (onResolved) onResolved(null);
        return;
      }
      try {
        const cloud = globalThis.tap.getCloudSaveManager();
        const fs = globalThis.tap.getFileSystemManager();
        cloud.getArchiveList({
          success: (listRes) => {
            const items = (listRes && (listRes.archives || listRes.list || listRes.data)) || [];
            if (!items.length) { if (onResolved) onResolved(null); return; }
            const latest = items[0];
            this.cloudArchiveUUID = latest.uuid || latest.archiveUUID || null;
            if (!this.cloudArchiveUUID) { if (onResolved) onResolved(null); return; }
            cloud.getArchiveData({
              archiveUUID: this.cloudArchiveUUID,
              archiveFileId: latest.fileId || latest.archiveFileId,
              success: (dataRes) => {
                const targetPath = dataRes && (dataRes.archiveFilePath || dataRes.filePath);
                if (!targetPath) { if (onResolved) onResolved(null); return; }
                fs.readFile({
                  filePath: targetPath,
                  encoding: 'utf8',
                  success: (rf) => {
                    try {
                      const remote = JSON.parse(rf.data);
                      const localRev = (localEnvelope && localEnvelope.revision) || 0;
                      const remoteRev = (remote && remote.revision) || 0;
                      if (remote && remoteRev > localRev) {
                        this.setSyncStatus('已同步云端');
                        if (onResolved) onResolved(remote);
                      } else {
                        if (onResolved) onResolved(null);
                      }
                    } catch (_) {
                      if (onResolved) onResolved(null);
                    }
                  },
                  fail: () => { if (onResolved) onResolved(null); }
                });
              },
              fail: () => { if (onResolved) onResolved(null); }
            });
          },
          fail: () => { if (onResolved) onResolved(null); }
        });
      } catch (_) {
        if (onResolved) onResolved(null);
      }
    }

    // ─── 3. Leaderboard (SOP Section 5: Score Contract = kills*10000 + min(9999, peakHit), desc/best) ───
    calcLeaderboardScore(kills, peakHit) {
      const k = Math.max(0, Math.min(99, Math.floor(kills || 0)));
      const p = Math.max(0, Math.min(9999, Math.floor(peakHit || 0)));
      return k * 10000 + p;
    }

    getLocalBoard() {
      try {
        return JSON.parse(localStorage.getItem(LOCAL_BOARD_KEY) || '[]');
      } catch (_) {
        return [];
      }
    }

    submitRunScore({ runId, heroName, kills, peakHit, themes }) {
      const score = this.calcLeaderboardScore(kills, peakHit);
      if (score <= 0) return { score: 0, remoteSubmitted: false };

      // Save locally (dedup by runId)
      const list = this.getLocalBoard().filter((x) => x.runId !== runId);
      list.push({
        runId,
        heroName,
        kills,
        peakHit,
        score,
        themes: (themes || []).join('/'),
        date: new Date().toLocaleDateString()
      });
      list.sort((a, b) => b.score - a.score);
      try {
        localStorage.setItem(LOCAL_BOARD_KEY, JSON.stringify(list.slice(0, 10)));
      } catch (_) {}

      // Submit to TapTap Host Leaderboard if available & configured
      if (this.caps.canBoards && this.config.leaderboardId) {
        try {
          const mgr = globalThis.tap.getLeaderboardManager();
          mgr.submitScores({
            scores: [{ leaderboardId: this.config.leaderboardId, score }],
            callback: { onSuccess: () => {}, onFailure: () => {} }
          });
          return { score, remoteSubmitted: true };
        } catch (_) {}
      }
      return { score, remoteSubmitted: false };
    }

    openLeaderboard(onFallbackLocal) {
      if (this.caps.canBoards && this.config.leaderboardId) {
        try {
          const mgr = globalThis.tap.getLeaderboardManager();
          mgr.openLeaderboard({
            leaderboardId: this.config.leaderboardId,
            collection: 'public',
            callback: {
              onSuccess: () => {},
              onFailure: () => { if (onFallbackLocal) onFallbackLocal(this.getLocalBoard()); }
            }
          });
          return true;
        } catch (_) {}
      }
      if (onFallbackLocal) onFallbackLocal(this.getLocalBoard());
      return false;
    }

    // ─── 4. Achievements Host Sync Hook ───
    reportAchievement(achId) {
      if (!this.caps.canAchievements) return false;
      try {
        const mgr = globalThis.tap.getAchievementManager();
        if (mgr && typeof mgr.reach === 'function') {
          mgr.reach({ achievementId: achId });
          return true;
        }
      } catch (_) {}
      return false;
    }
  }

  window.MT.V14_TAP = {
    ACHIEVEMENTS,
    bridge: new TapBridge()
  };
})();
