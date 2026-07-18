export function createAdventureAchievements({
  state,
  saveStore,
  queueAchievementUnlock,
  forestTrialAchievementId,
  goblinCampClearAchievementId,
  beachTrialAchievementId
}) {
  function unlockAdventureClearAchievements({
    regionId = state.selectedRegionId,
    routeId = state.activeRouteId
  } = {}) {
    if (state.debugBuildRun) return;
    if (regionId === "forest") {
      queueAchievementUnlock(forestTrialAchievementId);
      if (routeId === "goblin-camp") queueAchievementUnlock(goblinCampClearAchievementId);
    }
    if (regionId === "beach") queueAchievementUnlock(beachTrialAchievementId);
    saveStore.current.storyFlags.achievementSystemUnlocked = true;
  }

  return Object.freeze({ unlockAdventureClearAchievements });
}
