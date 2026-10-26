// 静态数据：物品、猫猫、阵营、行情、升级、成就
export const CATS = {
  player: { name: '橘子', title: '店主' },
  landlord: { name: '胖大海', title: '房东', fac: null },
  rival: { name: '三花姐', title: '收货商', fac: null },
  joe: { name: '乔伊', title: '杂货商', fac: null },
  noble: { name: '珍珠夫人', title: '贵妇', fac: 'elite' },
  gent: { name: '布丁先生', title: '绅士', fac: 'elite' },
  worker: { name: '阿狸', title: '工人', fac: 'folk' },
  scav: { name: '黑白', title: '拾荒者', fac: 'folk' },
  thief: { name: '灰灰', title: '流浪猫', fac: 'gang' },
  police: { name: '暹罗警长', title: '治安官', fac: 'law' },
  rebel: { name: '夜影', title: '野猫帮', fac: 'gang' },
  doctor: { name: '折耳博士', title: '学者', fac: 'folk' },
  granny: { name: '缅因奶奶', title: '老住户', fac: 'folk' },
  kitten: { name: '小豆', title: '小朋友', fac: 'folk' },
  trader: { name: '沙丘', title: '行商', fac: null },
  lady: { name: '雪绒小姐', title: '没落贵族', fac: 'elite' },
  robot: { name: '小七', title: '送货机器人', fac: null },
  mechanic: { name: '螺帽', title: '维修师', fac: 'folk', tier: 2, portrait: 'mechanic', intro: '修东西先听声音，买零件还得看你开价。' },
  fisher: { name: '海盐', title: '码头渔猫', fac: 'folk', tier: 2, portrait: 'fisher', intro: '赶完早潮就来，船上的货都装在这筐里。' },
  chef: { name: '锅巴', title: '夜市厨师', fac: 'folk', tier: 2, portrait: 'chef', intro: '夜市的锅还热着，我来补食材，也换些用不上的货。' },
  musician: { name: '蓝调', title: '驻唱乐手', fac: 'folk', tier: 3, portrait: 'musician', intro: '散场后总有几张唱片，想换点明晚能用上的东西。' },
  courier: { name: '风铃', title: '星港快递员', fac: 'law', tier: 3, portrait: 'courier', intro: '整天跑码头，壶要保温，工具得趁手，价钱也得合适。' },
  archivist: { name: '墨卷', title: '档案馆员', fac: 'elite', tier: 3, portrait: 'archivist', intro: '旧纸和旧器物各有来历，先让我仔细看看。' },
  jeweler: { name: '琥珀', title: '珠宝匠', fac: 'elite', tier: 4, portrait: 'jeweler', intro: '原石看料，首饰看工，光听故事可不够。' },
  captain: { name: '北斗', title: '货船船长', fac: 'law', tier: 4, portrait: 'captain', intro: '启航前来补齐用品，航海仪器和一顿好饭都不能少。' },
};

export const FACS = {
  elite: { name: '上流', color: '#b48be8' },
  folk: { name: '街坊', color: '#6cc58a' },
  law: { name: '治安局', color: '#5aa7e8' },
  gang: { name: '野猫帮', color: '#e86a5a' },
};

export const CATS_CAT = {
  food: '食物', drink: '饮品', material: '材料', tech: '机械', treasure: '珍宝', toy: '玩具',
};

// v=基础价；ban=违禁品
export const ITEMS = {
  dryfish: { name: '小鱼干', cat: 'food', v: 8 },
  can: { name: '猫罐头', cat: 'food', v: 14 },
  stick: { name: '猫条', cat: 'food', v: 18 },
  fish: { name: '鲜鱼', cat: 'food', v: 36 },
  fry: { name: '鱼苗', cat: 'food', v: 12 },
  tuna: { name: '金枪鱼罐', cat: 'food', v: 55 },
  water: { name: '水', cat: 'drink', v: 20 },
  nipwine: { name: '猫薄荷酒', cat: 'drink', v: 95, ban: true },
  catnip: { name: '猫薄荷', cat: 'material', v: 16 },
  scrap: { name: '废铁', cat: 'material', v: 6 },
  ingot: { name: '铁锭', cat: 'material', v: 38 },
  battery: { name: '电池', cat: 'tech', v: 26 },
  radio: { name: '旧收音机', cat: 'tech', v: 62 },
  claw: { name: '机械爪', cat: 'tech', v: 95 },
  chip: { name: '黑市芯片', cat: 'tech', v: 130, ban: true },
  holo: { name: '全息投影仪', cat: 'tech', v: 170 },
  bell: { name: '金铃铛', cat: 'treasure', v: 110 },
  watch: { name: '怀表', cat: 'treasure', v: 150 },
  pearl: { name: '珍珠项圈', cat: 'treasure', v: 210 },
  ticket: { name: '星舰船票', cat: 'treasure', v: 280 },
  painting: { name: '猫爵士肖像', cat: 'treasure', v: 420 },
  yarn: { name: '毛线球', cat: 'toy', v: 20 },
  wand: { name: '逗猫棒', cat: 'toy', v: 30 },
  mouse: { name: '发条老鼠', cat: 'toy', v: 46 },
  laser: { name: '激光笔', cat: 'toy', v: 58 },
  // 后续货品按日数与完成交易数开放；价格为本地适配，图片按稳定货物ID独立加载。
  smokedfish: { name: '烟熏鱼', cat: 'food', v: 66, tier: 2, d: '鲜鱼经烟熏炉加工，可供夜市备餐。' },
  fishoil: { name: '鱼油', cat: 'material', v: 24, tier: 2, d: '渔船与旧工具的保养用料。' },
  driedshrimp: { name: '虾米', cat: 'food', v: 22, tier: 2, d: '夜市小摊常备的干货。' },
  spice: { name: '香料包', cat: 'food', v: 14, tier: 2, d: '炖鱼和热汤的调味食材。' },
  copperwire: { name: '铜线卷', cat: 'material', v: 18, tier: 2, d: '维修店收用的接线材料。' },
  sparegear: { name: '备用齿轮', cat: 'material', v: 32, tier: 2, d: '钟表与旧机械的替换零件。' },
  toolbox: { name: '便携工具箱', cat: 'tech', v: 74, tier: 2, d: '维修师和跑码头的猫常来找。' },
  thermos: { name: '保温热饮', cat: 'drink', v: 42, tier: 2, d: '适合值夜和长途跑腿时饮用。' },
  brokenconsole: { name: '故障游戏机', cat: 'tech', v: 48, tier: 3, d: '修复台的原料，需两晚修成游戏机。' },
  console: { name: '游戏机', cat: 'tech', v: 142, tier: 3, d: '可由故障游戏机修复，供休息室娱乐。' },
  speaker: { name: '便携音箱', cat: 'tech', v: 78, tier: 3, d: '街头演出常用的小设备。' },
  musicbox: { name: '八音盒', cat: 'toy', v: 96, tier: 3, d: '乐手挑选旋律，街坊挑选礼物。' },
  record: { name: '旧唱片', cat: 'treasure', v: 68, tier: 3, d: '驻唱乐手与收藏客交换的旧物。' },
  cocoa: { name: '热可可', cat: 'drink', v: 32, tier: 3, d: '散场和夜班后的热饮，不含薄荷酒。' },
  canvas: { name: '帆布卷', cat: 'material', v: 28, tier: 3, d: '舞台布景和档案包裹的用料。' },
  lenskit: { name: '光学镜组', cat: 'tech', v: 88, tier: 3, d: '档案馆观察旧物细节时使用。' },
  roughgem: { name: '宝石原石', cat: 'material', v: 84, tier: 4, d: '宝石台的原料，需两晚制成宝石吊坠。' },
  pendant: { name: '宝石吊坠', cat: 'treasure', v: 220, tier: 4, d: '原石加工成的首饰，珠宝匠有收购需求。' },
  starstamp: { name: '星港纪念邮票', cat: 'treasure', v: 54, tier: 4, d: '价位亲民的星港收藏品。' },
  chart: { name: '旧航海图', cat: 'treasure', v: 112, tier: 4, d: '船长备航与档案馆收藏都会用到。' },
  sextant: { name: '六分仪', cat: 'tech', v: 176, tier: 4, d: '船上用于观测定位的仪器。' },
  teacup: { name: '瓷茶杯', cat: 'treasure', v: 72, tier: 4, d: '街坊茶会与收藏柜都收得下的小件。' },
  medal: { name: '纪念勋章', cat: 'treasure', v: 138, tier: 4, d: '旧船员纪念物，需留意印记与做工。' },
  starcompass: { name: '星图罗盘', cat: 'tech', v: 245, tier: 4, d: '远航船只寻找的精密导航设备。' },
};

// 水分六档：v 倍率作用于 water 的基础价；eye=肉眼能看出来
export const WG = [
  { n: '水沟水', m: 0.15, eye: true },
  { n: '铁锈水', m: 0.25, eye: true },
  { n: '怪味水', m: 0.4 },
  { n: '白开水', m: 1 },
  { n: '山泉水', m: 2.2 },
  { n: '纯净水', m: 4 },
];

// 灯牌：sell=卖家占比；thief/water=对应客人权重
export const SIGNS = {
  warm: { name: '迎客灯', d: '买家多一些', sell: 0.36 },
  neon: { name: '霓虹「收」', d: '卖家排着队来', sell: 0.68 },
  dark: { name: '暗灯', d: '流浪猫来销赃，警长也更爱来', sell: 0.6, thief: 5, police: 0.06, need: 'dark' },
  wsign: { name: '水牌', d: '卖水的猫找上门', sell: 0.6, water: 4, need: 'wsign' },
};

// 伪猫：三处观察，真猫和伪猫的说法
export const OBS = [
  { n: '眼睛', ok: ['圆溜溜，水汪汪的', '眯成一条缝，很放松', '瞳孔随光线一缩一放'], bad: '瞳孔里闪过一行绿色代码' },
  { n: '胡须', ok: ['随呼吸一抖一抖', '沾着一点鱼干碎屑', '有一根翘起来了'], bad: '胡须纹丝不动，像金属丝' },
  { n: '呼噜', ok: ['咕噜咕噜，很治愈', '打了个小哈欠', '尾巴尖在轻轻甩'], bad: '呼噜声里夹着「滋滋」电流声' },
];

// 鉴定的三处细节，按品类给文案
export const SPOTS = {
  food: ['包装', '气味', '日期'],
  drink: ['颜色', '气味', '试纸'],
  material: ['纹理', '重量', '断口'],
  tech: ['铭牌', '电路', '外壳'],
  treasure: ['印记', '材质', '做工'],
  toy: ['缝线', '材质', '标签'],
};

// 卖家：品种 → 可能带来的货；fake=赝品率 stolen=赃物率 ask/res=开价/底价倍率
export const SELLERS = {
  scav: { pool: ['scrap', 'scrap', 'scrap', 'water', 'water', 'battery', 'radio', 'claw'], fake: 0, stolen: 0, ask: [1.15, 1.45], res: [0.55, 0.8] },
  granny: { pool: ['yarn', 'dryfish', 'can', 'stick', 'wand', 'catnip'], fake: 0, stolen: 0, ask: [1.05, 1.3], res: [0.6, 0.85] },
  worker: { pool: ['catnip', 'fry', 'ingot', 'can', 'battery', 'scrap', 'water'], fake: 0.05, stolen: 0.05, ask: [1.1, 1.4], res: [0.6, 0.82] },
  gent: { pool: ['watch', 'bell', 'painting', 'pearl', 'holo'], fake: 0.3, stolen: 0.05, ask: [1.2, 1.55], res: [0.62, 0.85] },
  trader: { pool: ['tuna', 'mouse', 'laser', 'watch', 'bell', 'radio', 'holo', 'claw', 'stick'], fake: 0.35, stolen: 0.15, ask: [1.2, 1.6], res: [0.55, 0.8] },
  thief: { pool: ['watch', 'bell', 'holo', 'claw', 'laser', 'pearl', 'radio', 'mouse'], fake: 0.1, stolen: 1, ask: [0.55, 0.8], res: [0.3, 0.45], pat: 2 },
  doctor: { pool: ['battery', 'chip', 'radio', 'water', 'claw'], fake: 0.05, stolen: 0, ask: [1.1, 1.4], res: [0.62, 0.85] },
  rebel: { pool: ['chip', 'nipwine', 'laser', 'claw'], fake: 0.15, stolen: 0.3, ask: [1.0, 1.3], res: [0.5, 0.72] },
  mechanic: { pool: ['copperwire', 'copperwire', 'sparegear', 'toolbox', 'battery', 'brokenconsole', 'console'], fake: 0.12, stolen: 0.02, ask: [1.05, 1.3], res: [0.58, 0.8] },
  fisher: { pool: ['fish', 'fish', 'fry', 'fishoil', 'driedshrimp', 'thermos'], fake: 0.03, stolen: 0, ask: [1.0, 1.25], res: [0.58, 0.8] },
  chef: { pool: ['spice', 'spice', 'driedshrimp', 'smokedfish', 'thermos', 'cocoa'], fake: 0.06, stolen: 0, ask: [1.05, 1.3], res: [0.62, 0.84] },
  musician: { pool: ['record', 'record', 'speaker', 'musicbox', 'canvas', 'radio'], fake: 0.18, stolen: 0.03, ask: [1.1, 1.45], res: [0.56, 0.8] },
  courier: { pool: ['toolbox', 'thermos', 'speaker', 'copperwire', 'console', 'starstamp'], fake: 0.08, stolen: 0.04, ask: [1.05, 1.35], res: [0.58, 0.82] },
  archivist: { pool: ['canvas', 'lenskit', 'record', 'chart', 'starstamp', 'medal'], fake: 0.1, stolen: 0, ask: [1.15, 1.45], res: [0.65, 0.85] },
  jeweler: { pool: ['roughgem', 'roughgem', 'pendant', 'teacup', 'pearl', 'bell'], fake: 0.22, stolen: 0.02, ask: [1.15, 1.5], res: [0.6, 0.83] },
  captain: { pool: ['chart', 'sextant', 'starcompass', 'medal', 'tuna', 'fishoil'], fake: 0.12, stolen: 0.04, ask: [1.1, 1.4], res: [0.62, 0.84] },
};

// 买家：想要的品类；eye=识破赝品概率 rich=最高出价倍率
export const BUYERS = {
  noble: { wants: ['treasure', 'treasure', 'toy', 'drink'], eye: 0.75, rich: [1.25, 1.6], minG: 4 },
  gent: { wants: ['treasure', 'tech', 'drink'], eye: 0.55, rich: [1.15, 1.4], minG: 4 },
  worker: { wants: ['food', 'drink', 'material'], eye: 0.25, rich: [1.0, 1.2] },
  granny: { wants: ['food', 'toy', 'drink'], eye: 0.1, rich: [0.95, 1.15] },
  kitten: { wants: ['toy', 'food'], eye: 0, rich: [0.8, 1.0] },
  doctor: { wants: ['tech', 'drink', 'material'], eye: 0.7, rich: [1.1, 1.35] },
  rebel: { wants: ['ban', 'tech'], eye: 0.4, rich: [1.2, 1.5] },
  trader: { wants: ['treasure', 'tech', 'toy', 'food'], eye: 0.85, rich: [1.05, 1.25] },
  mechanic: { wants: ['material', 'material', 'tech', 'toy'], eye: 0.7, rich: [1.05, 1.25] },
  fisher: { wants: ['food', 'drink', 'material'], eye: 0.35, rich: [0.95, 1.2] },
  chef: { wants: ['food', 'food', 'drink'], eye: 0.65, rich: [1.05, 1.3] },
  musician: { wants: ['toy', 'tech', 'treasure', 'drink'], eye: 0.45, rich: [1.0, 1.3] },
  courier: { wants: ['drink', 'tech', 'toy'], eye: 0.5, rich: [1.0, 1.25] },
  archivist: { wants: ['treasure', 'material', 'tech'], eye: 0.85, rich: [1.1, 1.4] },
  jeweler: { wants: ['treasure', 'treasure', 'material'], eye: 0.9, rich: [1.2, 1.5] },
  captain: { wants: ['tech', 'food', 'treasure'], eye: 0.75, rich: [1.15, 1.45] },
};

export const RENT = [100, 160, 240, 330, 440, 570, 720, 900];
export const rentOf = (week) => (week <= RENT.length ? RENT[week - 1] : RENT[RENT.length - 1] + (week - RENT.length) * 200);
export const BUYOUT = 6000;
export const DAYS_PER_WEEK = 5;
export const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五'];

// 每日行情：mul 作用于品类或单品
export const NEWS = [
  { id: 'calm', t: '风平浪静', d: '今天行情平稳', mul: {} },
  { id: 'drought', t: '水管爆了', d: '水价大涨', mul: { water: 1.9 } },
  { id: 'ball', t: '星港舞会', d: '珍宝需求旺盛', mul: { treasure: 1.4 } },
  { id: 'fishrun', t: '鱼汛来了', d: '鱼类跌价', mul: { fish: 0.6, fry: 0.6, tuna: 0.8 } },
  { id: 'tech', t: '机械博览会', d: '机械货抢手', mul: { tech: 1.4 } },
  { id: 'steel', t: '船坞开工', d: '材料大涨', mul: { material: 1.5 } },
  { id: 'kids', t: '儿童节', d: '玩具热卖', mul: { toy: 1.5 } },
  { id: 'crack', t: '治安严打', d: '查店概率大增', mul: { ban: 1.3 }, police: 2.5 },
  { id: 'famine', t: '补给船晚点', d: '食物涨价', mul: { food: 1.45 } },
  { id: 'party', t: '野猫狂欢夜', d: '违禁品身价翻倍', mul: { ban: 1.9 } },
  { id: 'glut', t: '旧货大甩卖', d: '机械与玩具降价', mul: { tech: 0.75, toy: 0.75 } },
  { id: 'nightmarket', tier: 2, t: '夜市加摊', d: '烟熏鱼与调味干货走俏', mul: { smokedfish: 1.4, driedshrimp: 1.25, spice: 1.3 } },
  { id: 'repairfair', tier: 2, t: '街坊维修日', d: '线材和齿轮需求增加', mul: { copperwire: 1.4, sparegear: 1.35, toolbox: 1.2 } },
  { id: 'encore', tier: 3, t: '星港返场演出', d: '音箱、唱片与八音盒热卖', mul: { speaker: 1.35, record: 1.4, musicbox: 1.3 } },
  { id: 'fleet', tier: 4, t: '远航船队补给', d: '船队寻找航图与导航设备', mul: { chart: 1.4, sextant: 1.35, starcompass: 1.3, fish: 1.15 } },
];

// 拾荒箱：hint 是箱子上的提示
export const CRATES = [
  { id: 'heavy', name: '沉甸甸的箱子', pool: [['scrap', 3], ['scrap', 2], ['ingot', 1], ['battery', 1], ['claw', 1], ['copperwire', 2], ['sparegear', 1], ['toolbox', 1], ['brokenconsole', 1], ['speaker', 1], ['lenskit', 1], ['roughgem', 1], ['sextant', 1], ['starcompass', 1]] },
  { id: 'wet', name: '湿漉漉的箱子', pool: [['water', 3], ['water', 2], ['fry', 2], ['fish', 1], ['water', 2], ['fishoil', 1], ['thermos', 1]] },
  { id: 'smell', name: '香喷喷的箱子', pool: [['can', 2], ['dryfish', 3], ['stick', 2], ['catnip', 2], ['tuna', 1], ['smokedfish', 1], ['driedshrimp', 2], ['spice', 2], ['cocoa', 1]] },
  { id: 'jingle', name: '叮当响的箱子', pool: [['mouse', 1], ['laser', 1], ['radio', 1], ['wand', 2], ['bell', 1], ['musicbox', 1], ['teacup', 1], ['medal', 1]] },
  { id: 'myst', name: '神秘的箱子', pool: [['yarn', 1], ['water', 1], ['scrap', 1], ['holo', 1], ['pearl', 1], ['painting', 1], ['record', 1], ['canvas', 2], ['console', 1], ['starstamp', 1], ['chart', 1], ['pendant', 1]], rare: ['holo', 'pearl', 'painting', 'console', 'chart', 'pendant'] },
];

// 作坊机器：days=需要几晚；cap=一批最多几份
export const MACHINES = {
  furnace: { name: '熔炉', icon: 'ingot', in: ['scrap', 3], out: ['ingot', 1], days: 1, cap: 2 },
  purifier: { name: '净水器', icon: 'water', in: ['water', 1], out: ['water', 1], days: 1, cap: 3 },
  tank: { name: '鱼缸', icon: 'fish', in: ['fry', 1], out: ['fish', 1], days: 2, cap: 2 },
  brewery: { name: '酿酒桶', icon: 'nipwine', in: ['catnip', 2], out: ['nipwine', 1], days: 2, cap: 2, water: true },
  labeler: { name: '贴标台', icon: 'tuna', in: ['can', 1], out: ['tuna', 1, 'fake'], days: 1, cap: 3 },
  smoker: { name: '烟熏炉', icon: 'dryfish', tier: 2, in: ['fish', 1], out: ['smokedfish', 1], days: 1, cap: 2 },
  repairbench: { name: '修复台', icon: 'radio', tier: 3, in: ['brokenconsole', 1], out: ['console', 1], days: 2, cap: 1 },
  gemtable: { name: '宝石台', icon: 'pearl', tier: 4, in: ['roughgem', 1], out: ['pendant', 1], days: 2, cap: 1 },
};

// 乔伊小铺
export const UPGRADES = [
  { id: 'shelf1', name: '加宽货架', d: '货架 +3 格', cost: 120 },
  { id: 'shelf2', name: '双层货架', d: '货架再 +3 格', cost: 280, need: 'shelf1' },
  { id: 'hide1', name: '地板暗格', d: '2 格暗格，查店查不到', cost: 150 },
  { id: 'hide2', name: '墙后密室', d: '暗格再 +2 格', cost: 260, need: 'hide1' },
  { id: 'lens', name: '黄铜放大镜', d: '每位客人第一次鉴定不耗耐心', cost: 160 },
  { id: 'guide', name: '行情手册', d: '估价范围更准', cost: 140 },
  { id: 'lucky', name: '招财猫', d: '每天多来一位客人', cost: 220 },
  { id: 'purifier', name: '净水器', d: '原水升2档，需1晚；附10点滤芯', cost: 100, machine: true },
  { id: 'filter', name: '备用滤芯', d: '即买即补；水沟水/铁锈水每份3点，其余可净化水1点', cost: 30, repeat: true, need: 'purifier' },
  { id: 'uv', name: '紫外线灯', d: '上限升至纯净水；山泉再净化1晚可得', cost: 180, need: 'purifier' },
  { id: 'dew', name: '集露器', d: '每晚怪味水×1，可净化；货架需空1格', cost: 110 },
  { id: 'fridge', name: '制冰盒', d: '免费加冰；成交后吸引明日饮品客', cost: 80 },
  { id: 'dark', name: '暗灯', d: '灯牌：引来销赃的流浪猫', cost: 60 },
  { id: 'wsign', name: '水牌', d: '灯牌：引来卖水的猫', cost: 60 },
  { id: 'tank', name: '鱼缸', d: '鱼苗 → 鲜鱼（2晚）', cost: 140, machine: true },
  { id: 'brewery', name: '酿酒桶', d: '2猫薄荷＋1份白开水或山泉水 → 1猫薄荷酒（2晚）；纯净水不可用', cost: 160, machine: true },
  { id: 'labeler', name: '贴标台', d: '罐头贴成「金枪鱼罐」，水贴「纯净水」标签…', cost: 120, machine: true },
  { id: 'lawfee', name: '治安打点', d: '治安局好感 +2', cost: 90, repeat: true },
  { id: 'gangfee', name: '野猫会费', d: '野猫帮好感 +2', cost: 90, repeat: true },
  { id: 'smoker', name: '烟熏炉', d: '鲜鱼 → 烟熏鱼（1晚，每批最多2份）', cost: 120, machine: true, gate: 'workshop', tier: 2 },
  { id: 'repairbench', name: '修复台', d: '故障游戏机 → 游戏机（2晚）', cost: 240, machine: true, gate: 'premium', tier: 3 },
  { id: 'gemtable', name: '宝石台', d: '宝石原石 → 宝石吊坠（2晚）', cost: 340, machine: true, gate: 'premium', tier: 4 },
];

export const ACHS = [
  { id: 'first_buy', name: '开张大吉', d: '第一次收货' },
  { id: 'first_sell', name: '第一桶鱼', d: '第一次卖货' },
  { id: 'spot_fake', name: '火眼金睛', d: '鉴定出一件赝品' },
  { id: 'spot_fake5', name: '鉴定大师', d: '累计鉴定出 5 件赝品' },
  { id: 'sell_fake', name: '猫猫奸商', d: '把赝品卖了出去' },
  { id: 'haggle', name: '砍价高手', d: '以开价六成以下收到货' },
  { id: 'kind', name: '好心肠', d: '便宜卖给小豆' },
  { id: 'week1', name: '撑过第一周', d: '交上第一笔房租' },
  { id: 'week4', name: '老字号', d: '交上第四笔房租' },
  { id: 'near', name: '九死一生', d: '交完房租只剩不到 10 鱼币' },
  { id: 'money1k', name: '千鱼富翁', d: '手头有 1000 鱼币' },
  { id: 'money3k', name: '鱼干如山', d: '手头有 3000 鱼币' },
  { id: 'furnace', name: '熔炉之心', d: '累计炼出 5 块铁锭' },
  { id: 'water', name: '清水使者', d: '累计净化 10 份水' },
  { id: 'pure', name: '一滴不染', d: '做出一瓶纯净水' },
  { id: 'ice', name: '冰镇生意', d: '卖水时加冰' },
  { id: 'hoarder', name: '水贵族', d: '把好水卖给屯水的夫人' },
  { id: 'scam_rival', name: '三花也被坑了', d: '把贴了标签的水卖给三花姐' },
  { id: 'cool', name: '风头过了', d: '让一件赃物的热度降到零' },
  { id: 'robo', name: '不是猫！', d: '揭穿一只伪猫' },
  { id: 'robo3', name: '伪猫猎手', d: '累计揭穿 3 只伪猫' },
  { id: 'treasure', name: '垃圾里的宝藏', d: '拾荒捡到稀有珍宝' },
  { id: 'collector', name: '收藏家', d: '同时拥有 4 件不同珍宝' },
  { id: 'bribe', name: '塞点小鱼干', d: '成功贿赂警长' },
  { id: 'law', name: '模范商户', d: '累计 3 次查店清清白白' },
  { id: 'gang', name: '野猫之友', d: '野猫帮好感达到 5' },
  { id: 'robot', name: '机器人好伙伴', d: '完成 5 个送货订单' },
  { id: 'lady', name: '雪绒的谢礼', d: '让雪绒小姐赎回家传项圈' },
  { id: 'allup', name: '全副武装', d: '买齐乔伊小铺所有装备' },
  { id: 'buyout', name: '赎回店铺', d: '买下当铺的产权' },
  { id: 'fast', name: '闪电赎店', d: '25 天内赎回店铺' },
];

// Local adaptation values; these are not claimed as the reference game's balance.
export const PHONE_CONTACTS = [
  { id: 'folk', name: '街坊原料', day: 2, packages: [
    { id: 'scrap', name: '废铁料包', price: 18, items: [{id:'scrap',qty:4}] },
    { id: 'garden', name: '薄荷与鱼苗', price: 38, items: [{id:'catnip',qty:2},{id:'fry',qty:2}] },
    { id: 'cans', name: '罐头箱', price: 30, items: [{id:'can',qty:3}] },
    { id: 'catch', name: '码头鲜鱼', tier: 2, price: 84, items: [{id:'fish',qty:3}] },
    { id: 'pantry', name: '夜市干货', tier: 2, price: 60, items: [{id:'driedshrimp',qty:2},{id:'spice',qty:2}] },
    { id: 'studio', name: '唱片与帆布', tier: 3, price: 96, items: [{id:'record',qty:1},{id:'canvas',qty:2}] },
    { id: 'salon', name: '茶杯与邮票', tier: 4, price: 154, items: [{id:'teacup',qty:1},{id:'starstamp',qty:2}] },
  ] },
  { id: 'water', name: '净水供给', day: 2, machine: 'purifier', packages: [
    { id: 'raw', name: '原水三份', price: 19, items: [{id:'water',qty:3,g:2}] },
    { id: 'boiled', name: '白开水两份', price: 34, items: [{id:'water',qty:2,g:3}] },
    { id: 'spring', name: '山泉水两份', price: 66, items: [{id:'water',qty:2,g:4}] },
  ] },
  { id: 'tech', name: '机械行商', day: 4, packages: [
    { id: 'battery', name: '电池两块', price: 44, items: [{id:'battery',qty:2}] },
    { id: 'claw', name: '机械爪一件', price: 78, items: [{id:'claw',qty:1}] },
    { id: 'metal', name: '铁锭两块', price: 60, items: [{id:'ingot',qty:2}] },
    { id: 'spares', name: '接线零件包', tier: 2, price: 52, items: [{id:'copperwire',qty:2},{id:'sparegear',qty:1}] },
    { id: 'repairs', name: '故障游戏机两台', tier: 3, price: 80, items: [{id:'brokenconsole',qty:2}] },
    { id: 'optical', name: '镜组与热可可', tier: 3, price: 124, items: [{id:'lenskit',qty:1},{id:'cocoa',qty:2}] },
    { id: 'navigation', name: '航海图与六分仪', tier: 4, price: 244, items: [{id:'chart',qty:1},{id:'sextant',qty:1}] },
  ] },
  { id: 'black', name: '黑市中间人', day: 5, rep: 'gang', minRep: 2, packages: [
    { id: 'chip', name: '黑市芯片', price: 96, items: [{id:'chip',qty:1}] },
    { id: 'wine', name: '薄荷酒两瓶', price: 140, items: [{id:'nipwine',qty:2}] },
    { id: 'rare', name: '投影仪', price: 135, items: [{id:'holo',qty:1}] },
    { id: 'roughgems', name: '宝石原石两枚', tier: 4, price: 148, items: [{id:'roughgem',qty:2}] },
  ] },
];
export const MACHINE_MODS = {
  furnace: {name:'扩容炉膛',cost:65,inputs:[{id:'ingot',qty:2},{id:'claw',qty:1}],cap:3,effect:'每批最多3块铁锭'},
  purifier: {name:'加装滤水架',cost:60,inputs:[{id:'ingot',qty:1},{id:'battery',qty:2}],cap:5,effect:'每批最多5份水'},
  tank: {name:'增氧装置',cost:75,inputs:[{id:'battery',qty:2},{id:'claw',qty:1}],days:1,effect:'鱼苗成长缩至1晚'},
  brewery: {name:'保温酒桶',cost:80,inputs:[{id:'ingot',qty:2},{id:'battery',qty:1}],days:1,effect:'酿酒缩至1晚'},
  labeler: {name:'扩展贴标架',cost:55,inputs:[{id:'scrap',qty:3},{id:'claw',qty:1}],cap:5,effect:'每批最多5份罐头'},
};
UPGRADES.push(
  {id:'appraisal_certificate',name:'鉴定证书',d:'可在门面展示，接待收费鉴定',cost:85,gate:'appraisal'},
  {id:'premium_window',name:'精品橱窗',d:'上流好感≥2且陈列珍宝时，每日增加一位高预算买家',cost:180,gate:'premium'},
);

// 每日预约仅说明带来的物品或需求；真假、成色与实际货况仍由交易时验货决定。
// premium 为收购预算或委托报酬倍率，供货模板沿卖家原有开价规则。
export const FEATURED_VISITS = [
  { id: 'scrap_drop', tier: 1, kind: 'sell', who: 'scav', item: 'scrap', line: '今天带块废铁来，看看你收不收。' },
  { id: 'worker_lunch', tier: 1, kind: 'buy', who: 'worker', item: 'can', premium: 1.5, line: '今天轮到我值班，想买一罐猫罐头带走。' },
  { id: 'snack_parcel', tier: 1, kind: 'order', who: 'robot', item: 'dryfish', qty: 2, premium: 1.5, line: '有一单小鱼干两份的配送需求，请留意备货。' },
  { id: 'gear_drop', tier: 2, kind: 'sell', who: 'mechanic', item: 'sparegear', line: '今天带一枚备用齿轮来，价钱到柜台再谈。' },
  { id: 'market_supper', tier: 2, kind: 'buy', who: 'chef', item: 'smokedfish', premium: 1.6, line: '夜市要补一份烟熏鱼，有现货我今天来看看。' },
  { id: 'boat_lunch', tier: 2, kind: 'order', who: 'fisher', item: 'fish', qty: 2, premium: 1.5, line: '返航的船员要两份鲜鱼，想托你留货。' },
  { id: 'record_drop', tier: 3, kind: 'sell', who: 'musician', item: 'record', line: '今天带张旧唱片来，你可以先看再开价。' },
  { id: 'courier_break', tier: 3, kind: 'buy', who: 'courier', item: 'thermos', premium: 1.5, line: '今天跑远途，想买一份保温热饮带在路上。' },
  { id: 'console_purchase', tier: 3, kind: 'buy', who: 'kitten', item: 'console', premium: 1.6, line: '今天想挑一台游戏机，修好了的也行，让我试试看。' },
  { id: 'archive_optics', tier: 3, kind: 'order', who: 'archivist', item: 'lenskit', qty: 1, premium: 1.65, line: '档案馆需要一套光学镜组，查旧物细节用。' },
  { id: 'gem_drop', tier: 4, kind: 'sell', who: 'jeweler', item: 'roughgem', line: '手边有枚宝石原石，今天带来让你看看。' },
  { id: 'pendant_purchase', tier: 4, kind: 'buy', who: 'jeweler', item: 'pendant', premium: 1.7, line: '今天想收一枚宝石吊坠，料子和做工到店再看。' },
  { id: 'captain_chart', tier: 4, kind: 'order', who: 'captain', item: 'chart', qty: 1, premium: 1.65, line: '下次开航要备一张旧航海图，先向你留个需求。' },
];
