import { toSafeInteger } from "../utils.js";

export function createEmptyRewards() {
  return {
    gold: 0,
    materials: {}
  };
}

export function rollEnemyRewards(enemy, options = {}, randomFn = Math.random) {
  if (typeof options === "function") {
    randomFn = options;
    options = {};
  }

  const rewards = createEmptyRewards();
  if (!enemy?.rewards) {
    return rewards;
  }

  const rewardScale = resolveRewardScale(enemy, options);
  rewards.gold = Math.max(0, Math.round(rollAmount(enemy.rewards.gold, randomFn) * rewardScale));

  const materials = Array.isArray(enemy.rewards.materials) ? enemy.rewards.materials : [];
  materials.forEach((material) => {
    if (!material?.id) {
      return;
    }
    const chance = clampChance((material.chance ?? 1) * rewardScale);
    if (chance <= 0 || randomFn() >= chance) {
      return;
    }
    const quantity = rollAmount(material, randomFn);
    if (quantity <= 0) {
      return;
    }
    mergeMaterial(rewards.materials, material.id, {
      name: material.name || material.id,
      quantity
    });
  });

  return rewards;
}

export function mergeRewards(baseRewards = createEmptyRewards(), addedRewards = createEmptyRewards()) {
  const merged = normalizeRewards(baseRewards);
  const added = normalizeRewards(addedRewards);
  merged.gold = addSafeIntegers(merged.gold, added.gold);
  Object.entries(added.materials).forEach(([materialId, material]) => {
    mergeMaterial(merged.materials, materialId, material);
  });
  return merged;
}

export function applyRewardsToInventory(inventory, rewards) {
  const normalizedInventory = normalizeInventory(inventory);
  const normalizedRewards = normalizeRewards(rewards);
  normalizedInventory.gold = addSafeIntegers(normalizedInventory.gold, normalizedRewards.gold);
  Object.entries(normalizedRewards.materials).forEach(([materialId, material]) => {
    mergeMaterial(normalizedInventory.materials, materialId, material);
  });
  return normalizedInventory;
}

export function normalizeInventory(inventory = {}) {
  inventory.gold = toSafeInteger(inventory.gold);
  inventory.materials = normalizeMaterials(inventory.materials);
  return inventory;
}

export function normalizeRewards(rewards = {}) {
  return {
    gold: toSafeInteger(rewards.gold),
    materials: normalizeMaterials(rewards.materials)
  };
}

export function formatRewards(rewards, materialDefinitions = {}) {
  const normalizedRewards = normalizeRewards(rewards);
  const materials = Object.values(normalizedRewards.materials)
    .filter((material) => material.quantity > 0)
    .map((material) => hydrateMaterial(material, materialDefinitions))
    .sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"))
    .map((material) => `${material.name} x${material.quantity}`);
  return {
    gold: normalizedRewards.gold,
    materials: materials.length > 0 ? materials.join("、") : "沒有取得素材"
  };
}

export function formatInventorySummary(inventory, materialDefinitions = {}) {
  const normalizedInventory = normalizeInventory(inventory || {});
  const materials = Object.values(normalizedInventory.materials)
    .filter((material) => material.quantity > 0)
    .map((material) => hydrateMaterial(material, materialDefinitions))
    .sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
  const materialCount = materials.reduce((total, material) => total + material.quantity, 0);
  return {
    gold: normalizedInventory.gold,
    materialTypes: materials.length,
    materialCount,
    materials: materials.length > 0 ? materials.map((material) => `${material.name} x${material.quantity}`).join("、") : "尚未取得素材"
  };
}

function resolveRewardScale(enemy, options) {
  const explicitScale = Number(options?.rewardScale ?? options?.scale ?? enemy?.rewardScale);
  return Number.isFinite(explicitScale) && explicitScale >= 0 ? explicitScale : 1;
}

function rollAmount(value, randomFn) {
  if (Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  if (!value || typeof value !== "object") {
    return 0;
  }
  const min = Math.max(0, Math.floor(value.min || 0));
  const max = Math.max(min, Math.floor(value.max ?? min));
  return min + Math.floor(randomFn() * (max - min + 1));
}

function clampChance(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function normalizeMaterials(materials = {}) {
  if (!materials || typeof materials !== "object" || Array.isArray(materials)) {
    return {};
  }
  return Object.fromEntries(Object.entries(materials)
    .map(([materialId, material]) => [
      materialId,
      {
        id: materialId,
        name: material?.name || materialId,
        quantity: toSafeInteger(material?.quantity)
      }
    ])
    .filter(([, material]) => material.quantity > 0));
}

function mergeMaterial(materials, materialId, material) {
  const current = materials[materialId] || {
    id: materialId,
    name: material.name || materialId,
    quantity: 0
  };
  materials[materialId] = {
    id: materialId,
    name: material.name || current.name || materialId,
    quantity: addSafeIntegers(current.quantity, material.quantity)
  };
}

function addSafeIntegers(...values) {
  let total = 0;
  for (const value of values) {
    const normalized = toSafeInteger(value);
    if (normalized > Number.MAX_SAFE_INTEGER - total) {
      return Number.MAX_SAFE_INTEGER;
    }
    total += normalized;
  }
  return total;
}

function hydrateMaterial(material, materialDefinitions) {
  const definition = materialDefinitions?.[material.id] || materialDefinitions?.[material.materialId] || null;
  return {
    ...material,
    name: definition?.name || material.name || material.id || material.materialId || "未知素材"
  };
}
