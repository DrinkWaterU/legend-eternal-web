// Ember recovery: before the phoenix blessing a defeat still resets the character to Lv.1,
// but the highest level reached is remembered. Until the character climbs back to it,
// experience gains are multiplied. First-time growth is unchanged; only re-climbing is faster.

export const EMBER_EXP_MULTIPLIER = 2;

function toLevel(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

// Level the ember is pulling the character back toward, or 0 when no recovery is active.
export function getEmberRecoveryLevel(progress) {
  const emberLevel = toLevel(progress?.emberLevel);
  const level = Math.max(1, toLevel(progress?.level));
  return emberLevel > level ? emberLevel : 0;
}

// Call just before a pre-phoenix reset. Keeps the highest level ever lost.
export function rememberEmberLevel(progress) {
  if (!progress) return 0;
  // Losing Lv.1 loses nothing worth recovering.
  if (toLevel(progress.level) > 1) {
    progress.emberLevel = Math.max(toLevel(progress.emberLevel), toLevel(progress.level));
  }
  return progress.emberLevel;
}

// Experience actually granted, and the part that came from the ember.
export function applyEmberExpBonus(amount, progress) {
  const base = Math.max(0, Math.floor(Number(amount) || 0));
  if (!getEmberRecoveryLevel(progress) || base <= 0) return { total: base, bonus: 0 };
  const total = base * EMBER_EXP_MULTIPLIER;
  return { total, bonus: total - base };
}

// Call after level-ups. Returns true when recovery just finished (level reached the ember level).
export function settleEmberRecovery(progress) {
  const emberLevel = toLevel(progress?.emberLevel);
  if (!emberLevel) return false;
  if (getEmberRecoveryLevel(progress)) return false;
  progress.emberLevel = 0;
  return emberLevel > 1;
}

export function describeEmberRecovery(progress) {
  const target = getEmberRecoveryLevel(progress);
  return target ? `回到 Lv.${target} 之前，獲得的經驗 ×${EMBER_EXP_MULTIPLIER}。` : "";
}
