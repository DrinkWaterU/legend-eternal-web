import assert from "node:assert/strict";

import { applyBlessingEffects } from "../src/core/blessings.js";
import { clearHeroBattleRuntimeState } from "../src/core/heroBattleState.js";
import { buildHeroFromProgression } from "../src/core/progression.js";
import { characterDefinitions } from "../src/data/characters/index.js";
import { weaponDefinitions } from "../src/data/weapons.js";
import {
  selectContinuousCampBlessings,
  simulateContinuousBeachPhase
} from "./test-beach-models.mjs";
import { simulateContinuousCavePhase } from "./test-cave-models.mjs";
import {
  encounterSortValue,
  formatPercent,
  parseRoundCount
} from "./model-test-helpers.mjs";

const ROUNDS = parseRoundCount(process.argv[2], 1000);
const CAMP_HEAL_RATIO = 0.5;
const CAMP_BLESSING_COUNT = 8;
const scenarios = [
  {
    id: "adventurer-pathfinder",
    characterId: "adventurer",
    weaponId: "adventurer-pathfinder-sword"
  },
  {
    id: "adventurer-tidepiercer",
    characterId: "adventurer",
    weaponId: "tidepiercer-shortbow"
  },
  {
    id: "adventurer-reefbreaker",
    characterId: "adventurer",
    weaponId: "reefbreaker-warhammer"
  },
  {
    id: "adventurer-brinefang",
    characterId: "adventurer",
    weaponId: "brinefang-dagger"
  },
  {
    id: "archer-tidepiercer",
    characterId: "archer",
    weaponId: "tidepiercer-shortbow"
  }
];

const results = scenarios.map(runScenario);
results.forEach((result) => console.log(formatResult(result)));
console.log(`MODEL_JSON ${JSON.stringify({
  model: "v0.2.7.2.1-coast-continuous-32",
  rounds: ROUNDS,
  assumptions: {
    level: 25,
    preparation: "none",
    beachBlessingChoices: 3,
    campBlessingCount: CAMP_BLESSING_COUNT,
    campHealRatio: CAMP_HEAL_RATIO,
    routeEvents: true
  },
  results
})}`);

for (const result of results) {
  assert.ok(result.beachClearRatio >= 0 && result.beachClearRatio <= 1);
  assert.ok(result.caveConditionalWinRatio >= 0 && result.caveConditionalWinRatio <= 1);
  assert.ok(result.fullClearRatio >= 0 && result.fullClearRatio <= result.beachClearRatio);
  assert.ok(result.fullBossEntryRatio >= result.fullClearRatio);
  assert.equal(result.campRetainedBlessingAverage, result.beachClears > 0 ? CAMP_BLESSING_COUNT : 0);
}

function runScenario({ id, characterId, weaponId }) {
  let beachClears = 0;
  let caveClears = 0;
  let beachBossEntries = 0;
  let caveBossEntries = 0;
  let beachReachedTotal = 0;
  let caveReachedTotal = 0;
  let finalHpRatioTotal = 0;
  let eventSchedules = 0;
  let eventTriggers = 0;
  let eventDeaths = 0;
  const defeatsByEncounter = new Map();
  const retainedBlessingCounts = new Map();

  for (let run = 0; run < ROUNDS; run += 1) {
    const beach = simulateContinuousBeachPhase({
      characterId,
      weaponId,
      run
    });
    beachReachedTotal += beach.reached;
    if (beach.bossEntered) beachBossEntries += 1;
    if (!beach.cleared) {
      addCount(defeatsByEncounter, String(beach.reached));
      continue;
    }

    beachClears += 1;
    const selected = selectContinuousCampBlessings({
      characterId,
      hero: beach.hero,
      blessingInstances: beach.blessingInstances,
      count: CAMP_BLESSING_COUNT
    });
    assert.equal(selected.length, CAMP_BLESSING_COUNT, "海灘通關後應可保留 8 個 Blessing");
    selected.forEach((instance) => addCount(retainedBlessingCounts, instance.blessingId));
    const caveHero = rebuildCampHero({ characterId, weaponId, selected });
    const cave = simulateContinuousCavePhase({
      hero: caveHero,
      id,
      characterId,
      run,
      includeRouteEvents: true
    });
    caveReachedTotal += cave.reached;
    if (cave.bossEntered) caveBossEntries += 1;
    if (cave.eventScheduled) eventSchedules += 1;
    if (cave.triggeredEvent) eventTriggers += 1;
    if (cave.eventDeath) eventDeaths += 1;

    if (!cave.cleared) {
      addCount(defeatsByEncounter, cave.defeatKey);
      continue;
    }

    caveClears += 1;
    finalHpRatioTotal += cave.hero.maxHp > 0 ? cave.hero.hp / cave.hero.maxHp : 0;
  }

  return {
    id,
    characterId,
    characterName: characterDefinitions[characterId].name,
    weaponId,
    weaponName: weaponDefinitions[weaponId].name,
    rounds: ROUNDS,
    beachClears,
    caveClears,
    beachClearRatio: beachClears / ROUNDS,
    caveConditionalWinRatio: beachClears > 0 ? caveClears / beachClears : 0,
    fullClearRatio: caveClears / ROUNDS,
    beachBossEntryRatio: beachBossEntries / ROUNDS,
    caveBossEntryRatio: beachClears > 0 ? caveBossEntries / beachClears : 0,
    fullBossEntryRatio: caveBossEntries / ROUNDS,
    averageBeachReached: beachReachedTotal / ROUNDS,
    averageCaveReached: beachClears > 0 ? caveReachedTotal / beachClears : 0,
    averageFinalHpRatio: caveClears > 0 ? finalHpRatioTotal / caveClears : null,
    eventScheduleRatio: beachClears > 0 ? eventSchedules / beachClears : 0,
    eventTriggerRatio: beachClears > 0 ? eventTriggers / beachClears : 0,
    eventDeathRatio: beachClears > 0 ? eventDeaths / beachClears : 0,
    campRetainedBlessingAverage: beachClears > 0
      ? [...retainedBlessingCounts.values()].reduce((total, count) => total + count, 0) / beachClears
      : 0,
    retainedBlessingsPerCamp: Object.fromEntries(
      [...retainedBlessingCounts.entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .map(([blessingId, count]) => [blessingId, beachClears > 0 ? count / beachClears : 0])
    ),
    defeatsByEncounter: Object.fromEntries(
      [...defeatsByEncounter.entries()]
        .sort((left, right) => encounterSortValue(left[0]) - encounterSortValue(right[0]))
    )
  };
}

function rebuildCampHero({ characterId, weaponId, selected }) {
  const hero = buildHeroFromProgression(characterDefinitions[characterId], {
    level: 25,
    exp: 0,
    learnedSkills: [],
    equipment: { weaponId }
  }, {
    inventory: { weapons: { [weaponId]: true } },
    weaponDefinitions
  });
  hero.blessings = [];
  selected.forEach((instance) => {
    applyBlessingEffects(hero, instance.definition, {
      instanceId: instance.instanceId,
      skipImmediate: true,
      runtimeState: instance.runtime
    });
    hero.blessings.push(instance.definition.name);
  });
  clearHeroBattleRuntimeState(hero);
  hero.hp = Math.max(1, Math.round(hero.maxHp * CAMP_HEAL_RATIO));
  return hero;
}

function formatResult(result) {
  const defeats = Object.entries(result.defeatsByEncounter)
    .sort((left, right) => Number(right[1]) - Number(left[1]))
    .slice(0, 5)
    .map(([encounter, count]) => `${encounter}:${count}`)
    .join(",") || "無";
  const retained = Object.entries(result.retainedBlessingsPerCamp)
    .slice(0, 5)
    .map(([blessingId, average]) => `${blessingId}=${average.toFixed(2)}`)
    .join(", ") || "無";
  return [
    `${result.characterName}／${result.weaponName}`,
    `海灘通過 ${formatPercent(result.beachClearRatio)} (${result.beachClears}/${result.rounds})`,
    `洞穴條件勝場 ${formatPercent(result.caveConditionalWinRatio)} (${result.caveClears}/${result.beachClears})`,
    `完整32場勝場 ${formatPercent(result.fullClearRatio)} (${result.caveClears}/${result.rounds})`,
    `海灘Boss到達 ${formatPercent(result.beachBossEntryRatio)}`,
    `洞穴Boss到達(入洞後) ${formatPercent(result.caveBossEntryRatio)}`,
    `完整Boss到達 ${formatPercent(result.fullBossEntryRatio)}`,
    `通關HP ${result.averageFinalHpRatio == null ? "-" : formatPercent(result.averageFinalHpRatio)}`,
    `事件排程 ${formatPercent(result.eventScheduleRatio)}`,
    `主要敗北 ${defeats}`,
    `扎營常留 ${retained}`
  ].join(" | ");
}

function addCount(counts, key) {
  counts.set(key, (counts.get(key) || 0) + 1);
}
