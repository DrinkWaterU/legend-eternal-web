import assert from "node:assert/strict";

import { applyEnemyDefeatReactions } from "../src/core/enemyReactions.js";
import { createRuntimeEnemyGroup, restoreRuntimeEnemyGroup } from "../src/core/enemyGroups.js";
import { canFleeBattle, getBattleFleeChance } from "../src/core/fleeRules.js";
import { canCompleteRouteEncounter } from "../src/core/routeRules.js";
import { migrateSave } from "../src/core/storage.js";
import { getBlessingPool } from "../src/data/blessings/index.js";
import { getEnemyDefinition } from "../src/data/enemies/index.js";
import { getEventDefinition } from "../src/data/events/index.js";
import { materialDefinitions } from "../src/data/materials.js";
import { musicDefinitions } from "../src/data/music.js";
import { getRouteDefinition, getRouteGroup, routeDefinitions } from "../src/data/routes/index.js";
import { createSaveTransferCode, parseSaveTransferCode } from "../src/ui/saveTools.js";

const route = getRouteDefinition("goblin-camp");
assert.ok(route, "哥布林營地 Route 應存在");
assert.equal(Object.keys(routeDefinitions).length, 1, "第一版應只有一條獨立 Route definition");
assert.equal(route.regionId, "forest");
assert.equal(route.clearSourceId, "goblinCamp");
assert.equal(route.blessingPoolId, "goblin");
assert.equal(getBlessingPool(route.blessingPoolId).blessings.length, 12);
assert.equal(route.encounterPlan.length, 9, "哥布林營地固定 9 場");
assert.deepEqual(route.encounterPlan.map((entry) => entry.type), [
  "normal", "normal", "normal", "elite", "normal", "normal", "elite", "normal", "boss"
]);
assert.deepEqual(route.visual.backgroundStages.map((stage) => [stage.fromEncounter, stage.toEncounter]), [[1, 4], [5, 9]]);
assert.equal(route.ending.title, "營地深處");
assert.equal(route.ending.pages.length, 4, "Route 應直接持有四頁 Ending content");
assert.equal(route.ending.pages.at(-1).lines.at(-1).role, "ending");
assert.equal(route.repeatEnding.title, "再次沉寂");
assert.equal(route.repeatEnding.pages.length, 1, "重複通關應使用單頁掃蕩結尾");
assert.equal(route.repeatEnding.pages[0].tone, "embers");
assert.equal(route.repeatEnding.pages[0].lines.at(-1).role, "ending");
assert.match(route.repeatEnding.pages[0].lines[1].text, /牢籠仍然空著/);
assert.equal(route.events.scheduleChance, 1);
assert.deepEqual(route.events.triggerBeforeEncounters, [5]);
assert.ok(getEventDefinition("goblin-looted-supplies"), "Route 中段事件應註冊到通用事件 registry");

const groupIds = route.groups.map((group) => group.id);
assert.equal(new Set(groupIds).size, groupIds.length, "Route group id 必須唯一");
route.groups.forEach((group) => {
  group.members.forEach((member) => {
    assert.ok(getEnemyDefinition(member.enemyId), `${group.id} enemyId 應解析：${member.enemyId}`);
    assert.ok(member.statScale > 0, `${group.id} statScale 必須 > 0`);
    assert.ok(Number.isFinite(member.rewardScale) && member.rewardScale >= 0, `${group.id} 必須明寫 rewardScale`);
  });
});

const expectedGroupMembers = [
  ["goblin-warrior", "goblin-slinger"],
  ["goblin-warrior", "goblin-blade"],
  ["goblin-warrior", "goblin-poison-dart"],
  ["goblin-shield-guard", "goblin-blade", "goblin-slinger"],
  ["goblin-warrior", "goblin-blade"],
  ["goblin-shield-guard", "goblin-poison-dart"],
  ["goblin-warrior", "goblin-blade", "goblin-blade"],
  ["goblin-shield-guard", "goblin-poison-dart", "goblin-slinger"],
  ["goblin-bloodbone-shaman", "goblin-shield-guard", "goblin-poison-dart"]
];
route.encounterPlan.forEach((entry, index) => {
  assert.deepEqual(
    getRouteGroup(route, entry.groupId).members.map((member) => member.enemyId),
    expectedGroupMembers[index],
    `第 ${index + 1} 場敵群應固定`
  );
});

const routeExp = route.encounterPlan.reduce((total, entry) => {
  const group = getRouteGroup(route, entry.groupId);
  return total + group.members.reduce((groupTotal, member) => {
    const enemy = getEnemyDefinition(member.enemyId);
    return groupTotal + Math.round(enemy.expReward * member.rewardScale);
  }, 0);
}, 0);
assert.equal(routeExp, 888, "哥布林營地 9 場 EXP 應合計 888");

const bossGroup = getRouteGroup(route, route.encounterPlan.at(-1).groupId);
assert.deepEqual(bossGroup.members.map((member) => member.statScale), [0.95, 0.45, 0.4]);
assert.deepEqual(bossGroup.members.map((member) => member.rewardScale), [1, 0.25, 0.25]);
assert.equal(bossGroup.members.filter((member) => getEnemyDefinition(member.enemyId).kind === "首領").length, 1);

["goblin_scrap", "oily_leather_cord", "crude_venom", "bloodbone_charm"].forEach((materialId) => {
  assert.ok(materialDefinitions[materialId], `哥布林素材應存在：${materialId}`);
});
assert.equal(materialDefinitions.goblin_scrap.sellPrice, 2);
assert.equal(materialDefinitions.oily_leather_cord.sellPrice, 2);
assert.equal(materialDefinitions.crude_venom.sellPrice, 5);
assert.equal(materialDefinitions.bloodbone_charm.sellPrice, 14);
assert.equal(musicDefinitions["goblin-camp"].src, "assets/audio/bgm/goblin-camp.mp3");
assert.equal(musicDefinitions["goblin-camp"].gain, 1);

const shamanDefinition = structuredClone(getEnemyDefinition("goblin-bloodbone-shaman"));
const warriorDefinition = structuredClone(getEnemyDefinition("goblin-warrior"));
const poisonDefinition = structuredClone(getEnemyDefinition("goblin-poison-dart"));
const shieldDefinition = structuredClone(getEnemyDefinition("goblin-shield-guard"));

const shaman = { ...shamanDefinition, hp: 200 };
const defeatedWarrior = { ...warriorDefinition, hp: 0 };
const firstSacrifice = applyEnemyDefeatReactions({ enemies: [shaman, defeatedWarrior], defeatedEnemy: defeatedWarrior });
assert.equal(firstSacrifice.length, 1, "存活薩滿應對哥布林死亡觸發一次血祭");
assert.equal(shaman.attack, 29);
assert.equal(shaman.critChance, 0.1);
assert.equal(shaman.hp, 236, "血祭應恢復最大生命 10%");
assert.equal(firstSacrifice[0].healed, 36);

const defeatedPoison = { ...poisonDefinition, hp: 0 };
applyEnemyDefeatReactions({ enemies: [shaman, defeatedWarrior, defeatedPoison], defeatedEnemy: defeatedPoison });
assert.equal(shaman.attack, 32, "第二名部下死亡應再累積一次 ATK +3");
assert.equal(shaman.critChance, 0.13, "第二名部下死亡應再累積一次 Crit +3%");
assert.equal(shaman.hp, 272, "第二次血祭應再次恢復最大生命 10%");

const deadShaman = { ...shamanDefinition, hp: 0 };
const sameBatchShield = { ...shieldDefinition, hp: 0 };
assert.equal(
  applyEnemyDefeatReactions({ enemies: [deadShaman, sameBatchShield], defeatedEnemy: sameBatchShield }).length,
  0,
  "薩滿與部下同批死亡時，hp=0 的薩滿不得觸發血祭"
);

const twoMinionShaman = { ...shamanDefinition, hp: 200 };
const minionA = { ...poisonDefinition, hp: 0 };
const minionB = { ...shieldDefinition, hp: 0 };
const sameBatchEnemies = [twoMinionShaman, minionA, minionB];
applyEnemyDefeatReactions({ enemies: sameBatchEnemies, defeatedEnemy: minionA });
applyEnemyDefeatReactions({ enemies: sameBatchEnemies, defeatedEnemy: minionB });
assert.equal(twoMinionShaman.attack, 32, "兩名部下同批死亡、薩滿仍活著時應依死亡結算順序觸發兩次");

const runtimeBossGroup = createRuntimeEnemyGroup(bossGroup.members.map((member) => ({
  enemy: getEnemyDefinition(member.enemyId),
  statScale: member.statScale,
  rewardScale: member.rewardScale
})));
const runtimeShaman = runtimeBossGroup.find((enemy) => enemy.id === "goblin-bloodbone-shaman");
runtimeShaman.attack += 3;
runtimeShaman.critChance += 0.03;
runtimeShaman.hp -= 10;
const restoredBossGroup = restoreRuntimeEnemyGroup(runtimeBossGroup);
const restoredShaman = restoredBossGroup.find((enemy) => enemy.id === "goblin-bloodbone-shaman");
assert.equal(restoredShaman.attack, runtimeShaman.attack, "pending threat restore 不得重複 statScale 或重播血祭");
assert.equal(restoredShaman.critChance, runtimeShaman.critChance);
assert.equal(restoredShaman.hp, runtimeShaman.hp);

assert.equal(canFleeBattle("boss"), false, "Boss encounter 必須由 battle-level context 全場禁逃");
assert.equal(canFleeBattle("elite"), true);
assert.equal(getBattleFleeChance({
  encounterType: "elite",
  threatKind: "普通",
  normalChance: 0.8,
  eliteChance: 0.55
}), 0.55, "Route elite 即使成員 kind 都是普通，也必須使用精英逃跑率");
assert.equal(getBattleFleeChance({
  encounterType: "normal",
  threatKind: "精英",
  normalChance: 0.8,
  eliteChance: 0.55
}), 0.55, "舊有精英敵人仍應使用精英逃跑率");
assert.equal(getBattleFleeChance({
  encounterType: "counter",
  threatKind: "普通",
  normalChance: 0.8,
  eliteChance: 0.55
}), 0.8, "反制戰應依反制敵人使用普通逃跑率，不繼承原精英 encounter type");
assert.equal(getBattleFleeChance({
  encounterType: "boss",
  threatKind: "普通",
  normalChance: 0.8,
  eliteChance: 0.55
}), 0, "Boss 本體先死後 threat kind 降為普通，也不得恢復逃跑");

assert.equal(canCompleteRouteEncounter({
  route,
  routeEncounterIndex: 9,
  battleEncounterType: "boss",
  enemies: [{ ...shieldDefinition, hp: 10 }]
}), false, "Boss 本體先死但親衛仍存活時不得 Route clear");
assert.equal(canCompleteRouteEncounter({
  route,
  routeEncounterIndex: 9,
  battleEncounterType: "boss",
  enemies: []
}), true, "最終 Boss encounter 完成且敵群全滅後才可 Route clear");
assert.equal(canCompleteRouteEncounter({
  route,
  routeEncounterIndex: 8,
  battleEncounterType: "boss",
  enemies: []
}), false, "未完成第 9 場不得 Route clear");

const migratedSchema5 = migrateSave({
  schemaVersion: 5,
  statistics: {
    regions: {
      forest: { clears: 3, routeClears: { main: 1, goblinCamp: 2 } }
    }
  }
});
assert.equal(migratedSchema5.statistics.regions.forest.routeClears.main, 3, "schema5 既有 forest clears 應遷移到 main");
assert.equal(migratedSchema5.statistics.regions.forest.routeClears.goblinCamp, 0);
assert.equal(migratedSchema5.storyFlags.archerRescued, false);

const schema6 = migrateSave({
  schemaVersion: 6,
  storyFlags: { archerRescued: true },
  statistics: {
    regions: {
      forest: { clears: 3, routeClears: { main: 1, goblinCamp: 2 } }
    }
  }
});
assert.deepEqual(schema6.statistics.regions.forest.routeClears, { main: 1, goblinCamp: 2 });
assert.equal(schema6.storyFlags.archerRescued, true);

const saveCode = await createSaveTransferCode(schema6, "v0.2.3.3-alpha");
const parsedSchema6 = (await parseSaveTransferCode(saveCode)).save;
const roundTrip = migrateSave(parsedSchema6);
assert.deepEqual(roundTrip.statistics.regions.forest.routeClears, { main: 1, goblinCamp: 2 }, "schema6 export/import roundtrip 應保留 Route 分布");
assert.equal(roundTrip.storyFlags.archerRescued, true, "schema6 export/import roundtrip 應保留 archerRescued");

console.log("Route 核心隔離驗證：全部通過");
