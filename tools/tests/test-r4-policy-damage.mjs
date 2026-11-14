// R5-01: the R4 policy's direct-damage estimates must equal the formal damage rules,
// with and without guard, including rounding and remaining-HP caps.
import assert from "node:assert/strict";
import { getHeroEffectiveAttack, resolveHeroStrike } from "../../src/core/heroCombat.js";
import { HAMMER_TRAINING_WEAPON } from "../../src/core/hammerTraining.js";
import { runWeaponAttack } from "../../src/core/weaponTechniques.js";
import { remakeHarness } from "../highland-remake-harness.mjs";
import { estimateBreachBonusPerHit, estimatePacket, estimatePrimaryHit, estimateWave } from "../r4-policy-damage.mjs";

const PRIMARY = 10;
const WAVE_RATIO = Number(runWeaponAttack.toString().match(/packet\(enemy, power \* ([.\d]+), "震岩裂陣"\)/)?.[1]);
assert.ok(Number.isFinite(WAVE_RATIO), "wave ratio is readable from runWeaponAttack");
const silentLog = { fixed() {}, template() {} };

function rig({ targetHp = 10000, targetDefense = 3, guarded = false, others = [] } = {}) {
  const { state } = remakeHarness({ weapon: HAMMER_TRAINING_WEAPON, region: "highlands", index: 2, quiet: true });
  const target = { runtimeId: "target", name: "目標", hp: targetHp, maxHp: targetHp, defense: targetDefense, dodgeChance: 0,
    ...(guarded ? { combatRole: "output", formationId: "r5" } : {}) };
  const front = { runtimeId: "front", name: "前衛", hp: 10000, maxHp: 10000, defense: 0, dodgeChance: 0, combatRole: "frontline", formationId: "r5" };
  state.highlandBattle = null;
  state.enemies = [target, ...(guarded ? [front] : []), ...others];
  state.targetEnemyId = target.runtimeId;
  state.hero.activeEnemyCount = state.enemies.length;
  state.hero.highlandOpportunities = {};
  state.hero.equipment.hammerTechniqueUnlocked = true;
  state.hero.weaponRuntime.impact = 3;
  // The Lv.30 adventurer has heavy-strike and other random skills; strip them so a plain
  // strike is deterministic and comparable to the estimate.
  state.hero.skills = [];
  state.hero.critChance = 0;
  state.hero.battleCritBonus = 0;
  state.hero.openingCritChance = 0;
  state.hero.hasAttackedThisBattle = true;
  return { state, target, front };
}

function playTechnique(state, target, action, primaryDamage = PRIMARY) {
  runWeaponAttack({
    state, action, target, log: silentLog,
    runAttack() {
      target.hp = Math.max(0, target.hp - primaryDamage);
      state.hero.battleHooks?.onDirectAttackResolved?.({ source: "original", enemy: target, dodged: false, damage: primaryDamage });
    }
  });
}

// Breach extra packet, unguarded and guarded.
const extras = {};
for (const guarded of [false, true]) {
  const { state, target } = rig({ guarded });
  const power = getHeroEffectiveAttack(state.hero);
  const estimate = estimatePacket({ amount: power * 3 * 0.2, enemy: target, enemies: state.enemies });
  const before = target.hp;
  playTechnique(state, target, "breach");
  const actual = before - target.hp - PRIMARY;
  assert.equal(estimate, actual, `breach extra estimate matches formal damage (guarded=${guarded})`);
  extras[guarded] = actual;
}
assert.ok(extras[true] < extras[false], "guard reduces the breach extra packet");
assert.equal(extras[true], Math.max(1, Math.round(extras[false] * 0.7)), "guarded extra is the rounded 70% of the unguarded packet");

// Breach extra cannot exceed the HP left after the main strike.
{
  const { state, target } = rig({ targetHp: PRIMARY + 2, targetDefense: 0 });
  const power = getHeroEffectiveAttack(state.hero);
  const estimate = Math.min(target.hp - PRIMARY, estimatePacket({ amount: power * 3 * 0.2, enemy: target, enemies: state.enemies }));
  playTechnique(state, target, "breach");
  assert.equal(target.hp, 0);
  assert.equal(estimate, 2, "capped estimate equals the remaining HP");
}

// Follow-up bonus from weaponBreach goes through guard with the main strike.
for (const guarded of [false, true]) {
  const { state, target } = rig({ guarded, targetDefense: 20 });
  const power = getHeroEffectiveAttack(state.hero);
  const strike = () => {
    const before = target.hp;
    resolveHeroStrike({ hero: state.hero, enemy: target, enemies: state.enemies, log: silentLog });
    return before - target.hp;
  };
  const plain = strike();
  assert.equal(estimatePrimaryHit({ power, enemy: target, enemies: state.enemies }), plain, `primary estimate matches a non-critical strike (guarded=${guarded})`);
  target.weaponBreach = { charges: 2, until: 99, strength: 3 };
  const boosted = strike();
  assert.equal(estimateBreachBonusPerHit({ power, enemy: target, enemies: state.enemies, strength: 3 }), boosted - plain,
    `breach follow-up bonus matches formal strike difference (guarded=${guarded})`);
}

// Wave packets: guard, and loss of guard once the frontline target dies to the main strike.
for (const killFrontline of [false, true]) {
  const rear = { runtimeId: "rear", name: "後衛", hp: 10000, maxHp: 10000, defense: 4, dodgeChance: 0, combatRole: "output", formationId: "r5" };
  const loose = { runtimeId: "loose", name: "散兵", hp: 10000, maxHp: 10000, defense: 2, dodgeChance: 0 };
  const { state, target } = rig({ others: [rear, loose] });
  Object.assign(target, { combatRole: "frontline", formationId: "r5", hp: killFrontline ? PRIMARY : 10000 });
  const power = getHeroEffectiveAttack(state.hero);
  const estimates = estimateWave({ power, ratio: WAVE_RATIO, target, hit: PRIMARY, enemies: state.enemies.filter(e => e.hp > 0) });
  playTechnique(state, target, "breach-wave");
  for (const { enemy, damage } of estimates) {
    assert.equal(damage, 10000 - enemy.hp, `wave estimate for ${enemy.runtimeId} matches formal damage (frontline killed=${killFrontline})`);
  }
  const rearHit = estimates.find(x => x.enemy.runtimeId === "rear").damage;
  const raw = Math.max(1, Math.round(power * WAVE_RATIO - 4));
  assert.equal(rearHit, killFrontline ? raw : Math.max(1, Math.round(raw * 0.7)));
}

console.log("R4 policy damage estimates match formal damage.");
