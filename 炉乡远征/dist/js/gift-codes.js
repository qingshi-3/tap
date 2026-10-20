// Activity identity is permanent; aliases must share this receipt to prevent repeat grants.
// safe-v2 只发金币：原 1200 金币 + 30 宝珠按 20 金币/宝珠折算。
export const GIFT_CODES = Object.freeze([Object.freeze({ id: 'return-20261016', code: 'LX2026', coins: 1800 })]);
export function findGiftCode(input) {
  if (typeof input !== 'string' || input.length > 64) return null;
  const code = input.normalize('NFKC').trim().toUpperCase();
  if (!/^[A-Z0-9]{1,32}$/.test(code)) return null;
  return GIFT_CODES.find(gift => gift.code === code) ?? null;
}
// Imported safe-v1 receipts keep the claimed amount they were converted at.
export function validateGiftCodeClaims(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false;
  return Object.entries(value).every(([id, receipt]) => {
    const gift = GIFT_CODES.find(entry => entry.id === id);
    return !!gift && !!receipt && typeof receipt === 'object' && !Array.isArray(receipt)
      && Object.keys(receipt).sort().join(',') === 'code,coins' && receipt.code === gift.code
      && Number.isSafeInteger(receipt.coins) && receipt.coins >= 0;
  });
}
