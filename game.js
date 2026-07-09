import { DEFAULT_CHARACTER_ID, DEFAULT_REGION_ID, GAME_VERSION } from "./src/config.js";
import { createEventRuntime } from "./src/adventure/eventRuntime.js";
import { createMusicManager } from "./src/audio/musicManager.js";
import { applyBlessingEffects } from "./src/core/blessings.js";
import {
  applyEnemyEndOfTurnNegativeEffects,
  applyEnemyEndOfTurnRecoveryEffects,
  applyHeroEndOfTurnNegativeEffects,
  applyHeroEndOfTurnRecoveryEffects,
  buildEnemy,
  buildScaledEnemy,
  resolveEnemyAction,
  resolveHeroAction,
  resolveHeroEntangle
} from "./src/core/combat.js";
import {
  createRuntimeEnemyGroup,
  getEnemyDisplayName,
  getEnemyGroupLabel,
  getEnemyGroupThreatKind,
  getLivingEnemies,
  resolveTargetEnemy,
  resolveTargetEnemyId,
  restoreRuntimeEnemyGroup
} from "./src/core/enemyGroups.js";
import { scheduleRegionEvent, shouldTriggerScheduledEvent } from "./src/core/events.js";
import { applyEnemyDefeatReactions } from "./src/core/enemyReactions.js";
import { canFleeBattle, getBattleFleeChance } from "./src/core/fleeRules.js";
import { canCompleteRouteEncounter } from "./src/core/routeRules.js";
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
import { achievementDefinitions } from "./src/data/achievements.js";
import { getAllIndependentBlessings, getBlessingPool } from "./src/data/blessings/index.js";
import { getBlessingFlowDefinitions } from "./src/data/blessingFlows.js";
import { materialDefinitions } from "./src/data/materials.js";
import { musicDefinitions } from "./src/data/music.js";
import { getEnemyDefinition } from "./src/data/enemies/index.js";
import { getEventDefinition } from "./src/data/events/index.js";
import { regionDefinitions } from "./src/data/regions/index.js";
import { getRouteDefinition, getRouteGroup } from "./src/data/routes/index.js";
import { getBlessingRarity } from "./src/data/rarities.js";
import { templates } from "./src/data/templates.js";
import { els } from "./src/ui/dom.js";
import { renderCharacterSkills } from "./src/ui/characterSkillsView.js";
import { renderCharacterCards } from "./src/ui/characterSelectView.js";
import { initDebugPanel } from "./src/ui/debugPanel.js";
import { renderBlessingInfoView } from "./src/ui/blessingInfoView.js";
import { renderCombatView, renderCurrentAbilityView } from "./src/ui/combatView.js";
import { hideEventTransition, renderRouteEndingView, showCombatLayout } from "./src/ui/eventView.js";
import { renderBattleLog, renderBlessingChoices, renderChoiceList, renderStatList } from "./src/ui/renderHelpers.js";
import { copyText, createSaveTransferCode, parseSaveTransferCode } from "./src/ui/saveTools.js";
import { renderStatisticsView } from "./src/ui/statisticsView.js";
import { closeMaterialDetail, renderStorageView, showMaterialDetail } from "./src/ui/storageView.js";
import { createDebugRuntimeActions } from "./src/debug/runtimeActions.js";
import {
  getCharacterCombatStatusEntries,
  initializeCharacterBattleState,
  modifyCharacterIncomingDirectDamage,
  resolveCharacterPlayerAction
} from "./src/characters/skills/index.js";
import { clone, randomItem, roll, weightedRandomItem } from "./src/utils.js";

const RUN_STARTING_FLEES = 2;
const NORMAL_FLEE_CHANCE = 0.8;
const ELITE_FLEE_CHANCE = 0.55;
const SAFE_ESCAPE_ENEMY_HEAL_RATIO = 0.05;
const COUNTER_ESCAPE_ENEMY_HEAL_RATIO = 0.05;
const COUNTER_ESCAPE_HEAL_RATIO = 0.1;
const COUNTER_ESCAPE_SCALING_OFFSET = 3;
const TACTICAL_FLEE_RESULTS = [
  { id: "safe", weight: 75 },
  { id: "counter", weight: 25 }
];
const LAST_BAG_FLOW_WEIGHT_MULTIPLIER = 0.6;
const REST_HEAL_RATIO = 0.15;
const PLAINS_TRIAL_ACHIEVEMENT_ID = "plains_trial";
const FOREST_TRIAL_ACHIEVEMENT_ID = "forest_trial";
const GOBLIN_CAMP_CLEAR_ACHIEVEMENT_ID = "goblin_camp_clear";
const STORY_LINE_DELAY_MS = 1500;
const STORY_FINISH_EXTRA_DELAY_MS = 1700;
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
  activeRouteId: null,
  routeEncounterIndex: 0,
  encounterIndex: 0,
  turn: 0,
  hero: null,
  enemies: [],
  targetEnemyId: null,
  selectedBoss: null,
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
  pendingThreat: null,
  blessingContext: "normal",
  blessingPoolOverrideId: null,
  battleSource: "main",
  battleEncounterType: null,
  eventSchedule: null,
  eventContext: null,
  runEventRecords: [],
  eventInputLocked: false,
  adventureProgressLocked: false,
  eventTransitionToken: 0,
  debugBuildRun: false,
  storyTimer: null,
  routeEndingContext: null,
  runResultRecorded: false,
  log: []
};

const uiState = {
  navigationContext: "menu",
  regionView: "list",
  characterView: "list",
  characterDetailId: DEFAULT_CHARACTER_ID,
  statisticsView: "overview",
  statisticsCharacterId: DEFAULT_CHARACTER_ID,
  statisticsRegionId: DEFAULT_REGION_ID,
  storageSortMode: "rarity",
  storageSortDirection: "desc"
};

let saveData = loadSave();
let pendingSaveCodeImport = null;
const musicManager = createMusicManager({ trackDefinitions: musicDefinitions });
let eventRuntime = null;

function isDebugModeEnabled() {
  return new URLSearchParams(window.location.search).get("debug") === "1";
}

function getNavigationContext(contextId = uiState.navigationContext) {
  return NAVIGATION_CONTEXTS[contextId] || NAVIGATION_CONTEXTS.menu;
}

function setNavigationContext(contextId) {
  uiState.navigationContext = NAVIGATION_CONTEXTS[contextId] ? contextId : "menu";
}

function getNavigationReturnTarget() {
  return getNavigationContext().returnTarget || "menuScreen";
}

function currentRoute() {
  return state.activeRouteId ? getRouteDefinition(state.activeRouteId) : null;
}

function currentAdventureSource() {
  return currentRoute() || currentRegion();
}

function getAdventureEncounterIndex() {
  return currentRoute() ? state.routeEncounterIndex : state.encounterIndex;
}

function getAdventureEncounterPlan() {
  return currentAdventureSource()?.encounterPlan || [];
}

function getAdventureEncounterEntry() {
  return getAdventureEncounterPlan()[getAdventureEncounterIndex()] || null;
}

function getAdventureEncounterType() {
  const entry = getAdventureEncounterEntry();
  return typeof entry === "string" ? entry : entry?.type || null;
}

function getAdventureEncounterCount() {
  return getAdventureEncounterPlan().length;
}

function getAdventureSourceName() {
  return currentAdventureSource()?.name || currentRegion()?.name || "冒險";
}

function getAdventureBlessingDefinitions(poolOverrideId = null) {
  const poolId = poolOverrideId || state.blessingPoolOverrideId || currentRoute()?.blessingPoolId;
  if (poolId) {
    return getBlessingPool(poolId)?.blessings || [];
  }
  return currentRegion()?.blessings || [];
}

function getRouteBossDefinition(route = currentRoute()) {
  const finalEncounter = route?.encounterPlan?.at(-1);
  const group = getRouteGroup(route, finalEncounter?.groupId);
  const bossMember = group?.members?.find((member) => getEnemyDefinition(member.enemyId)?.kind === "首領");
  return bossMember ? getEnemyDefinition(bossMember.enemyId) : null;
}

function resetRouteRuntime() {
  state.activeRouteId = null;
  state.routeEncounterIndex = 0;
  state.routeEndingContext = null;
  state.blessingPoolOverrideId = null;
  delete document.body.dataset.route;
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

function resolveSceneMusicTrackId(screenId) {
  if (uiState.navigationContext === "story") {
    return undefined;
  }
  if (screenId === "gameScreen" || uiState.navigationContext === "adventure") {
    return currentAdventureSource()?.audio?.bgmId ?? null;
  }
  if (uiState.navigationContext === "camp") {
    return "camp";
  }
  if (uiState.navigationContext === "menu") {
    return "menu";
  }
  return null;
}

function syncSceneMusic(screenId) {
  const trackId = resolveSceneMusicTrackId(screenId);
  if (trackId === undefined) {
    return;
  }
  void musicManager.requestTrack(trackId);
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
    if (state.activeRouteId) {
      document.body.dataset.route = state.activeRouteId;
    } else {
      delete document.body.dataset.route;
    }
    applyRegionBackgroundStage();
  } else {
    delete document.body.dataset.region;
    delete document.body.dataset.route;
    delete document.body.dataset.regionDepth;
    document.body.style.removeProperty("--region-bg-mobile");
    document.body.style.removeProperty("--region-bg-desktop");
  }

  syncSceneMusic(screenId);
}

function applyRegionBackgroundStage() {
  const source = currentAdventureSource();
  const stage = getAdventureBackgroundStage(source, getAdventureEncounterIndex());

  if (stage?.id) {
    document.body.dataset.regionDepth = stage.id;
  } else {
    delete document.body.dataset.regionDepth;
  }

  const mobile = stage?.mobile || stage?.desktop || source?.visual?.background?.mobile || source?.visual?.background?.desktop || "";
  const desktop = stage?.desktop || stage?.mobile || source?.visual?.background?.desktop || source?.visual?.background?.mobile || "";
  if (mobile) {
    document.body.style.setProperty("--region-bg-mobile", `url("${resolveAssetUrl(mobile)}")`);
  } else {
    document.body.style.removeProperty("--region-bg-mobile");
  }
  if (desktop) {
    document.body.style.setProperty("--region-bg-desktop", `url("${resolveAssetUrl(desktop)}")`);
  } else {
    document.body.style.removeProperty("--region-bg-desktop");
  }
}

function resolveAssetUrl(path) {
  try {
    return new URL(path, document.baseURI).href;
  } catch {
    return path;
  }
}

function getAdventureBackgroundStage(source, encounterIndex) {
  const encounterCount = source?.encounterCount || source?.encounterPlan?.length || 1;
  const encounterNumber = Math.max(1, Math.min(encounterCount, encounterIndex + 1));
  const stages = source?.visual?.backgroundStages;
  if (!Array.isArray(stages) || stages.length === 0) {
    return source?.visual?.background || null;
  }
  return stages.find((stage) => (
    encounterNumber >= (stage.fromEncounter || 1)
    && encounterNumber <= (stage.toEncounter || encounterCount || encounterNumber)
  )) || source?.visual?.background || null;
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
  const requestedCharacterId = saveData.settings.selectedCharacterId;
  const characterId = isCharacterUnlocked(requestedCharacterId) ? requestedCharacterId : DEFAULT_CHARACTER_ID;
  saveData.settings.selectedCharacterId = characterId;
  state.selectedRegionId = regionId;
  state.selectedHeroId = characterId;
  state.selectedRegion = regionDefinitions[regionId].name;
  state.selectedHero = characterDefinitions[characterId].name;
}

function isCharacterUnlocked(characterId) {
  return Boolean(
    characterDefinitions[characterId]
    && saveData.progression.characters[characterId]?.unlocked === true
  );
}

function syncMusicSettingsFromSave() {
  const volume = musicManager.setVolume(saveData.settings.musicVolume);
  void musicManager.setEnabled(saveData.settings.musicEnabled);
  renderMusicControls(saveData.settings.musicEnabled, volume);
}

function renderMusicControls(enabled = saveData.settings.musicEnabled, volume = saveData.settings.musicVolume) {
  els.musicToggleButton.textContent = enabled ? "BGM：開" : "BGM：關";
  els.musicToggleButton.setAttribute("aria-pressed", String(enabled));
  els.musicVolumeInput.value = String(volume);
  els.musicVolumeValue.textContent = `${Math.round(volume * 100)}%`;
}

function toggleMusicEnabled() {
  saveData.settings.musicEnabled = !saveData.settings.musicEnabled;
  void musicManager.setEnabled(saveData.settings.musicEnabled);
  renderMusicControls();
  saveGameSafe();
}

function previewMusicVolume() {
  const volume = musicManager.setVolume(Number(els.musicVolumeInput.value));
  saveData.settings.musicVolume = volume;
  els.musicVolumeValue.textContent = `${Math.round(volume * 100)}%`;
}

function commitMusicVolume() {
  previewMusicVolume();
  renderMusicControls();
  saveGameSafe();
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
    ? `${state.lastRunSummary.result}｜${state.lastRunSummary.sourceName} 第 ${state.lastRunSummary.reachedEncounter} / ${state.lastRunSummary.encounterTotal} 場`
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
    meta: region.recommendedLevel ? `${region.difficulty}｜${region.recommendedLevel}` : region.difficulty,
    description: `${region.encounterCount} 場遭遇，首領：${region.bossName}`,
    action: "查看地區",
    onClick: () => showRegionDetail(regionId)
  })));

  if (uiState.regionView === "detail") {
    const region = currentRegion();
    els.regionDetailName.textContent = region.name;
    els.regionDetailDescription.textContent = region.note
      ? `${region.description}\n${region.note}`
      : region.description;
    renderStatList(els.regionDetailStats, [
      ["遭遇數", region.encounterCount],
      ["首領", region.bossName],
      ["難度", region.difficulty],
      ["推薦等級", region.recommendedLevel || "Lv.1+"],
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
  if (!isCharacterUnlocked(characterId)) {
    showLockedCharacterHint();
    return;
  }
  uiState.characterDetailId = characterId;
  uiState.characterView = "detail";
  showScreen("characterScreen");
}

function showLockedCharacterHint() {
  els.characterLockedPanel.classList.add("is-visible");
}

function closeLockedCharacterHint() {
  els.characterLockedPanel.classList.remove("is-visible");
}

function selectCharacterFromDetail() {
  const characterId = uiState.characterDetailId;
  if (!isCharacterUnlocked(characterId)) {
    showLockedCharacterHint();
    return;
  }
  saveData.settings.selectedCharacterId = characterId;
  saveGameSafe();
  syncSelectionFromSave();
  renderCharacterScreen();
}

function renderCharacterScreen() {
  els.characterListView.classList.toggle("is-active", uiState.characterView === "list");
  els.characterDetailView.classList.toggle("is-active", uiState.characterView === "detail");
  setReturnButton(els.characterListView.querySelector(".back-button"), getNavigationReturnTarget());

  renderCharacterCards({
    element: els.characterChoiceList,
    characterDefinitions,
    characterProgression: saveData.progression.characters,
    selectedCharacterId: saveData.settings.selectedCharacterId,
    onCharacterClick: showCharacterDetail,
    onLockedCharacterClick: showLockedCharacterHint
  });

  if (uiState.characterView === "detail") {
    const characterId = isCharacterUnlocked(uiState.characterDetailId)
      ? uiState.characterDetailId
      : saveData.settings.selectedCharacterId;
    uiState.characterDetailId = characterId;
    const character = characterDefinitions[characterId];
    const preview = buildHeroFromProgression(characterId);
    const progress = getCharacterProgress(characterId);
    const selected = characterId === saveData.settings.selectedCharacterId;
    els.characterDetailName.textContent = character.name;
    els.characterDetailRole.textContent = character.role || "";
    els.characterDetailRole.hidden = !character.role;
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
    els.selectCharacterButton.textContent = selected ? "目前使用中" : `使用${character.name}`;
    els.selectCharacterButton.disabled = selected;
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
    unlockedCharacters: [],
    progressReset: false,
    lostLevel: 1,
    lostExp: 0,
    fleeAttempts: 0,
    fleeSuccesses: 0,
    fleeFailures: 0,
    safeEscapes: 0,
    counterEscapes: 0,
    evacuationEscapes: 0,
    evacuated: false,
    retreated: false,
    bossId: null,
    bossName: null,
    rewards: createEmptyRewards()
  };
}

function initializeRunRuntime({ hero, encounterIndex = 0, debugBuildRun = false, bossId = null } = {}) {
  if (!hero) {
    throw new Error("Run runtime 初始化需要 Hero。");
  }

  resetRouteRuntime();
  state.debugBuildRun = Boolean(debugBuildRun);
  state.run += 1;
  state.encounterIndex = encounterIndex;
  state.turn = 0;
  state.hero = hero;
  state.hero.fleesRemaining = RUN_STARTING_FLEES;
  clearEnemyGroup();
  state.selectedBoss = selectRunBoss(currentRegion(), bossId);
  state.phase = "danger";
  state.awaitingBlessing = false;
  state.ended = false;
  state.defeatedEnemies = encounterIndex;
  state.defeatedBoss = false;
  state.deathCause = null;
  state.runStats = createRunStats();
  state.runResultRecorded = false;
  state.canRest = false;
  state.hasRested = false;
  state.ambushAdvantage = false;
  state.battleSource = "main";
  state.battleEncounterType = null;
  clearPendingThreat();
  state.blessingContext = "normal";
  state.blessingPoolOverrideId = null;
  eventRuntime.resetEventRunState();
  state.log = [];
  state.runStats.startLevel = state.hero.level;
  state.runStats.endLevel = state.hero.level;
  recordSelectedBossInRunStats();
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

  if (state.debugBuildRun) {
    state.runStats.expGained += amount;
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
  if (state.debugBuildRun) {
    return;
  }
  saveData.statistics.totalEnemiesDefeated += 1;
  if (isBoss) {
    saveData.statistics.bossesDefeated += 1;
  }
  saveGameSafe();
}

function recordRunFinished(outcome) {
  if (state.debugBuildRun || state.runResultRecorded) {
    return;
  }
  const stats = saveData.statistics;
  const regionStats = stats.regions[state.selectedRegionId];
  const characterStats = stats.characters[state.selectedHeroId];
  const regionProgress = saveData.progression.regions[state.selectedRegionId];
  const characterProgress = saveData.progression.characters[state.selectedHeroId];
  const cleared = outcome === "clear";
  const retreated = outcome === "retreat";
  const evacuated = retreated && Boolean(state.runStats?.evacuated);
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
    if (state.selectedRegionId === "forest" && regionStats.routeClears) {
      const routeKey = currentRoute()?.clearSourceId === "goblinCamp" ? "goblinCamp" : "main";
      regionStats.routeClears[routeKey] = (regionStats.routeClears[routeKey] || 0) + 1;
    }
  } else if (retreated && !evacuated) {
    stats.totalRetreats += 1;
    regionStats.retreats += 1;
    characterStats.retreats += 1;
  } else {
    stats.totalDefeats += 1;
  }

  state.runResultRecorded = true;
  saveGameSafe();
}

function unlockAchievement(achievementId) {
  if (!achievementDefinitions[achievementId]) {
    return false;
  }
  const achievement = saveData.achievements[achievementId] || {
    unlocked: false,
    unlockedAt: null
  };
  if (!achievement.unlocked) {
    achievement.unlocked = true;
    achievement.unlockedAt = new Date().toISOString();
  }
  saveData.achievements[achievementId] = achievement;
  return true;
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
  Object.values(achievementDefinitions).forEach((definition) => {
    const achievement = saveData.achievements[definition.id] || {};
    if (definition.hiddenUntilUnlocked && !achievement.unlocked) {
      return;
    }
    const item = document.createElement("div");
    item.className = "achievement-card";
    item.classList.toggle("is-locked", !achievement.unlocked);

    const title = document.createElement("strong");
    const condition = document.createElement("span");
    const description = document.createElement("p");
    const meta = document.createElement("small");
    title.textContent = definition.title;
    condition.textContent = definition.conditionText;
    description.textContent = achievement.unlocked ? definition.description : "尚未解鎖。";
    meta.textContent = achievement.unlocked
      ? achievement.unlockedAt
        ? `解鎖於 ${new Date(achievement.unlockedAt).toLocaleString("zh-TW")}`
        : "已解鎖"
      : "未解鎖";
    item.append(title, condition, description, meta);
    els.achievementList.append(item);
  });
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
  resetAdventureRuntimeAfterSaveImport();
  syncSelectionFromSave();
  syncMusicSettingsFromSave();
  renderStatistics();
  closeImportSaveCodeDialog();
  setSaveNotice("存檔碼已匯入並轉換為目前版本。");
  els.resultLabel.textContent = "存檔已匯入";
  els.encounterLabel.textContent = "統計數據";
}

function resetAdventureRuntimeAfterSaveImport() {
  state.debugBuildRun = false;
  state.hero = null;
  state.selectedBoss = null;
  state.runStats = null;
  state.lastRunSummary = null;
  state.awaitingBlessing = false;
  state.ended = true;
  state.phase = "camp";
  state.battleSource = "main";
  state.battleEncounterType = null;
  state.blessingContext = "normal";
  state.runResultRecorded = false;
  clearEnemyGroup();
  clearPendingThreat();
  eventRuntime.resetEventRunState();
  resetRouteRuntime();
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
  syncMusicSettingsFromSave();
  closeDeleteSaveDialog();
  renderStatistics();
  setSaveNotice("存檔已刪除，新的空白存檔已建立。");
  els.resultLabel.textContent = "存檔已刪除";
  els.encounterLabel.textContent = "統計數據";
}

function getRegionBosses(region) {
  return Array.isArray(region.bosses) && region.bosses.length > 0 ? region.bosses : [region.boss].filter(Boolean);
}

function selectRunBoss(region, bossId = null) {
  const bosses = getRegionBosses(region);
  const selected = bossId ? bosses.find((boss) => boss.id === bossId) : null;
  const boss = selected || weightedRandomItem(bosses, (candidate) => Number(candidate.weight) || 100);
  return clone(boss);
}

function recordSelectedBossInRunStats() {
  if (!state.runStats || !state.selectedBoss) {
    return;
  }
  state.runStats.bossId = state.selectedBoss.id;
  state.runStats.bossName = state.selectedBoss.name;
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

function clearEnemyGroup() {
  state.enemies = [];
  state.targetEnemyId = null;
}

function setEnemyGroup(entries, options = {}) {
  const { restore = false } = options;
  state.enemies = restore
    ? restoreRuntimeEnemyGroup(entries)
    : createRuntimeEnemyGroup(entries);
  state.targetEnemyId = resolveTargetEnemyId(state.enemies, null);
}

function currentTargetEnemy() {
  const target = resolveTargetEnemy(state.enemies, state.targetEnemyId);
  state.targetEnemyId = target?.runtimeId || null;
  return target;
}

function selectEnemyTarget(runtimeId) {
  const target = getLivingEnemies(state.enemies).find((enemy) => enemy.runtimeId === runtimeId);
  if (!target || state.ended || state.awaitingBlessing || state.phase === "safe") {
    return;
  }
  state.targetEnemyId = target.runtimeId;
  render();
}

function logCurrentEnemyGroupEncounter() {
  getLivingEnemies(state.enemies).forEach((enemy) => {
    addLog("system", "encounter", { enemy: getEnemyDisplayName(enemy) });
    if (enemy.intro) {
      addFixedLog("status", enemy.intro);
    }
  });
}

function clearPendingThreat() {
  state.pendingThreat = null;
}

function savePendingThreat(source) {
  const livingEnemies = getLivingEnemies(state.enemies);
  if (livingEnemies.length === 0) {
    clearPendingThreat();
    return;
  }
  state.pendingThreat = {
    enemies: clone(livingEnemies),
    encounterIndex: state.encounterIndex,
    routeEncounterIndex: state.routeEncounterIndex,
    activeRouteId: state.activeRouteId,
    battleEncounterType: state.battleEncounterType,
    turn: state.turn,
    source,
    battleSource: state.battleSource
  };
}

function hasPendingThreat(source = null) {
  return Boolean(state.pendingThreat && (!source || state.pendingThreat.source === source));
}

function resetHeroBattleState() {
  state.hero.poison = 0;
  state.hero.entangle = null;
  state.hero.battleAttackBonus = 0;
  state.hero.battleCritBonus = 0;
  state.hero.hasAttackedThisBattle = false;
  state.hero.statusFamiliarityLimitBonus = 0;
  state.hero.victoryHealBonusRatio = 0;
  state.hero.shield = state.hero.shieldStart;
  state.hero.skillState = createSkillState();
  initializeCharacterBattleState(state.hero);
}

function healThreatEnemies(enemies, ratio) {
  return enemies.map((enemy) => {
    if (ratio <= 0 || enemy.hp <= 0) {
      return { enemy, healed: 0 };
    }
    const amount = Math.max(1, Math.round(enemy.maxHp * ratio));
    const before = enemy.hp;
    enemy.hp = Math.min(enemy.maxHp, enemy.hp + amount);
    return { enemy, healed: enemy.hp - before };
  });
}

function resumePendingThreat(options = {}) {
  if (!Array.isArray(state.pendingThreat?.enemies) || state.pendingThreat.enemies.length === 0) {
    return false;
  }

  const { healRatio = 0, introText = "" } = options;
  const threat = state.pendingThreat;
  const restoredEnemies = restoreRuntimeEnemyGroup(threat.enemies);
  const healedEnemies = healThreatEnemies(restoredEnemies, healRatio);

  setEnemyGroup(restoredEnemies, { restore: true });
  state.activeRouteId = threat.activeRouteId || null;
  state.routeEncounterIndex = Math.max(0, Number(threat.routeEncounterIndex) || 0);
  state.battleSource = threat.battleSource || "main";
  state.battleEncounterType = threat.battleEncounterType || getAdventureEncounterType();
  state.encounterIndex = threat.encounterIndex;
  state.turn = 0;
  state.awaitingBlessing = false;
  state.phase = "danger";
  state.canRest = false;
  state.hasRested = false;
  state.ambushAdvantage = false;
  state.log = [];
  resetHeroBattleState();
  clearPendingThreat();
  applyBattleStartSkills();

  if (introText) {
    addFixedLog("system", introText);
  }
  logCurrentEnemyGroupEncounter();
  healedEnemies.forEach(({ enemy, healed }) => {
    if (healed > 0) {
      addLog("heal", "enemyRecover", { enemy: getEnemyDisplayName(enemy), amount: healed });
    }
  });
  if (state.hero.shield > 0) {
    addLog("status", "shield", { target: state.hero.name, amount: state.hero.shield });
  }
  render();
  return true;
}

function buildCounterEnemy(region, encounterIndex) {
  const route = currentRoute();
  if (route) {
    const candidates = (route.counterEnemyIds || []).map(getEnemyDefinition).filter(Boolean);
    const base = weightedRandomItem(candidates, () => 100);
    const scalingIndex = Math.max(0, encounterIndex - COUNTER_ESCAPE_SCALING_OFFSET);
    return buildScaledEnemy(base, region, scalingIndex);
  }
  const base = weightedRandomItem(region.enemies, (enemy) => Number(enemy.weight) || 100);
  const scalingIndex = Math.max(0, encounterIndex - COUNTER_ESCAPE_SCALING_OFFSET);
  return buildScaledEnemy(base, region, scalingIndex);
}

function enterAdventureRoute(routeId) {
  const route = getRouteDefinition(routeId);
  if (!route || route.regionId !== state.selectedRegionId) {
    throw new Error(`無法進入 Route：${routeId || "(empty)"}`);
  }
  state.activeRouteId = route.id;
  state.routeEncounterIndex = 0;
  state.eventSchedule = scheduleRegionEvent(route);
  state.eventContext = null;
  state.eventInputLocked = false;
  state.adventureProgressLocked = false;
  state.blessingPoolOverrideId = null;
  const routeBoss = getRouteBossDefinition(route);
  state.selectedBoss = routeBoss ? clone(routeBoss) : null;
  recordSelectedBossInRunStats();
  showCombatLayout(els);
  applySceneContext("gameScreen");
  startEncounter();
}

function startRun() {
  syncSelectionFromSave();
  initializeRunRuntime({ hero: buildHeroFromProgression(state.selectedHeroId) });
  state.eventSchedule = scheduleRegionEvent(currentAdventureSource(), Math.random, {
    scheduleChance: getAdventureEventScheduleChance()
  });

  showScreen("gameScreen");
  closeTransientUiPanels();
  els.nextButton.disabled = false;

  recordRunStarted();
  startEncounter();
}

function getAdventureEventScheduleChance() {
  if (state.selectedRegionId === "forest" && !saveData.storyFlags.archerRescued) {
    return 0.5;
  }
  return undefined;
}

function restart() {
  state.debugBuildRun = false;
  syncSelectionFromSave();
  showScreen("menuScreen");
  closeTransientUiPanels();
  els.nextButton.disabled = true;
  setCombatActionState();
  state.awaitingBlessing = false;
  state.ended = true;
  state.phase = "camp";
  state.selectedBoss = null;
  clearPendingThreat();
  state.blessingContext = "normal";
  state.battleEncounterType = null;
  eventRuntime.resetEventRunState();
  resetRouteRuntime();
  els.resultLabel.textContent = "冒險準備中";
  els.encounterLabel.textContent = "尚未開始";
  els.battleLogTitle.textContent = "戰鬥紀錄";
}

function returnToCamp() {
  state.debugBuildRun = false;
  syncSelectionFromSave();
  showScreen("campScreen");
  closeTransientUiPanels();
  state.awaitingBlessing = false;
  state.ended = true;
  state.phase = "camp";
  state.selectedBoss = null;
  clearPendingThreat();
  state.blessingContext = "normal";
  state.battleEncounterType = null;
  eventRuntime.resetEventRunState();
  resetRouteRuntime();
  setCombatActionState();
}

function startEncounter() {
  const region = currentRegion();
  const route = currentRoute();
  const encounterEntry = getAdventureEncounterEntry();
  const encounterType = getAdventureEncounterType();
  state.adventureProgressLocked = false;
  state.eventInputLocked = false;
  state.battleSource = "main";
  state.battleEncounterType = encounterType;
  showCombatLayout(els);
  applySceneContext("gameScreen");
  state.turn = 0;
  state.awaitingBlessing = false;
  state.phase = "danger";
  state.canRest = false;
  state.hasRested = false;
  state.ambushAdvantage = false;
  state.log = [];

  if (route) {
    const group = getRouteGroup(route, encounterEntry?.groupId);
    if (!group) {
      throw new Error(`找不到 Route enemy group：${encounterEntry?.groupId || "(empty)"}`);
    }
    const entries = group.members.map((member) => {
      const enemyDefinition = getEnemyDefinition(member.enemyId);
      const enemy = buildScaledEnemy(enemyDefinition, region, state.encounterIndex);
      enemy.poison = 0;
      return {
        enemy,
        statScale: member.statScale,
        rewardScale: member.rewardScale
      };
    });
    setEnemyGroup(createRuntimeEnemyGroup(entries), { restore: true });
  } else {
    const enemy = buildEnemy(region, state.encounterIndex, state.hero, { boss: state.selectedBoss });
    enemy.poison = 0;
    setEnemyGroup([enemy]);
  }

  resetHeroBattleState();
  applyBattleStartSkills();

  els.blessingPanel.classList.remove("is-visible");
  setCombatActionState();

  if (encounterType === "boss") {
    addLog("system", "boss", { region: getAdventureSourceName() });
  }
  logCurrentEnemyGroupEncounter();
  applyEnemyAmbushes();
  if (state.hero.shield > 0) {
    addLog("status", "shield", { target: state.hero.name, amount: state.hero.shield });
  }
  render();
}

function playTurn() {
  if (state.ended || state.awaitingBlessing || getLivingEnemies(state.enemies).length === 0 || state.phase === "safe") {
    return;
  }

  const log = createCombatLogger();
  state.phase = "combat";
  state.turn += 1;
  const heroEntangled = resolveHeroEntangle({ hero: state.hero, log });
  if (!heroEntangled) {
    const target = currentTargetEnemy();
    if (!target) {
      return;
    }
    const characterAction = resolveCharacterPlayerAction({
      hero: state.hero,
      enemies: state.enemies,
      targetEnemyId: state.targetEnemyId,
      log
    });
    if (!characterAction.handled) {
      resolveHeroAction({ hero: state.hero, enemy: target, log });
    }
    settleDefeatedEnemies();
    if (getLivingEnemies(state.enemies).length === 0) {
      winEncounter();
      return;
    }
  }

  const actingEnemies = [...getLivingEnemies(state.enemies)];
  for (const enemy of actingEnemies) {
    if (enemy.hp <= 0 || state.ended) {
      continue;
    }
    const enemyAction = resolveEnemyAction({
      hero: state.hero,
      enemy,
      turn: state.turn,
      log,
      modifyDirectDamage: modifyCharacterIncomingDirectDamage
    });
    applyEmergencyBandage();
    if (state.hero.hp <= 0) {
      state.deathCause = enemyAction;
      if (!tryLastStand()) {
        loseRun();
        return;
      }
    }
  }

  const endOfTurn = applyHeroEndOfTurnNegativeEffects({ hero: state.hero, log });
  getLivingEnemies(state.enemies).forEach((enemy) => {
    applyEnemyEndOfTurnNegativeEffects({ enemy, log });
  });
  applyHeroEndOfTurnRecoveryEffects({ hero: state.hero, turn: state.turn, log });
  state.enemies.forEach((enemy) => {
    applyEnemyEndOfTurnRecoveryEffects({ enemy, turn: state.turn, log });
  });

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

  settleDefeatedEnemies();
  if (getLivingEnemies(state.enemies).length === 0) {
    winEncounter();
    return;
  }

  render();
}

function winEncounter() {
  settleBattleVictory();

  if (hasPendingThreat("counterEscape")) {
    finishCounterEncounterVictory();
    return;
  }

  if (state.battleSource === "event") {
    eventRuntime.finishEventBattleVictory();
    return;
  }

  state.encounterIndex += 1;
  if (currentRoute()) {
    state.routeEncounterIndex += 1;
  }
  render();

  if (getAdventureEncounterIndex() >= getAdventureEncounterCount()) {
    addLog("system", "clear", { region: getAdventureSourceName() });
    if (currentRoute()?.id === "goblin-camp") {
      completeGoblinCampRoute();
      return;
    }
    if (shouldTriggerPlainsStory()) {
      showPlainsStory();
      return;
    }
    unlockAdventureClearAchievements();
    finishRun("clear");
    return;
  }

  showBlessings();
}

function settleDefeatedEnemies() {
  const defeatedEnemies = state.enemies.filter((enemy) => enemy && enemy.hp <= 0);
  defeatedEnemies.forEach(settleEnemyDefeated);
  if (defeatedEnemies.length === 0) {
    return 0;
  }

  state.enemies = getLivingEnemies(state.enemies);
  state.targetEnemyId = resolveTargetEnemyId(state.enemies, state.targetEnemyId);
  return defeatedEnemies.length;
}

function settleEnemyDefeated(enemy) {
  const enemyName = getEnemyDisplayName(enemy);
  const defeatedBoss = enemy.kind === "首領";
  const hpRatioBeforeKillRewards = state.hero.maxHp > 0 ? state.hero.hp / state.hero.maxHp : 0;
  addLog("system", "enemyDefeated", { target: enemyName });
  gainCharacterExp(getEnemyExpReward(enemy));
  awardEnemyRewards(enemy);
  recordEnemyDefeated(defeatedBoss);
  state.defeatedEnemies += 1;
  state.defeatedBoss = state.defeatedBoss || defeatedBoss;

  applyLivingEnemyDefeatReactions(enemy);

  if (state.hero.killAttackGain > 0) {
    state.hero.battleAttackBonus = (state.hero.battleAttackBonus || 0) + state.hero.killAttackGain;
    addFixedLog("status", `${state.hero.name}趁著混亂，本場攻擊提高 ${state.hero.killAttackGain}。`);
  }
  if (hpRatioBeforeKillRewards < 0.5 && state.hero.lowHpKillHeal > 0) {
    healHeroFromEnemyDefeat(state.hero.lowHpKillHeal);
  }
  if (state.hero.killHeal > 0) {
    healHeroFromEnemyDefeat(state.hero.killHeal);
  }
  if (state.hero.killHealRatio > 0) {
    healHeroFromEnemyDefeat(Math.max(1, Math.round(state.hero.maxHp * state.hero.killHealRatio)));
  }
}

function healHeroFromEnemyDefeat(amount) {
  const before = state.hero.hp;
  state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + Math.max(0, Number(amount) || 0));
  const healed = state.hero.hp - before;
  if (healed > 0) {
    addLog("heal", "heal", { target: state.hero.name, amount: healed });
  }
}

function applyLivingEnemyDefeatReactions(defeatedEnemy) {
  const reactions = applyEnemyDefeatReactions({
    enemies: state.enemies,
    defeatedEnemy
  });
  reactions.forEach((reaction) => {
    if (reaction.type !== "bloodSacrifice") {
      return;
    }
    addFixedLog(
      "status",
      `${getEnemyDisplayName(reaction.source)}以${getEnemyDisplayName(reaction.defeatedEnemy)}的死亡完成血祭，氣息變得更加兇狠。`
    );
    if (reaction.healed > 0) {
      addLog("heal", "enemyRecover", {
        enemy: getEnemyDisplayName(reaction.source),
        amount: reaction.healed
      });
    }
  });
}

function settleBattleVictory() {
  addLog("system", "battleVictory");
  applyVictorySkills();
  consumeBattleLimitedEffects();
}

function finishCounterEncounterVictory() {
  const amount = Math.max(1, Math.round(state.hero.maxHp * COUNTER_ESCAPE_HEAL_RATIO));
  const before = state.hero.hp;
  state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + amount);
  const healed = state.hero.hp - before;
  if (healed > 0) {
    addFixedLog("heal", `你從反制戰中穩住呼吸，恢復了 ${healed} 點生命。`);
  }
  render();
  showBlessings("counterEscape");
}

function awardEnemyRewards(enemy) {
  if (state.debugBuildRun || !hasPhoenixBlessing()) {
    return;
  }
  const rewards = rollEnemyRewards(enemy);
  state.runStats.rewards = mergeRewards(state.runStats.rewards, rewards);
  applyRewardsToInventory(saveData.inventory, rewards);
  saveGameSafe();
}

function getEnemyExpReward(enemy) {
  const baseReward = Number.isFinite(enemy.expReward)
    ? enemy.expReward
    : enemy.kind === "首領"
      ? 48
      : enemy.kind === "精英"
        ? 26
        : 9;
  const rewardScale = Number.isFinite(enemy.rewardScale) && enemy.rewardScale >= 0
    ? enemy.rewardScale
    : 1;
  return Math.max(1, Math.round(baseReward * rewardScale));
}

function applyBattleStartSkills() {
  if (hasHeroSkill("status-familiarity") && !hasBlessingFlow("debuff")) {
    state.hero.battleAttackBonus = (state.hero.battleAttackBonus || 0) + 1;
    addFixedLog("skill", `${state.hero.name} 沒有可判讀的負面狀態，改以經驗調整攻勢，攻擊提升。`);
  }

  if (!hasHeroSkill("versatile-satchel")) {
    return;
  }

  const satchelFlow = getVersatileSatchelFlow();
  const satchelEffectId = satchelFlow?.satchelEffectId || "battle_attack";
  const satchelEffect = VERSATILE_SATCHEL_EFFECT_HANDLERS[satchelEffectId]
    || VERSATILE_SATCHEL_EFFECT_HANDLERS.battle_attack;
  const bonus = satchelEffect(state.hero);
  if (satchelFlow?.id) {
    state.hero.lastBagFlow = satchelFlow.id;
  }
  addLog("skill", "versatileSatchel", { actor: state.hero.name, bonus });
}

const VERSATILE_SATCHEL_EFFECT_HANDLERS = Object.freeze({
  battle_attack(hero) {
    hero.battleAttackBonus = (hero.battleAttackBonus || 0) + 1;
    return "攻擊 +1";
  },
  battle_shield(hero) {
    const amount = 6;
    hero.shield = (hero.shield || 0) + amount;
    return `護盾 +${amount}`;
  },
  battle_crit(hero) {
    hero.battleCritBonus = (hero.battleCritBonus || 0) + 0.03;
    return "暴擊率 +3%";
  },
  status_familiarity(hero) {
    hero.statusFamiliarityLimitBonus = (hero.statusFamiliarityLimitBonus || 0) + 1;
    return "狀態判讀上限 +1";
  },
  victory_heal(hero) {
    hero.victoryHealBonusRatio = (hero.victoryHealBonusRatio || 0) + 0.03;
    return "勝利恢復 +3%";
  }
});

function getVersatileSatchelFlow() {
  const momentum = state.hero?.blessingFlowMomentum || {};
  const candidates = getBlessingFlowDefinitions()
    .map((flow) => {
      const baseWeight = Math.max(0, Number(momentum[flow.id]) || 0);
      const weight = flow.id === state.hero?.lastBagFlow
        ? baseWeight * LAST_BAG_FLOW_WEIGHT_MULTIPLIER
        : baseWeight;
      return { ...flow, weight };
    })
    .filter((flow) => flow.weight > 0);

  return candidates.length > 0
    ? weightedRandomItem(candidates, (flow) => flow.weight)
    : null;
}

function hasBlessingFlow(flow) {
  return Array.isArray(state.hero?.blessingFlows) && state.hero.blessingFlows.includes(flow);
}

function applyEnemyAmbushes() {
  getLivingEnemies(state.enemies).forEach((enemy) => {
    const amount = Number(enemy.ambushDamage) || 0;
    if (amount <= 0 || state.hero.hp <= 1) {
      return;
    }
    const damage = Math.min(amount, state.hero.hp - 1);
    state.hero.hp -= damage;
    addFixedLog("enemy-damage", `${getEnemyDisplayName(enemy)} 伏擊了你，造成 ${damage} 點傷害。`);
  });
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
    return;
  }
  if (state.hero.entangle) {
    state.hero.entangle = null;
    addLog("status", "cleanse", { actor: state.hero.name, effect: "纏繞" });
  }
}

function applyVictorySkills() {
  if (!hasHeroSkill("adventurer-pace")) {
    return;
  }
  const baseRatio = hasHeroSkill("expedition-pace") ? 0.15 : 0.1;
  const amount = Math.max(1, Math.round(state.hero.maxHp * (baseRatio + (state.hero.victoryHealBonusRatio || 0))));
  state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + amount);
  addLog("heal", "adventurerPace", { amount });
}

function consumeBattleLimitedEffects() {
  if (!Array.isArray(state.hero?.timedRegens)) {
    return;
  }
  state.hero.timedRegens = state.hero.timedRegens
    .map((effect) => ({
      ...effect,
      remainingEncounters: Math.max(0, (effect.remainingEncounters || 0) - 1)
    }))
    .filter((effect) => effect.remainingEncounters > 0);
}

function enterSafeState(options = {}) {
  const { canRest = false } = options;
  state.phase = "safe";
  state.awaitingBlessing = false;
  clearEnemyGroup();
  state.canRest = canRest;
  state.hasRested = false;
  els.blessingPanel.classList.remove("is-visible");
  addLog("system", "safeState");
  render();
}

function loseRun() {
  addLog("system", "defeat", { target: state.hero.name });
  finishRun("defeat");
}

function handleDefeatProgression() {
  if (state.debugBuildRun) {
    state.runStats.endLevel = state.hero?.level || 1;
    return;
  }
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

function completeGoblinCampRoute() {
  const route = currentRoute();
  if (route?.id !== "goblin-camp" || !canCompleteRouteEncounter({
    route,
    routeEncounterIndex: state.routeEncounterIndex,
    battleEncounterType: state.battleEncounterType,
    enemies: state.enemies
  })) {
    throw new Error("哥布林營地 Route completion 條件尚未成立。");
  }
  if (!state.debugBuildRun) {
    const archerProgress = saveData.progression.characters.archer;
    const unlockedArcher = Boolean(archerProgress && !archerProgress.unlocked);
    saveData.storyFlags.archerRescued = true;
    if (archerProgress) {
      archerProgress.unlocked = true;
    }
    if (unlockedArcher) {
      state.runStats.unlockedCharacters.push(characterDefinitions.archer.name);
    }
    unlockAdventureClearAchievements({ regionId: "forest", routeId: route.id });
    recordRunFinished("clear");
  }
  showRouteEnding(route);
}

function showRouteEnding(route = currentRoute()) {
  const ending = route?.ending;
  if (!ending?.pages?.length) {
    finishRun("clear");
    return;
  }

  state.ended = true;
  state.awaitingBlessing = false;
  state.phase = "routeEnding";
  state.routeEndingContext = { routeId: route.id, pageIndex: 0 };
  state.blessingContext = "normal";
  state.blessingPoolOverrideId = null;
  clearPendingThreat();
  els.nextButton.disabled = true;
  els.blessingPanel.classList.remove("is-visible");
  els.endPanel.classList.remove("is-visible");
  closeAbilityInfoPanel();
  closeBlessingInfoPanel();
  renderRouteEndingPage();
  render();
}

function getActiveRouteEnding() {
  const routeId = state.routeEndingContext?.routeId || state.activeRouteId;
  return getRouteDefinition(routeId)?.ending || null;
}

function renderRouteEndingPage() {
  const ending = getActiveRouteEnding();
  const pageIndex = state.routeEndingContext?.pageIndex || 0;
  const page = ending?.pages?.[pageIndex];
  if (!page) {
    finishRun("clear");
    return;
  }

  renderRouteEndingView({
    els,
    eyebrow: ending.eyebrow || "冒險結尾",
    title: ending.title || "旅途結尾",
    narrative: page.lines,
    tone: page.tone,
    actionLabel: pageIndex >= ending.pages.length - 1 ? "完成冒險" : "繼續"
  });
  els.resultLabel.textContent = ending.title || "旅途結尾";
}

function continueRouteEnding() {
  if (state.phase !== "routeEnding" || !state.routeEndingContext) {
    return;
  }

  const ending = getActiveRouteEnding();
  state.routeEndingContext.pageIndex += 1;
  if (!ending || state.routeEndingContext.pageIndex >= ending.pages.length) {
    state.routeEndingContext = null;
    showCombatLayout(els);
    finishRun("clear");
    return;
  }
  renderRouteEndingPage();
}

function handleEventContinueButton() {
  if (state.phase === "routeEnding") {
    continueRouteEnding();
    return;
  }
  eventRuntime.continueEventResult();
}

function finishRun(outcome) {
  const region = currentRegion();
  const cleared = outcome === "clear";
  const retreated = outcome === "retreat";
  const defeated = outcome === "defeat";
  const evacuated = retreated && Boolean(state.runStats?.evacuated);
  state.ended = true;
  state.awaitingBlessing = false;
  state.phase = "ended";
  if (defeated) {
    handleDefeatProgression();
  }
  recordRunFinished(outcome);
  clearPendingThreat();
  state.blessingContext = "normal";
  state.blessingPoolOverrideId = null;
  els.nextButton.disabled = true;
  els.blessingPanel.classList.remove("is-visible");
  closeAbilityInfoPanel();
  closeBlessingInfoPanel();
  els.endPanel.classList.add("is-visible");
  els.endTitle.textContent = cleared ? "冒險成功" : evacuated ? "撤離逃跑" : retreated ? "冒險撤退" : "冒險失敗";
  els.endText.textContent = getEndText(outcome, region);
  els.endText.classList.toggle("danger-text", defeated && !hasPhoenixBlessing());
  renderEndSummary(outcome, region);
  els.resultLabel.textContent = cleared ? `${getAdventureSourceName()}突破` : evacuated ? "撤離成功" : retreated ? "回到營地" : "本輪結束";
  render();
}

function getEndText(outcome, region) {
  if (state.debugBuildRun) {
    return outcome === "clear"
      ? `Debug 場景已完成${getAdventureSourceName()}挑戰。正式存檔未變更。`
      : "Debug 場景測試結束。正式存檔未變更。";
  }
  if (outcome === "clear") {
    return `你完成了${getAdventureSourceName()}的挑戰。`;
  }
  if (outcome === "retreat") {
    if (state.runStats?.evacuated) {
      return "你在追擊中找到回營地的路線，結束了這輪冒險。本輪的臨時祝福會重置，角色等級與經驗會保留。";
    }
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
  const evacuated = retreated && Boolean(state.runStats?.evacuated);
  const sourceName = getAdventureSourceName();
  const encounterTotal = getAdventureEncounterCount();
  const reachedEncounter = getReachedEncounter(cleared);
  const blessings = state.hero.blessings.length > 0 ? state.hero.blessings.join("、") : "無";
  const progress = getCharacterProgress();
  const displayLevel = state.debugBuildRun ? state.hero.level : progress.level;
  if (!state.debugBuildRun) {
    state.lastRunSummary = {
      result: cleared ? "成功" : evacuated ? "撤離" : retreated ? "撤退" : "失敗",
      sourceName,
      reachedEncounter,
      encounterTotal,
      runLevel: state.runStats?.endLevel || displayLevel
    };
  }
  const items = [
    ["結果", cleared ? "冒險成功" : evacuated ? "撤離逃跑" : retreated ? "冒險撤退" : "冒險失敗"],
    ["路線", sourceName],
    ["抵達", `第 ${reachedEncounter} / ${encounterTotal} 場`],
    ["角色等級", `Lv. ${displayLevel}`],
    ["本輪經驗", `${state.runStats?.expGained || 0}`],
    ["擊敗敵人", `${state.defeatedEnemies} 隻`],
    ["擊敗首領", state.defeatedBoss ? "是" : "否"],
    ["逃跑", `成功 ${state.runStats?.fleeSuccesses || 0} / 失敗 ${state.runStats?.fleeFailures || 0}`],
    ["選擇祝福", blessings]
  ];
  if (state.runStats?.evacuationEscapes) {
    items.splice(8, 0, ["撤離逃跑", `${state.runStats.evacuationEscapes} 次`]);
  }
  if (state.runStats?.bossName) {
    items.splice(7, 0, ["本輪首領", state.runStats.bossName]);
  }
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
  if (state.runStats?.unlockedCharacters.length > 0) {
    items.push(["新角色", `${state.runStats.unlockedCharacters.join("、")}已可使用`]);
  }
  if (state.runStats?.progressReset) {
    items.push(["成長損失", `死亡使等級與經驗失去，已回到 Lv. 1。`]);
  }

  if (!cleared && !retreated) {
    items.push(["死因", state.deathCause ? state.deathCause.label : "未知"]);
  }

  renderStatList(els.endSummary, items);
}

function getReachedEncounter(cleared) {
  if (cleared) {
    return getAdventureEncounterCount();
  }
  return Math.min(getAdventureEncounterIndex() + 1, getAdventureEncounterCount());
}

function showBlessings(context = "normal", options = {}) {
  const { poolId = null, count = 3 } = options;
  state.blessingContext = context;
  state.blessingPoolOverrideId = poolId;
  state.awaitingBlessing = true;
  els.nextButton.disabled = true;
  els.blessingPanel.classList.add("is-visible");
  els.resultLabel.textContent = "選擇祝福";
  renderBlessingChoices(els.blessingChoices, getBlessingChoices(count, poolId), chooseBlessing);
}

function tryFlee() {
  const livingEnemies = getLivingEnemies(state.enemies);
  if (!state.hero || livingEnemies.length === 0 || state.ended || state.awaitingBlessing || state.phase === "safe") {
    return;
  }

  const threatKind = getEnemyGroupThreatKind(livingEnemies);
  if (!canFleeBattle(state.battleEncounterType)) {
    return;
  }

  const hasTacticalFlees = state.hero.fleesRemaining > 0;
  if (hasTacticalFlees) {
    state.hero.fleesRemaining -= 1;
  }
  state.runStats.fleeAttempts += 1;
  const groupLabel = getEnemyGroupLabel(livingEnemies);
  addLog("system", "fleeAttempt", { enemy: groupLabel });

  const fleeChance = getBattleFleeChance({
    encounterType: state.battleEncounterType,
    threatKind,
    normalChance: NORMAL_FLEE_CHANCE,
    eliteChance: ELITE_FLEE_CHANCE
  });
  if (!roll(fleeChance)) {
    resolveFleeFailure();
    return;
  }

  if (!hasTacticalFlees) {
    resolveEvacuationEscape();
    return;
  }

  state.runStats.fleeSuccesses += 1;
  const result = weightedRandomItem(TACTICAL_FLEE_RESULTS, (item) => item.weight);
  if (result.id === "counter") {
    resolveCounterEscape();
    return;
  }
  resolveSafeEscape();
}

function resolveFleeFailure() {
  const attacker = randomItem(getLivingEnemies(state.enemies));
  if (!attacker) {
    return;
  }

  state.runStats.fleeFailures += 1;
  addLog("system", "fleeFail", { enemy: getEnemyGroupLabel(state.enemies) });
  const log = createCombatLogger();
  resolveEnemyAction({
    hero: state.hero,
    enemy: attacker,
    turn: Math.max(1, state.turn),
    log,
    modifyDirectDamage: modifyCharacterIncomingDirectDamage
  });
  applyEmergencyBandage();
  if (state.hero.hp <= 0) {
    state.deathCause = {
      type: "fleeFailure",
      label: `逃跑失敗後被${getEnemyDisplayName(attacker)}擊倒`
    };
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
  savePendingThreat("safeEscape");
  addLog("system", "safeEscape", { enemy: getEnemyGroupLabel(state.pendingThreat?.enemies || []) });
  consumeBattleLimitedEffects();
  enterSafeState({ canRest: true });
}

function resolveCounterEscape() {
  state.runStats.counterEscapes += 1;
  savePendingThreat("counterEscape");
  addLog("system", "counterEscape");
  consumeBattleLimitedEffects();
  state.phase = "danger";
  state.turn = 0;
  state.awaitingBlessing = false;
  state.canRest = false;
  state.hasRested = false;
  state.ambushAdvantage = true;
  state.battleSource = "counterEscape";
  state.battleEncounterType = "counter";
  state.log = [];
  const counterEnemy = buildCounterEnemy(currentRegion(), state.encounterIndex);
  counterEnemy.poison = 0;
  setEnemyGroup([counterEnemy]);
  resetHeroBattleState();
  applyBattleStartSkills();
  const enemy = currentTargetEnemy();
  const reducedHp = Math.max(1, Math.round(enemy.maxHp * 0.85));
  const reducedAmount = enemy.maxHp - reducedHp;
  enemy.hp = reducedHp;
  addLog("system", "counterEscape");
  addLog("system", "encounter", { enemy: getEnemyDisplayName(enemy) });
  addLog("hero-damage", "ambushAdvantage", { enemy: getEnemyDisplayName(enemy), amount: reducedAmount });
  render();
}

function resolveEvacuationEscape() {
  state.runStats.evacuationEscapes += 1;
  state.runStats.evacuated = true;
  state.runStats.retreated = true;
  clearPendingThreat();
  addLog("system", "evacuationEscape");
  finishRun("retreat");
}

function continueAdventure() {
  if (state.phase !== "safe" || state.ended || state.adventureProgressLocked) {
    return;
  }

  state.adventureProgressLocked = true;
  setCombatActionState();

  if (hasPendingThreat("safeEscape")) {
    resumePendingThreat({
      healRatio: SAFE_ESCAPE_ENEMY_HEAL_RATIO,
      introText: "你重新回到原本的戰鬥。"
    });
    state.adventureProgressLocked = false;
    return;
  }

  if (shouldTriggerScheduledEvent(state.eventSchedule, getAdventureEncounterIndex())) {
    eventRuntime.beginScheduledEvent();
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
  clearPendingThreat();
  addLog("system", "retreat");
  finishRun("retreat");
}

function getBlessingChoices(count, poolId = null) {
  const pool = [...getAdventureBlessingDefinitions(poolId)];
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

function grantBlessing(blessing) {
  applyBlessingEffects(state.hero, blessing);
  state.hero.blessings.push(blessing.name);
  addLog("system", "blessing", { blessing: blessing.name });
  return blessing;
}

function chooseBlessing(blessing) {
  grantBlessing(blessing);
  if (state.blessingContext === "counterEscape" && hasPendingThreat("counterEscape")) {
    state.blessingContext = "normal";
    state.blessingPoolOverrideId = null;
    els.blessingPanel.classList.remove("is-visible");
    resumePendingThreat({
      healRatio: COUNTER_ESCAPE_ENEMY_HEAL_RATIO,
      introText: `你帶著新的臨時祝福「${blessing.name}」回到原本的戰鬥。`
    });
    return;
  }
  if (state.blessingContext === "eventChoice") {
    state.blessingContext = "normal";
    state.blessingPoolOverrideId = null;
    state.eventContext = null;
    state.eventInputLocked = false;
    state.adventureProgressLocked = false;
    els.blessingPanel.classList.remove("is-visible");
    showCombatLayout(els);
    enterSafeState({ canRest: false });
    return;
  }
  state.blessingContext = "normal";
  state.blessingPoolOverrideId = null;
  enterSafeState({ canRest: false });
}

function closeEndPanel() {
  els.endPanel.classList.remove("is-visible");
}

function openAbilityInfoPanel() {
  if (!state.hero) {
    return;
  }
  renderCurrentAbilityView(els.abilityInfoList, state.hero);
  els.abilityInfoPanel.classList.add("is-visible");
}

function closeAbilityInfoPanel() {
  els.abilityInfoPanel.classList.remove("is-visible");
}

function openBlessingInfoPanel() {
  if (!state.hero) {
    return;
  }
  renderBlessingInfoView({
    filtersElement: els.blessingInfoFilters,
    listElement: els.blessingInfoList,
    blessingNames: state.hero.blessings,
    blessingDefinitions: [
      ...(currentRegion().blessings || []),
      ...getAllIndependentBlessings()
    ],
    resetFilter: true
  });
  els.blessingInfoPanel.classList.add("is-visible");
}

function closeBlessingInfoPanel() {
  els.blessingInfoPanel.classList.remove("is-visible");
}

function closeStoryPanel() {
  if (state.storyTimer) {
    window.clearTimeout(state.storyTimer);
    state.storyTimer = null;
  }
  els.storyPanel.classList.remove("is-visible");
}

function closeTransientUiPanels() {
  els.blessingPanel.classList.remove("is-visible");
  closeEndPanel();
  closeSkillPanel();
  closeLockedCharacterHint();
  closeMaterialInfoPanel();
  closeExportSaveCodeDialog();
  closeImportSaveCodeDialog();
  closeAbilityInfoPanel();
  closeBlessingInfoPanel();
  closeStoryPanel();
  closeDeleteSaveDialog();
}

function shouldTriggerPlainsStory() {
  return state.selectedRegionId === "plains"
    && !hasPhoenixBlessing()
    && !saveData.storyFlags.plainsBossStorySeen;
}

function unlockAdventureClearAchievements({ regionId = state.selectedRegionId, routeId = state.activeRouteId } = {}) {
  if (state.debugBuildRun) {
    return;
  }
  if (regionId === "forest") {
    unlockAchievement(FOREST_TRIAL_ACHIEVEMENT_ID);
    if (routeId === "goblin-camp") {
      unlockAchievement(GOBLIN_CAMP_CLEAR_ACHIEVEMENT_ID);
    }
    saveData.storyFlags.achievementSystemUnlocked = true;
  }
}

function getPlainsStoryDefinition() {
  return regionDefinitions.plains?.clearStory || null;
}

function showPlainsStory() {
  const story = getPlainsStoryDefinition();
  if (!story?.lines?.length) {
    throw new Error("平原通關劇情資料不存在。");
  }

  setNavigationContext("story");
  state.ended = true;
  state.awaitingBlessing = false;
  state.phase = "story";
  clearPendingThreat();
  state.blessingContext = "normal";
  recordRunFinished("clear");
  els.nextButton.disabled = true;
  els.blessingPanel.classList.remove("is-visible");
  els.endPanel.classList.remove("is-visible");
  closeAbilityInfoPanel();
  closeBlessingInfoPanel();
  els.storyPanel.classList.add("is-visible");
  els.resultLabel.textContent = story.resultLabel || "命運覺醒";
  els.encounterLabel.textContent = story.encounterLabel || "星穹之外";
  renderStoryText(false);
  render();
}

function renderStoryText(revealed) {
  const story = getPlainsStoryDefinition();
  const lines = story?.lines || [];
  if (state.storyTimer) {
    window.clearTimeout(state.storyTimer);
    state.storyTimer = null;
  }
  els.storyText.innerHTML = "";
  lines.forEach((line, index) => {
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
    }, Math.max(0, lines.length - 1) * STORY_LINE_DELAY_MS + STORY_FINISH_EXTRA_DELAY_MS);
  }
}

function revealStoryText() {
  renderStoryText(true);
}

function completePlainsStory() {
  if (!state.debugBuildRun) {
    unlockPhoenixBlessing();
  }
  els.storyPanel.classList.remove("is-visible");
  returnToCamp();
}

function unlockPhoenixBlessing() {
  saveData.storyFlags.phoenixBlessingUnlocked = true;
  saveData.storyFlags.plainsBossStorySeen = true;
  saveData.storyFlags.achievementSystemUnlocked = true;
  unlockAchievement(PLAINS_TRIAL_ACHIEVEMENT_ID);
  saveGameSafe();
}

function render() {
  const hero = state.hero;
  if (!hero) {
    return;
  }

  state.targetEnemyId = resolveTargetEnemyId(state.enemies, state.targetEnemyId);
  renderCombatView({
    els,
    hero,
    enemies: state.enemies,
    targetEnemyId: state.targetEnemyId,
    phase: state.phase,
    characterStatusEntries: getCharacterCombatStatusEntries(hero),
    onTargetSelect: selectEnemyTarget
  });
  if (els.abilityInfoPanel.classList.contains("is-visible")) {
    renderCurrentAbilityView(els.abilityInfoList, hero);
  }

  const encounterTotal = getAdventureEncounterCount();
  const encounterNumber = Math.min(getAdventureEncounterIndex() + 1, encounterTotal);
  const sourceName = getAdventureSourceName();
  if (state.phase === "routeEnding") {
    els.encounterLabel.textContent = `${sourceName}｜旅途結尾`;
    els.battleLogTitle.textContent = `戰鬥紀錄｜${sourceName} ${encounterTotal} / ${encounterTotal}`;
  } else {
    els.encounterLabel.textContent = state.eventContext
      ? `${sourceName}事件｜第 ${encounterNumber} 場前`
      : `第 ${encounterNumber} / ${encounterTotal} 場`;
    els.battleLogTitle.textContent = state.battleSource === "event"
      ? `事件戰鬥｜${sourceName}第 ${encounterNumber} 場前`
      : `戰鬥紀錄｜第 ${encounterNumber} / ${encounterTotal} 場`;
  }
  if (!state.ended) {
    if (state.eventContext && state.phase !== "event") {
      els.resultLabel.textContent = getEventDefinition(state.eventContext.eventId)?.title || "冒險事件";
    } else if (!state.eventContext) {
      els.resultLabel.textContent = state.awaitingBlessing
        ? "選擇祝福"
        : state.phase === "safe"
          ? "安全路段"
          : state.turn === 0
          ? "遭遇開始"
          : `第 ${state.turn} 回合`;
    }
  }

  setCombatActionState();
}

function setCombatActionState() {
  const livingEnemies = getLivingEnemies(state.enemies);
  const hasEnemy = livingEnemies.length > 0;
  const isBoss = !canFleeBattle(state.battleEncounterType);
  const inGame = state.hero && !state.ended && !state.awaitingBlessing && !state.eventInputLocked;
  const safe = state.phase === "safe";
  const canFight = inGame && hasEnemy && !safe;
  const canFlee = canFight && !isBoss;
  const resumingSafeThreat = hasPendingThreat("safeEscape");
  const canContinue = inGame
    && safe
    && !state.adventureProgressLocked
    && (!state.eventContext || resumingSafeThreat);
  const canRest = canContinue && state.canRest && !state.hasRested && state.hero.hp < state.hero.maxHp;
  const canViewBlessings = Boolean(state.hero) && !state.ended && !state.awaitingBlessing && state.phase !== "event";
  const canViewAbility = Boolean(state.hero) && state.phase !== "event";

  els.nextButton.disabled = !canFight;
  els.nextButton.hidden = !canFight;
  els.nextButton.textContent = state.turn === 0 ? "戰鬥" : "繼續戰鬥";
  els.fleeButton.disabled = !canFlee;
  els.fleeButton.hidden = !canFight;
  els.fleeButton.textContent = isBoss
    ? "首領無法逃跑"
    : (state.hero?.fleesRemaining ?? 0) <= 0
    ? "撤離逃跑（需成功）"
    : `逃跑（剩餘 ${state.hero?.fleesRemaining ?? 0} / ${RUN_STARTING_FLEES}）`;
  els.continueButton.hidden = !canContinue;
  els.continueButton.disabled = !canContinue;
  els.continueButton.textContent = hasPendingThreat("safeEscape") ? "繼續挑戰" : "繼續前進";
  els.restButton.hidden = !canContinue;
  els.restButton.disabled = !canRest;
  els.restButton.textContent = state.canRest && !state.hasRested ? "原地修整" : "已修整";
  els.retreatButton.hidden = !canContinue;
  els.retreatButton.disabled = !canContinue;
  els.viewBlessingsButton.disabled = !canViewBlessings;
  els.openAbilityFromAttack.disabled = !canViewAbility;
  els.openAbilityFromDefense.disabled = !canViewAbility;
  els.openAbilityFromCrit.disabled = !canViewAbility;
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

function bindBackdropClose(panel, closePanel) {
  panel.addEventListener("click", (event) => {
    if (event.target === panel) {
      closePanel();
    }
  });
}

function bindEvents() {
  els.openRegionButton.addEventListener("click", () => showScreenInContext("campScreen", "camp"));
  els.openCharacterButton.addEventListener("click", () => showCharacterList("menu"));
  els.openStatisticsButton.addEventListener("click", () => showStatisticsScreen("menu"));
  els.openAchievementButton.addEventListener("click", () => showScreenInContext("achievementScreen", "menu"));
  els.musicToggleButton.addEventListener("click", toggleMusicEnabled);
  els.musicVolumeInput.addEventListener("input", previewMusicVolume);
  els.musicVolumeInput.addEventListener("change", commitMusicVolume);
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
  els.selectCharacterButton.addEventListener("click", selectCharacterFromDetail);
  els.closeCharacterLockedButton.addEventListener("click", closeLockedCharacterHint);
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
  els.eventContinueButton.addEventListener("click", handleEventContinueButton);
  els.restButton.addEventListener("click", restAtSafeRoute);
  els.retreatButton.addEventListener("click", retreatRun);
  [els.openAbilityFromAttack, els.openAbilityFromDefense, els.openAbilityFromCrit].forEach((button) => {
    button.addEventListener("click", openAbilityInfoPanel);
  });
  els.closeAbilityInfoButton.addEventListener("click", closeAbilityInfoPanel);
  els.viewBlessingsButton.addEventListener("click", openBlessingInfoPanel);
  els.closeBlessingInfoButton.addEventListener("click", closeBlessingInfoPanel);
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
  [
    [els.skillInfoPanel, closeSkillPanel],
    [els.materialInfoPanel, closeMaterialInfoPanel],
    [els.abilityInfoPanel, closeAbilityInfoPanel],
    [els.blessingInfoPanel, closeBlessingInfoPanel],
    [els.exportSaveCodePanel, closeExportSaveCodeDialog],
    [els.importSaveCodePanel, closeImportSaveCodeDialog]
  ].forEach(([panel, closePanel]) => bindBackdropClose(panel, closePanel));
  document.addEventListener("click", () => {
    void musicManager.handleUserInteraction();
  });
}

eventRuntime = createEventRuntime({
  state,
  els,
  getSaveData: () => saveData,
  currentRegion,
  getAdventureSourceName,
  clearEnemyGroup,
  setCombatActionState,
  applySceneContext,
  setEnemyGroup,
  resetHeroBattleState,
  applyBattleStartSkills,
  addFixedLog,
  logCurrentEnemyGroupEncounter,
  applyEnemyAmbushes,
  addLog,
  render,
  grantBlessing,
  hasPhoenixBlessing,
  saveGameSafe,
  loseRun,
  startEncounter,
  enterAdventureRoute,
  showBlessings
});

const debugActions = createDebugRuntimeActions({
  state,
  els,
  getSaveData: () => saveData,
  replaceSaveData: (nextSaveData) => {
    saveData = nextSaveData;
  },
  isDebugModeEnabled,
  getCharacterDefinition,
  buildHeroFromProgression,
  unlockAchievement,
  plainsTrialAchievementId: PLAINS_TRIAL_ACHIEVEMENT_ID,
  saveGameSafe,
  render,
  initializeRunRuntime,
  currentRegion,
  setEnemyGroup,
  resetHeroBattleState,
  applyBattleStartSkills,
  addFixedLog,
  logCurrentEnemyGroupEncounter,
  addLog,
  enterSafeState,
  startEncounter,
  showPlainsStory,
  showRouteEnding,
  getRouteBossDefinition,
  recordSelectedBossInRunStats,
  applySceneContext,
  consumeBattleLimitedEffects,
  returnToCamp,
  syncSelectionFromSave,
  restart,
  syncMusicSettingsFromSave,
  closeTransientUiPanels,
  showScreen,
  runStartingFlees: RUN_STARTING_FLEES
});

syncSelectionFromSave();
syncMusicSettingsFromSave();
bindEvents();
initDebugPanel({
  enabled: isDebugModeEnabled(),
  actions: debugActions
});
applySceneContext("menuScreen");
