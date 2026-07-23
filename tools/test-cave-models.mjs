import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { applyBlessingEffects } from "../src/core/blessings.js";
import { applyEventEffects, scheduleRegionEvent, shouldTriggerScheduledEvent } from "../src/core/events.js";
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
import { applyEquippedWeaponBattleStart } from "../src/core/weaponBattleEffects.js";
import {
  createSeededRandom,
  encounterSortValue,
  parseRoundCount,
  seedFromText as seedFrom,
  weightedPick
} from "./model-test-helpers.mjs";

const ROUNDS = parseRoundCount(process.argv[2], 1000);
const MODE_LABEL = process.argv[3] || "v0.2.7.2-formal";
const EVENT_MODE = process.argv[4] === "no-events" ? "no-events" : "route-events";
const WEAPON_PROTOTYPE_MODE = process.argv[5] === "v02721-weapon-prototypes";
const INCLUDE_ROUTE_EVENTS = EVENT_MODE === "route-events";
const modelWeaponDefinitions = weaponDefinitions;
const LEVEL = 25;
const MAX_TURNS = 500;
const TIDE_CARVINGS_MIN_HP_RATIO = 0.35;
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

const formalCases = [
  { id: "adventurer-shared", characterId: "adventurer", weaponId: "vanguard-hunting-bow", weaponSet: "共同武器" },
  { id: "archer-shared", characterId: "archer", weaponId: "vanguard-hunting-bow", weaponSet: "共同武器" },
  { id: "adventurer-native", characterId: "adventurer", weaponId: "guard-short-sword", weaponSet: "職業合理武器" },
  { id: "archer-native", characterId: "archer", weaponId: "verdant-pursuit-bow", weaponSet: "職業合理武器" }
];
const prototypeCases = [
  { id: "adventurer-pathfinder", characterId: "adventurer", weaponId: "adventurer-pathfinder-sword", weaponSet: "v0.2.7.2.1 正式武器" },
  { id: "adventurer-tidepiercer", characterId: "adventurer", weaponId: "tidepiercer-shortbow", weaponSet: "v0.2.7.2.1 正式武器" },
  { id: "adventurer-reefbreaker", characterId: "adventurer", weaponId: "reefbreaker-warhammer", weaponSet: "v0.2.7.2.1 正式武器" },
  { id: "adventurer-brinefang", characterId: "adventurer", weaponId: "brinefang-dagger", weaponSet: "v0.2.7.2.1 正式武器" },
  { id: "archer-tidepiercer", characterId: "archer", weaponId: "tidepiercer-shortbow", weaponSet: "v0.2.7.2.1 正式武器" }
];
const cases = WEAPON_PROTOTYPE_MODE ? [...formalCases, ...prototypeCases] : formalCases;

assert.equal(route.encounterPlan.length, 16);
assert.equal(caveBlessingData.blessings.length, 15);
assert.equal(route.events?.scheduleChance, 0.6);
assert.deepEqual(route.events?.triggerBeforeEncounters, [5, 9, 13]);
assert.deepEqual(route.events?.pool, [
  "cave-rockspring",
  "cave-tide-carvings",
  "cave-deep-tide-altar"
]);
route.events.pool.forEach((eventId) => {
  assert.ok(route.eventDefinitions?.some((event) => event.id === eventId), `洞穴 Route 缺少事件 ${eventId}`);
});
retainedBeachBlessingIds.forEach((id) => assert.ok(beachBlessingData.blessings.some((b) => b.id === id), `缺少海灘祝福 ${id}`));

if (isDirectExecution()) {
  runCaveModel();
}

function runCaveModel() {
  const results = [];
  for (const scenario of cases) {
    const result = simulateCase(scenario);
    results.push({ ...scenario, mode: MODE_LABEL, eventMode: EVENT_MODE, ...result });
    console.log(formatResult({ ...scenario, mode: MODE_LABEL, eventMode: EVENT_MODE, ...result }));
  }

  console.log(`MODEL_JSON ${JSON.stringify({ mode: MODE_LABEL, eventMode: EVENT_MODE, rounds: ROUNDS, retainedBeachBlessingIds, results })}`);

  results.forEach((result) => {
    assert.ok(result.winRatio >= 0.82, `${result.id} 洞穴勝場比例不應低於 82%`);
    assert.ok(result.winRatio <= 1, `${result.id} 洞穴勝場比例必須有效`);
    assert.ok(result.bossEntryRatio >= 0.85, `${result.id} 應有至少 85% 抵達洞穴 Boss`);
    assert.ok(result.averageTurns > 60 && result.averageTurns < 180, `${result.id} 平均回合數應落在合理範圍`);
    assert.ok(result.triggeredEventRatio <= result.scheduledEventRatio, `${result.id} 事件觸發率不可高於排程率`);
    assert.ok(result.averageEventBlessings <= result.triggeredEventRatio, `${result.id} 每輪事件祝福不可多於事件觸發`);

    if (INCLUDE_ROUTE_EVENTS && ROUNDS >= 1000) {
      assert.ok(result.scheduledEventRatio >= 0.54 && result.scheduledEventRatio <= 0.66, `${result.id} 洞穴事件排程率應接近正式 60%`);
      assert.ok(result.eventDeathRatio <= 0.02, `${result.id} 洞穴事件死亡比例不應高於 2%`);
    }
    if (!INCLUDE_ROUTE_EVENTS) {
      assert.equal(result.scheduledEventRatio, 0, `${result.id} 無事件模式不應建立事件排程`);
      assert.equal(result.triggeredEventRatio, 0, `${result.id} 無事件模式不應觸發事件`);
      assert.equal(result.averageEventBlessings, 0, `${result.id} 無事件模式不應取得事件祝福`);
    }
  });
}

function simulateCase({ id, characterId, weaponId }) {
  let wins = 0;
  let reachedTotal = 0;
  let clearHpRatioTotal = 0;
  let bossEntryHpRatioTotal = 0;
  let bossEntries = 0;
  let totalTurns = 0;
  let scheduledEvents = 0;
  let triggeredEvents = 0;
  let eventBlessings = 0;
  let eventDeaths = 0;
  const eventOutcomes = new Map();
  const defeatsByEncounter = new Map();
  const selectedBlessingCounts = new Map();
  const selectedRarityCounts = new Map();
  const hpAfterEncounterTotals = Array(route.encounterPlan.length).fill(0);
  const hpAfterEncounterSamples = Array(route.encounterPlan.length).fill(0);

  for (let run = 0; run < ROUNDS; run += 1) {
    const combatSeed = seedFrom(`${id}:combat:${run}`);
    const blessingRng = createSeededRandom(seedFrom(`${id}:blessing:${run}`));
    const eventRng = createSeededRandom(seedFrom(`${id}:event:${run}`));
    const eventSchedule = INCLUDE_ROUTE_EVENTS ? scheduleRegionEvent(route, eventRng) : null;
    if (eventSchedule) scheduledEvents += 1;
    const originalRandom = Math.random;
    Math.random = createSeededRandom(combatSeed);
    try {
      const hero = createCaveEntryHero({ characterId, weaponId });
      let reached = 0;
      let cleared = true;

      for (let encounterIndex = 0; encounterIndex < route.encounterPlan.length; encounterIndex += 1) {
        if (shouldTriggerScheduledEvent(eventSchedule, encounterIndex)) {
          triggeredEvents += 1;
          const eventResult = resolveScheduledEvent({
            hero,
            eventId: eventSchedule.eventId,
            characterId,
            encounterIndex,
            blessingRng
          });
          eventOutcomes.set(eventResult.outcomeId, (eventOutcomes.get(eventResult.outcomeId) || 0) + 1);
          if (eventResult.grantedBlessing) {
            eventBlessings += 1;
            selectedBlessingCounts.set(
              eventResult.blessing.id,
              (selectedBlessingCounts.get(eventResult.blessing.id) || 0) + 1
            );
            selectedRarityCounts.set(
              eventResult.blessing.rarity,
              (selectedRarityCounts.get(eventResult.blessing.rarity) || 0) + 1
            );
          }
          if (eventResult.heroDefeated) {
            eventDeaths += 1;
            cleared = false;
            defeatsByEncounter.set(`event-before-${encounterIndex + 1}`, (defeatsByEncounter.get(`event-before-${encounterIndex + 1}`) || 0) + 1);
            break;
          }
        }

        reached = encounterIndex + 1;
        if (encounterIndex === route.encounterPlan.length - 1) {
          bossEntries += 1;
          bossEntryHpRatioTotal += hero.maxHp > 0 ? hero.hp / hero.maxHp : 0;
        }

        const enemies = buildRouteEnemyGroup(encounterIndex);
        const battleSkills = beginBattle(hero, enemies, {
          isBoss: encounterIndex === route.encounterPlan.length - 1
        });
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
    scheduledEventRatio: scheduledEvents / ROUNDS,
    triggeredEventRatio: triggeredEvents / ROUNDS,
    averageEventBlessings: eventBlessings / ROUNDS,
    eventDeathRatio: eventDeaths / ROUNDS,
    eventOutcomes: Object.fromEntries([...eventOutcomes.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
    defeatsByEncounter: Object.fromEntries([...defeatsByEncounter.entries()].sort(compareEncounterKeys)),
    averageCaveBlessingCount: [...selectedBlessingCounts.values()]
      .reduce((total, count) => total + count, 0) / ROUNDS,
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

export function simulateContinuousCavePhase({
  hero,
  id,
  characterId,
  run = 0,
  includeRouteEvents = true
}) {
  const blessingRng = createSeededRandom(seedFrom(`${id}:blessing:${run}`));
  const eventRng = createSeededRandom(seedFrom(`${id}:event:${run}`));
  const eventSchedule = includeRouteEvents ? scheduleRegionEvent(route, eventRng) : null;
  const originalRandom = Math.random;
  Math.random = createSeededRandom(seedFrom(`${id}:combat:${run}`));
  let reached = 0;
  let bossEntered = false;
  let turns = 0;
  let triggeredEvent = false;
  let eventDeath = false;

  try {
    for (let encounterIndex = 0; encounterIndex < route.encounterPlan.length; encounterIndex += 1) {
      if (shouldTriggerScheduledEvent(eventSchedule, encounterIndex)) {
        triggeredEvent = true;
        const eventResult = resolveScheduledEvent({
          hero,
          eventId: eventSchedule.eventId,
          characterId,
          encounterIndex,
          blessingRng
        });
        if (eventResult.heroDefeated) {
          eventDeath = true;
          return {
            cleared: false,
            hero,
            reached,
            bossEntered,
            turns,
            eventScheduled: Boolean(eventSchedule),
            triggeredEvent,
            eventDeath,
            defeatKey: `event-before-${encounterIndex + 17}`
          };
        }
      }

      reached = encounterIndex + 1;
      bossEntered ||= encounterIndex === route.encounterPlan.length - 1;
      const enemies = buildRouteEnemyGroup(encounterIndex);
      const battleSkills = beginBattle(hero, enemies, {
        isBoss: encounterIndex === route.encounterPlan.length - 1
      });
      const encounter = simulateEncounter({ hero, enemies, battleSkills });
      turns += encounter.turns;

      if (!encounter.won) {
        return {
          cleared: false,
          hero,
          reached,
          bossEntered,
          turns,
          eventScheduled: Boolean(eventSchedule),
          triggeredEvent,
          eventDeath,
          defeatKey: String(encounterIndex + 17)
        };
      }

      battleSkills.applyVictorySkills();
      battleSkills.consumeBattleLimitedEffects();
      if (encounterIndex < route.encounterPlan.length - 1) {
        const choices = getBlessingChoices(caveBlessingData.blessings, 3, blessingRng);
        const selected = chooseBlessing({ characterId, choices, hero, encounterIndex });
        applyBlessingEffects(hero, selected);
      }
    }

    return {
      cleared: true,
      hero,
      reached,
      bossEntered,
      turns,
      eventScheduled: Boolean(eventSchedule),
      triggeredEvent,
      eventDeath,
      defeatKey: null
    };
  } finally {
    Math.random = originalRandom;
  }
}

function createCaveEntryHero({ characterId, weaponId }) {
  const hero = buildHeroFromProgression(characterDefinitions[characterId], {
    level: LEVEL,
    exp: 0,
    learnedSkills: [],
    equipment: { weaponId }
  }, {
    inventory: { weapons: { [weaponId]: true } },
    weaponDefinitions: modelWeaponDefinitions
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


function resolveScheduledEvent({ hero, eventId, characterId, encounterIndex, blessingRng }) {
  const event = route.eventDefinitions?.find((entry) => entry.id === eventId);
  assert.ok(event, `洞穴模型找不到事件 ${eventId}`);
  const choice = chooseModelEventChoice({ event, hero });
  assert.ok(choice, `洞穴模型事件 ${eventId} 缺少可用選項`);

  const effectResult = applyEventEffects({
    effects: choice.result?.effects,
    hero
  });
  if (effectResult.heroDefeated) {
    return { outcomeId: `${eventId}:${choice.id}:defeated`, blessing: null, grantedBlessing: false, heroDefeated: true };
  }

  const target = choice.result?.defaultTarget;
  if (target?.type !== "chooseBlessing") {
    return { outcomeId: `${eventId}:${choice.id}`, blessing: null, grantedBlessing: false, heroDefeated: false };
  }

  const blessing = chooseEventBlessing({
    characterId,
    hero,
    encounterIndex,
    blessingRng,
    rarity: target.rarity || null,
    count: target.count
  });
  applyBlessingEffects(hero, blessing);
  return { outcomeId: `${eventId}:${choice.id}`, blessing, grantedBlessing: true, heroDefeated: false };
}

function chooseModelEventChoice({ event, hero }) {
  if (event.id === "cave-rockspring") {
    return event.choices.find((choice) => choice.id === "rest");
  }
  if (event.id === "cave-tide-carvings") {
    const readChoice = event.choices.find((choice) => choice.id === "read");
    const leaveChoice = event.choices.find((choice) => choice.id === "leave");
    const damage = getChoiceLoseHp(readChoice);
    const safeToRead = hero.hp > damage && hero.hp / hero.maxHp >= TIDE_CARVINGS_MIN_HP_RATIO;
    return safeToRead ? readChoice : leaveChoice;
  }
  if (event.id === "cave-deep-tide-altar") {
    const readChoice = event.choices.find((choice) => choice.id === "read");
    const materialsChoice = event.choices.find((choice) => choice.id === "materials");
    assert.equal(
      getChoiceLoseHp(readChoice),
      getChoiceLoseHp(materialsChoice),
      "深潮石壇模型選擇依賴兩條路線承受相同生命代價"
    );
    return readChoice;
  }
  return event.choices?.[0] || null;
}

function getChoiceLoseHp(choice) {
  return (choice?.result?.effects || []).reduce((total, effect) => {
    return effect.type === "loseHp" ? total + Math.max(0, Math.floor(Number(effect.amount) || 0)) : total;
  }, 0);
}

function chooseEventBlessing({ characterId, hero, encounterIndex, blessingRng, rarity = null, count = 3 }) {
  const pool = rarity
    ? caveBlessingData.blessings.filter((blessing) => blessing.rarity === rarity)
    : caveBlessingData.blessings;
  const choices = getBlessingChoices(pool, Math.max(1, Number(count) || 3), blessingRng);
  return chooseBlessing({ characterId, choices, hero, encounterIndex });
}

function beginBattle(hero, enemies, { isBoss = false } = {}) {
  hero.poison = 0;
  hero.entangle = null;
  hero.saltErosion = null;
  hero.paralysis = null;
  hero.activeEnemyCount = getLivingEnemies(enemies).length;
  hero.battleAttackBonus = 0;
  hero.battleCritBonus = 0;
  hero.hasAttackedThisBattle = false;
  hero.weaponBattleStartApplied = false;
  hero.weaponBattleMode = null;
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
  applyEquippedWeaponBattleStart(hero, {
    enemyCount: getLivingEnemies(enemies).length,
    encounterType: isBoss ? "boss" : "normal"
  });
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

function formatResult(result) {
  const defeats = Object.entries(result.defeatsByEncounter)
    .sort(compareEncounterKeys)
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
    modelWeaponDefinitions[result.weaponId].name,
    result.weaponSet,
    `勝場比例 ${(result.winRatio * 100).toFixed(2)}%`,
    `平均抵達 ${result.averageReached.toFixed(2)}/16`,
    `Boss到達 ${(result.bossEntryRatio * 100).toFixed(2)}%`,
    `Boss前HP ${result.averageBossEntryHpRatio == null ? "-" : (result.averageBossEntryHpRatio * 100).toFixed(2) + "%"}`,
    `通關HP ${result.averageClearHpRatio == null ? "-" : (result.averageClearHpRatio * 100).toFixed(2) + "%"}`,
    `平均回合 ${result.averageTurns.toFixed(1)}`,
    `模式 ${result.eventMode}`,
    `事件排程 ${(result.scheduledEventRatio * 100).toFixed(1)}%`,
    `事件觸發 ${(result.triggeredEventRatio * 100).toFixed(1)}%`,
    `事件祝福 ${result.averageEventBlessings.toFixed(2)}`,
    `洞穴祝福 ${result.averageCaveBlessingCount.toFixed(2)}`,
    `事件死亡 ${(result.eventDeathRatio * 100).toFixed(2)}%`,
    `主要敗北 ${defeats}`,
    `常選 ${topPicks}`
  ].join(" | ");
}

function compareEncounterKeys([left], [right]) {
  return encounterSortValue(left) - encounterSortValue(right) || String(left).localeCompare(String(right));
}

function isDirectExecution() {
  return Boolean(
    process.argv[1]
    && pathToFileURL(resolve(process.argv[1])).href === import.meta.url
  );
}
