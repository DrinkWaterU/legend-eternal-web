import { getMaterialRarity } from "../data/materials.js";
import { getGuildBulkQuote } from "./guildBulkSaleModel.js";
import {
  GUILD_BULK_TIER_CLASS_NAMES,
  GUILD_BULK_TIER_LABELS,
  getNextGuildBulkTierHint
} from "./guildBulkSalePresentation.js";

export function createGuildBulkMaterialCard({
  item,
  quantity,
  materialDefinitions,
  onQuantityChange,
  onQuantityInput,
  onSelect,
  onMax,
  onRemove
}) {
  const rarity = getMaterialRarity(item.rarity);
  const selected = quantity > 0;
  const eligible = item.quantity >= 5;
  const quote = selected ? getGuildBulkQuote(item, quantity, materialDefinitions) : null;
  const tierClass = quote ? GUILD_BULK_TIER_CLASS_NAMES[quote.tierId] : "";

  const card = document.createElement("article");
  card.className = `guild-material-card rarity-${rarity.id}`;
  card.classList.toggle("is-selected", selected);
  card.classList.toggle("is-ineligible", !eligible);
  card.dataset.materialId = item.id;

  const top = document.createElement("div");
  top.className = "material-card-top";
  const titleGroup = document.createElement("div");
  const titleLine = document.createElement("div");
  titleLine.className = "material-title-line";
  const rarityLabel = document.createElement("span");
  rarityLabel.className = "rarity-label";
  rarityLabel.textContent = rarity.label;
  const name = document.createElement("h4");
  name.textContent = item.name;
  titleLine.append(rarityLabel, name);
  const source = document.createElement("p");
  source.className = "material-source";
  source.textContent = item.source || "來源不明";
  titleGroup.append(titleLine, source);
  const held = document.createElement("div");
  held.className = "material-held";
  const heldLabel = document.createElement("span");
  heldLabel.textContent = "目前持有";
  const heldValue = document.createElement("strong");
  heldValue.textContent = `${item.quantity} 件`;
  held.append(heldLabel, heldValue);
  top.append(titleGroup, held);

  const body = document.createElement("div");
  body.className = "material-card-body";
  body.append(
    createPriceReference({ item, quantity, quote, eligible, selected, tierClass }),
    createMaterialActions({ item, quantity, selected, eligible, onQuantityChange, onQuantityInput, onSelect, onMax, onRemove })
  );
  card.append(top, body);
  return card;
}

function createPriceReference({ item, quantity, quote, eligible, selected, tierClass }) {
  const panel = document.createElement("div");
  panel.className = "material-price-reference";
  const reference = createPriceRow("reference-row", "旅行商人單價", `${item.sellPrice} G / 個`);
  const guild = createPriceRow(
    "quote-row",
    "公會報價",
    selected ? (quote.accepted ? `${quote.totalGold} G` : "不受理") : "—"
  );
  const status = document.createElement("div");
  status.className = "tier-status";
  const badge = document.createElement("span");
  badge.className = `tier-badge${tierClass ? ` is-${tierClass}` : ""}`;
  badge.textContent = selected ? GUILD_BULK_TIER_LABELS[quote.tierId] : eligible ? "選擇後計價" : "未達 5 件";
  const difference = document.createElement("span");
  difference.className = "price-difference is-neutral";
  if (!selected) {
    difference.textContent = "尚未選擇";
  } else if (!quote.accepted) {
    difference.className = "price-difference is-negative";
    difference.textContent = "未達最低 5 件，不可交付";
  } else {
    difference.className = `price-difference ${quote.differenceGold > 0 ? "is-positive" : quote.differenceGold < 0 ? "is-negative" : "is-neutral"}`;
    difference.textContent = quote.differenceGold > 0
      ? `比旅行商人多 ${quote.differenceGold} G`
      : quote.differenceGold < 0
        ? `比旅行商人少 ${Math.abs(quote.differenceGold)} G`
        : "與旅行商人相同";
  }
  status.append(badge, difference);
  const hint = document.createElement("p");
  hint.className = "next-tier-hint";
  hint.textContent = selected
    ? getNextGuildBulkTierHint(quantity, item.quantity)
    : eligible
      ? "最低選擇 5 件；可再依庫存提高數量。"
      : `目前還差 ${5 - item.quantity} 件才符合公會收購標準。`;
  panel.append(reference, guild, status, hint);
  return panel;
}

function createPriceRow(className, labelText, valueText) {
  const row = document.createElement("div");
  row.className = className;
  const label = document.createElement("span");
  const value = document.createElement("strong");
  label.textContent = labelText;
  value.textContent = valueText;
  row.append(label, value);
  return row;
}

function createMaterialActions({
  item,
  quantity,
  selected,
  eligible,
  onQuantityChange,
  onQuantityInput,
  onSelect,
  onMax,
  onRemove
}) {
  const actions = document.createElement("div");
  actions.className = "material-action-area";
  if (!selected) {
    const add = document.createElement("button");
    add.className = "add-material-button";
    add.type = "button";
    add.textContent = eligible ? "選擇交付 5 件" : `查看持有的 ${item.quantity} 件`;
    add.addEventListener("click", () => onSelect(item.id, eligible ? 5 : item.quantity));
    actions.append(add);
    return actions;
  }

  const panel = document.createElement("div");
  panel.className = "quantity-panel";
  const heading = document.createElement("div");
  heading.className = "quantity-panel-heading";
  const label = document.createElement("span");
  label.textContent = "本次交付數量";
  const count = document.createElement("strong");
  count.textContent = `${quantity} / ${item.quantity}`;
  heading.append(label, count);

  const controls = document.createElement("div");
  controls.className = "quantity-control";
  const minusFive = createQuantityButton("−5", "減少五件", () => onQuantityChange(item.id, -5), quantity <= 1);
  const minusOne = createQuantityButton("−1", "減少一件", () => onQuantityChange(item.id, -1), quantity <= 1);
  const input = createQuantityInput({ item, quantity, onQuantityInput });
  const plusOne = createQuantityButton("＋1", "增加一件", () => onQuantityChange(item.id, 1), quantity >= item.quantity);
  const plusFive = createQuantityButton("＋5", "增加五件", () => onQuantityChange(item.id, 5), quantity >= item.quantity);
  controls.append(minusFive, minusOne, input.field, plusOne, plusFive);

  const secondary = document.createElement("div");
  secondary.className = "quantity-secondary-actions";
  const max = document.createElement("button");
  max.type = "button";
  max.textContent = "最大";
  max.disabled = quantity >= item.quantity;
  max.addEventListener("click", () => onMax(item.id));
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "remove-material-button";
  remove.textContent = "移除此項";
  remove.addEventListener("click", () => onRemove(item.id));
  secondary.append(max, remove);

  panel.append(heading, controls, secondary, input.error);
  actions.append(panel);
  return actions;
}

function createQuantityInput({ item, quantity, onQuantityInput }) {
  const field = document.createElement("input");
  field.className = "quantity-input";
  field.type = "number";
  field.inputMode = "numeric";
  field.min = "1";
  field.max = String(item.quantity);
  field.value = String(quantity);
  field.setAttribute("aria-label", `${item.name}交付數量`);
  const error = document.createElement("p");
  error.className = "input-error";
  error.setAttribute("aria-live", "polite");
  field.addEventListener("input", () => {
    const parsed = Number(field.value);
    if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > item.quantity) {
      error.textContent = `請輸入 1～${item.quantity} 的整數。`;
      field.setAttribute("aria-invalid", "true");
    } else {
      error.textContent = "";
      field.removeAttribute("aria-invalid");
    }
  });
  field.addEventListener("change", () => onQuantityInput(item.id, field.value, true));
  field.addEventListener("keydown", (event) => {
    if (event.key === "Enter") field.blur();
  });
  return { field, error };
}

function createQuantityButton(text, label, action, disabled = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "quantity-button";
  button.textContent = text;
  button.disabled = disabled;
  button.setAttribute("aria-label", label);
  bindRepeatAction(button, action);
  return button;
}

function bindRepeatAction(button, action) {
  let delayTimer = null;
  let repeatTimer = null;
  let startedByPointer = false;
  const stop = () => {
    clearTimeout(delayTimer);
    clearInterval(repeatTimer);
    delayTimer = null;
    repeatTimer = null;
  };
  button.addEventListener("pointerdown", (event) => {
    if (button.disabled || (event.button !== undefined && event.button !== 0)) return;
    startedByPointer = true;
    event.preventDefault();
    action();
    delayTimer = setTimeout(() => {
      repeatTimer = setInterval(action, 115);
    }, 380);
    const target = globalThis.window?.addEventListener ? globalThis.window : globalThis.document;
    target?.addEventListener?.("pointerup", stop, { once: true });
    target?.addEventListener?.("pointercancel", stop, { once: true });
  });
  button.addEventListener("click", (event) => {
    if (startedByPointer) {
      startedByPointer = false;
      event.preventDefault();
      return;
    }
    if (!button.disabled) action();
  });
}
