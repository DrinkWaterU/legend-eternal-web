import assert from "node:assert/strict";

import { applyBlessingEffects } from "../src/core/blessings.js";
import {
  advanceHeroCombatStatuses,
  applyEnemyEndOfTurnNegativeEffects,
  applyEnemyEndOfTurnRecoveryEffects,
  applyHeroEndOfTurnNegativeEffects,
  applyHeroEndOfTurnRecoveryEffects,
  buildEnemy,
  buildEnemyGroup,
  getHeroDirectAttackDamage,
  resolveEnemyAction,
  resolveHeroAction,
  resolveHeroEntangle,
  resolveHeroStrike
} from "../src/core/combat.js";
import { createRuntimeEnemyGroup, getLivingEnemies } from "../src/core/enemyGroups.js";
import { buildHeroFromProgression, createSkillState } from "../src/core/progression.js";
import { characterDefinitions } from "../src/data/characters/index.js";
import { getDuelDefinition } from "../src/data/duels/index.js";
import { beachRegion } from "../src/data/regions/beach.js";
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
import {
  createSeededRandom,
  formatPercent,
  seedFromText,
  weightedPick,
  withSeed
} from "./model-test-helpers.mjs";

const ROUNDS = Math.max(100, Number(process.argv[2]) || 2000);
const DUEL_SEARCH_ROUNDS = Math.max(80, Math.min(300, Math.floor(ROUNDS / 8)));
const DUEL_FINAL_ROUNDS = Math.max(1000, ROUNDS);
const MAX_TURNS = 500;
const noOpLogger = { template() {}, fixed() {} };

const KAIGE_SKILLS = Object.freeze({
  KILL_HEAL: "battle-hunger",
  FURY: "battle-fury",
  FINISHER: "formation-breaking-cleave",
  SWEEP: "spinning-axe-sweep",
  FINISHER_HEAL: "blood-soaked-fight",
  LOW_HP_ATTACK: "blood-rush",
  DOUBLE_FURY: "berserker-heart",
  KILL_HEAL_PLUS: "battle-hunger-plus",
  FINISHER_HEAL_PLUS: "unyielding-fighting-spirit",
  FINISHER_PLUS: "cleave-mastery",
  OPENING_FURY: "adversity-fury",
  FURY_RETENTION: "battle-without-end"
});

const kaigeDefinition = Object.freeze({
  id: "kaige",
  name: "凱哥",
  weaponCompatibility: Object.freeze({
    mode: "include",
    categoryIds: Object.freeze(["battle-axe"])
  }),
  template: Object.freeze({
    name: "凱哥",
    maxHp: 110,
    hp: 110,
    attack: 11,
    defense: 1,
    critChance: 0.05,
    critDamageMultiplier: 1.7,
    shieldStart: 0,
    poisonPower: 0,
    regenEvery: 0,
    regenAmount: 0,
    killHeal: 0,
    slimeBonus: 0,
    familyDamageBonus: {},
    encounterBiases: [],
    damageReduction: 0,
    blessings: [],
    killAttackGain: 0,
    lowHpKillHeal: 0,
    poisonedTargetDefenseIgnore: 0,
    killHealRatio: 0
  }),
  levelCurve: Object.freeze({
    base: 18,
    exponent: 1.48,
    linear: 8,
    offset: 0,
    maxLevel: 25
  }),
  levelGrowth: Object.freeze([
    growth(2, "體魄鍛鍊", [["maxHp", 8]]),
    growth(3, "戰斧訓練", [["attack", 1]]),
    growth(4, "實戰護身", [["defense", 1]]),
    growth(5, "強健體魄", [["maxHp", 10]]),
    growth(6, "耐力磨練", [["maxHp", 8]]),
    growth(7, "戰場直覺", [["critChance", 0.03]]),
    growth(8, "長途鍛鍊", [["maxHp", 8], ["defense", 1]]),
    growth(9, "斧勢熟練", [["attack", 1]]),
    growth(10, "浴血耐性", [["maxHp", 10]]),
    growth(11, "戰士體魄", [["maxHp", 8]]),
    growth(12, "厚實筋骨", [["maxHp", 6]]),
    growth(13, "猛攻磨練", [["attack", 1]]),
    growth(14, "防具熟悉", [["defense", 1]]),
    growth(15, "死鬥體魄", [["maxHp", 10]]),
    growth(16, "遠征耐力", [["maxHp", 8]]),
    growth(17, "布甲步法", [["defense", 1]]),
    growth(18, "重斧鍛鍊", [["attack", 2]]),
    growth(19, "不屈體魄", [["maxHp", 8]]),
    growth(20, "遠征整備", [["maxHp", 10], ["defense", 1]]),
    growth(21, "狂攻精熟", [["attack", 1]]),
    growth(22, "海風耐受", [["maxHp", 8]]),
    growth(23, "巨斧精通", [["attack", 1]]),
    growth(24, "實戰猛攻", [["attack", 1]]),
    growth(25, "戰士巔峰", [["maxHp", 8]])
  ]),
  skills: Object.freeze([
    skill(KAIGE_SKILLS.KILL_HEAL, 3, [["killHealRatio", 0.07]]),
    skill(KAIGE_SKILLS.FURY, 5),
    skill(KAIGE_SKILLS.FINISHER, 6),
    skill(KAIGE_SKILLS.SWEEP, 9),
    skill(KAIGE_SKILLS.FINISHER_HEAL, 10),
    skill(KAIGE_SKILLS.LOW_HP_ATTACK, 12, [["lowHpAttackBonus", 3]]),
    skill(KAIGE_SKILLS.DOUBLE_FURY, 15),
    skill(KAIGE_SKILLS.KILL_HEAL_PLUS, 18, [["killHealRatio", 0.01]]),
    skill(KAIGE_SKILLS.FINISHER_HEAL_PLUS, 20),
    skill(KAIGE_SKILLS.FINISHER_PLUS, 21),
    skill(KAIGE_SKILLS.OPENING_FURY, 24),
    skill(KAIGE_SKILLS.FURY_RETENTION, 25)
  ])
});

const modelWeaponDefinitions = Object.freeze({
  ...weaponDefinitions,
  "worn-battle-axe": Object.freeze({
    id: "worn-battle-axe",
    name: "磨痕戰斧",
    categoryId: "battle-axe",
    rarityId: "common",
    allowedCharacterIds: Object.freeze(["kaige"]),
    statEffects: Object.freeze([
      Object.freeze({ type: "add", stat: "attack", amount: 2 })
    ]),
    specialEffect: null
  })
});

const adventureScenarios = Object.freeze([
  {
    id: "plains-lv10",
    label: "平原 Lv.10",
    region: plainsRegion,
    level: 10,
    weapons: {
      adventurer: "iron-longsword",
      archer: "hunter-shortbow",
      kaige: "worn-battle-axe"
    }
  },
  {
    id: "forest-lv20",
    label: "森林 Lv.20",
    region: forestRegion,
    level: 20,
    weapons: {
      adventurer: "bloodbone-guardian-mace",
      archer: "verdant-pursuit-bow",
      kaige: "worn-battle-axe"
    }
  },
  {
    id: "forest-lv25",
    label: "森林 Lv.25",
    region: forestRegion,
    level: 25,
    weapons: {
      adventurer: "bloodbone-guardian-mace",
      archer: "verdant-pursuit-bow",
      kaige: "worn-battle-axe"
    }
  },
  {
    id: "beach-lv25",
    label: "海岸 Lv.25／三選一通用評分",
    region: beachRegion,
    level: 25,
    weapons: {
      adventurer: "reefbreaker-warhammer",
      archer: "tidepiercer-shortbow",
      kaige: "worn-battle-axe"
    }
  },
  {
    id: "beach-lv25-fixed-build",
    label: "海岸 Lv.25／固定攻守續航 Build",
    region: beachRegion,
    level: 25,
    weapons: {
      adventurer: "reefbreaker-warhammer",
      archer: "tidepiercer-shortbow",
      kaige: "worn-battle-axe"
    },
    fixedBlessingIds: Object.freeze([
      "beach-tide-whetstone",
      "beach-tide-scavenger",
      "beach-reef-shell",
      "beach-fishman-hunt",
      "beach-tide-rest",
      "beach-tide-whetstone",
      "beach-reef-shell",
      "beach-tide-scavenger",
      "beach-fishman-hunt",
      "beach-tide-counter",
      "beach-saltbound-shell",
      "beach-reef-shell",
      "beach-tide-whetstone",
      "beach-saltward",
      "beach-tide-whetstone"
    ])
  }
]);

const duelProfiles = Object.freeze([
  duelProfile("lv20-common-adventurer", "Lv.20 普通／冒險者", "adventurer", 20, "iron-longsword", 0.625),
  duelProfile("lv20-common-archer", "Lv.20 普通／弓箭手", "archer", 20, "hunter-shortbow", 0.625),
  duelProfile("lv20-forest-adventurer", "Lv.20 森林／冒險者", "adventurer", 20, "bloodbone-guardian-mace", 0.725),
  duelProfile("lv20-forest-archer", "Lv.20 森林／弓箭手", "archer", 20, "verdant-pursuit-bow", 0.725),
  duelProfile("lv25-coast-adventurer", "Lv.25 海岸／冒險者", "adventurer", 25, "reefbreaker-warhammer", 0.9),
  duelProfile("lv25-coast-archer", "Lv.25 海岸／弓箭手", "archer", 25, "tidepiercer-shortbow", 0.9)
]);

validateCandidateContracts();

console.log(`Kaige isolated model: ${ROUNDS} adventure rounds per role/case.`);
const adventureResults = [];
for (const scenario of adventureScenarios) {
  console.log(`\n${scenario.label}`);
  for (const characterId of ["adventurer", "archer", "kaige"]) {
    const result = withSeed(
      seedFromText(`kaige-adventure:${scenario.id}:${characterId}`),
      () => simulateAdventure({
        rounds: ROUNDS,
        scenario,
        characterId,
        weaponId: scenario.weapons[characterId]
      })
    );
    adventureResults.push(result);
    printAdventureResult(result);
  }
}

console.log(`\nKaige duel candidate search: ${DUEL_SEARCH_ROUNDS} rounds per profile/candidate.`);
const rankedCandidates = searchDuelCandidates();
rankedCandidates.slice(0, 5).forEach((entry, index) => {
  console.log(
    `${index + 1}. HP ${entry.candidate.maxHp} / ATK ${entry.candidate.attack} / DEF ${entry.candidate.defense}`
    + ` / 重斬 ${Math.round(entry.candidate.heavyMultiplier * 100)}%`
    + ` | score ${entry.score.toFixed(4)}`
    + ` | ${entry.results.map((result) => `${result.profileId}=${formatPercent(result.winRatio)}`).join(", ")}`
  );
});

const formalDuel = getDuelDefinition("kaige-challenge");
const selectedDuelCandidate = Object.freeze({
  maxHp: formalDuel.opponent.maxHp,
  attack: formalDuel.opponent.attack,
  defense: formalDuel.opponent.defense,
  heavyMultiplier: formalDuel.opponent.duelFury.heavyMultiplier
});
console.log(
  `\nSelected duel candidate for full rerun: HP ${selectedDuelCandidate.maxHp}`
  + ` / ATK ${selectedDuelCandidate.attack}`
  + ` / DEF ${selectedDuelCandidate.defense}`
  + ` / 重斬 ${Math.round(selectedDuelCandidate.heavyMultiplier * 100)}%`
);
const duelResults = duelProfiles.map((profile) => withSeed(
  seedFromText(`kaige-duel-final:${profile.id}`),
  () => simulateDuelProfile({
    rounds: DUEL_FINAL_ROUNDS,
    profile,
    candidate: selectedDuelCandidate
  })
));
duelResults.forEach(printDuelResult);

const level20Gap = getRoleGap(duelResults, 20);
const level25Gap = getRoleGap(duelResults, 25);
console.log(`Lv.20 最大角色差距：${(level20Gap * 100).toFixed(2)} pp`);
console.log(`Lv.25 海岸角色差距：${(level25Gap * 100).toFixed(2)} pp`);
validateModelResults({ adventureResults, duelResults, level20Gap, level25Gap });
console.log("Kaige isolated adventure and duel model assertions passed.");

console.log("MODEL_JSON", JSON.stringify({
  model: "v0.2.7.3-kaige-isolated",
  rounds: ROUNDS,
  duelSearchRounds: DUEL_SEARCH_ROUNDS,
  duelFinalRounds: DUEL_FINAL_ROUNDS,
  assumptions: {
    adventureEvents: false,
    preparation: "none",
    blessingChoiceCount: 3,
    kaigeWeapon: "worn-battle-axe",
    duelStartsAtFullHp: true,
    duelBlessings: false,
    duelPreparation: false
  },
  selectedDuelCandidate,
  adventureResults,
  duelResults
}));

function simulateAdventure({ rounds, scenario, characterId, weaponId }) {
  let wins = 0;
  let reachedTotal = 0;
  let clearHpRatioTotal = 0;
  let bossEntries = 0;
  let lossEnemyHpRatioTotal = 0;
  let losses = 0;
  let multiEnemyEncounters = 0;
  const defeatsByEncounter = new Map();
  const metrics = createKaigeMetrics();

  for (let run = 0; run < rounds; run += 1) {
    const hero = buildModelHero({ characterId, level: scenario.level, weaponId });
    hero.kaigeMetrics = createKaigeMetrics();
    const bosses = scenario.region.bosses || [scenario.region.boss];
    const selectedBoss = weightedPick(bosses, (boss) => Number(boss.weight) || 100);
    let reached = 0;
    let cleared = true;

    for (let encounterIndex = 0; encounterIndex < scenario.region.encounterPlan.length; encounterIndex += 1) {
      reached = encounterIndex + 1;
      if (encounterIndex === scenario.region.encounterPlan.length - 1) {
        bossEntries += 1;
      }
      resetBattleState(hero);
      const enemies = buildEncounterGroup({
        region: scenario.region,
        encounterIndex,
        hero,
        boss: selectedBoss
      });
      if (enemies.length > 1) {
        multiEnemyEncounters += 1;
      }
      hero.activeEnemyCount = enemies.length;
      const battleSkills = createModelBattleSkills(hero);
      battleSkills.applyBattleStartSkills();
      applyEquippedWeaponBattleStart(hero, {
        enemyCount: enemies.length,
        encounterType: encounterIndex === scenario.region.encounterPlan.length - 1 ? "boss" : "normal"
      });
      applyEnemyAmbushes(hero, enemies);
      const encounter = simulateAdventureEncounter({ hero, enemies, battleSkills });
      if (!encounter.won) {
        cleared = false;
        losses += 1;
        lossEnemyHpRatioTotal += encounter.enemyHpRatio;
        defeatsByEncounter.set(reached, (defeatsByEncounter.get(reached) || 0) + 1);
        break;
      }

      battleSkills.applyVictorySkills();
      battleSkills.consumeBattleLimitedEffects();
      if (encounterIndex < scenario.region.encounterPlan.length - 1) {
        const fixedBlessingId = scenario.fixedBlessingIds?.[encounterIndex];
        const blessing = fixedBlessingId
          ? scenario.region.blessings.find((entry) => entry.id === fixedBlessingId)
          : chooseBlessing(
              getBlessingChoices(scenario.region.blessings, 3),
              hero,
              characterId
            );
        assert.ok(blessing, `找不到模型 Blessing：${fixedBlessingId}`);
        applyBlessingEffects(hero, blessing);
        hero.blessings.push(blessing.name);
      }
    }

    reachedTotal += reached;
    addKaigeMetrics(metrics, hero.kaigeMetrics);
    if (cleared) {
      wins += 1;
      clearHpRatioTotal += hero.hp / hero.maxHp;
    }
  }

  return {
    scenarioId: scenario.id,
    scenarioLabel: scenario.label,
    characterId,
    characterName: characterId === "kaige" ? "凱哥" : characterDefinitions[characterId].name,
    level: scenario.level,
    weaponId,
    weaponName: weaponDefinitions[weaponId].name,
    rounds,
    wins,
    winRatio: wins / rounds,
    averageReached: reachedTotal / rounds,
    encounterCount: scenario.region.encounterPlan.length,
    bossEntryRatio: bossEntries / rounds,
    averageClearHpRatio: wins > 0 ? clearHpRatioTotal / wins : null,
    averageLossEnemyHpRatio: losses > 0 ? lossEnemyHpRatioTotal / losses : null,
    averageMultiEnemyEncounters: multiEnemyEncounters / rounds,
    defeatsByEncounter: Object.fromEntries(defeatsByEncounter),
    kaigeMetrics: characterId === "kaige"
      ? Object.fromEntries(Object.entries(metrics).map(([key, value]) => [key, value / rounds]))
      : null
  };
}

function simulateAdventureEncounter({ hero, enemies, battleSkills }) {
  const settledEnemyIds = new Set();

  for (let turn = 1; turn <= MAX_TURNS; turn += 1) {
    advanceHeroCombatStatuses(hero);
    hero.activeEnemyCount = getLivingEnemies(enemies).length;
    const heroEntangled = resolveHeroEntangle({ hero, log: noOpLogger });
    if (!heroEntangled) {
      const target = getLivingEnemies(enemies)[0];
      if (target) {
        const characterAction = resolveCharacterPlayerAction({
          hero,
          enemies,
          targetEnemyId: target.runtimeId,
          log: hero.characterId === "kaige" ? createKaigeModelLogger(hero) : noOpLogger
        });
        if (!characterAction.handled) {
          resolveHeroAction({ hero, enemy: target, enemies, log: noOpLogger });
        }
      }
      settleDefeatedEnemies(hero, enemies, settledEnemyIds);
      if (getLivingEnemies(enemies).length === 0) {
        return { won: true, enemyHpRatio: 0 };
      }
    }

    for (const enemy of [...getLivingEnemies(enemies)]) {
      if (hero.hp <= 0) break;
      resolveEnemyAction({
        hero,
        enemy,
        turn,
        log: noOpLogger,
        modifyDirectDamage: (context) => modifyModelIncomingDamage(context)
      });
      battleSkills.applyEmergencyBandage();
      if (hero.hp <= 0 && !battleSkills.tryLastStand()) {
        return { won: false, enemyHpRatio: getEnemyGroupHpRatio(enemies) };
      }
    }

    applyHeroEndOfTurnNegativeEffects({ hero, log: noOpLogger });
    getLivingEnemies(enemies).forEach((enemy) => {
      applyEnemyEndOfTurnNegativeEffects({ enemy, log: noOpLogger });
    });
    applyHeroEndOfTurnRecoveryEffects({ hero, turn, log: noOpLogger });
    getLivingEnemies(enemies).forEach((enemy) => {
      applyEnemyEndOfTurnRecoveryEffects({ enemy, turn, log: noOpLogger });
    });
    settleDefeatedEnemies(hero, enemies, settledEnemyIds);
    if (hero.hp <= 0 && !battleSkills.tryLastStand()) {
      return { won: false, enemyHpRatio: getEnemyGroupHpRatio(enemies) };
    }
    if (getLivingEnemies(enemies).length === 0) {
      return { won: true, enemyHpRatio: 0 };
    }
  }

  throw new Error("凱哥冒險模型單場戰鬥超過最大回合數。");
}

function resolveKaigeAction({ hero, enemies, target }) {
  syncKaigeFuryBonus(hero);
  const finisher = hasSkill(hero, KAIGE_SKILLS.FINISHER) && hero.kaigeFury >= 3;
  const finisherMultiplier = hasSkill(hero, KAIGE_SKILLS.FINISHER_PLUS) ? 1.75 : 1.5;
  resolveHeroStrike({
    hero,
    enemy: target,
    enemies,
    log: noOpLogger,
    options: {
      damageMultiplier: finisher ? finisherMultiplier : 1,
      allowHeavyStrike: false
    }
  });

  if (!finisher) {
    return;
  }

  hero.kaigeMetrics.finishers += 1;
  if (hasSkill(hero, KAIGE_SKILLS.SWEEP)) {
    const sweepMultiplier = hasSkill(hero, KAIGE_SKILLS.FINISHER_PLUS) ? 0.6 : 0.4;
    getLivingEnemies(enemies)
      .filter((enemy) => enemy.runtimeId !== target.runtimeId)
      .forEach((enemy) => {
        const damage = getHeroDirectAttackDamage({
          hero,
          enemy,
          damageMultiplier: sweepMultiplier
        });
        enemy.hp = Math.max(0, enemy.hp - damage);
        hero.kaigeMetrics.sweepHits += 1;
      });
  }

  applyKaigeFinisherHeal(hero);
  const consumed = hasSkill(hero, KAIGE_SKILLS.FURY_RETENTION) ? 2 : hero.kaigeFury;
  hero.kaigeFury = Math.max(0, hero.kaigeFury - consumed);
  syncKaigeFuryBonus(hero);
}

function modifyModelIncomingDamage(context) {
  const before = context.hero?.skillState?.kaige?.fury || 0;
  const damage = modifyCharacterIncomingDirectDamage(context);
  const after = context.hero?.skillState?.kaige?.fury || 0;
  if (context.hero?.characterId === "kaige") {
    context.hero.kaigeMetrics.furyGained += Math.max(0, after - before);
  }
  return damage;
}

function gainKaigeFury(hero) {
  if (!hasSkill(hero, KAIGE_SKILLS.FURY)) {
    return;
  }
  const hpRatio = hero.maxHp > 0 ? hero.hp / hero.maxHp : 1;
  const amount = hasSkill(hero, KAIGE_SKILLS.DOUBLE_FURY) && hpRatio <= 0.5 ? 2 : 1;
  const previous = hero.kaigeFury;
  hero.kaigeFury = Math.min(3, hero.kaigeFury + amount);
  hero.kaigeMetrics.furyGained += hero.kaigeFury - previous;
  syncKaigeFuryBonus(hero);
}

function syncKaigeFuryBonus(hero) {
  const previous = Math.max(0, Number(hero.kaigeAppliedFuryBonus) || 0);
  const next = Math.max(0, Number(hero.kaigeFury) || 0);
  hero.battleAttackBonus = (Number(hero.battleAttackBonus) || 0) - previous + next;
  hero.kaigeAppliedFuryBonus = next;
}

function applyKaigeFinisherHeal(hero) {
  if (!hasSkill(hero, KAIGE_SKILLS.FINISHER_HEAL) || hero.hp <= 0) {
    return;
  }
  const enhanced = hasSkill(hero, KAIGE_SKILLS.FINISHER_HEAL_PLUS);
  const healRatio = enhanced ? 0.1 : 0.08;
  const capRatio = 0.7;
  const cap = Math.floor(hero.maxHp * capRatio);
  const amount = Math.max(1, Math.round(hero.maxHp * healRatio));
  const healed = Math.max(0, Math.min(cap, hero.hp + amount) - hero.hp);
  hero.hp += healed;
  hero.kaigeMetrics.finisherHealing += healed;
}

function settleDefeatedEnemies(hero, enemies, settledEnemyIds) {
  enemies
    .filter((enemy) => enemy.hp <= 0 && !settledEnemyIds.has(enemy.runtimeId))
    .forEach((enemy) => {
      settledEnemyIds.add(enemy.runtimeId);
      if (hero.killAttackGain > 0) {
        hero.battleAttackBonus += hero.killAttackGain;
      }
      if (hero.lowHpKillHeal > 0 && hero.maxHp > 0 && hero.hp / hero.maxHp < 0.5) {
        hero.hp = Math.min(hero.maxHp, hero.hp + hero.lowHpKillHeal);
      }
      if (hero.killHeal > 0) {
        hero.hp = Math.min(hero.maxHp, hero.hp + hero.killHeal);
      }
      if (hero.killHealRatio > 0) {
        const amount = Math.max(1, Math.round(hero.maxHp * hero.killHealRatio));
        const before = hero.hp;
        hero.hp = Math.min(hero.maxHp, hero.hp + amount);
        if (hero.characterId === "kaige") {
          hero.kaigeMetrics.killHealing += hero.hp - before;
        }
      }
    });
}

function searchDuelCandidates() {
  const candidates = [];
  for (const maxHp of [220, 250, 280, 310, 340]) {
    for (const attack of [18, 21, 24, 27, 30]) {
      for (const defense of [4, 6, 8, 10]) {
        for (const heavyMultiplier of [1.5, 1.75, 2]) {
          const candidate = { maxHp, attack, defense, heavyMultiplier };
          const results = duelProfiles.map((profile) => withSeed(
            seedFromText(`kaige-duel-search:${profile.id}:${maxHp}:${attack}:${defense}:${heavyMultiplier}`),
            () => simulateDuelProfile({
              rounds: DUEL_SEARCH_ROUNDS,
              profile,
              candidate
            })
          ));
          candidates.push({
            candidate,
            results,
            score: scoreDuelCandidate(results)
          });
        }
      }
    }
  }
  return candidates.sort((left, right) => left.score - right.score);
}

function simulateDuelProfile({ rounds, profile, candidate }) {
  let wins = 0;
  let playerHpRatioTotal = 0;
  let kaigeHpRatioOnLossTotal = 0;
  let losses = 0;
  let turnTotal = 0;
  let heavyAttackTotal = 0;

  for (let round = 0; round < rounds; round += 1) {
    const result = simulateDuel({ profile, candidate });
    turnTotal += result.turns;
    heavyAttackTotal += result.heavyAttacks;
    if (result.won) {
      wins += 1;
      playerHpRatioTotal += result.playerHpRatio;
    } else {
      losses += 1;
      kaigeHpRatioOnLossTotal += result.kaigeHpRatio;
    }
  }

  return {
    profileId: profile.id,
    label: profile.label,
    characterId: profile.characterId,
    level: profile.level,
    weaponId: profile.weaponId,
    target: profile.target,
    rounds,
    wins,
    winRatio: wins / rounds,
    averagePlayerHpRatioOnWin: wins > 0 ? playerHpRatioTotal / wins : null,
    averageKaigeHpRatioOnLoss: losses > 0 ? kaigeHpRatioOnLossTotal / losses : null,
    averageTurns: turnTotal / rounds,
    averageHeavyAttacks: heavyAttackTotal / rounds
  };
}

function simulateDuel({ profile, candidate }) {
  const hero = buildModelHero({
    characterId: profile.characterId,
    level: profile.level,
    weaponId: profile.weaponId
  });
  resetBattleState(hero);
  hero.activeEnemyCount = 1;
  const battleSkills = createModelBattleSkills(hero);
  battleSkills.applyBattleStartSkills();
  applyEquippedWeaponBattleStart(hero, {
    enemyCount: 1,
    encounterType: "duel"
  });

  const enemy = {
    id: "kaige-duel",
    runtimeId: "kaige-duel",
    name: "凱哥",
    displayName: "凱哥",
    maxHp: candidate.maxHp,
    hp: candidate.maxHp,
    attack: candidate.attack,
    defense: candidate.defense,
    critChance: 0.05,
    poison: 0
  };
  let fury = 0;
  let heavyAttacks = 0;

  for (let turn = 1; turn <= MAX_TURNS; turn += 1) {
    const hitLogger = createDirectHitLogger();
    const action = resolveCharacterPlayerAction({
      hero,
      enemies: [enemy],
      targetEnemyId: enemy.runtimeId,
      log: hitLogger
    });
    if (!action.handled) {
      resolveHeroAction({ hero, enemy, enemies: [enemy], log: hitLogger });
    }
    if (enemy.hp <= 0) {
      return duelResult(true, turn, hero, enemy, heavyAttacks);
    }

    for (let hit = 0; hit < hitLogger.directHits; hit += 1) {
      const furyGain = enemy.hp / enemy.maxHp <= 0.5 ? 2 : 1;
      fury = Math.min(3, fury + furyGain);
    }

    const heavy = fury >= 3;
    const attackingEnemy = {
      ...enemy,
      attack: enemy.attack + fury,
      specialAttack: heavy
        ? {
            id: "double-axe-cleave",
            name: "雙刃重斬",
            everyTurns: 1,
            hits: [
              { label: "第一斬", attackRatio: candidate.heavyMultiplier * 0.45 },
              { label: "第二斬", attackRatio: candidate.heavyMultiplier * 0.55 }
            ]
          }
        : null
    };
    resolveEnemyAction({
      hero,
      enemy: attackingEnemy,
      turn,
      log: noOpLogger,
      modifyDirectDamage: modifyCharacterIncomingDirectDamage
    });
    if (heavy) {
      fury = 0;
      heavyAttacks += 1;
    }
    battleSkills.applyEmergencyBandage();
    if (hero.hp <= 0 && !battleSkills.tryLastStand()) {
      return duelResult(false, turn, hero, enemy, heavyAttacks);
    }

    applyHeroEndOfTurnNegativeEffects({ hero, log: noOpLogger });
    applyEnemyEndOfTurnNegativeEffects({ enemy, log: noOpLogger });
    applyHeroEndOfTurnRecoveryEffects({ hero, turn, log: noOpLogger });
    applyEnemyEndOfTurnRecoveryEffects({ enemy, turn, log: noOpLogger });
    if (enemy.hp <= 0) {
      return duelResult(true, turn, hero, enemy, heavyAttacks);
    }
    if (hero.hp <= 0 && !battleSkills.tryLastStand()) {
      return duelResult(false, turn, hero, enemy, heavyAttacks);
    }
  }

  throw new Error("凱哥特殊決鬥模型超過最大回合數。");
}

function scoreDuelCandidate(results) {
  const targetError = results.reduce((sum, result) => (
    sum + (result.winRatio - result.target) ** 2
  ), 0);
  const level20Gap = getRoleGap(results, 20);
  const level25Gap = getRoleGap(results, 25);
  const gapPenalty = Math.max(0, level20Gap - 0.15) ** 2 * 4
    + Math.max(0, level25Gap - 0.15) ** 2 * 2;
  const commonAverage = averageRatio(results.filter((result) => result.profileId.includes("lv20-common")));
  const forestAverage = averageRatio(results.filter((result) => result.profileId.includes("lv20-forest")));
  const orderingPenalty = Math.max(0, commonAverage - forestAverage) ** 2 * 4;
  return targetError + gapPenalty + orderingPenalty;
}

function getRoleGap(results, level) {
  const relevant = results.filter((result) => result.level === level);
  const bySet = new Map();
  relevant.forEach((result) => {
    const setId = result.profileId.replace(/-(adventurer|archer)$/, "");
    const values = bySet.get(setId) || [];
    values.push(result.winRatio);
    bySet.set(setId, values);
  });
  return Math.max(0, ...[...bySet.values()]
    .filter((values) => values.length >= 2)
    .map((values) => Math.max(...values) - Math.min(...values)));
}

function buildModelHero({ characterId, level, weaponId }) {
  const character = characterDefinitions[characterId];
  return buildHeroFromProgression(character, {
    level,
    exp: 0,
    learnedSkills: [],
    equipment: { weaponId }
  }, {
    inventory: { weapons: { [weaponId]: true } },
    weaponDefinitions
  });
}

function resetBattleState(hero) {
  hero.poison = 0;
  hero.entangle = null;
  hero.saltErosion = null;
  hero.paralysis = null;
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
  if (hero.characterId === "kaige") {
    hero.kaigeMetrics.furyGained += hero.skillState.kaige?.fury || 0;
  }
}

function buildEncounterGroup({ region, encounterIndex, hero, boss }) {
  const encounterEntry = region.encounterPlan[encounterIndex];
  const encounterType = typeof encounterEntry === "string" ? encounterEntry : encounterEntry?.type;
  if (encounterType === "boss") {
    return createRuntimeEnemyGroup([
      { enemy: buildEnemy(region, encounterIndex, hero, { boss }) }
    ]);
  }
  const groupOptions = Array.isArray(encounterEntry?.groupOptions)
    ? encounterEntry.groupOptions
    : null;
  if (!groupOptions) {
    return createRuntimeEnemyGroup([
      { enemy: buildEnemy(region, encounterIndex, hero, { boss }) }
    ]);
  }
  const option = weightedPick(groupOptions, (entry) => Number(entry.weight) || 100);
  return createRuntimeEnemyGroup(buildEnemyGroup(region, encounterIndex, hero, option));
}

function applyEnemyAmbushes(hero, enemies) {
  enemies.forEach((enemy) => {
    const amount = Number(enemy.ambushDamage) || 0;
    if (amount > 0 && hero.hp > 1) {
      hero.hp -= Math.min(amount, hero.hp - 1);
    }
  });
}

function getBlessingChoices(pool, count) {
  const available = [...pool];
  const choices = [];
  while (choices.length < count && available.length > 0) {
    const selected = weightedPick(
      available,
      (blessing) => getBlessingRarity(blessing.rarity).weight
    );
    choices.push(selected);
    available.splice(available.indexOf(selected), 1);
  }
  return choices;
}

function chooseBlessing(choices, hero, characterId) {
  return choices
    .map((blessing) => ({
      blessing,
      score: scoreBlessing(blessing, hero, characterId)
    }))
    .sort((left, right) => (
      right.score - left.score
      || left.blessing.id.localeCompare(right.blessing.id)
    ))[0].blessing;
}

function scoreBlessing(blessing, hero, characterId) {
  const hpRatio = hero.maxHp > 0 ? hero.hp / hero.maxHp : 0;
  const roleWeights = {
    adventurer: { attack: 7, defense: 7, healing: 7, crit: 6, debuff: 5 },
    archer: { attack: 7, defense: 5, healing: 6, crit: 9, debuff: 8 },
    kaige: { attack: 9, defense: 6, healing: 8, crit: 5, debuff: 4 }
  };
  const flow = blessing.primaryFlow || blessing.category;
  let score = roleWeights[characterId]?.[flow] || 3;
  score += Math.max(0, Number(hero.blessingFlowMomentum?.[flow]) || 0) * 2;
  if (flow === "healing") {
    score += (1 - hpRatio) * 12;
    if (hpRatio <= 0.5) score += 6;
  }
  if (flow === "defense" && hpRatio <= 0.6) score += 4;
  if (flow === "attack" && characterId === "kaige") score += 2;
  return score;
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

function createDirectHitLogger() {
  const logger = {
    directHits: 0,
    template(category) {
      if (category === "hero-damage") logger.directHits += 1;
    },
    fixed() {}
  };
  return logger;
}

function createKaigeModelLogger(hero) {
  return {
    template() {},
    fixed(category, message) {
      if (category === "skill" && message.includes("破陣重斬")) {
        hero.kaigeMetrics.finishers += 1;
      } else if (category === "hero-damage" && message.includes("旋斧橫掃")) {
        hero.kaigeMetrics.sweepHits += 1;
      } else if (category === "heal" && message.includes("浴血奮戰")) {
        hero.kaigeMetrics.finisherHealing += Number(message.match(/恢復 (\d+)/)?.[1]) || 0;
      }
    }
  };
}

function getEnemyGroupHpRatio(enemies) {
  const totals = enemies.reduce((result, enemy) => ({
    hp: result.hp + Math.max(0, Number(enemy.hp) || 0),
    maxHp: result.maxHp + Math.max(1, Number(enemy.maxHp) || 1)
  }), { hp: 0, maxHp: 0 });
  return totals.maxHp > 0 ? totals.hp / totals.maxHp : 0;
}

function validateCandidateContracts() {
  const lv25 = buildModelHero({
    characterId: "kaige",
    level: 25,
    weaponId: "worn-battle-axe"
  });
  assert.equal(lv25.maxHp, 220);
  assert.equal(lv25.attack, 21);
  assert.equal(lv25.defense, 6);
  assert.equal(lv25.critChance, 0.08);
  assert.equal(lv25.killHealRatio, 0.08);
  assert.equal(lv25.lowHpAttackBonus, 3);
  assert.equal(lv25.skills.length, 12);
}

function validateModelResults({ adventureResults, duelResults, level20Gap, level25Gap }) {
  const kaigePlains = findAdventureResult(adventureResults, "plains-lv10", "kaige");
  const kaigeForest = findAdventureResult(adventureResults, "forest-lv25", "kaige");
  assert.ok(
    kaigePlains.winRatio >= 0.5 && kaigePlains.winRatio <= 0.7,
    "凱哥 Lv.10 平原模型勝場比例應落在 50%～70%"
  );
  assert.ok(
    kaigeForest.winRatio >= 0.6 && kaigeForest.winRatio <= 0.82,
    "凱哥 Lv.25 森林模型勝場比例應落在 60%～82%"
  );

  duelResults
    .filter((result) => result.profileId.includes("lv20-common"))
    .forEach((result) => {
      assert.ok(
        result.winRatio >= 0.55 && result.winRatio <= 0.7,
        `${result.label}決鬥模型勝場比例應落在 55%～70%`
      );
    });
  duelResults
    .filter((result) => result.profileId.includes("lv20-forest"))
    .forEach((result) => {
      assert.ok(
        result.winRatio >= 0.65 && result.winRatio <= 0.8,
        `${result.label}決鬥模型勝場比例應落在 65%～80%`
      );
    });
  duelResults
    .filter((result) => result.profileId.includes("lv25-coast"))
    .forEach((result) => {
      assert.ok(
        result.winRatio >= 0.9,
        `${result.label}決鬥模型勝場比例應至少達到 90%`
      );
    });
  assert.ok(level20Gap <= 0.15, "Lv.20 決鬥模型角色差距不得超過 15 個百分點");
  assert.ok(level25Gap <= 0.15, "Lv.25 決鬥模型角色差距不得超過 15 個百分點");
}

function findAdventureResult(results, scenarioId, characterId) {
  const result = results.find((entry) => (
    entry.scenarioId === scenarioId && entry.characterId === characterId
  ));
  assert.ok(result, `缺少冒險模型結果：${scenarioId}/${characterId}`);
  return result;
}

function printAdventureResult(result) {
  const metrics = result.kaigeMetrics;
  const suffix = metrics
    ? ` | 平均戰意 ${metrics.furyGained.toFixed(2)}`
      + ` | 終結技 ${metrics.finishers.toFixed(2)}`
      + ` | 橫掃命中 ${metrics.sweepHits.toFixed(2)}`
      + ` | 終結技回復 ${metrics.finisherHealing.toFixed(2)}`
      + ` | 擊殺回復 ${metrics.killHealing.toFixed(2)}`
    : "";
  console.log(
    `${result.characterName}／${result.weaponName}`
    + ` | 勝場 ${formatPercent(result.winRatio)}`
    + ` | 平均抵達 ${result.averageReached.toFixed(2)}/${result.encounterCount}`
    + ` | Boss到達 ${formatPercent(result.bossEntryRatio)}`
    + ` | 通關HP ${formatOptionalPercent(result.averageClearHpRatio)}`
    + ` | 敗北敵方HP ${formatOptionalPercent(result.averageLossEnemyHpRatio)}`
    + ` | 多敵群 ${result.averageMultiEnemyEncounters.toFixed(2)}`
    + suffix
  );
}

function printDuelResult(result) {
  console.log(
    `${result.label}`
    + ` | 勝場 ${formatPercent(result.winRatio)} (${result.wins}/${result.rounds})`
    + ` | 勝利HP ${formatOptionalPercent(result.averagePlayerHpRatioOnWin)}`
    + ` | 敗北時凱哥HP ${formatOptionalPercent(result.averageKaigeHpRatioOnLoss)}`
    + ` | 平均回合 ${result.averageTurns.toFixed(2)}`
    + ` | 凱哥重斬 ${result.averageHeavyAttacks.toFixed(2)}`
  );
}

function duelResult(won, turns, hero, enemy, heavyAttacks) {
  return {
    won,
    turns,
    playerHpRatio: hero.maxHp > 0 ? hero.hp / hero.maxHp : 0,
    kaigeHpRatio: enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 0,
    heavyAttacks
  };
}

function createKaigeMetrics() {
  return {
    furyGained: 0,
    finishers: 0,
    sweepHits: 0,
    finisherHealing: 0,
    killHealing: 0
  };
}

function addKaigeMetrics(target, source) {
  Object.keys(target).forEach((key) => {
    target[key] += Number(source?.[key]) || 0;
  });
}

function growth(level, name, entries) {
  return Object.freeze({
    level,
    name,
    effects: Object.freeze(entries.map(([stat, amount]) => (
      Object.freeze({ type: "add", stat, amount })
    )))
  });
}

function skill(id, level, entries = []) {
  return Object.freeze({
    id,
    level,
    effects: Object.freeze(entries.map(([stat, amount]) => (
      Object.freeze({ type: "add", stat, amount })
    )))
  });
}

function duelProfile(id, label, characterId, level, weaponId, target) {
  return Object.freeze({ id, label, characterId, level, weaponId, target });
}

function averageRatio(results) {
  return results.length > 0
    ? results.reduce((sum, result) => sum + result.winRatio, 0) / results.length
    : 0;
}

function formatOptionalPercent(value) {
  return Number.isFinite(value) ? formatPercent(value) : "-";
}

function hasSkill(hero, skillId) {
  return Array.isArray(hero?.skills) && hero.skills.includes(skillId);
}
