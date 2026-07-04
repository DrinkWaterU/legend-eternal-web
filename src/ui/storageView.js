import { getMaterialRarity } from "../data/materials.js";
import { renderDetailInfoLayout } from "./renderHelpers.js";

const SORTERS = {
  rarity: compareByRarity,
  quantity: compareByQuantity,
  sellPrice: compareBySellPrice,
  name: compareByName
};

export function renderStorageView({ els, inventory, materialDefinitions, sortMode, sortDirection, onSortChange, onDirectionChange, onMaterialClick }) {
  const items = getInventoryMaterials(inventory, materialDefinitions);
  const sortedItems = sortMaterials(items, sortMode, sortDirection);
  els.storageGold.textContent = String(inventory?.gold || 0);
  els.storageMaterialCount.textContent = String(items.reduce((total, item) => total + item.quantity, 0));
  els.storageSortSelect.value = sortMode;
  els.storageSortDirectionButton.textContent = sortDirection === "asc" ? "升序" : "降序";
  els.storageSortDirectionButton.dataset.direction = sortDirection;
  els.storageSortSelect.onchange = () => onSortChange(els.storageSortSelect.value);
  els.storageSortDirectionButton.onclick = () => onDirectionChange(sortDirection === "asc" ? "desc" : "asc");
  els.storageGrid.innerHTML = "";
  els.storageEmpty.classList.toggle("is-hidden", sortedItems.length > 0);

  sortedItems.forEach((item) => {
    const rarity = getMaterialRarity(item.rarity);
    const button = document.createElement("button");
    button.className = `inventory-slot rarity-${rarity.id}`;
    button.type = "button";
    const rarityLabel = document.createElement("span");
    const name = document.createElement("strong");
    const quantity = document.createElement("small");
    rarityLabel.className = "inventory-slot-rarity";
    rarityLabel.textContent = rarity.label;
    name.textContent = item.name;
    quantity.textContent = `x${item.quantity}`;
    button.append(rarityLabel, name, quantity);
    button.addEventListener("click", () => onMaterialClick(item));
    els.storageGrid.append(button);
  });
}

export function showMaterialDetail(els, item) {
  const rarity = getMaterialRarity(item.rarity);
  els.materialInfoStatus.textContent = rarity.label;
  els.materialInfoStatus.className = `modal-status rarity-${rarity.id}`;
  els.materialInfoTitle.textContent = item.name;
  els.materialInfoMeta.textContent = `${getCategoryLabel(item.category)} / 持有 ${item.quantity}`;
  els.materialInfoDescription.textContent = item.description || "尚未記錄素材描述。";
  renderDetailInfoLayout(els.materialInfoDetails, {
    primary: [
      { label: "用途", value: item.usage || "尚未記錄用途。" }
    ],
    secondary: [
      { label: "來源", value: item.source || "來源不明。" },
      { label: "價值", value: `${item.sellPrice || 0} 金幣` }
    ]
  });
  els.materialInfoPanel.classList.add("is-visible");
}

export function closeMaterialDetail(els) {
  els.materialInfoPanel.classList.remove("is-visible");
}

function getInventoryMaterials(inventory = {}, materialDefinitions = {}) {
  const materials = inventory.materials || {};
  return Object.entries(materials)
    .map(([materialId, material]) => {
      const definition = materialDefinitions[materialId] || {};
      const quantity = Number.isFinite(material?.quantity) ? material.quantity : 0;
      return {
        id: materialId,
        name: definition.name || material?.name || materialId,
        rarity: definition.rarity || "common",
        category: definition.category || "material",
        description: definition.description || "",
        usage: definition.usage || "",
        source: definition.source || "",
        sellPrice: Number.isFinite(definition.sellPrice) ? definition.sellPrice : 0,
        sortOrder: Number.isFinite(definition.sortOrder) ? definition.sortOrder : 9999,
        quantity
      };
    })
    .filter((item) => item.quantity > 0);
}

function sortMaterials(items, sortMode, sortDirection) {
  const sorter = SORTERS[sortMode] || SORTERS.rarity;
  const direction = sortDirection === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    if (sortMode === "rarity") {
      const rankDiff = getMaterialRarity(b.rarity).rank - getMaterialRarity(a.rarity).rank;
      if (rankDiff !== 0) {
        return sortDirection === "asc" ? -rankDiff : rankDiff;
      }
      const orderDiff = a.sortOrder - b.sortOrder;
      if (orderDiff !== 0) {
        return orderDiff;
      }
      return compareByName(a, b);
    }
    const result = sorter(a, b);
    if (result !== 0) {
      return result * direction;
    }
    return compareByName(a, b);
  });
}

function compareByRarity(a, b) {
  const rankDiff = getMaterialRarity(a.rarity).rank - getMaterialRarity(b.rarity).rank;
  if (rankDiff !== 0) {
    return rankDiff;
  }
  return a.sortOrder - b.sortOrder;
}

function compareByQuantity(a, b) {
  return a.quantity - b.quantity;
}

function compareBySellPrice(a, b) {
  return a.sellPrice - b.sellPrice;
}

function compareByName(a, b) {
  return a.name.localeCompare(b.name, "zh-Hant");
}

function getCategoryLabel(category) {
  if (category === "material") {
    return "素材";
  }
  return category || "物品";
}
