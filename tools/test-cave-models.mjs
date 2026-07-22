import assert from "node:assert/strict";

import { applyBlessingEffects } from "../src/core/blessings.js";
import {
  advanceHeroCombatStatuses,
  advanceParalysis,
  applyEnemyEndOfTurnNegativeEffects,
  applyEnemyEndOfTurnRecoveryEffects,
  applyHeroEndOfTurnNegativeEffects,
  applyHeroEndOfTurnRecoveryEffects,
  resolveEnemyAction,
  resolveEnemySupportAction,
  resolveHeroAction,
  resolveHeroEntangle,
  getHeroBattleHealingAmount
} from "../src/core/combat.js";
import { createRuntimeEnemyGroup, getLivingEnemies } from "../src/core/enemyGroups.js";
import { applyEnemyDefeatReactions } from "../src/core/enemyReactions.js";
import { registerFrontlineDefeat, resetBlessingBattleState } from "../src/core/caveBlessingEffects.js";
import { buildHeroFromProgression, createSkillState } from "../src/core/progression.js";
import { characterDefinitions } from "../src/data/characters/index.js";
import { getEnemyDefinition } from "../src/data/enemies/index.js";
import { getBlessingRarity } from "../src/data/rarities.js";
import { getRouteDefinition, getRouteGroup } from "../src/data/routes/index.js";
import { weaponDefinitions } from "../src/data/weapons.js";
import beachBlessingData from "../src/data/blessings/beach.json" with { type: "json" };
import caveBlessingData from "../src/data/blessings/cave.json" with { type: "json" };
import {
  initializeCharacterBattleState,
  modifyCharacterIncomingDirectDamage,
  resolveCharacterPlayerAction
} from "../src/characters/skills/index.js";
import { createBattleSkills } from "../src/features/battle/battleSkills.js";

const ROUNDS = Math.max(1, Number(process.argv[2]) || 1000);
const MODE_LABEL = process.argv[3] || "v0.2.7.2-formal";
const LEVEL = 25;
const MAX_TURNS = 500;
const route = getRouteDefinition("coast-cave");
const logger = { template() {}, fixed() {} };

const retainedBeachBlessingIds = [
  "beach-tide-whetstone",
  "beach-fishman-tideeye",
  "beach-fishman-hunt",
  "beach-reef-shell",
  "beach-crosscurrent-guard",
  "beach-saltbound-shell",
  "beach-tide-counter",
  "beach-tide-scavenger"
];

const cases = [
  { id: "adventurer-shared", characterId: "adventurer", weaponId: "vanguard-hunting-bow", weaponSet: "共同武器" },
  { id: "archer-shared", characterId: "archer", weaponId: "vanguard-hunting-bow", weaponSet: "共同武器" },
  { id: "adventurer-native", characterId: "adventurer", weaponId: "guard-short-sword", weaponSet: "職業合理武器" },
  { id: "archer-native", characterId: "archer", weaponId: "verdant-pursuit-bow", weaponSet: "職業合理武器" }
];

assert.equal(route.encounterPlan.length, 16);
assert.equal(caveBlessingData.blessings.length, 15);
retainedBeachBlessingIds.forEach((id) => assert.ok(beachBlessingData.blessings.some((b) => b.id === id), `缺少海灘祝福 ${id}`));

const results = [];
for (const scenario of cases) {
  const result = simulateCase(scenario);
  results.push({ ...scenario, mode: MODE_LABEL, ...result });
  console.log(formatResult({ ...scenario, mode: MODE_LABEL, ...result }));
}

console.log(`MODEL_JSON ${JSON.stringify({ mode: MODE_LABEL, rounds: ROUNDS, retainedBeachBlessingIds, results })}`);

results.forEach((result) => {
  assert.ok(result.winRatio >= 0.82, `${result.id} 洞穴勝場比例不應低於 82%`);
  assert.ok(result.winRatio <= 1, `${result.id} 洞穴勝場比例必須有效`);
  assert.ok(result.bossEntryRatio >= 0.85, `${result.id} 應有至少 85% 抵達洞穴 Boss`);
  assert.ok(result.averageTurns > 60 && result.averageTurns < 180, `${result.id} 平均回合數應落在合理範圍`);
});

function simulateCase({ id, characterId, weaponId }) {
  let wins = 0;
  let reachedTotal = 0;
  let clearHpRatioTotal = 0;
  let bossEntryHpRatioTotal = 0;
  let bossEntries = 0;
  let totalTurns = 0;
  const defeatsByEncounter = new Map();
  const selectedBlessingCounts = new Map();
  const selectedRarityCounts = new Map();
  const hpAfterEncounterTotals = Array(route.encounterPlan.length).fill(0);
  const hpAfterEncounterSamples = Array(route.encounterPlan.length).fill(0);

  for (let run = 0; run < ROUNDS; run += 1) {
    const combatSeed = seedFrom(`${id}:combat:${run}`);
    const blessingRng = createSeededRandom(seedFrom(`${id}:blessing:${run}`));
    const originalRandom = Math.random;
    Math.random = createSeededRandom(combatSeed);
    try {
      const hero = createCaveEntryHero({ characterId, weaponId });
      let reached = 0;
      let cleared = true;

      for (let encounterIndex = 0; encounterIndex < route.encounterPlan.length; encounterIndex += 1) {
        reached = encounterIndex + 1;
        if (encounterIndex === route.encounterPlan.length - 1) {
          bossEntries += 1;
          bossEntryHpRatioTotal += hero.maxHp > 0 ? hero.hp / hero.maxHp : 0;
        }

        const enemies = buildRouteEnemyGroup(encounterIndex);
        const battleSkills = beginBattle(hero, enemies);
        const encounter = simulateEncounter({ hero, enemies, battleSkills });
        totalTurns += encounter.turns;

        if (!encounter.won) {
          cleared = false;
          defeatsByEncounter.set(reached, (defeatsByEncounter.get(reached) || 0) + 1);
          break;
        }

        battleSkills.applyVictorySkills();
        battleSkills.consumeBattleLimitedEffects();
        hpAfterEncounterTotals[encounterIndex] += hero.maxHp > 0 ? hero.hp / hero.maxHp : 0;
        hpAfterEncounterSamples[encounterIndex] += 1;

        if (encounterIndex < route.encounterPlan.length - 1) {
          const choices = getBlessingChoices(caveBlessingData.blessings, 3, blessingRng);
          const selected = chooseBlessing({ characterId, choices, hero, encounterIndex });
          applyBlessingEffects(hero, selected);
          selectedBlessingCounts.set(selected.id, (selectedBlessingCounts.get(selected.id) || 0) + 1);
          selectedRarityCounts.set(selected.rarity, (selectedRarityCounts.get(selected.rarity) || 0) + 1);
        }
      }

      reachedTotal += reached;
      if (cleared) {
        wins += 1;
        clearHpRatioTotal += hero.maxHp > 0 ? hero.hp / hero.maxHp : 0;
      }
    } finally {
      Math.random = originalRandom;
    }
  }

  return {
    winRatio: wins / ROUNDS,
    averageReached: reachedTotal / ROUNDS,
    averageClearHpRatio: wins > 0 ? clearHpRatioTotal / wins : null,
    averageBossEntryHpRatio: bossEntries > 0 ? bossEntryHpRatioTotal / bossEntries : null,
    bossEntryRatio: bossEntries / ROUNDS,
    averageTurns: totalTurns / ROUNDS,
    defeatsByEncounter: Object.fromEntries([...defeatsByEncounter.entries()].sort((a, b) => a[0] - b[0])),
    averageSelectedBlessings: Object.fromEntries(
      [...selectedBlessingCounts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([blessingId, count]) => [blessingId, count / ROUNDS])
    ),
    averageSelectedRarities: Object.fromEntries(
      [...selectedRarityCounts.entries()].map(([rarity, count]) => [rarity, count / ROUNDS])
    ),
    hpCurve: hpAfterEncounterTotals.map((total, index) => hpAfterEncounterSamples[index] > 0 ? total / hpAfterEncounterSamples[index] : null)
  };
}

function createCaveEntryHero({ characterId, weaponId }) {
  const hero = buildHeroFromProgression(characterDefinitions[characterId], {
    level: LEVEL,
    exp: 0,
    learnedSkills: [],
    equipment: { weaponId }
  }, {
    inventory: { weapons: { [weaponId]: true } },
    weaponDefinitions
  });

  retainedBeachBlessingIds.forEach((blessingId, index) => {
    const blessing = beachBlessingData.blessings.find((entry) => entry.id === blessingId);
    applyBlessingEffects(hero, blessing, {
      instanceId: `retained-${index + 1}`,
      skipImmediate: true,
      runtimeState: { timedRegens: [], encounterBiases: [] }
    });
  });
  hero.hp = Math.max(1, Math.round(hero.maxHp * 0.5));
  return hero;
}

function buildRouteEnemyGroup(encounterIndex) {
  const entry = route.encounterPlan[encounterIndex];
  const group = getRouteGroup(route, entry.groupId);
  assert.ok(group, `缺少洞穴編隊 ${entry.groupId}`);
  return createRuntimeEnemyGroup(group.members.map((member) => ({
    enemy: getEnemyDefinition(member.enemyId),
    statScale: member.statScale,
    rewardScale: member.rewardScale
  })));
}

function beginBattle(hero, enemies) {
  hero.poison = 0;
  hero.entangle = null;
  hero.saltErosion = null;
  hero.paralysis = null;
  hero.activeEnemyCount = getLivingEnemies(enemies).length;
  hero.battleAttackBonus = 0;
  hero.battleCritBonus = 0;
  hero.hasAttackedThisBattle = false;
  hero.statusFamiliarityLimitBonus = 0;
  hero.victoryHealBonusRatio = 0;
  hero.activePreparation = null;
  hero.shield = hero.shieldStart;
  hero.skillState = createSkillState();
  resetBlessingBattleState(hero);
  initializeCharacterBattleState(hero);

  const battleSkills = createBattleSkills({
    state: { hero },
    hasHeroSkill: (skillId) => Array.isArray(hero.skills) && hero.skills.includes(skillId),
    addLog() {},
    addFixedLog() {},
    lastBagFlowWeightMultiplier: 0.6
  });
  battleSkills.applyBattleStartSkills();
  if (getLivingEnemies(enemies).length >= 2 && hero.multiEnemyShieldStart > 0) {
    hero.shield += hero.multiEnemyShieldStart;
  }
  return battleSkills;
}

function simulateEncounter({ hero, enemies, battleSkills }) {
  for (let turn = 1; turn <= MAX_TURNS; turn += 1) {
    advanceHeroCombatStatuses(hero);
    hero.activeEnemyCount = getLivingEnemies(enemies).length;
    const heroEntangled = resolveHeroEntangle({ hero, log: logger });

    if (!heroEntangled) {
      const target = chooseTarget(hero, enemies);
      const characterAction = resolveCharacterPlayerAction({
        hero,
        enemies,
        targetEnemyId: target?.runtimeId || null,
        log: logger
      });
      if (!characterAction.handled && target) {
        resolveHeroAction({ hero, enemy: target, enemies, log: logger });
      }
      settleDefeatedEnemies(hero, enemies);
      if (getLivingEnemies(enemies).length === 0) return { won: true, turns: turn };
    }

    const actingEnemies = [...getLivingEnemies(enemies)];
    for (const enemy of actingEnemies) {
      if (enemy.hp <= 0 || hero.hp <= 0) continue;
      const supportActed = resolveEnemySupportAction({
        enemies,
        actor: enemy,
        turn,
        log: logger,
        hero
      });
      if (supportActed) {
        advanceParalysis(enemy);
        continue;
      }
      resolveEnemyAction({
        hero,
        enemy,
        turn,
        log: logger,
        modifyDirectDamage: (context) => modifyCharacterIncomingDirectDamage(context)
      });
      advanceParalysis(enemy);
      battleSkills.applyEmergencyBandage();
      if (hero.hp <= 0 && !battleSkills.tryLastStand()) return { won: false, turns: turn };
    }

    applyHeroEndOfTurnNegativeEffects({ hero, log: logger });
    getLivingEnemies(enemies).forEach((enemy) => applyEnemyEndOfTurnNegativeEffects({ enemy, enemies, log: logger }));
    applyHeroEndOfTurnRecoveryEffects({ hero, turn, log: logger });
    getLivingEnemies(enemies).forEach((enemy) => applyEnemyEndOfTurnRecoveryEffects({ enemy, turn, log: logger }));

    if (hero.hp <= 0 && !battleSkills.tryLastStand()) return { won: false, turns: turn };
    settleDefeatedEnemies(hero, enemies);
    if (getLivingEnemies(enemies).length === 0) return { won: true, turns: turn };
  }
  throw new Error("洞穴模型單場戰鬥超過最大回合數");
}

function chooseTarget(hero, enemies) {
  const living = getLivingEnemies(enemies);
  if (living.length <= 1) return living[0] || null;
  const hasFormationTool = (Number(hero.protectedEnemyDamageBonus) || 0) > 0
    || hero.ignoreProtectedEnemyReduction === true;
  const priorities = hasFormationTool
    ? ["output", "control", "support", "frontline"]
    : ["frontline", "output", "control", "support"];
  for (const role of priorities) {
    const candidate = living.find((enemy) => enemy.combatRole === role);
    if (candidate) return candidate;
  }
  return living[0];
}

function settleDefeatedEnemies(hero, enemies) {
  for (const enemy of enemies) {
    if (enemy.hp > 0 || enemy.modelSettled) continue;
    enemy.modelSettled = true;
    const hpRatioBeforeKillRewards = hero.maxHp > 0 ? hero.hp / hero.maxHp : 0;
    applyEnemyDefeatReactions({ enemies, defeatedEnemy: enemy });
    registerFrontlineDefeat(hero, enemy);
    if (hero.killAttackGain > 0) hero.battleAttackBonus = (hero.battleAttackBonus || 0) + hero.killAttackGain;
    if (hpRatioBeforeKillRewards < 0.5 && hero.lowHpKillHeal > 0) heal(hero, hero.lowHpKillHeal);
    if (hero.killHeal > 0) heal(hero, hero.killHeal);
    if (hero.killHealRatio > 0) heal(hero, Math.max(1, Math.round(hero.maxHp * hero.killHealRatio)));
  }
}

function heal(hero, amount) {
  const effective = getHeroBattleHealingAmount(hero, amount);
  hero.hp = Math.min(hero.maxHp, hero.hp + effective);
}

function getBlessingChoices(pool, count, rng) {
  const available = [...pool];
  const choices = [];
  while (choices.length < count && available.length > 0) {
    const selected = weightedPick(available, (blessing) => getBlessingRarity(blessing.rarity).weight, rng);
    choices.push(selected);
    available.splice(available.indexOf(selected), 1);
  }
  return choices;
}

function chooseBlessing({ characterId, choices, hero, encounterIndex }) {
  return choices
    .map((blessing) => ({ blessing, score: scoreBlessing({ characterId, blessing, hero, encounterIndex }) }))
    .sort((a, b) => b.score - a.score || a.blessing.id.localeCompare(b.blessing.id))[0].blessing;
}

function scoreBlessing({ characterId, blessing, hero, encounterIndex }) {
  const hpRatio = hero.maxHp > 0 ? hero.hp / hero.maxHp : 0;
  const missingHp = Math.max(0, hero.maxHp - hero.hp);
  const flowBase = characterId === "archer"
    ? { attack: 7.5, defense: 6.8, healing: 6.3, crit: 9, debuff: 8.4 }
    : { attack: 8, defense: 8, healing: 7, crit: 7.2, debuff: 6.8 };
  let score = flowBase[blessing.primaryFlow] || 4;

  for (const effect of blessing.effects || []) {
    const amount = Number(effect.amount) || 0;
    if (effect.type === "recoverHp") score += Math.min(amount, missingHp) / 8 + (hpRatio < 0.45 ? 4 : 0);
    if (effect.type === "set" && effect.stat === "ignoreProtectedEnemyReduction" && effect.value === true) {
      score += 5.5;
    }
    if (effect.type !== "add") continue;
    if (effect.stat === "attack") score += amount * 0.9;
    if (effect.stat === "defense") score += amount * 1.1;
    if (effect.stat === "maxHp") score += amount / 7;
    if (effect.stat === "shieldStart") score += amount / 4.5;
    if (effect.stat === "multiEnemyShieldStart") score += amount / 5;
    if (effect.stat === "killHeal") score += amount / 6;
    if (effect.stat === "critChance") score += amount * (characterId === "archer" ? 30 : 24);
    if (effect.stat === "openingCritChance") score += amount * (characterId === "archer" ? 11 : 8);
    if (effect.stat === "enemyParalysisChance") score += amount * (characterId === "archer" ? 18 : 14);
    if (effect.stat === "paralysisResonanceDamageBonus") {
      const ownChance = (Number(hero.enemyParalysisChance) || 0)
        + getEffectAmount(blessing, "enemyParalysisChance");
      score += amount * 12 * (ownChance > 0 ? 1 : 0.15);
    }
    if (effect.stat === "shieldReversalDamage") {
      const selfShield = getEffectAmount(blessing, "shieldStart");
      score += amount / 2.5 * ((hero.shieldStart + selfShield) > 0 ? 1 : 0.2);
    }
    if (effect.stat === "supportCounterDamage") score += amount / 2.5;
    if (effect.stat === "frontlineBreakAttack") score += amount * 0.8;
    if (effect.stat === "tideMarkCritChance") score += amount * (characterId === "archer" ? 10 : 8);
    if (effect.stat === "cavernEchoDamagePerStack") score += amount * 2.2;
    if (effect.stat === "protectedEnemyDamageBonus") score += amount * 20;
  }

  if (blessing.id === "cave-cavern-spring" && hpRatio > 0.9) score -= 4;
  if (blessing.id === "cave-tide-scavenge" && encounterIndex >= 12) score -= 2;
  if (blessing.id === "cave-support-counter" && encounterIndex >= 13) score -= 2;
  if (blessing.id === "cave-frontline-break") score += 1.5;
  if (blessing.id === "cave-break-formation") score += encounterIndex < 12 ? 2 : 0;
  if (blessing.id === "cave-cavern-echo") score += encounterIndex >= 11 ? 2 : 0;
  if (blessing.id === "cave-paralysis-resonance" && (Number(hero.enemyParalysisChance) || 0) > 0) score += 2.5;
  if (hpRatio < 0.55 && blessing.primaryFlow === "defense") score += 2.5;
  if (hpRatio < 0.45 && blessing.primaryFlow === "healing") score += 4;
  return score;
}

function getEffectAmount(blessing, stat) {
  return (blessing.effects || []).reduce((sum, effect) => {
    return effect.type === "add" && effect.stat === stat ? sum + (Number(effect.amount) || 0) : sum;
  }, 0);
}

function weightedPick(items, getWeight, rng) {
  const total = items.reduce((sum, item) => sum + Math.max(0, Number(getWeight(item)) || 0), 0);
  let value = rng() * total;
  for (const item of items) {
    value -= Math.max(0, Number(getWeight(item)) || 0);
    if (value <= 0) return item;
  }
  return items.at(-1);
}

function formatResult(result) {
  const defeats = Object.entries(result.defeatsByEncounter)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .slice(-5)
    .map(([index, count]) => `${index}:${count}`)
    .join(",") || "無";
  const topPicks = Object.entries(result.averageSelectedBlessings)
    .slice(0, 5)
    .map(([id, count]) => `${id}=${count.toFixed(2)}`)
    .join(", ");
  return [
    result.mode,
    characterDefinitions[result.characterId].name,
    weaponDefinitions[result.weaponId].name,
    result.weaponSet,
    `勝場比例 ${(result.winRatio * 100).toFixed(2)}%`,
    `平均抵達 ${result.averageReached.toFixed(2)}/16`,
    `Boss到達 ${(result.bossEntryRatio * 100).toFixed(2)}%`,
    `Boss前HP ${result.averageBossEntryHpRatio == null ? "-" : (result.averageBossEntryHpRatio * 100).toFixed(2) + "%"}`,
    `通關HP ${result.averageClearHpRatio == null ? "-" : (result.averageClearHpRatio * 100).toFixed(2) + "%"}`,
    `平均回合 ${result.averageTurns.toFixed(1)}`,
    `主要敗北 ${defeats}`,
    `常選 ${topPicks}`
  ].join(" | ");
}

function seedFrom(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}
