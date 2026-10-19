export const WORLD = Object.freeze({ width: 1024, height: 576 });

export const STAGES = Object.freeze([
  {
    id: 'greenway', number: 1, name: '青野隘口', theme: 'field', emblem: '♜', difficulty: '初战',
    summary: '敌军沿旧商道逼近王城。', maxWaves: 7, startingGold: 265, startingLives: 20, towerLevelCap: 1,
    path: [[470, -28], [470, 92], [464, 190], [442, 276], [386, 342], [314, 388], [290, 446], [354, 486], [458, 480], [556, 446], [632, 394], [686, 344], [780, 324], [902, 322], [1052, 318]],
    pads: [[362, 205], [555, 205], [282, 290], [202, 398], [410, 405], [500, 382], [580, 505], [816, 405]],
    zones: [
      { name: '北林入口', x: 470, y: 176, kind: 'entry' },
      { name: '商道回弯', x: 330, y: 430, kind: 'choke' },
      { name: '王城近郊', x: 884, y: 322, kind: 'laststand' }
    ],
    padRoles: ['入口左侧火力', '入口右侧火力', '下坡内侧', '回弯前沿', '回弯核心', '南侧追击', '出弯交叉火力', '出口回收'],
    decor: [[120, 188, 'tree'], [194, 198, 'tree'], [672, 190, 'tree'], [754, 184, 'tree'], [874, 474, 'tree'], [926, 452, 'tree'], [252, 520, 'rock'], [732, 392, 'rock']],
    landmarks: [{ kind: 'camp', x: 574, y: 534 }, { kind: 'ruin', x: 914, y: 414 }],
    palette: { grass: '#65834c', light: '#86a85f', dark: '#476744', road: '#a67a4e', roadEdge: '#594c38', water: '#557e83' }
  },
  {
    id: 'old-ford', number: 2, name: '断桥河湾', theme: 'river', emblem: '≈', difficulty: '进阶',
    summary: '守住渡口，别让河岸被突破。', maxWaves: 7, startingGold: 220, startingLives: 20, towerLevelCap: 2,
    path: [[1052, 206], [920, 204], [806, 222], [714, 206], [648, 170], [576, 180], [544, 232], [554, 286], [618, 326], [646, 374], [608, 418], [530, 438], [450, 416], [402, 448], [394, 508], [420, 604]],
    pads: [[886, 292], [748, 300], [626, 252], [480, 250], [532, 350], [708, 402], [494, 510]],
    zones: [
      { name: '东岸入口', x: 912, y: 205, kind: 'entry' },
      { name: '北侧发夹弯', x: 590, y: 224, kind: 'choke' },
      { name: '南岸堤口', x: 406, y: 494, kind: 'laststand' }
    ],
    padRoles: ['入口控制', '上路外侧', '发夹内侧', '发夹左翼', '中段交叉火力', '下弯外侧', '出口回收'],
    decor: [[886, 340, 'tree'], [770, 344, 'rock'], [680, 278, 'tree'], [430, 300, 'rock'], [470, 365, 'tree'], [760, 460, 'rock'], [570, 500, 'tree']],
    landmarks: [{ kind: 'camp', x: 884, y: 348 }, { kind: 'ruin', x: 514, y: 286 }],
    islands: [[886, 324, 118, 92], [748, 322, 108, 92], [626, 270, 104, 90], [480, 274, 106, 92], [532, 374, 112, 94], [708, 426, 116, 96], [494, 526, 110, 94]],
    palette: { grass: '#527b66', light: '#789b72', dark: '#405f4d', road: '#9a7953', roadEdge: '#514b3d', water: '#407a91' }
  },
  {
    id: 'mirewatch', number: 3, name: '沉钟沼泽', theme: 'swamp', emblem: '♧', difficulty: '险境',
    summary: '沼泽深处的重甲军团已经出发。', maxWaves: 11, startingGold: 300, startingLives: 20, towerLevelCap: 2,
    path: [[-28, 326], [116, 326], [244, 344], [350, 330], [402, 282], [396, 224], [464, 184], [596, 184], [728, 202], [872, 232], [920, 276], [854, 310], [730, 306], [622, 282], [548, 312], [560, 366], [652, 402], [750, 434], [708, 467], [588, 474], [468, 455], [346, 437], [222, 431], [102, 433], [-28, 436]],
    pads: [[174, 242], [278, 252], [285, 385], [474, 262], [566, 236], [665, 241], [834, 390], [729, 366], [515, 395], [480, 510], [386, 367], [154, 385]],
    zones: [
      { name: '西林入口', x: 126, y: 326, kind: 'entry' },
      { name: '北侧长弯', x: 724, y: 235, kind: 'choke' },
      { name: '南侧退路', x: 150, y: 440, kind: 'laststand' }
    ],
    padRoles: ['入口上侧', '首段前压', '首弯内侧', '北弯左翼', '北路核心', '长弯内侧', '东侧回收', '南弯外侧', '中段交叉火力', '南路压制', '末段核心', '出口回收'],
    decor: [[82, 210, 'tree'], [210, 188, 'tree'], [358, 520, 'waterDetail'], [410, 540, 'waterDetail'], [634, 524, 'waterDetail'], [780, 526, 'tree'], [892, 390, 'tree'], [928, 420, 'tree']],
    landmarks: [{ kind: 'camp', x: 486, y: 360 }, { kind: 'ruin', x: 858, y: 188 }],
    palette: { grass: '#506b48', light: '#72875a', dark: '#3b573e', road: '#8f704b', roadEdge: '#474635', water: '#526f62' }
  }
]);

export function getStage(stageId) {
  return STAGES.find(stage => stage.id === stageId) ?? STAGES[0];
}
