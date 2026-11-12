import assert from "node:assert/strict";
import { createDefaultSave, migrateSave } from "../../src/core/storage.js";
import { getSwordTraining, recordSwordTraining, unlockSwordTraining, selectSwordTrainingMode } from "../../src/core/weaponTraining.js";
import { finishWeaponTurn, runWeaponAttack, resetWeaponTechnique } from "../../src/core/weaponTechniques.js";
import { getHeroEffectiveAttack } from "../../src/core/heroCombat.js";
import { remakeHarness } from "../highland-remake-harness.mjs";
import { withSeed } from "../model-test-helpers.mjs";
import { createSaveStore } from "../../src/app/saveStore.js";
import { createAdventureSaveActions } from "../../src/app/adventureSaveActions.js";
import { captureRunSnapshot, readRunSnapshot } from "../../src/core/runSnapshot.js";

const event = { regionId: "forest", weaponId: "windbreak-sword", battleSource: "main", debugBuildRun: false, playerAction: "attack", riposteDamage: 2, riposteFromStandardGuard: true };
const save = createDefaultSave();
assert.throws(() => unlockSwordTraining(save));
save.inventory.weapons["windbreak-sword"] = true;
for (const bad of [{debugBuildRun:true}, {battleSource:"duel"}, {playerAction:"guard"}, {riposteDamage:0}, {riposteFromStandardGuard:false}, {weaponId:"iron-longsword"}, {regionId:"plains"}]) {
  assert.equal(recordSwordTraining(save, { ...event, ...bad }), false);
}
for (const regionId of ["forest", "beach", "highlands"]) {
  assert.equal(recordSwordTraining(save, { ...event, regionId }), true);
  assert.equal(recordSwordTraining(save, { ...event, regionId }), false);
}
assert.equal(getSwordTraining(save).ready, true);
unlockSwordTraining(save);
selectSwordTrainingMode(save, "swift");
assert.equal(getSwordTraining(migrateSave(save)).mode, "swift");
const legacy = structuredClone(save); legacy.schemaVersion = 12; delete legacy.weaponTraining;
assert.equal(getSwordTraining(migrateSave(legacy)).mode, "steady");
assert.equal(getSwordTraining(migrateSave(legacy)).ready, false);

// A failed write retains the exact candidate and does not count the action twice.
let writable = false;
const store = createSaveStore({ initialSave: createDefaultSave(), persistSave: () => writable });
const transactions = { commitSaveChange: (mutate, complete, options) => { const result = store.transact(mutate, options); if (result.status === "saved") complete(); return result; } };
const operations = createAdventureSaveActions({ saveStore: store, ...transactions });
operations.runSaveOperation(() => recordSwordTraining(store.current, event));
assert.equal(getSwordTraining(store.current).regions.forest, false);
writable = true;
assert.equal(store.retryPending().status, "saved");
assert.equal(getSwordTraining(store.current).regions.forest, true);

// The two variants consume one independent packet; no callback runs for it.
for (const mode of ["steady", "swift"]) {
  const h = remakeHarness({ weapon: "windbreak-sword", region: "forest" });
  h.state.hero.equipment.trainingMode = mode;
  h.state.hero.hp = h.state.hero.maxHp;
  h.state.enemies.forEach(e => { e.attack = 30; e.specialAttack = null; e.chargeEvery = null; e.paralysis = 0; });
  withSeed(8, () => h.controller.playTurn("guard"));
  assert.ok(h.state.hero.weaponRuntime.riposte, `${mode} guard primes riposte`);
  assert.equal(h.state.hero.guardState, null);
  if (mode === "swift") assert.equal(h.state.hero.weaponRuntime.riposteUntil, h.state.turn + 1);
  const target = h.state.enemies[0]; target.hp = 1000; target.defense = 0;
  let callbacks = 0;
  const old = h.state.hero.battleHooks;
  h.state.hero.battleHooks = { onDirectAttackResolved: () => { callbacks++; } };
  runWeaponAttack({ state: h.state, action: "attack", target, log: { fixed() {} }, runAttack() {
    h.state.hero.battleHooks.onDirectAttackResolved({ source: "primary", enemy: target, dodged: false, damage: 10 });
  } });
  assert.equal(callbacks, 1);
  assert.equal(h.state.hero.weaponRuntime.riposte, false);
  const expected = Math.max(1, Math.round(getHeroEffectiveAttack(h.state.hero) * (mode === "swift" ? 1.1 : .7) + 4));
  assert.equal(1000 - target.hp, expected);
  h.state.hero.battleHooks = old;
}

const missedCounter = remakeHarness({ weapon: "windbreak-sword", region: "forest" });
const missedCounterTarget = missedCounter.state.enemies[0];
missedCounterTarget.hp = 1000;
missedCounter.state.hero.weaponRuntime.riposte = true;
missedCounter.state.hero.weaponRuntime.riposteFromStandardGuard = true;
const missedCounterResult = runWeaponAttack({
  state: missedCounter.state,
  action: "attack",
  target: missedCounterTarget,
  log: { fixed() {} },
  runAttack() {
    missedCounter.state.hero.battleHooks.onDirectAttackResolved({ source: "original", enemy: missedCounterTarget, dodged: true, damage: 0 });
  }
});
assert.equal(missedCounterResult.primaryHit, false);
assert.equal(missedCounterResult.riposteDamage, 0, "a missed main attack cannot deal the riposte packet");
assert.equal(missedCounterTarget.hp, 1000);
assert.equal(missedCounter.state.hero.weaponRuntime.riposte, false, "the attempted counter is consumed on a miss");

const swift = { equipment: { weaponId: "windbreak-sword", trainingMode: "swift" }, guardState: { preventedDamage: 4 } };
resetWeaponTechnique(swift);
finishWeaponTurn({ hero: swift, enemies: [], turn: 5 }, "hold");
assert.equal(swift.weaponRuntime.riposte, false, "hold cannot bypass the cost");
finishWeaponTurn({ hero: swift, enemies: [], turn: 5 }, "guard");
swift.guardState = null;
finishWeaponTurn({ hero: swift, enemies: [], turn: 6 }, "guard");
assert.equal(swift.weaponRuntime.riposte, false, "a missed opportunity expires");

// Real turn controller records only a completed guard-to-riposte sequence.
// Retry seeds because highland intents can legitimately aim away from the player.
for (const region of ["forest", "beach", "highlands"]) {
  let reached = false;
  for (let seed = 1; seed <= 30 && !reached; seed++) {
    const h = remakeHarness({ weapon: "windbreak-sword", region, configure: ({ permanent }) => ({
      recordSwordRiposte: e => recordSwordTraining(permanent, e)
    }) });
    h.state.enemies.forEach(e => { e.hp = e.maxHp = 10000; e.attack = 30; e.defense = 0; e.dodgeChance = 0; e.specialAttack = null; e.chargeEvery = null; });
    if (region === "highlands") {
      h.state.highlandBattle.pattern = [0];
      h.state.hero.battleColumn = 1;
      h.state.enemies.forEach(e => { e.battleColumn = 1; });
      h.state.highlandBattle.intents = h.state.enemies.map(e => ({ id: e.runtimeId, kind: "strike", columns: [h.state.hero.battleColumn], attackRatio: 1 }));
      h.state.highlandBattle.intentTurn = h.state.turn;
    }
    withSeed(seed, () => h.controller.playTurn("guard"));
    assert.equal(getSwordTraining(h.permanent).regions[region], false, "guard alone does not complete training");
    if (h.state.hero.weaponRuntime.riposte) withSeed(seed, () => h.controller.playTurn("attack"));
    reached = getSwordTraining(h.permanent).regions[region];
  }
  assert.ok(reached, `real guard-to-riposte sequence is recorded in ${region}`);
}

const braced = remakeHarness({ weapon: "windbreak-sword", region: "highlands", configure: ({ permanent }) => ({
  recordSwordRiposte: e => recordSwordTraining(permanent, e)
}) });
braced.state.highlandBattle.pattern = [0];
braced.state.hero.battleColumn = 1;
braced.state.hero.highlandHold = 1;
braced.state.enemies.forEach(e => { e.hp = e.maxHp = 10000; e.attack = 30; e.defense = 0; e.dodgeChance = 0; e.battleColumn = 1; });
braced.state.highlandBattle.intents = braced.state.enemies.map(e => ({ id: e.runtimeId, kind: "strike", columns: [1], attackRatio: 1 }));
braced.state.highlandBattle.intentTurn = braced.state.turn;
withSeed(8, () => braced.controller.playTurn("hold"));
assert.equal(braced.state.hero.weaponRuntime.riposte, true, "steady sword keeps its existing hold counter behavior");
assert.equal(braced.state.hero.weaponRuntime.riposteFromStandardGuard, false, "highland hold is not a standard guard");
withSeed(8, () => braced.controller.playTurn("attack"));
assert.equal(getSwordTraining(braced.permanent).regions.highlands, false, "highland hold cannot complete the training objective");
const highland = remakeHarness({ weapon: "windbreak-sword", region: "highlands" });
highland.state.hero.equipment.trainingMode = "swift";
highland.state.highlandBattle.pattern = [0];
highland.state.highlandBattle.intents = highland.state.enemies.map(e => ({ id: e.runtimeId, kind: "strike", columns: [highland.state.hero.battleColumn], attackRatio: 1 }));
highland.state.highlandBattle.intentTurn = highland.state.turn;
highland.state.enemies.forEach(e => { e.attack = 30; });
withSeed(8, () => highland.controller.playTurn("guard"));
assert.equal(highland.state.hero.weaponRuntime.riposte, true);
const snapshot = captureRunSnapshot(highland.state);
const restored = readRunSnapshot(snapshot);
assert.equal(restored.ok, true);
assert.equal(restored.state.hero.equipment.trainingMode, "swift");
assert.equal(restored.state.hero.weaponRuntime.riposteUntil, highland.state.turn + 1);
assert.equal(restored.state.hero.weaponRuntime.riposteFromStandardGuard, true);
console.log("Sword training migration, transactions, eligibility, guard, timing and independent packet passed");
