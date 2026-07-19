const CATEGORY_META = Object.freeze({
  region: Object.freeze({ label: "地區", className: "category-region", mark: "◆" }),
  route: Object.freeze({ label: "特殊路線", className: "category-route", mark: "✦" }),
  character: Object.freeze({ label: "角色", className: "category-character", mark: "✧" }),
  challenge: Object.freeze({ label: "挑戰", className: "category-challenge", mark: "◇" })
});

export function renderAchievementView({
  els,
  definitions,
  achievementState,
  systemUnlocked,
  filter = "all",
  selectedId = null,
  newAchievementIds = new Set(),
  detailOpen = false,
  regionDefinitions = {},
  getRouteName,
  onFilterChange,
  onAchievementSelect
}) {
  els.achievementLockedState.hidden = systemUnlocked;
  els.achievementBrowser.hidden = !systemUnlocked;
  els.achievementTitle.textContent = systemUnlocked ? "冒險成就" : "尚未開放";
  els.achievementText.textContent = systemUnlocked
    ? "這裡記錄你在傳說大陸留下的旅程節點。"
    : "繼續完成冒險，新的旅程紀錄會在適當時機出現。";

  if (!systemUnlocked) {
    closeAchievementDetailView(els);
    return { filter: "all", selectedId: null, visibleCount: 0, unlockedCount: 0 };
  }

  const allVisible = getVisibleAchievementEntries({
    definitions,
    achievementState,
    filter: "all"
  });
  const availableCategories = [...new Set(allVisible.map((entry) => entry.definition.category || "region"))];
  const resolvedFilter = filter === "all" || availableCategories.includes(filter) ? filter : "all";
  const visible = getVisibleAchievementEntries({ definitions, achievementState, filter: resolvedFilter });
  const resolvedSelectedId = visible.some((entry) => entry.definition.id === selectedId)
    ? selectedId
    : visible[0]?.definition.id || null;
  const unlockedCount = allVisible.filter((entry) => entry.state.unlocked).length;

  els.achievementSummary.textContent = unlockedCount > 0
    ? `你已在傳說大陸留下 ${unlockedCount} 個旅程節點。`
    : "旅程才剛開始，完成重要冒險後會在這裡留下紀錄。";
  els.achievementVisibleCount.textContent = `${visible.length} 項`;
  els.achievementUnlockedCount.textContent = `${unlockedCount} 已解鎖`;
  renderAchievementFilters({
    element: els.achievementFilters,
    entries: allVisible,
    activeFilter: resolvedFilter,
    onFilterChange
  });
  renderAchievementList({
    element: els.achievementList,
    entries: visible,
    selectedId: resolvedSelectedId,
    newAchievementIds,
    onAchievementSelect
  });
  els.achievementEmpty.hidden = visible.length > 0;
  renderAchievementDetail({
    element: els.achievementDetail,
    entry: visible.find((item) => item.definition.id === resolvedSelectedId) || null,
    regionDefinitions,
    getRouteName
  });

  els.achievementDetailPanel.classList.toggle("is-open", detailOpen && Boolean(resolvedSelectedId));
  els.achievementDetailBackdrop.hidden = !(detailOpen && Boolean(resolvedSelectedId));
  return {
    filter: resolvedFilter,
    selectedId: resolvedSelectedId,
    visibleCount: visible.length,
    unlockedCount
  };
}

export function getVisibleAchievementEntries({ definitions = {}, achievementState = {}, filter = "all" }) {
  return Object.values(definitions)
    .map((definition, index) => ({
      definition,
      state: achievementState[definition.id] || { unlocked: false, unlockedAt: null },
      index
    }))
    .filter((entry) => !(entry.definition.hiddenUntilUnlocked && !entry.state.unlocked))
    .filter((entry) => filter === "all" || (entry.definition.category || "region") === filter)
    .sort((left, right) => {
      const orderDiff = (Number(left.definition.order) || 9999) - (Number(right.definition.order) || 9999);
      return orderDiff || left.index - right.index;
    });
}

export function getAchievementCategoryCounts(entries = []) {
  const counts = { all: entries.length };
  entries.forEach((entry) => {
    const category = entry.definition.category || "region";
    counts[category] = (counts[category] || 0) + 1;
  });
  return counts;
}

export function formatAchievementDate(value, options = {}) {
  if (!value) {
    return options.fallback || "尚未解鎖";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return options.fallback || "解鎖時間未記錄";
  }
  const format = options.full
    ? { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }
    : { year: "numeric", month: "2-digit", day: "2-digit" };
  return new Intl.DateTimeFormat("zh-TW", format).format(date);
}

export function renderAchievementUnlockToast({ els, definition }) {
  const visible = Boolean(definition);
  els.achievementUnlockToast.hidden = !visible;
  if (!definition) {
    els.achievementUnlockToastTitle.textContent = "";
    els.achievementUnlockToastCondition.textContent = "";
    return;
  }
  els.achievementUnlockToastTitle.textContent = definition.title;
  els.achievementUnlockToastCondition.textContent = definition.conditionText;
}

export function closeAchievementDetailView(els) {
  els.achievementDetailPanel.classList.remove("is-open");
  els.achievementDetailBackdrop.hidden = true;
}

function renderAchievementFilters({ element, entries, activeFilter, onFilterChange }) {
  const counts = getAchievementCategoryCounts(entries);
  const categories = [...new Set(entries.map((entry) => entry.definition.category || "region"))];
  const filters = [
    { id: "all", label: "全部", count: counts.all || 0 },
    ...categories.map((category) => ({
      id: category,
      label: CATEGORY_META[category]?.label || category,
      count: counts[category] || 0
    }))
  ];
  element.replaceChildren();
  filters.forEach((filter) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "filter-chip";
    const active = filter.id === activeFilter;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
    button.textContent = `${filter.label} ${filter.count}`;
    button.addEventListener("click", () => onFilterChange?.(filter.id));
    element.append(button);
  });
}

function renderAchievementList({ element, entries, selectedId, newAchievementIds, onAchievementSelect }) {
  element.replaceChildren();
  entries.forEach(({ definition, state }) => {
    const meta = CATEGORY_META[definition.category] || CATEGORY_META.region;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `achievement-index-card ${meta.className}`;
    button.classList.toggle("is-selected", definition.id === selectedId);
    button.classList.toggle("is-locked", !state.unlocked);
    button.classList.toggle("is-new", newAchievementIds.has(definition.id));
    button.setAttribute("role", "listitem");
    button.setAttribute("aria-pressed", String(definition.id === selectedId));

    const mark = document.createElement("span");
    mark.className = "achievement-mark";
    mark.textContent = state.unlocked ? meta.mark : "◇";
    mark.setAttribute("aria-hidden", "true");
    const copy = document.createElement("span");
    copy.className = "achievement-index-copy";
    const title = document.createElement("strong");
    title.textContent = definition.title;
    const category = document.createElement("span");
    category.textContent = meta.label;
    const detail = document.createElement("small");
    detail.textContent = state.unlocked
      ? formatAchievementDate(state.unlockedAt)
      : definition.conditionText;
    copy.append(title, category, detail);
    const status = document.createElement("span");
    status.className = "achievement-index-status";
    status.textContent = newAchievementIds.has(definition.id)
      ? "新"
      : state.unlocked
        ? "已解鎖"
        : "尚未完成";
    button.append(mark, copy, status);
    button.addEventListener("click", () => onAchievementSelect?.(definition.id, button));
    element.append(button);
  });
}

function renderAchievementDetail({ element, entry, regionDefinitions, getRouteName }) {
  element.replaceChildren();
  if (!entry) {
    const empty = document.createElement("div");
    empty.className = "achievement-detail-empty";
    const title = document.createElement("h3");
    const text = document.createElement("p");
    title.textContent = "沒有可顯示的紀錄";
    text.textContent = "請切換其他分類。";
    empty.append(title, text);
    element.append(empty);
    return;
  }

  const { definition, state } = entry;
  const meta = CATEGORY_META[definition.category] || CATEGORY_META.region;
  const header = document.createElement("header");
  header.className = `achievement-detail-hero ${meta.className}`;
  const sigil = document.createElement("span");
  sigil.className = "achievement-detail-sigil";
  sigil.textContent = state.unlocked ? meta.mark : "◇";
  sigil.setAttribute("aria-hidden", "true");
  const copy = document.createElement("div");
  const labels = document.createElement("div");
  labels.className = "achievement-detail-labels";
  labels.append(createLabel(meta.label, "achievement-category-label"));
  const regionName = definition.displayRegionName
    || regionDefinitions[definition.regionId]?.regionName
    || regionDefinitions[definition.regionId]?.name;
  if (regionName) {
    labels.append(createLabel(regionName, "achievement-region-label"));
  }
  const title = document.createElement("h3");
  title.textContent = definition.title;
  const subtitle = document.createElement("p");
  subtitle.textContent = state.unlocked
    ? "這項紀錄已永久留在目前瀏覽器存檔中。"
    : "完成條件後，這裡將留下新的旅程紀錄。";
  copy.append(labels, title, subtitle);
  header.append(sigil, copy);

  const condition = createDetailSection("完成條件", definition.conditionText);
  element.append(header, condition);
  if (state.unlocked) {
    element.append(createDetailSection("旅程紀錄", definition.description));
    const metaList = document.createElement("dl");
    metaList.className = "achievement-detail-meta";
    const routeName = definition.routeId ? getRouteName?.(definition.routeId) : null;
    appendMeta(metaList, "解鎖日期", formatAchievementDate(state.unlockedAt, { full: true }));
    appendMeta(metaList, "所屬紀錄", routeName
      ? `${regionName || "未分類"}｜${routeName}`
      : `${regionName || "未分類"}｜${meta.label}`);
    element.append(metaList);
  }
}

function createDetailSection(titleText, contentText) {
  const section = document.createElement("section");
  section.className = "achievement-detail-section";
  const title = document.createElement("h4");
  const content = document.createElement("p");
  title.textContent = titleText;
  content.textContent = contentText || "尚未記錄。";
  section.append(title, content);
  return section;
}

function appendMeta(element, labelText, valueText) {
  const row = document.createElement("div");
  const label = document.createElement("dt");
  const value = document.createElement("dd");
  label.textContent = labelText;
  value.textContent = valueText;
  row.append(label, value);
  element.append(row);
}

function createLabel(text, className) {
  const label = document.createElement("span");
  label.className = className;
  label.textContent = text;
  return label;
}
