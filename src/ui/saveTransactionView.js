export function createSaveTransactionView(documentRef = document) {
  let dialog;
  let message;
  let retryButton;
  function show({ error, retry }) {
    if (!dialog) {
      dialog = documentRef.createElement("dialog");
      dialog.className = "save-transaction-dialog";
      dialog.setAttribute("aria-labelledby", "saveTransactionTitle");
      dialog.setAttribute("aria-describedby", "saveTransactionMessage");
      const title = documentRef.createElement("h2");
      title.id = "saveTransactionTitle";
      title.textContent = "這次結果尚未保存";
      message = documentRef.createElement("p");
      message.id = "saveTransactionMessage";
      message.setAttribute("role", "alert");
      const explanation = documentRef.createElement("p");
      explanation.textContent = "已暫停操作並保留這次結果。重試不會再次扣款或重新計算；關閉或重新整理頁面會失去尚未保存的結果。";
      retryButton = documentRef.createElement("button");
      retryButton.type = "button";
      retryButton.className = "save-transaction-retry";
      retryButton.textContent = "重試保存";
      const reload = documentRef.createElement("button");
      reload.type = "button";
      reload.textContent = "重新載入最後存檔";
      reload.addEventListener("click", () => {
        const view = documentRef.defaultView;
        if (view.confirm("放棄這次尚未保存的結果，重新載入最後成功保存的進度？")) view.location.reload();
      });
      dialog.addEventListener("cancel", (event) => event.preventDefault());
      dialog.append(title, message, explanation, retryButton, reload);
      documentRef.body.append(dialog);
    }
    message.textContent = error?.message || "瀏覽器無法保存這次結果。";
    retryButton.onclick = retry;
    if (!dialog.open) dialog.showModal();
    retryButton.focus();
  }
  function hide() {
    if (dialog?.open) dialog.close();
  }
  return Object.freeze({ show, hide });
}
