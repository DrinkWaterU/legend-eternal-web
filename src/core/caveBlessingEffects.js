import { applyParalysis } from "./combatStatusEffects.js";
import { roll } from "../utils.js";

export function resetBlessingBattleState(hero) {
  hero.blessingBattleState = {
    shieldReversalReady: false,
    shieldReversalUsed: false,
    supportCounterCharges: 0,
    supportCounterUses: 0,
    frontlineBreakUsed: false,
    tideMarkTargetId: null,
    tideMarkCreated: false,
    cavernEchoTargetId: null,
    cavernEchoStacks: 0
  };
}

export function getCaveDirectAttackModifiers({ hero, enemy, enemies }) {
  const runtime = ensureRuntime(hero);
  const marked = Boolean(runtime.tideMarkTargetId) && runtime.tideMarkTargetId === enemy.runtimeId;
  const sameEchoTarget = Boolean(runtime.cavernEchoTargetId)
    && runtime.cavernEchoTargetId === enemy.runtimeId;
  const echoStacksForAttack = sameEchoTarget
    ? Math.min(number(hero.cavernEchoMaxStacks), number(runtime.cavernEchoStacks) + 1)
    : 0;

  return {
    extraDamage:
      (runtime.shieldReversalReady ? number(hero.shieldReversalDamage) : 0)
      + (runtime.supportCounterCharges > 0 ? number(hero.supportCounterDamage) : 0)
      + (echoStacksForAttack * number(hero.cavernEchoDamagePerStack)),
    damageMultiplier: enemy.paralysis?.remainingTurns > 0
      ? 1 + number(hero.paralysisResonanceDamageBonus)
      : 1,
    critChanceBonus: marked ? number(hero.tideMarkCritChance) : 0,
    consumeShieldReversal: runtime.shieldReversalReady,
    consumeSupportCounter: runtime.supportCounterCharges > 0,
    consumeTideMark: marked
  };
}

export function shouldIgnoreProtectedEnemyReduction(hero) {
  return hero?.ignoreProtectedEnemyReduction === true;
}

export function finishCaveDirectAttack({ hero, enemy, enemyAlive }) {
  const runtime = ensureRuntime(hero);
  const paralysisChance = Math.min(1, number(hero.enemyParalysisChance));
  if (paralysisChance > 0 && enemyAlive && roll(paralysisChance)) {
    applyParalysis(enemy);
  }

  if (runtime.tideMarkTargetId && (!enemyAlive || runtime.tideMarkTargetId === enemy.runtimeId)) {
    runtime.tideMarkTargetId = null;
  }
  if (enemyAlive && !runtime.tideMarkCreated && number(hero.tideMarkCritChance) > 0) {
    runtime.tideMarkTargetId = enemy.runtimeId;
    runtime.tideMarkCreated = true;
  }

  if (!enemyAlive) {
    if (runtime.cavernEchoTargetId === enemy.runtimeId) {
      runtime.cavernEchoTargetId = null;
      runtime.cavernEchoStacks = 0;
    }
    return;
  }

  if (runtime.cavernEchoTargetId === enemy.runtimeId) {
    runtime.cavernEchoStacks = Math.min(
      number(hero.cavernEchoMaxStacks),
      number(runtime.cavernEchoStacks) + 1
    );
  } else {
    runtime.cavernEchoTargetId = enemy.runtimeId;
    runtime.cavernEchoStacks = 0;
  }
}

export function consumeCaveDirectAttackModifiers(hero, modifiers) {
  const runtime = ensureRuntime(hero);
  if (modifiers.consumeShieldReversal) {
    runtime.shieldReversalReady = false;
  }
  if (modifiers.consumeSupportCounter) {
    runtime.supportCounterCharges = Math.max(0, runtime.supportCounterCharges - 1);
  }
  if (modifiers.consumeTideMark) {
    runtime.tideMarkTargetId = null;
  }
}

export function registerEnemySupportCounter(hero) {
  const runtime = ensureRuntime(hero);
  if (runtime.supportCounterUses >= number(hero.supportCounterMaxUses)) {
    return;
  }
  runtime.supportCounterUses += 1;
  runtime.supportCounterCharges += 1;
}

export function registerFrontlineDefeat(hero, enemy) {
  const runtime = ensureRuntime(hero);
  if (
    runtime.frontlineBreakUsed
    || enemy?.combatRole !== "frontline"
    || number(hero.frontlineBreakAttack) <= 0
  ) {
    return false;
  }
  runtime.frontlineBreakUsed = true;
  hero.battleAttackBonus = number(hero.battleAttackBonus) + number(hero.frontlineBreakAttack);
  return true;
}

export function registerShieldDepletedByDirectAttack(hero, shieldBefore) {
  const runtime = ensureRuntime(hero);
  if (
    runtime.shieldReversalUsed
    || shieldBefore <= 0
    || number(hero.shield) > 0
    || number(hero.shieldReversalDamage) <= 0
  ) {
    return;
  }
  runtime.shieldReversalUsed = true;
  runtime.shieldReversalReady = true;
}

function ensureRuntime(hero) {
  hero.blessingBattleState ??= {};
  return hero.blessingBattleState;
}

function number(value) {
  return Math.max(0, Number(value) || 0);
}
