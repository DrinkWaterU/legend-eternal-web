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
    selectedHeroId: "adventurer",
    selectedRegionId: "beach",
    hero: null,
    runPreparation: null,
    encounterIndex: 0
  };
  let battleOptions = null;
  const actions = createDebugScenarioActions({
    state,
    isDebugModeEnabled: () => true,
    prepareRunForRegion: (regionId, encounterIndex, options) => {
      state.selectedRegionId = regionId;
      state.encounterIndex = encounterIndex;
      state.hero = options.hero;
    },
    currentRegion: () => regionDefinitions[state.selectedRegionId],
    beginBattleRuntime: (options) => {
      battleOptions = options;
    },
    addFixedLog() {},
    logCurrentEnemyGroupEncounter() {},
    addLog() {},
    render() {},
    enterSafeState() {},
    startEncounter() {},
    showPlainsStory() {},
    showRouteEnding() {},
    getRouteBossDefinition() { return null; },
    recordSelectedBossInRunStats() {},
    applySceneContext() {},
    consumeBattleLimitedEffects() {},
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
}

console.log("Debug scenario isolation tests passed.");
