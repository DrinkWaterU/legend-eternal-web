import assert from "node:assert/strict";
import { installTestDocument, createElementMap } from "./dom-test-stub.mjs";
import { renderAchievementView, renderAchievementUnlockToast } from "../src/ui/achievementView.js";

installTestDocument();
const els = createElementMap([
  "achievementLockedState", "achievementBrowser", "achievementTitle", "achievementText",
  "achievementSummary", "achievementVisibleCount", "achievementUnlockedCount", "achievementFilters",
  "achievementList", "achievementEmpty", "achievementDetail", "achievementDetailPanel",
  "achievementDetailBackdrop", "achievementUnlockToast", "achievementUnlockToastTitle",
  "achievementUnlockToastCondition"
]);
const definitions = Object.fromEntries(Array.from({ length: 30 }, (_, index) => {
  const id = `achievement_${index}`;
  return [id, {
    id,
    title: `成就 ${index + 1}`,
    conditionText: `完成條件 ${index + 1}`,
    description: `旅程紀錄 ${index + 1}`,
    category: index % 2 === 0 ? "region" : "route",
    regionId: "forest",
    order: index + 1,
    hiddenUntilUnlocked: index === 29
  }];
}));
const achievementState = Object.fromEntries(Object.keys(definitions).map((id, index) => [id, {
  unlocked: index < 5,
  unlockedAt: index < 5 ? "2026-07-01T10:00:00.000Z" : null
}]));
let selected = null;
const result = renderAchievementView({
  els,
  definitions,
  achievementState,
  systemUnlocked: true,
  newAchievementIds: new Set(["achievement_0"]),
  regionDefinitions: { forest: { name: "森林" } },
  onAchievementSelect: (id) => { selected = id; }
});
assert.equal(result.visibleCount, 29, "隱藏未解鎖成就不得計入 30 項可見數量");
assert.equal(els.achievementList.children.length, 29);
assert.equal(els.achievementUnlockedCount.textContent, "5 已解鎖");
assert.equal(els.achievementList.children[0].classList.contains("is-new"), true);
els.achievementList.children[0].listeners.get("click")();
assert.equal(selected, "achievement_0");
achievementState.achievement_29.unlocked = true;
const unlockedResult = renderAchievementView({ els, definitions, achievementState, systemUnlocked: true, regionDefinitions: { forest: { name: "森林" } } });
assert.equal(unlockedResult.visibleCount, 30);
renderAchievementUnlockToast({ els, definition: definitions.achievement_0 });
assert.equal(els.achievementUnlockToast.hidden, false);
assert.equal(els.achievementUnlockToastTitle.textContent, "成就 1");
renderAchievementUnlockToast({ els, definition: null });
assert.equal(els.achievementUnlockToast.hidden, true);
console.log("v0.2.5.2 achievement visibility, 30-item scale, New state, and toast rendering tests passed.");
