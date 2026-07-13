import { getMaterialRarity } from "../data/materials.js";

const MATERIAL_SORT_MODES = Object.freeze({
  rarity: compareByRarity,
  quantity: compareByQuantity,
  sellPrice: compareBySellPrice,
  name: compareByName
});

export function getInventoryMaterials(inventory = {}, materialDefinitions = {}) {
  const materials = inventory.materials || {};
  return Object.entries(materials)
    .map(([materialId, material]) => {
      const definition = materialDefinitions[materialId] || {};
      const quantity = Number.isFinite(material?.quantity) ? material.quantity : 0;
      return {
        id: materialId,
        name: definition.name || material?.name || materialId,
        rarity: definition.rarity || "common",
        category: definition.category || "material",
        description: definition.description || "",
        usage: definition.usage || "",
        source: definition.source || "",
        sellPrice: Number.isSafeInteger(definition.sellPrice) ? definition.sellPrice : 0,
        sortOrder: Number.isFinite(definition.sortOrder) ? definition.sortOrder : 9999,
        quantity
      };
    })
    .filter((item) => item.quantity > 0);
}

export function getSellableMaterials(inventory = {}, materialDefinitions = {}) {
  return getInventoryMaterials(inventory, materialDefinitions).filter((item) => item.sellPrice > 0);
}

export function sortMaterials(items, sortMode, sortDirection) {
  const normalizedSortMode = MATERIAL_SORT_MODES[sortMode] ? sortMode : "rarity";
  const sorter = MATERIAL_SORT_MODES[normalizedSortMode];
  const direction = sortDirection === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    if (normalizedSortMode === "rarity") {
      const rankDiff = getMaterialRarity(b.rarity).rank - getMaterialRarity(a.rarity).rank;
      if (rankDiff !== 0) {
        return sortDirection === "asc" ? -rankDiff : rankDiff;
      }
      const orderDiff = a.sortOrder - b.sortOrder;
      if (orderDiff !== 0) {
        return orderDiff;
      }
      return compareByName(a, b);
    }
    const result = sorter(a, b);
    if (result !== 0) {
      return result * direction;
    }
    return compareByName(a, b);
  });
}

function compareByRarity(a, b) {
  const rankDiff = getMaterialRarity(a.rarity).rank - getMaterialRarity(b.rarity).rank;
  if (rankDiff !== 0) {
    return rankDiff;
  }
  return a.sortOrder - b.sortOrder;
}

function compareByQuantity(a, b) {
  return a.quantity - b.quantity;
}

function compareBySellPrice(a, b) {
  return a.sellPrice - b.sellPrice;
}

function compareByName(a, b) {
  return a.name.localeCompare(b.name, "zh-Hant");
}
