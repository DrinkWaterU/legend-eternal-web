import { getEnemyDisplayName, getLivingEnemies } from "./enemyGroups.js";
import { registerEnemySupportCounter } from "./caveBlessingEffects.js";

export function resolveEnemySupportAction({ enemies = [], actor, turn, log, hero = null }) {
  const support = normalizeSupportAction(actor?.supportAction);
  if (
    !support
    || !actor
    || actor.combatRole !== "support"
    || actor.hp <= 0
    || turn % support.everyTurns !== 0
  ) {
    return false;
  }

  const supportUses = normalizeNonNegativeInteger(actor.supportUses);
  if (supportUses >= support.maxUses) {
    return false;
  }

  const target = selectSupportTarget(enemies, actor, support.targetCombatRole);
  if (!target) {
    return false;
  }

  const attackGain = support.attackGain;
  const defenseGain = support.defenseGain;
  target.attack = Math.max(1, Number(target.attack) || 0) + attackGain;
  target.defense = Math.max(0, Number(target.defense) || 0) + defenseGain;
  target.supportAttackBonus = normalizeNonNegativeInteger(target.supportAttackBonus) + attackGain;
  target.supportDefenseBonus = normalizeNonNegativeInteger(target.supportDefenseBonus) + defenseGain;
  actor.supportUses = supportUses + 1;
  if (hero) registerEnemySupportCounter(hero);

  logSupportAction({
    log,
    actor,
    target,
    attackGain,
    defenseGain
  });
  return true;
}

function selectSupportTarget(enemies, actor, targetCombatRole) {
  const candidates = getLivingEnemies(enemies)
    .filter((enemy) => enemy !== actor)
    .filter((enemy) => !targetCombatRole || enemy.combatRole === targetCombatRole);

  return candidates.sort(compareSupportTargets)[0] || null;
}

function compareSupportTargets(left, right) {
  const leftRatio = getHpRatio(left);
  const rightRatio = getHpRatio(right);
  if (leftRatio !== rightRatio) {
    return leftRatio - rightRatio;
  }
  return String(left.runtimeId || "").localeCompare(String(right.runtimeId || ""));
}

function getHpRatio(enemy) {
  const maxHp = Math.max(1, Number(enemy.maxHp) || 1);
  return Math.max(0, Number(enemy.hp) || 0) / maxHp;
}

function normalizeSupportAction(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const everyTurns = normalizePositiveInteger(value.everyTurns);
  const maxUses = normalizePositiveInteger(value.maxUses);
  const attackGain = normalizeNonNegativeInteger(value.attackGain);
  const defenseGain = normalizeNonNegativeInteger(value.defenseGain);
  if (!everyTurns || !maxUses || (attackGain <= 0 && defenseGain <= 0)) {
    return null;
  }

  return {
    everyTurns,
    maxUses,
    targetCombatRole: value.targetCombatRole ? String(value.targetCombatRole) : "",
    attackGain,
    defenseGain
  };
}

function normalizePositiveInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function normalizeNonNegativeInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function logSupportAction({ log, actor, target, attackGain, defenseGain }) {
  const values = {
    actor: getEnemyDisplayName(actor),
    target: getEnemyDisplayName(target),
    attackGain,
    defenseGain
  };
  if (attackGain > 0 && defenseGain > 0) {
    log?.template?.("status", "enemySupportAttackDefense", values);
  } else if (attackGain > 0) {
    log?.template?.("status", "enemySupportAttack", values);
  } else {
    log?.template?.("status", "enemySupportDefense", values);
  }
}
