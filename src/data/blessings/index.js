import beachData from "./beach.json" with { type: "json" };
import goblinData from "./goblin.json" with { type: "json" };

export const goblinBlessings = goblinData.blessings;

export const blessingPoolDefinitions = Object.freeze({
  [goblinData.id]: {
    id: goblinData.id,
    name: goblinData.name,
    blessings: goblinData.blessings
  },
  [beachData.id]: {
    id: beachData.id,
    name: beachData.name,
    blessings: beachData.blessings,
    regionId: beachData.id
  }
});

export function getBlessingPool(poolId) {
  return blessingPoolDefinitions[poolId] || null;
}

export function getAllIndependentBlessings() {
  return Object.values(blessingPoolDefinitions)
    .filter((pool) => !pool.regionId)
    .flatMap((pool) => pool.blessings || []);
}
