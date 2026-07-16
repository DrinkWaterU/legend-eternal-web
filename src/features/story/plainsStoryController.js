export function createPlainsStoryController({
  state,
  saveStore,
  els,
  documentRef = document,
  windowRef = window,
  regionDefinitions,
  storyLineDelayMs,
  storyFinishExtraDelayMs,
  plainsTrialAchievementId,
  hasPhoenixBlessing,
  setNavigationContext,
  clearPendingThreat,
  recordRunFinished,
  closeAbilityInfoPanel,
  closeBlessingInfoPanel,
  getRunOriginSafeAreaName,
  returnToRunOriginSafeArea,
  queueAchievementUnlock,
  saveGameSafe,
  render
}) {
  function getStoryDefinition() {
    return regionDefinitions.plains?.clearStory || null;
  }

  function shouldTriggerStory() {
    return state.selectedRegionId === "plains"
      && !hasPhoenixBlessing()
      && !saveStore.current.storyFlags.plainsBossStorySeen;
  }

  function closePanel() {
    if (state.storyTimer) {
      windowRef.clearTimeout(state.storyTimer);
      state.storyTimer = null;
    }
    els.storyPanel.classList.remove("is-visible");
  }

  function renderText(revealed) {
    const lines = getStoryDefinition()?.lines || [];
    if (state.storyTimer) {
      windowRef.clearTimeout(state.storyTimer);
      state.storyTimer = null;
    }
    els.storyText.innerHTML = "";
    lines.forEach((line, index) => {
      const paragraph = documentRef.createElement("p");
      paragraph.innerHTML = line;
      paragraph.style.animationDelay = revealed ? "0ms" : `${index * storyLineDelayMs}ms`;
      if (revealed) paragraph.classList.add("is-revealed");
      els.storyText.append(paragraph);
    });
    els.revealStoryButton.hidden = revealed;
    els.finishStoryButton.hidden = !revealed;
    if (!revealed) {
      state.storyTimer = windowRef.setTimeout(() => {
        els.revealStoryButton.hidden = true;
        els.finishStoryButton.hidden = false;
      }, Math.max(0, lines.length - 1) * storyLineDelayMs + storyFinishExtraDelayMs);
    }
  }

  function showStory() {
    const story = getStoryDefinition();
    if (!story?.lines?.length) throw new Error("平原通關劇情資料不存在。");
    setNavigationContext("story");
    state.ended = true;
    state.awaitingBlessing = false;
    state.phase = "story";
    clearPendingThreat();
    state.blessingContext = "normal";
    recordRunFinished("clear");
    els.nextButton.disabled = true;
    els.blessingPanel.classList.remove("is-visible");
    els.endPanel.classList.remove("is-visible");
    closeAbilityInfoPanel();
    closeBlessingInfoPanel();
    els.storyPanel.classList.add("is-visible");
    els.finishStoryButton.textContent = `回到${getRunOriginSafeAreaName()}`;
    els.resultLabel.textContent = story.resultLabel || "命運覺醒";
    els.encounterLabel.textContent = story.encounterLabel || "星穹之外";
    renderText(false);
    render();
  }

  function unlockPhoenixBlessing() {
    saveStore.current.storyFlags.phoenixBlessingUnlocked = true;
    saveStore.current.storyFlags.plainsBossStorySeen = true;
    saveStore.current.storyFlags.achievementSystemUnlocked = true;
    queueAchievementUnlock(plainsTrialAchievementId);
    saveGameSafe();
  }

  function completeStory() {
    if (!state.debugBuildRun) unlockPhoenixBlessing();
    els.storyPanel.classList.remove("is-visible");
    returnToRunOriginSafeArea();
  }

  return Object.freeze({
    shouldTriggerStory,
    closePanel,
    showStory,
    revealStoryText: () => renderText(true),
    completeStory
  });
}
