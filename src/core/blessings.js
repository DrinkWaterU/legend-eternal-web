export function applyBlessingEffects(hero, blessing) {
  blessing.effects.forEach((effect) => applyEffect(hero, effect));
}

function applyEffect(hero, effect) {
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
