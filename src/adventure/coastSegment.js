import { clone } from "../utils.js";

const COAST_REGION_ID = "beach";

const ROUTE_ENTRY_STATE_FIELDS = [
  "activeRouteId",
  "routeEncounterIndex",
  "eventSchedule",
  "eventContext",
  "eventInputLocked",
  "adventureProgressLocked",
  "blessingContext",
  "blessingPoolOverrideId",
  "blessingInputLocked",
  "selectedBoss",
  "phase",
  "ended",
  "awaitingBlessing",
  "battleSource",
  "battleEncounterType",
  "routeEndingContext",
  "turn",
  "hero",
  "enemies",
  "targetEnemyId",
  "pendingThreat",
  "runStats",
  "runPreparation",
  "runEventRecords",
  "eventTransitionToken",
  "coastSegmentCheckpoint",
  "log"
];

export function createBeachSegmentCheckpoint({ state, encounterCount }) {
  if (!state || typeof state !== "object") {
    throw new TypeError("建立海岸段落 checkpoint 需要有效的 Run state。");
  }
  if (state.selectedRegionId !== COAST_REGION_ID || state.activeRouteId) {
    throw new Error("目前不是可建立海灘段落 checkpoint 的主線位置。");
  }
  if (state.ended) {
    throw new Error("本輪冒險已結束，不能重新建立海灘段落 checkpoint。");
  }

  const requiredEncounterCount = Number(encounterCount);
  if (!Number.isInteger(requiredEncounterCount) || requiredEncounterCount <= 0) {
    throw new Error("海灘段落 checkpoint 缺少有效的遭遇總數。");
  }
  const encounterIndex = Number(state.encounterIndex);
  if (!Number.isInteger(encounterIndex) || encounterIndex < requiredEncounterCount) {
    throw new Error("海灘段落 checkpoint 必須在最後一場勝利後建立。");
  }

  return {
    run: state.run,
    regionId: COAST_REGION_ID,
    encounterIndex,
    routeEncounterIndex: 0,
    activeRouteId: null
  };
}

export function createAdventureRouteHandoff({ state, route }) {
  if (!state || typeof state !== "object") {
    throw new TypeError("建立 Route 交接需要有效的 Run state。");
  }
  const routeId = String(route?.id || "").trim();
  if (!routeId || !Array.isArray(route?.encounterPlan) || route.encounterPlan.length === 0) {
    throw new Error("Route 交接缺少可進入的內容。");
  }
  if (route.regionId !== state.selectedRegionId) {
    throw new Error(`Route ${routeId} 不屬於目前地區。`);
  }
  if (state.activeRouteId) {
    throw new Error("目前已有進行中的冒險路線。");
  }
  if (!state.hero || !state.runStats || state.ended) {
    throw new Error("目前沒有可延續的冒險。");
  }

  if (state.selectedRegionId === COAST_REGION_ID) {
    const checkpoint = state.coastSegmentCheckpoint;
    if (
      !checkpoint
      || checkpoint.run !== state.run
      || checkpoint.regionId !== COAST_REGION_ID
      || checkpoint.encounterIndex !== state.encounterIndex
      || checkpoint.activeRouteId !== null
    ) {
      throw new Error("海岸段落尚未準備好進入下一段冒險。");
    }
  }

  return {
    run: state.run,
    regionId: state.selectedRegionId,
    routeId,
    encounterIndex: state.encounterIndex,
    routeEncounterIndex: 0
  };
}

export function captureAdventureRouteState(state) {
  return Object.fromEntries(
    ROUTE_ENTRY_STATE_FIELDS.map((field) => [field, cloneValue(state?.[field])])
  );
}

export function restoreAdventureRouteState(state, snapshot) {
  if (!state || typeof state !== "object" || !snapshot || typeof snapshot !== "object") {
    throw new TypeError("還原 Route 交接需要有效的 state 與 snapshot。");
  }
  ROUTE_ENTRY_STATE_FIELDS.forEach((field) => {
    state[field] = cloneValue(snapshot[field]);
  });
  return state;
}

function cloneValue(value) {
  return value === undefined ? undefined : clone(value);
}
