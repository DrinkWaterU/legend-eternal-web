export function renderDefinitionList(element, items, className) {
  items.forEach(([labelText, valueText]) => {
    const row = document.createElement("div");
    row.className = className;
    const label = document.createElement("dt");
    const value = document.createElement("dd");
    label.textContent = labelText;
    value.textContent = String(valueText);
    row.append(label, value);
    element.append(row);
  });
}

import { applyCharacterPortraitFocus, getCharacterPortraitPath } from "./characterPortrait.js";

export function createCharacterEmblem(characterId, characterName, character = null) {
  const emblem = document.createElement("span");
  emblem.className = "character-emblem statistics-character-emblem";
  const portraitPath = getCharacterPortraitPath(character, characterId);
  if (!portraitPath) {
    emblem.textContent = characterName.charAt(0) || "？";
    return emblem;
  }
  const image = document.createElement("img");
  image.alt = "";
  image.src = portraitPath;
  applyCharacterPortraitFocus(image, character);
  image.addEventListener("error", () => {
    image.remove();
    emblem.textContent = characterName.charAt(0) || "？";
  }, { once: true });
  emblem.append(image);
  return emblem;
}
