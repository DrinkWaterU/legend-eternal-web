import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { materialDefinitions } from "../src/data/materials.js";
import { forestRegion } from "../src/data/regions/forest.js";
import { plainsRegion } from "../src/data/regions/plains.js";

const [
  game,
  preparations,
  commerce,
  preparationView,
  preparationStateSource,
  componentsCss,
  responsiveCss,
  html,
  config
] = await Promise.all([
  readFile(new URL("../game.js", import.meta.url), "utf8"),
  readFile(new URL("../src/core/preparations.js", import.meta.url), "utf8"),
  readFile(new URL("../src/core/commerce.js", import.meta.url), "utf8"),
  readFile(new URL("../src/ui/preparationView.js", import.meta.url), "utf8"),
  readFile(new URL("../src/ui/preparationState.js", import.meta.url), "utf8"),
  readFile(new URL("../src/styles/components.css", import.meta.url), "utf8"),
  readFile(new URL("../src/styles/responsive.css", import.meta.url), "utf8"),
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../src/config.js", import.meta.url), "utf8")
]);

assert.match(config, /SAVE_SCHEMA_VERSION = 7/);

const expectedEnhancements = {
  "simple-bandage": {
    title: "加厚傷口包紮",
    fragments: ["10%"],
    costs: [["slime_gel", 2], ["soft_hide", 1]],
    effect: { healMaxHpRatio: 0.1 }
  },
  "beast-repellent-herb": {
    title: "刺激性調和",
    fragments: ["22%"],
    costs: [["toxic_slime_drop", 1], ["slime_gel", 1]],
    effect: { reductionRatio: 0.22 }
  },
  "weapon-maintenance": {
    title: "刃口與握柄補整",
    fragments: ["3 點攻擊加成"],
    costs: [["hard_tusk", 1], ["sharp_fang", 2]],
    effect: { attackBonus: 3 }
  },
  "insect-repellent-powder": {
    title: "濃縮驅蟲配方",
    fragments: ["30%", "8 次"],
    costs: [["mushroom_cap", 1], ["venom_sac", 1]],
    effect: { reductionRatio: 0.3, charges: 8 }
  },
  "forest-bandage": {
    title: "長途包紮改良",
    fragments: ["5%"],
    costs: [["spider_silk", 1], ["amber_honey", 1]],
    effect: { healMaxHpRatio: 0.05 }
  },
  "web-cutting-knife": {
    title: "重新打磨短刀",
    fragments: ["3 次"],
    costs: [["goblin_scrap", 1], ["oily_leather_cord", 1]],
    effect: { charges: 3 }
  }
};

const allPreparations = [...plainsRegion.preparations, ...forestRegion.preparations];
assert.equal(allPreparations.length, 6);
for (const definition of allPreparations) {
  const expected = expectedEnhancements[definition.id];
  assert.ok(expected, `未登記正式強化：${definition.id}`);
  assert.equal(definition.enhancement.title, expected.title);
  assert.deepEqual(definition.enhancement.changedFragments, expected.fragments);
  assert.deepEqual(
    definition.enhancement.materialCosts.map((cost) => [cost.materialId, cost.quantity]),
    expected.costs
  );
  for (const [key, value] of Object.entries(expected.effect)) {
    assert.equal(definition.enhancement.effect[key], value, `${definition.id}.${key}`);
  }
  definition.enhancement.materialCosts.forEach((cost) => {
    assert.ok(materialDefinitions[cost.materialId], `強化素材 definition 不存在：${cost.materialId}`);
  });
}

assert.match(preparations, /validateEnhancement\(preparation\.enhancement, preparation\.id\)/);
assert.match(preparations, /validateChangedFragments/);
assert.match(preparations, /createRunPreparation\(region, preparationId, options = \{\}\)/);
assert.match(preparations, /name: enhanced \? `\$\{baseName\}・強化` : baseName/);
assert.match(preparations, /effect: clone\(effectDefinition\)/);
assert.doesNotMatch(preparations, /from ["']\.\.\/data\/materials/,
  "Preparation core 不應直接依賴素材 registry");

assert.match(commerce, /export function spendInventoryCost/);
assert.match(commerce, /const plan = createInventoryCostPlan/);
assert.match(commerce, /inventory\.gold = plan\.gold/);
assert.match(commerce, /inventory\.materials = plan\.materials/);
const spendInventorySource = commerce.match(/export function spendInventoryCost\([\s\S]*?\n\}/)?.[0] || "";
assert.doesNotMatch(spendInventorySource, /forEach[\s\S]*inventory\./,
  "複合付款不得逐筆 mutation inventory");
assert.match(commerce, /export function spendGold[\s\S]*spendInventoryCost\(/);

for (const field of ["enhancedPreparationId", "preparationEnhancementRevealId"]) {
  assert.match(game, new RegExp(`${field}: null`), `uiState 缺少 ${field}`);
}
const resetSource = game.match(/function resetPreparationUiState\(\) \{[\s\S]*?\n\}/)?.[0] || "";
assert.match(resetSource, /clearPreparationSelectionState\(uiState\)/);
assert.match(preparationStateSource, /uiState\.enhancedPreparationId = null/);
assert.match(preparationStateSource, /uiState\.preparationEnhancementRevealId = null/);
const selectSource = game.match(/function selectPreparation\(preparationId\) \{[\s\S]*?\n\}/)?.[0] || "";
assert.match(selectSource, /if \(affordable\)/);
assert.match(selectSource, /selectionChanged/);
assert.match(selectSource, /enhancedPreparationId = null/);
const toggleSource = game.match(/function togglePreparationEnhancement\(preparationId\) \{[\s\S]*?\n\}/)?.[0] || "";
assert.match(toggleSource, /preparation\.id !== uiState\.selectedPreparationId/);
assert.match(toggleSource, /getEnhancementMaterialState/);
assert.match(toggleSource, /preparationEnhancementRevealId = preparation\.id/);
assert.match(game, /animateEnhancement = consumePreparationEnhancementReveal\(uiState, detailPreparation\?\.id\)/);
assert.match(preparationStateSource, /uiState\.preparationEnhancementRevealId !== preparationId/);
assert.match(preparationStateSource, /uiState\.preparationEnhancementRevealId = null/);
assert.match(game, /花費 \$\{activePreparation\.cost\} 金幣＋素材並開始/);

const snapshotSource = game.match(/function captureRunStartPermanentState\(\) \{[\s\S]*?\n\}/)?.[0] || "";
const restoreSource = game.match(/function restoreRunStartPermanentState\(snapshot\) \{[\s\S]*?\n\}/)?.[0] || "";
assert.match(snapshotSource, /materials: clone\(saveData\.inventory\.materials\)/);
assert.match(restoreSource, /saveData\.inventory\.materials = clone\(snapshot\.materials\)/);
const startRunSource = game.match(/function startPlayerRun\(\) \{[\s\S]*?\n\}/)?.[0] || "";
assert.match(startRunSource, /requestedEnhanced/);
assert.match(startRunSource, /createRunPreparation\(region, requestedPreparationId,[\s\S]*enhanced: requestedEnhanced/);
assert.match(startRunSource, /spendInventoryCost\(\{[\s\S]*materialCosts: requestedEnhanced \? definition\.enhancement\.materialCosts : \[\]/);
assert.doesNotMatch(startRunSource, /spendGold\(/);

assert.match(preparationView, /document\.createTextNode/);
assert.match(preparationView, /preparation-effect-change/);
assert.match(preparationView, /changedFragments/);
assert.match(preparationView, /animateEnhancement/);
assert.match(preparationView, /素材不會在正式出發時才扣除|正式出發時才會與金幣一次結算/);
assert.doesNotMatch(preparationView, /innerHTML/);
for (const id of Object.keys(expectedEnhancements)) {
  assert.doesNotMatch(preparationView, new RegExp(id), `View 不得硬編碼整備 ID：${id}`);
}
assert.doesNotMatch(preparationView, /setTimeout|requestAnimationFrame/);

for (const selector of [
  ".preparation-effect-change",
  ".preparation-enhancement-materials",
  ".preparation-enhancement-button",
  ".preparation-run-cost-preview"
]) {
  assert.ok(componentsCss.includes(selector), `缺少 CSS：${selector}`);
}
assert.match(componentsCss, /\.preparation-effect-change\s*\{[\s\S]*font-size: inherit/);
assert.match(componentsCss, /@keyframes preparation-effect-change-reveal/);
assert.match(componentsCss, /prefers-reduced-motion: reduce[\s\S]*\.preparation-effect-change/);
assert.match(responsiveCss, /\.preparation-enhancement-materials\s*\{[\s\S]*grid-template-columns: 1fr/);

assert.doesNotMatch(html, /preparationEnhancement|preparationCostPreview/,
  "本版不應新增固定強化 DOM ID");

console.log("v0.2.4.2 preparation enhancement, atomic payment, UI animation, and rollback integration tests passed.");
