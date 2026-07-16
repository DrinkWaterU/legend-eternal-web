export function createAdventureSource({
  state,
  getCurrentRegion,
  getRouteDefinition,
  getRouteGroup,
  getEnemyDefinition,
  getBlessingPool,
  documentRef = document
}) {
  function currentRoute() {
    return state.activeRouteId ? getRouteDefinition(state.activeRouteId) : null;
  }

  function currentAdventureSource() {
    return currentRoute() || getCurrentRegion();
  }

  function getAdventureEncounterIndex() {
    return currentRoute() ? state.routeEncounterIndex : state.encounterIndex;
  }

  function getAdventureEncounterPlan() {
    return currentAdventureSource()?.encounterPlan || [];
  }

  function getAdventureEncounterEntry() {
    return getAdventureEncounterPlan()[getAdventureEncounterIndex()] || null;
  }

  function getAdventureEncounterType() {
    const entry = getAdventureEncounterEntry();
    return typeof entry === "string" ? entry : entry?.type || null;
  }

  function getAdventureEncounterCount() {
    return getAdventureEncounterPlan().length;
  }

  function getAdventureSourceName() {
    return currentAdventureSource()?.name || getCurrentRegion()?.name || "冒險";
  }

  function getAdventureBlessingDefinitions(poolOverrideId = null) {
    const poolId = poolOverrideId || state.blessingPoolOverrideId || currentRoute()?.blessingPoolId;
    if (poolId) {
      return getBlessingPool(poolId)?.blessings || [];
    }
    return getCurrentRegion()?.blessings || [];
  }

  function getRouteBossDefinition(route = currentRoute()) {
    const finalEncounter = route?.encounterPlan?.at(-1);
    const group = getRouteGroup(route, finalEncounter?.groupId);
    const bossMember = group?.members?.find((member) => getEnemyDefinition(member.enemyId)?.kind === "首領");
    return bossMember ? getEnemyDefinition(bossMember.enemyId) : null;
  }

  function resetRouteRuntime() {
    state.activeRouteId = null;
    state.routeEncounterIndex = 0;
    state.routeEndingContext = null;
    state.blessingPoolOverrideId = null;
    delete documentRef.body.dataset.route;
  }

  return Object.freeze({
    currentRoute,
    currentAdventureSource,
    getAdventureEncounterIndex,
    getAdventureEncounterPlan,
    getAdventureEncounterEntry,
    getAdventureEncounterType,
    getAdventureEncounterCount,
    getAdventureSourceName,
    getAdventureBlessingDefinitions,
    getRouteBossDefinition,
    resetRouteRuntime
  });
}
