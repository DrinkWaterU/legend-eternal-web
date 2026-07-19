export function createAdventureAchievements({
  state,
  saveStore,
  queueAchievementUnlock,
  forestTrialAchievementId,
  goblinCampClearAchievementId,
  beachTrialAchievementId,
  coastTrialAchievementId,
  saveGameSafe = null
}) {
  function markAchievementSystemUnlocked() {
    saveStore.current.storyFlags.achievementSystemUnlocked = true;
    saveGameSafe?.();
  }

  function unlockBeachSegmentAchievement() {
    if (state.debugBuildRun) return false;
    queueAchievementUnlock(beachTrialAchievementId);
    markAchievementSystemUnlocked();
    return true;
  }

  function unlockCoastClearAchievement() {
    if (state.debugBuildRun) return false;
    queueAchievementUnlock(coastTrialAchievementId);
    markAchievementSystemUnlocked();
    return true;
  }

  function unlockAdventureClearAchievements({
    regionId = state.selectedRegionId,
    routeId = state.activeRouteId
  } = {}) {
    if (state.debugBuildRun) return;
    if (regionId === "forest") {
      queueAchievementUnlock(forestTrialAchievementId);
      if (routeId === "goblin-camp") queueAchievementUnlock(goblinCampClearAchievementId);
    }
    if (regionId === "beach") unlockBeachSegmentAchievement();
    markAchievementSystemUnlocked();
  }

  return Object.freeze({
    unlockAdventureClearAchievements,
    unlockBeachSegmentAchievement,
    unlockCoastClearAchievement
  });
}
