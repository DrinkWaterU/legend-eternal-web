import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const [debugPanel, runtimeActions, game] = await Promise.all([
  readFile(new URL("src/ui/debugPanel.js", root), "utf8"),
  readFile(new URL("src/debug/runtimeActions.js", root), "utf8"),
  readFile(new URL("game.js", root), "utf8")
]);

for (const action of [
  "prepare-safe-area",
  "visit-safe-area",
  "travel-safe-area",
  "open-safe-area-travel",
  "reset-safe-area",
  "play-anping-arrival"
]) {
  assert.match(debugPanel, new RegExp(`data-action="${action}"`));
}

assert.match(debugPanel, /function populateSafeAreaOptions\(context\)/);
assert.match(debugPanel, /getSafeAreaOptions/);
assert.match(runtimeActions, /function prepareDebugSafeArea\(safeAreaId\)/);
assert.match(runtimeActions, /function visitDebugSafeArea\(safeAreaId\)/);
assert.match(runtimeActions, /function travelDebugSafeArea\(safeAreaId\)/);
assert.match(runtimeActions, /function openDebugSafeAreaTravel\(\)/);
assert.match(runtimeActions, /function resetDebugSafeArea\(safeAreaId\)/);
assert.match(runtimeActions, /function playDebugAnpingArrival\(\)/);
assert.match(runtimeActions, /showAnpingArrivalStory\(\{ source: "debug" \}\)/);
assert.match(runtimeActions, /getSafeAreaOptions: getDebugSafeAreaOptions/);
assert.match(runtimeActions, /openSafeAreaTravel: openDebugSafeAreaTravel/);
assert.match(game, /returnToSafeArea,\n  showAnpingArrivalStory,\n  showSafeAreaTravelScreen,\n  syncSafeAreaUiFromSave/);

console.log("v0.2.5.0 safe area debug controls tests passed.");
