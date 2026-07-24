import { renderStoryQuestView } from "../../ui/storyQuestView.js";

export function createStoryQuestController({
  els,
  storyQuestRuntime,
  getCurrentSafeArea,
  setNavigationContext,
  showScreen,
  setReturnButton
}) {
  function showStoryQuestScreen() {
    setNavigationContext("camp");
    showScreen("storyQuestScreen");
  }

  function renderStoryQuestScreen() {
    storyQuestRuntime.refreshAvailability();
    const safeArea = getCurrentSafeArea();
    setReturnButton(els.storyQuestBackButton, "campScreen");
    renderStoryQuestView({
      els,
      safeAreaName: safeArea?.name,
      entries: storyQuestRuntime.getSnapshot().entries
    });
  }

  return Object.freeze({
    showStoryQuestScreen,
    renderStoryQuestScreen
  });
}
