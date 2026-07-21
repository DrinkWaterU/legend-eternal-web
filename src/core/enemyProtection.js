import { getLivingEnemies } from "./enemyGroups.js";

export const DEFAULT_ENEMY_PROTECTION_REDUCTION = 0.3;

const PROTECTED_REAR_ROLES = new Set(["output", "support", "control"]);

export function getEnemyProtectionState({
  enemy,
  enemies = [],
  reductionRatio = DEFAULT_ENEMY_PROTECTION_REDUCTION
} = {}) {
  const normalizedReduction = normalizeReductionRatio(reductionRatio);
  const protectedEnemy = isProtectedRearEnemy(enemy)
    && getLivingEnemies(enemies).some((candidate) => isLivingFishmanFrontline(candidate));

  return {
    protected: protectedEnemy,
    reductionRatio: normalizedReduction,
    label: protectedEnemy ? "被保護" : "",
    description: protectedEnemy
      ? `前衛存活時，受到傷害降低 ${Math.round(normalizedReduction * 100)}%。`
      : ""
  };
}

export function applyEnemyDamageProtection({
  enemy,
  enemies = [],
  damage,
  reductionRatio = DEFAULT_ENEMY_PROTECTION_REDUCTION
} = {}) {
  const normalizedDamage = Math.max(0, Math.round(Number(damage) || 0));
  const protection = getEnemyProtectionState({ enemy, enemies, reductionRatio });
  if (!protection.protected || normalizedDamage <= 0) {
    return {
      damage: normalizedDamage,
      preventedDamage: 0,
      protected: false,
      reductionRatio: protection.reductionRatio
    };
  }

  const reducedDamage = Math.max(1, Math.round(normalizedDamage * (1 - protection.reductionRatio)));
  return {
    damage: reducedDamage,
    preventedDamage: normalizedDamage - reducedDamage,
    protected: true,
    reductionRatio: protection.reductionRatio
  };
}

function isProtectedRearEnemy(enemy) {
  return enemy?.family === "fishman" && PROTECTED_REAR_ROLES.has(enemy.combatRole);
}

function isLivingFishmanFrontline(enemy) {
  return enemy?.hp > 0
    && enemy.family === "fishman"
    && enemy.combatRole === "frontline";
}

function normalizeReductionRatio(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.max(0, Math.min(1, parsed))
    : DEFAULT_ENEMY_PROTECTION_REDUCTION;
}
