import { getAllIndependentBlessings } from "../../data/blessings/index.js";
import { renderBlessingInfoView } from "../../ui/blessingInfoView.js";
import { renderCurrentAbilityView, renderQuestCombatDetails } from "../../ui/combatView.js";

export function createOverlayController({
  state,
  els,
  currentRegion,
  questRuntime,
  closeLockedCharacterHint,
  closeAchievementDetailPanel,
  facilityController,
  closeExportSaveCodeDialog,
  closeImportSaveCodeDialog,
  closeDeleteSaveDialog,
  closeStoryPanel,
  closeAnpingArrivalPanel
}) {
  function closeEndPanel() {
    els.endPanel.classList.remove("is-visible");
  }

  function openAbilityInfoPanel() {
    if (!state.hero) return;
    renderCurrentAbilityView(els.abilityInfoList, state.hero);
    els.abilityInfoPanel.classList.add("is-visible");
  }

  function closeAbilityInfoPanel() {
    els.abilityInfoPanel.classList.remove("is-visible");
  }

  function openBlessingInfoPanel() {
    if (!state.hero) return;
    renderBlessingInfoView({
      filtersElement: els.blessingInfoFilters,
      listElement: els.blessingInfoList,
      blessingNames: state.hero.blessings,
      blessingDefinitions: [...(currentRegion().blessings || []), ...getAllIndependentBlessings()],
      resetFilter: true
    });
    els.blessingInfoPanel.classList.add("is-visible");
  }

  function closeBlessingInfoPanel() {
    els.blessingInfoPanel.classList.remove("is-visible");
  }

  function openQuestInfoPanel() {
    if (!state.hero || !questRuntime) return;
    const snapshot = questRuntime.getSnapshot();
    if (!snapshot.activeQuest) return;
    renderQuestCombatDetails({ els, snapshot });
    els.questInfoPanel.classList.add("is-visible");
    els.questCombatToggle.setAttribute("aria-expanded", "true");
    els.questInfoPanel.querySelector("#closeQuestInfoButton").focus();
  }

  function closeQuestInfoPanel() {
    els.questInfoPanel.classList.remove("is-visible");
    els.questCombatToggle.setAttribute("aria-expanded", "false");
  }

  function closeTransientUiPanels() {
    els.blessingPanel.classList.remove("is-visible");
    closeEndPanel();
    closeLockedCharacterHint();
    closeAchievementDetailPanel({ restoreFocus: false });
    facilityController.closeMerchantSale();
    facilityController.closeGuildBulkConfirm();
    facilityController.closeBlacksmithCraft();
    closeExportSaveCodeDialog();
    closeImportSaveCodeDialog();
    closeAbilityInfoPanel();
    closeBlessingInfoPanel();
    closeQuestInfoPanel();
    closeStoryPanel();
    closeAnpingArrivalPanel();
    closeDeleteSaveDialog();
  }

  return Object.freeze({
    closeEndPanel,
    openAbilityInfoPanel,
    closeAbilityInfoPanel,
    openBlessingInfoPanel,
    closeBlessingInfoPanel,
    openQuestInfoPanel,
    closeQuestInfoPanel,
    closeTransientUiPanels
  });
}
