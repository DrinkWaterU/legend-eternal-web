export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
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
