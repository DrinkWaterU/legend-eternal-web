export function initializePreparationRuntime(preparation) {
  switch (preparation.effect.type) {
    case "postEncounterLowHpHeal":
      preparation.remainingCharges = preparation.effect.charges;
      preparation.healing = 0;
      break;
    case "poisonDamageReduction":
      preparation.remainingCharges = preparation.effect.charges;
      preparation.damagePrevented = 0;
      break;
    case "firstFamilyDirectDamageReduction":
      preparation.usedThisBattle = false;
      preparation.damagePrevented = 0;
      break;
    case "openingActionAttackBonus":
      preparation.usedThisBattle = false;
      break;
    case "victoryMilestoneHeal":
      preparation.formalVictoryCount = 0;
      preparation.milestoneIndex = 0;
      preparation.remainingCharges = preparation.effect.victoryMilestones.length;
      preparation.healing = 0;
      break;
    case "entangleRetry":
      preparation.remainingCharges = preparation.effect.charges;
      preparation.retrySuccessCount = 0;
      break;
    default:
      break;
  }
}

export function beginPreparationBattle(preparation) {
  if (!preparation) {
    return preparation;
  }
  if (["firstFamilyDirectDamageReduction", "openingActionAttackBonus"].includes(preparation.effect?.type)) {
    preparation.usedThisBattle = false;
  }
  return preparation;
}

export function resolvePreparationIncomingDirectDamage({ preparation, enemy, damage }) {
  const normalizedDamage = normalizeDamage(damage);
  if (
    !preparation
    || preparation.effect?.type !== "firstFamilyDirectDamageReduction"
    || preparation.usedThisBattle
    || enemy?.family !== preparation.effect.targetFamily
    || normalizedDamage <= 0
  ) {
    return { triggered: false, damage: normalizedDamage, preventedDamage: 0 };
  }

  const reducedDamage = Math.max(1, Math.floor(normalizedDamage * (1 - preparation.effect.reductionRatio)));
  const preventedDamage = normalizedDamage - reducedDamage;
  if (preventedDamage < 1) {
    return { triggered: false, damage: normalizedDamage, preventedDamage: 0 };
  }

  preparation.usedThisBattle = true;
  preparation.triggerCount += 1;
  preparation.damagePrevented += preventedDamage;
  return { triggered: true, damage: reducedDamage, preventedDamage };
}

export function runPreparationOpeningAction({ preparation, hero, encounterType, action, onTrigger = null }) {
  if (typeof action !== "function") {
    throw new Error("整備開局行動缺少 action callback。");
  }

  const effect = preparation?.effect;
  const canTrigger = effect?.type === "openingActionAttackBonus"
    && !preparation.usedThisBattle
    && effect.encounterTypes.includes(encounterType);
  if (!canTrigger) {
    return { triggered: false, attackBonus: 0, result: action() };
  }

  const originalBattleAttackBonus = Number(hero?.battleAttackBonus) || 0;
  preparation.usedThisBattle = true;
  preparation.triggerCount += 1;
  hero.battleAttackBonus = originalBattleAttackBonus + effect.attackBonus;

  try {
    if (typeof onTrigger === "function") {
      onTrigger({ attackBonus: effect.attackBonus });
    }
    return { triggered: true, attackBonus: effect.attackBonus, result: action() };
  } finally {
    hero.battleAttackBonus = originalBattleAttackBonus;
  }
}

export function resolvePostEncounterPreparation({ preparation, hero, isFinalEncounter = false }) {
  if (!preparation || !hero || hero.hp <= 0 || hero.maxHp <= 0) {
    return { triggered: false, healing: 0 };
  }

  switch (preparation.effect?.type) {
    case "postEncounterLowHpHeal":
      return resolveLowHpHeal({ preparation, hero, isFinalEncounter });
    case "victoryMilestoneHeal":
      return resolveVictoryMilestoneHeal({ preparation, hero });
    default:
      return { triggered: false, healing: 0 };
  }
}

export function resolvePreparationPoisonDamage({ preparation, damage }) {
  const normalizedDamage = normalizeDamage(damage);
  if (!preparation || preparation.effect?.type !== "poisonDamageReduction" || preparation.remainingCharges <= 0) {
    return { triggered: false, damage: normalizedDamage, preventedDamage: 0 };
  }
  if (normalizedDamage <= 0) {
    return { triggered: false, damage: normalizedDamage, preventedDamage: 0 };
  }

  const reducedDamage = Math.max(1, Math.floor(normalizedDamage * (1 - preparation.effect.reductionRatio)));
  const preventedDamage = normalizedDamage - reducedDamage;
  if (preventedDamage < 1) {
    return { triggered: false, damage: normalizedDamage, preventedDamage: 0 };
  }

  preparation.remainingCharges -= 1;
  preparation.triggerCount += 1;
  preparation.damagePrevented += preventedDamage;
  return { triggered: true, damage: reducedDamage, preventedDamage };
}

export function consumePreparationEntangleRetry(preparation) {
  if (!preparation || preparation.effect?.type !== "entangleRetry" || preparation.remainingCharges <= 0) {
    return false;
  }
  preparation.remainingCharges -= 1;
  preparation.triggerCount += 1;
  return true;
}

export function recordPreparationEntangleRetryResult({ preparation, success }) {
  if (!preparation || preparation.effect?.type !== "entangleRetry" || !success) {
    return false;
  }
  preparation.retrySuccessCount += 1;
  return true;
}

function resolveLowHpHeal({ preparation, hero, isFinalEncounter }) {
  if (isFinalEncounter || preparation.remainingCharges <= 0) {
    return { triggered: false, healing: 0 };
  }
  if (hero.hp / hero.maxHp >= preparation.effect.hpThresholdRatio) {
    return { triggered: false, healing: 0 };
  }

  const healing = healByMaxHpRatio(hero, preparation.effect.healMaxHpRatio);
  if (healing < 1) {
    return { triggered: false, healing: 0 };
  }

  preparation.remainingCharges -= 1;
  preparation.triggerCount += 1;
  preparation.healing += healing;
  return { triggered: true, healing };
}

function resolveVictoryMilestoneHeal({ preparation, hero }) {
  preparation.formalVictoryCount += 1;
  const milestone = preparation.effect.victoryMilestones[preparation.milestoneIndex];
  if (milestone !== preparation.formalVictoryCount) {
    return { triggered: false, healing: 0 };
  }

  preparation.milestoneIndex += 1;
  preparation.remainingCharges = Math.max(0, preparation.remainingCharges - 1);
  const healing = healByMaxHpRatio(hero, preparation.effect.healMaxHpRatio);
  if (healing < 1) {
    return { triggered: false, healing: 0 };
  }

  preparation.triggerCount += 1;
  preparation.healing += healing;
  return { triggered: true, healing };
}

function healByMaxHpRatio(hero, ratio) {
  const requestedHealing = Math.max(1, Math.round(hero.maxHp * ratio));
  const before = hero.hp;
  hero.hp = Math.min(hero.maxHp, hero.hp + requestedHealing);
  return hero.hp - before;
}

function normalizeDamage(damage) {
  return Math.max(0, Math.round(Number(damage) || 0));
}
