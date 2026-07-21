import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { clearHeroBattleRuntimeState } from "../src/core/heroBattleState.js";
import { sumSafeIntegers } from "../src/utils.js";

assert.equal(sumSafeIntegers(), 0);
assert.equal(sumSafeIntegers(2, 3, 4), 9);
assert.equal(sumSafeIntegers(5, -1, 1.5, "2", Number.NaN, Number.POSITIVE_INFINITY), 5);
assert.equal(sumSafeIntegers(Number.MAX_SAFE_INTEGER - 2, 10), Number.MAX_SAFE_INTEGER);
assert.equal(Object.is(sumSafeIntegers(-0), -0), false, "安全整數加總不得產生負零");

const hero = {
  poison: 3,
  entangle: { turns: 2 },
  saltErosion: { stacks: 4 },
  paralysis: { turns: 1 },
  battleAttackBonus: 8,
  battleCritBonus: 0.25,
  hasAttackedThisBattle: true,
  activeEnemyCount: 3,
  activePreparation: { id: "test-preparation" },
  shield: 12,
  maxHp: 120,
  attack: 18,
  blessings: ["測試祝福"]
};
const returnedHero = clearHeroBattleRuntimeState(hero);
assert.equal(returnedHero, hero, "清除函式應原地更新並回傳同一角色物件");
assert.deepEqual({
  poison: hero.poison,
  entangle: hero.entangle,
  saltErosion: hero.saltErosion,
  paralysis: hero.paralysis,
  battleAttackBonus: hero.battleAttackBonus,
  battleCritBonus: hero.battleCritBonus,
  hasAttackedThisBattle: hero.hasAttackedThisBattle,
  activeEnemyCount: hero.activeEnemyCount,
  activePreparation: hero.activePreparation,
  shield: hero.shield
}, {
  poison: 0,
  entangle: null,
  saltErosion: null,
  paralysis: null,
  battleAttackBonus: 0,
  battleCritBonus: 0,
  hasAttackedThisBattle: false,
  activeEnemyCount: 0,
  activePreparation: null,
  shield: 0
});
assert.equal(hero.maxHp, 120);
assert.equal(hero.attack, 18);
assert.deepEqual(hero.blessings, ["測試祝福"]);
assert.doesNotThrow(() => clearHeroBattleRuntimeState({ shield: 7 }));
assert.equal(clearHeroBattleRuntimeState(null), null);

const campSource = readFileSync(new URL("../src/features/adventure/campTransitionController.js", import.meta.url), "utf8");
const coastDebugSource = readFileSync(new URL("../src/debug/coastScenarioActions.js", import.meta.url), "utf8");
const rewardsSource = readFileSync(new URL("../src/core/rewards.js", import.meta.url), "utf8");
const questRulesSource = readFileSync(new URL("../src/core/questRules.js", import.meta.url), "utf8");
const questRuntimeSource = readFileSync(new URL("../src/features/quest/questRuntime.js", import.meta.url), "utf8");

assert.match(campSource, /clearHeroBattleRuntimeState\(rebuiltHero\)/);
assert.match(coastDebugSource, /clearHeroBattleRuntimeState\(rebuiltHero\)/);
assert.doesNotMatch(campSource, /function clearRebuiltHeroBattleState/);
assert.doesNotMatch(coastDebugSource, /function clearRebuiltHeroBattleState/);
assert.doesNotMatch(rewardsSource, /function addSafeIntegers/);
assert.doesNotMatch(questRulesSource, /function addSafeQuestIntegers/);
assert.doesNotMatch(questRuntimeSource, /function addSafeQuestIntegers/);

console.log("Maintenance helper tests passed.");
