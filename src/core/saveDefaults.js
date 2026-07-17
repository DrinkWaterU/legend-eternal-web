import {
  DEFAULT_CHARACTER_ID,
  DEFAULT_REGION_ID,
  GAME_VERSION,
  SAVE_SCHEMA_VERSION
} from "../config.js";
import { achievementDefinitions } from "../data/achievements.js";
import { characterDefinitions } from "../data/characters/index.js";
import { regionDefinitions } from "../data/regions/index.js";
import { DEFAULT_SAFE_AREA_ID } from "../data/safeAreas.js";
import { createDefaultSafeAreaProgression } from "./safeAreaProgression.js";
import { createDefaultQuestState } from "./questRules.js";

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
      safeAreas: createDefaultSafeAreaProgression(undefined, { defaultVisitedAt: now })
    },
    inventory: { gold: 0, materials: {}, weapons: {} },
    storyFlags: createDefaultStoryFlags(),
    achievements: createDefaultAchievements(),
    quests: createDefaultQuestState(),
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

function createDefaultRegionProgression() {
  return Object.fromEntries(Object.keys(regionDefinitions).map((regionId) => [
    regionId,
    { unlocked: true, bestEncounter: 0, clears: 0 }
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
      equipment: { weaponId: null },
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
    archerRescued: false,
    metAnpingBlacksmith: false,
    knowsAnpingBlacksmithName: false,
    metAnpingGuildReceptionist: false,
    knowsAnpingGuildReceptionistName: false,
    registeredAtAnpingGuild: false,
    guildQuestIntroductionSeen: false
  };
}

function createDefaultAchievements() {
  return Object.fromEntries(Object.keys(achievementDefinitions).map((achievementId) => [
    achievementId,
    { unlocked: false, unlockedAt: null }
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
    { runs: 0, clears: 0, retreats: 0, highestRunLevel: 1 }
  ]));
}
