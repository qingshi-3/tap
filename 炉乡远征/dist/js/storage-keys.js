export const SAVE_NAMESPACE = 'duelyst-h5.safe-v1';
export const SAVE_KEYS = Object.freeze({ expedition: `${SAVE_NAMESPACE}.expedition`, campaign: `${SAVE_NAMESPACE}.campaign`, match: `${SAVE_NAMESPACE}.match` });
export const LEGACY_KEYS = Object.freeze({ expedition: 'duelyst-h5.expedition.v1', campaign: 'duelyst-h5.progress.v1', match: 'duelyst-h5.match.v1' });
export const CLOUD_META_KEY = `${SAVE_NAMESPACE}.cloud-meta`;
// Same-device editing snapshots are intentionally outside profile/cloud records.
export const LOCAL_DECKS_KEY = `${SAVE_NAMESPACE}.local-decks-v1`;
export const CLOUD_ARCHIVE_NAME = 'duelyst_player_safe_v1';
export const LEGACY_ARCHIVE_NAME = 'duelyst_player_v1';
