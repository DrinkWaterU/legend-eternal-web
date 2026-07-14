import { createWeaponIcon, formatWeaponCategory } from "./weaponViewHelpers.js";

export function renderCharacterCards({
  element,
  characterDefinitions,
  characterProgression,
  selectedCharacterId,
  equippedWeaponsByCharacterId = {},
  weaponCategoryDefinitions = {},
  onCharacterClick,
  onLockedCharacterClick
}) {
  if (!element) {
    return;
  }

  element.replaceChildren();
  Object.entries(characterDefinitions).forEach(([characterId, character]) => {
    const progress = characterProgression?.[characterId];
    const unlocked = progress?.unlocked === true;
    const selected = unlocked && selectedCharacterId === characterId;
    const card = document.createElement("button");
    card.type = "button";
    card.className = "character-card";
    card.classList.toggle("is-selected", selected);
    card.classList.toggle("is-locked", !unlocked);

    if (!unlocked) {
      card.append(
        createCharacterHeading({ fallback: "？", name: "？？？", meta: "尚未相遇", status: "未知", statusClass: "locked" }),
        createRoleLabel("？？？"),
        createSummary("旅途中，或許還有其他人正在等待。"),
        createCardAction("查看提示")
      );
      card.addEventListener("click", () => onLockedCharacterClick?.());
      element.append(card);
      return;
    }

    const equippedWeapon = equippedWeaponsByCharacterId[characterId] || null;
    card.dataset.characterId = characterId;
    card.append(
      createCharacterHeading({
        characterId,
        fallback: character.name?.charAt(0) || "？",
        name: character.name,
        meta: `Lv. ${Math.max(1, Math.floor(progress?.level || 1))}`,
        status: selected ? "目前使用" : "可使用",
        statusClass: selected ? "selected" : "available"
      }),
      createRoleLabel(character.role || "尚未分類"),
      createSummary(character.summary || character.description || "尚未記錄角色簡介。"),
      createWeaponSummary(equippedWeapon, weaponCategoryDefinitions),
      createCardAction(selected ? "查看目前角色" : "查看角色")
    );
    card.addEventListener("click", () => onCharacterClick?.(characterId));
    element.append(card);
  });
}

function createCharacterHeading({ characterId = null, fallback, name, meta, status, statusClass }) {
  const heading = document.createElement("span");
  heading.className = "character-card-heading";

  const emblem = document.createElement("span");
  emblem.className = "character-emblem";
  if (characterId) {
    const image = document.createElement("img");
    image.alt = "";
    image.addEventListener("error", () => {
      image.remove();
      emblem.textContent = fallback;
    }, { once: true });
    image.src = `./assets/images/characters/${characterId}/emblem.png`;
    emblem.append(image);
  } else {
    emblem.textContent = fallback;
  }

  const title = document.createElement("span");
  title.className = "character-card-title";
  const strong = document.createElement("strong");
  strong.textContent = name;
  const small = document.createElement("small");
  small.textContent = meta;
  title.append(strong, small);

  const statusPill = document.createElement("span");
  statusPill.className = `character-card-status is-${statusClass}`;
  statusPill.textContent = status;

  heading.append(emblem, title, statusPill);
  return heading;
}

function createRoleLabel(role) {
  const element = document.createElement("span");
  element.className = "character-role-label";
  element.textContent = role;
  return element;
}

function createSummary(summary) {
  const element = document.createElement("span");
  element.className = "character-card-summary";
  element.textContent = summary;
  return element;
}

function createWeaponSummary(weapon, categoryDefinitions) {
  const element = document.createElement("span");
  element.className = "character-card-weapon";
  const icon = createWeaponIcon(weapon, { className: "weapon-icon character-card-weapon-icon" });
  const copy = document.createElement("span");
  const label = document.createElement("small");
  const name = document.createElement("strong");
  label.textContent = weapon ? formatWeaponCategory(weapon, categoryDefinitions) : "武器";
  name.textContent = weapon?.name || "尚未裝備武器";
  copy.append(label, name);
  element.append(icon, copy);
  return element;
}

function createCardAction(text) {
  const element = document.createElement("span");
  element.className = "character-card-action";
  const label = document.createElement("span");
  const arrow = document.createElement("span");
  label.textContent = text;
  arrow.textContent = "〉";
  element.append(label, arrow);
  return element;
}
