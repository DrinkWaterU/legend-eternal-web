import assert from "node:assert/strict";

import { applyBlessingEffects } from "../src/core/blessings.js";
import { canCharacterEquipWeapon } from "../src/core/equipment.js";
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
import { characterDefinitions } from "../src/data/characters/index.js";
import { forestRegion } from "../src/data/regions/forest.js";
import { plainsRegion } from "../src/data/regions/plains.js";
import { getBlessingRarity } from "../src/data/rarities.js";
import { weaponDefinitions } from "../src/data/weapons.js";
import {
  initializeCharacterBattleState,
  modifyCharacterIncomingDirectDamage,
  resolveCharacterPlayerAction
} from "../src/characters/skills/index.js";
import { createBattleSkills } from "../src/features/battle/battleSkills.js";
import { applyEquippedWeaponBattleStart } from "../src/core/weaponBattleEffects.js";
import { weightedPick, withSeed } from "./model-test-helpers.mjs";

const ROUNDS = Math.max(1, Number(process.argv[2]) || 5000);
const INCLUDE_ADVENTURER_RARE_PROTOTYPES = process.argv[3] === "adventurer-rare-prototypes";
const INCLUDE_V02721_WEAPON_PROTOTYPES = process.argv[3] === "v02721-weapon-prototypes";
const MAX_TURNS = 500;
const logger = {
  template() {},
  fixed() {}
};
const ADVENTURER_RARE_PROTOTYPES = Object.freeze({
  "rare-guarded": Object.freeze({
    label: "稀有劍・守勢",
    attack: 2,
    singleEnemyCritBonus: 0.08,
    multiEnemyShield: 8,
    lowHpShield: 12
  }),
  "rare-balanced": Object.freeze({
    label: "稀有劍・平衡",
    attack: 2,
    singleEnemyAttackBonus: 1,
    multiEnemyShield: 8,
    lowHpShield: 10
  }),
  "rare-offensive": Object.freeze({
    label: "稀有劍・進取",
    attack: 2,
    singleEnemyAttackBonus: 1,
    singleEnemyCritBonus: 0.05,
    multiEnemyShield: 6,
    lowHpShield: 8
  })
});
if (INCLUDE_ADVENTURER_RARE_PROTOTYPES) {
  validateAdventurerRarePrototypeContracts();
}
if (INCLUDE_V02721_WEAPON_PROTOTYPES) {
  validateV02721WeaponPrototypeContracts();
}

const modelGroups = [
  {
    title: "Plains Lv.10 adventurer weapon model",
    seed: 0x24001010,
    region: plainsRegion,
    characterId: "adventurer",
    level: 10,
    chooseBlessing: chooseReasonableAdventurerBlessing,
    cases: withV02721WeaponPrototypes(withAdventurerRarePrototypes([
      { weaponId: null, label: "未裝備" },
      { weaponId: "iron-longsword", label: "鐵製長劍" },
      { weaponId: "guard-short-sword", label: "守備短劍" },
      { weaponId: "hunter-shortbow", label: "獵人短弓" },
      { weaponId: "vanguard-hunting-bow", label: "先鋒獵弓" },
      { weaponId: "bloodbone-guardian-mace", label: "血骨衛士鎚" },
      { weaponId: "spider-silk-stinger-dagger", label: "蛛絲刺匕" }
    ]), "adventurer")
  },
  {
    title: "Forest Lv.25 adventurer weapon model",
    seed: 0x24501051,
    region: forestRegion,
    characterId: "adventurer",
    level: 25,
    chooseBlessing: chooseReasonableAdventurerBlessing,
    cases: withV02721WeaponPrototypes(withAdventurerRarePrototypes([
      { weaponId: null, label: "未裝備" },
      { weaponId: "iron-longsword", label: "鐵製長劍" },
      { weaponId: "guard-short-sword", label: "守備短劍" },
      { weaponId: "hunter-shortbow", label: "獵人短弓" },
      { weaponId: "vanguard-hunting-bow", label: "先鋒獵弓" },
      { weaponId: "bloodbone-guardian-mace", label: "血骨衛士鎚" },
      { weaponId: "spider-silk-stinger-dagger", label: "蛛絲刺匕" }
    ]), "adventurer")
  },
  {
    title: "Forest Lv.25 archer weapon model",
    seed: 0x23400425,
    region: forestRegion,
    characterId: "archer",
    level: 25,
    chooseBlessing: chooseReasonableArcherBlessing,
    cases: withV02721WeaponPrototypes([
      { weaponId: null, label: "未裝備" },
      { weaponId: "hunter-shortbow", label: "獵人短弓" },
      { weaponId: "vanguard-hunting-bow", label: "先鋒獵弓" },
      { weaponId: "verdant-pursuit-bow", label: "翠影追擊弓" },
      { weaponId: "ancient-wood-eroding-bow", label: "古木蝕甲弓" }
    ], "archer")
  }
];

for (const group of modelGroups) {
  const entries = group.cases.map((entry) => ({
    ...entry,
    result: withSeed(group.seed, () => simulateRegionRuns({
      rounds: ROUNDS,
      region: group.region,
      characterId: group.characterId,
      level: group.level,
      weaponId: entry.weaponId,
      prototypeId: entry.prototypeId,
      chooseBlessing: group.chooseBlessing
    }))
  }));
  printResults(group.title, entries, group.region.encounterPlan.length);
  validateResults(group, entries);
}

console.log("Equipped weapon formal runtime balance comparison passed.");

function simulateRegionRuns({ rounds, region, characterId, level, weaponId, prototypeId, chooseBlessing }) {
  let wins = 0;
  let reachedTotal = 0;
  const defeatsByEncounter = new Map();

  for (let run = 0; run < rounds; run += 1) {
    const hero = buildEquippedHero(characterId, level, weaponId, prototypeId);
    const bosses = region.bosses || [region.boss];
    const selectedBoss = weightedPick(bosses, (boss) => Number(boss.weight) || 100);
    let reached = 0;
    let cleared = true;

    for (let encounterIndex = 0; encounterIndex < region.encounterPlan.length; encounterIndex += 1) {
      reached = encounterIndex + 1;
      resetBattleState(hero);
      const battleSkills = createModelBattleSkills(hero);
      battleSkills.applyBattleStartSkills();
      applyAdventurerRarePrototype(hero, prototypeId, { enemyCount: 1 });
      applyEquippedWeaponBattleStart(hero, {
        enemyCount: 1,
        encounterType: encounterIndex === region.encounterPlan.length - 1 ? "boss" : "normal"
      });
      const enemy = buildEnemy(region, encounterIndex, hero, { boss: selectedBoss });
      enemy.poison = 0;
      applyEnemyAmbush(hero, enemy);
      const won = simulateEncounter(hero, enemy, battleSkills);
      if (!won) {
        cleared = false;
        defeatsByEncounter.set(reached, (defeatsByEncounter.get(reached) || 0) + 1);
        break;
      }

      applyKillRecovery(hero);
      battleSkills.applyVictorySkills();
      consumeBattleLimitedEffects(hero);
      if (encounterIndex < region.encounterPlan.length - 1) {
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
  }

  return {
    rounds,
    wins,
    averageReached: reachedTotal / rounds,
    defeatsByEncounter
  };
}

function buildEquippedHero(characterId, level, weaponId, prototypeId = null) {
  const hero = buildHeroFromProgression(characterDefinitions[characterId], {
    level,
    exp: 0,
    learnedSkills: [],
    equipment: { weaponId }
  }, {
    inventory: {
      weapons: weaponId ? { [weaponId]: true } : {}
    },
    weaponDefinitions
  });
  const rarePrototype = ADVENTURER_RARE_PROTOTYPES[prototypeId];
  if (rarePrototype) {
    assert.equal(characterId, "adventurer", "稀有武器原型只能套用於冒險者模型");
    hero.attack += rarePrototype.attack;
    hero.equipment = { weaponId: prototypeId };
  }
  return hero;
}

function applyAdventurerRarePrototype(hero, prototypeId, { enemyCount }) {
  const prototype = ADVENTURER_RARE_PROTOTYPES[prototypeId];
  if (!prototype) {
    return null;
  }
  assert.equal(hero.characterId, "adventurer", "稀有武器原型不得套用於其他角色");

  const hpRatio = hero.maxHp > 0 ? hero.hp / hero.maxHp : 0;
  if (hpRatio <= 0.5) {
    hero.shield += prototype.lowHpShield;
    return "low-hp";
  }
  if (enemyCount >= 2) {
    hero.shield += prototype.multiEnemyShield;
    return "multi-enemy";
  }
  hero.battleAttackBonus += prototype.singleEnemyAttackBonus || 0;
  hero.battleCritBonus += prototype.singleEnemyCritBonus || 0;
  return "single-enemy";
}

function withAdventurerRarePrototypes(cases) {
  if (!INCLUDE_ADVENTURER_RARE_PROTOTYPES) {
    return cases;
  }
  return [
    ...cases,
    ...Object.entries(ADVENTURER_RARE_PROTOTYPES).map(([prototypeId, prototype]) => ({
      prototypeId,
      label: prototype.label
    }))
  ];
}

function withV02721WeaponPrototypes(cases, characterId) {
  if (!INCLUDE_V02721_WEAPON_PROTOTYPES) {
    return cases;
  }
  return [
    ...cases,
    ...Object.values(weaponDefinitions)
      .filter((weapon) => [
        "adventurer-pathfinder-sword",
        "tidepiercer-shortbow",
        "reefbreaker-warhammer",
        "brinefang-dagger"
      ].includes(weapon.id))
      .filter((weapon) => canCharacterEquipWeapon(characterDefinitions[characterId], weapon))
      .map((weapon) => ({
        weaponId: weapon.id,
        label: weapon.name
      }))
  ];
}

function validateV02721WeaponPrototypeContracts() {
  const createHero = (overrides = {}) => ({
    characterId: "adventurer",
    equipment: { weaponId: "adventurer-pathfinder-sword" },
    maxHp: 100,
    hp: 100,
    shield: 0,
    battleAttackBonus: 0,
    battleCritBonus: 0,
    ...overrides
  });

  const swordSingleHero = createHero();
  assert.equal(
    applyEquippedWeaponBattleStart(swordSingleHero, { enemyCount: 1 })?.modeId,
    "single-enemy"
  );
  assert.equal(swordSingleHero.battleAttackBonus, 1);
  assert.equal(swordSingleHero.battleCritBonus, 0.08);

  const swordBossHero = createHero();
  assert.equal(
    applyEquippedWeaponBattleStart(swordBossHero, { enemyCount: 1, encounterType: "boss" })?.modeId,
    "boss"
  );
  assert.equal(swordBossHero.shield, 20);
  assert.equal(swordBossHero.battleAttackBonus, 2);
  assert.equal(swordBossHero.battleCritBonus, 0.08);

  const swordLowHpHero = createHero({ hp: 50 });
  assert.equal(
    applyEquippedWeaponBattleStart(swordLowHpHero, { enemyCount: 3 })?.modeId,
    "low-hp"
  );
  assert.equal(swordLowHpHero.battleAttackBonus, 1);
  assert.equal(swordLowHpHero.shield, 16);

  assert.equal(
    applyEquippedWeaponBattleStart(createHero({ characterId: "future-sword-user" }), { enemyCount: 1 }),
    null
  );
}

function validateAdventurerRarePrototypeContracts() {
  const createHero = (overrides = {}) => ({
    characterId: "adventurer",
    maxHp: 100,
    hp: 100,
    shield: 0,
    battleAttackBonus: 0,
    battleCritBonus: 0,
    ...overrides
  });

  const singleHero = createHero();
  assert.equal(
    applyAdventurerRarePrototype(singleHero, "rare-balanced", { enemyCount: 1 }),
    "single-enemy"
  );
  assert.equal(singleHero.battleAttackBonus, 1);
  assert.equal(singleHero.shield, 0);

  const multiHero = createHero();
  assert.equal(
    applyAdventurerRarePrototype(multiHero, "rare-balanced", { enemyCount: 3 }),
    "multi-enemy"
  );
  assert.equal(multiHero.battleAttackBonus, 0);
  assert.equal(multiHero.shield, 8);

  const lowHpHero = createHero({ hp: 50 });
  assert.equal(
    applyAdventurerRarePrototype(lowHpHero, "rare-balanced", { enemyCount: 3 }),
    "low-hp"
  );
  assert.equal(lowHpHero.battleAttackBonus, 0);
  assert.equal(lowHpHero.shield, 10);

  assert.throws(
    () => applyAdventurerRarePrototype(
      createHero({ characterId: "future-sword-user" }),
      "rare-balanced",
      { enemyCount: 1 }
    ),
    /不得套用於其他角色/
  );
}

function simulateEncounter(hero, enemy, battleSkills) {
  const runtimeEnemy = {
    ...enemy,
    runtimeId: "enemy-1",
    displayName: enemy.name
  };
  const enemies = [runtimeEnemy];

  for (let turn = 1; turn <= MAX_TURNS; turn += 1) {
    const heroEntangled = resolveHeroEntangle({ hero, log: logger });
    if (!heroEntangled) {
      const characterAction = resolveCharacterPlayerAction({
        hero,
        enemies,
        targetEnemyId: runtimeEnemy.runtimeId,
        log: logger
      });
      if (!characterAction.handled) {
        resolveHeroAction({ hero, enemy: runtimeEnemy, log: logger });
      }
      if (runtimeEnemy.hp <= 0) {
        return true;
      }
    }

    resolveEnemyAction({
      hero,
      enemy: runtimeEnemy,
      turn,
      log: logger,
      modifyDirectDamage: modifyCharacterIncomingDirectDamage
    });
    applyEmergencyBandage(hero);
    if (hero.hp <= 0 && !battleSkills.tryLastStand()) {
      return false;
    }

    applyHeroEndOfTurnNegativeEffects({ hero, log: logger });
    applyEnemyEndOfTurnNegativeEffects({ enemy: runtimeEnemy, log: logger });
    applyHeroEndOfTurnRecoveryEffects({ hero, turn, log: logger });
    applyEnemyEndOfTurnRecoveryEffects({ enemy: runtimeEnemy, turn, log: logger });
    if (hero.hp <= 0 && !battleSkills.tryLastStand()) {
      return false;
    }
    if (runtimeEnemy.hp <= 0) {
      return true;
    }
  }

  throw new Error("武器模型單場戰鬥超過最大回合數，可能存在時序或平衡錯誤。");
}

function resetBattleState(hero) {
  hero.poison = 0;
  hero.entangle = null;
  hero.battleAttackBonus = 0;
  hero.battleCritBonus = 0;
  hero.hasAttackedThisBattle = false;
  hero.weaponBattleStartApplied = false;
  hero.weaponBattleMode = null;
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

function chooseReasonableAdventurerBlessing(choices, hero) {
  return choices
    .map((blessing) => ({ blessing, score: scoreAdventurerBlessing(blessing, hero) }))
    .sort((left, right) => right.score - left.score || left.blessing.id.localeCompare(right.blessing.id))[0].blessing;
}

function scoreAdventurerBlessing(blessing, hero) {
  const hpRatio = hero.maxHp > 0 ? hero.hp / hero.maxHp : 0;
  const missingHp = Math.max(0, hero.maxHp - hero.hp);
  const flow = blessing.primaryFlow;
  const roleBase = { attack: 8, defense: 7, healing: 6.5, crit: 6, debuff: 4 };
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

function chooseReasonableArcherBlessing(choices, hero) {
  return choices
    .map((blessing) => ({ blessing, score: scoreArcherBlessing(blessing, hero) }))
    .sort((left, right) => right.score - left.score || left.blessing.id.localeCompare(right.blessing.id))[0].blessing;
}

function scoreArcherBlessing(blessing, hero) {
  const hpRatio = hero.maxHp > 0 ? hero.hp / hero.maxHp : 0;
  const missingHp = Math.max(0, hero.maxHp - hero.hp);
  const flow = blessing.primaryFlow;
  const roleBase = { crit: 9, debuff: 8, attack: 7.5, defense: 5.5, healing: 5 };
  const momentum = Math.max(0, Number(hero.blessingFlowMomentum?.[flow]) || 0);
  let score = roleBase[flow] || 3;
  score += momentum * 2;

  if (flow === "healing") {
    score += Math.min(6, missingHp / 28);
    if (hpRatio < 0.7) score += 5;
    if (hpRatio < 0.45) score += 10;
  }
  if (flow === "defense" && hpRatio < 0.65) score += 3;
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

function hasSkill(hero, skillId) {
  return Array.isArray(hero?.skills) && hero.skills.includes(skillId);
}

function validateResults(group, entries) {
  entries.forEach(({ result, label }) => {
    const ratio = result.wins / result.rounds;
    assert.ok(ratio >= 0 && ratio <= 1, `${group.title} ${label} 模型比例必須有效`);
    assert.ok(result.averageReached >= 1 && result.averageReached <= group.region.encounterPlan.length);
  });

  const baseline = entries[0].result.wins / entries[0].result.rounds;
  if (ROUNDS >= 5000) {
    entries.slice(1).forEach(({ label, result }) => {
      assert.ok(
        result.wins / result.rounds > baseline,
        `${group.title} ${label} 應提供可觀察的永久武器增幅`
      );
    });
  }
  if (ROUNDS >= 5000 && group.region.id === "plains" && group.characterId === "adventurer") {
    assert.ok(baseline >= 0.45 && baseline <= 0.58, "Lv.10 冒險者平原 baseline 應維持可開始通關區間");
  }
  if (ROUNDS >= 5000 && group.region.id === "forest" && group.characterId === "adventurer") {
    assert.ok(baseline >= 0.65 && baseline <= 0.77, "Lv.25 冒險者森林 baseline 應維持後期平衡區間");
  }
  if (ROUNDS >= 5000 && group.region.id === "forest" && group.characterId === "archer") {
    assert.ok(baseline >= 0.68 && baseline <= 0.75, "Lv.25 弓箭手森林 baseline 應維持正式模型合理區間");
    const hunterRatio = entries.find((entry) => entry.weaponId === "hunter-shortbow").result.wins / entries[0].result.rounds;
    const vanguardRatio = entries.find((entry) => entry.weaponId === "vanguard-hunting-bow").result.wins / entries[0].result.rounds;
    assert.ok(vanguardRatio + 0.01 >= hunterRatio, "較高成本的先鋒獵弓不應在正式森林模型中被普通獵人短弓明顯壓過");
    assert.ok(vanguardRatio <= 0.92, "先鋒獵弓不應把 Lv.25 弓箭手森林模型推到過高區間");
  }
}

function printResults(title, entries, encounterCount) {
  const baseline = entries[0].result.wins / entries[0].result.rounds;
  console.log(`\n${title}`);
  entries.forEach(({ label, result }) => {
    const ratio = result.wins / result.rounds;
    const delta = (ratio - baseline) * 100;
    console.log(
      `${label.padEnd(8)} ${(ratio * 100).toFixed(2)}% `
      + `(${formatDelta(delta)} pp) `
      + `平均抵達 ${result.averageReached.toFixed(2)} / ${encounterCount}`
    );
  });
}

function formatDelta(value) {
  if (Math.abs(value) < 0.005) return "0.00";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
}
