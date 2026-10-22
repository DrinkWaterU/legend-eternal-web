import assert from "node:assert/strict";
import { createDefaultSave } from "../src/core/saveDefaults.js";
import { createSaveStore } from "../src/app/saveStore.js";
import { createSaveTransactions } from "../src/app/saveTransactions.js";
import { createAdventureSaveActions } from "../src/app/adventureSaveActions.js";
import { createAdventureRuntimeState } from "../src/app/runtimeState.js";
import { createCharacterProgression } from "../src/features/character/characterProgression.js";
import { createRunRecords } from "../src/features/adventure/runRecords.js";
import { createBattleSettlement } from "../src/features/battle/battleSettlement.js";
import { createBattleTurnController } from "../src/features/battle/battleTurnController.js";
import { createQuestRuntime } from "../src/features/quest/questRuntime.js";
import { createRunResultController } from "../src/features/adventure/runResultController.js";
import { createPlainsStoryController } from "../src/features/story/plainsStoryController.js";
import { createRouteEndingController } from "../src/features/adventure/routeEndingController.js";
import { createRunLifecycleController } from "../src/features/adventure/runLifecycleController.js";
import { createStoryQuestRuntime } from "../src/features/storyQuest/storyQuestRuntime.js";
import { createDuelController } from "../src/features/duel/duelController.js";
import { createAnpingArrivalController } from "../src/features/story/anpingArrivalController.js";
import { storyQuestDefinitions } from "../src/data/storyQuests.js";
import { getRouteDefinition } from "../src/data/routes/index.js";
import { characterDefinitions } from "../src/data/characters/index.js";
import { regionDefinitions } from "../src/data/regions/index.js";
import { questDefinitions } from "../src/data/quests.js";
import { materialDefinitions } from "../src/data/materials.js";
import { weaponDefinitions } from "../src/data/weapons.js";
import { TestNode, installTestDocument } from "./dom-test-stub.mjs";
import { withSeed } from "./model-test-helpers.mjs";

const noop = () => {};
installTestDocument();
function fixture({ blessing = true } = {}) {
  const initialSave = createDefaultSave();
  initialSave.storyFlags.phoenixBlessingUnlocked = blessing;
  initialSave.quests.board.questIds = ["broad-monster-control", "route-patrol", "elite-suppression", "plains-boss-trophy"];
  initialSave.quests.active = { questId: "broad-monster-control", progress: 0, acceptedAtCompletionCount: 0 };
  let disk = structuredClone(initialSave);
  let allowed = false;
  let retry;
  let modal = false;
  const attempts = [];
  const store = createSaveStore({ initialSave, persistSave(candidate) {
    attempts.push(structuredClone(candidate));
    if (!allowed) return false;
    disk = structuredClone(candidate);
    return true;
  } });
  const transactions = createSaveTransactions({ saveStore: store, pendingView: {
    show(options) { retry = options.retry; modal = true; }, hide() { modal = false; }
  } });
  const operations = createAdventureSaveActions({ saveStore: store, ...transactions });
  const state = createAdventureRuntimeState({ characterDefinitions, regionDefinitions });
  state.hero = { ...characterDefinitions.adventurer, hp: 50, maxHp: 50, blessings: [], skills: [] };
  state.runStats = { expGained: 0, startLevel: 1, endLevel: 1, levelUps: [], learnedSkills: [], unlockedCharacters: [], rewards: { gold: 0, materials: {} } };
  const saveGameSafe = () => store.persist();
  const progression = createCharacterProgression({ state, saveStore: store, characterDefinitions, weaponDefinitions, addLog: noop, saveGameSafe });
  state.hero = progression.buildHeroFromProgression();
  const questRuntime = createQuestRuntime({ saveStore: store, questDefinitions, materialDefinitions, ...transactions });
  const records = createRunRecords({ state, saveStore: store, currentRegion: () => regionDefinitions[state.selectedRegionId], currentRoute: () => getRouteDefinition(state.activeRouteId), questRuntime, saveGameSafe });
  const els = new Proxy({}, { get(target, key) { return target[key] ||= new TestNode(); } });
  const result = createRunResultController({ state, saveStore: store, els, windowRef: { requestAnimationFrame: fn => fn() }, materialDefinitions,
    currentRegion: () => regionDefinitions.plains, currentRoute: () => null, getAdventureSourceName: () => "平原", getAdventureEncounterCount: () => 16,
    getAdventureEncounterIndex: () => state.encounterIndex, ...progression, ...records, ...operations, saveGameSafe,
    clearEnemyGroup: noop, clearPendingThreat: noop, addLog: noop, render: noop, closeAbilityInfoPanel: noop, closeBlessingInfoPanel: noop, flushAchievementUnlockQueue: noop });
  const settlement = createBattleSettlement({ state, saveStore: store, counterEscapeHealRatio: 0.2, addLog: noop, addFixedLog: noop,
    ...progression, ...records, saveGameSafe, applyVictorySkills: noop, consumeBattleLimitedEffects: noop, render: noop, showBlessings: noop });
  return { state, store, operations, progression, records, result, settlement, els, attempts, saveGameSafe,
    get disk() { return disk; }, get modal() { return modal; }, retry: () => retry(), allow: () => { allowed = true; } };
}

// Exercise real turn -> multi-kill -> EXP/drop/quest -> run completion together.
{
  const f = fixture();
  const before = structuredClone(f.disk);
  f.state.phase = "combat";
  f.state.enemies = [1, 2].map(id => ({ id: `test-${id}`, runtimeId: `test-${id}`, hp: 1, maxHp: 1, kind: "普通", expReward: 9,
    rewards: { gold: { min: 5, max: 5 }, materials: [{ id: "slime_gel", chance: 1, min: 1, max: 1 }] } }));
  let actions = 0;
  const turn = createBattleTurnController({ state: f.state, ...f.operations, createCombatLogger: () => ({ fixed: noop, template: noop }),
    currentTargetEnemy: () => f.state.enemies[0], runHeroPlayerAction() { actions++; f.state.enemies.forEach(enemy => { enemy.hp = 0; }); },
    settleDefeatedEnemies: f.settlement.settleDefeatedEnemies, winEncounter: () => f.result.finishRun("clear"), loseRun: noop, render: noop });
  withSeed(51, () => turn.playTurn());
  assert.equal(f.attempts.length, 1, "One complete action must produce one storage attempt");
  assert.deepEqual(f.disk, before, "No partial XP, materials, counters or quest writes");
  assert.deepEqual(f.store.current, before, "Committed state stays unchanged while pending");
  assert.equal(f.els.endPanel.classList.contains("is-visible"), false, "Do not announce completion before saving");
  turn.playTurn();
  assert.equal(actions, 1);
  f.retry();
  f.allow();
  f.retry();
  assert.equal(f.modal, false);
  assert.equal(f.disk.inventory.gold, 10);
  assert.equal(f.disk.inventory.materials.slime_gel.quantity, 2);
  assert.equal(f.disk.progression.characters.adventurer.exp, 18);
  assert.equal(f.disk.statistics.totalEnemiesDefeated, 2);
  assert.equal(f.disk.quests.active.progress, 2);
  assert.equal(f.disk.statistics.totalClears, 1);
  assert.equal(f.els.endPanel.classList.contains("is-visible"), true);
  assert.equal(actions, 1, "Retry must not rerun attacks or random rewards");
  for (const attempt of f.attempts) assert.deepEqual(attempt, f.disk);
  assert.equal(f.retry().status, "idle");
}

for (const outcome of ["defeat", "retreat", "segmentClear"]) {
  const f = fixture({ blessing: false });
  f.store.current.progression.characters.adventurer.level = 3;
  f.state.hero.level = 3;
  f.state.hero.exp = 0;
  f.result.finishRun(outcome);
  assert.equal(f.modal, true);
  assert.equal(f.store.current.progression.characters.adventurer.level, 3);
  assert.equal(f.els.endPanel.classList.contains("is-visible"), false);
  const candidate = structuredClone(f.attempts[0]);
  f.allow(); f.retry();
  assert.deepEqual(f.disk, candidate);
  assert.equal(f.disk.progression.characters.adventurer.level, outcome === "defeat" ? 1 : 3);
  assert.equal(f.disk.statistics.totalDefeats, outcome === "defeat" ? 1 : 0);
  assert.equal(f.disk.statistics.totalRetreats, outcome === "retreat" ? 1 : 0);
}

{
  const f = fixture({ blessing: false });
  let returned = 0;
  f.state.phase = "story";
  f.els.storyPanel.classList.add("is-visible");
  const story = createPlainsStoryController({ state: f.state, saveStore: f.store, els: f.els, windowRef: {}, ...f.operations, saveGameSafe: f.saveGameSafe,
    queueAchievementUnlock(id) { f.store.current.achievements[id] = { unlocked: true }; }, plainsTrialAchievementId: "plainsTrial",
    returnToRunOriginSafeArea() { returned++; f.state.phase = "camp"; } });
  story.completeStory();
  assert.equal(returned, 0);
  assert.equal(f.els.storyPanel.classList.contains("is-visible"), true);
  assert.equal(f.store.current.storyFlags.phoenixBlessingUnlocked, false);
  story.completeStory();
  f.retry(); f.allow(); f.retry();
  assert.equal(returned, 1);
  assert.equal(f.disk.storyFlags.phoenixBlessingUnlocked, true);
  assert.equal(f.disk.achievements.plainsTrial.unlocked, true);
  story.completeStory();
  assert.equal(returned, 1, "Repeated confirmation cannot repeat story completion");
  assert.equal(f.attempts.length, 3);
}

{
  const f = fixture();
  let effects = 0;
  f.operations.runSaveOperation(() => f.operations.afterAdventureSaved(() => effects++));
  assert.equal(f.attempts.length, 0, "Actions without permanent changes must not require a writable store");
  assert.equal(effects, 1);
  assert.throws(() => f.operations.runSaveOperation(() => {
    f.store.current.inventory.gold = 900;
    throw new Error("rule failure");
  }), /rule failure/);
  assert.equal(f.store.current.inventory.gold, 0);
  assert.equal(f.store.hasPendingTransaction, false);
}

{
  const f = fixture();
  const route = getRouteDefinition("goblin-camp");
  Object.assign(f.state, { selectedRegionId: "forest", activeRouteId: route.id, routeEncounterIndex: route.encounterPlan.length,
    battleEncounterType: "boss", enemies: [], encounterIndex: route.encounterPlan.length });
  const ending = createRouteEndingController({ state: f.state, saveStore: f.store, els: f.els, characterDefinitions, ...f.operations,
    currentRoute: () => route, clearPendingThreat: noop, closeAbilityInfoPanel: noop, closeBlessingInfoPanel: noop,
    unlockAdventureClearAchievements: noop, unlockCoastClearAchievement: noop, ...f.records, finishRun: f.result.finishRun,
    render: noop, getEventRuntime: () => null });
  ending.completeRoute();
  assert.equal(f.store.current.progression.characters.archer.unlocked, false);
  assert.equal(f.els.eventTitle.textContent, "");
  f.retry(); f.allow(); f.retry();
  assert.equal(f.disk.progression.characters.archer.unlocked, true);
  assert.equal(f.disk.storyFlags.archerRescued, true);
  assert.equal(f.disk.statistics.regions.forest.routeClears.goblinCamp, 1);
  assert.equal(f.els.eventTitle.textContent, route.ending.title);
  for (let page = 0; page < route.ending.pages.length; page++) ending.handleEventContinueButton();
  assert.equal(f.disk.statistics.totalClears, 1, "Closing the ending cannot count a second clear");
}

{
  const f = fixture();
  f.store.current.storyQuests.records["kaige-challenge"] = { status: "active", stageId: "defeat-kaige" };
  f.state.battleSource = "duel";
  f.state.specialDuelContext = { duelId: "kaige-challenge", npcId: "kaige" };
  let dialogues = 0;
  const quests = createStoryQuestRuntime({ saveStore: f.store, storyQuestDefinitions, characterDefinitions, weaponDefinitions, materialDefinitions, saveGameSafe: f.saveGameSafe });
  const duel = createDuelController({ state: f.state, saveStore: f.store, els: f.els, ...f.operations, storyQuestRuntime: quests,
    settleBattleVictory: noop, resetAdventureRunRuntime: () => { f.state.battleSource = "main"; }, setNavigationContext: noop,
    showNpcDialogue: () => { dialogues++; } });
  f.operations.runSaveOperation(() => duel.handleBattleVictory());
  assert.equal(dialogues, 0);
  assert.equal(f.store.current.progression.characters.kaige.unlocked, false);
  f.retry(); f.allow(); f.retry();
  assert.equal(dialogues, 1);
  assert.equal(f.disk.storyQuests.records["kaige-challenge"].status, "completed");
  assert.equal(f.disk.progression.characters.kaige.unlocked, true);
  assert.equal(f.disk.inventory.weapons["worn-battle-axe"], true);
  assert.equal(f.disk.progression.characters.kaige.equipment.weaponId, "worn-battle-axe");
  assert.equal(f.disk.statistics.totalEnemiesDefeated, 0, "Duel does not grant adventure kills");
}

{
  const f = fixture();
  Object.assign(f.state, { selectedRegionId: "beach", encounterIndex: 16 });
  const dependencies = { state: f.state, uiState: {}, saveStore: f.store, ...f.records, ...f.operations,
    currentRegion: () => regionDefinitions.beach, saveGameSafe: f.saveGameSafe };
  const lifecycle = createRunLifecycleController(new Proxy(dependencies, { get: (target, key) => key in target ? target[key] : noop }));
  lifecycle.openBeachSegmentCheckpoint();
  assert.equal(f.modal, true);
  assert.equal(f.store.current.statistics.regions.beach.bestEncounter, 0);
  f.retry(); f.allow(); f.retry();
  assert.equal(f.disk.statistics.regions.beach.bestEncounter, 16);
  assert.equal(f.disk.statistics.totalClears, 0, "Beach segment is not a full coast clear");
  assert.equal(f.state.coastSegmentCheckpoint.regionId, "beach");
  assert.equal(f.state.phase, "segmentChoice");
}

{
  const f = fixture();
  f.store.current.progression.safeAreas["anping-town"].unlocked = true;
  f.state.anpingArrivalContext = { pageIndex: 0 };
  f.els.anpingArrivalPanel.classList.add("is-visible");
  let arrivals = 0;
  const arrival = createAnpingArrivalController({ state: f.state, uiState: { safeAreaId: "camp" }, saveStore: f.store, els: f.els,
    windowRef: { clearTimeout: noop }, pages: [{}], ...f.operations, saveGameSafe: f.saveGameSafe,
    returnToSafeArea: () => { arrivals++; } });
  arrival.continueStory();
  assert.equal(arrivals, 0);
  assert.equal(f.els.anpingArrivalPanel.classList.contains("is-visible"), true);
  assert.equal(f.store.current.progression.safeAreas["anping-town"].visitedAt, null);
  f.retry(); f.allow(); f.retry();
  assert.equal(arrivals, 1);
  assert.ok(f.disk.progression.safeAreas["anping-town"].visitedAt);
  assert.equal(f.disk.settings.currentSafeAreaId, "anping-town");
  assert.equal(f.els.anpingArrivalPanel.classList.contains("is-visible"), false);
}
console.log("Adventure operations: atomic multi-kill, identical retries, clear/death/retreat, Phoenix/archer/Kaige unlocks, coast checkpoint and town arrival passed.");
