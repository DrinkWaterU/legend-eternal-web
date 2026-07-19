import assert from "node:assert/strict";

import { createAdventureAchievements } from "../src/features/adventure/adventureAchievements.js";
import { createDefaultSave } from "../src/core/storage.js";
import { createRunRecords } from "../src/features/adventure/runRecords.js";
import { regionDefinitions } from "../src/data/regions/index.js";

function createRunState() {
  return {
    selectedRegionId: "beach",
    selectedHeroId: "adventurer",
    debugBuildRun: false,
    beachSegmentCompleted: false,
    runResultRecorded: false,
    encounterIndex: 16,
    activeRouteId: null,
    runStats: {
      endLevel: 20,
      fleeAttempts: 0,
      fleeSuccesses: 0,
      fleeFailures: 0,
      safeEscapes: 0,
      counterEscapes: 0,
      evacuationEscapes: 0
    }
  };
}

{
  const save = createDefaultSave();
  const state = createRunState();
  let saveCount = 0;
  const records = createRunRecords({
    state,
    saveStore: { current: save },
    currentRegion: () => regionDefinitions.beach,
    currentRoute: () => null,
    questRuntime: null,
    saveGameSafe: () => {
      saveCount += 1;
      return true;
    }
  });

  records.recordRunFinished("segmentClear");
  assert.equal(state.beachSegmentCompleted, true);
  assert.equal(state.runResultRecorded, true);
  assert.equal(save.statistics.totalClears, 0, "海灘段落完成不得計入完整海岸通關次數");
  assert.equal(save.statistics.regions.beach.clears, 0);
  assert.equal(save.statistics.regions.beach.bestEncounter, 16);
  assert.ok(saveCount >= 1);
}

{
  const save = createDefaultSave();
  const state = createRunState();
  state.encounterIndex = 32;
  state.activeRouteId = "coast-cave";
  const records = createRunRecords({
    state,
    saveStore: { current: save },
    currentRegion: () => regionDefinitions.beach,
    currentRoute: () => ({ clearSourceId: "coastCave" }),
    questRuntime: null,
    saveGameSafe: () => true
  });

  records.recordRunFinished("clear", { completedEncounterCount: 32 });
  assert.equal(save.statistics.totalClears, 1);
  assert.equal(save.statistics.regions.beach.clears, 1);
  assert.equal(save.statistics.regions.beach.bestEncounter, 32);
}

{
  const save = createDefaultSave();
  const state = { debugBuildRun: false, selectedRegionId: "beach" };
  const queued = [];
  const achievements = createAdventureAchievements({
    state,
    saveStore: { current: save },
    queueAchievementUnlock: (achievementId) => {
      queued.push(achievementId);
      return true;
    },
    forestTrialAchievementId: "forest_trial",
    goblinCampClearAchievementId: "goblin_camp_clear",
    beachTrialAchievementId: "beach_trial",
    coastTrialAchievementId: "coast_trial",
    saveGameSafe: () => true
  });

  achievements.unlockBeachSegmentAchievement();
  assert.deepEqual(queued, ["beach_trial"]);
  achievements.unlockCoastClearAchievement();
  assert.deepEqual(queued, ["beach_trial", "coast_trial"]);
}

console.log("海岸地區名稱、段落結算與成就分流測試通過。");
