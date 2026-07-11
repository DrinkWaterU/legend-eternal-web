function createMaterialSalePlan({ inventory, materialDefinitions = {}, sales }) {
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

    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      throw new Error("出售數量必須是正整數。");
    }

    const definition = materialDefinitions[materialId];
    if (!definition) {
      throw new Error(`找不到素材 definition：${materialId}`);
    }
    const unitPrice = Number(definition.sellPrice);
    if (!Number.isSafeInteger(unitPrice) || unitPrice <= 0) {
      throw new Error(`${definition.name || materialId}目前不可出售。`);
    }

    const material = inventory.materials[materialId];
    const heldQuantity = Number(material?.quantity);
    if (!Number.isSafeInteger(heldQuantity) || heldQuantity < quantity) {
      throw new Error(`${definition.name || materialId}持有數量不足。`);
    }

    const itemTotalGold = unitPrice * quantity;
    const nextTotalQuantity = totalQuantity + quantity;
    const nextTotalGold = totalGold + itemTotalGold;
    if (
      !Number.isSafeInteger(itemTotalGold)
      || !Number.isSafeInteger(nextTotalQuantity)
      || !Number.isSafeInteger(nextTotalGold)
    ) {
      throw new Error("交易金額超出可安全處理範圍。");
    }

    const remainingQuantity = heldQuantity - quantity;
    items.push({
      materialId,
      name: definition.name || materialId,
      quantity,
      unitPrice,
      totalGold: itemTotalGold,
      remainingQuantity
    });
    totalQuantity = nextTotalQuantity;
    totalGold = nextTotalGold;
  });

  const nextGold = currentGold + totalGold;
  if (!Number.isSafeInteger(nextGold)) {
    throw new Error("交易金額超出可安全處理範圍。");
  }

  return {
    items,
    totalQuantity,
    totalGold,
    gold: nextGold
  };
}

export function sellMaterials({ inventory, materialDefinitions = {}, sales }) {
  const plan = createMaterialSalePlan({ inventory, materialDefinitions, sales });
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

export function sellMaterial({ inventory, materialDefinitions = {}, materialId, quantity }) {
  const result = sellMaterials({
    inventory,
    materialDefinitions,
    sales: [{ materialId, quantity }]
  });
  return {
    ...result.items[0],
    gold: result.gold
  };
}

function createInventoryCostPlan({ inventory, materialDefinitions = {}, goldCost, materialCosts = [] }) {
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
