import assert from "node:assert/strict";

import { resolveEnemyAction, resolveHeroAction } from "../src/core/combat.js";
import { buildHeroFromProgression } from "../src/core/progression.js";
import { characterDefinitions } from "../src/data/characters/index.js";
import { createBattleSkills } from "../src/features/battle/battleSkills.js";

const originalRandom = Math.random;

function sequenceRandom(values) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)] ?? 0.99;
}

function createLogger() {
  return {
    template() {},
    fixed() {}
  };
}

function createAdventurer(level) {
  return buildHeroFromProgression(characterDefinitions.adventurer, {
    level,
    exp: 0,
    learnedSkills: []
  });
}

function createBattleSkillHarness(hero) {
  return createBattleSkills({
    state: { hero },
    hasHeroSkill(skillId) {
      return hero.skills.includes(skillId);
    },
    addLog() {},
    addFixedLog() {},
    lastBagFlowWeightMultiplier: 0.6
  });
}

try {
  {
    const hero = createAdventurer(18);
    hero.attack = 20;
    hero.critChance = 0;
    hero.openingCritChance = 0;
    const enemy = {
      id: "training-target",
      name: "訓練假人",
      maxHp: 1000,
      hp: 1000,
      defense: 0,
      dodgeChance: 0,
      poison: 0
    };
    Math.random = sequenceRandom([0.99, 0.99, 0.39]);
    resolveHeroAction({ hero, enemy, log: createLogger() });
    assert.equal(
      enemy.hp,
      966,
      "破綻判斷強化應讓熟練追擊以 40% 機率造成攻擊 70% 的追加傷害"
    );
  }

  {
    const hero = {
      name: "冒險者",
      maxHp: 100,
      hp: 100,
      defense: 0,
      shield: 0,
      skills: ["steady-stance-plus"]
    };
    const enemy = {
      id: "test-enemy",
      name: "測試敵人",
      attack: 100,
      critChance: 0
    };
    Math.random = sequenceRandom([0.99, 0.34]);
    resolveEnemyAction({ hero, enemy, turn: 1, log: createLogger() });
    assert.equal(hero.hp, 40, "穩定架勢強化應以 35% 機率降低本次直接攻擊傷害 40%");
  }

  {
    const hero = {
      name: "冒險者",
      maxHp: 100,
      hp: 0,
      skills: ["last-stand", "expedition-pace"],
      skillState: { lastStandUsed: false },
      blessingFlows: []
    };
    const battleSkills = createBattleSkillHarness(hero);
    assert.equal(battleSkills.tryLastStand(), true);
    assert.equal(hero.hp, 26, "遠征步調應把死地求生恢復量提高至最大生命 25%");
  }

  {
    const hero = {
      name: "冒險者",
      maxHp: 100,
      hp: 50,
      skills: ["adventurer-pace", "expedition-pace"],
      skillState: {},
      blessingFlows: [],
      victoryHealBonusRatio: 0
    };
    const battleSkills = createBattleSkillHarness(hero);
    battleSkills.applyVictorySkills();
    assert.equal(hero.hp, 70, "遠征步調應在勝利後恢復最大生命 20%");
  }

  {
    const hero = {
      name: "冒險者",
      maxHp: 100,
      hp: 100,
      skills: ["status-familiarity"],
      skillState: {},
      blessingFlows: [],
      battleAttackBonus: 0
    };
    const battleSkills = createBattleSkillHarness(hero);
    battleSkills.applyBattleStartSkills();
    assert.equal(hero.battleAttackBonus, 2, "沒有負面狀態流派時，狀態熟悉應提供攻擊 +2");
  }

  console.log("Adventurer combat isolation tests passed.");
} finally {
  Math.random = originalRandom;
}
