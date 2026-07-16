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

export function createCharacterEmblem(characterId, characterName) {
  const emblem = document.createElement("span");
  emblem.className = "character-emblem statistics-character-emblem";
  const image = document.createElement("img");
  image.alt = "";
  image.src = `./assets/images/characters/${characterId}/emblem.png`;
  image.addEventListener("error", () => {
    image.remove();
    emblem.textContent = characterName.charAt(0) || "？";
  }, { once: true });
  emblem.append(image);
  return emblem;
}
