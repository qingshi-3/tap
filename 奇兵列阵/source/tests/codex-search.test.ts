import { describe, expect, it } from 'vitest';
import { matchesCodex } from '../src/core/codexSearch';

describe('catalog search', () => {
  it('finds names by Chinese, pinyin, initials, case and tone marks', () => {
    for (const q of ['雪原', 'xueyuan', 'xue yuan xiao yao', 'XYXY', 'xuěyuánxiǎoyāo', 'ｘｕｅｙｕａｎ']) {
      expect(matchesCodex(q, '雪原小妖'), q).toBe(true);
    }
    expect(matchesCodex('yongbing', '佣兵')).toBe(true);
    expect(matchesCodex('bingfengjuanzhou', '冰封卷轴')).toBe(true);
    expect(matchesCodex('bfjz', '冰封卷轴')).toBe(true);
  });

  it('uses phrase readings and matches query terms across related fields', () => {
    expect(matchesCodex('zhongchui', '溅射重锤')).toBe(true);
    expect(matchesCodex('changqiang', '长枪兵')).toBe(true);
    expect(matchesCodex('jiangjun', '推荐将军')).toBe(true);
    expect(matchesCodex('雪原 hanyi', '雪原小妖', '施法叠加寒意')).toBe(true);
    expect(matchesCodex('xyxy 寒冰', '雪原小妖', '寒冰')).toBe(true);
    expect(matchesCodex('gd', '战旗', '相邻友军获得攻击')).toBe(false);
    expect(matchesCodex('根本不存在', '雪原小妖', '寒冰')).toBe(false);
  });

  it('restores all entries for cleared search and treats markup as text only', () => {
    expect(matchesCodex('  ', '战旗')).toBe(true);
    expect(matchesCodex('ge dang', '<b>格挡</b>抵消一次伤害')).toBe(true);
    expect(matchesCodex('script', '战旗')).toBe(false);
  });
});
