// Explicit trial art assignment: stable level IDs keep each lesson in its own scenery.
export const TRIAL_BACKGROUNDS = Object.freeze({
  "roar-lethal": {
    "background": "./assets/maps/trials/battlemap0_background.webp",
    "middleground": "./assets/maps/trials/battlemap0_middleground.webp",
    "foregroundLeft": "./assets/maps/trials/battlemap0_foreground_001.webp",
    "foregroundRight": "./assets/maps/trials/battlemap0_foreground_002.webp"
  },
  "break-the-guard": {
    "background": "./assets/maps/trials/battlemap3_background.webp",
    "middleground": "./assets/maps/trials/battlemap3_middleground.webp",
    "foregroundLeft": "./assets/maps/trials/battlemap3_foreground.webp",
    "foregroundRight": null
  },
  "lightchaser-bond": {
    "background": "./assets/maps/trials/battlemap1_background.webp",
    "middleground": "./assets/maps/trials/battlemap1_middleground.webp",
    "foregroundLeft": null,
    "foregroundRight": null
  },
  "move-and-strike": {
    "background": "./assets/maps/trials/battlemap2_background.webp",
    "middleground": "./assets/maps/trials/battlemap2_middleground.webp",
    "foregroundLeft": "./assets/maps/trials/battlemap2_foreground_001.webp",
    "foregroundRight": "./assets/maps/trials/battlemap2_foreground_002.webp"
  },
  "trade-and-retaliate": {
    "background": "./assets/maps/trials/battlemap4_background.webp",
    "middleground": "./assets/maps/trials/battlemap4_middleground.webp",
    "foregroundLeft": "./assets/maps/trials/battlemap4_foreground_001.webp",
    "foregroundRight": "./assets/maps/trials/battlemap4_foreground_002.webp"
  },
  "summon-next-turn": {
    "background": "./assets/maps/trials/battlemap5_background.webp",
    "middleground": "./assets/maps/trials/battlemap5_middleground.webp",
    "foregroundLeft": "./assets/maps/trials/battlemap5_foreground_001.webp",
    "foregroundRight": "./assets/maps/trials/battlemap5_foreground_002.webp"
  },
  "command-before-attack": {
    "background": "./assets/maps/trials/battlemap7_background.webp",
    "middleground": "./assets/maps/trials/battlemap7_middleground.webp",
    "foregroundLeft": null,
    "foregroundRight": "./assets/maps/trials/battlemap7_foreground.webp"
  },
  "terrain-detour": {
    "background": "./assets/home-backgrounds/scene-obsidian-woods.webp",
    "middleground": null,
    "foregroundLeft": null,
    "foregroundRight": null
  },
  "outpost-hold": {
    "background": "./assets/home-backgrounds/scene-frostfire.webp",
    "middleground": null,
    "foregroundLeft": null,
    "foregroundRight": null
  },
  "three-way-crossfire": {
    "background": "./assets/home-backgrounds/scene-load.webp",
    "middleground": null,
    "foregroundLeft": null,
    "foregroundRight": null
  },
  "lyonar-healing": {
    "background": "./assets/home-backgrounds/scene-shimzar.webp",
    "middleground": null,
    "foregroundLeft": null,
    "foregroundRight": null
  },
  "songhai-backstab": {
    "background": "./assets/maps/trials/shimzar-background.webp",
    "middleground": "./assets/maps/trials/shimzar-midground.webp",
    "foregroundLeft": "./assets/maps/trials/shimzar-foreground.webp",
    "foregroundRight": null
  },
  "flight-and-airdrop": {
    "background": "./assets/home-backgrounds/scene-magaari-ember-highlands.webp",
    "middleground": null,
    "foregroundLeft": null,
    "foregroundRight": null
  },
  "vetruvian-obelysk": {
    "background": "./assets/home-backgrounds/scene-vetruvian.webp",
    "middleground": null,
    "foregroundLeft": null,
    "foregroundRight": null
  },
  "abyssian-death-and-creep": {
    "background": "./assets/maps/trials/abyssian-background.webp",
    "middleground": "./assets/maps/trials/abyssian-midground.webp",
    "foregroundLeft": null,
    "foregroundRight": null
  },
  "magmar-grow-and-rebirth": {
    "background": "./assets/maps/trials/redrock-background.webp",
    "middleground": "./assets/maps/trials/redrock-midground.webp",
    "foregroundLeft": "./assets/maps/trials/redrock-foreground.webp",
    "foregroundRight": null
  },
  "vanar-wall-and-infiltrate": {
    "background": "./assets/maps/trials/vanar-background.webp",
    "middleground": "./assets/maps/trials/vanar-midground.webp",
    "foregroundLeft": null,
    "foregroundRight": null
  }
});

export function getTrialBackground(id) {
  return Object.hasOwn(TRIAL_BACKGROUNDS, id) ? TRIAL_BACKGROUNDS[id] : null;
}
