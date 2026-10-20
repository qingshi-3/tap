import { GENERALS } from './content';
import type { CareerProfile } from './career';
export interface BoardDef { key: string; title: string; order: 'asc'|'desc'; calc: 'best'|'latest'; unit: string; description: string; platformId: string | null }
/** Public platform board registration is a separate authorization. Empty is explicitly unconfigured. */
export const BOARD_IDS: Partial<Record<string,string>> = {};
const def = (key:string,title:string,unit:string,description:string,calc:'best'|'latest'='best',order:'asc'|'desc'='desc'):BoardDef => ({key,title,unit,description,calc,order,platformId:BOARD_IDS[key] ?? null});
export const BOARD_DEFS: BoardDef[] = [
 def('totalWins','通关次数榜','次','累计完成三章远征的次数'),
 def('winRate','胜率榜','%','通关至少3次后入榜；通关次数÷已结束远征次数','latest'),
 def('bestStreak','连胜榜','次','连续完成整局远征的最高通关次数'),
 ...GENERALS.map(g => def(`general_${g.id}`,`${g.name}胜率`,'%','仅此主将完整远征通关至少3次；未结束不计分母','latest')),
 ...['虚空领主','霜魇女皇','永夜君王'].map((name,ch) => def(`boss_${ch}`,`${name}速胜榜`,'拍','击败此首领的最少拍数，开战阶段取胜记0拍','best','asc')),
 def('singleHit','一击之威榜','伤害','获胜战斗中，单次伤害实际扣除的最多生命'),
 def('spellDamage','法术输出榜','伤害','获胜战斗中，单位施法与主将技能的单场最高有效伤害'),
 def('burnDamage','烈焰榜','伤害','获胜战斗中，灼烧造成的单场最高有效伤害'),
 def('freezes','冰封榜','次','获胜战斗中，敌人实际因冻结跳过行动的单场最高次数'),
 def('mitigated','铁壁榜','伤害','获胜战斗中，格挡与护甲实际抵消伤害的单场最高总量'),
 def('achievementPoints','成就榜','分','已达成成就的累计积分'),
];
export interface BoardScore extends BoardDef { value:number; configured:boolean }
export function getBoardScores(profile:CareerProfile):BoardScore[] {
 const rate = (wins:number,played:number) => Math.round(wins / Math.max(1,played) * 10000)/100;
 const values:Record<string,number> = {totalWins:profile.totals.wins,bestStreak:profile.totals.bestStreak,achievementPoints:profile.achievementPoints};
 if(profile.totals.wins >= 3) values.winRate = rate(profile.totals.wins,profile.totals.played);
 for(const g of GENERALS) { const s=profile.generals[g.id]; if(s?.wins >= 3) values[`general_${g.id}`]=rate(s.wins,s.played); }
 for(const [ch,n] of Object.entries(profile.bossBest)) values[`boss_${ch}`]=n;
 for(const key of ['singleHit','spellDamage','burnDamage','freezes','mitigated']) if(profile.best[key] !== undefined) values[key]=profile.best[key];
 return BOARD_DEFS.filter(b => Number.isFinite(values[b.key])).map(b => ({...b,value:values[b.key],platformId:BOARD_IDS[b.key] ?? null,configured:!!BOARD_IDS[b.key]}));
}
