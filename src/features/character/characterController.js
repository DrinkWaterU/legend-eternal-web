import { DEFAULT_CHARACTER_ID, DEFAULT_REGION_ID } from "../../config.js";
import { resolveEquippedWeapon } from "../../core/equipment.js";
import {
  getCharacterMaxLevel,
  getExpToNextLevel
} from "../../core/progression.js";
import { renderCharacterSkills } from "../../ui/characterSkillsView.js";
import { renderCharacterDetailView } from "../../ui/characterDetailView.js";
import { renderCharacterCards } from "../../ui/characterSelectView.js";
import { createCharacterEquipmentController } from "./characterEquipmentController.js";

export function createCharacterController({
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
}) {
  function syncSelectionFromSave() {
    const requestedRegionId = saveStore.current.settings.selectedRegionId;
    const regionId = regionDefinitions[requestedRegionId]
      ? requestedRegionId
      : DEFAULT_REGION_ID;
    const requestedCharacterId = saveStore.current.settings.selectedCharacterId;
    const characterId = isCharacterUnlocked(requestedCharacterId)
      ? requestedCharacterId
      : DEFAULT_CHARACTER_ID;

    saveStore.current.settings.selectedCharacterId = characterId;
    state.selectedRegionId = regionId;
    state.selectedHeroId = characterId;
    state.selectedRegion = regionDefinitions[regionId].name;
    state.selectedHero = characterDefinitions[characterId].name;
  }

  function isCharacterUnlocked(characterId) {
    return Boolean(
      characterDefinitions[characterId]
      && saveStore.current.progression.characters[characterId]?.unlocked === true
    );
  }

  function showCharacterList(contextId = uiState.navigationContext) {
    setNavigationContext(contextId);
    uiState.characterView = "list";
    showScreen("characterScreen");
  }

  function showCharacterDetail(characterId = DEFAULT_CHARACTER_ID) {
    if (!isCharacterUnlocked(characterId)) {
      showLockedCharacterHint();
      return;
    }
    const changedCharacter = uiState.characterDetailId !== characterId;
    uiState.characterDetailId = characterId;
    uiState.characterView = "detail";
    uiState.equipmentNotice = "";
    if (changedCharacter) {
      uiState.characterSkillSelectedId = null;
      uiState.characterSkillSearchQuery = "";
      uiState.characterSkillTypeFilter = "all";
      uiState.characterSkillStageFilter = "all";
    }
    showScreen("characterScreen");
  }

  function showLockedCharacterHint() {
    els.characterLockedPanel.classList.add("is-visible");
  }

  function closeLockedCharacterHint() {
    els.characterLockedPanel.classList.remove("is-visible");
  }

  function selectCharacterFromDetail() {
    const characterId = uiState.characterDetailId;
    if (!isCharacterUnlocked(characterId)) {
      showLockedCharacterHint();
      return;
    }
    saveStore.current.settings.selectedCharacterId = characterId;
    saveGameSafe();
    syncSelectionFromSave();
    renderCharacterScreen();
  }

  const equipmentController = createCharacterEquipmentController({
    uiState,
    saveStore,
    els,
    characterDefinitions,
    weaponDefinitions,
    weaponCategoryDefinitions,
    saveGameSafe,
    showScreen,
    isCharacterUnlocked,
    showLockedCharacterHint,
    getCharacterProgress,
    normalizeCharacterProgress,
    renderCharacterScreen: () => renderCharacterScreen()
  });

  function renderCharacterScreen() {
    els.characterListView.classList.toggle("is-active", uiState.characterView === "list");
    els.characterDetailView.classList.toggle("is-active", uiState.characterView === "detail");
    els.characterEquipmentView.classList.toggle("is-active", uiState.characterView === "equipment");
    setReturnButton(els.characterListView.querySelector(".back-button"), getNavigationReturnTarget());

    const equippedWeaponsByCharacterId = Object.fromEntries(
      Object.entries(characterDefinitions).map(([characterId, character]) => {
        const progress = getCharacterProgress(characterId);
        return [characterId, resolveEquippedWeapon({
          character,
          progress,
          inventory: saveStore.current.inventory,
          weaponDefinitions
        })];
      })
    );

    renderCharacterCards({
      element: els.characterChoiceList,
      characterDefinitions,
      characterProgression: saveStore.current.progression.characters,
      selectedCharacterId: saveStore.current.settings.selectedCharacterId,
      equippedWeaponsByCharacterId,
      weaponCategoryDefinitions,
      onCharacterClick: showCharacterDetail,
      onLockedCharacterClick: showLockedCharacterHint
    });

    if (uiState.characterView === "list") {
      return;
    }

    const characterId = isCharacterUnlocked(uiState.characterDetailId)
      ? uiState.characterDetailId
      : saveStore.current.settings.selectedCharacterId;
    uiState.characterDetailId = characterId;
    const character = characterDefinitions[characterId];
    const progress = getCharacterProgress(characterId);
    const preview = buildHeroFromProgression(characterId);
    const equippedWeapon = equippedWeaponsByCharacterId[characterId] || null;

    if (uiState.characterView === "detail") {
      renderCharacterDetail(characterId, character, progress, preview, equippedWeapon);
      return;
    }

    equipmentController.renderCharacterEquipment(character, progress, preview, equippedWeapon);
  }

  function renderCharacterDetail(characterId, character, progress, preview, equippedWeapon) {
    const maxLevel = getCharacterMaxLevel(character);
    const experienceLabel = progress.level >= maxLevel
      ? "經驗 MAX"
      : `經驗 ${progress.exp} / ${getExpToNextLevel(progress.level, character)}`;
    renderCharacterDetailView({
      els,
      characterId,
      character,
      progress,
      hero: preview,
      equippedWeapon,
      weaponCategoryDefinitions,
      experienceLabel,
      selected: characterId === saveStore.current.settings.selectedCharacterId,
      onEquipmentOpen: () => equipmentController.showCharacterEquipment(characterId)
    });

    els.characterSkillSearchInput.value = uiState.characterSkillSearchQuery;
    els.characterSkillTypeSelect.value = uiState.characterSkillTypeFilter;
    const skillResult = renderCharacterSkills({
      listElement: els.characterSkillList,
      detailElement: els.characterSkillDetail,
      nextSkillElement: els.characterNextSkillPanel,
      countElement: els.characterSkillCount,
      emptyElement: els.characterSkillEmpty,
      stageFilterElement: els.characterSkillStageFilters,
      character,
      progress,
      selectedSkillId: uiState.characterSkillSelectedId,
      searchQuery: uiState.characterSkillSearchQuery,
      typeFilter: uiState.characterSkillTypeFilter,
      stageFilter: uiState.characterSkillStageFilter,
      onSkillSelect: (skillId) => {
        uiState.characterSkillSelectedId = skillId;
        renderCharacterScreen();
      }
    });
    uiState.characterSkillSelectedId = skillResult.selectedSkillId;
  }


  return Object.freeze({
    syncSelectionFromSave,
    isCharacterUnlocked,
    showCharacterList,
    showCharacterDetail,
    showCharacterEquipment: equipmentController.showCharacterEquipment,
    showLockedCharacterHint,
    closeLockedCharacterHint,
    selectCharacterFromDetail,
    renderCharacterScreen
  });
}
