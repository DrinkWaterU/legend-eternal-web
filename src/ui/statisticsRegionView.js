import { describeRegionReach, safeStatisticCount } from "./statisticsMetrics.js";
import { renderDefinitionList } from "./statisticsViewHelpers.js";
import { getRegionDisplayName, getRegionSegmentName } from "../data/regions/regionDefinition.js";

export function renderStatisticsRegionBrowser({ els, uiState, saveData, regionDefinitions, onRegionSelect }) {
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
    applyRegionBackground(button, region, "linear-gradient(90deg, rgba(7, 12, 13, 0.9), rgba(7, 12, 13, 0.56))");
    const title = document.createElement("strong");
    const meta = document.createElement("small");
    const summary = document.createElement("span");
    title.textContent = getRegionDisplayName(region);
    meta.textContent = region.difficulty || "未知難度";
    const reachLabel = getReachLabel(region);
    const reach = describeRegionReach(stats.bestEncounter, region.encounterCount);
    summary.textContent = `冒險 ${safeStatisticCount(stats.runs)} 次｜${reachLabel} ${reach.current} / ${reach.maximum}`
      + (reach.beyond ? `｜後續路線最遠第 ${reach.beyond} 場` : "");
    const meter = document.createElement("span");
    meter.className = "statistics-meter statistics-region-card-meter";
    meter.setAttribute("aria-hidden", "true");
    const fill = document.createElement("span");
    fill.style.width = `${Math.round(reach.ratio * 100)}%`;
    meter.append(fill);
    button.append(title, meta, summary, meter);
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
  applyRegionBackground(header, region, "linear-gradient(90deg, rgba(7, 12, 13, 0.9), rgba(7, 12, 13, 0.52))");
  const copy = document.createElement("div");
  const eyebrow = document.createElement("span");
  const title = document.createElement("h3");
  const meta = document.createElement("p");
  eyebrow.textContent = "地區冒險紀錄";
  const displayName = getRegionDisplayName(region);
  const segmentName = getRegionSegmentName(region);
  title.textContent = displayName;
  meta.textContent = `${region.difficulty || "未知難度"}｜${segmentName}首領：${region.bossName || region.boss?.name || "未知"}`;
  copy.append(eyebrow, title, meta);
  header.append(copy);

  const progress = describeRegionReach(stats.bestEncounter, region.encounterCount);
  const progressSection = document.createElement("section");
  progressSection.className = "statistics-region-progress";
  const progressHeading = document.createElement("div");
  const progressLabel = document.createElement("span");
  const progressValue = document.createElement("strong");
  progressLabel.textContent = getReachLabel(region) === "最遠" ? "最高抵達" : `${segmentName}最高抵達`;
  progressValue.textContent = `${progress.current} / ${progress.maximum}`;
  progressHeading.append(progressLabel, progressValue);
  const meter = document.createElement("div");
  meter.className = "statistics-meter";
  const fill = document.createElement("span");
  fill.style.width = `${Math.round(progress.ratio * 100)}%`;
  meter.append(fill);
  progressSection.append(progressHeading, meter);
  if (progress.beyond) {
    const beyond = document.createElement("p");
    beyond.className = "statistics-region-beyond";
    beyond.textContent = `通過${segmentName}後，後續路線最遠抵達第 ${progress.beyond} 場。`;
    progressSection.append(beyond);
  }

  const recordList = document.createElement("dl");
  recordList.className = "statistics-detail-grid";
  renderDefinitionList(recordList, [
    ["冒險次數", safeStatisticCount(stats.runs)],
    ["通關次數", safeStatisticCount(stats.clears)],
    ["撤退次數", safeStatisticCount(stats.retreats)]
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

// 地名與段落名相同時（平原、森林、高地）不重複寫地名；海岸的第一段叫海灘，才需要標出段落。
function getReachLabel(region) {
  const segmentName = getRegionSegmentName(region);
  return segmentName && segmentName !== getRegionDisplayName(region) ? segmentName : "最遠";
}

function applyRegionBackground(element, region, overlay) {
  const background = region.visual?.background?.desktop || region.visual?.background?.mobile;
  if (background) element.style.backgroundImage = `${overlay}, url("./${background}")`;
}
