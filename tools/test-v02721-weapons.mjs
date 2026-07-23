import assert from "node:assert/strict";

import {
  applyEquippedWeapon,
  canCharacterEquipWeapon,
  getOwnedCompatibleWeapons,
  normalizeCharacterEquipment
} from "../src/core/equipment.js";
import { applyEquippedWeaponBattleStart } from "../src/core/weaponBattleEffects.js";
import { buildHeroFromProgression } from "../src/core/progression.js";
import { characterDefinitions } from "../src/data/characters/index.js";
import { materialDefinitions } from "../src/data/materials.js";
import {
  assertWeaponDefinitions,
  weaponDefinitions
} from "../src/data/weapons.js";
import { formatWeaponEffects } from "../src/ui/weaponViewHelpers.js";

const NEW_WEAPON_IDS = [
  "adventurer-pathfinder-sword",
  "tidepiercer-shortbow",
  "reefbreaker-warhammer",
  "brinefang-dagger"
];

assert.equal(
  assertWeaponDefinitions(weaponDefinitions, { materialDefinitions, characterDefinitions }),
  true
);
assert.deepEqual(
  NEW_WEAPON_IDS.map((weaponId) => weaponDefinitions[weaponId]?.name),
  ["萬途歷戰刃", "潮翼獵風弓", "礁甲鎮潮鎚", "腐潮刻痕刃"]
);
assert.equal(weaponDefinitions["adventurer-pathfinder-sword"].rarityId, "rare");
assert.deepEqual(
  weaponDefinitions["adventurer-pathfinder-sword"].allowedCharacterIds,
  ["adventurer"]
);
assert.equal(
  formatWeaponEffects(weaponDefinitions["tidepiercer-shortbow"]),
  "穿潮校準：攻擊 +2。每場戰鬥的首次攻擊，額外獲得 35% 暴擊率。"
);

for (const allowedCharacterIds of [[], ["missing-character"]]) {
  const invalidDefinitions = {
    test: {
      ...weaponDefinitions["adventurer-pathfinder-sword"],
      id: "test",
      allowedCharacterIds
    }
  };
  assert.throws(
    () => assertWeaponDefinitions(invalidDefinitions, { materialDefinitions, characterDefinitions }),
    allowedCharacterIds.length === 0 ? /非空陣列/ : /未知角色/
  );
}

const adventurer = characterDefinitions.adventurer;
const archer = characterDefinitions.archer;
const rareSword = weaponDefinitions["adventurer-pathfinder-sword"];
assert.equal(canCharacterEquipWeapon(adventurer, rareSword), true);
assert.equal(canCharacterEquipWeapon(archer, rareSword), false);

{
  const inventory = {
    weapons: Object.fromEntries(NEW_WEAPON_IDS.map((weaponId) => [weaponId, true]))
  };
  assert.deepEqual(
    getOwnedCompatibleWeapons({ character: adventurer, inventory, weaponDefinitions })
      .map((weapon) => weapon.id),
    NEW_WEAPON_IDS
  );
  assert.deepEqual(
    getOwnedCompatibleWeapons({ character: archer, inventory, weaponDefinitions })
      .map((weapon) => weapon.id),
    ["tidepiercer-shortbow"]
  );

  const archerProgress = { equipment: { weaponId: "adventurer-pathfinder-sword" } };
  normalizeCharacterEquipment({
    character: archer,
    progress: archerProgress,
    inventory,
    weaponDefinitions
  });
  assert.deepEqual(archerProgress.equipment, { weaponId: null });
  assert.equal(inventory.weapons["adventurer-pathfinder-sword"], true);

  const corruptedHero = { characterId: "archer", attack: 12 };
  assert.equal(applyEquippedWeapon(corruptedHero, {
    character: archer,
    progress: { equipment: { weaponId: "adventurer-pathfinder-sword" } },
    inventory,
    weaponDefinitions
  }), null);
}

{
  const buildHero = (weaponId, overrides = {}) => {
    const hero = buildHeroFromProgression(adventurer, {
      level: 25,
      exp: 0,
      learnedSkills: [],
      equipment: { weaponId }
    }, {
      inventory: { weapons: { [weaponId]: true } },
      weaponDefinitions
    });
    Object.assign(hero, {
      shield: hero.shieldStart,
      battleAttackBonus: 0,
      battleCritBonus: 0,
      weaponBattleStartApplied: false,
      ...overrides
    });
    return hero;
  };

  const lowHp = buildHero("adventurer-pathfinder-sword");
  lowHp.hp = lowHp.maxHp * 0.5;
  assert.equal(applyEquippedWeaponBattleStart(lowHp, {
    enemyCount: 3,
    encounterType: "boss"
  })?.modeId, "low-hp");
  assert.equal(lowHp.battleAttackBonus, 1);
  assert.equal(lowHp.battleCritBonus, 0);
  assert.equal(lowHp.shield, 16);

  const boss = buildHero("adventurer-pathfinder-sword");
  assert.equal(applyEquippedWeaponBattleStart(boss, {
    enemyCount: 3,
    encounterType: "boss"
  })?.modeId, "boss");
  assert.equal(boss.battleAttackBonus, 2);
  assert.equal(boss.battleCritBonus, 0.08);
  assert.equal(boss.shield, 20);

  const multi = buildHero("adventurer-pathfinder-sword");
  assert.equal(applyEquippedWeaponBattleStart(multi, {
    enemyCount: 2,
    encounterType: "normal"
  })?.modeId, "multi-enemy");
  assert.equal(multi.battleAttackBonus, 1);
  assert.equal(multi.battleCritBonus, 0);
  assert.equal(multi.shield, 12);

  const single = buildHero("adventurer-pathfinder-sword");
  assert.equal(applyEquippedWeaponBattleStart(single, {
    enemyCount: 1,
    encounterType: "normal"
  })?.modeId, "single-enemy");
  assert.equal(single.battleAttackBonus, 1);
  assert.equal(single.battleCritBonus, 0.08);
  assert.equal(single.shield, 0);
  assert.equal(applyEquippedWeaponBattleStart(single, {
    enemyCount: 1,
    encounterType: "normal"
  }), null, "同一場戰鬥不得重複觸發");
  assert.equal(single.battleAttackBonus, 1);

  const bow = buildHero("tidepiercer-shortbow");
  assert.equal(bow.attack, 18);
  assert.equal(bow.openingCritChance, 0.35);

  const mace = buildHero("reefbreaker-warhammer");
  assert.equal(mace.attack, 18);
  assert.equal(mace.shieldStart, 4);
  assert.equal(mace.multiEnemyShieldStart, 6);

  const dagger = buildHero("brinefang-dagger");
  assert.equal(dagger.attack, 18);
  assert.ok(Math.abs(dagger.critDamageMultiplier - 2.35) < 1e-9);
}

console.log("v0.2.7.2.1 weapon data, compatibility, battle modes, and save normalization tests passed.");
