import assert from "node:assert/strict";

import {
  craftWeapon,
  createMaterialSalePlan,
  createMaterialSaleQuote,
  getInventoryCostStatus,
  MATERIAL_SALE_POLICIES,
  sellMaterial,
  sellMaterials,
  spendGold,
  spendInventoryCost
} from "../src/core/commerce.js";
import { normalizeInventory } from "../src/core/rewards.js";

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
  const result = spendInventoryCost({
    inventory,
    materialDefinitions: definitions,
    goldCost: 3,
    materialCosts: [{ materialId: "gel", quantity: 2 }]
  });
  assert.equal(result.goldCost, 3);
  assert.equal(result.gold, 2);
  assert.deepEqual(result.materialCosts, [{
    materialId: "gel",
    name: "凝膠",
    quantity: 2,
    remainingQuantity: 2
  }]);
  assert.equal(inventory.gold, 2);
  assert.equal(inventory.materials.gel.quantity, 2);
}

{
  const inventory = createInventory();
  const result = spendInventoryCost({
    inventory,
    materialDefinitions: definitions,
    goldCost: 0,
    materialCosts: [{ materialId: "relic", quantity: 1 }]
  });
  assert.equal(result.gold, 5);
  assert.equal("relic" in inventory.materials, false, "數量歸零的素材應刪除");
}

for (const request of [
  { goldCost: 6, materialCosts: [{ materialId: "gel", quantity: 1 }] },
  { goldCost: 1, materialCosts: [{ materialId: "gel", quantity: 5 }] },
  { goldCost: 1, materialCosts: [{ materialId: "missing", quantity: 1 }] },
  { goldCost: 1, materialCosts: [{ materialId: "gel", quantity: 1 }, { materialId: "gel", quantity: 1 }] },
  { goldCost: 1, materialCosts: [{ materialId: "gel", quantity: 0 }] }
]) {
  const inventory = createInventory();
  const before = structuredClone(inventory);
  assert.throws(() => spendInventoryCost({
    inventory,
    materialDefinitions: definitions,
    ...request
  }));
  assert.deepEqual(inventory, before, "複合付款任一驗證失敗時不得部分扣除金幣或素材");
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


{
  const inventory = normalizeInventory({
    gold: 6.5,
    materials: {
      gel: { name: "凝膠", quantity: 3 },
      decimal: { name: "小數素材", quantity: 1.5 },
      negative: { name: "負數素材", quantity: -1 },
      unsafe: { name: "過大素材", quantity: Number.MAX_SAFE_INTEGER + 1 }
    }
  });
  assert.equal(inventory.gold, 0, "Inventory 金幣必須正規化為非負 safe integer");
  assert.deepEqual(Object.keys(inventory.materials), ["gel"]);
  assert.equal(inventory.materials.gel.quantity, 3);
  assert.doesNotThrow(() => sellMaterial({
    inventory,
    materialDefinitions: definitions,
    materialId: "gel",
    quantity: 1
  }), "正規化後的 inventory 應可直接交給 Commerce");
}


{
  const inventory = {
    gold: 10,
    materials: {
      gel: { name: "凝膠", quantity: 4 }
    },
    weapons: {}
  };
  const status = getInventoryCostStatus({
    inventory,
    materialDefinitions: definitions,
    goldCost: 6,
    materialCosts: [{ materialId: "gel", quantity: 3 }]
  });
  assert.equal(status.affordable, true);
  assert.equal(status.goldEnough, true);
  assert.deepEqual(status.materialCosts[0], {
    materialId: "gel",
    name: "凝膠",
    quantity: 3,
    heldQuantity: 4,
    enough: true
  });
}

{
  const inventory = {
    gold: 10,
    materials: {
      gel: { name: "凝膠", quantity: 4 }
    },
    weapons: {}
  };
  const weapon = {
    id: "test-blade",
    name: "測試劍",
    recipe: {
      goldCost: 6,
      materialCosts: [{ materialId: "gel", quantity: 3 }]
    }
  };
  const result = craftWeapon({ inventory, weapon, materialDefinitions: definitions });
  assert.equal(result.weaponId, "test-blade");
  assert.equal(inventory.gold, 4);
  assert.equal(inventory.materials.gel.quantity, 1);
  assert.equal(inventory.weapons["test-blade"], true);
  const afterFirstCraft = structuredClone(inventory);
  assert.throws(() => craftWeapon({ inventory, weapon, materialDefinitions: definitions }), /已擁有/);
  assert.deepEqual(inventory, afterFirstCraft, "重複製作不得扣除資源");
}

for (const request of [
  {
    inventory: { gold: 5, materials: { gel: { quantity: 4 } }, weapons: {} },
    weapon: { id: "blade", name: "劍", recipe: { goldCost: 6, materialCosts: [{ materialId: "gel", quantity: 1 }] } }
  },
  {
    inventory: { gold: 10, materials: { gel: { quantity: 1 } }, weapons: {} },
    weapon: { id: "blade", name: "劍", recipe: { goldCost: 6, materialCosts: [{ materialId: "gel", quantity: 2 }] } }
  },
  {
    inventory: { gold: 10, materials: { gel: { quantity: 4 } }, weapons: {} },
    weapon: { id: "blade", name: "劍", recipe: { goldCost: 6, materialCosts: [{ materialId: "missing", quantity: 1 }] } }
  }
]) {
  const before = structuredClone(request.inventory);
  assert.throws(() => craftWeapon({
    inventory: request.inventory,
    weapon: request.weapon,
    materialDefinitions: definitions
  }));
  assert.deepEqual(request.inventory, before, "製作驗證失敗不得部分扣款或取得武器");
}


{
  const definition = { id: "gel", name: "凝膠", sellPrice: 2 };
  assert.deepEqual(
    [4, 5, 9, 10, 19, 20].map((quantity) => {
      const quote = createMaterialSaleQuote({
        materialDefinition: definition,
        quantity,
        policyId: MATERIAL_SALE_POLICIES.GUILD_BULK,
        allowUnaccepted: true
      });
      return [quantity, quote.tierId, quote.percent, quote.totalGold];
    }),
    [
      [4, "below-minimum", 0, 0],
      [5, "small", 90, 9],
      [9, "small", 90, 16],
      [10, "large", 110, 22],
      [19, "large", 110, 41],
      [20, "bulk", 115, 46]
    ]
  );
}

{
  const inventory = {
    gold: 10,
    materials: {
      gel: { quantity: 20 },
      shard: { quantity: 10 }
    }
  };
  const plan = createMaterialSalePlan({
    inventory,
    materialDefinitions: {
      gel: { id: "gel", name: "凝膠", sellPrice: 2 },
      shard: { id: "shard", name: "碎片", sellPrice: 3 }
    },
    sales: [
      { materialId: "gel", quantity: 20 },
      { materialId: "shard", quantity: 10 }
    ],
    policyId: MATERIAL_SALE_POLICIES.GUILD_BULK
  });
  assert.deepEqual(plan.items.map((item) => [item.materialId, item.tierId, item.percent]), [
    ["gel", "bulk", 115],
    ["shard", "large", 110]
  ]);
  assert.equal(plan.totalReferenceGold, 70);
  assert.equal(plan.totalGold, 79);
  assert.equal(plan.totalDifferenceGold, 9);
  assert.equal(inventory.gold, 10, "建立 plan 不得 mutation");
}

{
  const inventory = { gold: 0, materials: { gel: { quantity: 4 } } };
  const before = structuredClone(inventory);
  assert.throws(() => sellMaterials({
    inventory,
    materialDefinitions: { gel: { id: "gel", name: "凝膠", sellPrice: 2 } },
    sales: [{ materialId: "gel", quantity: 4 }],
    policyId: MATERIAL_SALE_POLICIES.GUILD_BULK
  }), /五件以上/);
  assert.deepEqual(inventory, before);
}

console.log("Commerce isolation, guild bulk pricing, and weapon crafting tests passed.");
