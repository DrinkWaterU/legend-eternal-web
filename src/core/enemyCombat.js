import { getEnemyDisplayName } from "./enemyGroups.js";
import { roll } from "../utils.js";

const DEFAULT_CHARGE_MULTIPLIER = 1.6;
const STEADY_STANCE_CHANCE = 0.25;
const STEADY_STANCE_REDUCTION = 0.3;
const STEADY_STANCE_PLUS_CHANCE = 0.3;
const STEADY_STANCE_PLUS_REDUCTION = 0.35;

export function resolveEnemyAction({ hero, enemy, turn, log, modifyDirectDamage = null }) {
  const enemyName = getEnemyDisplayName(enemy);
  let damage = Math.max(1, enemy.attack - hero.defense);
  const damageSource = { type: "attack", label: `${enemyName}的攻擊` };

  if (enemy.chargeEvery && turn % enemy.chargeEvery === 0) {
    log.template("status", "charge", { actor: enemyName });
    damage = Math.round(damage * (enemy.chargeMultiplier || DEFAULT_CHARGE_MULTIPLIER));
    damageSource.type = "charge";
    damageSource.label = `${enemyName}的衝鋒`;
  }

  if (roll(enemy.critChance || 0)) {
    damage = Math.round(damage * 1.6);
    log.template("critical", "critical", { actor: enemyName });
    damageSource.type = damageSource.type === "charge" ? "chargeCritical" : "critical";
    damageSource.label = damageSource.type === "chargeCritical"
      ? `${enemyName}的衝鋒暴擊`
      : `${enemyName}的暴擊`;
  }

  const steadyStance = getSteadyStance(hero);
  if (damage > 1 && steadyStance.enabled && roll(steadyStance.chance)) {
    const reduced = Math.max(1, Math.min(damage - 1, Math.round(damage * steadyStance.reduction)));
    damage -= reduced;
    log.template("skill", "steadyStance", { actor: hero.name, amount: reduced });
  }

  if (typeof modifyDirectDamage === "function") {
    const modifiedDamage = modifyDirectDamage({ hero, enemy, damage, damageSource, log });
    if (Number.isFinite(modifiedDamage)) {
      damage = Math.max(0, Math.round(modifiedDamage));
    }
  }

  if (hero.shield > 0) {
    const blocked = Math.min(hero.shield, damage);
    hero.shield -= blocked;
    damage -= blocked;
    log.template("status", "block", { target: hero.name });
  }

  hero.hp = Math.max(0, hero.hp - damage);
  log.template("enemy-damage", "enemyDamage", {
    actor: enemyName,
    target: hero.name,
    amount: damage
  });

  if (enemy.poisonPower && hero.hp > 0) {
    hero.poison = Math.max(hero.poison || 0, enemy.poisonPower);
    log.template("status", "poisonApply", { target: hero.name });
  }

  if (enemy.entangleChance && hero.hp > 0 && !hero.entangle && roll(enemy.entangleChance)) {
    hero.entangle = { attempts: 0 };
    log.template("status", "entangleApply", { target: hero.name });
  }

  return damageSource;
}

function getSteadyStance(hero) {
  if (hasSkill(hero, "steady-stance-plus")) {
    return {
      enabled: true,
      chance: STEADY_STANCE_PLUS_CHANCE,
      reduction: STEADY_STANCE_PLUS_REDUCTION
    };
  }
  return {
    enabled: hasSkill(hero, "steady-stance"),
    chance: STEADY_STANCE_CHANCE,
    reduction: STEADY_STANCE_REDUCTION
  };
}

function hasSkill(hero, skillId) {
  return Array.isArray(hero.skills) && hero.skills.includes(skillId);
}
