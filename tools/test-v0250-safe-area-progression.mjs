import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  createDefaultSafeAreaProgression,
  getCurrentSafeAreaId,
  getUnlockedSafeAreaIds,
  isSafeAreaUnlocked,
  migrateSafeAreaProgression,
  setCurrentSafeArea,
  syncSafeAreaUnlocks
} from "../src/core/safeAreaProgression.js";
import { createDefaultSave, migrateSave } from "../src/core/storage.js";
import { ANPING_TOWN_SAFE_AREA_ID, DEFAULT_SAFE_AREA_ID } from "../src/data/safeAreas.js";

const defaults = createDefaultSafeAreaProgression();
assert.deepEqual(defaults[DEFAULT_SAFE_AREA_ID], { unlocked: true, unlockedAt: null });
assert.deepEqual(defaults[ANPING_TOWN_SAFE_AREA_ID], { unlocked: false, unlockedAt: null });

const defaultSave = createDefaultSave();
assert.equal(defaultSave.settings.currentSafeAreaId, DEFAULT_SAFE_AREA_ID);
assert.equal(isSafeAreaUnlocked(defaultSave, DEFAULT_SAFE_AREA_ID), true);
assert.equal(isSafeAreaUnlocked(defaultSave, ANPING_TOWN_SAFE_AREA_ID), false);
assert.deepEqual(getUnlockedSafeAreaIds(defaultSave), [DEFAULT_SAFE_AREA_ID]);
assert.equal(getCurrentSafeAreaId(defaultSave), DEFAULT_SAFE_AREA_ID);
assert.throws(() => setCurrentSafeArea(defaultSave, ANPING_TOWN_SAFE_AREA_ID), /尚未解鎖/);
assert.throws(() => setCurrentSafeArea(defaultSave, "missing-town"), /找不到安全區 definition/);

const fixedUnlockedAt = "2026-07-13T12:00:00.000Z";
defaultSave.statistics.regions.forest.routeClears.main = 1;
assert.deepEqual(syncSafeAreaUnlocks(defaultSave, { unlockedAt: fixedUnlockedAt }), [ANPING_TOWN_SAFE_AREA_ID]);
assert.equal(defaultSave.progression.safeAreas[ANPING_TOWN_SAFE_AREA_ID].unlocked, true);
assert.equal(defaultSave.progression.safeAreas[ANPING_TOWN_SAFE_AREA_ID].unlockedAt, fixedUnlockedAt);
assert.deepEqual(syncSafeAreaUnlocks(defaultSave, { unlockedAt: "later" }), []);
assert.equal(defaultSave.progression.safeAreas[ANPING_TOWN_SAFE_AREA_ID].unlockedAt, fixedUnlockedAt);
assert.equal(setCurrentSafeArea(defaultSave, ANPING_TOWN_SAFE_AREA_ID), ANPING_TOWN_SAFE_AREA_ID);
assert.equal(getCurrentSafeAreaId(defaultSave), ANPING_TOWN_SAFE_AREA_ID);

const goblinOnlySave = createDefaultSave();
goblinOnlySave.statistics.regions.forest.routeClears.goblinCamp = 3;
assert.deepEqual(syncSafeAreaUnlocks(goblinOnlySave, { unlockedAt: fixedUnlockedAt }), []);
assert.equal(isSafeAreaUnlocked(goblinOnlySave, ANPING_TOWN_SAFE_AREA_ID), false);

const migratedSchema6 = migrateSave({
  schemaVersion: 6,
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
assert.equal(migratedSchema6.schemaVersion, 7);
assert.equal(isSafeAreaUnlocked(migratedSchema6, ANPING_TOWN_SAFE_AREA_ID), true, "舊存檔已完成森林主線時應補解鎖安平鎮");
assert.equal(getCurrentSafeAreaId(migratedSchema6), ANPING_TOWN_SAFE_AREA_ID);
assert.ok(migratedSchema6.progression.safeAreas[ANPING_TOWN_SAFE_AREA_ID].unlockedAt);

const migratedLockedCurrent = migrateSave({
  schemaVersion: 7,
  progression: {
    safeAreas: {
      camp: { unlocked: true },
      [ANPING_TOWN_SAFE_AREA_ID]: { unlocked: false }
    }
  },
  settings: {
    currentSafeAreaId: ANPING_TOWN_SAFE_AREA_ID
  }
});
assert.equal(getCurrentSafeAreaId(migratedLockedCurrent), DEFAULT_SAFE_AREA_ID, "未解鎖安全區不得成為目前位置");

const migratedLegacyIds = migrateSafeAreaProgression({
  unlockedSafeAreaIds: [DEFAULT_SAFE_AREA_ID, ANPING_TOWN_SAFE_AREA_ID, ANPING_TOWN_SAFE_AREA_ID]
});
assert.equal(migratedLegacyIds[ANPING_TOWN_SAFE_AREA_ID].unlocked, true, "早期 ID 陣列草案應可無痛正規化");

const gameSource = await readFile(new URL("../game.js", import.meta.url), "utf8");
assert.match(gameSource, /function syncSafeAreaUiFromSave\(\)[\s\S]*uiState\.safeAreaId = getCurrentSafeAreaId\(saveData\)/);
assert.match(gameSource, /function activateSafeArea\(safeAreaId\)[\s\S]*setCurrentSafeArea\(saveData, safeAreaId\)/);
assert.match(gameSource, /if \(!isSafeAreaUnlocked\(saveData, safeArea\.id\)\)/);
assert.match(gameSource, /activateSafeArea\(safeArea\.id\)/);
assert.match(gameSource, /syncSafeAreaUnlocks\(saveData\);[\s\S]*state\.runResultRecorded = true/);

console.log("v0.2.5.0 Safe Area progression backend tests passed.");
