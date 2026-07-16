import { DEFAULT_CHARACTER_ID, DEFAULT_REGION_ID } from "../config.js";
import { characterDefinitions } from "../data/characters/index.js";
import { regionDefinitions } from "../data/regions/index.js";
import { createDebugCharacterActions } from "./characterActions.js";
import { createDebugInventoryActions } from "./inventoryActions.js";
import { createDebugSafeAreaActions } from "./safeAreaActions.js";
import { createDebugScenarioActions } from "./scenarioActions.js";
import {
  createDebugBuildProfile,
  getDebugBuildProfiles,
  getDebugMidChoices,
  getDebugRouteEntryOptions,
  getDebugScenarioBuildSlots,
  getDebugScenarioCatalog
} from "./scenarios.js";

export function createDebugRuntimeActions(host) {
  const refresh = () => refreshAfterDebugChange(host);
  const rebuildHero = () => rebuildDebugHero(host);
  const clampInteger = (value, min, max) => clampDebugInteger(value, min, max);
  const prepareRunForRegion = (regionId, encounterIndex, options = {}) => {
    prepareDebugRunForRegion(host, regionId, encounterIndex, options);
  };

  const characterActions = createDebugCharacterActions({
    ...host,
    refresh,
    rebuildHero,
    clampInteger
  });
  const inventoryActions = createDebugInventoryActions({
    ...host,
    refresh
  });
  const scenarioActions = createDebugScenarioActions({
    ...host,
    prepareRunForRegion,
    clampInteger
  });
  const safeAreaActions = createDebugSafeAreaActions(host);

  return {
    ...characterActions,
    ...inventoryActions,
    getScenarioCatalog: getDebugScenarioCatalog,
    getRouteEntryOptions: getDebugRouteEntryOptions,
    getMidChoices: getDebugMidChoices,
    getBuildProfiles: getDebugBuildProfiles,
    getScenarioBuildSlots: getDebugScenarioBuildSlots,
    createBuildProfile: createDebugBuildProfile,
    ...scenarioActions,
    ...safeAreaActions
  };
}

function prepareDebugRunForRegion(host, regionId, encounterIndex, options = {}) {
  const {
    state,
    els,
    getSaveData,
    saveGameSafe,
    syncSelectionFromSave,
    initializeRunRuntime,
    buildHeroFromProgression,
    closeTransientUiPanels,
    showScreen
  } = host;
  const saveData = getSaveData();
  if (options.persistSelection === false) {
    const characterId = options.characterId || options.hero?.characterId || saveData.settings.selectedCharacterId;
    setRuntimeSelection(state, regionId, characterId);
  } else {
    saveData.settings.selectedRegionId = regionId;
    saveGameSafe();
    syncSelectionFromSave();
  }

  initializeRunRuntime({
    hero: options.hero || buildHeroFromProgression(state.selectedHeroId),
    encounterIndex,
    debugBuildRun: options.debugBuildRun,
    bossId: options.bossId
  });
  closeTransientUiPanels();
  els.nextButton.disabled = false;
  showScreen("gameScreen");
}

function setRuntimeSelection(state, regionId, characterId) {
  const resolvedRegionId = regionDefinitions[regionId] ? regionId : DEFAULT_REGION_ID;
  const resolvedCharacterId = characterDefinitions[characterId] ? characterId : DEFAULT_CHARACTER_ID;
  state.selectedRegionId = resolvedRegionId;
  state.selectedHeroId = resolvedCharacterId;
  state.selectedRegion = regionDefinitions[resolvedRegionId].name;
  state.selectedHero = characterDefinitions[resolvedCharacterId].name;
}

function rebuildDebugHero({ state, buildHeroFromProgression, runStartingFlees }) {
  if (!state.hero) return;
  const fleesRemaining = state.hero.fleesRemaining;
  const poison = state.hero.poison || 0;
  state.hero = buildHeroFromProgression(state.selectedHeroId);
  state.hero.fleesRemaining = fleesRemaining ?? runStartingFlees;
  state.hero.poison = poison;
}

function refreshAfterDebugChange({ state, render, showScreen, documentRef = document }) {
  const activeScreen = documentRef.querySelector(".screen.is-active")?.id;
  if (activeScreen === "gameScreen" && state.hero) {
    render();
    return;
  }
  if (activeScreen) showScreen(activeScreen);
}

function clampDebugInteger(value, min, max) {
  const parsed = Number.isFinite(value) ? Math.floor(value) : min;
  return Math.max(min, Math.min(max, parsed));
}
