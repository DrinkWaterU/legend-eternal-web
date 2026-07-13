import assert from "node:assert/strict";

import {
  clearPreparationSelectionState,
  consumePreparationEnhancementReveal,
  normalizePreparationUiState
} from "../src/ui/preparationState.js";
import { plainsRegion } from "../src/data/regions/plains.js";

function createUiState(overrides = {}) {
  return {
    selectedPreparationId: "simple-bandage",
    enhancedPreparationId: "simple-bandage",
    preparationEnhancementRevealId: "simple-bandage",
    preparationDetailId: "simple-bandage",
    preparationDetailExpanded: true,
    runStartNotice: "保留提示",
    runStartLocked: true,
    unrelatedState: { keep: true },
    ...overrides
  };
}

{
  const state = createUiState();
  const unrelated = state.unrelatedState;
  const result = clearPreparationSelectionState(state);
  assert.equal(result, state);
  assert.deepEqual({
    selectedPreparationId: state.selectedPreparationId,
    enhancedPreparationId: state.enhancedPreparationId,
    preparationEnhancementRevealId: state.preparationEnhancementRevealId,
    preparationDetailId: state.preparationDetailId,
    preparationDetailExpanded: state.preparationDetailExpanded
  }, {
    selectedPreparationId: null,
    enhancedPreparationId: null,
    preparationEnhancementRevealId: null,
    preparationDetailId: null,
    preparationDetailExpanded: false
  });
  assert.equal(state.runStartNotice, "保留提示", "Selection helper 不得清除出發提示");
  assert.equal(state.runStartLocked, true, "Selection helper 不得解除出發鎖定");
  assert.equal(state.unrelatedState, unrelated, "未知 UI State 不得被改動");
}

{
  const state = createUiState();
  normalizePreparationUiState({
    uiState: state,
    region: plainsRegion,
    gold: 999,
    enabled: false
  });
  assert.equal(state.selectedPreparationId, null);
  assert.equal(state.enhancedPreparationId, null);
  assert.equal(state.preparationEnhancementRevealId, null);
  assert.equal(state.preparationDetailId, null);
  assert.equal(state.preparationDetailExpanded, false);
}

{
  const state = createUiState({
    selectedPreparationId: "missing-preparation",
    enhancedPreparationId: "missing-preparation",
    preparationEnhancementRevealId: "missing-preparation",
    preparationDetailId: "simple-bandage"
  });
  normalizePreparationUiState({ uiState: state, region: plainsRegion, gold: 999 });
  assert.equal(state.selectedPreparationId, null);
  assert.equal(state.enhancedPreparationId, null);
  assert.equal(state.preparationEnhancementRevealId, null);
  assert.equal(state.preparationDetailId, "simple-bandage", "有效詳情預覽必須保留");
  assert.equal(state.preparationDetailExpanded, true);
}

{
  const state = createUiState({
    preparationDetailId: "beast-repellent-herb"
  });
  normalizePreparationUiState({ uiState: state, region: plainsRegion, gold: 0 });
  assert.equal(state.selectedPreparationId, null, "無法負擔的正式整備必須取消");
  assert.equal(state.enhancedPreparationId, null);
  assert.equal(state.preparationEnhancementRevealId, null);
  assert.equal(state.preparationDetailId, "beast-repellent-herb", "金幣不足只影響正式選擇，不影響有效預覽");
  assert.equal(state.preparationDetailExpanded, true);
}

{
  const state = createUiState({
    preparationDetailId: "missing-preparation"
  });
  normalizePreparationUiState({ uiState: state, region: plainsRegion, gold: 999 });
  assert.equal(state.selectedPreparationId, "simple-bandage");
  assert.equal(state.enhancedPreparationId, "simple-bandage");
  assert.equal(state.preparationDetailId, null);
  assert.equal(state.preparationDetailExpanded, false);
}

{
  const state = createUiState({
    preparationDetailId: "beast-repellent-herb"
  });
  const before = structuredClone(state);
  normalizePreparationUiState({ uiState: state, region: plainsRegion, gold: 999 });
  assert.deepEqual(state, before, "預覽 B 不得清除正式選擇 A 或 A 的強化狀態");
}

{
  const region = {
    id: "synthetic",
    preparations: [
      { id: "plain-preparation", cost: 1, enhancement: null }
    ]
  };
  const state = createUiState({
    selectedPreparationId: "plain-preparation",
    enhancedPreparationId: "plain-preparation",
    preparationEnhancementRevealId: "plain-preparation",
    preparationDetailId: "plain-preparation"
  });
  normalizePreparationUiState({ uiState: state, region, gold: 10 });
  assert.equal(state.selectedPreparationId, "plain-preparation");
  assert.equal(state.enhancedPreparationId, null, "沒有 enhancement 的整備不得維持錯誤強化狀態");
  assert.equal(state.preparationEnhancementRevealId, null);
}

{
  const state = createUiState({
    preparationEnhancementRevealId: "weapon-maintenance"
  });
  normalizePreparationUiState({ uiState: state, region: plainsRegion, gold: 999 });
  assert.equal(state.enhancedPreparationId, "simple-bandage");
  assert.equal(state.preparationEnhancementRevealId, null, "動畫 Token 必須與目前強化整備一致");
}

{
  const state = createUiState({ preparationDetailId: "beast-repellent-herb" });
  const regionBefore = structuredClone(plainsRegion);
  const result = normalizePreparationUiState({ uiState: state, region: plainsRegion, gold: 999 });
  assert.equal(result, state);
  assert.deepEqual(plainsRegion, regionBefore, "正規化不得修改 Region Definition");
  assert.equal(state.runStartNotice, "保留提示");
  assert.equal(state.runStartLocked, true);
}

{
  const state = createUiState({
    preparationEnhancementRevealId: "simple-bandage"
  });
  assert.equal(consumePreparationEnhancementReveal(state, "weapon-maintenance"), false);
  assert.equal(state.preparationEnhancementRevealId, "simple-bandage", "不相符 ID 不得消耗動畫 Token");
  assert.equal(consumePreparationEnhancementReveal(state, "simple-bandage"), true);
  assert.equal(state.preparationEnhancementRevealId, null);
  assert.equal(consumePreparationEnhancementReveal(state, "simple-bandage"), false, "動畫 Token 只能消耗一次");
}

assert.throws(
  () => clearPreparationSelectionState(null),
  /需要可修改的物件/,
  "無效 UI State 必須明確失敗"
);
assert.throws(
  () => normalizePreparationUiState({ uiState: null, region: plainsRegion, gold: 10 }),
  /需要可修改的物件/
);
assert.throws(
  () => consumePreparationEnhancementReveal(null, "simple-bandage"),
  /需要可修改的物件/
);

console.log("Preparation state tests passed.");
