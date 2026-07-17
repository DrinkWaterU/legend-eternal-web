import { applyEventEffects } from "../core/events.js";
import {
  applyRewardsToInventory,
  createEmptyRewards,
  formatRewards,
  mergeRewards
} from "../core/rewards.js";
import { getBlessingPool } from "../data/blessings/index.js";
import { materialDefinitions } from "../data/materials.js";
import { weightedRandomItem } from "../utils.js";

export function createEventRewards({
  state,
  getSaveData,
  grantBlessing,
  hasPhoenixBlessing,
  saveGameSafe,
  addLog,
  addFixedLog
}) {
  function applyChoiceEffects(effects) {
    const effectResult = applyEventEffects({
      effects,
      hero: state.hero,
      grantBlessing: grantEventBlessing,
      grantMaterials: grantEventMaterials
    });
    effectResult.applied.forEach((effect) => {
      if (effect.type === "recoverHp" && effect.amount > 0) {
        addLog("heal", "heal", { target: state.hero.name, amount: effect.amount });
      }
      if (effect.type === "loseHp" && effect.amount > 0) {
        addFixedLog("neutral-damage", `事件使${state.hero.name}失去 ${effect.amount} 點生命。`);
      }
    });
    return effectResult;
  }

  function buildRewardLines(appliedEffects) {
    const rewards = [];
    appliedEffects.forEach((effect) => {
      if (effect.type === "recoverHp" && effect.amount > 0) {
        rewards.push(`恢復生命｜${effect.amount}`);
      }
      if (effect.type === "grantBlessing" && effect.result?.name) {
        rewards.push(`獲得祝福｜${effect.result.name}`);
      }
      if (effect.type === "grantMaterials" && effect.result) {
        const summary = formatRewards(effect.result, materialDefinitions);
        if (summary.materials !== "沒有取得素材") {
          rewards.push(`獲得素材｜${summary.materials}`);
        }
      }
    });
    return rewards;
  }

  function grantEventBlessing(effect) {
    const pool = getBlessingPool(effect.poolId);
    const candidates = (pool?.blessings || []).filter((blessing) => blessing.rarity === effect.rarity);
    if (candidates.length === 0) {
      throw new Error(`找不到事件 Blessing：${effect.poolId}/${effect.rarity}`);
    }
    return grantBlessing(weightedRandomItem(candidates, (candidate) => Number(candidate.weight) || 100));
  }

  function grantEventMaterials(effect) {
    if (state.debugBuildRun || !hasPhoenixBlessing()) return createEmptyRewards();
    const rewards = createEmptyRewards();
    (Array.isArray(effect.materials) ? effect.materials : []).forEach((material) => {
      const id = String(material?.id || "").trim();
      const quantity = Math.max(0, Math.floor(Number(material?.quantity) || 0));
      if (!id || quantity <= 0) return;
      rewards.materials[id] = {
        id,
        name: materialDefinitions[id]?.name || material.name || id,
        quantity
      };
    });
    state.runStats.rewards = mergeRewards(state.runStats.rewards, rewards);
    applyRewardsToInventory(getSaveData().inventory, rewards);
    saveGameSafe();
    return rewards;
  }

  return Object.freeze({ applyChoiceEffects, buildRewardLines });
}
