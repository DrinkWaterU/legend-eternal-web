import {
  applyEnemyDamageProtection,
  getHeroAttackDamageMultiplier,
  getHeroDirectAttackDamage,
  resolveHeroStrike
} from "../../../core/combat.js";
import { getEnemyDisplayName, getLivingEnemies, resolveTargetEnemy } from "../../../core/enemyGroups.js";
import { roll } from "../../../utils.js";

const PRECISION_ATTACK_INTERVAL = 3;
const PRECISION_CRIT_BONUS = 0.4;
const TOXIC_OPENING_CRIT_BONUS = 0.1;
const VENOMOUS_TOXIC_OPENING_CRIT_BONUS = 0.2;
const FOLLOW_UP_DAMAGE_RATIO = 0.7;
const FOLLOW_UP_CHANCE = 0.35;
const FOLLOW_UP_PLUS_CHANCE = 0.55;
const HUNDRED_STEP_FOLLOW_UP_CHANCE = 0.8;
const ARROW_RAIN_ATTACK_INTERVAL = 4;
const ARROW_RAIN_DAMAGE_RATIO = 0.5;
const DENSE_ARROW_RAIN_DAMAGE_RATIO = 0.85;
const POISON_ARROW_CHANCE = 0.25;
const POISON_ARROW_POWER = 3;
const VENOMOUS_ARROW_CHANCE = 0.5;
const VENOMOUS_ARROW_POWER = 6;
const KEEP_DISTANCE_MAX_CHARGES = 2;
const DISTANCE_CONTROL_MAX_CHARGES = 3;

export function initializeBattleState({ hero }) {
  const runtime = getRuntime(hero);
  runtime.playerAttackCount = 0;
  runtime.keepDistanceCharges = hasSkill(hero, "distance-control")
    ? DISTANCE_CONTROL_MAX_CHARGES
    : hasSkill(hero, "keep-distance")
      ? KEEP_DISTANCE_MAX_CHARGES
      : 0;
}

export function resolvePlayerAction({ hero, enemies, targetEnemyId, log }) {
  const target = resolveTargetEnemy(enemies, targetEnemyId);
  if (!target) {
    return { handled: true };
  }

  const originalShot = resolveShot({ hero, enemies, target, log, kind: "original" });
  if (!originalShot.critical || target.hp <= 0 || !hasSkill(hero, "archer-follow-up")) {
    return { handled: true };
  }

  const followUpChance = originalShot.precision && hasSkill(hero, "hundred-step-shot")
    ? HUNDRED_STEP_FOLLOW_UP_CHANCE
    : hasSkill(hero, "archer-follow-up-plus")
      ? FOLLOW_UP_PLUS_CHANCE
      : FOLLOW_UP_CHANCE;
  if (!roll(followUpChance)) {
    return { handled: true };
  }

  log.fixed("skill", `${hero.name} 抓住爆擊留下的破綻，立刻補上一箭。`);
  const firstFollowUp = resolveShot({ hero, enemies, target, log, kind: "followUp" });
  if (
    firstFollowUp.critical
    && target.hp > 0
    && hasSkill(hero, "deadly-rhythm")
  ) {
    log.fixed("skill", `${hero.name} 延續致命節奏，再次追擊。`);
    resolveShot({ hero, enemies, target, log, kind: "secondFollowUp" });
  }

  return { handled: true };
}

export function modifyIncomingDirectDamage({ hero, damage, log }) {
  const runtime = getRuntime(hero);
  if (runtime.keepDistanceCharges <= 0) {
    return damage;
  }

  runtime.keepDistanceCharges -= 1;
  const message = hasSkill(hero, "distance-control")
    ? `${hero.name} 掌控距離，讓攻擊只擦身而過。`
    : `${hero.name} 保持距離，讓攻擊只擦身而過。`;
  log.fixed("skill", message);
  return 1;
}

export function getStatusEntries(hero) {
  const charges = Math.max(0, Number(getRuntime(hero).keepDistanceCharges) || 0);
  return charges > 0
    ? [{ label: `保持距離 ${charges}`, className: "is-normal" }]
    : [];
}

function resolveShot({ hero, enemies, target, log, kind }) {
  const runtime = getRuntime(hero);
  runtime.playerAttackCount += 1;
  const precision = hasSkill(hero, "precision-shot")
    && runtime.playerAttackCount % PRECISION_ATTACK_INTERVAL === 0;
  const poisonedAtShotStart = target.poison > 0;
  const critChanceBonus = (precision ? PRECISION_CRIT_BONUS : 0)
    + (
      poisonedAtShotStart && hasSkill(hero, "toxic-opening")
        ? hasSkill(hero, "venomous-arrowhead")
          ? VENOMOUS_TOXIC_OPENING_CRIT_BONUS
          : TOXIC_OPENING_CRIT_BONUS
        : 0
    );
  if (precision) {
    log.fixed("skill", `${hero.name} 校準呼吸，射出精準一箭。`);
  }

  const result = resolveHeroStrike({
    hero,
    enemy: target,
    enemies,
    log,
    options: {
      critChanceBonus,
      damageMultiplier: kind === "original" ? 1 : FOLLOW_UP_DAMAGE_RATIO,
      allowHeavyStrike: false
    }
  });

  if (!result.dodged && target.hp > 0) {
    tryApplyPoisonArrow({ hero, enemy: target, log });
  }

  if (hasSkill(hero, "arrow-rain") && runtime.playerAttackCount >= ARROW_RAIN_ATTACK_INTERVAL) {
    runtime.playerAttackCount = 0;
    resolveArrowRain({ hero, enemies, log });
    restoreDistanceChargeAfterArrowRain(hero);
  }

  return {
    ...result,
    precision
  };
}

function tryApplyPoisonArrow({ hero, enemy, log }) {
  if (!hasSkill(hero, "poison-arrow")) {
    return;
  }
  const enhanced = hasSkill(hero, "venomous-arrowhead");
  const chance = enhanced ? VENOMOUS_ARROW_CHANCE : POISON_ARROW_CHANCE;
  const power = enhanced ? VENOMOUS_ARROW_POWER : POISON_ARROW_POWER;
  if (!roll(chance)) {
    return;
  }
  enemy.poison = Math.max(enemy.poison || 0, power);
  log.fixed("status", `${getEnemyDisplayName(enemy)} 被淬毒箭命中，中毒了。`);
}

function resolveArrowRain({ hero, enemies, log }) {
  const livingEnemies = getLivingEnemies(enemies);
  if (livingEnemies.length === 0) {
    return;
  }
  const damageRatio = hasSkill(hero, "dense-arrow-rain")
    ? DENSE_ARROW_RAIN_DAMAGE_RATIO
    : ARROW_RAIN_DAMAGE_RATIO;
  const attackMultiplier = getHeroAttackDamageMultiplier(hero, log);
  log.fixed("skill", `${hero.name} 射出箭雨。`);
  livingEnemies.forEach((enemy) => {
    const rawDamage = getHeroDirectAttackDamage({
      hero,
      enemy,
      damageMultiplier: damageRatio,
      attackMultiplier
    });
    const damage = applyEnemyDamageProtection({ enemy, enemies, damage: rawDamage }).damage;
    enemy.hp = Math.max(0, enemy.hp - damage);
    log.fixed("hero-damage", `箭雨命中${getEnemyDisplayName(enemy)}，造成 ${damage} 點傷害。`);
  });
}

function restoreDistanceChargeAfterArrowRain(hero) {
  if (!hasSkill(hero, "keep-distance")) {
    return;
  }
  const runtime = getRuntime(hero);
  const maxCharges = hasSkill(hero, "distance-control")
    ? DISTANCE_CONTROL_MAX_CHARGES
    : KEEP_DISTANCE_MAX_CHARGES;
  runtime.keepDistanceCharges = Math.min(
    maxCharges,
    runtime.keepDistanceCharges + 1
  );
}

function getRuntime(hero) {
  hero.skillState ??= {};
  hero.skillState.archer ??= {
    playerAttackCount: 0,
    keepDistanceCharges: 0
  };
  return hero.skillState.archer;
}

function hasSkill(hero, skillId) {
  return Array.isArray(hero?.skills) && hero.skills.includes(skillId);
}
