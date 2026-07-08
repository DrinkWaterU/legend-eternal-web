import { clone } from "../utils.js";

const ENEMY_THREAT_RANK = Object.freeze({
  "首領": 3,
  "精英": 2
});

export function createRuntimeEnemyGroup(entries = []) {
  const enemies = normalizeEnemyEntries(entries, { applyStatScale: true });
  assignDisplayNames(enemies, { preserveExisting: false });
  return enemies;
}

export function restoreRuntimeEnemyGroup(enemies = []) {
  const restored = normalizeEnemyEntries(enemies, { applyStatScale: false });
  assignDisplayNames(restored, { preserveExisting: true });
  return restored;
}

export function getLivingEnemies(enemies = []) {
  return Array.isArray(enemies) ? enemies.filter((enemy) => enemy && enemy.hp > 0) : [];
}

export function resolveTargetEnemy(enemies = [], targetEnemyId = null) {
  const livingEnemies = getLivingEnemies(enemies);
  return livingEnemies.find((enemy) => enemy.runtimeId === targetEnemyId) || livingEnemies[0] || null;
}

export function resolveTargetEnemyId(enemies = [], targetEnemyId = null) {
  return resolveTargetEnemy(enemies, targetEnemyId)?.runtimeId || null;
}

export function getEnemyDisplayName(enemy) {
  return enemy?.displayName || enemy?.name || "敵人";
}

export function getEnemyGroupLabel(enemies = []) {
  const livingEnemies = getLivingEnemies(enemies);
  if (livingEnemies.length === 0) {
    return "敵人";
  }
  if (livingEnemies.length === 1) {
    return getEnemyDisplayName(livingEnemies[0]);
  }
  return "敵群";
}

export function getEnemyGroupThreatKind(enemies = []) {
  return getLivingEnemies(enemies).reduce((highestKind, enemy) => {
    const currentRank = ENEMY_THREAT_RANK[enemy.kind] || 1;
    const highestRank = ENEMY_THREAT_RANK[highestKind] || (highestKind ? 1 : 0);
    return currentRank > highestRank ? enemy.kind : highestKind;
  }, null);
}

function normalizeEnemyEntries(entries, options) {
  if (!Array.isArray(entries)) {
    return [];
  }

  const usedRuntimeIds = new Set();
  return entries
    .map((entry, index) => normalizeEnemyEntry(entry, index, options))
    .filter(Boolean)
    .map((enemy, index) => {
      enemy.runtimeId = ensureUniqueRuntimeId(enemy.runtimeId, index, usedRuntimeIds);
      usedRuntimeIds.add(enemy.runtimeId);
      return enemy;
    });
}

function normalizeEnemyEntry(entry, index, { applyStatScale }) {
  const descriptor = entry && typeof entry === "object" && entry.enemy
    ? entry
    : { enemy: entry };
  if (!descriptor.enemy || typeof descriptor.enemy !== "object") {
    return null;
  }

  const enemy = clone(descriptor.enemy);
  const statScale = normalizePositiveScale(descriptor.statScale ?? enemy.statScale, 1);
  const rewardScale = normalizeNonNegativeScale(
    descriptor.rewardScale ?? enemy.rewardScale,
    statScale
  );

  if (applyStatScale) {
    applyEnemyStatScale(enemy, statScale);
  }

  enemy.poison = normalizeNonNegativeNumber(enemy.poison);
  enemy.statScale = statScale;
  enemy.rewardScale = rewardScale;
  enemy.runtimeId = String(descriptor.runtimeId || enemy.runtimeId || `enemy-${index + 1}`);
  if (descriptor.displayName) {
    enemy.displayName = String(descriptor.displayName);
  }
  return enemy;
}

function applyEnemyStatScale(enemy, statScale) {
  const originalMaxHp = Math.max(1, Number(enemy.maxHp) || 1);
  const originalHp = Math.max(0, Math.min(originalMaxHp, Number(enemy.hp ?? originalMaxHp) || 0));
  const hpRatio = originalHp / originalMaxHp;
  enemy.maxHp = Math.max(1, Math.round(originalMaxHp * statScale));
  enemy.hp = Math.max(0, Math.min(enemy.maxHp, Math.round(enemy.maxHp * hpRatio)));
  enemy.attack = Math.max(1, Math.round((Number(enemy.attack) || 0) * statScale));
}

function assignDisplayNames(enemies, { preserveExisting }) {
  const counts = enemies.reduce((map, enemy) => {
    const name = enemy.name || "敵人";
    map.set(name, (map.get(name) || 0) + 1);
    return map;
  }, new Map());
  const indexes = new Map();

  enemies.forEach((enemy) => {
    if (preserveExisting && enemy.displayName) {
      return;
    }
    const name = enemy.name || "敵人";
    if ((counts.get(name) || 0) <= 1) {
      enemy.displayName = name;
      return;
    }
    const index = indexes.get(name) || 0;
    indexes.set(name, index + 1);
    enemy.displayName = `${name} ${toAlphabeticSuffix(index)}`;
  });
}

function toAlphabeticSuffix(index) {
  let value = Math.max(0, Math.floor(index));
  let suffix = "";
  do {
    suffix = String.fromCharCode(65 + (value % 26)) + suffix;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);
  return suffix;
}

function ensureUniqueRuntimeId(value, index, usedRuntimeIds) {
  const base = String(value || `enemy-${index + 1}`);
  if (!usedRuntimeIds.has(base)) {
    return base;
  }
  let suffix = 2;
  while (usedRuntimeIds.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
}

function normalizePositiveScale(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeNonNegativeScale(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeNonNegativeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
