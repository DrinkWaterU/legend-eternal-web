import { applyEquippedWeapon } from "./equipment.js";
import { clone } from "../utils.js";

export function getCharacterMaxLevel(character) {
  return character.levelCurve?.maxLevel || 1;
}

export function getExpToNextLevel(level, character) {
  const curve = character.levelCurve;
  if (!curve || level >= getCharacterMaxLevel(character)) {
    return "MAX";
  }
  return Math.floor(
    (curve.base || 0) * level ** (curve.exponent || 1)
    + (curve.linear || 0) * level
    + (curve.offset || 0)
  );
}

export function getSkillsForLevel(character, level) {
  return (character.skills || []).filter((skill) => skill.level <= level);
}

export function getGrowthForLevel(character, level) {
  return (character.levelGrowth || []).find((growth) => growth.level === level);
}

export function normalizeCharacterProgress(progress, character) {
  progress.level = Math.max(1, Math.min(getCharacterMaxLevel(character), Math.floor(progress.level || 1)));
  progress.exp = Math.max(0, Math.floor(progress.exp || 0));
  progress.learnedSkills = getSkillsForLevel(character, progress.level).map((skill) => skill.id);
  progress.equipment = {
    weaponId: typeof progress.equipment?.weaponId === "string"
      ? progress.equipment.weaponId
      : null
  };
  return progress;
}

export function buildHeroFromProgression(character, progress, options = {}) {
  const normalizedProgress = normalizeCharacterProgress(progress, character);
  const hero = clone(character.template);
  hero.characterId = character.id || null;
  hero.level = normalizedProgress.level;
  hero.exp = normalizedProgress.exp;
  hero.expToNext = getExpToNextLevel(normalizedProgress.level, character);
  hero.skills = [...normalizedProgress.learnedSkills];
  hero.skillState = createSkillState();
  hero.critDamageMultiplier = hero.critDamageMultiplier || 1.7;

  (character.levelGrowth || []).forEach((growth) => {
    if (growth.level <= normalizedProgress.level) {
      applyProgressionEffects(hero, growth.effects || [], { recover: false });
    }
  });

  getSkillsForLevel(character, normalizedProgress.level).forEach((skill) => {
    applyProgressionEffects(hero, skill.effects || [], { recover: false });
  });

  applyEquippedWeapon(hero, {
    character,
    progress: normalizedProgress,
    inventory: options.inventory,
    weaponDefinitions: options.weaponDefinitions
  });

  hero.hp = hero.maxHp;
  return hero;
}

export function createSkillState() {
  return {
    emergencyBandageUsed: false,
    lastStandUsed: false,
    statusFamiliarityStacks: 0
  };
}

export function applyProgressionEffects(hero, effects, options = {}) {
  const { recover = true } = options;
  effects.forEach((effect) => {
    if (effect.type === "add") {
      hero[effect.stat] = (hero[effect.stat] || 0) + effect.amount;
      if (recover && effect.stat === "maxHp") {
        hero.hp = Math.min(hero.maxHp, (hero.hp || 0) + effect.amount);
      }
    }
  });
}
