export const facilityDefinitions = Object.freeze({
  "traveling-merchant": Object.freeze({
    id: "traveling-merchant",
    name: "旅行商人",
    description: "一名往返各地的商人暫時停留於此，願意收購冒險中帶回的素材。",
    actionId: "merchant"
  }),
  blacksmith: Object.freeze({
    id: "blacksmith",
    name: "鐵匠鋪",
    description: "鎮上的鐵匠願意把冒險中取得的素材重新鍛造成可長期使用的武器。",
    actionId: "blacksmith",
    npcId: "anping-blacksmith"
  }),
  "adventurers-guild": Object.freeze({
    id: "adventurers-guild",
    name: "冒險者公會",
    description: "安平鎮的冒險者公會負責整理冒險紀錄、收購大批物資，並彙整旅途情報。",
    actionId: "guild",
    npcId: "anping-guild-receptionist"
  }),
  "guild-adventure-record": Object.freeze({
    id: "guild-adventure-record",
    name: "冒險資歷",
    description: "查看公會整理的冒險經歷與累積紀錄。",
    actionId: "guild-adventure-record",
    hiddenFromList: true
  }),
  "guild-quests": Object.freeze({
    id: "guild-quests",
    name: "公會委託",
    description: "查看並承接冒險者公會目前整理出的委託。",
    actionId: "guild-quests",
    hiddenFromList: true
  }),
  "guild-bulk-sale": Object.freeze({
    id: "guild-bulk-sale",
    name: "交付冒險物資",
    description: "將同種五件以上的素材交由公會統一收購。",
    actionId: "guild-bulk-sale",
    hiddenFromList: true
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
    if (facility.npcId !== undefined && !String(facility.npcId || "").trim()) {
      throw new Error(`Facility ${facilityId} npcId 必須是有效字串。`);
    }
  });
  return true;
}
