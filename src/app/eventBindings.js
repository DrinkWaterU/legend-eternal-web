function bindBackdropClose(panel, closePanel) {
  panel.addEventListener("click", (event) => {
    if (event.target === panel) closePanel();
  });
}

export function bindApplicationEvents({ els, documentRef = document, state, uiState, actions }) {
  const {
    showScreen,
    showScreenInContext,
    showCharacterList,
    showStatisticsScreen,
    toggleMusicEnabled,
    previewMusicVolume,
    commitMusicVolume,
    setNavigationContext,
    showRegionDetail,
    showRegionList,
    showFacilityList,
    showSafeAreaTravelScreen,
    handleSafeAreaTravel,
    restart,
    getNavigationReturnTarget,
    handleBlacksmithBack,
    handleGuildRecordBack,
    handleGuildQuestBack,
    handleGuildBulkBack,
    showCharacterDetail,
    showCharacterEquipment,
    renderCharacterScreen,
    showStatisticsView,
    selectCharacterFromDetail,
    closeLockedCharacterHint,
    startPlayerRun,
    handleEndPrimaryAction,
    closeEndPanel,
    revealStoryText,
    completePlainsStory,
    revealAnpingArrivalPage,
    continueAnpingArrivalStory,
    playTurn,
    tryFlee,
    continueAdventure,
    handleEventContinueButton,
    restAtSafeRoute,
    retreatRun,
    openAbilityInfoPanel,
    closeAbilityInfoPanel,
    openBlessingInfoPanel,
    closeBlessingInfoPanel,
    openExportSaveCodeDialog,
    openImportSaveCodeDialog,
    copySaveCode,
    closeExportSaveCodeDialog,
    checkImportSaveCode,
    confirmImportSaveCode,
    closeImportSaveCodeDialog,
    openDeleteSaveDialog,
    deleteSave,
    closeDeleteSaveDialog,
    closeAchievementDetailPanel,
    closeAchievementUnlockToast,
    facilityController,
    handleUserInteraction
  } = actions;

  els.openRegionButton.addEventListener("click", () => showScreenInContext("campScreen", "camp"));
  els.openCharacterButton.addEventListener("click", () => showCharacterList("menu"));
  els.openStatisticsButton.addEventListener("click", () => showStatisticsScreen("menu"));
  els.openAchievementButton.addEventListener("click", () => showScreenInContext("achievementScreen", "menu"));
  els.musicToggleButton.addEventListener("click", toggleMusicEnabled);
  els.musicVolumeInput.addEventListener("input", previewMusicVolume);
  els.musicVolumeInput.addEventListener("change", commitMusicVolume);
  els.campStartButton.addEventListener("click", () => {
    setNavigationContext("camp");
    showRegionDetail(state.selectedRegionId);
  });
  els.campRegionButton.addEventListener("click", () => showRegionList("camp"));
  els.campCharacterButton.addEventListener("click", () => showCharacterList("camp"));
  els.campRecordButton.addEventListener("click", () => showStatisticsScreen("camp"));
  els.campStorageButton.addEventListener("click", () => showScreenInContext("storageScreen", "camp"));
  els.campPlacesButton.addEventListener("click", () => {
    if (!els.campPlacesButton.disabled) showFacilityList(uiState.safeAreaId, "camp");
  });
  els.campTravelButton.addEventListener("click", showSafeAreaTravelScreen);
  els.safeAreaTravelList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-safe-area-id]");
    if (button && els.safeAreaTravelList.contains(button)) handleSafeAreaTravel(button.dataset.safeAreaId);
  });
  els.safeAreaTravelBackButton.addEventListener("click", () => showScreen("campScreen"));
  els.campBackButton.addEventListener("click", restart);
  els.storageBackButton.addEventListener("click", () => showScreen(getNavigationReturnTarget()));
  els.facilityBackButton.addEventListener("click", () => showScreen(getNavigationReturnTarget()));
  els.merchantBackButton.addEventListener("click", () => showFacilityList(uiState.safeAreaId, uiState.navigationContext));
  els.dialogueBackButton.addEventListener("click", () => showFacilityList(uiState.safeAreaId, uiState.navigationContext));
  els.blacksmithBackButton.addEventListener("click", handleBlacksmithBack);
  els.guildRecordBackButton.addEventListener("click", handleGuildRecordBack);
  els.guildQuestBackButton.addEventListener("click", handleGuildQuestBack);
  els.guildBulkBackButton.addEventListener("click", handleGuildBulkBack);
  els.backToRegionListButton.addEventListener("click", () => showRegionList());
  els.backToCharacterListButton.addEventListener("click", () => showCharacterList());
  els.backToCharacterDetailButton.addEventListener("click", () => showCharacterDetail(uiState.characterDetailId));
  els.openCharacterEquipmentButton.addEventListener("click", () => showCharacterEquipment(uiState.characterDetailId));
  els.characterSkillSearchInput.addEventListener("input", () => {
    uiState.characterSkillSearchQuery = els.characterSkillSearchInput.value;
    renderCharacterScreen();
  });
  els.characterSkillTypeSelect.addEventListener("change", () => {
    uiState.characterSkillTypeFilter = els.characterSkillTypeSelect.value;
    renderCharacterScreen();
  });
  els.characterSkillStageFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-stage-filter]");
    if (!button || !els.characterSkillStageFilters.contains(button)) return;
    uiState.characterSkillStageFilter = button.dataset.stageFilter || "all";
    renderCharacterScreen();
  });
  els.statisticsTabs.forEach((button) => button.addEventListener("click", () => showStatisticsView(button.dataset.statisticsView)));
  els.selectCharacterButton.addEventListener("click", selectCharacterFromDetail);
  els.closeCharacterLockedButton.addEventListener("click", closeLockedCharacterHint);
  documentRef.querySelectorAll(".back-button").forEach((button) => button.addEventListener("click", () => showScreen(button.dataset.target)));
  documentRef.querySelectorAll(".home-button").forEach((button) => button.addEventListener("click", restart));
  els.startButton.addEventListener("click", startPlayerRun);
  els.restartButton.addEventListener("click", restart);
  els.retryButton.addEventListener("click", handleEndPrimaryAction);
  els.viewLogButton.addEventListener("click", closeEndPanel);
  els.revealStoryButton.addEventListener("click", revealStoryText);
  els.finishStoryButton.addEventListener("click", completePlainsStory);
  els.revealAnpingArrivalButton.addEventListener("click", revealAnpingArrivalPage);
  els.continueAnpingArrivalButton.addEventListener("click", continueAnpingArrivalStory);
  els.nextButton.addEventListener("click", playTurn);
  els.fleeButton.addEventListener("click", tryFlee);
  els.continueButton.addEventListener("click", continueAdventure);
  els.eventContinueButton.addEventListener("click", handleEventContinueButton);
  els.restButton.addEventListener("click", restAtSafeRoute);
  els.retreatButton.addEventListener("click", retreatRun);
  [els.openAbilityFromAttack, els.openAbilityFromDefense, els.openAbilityFromCrit]
    .forEach((button) => button.addEventListener("click", openAbilityInfoPanel));
  els.closeAbilityInfoButton.addEventListener("click", closeAbilityInfoPanel);
  els.viewBlessingsButton.addEventListener("click", openBlessingInfoPanel);
  els.closeBlessingInfoButton.addEventListener("click", closeBlessingInfoPanel);
  els.exportSaveCodeButton.addEventListener("click", openExportSaveCodeDialog);
  els.importSaveCodeButton.addEventListener("click", openImportSaveCodeDialog);
  els.copySaveCodeButton.addEventListener("click", copySaveCode);
  els.closeExportSaveCodeButton.addEventListener("click", closeExportSaveCodeDialog);
  els.checkSaveCodeButton.addEventListener("click", checkImportSaveCode);
  els.confirmImportSaveCodeButton.addEventListener("click", confirmImportSaveCode);
  els.closeImportSaveCodeButton.addEventListener("click", closeImportSaveCodeDialog);
  els.deleteSaveButton.addEventListener("click", openDeleteSaveDialog);
  els.confirmDeleteSaveButton.addEventListener("click", deleteSave);
  els.cancelDeleteSaveButton.addEventListener("click", closeDeleteSaveDialog);
  els.closeAchievementDetailButton.addEventListener("click", closeAchievementDetailPanel);
  els.achievementDetailBackdrop.addEventListener("click", closeAchievementDetailPanel);
  els.closeAchievementUnlockToastButton.addEventListener("click", () => closeAchievementUnlockToast());
  els.closeMerchantSaleButton.addEventListener("click", facilityController.closeMerchantSale);
  els.confirmGuildQuestAbandonButton.addEventListener("click", facilityController.confirmGuildQuestAbandon);
  els.closeGuildQuestAbandonButton.addEventListener("click", facilityController.closeGuildQuestAbandon);
  els.closeGuildBulkConfirmButton.addEventListener("click", facilityController.closeGuildBulkConfirm);
  els.closeBlacksmithCraftButton.addEventListener("click", facilityController.closeBlacksmithCraft);
  [
    [els.merchantSalePanel, facilityController.closeMerchantSale],
    [els.guildQuestAbandonPanel, facilityController.closeGuildQuestAbandon],
    [els.guildBulkConfirmPanel, facilityController.closeGuildBulkConfirm],
    [els.blacksmithCraftPanel, facilityController.closeBlacksmithCraft],
    [els.abilityInfoPanel, closeAbilityInfoPanel],
    [els.blessingInfoPanel, closeBlessingInfoPanel],
    [els.exportSaveCodePanel, closeExportSaveCodeDialog],
    [els.importSaveCodePanel, closeImportSaveCodeDialog]
  ].forEach(([panel, closePanel]) => bindBackdropClose(panel, closePanel));
  documentRef.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && uiState.achievementDetailOpen) closeAchievementDetailPanel();
  });
  documentRef.addEventListener("click", handleUserInteraction);
}
