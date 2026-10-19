// Activity identity is permanent; aliases must share this receipt to prevent repeat grants.
export const GIFT_CODES = Object.freeze([Object.freeze({ id: 'return-20261016', code: 'LX2026', coins: 1200, orbs: 30 })]);
// Preserve receipts issued by the local preview before the launch reward was raised.
// They remain claimed; do not invalidate saves or grant the same activity twice.
const PREVIEW_RECEIPT = Object.freeze({ id: 'return-20261016', code: 'LX2026', coins: 200, orbs: 10 });
export function findGiftCode(input) {
  if (typeof input !== 'string' || input.length > 64) return null;
  const code = input.normalize('NFKC').trim().toUpperCase();
  if (!/^[A-Z0-9]{1,32}$/.test(code)) return null;
  return GIFT_CODES.find(gift => gift.code === code) ?? null;
}
export function validateGiftCodeClaims(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false;
  return Object.entries(value).every(([id, receipt]) => {
    const gift = GIFT_CODES.find(entry => entry.id === id);
    return !!gift && !!receipt && typeof receipt === 'object' && !Array.isArray(receipt)
      && Object.keys(receipt).sort().join(',') === 'code,coins,orbs'
      && [gift, PREVIEW_RECEIPT].some(revision => revision.id === id && receipt.code === revision.code
        && receipt.coins === revision.coins && receipt.orbs === revision.orbs);
  });
}
