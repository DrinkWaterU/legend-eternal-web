import { getWeaponRarityDefinition } from "../data/weapons.js";
import {
  createWeaponIcon,
  formatWeaponCategory,
  formatWeaponEffects,
  getWeaponRarityClass,
  getWeaponRarityLabel,
  setWeaponRarityData
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
    return { ...field, current, preview, difference: preview - current, changed: preview !== current };
  });
}

export function filterEquipmentWeapons(weapons = [], options = {}) {
  const query = String(options.searchQuery || "").trim().toLocaleLowerCase("zh-Hant");
  const categoryFilter = options.categoryFilter || "all";
  const sortMode = options.sortMode === "name" ? "name" : "rarity";
  return weapons
    .filter((weapon) => categoryFilter === "all" || weapon.categoryId === categoryFilter)
    .filter((weapon) => !query || [weapon.name, weapon.description, formatWeaponEffects(weapon)]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("zh-Hant")
      .includes(query))
    .sort((left, right) => {
      if (sortMode === "name") {
        return left.name.localeCompare(right.name, "zh-Hant");
      }
      const rarityDiff = getWeaponRarityDefinition(right.rarityId).rank
        - getWeaponRarityDefinition(left.rarityId).rank;
      return rarityDiff || left.name.localeCompare(right.name, "zh-Hant");
    });
}

export function getEquipmentCategoryIds(weapons = []) {
  return [...new Set(weapons.map((weapon) => weapon.categoryId).filter(Boolean))];
}

export function renderCharacterEquipmentView({
  els,
  character,
  progress,
  equippedWeapon,
  selectedWeapon,
  ownedWeapons,
  visibleWeapons = ownedWeapons,
  weaponCategoryDefinitions,
  currentHero,
  previewHero,
  notice = "",
  noticeType = "status",
  searchQuery = "",
  categoryFilter = "all",
  sortMode = "rarity",
  onSearchChange,
  onSortChange,
  onCategoryChange,
  onWeaponSelect,
  onEquip,
  onUnequip
}) {
  els.equipmentCharacterName.textContent = character?.name || "角色裝備";
  els.equipmentCharacterRole.textContent = `${character?.role || ""}｜Lv. ${Math.max(1, Math.floor(progress?.level || 1))}`;
  els.equipmentNotice.textContent = notice;
  els.equipmentNotice.dataset.type = noticeType;
  els.equipmentSearchInput.value = searchQuery;
  els.equipmentSortSelect.value = sortMode;
  els.equipmentSearchInput.oninput = () => onSearchChange?.(els.equipmentSearchInput.value);
  els.equipmentSortSelect.onchange = () => onSortChange?.(els.equipmentSortSelect.value);

  renderCategoryFilters({
    element: els.equipmentCategoryFilters,
    categoryIds: getEquipmentCategoryIds(ownedWeapons),
    categoryFilter,
    weaponCategoryDefinitions,
    onCategoryChange
  });
  renderCurrentWeaponSlot({ element: els.equipmentCurrentSlot, weapon: equippedWeapon, weaponCategoryDefinitions });
  renderWeaponLibrary({
    element: els.equipmentWeaponGrid,
    visibleWeapons,
    equippedWeapon,
    selectedWeapon,
    weaponCategoryDefinitions,
    onWeaponSelect
  });

  els.equipmentWeaponCount.textContent = visibleWeapons.length === ownedWeapons.length
    ? `${ownedWeapons.length} 把`
    : `${visibleWeapons.length} / ${ownedWeapons.length} 把`;
  els.equipmentEmpty.classList.toggle("is-hidden", visibleWeapons.length > 0);
  els.equipmentEmpty.textContent = ownedWeapons.length === 0
    ? "目前沒有可裝備的武器，可以前往安平鎮鐵匠鋪製作。"
    : "沒有符合目前搜尋或篩選條件的武器。";

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
  els.equipWeaponButton.onclick = () => selectedWeapon && onEquip?.(selectedWeapon.id);

  els.unequipWeaponButton.hidden = !equippedWeapon;
  els.unequipWeaponButton.disabled = !equippedWeapon;
  els.unequipWeaponButton.onclick = () => onUnequip?.();
}

function renderCategoryFilters({ element, categoryIds, categoryFilter, weaponCategoryDefinitions, onCategoryChange }) {
  const filters = [
    { id: "all", label: "全部" },
    ...categoryIds.map((categoryId) => ({
      id: categoryId,
      label: weaponCategoryDefinitions[categoryId]?.label || categoryId
    }))
  ];
  element.replaceChildren();
  filters.forEach((filter) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "filter-chip";
    const active = filter.id === categoryFilter;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
    button.textContent = filter.label;
    button.addEventListener("click", () => onCategoryChange?.(filter.id));
    element.append(button);
  });
}

function renderWeaponLibrary({ element, visibleWeapons, equippedWeapon, selectedWeapon, weaponCategoryDefinitions, onWeaponSelect }) {
  element.replaceChildren();
  visibleWeapons.forEach((weapon) => {
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
    status.textContent = equipped ? "目前裝備" : selected ? "正在比較" : "查看比較";
    button.append(icon, name, meta, status);
    button.addEventListener("click", () => onWeaponSelect?.(weapon.id));
    element.append(button);
  });
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
    : "選擇武器庫中的相容武器。";
  copy.append(label, name, effect);
  element.classList.toggle("is-empty", !weapon);
  setWeaponRarityData(element, weapon);
  element.append(icon, copy);
}

function renderPreview({ element, selectedWeapon, equippedWeapon, currentHero, previewHero, weaponCategoryDefinitions }) {
  element.replaceChildren();
  setWeaponRarityData(element, selectedWeapon);
  if (!selectedWeapon) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "請從武器庫選擇一把武器查看比較。";
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
  heading.append(createWeaponIcon(selectedWeapon, { className: "weapon-icon equipment-preview-icon" }), title);

  const description = document.createElement("p");
  description.className = "body-text";
  description.textContent = selectedWeapon.description || "";
  const effect = document.createElement("p");
  effect.className = "equipment-preview-effect";
  effect.textContent = formatWeaponEffects(selectedWeapon);

  const statList = document.createElement("div");
  statList.className = "equipment-comparison-list";
  createEquipmentComparison(currentHero, previewHero).forEach((entry) => {
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
