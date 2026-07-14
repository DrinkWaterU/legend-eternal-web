import assert from "node:assert/strict";
import { installTestDocument, createElementMap } from "./dom-test-stub.mjs";
import { renderStorageView } from "../src/ui/storageView.js";

installTestDocument();
const els = createElementMap([
  "storageGold", "storageMaterialKinds", "storageMaterialCount", "storageResultCount",
  "storageSearchInput", "storageSortSelect", "storageSortDirectionButton", "storageRarityFilters",
  "storageGrid", "storageEmpty", "storageDetailEmpty", "storageDetailContent", "storageDetailRarity",
  "storageDetailName", "storageDetailMeta", "storageDetailQuantity", "storageDetailDescription",
  "storageDetailSource", "storageDetailPrice", "storageDetailGeneralUsage", "storageUsageCount",
  "storageUsageFilters", "storageUsageList"
]);
const materials = {
  spider_silk: { id: "spider_silk", name: "韌蛛絲", rarity: "uncommon", category: "material", description: "結實蛛絲。", source: "森林蜘蛛", usage: "可用於製作。", sellPrice: 15 },
  soft_hide: { id: "soft_hide", name: "柔韌獸皮", rarity: "common", category: "material", description: "柔軟獸皮。", source: "平原野獸", usage: "可用於整備。", sellPrice: 4 }
};
const usages = Array.from({ length: 18 }, (_, index) => ({
  id: `weapon:test-${index}`,
  type: index % 3 === 0 ? "preparation" : "weapon",
  title: `用途 ${index + 1}`,
  subtitle: index % 3 === 0 ? "整備強化" : "武器製作",
  description: "這是一段足以測試展開與大量用途顯示的效果說明。",
  quantity: index + 1,
  location: index % 3 === 0 ? "森林出發前整備" : "安平鎮鐵匠鋪"
}));
const usageIndex = { spider_silk: usages, soft_hide: [] };
let selected = null;
let cleared = 0;
const result = renderStorageView({
  els,
  inventory: { gold: 761, materials: { spider_silk: { quantity: 4 }, soft_hide: { quantity: 2 } } },
  materialDefinitions: materials,
  usageIndex,
  sortMode: "rarity",
  sortDirection: "desc",
  selectedMaterialId: "spider_silk",
  expandedUsageIds: new Set(["weapon:test-0"]),
  onMaterialSelect: (id) => { selected = id; },
  onClearFilters: () => { cleared += 1; }
});
assert.equal(result.selectedMaterialId, "spider_silk");
assert.equal(els.storageMaterialKinds.textContent, "2");
assert.equal(els.storageMaterialCount.textContent, "6");
assert.equal(els.storageGrid.children.length, 2);
assert.equal(els.storageUsageCount.textContent, "18 項");
assert.equal(els.storageDetailEmpty.hidden, true, "選取素材後提示文字必須隱藏");
assert.equal(els.storageDetailContent.hidden, false, "選取素材後詳細內容必須顯示");
assert.equal(els.storageUsageList.children.filter((node) => node.className.includes("material-usage-card")).length, 18);
els.storageGrid.children[0].listeners.get("click")();
assert.ok(selected);

const emptyResult = renderStorageView({
  els,
  inventory: { gold: 0, materials: { spider_silk: { quantity: 4 } } },
  materialDefinitions: materials,
  usageIndex,
  sortMode: "rarity",
  sortDirection: "desc",
  searchQuery: "不存在",
  onClearFilters: () => { cleared += 1; }
});
assert.equal(emptyResult.visibleCount, 0);
assert.equal(els.storageEmpty.classList.contains("is-hidden"), false);
assert.equal(els.storageEmpty.children[1].textContent, "清除搜尋與篩選");
els.storageEmpty.children[1].listeners.get("click")();
assert.equal(cleared, 1);
console.log("v0.2.5.2 storage browser, 18-use viewport data, selection, and empty-state tests passed.");
