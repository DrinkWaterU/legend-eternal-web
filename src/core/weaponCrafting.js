import { createInventoryCostPlan } from "./inventoryCosts.js";

export function craftWeapon({
  inventory,
  weapon,
  materialDefinitions = {}
}) {
  if (!inventory || typeof inventory !== "object") {
    throw new Error("製作需要有效的 inventory。");
  }
  if (!weapon || typeof weapon.id !== "string" || !weapon.id) {
    throw new Error("製作需要有效的武器 definition。");
  }
  if (inventory.weapons?.[weapon.id] === true) {
    throw new Error(`已擁有${weapon.name || weapon.id}。`);
  }
  if (!weapon.recipe || typeof weapon.recipe !== "object") {
    throw new Error(`${weapon.name || weapon.id}缺少有效配方。`);
  }

  const plan = createInventoryCostPlan({
    inventory,
    materialDefinitions,
    goldCost: weapon.recipe.goldCost,
    materialCosts: weapon.recipe.materialCosts
  });
  const nextWeapons = inventory.weapons && typeof inventory.weapons === "object" && !Array.isArray(inventory.weapons)
    ? { ...inventory.weapons }
    : {};
  nextWeapons[weapon.id] = true;

  inventory.gold = plan.gold;
  inventory.materials = plan.materials;
  inventory.weapons = nextWeapons;

  return {
    weaponId: weapon.id,
    weaponName: weapon.name || weapon.id,
    goldCost: plan.goldCost,
    materialCosts: plan.materialCosts,
    gold: plan.gold
  };
}
