import { clone } from "../utils.js";

const SUPPORTED_EFFECT_TYPES = new Set([
  "postEncounterLowHpHeal",
  "poisonDamageReduction"
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
    if (!Number.isSafeInteger(preparation.cost) || preparation.cost < 0) {
      throw new Error(`整備 ${preparation.id} 的 cost 無效。`);
    }
    const effect = preparation.effect;
    if (!effect || !SUPPORTED_EFFECT_TYPES.has(effect.type)) {
      throw new Error(`整備 ${preparation.id} 使用未知 effect.type：${effect?.type || "(empty)"}`);
    }
    if (!Number.isSafeInteger(effect.charges) || effect.charges <= 0) {
      throw new Error(`整備 ${preparation.id} 的 charges 無效。`);
    }
    validateEffect(effect, preparation.id);
  });
  return true;
}

export function createRunPreparation(region, preparationId) {
  if (!preparationId) {
    return null;
  }
  assertRegionPreparations(region);
  const definition = getRegionPreparation(region, preparationId);
  if (!definition) {
    throw new Error(`整備 ${preparationId} 不屬於地區 ${region?.id || "(unknown)"}。`);
  }
  return {
    id: definition.id,
    name: definition.name,
    description: definition.description || "",
    regionId: region.id,
    cost: definition.cost,
    effect: clone(definition.effect),
    remainingCharges: definition.effect.charges,
    triggerCount: 0,
    healing: 0,
    damagePrevented: 0
  };
}

export function resolvePostEncounterPreparation({ preparation, hero }) {
  if (!preparation || preparation.effect?.type !== "postEncounterLowHpHeal") {
    return { triggered: false, healing: 0 };
  }
  if (preparation.remainingCharges <= 0 || !hero || hero.hp <= 0 || hero.maxHp <= 0) {
    return { triggered: false, healing: 0 };
  }
  if (hero.hp / hero.maxHp >= preparation.effect.hpThresholdRatio) {
    return { triggered: false, healing: 0 };
  }

  const requestedHealing = Math.max(1, Math.round(hero.maxHp * preparation.effect.healMaxHpRatio));
  const before = hero.hp;
  hero.hp = Math.min(hero.maxHp, hero.hp + requestedHealing);
  const healing = hero.hp - before;
  if (healing < 1) {
    return { triggered: false, healing: 0 };
  }

  preparation.remainingCharges -= 1;
  preparation.triggerCount += 1;
  preparation.healing += healing;
  return { triggered: true, healing };
}

export function resolvePreparationPoisonDamage({ preparation, damage }) {
  const normalizedDamage = Math.max(0, Math.round(Number(damage) || 0));
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

export function getPreparationSummary(preparation) {
  if (!preparation) {
    return null;
  }
  return {
    id: preparation.id,
    name: preparation.name,
    triggerCount: preparation.triggerCount || 0,
    healing: preparation.healing || 0,
    damagePrevented: preparation.damagePrevented || 0
  };
}

function validateEffect(effect, preparationId) {
  if (effect.type === "postEncounterLowHpHeal") {
    if (!isRatio(effect.hpThresholdRatio) || !isPositiveRatio(effect.healMaxHpRatio)) {
      throw new Error(`整備 ${preparationId} 的低生命治療參數無效。`);
    }
    return;
  }
  if (effect.type === "poisonDamageReduction") {
    if (!isPositiveRatio(effect.reductionRatio)) {
      throw new Error(`整備 ${preparationId} 的毒傷減免參數無效。`);
    }
  }
}

function isRatio(value) {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function isPositiveRatio(value) {
  return Number.isFinite(value) && value > 0 && value < 1;
}
