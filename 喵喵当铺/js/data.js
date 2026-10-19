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
  robot: { name: 'MEOW-7', title: '送货机器人', fac: null },
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
};

export const RENT = [50, 80, 140];
export const rentOf = (week) => (week <= RENT.length ? RENT[week - 1] : RENT[RENT.length - 1]);
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
];

// 拾荒箱：hint 是箱子上的提示
export const CRATES = [
  { id: 'heavy', name: '沉甸甸的箱子', pool: [['scrap', 3], ['scrap', 2], ['ingot', 1], ['battery', 1], ['claw', 1]] },
  { id: 'wet', name: '湿漉漉的箱子', pool: [['water', 3], ['water', 2], ['fry', 2], ['fish', 1], ['water', 2]] },
  { id: 'smell', name: '香喷喷的箱子', pool: [['can', 2], ['dryfish', 3], ['stick', 2], ['catnip', 2], ['tuna', 1]] },
  { id: 'jingle', name: '叮当响的箱子', pool: [['mouse', 1], ['laser', 1], ['radio', 1], ['wand', 2], ['bell', 1]] },
  { id: 'myst', name: '神秘的箱子', pool: [['yarn', 1], ['water', 1], ['scrap', 1], ['holo', 1], ['pearl', 1], ['painting', 1]], rare: ['holo', 'pearl', 'painting'] },
];

// 作坊机器：days=需要几晚；cap=一批最多几份
export const MACHINES = {
  furnace: { name: '熔炉', icon: 'ingot', in: ['scrap', 3], out: ['ingot', 1], days: 1, cap: 2 },
  purifier: { name: '净水器', icon: 'water', in: ['water', 1], out: ['water', 1], days: 1, cap: 3 },
  tank: { name: '鱼缸', icon: 'fish', in: ['fry', 1], out: ['fish', 1], days: 2, cap: 2 },
  brewery: { name: '酿酒桶', icon: 'nipwine', in: ['catnip', 2], out: ['nipwine', 1], days: 2, cap: 2, water: true },
  labeler: { name: '贴标台', icon: 'tuna', in: ['can', 1], out: ['tuna', 1, 'fake'], days: 1, cap: 3 },
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
  { id: 'purifier', name: '净水器', d: '原水升2档，需1晚；附10点滤芯', cost: 60, machine: true },
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
