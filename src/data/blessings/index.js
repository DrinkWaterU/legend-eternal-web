import goblinData from "./goblin.json" with { type: "json" };

export const goblinBlessings = goblinData.blessings;

export const blessingPoolDefinitions = Object.freeze({
  [goblinData.id]: {
    id: goblinData.id,
    name: goblinData.name,
    blessings: goblinData.blessings
  }
});

export function getBlessingPool(poolId) {
  return blessingPoolDefinitions[poolId] || null;
}

export function getAllIndependentBlessings() {
  return Object.values(blessingPoolDefinitions).flatMap((pool) => pool.blessings || []);
}
