import { DEFAULT_BLESSING_RARITY, getBlessingRarity } from "../data/rarities.js";

export function renderStatList(element, items) {
  element.innerHTML = "";
  items.forEach(([label, value, className]) => {
    const item = document.createElement("div");
    if (className) item.className = className;
    item.innerHTML = `<dt>${label}</dt><dd>${value}</dd>`;
    element.append(item);
  });
}

export function renderChoiceList(element, choices) {
  element.innerHTML = "";
  choices.forEach((choice) => {
    const button = document.createElement("button");
    button.className = "choice-button";
    button.type = "button";
    button.innerHTML = `
      <span>
        <strong>${choice.title}</strong>
        <small>${choice.meta}</small>
      </span>
      <em>${choice.description}</em>
      <b>${choice.action}</b>
    `;
    button.addEventListener("click", choice.onClick);
    element.append(button);
  });
}

const BLESSING_REVEAL_INTERVAL_MS = 180;
const BLESSING_REVEAL_DURATION_MS = 220;

export function renderBlessingChoices(element, blessings, onChoose, options = {}) {
  const {
    reveal = false,
    onRevealComplete = null,
    revealIntervalMs = BLESSING_REVEAL_INTERVAL_MS,
    revealDurationMs = BLESSING_REVEAL_DURATION_MS,
    ownedCounts = {}
  } = options;
  element.innerHTML = "";
  const buttons = blessings.map((blessing) => {
    const rarityId = blessing.rarity || DEFAULT_BLESSING_RARITY;
    const rarity = getBlessingRarity(rarityId);
    const button = document.createElement("button");
    button.className = `blessing-card rarity-${rarity.id}`;
    button.type = "button";
    button.innerHTML = `
      <small class="blessing-heading">
        <strong>${blessing.name}</strong>
        <i>${rarity.label}</i>
      </small>
      <span>${blessing.eventText}</span>
      <b>${blessing.effectText}</b>
    `;
    const ownedCount = Math.max(0, Math.floor(Number(ownedCounts?.[blessing.id]) || 0));
    button.setAttribute(
      "aria-label",
      ownedCount > 0
        ? `${blessing.name}，目前持有 ${ownedCount} 個`
        : blessing.name
    );
    if (ownedCount > 0) {
      button.classList.add("has-owned-count");
      const ownedCountBadge = document.createElement("span");
      ownedCountBadge.className = "blessing-card-owned-count";
      ownedCountBadge.textContent = `×${ownedCount}`;
      ownedCountBadge.setAttribute("aria-hidden", "true");
      button.append(ownedCountBadge);
    }
    button.addEventListener("click", () => onChoose(blessing));
    if (reveal) {
      button.disabled = true;
      button.classList.add("is-revealing");
    }
    element.append(button);
    return button;
  });

  if (!reveal || buttons.length === 0) {
    onRevealComplete?.();
    return;
  }

  buttons.forEach((button, index) => {
    setTimeout(() => {
      button.classList.add("is-revealed");
    }, index * revealIntervalMs);
  });

  const revealCompleteDelay = ((buttons.length - 1) * revealIntervalMs) + revealDurationMs;
  setTimeout(() => {
    buttons.forEach((button) => {
      button.disabled = false;
      button.classList.remove("is-revealing");
    });
    onRevealComplete?.();
  }, revealCompleteDelay);
}

export function renderCampBlessingChoices(element, instances, selectedIds, onToggle) {
  const selected = new Set(selectedIds);
  element.replaceChildren();
  (Array.isArray(instances) ? instances : []).forEach((instance) => {
    const blessing = instance.definition || instance;
    const rarityId = blessing.rarity || DEFAULT_BLESSING_RARITY;
    const rarity = getBlessingRarity(rarityId);
    const button = document.createElement("button");
    const isSelected = selected.has(instance.instanceId);
    button.className = `blessing-card camp-blessing-card rarity-${rarity.id}${isSelected ? " is-retained" : ""}`;
    button.type = "button";
    button.setAttribute("aria-pressed", String(isSelected));
    button.setAttribute("aria-label", `${blessing.name}，來源：${instance.sourceLabel || "冒險途中"}`);

    // 扎營是從已持有的祝福中挑要保留的，比較時需要的是名稱、稀有度與效果；
    // 情境與敘述在取得時已讀過，這裡不再重複（2026-11-14 作者同意精簡）。來源放在最下方小字。
    const heading = document.createElement("span");
    heading.className = "blessing-heading";
    const name = document.createElement("strong");
    const rarityLabel = document.createElement("i");
    name.textContent = blessing.name || "未命名祝福";
    rarityLabel.textContent = rarity.label;
    heading.append(name, rarityLabel);

    const effect = document.createElement("b");
    effect.textContent = blessing.effectText || "";
    const source = document.createElement("small");
    source.className = "camp-blessing-source";
    source.textContent = `來源：${instance.sourceLabel || "冒險途中"}`;
    button.append(heading, effect, source);
    button.addEventListener("click", () => onToggle(instance.instanceId));
    element.append(button);
  });
}

export function renderBattleLog(element, log) {
  element.innerHTML = "";
  log.slice(-80).reverse().forEach((entry) => {
    const item = document.createElement("li");
    item.className = entry.type;
    item.textContent = entry.text;
    element.append(item);
  });
  element.scrollTop = 0;
}
