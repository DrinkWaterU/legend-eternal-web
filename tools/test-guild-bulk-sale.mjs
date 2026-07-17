import assert from "node:assert/strict";

import { createGuildBulkSaleController } from "../src/ui/guildBulkSaleController.js";
import { createGuildBulkDraft } from "../src/ui/guildBulkSaleView.js";
import { dialogueDefinitions } from "../src/data/dialogues.js";
import { TestNode, installTestDocument } from "./dom-test-stub.mjs";

installTestDocument();
globalThis.window = { matchMedia: () => ({ matches: true }), addEventListener() {} };

function createElements() {
  const ids = [
    "guildBulkGold", "guildBulkNotice", "guildBulkSpeakerPortraitImage",
    "guildBulkSpeakerPortraitFallback", "guildBulkSpeakerTitle", "guildBulkSpeakerName",
    "guildBulkDialogueText", "guildBulkDialogueTextRegion",
    "guildBulkDialogueSkipButton", "guildBulkEmpty", "guildBulkGrid", "guildBulkClearDraftButton",
    "guildBulkSummaryEmpty",
    "guildBulkSummaryContent", "guildBulkSummaryList", "guildBulkSummaryKinds",
    "guildBulkSummaryQuantity", "guildBulkSummaryReference", "guildBulkSummaryTotal",
    "guildBulkSummaryDifference", "confirmGuildBulkDraftButton", "guildBulkConfirmPanel",
    "guildBulkConfirmMeta", "guildBulkConfirmList", "guildBulkConfirmReference",
    "guildBulkConfirmTotal", "guildBulkConfirmDifference", "confirmGuildBulkSaleButton"
  ];
  return Object.fromEntries(ids.map((id) => [id, new TestNode(id.includes("Button") ? "button" : "div")]));
}

const definitions = {
  gel: { id: "gel", name: "凝膠", rarity: "common", sellPrice: 2 },
  shard: { id: "shard", name: "碎片", rarity: "uncommon", sellPrice: 3 }
};

{
  const inventory = {
    gold: 10,
    materials: { gel: { name: "凝膠", quantity: 20 }, shard: { name: "碎片", quantity: 10 } }
  };
  const draft = createGuildBulkDraft({
    inventory,
    materialDefinitions: definitions,
    quantities: { gel: 20, shard: 4 }
  });
  assert.equal(draft.items.length, 2);
  assert.equal(draft.valid, false);
  assert.deepEqual(draft.items.map((item) => item.tierId), ["bulk", "below-minimum"]);
}

{
  const els = createElements();
  const inventory = {
    gold: 10,
    materials: { gel: { name: "凝膠", quantity: 20 }, shard: { name: "碎片", quantity: 10 } }
  };
  let saveCalls = 0;
  let saveSucceeds = true;
  const controller = createGuildBulkSaleController({
    els,
    materialDefinitions: definitions,
    npcDefinition: { name: "瑟琳", title: "冒險者公會資深接待員", portrait: "celine.png" },
    dialogueDefinition: dialogueDefinitions["anping-guild-receptionist-main"],
    getInventory: () => inventory,
    saveInventory: () => { saveCalls += 1; return saveSucceeds; }
  });
  controller.reset();
  controller.render();
  assert.equal(els.guildBulkDialogueText.textContent.includes("滿載而歸"), true);

  controller.setQuantity("gel", 4);
  assert.equal(controller.getState().messageNodeId, "bulk-sale-tier-below-minimum");
  controller.setQuantity("gel", 5);
  assert.equal(controller.getState().messageNodeId, "bulk-sale-tier-small");
  controller.setQuantity("gel", 9);
  assert.equal(controller.getState().messageNodeId, "bulk-sale-tier-small", "同級距不應切換台詞");
  controller.setQuantity("gel", 10);
  assert.equal(controller.getState().messageNodeId, "bulk-sale-tier-large");
  controller.setQuantity("gel", 20);
  assert.equal(controller.getState().messageNodeId, "bulk-sale-tier-bulk");
  controller.setQuantity("shard", 10);
  controller.clearDraft();
  assert.deepEqual(controller.getState().quantities, {}, "全部清除應清空草稿");
  assert.equal(els.guildBulkSummaryEmpty.hidden, false);
  controller.setQuantity("gel", 20);
  controller.setQuantity("shard", 10);
  controller.requestConfirm();
  assert.equal(els.guildBulkConfirmPanel.classList.contains("is-visible"), true);

  saveSucceeds = false;
  const beforeFailure = structuredClone(inventory);
  controller.confirmSale();
  assert.deepEqual(inventory, beforeFailure, "保存失敗必須回復金幣與素材");
  assert.equal(controller.getState().quantities.gel, 20, "保存失敗應保留草稿");
  assert.equal(saveCalls, 1);
  assert.match(controller.getState().notice, /已回復/);

  const throwingSnapshot = structuredClone(inventory);
  const throwingController = createGuildBulkSaleController({
    els: createElements(),
    materialDefinitions: definitions,
    npcDefinition: { name: "瑟琳", title: "冒險者公會資深接待員", portrait: "celine.png" },
    dialogueDefinition: dialogueDefinitions["anping-guild-receptionist-main"],
    getInventory: () => inventory,
    saveInventory: () => { throw new Error("storage unavailable"); }
  });
  throwingController.setQuantity("gel", 20);
  throwingController.requestConfirm();
  throwingController.confirmSale();
  assert.deepEqual(inventory, throwingSnapshot, "保存函式拋錯時也必須回復金幣與素材");
  assert.equal(throwingController.getState().quantities.gel, 20, "保存拋錯時應保留草稿");

  saveSucceeds = true;
  controller.requestConfirm();
  controller.confirmSale();
  assert.equal(saveCalls, 2);
  assert.equal(inventory.gold, 89);
  assert.equal("gel" in inventory.materials, false);
  assert.equal("shard" in inventory.materials, false);
  assert.deepEqual(controller.getState().quantities, {});
  assert.equal(controller.getState().messageNodeId, "bulk-sale-success");
  assert.equal(els.guildBulkSummaryEmpty.hidden, false, "成功後應恢復摘要空狀態");
  assert.equal(els.guildBulkSummaryContent.hidden, true);
}

delete globalThis.window;
console.log("Guild bulk draft, tier dialogue, atomic save rollback, and summary reset tests passed.");
