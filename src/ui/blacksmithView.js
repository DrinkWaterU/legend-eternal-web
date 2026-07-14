import { getInventoryCostStatus } from "../core/commerce.js";
import {
  createWeaponIcon,
  formatWeaponCategory,
  formatWeaponEffects,
  getWeaponRarityClass,
  getWeaponRarityId,
  getWeaponRarityLabel
} from "./weaponViewHelpers.js";

export function renderBlacksmithView({
  els,
  inventory,
  weaponDefinitions,
  weaponCategoryDefinitions,
  materialDefinitions,
  selectedWeaponId,
  notice = "",
  noticeType = "status",
  onWeaponSelect,
  onCraftRequest
}) {
  const weapons = Object.values(weaponDefinitions);
  const selectedWeapon = weaponDefinitions[selectedWeaponId] || weapons[0] || null;

  els.blacksmithGold.textContent = String(inventory?.gold || 0);
  els.blacksmithNotice.textContent = notice;
  els.blacksmithNotice.dataset.type = noticeType;
  els.blacksmithWeaponList.replaceChildren();
  els.blacksmithEmpty.classList.toggle("is-hidden", weapons.length > 0);

  weapons.forEach((weapon) => {
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

  const heading = document.createElement("div");
  heading.className = "blacksmith-detail-heading";
  const icon = createWeaponIcon(weapon, { className: "weapon-icon blacksmith-detail-icon" });
  const title = document.createElement("div");
  const eyebrow = document.createElement("span");
  const name = document.createElement("h3");
  const category = document.createElement("p");
  eyebrow.textContent = `${getWeaponRarityLabel(weapon)}品級`;
  heading.dataset.rarity = getWeaponRarityId(weapon);
  name.textContent = weapon.name;
  category.textContent = `${formatWeaponCategory(weapon, weaponCategoryDefinitions)}類武器`;
  title.append(eyebrow, name, category);
  heading.append(icon, title);

  const description = document.createElement("p");
  description.className = "body-text blacksmith-weapon-description";
  description.textContent = weapon.description || "";

  const effectSection = document.createElement("section");
  effectSection.className = "blacksmith-detail-section";
  const effectTitle = document.createElement("h4");
  const effectText = document.createElement("p");
  effectTitle.textContent = "武器效果";
  effectText.textContent = formatWeaponEffects(weapon);
  effectSection.append(effectTitle, effectText);

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
    enough: costStatus.goldEnough
  }));
  costStatus.materialCosts.forEach((cost) => {
    recipeList.append(createRecipeRow({
      label: cost.name,
      held: cost.heldQuantity,
      required: cost.quantity,
      enough: cost.enough
    }));
  });
  recipeSection.append(recipeTitle, recipeList);

  els.blacksmithDetail.append(heading, description, effectSection, recipeSection);
  els.blacksmithCraftButton.textContent = owned
    ? "已擁有"
    : costStatus.affordable
      ? `製作${weapon.name}`
      : "材料不足";
  els.blacksmithCraftButton.disabled = owned || !costStatus.affordable;
  els.blacksmithCraftButton.onclick = () => onCraftRequest(weapon.id);
}

function createRecipeRow({ label, held, required, enough }) {
  const row = document.createElement("div");
  row.className = "blacksmith-recipe-row";
  row.classList.toggle("is-missing", !enough);
  const name = document.createElement("span");
  const amount = document.createElement("strong");
  name.textContent = label;
  amount.textContent = `${held} / ${required}`;
  row.append(name, amount);
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
