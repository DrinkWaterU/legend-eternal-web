import { applyEnemyDefeatReactions } from "../../core/enemyReactions.js";
import { getLivingEnemies, getEnemyDisplayName, resolveTargetEnemyId } from "../../core/enemyGroups.js";
import {
  applyRewardsToInventory,
  mergeRewards,
  rollEnemyRewards
} from "../../core/rewards.js";
import { getHeroBattleHealingAmount } from "../../core/combatStatusEffects.js";
import { registerFrontlineDefeat } from "../../core/caveBlessingEffects.js";

export function createBattleSettlement({
  state,
  saveStore,
  counterEscapeHealRatio,
  addLog,
  addFixedLog,
  gainCharacterExp,
  recordEnemyDefeated,
  hasPhoenixBlessing,
  saveGameSafe,
  applyVictorySkills,
  consumeBattleLimitedEffects,
  render,
  showBlessings
}) {
  function getEnemyExpReward(enemy) {
    const baseReward = Number.isFinite(enemy.expReward)
      ? enemy.expReward
      : enemy.kind === "首領"
        ? 48
        : enemy.kind === "精英"
          ? 26
          : 9;
    const rewardScale = Number.isFinite(enemy.rewardScale) && enemy.rewardScale >= 0
      ? enemy.rewardScale
      : 1;
    return Math.max(1, Math.round(baseReward * rewardScale));
  }

  function awardEnemyRewards(enemy) {
    if (state.debugBuildRun || !hasPhoenixBlessing()) return;
    const rewards = rollEnemyRewards(enemy);
    state.runStats.rewards = mergeRewards(state.runStats.rewards, rewards);
    applyRewardsToInventory(saveStore.current.inventory, rewards);
    saveGameSafe();
  }

  function healHeroFromEnemyDefeat(amount) {
    const before = state.hero.hp;
    const effectiveAmount = getHeroBattleHealingAmount(state.hero, amount);
    state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + effectiveAmount);
    const healed = state.hero.hp - before;
    if (healed > 0) addLog("heal", "heal", { target: state.hero.name, amount: healed });
  }

  function applyLivingEnemyDefeatReactions(defeatedEnemy) {
    const reactions = applyEnemyDefeatReactions({ enemies: state.enemies, defeatedEnemy });
    reactions.forEach((reaction) => {
      if (reaction.type !== "bloodSacrifice") return;
      addFixedLog(
        "status",
        `${getEnemyDisplayName(reaction.source)}以${getEnemyDisplayName(reaction.defeatedEnemy)}的死亡完成血祭，氣息變得更加兇狠。`
      );
      if (reaction.healed > 0) {
        addLog("heal", "enemyRecover", {
          enemy: getEnemyDisplayName(reaction.source),
          amount: reaction.healed
        });
      }
    });
  }

  function settleEnemyDefeated(enemy) {
    const defeatedBoss = enemy.kind === "首領";
    const hpRatioBeforeKillRewards = state.hero.maxHp > 0 ? state.hero.hp / state.hero.maxHp : 0;
    addLog("system", "enemyDefeated", { target: getEnemyDisplayName(enemy) });
    gainCharacterExp(getEnemyExpReward(enemy));
    awardEnemyRewards(enemy);
    recordEnemyDefeated(defeatedBoss, enemy);
    state.defeatedEnemies += 1;
    state.defeatedBoss = state.defeatedBoss || defeatedBoss;
    applyLivingEnemyDefeatReactions(enemy);
    if (registerFrontlineDefeat(state.hero, enemy)) {
      addFixedLog("status", `${state.hero.name}擊破前衛，本場攻擊提高 ${state.hero.frontlineBreakAttack}。`);
    }

    if (state.hero.killAttackGain > 0) {
      state.hero.battleAttackBonus = (state.hero.battleAttackBonus || 0) + state.hero.killAttackGain;
      addFixedLog("status", `${state.hero.name}趁著混亂，本場攻擊提高 ${state.hero.killAttackGain}。`);
    }
    if (hpRatioBeforeKillRewards < 0.5 && state.hero.lowHpKillHeal > 0) healHeroFromEnemyDefeat(state.hero.lowHpKillHeal);
    if (state.hero.killHeal > 0) healHeroFromEnemyDefeat(state.hero.killHeal);
    if (state.hero.killHealRatio > 0) {
      healHeroFromEnemyDefeat(Math.max(1, Math.round(state.hero.maxHp * state.hero.killHealRatio)));
    }
  }

  function settleDefeatedEnemies() {
    const defeatedEnemies = state.enemies.filter((enemy) => enemy && enemy.hp <= 0);
    defeatedEnemies.forEach(settleEnemyDefeated);
    if (defeatedEnemies.length === 0) return 0;
    state.enemies = getLivingEnemies(state.enemies);
    state.targetEnemyId = resolveTargetEnemyId(state.enemies, state.targetEnemyId);
    return defeatedEnemies.length;
  }

  function settleBattleVictory() {
    addLog("system", "battleVictory");
    applyVictorySkills();
    consumeBattleLimitedEffects();
  }

  function finishCounterEncounterVictory() {
    const amount = Math.max(1, Math.round(state.hero.maxHp * counterEscapeHealRatio));
    const before = state.hero.hp;
    state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + amount);
    const healed = state.hero.hp - before;
    if (healed > 0) addFixedLog("heal", `你從反制戰中穩住呼吸，恢復了 ${healed} 點生命。`);
    render();
    showBlessings("counterEscape");
  }

  return Object.freeze({
    settleDefeatedEnemies,
    settleBattleVictory,
    finishCounterEncounterVictory,
    getEnemyExpReward
  });
}
