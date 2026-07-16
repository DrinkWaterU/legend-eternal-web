import { createMaterialSaleQuote, MATERIAL_SALE_POLICIES } from "../core/commerce.js";
import { getMaterialRarity } from "../data/materials.js";
import { getSellableMaterials } from "./materialList.js";
import { renderStandaloneDialogueText } from "./dialogueView.js";

const TIER_LABELS = Object.freeze({
  "below-minimum": "未達收購標準",
  small: "少量交付 90%",
  large: "大量交付 110%",
  bulk: "大宗交付 115%"
});

const TIER_CLASS_NAMES = Object.freeze({
  "below-minimum": "ineligible",
  small: "low",
  large: "standard",
  bulk: "bulk"
});

export function createGuildBulkDraft({ inventory, materialDefinitions, quantities = {} }) {
  const sellableItems = getSellableMaterials(inventory, materialDefinitions);
  const items = [];
  let totalQuantity = 0;
  let totalGold = 0;
  let totalReferenceGold = 0;

  sellableItems.forEach((item) => {
    const quantity = Number(quantities[item.id]);
    if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > item.quantity) return;
    const quote = createMaterialSaleQuote({
      materialDefinition: materialDefinitions[item.id],
      quantity,
      policyId: MATERIAL_SALE_POLICIES.GUILD_BULK,
      allowUnaccepted: true
    });
    items.push({ ...item, ...quote });
    totalQuantity += quantity;
    totalGold += quote.totalGold;
    totalReferenceGold += quote.referenceGold;
  });

  return {
    items,
    totalQuantity,
    totalGold,
    totalReferenceGold,
    totalDifferenceGold: totalGold - totalReferenceGold,
    valid: items.length > 0 && items.every((item) => item.accepted)
  };
}

export function renderGuildBulkSaleView({
  els,
  inventory,
  materialDefinitions,
  npc,
  quantities,
  draft,
  filters = {},
  message,
  messageKey,
  notice = "",
  noticeType = "status",
  onQuantityChange,
  onQuantityInput,
  onSelect,
  onMax,
  onRemove,
  onClearDraft,
  onConfirmRequest,
  onFilterChange,
  animateMessage = true
}) {
  renderGuildBulkSpeaker(els, npc);
  els.guildBulkGold.textContent = String(inventory?.gold || 0);
  els.guildBulkNotice.textContent = notice;
  els.guildBulkNotice.dataset.type = noticeType;
  renderStandaloneDialogueText({
    els: {
      dialogueText: els.guildBulkDialogueText,
      dialogueTextRegion: els.guildBulkDialogueTextRegion,
      dialogueSkipButton: els.guildBulkDialogueSkipButton
    },
    text: message,
    pageKey: messageKey,
    animateText: animateMessage
  });

  bindFilters({ els, filters, onFilterChange });
  const items = getVisibleMaterials({ inventory, materialDefinitions, filters });
  if (els.guildBulkResultCount) els.guildBulkResultCount.textContent = `${items.length} 項`;
  els.guildBulkEmpty.hidden = items.length > 0;
  els.guildBulkGrid.replaceChildren();
  items.forEach((item) => {
    const quantity = Number.isSafeInteger(quantities[item.id]) ? quantities[item.id] : 0;
    els.guildBulkGrid.append(createMaterialCard({
      item,
      quantity,
      materialDefinitions,
      onQuantityChange,
      onQuantityInput,
      onSelect,
      onMax,
      onRemove
    }));
  });

  renderSummary({ els, draft, onClearDraft, onConfirmRequest });
}

export function renderGuildBulkConfirmPanel({ els, plan, onConfirm }) {
  els.guildBulkConfirmList.replaceChildren();
  plan.items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "confirm-item";
    const copy = document.createElement("div");
    const name = document.createElement("strong");
    const meta = document.createElement("small");
    const total = document.createElement("b");
    name.textContent = `${item.name} ×${item.quantity}`;
    meta.textContent = `${item.percent}% 公會收購級距`;
    total.textContent = `${item.totalGold} G`;
    copy.append(name, meta);
    row.append(copy, total);
    els.guildBulkConfirmList.append(row);
  });
  els.guildBulkConfirmMeta.textContent = `即將交付 ${plan.items.length} 種素材，共 ${plan.totalQuantity} 件。`;
  els.guildBulkConfirmReference.textContent = `${plan.totalReferenceGold} G`;
  els.guildBulkConfirmTotal.textContent = `${plan.totalGold} G`;
  els.guildBulkConfirmDifference.textContent = formatDifference(plan.totalDifferenceGold);
  els.confirmGuildBulkSaleButton.onclick = onConfirm;
  els.guildBulkConfirmPanel.classList.add("is-visible");
  els.confirmGuildBulkSaleButton.focus?.({ preventScroll: true });
}

export function closeGuildBulkConfirmPanel(els, { restoreFocus = true } = {}) {
  const wasOpen = els.guildBulkConfirmPanel.classList.contains("is-visible");
  els.guildBulkConfirmPanel.classList.remove("is-visible");
  if (restoreFocus && wasOpen) els.confirmGuildBulkDraftButton.focus?.({ preventScroll: true });
}

function bindFilters({ els, filters, onFilterChange }) {
  if (!els.guildBulkSearchInput || !els.guildBulkRegionFilter || !els.guildBulkSortSelect) return;
  const query = String(filters.query || "");
  const region = filters.region || "all";
  const sort = filters.sort || "order";
  if (els.guildBulkSearchInput.value !== query) els.guildBulkSearchInput.value = query;
  els.guildBulkRegionFilter.value = region;
  els.guildBulkSortSelect.value = sort;
  els.guildBulkSearchInput.oninput = () => onFilterChange("query", els.guildBulkSearchInput.value);
  els.guildBulkRegionFilter.onchange = () => onFilterChange("region", els.guildBulkRegionFilter.value);
  els.guildBulkSortSelect.onchange = () => onFilterChange("sort", els.guildBulkSortSelect.value);
}

function getVisibleMaterials({ inventory, materialDefinitions, filters }) {
  const query = String(filters.query || "").trim().toLocaleLowerCase("zh-Hant");
  const region = filters.region || "all";
  const items = getSellableMaterials(inventory, materialDefinitions).filter((item) => {
    const definition = materialDefinitions[item.id] || {};
    const tags = Array.isArray(definition.tags) ? definition.tags : [];
    if (region !== "all" && !tags.includes(region)) return false;
    if (!query) return true;
    return [item.name, item.source, item.description, item.usage]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("zh-Hant")
      .includes(query);
  });
  return [...items].sort((left, right) => {
    switch (filters.sort) {
      case "quantity-desc": return right.quantity - left.quantity || left.sortOrder - right.sortOrder;
      case "price-desc": return right.sellPrice - left.sellPrice || left.sortOrder - right.sortOrder;
      case "name": return left.name.localeCompare(right.name, "zh-Hant-TW");
      default: return left.sortOrder - right.sortOrder;
    }
  });
}

function renderGuildBulkSpeaker(els, npc) {
  const displayName = String(npc?.name || "瑟琳");
  const title = String(npc?.title || "冒險者公會資深接待員");
  const portrait = String(npc?.portrait || "").trim();
  els.guildBulkSpeakerName.textContent = displayName;
  els.guildBulkSpeakerTitle.textContent = title;
  els.guildBulkSpeakerPortraitFallback.textContent = displayName;

  const fallback = () => {
    els.guildBulkSpeakerPortraitImage.hidden = true;
    els.guildBulkSpeakerPortraitFallback.hidden = false;
  };
  if (!portrait) {
    fallback();
    return;
  }
  els.guildBulkSpeakerPortraitImage.alt = `${displayName}的立繪`;
  els.guildBulkSpeakerPortraitImage.onload = () => {
    els.guildBulkSpeakerPortraitImage.hidden = false;
    els.guildBulkSpeakerPortraitFallback.hidden = true;
  };
  els.guildBulkSpeakerPortraitImage.onerror = fallback;
  if (els.guildBulkSpeakerPortraitImage.getAttribute?.("src") !== portrait) {
    els.guildBulkSpeakerPortraitImage.src = portrait;
  } else if (els.guildBulkSpeakerPortraitImage.complete && els.guildBulkSpeakerPortraitImage.naturalWidth > 0) {
    els.guildBulkSpeakerPortraitImage.hidden = false;
    els.guildBulkSpeakerPortraitFallback.hidden = true;
  }
}

function createMaterialCard({
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
  const quote = selected ? getQuote(item, quantity, materialDefinitions) : null;
  const tierClass = quote ? TIER_CLASS_NAMES[quote.tierId] : "";

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
  badge.textContent = selected ? TIER_LABELS[quote.tierId] : eligible ? "選擇後計價" : "未達 5 件";
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
    ? getNextTierHint(quantity, item.quantity)
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
  const input = document.createElement("input");
  input.className = "quantity-input";
  input.type = "number";
  input.inputMode = "numeric";
  input.min = "1";
  input.max = String(item.quantity);
  input.value = String(quantity);
  input.setAttribute("aria-label", `${item.name}交付數量`);
  const error = document.createElement("p");
  error.className = "input-error";
  error.setAttribute("aria-live", "polite");
  input.addEventListener("input", () => {
    const parsed = Number(input.value);
    if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > item.quantity) {
      error.textContent = `請輸入 1～${item.quantity} 的整數。`;
      input.setAttribute("aria-invalid", "true");
    } else {
      error.textContent = "";
      input.removeAttribute("aria-invalid");
    }
  });
  input.addEventListener("change", () => onQuantityInput(item.id, input.value, true));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") input.blur();
  });
  const plusOne = createQuantityButton("＋1", "增加一件", () => onQuantityChange(item.id, 1), quantity >= item.quantity);
  const plusFive = createQuantityButton("＋5", "增加五件", () => onQuantityChange(item.id, 5), quantity >= item.quantity);
  controls.append(minusFive, minusOne, input, plusOne, plusFive);

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

  panel.append(heading, controls, secondary, error);
  actions.append(panel);
  return actions;
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

function renderSummary({ els, draft, onClearDraft, onConfirmRequest }) {
  const hasItems = draft.items.length > 0;
  els.guildBulkClearDraftButton.disabled = !hasItems;
  els.guildBulkClearDraftButton.onclick = hasItems ? onClearDraft : null;
  els.guildBulkSummaryEmpty.hidden = hasItems;
  els.guildBulkSummaryContent.hidden = !hasItems;
  els.guildBulkSummaryList.replaceChildren();

  if (!hasItems) {
    els.confirmGuildBulkDraftButton.disabled = true;
    els.confirmGuildBulkDraftButton.onclick = null;
    if (els.guildBulkSummaryHint) els.guildBulkSummaryHint.textContent = "公會會逐項驗收；不同素材不能合併湊足級距。";
    return;
  }

  draft.items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "summary-item";
    row.classList.toggle("is-invalid", !item.accepted);
    const copy = document.createElement("div");
    const name = document.createElement("strong");
    const tier = document.createElement("small");
    const value = document.createElement("b");
    name.textContent = `${item.name} ×${item.quantity}`;
    tier.textContent = TIER_LABELS[item.tierId];
    value.textContent = item.accepted ? `${item.totalGold} G` : "不受理";
    copy.append(name, tier);
    row.append(copy, value);
    els.guildBulkSummaryList.append(row);
  });
  els.guildBulkSummaryKinds.textContent = String(draft.items.length);
  els.guildBulkSummaryQuantity.textContent = `${draft.totalQuantity} 件`;
  els.guildBulkSummaryReference.textContent = `${draft.totalReferenceGold} G`;
  els.guildBulkSummaryTotal.textContent = `${draft.totalGold} G`;
  els.guildBulkSummaryDifference.textContent = formatDifference(draft.totalDifferenceGold);
  els.guildBulkSummaryDifference.className = draft.totalDifferenceGold > 0
    ? "is-positive"
    : draft.totalDifferenceGold < 0
      ? "is-negative"
      : "";
  els.confirmGuildBulkDraftButton.disabled = !draft.valid;
  els.confirmGuildBulkDraftButton.onclick = draft.valid ? onConfirmRequest : null;
  if (els.guildBulkSummaryHint) {
    els.guildBulkSummaryHint.textContent = draft.valid
      ? "公會會逐項驗收；不同素材不能合併湊足級距。"
      : "有素材未達 5 件最低收購量；提高數量或移除該項後才能確認。";
  }
}

function getQuote(item, quantity, materialDefinitions) {
  return createMaterialSaleQuote({
    materialDefinition: materialDefinitions[item.id],
    quantity,
    policyId: MATERIAL_SALE_POLICIES.GUILD_BULK,
    allowUnaccepted: true
  });
}

function getNextTierHint(quantity, heldQuantity) {
  if (quantity <= 0) return "最低 5 件起收";
  if (quantity < 5) return `再增加 ${5 - quantity} 件可受理`;
  if (quantity < 10) return heldQuantity >= 10 ? `再增加 ${10 - quantity} 件可提升至 110%` : "目前持有量無法進入下一級距";
  if (quantity < 20) return heldQuantity >= 20 ? `再增加 ${20 - quantity} 件可提升至 115%` : "目前持有量無法進入下一級距";
  return "已達最高大宗級距";
}

function formatDifference(value) {
  if (!Number.isSafeInteger(value) || value === 0) return "0 G";
  return `${value > 0 ? "＋" : "−"}${Math.abs(value)} G`;
}
