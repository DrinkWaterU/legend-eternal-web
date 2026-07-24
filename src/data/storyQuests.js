import storyQuestData from "./storyQuests.json" with { type: "json" };

const QUEST_TYPES = new Set(["main", "side"]);
const CONDITION_TYPES = new Set([
  "regionRouteClear",
  "anyUnlockedCharacterLevel",
  "safeAreaVisited"
]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

export const storyQuestDefinitions = deepFreeze(structuredClone(storyQuestData));

export function getStoryQuestDefinition(questId) {
  return storyQuestDefinitions[questId] || null;
}

export function assertStoryQuestDefinitions(definitions = storyQuestDefinitions, options = {}) {
  const {
    characterDefinitions = {},
    weaponDefinitions = {},
    regionDefinitions = {},
    safeAreaDefinitions = {},
    materialDefinitions = {},
    storyFlagKeys = []
  } = options;

  Object.entries(definitions).forEach(([questId, quest]) => {
    if (!quest || quest.id !== questId) {
      throw new Error(`劇情任務 definition id 不一致：${questId}`);
    }
    if (!QUEST_TYPES.has(quest.type)) {
      throw new Error(`劇情任務 ${questId} type 無效：${quest.type || "(empty)"}`);
    }
    ["name", "summary", "completedObjective"].forEach((field) => {
      if (!String(quest[field] || "").trim()) {
        throw new Error(`劇情任務 ${questId} 缺少 ${field}。`);
      }
    });
    if (!Number.isSafeInteger(quest.order) || quest.order < 0) {
      throw new Error(`劇情任務 ${questId} order 必須是非負整數。`);
    }

    const stageIds = new Set();
    if (!Array.isArray(quest.stages) || quest.stages.length === 0) {
      throw new Error(`劇情任務 ${questId} 必須至少有一個 stage。`);
    }
    quest.stages.forEach((stage) => {
      if (!String(stage?.id || "").trim() || !String(stage?.objective || "").trim()) {
        throw new Error(`劇情任務 ${questId} stage 缺少 id 或 objective。`);
      }
      if (stageIds.has(stage.id)) {
        throw new Error(`劇情任務 ${questId} 存在重複 stage：${stage.id}`);
      }
      stageIds.add(stage.id);
    });

    (quest.availabilityConditions || []).forEach((condition) => {
      assertAvailabilityCondition(questId, condition, { regionDefinitions, safeAreaDefinitions });
    });
    assertRewards(questId, quest.rewards, {
      characterDefinitions,
      weaponDefinitions,
      materialDefinitions,
      storyFlagKeys
    });
  });
  return true;
}

function assertAvailabilityCondition(questId, condition, options) {
  if (!CONDITION_TYPES.has(condition?.type)) {
    throw new Error(`劇情任務 ${questId} 使用未知 condition type：${condition?.type || "(empty)"}`);
  }
  if (condition.type === "regionRouteClear") {
    if (!options.regionDefinitions[condition.regionId]) {
      throw new Error(`劇情任務 ${questId} 使用未知地區：${condition.regionId || "(empty)"}`);
    }
    if (!String(condition.routeClearKey || "").trim()) {
      throw new Error(`劇情任務 ${questId} regionRouteClear 缺少 routeClearKey。`);
    }
    if (!Number.isSafeInteger(condition.minimumClears) || condition.minimumClears < 1) {
      throw new Error(`劇情任務 ${questId} minimumClears 必須是正整數。`);
    }
    return;
  }
  if (condition.type === "anyUnlockedCharacterLevel") {
    if (!Number.isSafeInteger(condition.minimumLevel) || condition.minimumLevel < 1) {
      throw new Error(`劇情任務 ${questId} minimumLevel 必須是正整數。`);
    }
    return;
  }
  if (!options.safeAreaDefinitions[condition.safeAreaId]) {
    throw new Error(`劇情任務 ${questId} 使用未知安全區：${condition.safeAreaId || "(empty)"}`);
  }
}

function assertRewards(questId, rewards, options) {
  if (!rewards || typeof rewards !== "object" || Array.isArray(rewards)) {
    throw new Error(`劇情任務 ${questId} 缺少 rewards。`);
  }
  const gold = rewards.gold ?? 0;
  if (!Number.isSafeInteger(gold) || gold < 0) {
    throw new Error(`劇情任務 ${questId} rewards.gold 必須是非負安全整數。`);
  }
  (rewards.materials || []).forEach((entry) => {
    if (!options.materialDefinitions[entry?.id]) {
      throw new Error(`劇情任務 ${questId} 使用未知獎勵素材：${entry?.id || "(empty)"}`);
    }
    if (!Number.isSafeInteger(entry.quantity) || entry.quantity < 1) {
      throw new Error(`劇情任務 ${questId} 獎勵素材數量必須是正安全整數。`);
    }
  });
  const knownStoryFlags = new Set(options.storyFlagKeys);
  (rewards.storyFlags || []).forEach((entry) => {
    if (!knownStoryFlags.has(entry?.key) || typeof entry.value !== "boolean") {
      throw new Error(`劇情任務 ${questId} story flag 獎勵無效：${entry?.key || "(empty)"}`);
    }
  });
  if (rewards.unlockCharacterId && !options.characterDefinitions[rewards.unlockCharacterId]) {
    throw new Error(`劇情任務 ${questId} 使用未知解鎖角色：${rewards.unlockCharacterId}`);
  }
  if (rewards.grantWeaponId && !options.weaponDefinitions[rewards.grantWeaponId]) {
    throw new Error(`劇情任務 ${questId} 使用未知發放武器：${rewards.grantWeaponId}`);
  }
  if (rewards.equipWeaponId && (
    rewards.equipWeaponId !== rewards.grantWeaponId
    || !rewards.unlockCharacterId
  )) {
    throw new Error(`劇情任務 ${questId} 第一版只能自動裝備同次發放的武器。`);
  }
  if (
    gold === 0
    && (rewards.materials || []).length === 0
    && (rewards.storyFlags || []).length === 0
    && !rewards.unlockCharacterId
    && !rewards.grantWeaponId
  ) {
    throw new Error(`劇情任務 ${questId} rewards 不可為空。`);
  }
}
