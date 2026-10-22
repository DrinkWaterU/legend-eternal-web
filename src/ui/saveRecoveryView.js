import { SAVE_KEY } from "../config.js";

// Keep persistence failures visible outside combat, including a failed first load.
export function createSaveRecoveryNotice(documentRef = document) {
  let panel;
  let message;
  return function showSaveError(error) {
    if (!panel) {
      panel = documentRef.createElement("aside");
      panel.className = "save-recovery-notice";
      panel.setAttribute("role", "alert");
      message = documentRef.createElement("p");
      const download = documentRef.createElement("button");
      download.type = "button";
      download.textContent = "下載原始存檔";
      download.addEventListener("click", () => {
        let url;
        try {
          const raw = localStorage.getItem(SAVE_KEY);
          if (!raw) throw new Error("瀏覽器中沒有可下載的原始存檔。");
          url = URL.createObjectURL(new Blob([raw], { type: "application/json" }));
          const link = documentRef.createElement("a");
          link.href = url;
          link.download = "legend-eternal-recovery.json";
          documentRef.body.append(link);
          link.click();
          link.remove();
        } catch (failure) {
          message.textContent = failure.message;
        } finally {
          if (url) setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
      });
      panel.append(message, download);
      documentRef.body.prepend(panel);
    }
    message.textContent = `${error?.message || "瀏覽器無法保存目前進度。"} 請先備份，再到統計數據的存檔管理匯入存檔；處理完成後重新整理頁面。`;
  };
}
