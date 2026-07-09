import { renderChoiceList, renderStatList } from "./renderHelpers.js";

export function renderStatisticsView({ els, uiState, saveData, characterDefinitions, regionDefinitions, onCharacterDetail, onRegionDetail }) {
  const stats = saveData.statistics;
  const views = {
    overview: els.statisticsOverviewView,
    characters: els.statisticsCharacterListView,
    characterDetail: els.statisticsCharacterDetailView,
    regions: els.statisticsRegionListView,
    regionDetail: els.statisticsRegionDetailView,
    save: els.statisticsSaveView
  };

  Object.entries(views).forEach(([view, element]) => {
    element.classList.toggle("is-active", uiState.statisticsView === view);
  });
  els.statisticsTabs.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.statisticsView === getActiveStatisticsTab(uiState.statisticsView));
  });

  renderStatisticsOverview(els, stats);
  renderStatisticsCharacterList(els, saveData, characterDefinitions, onCharacterDetail);
  renderStatisticsCharacterDetail(els, saveData, characterDefinitions, uiState.statisticsCharacterId);
  renderStatisticsRegionList(els, saveData, regionDefinitions, onRegionDetail);
  renderStatisticsRegionDetail(els, saveData, regionDefinitions, uiState.statisticsRegionId);
}

function getActiveStatisticsTab(view) {
  if (view === "characterDetail") {
    return "characters";
  }
  if (view === "regionDetail") {
    return "regions";
  }
  return view;
}

function renderStatisticsOverview(els, stats) {
  const items = [
    ["冒險次數", stats.totalRuns],
    ["冒險失敗", stats.totalDefeats],
    ["主動撤退", stats.totalRetreats],
    ["總通關", stats.totalClears],
    ["擊敗敵人", stats.totalEnemiesDefeated],
    ["擊敗首領", stats.bossesDefeated],
    ["逃跑成功", stats.fleeSuccesses],
    ["逃跑失敗", stats.fleeFailures],
    ["撤離逃跑", stats.evacuationEscapes]
  ];
  renderStatList(els.statisticsOverviewList, items);
}

function renderStatisticsCharacterList(els, saveData, characterDefinitions, onCharacterDetail) {
  const unlockedCharacters = Object.entries(characterDefinitions)
    .filter(([characterId]) => saveData.progression.characters[characterId]?.unlocked === true);
  renderChoiceList(els.statisticsCharacterList, unlockedCharacters.map(([characterId, character]) => {
    const characterStats = saveData.statistics.characters[characterId];
    const characterProgress = saveData.progression.characters[characterId];
    return {
      title: character.name,
      meta: `Lv. ${characterProgress.level}`,
      description: `出戰 ${characterStats.runs} 次，通關 ${characterStats.clears} 次，目前角色 Lv. ${characterProgress.level}。`,
      action: "查看統計",
      onClick: () => onCharacterDetail(characterId)
    };
  }));
}

function renderStatisticsCharacterDetail(els, saveData, characterDefinitions, characterId) {
  const resolvedCharacterId = characterDefinitions[characterId] && saveData.progression.characters[characterId]?.unlocked === true
    ? characterId
    : Object.keys(characterDefinitions).find((candidateId) => saveData.progression.characters[candidateId]?.unlocked === true);
  const character = characterDefinitions[resolvedCharacterId];
  const characterStats = saveData.statistics.characters[resolvedCharacterId];
  const characterProgress = saveData.progression.characters[resolvedCharacterId];
  els.statisticsCharacterName.textContent = character.name;
  renderStatList(els.statisticsCharacterDetailList, [
    ["等級", characterProgress.level],
    ["經驗", characterProgress.exp],
    ["出戰次數", characterStats.runs],
    ["通關次數", characterStats.clears],
    ["撤退次數", characterStats.retreats],
    ["已學技能", characterProgress.learnedSkills.length]
  ]);
}

function renderStatisticsRegionList(els, saveData, regionDefinitions, onRegionDetail) {
  renderChoiceList(els.statisticsRegionList, Object.entries(regionDefinitions).map(([regionId, region]) => {
    const regionStats = saveData.statistics.regions[regionId];
    return {
      title: region.name,
      meta: region.difficulty,
      description: `通關 ${regionStats.clears} 次，撤退 ${regionStats.retreats} 次，最高抵達 ${regionStats.bestEncounter} / ${region.encounterCount}。`,
      action: "查看統計",
      onClick: () => onRegionDetail(regionId)
    };
  }));
}

function renderStatisticsRegionDetail(els, saveData, regionDefinitions, regionId) {
  const region = regionDefinitions[regionId];
  const regionStats = saveData.statistics.regions[regionId];
  els.statisticsRegionName.textContent = region.name;
  const items = [
    ["冒險次數", regionStats.runs],
    ["通關次數", regionStats.clears],
    ["撤退次數", regionStats.retreats],
    ["最高抵達遭遇", `${regionStats.bestEncounter} / ${region.encounterCount}`],
    ["首領", region.bossName],
    ["難度", region.difficulty]
  ];
  if (regionId === "forest" && regionStats.routeClears) {
    items.splice(2, 0,
      ["普通森林通關", regionStats.routeClears.main || 0],
      ["哥布林營地通關", regionStats.routeClears.goblinCamp || 0]
    );
  }
  renderStatList(els.statisticsRegionDetailList, items);
}
