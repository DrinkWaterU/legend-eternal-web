import assert from "node:assert/strict";

import { createBlacksmithController } from "../src/ui/blacksmithController.js";
import { createElementMap, installTestDocument } from "./dom-test-stub.mjs";

installTestDocument();

function createElements() {
  const ids = [
    "blacksmithAreaLabel", "blacksmithGold", "blacksmithNotice", "blacksmithWeaponList",
    "blacksmithEmpty", "blacksmithDetailPanel", "blacksmithDetail", "blacksmithCraftButton", "blacksmithCraftPanel",
    "blacksmithCraftTitle", "blacksmithCraftMeta", "blacksmithCraftCostList",
    "confirmBlacksmithCraftButton"
  ];
  return createElementMap(ids);
}

const weaponDefinitions = {
  "test-sword": {
    id: "test-sword",
    name: "測試長劍",
    categoryId: "sword",
    rarityId: "common",
    description: "測試武器。",
    statEffects: [{ type: "add", stat: "attack", amount: 2 }],
    specialEffect: null,
    recipe: { goldCost: 10, materialCosts: [{ materialId: "iron", quantity: 2 }] }
  },
  "test-bow": {
    id: "test-bow",
    name: "測試獵弓",
    categoryId: "bow",
    rarityId: "uncommon",
    description: "測試精良武器。",
    statEffects: [{ type: "add", stat: "critChance", amount: 0.05 }],
    specialEffect: null,
    recipe: { goldCost: 20, materialCosts: [] }
  }
};
const weaponCategoryDefinitions = {
  sword: { label: "劍" },
  bow: { label: "弓" }
};
const materialDefinitions = { iron: { name: "廢鐵" } };

assert.throws(() => createBlacksmithController(), /有效的 els/);
assert.throws(() => createBlacksmithController({ els: {} }), /getInventory/);

{
  const els = createElements();
  const inventory = {
    gold: 20,
    materials: { iron: { quantity: 3 } },
    weapons: {}
  };
  let saveCount = 0;
  const controller = createBlacksmithController({
    els,
    weaponDefinitions,
    weaponCategoryDefinitions,
    materialDefinitions,
    getInventory: () => inventory,
    getSafeArea: () => ({ placesTitle: "安平鎮去處" }),
    saveInventory: () => {
      saveCount += 1;
      return true;
    }
  });

  controller.render();
  assert.equal(els.blacksmithAreaLabel.textContent, "安平鎮去處");
  const weaponCards = [...els.blacksmithWeaponList.children];
  weaponCards[1].listeners.get("click")();
  assert.equal(els.blacksmithWeaponList.children[0], weaponCards[0], "選擇武器不應重建清單卡片");
  assert.equal(els.blacksmithWeaponList.children[1], weaponCards[1], "被選取的卡片應保留原節點");
  assert.equal(weaponCards[0].classList.contains("is-selected"), false);
  assert.equal(weaponCards[1].classList.contains("is-selected"), true);
  assert.equal(weaponCards[1].attributes["aria-pressed"], "true");
  assert.equal(els.blacksmithDetailPanel.dataset.rarity, "uncommon");

  weaponCards[0].listeners.get("click")();
  els.blacksmithCraftButton.onclick();
  assert.equal(els.blacksmithCraftPanel.classList.contains("is-visible"), true);
  els.confirmBlacksmithCraftButton.onclick();

  assert.equal(saveCount, 1);
  assert.equal(inventory.gold, 10);
  assert.equal(inventory.materials.iron.quantity, 1);
  assert.equal(inventory.weapons["test-sword"], true);
  assert.equal(els.blacksmithNotice.textContent, "已製作：測試長劍");
  assert.equal(els.blacksmithCraftButton.disabled, true);
  assert.equal(els.blacksmithCraftButton.textContent, "已擁有");
}

{
  const els = createElements();
  const inventory = {
    gold: 20,
    materials: { iron: { quantity: 3 } },
    weapons: {}
  };
  const controller = createBlacksmithController({
    els,
    weaponDefinitions,
    weaponCategoryDefinitions,
    materialDefinitions,
    getInventory: () => inventory,
    getSafeArea: () => null,
    saveInventory: () => false
  });

  controller.render();
  els.blacksmithCraftButton.onclick();
  els.confirmBlacksmithCraftButton.onclick();

  assert.equal(inventory.gold, 20, "保存失敗應回復金幣");
  assert.equal(inventory.materials.iron.quantity, 3, "保存失敗應回復素材");
  assert.deepEqual(inventory.weapons, {}, "保存失敗應回復武器庫");
  assert.match(els.blacksmithNotice.textContent, /資源已回復/);
  assert.equal(els.blacksmithNotice.dataset.type, "error");
}

console.log("Blacksmith controller craft, save, duplicate state, and rollback tests passed.");
