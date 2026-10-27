import assert from "node:assert/strict";
import { remakeHarness } from "./highland-remake-harness.mjs";
import { withSeed } from "./model-test-helpers.mjs";
import { buildScaledEnemy } from "../src/core/combat.js";
import { getEnemyIntent } from "../src/core/enemyIntent.js";
import { captureRunSnapshot, restoreRunSnapshot } from "../src/core/runSnapshot.js";
import { getEnemyDefinition } from "../src/data/enemies/index.js";
import { regionDefinitions } from "../src/data/regions/index.js";
import { getRouteDefinition, getRouteGroup } from "../src/data/routes/index.js";

// Production turn controller and unmodified route/enemy definitions. The
// high HP fixture only keeps the player alive during repeated guard turns.
function encounter() {
  const h = remakeHarness({ region: "beach", level: 25, index: 0, quiet: true });
  const route = getRouteDefinition("coast-cave");
  h.battle.beginBattleRuntime({
    enemies: getRouteGroup(route, "cave-support-lesson").members.map(member => ({
      enemy: buildScaledEnemy(getEnemyDefinition(member.enemyId), regionDefinitions.beach, 2),
      statScale: member.statScale, rewardScale: member.rewardScale
    })), encounterType: "normal"
  });
  h.state.hero.maxHp = h.state.hero.hp = 100000;
  h.state.hero.supportCounterMaxUses = 2;
  h.state.hero.supportCounterDamage = 8;
  return h;
}
const guard = h => withSeed(42, () => h.controller.playTurn("guard"));

const h = encounter();
let [front, priest] = h.state.enemies;
guard(h); // First turn: priest attacks.
assert.match(getEnemyIntent(priest, h.state.turn, h.state.enemies), /前衛.*防禦 \+3.*恢復最大生命 35%.*剩 2 次/);
front.hp = front.maxHp - 100;
const beforeHp = front.hp, beforeDefense = front.defense;
guard(h); // Second turn: priest heals and buffs once.
assert.equal(priest.supportUses, 1);
assert.equal(front.hp, beforeHp + Math.round(front.maxHp * .35));
assert.equal(front.defense, beforeDefense + 3);
assert.equal(h.state.hero.blessingBattleState.supportCounterCharges, 1, "Heal and defense are one support action, not two triggers");

// Save/load and tactical retreat preserve both the scheduled turn and uses.
const snapshot = captureRunSnapshot(h.state);
assert.ok(snapshot);
h.state.enemies[1].supportUses = 0;
restoreRunSnapshot(h.state, snapshot);
[front, priest] = h.state.enemies;
assert.equal(priest.supportUses, 1);
h.battle.savePendingThreat("safeEscape");
assert.equal(h.battle.resumePendingThreat(), true);
[front, priest] = h.state.enemies;
assert.equal(priest.supportUses, 1);
assert.equal(h.state.turn, 2);
front.hp = 1;
guard(h);
assert.match(getEnemyIntent(priest, h.state.turn, h.state.enemies), /剩 1 次/);
guard(h);
assert.equal(priest.supportUses, 2);
assert.equal(front.hp, 1 + Math.round(front.maxHp * .35));
assert.equal(h.state.hero.blessingBattleState.supportCounterCharges, 2);
front.hp = 1;
for (let index = 0; index < 8; index++) guard(h);
assert.equal(priest.supportUses, 2);
assert.equal(front.hp, 1, "Exhausted support cannot repeatedly heal while the player guards");

const full = encounter();
for (let index = 0; index < 4; index++) guard(full);
assert.equal(full.state.enemies[1].supportUses, 2, "A full-health frontline still consumes the finite support uses");

const noFront = encounter();
guard(noFront);
guard(noFront);
noFront.state.enemies[0].hp = 0;
noFront.state.turn = 3;
noFront.state.hero.shield = 0;
const lonePriestId = noFront.state.enemies[1].runtimeId;
assert.equal(getEnemyIntent(noFront.state.enemies[1], 3, noFront.state.enemies), "下回合：攻擊。");
const heroHp = noFront.state.hero.hp;
guard(noFront);
assert.equal(noFront.state.enemies.find(enemy => enemy.runtimeId === lonePriestId).supportUses, 1);
assert.ok(noFront.state.hero.hp < heroHp, "Without a living frontline the priest attacks instead");
console.log("Production priest support: forecast, finite healing, counter trigger, reload and escape preservation passed");
