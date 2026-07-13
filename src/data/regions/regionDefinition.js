function getBossName(regionData) {
  if (Array.isArray(regionData.bosses) && regionData.bosses.length > 0) {
    return regionData.bosses
      .map((boss) => boss?.name)
      .filter(Boolean)
      .join(" / ");
  }

  return regionData.boss?.name || "";
}

export function createRegionDefinition(regionData) {
  if (!regionData || typeof regionData !== "object" || Array.isArray(regionData)) {
    throw new TypeError("建立地區定義需要有效的資料物件");
  }

  const encounterPlan = Array.isArray(regionData.encounterPlan)
    ? regionData.encounterPlan
    : [];
  const bosses = Array.isArray(regionData.bosses)
    ? regionData.bosses
    : [];

  return {
    ...regionData,
    traits: Array.isArray(regionData.traits) ? regionData.traits : [],
    preparations: Array.isArray(regionData.preparations)
      ? regionData.preparations
      : [],
    encounterPlan,
    encounterCount: encounterPlan.length,
    bossName: getBossName(regionData),
    boss: regionData.boss || bosses[0] || null
  };
}
