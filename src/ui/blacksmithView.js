import { getInventoryCostStatus } from "../core/commerce.js";
import {
  createWeaponIcon,
  formatWeaponCategory,
  formatWeaponEffect,
  formatWeaponEffects,
  getWeaponEffects,
  getWeaponRarityClass,
  getWeaponRarityId,
  getWeaponRarityLabel
} from "./weaponViewHelpers.js";

const MATERIAL_SYMBOLS = Object.freeze({
  goblin_scrap: "鐵",
  hard_tusk: "牙",
  soft_hide: "皮",
  spider_silk: "絲",
  sharp_fang: "牙",
  bark_shell: "殼",
  vine_fiber: "藤",
  bee_wing: "翼",
  verdant_antler: "角",
  ancient_wood_core: "芯",
  venom_sac: "毒",
  bloodbone_charm: "符"
});

export function renderBlacksmithView({
  els,
  inventory,
  weaponDefinitions,
  weaponCategoryDefinitions,
  materialDefinitions,
  selectedWeaponId,
  filter = "all",
  category = "all",
  query = "",
  notice = "",
  noticeType = "status",
  onWeaponSelect,
  onCraftRequest,
  onCategorySelect = () => {}
}) {
  const weapons = Object.values(weaponDefinitions);
  const selectedWeapon = weaponDefinitions[selectedWeaponId] || weapons[0] || null;
  const normalizedQuery = String(query).trim().toLowerCase();
  const visibleWeapons = weapons.filter((weapon) => {
    const owned = inventory?.weapons?.[weapon.id] === true;
    const costStatus = getInventoryCostStatus({
      inventory,
      materialDefinitions,
      goldCost: weapon.recipe.goldCost,
      materialCosts: weapon.recipe.materialCosts
    });
    const weaponState = owned ? "owned" : costStatus.affordable ? "available" : "locked";
    const matchesFilter = filter === "all" || weaponState === filter;
    const matchesCategory = category === "all" || weapon.categoryId === category;
    const searchable = `${weapon.name} ${formatWeaponCategory(weapon, weaponCategoryDefinitions)} ${getWeaponRarityLabel(weapon)}`.toLowerCase();
    const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery);
    return matchesFilter && matchesCategory && matchesQuery;
  });

  els.blacksmithGold.textContent = String(inventory?.gold || 0);
  if (els.blacksmithOwnedValue) {
    const ownedCount = weapons.filter((weapon) => inventory?.weapons?.[weapon.id] === true).length;
    els.blacksmithOwnedValue.textContent = `${ownedCount} / ${weapons.length}`;
  }
  els.blacksmithNotice.textContent = notice;
  els.blacksmithNotice.dataset.type = noticeType;
  els.blacksmithWeaponList.replaceChildren();
  els.blacksmithEmpty.classList.toggle("is-hidden", visibleWeapons.length > 0);
  els.blacksmithEmpty.textContent = weapons.length > 0 ? "沒有符合條件的武器。" : "目前沒有可製作的武器。";
  if (els.blacksmithVisibleCount) {
    els.blacksmithVisibleCount.textContent = `${visibleWeapons.length} 項`;
  }
  renderBlacksmithFilterTabs({ els, filter });
  renderBlacksmithCategoryTabs({
    els,
    weaponCategoryDefinitions,
    category,
    onCategorySelect
  });
  if (els.blacksmithSearchInput && els.blacksmithSearchInput.value !== query) {
    els.blacksmithSearchInput.value = query;
  }

  visibleWeapons.forEach((weapon) => {
    const owned = inventory?.weapons?.[weapon.id] === true;
    const costStatus = getInventoryCostStatus({
      inventory,
      materialDefinitions,
      goldCost: weapon.recipe.goldCost,
      materialCosts: weapon.recipe.materialCosts
    });
    const state = owned ? "owned" : costStatus.affordable ? "available" : "locked";
    const button = document.createElement("button");
    button.type = "button";
    button.className = `blacksmith-weapon-card ${getWeaponRarityClass(weapon)}`;
    button.classList.toggle("is-selected", weapon.id === selectedWeapon?.id);
    button.dataset.state = state;

    const icon = createWeaponIcon(weapon, { className: "weapon-icon blacksmith-card-icon" });
    const copy = document.createElement("span");
    copy.className = "blacksmith-card-copy";
    const name = document.createElement("strong");
    const meta = document.createElement("small");
    const effect = document.createElement("span");
    name.textContent = weapon.name;
    meta.textContent = `${formatWeaponCategory(weapon, weaponCategoryDefinitions)}｜${getWeaponRarityLabel(weapon)}品級`;
    effect.textContent = formatWeaponEffects(weapon);
    copy.append(name, meta, effect);

    const status = document.createElement("b");
    status.className = "blacksmith-card-status";
    status.textContent = owned ? "已擁有" : costStatus.affordable ? "可製作" : "材料不足";
    button.append(icon, copy, status);
    button.addEventListener("click", () => onWeaponSelect(weapon.id));
    els.blacksmithWeaponList.append(button);
  });

  renderBlacksmithDetail({
    els,
    weapon: selectedWeapon,
    inventory,
    weaponCategoryDefinitions,
    materialDefinitions,
    onCraftRequest
  });
}

function renderBlacksmithFilterTabs({ els, filter }) {
  forEachElement(els.blacksmithFilterTabs, (button) => {
    const isActive = button.dataset.blacksmithFilter === filter;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function renderBlacksmithCategoryTabs({ els, weaponCategoryDefinitions, category, onCategorySelect }) {
  const categoryList = els.blacksmithCategoryList;
  if (!categoryList) return;

  const categories = [
    { id: "all", label: "全部類別" },
    ...Object.entries(weaponCategoryDefinitions).map(([id, definition]) => ({ id, label: definition.label }))
  ];
  const existingButtons = Array.from(categoryList.children || []);
  const needsRebuild = existingButtons.length !== categories.length || existingButtons.some((button, index) => button.dataset.category !== categories[index].id);

  if (needsRebuild) {
    categoryList.replaceChildren();
    categories.forEach(({ id, label }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "blacksmith-category-tab";
      button.dataset.category = id;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-controls", "blacksmithWeaponList");
      button.textContent = label;
      button.addEventListener("click", () => onCategorySelect(id));
      categoryList.append(button);
    });
  }

  forEachElement(categoryList.children, (button) => {
    const isActive = button.dataset.category === category;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
  updateBlacksmithCategoryControls(els);
}

export function updateBlacksmithCategoryControls(els) {
  const scroller = els.blacksmithCategoryScroller;
  const previousButton = els.blacksmithCategoryPrev;
  const nextButton = els.blacksmithCategoryNext;
  if (!scroller || !previousButton || !nextButton) return;

  const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
  const hasOverflow = maxScroll > 1;
  previousButton.hidden = !hasOverflow || scroller.scrollLeft <= 1;
  nextButton.hidden = !hasOverflow || scroller.scrollLeft >= maxScroll - 1;
}

function forEachElement(elements, callback) {
  if (!elements) return;
  Array.from(elements).forEach(callback);
}

function renderBlacksmithDetail({
  els,
  weapon,
  inventory,
  weaponCategoryDefinitions,
  materialDefinitions,
  onCraftRequest
}) {
  els.blacksmithDetail.replaceChildren();
  if (!weapon) {
    els.blacksmithDetail.append(createMessage("目前沒有可製作的武器。"));
    if (els.blacksmithDetailState) {
      els.blacksmithDetailState.textContent = "沒有配方";
      els.blacksmithDetailState.dataset.state = "locked";
    }
    if (els.blacksmithCraftHint) {
      els.blacksmithCraftHint.textContent = "目前沒有可製作的武器。";
    }
    els.blacksmithCraftButton.disabled = true;
    return;
  }

  const owned = inventory?.weapons?.[weapon.id] === true;
  const costStatus = getInventoryCostStatus({
    inventory,
    materialDefinitions,
    goldCost: weapon.recipe.goldCost,
    materialCosts: weapon.recipe.materialCosts
  });
  const state = owned ? "owned" : costStatus.affordable ? "available" : "locked";
  const stateLabel = owned ? "已擁有" : costStatus.affordable ? "可製作" : "材料不足";

  if (els.blacksmithDetailState) {
    els.blacksmithDetailState.textContent = stateLabel;
    els.blacksmithDetailState.dataset.state = state;
  }

  const heading = document.createElement("div");
  heading.className = "blacksmith-detail-heading";
  const icon = createWeaponIcon(weapon, { className: "weapon-icon blacksmith-detail-icon" });
  const title = document.createElement("div");
  const eyebrow = document.createElement("span");
  const name = document.createElement("h3");
  eyebrow.textContent = `${getWeaponRarityLabel(weapon)}品級・${formatWeaponCategory(weapon, weaponCategoryDefinitions)}類武器`;
  heading.dataset.rarity = getWeaponRarityId(weapon);
  name.textContent = weapon.name;
  title.append(eyebrow, name);
  heading.append(icon, title);

  const description = document.createElement("p");
  description.className = "body-text blacksmith-weapon-description";
  description.textContent = weapon.description || "";

  const effectSection = document.createElement("section");
  effectSection.className = "blacksmith-detail-section";
  const effectTitle = document.createElement("h4");
  const effectList = document.createElement("div");
  effectTitle.textContent = "武器效果";
  effectList.className = "blacksmith-effect-list";
  getWeaponEffects(weapon).forEach((effect) => {
    const item = document.createElement("div");
    item.className = "blacksmith-effect-item";
    const label = document.createElement("small");
    const value = document.createElement("strong");
    label.textContent = effect.stat === "attack" ? "基礎能力" : "特殊效果";
    value.textContent = formatWeaponEffect(effect);
    item.append(label, value);
    effectList.append(item);
  });
  if (!effectList.children.length) {
    const effectText = document.createElement("p");
    effectText.textContent = formatWeaponEffects(weapon);
    effectList.append(effectText);
  }
  effectSection.append(effectTitle, effectList);

  const recipeSection = document.createElement("section");
  recipeSection.className = "blacksmith-detail-section";
  const recipeTitle = document.createElement("h4");
  const recipeList = document.createElement("div");
  recipeTitle.textContent = "製作配方";
  recipeList.className = "blacksmith-recipe-list";
  recipeList.append(createRecipeRow({
    label: "金幣",
    held: costStatus.currentGold,
    required: costStatus.goldCost,
    enough: costStatus.goldEnough,
    isGold: true
  }));
  costStatus.materialCosts.forEach((cost) => {
    recipeList.append(createRecipeRow({
      label: cost.name,
      held: cost.heldQuantity,
      required: cost.quantity,
      enough: cost.enough,
      materialId: cost.materialId
    }));
  });
  recipeSection.append(recipeTitle, recipeList);

  els.blacksmithDetail.append(heading, description, effectSection, recipeSection);
  if (els.blacksmithCraftHint) {
    els.blacksmithCraftHint.textContent = owned
      ? "這把武器已經登錄在你的武器庫。"
      : costStatus.affordable
        ? "資源足夠，可以進入製作確認。"
        : "補齊標紅素材後，才能進入製作確認。";
  }
  els.blacksmithCraftButton.textContent = owned
    ? "已擁有"
    : costStatus.affordable
      ? `製作${weapon.name}`
      : "材料不足";
  els.blacksmithCraftButton.disabled = owned || !costStatus.affordable;
  els.blacksmithCraftButton.onclick = () => onCraftRequest(weapon.id);
}

function createRecipeRow({ label, held, required, enough, materialId = "", isGold = false }) {
  const row = document.createElement("div");
  row.className = `blacksmith-recipe-row${isGold ? " blacksmith-recipe-row--gold" : ""}`;
  row.classList.toggle("is-missing", !enough);
  const symbol = document.createElement("span");
  symbol.className = "blacksmith-material-symbol";
  symbol.textContent = isGold ? "＄" : MATERIAL_SYMBOLS[materialId] || "材";
  const copy = document.createElement("span");
  copy.className = "blacksmith-recipe-copy";
  const name = document.createElement("strong");
  const hint = document.createElement("span");
  name.textContent = label;
  hint.textContent = enough ? "持有數量足夠" : "還需要更多素材";
  copy.append(name, hint);
  const amount = document.createElement("strong");
  amount.className = "blacksmith-recipe-amount";
  amount.textContent = `${held} / ${required}`;
  const progress = document.createElement("span");
  progress.className = "blacksmith-recipe-progress";
  const progressValue = document.createElement("span");
  progressValue.setAttribute("style", `width: ${Math.min(100, Math.round((held / Math.max(required, 1)) * 100))}%`);
  progress.append(progressValue);
  row.append(symbol, copy, amount, progress);
  return row;
}

function createMessage(text) {
  const message = document.createElement("p");
  message.className = "empty-state";
  message.textContent = text;
  return message;
}

export function renderBlacksmithCraftPanel({
  els,
  weapon,
  inventory,
  materialDefinitions,
  onConfirm
}) {
  if (!weapon) {
    closeBlacksmithCraftPanel(els);
    return;
  }

  const costStatus = getInventoryCostStatus({
    inventory,
    materialDefinitions,
    goldCost: weapon.recipe.goldCost,
    materialCosts: weapon.recipe.materialCosts
  });
  els.blacksmithCraftTitle.textContent = weapon.name;
  els.blacksmithCraftMeta.textContent = "確認後會立即扣除下列金幣與素材。";
  els.blacksmithCraftCostList.replaceChildren();
  els.blacksmithCraftCostList.append(createConfirmCostRow("金幣", costStatus.goldCost));
  costStatus.materialCosts.forEach((cost) => {
    els.blacksmithCraftCostList.append(createConfirmCostRow(cost.name, cost.quantity));
  });
  els.confirmBlacksmithCraftButton.disabled = !costStatus.affordable || inventory?.weapons?.[weapon.id] === true;
  els.confirmBlacksmithCraftButton.onclick = onConfirm;
  els.blacksmithCraftPanel.classList.add("is-visible");
}

export function closeBlacksmithCraftPanel(els) {
  els.blacksmithCraftPanel.classList.remove("is-visible");
}

function createConfirmCostRow(label, quantity) {
  const row = document.createElement("div");
  const name = document.createElement("span");
  const amount = document.createElement("strong");
  name.textContent = label;
  amount.textContent = `-${quantity}`;
  row.append(name, amount);
  return row;
}
