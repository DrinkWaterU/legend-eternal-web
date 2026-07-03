import { DEFAULT_CHARACTER_ID, DEFAULT_REGION_ID } from "./src/config.js";
import { applyBlessingEffects } from "./src/core/blessings.js";
import { applyEndOfTurnEffects, buildEnemy, resolveEnemyAction, resolveHeroAction } from "./src/core/combat.js";
import { createDefaultSave, deleteStoredSave, isImportableSave, loadSave, migrateSave, saveGame } from "./src/core/storage.js";
import { characterDefinitions } from "./src/data/characters/index.js";
import { regionDefinitions } from "./src/data/regions/index.js";
import { getBlessingRarity } from "./src/data/rarities.js";
import { templates } from "./src/data/templates.js";
import { els } from "./src/ui/dom.js";
import { renderBattleLog, renderBlessingChoices, renderChoiceList, renderCurrentStats, renderStatList, setMeter } from "./src/ui/renderHelpers.js";
import { renderStatisticsView } from "./src/ui/statisticsView.js";
import { clone, roll, weightedRandomItem } from "./src/utils.js";

const RUN_STARTING_FLEES = 2;
const NORMAL_FLEE_CHANCE = 0.8;
const ELITE_FLEE_CHANCE = 0.55;
const FLEE_RESULTS = [
  { id: "safe", weight: 65 },
  { id: "counter", weight: 25 },
  { id: "evacuation", weight: 10 }
];
const REST_HEAL_RATIO = 0.15;

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
  phase: "camp",
  awaitingBlessing: false,
  ended: false,
  defeatedEnemies: 0,
  defeatedBoss: false,
  deathCause: null,
  lastRunSummary: null,
  runStats: null,
  canRest: false,
  hasRested: false,
  ambushAdvantage: false,
  log: []
};

const uiState = {
  regionView: "list",
  characterView: "list",
  statisticsView: "overview",
  statisticsCharacterId: DEFAULT_CHARACTER_ID,
  statisticsRegionId: DEFAULT_REGION_ID
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
  if (screenId === "campScreen") {
    els.resultLabel.textContent = "營地整備";
    els.encounterLabel.textContent = state.selectedRegion;
    renderCampScreen();
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

function renderCampScreen() {
  const region = currentRegion();
  const character = characterDefinitions[state.selectedHeroId];
  const lastResult = state.lastRunSummary
    ? `${state.lastRunSummary.result}，抵達第 ${state.lastRunSummary.reachedEncounter} / ${region.encounterPlan.length} 場`
    : "尚無紀錄";

  renderStatList(els.campStatusList, [
    ["目前角色", character.name],
    ["目前地區", region.name],
    ["地區難度", region.difficulty],
    ["最近冒險", lastResult]
  ]);
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

function createRunStats() {
  return {
    expGained: 0,
    highestRunLevel: 1,
    fleeAttempts: 0,
    fleeSuccesses: 0,
    fleeFailures: 0,
    safeEscapes: 0,
    counterEscapes: 0,
    evacuationEscapes: 0,
    retreated: false
  };
}

function getRunProgression() {
  return characterDefinitions[state.selectedHeroId].runProgression || {
    maxLevel: 1,
    expCurve: [0],
    levelUps: {}
  };
}

function getRunExpToNext(level) {
  const progression = getRunProgression();
  if (level >= progression.maxLevel) {
    return "MAX";
  }
  return progression.expCurve[level] ?? "MAX";
}

function gainRunExp(amount) {
  if (!state.hero || amount <= 0) {
    return;
  }

  state.hero.runExp += amount;
  state.runStats.expGained += amount;
  addLog("system", "expGain", { amount });
  applyRunLevelUps();
}

function applyRunLevelUps() {
  const progression = getRunProgression();
  while (
    state.hero.runLevel < progression.maxLevel
    && state.hero.runExp >= (progression.expCurve[state.hero.runLevel] ?? Infinity)
  ) {
    state.hero.runLevel += 1;
    state.runStats.highestRunLevel = Math.max(state.runStats.highestRunLevel, state.hero.runLevel);
    const levelUp = progression.levelUps[String(state.hero.runLevel)];
    applyRunLevelUp(levelUp);
    addLog("system", "levelUp", {
      level: state.hero.runLevel,
      name: levelUp?.name || "能力提升"
    });
  }

  state.hero.runExpToNext = getRunExpToNext(state.hero.runLevel);
}

function applyRunLevelUp(levelUp) {
  if (!levelUp) {
    return;
  }

  (levelUp.effects || []).forEach((effect) => {
    if (effect.type === "add") {
      state.hero[effect.stat] = (state.hero[effect.stat] || 0) + effect.amount;
    }
    if (effect.type === "recoverHp") {
      state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + effect.amount);
    }
  });

  (levelUp.skills || []).forEach((skill) => {
    if (!state.hero.runSkills.includes(skill)) {
      state.hero.runSkills.push(skill);
    }
  });
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

function recordRunFinished(outcome) {
  const stats = saveData.statistics;
  const regionStats = stats.regions[state.selectedRegionId];
  const characterStats = stats.characters[state.selectedHeroId];
  const regionProgress = saveData.progression.regions[state.selectedRegionId];
  const characterProgress = saveData.progression.characters[state.selectedHeroId];
  const cleared = outcome === "clear";
  const retreated = outcome === "retreat";
  const bestEncounter = cleared ? currentRegion().encounterCount : state.encounterIndex + 1;

  regionStats.bestEncounter = Math.max(regionStats.bestEncounter, bestEncounter);
  regionProgress.bestEncounter = Math.max(regionProgress.bestEncounter, bestEncounter);
  stats.highestRunLevel = Math.max(stats.highestRunLevel, state.runStats?.highestRunLevel || 1);
  characterStats.highestRunLevel = Math.max(characterStats.highestRunLevel, state.runStats?.highestRunLevel || 1);
  stats.fleeAttempts += state.runStats?.fleeAttempts || 0;
  stats.fleeSuccesses += state.runStats?.fleeSuccesses || 0;
  stats.fleeFailures += state.runStats?.fleeFailures || 0;
  stats.safeEscapes += state.runStats?.safeEscapes || 0;
  stats.counterEscapes += state.runStats?.counterEscapes || 0;
  stats.evacuationEscapes += state.runStats?.evacuationEscapes || 0;

  if (cleared) {
    stats.totalClears += 1;
    regionStats.clears += 1;
    characterStats.clears += 1;
    regionProgress.clears += 1;
    characterProgress.clears += 1;
  } else if (retreated) {
    stats.totalRetreats += 1;
    regionStats.retreats += 1;
    characterStats.retreats += 1;
  } else {
    stats.totalDefeats += 1;
  }

  saveGameSafe();
}

function renderStatistics() {
  renderStatisticsView({
    els,
    uiState,
    saveData,
    characterDefinitions,
    regionDefinitions,
    onCharacterDetail: showStatisticsCharacterDetail,
    onRegionDetail: showStatisticsRegionDetail
  });
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
  state.hero.runLevel = 1;
  state.hero.runExp = 0;
  state.hero.runExpToNext = getRunExpToNext(1);
  state.hero.runSkills = [];
  state.hero.fleesRemaining = RUN_STARTING_FLEES;
  state.enemy = null;
  state.phase = "danger";
  state.awaitingBlessing = false;
  state.ended = false;
  state.defeatedEnemies = 0;
  state.defeatedBoss = false;
  state.deathCause = null;
  state.runStats = createRunStats();
  state.canRest = false;
  state.hasRested = false;
  state.ambushAdvantage = false;
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
  setCombatActionState();
  state.awaitingBlessing = false;
  state.ended = true;
  state.phase = "camp";
  els.resultLabel.textContent = "冒險準備中";
  els.encounterLabel.textContent = "尚未開始";
}

function returnToCamp() {
  showScreen("campScreen");
  els.blessingPanel.classList.remove("is-visible");
  els.endPanel.classList.remove("is-visible");
  closeDeleteSaveDialog();
  state.awaitingBlessing = false;
  state.ended = true;
  state.phase = "camp";
  setCombatActionState();
}

function startEncounter() {
  const region = currentRegion();
  const encounterType = region.encounterPlan[state.encounterIndex];
  state.turn = 0;
  state.awaitingBlessing = false;
  state.phase = "danger";
  state.canRest = false;
  state.hasRested = false;
  state.ambushAdvantage = false;
  state.log = [];
  state.enemy = buildEnemy(region, state.encounterIndex, state.hero);
  state.enemy.poison = 0;
  state.hero.poison = 0;
  state.hero.shield = state.hero.shieldStart;

  els.blessingPanel.classList.remove("is-visible");
  setCombatActionState();

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
  if (state.ended || state.awaitingBlessing || !state.enemy || state.phase === "safe") {
    return;
  }

  const log = createCombatLogger();
  state.phase = "combat";
  state.turn += 1;
  resolveHeroAction({ hero: state.hero, enemy: state.enemy, log });
  if (state.enemy.hp <= 0) {
    winEncounter();
    return;
  }

  const enemyAction = resolveEnemyAction({ hero: state.hero, enemy: state.enemy, turn: state.turn, log });
  if (state.hero.hp <= 0) {
    state.deathCause = enemyAction;
    loseRun();
    return;
  }

  const endOfTurn = applyEndOfTurnEffects({ hero: state.hero, enemy: state.enemy, turn: state.turn, log });
  if (state.hero.hp <= 0) {
    state.deathCause = endOfTurn.heroDeathCause || {
      type: "other",
      label: "回合結束效果"
    };
    loseRun();
    return;
  }
  if (state.enemy.hp <= 0) {
    winEncounter();
    return;
  }

  render();
}

function winEncounter() {
  const enemyName = state.enemy.name;
  const defeatedBoss = state.enemy.kind === "首領";
  addLog("system", "victory", { target: enemyName });
  gainRunExp(getEnemyExpReward(state.enemy));
  recordEnemyDefeated(defeatedBoss);
  state.defeatedEnemies += 1;
  state.defeatedBoss = state.defeatedBoss || defeatedBoss;

  if (state.hero.killHeal > 0) {
    state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + state.hero.killHeal);
    addLog("heal", "heal", { target: state.hero.name, amount: state.hero.killHeal });
  }

  state.encounterIndex += 1;
  render();

  if (state.encounterIndex >= currentRegion().encounterPlan.length) {
    addLog("system", "clear");
    finishRun("clear");
    return;
  }

  showBlessings();
}

function getEnemyExpReward(enemy) {
  if (Number.isFinite(enemy.expReward)) {
    return enemy.expReward;
  }
  if (enemy.kind === "首領") {
    return 48;
  }
  if (enemy.kind === "精英") {
    return 26;
  }
  return 9;
}

function enterSafeState(options = {}) {
  const { canRest = false } = options;
  state.phase = "safe";
  state.awaitingBlessing = false;
  state.enemy = null;
  state.canRest = canRest;
  state.hasRested = false;
  els.blessingPanel.classList.remove("is-visible");
  addLog("system", "safeState");
  setCombatActionState();
  render();
}

function loseRun() {
  addLog("system", "defeat", { target: state.hero.name });
  finishRun("defeat");
}

function finishRun(outcome) {
  const region = currentRegion();
  const cleared = outcome === "clear";
  const retreated = outcome === "retreat";
  state.ended = true;
  state.awaitingBlessing = false;
  state.phase = "ended";
  recordRunFinished(outcome);
  els.nextButton.disabled = true;
  els.blessingPanel.classList.remove("is-visible");
  els.endPanel.classList.add("is-visible");
  els.endTitle.textContent = cleared ? "冒險成功" : retreated ? "冒險撤退" : "冒險失敗";
  els.endText.textContent = getEndText(outcome, region);
  renderEndSummary(outcome, region);
  els.resultLabel.textContent = cleared ? `${region.name}突破` : retreated ? "回到營地" : "本輪結束";
  setCombatActionState();
  render();
}

function getEndText(outcome, region) {
  if (outcome === "clear") {
    return `你完成了${region.name}的挑戰。`;
  }
  if (outcome === "retreat") {
    return "你回到營地。本輪的局內祝福與等級會重置，下一次冒險將重新開始。";
  }

  return "冒險者倒下了。你可以查看最後一場戰鬥紀錄，確認本輪結束前發生了什麼。";
}

function renderEndSummary(outcome, region) {
  const cleared = outcome === "clear";
  const retreated = outcome === "retreat";
  const reachedEncounter = getReachedEncounter(cleared, region);
  const blessings = state.hero.blessings.length > 0 ? state.hero.blessings.join("、") : "無";
  state.lastRunSummary = {
    result: cleared ? "成功" : retreated ? "撤退" : "失敗",
    reachedEncounter,
    runLevel: state.runStats?.highestRunLevel || 1
  };
  const items = [
    ["結果", cleared ? "冒險成功" : retreated ? "冒險撤退" : "冒險失敗"],
    ["抵達", `第 ${reachedEncounter} / ${region.encounterPlan.length} 場`],
    ["局內等級", `Lv. ${state.runStats?.highestRunLevel || 1}`],
    ["局內經驗", `${state.runStats?.expGained || 0}`],
    ["擊敗敵人", `${state.defeatedEnemies} 隻`],
    ["擊敗首領", state.defeatedBoss ? "是" : "否"],
    ["逃跑", `成功 ${state.runStats?.fleeSuccesses || 0} / 失敗 ${state.runStats?.fleeFailures || 0}`],
    ["選擇祝福", blessings]
  ];

  if (!cleared && !retreated) {
    items.push(["死因", state.deathCause ? state.deathCause.label : "未知"]);
  }

  renderStatList(els.endSummary, items);
}

function getReachedEncounter(cleared, region) {
  if (cleared) {
    return region.encounterPlan.length;
  }

  return Math.min(state.encounterIndex + 1, region.encounterPlan.length);
}

function showBlessings() {
  state.awaitingBlessing = true;
  els.nextButton.disabled = true;
  els.blessingPanel.classList.add("is-visible");
  els.resultLabel.textContent = "選擇祝福";
  renderBlessingChoices(els.blessingChoices, getBlessingChoices(3), chooseBlessing);
}

function tryFlee() {
  if (!state.hero || !state.enemy || state.ended || state.awaitingBlessing || state.phase === "safe") {
    return;
  }
  if (state.hero.fleesRemaining <= 0 || state.enemy.kind === "首領") {
    return;
  }

  state.hero.fleesRemaining -= 1;
  state.runStats.fleeAttempts += 1;
  addLog("system", "fleeAttempt", { enemy: state.enemy.name });

  const fleeChance = state.enemy.kind === "精英" ? ELITE_FLEE_CHANCE : NORMAL_FLEE_CHANCE;
  if (!roll(fleeChance)) {
    resolveFleeFailure();
    return;
  }

  state.runStats.fleeSuccesses += 1;
  state.encounterIndex = Math.max(0, state.encounterIndex - 1);
  const result = weightedRandomItem(FLEE_RESULTS, (item) => item.weight);
  if (result.id === "counter") {
    resolveCounterEscape();
    return;
  }
  if (result.id === "evacuation") {
    resolveEvacuationEscape();
    return;
  }
  resolveSafeEscape();
}

function resolveFleeFailure() {
  state.runStats.fleeFailures += 1;
  addLog("system", "fleeFail", { enemy: state.enemy.name });
  const log = createCombatLogger();
  const enemyAction = resolveEnemyAction({
    hero: state.hero,
    enemy: state.enemy,
    turn: Math.max(1, state.turn),
    log
  });
  if (state.hero.hp <= 0) {
    state.deathCause = {
      type: "fleeFailure",
      label: `逃跑失敗後被${state.enemy.name}擊倒`
    };
    state.deathCause = state.deathCause || enemyAction;
    loseRun();
    return;
  }
  state.phase = "combat";
  render();
}

function resolveSafeEscape() {
  state.runStats.safeEscapes += 1;
  addLog("system", "safeEscape");
  enterSafeState({ canRest: true });
}

function resolveCounterEscape() {
  state.runStats.counterEscapes += 1;
  addLog("system", "counterEscape");
  state.phase = "danger";
  state.turn = 0;
  state.awaitingBlessing = false;
  state.canRest = false;
  state.hasRested = false;
  state.ambushAdvantage = true;
  state.log = [];
  state.enemy = buildEnemy(currentRegion(), state.encounterIndex, state.hero);
  state.enemy.poison = 0;
  state.hero.poison = 0;
  state.hero.shield = state.hero.shieldStart;
  const reducedHp = Math.max(1, Math.round(state.enemy.maxHp * 0.85));
  const reducedAmount = state.enemy.maxHp - reducedHp;
  state.enemy.hp = reducedHp;
  addLog("system", "counterEscape");
  addLog("system", "encounter", { enemy: state.enemy.name });
  addLog("hero-damage", "ambushAdvantage", { enemy: state.enemy.name, amount: reducedAmount });
  setCombatActionState();
  render();
}

function resolveEvacuationEscape() {
  state.runStats.evacuationEscapes += 1;
  state.runStats.retreated = true;
  addLog("system", "evacuationEscape");
  finishRun("retreat");
}

function continueAdventure() {
  if (state.phase !== "safe" || state.ended) {
    return;
  }
  startEncounter();
}

function restAtSafeRoute() {
  if (state.phase !== "safe" || !state.canRest || state.hasRested || state.ended) {
    return;
  }
  const amount = Math.max(1, Math.round(state.hero.maxHp * REST_HEAL_RATIO));
  const before = state.hero.hp;
  state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + amount);
  state.hasRested = true;
  state.canRest = false;
  addLog("heal", "rest", { amount: state.hero.hp - before });
  render();
}

function retreatRun() {
  if (state.phase !== "safe" || state.ended) {
    return;
  }
  state.runStats.retreated = true;
  addLog("system", "retreat");
  finishRun("retreat");
}

function getBlessingChoices(count) {
  const pool = [...currentRegion().blessings];
  const choices = [];
  while (choices.length < count && pool.length > 0) {
    const index = getWeightedBlessingIndex(pool);
    choices.push(pool.splice(index, 1)[0]);
  }
  return choices;
}

function getWeightedBlessingIndex(pool) {
  const totalWeight = pool.reduce((total, blessing) => total + getBlessingRarity(blessing.rarity).weight, 0);
  let roll = Math.random() * totalWeight;

  for (let index = 0; index < pool.length; index += 1) {
    roll -= getBlessingRarity(pool[index].rarity).weight;
    if (roll <= 0) {
      return index;
    }
  }

  return pool.length - 1;
}

function chooseBlessing(blessing) {
  applyBlessingEffects(state.hero, blessing);
  state.hero.blessings.push(blessing.name);
  addLog("system", "blessing", { blessing: blessing.name });
  enterSafeState({ canRest: false });
}

function closeEndPanel() {
  els.endPanel.classList.remove("is-visible");
}

function render() {
  const hero = state.hero;
  const enemy = state.enemy;
  const region = currentRegion();

  els.heroName.textContent = hero.name;
  els.heroLevel.textContent = `第 ${state.run} 輪｜Lv. ${hero.runLevel || 1}`;
  setMeter(els.heroHealthBar, hero.hp, hero.maxHp);
  els.heroHealthText.textContent = `${hero.hp} / ${hero.maxHp}`;

  els.enemyName.textContent = enemy ? enemy.name : state.phase === "safe" ? "安全路段" : "敵人";
  els.enemyKind.textContent = enemy ? enemy.kind : state.phase === "safe" ? "暫無遭遇" : "普通";
  setMeter(els.enemyHealthBar, enemy ? enemy.hp : 0, enemy ? enemy.maxHp : 1);
  els.enemyHealthText.textContent = enemy ? `${enemy.hp} / ${enemy.maxHp}` : "0 / 0";

  els.encounterLabel.textContent = `第 ${Math.min(state.encounterIndex + 1, region.encounterPlan.length)} / ${region.encounterPlan.length} 場`;
  if (!state.ended) {
    els.resultLabel.textContent = state.awaitingBlessing
      ? "選擇祝福"
      : state.phase === "safe"
        ? "安全路段"
        : state.turn === 0
        ? "遭遇開始"
        : `第 ${state.turn} 回合`;
  }

  setCombatActionState();
  renderCurrentStats(els.currentStats, hero);
}

function setCombatActionState() {
  const hasEnemy = Boolean(state.enemy);
  const isBoss = state.enemy?.kind === "首領";
  const inGame = state.hero && !state.ended && !state.awaitingBlessing;
  const safe = state.phase === "safe";
  const canFight = inGame && hasEnemy && !safe;
  const canFlee = canFight && !isBoss && state.hero.fleesRemaining > 0;
  const canContinue = inGame && safe;
  const canRest = canContinue && state.canRest && !state.hasRested && state.hero.hp < state.hero.maxHp;

  els.nextButton.disabled = !canFight;
  els.nextButton.textContent = state.turn === 0 ? "開始戰鬥" : "下一回合";
  els.fleeButton.disabled = !canFlee;
  els.continueButton.disabled = !canContinue;
  els.restButton.disabled = !canRest;
  els.retreatButton.disabled = !canContinue;
}

function renderLog() {
  renderBattleLog(els.battleLog, state.log);
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
  els.openRegionButton.addEventListener("click", () => showScreen("campScreen"));
  els.openCharacterButton.addEventListener("click", showCharacterList);
  els.openStatisticsButton.addEventListener("click", () => {
    uiState.statisticsView = "overview";
    showScreen("statisticsScreen");
  });
  els.openAchievementButton.addEventListener("click", () => showScreen("achievementScreen"));
  els.campStartButton.addEventListener("click", startRun);
  els.campRegionButton.addEventListener("click", showRegionList);
  els.campCharacterButton.addEventListener("click", showCharacterList);
  els.campRecordButton.addEventListener("click", () => {
    uiState.statisticsView = "overview";
    showScreen("statisticsScreen");
  });
  els.campBackButton.addEventListener("click", restart);
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
  els.retryButton.addEventListener("click", returnToCamp);
  els.viewLogButton.addEventListener("click", closeEndPanel);
  els.nextButton.addEventListener("click", playTurn);
  els.fleeButton.addEventListener("click", tryFlee);
  els.continueButton.addEventListener("click", continueAdventure);
  els.restButton.addEventListener("click", restAtSafeRoute);
  els.retreatButton.addEventListener("click", retreatRun);
  els.exportSaveButton.addEventListener("click", exportSave);
  els.importSaveButton.addEventListener("click", openImportSavePicker);
  els.importSaveInput.addEventListener("change", importSaveFromFile);
  els.deleteSaveButton.addEventListener("click", openDeleteSaveDialog);
  els.confirmDeleteSaveButton.addEventListener("click", deleteSave);
  els.cancelDeleteSaveButton.addEventListener("click", closeDeleteSaveDialog);
}

syncSelectionFromSave();
bindEvents();
