import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  canEnterSafeArea,
  createDefaultSafeAreaProgression,
  getCurrentSafeAreaId,
  getUnlockedSafeAreaIds,
  isSafeAreaUnlocked,
  isSafeAreaVisited,
  markSafeAreaVisited,
  migrateSafeAreaProgression,
  setCurrentSafeArea,
  syncSafeAreaUnlocks
} from "../src/core/safeAreaProgression.js";
import { createDefaultSave, migrateSave } from "../src/core/storage.js";
import { ANPING_TOWN_SAFE_AREA_ID, DEFAULT_SAFE_AREA_ID } from "../src/data/safeAreas.js";

const fixedCreatedAt = "2026-07-13T10:00:00.000Z";
const fixedUnlockedAt = "2026-07-13T12:00:00.000Z";
const fixedVisitedAt = "2026-07-13T13:00:00.000Z";

const defaults = createDefaultSafeAreaProgression(undefined, { defaultVisitedAt: fixedCreatedAt });
assert.deepEqual(defaults[DEFAULT_SAFE_AREA_ID], {
  unlocked: true,
  unlockedAt: fixedCreatedAt,
  visitedAt: fixedCreatedAt
});
assert.deepEqual(defaults[ANPING_TOWN_SAFE_AREA_ID], {
  unlocked: false,
  unlockedAt: null,
  visitedAt: null
});

const defaultSave = createDefaultSave();
assert.equal(defaultSave.settings.currentSafeAreaId, DEFAULT_SAFE_AREA_ID);
assert.equal(isSafeAreaUnlocked(defaultSave, DEFAULT_SAFE_AREA_ID), true);
assert.equal(isSafeAreaVisited(defaultSave, DEFAULT_SAFE_AREA_ID), true);
assert.equal(canEnterSafeArea(defaultSave, DEFAULT_SAFE_AREA_ID), true);
assert.equal(isSafeAreaUnlocked(defaultSave, ANPING_TOWN_SAFE_AREA_ID), false);
assert.deepEqual(getUnlockedSafeAreaIds(defaultSave), [DEFAULT_SAFE_AREA_ID]);
assert.equal(getCurrentSafeAreaId(defaultSave), DEFAULT_SAFE_AREA_ID);
assert.throws(() => setCurrentSafeArea(defaultSave, ANPING_TOWN_SAFE_AREA_ID), /尚未解鎖/);
assert.throws(() => setCurrentSafeArea(defaultSave, "missing-town"), /找不到安全區 definition/);

defaultSave.statistics.regions.forest.routeClears.main = 1;
assert.deepEqual(syncSafeAreaUnlocks(defaultSave, { unlockedAt: fixedUnlockedAt }), [ANPING_TOWN_SAFE_AREA_ID]);
assert.equal(defaultSave.progression.safeAreas[ANPING_TOWN_SAFE_AREA_ID].unlocked, true);
assert.equal(defaultSave.progression.safeAreas[ANPING_TOWN_SAFE_AREA_ID].unlockedAt, fixedUnlockedAt);
assert.equal(defaultSave.progression.safeAreas[ANPING_TOWN_SAFE_AREA_ID].visitedAt, null);
assert.equal(canEnterSafeArea(defaultSave, ANPING_TOWN_SAFE_AREA_ID), false);
assert.throws(() => setCurrentSafeArea(defaultSave, ANPING_TOWN_SAFE_AREA_ID), /尚未造訪/);
assert.deepEqual(syncSafeAreaUnlocks(defaultSave, { unlockedAt: "2026-07-14T00:00:00.000Z" }), []);
assert.equal(defaultSave.progression.safeAreas[ANPING_TOWN_SAFE_AREA_ID].unlockedAt, fixedUnlockedAt);
assert.equal(markSafeAreaVisited(defaultSave, ANPING_TOWN_SAFE_AREA_ID, { visitedAt: fixedVisitedAt }), fixedVisitedAt);
assert.equal(canEnterSafeArea(defaultSave, ANPING_TOWN_SAFE_AREA_ID), true);
assert.equal(setCurrentSafeArea(defaultSave, ANPING_TOWN_SAFE_AREA_ID), ANPING_TOWN_SAFE_AREA_ID);
assert.equal(getCurrentSafeAreaId(defaultSave), ANPING_TOWN_SAFE_AREA_ID);

const goblinOnlySave = createDefaultSave();
goblinOnlySave.statistics.regions.forest.routeClears.goblinCamp = 3;
assert.deepEqual(syncSafeAreaUnlocks(goblinOnlySave, { unlockedAt: fixedUnlockedAt }), []);
assert.equal(isSafeAreaUnlocked(goblinOnlySave, ANPING_TOWN_SAFE_AREA_ID), false);

const migratedSchema6 = migrateSave({
  schemaVersion: 6,
  profile: { createdAt: fixedCreatedAt },
  statistics: {
    regions: {
      forest: {
        clears: 2,
        routeClears: { main: 1, goblinCamp: 1 }
      }
    }
  },
  settings: {
    currentSafeAreaId: ANPING_TOWN_SAFE_AREA_ID
  }
});
assert.equal(migratedSchema6.schemaVersion, 9);
assert.equal(isSafeAreaUnlocked(migratedSchema6, ANPING_TOWN_SAFE_AREA_ID), true, "舊存檔已完成森林主線時應補解鎖安平鎮");
assert.equal(isSafeAreaVisited(migratedSchema6, ANPING_TOWN_SAFE_AREA_ID), false, "migration 不得跳過首次抵達演出");
assert.equal(getCurrentSafeAreaId(migratedSchema6), DEFAULT_SAFE_AREA_ID, "未造訪安平鎮時位置應回退營地");
assert.ok(migratedSchema6.progression.safeAreas[ANPING_TOWN_SAFE_AREA_ID].unlockedAt);

const migratedVisited = migrateSave({
  schemaVersion: 7,
  progression: {
    safeAreas: {
      camp: { unlocked: true, visitedAt: fixedCreatedAt },
      [ANPING_TOWN_SAFE_AREA_ID]: {
        unlocked: false,
        unlockedAt: null,
        visitedAt: fixedVisitedAt
      }
    }
  },
  settings: {
    currentSafeAreaId: ANPING_TOWN_SAFE_AREA_ID
  }
});
assert.equal(isSafeAreaUnlocked(migratedVisited, ANPING_TOWN_SAFE_AREA_ID), true, "visitedAt 應強制補 unlocked");
assert.equal(getCurrentSafeAreaId(migratedVisited), ANPING_TOWN_SAFE_AREA_ID);

const migratedInvalidVisited = migrateSave({
  schemaVersion: 7,
  progression: {
    safeAreas: {
      camp: { unlocked: true },
      [ANPING_TOWN_SAFE_AREA_ID]: { unlocked: true, visitedAt: "not-a-date" }
    }
  },
  settings: {
    currentSafeAreaId: ANPING_TOWN_SAFE_AREA_ID
  }
});
assert.equal(isSafeAreaVisited(migratedInvalidVisited, ANPING_TOWN_SAFE_AREA_ID), false);
assert.equal(getCurrentSafeAreaId(migratedInvalidVisited), DEFAULT_SAFE_AREA_ID);

const migratedLegacyIds = migrateSafeAreaProgression({
  profile: { createdAt: fixedCreatedAt },
  unlockedSafeAreaIds: [DEFAULT_SAFE_AREA_ID, ANPING_TOWN_SAFE_AREA_ID, ANPING_TOWN_SAFE_AREA_ID]
});
assert.equal(migratedLegacyIds[ANPING_TOWN_SAFE_AREA_ID].unlocked, true, "早期 ID 陣列草案應可正規化");
assert.ok(migratedLegacyIds[ANPING_TOWN_SAFE_AREA_ID].unlockedAt, "已解鎖舊資料缺少時間時應補上 unlockedAt");
assert.equal(migratedLegacyIds[ANPING_TOWN_SAFE_AREA_ID].visitedAt, null);

const runtimeSources = (await Promise.all(["../src/features/safeArea/safeAreaController.js", "../src/features/story/anpingArrivalController.js", "../src/features/adventure/runLifecycleController.js", "../src/features/adventure/runResultController.js"].map((path) => readFile(new URL(path, import.meta.url), "utf8")))).join("\n");
assert.match(runtimeSources, /function syncSafeAreaUiFromSave\(\)[\s\S]*uiState\.safeAreaId = getCurrentSafeAreaId\(saveStore\.current\)/);
assert.match(runtimeSources, /function travelToSafeArea\(safeAreaId\)[\s\S]*canEnterSafeArea\(saveStore\.current, safeAreaId\)/);
assert.match(runtimeSources, /function completeStory\(\)[\s\S]*markSafeAreaVisited\(saveStore\.current, ANPING_TOWN_SAFE_AREA_ID\)[\s\S]*setCurrentSafeArea\(saveStore\.current, ANPING_TOWN_SAFE_AREA_ID\)/);
assert.match(runtimeSources, /state\.runOriginSafeAreaId = startContext\.runOriginSafeAreaId/);
assert.match(runtimeSources, /function returnToRunOriginSafeArea\(\)/);
assert.match(runtimeSources, /function shouldOfferAnpingArrivalAfterRun\(outcome\)[\s\S]*!currentRoute\(\)/);
assert.match(runtimeSources, /function getAdventureEventScheduleChance\(\)[\s\S]*state\.selectedRegionId === "forest"[\s\S]*!saveStore\.current\.storyFlags\.archerRescued[\s\S]*return 0\.5/);

console.log("v0.2.5.0 Safe Area progression and arrival state tests passed.");
