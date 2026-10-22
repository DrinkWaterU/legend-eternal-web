import { createApplication } from "./createApplication.js";
import { setStorageWriteGuard } from "../core/storage.js";

function showBlockedWriter(documentRef, windowRef, message) {
  const dialog = documentRef.createElement("dialog");
  dialog.className = "save-transaction-dialog writer-lock-dialog";
  dialog.setAttribute("aria-label", "遊戲分頁尚未取得寫入權");
  const title = documentRef.createElement("h2");
  title.textContent = "先回到正在遊玩的分頁";
  const text = documentRef.createElement("p");
  text.textContent = message;
  const retry = documentRef.createElement("button");
  retry.textContent = "重新載入並繼續";
  retry.addEventListener("click", () => windowRef.location.reload());
  dialog.addEventListener("cancel", event => event.preventDefault());
  dialog.append(title, text, retry);
  documentRef.body.append(dialog);
  dialog.showModal();
}

// Web Locks arbitrate BEFORE load/migration/import/deletion can write. A lock
// lives with this document, including while hidden, and is released on pagehide.
export function startGame({ documentRef = document, windowRef = window, navigatorRef = navigator,
  createApp = createApplication } = {}) {
  let ownsLock = false;
  setStorageWriteGuard(() => ownsLock);
  const block = message => showBlockedWriter(documentRef, windowRef, message);
  if (!navigatorRef.locks) {
    block(windowRef.isSecureContext === false
      ? "請透過 HTTPS 或本機 localhost 開啟遊戲，才能安全鎖定存檔分頁；目前尚未讀寫你的進度。"
      : "此瀏覽器不支援安全的分頁鎖定。請更新瀏覽器後再開啟遊戲；目前尚未讀寫你的進度。");
    return Promise.resolve();
  }
  return new Promise(resolve => {
    navigatorRef.locks.request("legend-eternal-save-writer", { mode: "exclusive", ifAvailable: true }, async lock => {
      if (!lock) {
        block("另一個分頁正在使用這份進度。請先在原分頁保存並關閉它，再按下方按鈕載入最新進度。此分頁尚未讀寫存檔。");
        resolve();
        return;
      }
      ownsLock = true;
      let release;
      const lifetime = new Promise(done => { release = done; });
      windowRef.addEventListener("pagehide", () => { ownsLock = false; release(); }, { once: true });
      windowRef.addEventListener("pageshow", event => { if (event.persisted) windowRef.location.reload(); });
      try {
        createApp({ documentRef, windowRef }).start();
        resolve();
        await lifetime;
      } finally { ownsLock = false; }
    }).catch(error => {
      ownsLock = false;
      block(`無法取得分頁寫入權：${error.message}`);
      resolve();
    });
  });
}
