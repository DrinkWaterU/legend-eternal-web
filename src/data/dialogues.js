import anpingBlacksmithData from "./dialogues/anping-blacksmith.json" with { type: "json" };
import anpingGuildReceptionistData from "./dialogues/anping-guild-receptionist.json" with { type: "json" };
import kaigeData from "./dialogues/kaige-challenge.json" with { type: "json" };

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function createDialogueDefinition(data) {
  return deepFreeze(structuredClone(data));
}

const definitions = [
  createDialogueDefinition(anpingBlacksmithData),
  createDialogueDefinition(anpingGuildReceptionistData),
  createDialogueDefinition(kaigeData)
];

export const dialogueDefinitions = Object.freeze(Object.fromEntries(
  definitions.map((dialogue) => [dialogue.id, dialogue])
));

export function getDialogueDefinition(dialogueId) {
  return dialogueDefinitions[dialogueId] || null;
}
