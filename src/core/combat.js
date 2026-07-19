export { buildEnemy, buildEnemyGroup, buildScaledEnemy } from "./enemyBuilder.js";
export {
  getHeroAttackDamageMultiplier,
  getHeroDirectAttackDamage,
  resolveHeroAction,
  resolveHeroEntangle,
  resolveHeroStrike
} from "./heroCombat.js";
export { resolveEnemyAction } from "./enemyCombat.js";
export {
  advanceHeroCombatStatuses,
  applyHeroBattleHealing,
  applyEnemyEndOfTurnNegativeEffects,
  applyEnemyEndOfTurnRecoveryEffects,
  applyParalysis,
  applySaltErosion,
  applyHeroEndOfTurnNegativeEffects,
  applyHeroEndOfTurnRecoveryEffects,
  getHeroBattleHealingAmount,
  getHeroBattleHealingMultiplier,
  getEnemyPendingHpLoss,
  getHeroPendingHpLoss
} from "./combatStatusEffects.js";
