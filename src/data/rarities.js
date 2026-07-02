export const DEFAULT_BLESSING_RARITY = "common";

export const BLESSING_RARITIES = {
  common: {
    id: "common",
    label: "常見",
    weight: 100
  },
  uncommon: {
    id: "uncommon",
    label: "優良",
    weight: 55
  },
  rare: {
    id: "rare",
    label: "稀有",
    weight: 25
  },
  epic: {
    id: "epic",
    label: "史詩",
    weight: 8
  },
  legendary: {
    id: "legendary",
    label: "傳說",
    weight: 2
  }
};

export function getBlessingRarity(rarityId) {
  return BLESSING_RARITIES[rarityId] || BLESSING_RARITIES[DEFAULT_BLESSING_RARITY];
}
