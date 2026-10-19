import { ITEMS as LEGACY_ITEMS, TRUCKS as LEGACY_TRUCKS, ORDERS as LEGACY_ORDERS, CONTRACTS as LEGACY_CONTRACTS } from './content-v1.js';

// Existing IDs and footprints are frozen save-data contracts. Only the two box
// types bear upper cargo; fragile objects never become supports.
export const ITEMS = Object.fromEntries(Object.entries(LEGACY_ITEMS).map(([id, item]) => [id, {
  ...item, cells: item.cells.map(cell => [...cell]),
  ...(['crate', 'chest'].includes(id) ? { support: true } : {}),
  ...(['fridge', 'mirror', 'lamp'].includes(id) ? { long: true } : {}),
}]));
ITEMS.crate.description = '一格承重箱，可托住轻货';
ITEMS.chest.description = '两格承重箱，可托住轻货';
ITEMS.vase = { id: 'vase', name: '花瓶', cells: [[0,0]], weight: 1, fragile: true, color: '#ba86ad', description: '一格易碎品，上面不能放货' };

// Narrow doors are an order feature introduced in the final stage. Frozen
// version-one orders still use their original truck door definitions in truckFor.
export const TRUCKS = LEGACY_TRUCKS.map(truck => ({
  ...truck, door: [0, truck.w - 1], name: truck.id === 'long' ? '长厢货车' : truck.name,
}));

// Rows: [type, stop, x, y, clockwise rotation=0, layer=0]. Lower supports come
// before their upper cargo so the example is also a legal loading sequence.
function order(id, name, chapter, truckId, stops, rows, options = {}) {
  const number = Number(id.slice(1));
  const cargo = rows.map(([type, stop], i) => ({ id: id + '-' + (i + 1), type, stop }));
  return {
    id, contentVersion: 2, name, chapter, truckId, stops, cargo,
    obstacles: options.obstacles ?? [],
    ...(options.door ? { door: options.door } : {}),
    rules: { stacking: number >= 5, unloadOrder: number >= 15, ...(number >= 11 ? { heavyFront: true } : {}), ...(number >= 13 ? { longSecured: true } : {}), ...options.rules },
    reward: options.reward ?? 90 + number * 12,
    brief: options.brief ?? '重物放前半区；长件沿车头或侧墙贴齐固定。',
    hint: options.hint ?? '先送的货靠尾门，上层货要比下层先卸。',
    solution: Object.fromEntries(rows.map(([, , x, y, r = 0, z = 0], i) => [cargo[i].id, { x, y, r, z }])),
  };
}

export const ORDERS = [
  order('o01', '第一趟搬家', 1, 'van', ['梧桐公寓'], [
    ['chest',0,0,0], ['chair',0,2,0], ['crate',0,0,2], ['crate',0,3,3],
  ], { brief: '把四件货放进车里，可以旋转。', hint: '扶手椅的缺口能放下一只纸箱。' }),
  order('o02', '沙发进新家', 1, 'van', ['河边小屋'], [
    ['sofa',0,0,0], ['chair',0,0,2], ['chest',0,2,2,1], ['crate',0,3,0], ['crate',0,3,1], ['crate',0,1,4],
  ], { brief: '货物都放进车厢就能出发。', hint: '沙发横放占六格，长箱转过来能填侧边。' }),
  order('o03', '转角书桌', 1, 'van', ['楼上住户'], [
    ['desk',0,0,0], ['chest',0,2,1,1], ['chair',0,1,3], ['chest',0,3,0,1], ['crate',0,1,2], ['crate',0,3,4],
  ], { brief: '利用家具的凹角，把空位拼起来。', hint: '书桌贴左上角，两只长箱竖放右侧。' }),
  order('o04', '车轮上的空隙', 1, 'van', ['骑行社'], [
    ['table',0,0,0], ['bike',0,0,2], ['chest',0,3,0,1], ['chair',0,2,3],
    ['crate',0,0,1], ['crate',0,0,2], ['crate',0,2,1], ['crate',0,3,2], ['crate',0,0,4], ['crate',0,1,4],
  ], { brief: '这一单只拼形状，不用留卸货通道。', hint: '餐桌的两侧缺口和自行车周围都能收小箱。' }),
  order('o05', '箱子叠起来', 1, 'van', ['周末新居'], [
    ['sofa',0,0,0], ['sofa',0,0,2], ['chest',0,3,0,1], ['chest',0,3,2,1], ['chest',0,0,4], ['chest',0,2,4],
    ['crate',0,3,0,0,1], ['chest',0,0,4,0,1], ['crate',0,2,4,0,1],
  ], { brief: '一两格轻货可叠在箱子上，必须完全托住。', hint: '两张沙发占左边，长箱填满侧边和尾部，再叠轻货。' }),
  order('o06', '新车满载', 2, 'box', ['城市公寓'], [
    ['sofa',0,0,0], ['sofa',0,0,2], ['sofa',0,0,4],
    ['chest',0,3,0], ['chest',0,3,1], ['chest',0,3,2], ['chest',0,3,3], ['chest',0,3,4], ['chest',0,3,5],
    ['crate',0,3,0,0,1], ['chest',0,3,2,0,1], ['chest',0,3,5,0,1],
  ], { brief: '地板装不下全部货，把轻货放上层。', hint: '沙发占三列，右边两列用承重箱铺底。' }),
  order('o07', '竖箱与横箱', 2, 'box', ['木工坊'], [
    ['sofa',0,0,0], ['sofa',0,0,2], ['sofa',0,0,4],
    ['chest',0,3,0,1], ['chest',0,4,0,1], ['chest',0,3,2], ['chest',0,3,3], ['chest',0,3,4], ['chest',0,3,5],
    ['chest',0,3,0,1,1], ['crate',0,4,0,0,1], ['chest',0,3,4,0,1], ['crate',0,3,5,0,1],
  ], { brief: '上层可以跨两只箱子，但不能有一格悬空。', hint: '上层长箱和下层承重面的方向要对齐。' }),
  order('o08', '花瓶不能承重', 2, 'box', ['花艺新店'], [
    ['sofa',0,0,0], ['desk',0,0,2], ['chair',0,3,0], ['chest',0,3,3], ['chest',0,0,5],
    ['vase',0,3,3,1,1], ['vase',0,4,4], ['crate',0,2,5],
  ], { brief: '花瓶可被箱子托住，上面不能再放货。', hint: '把花瓶放在收纳箱上，空位留给家具。' }),
  order('o09', '一车花瓶', 2, 'box', ['沿河花房'], [
    ['sofa',0,0,0], ['sofa',0,0,2], ['table',0,0,4],
    ['chest',0,3,0], ['chest',0,3,1], ['chest',0,3,2], ['chest',0,3,3], ['chest',0,2,5],
    ['crate',0,4,5], ['vase',0,3,4,1], ['crate',0,0,5],
    ['vase',0,3,0,1,1], ['vase',0,3,2,1,1], ['crate',0,3,3,0,1],
  ], { brief: '易碎品彼此能相邻，承重只能靠箱子。', hint: '花瓶放箱子上，别把纸箱叠在花瓶上。' }),
  order('o10', '大小件同行', 2, 'box', ['新城家居'], [
    ['sofa',0,0,0], ['desk',0,0,2], ['chest',0,3,0,1], ['chest',0,4,0,1],
    ['vase',0,3,3], ['mirror',0,4,2], ['chair',0,1,4], ['chest',0,3,5], ['crate',0,0,5], ['plant',0,3,2],
    ['lamp',0,3,0,0,1], ['vase',0,3,5,1,1],
  ], { brief: '大件平放，轻货叠箱，易碎品不承重。', hint: '镜子放右侧，灯和花瓶分别叠在两只长箱上。' }),
  order('o11', '重货靠前', 3, 'long', ['家电新居'], [
    ['fridge',0,0,0], ['washer',0,3,0], ['sofa',0,1,3], ['desk',0,0,5],
    ['chest',0,3,6], ['vase',0,3,6,1,1], ['chest',0,1,1,1], ['crate',0,1,1,0,1], ['mirror',0,4,3],
  ], { brief: '重物只能落地，全部占格须在前半区。', hint: '冰箱靠左前，洗衣机靠右前，轻货再叠箱。' }),
  order('o12', '前舱重装', 3, 'long', ['电器仓'], [
    ['cabinet',0,0,0], ['washer',0,3,0], ['fridge',0,2,0], ['sofa',0,0,3], ['desk',0,2,5],
    ['chest',0,0,6], ['vase',0,0,6,1,1], ['lamp',0,4,3], ['chest',0,3,7], ['plant',0,3,7,0,1],
  ], { brief: '三件重货都要完整落在前四排。', hint: '柜子和洗衣机分放两侧，冰箱竖着放在中间。' }),
  order('o13', '长件贴墙', 3, 'long', ['镜艺坊'], [
    ['fridge',0,0,0], ['mirror',0,4,3], ['lamp',0,0,5], ['sofa',0,1,0], ['desk',0,1,3],
    ['chest',0,2,6], ['vase',0,2,6,1,1],
  ], { brief: '冰箱、镜子和灯须沿车头或侧墙贴齐固定。', hint: '冰箱与灯靠左墙，镜子靠右墙，中间收家具。' }),
  order('o14', '横放也能固定', 3, 'long', ['装饰新居'], [
    ['fridge',0,1,0,1], ['washer',0,0,1], ['cabinet',0,3,1], ['mirror',0,0,4], ['lamp',0,4,4],
    ['table',0,1,4], ['chest',0,1,7], ['vase',0,1,7,1,1], ['chest',0,3,6,1], ['crate',0,3,6,0,1], ['crate',0,4,7],
  ], { hint: '冰箱横贴车头，两侧长件贴墙，尾部叠轻货。' }),
  order('o15', '先到哪一家', 3, 'long', ['花店','新居'], [
    ['fridge',1,0,0], ['washer',1,3,0], ['sofa',1,1,2],
    ['mirror',0,0,4], ['lamp',0,4,4], ['chest',0,1,7], ['vase',0,1,7,1,1],
  ], { brief: '从这单开始按站卸货，后站货不能先移走。长件仍须贴墙固定。', hint: '第一站放尾部；同站叠货先卸上层，再卸下层。' }),
  order('o16', '先卸上层', 4, 'wide', ['花坊','江岸新居'], [
    ['washer',1,0,0], ['cabinet',1,4,0], ['sofa',1,0,2], ['chest',1,1,5],
    ['bike',0,3,3], ['mirror',0,0,4], ['chest',0,3,6], ['lamp',0,5,4], ['crate',0,4,5],
    ['vase',0,1,5,1,1],
  ], { hint: '花瓶在第二站箱子的上层，第一站先把花瓶卸掉。' }),
  order('o17', '三站上下层', 4, 'wide', ['花坊','公寓','工作室'], [
    ['fridge',2,0,0], ['washer',2,4,0], ['desk',2,1,0], ['chest',2,2,3], ['chest',1,2,5],
    ['mirror',0,5,3], ['chair',0,0,4], ['chest',0,3,6],
    ['vase',1,2,3,1,1], ['crate',0,2,5,0,1], ['plant',0,4,6,0,1],
  ], { hint: '第一站的小箱叠在第二站箱上，第二站花瓶叠在第三站箱上。' }),
  order('o18', '两侧接力', 4, 'wide', ['车站','学校','北仓'], [
    ['cabinet',2,0,0], ['washer',2,4,0], ['sofa',2,1,2], ['table',1,1,4],
    ['chest',2,0,3,1], ['chest',1,4,3,1], ['mirror',1,5,3], ['lamp',0,0,5], ['chest',0,3,6],
    ['vase',0,0,3,0,1], ['crate',0,4,3,0,1], ['plant',0,4,6,0,1],
  ], { hint: '左侧花瓶先卸，第三站承重箱留下；右侧纸箱同样先于下层。' }),
  order('o19', '尾门变窄了', 4, 'wide', ['琴房','花店','电器城'], [
    ['washer',2,0,0], ['cabinet',2,4,0], ['table',1,1,2], ['mirror',1,0,3],
    ['lamp',0,5,4], ['chest',0,1,6], ['bike',0,1,4], ['crate',1,5,3], ['vase',0,1,6,1,1],
  ], { door: [1,4], brief: '尾门只开中间四格，地板货需要平移对准出口。长件仍须贴墙固定。', hint: '先卸尾部箱子和自行车，侧墙长件再向中间平移。' }),
  order('o20', '绕过固定座', 4, 'wide', ['东街','南街','西街','北街'], [
    ['washer',3,0,0], ['fridge',3,5,0], ['desk',2,2,0], ['table',2,0,2,2], ['mirror',1,5,3],
    ['bike',1,0,4], ['chair',0,2,5], ['chest',0,0,6], ['plant',0,3,5], ['chest',1,3,4], ['vase',0,3,4,1,1],
  ], { door: [1,4], obstacles: [[4,6]], hint: '先卸上层花瓶和尾部家具，绕开右后固定座。' }),
  order('o21', '城际首发', 5, 'lift', ['客运站','新城区','家具城'], [
    ['cabinet',2,0,0], ['washer',2,4,0], ['sofa',1,1,2], ['desk',1,3,4], ['chest',1,1,4],
    ['mirror',0,0,4], ['bike',0,0,6], ['lamp',0,5,6], ['crate',0,4,7], ['vase',0,1,4,1,1],
  ], { door: [0,4], obstacles: [[0,2],[5,2]], hint: '先清尾端，再让右侧长件横移；两只前舱固定座不能装货。' }),
  order('o22', '双轮罩大搬家', 5, 'lift', ['旧城','新城','郊区'], [
    ['washer',2,1,0], ['fridge',2,5,0], ['desk',1,1,2], ['sofa',1,2,4],
    ['mirror',0,0,5], ['lamp',0,5,5], ['chest',0,1,7], ['crate',0,3,7], ['plant',0,4,7], ['vase',0,1,7,1,1],
  ], { door: [1,4], obstacles: [[0,3],[5,3],[0,4],[5,4]], hint: '尾部小件先卸，侧边长件移到中间，家具再穿过轮罩。' }),
  order('o23', '艺术馆开幕', 5, 'lift', ['展厅','花园','后勤库'], [
    ['washer',2,0,0], ['cabinet',2,4,0], ['table',1,2,2], ['sofa',1,0,3],
    ['vase',0,4,3], ['mirror',0,5,3], ['plant',0,0,7], ['vase',0,2,6], ['chest',0,3,7], ['bike',1,0,5],
    ['vase',0,3,7,1,1],
  ], { door: [1,4], obstacles: [[0,2],[5,6]], hint: '先卸右侧花瓶，镜子才能离开侧墙；后角固定座不能穿过。' }),
  order('o24', '四站接力', 5, 'lift', ['车站','花街','学校','北仓'], [
    ['fridge',3,0,0], ['cabinet',3,4,0], ['desk',2,1,0], ['sofa',2,0,3], ['table',1,3,3],
    ['mirror',1,0,5], ['chair',0,1,5], ['bike',0,3,6], ['vase',0,3,5], ['crate',0,5,7], ['crate',1,5,4], ['plant',0,5,4,0,1],
  ], { door: [1,4], obstacles: [[5,2]], hint: '第一站盆栽先离开上层，第二站先取右侧箱子，再卸餐桌。' }),
  order('o25', '全城托付', 5, 'lift', ['早市','花坊','新居','总站'], [
    ['washer',3,0,1], ['cabinet',3,4,0], ['fridge',3,0,0,1], ['desk',2,0,3], ['sofa',2,3,2],
    ['vase',1,3,4], ['bike',1,0,5], ['table',0,4,5,1], ['chest',1,1,7], ['chest',1,4,4],
    ['vase',0,1,7,1,1], ['plant',0,4,4,0,1],
  ], { door: [1,4], obstacles: [[3,0],[3,1]], brief: '四站合运：重物靠前、长件贴墙、上层先卸，再绕固定座出窄门。', hint: '先取两件上层轻货和餐桌，再依站卸出中段家具。', reward: 500 }),
];

// Unexposed first-release dispatch fixtures retain their original semantics.
export const CONTRACTS = LEGACY_CONTRACTS;
export const CHAPTERS = [
  { id: 1, name: '街坊起步' }, { id: 2, name: '叠装轻货' },
  { id: 3, name: '稳装长件' }, { id: 4, name: '分站联送' },
  { id: 5, name: '城际托付' },
];

// Only campaign IDs are playable/persistable. Unknown versions are never guessed.
export function getOrder(id, contentVersion = 2) {
  const orders = contentVersion === 1 ? LEGACY_ORDERS : contentVersion === 2 ? ORDERS : [];
  return orders.find(candidate => candidate.id === id);
}

