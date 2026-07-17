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

