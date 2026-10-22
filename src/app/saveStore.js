export function createSaveStore({ initialSave, persistSave }) {
  if (!initialSave || typeof initialSave !== "object") {
    throw new TypeError("Save Store 需要有效的初始存檔");
  }
  if (typeof persistSave !== "function") {
    throw new TypeError("Save Store 需要 persistSave 函式");
  }

  let current = initialSave;
  let pending = null;
  let calculating = false;
  let operationDraft = null;
  const listeners = new Set();
  const notify = () => listeners.forEach((listener) => listener());

  function attemptCommit() {
    if (!pending) return { status: "idle" };
    // Legacy callers still mutate current directly. Never overwrite such changes
    // with an older candidate while the remaining flows are being migrated.
    if (JSON.stringify(current) !== pending.base) {
      return { status: "conflict", error: new Error("目前資料已變更，請重新載入最後存檔，避免覆蓋其他進度。") };
    }
    const candidate = structuredClone(pending.candidate);
    let failure;
    try {
      const saved = persistSave(candidate, { onError: (error) => { failure = error; } });
      if (saved !== true) {
        return { status: "pending", error: failure || new Error("瀏覽器無法保存這次結果。") };
      }
    } catch (error) {
      return { status: "pending", error };
    }
    current = candidate;
    pending = null;
    notify();
    return { status: "saved" };
  }

  return Object.freeze({
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    get current() {
      return operationDraft || current;
    },
    get hasPendingTransaction() {
      return pending !== null;
    },
    transact(mutate, { skipUnchanged = false } = {}) {
      if (calculating) throw new Error("交易內請共用候選資料，不可再次開始交易。");
      if (pending) return { status: "blocked" };
      if (typeof mutate !== "function") throw new TypeError("交易需要候選資料修改函式。");
      const base = JSON.stringify(current);
      const draft = structuredClone(current);
      calculating = true;
      try {
        const value = mutate(draft);
        if (value && typeof value.then === "function") throw new TypeError("存檔交易必須同步完成。");
        if (skipUnchanged && JSON.stringify(draft) === base) return { status: "saved" };
        // Detach from references retained by the rule callback before retrying.
        pending = { base, candidate: structuredClone(draft) };
      } finally {
        calculating = false;
      }
      return attemptCommit();
    },
    retryPending() {
      return attemptCommit();
    },
    // Bridge synchronous gameplay rules to one candidate. Inner legacy saves
    // acknowledge staging; only the outer transaction may write to storage.
    withOperationDraft(draft, action) {
      if (!calculating || operationDraft) throw new Error("冒險操作必須在單一存檔交易內執行。");
      operationDraft = draft;
      try {
        return action();
      } finally {
        operationDraft = null;
      }
    },
    replace(nextSave) {
      if (pending || calculating) throw new Error("請先完成待保存交易，再替換存檔。");
      if (!nextSave || typeof nextSave !== "object") {
        throw new TypeError("不能以無效資料替換存檔");
      }
      current = nextSave;
      notify();
      return current;
    },
    persist(options = {}) {
      if (operationDraft) return true;
      if (pending || calculating) return false;
      const saved = persistSave(current, options);
      if (saved) notify();
      return saved;
    }
  });
}
