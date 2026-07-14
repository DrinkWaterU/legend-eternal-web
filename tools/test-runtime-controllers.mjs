import assert from "node:assert/strict";

import { createEventRuntime } from "../src/adventure/eventRuntime.js";
import { createDefaultSave } from "../src/core/storage.js";
import { characterDefinitions } from "../src/data/characters/index.js";
import { createDebugRuntimeActions } from "../src/debug/runtimeActions.js";

class TestClassList {
  constructor() {
    this.values = new Set();
  }

  add(...names) {
    names.forEach((name) => this.values.add(name));
  }

  remove(...names) {
    names.forEach((name) => this.values.delete(name));
  }

  toggle(name, force) {
    const shouldAdd = force ?? !this.values.has(name);
    if (shouldAdd) {
      this.values.add(name);
    } else {
      this.values.delete(name);
    }
  }

  contains(name) {
    return this.values.has(name);
  }
}

class TestNode {
  constructor() {
    this.classList = new TestClassList();
    this.children = [];
    this.hidden = false;
    this.disabled = false;
    this.textContent = "";
    this.innerHTML = "";
  }

  append(...nodes) {
    this.children.push(...nodes);
  }

  replaceChildren(...nodes) {
    this.children = [...nodes];
  }

  addEventListener() {}

  querySelectorAll() {
    return [];
  }

  closest() {
    return null;
  }
}

globalThis.document = {
  createElement: () => new TestNode(),
  querySelector: () => null
};

globalThis.window = {
  setTimeout: (callback) => {
    callback();
    return 1;
  }
};

function createEventElements() {
  return {
    combatLayout: new TestNode(),
    eventLayout: new TestNode(),
    eventEyebrow: new TestNode(),
    eventTitle: new TestNode(),
    eventNarrative: new TestNode(),
    eventPrompt: new TestNode(),
    eventReward: new TestNode(),
    eventChoices: new TestNode(),
    eventContinueButton: new TestNode(),
    eventTransition: new TestNode(),
    eventTransitionText: new TestNode(),
    resultLabel: new TestNode(),
    encounterLabel: new TestNode(),
    nextButton: new TestNode()
  };
}

const eventState = {
  eventSchedule: { eventId: "forest-campfire", triggerBeforeEncounter: 6 },
  eventContext: null,
  runEventRecords: [],
  eventInputLocked: false,
  adventureProgressLocked: false,
  eventTransitionToken: 0,
  ended: false,
  phase: "safe",
  enemies: [],
  hero: { name: "冒險者", hp: 100, maxHp: 100, shield: 0 },
  turn: 0,
  awaitingBlessing: false,
  canRest: false,
  hasRested: false,
  ambushAdvantage: false,
  battleSource: "main",
  battleEncounterType: null,
  encounterIndex: 5,
  log: [],
  debugBuildRun: true,
  runStats: { rewards: { gold: 0, materials: {} } },
  blessingPoolOverrideId: null
};
const eventEls = createEventElements();
const eventRuntime = createEventRuntime({
  state: eventState,
  els: eventEls,
  getSaveData: () => createDefaultSave(),
  currentRegion: () => ({ scaling: {} }),
  getAdventureSourceName: () => "森林",
  clearEnemyGroup: () => {
    eventState.enemies = [];
  },
  setCombatActionState: () => {},
  applySceneContext: () => {},
  beginBattleRuntime: () => {},
  addFixedLog: () => {},
  logCurrentEnemyGroupEncounter: () => {},
  applyEnemyAmbushes: () => {},
  addLog: () => {},
  render: () => {},
  grantBlessing: () => null,
  hasPhoenixBlessing: () => true,
  saveGameSafe: () => {},
  loseRun: () => {},
  startEncounter: () => {},
  enterAdventureRoute: () => {},
  showBlessings: () => {}
});

await eventRuntime.beginScheduledEvent();
assert.equal(eventState.phase, "event");
assert.equal(eventState.eventSchedule, null);
assert.equal(eventState.eventContext.eventId, "forest-campfire");
assert.equal(eventEls.eventTitle.textContent, "林間營火");
assert.equal(eventEls.encounterLabel.textContent, "森林事件");
assert.equal(eventEls.eventChoices.children.length, 3);

eventRuntime.resetEventRunState();
assert.equal(eventState.eventContext, null);
assert.equal(eventState.runEventRecords.length, 0);

let debugSaveData = createDefaultSave();
const debugState = {
  selectedHeroId: "adventurer",
  selectedRegionId: "plains",
  selectedRegion: "平原",
  selectedHero: "冒險者",
  hero: null
};
const debugActions = createDebugRuntimeActions({
  state: debugState,
  els: createEventElements(),
  getSaveData: () => debugSaveData,
  replaceSaveData: (nextSaveData) => {
    debugSaveData = nextSaveData;
  },
  isDebugModeEnabled: () => true,
  getCharacterDefinition: (characterId = debugState.selectedHeroId) => characterDefinitions[characterId],
  buildHeroFromProgression: () => null,
  unlockAchievement: () => {},
  plainsTrialAchievementId: "plains_trial",
  saveGameSafe: () => {},
  render: () => {},
  initializeRunRuntime: () => {},
  currentRegion: () => ({}),
  beginBattleRuntime: () => {},
  addFixedLog: () => {},
  logCurrentEnemyGroupEncounter: () => {},
  addLog: () => {},
  enterSafeState: () => {},
  startEncounter: () => {},
  showPlainsStory: () => {},
  showRouteEnding: () => {},
  getRouteBossDefinition: () => null,
  recordSelectedBossInRunStats: () => {},
  applySceneContext: () => {},
  consumeBattleLimitedEffects: () => {},
  returnToCamp: () => {},
  returnToSafeArea: () => {},
  showAnpingArrivalStory: () => true,
  syncSafeAreaUiFromSave: () => {},
  syncSelectionFromSave: () => {},
  restart: () => {},
  syncMusicSettingsFromSave: () => {},
  closeTransientUiPanels: () => {},
  showScreen: () => {},
  runStartingFlees: 2
});

assert.deepEqual(
  debugActions.getMaterialGroups().map((group) => group.id),
  ["plains", "forest-main", "goblin"]
);
assert.ok(debugActions.getScenarioCatalog().length > 0);
assert.deepEqual(
  debugActions.getCharacterOptions().map((character) => character.id),
  ["adventurer", "archer"],
  "Debug Scenario 應可覆寫測試所有正式角色 definition，不受解鎖狀態限制"
);
assert.equal(typeof debugActions.startScenario, "function");
assert.equal(typeof debugActions.getSafeAreaOptions, "function");
assert.equal(typeof debugActions.prepareSafeArea, "function");
assert.equal(typeof debugActions.visitSafeArea, "function");
assert.equal(typeof debugActions.travelSafeArea, "function");
assert.equal(typeof debugActions.resetSafeArea, "function");
assert.equal(typeof debugActions.playAnpingArrival, "function");
assert.equal(typeof debugActions.giveBlacksmithResources, "function");
assert.equal(typeof debugActions.giveAllWeapons, "function");
assert.equal(typeof debugActions.clearAllWeapons, "function");

const blacksmithResourcesMessage = debugActions.giveBlacksmithResources();
assert.match(blacksmithResourcesMessage, /1000 金幣/);
assert.equal(debugSaveData.inventory.gold, 1000);
assert.ok(debugSaveData.inventory.materials.goblin_scrap.quantity >= 8);
assert.ok(debugSaveData.inventory.materials.spider_silk.quantity >= 5);

const giveWeaponsMessage = debugActions.giveAllWeapons();
assert.match(giveWeaponsMessage, /全部 4 把武器/);
assert.equal(Object.keys(debugSaveData.inventory.weapons).length, 4, "Debug 應可一次取得全部正式武器");
debugSaveData.progression.characters.adventurer.equipment.weaponId = "iron-longsword";
debugSaveData.progression.characters.archer.equipment.weaponId = "hunter-shortbow";
const clearWeaponsMessage = debugActions.clearAllWeapons();
assert.match(clearWeaponsMessage, /清空全部武器/);
assert.deepEqual(debugSaveData.inventory.weapons, {});
assert.equal(debugSaveData.progression.characters.adventurer.equipment.weaponId, null);
assert.equal(debugSaveData.progression.characters.archer.equipment.weaponId, null);

console.log("Runtime controller composition tests passed.");
