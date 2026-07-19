import { clone, randomItem, weightedRandomItem } from "../utils.js";

const DEFAULT_ENEMY_WEIGHT = 100;

export function buildEnemy(region, encounterIndex, hero, options = {}) {
  const encounterType = region.encounterPlan[encounterIndex];
  const normalizedType = typeof encounterType === "string" ? encounterType : encounterType?.type;
  const base = normalizedType === "boss"
    ? options.boss || region.boss
    : normalizedType === "elite"
      ? pickEnemy(region.elites, hero, "elite", encounterIndex)
      : pickEnemy(region.enemies, hero, "normal", encounterIndex);
  return buildScaledEnemy(base, region, encounterIndex);
}

export function buildEnemyGroup(region, encounterIndex, hero, options = {}) {
  const encounterEntry = region?.encounterPlan?.[encounterIndex];
  const encounterType = typeof encounterEntry === "string" ? encounterEntry : encounterEntry?.type;
  const count = Math.max(1, Math.floor(Number(options.count) || 1));
  const statScale = Number(options.statScale) > 0 ? Number(options.statScale) : 1;
  const attackScale = Number(options.attackScale) > 0 ? Number(options.attackScale) : statScale;
  const rewardScale = Number(options.rewardScale) >= 0 ? Number(options.rewardScale) : statScale;
  const entries = [];
  const selectedFamilies = new Set();

  for (let index = 0; index < count; index += 1) {
    const sourcePool = encounterType === "elite" ? region.elites : region.enemies;
    const availablePool = selectedFamilies.has("fishman")
      ? sourcePool.filter((enemy) => enemy.family !== "fishman")
      : sourcePool;
    const base = pickEnemy(
      availablePool.length > 0 ? availablePool : sourcePool,
      hero,
      encounterType === "elite" ? "elite" : "normal",
      encounterIndex
    );
    selectedFamilies.add(base.family);
    const enemy = buildScaledEnemy(base, region, encounterIndex);
    enemy.poison = 0;
    entries.push({ enemy, statScale, attackScale, rewardScale });
  }

  return entries;
}

export function buildScaledEnemy(baseEnemy, region, encounterIndex) {
  if (!baseEnemy) {
    throw new Error("缺少敵人 definition。");
  }
  const enemy = clone(baseEnemy);
  const scaling = region?.scaling || {};
  const scalingIndex = Math.max(0, Math.floor(Number(encounterIndex) || 0));
  const hpScale = 1 + scalingIndex * (Number(scaling.hpPerEncounter) || 0.08);
  const attackScale = 1 + scalingIndex * (Number(scaling.attackPerEncounter) || 0.08);
  enemy.maxHp = Math.round(enemy.maxHp * hpScale);
  enemy.hp = enemy.maxHp;
  enemy.attack = Math.round(enemy.attack * attackScale);
  return enemy;
}

function pickEnemy(enemies, hero, encounterType, encounterIndex = 0) {
  const eligibleEnemies = getEligibleEnemies(enemies, encounterIndex);
  const candidateEnemies = eligibleEnemies.length > 0 ? eligibleEnemies : enemies;
  const activeBiases = getActiveEncounterBiases(hero, encounterType);
  const guaranteeBias = activeBiases.find((bias) => shouldGuaranteeFamily(candidateEnemies, bias, encounterType));
  const selected = guaranteeBias
    ? randomItem(candidateEnemies.filter((enemy) => hasBiasedFamily(enemy, guaranteeBias)))
    : weightedRandomItem(candidateEnemies, (enemy) => getBiasedEnemyWeight(enemy, activeBiases, encounterType));

  updateEncounterBiases(hero, encounterType, selected);
  return selected;
}

function getEligibleEnemies(enemies, encounterIndex) {
  return enemies.filter((enemy) => {
    const minEncounter = Number(enemy.minEncounter);
    const maxEncounter = Number(enemy.maxEncounter);
    return (!Number.isFinite(minEncounter) || encounterIndex + 1 >= minEncounter)
      && (!Number.isFinite(maxEncounter) || encounterIndex + 1 <= maxEncounter);
  });
}

function getActiveEncounterBiases(hero, encounterType) {
  if (!hero || !Array.isArray(hero.encounterBiases)) {
    return [];
  }
  return hero.encounterBiases.filter((bias) => {
    const mode = bias[encounterType];
    return mode && mode.remaining > 0;
  });
}

function shouldGuaranteeFamily(enemies, bias, encounterType) {
  const mode = bias[encounterType];
  return Boolean(
    mode.guaranteeAfter
    && mode.misses + 1 >= mode.guaranteeAfter
    && enemies.some((enemy) => hasBiasedFamily(enemy, bias))
  );
}

function getBiasedEnemyWeight(enemy, activeBiases, encounterType) {
  const baseWeight = Number(enemy.weight) || DEFAULT_ENEMY_WEIGHT;
  return activeBiases.reduce((weight, bias) => {
    if (!hasBiasedFamily(enemy, bias)) {
      return weight;
    }
    return weight + (Number(bias[encounterType].bonusWeight) || 0);
  }, baseWeight);
}

function updateEncounterBiases(hero, encounterType, selectedEnemy) {
  if (!hero || !Array.isArray(hero.encounterBiases)) {
    return;
  }
  hero.encounterBiases.forEach((bias) => {
    const mode = bias[encounterType];
    if (!mode || mode.remaining <= 0) {
      return;
    }
    mode.remaining -= 1;
    mode.misses = hasBiasedFamily(selectedEnemy, bias) ? 0 : mode.misses + 1;
  });
  hero.encounterBiases = hero.encounterBiases.filter((bias) => {
    return ["normal", "elite"].some((type) => bias[type] && bias[type].remaining > 0);
  });
}

function hasBiasedFamily(enemy, bias) {
  const families = Array.isArray(bias.families) ? bias.families : [bias.family];
  return families.includes(enemy.family);
}
