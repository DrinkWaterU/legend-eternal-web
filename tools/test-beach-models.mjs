import assert from "node:assert/strict";

import { applyBlessingEffects } from "../src/core/blessings.js";
import {
  advanceHeroCombatStatuses,
  applyEnemyEndOfTurnNegativeEffects,
  applyEnemyEndOfTurnRecoveryEffects,
  applyHeroEndOfTurnNegativeEffects,
  applyHeroEndOfTurnRecoveryEffects,
  buildScaledEnemy,
  resolveEnemyAction,
  resolveHeroAction,
  resolveHeroEntangle,
  getHeroBattleHealingAmount
} from "../src/core/combat.js";
import { createRuntimeEnemyGroup, getLivingEnemies } from "../src/core/enemyGroups.js";
import { canCharacterEquipWeapon } from "../src/core/equipment.js";
import { buildHeroFromProgression, createSkillState } from "../src/core/progression.js";
import { characterDefinitions } from "../src/data/characters/index.js";
import { forestRegion } from "../src/data/regions/forest.js";
import { getBlessingRarity } from "../src/data/rarities.js";
import { weaponDefinitions } from "../src/data/weapons.js";
import {
  initializeCharacterBattleState,
  modifyCharacterIncomingDirectDamage,
  resolveCharacterPlayerAction
} from "../src/characters/skills/index.js";
import { createBattleSkills } from "../src/features/battle/battleSkills.js";

const ROUNDS = Math.max(1, Number(process.argv[2]) || 5000);
const SCENARIO = process.argv[3] === "single" ? "single" : "mixed";
const CHARACTER_MODE = ["adventurer", "archer", "both"].includes(process.argv[4])
  ? process.argv[4]
  : "both";
const CHARACTER_IDS = CHARACTER_MODE === "both" ? ["adventurer", "archer"] : [CHARACTER_MODE];
const ENEMY_STAT_SCALES = {
  hp: parsePositiveNumber(process.argv[5], 1),
  attack: parsePositiveNumber(process.argv[6], 1),
  defense: parsePositiveNumber(process.argv[7], 1)
};
const ENEMY_GROUP_SCALES = {
  normal: 1,
  elite: parsePositiveNumber(process.argv[8], 1),
  boss: parsePositiveNumber(process.argv[9], 1)
};
const MULTI_ENEMY_STAT_SCALES = {
  double: parsePositiveNumber(process.argv[10], 0.9),
  triple: parsePositiveNumber(process.argv[11], 0.7)
};
const BOSS_DISTANCE_BYPASS_CHANCE = parseRatio(process.argv[12], 0);
const BLESSING_MODE = ["forest", "beach-basic", "beach"].includes(process.argv[13])
  ? process.argv[13]
  : "beach";
const MULTI_ENEMY_ATTACK_SCALES = {
  double: parsePositiveNumber(process.argv[14], 1.55),
  triple: parsePositiveNumber(process.argv[15], 1.45)
};
const PLAYER_BUILD_MODE = process.argv[16] === "player-builds";
const FISHMAN_HUNT_ATTACK = parsePositiveNumber(process.argv[17], 5);
const PLAYER_BUILD_FILTER = process.argv[18] || "";
const MAX_TURNS = 500;
const logger = { template() {}, fixed() {} };
const encounterPlan = [
  "normal", "normal", "normal", "normal", "normal", "normal", "normal", "normal",
  "elite", "normal", "normal", "normal", "elite", "normal", "normal", "boss"
];
const beachBlessings = [
  {
    id: "beach-tide-whetstone",
    category: "attack",
    rarity: "common",
    primaryFlow: "attack",
    name: "潮痕磨刃",
    effects: [{ type: "add", stat: "attack", amount: 4 }]
  },
  {
    id: "beach-reef-shell",
    category: "defense",
    rarity: "common",
    primaryFlow: "defense",
    name: "礁殼護步",
    effects: [
      { type: "add", stat: "defense", amount: 3 },
      { type: "add", stat: "shieldStart", amount: 10 }
    ]
  },
  {
    id: "beach-tide-rest",
    category: "healing",
    rarity: "common",
    primaryFlow: "healing",
    name: "潮池短歇",
    effects: [
      { type: "recoverHp", amount: 28 },
      { type: "addTimedRegen", id: "beach-tide-rest", durationEncounters: 3, everyTurns: 3, maxHpRatio: 0.04 }
    ]
  },
  {
    id: "beach-crosscurrent-guard",
    category: "defense",
    rarity: "common",
    primaryFlow: "defense",
    name: "逆流護勢",
    effects: [],
    modelEffects: { multiEnemyShieldStart: 6 }
  },
  {
    id: "beach-tide-scavenger",
    category: "healing",
    rarity: "uncommon",
    primaryFlow: "healing",
    name: "潮汐拾荒",
    effects: [
      { type: "add", stat: "killHeal", amount: 14 },
      { type: "set", stat: "regenEvery", value: 4 },
      { type: "add", stat: "regenAmount", amount: 6 }
    ]
  },
  {
    id: "beach-saltbound-shell",
    category: "defense",
    rarity: "uncommon",
    primaryFlow: "defense",
    name: "鹽殼加固",
    effects: [
      { type: "add", stat: "maxHp", amount: 14 },
      { type: "add", stat: "shieldStart", amount: 9 }
    ]
  },
  {
    id: "beach-fishman-tideeye",
    category: "attack",
    rarity: "uncommon",
    primaryFlow: "crit",
    name: "魚人潮眼",
    effects: [
      { type: "add", stat: "critChance", amount: 0.09 },
      { type: "addFamilyDamageBonus", family: "fishman", amount: 0.08 }
    ]
  },
  {
    id: "beach-saltward",
    category: "defense",
    rarity: "uncommon",
    primaryFlow: "defense",
    name: "鹽痕抗性",
    effects: [],
    modelEffects: { saltHealingReduction: 0.2 }
  },
  {
    id: "beach-fishman-hunt",
    category: "attack",
    rarity: "rare",
    primaryFlow: "attack",
    name: "魚人獵殺",
    effects: [
      { type: "add", stat: "attack", amount: FISHMAN_HUNT_ATTACK },
      { type: "addFamilyDamageBonus", family: "fishman", amount: 0.08 }
    ],
    encounterBias: {
      families: ["fishman"],
      normal: { bonusWeight: 80, duration: 3 },
      elite: { bonusWeight: 60, duration: 2 }
    }
  },
  {
    id: "beach-tide-counter",
    category: "defense",
    rarity: "rare",
    primaryFlow: "defense",
    name: "潮群反擊",
    effects: [
      { type: "add", stat: "defense", amount: 2 },
      { type: "add", stat: "shieldStart", amount: 8 }
    ],
    modelEffects: { multiEnemyDamageBonus: 0.1, stackMultiEnemyDamageBonus: false }
  }
];
const beachRegion = {
  id: "beach-model",
  encounterPlan,
  scaling: { hpPerEncounter: 0.006, attackPerEncounter: 0.0045 },
  enemies: [
    createEnemy({ id: "reef-crab", name: "礁甲蟹", family: "beast", maxHp: 194, attack: 24, defense: 8 }),
    createEnemy({ id: "salt-jellyfish", name: "鹽霧水母", family: "slime", maxHp: 142, attack: 26, defense: 3, saltErosionChance: 0.18, paralysisChance: 0.2 }),
    createEnemy({ id: "sand-stalker", name: "沙痕獵獸", family: "beast", maxHp: 158, attack: 31, defense: 4, critChance: 0.14 }),
    createEnemy({ id: "tidewing-predator", name: "潮翼掠食者", family: "beast", maxHp: 126, attack: 32, defense: 2, critChance: 0.18 }),
    createEnemy({ id: "fishman-scout", name: "魚人斥候", family: "fishman", maxHp: 168, attack: 30, defense: 5, critChance: 0.1, minEncounter: 10 }),
    createEnemy({ id: "fishman-salt-spearman", name: "魚人鹽矛手", family: "fishman", maxHp: 152, attack: 28, defense: 3, critChance: 0.06, saltErosionChance: 0.2, minEncounter: 10 })
  ],
  elites: [
    createEnemy({ difficulty: "elite", id: "giant-reef-crab", name: "巨鉗礁甲蟹", family: "beast", maxHp: 378, attack: 36, defense: 10 }),
    createEnemy({ difficulty: "elite", id: "corrupted-tide-jellyfish", name: "腐潮水母", family: "slime", maxHp: 394, attack: 38, defense: 8, critChance: 0.05, saltErosionChance: 0.25, paralysisChance: 0.3 })
  ],
  boss: createEnemy({
    difficulty: "boss",
    distanceBypassChance: BOSS_DISTANCE_BYPASS_CHANCE,
    id: "tidal-giant-crab",
    name: "潮汐巨蟹",
    family: "beast",
    maxHp: 713,
    attack: 49,
    defense: 13,
    critChance: 0.05,
    saltErosionChance: 0.3
  }),
  blessings: BLESSING_MODE === "forest" ? forestRegion.blessings : beachBlessings
};
const playerBuildProfiles = [
  {
    id: "adventurer-low-roll",
    label: "冒險者／運氣差 Build",
    characterId: "adventurer",
    blessingIds: [
      "beach-tide-whetstone",
      "beach-fishman-tideeye",
      "beach-saltward",
      "beach-tide-whetstone",
      "beach-tide-scavenger",
      "beach-reef-shell",
      "beach-reef-shell",
      "beach-reef-shell",
      "beach-reef-shell",
      "beach-tide-whetstone",
      "beach-reef-shell",
      "beach-tide-whetstone",
      "beach-tide-whetstone",
      "beach-tide-rest",
      "beach-tide-whetstone"
    ]
  },
  {
    id: "adventurer-rare",
    label: "冒險者／Rare Build",
    characterId: "adventurer",
    blessingIds: [
      "beach-tide-counter",
      "beach-fishman-tideeye",
      "beach-tide-scavenger",
      "beach-fishman-hunt",
      "beach-saltbound-shell",
      "beach-fishman-tideeye",
      "beach-tide-whetstone",
      "beach-fishman-hunt",
      "beach-tide-whetstone",
      "beach-tide-whetstone",
      "beach-reef-shell",
      "beach-tide-whetstone",
      "beach-tide-counter",
      "beach-tide-counter",
      "beach-reef-shell"
    ]
  },
  {
    id: "archer-player",
    label: "弓箭手／玩家 Build",
    characterId: "archer",
    blessingIds: [
      "beach-saltward",
      "beach-tide-scavenger",
      "beach-tide-whetstone",
      "beach-fishman-tideeye",
      "beach-reef-shell",
      "beach-fishman-hunt",
      "beach-tide-scavenger",
      "beach-tide-whetstone",
      "beach-reef-shell",
      "beach-fishman-tideeye",
      "beach-saltbound-shell",
      "beach-tide-counter",
      "beach-tide-whetstone",
      "beach-tide-whetstone",
      "beach-fishman-hunt"
    ]
  },
  {
    id: "archer-normal-player",
    label: "弓箭手／正常玩家 Build",
    characterId: "archer",
    blessingIds: [
      "beach-tide-whetstone",
      "beach-fishman-hunt",
      "beach-fishman-hunt",
      "beach-fishman-tideeye",
      "beach-tide-whetstone",
      "beach-tide-scavenger",
      "beach-tide-whetstone",
      "beach-fishman-hunt",
      "beach-fishman-hunt",
      "beach-reef-shell",
      "beach-reef-shell",
      "beach-tide-scavenger",
      "beach-fishman-hunt",
      "beach-tide-rest",
      "beach-tide-whetstone"
    ]
  },
  {
    id: "adventurer-archer-normal-control",
    label: "冒險者／同選牌對照 Build",
    characterId: "adventurer",
    blessingIds: [
      "beach-tide-whetstone",
      "beach-fishman-hunt",
      "beach-fishman-hunt",
      "beach-fishman-tideeye",
      "beach-tide-whetstone",
      "beach-tide-scavenger",
      "beach-tide-whetstone",
      "beach-fishman-hunt",
      "beach-fishman-hunt",
      "beach-reef-shell",
      "beach-reef-shell",
      "beach-tide-scavenger",
      "beach-fishman-hunt",
      "beach-tide-rest",
      "beach-tide-whetstone"
    ]
  }
];

console.log(
  `Beach model: ${SCENARIO}, roles=${CHARACTER_MODE}, ${ROUNDS} rounds per case, `
  + `enemy scales hp=${ENEMY_STAT_SCALES.hp} attack=${ENEMY_STAT_SCALES.attack} defense=${ENEMY_STAT_SCALES.defense} `
  + `elite=${ENEMY_GROUP_SCALES.elite} boss=${ENEMY_GROUP_SCALES.boss} `
  + `multiHp=${MULTI_ENEMY_STAT_SCALES.double}/${MULTI_ENEMY_STAT_SCALES.triple} `
  + `multiAttack=${MULTI_ENEMY_ATTACK_SCALES.double}/${MULTI_ENEMY_ATTACK_SCALES.triple} `
  + `bossBypassDistance=${BOSS_DISTANCE_BYPASS_CHANCE} blessings=${BLESSING_MODE}`
);

if (BLESSING_MODE === "beach") {
  console.log("Beach blessing model assumptions: multiEnemyShieldStart=6, multiEnemyDamageBonus=10% non-stacking, saltHealingReduction=20%.");
}

if (PLAYER_BUILD_MODE) {
  assert.equal(BLESSING_MODE, "beach", "固定玩家 Build 只適用海灘 Blessing");
  const selectedProfiles = PLAYER_BUILD_FILTER
    ? playerBuildProfiles.filter((profile) => profile.id === PLAYER_BUILD_FILTER)
    : playerBuildProfiles;
  assert.ok(selectedProfiles.length > 0, `找不到固定玩家 Build：${PLAYER_BUILD_FILTER}`);
  for (const profile of selectedProfiles) {
    const result = withSeed(getSeed(profile.id, 25, "vanguard-hunting-bow"), () => simulateRuns({
      characterId: profile.characterId,
      level: 25,
      weaponId: "vanguard-hunting-bow",
      fixedBlessingIds: profile.blessingIds
    }));
    printResult(profile.label, "先鋒獵弓", result);
  }
} else {
  for (const characterId of CHARACTER_IDS) {
    const weaponCases = getWeaponCases(characterId);
    assert.ok(weaponCases.length > 1, `${characterId} 海灘模型應包含可用武器`);
    if (characterId === "adventurer") {
      assert.equal(weaponCases.length, Object.keys(weaponDefinitions).length + 1, "冒險者模型應涵蓋所有現有武器");
    }

    for (const level of [20, 25]) {
      for (const weapon of weaponCases) {
        const result = withSeed(getSeed(characterId, level, weapon.id), () => simulateRuns({
          characterId,
          level,
          weaponId: weapon.id
        }));
        printResult(`${characterDefinitions[characterId].name} Lv.${level}`, weapon.label, result);
      }
    }
  }
}

function printResult(profileLabel, weaponLabel, result) {
  assert.ok(result.winRatio >= 0 && result.winRatio <= 1, `${profileLabel} 勝場比例必須有效`);
  assert.ok(result.averageReached >= 1 && result.averageReached <= encounterPlan.length);
  console.log([
    profileLabel,
    weaponLabel,
    `勝場 ${formatPercent(result.winRatio)}`,
    `平均抵達 ${result.averageReached.toFixed(2)}/16`,
    `通關平均剩餘生命 ${result.averageClearHpRatio === null ? "-" : formatPercent(result.averageClearHpRatio)}`,
    `平均鹽蝕觸發 ${result.averageSaltApplications.toFixed(2)}`,
    `主要敗北 ${formatDefeats(result.defeatsByEncounter)}`
  ].join(" | "));
}

function getWeaponCases(characterId) {
  const character = characterDefinitions[characterId];
  return [
    { id: null, label: "未裝備" },
    ...Object.values(weaponDefinitions)
      .filter((weapon) => canCharacterEquipWeapon(character, weapon))
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((weapon) => ({ id: weapon.id, label: weapon.name }))
  ];
}

function createEnemy({
  difficulty = "normal",
  id,
  name,
  family,
  maxHp,
  attack,
  defense,
  critChance = 0,
  saltErosionChance = 0,
  paralysisChance = 0,
  minEncounter = 0,
  distanceBypassChance = 0
}) {
  const groupScale = ENEMY_GROUP_SCALES[difficulty] || ENEMY_GROUP_SCALES.normal;
  return {
    id,
    name,
    kind: "普通",
    family,
    weight: 100,
    maxHp: Math.round(maxHp * ENEMY_STAT_SCALES.hp * groupScale),
    attack: Math.max(1, Math.round(attack * ENEMY_STAT_SCALES.attack * groupScale)),
    defense: Math.max(0, Math.round(defense * ENEMY_STAT_SCALES.defense * groupScale)),
    critChance,
    saltErosionChance,
    paralysisChance,
    minEncounter,
    distanceBypassChance,
    poison: 0
  };
}

function simulateRuns({ characterId, level, weaponId, fixedBlessingIds = null }) {
  let wins = 0;
  let reachedTotal = 0;
  let clearHpRatioTotal = 0;
  let saltApplications = 0;
  const defeatsByEncounter = new Map();

  for (let run = 0; run < ROUNDS; run += 1) {
    const hero = buildHeroFromProgression(characterDefinitions[characterId], {
      level,
      exp: 0,
      learnedSkills: [],
      equipment: { weaponId }
    }, {
      inventory: { weapons: weaponId ? { [weaponId]: true } : {} },
      weaponDefinitions
    });
    let reached = 0;
    let cleared = true;

    for (let encounterIndex = 0; encounterIndex < encounterPlan.length; encounterIndex += 1) {
      reached = encounterIndex + 1;
      resetBattleState(hero);
      const battleSkills = createModelBattleSkills(hero);
      battleSkills.applyBattleStartSkills();
      const enemies = buildBeachEnemyGroup(encounterIndex, hero);
      applyBeachBattleStartEffects(hero, enemies);
      const encounterResult = simulateEncounter({ hero, enemies, battleSkills });
      saltApplications += encounterResult.saltApplications;

      if (!encounterResult.won) {
        cleared = false;
        defeatsByEncounter.set(reached, (defeatsByEncounter.get(reached) || 0) + 1);
        break;
      }

      applySaltAwareVictorySkills(hero, battleSkills);
      battleSkills.consumeBattleLimitedEffects();
      if (encounterIndex < encounterPlan.length - 1) {
        const blessing = fixedBlessingIds
          ? getFixedBlessing(fixedBlessingIds[encounterIndex])
          : chooseBlessing(characterId, getBlessingChoices(beachRegion.blessings, 3), hero);
        applyModelBlessing(hero, blessing);
      }
    }

    reachedTotal += reached;
    if (cleared) {
      wins += 1;
      clearHpRatioTotal += hero.maxHp > 0 ? hero.hp / hero.maxHp : 0;
    }
  }

  return {
    winRatio: wins / ROUNDS,
    averageReached: reachedTotal / ROUNDS,
    averageClearHpRatio: wins > 0 ? clearHpRatioTotal / wins : null,
    averageSaltApplications: saltApplications / ROUNDS,
    defeatsByEncounter
  };
}

function getFixedBlessing(blessingId) {
  const blessing = beachRegion.blessings.find((entry) => entry.id === blessingId);
  assert.ok(blessing, `找不到固定玩家 Build Blessing：${blessingId}`);
  return blessing;
}

function chooseBlessing(characterId, choices, hero) {
  return characterId === "archer"
    ? chooseReasonableArcherBlessing(choices, hero)
    : chooseReasonableAdventurerBlessing(choices, hero);
}

function applyModelBlessing(hero, blessing) {
  applyBlessingEffects(hero, blessing);
  if (BLESSING_MODE !== "beach") return;

  const modelEffects = blessing.modelEffects || {};
  if (Number.isFinite(modelEffects.multiEnemyShieldStart)) {
    hero.beachMultiEnemyShieldStart = (Number(hero.beachMultiEnemyShieldStart) || 0)
      + modelEffects.multiEnemyShieldStart;
  }
  if (Number.isFinite(modelEffects.multiEnemyDamageBonus)) {
    hero.beachMultiEnemyDamageBonus = modelEffects.stackMultiEnemyDamageBonus === false
      ? Math.max(Number(hero.beachMultiEnemyDamageBonus) || 0, modelEffects.multiEnemyDamageBonus)
      : (Number(hero.beachMultiEnemyDamageBonus) || 0) + modelEffects.multiEnemyDamageBonus;
  }
  if (Number.isFinite(modelEffects.saltHealingReduction)) {
    const currentReduction = Number.isFinite(hero.saltHealingReduction)
      ? hero.saltHealingReduction
      : 0.3;
    hero.saltHealingReduction = Math.min(currentReduction, modelEffects.saltHealingReduction);
  }
}

function buildBeachEnemyGroup(encounterIndex, hero) {
  const encounterType = encounterPlan[encounterIndex];
  const sourcePool = encounterType === "boss"
    ? [beachRegion.boss]
    : encounterType === "elite"
      ? beachRegion.elites
      : beachRegion.enemies;
  const groupRoll = Math.random();
  const count = encounterType !== "normal" || SCENARIO === "single" || encounterIndex < 8
    ? 1
    : groupRoll < 0.1 ? 3 : groupRoll < 0.35 ? 2 : 1;
  const statScale = count === 3
    ? MULTI_ENEMY_STAT_SCALES.triple
    : count === 2
      ? MULTI_ENEMY_STAT_SCALES.double
      : 1;
  const attackScale = count === 3
    ? MULTI_ENEMY_ATTACK_SCALES.triple
    : count === 2
      ? MULTI_ENEMY_ATTACK_SCALES.double
      : 1;
  const available = [...sourcePool];
  const selectedFamilies = new Set();
  const entries = [];

  for (let index = 0; index < count; index += 1) {
    const availableCandidates = available.length > 0 ? available : sourcePool;
    const eligibleCandidates = availableCandidates.filter((enemy) => {
      const minEncounter = Number(enemy.minEncounter);
      return !Number.isFinite(minEncounter) || encounterIndex + 1 >= minEncounter;
    });
    const familyCandidates = selectedFamilies.has("fishman")
      ? eligibleCandidates.filter((enemy) => enemy.family !== "fishman")
      : eligibleCandidates;
    const candidates = familyCandidates.length > 0
      ? familyCandidates
      : (eligibleCandidates.length > 0 ? eligibleCandidates : availableCandidates);
    const source = pickBeachEnemy(candidates, hero, encounterType);
    if (available.length > 0) available.splice(available.indexOf(source), 1);
    selectedFamilies.add(source.family);
    entries.push({
      enemy: buildScaledEnemy(source, beachRegion, encounterIndex),
      statScale,
      attackScale
    });
  }

  return createRuntimeEnemyGroup(entries);
}

function pickBeachEnemy(enemies, hero, encounterType) {
  if (encounterType === "boss") return enemies[0];

  const activeBiases = getActiveBeachEncounterBiases(hero, encounterType);
  const guaranteeBias = activeBiases.find((bias) => {
    const mode = bias[encounterType];
    return Boolean(
      mode.guaranteeAfter
      && mode.misses + 1 >= mode.guaranteeAfter
      && enemies.some((enemy) => hasBiasedBeachFamily(enemy, bias))
    );
  });
  const selectedPool = guaranteeBias
    ? enemies.filter((enemy) => hasBiasedBeachFamily(enemy, guaranteeBias))
    : enemies;
  const selected = weightedPick(selectedPool, (enemy) => getBeachEnemyWeight(enemy, activeBiases, encounterType));
  updateBeachEncounterBiases(hero, encounterType, selected);
  return selected;
}

function getActiveBeachEncounterBiases(hero, encounterType) {
  if (!hero || !Array.isArray(hero.encounterBiases)) return [];
  return hero.encounterBiases.filter((bias) => {
    const mode = bias[encounterType];
    return mode && mode.remaining > 0;
  });
}

function getBeachEnemyWeight(enemy, activeBiases, encounterType) {
  const baseWeight = Number(enemy.weight) || 100;
  return activeBiases.reduce((weight, bias) => {
    if (!hasBiasedBeachFamily(enemy, bias)) return weight;
    return weight + (Number(bias[encounterType].bonusWeight) || 0);
  }, baseWeight);
}

function updateBeachEncounterBiases(hero, encounterType, selectedEnemy) {
  if (!hero || !Array.isArray(hero.encounterBiases)) return;
  hero.encounterBiases.forEach((bias) => {
    const mode = bias[encounterType];
    if (!mode || mode.remaining <= 0) return;
    mode.remaining -= 1;
    mode.misses = hasBiasedBeachFamily(selectedEnemy, bias) ? 0 : mode.misses + 1;
  });
  hero.encounterBiases = hero.encounterBiases.filter((bias) => {
    return ["normal", "elite"].some((type) => bias[type] && bias[type].remaining > 0);
  });
}

function hasBiasedBeachFamily(enemy, bias) {
  const families = Array.isArray(bias.families) ? bias.families : [bias.family];
  return families.includes(enemy.family);
}

function applyBeachBattleStartEffects(hero, enemies) {
  if (BLESSING_MODE !== "beach" || enemies.length < 2) return;
  const extraShield = Math.max(0, Number(hero.beachMultiEnemyShieldStart) || 0);
  if (extraShield > 0) hero.shield += extraShield;
}

function simulateEncounter({ hero, enemies, battleSkills }) {
  let saltApplications = 0;
  const originalAttack = hero.attack;
  hero.activeEnemyCount = enemies.length;
  const multiEnemyDamageBonus = BLESSING_MODE === "beach" && enemies.length >= 2
    ? Math.max(0, Number(hero.beachMultiEnemyDamageBonus) || 0)
    : 0;
  if (multiEnemyDamageBonus > 0) {
    hero.attack = Math.max(1, Math.round(hero.attack * (1 + multiEnemyDamageBonus)));
  }

  try {
    for (let turn = 1; turn <= MAX_TURNS; turn += 1) {
      advanceHeroCombatStatuses(hero);
      hero.activeEnemyCount = getLivingEnemies(enemies).length;
      const heroEntangled = resolveHeroEntangle({ hero, log: logger });

      if (!heroEntangled) {
        const target = getLivingEnemies(enemies)[0];
        const characterAction = resolveCharacterPlayerAction({
          hero,
          enemies,
          targetEnemyId: target?.runtimeId || null,
          log: logger
        });
        if (!characterAction.handled && target) resolveHeroAction({ hero, enemy: target, log: logger });
        settleDefeatedEnemies(hero, enemies);
        if (getLivingEnemies(enemies).length === 0) return { won: true, saltApplications };
      }

      for (const enemy of [...getLivingEnemies(enemies)]) {
        if (enemy.hp <= 0 || hero.hp <= 0) continue;
        const saltTurnsBefore = Number(hero.saltErosion?.remainingTurns) || 0;
        resolveEnemyAction({
          hero,
          enemy,
          turn,
          log: logger,
          modifyDirectDamage: modifyBeachIncomingDamage
        });
        const saltTurnsAfter = Number(hero.saltErosion?.remainingTurns) || 0;
        if (saltTurnsAfter > saltTurnsBefore) saltApplications += 1;
        applySaltAwareActionHeal(hero, battleSkills.applyEmergencyBandage);
        if (hero.hp <= 0 && !applySaltAwareLastStand(hero, battleSkills)) {
          return { won: false, saltApplications };
        }
      }

      applyHeroEndOfTurnNegativeEffects({ hero, log: logger });
      getLivingEnemies(enemies).forEach((enemy) => applyEnemyEndOfTurnNegativeEffects({ enemy, log: logger }));
      applySaltAwareEndOfTurnRecovery(hero, turn);
      getLivingEnemies(enemies).forEach((enemy) => applyEnemyEndOfTurnRecoveryEffects({ enemy, turn, log: logger }));
      if (hero.hp <= 0 && !applySaltAwareLastStand(hero, battleSkills)) {
        return { won: false, saltApplications };
      }

      settleDefeatedEnemies(hero, enemies);
      if (getLivingEnemies(enemies).length === 0) return { won: true, saltApplications };
    }

    throw new Error("海灘模型單場戰鬥超過最大回合數。");
  } finally {
    hero.attack = originalAttack;
  }
}

function modifyBeachIncomingDamage(context) {
  if (
    context.enemy?.distanceBypassChance > 0
    && Math.random() < context.enemy.distanceBypassChance
  ) {
    return context.damage;
  }
  return modifyCharacterIncomingDirectDamage(context);
}

function settleDefeatedEnemies(hero, enemies) {
  enemies.forEach((enemy) => {
    if (enemy.hp > 0 || enemy.modelSettled) return;
    enemy.modelSettled = true;
    const hpRatioBeforeKillRewards = hero.maxHp > 0 ? hero.hp / hero.maxHp : 0;
    if (hpRatioBeforeKillRewards < 0.5 && hero.lowHpKillHeal > 0) applySaltAwareHeal(hero, hero.lowHpKillHeal);
    if (hero.killHeal > 0) applySaltAwareHeal(hero, hero.killHeal);
    if (hero.killHealRatio > 0) applySaltAwareHeal(hero, Math.max(1, Math.round(hero.maxHp * hero.killHealRatio)));
    if (hero.killAttackGain > 0) hero.battleAttackBonus = (hero.battleAttackBonus || 0) + hero.killAttackGain;
  });
}

function applySaltAwareVictorySkills(hero, battleSkills) {
  battleSkills.applyVictorySkills();
}

function applySaltAwareLastStand(hero, battleSkills) {
  return battleSkills.tryLastStand();
}

function applySaltAwareActionHeal(hero, applyHealSkill) {
  applyHealSkill();
}

function applySaltAwareHeal(hero, amount) {
  const effectiveAmount = getHeroBattleHealingAmount(hero, amount);
  hero.hp = Math.min(hero.maxHp, hero.hp + Math.max(0, effectiveAmount));
}

function applySaltAwareEndOfTurnRecovery(hero, turn) {
  applyHeroEndOfTurnRecoveryEffects({ hero, turn, log: logger });
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
  hero.statusFamiliarityLimitBonus = 0;
  hero.victoryHealBonusRatio = 0;
  hero.shield = hero.shieldStart;
  hero.skillState = createSkillState();
  initializeCharacterBattleState(hero);
}

function createModelBattleSkills(hero) {
  return createBattleSkills({
    state: { hero },
    hasHeroSkill: (skillId) => hasSkill(hero, skillId),
    addLog() {},
    addFixedLog() {},
    lastBagFlowWeightMultiplier: 0.6
  });
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
  let score = roleBase[flow] || 3;
  score += Math.max(0, Number(hero.blessingFlowMomentum?.[flow]) || 0) * 1.75;
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
  return Array.isArray(hero.skills) && hero.skills.includes(skillId);
}

function weightedPick(items, getWeight) {
  const total = items.reduce((sum, item) => sum + Math.max(0, Number(getWeight(item)) || 0), 0);
  let value = Math.random() * total;
  for (const item of items) {
    value -= Math.max(0, Number(getWeight(item)) || 0);
    if (value <= 0) return item;
  }
  return items.at(-1);
}

function formatPercent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function formatDefeats(defeats) {
  return [...defeats.entries()]
    .sort((left, right) => left[0] - right[0])
    .slice(-4)
    .map(([index, count]) => `${index}:${count}`)
    .join(",") || "無";
}

function getSeed(characterId, level, weaponId) {
  const weaponOffset = weaponId ? [...Object.keys(weaponDefinitions)].indexOf(weaponId) + 1 : 0;
  const characterOffset = characterId === "archer" ? 0x400000 : 0;
  return (0x27080000 + characterOffset + level * 0x100 + weaponOffset) >>> 0;
}

function parsePositiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseRatio(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : fallback;
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
