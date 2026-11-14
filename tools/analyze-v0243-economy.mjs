import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { applyBlessingEffects } from "../src/core/blessings.js";
import {
  applyEnemyEndOfTurnNegativeEffects,
  applyEnemyEndOfTurnRecoveryEffects,
  applyHeroEndOfTurnNegativeEffects,
  applyHeroEndOfTurnRecoveryEffects,
  buildEnemy,
  buildScaledEnemy,
  resolveEnemyAction,
  resolveHeroAction,
  resolveHeroEntangle
} from "../src/core/combat.js";
import { sellMaterials, spendInventoryCost } from "../src/core/commerce.js";
import { applyEnemyDefeatReactions } from "../src/core/enemyReactions.js";
import {
  createRuntimeEnemyGroup,
  getLivingEnemies,
  resolveTargetEnemy
} from "../src/core/enemyGroups.js";
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
import {
  applyRewardsToInventory,
  createEmptyRewards,
  mergeRewards,
  rollEnemyRewards
} from "../src/core/rewards.js";
import {
  initializeCharacterBattleState,
  modifyCharacterIncomingDirectDamage,
  resolveCharacterPlayerAction
} from "../src/characters/skills/index.js";
import { characterDefinitions } from "../src/data/characters/index.js";
import { getBlessingPool } from "../src/data/blessings/index.js";
import { getEnemyDefinition } from "../src/data/enemies/index.js";
import { materialDefinitions } from "../src/data/materials.js";
import { forestRegion } from "../src/data/regions/forest.js";
import { plainsRegion } from "../src/data/regions/plains.js";
import { getBlessingRarity } from "../src/data/rarities.js";
import { getRouteDefinition, getRouteGroup } from "../src/data/routes/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const SAMPLE_ROUNDS = positiveInt(process.argv[2], 4000);
const FULL_CLEAR_ROUNDS = positiveInt(process.argv[3], 100000);
const AGENTS = positiveInt(process.argv[4], 5000);
const HORIZON = positiveInt(process.argv[5], 100);
const MAX_TURNS = 500;
const logger = { template() {}, fixed() {} };
const goblinRoute = getRouteDefinition("goblin-camp");
const goblinPool = getBlessingPool("goblin")?.blessings || [];

const preparationCases = {
  plains: [
    { key: "none", id: null, enhanced: false, label: "無整備" },
    ...plainsRegion.preparations.flatMap((preparation) => [
      { key: `${preparation.id}:normal`, id: preparation.id, enhanced: false, label: preparation.name },
      { key: `${preparation.id}:enhanced`, id: preparation.id, enhanced: true, label: `${preparation.name}・強化` }
    ])
  ],
  forest: [
    { key: "none", id: null, enhanced: false, label: "無整備" },
    ...forestRegion.preparations.flatMap((preparation) => [
      { key: `${preparation.id}:normal`, id: preparation.id, enhanced: false, label: preparation.name },
      { key: `${preparation.id}:enhanced`, id: preparation.id, enhanced: true, label: `${preparation.name}・強化` }
    ])
  ]
};

const scenarios = [
  {
    id: "plains-lv10",
    label: "平原 Lv.10 冒險者",
    region: plainsRegion,
    characterId: "adventurer",
    level: 10,
    mode: "main",
    eventPolicy: "none",
    retreatThreshold: 0,
    prepGroup: "plains",
    seed: 0x24310010,
    caseKeys: null
  },
  {
    id: "plains-lv15",
    label: "平原 Lv.15 冒險者",
    region: plainsRegion,
    characterId: "adventurer",
    level: 15,
    mode: "main",
    eventPolicy: "none",
    retreatThreshold: 0,
    prepGroup: "plains",
    seed: 0x24310015,
    caseKeys: ["none"]
  },
  {
    id: "forest-main-lv25",
    label: "森林主線 Lv.25 弓箭手（略過事件介入）",
    region: forestRegion,
    characterId: "archer",
    level: 25,
    mode: "main",
    eventPolicy: "leave",
    retreatThreshold: 0,
    prepGroup: "forest",
    seed: 0x24320025,
    caseKeys: null
  },
  {
    id: "forest-main-attack-lv25",
    label: "森林主線 Lv.25 弓箭手（事件出現時攻擊後返回主線）",
    region: forestRegion,
    characterId: "archer",
    level: 25,
    mode: "main",
    eventPolicy: "attack-return",
    eventChance: 0.3,
    retreatThreshold: 0,
    prepGroup: "forest",
    seed: 0x24320125,
    caseKeys: ["none", "web-cutting-knife:normal", "web-cutting-knife:enhanced"]
  },
  {
    id: "goblin-expedition-lv25",
    label: "哥布林營地完整遠征 Lv.25 弓箭手（條件於事件已出現）",
    region: forestRegion,
    characterId: "archer",
    level: 25,
    mode: "goblin-expedition",
    eventPolicy: "follow-route",
    eventChance: 1,
    retreatThreshold: 0,
    prepGroup: "forest",
    seed: 0x24330025,
    caseKeys: ["none", "insect-repellent-powder:enhanced", "forest-bandage:normal", "forest-bandage:enhanced", "web-cutting-knife:enhanced"]
  }
];

console.log(`v0.2.4.3 economy model: samples=${SAMPLE_ROUNDS}, fullClear=${FULL_CLEAR_ROUNDS}, agents=${AGENTS}, horizon=${HORIZON}`);
validateFastEconomicPath();

const fullClear = withSeed(0x2430f00d, () => ({
  plains: simulateFullClearRewards({ source: "plains", rounds: FULL_CLEAR_ROUNDS }),
  forestMain: simulateFullClearRewards({ source: "forest-main", rounds: FULL_CLEAR_ROUNDS }),
  forestEventAttack: simulateFullClearRewards({ source: "forest-event-attack", rounds: FULL_CLEAR_ROUNDS }),
  goblinRoute: simulateFullClearRewards({ source: "goblin-route", rounds: FULL_CLEAR_ROUNDS })
}));

const samplePools = {};
for (const scenario of scenarios) {
  samplePools[scenario.id] = {};
  const allCases = preparationCases[scenario.prepGroup];
  const cases = scenario.caseKeys ? allCases.filter((entry) => scenario.caseKeys.includes(entry.key)) : allCases;
  console.log(`\n[combat] ${scenario.label}`);
  for (let index = 0; index < cases.length; index += 1) {
    const prep = cases[index];
    const rounds = scenario.mode === "goblin-expedition"
      ? Math.max(400, Math.floor(SAMPLE_ROUNDS * 0.5))
      : SAMPLE_ROUNDS;
    const samples = withSeed(scenario.seed + index * 7919, () => simulateAdventurePool({
      scenario,
      preparationId: prep.id,
      preparationEnhanced: prep.enhanced,
      rounds
    }));
    samplePools[scenario.id][prep.key] = samples;
    const summary = summarizeSamples(samples);
    console.log(`${prep.label.padEnd(16)} clear=${pct(summary.clearRate)} retreat=${pct(summary.retreatRate)} value=${summary.meanSellValue.toFixed(2)} reached=${summary.meanReached.toFixed(2)}`);
  }
}

const retreatSensitivity = {};
console.log("\n[combat] 撤退門檻敏感度");
for (const threshold of [0.25, 0.4, 0.55]) {
  const scenario = {
    ...scenarios.find((entry) => entry.id === "forest-main-lv25"),
    id: `forest-retreat-${threshold}`,
    label: `森林 Lv.25 強化林地繃帶／撤退門檻 ${Math.round(threshold * 100)}%`,
    retreatThreshold: threshold,
    seed: 0x24340000 + Math.round(threshold * 100)
  };
  const samples = withSeed(scenario.seed, () => simulateAdventurePool({
    scenario,
    preparationId: "forest-bandage",
    preparationEnhanced: true,
    rounds: SAMPLE_ROUNDS
  }));
  retreatSensitivity[threshold] = summarizeSamples(samples);
  console.log(`HP < ${Math.round(threshold * 100)}% clear=${pct(retreatSensitivity[threshold].clearRate)} retreat=${pct(retreatSensitivity[threshold].retreatRate)} value=${retreatSensitivity[threshold].meanSellValue.toFixed(2)}`);
}

console.log("\n[economy] 長期代理玩家");
const longTerm = withSeed(0x2435beef, () => runLongTermModels({ samplePools }));

const report = {
  metadata: {
    gameVersion: fs.readFileSync(path.join(projectRoot, "VERSION"), "utf8").trim(),
    generatedAt: new Date().toISOString(),
    sampleRounds: SAMPLE_ROUNDS,
    goblinSampleRounds: Math.max(400, Math.floor(SAMPLE_ROUNDS * 0.5)),
    fullClearRounds: FULL_CLEAR_ROUNDS,
    agents: AGENTS,
    horizon: HORIZON,
    methodology: "正式戰鬥核心、正式角色 progression、正式敵人建構／群組 scaling、正式 Blessing 套用、正式 Preparation runtime、正式掉落與 Commerce API 的隔離模擬"
  },
  fullClear,
  scenarios: Object.fromEntries(scenarios.map((scenario) => [
    scenario.id,
    {
      label: scenario.label,
      preparations: Object.fromEntries(Object.entries(samplePools[scenario.id]).map(([key, samples]) => {
        const prep = preparationCases[scenario.prepGroup].find((entry) => entry.key === key);
        return [key, { label: prep?.label || key, ...summarizeSamples(samples) }];
      }))
    }
  ])),
  retreatSensitivity,
  longTerm
};

const outputDir = path.join(projectRoot, "tools", "output");
fs.mkdirSync(outputDir, { recursive: true });
const jsonPath = path.join(outputDir, "v0243-economy-model.json");
const mdPath = path.join(outputDir, "v0243-economy-model.md");
fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2) + "\n", "utf8");
fs.writeFileSync(mdPath, buildMarkdownReport(report), "utf8");

console.log(`\nReport: ${path.relative(projectRoot, mdPath)}`);
console.log(`Raw JSON: ${path.relative(projectRoot, jsonPath)}`);

function validateFastEconomicPath() {
  const base = {
    gold: 10,
    materials: {
      slime_gel: { id: "slime_gel", name: "史萊姆凝膠", quantity: 3 },
      soft_hide: { id: "soft_hide", name: "柔韌獸皮", quantity: 2 }
    }
  };
  const formal = structuredClone(base);
  const fast = structuredClone(base);
  sellMaterials({ inventory: formal, materialDefinitions, sales: [{ materialId: "slime_gel", quantity: 1 }] });
  fastSellMaterials({ inventory: fast, sales: [{ materialId: "slime_gel", quantity: 1 }] });
  assert.deepEqual(fast, formal, "快速經濟模型的出售結果必須等同正式 Commerce");
  spendInventoryCost({
    inventory: formal,
    materialDefinitions,
    goldCost: 4,
    materialCosts: [{ materialId: "slime_gel", quantity: 1 }, { materialId: "soft_hide", quantity: 1 }]
  });
  fastSpendInventoryCost({
    inventory: fast,
    goldCost: 4,
    materialCosts: [{ materialId: "slime_gel", quantity: 1 }, { materialId: "soft_hide", quantity: 1 }]
  });
  assert.deepEqual(fast, formal, "快速經濟模型的付款結果必須等同正式 Commerce");
  const rewards = { gold: 0, materials: { slime_gel: { id: "slime_gel", name: "史萊姆凝膠", quantity: 2 } } };
  applyRewardsToInventory(formal, rewards);
  fastApplyRewards(fast, rewards);
  assert.deepEqual(fast, formal, "快速經濟模型的獎勵合併必須等同正式 inventory 流程");
}

function fastSellMaterials({ inventory, sales }) {
  let totalGold = 0;
  for (const sale of sales) {
    const material = inventory.materials[sale.materialId];
    const quantity = sale.quantity;
    totalGold += (materialDefinitions[sale.materialId]?.sellPrice || 0) * quantity;
    const remaining = material.quantity - quantity;
    if (remaining <= 0) delete inventory.materials[sale.materialId];
    else material.quantity = remaining;
  }
  inventory.gold += totalGold;
  return totalGold;
}

function fastSpendInventoryCost({ inventory, goldCost, materialCosts }) {
  inventory.gold -= goldCost;
  for (const cost of materialCosts) {
    const material = inventory.materials[cost.materialId];
    const remaining = material.quantity - cost.quantity;
    if (remaining <= 0) delete inventory.materials[cost.materialId];
    else material.quantity = remaining;
  }
}

function fastApplyRewards(inventory, rewards) {
  inventory.gold += rewards.gold || 0;
  for (const [id, reward] of Object.entries(rewards.materials || {})) {
    const current = inventory.materials[id];
    if (current) current.quantity += reward.quantity;
    else inventory.materials[id] = { id, name: reward.name || materialDefinitions[id]?.name || id, quantity: reward.quantity };
  }
}

function simulateFullClearRewards({ source, rounds }) {
  const values = [];
  const quantities = {};
  let recipeHits = {};
  const recipeDefinitions = source === "plains"
    ? plainsRegion.preparations
    : forestRegion.preparations;
  recipeDefinitions.forEach((preparation) => { recipeHits[preparation.id] = 0; });

  for (let run = 0; run < rounds; run += 1) {
    let rewards = createEmptyRewards();
    if (source === "plains" || source === "forest-main") {
      const region = source === "plains" ? plainsRegion : forestRegion;
      const bosses = region.bosses || [region.boss];
      const boss = weightedPick(bosses, (item) => Number(item.weight) || 100);
      for (const entry of region.encounterPlan) {
        const type = getEncounterType(entry);
        const pool = type === "boss" ? [boss] : type === "elite" ? region.elites : region.enemies;
        const enemy = weightedPick(pool, (item) => Number(item.weight) || 100);
        rewards = mergeRewards(rewards, rollEnemyRewards({ rewards: enemy?.rewards }));
      }
    } else if (source === "forest-event-attack") {
      const definition = getEnemyDefinition("goblin-warrior");
      for (let index = 0; index < 2; index += 1) {
        rewards = mergeRewards(rewards, rollEnemyRewards({ rewards: definition?.rewards }));
      }
    } else if (source === "goblin-route") {
      for (const entry of goblinRoute.encounterPlan) {
        const group = getRouteGroup(goblinRoute, entry.groupId);
        for (const member of group.members) {
          const definition = getEnemyDefinition(member.enemyId);
          rewards = mergeRewards(rewards, rollEnemyRewards({
            rewards: definition?.rewards,
            rewardScale: member.rewardScale
          }));
        }
      }
    }

    const value = getRewardsSellValue(rewards);
    values.push(value);
    Object.entries(rewards.materials).forEach(([id, material]) => {
      quantities[id] = (quantities[id] || 0) + material.quantity;
    });
    for (const preparation of recipeDefinitions) {
      if (hasMaterialCosts(rewards.materials, preparation.enhancement?.materialCosts || [])) {
        recipeHits[preparation.id] += 1;
      }
    }
  }

  return {
    rounds,
    sellValue: summarizeNumbers(values),
    averageMaterials: Object.fromEntries(Object.entries(quantities)
      .map(([id, quantity]) => [id, {
        name: materialDefinitions[id]?.name || id,
        averageQuantity: quantity / rounds,
        unitPrice: materialDefinitions[id]?.sellPrice || 0,
        averageValue: (quantity / rounds) * (materialDefinitions[id]?.sellPrice || 0)
      }])
      .sort((a, b) => b[1].averageValue - a[1].averageValue)),
    recipeFromSingleClear: Object.fromEntries(recipeDefinitions.map((preparation) => [
      preparation.id,
      {
        name: preparation.name,
        probability: recipeHits[preparation.id] / rounds
      }
    ]))
  };
}

function simulateAdventurePool({ scenario, preparationId, preparationEnhanced, rounds }) {
  const samples = [];
  for (let run = 0; run < rounds; run += 1) {
    samples.push(simulateAdventure({ scenario, preparationId, preparationEnhanced }));
  }
  return samples;
}

function simulateAdventure({ scenario, preparationId, preparationEnhanced }) {
  const hero = buildHeroFromProgression(characterDefinitions[scenario.characterId], {
    level: scenario.level,
    exp: 0,
    learnedSkills: []
  });
  const preparation = preparationId
    ? createRunPreparation(scenario.region, preparationId, { enhanced: preparationEnhanced })
    : null;
  const state = {
    hero,
    preparation,
    rewards: createEmptyRewards(),
    phaseRewards: {
      main: createEmptyRewards(),
      event: createEmptyRewards(),
      route: createEmptyRewards()
    },
    kills: 0,
    reached: 0,
    formalVictories: 0,
    routeReached: 0,
    eventTriggered: false,
    outcome: "defeat",
    deathSource: null
  };

  if (scenario.mode === "goblin-expedition") {
    simulateGoblinExpedition({ state, scenario });
  } else {
    simulateMainRegion({ state, scenario });
  }

  return {
    outcome: state.outcome,
    reached: state.reached,
    routeReached: state.routeReached,
    eventTriggered: state.eventTriggered,
    kills: state.kills,
    endingHpRatio: state.hero.maxHp > 0 ? state.hero.hp / state.hero.maxHp : 0,
    rewards: state.rewards,
    phaseRewards: state.phaseRewards,
    sellValue: getRewardsSellValue(state.rewards),
    mainValue: getRewardsSellValue(state.phaseRewards.main),
    eventValue: getRewardsSellValue(state.phaseRewards.event),
    routeValue: getRewardsSellValue(state.phaseRewards.route),
    preparation: {
      triggers: preparation?.triggerCount || 0,
      healing: preparation?.healing || 0,
      prevented: preparation?.damagePrevented || 0,
      retrySuccess: preparation?.retrySuccessCount || 0
    },
    deathSource: state.deathSource
  };
}

function simulateMainRegion({ state, scenario }) {
  const region = scenario.region;
  const bosses = region.bosses || [region.boss];
  const selectedBoss = weightedPick(bosses, (boss) => Number(boss.weight) || 100);
  const eventScheduled = scenario.eventPolicy !== "none"
    && scenario.eventPolicy !== "leave"
    && Math.random() < (scenario.eventChance ?? region.events?.scheduleChance ?? 0);
  const eventTriggerIndex = eventScheduled
    ? randomItem(region.events?.triggerBeforeEncounters || [6]) - 1
    : null;

  for (let encounterIndex = 0; encounterIndex < region.encounterPlan.length; encounterIndex += 1) {
    if (eventScheduled && encounterIndex === eventTriggerIndex) {
      state.eventTriggered = true;
      const eventResult = simulateForestCampfireEvent({
        state,
        encounterIndex,
        choice: scenario.eventPolicy === "attack-return" ? "attack-return" : "leave"
      });
      if (!eventResult.survived) {
        state.outcome = "defeat";
        state.deathSource = "forest-event";
        return;
      }
    }

    state.reached = encounterIndex + 1;
    const encounterType = getEncounterType(region.encounterPlan[encounterIndex]);
    const enemy = buildEnemy(region, encounterIndex, state.hero, { boss: selectedBoss });
    const won = simulateBattle({
      state,
      enemies: [enemy],
      encounterType,
      rewardPhase: "main"
    });
    if (!won) {
      state.outcome = "defeat";
      state.deathSource = `${region.id}:${encounterIndex + 1}`;
      return;
    }

    settleFormalEncounterVictory({ state, isFinal: encounterIndex === region.encounterPlan.length - 1 });
    state.formalVictories += 1;
    if (encounterIndex === region.encounterPlan.length - 1) {
      state.outcome = "clear";
      return;
    }
    grantReasonableBlessing({ hero: state.hero, pool: region.blessings, characterId: scenario.characterId });
    if (shouldRetreat(state.hero, scenario.retreatThreshold)) {
      state.outcome = "retreat";
      return;
    }
  }
}

function simulateGoblinExpedition({ state, scenario }) {
  const region = scenario.region;
  const triggerIndex = randomItem(region.events?.triggerBeforeEncounters || [6]) - 1;
  const bosses = region.bosses || [region.boss];
  const selectedBoss = weightedPick(bosses, (boss) => Number(boss.weight) || 100);

  for (let encounterIndex = 0; encounterIndex < triggerIndex; encounterIndex += 1) {
    state.reached = encounterIndex + 1;
    const encounterType = getEncounterType(region.encounterPlan[encounterIndex]);
    const enemy = buildEnemy(region, encounterIndex, state.hero, { boss: selectedBoss });
    const won = simulateBattle({ state, enemies: [enemy], encounterType, rewardPhase: "main" });
    if (!won) {
      state.outcome = "defeat";
      state.deathSource = `forest-prefix:${encounterIndex + 1}`;
      return;
    }
    settleFormalEncounterVictory({ state, isFinal: false });
    state.formalVictories += 1;
    grantReasonableBlessing({ hero: state.hero, pool: region.blessings, characterId: scenario.characterId });
    if (shouldRetreat(state.hero, scenario.retreatThreshold)) {
      state.outcome = "retreat";
      return;
    }
  }

  state.eventTriggered = true;
  const eventResult = simulateForestCampfireEvent({ state, encounterIndex: triggerIndex, choice: "follow-route" });
  if (!eventResult.survived) {
    state.outcome = "defeat";
    state.deathSource = "forest-event";
    return;
  }

  let scalingIndex = triggerIndex;
  for (let routeIndex = 0; routeIndex < goblinRoute.encounterPlan.length; routeIndex += 1) {
    if (routeIndex === 4) {
      if (state.hero.hp / state.hero.maxHp < 0.7) {
        state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + Math.max(1, Math.round(state.hero.maxHp * 0.35)));
      } else {
        grantReasonableBlessing({ hero: state.hero, pool: goblinPool, characterId: scenario.characterId });
      }
    }

    state.routeReached = routeIndex + 1;
    state.reached = triggerIndex + routeIndex + 1;
    const entry = goblinRoute.encounterPlan[routeIndex];
    const group = getRouteGroup(goblinRoute, entry.groupId);
    const enemies = createRuntimeEnemyGroup(group.members.map((member) => ({
      enemy: buildScaledEnemy(getEnemyDefinition(member.enemyId), region, scalingIndex),
      statScale: member.statScale,
      rewardScale: member.rewardScale
    })));
    const won = simulateBattle({
      state,
      enemies,
      encounterType: getEncounterType(entry),
      rewardPhase: "route"
    });
    if (!won) {
      state.outcome = "defeat";
      state.deathSource = `goblin-route:${routeIndex + 1}`;
      return;
    }

    const final = routeIndex === goblinRoute.encounterPlan.length - 1;
    settleFormalEncounterVictory({ state, isFinal: final });
    state.formalVictories += 1;
    scalingIndex += 1;
    if (final) {
      state.outcome = "clear";
      return;
    }
    grantReasonableBlessing({ hero: state.hero, pool: goblinPool, characterId: scenario.characterId });
    if (shouldRetreat(state.hero, scenario.retreatThreshold)) {
      state.outcome = "retreat";
      return;
    }
  }
}

function simulateForestCampfireEvent({ state, encounterIndex, choice }) {
  if (choice === "leave") return { survived: true };
  if (choice === "steal") {
    grantRarityBlessing({ hero: state.hero, pool: goblinPool, rarity: "common" });
    return { survived: true };
  }

  for (let battle = 0; battle < 2; battle += 1) {
    const enemy = buildScaledEnemy(getEnemyDefinition("goblin-warrior"), forestRegion, encounterIndex);
    const won = simulateBattle({
      state,
      enemies: [enemy],
      encounterType: "event",
      rewardPhase: "event"
    });
    if (!won) return { survived: false };
    settleBattleVictoryOnly(state.hero);
  }
  grantRarityBlessing({ hero: state.hero, pool: goblinPool, rarity: "uncommon" });
  return { survived: true };
}

function simulateBattle({ state, enemies, encounterType, rewardPhase }) {
  const runtimeEnemies = enemies.map((enemy, index) => ({
    ...enemy,
    runtimeId: enemy.runtimeId || `enemy-${index + 1}`,
    displayName: enemy.displayName || enemy.name,
    poison: Math.max(0, Number(enemy.poison) || 0)
  }));
  resetBattleState(state.hero);
  beginPreparationBattle(state.preparation);
  applyEnemyAmbushes(state.hero, runtimeEnemies);

  for (let turn = 1; turn <= MAX_TURNS; turn += 1) {
    const heroEntangled = resolveHeroEntangle({
      hero: state.hero,
      log: logger,
      retryOnFailure: () => consumePreparationEntangleRetry(state.preparation),
      onRetryResult: ({ success }) => recordPreparationEntangleRetryResult({ preparation: state.preparation, success })
    });

    if (!heroEntangled) {
      const target = chooseTarget(runtimeEnemies);
      if (!target) return true;
      runPreparationOpeningAction({
        preparation: state.preparation,
        hero: state.hero,
        encounterType,
        action: () => {
          const characterAction = resolveCharacterPlayerAction({
            hero: state.hero,
            enemies: runtimeEnemies,
            targetEnemyId: target.runtimeId,
            log: logger
          });
          if (!characterAction.handled) {
            resolveHeroAction({ hero: state.hero, enemy: target, log: logger });
          }
        }
      });
      settleDefeatedEnemies({ state, enemies: runtimeEnemies, rewardPhase });
      if (getLivingEnemies(runtimeEnemies).length === 0) return true;
    }

    const actingEnemies = [...getLivingEnemies(runtimeEnemies)];
    for (const enemy of actingEnemies) {
      if (enemy.hp <= 0) continue;
      resolveEnemyAction({
        hero: state.hero,
        enemy,
        turn,
        log: logger,
        modifyDirectDamage: (context) => {
          const characterDamage = modifyCharacterIncomingDirectDamage(context);
          return resolvePreparationIncomingDirectDamage({
            preparation: state.preparation,
            enemy: context.enemy,
            damage: characterDamage
          }).damage;
        }
      });
      applyEmergencyBandage(state.hero);
      if (state.hero.hp <= 0 && !tryLastStand(state.hero)) return false;
    }

    applyHeroEndOfTurnNegativeEffects({
      hero: state.hero,
      log: logger,
      modifyPoisonDamage: ({ damage }) => resolvePreparationPoisonDamage({ preparation: state.preparation, damage }).damage
    });
    getLivingEnemies(runtimeEnemies).forEach((enemy) => {
      applyEnemyEndOfTurnNegativeEffects({ enemy, log: logger });
    });
    applyHeroEndOfTurnRecoveryEffects({ hero: state.hero, turn, log: logger });
    runtimeEnemies.forEach((enemy) => {
      applyEnemyEndOfTurnRecoveryEffects({ enemy, turn, log: logger });
    });

    if (state.hero.hp <= 0 && !tryLastStand(state.hero)) return false;
    settleDefeatedEnemies({ state, enemies: runtimeEnemies, rewardPhase });
    if (getLivingEnemies(runtimeEnemies).length === 0) return true;
  }
  throw new Error(`戰鬥超過 ${MAX_TURNS} 回合：${runtimeEnemies.map((enemy) => enemy.name).join("、")}`);
}

function settleDefeatedEnemies({ state, enemies, rewardPhase }) {
  const defeated = enemies.filter((enemy) => enemy && enemy.hp <= 0 && !enemy.__settled);
  for (const enemy of defeated) {
    enemy.__settled = true;
    const hpRatioBeforeRewards = state.hero.maxHp > 0 ? state.hero.hp / state.hero.maxHp : 0;
    const rewards = rollEnemyRewards(enemy);
    state.rewards = mergeRewards(state.rewards, rewards);
    state.phaseRewards[rewardPhase] = mergeRewards(state.phaseRewards[rewardPhase], rewards);
    state.kills += 1;

    applyEnemyDefeatReactions({ enemies, defeatedEnemy: enemy });
    if (state.hero.killAttackGain > 0) {
      state.hero.battleAttackBonus = (state.hero.battleAttackBonus || 0) + state.hero.killAttackGain;
    }
    if (hpRatioBeforeRewards < 0.5 && state.hero.lowHpKillHeal > 0) {
      healHero(state.hero, state.hero.lowHpKillHeal);
    }
    if (state.hero.killHeal > 0) healHero(state.hero, state.hero.killHeal);
    if (state.hero.killHealRatio > 0) {
      healHero(state.hero, Math.max(1, Math.round(state.hero.maxHp * state.hero.killHealRatio)));
    }
  }
}

function settleFormalEncounterVictory({ state, isFinal }) {
  settleBattleVictoryOnly(state.hero);
  resolvePostEncounterPreparation({ preparation: state.preparation, hero: state.hero, isFinalEncounter: isFinal });
}

function settleBattleVictoryOnly(hero) {
  applyVictorySkills(hero);
  consumeBattleLimitedEffects(hero);
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

function applyEnemyAmbushes(hero, enemies) {
  getLivingEnemies(enemies).forEach((enemy) => {
    const amount = Number(enemy.ambushDamage) || 0;
    if (amount <= 0 || hero.hp <= 1) return;
    hero.hp -= Math.min(amount, hero.hp - 1);
  });
}

function chooseTarget(enemies) {
  const living = getLivingEnemies(enemies);
  if (living.length === 0) return null;
  return living
    .map((enemy, index) => ({ enemy, index, score: scoreEnemyThreat(enemy) }))
    .sort((a, b) => b.score - a.score || a.enemy.hp - b.enemy.hp || a.index - b.index)[0].enemy;
}

function scoreEnemyThreat(enemy) {
  let score = (Number(enemy.attack) || 0) * 2;
  score += (Number(enemy.poisonPower) || 0) * 12;
  score += (Number(enemy.entangleChance) || 0) * 80;
  score += (Number(enemy.critChance) || 0) * 30;
  if (enemy.bloodSacrifice) score += 1000;
  if (enemy.kind === "首領") score += 40;
  score -= (Number(enemy.defense) || 0) * 0.5;
  score -= (Number(enemy.hp) || 0) * 0.01;
  return score;
}

function applyEmergencyBandage(hero) {
  if (!hasSkill(hero, "emergency-bandage") || hero.skillState.emergencyBandageUsed || hero.hp <= 0) return;
  if (hero.hp > hero.maxHp * 0.4) return;
  hero.skillState.emergencyBandageUsed = true;
  healHero(hero, Math.max(1, Math.round(hero.maxHp * 0.18)));
}

function tryLastStand(hero) {
  if (!hasSkill(hero, "last-stand") || hero.skillState.lastStandUsed) return false;
  hero.skillState.lastStandUsed = true;
  hero.hp = Math.min(hero.maxHp, 1 + Math.max(1, Math.round(hero.maxHp * 0.15)));
  if (hero.poison > 0) hero.poison = 0;
  else if (hero.entangle) hero.entangle = null;
  return hero.hp > 0;
}

function applyVictorySkills(hero) {
  if (!hasSkill(hero, "adventurer-pace")) return;
  const baseRatio = hasSkill(hero, "expedition-pace") ? 0.15 : 0.1;
  healHero(hero, Math.max(1, Math.round(hero.maxHp * (baseRatio + (hero.victoryHealBonusRatio || 0)))));
}

function consumeBattleLimitedEffects(hero) {
  if (!Array.isArray(hero.timedRegens)) return;
  hero.timedRegens = hero.timedRegens
    .map((effect) => ({ ...effect, remainingEncounters: Math.max(0, (effect.remainingEncounters || 0) - 1) }))
    .filter((effect) => effect.remainingEncounters > 0);
}

function grantReasonableBlessing({ hero, pool, characterId }) {
  const choices = getBlessingChoices(pool, 3);
  const blessing = choices
    .map((item) => ({ item, score: scoreBlessing(item, hero, characterId) }))
    .sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id))[0]?.item;
  if (blessing) grantBlessing(hero, blessing);
}

function grantRarityBlessing({ hero, pool, rarity }) {
  const candidates = pool.filter((blessing) => blessing.rarity === rarity);
  if (candidates.length === 0) return;
  const blessing = weightedPick(candidates, (item) => Number(item.weight) || 100);
  grantBlessing(hero, blessing);
}

function grantBlessing(hero, blessing) {
  applyBlessingEffects(hero, blessing);
  hero.blessings.push(blessing.name);
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
  const hpRatio = hero.maxHp > 0 ? hero.hp / hero.maxHp : 0;
  const missingHp = Math.max(0, hero.maxHp - hero.hp);
  const flow = blessing.primaryFlow;
  const bases = characterId === "archer"
    ? { crit: 9, debuff: 8, attack: 7.5, defense: 5.5, healing: 5 }
    : { attack: 8, defense: 7, healing: 6.5, crit: 6, debuff: 4 };
  const momentum = Math.max(0, Number(hero.blessingFlowMomentum?.[flow]) || 0);
  let score = bases[flow] || 3;
  score += momentum * (characterId === "archer" ? 2 : 1.75);
  if (flow === "healing") {
    score += Math.min(characterId === "archer" ? 6 : 8, missingHp / (characterId === "archer" ? 28 : 18));
    if (hpRatio < 0.7) score += characterId === "archer" ? 5 : 4;
    if (hpRatio < 0.45) score += characterId === "archer" ? 10 : 8;
  }
  if (flow === "defense" && hpRatio < 0.65) score += characterId === "archer" ? 3 : 4;
  if (flow === "attack" && hero.attack < (characterId === "archer" ? 30 : 25)) score += 2;
  const special = {
    "spring-rest": hpRatio < 0.72 ? 5 : 0,
    "spore-breathing": hero.killHeal < 12 ? 4 : 1,
    "moss-stone-guard": hero.defense < 10 ? 2 : 0,
    "webbed-bracer": hero.damageReduction < 0.4 ? 4 : 0,
    "bark-reinforcement": hero.shieldStart < 20 ? 3 : 0,
    "hunter-path-reading": hero.critChance < 0.45 ? 3 : 1,
    "vine-binding-strike": 4,
    "poison-herb-coating": hero.poisonPower < 9 ? 4 : 1,
    "forest-whetstone": hero.attack < 30 ? 3 : 1,
    "heartwood-guidance": 2
  };
  return score + (special[blessing.id] || 0);
}

function shouldRetreat(hero, threshold) {
  return threshold > 0 && hero.hp / hero.maxHp < threshold;
}

function runLongTermModels({ samplePools }) {
  const models = [];
  const plainsPreferred = ["simple-bandage", "beast-repellent-herb", "weapon-maintenance"];
  const forestPreferred = ["insect-repellent-powder", "forest-bandage", "web-cutting-knife"];

  for (const config of [
    { id: "plains-sell-all", label: "平原／素材全賣／普通武器保養", scenarioId: "plains-lv10", region: plainsRegion, routeMode: "main", policy: "sell-all", preferred: "weapon-maintenance" },
    { id: "plains-enhance-first", label: "平原／武器保養強化優先", scenarioId: "plains-lv10", region: plainsRegion, routeMode: "main", policy: "enhance-first", preferred: "weapon-maintenance" },
    { id: "plains-rotate", label: "平原／三項整備輪替保留", scenarioId: "plains-lv10", region: plainsRegion, routeMode: "main", policy: "rotate", preferredList: plainsPreferred },
    { id: "forest-sell-all", label: "森林／素材全賣／普通驅蟲藥粉", scenarioId: "forest-main-lv25", region: forestRegion, routeMode: "main", policy: "sell-all", preferred: "insect-repellent-powder" },
    { id: "forest-enhance-powder", label: "森林／驅蟲藥粉強化優先", scenarioId: "forest-main-lv25", region: forestRegion, routeMode: "main", policy: "enhance-first", preferred: "insect-repellent-powder" },
    { id: "forest-enhance-bandage", label: "森林／林地繃帶強化優先", scenarioId: "forest-main-lv25", region: forestRegion, routeMode: "main", policy: "enhance-first", preferred: "forest-bandage" },
    { id: "forest-enhance-knife", label: "森林／營火事件出現時攻擊／割網短刀強化優先", scenarioId: "forest-main-attack-lv25", region: forestRegion, routeMode: "main", policy: "enhance-first", preferred: "web-cutting-knife" },
    { id: "forest-gold-buffer", label: "森林／保留 16G 安全線後才強化林地繃帶", scenarioId: "forest-main-lv25", region: forestRegion, routeMode: "main", policy: "gold-buffer", goldBuffer: 16, preferred: "forest-bandage" },
    { id: "forest-rotate", label: "森林／三項整備輪替保留", scenarioId: "forest-main-lv25", region: forestRegion, routeMode: "main", policy: "rotate", preferredList: forestPreferred },
    { id: "forest-explorer", label: "森林／事件出現即追蹤哥布林／林地繃帶強化優先", scenarioId: "forest-main-lv25", goblinScenarioId: "goblin-expedition-lv25", goblinChance: 0.3, region: forestRegion, routeMode: "mixed", policy: "enhance-first", preferred: "forest-bandage" },
    { id: "forest-hoard", label: "森林／完全不出售／完全不整備", scenarioId: "forest-main-lv25", region: forestRegion, routeMode: "main", policy: "hoard", preferred: null }
  ]) {
    const result = simulateLongTermConfig(config, samplePools);
    models.push(result);
    console.log(`${result.label} enhanced=${pct(result.enhancedUseRate.mean)} noPrep=${pct(result.noPreparationRate.mean)} liquid=${result.endingLiquidValue.p50.toFixed(0)}G`);
  }
  return Object.fromEntries(models.map((entry) => [entry.id, entry]));
}

function simulateLongTermConfig(config, samplePools) {
  const agents = [];
  for (let index = 0; index < AGENTS; index += 1) {
    const inventory = { gold: 0, materials: {} };
    const metrics = {
      normalUses: 0,
      enhancedUses: 0,
      noPrepUses: 0,
      clears: 0,
      defeats: 0,
      retreats: 0,
      soldGold: 0,
      spentGold: 0,
      materialsSpent: {},
      prepUses: {},
      bankruptRuns: 0
    };
    let rotateIndex = index % (config.preferredList?.length || 1);

    for (let run = 0; run < HORIZON; run += 1) {
      const choice = chooseEconomicPreparation({ config, inventory, rotateIndex });
      if (config.policy === "rotate") rotateIndex = (rotateIndex + 1) % config.preferredList.length;
      const sold = executeSalePolicy({ config, inventory, choice });
      metrics.soldGold += sold;
      const finalChoice = finalizePreparationChoice({ config, inventory, choice });

      if (finalChoice.preparation) {
        const materialCosts = finalChoice.enhanced ? finalChoice.preparation.enhancement.materialCosts : [];
        fastSpendInventoryCost({
          inventory,
          goldCost: finalChoice.preparation.cost,
          materialCosts
        });
        metrics.spentGold += finalChoice.preparation.cost;
        metrics.prepUses[finalChoice.preparation.id] = (metrics.prepUses[finalChoice.preparation.id] || 0) + 1;
        if (finalChoice.enhanced) {
          metrics.enhancedUses += 1;
          materialCosts.forEach((cost) => {
            metrics.materialsSpent[cost.materialId] = (metrics.materialsSpent[cost.materialId] || 0) + cost.quantity;
          });
        } else {
          metrics.normalUses += 1;
        }
      } else {
        metrics.noPrepUses += 1;
        if (inventory.gold === 0) metrics.bankruptRuns += 1;
      }

      const scenarioId = config.routeMode === "mixed" && Math.random() < config.goblinChance
        ? config.goblinScenarioId
        : config.scenarioId;
      const prepKey = finalChoice.preparation
        ? `${finalChoice.preparation.id}:${finalChoice.enhanced ? "enhanced" : "normal"}`
        : "none";
      const pool = samplePools[scenarioId][prepKey] || samplePools[scenarioId].none;
      const sample = randomItem(pool);
      fastApplyRewards(inventory, sample.rewards);
      if (sample.outcome === "clear") metrics.clears += 1;
      else if (sample.outcome === "retreat") metrics.retreats += 1;
      else metrics.defeats += 1;
    }

    const liquidValue = inventory.gold + getInventorySellValue(inventory.materials);
    agents.push({ inventory, metrics, liquidValue });
  }

  return summarizeLongTermAgents(config, agents);
}

function chooseEconomicPreparation({ config, inventory, rotateIndex }) {
  if (config.policy === "hoard") return { preparation: null, wantEnhanced: false };
  const prepId = config.policy === "rotate"
    ? config.preferredList[rotateIndex]
    : config.preferred;
  const preparation = config.region.preparations.find((item) => item.id === prepId) || null;
  return { preparation, wantEnhanced: config.policy !== "sell-all" };
}

function executeSalePolicy({ config, inventory, choice }) {
  if (config.policy === "hoard") return 0;
  const reserves = {};
  if (config.policy === "enhance-first" || config.policy === "gold-buffer") {
    for (const cost of choice.preparation?.enhancement?.materialCosts || []) reserves[cost.materialId] = cost.quantity;
  }
  if (config.policy === "rotate") {
    for (const prepId of config.preferredList) {
      const prep = config.region.preparations.find((item) => item.id === prepId);
      for (const cost of prep?.enhancement?.materialCosts || []) {
        reserves[cost.materialId] = Math.max(reserves[cost.materialId] || 0, cost.quantity);
      }
    }
  }

  const sales = [];
  for (const [materialId, material] of Object.entries(inventory.materials || {})) {
    const quantity = Math.max(0, material.quantity - (reserves[materialId] || 0));
    if (quantity > 0) sales.push({ materialId, quantity });
  }
  let total = 0;
  if (sales.length > 0) total += fastSellMaterials({ inventory, sales });

  const minimumGold = choice.preparation?.cost || 0;
  if (inventory.gold < minimumGold) {
    const remainingSales = Object.entries(inventory.materials || {})
      .map(([materialId, material]) => ({ materialId, quantity: material.quantity }))
      .filter((sale) => sale.quantity > 0);
    if (remainingSales.length > 0) total += fastSellMaterials({ inventory, sales: remainingSales });
  }
  return total;
}

function finalizePreparationChoice({ config, inventory, choice }) {
  const preparation = choice.preparation;
  if (!preparation || inventory.gold < preparation.cost) return { preparation: null, enhanced: false };
  const canEnhance = choice.wantEnhanced
    && hasMaterialCosts(inventory.materials, preparation.enhancement?.materialCosts || []);
  if (config.policy === "gold-buffer" && inventory.gold - preparation.cost < config.goldBuffer) {
    return { preparation, enhanced: false };
  }
  return { preparation, enhanced: canEnhance };
}

function summarizeLongTermAgents(config, agents) {
  const gold = agents.map((agent) => agent.inventory.gold);
  const liquid = agents.map((agent) => agent.liquidValue);
  const enhancedRate = agents.map((agent) => agent.metrics.enhancedUses / HORIZON);
  const normalRate = agents.map((agent) => agent.metrics.normalUses / HORIZON);
  const noPrepRate = agents.map((agent) => agent.metrics.noPrepUses / HORIZON);
  const clearRate = agents.map((agent) => agent.metrics.clears / HORIZON);
  const bankruptRate = agents.map((agent) => agent.metrics.bankruptRuns / HORIZON);
  const materialTotals = {};
  const spentTotals = {};
  const prepTotals = {};
  for (const agent of agents) {
    for (const [id, material] of Object.entries(agent.inventory.materials || {})) materialTotals[id] = (materialTotals[id] || 0) + material.quantity;
    for (const [id, quantity] of Object.entries(agent.metrics.materialsSpent)) spentTotals[id] = (spentTotals[id] || 0) + quantity;
    for (const [id, uses] of Object.entries(agent.metrics.prepUses)) prepTotals[id] = (prepTotals[id] || 0) + uses;
  }
  return {
    id: config.id,
    label: config.label,
    agents: AGENTS,
    horizon: HORIZON,
    endingGold: summarizeNumbers(gold),
    endingLiquidValue: summarizeNumbers(liquid),
    enhancedUseRate: summarizeNumbers(enhancedRate),
    normalUseRate: summarizeNumbers(normalRate),
    noPreparationRate: summarizeNumbers(noPrepRate),
    clearRate: summarizeNumbers(clearRate),
    zeroGoldNoPrepRate: summarizeNumbers(bankruptRate),
    averageEndingMaterials: Object.fromEntries(Object.entries(materialTotals)
      .map(([id, total]) => [id, { name: materialDefinitions[id]?.name || id, average: total / AGENTS }])
      .sort((a, b) => b[1].average - a[1].average)),
    averageMaterialsSpentPerAgent: Object.fromEntries(Object.entries(spentTotals)
      .map(([id, total]) => [id, { name: materialDefinitions[id]?.name || id, average: total / AGENTS }])
      .sort((a, b) => b[1].average - a[1].average)),
    preparationUseRate: Object.fromEntries(Object.entries(prepTotals).map(([id, total]) => [id, total / (AGENTS * HORIZON)]))
  };
}

function summarizeSamples(samples) {
  const values = samples.map((sample) => sample.sellValue);
  const reached = samples.map((sample) => sample.reached);
  const mainValues = samples.map((sample) => sample.mainValue);
  const eventValues = samples.map((sample) => sample.eventValue);
  const routeValues = samples.map((sample) => sample.routeValue);
  const clear = samples.filter((sample) => sample.outcome === "clear").length;
  const retreat = samples.filter((sample) => sample.outcome === "retreat").length;
  const materialTotals = {};
  for (const sample of samples) {
    for (const [id, material] of Object.entries(sample.rewards.materials)) {
      materialTotals[id] = (materialTotals[id] || 0) + material.quantity;
    }
  }
  const byOutcome = {};
  for (const outcome of ["clear", "retreat", "defeat"]) {
    const group = samples.filter((sample) => sample.outcome === outcome);
    byOutcome[outcome] = group.length > 0 ? {
      count: group.length,
      rate: group.length / samples.length,
      sellValue: summarizeNumbers(group.map((sample) => sample.sellValue)),
      reached: summarizeNumbers(group.map((sample) => sample.reached))
    } : { count: 0, rate: 0, sellValue: summarizeNumbers([]), reached: summarizeNumbers([]) };
  }
  const byReached = {};
  const reachedGroups = groupBy(samples, (sample) => String(sample.reached));
  for (const [key, group] of Object.entries(reachedGroups)) {
    byReached[key] = {
      count: group.length,
      rate: group.length / samples.length,
      meanSellValue: mean(group.map((sample) => sample.sellValue)),
      outcomes: countBy(group, (sample) => sample.outcome)
    };
  }
  return {
    rounds: samples.length,
    clearRate: clear / samples.length,
    retreatRate: retreat / samples.length,
    defeatRate: 1 - (clear + retreat) / samples.length,
    meanSellValue: mean(values),
    sellValue: summarizeNumbers(values),
    meanReached: mean(reached),
    meanMainValue: mean(mainValues),
    meanEventValue: mean(eventValues),
    meanRouteValue: mean(routeValues),
    byOutcome,
    byReached,
    averageMaterials: Object.fromEntries(Object.entries(materialTotals)
      .map(([id, total]) => [id, {
        name: materialDefinitions[id]?.name || id,
        averageQuantity: total / samples.length,
        averageValue: (total / samples.length) * (materialDefinitions[id]?.sellPrice || 0)
      }])
      .sort((a, b) => b[1].averageValue - a[1].averageValue))
  };
}

function buildMarkdownReport(report) {
  const lines = [];
  lines.push("# v0.2.4.3 經濟與玩家長期策略模型");
  lines.push("");
  lines.push(`- 遊戲版本：\`${report.metadata.gameVersion}\``);
  lines.push(`- 單項正式冒險樣本：主線每組 ${report.metadata.sampleRounds.toLocaleString()} 輪；哥布林遠征每組 ${report.metadata.goblinSampleRounds.toLocaleString()} 輪`);
  lines.push(`- 完整通關掉落抽樣：每來源 ${report.metadata.fullClearRounds.toLocaleString()} 輪`);
  lines.push(`- 長期經濟：每策略 ${report.metadata.agents.toLocaleString()} 名代理玩家 × ${report.metadata.horizon} 趟`);
  lines.push("");
  lines.push("> 本報告是依正式程式與正式公式的隔離模擬結果，不是玩家 telemetry。玩家對 UI、動畫、猶豫感與樂趣仍需實機判斷。");
  lines.push("");

  lines.push("## 完整通關掉落價值");
  lines.push("");
  lines.push("| 來源 | 平均售價值 | P10 | 中位數 | P90 |");
  lines.push("|---|---:|---:|---:|---:|");
  for (const [key, label] of [
    ["plains", "平原 8 場"],
    ["forestMain", "森林主線 16 場"],
    ["forestEventAttack", "森林營火兩名哥布林"],
    ["goblinRoute", "哥布林營地 9 組敵群"]
  ]) {
    const stats = report.fullClear[key].sellValue;
    lines.push(`| ${label} | ${stats.mean.toFixed(2)}G | ${stats.p10.toFixed(0)}G | ${stats.p50.toFixed(0)}G | ${stats.p90.toFixed(0)}G |`);
  }
  lines.push("");

  lines.push("## 正式冒險結果摘要");
  lines.push("");
  for (const scenario of Object.values(report.scenarios)) {
    lines.push(`### ${scenario.label}`);
    lines.push("");
    lines.push("| 整備 | 通關 | 撤退 | 平均抵達 | 每趟平均素材售價值 |");
    lines.push("|---|---:|---:|---:|---:|");
    for (const prep of Object.values(scenario.preparations)) {
      lines.push(`| ${prep.label} | ${pct(prep.clearRate)} | ${pct(prep.retreatRate)} | ${prep.meanReached.toFixed(2)} | ${prep.meanSellValue.toFixed(2)}G |`);
    }
    lines.push("");
  }

  lines.push("## 撤退門檻敏感度");
  lines.push("");
  lines.push("森林 Lv.25 弓箭手使用強化林地繃帶：");
  lines.push("");
  lines.push("| 戰後撤退門檻 | 通關 | 撤退 | 死亡 | 平均素材售價值 |");
  lines.push("|---|---:|---:|---:|---:|");
  for (const [threshold, stats] of Object.entries(report.retreatSensitivity)) {
    lines.push(`| HP < ${Math.round(Number(threshold) * 100)}% | ${pct(stats.clearRate)} | ${pct(stats.retreatRate)} | ${pct(stats.defeatRate)} | ${stats.meanSellValue.toFixed(2)}G |`);
  }
  lines.push("");

  lines.push(`## ${report.metadata.horizon} 趟長期玩家策略`);
  lines.push("");
  lines.push("| 策略 | 強化使用率 | 普通使用率 | 無整備率 | 通關率 | 期末金幣中位數 | 期末可變現總值中位數 |");
  lines.push("|---|---:|---:|---:|---:|---:|---:|");
  for (const model of Object.values(report.longTerm)) {
    lines.push(`| ${model.label} | ${pct(model.enhancedUseRate.mean)} | ${pct(model.normalUseRate.mean)} | ${pct(model.noPreparationRate.mean)} | ${pct(model.clearRate.mean)} | ${model.endingGold.p50.toFixed(0)}G | ${model.endingLiquidValue.p50.toFixed(0)}G |`);
  }
  lines.push("");

  lines.push("## 判讀提醒");
  lines.push("");
  lines.push("- 正式掉落在敵人被擊敗時立即進入永久 inventory，因此死亡／撤退仍保留已取得素材。");
  lines.push("- 金幣沒有直接敵人掉落；模型中的金幣來源是依正式素材售價經 Commerce 出售後取得。");
  lines.push("- 哥布林完整遠征包含森林前段、營火兩戰、額外哥布林祝福，以及 9 場營地 Route；不是只測 Route 九場的滿血孤立模型。");
  lines.push("- 森林與哥布林模型包含正式伏擊傷害；因此可能與舊版只隔離主要戰鬥公式的 Preparation baseline 不完全相同。");
  lines.push("");
  return lines.join("\n") + "\n";
}

function getRewardsSellValue(rewards) {
  return Object.entries(rewards?.materials || {}).reduce((total, [id, material]) => {
    return total + (materialDefinitions[id]?.sellPrice || 0) * (material.quantity || 0);
  }, rewards?.gold || 0);
}

function getInventorySellValue(materials) {
  return Object.entries(materials || {}).reduce((total, [id, material]) => {
    return total + (materialDefinitions[id]?.sellPrice || 0) * (material.quantity || 0);
  }, 0);
}

function hasMaterialCosts(materials, costs) {
  return costs.every((cost) => (materials?.[cost.materialId]?.quantity || 0) >= cost.quantity);
}

function healHero(hero, amount) {
  hero.hp = Math.min(hero.maxHp, hero.hp + Math.max(0, Number(amount) || 0));
}

function hasSkill(hero, skillId) {
  return Array.isArray(hero?.skills) && hero.skills.includes(skillId);
}

function getEncounterType(entry) {
  return typeof entry === "string" ? entry : entry?.type || null;
}

function weightedPick(items, getWeight) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const weights = items.map((item) => Math.max(0, Number(getWeight(item)) || 0));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return randomItem(items);
  let roll = Math.random() * total;
  for (let index = 0; index < items.length; index += 1) {
    roll -= weights[index];
    if (roll <= 0) return items[index];
  }
  return items.at(-1);
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function withSeed(seed, action) {
  const original = Math.random;
  Math.random = createSeededRandom(seed);
  try {
    return action();
  } finally {
    Math.random = original;
  }
}

function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function summarizeNumbers(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return { count: 0, mean: 0, min: 0, p10: 0, p25: 0, p50: 0, p75: 0, p90: 0, max: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  return {
    count: sorted.length,
    mean: mean(sorted),
    min: sorted[0],
    p10: percentile(sorted, 0.1),
    p25: percentile(sorted, 0.25),
    p50: percentile(sorted, 0.5),
    p75: percentile(sorted, 0.75),
    p90: percentile(sorted, 0.9),
    max: sorted.at(-1)
  };
}

function percentile(sorted, ratio) {
  if (sorted.length === 1) return sorted[0];
  const index = (sorted.length - 1) * ratio;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function mean(values) {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function groupBy(items, keyFn) {
  const groups = {};
  for (const item of items) {
    const key = keyFn(item);
    (groups[key] ||= []).push(item);
  }
  return groups;
}

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function pct(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function positiveInt(value, fallback) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : fallback;
}
