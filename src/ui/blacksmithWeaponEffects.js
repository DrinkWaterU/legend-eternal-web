import { createWeaponTechniqueRules, formatWeaponEffect, formatWeaponEffects, getWeaponEffects } from "./weaponViewHelpers.js";

export function createBlacksmithEffectList(weapon) {
  const effectList = document.createElement("div");
  effectList.className = "blacksmith-effect-list";
  if (weapon.effectText) {
    const item = document.createElement("div");
    item.className = "blacksmith-effect-item";
    const label = document.createElement("small");
    const value = document.createElement("strong");
    label.textContent = weapon.effectName || "特殊效果";
    value.textContent = weapon.effectSummary || weapon.effectText;
    item.append(label, value);
    if (weapon.statEffects?.length) {
      const stats = document.createElement("p");
      stats.className = "weapon-base-stats";
      stats.textContent = weapon.statEffects.map(formatWeaponEffect).join("、");
      item.prepend(stats);
    }
    if (weapon.effectSummary) item.append(createWeaponTechniqueRules(weapon));
    effectList.append(item);
  } else {
    getWeaponEffects(weapon).forEach((effect) => {
      const item = document.createElement("div");
      item.className = "blacksmith-effect-item";
      const label = document.createElement("small");
      const value = document.createElement("strong");
      label.textContent = effect.stat === "attack" ? "基礎能力" : "特殊效果";
      value.textContent = formatWeaponEffect(effect);
      item.append(label, value);
      effectList.append(item);
    });
  }
  if (!effectList.children.length) {
    const effectText = document.createElement("p");
    effectText.textContent = formatWeaponEffects(weapon);
    effectList.append(effectText);
  }
  return effectList;
}
