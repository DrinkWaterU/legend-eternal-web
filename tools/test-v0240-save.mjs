import assert from "node:assert/strict";

import { sellMaterial, spendGold } from "../src/core/commerce.js";
import { GAME_VERSION, SAVE_SCHEMA_VERSION } from "../src/config.js";
import { createDefaultSave, migrateSave, saveGame } from "../src/core/storage.js";
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
assert.equal(migrated.gameVersion, GAME_VERSION);
assert.equal(migrated.inventory.gold, 37);
assert.equal(migrated.inventory.materials.slime_gel.quantity, 12);
assert.equal(migrated.inventory.materials.poison_sac.quantity, 3);
assert.equal(migrated.settings.selectedRegionId, "forest");
assert.equal("selectedPreparationId" in migrated.settings, false);
assert.equal("safeAreaId" in migrated.settings, false);
assert.equal(migrated.settings.currentSafeAreaId, "camp");
assert.equal(migrated.progression.safeAreas.camp.unlocked, true);
assert.equal(migrated.progression.safeAreas["anping-town"].unlocked, false);
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


const malformedSave = {
  schemaVersion: SAVE_SCHEMA_VERSION,
  gameVersion: "external-test",
  inventory: {
    gold: 12.5,
    materials: {
      slime_gel: { id: "slime_gel", name: "史萊姆凝膠", quantity: 4 },
      poison_sac: { id: "poison_sac", name: "毒囊", quantity: 2.5 },
      unsafe: { id: "unsafe", name: "異常素材", quantity: Number.MAX_SAFE_INTEGER + 1 }
    }
  },
  statistics: {
    totalRuns: 3.5,
    totalDefeats: -1,
    totalClears: Number.POSITIVE_INFINITY,
    highestRunLevel: 7.25,
    regions: {
      forest: {
        runs: 9.5,
        clears: 2,
        retreats: 1.5,
        bestEncounter: Number.MAX_SAFE_INTEGER + 1,
        routeClears: {
          main: 1.5,
          goblinCamp: 2
        }
      }
    },
    characters: {
      adventurer: {
        runs: 5.5,
        clears: 2,
        retreats: -1,
        highestRunLevel: Number.NaN
      }
    }
  },
  progression: {
    regions: {
      forest: { unlocked: true }
    },
    characters: {
      adventurer: {
        unlocked: true,
        level: 8.5,
        exp: Number.MAX_SAFE_INTEGER + 1,
        learnedSkills: []
      }
    }
  },
  settings: {
    selectedRegionId: "forest",
    selectedCharacterId: "adventurer"
  }
};

const normalizedMalformedSave = migrateSave(structuredClone(malformedSave));
assert.equal(normalizedMalformedSave.inventory.gold, 0, "小數金幣應回退為安全整數");
assert.equal(normalizedMalformedSave.inventory.materials.slime_gel.quantity, 4);
assert.equal("poison_sac" in normalizedMalformedSave.inventory.materials, false, "小數素材數量不應進入 inventory");
assert.equal("unsafe" in normalizedMalformedSave.inventory.materials, false, "unsafe integer 素材數量不應進入 inventory");
assert.equal(normalizedMalformedSave.statistics.totalRuns, 0);
assert.equal(normalizedMalformedSave.statistics.totalDefeats, 0);
assert.equal(normalizedMalformedSave.statistics.totalClears, 0);
assert.equal(normalizedMalformedSave.statistics.highestRunLevel, 1);
assert.equal(normalizedMalformedSave.statistics.regions.forest.runs, 0);
assert.equal(normalizedMalformedSave.statistics.regions.forest.clears, 2);
assert.equal(normalizedMalformedSave.statistics.regions.forest.retreats, 0);
assert.equal(normalizedMalformedSave.statistics.regions.forest.bestEncounter, 0);
assert.equal(normalizedMalformedSave.statistics.regions.forest.routeClears.main, 0);
assert.equal(normalizedMalformedSave.statistics.regions.forest.routeClears.goblinCamp, 2);
assert.equal(normalizedMalformedSave.progression.characters.adventurer.level, 1);
assert.equal(normalizedMalformedSave.progression.characters.adventurer.exp, 0);

sellMaterial({
  inventory: normalizedMalformedSave.inventory,
  materialDefinitions,
  materialId: "slime_gel",
  quantity: 1
});
assert.equal(normalizedMalformedSave.inventory.gold, 1, "正規化後應能正常出售素材");
assert.equal(normalizedMalformedSave.inventory.materials.slime_gel.quantity, 3);
spendGold(normalizedMalformedSave.inventory, 1);
assert.equal(normalizedMalformedSave.inventory.gold, 0, "正規化後應能正常支付金幣");


const originalLocalStorage = globalThis.localStorage;
globalThis.localStorage = {
  setItem() {},
  getItem() { return null; },
  removeItem() {}
};
assert.equal(saveGame(createDefaultSave()), true, "保存成功時應回傳 true");
globalThis.localStorage = {
  setItem() { throw new Error("blocked"); },
  getItem() { return null; },
  removeItem() {}
};
let saveErrorCalled = false;
const failedSave = createDefaultSave();
failedSave.schemaVersion = 6;
failedSave.gameVersion = "v0.2.4.3-alpha";
failedSave.profile.updatedAt = "2026-01-01T00:00:00.000Z";
assert.equal(saveGame(failedSave, { onError: () => { saveErrorCalled = true; } }), false, "保存失敗時應回傳 false");
assert.equal(saveErrorCalled, true);
assert.equal(failedSave.schemaVersion, 6, "保存失敗時不應留下新 Schema metadata");
assert.equal(failedSave.gameVersion, "v0.2.4.3-alpha", "保存失敗時不應留下新版本 metadata");
assert.equal(failedSave.profile.updatedAt, "2026-01-01T00:00:00.000Z", "保存失敗時應恢復 updatedAt");
if (originalLocalStorage === undefined) {
  delete globalThis.localStorage;
} else {
  globalThis.localStorage = originalLocalStorage;
}

console.log("v0.2.4.0 save compatibility and economy persistence tests passed.");
