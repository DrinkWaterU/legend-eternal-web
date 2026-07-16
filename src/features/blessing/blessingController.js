import { applyBlessingEffects } from "../../core/blessings.js";
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
  enterSafeState
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

  function getBlessingChoices(count, poolId = null) {
    const pool = [...getAdventureBlessingDefinitions(poolId)];
    const choices = [];
    while (choices.length < count && pool.length > 0) {
      choices.push(pool.splice(getWeightedBlessingIndex(pool), 1)[0]);
    }
    return choices;
  }

  function grantBlessing(blessing) {
    applyBlessingEffects(state.hero, blessing);
    state.hero.blessings.push(blessing.name);
    addLog("system", "blessing", { blessing: blessing.name });
    return blessing;
  }

  function chooseBlessing(blessing) {
    if (state.blessingInputLocked) return;
    state.blessingInputLocked = true;
    grantBlessing(blessing);
    if (state.blessingContext === "counterEscape" && hasPendingThreat("counterEscape")) {
      state.blessingContext = "normal";
      state.blessingPoolOverrideId = null;
      els.blessingPanel.classList.remove("is-visible");
      resumePendingThreat({
        healRatio: counterEscapeEnemyHealRatio,
        introText: `你帶著新的臨時祝福「${blessing.name}」回到原本的戰鬥。`
      });
      return;
    }
    if (state.blessingContext === "eventChoice") {
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

  function showBlessings(context = "normal", { poolId = null, count = 3 } = {}) {
    state.blessingContext = context;
    state.blessingPoolOverrideId = poolId;
    state.blessingInputLocked = true;
    state.awaitingBlessing = true;
    els.nextButton.disabled = true;
    els.blessingPanel.classList.add("is-visible");
    els.resultLabel.textContent = "選擇祝福";
    renderBlessingChoices(els.blessingChoices, getBlessingChoices(count, poolId), chooseBlessing, {
      reveal: true,
      onRevealComplete: () => {
        state.blessingInputLocked = false;
      }
    });
  }

  return Object.freeze({ showBlessings, grantBlessing });
}
