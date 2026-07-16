import {
  DEFAULT_CHARACTER_ID,
  DEFAULT_REGION_ID,
  GAME_VERSION,
  SAVE_SCHEMA_VERSION
} from "../config.js";
import { characterDefinitions } from "../data/characters/index.js";
import { regionDefinitions } from "../data/regions/index.js";
import { weaponDefinitions } from "../data/weapons.js";
import { normalizeCharacterEquipment, normalizeWeaponInventory } from "./equipment.js";
import { normalizeInventory } from "./rewards.js";
import {
  getCurrentSafeAreaId,
  migrateSafeAreaProgression,
  syncSafeAreaUnlocks
} from "./safeAreaProgression.js";
import { createDefaultSave } from "./saveDefaults.js";
import { toSafeInteger } from "../utils.js";

export function migrateSaveData(rawSave) {
  const save = createDefaultSave();
  if (!rawSave || typeof rawSave !== "object") {
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
  save.inventory.weapons = normalizeWeaponInventory(rawSave.inventory?.weapons, weaponDefinitions);
  normalizeInventory(save.inventory);
  migrateStoryFlags(save, rawSave);
  migrateAchievements(save, rawSave);
  migrateStatistics(save, rawSave, { rawSchemaVersion });
  migrateProgression(save, rawSave, { rawSchemaVersion });
  migrateCharacterUnlocks(save);
  migrateCharacterEquipment(save);
  save.progression.safeAreas = migrateSafeAreaProgression(rawSave, undefined, { defaultVisitedAt: save.profile.createdAt });
  syncSafeAreaUnlocks(save);
  migrateSettings(save, rawSave);
  return save;
}

function migrateSettings(save, rawSave) {
  save.settings.selectedRegionId = regionDefinitions[rawSave.settings?.selectedRegionId]
    ? rawSave.settings.selectedRegionId
    : DEFAULT_REGION_ID;
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
  if (save.storyFlags.knowsAnpingBlacksmithName) {
    save.storyFlags.metAnpingBlacksmith = true;
  }
  if (save.storyFlags.knowsAnpingGuildReceptionistName) {
    save.storyFlags.metAnpingGuildReceptionist = true;
  }
  if (save.storyFlags.registeredAtAnpingGuild) {
    save.storyFlags.metAnpingGuildReceptionist = true;
    save.storyFlags.knowsAnpingGuildReceptionistName = true;
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
  for (const field of [
    "totalRuns", "totalDefeats", "totalClears", "totalRetreats",
    "totalEnemiesDefeated", "bossesDefeated", "fleeAttempts", "fleeSuccesses",
    "fleeFailures", "safeEscapes", "counterEscapes", "evacuationEscapes"
  ]) {
    save.statistics[field] = toSafeInteger(rawStats[field]);
  }
  save.statistics.highestRunLevel = Math.max(1, toSafeInteger(rawStats.highestRunLevel, 1));

  Object.keys(regionDefinitions).forEach((regionId) => {
    const rawRegionStats = rawStats.regions?.[regionId] || rawSave.progression?.regions?.[regionId] || {};
    const regionStats = save.statistics.regions[regionId];
    regionStats.runs = toSafeInteger(rawRegionStats.runs);
    regionStats.clears = toSafeInteger(rawRegionStats.clears);
    regionStats.retreats = toSafeInteger(rawRegionStats.retreats);
    regionStats.bestEncounter = toSafeInteger(rawRegionStats.bestEncounter);
    if (regionId === "forest") {
      regionStats.routeClears.main = rawSchemaVersion >= 6
        ? toSafeInteger(rawRegionStats.routeClears?.main)
        : regionStats.clears;
      regionStats.routeClears.goblinCamp = rawSchemaVersion >= 6
        ? toSafeInteger(rawRegionStats.routeClears?.goblinCamp)
        : 0;
    }
  });

  Object.keys(characterDefinitions).forEach((characterId) => {
    const rawCharacterStats = rawStats.characters?.[characterId] || rawSave.progression?.characters?.[characterId] || {};
    const stats = save.statistics.characters[characterId];
    stats.runs = toSafeInteger(rawCharacterStats.runs);
    stats.clears = toSafeInteger(rawCharacterStats.clears);
    stats.retreats = toSafeInteger(rawCharacterStats.retreats);
    stats.highestRunLevel = Math.max(1, toSafeInteger(rawCharacterStats.highestRunLevel, 1));
  });
}

function migrateProgression(save, rawSave, options = {}) {
  const shouldResetLegacyCharacterGrowth = (options.rawSchemaVersion || 0) < 5;
  Object.keys(regionDefinitions).forEach((regionId) => {
    const progress = save.progression.regions[regionId];
    const rawProgress = rawSave.progression?.regions?.[regionId] || {};
    progress.unlocked = rawProgress.unlocked ?? progress.unlocked;
    progress.bestEncounter = save.statistics.regions[regionId].bestEncounter;
    progress.clears = save.statistics.regions[regionId].clears;
  });

  Object.keys(characterDefinitions).forEach((characterId) => {
    const progress = save.progression.characters[characterId];
    const rawProgress = rawSave.progression?.characters?.[characterId] || {};
    progress.unlocked = rawProgress.unlocked ?? progress.unlocked;
    progress.runs = save.statistics.characters[characterId].runs;
    progress.clears = save.statistics.characters[characterId].clears;
    progress.equipment.weaponId = typeof rawProgress.equipment?.weaponId === "string"
      ? rawProgress.equipment.weaponId
      : null;
    if (shouldResetLegacyCharacterGrowth) {
      progress.level = 1;
      progress.exp = 0;
      progress.learnedSkills = [];
      return;
    }
    progress.level = Math.max(1, toSafeInteger(rawProgress.level, 1));
    progress.exp = toSafeInteger(rawProgress.exp);
    progress.learnedSkills = Array.isArray(rawProgress.learnedSkills) ? rawProgress.learnedSkills : [];
  });
}

function migrateCharacterUnlocks(save) {
  Object.entries(characterDefinitions).forEach(([characterId, character]) => {
    const storyFlag = character.unlock?.storyFlag;
    const progress = save.progression.characters[characterId];
    if (storyFlag && save.storyFlags[storyFlag] && progress) {
      progress.unlocked = true;
    }
  });
}

function migrateCharacterEquipment(save) {
  Object.entries(characterDefinitions).forEach(([characterId, character]) => {
    normalizeCharacterEquipment({
      character,
      progress: save.progression.characters[characterId],
      inventory: save.inventory,
      weaponDefinitions
    });
  });
}

function isUnlockedCharacter(save, characterId) {
  return Boolean(
    characterDefinitions[characterId]
    && save.progression.characters[characterId]?.unlocked === true
  );
}

function mergePlainObject(target, source) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return;
  Object.entries(source).forEach(([key, value]) => {
    target[key] = value;
  });
}
