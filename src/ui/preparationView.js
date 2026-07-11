export function renderPreparationChoices({
  element,
  preparations,
  selectedPreparationId,
  detailPreparationId,
  detailExpanded,
  enhancedPreparationId = null,
  gold,
  inventoryMaterials = {},
  materialDefinitions = {},
  onSelect
}) {
  element.replaceChildren();
  appendPreparationOption({
    element,
    id: null,
    name: "不進行整備",
    summary: "維持原本流程",
    priceLabel: "免費",
    selected: selectedPreparationId === null,
    detailOpen: detailPreparationId === null && detailExpanded,
    unavailable: false,
    enhancementStatus: null,
    onSelect
  });

  preparations.forEach((preparation) => {
    const affordable = gold >= preparation.cost;
    const materialState = getEnhancementMaterialState({
      preparation,
      inventoryMaterials,
      materialDefinitions
    });
    const enhanced = enhancedPreparationId === preparation.id;
    appendPreparationOption({
      element,
      id: preparation.id,
      name: preparation.name,
      summary: preparation.summary,
      priceLabel: affordable ? `${preparation.cost} 金幣` : "金幣不足",
      selected: selectedPreparationId === preparation.id,
      detailOpen: detailPreparationId === preparation.id && detailExpanded,
      unavailable: !affordable,
      enhancementStatus: preparation.enhancement
        ? {
            label: enhanced
              ? "已啟用素材強化"
              : materialState.available
                ? "素材可強化"
                : "強化素材不足",
            type: enhanced ? "active" : materialState.available ? "ready" : "missing"
          }
        : null,
      enhanced,
      onSelect
    });
  });
}

export function renderPreparationDetail({
  element,
  preparation,
  expanded,
  priceLabel,
  selected = false,
  enhanced = false,
  animateEnhancement = false,
  inventoryMaterials = {},
  materialDefinitions = {},
  onToggleEnhancement = null
}) {
  element.classList.toggle("is-open", expanded);
  element.setAttribute("aria-hidden", String(!expanded));
  element.replaceChildren();

  const card = document.createElement("div");
  const label = document.createElement("span");
  const title = document.createElement("strong");
  const price = document.createElement("b");
  const description = document.createElement("p");
  card.className = "preparation-detail-card";
  card.classList.toggle("is-enhanced", enhanced);
  card.classList.toggle("is-enhancement-reveal", enhanced && animateEnhancement);
  label.className = "preparation-detail-effect-label";
  label.classList.toggle("is-reveal", enhanced && animateEnhancement);
  label.textContent = enhanced ? "強化效果" : "整備效果";
  title.textContent = preparation?.name || "不進行整備";
  price.textContent = priceLabel;
  description.className = "preparation-effect-description";

  if (preparation && enhanced && preparation.enhancement) {
    appendHighlightedDescription({
      element: description,
      description: preparation.enhancement.description,
      changedFragments: preparation.enhancement.changedFragments,
      animate: animateEnhancement
    });
  } else {
    description.textContent = preparation?.description || "不花費金幣，維持原本冒險流程。";
  }

  card.append(label, title, price, description);
  if (preparation?.enhancement) {
    card.append(createEnhancementSection({
      preparation,
      selected,
      enhanced,
      inventoryMaterials,
      materialDefinitions,
      onToggleEnhancement
    }));
  }
  element.append(card);
}

export function getEnhancementMaterialState({ preparation, inventoryMaterials = {}, materialDefinitions = {} }) {
  const costs = Array.isArray(preparation?.enhancement?.materialCosts)
    ? preparation.enhancement.materialCosts
    : [];
  const items = costs.map((cost) => {
    const definition = materialDefinitions[cost.materialId];
    const owned = getHeldQuantity(inventoryMaterials, cost.materialId);
    return {
      materialId: cost.materialId,
      name: definition?.name || cost.materialId,
      quantity: cost.quantity,
      owned,
      enough: owned >= cost.quantity
    };
  });
  return {
    items,
    available: items.length > 0 && items.every((item) => item.enough)
  };
}

function createEnhancementSection({
  preparation,
  selected,
  enhanced,
  inventoryMaterials,
  materialDefinitions,
  onToggleEnhancement
}) {
  const materialState = getEnhancementMaterialState({
    preparation,
    inventoryMaterials,
    materialDefinitions
  });
  const section = document.createElement("section");
  const heading = document.createElement("div");
  const headingCopy = document.createElement("div");
  const label = document.createElement("span");
  const title = document.createElement("strong");
  const status = document.createElement("span");
  const materialList = document.createElement("div");
  const hint = document.createElement("p");
  const button = document.createElement("button");

  section.className = "preparation-enhancement";
  section.classList.toggle("is-active", enhanced);
  heading.className = "preparation-enhancement-heading";
  label.textContent = "素材強化";
  title.textContent = preparation.enhancement.title;
  status.className = "preparation-enhancement-status";
  status.dataset.type = enhanced
    ? "active"
    : !selected
      ? "idle"
      : materialState.available
        ? "ready"
        : "missing";
  status.textContent = enhanced
    ? "已啟用"
    : !selected
      ? "請先選擇"
      : materialState.available
        ? "可強化"
        : "素材不足";

  headingCopy.append(label, title);
  heading.append(headingCopy, status);

  materialList.className = "preparation-enhancement-materials";
  materialState.items.forEach((item) => {
    const row = document.createElement("div");
    const name = document.createElement("span");
    const quantity = document.createElement("strong");
    row.className = "preparation-enhancement-material";
    row.classList.toggle("is-ready", item.enough);
    row.classList.toggle("is-missing", !item.enough);
    name.textContent = item.name;
    quantity.textContent = `${item.owned} / ${item.quantity}`;
    row.append(name, quantity);
    materialList.append(row);
  });

  hint.className = "preparation-enhancement-hint";
  hint.textContent = enhanced
    ? "已切換為強化效果；上方金色文字就是本次變化。正式出發時才會與金幣一次結算。"
    : !selected
      ? "先選擇此整備，才能啟用素材強化。"
      : materialState.available
        ? "素材足夠，啟用後會在上方效果原位標出變化。素材會在正式出發時才扣除。"
        : "目前素材不足；普通整備仍可使用，素材會在正式出發時才扣除。";

  button.type = "button";
  button.className = enhanced ? "secondary-button" : "primary-button";
  button.classList.add("preparation-enhancement-button");
  button.disabled = !selected || (!enhanced && !materialState.available);
  button.textContent = enhanced
    ? "取消素材強化"
    : !selected
      ? "請先選擇整備"
      : materialState.available
        ? "使用素材強化"
        : "素材不足";
  button.addEventListener("click", () => onToggleEnhancement?.(preparation.id));

  section.append(heading, materialList, hint, button);
  return section;
}

function appendHighlightedDescription({ element, description, changedFragments, animate }) {
  let cursor = 0;
  changedFragments.forEach((fragment, index) => {
    const start = description.indexOf(fragment, cursor);
    element.append(document.createTextNode(description.slice(cursor, start)));
    const highlight = document.createElement("span");
    highlight.className = "preparation-effect-change";
    highlight.classList.toggle("is-reveal", animate);
    highlight.style.animationDelay = animate ? `${index * 90}ms` : "0ms";
    highlight.textContent = fragment;
    element.append(highlight);
    cursor = start + fragment.length;
  });
  element.append(document.createTextNode(description.slice(cursor)));
}

function appendPreparationOption({
  element,
  id,
  name,
  summary,
  priceLabel,
  selected,
  detailOpen,
  unavailable,
  enhancementStatus,
  enhanced = false,
  onSelect
}) {
  const button = document.createElement("button");
  button.className = "preparation-option";
  button.classList.toggle("is-selected", selected);
  button.classList.toggle("is-detail-open", detailOpen);
  button.classList.toggle("is-unavailable", unavailable);
  button.classList.toggle("is-enhanced", enhanced);
  button.type = "button";
  button.setAttribute("aria-pressed", String(selected));
  button.setAttribute("aria-expanded", String(detailOpen));
  button.setAttribute("aria-controls", "regionPreparationDetail");

  const marker = document.createElement("span");
  const content = document.createElement("span");
  const title = document.createElement("strong");
  const detail = document.createElement("small");
  const hint = document.createElement("span");
  const price = document.createElement("b");
  marker.className = "preparation-marker";
  content.className = "preparation-copy";
  hint.className = "preparation-card-hint";
  title.textContent = name;
  detail.textContent = summary;
  hint.textContent = detailOpen ? "已展開" : "查看效果";
  price.textContent = priceLabel;
  content.append(title, detail, hint);

  if (enhancementStatus) {
    const badge = document.createElement("span");
    badge.className = "preparation-enhancement-badge";
    badge.dataset.type = enhancementStatus.type;
    badge.textContent = enhancementStatus.label;
    content.append(badge);
  }

  button.append(marker, content, price);
  button.addEventListener("click", () => onSelect(id));
  element.append(button);
}

function getHeldQuantity(inventoryMaterials, materialId) {
  const quantity = Number(inventoryMaterials?.[materialId]?.quantity);
  return Number.isSafeInteger(quantity) && quantity >= 0 ? quantity : 0;
}
