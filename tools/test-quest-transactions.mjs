import assert from "node:assert/strict";
import { createDefaultSave } from "../src/core/saveDefaults.js";
import { questDefinitions } from "../src/data/quests.js";
import { materialDefinitions } from "../src/data/materials.js";
import { createQuestRuntime } from "../src/features/quest/questRuntime.js";
import { createTestTransactions } from "./save-transaction-test-helper.mjs";

function fixture(save = createDefaultSave()) {
  let succeeds = false;
  let draws = 0;
  const attempts = [];
  const tx = createTestTransactions(save, candidate => {
    attempts.push(structuredClone(candidate));
    return succeeds;
  });
  const runtime = createQuestRuntime({ saveStore: tx.saveStore, questDefinitions, materialDefinitions,
    random: () => { draws++; return .37; }, commitSaveChange: tx.commitSaveChange });
  return { tx, runtime, attempts, draws: () => draws, succeed: () => { succeeds = true; } };
}
{
  const f = fixture();
  const original = structuredClone(f.tx.saveStore.current);
  f.runtime.getSnapshot();
  assert.deepEqual(f.tx.saveStore.current, original);
  assert.equal(f.draws(), 0, "讀取摘要不可抽看板或保存");
  let completions = 0;
  f.runtime.ensureBoard({ onSaved: () => completions++ });
  assert.deepEqual(f.tx.saveStore.current, original);
  const draws = f.draws();
  assert(draws > 0);
  f.runtime.getSnapshot();
  f.runtime.ensureBoard();
  f.tx.retry();
  assert.equal(f.draws(), draws);
  assert.equal(completions, 0);
  f.succeed();
  f.tx.retry();
  assert.equal(completions, 1);
  assert.equal(f.tx.saveStore.current.quests.board.questIds.length, 4);
  assert.deepEqual(f.attempts[0].quests.board, f.attempts[2].quests.board);
}
{
  const save = createDefaultSave();
  save.quests.active = { questId: "plains-boss-trophy", progress: 0, acceptedAtCompletionCount: 0 };
  save.inventory.materials.tainted_tusk = { quantity: 3 };
  const f = fixture(save);
  const original = structuredClone(save);
  let completed = 0;
  assert.equal(f.runtime.reportQuest(() => completed++).pending, true);
  const draws = f.draws();
  f.runtime.reportQuest(() => assert.fail("second completion"));
  f.tx.retry();
  assert.deepEqual(f.tx.saveStore.current, original);
  assert.equal(completed, 0);
  f.succeed();
  f.tx.retry();
  assert.equal(f.draws(), draws);
  assert.equal(completed, 1);
  const current = f.tx.saveStore.current;
  assert.equal(current.inventory.gold, 55);
  assert.equal(current.inventory.materials.tainted_tusk, undefined);
  assert.equal(current.quests.statistics.completedTotal, 1);
  assert.equal(current.quests.completions['plains-boss-trophy'].count, 1);
  assert.equal(current.quests.active, null);
  assert.equal(current.quests.board.questIds.includes('plains-boss-trophy'), false);
  assert.deepEqual(f.attempts[0], f.attempts[2]);
  assert.equal(f.runtime.reportQuest().ok, false);
  assert.equal(f.attempts.length, 3);
}
for (const action of ['accept', 'abandon']) {
  const save = createDefaultSave();
  save.quests.board.questIds = ['broad-monster-control', 'route-patrol', 'elite-suppression', 'forest-insect-control'];
  if (action === 'abandon') save.quests.active = { questId: 'broad-monster-control', progress: 4, acceptedAtCompletionCount: 0 };
  const f = fixture(save);
  let completed = 0;
  const result = action === 'accept' ? f.runtime.acceptQuest('broad-monster-control', () => completed++) : f.runtime.abandonQuest(() => completed++);
  assert.equal(result.pending, true);
  f.tx.retry();
  assert.equal(completed, 0);
  f.succeed(); f.tx.retry();
  assert.equal(completed, 1);
  assert.deepEqual(f.tx.saveStore.current.quests.board.questIds, save.quests.board.questIds);
  assert.equal(f.tx.saveStore.current.quests.statistics.abandonedTotal, action === 'abandon' ? 1 : 0);
  assert.equal(Boolean(f.tx.saveStore.current.quests.active), action === 'accept');
}
console.log('Quest candidate board, report/reward, accept/abandon retry and read-only snapshot tests passed.');
