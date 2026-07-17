import { normalizeInventory } from "../../core/rewards.js";
import { renderStorageView } from "../../ui/storageView.js";

export function createStorageController({
  uiState,
  saveStore,
  els,
  materialDefinitions,
  materialUsageIndex,
  getCurrentSafeArea,
  getNavigationReturnTarget,
  setReturnButton
}) {
  function renderStorageScreen() {
    const inventory = normalizeInventory(saveStore.current.inventory);
    els.storageSafeAreaEyebrow.textContent = getCurrentSafeArea()?.name || "安全區";
    setReturnButton(els.storageBackButton, getNavigationReturnTarget());
    const result = renderStorageView({
      els,
      inventory,
      materialDefinitions,
      usageIndex: materialUsageIndex,
      sortMode: uiState.storageSortMode,
      sortDirection: uiState.storageSortDirection,
      searchQuery: uiState.storageSearchQuery,
      rarityFilter: uiState.storageRarityFilter,
      selectedMaterialId: uiState.storageSelectedMaterialId,
      usageFilter: uiState.storageUsageFilter,
      expandedUsageIds: uiState.storageExpandedUsageIds,
      onSortChange: (sortMode) => updateAndRender("storageSortMode", sortMode),
      onDirectionChange: (sortDirection) => updateAndRender("storageSortDirection", sortDirection),
      onSearchChange: (searchQuery) => updateAndRender("storageSearchQuery", searchQuery),
      onRarityChange: (rarityFilter) => updateAndRender("storageRarityFilter", rarityFilter),
      onMaterialSelect: selectMaterial,
      onUsageFilterChange: (usageFilter) => updateAndRender("storageUsageFilter", usageFilter),
      onUsageToggle: toggleUsage,
      onClearFilters: clearFilters
    });
    uiState.storageSelectedMaterialId = result.selectedMaterialId;
    uiState.storageUsageFilter = result.usageFilter;
  }

  function updateAndRender(key, value) {
    uiState[key] = value;
    renderStorageScreen();
  }

  function selectMaterial(materialId) {
    if (uiState.storageSelectedMaterialId !== materialId) {
      uiState.storageUsageFilter = "all";
      uiState.storageExpandedUsageIds = new Set();
    }
    uiState.storageSelectedMaterialId = materialId;
    renderStorageScreen();
  }

  function toggleUsage(usageId) {
    const nextExpanded = new Set(uiState.storageExpandedUsageIds);
    if (nextExpanded.has(usageId)) {
      nextExpanded.delete(usageId);
    } else {
      nextExpanded.add(usageId);
    }
    uiState.storageExpandedUsageIds = nextExpanded;
    renderStorageScreen();
  }

  function clearFilters() {
    uiState.storageSearchQuery = "";
    uiState.storageRarityFilter = "all";
    renderStorageScreen();
  }

  return Object.freeze({ renderStorageScreen });
}
