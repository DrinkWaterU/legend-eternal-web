import {
  canEnterSafeArea,
  getCurrentSafeAreaId,
  isSafeAreaUnlocked,
  isSafeAreaVisited,
  setCurrentSafeArea
} from "../../core/safeAreaProgression.js";
import { getFacilityDefinition } from "../../data/facilities.js";
import { getNpcDefinition, resolveNpcDisplayName } from "../../data/npcs.js";
import {
  ANPING_TOWN_SAFE_AREA_ID,
  DEFAULT_SAFE_AREA_ID,
  getSafeAreaDefinition,
  getSafeAreaDefinitions
} from "../../data/safeAreas.js";

export function createSafeAreaController({
  uiState,
  saveStore,
  els,
  documentRef = document,
  saveGameSafe,
  resetPreparationUiState,
  syncSelectionFromSave,
  showScreenInContext,
  setReturnButton,
  hasPhoenixBlessing,
  showAnpingArrivalStory,
  storyQuestRuntime
}) {
  function syncSafeAreaUiFromSave() {
    uiState.safeAreaId = getCurrentSafeAreaId(saveStore.current);
  }

  function activateSafeArea(safeAreaId, options = {}) {
    const { persist = true, allowUnvisited = false } = options;
    const previousSafeAreaId = getCurrentSafeAreaId(saveStore.current);
    const previousSetting = saveStore.current.settings?.currentSafeAreaId || previousSafeAreaId;
    setCurrentSafeArea(saveStore.current, safeAreaId, { allowUnvisited });
    uiState.safeAreaId = safeAreaId;
    if (!persist || previousSafeAreaId === safeAreaId) {
      return true;
    }
    if (saveGameSafe()) {
      return true;
    }
    saveStore.current.settings.currentSafeAreaId = previousSetting;
    uiState.safeAreaId = previousSafeAreaId;
    return false;
  }

  function travelToSafeArea(safeAreaId) {
    if (!canEnterSafeArea(saveStore.current, safeAreaId)) {
      return false;
    }
    if (!activateSafeArea(safeAreaId)) {
      return false;
    }
    resetPreparationUiState();
    syncSelectionFromSave();
    showScreenInContext("campScreen", "camp");
    return true;
  }

  function getSafeAreaTravelDestinations(safeArea = getCurrentSafeArea()) {
    return getSafeAreaDefinitions().filter((destination) => (
      destination.id !== safeArea?.id
      && isSafeAreaUnlocked(saveStore.current, destination.id)
    ));
  }

  function renderCampTravelButton(safeArea = getCurrentSafeArea()) {
    const destinations = getSafeAreaTravelDestinations(safeArea);
    const newLocationCount = destinations.filter((destination) => (
      !isSafeAreaVisited(saveStore.current, destination.id)
    )).length;

    els.campTravelButton.hidden = destinations.length === 0;
    els.campTravelHint.textContent = "前往其他已解鎖的據點";
    els.campTravelBadge.hidden = newLocationCount === 0;
    els.campTravelBadge.textContent = newLocationCount > 1
      ? `${newLocationCount} 個新地點`
      : "新地點";

    if (newLocationCount > 0) {
      els.campTravelButton.dataset.newLocation = "true";
    } else {
      delete els.campTravelButton.dataset.newLocation;
    }
  }

  function showSafeAreaTravelScreen() {
    showScreenInContext("safeAreaTravelScreen", "camp");
  }

  function renderSafeAreaTravelScreen() {
    const currentSafeArea = getCurrentSafeArea();
    const destinations = getSafeAreaTravelDestinations(currentSafeArea);
    const hasLockedSafeArea = getSafeAreaDefinitions().some((safeArea) => (
      safeArea.id !== currentSafeArea?.id
      && !isSafeAreaUnlocked(saveStore.current, safeArea.id)
    ));

    els.safeAreaTravelCurrentName.textContent = currentSafeArea?.name || "安全區";
    setReturnButton(els.safeAreaTravelBackButton, "campScreen");
    els.safeAreaTravelList.replaceChildren();
    els.safeAreaTravelEmpty.hidden = destinations.length > 0;
    els.safeAreaTravelUnknownHint.hidden = !hasLockedSafeArea;

    destinations.forEach((destination) => {
      els.safeAreaTravelList.append(createTravelCard(destination));
    });
  }

  function createTravelCard(destination) {
    const isNewLocation = !isSafeAreaVisited(saveStore.current, destination.id);
    const button = documentRef.createElement("button");
    button.className = "safe-area-travel-card";
    button.type = "button";
    button.dataset.safeAreaId = destination.id;
    if (isNewLocation) {
      button.dataset.newLocation = "true";
    }

    const heading = documentRef.createElement("span");
    heading.className = "safe-area-travel-card-heading";
    const name = documentRef.createElement("strong");
    name.textContent = destination.name;
    heading.append(name);

    if (isNewLocation) {
      const badge = documentRef.createElement("span");
      badge.className = "safe-area-travel-card-badge";
      badge.textContent = "新地點";
      heading.append(badge);
    }

    const description = documentRef.createElement("small");
    description.textContent = destination.travelDescription || `前往${destination.name}`;
    const action = documentRef.createElement("b");
    action.textContent = isNewLocation ? "首次抵達" : `前往${destination.name}`;
    button.append(heading, description, action);
    return button;
  }

  function handleSafeAreaTravel(targetId) {
    const destination = getSafeAreaDefinition(targetId);
    if (!destination || targetId === getCurrentSafeArea()?.id || !isSafeAreaUnlocked(saveStore.current, targetId)) {
      return false;
    }
    if (targetId === ANPING_TOWN_SAFE_AREA_ID && !isSafeAreaVisited(saveStore.current, targetId)) {
      return showAnpingArrivalStory({ source: "safe-area-travel" });
    }
    return travelToSafeArea(targetId);
  }

  function getCurrentSafeArea() {
    return getSafeAreaDefinition(uiState.safeAreaId) || getSafeAreaDefinition(DEFAULT_SAFE_AREA_ID);
  }

  function getAvailableFacilities(safeArea = getCurrentSafeArea()) {
    const kaigeQuest = storyQuestRuntime.getRecord("kaige-challenge");
    const facilityIds = Array.isArray(safeArea?.facilityIds) ? safeArea.facilityIds : [];
    return facilityIds
      .map((facilityId) => getFacilityDefinition(facilityId))
      .filter(Boolean)
      .filter((facility) => facility.id !== "traveling-merchant" || hasPhoenixBlessing())
      .filter((facility) => (
        facility.id !== "kaige-encounter"
        || (kaigeQuest && kaigeQuest.status !== "completed")
      ))
      .map((facility) => {
        if (!facility.npcId) return facility;
        const npc = getNpcDefinition(facility.npcId);
        return {
          ...facility,
          name: resolveNpcDisplayName(npc, { storyFlags: saveStore.current.storyFlags })
        };
      });
  }

  return Object.freeze({
    syncSafeAreaUiFromSave,
    activateSafeArea,
    travelToSafeArea,
    getSafeAreaTravelDestinations,
    renderCampTravelButton,
    showSafeAreaTravelScreen,
    renderSafeAreaTravelScreen,
    handleSafeAreaTravel,
    getCurrentSafeArea,
    getAvailableFacilities
  });
}
