import {
  COUNTER_ESCAPE_ENEMY_HEAL_RATIO,
  COAST_TRIAL_ACHIEVEMENT_ID,
  ELITE_FLEE_CHANCE,
  BEACH_TRIAL_ACHIEVEMENT_ID,
  FOREST_TRIAL_ACHIEVEMENT_ID,
  GOBLIN_CAMP_CLEAR_ACHIEVEMENT_ID,
  NORMAL_FLEE_CHANCE,
  PLAINS_TRIAL_ACHIEVEMENT_ID,
  REST_HEAL_RATIO,
  RUN_STARTING_FLEES,
  SAFE_ESCAPE_ENEMY_HEAL_RATIO,
  STORY_FINISH_EXTRA_DELAY_MS,
  STORY_LINE_DELAY_MS,
  TACTICAL_FLEE_RESULTS
} from "./runtimeConstants.js";
import { createRunLifecycleController } from "../features/adventure/runLifecycleController.js";
import { createRunResultController } from "../features/adventure/runResultController.js";
import { createAdventureAchievements } from "../features/adventure/adventureAchievements.js";
import { createRouteEndingController } from "../features/adventure/routeEndingController.js";
import { createCampTransitionController } from "../features/adventure/campTransitionController.js";
import { createEncounterVictoryController } from "../features/adventure/encounterVictoryController.js";
import { createBlessingController } from "../features/blessing/blessingController.js";
import { createEscapeController } from "../features/escape/escapeController.js";
import { createAnpingArrivalController } from "../features/story/anpingArrivalController.js";
import { createPlainsStoryController } from "../features/story/plainsStoryController.js";
import { createDuelController } from "../features/duel/duelController.js";
import { materialDefinitions } from "../data/materials.js";
import { characterDefinitions } from "../data/characters/index.js";
import { regionDefinitions } from "../data/regions/index.js";
import { ANPING_ARRIVAL_TIMING, anpingArrivalPages } from "../data/anpingArrival.js";

export function createAdventureFeatures({
  foundation,
  world,
  profile,
  battle,
  els,
  documentRef = document,
  windowRef = window,
  getEventRuntime,
  showScreen
}) {
  const { state, uiState, saveStore } = foundation;
  let anpingArrivalController;
  let campTransitionController;
  let adventureAchievements;

  const runLifecycleController = createRunLifecycleController({
    state,
    uiState,
    saveStore,
    els,
    windowRef,
    materialDefinitions,
    runStartingFlees: RUN_STARTING_FLEES,
    currentRegion: foundation.currentRegion,
    currentRoute: foundation.currentRoute,
    currentAdventureSource: foundation.currentAdventureSource,
    getRouteBossDefinition: foundation.getRouteBossDefinition,
    resetRouteRuntime: foundation.resetRouteRuntime,
    clearEnemyGroup: battle.clearEnemyGroup,
    clearPendingThreat: battle.clearPendingThreat,
    getEventRuntime,
    clearAnpingArrivalTimers: (...args) => anpingArrivalController?.clearTimers(...args),
    selectRunBoss: battle.selectRunBoss,
    recordSelectedBossInRunStats: battle.recordSelectedBossInRunStats,
    recordBeachSegmentCompleted: battle.recordBeachSegmentCompleted,
    buildHeroFromProgression: foundation.buildHeroFromProgression,
    hasPhoenixBlessing: foundation.hasPhoenixBlessing,
    captureRunStartPermanentState: battle.captureRunStartPermanentState,
    restoreRunStartPermanentState: battle.restoreRunStartPermanentState,
    recordRunStarted: battle.recordRunStarted,
    saveGameSafe: foundation.saveGameSafe,
    syncSelectionFromSave: world.syncSelectionFromSave,
    resetPreparationUiState: world.resetPreparationUiState,
    resetFacilityUiState: world.resetFacilityUiState,
    activateSafeArea: world.activateSafeArea,
    setNavigationContext: foundation.setNavigationContext,
    showScreen,
    showScreenInContext: foundation.showScreenInContext,
    renderRegionScreen: world.renderRegionScreen,
    closeTransientUiPanels: profile.closeTransientUiPanels,
    setCombatActionState: battle.setCombatActionState,
    render: battle.render,
    showBeachSegmentChoice: () => campTransitionController?.showBeachSegmentChoice(),
    flushAchievementUnlockQueue: profile.flushAchievementUnlockQueue,
    showAnpingArrivalStory: (...args) => anpingArrivalController?.showStory(...args),
    applySceneContext: foundation.applySceneContext,
    startEncounter: battle.startEncounter
  });

  const runResultController = createRunResultController({
    state,
    saveStore,
    els,
    windowRef,
    materialDefinitions,
    currentRegion: foundation.currentRegion,
    currentRoute: foundation.currentRoute,
    getAdventureSourceName: foundation.getAdventureSourceName,
    getAdventureEncounterCount: foundation.getAdventureEncounterCount,
    getAdventureEncounterIndex: foundation.getAdventureEncounterIndex,
    getCharacterProgress: foundation.getCharacterProgress,
    hasPhoenixBlessing: foundation.hasPhoenixBlessing,
    resetCharacterProgress: foundation.resetCharacterProgress,
    settleCharacterProgression: foundation.settleCharacterProgression,
    recordRunFinished: battle.recordRunFinished,
    saveGameSafe: foundation.saveGameSafe,
    clearEnemyGroup: battle.clearEnemyGroup,
    clearPendingThreat: battle.clearPendingThreat,
    addLog: battle.addLog,
    render: battle.render,
    closeAbilityInfoPanel: profile.closeAbilityInfoPanel,
    closeBlessingInfoPanel: profile.closeBlessingInfoPanel,
    flushAchievementUnlockQueue: profile.flushAchievementUnlockQueue
  });

  adventureAchievements = createAdventureAchievements({
    state,
    saveStore,
    queueAchievementUnlock: profile.queueAchievementUnlock,
    forestTrialAchievementId: FOREST_TRIAL_ACHIEVEMENT_ID,
    goblinCampClearAchievementId: GOBLIN_CAMP_CLEAR_ACHIEVEMENT_ID,
    beachTrialAchievementId: BEACH_TRIAL_ACHIEVEMENT_ID,
    coastTrialAchievementId: COAST_TRIAL_ACHIEVEMENT_ID,
    saveGameSafe: foundation.saveGameSafe
  });

  campTransitionController = createCampTransitionController({
    state,
    els,
    runStartingFlees: RUN_STARTING_FLEES,
    buildHeroFromProgression: foundation.buildHeroFromProgression,
    clearEnemyGroup: battle.clearEnemyGroup,
    clearPendingThreat: battle.clearPendingThreat,
    render: battle.render,
    finishRun: runResultController.finishRun,
    enterAdventureRoute: runLifecycleController.enterAdventureRoute
  });

  const routeEndingController = createRouteEndingController({
    state,
    saveStore,
    els,
    characterDefinitions,
    currentRoute: foundation.currentRoute,
    clearPendingThreat: battle.clearPendingThreat,
    closeAbilityInfoPanel: profile.closeAbilityInfoPanel,
    closeBlessingInfoPanel: profile.closeBlessingInfoPanel,
    unlockAdventureClearAchievements: adventureAchievements.unlockAdventureClearAchievements,
    unlockCoastClearAchievement: adventureAchievements.unlockCoastClearAchievement,
    recordRunFinished: battle.recordRunFinished,
    finishRun: runResultController.finishRun,
    render: battle.render,
    getEventRuntime
  });

  const blessingController = createBlessingController({
    state,
    els,
    counterEscapeEnemyHealRatio: COUNTER_ESCAPE_ENEMY_HEAL_RATIO,
    getAdventureBlessingDefinitions: foundation.getAdventureBlessingDefinitions,
    addLog: battle.addLog,
    hasPendingThreat: battle.hasPendingThreat,
    resumePendingThreat: battle.resumePendingThreat,
    enterSafeState: runResultController.enterSafeState,
    onBeachBossBlessingChosen: runLifecycleController.openBeachSegmentCheckpoint
  });

  const escapeController = createEscapeController({
    state,
    normalFleeChance: NORMAL_FLEE_CHANCE,
    eliteFleeChance: ELITE_FLEE_CHANCE,
    tacticalFleeResults: TACTICAL_FLEE_RESULTS,
    safeEscapeEnemyHealRatio: SAFE_ESCAPE_ENEMY_HEAL_RATIO,
    restHealRatio: REST_HEAL_RATIO,
    createCombatLogger: battle.createCombatLogger,
    modifyIncomingDirectDamage: battle.modifyIncomingDirectDamage,
    applyEmergencyBandage: battle.applyEmergencyBandage,
    tryLastStand: battle.tryLastStand,
    loseRun: runResultController.loseRun,
    addLog: battle.addLog,
    render: battle.render,
    savePendingThreat: battle.savePendingThreat,
    hasPendingThreat: battle.hasPendingThreat,
    clearPendingThreat: battle.clearPendingThreat,
    consumeBattleLimitedEffects: battle.consumeBattleLimitedEffects,
    enterSafeState: runResultController.enterSafeState,
    buildCounterEnemy: battle.buildCounterEnemy,
    currentRegion: foundation.currentRegion,
    currentRoute: foundation.currentRoute,
    currentTargetEnemy: battle.currentTargetEnemy,
    beginBattleRuntime: battle.beginBattleRuntime,
    finishRun: runResultController.finishRun,
    setCombatActionState: battle.setCombatActionState,
    resumePendingThreat: battle.resumePendingThreat,
    getAdventureEncounterIndex: foundation.getAdventureEncounterIndex,
    getEventRuntime,
    startEncounter: battle.startEncounter
  });

  anpingArrivalController = createAnpingArrivalController({
    state,
    uiState,
    saveStore,
    els,
    documentRef,
    windowRef,
    pages: anpingArrivalPages,
    timing: ANPING_ARRIVAL_TIMING,
    musicManager: foundation.musicManager,
    ambientManager: foundation.ambientManager,
    setNavigationContext: foundation.setNavigationContext,
    closeAbilityInfoPanel: profile.closeAbilityInfoPanel,
    closeBlessingInfoPanel: profile.closeBlessingInfoPanel,
    saveGameSafe: foundation.saveGameSafe,
    returnToSafeArea: runLifecycleController.returnToSafeArea
  });

  const plainsStoryController = createPlainsStoryController({
    state,
    saveStore,
    els,
    documentRef,
    windowRef,
    regionDefinitions,
    storyLineDelayMs: STORY_LINE_DELAY_MS,
    storyFinishExtraDelayMs: STORY_FINISH_EXTRA_DELAY_MS,
    plainsTrialAchievementId: PLAINS_TRIAL_ACHIEVEMENT_ID,
    hasPhoenixBlessing: foundation.hasPhoenixBlessing,
    setNavigationContext: foundation.setNavigationContext,
    clearPendingThreat: battle.clearPendingThreat,
    recordRunFinished: battle.recordRunFinished,
    closeAbilityInfoPanel: profile.closeAbilityInfoPanel,
    closeBlessingInfoPanel: profile.closeBlessingInfoPanel,
    getRunOriginSafeAreaName: runResultController.getRunOriginSafeAreaName,
    returnToRunOriginSafeArea: runLifecycleController.returnToRunOriginSafeArea,
    queueAchievementUnlock: profile.queueAchievementUnlock,
    saveGameSafe: foundation.saveGameSafe,
    render: battle.render
  });

  const encounterVictoryController = createEncounterVictoryController({
    state,
    getEventRuntime,
    hasPendingThreat: battle.hasPendingThreat,
    settleBattleVictory: battle.settleBattleVictory,
    finishCounterEncounterVictory: battle.finishCounterEncounterVictory,
    currentRoute: foundation.currentRoute,
    getAdventureEncounterIndex: foundation.getAdventureEncounterIndex,
    getAdventureEncounterCount: foundation.getAdventureEncounterCount,
    resolvePostEncounterRunPreparation: battle.resolvePostEncounter,
    render: battle.render,
    addLog: battle.addLog,
    getAdventureSourceName: foundation.getAdventureSourceName,
    completeRoute: routeEndingController.completeRoute,
    shouldTriggerPlainsStory: plainsStoryController.shouldTriggerStory,
    showPlainsStory: plainsStoryController.showStory,
    unlockAdventureClearAchievements: adventureAchievements.unlockAdventureClearAchievements,
    finishRun: runResultController.finishRun,
    showBlessings: blessingController.showBlessings
  });

  const duelController = createDuelController({
    state,
    saveStore,
    els,
    storyQuestRuntime: world.storyQuestRuntime,
    buildHeroFromProgression: foundation.buildHeroFromProgression,
    resetAdventureRunRuntime: runLifecycleController.resetAdventureRunRuntime,
    beginBattleRuntime: battle.beginBattleRuntime,
    settleBattleVictory: battle.settleBattleVictory,
    addFixedLog: battle.addFixedLog,
    logCurrentEnemyGroupEncounter: battle.logCurrentEnemyGroupEncounter,
    render: battle.render,
    showScreen,
    showNpcDialogue: world.showNpcDialogue,
    setNavigationContext: foundation.setNavigationContext,
    closeAbilityInfoPanel: profile.closeAbilityInfoPanel,
    closeBlessingInfoPanel: profile.closeBlessingInfoPanel
  });

  function handleBattleVictory() {
    if (duelController.handleBattleVictory()) {
      return;
    }
    encounterVictoryController.winEncounter();
  }

  function handleBattleDefeat() {
    if (duelController.handleBattleDefeat()) {
      return;
    }
    runResultController.loseRun();
  }

  function handleEscapeAction() {
    if (duelController.isDuelActive()) {
      duelController.requestExit();
      return;
    }
    escapeController.tryFlee();
  }

  return Object.freeze({
    runLifecycleController,
    runResultController,
    adventureAchievements,
    routeEndingController,
    campTransitionController,
    blessingController,
    escapeController,
    anpingArrivalController,
    plainsStoryController,
    encounterVictoryController,
    duelController,
    ...runLifecycleController,
    ...runResultController,
    ...adventureAchievements,
    ...routeEndingController,
    ...campTransitionController,
    ...blessingController,
    ...escapeController,
    clearAnpingArrivalTimers: anpingArrivalController.clearTimers,
    closeAnpingArrivalPanel: anpingArrivalController.closePanel,
    showAnpingArrivalStory: anpingArrivalController.showStory,
    revealAnpingArrivalPage: anpingArrivalController.revealPage,
    continueAnpingArrivalStory: anpingArrivalController.continueStory,
    shouldTriggerPlainsStory: plainsStoryController.shouldTriggerStory,
    closeStoryPanel: plainsStoryController.closePanel,
    showPlainsStory: plainsStoryController.showStory,
    revealStoryText: plainsStoryController.revealStoryText,
    completePlainsStory: plainsStoryController.completeStory,
    winEncounter: encounterVictoryController.winEncounter,
    handleBattleVictory,
    handleBattleDefeat,
    handleEscapeAction,
    startDuel: duelController.startDuel,
    requestDuelExit: duelController.requestExit,
    cancelDuelExit: duelController.cancelExit,
    confirmDuelExit: duelController.confirmExit,
    prepareDuelEnemyAction: duelController.prepareEnemyAction,
    completeDuelEnemyAction: duelController.completeEnemyAction,
    isDuelActive: duelController.isDuelActive
  });
}
