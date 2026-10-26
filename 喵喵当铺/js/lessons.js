import { ITEMS } from './data.js';

// First-encounter explanations only. Presentation, timing and remembered lessons
// belong to main/meta; these rules must not reveal an item's hidden facts.
export const MECHANIC_LESSONS = {
  inspection: {
    title: '验货线索',
    points: [
      '线索只建议先看哪里，不代表那里一定有问题。',
      '检查未查过的部位通常扣1点耐心，放大镜可免去每位客人首次检查的消耗。',
      '一处检查正常，不保证整件货没有问题。',
    ],
  },
  stolen: {
    title: '赃物与热度',
    points: [
      '赃物每晚热度降1，降到0就洗白，藏在暗格也会降热。',
      '货架上的赃物越多、热度越高，越容易招来警长。',
      '警长只查货架，查出赃物会没收并罚款，暗格里的查不到。',
    ],
  },
  contraband: {
    title: '违禁品',
    points: [
      '违禁品不会随过夜洗白。',
      '货架上的违禁品会增加查店概率，被查出会没收并罚款。',
      '藏入暗格可以避开查店。',
    ],
  },
  counterfeit: {
    title: '赝品',
    points: [
      '赝品的真实价值通常只有真品的一成五。',
      '收货时查出赝品，卖家会按实价重新报价。',
      '卖货时被买家识破，货会被丢掉，并扣买家所属阵营2点好感。',
    ],
  },
  water: {
    title: '水质与标签',
    points: [
      '标签不改变真实水质，试纸可以确认水质。',
      '检查试纸通常扣1点耐心，放大镜可免去每位客人首次检查的消耗。',
      '水质不符标签也可能被买家识破，货会被丢掉并扣对应阵营好感。',
    ],
  },
  impostor: {
    title: '观察与举报',
    points: [
      '可疑线索不代表一定是伪猫，一处正常也不能排除其他部位的异常。',
      '每看一个新部位扣1点耐心，与验货、议价共用，重复看同一处免费。',
      '有证据再举报：报对有赏金，误报扣好感，伪猫买家的假币次晨会消失。',
    ],
  },
};

export function itemLessonKeys(it, { stolenVisible = false } = {}) {
  if (!it || !Object.hasOwn(ITEMS, it.id)) return [];
  const keys = [];
  if (it.stolen && (it.stolenKnown || stolenVisible)) keys.push('stolen');
  if (ITEMS[it.id].ban) keys.push('contraband');
  if (it.fake && it.known) keys.push('counterfeit');
  if (it.id === 'water') keys.push('water');
  return keys;
}
