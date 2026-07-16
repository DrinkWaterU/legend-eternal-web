import { createMaterialSaleQuote, MATERIAL_SALE_POLICIES } from "../core/commerce.js";
import { getSellableMaterials } from "./materialList.js";

export function createGuildBulkDraft({ inventory, materialDefinitions, quantities = {} }) {
  const sellableItems = getSellableMaterials(inventory, materialDefinitions);
  const items = [];
  let totalQuantity = 0;
  let totalGold = 0;
  let totalReferenceGold = 0;

  sellableItems.forEach((item) => {
    const quantity = Number(quantities[item.id]);
    if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > item.quantity) return;
    const quote = getGuildBulkQuote(item, quantity, materialDefinitions);
    items.push({ ...item, ...quote });
    totalQuantity += quantity;
    totalGold += quote.totalGold;
    totalReferenceGold += quote.referenceGold;
  });

  return {
    items,
    totalQuantity,
    totalGold,
    totalReferenceGold,
    totalDifferenceGold: totalGold - totalReferenceGold,
    valid: items.length > 0 && items.every((item) => item.accepted)
  };
}

export function getVisibleGuildBulkMaterials({ inventory, materialDefinitions, filters }) {
  const query = String(filters.query || "").trim().toLocaleLowerCase("zh-Hant");
  const region = filters.region || "all";
  const items = getSellableMaterials(inventory, materialDefinitions).filter((item) => {
    const definition = materialDefinitions[item.id] || {};
    const tags = Array.isArray(definition.tags) ? definition.tags : [];
    if (region !== "all" && !tags.includes(region)) return false;
    if (!query) return true;
    return [item.name, item.source, item.description, item.usage]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("zh-Hant")
      .includes(query);
  });
  return [...items].sort((left, right) => {
    switch (filters.sort) {
      case "quantity-desc": return right.quantity - left.quantity || left.sortOrder - right.sortOrder;
      case "price-desc": return right.sellPrice - left.sellPrice || left.sortOrder - right.sortOrder;
      case "name": return left.name.localeCompare(right.name, "zh-Hant-TW");
      default: return left.sortOrder - right.sortOrder;
    }
  });
}

export function getGuildBulkQuote(item, quantity, materialDefinitions) {
  return createMaterialSaleQuote({
    materialDefinition: materialDefinitions[item.id],
    quantity,
    policyId: MATERIAL_SALE_POLICIES.GUILD_BULK,
    allowUnaccepted: true
  });
}
