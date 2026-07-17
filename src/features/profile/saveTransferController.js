import { GAME_VERSION } from "../../config.js";
import {
  createDefaultSave,
  deleteStoredSave,
  isImportableSave,
  migrateSave
} from "../../core/storage.js";
import {
  copyText,
  createSaveTransferCode,
  parseSaveTransferCode
} from "../../ui/saveTools.js";

export function createSaveTransferController({
  saveStore,
  els,
  saveGameSafe,
  syncSafeAreaUiFromSave,
  syncSelectionFromSave,
  syncMusicSettingsFromSave,
  resetAdventureRunRuntime,
  resetPreparationUiState,
  resetAchievementUiRuntime,
  resetFacilityUiState,
  resetStatisticsUiAfterSaveReplacement,
  renderStatistics
}) {
  let pendingSaveCodeImport = null;

  function setSaveNotice(message, type = "status") {
    els.saveNotice.textContent = message;
    els.saveNotice.dataset.type = type;
  }

  function openExportSaveCodeDialog() {
    const exportData = migrateSave(saveStore.current);
    exportData.profile.exportedAt = new Date().toISOString();
    els.exportSaveCodeText.value = createSaveTransferCode(exportData, GAME_VERSION);
    setSaveCodeNotice(els.exportSaveCodeNotice, "存檔碼已產生。");
    els.exportSaveCodePanel.classList.add("is-visible");
    els.exportSaveCodeText.focus();
    els.exportSaveCodeText.select();
  }

  function closeExportSaveCodeDialog() {
    els.exportSaveCodePanel.classList.remove("is-visible");
  }

  async function copySaveCode() {
    try {
      await copyText(els.exportSaveCodeText.value);
      setSaveCodeNotice(els.exportSaveCodeNotice, "已複製存檔碼。");
    } catch {
      els.exportSaveCodeText.focus();
      els.exportSaveCodeText.select();
      setSaveCodeNotice(els.exportSaveCodeNotice, "無法自動複製，請手動選取文字碼。", "error");
    }
  }

  function openImportSaveCodeDialog() {
    pendingSaveCodeImport = null;
    els.importSaveCodeText.value = "";
    els.confirmImportSaveCodeButton.hidden = true;
    setSaveCodeNotice(els.importSaveCodeNotice, "貼上存檔碼後先檢查內容。");
    els.importSaveCodePanel.classList.add("is-visible");
    els.importSaveCodeText.focus();
  }

  function closeImportSaveCodeDialog() {
    pendingSaveCodeImport = null;
    els.importSaveCodePanel.classList.remove("is-visible");
  }

  function checkImportSaveCode() {
    pendingSaveCodeImport = null;
    els.confirmImportSaveCodeButton.hidden = true;
    try {
      const payload = parseSaveTransferCode(els.importSaveCodeText.value);
      if (!isImportableSave(payload.save)) {
        throw new Error("Invalid save payload");
      }
      pendingSaveCodeImport = migrateSave(payload.save);
      els.confirmImportSaveCodeButton.hidden = false;
      setSaveCodeNotice(
        els.importSaveCodeNotice,
        `存檔碼可匯入。來源版本：${payload.gameVersion || "未知"}。確認後會覆蓋目前存檔。`
      );
    } catch {
      setSaveCodeNotice(els.importSaveCodeNotice, "存檔碼無法匯入，請確認是否完整複製。", "error");
    }
  }

  function confirmImportSaveCode() {
    if (!pendingSaveCodeImport) {
      setSaveCodeNotice(els.importSaveCodeNotice, "請先檢查存檔碼。", "error");
      return;
    }

    saveStore.replace(migrateSave(pendingSaveCodeImport, { persist: true }));
    pendingSaveCodeImport = null;
    resetRuntimeAfterSaveReplacement();
    closeImportSaveCodeDialog();
    setSaveNotice("存檔碼已匯入並轉換為目前版本。");
    els.resultLabel.textContent = "存檔已匯入";
    els.encounterLabel.textContent = "統計數據";
  }

  function resetRuntimeAfterSaveReplacement() {
    syncSafeAreaUiFromSave();
    resetAdventureRunRuntime({ clearLastRunSummary: true });
    resetPreparationUiState();
    resetAchievementUiRuntime();
    resetFacilityUiState();
    syncSelectionFromSave();
    syncMusicSettingsFromSave();
    resetStatisticsUiAfterSaveReplacement();
    renderStatistics();
  }

  function setSaveCodeNotice(element, message, type = "status") {
    element.textContent = message;
    element.dataset.type = type;
  }

  function openDeleteSaveDialog() {
    els.deleteSavePanel.classList.add("is-visible");
  }

  function closeDeleteSaveDialog() {
    els.deleteSavePanel.classList.remove("is-visible");
  }

  function deleteSave() {
    try {
      deleteStoredSave();
    } catch {
      // The in-memory reset still keeps the page usable if storage is blocked.
    }
    saveStore.replace(createDefaultSave());
    resetRuntimeAfterSaveReplacement();
    saveGameSafe();
    closeDeleteSaveDialog();
    setSaveNotice("存檔已刪除，新的空白存檔已建立。");
    els.resultLabel.textContent = "存檔已刪除";
    els.encounterLabel.textContent = "統計數據";
  }

  return Object.freeze({
    setSaveNotice,
    openExportSaveCodeDialog,
    closeExportSaveCodeDialog,
    copySaveCode,
    openImportSaveCodeDialog,
    closeImportSaveCodeDialog,
    checkImportSaveCode,
    confirmImportSaveCode,
    openDeleteSaveDialog,
    closeDeleteSaveDialog,
    deleteSave
  });
}
