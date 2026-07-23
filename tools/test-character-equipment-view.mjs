import assert from "node:assert/strict";

import {
  createEquipmentComparison,
  renderCharacterEquipmentView
} from "../src/ui/characterEquipmentView.js";
import { createElementMap, installTestDocument } from "./dom-test-stub.mjs";

installTestDocument();

function createElements() {
  const ids = [
    "equipmentCharacterName", "equipmentCharacterRole", "equipmentNotice",
    "equipmentSearchInput", "equipmentSortSelect", "equipmentCategoryFilters", "equipmentWeaponCount",
    "equipmentCurrentSlot", "equipmentWeaponGrid", "equipmentEmpty", "equipmentPreview",
    "equipWeaponButton", "unequipWeaponButton"
  ];
  return createElementMap(ids);
}

const sword = {
  id: "sword",
  name: "鐵製長劍",
  categoryId: "sword",
  rarityId: "common",
  description: "可靠的長劍。",
  statEffects: [{ type: "add", stat: "attack", amount: 2 }],
  specialEffect: null
};
const guard = {
  id: "guard",
  name: "守備短劍",
  categoryId: "sword",
  rarityId: "uncommon",
  description: "強化初次防守。",
  statEffects: [{ type: "add", stat: "attack", amount: 1 }],
  specialEffect: { type: "add", stat: "shieldStart", amount: 8 }
};

{
  const comparison = createEquipmentComparison(
    { maxHp: 100, attack: 10, defense: 2, critChance: 0.05, shieldStart: 0 },
    { maxHp: 100, attack: 11, defense: 2, critChance: 0.05, shieldStart: 8 }
  );
  const attack = comparison.find((entry) => entry.stat === "attack");
  const shield = comparison.find((entry) => entry.stat === "shieldStart");
  assert.deepEqual({ current: attack.current, preview: attack.preview, difference: attack.difference }, { current: 10, preview: 11, difference: 1 });
  assert.equal(shield.changed, true);
  assert.equal(shield.preview, 8);
}

{
  const els = createElements();
  let selectedId = null;
  let equippedId = null;
  let unequipCount = 0;
  renderCharacterEquipmentView({
    els,
    character: { name: "冒險者", role: "全能" },
    progress: { level: 12 },
    equippedWeapon: sword,
    selectedWeapon: guard,
    ownedWeapons: [sword, guard],
    weaponCategoryDefinitions: { sword: { label: "劍" } },
    currentHero: { maxHp: 100, attack: 12, defense: 3, critChance: 0.05, shieldStart: 0 },
    previewHero: { maxHp: 100, attack: 11, defense: 3, critChance: 0.05, shieldStart: 8 },
    onWeaponSelect: (weaponId) => { selectedId = weaponId; },
    onEquip: (weaponId) => { equippedId = weaponId; },
    onUnequip: () => { unequipCount += 1; }
  });

  assert.equal(els.equipmentCharacterName.textContent, "冒險者");
  assert.match(els.equipmentCharacterRole.textContent, /Lv\. 12/);
  assert.equal(els.equipmentWeaponGrid.children.length, 2);
  assert.match(els.equipmentWeaponGrid.children[0].className, /rarity-common/);
  assert.match(els.equipmentWeaponGrid.children[1].className, /rarity-uncommon/);
  assert.equal(els.equipmentWeaponGrid.children[0].children[2].textContent, "劍｜普通品級");
  assert.equal(els.equipmentWeaponGrid.children[1].children[2].textContent, "劍｜精良品級");
  assert.equal(els.equipmentCurrentSlot.dataset.rarity, "common");
  assert.equal(els.equipmentPreview.dataset.rarity, "uncommon");
  assert.match(els.equipmentCurrentSlot.children[1].children[2].textContent, /普通品級/);
  assert.equal(els.equipmentWeaponGrid.children[0].classList.contains("is-equipped"), true);
  assert.equal(els.equipWeaponButton.disabled, false);
  assert.equal(els.equipWeaponButton.textContent, "裝備守備短劍");
  assert.equal(els.unequipWeaponButton.hidden, false);

  els.equipmentWeaponGrid.children[0].listeners.get("click")();
  assert.equal(selectedId, "sword");
  els.equipWeaponButton.onclick();
  assert.equal(equippedId, "guard");
  els.unequipWeaponButton.onclick();
  assert.equal(unequipCount, 1);
}

{
  const els = createElements();
  renderCharacterEquipmentView({
    els,
    character: { name: "弓箭手", role: "遠程" },
    progress: { level: 1 },
    equippedWeapon: null,
    selectedWeapon: null,
    ownedWeapons: [],
    weaponCategoryDefinitions: {},
    currentHero: {},
    previewHero: {},
    onWeaponSelect() {},
    onEquip() {},
    onUnequip() {}
  });
  assert.equal(els.equipmentEmpty.classList.contains("is-hidden"), false);
  assert.equal(els.equipmentCurrentSlot.dataset.rarity, "none");
  assert.equal(els.equipmentPreview.dataset.rarity, "none");
  assert.equal(els.equipWeaponButton.hidden, true);
  assert.equal(els.unequipWeaponButton.hidden, true);
}

console.log("Character equipment comparison, RPG slot, selection, equip, and empty-state view tests passed.");
