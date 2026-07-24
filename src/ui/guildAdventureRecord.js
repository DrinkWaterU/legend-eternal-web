import { getCharacterMaxLevel, getSkillsForLevel } from "../core/progression.js";
import { ANPING_TOWN_SAFE_AREA_ID } from "../data/safeAreas.js";

export function buildGuildAdventureRecordModel({
  save,
  characterDefinitions = {}
} = {}) {
  const selectedCharacterId = characterDefinitions[save?.settings?.selectedCharacterId]
    ? save.settings.selectedCharacterId
    : Object.keys(characterDefinitions)[0] || null;
  const character = characterDefinitions[selectedCharacterId] || null;
  const progress = save?.progression?.characters?.[selectedCharacterId] || {};
  const level = Number.isSafeInteger(progress.level) && progress.level > 0 ? progress.level : 1;
  const learnedSkillCount = Array.isArray(progress.learnedSkills)
    ? progress.learnedSkills.length
    : getSkillsForLevel(character || {}, level).length;
  const maxLevel = getCharacterMaxLevel(character || {});
  const statistics = save?.statistics || {};
  const regionStats = statistics.regions || {};
  const forestRouteClears = regionStats.forest?.routeClears || {};
  const coastClears = safeCount(regionStats.beach?.clears);

  const experiences = [];
  addCountExperience(experiences, "完成平原主要冒險", regionStats.plains?.clears);
  addCountExperience(experiences, "穿越森林主要路線", forestRouteClears.main);
  addCountExperience(experiences, "解決哥布林營地事件", forestRouteClears.goblinCamp);
  if (save?.storyFlags?.archerRescued === true) {
    experiences.push({ id: "archer-rescued", label: "救出弓箭手", status: "紀錄已確認" });
  }
  if (save?.progression?.safeAreas?.[ANPING_TOWN_SAFE_AREA_ID]?.visitedAt) {
    experiences.push({ id: "anping-visited", label: "抵達安平鎮", status: "紀錄已確認" });
  }
  addCountExperience(experiences, "完成海岸地區冒險", coastClears);

  const unlockedCharacters = Object.entries(characterDefinitions)
    .filter(([characterId]) => save?.progression?.characters?.[characterId]?.unlocked === true)
    .map(([characterId, definition]) => {
      const characterProgress = save?.progression?.characters?.[characterId] || {};
      return {
        id: characterId,
        name: definition.name,
        role: definition.role || definition.summary || "冒險者",
        level: resolveCharacterLevel(characterProgress),
        portrait: definition.portrait,
        portraitFocus: definition.portraitFocus
      };
    });

  const questStats = save?.quests?.statistics || {};

  return {
    selectedCharacter: character ? {
      id: selectedCharacterId,
      name: character.name,
      role: character.role || character.summary || "冒險者",
      level,
      learnedSkillCount,
      maxLevel,
      atMaxLevel: level >= maxLevel,
      portrait: character.portrait,
      portraitFocus: character.portraitFocus
    } : null,
    summary: {
      totalRuns: safeCount(statistics.totalRuns),
      totalClears: safeCount(statistics.totalClears),
      totalEnemiesDefeated: safeCount(statistics.totalEnemiesDefeated),
      bossesDefeated: safeCount(statistics.bossesDefeated)
    },
    experiences,
    questHistory: {
      completedTotal: safeCount(questStats.completedTotal),
      completedByRarity: {
        common: safeCount(questStats.completedByRarity?.common),
        advanced: safeCount(questStats.completedByRarity?.advanced),
        rare: safeCount(questStats.completedByRarity?.rare)
      },
      rewardGoldTotal: safeCount(questStats.rewardGoldTotal),
      abandonedTotal: safeCount(questStats.abandonedTotal)
    },
    unlockedCharacters,
    celineComment: resolveCelineComment({ forestRouteClears, coastClears })
  };
}

function resolveCharacterLevel(progress) {
  return Number.isSafeInteger(progress?.level) && progress.level > 0 ? progress.level : 1;
}

function addCountExperience(target, label, count) {
  const normalized = safeCount(count);
  if (normalized > 0) {
    target.push({ id: label, label, status: `完成 ${normalized} 次` });
  }
}

function safeCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function resolveCelineComment({ forestRouteClears, coastClears }) {
  if (safeCount(coastClears) > 0) {
    return "能從那些魚人的陰暗洞窟裡全身而退，確實證明了你的本事；但越是陌生的深水區，越不能把退路全押在運氣上喔。";
  }
  if (safeCount(forestRouteClears.goblinCamp) > 0) {
    return "能處理哥布林營地那樣的混亂，證明你已經有自己的判斷了。不過，越有經驗的人越該記得留一條退路喔。";
  }
  if (safeCount(forestRouteClears.main) > 0) {
    return "能平安穿過森林，已經足以證明你不再是毫無經驗的新人。接下來也別因為走得更遠，就忘了先顧好自己。";
  }
  return "紀錄還不算多也沒關係。每一段能平安帶回來的經歷，才是公會真正想替你保存的東西。";
}
