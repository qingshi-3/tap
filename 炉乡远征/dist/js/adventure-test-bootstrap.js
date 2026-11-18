// The mobile self-test package loads this entry instead of main.js. Install the
// sandbox before importing any game modules, including profile migration code.
function createMemoryStorage() {
  const values = new Map();
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][Number(index)] ?? null; },
    getItem(key) { return values.get(String(key)) ?? null; },
    setItem(key, value) { values.set(String(key), String(value)); },
    removeItem(key) { values.delete(String(key)); },
    clear() { values.clear(); },
  };
}

try {
  Object.defineProperty(globalThis, 'localStorage', { value: createMemoryStorage(), configurable: false });
  Object.defineProperty(globalThis, 'sessionStorage', { value: createMemoryStorage(), configurable: false });
  // Host injection can arrive after this module. Reads stay unavailable so the
  // self-test cannot read/write real cloud archives, awards, rankings or ads.
  Object.defineProperty(globalThis, 'tap', { get: () => undefined, set() {}, configurable: false });
} catch (error) {
  document.body.replaceChildren();
  const message = document.createElement('p');
  message.textContent = '测试环境初始化失败，请关闭后重新打开自测包。';
  document.body.append(message);
  throw error;
}

await import('./main.js');
