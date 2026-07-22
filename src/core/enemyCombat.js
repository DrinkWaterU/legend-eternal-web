import { getEnemyDisplayName } from "./enemyGroups.js";
import { applyParalysis, applySaltErosion, getParalysisDamageMultiplier } from "./combatStatusEffects.js";
import { roll } from "../utils.js";
import { registerShieldDepletedByDirectAttack } from "./caveBlessingEffects.js";

const DEFAULT_CHARGE_MULTIPLIER = 1.6;
const ENEMY_CRIT_MULTIPLIER = 1.6;
const STEADY_STANCE_CHANCE = 0.25;
const STEADY_STANCE_REDUCTION = 0.3;
const STEADY_STANCE_PLUS_CHANCE = 0.35;
const STEADY_STANCE_PLUS_REDUCTION = 0.4;

export function resolveEnemyAction({ hero, enemy, turn, log, modifyDirectDamage = null }) {
  const specialAttack = getScheduledSpecialAttack(enemy, turn);
  const damageSource = specialAttack
    ? resolveMultiHitSpecialAttack({
        hero,
        enemy,
        specialAttack,
        log,
        modifyDirectDamage
      })
    : resolveStandardEnemyAttack({
        hero,
        enemy,
        turn,
        log,
        modifyDirectDamage
      });

  if (hero.hp > 0) {
    applyEnemyAttackStatusEffects({ hero, enemy, log });
    logUpcomingSpecialAttack({ enemy, turn, log });
  }

  return damageSource;
}

function resolveStandardEnemyAttack({ hero, enemy, turn, log, modifyDirectDamage }) {
  const enemyName = getEnemyDisplayName(enemy);
  let damage = getEnemyDirectDamage({ hero, enemy });
  const damageSource = { type: "attack", label: `${enemyName}的攻擊` };

  if (enemy.chargeEvery && turn % enemy.chargeEvery === 0) {
    log.template("status", "charge", { actor: enemyName });
    damage = Math.round(damage * (enemy.chargeMultiplier || DEFAULT_CHARGE_MULTIPLIER));
    damageSource.type = "charge";
    damageSource.label = `${enemyName}的衝鋒`;
  }

  if (roll(enemy.critChance || 0)) {
    damage = Math.round(damage * ENEMY_CRIT_MULTIPLIER);
    log.template("critical", "critical", { actor: enemyName });
    damageSource.type = damageSource.type === "charge" ? "chargeCritical" : "critical";
    damageSource.label = damageSource.type === "chargeCritical"
      ? `${enemyName}的衝鋒暴擊`
      : `${enemyName}的暴擊`;
  }

  damage = applySteadyStance({ hero, damage, log });
  damage = applyDirectDamageModifier({
    hero,
    enemy,
    damage,
    damageSource,
    log,
    modifyDirectDamage
  });
  applyEnemyDamageSegment({ hero, enemyName, damage, log });
  return damageSource;
}

function resolveMultiHitSpecialAttack({ hero, enemy, specialAttack, log, modifyDirectDamage }) {
  const enemyName = getEnemyDisplayName(enemy);
  const specialName = specialAttack.name || "特殊攻擊";
  const hits = Array.isArray(specialAttack.hits) ? specialAttack.hits : [];
  const damageSource = {
    type: specialAttack.id || "specialAttack",
    label: `${enemyName}的${specialName}`
  };
  const critical = roll(enemy.critChance || 0);
  const criticalHitIndex = Math.max(0, hits.length - 1);

  log.fixed("status", `${enemyName}施放「${specialName}」。`);

  hits.forEach((hit, index) => {
    if (hero.hp <= 0) {
      return;
    }

    const hitLabel = hit?.label || `第 ${index + 1} 段`;
    let damage = getEnemyDirectDamage({
      hero,
      enemy,
      attackRatio: hit?.attackRatio
    });

    if (critical && index === criticalHitIndex) {
      damage = Math.round(damage * ENEMY_CRIT_MULTIPLIER);
      log.template("critical", "critical", { actor: enemyName });
    }

    damage = applySteadyStance({ hero, damage, log });
    if (hit?.allowDirectDamageModifier !== false) {
      damage = applyDirectDamageModifier({
        hero,
        enemy,
        damage,
        damageSource,
        log,
        modifyDirectDamage,
        attackContext: {
          specialAttackId: specialAttack.id || null,
          hitIndex: index,
          hitLabel
        }
      });
    }

    applyEnemyDamageSegment({
      hero,
      enemyName,
      damage,
      log,
      attackLabel: `${specialName}・${hitLabel}`
    });
  });

  return damageSource;
}

function getEnemyDirectDamage({ hero, enemy, attackRatio = 1 }) {
  const ratio = Math.max(0, Number(attackRatio) || 0);
  const scaledAttack = (Number(enemy.attack) || 0) * ratio;
  const afterDefense = scaledAttack - (Number(hero.defense) || 0);
  return Math.max(
    1,
    Math.round(afterDefense * getParalysisDamageMultiplier(enemy))
  );
}

function applySteadyStance({ hero, damage, log }) {
  const steadyStance = getSteadyStance(hero);
  if (!(damage > 1 && steadyStance.enabled && roll(steadyStance.chance))) {
    return damage;
  }

  const reduced = Math.max(
    1,
    Math.min(damage - 1, Math.round(damage * steadyStance.reduction))
  );
  log.template("skill", "steadyStance", { actor: hero.name, amount: reduced });
  return damage - reduced;
}

function applyDirectDamageModifier({
  hero,
  enemy,
  damage,
  damageSource,
  log,
  modifyDirectDamage,
  attackContext = null
}) {
  if (typeof modifyDirectDamage !== "function") {
    return damage;
  }

  const modifiedDamage = modifyDirectDamage({
    hero,
    enemy,
    damage,
    damageSource,
    log,
    attackContext
  });
  return Number.isFinite(modifiedDamage)
    ? Math.max(0, Math.round(modifiedDamage))
    : damage;
}

function applyEnemyDamageSegment({ hero, enemyName, damage, log, attackLabel = null }) {
  let remainingDamage = Math.max(0, Math.round(Number(damage) || 0));
  const shieldBefore = Number(hero.shield) || 0;
  if (hero.shield > 0) {
    const blocked = Math.min(hero.shield, remainingDamage);
    hero.shield -= blocked;
    remainingDamage -= blocked;
    log.template("status", "block", { target: hero.name });
  }
  registerShieldDepletedByDirectAttack(hero, shieldBefore);

  hero.hp = Math.max(0, hero.hp - remainingDamage);
  if (attackLabel) {
    log.fixed(
      "enemy-damage",
      `${enemyName}的${attackLabel}命中${hero.name}，造成 ${remainingDamage} 點傷害。`
    );
    return;
  }
  log.template("enemy-damage", "enemyDamage", {
    actor: enemyName,
    target: hero.name,
    amount: remainingDamage
  });
}

function applyEnemyAttackStatusEffects({ hero, enemy, log }) {
  const enemyName = getEnemyDisplayName(enemy);
  if (enemy.poisonPower && hero.hp > 0) {
    hero.poison = Math.max(hero.poison || 0, enemy.poisonPower);
    log.template("status", "poisonApply", { target: hero.name });
  }

  if (enemy.entangleChance && hero.hp > 0 && !hero.entangle && roll(enemy.entangleChance)) {
    hero.entangle = { attempts: 0 };
    log.template("status", "entangleApply", { target: hero.name });
  }

  if (enemy.saltErosionChance && hero.hp > 0 && roll(enemy.saltErosionChance)) {
    applySaltErosion(hero, log);
  }

  if (enemy.paralysisChance && hero.hp > 0 && roll(enemy.paralysisChance)) {
    applyParalysis(hero, log);
  }

  return enemyName;
}

function getScheduledSpecialAttack(enemy, turn) {
  const specialAttack = enemy?.specialAttack;
  const everyTurns = Math.max(0, Math.floor(Number(specialAttack?.everyTurns) || 0));
  return everyTurns > 0 && turn % everyTurns === 0
    ? specialAttack
    : null;
}

function logUpcomingSpecialAttack({ enemy, turn, log }) {
  const specialAttack = enemy?.specialAttack;
  const everyTurns = Math.max(0, Math.floor(Number(specialAttack?.everyTurns) || 0));
  if (everyTurns <= 0 || (turn + 1) % everyTurns !== 0) {
    return;
  }

  const telegraphText = String(specialAttack.telegraphText || "").trim();
  if (telegraphText) {
    log.fixed("status", telegraphText);
  }
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
