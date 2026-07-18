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
  downloadSaveTransferFile,
  parseSaveTransferCode,
  readSaveTransferFile
} from "../../ui/saveTools.js";

export function createSaveTransferController({
  saveStore,
  els,
  windowRef = window,
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
  let exportRequestId = 0;
  let importCheckRequestId = 0;

  function setSaveNotice(message, type = "status") {
    els.saveNotice.textContent = message;
    els.saveNotice.dataset.type = type;
  }

  async function openExportSaveCodeDialog() {
    const requestId = ++exportRequestId;
    els.exportSaveCodePanel.classList.add("is-visible");
    els.exportSaveCodeText.value = "";
    els.copySaveCodeButton.disabled = true;
    els.downloadSaveFileButton.disabled = true;
    setSaveCodeNotice(els.exportSaveCodeNotice, "正在建立壓縮存檔碼……");

    const exportData = migrateSave(saveStore.current);
    exportData.profile.exportedAt = new Date().toISOString();
    try {
      const code = await createSaveTransferCode(exportData, GAME_VERSION);
      if (requestId !== exportRequestId) return;
      els.exportSaveCodeText.value = code;
      els.copySaveCodeButton.disabled = false;
      els.downloadSaveFileButton.disabled = false;
      setSaveCodeNotice(els.exportSaveCodeNotice, "壓縮存檔碼已產生，可複製或下載備份檔。");
      els.exportSaveCodeText.focus();
      els.exportSaveCodeText.select();
    } catch {
      if (requestId !== exportRequestId) return;
      setSaveCodeNotice(els.exportSaveCodeNotice, "無法建立壓縮存檔，請更新瀏覽器後再試。", "error");
    }
  }

  function closeExportSaveCodeDialog() {
    exportRequestId += 1;
    els.exportSaveCodePanel.classList.remove("is-visible");
  }

  async function copySaveCode() {
    if (!els.exportSaveCodeText.value) {
      setSaveCodeNotice(els.exportSaveCodeNotice, "存檔碼尚未產生完成。", "error");
      return;
    }
    try {
      await copyText(els.exportSaveCodeText.value);
      setSaveCodeNotice(els.exportSaveCodeNotice, "已複製存檔碼。");
    } catch {
      els.exportSaveCodeText.focus();
      els.exportSaveCodeText.select();
      setSaveCodeNotice(els.exportSaveCodeNotice, "無法自動複製，請手動選取文字碼。", "error");
    }
  }

  function downloadSaveFile() {
    try {
      const fileName = downloadSaveTransferFile(els.exportSaveCodeText.value, GAME_VERSION, {
        documentRef: windowRef.document,
        urlApi: windowRef.URL,
        BlobCtor: windowRef.Blob
      });
      setSaveCodeNotice(els.exportSaveCodeNotice, `已下載 ${fileName}。`);
    } catch {
      setSaveCodeNotice(els.exportSaveCodeNotice, "無法下載存檔檔案，請改用複製存檔碼。", "error");
    }
  }

  function openImportSaveCodeDialog() {
    pendingSaveCodeImport = null;
    importCheckRequestId += 1;
    els.importSaveCodeText.value = "";
    els.importSaveFileInput.value = "";
    els.confirmImportSaveCodeButton.hidden = true;
    setSaveCodeNotice(els.importSaveCodeNotice, "貼上存檔碼或選擇 .lesave 檔案後，先檢查內容。");
    els.importSaveCodePanel.classList.add("is-visible");
    els.importSaveCodeText.focus();
  }

  function closeImportSaveCodeDialog() {
    pendingSaveCodeImport = null;
    importCheckRequestId += 1;
    els.importSaveCodePanel.classList.remove("is-visible");
  }

  function chooseSaveFile() {
    els.importSaveFileInput.click();
  }

  async function handleSaveFileSelected() {
    const file = els.importSaveFileInput.files?.[0];
    if (!file) return;
    pendingSaveCodeImport = null;
    els.confirmImportSaveCodeButton.hidden = true;
    try {
      els.importSaveCodeText.value = await readSaveTransferFile(file);
      await checkImportSaveCode();
    } catch {
      setSaveCodeNotice(els.importSaveCodeNotice, "存檔檔案無法讀取，請確認檔案是否完整。", "error");
    } finally {
      els.importSaveFileInput.value = "";
    }
  }

  async function checkImportSaveCode() {
    const requestId = ++importCheckRequestId;
    pendingSaveCodeImport = null;
    els.confirmImportSaveCodeButton.hidden = true;
    setSaveCodeNotice(els.importSaveCodeNotice, "正在檢查存檔內容……");
    try {
      const payload = await parseSaveTransferCode(els.importSaveCodeText.value);
      if (requestId !== importCheckRequestId) return;
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
      if (requestId !== importCheckRequestId) return;
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
    downloadSaveFile,
    openImportSaveCodeDialog,
    closeImportSaveCodeDialog,
    chooseSaveFile,
    handleSaveFileSelected,
    checkImportSaveCode,
    confirmImportSaveCode,
    openDeleteSaveDialog,
    closeDeleteSaveDialog,
    deleteSave
  });
}
