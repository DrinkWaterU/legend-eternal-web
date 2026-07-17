import weaponsData from "./weapons.json" with { type: "json" };

const SUPPORTED_WEAPON_EFFECT_STATS = new Set([
  "attack",
  "critChance",
  "shieldStart",
  "openingCritChance",
  "woundedTargetCritChance",
  "poisonedTargetDefenseIgnore",
  "lowHpAttackBonus",
  "critDamageMultiplier"
]);

export const weaponCategoryDefinitions = Object.freeze({
  sword: Object.freeze({
    id: "sword",
    label: "劍"
  }),
  bow: Object.freeze({
    id: "bow",
    label: "弓"
  }),
  mace: Object.freeze({
    id: "mace",
    label: "鎚"
  }),
  dagger: Object.freeze({
    id: "dagger",
    label: "匕首"
  })
});

export const DEFAULT_WEAPON_RARITY = "common";

export const weaponRarityDefinitions = Object.freeze({
  common: Object.freeze({
    id: "common",
    label: "普通",
    rank: 1
  }),
  uncommon: Object.freeze({
    id: "uncommon",
    label: "精良",
    rank: 2
  })
});

export const weaponDefinitions = Object.freeze(Object.fromEntries(
  Object.entries(weaponsData).map(([weaponId, weapon]) => [
    weaponId,
    Object.freeze({ ...weapon })
  ])
));

export function getWeaponDefinition(weaponId) {
  return weaponDefinitions[weaponId] || null;
}

export function getWeaponCategoryDefinition(categoryId) {
  return weaponCategoryDefinitions[categoryId] || null;
}

export function getWeaponRarityDefinition(rarityId) {
  return weaponRarityDefinitions[rarityId] || weaponRarityDefinitions[DEFAULT_WEAPON_RARITY];
}

export function assertWeaponDefinitions(definitions = weaponDefinitions, options = {}) {
  const { materialDefinitions = null } = options;

  Object.entries(definitions).forEach(([weaponId, weapon]) => {
    if (!weapon || weapon.id !== weaponId) {
      throw new Error(`Weapon definition id 不一致：${weaponId}`);
    }
    if (!String(weapon.name || "").trim()) {
      throw new Error(`Weapon ${weaponId} 缺少 name。`);
    }
    if (!weaponCategoryDefinitions[weapon.categoryId]) {
      throw new Error(`Weapon ${weaponId} 使用未知 categoryId：${weapon.categoryId}`);
    }
    if (!weaponRarityDefinitions[weapon.rarityId]) {
      throw new Error(`Weapon ${weaponId} 使用未知 rarityId：${weapon.rarityId}`);
    }
    if (!Array.isArray(weapon.statEffects)) {
      throw new Error(`Weapon ${weaponId} 的 statEffects 必須是陣列。`);
    }
    [...weapon.statEffects, weapon.specialEffect]
      .filter(Boolean)
      .forEach((effect) => assertWeaponEffect(weaponId, effect));

    const recipe = weapon.recipe;
    if (!recipe || !Number.isSafeInteger(recipe.goldCost) || recipe.goldCost < 0) {
      throw new Error(`Weapon ${weaponId} 的 recipe.goldCost 無效。`);
    }
    if (!Array.isArray(recipe.materialCosts)) {
      throw new Error(`Weapon ${weaponId} 的 recipe.materialCosts 必須是陣列。`);
    }

    const materialIds = new Set();
    recipe.materialCosts.forEach((cost) => {
      if (!cost || typeof cost.materialId !== "string" || !cost.materialId) {
        throw new Error(`Weapon ${weaponId} 的素材 ID 無效。`);
      }
      if (materialIds.has(cost.materialId)) {
        throw new Error(`Weapon ${weaponId} 的配方包含重複素材：${cost.materialId}`);
      }
      materialIds.add(cost.materialId);
      if (!Number.isSafeInteger(cost.quantity) || cost.quantity <= 0) {
        throw new Error(`Weapon ${weaponId} 的素材數量無效：${cost.materialId}`);
      }
      if (materialDefinitions && !materialDefinitions[cost.materialId]) {
        throw new Error(`Weapon ${weaponId} 使用未知素材：${cost.materialId}`);
      }
    });
  });

  return true;
}

function assertWeaponEffect(weaponId, effect) {
  if (effect.type !== "add") {
    throw new Error(`Weapon ${weaponId} 使用不支援的 effect type：${effect.type}`);
  }
  if (typeof effect.stat !== "string" || !SUPPORTED_WEAPON_EFFECT_STATS.has(effect.stat)) {
    throw new Error(`Weapon ${weaponId} 使用不支援的 effect stat：${effect.stat}`);
  }
  if (!Number.isFinite(effect.amount)) {
    throw new Error(`Weapon ${weaponId} 的 effect amount 無效：${effect.stat}`);
  }
}
