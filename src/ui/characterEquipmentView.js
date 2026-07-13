import {
  createWeaponIcon,
  formatWeaponCategory,
  formatWeaponEffects,
  getWeaponRarityClass,
  getWeaponRarityId,
  getWeaponRarityLabel
} from "./weaponViewHelpers.js";

const COMPARISON_FIELDS = Object.freeze([
  Object.freeze({ stat: "maxHp", label: "最大生命", type: "number" }),
  Object.freeze({ stat: "attack", label: "攻擊", type: "number" }),
  Object.freeze({ stat: "defense", label: "防禦", type: "number" }),
  Object.freeze({ stat: "critChance", label: "暴擊率", type: "percent" }),
  Object.freeze({ stat: "shieldStart", label: "開場護盾", type: "number" }),
  Object.freeze({ stat: "openingCritChance", label: "首次攻擊暴擊率", type: "percent" })
]);

export function createEquipmentComparison(currentHero, previewHero) {
  return COMPARISON_FIELDS.map((field) => {
    const current = Number(currentHero?.[field.stat]) || 0;
    const preview = Number(previewHero?.[field.stat]) || 0;
    return {
      ...field,
      current,
      preview,
      difference: preview - current,
      changed: preview !== current
    };
  });
}

export function renderCharacterEquipmentView({
  els,
  character,
  progress,
  equippedWeapon,
  selectedWeapon,
  ownedWeapons,
  weaponCategoryDefinitions,
  currentHero,
  previewHero,
  notice = "",
  noticeType = "status",
  onWeaponSelect,
  onEquip,
  onUnequip
}) {
  els.equipmentCharacterName.textContent = character?.name || "角色裝備";
  els.equipmentCharacterRole.textContent = `${character?.role || ""}｜Lv. ${Math.max(1, Math.floor(progress?.level || 1))}`;
  els.equipmentNotice.textContent = notice;
  els.equipmentNotice.dataset.type = noticeType;

  renderCurrentWeaponSlot({
    element: els.equipmentCurrentSlot,
    weapon: equippedWeapon,
    weaponCategoryDefinitions
  });

  els.equipmentWeaponGrid.replaceChildren();
  els.equipmentEmpty.classList.toggle("is-hidden", ownedWeapons.length > 0);
  ownedWeapons.forEach((weapon) => {
    const equipped = weapon.id === equippedWeapon?.id;
    const selected = weapon.id === selectedWeapon?.id;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `equipment-weapon-card ${getWeaponRarityClass(weapon)}`;
    button.classList.toggle("is-equipped", equipped);
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));

    const icon = createWeaponIcon(weapon, { className: "weapon-icon equipment-card-icon" });
    const name = document.createElement("strong");
    const meta = document.createElement("small");
    const status = document.createElement("span");
    name.textContent = weapon.name;
    meta.textContent = `${formatWeaponCategory(weapon, weaponCategoryDefinitions)}｜${getWeaponRarityLabel(weapon)}品級`;
    status.textContent = equipped ? "目前裝備" : "查看比較";
    button.append(icon, name, meta, status);
    button.addEventListener("click", () => onWeaponSelect(weapon.id));
    els.equipmentWeaponGrid.append(button);
  });

  renderPreview({
    element: els.equipmentPreview,
    selectedWeapon,
    equippedWeapon,
    currentHero,
    previewHero,
    weaponCategoryDefinitions
  });

  els.equipWeaponButton.hidden = !selectedWeapon;
  els.equipWeaponButton.disabled = !selectedWeapon || selectedWeapon.id === equippedWeapon?.id;
  els.equipWeaponButton.textContent = selectedWeapon?.id === equippedWeapon?.id
    ? "目前已裝備"
    : selectedWeapon
      ? `裝備${selectedWeapon.name}`
      : "選擇武器";
  els.equipWeaponButton.onclick = () => selectedWeapon && onEquip(selectedWeapon.id);

  els.unequipWeaponButton.hidden = !equippedWeapon;
  els.unequipWeaponButton.disabled = !equippedWeapon;
  els.unequipWeaponButton.onclick = onUnequip;
}

function renderCurrentWeaponSlot({ element, weapon, weaponCategoryDefinitions }) {
  element.replaceChildren();
  const icon = createWeaponIcon(weapon, { className: "weapon-icon equipment-slot-icon" });
  const copy = document.createElement("div");
  const label = document.createElement("span");
  const name = document.createElement("strong");
  const effect = document.createElement("small");
  label.textContent = "武器欄位";
  name.textContent = weapon?.name || "未裝備武器";
  effect.textContent = weapon
    ? `${formatWeaponCategory(weapon, weaponCategoryDefinitions)}｜${getWeaponRarityLabel(weapon)}品級｜${formatWeaponEffects(weapon)}`
    : "選擇下方已持有的相容武器。";
  copy.append(label, name, effect);
  element.classList.toggle("is-empty", !weapon);
  element.dataset.rarity = weapon ? getWeaponRarityId(weapon) : "none";
  element.append(icon, copy);
}

function renderPreview({
  element,
  selectedWeapon,
  equippedWeapon,
  currentHero,
  previewHero,
  weaponCategoryDefinitions
}) {
  element.replaceChildren();
  if (!selectedWeapon) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "目前沒有可預覽的武器。";
    element.append(empty);
    return;
  }

  const heading = document.createElement("div");
  heading.className = "equipment-preview-heading";
  const title = document.createElement("div");
  const eyebrow = document.createElement("span");
  const name = document.createElement("h3");
  const meta = document.createElement("small");
  eyebrow.textContent = selectedWeapon.id === equippedWeapon?.id ? "目前裝備" : "裝備預覽";
  name.textContent = selectedWeapon.name;
  meta.textContent = `${formatWeaponCategory(selectedWeapon, weaponCategoryDefinitions)}｜${getWeaponRarityLabel(selectedWeapon)}品級`;
  title.append(eyebrow, name, meta);
  heading.dataset.rarity = getWeaponRarityId(selectedWeapon);
  heading.append(createWeaponIcon(selectedWeapon, { className: "weapon-icon equipment-preview-icon" }), title);

  const description = document.createElement("p");
  description.className = "body-text";
  description.textContent = selectedWeapon.description || "";

  const effect = document.createElement("p");
  effect.className = "equipment-preview-effect";
  effect.textContent = formatWeaponEffects(selectedWeapon);

  const comparison = createEquipmentComparison(currentHero, previewHero);
  const statList = document.createElement("div");
  statList.className = "equipment-comparison-list";
  comparison.forEach((entry) => {
    const row = document.createElement("div");
    row.classList.toggle("is-changed", entry.changed);
    const label = document.createElement("span");
    const values = document.createElement("strong");
    label.textContent = entry.label;
    values.textContent = entry.changed
      ? `${formatValue(entry.current, entry.type)} → ${formatValue(entry.preview, entry.type)}`
      : formatValue(entry.current, entry.type);
    row.append(label, values);
    statList.append(row);
  });

  element.append(heading, description, effect, statList);
}

function formatValue(value, type) {
  return type === "percent" ? `${Math.round(value * 100)}%` : String(value);
}
