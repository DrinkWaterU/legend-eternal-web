const FAMILY_DISPLAY_NAMES = Object.freeze({
  beast: "野獸",
  slime: "史萊姆"
});

export function getPreparationCombatStatus({ preparation, encounterType = null, enemies = [] }) {
  if (!preparation) {
    return null;
  }

  const effectType = preparation.effect?.type;
  if (effectType === "firstFamilyDirectDamageReduction") {
    const hasTargetFamily = (Array.isArray(enemies) ? enemies : [])
      .some((enemy) => enemy?.hp > 0 && enemy.family === preparation.effect.targetFamily);
    const targetFamilyLabel = getFamilyDisplayName(preparation.effect.targetFamily);
    return {
      name: preparation.name,
      label: preparation.usedThisBattle
        ? "本場已使用"
        : hasTargetFamily
          ? "本場可用"
          : `等待${targetFamilyLabel}`,
      isDepleted: false
    };
  }

  if (effectType === "openingActionAttackBonus") {
    const isStrongEncounter = preparation.effect.encounterTypes.includes(encounterType);
    return {
      name: preparation.name,
      label: preparation.usedThisBattle
        ? "本場已使用"
        : isStrongEncounter
          ? "本場可用"
          : "等待強敵",
      isDepleted: false
    };
  }

  const remainingCharges = Number.isSafeInteger(preparation.remainingCharges)
    ? Math.max(0, preparation.remainingCharges)
    : 0;
  return {
    name: preparation.name,
    label: remainingCharges > 0 ? `剩餘 ${remainingCharges} 次` : "已耗盡",
    isDepleted: remainingCharges <= 0
  };
}

export function getPreparationSummary(preparation) {
  if (!preparation) {
    return null;
  }
  const summary = {
    id: preparation.id,
    name: preparation.isEnhanced
      ? `${preparation.baseName || preparation.name}（已強化）`
      : (preparation.baseName || preparation.name),
    triggerCount: preparation.triggerCount || 0
  };
  if (Number.isFinite(preparation.healing)) {
    summary.healing = preparation.healing;
  }
  if (Number.isFinite(preparation.damagePrevented)) {
    summary.damagePrevented = preparation.damagePrevented;
  }
  if (Number.isFinite(preparation.retrySuccessCount)) {
    summary.retrySuccessCount = preparation.retrySuccessCount;
  }
  return summary;
}

function getFamilyDisplayName(family) {
  return FAMILY_DISPLAY_NAMES[family] || "對應敵人";
}
