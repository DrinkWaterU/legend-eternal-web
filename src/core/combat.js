export { buildEnemy, buildScaledEnemy } from "./enemyBuilder.js";
export {
  getHeroDirectAttackDamage,
  resolveHeroAction,
  resolveHeroEntangle,
  resolveHeroStrike
} from "./heroCombat.js";
export { resolveEnemyAction } from "./enemyCombat.js";
export {
  applyEnemyEndOfTurnNegativeEffects,
  applyEnemyEndOfTurnRecoveryEffects,
  applyHeroEndOfTurnNegativeEffects,
  applyHeroEndOfTurnRecoveryEffects,
  getEnemyPendingHpLoss,
  getHeroPendingHpLoss
} from "./combatStatusEffects.js";
