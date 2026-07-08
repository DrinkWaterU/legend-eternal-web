export function canFleeBattle(encounterType) {
  return encounterType !== "boss";
}

export function getBattleFleeChance({ encounterType, threatKind, normalChance, eliteChance }) {
  if (!canFleeBattle(encounterType)) {
    return 0;
  }
  return encounterType === "elite" || threatKind === "精英"
    ? eliteChance
    : normalChance;
}
