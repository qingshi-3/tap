// Optional art has readable renderer fallbacks. Bound network waits and report actual failures.
export const assetFailures = new Set();
const imageRequests = new Map();
const fetchRequests = new Map();
const queuedRequests = new Map();
// Start deadlines only when a request owns a network slot. A cold mobile host
// otherwise queues hundreds of FX requests ahead of later faction atlases.
const requestQueue = [];
let activeRequests = 0;
function scheduledRequest(work, key, priority = 0) {
  return new Promise((resolve, reject) => {
    const job = { work, resolve, reject, key, priority };
    if (key) queuedRequests.set(key, job);
    requestQueue.push(job);
    pumpRequests();
  });
}
function pumpRequests() {
  while (activeRequests < 6 && requestQueue.length) {
    const high = requestQueue.findIndex(job => job.priority > 0);
    const [job] = requestQueue.splice(high < 0 ? 0 : high, 1);
    if (job.key) queuedRequests.delete(job.key);
    activeRequests++;
    Promise.resolve().then(job.work).then(job.resolve, job.reject).finally(() => { activeRequests--; pumpRequests(); });
  }
}
export async function assetFont(face) {
  let timer;
  try {
    return await Promise.race([face.load(), new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Font timeout')), 12000);
    })]);
  } catch (error) { assetFailures.add(`font:${face.family}`); throw error; }
  finally { clearTimeout(timer); }
}
function absolute(path) {
  try { return new URL(String(path), globalThis.document?.baseURI ?? globalThis.location?.href).href; }
  catch { return String(path); }
}
export function prioritizeAsset(path) {
  const key = absolute(path);
  for (const kind of ['image:', 'fetch:']) {
    const job = queuedRequests.get(kind + key);
    if (job) job.priority = 1;
  }
}
export function assetImage(path, { priority = 0 } = {}) {
  const source = String(path), cacheable = !source.startsWith('blob:');
  const key = absolute(source);
  if (cacheable && imageRequests.has(key)) { if (priority > 0) prioritizeAsset(source); return imageRequests.get(key); }
  const request = scheduledRequest(() => new Promise(resolve => {
    let image, timer, settled = false, decoding = false;
    const finish = value => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      if (image) {
        image.onload = image.onerror = null;
        if (!value) { try { image.src = ''; } catch {} }
      }
      if (cacheable) { if (!value) assetFailures.add(path); else assetFailures.delete(path); }
      resolve(value);
    };
    try {
      image = new Image();
      image.onload = async () => {
        if (settled || decoding) return;
        decoding = true;
        try { if (typeof image.decode === 'function') await image.decode(); finish(image); }
        catch { finish(image.complete && image.naturalWidth > 0 ? image : null); }
      };
      image.onerror = () => finish(null);
      // One deadline covers the network and decode phases together.
      timer = setTimeout(() => finish(null), 12000);
      image.src = source;
    } catch { finish(null); }
  }), cacheable ? `image:${key}` : null, priority);
  const cached = request.then(value => {
    if (!value && cacheable && imageRequests.get(key) === cached) imageRequests.delete(key);
    return value;
  });
  if (cacheable) imageRequests.set(key, cached);
  return cached;
}
export function assetFetch(path, { priority = 0 } = {}) {
  const key = absolute(path);
  if (fetchRequests.has(key)) { if (priority > 0) prioritizeAsset(path); return fetchRequests.get(key); }
  const request = scheduledRequest(async () => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(path, { signal: controller.signal });
    if (!response.ok) throw new Error(`Resource ${response.status}`);
    // Consume the body inside the timeout, rather than timing only response headers.
    const body = await response.text();
    assetFailures.delete(path);
    return { ok: true, text: async () => body };
  } catch (error) { assetFailures.add(path); throw error; }
  finally { clearTimeout(timer); }
  }, `fetch:${key}`, priority);
  const cached = request.catch(error => { if (fetchRequests.get(key) === cached) fetchRequests.delete(key); throw error; });
  fetchRequests.set(key, cached);
  return cached;
}
