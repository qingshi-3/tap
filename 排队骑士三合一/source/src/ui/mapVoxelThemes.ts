export interface VoxelThemeInfo {
  id: string;
  name: string;
  subtitle: string;
  tone: 'day' | 'sunset' | 'night';
  accent: string;
  glow: string;
}

export const VOXEL_THEMES: readonly VoxelThemeInfo[] = [
  {
    id: 'emerald_day',
    name: '晴空翠谷',
    subtitle: '阳光松林与飞瀑溪谷',
    tone: 'day',
    accent: '#f5c24c',
    glow: '#4fd8ff',
  },
  {
    id: 'autumn_sunset',
    name: '金霞枫林',
    subtitle: '晚霞红叶与暖金石桥',
    tone: 'sunset',
    accent: '#ff9d42',
    glow: '#ffd66b',
  },
  {
    id: 'moonlit_woods',
    name: '暮星林境',
    subtitle: '月光萤火与幽蓝溪瀑',
    tone: 'night',
    accent: '#f5c65c',
    glow: '#66e3ff',
  },
  {
    id: 'golden_oasis',
    name: '霜砂绿洲',
    subtitle: '古道岩拱与星尘绿洲',
    tone: 'sunset',
    accent: '#ffbe5c',
    glow: '#5ae6d0',
  },
  {
    id: 'alpine_snow',
    name: '雪峰圣境',
    subtitle: '皑皑雪岭与冰瀑营火',
    tone: 'day',
    accent: '#ffd872',
    glow: '#86e2ff',
  },
  {
    id: 'ashen_citadel',
    name: '烬火王城',
    subtitle: '黑曜城垛与熔岩裂瀑',
    tone: 'night',
    accent: '#ff7e47',
    glow: '#ff4f6e',
  },
] as const;

export const ACT_DEFAULT_THEME: readonly string[] = ['emerald_day', 'golden_oasis', 'ashen_citadel'] as const;
export const ACT_REALMS = [
  { name: '晴空翠谷', subtitle: '阳光松林与飞瀑溪谷' },
  { name: '霜砂绿洲', subtitle: '古道岩拱与星尘绿洲' },
  { name: '烬火王城', subtitle: '黑曜城垛与熔岩裂瀑' },
] as const;

export interface Biome {
  sky: [string, string, string];
  turf: number[];
  rock: number[];
  leaf: number[];
  flag: number;
  road: number;
  water: number;
  foam: number;
  key: number;
  fill: number;
  rim: number;
  cloud: number;
}

// Rock swatches run from the darkest hanging roots to the sunlit soil band.
export const BIOMES: Record<string, Biome> = {
  emerald_day: {
    sky: ['#458fbe', '#a8dddf', '#e6e7c3'],
    turf: [0x73ad55, 0x88bc5d, 0x96c569, 0x64a764],
    rock: [0x384c58, 0x576777, 0x7d8490, 0xa49681, 0x977755],
    leaf: [0x285e50, 0x36845e, 0x52a663, 0x86bb63],
    flag: 0x207390,
    road: 0xb8b098,
    water: 0x168f9c,
    foam: 0x9af9ec,
    key: 0xffebc6,
    fill: 0xc3e7ff,
    rim: 0xffdfa5,
    cloud: 0xfff5dd,
  },
  autumn_sunset: {
    sky: ['#a47799', '#f6b392', '#ffe0ab'],
    turf: [0xc6a05b, 0xb5a158, 0xd6af65, 0xaaa35d],
    rock: [0x594857, 0x896a70, 0xac8c84, 0xd1ae92, 0xa17b58],
    leaf: [0xa64435, 0xd45632, 0xef8735, 0xebbb46],
    flag: 0x8d3851,
    road: 0xd5b185,
    water: 0x3d97ae,
    foam: 0xffe6a1,
    key: 0xffc68d,
    fill: 0xe7cbdc,
    rim: 0xffb353,
    cloud: 0xffdec9,
  },
  moonlit_woods: {
    sky: ['#111b42', '#34476d', '#737c96'],
    turf: [0x426775, 0x456d72, 0x517a79, 0x526e85],
    rock: [0x262c49, 0x39425e, 0x53607e, 0x717790, 0x514e68],
    leaf: [0x213953, 0x2d5369, 0x386d73, 0x52827b],
    flag: 0x745aa0,
    road: 0x9194a7,
    water: 0x317daa,
    foam: 0x74eaff,
    key: 0xbbd6ff,
    fill: 0x9caff4,
    rim: 0xc2a1ff,
    cloud: 0x9caed5,
  },
  golden_oasis: {
    sky: ['#a296b7', '#e9ba9b', '#ffe5ae'],
    turf: [0xe2bb7c, 0xdeb074, 0xecc98a, 0xd8a770],
    rock: [0x614955, 0x995e52, 0xbe7859, 0xe09e73, 0xbf875b],
    leaf: [0x276d61, 0x388e6e, 0x62a76f, 0x8aba69],
    flag: 0x267b88,
    road: 0xb5906c,
    water: 0x14b3a6,
    foam: 0x8affdf,
    key: 0xffdfac,
    fill: 0xe1d9de,
    rim: 0xffcf8e,
    cloud: 0xffe6c9,
  },
  alpine_snow: {
    sky: ['#6d9ab9', '#c7e2ed', '#f4e6d7'],
    turf: [0xe1eef0, 0xd3e7eb, 0xc6dde7, 0xf2f4ed],
    rock: [0x384b66, 0x586c86, 0x8198a7, 0xa6b7be, 0x9aa8ab],
    leaf: [0x264c52, 0x39645f, 0x537d76, 0xe8f5ef],
    flag: 0xb34f3c,
    road: 0xa3b1b0,
    water: 0x67b8d2,
    foam: 0xc3f8ff,
    key: 0xffebd0,
    fill: 0xc7e1ff,
    rim: 0xffdfc4,
    cloud: 0xfffaf4,
  },
  ashen_citadel: {
    sky: ['#351f39', '#854856', '#d0886b'],
    turf: [0x494551, 0x554c56, 0x625360, 0x514755],
    rock: [0x272738, 0x3c374a, 0x504757, 0x705462, 0x61464c],
    leaf: [0x312f45, 0x4c4157, 0x65516b, 0x99635f],
    flag: 0x9d303b,
    road: 0x8a7272,
    water: 0xf25721,
    foam: 0xffc351,
    key: 0xffc0a0,
    fill: 0xb1a3d0,
    rim: 0xff7550,
    cloud: 0xad8999,
  },
};
