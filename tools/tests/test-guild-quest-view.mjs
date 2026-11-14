import assert from "node:assert/strict";

import { createDefaultSave } from "../../src/core/storage.js";
import { materialDefinitions } from "../../src/data/materials.js";
import { questDefinitions } from "../../src/data/quests.js";
import { renderGuildQuestView } from "../../src/ui/guildQuestView.js";
import { TestNode, installTestDocument } from "../dom-test-stub.mjs";

installTestDocument();
const save = createDefaultSave();
save.inventory.gold = 88;
save.quests.board.questIds = [
  "broad-monster-control",
  "route-patrol",
  "forest-insect-control",
  "plains-boss-trophy"
];
save.quests.statistics.completedTotal = 3;
save.quests.statistics.completedByRarity.common = 2;
save.quests.statistics.completedByRarity.advanced = 1;
save.quests.statistics.rewardGoldTotal = 65;

const calls = [];
const els = {
  guildQuestContent: new TestNode(),
  guildQuestGold: new TestNode(),
  guildQuestNotice: new TestNode()
};
renderGuildQuestView({
  els,
  snapshot: {
    boardQuestIds: [...save.quests.board.questIds],
    active: null,
    activeQuest: null,
    activeProgress: 0,
    statistics: save.quests.statistics,
    completions: {},
    inventory: save.inventory,
    inventoryGold: save.inventory.gold,
    notice: "",
    noticeType: "status"
  },
  questDefinitions,
  materialDefinitions,
  onAccept: (questId) => calls.push(["accept", questId]),
  onReport: (questId) => calls.push(["report", questId]),
  onAbandon: () => calls.push(["abandon"])
});

assert.equal(els.guildQuestGold.textContent, "88");
assert.equal(els.guildQuestContent.children.length, 1);
const renderedText = collectNodeText(els.guildQuestContent);
let guildLayout = els.guildQuestContent.children[0];
assert.equal(guildLayout.children[0].className, "guild-quest-active-section", "active quest stays ahead of reference sections");
assert.equal(guildLayout.children[1].className, "guild-quest-board-section", "daily quest board stays ahead of specialization cards");
assert.equal(guildLayout.children[2].className, "guild-quest-history");
assert.match(renderedText, /公會履歷/);
assert.match(renderedText, /魔物數量控制/);
assert.match(renderedText, /平原霸主戰利品/);
assert.match(renderedText, /55 G/);
const cards = findNodesByClass(els.guildQuestContent, "guild-quest-card");
assert.equal(cards.length, 4, "委託榜必須固定顯示四張卡片");
const buttons = findNodesByTag(els.guildQuestContent, "button");
assert.equal(buttons.filter((button) => button.textContent === "承接委託").length, 4);
buttons.find((button) => button.textContent === "承接委託").listeners.get("click")();
assert.deepEqual(calls[0], ["accept", "broad-monster-control"]);

const activeQuest = questDefinitions["broad-monster-control"];
renderGuildQuestView({
  els,
  snapshot: {
    boardQuestIds: [...save.quests.board.questIds],
    active: { questId: activeQuest.id, progress: 30 },
    activeQuest,
    activeProgress: 30,
    statistics: save.quests.statistics,
    completions: { [activeQuest.id]: { count: 1 } },
    inventory: save.inventory,
    inventoryGold: 88,
    notice: "委託目標已達成。",
    noticeType: "status"
  },
  questDefinitions,
  materialDefinitions,
  onAccept: (questId) => calls.push(["accept", questId]),
  onReport: (questId) => calls.push(["report", questId]),
  onAbandon: () => calls.push(["abandon"]),
  swordTraining: { regions: { forest: true, beach: false, highlands: false }, unlocked: false, ready: false },
  ownsSword: true,
  hammerTraining: { regions: { highlands: false }, unlocked: false, ready: false },
  ownsHammer: true
});
guildLayout = els.guildQuestContent.children[0];
assert.equal(guildLayout.children[0].className, "guild-quest-active-section");
assert.equal(guildLayout.children[1].className, "guild-quest-board-section");
assert.equal(guildLayout.children[2].className, "weapon-training-overview", "specialization overview follows daily quest actions");
assert.equal(guildLayout.children[3].className, "guild-quest-history", "history follows current progression and daily actions");
const specializationCards = findNodesByClass(guildLayout.children[2], "weapon-training-card");
assert.equal(specializationCards.length, 2);
assert.match(collectNodeText(specializationCards[0]), /專精進度 1 \/ 3/);
assert.match(collectNodeText(specializationCards[0]), /下一步：裝備守隘劍，在海岸完成一次守勢反攻/);
const swordDisclosure = specializationCards[0].children.find(node => node.className === "weapon-training-disclosure");
assert.ok(swordDisclosure);
assert.equal(swordDisclosure.attributes.open, undefined, "guild details start collapsed");
assert.equal(findNodesByClass(swordDisclosure, "weapon-training-steps-panel").length, 1, "steps stay inside the disclosure");
const activeButtons = findNodesByTag(els.guildQuestContent, "button");
const reportButton = activeButtons.find((button) => button.textContent === "回報委託");
assert.ok(reportButton);
assert.equal(reportButton.disabled, false);
reportButton.listeners.get("click")();
assert.deepEqual(calls.at(-1), ["report", activeQuest.id]);
assert.equal(activeButtons.filter((button) => button.textContent === "已有進行中的委託").length, 3);
assert.equal(activeButtons.find((button) => button.textContent === "進行中").disabled, true);
assert.match(collectNodeText(els.guildQuestContent), /30 \/ 30/);

function findNodesByClass(node, className) {
  const classes = String(node?.className || "").split(/\s+/u);
  return [
    ...(classes.includes(className) ? [node] : []),
    ...(Array.isArray(node?.children) ? node.children.flatMap((child) => findNodesByClass(child, className)) : [])
  ];
}

function findNodesByTag(node, tagName) {
  return [
    ...(String(node?.tagName || "").toLowerCase() === tagName ? [node] : []),
    ...(Array.isArray(node?.children) ? node.children.flatMap((child) => findNodesByTag(child, tagName)) : [])
  ];
}

function collectNodeText(node) {
  return [
    String(node?.textContent || ""),
    ...(Array.isArray(node?.children) ? node.children.map(collectNodeText) : [])
  ].join(" ");
}

console.log("Guild quest board render and interaction tests passed.");
