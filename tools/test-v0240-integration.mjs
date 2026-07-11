import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const [
  game,
  html,
  dom,
  layoutCss,
  componentsCss,
  responsiveCss,
  combatCss,
  combatView,
  preparationView,
  preparationStateSource,
  plainsAdapter,
  forestAdapter,
  editorSource,
  version,
  config,
  readme,
  styleIndex
] = await Promise.all([
  readFile(new URL("../game.js", import.meta.url), "utf8"),
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../src/ui/dom.js", import.meta.url), "utf8"),
  readFile(new URL("../src/styles/layout.css", import.meta.url), "utf8"),
  readFile(new URL("../src/styles/components.css", import.meta.url), "utf8"),
  readFile(new URL("../src/styles/responsive.css", import.meta.url), "utf8"),
  readFile(new URL("../src/styles/combat.css", import.meta.url), "utf8"),
  readFile(new URL("../src/ui/combatView.js", import.meta.url), "utf8"),
  readFile(new URL("../src/ui/preparationView.js", import.meta.url), "utf8"),
  readFile(new URL("../src/ui/preparationState.js", import.meta.url), "utf8"),
  readFile(new URL("../src/data/regions/plains.js", import.meta.url), "utf8"),
  readFile(new URL("../src/data/regions/forest.js", import.meta.url), "utf8"),
  readFile(new URL("./content-editor.js", import.meta.url), "utf8"),
  readFile(new URL("../VERSION", import.meta.url), "utf8"),
  readFile(new URL("../src/config.js", import.meta.url), "utf8"),
  readFile(new URL("../README.md", import.meta.url), "utf8"),
  readFile(new URL("../styles.css", import.meta.url), "utf8")
]);

const [eventRuntimeSource, debugRuntimeSource, runLifecycleSource, battleLifecycleSource] = await Promise.all([
  readFile(new URL("../src/adventure/eventRuntime.js", import.meta.url), "utf8"),
  readFile(new URL("../src/debug/runtimeActions.js", import.meta.url), "utf8"),
  readFile(new URL("../src/adventure/runLifecycle.js", import.meta.url), "utf8"),
  readFile(new URL("../src/adventure/battleLifecycle.js", import.meta.url), "utf8")
]);

assert.equal(version.trim(), "v0.2.4.2-alpha");
assert.match(config, /GAME_VERSION = "v0\.2\.4\.2-alpha"/);
assert.match(readme, /v0\.2\.4\.2-alpha/);
assert.match(readme, /python tools\/dev-server\.py/);
assert.match(html, /styles\.css\?v=0\.2\.4\.2-alpha/);
assert.match(html, /game\.js\?v=0\.2\.4\.2-alpha/);
const styleCacheVersions = [...styleIndex.matchAll(/\?v=([^"\)]+)/g)].map((match) => match[1]);
assert.equal(styleCacheVersions.length, 6, "styles.css 應維持 6 個內部樣式 import");
assert.deepEqual([...new Set(styleCacheVersions)], ["0.2.4.2-alpha"], "所有內部 CSS cache version 必須同步");
assert.match(editorSource, /DEFAULT_GAME_VERSION = "v0\.2\.4\.2-alpha"/);

assert.doesNotMatch(game, /campStartButton\.addEventListener\("click", startRun\)/);
assert.match(game, /campStartButton\.addEventListener\("click", \(\) => \{[\s\S]*showRegionDetail\(state\.selectedRegionId\)/);
assert.match(game, /startButton\.addEventListener\("click", startPlayerRun\)/);
assert.match(game, /requestedPreparationId = hasPhoenixBlessing\(\)\s*\? uiState\.selectedPreparationId\s*:\s*null/);
const startPlayerRunSource = game.match(/function startPlayerRun\(\) \{[\s\S]*?\n\}/)?.[0] || "";
assert.match(startPlayerRunSource, /getRegionPreparation\(region, requestedPreparationId\)/);
assert.match(startPlayerRunSource, /createRunPreparation\(region, requestedPreparationId,[\s\S]*enhanced: requestedEnhanced/);
assert.doesNotMatch(startPlayerRunSource, /preparationDetailId|preparationDetailExpanded/, "Run Start 不得讀 detail preview state");
assert.match(game, /if \(hasPendingThreat\("counterEscape"\)\)[\s\S]*state\.battleSource === "event"[\s\S]*state\.encounterIndex \+= 1[\s\S]*resolvePostEncounterRunPreparation\(\{ isFinalEncounter: adventureComplete \}\)/);
assert.match(game, /initializeRunRuntime\(\{ hero, preparation \}\)[\s\S]*startEncounter\(\)[\s\S]*spendInventoryCost\(\{[\s\S]*goldCost: preparation\.cost[\s\S]*showScreen\("gameScreen"\)/);
assert.match(game, /function recordRunStarted\(\)[\s\S]*saveGameSafe\(\)/);
assert.match(game, /permanentMutationStarted = true[\s\S]*recordRunStarted\(\)[\s\S]*showScreen\("gameScreen"\)/);
assert.match(game, /restoreRunStartPermanentState\(permanentSnapshot\)/);
assert.match(game, /resetFailedPlayerRunStart\(\)[\s\S]*setNavigationContext\(navigationContextBeforeStart\)[\s\S]*showScreen\("regionScreen"\)/);
assert.match(game, /if \(uiState\.runStartLocked\) \{\s*return;\s*\}/);
assert.match(game, /runStarted = true/);
assert.match(game, /preparationDetailId: null/);
assert.match(game, /preparationDetailExpanded: false/);
const resetPreparationUiSource = game.match(/function resetPreparationUiState\(\) \{[\s\S]*?\n\}/)?.[0] || "";
assert.match(resetPreparationUiSource, /clearPreparationSelectionState\(uiState\)/);
for (const field of ["runStartNotice", "runStartLocked"]) {
  assert.match(resetPreparationUiSource, new RegExp(`uiState\\.${field}`), `resetPreparationUiState 缺少 ${field}`);
}
assert.match(game, /import \{ clearPreparationSelectionState, consumePreparationEnhancementReveal, normalizePreparationUiState \} from "\.\/src\/ui\/preparationState\.js"/);
for (const exportedFunction of [
  "clearPreparationSelectionState",
  "normalizePreparationUiState",
  "consumePreparationEnhancementReveal"
]) {
  assert.match(preparationStateSource, new RegExp(`export function ${exportedFunction}\\(`));
}
const regionRenderer = game.match(/function renderRegionScreen\(\) \{[\s\S]*?\n\}\n\nfunction showCharacterList/)?.[0] || "";
for (const label of ["遭遇", "難度", "推薦等級", "首領"]) {
  assert.match(regionRenderer, new RegExp(`\\["${label}"`), `Region overview 缺少：${label}`);
}
assert.doesNotMatch(regionRenderer, /\["角色"/, "Region overview 不應再把角色當地區 metadata");
assert.match(regionRenderer, /regionDepartureCharacter\.textContent = `\$\{character\.name\} Lv\.\$\{progress\.level\}`/);
assert.match(regionRenderer, /regionDepartureGoldItem\.hidden = !phoenixUnlocked/);
assert.match(regionRenderer, /regionPreparationSection\.hidden = !phoenixUnlocked/);
assert.match(regionRenderer, /normalizePreparationUiState\(\{[\s\S]*uiState,[\s\S]*region,[\s\S]*gold: inventory\.gold,[\s\S]*enabled: phoenixUnlocked[\s\S]*\}\)/);
assert.doesNotMatch(regionRenderer, /uiState\.(?:selectedPreparationId|enhancedPreparationId|preparationDetailId)\s*=/, "Region renderer 不應直接正規化整備 UI State");
const selectPreparationSource = game.match(/function selectPreparation\(preparationId\) \{[\s\S]*?\n\}/)?.[0] || "";
assert.match(selectPreparationSource, /const affordable = !preparation \|\| inventory\.gold >= preparation\.cost/);
assert.match(selectPreparationSource, /if \(affordable\) \{[\s\S]*uiState\.selectedPreparationId = preparationId/);
assert.match(selectPreparationSource, /uiState\.preparationDetailId = preparationId/);
assert.match(selectPreparationSource, /sameDetail\s*\? !uiState\.preparationDetailExpanded\s*:\s*true/);
assert.match(game, /import \{ resetAdventureRunState \} from "\.\/src\/adventure\/runLifecycle\.js"/);
assert.match(runLifecycleSource, /export function resetAdventureRunState\(state, options = \{\}\)/);
assert.match(runLifecycleSource, /clearLastRunSummary = false/);
assert.match(runLifecycleSource, /state\.log = \[\]/);
const runRuntimeCoordinator = game.match(/function resetAdventureRunRuntime\(options = \{\}\) \{[\s\S]*?\n\}/)?.[0] || "";
for (const requiredCall of [
  "resetAdventureRunState(state, options)",
  "clearEnemyGroup()",
  "clearPendingThreat()",
  "eventRuntime.resetEventRunState()",
  "resetRouteRuntime()"
]) {
  assert.ok(runRuntimeCoordinator.includes(requiredCall), `Run Runtime coordinator 缺少：${requiredCall}`);
}
assert.match(game, /function initializeRunRuntime\([\s\S]*?resetAdventureRunRuntime\(\)/);
assert.match(game, /function resetFailedPlayerRunStart\(\) \{\s*resetAdventureRunRuntime\(\)/);
assert.match(game, /function resetAdventureRuntimeAfterSaveImport\(\) \{\s*resetAdventureRunRuntime\(\{ clearLastRunSummary: true \}\)/);
assert.match(game, /function deleteSave\(\)[\s\S]*?resetAdventureRunRuntime\(\{ clearLastRunSummary: true \}\)[\s\S]*?resetPreparationUiState\(\)/);
assert.match(game, /function restart\(\) \{\s*resetAdventureRunRuntime\(\)[\s\S]*?showScreen\("menuScreen"\)/);
assert.match(game, /function returnToCamp\(\) \{\s*resetAdventureRunRuntime\(\)[\s\S]*?showScreen\("campScreen"\)/);
assert.match(game, /modifyPoisonDamage: \(\{ damage \}\) => modifyPoisonDamageFromPreparation\(damage\)/);
assert.match(game, /modifyDirectDamage: modifyIncomingDirectDamage/);
assert.match(game, /runPreparationOpeningAction\(\{[\s\S]*encounterType: state\.battleEncounterType[\s\S]*finally|runPreparationOpeningAction\(\{/);
assert.match(game, /retryOnFailure: \(\) => consumeEntangleRetryFromPreparation\(log\)/);
assert.match(game, /beginRunPreparationBattle\(\)/);
assert.match(game, /preparationName = state\.runPreparation\?\.name \|\| "冒險整備"/);
assert.doesNotMatch(game, /整備｜驅蟲藥粉|整備｜簡易繃帶/, "game coordinator 不應寫死個別整備名稱");
assert.doesNotMatch(game, /firstFamilyDirectDamageReduction|openingActionAttackBonus|victoryMilestoneHeal|entangleRetry/, "game coordinator 不應解讀 B 階段 effect type");
assert.match(game, /preparation: state\.runPreparation/);
assert.match(game, /facility\.id !== "traveling-merchant" \|\| hasPhoenixBlessing\(\)/);
assert.match(game, /els\.campPlacesButton\.hidden = facilities\.length === 0/);
assert.match(game, /function showFacilityList\(safeAreaId = uiState\.safeAreaId, contextId = uiState\.navigationContext\)/);
assert.match(game, /getCurrentSafeArea\(\)\?\.placesTitle \|\| "安全區去處"/);
assert.match(game, /facilityBackButton\.addEventListener\("click", \(\) => showScreen\(getNavigationReturnTarget\(\)\)\)/);
assert.match(game, /merchantBackButton\.addEventListener\("click", \(\) => showFacilityList\(uiState\.safeAreaId, uiState\.navigationContext\)\)/);
const routeEntry = game.match(/function enterAdventureRoute\([\s\S]*?\n}\n/)?.[0] || "";
assert.doesNotMatch(routeEntry, /runPreparation\s*=\s*null/, "Route 切換不可清除整備 runtime");
const goblinRouteCompletion = game.match(/function completeGoblinCampRoute\(\) \{[\s\S]*?\n\}/)?.[0] || "";
assert.match(goblinRouteCompletion, /saveData\.storyFlags\.archerRescued \|\| archerProgress\?\.unlocked/, "重複通關判定必須同時相容故事旗標與角色解鎖狀態");
assert.match(goblinRouteCompletion, /endingKey = archerAlreadyRescued \? "repeatEnding" : "ending"/, "哥布林營地應依首次／重複通關選擇結尾");
assert.match(goblinRouteCompletion, /showRouteEnding\(route, \{ endingKey \}\)/);
const routeEndingCoordinator = game.match(/function showRouteEnding\([\s\S]*?\n\}/)?.[0] || "";
assert.match(routeEndingCoordinator, /route\?\.\[requestedEndingKey\]\?\.pages\?\.length \? requestedEndingKey : "ending"/, "Route Ending 應安全回退到首次 ending");
assert.match(routeEndingCoordinator, /routeEndingContext = \{ routeId: route\.id, endingKey, pageIndex: 0 \}/);
assert.match(game, /const endingKey = state\.routeEndingContext\?\.endingKey \|\| "ending";[\s\S]*return route\?\.\[endingKey\] \|\| route\?\.ending \|\| null;/);
assert.match(game, /import \{ resetBattleEntryState \} from "\.\/src\/adventure\/battleLifecycle\.js"/);
assert.match(battleLifecycleSource, /export function resetBattleEntryState\(state, options = \{\}\)/);
assert.match(battleLifecycleSource, /state\.log = \[\]/);
const battleRuntimeCoordinator = game.match(/function beginBattleRuntime\(options = \{\}\) \{[\s\S]*?\n\}/)?.[0] || "";
const battleRuntimeOrder = [
  "resetBattleEntryState(state, { source, encounterType, ambushAdvantage })",
  "setEnemyGroup(enemies, { restore: restoreEnemies })",
  "resetHeroBattleState()",
  "beginRunPreparationBattle()",
  "applyBattleStartSkills()"
].map((requiredCall) => {
  const index = battleRuntimeCoordinator.indexOf(requiredCall);
  assert.ok(index >= 0, `Battle Runtime coordinator 缺少：${requiredCall}`);
  return index;
});
assert.deepEqual(battleRuntimeOrder, [...battleRuntimeOrder].sort((a, b) => a - b), "Battle Runtime 初始化順序不可漂移");
assert.match(game, /function startEncounter\(\)[\s\S]*?beginBattleRuntime\(\{[\s\S]*?source: "main"[\s\S]*?encounterType/);
assert.match(game, /function resumePendingThreat\([\s\S]*?beginBattleRuntime\(\{[\s\S]*?restoreEnemies: true[\s\S]*?source: threat\.battleSource/);
assert.match(game, /function resolveCounterEscape\(\)[\s\S]*?beginBattleRuntime\(\{[\s\S]*?source: "counterEscape"[\s\S]*?encounterType: "counter"[\s\S]*?ambushAdvantage: true/);
const eventBattleSource = eventRuntimeSource.match(/function startEventBattle\([\s\S]*?\r?\n  }\r?\n/)?.[0] || "";
assert.match(eventBattleSource, /beginBattleRuntime\(\{[\s\S]*?source: "event"[\s\S]*?encounterType: "event"/, "Event Battle 必須走共同 Battle Runtime");
assert.doesNotMatch(eventRuntimeSource, /resetHeroBattleState|beginRunPreparationBattle|applyBattleStartSkills/, "Event Runtime 不應自行維護共通戰鬥初始化");
assert.match(debugRuntimeSource, /beginBattleRuntime\(\{[\s\S]*?encounterType: "normal"/);
assert.doesNotMatch(debugRuntimeSource, /resetHeroBattleState|beginRunPreparationBattle|applyBattleStartSkills/, "Debug Runtime 不應自行維護共通戰鬥初始化");
const campRenderer = game.match(/function renderCampScreen\(\) \{[\s\S]*?\r?\n\}/)?.[0] || "";
for (const label of ["目前角色", "目前地區", "經驗", "目前金幣"]) {
  assert.match(campRenderer, new RegExp(label), `Camp 核心摘要缺少：${label}`);
}
assert.doesNotMatch(campRenderer, /地區難度/, "Camp 核心摘要不應退回舊版長清單");

assert.match(html, /id="facilityScreen"/);
assert.match(html, /id="facilityListView"/);
assert.match(html, /id="merchantView"/);
assert.match(html, /id="regionPreparationSection"/);
assert.match(html, /id="regionTraits"/);
assert.match(html, /id="regionTraitList"/);
assert.match(html, /id="regionDepartureMeta"/);
assert.match(html, /id="regionDepartureCharacter"/);
assert.match(html, /id="regionDepartureGoldItem"/);
assert.match(html, /id="regionDepartureGold"/);
assert.match(html, /id="regionPreparationDetail"/);
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
assert.match(componentsCss, /\.region-detail-heading\s*\{/);
assert.match(componentsCss, /\.region-overview\s*\{[\s\S]*grid-template-columns: repeat\(4/);
assert.match(componentsCss, /\.preparation-list\s*\{[\s\S]*grid-template-columns: repeat\(2/);
assert.match(responsiveCss, /\.region-overview\s*\{[\s\S]*grid-template-columns: repeat\(2/);
assert.match(responsiveCss, /\.preparation-list\s*\{[\s\S]*grid-template-columns: 1fr/);
assert.match(componentsCss, /\.preparation-detail\s*\{[\s\S]*grid-template-rows: 0fr/);
assert.match(componentsCss, /\.preparation-detail\.is-open\s*\{[\s\S]*grid-template-rows: 1fr/);
assert.match(componentsCss, /grid-template-rows 220ms ease/);
assert.match(componentsCss, /prefers-reduced-motion: reduce/);
assert.doesNotMatch(componentsCss, /(?:^|\n)\.section-heading\s*\{/m, "Region Detail 不應在 components.css 覆寫全域 section-heading");
assert.doesNotMatch(componentsCss, /(?:^|\n)\.stat-list\s*\{/m, "Region Detail 不應在 components.css 覆寫全域 stat-list");
assert.match(preparationView, /summary/);
assert.match(preparationView, /renderPreparationDetail/);
assert.match(preparationView, /aria-controls", "regionPreparationDetail"/);
const appendPreparationOptionSource = preparationView.match(/function appendPreparationOption\([\s\S]*?\n\}/)?.[0] || "";
assert.doesNotMatch(appendPreparationOptionSource, /button\.disabled\s*=/, "金幣不足整備卡仍必須可點擊查看效果");
assert.doesNotMatch(preparationView, /setTimeout|requestAnimationFrame/, "整備展開動畫不需要 timer 或 RAF chain");
assert.match(combatCss, /\.combat-preparation-status\s*\{/);
assert.match(combatView, /renderPreparationStatus\(els, preparationStatus\)/);
assert.match(combatView, /preparationStatus\.label/);
assert.doesNotMatch(combatView, /remainingCharges|effect\?\.type|firstFamilyDirectDamageReduction|openingActionAttackBonus/, "Combat View 不應解讀整備 effect runtime");

const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
const domIds = [...dom.matchAll(/document\.querySelector\("#([^"]+)"\)/g)].map((match) => match[1]);
const missingIds = domIds.filter((id) => !htmlIds.has(id));
assert.deepEqual(missingIds, [], `dom.js 不可引用不存在的 HTML id：${missingIds.join(", ")}`);

assert.doesNotMatch(editorSource.match(/if \(\["id"[\s\S]*?\.includes\(key\)\)/)?.[0] || "", /preparations/);
assert.match(editorSource, /Object\.assign\(gameRegion, clone\(meta\.extraFields \|\| \{\}\)\)/);
assert.match(plainsAdapter, /createRegionDefinition\(plainsData\)/);
assert.match(forestAdapter, /createRegionDefinition\(forestData\)/);

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
  for (const extraField of ["audio", "visual", "events", "scaling", "recommendedLevel", "note", "clearStory", "traits"]) {
    if (extraField in region) {
      assert.deepEqual(exported[extraField], region[extraField], `${region.id}.${extraField} 必須完整 roundtrip`);
    }
  }
}

const [plainsSource, forestSource] = regionJsonSources.map((source) => JSON.parse(source));
assert.equal(plainsSource.preparations.length, 3);
assert.equal(forestSource.preparations.length, 3);
assert.deepEqual(plainsSource.traits, ["野獸出沒", "強敵衝擊"]);
assert.deepEqual(forestSource.traits, ["毒性威脅", "纏繞", "長途冒險"]);
assert.deepEqual(plainsSource.preparations.map((entry) => entry.summary), ["傷勢恢復", "野獸對策", "強敵攻勢"]);
assert.deepEqual(forestSource.preparations.map((entry) => entry.summary), ["毒性對策", "長途續航", "纏繞對策"]);
assert.equal(plainsSource.preparations.find((entry) => entry.id === "simple-bandage")?.effect?.hpThresholdRatio, 0.8);
assert.equal(forestSource.preparations.find((entry) => entry.id === "insect-repellent-powder")?.effect?.charges, 6);
assert.deepEqual(
  plainsSource.preparations.find((entry) => entry.id === "weapon-maintenance")?.effect?.encounterTypes,
  ["elite", "boss"]
);
assert.deepEqual(
  forestSource.preparations.find((entry) => entry.id === "forest-bandage")?.effect?.victoryMilestones,
  [5, 10]
);
assert.equal(forestSource.preparations.find((entry) => entry.id === "web-cutting-knife")?.effect?.type, "entangleRetry");

for (const playerText of [
  "生命低於 80% 時",
  "面對野獸時，每場第一次受到的攻擊傷害降低 15%",
  "遇上菁英或首領時，開戰後第一次出手會獲得 2 點攻擊加成",
  "受到毒性傷害時，傷害降低 25%。最多生效 6 次",
  "隨著冒險深入，會自動進行兩次包紮",
  "前 2 次掙脫纏繞失敗時，會立刻再嘗試一次"
]) {
  assert.ok(regionJsonSources.some((source) => source.includes(playerText)), `玩家整備文案缺少或已退回術語：${playerText}`);
}

assert.doesNotMatch(
  regionJsonSources.join("\n"),
  /formalVictoryCount|modifyDirectDamage|remainingCharges|ENTANGLE_ESCAPE_CHANCES|battleAttackBonus|effect\.type/,
  "玩家可見 description 不應出現內部 runtime / code 術語"
);

console.log("v0.2.4.0 B-stage Region Detail UI, no-Phoenix gate, player copy, and Content Editor roundtrip assertions passed.");
