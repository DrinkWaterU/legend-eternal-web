export function createEncounterVictoryController({
  state,
  getEventRuntime,
  hasPendingThreat,
  settleBattleVictory,
  finishCounterEncounterVictory,
  currentRoute,
  getAdventureEncounterIndex,
  getAdventureEncounterCount,
  resolvePostEncounterRunPreparation,
  render,
  addLog,
  getAdventureSourceName,
  completeGoblinCampRoute,
  shouldTriggerPlainsStory,
  showPlainsStory,
  unlockAdventureClearAchievements,
  finishRun,
  showBlessings
}) {
  function winEncounter() {
    settleBattleVictory();
    if (hasPendingThreat("counterEscape")) {
      finishCounterEncounterVictory();
      return;
    }
    if (state.battleSource === "event") {
      getEventRuntime()?.finishEventBattleVictory();
      return;
    }
    state.encounterIndex += 1;
    if (currentRoute()) state.routeEncounterIndex += 1;
    const adventureComplete = getAdventureEncounterIndex() >= getAdventureEncounterCount();
    resolvePostEncounterRunPreparation({ isFinalEncounter: adventureComplete });
    render();
    if (adventureComplete) {
      addLog("system", "clear", { region: getAdventureSourceName() });
      if (currentRoute()?.id === "goblin-camp") {
        completeGoblinCampRoute();
        return;
      }
      if (shouldTriggerPlainsStory()) {
        showPlainsStory();
        return;
      }
      unlockAdventureClearAchievements();
      finishRun("clear");
      return;
    }
    showBlessings();
  }

  return Object.freeze({ winEncounter });
}
