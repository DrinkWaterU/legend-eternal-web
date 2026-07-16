import { DEFAULT_REGION_ID } from "../../config.js";
import { normalizeInventory } from "../../core/rewards.js";
import { getRegionPreparation } from "../../core/preparations.js";
import {
  getEnhancementMaterialState,
  renderPreparationChoices,
  renderPreparationDetail
} from "../../ui/preparationView.js";
import {
  clearPreparationSelectionState,
  consumePreparationEnhancementReveal,
  normalizePreparationUiState
} from "../../ui/preparationState.js";
import { renderChoiceList, renderStatList } from "../../ui/renderHelpers.js";

export function createRegionController({
  state,
  uiState,
  saveStore,
  els,
  documentRef = document,
  regionDefinitions,
  characterDefinitions,
  materialDefinitions,
  saveGameSafe,
  syncSelectionFromSave,
  setNavigationContext,
  getNavigationReturnTarget,
  showScreen,
  setReturnButton,
  currentRegion,
  normalizeCharacterProgress,
  hasPhoenixBlessing
}) {
  function showRegionList(contextId = uiState.navigationContext) {
    setNavigationContext(contextId);
    uiState.regionView = "list";
    showScreen("regionScreen");
  }

  function resetPreparationUiState() {
    clearPreparationSelectionState(uiState);
    uiState.runStartNotice = "";
    uiState.runStartLocked = false;
  }

  function showRegionDetail(regionId = DEFAULT_REGION_ID) {
    saveStore.current.settings.selectedRegionId = regionId;
    saveGameSafe();
    syncSelectionFromSave();
    uiState.regionView = "detail";
    resetPreparationUiState();
    showScreen("regionScreen");
  }

  function renderRegionScreen() {
    els.regionListView.classList.toggle("is-active", uiState.regionView === "list");
    els.regionDetailView.classList.toggle("is-active", uiState.regionView === "detail");
    setReturnButton(els.regionListView.querySelector(".back-button"), getNavigationReturnTarget());

    renderChoiceList(els.regionChoiceList, Object.entries(regionDefinitions).map(([regionId, region]) => ({
      title: region.name,
      meta: region.recommendedLevel ? `${region.difficulty}｜${region.recommendedLevel}` : region.difficulty,
      description: `${region.encounterCount} 場遭遇，首領：${region.bossName}`,
      action: "查看地區",
      onClick: () => showRegionDetail(regionId)
    })));

    if (uiState.regionView !== "detail") {
      return;
    }
    renderRegionDetail();
  }

  function renderRegionDetail() {
    const region = currentRegion();
    const preparations = Array.isArray(region.preparations) ? region.preparations : [];
    const traits = Array.isArray(region.traits)
      ? region.traits.filter((trait) => typeof trait === "string" && trait.trim())
      : [];
    const inventory = normalizeInventory(saveStore.current.inventory);
    const character = characterDefinitions[state.selectedHeroId];
    const progress = normalizeCharacterProgress(state.selectedHeroId);
    const phoenixUnlocked = hasPhoenixBlessing();

    normalizePreparationUiState({
      uiState,
      region,
      gold: inventory.gold,
      inventoryMaterials: inventory.materials,
      enabled: phoenixUnlocked
    });

    els.regionDetailName.textContent = region.name;
    els.regionDetailDescription.textContent = region.note
      ? `${region.description}\n${region.note}`
      : region.description;
    renderStatList(els.regionDetailStats, [
      ["遭遇", `${region.encounterCount} 場`],
      ["難度", region.difficulty],
      ["推薦等級", region.recommendedLevel || "Lv.1+"],
      ["首領", region.bossName]
    ]);

    renderRegionTraits(traits);
    els.regionDepartureCharacter.textContent = `${character.name} Lv.${progress.level}`;
    els.regionDepartureGoldItem.hidden = !phoenixUnlocked;
    if (phoenixUnlocked) {
      els.regionDepartureGold.textContent = String(inventory.gold);
    }

    renderPreparationSection({ region, preparations, inventory, phoenixUnlocked });
  }

  function renderRegionTraits(traits) {
    els.regionTraitList.replaceChildren();
    traits.forEach((trait) => {
      const item = documentRef.createElement("span");
      item.className = "region-trait";
      item.textContent = trait;
      els.regionTraitList.append(item);
    });
    els.regionTraits.hidden = traits.length === 0;
  }

  function renderPreparationSection({ region, preparations, inventory, phoenixUnlocked }) {
    els.regionPreparationSection.hidden = !phoenixUnlocked;
    els.regionStartNotice.textContent = uiState.runStartNotice;
    els.regionStartNotice.hidden = !uiState.runStartNotice;

    if (phoenixUnlocked) {
      renderPreparationSelection({ region, preparations, inventory });
    } else {
      els.regionPreparationChoices.replaceChildren();
      renderPreparationDetail({
        element: els.regionPreparationDetail,
        preparation: null,
        expanded: false,
        priceLabel: "免費",
        selected: false,
        enhanced: false
      });
    }

    const activePreparation = phoenixUnlocked
      ? getRegionPreparation(region, uiState.selectedPreparationId)
      : null;
    const activePreparationEnhanced = activePreparation?.id === uiState.enhancedPreparationId;
    renderPreparationRunCostPreview({ preparation: activePreparation, enhanced: activePreparationEnhanced });
    els.startButton.textContent = activePreparation
      ? activePreparationEnhanced
        ? `花費 ${activePreparation.cost} 金幣＋素材並開始${region.name}冒險`
        : `花費 ${activePreparation.cost} 金幣並開始${region.name}冒險`
      : `開始${region.name}冒險`;
    els.startButton.disabled = uiState.runStartLocked;
  }

  function renderPreparationSelection({ region, preparations, inventory }) {
    renderPreparationChoices({
      element: els.regionPreparationChoices,
      preparations,
      selectedPreparationId: uiState.selectedPreparationId,
      detailPreparationId: uiState.preparationDetailId,
      detailExpanded: uiState.preparationDetailExpanded,
      enhancedPreparationId: uiState.enhancedPreparationId,
      gold: inventory.gold,
      inventoryMaterials: inventory.materials,
      materialDefinitions,
      onSelect: selectPreparation
    });
    const detailPreparation = getRegionPreparation(region, uiState.preparationDetailId);
    const detailAffordable = !detailPreparation || inventory.gold >= detailPreparation.cost;
    const detailEnhanced = detailPreparation?.id === uiState.enhancedPreparationId;
    const animateEnhancement = consumePreparationEnhancementReveal(uiState, detailPreparation?.id);
    renderPreparationDetail({
      element: els.regionPreparationDetail,
      preparation: detailPreparation,
      expanded: uiState.preparationDetailExpanded,
      priceLabel: detailPreparation
        ? detailAffordable
          ? `${detailPreparation.cost} 金幣`
          : `金幣不足｜需 ${detailPreparation.cost} 金幣`
        : "免費",
      selected: detailPreparation?.id === uiState.selectedPreparationId,
      enhanced: detailEnhanced,
      animateEnhancement,
      inventoryMaterials: inventory.materials,
      materialDefinitions,
      onToggleEnhancement: togglePreparationEnhancement
    });
  }

  function selectPreparation(preparationId) {
    const region = currentRegion();
    const preparation = getRegionPreparation(region, preparationId);
    if (preparationId && !preparation) return;

    const inventory = normalizeInventory(saveStore.current.inventory);
    const affordable = !preparation || inventory.gold >= preparation.cost;
    const sameDetail = uiState.preparationDetailId === preparationId;
    if (affordable) {
      const selectionChanged = uiState.selectedPreparationId !== preparationId;
      uiState.selectedPreparationId = preparationId;
      if (selectionChanged) {
        uiState.enhancedPreparationId = null;
        uiState.preparationEnhancementRevealId = null;
      }
    }
    uiState.preparationDetailId = preparationId;
    uiState.preparationDetailExpanded = sameDetail ? !uiState.preparationDetailExpanded : true;
    uiState.runStartNotice = "";
    renderRegionScreen();
  }

  function togglePreparationEnhancement(preparationId) {
    const region = currentRegion();
    const preparation = getRegionPreparation(region, preparationId);
    if (!preparation || preparation.id !== uiState.selectedPreparationId) {
      return showPreparationNotice("請先選擇這項整備。");
    }
    if (!preparation.enhancement) {
      return showPreparationNotice("目前整備沒有素材強化。");
    }
    if (uiState.enhancedPreparationId === preparation.id) {
      uiState.enhancedPreparationId = null;
      uiState.preparationEnhancementRevealId = null;
      return showPreparationNotice("");
    }

    const inventory = normalizeInventory(saveStore.current.inventory);
    if (inventory.gold < preparation.cost) {
      return showPreparationNotice("金幣不足，無法使用目前整備。");
    }
    const materialState = getEnhancementMaterialState({
      preparation,
      inventoryMaterials: inventory.materials,
      materialDefinitions
    });
    if (!materialState.available) {
      return showPreparationNotice("強化素材不足。");
    }

    uiState.enhancedPreparationId = preparation.id;
    uiState.preparationEnhancementRevealId = preparation.id;
    showPreparationNotice("");
  }

  function showPreparationNotice(message) {
    uiState.runStartNotice = message;
    renderRegionScreen();
  }

  function renderPreparationRunCostPreview({ preparation, enhanced }) {
    els.regionDetailView.querySelector(".preparation-run-cost-preview")?.remove();
    if (!preparation || !enhanced || !preparation.enhancement) return;

    const preview = documentRef.createElement("div");
    const gold = documentRef.createElement("span");
    preview.className = "preparation-run-cost-preview";
    gold.textContent = `金幣 ${preparation.cost}`;
    preview.append(gold);
    preparation.enhancement.materialCosts.forEach((cost) => {
      const item = documentRef.createElement("span");
      item.textContent = `${materialDefinitions[cost.materialId]?.name || cost.materialId} ×${cost.quantity}`;
      preview.append(item);
    });
    els.startButton.before(preview);
  }

  return Object.freeze({
    showRegionList,
    showRegionDetail,
    resetPreparationUiState,
    renderRegionScreen,
    selectPreparation,
    togglePreparationEnhancement
  });
}
