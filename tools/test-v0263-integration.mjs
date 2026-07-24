import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { GAME_VERSION, SAVE_SCHEMA_VERSION } from "../src/config.js";
import { createDefaultSave } from "../src/core/storage.js";
import { facilityDefinitions } from "../src/data/facilities.js";
import guildDialogue from "../src/data/dialogues/anping-guild-receptionist.json" with { type: "json" };
import { questDefinitions } from "../src/data/quests.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8");

assert.ok(SAVE_SCHEMA_VERSION >= 9);
assert.equal(Object.keys(questDefinitions).length, 15);
assert.deepEqual(Object.fromEntries(Object.values(questDefinitions).map((quest) => [quest.id, [quest.rarity, quest.rewards.gold]])), {
  "broad-monster-control": ["common", 20],
  "route-patrol": ["common", 20],
  "elite-suppression": ["common", 25],
  "forest-insect-control": ["advanced", 35],
  "boss-threat-removal": ["advanced", 30],
  "plains-boss-trophy": ["rare", 55],
  "plains-slime-suppression": ["common", 20],
  "forest-plant-control": ["common", 25],
  "goblin-camp-patrol": ["advanced", 35],
  "ancient-wood-core-research": ["rare", 45],
  "verdant-antler-procurement": ["rare", 45],
  "bloodbone-charm-ritual": ["rare", 45],
  "beach-threat-control": ["common", 30],
  "beach-route-survey": ["advanced", 40],
  "tidal-claw-core-research": ["rare", 55]
});
assert.equal(questDefinitions["broad-monster-control"].objective.target, 30);
assert.equal(questDefinitions["route-patrol"].objective.target, 2);
assert.equal(questDefinitions["elite-suppression"].objective.target, 5);
assert.equal(questDefinitions["forest-insect-control"].objective.target, 18);
assert.equal(questDefinitions["boss-threat-removal"].objective.target, 3);
assert.deepEqual(questDefinitions["plains-boss-trophy"].objective.materials, [{ id: "tainted_tusk", quantity: 3 }]);
assert.equal(questDefinitions["plains-slime-suppression"].objective.target, 20);
assert.deepEqual(questDefinitions["plains-slime-suppression"].objective.enemyFamilies, ["slime"]);
assert.equal(questDefinitions["forest-plant-control"].objective.target, 15);
assert.deepEqual(questDefinitions["forest-plant-control"].objective.enemyFamilies, ["plant"]);
assert.deepEqual(questDefinitions["goblin-camp-patrol"].objective.routeIds, ["goblin-camp"]);
assert.deepEqual(questDefinitions["goblin-camp-patrol"].objective.clearSourceIds, ["goblinCamp"]);
assert.deepEqual(questDefinitions["ancient-wood-core-research"].objective.materials, [{ id: "ancient_wood_core", quantity: 1 }]);
assert.deepEqual(questDefinitions["verdant-antler-procurement"].objective.materials, [{ id: "verdant_antler", quantity: 1 }]);
assert.deepEqual(questDefinitions["bloodbone-charm-ritual"].objective.materials, [{ id: "bloodbone_charm", quantity: 1 }]);
assert.equal(questDefinitions["beach-threat-control"].objective.target, 20);
assert.equal(questDefinitions["beach-route-survey"].objective.target, 1);
assert.deepEqual(questDefinitions["beach-route-survey"].objective.clearSourceIds, ["main"]);
assert.deepEqual(questDefinitions["tidal-claw-core-research"].objective.materials, [{ id: "tidal_claw_core", quantity: 1 }]);

assert.equal(facilityDefinitions["guild-quests"].hiddenFromList, true);
assert.equal(facilityDefinitions["guild-quests"].actionId, "guild-quests");
const defaultChoices = guildDialogue.nodes["default-greeting"].choices.filter((choice) => choice.label === "查看公會委託");
assert.equal(defaultChoices.length, 2);
assert.deepEqual(defaultChoices.map((choice) => choice.conditions[0].value), [false, true]);
const introduction = guildDialogue.nodes["quest-introduction"];
assert.equal(introduction.pages.length, 6);
assert.deepEqual(introduction.pages.map((page) => page.sceneStage), [
  "papers", "sources", "single", "rarities", "warning", "board"
]);
assert.equal(introduction.choices[0].action.facilityId, "guild-quests");

const dialogueDraft = await read("企劃/v0.2.6/v0.2.6.3-alpha/瑟琳_委託欄對話稿.txt");
introduction.pages.forEach((page) => {
  page.text.split("\n").forEach((line) => assert.match(dialogueDraft, new RegExp(escapeRegExp(line))));
});

const save = createDefaultSave();
assert.equal(save.storyFlags.guildQuestIntroductionSeen, false);
assert.deepEqual(save.quests.board.questIds, []);
assert.equal(save.quests.statistics.completedTotal, 0);

const [html, styles, components, responsive, world, facility, battle, runRecords, bindings, recordView] = await Promise.all([
  read("index.html"),
  read("styles.css"),
  read("src/styles/components.css"),
  read("src/styles/responsive.css"),
  read("src/app/createWorldFeatures.js"),
  read("src/features/facility/facilityController.js"),
  read("src/app/createBattleFeatures.js"),
  read("src/features/adventure/runRecords.js"),
  read("src/app/eventBindings.js"),
  read("src/ui/guildAdventureRecordView.js")
]);

for (const id of [
  "dialogueBriefingProgress",
  "dialogueLayout",
  "dialoguePortraitCard",
  "dialogueSceneOverlay",
  "guildQuestView",
  "guildQuestContent",
  "guildQuestBackButton",
  "guildQuestAbandonPanel",
  "statisticsQuestMetrics"
]) assert.match(html, new RegExp(`id="${id}"`));
const cacheVersion = GAME_VERSION.slice(1);
assert.match(html, new RegExp(`styles\\.css\\?v=${escapeRegExp(cacheVersion)}`));
assert.match(html, new RegExp(`game\\.js\\?v=${escapeRegExp(cacheVersion)}`));
assert.doesNotMatch(html, /目前登記身分維持展開|其餘紀錄可按標題查看/);
assert.equal([...styles.matchAll(new RegExp(escapeRegExp(cacheVersion), "g"))].length, 7);
assert.match(components, /\.guild-quest-board\s*\{/);
assert.match(components, /grid-template-columns:\s*repeat\(2/);
assert.match(responsive, /\.guild-quest-board\s*\{\s*grid-template-columns:\s*1fr/);
assert.match(components, /\.guild-record-collapse-content/);
assert.match(components, /\.guild-record-collapsible\s*\{[^}]*padding:\s*0;/);
assert.match(components, /\.quest-briefing-progress\s*\{/);
assert.match(components, /\.quest-intro-portrait-card\[data-intro-step="5"\] \.quest-mini-board/);
assert.match(components, /\.quest-danger-seal/);
assert.match(world, /createQuestRuntime/);
assert.match(facility, /"guild-quests": showGuildQuestFacility/);
assert.match(facility, /function showGuildQuestIntroduction\(\)/);
assert.match(battle, /questRuntime:\s*world\?\.questRuntime/);
assert.match(runRecords, /questRuntime\?\.recordEnemyDefeated/);
assert.match(runRecords, /questRuntime\?\.recordRunCleared/);
assert.match(bindings, /guildQuestBackButton/);
assert.match(bindings, /confirmGuildQuestAbandonButton/);
assert.match(recordView, /createCollapsibleSection\("公會確認", "主要經歷"/);
assert.match(recordView, /createCollapsibleSection\("公會正式紀錄", "委託履歷"/);
assert.match(recordView, /createCollapsibleSection\("已登記身分", "可用角色"/);

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

console.log("v0.2.6.3 quest, dialogue, facility, statistics and record integration checks passed.");
