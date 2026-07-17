import assert from "node:assert/strict";

import { validateGameDefinitions } from "../src/app/validateGameDefinitions.js";
import {
  generateQuestBoard,
  formatQuestObjective,
  getQuestProgress,
  matchClearObjective,
  matchEnemyObjective,
  normalizeQuestState
} from "../src/core/questRules.js";
import { createDefaultSave, migrateSave } from "../src/core/storage.js";
import { materialDefinitions } from "../src/data/materials.js";
import { questDefinitions } from "../src/data/quests.js";
import { createQuestRuntime } from "../src/features/quest/questRuntime.js";

validateGameDefinitions();
assert.equal(Object.keys(questDefinitions).length, 12);

assert.equal(
  formatQuestObjective(questDefinitions["plains-slime-suppression"]),
  "在平原擊敗史萊姆系敵人 20 隻"
);
assert.equal(
  formatQuestObjective(questDefinitions["forest-plant-control"]),
  "在森林擊敗植物系敵人 15 隻"
);
assert.equal(
  formatQuestObjective(questDefinitions["goblin-camp-patrol"]),
  "完成哥布林營地正式冒險 1 次"
);

const noRareBoard = generateQuestBoard(questDefinitions, { random: sequenceRandom([0.99, 0, 0.2, 0.4, 0.6]) });
assert.equal(noRareBoard.length, 4);
assert.equal(new Set(noRareBoard).size, 4);
assert.ok(noRareBoard.some((id) => questDefinitions[id].rarity === "advanced"));
assert.equal(noRareBoard.some((id) => questDefinitions[id].rarity === "rare"), false);

const rareBoard = generateQuestBoard(questDefinitions, { random: sequenceRandom([0, 0, 0, 0.2, 0.4, 0.6]) });
assert.equal(rareBoard.filter((id) => questDefinitions[id].rarity === "rare").length, 1);
assert.ok(rareBoard.some((id) => questDefinitions[id].rarity === "advanced"));

const excludedBoard = generateQuestBoard(questDefinitions, {
  random: sequenceRandom([0, 0, 0, 0.2, 0.4, 0.6]),
  excludedQuestId: "plains-boss-trophy"
});
assert.equal(excludedBoard.includes("plains-boss-trophy"), false);

const normalized = normalizeQuestState({
  board: { questIds: ["broad-monster-control", "missing"] },
  active: { questId: "broad-monster-control", progress: 999 },
  statistics: {
    completedTotal: 3,
    completedByRarity: { common: 2, advanced: 1, rare: -3 },
    abandonedTotal: 1,
    rewardGoldTotal: 40
  },
  completions: {
    "broad-monster-control": { count: 2, lastCompletedAtCompletionCount: 2 },
    missing: { count: 9 }
  }
});
assert.deepEqual(normalized.board.questIds, []);
assert.equal(normalized.active.progress, 30);
assert.equal(normalized.statistics.completedByRarity.rare, 0);
assert.equal(normalized.completions.missing, undefined);

const invalidCompositionBoard = normalizeQuestState({
  board: {
    questIds: [
      "broad-monster-control",
      "route-patrol",
      "elite-suppression",
      "plains-boss-trophy"
    ],
    excludedQuestId: "plains-boss-trophy"
  }
});
assert.deepEqual(
  invalidCompositionBoard.board.questIds,
  [],
  "包含剛完成委託或沒有進階委託的匯入看板必須重建"
);

assert.equal(matchEnemyObjective(questDefinitions["forest-insect-control"].objective, {
  regionId: "forest",
  enemyFamily: "insect",
  debugBuildRun: false
}), true);
assert.equal(matchEnemyObjective(questDefinitions["forest-insect-control"].objective, {
  regionId: "plains",
  enemyFamily: "insect",
  debugBuildRun: false
}), false);
assert.equal(matchEnemyObjective(questDefinitions["broad-monster-control"].objective, {
  regionId: "forest",
  enemyFamily: "insect",
  debugBuildRun: true
}), false);
assert.equal(matchClearObjective(questDefinitions["route-patrol"].objective, {
  regionId: "plains",
  clearSourceId: "main",
  debugBuildRun: false
}), true);
assert.equal(matchClearObjective(questDefinitions["goblin-camp-patrol"].objective, {
  regionId: "forest",
  routeId: "goblin-camp",
  clearSourceId: "goblinCamp",
  debugBuildRun: false
}), true);
assert.equal(matchClearObjective(questDefinitions["goblin-camp-patrol"].objective, {
  regionId: "forest",
  routeId: "goblin-camp",
  clearSourceId: "main",
  debugBuildRun: false
}), false);

const migrated = migrateSave({ schemaVersion: 8, inventory: { gold: 7 }, storyFlags: {} });
assert.equal(migrated.schemaVersion, 9);
assert.deepEqual(migrated.quests, createDefaultSave().quests);
assert.equal(migrated.storyFlags.guildQuestIntroductionSeen, false);

const saveStore = { current: createDefaultSave() };
let saveCalls = 0;
const runtime = createQuestRuntime({
  saveStore,
  questDefinitions,
  materialDefinitions,
  random: sequenceRandom([0.99, 0, 0.1, 0.3, 0.5, 0.7, 0.9]),
  saveGameSafe: () => { saveCalls += 1; return true; }
});
saveStore.current.quests.board.questIds = [
  "broad-monster-control",
  "route-patrol",
  "elite-suppression",
  "forest-insect-control"
];
assert.equal(runtime.acceptQuest("broad-monster-control").ok, true);
assert.equal(runtime.acceptQuest("route-patrol").ok, false, "同時只能承接一項委託");
for (let index = 0; index < 35; index += 1) {
  runtime.recordEnemyDefeated({ regionId: "plains", enemyKind: "普通", debugBuildRun: false });
}
let snapshot = runtime.getSnapshot();
assert.equal(snapshot.activeProgress, 30, "進度達標後不得溢出");
assert.equal(runtime.reportQuest().ok, true);
assert.equal(saveStore.current.inventory.gold, 20);
assert.equal(saveStore.current.quests.statistics.completedTotal, 1);
assert.equal(saveStore.current.quests.statistics.completedByRarity.common, 1);
assert.equal(saveStore.current.quests.completions["broad-monster-control"].count, 1);
assert.equal(saveStore.current.quests.board.questIds.includes("broad-monster-control"), false);

const boardBeforeAbandon = [...saveStore.current.quests.board.questIds];
const nextQuestId = boardBeforeAbandon[0];
assert.equal(runtime.acceptQuest(nextQuestId).ok, true);
assert.equal(runtime.abandonQuest().ok, true);
assert.deepEqual(saveStore.current.quests.board.questIds, boardBeforeAbandon, "放棄不得刷新看板");
assert.equal(saveStore.current.quests.statistics.abandonedTotal, 1);

saveStore.current.quests.board.questIds = [
  "plains-boss-trophy",
  "route-patrol",
  "elite-suppression",
  "forest-insect-control"
];
saveStore.current.inventory.materials.tainted_tusk = {
  id: "tainted_tusk",
  name: materialDefinitions.tainted_tusk.name,
  quantity: 3
};
assert.equal(runtime.acceptQuest("plains-boss-trophy").ok, true);
snapshot = runtime.getSnapshot();
assert.equal(getQuestProgress({
  quest: snapshot.activeQuest,
  active: snapshot.active,
  inventory: saveStore.current.inventory
}), 3);
const materialReport = runtime.reportQuest();
assert.equal(materialReport.ok, true);
assert.equal(materialReport.reward.gold, 55);
assert.equal(saveStore.current.inventory.materials.tainted_tusk, undefined);
assert.equal(saveStore.current.inventory.gold, 75);
assert.equal(saveStore.current.quests.statistics.completedByRarity.rare, 1);
assert.ok(saveCalls >= 6);

const saturatedStore = { current: createDefaultSave() };
saturatedStore.current.inventory.gold = Number.MAX_SAFE_INTEGER - 10;
saturatedStore.current.quests.board.questIds = [
  "broad-monster-control",
  "route-patrol",
  "elite-suppression",
  "forest-insect-control"
];
saturatedStore.current.quests.active = {
  questId: "broad-monster-control",
  progress: 30,
  acceptedAtCompletionCount: 0
};
saturatedStore.current.quests.statistics.completedTotal = Number.MAX_SAFE_INTEGER;
saturatedStore.current.quests.statistics.completedByRarity.common = Number.MAX_SAFE_INTEGER;
saturatedStore.current.quests.statistics.rewardGoldTotal = Number.MAX_SAFE_INTEGER - 5;
saturatedStore.current.quests.completions["broad-monster-control"] = {
  count: Number.MAX_SAFE_INTEGER,
  lastCompletedAtCompletionCount: Number.MAX_SAFE_INTEGER
};
const saturatedRuntime = createQuestRuntime({
  saveStore: saturatedStore,
  questDefinitions,
  materialDefinitions,
  random: () => 0.99,
  saveGameSafe: () => true
});
assert.equal(saturatedRuntime.reportQuest().ok, true);
assert.equal(saturatedStore.current.inventory.gold, Number.MAX_SAFE_INTEGER);
assert.equal(saturatedStore.current.quests.statistics.completedTotal, Number.MAX_SAFE_INTEGER);
assert.equal(saturatedStore.current.quests.statistics.completedByRarity.common, Number.MAX_SAFE_INTEGER);
assert.equal(saturatedStore.current.quests.statistics.rewardGoldTotal, Number.MAX_SAFE_INTEGER);
assert.equal(saturatedStore.current.quests.completions["broad-monster-control"].count, Number.MAX_SAFE_INTEGER);

const failingStore = { current: createDefaultSave() };
const failingRuntime = createQuestRuntime({
  saveStore: failingStore,
  questDefinitions,
  materialDefinitions,
  random: () => 0,
  saveGameSafe: () => false
});
const failedAccept = failingRuntime.acceptQuest("forest-insect-control");
assert.equal(failedAccept.ok, false);
assert.equal(failingStore.current.quests.active, null);
assert.deepEqual(failingStore.current.quests.board.questIds, [], "保存失敗時應回復看板與承接狀態");

function sequenceRandom(values) {
  let index = 0;
  return () => {
    const value = values[index % values.length];
    index += 1;
    return value;
  };
}

console.log("Quest definitions, board generation, migration and runtime lifecycle tests passed.");
