import assert from "node:assert/strict";
import { remakeHarness } from "./highland-remake-harness.mjs";
import { applyBlessingEffects } from "../src/core/blessings.js";
import { buildScaledEnemy, resolveHeroStrike } from "../src/core/combat.js";
import caveBlessingData from "../src/data/blessings/cave.json" with { type: "json" };
import { getEnemyDefinition } from "../src/data/enemies/index.js";
import { regionDefinitions } from "../src/data/regions/index.js";
import { getRouteDefinition, getRouteGroup } from "../src/data/routes/index.js";

function fixedRoll(value, action) {
  const original = Math.random;
  Math.random = () => value;
  try { return action(); } finally { Math.random = original; }
}

function encounter() {
  const h = remakeHarness({ region: "beach", level: 25, weapon: "iron-longsword", index: 0 });
  const route = getRouteDefinition("coast-cave"), entry = route.encounterPlan[0];
  h.battle.beginBattleRuntime({
    enemies: getRouteGroup(route, entry.groupId).members.map(member => ({
      enemy: buildScaledEnemy(getEnemyDefinition(member.enemyId), regionDefinitions.beach, 0),
      statScale: member.statScale, rewardScale: member.rewardScale
    })), encounterType: entry.type
  });
  applyBlessingEffects(h.state.hero, caveBlessingData.blessings.find(b => b.id === "cave-tide-mark"));
  return h;
}

// This native follow-up cannot crit: it must leave the mark for a capable hit.
const h = encounter(), s = h.state, firstTarget = s.enemies[0].runtimeId, hits = [];
s.hero.battleHooks = { onDirectAttackResolved: result => hits.push(result) };
fixedRoll(.2, () => h.controller.playTurn("attack"));
assert.ok(hits.some(hit => hit.source === "followUp" && !hit.critical));
assert.equal(s.hero.blessingBattleState.tideMarkTargetId, firstTarget);
assert.equal(s.hero.blessingBattleState.tideMarkCreated, true);
hits.length = 0;
const markedRoll = s.hero.critChance + (s.hero.battleCritBonus || 0) + .15;
fixedRoll(markedRoll, () => h.controller.playTurn("attack"));
assert.ok(hits.some(hit => hit.source === "original" && hit.critical));
assert.equal(s.hero.blessingBattleState.tideMarkTargetId, null);

// A legal crit-capable character follow-up still receives and spends the mark.
const capable = encounter();
fixedRoll(.99, () => capable.controller.playTurn("attack"));
const result = fixedRoll(.3, () => resolveHeroStrike({
  hero: capable.state.hero, enemy: capable.state.enemies[0], enemies: capable.state.enemies,
  log: { template() {}, fixed() {} }, options: { source: "characterFollowUp", allowHeavyStrike: false }
}));
assert.equal(result.critical, true);
assert.equal(capable.state.hero.blessingBattleState.tideMarkTargetId, null);

// Killing an unrelated target cannot erase the still-living marked opponent.
const switched = encounter(), originalId = switched.state.enemies[0].runtimeId;
fixedRoll(.99, () => switched.controller.playTurn("attack"));
const other = switched.state.enemies[1]; switched.state.targetEnemyId = other.runtimeId;
for (let attempts = 0; other.hp > 0 && attempts < 30; attempts++) {
  fixedRoll(.99, () => resolveHeroStrike({
    hero: switched.state.hero, enemy: other, enemies: switched.state.enemies,
    log: { template() {}, fixed() {} }
  }));
}
assert.ok(other.hp <= 0);
assert.ok(switched.state.enemies.some(enemy => enemy.runtimeId === originalId && enemy.hp > 0));
assert.equal(switched.state.hero.blessingBattleState.tideMarkTargetId, originalId);

console.log("Tide mark survives noncritical native follow-ups and unrelated kills, and is consumed by crit-capable sources");
