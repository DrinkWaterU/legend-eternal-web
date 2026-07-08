import goblinEnemyData from "./goblin.json" with { type: "json" };

const enemyDataFiles = [goblinEnemyData];

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
    registry[id] = definition;
  });
  return Object.freeze(registry);
}
