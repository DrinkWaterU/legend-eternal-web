import { clone, randomItem, roll, weightedRandomItem } from "../utils.js";

const DEFAULT_ENEMY_WEIGHT = 100;
const DEFAULT_CHARGE_MULTIPLIER = 1.6;
const HEAVY_STRIKE_CHANCE = 0.2;
const HEAVY_STRIKE_MULTIPLIER = 1.4;
const STEADY_STANCE_CHANCE = 0.25;
const STEADY_STANCE_REDUCTION = 0.3;
const STEADY_STANCE_PLUS_CHANCE = 0.3;
const STEADY_STANCE_PLUS_REDUCTION = 0.35;
const FOLLOW_UP_CHANCE = 0.25;
const FOLLOW_UP_ATTACK_RATIO = 0.5;
const ENTANGLE_ESCAPE_CHANCES = [0.45, 0.7, 0.9, 1];
const STATUS_FAMILIARITY_MAX_STACKS = 3;

export function buildEnemy(region, encounterIndex, hero, options = {}) {
  const encounterType = region.encounterPlan[encounterIndex];
  const base = encounterType === "boss"
    ? options.boss || region.boss
    : encounterType === "elite"
      ? pickEnemy(region.elites, hero, "elite")
      : pickEnemy(region.enemies, hero, "normal");
  const enemy = clone(base);
  const scaling = region.scaling || {};
  const hpScale = 1 + encounterIndex * (Number(scaling.hpPerEncounter) || 0.08);
  const attackScale = 1 + encounterIndex * (Number(scaling.attackPerEncounter) || 0.08);
  enemy.maxHp = Math.round(enemy.maxHp * hpScale);
  enemy.hp = enemy.maxHp;
  enemy.attack = Math.round(enemy.attack * attackScale);
  return enemy;
}

function pickEnemy(enemies, hero, encounterType) {
  const activeBiases = getActiveEncounterBiases(hero, encounterType);
  const guaranteeBias = activeBiases.find((bias) => shouldGuaranteeFamily(enemies, bias, encounterType));
  const selected = guaranteeBias
    ? randomItem(enemies.filter((enemy) => hasBiasedFamily(enemy, guaranteeBias)))
    : weightedRandomItem(enemies, (enemy) => getBiasedEnemyWeight(enemy, activeBiases, encounterType));

  updateEncounterBiases(hero, encounterType, selected);
  return selected;
}

function getActiveEncounterBiases(hero, encounterType) {
  if (!hero || !Array.isArray(hero.encounterBiases)) {
    return [];
  }

  return hero.encounterBiases.filter((bias) => {
    const mode = bias[encounterType];
    return mode && mode.remaining > 0;
  });
}

function shouldGuaranteeFamily(enemies, bias, encounterType) {
  const mode = bias[encounterType];
  return Boolean(
    mode.guaranteeAfter
    && mode.misses + 1 >= mode.guaranteeAfter
    && enemies.some((enemy) => hasBiasedFamily(enemy, bias))
  );
}

function getBiasedEnemyWeight(enemy, activeBiases, encounterType) {
  const baseWeight = Number(enemy.weight) || DEFAULT_ENEMY_WEIGHT;
  return activeBiases.reduce((weight, bias) => {
    if (!hasBiasedFamily(enemy, bias)) {
      return weight;
    }
    return weight + (Number(bias[encounterType].bonusWeight) || 0);
  }, baseWeight);
}

function updateEncounterBiases(hero, encounterType, selectedEnemy) {
  if (!hero || !Array.isArray(hero.encounterBiases)) {
    return;
  }

  hero.encounterBiases.forEach((bias) => {
    const mode = bias[encounterType];
    if (!mode || mode.remaining <= 0) {
      return;
    }

    mode.remaining -= 1;
    mode.misses = hasBiasedFamily(selectedEnemy, bias) ? 0 : mode.misses + 1;
  });

  hero.encounterBiases = hero.encounterBiases.filter((bias) => {
    return ["normal", "elite"].some((type) => bias[type] && bias[type].remaining > 0);
  });
}

function hasBiasedFamily(enemy, bias) {
  const families = Array.isArray(bias.families) ? bias.families : [bias.family];
  return families.includes(enemy.family);
}

export function resolveHeroEntangle({ hero, log }) {
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

  hero.entangle.attempts = attempts + 1;
  log.template("status", "entangleHold", { target: hero.name });
  return true;
}

export function resolveHeroAction({ hero, enemy, log }) {
  if (enemy.dodgeChance && roll(enemy.dodgeChance)) {
    log.fixed("status", `${enemy.name} 閃開了攻擊。`);
    return;
  }

  let damage = Math.max(1, getHeroAttack(hero) - enemy.defense);
  if (hasSkill(hero, "heavy-strike") && roll(HEAVY_STRIKE_CHANCE)) {
    damage = Math.max(1, Math.round(damage * HEAVY_STRIKE_MULTIPLIER));
    log.template("skill", "heavyStrike", { actor: hero.name });
  }
  const familyBonus = getFamilyDamageBonus(hero, enemy.family);
  if (familyBonus > 0) {
    damage = Math.round(damage * (1 + familyBonus));
  }
  const critChance = hero.critChance
    + (hero.battleCritBonus || 0)
    + (enemy.poison > 0 ? hero.poisonedCritChance || 0 : 0);
  if (roll(critChance)) {
    damage = Math.round(damage * (hero.critDamageMultiplier || 1.7));
    log.template("critical", "critical", { actor: hero.name });
  }

  enemy.hp = Math.max(0, enemy.hp - damage);
  log.template("hero-damage", "heroDamage", {
    actor: hero.name,
    target: enemy.name,
    amount: damage
  });

  if (enemy.hp > 0 && hasSkill(hero, "skilled-follow-up") && roll(FOLLOW_UP_CHANCE)) {
    const followUpDamage = Math.max(1, Math.round(hero.attack * FOLLOW_UP_ATTACK_RATIO));
    enemy.hp = Math.max(0, enemy.hp - followUpDamage);
    log.template("hero-damage", "skilledFollowUp", {
      actor: hero.name,
      target: enemy.name,
      amount: followUpDamage
    });
  }

  if (hero.poisonPower > 0 && enemy.hp > 0) {
    enemy.poison = Math.max(enemy.poison || 0, hero.poisonPower);
    log.template("status", "poisonApply", { target: enemy.name });
    applyStatusFamiliarity(hero, log);
  }
}

export function resolveEnemyAction({ hero, enemy, turn, log }) {
  let damage = Math.max(1, enemy.attack - hero.defense);
  const damageSource = {
    type: "attack",
    label: `${enemy.name}的攻擊`
  };

  if (enemy.chargeEvery && turn % enemy.chargeEvery === 0) {
    log.template("status", "charge", { actor: enemy.name });
    damage = Math.round(damage * (enemy.chargeMultiplier || DEFAULT_CHARGE_MULTIPLIER));
    damageSource.type = "charge";
    damageSource.label = `${enemy.name}的衝鋒`;
  }

  if (roll(enemy.critChance || 0)) {
    damage = Math.round(damage * 1.6);
    log.template("critical", "critical", { actor: enemy.name });
    damageSource.type = damageSource.type === "charge" ? "chargeCritical" : "critical";
    damageSource.label = damageSource.type === "chargeCritical"
      ? `${enemy.name}的衝鋒暴擊`
      : `${enemy.name}的暴擊`;
  }

  const steadyStance = getSteadyStance(hero);
  if (damage > 1 && steadyStance.enabled && roll(steadyStance.chance)) {
    const reduced = Math.max(1, Math.min(damage - 1, Math.round(damage * steadyStance.reduction)));
    damage -= reduced;
    log.template("skill", "steadyStance", { actor: hero.name, amount: reduced });
  }

  if (hero.shield > 0) {
    const blocked = Math.min(hero.shield, damage);
    hero.shield -= blocked;
    damage -= blocked;
    log.template("status", "block", { target: hero.name });
  }

  hero.hp = Math.max(0, hero.hp - damage);
  log.template("enemy-damage", "enemyDamage", {
    actor: enemy.name,
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

function hasSkill(hero, skillId) {
  return Array.isArray(hero.skills) && hero.skills.includes(skillId);
}

function getFamilyDamageBonus(hero, family) {
  const familyDamageBonus = hero.familyDamageBonus || {};
  const legacySlimeBonus = family === "slime" ? hero.slimeBonus || 0 : 0;
  return (familyDamageBonus[family] || 0) + legacySlimeBonus;
}

function getHeroAttack(hero) {
  return hero.attack + (hero.battleAttackBonus || 0);
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

export function applyEndOfTurnEffects({ hero, enemy, turn, log }) {
  let heroDeathCause = null;

  if (hero.poison > 0) {
    const poisonDamage = Math.max(1, Math.round(hero.poison * (1 - hero.damageReduction)));
    hero.hp = Math.max(0, hero.hp - poisonDamage);
    log.template("enemy-damage", "poisonTick", { target: hero.name, amount: poisonDamage });
    if (hero.hp <= 0) {
      heroDeathCause = {
        type: "poison",
        label: "中毒"
      };
    }
  }

  if (enemy.poison > 0) {
    enemy.hp = Math.max(0, enemy.hp - enemy.poison);
    log.template("hero-damage", "poisonTick", { target: enemy.name, amount: enemy.poison });
  }

  if (hero.regenEvery > 0 && turn % hero.regenEvery === 0 && hero.hp > 0) {
    hero.hp = Math.min(hero.maxHp, hero.hp + hero.regenAmount);
    log.template("heal", "heal", { target: hero.name, amount: hero.regenAmount });
  }

  if (enemy.regenEvery > 0 && turn % enemy.regenEvery === 0 && enemy.hp > 0) {
    enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.regenAmount);
    log.template("heal", "heal", { target: enemy.name, amount: enemy.regenAmount });
  }

  return { heroDeathCause };
}
