import { createAudioSettingsController } from "./audioSettingsController.js";
import { createReturnButtonController } from "./returnButton.js";
import { createCharacterController } from "../features/character/characterController.js";
import { createRegionController } from "../features/adventure/regionController.js";
import { createSafeAreaController } from "../features/safeArea/safeAreaController.js";
import { createCampController } from "../features/safeArea/campController.js";
import { createFacilityController } from "../features/facility/facilityController.js";
import { createStorageController } from "../features/profile/storageController.js";
import { characterDefinitions } from "../data/characters/index.js";
import { regionDefinitions } from "../data/regions/index.js";
import { materialDefinitions } from "../data/materials.js";
import { weaponCategoryDefinitions, weaponDefinitions } from "../data/weapons.js";
import { facilityDefinitions } from "../data/facilities.js";
import { dialogueDefinitions } from "../data/dialogues.js";
import { getNpcDefinition, npcDefinitions } from "../data/npcs.js";
import { getSafeAreaDefinition } from "../data/safeAreas.js";
import { buildMaterialUsageIndex } from "../ui/materialUsage.js";
import { questDefinitions } from "../data/quests.js";
import { createQuestRuntime } from "../features/quest/questRuntime.js";
import { createStoryQuestRuntime } from "../features/storyQuest/storyQuestRuntime.js";
import { createStoryQuestController } from "../features/storyQuest/storyQuestController.js";
import { storyQuestDefinitions } from "../data/storyQuests.js";

export function createWorldFeatures({
  foundation,
  els,
  documentRef = document,
  showScreen,
  showAnpingArrivalStory,
  startDuel
}) {
  const {
    state,
    uiState,
    saveStore,
    currentRegion,
    saveGameSafe,
    setDialogueStoryFlag,
    musicManager,
    ambientManager,
    setNavigationContext,
    getNavigationReturnTarget,
    showScreenInContext,
    getCharacterProgress,
    normalizeCharacterProgress,
    buildHeroFromProgression,
    hasPhoenixBlessing
  } = foundation;

  let returnButtonController;
  const setReturnButton = (...args) => returnButtonController.setReturnButton(...args);
  const materialUsageIndex = buildMaterialUsageIndex({ regionDefinitions, weaponDefinitions });
  const storyQuestRuntime = createStoryQuestRuntime({
    saveStore,
    storyQuestDefinitions,
    characterDefinitions,
    weaponDefinitions,
    materialDefinitions,
    saveGameSafe
  });

  const characterController = createCharacterController({
    state,
    uiState,
    saveStore,
    els,
    characterDefinitions,
    regionDefinitions,
    weaponDefinitions,
    weaponCategoryDefinitions,
    saveGameSafe,
    setNavigationContext,
    getNavigationReturnTarget,
    showScreen,
    setReturnButton,
    getCharacterProgress,
    normalizeCharacterProgress,
    buildHeroFromProgression
  });

  const audioSettingsController = createAudioSettingsController({
    saveStore,
    musicManager,
    ambientManager,
    els,
    saveGameSafe
  });

  const regionController = createRegionController({
    state,
    uiState,
    saveStore,
    els,
    documentRef,
    regionDefinitions,
    characterDefinitions,
    materialDefinitions,
    saveGameSafe,
    syncSelectionFromSave: characterController.syncSelectionFromSave,
    setNavigationContext,
    getNavigationReturnTarget,
    showScreen,
    setReturnButton,
    currentRegion,
    normalizeCharacterProgress,
    hasPhoenixBlessing
  });

  const storageController = createStorageController({
    uiState,
    saveStore,
    els,
    materialDefinitions,
    materialUsageIndex,
    getCurrentSafeArea: () => safeAreaController.getCurrentSafeArea(),
    getNavigationReturnTarget,
    setReturnButton
  });

  const safeAreaController = createSafeAreaController({
    uiState,
    saveStore,
    els,
    documentRef,
    saveGameSafe,
    resetPreparationUiState: regionController.resetPreparationUiState,
    syncSelectionFromSave: characterController.syncSelectionFromSave,
    showScreenInContext,
    setReturnButton,
    hasPhoenixBlessing,
    showAnpingArrivalStory,
    storyQuestRuntime
  });

  returnButtonController = createReturnButtonController({
    getCurrentSafeArea: safeAreaController.getCurrentSafeArea
  });

  const campController = createCampController({
    state,
    saveStore,
    els,
    characterDefinitions,
    materialDefinitions,
    currentRegion,
    normalizeCharacterProgress,
    getCurrentSafeArea: safeAreaController.getCurrentSafeArea,
    getAvailableFacilities: safeAreaController.getAvailableFacilities,
    hasPhoenixBlessing,
    renderCampTravelButton: safeAreaController.renderCampTravelButton,
    storyQuestRuntime
  });

  const questRuntime = createQuestRuntime({
    saveStore,
    questDefinitions,
    materialDefinitions,
    saveGameSafe
  });

  const facilityController = createFacilityController({
    uiState,
    saveStore,
    els,
    characterDefinitions,
    materialDefinitions,
    weaponDefinitions,
    weaponCategoryDefinitions,
    npcDefinitions,
    dialogueDefinitions,
    questDefinitions,
    questRuntime,
    getCurrentSafeArea: safeAreaController.getCurrentSafeArea,
    getSafeAreaDefinition,
    getAvailableFacilities: safeAreaController.getAvailableFacilities,
    activateSafeArea: safeAreaController.activateSafeArea,
    setNavigationContext,
    showScreen,
    saveGameSafe,
    setDialogueStoryFlag,
    startDuel
  });

  const storyQuestController = createStoryQuestController({
    els,
    storyQuestRuntime,
    getCurrentSafeArea: safeAreaController.getCurrentSafeArea,
    setNavigationContext,
    showScreen,
    setReturnButton
  });

  Object.values(facilityDefinitions).forEach((facility) => {
    if (!facilityController.supportsAction(facility.actionId)) {
      throw new Error(`Facility ${facility.id} 使用未知 actionId：${facility.actionId}`);
    }
    if (facility.npcId && !getNpcDefinition(facility.npcId)) {
      throw new Error(`Facility ${facility.id} 使用未知 npcId：${facility.npcId}`);
    }
  });

  return Object.freeze({
    characterController,
    audioSettingsController,
    regionController,
    storageController,
    safeAreaController,
    campController,
    facilityController,
    questRuntime,
    storyQuestRuntime,
    setReturnButton,
    ...characterController,
    ...audioSettingsController,
    ...regionController,
    ...storageController,
    ...safeAreaController,
    ...campController,
    ...storyQuestController,
    ...facilityController
  });
}
