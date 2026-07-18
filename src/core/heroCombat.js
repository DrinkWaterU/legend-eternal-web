import { getEnemyDisplayName } from "./enemyGroups.js";
import { roll } from "../utils.js";

const HEAVY_STRIKE_CHANCE = 0.2;
const HEAVY_STRIKE_MULTIPLIER = 1.4;
const FOLLOW_UP_CHANCE = 0.25;
const FOLLOW_UP_ATTACK_RATIO = 0.5;
const FOLLOW_UP_PLUS_CHANCE = 0.4;
const FOLLOW_UP_PLUS_ATTACK_RATIO = 0.7;
const ENTANGLE_ESCAPE_CHANCES = [0.45, 0.7, 0.9, 1];
const STATUS_FAMILIARITY_MAX_STACKS = 3;

export function resolveHeroEntangle({ hero, log, retryOnFailure = null, onRetryResult = null }) {
  if (!hero.entangle) {
    return false;
  }

  const attempts = Math.max(0, hero.entangle.attempts || 0);
  const chance = ENTANGLE_ESCAPE_CHANCES[Math.min(attempts, ENTANGLE_ESCAPE_CHANCES.length - 1)];
  if (roll(chance)) {
    hero.entangle = null;
    log.template("status", "entangleBreak", { target: hero.name });
    return false;
  }

  const shouldRetry = typeof retryOnFailure === "function"
    && retryOnFailure({ hero, chance, attempts }) === true;
  if (shouldRetry) {
    const success = roll(chance);
    if (typeof onRetryResult === "function") {
      onRetryResult({ hero, chance, attempts, success });
    }
    if (success) {
      hero.entangle = null;
      log.template("status", "entangleBreak", { target: hero.name });
      return false;
    }
  }

  hero.entangle.attempts = attempts + 1;
  log.template("status", "entangleHold", { target: hero.name });
  return true;
}

export function resolveHeroAction({ hero, enemy, log }) {
  const result = resolveHeroStrike({ hero, enemy, log });
  if (result.dodged) {
    return result;
  }

  const enemyName = getEnemyDisplayName(enemy);
  const followUpChance = hasSkill(hero, "exploit-weakness-plus")
    ? FOLLOW_UP_PLUS_CHANCE
    : FOLLOW_UP_CHANCE;
  const followUpAttackRatio = hasSkill(hero, "exploit-weakness-plus")
    ? FOLLOW_UP_PLUS_ATTACK_RATIO
    : FOLLOW_UP_ATTACK_RATIO;
  if (enemy.hp > 0 && hasSkill(hero, "skilled-follow-up") && roll(followUpChance)) {
    const followUpDamage = Math.max(1, Math.round(getHeroEffectiveAttack(hero) * followUpAttackRatio));
    enemy.hp = Math.max(0, enemy.hp - followUpDamage);
    log.template("hero-damage", "skilledFollowUp", {
      actor: hero.name,
      target: enemyName,
      amount: followUpDamage
    });
  }
  return result;
}

export function resolveHeroStrike({ hero, enemy, log, options = {} }) {
  const { critChanceBonus = 0, damageMultiplier = 1, allowHeavyStrike = true } = options;
  const enemyName = getEnemyDisplayName(enemy);
  const openingCritChance = hero.hasAttackedThisBattle ? 0 : (hero.openingCritChance || 0);
  hero.hasAttackedThisBattle = true;

  if (enemy.dodgeChance && roll(enemy.dodgeChance)) {
    log.fixed("status", `${enemyName} 閃開了攻擊。`);
    return { dodged: true, critical: false, damage: 0 };
  }

  const attackMultiplier = getHeroAttackDamageMultiplier(hero, log);
  let damage = getHeroDirectAttackDamage({ hero, enemy, damageMultiplier, attackMultiplier });
  if (allowHeavyStrike && hasSkill(hero, "heavy-strike") && roll(HEAVY_STRIKE_CHANCE)) {
    damage = Math.max(1, Math.round(damage * HEAVY_STRIKE_MULTIPLIER));
    log.template("skill", "heavyStrike", { actor: hero.name });
  }
  const critChance = hero.critChance
    + (hero.battleCritBonus || 0)
    + (enemy.poison > 0 ? hero.poisonedCritChance || 0 : 0)
    + openingCritChance
    + (enemy.hp < enemy.maxHp * 0.5 ? hero.woundedTargetCritChance || 0 : 0)
    + Math.max(0, Number(critChanceBonus) || 0);
  const critical = roll(critChance);
  if (critical) {
    damage = Math.round(damage * (hero.critDamageMultiplier || 1.7));
    log.template("critical", "critical", { actor: hero.name });
  }

  enemy.hp = Math.max(0, enemy.hp - damage);
  log.template("hero-damage", "heroDamage", { actor: hero.name, target: enemyName, amount: damage });

  if (hero.poisonPower > 0 && enemy.hp > 0) {
    enemy.poison = Math.max(enemy.poison || 0, hero.poisonPower);
    log.template("status", "poisonApply", { target: enemyName });
    applyStatusFamiliarity(hero, log);
  }

  return { dodged: false, critical, damage };
}

export function getHeroDirectAttackDamage({ hero, enemy, damageMultiplier = 1, attackMultiplier = 1 }) {
  const poisonedDefenseIgnore = enemy.poison > 0 ? Math.max(0, Number(hero.poisonedTargetDefenseIgnore) || 0) : 0;
  const effectiveDefense = Math.max(0, (Number(enemy.defense) || 0) - poisonedDefenseIgnore);
  const multiEnemyDamageBonus = Number(hero?.activeEnemyCount) >= 2
    ? Math.max(0, Number(hero?.multiEnemyDamageBonus) || 0)
    : 0;
  const effectiveAttack = getHeroEffectiveAttack(hero)
    * (1 + multiEnemyDamageBonus)
    * Math.max(0, Number(attackMultiplier) || 0);
  let damage = Math.max(1, effectiveAttack - effectiveDefense);
  const familyBonus = getFamilyDamageBonus(hero, enemy.family);
  if (familyBonus > 0) {
    damage = Math.round(damage * (1 + familyBonus));
  }
  return Math.max(1, Math.round(damage * Math.max(0, Number(damageMultiplier) || 0)));
}

export function getHeroAttackDamageMultiplier(hero, log) {
  const remainingTurns = Number(hero?.paralysis?.remainingTurns) || 0;
  if (remainingTurns <= 0 || Math.random() >= 0.5) {
    return 1;
  }
  log?.fixed?.("status", `${hero.name} 受到麻痺影響，這次攻擊力降低 20%。`);
  return 0.8;
}

function hasSkill(hero, skillId) {
  return Array.isArray(hero.skills) && hero.skills.includes(skillId);
}

function getFamilyDamageBonus(hero, family) {
  const familyDamageBonus = hero.familyDamageBonus || {};
  const legacySlimeBonus = family === "slime" ? hero.slimeBonus || 0 : 0;
  return (familyDamageBonus[family] || 0) + legacySlimeBonus;
}

export function getHeroEffectiveAttack(hero) {
  return (Number(hero?.attack) || 0)
    + (Number(hero?.battleAttackBonus) || 0)
    + getLowHpAttackBonus(hero);
}

function getLowHpAttackBonus(hero) {
  const maxHp = Number(hero?.maxHp);
  const hp = Number(hero?.hp);
  const cap = Math.max(0, Number(hero?.lowHpAttackBonus) || 0);
  if (!(maxHp > 0) || !Number.isFinite(hp) || cap <= 0) {
    return 0;
  }
  const hpRatio = hp / maxHp;
  if (hpRatio <= 0.25) {
    return cap;
  }
  if (hpRatio <= 0.5) {
    return Math.min(cap, 2);
  }
  return 0;
}

function applyStatusFamiliarity(hero, log) {
  if (!hasSkill(hero, "status-familiarity")) {
    return;
  }
  hero.skillState.statusFamiliarityStacks = hero.skillState.statusFamiliarityStacks || 0;
  const maxStacks = STATUS_FAMILIARITY_MAX_STACKS + (hero.statusFamiliarityLimitBonus || 0);
  if (hero.skillState.statusFamiliarityStacks >= maxStacks) {
    return;
  }
  hero.skillState.statusFamiliarityStacks += 1;
  hero.battleAttackBonus = (hero.battleAttackBonus || 0) + 1;
  log.template("skill", "statusFamiliarity", {
    actor: hero.name,
    stacks: hero.skillState.statusFamiliarityStacks
  });
}
