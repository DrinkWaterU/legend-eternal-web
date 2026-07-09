export const DEFAULT_SAFE_AREA_ID = "camp";

export const safeAreaDefinitions = Object.freeze({
  camp: Object.freeze({
    id: "camp",
    name: "冒險營地",
    placesTitle: "營地去處",
    placesDescription: "火光周圍，還有一些值得留意的地方。",
    facilityIds: Object.freeze(["traveling-merchant"])
  })
});

export function getSafeAreaDefinition(safeAreaId = DEFAULT_SAFE_AREA_ID) {
  return safeAreaDefinitions[safeAreaId] || null;
}

export function assertSafeAreaDefinitions(safeAreas = safeAreaDefinitions, facilities = {}) {
  Object.entries(safeAreas).forEach(([safeAreaId, safeArea]) => {
    if (!safeArea || safeArea.id !== safeAreaId) {
      throw new Error(`安全區 definition id 不一致：${safeAreaId}`);
    }
    const facilityIds = Array.isArray(safeArea.facilityIds) ? safeArea.facilityIds : [];
    const uniqueFacilityIds = new Set(facilityIds);
    if (uniqueFacilityIds.size !== facilityIds.length) {
      throw new Error(`安全區 ${safeAreaId} 存在重複 facility id。`);
    }
    facilityIds.forEach((facilityId) => {
      if (!facilities[facilityId]) {
        throw new Error(`安全區 ${safeAreaId} 引用了未知 facility：${facilityId}`);
      }
    });
  });
  return true;
}
