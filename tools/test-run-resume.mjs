import assert from "node:assert/strict";
import { captureRunSnapshot, restoreRunSnapshot, readRunSnapshot, withRunRandom } from "../src/core/runSnapshot.js";
import { createAdventureRuntimeState } from "../src/app/runtimeState.js";
import { createDefaultSave } from "../src/core/saveDefaults.js";
import { migrateSaveData } from "../src/core/saveMigrations.js";
import { createSaveStore } from "../src/app/saveStore.js";
import { createSaveTransactions } from "../src/app/saveTransactions.js";
import { createAdventureSaveActions } from "../src/app/adventureSaveActions.js";
import { buildHeroFromProgression } from "../src/core/progression.js";
import { characterDefinitions } from "../src/data/characters/index.js";
import { regionDefinitions } from "../src/data/regions/index.js";
import { createSaveTransferCode, parseSaveTransferCode } from "../src/ui/saveTools.js";

function makeState() {
  const state = createAdventureRuntimeState({ regionDefinitions, characterDefinitions });
  state.hero = buildHeroFromProgression(characterDefinitions.adventurer, { level: 1, exp: 0, learnedSkills: [] });
  state.runStats = { levelUps: [], learnedSkills: [], unlockedCharacters: [] };
  state.phase = "combat";
  state.runRandomState = 51;
  state.hero.battleHooks = { onDirectAttackResolved() {} };
  state.runPreparation = { reducedEnemiesThisBattle: new Set(["enemy-1"]) };
  state.hero.activePreparation = state.runPreparation;
  state.enemies = [{ runtimeId: "enemy-1", hp: 8, maxHp: 20 }];
  return state;
}
const state = makeState();
const snapshot = captureRunSnapshot(state);
const target = makeState();
target.eventTransitionToken = 900;
restoreRunSnapshot(target, JSON.parse(JSON.stringify(snapshot)));
assert.equal(target.eventTransitionToken, 900, "Restoration cannot revive obsolete async event callbacks");
assert.equal(target.hero.battleHooks, undefined, "Hooks must be rebuilt, never serialized");
assert.equal(target.runPreparation.reducedEnemiesThisBattle.has("enemy-1"), true);
assert.equal(target.hero.activePreparation, target.runPreparation, "Preparation alias must survive restore");
assert.deepEqual(withRunRandom(state, () => [Math.random(), Math.random()]), withRunRandom(target, () => [Math.random(), Math.random()]));
assert.equal(state.runRandomState, target.runRandomState);
assert.equal(readRunSnapshot({ ...snapshot, gameVersion: "future" }).ok, false);
const corrupt = structuredClone(snapshot);
delete corrupt.state.hero.blessings;
assert.equal(readRunSnapshot(corrupt).ok, false);
assert.equal(captureRunSnapshot({ ...state, phase: "ended" }), null);
assert.equal(captureRunSnapshot({ ...state, runResumeFinished: true }), null);
assert.equal(captureRunSnapshot({ ...state, debugBuildRun: true }), null);

const save = createDefaultSave();
save.activeRun = snapshot;
const migrated = migrateSaveData(JSON.parse(JSON.stringify(save)));
assert.deepEqual(migrated.activeRun, snapshot);
const transferred = await parseSaveTransferCode(await createSaveTransferCode(save, save.gameVersion));
const transferredState = makeState();
restoreRunSnapshot(transferredState, migrateSaveData(transferred.save).activeRun);
assert.equal(transferredState.runPreparation.reducedEnemiesThisBattle.has("enemy-1"), true, "Compressed export/import must preserve preparation sets");
assert.equal(transferredState.runRandomState, snapshot.state.runRandomState);
assert.equal(migrateSaveData({ ...save, schemaVersion: 11, activeRun: null }).schemaVersion, 12);
assert.deepEqual(migrateSaveData({ ...save, activeRun: { ...snapshot, gameVersion: "future" } }).activeRun.gameVersion, "future");

{
  let permitted = false;
  let retry;
  let disk = structuredClone(save);
  const attempts = [];
  const store = createSaveStore({ initialSave: structuredClone(save), persistSave(candidate) {
    attempts.push(structuredClone(candidate));
    if (!permitted) return false;
    disk = structuredClone(candidate); return true;
  } });
  const tx = createSaveTransactions({ saveStore: store, pendingView: { show(options) { retry = options.retry; }, hide() {} } });
  const runtime = makeState();
  const ops = createAdventureSaveActions({ saveStore: store, ...tx, state: runtime });
  ops.runSaveOperation(() => {
    runtime.turn++;
    runtime.hero.hp -= 3;
    store.current.inventory.gold += Math.floor(Math.random() * 10);
    store.persist();
  });
  assert.deepEqual(disk, save, "Runtime cannot advance in storage without its permanent changes");
  retry(); permitted = true; retry();
  assert.equal(disk.activeRun.state.turn, 1);
  assert.equal(disk.activeRun.state.hero.hp, runtime.hero.hp);
  assert.deepEqual(attempts[0], attempts[1]);
  assert.deepEqual(attempts[1], attempts[2]);
  // P-08: a no-op action from the menu must not erase the stored journey.
  runtime.hero = null;
  ops.runSaveOperation(() => {});
  assert.equal(disk.activeRun.state.turn, 1);
}
console.log("Run resume: JSON/Set roundtrip, deterministic random continuation, migration, rejection, atomic retry and pending journey protection passed.");
