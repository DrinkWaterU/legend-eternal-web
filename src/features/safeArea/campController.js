import { getExpToNextLevel } from "../../core/progression.js";
import { formatInventorySummary } from "../../core/rewards.js";
import { DEFAULT_SAFE_AREA_ID } from "../../data/safeAreas.js";
import { renderStatList } from "../../ui/renderHelpers.js";

export function createCampController({
  state,
  saveStore,
  els,
  characterDefinitions,
  materialDefinitions,
  currentRegion,
  normalizeCharacterProgress,
  getCurrentSafeArea,
  getAvailableFacilities,
  hasPhoenixBlessing,
  renderCampTravelButton
}) {
  function renderMenuScreen() {
    const safeAreaHint = els.openRegionButton.querySelector("small");
    if (safeAreaHint) {
      safeAreaHint.textContent = `進入${getCurrentSafeArea()?.name || "安全區"}`;
    }
    const achievementHint = els.openAchievementButton.querySelector("small");
    if (achievementHint) {
      achievementHint.textContent = saveStore.current.storyFlags.achievementSystemUnlocked
        ? "查看已解鎖成就"
        : "尚未開放";
    }
  }

  function renderCampScreen() {
    const region = currentRegion();
    const character = characterDefinitions[state.selectedHeroId];
    const progress = normalizeCharacterProgress(state.selectedHeroId);
    const expToNext = getExpToNextLevel(progress.level, character);
    const lastResult = state.lastRunSummary
      ? `${state.lastRunSummary.sourceName} ${state.lastRunSummary.reachedEncounter} / ${state.lastRunSummary.encounterTotal} 場${state.lastRunSummary.result}`
      : "尚無紀錄";
    const inventorySummary = formatInventorySummary(saveStore.current.inventory, materialDefinitions);
    const safeArea = getCurrentSafeArea();
    const facilities = getAvailableFacilities(safeArea);
    const phoenixUnlocked = hasPhoenixBlessing();
    const campStats = [
      ["目前角色", `${character.name} Lv.${progress.level}`],
      ["目前地區", region.name],
      ["經驗", `${progress.exp} / ${expToNext}`],
      phoenixUnlocked ? ["目前金幣", inventorySummary.gold] : ["最近冒險", lastResult]
    ];

    els.campEyebrow.textContent = safeArea.eyebrow || safeArea.name;
    els.campTitle.textContent = safeArea.title || safeArea.name;
    els.campDescription.textContent = safeArea.description || "";
    els.campFeatureTitle.textContent = safeArea.featureTitle || "安全區功能";
    els.campFeatureTitle.closest("section")?.setAttribute("aria-label", safeArea.featureTitle || "安全區功能");
    renderStatList(els.campStatusList, campStats);
    els.campStartHint.textContent = phoenixUnlocked
      ? `前往${region.name}，確認本輪準備並繼續旅程`
      : `前往${region.name}開始旅程`;
    els.campRegionHint.textContent = `目前：${region.name}`;
    els.campCharacterHint.textContent = `${character.name} Lv.${progress.level}`;
    els.campStorageHint.textContent = "整理帶回的素材";
    els.campPlacesHint.textContent = facilities.length > 0
      ? safeArea.placesDescription || "四處看看"
      : safeArea.placesLockedDescription || "目前沒有可前往的地方";
    els.campRecordHint.textContent = "查看過往旅程";
    els.campStorageButton.hidden = !phoenixUnlocked;
    els.campPlacesButton.hidden = facilities.length === 0 && safeArea.id === DEFAULT_SAFE_AREA_ID;
    els.campPlacesButton.disabled = facilities.length === 0;
    renderCampTravelButton(safeArea);

    if (els.campWarning) {
      els.campWarning.textContent = phoenixUnlocked
        ? "鳳凰的加護已覺醒。死亡會結束本輪冒險，但角色等級與經驗會保留。"
        : "警告：死亡會失去目前等級與經驗；撤退能保留成長。";
      els.campWarning.dataset.type = phoenixUnlocked ? "blessed" : "danger";
    }
  }

  return Object.freeze({ renderMenuScreen, renderCampScreen });
}
