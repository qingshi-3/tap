// Player-facing descriptions of the runtime job loops; no mutable combat state here.
export const JOB_COMBAT = Object.freeze({
  blade_master: { loop:'普攻储剑 → 主动布阵 → 引剑追击', basic:'第三击追加穿透剑气，积攒最多 3 枚剑意。', skills:{dash:'突进终点留下刃印，下一次第三击从刃印再发剑气。',cleave:'消耗 1 枚剑意，扇斩后追加延迟落剑。',guard:'守势中首次受击反斩，并获得 1 枚剑意。',swordField:'消耗剑意布置悬剑，阵中普攻命中引下一枚剑。',bladeWave:'消耗 1 枚剑意，在剑潮末端追加回剑。'} },
  swift_blade: { loop:'普攻积动势 → 突进续连 → 旋斩释放', basic:'命中积攒最多 3 层动势，第三击追加交叉斩。', skills:{dash:'消耗 1 层动势，终点交叉斩；下一次普攻直接重斩。',quickCut:'消耗 1 层动势，终点交叉斩；下一次普攻直接重斩。',cleave:'消耗动势，每层追加一次错峰近身斩。',guard:'守势后下一次普攻直接重斩。',whirlwind:'移动旋斩 2 秒、共 4 次；动势追加外圈刀锋。暂停普攻，可用突进取消。'} },
  summoner_master: { loop:'普攻发军令 → 满员冲锋 → 召回再出击', basic:'每第三发命中下达军令，号令至多 3 名护卫与 1 名强契灵就近攻击。', skills:{summonGuard:'未满员召唤护卫；满员后改为短距冲锋，不替换健康护卫。',recallSummons:'召回并恢复生命，下一发普攻直接发出军令。',summonElite:'首次降临范围重击；强契灵仍在场时改为指向焦点的重击。'} },
  blink_master: { loop:'地面布镖 → 普攻充刃 → 穿梭引爆', basic:'每第二发主飞刃命中飞镖附近敌人，为最近一枚镖充能，最多 2 层。', skills:{markBlade:'飞镖落地后，向附近敌人释放一次短刃。',blinkStrike:'落地消耗目标镖刃能，追加交叉刃；下一次普攻获得返影。',blinkStorm:'首次抵达各镖消耗刃能爆发，折返不重复引爆；仍全程无敌并在最终落地推敌。'} },
  mage_master: { loop:'主动铺元素 → 三相普攻 → 热震与碎裂', basic:'主元素弹与自身火、冰、裂岩状态反应；每个目标最多每秒一次。', skills:{flameBreath:'喷火留下燃烧标记，供冰弹触发冰裂。',rockWall:'升墙冲击留下裂岩，下次主元素弹命中碎裂。',frostAura:'冰柱雨留下寒霜，火弹命中可触发范围热震。'} },
});

export function getJobCombat(job) { return JOB_COMBAT[job] || null; }
export function getJobSkillDescription(job, skillId, fallback='') { return JOB_COMBAT[job]?.skills[skillId] || fallback; }
export function recommendedSkills(job, level, fallback) {
  if(job==='blade_master') return ['dash',level>=5?'bladeWave':'cleave',level>=3?'swordField':'guard'];
  if(job==='swift_blade') return [level>=5?'quickCut':'dash','cleave',level>=3?'whirlwind':'guard'];
  return [...fallback];
}
