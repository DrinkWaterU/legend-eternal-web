import { getEnemyDisplayName } from "./enemyGroups.js";

const SALT_EROSION_INITIAL_TURNS = 5;
const SALT_EROSION_MAX_TURNS = 7;
const PARALYSIS_INITIAL_TURNS = 2;
const PARALYSIS_MAX_TURNS = 3;
const DEFAULT_SALT_HEALING_REDUCTION = 0.3;

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

export function applySaltErosion(hero, log) {
  if (!hero) return 0;
  const currentTurns = Math.max(0, Number(hero.saltErosion?.remainingTurns) || 0);
  const remainingTurns = Math.min(
    SALT_EROSION_MAX_TURNS,
    currentTurns > 0 ? currentTurns + 1 : SALT_EROSION_INITIAL_TURNS
  );
  hero.saltErosion = { remainingTurns };
  log?.fixed?.("status", `${hero.name} 受到鹽蝕，戰鬥中的治療效果降低。`);
  return remainingTurns;
}

export function applyParalysis(hero, log) {
  if (!hero) return 0;
  const currentTurns = Math.max(0, Number(hero.paralysis?.remainingTurns) || 0);
  const remainingTurns = Math.min(
    PARALYSIS_MAX_TURNS,
    currentTurns > 0 ? currentTurns + 1 : PARALYSIS_INITIAL_TURNS
  );
  hero.paralysis = { remainingTurns };
  log?.fixed?.("status", `${hero.name} 陷入麻痺，接下來的攻擊可能變弱。`);
  return remainingTurns;
}

export function advanceHeroCombatStatuses(hero) {
  if (!hero) return;
  ["saltErosion", "paralysis"].forEach((statusId) => {
    const status = hero[statusId];
    if (!status) return;
    status.remainingTurns = Math.max(0, (Number(status.remainingTurns) || 0) - 1);
    if (status.remainingTurns <= 0) hero[statusId] = null;
  });
}

export function getHeroBattleHealingMultiplier(hero) {
  const remainingTurns = Number(hero?.saltErosion?.remainingTurns) || 0;
  if (remainingTurns <= 0) {
    return 1;
  }
  const reduction = Number.isFinite(Number(hero?.saltHealingReduction))
    ? Math.max(0, Math.min(1, Number(hero.saltHealingReduction)))
    : DEFAULT_SALT_HEALING_REDUCTION;
  return 1 - reduction;
}

export function getHeroBattleHealingAmount(hero, amount, { minimum = 0 } = {}) {
  const requested = Math.max(0, Math.round(Number(amount) || 0));
  return Math.max(minimum, Math.round(requested * getHeroBattleHealingMultiplier(hero)));
}

export function applyHeroBattleHealing(hero, amount) {
  if (!hero || hero.hp <= 0) return 0;
  const effectiveAmount = getHeroBattleHealingAmount(hero, amount);
  const before = hero.hp;
  hero.hp = Math.min(hero.maxHp, hero.hp + effectiveAmount);
  return hero.hp - before;
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
    const amount = applyHeroBattleHealing(hero, hero.regenAmount);
    if (amount > 0) log.template("heal", "heal", { target: hero.name, amount });
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
    const amount = applyHeroBattleHealing(hero, Math.max(1, Math.round(hero.maxHp * effect.maxHpRatio)));
    if (amount > 0) {
      log.template("heal", "timedRegen", {
        source: effect.source,
        target: hero.name,
        amount
      });
    }
  });
}
