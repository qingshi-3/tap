export const SAVE_NAMESPACE = 'duelyst-h5.safe-v2';
export const SAVE_KEYS = Object.freeze({ profile: `${SAVE_NAMESPACE}.profile` });
// Read-only import source. safe-v1 keys are never written or deleted, so an older client still works.
export const V1_KEYS = Object.freeze({ expedition: 'duelyst-h5.safe-v1.expedition', localDecks: 'duelyst-h5.safe-v1.local-decks-v1' });
export const CLOUD_META_KEY = `${SAVE_NAMESPACE}.cloud-meta`;
// Same-device editing snapshots are intentionally outside profile/cloud records.
export const LOCAL_DECKS_KEY = `${SAVE_NAMESPACE}.local-decks`;
export const CLOUD_ARCHIVE_NAME = 'duelyst_player_safe_v2';
