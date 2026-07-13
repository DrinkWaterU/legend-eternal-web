import assert from "node:assert/strict";

import { resetBattleEntryState } from "../src/adventure/battleLifecycle.js";

const preservedHero = { name: "測試角色" };
const preservedEnemies = [{ runtimeId: "enemy-1" }];
const preservedRunStats = { victories: 3 };
const originalLog = [{ type: "system", text: "舊紀錄" }];
const state = {
  turn: 8,
  awaitingBlessing: true,
  phase: "safe",
  canRest: true,
  hasRested: true,
  ambushAdvantage: false,
  battleSource: "event",
  battleEncounterType: "boss",
  log: originalLog,
  hero: preservedHero,
  enemies: preservedEnemies,
  encounterIndex: 7,
  runStats: preservedRunStats,
  ended: false
};

const result = resetBattleEntryState(state, {
  source: "counterEscape",
  encounterType: "counter",
  ambushAdvantage: true
});

assert.equal(result, state);
assert.equal(state.turn, 0);
assert.equal(state.awaitingBlessing, false);
assert.equal(state.phase, "danger");
assert.equal(state.canRest, false);
assert.equal(state.hasRested, false);
assert.equal(state.ambushAdvantage, true);
assert.equal(state.battleSource, "counterEscape");
assert.equal(state.battleEncounterType, "counter");
assert.deepEqual(state.log, []);
assert.notEqual(state.log, originalLog);
assert.equal(state.hero, preservedHero);
assert.equal(state.enemies, preservedEnemies);
assert.equal(state.encounterIndex, 7);
assert.equal(state.runStats, preservedRunStats);
assert.equal(state.ended, false);

const firstLog = state.log;
resetBattleEntryState(state);
assert.equal(state.ambushAdvantage, false);
assert.equal(state.battleSource, "main");
assert.equal(state.battleEncounterType, null);
assert.deepEqual(state.log, []);
assert.notEqual(state.log, firstLog);

assert.throws(
  () => resetBattleEntryState(null),
  /需要可修改的 state 物件/
);

console.log("Battle lifecycle tests passed.");
