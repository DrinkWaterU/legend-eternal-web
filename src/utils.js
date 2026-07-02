export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

export function weightedRandomItem(items, getWeight) {
  const weights = items.map((item) => Math.max(0, Number(getWeight(item)) || 0));
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  if (totalWeight <= 0) {
    return randomItem(items);
  }

  let randomWeight = Math.random() * totalWeight;
  for (let index = 0; index < items.length; index += 1) {
    randomWeight -= weights[index];
    if (randomWeight <= 0) {
      return items[index];
    }
  }

  return items[items.length - 1];
}

export function roll(chance) {
  return Math.random() < chance;
}

export function toSafeNumber(value, fallback = 0) {
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function toSafeInteger(value, fallback = 0) {
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}
