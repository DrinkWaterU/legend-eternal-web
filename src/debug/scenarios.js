import { getBlessingPool } from "../data/blessings/index.js";
import { regionDefinitions } from "../data/regions/index.js";

const GOBLIN_ROUTE_ID = "goblin-camp";
const GOBLIN_ROUTE_ENTRY_OPTIONS = Object.freeze([6, 7, 8]);
const GOBLIN_MID_CHOICES = Object.freeze([
  Object.freeze({ id: "heal", label: "恢復 35% HP" }),
  Object.freeze({ id: "blessing", label: "搜刮額外 Blessing" })
]);
const DEBUG_BUILD_PROFILES = Object.freeze([
  Object.freeze({ id: "mixed", label: "混合" }),
  Object.freeze({ id: "attack", label: "Attack" }),
  Object.freeze({ id: "crit", label: "Crit" }),
  Object.freeze({ id: "debuff", label: "Debuff" }),
  Object.freeze({ id: "healing", label: "Healing" }),
  Object.freeze({ id: "defense", label: "Defense" }),
  Object.freeze({ id: "empty", label: "空白" })
]);
const MIXED_FLOW_ORDER = Object.freeze(["attack", "crit", "debuff", "healing", "defense"]);

const DEBUG_SCENARIOS = Object.freeze([
  Object.freeze({
    id: "plains-boss",
    category: "平原",
    name: "平原首領",
    description: "使用平原正式首領場次與平原 Blessing 取得時序。",
    kind: "regionBoss",
    regionId: "plains",
    supportsBuild: true
  }),
  Object.freeze({
    id: "plains-story",
    category: "平原",
    name: "平原星神劇情",
    description: "只測試星神劇情 presentation；完成後不解鎖鳳凰或修改正式存檔。",
    kind: "plainsStory",
    regionId: "plains",
    supportsBuild: false
  }),
  Object.freeze({
    id: "forest-campfire",
    category: "森林",
    name: "林間營火",
    description: "準備事件觸發前的森林安全狀態，按「繼續前進」進入林間營火。",
    kind: "forestCampfire",
    regionId: "forest",
    supportsBuild: true
  }),
  Object.freeze({
    id: "forest-boss-wood",
    category: "森林",
    name: "古木守衛",
    description: "使用森林正式首領場次與森林 Blessing 取得時序。",
    kind: "regionBoss",
    regionId: "forest",
    bossId: "ancient-wood-warden",
    supportsBuild: true
  }),
  Object.freeze({
    id: "forest-boss-stag",
    category: "森林",
    name: "翠影鹿王",
    description: "使用森林正式首領場次與森林 Blessing 取得時序。",
    kind: "regionBoss",
    regionId: "forest",
    bossId: "verdant-stag-king",
    supportsBuild: true
  }),
  Object.freeze({
    id: "core-multi-enemy",
    category: "核心測試",
    name: "多敵人基礎",
    description: "哥布林戰士 ×2；第二名套用 statScale 0.75 / rewardScale 0.5。",
    kind: "multiEnemy",
    regionId: "forest",
    supportsBuild: false
  }),
  Object.freeze({
    id: "goblin-route-start",
    category: "哥布林營地",
    name: "Route 第 1 場",
    description: "依 Route 進入時機建立森林前置 Build、林間營火獎勵，直接開始營地第 1 場。",
    kind: "goblinRouteEncounter",
    regionId: "forest",
    routeId: GOBLIN_ROUTE_ID,
    routeEncounterIndex: 0,
    supportsBuild: true,
    supportsRouteEntry: true
  }),
  Object.freeze({
    id: "goblin-mid-event",
    category: "哥布林營地",
    name: "第 4 場後補給",
    description: "視為已完成 Route 第 4 場並取得 Blessing；下一次繼續前進觸發「掠奪來的補給」。",
    kind: "goblinMidEvent",
    regionId: "forest",
    routeId: GOBLIN_ROUTE_ID,
    routeEncounterIndex: 4,
    supportsBuild: true,
    supportsRouteEntry: true
  }),
  Object.freeze({
    id: "goblin-after-mid",
    category: "哥布林營地",
    name: "Route 第 5 場",
    description: "略過補給 presentation，依指定中段選擇建立 Build 後直接開始第 5 場。",
    kind: "goblinRouteEncounter",
    regionId: "forest",
    routeId: GOBLIN_ROUTE_ID,
    routeEncounterIndex: 4,
    supportsBuild: true,
    supportsRouteEntry: true,
    supportsMidChoice: true
  }),
  Object.freeze({
    id: "goblin-boss",
    category: "哥布林營地",
    name: "血骨薩滿",
    description: "依正式森林前置、林間營火、Route Blessing 與中段選擇建立 Build，直接開始第 9 場 Boss group。",
    kind: "goblinRouteEncounter",
    regionId: "forest",
    routeId: GOBLIN_ROUTE_ID,
    routeEncounterIndex: 8,
    supportsBuild: true,
    supportsRouteEntry: true,
    supportsMidChoice: true
  }),
  Object.freeze({
    id: "goblin-ending",
    category: "哥布林營地",
    name: "弓箭手 Ending",
    description: "只測試四頁 Route Ending；不救援角色、不記通關、不解鎖成就。",
    kind: "goblinEnding",
    regionId: "forest",
    routeId: GOBLIN_ROUTE_ID,
    supportsBuild: false
  })
]);

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

  if (scenario.routeId === GOBLIN_ROUTE_ID) {
    return buildGoblinRouteTimeline(scenario, options);
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

function createAcquisition({ id, label, poolKey, blessings, acquiredAfterVictory }) {
  return {
    id,
    label,
    poolKey,
    blessings: blessings.map(simplifyBlessing),
    acquiredAfterVictory
  };
}

function finalizeTimeline(acquisitions) {
  return acquisitions.map((slot, index) => {
    const next = acquisitions[index + 1];
    return {
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
