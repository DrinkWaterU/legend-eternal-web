import materialsData from "./materials.json" with { type: "json" };

export const MATERIAL_RARITIES = {
  common: {
    id: "common",
    label: "普通",
    rank: 1
  },
  uncommon: {
    id: "uncommon",
    label: "少見",
    rank: 2
  },
  rare: {
    id: "rare",
    label: "稀有",
    rank: 3
  },
  epic: {
    id: "epic",
    label: "史詩",
    rank: 4
  },
  quest: {
    id: "quest",
    label: "任務",
    rank: 5
  }
};

export const DEFAULT_MATERIAL_RARITY = "common";
export const materialDefinitions = materialsData;

export function getMaterialDefinition(materialId) {
  return materialDefinitions[materialId] || null;
}

export function getMaterialRarity(rarityId) {
  return MATERIAL_RARITIES[rarityId] || MATERIAL_RARITIES[DEFAULT_MATERIAL_RARITY];
}
