export function renderPreparationChoices({ element, preparations, selectedPreparationId, gold, onSelect }) {
  element.replaceChildren();
  appendPreparationOption({
    element,
    id: null,
    name: "不進行整備",
    description: "不花費金幣，維持原本冒險流程。",
    priceLabel: "免費",
    selected: selectedPreparationId === null,
    disabled: false,
    onSelect
  });

  preparations.forEach((preparation) => {
    const affordable = gold >= preparation.cost;
    appendPreparationOption({
      element,
      id: preparation.id,
      name: preparation.name,
      description: preparation.description,
      priceLabel: affordable ? `${preparation.cost} 金幣` : "金幣不足",
      selected: selectedPreparationId === preparation.id,
      disabled: !affordable,
      onSelect
    });
  });
}

function appendPreparationOption({ element, id, name, description, priceLabel, selected, disabled, onSelect }) {
  const button = document.createElement("button");
  button.className = "preparation-option";
  button.classList.toggle("is-selected", selected);
  button.classList.toggle("is-unavailable", disabled);
  button.type = "button";
  button.disabled = disabled;
  button.setAttribute("aria-pressed", String(selected));

  const marker = document.createElement("span");
  const content = document.createElement("span");
  const title = document.createElement("strong");
  const detail = document.createElement("small");
  const price = document.createElement("b");
  marker.className = "preparation-marker";
  content.className = "preparation-copy";
  title.textContent = name;
  detail.textContent = description;
  price.textContent = priceLabel;
  content.append(title, detail);
  button.append(marker, content, price);
  button.addEventListener("click", () => onSelect(id));
  element.append(button);
}
