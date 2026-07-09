export const facilityDefinitions = Object.freeze({
  "traveling-merchant": Object.freeze({
    id: "traveling-merchant",
    name: "旅行商人",
    description: "一名往返各地的商人暫時停留於此，願意收購冒險中帶回的素材。",
    actionId: "merchant"
  })
});

export function getFacilityDefinition(facilityId) {
  return facilityDefinitions[facilityId] || null;
}

export function assertFacilityDefinitions(facilities = facilityDefinitions) {
  Object.entries(facilities).forEach(([facilityId, facility]) => {
    if (!facility || facility.id !== facilityId) {
      throw new Error(`Facility definition id 不一致：${facilityId}`);
    }
    if (!String(facility.name || "").trim()) {
      throw new Error(`Facility ${facilityId} 缺少 name。`);
    }
    if (!String(facility.actionId || "").trim()) {
      throw new Error(`Facility ${facilityId} 缺少 actionId。`);
    }
  });
  return true;
}
