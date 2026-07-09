export function sellMaterial({ inventory, materialDefinitions = {}, materialId, quantity }) {
  if (!inventory || typeof inventory !== "object" || !inventory.materials || typeof inventory.materials !== "object") {
    throw new Error("交易需要有效的 inventory。");
  }
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new Error("出售數量必須是正整數。");
  }

  const definition = materialDefinitions[materialId];
  if (!definition) {
    throw new Error(`找不到素材 definition：${materialId || "(empty)"}`);
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

  const currentGold = Number(inventory.gold);
  if (!Number.isSafeInteger(currentGold) || currentGold < 0) {
    throw new Error("目前金幣資料無效。");
  }

  const totalGold = unitPrice * quantity;
  const nextGold = currentGold + totalGold;
  if (!Number.isSafeInteger(totalGold) || !Number.isSafeInteger(nextGold)) {
    throw new Error("交易金額超出可安全處理範圍。");
  }

  const remainingQuantity = heldQuantity - quantity;
  if (remainingQuantity === 0) {
    delete inventory.materials[materialId];
  } else {
    inventory.materials[materialId].quantity = remainingQuantity;
  }
  inventory.gold = nextGold;

  return {
    materialId,
    name: definition.name || materialId,
    quantity,
    unitPrice,
    totalGold,
    remainingQuantity,
    gold: inventory.gold
  };
}

export function spendGold(inventory, cost) {
  if (!inventory || typeof inventory !== "object") {
    throw new Error("付款需要有效的 inventory。");
  }
  if (!Number.isSafeInteger(cost) || cost < 0) {
    throw new Error("付款金額必須是非負有限值。");
  }
  const currentGold = Number(inventory.gold);
  if (!Number.isSafeInteger(currentGold) || currentGold < 0) {
    throw new Error("目前金幣資料無效。");
  }
  if (currentGold < cost) {
    throw new Error("金幣不足。");
  }
  inventory.gold = currentGold - cost;
  return {
    cost,
    gold: inventory.gold
  };
}
