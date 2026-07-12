import {
  DEFAULT_SAFE_AREA_ID,
  getSafeAreaDefinition,
  safeAreaDefinitions
} from "../data/safeAreas.js";
import { toSafeInteger } from "../utils.js";

export function createDefaultSafeAreaProgression(definitions = safeAreaDefinitions) {
  return Object.fromEntries(Object.entries(definitions).map(([safeAreaId, safeArea]) => [
    safeAreaId,
    {
      unlocked: safeArea.defaultUnlocked === true,
      unlockedAt: null
    }
  ]));
}

export function migrateSafeAreaProgression(rawSave, definitions = safeAreaDefinitions) {
  const progression = createDefaultSafeAreaProgression(definitions);
  const rawProgression = rawSave?.progression?.safeAreas;
  const legacyUnlockedIds = new Set([
    ...normalizeIdList(rawSave?.unlockedSafeAreaIds),
    ...normalizeIdList(rawSave?.world?.unlockedSafeAreaIds)
  ]);

  Object.entries(progression).forEach(([safeAreaId, safeAreaProgress]) => {
    const rawSafeAreaProgress = rawProgression?.[safeAreaId];
    const definition = definitions[safeAreaId];
    const explicitlyUnlocked = rawSafeAreaProgress?.unlocked === true || legacyUnlockedIds.has(safeAreaId);

    safeAreaProgress.unlocked = definition.defaultUnlocked === true || explicitlyUnlocked;
    safeAreaProgress.unlockedAt = safeAreaProgress.unlocked
      ? normalizeUnlockedAt(rawSafeAreaProgress?.unlockedAt)
      : null;
  });

  return progression;
}

export function syncSafeAreaUnlocks(save, options = {}) {
  const definitions = options.definitions || safeAreaDefinitions;
  const unlockedAt = options.unlockedAt || new Date().toISOString();
  ensureSafeAreaProgression(save, definitions);

  const unlockedSafeAreaIds = [];
  Object.entries(definitions).forEach(([safeAreaId, definition]) => {
    if (save.progression.safeAreas[safeAreaId].unlocked) {
      return;
    }
    if (!isUnlockConditionMet(save, definition.unlockCondition)) {
      return;
    }
    save.progression.safeAreas[safeAreaId].unlocked = true;
    save.progression.safeAreas[safeAreaId].unlockedAt = unlockedAt;
    unlockedSafeAreaIds.push(safeAreaId);
  });
  return unlockedSafeAreaIds;
}

export function isSafeAreaUnlocked(save, safeAreaId) {
  return Boolean(
    getSafeAreaDefinition(safeAreaId)
    && save?.progression?.safeAreas?.[safeAreaId]?.unlocked === true
  );
}

export function getUnlockedSafeAreaIds(save, definitions = safeAreaDefinitions) {
  return Object.keys(definitions).filter((safeAreaId) => (
    definitions[safeAreaId]
    && save?.progression?.safeAreas?.[safeAreaId]?.unlocked === true
  ));
}

export function getCurrentSafeAreaId(save) {
  const requestedSafeAreaId = save?.settings?.currentSafeAreaId
    || save?.currentSafeAreaId
    || save?.world?.currentSafeAreaId;
  return isSafeAreaUnlocked(save, requestedSafeAreaId)
    ? requestedSafeAreaId
    : DEFAULT_SAFE_AREA_ID;
}

export function setCurrentSafeArea(save, safeAreaId) {
  if (!getSafeAreaDefinition(safeAreaId)) {
    throw new Error(`找不到安全區 definition：${safeAreaId || "(empty)"}`);
  }
  if (!isSafeAreaUnlocked(save, safeAreaId)) {
    throw new Error(`安全區尚未解鎖：${safeAreaId}`);
  }
  if (!save.settings || typeof save.settings !== "object" || Array.isArray(save.settings)) {
    save.settings = {};
  }
  save.settings.currentSafeAreaId = safeAreaId;
  return safeAreaId;
}

function ensureSafeAreaProgression(save, definitions) {
  if (!save.progression || typeof save.progression !== "object" || Array.isArray(save.progression)) {
    save.progression = {};
  }
  const defaults = createDefaultSafeAreaProgression(definitions);
  if (!save.progression.safeAreas || typeof save.progression.safeAreas !== "object" || Array.isArray(save.progression.safeAreas)) {
    save.progression.safeAreas = defaults;
    return;
  }
  Object.entries(defaults).forEach(([safeAreaId, defaultProgress]) => {
    if (!save.progression.safeAreas[safeAreaId]) {
      save.progression.safeAreas[safeAreaId] = defaultProgress;
    }
  });
}

function isUnlockConditionMet(save, unlockCondition) {
  if (!unlockCondition) {
    return false;
  }
  if (unlockCondition.type === "region-route-clear") {
    const clearCount = toSafeInteger(
      save?.statistics?.regions?.[unlockCondition.regionId]?.routeClears?.[unlockCondition.routeClearKey]
    );
    return clearCount >= unlockCondition.minimumClears;
  }
  return false;
}

function normalizeIdList(value) {
  return Array.isArray(value)
    ? value.filter((id) => typeof id === "string" && id.trim())
    : [];
}

function normalizeUnlockedAt(value) {
  return typeof value === "string" && value.trim() ? value : null;
}
