import { DEFAULT_CHARACTER_ID, DEFAULT_REGION_ID, GAME_VERSION, SAVE_KEY, SAVE_SCHEMA_VERSION } from "../config.js";
import { normalizeInventory } from "./rewards.js";
import { createDefaultSafeAreaProgression, getCurrentSafeAreaId, migrateSafeAreaProgression, syncSafeAreaUnlocks } from "./safeAreaProgression.js";
import { achievementDefinitions } from "../data/achievements.js";
import { characterDefinitions } from "../data/characters/index.js";
import { regionDefinitions } from "../data/regions/index.js";
import { DEFAULT_SAFE_AREA_ID } from "../data/safeAreas.js";
import { toSafeInteger } from "../utils.js";

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
      characters: createDefaultCharacterProgression(),
      safeAreas: createDefaultSafeAreaProgression()
    },
    inventory: {
      gold: 0,
      materials: {}
    },
    storyFlags: createDefaultStoryFlags(),
    achievements: createDefaultAchievements(),
    statistics: {
      totalRuns: 0,
      totalDefeats: 0,
      totalClears: 0,
      totalRetreats: 0,
      totalEnemiesDefeated: 0,
      bossesDefeated: 0,
      fleeAttempts: 0,
      fleeSuccesses: 0,
      fleeFailures: 0,
      safeEscapes: 0,
      counterEscapes: 0,
      evacuationEscapes: 0,
      highestRunLevel: 1,
      regions: createDefaultRegionStatistics(),
      characters: createDefaultCharacterStatistics()
    },
    settings: {
      selectedRegionId: DEFAULT_REGION_ID,
      selectedCharacterId: DEFAULT_CHARACTER_ID,
      currentSafeAreaId: DEFAULT_SAFE_AREA_ID,
      musicEnabled: true,
      musicVolume: 0.35
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
  save.inventory.gold = toSafeInteger(rawSave.inventory?.gold);
  normalizeInventory(save.inventory);
  migrateStoryFlags(save, rawSave);
  migrateAchievements(save, rawSave);

  migrateStatistics(save, rawSave, { rawSchemaVersion });
  migrateProgression(save, rawSave, { rawSchemaVersion });
  migrateCharacterUnlocks(save);
  save.progression.safeAreas = migrateSafeAreaProgression(rawSave);
  syncSafeAreaUnlocks(save);

  save.settings.selectedRegionId = regionDefinitions[rawSave.settings?.selectedRegionId] ? rawSave.settings.selectedRegionId : DEFAULT_REGION_ID;
  save.settings.selectedCharacterId = isUnlockedCharacter(save, rawSave.settings?.selectedCharacterId)
    ? rawSave.settings.selectedCharacterId
    : DEFAULT_CHARACTER_ID;
  save.settings.currentSafeAreaId = getCurrentSafeAreaId({
    ...save,
    settings: {
      ...save.settings,
      currentSafeAreaId: rawSave.settings?.currentSafeAreaId
        || rawSave.currentSafeAreaId
        || rawSave.world?.currentSafeAreaId
    }
  });
  save.settings.musicEnabled = typeof rawSave.settings?.musicEnabled === "boolean"
    ? rawSave.settings.musicEnabled
    : save.settings.musicEnabled;
  save.settings.musicVolume = Number.isFinite(rawSave.settings?.musicVolume)
    ? Math.min(1, Math.max(0, rawSave.settings.musicVolume))
    : save.settings.musicVolume;

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
      unlocked: true,
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

function createDefaultStoryFlags() {
  return {
    phoenixBlessingUnlocked: false,
    plainsBossStorySeen: false,
    achievementSystemUnlocked: false,
    archerRescued: false
  };
}

function createDefaultAchievements() {
  return Object.fromEntries(Object.keys(achievementDefinitions).map((achievementId) => [
    achievementId,
    {
      unlocked: false,
      unlockedAt: null
    }
  ]));
}

function createDefaultRegionStatistics() {
  return Object.fromEntries(Object.keys(regionDefinitions).map((regionId) => [
    regionId,
    {
      runs: 0,
      clears: 0,
      retreats: 0,
      bestEncounter: 0,
      ...(regionId === "forest" ? { routeClears: { main: 0, goblinCamp: 0 } } : {})
    }
  ]));
}

function createDefaultCharacterStatistics() {
  return Object.fromEntries(Object.keys(characterDefinitions).map((characterId) => [
    characterId,
    {
      runs: 0,
      clears: 0,
      retreats: 0,
      highestRunLevel: 1
    }
  ]));
}

function migrateStoryFlags(save, rawSave) {
  const rawStoryFlags = rawSave.storyFlags || {};
  Object.keys(save.storyFlags).forEach((flag) => {
    save.storyFlags[flag] = Boolean(rawStoryFlags[flag]);
  });

  if (save.storyFlags.phoenixBlessingUnlocked) {
    save.storyFlags.plainsBossStorySeen = true;
    save.storyFlags.achievementSystemUnlocked = true;
  }
}

function migrateAchievements(save, rawSave) {
  const rawAchievements = rawSave.achievements || {};
  Object.entries(save.achievements).forEach(([achievementId, achievement]) => {
    const rawAchievement = rawAchievements[achievementId] || {};
    achievement.unlocked = Boolean(rawAchievement.unlocked);
    achievement.unlockedAt = rawAchievement.unlockedAt || null;
  });
}

function migrateStatistics(save, rawSave, options = {}) {
  const { rawSchemaVersion = 0 } = options;
  const rawStats = rawSave.statistics || {};
  save.statistics.totalRuns = toSafeInteger(rawStats.totalRuns);
  save.statistics.totalDefeats = toSafeInteger(rawStats.totalDefeats);
  save.statistics.totalClears = toSafeInteger(rawStats.totalClears);
  save.statistics.totalRetreats = toSafeInteger(rawStats.totalRetreats);
  save.statistics.totalEnemiesDefeated = toSafeInteger(rawStats.totalEnemiesDefeated);
  save.statistics.bossesDefeated = toSafeInteger(rawStats.bossesDefeated);
  save.statistics.fleeAttempts = toSafeInteger(rawStats.fleeAttempts);
  save.statistics.fleeSuccesses = toSafeInteger(rawStats.fleeSuccesses);
  save.statistics.fleeFailures = toSafeInteger(rawStats.fleeFailures);
  save.statistics.safeEscapes = toSafeInteger(rawStats.safeEscapes);
  save.statistics.counterEscapes = toSafeInteger(rawStats.counterEscapes);
  save.statistics.evacuationEscapes = toSafeInteger(rawStats.evacuationEscapes);
  save.statistics.highestRunLevel = Math.max(1, toSafeInteger(rawStats.highestRunLevel, 1));

  Object.keys(regionDefinitions).forEach((regionId) => {
    const rawRegionStats = rawStats.regions?.[regionId] || rawSave.progression?.regions?.[regionId] || {};
    save.statistics.regions[regionId].runs = toSafeInteger(rawRegionStats.runs);
    save.statistics.regions[regionId].clears = toSafeInteger(rawRegionStats.clears);
    save.statistics.regions[regionId].retreats = toSafeInteger(rawRegionStats.retreats);
    save.statistics.regions[regionId].bestEncounter = toSafeInteger(rawRegionStats.bestEncounter);
    if (regionId === "forest") {
      if (rawSchemaVersion >= 6) {
        save.statistics.regions[regionId].routeClears.main = toSafeInteger(rawRegionStats.routeClears?.main);
        save.statistics.regions[regionId].routeClears.goblinCamp = toSafeInteger(rawRegionStats.routeClears?.goblinCamp);
      } else {
        save.statistics.regions[regionId].routeClears.main = save.statistics.regions[regionId].clears;
        save.statistics.regions[regionId].routeClears.goblinCamp = 0;
      }
    }
  });

  Object.keys(characterDefinitions).forEach((characterId) => {
    const rawCharacterStats = rawStats.characters?.[characterId] || rawSave.progression?.characters?.[characterId] || {};
    save.statistics.characters[characterId].runs = toSafeInteger(rawCharacterStats.runs);
    save.statistics.characters[characterId].clears = toSafeInteger(rawCharacterStats.clears);
    save.statistics.characters[characterId].retreats = toSafeInteger(rawCharacterStats.retreats);
    save.statistics.characters[characterId].highestRunLevel = Math.max(1, toSafeInteger(rawCharacterStats.highestRunLevel, 1));
  });
}

function migrateProgression(save, rawSave, options = {}) {
  const { rawSchemaVersion = 0 } = options;
  const shouldResetLegacyCharacterGrowth = rawSchemaVersion < 5;

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
    if (shouldResetLegacyCharacterGrowth) {
      characterProgress.level = 1;
      characterProgress.exp = 0;
      characterProgress.learnedSkills = [];
      return;
    }
    characterProgress.level = Math.max(1, toSafeInteger(rawCharacterProgress.level, 1));
    characterProgress.exp = toSafeInteger(rawCharacterProgress.exp);
    characterProgress.learnedSkills = Array.isArray(rawCharacterProgress.learnedSkills) ? rawCharacterProgress.learnedSkills : [];
  });
}

function migrateCharacterUnlocks(save) {
  Object.entries(characterDefinitions).forEach(([characterId, character]) => {
    const storyFlag = character.unlock?.storyFlag;
    const characterProgress = save.progression.characters[characterId];
    if (storyFlag && save.storyFlags[storyFlag] && characterProgress) {
      characterProgress.unlocked = true;
    }
  });
}

function isUnlockedCharacter(save, characterId) {
  return Boolean(
    characterDefinitions[characterId]
    && save.progression.characters[characterId]?.unlocked === true
  );
}

function mergePlainObject(target, source) {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return;
  }
  Object.entries(source).forEach(([key, value]) => {
    target[key] = value;
  });
}
