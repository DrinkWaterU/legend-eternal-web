import { createFoundation } from "./createFoundation.js";
import { createWorldFeatures } from "./createWorldFeatures.js";
import { createProfileFeatures } from "./createProfileFeatures.js";
import { createBattleFeatures } from "./createBattleFeatures.js";
import { createAdventureFeatures } from "./createAdventureFeatures.js";
import { createScreenController } from "./screenController.js";
import { createRuntimeIntegrations } from "./runtimeIntegrations.js";
import { bindApplicationEvents } from "./eventBindings.js";
import { validateGameDefinitions } from "./validateGameDefinitions.js";
import { isDebugModeEnabled } from "./debugMode.js";
import { PLAINS_TRIAL_ACHIEVEMENT_ID, RUN_STARTING_FLEES } from "./runtimeConstants.js";
import { els } from "../ui/dom.js";
import { initDebugPanel } from "../ui/debugPanel.js";

export function createApplication({ documentRef = document, windowRef = window } = {}) {
  validateGameDefinitions();

  let world;
  let profile;
  let battle;
  let adventure;
  let screen;
  let eventRuntime = null;

  const foundation = createFoundation({
    documentRef,
    addLog: (...args) => battle.addLog(...args),
    addFixedLog: (...args) => battle.addFixedLog(...args),
    showScreen: (...args) => screen.showScreen(...args),
    getCurrentSafeArea: (...args) => world.getCurrentSafeArea(...args)
  });

  world = createWorldFeatures({
    foundation,
    els,
    documentRef,
    showScreen: (...args) => screen.showScreen(...args),
    showAnpingArrivalStory: (...args) => adventure.showAnpingArrivalStory(...args)
  });

  profile = createProfileFeatures({
    foundation,
    world,
    els,
    windowRef,
    showScreen: (...args) => screen.showScreen(...args),
    resetAdventureRunRuntime: (...args) => adventure.resetAdventureRunRuntime(...args),
    closeStoryPanel: (...args) => adventure.closeStoryPanel(...args),
    closeAnpingArrivalPanel: (...args) => adventure.closeAnpingArrivalPanel(...args)
  });

  battle = createBattleFeatures({
    foundation,
    world,
    els,
    showBlessings: (...args) => adventure.showBlessings(...args),
    winEncounter: (...args) => adventure.winEncounter(...args),
    loseRun: (...args) => adventure.loseRun(...args)
  });

  adventure = createAdventureFeatures({
    foundation,
    world,
    profile,
    battle,
    els,
    documentRef,
    windowRef,
    getEventRuntime: () => eventRuntime,
    showScreen: (...args) => screen.showScreen(...args)
  });

  screen = createScreenController({
    state: foundation.state,
    saveStore: foundation.saveStore,
    documentRef,
    els,
    syncRootScreenContext: foundation.syncRootScreenContext,
    applySceneContext: foundation.applySceneContext,
    getCurrentSafeArea: world.getCurrentSafeArea,
    facilityController: world.facilityController,
    renderMenuScreen: world.renderMenuScreen,
    renderCampScreen: world.renderCampScreen,
    renderSafeAreaTravelScreen: world.renderSafeAreaTravelScreen,
    renderStorageScreen: world.renderStorageScreen,
    renderFacilityScreen: world.renderFacilityScreen,
    renderRegionScreen: world.renderRegionScreen,
    renderCharacterScreen: world.renderCharacterScreen,
    renderAchievementScreen: profile.renderAchievementScreen,
    renderStatistics: profile.renderStatistics
  });

  const integrations = createRuntimeIntegrations({
    eventDependencies: createEventDependencies({ foundation, battle, adventure }),
    debugDependencies: createDebugDependencies({
      foundation,
      world,
      profile,
      battle,
      adventure,
      screen,
      windowRef
    })
  });
  eventRuntime = integrations.eventRuntime;

  function start() {
    world.syncSafeAreaUiFromSave();
    world.syncSelectionFromSave();
    world.syncMusicSettingsFromSave();
    bindApplicationEvents({
      els,
      documentRef,
      state: foundation.state,
      uiState: foundation.uiState,
      actions: createEventActions({ foundation, world, profile, battle, adventure, screen })
    });
    initDebugPanel({
      enabled: isDebugModeEnabled(windowRef),
      actions: integrations.debugActions
    });
    foundation.applySceneContext("menuScreen");
  }

  return Object.freeze({ start });
}

function createEventDependencies({ foundation, battle, adventure }) {
  return {
    state: foundation.state,
    els,
    getSaveData: () => foundation.saveStore.current,
    currentRegion: foundation.currentRegion,
    getAdventureSourceName: foundation.getAdventureSourceName,
    clearEnemyGroup: battle.clearEnemyGroup,
    setCombatActionState: battle.setCombatActionState,
    applySceneContext: foundation.applySceneContext,
    beginBattleRuntime: battle.beginBattleRuntime,
    addFixedLog: battle.addFixedLog,
    logCurrentEnemyGroupEncounter: battle.logCurrentEnemyGroupEncounter,
    applyEnemyAmbushes: battle.applyEnemyAmbushes,
    addLog: battle.addLog,
    render: battle.render,
    grantBlessing: adventure.grantBlessing,
    hasPhoenixBlessing: foundation.hasPhoenixBlessing,
    saveGameSafe: foundation.saveGameSafe,
    loseRun: adventure.loseRun,
    startEncounter: battle.startEncounter,
    enterAdventureRoute: adventure.enterAdventureRoute,
    showBlessings: adventure.showBlessings
  };
}

function createDebugDependencies({ foundation, world, profile, battle, adventure, screen, windowRef }) {
  return {
    state: foundation.state,
    els,
    getSaveData: () => foundation.saveStore.current,
    replaceSaveData: (nextSaveData) => {
      foundation.saveStore.replace(nextSaveData);
      profile.resetAchievementUiRuntime();
      world.syncSafeAreaUiFromSave();
    },
    isDebugModeEnabled: () => isDebugModeEnabled(windowRef),
    getCharacterDefinition: foundation.getCharacterDefinition,
    buildHeroFromProgression: foundation.buildHeroFromProgression,
    unlockAchievement: profile.unlockAchievement,
    plainsTrialAchievementId: PLAINS_TRIAL_ACHIEVEMENT_ID,
    saveGameSafe: foundation.saveGameSafe,
    render: battle.render,
    initializeRunRuntime: adventure.initializeRunRuntime,
    currentRegion: foundation.currentRegion,
    beginBattleRuntime: battle.beginBattleRuntime,
    addFixedLog: battle.addFixedLog,
    logCurrentEnemyGroupEncounter: battle.logCurrentEnemyGroupEncounter,
    addLog: battle.addLog,
    enterSafeState: adventure.enterSafeState,
    startEncounter: battle.startEncounter,
    showPlainsStory: adventure.showPlainsStory,
    showRouteEnding: adventure.showRouteEnding,
    getRouteBossDefinition: foundation.getRouteBossDefinition,
    recordSelectedBossInRunStats: battle.recordSelectedBossInRunStats,
    applySceneContext: foundation.applySceneContext,
    consumeBattleLimitedEffects: battle.consumeBattleLimitedEffects,
    returnToCamp: adventure.returnToCamp,
    returnToSafeArea: adventure.returnToSafeArea,
    showAnpingArrivalStory: adventure.showAnpingArrivalStory,
    showSafeAreaTravelScreen: world.showSafeAreaTravelScreen,
    showGuildQuestIntroduction: world.showGuildQuestIntroduction,
    showGuildQuestFacility: world.showGuildQuestFacility,
    syncSafeAreaUiFromSave: world.syncSafeAreaUiFromSave,
    syncSelectionFromSave: world.syncSelectionFromSave,
    restart: adventure.restart,
    syncMusicSettingsFromSave: world.syncMusicSettingsFromSave,
    closeTransientUiPanels: profile.closeTransientUiPanels,
    showScreen: screen.showScreen,
    runStartingFlees: RUN_STARTING_FLEES
  };
}

function createEventActions({ foundation, world, profile, battle, adventure, screen }) {
  return {
    showScreen: screen.showScreen,
    showScreenInContext: foundation.showScreenInContext,
    showCharacterList: world.showCharacterList,
    showStatisticsScreen: profile.showStatisticsScreen,
    toggleMusicEnabled: world.toggleMusicEnabled,
    previewMusicVolume: world.previewMusicVolume,
    commitMusicVolume: world.commitMusicVolume,
    setNavigationContext: foundation.setNavigationContext,
    showRegionDetail: world.showRegionDetail,
    showRegionList: world.showRegionList,
    showFacilityList: world.showFacilityList,
    showSafeAreaTravelScreen: world.showSafeAreaTravelScreen,
    handleSafeAreaTravel: world.handleSafeAreaTravel,
    restart: adventure.restart,
    getNavigationReturnTarget: foundation.getNavigationReturnTarget,
    handleBlacksmithBack: world.handleBlacksmithBack,
    handleGuildRecordBack: world.handleGuildRecordBack,
    handleGuildQuestBack: world.handleGuildQuestBack,
    handleGuildBulkBack: world.handleGuildBulkBack,
    showCharacterDetail: world.showCharacterDetail,
    showCharacterEquipment: world.showCharacterEquipment,
    renderCharacterScreen: world.renderCharacterScreen,
    showStatisticsView: profile.showStatisticsView,
    selectCharacterFromDetail: world.selectCharacterFromDetail,
    closeLockedCharacterHint: world.closeLockedCharacterHint,
    startPlayerRun: adventure.startPlayerRun,
    handleEndPrimaryAction: adventure.handleEndPrimaryAction,
    closeEndPanel: profile.closeEndPanel,
    revealStoryText: adventure.revealStoryText,
    completePlainsStory: adventure.completePlainsStory,
    revealAnpingArrivalPage: adventure.revealAnpingArrivalPage,
    continueAnpingArrivalStory: adventure.continueAnpingArrivalStory,
    playTurn: battle.playTurn,
    tryFlee: adventure.tryFlee,
    continueAdventure: adventure.continueAdventure,
    handleEventContinueButton: adventure.handleEventContinueButton,
    restAtSafeRoute: adventure.restAtSafeRoute,
    retreatRun: adventure.retreatRun,
    openAbilityInfoPanel: profile.openAbilityInfoPanel,
    closeAbilityInfoPanel: profile.closeAbilityInfoPanel,
    openBlessingInfoPanel: profile.openBlessingInfoPanel,
    closeBlessingInfoPanel: profile.closeBlessingInfoPanel,
    openQuestInfoPanel: profile.openQuestInfoPanel,
    closeQuestInfoPanel: profile.closeQuestInfoPanel,
    openExportSaveCodeDialog: profile.openExportSaveCodeDialog,
    openImportSaveCodeDialog: profile.openImportSaveCodeDialog,
    copySaveCode: profile.copySaveCode,
    downloadSaveFile: profile.downloadSaveFile,
    closeExportSaveCodeDialog: profile.closeExportSaveCodeDialog,
    chooseSaveFile: profile.chooseSaveFile,
    handleSaveFileSelected: profile.handleSaveFileSelected,
    checkImportSaveCode: profile.checkImportSaveCode,
    confirmImportSaveCode: profile.confirmImportSaveCode,
    closeImportSaveCodeDialog: profile.closeImportSaveCodeDialog,
    openDeleteSaveDialog: profile.openDeleteSaveDialog,
    deleteSave: profile.deleteSave,
    closeDeleteSaveDialog: profile.closeDeleteSaveDialog,
    closeAchievementDetailPanel: profile.closeAchievementDetailPanel,
    closeAchievementUnlockToast: profile.closeAchievementUnlockToast,
    facilityController: world.facilityController,
    handleUserInteraction: world.audioSettingsController.handleUserInteraction
  };
}
