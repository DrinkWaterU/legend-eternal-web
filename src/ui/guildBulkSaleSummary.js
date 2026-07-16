import {
  GUILD_BULK_TIER_LABELS,
  formatGuildBulkDifference
} from "./guildBulkSalePresentation.js";

export function renderGuildBulkSummary({ els, draft, onClearDraft, onConfirmRequest }) {
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
    tier.textContent = GUILD_BULK_TIER_LABELS[item.tierId];
    value.textContent = item.accepted ? `${item.totalGold} G` : "不受理";
    copy.append(name, tier);
    row.append(copy, value);
    els.guildBulkSummaryList.append(row);
  });
  els.guildBulkSummaryKinds.textContent = String(draft.items.length);
  els.guildBulkSummaryQuantity.textContent = `${draft.totalQuantity} 件`;
  els.guildBulkSummaryReference.textContent = `${draft.totalReferenceGold} G`;
  els.guildBulkSummaryTotal.textContent = `${draft.totalGold} G`;
  els.guildBulkSummaryDifference.textContent = formatGuildBulkDifference(draft.totalDifferenceGold);
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
  els.guildBulkConfirmDifference.textContent = formatGuildBulkDifference(plan.totalDifferenceGold);
  els.confirmGuildBulkSaleButton.onclick = onConfirm;
  els.guildBulkConfirmPanel.classList.add("is-visible");
  els.confirmGuildBulkSaleButton.focus?.({ preventScroll: true });
}

export function closeGuildBulkConfirmPanel(els, { restoreFocus = true } = {}) {
  const wasOpen = els.guildBulkConfirmPanel.classList.contains("is-visible");
  els.guildBulkConfirmPanel.classList.remove("is-visible");
  if (restoreFocus && wasOpen) els.confirmGuildBulkDraftButton.focus?.({ preventScroll: true });
}
