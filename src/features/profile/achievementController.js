import {
  closeAchievementDetailView,
  renderAchievementUnlockToast,
  renderAchievementView
} from "../../ui/achievementView.js";

export function createAchievementController({
  state,
  uiState,
  saveStore,
  els,
  windowRef = window,
  achievementDefinitions,
  regionDefinitions,
  getRouteDefinition,
  getNavigationReturnTarget,
  setReturnButton,
  toastDurationMs
}) {
  let achievementDetailTrigger = null;

  function unlockAchievement(achievementId) {
    if (!achievementDefinitions[achievementId]) return false;
    const achievement = saveStore.current.achievements[achievementId] || {
      unlocked: false,
      unlockedAt: null
    };
    if (achievement.unlocked) return false;

    achievement.unlocked = true;
    achievement.unlockedAt = new Date().toISOString();
    saveStore.current.achievements[achievementId] = achievement;
    return true;
  }

  function queueAchievementUnlock(achievementId) {
    if (!unlockAchievement(achievementId)) return false;
    state.pendingAchievementUnlocks.push(achievementId);
    uiState.achievementNewIds.add(achievementId);
    return true;
  }

  function renderAchievementScreen() {
    setReturnButton(els.achievementScreen.querySelector(".back-button"), getNavigationReturnTarget());
    if (!saveStore.current.storyFlags.achievementSystemUnlocked) {
      uiState.achievementDetailOpen = false;
      achievementDetailTrigger = null;
    }
    const result = renderAchievementView({
      els,
      definitions: achievementDefinitions,
      achievementState: saveStore.current.achievements,
      systemUnlocked: saveStore.current.storyFlags.achievementSystemUnlocked,
      filter: uiState.achievementFilter,
      selectedId: uiState.achievementSelectedId,
      newAchievementIds: uiState.achievementNewIds,
      detailOpen: uiState.achievementDetailOpen,
      regionDefinitions,
      getRouteName: (routeId) => getRouteDefinition(routeId)?.name || routeId,
      onFilterChange: handleFilterChange,
      onAchievementSelect: handleAchievementSelect
    });
    uiState.achievementFilter = result.filter;
    uiState.achievementSelectedId = result.selectedId;
  }

  function handleFilterChange(filter) {
    uiState.achievementFilter = filter;
    uiState.achievementSelectedId = null;
    uiState.achievementDetailOpen = false;
    renderAchievementScreen();
  }

  function handleAchievementSelect(achievementId, trigger) {
    achievementDetailTrigger = trigger || null;
    uiState.achievementSelectedId = achievementId;
    uiState.achievementNewIds.delete(achievementId);
    uiState.achievementDetailOpen = windowRef.matchMedia("(max-width: 760px)").matches;
    renderAchievementScreen();
  }

  function closeAchievementDetailPanel({ restoreFocus = true } = {}) {
    uiState.achievementDetailOpen = false;
    closeAchievementDetailView(els);
    if (restoreFocus && achievementDetailTrigger?.isConnected) {
      achievementDetailTrigger.focus();
    }
    achievementDetailTrigger = null;
  }

  function closeAchievementUnlockToast({ showNext = true } = {}) {
    if (state.achievementToastTimer) {
      windowRef.clearTimeout(state.achievementToastTimer);
      state.achievementToastTimer = null;
    }
    state.activeAchievementToastId = null;
    renderAchievementUnlockToast({ els, definition: null });
    if (showNext && state.pendingAchievementUnlocks.length > 0) {
      windowRef.setTimeout(flushAchievementUnlockQueue, 180);
    }
  }

  function flushAchievementUnlockQueue() {
    if (state.activeAchievementToastId || state.pendingAchievementUnlocks.length === 0) return;
    const achievementId = state.pendingAchievementUnlocks.shift();
    const definition = achievementDefinitions[achievementId];
    if (!definition) {
      flushAchievementUnlockQueue();
      return;
    }
    state.activeAchievementToastId = achievementId;
    renderAchievementUnlockToast({ els, definition });
    state.achievementToastTimer = windowRef.setTimeout(
      () => closeAchievementUnlockToast(),
      toastDurationMs
    );
  }

  function resetAchievementUiRuntime() {
    if (state.achievementToastTimer) {
      windowRef.clearTimeout(state.achievementToastTimer);
    }
    state.achievementToastTimer = null;
    state.activeAchievementToastId = null;
    state.pendingAchievementUnlocks = [];
    renderAchievementUnlockToast({ els, definition: null });
    uiState.achievementFilter = "all";
    uiState.achievementSelectedId = null;
    uiState.achievementNewIds = new Set();
    uiState.achievementDetailOpen = false;
    closeAchievementDetailPanel({ restoreFocus: false });
  }

  return Object.freeze({
    unlockAchievement,
    queueAchievementUnlock,
    renderAchievementScreen,
    closeAchievementDetailPanel,
    closeAchievementUnlockToast,
    flushAchievementUnlockQueue,
    resetAchievementUiRuntime
  });
}
