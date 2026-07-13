import {
  DEFAULT_SAFE_AREA_ID,
  getSafeAreaDefinition,
  safeAreaDefinitions
} from "../data/safeAreas.js";
import { toSafeInteger } from "../utils.js";

export function createDefaultSafeAreaProgression(definitions = safeAreaDefinitions, options = {}) {
  const defaultVisitedAt = normalizeTimestamp(options.defaultVisitedAt) || new Date().toISOString();
  return Object.fromEntries(Object.entries(definitions).map(([safeAreaId, safeArea]) => [
    safeAreaId,
    {
      unlocked: safeArea.defaultUnlocked === true,
      unlockedAt: safeArea.defaultUnlocked === true ? defaultVisitedAt : null,
      visitedAt: safeAreaId === DEFAULT_SAFE_AREA_ID && safeArea.defaultUnlocked === true
        ? defaultVisitedAt
        : null
    }
  ]));
}

export function migrateSafeAreaProgression(rawSave, definitions = safeAreaDefinitions, options = {}) {
  const fallbackVisitedAt = normalizeTimestamp(options.defaultVisitedAt)
    || normalizeTimestamp(rawSave?.profile?.createdAt)
    || new Date().toISOString();
  const fallbackUnlockedAt = normalizeTimestamp(options.unlockedAt) || new Date().toISOString();
  const progression = createDefaultSafeAreaProgression(definitions, {
    defaultVisitedAt: fallbackVisitedAt
  });
  const rawProgression = rawSave?.progression?.safeAreas;
  const legacyUnlockedIds = new Set([
    ...normalizeIdList(rawSave?.unlockedSafeAreaIds),
    ...normalizeIdList(rawSave?.world?.unlockedSafeAreaIds)
  ]);

  Object.entries(progression).forEach(([safeAreaId, safeAreaProgress]) => {
    const rawSafeAreaProgress = rawProgression?.[safeAreaId];
    const definition = definitions[safeAreaId];
    const visitedAt = normalizeTimestamp(rawSafeAreaProgress?.visitedAt);
    const explicitlyUnlocked = rawSafeAreaProgress?.unlocked === true
      || legacyUnlockedIds.has(safeAreaId)
      || Boolean(visitedAt);

    safeAreaProgress.unlocked = definition.defaultUnlocked === true || explicitlyUnlocked;
    safeAreaProgress.unlockedAt = safeAreaProgress.unlocked
      ? normalizeTimestamp(rawSafeAreaProgress?.unlockedAt)
        || (safeAreaId === DEFAULT_SAFE_AREA_ID ? fallbackVisitedAt : fallbackUnlockedAt)
      : null;
    safeAreaProgress.visitedAt = safeAreaId === DEFAULT_SAFE_AREA_ID
      ? visitedAt || fallbackVisitedAt
      : visitedAt;

    if (safeAreaProgress.visitedAt) {
      safeAreaProgress.unlocked = true;
      safeAreaProgress.unlockedAt ||= safeAreaProgress.visitedAt;
    }
  });

  return progression;
}

export function syncSafeAreaUnlocks(save, options = {}) {
  const definitions = options.definitions || safeAreaDefinitions;
  const unlockedAt = normalizeTimestamp(options.unlockedAt) || new Date().toISOString();
  ensureSafeAreaProgression(save, definitions);

  const unlockedSafeAreaIds = [];
  Object.entries(definitions).forEach(([safeAreaId, definition]) => {
    const progress = save.progression.safeAreas[safeAreaId];
    if (progress.visitedAt) {
      progress.unlocked = true;
      progress.unlockedAt ||= progress.visitedAt;
    }
    if (progress.unlocked) {
      return;
    }
    if (!isUnlockConditionMet(save, definition.unlockCondition)) {
      return;
    }
    progress.unlocked = true;
    progress.unlockedAt = unlockedAt;
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

export function isSafeAreaVisited(save, safeAreaId) {
  return Boolean(
    getSafeAreaDefinition(safeAreaId)
    && normalizeTimestamp(save?.progression?.safeAreas?.[safeAreaId]?.visitedAt)
  );
}

export function canEnterSafeArea(save, safeAreaId) {
  return isSafeAreaUnlocked(save, safeAreaId) && isSafeAreaVisited(save, safeAreaId);
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
  return canEnterSafeArea(save, requestedSafeAreaId)
    ? requestedSafeAreaId
    : DEFAULT_SAFE_AREA_ID;
}

export function setCurrentSafeArea(save, safeAreaId, options = {}) {
  if (!getSafeAreaDefinition(safeAreaId)) {
    throw new Error(`找不到安全區 definition：${safeAreaId || "(empty)"}`);
  }
  if (!isSafeAreaUnlocked(save, safeAreaId)) {
    throw new Error(`安全區尚未解鎖：${safeAreaId}`);
  }
  if (!options.allowUnvisited && !isSafeAreaVisited(save, safeAreaId)) {
    throw new Error(`安全區尚未造訪：${safeAreaId}`);
  }
  if (!save.settings || typeof save.settings !== "object" || Array.isArray(save.settings)) {
    save.settings = {};
  }
  save.settings.currentSafeAreaId = safeAreaId;
  return safeAreaId;
}

export function markSafeAreaVisited(save, safeAreaId, options = {}) {
  const definition = getSafeAreaDefinition(safeAreaId);
  if (!definition) {
    throw new Error(`找不到安全區 definition：${safeAreaId || "(empty)"}`);
  }
  ensureSafeAreaProgression(save, options.definitions || safeAreaDefinitions);
  const progress = save.progression.safeAreas[safeAreaId];
  const visitedAt = normalizeTimestamp(options.visitedAt) || new Date().toISOString();
  progress.unlocked = true;
  progress.unlockedAt ||= visitedAt;
  progress.visitedAt ||= visitedAt;
  return progress.visitedAt;
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
    const progress = save.progression.safeAreas[safeAreaId];
    if (!progress || typeof progress !== "object" || Array.isArray(progress)) {
      save.progression.safeAreas[safeAreaId] = defaultProgress;
      return;
    }
    progress.unlocked = progress.unlocked === true || Boolean(normalizeTimestamp(progress.visitedAt));
    progress.unlockedAt = progress.unlocked
      ? normalizeTimestamp(progress.unlockedAt)
        || defaultProgress.unlockedAt
        || new Date().toISOString()
      : null;
    progress.visitedAt = normalizeTimestamp(progress.visitedAt);
    if (safeAreaId === DEFAULT_SAFE_AREA_ID) {
      progress.unlocked = true;
      progress.unlockedAt ||= defaultProgress.unlockedAt;
      progress.visitedAt ||= defaultProgress.visitedAt;
    }
    if (progress.visitedAt) {
      progress.unlocked = true;
      progress.unlockedAt ||= progress.visitedAt;
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

function normalizeTimestamp(value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  return Number.isNaN(Date.parse(value)) ? null : value;
}
