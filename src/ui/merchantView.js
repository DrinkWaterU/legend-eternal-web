import { getMaterialRarity } from "../data/materials.js";
import { getSellableMaterials, sortMaterials } from "./materialList.js";

export function renderMerchantView({
  els,
  inventory,
  materialDefinitions,
  sortMode,
  sortDirection,
  batchMode = false,
  selectedMaterialIds = new Set(),
  batchPreview = createMerchantBatchPreview([], selectedMaterialIds),
  notice = "",
  noticeType = "status",
  onSortChange,
  onDirectionChange,
  onMaterialClick,
  onBatchModeToggle,
  onBatchSelectionToggle,
  onBatchConfirm,
  onBatchCancel
}) {
  const items = sortMaterials(getSellableMaterials(inventory, materialDefinitions), sortMode, sortDirection);
  els.merchantGold.textContent = String(inventory?.gold || 0);
  els.merchantSortSelect.value = sortMode;
  els.merchantSortDirectionButton.textContent = sortDirection === "asc" ? "升序" : "降序";
  els.merchantSortDirectionButton.dataset.direction = sortDirection;
  els.merchantSortSelect.onchange = () => onSortChange(els.merchantSortSelect.value);
  els.merchantSortDirectionButton.onclick = () => onDirectionChange(sortDirection === "asc" ? "desc" : "asc");
  els.merchantBatchToggleButton.textContent = batchMode ? "結束批次" : "批次販賣";
  els.merchantBatchToggleButton.setAttribute("aria-pressed", String(batchMode));
  els.merchantBatchToggleButton.disabled = items.length === 0 && !batchMode;
  els.merchantBatchToggleButton.onclick = onBatchModeToggle;
  els.merchantNotice.textContent = notice;
  els.merchantNotice.dataset.type = noticeType;
  els.merchantBatchBar.hidden = !batchMode;
  if (batchMode) {
    els.merchantBatchSummary.textContent = batchPreview.items.length > 0
      ? `已選 ${batchPreview.items.length} 種素材，共 ${batchPreview.totalQuantity} 件`
      : "尚未選取素材";
    els.merchantBatchTotal.textContent = `預計取得 ${batchPreview.totalGold} 金幣`;
    els.confirmMerchantBatchButton.disabled = batchPreview.items.length === 0;
    els.confirmMerchantBatchButton.onclick = onBatchConfirm;
    els.cancelMerchantBatchButton.onclick = onBatchCancel;
  }
  els.merchantGrid.replaceChildren();
  els.merchantEmpty.classList.toggle("is-hidden", items.length > 0);

  items.forEach((item) => {
    const rarity = getMaterialRarity(item.rarity);
    const selected = batchMode && selectedMaterialIds.has(item.id);
    const button = document.createElement("button");
    button.className = `merchant-slot rarity-${rarity.id}`;
    button.type = "button";
    button.classList.toggle("is-batch-mode", batchMode);
    button.classList.toggle("is-selected", selected);
    if (batchMode) {
      button.setAttribute("aria-pressed", String(selected));
    }

    const rarityLabel = document.createElement("span");
    const name = document.createElement("strong");
    const price = document.createElement("small");
    const quantity = document.createElement("b");
    rarityLabel.className = "inventory-slot-rarity";
    rarityLabel.textContent = rarity.label;
    name.textContent = item.name;
    price.textContent = `${item.sellPrice} 金幣 / 個`;
    quantity.textContent = `x${item.quantity}`;
    button.append(rarityLabel, name, price, quantity);
    if (batchMode) {
      const selectionMark = document.createElement("span");
      selectionMark.className = "merchant-selection-mark";
      selectionMark.textContent = selected ? "✓ 已選" : "選取";
      button.append(selectionMark);
      button.addEventListener("click", () => onBatchSelectionToggle(item.id));
    } else {
      button.addEventListener("click", () => onMaterialClick(item));
    }
    els.merchantGrid.append(button);
  });
}

export function createMerchantBatchPreview(items = [], selectedMaterialIds = new Set()) {
  const selectedIds = selectedMaterialIds instanceof Set
    ? selectedMaterialIds
    : new Set(selectedMaterialIds || []);
  const selectedItems = [];
  let totalQuantity = 0;
  let totalGold = 0;

  items.forEach((item) => {
    if (
      !selectedIds.has(item.id)
      || !Number.isSafeInteger(item.quantity)
      || item.quantity <= 0
      || !Number.isSafeInteger(item.sellPrice)
      || item.sellPrice <= 0
    ) {
      return;
    }
    const itemTotalGold = item.quantity * item.sellPrice;
    const nextTotalQuantity = totalQuantity + item.quantity;
    const nextTotalGold = totalGold + itemTotalGold;
    if (
      !Number.isSafeInteger(itemTotalGold)
      || !Number.isSafeInteger(nextTotalQuantity)
      || !Number.isSafeInteger(nextTotalGold)
    ) {
      return;
    }
    selectedItems.push({
      materialId: item.id,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.sellPrice,
      totalGold: itemTotalGold
    });
    totalQuantity = nextTotalQuantity;
    totalGold = nextTotalGold;
  });

  return {
    items: selectedItems,
    totalQuantity,
    totalGold
  };
}

export function getValidMerchantSaleQuantity(value, maxQuantity) {
  const quantity = Number(value);
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > maxQuantity) {
    return null;
  }
  return quantity;
}

export function renderMerchantSalePanel({
  els,
  item,
  quantity,
  quantityInput = String(quantity),
  onDecreaseFive,
  onDecrease,
  onIncrease,
  onIncreaseFive,
  onMax,
  onQuantityInput,
  onQuantityCommit,
  onConfirm
}) {
  if (!item) {
    closeMerchantSalePanel(els);
    return;
  }
  const normalizedQuantity = Math.min(item.quantity, Math.max(1, Math.floor(quantity || 1)));
  els.merchantSaleTitle.textContent = item.name;
  els.merchantSaleMeta.textContent = `持有 ${item.quantity}｜收購價 ${item.sellPrice} 金幣 / 個`;
  els.merchantQuantityControl.hidden = false;
  els.merchantBatchSaleList.hidden = true;
  els.merchantSaleQuantity.min = "1";
  els.merchantSaleQuantity.max = String(item.quantity);
  els.merchantSaleQuantity.value = quantityInput;
  els.confirmMerchantSaleButton.textContent = "確認出售";
  els.merchantSaleDecreaseFiveButton.onclick = onDecreaseFive;
  els.merchantSaleDecreaseButton.onclick = onDecrease;
  els.merchantSaleIncreaseButton.onclick = onIncrease;
  els.merchantSaleIncreaseFiveButton.onclick = onIncreaseFive;
  els.merchantSaleMaxButton.onclick = onMax;
  els.confirmMerchantSaleButton.onclick = onConfirm;
  els.merchantSaleQuantity.oninput = () => {
    const validQuantity = updateMerchantSaleQuantityPreview(els, item, els.merchantSaleQuantity.value);
    onQuantityInput(els.merchantSaleQuantity.value, validQuantity);
  };
  els.merchantSaleQuantity.onchange = () => onQuantityCommit(els.merchantSaleQuantity.value);
  updateMerchantSaleQuantityPreview(els, item, quantityInput, normalizedQuantity);
  els.merchantSalePanel.classList.add("is-visible");
}

export function renderMerchantBatchSalePanel({ els, preview, onConfirm }) {
  if (!preview || preview.items.length === 0) {
    closeMerchantSalePanel(els);
    return;
  }

  els.merchantSaleTitle.textContent = "確認批次販賣";
  els.merchantSaleMeta.textContent = `將出售 ${preview.items.length} 種素材，共 ${preview.totalQuantity} 件。`;
  els.merchantQuantityControl.hidden = true;
  els.merchantBatchSaleList.hidden = false;
  els.merchantBatchSaleList.replaceChildren();
  preview.items.forEach((item) => {
    const row = document.createElement("div");
    const description = document.createElement("span");
    const subtotal = document.createElement("strong");
    description.textContent = `${item.name} x${item.quantity}｜${item.unitPrice} 金幣 / 個`;
    subtotal.textContent = `${item.totalGold} 金幣`;
    row.append(description, subtotal);
    els.merchantBatchSaleList.append(row);
  });
  els.merchantSaleTotal.textContent = `${preview.totalGold} 金幣`;
  els.confirmMerchantSaleButton.textContent = "確認批次出售";
  els.confirmMerchantSaleButton.disabled = false;
  els.confirmMerchantSaleButton.onclick = onConfirm;
  els.merchantSalePanel.classList.add("is-visible");
}

export function closeMerchantSalePanel(els) {
  els.merchantSalePanel.classList.remove("is-visible");
}

function updateMerchantSaleQuantityPreview(els, item, value, fallbackQuantity = null) {
  const validQuantity = getValidMerchantSaleQuantity(value, item.quantity);
  const displayQuantity = validQuantity ?? fallbackQuantity;
  const canSell = validQuantity !== null;
  els.merchantSaleTotal.textContent = displayQuantity === null
    ? "—"
    : `${item.sellPrice * displayQuantity} 金幣`;
  els.merchantSaleDecreaseFiveButton.disabled = !canSell || validQuantity <= 1;
  els.merchantSaleDecreaseButton.disabled = !canSell || validQuantity <= 1;
  els.merchantSaleIncreaseButton.disabled = !canSell || validQuantity >= item.quantity;
  els.merchantSaleIncreaseFiveButton.disabled = !canSell || validQuantity >= item.quantity;
  els.merchantSaleMaxButton.disabled = canSell && validQuantity >= item.quantity;
  els.confirmMerchantSaleButton.disabled = !canSell;
  return validQuantity;
}
