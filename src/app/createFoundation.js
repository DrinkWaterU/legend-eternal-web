import { createAdventureRuntimeState, createUiState } from "./runtimeState.js";
import { createSaveStore } from "./saveStore.js";
import { createSaveActions } from "./saveActions.js";
import { createSaveTransactions } from "./saveTransactions.js";
import { createAdventureSaveActions } from "./adventureSaveActions.js";
import { createSaveTransactionView } from "../ui/saveTransactionView.js";
import { createNavigationContext } from "./navigationContext.js";
import { createSceneController } from "./sceneController.js";
import { createAdventureSource } from "../features/adventure/adventureSource.js";
import { createCharacterProgression } from "../features/character/characterProgression.js";
import { createMusicManager } from "../audio/musicManager.js";
import { loadSave, saveGame } from "../core/storage.js";
import { characterDefinitions } from "../data/characters/index.js";
import { weaponDefinitions } from "../data/weapons.js";
import { regionDefinitions } from "../data/regions/index.js";
import { getRouteDefinition, getRouteGroup } from "../data/routes/index.js";
import { getEnemyDefinition } from "../data/enemies/index.js";
import { getBlessingPool } from "../data/blessings/index.js";
import { musicDefinitions } from "../data/music.js";
import { ambientAudioDefinitions } from "../data/ambientAudio.js";
import { createSaveRecoveryNotice } from "../ui/saveRecoveryView.js";
import { DEFAULT_SAFE_AREA_ID } from "../data/safeAreas.js";

export function createFoundation({
  documentRef = document,
  addLog,
  addFixedLog,
  showScreen,
  getCurrentSafeArea
}) {
  const state = createAdventureRuntimeState({ regionDefinitions, characterDefinitions });
  const uiState = createUiState();
  const currentRegion = () => regionDefinitions[state.selectedRegionId];
  const showSaveError = createSaveRecoveryNotice(documentRef);
  const saveStore = createSaveStore({ initialSave: loadSave({ onError: showSaveError }), persistSave: saveGame });
  const saveActions = createSaveActions({ state, saveStore, addFixedLog, showSaveError });
  const saveTransactions = createSaveTransactions({ saveStore, pendingView: createSaveTransactionView(documentRef) });
  const adventureSaveActions = createAdventureSaveActions({ saveStore, ...saveTransactions, state });

  const characterProgression = createCharacterProgression({
    state,
    saveStore,
    characterDefinitions,
    weaponDefinitions,
    addLog,
    saveGameSafe: saveActions.saveGameSafe
  });

  const musicManager = createMusicManager({ trackDefinitions: musicDefinitions });
  const ambientManager = createMusicManager({
    trackDefinitions: ambientAudioDefinitions,
    trackLabel: "環境音"
  });

  const adventureSource = createAdventureSource({
    state,
    getCurrentRegion: currentRegion,
    getRouteDefinition,
    getRouteGroup,
    getEnemyDefinition,
    getBlessingPool,
    documentRef
  });

  const navigationContext = createNavigationContext({ uiState, showScreen });
  const sceneController = createSceneController({
    state,
    uiState,
    documentRef,
    defaultSafeAreaId: DEFAULT_SAFE_AREA_ID,
    getNavigationContext: navigationContext.getNavigationContext,
    getCurrentSafeArea,
    currentAdventureSource: adventureSource.currentAdventureSource,
    getAdventureEncounterIndex: adventureSource.getAdventureEncounterIndex,
    musicManager,
    ambientManager
  });

  return Object.freeze({
    state,
    uiState,
    saveStore,
    currentRegion,
    ...saveActions,
    ...saveTransactions,
    ...adventureSaveActions,
    ...characterProgression,
    musicManager,
    ambientManager,
    ...adventureSource,
    ...navigationContext,
    ...sceneController
  });
}
