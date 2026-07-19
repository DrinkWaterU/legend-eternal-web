import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const normalizeNewlines = (source) => source.replace(/\r\n?/g, "\n");

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
  readme
] = (await Promise.all([
  Promise.all([
    "../src/app/eventBindings.js",
    "../src/app/runtimeState.js",
    "../src/app/createAdventureFeatures.js",
    "../src/features/adventure/runLifecycleController.js",
    "../src/features/adventure/runRecords.js",
    "../src/features/adventure/runResultController.js",
    "../src/features/adventure/routeEndingController.js",
    "../src/features/adventure/regionController.js",
    "../src/features/adventure/encounterVictoryController.js",
    "../src/features/adventure/encounterController.js",
    "../src/features/battle/battleState.js",
    "../src/features/battle/battleTurnController.js",
    "../src/features/battle/preparationBattleEffects.js",
    "../src/features/safeArea/campController.js",
    "../src/features/safeArea/safeAreaController.js",
    "../src/features/facility/facilityController.js",
    "../src/features/profile/saveTransferController.js",
    "../src/features/escape/escapeController.js"
  ].map((path) => readFile(new URL(path, import.meta.url), "utf8"))).then((sources) => sources.join("\n")),
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
  readFile(new URL("../README.md", import.meta.url), "utf8")
])).map(normalizeNewlines);

const [eventRuntimeSource, debugRuntimeSource, runLifecycleSource, battleLifecycleSource] = (await Promise.all([
  readFile(new URL("../src/adventure/eventRuntime.js", import.meta.url), "utf8"),
  Promise.all(["../src/debug/runtimeActions.js", "../src/debug/scenarioActions.js"].map((path) => readFile(new URL(path, import.meta.url), "utf8"))).then((sources) => sources.join("\n")),
  readFile(new URL("../src/adventure/runLifecycle.js", import.meta.url), "utf8"),
  readFile(new URL("../src/adventure/battleLifecycle.js", import.meta.url), "utf8")
])).map(normalizeNewlines);

assert.match(readme, /python tools\/dev-server\.py/);

assert.doesNotMatch(game, /campStartButton\.addEventListener\("click", startRun\)/);
assert.match(game, /campStartButton\.addEventListener\("click", \(\) => \{[\s\S]*showRegionDetail\(state\.selectedRegionId\)/);
assert.match(game, /startButton\.addEventListener\("click", startPlayerRun\)/);
assert.match(game, /requestedPreparationId = hasPhoenixBlessing\(\)\s*\? uiState\.selectedPreparationId\s*:\s*null/);

const prepareRunStartSource = game.match(/function prepareRunStart\(\) \{[\s\S]*?\n  \}/)?.[0] || "";
assert.match(prepareRunStartSource, /getRegionPreparation\(region, requestedPreparationId\)/);
assert.match(prepareRunStartSource, /createRunPreparation\(region, requestedPreparationId,[\s\S]*enhanced: requestedEnhanced/);
assert.doesNotMatch(prepareRunStartSource, /preparationDetailId|preparationDetailExpanded/, "Run Start 不得讀 detail preview state");

const startPlayerRunSource = game.match(/function startPlayerRun\(\) \{[\s\S]*?\n  \}/)?.[0] || "";
const runStartOrder = [
  "captureRunStartPermanentState()",
  "initializeRunRuntime({ hero: startContext.hero, preparation: startContext.preparation })",
  "spendPreparationCost(startContext)",
  "recordRunStarted()",
  "startEncounter()",
  'showScreen("gameScreen")'
].map((fragment) => {
  const index = startPlayerRunSource.indexOf(fragment);
  assert.ok(index >= 0, `Run Start 缺少：${fragment}`);
  return index;
});
assert.deepEqual(runStartOrder, [...runStartOrder].sort((a, b) => a - b), "整備扣款、紀錄與第一場遭遇順序不可漂移");
assert.match(game, /function spendPreparationCost\([\s\S]*spendInventoryCost\(\{[\s\S]*goldCost: preparation\.cost/);
assert.match(game, /function recordRunStarted\(\)[\s\S]*saveGameSafe\(\)/);
assert.match(startPlayerRunSource, /restoreRunStartPermanentState\(permanentSnapshot\)/);
assert.match(startPlayerRunSource, /setNavigationContext\(navigationContextBeforeStart\)[\s\S]*showScreen\("regionScreen"\)/);
assert.match(startPlayerRunSource, /if \(uiState\.runStartLocked\) return;/);

for (const field of ["preparationDetailId", "enhancedPreparationId", "preparationDetailExpanded", "runStartNotice", "runStartLocked"]) {
  assert.match(game, new RegExp(`${field}:`), `UI State 缺少 ${field}`);
}
const resetPreparationUiSource = game.match(/function resetPreparationUiState\(\) \{[\s\S]*?\n  \}/)?.[0] || "";
assert.match(resetPreparationUiSource, /clearPreparationSelectionState\(uiState\)/);
assert.match(game, /from "\.\.\/\.\.\/ui\/preparationState\.js"/);
for (const exportedFunction of ["clearPreparationSelectionState", "normalizePreparationUiState", "consumePreparationEnhancementReveal"]) {
  assert.match(preparationStateSource, new RegExp(`export function ${exportedFunction}\\(`));
}

for (const label of ["遭遇", "難度", "推薦等級", "首領"]) {
  assert.match(game, new RegExp(`\\["${label}"`), `Region overview 缺少：${label}`);
}
assert.doesNotMatch(game, /\["角色"/, "Region overview 不應再把角色當地區 metadata");
assert.match(game, /regionDepartureCharacter\.textContent = `\$\{character\.name\} Lv\.\$\{progress\.level\}`/);
assert.match(game, /normalizePreparationUiState\(\{[\s\S]*uiState,[\s\S]*region,[\s\S]*gold: inventory\.gold,[\s\S]*enabled: phoenixUnlocked/);
const selectPreparationSource = game.match(/function selectPreparation\(preparationId\) \{[\s\S]*?\n  \}/)?.[0] || "";
assert.match(selectPreparationSource, /const affordable = !preparation \|\| inventory\.gold >= preparation\.cost/);
assert.match(selectPreparationSource, /uiState\.preparationDetailId = preparationId/);

assert.match(runLifecycleSource, /export function resetAdventureRunState\(state, options = \{\}\)/);
const runRuntimeCoordinator = game.match(/function resetAdventureRunRuntime\(options = \{\}\) \{[\s\S]*?\n  \}/)?.[0] || "";
for (const requiredCall of [
  "resetAdventureRunState(state, options)",
  "clearEnemyGroup()",
  "clearPendingThreat()",
  "getEventRuntime()?.resetEventRunState()",
  "resetRouteRuntime()"
]) {
  assert.ok(runRuntimeCoordinator.includes(requiredCall), `Run Runtime coordinator 缺少：${requiredCall}`);
}
assert.match(game, /function initializeRunRuntime\([\s\S]*resetAdventureRunRuntime\(\)/);
assert.match(game, /function resetRuntimeAfterSaveReplacement\(\)[\s\S]*resetAdventureRunRuntime\(\{ clearLastRunSummary: true \}\)/);
assert.match(game, /function restart\(\)[\s\S]*resetAdventureRunRuntime\(\)[\s\S]*showScreen\("menuScreen"\)/);
assert.match(game, /function returnToSafeArea\(safeAreaId\)[\s\S]*activateSafeArea\(targetSafeAreaId\)[\s\S]*resetAdventureRunRuntime\(\)[\s\S]*showScreenInContext\("campScreen", "camp"\)/);
assert.match(game, /function returnToRunOriginSafeArea\(\)[\s\S]*returnToSafeArea\(state\.runOriginSafeAreaId\)/);

assert.match(game, /preparation: state\.runPreparation/);
assert.match(game, /function modifyPoisonDamage\(damage\)/);
assert.match(game, /retryOnFailure: \(\) => consumeEntangleRetry\(log\)/);
assert.match(game, /beginPreparationBattle\(state\.runPreparation, \{ enemyCount: state\.hero\.activeEnemyCount \}\)/);
assert.match(game, /preparationName = state\.runPreparation\?\.name \|\| "冒險整備"/);
assert.doesNotMatch(game, /整備｜驅蟲藥粉|整備｜簡易繃帶/, "協調層不應寫死個別整備名稱");
assert.match(game, /facility\.id !== "traveling-merchant" \|\| hasPhoenixBlessing\(\)/);
assert.match(game, /els\.campPlacesButton\.hidden = facilities\.length === 0/);
assert.match(game, /function showFacilityList\(safeAreaId = uiState\.safeAreaId, contextId = uiState\.navigationContext\)/);
assert.match(game, /facilityBackButton\.addEventListener\("click", \(\) => showScreen\(getNavigationReturnTarget\(\)\)\)/);

const routeEntry = game.match(/function enterAdventureRoute\([\s\S]*?\n  \}/)?.[0] || "";
assert.doesNotMatch(routeEntry, /runPreparation\s*=\s*null/, "Route 切換不可清除整備 runtime");
const goblinRouteCompletion = game.match(/function completeGoblinCampRoute\(\) \{[\s\S]*?\n  \}/)?.[0] || "";
assert.match(goblinRouteCompletion, /storyFlags\.archerRescued \|\| archerProgress\?\.unlocked/);
assert.match(goblinRouteCompletion, /endingKey = alreadyRescued \? "repeatEnding" : "ending"/);
assert.match(goblinRouteCompletion, /showRouteEnding\(route, \{ endingKey \}\)/);
assert.match(game, /const endingKey = state\.routeEndingContext\?\.endingKey \|\| "ending"/);

assert.match(battleLifecycleSource, /export function resetBattleEntryState\(state, options = \{\}\)/);
const battleRuntimeCoordinator = game.match(/function beginBattleRuntime\(options = \{\}\) \{[\s\S]*?\n  \}/)?.[0] || "";
const battleRuntimeOrder = [
  "resetBattleEntryState(state, { source, encounterType, ambushAdvantage })",
  "setEnemyGroup(enemies, { restore: restoreEnemies })",
  "resetHeroBattleState()",
  "beginPreparationBattle(state.runPreparation, { enemyCount: state.hero.activeEnemyCount })",
  "applyBattleStartSkills()"
].map((requiredCall) => {
  const index = battleRuntimeCoordinator.indexOf(requiredCall);
  assert.ok(index >= 0, `Battle Runtime coordinator 缺少：${requiredCall}`);
  return index;
});
assert.deepEqual(battleRuntimeOrder, [...battleRuntimeOrder].sort((a, b) => a - b), "Battle Runtime 初始化順序不可漂移");
assert.match(game, /function startEncounter\(\)[\s\S]*beginBattleRuntime\(\{[\s\S]*source: "main"/);
assert.match(game, /function resumePendingThreat\([\s\S]*beginBattleRuntime\(\{[\s\S]*restoreEnemies: true/);
assert.match(game, /function resolveCounterEscape\(\)[\s\S]*source: "counterEscape"[\s\S]*ambushAdvantage: true/);
assert.match(eventRuntimeSource, /beginBattleRuntime\(\{[\s\S]*source: "event"[\s\S]*encounterType: "event"/);
assert.doesNotMatch(eventRuntimeSource, /resetHeroBattleState|beginRunPreparationBattle|applyBattleStartSkills/);
assert.match(debugRuntimeSource, /beginBattleRuntime\(\{[\s\S]*encounterType: "normal"/);

for (const label of ["目前角色", "目前地區", "經驗", "目前金幣"]) {
  assert.match(game, new RegExp(label), `Camp 核心摘要缺少：${label}`);
}
assert.doesNotMatch(game, /地區難度/, "Camp 核心摘要不應退回舊版長清單");

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
