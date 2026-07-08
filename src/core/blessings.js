import { isBlessingFlowId } from "../data/blessingFlows.js";
import { clone } from "../utils.js";

const FLOW_MOMENTUM_DECAY = 0.7;
const FLOW_MOMENTUM_GAIN = 1;

export function applyBlessingEffects(hero, blessing) {
  registerBlessingFlows(hero, blessing);
  updateBlessingFlowMomentum(hero, blessing);
  blessing.effects.forEach((effect) => applyEffect(hero, effect, blessing));
  applyEncounterBias(hero, blessing.encounterBias);
}

function applyEffect(hero, effect, blessing) {
  if (effect.type === "addFamilyDamageBonus") {
    hero.familyDamageBonus = hero.familyDamageBonus || {};
    getEffectFamilies(effect).forEach((family) => {
      hero.familyDamageBonus[family] = (hero.familyDamageBonus[family] || 0) + effect.amount;
    });
    return;
  }

  if (effect.type === "add") {
    const currentValue = Number.isFinite(hero[effect.stat]) ? hero[effect.stat] : 0;
    const amount = Number(effect.amount);
    if (!Number.isFinite(amount)) {
      return;
    }
    hero[effect.stat] = currentValue + amount;
    return;
  }

  if (effect.type === "set") {
    hero[effect.stat] = effect.value;
    return;
  }

  if (effect.type === "max") {
    hero[effect.stat] = Math.max(hero[effect.stat], effect.value);
    return;
  }

  if (effect.type === "recoverHp") {
    hero.hp = Math.min(hero.maxHp, hero.hp + effect.amount);
    return;
  }

  if (effect.type === "addTimedRegen") {
    addTimedRegen(hero, effect, blessing);
  }
}

function addTimedRegen(hero, effect, blessing) {
  const id = effect.id || blessing.id || "timed-regen";
  const runtimeEffect = {
    id,
    source: effect.source || blessing.name || "祝福",
    remainingEncounters: Math.max(0, Math.floor(effect.durationEncounters || 0)),
    everyTurns: Math.max(1, Math.floor(effect.everyTurns || 1)),
    maxHpRatio: Math.max(0, Number(effect.maxHpRatio) || 0)
  };

  if (runtimeEffect.remainingEncounters <= 0 || runtimeEffect.maxHpRatio <= 0) {
    return;
  }

  hero.timedRegens = Array.isArray(hero.timedRegens) ? hero.timedRegens : [];
  const existing = hero.timedRegens.find((item) => item.id === id);
  if (!existing) {
    hero.timedRegens.push(runtimeEffect);
    return;
  }

  existing.source = runtimeEffect.source;
  existing.remainingEncounters = Math.max(existing.remainingEncounters, runtimeEffect.remainingEncounters);
  existing.everyTurns = Math.min(existing.everyTurns, runtimeEffect.everyTurns);
  existing.maxHpRatio = Math.max(existing.maxHpRatio, runtimeEffect.maxHpRatio);
}

function applyEncounterBias(hero, encounterBias) {
  if (!encounterBias) {
    return;
  }

  hero.encounterBiases = Array.isArray(hero.encounterBiases) ? hero.encounterBiases : [];
  const runtimeBias = clone(encounterBias);
  runtimeBias.families = getEncounterBiasFamilies(runtimeBias);
  ["normal", "elite"].forEach((encounterType) => {
    if (!runtimeBias[encounterType]) {
      return;
    }

    runtimeBias[encounterType].remaining = runtimeBias[encounterType].duration || 0;
    runtimeBias[encounterType].misses = 0;
  });
  hero.encounterBiases.push(runtimeBias);
}

function registerBlessingFlows(hero, blessing) {
  hero.blessingFlows = Array.isArray(hero.blessingFlows) ? hero.blessingFlows : [];
  inferBlessingFlows(blessing).forEach((flow) => {
    if (!hero.blessingFlows.includes(flow)) {
      hero.blessingFlows.push(flow);
    }
  });
}

function updateBlessingFlowMomentum(hero, blessing) {
  const primaryFlow = resolveBlessingPrimaryFlow(blessing);
  if (!primaryFlow) {
    return;
  }

  const currentMomentum = hero.blessingFlowMomentum && typeof hero.blessingFlowMomentum === "object"
    ? hero.blessingFlowMomentum
    : {};
  const nextMomentum = {};

  Object.entries(currentMomentum).forEach(([flow, value]) => {
    const decayedValue = Math.max(0, Number(value) || 0) * FLOW_MOMENTUM_DECAY;
    if (decayedValue > 0) {
      nextMomentum[flow] = decayedValue;
    }
  });

  nextMomentum[primaryFlow] = (Number(nextMomentum[primaryFlow]) || 0) + FLOW_MOMENTUM_GAIN;
  hero.blessingFlowMomentum = nextMomentum;
}

function resolveBlessingPrimaryFlow(blessing) {
  if (isBlessingFlowId(blessing?.primaryFlow)) {
    return blessing.primaryFlow;
  }
  return inferBlessingFlows(blessing).find(isBlessingFlowId) || null;
}

export function inferBlessingFlows(blessing) {
  const flows = new Set();
  (blessing.effects || []).forEach((effect) => {
    if (effect.type === "recoverHp") {
      flows.add("healing");
    }
    if (effect.type === "addTimedRegen") {
      flows.add("healing");
    }
    if (effect.type === "addFamilyDamageBonus") {
      flows.add("attack");
    }
    if (effect.stat === "shieldStart" || effect.stat === "defense" || effect.stat === "damageReduction") {
      flows.add("defense");
    }
    if (["critChance", "critDamageMultiplier", "poisonedCritChance", "openingCritChance", "woundedTargetCritChance"].includes(effect.stat)) {
      flows.add("crit");
    }
    if (effect.stat === "poisonPower" || effect.stat === "poisonedTargetDefenseIgnore") {
      flows.add("debuff");
    }
    if (["recoverHp", "regenEvery", "regenAmount", "killHeal", "lowHpKillHeal", "killHealRatio"].includes(effect.stat)) {
      flows.add("healing");
    }
    if (effect.stat === "attack" || effect.stat === "killAttackGain") {
      flows.add("attack");
    }
  });
  return [...flows];
}

function getEffectFamilies(effect) {
  if (Array.isArray(effect.families)) {
    return effect.families.filter(Boolean);
  }
  return effect.family ? [effect.family] : [];
}

function getEncounterBiasFamilies(encounterBias) {
  if (Array.isArray(encounterBias.families)) {
    return encounterBias.families.filter(Boolean);
  }
  return encounterBias.family ? [encounterBias.family] : [];
}
