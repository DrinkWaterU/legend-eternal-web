import assert from "node:assert/strict";

import {
  createSeededRandom,
  encounterSortValue,
  formatPercent,
  parseRoundCount,
  seedFromText,
  weightedPick,
  withSeed
} from "./model-test-helpers.mjs";

const first = createSeededRandom(12345);
const second = createSeededRandom(12345);
assert.deepEqual(
  [first(), first(), first()],
  [second(), second(), second()],
  "相同種子必須產生相同亂數序列"
);

assert.equal(weightedPick(["a", "b"], (item) => item === "a" ? 1 : 3, () => 0), "a");
assert.equal(weightedPick(["a", "b"], (item) => item === "a" ? 1 : 3, () => 0.99), "b");
assert.equal(weightedPick(["a", "b"], () => 0, () => 0.5), "a");

const originalRandom = Math.random;
assert.throws(() => withSeed(7, () => { throw new Error("expected"); }), /expected/);
assert.equal(Math.random, originalRandom, "withSeed 發生錯誤後也必須回復 Math.random");

assert.equal(seedFromText("coast"), seedFromText("coast"));
assert.notEqual(seedFromText("coast"), seedFromText("cave"));
assert.equal(parseRoundCount("32", 10), 32);
assert.equal(parseRoundCount("0", 10), 10);
assert.equal(parseRoundCount("invalid", 10), 10);
assert.equal(formatPercent(0.375), "37.50%");
assert.equal(encounterSortValue("boss-16"), 16);
assert.equal(encounterSortValue("boss"), Number.MAX_SAFE_INTEGER);

console.log("Model test RNG, selection, parsing, and formatting helpers passed.");
