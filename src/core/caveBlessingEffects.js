import { getEnemyProtectionState } from "./enemyProtection.js";
import { applyParalysis } from "./combatStatusEffects.js";
import { roll } from "../utils.js";

export function resetBlessingBattleState(hero) {
  hero.blessingBattleState = { shieldReversalReady: false, shieldReversalUsed: false, supportCounterCharges: 0, supportCounterUses: 0, frontlineBreakUsed: false, tideMarkTargetId: null, tideMarkCreated: false, cavernEchoTargetId: null, cavernEchoStacks: 0 };
}

export function getCaveDirectAttackModifiers({ hero, enemy, enemies }) {
  const runtime = ensureRuntime(hero);
  const marked = Boolean(runtime.tideMarkTargetId) && runtime.tideMarkTargetId === enemy.runtimeId;
  const protectedEnemy = getEnemyProtectionState({ enemy, enemies }).protected;
  return {
    extraDamage: (runtime.shieldReversalReady ? number(hero.shieldReversalDamage) : 0) + (runtime.supportCounterCharges > 0 ? number(hero.supportCounterDamage) : 0) + (runtime.cavernEchoTargetId && runtime.cavernEchoTargetId === enemy.runtimeId ? number(runtime.cavernEchoStacks) * number(hero.cavernEchoDamagePerStack) : 0),
    damageMultiplier: (enemy.paralysis?.remainingTurns > 0 ? 1 + number(hero.paralysisResonanceDamageBonus) : 1) * (protectedEnemy ? 1 + number(hero.protectedEnemyDamageBonus) : 1),
    critChanceBonus: marked ? number(hero.tideMarkCritChance) : 0,
    consumeShieldReversal: runtime.shieldReversalReady,
    consumeSupportCounter: runtime.supportCounterCharges > 0,
    consumeTideMark: marked
  };
}

export function finishCaveDirectAttack({ hero, enemy, enemyAlive }) {
  const runtime = ensureRuntime(hero);
  if (number(hero.enemyParalysisChance) > 0 && enemyAlive && roll(number(hero.enemyParalysisChance))) applyParalysis(enemy);
  if (runtime.tideMarkTargetId && (!enemyAlive || runtime.tideMarkTargetId === enemy.runtimeId)) runtime.tideMarkTargetId = null;
  if (enemyAlive && !runtime.tideMarkCreated && number(hero.tideMarkCritChance) > 0) {
    runtime.tideMarkTargetId = enemy.runtimeId;
    runtime.tideMarkCreated = true;
  }
  if (!enemyAlive) {
    if (runtime.cavernEchoTargetId === enemy.runtimeId) { runtime.cavernEchoTargetId = null; runtime.cavernEchoStacks = 0; }
    return;
  }
  if (runtime.cavernEchoTargetId === enemy.runtimeId) runtime.cavernEchoStacks = Math.min(number(hero.cavernEchoMaxStacks), runtime.cavernEchoStacks + 1);
  else { runtime.cavernEchoTargetId = enemy.runtimeId; runtime.cavernEchoStacks = 0; }
}

export function consumeCaveDirectAttackModifiers(hero, modifiers) {
  const runtime = ensureRuntime(hero);
  if (modifiers.consumeShieldReversal) runtime.shieldReversalReady = false;
  if (modifiers.consumeSupportCounter) runtime.supportCounterCharges = Math.max(0, runtime.supportCounterCharges - 1);
  if (modifiers.consumeTideMark) runtime.tideMarkTargetId = null;
}

export function registerEnemySupportCounter(hero) {
  const runtime = ensureRuntime(hero);
  if (runtime.supportCounterUses >= number(hero.supportCounterMaxUses)) return;
  runtime.supportCounterUses += 1;
  runtime.supportCounterCharges += 1;
}

export function registerFrontlineDefeat(hero, enemy) {
  const runtime = ensureRuntime(hero);
  if (runtime.frontlineBreakUsed || enemy?.combatRole !== "frontline" || number(hero.frontlineBreakAttack) <= 0) return false;
  runtime.frontlineBreakUsed = true;
  hero.battleAttackBonus = number(hero.battleAttackBonus) + number(hero.frontlineBreakAttack);
  return true;
}

export function registerShieldDepletedByDirectAttack(hero, shieldBefore) {
  const runtime = ensureRuntime(hero);
  if (runtime.shieldReversalUsed || shieldBefore <= 0 || number(hero.shield) > 0 || number(hero.shieldReversalDamage) <= 0) return;
  runtime.shieldReversalUsed = true;
  runtime.shieldReversalReady = true;
}

function ensureRuntime(hero) { hero.blessingBattleState ??= {}; return hero.blessingBattleState; }
function number(value) { return Math.max(0, Number(value) || 0); }
