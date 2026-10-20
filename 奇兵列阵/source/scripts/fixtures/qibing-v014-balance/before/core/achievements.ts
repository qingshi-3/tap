import { GENERALS } from './content';
import type { CareerProfile } from './career';
export interface AchievementDef { id: string; name: string; description: string; category: string; points: number; target: number; read: (p: CareerProfile) => number }
export interface AchievementProgress { id: string; name: string; description: string; category: string; points: number; current: number; target: number; completed: boolean }
const metrics: [string, string, string, number[]][] = [
 ['singleHit','重击','单次最高有效伤害',[10,25,50,100]],
 ['spellDamage','法术轰击','单场法术有效伤害',[20,60,150,300]],
 ['burnDamage','燎原','单场灼烧有效伤害',[10,30,80,160]],
 ['freezes','冰封','单场冻结次数',[1,3,6,10]],
 ['mitigated','固守','单场实际减免伤害',[10,30,80,160]],
 ['healing','回春','单场实际恢复生命',[10,30,80,160]],
 ['blocks','坚盾','单场实际消耗格挡次数',[1,3,6,10]],
 ['guards','护卫','单场护卫代受次数',[1,3,6,10]],
 ['revives','归来','单场复生次数',[1,2,3,5]],
 ['summons','援军','单场成功召唤次数',[1,2,4,6]],
 ['sacrifices','献祭','单场成功献祭次数',[1,2,3,5]],
 ['extraActions','追击','单场额外行动次数',[1,3,6,12]],
 ['casts','共鸣','单场施法次数',[2,5,10,20]],
 ['kills','破阵','单场击杀次数',[2,5,8,12]],
 ['thornsDamage','反击','单场反击有效伤害',[5,15,30,60]],
 ['splashDamage','波及','单场溅射有效伤害',[5,15,40,80]],
 ['vulnConsumed','乘隙','单场消耗易伤层数',[2,5,10,20]],
];
const growth: [string,string,string,number[]][] = [
 ['gold','军饷储备','获胜开战时持有金币',[10,20,35]],
 ['genPower','主将培养','获胜开战时主将法强',[3,8,15]],
 ['promotions','升阶','获胜开战时主将升阶次数',[1,2,3]],
 ['equips','全副武装','获胜开战时已穿戴装备数量',[2,4,6]],
 ['maxStars','精锐','获胜开战时持有单位的最高星级',[2,3]],
 ['trained','千锤百炼','获胜开战时单个单位培养点数',[5,10,20]],
];
export const ACHIEVEMENTS: AchievementDef[] = [
 ...metrics.flatMap(([key,name,label,targets]) => targets.map((target,i) => ({ id: `battle_${key}_${target}`, name: `${name}·${i+1}`, description: `正式获胜战斗中，${label}达到${target}`, category: '战斗机制', points: (i+1)*5, target, read: (p:CareerProfile) => p.best[key] ?? 0 }))),
 ...growth.flatMap(([key,name,label,targets]) => targets.map((target,i) => ({ id: `growth_${key}_${target}`, name: `${name}·${i+1}`, description: `${label}达到${target}`, category: '培养成长', points: (i+1)*5, target, read: (p:CareerProfile) => p.facts[key] ?? 0 }))),
 ...GENERALS.flatMap(g => [1,3,10].map((target,i) => ({ id: `general_${g.id}_${target}`, name: `${g.name}·${i+1}`, description: `使用${g.name}完整通关${target}次远征`, category:'主将', points: (i+1)*10, target, read:(p:CareerProfile) => p.generals[g.id]?.wins ?? 0 }))),
 ...[0,1,2].flatMap(chapter => [40,25,15].map((limit,i) => ({ id:`boss_${chapter}_${limit}`,name:`第${chapter+1}章速胜·${i+1}`,description:`在${limit}拍内击败第${chapter+1}章首领（含开战阶段获胜）`,category:'远征挑战',points:(i+1)*10,target:1,read:(p:CareerProfile) => p.bossBest[String(chapter)] !== undefined && p.bossBest[String(chapter)] <= limit ? 1 : 0 }))),
 ...[0,1,2].map(ch => ({id:`boss_first_${ch}`,name:`第${ch+1}章破关`,description:`首次击败第${ch+1}章首领`,category:'远征挑战',points:10,target:1,read:(p:CareerProfile) => p.facts[`boss_${ch}`] ?? 0})),
 ...[1,3,5].map((target,i) => ({ id:`streak_${target}`,name:`连胜远征·${i+1}`,description:`连续通关${target}次完整远征`,category:'远征挑战',points:(i+1)*10,target,read:(p:CareerProfile) => p.totals.bestStreak })),
 ...([
 ['winSmall','少而精','持有单位不超过4名时赢得战斗'],
 ['winNoSpell','自成一军','未使用一次性法术赢得战斗'],
 ['winFast','先声夺人','10拍内赢得战斗'],
 ['winZero','开战决胜','在开战阶段0拍赢得战斗'],
 ['burnAndFreeze','冰火交织','同场造成灼烧伤害并触发冻结后获胜'],
 ['guardAndBlock','铜墙铁壁','同场触发护卫和格挡后获胜'],
 ['reviveAndSummon','生生不息','同场成功复生和召唤后获胜'],
 ['spellAndStrike','兵法并举','同场造成法术伤害与普攻伤害后获胜'],
 ['bossNoLegendary','以凡胜强','未上阵传说单位时击败首领'],
 ['winThreeFactions','百川归海','至少三个阵营的单位共同上阵并获胜'],
 ['winThreeNeutral','佣兵成军','至少三名中立单位上阵并获胜'],
 ['winDual','双持破阵','有装备两件装备的单位上阵并获胜'],
 ['winThreeStars','群星闪耀','至少三名三星单位上阵并获胜'],
 ['thornsAndArmor','攻守兼备','同场造成反击伤害和实际减免伤害后获胜'],
 ['freezeAndCast','寒咒交响','同场触发冻结和施法后获胜'],
 ['summonAndSacrifice','深渊轮回','同场成功召唤和献祭后获胜'],
 ] as const).map(([id,name,description]) => ({id:`challenge_${id}`,name,description,category:'远征挑战',points:15,target:1,read:(p:CareerProfile) => p.facts[id] ?? 0})),
];
export function getAchievementProgress(profile: CareerProfile): AchievementProgress[] {
 return ACHIEVEMENTS.map(a => { const current = Math.max(0,a.read(profile)); return { id:a.id,name:a.name,description:a.description,category:a.category,points:a.points,current:Math.min(a.target,current),target:a.target,completed:profile.unlocked.includes(a.id) || current >= a.target }; });
}
