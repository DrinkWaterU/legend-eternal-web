import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const [game, html, dom, layoutCss, responsiveCss, combatCss, combatView, editorSource, version, config, readme, styleIndex] = await Promise.all([
  readFile(new URL("../game.js", import.meta.url), "utf8"),
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../src/ui/dom.js", import.meta.url), "utf8"),
  readFile(new URL("../src/styles/layout.css", import.meta.url), "utf8"),
  readFile(new URL("../src/styles/responsive.css", import.meta.url), "utf8"),
  readFile(new URL("../src/styles/combat.css", import.meta.url), "utf8"),
  readFile(new URL("../src/ui/combatView.js", import.meta.url), "utf8"),
  readFile(new URL("./content-editor.js", import.meta.url), "utf8"),
  readFile(new URL("../VERSION", import.meta.url), "utf8"),
  readFile(new URL("../src/config.js", import.meta.url), "utf8"),
  readFile(new URL("../README.md", import.meta.url), "utf8"),
  readFile(new URL("../styles.css", import.meta.url), "utf8")
]);

assert.equal(version.trim(), "v0.2.4.0-alpha");
assert.match(config, /GAME_VERSION = "v0\.2\.4\.0-alpha"/);
assert.match(readme, /v0\.2\.4\.0-alpha/);
assert.match(readme, /python tools\/dev-server\.py/);
assert.match(html, /styles\.css\?v=0\.2\.4\.0-alpha/);
assert.match(html, /game\.js\?v=0\.2\.4\.0-alpha/);
const styleCacheVersions = [...styleIndex.matchAll(/\?v=([^"\)]+)/g)].map((match) => match[1]);
assert.equal(styleCacheVersions.length, 6, "styles.css 應維持 6 個內部樣式 import");
assert.deepEqual([...new Set(styleCacheVersions)], ["0.2.4.0-alpha"], "所有內部 CSS cache version 必須同步");
assert.match(editorSource, /DEFAULT_GAME_VERSION = "v0\.2\.4\.0-alpha"/);

assert.doesNotMatch(game, /campStartButton\.addEventListener\("click", startRun\)/);
assert.match(game, /campStartButton\.addEventListener\("click", \(\) => \{[\s\S]*showRegionDetail\(state\.selectedRegionId\)/);
assert.match(game, /startButton\.addEventListener\("click", startPlayerRun\)/);
assert.match(game, /if \(hasPendingThreat\("counterEscape"\)\)[\s\S]*state\.battleSource === "event"[\s\S]*state\.encounterIndex \+= 1[\s\S]*resolvePostEncounterRunPreparation\(\)/);
assert.match(game, /initializeRunRuntime\(\{ hero, preparation \}\)[\s\S]*startEncounter\(\)[\s\S]*spendGold\(saveData\.inventory, preparation\.cost\)[\s\S]*showScreen\("gameScreen"\)/);
assert.match(game, /function recordRunStarted\(\)[\s\S]*saveGameSafe\(\)/);
assert.match(game, /permanentMutationStarted = true[\s\S]*recordRunStarted\(\)[\s\S]*showScreen\("gameScreen"\)/);
assert.match(game, /restoreRunStartPermanentState\(permanentSnapshot\)/);
assert.match(game, /resetFailedPlayerRunStart\(\)[\s\S]*setNavigationContext\(navigationContextBeforeStart\)[\s\S]*showScreen\("regionScreen"\)/);
assert.match(game, /if \(uiState\.runStartLocked\) \{\s*return;\s*\}/);
assert.match(game, /runStarted = true/);
assert.match(game, /state\.runPreparation = null;[\s\S]*function returnToCamp\(\)/);
assert.match(game, /modifyPoisonDamage: \(\{ damage \}\) => modifyPoisonDamageFromPreparation\(damage\)/);
assert.match(game, /preparationName = state\.runPreparation\?\.name \|\| "冒險整備"/);
assert.doesNotMatch(game, /整備｜驅蟲藥粉|整備｜簡易繃帶/, "game coordinator 不應寫死個別整備名稱");
assert.match(game, /preparation: state\.runPreparation/);
assert.match(game, /facility\.id !== "traveling-merchant" \|\| hasPhoenixBlessing\(\)/);
assert.match(game, /els\.campPlacesButton\.hidden = facilities\.length === 0/);
assert.match(game, /function showFacilityList\(safeAreaId = uiState\.safeAreaId, contextId = uiState\.navigationContext\)/);
assert.match(game, /getCurrentSafeArea\(\)\?\.placesTitle \|\| "安全區去處"/);
assert.match(game, /facilityBackButton\.addEventListener\("click", \(\) => showScreen\(getNavigationReturnTarget\(\)\)\)/);
assert.match(game, /merchantBackButton\.addEventListener\("click", \(\) => showFacilityList\(uiState\.safeAreaId, uiState\.navigationContext\)\)/);
const routeEntry = game.match(/function enterAdventureRoute\([\s\S]*?\n}\n/)?.[0] || "";
assert.doesNotMatch(routeEntry, /runPreparation\s*=\s*null/, "Route 切換不可清除整備 runtime");
const campRenderer = game.match(/function renderCampScreen\(\) \{[\s\S]*?\r?\n\}/)?.[0] || "";
for (const label of ["目前角色", "目前地區", "經驗", "目前金幣"]) {
  assert.match(campRenderer, new RegExp(label), `Camp 核心摘要缺少：${label}`);
}
assert.doesNotMatch(campRenderer, /地區難度/, "Camp 核心摘要不應退回舊版長清單");

assert.match(html, /id="facilityScreen"/);
assert.match(html, /id="facilityListView"/);
assert.match(html, /id="merchantView"/);
assert.match(html, /id="regionPreparationSection"/);
assert.match(html, /id="regionStartNotice"/);
assert.match(html, /id="combatPreparationStatus"/);
assert.match(html, /id="combatPreparationName"/);
assert.match(html, /id="combatPreparationCharges"/);
assert.match(html, /id="merchantSalePanel"/);
assert.match(html, />四處看看</);
assert.match(html, />營地去處</);
assert.match(layoutCss, /\.camp-feature-grid[\s\S]*grid-template-columns: repeat\(2/);
assert.match(layoutCss, /\.camp-status\s*\{[\s\S]*grid-template-columns: repeat\(2/);
assert.doesNotMatch(responsiveCss, /\.camp-feature-grid\s*\{[\s\S]*grid-template-columns:\s*1fr/, "手機版不可把營地功能格退回單欄");
assert.doesNotMatch(layoutCss, /(?:^|\n)\.(?:primary|secondary|danger)-button(?:\s*[,:{])/m, "layout.css 不應以頂層 selector 覆寫全域 action button class");
assert.match(layoutCss, /\.camp-primary-action\s*\{/);
assert.match(combatCss, /\.combat-preparation-status\s*\{/);
assert.match(combatView, /renderPreparationStatus\(els, preparation\)/);
assert.match(combatView, /剩餘 \$\{remainingCharges\} 次/);
assert.match(combatView, /已耗盡/);

const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
const domIds = [...dom.matchAll(/document\.querySelector\("#([^"]+)"\)/g)].map((match) => match[1]);
const missingIds = domIds.filter((id) => !htmlIds.has(id));
assert.deepEqual(missingIds, [], `dom.js 不可引用不存在的 HTML id：${missingIds.join(", ")}`);

assert.doesNotMatch(editorSource.match(/if \(\["id"[\s\S]*?\.includes\(key\)\)/)?.[0] || "", /preparations/);
assert.match(editorSource, /Object\.assign\(gameRegion, clone\(meta\.extraFields \|\| \{\}\)\)/);

const instrumentedEditorSource = editorSource.replace(/\}\)\(\);\s*$/, `
  globalThis.__contentEditorTestHooks = { state, normalizeGameRegionData, buildGameRegionJson };
})();
`);
const editorContext = {
  document: { addEventListener() {} }
};
vm.runInNewContext(instrumentedEditorSource, editorContext, { filename: "content-editor.js" });
const editorHooks = editorContext.__contentEditorTestHooks;
assert.ok(editorHooks, "Content Editor test hooks 注入失敗");

const regionJsonSources = await Promise.all([
  readFile(new URL("../src/data/regions/plains.json", import.meta.url), "utf8"),
  readFile(new URL("../src/data/regions/forest.json", import.meta.url), "utf8")
]);
for (const source of regionJsonSources) {
  const region = JSON.parse(source);
  editorHooks.state.package = editorHooks.normalizeGameRegionData(JSON.parse(JSON.stringify(region)));
  const exported = JSON.parse(JSON.stringify(editorHooks.buildGameRegionJson()));
  assert.deepEqual(exported.preparations, region.preparations, `${region.id} preparations 必須完整 roundtrip`);
  for (const extraField of ["audio", "visual", "events", "scaling", "recommendedLevel", "note", "clearStory"]) {
    if (extraField in region) {
      assert.deepEqual(exported[extraField], region[extraField], `${region.id}.${extraField} 必須完整 roundtrip`);
    }
  }
}

console.log("v0.2.4.0 A-stage source and Content Editor roundtrip assertions passed.");
