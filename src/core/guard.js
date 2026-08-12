export const DEFAULT_GUARD_DAMAGE_REDUCTION = 0.35;

export function beginGuard(hero, damageReduction = DEFAULT_GUARD_DAMAGE_REDUCTION) {
  if (!hero || typeof hero !== "object") {
    throw new TypeError("beginGuard 需要有效的 hero 物件。");
  }

  hero.guardState = {
    active: true,
    damageReduction: normalizeReduction(damageReduction),
    preventedDamage: 0
  };
  return hero.guardState;
}

export function clearGuard(hero) {
  if (hero && typeof hero === "object") {
    hero.guardState = null;
  }
  return hero;
}

export function getGuardState(hero) {
  const state = hero?.guardState;
  if (!state?.active) {
    return null;
  }

  return {
    active: true,
    damageReduction: normalizeReduction(state.damageReduction),
    preventedDamage: Math.max(0, Math.round(Number(state.preventedDamage) || 0))
  };
}

export function applyGuardToDirectDamage({ hero, damage, log } = {}) {
  const normalizedDamage = Math.max(0, Math.round(Number(damage) || 0));
  const guard = getGuardState(hero);
  if (!guard || normalizedDamage <= 0) {
    return {
      damage: normalizedDamage,
      preventedDamage: 0,
      guarded: false,
      damageReduction: 0
    };
  }

  const reducedDamage = Math.max(
    1,
    Math.round(normalizedDamage * (1 - guard.damageReduction))
  );
  const preventedDamage = Math.max(0, normalizedDamage - reducedDamage);
  hero.guardState.preventedDamage = guard.preventedDamage + preventedDamage;

  if (preventedDamage > 0) {
    log?.fixed?.("status", `守勢減輕了 ${preventedDamage} 點直接傷害。`);
  }

  return {
    damage: reducedDamage,
    preventedDamage,
    guarded: true,
    damageReduction: guard.damageReduction
  };
}

function normalizeReduction(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.max(0, Math.min(0.9, parsed))
    : DEFAULT_GUARD_DAMAGE_REDUCTION;
}
