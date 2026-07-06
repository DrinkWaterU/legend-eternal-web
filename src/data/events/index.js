import forestEventData from "./forest.json" with { type: "json" };

const eventDataFiles = [forestEventData];

export const eventDefinitions = buildDefinitionRegistry(
  eventDataFiles.flatMap((data) => data.events || []),
  "事件"
);

export const eventEnemyDefinitions = buildDefinitionRegistry(
  eventDataFiles.flatMap((data) => data.enemies || []),
  "事件敵人"
);

export function getEventDefinition(eventId) {
  return eventDefinitions[eventId] || null;
}

export function getEventEnemyDefinition(enemyId) {
  return eventEnemyDefinitions[enemyId] || null;
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
