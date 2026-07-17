import {
  equipWeapon,
  getOwnedCompatibleWeapons,
  unequipWeapon
} from "../../core/equipment.js";
import { buildHeroFromProgression } from "../../core/progression.js";
import {
  filterEquipmentWeapons,
  renderCharacterEquipmentView
} from "../../ui/characterEquipmentView.js";
import { clone } from "../../utils.js";

export function createCharacterEquipmentController({
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
  renderCharacterScreen
}) {
  function showCharacterEquipment(characterId = uiState.characterDetailId) {
    if (!isCharacterUnlocked(characterId)) {
      showLockedCharacterHint();
      return;
    }
    uiState.characterDetailId = characterId;
    uiState.characterView = "equipment";
    uiState.equipmentNotice = "";
    const character = characterDefinitions[characterId];
    const progress = getCharacterProgress(characterId);
    const equippedWeaponId = progress.equipment?.weaponId || null;
    const ownedWeapons = getOwnedCompatibleWeapons({
      character,
      inventory: saveStore.current.inventory,
      weaponDefinitions
    });
    uiState.equipmentPreviewWeaponId = equippedWeaponId || ownedWeapons[0]?.id || null;
    uiState.equipmentSearchQuery = "";
    uiState.equipmentCategoryFilter = "all";
    uiState.equipmentSortMode = "rarity";
    showScreen("characterScreen");
  }

  function renderCharacterEquipment(character, progress, preview, equippedWeapon) {
    const ownedWeapons = getOwnedCompatibleWeapons({
      character,
      inventory: saveStore.current.inventory,
      weaponDefinitions
    });
    const visibleWeapons = filterEquipmentWeapons(ownedWeapons, {
      searchQuery: uiState.equipmentSearchQuery,
      categoryFilter: uiState.equipmentCategoryFilter,
      sortMode: uiState.equipmentSortMode
    });
    const selectedWeapon = visibleWeapons.find((weapon) => weapon.id === uiState.equipmentPreviewWeaponId)
      || visibleWeapons.find((weapon) => weapon.id === equippedWeapon?.id)
      || visibleWeapons[0]
      || null;
    uiState.equipmentPreviewWeaponId = selectedWeapon?.id || null;
    const equipmentPreview = selectedWeapon
      ? buildHeroPreviewForWeapon(character.id, selectedWeapon.id)
      : preview;

    renderCharacterEquipmentView({
      els,
      character,
      progress,
      equippedWeapon,
      selectedWeapon,
      ownedWeapons,
      visibleWeapons,
      weaponCategoryDefinitions,
      currentHero: preview,
      previewHero: equipmentPreview,
      notice: uiState.equipmentNotice,
      noticeType: uiState.equipmentNoticeType,
      searchQuery: uiState.equipmentSearchQuery,
      categoryFilter: uiState.equipmentCategoryFilter,
      sortMode: uiState.equipmentSortMode,
      onSearchChange: updateAndRender("equipmentSearchQuery"),
      onSortChange: updateAndRender("equipmentSortMode"),
      onCategoryChange: updateAndRender("equipmentCategoryFilter"),
      onWeaponSelect: selectEquipmentPreview,
      onEquip: equipCharacterWeapon,
      onUnequip: unequipCharacterWeapon
    });
  }

  function selectEquipmentPreview(weaponId) {
    if (!weaponDefinitions[weaponId]) return;
    uiState.equipmentPreviewWeaponId = weaponId;
    uiState.equipmentNotice = "";
    renderCharacterScreen();
  }

  function equipCharacterWeapon(weaponId) {
    const character = characterDefinitions[uiState.characterDetailId];
    const progress = getCharacterProgress(character.id);
    const previousWeaponId = progress.equipment?.weaponId || null;
    try {
      const weapon = equipWeapon({
        character,
        progress,
        inventory: saveStore.current.inventory,
        weaponDefinitions,
        weaponId
      });
      if (!saveGameSafe()) {
        progress.equipment = { weaponId: previousWeaponId };
        throw new Error("瀏覽器無法保存裝備變更，已恢復原本武器。");
      }
      uiState.equipmentPreviewWeaponId = weapon.id;
      setNotice(`已為${character.name}裝備${weapon.name}。下一輪冒險開始時生效。`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "裝備武器失敗。", "error");
    }
    renderCharacterScreen();
  }

  function unequipCharacterWeapon() {
    const character = characterDefinitions[uiState.characterDetailId];
    const progress = getCharacterProgress(character.id);
    const previousWeaponId = unequipWeapon(progress);
    const previousWeapon = weaponDefinitions[previousWeaponId];
    if (!saveGameSafe()) {
      progress.equipment = { weaponId: previousWeaponId };
      setNotice("瀏覽器無法保存卸下結果，已恢復原本武器。", "error");
    } else {
      setNotice(previousWeapon
        ? `已卸下${previousWeapon.name}。下一輪冒險開始時生效。`
        : "目前沒有已裝備的武器。");
    }
    renderCharacterScreen();
  }

  function buildHeroPreviewForWeapon(characterId, weaponId) {
    const progress = clone(normalizeCharacterProgress(characterId));
    progress.equipment = { weaponId: weaponId || null };
    return buildHeroFromProgression(characterDefinitions[characterId], progress, {
      inventory: saveStore.current.inventory,
      weaponDefinitions
    });
  }

  function updateAndRender(key) {
    return (value) => {
      uiState[key] = value;
      renderCharacterScreen();
    };
  }

  function setNotice(message, type = "status") {
    uiState.equipmentNotice = message;
    uiState.equipmentNoticeType = type;
  }

  return Object.freeze({ showCharacterEquipment, renderCharacterEquipment });
}
