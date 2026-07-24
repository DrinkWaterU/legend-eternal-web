import { isSafeAreaVisited } from "./safeAreaProgression.js";

export const STORY_QUEST_STATUSES = Object.freeze({
  AVAILABLE: "available",
  ACTIVE: "active",
  COMPLETED: "completed"
});

const STATUS_VALUES = new Set(Object.values(STORY_QUEST_STATUSES));

export function createDefaultStoryQuestState() {
  return { records: {} };
}

export function normalizeStoryQuestState(rawState, definitions = {}) {
  const normalized = createDefaultStoryQuestState();
  if (!rawState || typeof rawState !== "object" || Array.isArray(rawState)) {
    return normalized;
  }

  Object.entries(rawState.records || {}).forEach(([questId, rawRecord]) => {
    const definition = definitions[questId];
    if (!definition || !rawRecord || typeof rawRecord !== "object" || Array.isArray(rawRecord)) {
      return;
    }
    const status = STATUS_VALUES.has(rawRecord.status)
      ? rawRecord.status
      : STORY_QUEST_STATUSES.AVAILABLE;
    const stageIds = new Set((definition.stages || []).map((stage) => stage.id));
    const fallbackStageId = status === STORY_QUEST_STATUSES.ACTIVE
      ? definition.stages?.[1]?.id || definition.stages?.[0]?.id || null
      : definition.stages?.[0]?.id || null;
    normalized.records[questId] = {
      status,
      stageId: stageIds.has(rawRecord.stageId) ? rawRecord.stageId : fallbackStageId
    };
  });
  return normalized;
}

export function areStoryQuestConditionsMet(conditions = [], saveData) {
  return conditions.every((condition) => isStoryQuestConditionMet(condition, saveData));
}

export function isStoryQuestConditionMet(condition, saveData) {
  if (condition?.type === "regionRouteClear") {
    const clears = Number(
      saveData?.statistics?.regions?.[condition.regionId]?.routeClears?.[condition.routeClearKey]
    );
    return Number.isSafeInteger(clears)
      && clears >= Math.max(1, Number(condition.minimumClears) || 1);
  }
  if (condition?.type === "anyUnlockedCharacterLevel") {
    const minimumLevel = Math.max(1, Number(condition.minimumLevel) || 1);
    return Object.values(saveData?.progression?.characters || {}).some((progress) => (
      progress?.unlocked === true
      && Number.isSafeInteger(progress.level)
      && progress.level >= minimumLevel
    ));
  }
  if (condition?.type === "safeAreaVisited") {
    return isSafeAreaVisited(saveData, condition.safeAreaId);
  }
  return false;
}

export function makeAvailableStoryQuests(saveData, definitions = {}) {
  saveData.storyQuests ??= createDefaultStoryQuestState();
  saveData.storyQuests.records ??= {};
  const createdQuestIds = [];
  Object.values(definitions)
    .slice()
    .sort(compareStoryQuests)
    .forEach((quest) => {
      if (saveData.storyQuests.records[quest.id]) {
        return;
      }
      if (!areStoryQuestConditionsMet(quest.availabilityConditions || [], saveData)) {
        return;
      }
      saveData.storyQuests.records[quest.id] = {
        status: STORY_QUEST_STATUSES.AVAILABLE,
        stageId: quest.stages?.[0]?.id || null
      };
      createdQuestIds.push(quest.id);
    });
  return createdQuestIds;
}

export function getStoryQuestObjective(definition, record) {
  if (!definition || !record) {
    return "";
  }
  if (record.status === STORY_QUEST_STATUSES.COMPLETED) {
    return definition.completedObjective || "";
  }
  return definition.stages?.find((stage) => stage.id === record.stageId)?.objective
    || definition.stages?.[0]?.objective
    || "";
}

export function getStoryQuestEntries(saveData, definitions = {}) {
  return Object.entries(saveData?.storyQuests?.records || {})
    .map(([questId, record]) => ({
      definition: definitions[questId],
      record
    }))
    .filter((entry) => entry.definition && entry.record)
    .sort((left, right) => compareStoryQuests(left.definition, right.definition));
}

function compareStoryQuests(left, right) {
  return (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER)
    || left.name.localeCompare(right.name, "zh-Hant");
}
