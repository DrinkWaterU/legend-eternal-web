import { toSafeNumber } from "../utils.js";

export function createEmptyRewards() {
  return {
    gold: 0,
    materials: {}
  };
}

export function rollEnemyRewards(enemy, randomFn = Math.random) {
  const rewards = createEmptyRewards();
  if (!enemy?.rewards) {
    return rewards;
  }

  rewards.gold = rollAmount(enemy.rewards.gold, randomFn);

  const materials = Array.isArray(enemy.rewards.materials) ? enemy.rewards.materials : [];
  materials.forEach((material) => {
    if (!material?.id) {
      return;
    }
    const chance = clampChance(material.chance ?? 1);
    if (randomFn() > chance) {
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
  merged.gold += added.gold;
  Object.entries(added.materials).forEach(([materialId, material]) => {
    mergeMaterial(merged.materials, materialId, material);
  });
  return merged;
}

export function applyRewardsToInventory(inventory, rewards) {
  const normalizedInventory = normalizeInventory(inventory);
  const normalizedRewards = normalizeRewards(rewards);
  normalizedInventory.gold += normalizedRewards.gold;
  Object.entries(normalizedRewards.materials).forEach(([materialId, material]) => {
    mergeMaterial(normalizedInventory.materials, materialId, material);
  });
  return normalizedInventory;
}

export function normalizeInventory(inventory = {}) {
  inventory.gold = toSafeNumber(inventory.gold);
  inventory.materials = normalizeMaterials(inventory.materials);
  return inventory;
}

export function normalizeRewards(rewards = {}) {
  return {
    gold: toSafeNumber(rewards.gold),
    materials: normalizeMaterials(rewards.materials)
  };
}

export function formatRewards(rewards) {
  const normalizedRewards = normalizeRewards(rewards);
  const materials = Object.values(normalizedRewards.materials)
    .filter((material) => material.quantity > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"))
    .map((material) => `${material.name} x${material.quantity}`);
  return {
    gold: `${normalizedRewards.gold}`,
    materials: materials.length > 0 ? materials.join("、") : "沒有取得素材"
  };
}

export function formatInventorySummary(inventory) {
  const normalizedInventory = normalizeInventory(inventory || {});
  const materials = Object.values(normalizedInventory.materials)
    .filter((material) => material.quantity > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
  const materialCount = materials.reduce((total, material) => total + material.quantity, 0);
  return {
    gold: normalizedInventory.gold,
    materialTypes: materials.length,
    materialCount,
    materials: materials.length > 0 ? materials.map((material) => `${material.name} x${material.quantity}`).join("、") : "尚未取得素材"
  };
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
        name: material?.name || materialId,
        quantity: toSafeNumber(material?.quantity)
      }
    ])
    .filter(([, material]) => material.quantity > 0));
}

function mergeMaterial(materials, materialId, material) {
  const current = materials[materialId] || {
    name: material.name || materialId,
    quantity: 0
  };
  materials[materialId] = {
    name: material.name || current.name || materialId,
    quantity: toSafeNumber(current.quantity) + toSafeNumber(material.quantity)
  };
}
