import assert from "node:assert/strict";

import { createMerchantController } from "../src/ui/merchantController.js";
import { createElementMap, installTestDocument } from "./dom-test-stub.mjs";

installTestDocument();

function createMerchantElements() {
  const ids = [
    "merchantAreaLabel",
    "merchantBackButton",
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

function findMaterialButton(els, materialName) {
  return els.merchantGrid.children.find((button) => button.children[1]?.textContent === materialName) || null;
}

const materialDefinitions = {
  gel: { id: "gel", name: "凝膠", rarity: "common", sellPrice: 2, sortOrder: 1 },
  core: { id: "core", name: "核心", rarity: "rare", sellPrice: 10, sortOrder: 2 }
};

assert.throws(() => createMerchantController(), /有效的 els/);
assert.throws(() => createMerchantController({ els: {} }), /getInventory/);

{
  const els = createMerchantElements();
  const inventory = {
    gold: 5,
    materials: {
      gel: { quantity: 6 },
      core: { quantity: 1 }
    }
  };
  let saveCount = 0;
  const controller = createMerchantController({
    els,
    materialDefinitions,
    getInventory: () => inventory,
    getSafeArea: () => ({ placesTitle: "營地去處" }),
    saveInventory: () => {
      saveCount += 1;
    }
  });

  controller.render();
  assert.equal(els.merchantAreaLabel.textContent, "營地去處");
  assert.equal(els.merchantBackButton.textContent, "返回營地去處");
  assert.equal(els.merchantGold.textContent, "5");
  assert.equal(els.merchantGrid.children[0].children[1].textContent, "核心", "預設應依售價降序排列");

  findMaterialButton(els, "凝膠").onclick();
  assert.equal(els.merchantSalePanel.classList.contains("is-visible"), true);
  assert.equal(els.merchantSaleTitle.textContent, "凝膠");
  assert.equal(els.merchantSaleQuantity.value, "1");

  els.merchantSaleIncreaseFiveButton.onclick();
  assert.equal(els.merchantSaleQuantity.value, "6");
  assert.equal(els.merchantSaleTotal.textContent, "12 金幣");
  els.confirmMerchantSaleButton.onclick();

  assert.equal(inventory.gold, 17);
  assert.equal(inventory.materials.gel, undefined);
  assert.equal(saveCount, 1);
  assert.equal(els.merchantNotice.textContent, "已出售凝膠 x6，取得 12 金幣。");
  assert.equal(els.merchantNotice.dataset.type, "status");
  assert.equal(els.merchantSalePanel.classList.contains("is-visible"), false);
  assert.equal(els.merchantGrid.children.length, 1);

  findMaterialButton(els, "核心").onclick();
  assert.equal(els.merchantSalePanel.classList.contains("is-visible"), true);
  controller.reset();
  controller.render();
  assert.equal(els.merchantSalePanel.classList.contains("is-visible"), false);
  assert.equal(els.merchantBatchBar.hidden, true);
  assert.equal(els.merchantNotice.textContent, "");
}

{
  const els = createMerchantElements();
  const inventory = {
    gold: 5,
    materials: {
      gel: { quantity: 6 },
      core: { quantity: 1 }
    }
  };
  let saveCount = 0;
  const controller = createMerchantController({
    els,
    materialDefinitions,
    getInventory: () => inventory,
    getSafeArea: () => null,
    saveInventory: () => {
      saveCount += 1;
    }
  });

  controller.render();
  els.merchantBatchToggleButton.onclick();
  assert.equal(els.merchantBatchBar.hidden, false);
  assert.equal(els.merchantBatchToggleButton.textContent, "結束批次");

  findMaterialButton(els, "凝膠").onclick();
  findMaterialButton(els, "核心").onclick();
  assert.equal(els.merchantBatchSummary.textContent, "已選 2 種素材，共 7 件");
  assert.equal(els.merchantBatchTotal.textContent, "預計取得 22 金幣");

  els.confirmMerchantBatchButton.onclick();
  assert.equal(els.merchantSaleTitle.textContent, "確認批次販賣");
  assert.equal(els.merchantBatchSaleList.children.length, 2);
  assert.equal(els.merchantSaleTotal.textContent, "22 金幣");
  els.confirmMerchantSaleButton.onclick();

  assert.equal(inventory.gold, 27);
  assert.deepEqual(inventory.materials, {});
  assert.equal(saveCount, 1, "批次出售只能保存一次");
  assert.equal(els.merchantNotice.textContent, "已出售 2 種素材，共 7 件，取得 22 金幣。");
  assert.equal(els.merchantBatchBar.hidden, true);
  assert.equal(els.merchantSalePanel.classList.contains("is-visible"), false);
}

{
  const els = createMerchantElements();
  const inventory = {
    gold: 0,
    materials: {
      gel: { quantity: 2 },
      core: { quantity: 1 }
    }
  };
  const controller = createMerchantController({
    els,
    materialDefinitions,
    getInventory: () => inventory
  });

  controller.render();
  els.merchantBatchToggleButton.onclick();
  findMaterialButton(els, "凝膠").onclick();
  delete inventory.materials.gel;
  controller.render();
  assert.equal(els.merchantBatchSummary.textContent, "尚未選取素材", "已不存在的素材必須從批次選取中移除");
  assert.equal(els.confirmMerchantBatchButton.disabled, true);
}

console.log("Merchant controller single sale, atomic batch sale, reset, and selection normalization tests passed.");
