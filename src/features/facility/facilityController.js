import { isSafeAreaUnlocked } from "../../core/safeAreaProgression.js";
import { getFacilityDefinition } from "../../data/facilities.js";
import { getNpcDefinition, resolveNpcDisplayName } from "../../data/npcs.js";
import { createBlacksmithController } from "../../ui/blacksmithController.js";
import { createDialogueController } from "../../ui/dialogueController.js";
import { renderFacilityListView } from "../../ui/facilityView.js";
import { createGuildAdventureRecordController } from "../../ui/guildAdventureRecordController.js";
import { createGuildBulkSaleController } from "../../ui/guildBulkSaleController.js";
import { createGuildQuestController } from "../../ui/guildQuestController.js";
import { createMerchantController } from "../../ui/merchantController.js";

const GUILD_RECEPTIONIST_ID = "anping-guild-receptionist";

export function createFacilityController({
  uiState,
  saveStore,
  els,
  characterDefinitions,
  materialDefinitions,
  weaponDefinitions,
  weaponCategoryDefinitions,
  npcDefinitions,
  dialogueDefinitions,
  questDefinitions,
  questRuntime,
  getCurrentSafeArea,
  getSafeAreaDefinition,
  getAvailableFacilities,
  activateSafeArea,
  setNavigationContext,
  showScreen,
  saveGameSafe,
  setDialogueStoryFlag
}) {
  const merchantController = createMerchantController({
    els,
    materialDefinitions,
    getInventory: () => saveStore.current.inventory,
    getSafeArea: getCurrentSafeArea,
    saveInventory: saveGameSafe
  });

  const blacksmithController = createBlacksmithController({
    els,
    weaponDefinitions,
    weaponCategoryDefinitions,
    materialDefinitions,
    getInventory: () => saveStore.current.inventory,
    getSafeArea: getCurrentSafeArea,
    saveInventory: saveGameSafe
  });

  const guildAdventureRecordController = createGuildAdventureRecordController({
    els,
    characterDefinitions,
    npcDefinition: npcDefinitions[GUILD_RECEPTIONIST_ID],
    getSave: () => saveStore.current
  });

  const guildQuestController = createGuildQuestController({
    els,
    questRuntime,
    questDefinitions,
    materialDefinitions,
    npcDefinition: npcDefinitions[GUILD_RECEPTIONIST_ID],
    getSave: () => saveStore.current
  });

  const guildBulkSaleController = createGuildBulkSaleController({
    els,
    materialDefinitions,
    npcDefinition: npcDefinitions[GUILD_RECEPTIONIST_ID],
    dialogueDefinition: dialogueDefinitions["anping-guild-receptionist-main"],
    getInventory: () => saveStore.current.inventory,
    saveInventory: saveGameSafe
  });

  const dialogueController = createDialogueController({
    els,
    npcDefinitions,
    dialogueDefinitions,
    getStoryFlags: () => saveStore.current.storyFlags,
    getDialogueContext: () => ({ statistics: saveStore.current.statistics }),
    setStoryFlag: setDialogueStoryFlag,
    onOpenFacility: openFacilityFromDialogue,
    onReturnToFacilityList: () => showFacilityList(uiState.safeAreaId, uiState.navigationContext),
    onEndDialogue: () => showFacilityList(uiState.safeAreaId, uiState.navigationContext)
  });

  const actionHandlers = Object.freeze({
    merchant: showMerchantFacility,
    blacksmith: showBlacksmithFacility,
    guild: showGuildFacility,
    "guild-adventure-record": showGuildAdventureRecordFacility,
    "guild-quests": showGuildQuestFacility,
    "guild-bulk-sale": showGuildBulkSaleFacility
  });

  function supportsAction(actionId) {
    return typeof actionHandlers[actionId] === "function";
  }

  function getFacilityScreenTitle() {
    if (uiState.facilityView === "merchant") return "旅行商人";
    if (uiState.facilityView === "blacksmith") return "鐵匠鋪";
    if (uiState.facilityView === "guild-record") return "冒險資歷";
    if (uiState.facilityView === "guild-quests") return "公會委託";
    if (uiState.facilityView === "guild-bulk") return "交付冒險物資";
    if (uiState.facilityView === "dialogue") {
      const dialogueNpc = getNpcDefinition(dialogueController.getState().npcId);
      return resolveNpcDisplayName(dialogueNpc, { storyFlags: saveStore.current.storyFlags });
    }
    return getCurrentSafeArea()?.placesTitle || "安全區去處";
  }

  function resetFacilityUiState() {
    uiState.facilityView = "list";
    uiState.blacksmithReturnView = "list";
    uiState.blacksmithReturnNpcId = null;
    uiState.guildReturnNpcId = null;
    dialogueController.reset();
  }

  function showFacilityList(safeAreaId = uiState.safeAreaId, contextId = uiState.navigationContext) {
    const safeArea = getCurrentSafeAreaDefinition(safeAreaId);
    if (!isSafeAreaUnlocked(saveStore.current, safeArea.id)) {
      throw new Error(`安全區尚未解鎖：${safeArea.id}`);
    }
    activateSafeArea(safeArea.id);
    setNavigationContext(contextId);
    resetFacilityUiState();
    merchantController.reset();
    blacksmithController.reset();
    guildQuestController.reset();
    guildBulkSaleController.reset();
    showScreen("facilityScreen");
  }

  function getCurrentSafeAreaDefinition(safeAreaId) {
    const definition = getSafeAreaDefinition(safeAreaId);
    if (!definition) {
      throw new Error(`找不到安全區 definition：${safeAreaId || "(empty)"}`);
    }
    return definition;
  }

  function showMerchantFacility() {
    uiState.facilityView = "merchant";
    merchantController.reset();
    showScreen("facilityScreen");
  }

  function showBlacksmithFacility() {
    uiState.facilityView = "blacksmith";
    blacksmithController.reset();
    showScreen("facilityScreen");
  }

  function showGuildFacility() {
    showNpcDialogue(GUILD_RECEPTIONIST_ID);
  }

  function showGuildAdventureRecordFacility() {
    uiState.facilityView = "guild-record";
    els.guildRecordAreaLabel.textContent = getCurrentSafeArea()?.name || "安平鎮";
    showScreen("facilityScreen");
  }

  function showGuildQuestFacility() {
    if (!saveStore.current.storyFlags.guildQuestIntroductionSeen) {
      setDialogueStoryFlag("guildQuestIntroductionSeen", true);
    }
    uiState.facilityView = "guild-quests";
    els.guildQuestAreaLabel.textContent = getCurrentSafeArea()?.name || "安平鎮";
    guildQuestController.reset();
    questRuntime.ensureBoard();
    showScreen("facilityScreen");
  }

  function showGuildQuestIntroduction() {
    uiState.guildReturnNpcId = GUILD_RECEPTIONIST_ID;
    showNpcDialogue(GUILD_RECEPTIONIST_ID, { animateText: false });
    dialogueController.gotoNode("quest-introduction");
  }

  function showGuildBulkSaleFacility() {
    uiState.facilityView = "guild-bulk";
    els.guildBulkAreaLabel.textContent = getCurrentSafeArea()?.name || "安平鎮";
    guildBulkSaleController.reset();
    showScreen("facilityScreen");
  }

  function showNpcDialogue(npcId, options = {}) {
    const npc = getNpcDefinition(npcId);
    if (!npc) {
      throw new Error(`找不到 NPC definition：${npcId || "(empty)"}`);
    }
    uiState.facilityView = "dialogue";
    els.dialogueAreaLabel.textContent = getCurrentSafeArea()?.placesTitle || "城鎮去處";
    els.dialogueHeading.textContent = npc.title || "人物交談";
    els.dialogueBackButton.textContent = `返回${getCurrentSafeArea()?.placesTitle || "城鎮去處"}`;
    dialogueController.open(npc.id, {
      animateText: options.animateText !== false,
      renderAfter: false
    });
    showScreen("facilityScreen");
  }

  function openFacility(facility) {
    if (facility?.npcId) {
      showNpcDialogue(facility.npcId);
      return;
    }
    dispatchFacilityAction(facility, { returnView: "list" });
  }

  function dispatchFacilityAction(facility, options = {}) {
    const handler = actionHandlers[facility?.actionId];
    if (typeof handler !== "function") {
      throw new Error(`無法處理 Facility action：${facility?.actionId || "(empty)"}`);
    }
    if (facility.actionId === "blacksmith") {
      uiState.blacksmithReturnView = options.returnView === "dialogue" ? "dialogue" : "list";
      uiState.blacksmithReturnNpcId = options.returnNpcId || null;
    }
    if (["guild-adventure-record", "guild-quests", "guild-bulk-sale"].includes(facility.actionId)) {
      uiState.guildReturnNpcId = options.returnNpcId || GUILD_RECEPTIONIST_ID;
    }
    handler();
  }

  function openFacilityFromDialogue(facilityId, npcId) {
    const facility = getFacilityDefinition(facilityId);
    if (!facility) {
      throw new Error(`找不到 Facility definition：${facilityId || "(empty)"}`);
    }
    dispatchFacilityAction(facility, {
      returnView: "dialogue",
      returnNpcId: npcId
    });
  }

  function handleBlacksmithBack() {
    if (uiState.blacksmithReturnView === "dialogue" && uiState.blacksmithReturnNpcId) {
      showNpcDialogue(uiState.blacksmithReturnNpcId, { animateText: false });
      return;
    }
    showFacilityList(uiState.safeAreaId, uiState.navigationContext);
  }

  function returnToGuildDialogue(nodeId = "default-greeting") {
    const npcId = uiState.guildReturnNpcId || GUILD_RECEPTIONIST_ID;
    if (dialogueController.getState().npcId !== npcId) {
      showNpcDialogue(npcId, { animateText: false });
      if (nodeId !== "default-greeting") {
        dialogueController.gotoNode(nodeId);
      }
      return;
    }
    uiState.facilityView = "dialogue";
    dialogueController.gotoNode(nodeId);
    showScreen("facilityScreen");
  }

  function handleGuildRecordBack() {
    returnToGuildDialogue("record-return");
  }

  function handleGuildQuestBack() {
    guildQuestController.reset();
    returnToGuildDialogue("default-greeting");
  }

  function handleGuildBulkBack() {
    guildBulkSaleController.reset();
    returnToGuildDialogue("default-greeting");
  }

  function renderFacilityScreen() {
    const safeArea = getCurrentSafeArea();
    const facilities = getAvailableFacilities(safeArea);
    toggleFacilityViews();

    if (uiState.facilityView === "list") {
      renderFacilityListView({ els, safeArea, facilities, onFacilityClick: openFacility });
      return;
    }
    if (uiState.facilityView === "merchant") return merchantController.render();
    if (uiState.facilityView === "dialogue") return dialogueController.render();
    if (uiState.facilityView === "guild-record") return guildAdventureRecordController.render();
    if (uiState.facilityView === "guild-quests") return guildQuestController.render();
    if (uiState.facilityView === "guild-bulk") return guildBulkSaleController.render();
    blacksmithController.render();
  }

  function toggleFacilityViews() {
    els.facilityListView.classList.toggle("is-active", uiState.facilityView === "list");
    els.merchantView.classList.toggle("is-active", uiState.facilityView === "merchant");
    els.dialogueView.classList.toggle("is-active", uiState.facilityView === "dialogue");
    els.guildRecordView.classList.toggle("is-active", uiState.facilityView === "guild-record");
    els.guildQuestView.classList.toggle("is-active", uiState.facilityView === "guild-quests");
    els.guildBulkView.classList.toggle("is-active", uiState.facilityView === "guild-bulk");
    els.blacksmithView.classList.toggle("is-active", uiState.facilityView === "blacksmith");
    els.facilityPanel.classList.toggle("is-dialogue-mode", uiState.facilityView === "dialogue");
    els.facilityPanel.classList.toggle("is-guild-record-mode", uiState.facilityView === "guild-record");
    els.facilityPanel.classList.toggle("is-guild-quest-mode", uiState.facilityView === "guild-quests");
    els.facilityPanel.classList.toggle("is-guild-sale-mode", uiState.facilityView === "guild-bulk");
  }

  return Object.freeze({
    supportsAction,
    getFacilityScreenTitle,
    resetFacilityUiState,
    showFacilityList,
    showMerchantFacility,
    showBlacksmithFacility,
    showGuildFacility,
    showGuildAdventureRecordFacility,
    showGuildQuestFacility,
    showGuildQuestIntroduction,
    showGuildBulkSaleFacility,
    showNpcDialogue,
    openFacility,
    openFacilityFromDialogue,
    handleBlacksmithBack,
    handleGuildRecordBack,
    handleGuildQuestBack,
    handleGuildBulkBack,
    renderFacilityScreen,
    closeMerchantSale: merchantController.closeSaleDialog,
    confirmGuildQuestAbandon: guildQuestController.confirmAbandon,
    closeGuildQuestAbandon: guildQuestController.closeAbandonConfirm,
    closeGuildBulkConfirm: guildBulkSaleController.closeConfirm,
    closeBlacksmithCraft: blacksmithController.closeCraftDialog
  });
}
