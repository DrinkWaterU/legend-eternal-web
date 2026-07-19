import { getEnemyDefinition, sharedEnemyDefinitions } from "../enemies/index.js";
import { routeDefinitions } from "../routes/index.js";
import beachEventData from "./beach.json" with { type: "json" };
import forestEventData from "./forest.json" with { type: "json" };

const eventDataFiles = [
  forestEventData,
  beachEventData,
  ...Object.values(routeDefinitions).map((route) => ({
    id: route.id,
    events: route.eventDefinitions || []
  }))
];

export const eventDefinitions = buildDefinitionRegistry(
  eventDataFiles.flatMap((data) => data.events || []),
  "事件"
);

export const eventEnemyDefinitions = buildDefinitionRegistry(
  eventDataFiles.flatMap((data) => data.enemies || []),
  "事件敵人"
);

assertNoEnemyIdAmbiguity(eventEnemyDefinitions, sharedEnemyDefinitions);

export function getEventDefinition(eventId) {
  return eventDefinitions[eventId] || null;
}

export function getEventEnemyDefinition(enemyId) {
  return getEnemyDefinition(enemyId) || eventEnemyDefinitions[enemyId] || null;
}

function assertNoEnemyIdAmbiguity(eventEnemies, sharedEnemies) {
  Object.keys(eventEnemies).forEach((enemyId) => {
    if (sharedEnemies[enemyId]) {
      throw new Error(`敵人 id 同時存在共享與事件 registry：${enemyId}`);
    }
  });
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
