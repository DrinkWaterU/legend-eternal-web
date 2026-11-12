import { getPhoenixStoryBeats, insertPhoenixPayoffLine } from "../../core/phoenixForeshadowing.js";

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
  runSaveOperation = (action) => action(),
  afterAdventureSaved = (effect) => effect(),
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

  // Beat timers switch the panel's scene (stars → gaze → death → ember → phoenix)
  // in step with the line that is fading in.
  let beatTimerIds = [];

  function clearBeatTimers() {
    beatTimerIds.forEach((timerId) => windowRef.clearTimeout(timerId));
    beatTimerIds = [];
  }

  function setBeat(beat) {
    if (beat) els.storyPanel.dataset.beat = beat;
    else delete els.storyPanel.dataset.beat;
  }

  function closePanel() {
    if (state.storyTimer) {
      windowRef.clearTimeout(state.storyTimer);
      state.storyTimer = null;
    }
    clearBeatTimers();
    setBeat("");
    els.storyPanel.classList.remove("is-visible");
  }

  function renderText(revealed) {
    const story = getStoryDefinition();
    const lines = insertPhoenixPayoffLine(story?.lines || [], saveStore.current?.statistics?.totalDefeats);
    const beats = getPhoenixStoryBeats(story?.beats, lines.length);
    if (state.storyTimer) {
      windowRef.clearTimeout(state.storyTimer);
      state.storyTimer = null;
    }
    clearBeatTimers();
    if (revealed) {
      setBeat(beats.filter(Boolean).at(-1) || "");
    } else {
      setBeat(beats[0]);
      beats.forEach((beat, index) => {
        if (index === 0 || !beat || beat === beats[index - 1]) return;
        beatTimerIds.push(windowRef.setTimeout(() => setBeat(beat), index * storyLineDelayMs));
      });
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
    return runSaveOperation(showStoryOperation);
  }

  function showStoryOperation() {
    const story = getStoryDefinition();
    if (!story?.lines?.length) throw new Error("平原通關劇情資料不存在。");
    setNavigationContext("story");
    state.ended = true;
    state.awaitingBlessing = false;
    state.phase = "story";
    clearPendingThreat();
    state.blessingContext = "normal";
    recordRunFinished("clear");
    afterAdventureSaved(() => {
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
    });
  }

  function unlockPhoenixBlessing() {
    saveStore.current.storyFlags.phoenixBlessingUnlocked = true;
    saveStore.current.storyFlags.plainsBossStorySeen = true;
    saveStore.current.storyFlags.achievementSystemUnlocked = true;
    queueAchievementUnlock(plainsTrialAchievementId);
    saveGameSafe();
  }

  function completeStory() {
    return runSaveOperation(() => {
      if (state.phase !== "story") return;
      if (!state.debugBuildRun) unlockPhoenixBlessing();
      state.runResumeFinished = true;
      afterAdventureSaved(() => {
        closePanel();
        returnToRunOriginSafeArea();
      });
    });
  }

  return Object.freeze({
    restoreStoryView() {
      els.storyPanel.classList.add("is-visible");
      els.finishStoryButton.textContent = `回到${getRunOriginSafeAreaName()}`;
      els.resultLabel.textContent = getStoryDefinition()?.resultLabel || "命運覺醒";
      renderText(true);
      render();
    },
    shouldTriggerStory,
    closePanel,
    showStory,
    revealStoryText: () => renderText(true),
    completeStory
  });
}
