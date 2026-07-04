import { DEFAULT_CHARACTER_ID, DEFAULT_REGION_ID, GAME_VERSION } from "./src/config.js";
import { applyBlessingEffects } from "./src/core/blessings.js";
import { applyEndOfTurnEffects, buildEnemy, resolveEnemyAction, resolveHeroAction } from "./src/core/combat.js";
import {
  applyProgressionEffects,
  buildHeroFromProgression as buildHeroFromProgressionCore,
  createSkillState,
  getCharacterMaxLevel,
  getExpToNextLevel,
  getGrowthForLevel,
  getSkillsForLevel,
  normalizeCharacterProgress as normalizeCharacterProgressCore
} from "./src/core/progression.js";
import { applyRewardsToInventory, createEmptyRewards, formatInventorySummary, formatRewards, mergeRewards, normalizeInventory, rollEnemyRewards } from "./src/core/rewards.js";
import { createDefaultSave, deleteStoredSave, isImportableSave, loadSave, migrateSave, saveGame } from "./src/core/storage.js";
import { characterDefinitions } from "./src/data/characters/index.js";
import { materialDefinitions } from "./src/data/materials.js";
import { regionDefinitions } from "./src/data/regions/index.js";
import { getBlessingRarity } from "./src/data/rarities.js";
import { templates } from "./src/data/templates.js";
import { els } from "./src/ui/dom.js";
import { renderCharacterSkills } from "./src/ui/characterSkillsView.js";
import { renderBattleLog, renderBlessingChoices, renderChoiceList, renderCurrentStats, renderStatList, setMeter } from "./src/ui/renderHelpers.js";
import { copyText, createSaveTransferCode, parseSaveTransferCode } from "./src/ui/saveTools.js";
import { renderStatisticsView } from "./src/ui/statisticsView.js";
import { closeMaterialDetail, renderStorageView, showMaterialDetail } from "./src/ui/storageView.js";
import { roll, weightedRandomItem } from "./src/utils.js";

const RUN_STARTING_FLEES = 2;
const NORMAL_FLEE_CHANCE = 0.8;
const ELITE_FLEE_CHANCE = 0.55;
const FLEE_RESULTS = [
  { id: "safe", weight: 65 },
  { id: "counter", weight: 25 },
  { id: "evacuation", weight: 10 }
];
const REST_HEAL_RATIO = 0.15;
const PLAINS_TRIAL_ACHIEVEMENT_ID = "plains_trial";
const STORY_LINE_DELAY_MS = 1500;
const STORY_FINISH_EXTRA_DELAY_MS = 1700;
const PLAINS_STORY_LINES = [
  `魔化野豬王倒下後，牠身上的紋路化作無溫的<span class="story-mark-star">星光</span>。`,
  `平原的風停了，你在<span class="story-mark-star">星穹之外</span>看見<span class="story-mark-star">某個存在</span>睜開了眼。`,
  `你的思緒被那道<span class="story-mark-star">目光</span>壓碎，<span class="story-mark-death">死亡</span>隨之降臨。`,
  `<span class="story-mark-phoenix">灰燼般的微光</span>在黑暗中燃起。`,
  `<span class="story-mark-phoenix">鳳凰的加護</span>回應了死亡，將你帶回<span class="story-mark-phoenix">營地</span>。`
];
const NAVIGATION_CONTEXTS = Object.freeze({
  menu: { scene: null, returnTarget: "menuScreen" },
  camp: { scene: "camp", returnTarget: "campScreen" },
  adventure: { scene: "region", returnTarget: null },
  story: { scene: null, returnTarget: null }
});
const ROOT_SCREEN_CONTEXTS = Object.freeze({
  menuScreen: "menu",
  campScreen: "camp",
  gameScreen: "adventure"
});

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
  storyTimer: null,
  log: []
};

const uiState = {
  navigationContext: "menu",
  regionView: "list",
  characterView: "list",
  statisticsView: "overview",
  statisticsCharacterId: DEFAULT_CHARACTER_ID,
  statisticsRegionId: DEFAULT_REGION_ID,
  storageSortMode: "rarity",
  storageSortDirection: "desc"
};

let saveData = loadSave();
let pendingSaveCodeImport = null;

function getNavigationContext(contextId = uiState.navigationContext) {
  return NAVIGATION_CONTEXTS[contextId] || NAVIGATION_CONTEXTS.menu;
}

function setNavigationContext(contextId) {
  uiState.navigationContext = NAVIGATION_CONTEXTS[contextId] ? contextId : "menu";
}

function getNavigationReturnTarget() {
  return getNavigationContext().returnTarget || "menuScreen";
}

function showScreenInContext(screenId, contextId) {
  setNavigationContext(contextId);
  showScreen(screenId);
}

function syncRootScreenContext(screenId) {
  const contextId = ROOT_SCREEN_CONTEXTS[screenId];
  if (contextId) {
    setNavigationContext(contextId);
  }
}

function applySceneContext(screenId) {
  const context = getNavigationContext();
  const scene = screenId === "gameScreen"
    ? "region"
    : screenId === "campScreen"
      ? "camp"
      : screenId === "menuScreen"
        ? null
        : context.scene;

  if (scene) {
    document.body.dataset.scene = scene;
  } else {
    delete document.body.dataset.scene;
  }

  if (scene === "region") {
    document.body.dataset.region = state.selectedRegionId;
  } else {
    delete document.body.dataset.region;
  }
}

function showScreen(screenId) {
  closeMaterialDetail(els);
  syncRootScreenContext(screenId);
  applySceneContext(screenId);

  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.toggle("is-active", screen.id === screenId);
  });

  if (screenId === "menuScreen") {
    els.resultLabel.textContent = "冒險準備中";
    els.encounterLabel.textContent = "尚未開始";
    renderMenuScreen();
  }
  if (screenId === "campScreen") {
    els.resultLabel.textContent = "營地整備";
    els.encounterLabel.textContent = state.selectedRegion;
    renderCampScreen();
  }
  if (screenId === "storageScreen") {
    els.resultLabel.textContent = "倉庫";
    els.encounterLabel.textContent = "冒險營地";
    renderStorageScreen();
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
    els.resultLabel.textContent = saveData.storyFlags.achievementSystemUnlocked ? "成就紀錄" : "尚未開放";
    els.encounterLabel.textContent = "成就系統";
    renderAchievementScreen();
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

function showRegionList(contextId = uiState.navigationContext) {
  setNavigationContext(contextId);
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

function renderMenuScreen() {
  const achievementHint = els.openAchievementButton.querySelector("small");
  if (achievementHint) {
    achievementHint.textContent = saveData.storyFlags.achievementSystemUnlocked ? "查看已解鎖成就" : "尚未開放";
  }
}

function renderCampScreen() {
  const region = currentRegion();
  const character = characterDefinitions[state.selectedHeroId];
  const progress = normalizeCharacterProgress(state.selectedHeroId);
  const expToNext = getExpToNextLevel(progress.level, character);
  const lastResult = state.lastRunSummary
    ? `${state.lastRunSummary.result}，抵達第 ${state.lastRunSummary.reachedEncounter} / ${region.encounterPlan.length} 場`
    : "尚無紀錄";
  const inventorySummary = formatInventorySummary(saveData.inventory, materialDefinitions);
  const campStats = [
    ["目前角色", character.name],
    ["角色等級", `Lv. ${progress.level}`],
    ["經驗", `${progress.exp} / ${expToNext}`],
    ["目前地區", region.name],
    ["地區難度", region.difficulty],
    ["最近冒險", lastResult]
  ];
  if (hasPhoenixBlessing()) {
    campStats.splice(3, 0, ["目前金幣", inventorySummary.gold]);
  }
  renderStatList(els.campStatusList, campStats);
  els.campStorageButton.hidden = !hasPhoenixBlessing();
  if (els.campWarning) {
    els.campWarning.textContent = hasPhoenixBlessing()
      ? "鳳凰的加護已覺醒。死亡會結束本輪冒險，但角色等級與經驗會保留。"
      : "警告：死亡會失去目前等級與經驗；撤退能保留成長。";
    els.campWarning.dataset.type = hasPhoenixBlessing() ? "blessed" : "danger";
  }
}

function renderRegionScreen() {
  els.regionListView.classList.toggle("is-active", uiState.regionView === "list");
  els.regionDetailView.classList.toggle("is-active", uiState.regionView === "detail");
  setReturnButton(els.regionListView.querySelector(".back-button"), getNavigationReturnTarget());

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

function showCharacterList(contextId = uiState.navigationContext) {
  setNavigationContext(contextId);
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
  setReturnButton(els.characterListView.querySelector(".back-button"), getNavigationReturnTarget());

  renderChoiceList(els.characterChoiceList, Object.entries(characterDefinitions).map(([characterId, character]) => ({
    title: character.name,
    meta: characterId === saveData.settings.selectedCharacterId ? "目前選擇" : "可使用",
    description: character.description,
    action: "查看角色",
    onClick: () => showCharacterDetail(characterId)
  })));

  if (uiState.characterView === "detail") {
    const character = characterDefinitions[state.selectedHeroId];
    const preview = buildHeroFromProgression(state.selectedHeroId);
    const progress = getCharacterProgress(state.selectedHeroId);
    els.characterDetailName.textContent = character.name;
    els.characterDetailDescription.textContent = character.description;
    renderStatList(els.characterDetailStats, [
      ["等級", `Lv. ${progress.level}`],
      ["經驗", `${progress.exp} / ${getExpToNextLevel(progress.level, character)}`],
      ["最大生命", preview.maxHp],
      ["攻擊", preview.attack],
      ["防禦", preview.defense],
      ["暴擊", `${Math.round(preview.critChance * 100)}%`]
    ]);
    renderCharacterSkills({
      learnedListElement: els.characterSkillList,
      nextSkillElement: els.characterNextSkillPanel,
      character,
      progress,
      onSkillClick: showSkillInfo
    });
    els.selectCharacterButton.textContent = `使用${character.name}`;
  }
}

function renderStorageScreen() {
  const inventory = normalizeInventory(saveData.inventory);
  setReturnButton(els.storageBackButton, getNavigationReturnTarget());
  renderStorageView({
    els,
    inventory,
    materialDefinitions,
    sortMode: uiState.storageSortMode,
    sortDirection: uiState.storageSortDirection,
    onSortChange: (sortMode) => {
      uiState.storageSortMode = sortMode;
      renderStorageScreen();
    },
    onDirectionChange: (sortDirection) => {
      uiState.storageSortDirection = sortDirection;
      renderStorageScreen();
    },
    onMaterialClick: (item) => showMaterialDetail(els, item)
  });
}

function createRunStats() {
  return {
    expGained: 0,
    startLevel: 1,
    endLevel: 1,
    levelUps: [],
    learnedSkills: [],
    progressReset: false,
    lostLevel: 1,
    lostExp: 0,
    fleeAttempts: 0,
    fleeSuccesses: 0,
    fleeFailures: 0,
    safeEscapes: 0,
    counterEscapes: 0,
    evacuationEscapes: 0,
    retreated: false,
    rewards: createEmptyRewards()
  };
}

function getCharacterProgress(characterId = state.selectedHeroId) {
  return saveData.progression.characters[characterId];
}

function getCharacterDefinition(characterId = state.selectedHeroId) {
  return characterDefinitions[characterId];
}

function normalizeCharacterProgress(characterId = state.selectedHeroId) {
  const character = getCharacterDefinition(characterId);
  const progress = getCharacterProgress(characterId);
  return normalizeCharacterProgressCore(progress, character);
}

function buildHeroFromProgression(characterId = state.selectedHeroId) {
  const character = getCharacterDefinition(characterId);
  const progress = normalizeCharacterProgress(characterId);
  return buildHeroFromProgressionCore(character, progress);
}

function gainCharacterExp(amount) {
  if (!state.hero || amount <= 0) {
    return;
  }

  const character = getCharacterDefinition();
  const progress = getCharacterProgress();
  progress.exp += amount;
  state.runStats.expGained += amount;
  addLog("system", "expGain", { amount });
  applyCharacterLevelUps(character, progress);
  syncHeroProgressState(character, progress);
  saveGameSafe();
}

function applyCharacterLevelUps(character, progress) {
  while (progress.level < getCharacterMaxLevel(character)) {
    const expToNext = getExpToNextLevel(progress.level, character);
    if (expToNext === "MAX" || progress.exp < expToNext) {
      break;
    }
    progress.exp -= expToNext;
    progress.level += 1;
    state.runStats.endLevel = progress.level;
    state.runStats.levelUps.push(progress.level);
    const growth = getGrowthForLevel(character, progress.level);
    applyProgressionEffects(state.hero, growth?.effects || [], { recover: true });
    addLog("system", "levelUp", {
      level: progress.level,
      name: growth?.name || "能力提升"
    });

    const knownSkills = new Set(progress.learnedSkills);
    getSkillsForLevel(character, progress.level).forEach((skill) => {
      if (!knownSkills.has(skill.id)) {
        progress.learnedSkills.push(skill.id);
        state.runStats.learnedSkills.push(skill.name);
        state.hero.skills.push(skill.id);
        applyProgressionEffects(state.hero, skill.effects || [], { recover: true });
        addLog("system", "skillLearned", { name: skill.name });
      }
    });
  }
}

function syncHeroProgressState(character = getCharacterDefinition(), progress = getCharacterProgress()) {
  state.hero.level = progress.level;
  state.hero.exp = progress.exp;
  state.hero.expToNext = getExpToNextLevel(progress.level, character);
  state.hero.skills = [...progress.learnedSkills];
  if (state.runStats) {
    state.runStats.endLevel = progress.level;
  }
}

function hasPhoenixBlessing() {
  return Boolean(saveData.storyFlags.phoenixBlessingUnlocked);
}

function resetCharacterProgress(characterId = state.selectedHeroId) {
  const progress = getCharacterProgress(characterId);
  progress.level = 1;
  progress.exp = 0;
  progress.learnedSkills = [];
}

function hasHeroSkill(skillId) {
  return Array.isArray(state.hero?.skills) && state.hero.skills.includes(skillId);
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
  stats.highestRunLevel = Math.max(stats.highestRunLevel, state.runStats?.endLevel || 1);
  characterStats.highestRunLevel = Math.max(characterStats.highestRunLevel, state.runStats?.endLevel || 1);
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
  setReturnButton(els.statisticsScreen.querySelector(".back-button"), getNavigationReturnTarget());
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

function renderAchievementScreen() {
  if (!els.achievementTitle || !els.achievementText || !els.achievementList) {
    return;
  }
  setReturnButton(els.achievementScreen.querySelector(".back-button"), getNavigationReturnTarget());
  const unlocked = saveData.storyFlags.achievementSystemUnlocked;
  els.achievementTitle.textContent = unlocked ? "已解鎖成就" : "尚未開放";
  els.achievementText.textContent = unlocked
    ? "這裡記錄你在傳說大陸留下的節點。"
    : "這裡之後會記錄冒險進度、擊敗首領、角色解鎖與特殊挑戰。";
  els.achievementList.innerHTML = "";
  if (!unlocked) {
    return;
  }
  const achievement = saveData.achievements[PLAINS_TRIAL_ACHIEVEMENT_ID];
  const item = document.createElement("div");
  item.className = "achievement-card";
  item.innerHTML = `
    <strong>平原的試煉</strong>
    <span>擊敗平原首領</span>
    <p>你跨過了第一片野外的終點，並在死亡邊緣觸及了新的命運。</p>
    <small>${achievement?.unlockedAt ? `解鎖於 ${new Date(achievement.unlockedAt).toLocaleString("zh-TW")}` : "已解鎖"}</small>
  `;
  els.achievementList.append(item);
}

function showStatisticsScreen(contextId = uiState.navigationContext) {
  setNavigationContext(contextId);
  uiState.statisticsView = "overview";
  showScreen("statisticsScreen");
}

function showStatisticsView(view) {
  uiState.statisticsView = view;
  renderStatistics();
}

function setReturnButton(button, target) {
  if (!button) {
    return;
  }
  button.dataset.target = target;
  button.textContent = target === "campScreen" ? "回營地" : "回主選單";
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

function openExportSaveCodeDialog() {
  const exportData = migrateSave(saveData);
  exportData.profile.exportedAt = new Date().toISOString();
  els.exportSaveCodeText.value = createSaveTransferCode(exportData, GAME_VERSION);
  setSaveCodeNotice(els.exportSaveCodeNotice, "存檔碼已產生。");
  els.exportSaveCodePanel.classList.add("is-visible");
  els.exportSaveCodeText.focus();
  els.exportSaveCodeText.select();
}

function closeExportSaveCodeDialog() {
  els.exportSaveCodePanel.classList.remove("is-visible");
}

async function copySaveCode() {
  try {
    await copyText(els.exportSaveCodeText.value);
    setSaveCodeNotice(els.exportSaveCodeNotice, "已複製存檔碼。");
  } catch {
    els.exportSaveCodeText.focus();
    els.exportSaveCodeText.select();
    setSaveCodeNotice(els.exportSaveCodeNotice, "無法自動複製，請手動選取文字碼。", "error");
  }
}

function openImportSaveCodeDialog() {
  pendingSaveCodeImport = null;
  els.importSaveCodeText.value = "";
  els.confirmImportSaveCodeButton.hidden = true;
  setSaveCodeNotice(els.importSaveCodeNotice, "貼上存檔碼後先檢查內容。");
  els.importSaveCodePanel.classList.add("is-visible");
  els.importSaveCodeText.focus();
}

function closeImportSaveCodeDialog() {
  pendingSaveCodeImport = null;
  els.importSaveCodePanel.classList.remove("is-visible");
}

function checkImportSaveCode() {
  pendingSaveCodeImport = null;
  els.confirmImportSaveCodeButton.hidden = true;
  try {
    const payload = parseSaveTransferCode(els.importSaveCodeText.value);
    if (!isImportableSave(payload.save)) {
      throw new Error("Invalid save payload");
    }
    const migrated = migrateSave(payload.save);
    pendingSaveCodeImport = migrated;
    els.confirmImportSaveCodeButton.hidden = false;
    setSaveCodeNotice(
      els.importSaveCodeNotice,
      `存檔碼可匯入。來源版本：${payload.gameVersion || "未知"}。確認後會覆蓋目前存檔。`
    );
  } catch {
    setSaveCodeNotice(els.importSaveCodeNotice, "存檔碼無法匯入，請確認是否完整複製。", "error");
  }
}

function confirmImportSaveCode() {
  if (!pendingSaveCodeImport) {
    setSaveCodeNotice(els.importSaveCodeNotice, "請先檢查存檔碼。", "error");
    return;
  }

  saveData = migrateSave(pendingSaveCodeImport, { persist: true });
  pendingSaveCodeImport = null;
  syncSelectionFromSave();
  renderStatistics();
  closeImportSaveCodeDialog();
  setSaveNotice("存檔碼已匯入並轉換為目前版本。");
  els.resultLabel.textContent = "存檔已匯入";
  els.encounterLabel.textContent = "統計數據";
}

function setSaveCodeNotice(element, message, type = "status") {
  element.textContent = message;
  element.dataset.type = type;
}

function openDeleteSaveDialog() {
  els.deleteSavePanel.classList.add("is-visible");
}

function closeDeleteSaveDialog() {
  els.deleteSavePanel.classList.remove("is-visible");
}

function showSkillInfo(skill, context) {
  const type = context?.type || { label: "技能" };
  const remaining = context?.levelsRemaining || 0;
  const status = context?.learned
    ? "已學會"
    : `Lv. ${skill.level} 解鎖，還差 ${remaining} 等`;

  els.skillInfoStatus.textContent = status;
  els.skillInfoTitle.textContent = skill.name;
  els.skillInfoMeta.textContent = `Lv. ${skill.level} ${type.label}`;
  els.skillInfoDescription.textContent = skill.description || "尚未記錄技能說明。";
  els.skillInfoPanel.classList.add("is-visible");
}

function closeSkillPanel() {
  els.skillInfoPanel.classList.remove("is-visible");
}

function closeMaterialInfoPanel() {
  closeMaterialDetail(els);
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
  state.hero = buildHeroFromProgression(state.selectedHeroId);
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
  state.runStats.startLevel = state.hero.level;
  state.runStats.endLevel = state.hero.level;

  showScreen("gameScreen");
  els.blessingPanel.classList.remove("is-visible");
  els.endPanel.classList.remove("is-visible");
  closeSkillPanel();
  closeExportSaveCodeDialog();
  closeImportSaveCodeDialog();
  closeStoryPanel();
  closeDeleteSaveDialog();
  els.nextButton.disabled = false;

  recordRunStarted();
  startEncounter();
}

function restart() {
  showScreen("menuScreen");
  els.blessingPanel.classList.remove("is-visible");
  els.endPanel.classList.remove("is-visible");
  closeSkillPanel();
  closeExportSaveCodeDialog();
  closeImportSaveCodeDialog();
  closeStoryPanel();
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
  closeSkillPanel();
  closeExportSaveCodeDialog();
  closeImportSaveCodeDialog();
  closeStoryPanel();
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
  state.hero.skillState = createSkillState();

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
  applyEmergencyBandage();
  if (state.hero.hp <= 0) {
    state.deathCause = enemyAction;
    if (!tryLastStand()) {
      loseRun();
      return;
    }
  }

  const endOfTurn = applyEndOfTurnEffects({ hero: state.hero, enemy: state.enemy, turn: state.turn, log });
  if (state.hero.hp <= 0) {
    state.deathCause = endOfTurn.heroDeathCause || {
      type: "other",
      label: "回合結束效果"
    };
    if (!tryLastStand()) {
      loseRun();
      return;
    }
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
  gainCharacterExp(getEnemyExpReward(state.enemy));
  awardEnemyRewards(state.enemy);
  recordEnemyDefeated(defeatedBoss);
  state.defeatedEnemies += 1;
  state.defeatedBoss = state.defeatedBoss || defeatedBoss;

  if (state.hero.killHeal > 0) {
    state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + state.hero.killHeal);
    addLog("heal", "heal", { target: state.hero.name, amount: state.hero.killHeal });
  }
  applyVictorySkills();

  state.encounterIndex += 1;
  render();

  if (state.encounterIndex >= currentRegion().encounterPlan.length) {
    addLog("system", "clear");
    if (shouldTriggerPlainsStory()) {
      showPlainsStory();
      return;
    }
    finishRun("clear");
    return;
  }

  showBlessings();
}

function awardEnemyRewards(enemy) {
  if (!hasPhoenixBlessing()) {
    return;
  }
  const rewards = rollEnemyRewards(enemy);
  state.runStats.rewards = mergeRewards(state.runStats.rewards, rewards);
  applyRewardsToInventory(saveData.inventory, rewards);
  saveGameSafe();
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

function applyEmergencyBandage() {
  if (!hasHeroSkill("emergency-bandage") || state.hero.skillState.emergencyBandageUsed || state.hero.hp <= 0) {
    return;
  }
  if (state.hero.hp > state.hero.maxHp * 0.4) {
    return;
  }
  const amount = Math.max(1, Math.round(state.hero.maxHp * 0.18));
  state.hero.skillState.emergencyBandageUsed = true;
  state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + amount);
  addLog("heal", "emergencyBandage", { actor: state.hero.name, amount });
}

function tryLastStand() {
  if (!hasHeroSkill("last-stand") || state.hero.skillState.lastStandUsed) {
    return false;
  }
  state.hero.skillState.lastStandUsed = true;
  const amount = Math.max(1, Math.round(state.hero.maxHp * 0.15));
  state.hero.hp = Math.min(state.hero.maxHp, 1 + amount);
  addLog("heal", "lastStand", { actor: state.hero.name, amount });
  cleanseOneNegativeEffect();
  return state.hero.hp > 0;
}

function cleanseOneNegativeEffect() {
  if (state.hero.poison > 0) {
    state.hero.poison = 0;
    addLog("status", "cleanse", { actor: state.hero.name, effect: "中毒" });
  }
}

function applyVictorySkills() {
  if (!hasHeroSkill("adventurer-pace")) {
    return;
  }
  const amount = Math.max(1, Math.round(state.hero.maxHp * 0.1));
  state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + amount);
  addLog("heal", "adventurerPace", { amount });
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

function handleDefeatProgression() {
  const progress = getCharacterProgress();
  state.runStats.endLevel = progress.level;
  if (hasPhoenixBlessing()) {
    return;
  }
  state.runStats.progressReset = true;
  state.runStats.lostLevel = progress.level;
  state.runStats.lostExp = progress.exp;
  resetCharacterProgress();
  addLog("system", "progressLost");
  saveGameSafe();
}

function finishRun(outcome) {
  const region = currentRegion();
  const cleared = outcome === "clear";
  const retreated = outcome === "retreat";
  const defeated = outcome === "defeat";
  state.ended = true;
  state.awaitingBlessing = false;
  state.phase = "ended";
  if (defeated) {
    handleDefeatProgression();
  }
  recordRunFinished(outcome);
  els.nextButton.disabled = true;
  els.blessingPanel.classList.remove("is-visible");
  els.endPanel.classList.add("is-visible");
  els.endTitle.textContent = cleared ? "冒險成功" : retreated ? "冒險撤退" : "冒險失敗";
  els.endText.textContent = getEndText(outcome, region);
  els.endText.classList.toggle("danger-text", defeated && !hasPhoenixBlessing());
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
    return "你回到營地。本輪的臨時祝福會重置，角色等級與經驗會保留。";
  }
  if (hasPhoenixBlessing()) {
    return "你倒下了。鳳凰的加護在灰燼般的微光中甦醒，將你帶回營地。";
  }

  return "你倒在野外，這段旅途累積的等級與經驗已經失去。";
}

function renderEndSummary(outcome, region) {
  const cleared = outcome === "clear";
  const retreated = outcome === "retreat";
  const reachedEncounter = getReachedEncounter(cleared, region);
  const blessings = state.hero.blessings.length > 0 ? state.hero.blessings.join("、") : "無";
  const progress = getCharacterProgress();
  state.lastRunSummary = {
    result: cleared ? "成功" : retreated ? "撤退" : "失敗",
    reachedEncounter,
    runLevel: state.runStats?.endLevel || progress.level
  };
  const items = [
    ["結果", cleared ? "冒險成功" : retreated ? "冒險撤退" : "冒險失敗"],
    ["抵達", `第 ${reachedEncounter} / ${region.encounterPlan.length} 場`],
    ["角色等級", `Lv. ${progress.level}`],
    ["本輪經驗", `${state.runStats?.expGained || 0}`],
    ["擊敗敵人", `${state.defeatedEnemies} 隻`],
    ["擊敗首領", state.defeatedBoss ? "是" : "否"],
    ["逃跑", `成功 ${state.runStats?.fleeSuccesses || 0} / 失敗 ${state.runStats?.fleeFailures || 0}`],
    ["選擇祝福", blessings]
  ];
  if (hasPhoenixBlessing()) {
    const rewards = formatRewards(state.runStats?.rewards, materialDefinitions);
    if (rewards.gold > 0) {
      items.push(["本輪金幣", rewards.gold]);
    }
    items.push(["本輪素材", rewards.materials]);
  }

  if (state.runStats?.levelUps.length > 0) {
    items.push(["升級", state.runStats.levelUps.map((level) => `Lv. ${level}`).join("、")]);
  }
  if (state.runStats?.learnedSkills.length > 0) {
    items.push(["新技能", state.runStats.learnedSkills.join("、")]);
  }
  if (state.runStats?.progressReset) {
    items.push(["成長損失", `死亡使等級與經驗失去，已回到 Lv. 1。`]);
  }

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
  applyEmergencyBandage();
  if (state.hero.hp <= 0) {
    state.deathCause = {
      type: "fleeFailure",
      label: `逃跑失敗後被${state.enemy.name}擊倒`
    };
    state.deathCause = state.deathCause || enemyAction;
    if (!tryLastStand()) {
      loseRun();
      return;
    }
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

function closeStoryPanel() {
  if (state.storyTimer) {
    window.clearTimeout(state.storyTimer);
    state.storyTimer = null;
  }
  els.storyPanel.classList.remove("is-visible");
}

function shouldTriggerPlainsStory() {
  return state.selectedRegionId === "plains" && !saveData.storyFlags.plainsBossStorySeen;
}

function showPlainsStory() {
  setNavigationContext("story");
  state.ended = true;
  state.awaitingBlessing = false;
  state.phase = "story";
  recordRunFinished("clear");
  els.nextButton.disabled = true;
  els.blessingPanel.classList.remove("is-visible");
  els.endPanel.classList.remove("is-visible");
  els.storyPanel.classList.add("is-visible");
  els.resultLabel.textContent = "命運覺醒";
  els.encounterLabel.textContent = "星穹之外";
  renderStoryText(false);
  setCombatActionState();
  render();
}

function renderStoryText(revealed) {
  if (state.storyTimer) {
    window.clearTimeout(state.storyTimer);
    state.storyTimer = null;
  }
  els.storyText.innerHTML = "";
  PLAINS_STORY_LINES.forEach((line, index) => {
    const paragraph = document.createElement("p");
    paragraph.innerHTML = line;
    paragraph.style.animationDelay = revealed ? "0ms" : `${index * STORY_LINE_DELAY_MS}ms`;
    if (revealed) {
      paragraph.classList.add("is-revealed");
    }
    els.storyText.append(paragraph);
  });
  els.revealStoryButton.hidden = revealed;
  els.finishStoryButton.hidden = !revealed;
  if (!revealed) {
    state.storyTimer = window.setTimeout(() => {
      els.revealStoryButton.hidden = true;
      els.finishStoryButton.hidden = false;
    }, (PLAINS_STORY_LINES.length - 1) * STORY_LINE_DELAY_MS + STORY_FINISH_EXTRA_DELAY_MS);
  }
}

function revealStoryText() {
  renderStoryText(true);
}

function completePlainsStory() {
  unlockPhoenixBlessing();
  els.storyPanel.classList.remove("is-visible");
  returnToCamp();
}

function unlockPhoenixBlessing() {
  const now = new Date().toISOString();
  saveData.storyFlags.phoenixBlessingUnlocked = true;
  saveData.storyFlags.plainsBossStorySeen = true;
  saveData.storyFlags.achievementSystemUnlocked = true;
  saveData.achievements[PLAINS_TRIAL_ACHIEVEMENT_ID] = {
    unlocked: true,
    unlockedAt: saveData.achievements[PLAINS_TRIAL_ACHIEVEMENT_ID]?.unlockedAt || now
  };
  saveGameSafe();
}

function render() {
  const hero = state.hero;
  const enemy = state.enemy;
  const region = currentRegion();

  els.heroName.textContent = hero.name;
  els.heroLevel.textContent = `第 ${state.run} 輪｜角色 Lv. ${hero.level || 1}`;
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
  els.nextButton.hidden = !canFight;
  els.nextButton.textContent = state.turn === 0 ? "戰鬥" : "繼續戰鬥";
  els.fleeButton.disabled = !canFlee;
  els.fleeButton.hidden = !canFight;
  els.fleeButton.textContent = isBoss
    ? "首領無法逃跑"
    : `逃跑（剩餘 ${state.hero?.fleesRemaining ?? 0} / ${RUN_STARTING_FLEES}）`;
  els.continueButton.hidden = !canContinue;
  els.continueButton.disabled = !canContinue;
  els.restButton.hidden = !canContinue;
  els.restButton.disabled = !canRest;
  els.restButton.textContent = state.canRest && !state.hasRested ? "原地修整" : "已修整";
  els.retreatButton.hidden = !canContinue;
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
  els.openRegionButton.addEventListener("click", () => showScreenInContext("campScreen", "camp"));
  els.openCharacterButton.addEventListener("click", () => showCharacterList("menu"));
  els.openStatisticsButton.addEventListener("click", () => showStatisticsScreen("menu"));
  els.openAchievementButton.addEventListener("click", () => showScreenInContext("achievementScreen", "menu"));
  els.campStartButton.addEventListener("click", startRun);
  els.campRegionButton.addEventListener("click", () => showRegionList("camp"));
  els.campCharacterButton.addEventListener("click", () => showCharacterList("camp"));
  els.campRecordButton.addEventListener("click", () => showStatisticsScreen("camp"));
  els.campStorageButton.addEventListener("click", () => showScreenInContext("storageScreen", "camp"));
  els.campBackButton.addEventListener("click", restart);
  els.storageBackButton.addEventListener("click", () => showScreen(getNavigationReturnTarget()));
  els.backToRegionListButton.addEventListener("click", () => showRegionList());
  els.backToCharacterListButton.addEventListener("click", () => showCharacterList());
  els.statisticsTabs.forEach((button) => {
    button.addEventListener("click", () => showStatisticsView(button.dataset.statisticsView));
  });
  els.backToStatisticsCharacterListButton.addEventListener("click", () => showStatisticsView("characters"));
  els.backToStatisticsRegionListButton.addEventListener("click", () => showStatisticsView("regions"));
  els.selectCharacterButton.addEventListener("click", () => {
    saveData.settings.selectedCharacterId = state.selectedHeroId;
    saveGameSafe();
    syncSelectionFromSave();
    showScreen(getNavigationReturnTarget());
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
  els.revealStoryButton.addEventListener("click", revealStoryText);
  els.finishStoryButton.addEventListener("click", completePlainsStory);
  els.nextButton.addEventListener("click", playTurn);
  els.fleeButton.addEventListener("click", tryFlee);
  els.continueButton.addEventListener("click", continueAdventure);
  els.restButton.addEventListener("click", restAtSafeRoute);
  els.retreatButton.addEventListener("click", retreatRun);
  els.exportSaveCodeButton.addEventListener("click", openExportSaveCodeDialog);
  els.importSaveCodeButton.addEventListener("click", openImportSaveCodeDialog);
  els.copySaveCodeButton.addEventListener("click", copySaveCode);
  els.closeExportSaveCodeButton.addEventListener("click", closeExportSaveCodeDialog);
  els.checkSaveCodeButton.addEventListener("click", checkImportSaveCode);
  els.confirmImportSaveCodeButton.addEventListener("click", confirmImportSaveCode);
  els.closeImportSaveCodeButton.addEventListener("click", closeImportSaveCodeDialog);
  els.deleteSaveButton.addEventListener("click", openDeleteSaveDialog);
  els.confirmDeleteSaveButton.addEventListener("click", deleteSave);
  els.cancelDeleteSaveButton.addEventListener("click", closeDeleteSaveDialog);
  els.closeSkillInfoButton.addEventListener("click", closeSkillPanel);
  els.closeMaterialInfoButton.addEventListener("click", closeMaterialInfoPanel);
  els.skillInfoPanel.addEventListener("click", (event) => {
    if (event.target === els.skillInfoPanel) {
      closeSkillPanel();
    }
  });
  els.materialInfoPanel.addEventListener("click", (event) => {
    if (event.target === els.materialInfoPanel) {
      closeMaterialInfoPanel();
    }
  });
  els.exportSaveCodePanel.addEventListener("click", (event) => {
    if (event.target === els.exportSaveCodePanel) {
      closeExportSaveCodeDialog();
    }
  });
  els.importSaveCodePanel.addEventListener("click", (event) => {
    if (event.target === els.importSaveCodePanel) {
      closeImportSaveCodeDialog();
    }
  });
}

syncSelectionFromSave();
bindEvents();
