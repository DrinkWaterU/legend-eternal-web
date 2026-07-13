import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

import { ambientAudioDefinitions } from "../src/data/ambientAudio.js";
import { musicDefinitions } from "../src/data/music.js";
import { getSafeAreaDefinition } from "../src/data/safeAreas.js";

const root = new URL("../", import.meta.url);
const [html, game, dom, baseCss, layoutCss, screensCss, responsiveCss] = await Promise.all([
  readFile(new URL("index.html", root), "utf8"),
  readFile(new URL("game.js", root), "utf8"),
  readFile(new URL("src/ui/dom.js", root), "utf8"),
  readFile(new URL("src/styles/base.css", root), "utf8"),
  readFile(new URL("src/styles/layout.css", root), "utf8"),
  readFile(new URL("src/styles/screens.css", root), "utf8"),
  readFile(new URL("src/styles/responsive.css", root), "utf8")
]);


function findMatchingSectionEnd(source, startIndex) {
  const tagPattern = /<section\b|<\/section>/g;
  tagPattern.lastIndex = startIndex;
  let depth = 0;
  let match;
  while ((match = tagPattern.exec(source))) {
    if (match[0].startsWith("<section")) {
      depth += 1;
    } else {
      depth -= 1;
      if (depth === 0) {
        return tagPattern.lastIndex;
      }
    }
  }
  throw new Error("找不到 section 結尾");
}

const gameScreenStart = html.indexOf('<section id="gameScreen"');
const gameScreenEnd = findMatchingSectionEnd(html, gameScreenStart);
const arrivalPanelStart = html.indexOf('<section id="anpingArrivalPanel"');
assert.ok(arrivalPanelStart > gameScreenEnd, "安平鎮抵達面板必須位於 gameScreen 外，舊玩家才能從營地開啟");

for (const id of [
  "campEyebrow",
  "campTitle",
  "campDescription",
  "campTravelButton",
  "campTravelHint",
  "campTravelBadge",
  "safeAreaTravelScreen",
  "safeAreaTravelBackButton",
  "safeAreaTravelCurrentName",
  "safeAreaTravelList",
  "safeAreaTravelEmpty",
  "safeAreaTravelUnknownHint",
  "anpingArrivalPanel",
  "anpingArrivalDialog",
  "anpingArrivalText",
  "revealAnpingArrivalButton",
  "continueAnpingArrivalButton"
]) {
  assert.match(html, new RegExp(`id="${id}"`), `HTML 缺少 ${id}`);
  assert.match(dom, new RegExp(`#${id}`), `dom.js 缺少 ${id}`);
}

const imagePaths = [
  "assets/images/anping-town/anping-town-desktop.jpg",
  "assets/images/anping-town/anping-town-mobile.jpg",
  "assets/images/anping-town/arrival/anping-arrival-background-desktop.jpg",
  "assets/images/anping-town/arrival/anping-arrival-background-mobile.jpg",
  "assets/images/anping-town/arrival/anping-arrival-scene-desktop.jpg",
  "assets/images/anping-town/arrival/anping-arrival-scene-mobile.jpg"
];
await Promise.all(imagePaths.map((path) => access(new URL(path, root))));
imagePaths.forEach((path) => assert.match(html + game + JSON.stringify(getSafeAreaDefinition("anping-town")), new RegExp(path.replaceAll("/", "\\/"))));
assert.doesNotMatch(html + game, /chroma|foreground-desktop|town-desktop\.png/);

assert.equal(musicDefinitions["anping-town"].src, "assets/audio/bgm/anping-town.mp3");
assert.equal(ambientAudioDefinitions["anping-coast"].src, "assets/audio/ambient/anping-coast.mp3");
assert.equal(ambientAudioDefinitions["anping-coast"].gain, 0.25);

assert.match(game, /function showAnpingArrivalStory\(options = \{\}\)/);
assert.match(game, /function completeAnpingArrivalStory\(\)[\s\S]*saveGameSafe\(\)[\s\S]*returnToSafeArea\(ANPING_TOWN_SAFE_AREA_ID\)/);
assert.match(game, /function handleSafeAreaTravel\(targetId\)[\s\S]*showAnpingArrivalStory/);
assert.match(game, /function resolveSceneAmbientTrackId\(screenId\)/);
assert.match(game, /trackDefinitions: ambientAudioDefinitions,[\s\S]*trackLabel: "環境音"/);
assert.match(game, /ambientManager\.requestTrack\("anping-coast"\)/);
assert.match(game, /musicManager\.requestTrack\("anping-town"\)/);
assert.match(game, /els\.retryButton\.textContent = state\.pendingAnpingArrival[\s\S]*"繼續前行"/);
assert.match(game, /function renderMenuScreen\(\)[\s\S]*進入\$\{getCurrentSafeArea\(\)\?\.name/);
assert.match(game, /function shouldOfferAnpingArrivalAfterRun\(outcome\)[\s\S]*!state\.debugBuildRun/);
assert.match(game, /function returnToRunOriginSafeArea\(\)/);
assert.match(game, /state\.runOriginSafeAreaId = runOriginSafeAreaId/);

assert.match(baseCss, /--safe-area-bg-mobile/);
assert.match(responsiveCss, /--safe-area-bg-desktop/);
assert.match(layoutCss, /camp-travel-button\[data-new-location="true"\]/);
assert.match(layoutCss, /safe-area-travel-card\[data-new-location="true"\]/);
assert.match(layoutCss, /body\[data-safe-area="anping-town"\] \.camp-copy h2/);
assert.match(responsiveCss, /safe-area-travel-grid[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(game, /function renderCampTravelButton\(safeArea = getCurrentSafeArea\(\)\)/);
assert.match(game, /function renderSafeAreaTravelScreen\(\)/);
assert.match(game, /getSafeAreaDefinitions\(\)\.filter\(\(destination\) =>/);
assert.match(game, /button\.dataset\.safeAreaId = destination\.id/);
assert.match(html, /id="campTravelButton"[\s\S]*id="safeAreaTravelScreen"[\s\S]*id="safeAreaTravelList"/);
assert.doesNotMatch(html + game + dom, /campTravelSection|campTravelList|handleCampTravel/);
assert.match(screensCss, /anping-arrival-dialog\[data-stage="town"\][\s\S]*anping-arrival-scene-picture/);
assert.match(screensCss, /prefers-reduced-motion: reduce/);

console.log("v0.2.5.0 Anping Town UI, assets, audio, and flow tests passed.");
