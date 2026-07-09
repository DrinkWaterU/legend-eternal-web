import assert from "node:assert/strict";

import { resolveEnemyAction } from "../src/core/combat.js";
import { buildHeroFromProgression } from "../src/core/progression.js";
import { createRuntimeEnemyGroup } from "../src/core/enemyGroups.js";
import { characterDefinitions } from "../src/data/characters/index.js";
import {
  initializeCharacterBattleState,
  modifyCharacterIncomingDirectDamage,
  resolveCharacterPlayerAction
} from "../src/characters/skills/index.js";

const originalRandom = Math.random;

function createLogger() {
  const entries = [];
  return {
    entries,
    template(type, templateId, values = {}) {
      entries.push({ type, templateId, values, text: templateId });
    },
    fixed(type, text) {
      entries.push({ type, text });
    }
  };
}

function createArcher(level) {
  const hero = buildHeroFromProgression(characterDefinitions.archer, {
    level,
    exp: 0,
    learnedSkills: []
  });
  initializeCharacterBattleState(hero);
  return hero;
}

function createEnemy(overrides = {}) {
  return {
    id: overrides.id || "test-enemy",
    name: overrides.name || "測試敵人",
    kind: overrides.kind || "普通",
    family: overrides.family || "test",
    maxHp: overrides.maxHp ?? 200,
    hp: overrides.hp ?? overrides.maxHp ?? 200,
    attack: overrides.attack ?? 10,
    defense: overrides.defense ?? 0,
    critChance: overrides.critChance ?? 0,
    dodgeChance: overrides.dodgeChance ?? 0,
    poisonPower: overrides.poisonPower ?? 0,
    entangleChance: overrides.entangleChance ?? 0,
    poison: overrides.poison ?? 0
  };
}

function fire(hero, enemies, targetEnemyId, log) {
  return resolveCharacterPlayerAction({ hero, enemies, targetEnemyId, log });
}

try {
  {
    const hero = createArcher(6);
    hero.critChance = 0;
    const enemies = createRuntimeEnemyGroup([createEnemy({ dodgeChance: 1 })]);
    const log = createLogger();
    Math.random = () => 0.99;
    fire(hero, enemies, enemies[0].runtimeId, log);
    fire(hero, enemies, enemies[0].runtimeId, log);
    fire(hero, enemies, enemies[0].runtimeId, log);
    assert.equal(
      log.entries.filter((entry) => entry.text?.includes("精準一箭")).length,
      1,
      "第 3 次射擊即使被閃避仍應消耗精準射擊節點"
    );
  }

  {
    const hero = createArcher(10);
    hero.critChance = 0;
    const enemies = createRuntimeEnemyGroup([
      createEnemy({ id: "a", name: "敵人 A", dodgeChance: 1, hp: 100, maxHp: 100 }),
      createEnemy({ id: "b", name: "敵人 B", dodgeChance: 0, hp: 100, maxHp: 100 })
    ]);
    const log = createLogger();
    Math.random = () => 0.99;
    for (let index = 0; index < 4; index += 1) {
      fire(hero, enemies, enemies[0].runtimeId, log);
    }
    assert.ok(enemies[0].hp < 100, "第 4 次被閃避射擊仍應讓箭雨命中原目標");
    assert.ok(enemies[1].hp < 100, "第 4 次被閃避射擊仍應讓箭雨命中其他存活敵人");
  }

  {
    const hero = createArcher(10);
    hero.critChance = 0;
    hero.attack = 12;
    const enemies = createRuntimeEnemyGroup([
      createEnemy({ id: "a", name: "敵人 A", hp: 100, maxHp: 100 }),
      createEnemy({ id: "b", name: "敵人 B", hp: 100, maxHp: 100 })
    ]);
    const log = createLogger();
    Math.random = () => 0.99;
    fire(hero, enemies, enemies[0].runtimeId, log);
    fire(hero, enemies, enemies[0].runtimeId, log);
    fire(hero, enemies, enemies[0].runtimeId, log);
    enemies[0].hp = 1;
    fire(hero, enemies, enemies[0].runtimeId, log);
    assert.equal(enemies[0].hp, 0, "觸發箭應先擊殺原目標");
    assert.ok(enemies[1].hp < 100, "觸發箭擊殺原目標後，箭雨仍應攻擊其他存活敵人");
  }

  {
    const hero = createArcher(25);
    hero.critChance = 1;
    hero.attack = 1;
    const enemies = createRuntimeEnemyGroup([createEnemy({ hp: 1000, maxHp: 1000, defense: 0 })]);
    const log = createLogger();
    Math.random = () => 0;
    fire(hero, enemies, enemies[0].runtimeId, log);
    const directHits = log.entries.filter((entry) => entry.templateId === "heroDamage");
    assert.equal(directHits.length, 3, "致命節奏最多只能形成原始攻擊、第一次追擊、第二次追擊共 3 次射擊");
  }

  {
    const hero = createArcher(20);
    const enemy = createEnemy({ attack: 50, poisonPower: 6 });
    const log = createLogger();
    Math.random = () => 0.99;
    const hpBefore = hero.hp;
    resolveEnemyAction({
      hero,
      enemy,
      turn: 1,
      log,
      modifyDirectDamage: modifyCharacterIncomingDirectDamage
    });
    assert.equal(hero.hp, hpBefore - 1, "距離掌控應將敵人直接攻擊傷害降至 1 點");
    assert.equal(hero.poison, 6, "距離掌控不是閃避，敵人附帶中毒仍應正常生效");
    assert.equal(hero.skillState.archer.keepDistanceCharges, 2, "距離掌控應從 3 次保持距離中消耗 1 次");
  }

  console.log("Archer combat isolation tests passed.");
} finally {
  Math.random = originalRandom;
}
