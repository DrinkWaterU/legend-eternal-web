export function clearHeroBattleRuntimeState(hero) {
  if (!hero || typeof hero !== "object") return hero;

  hero.poison = 0;
  hero.entangle = null;
  hero.saltErosion = null;
  hero.paralysis = null;
  hero.battleAttackBonus = 0;
  hero.battleCritBonus = 0;
  hero.hasAttackedThisBattle = false;
  hero.activeEnemyCount = 0;
  hero.activePreparation = null;
  hero.shield = 0;
  return hero;
}
