import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spendInventoryCost } from "../src/core/commerce.js";
import { applyRewardsToInventory } from "../src/core/rewards.js";
import { migrateSave, createDefaultSave } from "../src/core/storage.js";
import { regionDefinitions } from "../src/data/regions/index.js";
import { materialDefinitions } from "../src/data/materials.js";
import { normalizePreparationUiState } from "../src/ui/preparationState.js";

const normalize = (source) => source.replace(/\r\n?/g, "\n");
const root = new URL("../", import.meta.url);
const [game, html, style, statisticsView] = (await Promise.all([
  Promise.all(["src/features/profile/statisticsController.js", "src/features/profile/saveTransferController.js", "src/features/adventure/runLifecycleController.js"].map((path) => readFile(new URL(path, root), "utf8"))).then((sources) => sources.join("\n")),
  readFile(new URL("index.html", root), "utf8"),
  readFile(new URL("src/styles/ui-refresh.css", root), "utf8"),
  Promise.all(["src/ui/statisticsView.js", "src/ui/statisticsOverviewView.js"].map((path) => readFile(new URL(path, root), "utf8"))).then((sources) => sources.join("\n"))
])).map(normalize);

assert.match(style, /\[hidden\]\s*\{\s*display:\s*none\s*!important;/, "hidden 元素不得被作者 display 規則重新顯示");
assert.match(style, /\.achievement-unlock-toast[\s\S]*display:\s*flex/);
assert.match(html, /id="achievementUnlockToast"[^>]*hidden/, "成就通知初始必須隱藏");
assert.match(style, /\.equipment-scroll-list[\s\S]*scrollbar-gutter:\s*stable/);
assert.match(style, /\.equipment-scroll-list \.equipment-weapon-grid[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/, "裝備武器庫欄數不得因按壓與捲軸寬度跳動");
assert.match(style, /\.storage-material-card[\s\S]*"meta quantity"/, "素材卡數量與描述必須使用獨立 grid area");
assert.match(style, /\.statistics-region-progress \+ \.statistics-detail-grid[\s\S]*margin-top:/, "地區進度與下方統計不可互相擠壓");
assert.match(statisticsView, /function renderStatisticsOverview\([^)]*\) \{[\s\S]*statisticsKeyMetrics\.replaceChildren\(\)[\s\S]*statisticsCombatMetrics\.replaceChildren\(\)/, "統計總覽重繪前必須清空舊卡片");
assert.match(game, /function resetStatisticsUiAfterSaveReplacement\(\)[\s\S]*statisticsView = "overview"/);
assert.match(game, /function confirmImportSaveCode\(\)[\s\S]*resetRuntimeAfterSaveReplacement\(\)/);
assert.match(game, /function deleteSave\(\)[\s\S]*resetRuntimeAfterSaveReplacement\(\)/);
assert.match(game, /function resetRuntimeAfterSaveReplacement\(\)[\s\S]*resetStatisticsUiAfterSaveReplacement\(\)[\s\S]*renderStatistics\(\)/);
assert.match(game, /spendPreparationCost\(startContext\)[\s\S]*recordRunStarted\(\)[\s\S]*startEncounter\(\)/, "整備成本必須在開始遭遇前一次扣除並留下本輪紀錄");

const prepRegion = {
  preparations: [{
    id: "prep",
    cost: 1,
    enhancement: { materialCosts: [{ materialId: "gel", quantity: 1 }] }
  }]
};
const prepUi = {
  selectedPreparationId: "prep",
  enhancedPreparationId: "prep",
  preparationEnhancementRevealId: "prep",
  preparationDetailId: "prep",
  preparationDetailExpanded: true
};
normalizePreparationUiState({
  uiState: prepUi,
  region: prepRegion,
  gold: 10,
  inventoryMaterials: {},
  enabled: true
});
assert.equal(prepUi.selectedPreparationId, "prep", "素材不足只取消強化，不應取消基礎整備");
assert.equal(prepUi.enhancedPreparationId, null, "素材耗盡後不得保留強化選取");

for (const region of Object.values(regionDefinitions)) {
  for (const preparation of region.preparations || []) {
    const costs = preparation.enhancement?.materialCosts || [];
    if (costs.length === 0) continue;
    const save = createDefaultSave();
    save.inventory.gold = preparation.cost;
    save.inventory.materials = Object.fromEntries(costs.map((cost) => [
      cost.materialId,
      { quantity: cost.quantity }
    ]));
    spendInventoryCost({
      inventory: save.inventory,
      materialDefinitions,
      goldCost: preparation.cost,
      materialCosts: costs
    });
    assert.equal(save.inventory.gold, 0, `${preparation.id} 應扣除正確金幣`);
    for (const cost of costs) {
      assert.equal(save.inventory.materials[cost.materialId], undefined, `${preparation.id} 應將耗盡素材 ${cost.materialId} 移除`);
    }
    const migrated = migrateSave(save);
    for (const cost of costs) {
      assert.equal(migrated.inventory.materials[cost.materialId], undefined, `撤退／存檔重載後不得還原已消耗素材 ${cost.materialId}`);
    }
    const rewardedId = costs[0].materialId;
    applyRewardsToInventory(migrated.inventory, {
      gold: 0,
      materials: { [rewardedId]: { quantity: 1 } }
    });
    assert.equal(migrated.inventory.materials[rewardedId].quantity, 1, "冒險中重新獲得同素材時只應保留新取得數量");
  }
}

console.log("v0.2.5.2 reported UI and preparation-cost regression tests passed.");
