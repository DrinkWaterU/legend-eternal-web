import assert from "node:assert/strict";

import { sellMaterial, sellMaterials, spendGold } from "../src/core/commerce.js";

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

{
  const inventory = {
    gold: 5,
    materials: {
      gel: { name: "凝膠", quantity: 4 },
      shard: { name: "碎片", quantity: 3 }
    }
  };
  const result = sellMaterials({
    inventory,
    materialDefinitions: {
      ...definitions,
      shard: { id: "shard", name: "碎片", sellPrice: 3 }
    },
    sales: [
      { materialId: "gel", quantity: 2 },
      { materialId: "shard", quantity: 3 }
    ]
  });
  assert.deepEqual(result.items.map((item) => item.materialId), ["gel", "shard"]);
  assert.equal(result.totalQuantity, 5);
  assert.equal(result.totalGold, 13);
  assert.equal(result.gold, 18);
  assert.equal(inventory.gold, 18);
  assert.equal(inventory.materials.gel.quantity, 2, "批次交易應支援部分出售");
  assert.equal("shard" in inventory.materials, false, "批次交易售罄後應移除 entry");
}

{
  const invalidCases = [
    [],
    [{ materialId: "gel", quantity: 1 }, { materialId: "gel", quantity: 1 }],
    [{ materialId: "gel", quantity: 1 }, { materialId: "missing", quantity: 1 }],
    [{ materialId: "gel", quantity: 1 }, { materialId: "relic", quantity: 1 }],
    [{ materialId: "gel", quantity: 1 }, { materialId: "gel-2", quantity: 5 }]
  ];
  const batchDefinitions = {
    ...definitions,
    "gel-2": { id: "gel-2", name: "另一份凝膠", sellPrice: 2 }
  };
  invalidCases.forEach((sales) => {
    const inventory = {
      ...createInventory(),
      materials: {
        ...createInventory().materials,
        "gel-2": { quantity: 1 }
      }
    };
    const before = structuredClone(inventory);
    assert.throws(() => sellMaterials({ inventory, materialDefinitions: batchDefinitions, sales }));
    assert.deepEqual(inventory, before, "任一批次項目無效時不得產生部分 mutation");
  });
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

{
  const inventory = {
    gold: 0,
    materials: {
      a: { quantity: 1 },
      b: { quantity: 1 }
    }
  };
  const before = structuredClone(inventory);
  const unsafeDefinitions = {
    a: { id: "a", name: "A", sellPrice: Number.MAX_SAFE_INTEGER },
    b: { id: "b", name: "B", sellPrice: Number.MAX_SAFE_INTEGER }
  };
  assert.throws(() => sellMaterials({
    inventory,
    materialDefinitions: unsafeDefinitions,
    sales: [
      { materialId: "a", quantity: 1 },
      { materialId: "b", quantity: 1 }
    ]
  }), /安全處理範圍/);
  assert.deepEqual(inventory, before, "批次總額溢位不得產生部分 mutation");
}

{
  const inventory = {
    gold: Number.MAX_SAFE_INTEGER,
    materials: { gel: { quantity: 1 } }
  };
  const before = structuredClone(inventory);
  assert.throws(() => sellMaterials({
    inventory,
    materialDefinitions: definitions,
    sales: [{ materialId: "gel", quantity: 1 }]
  }), /安全處理範圍/);
  assert.deepEqual(inventory, before, "交易後金幣溢位不得產生 mutation");
}

console.log("Commerce isolation tests passed.");
