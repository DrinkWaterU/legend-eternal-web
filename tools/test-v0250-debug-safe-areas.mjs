import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const normalizeNewlines = (source) => source.replace(/\r\n?/g, "\n");

const root = new URL("../", import.meta.url);
const [debugPanel, runtimeActions, game] = (await Promise.all([
  Promise.all([
    "src/ui/debugPanel.js",
    "src/ui/debugPanelMarkup.js",
    "src/ui/debugPanelActions.js"
  ].map((path) => readFile(new URL(path, root), "utf8"))).then((sources) => sources.join("\n")),
  Promise.all([
    "src/debug/runtimeActions.js",
    "src/debug/safeAreaActions.js"
  ].map((path) => readFile(new URL(path, root), "utf8"))).then((sources) => sources.join("\n")),
  readFile(new URL("src/app/createApplication.js", root), "utf8")
])).map(normalizeNewlines);

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

assert.match(debugPanel, /function populateDebugSafeAreaOptions\(context\)/);
assert.match(debugPanel, /getSafeAreaOptions/);
assert.match(runtimeActions, /function prepareSafeArea\(safeAreaId\)/);
assert.match(runtimeActions, /function visitSafeArea\(safeAreaId\)/);
assert.match(runtimeActions, /function travelSafeArea\(safeAreaId\)/);
assert.match(runtimeActions, /function openSafeAreaTravel\(\)/);
assert.match(runtimeActions, /function resetSafeArea\(safeAreaId\)/);
assert.match(runtimeActions, /function playAnpingArrival\(\)/);
assert.match(runtimeActions, /showAnpingArrivalStory\(\{ source: "debug" \}\)/);
assert.match(runtimeActions, /getSafeAreaOptions/);
assert.match(runtimeActions, /openSafeAreaTravel/);
assert.match(game, /returnToSafeArea: adventure\.returnToSafeArea[\s\S]*showAnpingArrivalStory: adventure\.showAnpingArrivalStory[\s\S]*showSafeAreaTravelScreen: world\.showSafeAreaTravelScreen[\s\S]*syncSafeAreaUiFromSave: world\.syncSafeAreaUiFromSave/);

console.log("v0.2.5.0 safe area debug controls tests passed.");
