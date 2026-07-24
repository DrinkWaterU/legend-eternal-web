import {
  getHeroBattleHealingAmount,
  getHeroDirectAttackDamage,
  resolveHeroStrike
} from "../../../core/combat.js";
import { getEnemyDisplayName, getLivingEnemies, resolveTargetEnemy } from "../../../core/enemyGroups.js";

const FURY_MAX = 3;
const FINISHER_MULTIPLIER = 1.5;
const FINISHER_PLUS_MULTIPLIER = 1.75;
const SWEEP_MULTIPLIER = 0.4;
const SWEEP_PLUS_MULTIPLIER = 0.6;
const FINISHER_HEAL_RATIO = 0.08;
const FINISHER_HEAL_PLUS_RATIO = 0.1;
const FINISHER_HEAL_CAP_RATIO = 0.7;

export function initializeBattleState({ hero }) {
  const runtime = getRuntime(hero);
  runtime.fury = 0;
  runtime.appliedAttackBonus = 0;
  runtime.changeToken = 0;
  runtime.changeKind = null;

  if (!hasSkill(hero, "adversity-fury")) {
    return;
  }
  const hpRatio = hero.maxHp > 0 ? hero.hp / hero.maxHp : 1;
  const openingFury = hpRatio <= 0.25 ? 2 : hpRatio <= 0.5 ? 1 : 0;
  if (openingFury > 0) {
    setFury(hero, openingFury, "gain");
  }
}

export function resolvePlayerAction({ hero, enemies, targetEnemyId, log }) {
  const target = resolveTargetEnemy(enemies, targetEnemyId);
  if (!target) {
    return { handled: true };
  }

  const runtime = getRuntime(hero);
  const finisher = hasSkill(hero, "formation-breaking-cleave") && runtime.fury >= FURY_MAX;
  const result = resolveHeroStrike({
    hero,
    enemy: target,
    enemies,
    log,
    options: {
      damageMultiplier: finisher
        ? hasSkill(hero, "cleave-mastery")
          ? FINISHER_PLUS_MULTIPLIER
          : FINISHER_MULTIPLIER
        : 1,
      allowHeavyStrike: false
    }
  });

  if (!finisher) {
    return { handled: true };
  }

  if (!result.dodged) {
    log.fixed("skill", `${hero.name} 將戰意灌入斧刃，揮出破陣重斬。`);
    applySweep({ hero, enemies, target, log });
    applyFinisherHealing(hero, log);
  }
  const consumed = hasSkill(hero, "battle-without-end") ? 2 : runtime.fury;
  setFury(hero, Math.max(0, runtime.fury - consumed), "consume");
  return { handled: true };
}

export function modifyIncomingDirectDamage({ hero, damage }) {
  if (!hasSkill(hero, "battle-fury")) {
    return damage;
  }
  const hpRatio = hero.maxHp > 0 ? hero.hp / hero.maxHp : 1;
  const gain = hasSkill(hero, "berserker-heart") && hpRatio <= 0.5 ? 2 : 1;
  const runtime = getRuntime(hero);
  setFury(hero, Math.min(FURY_MAX, runtime.fury + gain), "gain");
  return damage;
}

export function getStatusEntries(hero) {
  if (!hasSkill(hero, "battle-fury")) {
    return [];
  }
  const runtime = getRuntime(hero);
  const finisherReady = hasSkill(hero, "formation-breaking-cleave");
  const fullHint = finisherReady
    ? "下一擊：破陣重斬"
    : `攻擊 +${runtime.fury}`;
  return [{
    id: "kaige-fury",
    kind: "fury",
    label: runtime.fury >= FURY_MAX
      ? `戰意已滿｜${fullHint}`
      : `戰意 ${runtime.fury}／${FURY_MAX}`,
    className: runtime.fury >= FURY_MAX ? "is-fury is-full" : "is-fury",
    current: runtime.fury,
    max: FURY_MAX,
    fullHint,
    changeToken: runtime.changeToken,
    changeKind: runtime.changeKind
  }];
}

function applySweep({ hero, enemies, target, log }) {
  if (!hasSkill(hero, "spinning-axe-sweep")) {
    return;
  }
  const multiplier = hasSkill(hero, "cleave-mastery")
    ? SWEEP_PLUS_MULTIPLIER
    : SWEEP_MULTIPLIER;
  getLivingEnemies(enemies)
    .filter((enemy) => enemy.runtimeId !== target.runtimeId)
    .forEach((enemy) => {
      const damage = getHeroDirectAttackDamage({
        hero,
        enemy,
        damageMultiplier: multiplier
      });
      enemy.hp = Math.max(0, enemy.hp - damage);
      log.fixed(
        "hero-damage",
        `旋斧橫掃命中${getEnemyDisplayName(enemy)}，造成 ${damage} 點傷害。`
      );
    });
}

function applyFinisherHealing(hero, log) {
  if (!hasSkill(hero, "blood-soaked-fight") || hero.hp <= 0) {
    return;
  }
  const ratio = hasSkill(hero, "unyielding-fighting-spirit")
    ? FINISHER_HEAL_PLUS_RATIO
    : FINISHER_HEAL_RATIO;
  const cap = Math.floor(hero.maxHp * FINISHER_HEAL_CAP_RATIO);
  if (hero.hp >= cap) {
    return;
  }
  const effectiveAmount = getHeroBattleHealingAmount(hero, hero.maxHp * ratio, { minimum: 1 });
  const before = hero.hp;
  hero.hp = Math.min(cap, hero.hp + effectiveAmount);
  const healed = hero.hp - before;
  if (healed > 0) {
    log.fixed("heal", `${hero.name}藉著浴血奮戰恢復 ${healed} 點生命。`);
  }
}

function setFury(hero, nextFury, changeKind) {
  const runtime = getRuntime(hero);
  const previous = runtime.fury;
  const next = Math.max(0, Math.min(FURY_MAX, Math.floor(Number(nextFury) || 0)));
  if (previous === next) {
    return;
  }
  hero.battleAttackBonus = (Number(hero.battleAttackBonus) || 0)
    - runtime.appliedAttackBonus
    + next;
  runtime.fury = next;
  runtime.appliedAttackBonus = next;
  runtime.changeToken += 1;
  runtime.changeKind = changeKind === "consume"
    ? "consume"
    : next >= FURY_MAX
      ? "full"
      : "gain";
}

function getRuntime(hero) {
  hero.skillState ??= {};
  hero.skillState.kaige ??= {
    fury: 0,
    appliedAttackBonus: 0,
    changeToken: 0,
    changeKind: null
  };
  return hero.skillState.kaige;
}

function hasSkill(hero, skillId) {
  return Array.isArray(hero?.skills) && hero.skills.includes(skillId);
}
