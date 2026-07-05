import { DEFAULT_BLESSING_RARITY, getBlessingRarity } from "../data/rarities.js";

export function renderStatList(element, items) {
  element.innerHTML = "";
  items.forEach(([label, value]) => {
    const item = document.createElement("div");
    item.innerHTML = `<dt>${label}</dt><dd>${value}</dd>`;
    element.append(item);
  });
}

export function renderDetailInfoLayout(element, detailData = {}) {
  const primary = normalizeDetailItems(detailData.primary);
  const secondary = normalizeDetailItems(detailData.secondary);
  element.replaceChildren();
  appendDetailInfoGroup(element, "detail-info-primary", primary);
  appendDetailInfoGroup(element, "detail-info-secondary", secondary);
}

function appendDetailInfoGroup(element, className, items) {
  if (items.length === 0) {
    return;
  }
  const list = document.createElement("dl");
  list.className = className;
  items.forEach(({ label, value }) => {
    const card = document.createElement("div");
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    card.className = "detail-info-card";
    term.textContent = label;
    description.textContent = value;
    card.append(term, description);
    list.append(card);
  });
  element.append(list);
}

function normalizeDetailItems(items = []) {
  if (!Array.isArray(items)) {
    return [];
  }
  return items.filter((item) => (
    item
    && item.label !== null
    && item.label !== undefined
    && String(item.label).trim() !== ""
    && item.value !== null
    && item.value !== undefined
    && String(item.value).trim() !== ""
  ));
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

export function renderBlessingChoices(element, blessings, onChoose) {
  element.innerHTML = "";
  blessings.forEach((blessing) => {
    const rarityId = blessing.rarity || DEFAULT_BLESSING_RARITY;
    const rarity = getBlessingRarity(rarityId);
    const button = document.createElement("button");
    button.className = `blessing-card rarity-${rarity.id}`;
    button.type = "button";
    button.innerHTML = `
      <small>
        <span>${blessing.eventTitle}</span>
        <i>${rarity.label}</i>
      </small>
      <strong>${blessing.name}</strong>
      <span>${blessing.eventText}</span>
      <em>${blessing.flavorText}</em>
      <b>${blessing.effectText}</b>
    `;
    button.addEventListener("click", () => onChoose(blessing));
    element.append(button);
  });
}

export function renderCurrentStats(element, hero) {
  renderStatList(element, [
    ["角色等級", `Lv. ${hero.level || 1}`],
    ["經驗", `${hero.exp || 0} / ${hero.expToNext || "-"}`],
    ["攻擊", hero.attack + (hero.battleAttackBonus || 0)],
    ["防禦", hero.defense],
    ["暴擊", `${Math.round((hero.critChance + (hero.battleCritBonus || 0)) * 100)}%`],
    ["逃跑", `${hero.fleesRemaining ?? 0} 次`],
    ["護盾", hero.shield || 0],
    ["中毒", hero.poison || 0],
    ["技能", Array.isArray(hero.skills) ? hero.skills.length : 0],
    ["祝福", hero.blessings.length]
  ]);
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

export function setMeter(element, value, max) {
  const ratio = Math.max(0, Math.min(1, value / max));
  element.style.width = `${Math.round(ratio * 100)}%`;
}
