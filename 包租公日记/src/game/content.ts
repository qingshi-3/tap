import type { Property, Tenant, Event } from "./index";
export const properties: Property[] = [
    ["xingfu-402", "幸福里402", "xingfu", 50000, 1200],
    ["xingfu-403", "幸福里403", "xingfu", 80000, 1200],
    ["xingfu-301", "幸福里301", "xingfu", 120000, 1800],
    ["university-101", "大学城101", "university", 250000, 2500],
    ["tech-302", "科技园302", "tech", 600000, 6000],
].map(([id, name, regionId, baseValue, baseRent]) => ({
    id: String(id),
    name: String(name),
    regionId: String(regionId),
    capacity: 3,
    baseValue: Number(baseValue),
    baseRent: Number(baseRent),
    mortgage: { downPaymentRate: 0.25, months: 120, annualRate: 0.036 },
}));
export const tenants: Tenant[] = [
    {
        id: "zhangwei",
        name: "张伟",
        budget: 1500,
        job: "程序员",
        description: "月收入8000，重视稳定网络",
    },
    {
        id: "xiaolin",
        name: "小林",
        budget: 800,
        job: "大学生",
        description: "预算有限，期待舒适住所",
    },
    {
        id: "ajie",
        name: "阿杰",
        budget: 1200,
        job: "摄影师",
        description: "工作灵活，愿意改善生活",
    },
    {
        id: "wangjie",
        name: "王姐",
        budget: 2000,
        job: "家庭租客",
        description: "熟悉街坊，愿意长期安住",
    },
    {
        id: "lina",
        name: "李娜",
        budget: 2500,
        job: "设计师",
        description: "重视品质，事业正在成长",
    },
    ...[['chenchen', '陈晨', 900, '护士'], ['liuyang', '刘洋', 1100, '厨师'], ['xiaoyu', '小雨', 700, '研究生'], ['zhouhang', '周航', 1400, '快递员'], ['sunli', '孙莉', 1600, '教师'], ['wutong', '吴桐', 1800, '工程师'], ['linfeng', '林枫', 1000, '店员'], ['zhaomin', '赵敏', 1300, '会计'], ['heping', '何平', 1900, '医生'], ['tangtang', '唐糖', 850, '插画师']].map(([id, name, budget, job]) => ({ id: String(id), name: String(name), budget: Number(budget), job: String(job), description: '期待稳定住所' })),
];
export const renovations = [
    {
        id: "simple",
        name: "简单装修",
        cost: 2000,
        months: 1,
        rentMultiplier: 1.3,
    },
    {
        id: "modern",
        name: "现代装修",
        cost: 10000,
        months: 1,
        rentMultiplier: 1.5,
    },
    {
        id: "premium",
        name: "精品装修",
        cost: 50000,
        months: 2,
        rentMultiplier: 2,
    },
];
export const regions = [
    { id: "xingfu", name: "幸福里", description: "成熟社区，稳健的小房起点" },
    { id: "university", name: "大学城", description: "毕业季带来新住户" },
    { id: "tech", name: "科技园", description: "就业与住房需求共同成长" },
];
export const events: Event[] = [
    {
        id: "network",
        title: "张伟想升级网络",
        text: "张伟在家写代码，想换上稳定的宽带。",
        trigger: { month: 2, tenantId: "zhangwei", once: true },
        choices: [
            {
                id: "upgrade",
                label: "安装高速宽带",
                cost: 300,
                description: "关系 +20",
                effects: { relationship: 20 },
            },
            { id: "later", label: "暂缓升级", effects: { relationship: -5 } },
        ],
    },
    {
        id: "promotion",
        title: "张伟升职了",
        text: "张伟晋升高级工程师，愿意继续住在这里。",
        trigger: {
            month: 3,
            tenantId: "zhangwei",
            minRelationship: 80,
            once: true,
        },
        choices: [
            {
                id: "congratulate",
                label: "祝贺他",
                description: "租房预算增加500",
                effects: { relationship: 5, job: "高级工程师", budgetGrowth: 5 },
            },
        ],
    },
    {
        id: "repair-request",
        title: "水龙头漏水",
        text: "租客希望尽快修好漏水的水龙头。",
        trigger: { month: 6, requiresTenant: true, maxCondition: 79 },
        choices: [
            {
                id: "help",
                label: "安排维修",
                cost: 300,
                description: "房况恢复，关系 +10",
                effects: { condition: 100, relationship: 10 },
            },
            { id: "wait", label: "暂缓处理", effects: { relationship: -15 } },
        ],
    },
    {
        id: "neighbor",
        title: "邻居准备出售403",
        text: "幸福里403的房主准备出售。首付25%即可购入，记得留出月供。",
        trigger: { month: 1, once: true },
        choices: [{ id: "noted", label: "记下这个机会", effects: {} }],
    },
    {
        id: "metro",
        title: "地铁建设传来消息",
        text: "幸福里将改善交通连接，周边房屋的长期需求有望提升。",
        trigger: { month: 4, once: true },
        choices: [{ id: "noted", label: "知道了", effects: {} }],
    },
];
