import { pinyin } from 'pinyin-pro';

type SearchKey = { text: string; full: string; initials: string };
const keys = new Map<string, SearchKey>();

function compact(text: string): string {
  return text.normalize('NFKC').normalize('NFD').replace(/\p{M}/gu, '')
    .toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

function keyFor(text: string): SearchKey {
  const cached = keys.get(text);
  if (cached) return cached;
  const plain = text.replace(/<[^>]*>/g, ' ');
  const key = {
    text: compact(plain),
    full: compact(pinyin(plain, { toneType: 'none' })),
    initials: compact(pinyin(plain, { toneType: 'none', pattern: 'first' })),
  };
  // Keep repeated keystrokes cheap without retaining an unbounded text history.
  if (keys.size >= 2048) keys.clear();
  keys.set(text, key);
  return key;
}

/** Search the same catalog fields in Chinese, full pinyin or pinyin initials. */
export function matchesCodex(query: string, ...texts: string[]): boolean {
  const terms = query.trim().split(/\s+/u).map(compact).filter(Boolean);
  if (!terms.length) return true;
  const fields = texts.filter(Boolean).map(keyFor);
  return terms.every(term => fields.some(key => key.text.includes(term)
    || key.full.includes(term) || key.initials.includes(term)));
}
