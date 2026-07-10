import assert from "node:assert/strict";

import { sellMaterial, spendGold } from "../src/core/commerce.js";
import { SAVE_SCHEMA_VERSION } from "../src/config.js";
import { migrateSave } from "../src/core/storage.js";
import { materialDefinitions } from "../src/data/materials.js";

const legacySave = {
  schemaVersion: SAVE_SCHEMA_VERSION,
  gameVersion: "v0.2.3.4-alpha",
  inventory: {
    gold: 37,
    materials: {
      slime_gel: { id: "slime_gel", name: "史萊姆凝膠", quantity: 12 },
      poison_sac: { id: "poison_sac", name: "毒囊", quantity: 3 }
    }
  },
  settings: {
    selectedRegionId: "forest",
    selectedCharacterId: "adventurer",
    musicEnabled: true,
    musicVolume: 0.35
  },
  storyFlags: {
    phoenixBlessingUnlocked: true
  }
};

const migrated = migrateSave(structuredClone(legacySave));
assert.equal(migrated.gameVersion, "v0.2.4.1-alpha");
assert.equal(migrated.inventory.gold, 37);
assert.equal(migrated.inventory.materials.slime_gel.quantity, 12);
assert.equal(migrated.inventory.materials.poison_sac.quantity, 3);
assert.equal(migrated.settings.selectedRegionId, "forest");
assert.equal("selectedPreparationId" in migrated.settings, false);
assert.equal("safeAreaId" in migrated.settings, false);
assert.equal("runPreparation" in migrated, false);

sellMaterial({
  inventory: migrated.inventory,
  materialDefinitions,
  materialId: "slime_gel",
  quantity: 2
});
assert.equal(migrated.inventory.gold, 39);
assert.equal(migrated.inventory.materials.slime_gel.quantity, 10);

const afterSaleReload = migrateSave(structuredClone(migrated));
assert.equal(afterSaleReload.inventory.gold, 39);
assert.equal(afterSaleReload.inventory.materials.slime_gel.quantity, 10);

spendGold(afterSaleReload.inventory, 8);
assert.equal(afterSaleReload.inventory.gold, 31);
const afterPreparationPaymentReload = migrateSave(structuredClone(afterSaleReload));
assert.equal(afterPreparationPaymentReload.inventory.gold, 31);
assert.equal(afterPreparationPaymentReload.inventory.materials.poison_sac.quantity, 3);

console.log("v0.2.4.0 save compatibility and economy persistence tests passed.");
