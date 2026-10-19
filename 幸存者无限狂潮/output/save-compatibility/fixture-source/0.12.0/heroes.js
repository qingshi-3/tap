export const SKILL_DEFINITIONS = Object.freeze({
  dash: Object.freeze({ id:'dash', animation:'attack', name:'风行突进', description:'化作疾风向前突进，穿过敌阵并避开包围。', cooldown:5, aimType:'dash', jobs:Object.freeze(['fighter','blade_master','swift_blade']), level:1 }),
  cleave: Object.freeze({ id:'cleave', animation:'attack', name:'裂空斩', description:'挥出扇形剑气，清扫前方敌群。', cooldown:8, aimType:'cone', jobs:Object.freeze(['fighter','blade_master','swift_blade']), level:1 }),
  guard: Object.freeze({ id:'guard', animation:'cast', name:'风息守势', description:'获得 3.2 秒守护，受到的伤害降低 60%。', cooldown:12, aimType:'self', jobs:Object.freeze(['fighter','blade_master','swift_blade']), level:1 }),
  swordField: Object.freeze({ id:'swordField', animation:'cast', name:'剑阵', description:'在指定方向展开剑阵，持续切割范围内的敌人。', cooldown:18, aimType:'circle', jobs:Object.freeze(['blade_master']), level:3 }),
  bladeWave: Object.freeze({ id:'bladeWave', animation:'attack', name:'破空剑潮', description:'向前释放贯穿战线的连续剑气。', cooldown:10, aimType:'line', jobs:Object.freeze(['blade_master']), level:5 }),
  whirlwind: Object.freeze({ id:'whirlwind', animation:'attack', name:'回风乱舞', description:'高速旋斩，将周围敌人卷入风刃。', cooldown:12, aimType:'circle', jobs:Object.freeze(['swift_blade']), level:3 }),
  quickCut: Object.freeze({ id:'quickCut', animation:'attack', name:'瞬身斩', description:'沿直线疾驰并斩击路径上的敌人。', cooldown:6, aimType:'dash', jobs:Object.freeze(['swift_blade']), level:5 }),
  summonGuard: Object.freeze({ id:'summonGuard', animation:'cast', name:'契灵卫', description:'召唤契灵护卫，场上至多存在 3 名。', cooldown:8, aimType:'self', jobs:Object.freeze(['summoner','summoner_master']), level:1 }),
  recallSummons: Object.freeze({ id:'recallSummons', animation:'cast', name:'归契', description:'召回契灵，恢复 25% 生命并获得 1 秒减伤。', cooldown:12, aimType:'self', jobs:Object.freeze(['summoner','summoner_master']), level:1 }),
  summonElite: Object.freeze({ id:'summonElite', animation:'cast', name:'强契降临', description:'召唤一名强契灵，场上至多存在 1 名。', cooldown:25, aimType:'self', jobs:Object.freeze(['summoner','summoner_master']), level:1 }),
  markBlade: Object.freeze({ id:'markBlade', animation:'attack', name:'地面飞镖', description:'投出穿透飞镖，在240距离落地；最多4枚，保留14秒。', cooldown:2, aimType:'line', jobs:Object.freeze(['blink','blink_master']), level:1 }),
  blinkStrike: Object.freeze({ id:'blinkStrike', animation:'attack', name:'瞬印袭', description:'选择600范围飞镖，无敌穿梭并伤害沿途敌人；落地弹开周围敌人5身位。', cooldown:5, aimType:'line', jobs:Object.freeze(['blink','blink_master']), level:1 }),
  blinkStorm: Object.freeze({ id:'blinkStorm', animation:'attack', name:'瞬印连袭', description:'无敌遍历600范围全部飞镖后折返，停在第一枚并弹开周围敌人。', cooldown:18, aimType:'circle', jobs:Object.freeze(['blink','blink_master']), level:1 }),
  flameBreath: Object.freeze({ id:'flameBreath', animation:'cast', name:'焰息', description:'沿施放方向持续喷火 3 秒，期间可移动。', cooldown:9, aimType:'cone', jobs:Object.freeze(['mage','mage_master']), level:1 }),
  rockWall: Object.freeze({ id:'rockWall', animation:'cast', name:'岩障', description:'沿英雄前方升起半径 90 的弧形岩墙，震退敌人并阻挡怪物与敌弹 6 秒。', cooldown:12, aimType:'line', jobs:Object.freeze(['mage','mage_master']), level:1 }),
  frostAura: Object.freeze({ id:'frostAura', animation:'cast', name:'冰柱雨', description:'在指定圆形区域降下冰柱雨，持续造成冰霜伤害并减速。', cooldown:22, aimType:'circle', jobs:Object.freeze(['mage','mage_master']), level:1 }),
});

const RAW_HEROES = [
  { id:'commander', kind:'base_commander', name:'风刃指挥官', shortName:'风刃', subtitle:'破阵连锋', description:'近身挥出扇形风刃，以三段连斩的重击撕开敌阵。', color:'#74e6d4', job:'fighter', skills:['dash','cleave','guard'], passive:'每第三次普攻成为破阵重斩；成功施放主动技能会有限强化下一次普攻。' },
  { id:'summoner', kind:'base_summoner', name:'契灵使', shortName:'契灵', subtitle:'灵契守望者', description:'以灵契弹号令护卫集火，并在战线间隙修复契灵。', color:'#9cdb91', job:'summoner', skills:['summonGuard','recallSummons','summonElite'], passive:'远程普攻指定集火目标；出战时自带一名契灵卫。' },
  { id:'blink', kind:'base_blink', name:'瞬印行者', shortName:'瞬印', subtitle:'刃痕追猎者', description:'用精准飞刃追猎飞镖附近目标，并沿地面飞镖突进与折返。', color:'#f0b56a', job:'blink', skills:['markBlade','blinkStrike','blinkStorm'], passive:'普攻优先追击飞镖附近目标，对其造成更高伤害。' },
  { id:'mage', kind:'base_mage', name:'元素法师', shortName:'元素', subtitle:'三相塑能者', description:'轮转烈焰、寒霜与岩石弹，为毒雾和旋涡创造元素连携。', color:'#91bdf2', job:'mage', skills:['flameBreath','rockWall','frostAura'], passive:'普攻依次施放烈焰、寒霜、岩石；灼烧、减速与溅射各司其职。' },
];
export const HEROES = Object.freeze(RAW_HEROES.map(hero => Object.freeze({ ...hero, skills:Object.freeze(hero.skills.map((id,index)=>Object.freeze({ key:['Q','E','R'][index], id, name:SKILL_DEFINITIONS[id].name, description:SKILL_DEFINITIONS[id].description }))) })));

export const HERO_JOBS = Object.freeze({
  fighter:Object.freeze({id:'fighter',heroId:'commander',kind:'base_commander',name:'战士',tier:1,trialId:null,questId:null,benefit:'攻守均衡',description:'攻守均衡的基础职业。'}),
  blade_master:Object.freeze({id:'blade_master',heroId:'commander',kind:'general_commander',name:'剑阵宗师',tier:2,trialId:'blade-trial',questId:'job-blade',benefit:'解锁剑阵（3级）与破空剑潮（5级）',description:'驾驭剑阵与远程剑潮的进阶职业。'}),
  swift_blade:Object.freeze({id:'swift_blade',heroId:'commander',kind:'general_swift',name:'迅刃',tier:2,trialId:'swift-trial',questId:'job-swift',benefit:'解锁回风乱舞（3级）与瞬身斩（5级）',description:'依靠高速位移与旋斩突围的进阶职业。'}),
  summoner:Object.freeze({id:'summoner',heroId:'summoner',kind:'base_summoner',name:'契灵使',tier:1,trialId:null,questId:null,benefit:'召唤与回收契灵',description:'召唤并回收契灵维持阵线。'}),
  summoner_master:Object.freeze({id:'summoner_master',heroId:'summoner',kind:'general_summoner',name:'契灵统御者',tier:2,trialId:'summoner-trial',questId:'job-summoner',benefit:'契灵集火伤害加成 +12 个百分点',description:'统御契灵集中压制指定目标。'}),
  blink:Object.freeze({id:'blink',heroId:'blink',kind:'base_blink',name:'瞬印行者',tier:1,trialId:null,questId:null,benefit:'以地面飞镖高速穿梭',description:'以地面飞镖为锚点高速穿梭。'}),
  blink_master:Object.freeze({id:'blink_master',heroId:'blink',kind:'general_blink',name:'瞬印宗师',tier:2,trialId:'blink-trial',questId:'job-blink',benefit:'普攻对飞镖附近敌人的加成 20% → 32%',description:'以宗师技法追猎飞镖附近目标。'}),
  mage:Object.freeze({id:'mage',heroId:'mage',kind:'base_mage',name:'元素法师',tier:1,trialId:null,questId:null,benefit:'三相元素轮转',description:'用三种元素法术控制战场。'}),
  mage_master:Object.freeze({id:'mage_master',heroId:'mage',kind:'general_mage',name:'元素贤者',tier:2,trialId:'mage-trial',questId:'job-mage',benefit:'灼烧、冰裂、岩石溅射伤害 ×1.15',description:'强化元素附加效果的伤害。'}),
});
export function getHero(id){return HEROES.find(hero=>hero.id===id)||null;}
export function getHeroJob(job){return HERO_JOBS[job]||HERO_JOBS.fighter;}
export function getHeroKind(heroId,job){const hero=getHero(heroId),meta=HERO_JOBS[job];return meta?.heroId===heroId?meta.kind:(hero?.kind||null);}
export function getHeroJobs(heroId){return Object.values(HERO_JOBS).filter(job=>job.heroId===heroId);}
export function getSelectedHero(profile){return getHero(profile?.selectedHero)||HEROES[0];}
export function selectHero(id){const hero=getHero(id);return hero?{ok:true,message:`${hero.name}已整装待发。`}:{ok:false,message:'未知英雄。'};}
