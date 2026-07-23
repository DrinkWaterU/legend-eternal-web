import assert from "node:assert/strict";

import { createBlessingInstance, syncBlessingInstanceRuntime } from "../src/adventure/blessingInstances.js";
import { applyBlessingEffects } from "../src/core/blessings.js";
import { createRunPreparation } from "../src/core/preparations.js";
import { buildHeroFromProgression as buildHeroFromProgressionCore } from "../src/core/progression.js";
import { characterDefinitions } from "../src/data/characters/index.js";
import { regionDefinitions } from "../src/data/regions/index.js";
import { createCampTransitionController } from "../src/features/adventure/campTransitionController.js";
import beachData from "../src/data/blessings/beach.json" with { type: "json" };
import { TestNode, installTestDocument } from "./dom-test-stub.mjs";

installTestDocument();

function createElements() {
  return {
    combatLayout: new TestNode(),
    eventLayout: new TestNode(),
    campTransitionLayout: new TestNode(),
    eventNarrative: new TestNode(),
    eventEyebrow: new TestNode(),
    eventTitle: new TestNode(),
    eventPrompt: new TestNode(),
    eventReward: new TestNode(),
    eventChoices: new TestNode(),
    eventContinueButton: new TestNode(),
    eventTransition: new TestNode(),
    eventTransitionText: new TestNode(),
    campTransitionEyebrow: new TestNode(),
    campTransitionTitle: new TestNode(),
    campTransitionNarrative: new TestNode(),
    campTransitionSummary: new TestNode(),
    campTransitionReminder: new TestNode(),
    campTransitionBlessingSection: new TestNode(),
    campTransitionSelectionHint: new TestNode(),
    campTransitionSelectionCount: new TestNode(),
    campTransitionBlessingGrid: new TestNode(),
    campTransitionMessage: new TestNode(),
    campTransitionBackButton: new TestNode(),
    campTransitionConfirmButton: new TestNode(),
    campTransitionReadySection: new TestNode(),
    campTransitionReadyText: new TestNode(),
    resultLabel: new TestNode(),
    encounterLabel: new TestNode()
  };
}

function createHero() {
  return {
    name: "測試者",
    hp: 100,
    maxHp: 120,
    attack: 10,
    defense: 4,
    blessings: [],
    blessingFlows: [],
    blessingFlowMomentum: {},
    familyDamageBonus: {},
    timedRegens: [],
    encounterBiases: [],
    shield: 0,
    shieldStart: 0,
    fleesRemaining: 0
  };
}

const state = {
  run: 4,
  selectedRegionId: "beach",
  selectedHeroId: "adventurer",
  activeRouteId: null,
  routeEncounterIndex: 0,
  encounterIndex: 16,
  turn: 0,
  phase: "segmentChoice",
  ended: false,
  awaitingBlessing: false,
  blessingContext: "normal",
  blessingPoolOverrideId: null,
  blessingInputLocked: false,
  eventInputLocked: false,
  adventureProgressLocked: true,
  eventSchedule: { eventId: "beach-event", triggerBeforeEncounter: 5 },
  eventContext: { eventId: "beach-event" },
  runEventRecords: [{ eventId: "beach-event" }],
  eventTransitionToken: 2,
  battleSource: "main",
  battleEncounterType: "boss",
  routeEndingContext: null,
  coastSegmentCheckpoint: {
    run: 4,
    regionId: "beach",
    encounterIndex: 16,
    routeEncounterIndex: 0,
    activeRouteId: null
  },
  runStats: { expGained: 99, rewards: { gold: 123 } },
  hero: createHero(),
  enemies: [],
  targetEnemyId: null,
  pendingThreat: null,
  blessingInstances: [],
  blessingInstanceSequence: 0,
  campSelection: null
};

const tideRest = beachData.blessings.find((blessing) => blessing.id === "beach-tide-rest");
const fishmanTideeye = beachData.blessings.find((blessing) => blessing.id === "beach-fishman-tideeye");
{
  const hero = createHero();
  assert.doesNotThrow(() => applyBlessingEffects(hero, fishmanTideeye, {
    instanceId: "expired-encounter-bias",
    skipImmediate: true,
    runtimeState: { timedRegens: [], encounterBiases: [] }
  }), "已消耗完的遭遇偏向不得在扎營重新套用時觸發 undefined JSON 錯誤");
  assert.equal(hero.encounterBiases.length, 0, "已消耗完的遭遇偏向不得在扎營時重新啟動");
  assert.equal(hero.critChance, 0.09, "遭遇偏向失效時仍應保留祝福的永久數值效果");
  assert.equal(hero.familyDamageBonus.fishman, 0.08, "遭遇偏向失效時仍應保留魚人傷害加成");
}
const acquiredInstances = [];
for (let index = 0; index < 9; index += 1) {
  const instance = createBlessingInstance({
    state,
    blessing: tideRest,
    sourceLabel: index === 8 ? "海灘 Boss" : "海灘途中"
  });
  applyBlessingEffects(state.hero, tideRest, { instanceId: instance.instanceId });
  state.hero.blessings.push(tideRest.name);
  syncBlessingInstanceRuntime(instance, state.hero);
  acquiredInstances.push(instance);
}
state.hero.hp = 17;
state.hero.timedRegens[0].remainingEncounters = 1;
state.blessingInstances = acquiredInstances;
const originalHero = state.hero;
const originalRunStats = state.runStats;
const els = createElements();
let renderCount = 0;
let enteredRoute = false;
let finishedOutcome = null;

const controller = createCampTransitionController({
  state,
  els,
  runStartingFlees: 2,
  buildHeroFromProgression: () => {
    const hero = createHero();
    hero.maxHp = 120;
    hero.hp = hero.maxHp;
    return hero;
  },
  clearEnemyGroup: () => {
    state.enemies = [];
    state.targetEnemyId = null;
  },
  clearPendingThreat: () => {
    state.pendingThreat = null;
  },
  render: () => {
    renderCount += 1;
  },
  finishRun: (outcome) => {
    finishedOutcome = outcome;
  },
  enterAdventureRoute: () => {
    enteredRoute = true;
    state.activeRouteId = "coast-cave";
    state.phase = "combat";
    renderCount += 1;
  }
});

assert.equal(controller.openCampSelection(), true);
assert.equal(state.phase, "campSelection");
assert.equal(els.campTransitionBlessingGrid.children.length, 9);
assert.equal(els.campTransitionSelectionCount.textContent, "已選 0 / 8");

els.campTransitionBlessingGrid.children.slice(0, 8).forEach((card) => card.click());
assert.equal(state.campSelection.selectedInstanceIds.length, 8);
assert.equal(els.campTransitionConfirmButton.disabled, false);
els.campTransitionBlessingGrid.children[8].click();
assert.equal(
  state.campSelection.message,
  "已經選滿 8 個祝福；先取消已選項目，再更換配置。"
);
assert.equal(state.campSelection.selectedInstanceIds.length, 8);

assert.equal(controller.confirmCampSelection(), true);
assert.equal(enteredRoute, true, "保留祝福確認後應進入已註冊的洞穴 Route");
assert.equal(finishedOutcome, null, "扎營確認不得結束本輪");
assert.equal(state.phase, "combat");
assert.equal(state.activeRouteId, "coast-cave");
assert.notEqual(state.hero, originalHero);
assert.equal(state.hero.blessings.length, 8);
assert.equal(state.blessingInstances.length, 8);
assert.equal(state.hero.hp, 60, "扎營生命應固定為重建後最大生命的 50%");
assert.equal(state.hero.timedRegens[0].remainingEncounters, 1, "計時祝福應沿用剩餘場數");
assert.equal(state.hero.fleesRemaining, 2);
assert.equal(state.eventSchedule, null);
assert.equal(state.eventContext, null);
assert.deepEqual(state.runStats, originalRunStats, "扎營不得重置本輪戰鬥結算資料");
assert.equal(renderCount > 0, true);

state.phase = "segmentChoice";
state.ended = false;
state.campSelection = null;
finishedOutcome = null;
assert.equal(controller.finishBeachSegment(), true, "不扎營應能直接結算海灘段落");
assert.equal(finishedOutcome, "segmentClear");

{
  const archerBuildIds = [
    "beach-fishman-tideeye",
    "beach-fishman-hunt",
    "beach-tide-counter",
    "beach-tide-whetstone",
    "beach-fishman-tideeye",
    "beach-reef-shell",
    "beach-reef-shell",
    "beach-reef-shell",
    "beach-tide-scavenger",
    "beach-tide-scavenger",
    "beach-tide-whetstone",
    "beach-tide-counter",
    "beach-saltbound-shell",
    "beach-reef-shell",
    "beach-reef-shell",
    "beach-tide-counter"
  ];
  const archerDefinition = characterDefinitions.archer;
  const archerProgress = {
    level: 25,
    exp: 0,
    learnedSkills: [],
    equipment: { weaponId: null }
  };
  const buildArcher = () => buildHeroFromProgressionCore(
    archerDefinition,
    structuredClone(archerProgress)
  );
  const archerState = {
    run: 5,
    selectedRegionId: "beach",
    selectedHeroId: "archer",
    activeRouteId: null,
    routeEncounterIndex: 0,
    encounterIndex: 16,
    turn: 0,
    phase: "segmentChoice",
    ended: false,
    awaitingBlessing: false,
    blessingContext: "normal",
    blessingPoolOverrideId: null,
    blessingInputLocked: false,
    eventInputLocked: false,
    adventureProgressLocked: true,
    eventSchedule: null,
    eventContext: null,
    runEventRecords: [],
    eventTransitionToken: 0,
    battleSource: "main",
    battleEncounterType: "boss",
    runPreparation: createRunPreparation(regionDefinitions.beach, "reef-anchor-tether", { enhanced: true }),
    routeEndingContext: null,
    coastSegmentCheckpoint: {
      run: 5,
      regionId: "beach",
      encounterIndex: 16,
      routeEncounterIndex: 0,
      activeRouteId: null
    },
    runStats: { expGained: 0, rewards: {} },
    hero: buildArcher(),
    enemies: [],
    targetEnemyId: null,
    pendingThreat: null,
    blessingInstances: [],
    blessingInstanceSequence: 0,
    campSelection: null
  };
  const blessingById = new Map(beachData.blessings.map((blessing) => [blessing.id, blessing]));
  archerBuildIds.forEach((blessingId) => {
    const blessing = blessingById.get(blessingId);
    assert.ok(blessing, `弓箭手回歸 Build 應能解析：${blessingId}`);
    const instance = createBlessingInstance({ state: archerState, blessing, sourceLabel: "海灘途中" });
    applyBlessingEffects(archerState.hero, blessing, { instanceId: instance.instanceId });
    archerState.hero.blessings.push(blessing.name);
    syncBlessingInstanceRuntime(instance, archerState.hero);
    archerState.blessingInstances.push(instance);
  });

  let archerEnteredRoute = false;
  const archerController = createCampTransitionController({
    state: archerState,
    els: createElements(),
    runStartingFlees: 2,
    buildHeroFromProgression: buildArcher,
    clearEnemyGroup: () => { archerState.enemies = []; },
    clearPendingThreat: () => { archerState.pendingThreat = null; },
    render() {},
    finishRun() {},
    enterAdventureRoute: () => {
      archerEnteredRoute = true;
      archerState.activeRouteId = "coast-cave";
      archerState.phase = "combat";
    }
  });
  assert.equal(archerController.openCampSelection(), true);
  archerState.blessingInstances.slice(0, 8).forEach((instance) => {
    assert.equal(archerController.toggleCampBlessing(instance.instanceId), true);
  });
  assert.equal(archerController.confirmCampSelection(), true, "使用回報的 16 張弓箭手 Build 應能完成扎營");
  assert.equal(archerEnteredRoute, true);
  assert.equal(archerState.hero.characterId, "archer");
  assert.equal(archerState.runPreparation.name, "礁釘繫索・強化");
  assert.equal(archerState.hero.blessings.length, 8);
  assert.equal(archerState.blessingInstances.length, 8);
}

console.log("Camp transition and blessing retention tests passed.");
