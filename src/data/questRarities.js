export const QUEST_RARITIES = Object.freeze({
  common: Object.freeze({ id: "common", label: "普通", rank: 1, weight: 100 }),
  advanced: Object.freeze({ id: "advanced", label: "進階", rank: 2, weight: 70 }),
  rare: Object.freeze({ id: "rare", label: "稀有", rank: 3, weight: 0 })
});

export const QUEST_RARITY_IDS = Object.freeze(Object.keys(QUEST_RARITIES));

export function getQuestRarity(rarityId) {
  return QUEST_RARITIES[rarityId] || null;
}
