import assert from "node:assert/strict";

import { assertFacilityDefinitions, facilityDefinitions } from "../src/data/facilities.js";
import { assertSafeAreaDefinitions, getSafeAreaDefinition, safeAreaDefinitions } from "../src/data/safeAreas.js";

assert.equal(assertFacilityDefinitions(facilityDefinitions), true);
assert.equal(assertSafeAreaDefinitions(safeAreaDefinitions, facilityDefinitions), true);
assert.equal(getSafeAreaDefinition("camp").placesTitle, "營地去處");
assert.deepEqual(getSafeAreaDefinition("camp").facilityIds, ["traveling-merchant"]);
assert.equal(facilityDefinitions["traveling-merchant"].actionId, "merchant");

assert.throws(() => assertSafeAreaDefinitions({
  camp: { id: "camp", facilityIds: ["traveling-merchant", "traveling-merchant"] }
}, facilityDefinitions), /重複 facility id/);

assert.throws(() => assertSafeAreaDefinitions({
  camp: { id: "camp", facilityIds: ["missing"] }
}, facilityDefinitions), /未知 facility/);

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
