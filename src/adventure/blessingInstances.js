import { clone } from "../utils.js";

export function createBlessingInstance({ state, blessing, sourceLabel }) {
  const sequence = Math.max(0, Math.floor(Number(state.blessingInstanceSequence) || 0)) + 1;
  const instanceId = `run-${state.run}-blessing-${sequence}`;
  state.blessingInstanceSequence = sequence;

  return {
    instanceId,
    blessingId: blessing.id || null,
    acquiredOrder: sequence,
    sourceLabel: sourceLabel || "冒險途中",
    definition: clone(blessing),
    runtime: {
      timedRegens: [],
      encounterBiases: []
    }
  };
}

export function syncBlessingInstanceRuntime(instance, hero) {
  if (!instance || !hero) {
    return instance;
  }

  const instanceId = instance.instanceId;
  instance.runtime = {
    timedRegens: clone((Array.isArray(hero.timedRegens) ? hero.timedRegens : [])
      .filter((effect) => effect.instanceId === instanceId)),
    encounterBiases: clone((Array.isArray(hero.encounterBiases) ? hero.encounterBiases : [])
      .filter((bias) => bias.instanceId === instanceId))
  };
  return instance;
}

export function syncBlessingInstancesRuntime(instances, hero) {
  (Array.isArray(instances) ? instances : []).forEach((instance) => {
    syncBlessingInstanceRuntime(instance, hero);
  });
  return instances;
}

export function sortBlessingInstancesByAcquisition(instances) {
  return [...(Array.isArray(instances) ? instances : [])]
    .sort((left, right) => (Number(left?.acquiredOrder) || 0) - (Number(right?.acquiredOrder) || 0));
}
