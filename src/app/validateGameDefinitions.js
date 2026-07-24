import { assertDialogueDefinitions } from "../core/dialogue.js";
import { assertRegionPreparations } from "../core/preparations.js";
import { createDefaultSave } from "../core/storage.js";
import { assertFacilityDefinitions, facilityDefinitions } from "../data/facilities.js";
import { dialogueDefinitions } from "../data/dialogues.js";
import { assertNpcDefinitions, npcDefinitions } from "../data/npcs.js";
import { assertQuestDefinitions, questDefinitions } from "../data/quests.js";
import { characterDefinitions } from "../data/characters/index.js";
import { sharedEnemyDefinitions } from "../data/enemies/index.js";
import { routeDefinitions } from "../data/routes/index.js";
import { materialDefinitions } from "../data/materials.js";
import { regionDefinitions } from "../data/regions/index.js";
import { assertRegionEncounterDefinitions } from "../data/regions/regionDefinition.js";
import { assertSafeAreaDefinitions, safeAreaDefinitions } from "../data/safeAreas.js";
import { assertWeaponDefinitions, weaponDefinitions } from "../data/weapons.js";
import { assertStoryQuestDefinitions, storyQuestDefinitions } from "../data/storyQuests.js";
import { assertDuelDefinitions, duelDefinitions } from "../data/duels/index.js";

export function validateGameDefinitions() {
  const storyFlagKeys = Object.freeze(Object.keys(createDefaultSave().storyFlags));
  assertFacilityDefinitions(facilityDefinitions);
  assertNpcDefinitions(npcDefinitions, { storyFlagKeys, dialogueDefinitions });
  assertDialogueDefinitions(dialogueDefinitions, {
    npcDefinitions,
    storyFlagKeys,
    facilityDefinitions,
    duelDefinitions
  });
  assertDuelDefinitions(duelDefinitions);
  assertQuestDefinitions(questDefinitions, {
    materialDefinitions,
    regionDefinitions,
    routeDefinitions,
    enemyDefinitions: buildEnemyRegistry()
  });
  assertWeaponDefinitions(weaponDefinitions, { materialDefinitions, characterDefinitions });
  assertStoryQuestDefinitions(storyQuestDefinitions, {
    characterDefinitions,
    weaponDefinitions,
    regionDefinitions,
    safeAreaDefinitions,
    materialDefinitions,
    storyFlagKeys
  });
  assertSafeAreaDefinitions(safeAreaDefinitions, facilityDefinitions);
  Object.values(regionDefinitions).forEach((region) => {
    assertRegionPreparations(region);
    assertRegionEncounterDefinitions(region);
  });
}

function buildEnemyRegistry() {
  const regionEnemies = Object.values(regionDefinitions).flatMap((region) => [
    ...(region.enemies || []),
    ...(region.elites || []),
    ...(region.bosses || []),
    ...(region.boss ? [region.boss] : [])
  ]);
  return Object.fromEntries([
    ...Object.values(sharedEnemyDefinitions),
    ...regionEnemies
  ].filter((enemy) => enemy?.id).map((enemy) => [enemy.id, enemy]));
}
