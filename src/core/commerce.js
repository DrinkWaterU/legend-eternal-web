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

export function createInventoryCostPlan({ inventory, materialDefinitions = {}, goldCost, materialCosts = [] }) {
  if (!inventory || typeof inventory !== "object") {
    throw new Error("付款需要有效的 inventory。");
  }
  if (!Number.isSafeInteger(goldCost) || goldCost < 0) {
    throw new Error("付款金額必須是非負 safe integer。");
  }

  const currentGold = Number(inventory.gold);
  if (!Number.isSafeInteger(currentGold) || currentGold < 0) {
    throw new Error("目前金幣資料無效。");
  }
  if (currentGold < goldCost) {
    throw new Error("金幣不足。");
  }
  if (!Array.isArray(materialCosts)) {
    throw new Error("素材付款清單必須是陣列。");
  }

  const sourceMaterials = inventory.materials;
  if (materialCosts.length > 0 && (!sourceMaterials || typeof sourceMaterials !== "object" || Array.isArray(sourceMaterials))) {
    throw new Error("付款需要有效的素材庫存。");
  }

  const nextMaterials = sourceMaterials && typeof sourceMaterials === "object" && !Array.isArray(sourceMaterials)
    ? { ...sourceMaterials }
    : {};
  const materialIds = new Set();
  const items = [];

  materialCosts.forEach((cost) => {
    const materialId = cost?.materialId;
    const quantity = cost?.quantity;
    if (typeof materialId !== "string" || !materialId.trim()) {
      throw new Error("付款素材 ID 無效。");
    }
    if (materialIds.has(materialId)) {
      throw new Error(`付款清單包含重複素材：${materialId}`);
    }
    materialIds.add(materialId);
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      throw new Error("付款素材數量必須是正 safe integer。");
    }

    const definition = materialDefinitions[materialId];
    if (!definition) {
      throw new Error(`找不到素材 definition：${materialId}`);
    }

    const material = sourceMaterials[materialId];
    const heldQuantity = Number(material?.quantity);
    if (!Number.isSafeInteger(heldQuantity) || heldQuantity < quantity) {
      throw new Error(`${definition.name || materialId}持有數量不足。`);
    }

    const remainingQuantity = heldQuantity - quantity;
    if (!Number.isSafeInteger(remainingQuantity) || remainingQuantity < 0) {
      throw new Error("素材付款結果超出可安全處理範圍。");
    }

    if (remainingQuantity === 0) {
      delete nextMaterials[materialId];
    } else {
      nextMaterials[materialId] = {
        ...material,
        quantity: remainingQuantity
      };
    }
    items.push({
      materialId,
      name: definition.name || materialId,
      quantity,
      remainingQuantity
    });
  });

  const nextGold = currentGold - goldCost;
  if (!Number.isSafeInteger(nextGold) || nextGold < 0) {
    throw new Error("付款結果超出可安全處理範圍。");
  }

  return {
    goldCost,
    materialCosts: items,
    gold: nextGold,
    materials: nextMaterials
  };
}

export function spendInventoryCost({ inventory, materialDefinitions = {}, goldCost, materialCosts = [] }) {
  const plan = createInventoryCostPlan({ inventory, materialDefinitions, goldCost, materialCosts });
  inventory.gold = plan.gold;
  if (materialCosts.length > 0) {
    inventory.materials = plan.materials;
  }
  return plan;
}

export function spendGold(inventory, cost) {
  const result = spendInventoryCost({
    inventory,
    goldCost: cost,
    materialCosts: []
  });
  return {
    cost: result.goldCost,
    gold: result.gold
  };
}

export function getInventoryCostStatus({
  inventory,
  materialDefinitions = {},
  goldCost,
  materialCosts = []
}) {
  const currentGold = Number.isSafeInteger(inventory?.gold) && inventory.gold >= 0
    ? inventory.gold
    : 0;
  const materials = Array.isArray(materialCosts)
    ? materialCosts.map((cost) => {
      const definition = materialDefinitions[cost?.materialId];
      const heldQuantity = Number(inventory?.materials?.[cost?.materialId]?.quantity);
      const quantity = Number.isSafeInteger(cost?.quantity) && cost.quantity > 0
        ? cost.quantity
        : 0;
      return {
        materialId: cost?.materialId || null,
        name: definition?.name || cost?.materialId || "未知素材",
        quantity,
        heldQuantity: Number.isSafeInteger(heldQuantity) && heldQuantity >= 0 ? heldQuantity : 0,
        enough: Boolean(definition) && quantity > 0 && Number.isSafeInteger(heldQuantity) && heldQuantity >= quantity
      };
    })
    : [];
  const normalizedGoldCost = Number.isSafeInteger(goldCost) && goldCost >= 0 ? goldCost : 0;

  return {
    goldCost: normalizedGoldCost,
    currentGold,
    goldEnough: currentGold >= normalizedGoldCost,
    materialCosts: materials,
    affordable: currentGold >= normalizedGoldCost && materials.every((item) => item.enough)
  };
}

export function craftWeapon({
  inventory,
  weapon,
  materialDefinitions = {}
}) {
  if (!inventory || typeof inventory !== "object") {
    throw new Error("製作需要有效的 inventory。");
  }
  if (!weapon || typeof weapon.id !== "string" || !weapon.id) {
    throw new Error("製作需要有效的武器 definition。");
  }
  if (inventory.weapons?.[weapon.id] === true) {
    throw new Error(`已擁有${weapon.name || weapon.id}。`);
  }
  if (!weapon.recipe || typeof weapon.recipe !== "object") {
    throw new Error(`${weapon.name || weapon.id}缺少有效配方。`);
  }

  const plan = createInventoryCostPlan({
    inventory,
    materialDefinitions,
    goldCost: weapon.recipe.goldCost,
    materialCosts: weapon.recipe.materialCosts
  });
  const nextWeapons = inventory.weapons && typeof inventory.weapons === "object" && !Array.isArray(inventory.weapons)
    ? { ...inventory.weapons }
    : {};
  nextWeapons[weapon.id] = true;

  inventory.gold = plan.gold;
  inventory.materials = plan.materials;
  inventory.weapons = nextWeapons;

  return {
    weaponId: weapon.id,
    weaponName: weapon.name || weapon.id,
    goldCost: plan.goldCost,
    materialCosts: plan.materialCosts,
    gold: plan.gold
  };
}
