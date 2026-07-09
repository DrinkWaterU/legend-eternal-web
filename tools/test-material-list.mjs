import assert from "node:assert/strict";

import { getInventoryMaterials, getSellableMaterials, sortMaterials } from "../src/ui/materialList.js";

const definitions = {
  common: { name: "普通素材", rarity: "common", sellPrice: 2, sortOrder: 2 },
  rare: { name: "稀有素材", rarity: "rare", sellPrice: 10, sortOrder: 1 },
  free: { name: "不可出售", rarity: "uncommon", sellPrice: 0, sortOrder: 3 },
  decimal: { name: "錯誤小數價格", rarity: "common", sellPrice: 1.5, sortOrder: 4 }
};
const inventory = {
  materials: {
    common: { quantity: 5 },
    rare: { quantity: 1 },
    free: { quantity: 2 },
    decimal: { quantity: 1 },
    empty: { quantity: 0 }
  }
};

const hydrated = getInventoryMaterials(inventory, definitions);
assert.deepEqual(hydrated.map((item) => item.id), ["common", "rare", "free", "decimal"]);
assert.deepEqual(getSellableMaterials(inventory, definitions).map((item) => item.id), ["common", "rare"]);
assert.deepEqual(sortMaterials(hydrated, "sellPrice", "desc").map((item) => item.id), ["rare", "common", "free", "decimal"]);
assert.deepEqual(sortMaterials(hydrated, "quantity", "desc").map((item) => item.id), ["common", "free", "rare", "decimal"]);
assert.deepEqual(sortMaterials(hydrated, "rarity", "desc").map((item) => item.id), ["rare", "free", "common", "decimal"]);
assert.deepEqual(sortMaterials(hydrated, "unknown", "desc").map((item) => item.id), ["rare", "free", "common", "decimal"], "未知排序模式應正式退回 rarity");
assert.deepEqual(sortMaterials(hydrated, "name", "asc").map((item) => item.name), ["不可出售", "普通素材", "稀有素材", "錯誤小數價格"]);

console.log("Shared material list tests passed.");
