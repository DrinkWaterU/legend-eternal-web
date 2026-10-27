import { createBattleTurnController } from "../src/features/battle/battleTurnController.js";
import assert from "node:assert/strict";

import { applyBlessingEffects } from "../src/core/blessings.js";
import { resetBlessingBattleState } from "../src/core/caveBlessingEffects.js";
import {
  buildEnemy,
  buildEnemyGroup,
  getHeroBattleHealingAmount,
  getHeroBattleHealingMultiplier,
  resolveHeroAction
} from "../src/core/combat.js";
import { createRuntimeEnemyGroup, getLivingEnemies } from "../src/core/enemyGroups.js";
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
import { buildHeroFromProgression, createSkillState } from "../src/core/progression.js";
import { initializeCharacterBattleState, modifyCharacterIncomingDirectDamage, resolveCharacterPlayerAction } from "../src/characters/skills/index.js";
import { createBattleSkills } from "../src/features/battle/battleSkills.js";
import { applyEquippedWeaponBattleStart } from "../src/core/weaponBattleEffects.js";
import { characterDefinitions } from "../src/data/characters/index.js";
import { beachRegion } from "../src/data/regions/beach.js";
import { forestRegion } from "../src/data/regions/forest.js";
import { plainsRegion } from "../src/data/regions/plains.js";
import { getBlessingRarity } from "../src/data/rarities.js";
import { weaponDefinitions } from "../src/data/weapons.js";
import { formatPercent, parseRoundCount, seedFromText, weightedPick, withSeed } from "./model-test-helpers.mjs";

const ROUNDS = Math.max(60, parseRoundCount(process.argv[2], 120));
const MAX_TURNS = 500;
const CHARACTER_IDS = ["adventurer", "archer", "kaige"];
const LEVELS = [25, 30];
const BUILD_IDS = ["attack", "defense", "mixed"];
const STAGE_NAMES = ["early", "mid", "late", "boss"];
const regionEntries = Object.freeze([
  { id: "plains", label: "平原", region: plainsRegion },
  { id: "forest", label: "森林", region: forestRegion },
  { id: "beach", label: "海岸", region: beachRegion }
]);

const buildProfiles = Object.freeze({
  attack: Object.freeze({
    label: "攻擊 Build",
    weapons: Object.freeze({
      adventurer: "iron-longsword",
      archer: "verdant-pursuit-bow",
      kaige: "worn-battle-axe"
    }),
    preparations: Object.freeze({
      plains: "weapon-maintenance",
      forest: "web-cutting-knife",
      beach: "freshwater-dressing"
    })
  }),
  defense: Object.freeze({
    label: "防守 Build",
    weapons: Object.freeze({
      adventurer: "guard-short-sword",
      archer: "hunter-shortbow",
      kaige: "worn-battle-axe"
    }),
    preparations: Object.freeze({
      plains: "simple-bandage",
      forest: "forest-bandage",
      beach: "insulated-gloves"
    })
  }),
  mixed: Object.freeze({
    label: "混合 Build",
    weapons: Object.freeze({
      adventurer: "bloodbone-guardian-mace",
      archer: "tidepiercer-shortbow",
      kaige: "worn-battle-axe"
    }),
    preparations: Object.freeze({
      plains: "beast-repellent-herb",
      forest: "insect-repellent-powder",
      beach: "reef-anchor-tether"
    })
  })
});

const results = [];
for (const { id: regionId, label: regionLabel, region } of regionEntries) {
  for (const characterId of CHARACTER_IDS) {
    for (const buildId of BUILD_IDS) {
      const seed = seedFromText(`v0.2.7.4:${regionId}:${characterId}:${buildId}`);
      for (const level of LEVELS) {
        results.push(withSeed(seed, () => simulateRuns({
          regionId,
          regionLabel,
          region,
          characterId,
          buildId,
          level,
          rounds: ROUNDS
        })));
      }
    }
  }
}

validateResults(results);
printResults(results);

console.log("MODEL_JSON", JSON.stringify({
  model: "v0.2.7.4-lv30-runtime-isolated",
  rounds: ROUNDS,
  levels: LEVELS,
  regions: regionEntries.map(({ id, label }) => ({ id, label })),
  characters: CHARACTER_IDS,
  builds: BUILD_IDS.map((id) => ({
    id,
    label: buildProfiles[id].label,
    preparationEnhanced: false
  })),
  assumptions: {
    sameSeedPerLevelPair: true,
    encounterEvents: false,
    officialBattleTurnController: true,
    actionPolicy: "attack-first-living-enemy",
    guardPolicy: false,
    officialRegions: true,
    officialCharacterRuntime: true,
    officialWeapons: true,
    officialPreparations: true,
    officialBlessings: true,
    outputMeaning: "隔離模型勝場比例，不是正式面板數值，也不作為單一結果調整正式數字。"
  },
  results
}));

function simulateRuns({ regionId, regionLabel, region, characterId, buildId, level, rounds }) {
  const profile = buildProfiles[buildId];
  const weaponId = profile.weapons[characterId];
  const preparationId = profile.preparations[regionId];
  assert.ok(weaponDefinitions[weaponId], `正式武器不存在：${weaponId}`);

  const totals = createTotals();
  for (let run = 0; run < rounds; run += 1) {
    const hero = buildHeroFromProgression(characterDefinitions[characterId], {
      level,
      exp: 0,
      learnedSkills: [],
      equipment: { weaponId }
    }, {
      inventory: { weapons: { [weaponId]: true } },
      weaponDefinitions
    });
    const runMetrics = createRunMetrics();
    const preparation = createRunPreparation(region, preparationId, { enhanced: false });
    hero.activePreparation = preparation;
    hero.battleHooks = {
      onDirectAttackResolved(result) {
        if (characterId !== "archer" || result.source !== "original") return;
        runMetrics.archerOriginalShots += 1;
        const poisonedAtStart = hero.modelPoisonedTargetsAtActionStart?.has(result.enemy?.runtimeId);
        if (poisonedAtStart && result.critical && result.enemy?.hp > 0) {
          runMetrics.weakPointEligible += 1;
        }
      }
    };

    const selectedBoss = weightedPick(
      region.bosses || [region.boss],
      (boss) => Number(boss?.weight) || 100
    );
    let reached = 0;
    let failureEncounter = null;
    let failureHeroHpRatio = null;
    let failureEnemyHpRatio = null;
    let cleared = true;

    for (let encounterIndex = 0; encounterIndex < region.encounterPlan.length; encounterIndex += 1) {
      reached = encounterIndex + 1;
      const encounterType = getEncounterType(region.encounterPlan[encounterIndex]);
      resetBattleState(hero);
      const enemies = buildEncounterGroup({ region, encounterIndex, hero, boss: selectedBoss });
      hero.activeEnemyCount = enemies.length;
      beginPreparationBattle(preparation, { enemyCount: enemies.length });
      const battleSkills = createModelBattleSkills(hero, runMetrics);
      battleSkills.applyBattleStartSkills();
      applyEquippedWeaponBattleStart(hero, {
        enemyCount: enemies.length,
        encounterType
      });
      if (enemies.length >= 2) {
        hero.shield += (Number(hero.multiEnemyShieldStart) || 0)
          + Math.min(100, (Number(hero.shieldPerExtraEnemy) || 0) * Math.min(3, enemies.length - 1));
      }
      applyEnemyAmbushes(hero, enemies);

      const encounterResult = simulateEncounter({
        hero,
        enemies,
        preparation,
        battleSkills,
        runMetrics,
        encounterType
      });
      runMetrics.statusExposureTurns += encounterResult.statusExposureTurns;
      if (!encounterResult.won) {
        cleared = false;
        failureEncounter = reached;
        failureHeroHpRatio = ratio(hero.hp, hero.maxHp);
        failureEnemyHpRatio = getEnemyGroupHpRatio(enemies);
        break;
      }

      battleSkills.applyVictorySkills();
      battleSkills.consumeBattleLimitedEffects();
      resolvePostEncounterPreparation({
        preparation,
        hero,
        isFinalEncounter: encounterIndex === region.encounterPlan.length - 1,
        healingMultiplier: getHeroBattleHealingMultiplier(hero)
      });

      if (encounterIndex < region.encounterPlan.length - 1) {
        const blessing = chooseBlessing({
          pool: region.blessings || [],
          hero,
          characterId
        });
        applyBlessingEffects(hero, blessing);
        hero.blessings = Array.isArray(hero.blessings) ? hero.blessings : [];
        hero.blessings.push(blessing.name);
        runMetrics.blessingsAcquired += 1;
      }
    }

    totals.reached += reached;
    totals.statusExposureTurns += runMetrics.statusExposureTurns;
    totals.satchelApplications += runMetrics.satchelApplications;
    totals.poisonArrowApplications += runMetrics.poisonArrowApplications;
    totals.weakPointEligible += runMetrics.weakPointEligible;
    totals.weakPointTriggers += runMetrics.weakPointTriggers;
    totals.archerOriginalShots += runMetrics.archerOriginalShots;
    totals.finishers += runMetrics.finishers;
    totals.finisherHealing += runMetrics.finisherHealing;
    totals.killHealing += runMetrics.killHealing;
    totals.bloodWithoutRetreatEligible += runMetrics.bloodWithoutRetreatEligible;
    totals.bloodWithoutRetreatTriggers += runMetrics.bloodWithoutRetreatTriggers;
    totals.blessingsAcquired += runMetrics.blessingsAcquired;

    if (cleared) {
      totals.wins += 1;
      totals.clearHeroHpRatio += ratio(hero.hp, hero.maxHp);
      totals.clearBlessings += runMetrics.blessingsAcquired;
    } else {
      totals.deaths += 1;
      totals.lossHeroHpRatio += failureHeroHpRatio;
      totals.lossEnemyHpRatio += failureEnemyHpRatio;
      totals.lossBlessings += runMetrics.blessingsAcquired;
      totals.lossByEncounter[failureEncounter] = (totals.lossByEncounter[failureEncounter] || 0) + 1;
      totals.stageLosses[getFailureStage(failureEncounter, region.encounterPlan.length)] += 1;
    }

    const stageThresholds = getStageThresholds(region.encounterPlan.length);
    STAGE_NAMES.forEach((stageName) => {
      if (reached >= stageThresholds[stageName]) totals.stageReach[stageName] += 1;
    });
  }

  return {
    regionId,
    regionLabel,
    characterId,
    characterName: characterDefinitions[characterId].name,
    buildId,
    buildLabel: profile.label,
    level,
    weaponId,
    preparationId,
    preparationEnhanced: false,
    rounds,
    wins: totals.wins,
    deaths: totals.deaths,
    winRatio: totals.wins / rounds,
    averageReached: totals.reached / rounds,
    encounterCount: region.encounterPlan.length,
    bossReachRatio: totals.stageReach.boss / rounds,
    bossClearRatio: totals.wins / rounds,
    averageClearHeroHpRatio: totals.wins > 0 ? totals.clearHeroHpRatio / totals.wins : null,
    averageLossHeroHpRatio: totals.deaths > 0 ? totals.lossHeroHpRatio / totals.deaths : null,
    averageLossEnemyHpRatio: totals.deaths > 0 ? totals.lossEnemyHpRatio / totals.deaths : null,
    averageStatusExposureTurns: totals.statusExposureTurns / rounds,
    averageBlessingsAcquired: totals.blessingsAcquired / rounds,
    averageBlessingsOnClear: totals.wins > 0 ? totals.clearBlessings / totals.wins : null,
    averageBlessingsOnLoss: totals.deaths > 0 ? totals.lossBlessings / totals.deaths : null,
    stageReachRatios: Object.fromEntries(STAGE_NAMES.map((stage) => [stage, totals.stageReach[stage] / rounds])),
    stageLosses: totals.stageLosses,
    lossByEncounter: totals.lossByEncounter,
    specialMetrics: {
      satchelApplicationsPerRun: totals.satchelApplications / rounds,
      weakPointEligiblePerRun: totals.weakPointEligible / rounds,
      weakPointTriggersPerRun: totals.weakPointTriggers / rounds,
      weakPointTriggerRate: totals.weakPointEligible > 0
        ? totals.weakPointTriggers / totals.weakPointEligible
        : null,
      poisonArrowApplicationsPerRun: totals.poisonArrowApplications / rounds,
      archerOriginalShotsPerRun: totals.archerOriginalShots / rounds,
      finishersPerRun: totals.finishers / rounds,
      finisherHealingPerRun: totals.finisherHealing / rounds,
      killHealingPerRun: totals.killHealing / rounds,
      bloodWithoutRetreatEligiblePerRun: totals.bloodWithoutRetreatEligible / rounds,
      bloodWithoutRetreatTriggersPerRun: totals.bloodWithoutRetreatTriggers / rounds,
      bloodWithoutRetreatTriggerRate: totals.bloodWithoutRetreatEligible > 0
        ? totals.bloodWithoutRetreatTriggers / totals.bloodWithoutRetreatEligible
        : null
    }
  };
}

function simulateEncounter({ hero, enemies, preparation, battleSkills, runMetrics, encounterType }) {
  const logger = createModelLogger(runMetrics);
  const settledEnemyIds = new Set();
  let statusExposureTurns = 0;
  let won = false;
  const state = { hero, enemies, phase: "danger", turn: 0, ended: false };
  const controller = createBattleTurnController({
    state,
    createCombatLogger: () => logger,
    currentTargetEnemy: () => getLivingEnemies(enemies)[0],
    runHeroPlayerAction: ({ target }) => {
        if (hero.characterId === "archer") {
          hero.modelPoisonedTargetsAtActionStart = new Set(
            getLivingEnemies(enemies)
              .filter((enemy) => enemy.poison > 0)
              .map((enemy) => enemy.runtimeId)
          );
        }
        const kaigeBefore = getKaigeActionSnapshot(hero);
        runPreparationOpeningAction({
          preparation,
          hero,
          encounterType,
          onTrigger: ({ attackBonus }) => logger.fixed(
            "status",
            `整備｜${preparation.name}讓這次出手更有威力，攻擊提高 ${attackBonus} 點。`
          ),
          action: () => {
            const characterAction = resolveCharacterPlayerAction({
              hero,
              enemies,
              targetEnemyId: target.runtimeId,
              log: logger
            });
            if (!characterAction.handled) {
              resolveHeroAction({ hero, enemy: target, enemies, log: logger });
            }
            return characterAction;
          }
        });
        recordKaigeActionMetrics(hero, kaigeBefore, runMetrics);
    },
    consumeEntangleRetry: () => consumePreparationEntangleRetry(preparation),
    recordEntangleRetryResult: ({ success }) => recordPreparationEntangleRetryResult({ preparation, success }),
    modifyIncomingDirectDamage: (context) => resolvePreparationIncomingDirectDamage({
      preparation, enemy: context.enemy, damage: modifyCharacterIncomingDirectDamage(context)
    }).damage,
    modifyPoisonDamage: (damage) => resolvePreparationPoisonDamage({ preparation, damage }).damage,
    settleDefeatedEnemies: () => settleDefeatedEnemies(hero, enemies, settledEnemyIds, runMetrics),
    applyEmergencyBandage: battleSkills.applyEmergencyBandage,
    tryLastStand: battleSkills.tryLastStand,
    winEncounter: () => { won = true; state.ended = true; },
    loseRun: () => { state.ended = true; },
    render: () => {}
  });
  for (let turn = 1; turn <= MAX_TURNS; turn += 1) {
    statusExposureTurns += countActiveStatuses(hero, enemies);
    controller.playTurn("attack");
    if (state.ended) return { won, statusExposureTurns };
  }
  throw new Error("Model encounter exceeded maximum turns.");
}

function buildEncounterGroup({ region, encounterIndex, hero, boss }) {
  const entry = region.encounterPlan[encounterIndex];
  const encounterType = getEncounterType(entry);
  if (encounterType === "boss") {
    return createRuntimeEnemyGroup([{ enemy: buildEnemy(region, encounterIndex, hero, { boss }) }]);
  }
  const groupOptions = Array.isArray(entry?.groupOptions) ? entry.groupOptions : null;
  if (!groupOptions) {
    return createRuntimeEnemyGroup([{ enemy: buildEnemy(region, encounterIndex, hero) }]);
  }
  const option = weightedPick(groupOptions, (group) => Number(group.weight) || 100);
  return createRuntimeEnemyGroup(buildEnemyGroup(region, encounterIndex, hero, option));
}

function createModelBattleSkills(hero, runMetrics) {
  const logger = createModelLogger(runMetrics);
  return createBattleSkills({
    state: { hero },
    hasHeroSkill: (skillId) => hero.skills.includes(skillId),
    addLog(category, templateId) {
      if (templateId === "versatileSatchel") runMetrics.satchelApplications += 1;
      logger.template(category, templateId, {});
    },
    addFixedLog: logger.fixed,
    lastBagFlowWeightMultiplier: 0.6
  });
}

function createModelLogger(runMetrics) {
  return {
    template() {},
    fixed(category, message) {
      if (typeof message !== "string") return;
      if (message.includes("淬毒箭命中")) runMetrics.poisonArrowApplications += 1;
      if (message.includes("弱點貫穿")) runMetrics.weakPointTriggers += 1;
      if (message.includes("破陣重斬")) runMetrics.finishers += 1;
      if (category === "heal" && message.includes("浴血奮戰恢復")) {
        runMetrics.finisherHealing += Number(message.match(/恢復 (\d+)/)?.[1]) || 0;
      }
    }
  };
}

function resetBattleState(hero) {
  hero.poison = 0;
  hero.entangle = null;
  hero.saltErosion = null;
  hero.paralysis = null;
  hero.activeEnemyCount = 0;
  hero.battleAttackBonus = 0;
  hero.battleCritBonus = 0;
  hero.hasAttackedThisBattle = false;
  hero.weaponBattleStartApplied = false;
  hero.weaponBattleMode = null;
  hero.statusFamiliarityLimitBonus = 0;
  hero.victoryHealBonusRatio = 0;
  hero.shield = hero.shieldStart;
  hero.skillState = createSkillState();
  hero.modelPoisonedTargetsAtActionStart = new Set();
  resetBlessingBattleState(hero);
  initializeCharacterBattleState(hero);
}

function settleDefeatedEnemies(hero, enemies, settledEnemyIds, runMetrics) {
  enemies
    .filter((enemy) => enemy.hp <= 0 && !settledEnemyIds.has(enemy.runtimeId))
    .forEach((enemy) => {
      settledEnemyIds.add(enemy.runtimeId);
      if (hero.killAttackGain > 0) {
        hero.battleAttackBonus += hero.killAttackGain;
      }
      const before = hero.hp;
      const hpRatio = ratio(hero.hp, hero.maxHp);
      if (hpRatio < 0.5 && hero.lowHpKillHeal > 0) {
        healHero(hero, hero.lowHpKillHeal);
      }
      if (hero.killHeal > 0) {
        healHero(hero, hero.killHeal);
      }
      if (hero.killHealRatio > 0) {
        healHero(hero, Math.max(1, Math.round(hero.maxHp * hero.killHealRatio)));
      }
      if (hero.characterId === "kaige") {
        runMetrics.killHealing += Math.max(0, hero.hp - before);
      }
    });
}

function healHero(hero, amount) {
  if (hero.hp <= 0) return 0;
  const effectiveAmount = getHeroBattleHealingAmount(hero, amount, { minimum: 1 });
  const before = hero.hp;
  hero.hp = Math.min(hero.maxHp, hero.hp + effectiveAmount);
  return hero.hp - before;
}

function getKaigeActionSnapshot(hero) {
  if (hero.characterId !== "kaige") return null;
  const fury = Number(hero.skillState.kaige?.fury) || 0;
  return {
    finisherReady: hero.skills.includes("formation-breaking-cleave") && fury >= 3,
    bloodEligible: hero.skills.includes("blood-without-retreat")
      && hero.skills.includes("formation-breaking-cleave")
      && fury >= 3
      && hero.hp <= hero.maxHp * 0.25,
    fury
  };
}

function recordKaigeActionMetrics(hero, before, runMetrics) {
  if (!before) return;
  if (before.finisherReady && before.bloodEligible) {
    runMetrics.bloodWithoutRetreatEligible += 1;
    if ((Number(hero.skillState.kaige?.fury) || 0) >= 3) {
      runMetrics.bloodWithoutRetreatTriggers += 1;
    }
  }
}

function applyEnemyAmbushes(hero, enemies) {
  enemies.forEach((enemy) => {
    const amount = Math.max(0, Number(enemy.ambushDamage) || 0);
    if (amount > 0 && hero.hp > 1) {
      hero.hp -= Math.min(amount, hero.hp - 1);
    }
  });
}

function chooseBlessing({ pool, hero, characterId }) {
  const choices = getBlessingChoices(pool, 3);
  assert.ok(choices.length > 0, "正式地區沒有可供模型選擇的 Blessing。");
  return choices
    .map((blessing) => ({ blessing, score: scoreBlessing(blessing, hero, characterId) }))
    .sort((left, right) => right.score - left.score || left.blessing.id.localeCompare(right.blessing.id))[0].blessing;
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

function scoreBlessing(blessing, hero, characterId) {
  const flowWeights = {
    adventurer: { attack: 8, defense: 7.5, healing: 7, crit: 6.5, debuff: 5.5 },
    archer: { attack: 7.5, defense: 6.5, healing: 6, crit: 9, debuff: 8.5 },
    kaige: { attack: 9, defense: 6.5, healing: 8, crit: 5.5, debuff: 4.5 }
  };
  const flow = blessing.primaryFlow || blessing.category;
  const hpRatio = ratio(hero.hp, hero.maxHp);
  const missingHp = Math.max(0, hero.maxHp - hero.hp);
  let score = flowWeights[characterId]?.[flow] || 3;
  score += Math.max(0, Number(hero.blessingFlowMomentum?.[flow]) || 0) * 2;
  for (const effect of blessing.effects || []) {
    const amount = Number(effect.amount) || 0;
    if (effect.type === "recoverHp") score += Math.min(amount, missingHp) / 10;
    if (effect.type === "addTimedRegen" || effect.type === "addPeriodicRegen") score += hpRatio < 0.7 ? 3 : 1;
    if (effect.type === "addFamilyDamageBonus") score += amount * 20;
    if (effect.type === "add" && effect.stat === "attack") score += amount * 0.8;
    if (effect.type === "add" && effect.stat === "defense") score += amount;
    if (effect.type === "add" && effect.stat === "maxHp") score += amount / 8;
    if (effect.type === "add" && effect.stat === "shieldStart") score += amount / 5;
    if (effect.type === "add" && effect.stat === "shieldPerExtraEnemy") score += amount / 5;
    if (effect.type === "add" && effect.stat === "critChance") score += amount * (characterId === "archer" ? 30 : 24);
    if (effect.type === "add" && effect.stat === "poisonPower") score += amount * 1.4;
  }
  if (flow === "healing" && hpRatio < 0.6) score += 5;
  if (flow === "defense" && hpRatio < 0.5) score += 4;
  return score;
}

function createTotals() {
  return {
    wins: 0,
    deaths: 0,
    reached: 0,
    clearHeroHpRatio: 0,
    lossHeroHpRatio: 0,
    lossEnemyHpRatio: 0,
    statusExposureTurns: 0,
    clearBlessings: 0,
    lossBlessings: 0,
    blessingsAcquired: 0,
    satchelApplications: 0,
    poisonArrowApplications: 0,
    weakPointEligible: 0,
    weakPointTriggers: 0,
    archerOriginalShots: 0,
    finishers: 0,
    finisherHealing: 0,
    killHealing: 0,
    bloodWithoutRetreatEligible: 0,
    bloodWithoutRetreatTriggers: 0,
    stageReach: Object.fromEntries(STAGE_NAMES.map((stage) => [stage, 0])),
    stageLosses: Object.fromEntries(STAGE_NAMES.map((stage) => [stage, 0])),
    lossByEncounter: {}
  };
}

function createRunMetrics() {
  return {
    statusExposureTurns: 0,
    satchelApplications: 0,
    poisonArrowApplications: 0,
    weakPointEligible: 0,
    weakPointTriggers: 0,
    archerOriginalShots: 0,
    finishers: 0,
    finisherHealing: 0,
    killHealing: 0,
    bloodWithoutRetreatEligible: 0,
    bloodWithoutRetreatTriggers: 0,
    blessingsAcquired: 0
  };
}

function countActiveStatuses(hero, enemies) {
  const heroStatuses = [hero.poison > 0, hero.entangle, hero.saltErosion, hero.paralysis]
    .filter(Boolean).length;
  const enemyStatuses = enemies.reduce((total, enemy) => total + (enemy.poison > 0 ? 1 : 0), 0);
  return heroStatuses + enemyStatuses;
}

function getEnemyGroupHpRatio(enemies) {
  const totals = enemies.reduce((result, enemy) => ({
    hp: result.hp + Math.max(0, enemy.hp),
    maxHp: result.maxHp + Math.max(1, enemy.maxHp)
  }), { hp: 0, maxHp: 0 });
  return totals.maxHp > 0 ? totals.hp / totals.maxHp : 0;
}

function getEncounterType(entry) {
  return typeof entry === "string" ? entry : entry?.type;
}

function getStageThresholds(encounterCount) {
  return {
    early: 1,
    mid: Math.max(1, Math.ceil(encounterCount / 3)),
    late: Math.max(1, Math.ceil(encounterCount * 2 / 3)),
    boss: encounterCount
  };
}

function getFailureStage(encounterNumber, encounterCount) {
  const thresholds = getStageThresholds(encounterCount);
  if (encounterNumber < thresholds.mid) return "early";
  if (encounterNumber < thresholds.late) return "mid";
  if (encounterNumber < thresholds.boss) return "late";
  return "boss";
}

function ratio(value, max) {
  return max > 0 ? Math.max(0, Number(value) || 0) / max : 0;
}

function validateResults(allResults) {
  assert.equal(allResults.length, regionEntries.length * CHARACTER_IDS.length * BUILD_IDS.length * LEVELS.length);
  allResults.forEach((result) => {
    assert.equal(result.rounds, ROUNDS);
    assert.equal(result.deaths + result.wins, ROUNDS);
    assert.ok(result.winRatio >= 0 && result.winRatio <= 1);
    assert.ok(result.bossReachRatio >= 0 && result.bossReachRatio <= 1);
    assert.ok(Number.isFinite(result.averageReached));
    assert.ok(Number.isFinite(result.averageStatusExposureTurns));
    assert.ok(Object.keys(result.stageReachRatios).length === 4);
    assert.ok(Object.values(result.stageReachRatios).every((value) => value >= 0 && value <= 1));
  });
}

function printResults(allResults) {
  console.log(`v0.2.7.4 Runtime 隔離模型：${ROUNDS} rounds／組合；結果僅為隔離模型勝場比例。`);
  console.log("同一地區／職業／Build 的 Lv.25 與 Lv.30 使用同一固定種子，未以模型結果回調正式數值。\n");
  for (const { id: regionId, label: regionLabel } of regionEntries) {
    for (const characterId of CHARACTER_IDS) {
      for (const buildId of BUILD_IDS) {
        const pair = allResults.filter((result) => (
          result.regionId === regionId
          && result.characterId === characterId
          && result.buildId === buildId
        ));
        const lv25 = pair.find((result) => result.level === 25);
        const lv30 = pair.find((result) => result.level === 30);
        const delta = lv30.winRatio - lv25.winRatio;
        console.log(
          `${regionLabel}｜${lv25.characterName}｜${lv25.buildLabel}`
          + `｜Lv25 ${formatPercent(lv25.winRatio)} ${lv25.wins}/${lv25.rounds}`
          + `｜Lv30 ${formatPercent(lv30.winRatio)} ${lv30.wins}/${lv30.rounds}`
          + `｜Δ ${delta >= 0 ? "+" : ""}${(delta * 100).toFixed(2)}pp`
          + `｜Boss到達 ${formatPercent(lv25.bossReachRatio)}→${formatPercent(lv30.bossReachRatio)}`
          + `｜狀態暴露 ${lv25.averageStatusExposureTurns.toFixed(2)}→${lv30.averageStatusExposureTurns.toFixed(2)}`
        );
      }
    }
  }
  console.log("\n角色特殊指標（每場平均；僅作隔離模型觀測）：");
  allResults.filter((result) => result.level === 30).forEach((result) => {
    const metrics = result.specialMetrics;
    console.log(
      `${result.regionLabel}｜${result.characterName}｜${result.buildLabel}`
      + `｜satchel ${metrics.satchelApplicationsPerRun.toFixed(2)}`
      + `｜weak-point ${metrics.weakPointTriggersPerRun.toFixed(2)}`
      + `｜finisher ${metrics.finishersPerRun.toFixed(2)}`
      + `｜finisherHeal ${metrics.finisherHealingPerRun.toFixed(2)}`
      + `｜killHeal ${metrics.killHealingPerRun.toFixed(2)}`
      + `｜blood-without-retreat ${metrics.bloodWithoutRetreatTriggersPerRun.toFixed(2)}`
    );
  });
}
