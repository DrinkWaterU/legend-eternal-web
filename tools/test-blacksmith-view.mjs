import assert from "node:assert/strict";

import {
  closeBlacksmithCraftPanel,
  renderBlacksmithCraftPanel,
  renderBlacksmithView
} from "../src/ui/blacksmithView.js";
import { TestNode, createElementMap, installTestDocument } from "./dom-test-stub.mjs";

installTestDocument();

function createElements() {
  const ids = [
    "blacksmithGold", "blacksmithNotice", "blacksmithWeaponList", "blacksmithEmpty",
    "blacksmithDetailPanel", "blacksmithDetail", "blacksmithCraftButton", "blacksmithCraftPanel",
    "blacksmithCraftTitle", "blacksmithCraftMeta", "blacksmithCraftCostList",
    "confirmBlacksmithCraftButton"
  ];
  return createElementMap(ids);
}

const weaponDefinitions = {
  sword: {
    id: "sword",
    name: "測試長劍",
    categoryId: "sword",
    rarityId: "common",
    description: "普通品級測試武器。",
    statEffects: [{ type: "add", stat: "attack", amount: 2 }],
    specialEffect: null,
    recipe: { goldCost: 10, materialCosts: [{ materialId: "iron", quantity: 2 }] }
  },
  bow: {
    id: "bow",
    name: "測試獵弓",
    categoryId: "bow",
    rarityId: "uncommon",
    description: "精良品級測試武器。",
    statEffects: [{ type: "add", stat: "critChance", amount: 0.05 }],
    specialEffect: null,
    recipe: { goldCost: 20, materialCosts: [{ materialId: "silk", quantity: 2 }] }
  },
  owned: {
    id: "owned",
    name: "已持有短劍",
    categoryId: "sword",
    rarityId: "common",
    description: "已持有。",
    statEffects: [],
    specialEffect: null,
    recipe: { goldCost: 1, materialCosts: [] }
  },
  rare: {
    id: "rare",
    name: "稀有測試劍",
    categoryId: "sword",
    rarityId: "rare",
    description: "稀有品級測試武器。",
    statEffects: [{ type: "add", stat: "attack", amount: 2 }],
    specialEffect: null,
    recipe: { goldCost: 10, materialCosts: [] }
  }
};
const weaponCategoryDefinitions = {
  sword: { label: "劍" },
  bow: { label: "弓" }
};
const materialDefinitions = {
  iron: { name: "廢鐵" },
  silk: { name: "蛛絲" }
};
const inventory = {
  gold: 15,
  materials: {
    iron: { quantity: 2 },
    silk: { quantity: 1 }
  },
  weapons: { owned: true }
};

{
  const els = createElements();
  let selectedId = null;
  let requestedId = null;
  renderBlacksmithView({
    els,
    inventory,
    weaponDefinitions,
    weaponCategoryDefinitions,
    materialDefinitions,
    selectedWeaponId: "sword",
    onWeaponSelect: (weaponId) => { selectedId = weaponId; },
    onCraftRequest: (weaponId) => { requestedId = weaponId; }
  });

  assert.equal(els.blacksmithGold.textContent, "15");
  assert.equal(els.blacksmithWeaponList.children.length, 4);
  assert.deepEqual(
    els.blacksmithWeaponList.children.map((button) => button.dataset.state),
    ["available", "locked", "owned", "available"],
    "武器卡應區分可製作、材料不足與已擁有"
  );
  assert.match(els.blacksmithWeaponList.children[0].className, /rarity-common/);
  assert.match(els.blacksmithWeaponList.children[1].className, /rarity-uncommon/);
  assert.equal(els.blacksmithWeaponList.children[0].dataset.weaponId, "sword");
  assert.equal(els.blacksmithWeaponList.children[0].attributes["aria-pressed"], "true");
  assert.equal(els.blacksmithWeaponList.children[1].attributes["aria-pressed"], "false");
  assert.equal(els.blacksmithWeaponList.children[0].children[1].children[1].textContent, "劍｜普通品級");
  assert.equal(els.blacksmithWeaponList.children[1].children[1].children[1].textContent, "弓｜精良品級");
  assert.equal(els.blacksmithDetailPanel.dataset.rarity, "common");
  assert.equal(els.blacksmithCraftButton.disabled, false);
  assert.equal(els.blacksmithCraftButton.textContent, "製作測試長劍");
  els.blacksmithCraftButton.onclick();
  assert.equal(requestedId, "sword");
  els.blacksmithWeaponList.children[1].listeners.get("click")();
  assert.equal(selectedId, "bow");
}

{
  const els = createElements();
  renderBlacksmithView({
    els,
    inventory,
    weaponDefinitions,
    weaponCategoryDefinitions,
    materialDefinitions,
    selectedWeaponId: "rare",
    onWeaponSelect() {},
    onCraftRequest() {}
  });
  assert.equal(els.blacksmithDetailPanel.dataset.rarity, "rare");
  assert.match(els.blacksmithWeaponList.children[3].className, /rarity-rare/);
}

{
  const els = createElements();
  let confirmed = false;
  renderBlacksmithCraftPanel({
    els,
    weapon: weaponDefinitions.sword,
    inventory,
    materialDefinitions,
    onConfirm: () => { confirmed = true; }
  });
  assert.equal(els.blacksmithCraftPanel.classList.contains("is-visible"), true);
  assert.equal(els.blacksmithCraftPanel.dataset.rarity, "common");
  assert.equal(els.blacksmithCraftTitle.textContent, "測試長劍");
  assert.equal(els.blacksmithCraftCostList.children.length, 2);
  assert.equal(els.confirmBlacksmithCraftButton.disabled, false);
  els.confirmBlacksmithCraftButton.onclick();
  assert.equal(confirmed, true);
  closeBlacksmithCraftPanel(els);
  assert.equal(els.blacksmithCraftPanel.classList.contains("is-visible"), false);
  assert.equal(els.blacksmithCraftPanel.dataset.rarity, "none");
}

{
  const els = createElements();
  renderBlacksmithCraftPanel({
    els,
    weapon: weaponDefinitions.rare,
    inventory,
    materialDefinitions,
    onConfirm() {}
  });
  assert.equal(els.blacksmithCraftPanel.dataset.rarity, "rare");
}

console.log("Blacksmith catalog, cost state, detail, and confirmation view tests passed.");
