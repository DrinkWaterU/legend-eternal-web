export function createScreenController({
  state,
  saveStore,
  documentRef = document,
  els,
  syncRootScreenContext,
  applySceneContext,
  getCurrentSafeArea,
  facilityController,
  renderMenuScreen,
  renderCampScreen,
  renderSafeAreaTravelScreen,
  renderStorageScreen,
  renderFacilityScreen,
  renderRegionScreen,
  renderCharacterScreen,
  renderAchievementScreen,
  renderStatistics
}) {
  function showScreen(screenId) {
    syncRootScreenContext(screenId);
    applySceneContext(screenId);
    documentRef.querySelectorAll(".screen").forEach((screen) => {
      screen.classList.toggle("is-active", screen.id === screenId);
    });
    if (screenId === "menuScreen") {
      els.resultLabel.textContent = "冒險準備中";
      els.encounterLabel.textContent = "尚未開始";
      renderMenuScreen();
    } else if (screenId === "campScreen") {
      const safeArea = getCurrentSafeArea();
      els.resultLabel.textContent = safeArea?.name || "安全區";
      els.encounterLabel.textContent = state.selectedRegion;
      renderCampScreen();
    } else if (screenId === "safeAreaTravelScreen") {
      els.resultLabel.textContent = "據點移動";
      els.encounterLabel.textContent = getCurrentSafeArea()?.name || "安全區";
      renderSafeAreaTravelScreen();
    } else if (screenId === "storageScreen") {
      els.resultLabel.textContent = "倉庫";
      els.encounterLabel.textContent = getCurrentSafeArea()?.name || "安全區";
      renderStorageScreen();
    } else if (screenId === "facilityScreen") {
      els.resultLabel.textContent = facilityController.getFacilityScreenTitle();
      els.encounterLabel.textContent = getCurrentSafeArea()?.name || "安全區";
      renderFacilityScreen();
    } else if (screenId === "regionScreen") {
      els.resultLabel.textContent = "選擇地區";
      els.encounterLabel.textContent = state.selectedRegion;
      renderRegionScreen();
    } else if (screenId === "characterScreen") {
      els.resultLabel.textContent = "選擇角色";
      els.encounterLabel.textContent = state.selectedHero;
      renderCharacterScreen();
    } else if (screenId === "achievementScreen") {
      els.resultLabel.textContent = saveStore.current.storyFlags.achievementSystemUnlocked ? "成就紀錄" : "尚未開放";
      els.encounterLabel.textContent = "成就系統";
      renderAchievementScreen();
    } else if (screenId === "statisticsScreen") {
      els.resultLabel.textContent = "累積紀錄";
      els.encounterLabel.textContent = "統計數據";
      renderStatistics();
    }
  }

  return Object.freeze({ showScreen });
}
