import { getLivingEnemies } from "./enemyGroups.js";

export function canCompleteRouteEncounter({ route, routeEncounterIndex, battleEncounterType, enemies = [] }) {
  const encounterCount = Array.isArray(route?.encounterPlan) ? route.encounterPlan.length : 0;
  return Boolean(
    route
    && encounterCount > 0
    && routeEncounterIndex >= encounterCount
    && battleEncounterType === "boss"
    && getLivingEnemies(enemies).length === 0
  );
}
