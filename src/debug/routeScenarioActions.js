import { scheduleRegionEvent } from "../core/events.js";
import { getRouteDefinition } from "../data/routes/index.js";
import { clone } from "../utils.js";

export function prepareDebugRouteAt({
  state,
  routeId,
  routeEncounterIndex,
  baseEncounterIndex,
  hero,
  scheduleEvent = false,
  prepareRunForRegion,
  getRouteBossDefinition,
  recordSelectedBossInRunStats,
  applySceneContext,
  clampInteger
}) {
  const route = getRouteDefinition(routeId);
  if (!route) throw new Error(`找不到 Debug Route：${routeId}`);

  const routeIndex = clampInteger(routeEncounterIndex, 0, route.encounterPlan.length - 1);
  prepareRunForRegion(route.regionId, baseEncounterIndex + routeIndex, {
    hero,
    debugBuildRun: true,
    persistSelection: false
  });
  state.activeRouteId = route.id;
  state.routeEncounterIndex = routeIndex;
  state.eventSchedule = scheduleEvent ? scheduleRegionEvent(route) : null;
  state.selectedBoss = clone(getRouteBossDefinition(route));
  recordSelectedBossInRunStats();
  state.battleEncounterType = null;
  state.runResultRecorded = false;
  applySceneContext("gameScreen");
  return route;
}
