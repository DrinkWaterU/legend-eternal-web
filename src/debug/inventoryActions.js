import {
  applyRewardsToInventory,
  createEmptyRewards,
  normalizeInventory
} from "../core/rewards.js";
import { materialDefinitions } from "../data/materials.js";
import { weaponDefinitions } from "../data/weapons.js";

const MATERIAL_GROUPS = Object.freeze([
  { id: "plains", name: "平原" },
  { id: "forest-main", name: "森林主路線" },
  { id: "goblin", name: "哥布林" }
]);

export function createDebugInventoryActions({ getSaveData, saveGameSafe, refresh }) {
  function getMaterialGroups() {
    return MATERIAL_GROUPS.map((group) => ({ ...group }));
  }

  function giveMaterials(groupId) {
    const group = MATERIAL_GROUPS.find((candidate) => candidate.id === groupId);
    if (!group) {
      throw new Error("找不到指定素材來源。");
    }

    const rewards = createEmptyRewards();
    Object.entries(materialDefinitions)
      .filter(([, material]) => matchesMaterialGroup(material, group.id))
      .forEach(([materialId, material]) => {
        rewards.materials[materialId] = {
          id: materialId,
          name: material.name,
          quantity: material.rarity === "rare" ? 1 : 3
        };
      });
    applyRewardsToInventory(getSaveData().inventory, rewards);
    saveGameSafe();
    refresh();
    return `已給予少量${group.name}素材。`;
  }

  function clearInventory() {
    const inventory = getSaveData().inventory;
    inventory.gold = 0;
    inventory.materials = {};
    normalizeInventory(inventory);
    saveGameSafe();
    refresh();
    return "已清空金幣與素材。";
  }

  function giveBlacksmithResources() {
    const saveData = getSaveData();
    const rewards = createEmptyRewards();
    rewards.gold = 1000;
    Object.values(weaponDefinitions).forEach((weapon) => {
      (weapon.recipe?.materialCosts || []).forEach((cost) => {
        const material = materialDefinitions[cost.materialId];
        if (!material) return;
        const current = rewards.materials[cost.materialId]?.quantity || 0;
        rewards.materials[cost.materialId] = {
          id: cost.materialId,
          name: material.name,
          quantity: current + cost.quantity
        };
      });
    });
    applyRewardsToInventory(saveData.inventory, rewards);
    saveGameSafe();
    refresh();
    return "已給予 1000 金幣與製作四把武器所需素材。";
  }

  function giveAllWeapons() {
    const saveData = getSaveData();
    saveData.inventory.weapons = Object.fromEntries(
      Object.keys(weaponDefinitions).map((weaponId) => [weaponId, true])
    );
    saveGameSafe();
    refresh();
    return `已取得全部 ${Object.keys(weaponDefinitions).length} 把武器。`;
  }

  function clearAllWeapons() {
    const saveData = getSaveData();
    saveData.inventory.weapons = {};
    Object.values(saveData.progression.characters || {}).forEach((progress) => {
      progress.equipment = { weaponId: null };
    });
    saveGameSafe();
    refresh();
    return "已清空全部武器並卸下角色裝備。";
  }

  return {
    getMaterialGroups,
    giveMaterials,
    clearInventory,
    giveBlacksmithResources,
    giveAllWeapons,
    clearAllWeapons
  };
}

function matchesMaterialGroup(material, groupId) {
  const tags = Array.isArray(material?.tags) ? material.tags : [];
  if (groupId === "plains") return tags.includes("plains");
  if (groupId === "forest-main") return tags.includes("forest") && !tags.includes("goblin");
  if (groupId === "goblin") return tags.includes("goblin");
  return false;
}
