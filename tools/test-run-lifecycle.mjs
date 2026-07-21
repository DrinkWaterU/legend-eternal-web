import assert from "node:assert/strict";

import { resetAdventureRunState } from "../src/adventure/runLifecycle.js";

function createDirtyState() {
  return {
    run: 12,
    selectedRegionId: "forest",
    selectedHeroId: "archer",
    lastRunSummary: { result: "victory" },
    encounterIndex: 9,
    turn: 4,
    hero: { id: "hero" },
    selectedBoss: { id: "boss" },
    phase: "danger",
    awaitingBlessing: true,
    ended: false,
    defeatedEnemies: 8,
    defeatedBoss: true,
    deathCause: { type: "enemy" },
    runStats: { rewards: {} },
    runPreparation: { id: "forest-bandage" },
    canRest: true,
    hasRested: true,
    ambushAdvantage: true,
    blessingContext: "event",
    blessingInputLocked: true,
    battleSource: "event",
    battleEncounterType: "boss",
    debugBuildRun: true,
    runResultRecorded: true,
    log: [{ type: "system", text: "old" }],
    unrelatedRuntime: { keep: true }
  };
}

const expectedDefaults = {
  encounterIndex: 0,
  turn: 0,
  hero: null,
  selectedBoss: null,
  phase: "camp",
  awaitingBlessing: false,
  ended: true,
  defeatedEnemies: 0,
  defeatedBoss: false,
  deathCause: null,
  runStats: null,
  runPreparation: null,
  beachSegmentCompleted: false,
  coastSegmentCheckpoint: null,
  canRest: false,
  hasRested: false,
  ambushAdvantage: false,
  blessingContext: "normal",
  blessingInputLocked: false,
  battleSource: "main",
  battleEncounterType: null,
  debugBuildRun: false,
  runResultRecorded: false
};

{
  const state = createDirtyState();
  const previousSummary = state.lastRunSummary;
  const previousUnrelated = state.unrelatedRuntime;
  const result = resetAdventureRunState(state);

  assert.equal(result, state, "reset 應直接修改並回傳同一個 state");
  for (const [field, value] of Object.entries(expectedDefaults)) {
    assert.deepEqual(state[field], value, `Run State 欄位 ${field} 沒有回到預設值`);
  }
  assert.deepEqual(state.log, []);
  assert.equal(state.lastRunSummary, previousSummary, "預設必須保留最近冒險摘要");
  assert.equal(state.run, 12, "重設 Run Runtime 不得改動 session run 計數");
  assert.equal(state.selectedRegionId, "forest");
  assert.equal(state.selectedHeroId, "archer");
  assert.equal(state.unrelatedRuntime, previousUnrelated, "未知或其他模組欄位不得被清除");
}

{
  const state = createDirtyState();
  resetAdventureRunState(state, { clearLastRunSummary: true });
  assert.equal(state.lastRunSummary, null, "匯入或刪除存檔時必須能清除最近冒險摘要");
}

{
  const state = createDirtyState();
  resetAdventureRunState(state);
  const firstLog = state.log;
  state.log.push({ text: "new" });
  resetAdventureRunState(state);
  assert.notEqual(state.log, firstLog, "每次重設都必須建立新的戰鬥紀錄陣列");
  assert.deepEqual(state.log, []);
}

assert.throws(
  () => resetAdventureRunState(null),
  /需要可修改的 state 物件/,
  "無效 state 必須明確失敗"
);

console.log("Run lifecycle tests passed.");
