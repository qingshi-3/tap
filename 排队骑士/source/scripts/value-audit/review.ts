// @ts-ignore Offline Node utility, consistent with the project sim.
import { readFileSync, writeFileSync } from 'node:fs';
import { BOSSES, CARDS, LINE_INFO, SHOP_POOL } from '../../src/core/data';
import { runInvariants } from './invariants';
import type { runNiche } from './niche';

interface Metric { value: string; delta: number; n: number }
interface Unit {
  id: string; name: string; line: keyof typeof LINE_INFO; tier: number; hasEconomicRole: boolean;
  summary: { delta: number; n: number; triggers: number; fizzles: number; left: number; right: number };
  contexts: Metric[]; stages: Metric[]; star: Metric[];
  sensitivity: { type: string; n: number; delta: number }[];
  replacements: { alternative: string; n: number; delta: number }[];
  lifecycle: { unit: string; level: number; horizon: number; statGainDelta: number[]; bankDelta: number; goldEarnedDelta: number; goldSpentDelta: number; scoreDelta: number }[];
  contracts: { id: string; status: string; expected: string; observed: string }[];
  natural: { appearances: number; levels: number[] };
}
const VERDICTS: Record<string, [string, string]> = {
  l_shield: ['基础入口成立', '最早的天然轮换入口，同身材格挡坦无法替代其触发退后/上前的作用；需要队友，末人轮换收益消失。'],
  l_windblade: ['低阶成长核成立', '把其他友军退后变成自身攻击，提供早期轮换收益；其自身退后不自触发，不能当单兵循环。'],
  s_dart: ['过渡与破盾定位成立', '紧邻耐打无盾前排的小额持续技能伤害有独立用途；格挡反而阻止受伤触发，后期需要增伤或多次触发。'],
  s_fox: ['过渡定位成立', '购买后立刻有开战随机伤害，无需组件；固定伤害和随机目标限制后期留位理由。'],
  a_imp: ['低阶连锁入口成立', '死亡后原位补身体，同时连接友军死亡与召唤两类引擎；其亡语优先占位，会挤掉自身复生。'],
  a_spine: ['死亡直伤核心成立', '小兵和复生能反复喂伤害；需要自己活着看到友军死亡，不能只看前排身材。'],
  m_egg: ['投资型价值成立', 'bank积累让死亡产物成长，和普通面板成长不同；未孵化时收益未兑现，提前买入和确保死亡很重要。'],
  m_whelp: ['低阶召唤支援成立', '用较早的阶层把召唤次数转成攻击；只长攻击且依赖实际召唤，不能用满编壳白板表现判定全部价值。'],
  v_guard: ['独立防御入口成立', '完整挡一次伤害可以保护高价前排回合，且无需其他卡启用；面对多段小伤收益下降。'],
  d_artificer: ['买卖成长成立', '一星买卖净耗2金换随机友军2/2，并能触发卖卡体系；为出售能力追高星的额外找牌与复制成本须单独算。'],
  l_vigil: ['轮换循环成立', '退后给自身格挡，能用存活换后续循环；初次交锋没有自带开战盾，和冰晶甲虫不是同一角色。'],
  n_tether: ['跨流派桥梁成立', '让非天然轮换队首进入退后循环，用一个站位支援多个前排；自身当队首不能自推，天然轮换也不额外退一次。'],
  s_step: ['位置狙击成立', '反复上前打第二位能改变后排生存，和普通加攻不同；初始队首不算上前，成型依赖换位或前排死亡。'],
  s_backstab: ['前期定向养攻成立', '二阶即可把永久攻击集中给紧邻前位；后期与双维/多目标养成竞争，保留理由是更早和定向。'],
  a_graveguard: ['双身体入口成立', '复生保留攻击回到队尾，能重复吃死亡/召唤收益；队尾1血身体也可能只是额外一次触发，需搭配评估。'],
  a_reaper: ['死亡成长核成立', '把所有友军死亡转为自身战内双维，提供死亡队的存活终点；站太前早死会丢掉引擎。'],
  m_raptor: ['强条件，优先重审', '开战召唤在四人队有明确用途，但满编默认失效；目前必须证明一只小兽加触发收益值得放弃第五个正式单位。'],
  v_snowman: ['定向防御支援成立', '给其他高价值前排格挡，解决自保型格挡牌无法保护指定对象的问题；队首摆法会无目标。'],
  v_scout: ['前中期控制成立', '提前削弱敌方首发，能提高交锋存活概率；作用范围只有开战队首，后期与白霜巨龙形成自然替换。'],
  d_dune: ['经济入口成立', '持有后每个回合提供真实额外金币；一星买3卖1，跨两次回合开始可补回纯现金差，但战斗占位和风险仍要支付。'],
  l_warden: ['流派永久养成成立', '为带轮换词条者群养生命，是轮换的专属局外成长；换位术士造成的退后不自动授予该词条。'],
  n_medic: ['续航支援成立', '把退后变成治疗，帮助高血轮换成员持续交锋；完全挡伤或未活着退后都无法兑现治疗。'],
  s_dancer: ['可成长副攻成立', '按自身攻击比例跟随交锋输出，能承接养攻投资；格挡不阻止交锋，因此与飞镖手有实质差别。'],
  s_ninja: ['自养主力成立', '三阶队尾持续双维成长，不需额外交易；要为固定尾位、持有时间和后期替换损失买单。'],
  a_ritualist: ['补位连锁成立', '固定三次友军死亡补骷髅，能延长死亡链；复生和其他亡语可能抢占空位，失败尝试也耗次数。'],
  m_incubator: ['通用召唤强化成立', '固定双维能稳定强化小召唤物，也强化复生普通单位；比比例强化更早、更不依赖自身面板。'],
  m_kujata: ['强条件，优先重审', '需非致命受伤、保住本体且有空位三条件同时成立；与格挡有反协同，默认满编会浪费有限次数。'],
  v_mage: ['通用养坦定位成立', '无需轮换标签即可集中养队首生命；与群养牌角色相近，但目标自由与生命集中仍提供区别。'],
  d_howler: ['中期群养成立', '三阶可同时养前方两位的双维，提供稳定转型基础；自己不吃且必须留出正确前后位置。'],
  d_keeper: ['升级爆发成立', '仅两次升星窗口换团队爆发，与按回合增长不同；追三/六份的刷新、份数和剩余回合决定是否值得。'],
  l_caliber: ['战内循环支援成立', '把每次友军上前变为战内双维，轮换次数能转战力；没有位置变化时无法凭后排站位自然生效。'],
  l_knight: ['天然轮换输出成立', '自身天然轮换与反复上前加攻构成循环；先要活过交锋，且单维增长在50攻上限附近会衰减。'],
  s_hunter: ['开战点杀成立', '高血目标选择提供可预期的开战削弱；三星两次动态重选目标，是可验证的技能变化而非纯面板。'],
  a_chanter: ['多目标复生支援成立', '以战斗位置换多个身后队员的复生，并保留其附魔选择；已有复生不叠，容量仍会限制实际复活。'],
  a_cult: ['定向继承成立', '把被养大的牺牲者攻/最大生命转给紧邻身后者，能回收养成投资；没有继承者时完全浪费。'],
  m_rex: ['模板重叠，优先重审', '是白鬃猎龙的高阶数值版本，仍受相同满编失效限制；应验证数值升级是否足以值得另占一个卡池位置。'],
  v_keeper: ['动态防御支援成立', '交锋后给当前队首格挡，轮换后可保护新前排；有限次数与结算时点构成其区别。'],
  v_sentinel: ['条件输出成立', '把自身仍持有的格挡转为额外交锋伤害，承接全队授盾；本身没有开战盾，不能脱离授盾组件评价。'],
  d_dunecaster: ['交易成长成立', '持有本体、卖其他牌长自身，可与构装学徒叠收益；成长不是免费，循环买3卖1每次净耗2金。'],
  d_hourglass: ['刷新成长成立', '给原本要做的前几次刷新附带属性回报；次数按整回合刷新计，晚买入可能错过窗口。'],
  l_storm: ['轮换直伤终端成立', '把多次退后直接转成伤害，和低阶风刃自长有不同兑现速度；三星双目标用于后排压力。'],
  s_viper: ['技能增伤桥梁成立', '每一发shot都可受益，跨流派支持多段、群体和反击；不增普通交锋与溅射，孤立摆放接近白板。'],
  s_master: ['开战爆发成立', '后排每名队员各射一次，可在首次交锋前改写战场；固定伤和随机目标限制后期收益，队首自身不参与齐射。'],
  a_engulf: ['战斗转永久成立', '敌人死亡最多三次写回真实Owned，是少数能跨战斗积累的战斗牌；须存活见证击杀且受50上限限制。'],
  m_bloodcaller: ['比例召唤强化成立，语义待定', '大身材能向每次召唤传递属性，适合后期放大；生命取当前hp还是最大hp必须明确，目前按当前hp，受伤会降低传递量。'],
  m_mankator: ['天然溅射主力成立', '无需消耗附魔位即可溅射，升星提高到75/100%，和辣椒有明确成本/上限区别。'],
  v_bear: ['全队格挡成长核成立', '任意友军挡伤都长自身双维，将防御次数变成后排成长；自己要活着，且只保留本场收益。'],
  v_rhyno: ['交锋连杀定位成立', '前排交锋击杀后补打新队首，能加速连续清队；技能击杀不触发，自身同归也不能兑现。'],
  d_goldob: ['余金转换成立，重复冗余', '有明确余金转属性用途；第一张花光后第二张无技能收益，升级与保留多张应分开评价。'],
  d_pharaoh: ['补给放大成立，重复冗余', '提高已购买补给的数值效率；仅最高倍率生效且整数舍入会改变星级收益，不能用面包一项代表所有补给。'],
  l_archon: ['终端成立，二星技能停档', '放大多类上前/退后技能，确有独立终端作用；1/2星额外结算均为1，二星只提高身材/带来奖励，技能本身不变。'],
  s_lord: ['持续齐射终端成立', '每次交锋让所有后排按攻击比例射击，和宗师开战爆发不同；多张只取最高倍率，不应按光环线性叠加理解。'],
  a_matriarch: ['高上限复制成立，容量敏感', '复制技能而非只造白板，能复制亡语形成二次链；不能复制主母本身、并和复生/亡语争夺空位。'],
  a_nightmare: ['死亡群伤终端成立', '一次死亡可伤全体，复生后可再炸，区别于定向输出；每名敌人的格挡都会分别抵消对应命中。'],
  m_titan: ['强条件，优先重审', '三块碎片有召唤次数上限优势，但前排满编死亡通常只空一格；应优先验证少人阵容是否真能补偿少带正式单位。'],
  m_heart: ['token专精终端成立', '给token双维和溅射，提供普通固定加成之外的质变；复生/复制普通卡不是token，不会获得本技能。'],
  v_queen: ['防御反击终端成立', '全队授盾和每次格挡反击形成自带闭环，再与巨熊/赤蛇交叉；需要留意多方反击的顺序敏感性。'],
  v_wyvern: ['群体控制终端成立', '敌方全体降攻可持续提高己方有效生命，是霜狼的后期群体升级；不影响之后新召唤者，减攻到1后冗余。'],
  d_onyx: ['通用群养成立，身份重叠', '全队无条件双维、自己也受益，数值作用清楚；六阶很晚才出现，且会挤压其他养成牌的留场理由。'],
  d_worm: ['规则偏差，暂缓强弱结论', '出售回收投资的角色成立；但低属性平分时强制每人至少1会超出百分比预算，先明确舍入契约再判断强度。'],
};

export function writeReview() {
  const directory = new URL('../../output/value-audit/', import.meta.url);
  const resultsPath = new URL('results.json', directory);
  const result = JSON.parse(readFileSync(resultsPath, 'utf8')) as {
    counts: Record<string, number>; units: Unit[]; seeds: number; gamesPerSkill: number;
    invariants: ReturnType<typeof runInvariants>; campaign: { runs: {skill: number; games: number; cleared: number; livesOnClear: number; turns: number; unfinished: number}[];
      bosses: Record<string, { games: number; wins: number }> };
    review?: unknown; niche?: ReturnType<typeof runNiche>;
  };
  if (result.units.length !== 60 || SHOP_POOL.some((d) => !result.units.some((u) => u.id === d.id))) throw new Error('完整审查要求全部60单位');
  // An older running audit may lack explicit random-coverage instrumentation. Replay the SAME cases,
  // replace their record rather than counting them again as additional statistical evidence.
  if (!result.invariants.coveredUnits) result.invariants = runInvariants(result.invariants.cases);
  const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
  const pp = (x: number) => `${x >= 0 ? '+' : ''}${(100 * x).toFixed(1)}个百分点`;
  const totalBattles = Object.entries(result.counts).filter(([k]) => k.endsWith('Battles')).reduce((s, [, n]) => s + n, 0);
  const affected = result.units.filter((u) => u.contracts.some((c) => c.status === 'fail'));
  const categories = Object.fromEntries(result.units.map((u) => [u.id, { category: VERDICTS[u.id][0], conclusion: VERDICTS[u.id][1] }]));
  const queen = result.units.find((u) => u.id === 'v_queen')!;
  const queenLord = queen.replacements.find((r) => r.alternative === 's_lord')!;
  const unfinished = result.campaign.runs.reduce((s, r) => s + r.unfinished, 0);
  result.review = { totalRecordedBattles: totalBattles, categories, randomCoveredUnits: result.invariants.coveredUnits.length,
    randomCoveredUnitStars: result.invariants.coveredUnitStars.length, knownLimits: [
      '触发/失效计数只跟踪开战初始实例；复生新UID的后继触发不在该辅助计数中，胜负与消融仍使用完整事件。',
      '16固定种子跨情境共用，配对次数不是独立样本量；替换种子集合独立于主消融，但不同情境不独立。',
      '任何一项实验没有覆盖全部可能阵容与所有实战操作；存在价值是当前证据下的设计判断，不是数学证明。',
    ] };
  writeFileSync(resultsPath, JSON.stringify(result, null, 2));
  const head: string[] = ['## 审查结论', '',
    '**60张牌都已逐项审查。多数能解释清楚为什么值得占位；优先风险集中在召唤容量、重复不叠加、星级收益停档和通用成长挤压，而不是卡牌数量不足。**', '',
    `本轮记录 ${totalBattles.toLocaleString()} 场离线战斗调用，包含同身材消融、同阶共同壳替换、固定面板升星、第二副本、生命周期、随机不变量与 ${result.gamesPerSkill * 3} 条自然商店轨迹（${unfinished}条在20回合上限截停）。重复固定随机流不等于同数量独立样本，也不代表人类游玩时长。`, '',
    `行为检查 ${result.counts.contracts} 条，失败 ${result.counts.failedContracts} 条，涉及 ${affected.map((u) => u.name).join('、') || '无'}；随机不变量 ${result.invariants.cases} 组、失败 ${result.invariants.failures.length} 条，实抽覆盖 ${result.invariants.coveredUnits.length}/60 单位、${result.invariants.coveredUnitStars.length}/180 单位星级组合。失败没有通过修改玩法或降低断言来消除。`, '',
    '### 优先处理的设计问题', '',
    `1. **霜冠执政官的强度优先复核**：通用受控环境中原生能力平均边际 ${pp(queen.summary.delta)}，共同壳相对岚影宗主 ${pp(queenLord.delta / queenLord.n)}。这是很强的即时战斗信号，应优先用更接近实战的获取与阵容测试核验；不是把未计入成长的经济牌直接排在其后。`,
    '2. **白鬃猎龙、熔岩巨蜥、驮岩兽、熔岩巨像的容量门槛**：技能正确执行与流派好用是两回事。开战召唤满编失效；非致命受伤召唤还要有空位；巨像死亡常只能召一块。少带正式单位的代价必须由实战收益补偿。',
    '3. **重复与升星不总是线性收益**：方尖碑首张耗尽余金，法老取最高，宗主取最高，执政官最多额外结算2次；执政官1→2星没有技能增益。报告单列第二副本和固定面板升星，避免把复制身材误认成技能升级。',
    '4. **经济牌必须按生命周期衡量**：16张牌走同状态、有/无能力轨迹，比较属性、bank、收入、支出和最终战斗。沙丘额外钱未自动购买战力，方尖碑支出是机会成本；“支出差0”绝不表示买牌、刷新和补给免费。',
    '5. **黑沙巨虫的舍入契约**：一星本体7/7、50%向4名友军平分时，当前实际总发4/4，超过3.5/3.5的百分比预算。至少应明确这是保底赠送还是平分；报告保留失败，不擅自改数值。',
    '6. **熔血巫兽的生命语义**：当前按施法者当前hp取比例，受伤会降低新召唤物生命。该行为已记录，但卡面“自己攻血”不够明确，需决定意图后再把它判为bug或正常取舍。', '',
    '### 每张牌的存在价值判断', '', '| 单位 | 结论 | 为什么值得保留／需要重审 |', '|---|---|---|'];
  for (const u of result.units) head.push(`| ${u.name} | ${VERDICTS[u.id][0]} | ${VERDICTS[u.id][1]} |`);
  head.push('', '这些是机制与实验支持下的设计判断。没有发现足以据此直接删牌的全局严格支配证明；“条件成立”也不等于当前数值已平衡。各牌的可复核数据、反例、星级与替代结果在后文。', '',
    '### 证据边界', '',
    '- 纯战斗比较剥离历史商店成长；高星和固定加成是受控情境，非正常获取保证。自然局另行采样，但bot不识别全部连锁，因此不把出场率或通关槽位当强度因果证据。',
    '- 跨环境共用固定种子，n是配对次数，不是独立样本量。未制造独立置信区间或用显著性包装微小分差。',
    '- “触发次数/失败次数”辅助统计只覆盖开战初始实例，复生新UID的后继不计入；完整战斗胜负和消融包含所有复生、召唤和连锁。',
    '- 相同攻血预算不等于相同机制强度；敌方8种机制等权是实验选择。同阶对比每一对共享条件，不同对不能串成全局排行榜。',
    '- 这轮验证离线规则与策略作用，没有证明人类觉得好玩，也没有替代逐单位视觉/输入验收。', '', '---', '');
  if (result.niche) {
    const addendum = ['### 定向价值验证与留空位代价', '',
      `针对46张战斗牌，另做 ${result.niche.battles.toLocaleString()} 场定向实验：先用2个探索种子在手工组件、位置、星级、成长和12种敌人中选场景，再用另一组16种子、左右两侧验证。支持牌允许跨阶，是成熟组合的“能发挥作用”证据，不能当作前期可达率、环境平均强度或单位排名。`, '',
      '| 低平均收益牌 | 定向留出积分差 | 含义 |', '|---|---:|---|'];
    for (const id of ['n_medic', 'l_knight', 'v_sentinel', 'l_archon']) {
      const row = result.niche.rows.find((r) => r.unit === id)!;
      const d = SHOP_POOL.find((d) => d.id === id)!;
      addendum.push(`| ${d.name} | ${pp(row.holdoutDelta)} | 特定搭配/伤害窗口中能改变胜负，不能因通用壳平均低就判无用 |`);
    }
    addendum.push('', '| 召唤单位 | 初始人数 | 留空位相对补满的平均积分差 | 更好/更差/持平的条件数 |', '|---|---:|---:|---|');
    for (const id of ['m_raptor', 'm_rex', 'm_kujata', 'm_titan']) for (const size of [3, 4]) {
      const rows = result.niche.summonSpace.filter((r) => r.unit === id && r.size === size);
      const n = rows.reduce((s, r) => s + r.n, 0);
      const delta = rows.reduce((s, r) => s + r.delta * r.n, 0) / Math.max(1, n);
      addendum.push(`| ${SHOP_POOL.find((d) => d.id === id)!.name} | ${size} | ${pp(delta)} | ${rows.filter((r) => r.delta > 0).length}/${rows.filter((r) => r.delta < 0).length}/${rows.filter((r) => r.delta === 0).length} |`);
    }
    addendum.push('', '补位者是同档成长的无技能中性身体，不是最优第五人。每个条件内只改变是否补满，跨人数会改变支持数量；因此上表说明容量取舍随环境变化，不把“召出来”直接等同于值得少带人。', '');
    head.splice(head.length - 2, 0, ...addendum);
  }
  const path = new URL('../../../UNIT-VALUE-AUDIT.md', import.meta.url);
  let report = readFileSync(path, 'utf8');
  report = report.replace(/^## 审查结论[\s\S]*?\n---\n/m, '');
  report = report.replace(/^\*\*本牌结论：[^\n]*\n\n/gm, '');
  report = report.replace(/^\*\*定向留出验证\*\*[^\n]*\n\n/gm, '');
  report = report.replace('## 如何阅读', head.join('\n') + '\n## 如何阅读');
  report = report.replaceAll('原生技能平均触发', '初始实例技能平均触发');
  report = report.replaceAll('相对最强即时战斗替代', '本组差值最不利的同阶替换').replaceAll('相对最弱替代', '本组差值最有利的同阶替换');
  for (const u of result.units) {
    const heading = `### ${u.name} · ${u.id}\n\n`;
    report = report.replace(heading, `${heading}**本牌结论：${VERDICTS[u.id][0]}。** ${VERDICTS[u.id][1]}\n\n`);
    const niche = result.niche?.rows.find((r) => r.unit === u.id);
    if (niche) report = report.replace(heading, `${heading}**定向留出验证**：${niche.bestSetup.level}星、成长+${niche.bestSetup.growth}/+${niche.bestSetup.growth}、${niche.bestSetup.position + 1}位、敌方${niche.bestSetup.foe}，技能边际 ${pp(niche.holdoutDelta)}（${niche.n}个左右配对；支持：${niche.bestSetup.support.map((id) => SHOP_POOL.find((d) => d.id === id)?.name ?? id).join('、')}）。这是定向成熟组合，非自然成型或平均强度证明。\n\n`);
  }
  report = report.replace(/^## 召唤物与Boss专用单位附录[\s\S]*$/m, '');
  const enemyRoles: Record<string, string> = {
    e_shield: '厚盾前排，检验破盾与多段攻击；独立挡伤基准。', e_guardian: '天然轮换加退后生盾，检验持续输出和循环拆解。',
    e_golem: '交锋后给队首补盾的支援，检验越过前排处理引擎。', e_skel: '死亡原位补骷髅，检验清场与死亡连锁。',
    e_tomb: '观察友军死亡并补兵，提供亡潮的持续人口。', e_lich: '友军死亡双维成长，让无效清小兵产生代价。',
    e_revenant: '复生二次身体，检验处理队尾复活与死亡次数。', e_thorn: '无额外技能的天然轮换身体，为车轮提供循环成员。',
    e_warlord: '其他友军退后时长攻击，作为车轮的输出终点。', e_nightk: '友军上前时强化，作为车轮的战内增益引擎。',
    e_frostq: '友军退后治疗，检验斩杀速度与持续火力。', e_twin: '天然溅射，检验玩家第二位脆皮与站位保护。',
    e_pyre: '死亡全体伤害，检验格挡、复生及承受群伤。', e_void: '见证玩家阵亡后战内成长，作为终局滚雪球压力；敌方无Owned归属不写入玩家存档。',
  };
  const tokenRoles: Record<string, string> = {
    t_wisp: '残魂小鬼原位亡语身体；连接死亡与召唤，和本体复生争空位。', t_bonelet: '祭师/敌方亡语的固定属性补兵；延长死亡链。',
    t_drakelet: '幼兽蛋bank投资的战斗兑现载体；自身无独立商店价。', t_wolf: '白鬃猎龙/驮岩兽的小型召唤载体；主要价值在身体与召唤监听。',
    t_flame: '熔岩巨蜥的大属性单体召唤；与小兽在数值而非基础技能上区分。', t_statue: '巨像三次召唤的载体；多次监听与剩余空位决定兑现率。',
  };
  const appendix = ['## 召唤物与Boss专用单位附录', '',
    '这20个内容单位不能按3金币商店牌进行同阶替换，单列职责与实际覆盖。6种召唤物的生成、属性和容量由对应召唤牌契约及比较覆盖；14种敌方单位出现在正式Boss轨迹，其技能复用同一引擎分支。出场只证明被测到，不证明各Boss强度已公平。', '',
    '| 单位 | 类型 | 存在价值／测试职责 | 本轮Boss出场槽位 |', '|---|---|---|---:|'];
  for (const d of CARDS.filter((c) => c.token || c.enemy)) {
    let count = 0;
    if (d.enemy) for (const [key, boss] of Object.entries(BOSSES)) {
      const appearances = Object.entries(result.campaign.bosses).filter(([k]) => k.endsWith(`/${key}`)).reduce((s, [, b]) => s + b.games, 0);
      count += appearances * boss.units.filter((id) => id === d.id).length;
    }
    appendix.push(`| ${d.name} | ${d.token ? '召唤物' : 'Boss专用'} | ${d.token ? tokenRoles[d.id] : enemyRoles[d.id]} | ${d.token ? '不适用' : count.toLocaleString()} |`);
  }
  appendix.push('', '## 验证状态与后续', '',
    'TypeScript静态检查通过；规则检查保留黑沙巨虫1项失败，所以 `npm run audit:units` 和 `npm run audit:contracts` 会以退出码1明确提示，不能误称全绿。`npm run audit:contracts` 可快速复查行为；完整情境审计用 `npm run audit:units`。', '',
    '高星/隔离契约检查含人造靶与状态，用于隔离技能，不等于商店可获得阵容。所有正式策略判断须结合卡阶、持有时间、刷新与占位。测试数据不触及真实存档，也没有重写幽灵库。', '');
  report += '\n' + appendix.join('\n');
  writeFileSync(path, report);
  const brief = { totalBattles, counts: result.counts, contractFailures: affected.map((u) => ({ unit: u.name, failures: u.contracts.filter((c) => c.status === 'fail') })),
    campaign: result.campaign.runs.map((r) => ({ skill: r.skill, games: r.games, clearRate: pct(r.cleared / r.games), lives: r.livesOnClear / Math.max(1, r.cleared), turns: r.turns / r.games })),
    combatOnly: result.units.filter((u) => !u.hasEconomicRole).map((u) => ({ unit: u.name, delta: pp(u.summary.delta), best: pp(u.contexts[0].delta),
      sideGap: pp(u.summary.left - u.summary.right), highGrowth: pp(u.stages.find((s) => s.value === 'late')!.delta) })),
    economicOneStarFiveRounds: result.units.flatMap((u) => u.lifecycle.filter((l) => l.level === 1 && l.horizon === 5).map((l) => ({ ...l, name: u.name }))),
    categories };
  writeFileSync(new URL('review-summary.json', directory), JSON.stringify(brief, null, 2));
  console.log(JSON.stringify({ totalBattles, checks: result.counts.contracts, contractFailures: result.counts.failedContracts,
    invariants: result.invariants.failures.length, covered: result.invariants.coveredUnits.length, coveredStars: result.invariants.coveredUnitStars.length, units: result.units.length }));
}

