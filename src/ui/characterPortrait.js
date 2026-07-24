export function getCharacterPortraitPath(character, characterId) {
  if (Object.prototype.hasOwnProperty.call(character || {}, "portrait")) {
    return String(character?.portrait || "").trim();
  }
  return characterId ? `./assets/images/characters/${characterId}/emblem.png` : "";
}

export function applyCharacterPortraitFocus(image, character) {
  const focus = String(character?.portraitFocus || "").trim();
  if (focus) {
    image.style.objectPosition = focus;
  }
}

export function applyCharacterEmblemPortrait(image, character) {
  const focus = String(character?.emblemPortraitFocus || character?.portraitFocus || "").trim();
  applyCharacterPortraitFocus(image, { portraitFocus: focus });

  const scale = Number(character?.emblemPortraitScale);
  if (Number.isFinite(scale) && scale > 1) {
    image.style.transform = `scale(${scale})`;
    image.style.transformOrigin = focus || "center";
  }
}
