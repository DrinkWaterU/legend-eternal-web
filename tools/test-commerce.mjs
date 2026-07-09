import assert from "node:assert/strict";

import { sellMaterial, spendGold } from "../src/core/commerce.js";

const definitions = {
  gel: { id: "gel", name: "凝膠", sellPrice: 2 },
  relic: { id: "relic", name: "遺物", sellPrice: 0 }
};

function createInventory() {
  return {
    gold: 5,
    materials: {
      gel: { name: "凝膠", quantity: 4 },
      relic: { name: "遺物", quantity: 1 }
    }
  };
}

{
  const inventory = createInventory();
  const result = sellMaterial({ inventory, materialDefinitions: definitions, materialId: "gel", quantity: 1 });
  assert.equal(result.totalGold, 2);
  assert.equal(result.remainingQuantity, 3);
  assert.equal(inventory.gold, 7);
  assert.equal(inventory.materials.gel.quantity, 3);
}

{
  const inventory = createInventory();
  const result = sellMaterial({ inventory, materialDefinitions: definitions, materialId: "gel", quantity: 4 });
  assert.equal(result.totalGold, 8);
  assert.equal(inventory.gold, 13);
  assert.equal("gel" in inventory.materials, false, "素材售罄後應移除永久 inventory entry");
}

for (const quantity of [0, -1, 5, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
  const inventory = createInventory();
  const before = structuredClone(inventory);
  assert.throws(() => sellMaterial({ inventory, materialDefinitions: definitions, materialId: "gel", quantity }));
  assert.deepEqual(inventory, before, `非法出售數量 ${quantity} 不得產生部分 mutation`);
}

{
  const inventory = createInventory();
  const before = structuredClone(inventory);
  assert.throws(() => sellMaterial({ inventory, materialDefinitions: definitions, materialId: "missing", quantity: 1 }));
  assert.deepEqual(inventory, before);
  assert.throws(() => sellMaterial({ inventory, materialDefinitions: definitions, materialId: "relic", quantity: 1 }));
  assert.deepEqual(inventory, before);
}

{
  const inventory = { gold: 10, materials: {} };
  assert.deepEqual(spendGold(inventory, 0), { cost: 0, gold: 10 });
  assert.deepEqual(spendGold(inventory, 10), { cost: 10, gold: 0 });
  assert.throws(() => spendGold(inventory, 1), /金幣不足/);
  assert.equal(inventory.gold, 0);
  assert.throws(() => spendGold(inventory, -1));
  assert.equal(inventory.gold, 0);
  assert.throws(() => spendGold(inventory, 0.5));
  assert.equal(inventory.gold, 0);
}

{
  const inventory = createInventory();
  const before = structuredClone(inventory);
  const unsafeDefinitions = { gel: { id: "gel", name: "凝膠", sellPrice: Number.MAX_SAFE_INTEGER } };
  assert.throws(() => sellMaterial({ inventory, materialDefinitions: unsafeDefinitions, materialId: "gel", quantity: 4 }), /安全處理範圍/);
  assert.deepEqual(inventory, before, "交易總額溢位不得產生部分 mutation");
}

console.log("Commerce isolation tests passed.");
