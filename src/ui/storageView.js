import { MATERIAL_RARITIES, getMaterialRarity } from "../data/materials.js";
import { filterMaterials, getInventoryMaterials, sortMaterials } from "./materialList.js";
import {
  MATERIAL_USAGE_FILTERS,
  getMaterialUsageCounts,
  getMaterialUsages
} from "./materialUsage.js";

export function renderStorageView({
  els,
  inventory,
  materialDefinitions,
  usageIndex,
  sortMode,
  sortDirection,
  searchQuery = "",
  rarityFilter = "all",
  selectedMaterialId = null,
  usageFilter = "all",
  expandedUsageIds = new Set(),
  onSortChange,
  onDirectionChange,
  onSearchChange,
  onRarityChange,
  onMaterialSelect,
  onUsageFilterChange,
  onUsageToggle,
  onClearFilters
}) {
  const items = getInventoryMaterials(inventory, materialDefinitions);
  const filteredItems = filterMaterials(items, { searchQuery, rarityFilter, usageIndex });
  const visibleItems = sortMaterials(filteredItems, sortMode, sortDirection);
  const resolvedSelectedId = visibleItems.some((item) => item.id === selectedMaterialId)
    ? selectedMaterialId
    : visibleItems[0]?.id || null;
  const selectedItem = visibleItems.find((item) => item.id === resolvedSelectedId) || null;

  els.storageGold.textContent = String(inventory?.gold || 0);
  els.storageMaterialKinds.textContent = String(items.length);
  els.storageMaterialCount.textContent = String(items.reduce((total, item) => total + item.quantity, 0));
  els.storageResultCount.textContent = visibleItems.length === items.length
    ? `${items.length} 種`
    : `${visibleItems.length} / ${items.length} 種`;
  els.storageSearchInput.value = searchQuery;
  els.storageSortSelect.value = sortMode;
  els.storageSortDirectionButton.textContent = sortDirection === "asc" ? "升序" : "降序";
  els.storageSortDirectionButton.dataset.direction = sortDirection;
  els.storageSearchInput.oninput = () => onSearchChange?.(els.storageSearchInput.value);
  els.storageSortSelect.onchange = () => onSortChange?.(els.storageSortSelect.value);
  els.storageSortDirectionButton.onclick = () => onDirectionChange?.(sortDirection === "asc" ? "desc" : "asc");

  renderRarityFilters({ element: els.storageRarityFilters, items, activeFilter: rarityFilter, onRarityChange });
  renderMaterialGrid({
    element: els.storageGrid,
    items: visibleItems,
    selectedMaterialId: resolvedSelectedId,
    onMaterialSelect
  });

  const trulyEmpty = items.length === 0;
  els.storageEmpty.classList.toggle("is-hidden", visibleItems.length > 0);
  renderStorageEmptyState({
    element: els.storageEmpty,
    trulyEmpty,
    searchQuery,
    onClearFilters
  });

  const resolvedUsageFilter = renderMaterialDetail({
    els,
    item: selectedItem,
    usageIndex,
    usageFilter,
    expandedUsageIds,
    onUsageFilterChange,
    onUsageToggle
  });

  return {
    selectedMaterialId: resolvedSelectedId,
    visibleCount: visibleItems.length,
    totalCount: items.length,
    usageFilter: resolvedUsageFilter
  };
}

function renderRarityFilters({ element, items, activeFilter, onRarityChange }) {
  const presentRarities = new Set(items.map((item) => item.rarity));
  const filters = [
    { id: "all", label: "全部", count: items.length },
    ...Object.values(MATERIAL_RARITIES)
      .filter((rarity) => presentRarities.has(rarity.id))
      .sort((left, right) => left.rank - right.rank)
      .map((rarity) => ({
        id: rarity.id,
        label: rarity.label,
        count: items.filter((item) => item.rarity === rarity.id).length
      }))
  ];
  element.replaceChildren();
  filters.forEach((filter) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "filter-chip";
    const active = filter.id === activeFilter;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
    button.textContent = `${filter.label} ${filter.count}`;
    button.addEventListener("click", () => onRarityChange?.(filter.id));
    element.append(button);
  });
}

function renderMaterialGrid({ element, items, selectedMaterialId, onMaterialSelect }) {
  element.replaceChildren();
  items.forEach((item) => {
    const rarity = getMaterialRarity(item.rarity);
    const button = document.createElement("button");
    button.className = `inventory-slot storage-material-card rarity-${rarity.id}`;
    button.classList.toggle("is-selected", item.id === selectedMaterialId);
    button.setAttribute("aria-pressed", String(item.id === selectedMaterialId));
    button.type = "button";

    const rarityLabel = document.createElement("span");
    rarityLabel.className = "inventory-slot-rarity";
    rarityLabel.textContent = rarity.label;
    const name = document.createElement("strong");
    name.textContent = item.name;
    const meta = document.createElement("span");
    meta.className = "storage-material-meta";
    meta.textContent = `${item.source || "來源不明"}｜${item.sellPrice || 0} 金幣`;
    const quantity = document.createElement("small");
    quantity.textContent = `×${item.quantity}`;
    button.append(rarityLabel, name, meta, quantity);
    button.addEventListener("click", () => onMaterialSelect?.(item.id));
    element.append(button);
  });
}

function renderStorageEmptyState({ element, trulyEmpty, searchQuery, onClearFilters }) {
  element.replaceChildren();
  const message = document.createElement("p");
  message.textContent = trulyEmpty
    ? "倉庫目前是空的。完成冒險並安全返回後，取得的素材會存放在這裡。"
    : searchQuery
      ? `找不到符合「${searchQuery}」的素材。`
      : "找不到符合目前篩選條件的素材。";
  element.append(message);
  if (!trulyEmpty) {
    const clearButton = document.createElement("button");
    clearButton.type = "button";
    clearButton.className = "secondary-button storage-clear-filter-button";
    clearButton.textContent = "清除搜尋與篩選";
    clearButton.addEventListener("click", () => onClearFilters?.());
    element.append(clearButton);
  }
}

function renderMaterialDetail({ els, item, usageIndex, usageFilter, expandedUsageIds, onUsageFilterChange, onUsageToggle }) {
  const hasItem = Boolean(item);
  els.storageDetailEmpty.hidden = hasItem;
  els.storageDetailContent.hidden = !hasItem;
  if (!item) {
    els.storageUsageList.replaceChildren();
    return "all";
  }

  const rarity = getMaterialRarity(item.rarity);
  els.storageDetailRarity.textContent = rarity.label;
  els.storageDetailRarity.className = `modal-status rarity-${rarity.id}`;
  els.storageDetailName.textContent = item.name;
  els.storageDetailMeta.textContent = `${getCategoryLabel(item.category)}｜持有 ${item.quantity}`;
  els.storageDetailQuantity.textContent = `×${item.quantity}`;
  els.storageDetailDescription.textContent = item.description || "尚未記錄素材描述。";
  els.storageDetailSource.textContent = item.source || "來源不明。";
  els.storageDetailPrice.textContent = `${item.sellPrice || 0} 金幣`;
  els.storageDetailGeneralUsage.textContent = item.usage || "尚未記錄用途。";

  const counts = getMaterialUsageCounts(usageIndex, item.id);
  const resolvedUsageFilter = usageFilter !== "all" && counts[usageFilter] === 0 ? "all" : usageFilter;
  renderUsageFilters({
    element: els.storageUsageFilters,
    counts,
    activeFilter: resolvedUsageFilter,
    onUsageFilterChange
  });
  const usages = getMaterialUsages(usageIndex, item.id, resolvedUsageFilter);
  els.storageUsageCount.textContent = `${usages.length} 項`;
  renderUsageList({ element: els.storageUsageList, usages, expandedUsageIds, onUsageToggle });
  return resolvedUsageFilter;
}

function renderUsageFilters({ element, counts, activeFilter, onUsageFilterChange }) {
  element.replaceChildren();
  MATERIAL_USAGE_FILTERS.forEach((filter) => {
    const count = counts[filter.id] || 0;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "filter-chip";
    const active = filter.id === activeFilter;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
    button.disabled = filter.id !== "all" && count === 0;
    button.textContent = `${filter.label} ${count}`;
    button.addEventListener("click", () => onUsageFilterChange?.(filter.id));
    element.append(button);
  });
}

function renderUsageList({ element, usages, expandedUsageIds, onUsageToggle }) {
  element.replaceChildren();
  if (usages.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state material-usage-empty";
    empty.textContent = "目前沒有已實作的武器製作或整備強化用途。";
    element.append(empty);
    return;
  }

  let previousType = null;
  usages.forEach((usage) => {
    if (usage.type !== previousType) {
      const group = document.createElement("h5");
      group.className = "material-usage-group-title";
      group.textContent = usage.type === "preparation" ? "冒險前整備" : "武器製作";
      element.append(group);
      previousType = usage.type;
    }

    const card = document.createElement("article");
    card.className = `material-usage-card usage-${usage.type}`;
    const heading = document.createElement("div");
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = usage.title;
    const meta = document.createElement("small");
    meta.textContent = `${usage.location}｜需要 ×${usage.quantity}`;
    copy.append(title, meta);
    const quantity = document.createElement("b");
    quantity.textContent = `×${usage.quantity}`;
    heading.append(copy, quantity);

    const subtitle = document.createElement("span");
    subtitle.textContent = usage.subtitle;
    const description = document.createElement("p");
    const expanded = expandedUsageIds.has(usage.id);
    description.className = "material-usage-description";
    description.classList.toggle("is-expanded", expanded);
    description.textContent = usage.description;
    card.append(heading, subtitle, description);

    if (usage.description.length > 42) {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "material-usage-toggle";
      toggle.textContent = expanded ? "收合效果說明" : "展開完整效果";
      toggle.setAttribute("aria-expanded", String(expanded));
      toggle.addEventListener("click", () => onUsageToggle?.(usage.id));
      card.append(toggle);
    }
    element.append(card);
  });
}

function getCategoryLabel(category) {
  return category === "material" ? "素材" : category || "物品";
}
