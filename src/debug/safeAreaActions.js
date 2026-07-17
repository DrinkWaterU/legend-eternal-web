import {
  getCurrentSafeAreaId,
  isSafeAreaUnlocked,
  isSafeAreaVisited,
  markSafeAreaVisited,
  setCurrentSafeArea
} from "../core/safeAreaProgression.js";
import { createDefaultSave, deleteStoredSave } from "../core/storage.js";
import {
  ANPING_TOWN_SAFE_AREA_ID,
  DEFAULT_SAFE_AREA_ID,
  getSafeAreaDefinition,
  getSafeAreaDefinitions
} from "../data/safeAreas.js";

export function createDebugSafeAreaActions({
  getSaveData,
  replaceSaveData,
  saveGameSafe,
  syncSafeAreaUiFromSave,
  syncSelectionFromSave,
  restart,
  syncMusicSettingsFromSave,
  returnToCamp,
  returnToSafeArea,
  showAnpingArrivalStory,
  showSafeAreaTravelScreen
}) {
  function getSafeAreaOptions() {
    const saveData = getSaveData();
    const currentSafeAreaId = getCurrentSafeAreaId(saveData);
    return getSafeAreaDefinitions().map((safeArea) => ({
      id: safeArea.id,
      name: safeArea.name,
      current: safeArea.id === currentSafeAreaId,
      unlocked: isSafeAreaUnlocked(saveData, safeArea.id),
      visited: isSafeAreaVisited(saveData, safeArea.id)
    }));
  }

  function prepareSafeArea(safeAreaId) {
    const safeArea = requireResettableSafeArea(safeAreaId);
    const saveData = getSaveData();
    const now = new Date().toISOString();
    const progress = saveData.progression.safeAreas[safeArea.id];
    progress.unlocked = true;
    progress.unlockedAt ||= now;
    progress.visitedAt = null;
    setCurrentSafeArea(saveData, DEFAULT_SAFE_AREA_ID);
    persistSafeAreaChange();
    returnToSafeArea(DEFAULT_SAFE_AREA_ID);
    return `已將${safeArea.name}設為「已解鎖、未造訪」，並回到冒險營地。`;
  }

  function visitSafeArea(safeAreaId) {
    const safeArea = requireSafeArea(safeAreaId);
    const saveData = getSaveData();
    markSafeAreaVisited(saveData, safeArea.id);
    setCurrentSafeArea(saveData, safeArea.id);
    persistSafeAreaChange();
    returnToSafeArea(safeArea.id);
    return `已將${safeArea.name}標記為已造訪並直接前往。`;
  }

  function travelSafeArea(safeAreaId) {
    const safeArea = requireSafeArea(safeAreaId);
    const saveData = getSaveData();
    if (!isSafeAreaVisited(saveData, safeArea.id)) {
      throw new Error(`${safeArea.name}尚未造訪；請先標記已造訪或播放首次抵達。`);
    }
    setCurrentSafeArea(saveData, safeArea.id);
    persistSafeAreaChange();
    returnToSafeArea(safeArea.id);
    return `已前往${safeArea.name}。`;
  }

  function resetSafeArea(safeAreaId) {
    const safeArea = requireResettableSafeArea(safeAreaId, "冒險營地是預設據點，不能重設為鎖定。");
    const saveData = getSaveData();
    const progress = saveData.progression.safeAreas[safeArea.id];
    progress.unlocked = false;
    progress.unlockedAt = null;
    progress.visitedAt = null;
    setCurrentSafeArea(saveData, DEFAULT_SAFE_AREA_ID);
    persistSafeAreaChange();
    returnToSafeArea(DEFAULT_SAFE_AREA_ID);
    return `已重設${safeArea.name}，目前只保留冒險營地。`;
  }

  function playAnpingArrival() {
    prepareSafeArea(ANPING_TOWN_SAFE_AREA_ID);
    if (!showAnpingArrivalStory({ source: "debug" })) {
      throw new Error("無法開啟安平鎮首次抵達演出。");
    }
    return "已準備並播放安平鎮首次抵達；本次完成會寫入正式存檔。";
  }

  function openSafeAreaTravel() {
    showSafeAreaTravelScreen();
    return "已開啟通用據點移動頁。";
  }

  function returnToCampAction() {
    returnToCamp();
    return "已回到營地。";
  }

  function deleteSave() {
    try {
      deleteStoredSave();
    } catch {
      // Keep the in-memory reset usable if storage is blocked.
    }
    replaceSaveData(createDefaultSave());
    saveGameSafe();
    syncSelectionFromSave();
    restart();
    syncMusicSettingsFromSave();
    return "已刪除存檔並建立空白存檔。";
  }

  function persistSafeAreaChange() {
    if (!saveGameSafe()) {
      throw new Error("無法保存安全區 Debug 狀態。");
    }
    syncSafeAreaUiFromSave();
  }

  return {
    getSafeAreaOptions,
    prepareSafeArea,
    visitSafeArea,
    travelSafeArea,
    openSafeAreaTravel,
    resetSafeArea,
    playAnpingArrival,
    returnToCamp: returnToCampAction,
    deleteSave
  };
}

function requireSafeArea(safeAreaId) {
  const safeArea = getSafeAreaDefinition(safeAreaId);
  if (!safeArea) throw new Error("找不到指定安全區。");
  return safeArea;
}

function requireResettableSafeArea(safeAreaId, message = "請選擇可重設的非預設據點。") {
  const safeArea = getSafeAreaDefinition(safeAreaId);
  if (!safeArea || safeArea.id === DEFAULT_SAFE_AREA_ID) {
    throw new Error(message);
  }
  return safeArea;
}
