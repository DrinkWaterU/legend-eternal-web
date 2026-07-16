export function createAdventureAchievements({
  state,
  saveStore,
  queueAchievementUnlock,
  forestTrialAchievementId,
  goblinCampClearAchievementId
}) {
  function unlockAdventureClearAchievements({
    regionId = state.selectedRegionId,
    routeId = state.activeRouteId
  } = {}) {
    if (state.debugBuildRun || regionId !== "forest") return;
    queueAchievementUnlock(forestTrialAchievementId);
    if (routeId === "goblin-camp") queueAchievementUnlock(goblinCampClearAchievementId);
    saveStore.current.storyFlags.achievementSystemUnlocked = true;
  }

  return Object.freeze({ unlockAdventureClearAchievements });
}
