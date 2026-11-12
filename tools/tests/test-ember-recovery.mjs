// Ember recovery: a pre-phoenix defeat still resets to Lv.1, but experience is doubled
// until the character climbs back to the highest level it lost. Plus plains elite EXP.
import assert from "node:assert/strict";
import {
  EMBER_EXP_MULTIPLIER,
  applyEmberExpBonus,
  describeEmberRecovery,
  getEmberRecoveryLevel,
  rememberEmberLevel,
  settleEmberRecovery
} from "../../src/core/emberRecovery.js";
import { createDefaultSave } from "../../src/core/saveDefaults.js";
import { migrateSaveData } from "../../src/core/saveMigrations.js";
import { regionDefinitions } from "../../src/data/regions/index.js";
import { templates } from "../../src/data/templates.js";

// Reset at Lv.8 remembers 8; the bonus applies while below it.
const progress = { level: 8, exp: 120, emberLevel: 0 };
assert.equal(rememberEmberLevel(progress), 8);
Object.assign(progress, { level: 1, exp: 0 });
assert.equal(getEmberRecoveryLevel(progress), 8);
assert.deepEqual(applyEmberExpBonus(9, progress), { total: 9 * EMBER_EXP_MULTIPLIER, bonus: 9 });
assert.equal(describeEmberRecovery(progress), `回到 Lv.8 之前，獲得的經驗 ×${EMBER_EXP_MULTIPLIER}。`);

// A later, lower defeat does not lower the remembered level.
progress.level = 5;
rememberEmberLevel(progress);
assert.equal(progress.emberLevel, 8, "keeps the highest level ever lost");

// Reaching the level ends recovery once, and the bonus stops.
progress.level = 8;
assert.equal(settleEmberRecovery(progress), true);
assert.equal(progress.emberLevel, 0);
assert.deepEqual(applyEmberExpBonus(9, progress), { total: 9, bonus: 0 });
assert.equal(settleEmberRecovery(progress), false, "no repeated recovery message");
assert.equal(describeEmberRecovery(progress), "");

// Dying at Lv.1 leaves nothing to recover and never logs a recovery.
const fresh = { level: 1, exp: 10, emberLevel: 0 };
rememberEmberLevel(fresh);
assert.equal(fresh.emberLevel, 0);
assert.equal(settleEmberRecovery(fresh), false);
assert.deepEqual(applyEmberExpBonus(9, fresh), { total: 9, bonus: 0 }, "first-time growth is unchanged");

// Save defaults and migration keep the field.
const save = createDefaultSave();
assert.equal(save.progression.characters.adventurer.emberLevel, 0);
save.progression.characters.adventurer.level = 3;
save.progression.characters.adventurer.emberLevel = 9;
const migrated = migrateSaveData(JSON.parse(JSON.stringify(save)));
assert.equal(migrated.progression.characters.adventurer.emberLevel, 9, "ember level survives save/load");

// Player-facing text names the bonus explicitly.
assert.match(templates.expGainEmber, /灰燼回復 \+\{bonus\}/);
assert.match(templates.emberRecovered, /\{level\}/);

// Plains elites give more EXP so the Lv.7–10 stretch is shorter (pre-boss run ≈ 124 EXP).
const plains = regionDefinitions.plains;
const avg = (list) => list.reduce((sum, enemy) => sum + enemy.expReward, 0) / list.length;
const preBossRun = 5 * avg(plains.enemies) + 2 * avg(plains.elites);
assert.ok(preBossRun >= 120 && preBossRun <= 130, `pre-boss run EXP ${preBossRun}`);

console.log("Ember recovery tests passed.");
