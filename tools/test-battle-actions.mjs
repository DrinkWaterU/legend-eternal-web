import assert from "node:assert/strict";
import { createBattleLog } from "../src/features/battle/battleLog.js";
import { createBattleTurnController } from "../src/features/battle/battleTurnController.js";
import { canTakeBattleAction } from "../src/core/battleActions.js";
import { getEnemyIntent, getScheduledSpecialAttack } from "../src/core/enemyIntent.js";
import { templates } from "../src/data/templates.js";

const state = { hero: { hp: 100, maxHp: 100, defense: 0, skills: [] }, enemies: [
  { hp: 100, maxHp: 100, attack: 10, name: "Enemy", runtimeId: "a" }
], phase: "danger", ended: false, turn: 0, log: [] };
let renders = 0;
const log = createBattleLog({ state, templates, renderLog: () => { renders += 1; } });
log.withLogBatch(() => {
  for (let i = 0; i < 20; i += 1) log.addFixedLog("status", String(i));
  log.withLogBatch(() => log.addFixedLog("status", "nested"));
});
assert.equal(renders, 1);
assert.equal(state.log.length, 21);
assert.throws(() => log.withLogBatch(() => {
  log.addFixedLog("status", "before error");
  throw new Error("test");
}), /test/);
assert.equal(renders, 2, "Early exits still flush the batch");
log.withLogBatch(() => {
  for (let i = 0; i < 1200; i += 1) log.addFixedLog("status", String(i));
});
assert.equal(state.log.length, 1000);
assert.equal(state.log.at(-1).text, "1199");

for (const phase of ["safe", "event", "segmentChoice", "routeEnding", "camp"]) {
  assert.equal(canTakeBattleAction({ ...state, phase }), false);
}
for (const flag of ["eventInputLocked", "adventureProgressLocked", "awaitingBlessing", "ended"]) {
  assert.equal(canTakeBattleAction({ ...state, [flag]: true }), false);
}
assert.equal(canTakeBattleAction(state), true);
let attacks = 0;
const noop = () => {};
const controller = createBattleTurnController({
  state, createCombatLogger: log.createCombatLogger, withLogBatch: log.withLogBatch,
  currentTargetEnemy: () => state.enemies[0],
  runHeroPlayerAction: () => { attacks += 1; },
  consumeEntangleRetry: () => false, recordEntangleRetryResult: noop,
  modifyPoisonDamage: (damage) => damage, settleDefeatedEnemies: noop,
  applyEmergencyBandage: noop, tryLastStand: () => false,
  winEncounter: noop, loseRun: noop, render: noop
});
state.eventInputLocked = true;
controller.playTurn();
assert.equal(state.turn, 0);
state.eventInputLocked = false;
const before = renders;
controller.playTurn("guard");
assert.equal(attacks, 0);
assert.equal(state.hero.hp, 93);
assert.equal(state.hero.guardState, null);
assert.equal(renders, before + 1, "An actual guard turn renders its log once");

const enemy = { hp: 100, chargeEvery: 3 };
assert.equal(getEnemyIntent(enemy, 1), null);
assert.match(getEnemyIntent(enemy, 2), /衝鋒/);
enemy.specialAttack = { name: "Triple hit", everyTurns: 3, telegraphText: "準備連擊" };
assert.match(getEnemyIntent(enemy, 2), /Triple hit/);
assert.equal(getScheduledSpecialAttack(enemy, 3), enemy.specialAttack);
assert.equal(getScheduledSpecialAttack(enemy, 2), null);
assert.equal(getEnemyIntent({ ...enemy, hp: 0 }, 2), null);
assert.equal(getEnemyIntent({ ...enemy, combatRole: "support" }, 2), "下回合：攻擊。");
console.log("Battle actions: batched turn logs, bounded history, phase locks and intent scheduling passed.");
