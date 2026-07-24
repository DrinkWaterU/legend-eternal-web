import { applyBlessingEffects } from "../../core/blessings.js";
import { createBlessingInstance, syncBlessingInstanceRuntime } from "../../adventure/blessingInstances.js";
import { getBlessingRarity } from "../../data/rarities.js";
import { showCombatLayout } from "../../ui/eventView.js";
import { renderBlessingChoices } from "../../ui/renderHelpers.js";

export function createBlessingController({
  state,
  els,
  counterEscapeEnemyHealRatio,
  getAdventureBlessingDefinitions,
  addLog,
  hasPendingThreat,
  resumePendingThreat,
  enterSafeState,
  onBeachBossBlessingChosen
}) {
  function getWeightedBlessingIndex(pool) {
    const totalWeight = pool.reduce((total, blessing) => total + getBlessingRarity(blessing.rarity).weight, 0);
    let remaining = Math.random() * totalWeight;
    for (let index = 0; index < pool.length; index += 1) {
      remaining -= getBlessingRarity(pool[index].rarity).weight;
      if (remaining <= 0) return index;
    }
    return pool.length - 1;
  }

  function getBlessingChoices(count, poolId = null, rarity = null) {
    const pool = getAdventureBlessingDefinitions(poolId)
      .filter((blessing) => !rarity || blessing.rarity === rarity);
    const choices = [];
    while (choices.length < count && pool.length > 0) {
      choices.push(pool.splice(getWeightedBlessingIndex(pool), 1)[0]);
    }
    return choices;
  }

  function getOwnedBlessingCounts() {
    return (Array.isArray(state.blessingInstances) ? state.blessingInstances : [])
      .reduce((counts, instance) => {
        const blessingId = String(instance?.blessingId || "").trim();
        if (blessingId) {
          counts[blessingId] = (counts[blessingId] || 0) + 1;
        }
        return counts;
      }, {});
  }

  function getBlessingSourceLabel(sourceLabel = null) {
    if (sourceLabel) return sourceLabel;
    if (state.blessingContext === "beachBoss") return "海灘 Boss";
    if (state.eventContext || state.blessingContext === "eventChoice") {
      return state.selectedRegionId === "beach" ? "海灘事件" : "事件獎勵";
    }
    return state.selectedRegionId === "beach" ? "海灘途中" : "冒險途中";
  }

  function grantBlessing(blessing, { sourceLabel = null } = {}) {
    const instance = createBlessingInstance({
      state,
      blessing,
      sourceLabel: getBlessingSourceLabel(sourceLabel)
    });
    applyBlessingEffects(state.hero, blessing, { instanceId: instance.instanceId });
    state.hero.blessings.push(blessing.name);
    state.blessingInstances = Array.isArray(state.blessingInstances)
      ? state.blessingInstances
      : [];
    syncBlessingInstanceRuntime(instance, state.hero);
    state.blessingInstances.push(instance);
    addLog("system", "blessing", { blessing: blessing.name });
    return blessing;
  }

  function chooseBlessing(blessing) {
    if (state.blessingInputLocked) return;
    state.blessingInputLocked = true;
    const context = state.blessingContext;
    grantBlessing(blessing);
    if (context === "beachBoss") {
      state.awaitingBlessing = false;
      state.blessingContext = "normal";
      state.blessingPoolOverrideId = null;
      els.blessingPanel.classList.remove("is-visible");
      onBeachBossBlessingChosen?.();
      return;
    }
    if (context === "counterEscape" && hasPendingThreat("counterEscape")) {
      state.blessingContext = "normal";
      state.blessingPoolOverrideId = null;
      els.blessingPanel.classList.remove("is-visible");
      resumePendingThreat({
        healRatio: counterEscapeEnemyHealRatio,
        introText: `你帶著新的臨時祝福「${blessing.name}」回到原本的戰鬥。`
      });
      return;
    }
    if (context === "eventChoice") {
      state.blessingContext = "normal";
      state.blessingPoolOverrideId = null;
      state.eventContext = null;
      state.eventInputLocked = false;
      state.adventureProgressLocked = false;
      els.blessingPanel.classList.remove("is-visible");
      showCombatLayout(els);
      enterSafeState({ canRest: false });
      return;
    }
    state.blessingContext = "normal";
    state.blessingPoolOverrideId = null;
    enterSafeState({ canRest: false });
  }

  function showBlessings(context = "normal", { poolId = null, count = 3, rarity = null } = {}) {
    state.blessingContext = context;
    state.blessingPoolOverrideId = poolId;
    state.blessingInputLocked = true;
    state.awaitingBlessing = true;
    els.nextButton.disabled = true;
    els.blessingPanel.classList.add("is-visible");
    els.resultLabel.textContent = context === "beachBoss" ? "選擇 Boss 後祝福" : "選擇祝福";
    renderBlessingChoices(els.blessingChoices, getBlessingChoices(count, poolId, rarity), chooseBlessing, {
      reveal: true,
      ownedCounts: getOwnedBlessingCounts(),
      onRevealComplete: () => {
        state.blessingInputLocked = false;
      }
    });
  }

  return Object.freeze({ showBlessings, grantBlessing });
}
