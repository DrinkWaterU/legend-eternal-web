// Direct-damage estimates for the R4 paired policy (tools/analyze-r4-gameplay.mjs).
// Each estimate follows the formal rounding and guard rules so that attack, breach and
// wave are scored with the same direct-damage mechanics (R5-01).
// Not modelled: crits, heavy strike, family/cave bonuses, wind-stagger and highland
// opportunity packets, and skills that ignore guard. Returned values are not capped
// at remaining HP; callers cap them.
import { applyEnemyDamageProtection } from '../src/core/enemyProtection.js';

const defenseOf = (enemy) => Number(enemy.defense) || 0;

// resolveHeroStrike: max(1, attack - defense) rounded, plus any breach bonus, then guard.
export function estimatePrimaryHit({ power, enemy, enemies, bonus = 0 }) {
  const base = Math.max(1, Math.round(Math.max(1, power - defenseOf(enemy))));
  return applyEnemyDamageProtection({ enemy, enemies, damage: base + bonus }).damage;
}

// packet() in runWeaponAttack: subtract defense, round, minimum 1, then guard.
export function estimatePacket({ amount, enemy, enemies, fixed = false }) {
  const raw = Math.max(1, Math.round(amount - (fixed ? 0 : defenseOf(enemy))));
  return applyEnemyDamageProtection({ enemy, enemies, damage: raw }).damage;
}

// Extra damage a later main strike gains from weaponBreach. The bonus is added before
// guard, so the gain is the guarded difference, not the raw bonus.
export function estimateBreachBonusPerHit({ power, enemy, enemies, strength }) {
  const bonus = Math.max(3, Math.round(defenseOf(enemy) * 0.25 * strength));
  return estimatePrimaryHit({ power, enemy, enemies, bonus }) - estimatePrimaryHit({ power, enemy, enemies });
}

// Wave packets resolve after the main strike, in state order. A frontline killed earlier
// in the action no longer protects the enemies hit after it.
export function estimateWave({ power, ratio, target, hit, enemies }) {
  const simulated = enemies.map((enemy) => ({ ...enemy }));
  const simulatedTarget = simulated.find((enemy) => enemy.runtimeId === target.runtimeId);
  if (simulatedTarget) simulatedTarget.hp = Math.max(0, simulatedTarget.hp - hit);
  const hits = [];
  for (const enemy of simulated) {
    if (enemy.hp <= 0 || enemy.runtimeId === target.runtimeId) continue;
    const damage = Math.min(enemy.hp, estimatePacket({ amount: power * ratio, enemy, enemies: simulated }));
    const original = enemies.find((candidate) => candidate.runtimeId === enemy.runtimeId);
    enemy.hp -= damage;
    hits.push({ enemy: original, damage, killed: enemy.hp <= 0 });
  }
  return hits;
}
