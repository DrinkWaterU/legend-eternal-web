import { clone } from "../utils.js";

export function applyBlessingEffects(hero, blessing) {
  registerBlessingFlows(hero, blessing);
  blessing.effects.forEach((effect) => applyEffect(hero, effect));
  applyEncounterBias(hero, blessing.encounterBias);
}

function applyEffect(hero, effect) {
  if (effect.type === "addFamilyDamageBonus") {
    hero.familyDamageBonus = hero.familyDamageBonus || {};
    getEffectFamilies(effect).forEach((family) => {
      hero.familyDamageBonus[family] = (hero.familyDamageBonus[family] || 0) + effect.amount;
    });
    return;
  }

  if (effect.type === "add") {
    hero[effect.stat] += effect.amount;
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
  }
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

function inferBlessingFlows(blessing) {
  const flows = new Set();
  (blessing.effects || []).forEach((effect) => {
    if (effect.type === "recoverHp") {
      flows.add("healing");
    }
    if (effect.type === "addFamilyDamageBonus") {
      flows.add("attack");
    }
    if (effect.stat === "shieldStart" || effect.stat === "defense" || effect.stat === "damageReduction") {
      flows.add("defense");
    }
    if (effect.stat === "critChance" || effect.stat === "critDamageMultiplier" || effect.stat === "poisonedCritChance") {
      flows.add("crit");
    }
    if (effect.stat === "poisonPower") {
      flows.add("debuff");
    }
    if (effect.stat === "recoverHp" || effect.stat === "regenEvery" || effect.stat === "regenAmount" || effect.stat === "killHeal") {
      flows.add("healing");
    }
    if (effect.stat === "attack") {
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
