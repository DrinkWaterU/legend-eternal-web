import assert from "node:assert/strict";
import {
  createDebugBuildProfile,
  getDebugBuildProfiles,
  getDebugScenarioBuildSlots,
  getDebugScenarioCatalog
} from "../src/debug/scenarios.js";
import { createDebugScenarioActions } from "../src/debug/scenarioActions.js";
import { regionDefinitions } from "../src/data/regions/index.js";

const catalog = getDebugScenarioCatalog();
const goblinBoss = catalog.find((scenario) => scenario.id === "goblin-boss");
assert.ok(goblinBoss, "Debug catalog 應包含血骨薩滿場景");
assert.equal(goblinBoss.supportsBuild, true, "血骨薩滿場景應支援 Build");
assert.equal(goblinBoss.supportsRouteEntry, true, "血骨薩滿場景應支援 Route 進入時機");
assert.equal(goblinBoss.supportsMidChoice, true, "血骨薩滿場景應支援中段選擇");

const beachScenarios = [
  "beach-boss",
  "beach-salt-dressing",
  "beach-paralysis-gloves",
  "beach-multi-tether"
].map((scenarioId) => catalog.find((scenario) => scenario.id === scenarioId));
assert.ok(beachScenarios.every(Boolean), "Debug catalog 應包含四個海灘測試場景");
assert.equal(getDebugScenarioBuildSlots("beach-boss").length, 15, "海灘 Boss 場景應有 15 個戰前 Blessing");
assert.equal(getDebugScenarioBuildSlots("beach-multi-tether").length, 9, "海灘敵群場景應使用第 10 場前的 9 個 Blessing");
assert.equal(beachScenarios[1].preparationId, "freshwater-dressing");
assert.equal(beachScenarios[2].preparationId, "insulated-gloves");
assert.equal(beachScenarios[3].preparationId, "reef-anchor-tether");

const beachCampTransition = catalog.find((scenario) => scenario.id === "beach-camp-transition");
assert.ok(beachCampTransition, "Debug catalog 應包含海灘 Boss 後扎營場景");
assert.equal(beachCampTransition.kind, "coastCampTransition");
assert.equal(getDebugScenarioBuildSlots("beach-camp-transition").length, 16, "扎營場景應建立海灘完整 16 場 Blessing");

const coastCaveBoss = catalog.find((scenario) => scenario.id === "coast-cave-boss");
const coastCaveEvents = [
  "coast-cave-event-rockspring",
  "coast-cave-event-carvings",
  "coast-cave-event-altar"
].map((scenarioId) => catalog.find((scenario) => scenario.id === scenarioId));
assert.ok(coastCaveBoss, "Debug catalog 應包含海岸洞穴 Boss 場景");
assert.ok(coastCaveEvents.every(Boolean), "Debug catalog 應包含三個可重現的洞穴事件場景");
assert.equal(coastCaveBoss.defaultHpPercent, 50, "海岸洞穴場景應以扎營 50% HP 為預設");

const coastCaveBossSlots = getDebugScenarioBuildSlots("coast-cave-boss");
assert.equal(coastCaveBossSlots.length, 39, "洞穴 Boss Build 應包含海灘 16、扎營 8 與洞穴前 15 個位置");
assert.equal(coastCaveBossSlots.filter((slot) => slot.stage === "beach").length, 16);
assert.equal(coastCaveBossSlots.filter((slot) => slot.stage === "campRetained").length, 8);
assert.equal(coastCaveBossSlots.filter((slot) => slot.stage === "cave").length, 15);
assert.equal(coastCaveBossSlots.find((slot) => slot.id === "coast-camp-retained-1").battleVictoriesAfter, 0);
assert.equal(coastCaveBossSlots.find((slot) => slot.id === "coast-camp-retained-8").battleVictoriesAfter, 1);
assert.equal(coastCaveBossSlots.at(-1).battleVictoriesAfter, 0);
const coastCaveProfile = createDebugBuildProfile(coastCaveBossSlots, "mixed");
assert.equal(Object.keys(coastCaveProfile).length, 39, "洞穴快速 Build 應填滿海灘、扎營與洞穴位置");

const bossEntry6Heal = getDebugScenarioBuildSlots("goblin-boss", {
  routeEntryEncounter: 6,
  midChoice: "heal"
});
assert.equal(bossEntry6Heal.length, 14, "第 6 場前進 Route、回血中段的 Boss Build 應有 14 格");
assert.deepEqual(
  bossEntry6Heal.slice(0, 5).map((slot) => slot.label),
  ["森林 1", "森林 2", "森林 3", "森林 4", "森林 5"],
  "前 5 格應為森林 Blessing"
);
assert.equal(bossEntry6Heal[5].label, "林間營火", "森林前置後應是林間營火 Blessing");
assert.ok(
  bossEntry6Heal[5].blessings.length > 0 && bossEntry6Heal[5].blessings.every((blessing) => blessing.rarity === "uncommon"),
  "林間營火格只能選 uncommon Goblin Blessing"
);
assert.deepEqual(
  bossEntry6Heal.slice(-8).map((slot) => slot.label),
  Array.from({ length: 8 }, (_, index) => `營地第 ${index + 1} 場`),
  "Boss Build 應包含 Route 第 1～8 場 Blessing"
);
assert.equal(bossEntry6Heal[4].battleVictoriesAfter, 2, "最後森林 Blessing 到林間營火獎勵應隔兩次 Battle Victory");
assert.equal(bossEntry6Heal.at(-1).battleVictoriesAfter, 0, "Boss 前最後一格不應先消耗限場效果");

const bossEntry8Heal = getDebugScenarioBuildSlots("goblin-boss", {
  routeEntryEncounter: 8,
  midChoice: "heal"
});
assert.equal(bossEntry8Heal.length, 16, "第 8 場前進 Route、回血中段的 Boss Build 應有 16 格");
assert.deepEqual(
  bossEntry8Heal.slice(0, 7).map((slot) => slot.label),
  ["森林 1", "森林 2", "森林 3", "森林 4", "森林 5", "森林 6", "森林 7"],
  "第 8 場前進 Route 應有 7 個森林 Blessing 位置"
);

const bossEntry6Loot = getDebugScenarioBuildSlots("goblin-boss", {
  routeEntryEncounter: 6,
  midChoice: "blessing"
});
assert.equal(bossEntry6Loot.length, 15, "搜刮中段應比回血中段多一格 Blessing");
const route4Index = bossEntry6Loot.findIndex((slot) => slot.label === "營地第 4 場");
const supplyIndex = bossEntry6Loot.findIndex((slot) => slot.label === "補給額外");
const route5Index = bossEntry6Loot.findIndex((slot) => slot.label === "營地第 5 場");
assert.equal(supplyIndex, route4Index + 1, "補給 Blessing 應緊接第 4 場 Blessing");
assert.equal(route5Index, supplyIndex + 1, "第 5 場 Blessing 應接在補給 Blessing 後");
assert.equal(bossEntry6Loot[route4Index].battleVictoriesAfter, 0, "第 4 場 Blessing 到補給 Blessing 間不經 Battle Victory");
assert.equal(bossEntry6Loot[supplyIndex].battleVictoriesAfter, 1, "補給 Blessing 到第 5 場 Blessing 間應經一次 Battle Victory");

const routeStart = getDebugScenarioBuildSlots("goblin-route-start", {
  routeEntryEncounter: 6,
  midChoice: "heal"
});
assert.equal(routeStart.length, 6, "Route 第 1 場 Debug 應有 5 森林 + 1 林間營火 Blessing");
assert.equal(routeStart.at(-1).battleVictoriesAfter, 0, "林間營火 Blessing 應直接帶入 Route 第 1 場");

const midEvent = getDebugScenarioBuildSlots("goblin-mid-event", {
  routeEntryEncounter: 6,
  midChoice: "blessing"
});
assert.equal(midEvent.length, 10, "中段事件場景只應建立事件前已取得的 10 個 Blessing 位置");
assert.equal(midEvent.at(-1).label, "營地第 4 場", "中段事件最後取得位置應為營地第 4 場");
assert.equal(midEvent.at(-1).battleVictoriesAfter, 0, "進入中段事件前不應先消耗第 4 場 Blessing 的限場效果");

const profileIds = getDebugBuildProfiles().map((profile) => profile.id);
assert.deepEqual(
  profileIds,
  ["mixed", "attack", "crit", "debuff", "healing", "defense", "empty"],
  "快速 Build profile 應固定"
);

for (const profileId of profileIds.filter((id) => id !== "empty")) {
  const selections = createDebugBuildProfile(bossEntry6Loot, profileId);
  assert.equal(Object.keys(selections).length, bossEntry6Loot.length, `${profileId} profile 應填滿所有相容位置`);
  bossEntry6Loot.forEach((slot) => {
    assert.ok(
      slot.blessings.some((blessing) => blessing.id === selections[slot.id]),
      `${profileId} profile 的 ${slot.label} 必須選擇該位置允許的 Blessing`
    );
  });
}
assert.deepEqual(createDebugBuildProfile(bossEntry6Loot, "empty"), {}, "空白 profile 不應填入 Blessing");

const critSelections = createDebugBuildProfile(bossEntry6Loot, "crit");
const campfireSlot = bossEntry6Loot.find((slot) => slot.label === "林間營火");
const campfireCrit = campfireSlot.blessings.find((blessing) => blessing.id === critSelections[campfireSlot.id]);
assert.equal(campfireCrit.primaryFlow, "crit", "Crit profile 的林間營火格應優先選 uncommon Crit Blessing");

{
  const state = {
    run: 1,
    selectedHeroId: "adventurer",
    selectedRegionId: "beach",
    hero: null,
    runPreparation: null,
    encounterIndex: 0,
    blessingInstances: [],
    blessingInstanceSequence: 0,
    phase: "safe",
    campSelection: null
  };
  let battleOptions = null;
  const actions = createDebugScenarioActions({
    state,
    isDebugModeEnabled: () => true,
    prepareRunForRegion: (regionId, encounterIndex, options) => {
      state.selectedRegionId = regionId;
      state.encounterIndex = encounterIndex;
      state.hero = options.hero;
      state.blessingInstances = [];
      state.blessingInstanceSequence = 0;
    },
    currentRegion: () => regionDefinitions[state.selectedRegionId],
    beginBattleRuntime: (options) => {
      battleOptions = options;
    },
    addFixedLog() {},
    logCurrentEnemyGroupEncounter() {},
    addLog() {},
    render() {},
    enterSafeState() { state.phase = "safe"; },
    startEncounter() {},
    showPlainsStory() {},
    showRouteEnding() {},
    getRouteBossDefinition() { return null; },
    recordSelectedBossInRunStats() {},
    applySceneContext() {},
    consumeBattleLimitedEffects() {},
    openCampSelection() {
      state.phase = "campSelection";
      state.campSelection = { selectedInstanceIds: [] };
      return true;
    },
    runStartingFlees: 2,
    clampInteger: (value, min, max) => Math.max(min, Math.min(max, Math.floor(value)))
  });

  const message = actions.startScenario({
    scenarioId: "beach-multi-tether",
    characterId: "adventurer",
    hpPercent: 80,
    selections: []
  });
  assert.match(message, /敵群・礁釘繫索/);
  assert.equal(state.runPreparation.id, "reef-anchor-tether");
  assert.equal(battleOptions.enemies.length, 2);
  assert.ok(battleOptions.enemies.every((entry) => entry.attackScale === 1.55));
  assert.ok(battleOptions.enemies.every((entry) => entry.enemy.saltErosionChance === 0));

  actions.startScenario({
    scenarioId: "beach-salt-dressing",
    characterId: "adventurer",
    hpPercent: 80,
    selections: []
  });
  assert.equal(state.runPreparation.id, "freshwater-dressing");
  assert.equal(battleOptions.enemies[0].enemy.saltErosionChance, 1);
  assert.equal(battleOptions.enemies[0].enemy.paralysisChance, 0);

  const beachBossSlots = getDebugScenarioBuildSlots("beach-boss");
  const beachBossSelections = createDebugBuildProfile(beachBossSlots, "mixed");
  actions.startScenario({
    scenarioId: "beach-boss",
    characterId: "adventurer",
    hpPercent: 100,
    selections: Object.entries(beachBossSelections).map(([slotId, blessingId]) => ({ slotId, blessingId }))
  });
  assert.equal(state.hero.blessings.length, 15, "海灘 Boss Debug Build 應套用 15 個祝福");
  assert.equal(state.blessingInstances.length, 15, "海灘 Boss Debug Build 應建立 15 個祝福實例");

  const reportedArcherBlessingNames = [
    "潮視之瞳", "鰔落之刑", "怒濤反噬", "礪鹽淬鋒",
    "潮視之瞳", "藤壺硬皮", "藤壺硬皮", "藤壺硬皮",
    "趕海拾遺", "趕海拾遺", "礪鹽淬鋒", "怒濤反噬",
    "淬鹽傲骨", "藤壺硬皮", "藤壺硬皮", "怒濤反噬"
  ];
  const campSlots = getDebugScenarioBuildSlots("beach-camp-transition");
  const campSelections = campSlots.map((slot, index) => {
    const blessing = slot.blessings.find((entry) => entry.name === reportedArcherBlessingNames[index]);
    assert.ok(blessing, `扎營 Debug 第 ${index + 1} 格應能選擇：${reportedArcherBlessingNames[index]}`);
    return { slotId: slot.id, blessingId: blessing.id };
  });
  const campMessage = actions.startScenario({
    scenarioId: "beach-camp-transition",
    characterId: "archer",
    hpPercent: 50,
    selections: campSelections
  });
  assert.match(campMessage, /正式扎營 Sandbox/);
  assert.equal(state.phase, "campSelection", "弓箭手扎營 Debug 應開啟正式扎營選擇");
  assert.equal(state.hero.characterId, "archer");
  assert.equal(state.hero.blessings.length, 16, "弓箭手扎營 Debug 應帶入回報的完整 16 張祝福");
  assert.equal(state.blessingInstances.length, 16);
  assert.equal(state.runPreparation.id, "reef-anchor-tether");
  assert.equal(state.runPreparation.isEnhanced, true);
  assert.equal(state.runPreparation.name, "礁釘繫索・強化");
  assert.equal(state.coastSegmentCheckpoint.regionId, "beach");
  assert.equal(state.coastSegmentCheckpoint.encounterIndex, 16);

  actions.startScenario({
    scenarioId: "coast-cave-boss",
    characterId: "adventurer",
    hpPercent: 50,
    selections: Object.entries(coastCaveProfile).map(([slotId, blessingId]) => ({ slotId, blessingId }))
  });
  assert.equal(state.activeRouteId, "coast-cave", "洞穴 Sandbox 應啟用正式海岸洞穴 Route");
  assert.equal(state.routeEncounterIndex, 15, "洞穴 Boss Sandbox 應定位在第 16 場");
  assert.equal(state.hero.hp, Math.round(state.hero.maxHp * 0.5), "洞穴 Sandbox 應在扎營重建後以 50% HP 進場");
  assert.equal(state.hero.blessings.length, 23, "洞穴 Boss Sandbox 應只帶 8 張海灘祝福與 15 張洞穴前置祝福");
  assert.equal(state.blessingInstances.length, 23, "洞穴 Sandbox 應移除未保留的海灘祝福實例");

  const coastEventSlots = getDebugScenarioBuildSlots("coast-cave-event-carvings");
  const coastEventProfile = createDebugBuildProfile(coastEventSlots, "mixed");
  const eventMessage = actions.startScenario({
    scenarioId: "coast-cave-event-carvings",
    characterId: "adventurer",
    hpPercent: 18,
    selections: Object.entries(coastEventProfile).map(([slotId, blessingId]) => ({ slotId, blessingId }))
  });
  assert.match(eventMessage, /請按「繼續前進」/);
  assert.equal(state.phase, "safe", "洞穴事件 Sandbox 應停在可繼續前進的安全狀態");
  assert.deepEqual(state.eventSchedule, {
    eventId: "cave-tide-carvings",
    triggerBeforeEncounter: 9
  }, "洞穴事件 Sandbox 應固定排程指定事件");
  assert.equal(state.hero.hp, Math.round(state.hero.maxHp * 0.18), "洞穴事件 Sandbox 應允許以自訂低 HP 百分比驗證事件致死");
}

console.log("Debug scenario isolation tests passed.");
