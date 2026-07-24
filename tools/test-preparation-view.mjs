import assert from "node:assert/strict";

import {
  getEnhancementMaterialState,
  renderPreparationChoices,
  renderPreparationDetail
} from "../src/ui/preparationView.js";
import { forestRegion } from "../src/data/regions/forest.js";
import { TestNode, installTestDocument } from "./dom-test-stub.mjs";

installTestDocument();

const materialDefinitions = {
  spider_silk: { id: "spider_silk", name: "韌蛛絲" },
  amber_honey: { id: "amber_honey", name: "琥珀蜜" },
  mushroom_cap: { id: "mushroom_cap", name: "林菇傘蓋" },
  venom_sac: { id: "venom_sac", name: "毒囊" },
  goblin_scrap: { id: "goblin_scrap", name: "哥布林廢鐵" },
  oily_leather_cord: { id: "oily_leather_cord", name: "油污皮繩" }
};

const inventoryMaterials = {
  spider_silk: { quantity: 3 },
  amber_honey: { quantity: 1 },
  mushroom_cap: { quantity: 2 },
  venom_sac: { quantity: 1 },
  goblin_scrap: { quantity: 3 }
};

const bandage = forestRegion.preparations.find((entry) => entry.id === "forest-bandage");
const powder = forestRegion.preparations.find((entry) => entry.id === "insect-repellent-powder");
const knife = forestRegion.preparations.find((entry) => entry.id === "web-cutting-knife");

{
  const state = getEnhancementMaterialState({
    preparation: bandage,
    inventoryMaterials,
    materialDefinitions
  });
  assert.equal(state.available, true);
  assert.deepEqual(state.items.map((item) => [item.name, item.owned, item.quantity, item.enough]), [
    ["韌蛛絲", 3, 1, true],
    ["琥珀蜜", 1, 1, true]
  ]);
}

{
  const state = getEnhancementMaterialState({
    preparation: knife,
    inventoryMaterials,
    materialDefinitions
  });
  assert.equal(state.available, false);
  assert.equal(state.items[1].name, "油污皮繩");
  assert.equal(state.items[1].owned, 0);
}

{
  const element = new TestNode();
  renderPreparationDetail({
    element,
    preparation: bandage,
    expanded: true,
    priceLabel: "8 金幣",
    selected: true,
    enhanced: false,
    inventoryMaterials,
    materialDefinitions,
    onToggleEnhancement() {}
  });
  const card = element.children[0];
  assert.equal(card.children[0].textContent, "整備效果");
  assert.equal(card.children[3].textContent, bandage.description);
  assert.equal(card.classList.contains("is-enhanced"), false);
  const enhancementSection = card.children[4];
  const actionButton = enhancementSection.children[3];
  assert.equal(actionButton.textContent, "使用素材強化");
  assert.equal(actionButton.disabled, false);
}

{
  const element = new TestNode();
  let toggled = null;
  renderPreparationDetail({
    element,
    preparation: bandage,
    expanded: true,
    priceLabel: "8 金幣",
    selected: true,
    enhanced: true,
    animateEnhancement: true,
    inventoryMaterials,
    materialDefinitions,
    onToggleEnhancement: (id) => {
      toggled = id;
    }
  });
  const card = element.children[0];
  const label = card.children[0];
  const description = card.children[3];
  const change = description.children.find((node) => node.classList?.contains("preparation-effect-change"));
  assert.equal(label.textContent, "強化效果");
  assert.equal(label.classList.contains("is-reveal"), true);
  assert.equal(card.classList.contains("is-enhancement-reveal"), true);
  assert.equal(change.textContent, "5%");
  assert.equal(change.classList.contains("is-reveal"), true);
  assert.equal(change.style.animationDelay, "0ms");
  const actionButton = card.children[4].children[3];
  assert.equal(actionButton.textContent, "取消素材強化");
  actionButton.onclick();
  assert.equal(toggled, "forest-bandage");
}

{
  const element = new TestNode();
  renderPreparationDetail({
    element,
    preparation: powder,
    expanded: true,
    priceLabel: "8 金幣",
    selected: true,
    enhanced: true,
    animateEnhancement: false,
    inventoryMaterials,
    materialDefinitions,
    onToggleEnhancement() {}
  });
  const description = element.children[0].children[3];
  const changes = description.children.filter((node) => node.classList?.contains("preparation-effect-change"));
  assert.deepEqual(changes.map((node) => node.textContent), ["30%", "8 次"]);
  assert.equal(changes[0].classList.contains("is-reveal"), false, "一般重新 render 不得重播動畫");
  assert.equal(changes[1].style.animationDelay, "0ms");
}

{
  const element = new TestNode();
  renderPreparationDetail({
    element,
    preparation: knife,
    expanded: true,
    priceLabel: "9 金幣",
    selected: true,
    enhanced: false,
    inventoryMaterials,
    materialDefinitions,
    onToggleEnhancement() {}
  });
  const section = element.children[0].children[4];
  const status = section.children[0].children[1];
  const button = section.children[3];
  assert.equal(status.textContent, "素材不足");
  assert.equal(button.textContent, "素材不足");
  assert.equal(button.disabled, true);
}

{
  const element = new TestNode();
  renderPreparationChoices({
    element,
    preparations: forestRegion.preparations,
    selectedPreparationId: "forest-bandage",
    detailPreparationId: "web-cutting-knife",
    detailExpanded: true,
    enhancedPreparationId: "forest-bandage",
    gold: 99,
    inventoryMaterials,
    materialDefinitions,
    onSelect() {}
  });
  assert.equal(element.children.length, 4);
  const bandageCard = element.children[2];
  const knifeCard = element.children[3];
  assert.equal(bandageCard.classList.contains("is-enhanced"), true);
  assert.equal(bandageCard.children[1].children.at(-1).textContent, "已啟用素材強化");
  assert.equal(knifeCard.children[1].children.at(-1).textContent, "強化素材不足");
}

console.log("Preparation enhancement single-column view tests passed.");
