import { assertDialogueDefinitions } from "../core/dialogue.js";
import { assertRegionPreparations } from "../core/preparations.js";
import { createDefaultSave } from "../core/storage.js";
import { assertFacilityDefinitions, facilityDefinitions } from "../data/facilities.js";
import { dialogueDefinitions } from "../data/dialogues.js";
import { assertNpcDefinitions, npcDefinitions } from "../data/npcs.js";
import { materialDefinitions } from "../data/materials.js";
import { regionDefinitions } from "../data/regions/index.js";
import { assertSafeAreaDefinitions, safeAreaDefinitions } from "../data/safeAreas.js";
import { assertWeaponDefinitions, weaponDefinitions } from "../data/weapons.js";

export function validateGameDefinitions() {
  const storyFlagKeys = Object.freeze(Object.keys(createDefaultSave().storyFlags));
  assertFacilityDefinitions(facilityDefinitions);
  assertNpcDefinitions(npcDefinitions, { storyFlagKeys, dialogueDefinitions });
  assertDialogueDefinitions(dialogueDefinitions, {
    npcDefinitions,
    storyFlagKeys,
    facilityDefinitions
  });
  assertWeaponDefinitions(weaponDefinitions, { materialDefinitions });
  assertSafeAreaDefinitions(safeAreaDefinitions, facilityDefinitions);
  Object.values(regionDefinitions).forEach(assertRegionPreparations);
}
