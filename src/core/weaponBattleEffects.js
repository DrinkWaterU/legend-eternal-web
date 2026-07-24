import { getWeaponDefinition } from "../data/weapons.js";

const ADAPTATION_MODES = Object.freeze({
  "low-hp": Object.freeze({ name: "求生架勢" }),
  boss: Object.freeze({ name: "迎戰架勢" }),
  "multi-enemy": Object.freeze({ name: "守陣架勢" }),
  "single-enemy": Object.freeze({ name: "破勢架勢" })
});

export function applyEquippedWeaponBattleStart(hero, options = {}) {
  const weapon = getWeaponDefinition(hero?.equipment?.weaponId);
  if (!hero || !weapon || hero.weaponBattleStartApplied === true) {
    return null;
  }
  if (Array.isArray(weapon.allowedCharacterIds)
    && !weapon.allowedCharacterIds.includes(hero.characterId)) {
    return null;
  }

  const effect = weapon.specialEffect;
  if (effect?.type !== "adventurerAdaptation") {
    return null;
  }

  const result = applyAdventurerAdaptation(hero, effect, options);
  hero.weaponBattleStartApplied = true;
  hero.weaponBattleMode = result.modeId;
  return {
    weaponId: weapon.id,
    weaponName: weapon.name,
    effectName: weapon.effectName,
    ...result
  };
}

function applyAdventurerAdaptation(hero, effect, options) {
  const enemyCount = Math.max(0, Math.floor(Number(options.enemyCount) || 0));
  const hpRatio = hero.maxHp > 0 ? hero.hp / hero.maxHp : 0;

  if (hpRatio <= effect.lowHpThreshold) {
    return applyMode(hero, "low-hp", {
      attackBonus: effect.lowHpAttackBonus,
      shield: effect.lowHpShield
    });
  }
  if (options.encounterType === "boss") {
    return applyMode(hero, "boss", {
      attackBonus: effect.bossAttackBonus,
      critChance: effect.bossCritChance,
      shield: effect.bossShield
    });
  }
  if (enemyCount >= effect.multiEnemyThreshold) {
    return applyMode(hero, "multi-enemy", {
      attackBonus: effect.multiEnemyAttackBonus,
      shield: effect.multiEnemyShield
    });
  }
  return applyMode(hero, "single-enemy", {
    attackBonus: effect.singleEnemyAttackBonus,
    critChance: effect.singleEnemyCritChance
  });
}

function applyMode(hero, modeId, bonuses) {
  const attackBonus = Math.max(0, Number(bonuses.attackBonus) || 0);
  const critChance = Math.max(0, Number(bonuses.critChance) || 0);
  const shield = Math.max(0, Math.floor(Number(bonuses.shield) || 0));
  hero.battleAttackBonus = (Number(hero.battleAttackBonus) || 0) + attackBonus;
  hero.battleCritBonus = (Number(hero.battleCritBonus) || 0) + critChance;
  hero.shield = (Number(hero.shield) || 0) + shield;

  const parts = [];
  if (attackBonus > 0) parts.push(`攻擊 +${attackBonus}`);
  if (critChance > 0) parts.push(`暴擊率 +${Math.round(critChance * 100)}%`);
  if (shield > 0) parts.push(`護盾 +${shield}`);
  return {
    modeId,
    modeName: ADAPTATION_MODES[modeId].name,
    attackBonus,
    critChance,
    shield,
    summary: parts.join("、")
  };
}
