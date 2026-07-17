import {
  getAverageEnemiesPerRun,
  getEscapeSummary,
  getOutcomeDistribution,
  safeStatisticCount
} from "./statisticsMetrics.js";
import { renderDefinitionList } from "./statisticsViewHelpers.js";

export function renderStatisticsOverview(els, stats, questStats = {}) {
  els.statisticsKeyMetrics.replaceChildren();
  els.statisticsCombatMetrics.replaceChildren();
  els.statisticsOutcomeList.replaceChildren();
  els.statisticsEscapeMetrics.replaceChildren();
  els.statisticsQuestMetrics?.replaceChildren();

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

  if (els.statisticsQuestMetrics && els.statisticsQuestCompleted) {
    const completedByRarity = questStats.completedByRarity || {};
    const completedTotal = safeStatisticCount(questStats.completedTotal);
    els.statisticsQuestCompleted.textContent = `${completedTotal} 件`;
    renderDefinitionList(els.statisticsQuestMetrics, [
      ["普通委託", safeStatisticCount(completedByRarity.common)],
      ["進階委託", safeStatisticCount(completedByRarity.advanced)],
      ["稀有委託", safeStatisticCount(completedByRarity.rare)],
      ["累積賞金", `${safeStatisticCount(questStats.rewardGoldTotal)} G`],
      ["放棄委託", safeStatisticCount(questStats.abandonedTotal)]
    ], "statistics-compact-row");
  }
}
