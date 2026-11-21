// Core game data (classic script for file:// & http:// compatibility, zero emojis)
(function () {
  window.MT = window.MT || {};

  const DRINKS = [
    {
      id: 'rum',
      name: '烈焰朗姆',
      cost: 15,
      color: '#ff6b35',
      glow: '#ffae42',
      pxIcon: 'rum',
      shortTag: '战力+24%',
      desc: '泼一杯烈酒上头：本晚战力 +24%，暴击欲望大增',
      effect: { powerMult: 0.24, critBonus: 18, feeDiscount: 0, loyaltyDelta: 4, revealIntel: false }
    },
    {
      id: 'absinthe',
      name: '迷雾苦艾',
      cost: 20,
      color: '#4de8a8',
      glow: '#7effd4',
      pxIcon: 'absinthe',
      shortTag: '情报+砍价',
      desc: '微醺吐真言：揭露当前副本隐藏情报，且本晚出场费立减 30%',
      effect: { powerMult: 0.08, critBonus: 5, feeDiscount: 0.30, loyaltyDelta: 2, revealIntel: true }
    },
    {
      id: 'holy_ale',
      name: '圣泉麦酒',
      cost: 18,
      color: '#6ecbff',
      glow: '#b4e7ff',
      pxIcon: 'ale',
      shortTag: '稳心态+忠诚',
      desc: '一口回魂：防止划水/背刺，本晚忠诚 +14 且受伤率减半',
      effect: { powerMult: 0.12, critBonus: 0, feeDiscount: 0.10, loyaltyDelta: 14, revealIntel: false, steady: true }
    }
  ];

  const SYNERGIES = [
    {
      id: 'holy_vanguard',
      tag: '圣光',
      need: 2,
      name: '晨曦誓约',
      bonusPower: 22,
      bonusSafe: 14,
      color: '#ffd97d',
      desc: '2名【圣光】同队：战力+22，翻车率大降'
    },
    {
      id: 'shadow_blades',
      tag: '暗影',
      need: 2,
      name: '午夜背刺',
      bonusPower: 26,
      bonusLoot: 0.18,
      color: '#c77dff',
      desc: '2名【暗影】同队：战力+26，额外摸走 18% 战利品'
    },
    {
      id: 'greed_crew',
      tag: '贪财',
      need: 2,
      name: '黑市搜刮团',
      bonusPower: 14,
      bonusLoot: 0.32,
      color: '#ffbe0b',
      desc: '2名【贪财】同队：战利品暴涨 +32%'
    },
    {
      id: 'wild_fury',
      tag: '狂暴',
      need: 2,
      name: '酒后拆家队',
      bonusPower: 34,
      bonusSafe: -6,
      color: '#ff595e',
      desc: '2名【狂暴】同队：战力狂飙 +34'
    },
    {
      id: 'arcane_craft',
      tag: '秘术',
      need: 2,
      name: '奇物共鸣',
      bonusPower: 24,
      bonusLoot: 0.15,
      color: '#56cfe1',
      desc: '2名【秘术】同队：战力+24 且赏金+15%'
    }
  ];

  const MERCENARY_POOL = [
    {
      id: 'iron_anvil', unitId: 'l_shield', name: '铁砧', title: '银盾老兵', role: '前排护卫',
      tags: ['圣光'], power: 34, fee: 22, greed: 0.35, loyalty: 74,
      quirk: { name: '死扛到底', desc: '全队翻车时替队友挡刀，大幅降低减员风险' },
      favDrink: 'holy_ale',
      barks: ['盾牌擦亮了，今晚哪座墓穴要人扛？', '只要酒管够，站最前面算我的。', '别让我跟火药桶老七一队，上次胡子烧光了。'],
      drunkBark: '哈！这杯够劲，今晚我能多扛两下！',
      intelBark: '悄悄说，老板——今晚目标怕重甲硬顶，别光带脆皮！'
    },
    {
      id: 'kyle_blade', unitId: 'l_windblade', name: '凯尔', title: '风刃队长', role: '破阵剑士',
      tags: ['圣光'], power: 38, fee: 28, greed: 0.45, loyalty: 68,
      quirk: { name: '骑士荣誉', desc: '抽成≤40%时下次免费自带士气+15%' },
      favDrink: 'rum',
      barks: ['骑士团发不出饷了，只能来午夜酒馆接私活。', '给个像样的前排，我三剑劈开大门。', '这酒馆的壁炉比皇城暖和多了。'],
      drunkBark: '风刃出鞘！今晚的赏金我志在必得！',
      intelBark: '我在城防处听说了，这单背后有暗哨，最好带个刺客！'
    },
    {
      id: 'aria_sun', unitId: 'l_sunriser', name: '阿莉娅', title: '晨曦圣女', role: '圣光支援',
      tags: ['圣光', '秘术'], power: 31, fee: 26, greed: 0.30, loyalty: 78,
      quirk: { name: '圣光兜底', desc: '哪怕战况惨烈也能奶回一口，胜率下限+10%' },
      favDrink: 'holy_ale',
      barks: ['愿晨曦照亮这间满是酒气的黑店……', '你们这群人每次回来都缺胳膊少腿。', '圣泉麦酒里真的没掺水吗，老板？'],
      drunkBark: '唔……感觉魔力暖洋洋的，我可以多放两道圣光。',
      intelBark: '圣堂占卜显示，今晚的怪物对亡灵/暗影抗性很差！'
    },
    {
      id: 'buck_pirate', unitId: 'n_pirate', name: '黑胡子巴克', title: '独眼船长', role: '掠夺暴徒',
      tags: ['贪财', '狂暴'], power: 40, fee: 30, greed: 0.78, loyalty: 56,
      quirk: { name: '顺手牵羊', desc: '胜利时必多顺走 35 金币，但极讨厌高抽成' },
      favDrink: 'rum',
      barks: ['金币！我要听见宝箱砸在吧台上的声音！', '老板，抽成要是敢过半，我就把你招牌卸了。', '这杯朗姆不够辣，加点火药才对味！'],
      drunkBark: '哈哈哈！老子今晚连Boss的金牙一块撬下来！',
      intelBark: '嘿嘿，我线人说那鬼地方藏着暗格，带我准能多捞一笔！'
    },
    {
      id: 'vera_gambit', unitId: 'n_gambit', name: '红桃薇拉', title: '千术赌徒', role: '奇袭刺客',
      tags: ['贪财', '暗影'], power: 35, fee: 24, greed: 0.72, loyalty: 60,
      quirk: { name: '梭哈暴击', desc: '极易偷走Boss私房钱袋，带来意外巨额赏金' },
      favDrink: 'absinthe',
      barks: ['押大押小？不如押我今晚能不能单杀Boss。', '老板的眼神像极了老千，我喜欢。', '谁输了牌就把明晚的委托费垫上！'],
      drunkBark: '好酒！今晚我手气热得发烫，赏金翻倍不是梦~',
      intelBark: '别声张，我刚赢了雇主随从的底牌——赏金还能再榨一层！'
    },
    {
      id: 'kiri_mist', unitId: 'n_kiri', name: '影牙雾', title: '双刃游侠', role: '暗影刺客',
      tags: ['暗影'], power: 42, fee: 32, greed: 0.50, loyalty: 64,
      quirk: { name: '先手斩首', desc: '开局直接削去Boss 16% 威胁度' },
      favDrink: 'absinthe',
      barks: ['……（默默擦着涂毒的短刃）', '少废话，给坐标，天亮前把头带回来。', '角落这张桌子归我，别让醉鬼靠过来。'],
      drunkBark: '苦艾味不错……今晚我替你多探一条退路。',
      intelBark: '我刚踩完点回来，那Boss守卫换班有空档，胜率能涨一截。'
    },
    {
      id: 'crimson_fox', unitId: 's_fox', name: '赤尾', title: '灯笼狐灵', role: '幻术游侠',
      tags: ['秘术', '贪财'], power: 36, fee: 25, greed: 0.62, loyalty: 66,
      quirk: { name: '鬼火引财', desc: '极易在副本里触发隐藏宝箱奇遇' },
      favDrink: 'absinthe',
      barks: ['呜呼~ 这家酒馆的紫金灯笼真好看呀！', '老板请我喝一杯，我就告诉你宝库机关在哪~', '人类的金币亮晶晶的，我也想攒一窝！'],
      drunkBark: '尾巴飘起来啦~ 今晚一定给你叼个大宝箱回来！',
      intelBark: '灯笼映出凶兆啦，不过只要阵容对了，里头藏着稀世古董哦！'
    },
    {
      id: 'baiyu_fan', unitId: 's_backstab', name: '白羽', title: '折扇暗杀者', role: '破甲刺客',
      tags: ['暗影', '秘术'], power: 44, fee: 35, greed: 0.52, loyalty: 62,
      quirk: { name: '风雅一击', desc: '对高护甲/守卫类Boss额外造成压制' },
      favDrink: 'absinthe',
      barks: ['折扇一合，万籁俱寂。老板，有高价单子吗？', '粗鲁的酒客太多了，幸好这杯酒还算体面。', '出场费可以谈，但我的面子不能打折。'],
      drunkBark: '微醺正合剑意，今晚便为你斩落首级。',
      intelBark: '这单的雇主隐瞒了真实战力，我已替你摸清了对方底细。'
    },
    {
      id: 'lilith_dance', unitId: 'a_cult', name: '莉莉丝', title: '暗夜舞姬', role: '吸血影舞',
      tags: ['暗影'], power: 45, fee: 36, greed: 0.58, loyalty: 60,
      quirk: { name: '血影汲取', desc: '越打越猛，连战高难副本毫无疲态' },
      favDrink: 'rum',
      barks: ['午夜才刚刚开始，老板舍得让我空坐着？', '血腥味混着朗姆酒，真是迷人的夜晚。', '给我挑个最危险的委托，软柿子没意思。'],
      drunkBark: '咯咯……今夜谁挡路，就拿谁来助兴吧。',
      intelBark: '暗影低语告诉我，今晚的Boss其实外强中干呢~'
    },
    {
      id: 'mord_blood', unitId: 'a_bloodmoon', name: '莫德', title: '血月祭司', role: '诅咒术士',
      tags: ['暗影', '秘术'], power: 41, fee: 31, greed: 0.48, loyalty: 63,
      quirk: { name: '血月契约', desc: '全队暗影/秘术队友战力额外+12%' },
      favDrink: 'absinthe',
      barks: ['血月升起之时，委托的价码也该翻倍。', '别碰我的法杖，上面沾着昨晚的诅咒。', '老板，你这家酒馆的风水很适合招魂啊。'],
      drunkBark: '好浓的苦艾……血月之力在沸腾！',
      intelBark: '我用骨骰卜了一卦：今晚必有暴击良机，放手压上去！'
    },
    {
      id: 'seven_boom', unitId: 'n_grenadier', name: '火药桶老七', title: '爆破狂魔', role: '范围爆破',
      tags: ['狂暴'], power: 46, fee: 29, greed: 0.42, loyalty: 65,
      quirk: { name: '艺术就是爆炸', desc: '超高爆发输出，专炸硬骨头Boss' },
      favDrink: 'rum',
      barks: ['老板！借壁炉点根引线行不行？', '没有一颗黑火药解决不了的Boss，如果有就两颗！', '铁砧那老古董又躲着我走，切！'],
      drunkBark: '烈焰朗姆配黑火药！！今晚把副本掀上天！！',
      intelBark: '哈哈！那地方全是木头梁柱，一把火就能烧掉它半条命！'
    },
    {
      id: 'susan_medic', unitId: 'n_medic', name: '苏珊', title: '草药秘医', role: '炼金奶妈',
      tags: ['秘术'], power: 28, fee: 20, greed: 0.28, loyalty: 82,
      quirk: { name: '急救药箱', desc: '物美价廉，全队受伤归来也能免费治好' },
      favDrink: 'holy_ale',
      barks: ['出场费便宜，但绷带和草药得按市场价算哦。', '昨晚那帮家伙回来个个鼻青脸肿的……', '老板自己也别熬太晚，来点薄荷茶？'],
      drunkBark: '哇，这麦酒比我的草药汤好喝一百倍！',
      intelBark: '我从伤员伤口里验出了毒囊——今晚带解毒方案稳赢！'
    },
    {
      id: 'lady_locke', unitId: 'n_locke', name: '洛克夫人', title: '黑市军火商', role: '统帅增益',
      tags: ['贪财', '圣光'], power: 39, fee: 34, greed: 0.65, loyalty: 67,
      quirk: { name: '全员换装', desc: '同队另外两名佣兵战力各提升 +15%' },
      favDrink: 'holy_ale',
      barks: ['好经纪人卖的不是人头，是溢价。', '这批精钢武器刚到货，今晚谁带队？', '合作愉快，老板——只要分账体面，我们能赚翻。'],
      drunkBark: '品味不错。今晚这单，我免费借给队员两把好刀。',
      intelBark: '业内消息：这笔委托的金主急着要货，完美通关给小费！'
    },
    {
      id: 'grey_fenrir', unitId: 'v_fenrir', name: '格雷', title: '霜狼战主', role: '狂暴重装',
      tags: ['狂暴'], power: 49, fee: 38, greed: 0.44, loyalty: 66,
      quirk: { name: '孤狼怒嚎', desc: '单挑Boss战力极高，但最讨厌被拖欠工钱' },
      favDrink: 'rum',
      barks: ['北境的风雪比这儿冷十倍，给我最烈的酒！', '弱者留在酒桌，强者今晚跟我撕碎猎物。', '这把战斧已经三天没见血了。'],
      drunkBark: '嗷呜！！酒劲上来了，今晚谁也拦不住我！',
      intelBark: '我闻到了猎物的血味——那头怪物左翼有旧伤！'
    }
  ];

  const CONTRACTS = [
    {
      id: 'c_road', tier: 1, name: '废弃商道清剿', client: '商会老莫',
      bossUnitId: 'e_warlord', bossName: '猩红掠夺者头目',
      threat: 82, baseReward: 165, weakTag: '圣光',
      intelHint: '掠夺者怕正面重甲冲锋，带【圣光】佣兵战力 +24！',
      flavor: '商队马车被劫在黑松林，夺回货物按市价重赏。',
      relicDrop: '镀金商队徽章 (+25G)'
    },
    {
      id: 'c_grave', tier: 1, name: '雾锁乱葬岗', client: '守墓人协会',
      bossUnitId: 'e_lich', bossName: '白骨收割者',
      threat: 98, baseReward: 210, weakTag: '秘术',
      intelHint: '亡灵结界最怕【秘术】破除，带【秘术】战力 +24！',
      flavor: '午夜钟声响起后坟头蹦迪，雇主只想睡个安稳觉。',
      relicDrop: '幽蓝魂灯 (+35G)'
    },
    {
      id: 'c_cellar', tier: 2, name: '沉没地下酒窖', client: '皇室侍酒师',
      bossUnitId: 'a_deep', bossName: '深渊触手魔',
      threat: 118, baseReward: 265, weakTag: '暗影',
      intelHint: '触手魔视野极差，【暗影】刺客背刺战力 +24！',
      flavor: '百年陈酿被深渊怪物霸占，活着搬出来就能发大财。',
      relicDrop: '百年紫晶佳酿 (+45G)'
    },
    {
      id: 'c_vault', tier: 2, name: '黑铁失落金库', client: '神秘蒙面人',
      bossUnitId: 'e_guardian', bossName: '黑铁遗迹守卫',
      threat: 136, baseReward: 325, weakTag: '贪财',
      intelHint: '金库暗格极多，带【贪财】战力 +24 且赏金大涨！',
      flavor: '别问金库原来是谁的，撬开大门里面的黄金大家分。',
      relicDrop: '古帝国金砖 (+60G)'
    },
    {
      id: 'c_sand', tier: 3, name: '诅咒黑沙堡', client: '流亡王子',
      bossUnitId: 'd_howler', bossName: '噬魂沙暴领主',
      threat: 158, baseReward: 410, weakTag: '狂暴',
      intelHint: '沙暴护盾必须用【狂暴】暴力轰碎，战力 +24！',
      flavor: '沙暴里藏着王室冠冕，敢闯进去的都是狠角色。',
      relicDrop: '星辰王冠碎片 (+80G)'
    },
    {
      id: 'c_rift', tier: 3, name: '午夜深渊裂隙', client: '黑塔议会',
      bossUnitId: 'm_rex', bossName: '熔核深渊巨兽',
      threat: 185, baseReward: 520, weakTag: '秘术',
      intelHint: '裂隙核心极不稳定，【秘术】压制可稳拿头奖！',
      flavor: '年度最高悬赏！封锁裂隙，你的酒馆将名震黑市。',
      relicDrop: '深渊龙心晶核 (+110G)'
    }
  ];

  const TAVERN_UPGRADES = [
    { id: 'hearth', name: '熔岩魔晶壁炉', cost: 120, pxIcon: 'rum', desc: '壁炉升级紫焰：每晚来访佣兵 +1 名，且初始忠诚 +4' },
    { id: 'cellar', name: '暗夜橡木酒桶', cost: 150, pxIcon: 'ale', desc: '所有特调酒水半价，且酒水战力加成额外 +8%' },
    { id: 'spy_net', name: '黑市情报暗网', cost: 180, pxIcon: 'eye', desc: '悬赏单自动揭露 Boss 弱点，且所有委托赏金 +15%' },
    { id: 'vip_booth', name: '紫金贵宾包厢', cost: 220, pxIcon: 'star', desc: '声望获取 +30%，并挂上紫金挂毯吸引王牌佣兵' }
  ];

  const MORNING_HEADLINES = [
    '【黑市早报】昨夜城东酒馆被醉汉拆了屋顶，佣兵们纷纷改道来你这儿喝酒！',
    '【商会快讯】深渊魔晶价格暴涨，今晚悬赏单的油水格外肥厚。',
    '【八卦头条】风刃骑士团再次欠薪，多名精锐战士正蹲在你门口等活干。',
    '【酒馆密闻】听说隔壁黑店抽成高达七成，惨遭海盗团联名抵制！',
    '【气象预警】今晚午夜有紫雷暴雨，正是适合围炉喝酒、密谋大单的好天气。',
    '【黑塔通告】高阶魔物活跃度上升，建议多给前排灌两杯烈焰朗姆再出门。'
  ];

  window.MT.DATA = { DRINKS, SYNERGIES, MERCENARY_POOL, CONTRACTS, TAVERN_UPGRADES, MORNING_HEADLINES };
})();
