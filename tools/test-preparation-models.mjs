import assert from "node:assert/strict";

import { applyBlessingEffects } from "../src/core/blessings.js";
import {
  applyEnemyEndOfTurnNegativeEffects,
  applyEnemyEndOfTurnRecoveryEffects,
  applyHeroEndOfTurnNegativeEffects,
  applyHeroEndOfTurnRecoveryEffects,
  buildEnemy,
  resolveEnemyAction,
  resolveHeroAction,
  resolveHeroEntangle
} from "../src/core/combat.js";
import { buildHeroFromProgression, createSkillState } from "../src/core/progression.js";
import {
  beginPreparationBattle,
  consumePreparationEntangleRetry,
  createRunPreparation,
  recordPreparationEntangleRetryResult,
  resolvePostEncounterPreparation,
  resolvePreparationIncomingDirectDamage,
  resolvePreparationPoisonDamage,
  runPreparationOpeningAction
} from "../src/core/preparations.js";
import { characterDefinitions } from "../src/data/characters/index.js";
import { forestRegion } from "../src/data/regions/forest.js";
import { plainsRegion } from "../src/data/regions/plains.js";
import { getBlessingRarity } from "../src/data/rarities.js";
import {
  initializeCharacterBattleState,
  modifyCharacterIncomingDirectDamage,
  resolveCharacterPlayerAction
} from "../src/characters/skills/index.js";
import { createBattleSkills } from "../src/features/battle/battleSkills.js";

const ROUNDS = Math.max(1, Number(process.argv[2]) || 5000);
const SCOPE = ["all", "plains", "forest"].includes(process.argv[3]) ? process.argv[3] : "all";
const MAX_TURNS = 500;
const logger = {
  template() {},
  fixed() {}
};

const plainsCases = [
  { id: null, label: "無整備", enhanced: false },
  { id: "simple-bandage", label: "簡易繃帶", enhanced: false },
  { id: "beast-repellent-herb", label: "驅獸香草", enhanced: false },
  { id: "weapon-maintenance", label: "武器保養", enhanced: false },
  { id: "simple-bandage", label: "簡易繃帶・強化", enhanced: true },
  { id: "beast-repellent-herb", label: "驅獸香草・強化", enhanced: true },
  { id: "weapon-maintenance", label: "武器保養・強化", enhanced: true }
];
const forestCases = [
  { id: null, label: "無整備", enhanced: false },
  { id: "insect-repellent-powder", label: "驅蟲藥粉", enhanced: false },
  { id: "forest-bandage", label: "林地繃帶", enhanced: false },
  { id: "web-cutting-knife", label: "割網短刀", enhanced: false },
  { id: "insect-repellent-powder", label: "驅蟲藥粉・強化", enhanced: true },
  { id: "forest-bandage", label: "林地繃帶・強化", enhanced: true },
  { id: "web-cutting-knife", label: "割網短刀・強化", enhanced: true }
];

const plainsResults = SCOPE === "forest" ? [] : plainsCases.map((entry) => ({
  ...entry,
  result: withSeed(0x24001010, () => simulateRegionRuns({
    rounds: ROUNDS,
    region: plainsRegion,
    characterId: "adventurer",
    level: 10,
    preparationId: entry.id,
    preparationEnhanced: entry.enhanced,
    chooseBlessing: chooseReasonableAdventurerBlessing
  }))
}));
const forestResults = SCOPE === "plains" ? [] : forestCases.map((entry) => ({
  ...entry,
  result: withSeed(0x23400425, () => simulateRegionRuns({
    rounds: ROUNDS,
    region: forestRegion,
    characterId: "archer",
    level: 25,
    preparationId: entry.id,
    preparationEnhanced: entry.enhanced,
    chooseBlessing: chooseReasonableArcherBlessing
  }))
}));

if (plainsResults.length > 0) {
  printResults("Plains Lv.10 adventurer preparation model", plainsResults);
}
if (forestResults.length > 0) {
  printResults("Forest Lv.25 archer preparation model", forestResults);
}

if (ROUNDS >= 5000 && plainsResults.length > 0) {
  const plainsBaseline = getWinRatio(plainsResults[0].result);
  assert.ok(plainsBaseline >= 0.45 && plainsBaseline <= 0.58, "Lv.10 冒險者平原 baseline 應維持可開始通關區間");
  const plainsRanges = new Map([
    ["簡易繃帶", [0.01, 0.05]],
    ["驅獸香草", [0.02, 0.07]],
    ["武器保養", [0.02, 0.07]],
    ["簡易繃帶・強化", [0.02, 0.07]],
    ["驅獸香草・強化", [0.03, 0.08]],
    ["武器保養・強化", [0.03, 0.09]]
  ]);
  for (const entry of plainsResults.slice(1)) {
    const delta = getWinRatio(entry.result) - plainsBaseline;
    const [min, max] = plainsRanges.get(entry.label);
    assert.ok(delta >= min && delta <= max, `${entry.label} 平原增幅超出候選驗證區間`);
  }
}

if (ROUNDS >= 5000 && forestResults.length > 0) {
  const forestBaseline = getWinRatio(forestResults[0].result);
  if (ROUNDS >= 20000) {
    assert.ok(Math.abs(forestBaseline - 0.71165) <= 0.002, "森林 baseline 不應偏離納入伏擊後的正式模型基準");
  } else {
    assert.ok(forestBaseline >= 0.68 && forestBaseline <= 0.75, "森林快速模型 baseline 應維持正式模型合理區間");
  }
  const forestRanges = new Map([
    ["驅蟲藥粉", [0.002, 0.03]],
    ["林地繃帶", [0.01, 0.05]],
    ["割網短刀", [0.015, 0.06]],
    ["驅蟲藥粉・強化", [0.008, 0.045]],
    ["林地繃帶・強化", [0.02, 0.065]],
    ["割網短刀・強化", [0.025, 0.075]]
  ]);
  for (const entry of forestResults.slice(1)) {
    const delta = getWinRatio(entry.result) - forestBaseline;
    const [min, max] = forestRanges.get(entry.label);
    assert.ok(delta >= min && delta <= max, `${entry.label} 森林增幅超出候選驗證區間`);
  }
}

console.log("Normal and enhanced preparation formal runtime balance comparison passed.");

function simulateRegionRuns({ rounds, region, characterId, level, preparationId, preparationEnhanced = false, chooseBlessing }) {
  let wins = 0;
  let reachedTotal = 0;
  let triggerTotal = 0;
  let healingTotal = 0;
  let preventedTotal = 0;
  let retrySuccessTotal = 0;
  const defeatsByEncounter = new Map();

  for (let run = 0; run < rounds; run += 1) {
    const hero = buildHeroFromProgression(characterDefinitions[characterId], {
      level,
      exp: 0,
      learnedSkills: []
    });
    const preparation = preparationId
      ? createRunPreparation(region, preparationId, { enhanced: preparationEnhanced })
      : null;
    const bosses = region.bosses || [region.boss];
    const selectedBoss = weightedPick(bosses, (boss) => Number(boss.weight) || 100);
    let reached = 0;
    let cleared = true;

    for (let encounterIndex = 0; encounterIndex < region.encounterPlan.length; encounterIndex += 1) {
      reached = encounterIndex + 1;
      resetBattleState(hero);
      beginPreparationBattle(preparation);
      const battleSkills = createModelBattleSkills(hero);
      battleSkills.applyBattleStartSkills();
      const encounterType = getEncounterType(region.encounterPlan[encounterIndex]);
      const enemy = buildEnemy(region, encounterIndex, hero, { boss: selectedBoss });
      enemy.poison = 0;
      applyEnemyAmbush(hero, enemy);
      const won = simulateEncounter({ hero, enemy, preparation, encounterType, battleSkills });
      if (!won) {
        cleared = false;
        defeatsByEncounter.set(reached, (defeatsByEncounter.get(reached) || 0) + 1);
        break;
      }

      applyKillRecovery(hero);
      battleSkills.applyVictorySkills();
      consumeBattleLimitedEffects(hero);
      const isFinalEncounter = encounterIndex >= region.encounterPlan.length - 1;
      resolvePostEncounterPreparation({ preparation, hero, isFinalEncounter });
      if (!isFinalEncounter) {
        const choices = getBlessingChoices(region.blessings, 3);
        const blessing = chooseBlessing(choices, hero, encounterIndex);
        applyBlessingEffects(hero, blessing);
        hero.blessings.push(blessing.name);
      }
    }

    reachedTotal += reached;
    if (cleared) {
      wins += 1;
    }
    triggerTotal += preparation?.triggerCount || 0;
    healingTotal += preparation?.healing || 0;
    preventedTotal += preparation?.damagePrevented || 0;
    retrySuccessTotal += preparation?.retrySuccessCount || 0;
  }

  return {
    rounds,
    wins,
    averageReached: reachedTotal / rounds,
    averageTriggers: triggerTotal / rounds,
    averageHealing: healingTotal / rounds,
    averagePrevented: preventedTotal / rounds,
    averageRetrySuccess: retrySuccessTotal / rounds,
    defeatsByEncounter
  };
}

function simulateEncounter({ hero, enemy, preparation, encounterType, battleSkills }) {
  const runtimeEnemy = {
    ...enemy,
    runtimeId: "enemy-1",
    displayName: enemy.name
  };
  const enemies = [runtimeEnemy];

  for (let turn = 1; turn <= MAX_TURNS; turn += 1) {
    const heroEntangled = resolveHeroEntangle({
      hero,
      log: logger,
      retryOnFailure: () => consumePreparationEntangleRetry(preparation),
      onRetryResult: ({ success }) => recordPreparationEntangleRetryResult({ preparation, success })
    });
    if (!heroEntangled) {
      runPreparationOpeningAction({
        preparation,
        hero,
        encounterType,
        action: () => {
          const characterAction = resolveCharacterPlayerAction({
            hero,
            enemies,
            targetEnemyId: runtimeEnemy.runtimeId,
            log: logger
          });
          if (!characterAction.handled) {
            resolveHeroAction({ hero, enemy: runtimeEnemy, log: logger });
          }
        }
      });
      if (runtimeEnemy.hp <= 0) {
        return true;
      }
    }

    const enemyAction = resolveEnemyAction({
      hero,
      enemy: runtimeEnemy,
      turn,
      log: logger,
      modifyDirectDamage: (context) => {
        const characterDamage = modifyCharacterIncomingDirectDamage(context);
        return resolvePreparationIncomingDirectDamage({
          preparation,
          enemy: context.enemy,
          damage: characterDamage
        }).damage;
      }
    });
    void enemyAction;
    applyEmergencyBandage(hero);
    if (hero.hp <= 0 && !battleSkills.tryLastStand()) {
      return false;
    }

    const endOfTurn = applyHeroEndOfTurnNegativeEffects({
      hero,
      log: logger,
      modifyPoisonDamage: ({ damage }) => resolvePreparationPoisonDamage({ preparation, damage }).damage
    });
    applyEnemyEndOfTurnNegativeEffects({ enemy: runtimeEnemy, log: logger });
    applyHeroEndOfTurnRecoveryEffects({ hero, turn, log: logger });
    applyEnemyEndOfTurnRecoveryEffects({ enemy: runtimeEnemy, turn, log: logger });
    if (hero.hp <= 0) {
      void endOfTurn;
      if (!battleSkills.tryLastStand()) {
        return false;
      }
    }
    if (runtimeEnemy.hp <= 0) {
      return true;
    }
  }
  throw new Error("整備模型單場戰鬥超過最大回合數，可能存在時序或平衡錯誤。");
}

function resetBattleState(hero) {
  hero.poison = 0;
  hero.entangle = null;
  hero.battleAttackBonus = 0;
  hero.battleCritBonus = 0;
  hero.hasAttackedThisBattle = false;
  hero.statusFamiliarityLimitBonus = 0;
  hero.victoryHealBonusRatio = 0;
  hero.shield = hero.shieldStart;
  hero.skillState = createSkillState();
  initializeCharacterBattleState(hero);
}

function createModelBattleSkills(hero) {
  return createBattleSkills({
    state: { hero },
    hasHeroSkill(skillId) {
      return hasSkill(hero, skillId);
    },
    addLog() {},
    addFixedLog() {},
    lastBagFlowWeightMultiplier: 0.6
  });
}

function applyEnemyAmbush(hero, enemy) {
  const amount = Number(enemy.ambushDamage) || 0;
  if (amount <= 0 || hero.hp <= 1) {
    return;
  }
  hero.hp -= Math.min(amount, hero.hp - 1);
}

function applyEmergencyBandage(hero) {
  if (!hasSkill(hero, "emergency-bandage") || hero.skillState.emergencyBandageUsed || hero.hp <= 0) {
    return;
  }
  if (hero.hp > hero.maxHp * 0.4) {
    return;
  }
  const amount = Math.max(1, Math.round(hero.maxHp * 0.18));
  hero.skillState.emergencyBandageUsed = true;
  hero.hp = Math.min(hero.maxHp, hero.hp + amount);
}

function applyKillRecovery(hero) {
  if (hero.killHeal > 0) {
    hero.hp = Math.min(hero.maxHp, hero.hp + hero.killHeal);
  }
  if (hero.killHealRatio > 0) {
    hero.hp = Math.min(hero.maxHp, hero.hp + Math.max(1, Math.round(hero.maxHp * hero.killHealRatio)));
  }
}

function consumeBattleLimitedEffects(hero) {
  if (!Array.isArray(hero.timedRegens)) {
    return;
  }
  hero.timedRegens = hero.timedRegens
    .map((effect) => ({
      ...effect,
      remainingEncounters: Math.max(0, (effect.remainingEncounters || 0) - 1)
    }))
    .filter((effect) => effect.remainingEncounters > 0);
}

function getBlessingChoices(pool, count) {
  const available = [...pool];
  const choices = [];
  while (choices.length < count && available.length > 0) {
    const selected = weightedPick(available, (blessing) => getBlessingRarity(blessing.rarity).weight);
    choices.push(selected);
    available.splice(available.indexOf(selected), 1);
  }
  return choices;
}

function chooseReasonableAdventurerBlessing(choices, hero, encounterIndex) {
  return choices
    .map((blessing) => ({ blessing, score: scoreAdventurerBlessing(blessing, hero, encounterIndex) }))
    .sort((a, b) => b.score - a.score || a.blessing.id.localeCompare(b.blessing.id))[0].blessing;
}

function scoreAdventurerBlessing(blessing, hero) {
  const hpRatio = hero.maxHp > 0 ? hero.hp / hero.maxHp : 0;
  const missingHp = Math.max(0, hero.maxHp - hero.hp);
  const flow = blessing.primaryFlow;
  const roleBase = {
    attack: 8,
    defense: 7,
    healing: 6.5,
    crit: 6,
    debuff: 4
  };
  const momentum = Math.max(0, Number(hero.blessingFlowMomentum?.[flow]) || 0);
  let score = roleBase[flow] || 3;
  score += momentum * 1.75;
  if (flow === "healing") {
    score += Math.min(8, missingHp / 18);
    if (hpRatio < 0.7) score += 4;
    if (hpRatio < 0.45) score += 8;
  }
  if (flow === "defense" && hpRatio < 0.65) score += 4;
  if (flow === "attack" && hero.attack < 25) score += 2;
  return score;
}

function chooseReasonableArcherBlessing(choices, hero, encounterIndex) {
  return choices
    .map((blessing) => ({ blessing, score: scoreArcherBlessing(blessing, hero, encounterIndex) }))
    .sort((a, b) => b.score - a.score || a.blessing.id.localeCompare(b.blessing.id))[0].blessing;
}

function scoreArcherBlessing(blessing, hero) {
  const hpRatio = hero.maxHp > 0 ? hero.hp / hero.maxHp : 0;
  const missingHp = Math.max(0, hero.maxHp - hero.hp);
  const flow = blessing.primaryFlow;
  const roleBase = {
    crit: 9,
    debuff: 8,
    attack: 7.5,
    defense: 5.5,
    healing: 5
  };
  const momentum = Math.max(0, Number(hero.blessingFlowMomentum?.[flow]) || 0);
  let score = roleBase[flow] || 3;
  score += momentum * 2;

  if (flow === "healing") {
    score += Math.min(6, missingHp / 28);
    if (hpRatio < 0.7) score += 5;
    if (hpRatio < 0.45) score += 10;
  }
  if (flow === "defense" && hpRatio < 0.65) {
    score += 3;
  }

  if (blessing.id === "spring-rest") score += hpRatio < 0.72 ? 5 : 0;
  if (blessing.id === "spore-breathing") score += hero.killHeal < 12 ? 4 : 1;
  if (blessing.id === "moss-stone-guard") score += hero.defense < 10 ? 2 : 0;
  if (blessing.id === "webbed-bracer") score += hero.damageReduction < 0.4 ? 4 : 0;
  if (blessing.id === "bark-reinforcement") score += hero.shieldStart < 20 ? 3 : 0;
  if (blessing.id === "hunter-path-reading") score += hero.critChance < 0.45 ? 3 : 1;
  if (blessing.id === "vine-binding-strike") score += 4;
  if (blessing.id === "poison-herb-coating") score += hero.poisonPower < 9 ? 4 : 1;
  if (blessing.id === "forest-whetstone") score += hero.attack < 30 ? 3 : 1;
  if (blessing.id === "heartwood-guidance") score += 2;

  return score;
}

function getEncounterType(entry) {
  return typeof entry === "string" ? entry : entry?.type || null;
}

function hasSkill(hero, skillId) {
  return Array.isArray(hero?.skills) && hero.skills.includes(skillId);
}

function weightedPick(items, getWeight) {
  const weights = items.map((item) => Math.max(0, Number(getWeight(item)) || 0));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let value = Math.random() * total;
  for (let index = 0; index < items.length; index += 1) {
    value -= weights[index];
    if (value <= 0) {
      return items[index];
    }
  }
  return items.at(-1);
}

function withSeed(seed, action) {
  const originalRandom = Math.random;
  Math.random = createSeededRandom(seed);
  try {
    return action();
  } finally {
    Math.random = originalRandom;
  }
}

function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function getWinRatio(result) {
  return result.wins / result.rounds;
}

function printResults(title, entries) {
  const baseline = getWinRatio(entries[0].result);
  console.log(`\n${title}`);
  entries.forEach(({ label, result }) => {
    const ratio = getWinRatio(result);
    const delta = ratio - baseline;
    console.log(
      `${label.padEnd(8)} ${(ratio * 100).toFixed(2)}% `
      + `(${formatDelta(delta * 100)} pp) `
      + `triggers=${result.averageTriggers.toFixed(3)} `
      + `heal=${result.averageHealing.toFixed(3)} `
      + `prevented=${result.averagePrevented.toFixed(3)} `
      + `retryWins=${result.averageRetrySuccess.toFixed(3)}`
    );
  });
}

function formatDelta(value) {
  if (Math.abs(value) < 0.005) return "0.00";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
}
