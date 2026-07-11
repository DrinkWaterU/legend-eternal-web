import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { forestRegion } from "../src/data/regions/forest.js";
import { plainsRegion } from "../src/data/regions/plains.js";
import { createRegionDefinition } from "../src/data/regions/regionDefinition.js";

const [plainsAdapterSource, forestAdapterSource] = await Promise.all([
  readFile(new URL("../src/data/regions/plains.js", import.meta.url), "utf8"),
  readFile(new URL("../src/data/regions/forest.js", import.meta.url), "utf8")
]);

assert.match(plainsAdapterSource, /createRegionDefinition\(plainsData\)/);
assert.match(forestAdapterSource, /createRegionDefinition\(forestData\)/);
assert.doesNotMatch(
  plainsAdapterSource,
  /export const plains(?:Enemies|Elites|Boss|EncounterPlan|Blessings)/,
  "平原 Adapter 不應保留無引用的舊具名 exports"
);
assert.doesNotMatch(
  forestAdapterSource,
  /export const forest(?:Enemies|Elites|Bosses|EncounterPlan|Blessings)/,
  "森林 Adapter 不應保留無引用的舊具名 exports"
);

assert.equal(plainsRegion.id, "plains");
assert.equal(plainsRegion.encounterCount, plainsRegion.encounterPlan.length);
assert.equal(plainsRegion.boss?.id, "boar-king");
assert.equal(plainsRegion.bossName, plainsRegion.boss.name);
assert.ok(plainsRegion.clearStory, "平原 clearStory 必須保留");

assert.equal(forestRegion.id, "forest");
assert.equal(forestRegion.encounterCount, forestRegion.encounterPlan.length);
assert.equal(forestRegion.boss, forestRegion.bosses[0], "多首領地區需保留第一名首領相容別名");
assert.equal(
  forestRegion.bossName,
  forestRegion.bosses.map((boss) => boss.name).join(" / ")
);
assert.ok(forestRegion.events, "森林 events 必須保留");
assert.ok(forestRegion.scaling, "森林 scaling 必須保留");

{
  const source = {
    id: "synthetic",
    encounterPlan: [{ type: "normal" }],
    bosses: [{ id: "boss-a", name: "首領甲" }, { id: "boss-b", name: "首領乙" }],
    futureTownUnlock: { safeAreaId: "town" },
    traits: null,
    preparations: null
  };
  const originalKeys = Object.keys(source);
  const definition = createRegionDefinition(source);

  assert.deepEqual(Object.keys(source), originalKeys, "Helper 不得修改來源資料物件");
  assert.deepEqual(definition.futureTownUnlock, { safeAreaId: "town" }, "未知欄位必須保留");
  assert.equal(definition.encounterCount, 1);
  assert.equal(definition.boss, source.bosses[0]);
  assert.equal(definition.bossName, "首領甲 / 首領乙");
  assert.deepEqual(definition.traits, []);
  assert.deepEqual(definition.preparations, []);
}

{
  const first = createRegionDefinition({ id: "first" });
  const second = createRegionDefinition({ id: "second" });

  assert.notEqual(first.traits, second.traits, "缺省 traits 不得共用陣列參照");
  assert.notEqual(first.preparations, second.preparations, "缺省 preparations 不得共用陣列參照");
  assert.notEqual(first.encounterPlan, second.encounterPlan, "缺省 encounterPlan 不得共用陣列參照");
  assert.equal(first.encounterCount, 0);
  assert.equal(first.bossName, "");
  assert.equal(first.boss, null);
}

{
  const singleBoss = { id: "single-boss", name: "單一首領" };
  const definition = createRegionDefinition({
    id: "single",
    boss: singleBoss,
    encounterPlan: []
  });

  assert.equal(definition.boss, singleBoss);
  assert.equal(definition.bossName, "單一首領");
}

assert.throws(
  () => createRegionDefinition(null),
  /需要有效的資料物件/
);
assert.throws(
  () => createRegionDefinition([]),
  /需要有效的資料物件/
);

console.log("Region definition tests passed.");
