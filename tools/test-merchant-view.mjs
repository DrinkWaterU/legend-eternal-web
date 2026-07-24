import assert from "node:assert/strict";

import {
  createMerchantBatchPreview,
  getValidMerchantSaleQuantity,
  renderMerchantBatchSalePanel,
  renderMerchantSalePanel,
  renderMerchantView
} from "../src/ui/merchantView.js";
import { createElementMap, installTestDocument } from "./dom-test-stub.mjs";

installTestDocument();

function createMerchantElements() {
  const ids = [
    "merchantGold",
    "merchantSortSelect",
    "merchantSortDirectionButton",
    "merchantBatchToggleButton",
    "merchantNotice",
    "merchantBatchBar",
    "merchantBatchSummary",
    "merchantBatchTotal",
    "confirmMerchantBatchButton",
    "cancelMerchantBatchButton",
    "merchantGrid",
    "merchantEmpty",
    "merchantSalePanel",
    "merchantSaleTitle",
    "merchantSaleMeta",
    "merchantQuantityControl",
    "merchantBatchSaleList",
    "merchantSaleQuantity",
    "merchantSaleDecreaseFiveButton",
    "merchantSaleDecreaseButton",
    "merchantSaleIncreaseButton",
    "merchantSaleIncreaseFiveButton",
    "merchantSaleMaxButton",
    "merchantSaleTotal",
    "confirmMerchantSaleButton"
  ];
  return createElementMap(ids);
}

const materialDefinitions = {
  gel: { id: "gel", name: "凝膠", rarity: "common", sellPrice: 2, sortOrder: 1 },
  core: { id: "core", name: "核心", rarity: "rare", sellPrice: 10, sortOrder: 2 }
};
const inventory = {
  gold: 5,
  materials: {
    gel: { quantity: 6 },
    core: { quantity: 1 }
  }
};

{
  const items = [
    { id: "gel", name: "凝膠", quantity: 6, sellPrice: 2 },
    { id: "core", name: "核心", quantity: 1, sellPrice: 10 },
    { id: "invalid", name: "錯誤素材", quantity: 1.5, sellPrice: 2 }
  ];
  const preview = createMerchantBatchPreview(items, new Set(["gel", "core", "invalid", "missing"]));
  assert.deepEqual(preview.items.map((item) => item.materialId), ["gel", "core"]);
  assert.equal(preview.totalQuantity, 7);
  assert.equal(preview.totalGold, 22);
}

assert.equal(getValidMerchantSaleQuantity("6", 6), 6);
assert.equal(getValidMerchantSaleQuantity("", 6), null);
assert.equal(getValidMerchantSaleQuantity("1.5", 6), null);
assert.equal(getValidMerchantSaleQuantity("7", 6), null);

{
  const els = createMerchantElements();
  let openedMaterialId = null;
  renderMerchantView({
    els,
    inventory,
    materialDefinitions,
    sortMode: "sellPrice",
    sortDirection: "desc",
    onSortChange() {},
    onDirectionChange() {},
    onMaterialClick: (item) => {
      openedMaterialId = item.id;
    },
    onBatchModeToggle() {},
    onBatchSelectionToggle() {},
    onBatchConfirm() {},
    onBatchCancel() {}
  });
  assert.equal(els.merchantGrid.children.length, 2);
  els.merchantGrid.children[0].onclick();
  assert.equal(openedMaterialId, "core", "一般模式應依目前排序開啟單項素材");
  assert.equal(els.merchantBatchBar.hidden, true);
}

{
  const els = createMerchantElements();
  const selectedIds = new Set(["gel"]);
  const preview = createMerchantBatchPreview([
    { id: "gel", name: "凝膠", quantity: 6, sellPrice: 2 },
    { id: "core", name: "核心", quantity: 1, sellPrice: 10 }
  ], selectedIds);
  let toggledMaterialId = null;
  renderMerchantView({
    els,
    inventory,
    materialDefinitions,
    sortMode: "sellPrice",
    sortDirection: "desc",
    batchMode: true,
    selectedMaterialIds: selectedIds,
    batchPreview: preview,
    onSortChange() {},
    onDirectionChange() {},
    onMaterialClick() {},
    onBatchModeToggle() {},
    onBatchSelectionToggle: (materialId) => {
      toggledMaterialId = materialId;
    },
    onBatchConfirm() {},
    onBatchCancel() {}
  });
  assert.equal(els.merchantBatchBar.hidden, false);
  assert.equal(els.merchantBatchToggleButton.textContent, "結束批次");
  assert.equal(els.merchantBatchSummary.textContent, "已選 1 種素材，共 6 件");
  assert.equal(els.merchantBatchTotal.textContent, "預計取得 12 金幣");
  assert.equal(els.confirmMerchantBatchButton.disabled, false);
  const gelButton = els.merchantGrid.children.find((button) => button.children[1]?.textContent === "凝膠");
  assert.equal(gelButton.getAttribute("aria-pressed"), "true");
  assert.equal(gelButton.classList.contains("is-selected"), true);
  gelButton.onclick();
  assert.equal(toggledMaterialId, "gel", "批次模式素材卡只應切換選取");
}

{
  const els = createMerchantElements();
  let rawInput = null;
  let committedInput = null;
  renderMerchantSalePanel({
    els,
    item: { id: "gel", name: "凝膠", quantity: 12, sellPrice: 2 },
    quantity: 6,
    quantityInput: "6",
    onDecreaseFive() {},
    onDecrease() {},
    onIncrease() {},
    onIncreaseFive() {},
    onMax() {},
    onQuantityInput: (raw) => {
      rawInput = raw;
    },
    onQuantityCommit: (raw) => {
      committedInput = raw;
    },
    onConfirm() {}
  });
  assert.equal(els.merchantSaleQuantity.value, "6");
  assert.equal(els.merchantSaleTotal.textContent, "12 金幣");
  assert.equal(els.merchantSalePanel.classList.contains("is-visible"), true);
  els.merchantSaleQuantity.value = "";
  els.merchantSaleQuantity.oninput();
  assert.equal(rawInput, "");
  assert.equal(els.merchantSaleTotal.textContent, "—");
  assert.equal(els.confirmMerchantSaleButton.disabled, true, "暫時無效輸入不可出售舊數量");
  assert.equal(els.merchantSaleMaxButton.disabled, false, "無效輸入時仍應可用最大值快速恢復");
  els.merchantSaleQuantity.value = "7";
  els.merchantSaleQuantity.onchange();
  assert.equal(committedInput, "7");
}

{
  const els = createMerchantElements();
  const preview = {
    items: [
      { materialId: "gel", name: "凝膠", quantity: 6, unitPrice: 2, totalGold: 12 },
      { materialId: "core", name: "核心", quantity: 1, unitPrice: 10, totalGold: 10 }
    ],
    totalQuantity: 7,
    totalGold: 22
  };
  renderMerchantBatchSalePanel({ els, preview, onConfirm() {} });
  assert.equal(els.merchantQuantityControl.hidden, true);
  assert.equal(els.merchantBatchSaleList.hidden, false);
  assert.equal(els.merchantBatchSaleList.children.length, 2);
  assert.equal(els.merchantSaleTotal.textContent, "22 金幣");
  assert.equal(els.confirmMerchantSaleButton.textContent, "確認批次出售");
}

console.log("Merchant single quantity and batch selection view tests passed.");
