import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const gameRoot = path.resolve(here, '..');
const sourceRoot = 'C:/Users/qs/Desktop/游戏素材/duelyst-main (1)/duelyst-main';
const sourceData = path.join(sourceRoot, 'app/data');
const assetRoot = path.join(gameRoot, 'dist/assets');

const unitSpecs = {
  10001:[0,'SpottedDragonlark'],10013:[0,'PhaseHound'],10017:[0,'FireSpitter'],10018:[0,'KomodoCharger'],10020:[0,'EphemeralShroud'],10204:[0,'BrightmossGolem'],10207:[0,'StormmetalGolem'],10307:[0,'Serpenti'],10959:[0,'DancingBlades'],10978:[0,'HailstoneGolem'],10982:[0,'VoidHunter'],19026:[0,'RockPulverizer'],19033:[0,'PutridMindflayer'],19034:[0,'FlameWing'],19042:[0,'FrostboneNaga'],19049:[0,'Sojourner'],
  520:[6,'WolfAspect'],
  10021:[0,'ValeHunter'],19027:[0,'PrimusShieldmaster'],10981:[0,'HealingMystic'],10019:[0,'PlanarScout'],19037:[0,'PrimusFist'],10012:[0,'SaberspineTiger'],19050:[0,'AzureHornShaman'],
  1:[1,'General'],23:[1,'AltGeneral'],14:[1,'SilverguardSquire'],9:[1,'WindbladeAdept'],15:[1,'Lightchaser'],16:[1,'SuntideMaiden'],11:[1,'SilverguardKnight'],17:[1,'IroncliffeGuardian'],
  101:[2,'General'],123:[2,'AltGeneral'],110:[2,'KaidoAssassin'],115:[2,'ChakriAvatar'],109:[2,'Widowmaker'],108:[2,'Heartseeker'],111:[2,'ScarletViper'],116:[2,'MageOfFourWinds'],
  201:[3,'General'],223:[3,'AltGeneral'],213:[3,'Pyromancer'],211:[3,'Dunecaster'],214:[3,'BrazierRedSand'],217:[3,'Dervish'],225:[3,'IronDervish'],209:[3,'StarfireScarab'],215:[3,'BrazierGoldenFlame'],216:[3,'BrazierDuskWind'],
  301:[4,'General'],323:[4,'AltGeneral'],308:[4,'AbyssalCrawler'],317:[4,'GloomChaser'],311:[4,'ShadowWatcher'],315:[4,'Wraithling'],309:[4,'AbyssalJuggernaut'],310:[4,'BloodmoonPriestess'],316:[4,'DarkspineElemental'],
  401:[5,'General'],418:[5,'AltGeneral'],406:[5,'Phalanxar'],412:[5,'YoungSilithar'],410:[5,'PrimordialGazer'],411:[5,'Egg'],402:[5,'EarthWalker'],404:[5,'Kolossus'],413:[5,'VeteranSilithar'],
  501:[6,'General'],527:[6,'AltGeneral'],505:[6,'CrystalCloaker'],506:[6,'CrystalWisp'],503:[6,'FenrirWarmaster'],504:[6,'GhostWolf'],525:[6,'BonechillBarrier'],526:[6,'ArcticDisplacer'],511:[6,'WolfRaven'],513:[6,'Razorback'],
};
const spellSpecs = {
  20168:[2,'MistDragonSeal'],20129:[2,'Juxtaposition'],20073:[3,'SiphonEnergy'],20077:[3,'EntropicDecay'],20049:[4,'DaemonicLure'],20061:[4,'DarkTransformation'],20125:[5,'NaturalSelection'],20122:[5,'PlasmaStorm'],20134:[6,'ChromaticCold'],20144:[6,'AspectOfTheWolf'],
  20174:[1,'Roar'],20043:[1,'SundropElixir'],20066:[1,'TrueStrike'],20044:[1,'Tempest'],20068:[1,'DivineBond'],
  20081:[2,'PhoenixFire'],20086:[2,'InnerFocus'],20095:[3,'ScionsFirstWish'],20151:[3,'BoneSwarm'],
  20052:[4,'VoidPulse'],20072:[4,'WraithlingSwarm'],20116:[5,'GreaterFortitude'],20117:[5,'EarthSphere'],
  20139:[6,'FlashFreeze'],20149:[6,'BonechillBarrier'],
};
// Content expansion: original factory identifiers, tokens excluded from collection counts.
Object.assign(unitSpecs, {
  "8": [
    1,
    "LysianBrawler",
    "core"
  ],
  "10": [
    1,
    "SunstoneTemplar",
    "core"
  ],
  "12": [
    1,
    "ArclyteSentinel",
    "core"
  ],
  "13": [
    1,
    "WindbladeCommander",
    "core"
  ],
  "21": [
    1,
    "AzuriteLion",
    "core"
  ],
  "22": [
    1,
    "Sunriser",
    "core"
  ],
  "112": [
    2,
    "GoreHorn",
    "core"
  ],
  "113": [
    2,
    "OnyxBear"
  ],
  "114": [
    2,
    "JadeOgre",
    "core"
  ],
  "117": [
    2,
    "CelestialPhantom",
    "core"
  ],
  "119": [
    2,
    "HamonBlademaster",
    "core"
  ],
  "120": [
    2,
    "KeshraiFanblade",
    "core"
  ],
  "122": [
    2,
    "LanternFox",
    "core"
  ],
  "208": [
    3,
    "WindShrike",
    "core"
  ],
  "210": [
    3,
    "SandHowler",
    "core"
  ],
  "212": [
    3,
    "OrbWeaver",
    "core"
  ],
  "219": [
    3,
    "MirrorMaster",
    "core"
  ],
  "220": [
    3,
    "AymaraHealer",
    "core"
  ],
  "221": [
    3,
    "PortalGuardian",
    "core"
  ],
  "312": [
    4,
    "DeepfireDevourer",
    "core"
  ],
  "313": [
    4,
    "DarkSiren",
    "core"
  ],
  "314": [
    4,
    "VorpalReaver",
    "core"
  ],
  "318": [
    4,
    "SharianShadowdancer",
    "core"
  ],
  "319": [
    4,
    "NightsorrowAssassin",
    "core"
  ],
  "321": [
    4,
    "BlackSolus",
    "core"
  ],
  "403": [
    5,
    "Grimrock",
    "core"
  ],
  "405": [
    5,
    "MakantorWarbeast",
    "core"
  ],
  "407": [
    5,
    "Elucidator",
    "core"
  ],
  "414": [
    5,
    "SilitharElder",
    "core"
  ],
  "415": [
    5,
    "SpiritHarvester",
    "core"
  ],
  "417": [
    5,
    "Vindicator",
    "core"
  ],
  "507": [
    6,
    "ArcticRhyno",
    "core"
  ],
  "510": [
    6,
    "WyrBeast",
    "core"
  ],
  "512": [
    6,
    "BoreanBear",
    "core"
  ],
  "515": [
    6,
    "VoiceoftheWind",
    "core"
  ],
  "517": [
    6,
    "HearthSister",
    "core"
  ],
  "518": [
    6,
    "WaterBear"
  ],
  "519": [
    6,
    "SnowElemental",
    "core"
  ],
  "523": [
    6,
    "GravityWell"
  ],
  "10016": [
    0,
    "RepulsionBeast",
    "core"
  ],
  "10301": [
    0,
    "SunSeer",
    "core"
  ],
  "10306": [
    0,
    "Lightbender",
    "core"
  ],
  "10958": [
    0,
    "DaggerKiri",
    "core"
  ],
  "10995": [
    0,
    "EmeraldRejuvenator",
    "core"
  ],
  "19040": [
    0,
    "PiercingMantis",
    "core"
  ],
  "19052": [
    0,
    "BloodtearAlchemist",
    "core"
  ]
});
Object.assign(spellSpecs, {
  "20051": [
    4,
    "ShadowNova",
    "core"
  ],
  "20057": [
    4,
    "RitualBanishing",
    "core"
  ],
  "20064": [
    1,
    "SunBloom",
    "core"
  ],
  "20067": [
    1,
    "HolyImmolation",
    "core"
  ],
  "20074": [
    3,
    "CosmicFlesh",
    "core"
  ],
  "20082": [
    2,
    "TwinStrike",
    "core"
  ],
  "20087": [
    2,
    "OnyxBearSeal",
    "core"
  ],
  "20090": [
    1,
    "Martyrdom",
    "core"
  ],
  "20096": [
    3,
    "ScionsSecondWish",
    "core"
  ],
  "20097": [
    3,
    "ScionsThirdWish",
    "core"
  ],
  "20102": [
    2,
    "KillingEdge",
    "core"
  ],
  "20113": [
    5,
    "DiretideFrenzy",
    "core"
  ],
  "20115": [
    5,
    "DanceOfDreams",
    "core"
  ],
  "20119": [
    5,
    "Amplification",
    "core"
  ],
  "20133": [
    4,
    "DeathfireCrescendo",
    "core"
  ],
  "20136": [
    6,
    "Avalanche",
    "core"
  ],
  "20147": [
    6,
    "GravityWell",
    "core"
  ],
  "20153": [
    3,
    "InnerOasis",
    "core"
  ],
  "20154": [
    4,
    "RiteOfTheUndervault",
    "core"
  ],
  "20155": [
    2,
    "HeavensEclipse",
    "core"
  ],
  "20157": [
    5,
    "EggMorph",
    "core"
  ],
  "20163": [
    6,
    "SpiritoftheWild",
    "core"
  ],
  "20165": [
    6,
    "Cryogenesis",
    "core"
  ]
});

// Recruitment exclusives and their token-only bodies retain their original factory paths.
Object.assign(unitSpecs, {
  "18": [
    1,
    "ElyxStormblade",
    "core/faction1.coffee"
  ],
  "121": [
    2,
    "TuskBoar",
    "core/faction2.coffee"
  ],
  "130": [
    2,
    "BattlePanddo",
    "shimzar/faction2.coffee"
  ],
  "320": [
    4,
    "SpectralRevenant",
    "core/faction4.coffee"
  ],
  "408": [
    5,
    "UnstableLeviathan",
    "core/faction5.coffee"
  ],
  "508": [
    6,
    "PrismaticGiant",
    "core/faction6.coffee"
  ],
  "509": [
    6,
    "IceDrake",
    "core/faction6.coffee"
  ],
  "514": [
    6,
    "AncientGrove",
    "core/faction6.coffee"
  ],
  "516": [
    6,
    "Treant",
    "core/faction6.coffee"
  ],
  "533": [
    6,
    "IceDryad",
    "shimzar/faction6.coffee"
  ],
  "10973": [
    0,
    "LuxIgnis",
    "core/neutral.coffee"
  ],
  "10979": [
    0,
    "Maw",
    "core/neutral.coffee"
  ],
  "10984": [
    0,
    "FirstSwordofAkrane",
    "core/neutral.coffee"
  ],
  "10986": [
    0,
    "Eclipse",
    "core/neutral.coffee"
  ],
  "10994": [
    0,
    "ZenRui",
    "core/neutral.coffee"
  ],
  "11023": [
    0,
    "Bonereaper",
    "monthly/m5_provoke.coffee"
  ],
  "11026": [
    0,
    "WarTalon",
    "monthly/m5_provoke.coffee"
  ],
  "11030": [
    0,
    "SunsetParagon",
    "monthly/m6_forcefield.coffee"
  ],
  "11032": [
    0,
    "Bloodletter",
    "core/neutral.coffee"
  ],
  "19047": [
    0,
    "MirkbloodDevourer",
    "core/neutral.coffee"
  ]
});

// The source factory names a DuskWind recipe that is absent from source fx.js.
// Keep its original body/sounds and use the source's basic Obelysk summon FX.
const unitFxFallbacks = { 216: 'FX.Cards.Faction3.BrazierRedSand' };

function evaluateCommonJs(file, requireFn) {
  const code = fs.readFileSync(file, 'utf8');
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    require: requireFn,
    console,
  }, { filename: file });
  return JSON.parse(JSON.stringify(module.exports));
}

const RSX = evaluateCommonJs(path.join(sourceData, 'resources.js'), (id) => {
  if (id === 'underscore') return { isArray: Array.isArray };
  throw new Error(`Unexpected require in resources.js: ${id}`);
});
const FX = evaluateCommonJs(path.join(sourceData, 'fx.js'), (id) => {
  if (id === './resources') return RSX;
  throw new Error(`Unexpected require in fx.js: ${id}`);
});

function factoryBlock(faction, identifier, kind = 'Faction', set = 'core') {
  if (faction === 0 && kind === 'Faction') kind = 'Neutral';
  const file = set.endsWith('.coffee') ? path.join(sourceRoot, 'app/sdk/cards/factory', set)
    : path.join(sourceRoot, `app/sdk/cards/factory/${set}/${faction === 0 ? 'neutral' : 'faction' + faction}.coffee`);
  const text = fs.readFileSync(file, 'utf8');
  const marker = `if (identifier == Cards.${kind}${kind === 'Faction' ? faction + '.' : '.'}${identifier})`;
  const start = text.indexOf(marker);
  if (start < 0) throw new Error(`Missing factory block ${faction}.${identifier}`);
  const next = text.indexOf('\n    if (identifier ==', start + marker.length);
  return { file, text: text.slice(start, next < 0 ? text.length : next) };
}

function rsxName(block, field) {
  return block.match(new RegExp(`${field}\\s*:\\s*RSX\\.([A-Za-z0-9_]+)`))?.[1];
}
function rsxAnimName(block, field) {
  return [...block.matchAll(new RegExp(`${field}\\s*:\\s*RSX\\.([A-Za-z0-9_]+)`, 'g'))].at(-1)?.[1];
}
function buildUnitAudit() {
  const cards = {};
  for (const [id, [faction, identifier, set]] of Object.entries(unitSpecs)) {
    const { file, text } = factoryBlock(faction, identifier, 'Faction', set);
    const fx = text.match(/setFXResource\(\["([^"]+)"/)?.[1];
    const states = {};
    for (const field of ['breathing','idle','walk','attack','damage','death','castStart','castEnd','castLoop','cast']) {
      const name = rsxAnimName(text, field);
      if (name && RSX[name]) states[field] = [RSX[name].framePrefix, RSX[name].frameDelay * 1000];
    }
    const first = Object.keys(states).map((field) => rsxAnimName(text, field)).find(Boolean);
    const sounds = {};
    for (const field of ['apply','walk','attack','receiveDamage','attackDamage','death']) {
      const name = rsxName(text, field); if (name) sounds[field] = name;
    }
    cards[id] = {
      name: identifier,
      factoryFx: fx,
      factoryFxRegistered: Boolean(getAtPath(FX, fx || '')),
      h5FxFallback: unitFxFallbacks[id] || null,
      factoryLines: path.relative(sourceRoot, file).replaceAll('\\','/'),
      sourceStats: {
        cost: Number(text.match(/card\.manaCost\s*=\s*(\d+)/)?.[1]),
        attack: Number(text.match(/card\.atk\s*=\s*(\d+)/)?.[1]),
        health: Number(text.match(/card\.maxHP\s*=\s*(\d+)/)?.[1]),
      },
      sourceMechanics: [...new Set([...text.matchAll(/(Modifier\w+)\.createContextObject/g)].map((match) => match[1]))],
      body: { sheet: RSX[first].img, plist: RSX[first].plist, states, attackDelayMs: Number(text.match(/attackDelay:\s*([0-9.]+)/)?.[1] || 0) * 1000 },
      sounds,
    };
  }
  return { auditVersion: 2, sourceRoot, scope: { auditedH5UnitIds: Object.keys(unitSpecs).map(Number), note: 'Generated directly from core faction factories and RSX.' }, cards };
}

function buildSpellAudit() {
  const cards = {};
  for (const [id, [faction, identifier]] of Object.entries(spellSpecs)) {
    const { file, text } = factoryBlock(faction, identifier, 'Spell');
    cards[id] = { name: identifier, factory: {
      location: path.relative(sourceRoot, file).replaceAll('\\','/'),
      fxResource: [text.match(/setFXResource\(\["([^"]+)"/)?.[1]].filter(Boolean),
      sound: `RSX.${rsxName(text, 'apply')}.audio`,
    }};
  }
  return { schemaVersion: 2, auditDate: new Date().toISOString().slice(0,10), purpose: 'Generated source audit for the selected faction spells.', sourceRoot, cards };
}

fs.writeFileSync(path.join(gameRoot, '.unit-fx-audit.json'), JSON.stringify(buildUnitAudit(), null, 2) + '\n');
fs.writeFileSync(path.join(gameRoot, '.spell-fx-audit.json'), JSON.stringify(buildSpellAudit(), null, 2) + '\n');

const recipePaths = [
  'FX.Factions.Neutral', ...[1,2,3,4,5,6].map((id) => `FX.Factions.Faction${id}`),
  'FX.Cards.Faction1.General', 'FX.Cards.Faction1.ZiranSunforge',
  'FX.Cards.Faction1.SilverguardSquire', 'FX.Cards.Faction1.WindbladeAdept',
  'FX.Cards.Faction1.Lightchaser', 'FX.Cards.Faction1.SuntideMaiden',
  'FX.Cards.Faction1.SilverguardKnight', 'FX.Cards.Faction1.IroncliffeGuardian',
  'FX.Cards.Spell.Roar', 'FX.Cards.Spell.SundropElixir',
  'FX.Cards.Spell.TrueStrike', 'FX.Cards.Spell.Tempest',
  'FX.Cards.Spell.DivineBond', 'FX.Modifiers.ModifierGenericBuff',
  'FX.Modifiers.ModifierProvoke', 'FX.Modifiers.ModifierZealed',
  ...Object.values(unitSpecs).map(([faction, identifier, set]) => factoryBlock(faction, identifier, 'Faction', set).text.match(/setFXResource\(\["([^"]+)"/)?.[1]).filter(Boolean),
  ...Object.values(unitFxFallbacks),
  ...Object.values(spellSpecs).map(([faction, identifier]) => factoryBlock(faction, identifier, 'Spell').text.match(/setFXResource\(\["([^"]+)"/)?.[1]).filter(Boolean),
];

function getAtPath(root, dotted) {
  return dotted.replace(/^FX\./, '').split('.').reduce((value, key) => value?.[key], root);
}

const recipes = Object.fromEntries([...new Set(recipePaths)].map((key) => {
  const value = getAtPath(FX, key);
  if (value == null) return null;
  return [key, value];
}).filter(Boolean));

const cardRecipes = {
  1: ['FX.Factions.Neutral', 'FX.Factions.Faction1', 'FX.Cards.Faction1.General'],
  23: ['FX.Factions.Neutral', 'FX.Factions.Faction1', 'FX.Cards.Faction1.ZiranSunforge'],
  14: ['FX.Factions.Neutral', 'FX.Factions.Faction1', 'FX.Cards.Faction1.SilverguardSquire'],
  9: ['FX.Factions.Neutral', 'FX.Factions.Faction1', 'FX.Cards.Faction1.WindbladeAdept'],
  15: ['FX.Factions.Neutral', 'FX.Factions.Faction1', 'FX.Cards.Faction1.Lightchaser'],
  16: ['FX.Factions.Neutral', 'FX.Factions.Faction1', 'FX.Cards.Faction1.SuntideMaiden'],
  11: ['FX.Factions.Neutral', 'FX.Factions.Faction1', 'FX.Cards.Faction1.SilverguardKnight'],
  17: ['FX.Factions.Neutral', 'FX.Factions.Faction1', 'FX.Cards.Faction1.IroncliffeGuardian'],
};
for (const [id, [faction, identifier, set]] of Object.entries(unitSpecs)) {
  const perCard = factoryBlock(faction, identifier, 'Faction', set).text.match(/setFXResource\(\["([^"]+)"/)?.[1];
  cardRecipes[id] = ['FX.Factions.Neutral', `FX.Factions.Faction${faction}`, perCard, unitFxFallbacks[id]].filter((key) => key && getAtPath(FX, key));
}
const spellRecipes = {
  20174: ['FX.Factions.Neutral', 'FX.Factions.Faction1', 'FX.Cards.Spell.Roar'],
  20043: ['FX.Factions.Neutral', 'FX.Factions.Faction1', 'FX.Cards.Spell.SundropElixir'],
  20066: ['FX.Factions.Neutral', 'FX.Factions.Faction1', 'FX.Cards.Spell.TrueStrike'],
  20044: ['FX.Factions.Neutral', 'FX.Factions.Faction1', 'FX.Cards.Spell.Tempest'],
  20068: ['FX.Factions.Neutral', 'FX.Factions.Faction1', 'FX.Cards.Spell.DivineBond'],
};
for (const [id, [faction, identifier]] of Object.entries(spellSpecs)) {
  const perCard = factoryBlock(faction, identifier, 'Spell').text.match(/setFXResource\(\["([^"]+)"/)?.[1];
  spellRecipes[id] = ['FX.Factions.Neutral', `FX.Factions.Faction${faction}`, perCard].filter((key) => key && getAtPath(FX, key));
}

const unitAudit = JSON.parse(fs.readFileSync(path.join(gameRoot, '.unit-fx-audit.json'), 'utf8'));
const spellAudit = JSON.parse(fs.readFileSync(path.join(gameRoot, '.spell-fx-audit.json'), 'utf8'));
const bodies = {};
const soundNames = new Set();
for (const [cardId, entry] of Object.entries(unitAudit.cards)) {
  const states = {};
  const stateResources = [];
  const stateAliases = { breathing: 'breathing', idle: 'idle', walk: 'run', attack: 'attack', damage: 'hit', death: 'death', cast: 'cast', castStart: 'castStart', castLoop: 'castLoop', castEnd: 'castEnd' };
  for (const [sourceName, outputName] of Object.entries(stateAliases)) {
    const sourceState = entry.body.states[sourceName];
    if (sourceState) {
      const resource = Object.values(RSX).find((candidate) => candidate?.framePrefix === sourceState[0] && Math.abs(candidate?.frameDelay - sourceState[1] / 1000) < 0.00001);
      if (!resource?.img || !resource?.plist) throw new Error(`Body state ${cardId}.${sourceName} does not match an RSX animation resource`);
      stateResources.push(resource);
      states[outputName] = { prefix: resource.framePrefix, frameMs: resource.frameDelay * 1000 };
    }
  }
  const sourceImg = stateResources[0].img;
  const sourcePlist = stateResources[0].plist;
  if (stateResources.some((resource) => resource.img !== sourceImg || resource.plist !== sourcePlist)) throw new Error(`Body ${cardId} states span multiple atlases`);
  if (sourceImg !== entry.body.sheet || sourcePlist !== entry.body.plist) throw new Error(`Body ${cardId} audit atlas differs from RSX`);
  const sheet = path.basename(sourceImg, '.png');
  const bodySounds = Object.fromEntries(Object.entries(entry.sounds).map(([event, name]) => {
    const audio = RSX[name]?.audio;
    if (!audio) throw new Error(`No RSX audio field for body sound ${name}`);
    return [event, audio];
  }));
  bodies[cardId] = {
    sheet,
    plist: path.basename(sourcePlist, '.plist'),
    states,
    attackDelayMs: entry.body.attackDelayMs,
    sounds: bodySounds,
  };
  Object.values(entry.sounds).forEach((name) => soundNames.add(name));
}
const spellSounds = {};
const spellArtSources = {};
for (const [cardId, entry] of Object.entries(spellAudit.cards)) {
  const resourceName = entry.factory.sound.replace(/^RSX\.|\.audio$/g, '');
  const audio = RSX[resourceName]?.audio;
  if (!audio) throw new Error(`No RSX audio field for spell ${cardId}`);
  spellSounds[cardId] = audio;
  soundNames.add(resourceName);
  const [faction, identifier] = spellSpecs[cardId];
  const idleName = rsxAnimName(factoryBlock(faction, identifier, 'Spell').text, 'idle');
  if (idleName && RSX[idleName]?.img) spellArtSources[cardId] = RSX[idleName];
}

const spriteNames = new Set();
const particlePlists = new Set();
function scan(value) {
  if (Array.isArray(value)) return value.forEach(scan);
  if (!value || typeof value !== 'object') return;
  if (typeof value.spriteIdentifier === 'string') spriteNames.add(value.spriteIdentifier);
  if (Array.isArray(value.spriteIdentifier)) value.spriteIdentifier.forEach((name) => spriteNames.add(name));
  if (value.type === 'Particles') {
    const plist = value.plistFile || value.plist;
    if (typeof plist === 'string') particlePlists.add(plist);
  }
  Object.values(value).forEach(scan);
}
scan(recipes);
// Shadow Creep is a persistent board tile, so no one-shot FX recipe references
// its idle animation. Keep it explicitly in the generated sprite resources.
spriteNames.add('fxShadowCreepIdle');

function outputCategory(sourcePath) {
  if (sourcePath.includes('/units/')) return 'units';
  if (sourcePath.includes('/decals/')) return 'decals';
  if (sourcePath.includes('/sfx/')) return 'sfx';
  if (sourcePath.includes('/fonts/')) return 'fonts';
  if (sourcePath.includes('/card_backgrounds/')) return 'card-backgrounds';
  if (sourcePath.includes('/generals/')) return 'generals';
  if (sourcePath.includes('/crests/')) return 'crests';
  if (sourcePath.includes('/icons/')) return 'spells';
  if (sourcePath.includes('/ui/')) return 'ui';
  return 'fx';
}
function localize(sourcePath) {
  return `./assets/${outputCategory(sourcePath)}/${path.posix.basename(sourcePath)}`;
}
function sourceFile(sourcePath) {
  const primary = path.join(sourceRoot, 'app', ...sourcePath.split('/'));
  if (fs.existsSync(primary)) return primary;
  if (sourcePath.startsWith('resources/units/') && sourcePath.endsWith('.png')) {
    return path.join(sourceRoot, 'app/original_resources/units', path.posix.basename(sourcePath));
  }
  return primary;
}
const copied = new Map();
function copyVerified(sourcePath) {
  const source = sourceFile(sourcePath);
  if (!fs.existsSync(source)) throw new Error(`Missing source asset ${sourcePath}`);
  const local = localize(sourcePath);
  const destination = path.join(gameRoot, 'dist', ...local.replace(/^\.\//, '').split('/'));
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
  const digest = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const hash = digest(source);
  if (hash !== digest(destination)) throw new Error(`SHA256 mismatch for ${sourcePath}`);
  copied.set(local.replace('./assets/', ''), { source: path.relative(sourceRoot, source).replaceAll('\\', '/'), sha256: hash });
  return local;
}

function copyVerifiedAs(sourcePath, local) {
  const source = sourceFile(sourcePath);
  if (!fs.existsSync(source)) throw new Error(`Missing source asset ${sourcePath}`);
  const destination = path.join(gameRoot, 'dist', ...local.replace(/^\.\//, '').split('/'));
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
  const hash = crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex');
  copied.set(local.replace('./assets/', ''), { source: path.relative(sourceRoot, source).replaceAll('\\', '/'), sha256: hash });
  return local;
}

const spellArtSpecs = Object.fromEntries(Object.entries(spellArtSources).map(([id, resource]) => [id, {
  img: copyVerified(resource.img),
  plist: resource.plist ? copyVerified(resource.plist) : null,
  prefix: resource.framePrefix,
  frameMs: resource.frameDelay * 1000,
}]));
// Compatibility for card.art consumers; renderers that need a real icon frame use spellArtSpecs.
const spellArt = Object.fromEntries(Object.entries(spellArtSpecs).map(([id, spec]) => [id, spec.img]));

const resources = {};
for (const name of spriteNames) {
  const key = Object.keys(RSX).find((candidate) => RSX[candidate]?.name === name);
  const sourceResource = key && RSX[key] || (name.startsWith('resources/') ? { name, img: name } : null);
  if (!sourceResource) throw new Error(`No RSX resource for spriteIdentifier ${name}`);
  const resource = { ...sourceResource };
  for (const field of ['img', 'plist']) if (resource[field]) resource[field] = copyVerified(resource[field]);
  resources[name] = resource;
}

const sounds = {};
for (const name of soundNames) {
  const resource = RSX[name] || Object.values(RSX).find((candidate) => candidate?.name === name);
  if (!resource?.audio) throw new Error(`No RSX audio resource for ${name}`);
  if (Array.isArray(resource.audio)) {
    resource.audio.forEach((sourcePath) => { sounds[sourcePath] = copyVerified(sourcePath); });
  } else {
    sounds[resource.audio] = copyVerified(resource.audio);
  }
}

function parseParticlePlist(sourcePath) {
  const xml = fs.readFileSync(sourceFile(sourcePath), 'utf8');
  const params = {};
  const pattern = /<key>([^<]+)<\/key>\s*<(string|real|integer)>([^<]*)<\/\2>/g;
  for (const match of xml.matchAll(pattern)) {
    const [, key, type, raw] = match;
    params[key] = type === 'string' ? raw : Number(raw);
  }
  const boolPattern = /<key>([^<]+)<\/key>\s*<(true|false)\s*\/>/g;
  for (const match of xml.matchAll(boolPattern)) params[match[1]] = match[2] === 'true';
  return params;
}
const particles = {};
for (const plist of particlePlists) {
  const params = parseParticlePlist(plist);
  copyVerified(plist);
  if (params.textureFileName) {
    const texturePath = path.posix.join(path.posix.dirname(plist), params.textureFileName);
    if (fs.existsSync(sourceFile(texturePath))) params.textureFileName = copyVerified(texturePath);
  }
  particles[plist] = params;
}

// The authorized source checkout omits f3_irondervish.png while retaining its plist.
// Use the original same-faction Dervish atlas so the summoned token remains visible.
if (!fs.existsSync(sourceFile('resources/units/f3_irondervish.png'))) bodies['225'] = { ...bodies['217'] };
for (const body of Object.values(bodies)) {
  copyVerified(`resources/units/${body.sheet}.png`);
  copyVerified(`resources/units/${body.plist}.plist`);
}

for (const faction of [1,2,3,4,5,6]) {
  for (const kind of ['unit','spell']) copyVerifiedAs(`resources/card_backgrounds/f${faction}_${kind}.png`, `./assets/card-backgrounds/f${faction}-${kind}.png`);
  copyVerified(`resources/generals/general_portrait_image_f${faction}.png`);
  copyVerified(`resources/generals/general_portrait_image_f${faction}alt.png`);
  const crest = RSX[`crest_f${faction}`];
  if (crest?.img) copyVerified(crest.img);
}

const statFeedback = {
  fontFamily: RSX.font_bold.name,
  font: copyVerified(RSX.font_bold.font),
  hpBackground: copyVerified(RSX.card_stats_hp_simple_bg.img),
  healIcon: copyVerified(RSX.icon_heal.img),
  fontSize: 20,
  hpColor: { r: 252, g: 0, b: 2 },
  offsetY: 10,
  anchor: 'entityCenter',
  delayMs: 93.75,
  growMs: 225,
  holdMs: 375,
  shrinkMs: 150,
};

const manifest = { recipes, resources, sprites: resources, bodies, cardRecipes, spellRecipes, spellSounds, spellArt, spellArtSpecs, sounds, particles, statFeedback, sourceRoot };
const manifestText = `// Generated by tools/sync-effects.mjs from the read-only Duelyst source.\nexport const EFFECT_MANIFEST = ${JSON.stringify(manifest, null, 2)};\n`;
fs.writeFileSync(path.join(gameRoot, 'dist/js/effect-manifest.js'), manifestText);

const sourcesFile = path.join(assetRoot, 'SOURCES.md');
const begin = '<!-- sync-effects:begin -->';
const end = '<!-- sync-effects:end -->';
const rows = [...copied.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([local, info]) => `| \`${local}\` | \`${info.source}\` | \`${info.sha256}\` |`);
const unitRows = Object.entries(unitAudit.cards).map(([id, entry]) => {
  const stats = entry.sourceStats;
  return `| ${id} / ${entry.name} | ${stats.cost} / ${stats.attack} / ${stats.health} | \`${entry.factoryLines}\` |`;
});
const missingFx = Object.entries(unitAudit.cards).filter(([, entry]) => !entry.factoryFxRegistered).map(([id, entry]) =>
  `- ${id} / ${entry.name}：原工厂引用 \`${entry.factoryFx}\`，但源 \`app/data/fx.js\` 没有该配方。${entry.h5FxFallback ? `H5 复用 \`${entry.h5FxFallback}\`。` : 'H5 保留原阵营公共配方。'}自身原动画和音效不替换。`);
const section = `${begin}\n\n## 原版单位数值与资源来源\n\n单位 ID 对应原工程 \`app/sdk/cards/cardsLookup.coffee\`；费用、攻击和生命直接读取下表中的原工厂。机制保留原工厂定义；H5 的确定性表现差异在游戏任务记录中说明。详细原机制与动画审计由 \`.unit-fx-audit.json\` 保存。\n\n| 原版 ID / 工厂名称 | 费用 / 攻击 / 生命 | 原工程工厂 |\n| --- | --- | --- |\n${unitRows.join('\n')}\n\n原工程缺失的特效配方：\n\n${missingFx.join('\n')}\n\n## 特效同步资源\n\n以下文件由 \`node tools/sync-effects.mjs\` 从只读源工程同步，并以 SHA256 核对。\n\n| 包内资源 | 原工程来源 | SHA256 |\n| --- | --- | --- |\n${rows.join('\n')}\n\n${end}`;
const current = fs.readFileSync(sourcesFile, 'utf8');
const next = current.includes(begin) ? current.replace(new RegExp(`${begin}[\\s\\S]*?${end}`), section) : `${current.trimEnd()}\n\n${section}\n`;
fs.writeFileSync(sourcesFile, next);

console.log(`Wrote ${Object.keys(recipes).length} recipes, ${Object.keys(resources).length} sprite resources, ${Object.keys(bodies).length} bodies, ${Object.keys(sounds).length} sound keys, ${Object.keys(particles).length} particle definitions.`);
console.log(`Copied and verified ${copied.size} unique assets.`);
