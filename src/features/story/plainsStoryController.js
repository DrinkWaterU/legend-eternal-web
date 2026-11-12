import { insertPhoenixPayoffLine } from "../../core/phoenixForeshadowing.js";
import { planTypewriterTimeline, prepareTypewriterParagraph } from "../../ui/storyTypewriter.js";

const STORY_INITIAL_BEAT = "star";
// One-shot effect classes on #storyPanel and how long they stay (0 = until the panel closes).
const STORY_EFFECT_DURATIONS = Object.freeze({
  twinkle: 1400,
  still: 0,
  quake: 950,
  shatter: 1800,
  toll: 1100,
  flare: 1500,
  bloom: 1800
});
const STORY_EFFECT_CLASSES = Object.keys(STORY_EFFECT_DURATIONS).map((fx) => `fx-${fx}`);

export function createPlainsStoryController({
  state,
  saveStore,
  els,
  documentRef = document,
  windowRef = window,
  regionDefinitions,
  storyTypewriterTiming,
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

  // The story types out character by character. Cue words in the story lines
  // (data-beat / data-fx) switch the scene and play one-shot effects as they appear.
  let effectTimerIds = [];
  // Debug sandbox only: overrides the death count used by the payoff line.
  let previewDefeats = null;

  function clearEffectTimers() {
    effectTimerIds.forEach((timerId) => windowRef.clearTimeout(timerId));
    effectTimerIds = [];
    STORY_EFFECT_CLASSES.forEach((className) => els.storyPanel.classList.remove(className));
  }

  function clearStoryTimer() {
    if (state.storyTimer) {
      windowRef.clearTimeout(state.storyTimer);
      state.storyTimer = null;
    }
  }

  function setBeat(beat) {
    if (beat) els.storyPanel.dataset.beat = beat;
    else delete els.storyPanel.dataset.beat;
  }

  function playEffect(fx) {
    const durationMs = STORY_EFFECT_DURATIONS[fx];
    if (durationMs === undefined) return;
    const className = `fx-${fx}`;
    els.storyPanel.classList.remove(className);
    void els.storyPanel.offsetWidth; // restart the CSS animation if it is replayed
    els.storyPanel.classList.add(className);
    if (durationMs > 0) {
      effectTimerIds.push(windowRef.setTimeout(() => els.storyPanel.classList.remove(className), durationMs));
    }
  }

  function closePanel() {
    clearStoryTimer();
    clearEffectTimers();
    setBeat("");
    els.storyPanel.classList.remove("is-visible");
  }

  function showFinishButton() {
    els.revealStoryButton.hidden = true;
    els.finishStoryButton.hidden = false;
  }

  function renderText(revealed) {
    const story = getStoryDefinition();
    const defeats = Number.isFinite(previewDefeats) ? previewDefeats : saveStore.current?.statistics?.totalDefeats;
    const lines = insertPhoenixPayoffLine(story?.lines || [], defeats);
    clearStoryTimer();
    clearEffectTimers();
    els.storyText.innerHTML = "";
    const paragraphs = lines.map((line) => {
      const paragraph = documentRef.createElement("p");
      paragraph.innerHTML = line;
      paragraph.setAttribute("aria-label", paragraph.textContent);
      els.storyText.append(paragraph);
      return paragraph;
    });
    els.revealStoryButton.hidden = revealed;
    els.finishStoryButton.hidden = !revealed;

    if (revealed) {
      paragraphs.forEach((paragraph) => paragraph.classList.add("is-revealed"));
      const cues = [...els.storyText.querySelectorAll("[data-beat], [data-fx]")];
      cues.forEach((cue) => cue.classList.add("is-cued", "is-settled"));
      setBeat([...els.storyText.querySelectorAll("[data-beat]")].at(-1)?.dataset.beat || STORY_INITIAL_BEAT);
      // Persistent effects (the stilled wind) stay on after skipping.
      cues.forEach((cue) => {
        if (STORY_EFFECT_DURATIONS[cue.dataset.fx] === 0) playEffect(cue.dataset.fx);
      });
      return;
    }

    setBeat(STORY_INITIAL_BEAT);
    const lineSteps = paragraphs.map((paragraph) => {
      paragraph.classList.add("is-typing");
      return prepareTypewriterParagraph(paragraph, documentRef);
    });
    const { events, finishAt } = planTypewriterTimeline(lineSteps, storyTypewriterTiming);
    const runEvent = (index) => {
      const event = events[index];
      if (!event) {
        state.storyTimer = windowRef.setTimeout(showFinishButton, Math.max(0, finishAt - (events.at(-1)?.at || 0)));
        return;
      }
      const step = lineSteps[event.lineIndex][event.stepIndex];
      step.element.classList.add("is-shown");
      if (step.cue) step.cue.classList.add("is-cued");
      if (event.beat) setBeat(event.beat);
      if (event.fx) playEffect(event.fx);
      const next = events[index + 1];
      state.storyTimer = windowRef.setTimeout(() => runEvent(index + 1), next ? next.at - event.at : 0);
    };
    runEvent(0);
  }

  function showStory({ previewDefeats: preview = null } = {}) {
    previewDefeats = state.debugBuildRun && Number.isFinite(preview) ? Math.max(0, preview) : null;
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
