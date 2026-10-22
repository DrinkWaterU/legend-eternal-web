import assert from "node:assert/strict";
import { createSaveStore } from "../src/app/saveStore.js";
import { createSaveTransactions } from "../src/app/saveTransactions.js";

const makeSave = () => ({ inventory: { gold: 40, materials: { iron: 4 } }, statistics: { crafts: 0 } });
{
  const initialSave = makeSave();
  let succeeds = false;
  let computations = 0;
  let completions = 0;
  let leakedDraft;
  let retry;
  const attempts = [];
  const store = createSaveStore({ initialSave, persistSave: (candidate) => {
    assert.equal(store.current, initialSave, "正式狀態須等待保存成功才採用");
    attempts.push(structuredClone(candidate));
    candidate.inventory.gold = -1; // Persistence helpers may mutate even on failure.
    if (!succeeds) throw new Error("quota");
    candidate.inventory.gold = 30;
    return true;
  } });
  const transactions = createSaveTransactions({ saveStore: store, pendingView: {
    show(options) { retry = options.retry; }, hide() {}
  } });
  const result = transactions.commitSaveChange(draft => {
    computations++;
    leakedDraft = draft;
    draft.inventory.gold -= 10;
    draft.inventory.materials.iron -= 2;
    draft.statistics.crafts++;
  }, () => { completions++; });
  assert.equal(result.status, "pending");
  assert.deepEqual(store.current, makeSave());
  leakedDraft.inventory.gold = 999;
  assert.equal(store.persist(), false);
  assert.throws(() => store.replace(makeSave()), /待保存交易/);
  assert.equal(transactions.commitSaveChange(() => { throw new Error("must not run"); }).status, "blocked");
  assert.equal(retry().status, "pending");
  assert.equal(completions, 0);
  succeeds = true;
  assert.equal(retry().status, "saved");
  assert.equal(computations, 1);
  assert.equal(completions, 1);
  assert.equal(store.current.inventory.gold, 30);
  assert.equal(store.current.statistics.crafts, 1);
  assert.deepEqual(attempts[0], attempts[1]);
  assert.deepEqual(attempts[1], attempts[2]);
  assert.equal(retry().status, "idle");
  assert.equal(completions, 1);
}
{
  let writes = 0;
  const store = createSaveStore({ initialSave: makeSave(), persistSave: () => { writes++; return false; } });
  assert.throws(() => store.transact(draft => { draft.inventory.gold = 0; throw new Error("invalid recipe"); }), /invalid recipe/);
  assert.equal(store.current.inventory.gold, 40);
  assert.equal(store.hasPendingTransaction, false);
  assert.throws(() => store.transact(() => Promise.resolve()), /同步/);
  assert.throws(() => store.transact(() => store.transact(() => {})), /共用候選資料/);
  assert.equal(writes, 0);
  assert.equal(store.transact(draft => { draft.inventory.gold = 30; }).status, "pending");
  store.current.statistics.crafts = 5;
  assert.equal(store.retryPending().status, "conflict");
  assert.equal(writes, 1, "舊候選不可覆蓋後來被舊流程改動的正式狀態");
}
{
  const store = createSaveStore({ initialSave: makeSave(), persistSave: () => true });
  let hides = 0;
  const tx = createSaveTransactions({ saveStore: store, pendingView: { show() { assert.fail(); }, hide() { hides++; } } });
  assert.throws(() => tx.commitSaveChange(draft => { draft.inventory.gold = 35; }, () => { throw new Error("render failed"); }), /render failed/);
  assert.equal(store.current.inventory.gold, 35);
  assert.equal(store.hasPendingTransaction, false, "成功通知失敗不可將已保存交易重新排入");
  assert.equal(store.retryPending().status, "idle");
  assert.equal(hides, 1);
}
console.log("Save transaction candidate isolation, retry, conflicts, validation, and completion tests passed.");
