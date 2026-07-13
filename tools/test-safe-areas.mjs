import assert from "node:assert/strict";

import { assertFacilityDefinitions, facilityDefinitions } from "../src/data/facilities.js";
import {
  ANPING_TOWN_SAFE_AREA_ID,
  assertSafeAreaDefinitions,
  getSafeAreaDefinition,
  getSafeAreaDefinitions,
  SAFE_AREA_KINDS,
  safeAreaDefinitions
} from "../src/data/safeAreas.js";

function makeSafeArea(overrides = {}) {
  return {
    id: "camp",
    kind: "camp",
    name: "營地",
    eyebrow: "營地",
    title: "營地標題",
    description: "營地描述",
    featureTitle: "營地功能",
    travelOrder: 10,
    travelDescription: "前往營地",
    visual: { background: { mobile: "camp.png", desktop: "camp.png" } },
    audio: { bgmId: "camp", ambientId: null },
    defaultUnlocked: true,
    unlockCondition: null,
    facilityIds: [],
    ...overrides
  };
}

assert.equal(assertFacilityDefinitions(facilityDefinitions), true);
assert.equal(assertSafeAreaDefinitions(safeAreaDefinitions, facilityDefinitions), true);
assert.equal(getSafeAreaDefinitions().length, 2);
assert.deepEqual(getSafeAreaDefinitions().map((safeArea) => safeArea.id), ["camp", ANPING_TOWN_SAFE_AREA_ID]);
assert.equal(getSafeAreaDefinition("camp").placesTitle, "營地去處");
assert.equal(getSafeAreaDefinition("camp").kind, SAFE_AREA_KINDS.CAMP);
assert.equal(getSafeAreaDefinition("camp").defaultUnlocked, true);
assert.equal(getSafeAreaDefinition("camp").travelOrder, 10);
assert.equal(getSafeAreaDefinition("camp").travelDescription, "回到熟悉的冒險據點");
assert.equal(getSafeAreaDefinition("camp").audio.bgmId, "camp");
assert.deepEqual(getSafeAreaDefinition("camp").facilityIds, ["traveling-merchant"]);
assert.equal(getSafeAreaDefinition(ANPING_TOWN_SAFE_AREA_ID).name, "安平鎮");
assert.equal(getSafeAreaDefinition(ANPING_TOWN_SAFE_AREA_ID).kind, SAFE_AREA_KINDS.TOWN);
assert.equal(getSafeAreaDefinition(ANPING_TOWN_SAFE_AREA_ID).defaultUnlocked, false);
assert.equal(getSafeAreaDefinition(ANPING_TOWN_SAFE_AREA_ID).travelOrder, 20);
assert.equal(getSafeAreaDefinition(ANPING_TOWN_SAFE_AREA_ID).travelDescription, "前往森林道路盡頭的城鎮");
assert.equal(getSafeAreaDefinition(ANPING_TOWN_SAFE_AREA_ID).audio.bgmId, "anping-town");
assert.equal(getSafeAreaDefinition(ANPING_TOWN_SAFE_AREA_ID).audio.ambientId, "anping-coast");
assert.deepEqual(getSafeAreaDefinition(ANPING_TOWN_SAFE_AREA_ID).facilityIds, []);
assert.deepEqual(getSafeAreaDefinition(ANPING_TOWN_SAFE_AREA_ID).unlockCondition, {
  type: "region-route-clear",
  regionId: "forest",
  routeClearKey: "main",
  minimumClears: 1
});
assert.equal(facilityDefinitions["traveling-merchant"].actionId, "merchant");

assert.throws(() => assertSafeAreaDefinitions({
  camp: makeSafeArea({ facilityIds: ["traveling-merchant", "traveling-merchant"] })
}, facilityDefinitions), /重複 facility id/);

assert.throws(() => assertSafeAreaDefinitions({
  camp: makeSafeArea({ facilityIds: ["missing"] })
}, facilityDefinitions), /未知 facility/);

assert.throws(() => assertSafeAreaDefinitions({
  camp: makeSafeArea({ kind: "village" })
}, facilityDefinitions), /kind 無效/);

assert.throws(() => assertSafeAreaDefinitions({
  camp: makeSafeArea({ travelOrder: -1 })
}, facilityDefinitions), /travelOrder 必須是非負整數/);

assert.throws(() => assertSafeAreaDefinitions({
  camp: makeSafeArea({ travelDescription: "" })
}, facilityDefinitions), /缺少 travelDescription/);

assert.throws(() => assertSafeAreaDefinitions({
  camp: makeSafeArea(),
  town: makeSafeArea({
    id: "town",
    kind: "town",
    defaultUnlocked: false,
    unlockCondition: { type: "region-route-clear", regionId: "forest", routeClearKey: "main", minimumClears: 0 }
  })
}, facilityDefinitions), /minimumClears 必須是正整數/);

assert.throws(() => assertFacilityDefinitions({
  merchant: { id: "wrong-id", name: "商人", actionId: "merchant" }
}), /id 不一致/);
assert.throws(() => assertFacilityDefinitions({
  merchant: { id: "merchant", name: "", actionId: "merchant" }
}), /缺少 name/);
assert.throws(() => assertFacilityDefinitions({
  merchant: { id: "merchant", name: "商人", actionId: "" }
}), /缺少 actionId/);

console.log("Safe area and facility definition tests passed.");
