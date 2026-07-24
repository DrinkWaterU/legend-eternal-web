import { getBlessingPool } from "../data/blessings/index.js";
import { regionDefinitions } from "../data/regions/index.js";

import {
  DEBUG_BUILD_PROFILES,
  DEBUG_SCENARIOS,
  COAST_CAVE_ROUTE_ID,
  GOBLIN_MID_CHOICES,
  GOBLIN_ROUTE_ENTRY_OPTIONS,
  GOBLIN_ROUTE_ID,
  MIXED_FLOW_ORDER
} from "./scenarioCatalog.js";

export function getDebugScenarioCatalog() {
  return DEBUG_SCENARIOS.map((scenario) => ({ ...scenario }));
}

export function getDebugScenarioDefinition(scenarioId) {
  return DEBUG_SCENARIOS.find((scenario) => scenario.id === scenarioId) || null;
}

export function getDebugBuildProfiles() {
  return DEBUG_BUILD_PROFILES.map((profile) => ({ ...profile }));
}

export function getDebugRouteEntryOptions() {
  return [...GOBLIN_ROUTE_ENTRY_OPTIONS];
}

export function getDebugMidChoices() {
  return GOBLIN_MID_CHOICES.map((choice) => ({ ...choice }));
}

export function getDebugScenarioBuildSlots(scenarioId, options = {}) {
  const scenario = getDebugScenarioDefinition(scenarioId);
  if (!scenario?.supportsBuild) {
    return [];
  }

  if (scenario.kind === "regionBoss") {
    const bossIndex = getBossEncounterIndex(scenario.regionId);
    return finalizeTimeline(buildRegionAcquisitions(scenario.regionId, bossIndex, 0));
  }

  if (scenario.kind === "forestCampfire") {
    return finalizeTimeline(buildRegionAcquisitions("forest", 5, 0));
  }

  if (["regionEnemy", "regionEnemyGroup"].includes(scenario.kind)) {
    return finalizeTimeline(buildRegionAcquisitions(
      scenario.regionId,
      Math.max(0, Number(scenario.encounterIndex) || 0),
      0
    ));
  }

  if (scenario.routeId === GOBLIN_ROUTE_ID) {
    return buildGoblinRouteTimeline(scenario, options);
  }

  if (scenario.kind === "coastCampTransition") {
    return finalizeTimeline(buildRegionAcquisitions("beach", 16, 0));
  }

  if (scenario.routeId === COAST_CAVE_ROUTE_ID) {
    return buildCoastCaveTimeline(scenario);
  }

  return [];
}

export function createDebugBuildProfile(slots, profileId) {
  const slotList = Array.isArray(slots) ? slots : [];
  if (profileId === "empty") {
    return {};
  }

  const requestedFlows = profileId === "mixed" ? MIXED_FLOW_ORDER : [profileId];
  const usageByKey = new Map();
  const selections = {};

  slotList.forEach((slot, slotIndex) => {
    if (slot.stage === "campRetained") return;
    const desiredFlow = requestedFlows[slotIndex % requestedFlows.length];
    const candidates = getProfileCandidates(slot.blessings, desiredFlow, requestedFlows, slotIndex);
    if (candidates.length === 0) {
      return;
    }
    const usageKey = `${slot.poolKey}:${desiredFlow}:${candidates.map((item) => item.id).join(",")}`;
    const usage = usageByKey.get(usageKey) || 0;
    selections[slot.id] = candidates[usage % candidates.length].id;
    usageByKey.set(usageKey, usage + 1);
  });

  slotList
    .filter((slot) => slot.stage === "campRetained")
    .forEach((slot, index) => {
      const sourceSlotId = slot.retainedFromSlotIds?.[index] || slot.retainedFromSlotIds?.[0];
      const blessingId = selections[sourceSlotId];
      if (blessingId && slot.blessings.some((blessing) => blessing.id === blessingId)) {
        selections[slot.id] = blessingId;
      }
    });

  return selections;
}

function buildGoblinRouteTimeline(scenario, options) {
  const routeEntryEncounter = normalizeRouteEntryEncounter(options.routeEntryEncounter);
  const forestBlessingCount = routeEntryEncounter - 1;
  const acquisitions = buildRegionAcquisitions("forest", forestBlessingCount, 0);
  const goblinBlessings = getGoblinBlessings();
  const campfireBlessings = goblinBlessings.filter((blessing) => blessing.rarity === "uncommon");
  const campfireVictoryCount = forestBlessingCount + 2;

  acquisitions.push(createAcquisition({
    id: "goblin-campfire",
    label: "林間營火",
    poolKey: "goblin:campfire-uncommon",
    blessings: campfireBlessings,
    acquiredAfterVictory: campfireVictoryCount
  }));

  const completedRouteBattles = getCompletedRouteBattlesBeforeScenario(scenario);
  for (let routeBattle = 1; routeBattle <= completedRouteBattles; routeBattle += 1) {
    acquisitions.push(createAcquisition({
      id: `goblin-route-${routeBattle}`,
      label: `營地第 ${routeBattle} 場`,
      poolKey: "goblin",
      blessings: goblinBlessings,
      acquiredAfterVictory: campfireVictoryCount + routeBattle
    }));

    if (routeBattle === 4 && scenario.supportsMidChoice && normalizeMidChoice(options.midChoice) === "blessing") {
      acquisitions.push(createAcquisition({
        id: "goblin-mid-blessing",
        label: "補給額外",
        poolKey: "goblin",
        blessings: goblinBlessings,
        acquiredAfterVictory: campfireVictoryCount + routeBattle
      }));
    }
  }

  return finalizeTimeline(acquisitions);
}

function buildCoastCaveTimeline(scenario) {
  const beachAcquisitions = buildRegionAcquisitions("beach", 16, 0)
    .map((slot) => ({ ...slot, stage: "beach" }));
  const beachBlessings = beachAcquisitions[0]?.blessings || [];
  const retainedSlots = Array.from({ length: 8 }, (_, index) => createAcquisition({
    id: `coast-camp-retained-${index + 1}`,
    label: `扎營保留 ${index + 1}`,
    poolKey: "coast:camp-retained",
    blessings: beachBlessings,
    acquiredAfterVictory: 16,
    stage: "campRetained",
    retainedFromSlotIds: beachAcquisitions.map((slot) => slot.id)
  }));
  const caveBlessings = (getBlessingPool("cave")?.blessings || []).map(simplifyBlessing);
  const caveAcquisitions = Array.from(
    { length: Math.max(0, Number(scenario.routeEncounterIndex) || 0) },
    (_, index) => createAcquisition({
      id: `coast-cave-${index + 1}`,
      label: `洞穴第 ${index + 1} 場`,
      poolKey: "route:coast-cave",
      blessings: caveBlessings,
      acquiredAfterVictory: 16 + index + 1,
      stage: "cave"
    })
  );
  return finalizeTimeline([...beachAcquisitions, ...retainedSlots, ...caveAcquisitions]);
}

function buildRegionAcquisitions(regionId, count, victoryOffset) {
  const region = regionDefinitions[regionId];
  const blessings = (region?.blessings || []).map(simplifyBlessing);
  return Array.from({ length: Math.max(0, count) }, (_, index) => createAcquisition({
    id: `${regionId}-${index + 1}`,
    label: `${region?.name || regionId} ${index + 1}`,
    poolKey: `region:${regionId}`,
    blessings,
    acquiredAfterVictory: victoryOffset + index + 1
  }));
}

function createAcquisition({ id, label, poolKey, blessings, acquiredAfterVictory, stage, retainedFromSlotIds }) {
  return {
    id,
    label,
    poolKey,
    blessings: blessings.map(simplifyBlessing),
    acquiredAfterVictory,
    stage,
    retainedFromSlotIds
  };
}

function finalizeTimeline(acquisitions) {
  return acquisitions.map((slot, index) => {
    const next = acquisitions[index + 1];
    return {
      ...slot,
      id: slot.id,
      label: slot.label,
      poolKey: slot.poolKey,
      blessings: slot.blessings.map((blessing) => ({ ...blessing })),
      battleVictoriesAfter: next
        ? Math.max(0, next.acquiredAfterVictory - slot.acquiredAfterVictory)
        : 0
    };
  });
}

function getCompletedRouteBattlesBeforeScenario(scenario) {
  if (scenario.kind === "goblinMidEvent") {
    return 4;
  }
  return Math.max(0, Number(scenario.routeEncounterIndex) || 0);
}

function getGoblinBlessings() {
  return (getBlessingPool("goblin")?.blessings || []).map(simplifyBlessing);
}

function simplifyBlessing(blessing) {
  return {
    id: blessing.id,
    name: blessing.name,
    rarity: blessing.rarity,
    primaryFlow: blessing.primaryFlow
  };
}

function getProfileCandidates(blessings, desiredFlow, flowOrder, slotIndex) {
  const available = Array.isArray(blessings) ? blessings : [];
  const preferred = available.filter((blessing) => blessing.primaryFlow === desiredFlow);
  if (preferred.length > 0) {
    return preferred;
  }

  for (let offset = 1; offset < flowOrder.length; offset += 1) {
    const fallbackFlow = flowOrder[(slotIndex + offset) % flowOrder.length];
    const fallback = available.filter((blessing) => blessing.primaryFlow === fallbackFlow);
    if (fallback.length > 0) {
      return fallback;
    }
  }

  return available;
}

function getBossEncounterIndex(regionId) {
  const region = regionDefinitions[regionId];
  const bossIndex = region?.encounterPlan?.findIndex((encounterType) => encounterType === "boss") ?? -1;
  return bossIndex >= 0 ? bossIndex : Math.max(0, (region?.encounterPlan?.length || 1) - 1);
}

function normalizeRouteEntryEncounter(value) {
  const parsed = Number(value);
  return GOBLIN_ROUTE_ENTRY_OPTIONS.includes(parsed) ? parsed : GOBLIN_ROUTE_ENTRY_OPTIONS[0];
}

function normalizeMidChoice(value) {
  return GOBLIN_MID_CHOICES.some((choice) => choice.id === value) ? value : GOBLIN_MID_CHOICES[0].id;
}
