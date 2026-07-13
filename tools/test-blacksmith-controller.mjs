import assert from "node:assert/strict";

import { createBlacksmithController } from "../src/ui/blacksmithController.js";

class TestClassList {
  constructor() { this.values = new Set(); }
  add(...names) { names.forEach((name) => this.values.add(name)); }
  remove(...names) { names.forEach((name) => this.values.delete(name)); }
  toggle(name, force) {
    const shouldAdd = force ?? !this.values.has(name);
    if (shouldAdd) this.values.add(name);
    else this.values.delete(name);
    return shouldAdd;
  }
  contains(name) { return this.values.has(name); }
}

class TestNode {
  constructor(tagName = "div") {
    this.tagName = tagName;
    this.classList = new TestClassList();
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.hidden = false;
    this.disabled = false;
    this.textContent = "";
    this.className = "";
    this.onclick = null;
    this.listeners = new Map();
  }
  append(...nodes) { this.children.push(...nodes); }
  prepend(...nodes) { this.children.unshift(...nodes); }
  replaceChildren(...nodes) { this.children = [...nodes]; }
  addEventListener(type, handler) { this.listeners.set(type, handler); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  remove() { this.removed = true; }
}

globalThis.document = { createElement: (tagName) => new TestNode(tagName) };

function createElements() {
  const ids = [
    "blacksmithAreaLabel", "blacksmithGold", "blacksmithNotice", "blacksmithWeaponList",
    "blacksmithEmpty", "blacksmithDetail", "blacksmithCraftButton", "blacksmithCraftPanel",
    "blacksmithCraftTitle", "blacksmithCraftMeta", "blacksmithCraftCostList",
    "confirmBlacksmithCraftButton"
  ];
  return Object.fromEntries(ids.map((id) => [id, new TestNode()]));
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
  }
};
const weaponCategoryDefinitions = { sword: { label: "劍" } };
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
