export { buildEnemy, buildEnemyGroup, buildScaledEnemy } from "./enemyBuilder.js";
export {
  getHeroAttackDamageMultiplier,
  getHeroDirectAttackDamage,
  resolveHeroAction,
  resolveHeroEntangle,
  resolveHeroStrike
} from "./heroCombat.js";
export { resolveEnemyAction } from "./enemyCombat.js";
export { resolveEnemySupportAction } from "./enemySupport.js";
export {
  applyEnemyDamageProtection,
  DEFAULT_ENEMY_PROTECTION_REDUCTION,
  getEnemyProtectionState
} from "./enemyProtection.js";
export {
  advanceHeroCombatStatuses,
  advanceParalysis,
  applyHeroBattleHealing,
  applyEnemyEndOfTurnNegativeEffects,
  applyEnemyEndOfTurnRecoveryEffects,
  applyParalysis,
  applySaltErosion,
  applyHeroEndOfTurnNegativeEffects,
  applyHeroEndOfTurnRecoveryEffects,
  getHeroBattleHealingAmount,
  getHeroBattleHealingMultiplier,
  getParalysisDamageMultiplier,
  getEnemyPendingHpLoss,
  getHeroPendingHpLoss
} from "./combatStatusEffects.js";
