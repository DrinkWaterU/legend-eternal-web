// Owns completion effects separately from candidate computation, so retrying
// storage never reruns rewards, random choices, or success notifications.
export function createSaveTransactions({ saveStore, pendingView }) {
  let onSaved = null;
  function finish(result) {
    if (result.status === "saved") {
      const complete = onSaved;
      onSaved = null;
      pendingView.hide();
      complete?.();
    } else if (result.status === "pending" || result.status === "conflict") {
      pendingView.show({ error: result.error, retry });
    }
    return result;
  }
  function retry() {
    return finish(saveStore.retryPending());
  }
  function commitSaveChange(mutate, complete = () => {}, options) {
    if (saveStore.hasPendingTransaction) return { status: "blocked" };
    // transact may throw a rule validation error; no completion is retained then.
    const result = saveStore.transact(mutate, options);
    onSaved = complete;
    return finish(result);
  }
  return Object.freeze({ commitSaveChange });
}
