import {
  getCharacterMaxLevel,
  getExpToNextLevel,
  getSkillsForLevel
} from "../core/progression.js";
import { characterDefinitions } from "../data/characters/index.js";

export function createDebugCharacterActions({
  state,
  getSaveData,
  getCharacterDefinition,
  unlockAchievement,
  plainsTrialAchievementId,
  saveGameSafe,
  render,
  rebuildHero,
  refresh,
  clampInteger
}) {
  function getCharacterProgress(characterId = state.selectedHeroId) {
    return getSaveData().progression.characters[characterId];
  }

  function getCharacterOptions() {
    return Object.entries(characterDefinitions).map(([id, character]) => ({
      id,
      name: character.name
    }));
  }

  function setLevel(level) {
    const character = getCharacterDefinition();
    const progress = getCharacterProgress();
    const maxLevel = getCharacterMaxLevel(character);
    progress.level = clampInteger(level, 1, maxLevel);
    const expToNext = getExpToNextLevel(progress.level, character);
    if (expToNext !== "MAX") {
      progress.exp = Math.min(progress.exp, Math.max(0, expToNext - 1));
    }
    progress.learnedSkills = getSkillsForLevel(character, progress.level).map((skill) => skill.id);
    rebuildHero();
    saveGameSafe();
    refresh();
    return `已設定等級為 Lv. ${progress.level}。`;
  }

  function setExp(exp) {
    const character = getCharacterDefinition();
    const progress = getCharacterProgress();
    const expToNext = getExpToNextLevel(progress.level, character);
    const maxExp = expToNext === "MAX" ? 999999 : Math.max(0, expToNext - 1);
    progress.exp = clampInteger(exp, 0, maxExp);
    rebuildHero();
    saveGameSafe();
    refresh();
    return `已設定 EXP 為 ${progress.exp}。`;
  }

  function healHero() {
    if (!state.hero) {
      return "目前沒有戰鬥角色。";
    }
    state.hero.hp = state.hero.maxHp;
    state.hero.poison = 0;
    state.hero.shield = state.hero.shield || 0;
    render();
    return "已補滿目前 HP 並清除中毒。";
  }

  function unlockPhoenix() {
    const saveData = getSaveData();
    saveData.storyFlags.phoenixBlessingUnlocked = true;
    saveData.storyFlags.achievementSystemUnlocked = true;
    unlockAchievement(plainsTrialAchievementId);
    saveGameSafe();
    refresh();
    return "已解鎖鳳凰加護。";
  }

  function removePhoenix() {
    const saveData = getSaveData();
    saveData.storyFlags.phoenixBlessingUnlocked = false;
    saveData.storyFlags.plainsBossStorySeen = false;
    saveData.storyFlags.achievementSystemUnlocked = false;
    Object.keys(saveData.achievements).forEach((achievementId) => {
      saveData.achievements[achievementId] = {
        unlocked: false,
        unlockedAt: null
      };
    });
    saveGameSafe();
    refresh();
    return "已移除鳳凰加護並重置平原劇情旗標。";
  }

  return {
    setLevel,
    setExp,
    healHero,
    unlockPhoenix,
    removePhoenix,
    getCharacterOptions
  };
}
