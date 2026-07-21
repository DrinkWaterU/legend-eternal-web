import beachData from "./beach.json" with { type: "json" };
import caveData from "./cave.json" with { type: "json" };
import goblinData from "./goblin.json" with { type: "json" };

export const goblinBlessings = goblinData.blessings;

export const blessingPoolDefinitions = Object.freeze({
  [goblinData.id]: {
    id: goblinData.id,
    name: goblinData.name,
    blessings: goblinData.blessings,
    ownerType: "route",
    ownerId: "goblin-camp"
  },
  [beachData.id]: {
    id: beachData.id,
    name: beachData.name,
    blessings: beachData.blessings,
    ownerType: "region",
    ownerId: beachData.id,
    regionId: beachData.id
  },
  [caveData.id]: {
    id: caveData.id,
    name: caveData.name,
    blessings: caveData.blessings,
    ownerType: "route",
    ownerId: "coast-cave",
    contentStatus: caveData.contentStatus
  }
});

export function getBlessingPool(poolId) {
  return blessingPoolDefinitions[poolId] || null;
}

export function getAllIndependentBlessings() {
  return Object.values(blessingPoolDefinitions)
    .filter((pool) => pool.ownerType !== "region")
    .flatMap((pool) => pool.blessings || []);
}
