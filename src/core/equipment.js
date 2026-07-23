export function canCharacterEquipWeapon(character, weapon) {
  if (!character || !weapon?.categoryId) {
    return false;
  }

  if (Array.isArray(weapon.allowedCharacterIds)
    && !weapon.allowedCharacterIds.includes(character.id)) {
    return false;
  }

  const compatibility = character.weaponCompatibility;
  if (compatibility?.mode === "all") {
    return true;
  }
  if (compatibility?.mode === "include") {
    return Array.isArray(compatibility.categoryIds)
      && compatibility.categoryIds.includes(weapon.categoryId);
  }
  return false;
}

export function normalizeWeaponInventory(rawWeapons, weaponDefinitions = {}) {
  if (!rawWeapons || typeof rawWeapons !== "object" || Array.isArray(rawWeapons)) {
    return {};
  }

  return Object.fromEntries(Object.entries(rawWeapons)
    .filter(([weaponId, owned]) => owned === true && Boolean(weaponDefinitions[weaponId]))
    .map(([weaponId]) => [weaponId, true]));
}

export function getOwnedCompatibleWeapons({
  character,
  inventory,
  weaponDefinitions = {}
}) {
  return Object.values(weaponDefinitions)
    .filter((weapon) => (
      inventory?.weapons?.[weapon.id] === true
      && canCharacterEquipWeapon(character, weapon)
    ));
}

export function resolveEquippedWeapon({
  character,
  progress,
  inventory,
  weaponDefinitions = {}
}) {
  const weaponId = typeof progress?.equipment?.weaponId === "string"
    ? progress.equipment.weaponId
    : null;
  if (!weaponId || inventory?.weapons?.[weaponId] !== true) {
    return null;
  }

  const weapon = weaponDefinitions[weaponId];
  return canCharacterEquipWeapon(character, weapon) ? weapon : null;
}

export function normalizeCharacterEquipment({
  character,
  progress,
  inventory,
  weaponDefinitions = {}
}) {
  if (!progress || typeof progress !== "object") {
    return { weaponId: null };
  }

  const weapon = resolveEquippedWeapon({
    character,
    progress,
    inventory,
    weaponDefinitions
  });
  progress.equipment = {
    weaponId: weapon?.id || null
  };
  return progress.equipment;
}

export function equipWeapon({
  character,
  progress,
  inventory,
  weaponDefinitions = {},
  weaponId
}) {
  if (!progress || typeof progress !== "object") {
    throw new Error("角色裝備資料無效。");
  }
  if (typeof weaponId !== "string" || !weaponId.trim()) {
    throw new Error("武器 ID 無效。");
  }

  const weapon = weaponDefinitions[weaponId];
  if (!weapon) {
    throw new Error(`找不到武器：${weaponId}`);
  }
  if (inventory?.weapons?.[weaponId] !== true) {
    throw new Error(`尚未持有${weapon.name || weaponId}。`);
  }
  if (!canCharacterEquipWeapon(character, weapon)) {
    throw new Error(`${character?.name || "此角色"}無法使用${weapon.name || weaponId}。`);
  }

  progress.equipment = { weaponId };
  return weapon;
}

export function unequipWeapon(progress) {
  if (!progress || typeof progress !== "object") {
    throw new Error("角色裝備資料無效。");
  }
  const previousWeaponId = typeof progress.equipment?.weaponId === "string"
    ? progress.equipment.weaponId
    : null;
  progress.equipment = { weaponId: null };
  return previousWeaponId;
}

export function applyEquippedWeapon(hero, {
  character,
  progress,
  inventory,
  weaponDefinitions = {}
} = {}) {
  const weapon = resolveEquippedWeapon({
    character,
    progress,
    inventory,
    weaponDefinitions
  });

  hero.equipment = {
    weaponId: weapon?.id || null
  };
  if (!weapon) {
    return null;
  }

  const effects = [
    ...(Array.isArray(weapon.statEffects) ? weapon.statEffects : []),
    weapon.specialEffect
  ].filter(Boolean);

  effects.forEach((effect) => {
    if (effect.type !== "add" || typeof effect.stat !== "string" || !Number.isFinite(effect.amount)) {
      return;
    }
    hero[effect.stat] = (Number(hero[effect.stat]) || 0) + effect.amount;
  });

  return weapon;
}
