const SUPPORTED_EFFECT_TYPES = new Set([
  "postEncounterLowHpHeal",
  "poisonDamageReduction",
  "firstFamilyDirectDamageReduction",
  "openingActionAttackBonus",
  "victoryMilestoneHeal",
  "entangleRetry",
  "saltErosionInitialTurnReduction",
  "paralysisPenaltyPrevention",
  "firstMultiEnemyDirectDamageReduction"
]);

export function assertRegionPreparations(region) {
  const preparations = Array.isArray(region?.preparations) ? region.preparations : [];
  const ids = new Set();
  preparations.forEach((preparation) => {
    if (!preparation?.id || ids.has(preparation.id)) {
      throw new Error(`地區 ${region?.id || "(unknown)"} 存在空白或重複 preparation id。`);
    }
    ids.add(preparation.id);
    validateText(preparation.name, `整備 ${preparation.id} 的 name 無效。`);
    validateText(preparation.summary, `整備 ${preparation.id} 的 summary 無效。`);
    validateText(preparation.description, `整備 ${preparation.id} 的 description 無效。`);
    if (!Number.isSafeInteger(preparation.cost) || preparation.cost < 0) {
      throw new Error(`整備 ${preparation.id} 的 cost 無效。`);
    }
    validateSupportedEffect(preparation.effect, preparation.id);
    if (preparation.enhancement !== undefined) {
      validateEnhancement(preparation.enhancement, preparation.id);
    }
  });
  return true;
}

function validateEnhancement(enhancement, preparationId) {
  if (!enhancement || typeof enhancement !== "object" || Array.isArray(enhancement)) {
    throw new Error(`整備 ${preparationId} 的 enhancement 無效。`);
  }
  validateText(enhancement.title, `整備 ${preparationId} 的 enhancement.title 無效。`);
  validateText(enhancement.description, `整備 ${preparationId} 的 enhancement.description 無效。`);
  validateMaterialCosts(enhancement.materialCosts, preparationId);
  validateChangedFragments(enhancement.changedFragments, enhancement.description, preparationId);
  validateSupportedEffect(enhancement.effect, `${preparationId} 強化`, "enhancement.effect.type");
}

function validateSupportedEffect(effect, preparationId, field = "effect.type") {
  if (!effect || !SUPPORTED_EFFECT_TYPES.has(effect.type)) {
    throw new Error(`整備 ${preparationId} 使用未知 ${field}：${effect?.type || "(empty)"}`);
  }
  validateEffect(effect, preparationId);
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
    case "saltErosionInitialTurnReduction":
      if (!Number.isSafeInteger(effect.turnReduction) || effect.turnReduction <= 0) {
        throw new Error(`整備 ${preparationId} 的鹽蝕回合縮減參數無效。`);
      }
      break;
    case "paralysisPenaltyPrevention":
      validateCharges(effect.charges, preparationId);
      break;
    case "firstMultiEnemyDirectDamageReduction":
      if (!isPositiveRatio(effect.reductionRatio)) {
        throw new Error(`整備 ${preparationId} 的多敵人減傷參數無效。`);
      }
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

function validateText(value, message) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(message);
  }
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
