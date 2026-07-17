export const GUILD_BULK_TIER_LABELS = Object.freeze({
  "below-minimum": "未達收購標準",
  small: "少量交付 90%",
  large: "大量交付 110%",
  bulk: "大宗交付 115%"
});

export const GUILD_BULK_TIER_CLASS_NAMES = Object.freeze({
  "below-minimum": "ineligible",
  small: "low",
  large: "standard",
  bulk: "bulk"
});

export function getNextGuildBulkTierHint(quantity, heldQuantity) {
  if (quantity <= 0) return "最低 5 件起收";
  if (quantity < 5) return `再增加 ${5 - quantity} 件可受理`;
  if (quantity < 10) return heldQuantity >= 10 ? `再增加 ${10 - quantity} 件可提升至 110%` : "目前持有量無法進入下一級距";
  if (quantity < 20) return heldQuantity >= 20 ? `再增加 ${20 - quantity} 件可提升至 115%` : "目前持有量無法進入下一級距";
  return "已達最高大宗級距";
}

export function formatGuildBulkDifference(value) {
  if (!Number.isSafeInteger(value) || value === 0) return "0 G";
  return `${value > 0 ? "＋" : "−"}${Math.abs(value)} G`;
}
