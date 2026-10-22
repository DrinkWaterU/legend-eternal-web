// Fixed-level isolated model using the production turn controller and skills.
// EXP growth, events and retreat are excluded; results are not player telemetry.
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync } from "node:fs";
import { createBattleTurnController } from "../src/features/battle/battleTurnController.js";
import { createBattleSkills } from "../src/features/battle/battleSkills.js";
import { highlandsRegion as region } from "../src/data/regions/highlands.js";
import { getRouteDefinition, getRouteGroup } from "../src/data/routes/index.js";
import { getEnemyDefinition } from "../src/data/enemies/index.js";
import { characterDefinitions } from "../src/data/characters/index.js";
import { weaponDefinitions } from "../src/data/weapons.js";
import { getBlessingRarity } from "../src/data/rarities.js";
import { buildHeroFromProgression, createSkillState } from "../src/core/progression.js";
import { buildScaledEnemy, resolveHeroAction, getHeroBattleHealingAmount } from "../src/core/combat.js";
import { createRuntimeEnemyGroup, getLivingEnemies } from "../src/core/enemyGroups.js";
import { applyBlessingEffects } from "../src/core/blessings.js";
import { initializeCharacterBattleState, resolveCharacterPlayerAction, modifyCharacterIncomingDirectDamage } from "../src/characters/skills/index.js";
import { applyEquippedWeaponBattleStart } from "../src/core/weaponBattleEffects.js";
import { resetBlessingBattleState, registerFrontlineDefeat } from "../src/core/caveBlessingEffects.js";
import { applyEnemyDefeatReactions } from "../src/core/enemyReactions.js";
import { getEnemyIntent } from "../src/core/enemyIntent.js";
import { withSeed, seedFromText, weightedPick } from "./model-test-helpers.mjs";

const rounds = Number(process.argv[2]) || 120;
const route = getRouteDefinition("windbreak-ascent");
const noop = () => {};
const log = { template: noop, fixed: noop };
const results = [];
const equipment = {
  adventurer: ["guard-short-sword", "adventurer-pathfinder-sword", "reefbreaker-warhammer", "brinefang-dagger", "windbreak-sword", "cairn-warhammer", "gale-dagger"],
  archer: ["verdant-pursuit-bow", "tidepiercer-shortbow", "ridgewind-bow"],
  kaige: ["worn-battle-axe", "stormsplit-axe"]
};
function heal(hero, value) {
  if (hero.hp > 0) hero.hp = Math.min(hero.maxHp, hero.hp + getHeroBattleHealingAmount(hero, value, { minimum: 1 }));
}
function chooseTarget(enemies, tactical) {
  const living = getLivingEnemies(enemies);
  if (!tactical) return living[0];
  return living.find(e => e.combatRole === "support") || living.find(e => e.combatRole === "output") || living[0];
}
function chooseBlessing(hero, tactical) {
  const pool = [...region.blessings];
  const choices = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    const picked = weightedPick(pool, b => getBlessingRarity(b.rarity).weight);
    choices.push(picked); pool.splice(pool.indexOf(picked), 1);
  }
  if (!tactical) return choices[Math.floor(Math.random() * choices.length)];
  const score = b => b.effects.reduce((sum, e) => sum + (
    e.type === "recoverHp" ? Math.min(hero.maxHp - hero.hp, e.amount) * .3
    : e.stat === "attack" ? e.amount * 3
    : e.stat === "defense" ? e.amount * (hero.defense < 28 ? 4 : 2)
    : e.stat === "killHeal" ? e.amount * (hero.killHeal < 12 ? 3 : 1)
    : e.stat === "shieldStart" ? e.amount * .8
    : e.stat === "multiEnemyShieldStart" ? e.amount * .45
    : e.stat === "critChance" ? e.amount * 100
    : e.stat === "ignoreProtectedEnemyReduction" ? 8
    : e.stat === "maxHp" ? e.amount * .3 : 4), 0);
  return choices.sort((a, b) => score(b) - score(a))[0];
}
function simulate(characterId, weaponId, level, tactical) {
  const hero = buildHeroFromProgression(characterDefinitions[characterId], {
    level, exp: 0, unlocked: true, learnedSkills: [], equipment: { weaponId }
  }, { inventory: { weapons: { [weaponId]: true } }, weaponDefinitions });
  let turns = 0, guards = 0;
  for (let index = 0; index < route.encounterPlan.length; index++) {
    const entry = route.encounterPlan[index];
    Object.assign(hero, { poison: 0, entangle: null, saltErosion: null, paralysis: null,
      battleAttackBonus: 0, battleCritBonus: 0, hasAttackedThisBattle: false,
      weaponBattleStartApplied: false, weaponBattleMode: null, shield: hero.shieldStart,
      skillState: createSkillState(), statusFamiliarityLimitBonus: 0, victoryHealBonusRatio: 0 });
    resetBlessingBattleState(hero); initializeCharacterBattleState(hero);
    const enemies = createRuntimeEnemyGroup(getRouteGroup(route, entry.groupId).members.map(m => ({
      enemy: buildScaledEnemy(getEnemyDefinition(m.enemyId), region, index),
      statScale: m.statScale, rewardScale: m.rewardScale
    })));
    hero.activeEnemyCount = enemies.length;
    const skills = createBattleSkills({ state: { hero }, hasHeroSkill: id => hero.skills.includes(id), addLog: noop, addFixedLog: noop, lastBagFlowWeightMultiplier: .6 });
    skills.applyBattleStartSkills();
    applyEquippedWeaponBattleStart(hero, { enemyCount: enemies.length, encounterType: entry.type });
    if (enemies.length > 1) hero.shield += Number(hero.multiEnemyShieldStart) || 0;
    const state = { hero, enemies, phase: "danger", turn: 0, ended: false };
    const settled = new Set();
    let won = false;
    const controller = createBattleTurnController({
      state, createCombatLogger: () => log, currentTargetEnemy: () => chooseTarget(enemies, tactical),
      runHeroPlayerAction: ({ target }) => {
        const result = resolveCharacterPlayerAction({ hero, enemies, targetEnemyId: target.runtimeId, log });
        if (!result.handled) resolveHeroAction({ hero, enemy: target, enemies, log });
      },
      modifyIncomingDirectDamage: modifyCharacterIncomingDirectDamage,
      consumeEntangleRetry: () => false, recordEntangleRetryResult: noop,
      modifyPoisonDamage: damage => damage,
      settleDefeatedEnemies: () => {
        for (const enemy of enemies.filter(e => e.hp <= 0 && !settled.has(e.runtimeId))) {
          settled.add(enemy.runtimeId);
          registerFrontlineDefeat(hero, enemy);
          applyEnemyDefeatReactions({ hero, enemies, defeatedEnemy: enemy, log });
          hero.battleAttackBonus += Number(hero.killAttackGain) || 0;
          if (hero.hp / hero.maxHp < .5) heal(hero, Number(hero.lowHpKillHeal) || 0);
          heal(hero, (Number(hero.killHeal) || 0) + Math.round(hero.maxHp * (Number(hero.killHealRatio) || 0)));
        }
      },
      applyEmergencyBandage: skills.applyEmergencyBandage, tryLastStand: skills.tryLastStand,
      winEncounter: () => { won = true; state.ended = true; }, loseRun: () => { state.ended = true; }, render: noop
    });
    while (!state.ended && state.turn < 180) {
      const target = chooseTarget(enemies, tactical);
      const threat = enemies.some(e => e.hp > 0 && getEnemyIntent(e, state.turn));
      // Guard only telegraphed boss strikes when immediate defeat is unlikely.
      const guard = tactical && entry.type === "boss" && threat && target.hp > hero.attack * 2 && hero.hp < hero.maxHp * .65;
      if (guard) guards++;
      controller.playTurn(guard ? "guard" : "attack");
    }
    turns += state.turn;
    if (!won) return { won: false, reached: index + 1, turns, guards };
    skills.applyVictorySkills(); skills.consumeBattleLimitedEffects();
    if (index < route.encounterPlan.length - 1) applyBlessingEffects(hero, chooseBlessing(hero, tactical));
  }
  return { won: true, reached: 20, turns, guards, hp: hero.hp / hero.maxHp };
}
for (const level of [28, 30]) for (const [characterId, weapons] of Object.entries(equipment)) for (const weaponId of weapons) {
  for (const tactical of [true, false]) {
    let wins = 0, reached = 0, turns = 0, guards = 0;
    const defeats = {};
    for (let i = 0; i < rounds; i++) {
      const r = withSeed(seedFromText(`highlands:${characterId}:${level}:${i}`), () => simulate(characterId, weaponId, level, tactical));
      wins += Number(r.won); reached += r.reached; turns += r.turns; guards += r.guards;
      if (!r.won) defeats[r.reached] = (defeats[r.reached] || 0) + 1;
    }
    const result = { characterId, weaponId, level, tactical, rounds, winRatio: wins / rounds, averageReached: reached / rounds, averageTurns: turns / rounds, averageGuards: guards / rounds, defeats };
    results.push(result); console.log(JSON.stringify(result));
    assert.ok(turns / rounds < 180, "Highlands should not become a repetitive endurance wall");
  }
}
mkdirSync("tools/verification-artifacts/highlands", { recursive: true });
writeFileSync("tools/verification-artifacts/highlands/model-results.json", JSON.stringify({ rounds, limitations: ["Fixed level; no EXP growth, events or preparations", "Isolated production turn controller; not player win rates"], results }, null, 2));
if (rounds >= 100) for (const characterId of Object.keys(equipment)) {
  const baseline = results.filter(r => r.characterId === characterId && r.level === 30 && r.tactical);
  assert.ok(baseline.some(r => r.winRatio >= .55), `${characterId} needs a viable level 30 build`);
}
