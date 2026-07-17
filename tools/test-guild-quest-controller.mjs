import assert from "node:assert/strict";

import { materialDefinitions } from "../src/data/materials.js";
import { questDefinitions } from "../src/data/quests.js";
import { createGuildQuestController } from "../src/ui/guildQuestController.js";
import { TestNode, createElementMap, installTestDocument } from "./dom-test-stub.mjs";

installTestDocument();
globalThis.window = { matchMedia: () => ({ matches: true }) };

const els = createElementMap([
  "guildQuestContent",
  "guildQuestGold",
  "guildQuestNotice",
  "guildQuestSpeakerPortraitImage",
  "guildQuestSpeakerPortraitFallback",
  "guildQuestSpeakerTitle",
  "guildQuestSpeakerName",
  "guildQuestDialogueTextRegion",
  "guildQuestDialogueSkipButton",
  "guildQuestDialogueText",
  "guildQuestAbandonPanel",
  "guildQuestAbandonTitle",
  "guildQuestAbandonMeta"
]);
els.guildQuestSpeakerPortraitImage = new TestNode("img");

const save = {
  inventory: { gold: 90, materials: {} }
};
const runtimeState = {
  boardQuestIds: [
    "broad-monster-control",
    "route-patrol",
    "forest-insect-control",
    "plains-boss-trophy"
  ],
  active: null,
  activeQuest: null,
  activeProgress: 0,
  statistics: {
    completedTotal: 0,
    completedByRarity: { common: 0, advanced: 0, rare: 0 },
    abandonedTotal: 0,
    rewardGoldTotal: 0,
    rewardMaterials: {}
  },
  completions: {}
};
const calls = [];
const questRuntime = {
  getSnapshot: () => structuredClone(runtimeState),
  acceptQuest(questId) {
    calls.push(["accept", questId]);
    const quest = questDefinitions[questId];
    runtimeState.active = { questId, progress: 0 };
    runtimeState.activeQuest = quest;
    runtimeState.activeProgress = 0;
    return { ok: true, quest };
  },
  abandonQuest() {
    calls.push(["abandon"]);
    runtimeState.active = null;
    runtimeState.activeQuest = null;
    runtimeState.activeProgress = 0;
    runtimeState.statistics.abandonedTotal += 1;
    return { ok: true };
  },
  reportQuest() {
    calls.push(["report"]);
    const quest = runtimeState.activeQuest;
    runtimeState.active = null;
    runtimeState.activeQuest = null;
    runtimeState.activeProgress = 0;
    runtimeState.statistics.completedTotal += 1;
    runtimeState.statistics.completedByRarity[quest.rarity] += 1;
    runtimeState.statistics.rewardGoldTotal += quest.rewards.gold;
    save.inventory.gold += quest.rewards.gold;
    return { ok: true, quest, reward: { gold: quest.rewards.gold, materials: [] } };
  }
};

const controller = createGuildQuestController({
  els,
  questRuntime,
  questDefinitions,
  materialDefinitions,
  npcDefinition: {
    name: "瑟琳",
    title: "冒險者公會資深接待員",
    portrait: "assets/images/npcs/anping/celine.png"
  },
  getSave: () => save
});

controller.render();
assert.equal(els.guildQuestSpeakerName.textContent, "瑟琳");
assert.equal(els.guildQuestSpeakerTitle.textContent, "冒險者公會資深接待員");
assert.equal(els.guildQuestGold.textContent, "90");
assert.match(els.guildQuestDialogueText.textContent, /今天能接的單子/);

controller.acceptQuest("broad-monster-control");
assert.deepEqual(calls.at(-1), ["accept", "broad-monster-control"]);
assert.equal(els.guildQuestNotice.textContent, "委託已承接。");
assert.match(els.guildQuestDialogueText.textContent, /委託已經登記好了/);

controller.openAbandonConfirm("broad-monster-control");
assert.equal(els.guildQuestAbandonPanel.classList.contains("is-open"), true);
assert.equal(els.guildQuestAbandonTitle.textContent, "魔物數量控制");
assert.match(els.guildQuestAbandonMeta.textContent, /進度會全部作廢/);
controller.closeAbandonConfirm();
assert.equal(els.guildQuestAbandonPanel.classList.contains("is-open"), false);

controller.openAbandonConfirm("broad-monster-control");
controller.confirmAbandon();
assert.deepEqual(calls.at(-1), ["abandon"]);
assert.equal(els.guildQuestNotice.textContent, "已放棄目前委託。");
assert.match(els.guildQuestDialogueText.textContent, /這單已經替你劃掉了/);

questRuntime.acceptQuest("route-patrol");
runtimeState.active.progress = 2;
runtimeState.activeProgress = 2;
controller.render();
assert.match(els.guildQuestDialogueText.textContent, /麻煩已經順利解決/);
controller.reportQuest();
assert.deepEqual(calls.at(-1), ["report"]);
assert.equal(els.guildQuestNotice.textContent, "委託完成，獲得 20 G。");
assert.equal(els.guildQuestGold.textContent, "110");
assert.match(els.guildQuestDialogueText.textContent, /這單正式結案/);

controller.reset();
assert.equal(els.guildQuestAbandonPanel.classList.contains("is-open"), false);

console.log("Guild quest controller state, dialogue and confirmation tests passed.");
