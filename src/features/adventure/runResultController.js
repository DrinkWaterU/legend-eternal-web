import { formatRewards } from "../../core/rewards.js";
import { getPreparationSummary } from "../../core/preparations.js";
import { isSafeAreaUnlocked, isSafeAreaVisited } from "../../core/safeAreaProgression.js";
import { ANPING_TOWN_SAFE_AREA_ID, DEFAULT_SAFE_AREA_ID, getSafeAreaDefinition } from "../../data/safeAreas.js";
import { renderStatList } from "../../ui/renderHelpers.js";

export function createRunResultController({
  state,
  saveStore,
  els,
  windowRef = window,
  materialDefinitions,
  currentRegion,
  currentRoute,
  getAdventureSourceName,
  getAdventureEncounterCount,
  getAdventureEncounterIndex,
  getCharacterProgress,
  hasPhoenixBlessing,
  resetCharacterProgress,
  settleCharacterProgression,
  recordRunFinished,
  saveGameSafe,
  clearEnemyGroup,
  clearPendingThreat,
  addLog,
  render,
  closeAbilityInfoPanel,
  closeBlessingInfoPanel,
  flushAchievementUnlockQueue
}) {
  function getRunOriginSafeAreaName() {
    return getSafeAreaDefinition(state.runOriginSafeAreaId)?.name
      || getSafeAreaDefinition(DEFAULT_SAFE_AREA_ID)?.name
      || "安全區";
  }

  function enterSafeState({ canRest = false } = {}) {
    state.phase = "safe";
    state.awaitingBlessing = false;
    clearEnemyGroup();
    state.canRest = canRest;
    state.hasRested = false;
    els.blessingPanel.classList.remove("is-visible");
    addLog("system", "safeState");
    render();
  }

  function handleDefeatProgression() {
    if (state.debugBuildRun) {
      state.runStats.endLevel = state.hero?.level || 1;
      return;
    }
    const progress = getCharacterProgress();
    state.runStats.endLevel = progress.level;
    if (hasPhoenixBlessing()) return;
    state.runStats.progressReset = true;
    state.runStats.lostLevel = progress.level;
    state.runStats.lostExp = progress.exp;
    resetCharacterProgress();
    addLog("system", "progressLost");
    saveGameSafe();
  }

  function shouldOfferAnpingArrivalAfterRun(outcome) {
    return !state.debugBuildRun
      && outcome === "clear"
      && state.selectedRegionId === "forest"
      && !currentRoute()
      && isSafeAreaUnlocked(saveStore.current, ANPING_TOWN_SAFE_AREA_ID)
      && !isSafeAreaVisited(saveStore.current, ANPING_TOWN_SAFE_AREA_ID);
  }

  function getEndText(outcome) {
    if (state.debugBuildRun) {
      return outcome === "clear"
        ? `Debug 場景已完成${getAdventureSourceName()}挑戰。正式存檔未變更。`
        : "Debug 場景測試結束。正式存檔未變更。";
    }
    if (outcome === "clear") return `你完成了${getAdventureSourceName()}的挑戰。`;
    if (outcome === "segmentClear") return `你完成了${getAdventureSourceName()}段落，結束這輪冒險。`;
    if (outcome === "retreat") {
      if (state.runStats?.evacuated) {
        return `你在追擊中找到返回${getRunOriginSafeAreaName()}的路線，結束了這輪冒險。本輪的臨時祝福會重置，角色等級與經驗會保留。`;
      }
      return `你回到${getRunOriginSafeAreaName()}。本輪的臨時祝福會重置，角色等級與經驗會保留。`;
    }
    if (hasPhoenixBlessing()) {
      return `你倒下了。鳳凰的加護在灰燼般的微光中甦醒，將你帶回${getRunOriginSafeAreaName()}。`;
    }
    return "你倒在野外，這段旅途累積的等級與經驗已經失去。";
  }

  function getReachedEncounter(completed) {
    if (completed) return getAdventureEncounterCount();
    return Math.min(getAdventureEncounterIndex() + 1, getAdventureEncounterCount());
  }

  function renderEndSummary(outcome) {
    const cleared = outcome === "clear";
    const segmentCleared = outcome === "segmentClear";
    const completed = cleared || segmentCleared;
    const retreated = outcome === "retreat";
    const evacuated = retreated && Boolean(state.runStats?.evacuated);
    const sourceName = getAdventureSourceName();
    const encounterTotal = getAdventureEncounterCount();
    const reachedEncounter = getReachedEncounter(completed);
    const blessings = state.hero.blessings.length > 0 ? state.hero.blessings.join("、") : "無";
    const progress = getCharacterProgress();
    const displayLevel = state.debugBuildRun ? state.hero.level : progress.level;
    if (!state.debugBuildRun) {
      state.lastRunSummary = {
        result: cleared ? "成功" : segmentCleared ? "段落完成" : evacuated ? "撤離" : retreated ? "撤退" : "失敗",
        sourceName,
        reachedEncounter,
        encounterTotal,
        runLevel: state.runStats?.endLevel || displayLevel
      };
    }
    const items = [
      ["結果", cleared ? "冒險成功" : segmentCleared ? "海灘段落完成" : evacuated ? "撤離逃跑" : retreated ? "冒險撤退" : "冒險失敗"],
      ["路線", sourceName],
      ["抵達", `第 ${reachedEncounter} / ${encounterTotal} 場`],
      ["角色等級", `Lv. ${displayLevel}`],
      ["本輪經驗", `${state.runStats?.expGained || 0}`],
      ["擊敗敵人", `${state.defeatedEnemies} 隻`],
      ["擊敗首領", state.defeatedBoss ? "是" : "否"],
      ["逃跑", `成功 ${state.runStats?.fleeSuccesses || 0} / 失敗 ${state.runStats?.fleeFailures || 0}`],
      ["選擇祝福", blessings]
    ];
    if (state.runStats?.evacuationEscapes) items.splice(8, 0, ["撤離逃跑", `${state.runStats.evacuationEscapes} 次`]);
    if (state.runStats?.bossName) items.splice(7, 0, ["本輪首領", state.runStats.bossName]);
    if (hasPhoenixBlessing()) {
      const rewards = formatRewards(state.runStats?.rewards, materialDefinitions);
      if (rewards.gold > 0) items.push(["本輪金幣", rewards.gold]);
      items.push(["本輪素材", rewards.materials]);
      const preparationSummary = getPreparationSummary(state.runPreparation);
      items.push(["冒險整備", preparationSummary?.name || "無"]);
      if (preparationSummary) {
        items.push(["整備發動", `${preparationSummary.triggerCount} 次`]);
        if (preparationSummary.healing > 0) items.push(["整備治療", preparationSummary.healing]);
        if (preparationSummary.damagePrevented > 0) items.push(["整備減傷", preparationSummary.damagePrevented]);
        if (preparationSummary.retrySuccessCount > 0) items.push(["額外掙脫成功", `${preparationSummary.retrySuccessCount} 次`]);
      }
    }
    if (state.runStats?.levelUps.length > 0) items.push(["升級", state.runStats.levelUps.map((level) => `Lv. ${level}`).join("、")]);
    if (state.runStats?.learnedSkills.length > 0) items.push(["新技能", state.runStats.learnedSkills.join("、")]);
    if (state.runStats?.unlockedCharacters.length > 0) items.push(["新角色", `${state.runStats.unlockedCharacters.join("、")}已可使用`]);
    if (state.runStats?.progressReset) items.push(["成長損失", "死亡使等級與經驗失去，已回到 Lv. 1。"]) ;
    if (!completed && !retreated) items.push(["死因", state.deathCause ? state.deathCause.label : "未知"]);
    renderStatList(els.endSummary, items);
  }

  function finishRun(outcome, options = {}) {
    const cleared = outcome === "clear";
    const segmentCleared = outcome === "segmentClear";
    const retreated = outcome === "retreat";
    const defeated = outcome === "defeat";
    const evacuated = retreated && Boolean(state.runStats?.evacuated);
    if (!defeated || hasPhoenixBlessing()) {
      settleCharacterProgression();
    }
    state.ended = true;
    state.awaitingBlessing = false;
    state.phase = "ended";
    if (defeated) handleDefeatProgression();
    recordRunFinished(outcome, options);
    state.pendingAnpingArrival = shouldOfferAnpingArrivalAfterRun(outcome);
    clearPendingThreat();
    state.blessingContext = "normal";
    state.blessingPoolOverrideId = null;
    els.nextButton.disabled = true;
    els.blessingPanel.classList.remove("is-visible");
    closeAbilityInfoPanel();
    closeBlessingInfoPanel();
    els.returnToEndSummaryButton.hidden = true;
    els.endPanel.classList.add("is-visible");
    els.endTitle.textContent = cleared ? "冒險成功" : segmentCleared ? "海灘段落完成" : evacuated ? "撤離逃跑" : retreated ? "冒險撤退" : "冒險失敗";
    els.endText.textContent = getEndText(outcome);
    els.endText.classList.toggle("danger-text", defeated && !hasPhoenixBlessing());
    renderEndSummary(outcome);
    els.retryButton.textContent = state.pendingAnpingArrival ? "繼續前行" : `回到${getRunOriginSafeAreaName()}`;
    els.resultLabel.textContent = cleared
      ? `${getAdventureSourceName()}突破`
      : segmentCleared ? `${getAdventureSourceName()}段落完成`
      : evacuated ? "撤離成功" : retreated ? "返回據點" : "本輪結束";
    render();
    if (!state.pendingAnpingArrival) windowRef.requestAnimationFrame(flushAchievementUnlockQueue);
  }

  function loseRun() {
    addLog("system", "defeat", { target: state.hero.name });
    finishRun("defeat");
  }

  return Object.freeze({ enterSafeState, loseRun, finishRun, getRunOriginSafeAreaName });
}
