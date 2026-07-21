export function canFleeBattle(encounterType) {
  return encounterType !== "boss";
}

export function getBattleFleeChance({
  encounterType,
  threatKind,
  normalChance,
  eliteChance,
  routeFleeChance = null
}) {
  if (!canFleeBattle(encounterType)) {
    return 0;
  }
  const isElite = encounterType === "elite" || threatKind === "精英";
  const overrideChance = routeFleeChance && typeof routeFleeChance === "object"
    ? routeFleeChance[isElite ? "elite" : "normal"]
    : null;
  return isValidChance(overrideChance)
    ? Number(overrideChance)
    : isElite
      ? eliteChance
      : normalChance;
}

function isValidChance(value) {
  return value !== null
    && value !== undefined
    && Number.isFinite(Number(value))
    && Number(value) >= 0
    && Number(value) <= 1;
}
