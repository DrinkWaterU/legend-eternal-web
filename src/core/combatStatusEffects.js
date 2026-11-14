import { getEnemyDisplayName } from "./enemyGroups.js";
import { applyEnemyDamageProtection } from "./enemyProtection.js";
import { previewPreparationPoisonDamage, resolvePreparationSaltErosionInitialTurns } from "./preparationEffects.js";

const SALT_EROSION_INITIAL_TURNS = 5;
const SALT_EROSION_MAX_TURNS = 7;
const PARALYSIS_INITIAL_TURNS = 2;
const PARALYSIS_MAX_TURNS = 3;
const DEFAULT_SALT_HEALING_REDUCTION = 0.3;
const PERIODIC_RECOVERY_LIMIT = 4;

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

// 回合結束時「確定會發生」的生命變化：中毒與週期回復。只看目前已有的狀態，
// 不含敵人攻擊（有暴擊、減傷等變數）與本回合才會被施加的效果。
// 計算順序必須與 applyHeroEndOfTurnNegativeEffects → applyHeroEndOfTurnRecoveryEffects 相同。
export function getHeroTurnForecast(hero, completedTurn = 0) {
  const empty = { loss: 0, gain: 0, hpAfter: Math.max(0, Number(hero?.hp) || 0) };
  if (!hero || !(hero.hp > 0)) return empty;
  let hp = hero.hp;
  const loss = Math.min(hp, previewPreparationPoisonDamage({
    preparation: hero.activePreparation,
    damage: getHeroPendingHpLoss(hero)
  }));
  hp -= loss;
  let gain = 0;
  if (hp > 0) {
    const turn = Math.max(0, Math.floor(Number(completedTurn) || 0)) + 1;
    const recover = (requested, key) => {
      if (!canUsePeriodicRecovery(hero, key)) return;
      const amount = Math.min(hero.maxHp - hp, getHeroBattleHealingAmount(hero, requested));
      if (amount > 0) { hp += amount; gain += amount; }
    };
    if (hero.regenEvery > 0 && turn % hero.regenEvery === 0) recover(hero.regenAmount, "base");
    (Array.isArray(hero.periodicRegens) ? hero.periodicRegens : []).forEach((effect) => {
      if (effect.everyTurns > 0 && turn % effect.everyTurns === 0) recover(effect.amount, `periodic:${effect.id}`);
    });
    (Array.isArray(hero.timedRegens) ? hero.timedRegens : []).forEach((effect, index) => {
      if (effect.remainingEncounters > 0 && effect.everyTurns > 0 && turn % effect.everyTurns === 0) {
        recover(Math.max(1, Math.round(hero.maxHp * effect.maxHpRatio)), `timed:${effect.id || index}`);
      }
    });
  }
  return { loss, gain, hpAfter: hp };
}

// 敵人版：中毒會先扣前衛保護的減傷，再看下回合是否輪到自我回復。
export function getEnemyTurnForecast(enemy, enemies = [], completedTurn = 0) {
  const empty = { loss: 0, gain: 0, hpAfter: Math.max(0, Number(enemy?.hp) || 0) };
  if (!enemy || !(enemy.hp > 0)) return empty;
  const poison = getEnemyPendingHpLoss(enemy);
  const loss = poison > 0
    ? Math.min(enemy.hp, applyEnemyDamageProtection({ enemy, enemies, damage: poison }).damage)
    : 0;
  let hp = enemy.hp - loss;
  let gain = 0;
  const turn = Math.max(0, Math.floor(Number(completedTurn) || 0)) + 1;
  if (hp > 0 && enemy.regenEvery > 0 && turn % enemy.regenEvery === 0) {
    gain = Math.max(0, Math.min(enemy.maxHp - hp, Number(enemy.regenAmount) || 0));
    hp += gain;
  }
  return { loss, gain, hpAfter: hp };
}

export function describeTurnForecast({ loss, gain, hpAfter }) {
  const parts = [];
  if (loss > 0) parts.push(`中毒 -${loss}`);
  if (gain > 0) parts.push(`回復 +${gain}`);
  return parts.length ? `回合結束：${parts.join("、")} → ${hpAfter}` : "";
}

export function applyEnemyPoisonDamage({ enemy, enemies = [] }) {
  const poisonDamage = getEnemyPendingHpLoss(enemy);
  if (poisonDamage <= 0) {
    return 0;
  }
  const effectiveDamage = applyEnemyDamageProtection({
    enemy,
    enemies,
    damage: poisonDamage
  }).damage;
  enemy.hp = Math.max(0, enemy.hp - effectiveDamage);
  return effectiveDamage;
}

export function applySaltErosion(hero, log) {
  if (!hero) return 0;
  const currentTurns = Math.max(0, Number(hero.saltErosion?.remainingTurns) || 0);
  const initialTurnsResult = currentTurns > 0
    ? { triggered: false, turns: SALT_EROSION_INITIAL_TURNS }
    : resolvePreparationSaltErosionInitialTurns({
      preparation: hero.activePreparation,
      turns: SALT_EROSION_INITIAL_TURNS
    });
  const remainingTurns = Math.min(
    SALT_EROSION_MAX_TURNS,
    currentTurns > 0 ? currentTurns + 1 : initialTurnsResult.turns
  );
  hero.saltErosion = { remainingTurns };
  if (initialTurnsResult.triggered) {
    const preparationName = hero.activePreparation?.name || "冒險整備";
    log?.fixed?.("status", `整備｜${preparationName}減緩鹽蝕，使初始持續時間縮短 ${initialTurnsResult.turnsReduced} 回合。`);
  }
  log?.fixed?.("status", `${hero.name} 受到鹽蝕，戰鬥中的治療效果降低。`);
  return remainingTurns;
}

export function applyParalysis(target, log) {
  if (!target) return 0;
  const currentTurns = Math.max(0, Number(target.paralysis?.remainingTurns) || 0);
  const remainingTurns = Math.min(
    PARALYSIS_MAX_TURNS,
    currentTurns > 0 ? currentTurns + 1 : PARALYSIS_INITIAL_TURNS
  );
  target.paralysis = { remainingTurns };
  log?.fixed?.("status", `${target.name} 陷入麻痺，接下來的攻擊可能變弱。`);
  return remainingTurns;
}

export function advanceHeroCombatStatuses(hero) {
  if (!hero) return;
  ["saltErosion", "paralysis"].forEach((statusId) => {
    advanceCombatStatus(hero, statusId);
  });
}

export function advanceParalysis(target) {
  advanceCombatStatus(target, "paralysis");
}

export function getParalysisDamageMultiplier(target, random = Math.random) {
  return Number(target?.paralysis?.remainingTurns) > 0 && random() < 0.5 ? 0.8 : 1;
}

function advanceCombatStatus(target, statusId) {
  const status = target?.[statusId];
  if (!status) return;
  status.remainingTurns = Math.max(0, (Number(status.remainingTurns) || 0) - 1);
  if (status.remainingTurns <= 0) target[statusId] = null;
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

export function applyEnemyEndOfTurnNegativeEffects({ enemy, enemies = [], log }) {
  const effectiveDamage = applyEnemyPoisonDamage({ enemy, enemies });
  if (effectiveDamage <= 0) {
    return;
  }
  log.template("hero-damage", "poisonTick", {
    target: getEnemyDisplayName(enemy),
    amount: effectiveDamage
  });
}

export function applyHeroEndOfTurnRecoveryEffects({ hero, turn, log }) {
  if (hero.regenEvery > 0 && turn % hero.regenEvery === 0 && hero.hp > 0
      && canUsePeriodicRecovery(hero, "base")) {
    const amount = applyHeroBattleHealing(hero, hero.regenAmount);
    if (amount > 0) {
      recordPeriodicRecovery(hero, "base");
      log.template("heal", "heal", { target: hero.name, amount });
    }
  }
  applyPeriodicRegens(hero, turn, log);
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

function applyPeriodicRegens(hero, turn, log) {
  if (!Array.isArray(hero.periodicRegens) || hero.hp <= 0) return;
  hero.periodicRegens.forEach((effect) => {
    const key = `periodic:${effect.id}`;
    if (effect.everyTurns <= 0 || turn % effect.everyTurns !== 0 || !canUsePeriodicRecovery(hero, key)) return;
    const amount = applyHeroBattleHealing(hero, effect.amount);
    if (amount > 0) {
      recordPeriodicRecovery(hero, key);
      log.template("heal", "heal", { target: hero.name, amount });
    }
  });
}

function applyTimedRegens(hero, turn, log) {
  if (!Array.isArray(hero.timedRegens) || hero.hp <= 0) {
    return;
  }
  hero.timedRegens.forEach((effect, index) => {
    const key = `timed:${effect.id || index}`;
    if (effect.remainingEncounters <= 0 || effect.everyTurns <= 0 || turn % effect.everyTurns !== 0
        || !canUsePeriodicRecovery(hero, key)) {
      return;
    }
    const amount = applyHeroBattleHealing(hero, Math.max(1, Math.round(hero.maxHp * effect.maxHpRatio)));
    if (amount > 0) {
      recordPeriodicRecovery(hero, key);
      log.template("heal", "timedRegen", {
        source: effect.source,
        target: hero.name,
        amount
      });
    }
  });
}

function periodicRecoveryCounts(hero) {
  hero.blessingBattleState ??= {};
  hero.blessingBattleState.periodicRecoveryCounts ??= {};
  return hero.blessingBattleState.periodicRecoveryCounts;
}

function canUsePeriodicRecovery(hero, key) {
  return (Number(periodicRecoveryCounts(hero)[key]) || 0) < PERIODIC_RECOVERY_LIMIT;
}

function recordPeriodicRecovery(hero, key) {
  const counts = periodicRecoveryCounts(hero);
  counts[key] = (Number(counts[key]) || 0) + 1;
}
