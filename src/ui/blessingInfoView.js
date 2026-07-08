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
  const flowDefinitionMap = new Map(flowDefinitions.map((flow) => [flow.id, flow]));
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
  renderBlessingList(listElement, visibleBlessings, flowDefinitionMap);
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

function renderBlessingList(listElement, blessings, flowDefinitionMap) {
  listElement.replaceChildren();
  if (blessings.length === 0) {
    const empty = document.createElement("p");
    empty.className = "blessing-info-empty";
    empty.textContent = "目前沒有符合此分類的臨時祝福。";
    listElement.append(empty);
    return;
  }

  blessings.forEach((blessing) => {
    const rarity = getBlessingRarity(blessing?.rarity);
    const flow = flowDefinitionMap.get(blessing?.primaryFlow) || { id: "unknown", label: "未分類" };
    const card = document.createElement("article");
    const meta = document.createElement("small");
    const event = document.createElement("span");
    const tags = document.createElement("span");
    const flowTag = document.createElement("i");
    const rarityTag = document.createElement("i");
    const title = document.createElement("strong");
    const effect = document.createElement("p");
    const flavor = document.createElement("em");

    card.className = `blessing-info-card rarity-${rarity.id}`;
    event.textContent = blessing?.eventTitle || "臨時祝福";
    tags.className = "blessing-info-tags";
    flowTag.className = "blessing-info-flow-tag";
    flowTag.dataset.flow = flow.id;
    flowTag.textContent = flow.label;
    rarityTag.className = "blessing-info-rarity-tag";
    rarityTag.textContent = rarity.label;
    tags.append(flowTag, rarityTag);
    meta.append(event, tags);
    title.textContent = blessing?.name || "未知祝福";
    effect.textContent = blessing?.effectText || "效果資料尚未整理。";
    flavor.textContent = blessing?.flavorText || "";
    card.append(meta, title, effect);
    if (flavor.textContent) {
      card.append(flavor);
    }
    listElement.append(card);
  });
}
