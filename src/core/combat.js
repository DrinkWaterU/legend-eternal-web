import { clone, randomItem, roll } from "../utils.js";

export function buildEnemy(region, encounterIndex) {
  const encounterType = region.encounterPlan[encounterIndex];
  const base = encounterType === "boss"
    ? region.boss
    : encounterType === "elite"
      ? randomItem(region.elites)
      : randomItem(region.enemies);
  const enemy = clone(base);
  const scale = 1 + encounterIndex * 0.08;
  enemy.maxHp = Math.round(enemy.maxHp * scale);
  enemy.hp = enemy.maxHp;
  enemy.attack = Math.round(enemy.attack * scale);
  return enemy;
}

export function resolveHeroAction({ hero, enemy, log }) {
  if (enemy.dodgeChance && roll(enemy.dodgeChance)) {
    log.fixed("status", `${enemy.name} 閃開了攻擊。`);
    return;
  }

  let damage = Math.max(1, hero.attack - enemy.defense);
  if (enemy.family === "slime") {
    damage = Math.round(damage * (1 + hero.slimeBonus));
  }
  if (roll(hero.critChance)) {
    damage = Math.round(damage * 1.7);
    log.template("damage", "critical", { actor: hero.name });
  }

  enemy.hp = Math.max(0, enemy.hp - damage);
  log.template("damage", "heroDamage", {
    actor: hero.name,
    target: enemy.name,
    amount: damage
  });

  if (hero.poisonPower > 0 && enemy.hp > 0) {
    enemy.poison = Math.max(enemy.poison || 0, hero.poisonPower);
    log.template("status", "poisonApply", { target: enemy.name });
  }
}

export function resolveEnemyAction({ hero, enemy, turn, log }) {
  let damage = Math.max(1, enemy.attack - hero.defense);

  if (enemy.chargeEvery && turn % enemy.chargeEvery === 0) {
    log.template("status", "charge", { actor: enemy.name });
    damage = Math.round(damage * 1.8);
  }

  if (roll(enemy.critChance || 0)) {
    damage = Math.round(damage * 1.6);
    log.template("damage", "critical", { actor: enemy.name });
  }

  if (hero.shield > 0) {
    const blocked = Math.min(hero.shield, damage);
    hero.shield -= blocked;
    damage -= blocked;
    log.template("status", "block", { target: hero.name });
  }

  hero.hp = Math.max(0, hero.hp - damage);
  log.template("damage", "enemyDamage", {
    actor: enemy.name,
    target: hero.name,
    amount: damage
  });

  if (enemy.poisonPower && hero.hp > 0) {
    hero.poison = Math.max(hero.poison || 0, enemy.poisonPower);
    log.template("status", "poisonApply", { target: hero.name });
  }
}

export function applyEndOfTurnEffects({ hero, enemy, turn, log }) {
  if (hero.poison > 0) {
    const poisonDamage = Math.max(1, Math.round(hero.poison * (1 - hero.damageReduction)));
    hero.hp = Math.max(0, hero.hp - poisonDamage);
    log.template("damage", "poisonTick", { target: hero.name, amount: poisonDamage });
  }

  if (enemy.poison > 0) {
    enemy.hp = Math.max(0, enemy.hp - enemy.poison);
    log.template("damage", "poisonTick", { target: enemy.name, amount: enemy.poison });
  }

  if (hero.regenEvery > 0 && turn % hero.regenEvery === 0 && hero.hp > 0) {
    hero.hp = Math.min(hero.maxHp, hero.hp + hero.regenAmount);
    log.template("heal", "heal", { target: hero.name, amount: hero.regenAmount });
  }

  if (enemy.regenEvery > 0 && turn % enemy.regenEvery === 0 && enemy.hp > 0) {
    enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.regenAmount);
    log.template("heal", "heal", { target: enemy.name, amount: enemy.regenAmount });
  }
}
