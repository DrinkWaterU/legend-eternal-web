import { renderStandaloneDialogueText } from "./dialogueView.js";
import { createGuildBulkMaterialCard } from "./guildBulkSaleMaterialCard.js";
import { getVisibleGuildBulkMaterials } from "./guildBulkSaleModel.js";
import { renderGuildBulkSummary } from "./guildBulkSaleSummary.js";

export { createGuildBulkDraft } from "./guildBulkSaleModel.js";
export {
  closeGuildBulkConfirmPanel,
  renderGuildBulkConfirmPanel
} from "./guildBulkSaleSummary.js";

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
  const items = getVisibleGuildBulkMaterials({ inventory, materialDefinitions, filters });
  if (els.guildBulkResultCount) els.guildBulkResultCount.textContent = `${items.length} 項`;
  els.guildBulkEmpty.hidden = items.length > 0;
  els.guildBulkGrid.replaceChildren();
  items.forEach((item) => {
    const quantity = Number.isSafeInteger(quantities[item.id]) ? quantities[item.id] : 0;
    els.guildBulkGrid.append(createGuildBulkMaterialCard({
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

  renderGuildBulkSummary({ els, draft, onClearDraft, onConfirmRequest });
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
