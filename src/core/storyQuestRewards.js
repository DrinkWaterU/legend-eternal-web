import { equipWeapon } from "./equipment.js";
import { applyRewardsToInventory } from "./rewards.js";

export function applyStoryQuestRewards({
  saveData,
  definition,
  characterDefinitions,
  weaponDefinitions,
  materialDefinitions = {}
}) {
  const rewards = definition?.rewards || {};
  if (!saveData?.inventory || !saveData?.storyFlags || !saveData?.progression?.characters) {
    throw new Error(`劇情任務 ${definition?.id || "(empty)"} 的獎勵資料無效。`);
  }

  applyRewardsToInventory(saveData.inventory, {
    gold: rewards.gold || 0,
    materials: Object.fromEntries((rewards.materials || []).map((entry) => [
      entry.id,
      {
        id: entry.id,
        name: materialDefinitions[entry.id]?.name || entry.id,
        quantity: entry.quantity
      }
    ]))
  });
  (rewards.storyFlags || []).forEach((entry) => {
    if (!Object.prototype.hasOwnProperty.call(saveData.storyFlags, entry.key)) {
      throw new Error(`劇情任務 ${definition?.id || "(empty)"} 引用了未知 story flag。`);
    }
    saveData.storyFlags[entry.key] = entry.value;
  });

  const character = rewards.unlockCharacterId
    ? characterDefinitions[rewards.unlockCharacterId]
    : null;
  const progress = rewards.unlockCharacterId
    ? saveData.progression.characters[rewards.unlockCharacterId]
    : null;
  if (rewards.unlockCharacterId && (!character || !progress)) {
    throw new Error(`劇情任務 ${definition?.id || "(empty)"} 的角色獎勵無效。`);
  }
  if (progress) {
    progress.unlocked = true;
  }

  const weapon = rewards.grantWeaponId
    ? weaponDefinitions[rewards.grantWeaponId]
    : null;
  if (rewards.grantWeaponId && !weapon) {
    throw new Error(`劇情任務 ${definition?.id || "(empty)"} 的武器獎勵無效。`);
  }
  if (weapon) {
    saveData.inventory.weapons ??= {};
    saveData.inventory.weapons[weapon.id] = true;
  }
  if (rewards.equipWeaponId) {
    equipWeapon({
      character,
      progress,
      inventory: saveData.inventory,
      weaponDefinitions,
      weaponId: rewards.equipWeaponId
    });
  }

  return { characterId: character?.id || null, weaponId: weapon?.id || null };
}
