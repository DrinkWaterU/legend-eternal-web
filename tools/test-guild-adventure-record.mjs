import assert from "node:assert/strict";

import { createDefaultSave } from "../src/core/storage.js";
import { characterDefinitions } from "../src/data/characters/index.js";
import { buildGuildAdventureRecordModel } from "../src/ui/guildAdventureRecord.js";
import { renderGuildAdventureRecordView } from "../src/ui/guildAdventureRecordView.js";
import { TestNode, installTestDocument } from "./dom-test-stub.mjs";

const save = createDefaultSave();
save.settings.selectedCharacterId = "adventurer";
save.progression.characters.adventurer.level = 25;
save.progression.characters.adventurer.learnedSkills = characterDefinitions.adventurer.skills.map((skill) => skill.id);
save.statistics.totalRuns = 18;
save.statistics.totalClears = 7;
save.statistics.totalEnemiesDefeated = 123;
save.statistics.bossesDefeated = 9;
save.statistics.regions.plains.clears = 3;
save.statistics.regions.forest.routeClears.main = 2;
save.statistics.regions.forest.routeClears.goblinCamp = 1;
save.storyFlags.archerRescued = true;
save.progression.characters.archer.unlocked = true;
save.progression.characters.archer.level = 12;
save.progression.safeAreas["anping-town"].visitedAt = new Date().toISOString();
save.quests.statistics.completedTotal = 12;
save.quests.statistics.completedByRarity.common = 7;
save.quests.statistics.completedByRarity.advanced = 4;
save.quests.statistics.completedByRarity.rare = 1;
save.quests.statistics.abandonedTotal = 2;
save.quests.statistics.rewardGoldTotal = 255;

const model = buildGuildAdventureRecordModel({ save, characterDefinitions });
assert.equal(model.selectedCharacter.id, "adventurer");
assert.equal(model.selectedCharacter.level, 25);
assert.equal(model.selectedCharacter.atMaxLevel, true);
assert.equal(model.summary.totalRuns, 18);
assert.equal(model.summary.totalClears, 7);
assert.equal(model.summary.totalEnemiesDefeated, 123);
assert.equal(model.summary.bossesDefeated, 9);
assert.deepEqual(model.experiences.map((item) => item.label), [
  "完成平原主要冒險",
  "穿越森林主要路線",
  "解決哥布林營地事件",
  "救出弓箭手",
  "抵達安平鎮"
]);
assert.match(model.experiences[0].status, /3 次/);
assert.equal(model.experiences[3].status, "紀錄已確認");
assert.deepEqual(model.unlockedCharacters.map((item) => item.id), ["adventurer", "archer"]);
assert.deepEqual(model.unlockedCharacters.map((item) => item.level), [25, 12]);
assert.equal(model.unlockedCharacters.some((item) => item.level === undefined), false);
assert.match(model.celineComment, /哥布林營地/);
assert.deepEqual(model.questHistory, {
  completedTotal: 12,
  completedByRarity: { common: 7, advanced: 4, rare: 1 },
  abandonedTotal: 2,
  rewardGoldTotal: 255
});


installTestDocument();
const content = new TestNode("div");
renderGuildAdventureRecordView({ els: { guildRecordContent: content }, model });
assert.equal(content.children.length, 1);
const layout = content.children[0];
assert.equal(layout.children.length, 2, "正式資歷版面應包含瑟琳卡與資歷表");
const panel = layout.children[1];
assert.equal(panel.children.at(-1).tagName, "blockquote", "資歷表末端應顯示瑟琳評語");
assert.match(panel.children.at(-1).textContent, /哥布林營地/);
const renderedText = collectNodeText(content);
assert.match(renderedText, /Lv\. 25/);
assert.match(renderedText, /Lv\. 12/);
assert.doesNotMatch(renderedText, /undefined/);
assert.match(renderedText, /委託履歷/);
assert.match(renderedText, /255 G/);
const collapsedSections = findNodesByClass(content, "guild-record-collapsible");
assert.equal(collapsedSections.length, 3, "主要經歷、委託履歷與可用角色應各自收合");
collapsedSections.forEach((section) => {
  const toggle = section.children[0];
  const wrapper = section.children[1];
  assert.equal(toggle.attributes["aria-expanded"], "false");
  assert.equal(wrapper.hidden, true);
  assert.equal(wrapper.attributes["aria-hidden"], "true");
});

const emptySave = createDefaultSave();
const emptyModel = buildGuildAdventureRecordModel({ save: emptySave, characterDefinitions });
assert.deepEqual(emptyModel.experiences, []);
assert.deepEqual(emptyModel.unlockedCharacters.map((item) => item.id), ["adventurer"]);
assert.deepEqual(emptyModel.unlockedCharacters.map((item) => item.level), [1]);
assert.match(emptyModel.celineComment, /紀錄還不算多/);

function findNodesByClass(node, className) {
  const matches = String(node?.className || "").split(/\s+/u).includes(className) ? [node] : [];
  return [
    ...matches,
    ...(Array.isArray(node?.children) ? node.children.flatMap((child) => findNodesByClass(child, className)) : [])
  ];
}

function collectNodeText(node) {
  return [
    String(node?.textContent || ""),
    ...(Array.isArray(node?.children) ? node.children.map(collectNodeText) : [])
  ].join(" ");
}

console.log("Guild adventure record derivation and empty-state tests passed.");
