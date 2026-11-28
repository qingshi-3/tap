// Original Hearthland Expedition pixel-art battleground themes mapped by chapter/level biome.
// Floor registration in the original painting: left and right at mid-board depth, plus the back and front ground lines.
export const BATTLE_THEMES = Object.freeze({
  'hearth-frontier': Object.freeze({
    id: 'hearth-frontier',
    framePerimeter: true,
    floorBounds: Object.freeze([242, 219, 1064, 649]),
    background: './assets/maps/pixel/hearth-frontier.webp',
    fallback: './assets/maps/pixel/hearth-frontier.webp',
    floorFillA: 'rgba(18, 20, 26, 0.13)',
    floorFillB: 'rgba(18, 20, 26, 0.22)',
    floorSeam: 'rgba(10, 12, 16, 0.42)',
    floorCorner: 'rgba(232, 224, 204, 0.24)',
    boardBorder: 'rgba(10, 12, 16, 0.62)',
    boardInnerRim: 'rgba(226, 210, 178, 0.20)',
  }),
  'sunken-causeway': Object.freeze({
    id: 'sunken-causeway',
    framePerimeter: true,
    floorBounds: Object.freeze([114, 121, 1145, 579]),
    borderArt: Object.freeze({ src: './assets/maps/pixel/causeway-bank.webp', width: 58, continuous: true }),
    background: './assets/maps/pixel/sunken-causeway.webp',
    fallback: './assets/maps/pixel/hearth-frontier.webp',
    floorFillA: 'rgba(14, 24, 22, 0.12)',
    floorFillB: 'rgba(14, 24, 22, 0.21)',
    floorSeam: 'rgba(8, 16, 15, 0.42)',
    floorCorner: 'rgba(196, 232, 218, 0.24)',
    boardBorder: 'rgba(8, 16, 15, 0.62)',
    boardInnerRim: 'rgba(184, 222, 208, 0.20)',
  }),
  'banners-highland': Object.freeze({
    id: 'banners-highland',
    framePerimeter: true,
    floorBounds: Object.freeze([108, 145, 1150, 605]),
    borderArt: Object.freeze({ src: './assets/maps/pixel/banners-standard.webp', width: 38, height: 70 }),
    background: './assets/maps/pixel/banners-highland.webp',
    fallback: './assets/maps/pixel/hearth-frontier.webp',
    floorFillA: 'rgba(26, 22, 14, 0.11)',
    floorFillB: 'rgba(26, 22, 14, 0.19)',
    floorSeam: 'rgba(18, 15, 9, 0.38)',
    floorCorner: 'rgba(242, 228, 192, 0.25)',
    boardBorder: 'rgba(18, 14, 8, 0.58)',
    boardInnerRim: 'rgba(236, 218, 174, 0.22)',
  }),
  'sands-citadel': Object.freeze({
    id: 'sands-citadel',
    floorBounds: Object.freeze([232, 204, 1049, 522]),
    background: './assets/maps/pixel/sands-citadel.webp',
    fallback: './assets/maps/pixel/sands-citadel.webp',
    floorFillA: 'rgba(34, 22, 12, 0.12)',
    floorFillB: 'rgba(34, 22, 12, 0.20)',
    floorSeam: 'rgba(28, 16, 8, 0.38)',
    floorCorner: 'rgba(255, 238, 198, 0.26)',
    boardBorder: 'rgba(26, 15, 7, 0.58)',
    boardInnerRim: 'rgba(250, 224, 174, 0.22)',
  }),
  'shadow-gorge': Object.freeze({
    id: 'shadow-gorge',
    framePerimeter: true,
    floorBounds: Object.freeze([145, 163, 1103, 590]),
    background: './assets/maps/pixel/shadow-gorge.webp',
    fallback: './assets/maps/pixel/storm-conduit.webp',
    floorFillA: 'rgba(10, 14, 22, 0.11)',
    floorFillB: 'rgba(10, 14, 22, 0.21)',
    floorSeam: 'rgba(6, 9, 16, 0.46)',
    floorCorner: 'rgba(186, 206, 232, 0.24)',
    boardBorder: 'rgba(6, 9, 15, 0.66)',
    boardInnerRim: 'rgba(176, 198, 226, 0.20)',
  }),
  'frost-bastion': Object.freeze({
    id: 'frost-bastion',
    framePerimeter: true,
    floorBounds: Object.freeze([179, 243, 1096, 603]),
    background: './assets/maps/pixel/frost-bastion.webp',
    fallback: './assets/maps/pixel/frost-bastion.webp',
    floorFillA: 'rgba(12, 20, 32, 0.14)',
    floorFillB: 'rgba(12, 20, 32, 0.23)',
    floorSeam: 'rgba(8, 14, 24, 0.44)',
    floorCorner: 'rgba(202, 232, 250, 0.26)',
    boardBorder: 'rgba(7, 13, 22, 0.64)',
    boardInnerRim: 'rgba(190, 224, 246, 0.22)',
  }),
  'magma-caldera': Object.freeze({
    id: 'magma-caldera',
    framePerimeter: true,
    borderArt: Object.freeze({ src: './assets/maps/pixel/caldera-vent.webp', width: 34, height: 75 }),
    floorBounds: Object.freeze([126, 102, 1094, 609]),
    background: './assets/maps/pixel/magma-caldera.webp',
    fallback: './assets/maps/pixel/storm-conduit.webp',
    floorFillA: 'rgba(22, 12, 10, 0.12)',
    floorFillB: 'rgba(22, 12, 10, 0.22)',
    floorSeam: 'rgba(14, 7, 6, 0.46)',
    floorCorner: 'rgba(255, 188, 128, 0.26)',
    boardBorder: 'rgba(14, 7, 6, 0.68)',
    boardInnerRim: 'rgba(246, 168, 108, 0.22)',
  }),
  'crossroads-ford': Object.freeze({
    id: 'crossroads-ford',
    framePerimeter: true,
    floorBounds: Object.freeze([160, 152, 1114, 581]),
    background: './assets/maps/pixel/crossroads-ford.webp',
    fallback: './assets/maps/pixel/hearth-frontier.webp',
    floorFillA: 'rgba(24, 20, 14, 0.12)',
    floorFillB: 'rgba(24, 20, 14, 0.20)',
    floorSeam: 'rgba(16, 13, 9, 0.40)',
    floorCorner: 'rgba(244, 224, 188, 0.25)',
    boardBorder: 'rgba(16, 12, 8, 0.60)',
    boardInnerRim: 'rgba(234, 210, 168, 0.20)',
  }),
  'citadel-courtyard': Object.freeze({
    id: 'citadel-courtyard',
    framePerimeter: true,
    floorBounds: Object.freeze([158, 126, 1115, 651]),
    background: './assets/maps/pixel/citadel-courtyard.webp',
    fallback: './assets/maps/pixel/hearth-frontier.webp',
    floorFillA: 'rgba(16, 18, 24, 0.12)',
    floorFillB: 'rgba(16, 18, 24, 0.21)',
    floorSeam: 'rgba(10, 12, 18, 0.42)',
    floorCorner: 'rgba(228, 224, 214, 0.25)',
    boardBorder: 'rgba(10, 12, 18, 0.62)',
    boardInnerRim: 'rgba(220, 214, 198, 0.22)',
  }),
  'ruins-sanctum': Object.freeze({
    id: 'ruins-sanctum',
    framePerimeter: true,
    borderArt: Object.freeze({ src: './assets/maps/pixel/ruins-pillar.webp', width: 36, height: 63, depth: 0.65 }),
    floorBounds: Object.freeze([142, 138, 1104, 660]),
    background: './assets/maps/pixel/ruins-sanctum.webp',
    fallback: './assets/maps/pixel/starfall-abyss.webp',
    floorFillA: 'rgba(16, 14, 22, 0.12)',
    floorFillB: 'rgba(16, 14, 22, 0.22)',
    floorSeam: 'rgba(10, 8, 16, 0.44)',
    floorCorner: 'rgba(214, 204, 236, 0.25)',
    boardBorder: 'rgba(9, 7, 15, 0.65)',
    boardInnerRim: 'rgba(202, 190, 226, 0.21)',
  }),
  'hearth-forge': Object.freeze({
    id: 'hearth-forge',
    framePerimeter: true,
    floorBounds: Object.freeze([64, 199, 1206, 587]),
    borderArt: Object.freeze({ src: './assets/maps/pixel/forge-brazier.webp', width: 40, height: 56 }),
    background: './assets/maps/pixel/hearth-forge.webp',
    fallback: './assets/maps/pixel/hearth-frontier.webp',
    floorFillA: 'rgba(24, 16, 14, 0.12)',
    floorFillB: 'rgba(24, 16, 14, 0.22)',
    floorSeam: 'rgba(14, 9, 8, 0.44)',
    floorCorner: 'rgba(255, 214, 152, 0.26)',
    boardBorder: 'rgba(14, 9, 8, 0.64)',
    boardInnerRim: 'rgba(248, 198, 134, 0.22)',
  }),
  'storm-conduit': Object.freeze({
    id: 'storm-conduit',
    framePerimeter: true,
    borderArt: Object.freeze({ src: './assets/maps/pixel/storm-pylon.webp', width: 37, height: 64 }),
    floorBounds: Object.freeze([176, 201, 1110, 547]),
    background: './assets/maps/pixel/storm-conduit.webp',
    fallback: './assets/maps/pixel/storm-conduit.webp',
    floorFillA: 'rgba(8, 14, 22, 0.10)',
    floorFillB: 'rgba(8, 14, 22, 0.20)',
    floorSeam: 'rgba(6, 10, 16, 0.46)',
    floorCorner: 'rgba(156, 216, 234, 0.26)',
    boardBorder: 'rgba(5, 8, 14, 0.68)',
    boardInnerRim: 'rgba(148, 208, 228, 0.22)',
  }),
  'starfall-abyss': Object.freeze({
    id: 'starfall-abyss',
    framePerimeter: true,
    borderArt: Object.freeze({ src: './assets/maps/pixel/starfall-crystal.webp', width: 42, height: 55, depth: 0.57 }),
    floorBounds: Object.freeze([164, 112, 1064, 592]),
    background: './assets/maps/pixel/starfall-abyss.webp',
    fallback: './assets/maps/pixel/starfall-abyss.webp',
    floorFillA: 'rgba(10, 8, 20, 0.10)',
    floorFillB: 'rgba(10, 8, 20, 0.21)',
    floorSeam: 'rgba(6, 5, 14, 0.48)',
    floorCorner: 'rgba(206, 186, 244, 0.25)',
    boardBorder: 'rgba(6, 4, 14, 0.70)',
    boardInnerRim: 'rgba(196, 174, 238, 0.22)',
  }),
});

const TRIAL_THEME_MAP = Object.freeze({
  'roar-lethal': 'hearth-frontier',
  'break-the-guard': 'citadel-courtyard',
  'lightchaser-bond': 'hearth-frontier',
  'move-and-strike': 'banners-highland',
  'trade-and-retaliate': 'sands-citadel',
  'summon-next-turn': 'crossroads-ford',
  'command-before-attack': 'storm-conduit',
  'terrain-detour': 'sunken-causeway',
  'outpost-hold': 'frost-bastion',
  'three-way-crossfire': 'banners-highland',
  'lyonar-healing': 'citadel-courtyard',
  'songhai-backstab': 'shadow-gorge',
  'flight-and-airdrop': 'storm-conduit',
  'vetruvian-obelysk': 'sands-citadel',
  'abyssian-death-and-creep': 'ruins-sanctum',
  'magmar-grow-and-rebirth': 'magma-caldera',
  'vanar-wall-and-infiltrate': 'frost-bastion',
});

export function getBattleThemeId(stateOrLevelId) {
  const levelId = typeof stateOrLevelId === 'string'
    ? stateOrLevelId
    : stateOrLevelId?.levelId || '';
  if (!levelId) return 'hearth-frontier';
  if (Object.hasOwn(TRIAL_THEME_MAP, levelId)) return TRIAL_THEME_MAP[levelId];
  if (levelId === 'frost-02') return 'magma-caldera';
  if (levelId.startsWith('road-')) return 'sunken-causeway';
  if (levelId.startsWith('banners-')) return 'banners-highland';
  if (levelId.startsWith('sand-')) return 'sands-citadel';
  if (levelId.startsWith('shadow-')) return 'shadow-gorge';
  if (levelId.startsWith('frost-')) return 'frost-bastion';
  if (levelId.startsWith('crossroads-')) return 'crossroads-ford';
  if (levelId.startsWith('citadel-')) return 'citadel-courtyard';
  if (levelId.startsWith('ruins-')) return 'ruins-sanctum';
  if (levelId.startsWith('confluence-')) return 'hearth-forge';
  if (levelId.startsWith('storm-')) return 'storm-conduit';
  if (levelId.startsWith('starfall-')) return 'starfall-abyss';
  return 'hearth-frontier';
}

// Screen-specific art direction is attached to the expedition level, so
// sibling levels and trials can keep the original biome composition.
const LEVEL_ART = Object.freeze({
  'citadel-01': Object.freeze({
    ...BATTLE_THEMES['citadel-courtyard'],
    borderArt: Object.freeze({ src: './assets/maps/pixel/citadel-wall-patch.webp', sourceAligned: true }),
  }),
  'crossroads-01': Object.freeze({
    ...BATTLE_THEMES['crossroads-ford'],
    background: './assets/maps/pixel/crossroads-01-ford.webp',
    floorBounds: Object.freeze([145, 292, 1105, 552]),
  }),
  'ruins-01': Object.freeze({ ...BATTLE_THEMES['ruins-sanctum'], hideLeftBorderArt: true }),
  'banners-02': Object.freeze({ ...BATTLE_THEMES['banners-highland'], hideLeftBorderArt: true }),
  'storm-01': Object.freeze({ ...BATTLE_THEMES['storm-conduit'], hideLeftBorderArt: true }),
});

export function getBattleTheme(stateOrLevelId) {
  const levelId = typeof stateOrLevelId === 'string' ? stateOrLevelId : stateOrLevelId?.levelId;
  if (Object.hasOwn(LEVEL_ART, levelId)) return LEVEL_ART[levelId];
  return BATTLE_THEMES[getBattleThemeId(levelId)];
}
