import assert from "node:assert/strict";

import { createDefaultSave } from "../src/core/storage.js";
import { createRunRecords } from "../src/features/adventure/runRecords.js";

const saveStore = { current: createDefaultSave() };
const enemyEvents = [];
const clearEvents = [];
let saves = 0;
const state = {
  debugBuildRun: false,
  runResultRecorded: false,
  selectedRegionId: "forest",
  selectedHeroId: "adventurer",
  activeRouteId: "goblin-camp",
  encounterIndex: 3,
  runStats: {
    endLevel: 10,
    fleeAttempts: 0,
    fleeSuccesses: 0,
    fleeFailures: 0,
    safeEscapes: 0,
    counterEscapes: 0,
    evacuationEscapes: 0,
    evacuated: false
  }
};
const records = createRunRecords({
  state,
  saveStore,
  currentRegion: () => ({ encounterCount: 8 }),
  currentRoute: () => ({ clearSourceId: "goblinCamp" }),
  questRuntime: {
    recordEnemyDefeated: (event) => enemyEvents.push(event),
    recordRunCleared: (event) => clearEvents.push(event)
  },
  saveGameSafe: () => { saves += 1; return true; }
});

records.recordEnemyDefeated(false, { id: "forest-bee", kind: "普通", family: "insect" });
assert.equal(saveStore.current.statistics.totalEnemiesDefeated, 1);
assert.deepEqual(enemyEvents, [{
  enemyId: "forest-bee",
  enemyKind: "普通",
  enemyFamily: "insect",
  regionId: "forest",
  routeId: "goblin-camp",
  debugBuildRun: false
}]);

records.recordRunFinished("clear");
assert.equal(saveStore.current.statistics.totalClears, 1);
assert.equal(saveStore.current.statistics.regions.forest.routeClears.goblinCamp, 1);
assert.deepEqual(clearEvents, [{
  regionId: "forest",
  routeId: "goblin-camp",
  clearSourceId: "goblinCamp",
  debugBuildRun: false
}]);
records.recordRunFinished("clear");
assert.equal(clearEvents.length, 1, "同一次冒險不得重複推進通關委託");

state.debugBuildRun = true;
state.runResultRecorded = false;
records.recordEnemyDefeated(true, { id: "debug-boss", kind: "首領", family: "beast" });
records.recordRunFinished("clear");
assert.equal(enemyEvents.length, 1, "Debug 敵人不得推進委託");
assert.equal(clearEvents.length, 1, "Debug 通關不得推進委託");
assert.ok(saves >= 2);

console.log("Quest progress wiring for enemy defeat, route clear and debug exclusion passed.");
