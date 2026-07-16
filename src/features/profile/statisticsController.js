import { DEFAULT_CHARACTER_ID, DEFAULT_REGION_ID } from "../../config.js";
import { resolveEquippedWeapon } from "../../core/equipment.js";
import { renderStatisticsView } from "../../ui/statisticsView.js";

export function createStatisticsController({
  uiState,
  saveStore,
  els,
  characterDefinitions,
  regionDefinitions,
  weaponDefinitions,
  getCharacterProgress,
  getNavigationReturnTarget,
  setNavigationContext,
  showScreen,
  setReturnButton
}) {
  function renderStatistics() {
    setReturnButton(els.statisticsScreen.querySelector(".back-button"), getNavigationReturnTarget());
    const equippedWeaponsByCharacterId = Object.fromEntries(
      Object.entries(characterDefinitions).map(([characterId, character]) => [
        characterId,
        resolveEquippedWeapon({
          character,
          progress: getCharacterProgress(characterId),
          inventory: saveStore.current.inventory,
          weaponDefinitions
        })
      ])
    );
    renderStatisticsView({
      els,
      uiState,
      saveData: saveStore.current,
      characterDefinitions,
      regionDefinitions,
      equippedWeaponsByCharacterId,
      onCharacterSelect: showStatisticsCharacterDetail,
      onRegionSelect: showStatisticsRegionDetail
    });
  }

  function showStatisticsScreen(contextId = uiState.navigationContext) {
    setNavigationContext(contextId);
    uiState.statisticsView = "overview";
    showScreen("statisticsScreen");
  }

  function showStatisticsView(view) {
    uiState.statisticsView = view;
    renderStatistics();
  }

  function showStatisticsCharacterDetail(characterId = DEFAULT_CHARACTER_ID) {
    uiState.statisticsCharacterId = characterId;
    uiState.statisticsView = "characters";
    renderStatistics();
  }

  function showStatisticsRegionDetail(regionId = DEFAULT_REGION_ID) {
    uiState.statisticsRegionId = regionId;
    uiState.statisticsView = "regions";
    renderStatistics();
  }

  function resetStatisticsUiAfterSaveReplacement() {
    uiState.statisticsView = "overview";
    uiState.statisticsCharacterId = saveStore.current.settings.selectedCharacterId || DEFAULT_CHARACTER_ID;
    uiState.statisticsRegionId = saveStore.current.settings.selectedRegionId || DEFAULT_REGION_ID;
  }

  return Object.freeze({
    renderStatistics,
    showStatisticsScreen,
    showStatisticsView,
    showStatisticsCharacterDetail,
    showStatisticsRegionDetail,
    resetStatisticsUiAfterSaveReplacement
  });
}
