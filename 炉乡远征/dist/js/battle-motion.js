// Scale only finite battle presentations. Keep authored timings in their own
// timeline so bodies, projectiles, impacts, HUD reveals and completion agree.
// Audio is scheduled on this clock; its playback rate and pitch stay original.
export const BATTLE_PLAYBACK_RATE = 1.6;
export const battleDelay = milliseconds => milliseconds / BATTLE_PLAYBACK_RATE;
export const battleElapsed = (now, startedAt) => (now - startedAt) * BATTLE_PLAYBACK_RATE;
