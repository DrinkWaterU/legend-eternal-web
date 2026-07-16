import { renderStatisticsOverview } from "./statisticsOverviewView.js";
import { renderStatisticsCharacterBrowser } from "./statisticsCharacterView.js";
import { renderStatisticsRegionBrowser } from "./statisticsRegionView.js";

export function renderStatisticsView({
  els,
  uiState,
  saveData,
  characterDefinitions,
  regionDefinitions,
  equippedWeaponsByCharacterId = {},
  onCharacterSelect,
  onRegionSelect
}) {
  const activeView = ["overview", "characters", "regions", "save"].includes(uiState.statisticsView)
    ? uiState.statisticsView
    : "overview";
  uiState.statisticsView = activeView;
  const views = {
    overview: els.statisticsOverviewView,
    characters: els.statisticsCharacterListView,
    regions: els.statisticsRegionListView,
    save: els.statisticsSaveView
  };
  Object.entries(views).forEach(([view, element]) => {
    element.classList.toggle("is-active", activeView === view);
  });
  els.statisticsTabs.forEach((button) => {
    const active = button.dataset.statisticsView === activeView;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });

  if (activeView === "overview") {
    renderStatisticsOverview(els, saveData.statistics || {});
  } else if (activeView === "characters") {
    renderStatisticsCharacterBrowser({
      els,
      uiState,
      saveData,
      characterDefinitions,
      equippedWeaponsByCharacterId,
      onCharacterSelect
    });
  } else if (activeView === "regions") {
    renderStatisticsRegionBrowser({ els, uiState, saveData, regionDefinitions, onRegionSelect });
  }
}
