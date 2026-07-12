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

assert.equal(assertFacilityDefinitions(facilityDefinitions), true);
assert.equal(assertSafeAreaDefinitions(safeAreaDefinitions, facilityDefinitions), true);
assert.equal(getSafeAreaDefinitions().length, 2);
assert.equal(getSafeAreaDefinition("camp").placesTitle, "營地去處");
assert.equal(getSafeAreaDefinition("camp").kind, SAFE_AREA_KINDS.CAMP);
assert.equal(getSafeAreaDefinition("camp").defaultUnlocked, true);
assert.deepEqual(getSafeAreaDefinition("camp").facilityIds, ["traveling-merchant"]);
assert.equal(getSafeAreaDefinition(ANPING_TOWN_SAFE_AREA_ID).name, "安平鎮");
assert.equal(getSafeAreaDefinition(ANPING_TOWN_SAFE_AREA_ID).kind, SAFE_AREA_KINDS.TOWN);
assert.equal(getSafeAreaDefinition(ANPING_TOWN_SAFE_AREA_ID).defaultUnlocked, false);
assert.deepEqual(getSafeAreaDefinition(ANPING_TOWN_SAFE_AREA_ID).facilityIds, []);
assert.deepEqual(getSafeAreaDefinition(ANPING_TOWN_SAFE_AREA_ID).unlockCondition, {
  type: "region-route-clear",
  regionId: "forest",
  routeClearKey: "main",
  minimumClears: 1
});
assert.equal(facilityDefinitions["traveling-merchant"].actionId, "merchant");

assert.throws(() => assertSafeAreaDefinitions({
  camp: { id: "camp", kind: "camp", name: "營地", defaultUnlocked: true, facilityIds: ["traveling-merchant", "traveling-merchant"] }
}, facilityDefinitions), /重複 facility id/);

assert.throws(() => assertSafeAreaDefinitions({
  camp: { id: "camp", kind: "camp", name: "營地", defaultUnlocked: true, facilityIds: ["missing"] }
}, facilityDefinitions), /未知 facility/);

assert.throws(() => assertSafeAreaDefinitions({
  camp: { id: "camp", kind: "village", name: "營地", defaultUnlocked: true, facilityIds: [] }
}, facilityDefinitions), /kind 無效/);

assert.throws(() => assertSafeAreaDefinitions({
  camp: { id: "camp", kind: "camp", name: "營地", defaultUnlocked: true, facilityIds: [] },
  town: {
    id: "town",
    kind: "town",
    name: "城鎮",
    defaultUnlocked: false,
    unlockCondition: { type: "region-route-clear", regionId: "forest", routeClearKey: "main", minimumClears: 0 },
    facilityIds: []
  }
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
