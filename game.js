import { DEFAULT_CHARACTER_ID, DEFAULT_REGION_ID } from "./src/config.js";
import { applyEndOfTurnEffects, buildEnemy, resolveEnemyAction, resolveHeroAction } from "./src/core/combat.js";
import { createDefaultSave, deleteStoredSave, isImportableSave, loadSave, migrateSave, saveGame } from "./src/core/storage.js";
import { characterDefinitions } from "./src/data/characters/index.js";
import { regionDefinitions } from "./src/data/regions/index.js";
import { templates } from "./src/data/templates.js";
import { clone } from "./src/utils.js";

const state = {
  run: 0,
  selectedRegionId: DEFAULT_REGION_ID,
  selectedHeroId: DEFAULT_CHARACTER_ID,
  selectedRegion: regionDefinitions[DEFAULT_REGION_ID].name,
  selectedHero: characterDefinitions[DEFAULT_CHARACTER_ID].name,
  encounterIndex: 0,
  turn: 0,
  hero: null,
  enemy: null,
  awaitingBlessing: false,
  ended: false,
  log: []
};

const uiState = {
  regionView: "list",
  characterView: "list",
  statisticsView: "overview",
  statisticsCharacterId: DEFAULT_CHARACTER_ID,
  statisticsRegionId: DEFAULT_REGION_ID
};

const els = {
  menuScreen: document.querySelector("#menuScreen"),
  regionScreen: document.querySelector("#regionScreen"),
  characterScreen: document.querySelector("#characterScreen"),
  statisticsScreen: document.querySelector("#statisticsScreen"),
  achievementScreen: document.querySelector("#achievementScreen"),
  gameScreen: document.querySelector("#gameScreen"),
  openRegionButton: document.querySelector("#openRegionButton"),
  openCharacterButton: document.querySelector("#openCharacterButton"),
  openStatisticsButton: document.querySelector("#openStatisticsButton"),
  openAchievementButton: document.querySelector("#openAchievementButton"),
  regionListView: document.querySelector("#regionListView"),
  regionDetailView: document.querySelector("#regionDetailView"),
  regionChoiceList: document.querySelector("#regionChoiceList"),
  regionDetailName: document.querySelector("#regionDetailName"),
  regionDetailDescription: document.querySelector("#regionDetailDescription"),
  regionDetailStats: document.querySelector("#regionDetailStats"),
  backToRegionListButton: document.querySelector("#backToRegionListButton"),
  characterListView: document.querySelector("#characterListView"),
  characterDetailView: document.querySelector("#characterDetailView"),
  characterChoiceList: document.querySelector("#characterChoiceList"),
  characterDetailName: document.querySelector("#characterDetailName"),
  characterDetailDescription: document.querySelector("#characterDetailDescription"),
  characterDetailStats: document.querySelector("#characterDetailStats"),
  backToCharacterListButton: document.querySelector("#backToCharacterListButton"),
  selectCharacterButton: document.querySelector("#selectCharacterButton"),
  startButton: document.querySelector("#startButton"),
  restartButton: document.querySelector("#restartButton"),
  retryButton: document.querySelector("#retryButton"),
  nextButton: document.querySelector("#nextButton"),
  encounterLabel: document.querySelector("#encounterLabel"),
  resultLabel: document.querySelector("#resultLabel"),
  heroName: document.querySelector("#heroName"),
  heroLevel: document.querySelector("#heroLevel"),
  heroHealthBar: document.querySelector("#heroHealthBar"),
  heroHealthText: document.querySelector("#heroHealthText"),
  enemyName: document.querySelector("#enemyName"),
  enemyKind: document.querySelector("#enemyKind"),
  enemyHealthBar: document.querySelector("#enemyHealthBar"),
  enemyHealthText: document.querySelector("#enemyHealthText"),
  currentStats: document.querySelector("#currentStats"),
  battleLog: document.querySelector("#battleLog"),
  blessingPanel: document.querySelector("#blessingPanel"),
  blessingChoices: document.querySelector("#blessingChoices"),
  endPanel: document.querySelector("#endPanel"),
  endTitle: document.querySelector("#endTitle"),
  endText: document.querySelector("#endText"),
  statisticsTabs: document.querySelectorAll("[data-statistics-view]"),
  statisticsOverviewView: document.querySelector("#statisticsOverviewView"),
  statisticsCharacterListView: document.querySelector("#statisticsCharacterListView"),
  statisticsCharacterDetailView: document.querySelector("#statisticsCharacterDetailView"),
  statisticsRegionListView: document.querySelector("#statisticsRegionListView"),
  statisticsRegionDetailView: document.querySelector("#statisticsRegionDetailView"),
  statisticsSaveView: document.querySelector("#statisticsSaveView"),
  statisticsOverviewList: document.querySelector("#statisticsOverviewList"),
  statisticsCharacterList: document.querySelector("#statisticsCharacterList"),
  statisticsCharacterName: document.querySelector("#statisticsCharacterName"),
  statisticsCharacterDetailList: document.querySelector("#statisticsCharacterDetailList"),
  statisticsRegionList: document.querySelector("#statisticsRegionList"),
  statisticsRegionName: document.querySelector("#statisticsRegionName"),
  statisticsRegionDetailList: document.querySelector("#statisticsRegionDetailList"),
  backToStatisticsCharacterListButton: document.querySelector("#backToStatisticsCharacterListButton"),
  backToStatisticsRegionListButton: document.querySelector("#backToStatisticsRegionListButton"),
  exportSaveButton: document.querySelector("#exportSaveButton"),
  importSaveButton: document.querySelector("#importSaveButton"),
  importSaveInput: document.querySelector("#importSaveInput"),
  saveNotice: document.querySelector("#saveNotice"),
  deleteSaveButton: document.querySelector("#deleteSaveButton"),
  deleteSavePanel: document.querySelector("#deleteSavePanel"),
  confirmDeleteSaveButton: document.querySelector("#confirmDeleteSaveButton"),
  cancelDeleteSaveButton: document.querySelector("#cancelDeleteSaveButton")
};

let saveData = loadSave();

function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.toggle("is-active", screen.id === screenId);
  });

  if (screenId === "menuScreen") {
    els.resultLabel.textContent = "冒險準備中";
    els.encounterLabel.textContent = "尚未開始";
  }
  if (screenId === "regionScreen") {
    els.resultLabel.textContent = "選擇地區";
    els.encounterLabel.textContent = state.selectedRegion;
    renderRegionScreen();
  }
  if (screenId === "characterScreen") {
    els.resultLabel.textContent = "選擇角色";
    els.encounterLabel.textContent = state.selectedHero;
    renderCharacterScreen();
  }
  if (screenId === "achievementScreen") {
    els.resultLabel.textContent = "尚未開放";
    els.encounterLabel.textContent = "成就系統";
  }
  if (screenId === "statisticsScreen") {
    els.resultLabel.textContent = "累積紀錄";
    els.encounterLabel.textContent = "統計數據";
    renderStatistics();
  }
}

function syncSelectionFromSave() {
  const regionId = regionDefinitions[saveData.settings.selectedRegionId] ? saveData.settings.selectedRegionId : DEFAULT_REGION_ID;
  const characterId = characterDefinitions[saveData.settings.selectedCharacterId] ? saveData.settings.selectedCharacterId : DEFAULT_CHARACTER_ID;
  state.selectedRegionId = regionId;
  state.selectedHeroId = characterId;
  state.selectedRegion = regionDefinitions[regionId].name;
  state.selectedHero = characterDefinitions[characterId].name;
}

function showRegionList() {
  uiState.regionView = "list";
  showScreen("regionScreen");
}

function showRegionDetail(regionId = DEFAULT_REGION_ID) {
  saveData.settings.selectedRegionId = regionId;
  saveGameSafe();
  syncSelectionFromSave();
  uiState.regionView = "detail";
  showScreen("regionScreen");
}

function renderRegionScreen() {
  els.regionListView.classList.toggle("is-active", uiState.regionView === "list");
  els.regionDetailView.classList.toggle("is-active", uiState.regionView === "detail");

  renderChoiceList(els.regionChoiceList, Object.entries(regionDefinitions).map(([regionId, region]) => ({
    title: region.name,
    meta: region.difficulty,
    description: `${region.encounterCount} 場遭遇，首領：${region.bossName}`,
    action: "查看地區",
    onClick: () => showRegionDetail(regionId)
  })));

  if (uiState.regionView === "detail") {
    const region = currentRegion();
    els.regionDetailName.textContent = region.name;
    els.regionDetailDescription.textContent = region.description;
    renderStatList(els.regionDetailStats, [
      ["遭遇數", region.encounterCount],
      ["首領", region.bossName],
      ["難度", region.difficulty],
      ["角色", state.selectedHero]
    ]);
    els.startButton.textContent = `開始${region.name}冒險`;
  }
}

function showCharacterList() {
  uiState.characterView = "list";
  showScreen("characterScreen");
}

function showCharacterDetail(characterId = DEFAULT_CHARACTER_ID) {
  saveData.settings.selectedCharacterId = characterId;
  saveGameSafe();
  syncSelectionFromSave();
  uiState.characterView = "detail";
  showScreen("characterScreen");
}

function renderCharacterScreen() {
  els.characterListView.classList.toggle("is-active", uiState.characterView === "list");
  els.characterDetailView.classList.toggle("is-active", uiState.characterView === "detail");

  renderChoiceList(els.characterChoiceList, Object.entries(characterDefinitions).map(([characterId, character]) => ({
    title: character.name,
    meta: characterId === saveData.settings.selectedCharacterId ? "目前選擇" : "可使用",
    description: character.description,
    action: "查看角色",
    onClick: () => showCharacterDetail(characterId)
  })));

  if (uiState.characterView === "detail") {
    const character = characterDefinitions[state.selectedHeroId];
    els.characterDetailName.textContent = character.name;
    els.characterDetailDescription.textContent = character.description;
    renderStatList(els.characterDetailStats, [
      ["最大生命", character.stats.maxHp],
      ["攻擊", character.stats.attack],
      ["防禦", character.stats.defense],
      ["暴擊", character.stats.critChance]
    ]);
    els.selectCharacterButton.textContent = `使用${character.name}`;
  }
}

function recordRunStarted() {
  const stats = saveData.statistics;
  const regionStats = stats.regions[state.selectedRegionId];
  const characterStats = stats.characters[state.selectedHeroId];
  const characterProgress = saveData.progression.characters[state.selectedHeroId];

  stats.totalRuns += 1;
  regionStats.runs += 1;
  characterStats.runs += 1;
  characterProgress.runs += 1;

  saveGameSafe();
}

function recordEnemyDefeated(isBoss) {
  saveData.statistics.totalEnemiesDefeated += 1;
  if (isBoss) {
    saveData.statistics.bossesDefeated += 1;
  }
  saveGameSafe();
}

function recordRunFinished(cleared) {
  const stats = saveData.statistics;
  const regionStats = stats.regions[state.selectedRegionId];
  const characterStats = stats.characters[state.selectedHeroId];
  const regionProgress = saveData.progression.regions[state.selectedRegionId];
  const characterProgress = saveData.progression.characters[state.selectedHeroId];
  const bestEncounter = cleared ? currentRegion().encounterCount : state.encounterIndex + 1;

  regionStats.bestEncounter = Math.max(regionStats.bestEncounter, bestEncounter);
  regionProgress.bestEncounter = Math.max(regionProgress.bestEncounter, bestEncounter);

  if (cleared) {
    stats.totalClears += 1;
    regionStats.clears += 1;
    characterStats.clears += 1;
    regionProgress.clears += 1;
    characterProgress.clears += 1;
  } else {
    stats.totalDefeats += 1;
  }

  saveGameSafe();
}

function renderStatistics() {
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
    button.classList.toggle("is-active", button.dataset.statisticsView === getActiveStatisticsTab());
  });

  renderStatisticsOverview(stats);
  renderStatisticsCharacterList();
  renderStatisticsCharacterDetail(uiState.statisticsCharacterId);
  renderStatisticsRegionList();
  renderStatisticsRegionDetail(uiState.statisticsRegionId);
}

function getActiveStatisticsTab() {
  if (uiState.statisticsView === "characterDetail") {
    return "characters";
  }
  if (uiState.statisticsView === "regionDetail") {
    return "regions";
  }
  return uiState.statisticsView;
}

function showStatisticsView(view) {
  uiState.statisticsView = view;
  renderStatistics();
}

function showStatisticsCharacterDetail(characterId = DEFAULT_CHARACTER_ID) {
  uiState.statisticsCharacterId = characterId;
  uiState.statisticsView = "characterDetail";
  renderStatistics();
}

function showStatisticsRegionDetail(regionId = DEFAULT_REGION_ID) {
  uiState.statisticsRegionId = regionId;
  uiState.statisticsView = "regionDetail";
  renderStatistics();
}

function renderStatisticsOverview(stats) {
  renderStatList(els.statisticsOverviewList, [
    ["冒險次數", stats.totalRuns],
    ["冒險失敗", stats.totalDefeats],
    ["總通關", stats.totalClears],
    ["擊敗敵人", stats.totalEnemiesDefeated],
    ["擊敗首領", stats.bossesDefeated]
  ]);
}

function renderStatisticsCharacterList() {
  renderChoiceList(els.statisticsCharacterList, Object.entries(characterDefinitions).map(([characterId, character]) => {
    const characterStats = saveData.statistics.characters[characterId];
    const characterProgress = saveData.progression.characters[characterId];
    return {
      title: character.name,
      meta: `Lv. ${characterProgress.level}`,
      description: `出戰 ${characterStats.runs} 次，通關 ${characterStats.clears} 次。`,
      action: "查看統計",
      onClick: () => showStatisticsCharacterDetail(characterId)
    };
  }));
}

function renderStatisticsCharacterDetail(characterId) {
  const character = characterDefinitions[characterId];
  const characterStats = saveData.statistics.characters[characterId];
  const characterProgress = saveData.progression.characters[characterId];
  els.statisticsCharacterName.textContent = character.name;
  renderStatList(els.statisticsCharacterDetailList, [
    ["等級", characterProgress.level],
    ["經驗", characterProgress.exp],
    ["出戰次數", characterStats.runs],
    ["通關次數", characterStats.clears],
    ["已學技能", characterProgress.learnedSkills.length]
  ]);
}

function renderStatisticsRegionList() {
  renderChoiceList(els.statisticsRegionList, Object.entries(regionDefinitions).map(([regionId, region]) => {
    const regionStats = saveData.statistics.regions[regionId];
    return {
      title: region.name,
      meta: region.difficulty,
      description: `通關 ${regionStats.clears} 次，最高抵達 ${regionStats.bestEncounter} / ${region.encounterCount}。`,
      action: "查看統計",
      onClick: () => showStatisticsRegionDetail(regionId)
    };
  }));
}

function renderStatisticsRegionDetail(regionId) {
  const region = regionDefinitions[regionId];
  const regionStats = saveData.statistics.regions[regionId];
  els.statisticsRegionName.textContent = region.name;
  renderStatList(els.statisticsRegionDetailList, [
    ["冒險次數", regionStats.runs],
    ["通關次數", regionStats.clears],
    ["最高抵達遭遇", `${regionStats.bestEncounter} / ${region.encounterCount}`],
    ["首領", region.bossName],
    ["難度", region.difficulty]
  ]);
}

function renderStatList(element, items) {
  element.innerHTML = "";
  items.forEach(([label, value]) => {
    const item = document.createElement("div");
    item.innerHTML = `<dt>${label}</dt><dd>${value}</dd>`;
    element.append(item);
  });
}

function renderChoiceList(element, choices) {
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

function setSaveNotice(message, type = "status") {
  els.saveNotice.textContent = message;
  els.saveNotice.dataset.type = type;
}

function exportSave() {
  const exportData = migrateSave(saveData);
  exportData.profile.exportedAt = new Date().toISOString();
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `legend-eternal-save-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setSaveNotice("存檔已匯出。請妥善保存下載的備份檔。");
}

function openImportSavePicker() {
  els.importSaveInput.value = "";
  els.importSaveInput.click();
}

function importSaveFromFile(event) {
  const [file] = event.target.files;
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const importedSave = JSON.parse(reader.result);
      if (!isImportableSave(importedSave)) {
        throw new Error("Invalid save file");
      }
      saveData = migrateSave(importedSave, { persist: true });
      syncSelectionFromSave();
      renderStatistics();
      setSaveNotice("存檔已匯入並轉換為目前版本。");
    } catch {
      setSaveNotice("匯入失敗。請確認檔案是傳說永恆的存檔備份。", "error");
    }
  });
  reader.readAsText(file);
}

function openDeleteSaveDialog() {
  els.deleteSavePanel.classList.add("is-visible");
}

function closeDeleteSaveDialog() {
  els.deleteSavePanel.classList.remove("is-visible");
}

function deleteSave() {
  try {
    deleteStoredSave();
  } catch {
    // The in-memory reset still keeps the page usable if storage is blocked.
  }
  saveData = createDefaultSave();
  saveGameSafe();
  syncSelectionFromSave();
  closeDeleteSaveDialog();
  renderStatistics();
  setSaveNotice("存檔已刪除，新的空白存檔已建立。");
  els.resultLabel.textContent = "存檔已刪除";
  els.encounterLabel.textContent = "統計數據";
}

function format(templateId, values = {}) {
  return templates[templateId].replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");
}

function addLog(type, templateId, values) {
  state.log.push({
    type,
    text: format(templateId, values)
  });
  renderLog();
}

function addFixedLog(type, text) {
  state.log.push({ type, text });
  renderLog();
}

function createCombatLogger() {
  return {
    template: addLog,
    fixed: addFixedLog
  };
}

function startRun() {
  syncSelectionFromSave();
  state.run += 1;
  state.encounterIndex = 0;
  state.turn = 0;
  state.hero = clone(characterDefinitions[state.selectedHeroId].template);
  state.enemy = null;
  state.awaitingBlessing = false;
  state.ended = false;
  state.log = [];

  showScreen("gameScreen");
  els.blessingPanel.classList.remove("is-visible");
  els.endPanel.classList.remove("is-visible");
  closeDeleteSaveDialog();
  els.nextButton.disabled = false;

  recordRunStarted();
  startEncounter();
}

function restart() {
  showScreen("menuScreen");
  els.blessingPanel.classList.remove("is-visible");
  els.endPanel.classList.remove("is-visible");
  closeDeleteSaveDialog();
  els.nextButton.disabled = true;
  state.awaitingBlessing = false;
  state.ended = true;
  els.resultLabel.textContent = "冒險準備中";
  els.encounterLabel.textContent = "尚未開始";
}

function startEncounter() {
  const region = currentRegion();
  const encounterType = region.encounterPlan[state.encounterIndex];
  state.turn = 0;
  state.awaitingBlessing = false;
  state.log = [];
  state.enemy = buildEnemy(region, state.encounterIndex);
  state.enemy.poison = 0;
  state.hero.poison = 0;
  state.hero.shield = state.hero.shieldStart;

  els.blessingPanel.classList.remove("is-visible");
  els.nextButton.disabled = false;

  if (encounterType === "boss") {
    addLog("system", "boss");
  }
  addLog("system", "encounter", { enemy: state.enemy.name });
  addFixedLog("status", state.enemy.intro);
  if (state.hero.shield > 0) {
    addLog("status", "shield", { target: state.hero.name, amount: state.hero.shield });
  }
  render();
}

function playTurn() {
  if (state.ended || state.awaitingBlessing || !state.enemy) {
    return;
  }

  const log = createCombatLogger();
  state.turn += 1;
  resolveHeroAction({ hero: state.hero, enemy: state.enemy, log });
  if (state.enemy.hp <= 0) {
    winEncounter();
    return;
  }

  resolveEnemyAction({ hero: state.hero, enemy: state.enemy, turn: state.turn, log });
  if (state.hero.hp <= 0) {
    loseRun();
    return;
  }

  applyEndOfTurnEffects({ hero: state.hero, enemy: state.enemy, turn: state.turn, log });
  if (state.enemy.hp <= 0) {
    winEncounter();
    return;
  }
  if (state.hero.hp <= 0) {
    loseRun();
    return;
  }

  render();
}

function winEncounter() {
  const enemyName = state.enemy.name;
  const defeatedBoss = state.enemy.kind === "首領";
  addLog("system", "victory", { target: enemyName });
  recordEnemyDefeated(defeatedBoss);

  if (state.hero.killHeal > 0) {
    state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + state.hero.killHeal);
    addLog("heal", "heal", { target: state.hero.name, amount: state.hero.killHeal });
  }

  state.encounterIndex += 1;
  render();

  if (state.encounterIndex >= currentRegion().encounterPlan.length) {
    addLog("system", "clear");
    finishRun(true);
    return;
  }

  showBlessings();
}

function loseRun() {
  addLog("system", "defeat", { target: state.hero.name });
  finishRun(false);
}

function finishRun(cleared) {
  const region = currentRegion();
  state.ended = true;
  state.awaitingBlessing = false;
  recordRunFinished(cleared);
  els.nextButton.disabled = true;
  els.blessingPanel.classList.remove("is-visible");
  els.endPanel.classList.add("is-visible");
  els.endTitle.textContent = cleared ? "冒險成功" : "冒險失敗";
  els.endText.textContent = cleared
    ? `你完成了${region.name}的挑戰。本輪共通過 ${state.encounterIndex} 場遭遇。`
    : `你抵達了第 ${state.encounterIndex + 1} 場遭遇。本輪冒險結束。`;
  els.resultLabel.textContent = cleared ? `${region.name}突破` : "本輪結束";
  render();
}

function showBlessings() {
  state.awaitingBlessing = true;
  els.nextButton.disabled = true;
  els.blessingPanel.classList.add("is-visible");
  els.resultLabel.textContent = "選擇祝福";
  els.blessingChoices.innerHTML = "";

  getBlessingChoices(3).forEach((blessing) => {
    const button = document.createElement("button");
    button.className = "blessing-card";
    button.type = "button";
    button.innerHTML = `
      <small>${blessing.eventTitle}</small>
      <strong>${blessing.name}</strong>
      <span>${blessing.eventText}</span>
      <em>${blessing.flavorText}</em>
      <b>${blessing.effectText}</b>
    `;
    button.addEventListener("click", () => chooseBlessing(blessing));
    els.blessingChoices.append(button);
  });
}

function getBlessingChoices(count) {
  const pool = [...currentRegion().blessings];
  const choices = [];
  while (choices.length < count && pool.length > 0) {
    const index = Math.floor(Math.random() * pool.length);
    choices.push(pool.splice(index, 1)[0]);
  }
  return choices;
}

function chooseBlessing(blessing) {
  blessing.apply(state.hero);
  state.hero.blessings.push(blessing.name);
  addLog("system", "blessing", { blessing: blessing.name });
  startEncounter();
}

function render() {
  const hero = state.hero;
  const enemy = state.enemy;
  const region = currentRegion();

  els.heroName.textContent = hero.name;
  els.heroLevel.textContent = `第 ${state.run} 輪`;
  setMeter(els.heroHealthBar, hero.hp, hero.maxHp);
  els.heroHealthText.textContent = `${hero.hp} / ${hero.maxHp}`;

  els.enemyName.textContent = enemy ? enemy.name : "敵人";
  els.enemyKind.textContent = enemy ? enemy.kind : "普通";
  setMeter(els.enemyHealthBar, enemy ? enemy.hp : 0, enemy ? enemy.maxHp : 1);
  els.enemyHealthText.textContent = enemy ? `${enemy.hp} / ${enemy.maxHp}` : "0 / 0";

  els.encounterLabel.textContent = `第 ${Math.min(state.encounterIndex + 1, region.encounterPlan.length)} / ${region.encounterPlan.length} 場`;
  if (!state.ended) {
    els.resultLabel.textContent = state.awaitingBlessing
      ? "選擇祝福"
      : state.turn === 0
        ? "遭遇開始"
        : `第 ${state.turn} 回合`;
  }

  els.currentStats.innerHTML = "";
  [
    ["攻擊", hero.attack],
    ["防禦", hero.defense],
    ["暴擊", `${Math.round(hero.critChance * 100)}%`],
    ["護盾", hero.shield || 0],
    ["中毒", hero.poison || 0],
    ["祝福", hero.blessings.length]
  ].forEach(([label, value]) => {
    const item = document.createElement("div");
    item.innerHTML = `<dt>${label}</dt><dd>${value}</dd>`;
    els.currentStats.append(item);
  });
}

function renderLog() {
  els.battleLog.innerHTML = "";
  state.log.slice(-80).reverse().forEach((entry) => {
    const item = document.createElement("li");
    item.className = entry.type;
    item.textContent = entry.text;
    els.battleLog.append(item);
  });
  els.battleLog.scrollTop = 0;
}

function setMeter(element, value, max) {
  const ratio = Math.max(0, Math.min(1, value / max));
  element.style.width = `${Math.round(ratio * 100)}%`;
}

function currentRegion() {
  return regionDefinitions[state.selectedRegionId];
}

function saveGameSafe() {
  saveGame(saveData, {
    onError: () => addFixedLog("system", "瀏覽器無法保存目前進度。")
  });
}

function bindEvents() {
  els.openRegionButton.addEventListener("click", showRegionList);
  els.openCharacterButton.addEventListener("click", showCharacterList);
  els.openStatisticsButton.addEventListener("click", () => {
    uiState.statisticsView = "overview";
    showScreen("statisticsScreen");
  });
  els.openAchievementButton.addEventListener("click", () => showScreen("achievementScreen"));
  els.backToRegionListButton.addEventListener("click", showRegionList);
  els.backToCharacterListButton.addEventListener("click", showCharacterList);
  els.statisticsTabs.forEach((button) => {
    button.addEventListener("click", () => showStatisticsView(button.dataset.statisticsView));
  });
  els.backToStatisticsCharacterListButton.addEventListener("click", () => showStatisticsView("characters"));
  els.backToStatisticsRegionListButton.addEventListener("click", () => showStatisticsView("regions"));
  els.selectCharacterButton.addEventListener("click", () => {
    saveData.settings.selectedCharacterId = state.selectedHeroId;
    saveGameSafe();
    syncSelectionFromSave();
    showScreen("menuScreen");
  });
  document.querySelectorAll(".back-button").forEach((button) => {
    button.addEventListener("click", () => showScreen(button.dataset.target));
  });
  document.querySelectorAll(".home-button").forEach((button) => {
    button.addEventListener("click", restart);
  });
  els.startButton.addEventListener("click", startRun);
  els.restartButton.addEventListener("click", restart);
  els.retryButton.addEventListener("click", startRun);
  els.nextButton.addEventListener("click", playTurn);
  els.exportSaveButton.addEventListener("click", exportSave);
  els.importSaveButton.addEventListener("click", openImportSavePicker);
  els.importSaveInput.addEventListener("change", importSaveFromFile);
  els.deleteSaveButton.addEventListener("click", openDeleteSaveDialog);
  els.confirmDeleteSaveButton.addEventListener("click", deleteSave);
  els.cancelDeleteSaveButton.addEventListener("click", closeDeleteSaveDialog);
}

syncSelectionFromSave();
bindEvents();
