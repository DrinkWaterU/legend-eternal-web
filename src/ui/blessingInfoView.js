import { getBlessingFlowDefinitions } from "../data/blessingFlows.js";
import { getBlessingRarity } from "../data/rarities.js";

const activeFilterByElement = new WeakMap();

export function renderBlessingInfoView({ filtersElement, listElement, blessingNames, blessingDefinitions, resetFilter = false }) {
  const heldBlessings = resolveHeldBlessings(blessingNames, blessingDefinitions);
  if (resetFilter || !activeFilterByElement.has(filtersElement)) {
    activeFilterByElement.set(filtersElement, "all");
  }
  const activeFlow = activeFilterByElement.get(filtersElement) || "all";
  const flowDefinitions = getBlessingFlowDefinitions();
  const flowCounts = countBlessingFlows(heldBlessings);

  renderFilters({
    filtersElement,
    heldBlessings,
    flowDefinitions,
    flowCounts,
    activeFlow,
    onFilter: (flowId) => {
      activeFilterByElement.set(filtersElement, flowId);
      renderBlessingInfoView({
        filtersElement,
        listElement,
        blessingNames,
        blessingDefinitions,
        resetFilter: false
      });
    }
  });

  const visibleBlessings = activeFlow === "all"
    ? heldBlessings
    : heldBlessings.filter((blessing) => blessing.primaryFlow === activeFlow);
  renderBlessingList(listElement, visibleBlessings, heldBlessings);
}

function resolveHeldBlessings(blessingNames = [], blessingDefinitions = []) {
  const definitionsByName = new Map();
  blessingDefinitions.forEach((blessing) => {
    if (blessing?.name && !definitionsByName.has(blessing.name)) {
      definitionsByName.set(blessing.name, blessing);
    }
  });
  return (Array.isArray(blessingNames) ? blessingNames : []).map((name) => (
    definitionsByName.get(name) || { name, primaryFlow: null }
  ));
}

function countBlessingFlows(blessings) {
  return blessings.reduce((counts, blessing) => {
    const flowId = blessing.primaryFlow;
    if (flowId) {
      counts.set(flowId, (counts.get(flowId) || 0) + 1);
    }
    return counts;
  }, new Map());
}

function renderFilters({ filtersElement, heldBlessings, flowDefinitions, flowCounts, activeFlow, onFilter }) {
  const options = [
    { id: "all", label: "全部", count: heldBlessings.length },
    ...flowDefinitions.map((flow) => ({
      id: flow.id,
      label: flow.label,
      count: flowCounts.get(flow.id) || 0
    }))
  ];

  filtersElement.replaceChildren(...options.map((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "blessing-info-filter";
    button.classList.toggle("is-active", option.id === activeFlow);
    button.dataset.flow = option.id;
    button.textContent = `${option.label} ${option.count}`;
    button.addEventListener("click", () => onFilter(option.id));
    return button;
  }));
}

// 只合計「固定數值」類效果（type: add）。條件型、週期型效果不合計，留在下方逐項閱讀。
const SUMMARY_STATS = Object.freeze([
  ["attack", "攻擊", false],
  ["defense", "防禦", false],
  ["maxHp", "最大生命", false],
  ["critChance", "暴擊率", true],
  ["shieldStart", "開場護盾", false],
  ["killHeal", "擊殺回復", false],
  ["poisonPower", "攻擊附毒", false]
]);

export function summarizeBlessingTotals(blessings = []) {
  const totals = new Map();
  blessings.forEach((blessing) => {
    (Array.isArray(blessing?.effects) ? blessing.effects : []).forEach((effect) => {
      if (effect?.type !== "add" || !Number.isFinite(Number(effect.amount))) return;
      totals.set(effect.stat, (totals.get(effect.stat) || 0) + Number(effect.amount));
    });
  });
  return SUMMARY_STATS
    .filter(([stat]) => (totals.get(stat) || 0) !== 0)
    .map(([stat, label, percent]) => {
      const amount = totals.get(stat);
      return `${label} +${percent ? `${Math.round(amount * 100)}%` : Math.round(amount * 100) / 100}`;
    });
}

// 同名祝福合併成一列並標示數量，順序維持取得順序。
export function groupHeldBlessings(blessings = []) {
  const groups = new Map();
  blessings.forEach((blessing) => {
    const key = blessing?.name || "未知祝福";
    if (groups.has(key)) groups.get(key).count += 1;
    else groups.set(key, { blessing, count: 1 });
  });
  return [...groups.values()];
}

function renderBlessingList(listElement, blessings, allBlessings = blessings) {
  listElement.replaceChildren();
  const doc = listElement.ownerDocument || document;
  const totals = summarizeBlessingTotals(allBlessings);
  if (totals.length > 0) {
    const summary = doc.createElement("section");
    summary.className = "blessing-info-summary";
    summary.setAttribute("aria-label", "本局祝福固定加成合計");
    const caption = doc.createElement("small");
    caption.textContent = "本局固定加成合計（條件型效果不計入）";
    const list = doc.createElement("ul");
    totals.forEach((text) => {
      const item = doc.createElement("li");
      item.textContent = text;
      list.append(item);
    });
    summary.append(caption, list);
    listElement.append(summary);
  }
  if (blessings.length === 0) {
    const empty = doc.createElement("p");
    empty.className = "blessing-info-empty";
    empty.textContent = "目前沒有符合此分類的臨時祝福。";
    listElement.append(empty);
    return;
  }

  groupHeldBlessings(blessings).forEach(({ blessing, count }) => {
    const rarity = getBlessingRarity(blessing?.rarity);
    const row = doc.createElement("article");
    row.className = `blessing-info-row rarity-${rarity.id}`;
    const header = doc.createElement("header");
    const title = doc.createElement("strong");
    title.textContent = blessing?.name || "未知祝福";
    header.append(title);
    if (count > 1) {
      const countTag = doc.createElement("span");
      countTag.className = "blessing-info-count";
      countTag.textContent = `×${count}`;
      header.append(countTag);
    }
    const rarityTag = doc.createElement("i");
    rarityTag.className = "blessing-info-rarity-tag";
    rarityTag.textContent = rarity.label;
    header.append(rarityTag);
    const effect = doc.createElement("p");
    effect.className = "blessing-info-effect";
    effect.textContent = blessing?.effectText || "效果資料尚未整理。";
    row.append(header, effect);
    const storyText = blessing?.eventText || blessing?.flavorText || "";
    if (storyText) {
      const details = doc.createElement("details");
      const summary = doc.createElement("summary");
      summary.textContent = "情境";
      const story = doc.createElement("p");
      story.className = "blessing-info-story";
      story.textContent = storyText;
      details.append(summary, story);
      row.append(details);
    }
    listElement.append(row);
  });
}
