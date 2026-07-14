import { createWeaponIcon, getWeaponRarityLabel } from "./weaponViewHelpers.js";
import {
  clampProgress,
  getAverageEnemiesPerRun,
  getCharacterOtherRuns,
  getEscapeSummary,
  getOutcomeDistribution,
  safeStatisticCount
} from "./statisticsMetrics.js";

export function renderStatisticsView({
  els,
  uiState,
  saveData,
  characterDefinitions,
  regionDefinitions,
  equippedWeaponsByCharacterId = {},
  onCharacterSelect,
  onRegionSelect
}) {
  const activeView = ["overview", "characters", "regions", "save"].includes(uiState.statisticsView)
    ? uiState.statisticsView
    : "overview";
  uiState.statisticsView = activeView;

  const views = {
    overview: els.statisticsOverviewView,
    characters: els.statisticsCharacterListView,
    regions: els.statisticsRegionListView,
    save: els.statisticsSaveView
  };
  Object.entries(views).forEach(([view, element]) => {
    element.classList.toggle("is-active", activeView === view);
  });
  els.statisticsTabs.forEach((button) => {
    const active = button.dataset.statisticsView === activeView;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });

  if (activeView === "overview") {
    renderOverview(els, saveData.statistics || {});
  } else if (activeView === "characters") {
    renderCharacterBrowser({
      els,
      uiState,
      saveData,
      characterDefinitions,
      equippedWeaponsByCharacterId,
      onCharacterSelect
    });
  } else if (activeView === "regions") {
    renderRegionBrowser({ els, uiState, saveData, regionDefinitions, onRegionSelect });
  }
}

function renderOverview(els, stats) {
  els.statisticsKeyMetrics.replaceChildren();
  els.statisticsCombatMetrics.replaceChildren();
  els.statisticsOutcomeList.replaceChildren();
  els.statisticsEscapeMetrics.replaceChildren();

  const outcomes = getOutcomeDistribution(stats);
  const escape = getEscapeSummary(stats);
  const highestLevel = safeStatisticCount(stats.highestRunLevel);
  els.statisticsJourneySummary.textContent = outcomes.totalRuns > 0
    ? `你已踏上 ${outcomes.totalRuns} 次冒險，擊敗 ${safeStatisticCount(stats.totalEnemiesDefeated)} 名敵人，並有 ${outcomes.clears} 次抵達旅途終點。${highestLevel > 0 ? `單次冒險最高曾達 Lv.${highestLevel}。` : "最高冒險等級尚未記錄。"}`
    : "尚未留下冒險紀錄。踏入野外後，旅程足跡會記錄在這裡。";

  renderDefinitionList(els.statisticsKeyMetrics, [
    ["冒險次數", outcomes.totalRuns],
    ["總通關", outcomes.clears],
    ["擊敗敵人", safeStatisticCount(stats.totalEnemiesDefeated)],
    ["冒險最高等級", highestLevel > 0 ? `Lv. ${highestLevel}` : "尚未記錄"]
  ], "statistics-key-metric");

  els.statisticsResolvedRuns.textContent = `${outcomes.resolved} 次`;
  outcomes.items.forEach((item) => {
    const row = document.createElement("div");
    row.className = `statistics-outcome-row outcome-${item.id}`;
    const heading = document.createElement("div");
    const label = document.createElement("span");
    const value = document.createElement("strong");
    label.textContent = item.label;
    value.textContent = String(item.value);
    heading.append(label, value);
    const meter = document.createElement("div");
    meter.className = "statistics-meter";
    const fill = document.createElement("span");
    fill.style.width = `${Math.round(item.ratio * 100)}%`;
    meter.append(fill);
    row.append(heading, meter);
    els.statisticsOutcomeList.append(row);
  });

  renderDefinitionList(els.statisticsCombatMetrics, [
    ["擊敗敵人", safeStatisticCount(stats.totalEnemiesDefeated)],
    ["擊敗首領", safeStatisticCount(stats.bossesDefeated)],
    ["平均每次冒險", `${getAverageEnemiesPerRun(stats).toFixed(1)} 名敵人`]
  ], "statistics-compact-row");

  els.statisticsEscapeRate.textContent = `${Math.round(escape.successRate * 100)}%`;
  const summary = document.createElement("p");
  summary.className = "statistics-escape-summary";
  summary.textContent = escape.attempts > 0
    ? `${escape.attempts} 次嘗試中成功脫離 ${escape.successes} 次，失敗 ${escape.failures} 次。`
    : "目前沒有逃跑或撤離紀錄。";
  const breakdown = document.createElement("dl");
  breakdown.className = "statistics-escape-breakdown";
  renderDefinitionList(breakdown, [
    ["安全逃跑", escape.safeEscapes],
    ["反擊逃跑", escape.counterEscapes],
    ["撤離逃跑", escape.evacuationEscapes]
  ], "statistics-compact-row");
  els.statisticsEscapeMetrics.append(summary, breakdown);
}

function renderCharacterBrowser({
  els,
  uiState,
  saveData,
  characterDefinitions,
  equippedWeaponsByCharacterId,
  onCharacterSelect
}) {
  const entries = Object.entries(characterDefinitions)
    .filter(([characterId]) => saveData.progression.characters[characterId]?.unlocked === true);
  const resolvedId = entries.some(([characterId]) => characterId === uiState.statisticsCharacterId)
    ? uiState.statisticsCharacterId
    : entries[0]?.[0] || null;
  uiState.statisticsCharacterId = resolvedId;
  els.statisticsCharacterList.replaceChildren();

  entries.forEach(([characterId, character]) => {
    const progress = saveData.progression.characters[characterId];
    const stats = saveData.statistics.characters[characterId] || {};
    const button = document.createElement("button");
    button.type = "button";
    button.className = "statistics-character-card";
    const selected = characterId === resolvedId;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));

    const emblem = createCharacterEmblem(characterId, character.name);
    const copy = document.createElement("span");
    const name = document.createElement("strong");
    const meta = document.createElement("small");
    const summary = document.createElement("span");
    name.textContent = character.name;
    meta.textContent = `${character.role || "角色"}｜Lv. ${Math.max(1, progress.level || 1)}`;
    summary.textContent = `出戰 ${safeStatisticCount(stats.runs)} 次｜通關 ${safeStatisticCount(stats.clears)} 次`;
    copy.append(name, meta, summary);
    button.append(emblem, copy);
    button.addEventListener("click", () => onCharacterSelect?.(characterId));
    els.statisticsCharacterList.append(button);
  });

  renderCharacterDetail({
    element: els.statisticsCharacterDetail,
    characterId: resolvedId,
    character: characterDefinitions[resolvedId],
    progress: saveData.progression.characters[resolvedId],
    stats: saveData.statistics.characters[resolvedId] || {},
    weapon: equippedWeaponsByCharacterId[resolvedId] || null
  });
}

function renderCharacterDetail({ element, characterId, character, progress, stats, weapon }) {
  element.replaceChildren();
  if (!character || !progress) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "目前沒有可查看的角色紀錄。";
    element.append(empty);
    return;
  }

  const header = document.createElement("header");
  header.className = "statistics-detail-heading";
  const identity = document.createElement("div");
  identity.append(createCharacterEmblem(characterId, character.name));
  const copy = document.createElement("div");
  const eyebrow = document.createElement("span");
  const title = document.createElement("h3");
  const meta = document.createElement("p");
  eyebrow.textContent = "角色冒險紀錄";
  title.textContent = character.name;
  meta.textContent = `${character.role || "角色"}｜目前 Lv. ${Math.max(1, progress.level || 1)}`;
  copy.append(eyebrow, title, meta);
  identity.append(copy);
  header.append(identity);

  const growth = document.createElement("section");
  growth.className = "statistics-detail-section";
  const growthTitle = document.createElement("h4");
  growthTitle.textContent = "永久成長";
  const growthList = document.createElement("dl");
  growthList.className = "statistics-detail-grid";
  renderDefinitionList(growthList, [
    ["目前等級", `Lv. ${Math.max(1, progress.level || 1)}`],
    ["目前經驗", safeStatisticCount(progress.exp)],
    ["已學技能", Array.isArray(progress.learnedSkills) ? progress.learnedSkills.length : 0],
    ["目前武器", weapon?.name || "未裝備"]
  ], "statistics-detail-stat");
  growth.append(growthTitle, growthList);

  const record = document.createElement("section");
  record.className = "statistics-detail-section";
  const recordTitle = document.createElement("h4");
  recordTitle.textContent = "冒險紀錄";
  const recordList = document.createElement("dl");
  recordList.className = "statistics-detail-grid";
  renderDefinitionList(recordList, [
    ["出戰次數", safeStatisticCount(stats.runs)],
    ["通關次數", safeStatisticCount(stats.clears)],
    ["撤退次數", safeStatisticCount(stats.retreats)],
    ["其他出戰", getCharacterOtherRuns(stats)],
    ["冒險最高等級", safeStatisticCount(stats.highestRunLevel) > 0 ? `Lv. ${safeStatisticCount(stats.highestRunLevel)}` : "尚未記錄"]
  ], "statistics-detail-stat");
  record.append(recordTitle, recordList);

  if (weapon) {
    const weaponRow = document.createElement("div");
    weaponRow.className = "statistics-equipped-weapon";
    const weaponCopy = document.createElement("div");
    const label = document.createElement("span");
    const name = document.createElement("strong");
    label.textContent = `${getWeaponRarityLabel(weapon)}品級武器`;
    name.textContent = weapon.name;
    weaponCopy.append(label, name);
    weaponRow.append(createWeaponIcon(weapon, { className: "weapon-icon statistics-weapon-icon" }), weaponCopy);
    growth.append(weaponRow);
  }
  element.append(header, growth, record);
}

function renderRegionBrowser({ els, uiState, saveData, regionDefinitions, onRegionSelect }) {
  const entries = Object.entries(regionDefinitions);
  const resolvedId = entries.some(([regionId]) => regionId === uiState.statisticsRegionId)
    ? uiState.statisticsRegionId
    : entries[0]?.[0] || null;
  uiState.statisticsRegionId = resolvedId;
  els.statisticsRegionList.replaceChildren();
  entries.forEach(([regionId, region]) => {
    const stats = saveData.statistics.regions[regionId] || {};
    const button = document.createElement("button");
    button.type = "button";
    button.className = "statistics-region-card";
    const selected = regionId === resolvedId;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
    const background = region.visual?.background?.desktop || region.visual?.background?.mobile;
    if (background) {
      button.style.backgroundImage = `linear-gradient(90deg, rgba(7, 12, 13, 0.9), rgba(7, 12, 13, 0.56)), url("./${background}")`;
    }
    const title = document.createElement("strong");
    const meta = document.createElement("small");
    const summary = document.createElement("span");
    title.textContent = region.name;
    meta.textContent = region.difficulty || "未知難度";
    summary.textContent = `冒險 ${safeStatisticCount(stats.runs)} 次｜最高 ${safeStatisticCount(stats.bestEncounter)} / ${safeStatisticCount(region.encounterCount)}`;
    button.append(title, meta, summary);
    button.addEventListener("click", () => onRegionSelect?.(regionId));
    els.statisticsRegionList.append(button);
  });
  renderRegionDetail({
    element: els.statisticsRegionDetail,
    regionId: resolvedId,
    region: regionDefinitions[resolvedId],
    stats: saveData.statistics.regions[resolvedId] || {}
  });
}

function renderRegionDetail({ element, regionId, region, stats }) {
  element.replaceChildren();
  if (!region) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "目前沒有可查看的地區紀錄。";
    element.append(empty);
    return;
  }

  const header = document.createElement("header");
  header.className = "statistics-detail-heading statistics-region-detail-heading";
  const background = region.visual?.background?.desktop || region.visual?.background?.mobile;
  if (background) {
    header.style.backgroundImage = `linear-gradient(90deg, rgba(7, 12, 13, 0.9), rgba(7, 12, 13, 0.52)), url("./${background}")`;
  }
  const copy = document.createElement("div");
  const eyebrow = document.createElement("span");
  const title = document.createElement("h3");
  const meta = document.createElement("p");
  eyebrow.textContent = "地區冒險紀錄";
  title.textContent = region.name;
  meta.textContent = `${region.difficulty || "未知難度"}｜首領：${region.bossName || region.boss?.name || "未知"}`;
  copy.append(eyebrow, title, meta);
  header.append(copy);

  const progress = clampProgress(stats.bestEncounter, region.encounterCount);
  const progressSection = document.createElement("section");
  progressSection.className = "statistics-region-progress";
  const progressHeading = document.createElement("div");
  const progressLabel = document.createElement("span");
  const progressValue = document.createElement("strong");
  progressLabel.textContent = "最高抵達";
  progressValue.textContent = `${progress.current} / ${progress.maximum}`;
  progressHeading.append(progressLabel, progressValue);
  const meter = document.createElement("div");
  meter.className = "statistics-meter";
  const fill = document.createElement("span");
  fill.style.width = `${Math.round(progress.ratio * 100)}%`;
  meter.append(fill);
  progressSection.append(progressHeading, meter);

  const recordList = document.createElement("dl");
  recordList.className = "statistics-detail-grid";
  renderDefinitionList(recordList, [
    ["冒險次數", safeStatisticCount(stats.runs)],
    ["通關次數", safeStatisticCount(stats.clears)],
    ["撤退次數", safeStatisticCount(stats.retreats)],
    ["難度", region.difficulty || "未知"],
    ["首領", region.bossName || region.boss?.name || "未知"]
  ], "statistics-detail-stat");

  element.append(header, progressSection, recordList);
  if (regionId === "forest") {
    const routes = document.createElement("section");
    routes.className = "statistics-detail-section statistics-route-records";
    const heading = document.createElement("h4");
    heading.textContent = "森林路線紀錄";
    const list = document.createElement("dl");
    list.className = "statistics-detail-grid";
    renderDefinitionList(list, [
      ["普通森林", safeStatisticCount(stats.routeClears?.main)],
      ["哥布林營地", safeStatisticCount(stats.routeClears?.goblinCamp)]
    ], "statistics-detail-stat");
    routes.append(heading, list);
    element.append(routes);
  }
}

function renderDefinitionList(element, items, className) {
  items.forEach(([labelText, valueText]) => {
    const row = document.createElement("div");
    row.className = className;
    const label = document.createElement("dt");
    const value = document.createElement("dd");
    label.textContent = labelText;
    value.textContent = String(valueText);
    row.append(label, value);
    element.append(row);
  });
}

function createCharacterEmblem(characterId, characterName) {
  const emblem = document.createElement("span");
  emblem.className = "character-emblem statistics-character-emblem";
  const image = document.createElement("img");
  image.alt = "";
  image.src = `./assets/images/characters/${characterId}/emblem.png`;
  image.addEventListener("error", () => {
    image.remove();
    emblem.textContent = characterName.charAt(0) || "？";
  }, { once: true });
  emblem.append(image);
  return emblem;
}
