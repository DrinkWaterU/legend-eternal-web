import { clone } from "../utils.js";

export function applyBlessingEffects(hero, blessing) {
  blessing.effects.forEach((effect) => applyEffect(hero, effect));
  applyEncounterBias(hero, blessing.encounterBias);
}

function applyEffect(hero, effect) {
  if (effect.type === "addFamilyDamageBonus") {
    hero.familyDamageBonus = hero.familyDamageBonus || {};
    hero.familyDamageBonus[effect.family] = (hero.familyDamageBonus[effect.family] || 0) + effect.amount;
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
  ["normal", "elite"].forEach((encounterType) => {
    if (!runtimeBias[encounterType]) {
      return;
    }

    runtimeBias[encounterType].remaining = runtimeBias[encounterType].duration || 0;
    runtimeBias[encounterType].misses = 0;
  });
  hero.encounterBiases.push(runtimeBias);
}
