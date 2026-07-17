export const MATERIAL_SALE_POLICIES = Object.freeze({
  STANDARD: "standard",
  GUILD_BULK: "guild-bulk"
});

const GUILD_BULK_TIERS = Object.freeze([
  Object.freeze({ id: "below-minimum", minimum: 1, maximum: 4, percent: 0, accepted: false }),
  Object.freeze({ id: "small", minimum: 5, maximum: 9, percent: 90, accepted: true }),
  Object.freeze({ id: "large", minimum: 10, maximum: 19, percent: 110, accepted: true }),
  Object.freeze({ id: "bulk", minimum: 20, maximum: Number.MAX_SAFE_INTEGER, percent: 115, accepted: true })
]);

export function getMaterialSaleTier(policyId = MATERIAL_SALE_POLICIES.STANDARD, quantity) {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new Error("出售數量必須是正整數。");
  }
  if (policyId === MATERIAL_SALE_POLICIES.STANDARD) {
    return Object.freeze({ id: "standard", minimum: 1, maximum: Number.MAX_SAFE_INTEGER, percent: 100, accepted: true });
  }
  if (policyId === MATERIAL_SALE_POLICIES.GUILD_BULK) {
    return GUILD_BULK_TIERS.find((tier) => quantity >= tier.minimum && quantity <= tier.maximum) || null;
  }
  throw new Error(`未知素材出售政策：${policyId || "(empty)"}`);
}

export function createMaterialSaleQuote({
  materialDefinition,
  quantity,
  policyId = MATERIAL_SALE_POLICIES.STANDARD,
  allowUnaccepted = false
}) {
  if (!materialDefinition || typeof materialDefinition !== "object") {
    throw new Error("找不到素材 definition。");
  }
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new Error("出售數量必須是正整數。");
  }
  const unitPrice = Number(materialDefinition.sellPrice);
  if (!Number.isSafeInteger(unitPrice) || unitPrice <= 0) {
    throw new Error(`${materialDefinition.name || materialDefinition.id || "素材"}目前不可出售。`);
  }
  const tier = getMaterialSaleTier(policyId, quantity);
  if (!tier) {
    throw new Error("無法判定素材出售級距。");
  }
  if (!tier.accepted && !allowUnaccepted) {
    throw new Error("公會只受理同種五件以上的素材。");
  }

  const referenceGold = unitPrice * quantity;
  const totalGold = Math.floor(referenceGold * tier.percent / 100);
  const differenceGold = totalGold - referenceGold;
  if (![referenceGold, totalGold, differenceGold].every(Number.isSafeInteger)) {
    throw new Error("交易金額超出可安全處理範圍。");
  }

  return {
    policyId,
    tierId: tier.id,
    accepted: tier.accepted,
    percent: tier.percent,
    quantity,
    unitPrice,
    referenceGold,
    totalGold,
    differenceGold
  };
}

export function createMaterialSalePlan({
  inventory,
  materialDefinitions = {},
  sales,
  policyId = MATERIAL_SALE_POLICIES.STANDARD
}) {
  if (!inventory || typeof inventory !== "object" || !inventory.materials || typeof inventory.materials !== "object") {
    throw new Error("交易需要有效的 inventory。");
  }
  if (!Array.isArray(sales) || sales.length === 0) {
    throw new Error("批次交易至少需要一項素材。");
  }

  const currentGold = Number(inventory.gold);
  if (!Number.isSafeInteger(currentGold) || currentGold < 0) {
    throw new Error("目前金幣資料無效。");
  }

  const materialIds = new Set();
  const items = [];
  let totalQuantity = 0;
  let totalGold = 0;
  let totalReferenceGold = 0;

  sales.forEach((sale) => {
    const materialId = sale?.materialId;
    const quantity = sale?.quantity;
    if (typeof materialId !== "string" || !materialId) {
      throw new Error("出售素材 ID 無效。");
    }
    if (materialIds.has(materialId)) {
      throw new Error(`批次交易包含重複素材：${materialId}`);
    }
    materialIds.add(materialId);

    const definition = materialDefinitions[materialId];
    if (!definition) {
      throw new Error(`找不到素材 definition：${materialId}`);
    }
    const material = inventory.materials[materialId];
    const heldQuantity = Number(material?.quantity);
    if (!Number.isSafeInteger(heldQuantity) || heldQuantity < quantity) {
      throw new Error(`${definition.name || materialId}持有數量不足。`);
    }

    const quote = createMaterialSaleQuote({
      materialDefinition: definition,
      quantity,
      policyId
    });
    const nextTotalQuantity = totalQuantity + quantity;
    const nextTotalGold = totalGold + quote.totalGold;
    const nextTotalReferenceGold = totalReferenceGold + quote.referenceGold;
    if (![nextTotalQuantity, nextTotalGold, nextTotalReferenceGold].every(Number.isSafeInteger)) {
      throw new Error("交易金額超出可安全處理範圍。");
    }

    const remainingQuantity = heldQuantity - quantity;
    items.push({
      materialId,
      name: definition.name || materialId,
      quantity,
      unitPrice: quote.unitPrice,
      policyId: quote.policyId,
      tierId: quote.tierId,
      percent: quote.percent,
      referenceGold: quote.referenceGold,
      differenceGold: quote.differenceGold,
      totalGold: quote.totalGold,
      remainingQuantity
    });
    totalQuantity = nextTotalQuantity;
    totalGold = nextTotalGold;
    totalReferenceGold = nextTotalReferenceGold;
  });

  const nextGold = currentGold + totalGold;
  if (!Number.isSafeInteger(nextGold)) {
    throw new Error("交易金額超出可安全處理範圍。");
  }

  return {
    policyId,
    items,
    totalQuantity,
    totalGold,
    totalReferenceGold,
    totalDifferenceGold: totalGold - totalReferenceGold,
    gold: nextGold
  };
}

export function sellMaterials({
  inventory,
  materialDefinitions = {},
  sales,
  policyId = MATERIAL_SALE_POLICIES.STANDARD
}) {
  const plan = createMaterialSalePlan({ inventory, materialDefinitions, sales, policyId });
  const nextMaterials = { ...inventory.materials };

  plan.items.forEach((item) => {
    if (item.remainingQuantity === 0) {
      delete nextMaterials[item.materialId];
      return;
    }
    nextMaterials[item.materialId] = {
      ...nextMaterials[item.materialId],
      quantity: item.remainingQuantity
    };
  });

  inventory.materials = nextMaterials;
  inventory.gold = plan.gold;

  return plan;
}

export function sellMaterial({
  inventory,
  materialDefinitions = {},
  materialId,
  quantity,
  policyId = MATERIAL_SALE_POLICIES.STANDARD
}) {
  const result = sellMaterials({
    inventory,
    materialDefinitions,
    sales: [{ materialId, quantity }],
    policyId
  });
  return {
    ...result.items[0],
    gold: result.gold
  };
}

