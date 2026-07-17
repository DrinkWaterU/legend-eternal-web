import assert from "node:assert/strict";

import {
  applyEquippedWeapon,
  canCharacterEquipWeapon,
  equipWeapon,
  getOwnedCompatibleWeapons,
  normalizeCharacterEquipment,
  normalizeWeaponInventory,
  resolveEquippedWeapon,
  unequipWeapon
} from "../src/core/equipment.js";
import { buildHeroFromProgression } from "../src/core/progression.js";
import { createDefaultSave, migrateSave } from "../src/core/storage.js";
import { SAVE_SCHEMA_VERSION } from "../src/config.js";
import { characterDefinitions } from "../src/data/characters/index.js";
import { materialDefinitions } from "../src/data/materials.js";
import {
  assertWeaponDefinitions,
  getWeaponRarityDefinition,
  weaponDefinitions,
  weaponRarityDefinitions
} from "../src/data/weapons.js";
import { formatWeaponEffects } from "../src/ui/weaponViewHelpers.js";

assert.equal(assertWeaponDefinitions(weaponDefinitions, { materialDefinitions }), true);
assert.equal(Object.keys(weaponDefinitions).length, 8, "v0.2.6.4 應固定提供八把武器");
assert.deepEqual(Object.keys(weaponRarityDefinitions), ["common", "uncommon"]);
assert.equal(getWeaponRarityDefinition("common").label, "普通");
assert.equal(getWeaponRarityDefinition("uncommon").label, "精良");
assert.deepEqual(
  Object.fromEntries(Object.entries(weaponDefinitions).map(([weaponId, weapon]) => [weaponId, weapon.rarityId])),
  {
    "iron-longsword": "common",
    "guard-short-sword": "uncommon",
    "hunter-shortbow": "common",
    "vanguard-hunting-bow": "uncommon",
    "verdant-pursuit-bow": "uncommon",
    "ancient-wood-eroding-bow": "uncommon",
    "bloodbone-guardian-mace": "uncommon",
    "spider-silk-stinger-dagger": "uncommon"
  }
);
assert.equal(
  formatWeaponEffects(weaponDefinitions["verdant-pursuit-bow"]),
  "攻擊 +2、半血追擊暴擊率 +8%"
);
assert.equal(
  formatWeaponEffects(weaponDefinitions["ancient-wood-eroding-bow"]),
  "攻擊 +1、中毒目標無視防禦 +2"
);
assert.equal(
  formatWeaponEffects(weaponDefinitions["bloodbone-guardian-mace"]),
  "攻擊 +1、浴血狂暴：HP 26%～50% 時攻擊 +2；HP 25% 以下時攻擊 +4"
);
assert.equal(
  formatWeaponEffects(weaponDefinitions["spider-silk-stinger-dagger"]),
  "攻擊 +1、暴擊傷害倍率 +0.25"
);

{
  const invalidDefinitions = {
    ...weaponDefinitions,
    "iron-longsword": {
      ...weaponDefinitions["iron-longsword"],
      rarityId: "future-rarity"
    }
  };
  assert.throws(
    () => assertWeaponDefinitions(invalidDefinitions, { materialDefinitions }),
    /未知 rarityId/
  );
}

{
  const adventurer = characterDefinitions.adventurer;
  const archer = characterDefinitions.archer;
  assert.equal(canCharacterEquipWeapon(adventurer, weaponDefinitions["iron-longsword"]), true);
  assert.equal(canCharacterEquipWeapon(adventurer, weaponDefinitions["hunter-shortbow"]), true);
  assert.equal(canCharacterEquipWeapon(adventurer, weaponDefinitions["bloodbone-guardian-mace"]), true);
  assert.equal(canCharacterEquipWeapon(adventurer, weaponDefinitions["spider-silk-stinger-dagger"]), true);
  assert.equal(canCharacterEquipWeapon(archer, weaponDefinitions["hunter-shortbow"]), true);
  assert.equal(canCharacterEquipWeapon(archer, weaponDefinitions["bloodbone-guardian-mace"]), false);
  assert.equal(canCharacterEquipWeapon(archer, weaponDefinitions["spider-silk-stinger-dagger"]), false);
  assert.equal(canCharacterEquipWeapon(archer, weaponDefinitions["iron-longsword"]), false);
}

{
  const normalized = normalizeWeaponInventory({
    "iron-longsword": true,
    "hunter-shortbow": false,
    "removed-weapon": true
  }, weaponDefinitions);
  assert.deepEqual(normalized, { "iron-longsword": true });
}

{
  const save = createDefaultSave();
  assert.equal(SAVE_SCHEMA_VERSION, 9);
  assert.deepEqual(save.inventory.weapons, {});
  assert.deepEqual(save.progression.characters.adventurer.equipment, { weaponId: null });
  assert.deepEqual(save.progression.characters.archer.equipment, { weaponId: null });
}

{
  const raw = createDefaultSave();
  raw.schemaVersion = 7;
  raw.inventory.weapons = {
    "iron-longsword": true,
    "hunter-shortbow": true,
    "removed-weapon": true
  };
  raw.progression.characters.adventurer.equipment.weaponId = "iron-longsword";
  raw.progression.characters.archer.equipment.weaponId = "hunter-shortbow";

  const migrated = migrateSave(raw);
  assert.equal(migrated.schemaVersion, 9);
  assert.deepEqual(migrated.inventory.weapons, {
    "iron-longsword": true,
    "hunter-shortbow": true
  });
  assert.equal(migrated.progression.characters.adventurer.equipment.weaponId, "iron-longsword");
  assert.equal(migrated.progression.characters.archer.equipment.weaponId, "hunter-shortbow");
}

{
  const raw = createDefaultSave();
  raw.schemaVersion = 7;
  raw.inventory.weapons = {
    "iron-longsword": true,
    "hunter-shortbow": true
  };
  raw.progression.characters.adventurer.equipment.weaponId = "missing-weapon";
  raw.progression.characters.archer.equipment.weaponId = "iron-longsword";

  const migrated = migrateSave(raw);
  assert.equal(migrated.progression.characters.adventurer.equipment.weaponId, null, "不存在的武器應自動卸下");
  assert.equal(migrated.progression.characters.archer.equipment.weaponId, null, "角色不相容的武器應自動卸下");
}

{
  const progress = {
    level: 1,
    exp: 0,
    learnedSkills: [],
    equipment: { weaponId: "iron-longsword" }
  };
  const inventory = { weapons: { "iron-longsword": true } };
  const weapon = resolveEquippedWeapon({
    character: characterDefinitions.adventurer,
    progress,
    inventory,
    weaponDefinitions
  });
  assert.equal(weapon?.id, "iron-longsword");

  const hero = buildHeroFromProgression(characterDefinitions.adventurer, progress, {
    inventory,
    weaponDefinitions
  });
  assert.equal(hero.attack, 12);
  assert.equal(hero.equipment.weaponId, "iron-longsword");
  assert.equal(hero.hp, hero.maxHp);
}

{
  const progress = {
    level: 1,
    exp: 0,
    learnedSkills: [],
    equipment: { weaponId: "guard-short-sword" }
  };
  const hero = buildHeroFromProgression(characterDefinitions.adventurer, progress, {
    inventory: { weapons: { "guard-short-sword": true } },
    weaponDefinitions
  });
  assert.equal(hero.attack, 11);
  assert.equal(hero.shieldStart, 8);
}

{
  const progress = {
    level: 1,
    exp: 0,
    learnedSkills: [],
    equipment: { weaponId: "hunter-shortbow" }
  };
  const hero = buildHeroFromProgression(characterDefinitions.archer, progress, {
    inventory: { weapons: { "hunter-shortbow": true } },
    weaponDefinitions
  });
  assert.equal(hero.attack, 12);
  assert.equal(hero.critChance, 0.12);
  assert.equal(hero.equipment.weaponId, "hunter-shortbow");
}

{
  const progress = {
    level: 1,
    exp: 0,
    learnedSkills: [],
    equipment: { weaponId: "vanguard-hunting-bow" }
  };
  const hero = buildHeroFromProgression(characterDefinitions.archer, progress, {
    inventory: { weapons: { "vanguard-hunting-bow": true } },
    weaponDefinitions
  });
  assert.equal(hero.attack, 12);
  assert.equal(hero.openingCritChance, 0.5);
}

{
  const progress = {
    level: 1,
    exp: 0,
    learnedSkills: [],
    equipment: { weaponId: "verdant-pursuit-bow" }
  };
  const hero = buildHeroFromProgression(characterDefinitions.archer, progress, {
    inventory: { weapons: { "verdant-pursuit-bow": true } },
    weaponDefinitions
  });
  assert.equal(hero.attack, 13);
  assert.equal(hero.woundedTargetCritChance, 0.08);
}

{
  const progress = {
    level: 1,
    exp: 0,
    learnedSkills: [],
    equipment: { weaponId: "ancient-wood-eroding-bow" }
  };
  const hero = buildHeroFromProgression(characterDefinitions.archer, progress, {
    inventory: { weapons: { "ancient-wood-eroding-bow": true } },
    weaponDefinitions
  });
  assert.equal(hero.attack, 12);
  assert.equal(hero.poisonedTargetDefenseIgnore, 2);
}

{
  const progress = {
    level: 1,
    exp: 0,
    learnedSkills: [],
    equipment: { weaponId: "bloodbone-guardian-mace" }
  };
  const hero = buildHeroFromProgression(characterDefinitions.adventurer, progress, {
    inventory: { weapons: { "bloodbone-guardian-mace": true } },
    weaponDefinitions
  });
  assert.equal(hero.attack, 11);
  assert.equal(hero.lowHpAttackBonus, 4);
}

{
  const progress = {
    level: 1,
    exp: 0,
    learnedSkills: [],
    equipment: { weaponId: "spider-silk-stinger-dagger" }
  };
  const hero = buildHeroFromProgression(characterDefinitions.adventurer, progress, {
    inventory: { weapons: { "spider-silk-stinger-dagger": true } },
    weaponDefinitions
  });
  assert.equal(hero.attack, 11);
  assert.equal(hero.critDamageMultiplier, 1.95);
}

{
  const progress = {
    level: 1,
    exp: 0,
    learnedSkills: [],
    equipment: { weaponId: "iron-longsword" }
  };
  const inventory = { weapons: { "iron-longsword": true } };
  const normalized = normalizeCharacterEquipment({
    character: characterDefinitions.archer,
    progress,
    inventory,
    weaponDefinitions
  });
  assert.deepEqual(normalized, { weaponId: null });

  const hero = { attack: 11 };
  const applied = applyEquippedWeapon(hero, {
    character: characterDefinitions.archer,
    progress,
    inventory,
    weaponDefinitions
  });
  assert.equal(applied, null);
  assert.equal(hero.attack, 11);
  assert.equal(hero.equipment.weaponId, null);
}


{
  const inventory = {
    weapons: {
      "iron-longsword": true,
      "hunter-shortbow": true,
      "guard-short-sword": false
    }
  };
  const adventurerWeapons = getOwnedCompatibleWeapons({
    character: characterDefinitions.adventurer,
    inventory,
    weaponDefinitions
  });
  const archerWeapons = getOwnedCompatibleWeapons({
    character: characterDefinitions.archer,
    inventory,
    weaponDefinitions
  });
  assert.deepEqual(adventurerWeapons.map((weapon) => weapon.id), ["iron-longsword", "hunter-shortbow"]);
  assert.deepEqual(archerWeapons.map((weapon) => weapon.id), ["hunter-shortbow"]);
}

{
  const progress = { equipment: { weaponId: null } };
  const inventory = { weapons: { "iron-longsword": true, "hunter-shortbow": true } };
  const equipped = equipWeapon({
    character: characterDefinitions.adventurer,
    progress,
    inventory,
    weaponDefinitions,
    weaponId: "iron-longsword"
  });
  assert.equal(equipped.id, "iron-longsword");
  assert.deepEqual(progress.equipment, { weaponId: "iron-longsword" });
  assert.equal(unequipWeapon(progress), "iron-longsword");
  assert.deepEqual(progress.equipment, { weaponId: null });
}

for (const testCase of [
  {
    label: "未持有武器",
    character: characterDefinitions.adventurer,
    inventory: { weapons: {} },
    weaponId: "iron-longsword"
  },
  {
    label: "角色不相容",
    character: characterDefinitions.archer,
    inventory: { weapons: { "iron-longsword": true } },
    weaponId: "iron-longsword"
  },
  {
    label: "未知武器",
    character: characterDefinitions.adventurer,
    inventory: { weapons: { missing: true } },
    weaponId: "missing"
  }
]) {
  const progress = { equipment: { weaponId: null } };
  assert.throws(() => equipWeapon({
    character: testCase.character,
    progress,
    inventory: testCase.inventory,
    weaponDefinitions,
    weaponId: testCase.weaponId
  }), undefined, testCase.label);
  assert.deepEqual(progress.equipment, { weaponId: null }, `${testCase.label}不得修改角色裝備`);
}

console.log("Weapon definitions, compatibility, migration, mutation, and hero application tests passed.");
