import assert from "node:assert/strict";

import {
  captureAdventureRouteState,
  createAdventureRouteHandoff,
  createBeachSegmentCheckpoint,
  restoreAdventureRouteState
} from "../src/adventure/coastSegment.js";
import { createRunLifecycleController } from "../src/features/adventure/runLifecycleController.js";
import { getRouteDefinition } from "../src/data/routes/index.js";

function createState(overrides = {}) {
  return {
    run: 3,
    selectedRegionId: "beach",
    activeRouteId: null,
    routeEncounterIndex: 0,
    encounterIndex: 16,
    hero: { hp: 80, maxHp: 160 },
    runStats: { bossId: "beach-warden", rewards: { gold: 120 } },
    ended: false,
    phase: "segmentChoice",
    eventSchedule: { scheduleChance: 0.6 },
    eventContext: null,
    eventInputLocked: false,
    adventureProgressLocked: true,
    blessingContext: "normal",
    blessingPoolOverrideId: null,
    blessingInputLocked: false,
    selectedBoss: { id: "beach-warden" },
    awaitingBlessing: false,
    battleSource: "main",
    battleEncounterType: "boss",
    routeEndingContext: null,
    turn: 0,
    enemies: [],
    targetEnemyId: null,
    pendingThreat: null,
    runPreparation: { id: "beach-bandage" },
    runEventRecords: [{ eventId: "coast-tide" }],
    eventTransitionToken: 4,
    coastSegmentCheckpoint: {
      run: 3,
      regionId: "beach",
      encounterIndex: 16,
      routeEncounterIndex: 0,
      activeRouteId: null
    },
    log: [{ type: "system", text: "段落完成" }],
    unrelatedRuntime: { keep: true },
    ...overrides
  };
}

function createController(state, startEncounter, onRender, onRecordBeachSegmentCompleted = () => {}) {
  return createRunLifecycleController({
    state,
    uiState: { runStartLocked: false },
    saveStore: { current: {} },
    els: {
      combatLayout: { hidden: true },
      eventLayout: { hidden: false }
    },
    windowRef: { requestAnimationFrame() {} },
    materialDefinitions: {},
    runStartingFlees: 2,
    currentRegion: () => ({ encounterCount: 16 }),
    currentRoute: () => null,
    currentAdventureSource: () => null,
    getRouteBossDefinition: () => ({ id: "goblin-boss", name: "哥布林首領" }),
    resetRouteRuntime() {},
    clearEnemyGroup() {},
    clearPendingThreat() {},
    getEventRuntime: () => null,
    clearAnpingArrivalTimers() {},
    selectRunBoss: () => null,
    recordSelectedBossInRunStats() {
      state.runStats.bossId = state.selectedBoss?.id || null;
    },
    recordBeachSegmentCompleted: onRecordBeachSegmentCompleted,
    buildHeroFromProgression: () => null,
    hasPhoenixBlessing: () => false,
    captureRunStartPermanentState: () => null,
    restoreRunStartPermanentState() {},
    recordRunStarted() {},
    saveGameSafe() {},
    syncSelectionFromSave() {},
    resetPreparationUiState() {},
    resetFacilityUiState() {},
    activateSafeArea: () => true,
    setNavigationContext() {},
    showScreen() {},
    showScreenInContext() {},
    renderRegionScreen() {},
    closeTransientUiPanels() {},
    setCombatActionState() {},
    render: onRender,
    flushAchievementUnlockQueue() {},
    showAnpingArrivalStory() {},
    applySceneContext() {},
    startEncounter
  });
}

const coastCaveRoute = {
  id: "coast-cave",
  regionId: "beach",
  encounterPlan: [{ type: "normal", groupId: "cave-entry" }]
};

{
  const state = createState({ coastSegmentCheckpoint: null });
  const before = JSON.stringify(state);
  const checkpoint = createBeachSegmentCheckpoint({ state, encounterCount: 16 });

  assert.deepEqual(checkpoint, {
    run: 3,
    regionId: "beach",
    encounterIndex: 16,
    routeEncounterIndex: 0,
    activeRouteId: null
  });
  assert.equal(JSON.stringify(state), before, "建立 checkpoint 不得先改動 Runtime");
}

{
  const state = createState();
  const handoff = createAdventureRouteHandoff({ state, route: coastCaveRoute });

  assert.deepEqual(handoff, {
    run: 3,
    regionId: "beach",
    routeId: "coast-cave",
    encounterIndex: 16,
    routeEncounterIndex: 0
  });
  assert.equal(state.activeRouteId, null, "建立交接資料不得提前寫入 Route id");
  assert.equal(state.encounterIndex, 16, "Route 入口不得覆寫海岸全域進度");
}

{
  const state = createState({ selectedRegionId: "forest", coastSegmentCheckpoint: null });
  const route = getRouteDefinition("goblin-camp");
  const controller = createController(state, () => {}, () => {});
  const handoff = controller.enterAdventureRoute(route.id);

  assert.equal(handoff.routeId, "goblin-camp");
  assert.equal(state.activeRouteId, "goblin-camp");
  assert.equal(state.routeEncounterIndex, 0);
  assert.equal(state.encounterIndex, 16);
}

{
  const state = createState({ selectedRegionId: "forest", coastSegmentCheckpoint: null });
  const before = captureAdventureRouteState(state);
  let renderCount = 0;
  const controller = createController(
    state,
    () => {
      throw new Error("測試用 Route 第一場失敗");
    },
    () => {
      renderCount += 1;
    }
  );

  assert.throws(
    () => controller.enterAdventureRoute("goblin-camp"),
    /測試用 Route 第一場失敗/
  );
  assert.deepEqual(captureAdventureRouteState(state), before, "Route 入口例外後必須還原 Runtime");
  assert.equal(renderCount, 1, "Route 入口例外後應嘗試重新 render 現況");
}

{
  const state = createState({ coastSegmentCheckpoint: null, phase: "danger" });
  let recordCount = 0;
  const controller = createController(state, () => {}, () => {}, () => {
    recordCount += 1;
  });
  const first = controller.openBeachSegmentCheckpoint();
  const second = controller.openBeachSegmentCheckpoint();

  assert.deepEqual(first, second, "重複建立同一段落 checkpoint 應回傳同一份資料");
  assert.equal(state.phase, "segmentChoice");
  assert.equal(state.ended, false);
  assert.equal(state.coastSegmentCheckpoint.encounterIndex, 16);
  assert.deepEqual(controller.getCoastSegmentCheckpoint(), first);
  assert.equal(recordCount, 1, "測試呼叫本身不應讓段落 checkpoint 產生第二份資料");
}

assert.throws(
  () => createAdventureRouteHandoff({
    state: createState({ coastSegmentCheckpoint: null }),
    route: coastCaveRoute
  }),
  /海岸段落尚未準備好/,
  "沒有段落 checkpoint 時不得進入洞穴"
);

assert.throws(
  () => createAdventureRouteHandoff({
    state: createState({ ended: true }),
    route: coastCaveRoute
  }),
  /沒有可延續的冒險/,
  "已結束的本輪不得建立跨段交接"
);

assert.throws(
  () => createAdventureRouteHandoff({
    state: createState({ activeRouteId: "coast-cave" }),
    route: coastCaveRoute
  }),
  /已有進行中的冒險路線/,
  "已有進行中的 Route 時不得重設路線進度"
);

assert.throws(
  () => createBeachSegmentCheckpoint({
    state: createState({ ended: true, coastSegmentCheckpoint: null }),
    encounterCount: 16
  }),
  /本輪冒險已結束/,
  "已結束的本輪不得重新建立段落 checkpoint"
);

assert.throws(
  () => createAdventureRouteHandoff({
    state: createState(),
    route: { ...coastCaveRoute, regionId: "forest" }
  }),
  /不屬於目前地區/,
  "不同地區的 Route 不得接入海岸"
);

assert.throws(
  () => createAdventureRouteHandoff({
    state: createState(),
    route: { id: "coast-cave", regionId: "beach", encounterPlan: [] }
  }),
  /缺少可進入的內容/,
  "空 Route 不得被視為可遊玩內容"
);

{
  const state = createState();
  const snapshot = captureAdventureRouteState(state);
  state.activeRouteId = "coast-cave";
  state.routeEncounterIndex = 4;
  state.hero.hp = 1;
  state.runStats.rewards.gold = 0;
  state.log.push({ type: "system", text: "不應保留" });
  state.unrelatedRuntime.keep = false;

  restoreAdventureRouteState(state, snapshot);

  assert.equal(state.activeRouteId, null);
  assert.equal(state.routeEncounterIndex, 0);
  assert.equal(state.hero.hp, 80);
  assert.equal(state.runStats.rewards.gold, 120);
  assert.deepEqual(state.log, [{ type: "system", text: "段落完成" }]);
  assert.equal(state.unrelatedRuntime.keep, false, "還原只處理 Route 交接責任欄位");
  assert.notEqual(state.hero, snapshot.hero, "還原後不得與 snapshot 共用可變物件");
}

console.log("Coast route handoff tests passed.");
