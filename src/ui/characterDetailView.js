import { renderStatList } from "./renderHelpers.js";
import {
  createWeaponIcon,
  formatWeaponCategory,
  formatWeaponEffects,
  getWeaponRarityId,
  getWeaponRarityLabel
} from "./weaponViewHelpers.js";
import { applyCharacterEmblemPortrait, getCharacterPortraitPath } from "./characterPortrait.js";

export function renderCharacterDetailView({
  els,
  characterId,
  character,
  progress,
  hero,
  equippedWeapon,
  weaponCategoryDefinitions,
  experienceLabel,
  selected,
  onEquipmentOpen
}) {
  els.characterDetailName.textContent = character?.name || "角色詳情";
  renderCharacterEmblem(els.characterDetailEmblem, characterId, character);
  els.characterDetailRole.textContent = character?.role || "";
  els.characterDetailRole.hidden = !character?.role;
  els.characterDetailDescription.textContent = character?.description || "尚未記錄角色介紹。";
  els.characterDetailLevelSummary.textContent = `Lv. ${Math.max(1, Math.floor(progress?.level || 1))}｜${experienceLabel}`;

  renderStatList(els.characterDetailStats, [
    ["最大生命", Math.max(0, Math.round(hero?.maxHp || 0))],
    ["攻擊", Math.max(0, Math.round(hero?.attack || 0))],
    ["防禦", Math.max(0, Math.round(hero?.defense || 0))],
    ["暴擊", `${Math.round(Math.max(0, Number(hero?.critChance) || 0) * 100)}%`]
  ]);

  renderEquipmentOverview({
    els,
    equippedWeapon,
    weaponCategoryDefinitions,
    onEquipmentOpen
  });

  els.selectCharacterButton.textContent = selected ? "目前使用中" : `使用${character?.name || "角色"}`;
  els.selectCharacterButton.disabled = selected;
}

function renderCharacterEmblem(element, characterId, character) {
  element.replaceChildren();
  const characterName = character?.name || "角色";
  const portraitPath = getCharacterPortraitPath(character, characterId);
  if (!portraitPath) {
    element.textContent = characterName.charAt(0) || "？";
    return;
  }
  const image = document.createElement("img");
  image.alt = "";
  image.src = portraitPath;
  applyCharacterEmblemPortrait(image, character);
  image.addEventListener("error", () => {
    image.remove();
    element.textContent = characterName.charAt(0) || "？";
  }, { once: true });
  element.append(image);
}

function renderEquipmentOverview({ els, equippedWeapon, weaponCategoryDefinitions, onEquipmentOpen }) {
  const icon = createWeaponIcon(equippedWeapon, {
    className: "weapon-icon character-detail-weapon-icon-inner"
  });
  els.characterDetailWeaponIcon.replaceChildren(icon);
  els.characterDetailWeaponName.textContent = equippedWeapon?.name || "未裝備武器";
  els.characterDetailWeaponEffect.textContent = equippedWeapon
    ? `${formatWeaponCategory(equippedWeapon, weaponCategoryDefinitions)}｜${getWeaponRarityLabel(equippedWeapon)}品級｜${formatWeaponEffects(equippedWeapon)}`
    : "前往安平鎮鐵匠鋪製作武器，或進入裝備管理選擇已持有武器。";
  els.characterEquipmentSlotState.textContent = equippedWeapon ? "已裝備" : "未裝備";
  els.characterEquipmentWeaponSlot.classList.toggle("is-empty", !equippedWeapon);
  els.characterEquipmentWeaponSlot.dataset.rarity = equippedWeapon
    ? getWeaponRarityId(equippedWeapon)
    : "none";
  els.characterEquipmentWeaponSlot.onclick = onEquipmentOpen;
}
