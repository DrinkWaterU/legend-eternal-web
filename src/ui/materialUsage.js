export const MATERIAL_USAGE_FILTERS = Object.freeze([
  Object.freeze({ id: "all", label: "全部" }),
  Object.freeze({ id: "preparation", label: "冒險整備" }),
  Object.freeze({ id: "weapon", label: "武器製作" })
]);

export function buildMaterialUsageIndex({ regionDefinitions = {}, weaponDefinitions = {} } = {}) {
  const index = {};
  const add = (materialId, entry) => {
    if (!index[materialId]) {
      index[materialId] = [];
    }
    index[materialId].push(Object.freeze(entry));
  };

  Object.entries(regionDefinitions).forEach(([regionId, region]) => {
    (region?.preparations || []).forEach((preparation) => {
      const enhancement = preparation?.enhancement;
      (enhancement?.materialCosts || []).forEach((cost) => {
        add(cost.materialId, {
          id: `preparation:${regionId}:${preparation.id}`,
          type: "preparation",
          regionId,
          regionName: region.name || regionId,
          title: preparation.name || preparation.id,
          subtitle: enhancement.title || "整備強化",
          description: enhancement.description || preparation.description || "尚未記錄強化效果。",
          quantity: Math.max(1, Math.floor(cost.quantity || 1)),
          location: `${region.name || regionId}出發前整備`
        });
      });
    });
  });

  Object.values(weaponDefinitions).forEach((weapon) => {
    (weapon?.recipe?.materialCosts || []).forEach((cost) => {
      add(cost.materialId, {
        id: `weapon:${weapon.id}`,
        type: "weapon",
        weaponId: weapon.id,
        title: weapon.name || weapon.id,
        subtitle: "武器製作",
        description: weapon.description || "可用於製作這把武器。",
        quantity: Math.max(1, Math.floor(cost.quantity || 1)),
        location: "安平鎮鐵匠鋪"
      });
    });
  });

  Object.values(index).forEach((entries) => {
    entries.sort((left, right) => {
      const typeDiff = left.type.localeCompare(right.type, "en");
      return typeDiff || left.title.localeCompare(right.title, "zh-Hant");
    });
  });

  return Object.freeze(index);
}

export function getMaterialUsages(usageIndex = {}, materialId, usageFilter = "all") {
  const entries = usageIndex[materialId] || [];
  return usageFilter === "all"
    ? [...entries]
    : entries.filter((entry) => entry.type === usageFilter);
}

export function getMaterialUsageCounts(usageIndex = {}, materialId) {
  const entries = usageIndex[materialId] || [];
  const preparation = entries.filter((entry) => entry.type === "preparation").length;
  const weapon = entries.filter((entry) => entry.type === "weapon").length;
  return { all: entries.length, preparation, weapon };
}

export function getMaterialUsageSearchText(usageIndex = {}, materialId) {
  return (usageIndex[materialId] || [])
    .flatMap((entry) => [entry.regionName, entry.title, entry.subtitle, entry.description, entry.location])
    .filter(Boolean)
    .join(" ");
}
