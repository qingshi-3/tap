// Cargo footprints are physical floor cells. Weight is descriptive; heavy/fragile
// flags are the explicit departure rules, never inferred from color or weight.
export const ITEMS = {
  crate: { id: 'crate', name: '纸箱', cells: [[0,0]], weight: 1, color: '#ca9156', description: '一格小箱，适合填空' },
  chest: { id: 'chest', name: '收纳箱', cells: [[0,0],[1,0]], weight: 2, color: '#d5a35e', description: '两格长箱' },
  chair: { id: 'chair', name: '扶手椅', cells: [[0,0],[0,1],[1,1]], weight: 3, color: '#cc7858', description: '三格拐角' },
  sofa: { id: 'sofa', name: '沙发', cells: [[0,0],[1,0],[2,0],[0,1],[1,1],[2,1]], weight: 6, color: '#688f87', description: '三乘二，保持宽通道' },
  table: { id: 'table', name: '餐桌', cells: [[0,0],[1,0],[2,0],[1,1]], weight: 4, color: '#c18b62', description: '四格丁字形' },
  desk: { id: 'desk', name: '转角书桌', cells: [[0,0],[1,0],[2,0],[0,1],[0,2]], weight: 5, color: '#b38261', description: '五格长拐角' },
  bike: { id: 'bike', name: '自行车', cells: [[1,0],[2,0],[0,1],[1,1]], weight: 3, color: '#6e9fb0', description: '四格错位，留意车把' },
  fridge: { id: 'fridge', name: '冰箱', cells: [[0,0],[0,1],[0,2]], weight: 7, heavy: true, color: '#84a6aa', description: '三格重物' },
  washer: { id: 'washer', name: '洗衣机', cells: [[0,0],[1,0],[0,1],[1,1]], weight: 8, heavy: true, color: '#7b98b3', description: '四格重物' },
  cabinet: { id: 'cabinet', name: '实木柜', cells: [[0,0],[1,0],[0,1],[1,1]], weight: 9, heavy: true, color: '#a07861', description: '四格重物' },
  mirror: { id: 'mirror', name: '穿衣镜', cells: [[0,0],[0,1],[0,2]], weight: 2, fragile: true, color: '#b5a4c7', description: '三格易碎品' },
  lamp: { id: 'lamp', name: '落地灯', cells: [[0,0],[0,1]], weight: 1, fragile: true, color: '#d6b965', description: '两格易碎品' },
  plant: { id: 'plant', name: '盆栽', cells: [[0,0]], weight: 1, fragile: true, color: '#84a66c', description: '一格易碎品' },
};

export const TRUCKS = [
  { id: 'van', name: '小面包车', w: 4, h: 5, door: [0,3], price: 0, unlockAfter: 0 },
  { id: 'box', name: '城市厢车', w: 5, h: 6, door: [0,4], price: 420, unlockAfter: 5 },
  { id: 'long', name: '窄门长厢', w: 5, h: 8, door: [1,3], price: 950, unlockAfter: 10 },
  { id: 'wide', name: '宽体货车', w: 6, h: 7, door: [1,4], price: 1250, unlockAfter: 15 },
  { id: 'lift', name: '城际大货车', w: 6, h: 8, door: [0,5], price: 1650, unlockAfter: 20 },
];

// Every row is hand-authored: [type, stop, x, y, clockwise rotation]. The solution
// is a proven example, not a restriction on player layouts or unloading order.
function order(id, name, chapter, truckId, stops, rows, options = {}) {
  const cargo = rows.map(([type, stop], i) => ({ id: `${id}-${i + 1}`, type, stop }));
  return {
    id, name, chapter, truckId, stops, cargo,
    obstacles: options.obstacles ?? [], rules: options.rules ?? {},
    reward: options.reward ?? 90 + Number(id.replace(/\D/g, '') || 1) * 12,
    brief: options.brief ?? '按送达顺序安排货位，尾门要留得出。',
    hint: options.hint ?? '先送的放近尾门，后送的放靠车头。',
    solution: Object.fromEntries(rows.map(([, , x, y, r = 0], i) => [cargo[i].id, { x, y, r }])),
  };
}

export const ORDERS = [
  order('o01', '第一趟搬家', 1, 'van', ['梧桐公寓'], [
    ['chest',0,0,0], ['chair',0,2,0], ['crate',0,0,2], ['lamp',0,3,3],
  ], { brief: '把四件货装进车里。选中货物可以旋转。', hint: '扶手椅的缺口还能放一只小箱。' }),
  order('o02', '沙发进新家', 1, 'van', ['河边小屋'], [
    ['sofa',0,0,0], ['chair',0,0,2], ['chest',0,2,2,1], ['crate',0,3,0], ['crate',0,3,1], ['plant',0,1,4],
  ], { brief: '大件也要能完整滑出尾门。', hint: '沙发横放车头，把后排的货先卸掉。' }),
  order('o03', '先到花店', 1, 'van', ['花店','楼上住户'], [
    ['desk',1,0,0], ['chest',1,2,1,1], ['lamp',0,3,2], ['plant',0,0,4], ['crate',0,1,3], ['chest',0,1,4],
  ], { brief: '两站配送：先卸花店，再去住户家。', hint: '把第二站的书桌放在车头。' }),
  order('o04', '车轮上的空隙', 1, 'van', ['骑行社','邻里站'], [
    ['table',1,0,0], ['bike',0,0,2], ['chest',1,3,0,1], ['crate',0,2,4], ['lamp',0,3,3], ['crate',1,0,1],
  ], { hint: '餐桌的丁字缺口能收一箱，自行车靠尾门。' }),
  order('o05', '周末拼车', 1, 'van', ['小院','新居'], [
    ['sofa',1,0,0], ['fridge',1,3,0], ['chair',0,0,2], ['chest',0,2,3], ['crate',0,0,4], ['plant',0,1,4], ['crate',0,2,4], ['crate',0,3,4],
  ], { hint: '尾门四格留给第一站的小件，先清空它们。' }),
  order('o06', '新车第一单', 2, 'box', ['城西家电','新居'], [
    ['washer',1,0,0], ['fridge',0,3,0], ['sofa',1,0,2], ['chest',0,3,3], ['chair',0,0,4], ['crate',0,4,0],
  ], { rules: { heavyFront: true }, brief: '重物全部放在前半区，行车才稳。', hint: '洗衣机和冰箱都不能伸到第4排。' }),
  order('o07', '工具箱固定座', 2, 'box', ['木工坊','旧街'], [
    ['cabinet',1,0,0], ['desk',1,2,0], ['bike',0,1,3], ['chest',0,0,5], ['crate',0,3,5], ['lamp',0,4,4],
  ], { obstacles: [[4,2],[4,3]], rules: { heavyFront: true }, hint: '右侧固定座不能占用，书桌长边贴车头。' }),
  order('o08', '三站邻里线', 2, 'box', ['书店','公寓','画室'], [
    ['washer',2,0,0], ['fridge',2,3,0], ['table',1,0,2], ['chest',1,4,1,1], ['bike',0,1,4], ['lamp',0,0,4], ['crate',1,3,3],
  ], { rules: { heavyFront: true }, hint: '第三站在前，第二站居中，自行车留在尾端。' }),
  order('o09', '重货与转角', 2, 'box', ['家装店','东门'], [
    ['cabinet',1,0,0], ['washer',1,3,0], ['desk',0,0,2], ['chair',0,3,3], ['chest',0,1,5], ['crate',0,4,5],
  ], { obstacles: [[2,0],[2,1]], rules: { heavyFront: true }, hint: '前排中间固定座把重货分在两边，后排不要堵住转弯。' }),
  order('o10', '满载城市线', 2, 'box', ['街角','社区','新城'], [
    ['washer',2,0,0], ['fridge',2,4,0], ['sofa',1,0,2], ['table',0,2,4], ['chest',1,2,0,1], ['chair',0,0,4], ['crate',1,3,3], ['crate',0,4,5],
  ], { rules: { heavyFront: true }, hint: '冰箱贴右侧、收纳箱竖放，第一站餐桌靠尾门。' }),
  order('o11', '尾门变窄了', 3, 'long', ['布艺店','山脚'], [
    ['sofa',1,1,0], ['desk',1,0,2], ['bike',0,1,5], ['chest',0,1,7], ['crate',0,3,7],
  ], { brief: '只有中间三格能出车，货物可以平移绕行。', hint: '宽三格的家具对准中间尾门，侧边别堆满。' }),
  order('o12', '给镜子留空', 3, 'long', ['镜艺坊','家电仓'], [
    ['washer',1,0,0], ['fridge',1,3,0], ['mirror',0,1,4], ['chair',0,2,5], ['chest',0,1,7], ['crate',1,0,3],
  ], { rules: { heavyFront: true, fragileBuffer: true }, brief: '易碎品不能与重物边贴边，斜角相邻可以。', hint: '镜子与重货之间空出一排；尾门前留三格。' }),
  order('o13', '轮罩之间', 3, 'long', ['学校','居民楼'], [
    ['cabinet',1,1,0], ['table',1,1,2], ['mirror',0,3,4], ['chair',0,1,5], ['chest',0,1,7], ['plant',0,3,7],
  ], { obstacles: [[0,4],[4,4],[0,5],[4,5]], rules: { heavyFront: true, fragileBuffer: true }, hint: '轮罩把中段收窄，镜子竖放穿过中间。' }),
  order('o14', '玻璃工坊联送', 3, 'long', ['画廊','花房','家电店'], [
    ['washer',2,0,0], ['fridge',2,3,0], ['mirror',1,1,4], ['lamp',0,3,5], ['plant',0,1,7], ['bike',1,0,2], ['chest',0,2,7],
  ], { rules: { heavyFront: true, fragileBuffer: true }, hint: '第一站的小件靠尾门，镜子在中间，重货在最前面。' }),
  order('o15', '山路线调度', 3, 'long', ['山口','坡顶','民宿'], [
    ['cabinet',2,0,0], ['fridge',2,3,0], ['sofa',1,1,3], ['mirror',0,1,5], ['lamp',0,3,5], ['chest',0,2,7], ['crate',1,0,2],
  ], { obstacles: [[4,3],[0,6]], rules: { heavyFront: true, fragileBuffer: true }, hint: '先把镜子和灯拉出，沙发就有了通向尾门的三格通道。' }),
  order('o16', '双排装车', 4, 'wide', ['家居馆','江岸'], [
    ['washer',1,0,0], ['cabinet',1,4,0], ['sofa',1,0,2], ['bike',0,3,3], ['mirror',0,1,4], ['chest',0,3,6], ['crate',0,4,5],
  ], { rules: { heavyFront: true, fragileBuffer: true }, hint: '两侧重货不能卡住中段，先送的小件让出四格门道。' }),
  order('o17', '横梁下的空位', 4, 'wide', ['花坊','新楼','工作室'], [
    ['fridge',2,0,0], ['washer',2,4,0], ['desk',1,1,0], ['bike',1,0,3], ['mirror',0,4,3], ['chair',0,1,5], ['chest',0,3,6],
  ], { obstacles: [[5,3],[5,4]], rules: { heavyFront: true, fragileBuffer: true }, hint: '冰箱靠左，镜子与右前洗衣机之间留出一排。' }),
  order('o18', '两张沙发', 4, 'wide', ['南苑','北苑'], [
    ['sofa',1,0,0], ['sofa',1,3,0], ['table',0,1,3], ['chair',0,0,3], ['bike',0,2,5], ['lamp',0,5,4], ['crate',0,1,6],
  ], { rules: { fragileBuffer: true }, hint: '后排先清，车头两张沙发需要逐一向中间平移。' }),
  order('o19', '三站易碎专线', 4, 'wide', ['琴房','花店','电器城'], [
    ['washer',2,0,0], ['cabinet',2,4,0], ['table',1,1,2], ['mirror',1,0,3], ['lamp',0,4,4], ['plant',0,1,6], ['bike',0,1,4], ['crate',1,5,3],
  ], { rules: { heavyFront: true, fragileBuffer: true }, hint: '第一站自行车先退出，第二站镜子才有横向空间。' }),
  order('o20', '环城收官', 4, 'wide', ['东街','南街','西街','北街'], [
    ['washer',3,0,0], ['fridge',3,5,0], ['desk',2,2,0], ['table',2,0,2,2], ['mirror',1,4,3], ['bike',1,0,4], ['chair',0,2,5], ['chest',0,0,6], ['plant',0,5,6],
  ], { rules: { heavyFront: true, fragileBuffer: true }, hint: '四站从后往前分层，镜子和书桌分开走中间。' }),
  order('o21', '城际首发', 5, 'lift', ['客运站','新城区','家具城'], [
    ['cabinet',2,0,0], ['washer',2,4,0], ['sofa',1,1,2], ['desk',1,3,4], ['mirror',0,0,4], ['bike',0,0,6], ['lamp',0,4,6], ['crate',0,5,7],
  ], { rules: { heavyFront: true, fragileBuffer: true }, hint: '大车也有顺序：易碎品走尾端，家具放中段。' }),
  order('o22', '双轮罩大搬家', 5, 'lift', ['旧城','新城','郊区'], [
    ['washer',2,1,0], ['fridge',2,4,0], ['desk',1,1,2], ['sofa',1,2,4], ['mirror',0,0,5], ['lamp',0,5,5], ['chest',0,1,7], ['crate',0,3,7], ['plant',0,4,7],
  ], { obstacles: [[0,3],[5,3],[0,4],[5,4]], rules: { heavyFront: true, fragileBuffer: true }, hint: '尾部小件先卸掉，再让沙发穿过两侧轮罩。' }),
  order('o23', '艺术馆开幕', 5, 'lift', ['展厅','花园','后勤库'], [
    ['washer',2,0,0], ['cabinet',2,4,0], ['table',1,2,2], ['sofa',1,0,3], ['mirror',0,4,3], ['mirror',0,5,3], ['plant',0,0,7], ['lamp',0,2,6], ['chest',0,3,7], ['bike',1,0,5],
  ], { rules: { heavyFront: true, fragileBuffer: true }, hint: '两面镜子并排竖放，先送的花灯别被沙发挡住。' }),
  order('o24', '四站接力', 5, 'lift', ['车站','花街','学校','北仓'], [
    ['fridge',3,0,0], ['cabinet',3,4,0], ['desk',2,1,0], ['sofa',2,0,3], ['table',1,3,3], ['mirror',1,0,5], ['chair',0,1,5], ['bike',0,3,6], ['lamp',0,3,5], ['crate',0,5,7],
  ], { rules: { heavyFront: true, fragileBuffer: true }, hint: '每站留出自己的出口，第一站的自行车不要塞到车头。' }),
  order('o25', '全城托付', 5, 'lift', ['早市','花坊','新居','总站'], [
    ['washer',3,0,1], ['cabinet',3,4,0], ['fridge',3,0,0,1], ['desk',2,0,3], ['sofa',2,3,2], ['mirror',1,3,4], ['bike',1,0,5], ['table',0,4,5,1], ['lamp',0,4,4], ['chest',0,1,7],
  ], { rules: { heavyFront: true, fragileBuffer: true }, brief: '最后一条城际线：重货、缓冲与四站顺序一起安排。', hint: '重货前排并列，早市餐桌最靠尾门，镜子留在中后段。', reward: 500 }),
];

// Recurring dispatches are explicit reusable layouts, unlocked by finishing the
// campaign. UI may cycle these without mutating authored campaign IDs/progress.
export const CONTRACTS = [
  order('c01', '社区加急', 6, 'van', ['社区','公寓'], [['sofa',1,0,0],['bike',0,0,2],['chest',0,2,4],['lamp',0,3,2],['crate',0,0,4]], { reward: 150 }),
  order('c02', '家电回程', 6, 'box', ['南门','北门'], [['washer',1,0,0],['fridge',1,4,0],['desk',0,0,2],['bike',0,2,4],['chest',0,2,0,1]], { rules: { heavyFront: true }, reward: 190 }),
  order('c03', '山间补给', 6, 'long', ['山口','山顶'], [['cabinet',1,0,0],['fridge',1,3,0],['sofa',1,1,3],['mirror',0,1,5],['lamp',0,3,5],['chest',0,2,7]], { rules: { heavyFront: true, fragileBuffer: true }, obstacles: [[0,4],[4,4]], reward: 230 }),
  order('c04', '周末展会', 6, 'wide', ['展厅','仓库'], [['sofa',1,0,0],['sofa',1,3,0],['desk',0,0,2],['mirror',0,4,3],['bike',0,1,5],['lamp',0,5,4]], { rules: { fragileBuffer: true }, reward: 260 }),
  order('c05', '夜间联运', 6, 'lift', ['夜市','公寓','物流站'], [['washer',2,0,0],['cabinet',2,4,0],['sofa',1,0,2],['desk',1,3,2],['mirror',0,0,5],['bike',0,1,5],['table',0,3,6],['chest',0,1,7]], { rules: { heavyFront: true, fragileBuffer: true }, reward: 300 }),
];

export const CHAPTERS = [
  { id: 1, name: '街坊起步' }, { id: 2, name: '城市重货' },
  { id: 3, name: '山路窄门' }, { id: 4, name: '环城联送' },
  { id: 5, name: '城际托付' },
];
