import { createSaveStore } from "../src/app/saveStore.js";
import { createSaveTransactions } from "../src/app/saveTransactions.js";

export function createTestTransactions(initialSave, persistSave = () => true) {
  const saveStore = createSaveStore({ initialSave, persistSave });
  let retry;
  const transactions = createSaveTransactions({ saveStore, pendingView: {
    show(options) { retry = options.retry; }, hide() {}
  } });
  return { saveStore, ...transactions, retry: () => retry() };
}
