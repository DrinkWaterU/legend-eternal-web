import goblinEnemyData from "./goblin.json" with { type: "json" };
import caveEnemyData from "./cave.json" with { type: "json" };

const enemyDataFiles = [goblinEnemyData, caveEnemyData];
const COMBAT_ROLES = new Set(["frontline", "output", "support", "control"]);

export const sharedEnemyDefinitions = buildDefinitionRegistry(
  enemyDataFiles.flatMap((data) => data.enemies || []),
  "共享敵人"
);

export function getEnemyDefinition(enemyId) {
  return sharedEnemyDefinitions[enemyId] || null;
}

function buildDefinitionRegistry(definitions, label) {
  const registry = {};
  definitions.forEach((definition) => {
    const id = String(definition?.id || "").trim();
    if (!id) {
      throw new Error(`${label} definition 缺少 id。`);
    }
    if (registry[id]) {
      throw new Error(`${label} id 重複：${id}`);
    }
    validateEnemyDefinition(definition, label);
    registry[id] = definition;
  });
  return Object.freeze(registry);
}

function validateEnemyDefinition(definition, label) {
  if (!String(definition?.family || "").trim()) {
    throw new Error(`${label} ${definition?.id || "(empty)"} 缺少 family。`);
  }

  if (definition.combatRole !== undefined && !COMBAT_ROLES.has(definition.combatRole)) {
    throw new Error(`${label} ${definition.id} combatRole 無效：${definition.combatRole}`);
  }

  if (definition.supportAction !== undefined) {
    validateSupportAction(definition, label);
  }

  ["paralysisChance"].forEach((field) => {
    if (definition[field] !== undefined && !isChance(definition[field])) {
      throw new Error(`${label} ${definition.id} ${field} 必須介於 0 到 1。`);
    }
  });

  if (definition.chargeEvery !== undefined && !isPositiveInteger(definition.chargeEvery)) {
    throw new Error(`${label} ${definition.id} chargeEvery 必須是正整數。`);
  }
  if (definition.chargeMultiplier !== undefined && !(Number(definition.chargeMultiplier) > 0)) {
    throw new Error(`${label} ${definition.id} chargeMultiplier 必須 > 0。`);
  }
}

function validateSupportAction(definition, label) {
  const support = definition.supportAction;
  if (definition.combatRole !== "support") {
    throw new Error(`${label} ${definition.id} 有 supportAction 但 combatRole 不是 support。`);
  }
  if (!isPositiveInteger(support.everyTurns) || !isPositiveInteger(support.maxUses)) {
    throw new Error(`${label} ${definition.id} supportAction 間隔與次數必須是正整數。`);
  }
  if (!isNonNegativeInteger(support.attackGain) || !isNonNegativeInteger(support.defenseGain)) {
    throw new Error(`${label} ${definition.id} supportAction 攻防加成必須是非負整數。`);
  }
  if (Number(support.attackGain) === 0 && Number(support.defenseGain) === 0) {
    throw new Error(`${label} ${definition.id} supportAction 至少要有一種有效加成。`);
  }
  if (support.targetCombatRole !== undefined && !COMBAT_ROLES.has(support.targetCombatRole)) {
    throw new Error(`${label} ${definition.id} supportAction targetCombatRole 無效：${support.targetCombatRole}`);
  }
}

function isChance(value) {
  return Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 1;
}

function isPositiveInteger(value) {
  return Number.isInteger(Number(value)) && Number(value) > 0;
}

function isNonNegativeInteger(value) {
  return Number.isInteger(Number(value)) && Number(value) >= 0;
}
