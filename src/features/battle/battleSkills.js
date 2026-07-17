import { getBlessingFlowDefinitions } from "../../data/blessingFlows.js";
import { weightedRandomItem } from "../../utils.js";

const VERSATILE_SATCHEL_EFFECT_HANDLERS = Object.freeze({
  battle_attack(hero) {
    hero.battleAttackBonus = (hero.battleAttackBonus || 0) + 1;
    return "攻擊 +1";
  },
  battle_shield(hero) {
    const amount = 6;
    hero.shield = (hero.shield || 0) + amount;
    return `護盾 +${amount}`;
  },
  battle_crit(hero) {
    hero.battleCritBonus = (hero.battleCritBonus || 0) + 0.03;
    return "暴擊率 +3%";
  },
  status_familiarity(hero) {
    hero.statusFamiliarityLimitBonus = (hero.statusFamiliarityLimitBonus || 0) + 1;
    return "狀態判讀上限 +1";
  },
  victory_heal(hero) {
    hero.victoryHealBonusRatio = (hero.victoryHealBonusRatio || 0) + 0.03;
    return "勝利恢復 +3%";
  }
});

export function createBattleSkills({
  state,
  hasHeroSkill,
  addLog,
  addFixedLog,
  lastBagFlowWeightMultiplier
}) {
  function hasBlessingFlow(flow) {
    return Array.isArray(state.hero?.blessingFlows) && state.hero.blessingFlows.includes(flow);
  }

  function getVersatileSatchelFlow() {
    const momentum = state.hero?.blessingFlowMomentum || {};
    const candidates = getBlessingFlowDefinitions()
      .map((flow) => {
        const baseWeight = Math.max(0, Number(momentum[flow.id]) || 0);
        const weight = flow.id === state.hero?.lastBagFlow
          ? baseWeight * lastBagFlowWeightMultiplier
          : baseWeight;
        return { ...flow, weight };
      })
      .filter((flow) => flow.weight > 0);

    return candidates.length > 0
      ? weightedRandomItem(candidates, (flow) => flow.weight)
      : null;
  }

  function applyBattleStartSkills() {
    if (hasHeroSkill("status-familiarity") && !hasBlessingFlow("debuff")) {
      state.hero.battleAttackBonus = (state.hero.battleAttackBonus || 0) + 1;
      addFixedLog("skill", `${state.hero.name} 沒有可判讀的負面狀態，改以經驗調整攻勢，攻擊提升。`);
    }

    if (!hasHeroSkill("versatile-satchel")) return;

    const satchelFlow = getVersatileSatchelFlow();
    const effectId = satchelFlow?.satchelEffectId || "battle_attack";
    const effect = VERSATILE_SATCHEL_EFFECT_HANDLERS[effectId]
      || VERSATILE_SATCHEL_EFFECT_HANDLERS.battle_attack;
    const bonus = effect(state.hero);
    if (satchelFlow?.id) state.hero.lastBagFlow = satchelFlow.id;
    addLog("skill", "versatileSatchel", { actor: state.hero.name, bonus });
  }

  function applyEmergencyBandage() {
    if (!hasHeroSkill("emergency-bandage") || state.hero.skillState.emergencyBandageUsed || state.hero.hp <= 0) return;
    if (state.hero.hp > state.hero.maxHp * 0.4) return;
    const amount = Math.max(1, Math.round(state.hero.maxHp * 0.18));
    state.hero.skillState.emergencyBandageUsed = true;
    state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + amount);
    addLog("heal", "emergencyBandage", { actor: state.hero.name, amount });
  }

  function cleanseOneNegativeEffect() {
    if (state.hero.poison > 0) {
      state.hero.poison = 0;
      addLog("status", "cleanse", { actor: state.hero.name, effect: "中毒" });
      return;
    }
    if (state.hero.entangle) {
      state.hero.entangle = null;
      addLog("status", "cleanse", { actor: state.hero.name, effect: "纏繞" });
    }
  }

  function tryLastStand() {
    if (!hasHeroSkill("last-stand") || state.hero.skillState.lastStandUsed) return false;
    state.hero.skillState.lastStandUsed = true;
    const amount = Math.max(1, Math.round(state.hero.maxHp * 0.15));
    state.hero.hp = Math.min(state.hero.maxHp, 1 + amount);
    addLog("heal", "lastStand", { actor: state.hero.name, amount });
    cleanseOneNegativeEffect();
    return state.hero.hp > 0;
  }

  function applyVictorySkills() {
    if (!hasHeroSkill("adventurer-pace")) return;
    const baseRatio = hasHeroSkill("expedition-pace") ? 0.15 : 0.1;
    const amount = Math.max(1, Math.round(state.hero.maxHp * (baseRatio + (state.hero.victoryHealBonusRatio || 0))));
    state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + amount);
    addLog("heal", "adventurerPace", { amount });
  }

  function consumeBattleLimitedEffects() {
    if (!Array.isArray(state.hero?.timedRegens)) return;
    state.hero.timedRegens = state.hero.timedRegens
      .map((effect) => ({
        ...effect,
        remainingEncounters: Math.max(0, (effect.remainingEncounters || 0) - 1)
      }))
      .filter((effect) => effect.remainingEncounters > 0);
  }

  return Object.freeze({
    hasBlessingFlow,
    applyBattleStartSkills,
    applyEmergencyBandage,
    tryLastStand,
    applyVictorySkills,
    consumeBattleLimitedEffects
  });
}
