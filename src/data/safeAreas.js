export const DEFAULT_SAFE_AREA_ID = "camp";
export const ANPING_TOWN_SAFE_AREA_ID = "anping-town";

export const SAFE_AREA_KINDS = Object.freeze({
  CAMP: "camp",
  TOWN: "town"
});

const SAFE_AREA_KIND_VALUES = new Set(Object.values(SAFE_AREA_KINDS));
const UNLOCK_CONDITION_TYPES = new Set(["region-route-clear"]);

export const safeAreaDefinitions = Object.freeze({
  camp: Object.freeze({
    id: "camp",
    kind: SAFE_AREA_KINDS.CAMP,
    name: "冒險營地",
    eyebrow: "冒險營地",
    title: "火光暫時守住了平原的夜。",
    description: "在出發前確認角色、地區與最近一次冒險紀錄。撤退、失敗或通關後也會回到這裡。",
    featureTitle: "營地功能",
    travelOrder: 10,
    travelDescription: "回到熟悉的冒險據點",
    placesLockedDescription: "看看營地周圍",
    visual: Object.freeze({
      background: Object.freeze({
        mobile: "assets/images/camp/camp-mobile.png",
        desktop: "assets/images/camp/camp-desktop.png"
      })
    }),
    audio: Object.freeze({ bgmId: "camp", ambientId: null }),
    placesTitle: "營地去處",
    placesDescription: "火光周圍，還有一些值得留意的地方。",
    defaultUnlocked: true,
    unlockCondition: null,
    facilityIds: Object.freeze(["traveling-merchant"])
  }),
  [ANPING_TOWN_SAFE_AREA_ID]: Object.freeze({
    id: ANPING_TOWN_SAFE_AREA_ID,
    kind: SAFE_AREA_KINDS.TOWN,
    name: "安平鎮",
    eyebrow: "安平鎮",
    title: "海風穿過重建後的街道。",
    description: "來往的冒險者穿梭於街道與港口之間。這座曾經受黑王勢力控制的海岸小鎮，如今已成為許多新人踏上旅途的起點。",
    featureTitle: "城鎮功能",
    travelOrder: 20,
    travelDescription: "前往森林道路盡頭的城鎮",
    placesLockedDescription: "鎮內設施尚未開放",
    visual: Object.freeze({
      background: Object.freeze({
        mobile: "assets/images/anping-town/anping-town-mobile.jpg",
        desktop: "assets/images/anping-town/anping-town-desktop.jpg"
      })
    }),
    audio: Object.freeze({ bgmId: "anping-town", ambientId: "anping-coast" }),
    placesTitle: "鎮內去處",
    placesDescription: "這座規模不大的小鎮，將成為冒險者踏入傳說大陸後的第一處正式聚落。",
    defaultUnlocked: false,
    unlockCondition: Object.freeze({
      type: "region-route-clear",
      regionId: "forest",
      routeClearKey: "main",
      minimumClears: 1
    }),
    facilityIds: Object.freeze(["blacksmith"])
  })
});

export function getSafeAreaDefinition(safeAreaId = DEFAULT_SAFE_AREA_ID) {
  return safeAreaDefinitions[safeAreaId] || null;
}

export function getSafeAreaDefinitions() {
  return Object.values(safeAreaDefinitions)
    .slice()
    .sort((left, right) => (
      (left.travelOrder ?? Number.MAX_SAFE_INTEGER) - (right.travelOrder ?? Number.MAX_SAFE_INTEGER)
      || left.name.localeCompare(right.name, "zh-Hant")
    ));
}

export function assertSafeAreaDefinitions(safeAreas = safeAreaDefinitions, facilities = {}) {
  const defaultSafeArea = safeAreas[DEFAULT_SAFE_AREA_ID];
  if (!defaultSafeArea || defaultSafeArea.defaultUnlocked !== true) {
    throw new Error(`預設安全區 ${DEFAULT_SAFE_AREA_ID} 必須存在且預設解鎖。`);
  }

  Object.entries(safeAreas).forEach(([safeAreaId, safeArea]) => {
    if (!safeArea || safeArea.id !== safeAreaId) {
      throw new Error(`安全區 definition id 不一致：${safeAreaId}`);
    }
    if (!SAFE_AREA_KIND_VALUES.has(safeArea.kind)) {
      throw new Error(`安全區 ${safeAreaId} kind 無效：${safeArea.kind || "(empty)"}`);
    }
    if (!String(safeArea.name || "").trim()) {
      throw new Error(`安全區 ${safeAreaId} 缺少 name。`);
    }
    ["eyebrow", "title", "description", "featureTitle"].forEach((field) => {
      if (!String(safeArea[field] || "").trim()) {
        throw new Error(`安全區 ${safeAreaId} 缺少 ${field}。`);
      }
    });
    if (!String(safeArea.visual?.background?.mobile || safeArea.visual?.background?.desktop || "").trim()) {
      throw new Error(`安全區 ${safeAreaId} 缺少背景素材。`);
    }
    if (!String(safeArea.audio?.bgmId || "").trim()) {
      throw new Error(`安全區 ${safeAreaId} 缺少 BGM id。`);
    }
    if (!Number.isSafeInteger(safeArea.travelOrder) || safeArea.travelOrder < 0) {
      throw new Error(`安全區 ${safeAreaId} travelOrder 必須是非負整數。`);
    }
    if (!String(safeArea.travelDescription || "").trim()) {
      throw new Error(`安全區 ${safeAreaId} 缺少 travelDescription。`);
    }
    if (typeof safeArea.defaultUnlocked !== "boolean") {
      throw new Error(`安全區 ${safeAreaId} defaultUnlocked 必須是 boolean。`);
    }

    assertUnlockCondition(safeAreaId, safeArea.unlockCondition);

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

function assertUnlockCondition(safeAreaId, unlockCondition) {
  if (!unlockCondition) {
    return;
  }
  if (!UNLOCK_CONDITION_TYPES.has(unlockCondition.type)) {
    throw new Error(`安全區 ${safeAreaId} unlockCondition type 無效：${unlockCondition.type || "(empty)"}`);
  }
  if (!String(unlockCondition.regionId || "").trim()) {
    throw new Error(`安全區 ${safeAreaId} unlockCondition 缺少 regionId。`);
  }
  if (!String(unlockCondition.routeClearKey || "").trim()) {
    throw new Error(`安全區 ${safeAreaId} unlockCondition 缺少 routeClearKey。`);
  }
  if (!Number.isSafeInteger(unlockCondition.minimumClears) || unlockCondition.minimumClears < 1) {
    throw new Error(`安全區 ${safeAreaId} unlockCondition.minimumClears 必須是正整數。`);
  }
}
