import { DEFAULT_WEAPON_RARITY, getWeaponRarityDefinition } from "../data/weapons.js";

const EFFECT_LABELS = Object.freeze({
  attack: "攻擊",
  critChance: "暴擊率",
  shieldStart: "開場護盾",
  openingCritChance: "首次攻擊暴擊率"
});

const PERCENT_STATS = new Set(["critChance", "openingCritChance"]);

export function getWeaponIconPath(weapon) {
  const assetId = String(weapon?.iconAssetId || weapon?.id || "").trim();
  return assetId ? `./assets/images/icons/weapons/${assetId}.png` : "";
}

export function createWeaponIcon(weapon, options = {}) {
  const wrapper = document.createElement("span");
  wrapper.className = options.className || "weapon-icon";
  wrapper.dataset.category = weapon?.categoryId || "unknown";
  wrapper.dataset.rarity = getWeaponRarityId(weapon);

  const fallback = document.createElement("span");
  fallback.className = "weapon-icon-fallback";
  fallback.textContent = !weapon ? "—" : weapon.categoryId === "bow" ? "弓" : "劍";
  wrapper.append(fallback);

  const path = getWeaponIconPath(weapon);
  if (path) {
    const image = document.createElement("img");
    image.alt = options.alt ?? "";
    image.src = path;
    image.addEventListener("load", () => {
      wrapper.classList.add("has-image");
    }, { once: true });
    image.addEventListener("error", () => {
      image.remove();
      wrapper.classList.remove("has-image");
    }, { once: true });
    wrapper.prepend(image);
  }

  return wrapper;
}

export function getWeaponEffects(weapon) {
  return [
    ...(Array.isArray(weapon?.statEffects) ? weapon.statEffects : []),
    weapon?.specialEffect
  ].filter(Boolean);
}

export function formatWeaponEffect(effect) {
  const label = EFFECT_LABELS[effect?.stat] || effect?.stat || "未知效果";
  const amount = Number(effect?.amount) || 0;
  if (PERCENT_STATS.has(effect?.stat)) {
    return `${label} +${Math.round(amount * 100)}%`;
  }
  return `${label} +${amount}`;
}

export function formatWeaponEffects(weapon) {
  const effects = getWeaponEffects(weapon);
  return effects.length > 0
    ? effects.map(formatWeaponEffect).join("、")
    : "沒有額外效果";
}

export function getWeaponRarityId(weapon) {
  return getWeaponRarityDefinition(weapon?.rarityId || DEFAULT_WEAPON_RARITY).id;
}

export function getWeaponRarityLabel(weapon) {
  return getWeaponRarityDefinition(weapon?.rarityId || DEFAULT_WEAPON_RARITY).label;
}

export function getWeaponRarityClass(weapon) {
  return `rarity-${getWeaponRarityId(weapon)}`;
}

export function formatWeaponCategory(weapon, categoryDefinitions = {}) {
  return categoryDefinitions[weapon?.categoryId]?.label || weapon?.categoryId || "未知類別";
}
