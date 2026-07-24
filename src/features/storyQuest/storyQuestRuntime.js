import {
  STORY_QUEST_STATUSES,
  getStoryQuestEntries,
  makeAvailableStoryQuests
} from "../../core/storyQuestRules.js";
import { applyStoryQuestRewards } from "../../core/storyQuestRewards.js";
import { clone } from "../../utils.js";

export function createStoryQuestRuntime({
  saveStore,
  storyQuestDefinitions,
  characterDefinitions,
  weaponDefinitions,
  materialDefinitions,
  saveGameSafe
}) {
  function refreshAvailability() {
    const snapshot = clone(saveStore.current);
    const createdQuestIds = makeAvailableStoryQuests(saveStore.current, storyQuestDefinitions);
    if (createdQuestIds.length === 0) {
      return [];
    }
    if (saveGameSafe()) {
      return createdQuestIds;
    }
    saveStore.replace(snapshot);
    return [];
  }

  function getRecord(questId) {
    return saveStore.current.storyQuests?.records?.[questId] || null;
  }

  function getSnapshot() {
    return {
      entries: getStoryQuestEntries(saveStore.current, storyQuestDefinitions),
      hasRecords: Object.keys(saveStore.current.storyQuests?.records || {}).length > 0
    };
  }

  function startQuest(questId, options = {}) {
    const definition = storyQuestDefinitions[questId];
    const record = getRecord(questId);
    if (!definition || !record) {
      return false;
    }
    if (record.status === STORY_QUEST_STATUSES.COMPLETED) {
      return true;
    }
    const stageId = options.stageId || definition.stages?.[1]?.id || definition.stages?.[0]?.id;
    if (!definition.stages?.some((stage) => stage.id === stageId)) {
      return false;
    }
    return mutateAtomically(() => {
      record.status = STORY_QUEST_STATUSES.ACTIVE;
      record.stageId = stageId;
    });
  }

  function completeQuest(questId) {
    const definition = storyQuestDefinitions[questId];
    const record = getRecord(questId);
    if (!definition || !record) {
      return false;
    }
    if (record.status === STORY_QUEST_STATUSES.COMPLETED) {
      return true;
    }
    return mutateAtomically(() => {
      record.status = STORY_QUEST_STATUSES.COMPLETED;
      record.stageId = definition.stages?.at(-1)?.id || record.stageId;
      applyStoryQuestRewards({
        saveData: saveStore.current,
        definition,
        characterDefinitions,
        weaponDefinitions,
        materialDefinitions
      });
    });
  }

  function isQuestStatus(questId, status) {
    return getRecord(questId)?.status === status;
  }

  function hasVisibleQuests() {
    return getSnapshot().hasRecords;
  }

  function mutateAtomically(mutate) {
    const snapshot = clone(saveStore.current);
    try {
      mutate();
      if (saveGameSafe()) {
        return true;
      }
    } catch {
      // The original in-memory and persisted state are restored below.
    }
    saveStore.replace(snapshot);
    return false;
  }

  return Object.freeze({
    refreshAvailability,
    getRecord,
    getSnapshot,
    startQuest,
    completeQuest,
    isQuestStatus,
    hasVisibleQuests
  });
}
