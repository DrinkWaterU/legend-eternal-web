import { getMaterialRarity } from "../data/materials.js";
import { getSellableMaterials, sortMaterials } from "./materialList.js";

export function renderMerchantView({
  els,
  inventory,
  materialDefinitions,
  sortMode,
  sortDirection,
  notice = "",
  noticeType = "status",
  onSortChange,
  onDirectionChange,
  onMaterialClick
}) {
  const items = sortMaterials(getSellableMaterials(inventory, materialDefinitions), sortMode, sortDirection);
  els.merchantGold.textContent = String(inventory?.gold || 0);
  els.merchantSortSelect.value = sortMode;
  els.merchantSortDirectionButton.textContent = sortDirection === "asc" ? "升序" : "降序";
  els.merchantSortDirectionButton.dataset.direction = sortDirection;
  els.merchantSortSelect.onchange = () => onSortChange(els.merchantSortSelect.value);
  els.merchantSortDirectionButton.onclick = () => onDirectionChange(sortDirection === "asc" ? "desc" : "asc");
  els.merchantNotice.textContent = notice;
  els.merchantNotice.dataset.type = noticeType;
  els.merchantGrid.replaceChildren();
  els.merchantEmpty.classList.toggle("is-hidden", items.length > 0);

  items.forEach((item) => {
    const rarity = getMaterialRarity(item.rarity);
    const button = document.createElement("button");
    button.className = `merchant-slot rarity-${rarity.id}`;
    button.type = "button";

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
    button.addEventListener("click", () => onMaterialClick(item));
    els.merchantGrid.append(button);
  });
}

export function renderMerchantSalePanel({ els, item, quantity, onDecrease, onIncrease, onMax, onConfirm }) {
  if (!item) {
    closeMerchantSalePanel(els);
    return;
  }
  const normalizedQuantity = Math.min(item.quantity, Math.max(1, Math.floor(quantity || 1)));
  els.merchantSaleTitle.textContent = item.name;
  els.merchantSaleMeta.textContent = `持有 ${item.quantity}｜收購價 ${item.sellPrice} 金幣 / 個`;
  els.merchantSaleQuantity.textContent = String(normalizedQuantity);
  els.merchantSaleTotal.textContent = `${item.sellPrice * normalizedQuantity} 金幣`;
  els.merchantSaleDecreaseButton.disabled = normalizedQuantity <= 1;
  els.merchantSaleIncreaseButton.disabled = normalizedQuantity >= item.quantity;
  els.merchantSaleDecreaseButton.onclick = onDecrease;
  els.merchantSaleIncreaseButton.onclick = onIncrease;
  els.merchantSaleMaxButton.onclick = onMax;
  els.confirmMerchantSaleButton.onclick = onConfirm;
  els.merchantSalePanel.classList.add("is-visible");
}

export function closeMerchantSalePanel(els) {
  els.merchantSalePanel.classList.remove("is-visible");
}
