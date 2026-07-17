import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { createDebugQuestActions } from "../src/debug/questActions.js";
import { createDefaultSave } from "../src/core/storage.js";
import { questDefinitions } from "../src/data/quests.js";

let saveData = createDefaultSave();
let introductionCalls = 0;
let boardCalls = 0;
let syncCalls = 0;
const actions = createDebugQuestActions({
  getSaveData: () => saveData,
  saveGameSafe: () => true,
  syncSafeAreaUiFromSave: () => {
    syncCalls += 1;
  },
  showGuildQuestIntroduction: () => {
    introductionCalls += 1;
  },
  showGuildQuestFacility: () => {
    boardCalls += 1;
  },
  random: () => 0
});

assert.equal(actions.getQuestOptions().length, 12);
assert.equal(actions.getQuestOptions()[0].id, "broad-monster-control");
assert.equal(typeof actions.getQuestDebugSnapshot, "function");

const replayMessage = actions.replayGuildQuestIntroduction();
assert.match(replayMessage, /首次導覽/);
assert.equal(introductionCalls, 1);
assert.equal(saveData.storyFlags.registeredAtAnpingGuild, true);
assert.equal(saveData.storyFlags.guildQuestIntroductionSeen, false);
assert.equal(saveData.settings.currentSafeAreaId, "anping-town");
assert.ok(saveData.progression.safeAreas["anping-town"].visitedAt);

const halfMessage = actions.prepareSelectedQuest("broad-monster-control", "half");
assert.match(halfMessage, /半程/);
assert.equal(boardCalls, 1);
assert.equal(saveData.quests.active.questId, "broad-monster-control");
assert.equal(saveData.quests.active.progress, 15);
assert.ok(saveData.quests.board.questIds.includes("broad-monster-control"));
assert.equal(saveData.quests.board.questIds.length, 4);
assert.ok(saveData.quests.board.questIds.some((questId) => questDefinitions[questId].rarity === "advanced"));
assert.ok(saveData.quests.board.questIds.filter((questId) => questDefinitions[questId].rarity === "rare").length <= 1);

const readyMessage = actions.prepareSelectedQuest("plains-boss-trophy", "ready");
assert.match(readyMessage, /可回報/);
assert.equal(saveData.quests.active.questId, "plains-boss-trophy");
assert.equal(saveData.inventory.materials.tainted_tusk.quantity, 3);
const readySnapshot = actions.getQuestDebugSnapshot();
assert.equal(readySnapshot.activeProgress, 3);
assert.equal(readySnapshot.activeTarget, 3);

assert.match(actions.clearActiveQuest(), /清除/);
assert.equal(saveData.quests.active, null);

saveData.quests.statistics.completedTotal = 9;
saveData.quests.statistics.rewardGoldTotal = 100;
assert.match(actions.resetQuestData(), /重設/);
assert.deepEqual(saveData.quests.board.questIds, []);
assert.equal(saveData.quests.statistics.completedTotal, 0);
assert.equal(saveData.quests.statistics.rewardGoldTotal, 0);

assert.match(actions.openGuildQuestBoard(), /開啟/);
assert.equal(saveData.storyFlags.guildQuestIntroductionSeen, true);
assert.equal(saveData.quests.board.questIds.length, 4);
assert.ok(boardCalls >= 4);
assert.ok(syncCalls >= 3);

const root = new URL("../", import.meta.url);
const [markup, panel, panelActions, runtimeActions, application, facility] = await Promise.all([
  readFile(new URL("src/ui/debugPanelMarkup.js", root), "utf8"),
  readFile(new URL("src/ui/debugPanel.js", root), "utf8"),
  readFile(new URL("src/ui/debugPanelActions.js", root), "utf8"),
  readFile(new URL("src/debug/runtimeActions.js", root), "utf8"),
  readFile(new URL("src/app/createApplication.js", root), "utf8"),
  readFile(new URL("src/features/facility/facilityController.js", root), "utf8")
]);

for (const actionId of [
  "replay-guild-quest-intro",
  "open-guild-quests",
  "prepare-selected-quest",
  "set-selected-quest-half",
  "set-selected-quest-ready",
  "clear-active-quest",
  "reset-quest-data"
]) {
  assert.match(markup, new RegExp(`data-action="${actionId}"`));
}
assert.match(markup, /debug-quest-select/);
assert.match(markup, /debug-quest-note/);
assert.match(panel, /populateDebugQuestOptions/);
assert.match(panelActions, /syncDebugQuestNote/);
assert.match(runtimeActions, /createDebugQuestActions/);
assert.match(application, /showGuildQuestIntroduction: world\.showGuildQuestIntroduction/);
assert.match(application, /showGuildQuestFacility: world\.showGuildQuestFacility/);
assert.match(facility, /function showGuildQuestIntroduction\(\)/);

console.log("v0.2.6.3 quest debug controls tests passed.");
