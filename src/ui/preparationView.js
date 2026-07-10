export function renderPreparationChoices({
  element,
  preparations,
  selectedPreparationId,
  detailPreparationId,
  detailExpanded,
  gold,
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
    onSelect
  });

  preparations.forEach((preparation) => {
    const affordable = gold >= preparation.cost;
    appendPreparationOption({
      element,
      id: preparation.id,
      name: preparation.name,
      summary: preparation.summary,
      priceLabel: affordable ? `${preparation.cost} 金幣` : "金幣不足",
      selected: selectedPreparationId === preparation.id,
      detailOpen: detailPreparationId === preparation.id && detailExpanded,
      unavailable: !affordable,
      onSelect
    });
  });
}

export function renderPreparationDetail({ element, preparation, expanded, priceLabel }) {
  element.classList.toggle("is-open", expanded);
  element.setAttribute("aria-hidden", String(!expanded));
  element.replaceChildren();

  const card = document.createElement("div");
  const label = document.createElement("span");
  const title = document.createElement("strong");
  const price = document.createElement("b");
  const description = document.createElement("p");
  card.className = "preparation-detail-card";
  label.textContent = "整備效果";
  title.textContent = preparation?.name || "不進行整備";
  price.textContent = priceLabel;
  description.textContent = preparation?.description || "不花費金幣，維持原本冒險流程。";
  card.append(label, title, price, description);
  element.append(card);
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
  onSelect
}) {
  const button = document.createElement("button");
  button.className = "preparation-option";
  button.classList.toggle("is-selected", selected);
  button.classList.toggle("is-detail-open", detailOpen);
  button.classList.toggle("is-unavailable", unavailable);
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
  button.append(marker, content, price);
  button.addEventListener("click", () => onSelect(id));
  element.append(button);
}
