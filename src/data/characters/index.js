import adventurerData from "./adventurer.json" with { type: "json" };
import archerData from "./archer.json" with { type: "json" };

function createCharacterDefinition(characterId, characterData) {
  return Object.freeze({
    id: characterId,
    ...characterData
  });
}

export const characterDefinitions = Object.freeze({
  adventurer: createCharacterDefinition("adventurer", adventurerData),
  archer: createCharacterDefinition("archer", archerData)
});
