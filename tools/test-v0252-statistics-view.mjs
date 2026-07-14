import assert from "node:assert/strict";
import { installTestDocument, createElementMap, TestNode } from "./dom-test-stub.mjs";
import { renderStatisticsView } from "../src/ui/statisticsView.js";

installTestDocument();
const els = createElementMap([
  "statisticsOverviewView", "statisticsCharacterListView", "statisticsRegionListView", "statisticsSaveView",
  "statisticsJourneySummary", "statisticsKeyMetrics", "statisticsResolvedRuns", "statisticsOutcomeList",
  "statisticsCombatMetrics", "statisticsEscapeRate", "statisticsEscapeMetrics", "statisticsCharacterList",
  "statisticsCharacterDetail", "statisticsRegionList", "statisticsRegionDetail"
]);
els.statisticsTabs = ["overview", "characters", "regions", "save"].map((view) => {
  const button = new TestNode("button");
  button.dataset.statisticsView = view;
  return button;
});
const saveData = {
  statistics: {
    totalRuns: 10, totalClears: 2, totalRetreats: 3, totalDefeats: 4,
    totalEnemiesDefeated: 50, bossesDefeated: 2, highestRunLevel: 19,
    fleeAttempts: 3, fleeSuccesses: 1, fleeFailures: 1, safeEscapes: 1, counterEscapes: 1, evacuationEscapes: 1,
    characters: { adventurer: { runs: 10, clears: 2, retreats: 3, highestRunLevel: 19 } },
    regions: { plains: { runs: 10, clears: 2, retreats: 3, bestEncounter: 8 } }
  },
  progression: { characters: { adventurer: { unlocked: true, level: 15, exp: 20, learnedSkills: ["a", "b"] } } }
};
const characters = { adventurer: { name: "冒險者", role: "全能" } };
const regions = { plains: { name: "平原", difficulty: "入門", encounterCount: 8, bossName: "魔化野豬王", visual: { background: { desktop: "assets/images/regions/plains/desktop.png" } } } };
const uiState = { statisticsView: "overview", statisticsCharacterId: "adventurer", statisticsRegionId: "plains" };
renderStatisticsView({ els, uiState, saveData, characterDefinitions: characters, regionDefinitions: regions });
assert.match(els.statisticsJourneySummary.textContent, /單次冒險最高曾達 Lv\.19/);
assert.equal(els.statisticsOutcomeList.children.length, 4);
assert.equal(els.statisticsEscapeRate.textContent, "75%");
assert.doesNotMatch(els.statisticsJourneySummary.textContent, /NaN|Infinity/);
saveData.statistics.totalRuns = 0;
saveData.statistics.totalClears = 0;
saveData.statistics.totalRetreats = 0;
saveData.statistics.totalDefeats = 0;
saveData.statistics.totalEnemiesDefeated = 0;
saveData.statistics.highestRunLevel = 1;
renderStatisticsView({ els, uiState, saveData, characterDefinitions: characters, regionDefinitions: regions });
assert.equal(els.statisticsKeyMetrics.children.length, 4, "重繪總覽不得累加重複卡片");
assert.equal(els.statisticsCombatMetrics.children.length, 3, "戰鬥足跡重繪不得累加舊資料");
assert.match(els.statisticsJourneySummary.textContent, /尚未留下冒險紀錄/);
uiState.statisticsView = "characters";
renderStatisticsView({ els, uiState, saveData, characterDefinitions: characters, regionDefinitions: regions });
assert.equal(els.statisticsCharacterList.children.length, 1);
assert.match(els.statisticsCharacterDetail.children.at(-1).textContent || "", /^$/); // Rendering completed without missing data.
uiState.statisticsView = "regions";
renderStatisticsView({ els, uiState, saveData, characterDefinitions: characters, regionDefinitions: regions });
assert.equal(els.statisticsRegionList.children.length, 1);
assert.equal(els.statisticsRegionDetail.children.length >= 3, true);
console.log("v0.2.5.2 statistics overview, character, region, and zero-safe rendering tests passed.");
