import assert from "node:assert/strict";
import { SAVE_KEY, SAVE_SCHEMA_VERSION } from "../src/config.js";
import { createDefaultSave, loadSave, migrateSave, saveGame, SAVE_RECOVERY_KEY } from "../src/core/storage.js";
import { createSaveStore } from "../src/app/saveStore.js";
import { createSaveTransferController } from "../src/features/profile/saveTransferController.js";
import { createLegacySaveTransferCode } from "../src/ui/saveTools.js";
import { TestNode } from "./dom-test-stub.mjs";
import { createRunRecords } from "../src/features/adventure/runRecords.js";
import { createRunLifecycleController } from "../src/features/adventure/runLifecycleController.js";
import { plainsRegion } from "../src/data/regions/plains.js";
import { materialDefinitions } from "../src/data/materials.js";

const values = new Map();
let rejectWrites = false;
let rejectDeletes = false;
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem(key, value) {
    if (rejectWrites) throw new Error("Storage unavailable");
    values.set(key, value);
  },
  removeItem(key) {
    if (rejectDeletes) throw new Error("Storage unavailable");
    values.delete(key);
  }
};

const existing = createDefaultSave();
existing.inventory.gold = 100;
const original = JSON.stringify(existing);
values.set(SAVE_KEY, original);
assert.equal(loadSave().inventory.gold, 100);

values.set(SAVE_KEY, "{broken");
let notice;
const fallback = loadSave({ onError: (error) => { notice = error; } });
assert.ok(notice);
assert.equal(saveGame(fallback), false);
assert.equal(values.get(SAVE_KEY), "{broken", "Failed load must protect original bytes from autosave");

const future = { ...existing, schemaVersion: SAVE_SCHEMA_VERSION + 1 };
assert.throws(() => migrateSave(future), /較新的/);
values.set(SAVE_KEY, JSON.stringify(future));
loadSave();
assert.equal(saveGame(existing), false);
assert.equal(JSON.parse(values.get(SAVE_KEY)).schemaVersion, SAVE_SCHEMA_VERSION + 1);

const restored = migrateSave(existing, { persist: true, replaceProtected: true });
assert.equal(restored.inventory.gold, 100);
assert.equal(JSON.parse(values.get(SAVE_RECOVERY_KEY)).schemaVersion, SAVE_SCHEMA_VERSION + 1);
assert.equal(saveGame(existing), true);

const legacy = { ...existing, schemaVersion: SAVE_SCHEMA_VERSION - 1 };
values.set(SAVE_KEY, JSON.stringify(legacy));
loadSave();
assert.equal(values.get(SAVE_RECOVERY_KEY), JSON.stringify(legacy));

rejectWrites = true;
assert.throws(() => migrateSave(existing, { persist: true }), /無法保存/);
assert.equal(loadSave().inventory.gold, 100, "Readable progress stays visible even when migration cannot persist");
assert.equal(saveGame(createDefaultSave()), false);
rejectWrites = false;
loadSave();

const store = createSaveStore({ initialSave: existing, persistSave: saveGame });
const els = new Proxy({}, { get(target, key) { return target[key] ||= new TestNode(); } });
let resets = 0;
const noop = () => {};
const controller = createSaveTransferController({
  saveStore: store, els, windowRef: {}, saveGameSafe: () => store.persist(),
  syncSafeAreaUiFromSave: noop, syncSelectionFromSave: noop, syncMusicSettingsFromSave: noop,
  resetAdventureRunRuntime: () => { resets += 1; }, resetPreparationUiState: noop,
  resetAchievementUiRuntime: noop, resetFacilityUiState: noop,
  resetStatisticsUiAfterSaveReplacement: noop, renderStatistics: noop
});
const incoming = createDefaultSave();
incoming.inventory.gold = 500;
els.importSaveCodeText.value = createLegacySaveTransferCode(incoming, "test");
await controller.checkImportSaveCode();
rejectWrites = true;
controller.confirmImportSaveCode();
assert.equal(store.current, existing, "Failed import cannot replace the active save");
assert.equal(resets, 0);
assert.equal(els.importSaveCodeNotice.dataset.type, "error");
rejectWrites = false;
controller.confirmImportSaveCode();
assert.equal(store.current.inventory.gold, 500, "Failed import remains retryable");
assert.equal(JSON.parse(values.get(SAVE_KEY)).inventory.gold, 500);
assert.equal(resets, 1);

rejectDeletes = true;
controller.deleteSave();
assert.equal(store.current.inventory.gold, 500);
assert.equal(resets, 1);
assert.equal(els.saveNotice.dataset.type, "error");
rejectDeletes = false;
controller.deleteSave();
assert.equal(store.current.inventory.gold, 0);
assert.equal(JSON.parse(values.get(SAVE_KEY)).inventory.gold, 0);
assert.equal(values.has(SAVE_RECOVERY_KEY), false, "Explicit deletion also removes the recovery copy");
store.current.inventory.gold = 100;
const runState = { selectedRegionId: "plains", selectedHeroId: "adventurer", run: 0 };
const uiState = { selectedPreparationId: "simple-bandage", navigationContext: "camp" };
let saveAllowed = false;
let encounters = 0;
let screen;
const records = createRunRecords({ state: runState, saveStore: store, saveGameSafe: () => saveAllowed });
const dependencies = {
  state: runState, uiState, saveStore: store, els, windowRef: {}, materialDefinitions,
  runStartingFlees: 3, currentRegion: () => plainsRegion, currentAdventureSource: () => plainsRegion,
  getEventRuntime: () => null, hasPhoenixBlessing: () => true,
  buildHeroFromProgression: () => ({ level: 1, hp: 50, maxHp: 50 }),
  ...records, saveGameSafe: () => saveAllowed,
  runSaveOperation: (action) => action(), afterAdventureSaved: (effect) => effect(),
  setNavigationContext: (context) => { uiState.navigationContext = context; },
  showScreen: (id) => { screen = id; },
  startEncounter: () => { encounters += 1; }
};
const lifecycle = createRunLifecycleController(new Proxy(dependencies, {
  get: (target, key) => key in target ? target[key] : noop
}));
lifecycle.startPlayerRun();
assert.equal(encounters, 0);
assert.equal(store.current.inventory.gold, 100, "Failed run start restores preparation payment");
assert.equal(store.current.statistics.totalRuns, 0);
assert.equal(runState.ended, true);
assert.equal(uiState.runStartLocked, false);
assert.equal(screen, "regionScreen");
assert.match(uiState.runStartNotice, /無法保存出發紀錄/);
saveAllowed = true;
lifecycle.startPlayerRun();
assert.equal(encounters, 1);
assert.ok(store.current.inventory.gold < 100);
assert.equal(store.current.statistics.totalRuns, 1);
console.log("Save reliability: protected load, future schema, recovery backup, import retry and deletion passed.");
