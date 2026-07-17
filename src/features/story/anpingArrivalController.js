import {
  isSafeAreaUnlocked,
  isSafeAreaVisited,
  markSafeAreaVisited,
  setCurrentSafeArea
} from "../../core/safeAreaProgression.js";
import { ANPING_TOWN_SAFE_AREA_ID } from "../../data/safeAreas.js";
import { clone } from "../../utils.js";

export function createAnpingArrivalController({
  state,
  uiState,
  saveStore,
  els,
  documentRef = document,
  windowRef = window,
  pages,
  timing,
  musicManager,
  ambientManager,
  setNavigationContext,
  closeAbilityInfoPanel,
  closeBlessingInfoPanel,
  saveGameSafe,
  returnToSafeArea
}) {
  function clearTimers() {
    state.anpingArrivalTimerIds.forEach((timerId) => windowRef.clearTimeout(timerId));
    state.anpingArrivalTimerIds = [];
  }

  function queueTimer(callback, delayMs) {
    const timerId = windowRef.setTimeout(() => {
      state.anpingArrivalTimerIds = state.anpingArrivalTimerIds.filter((id) => id !== timerId);
      callback();
    }, delayMs);
    state.anpingArrivalTimerIds.push(timerId);
    return timerId;
  }

  function closePanel() {
    clearTimers();
    state.anpingArrivalContext = null;
    state.anpingArrivalInputLocked = false;
    els.anpingArrivalPanel.classList.remove("is-visible");
    els.anpingArrivalLocation.classList.remove("is-visible");
    els.anpingArrivalLocation.hidden = true;
    els.continueAnpingArrivalButton.disabled = false;
  }

  function renderText(revealed = false) {
    const pageIndex = state.anpingArrivalContext?.pageIndex ?? 0;
    const page = pages[pageIndex];
    if (!page) return;
    els.anpingArrivalText.replaceChildren();
    page.lines.forEach((line, index) => {
      const paragraph = documentRef.createElement("p");
      paragraph.textContent = line;
      paragraph.style.animationDelay = revealed ? "0ms" : `${index * timing.lineDelayMs}ms`;
      if (revealed) paragraph.classList.add("is-revealed");
      els.anpingArrivalText.append(paragraph);
    });
    els.revealAnpingArrivalButton.hidden = revealed;
    els.continueAnpingArrivalButton.hidden = !revealed;
    if (!revealed) {
      queueTimer(() => {
        els.revealAnpingArrivalButton.hidden = true;
        els.continueAnpingArrivalButton.hidden = false;
      }, Math.max(0, page.lines.length - 1) * timing.lineDelayMs + timing.finishExtraDelayMs);
    }
  }

  function renderPage(revealed = false) {
    const pageIndex = state.anpingArrivalContext?.pageIndex ?? 0;
    const page = pages[pageIndex];
    if (!page) return;
    clearTimers();
    els.anpingArrivalDialog.dataset.stage = page.key;
    els.anpingArrivalEyebrow.textContent = page.eyebrow;
    els.anpingArrivalTitle.textContent = page.title;
    els.anpingArrivalCounter.textContent = `${pageIndex + 1} / ${pages.length}`;
    els.anpingArrivalProgress.forEach((item, index) => item.classList.toggle("is-active", index <= pageIndex));
    els.anpingArrivalUnlock.hidden = page.key !== "history";
    els.anpingArrivalUnlock.textContent = "安平鎮已解鎖";
    els.continueAnpingArrivalButton.textContent = page.key === "history" ? "進入安平鎮" : "繼續";
    els.continueAnpingArrivalButton.disabled = false;
    els.anpingArrivalLocation.classList.remove("is-visible");
    els.anpingArrivalLocation.hidden = true;
    renderText(revealed);
    if (page.key === "town") {
      void musicManager.requestTrack("anping-town");
      queueTimer(() => {
        els.anpingArrivalLocation.hidden = false;
        windowRef.requestAnimationFrame(() => els.anpingArrivalLocation.classList.add("is-visible"));
      }, timing.locationDelayMs);
      queueTimer(() => els.anpingArrivalLocation.classList.remove("is-visible"), timing.locationHideDelayMs);
    } else if (page.key === "history") {
      void musicManager.requestTrack("anping-town");
    }
  }

  function showStory({ source = "safe-area-travel" } = {}) {
    if (!isSafeAreaUnlocked(saveStore.current, ANPING_TOWN_SAFE_AREA_ID)
      || isSafeAreaVisited(saveStore.current, ANPING_TOWN_SAFE_AREA_ID)) return false;
    setNavigationContext("story");
    state.anpingArrivalContext = { pageIndex: 0, source };
    state.anpingArrivalInputLocked = false;
    clearTimers();
    els.endPanel.classList.remove("is-visible");
    els.storyPanel.classList.remove("is-visible");
    closeAbilityInfoPanel();
    closeBlessingInfoPanel();
    els.anpingArrivalPanel.classList.add("is-visible");
    els.resultLabel.textContent = "旅途的延續";
    els.encounterLabel.textContent = "森林道路盡頭";
    musicManager.preloadTrack("anping-town");
    void musicManager.requestTrack(null);
    void ambientManager.requestTrack("anping-coast");
    renderPage(false);
    return true;
  }

  function revealPage() {
    clearTimers();
    renderText(true);
    const page = pages[state.anpingArrivalContext?.pageIndex ?? 0];
    if (page?.key === "town") {
      els.anpingArrivalLocation.hidden = false;
      els.anpingArrivalLocation.classList.add("is-visible");
    }
  }

  function completeStory() {
    if (!state.anpingArrivalContext || state.anpingArrivalInputLocked === "saving") return false;
    state.anpingArrivalInputLocked = "saving";
    els.continueAnpingArrivalButton.disabled = true;
    els.continueAnpingArrivalButton.textContent = "進入中…";
    const previousProgress = clone(saveStore.current.progression.safeAreas[ANPING_TOWN_SAFE_AREA_ID]);
    const previousCurrentId = saveStore.current.settings.currentSafeAreaId;
    const previousUiId = uiState.safeAreaId;
    markSafeAreaVisited(saveStore.current, ANPING_TOWN_SAFE_AREA_ID);
    setCurrentSafeArea(saveStore.current, ANPING_TOWN_SAFE_AREA_ID);
    uiState.safeAreaId = ANPING_TOWN_SAFE_AREA_ID;
    if (!saveGameSafe()) {
      saveStore.current.progression.safeAreas[ANPING_TOWN_SAFE_AREA_ID] = previousProgress;
      saveStore.current.settings.currentSafeAreaId = previousCurrentId;
      uiState.safeAreaId = previousUiId;
      state.anpingArrivalInputLocked = false;
      els.continueAnpingArrivalButton.disabled = false;
      els.continueAnpingArrivalButton.textContent = "重新嘗試進入安平鎮";
      els.anpingArrivalUnlock.hidden = false;
      els.anpingArrivalUnlock.textContent = "瀏覽器無法保存目前進度，請重新嘗試。";
      return false;
    }
    state.pendingAnpingArrival = false;
    closePanel();
    returnToSafeArea(ANPING_TOWN_SAFE_AREA_ID);
    return true;
  }

  function continueStory() {
    if (!state.anpingArrivalContext || state.anpingArrivalInputLocked) return;
    state.anpingArrivalInputLocked = true;
    els.continueAnpingArrivalButton.disabled = true;
    if (state.anpingArrivalContext.pageIndex >= pages.length - 1) {
      completeStory();
      return;
    }
    state.anpingArrivalContext.pageIndex += 1;
    renderPage(false);
    queueTimer(() => {
      if (state.anpingArrivalInputLocked === true) {
        state.anpingArrivalInputLocked = false;
        els.continueAnpingArrivalButton.disabled = false;
      }
    }, timing.inputUnlockDelayMs);
  }

  return Object.freeze({
    clearTimers,
    closePanel,
    showStory,
    revealPage,
    continueStory
  });
}
