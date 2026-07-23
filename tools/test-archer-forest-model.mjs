import assert from "node:assert/strict";

import { applyBlessingEffects } from "../src/core/blessings.js";
import {
  applyEnemyEndOfTurnNegativeEffects,
  applyEnemyEndOfTurnRecoveryEffects,
  applyHeroEndOfTurnNegativeEffects,
  applyHeroEndOfTurnRecoveryEffects,
  buildEnemy,
  resolveEnemyAction,
  resolveHeroEntangle
} from "../src/core/combat.js";
import { buildHeroFromProgression, createSkillState } from "../src/core/progression.js";
import { characterDefinitions } from "../src/data/characters/index.js";
import { forestRegion } from "../src/data/regions/forest.js";
import { getBlessingRarity } from "../src/data/rarities.js";
import {
  initializeCharacterBattleState,
  modifyCharacterIncomingDirectDamage,
  resolveCharacterPlayerAction
} from "../src/characters/skills/index.js";
import { createSeededRandom, weightedPick } from "./model-test-helpers.mjs";

const ROUNDS = Math.max(1, Number(process.argv[2]) || 20000);
const MAX_TURNS = 500;
const logger = {
  template() {},
  fixed() {}
};

const originalRandom = Math.random;
Math.random = createSeededRandom(0x23400425);

try {
  const result = simulateForestRuns(ROUNDS);
  const winRatio = result.wins / result.rounds;
  console.log(`Archer Lv.25 formal runtime forest model: ${(winRatio * 100).toFixed(2)}% (${result.wins}/${result.rounds})`);
  console.log(`Average reached encounter: ${result.averageReached.toFixed(2)} / 16`);
  console.log("Defeats by encounter:", formatDefeats(result.defeatsByEncounter));
  if (ROUNDS >= 20000) {
    assert.ok(winRatio >= 0.7 && winRatio <= 0.8, "Lv.25 合理 Build 完整森林模型勝場比例應落在 70%～80%");
  }
} finally {
  Math.random = originalRandom;
}

function simulateForestRuns(rounds) {
  let wins = 0;
  let reachedTotal = 0;
  const defeatsByEncounter = new Map();

  for (let run = 0; run < rounds; run += 1) {
    const hero = buildHeroFromProgression(characterDefinitions.archer, {
      level: 25,
      exp: 0,
      learnedSkills: []
    });
    const bosses = forestRegion.bosses || [forestRegion.boss];
    const selectedBoss = weightedPick(bosses, (boss) => Number(boss.weight) || 100);
    let reached = 0;
    let cleared = true;

    for (let encounterIndex = 0; encounterIndex < forestRegion.encounterPlan.length; encounterIndex += 1) {
      reached = encounterIndex + 1;
      resetBattleState(hero);
      const enemy = buildEnemy(forestRegion, encounterIndex, hero, { boss: selectedBoss });
      enemy.poison = 0;
      applyEnemyAmbush(hero, enemy);
      const won = simulateEncounter(hero, enemy);
      if (!won) {
        cleared = false;
        defeatsByEncounter.set(reached, (defeatsByEncounter.get(reached) || 0) + 1);
        break;
      }

      applyKillRecovery(hero);
      consumeBattleLimitedEffects(hero);
      if (encounterIndex < forestRegion.encounterPlan.length - 1) {
        const choices = getBlessingChoices(forestRegion.blessings, 3);
        const blessing = chooseReasonableArcherBlessing(choices, hero, encounterIndex);
        applyBlessingEffects(hero, blessing);
        hero.blessings.push(blessing.name);
      }
    }

    reachedTotal += reached;
    if (cleared) {
      wins += 1;
    }
  }

  return {
    rounds,
    wins,
    averageReached: reachedTotal / rounds,
    defeatsByEncounter
  };
}

function simulateEncounter(hero, enemy) {
  const runtimeEnemy = {
    ...enemy,
    runtimeId: "enemy-1",
    displayName: enemy.name
  };
  const enemies = [runtimeEnemy];

  for (let turn = 1; turn <= MAX_TURNS; turn += 1) {
    const heroEntangled = resolveHeroEntangle({ hero, log: logger });
    if (!heroEntangled) {
      resolveCharacterPlayerAction({
        hero,
        enemies,
        targetEnemyId: runtimeEnemy.runtimeId,
        log: logger
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
      modifyDirectDamage: modifyCharacterIncomingDirectDamage
    });
    void enemyAction;
    if (hero.hp <= 0) {
      return false;
    }

    const endOfTurn = applyHeroEndOfTurnNegativeEffects({ hero, log: logger });
    applyEnemyEndOfTurnNegativeEffects({ enemy: runtimeEnemy, log: logger });
    applyHeroEndOfTurnRecoveryEffects({ hero, turn, log: logger });
    applyEnemyEndOfTurnRecoveryEffects({ enemy: runtimeEnemy, turn, log: logger });
    if (hero.hp <= 0) {
      void endOfTurn;
      return false;
    }
    if (runtimeEnemy.hp <= 0) {
      return true;
    }
  }
  throw new Error("森林模型單場戰鬥超過最大回合數，可能存在時序或平衡錯誤。");
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

function applyEnemyAmbush(hero, enemy) {
  const amount = Number(enemy.ambushDamage) || 0;
  if (amount <= 0 || hero.hp <= 1) {
    return;
  }
  hero.hp -= Math.min(amount, hero.hp - 1);
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

function chooseReasonableArcherBlessing(choices, hero, encounterIndex) {
  return choices
    .map((blessing) => ({ blessing, score: scoreBlessing(blessing, hero, encounterIndex) }))
    .sort((a, b) => b.score - a.score || a.blessing.id.localeCompare(b.blessing.id))[0].blessing;
}

function scoreBlessing(blessing, hero, encounterIndex) {
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

function formatDefeats(defeatsByEncounter) {
  return [...defeatsByEncounter.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([encounter, count]) => `${encounter}:${count}`)
    .join(", ");
}
