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

export function getRegionDisplayName(region) {
  return region?.regionName || region?.name || "";
}

export function getRegionSegmentName(region) {
  return region?.segmentName || region?.name || "";
}

export function getRegionEncounterGroupOption(encounterEntry, randomFn = Math.random) {
  const options = Array.isArray(encounterEntry?.groupOptions)
    ? encounterEntry.groupOptions.filter((option) => option && Number(option.count) > 0)
    : [];
  if (options.length === 0) {
    return null;
  }

  const weights = options.map((option) => Math.max(0, Number(option.weight) || 0));
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  if (totalWeight <= 0) {
    return options[0];
  }

  let roll = randomFn() * totalWeight;
  for (let index = 0; index < options.length; index += 1) {
    roll -= weights[index];
    if (roll <= 0) return options[index];
  }
  return options.at(-1);
}

export function assertRegionEncounterDefinitions(regionData) {
  const plan = Array.isArray(regionData?.encounterPlan) ? regionData.encounterPlan : [];
  if (plan.length === 0) {
    throw new Error(`地區 ${regionData?.id || "(empty)"} encounterPlan 不可為空。`);
  }

  plan.forEach((entry, index) => {
    const type = typeof entry === "string" ? entry : entry?.type;
    if (!["normal", "elite", "boss"].includes(type)) {
      throw new Error(`地區 ${regionData.id} 第 ${index + 1} 場 encounter type 無效：${type || "(empty)"}`);
    }
    const options = Array.isArray(entry?.groupOptions) ? entry.groupOptions : [];
    options.forEach((option) => {
      if (!Number.isInteger(Number(option?.count)) || Number(option.count) < 1) {
        throw new Error(`地區 ${regionData.id} 第 ${index + 1} 場 group count 無效。`);
      }
      if (!(Number(option.statScale) > 0)) {
        throw new Error(`地區 ${regionData.id} 第 ${index + 1} 場 statScale 必須 > 0。`);
      }
      if (option.attackScale !== undefined && !(Number(option.attackScale) > 0)) {
        throw new Error(`地區 ${regionData.id} 第 ${index + 1} 場 attackScale 必須 > 0。`);
      }
      if (!(Number(option.rewardScale) >= 0)) {
        throw new Error(`地區 ${regionData.id} 第 ${index + 1} 場 rewardScale 必須 >= 0。`);
      }
      if (!(Number(option.weight) >= 0)) {
        throw new Error(`地區 ${regionData.id} 第 ${index + 1} 場 group weight 必須 >= 0。`);
      }
    });
    if (options.length > 0 && options.every((option) => !(Number(option.weight) > 0))) {
      throw new Error(`地區 ${regionData.id} 第 ${index + 1} 場 groupOptions 權重不可全為 0。`);
    }
  });

  const events = regionData?.events;
  if (events) {
    const scheduleChance = Number(events.scheduleChance);
    if (!(scheduleChance >= 0 && scheduleChance <= 1)) {
      throw new Error(`地區 ${regionData.id} events.scheduleChance 必須介於 0 到 1。`);
    }
    if (!Array.isArray(events.triggerBeforeEncounters) || events.triggerBeforeEncounters.length === 0) {
      throw new Error(`地區 ${regionData.id} events.triggerBeforeEncounters 不可為空。`);
    }
    events.triggerBeforeEncounters.forEach((encounterNumber) => {
      if (!Number.isInteger(encounterNumber) || encounterNumber < 1 || encounterNumber > plan.length) {
        throw new Error(`地區 ${regionData.id} 事件觸發場次超出範圍：${encounterNumber}`);
      }
    });
    if (!Array.isArray(events.pool) || events.pool.length === 0 || events.pool.some((eventId) => !String(eventId).trim())) {
      throw new Error(`地區 ${regionData.id} events.pool 不可為空。`);
    }
  }

  return true;
}
