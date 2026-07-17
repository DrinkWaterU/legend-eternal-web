import { ACHIEVEMENT_TOAST_DURATION_MS } from "./runtimeConstants.js";
import { createStatisticsController } from "../features/profile/statisticsController.js";
import { createAchievementController } from "../features/profile/achievementController.js";
import { createSaveTransferController } from "../features/profile/saveTransferController.js";
import { createOverlayController } from "../features/ui/overlayController.js";
import { achievementDefinitions } from "../data/achievements.js";
import { characterDefinitions } from "../data/characters/index.js";
import { regionDefinitions } from "../data/regions/index.js";
import { weaponDefinitions } from "../data/weapons.js";
import { getRouteDefinition } from "../data/routes/index.js";

export function createProfileFeatures({
  foundation,
  world,
  els,
  windowRef = window,
  showScreen,
  resetAdventureRunRuntime,
  closeStoryPanel,
  closeAnpingArrivalPanel
}) {
  const {
    state,
    uiState,
    saveStore,
    currentRegion,
    saveGameSafe,
    getNavigationReturnTarget,
    setNavigationContext
  } = foundation;

  const statisticsController = createStatisticsController({
    uiState,
    saveStore,
    els,
    characterDefinitions,
    regionDefinitions,
    weaponDefinitions,
    getCharacterProgress: foundation.getCharacterProgress,
    getNavigationReturnTarget,
    setNavigationContext,
    showScreen,
    setReturnButton: world.setReturnButton
  });

  const achievementController = createAchievementController({
    state,
    uiState,
    saveStore,
    els,
    windowRef,
    achievementDefinitions,
    regionDefinitions,
    getRouteDefinition,
    getNavigationReturnTarget,
    setReturnButton: world.setReturnButton,
    toastDurationMs: ACHIEVEMENT_TOAST_DURATION_MS
  });

  const saveTransferController = createSaveTransferController({
    saveStore,
    els,
    saveGameSafe,
    syncSafeAreaUiFromSave: world.syncSafeAreaUiFromSave,
    syncSelectionFromSave: world.syncSelectionFromSave,
    syncMusicSettingsFromSave: world.syncMusicSettingsFromSave,
    resetAdventureRunRuntime,
    resetPreparationUiState: world.resetPreparationUiState,
    resetAchievementUiRuntime: achievementController.resetAchievementUiRuntime,
    resetFacilityUiState: world.resetFacilityUiState,
    resetStatisticsUiAfterSaveReplacement: statisticsController.resetStatisticsUiAfterSaveReplacement,
    renderStatistics: statisticsController.renderStatistics
  });

  const overlayController = createOverlayController({
    state,
    els,
    currentRegion,
    questRuntime: world.questRuntime,
    closeLockedCharacterHint: world.closeLockedCharacterHint,
    closeAchievementDetailPanel: achievementController.closeAchievementDetailPanel,
    facilityController: world.facilityController,
    closeExportSaveCodeDialog: saveTransferController.closeExportSaveCodeDialog,
    closeImportSaveCodeDialog: saveTransferController.closeImportSaveCodeDialog,
    closeDeleteSaveDialog: saveTransferController.closeDeleteSaveDialog,
    closeStoryPanel,
    closeAnpingArrivalPanel
  });

  return Object.freeze({
    statisticsController,
    achievementController,
    saveTransferController,
    overlayController,
    ...statisticsController,
    ...achievementController,
    ...saveTransferController,
    ...overlayController
  });
}
