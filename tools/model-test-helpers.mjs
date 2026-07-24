export function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function withSeed(seed, action) {
  const originalRandom = Math.random;
  Math.random = createSeededRandom(seed);
  try {
    return action();
  } finally {
    Math.random = originalRandom;
  }
}

export function weightedPick(items, getWeight, rng = Math.random) {
  const weights = items.map((item) => Math.max(0, Number(getWeight(item)) || 0));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let value = rng() * total;
  for (let index = 0; index < items.length; index += 1) {
    value -= weights[index];
    if (value <= 0) {
      return items[index];
    }
  }
  return items.at(-1);
}

export function seedFromText(text) {
  let hash = 2166136261;
  for (let index = 0; index < String(text).length; index += 1) {
    hash ^= String(text).charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function parseRoundCount(value, fallback) {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function formatPercent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

export function encounterSortValue(value) {
  const match = String(value).match(/(\d+)/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}
