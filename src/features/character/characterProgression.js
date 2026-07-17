import {
  applyProgressionEffects,
  buildHeroFromProgression as buildHeroFromProgressionCore,
  getCharacterMaxLevel,
  getExpToNextLevel,
  getGrowthForLevel,
  getSkillsForLevel,
  normalizeCharacterProgress as normalizeCharacterProgressCore
} from "../../core/progression.js";

export function createCharacterProgression({
  state,
  saveStore,
  characterDefinitions,
  weaponDefinitions,
  addLog,
  saveGameSafe
}) {
  function getCharacterProgress(characterId = state.selectedHeroId) {
    return saveStore.current.progression.characters[characterId];
  }

  function getCharacterDefinition(characterId = state.selectedHeroId) {
    return characterDefinitions[characterId];
  }

  function normalizeCharacterProgress(characterId = state.selectedHeroId) {
    const character = getCharacterDefinition(characterId);
    const progress = getCharacterProgress(characterId);
    return normalizeCharacterProgressCore(progress, character);
  }

  function buildHeroFromProgression(characterId = state.selectedHeroId) {
    const character = getCharacterDefinition(characterId);
    const progress = normalizeCharacterProgress(characterId);
    return buildHeroFromProgressionCore(character, progress, {
      inventory: saveStore.current.inventory,
      weaponDefinitions
    });
  }

  function gainCharacterExp(amount) {
    if (!state.hero || amount <= 0) return;
    if (state.debugBuildRun) {
      state.runStats.expGained += amount;
      return;
    }

    const character = getCharacterDefinition();
    const progress = getCharacterProgress();
    progress.exp += amount;
    state.runStats.expGained += amount;
    addLog("system", "expGain", { amount });
    applyCharacterLevelUps(character, progress);
    syncHeroProgressState(character, progress);
    saveGameSafe();
  }

  function applyCharacterLevelUps(character, progress) {
    while (progress.level < getCharacterMaxLevel(character)) {
      const expToNext = getExpToNextLevel(progress.level, character);
      if (expToNext === "MAX" || progress.exp < expToNext) break;

      progress.exp -= expToNext;
      progress.level += 1;
      state.runStats.endLevel = progress.level;
      state.runStats.levelUps.push(progress.level);
      const growth = getGrowthForLevel(character, progress.level);
      applyProgressionEffects(state.hero, growth?.effects || [], { recover: true });
      addLog("system", "levelUp", {
        level: progress.level,
        name: growth?.name || "能力提升"
      });
      learnSkillsForLevel(character, progress);
    }
  }

  function learnSkillsForLevel(character, progress) {
    const knownSkills = new Set(progress.learnedSkills);
    getSkillsForLevel(character, progress.level).forEach((skill) => {
      if (knownSkills.has(skill.id)) return;
      progress.learnedSkills.push(skill.id);
      state.runStats.learnedSkills.push(skill.name);
      state.hero.skills.push(skill.id);
      applyProgressionEffects(state.hero, skill.effects || [], { recover: true });
      addLog("system", "skillLearned", { name: skill.name });
    });
  }

  function syncHeroProgressState(
    character = getCharacterDefinition(),
    progress = getCharacterProgress()
  ) {
    state.hero.level = progress.level;
    state.hero.exp = progress.exp;
    state.hero.expToNext = getExpToNextLevel(progress.level, character);
    state.hero.skills = [...progress.learnedSkills];
    if (state.runStats) {
      state.runStats.endLevel = progress.level;
    }
  }

  function hasPhoenixBlessing() {
    return Boolean(saveStore.current.storyFlags.phoenixBlessingUnlocked);
  }

  function resetCharacterProgress(characterId = state.selectedHeroId) {
    const progress = getCharacterProgress(characterId);
    progress.level = 1;
    progress.exp = 0;
    progress.learnedSkills = [];
  }

  function hasHeroSkill(skillId) {
    return Array.isArray(state.hero?.skills) && state.hero.skills.includes(skillId);
  }

  return Object.freeze({
    getCharacterProgress,
    getCharacterDefinition,
    normalizeCharacterProgress,
    buildHeroFromProgression,
    gainCharacterExp,
    syncHeroProgressState,
    hasPhoenixBlessing,
    resetCharacterProgress,
    hasHeroSkill
  });
}
