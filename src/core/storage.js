import { DEFAULT_CHARACTER_ID, DEFAULT_REGION_ID, GAME_VERSION, SAVE_KEY, SAVE_SCHEMA_VERSION } from "../config.js";
import { characterDefinitions } from "../data/characters/index.js";
import { regionDefinitions } from "../data/regions/index.js";
import { toSafeInteger, toSafeNumber } from "../utils.js";

export function createDefaultSave() {
  const now = new Date().toISOString();
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    gameVersion: GAME_VERSION,
    profile: {
      createdAt: now,
      updatedAt: now,
      migratedAt: null,
      exportedAt: null
    },
    progression: {
      regions: createDefaultRegionProgression(),
      characters: createDefaultCharacterProgression()
    },
    inventory: {
      gold: 0,
      materials: {}
    },
    achievements: {},
    statistics: {
      totalRuns: 0,
      totalDefeats: 0,
      totalClears: 0,
      totalEnemiesDefeated: 0,
      bossesDefeated: 0,
      regions: createDefaultRegionStatistics(),
      characters: createDefaultCharacterStatistics()
    },
    settings: {
      selectedRegionId: DEFAULT_REGION_ID,
      selectedCharacterId: DEFAULT_CHARACTER_ID
    }
  };
}

export function loadSave() {
  const fallback = createDefaultSave();
  try {
    const rawSave = localStorage.getItem(SAVE_KEY);
    if (!rawSave) {
      saveGame(fallback);
      return fallback;
    }
    return migrateSave(JSON.parse(rawSave), { persist: true });
  } catch {
    return fallback;
  }
}

export function migrateSave(rawSave, options = {}) {
  const { persist = false } = options;
  const save = createDefaultSave();
  if (!rawSave || typeof rawSave !== "object") {
    if (persist) {
      saveGame(save);
    }
    return save;
  }

  const rawSchemaVersion = toSafeInteger(rawSave.schemaVersion, 0);
  const shouldMarkMigration = rawSchemaVersion !== SAVE_SCHEMA_VERSION;

  save.gameVersion = GAME_VERSION;
  save.profile.createdAt = rawSave.profile?.createdAt || save.profile.createdAt;
  save.profile.updatedAt = rawSave.profile?.updatedAt || save.profile.updatedAt;
  save.profile.migratedAt = shouldMarkMigration ? new Date().toISOString() : rawSave.profile?.migratedAt || save.profile.migratedAt;
  save.profile.exportedAt = rawSave.profile?.exportedAt || save.profile.exportedAt;
  mergePlainObject(save.inventory.materials, rawSave.inventory?.materials);
  save.inventory.gold = toSafeNumber(rawSave.inventory?.gold);
  mergePlainObject(save.achievements, rawSave.achievements);

  migrateStatistics(save, rawSave);
  migrateProgression(save, rawSave);

  save.settings.selectedRegionId = regionDefinitions[rawSave.settings?.selectedRegionId] ? rawSave.settings.selectedRegionId : DEFAULT_REGION_ID;
  save.settings.selectedCharacterId = characterDefinitions[rawSave.settings?.selectedCharacterId] ? rawSave.settings.selectedCharacterId : DEFAULT_CHARACTER_ID;

  if (persist) {
    saveGame(save);
  }
  return save;
}

export function saveGame(save, options = {}) {
  const { onError } = options;
  try {
    save.schemaVersion = SAVE_SCHEMA_VERSION;
    save.gameVersion = GAME_VERSION;
    save.profile.updatedAt = new Date().toISOString();
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    onError?.();
  }
}

export function deleteStoredSave() {
  localStorage.removeItem(SAVE_KEY);
}

export function isImportableSave(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return Boolean(value.schemaVersion || value.statistics || value.progression || value.settings || value.profile);
}

function createDefaultRegionProgression() {
  return Object.fromEntries(Object.keys(regionDefinitions).map((regionId) => [
    regionId,
    {
      unlocked: regionId === DEFAULT_REGION_ID,
      bestEncounter: 0,
      clears: 0
    }
  ]));
}

function createDefaultCharacterProgression() {
  return Object.fromEntries(Object.keys(characterDefinitions).map((characterId) => [
    characterId,
    {
      unlocked: characterId === DEFAULT_CHARACTER_ID,
      level: 1,
      exp: 0,
      learnedSkills: [],
      runs: 0,
      clears: 0
    }
  ]));
}

function createDefaultRegionStatistics() {
  return Object.fromEntries(Object.keys(regionDefinitions).map((regionId) => [
    regionId,
    {
      runs: 0,
      clears: 0,
      bestEncounter: 0
    }
  ]));
}

function createDefaultCharacterStatistics() {
  return Object.fromEntries(Object.keys(characterDefinitions).map((characterId) => [
    characterId,
    {
      runs: 0,
      clears: 0
    }
  ]));
}

function migrateStatistics(save, rawSave) {
  const rawStats = rawSave.statistics || {};
  save.statistics.totalRuns = toSafeNumber(rawStats.totalRuns);
  save.statistics.totalDefeats = toSafeNumber(rawStats.totalDefeats);
  save.statistics.totalClears = toSafeNumber(rawStats.totalClears);
  save.statistics.totalEnemiesDefeated = toSafeNumber(rawStats.totalEnemiesDefeated);
  save.statistics.bossesDefeated = toSafeNumber(rawStats.bossesDefeated);

  Object.keys(regionDefinitions).forEach((regionId) => {
    const rawRegionStats = rawStats.regions?.[regionId] || rawSave.progression?.regions?.[regionId] || {};
    save.statistics.regions[regionId].runs = toSafeNumber(rawRegionStats.runs);
    save.statistics.regions[regionId].clears = toSafeNumber(rawRegionStats.clears);
    save.statistics.regions[regionId].bestEncounter = toSafeNumber(rawRegionStats.bestEncounter);
  });

  Object.keys(characterDefinitions).forEach((characterId) => {
    const rawCharacterStats = rawStats.characters?.[characterId] || rawSave.progression?.characters?.[characterId] || {};
    save.statistics.characters[characterId].runs = toSafeNumber(rawCharacterStats.runs);
    save.statistics.characters[characterId].clears = toSafeNumber(rawCharacterStats.clears);
  });
}

function migrateProgression(save, rawSave) {
  Object.keys(regionDefinitions).forEach((regionId) => {
    const regionProgress = save.progression.regions[regionId];
    const rawRegionProgress = rawSave.progression?.regions?.[regionId] || {};
    regionProgress.unlocked = rawRegionProgress.unlocked ?? regionProgress.unlocked;
    regionProgress.bestEncounter = save.statistics.regions[regionId].bestEncounter;
    regionProgress.clears = save.statistics.regions[regionId].clears;
  });

  Object.keys(characterDefinitions).forEach((characterId) => {
    const characterProgress = save.progression.characters[characterId];
    const rawCharacterProgress = rawSave.progression?.characters?.[characterId] || {};
    characterProgress.unlocked = rawCharacterProgress.unlocked ?? characterProgress.unlocked;
    characterProgress.runs = save.statistics.characters[characterId].runs;
    characterProgress.clears = save.statistics.characters[characterId].clears;
    characterProgress.level = Math.max(1, toSafeNumber(rawCharacterProgress.level, 1));
    characterProgress.exp = toSafeNumber(rawCharacterProgress.exp);
    characterProgress.learnedSkills = Array.isArray(rawCharacterProgress.learnedSkills) ? rawCharacterProgress.learnedSkills : [];
  });
}

function mergePlainObject(target, source) {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return;
  }
  Object.entries(source).forEach(([key, value]) => {
    target[key] = value;
  });
}
