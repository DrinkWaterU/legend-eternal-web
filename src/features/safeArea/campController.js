import { describeEmberRecovery } from "../../core/emberRecovery.js";
import {
  getCharacterMaxLevel,
  getExpStorageLimit,
  getExpToNextLevel
} from "../../core/progression.js";
import { formatInventorySummary } from "../../core/rewards.js";
import { DEFAULT_SAFE_AREA_ID } from "../../data/safeAreas.js";
import { getRegionDisplayName } from "../../data/regions/regionDefinition.js";

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
  renderCampTravelButton,
  storyQuestRuntime
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
        : "星光尚未照見";
    }
  }

  function renderCampScreen() {
    storyQuestRuntime.refreshAvailability();
    const region = currentRegion();
    const character = characterDefinitions[state.selectedHeroId];
    const progress = normalizeCharacterProgress(state.selectedHeroId);
    const experienceSummary = getCampExperienceSummary(progress, character);
    const lastResult = state.lastRunSummary
      ? `${state.lastRunSummary.sourceName} ${state.lastRunSummary.reachedEncounter} / ${state.lastRunSummary.encounterTotal} 場${state.lastRunSummary.result}`
      : "尚無紀錄";
    const inventorySummary = formatInventorySummary(saveStore.current.inventory, materialDefinitions);
    const safeArea = getCurrentSafeArea();
    const facilities = getAvailableFacilities(safeArea);
    const phoenixUnlocked = hasPhoenixBlessing();
    const regionName = getRegionDisplayName(region);
    const progression = saveStore.current.progression || {};
    const unlockedRegionCount = Object.values(progression.regions || {}).filter((entry) => entry?.unlocked).length;
    const unlockedCharacterCount = Object.values(progression.characters || {}).filter((entry) => entry?.unlocked).length;

    els.campEyebrow.textContent = safeArea.eyebrow || safeArea.name;
    els.campTitle.textContent = safeArea.title || safeArea.name;
    els.campDescription.textContent = safeArea.description || "";
    els.campFeatureTitle.textContent = safeArea.featureTitle || "安全區功能";
    els.campFeatureTitle.closest("section")?.setAttribute("aria-label", safeArea.featureTitle || "安全區功能");
    // 隊伍狀態：角色、等級、經驗條；金幣在鳳凰加護後才有用途，之前不顯示。
    els.campPartyName.textContent = character.name;
    els.campPartyLevel.textContent = `Lv.${progress.level}`;
    els.campPartyGold.hidden = !phoenixUnlocked;
    els.campPartyGold.textContent = `${inventorySummary.gold} G`;
    els.campPartyExp.textContent = `${experienceSummary.title} ${experienceSummary.value}`;
    els.campPartyExpBar.style.width = `${Math.round(getCampExperienceRatio(progress, character) * 100)}%`;
    const pendingJourney = Boolean(saveStore.current.activeRun);
    const startLabel = els.campStartButton.querySelector("span");
    if (startLabel) startLabel.textContent = pendingJourney ? "繼續冒險" : "出發冒險";
    els.campStartHint.textContent = pendingJourney ? "接續最後保存的旅程；如要重新出發，請先結束該次冒險。" : phoenixUnlocked
      ? `前往${regionName}`
      : `前往${regionName}開始旅程`;
    // 指令列右側只放簡短狀態；目的地已寫在出發鈕上，這裡改顯示可選數量，避免同一資訊出現多次。
    els.campRegionHint.textContent = `${unlockedRegionCount} 個地區`;
    els.campCharacterHint.textContent = `${unlockedCharacterCount} 名角色`;
    els.campStorageHint.textContent = `${inventorySummary.materialTypes} 種素材`;
    els.campPlacesHint.textContent = facilities.length > 0
      ? `${facilities.length} 處可去`
      : safeArea.placesLockedDescription || "目前沒有可前往的地方";
    els.campRecordHint.textContent = state.lastRunSummary ? `最近：${lastResult}` : "尚無紀錄";
    const storyQuestSnapshot = storyQuestRuntime.getSnapshot();
    const activeQuestCount = storyQuestSnapshot.entries.filter(({ record }) => record.status !== "completed").length;
    els.campStoryQuestButton.hidden = !storyQuestSnapshot.hasRecords;
    els.campStoryQuestButton.dataset.attention = String(activeQuestCount > 0);
    els.campStoryQuestHint.textContent = activeQuestCount > 0
      ? `${activeQuestCount} 項待處理`
      : "全部完成";
    els.campStorageButton.hidden = !phoenixUnlocked;
    els.campPlacesButton.hidden = facilities.length === 0 && safeArea.id === DEFAULT_SAFE_AREA_ID;
    els.campPlacesButton.disabled = facilities.length === 0;
    renderCampTravelButton(safeArea);

    if (els.campWarning) {
      const emberText = describeEmberRecovery(progress);
      els.campWarning.textContent = (phoenixUnlocked
        ? "鳳凰加護：倒下會結束本輪，但保留等級與經驗。"
        : "警告：死亡會失去目前等級與經驗；撤退能保留成長。倒下時，沒有任何力量會接住你——至少現在還沒有。")
        + (emberText ? `\n灰燼回復中：${emberText}` : "");
      els.campWarning.dataset.type = phoenixUnlocked ? "blessed" : "danger";
    }
  }

  return Object.freeze({ renderMenuScreen, renderCampScreen });
}

export function getCampExperienceRatio(progress, character) {
  const level = Math.max(1, Math.min(
    getCharacterMaxLevel(character),
    Math.floor(Number(progress?.level) || 1)
  ));
  const exp = Math.max(0, Math.floor(Number(progress?.exp) || 0));
  const total = level >= getCharacterMaxLevel(character)
    ? getExpStorageLimit(level, character)
    : getExpToNextLevel(level, character);
  return total > 0 ? Math.min(1, exp / total) : 0;
}

export function getCampExperienceSummary(progress, character) {
  const level = Math.max(1, Math.min(
    getCharacterMaxLevel(character),
    Math.floor(Number(progress?.level) || 1)
  ));
  const exp = Math.max(0, Math.floor(Number(progress?.exp) || 0));
  if (level >= getCharacterMaxLevel(character)) {
    const storageLimit = getExpStorageLimit(level, character);
    return {
      title: "經驗（已達上限）",
      value: `儲備 ${Math.min(exp, storageLimit)}／${storageLimit}`
    };
  }
  const expToNext = getExpToNextLevel(level, character);
  // 升級只在冒險結算時發生；上限提高前儲滿的經驗會停在滿條，要說清楚不是卡住。
  if (exp >= expToNext) {
    return {
      title: "經驗已滿",
      value: "下次結算升級"
    };
  }
  return {
    title: "經驗",
    value: `${exp}／${expToNext}`
  };
}
