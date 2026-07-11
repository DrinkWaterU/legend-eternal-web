import { clone } from "../utils.js";

const FAMILY_DISPLAY_NAMES = Object.freeze({
  beast: "野獸",
  slime: "史萊姆"
});

const SUPPORTED_EFFECT_TYPES = new Set([
  "postEncounterLowHpHeal",
  "poisonDamageReduction",
  "firstFamilyDirectDamageReduction",
  "openingActionAttackBonus",
  "victoryMilestoneHeal",
  "entangleRetry"
]);

export function getRegionPreparation(region, preparationId) {
  if (!preparationId) {
    return null;
  }
  const preparations = Array.isArray(region?.preparations) ? region.preparations : [];
  return preparations.find((preparation) => preparation?.id === preparationId) || null;
}

export function assertRegionPreparations(region) {
  const preparations = Array.isArray(region?.preparations) ? region.preparations : [];
  const ids = new Set();
  preparations.forEach((preparation) => {
    if (!preparation?.id || ids.has(preparation.id)) {
      throw new Error(`地區 ${region?.id || "(unknown)"} 存在空白或重複 preparation id。`);
    }
    ids.add(preparation.id);
    if (typeof preparation.name !== "string" || !preparation.name.trim()) {
      throw new Error(`整備 ${preparation.id} 的 name 無效。`);
    }
    if (typeof preparation.summary !== "string" || !preparation.summary.trim()) {
      throw new Error(`整備 ${preparation.id} 的 summary 無效。`);
    }
    if (typeof preparation.description !== "string" || !preparation.description.trim()) {
      throw new Error(`整備 ${preparation.id} 的 description 無效。`);
    }
    if (!Number.isSafeInteger(preparation.cost) || preparation.cost < 0) {
      throw new Error(`整備 ${preparation.id} 的 cost 無效。`);
    }
    const effect = preparation.effect;
    if (!effect || !SUPPORTED_EFFECT_TYPES.has(effect.type)) {
      throw new Error(`整備 ${preparation.id} 使用未知 effect.type：${effect?.type || "(empty)"}`);
    }
    validateEffect(effect, preparation.id);
    if (preparation.enhancement !== undefined) {
      validateEnhancement(preparation.enhancement, preparation.id);
    }
  });
  return true;
}

export function createRunPreparation(region, preparationId, options = {}) {
  if (!preparationId) {
    return null;
  }
  assertRegionPreparations(region);
  const definition = getRegionPreparation(region, preparationId);
  if (!definition) {
    throw new Error(`整備 ${preparationId} 不屬於地區 ${region?.id || "(unknown)"}。`);
  }

  const enhanced = options?.enhanced === true;
  if (enhanced && !definition.enhancement) {
    throw new Error(`整備 ${preparationId} 沒有素材強化。`);
  }
  const baseName = definition.name;
  const effectDefinition = enhanced ? definition.enhancement.effect : definition.effect;
  const description = enhanced ? definition.enhancement.description : definition.description;

  const preparation = {
    id: definition.id,
    baseName,
    name: enhanced ? `${baseName}・強化` : baseName,
    description: description || "",
    regionId: region.id,
    cost: definition.cost,
    effect: clone(effectDefinition),
    triggerCount: 0,
    isEnhanced: enhanced
  };

  initializeEffectRuntime(preparation);
  return preparation;
}

export function beginPreparationBattle(preparation) {
  if (!preparation) {
    return preparation;
  }

  switch (preparation.effect?.type) {
    case "firstFamilyDirectDamageReduction":
    case "openingActionAttackBonus":
      preparation.usedThisBattle = false;
      break;
    default:
      break;
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
  return {
    triggered: true,
    damage: reducedDamage,
    preventedDamage
  };
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
    return {
      triggered: false,
      attackBonus: 0,
      result: action()
    };
  }

  const originalBattleAttackBonus = Number(hero?.battleAttackBonus) || 0;
  preparation.usedThisBattle = true;
  preparation.triggerCount += 1;
  hero.battleAttackBonus = originalBattleAttackBonus + effect.attackBonus;

  try {
    if (typeof onTrigger === "function") {
      onTrigger({ attackBonus: effect.attackBonus });
    }
    return {
      triggered: true,
      attackBonus: effect.attackBonus,
      result: action()
    };
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

  const reductionRatio = preparation.effect.reductionRatio;
  const reducedDamage = Math.max(1, Math.floor(normalizedDamage * (1 - reductionRatio)));
  const preventedDamage = normalizedDamage - reducedDamage;
  if (preventedDamage < 1) {
    return { triggered: false, damage: normalizedDamage, preventedDamage: 0 };
  }

  preparation.remainingCharges -= 1;
  preparation.triggerCount += 1;
  preparation.damagePrevented += preventedDamage;
  return {
    triggered: true,
    damage: reducedDamage,
    preventedDamage
  };
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

function initializeEffectRuntime(preparation) {
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

function validateEnhancement(enhancement, preparationId) {
  if (!enhancement || typeof enhancement !== "object" || Array.isArray(enhancement)) {
    throw new Error(`整備 ${preparationId} 的 enhancement 無效。`);
  }
  if (typeof enhancement.title !== "string" || !enhancement.title.trim()) {
    throw new Error(`整備 ${preparationId} 的 enhancement.title 無效。`);
  }
  if (typeof enhancement.description !== "string" || !enhancement.description.trim()) {
    throw new Error(`整備 ${preparationId} 的 enhancement.description 無效。`);
  }
  validateMaterialCosts(enhancement.materialCosts, preparationId);
  validateChangedFragments(enhancement.changedFragments, enhancement.description, preparationId);
  const effect = enhancement.effect;
  if (!effect || !SUPPORTED_EFFECT_TYPES.has(effect.type)) {
    throw new Error(`整備 ${preparationId} 使用未知 enhancement.effect.type：${effect?.type || "(empty)"}`);
  }
  validateEffect(effect, `${preparationId} 強化`);
}

function validateMaterialCosts(materialCosts, preparationId) {
  if (!Array.isArray(materialCosts) || materialCosts.length === 0) {
    throw new Error(`整備 ${preparationId} 的 enhancement.materialCosts 無效。`);
  }
  const materialIds = new Set();
  materialCosts.forEach((cost) => {
    if (typeof cost?.materialId !== "string" || !cost.materialId.trim()) {
      throw new Error(`整備 ${preparationId} 的強化素材 ID 無效。`);
    }
    if (materialIds.has(cost.materialId)) {
      throw new Error(`整備 ${preparationId} 的強化素材重複：${cost.materialId}`);
    }
    materialIds.add(cost.materialId);
    if (!Number.isSafeInteger(cost.quantity) || cost.quantity <= 0) {
      throw new Error(`整備 ${preparationId} 的強化素材數量無效。`);
    }
  });
}

function validateChangedFragments(changedFragments, description, preparationId) {
  if (!isNonEmptyStringArray(changedFragments)) {
    throw new Error(`整備 ${preparationId} 的 enhancement.changedFragments 無效。`);
  }
  let previousEnd = -1;
  changedFragments.forEach((fragment) => {
    const firstIndex = description.indexOf(fragment);
    const lastIndex = description.lastIndexOf(fragment);
    if (firstIndex < 0 || firstIndex !== lastIndex) {
      throw new Error(`整備 ${preparationId} 的差異片段必須在強化文案中精確出現一次：${fragment}`);
    }
    if (firstIndex < previousEnd) {
      throw new Error(`整備 ${preparationId} 的差異片段順序或範圍無效：${fragment}`);
    }
    previousEnd = firstIndex + fragment.length;
  });
}

function validateEffect(effect, preparationId) {
  switch (effect.type) {
    case "postEncounterLowHpHeal":
      if (!isRatio(effect.hpThresholdRatio) || !isPositiveRatio(effect.healMaxHpRatio)) {
        throw new Error(`整備 ${preparationId} 的低生命治療參數無效。`);
      }
      validateCharges(effect.charges, preparationId);
      break;
    case "poisonDamageReduction":
      if (!isPositiveRatio(effect.reductionRatio)) {
        throw new Error(`整備 ${preparationId} 的毒傷減免參數無效。`);
      }
      validateCharges(effect.charges, preparationId);
      break;
    case "firstFamilyDirectDamageReduction":
      if (typeof effect.targetFamily !== "string" || !effect.targetFamily.trim() || !isPositiveRatio(effect.reductionRatio)) {
        throw new Error(`整備 ${preparationId} 的指定敵系減傷參數無效。`);
      }
      break;
    case "openingActionAttackBonus":
      if (!isNonEmptyStringArray(effect.encounterTypes) || !Number.isFinite(effect.attackBonus) || effect.attackBonus <= 0) {
        throw new Error(`整備 ${preparationId} 的開局攻擊參數無效。`);
      }
      break;
    case "victoryMilestoneHeal":
      if (!isStrictlyIncreasingPositiveIntegerArray(effect.victoryMilestones) || !isPositiveRatio(effect.healMaxHpRatio)) {
        throw new Error(`整備 ${preparationId} 的旅程包紮參數無效。`);
      }
      break;
    case "entangleRetry":
      validateCharges(effect.charges, preparationId);
      break;
    default:
      break;
  }
}

function validateCharges(charges, preparationId) {
  if (!Number.isSafeInteger(charges) || charges <= 0) {
    throw new Error(`整備 ${preparationId} 的 charges 無效。`);
  }
}

function normalizeDamage(damage) {
  return Math.max(0, Math.round(Number(damage) || 0));
}

function isRatio(value) {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function isPositiveRatio(value) {
  return Number.isFinite(value) && value > 0 && value < 1;
}

function isNonEmptyStringArray(value) {
  return Array.isArray(value)
    && value.length > 0
    && value.every((entry) => typeof entry === "string" && entry.trim())
    && new Set(value).size === value.length;
}

function getFamilyDisplayName(family) {
  return FAMILY_DISPLAY_NAMES[family] || "對應敵人";
}

function isStrictlyIncreasingPositiveIntegerArray(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }
  return value.every((entry, index) => {
    return Number.isSafeInteger(entry)
      && entry > 0
      && (index === 0 || value[index - 1] < entry);
  });
}
