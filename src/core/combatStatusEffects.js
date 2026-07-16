import { getEnemyDisplayName } from "./enemyGroups.js";

export function getHeroPendingHpLoss(hero) {
  if (!hero || hero.poison <= 0) {
    return 0;
  }
  return calculateHeroPoisonDamage(hero);
}

export function getEnemyPendingHpLoss(enemy) {
  if (!enemy || enemy.poison <= 0) {
    return 0;
  }
  return Math.max(0, Number(enemy.poison) || 0);
}

export function applyHeroEndOfTurnNegativeEffects({ hero, log, modifyPoisonDamage = null }) {
  let heroDeathCause = null;
  let poisonDamage = getHeroPendingHpLoss(hero);
  if (poisonDamage > 0) {
    if (typeof modifyPoisonDamage === "function") {
      const modifiedDamage = modifyPoisonDamage({ hero, damage: poisonDamage, log });
      if (Number.isFinite(modifiedDamage)) {
        poisonDamage = Math.max(0, Math.round(modifiedDamage));
      }
    }
    hero.hp = Math.max(0, hero.hp - poisonDamage);
    log.template("enemy-damage", "poisonTick", { target: hero.name, amount: poisonDamage });
    if (hero.hp <= 0) {
      heroDeathCause = { type: "poison", label: "中毒" };
    }
  }
  return { heroDeathCause };
}

export function applyEnemyEndOfTurnNegativeEffects({ enemy, log }) {
  const poisonDamage = getEnemyPendingHpLoss(enemy);
  if (poisonDamage <= 0) {
    return;
  }
  enemy.hp = Math.max(0, enemy.hp - poisonDamage);
  log.template("hero-damage", "poisonTick", {
    target: getEnemyDisplayName(enemy),
    amount: poisonDamage
  });
}

export function applyHeroEndOfTurnRecoveryEffects({ hero, turn, log }) {
  if (hero.regenEvery > 0 && turn % hero.regenEvery === 0 && hero.hp > 0) {
    hero.hp = Math.min(hero.maxHp, hero.hp + hero.regenAmount);
    log.template("heal", "heal", { target: hero.name, amount: hero.regenAmount });
  }
  applyTimedRegens(hero, turn, log);
}

export function applyEnemyEndOfTurnRecoveryEffects({ enemy, turn, log }) {
  if (enemy.regenEvery > 0 && turn % enemy.regenEvery === 0 && enemy.hp > 0) {
    enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.regenAmount);
    log.template("heal", "heal", {
      target: getEnemyDisplayName(enemy),
      amount: enemy.regenAmount
    });
  }
}

function calculateHeroPoisonDamage(hero) {
  const poison = Math.max(0, Number(hero.poison) || 0);
  const damageReduction = Number(hero.damageReduction) || 0;
  return poison > 0 ? Math.max(1, Math.round(poison * (1 - damageReduction))) : 0;
}

function applyTimedRegens(hero, turn, log) {
  if (!Array.isArray(hero.timedRegens) || hero.hp <= 0) {
    return;
  }
  hero.timedRegens.forEach((effect) => {
    if (effect.remainingEncounters <= 0 || effect.everyTurns <= 0 || turn % effect.everyTurns !== 0) {
      return;
    }
    const amount = Math.max(1, Math.round(hero.maxHp * effect.maxHpRatio));
    hero.hp = Math.min(hero.maxHp, hero.hp + amount);
    log.template("heal", "timedRegen", {
      source: effect.source,
      target: hero.name,
      amount
    });
  });
}
