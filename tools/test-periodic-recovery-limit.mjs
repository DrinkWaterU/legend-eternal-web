import assert from "node:assert/strict";
import { remakeHarness } from "./highland-remake-harness.mjs";
import { applyBlessingEffects } from "../src/core/blessings.js";
import { applyHeroEndOfTurnRecoveryEffects } from "../src/core/combatStatusEffects.js";
import { captureRunSnapshot, restoreRunSnapshot } from "../src/core/runSnapshot.js";
import { regionDefinitions } from "../src/data/regions/index.js";
import { blessingPoolDefinitions } from "../src/data/blessings/index.js";

const fixture = remakeHarness({ region: "plains", level: 10, weapon: "iron-longsword" });
const { state, battle, controller } = fixture;
const wildgrass = regionDefinitions.plains.blessings.find(item => item.id === "wildgrass-bandage");
const spores = regionDefinitions.forest.blessings.find(item => item.id === "spore-breathing");
const tideRest = blessingPoolDefinitions.beach.blessings.find(item => item.effects.some(effect => effect.id === "beach-tide-rest"));
assert.ok(wildgrass && spores && tideRest);
applyBlessingEffects(state.hero, wildgrass, { instanceId: "grass-one" });
applyBlessingEffects(state.hero, wildgrass, { instanceId: "grass-two" });
applyBlessingEffects(state.hero, spores, { instanceId: "spores" });
applyBlessingEffects(state.hero, tideRest, { instanceId: "tide-one" });
applyBlessingEffects(state.hero, tideRest, { instanceId: "tide-two" });
const slime = regionDefinitions.plains.enemies.find(enemy => enemy.id === "slime");
battle.beginBattleRuntime({ enemies: [slime], encounterType: "normal" });
state.hero.maxHp = 1000; state.hero.hp = 500; state.hero.defense = 100; state.hero.shield = 0;
const originalRandom = Math.random;
try {
  Math.random = () => .99;
  for (let i = 0; i < 9; i++) controller.playTurn("guard");
  const counts = state.hero.blessingBattleState.periodicRecoveryCounts;
  assert.deepEqual(counts, { "periodic:grass-one:wildgrass-bandage": 3,
    "periodic:grass-two:wildgrass-bandage": 3, "timed:tide-one:beach-tide-rest": 3,
    "timed:tide-two:beach-tide-rest": 3, "periodic:spores:spore-breathing": 2 });
  const snapshot = captureRunSnapshot(state);
  assert.ok(snapshot);
  restoreRunSnapshot(state, snapshot);
  assert.deepEqual(state.hero.blessingBattleState.periodicRecoveryCounts, counts, "Save and resume preserve spent uses");
  battle.savePendingThreat("safeEscape");
  assert.equal(battle.resumePendingThreat(), true);
  assert.deepEqual(state.hero.blessingBattleState.periodicRecoveryCounts, counts, "Returning to the same threat does not refill recovery");
  for (let i = 0; i < 3; i++) controller.playTurn("guard");
  assert.equal(state.hero.blessingBattleState.periodicRecoveryCounts["periodic:spores:spore-breathing"], 3);
  assert.equal(state.hero.blessingBattleState.periodicRecoveryCounts["periodic:grass-one:wildgrass-bandage"], 4);
  assert.equal(state.hero.blessingBattleState.periodicRecoveryCounts["timed:tide-one:beach-tide-rest"], 4);
  for (let i = 0; i < 4; i++) controller.playTurn("guard");
  assert.equal(state.hero.blessingBattleState.periodicRecoveryCounts["periodic:spores:spore-breathing"], 4);
  const hp = state.hero.hp;
  for (let i = 0; i < 3; i++) controller.playTurn("guard");
  assert.ok(state.hero.hp <= hp, "Dragging the same fight past turn 16 cannot generate more healing");
  battle.beginBattleRuntime({ enemies: [slime], encounterType: "normal" });
  assert.equal(state.hero.blessingBattleState.periodicRecoveryCounts, undefined, "A new battle refills the allowance");
  state.hero.hp = state.hero.maxHp - 100;
  for (let i = 0; i < 3; i++) controller.playTurn("guard");
  assert.equal(state.hero.blessingBattleState.periodicRecoveryCounts["periodic:grass-one:wildgrass-bandage"], 1);
} finally { Math.random = originalRandom; }

function orderedRun(blessings) {
  const h = remakeHarness({ region: "plains", level: 10, weapon: "iron-longsword" });
  blessings.forEach(blessing => applyBlessingEffects(h.state.hero, blessing, { instanceId: blessing.id }));
  h.battle.beginBattleRuntime({ enemies: [slime], encounterType: "normal" });
  Object.assign(h.state.hero, { maxHp: 1000, hp: 500, defense: 100, shield: 0 });
  const old = Math.random; Math.random = () => .99;
  try { for (let i = 0; i < 4; i++) h.controller.playTurn("guard"); }
  finally { Math.random = old; }
  return { hp: h.state.hero.hp, counts: h.state.hero.blessingBattleState.periodicRecoveryCounts };
}
const firstGrass = orderedRun([wildgrass, spores]);
const firstSpores = orderedRun([spores, wildgrass]);
assert.equal(firstGrass.hp, firstSpores.hp, "Acquisition order cannot overwrite a healing interval");
assert.deepEqual(firstGrass.counts, firstSpores.counts);
assert.equal(firstGrass.counts["periodic:wildgrass-bandage:wildgrass-bandage"], 1);
assert.equal(firstGrass.counts["periodic:spore-breathing:spore-breathing"], 1);

const full = { name: "fixture", hp: 100, maxHp: 100, regenEvery: 3, regenAmount: 5,
  timedRegens: [{ id: "t", source: "fixture", remainingEncounters: 1, everyTurns: 3, maxHpRatio: .04 }] };
const log = { template() {} };
applyHeroEndOfTurnRecoveryEffects({ hero: full, turn: 3, log });
assert.deepEqual(full.blessingBattleState.periodicRecoveryCounts, {}, "Full health does not use a recovery charge");
full.hp = 50;
applyHeroEndOfTurnRecoveryEffects({ hero: full, turn: 6, log });
assert.deepEqual(full.blessingBattleState.periodicRecoveryCounts, { base: 1, "timed:t": 1 });
console.log("Periodic healing has finite per-source uses, saved through resume and reset for a new fight");
