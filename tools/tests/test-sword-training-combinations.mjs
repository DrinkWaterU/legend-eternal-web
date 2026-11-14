import assert from "node:assert/strict";
import { applyBlessingEffects } from "../../src/core/blessings.js";
import { regionDefinitions } from "../../src/data/regions/index.js";
import { remakeHarness } from "../highland-remake-harness.mjs";
import { withSeed } from "../model-test-helpers.mjs";
import { buildScaledEnemy } from "../../src/core/combat.js";
import { getHeroBattleHealingAmount } from "../../src/core/combatStatusEffects.js";

const plains = regionDefinitions.plains.blessings;
const chosen = ["critChance", "shieldStart", "killHeal"].map(stat => {
  const blessing = plains.find(b => b.effects.some(e => e.type === "add" && e.stat === stat));
  assert.ok(blessing, `missing actual ${stat} blessing`);
  return blessing;
});
function setup(region, group) {
  const h = remakeHarness({ character: "adventurer", weapon: "windbreak-sword", region });
  h.state.hero.equipment.trainingMode = "swift";
  chosen.forEach((blessing, i) => applyBlessingEffects(h.state.hero, blessing, { instanceId: `test-${i}` }));
  assert.ok(h.state.hero.skills.includes("skilled-follow-up"));
  h.state.hero.shield += 8;
  h.state.hero.hp = Math.floor(h.state.hero.maxHp * .6);
  if (!group) h.state.enemies.splice(1);
  const regionData = regionDefinitions[region];
  const sources = group ? regionData.enemies : [regionData.boss];
  assert.ok(sources.length, `${region} enemy definitions`);
  h.state.enemies.forEach((e, i) => {
    const runtimeId = e.runtimeId;
    Object.assign(e, buildScaledEnemy(sources[i % sources.length], regionData, 2), { runtimeId });
  });
  h.state.enemies.forEach(e => { e.hp = e.maxHp = 10000; e.attack = 20; e.defense = 0; e.dodgeChance = 0; e.specialAttack = null; e.chargeEvery = null; e.formationId = null; });
  if (h.state.highlandBattle) {
    h.state.highlandBattle.pattern = [0];
    h.state.hero.battleColumn = 1;
    h.state.enemies.forEach(e => { e.battleColumn = 1; });
    h.state.highlandBattle.intents = h.state.enemies.map(e => ({ id: e.runtimeId, kind: "strike", columns: [1], attackRatio: 1 }));
    h.state.highlandBattle.intentTurn = h.state.turn;
  }
  withSeed(5, () => h.controller.playTurn("guard"));
  assert.equal(h.state.hero.weaponRuntime.riposte, true, `${region} guard primes`);
  return h;
}

for (const region of ["forest", "beach", "highlands"]) for (const group of [false, true]) {
  let verified = false;
  for (let seed = 1; seed < 1000 && !verified; seed++) {
    const active = setup(region, group), control = setup(region, group);
    control.state.hero.weaponRuntime.riposte = false;
    active.messages.length = control.messages.length = 0;
    withSeed(seed, () => active.controller.playTurn("attack"));
    withSeed(seed, () => control.controller.playTurn("attack"));
    const count = (h, key) => h.messages.filter(x => x.key === key).length;
    if (!count(active, "critical") || !count(active, "skilledFollowUp")) continue;
    assert.equal(count(active, "critical"), count(control, "critical"));
    assert.equal(count(active, "skilledFollowUp"), 1);
    assert.equal(count(active, "skilledFollowUp"), count(control, "skilledFollowUp"));
    assert.equal(active.state.hero.hp, control.state.hero.hp, "counter cannot independently heal");
    assert.equal(active.state.hero.shield, control.state.hero.shield, "counter cannot independently add shield");
    assert.equal(active.state.hero.weaponRuntime.riposte, false, "counter consumed");
    assert.equal(active.messages.filter(x => x.text?.includes("冒險反攻命中")).length, 1);
    assert.ok(active.state.enemies[0].hp < control.state.enemies[0].hp);
    // No fresh guard means a later attack cannot generate a second counter.
    active.messages.length = 0;
    withSeed(seed, () => active.controller.playTurn("attack"));
    assert.equal(active.messages.filter(x => x.text?.includes("冒險反攻命中")).length, 0);
    verified = true;
  }
  assert.ok(verified, `${region} ${group ? "group" : "single"} critical/follow-up chain`);
}
for (const region of ["forest", "beach", "highlands"]) {
  const control = setup(region, false);
  control.state.hero.weaponRuntime.riposte = false;
  withSeed(17, () => control.controller.playTurn("attack"));
  const directDamage = 10000 - control.state.enemies[0].hp;
  assert.ok(directDamage > 0);
  const h = setup(region, false);
  h.state.enemies[0].hp = directDamage + 1;
  const hpBefore = h.state.hero.hp;
  const heal = getHeroBattleHealingAmount(h.state.hero, 10);
  h.messages.length = 0;
  withSeed(17, () => h.controller.playTurn("attack"));
  assert.equal(h.state.outcome, "victory");
  assert.equal(h.messages.filter(x => x.key === "enemyDefeated").length, 1);
  assert.equal(h.messages.filter(x => x.key === "heal").length, 1);
  assert.equal(h.state.hero.hp - hpBefore, heal, "one counter kill pays exactly one ordinary kill heal");
}
console.log(`6 actual combat chains passed with ${chosen.map(b => b.name).join("、")} and skilled follow-up`);
