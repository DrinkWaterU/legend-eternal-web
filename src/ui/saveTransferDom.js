export function getSaveTransferElements(documentRef = document) {
  return {
    exportSaveCodeButton: documentRef.querySelector("#exportSaveCodeButton"),
    importSaveCodeButton: documentRef.querySelector("#importSaveCodeButton"),
    saveNotice: documentRef.querySelector("#saveNotice"),
    deleteSaveButton: documentRef.querySelector("#deleteSaveButton"),
    deleteSavePanel: documentRef.querySelector("#deleteSavePanel"),
    confirmDeleteSaveButton: documentRef.querySelector("#confirmDeleteSaveButton"),
    cancelDeleteSaveButton: documentRef.querySelector("#cancelDeleteSaveButton"),
    exportSaveCodePanel: documentRef.querySelector("#exportSaveCodePanel"),
    exportSaveCodeText: documentRef.querySelector("#exportSaveCodeText"),
    exportSaveCodeNotice: documentRef.querySelector("#exportSaveCodeNotice"),
    copySaveCodeButton: documentRef.querySelector("#copySaveCodeButton"),
    downloadSaveFileButton: documentRef.querySelector("#downloadSaveFileButton"),
    closeExportSaveCodeButton: documentRef.querySelector("#closeExportSaveCodeButton"),
    importSaveCodePanel: documentRef.querySelector("#importSaveCodePanel"),
    importSaveCodeText: documentRef.querySelector("#importSaveCodeText"),
    importSaveFileInput: documentRef.querySelector("#importSaveFileInput"),
    chooseSaveFileButton: documentRef.querySelector("#chooseSaveFileButton"),
    importSaveCodeNotice: documentRef.querySelector("#importSaveCodeNotice"),
    checkSaveCodeButton: documentRef.querySelector("#checkSaveCodeButton"),
    confirmImportSaveCodeButton: documentRef.querySelector("#confirmImportSaveCodeButton"),
    closeImportSaveCodeButton: documentRef.querySelector("#closeImportSaveCodeButton")
  };
}
