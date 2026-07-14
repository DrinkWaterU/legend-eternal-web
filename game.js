import { DEFAULT_CHARACTER_ID, DEFAULT_REGION_ID, GAME_VERSION } from "./src/config.js";
import { resetBattleEntryState } from "./src/adventure/battleLifecycle.js";
import { createEventRuntime } from "./src/adventure/eventRuntime.js";
import { resetAdventureRunState } from "./src/adventure/runLifecycle.js";
import { createMusicManager } from "./src/audio/musicManager.js";
import { applyBlessingEffects } from "./src/core/blessings.js";
import { spendInventoryCost } from "./src/core/commerce.js";
import {
  equipWeapon,
  getOwnedCompatibleWeapons,
  resolveEquippedWeapon,
  unequipWeapon
} from "./src/core/equipment.js";
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
import {
  assertRegionPreparations,
  beginPreparationBattle,
  consumePreparationEntangleRetry,
  createRunPreparation,
  getPreparationCombatStatus,
  getPreparationSummary,
  getRegionPreparation,
  recordPreparationEntangleRetryResult,
  resolvePostEncounterPreparation,
  resolvePreparationIncomingDirectDamage,
  resolvePreparationPoisonDamage,
  runPreparationOpeningAction
} from "./src/core/preparations.js";
import { createDefaultSave, deleteStoredSave, isImportableSave, loadSave, migrateSave, saveGame } from "./src/core/storage.js";
import {
  canEnterSafeArea,
  getCurrentSafeAreaId,
  isSafeAreaUnlocked,
  isSafeAreaVisited,
  markSafeAreaVisited,
  setCurrentSafeArea,
  syncSafeAreaUnlocks
} from "./src/core/safeAreaProgression.js";
import { characterDefinitions } from "./src/data/characters/index.js";
import { achievementDefinitions } from "./src/data/achievements.js";
import { getAllIndependentBlessings, getBlessingPool } from "./src/data/blessings/index.js";
import { getBlessingFlowDefinitions } from "./src/data/blessingFlows.js";
import { assertFacilityDefinitions, facilityDefinitions, getFacilityDefinition } from "./src/data/facilities.js";
import { materialDefinitions } from "./src/data/materials.js";
import {
  assertWeaponDefinitions,
  weaponCategoryDefinitions,
  weaponDefinitions
} from "./src/data/weapons.js";
import { ambientAudioDefinitions } from "./src/data/ambientAudio.js";
import { ANPING_ARRIVAL_TIMING, anpingArrivalPages } from "./src/data/anpingArrival.js";
import { musicDefinitions } from "./src/data/music.js";
import { getEnemyDefinition } from "./src/data/enemies/index.js";
import { getEventDefinition } from "./src/data/events/index.js";
import { regionDefinitions } from "./src/data/regions/index.js";
import {
  ANPING_TOWN_SAFE_AREA_ID,
  assertSafeAreaDefinitions,
  DEFAULT_SAFE_AREA_ID,
  getSafeAreaDefinition,
  getSafeAreaDefinitions,
  safeAreaDefinitions
} from "./src/data/safeAreas.js";
import { getRouteDefinition, getRouteGroup } from "./src/data/routes/index.js";
import { getBlessingRarity } from "./src/data/rarities.js";
import { templates } from "./src/data/templates.js";
import { els } from "./src/ui/dom.js";
import { renderCharacterSkills } from "./src/ui/characterSkillsView.js";
import { renderCharacterDetailView } from "./src/ui/characterDetailView.js";
import { renderCharacterCards } from "./src/ui/characterSelectView.js";
import { filterEquipmentWeapons, renderCharacterEquipmentView } from "./src/ui/characterEquipmentView.js";
import { initDebugPanel } from "./src/ui/debugPanel.js";
import { renderBlessingInfoView } from "./src/ui/blessingInfoView.js";
import { renderCombatView, renderCurrentAbilityView } from "./src/ui/combatView.js";
import { renderRouteEndingView, showCombatLayout } from "./src/ui/eventView.js";
import { renderBattleLog, renderBlessingChoices, renderChoiceList, renderStatList } from "./src/ui/renderHelpers.js";
import { copyText, createSaveTransferCode, parseSaveTransferCode } from "./src/ui/saveTools.js";
import { renderFacilityListView } from "./src/ui/facilityView.js";
import { createMerchantController } from "./src/ui/merchantController.js";
import { createBlacksmithController } from "./src/ui/blacksmithController.js";
import { getEnhancementMaterialState, renderPreparationChoices, renderPreparationDetail } from "./src/ui/preparationView.js";
import { clearPreparationSelectionState, consumePreparationEnhancementReveal, normalizePreparationUiState } from "./src/ui/preparationState.js";
import { renderStatisticsView } from "./src/ui/statisticsView.js";
import { buildMaterialUsageIndex } from "./src/ui/materialUsage.js";
import { renderStorageView } from "./src/ui/storageView.js";
import {
  closeAchievementDetailView,
  renderAchievementUnlockToast,
  renderAchievementView
} from "./src/ui/achievementView.js";
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
const ANPING_ARRIVAL_PAGES = anpingArrivalPages;
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

const materialUsageIndex = buildMaterialUsageIndex({ regionDefinitions, weaponDefinitions });
const ACHIEVEMENT_TOAST_DURATION_MS = 4600;

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
  runPreparation: null,
  canRest: false,
  hasRested: false,
  ambushAdvantage: false,
  pendingThreat: null,
  blessingContext: "normal",
  blessingPoolOverrideId: null,
  blessingInputLocked: false,
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
  runOriginSafeAreaId: null,
  pendingAnpingArrival: false,
  anpingArrivalContext: null,
  anpingArrivalInputLocked: false,
  anpingArrivalTimerIds: [],
  runResultRecorded: false,
  pendingAchievementUnlocks: [],
  activeAchievementToastId: null,
  achievementToastTimer: null,
  log: []
};

const uiState = {
  navigationContext: "menu",
  regionView: "list",
  characterView: "list",
  characterDetailId: DEFAULT_CHARACTER_ID,
  equipmentPreviewWeaponId: null,
  equipmentNotice: "",
  equipmentNoticeType: "status",
  characterSkillSelectedId: null,
  characterSkillSearchQuery: "",
  characterSkillTypeFilter: "all",
  characterSkillStageFilter: "all",
  equipmentSearchQuery: "",
  equipmentCategoryFilter: "all",
  equipmentSortMode: "rarity",
  statisticsView: "overview",
  statisticsCharacterId: DEFAULT_CHARACTER_ID,
  statisticsRegionId: DEFAULT_REGION_ID,
  storageSortMode: "rarity",
  storageSortDirection: "desc",
  storageSearchQuery: "",
  storageRarityFilter: "all",
  storageSelectedMaterialId: null,
  storageUsageFilter: "all",
  storageExpandedUsageIds: new Set(),
  achievementFilter: "all",
  achievementSelectedId: null,
  achievementNewIds: new Set(),
  achievementDetailOpen: false,
  safeAreaId: DEFAULT_SAFE_AREA_ID,
  facilityView: "list",
  selectedPreparationId: null,
  enhancedPreparationId: null,
  preparationEnhancementRevealId: null,
  preparationDetailId: null,
  preparationDetailExpanded: false,
  runStartNotice: "",
  runStartLocked: false
};

let saveData = loadSave();
syncSafeAreaUiFromSave();
let pendingSaveCodeImport = null;
let achievementDetailTrigger = null;
const musicManager = createMusicManager({ trackDefinitions: musicDefinitions });
const ambientManager = createMusicManager({
  trackDefinitions: ambientAudioDefinitions,
  trackLabel: "環境音"
});
let eventRuntime = null;

const FACILITY_ACTION_HANDLERS = Object.freeze({
  merchant: showMerchantFacility,
  blacksmith: showBlacksmithFacility
});

const merchantController = createMerchantController({
  els,
  materialDefinitions,
  getInventory: () => saveData.inventory,
  getSafeArea: getCurrentSafeArea,
  saveInventory: saveGameSafe
});

const blacksmithController = createBlacksmithController({
  els,
  weaponDefinitions,
  weaponCategoryDefinitions,
  materialDefinitions,
  getInventory: () => saveData.inventory,
  getSafeArea: getCurrentSafeArea,
  saveInventory: saveGameSafe
});

assertFacilityDefinitions(facilityDefinitions);
assertWeaponDefinitions(weaponDefinitions, { materialDefinitions });
assertSafeAreaDefinitions(safeAreaDefinitions, facilityDefinitions);
Object.values(regionDefinitions).forEach(assertRegionPreparations);
Object.values(facilityDefinitions).forEach((facility) => {
  if (typeof FACILITY_ACTION_HANDLERS[facility.actionId] !== "function") {
    throw new Error(`Facility ${facility.id} 使用未知 actionId：${facility.actionId}`);
  }
});

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
    return getCurrentSafeArea()?.audio?.bgmId || "camp";
  }
  if (uiState.navigationContext === "menu") {
    return "menu";
  }
  return null;
}

function resolveSceneAmbientTrackId(screenId) {
  if (uiState.navigationContext === "story") {
    return undefined;
  }
  if (screenId === "campScreen" || uiState.navigationContext === "camp") {
    return getCurrentSafeArea()?.audio?.ambientId || null;
  }
  return null;
}

function syncSceneAudio(screenId) {
  const musicTrackId = resolveSceneMusicTrackId(screenId);
  const ambientTrackId = resolveSceneAmbientTrackId(screenId);
  if (musicTrackId !== undefined) {
    void musicManager.requestTrack(musicTrackId);
  }
  if (ambientTrackId !== undefined) {
    void ambientManager.requestTrack(ambientTrackId);
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
    delete document.body.dataset.safeArea;
    document.body.style.removeProperty("--safe-area-bg-mobile");
    document.body.style.removeProperty("--safe-area-bg-desktop");
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
    if (scene === "camp") {
      applySafeAreaBackground();
    } else {
      delete document.body.dataset.safeArea;
      document.body.style.removeProperty("--safe-area-bg-mobile");
      document.body.style.removeProperty("--safe-area-bg-desktop");
    }
  }

  syncSceneAudio(screenId);
}

function applySafeAreaBackground() {
  const safeArea = getCurrentSafeArea();
  const mobile = safeArea?.visual?.background?.mobile || safeArea?.visual?.background?.desktop || "";
  const desktop = safeArea?.visual?.background?.desktop || safeArea?.visual?.background?.mobile || "";
  document.body.dataset.safeArea = safeArea?.id || DEFAULT_SAFE_AREA_ID;
  if (mobile) {
    document.body.style.setProperty("--safe-area-bg-mobile", `url("${resolveAssetUrl(mobile)}")`);
  } else {
    document.body.style.removeProperty("--safe-area-bg-mobile");
  }
  if (desktop) {
    document.body.style.setProperty("--safe-area-bg-desktop", `url("${resolveAssetUrl(desktop)}")`);
  } else {
    document.body.style.removeProperty("--safe-area-bg-desktop");
  }
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
    const safeArea = getCurrentSafeArea();
    els.resultLabel.textContent = safeArea?.name || "安全區";
    els.encounterLabel.textContent = state.selectedRegion;
    renderCampScreen();
  }
  if (screenId === "safeAreaTravelScreen") {
    els.resultLabel.textContent = "據點移動";
    els.encounterLabel.textContent = getCurrentSafeArea()?.name || "安全區";
    renderSafeAreaTravelScreen();
  }
  if (screenId === "storageScreen") {
    els.resultLabel.textContent = "倉庫";
    els.encounterLabel.textContent = getCurrentSafeArea()?.name || "安全區";
    renderStorageScreen();
  }
  if (screenId === "facilityScreen") {
    els.resultLabel.textContent = uiState.facilityView === "merchant"
      ? "旅行商人"
      : uiState.facilityView === "blacksmith"
        ? "鐵匠鋪"
        : getCurrentSafeArea()?.placesTitle || "安全區去處";
    els.encounterLabel.textContent = getCurrentSafeArea()?.name || "安全區";
    renderFacilityScreen();
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
  ambientManager.setVolume(saveData.settings.musicVolume);
  void musicManager.setEnabled(saveData.settings.musicEnabled);
  void ambientManager.setEnabled(saveData.settings.musicEnabled);
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
  void ambientManager.setEnabled(saveData.settings.musicEnabled);
  renderMusicControls();
  saveGameSafe();
}

function previewMusicVolume() {
  const volume = musicManager.setVolume(Number(els.musicVolumeInput.value));
  ambientManager.setVolume(volume);
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

function resetPreparationUiState() {
  clearPreparationSelectionState(uiState);
  uiState.runStartNotice = "";
  uiState.runStartLocked = false;
}

function showRegionDetail(regionId = DEFAULT_REGION_ID) {
  saveData.settings.selectedRegionId = regionId;
  saveGameSafe();
  syncSelectionFromSave();
  uiState.regionView = "detail";
  resetPreparationUiState();
  showScreen("regionScreen");
}

function renderMenuScreen() {
  const safeAreaHint = els.openRegionButton.querySelector("small");
  if (safeAreaHint) {
    safeAreaHint.textContent = `進入${getCurrentSafeArea()?.name || "安全區"}`;
  }
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
    ? `${state.lastRunSummary.sourceName} ${state.lastRunSummary.reachedEncounter} / ${state.lastRunSummary.encounterTotal} 場${state.lastRunSummary.result}`
    : "尚無紀錄";
  const inventorySummary = formatInventorySummary(saveData.inventory, materialDefinitions);
  const safeArea = getCurrentSafeArea();
  const facilities = getAvailableFacilities(safeArea);
  const campStats = [
    ["目前角色", `${character.name} Lv.${progress.level}`],
    ["目前地區", region.name],
    ["經驗", `${progress.exp} / ${expToNext}`],
    hasPhoenixBlessing()
      ? ["目前金幣", inventorySummary.gold]
      : ["最近冒險", lastResult]
  ];

  els.campEyebrow.textContent = safeArea.eyebrow || safeArea.name;
  els.campTitle.textContent = safeArea.title || safeArea.name;
  els.campDescription.textContent = safeArea.description || "";
  els.campFeatureTitle.textContent = safeArea.featureTitle || "安全區功能";
  els.campFeatureTitle.closest("section")?.setAttribute("aria-label", safeArea.featureTitle || "安全區功能");
  renderStatList(els.campStatusList, campStats);
  els.campStartHint.textContent = hasPhoenixBlessing()
    ? `前往${region.name}，確認本輪準備並繼續旅程`
    : `前往${region.name}開始旅程`;
  els.campRegionHint.textContent = `目前：${region.name}`;
  els.campCharacterHint.textContent = `${character.name} Lv.${progress.level}`;
  els.campStorageHint.textContent = "整理帶回的素材";
  els.campPlacesHint.textContent = facilities.length > 0
    ? safeArea.placesDescription || "四處看看"
    : safeArea.placesLockedDescription || "目前沒有可前往的地方";
  els.campRecordHint.textContent = "查看過往旅程";
  els.campStorageButton.hidden = !hasPhoenixBlessing();
  els.campPlacesButton.hidden = facilities.length === 0 && safeArea.id === DEFAULT_SAFE_AREA_ID;
  els.campPlacesButton.disabled = facilities.length === 0;
  renderCampTravelButton(safeArea);

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
    const preparations = Array.isArray(region.preparations) ? region.preparations : [];
    const traits = Array.isArray(region.traits)
      ? region.traits.filter((trait) => typeof trait === "string" && trait.trim())
      : [];
    const inventory = normalizeInventory(saveData.inventory);
    const character = characterDefinitions[state.selectedHeroId];
    const progress = normalizeCharacterProgress(state.selectedHeroId);
    const phoenixUnlocked = hasPhoenixBlessing();

    normalizePreparationUiState({
      uiState,
      region,
      gold: inventory.gold,
      inventoryMaterials: inventory.materials,
      enabled: phoenixUnlocked
    });

    els.regionDetailName.textContent = region.name;
    els.regionDetailDescription.textContent = region.note
      ? `${region.description}\n${region.note}`
      : region.description;
    renderStatList(els.regionDetailStats, [
      ["遭遇", `${region.encounterCount} 場`],
      ["難度", region.difficulty],
      ["推薦等級", region.recommendedLevel || "Lv.1+"],
      ["首領", region.bossName]
    ]);

    els.regionTraitList.replaceChildren();
    traits.forEach((trait) => {
      const item = document.createElement("span");
      item.className = "region-trait";
      item.textContent = trait;
      els.regionTraitList.append(item);
    });
    els.regionTraits.hidden = traits.length === 0;

    els.regionDepartureCharacter.textContent = `${character.name} Lv.${progress.level}`;
    els.regionDepartureGoldItem.hidden = !phoenixUnlocked;
    if (phoenixUnlocked) {
      els.regionDepartureGold.textContent = String(inventory.gold);
    }

    els.regionPreparationSection.hidden = !phoenixUnlocked;
    els.regionStartNotice.textContent = uiState.runStartNotice;
    els.regionStartNotice.hidden = !uiState.runStartNotice;
    if (phoenixUnlocked) {
      renderPreparationChoices({
        element: els.regionPreparationChoices,
        preparations,
        selectedPreparationId: uiState.selectedPreparationId,
        detailPreparationId: uiState.preparationDetailId,
        detailExpanded: uiState.preparationDetailExpanded,
        enhancedPreparationId: uiState.enhancedPreparationId,
        gold: inventory.gold,
        inventoryMaterials: inventory.materials,
        materialDefinitions,
        onSelect: selectPreparation
      });
      const detailPreparation = getRegionPreparation(region, uiState.preparationDetailId);
      const detailAffordable = !detailPreparation || inventory.gold >= detailPreparation.cost;
      const detailEnhanced = detailPreparation?.id === uiState.enhancedPreparationId;
      const animateEnhancement = consumePreparationEnhancementReveal(uiState, detailPreparation?.id);
      renderPreparationDetail({
        element: els.regionPreparationDetail,
        preparation: detailPreparation,
        expanded: uiState.preparationDetailExpanded,
        priceLabel: detailPreparation
          ? detailAffordable
            ? `${detailPreparation.cost} 金幣`
            : `金幣不足｜需 ${detailPreparation.cost} 金幣`
          : "免費",
        selected: detailPreparation?.id === uiState.selectedPreparationId,
        enhanced: detailEnhanced,
        animateEnhancement,
        inventoryMaterials: inventory.materials,
        materialDefinitions,
        onToggleEnhancement: togglePreparationEnhancement
      });
    } else {
      els.regionPreparationChoices.replaceChildren();
      renderPreparationDetail({
        element: els.regionPreparationDetail,
        preparation: null,
        expanded: false,
        priceLabel: "免費",
        selected: false,
        enhanced: false
      });
    }

    const activePreparation = phoenixUnlocked
      ? getRegionPreparation(region, uiState.selectedPreparationId)
      : null;
    const activePreparationEnhanced = activePreparation?.id === uiState.enhancedPreparationId;
    renderPreparationRunCostPreview({
      preparation: activePreparation,
      enhanced: activePreparationEnhanced
    });
    els.startButton.textContent = activePreparation
      ? activePreparationEnhanced
        ? `花費 ${activePreparation.cost} 金幣＋素材並開始${region.name}冒險`
        : `花費 ${activePreparation.cost} 金幣並開始${region.name}冒險`
      : `開始${region.name}冒險`;
    els.startButton.disabled = uiState.runStartLocked;
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
  const changedCharacter = uiState.characterDetailId !== characterId;
  uiState.characterDetailId = characterId;
  uiState.characterView = "detail";
  uiState.equipmentNotice = "";
  if (changedCharacter) {
    uiState.characterSkillSelectedId = null;
    uiState.characterSkillSearchQuery = "";
    uiState.characterSkillTypeFilter = "all";
    uiState.characterSkillStageFilter = "all";
  }
  showScreen("characterScreen");
}

function showCharacterEquipment(characterId = uiState.characterDetailId) {
  if (!isCharacterUnlocked(characterId)) {
    showLockedCharacterHint();
    return;
  }
  uiState.characterDetailId = characterId;
  uiState.characterView = "equipment";
  uiState.equipmentNotice = "";
  const character = characterDefinitions[characterId];
  const progress = getCharacterProgress(characterId);
  const equippedWeapon = resolveEquippedWeapon({
    character,
    progress,
    inventory: saveData.inventory,
    weaponDefinitions
  });
  const ownedWeapons = getOwnedCompatibleWeapons({
    character,
    inventory: saveData.inventory,
    weaponDefinitions
  });
  uiState.equipmentPreviewWeaponId = equippedWeapon?.id || ownedWeapons[0]?.id || null;
  uiState.equipmentSearchQuery = "";
  uiState.equipmentCategoryFilter = "all";
  uiState.equipmentSortMode = "rarity";
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

function selectEquipmentPreview(weaponId) {
  if (!weaponDefinitions[weaponId]) {
    return;
  }
  uiState.equipmentPreviewWeaponId = weaponId;
  uiState.equipmentNotice = "";
  renderCharacterScreen();
}

function equipCharacterWeapon(weaponId) {
  const characterId = uiState.characterDetailId;
  const character = characterDefinitions[characterId];
  const progress = getCharacterProgress(characterId);
  const previousWeaponId = progress.equipment?.weaponId || null;
  try {
    const weapon = equipWeapon({
      character,
      progress,
      inventory: saveData.inventory,
      weaponDefinitions,
      weaponId
    });
    if (!saveGameSafe()) {
      progress.equipment = { weaponId: previousWeaponId };
      throw new Error("瀏覽器無法保存裝備變更，已恢復原本武器。");
    }
    uiState.equipmentPreviewWeaponId = weapon.id;
    uiState.equipmentNotice = `已為${character.name}裝備${weapon.name}。下一輪冒險開始時生效。`;
    uiState.equipmentNoticeType = "status";
  } catch (error) {
    uiState.equipmentNotice = error instanceof Error ? error.message : "裝備武器失敗。";
    uiState.equipmentNoticeType = "error";
  }
  renderCharacterScreen();
}

function unequipCharacterWeapon() {
  const characterId = uiState.characterDetailId;
  const character = characterDefinitions[characterId];
  const progress = getCharacterProgress(characterId);
  const previousWeaponId = unequipWeapon(progress);
  const previousWeapon = weaponDefinitions[previousWeaponId];
  if (!saveGameSafe()) {
    progress.equipment = { weaponId: previousWeaponId };
    uiState.equipmentNotice = "瀏覽器無法保存卸下結果，已恢復原本武器。";
    uiState.equipmentNoticeType = "error";
    renderCharacterScreen();
    return;
  }
  uiState.equipmentNotice = previousWeapon
    ? `已卸下${previousWeapon.name}。下一輪冒險開始時生效。`
    : "目前沒有已裝備的武器。";
  uiState.equipmentNoticeType = "status";
  renderCharacterScreen();
}

function buildHeroPreviewForWeapon(characterId, weaponId) {
  const character = characterDefinitions[characterId];
  const progress = clone(normalizeCharacterProgress(characterId));
  progress.equipment = { weaponId: weaponId || null };
  return buildHeroFromProgressionCore(character, progress, {
    inventory: saveData.inventory,
    weaponDefinitions
  });
}

function renderCharacterScreen() {
  els.characterListView.classList.toggle("is-active", uiState.characterView === "list");
  els.characterDetailView.classList.toggle("is-active", uiState.characterView === "detail");
  els.characterEquipmentView.classList.toggle("is-active", uiState.characterView === "equipment");
  setReturnButton(els.characterListView.querySelector(".back-button"), getNavigationReturnTarget());

  const equippedWeaponsByCharacterId = Object.fromEntries(
    Object.entries(characterDefinitions).map(([characterId, character]) => {
      const progress = getCharacterProgress(characterId);
      return [characterId, resolveEquippedWeapon({
        character,
        progress,
        inventory: saveData.inventory,
        weaponDefinitions
      })];
    })
  );

  renderCharacterCards({
    element: els.characterChoiceList,
    characterDefinitions,
    characterProgression: saveData.progression.characters,
    selectedCharacterId: saveData.settings.selectedCharacterId,
    equippedWeaponsByCharacterId,
    weaponCategoryDefinitions,
    onCharacterClick: showCharacterDetail,
    onLockedCharacterClick: showLockedCharacterHint
  });

  if (uiState.characterView === "list") {
    return;
  }

  const characterId = isCharacterUnlocked(uiState.characterDetailId)
    ? uiState.characterDetailId
    : saveData.settings.selectedCharacterId;
  uiState.characterDetailId = characterId;
  const character = characterDefinitions[characterId];
  const progress = getCharacterProgress(characterId);
  const preview = buildHeroFromProgression(characterId);
  const equippedWeapon = equippedWeaponsByCharacterId[characterId] || null;

  if (uiState.characterView === "detail") {
    const maxLevel = getCharacterMaxLevel(character);
    const experienceLabel = progress.level >= maxLevel
      ? "經驗 MAX"
      : `經驗 ${progress.exp} / ${getExpToNextLevel(progress.level, character)}`;
    renderCharacterDetailView({
      els,
      characterId,
      character,
      progress,
      hero: preview,
      equippedWeapon,
      weaponCategoryDefinitions,
      experienceLabel,
      selected: characterId === saveData.settings.selectedCharacterId,
      onEquipmentOpen: () => showCharacterEquipment(characterId)
    });

    els.characterSkillSearchInput.value = uiState.characterSkillSearchQuery;
    els.characterSkillTypeSelect.value = uiState.characterSkillTypeFilter;
    const skillResult = renderCharacterSkills({
      listElement: els.characterSkillList,
      detailElement: els.characterSkillDetail,
      nextSkillElement: els.characterNextSkillPanel,
      countElement: els.characterSkillCount,
      emptyElement: els.characterSkillEmpty,
      stageFilterElement: els.characterSkillStageFilters,
      character,
      progress,
      selectedSkillId: uiState.characterSkillSelectedId,
      searchQuery: uiState.characterSkillSearchQuery,
      typeFilter: uiState.characterSkillTypeFilter,
      stageFilter: uiState.characterSkillStageFilter,
      onSkillSelect: (skillId) => {
        uiState.characterSkillSelectedId = skillId;
        renderCharacterScreen();
      }
    });
    uiState.characterSkillSelectedId = skillResult.selectedSkillId;
    return;
  }

  const ownedWeapons = getOwnedCompatibleWeapons({
    character,
    inventory: saveData.inventory,
    weaponDefinitions
  });
  const visibleWeapons = filterEquipmentWeapons(ownedWeapons, {
    searchQuery: uiState.equipmentSearchQuery,
    categoryFilter: uiState.equipmentCategoryFilter,
    sortMode: uiState.equipmentSortMode
  });
  const selectedWeapon = visibleWeapons.find((weapon) => weapon.id === uiState.equipmentPreviewWeaponId)
    || visibleWeapons.find((weapon) => weapon.id === equippedWeapon?.id)
    || visibleWeapons[0]
    || null;
  uiState.equipmentPreviewWeaponId = selectedWeapon?.id || null;
  const equipmentPreview = selectedWeapon
    ? buildHeroPreviewForWeapon(characterId, selectedWeapon.id)
    : preview;

  renderCharacterEquipmentView({
    els,
    character,
    progress,
    equippedWeapon,
    selectedWeapon,
    ownedWeapons,
    visibleWeapons,
    weaponCategoryDefinitions,
    currentHero: preview,
    previewHero: equipmentPreview,
    notice: uiState.equipmentNotice,
    noticeType: uiState.equipmentNoticeType,
    searchQuery: uiState.equipmentSearchQuery,
    categoryFilter: uiState.equipmentCategoryFilter,
    sortMode: uiState.equipmentSortMode,
    onSearchChange: (searchQuery) => {
      uiState.equipmentSearchQuery = searchQuery;
      renderCharacterScreen();
    },
    onSortChange: (sortMode) => {
      uiState.equipmentSortMode = sortMode;
      renderCharacterScreen();
    },
    onCategoryChange: (categoryFilter) => {
      uiState.equipmentCategoryFilter = categoryFilter;
      renderCharacterScreen();
    },
    onWeaponSelect: selectEquipmentPreview,
    onEquip: equipCharacterWeapon,
    onUnequip: unequipCharacterWeapon
  });
}

function renderStorageScreen() {
  const inventory = normalizeInventory(saveData.inventory);
  els.storageSafeAreaEyebrow.textContent = getCurrentSafeArea()?.name || "安全區";
  setReturnButton(els.storageBackButton, getNavigationReturnTarget());
  const result = renderStorageView({
    els,
    inventory,
    materialDefinitions,
    usageIndex: materialUsageIndex,
    sortMode: uiState.storageSortMode,
    sortDirection: uiState.storageSortDirection,
    searchQuery: uiState.storageSearchQuery,
    rarityFilter: uiState.storageRarityFilter,
    selectedMaterialId: uiState.storageSelectedMaterialId,
    usageFilter: uiState.storageUsageFilter,
    expandedUsageIds: uiState.storageExpandedUsageIds,
    onSortChange: (sortMode) => {
      uiState.storageSortMode = sortMode;
      renderStorageScreen();
    },
    onDirectionChange: (sortDirection) => {
      uiState.storageSortDirection = sortDirection;
      renderStorageScreen();
    },
    onSearchChange: (searchQuery) => {
      uiState.storageSearchQuery = searchQuery;
      renderStorageScreen();
    },
    onRarityChange: (rarityFilter) => {
      uiState.storageRarityFilter = rarityFilter;
      renderStorageScreen();
    },
    onMaterialSelect: (materialId) => {
      if (uiState.storageSelectedMaterialId !== materialId) {
        uiState.storageUsageFilter = "all";
        uiState.storageExpandedUsageIds = new Set();
      }
      uiState.storageSelectedMaterialId = materialId;
      renderStorageScreen();
    },
    onUsageFilterChange: (usageFilter) => {
      uiState.storageUsageFilter = usageFilter;
      renderStorageScreen();
    },
    onUsageToggle: (usageId) => {
      const nextExpanded = new Set(uiState.storageExpandedUsageIds);
      if (nextExpanded.has(usageId)) {
        nextExpanded.delete(usageId);
      } else {
        nextExpanded.add(usageId);
      }
      uiState.storageExpandedUsageIds = nextExpanded;
      renderStorageScreen();
    },
    onClearFilters: () => {
      uiState.storageSearchQuery = "";
      uiState.storageRarityFilter = "all";
      renderStorageScreen();
    }
  });
  uiState.storageSelectedMaterialId = result.selectedMaterialId;
  uiState.storageUsageFilter = result.usageFilter;
}

function syncSafeAreaUiFromSave() {
  uiState.safeAreaId = getCurrentSafeAreaId(saveData);
}

function activateSafeArea(safeAreaId, options = {}) {
  const { persist = true, allowUnvisited = false } = options;
  const previousSafeAreaId = getCurrentSafeAreaId(saveData);
  const previousSetting = saveData.settings?.currentSafeAreaId || previousSafeAreaId;
  setCurrentSafeArea(saveData, safeAreaId, { allowUnvisited });
  uiState.safeAreaId = safeAreaId;
  if (!persist || previousSafeAreaId === safeAreaId) {
    return true;
  }
  if (saveGameSafe()) {
    return true;
  }
  saveData.settings.currentSafeAreaId = previousSetting;
  uiState.safeAreaId = previousSafeAreaId;
  return false;
}

function travelToSafeArea(safeAreaId) {
  if (!canEnterSafeArea(saveData, safeAreaId)) {
    return false;
  }
  if (!activateSafeArea(safeAreaId)) {
    return false;
  }
  resetPreparationUiState();
  syncSelectionFromSave();
  showScreenInContext("campScreen", "camp");
  return true;
}

function getSafeAreaTravelDestinations(safeArea = getCurrentSafeArea()) {
  return getSafeAreaDefinitions().filter((destination) => (
    destination.id !== safeArea?.id
    && isSafeAreaUnlocked(saveData, destination.id)
  ));
}

function renderCampTravelButton(safeArea = getCurrentSafeArea()) {
  const destinations = getSafeAreaTravelDestinations(safeArea);
  const newLocationCount = destinations.filter((destination) => (
    !isSafeAreaVisited(saveData, destination.id)
  )).length;

  els.campTravelButton.hidden = destinations.length === 0;
  els.campTravelHint.textContent = "前往其他已解鎖的據點";
  els.campTravelBadge.hidden = newLocationCount === 0;
  els.campTravelBadge.textContent = newLocationCount > 1
    ? `${newLocationCount} 個新地點`
    : "新地點";

  if (newLocationCount > 0) {
    els.campTravelButton.dataset.newLocation = "true";
  } else {
    delete els.campTravelButton.dataset.newLocation;
  }
}

function showSafeAreaTravelScreen() {
  showScreenInContext("safeAreaTravelScreen", "camp");
}

function renderSafeAreaTravelScreen() {
  const currentSafeArea = getCurrentSafeArea();
  const destinations = getSafeAreaTravelDestinations(currentSafeArea);
  const hasLockedSafeArea = getSafeAreaDefinitions().some((safeArea) => (
    safeArea.id !== currentSafeArea?.id
    && !isSafeAreaUnlocked(saveData, safeArea.id)
  ));

  els.safeAreaTravelCurrentName.textContent = currentSafeArea?.name || "安全區";
  setReturnButton(els.safeAreaTravelBackButton, "campScreen");
  els.safeAreaTravelList.replaceChildren();
  els.safeAreaTravelEmpty.hidden = destinations.length > 0;
  els.safeAreaTravelUnknownHint.hidden = !hasLockedSafeArea;

  destinations.forEach((destination) => {
    const isNewLocation = !isSafeAreaVisited(saveData, destination.id);
    const button = document.createElement("button");
    button.className = "safe-area-travel-card";
    button.type = "button";
    button.dataset.safeAreaId = destination.id;
    if (isNewLocation) {
      button.dataset.newLocation = "true";
    }

    const heading = document.createElement("span");
    heading.className = "safe-area-travel-card-heading";
    const name = document.createElement("strong");
    name.textContent = destination.name;
    heading.append(name);

    if (isNewLocation) {
      const badge = document.createElement("span");
      badge.className = "safe-area-travel-card-badge";
      badge.textContent = "新地點";
      heading.append(badge);
    }

    const description = document.createElement("small");
    description.textContent = destination.travelDescription || `前往${destination.name}`;
    const action = document.createElement("b");
    action.textContent = isNewLocation ? "首次抵達" : `前往${destination.name}`;
    button.append(heading, description, action);
    els.safeAreaTravelList.append(button);
  });
}

function handleSafeAreaTravel(targetId) {
  const destination = getSafeAreaDefinition(targetId);
  if (!destination || targetId === getCurrentSafeArea()?.id || !isSafeAreaUnlocked(saveData, targetId)) {
    return false;
  }
  if (targetId === ANPING_TOWN_SAFE_AREA_ID && !isSafeAreaVisited(saveData, targetId)) {
    return showAnpingArrivalStory({ source: "safe-area-travel" });
  }
  return travelToSafeArea(targetId);
}

function getCurrentSafeArea() {
  return getSafeAreaDefinition(uiState.safeAreaId) || getSafeAreaDefinition(DEFAULT_SAFE_AREA_ID);
}

function getAvailableFacilities(safeArea = getCurrentSafeArea()) {
  const facilityIds = Array.isArray(safeArea?.facilityIds) ? safeArea.facilityIds : [];
  return facilityIds
    .map((facilityId) => getFacilityDefinition(facilityId))
    .filter(Boolean)
    .filter((facility) => facility.id !== "traveling-merchant" || hasPhoenixBlessing());
}

function showFacilityList(safeAreaId = uiState.safeAreaId, contextId = uiState.navigationContext) {
  const safeArea = getSafeAreaDefinition(safeAreaId);
  if (!safeArea) {
    throw new Error(`找不到安全區 definition：${safeAreaId || "(empty)"}`);
  }
  if (!isSafeAreaUnlocked(saveData, safeArea.id)) {
    throw new Error(`安全區尚未解鎖：${safeArea.id}`);
  }
  activateSafeArea(safeArea.id);
  setNavigationContext(contextId);
  uiState.facilityView = "list";
  merchantController.reset();
  blacksmithController.reset();
  showScreen("facilityScreen");
}

function showMerchantFacility() {
  uiState.facilityView = "merchant";
  merchantController.reset();
  showScreen("facilityScreen");
}

function showBlacksmithFacility() {
  uiState.facilityView = "blacksmith";
  blacksmithController.reset();
  showScreen("facilityScreen");
}

function openFacility(facility) {
  const handler = FACILITY_ACTION_HANDLERS[facility?.actionId];
  if (typeof handler !== "function") {
    throw new Error(`無法處理 Facility action：${facility?.actionId || "(empty)"}`);
  }
  handler();
}

function renderFacilityScreen() {
  const safeArea = getCurrentSafeArea();
  const facilities = getAvailableFacilities(safeArea);
  els.facilityListView.classList.toggle("is-active", uiState.facilityView === "list");
  els.merchantView.classList.toggle("is-active", uiState.facilityView === "merchant");
  els.blacksmithView.classList.toggle("is-active", uiState.facilityView === "blacksmith");

  if (uiState.facilityView === "list") {
    renderFacilityListView({
      els,
      safeArea,
      facilities,
      onFacilityClick: openFacility
    });
    return;
  }

  if (uiState.facilityView === "merchant") {
    merchantController.render();
    return;
  }
  blacksmithController.render();
}

function selectPreparation(preparationId) {
  const region = currentRegion();
  const preparation = getRegionPreparation(region, preparationId);
  if (preparationId && !preparation) {
    return;
  }

  const inventory = normalizeInventory(saveData.inventory);
  const affordable = !preparation || inventory.gold >= preparation.cost;
  const sameDetail = uiState.preparationDetailId === preparationId;
  if (affordable) {
    const selectionChanged = uiState.selectedPreparationId !== preparationId;
    uiState.selectedPreparationId = preparationId;
    if (selectionChanged) {
      uiState.enhancedPreparationId = null;
      uiState.preparationEnhancementRevealId = null;
    }
  }
  uiState.preparationDetailId = preparationId;
  uiState.preparationDetailExpanded = sameDetail
    ? !uiState.preparationDetailExpanded
    : true;
  uiState.runStartNotice = "";
  renderRegionScreen();
}

function togglePreparationEnhancement(preparationId) {
  const region = currentRegion();
  const preparation = getRegionPreparation(region, preparationId);
  if (!preparation || preparation.id !== uiState.selectedPreparationId) {
    uiState.runStartNotice = "請先選擇這項整備。";
    renderRegionScreen();
    return;
  }
  if (!preparation.enhancement) {
    uiState.runStartNotice = "目前整備沒有素材強化。";
    renderRegionScreen();
    return;
  }
  if (uiState.enhancedPreparationId === preparation.id) {
    uiState.enhancedPreparationId = null;
    uiState.preparationEnhancementRevealId = null;
    uiState.runStartNotice = "";
    renderRegionScreen();
    return;
  }

  const inventory = normalizeInventory(saveData.inventory);
  if (inventory.gold < preparation.cost) {
    uiState.runStartNotice = "金幣不足，無法使用目前整備。";
    renderRegionScreen();
    return;
  }
  const materialState = getEnhancementMaterialState({
    preparation,
    inventoryMaterials: inventory.materials,
    materialDefinitions
  });
  if (!materialState.available) {
    uiState.runStartNotice = "強化素材不足。";
    renderRegionScreen();
    return;
  }

  uiState.enhancedPreparationId = preparation.id;
  uiState.preparationEnhancementRevealId = preparation.id;
  uiState.runStartNotice = "";
  renderRegionScreen();
}

function renderPreparationRunCostPreview({ preparation, enhanced }) {
  const existing = els.regionDetailView.querySelector(".preparation-run-cost-preview");
  existing?.remove();
  if (!preparation || !enhanced || !preparation.enhancement) {
    return;
  }

  const preview = document.createElement("div");
  const gold = document.createElement("span");
  preview.className = "preparation-run-cost-preview";
  gold.textContent = `金幣 ${preparation.cost}`;
  preview.append(gold);
  preparation.enhancement.materialCosts.forEach((cost) => {
    const item = document.createElement("span");
    item.textContent = `${materialDefinitions[cost.materialId]?.name || cost.materialId} ×${cost.quantity}`;
    preview.append(item);
  });
  els.startButton.before(preview);
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
    preparationCost: null,
    rewards: createEmptyRewards()
  };
}

function resetAdventureRunRuntime(options = {}) {
  clearAnpingArrivalTimers();
  state.anpingArrivalContext = null;
  state.anpingArrivalInputLocked = false;
  resetAdventureRunState(state, options);
  clearEnemyGroup();
  clearPendingThreat();
  eventRuntime.resetEventRunState();
  resetRouteRuntime();
}

function initializeRunRuntime({ hero, preparation = null, encounterIndex = 0, debugBuildRun = false, bossId = null } = {}) {
  if (!hero) {
    throw new Error("Run runtime 初始化需要 Hero。");
  }

  resetAdventureRunRuntime();
  state.debugBuildRun = Boolean(debugBuildRun);
  state.run += 1;
  state.encounterIndex = encounterIndex;
  state.hero = hero;
  state.hero.fleesRemaining = RUN_STARTING_FLEES;
  state.selectedBoss = selectRunBoss(currentRegion(), bossId);
  state.phase = "danger";
  state.ended = false;
  state.defeatedEnemies = encounterIndex;
  state.runStats = createRunStats();
  state.runPreparation = preparation;
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
  return buildHeroFromProgressionCore(character, progress, {
    inventory: saveData.inventory,
    weaponDefinitions
  });
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

function captureRunStartPermanentState() {
  const regionId = state.selectedRegionId;
  const characterId = state.selectedHeroId;
  return {
    regionId,
    characterId,
    gold: saveData.inventory.gold,
    materials: clone(saveData.inventory.materials),
    totalRuns: saveData.statistics.totalRuns,
    regionRuns: saveData.statistics.regions[regionId].runs,
    characterRuns: saveData.statistics.characters[characterId].runs,
    characterProgressRuns: saveData.progression.characters[characterId].runs
  };
}

function restoreRunStartPermanentState(snapshot) {
  if (!snapshot) {
    return;
  }
  saveData.inventory.gold = snapshot.gold;
  saveData.inventory.materials = clone(snapshot.materials);
  saveData.statistics.totalRuns = snapshot.totalRuns;
  saveData.statistics.regions[snapshot.regionId].runs = snapshot.regionRuns;
  saveData.statistics.characters[snapshot.characterId].runs = snapshot.characterRuns;
  saveData.progression.characters[snapshot.characterId].runs = snapshot.characterProgressRuns;
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

  syncSafeAreaUnlocks(saveData);
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
  if (achievement.unlocked) {
    return false;
  }
  achievement.unlocked = true;
  achievement.unlockedAt = new Date().toISOString();
  saveData.achievements[achievementId] = achievement;
  return true;
}

function queueAchievementUnlock(achievementId) {
  if (!unlockAchievement(achievementId)) {
    return false;
  }
  state.pendingAchievementUnlocks.push(achievementId);
  uiState.achievementNewIds.add(achievementId);
  return true;
}

function renderStatistics() {
  setReturnButton(els.statisticsScreen.querySelector(".back-button"), getNavigationReturnTarget());
  const equippedWeaponsByCharacterId = Object.fromEntries(
    Object.entries(characterDefinitions).map(([characterId, character]) => [
      characterId,
      resolveEquippedWeapon({
        character,
        progress: getCharacterProgress(characterId),
        inventory: saveData.inventory,
        weaponDefinitions
      })
    ])
  );
  renderStatisticsView({
    els,
    uiState,
    saveData,
    characterDefinitions,
    regionDefinitions,
    equippedWeaponsByCharacterId,
    onCharacterSelect: showStatisticsCharacterDetail,
    onRegionSelect: showStatisticsRegionDetail
  });
}

function renderAchievementScreen() {
  setReturnButton(els.achievementScreen.querySelector(".back-button"), getNavigationReturnTarget());
  if (!saveData.storyFlags.achievementSystemUnlocked) {
    uiState.achievementDetailOpen = false;
    achievementDetailTrigger = null;
  }
  const result = renderAchievementView({
    els,
    definitions: achievementDefinitions,
    achievementState: saveData.achievements,
    systemUnlocked: saveData.storyFlags.achievementSystemUnlocked,
    filter: uiState.achievementFilter,
    selectedId: uiState.achievementSelectedId,
    newAchievementIds: uiState.achievementNewIds,
    detailOpen: uiState.achievementDetailOpen,
    regionDefinitions,
    getRouteName: (routeId) => getRouteDefinition(routeId)?.name || routeId,
    onFilterChange: (filter) => {
      uiState.achievementFilter = filter;
      uiState.achievementSelectedId = null;
      uiState.achievementDetailOpen = false;
      renderAchievementScreen();
    },
    onAchievementSelect: (achievementId, trigger) => {
      achievementDetailTrigger = trigger || null;
      uiState.achievementSelectedId = achievementId;
      uiState.achievementNewIds.delete(achievementId);
      uiState.achievementDetailOpen = window.matchMedia("(max-width: 760px)").matches;
      renderAchievementScreen();
    }
  });
  uiState.achievementFilter = result.filter;
  uiState.achievementSelectedId = result.selectedId;
}

function closeAchievementDetailPanel({ restoreFocus = true } = {}) {
  uiState.achievementDetailOpen = false;
  closeAchievementDetailView(els);
  if (restoreFocus && achievementDetailTrigger?.isConnected) {
    achievementDetailTrigger.focus();
  }
  achievementDetailTrigger = null;
}

function closeAchievementUnlockToast({ showNext = true } = {}) {
  if (state.achievementToastTimer) {
    window.clearTimeout(state.achievementToastTimer);
    state.achievementToastTimer = null;
  }
  state.activeAchievementToastId = null;
  renderAchievementUnlockToast({ els, definition: null });
  if (showNext && state.pendingAchievementUnlocks.length > 0) {
    window.setTimeout(flushAchievementUnlockQueue, 180);
  }
}

function flushAchievementUnlockQueue() {
  if (state.activeAchievementToastId || state.pendingAchievementUnlocks.length === 0) {
    return;
  }
  const achievementId = state.pendingAchievementUnlocks.shift();
  const definition = achievementDefinitions[achievementId];
  if (!definition) {
    flushAchievementUnlockQueue();
    return;
  }
  state.activeAchievementToastId = achievementId;
  renderAchievementUnlockToast({ els, definition });
  state.achievementToastTimer = window.setTimeout(
    () => closeAchievementUnlockToast(),
    ACHIEVEMENT_TOAST_DURATION_MS
  );
}

function resetAchievementUiRuntime() {
  if (state.achievementToastTimer) {
    window.clearTimeout(state.achievementToastTimer);
  }
  state.achievementToastTimer = null;
  state.activeAchievementToastId = null;
  state.pendingAchievementUnlocks = [];
  renderAchievementUnlockToast({ els, definition: null });
  uiState.achievementFilter = "all";
  uiState.achievementSelectedId = null;
  uiState.achievementNewIds = new Set();
  uiState.achievementDetailOpen = false;
  closeAchievementDetailPanel({ restoreFocus: false });
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
  button.textContent = target === "campScreen"
    ? `回${getCurrentSafeArea()?.name || "安全區"}`
    : "回主選單";
}

function showStatisticsCharacterDetail(characterId = DEFAULT_CHARACTER_ID) {
  uiState.statisticsCharacterId = characterId;
  uiState.statisticsView = "characters";
  renderStatistics();
}

function showStatisticsRegionDetail(regionId = DEFAULT_REGION_ID) {
  uiState.statisticsRegionId = regionId;
  uiState.statisticsView = "regions";
  renderStatistics();
}

function setSaveNotice(message, type = "status") {
  els.saveNotice.textContent = message;
  els.saveNotice.dataset.type = type;
}

function resetStatisticsUiAfterSaveReplacement() {
  uiState.statisticsView = "overview";
  uiState.statisticsCharacterId = saveData.settings.selectedCharacterId || DEFAULT_CHARACTER_ID;
  uiState.statisticsRegionId = saveData.settings.selectedRegionId || DEFAULT_REGION_ID;
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
  syncSafeAreaUiFromSave();
  pendingSaveCodeImport = null;
  resetAdventureRuntimeAfterSaveImport();
  syncSelectionFromSave();
  syncMusicSettingsFromSave();
  resetStatisticsUiAfterSaveReplacement();
  renderStatistics();
  closeImportSaveCodeDialog();
  setSaveNotice("存檔碼已匯入並轉換為目前版本。");
  els.resultLabel.textContent = "存檔已匯入";
  els.encounterLabel.textContent = "統計數據";
}

function resetAdventureRuntimeAfterSaveImport() {
  resetAdventureRunRuntime({ clearLastRunSummary: true });
  resetPreparationUiState();
  resetAchievementUiRuntime();
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

function deleteSave() {
  try {
    deleteStoredSave();
  } catch {
    // The in-memory reset still keeps the page usable if storage is blocked.
  }
  saveData = createDefaultSave();
  resetAchievementUiRuntime();
  syncSafeAreaUiFromSave();
  resetAdventureRunRuntime({ clearLastRunSummary: true });
  resetPreparationUiState();
  saveGameSafe();
  syncSelectionFromSave();
  syncMusicSettingsFromSave();
  resetStatisticsUiAfterSaveReplacement();
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

function beginRunPreparationBattle() {
  beginPreparationBattle(state.runPreparation);
}

function beginBattleRuntime(options = {}) {
  const {
    enemies = [],
    restoreEnemies = false,
    source = "main",
    encounterType = null,
    ambushAdvantage = false
  } = options;

  resetBattleEntryState(state, { source, encounterType, ambushAdvantage });
  setEnemyGroup(enemies, { restore: restoreEnemies });
  resetHeroBattleState();
  beginRunPreparationBattle();
  applyBattleStartSkills();
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

  state.activeRouteId = threat.activeRouteId || null;
  state.routeEncounterIndex = Math.max(0, Number(threat.routeEncounterIndex) || 0);
  state.encounterIndex = threat.encounterIndex;
  clearPendingThreat();
  beginBattleRuntime({
    enemies: restoredEnemies,
    restoreEnemies: true,
    source: threat.battleSource || "main",
    encounterType: threat.battleEncounterType || getAdventureEncounterType()
  });

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

function startPlayerRun() {
  if (uiState.runStartLocked) {
    return;
  }

  uiState.runStartLocked = true;
  uiState.runStartNotice = "";
  renderRegionScreen();
  let runStarted = false;
  let permanentMutationStarted = false;
  let permanentSnapshot = null;
  const navigationContextBeforeStart = uiState.navigationContext;

  try {
    syncSelectionFromSave();
    const region = currentRegion();
    const requestedPreparationId = hasPhoenixBlessing()
      ? uiState.selectedPreparationId
      : null;
    const definition = getRegionPreparation(region, requestedPreparationId);
    if (requestedPreparationId && !definition) {
      throw new Error("目前選擇的整備不屬於這個地區。");
    }
    if (definition && saveData.inventory.gold < definition.cost) {
      throw new Error("金幣不足，無法使用目前整備。");
    }
    const requestedEnhanced = Boolean(
      definition
      && uiState.enhancedPreparationId === definition.id
    );
    if (requestedEnhanced && !definition.enhancement) {
      throw new Error("目前整備沒有素材強化。");
    }

    permanentSnapshot = captureRunStartPermanentState();
    const preparation = createRunPreparation(region, requestedPreparationId, {
      enhanced: requestedEnhanced
    });
    const hero = buildHeroFromProgression(state.selectedHeroId);
    const runOriginSafeAreaId = getCurrentSafeAreaId(saveData);
    initializeRunRuntime({ hero, preparation });
    state.runOriginSafeAreaId = runOriginSafeAreaId;
    state.eventSchedule = scheduleRegionEvent(currentAdventureSource(), Math.random, {
      scheduleChance: getAdventureEventScheduleChance()
    });

    permanentMutationStarted = true;
    if (preparation) {
      const spentCost = spendInventoryCost({
        inventory: saveData.inventory,
        materialDefinitions,
        goldCost: preparation.cost,
        materialCosts: requestedEnhanced ? definition.enhancement.materialCosts : []
      });
      state.runStats.preparationCost = {
        gold: spentCost.goldCost,
        materials: spentCost.materialCosts.map((cost) => ({
          materialId: cost.materialId,
          name: cost.name,
          quantity: cost.quantity
        }))
      };
    }
    recordRunStarted();

    closeTransientUiPanels();
    els.nextButton.disabled = false;
    startEncounter();
    showScreen("gameScreen");
    runStarted = true;
  } catch (error) {
    if (permanentMutationStarted) {
      restoreRunStartPermanentState(permanentSnapshot);
      saveGameSafe();
    }
    resetFailedPlayerRunStart();
    setNavigationContext(navigationContextBeforeStart);
    uiState.runStartLocked = false;
    uiState.runStartNotice = error instanceof Error ? error.message : "無法開始這次冒險。";
    showScreen("regionScreen");
  } finally {
    if (!runStarted) {
      uiState.runStartLocked = false;
    }
  }
}

function resetFailedPlayerRunStart() {
  resetAdventureRunRuntime();
  setCombatActionState();
}

function getAdventureEventScheduleChance() {
  if (state.selectedRegionId === "forest" && !saveData.storyFlags.archerRescued) {
    return 0.5;
  }
  return undefined;
}

function restart() {
  resetAdventureRunRuntime();
  resetPreparationUiState();
  syncSelectionFromSave();
  closeTransientUiPanels();
  showScreen("menuScreen");
  els.nextButton.disabled = true;
  setCombatActionState();
  els.resultLabel.textContent = "冒險準備中";
  els.encounterLabel.textContent = "尚未開始";
  els.battleLogTitle.textContent = "戰鬥紀錄";
}

function returnToSafeArea(safeAreaId) {
  const targetSafeAreaId = canEnterSafeArea(saveData, safeAreaId)
    ? safeAreaId
    : DEFAULT_SAFE_AREA_ID;
  if (!activateSafeArea(targetSafeAreaId)) {
    return false;
  }
  resetAdventureRunRuntime();
  resetPreparationUiState();
  syncSelectionFromSave();
  closeTransientUiPanels();
  showScreenInContext("campScreen", "camp");
  setCombatActionState();
  window.requestAnimationFrame(flushAchievementUnlockQueue);
  return true;
}

function returnToRunOriginSafeArea() {
  const originSafeAreaId = state.runOriginSafeAreaId;
  return returnToSafeArea(originSafeAreaId);
}

function returnToCamp() {
  return returnToSafeArea(DEFAULT_SAFE_AREA_ID);
}

function handleEndPrimaryAction() {
  if (state.pendingAnpingArrival) {
    els.endPanel.classList.remove("is-visible");
    showAnpingArrivalStory({ source: "forest-clear" });
    return;
  }
  returnToRunOriginSafeArea();
}

function startEncounter() {
  const region = currentRegion();
  const route = currentRoute();
  const encounterEntry = getAdventureEncounterEntry();
  const encounterType = getAdventureEncounterType();
  state.adventureProgressLocked = false;
  state.eventInputLocked = false;
  showCombatLayout(els);
  applySceneContext("gameScreen");

  let battleEnemies;
  let restoreEnemies = false;
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
    battleEnemies = createRuntimeEnemyGroup(entries);
    restoreEnemies = true;
  } else {
    const enemy = buildEnemy(region, state.encounterIndex, state.hero, { boss: state.selectedBoss });
    enemy.poison = 0;
    battleEnemies = [enemy];
  }

  beginBattleRuntime({
    enemies: battleEnemies,
    restoreEnemies,
    source: "main",
    encounterType
  });

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
  const heroEntangled = resolveHeroEntangle({
    hero: state.hero,
    log,
    retryOnFailure: () => consumeEntangleRetryFromPreparation(log),
    onRetryResult: ({ success }) => recordPreparationEntangleRetryResult({
      preparation: state.runPreparation,
      success
    })
  });
  if (!heroEntangled) {
    const target = currentTargetEnemy();
    if (!target) {
      return;
    }
    runHeroPlayerAction({ target, log });
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
      modifyDirectDamage: modifyIncomingDirectDamage
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

  const endOfTurn = applyHeroEndOfTurnNegativeEffects({
    hero: state.hero,
    log,
    modifyPoisonDamage: ({ damage }) => modifyPoisonDamageFromPreparation(damage)
  });
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

function runHeroPlayerAction({ target, log }) {
  return runPreparationOpeningAction({
    preparation: state.runPreparation,
    hero: state.hero,
    encounterType: state.battleEncounterType,
    onTrigger: ({ attackBonus }) => {
      const preparationName = state.runPreparation?.name || "冒險整備";
      log.fixed("status", `整備｜${preparationName}讓這次出手更有威力，攻擊提高 ${attackBonus} 點。`);
    },
    action: () => {
      const characterAction = resolveCharacterPlayerAction({
        hero: state.hero,
        enemies: state.enemies,
        targetEnemyId: state.targetEnemyId,
        log
      });
      if (!characterAction.handled) {
        resolveHeroAction({ hero: state.hero, enemy: target, log });
      }
      return characterAction;
    }
  });
}

function modifyIncomingDirectDamage(context) {
  const characterModifiedDamage = modifyCharacterIncomingDirectDamage(context);
  const result = resolvePreparationIncomingDirectDamage({
    preparation: state.runPreparation,
    enemy: context.enemy,
    damage: characterModifiedDamage
  });
  if (result.triggered) {
    const preparationName = state.runPreparation?.name || "冒險整備";
    context.log.fixed("status", `整備｜${preparationName}減輕了這次攻勢，少受到 ${result.preventedDamage} 點傷害。`);
  }
  return result.damage;
}

function consumeEntangleRetryFromPreparation(log) {
  const consumed = consumePreparationEntangleRetry(state.runPreparation);
  if (consumed) {
    const preparationName = state.runPreparation?.name || "冒險整備";
    log.fixed("status", `整備｜${preparationName}割開纏絲，再次嘗試掙脫。`);
  }
  return consumed;
}

function modifyPoisonDamageFromPreparation(damage) {
  const result = resolvePreparationPoisonDamage({
    preparation: state.runPreparation,
    damage
  });
  if (result.triggered) {
    const preparationName = state.runPreparation?.name || "冒險整備";
    addFixedLog("status", `整備｜${preparationName}減輕毒性侵蝕，少受到 ${result.preventedDamage} 點傷害。`);
  }
  return result.damage;
}

function resolvePostEncounterRunPreparation({ isFinalEncounter = false } = {}) {
  const result = resolvePostEncounterPreparation({
    preparation: state.runPreparation,
    hero: state.hero,
    isFinalEncounter
  });
  if (result.triggered) {
    const preparationName = state.runPreparation?.name || "冒險整備";
    addFixedLog("heal", `整備｜${preparationName}發揮作用，恢復 ${result.healing} 點生命。`);
  }
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

  const adventureComplete = getAdventureEncounterIndex() >= getAdventureEncounterCount();
  resolvePostEncounterRunPreparation({ isFinalEncounter: adventureComplete });
  render();

  if (adventureComplete) {
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

  let endingKey = "ending";
  if (!state.debugBuildRun) {
    const archerProgress = saveData.progression.characters.archer;
    const archerAlreadyRescued = Boolean(
      saveData.storyFlags.archerRescued || archerProgress?.unlocked
    );
    const unlockedArcher = Boolean(archerProgress && !archerProgress.unlocked);
    endingKey = archerAlreadyRescued ? "repeatEnding" : "ending";
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
  showRouteEnding(route, { endingKey });
}

function showRouteEnding(route = currentRoute(), options = {}) {
  const requestedEndingKey = options.endingKey || "ending";
  const endingKey = route?.[requestedEndingKey]?.pages?.length ? requestedEndingKey : "ending";
  const ending = route?.[endingKey];
  if (!ending?.pages?.length) {
    finishRun("clear");
    return;
  }

  state.ended = true;
  state.awaitingBlessing = false;
  state.phase = "routeEnding";
  state.routeEndingContext = { routeId: route.id, endingKey, pageIndex: 0 };
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
  const endingKey = state.routeEndingContext?.endingKey || "ending";
  const route = getRouteDefinition(routeId);
  return route?.[endingKey] || route?.ending || null;
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

function shouldOfferAnpingArrivalAfterRun(outcome) {
  return !state.debugBuildRun
    && outcome === "clear"
    && state.selectedRegionId === "forest"
    && !currentRoute()
    && isSafeAreaUnlocked(saveData, ANPING_TOWN_SAFE_AREA_ID)
    && !isSafeAreaVisited(saveData, ANPING_TOWN_SAFE_AREA_ID);
}

function getRunOriginSafeAreaName() {
  return getSafeAreaDefinition(state.runOriginSafeAreaId)?.name
    || getSafeAreaDefinition(DEFAULT_SAFE_AREA_ID)?.name
    || "安全區";
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
  state.pendingAnpingArrival = shouldOfferAnpingArrivalAfterRun(outcome);
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
  els.retryButton.textContent = state.pendingAnpingArrival
    ? "繼續前行"
    : `回到${getRunOriginSafeAreaName()}`;
  els.resultLabel.textContent = cleared
    ? `${getAdventureSourceName()}突破`
    : evacuated
      ? "撤離成功"
      : retreated
        ? "返回據點"
        : "本輪結束";
  render();
  if (!state.pendingAnpingArrival) {
    window.requestAnimationFrame(flushAchievementUnlockQueue);
  }
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
      return `你在追擊中找到返回${getRunOriginSafeAreaName()}的路線，結束了這輪冒險。本輪的臨時祝福會重置，角色等級與經驗會保留。`;
    }
    return `你回到${getRunOriginSafeAreaName()}。本輪的臨時祝福會重置，角色等級與經驗會保留。`;
  }
  if (hasPhoenixBlessing()) {
    return `你倒下了。鳳凰的加護在灰燼般的微光中甦醒，將你帶回${getRunOriginSafeAreaName()}。`;
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

  if (hasPhoenixBlessing()) {
    const preparationSummary = getPreparationSummary(state.runPreparation);
    items.push(["冒險整備", preparationSummary?.name || "無"]);
    if (preparationSummary) {
      items.push(["整備發動", `${preparationSummary.triggerCount} 次`]);
      if (preparationSummary.healing > 0) {
        items.push(["整備治療", preparationSummary.healing]);
      }
      if (preparationSummary.damagePrevented > 0) {
        items.push(["整備減傷", preparationSummary.damagePrevented]);
      }
      if (preparationSummary.retrySuccessCount > 0) {
        items.push(["額外掙脫成功", `${preparationSummary.retrySuccessCount} 次`]);
      }
    }
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
  state.blessingInputLocked = true;
  state.awaitingBlessing = true;
  els.nextButton.disabled = true;
  els.blessingPanel.classList.add("is-visible");
  els.resultLabel.textContent = "選擇祝福";
  renderBlessingChoices(
    els.blessingChoices,
    getBlessingChoices(count, poolId),
    chooseBlessing,
    {
      reveal: true,
      onRevealComplete: () => {
        state.blessingInputLocked = false;
      }
    }
  );
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
    modifyDirectDamage: modifyIncomingDirectDamage
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
  const counterEnemy = buildCounterEnemy(currentRegion(), state.encounterIndex);
  counterEnemy.poison = 0;
  beginBattleRuntime({
    enemies: [counterEnemy],
    source: "counterEscape",
    encounterType: "counter",
    ambushAdvantage: true
  });
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
  if (state.blessingInputLocked) {
    return;
  }
  state.blessingInputLocked = true;
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

function clearAnpingArrivalTimers() {
  state.anpingArrivalTimerIds.forEach((timerId) => window.clearTimeout(timerId));
  state.anpingArrivalTimerIds = [];
}

function queueAnpingArrivalTimer(callback, delayMs) {
  const timerId = window.setTimeout(() => {
    state.anpingArrivalTimerIds = state.anpingArrivalTimerIds.filter((id) => id !== timerId);
    callback();
  }, delayMs);
  state.anpingArrivalTimerIds.push(timerId);
  return timerId;
}

function closeAnpingArrivalPanel() {
  clearAnpingArrivalTimers();
  state.anpingArrivalContext = null;
  state.anpingArrivalInputLocked = false;
  els.anpingArrivalPanel.classList.remove("is-visible");
  els.anpingArrivalLocation.classList.remove("is-visible");
  els.anpingArrivalLocation.hidden = true;
  els.continueAnpingArrivalButton.disabled = false;
}

function showAnpingArrivalStory(options = {}) {
  if (
    !isSafeAreaUnlocked(saveData, ANPING_TOWN_SAFE_AREA_ID)
    || isSafeAreaVisited(saveData, ANPING_TOWN_SAFE_AREA_ID)
  ) {
    return false;
  }

  setNavigationContext("story");
  state.anpingArrivalContext = {
    pageIndex: 0,
    source: options.source || "safe-area-travel"
  };
  state.anpingArrivalInputLocked = false;
  clearAnpingArrivalTimers();
  els.endPanel.classList.remove("is-visible");
  els.storyPanel.classList.remove("is-visible");
  closeAbilityInfoPanel();
  closeBlessingInfoPanel();
  els.anpingArrivalPanel.classList.add("is-visible");
  els.resultLabel.textContent = "旅途的延續";
  els.encounterLabel.textContent = "森林道路盡頭";
  musicManager.preloadTrack("anping-town");
  void musicManager.requestTrack(null);
  void ambientManager.requestTrack("anping-coast");
  renderAnpingArrivalPage(false);
  return true;
}

function renderAnpingArrivalPage(revealed = false) {
  const pageIndex = state.anpingArrivalContext?.pageIndex ?? 0;
  const page = ANPING_ARRIVAL_PAGES[pageIndex];
  if (!page) {
    return;
  }

  clearAnpingArrivalTimers();
  els.anpingArrivalDialog.dataset.stage = page.key;
  els.anpingArrivalEyebrow.textContent = page.eyebrow;
  els.anpingArrivalTitle.textContent = page.title;
  els.anpingArrivalCounter.textContent = `${pageIndex + 1} / ${ANPING_ARRIVAL_PAGES.length}`;
  els.anpingArrivalProgress.forEach((item, index) => {
    item.classList.toggle("is-active", index <= pageIndex);
  });
  els.anpingArrivalUnlock.hidden = page.key !== "history";
  els.anpingArrivalUnlock.textContent = "安平鎮已解鎖";
  els.continueAnpingArrivalButton.textContent = page.key === "history" ? "進入安平鎮" : "繼續";
  els.continueAnpingArrivalButton.disabled = false;
  els.anpingArrivalLocation.classList.remove("is-visible");
  els.anpingArrivalLocation.hidden = true;

  renderAnpingArrivalText(revealed);

  if (page.key === "town") {
    void musicManager.requestTrack("anping-town");
    queueAnpingArrivalTimer(() => {
      els.anpingArrivalLocation.hidden = false;
      window.requestAnimationFrame(() => els.anpingArrivalLocation.classList.add("is-visible"));
    }, ANPING_ARRIVAL_TIMING.locationDelayMs);
    queueAnpingArrivalTimer(() => {
      els.anpingArrivalLocation.classList.remove("is-visible");
    }, ANPING_ARRIVAL_TIMING.locationHideDelayMs);
  } else if (page.key === "history") {
    void musicManager.requestTrack("anping-town");
  }
}

function renderAnpingArrivalText(revealed = false) {
  const pageIndex = state.anpingArrivalContext?.pageIndex ?? 0;
  const page = ANPING_ARRIVAL_PAGES[pageIndex];
  if (!page) {
    return;
  }

  els.anpingArrivalText.replaceChildren();
  page.lines.forEach((line, index) => {
    const paragraph = document.createElement("p");
    paragraph.textContent = line;
    paragraph.style.animationDelay = revealed ? "0ms" : `${index * ANPING_ARRIVAL_TIMING.lineDelayMs}ms`;
    if (revealed) {
      paragraph.classList.add("is-revealed");
    }
    els.anpingArrivalText.append(paragraph);
  });

  els.revealAnpingArrivalButton.hidden = revealed;
  els.continueAnpingArrivalButton.hidden = !revealed;
  if (!revealed) {
    queueAnpingArrivalTimer(() => {
      els.revealAnpingArrivalButton.hidden = true;
      els.continueAnpingArrivalButton.hidden = false;
    }, Math.max(0, page.lines.length - 1) * ANPING_ARRIVAL_TIMING.lineDelayMs + ANPING_ARRIVAL_TIMING.finishExtraDelayMs);
  }
}

function revealAnpingArrivalPage() {
  clearAnpingArrivalTimers();
  renderAnpingArrivalText(true);
  const page = ANPING_ARRIVAL_PAGES[state.anpingArrivalContext?.pageIndex ?? 0];
  if (page?.key === "town") {
    els.anpingArrivalLocation.hidden = false;
    els.anpingArrivalLocation.classList.add("is-visible");
  }
}

function continueAnpingArrivalStory() {
  if (!state.anpingArrivalContext || state.anpingArrivalInputLocked) {
    return;
  }
  state.anpingArrivalInputLocked = true;
  els.continueAnpingArrivalButton.disabled = true;
  const pageIndex = state.anpingArrivalContext.pageIndex;
  if (pageIndex >= ANPING_ARRIVAL_PAGES.length - 1) {
    completeAnpingArrivalStory();
    return;
  }
  state.anpingArrivalContext.pageIndex += 1;
  renderAnpingArrivalPage(false);
  queueAnpingArrivalTimer(() => {
    if (state.anpingArrivalInputLocked === true) {
      state.anpingArrivalInputLocked = false;
      els.continueAnpingArrivalButton.disabled = false;
    }
  }, ANPING_ARRIVAL_TIMING.inputUnlockDelayMs);
}

function completeAnpingArrivalStory() {
  if (!state.anpingArrivalContext || state.anpingArrivalInputLocked === "saving") {
    return false;
  }

  state.anpingArrivalInputLocked = "saving";
  els.continueAnpingArrivalButton.disabled = true;
  els.continueAnpingArrivalButton.textContent = "進入中…";
  const previousSafeAreaProgress = clone(saveData.progression.safeAreas[ANPING_TOWN_SAFE_AREA_ID]);
  const previousCurrentSafeAreaId = saveData.settings.currentSafeAreaId;
  const previousUiSafeAreaId = uiState.safeAreaId;

  markSafeAreaVisited(saveData, ANPING_TOWN_SAFE_AREA_ID);
  setCurrentSafeArea(saveData, ANPING_TOWN_SAFE_AREA_ID);
  uiState.safeAreaId = ANPING_TOWN_SAFE_AREA_ID;

  if (!saveGameSafe()) {
    saveData.progression.safeAreas[ANPING_TOWN_SAFE_AREA_ID] = previousSafeAreaProgress;
    saveData.settings.currentSafeAreaId = previousCurrentSafeAreaId;
    uiState.safeAreaId = previousUiSafeAreaId;
    state.anpingArrivalInputLocked = false;
    els.continueAnpingArrivalButton.disabled = false;
    els.continueAnpingArrivalButton.textContent = "重新嘗試進入安平鎮";
    els.anpingArrivalUnlock.hidden = false;
    els.anpingArrivalUnlock.textContent = "瀏覽器無法保存目前進度，請重新嘗試。";
    return false;
  }

  state.pendingAnpingArrival = false;
  closeAnpingArrivalPanel();
  returnToSafeArea(ANPING_TOWN_SAFE_AREA_ID);
  return true;
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
  closeLockedCharacterHint();
  closeAchievementDetailPanel({ restoreFocus: false });
  merchantController.closeSaleDialog();
  blacksmithController.closeCraftDialog();
  closeExportSaveCodeDialog();
  closeImportSaveCodeDialog();
  closeAbilityInfoPanel();
  closeBlessingInfoPanel();
  closeStoryPanel();
  closeAnpingArrivalPanel();
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
    queueAchievementUnlock(FOREST_TRIAL_ACHIEVEMENT_ID);
    if (routeId === "goblin-camp") {
      queueAchievementUnlock(GOBLIN_CAMP_CLEAR_ACHIEVEMENT_ID);
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
  els.finishStoryButton.textContent = `回到${getRunOriginSafeAreaName()}`;
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
  returnToRunOriginSafeArea();
}

function unlockPhoenixBlessing() {
  saveData.storyFlags.phoenixBlessingUnlocked = true;
  saveData.storyFlags.plainsBossStorySeen = true;
  saveData.storyFlags.achievementSystemUnlocked = true;
  queueAchievementUnlock(PLAINS_TRIAL_ACHIEVEMENT_ID);
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
    preparationStatus: getPreparationCombatStatus({
      preparation: state.runPreparation,
      encounterType: state.battleEncounterType,
      enemies: state.enemies
    }),
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
  return saveGame(saveData, {
    onError: () => {
      if (state.hero) {
        addFixedLog("system", "瀏覽器無法保存目前進度。");
      }
    }
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
  els.campStartButton.addEventListener("click", () => {
    setNavigationContext("camp");
    showRegionDetail(state.selectedRegionId);
  });
  els.campRegionButton.addEventListener("click", () => showRegionList("camp"));
  els.campCharacterButton.addEventListener("click", () => showCharacterList("camp"));
  els.campRecordButton.addEventListener("click", () => showStatisticsScreen("camp"));
  els.campStorageButton.addEventListener("click", () => showScreenInContext("storageScreen", "camp"));
  els.campPlacesButton.addEventListener("click", () => {
    if (!els.campPlacesButton.disabled) {
      showFacilityList(uiState.safeAreaId, "camp");
    }
  });
  els.campTravelButton.addEventListener("click", showSafeAreaTravelScreen);
  els.safeAreaTravelList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-safe-area-id]");
    if (button && els.safeAreaTravelList.contains(button)) {
      handleSafeAreaTravel(button.dataset.safeAreaId);
    }
  });
  els.safeAreaTravelBackButton.addEventListener("click", () => showScreen("campScreen"));
  els.campBackButton.addEventListener("click", restart);
  els.storageBackButton.addEventListener("click", () => showScreen(getNavigationReturnTarget()));
  els.facilityBackButton.addEventListener("click", () => showScreen(getNavigationReturnTarget()));
  els.merchantBackButton.addEventListener("click", () => showFacilityList(uiState.safeAreaId, uiState.navigationContext));
  els.blacksmithBackButton.addEventListener("click", () => showFacilityList(uiState.safeAreaId, uiState.navigationContext));
  els.backToRegionListButton.addEventListener("click", () => showRegionList());
  els.backToCharacterListButton.addEventListener("click", () => showCharacterList());
  els.backToCharacterDetailButton.addEventListener("click", () => showCharacterDetail(uiState.characterDetailId));
  els.openCharacterEquipmentButton.addEventListener("click", () => showCharacterEquipment(uiState.characterDetailId));
  els.characterSkillSearchInput.addEventListener("input", () => {
    uiState.characterSkillSearchQuery = els.characterSkillSearchInput.value;
    renderCharacterScreen();
  });
  els.characterSkillTypeSelect.addEventListener("change", () => {
    uiState.characterSkillTypeFilter = els.characterSkillTypeSelect.value;
    renderCharacterScreen();
  });
  els.characterSkillStageFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-stage-filter]");
    if (!button || !els.characterSkillStageFilters.contains(button)) {
      return;
    }
    uiState.characterSkillStageFilter = button.dataset.stageFilter || "all";
    renderCharacterScreen();
  });
  els.statisticsTabs.forEach((button) => {
    button.addEventListener("click", () => showStatisticsView(button.dataset.statisticsView));
  });
  els.selectCharacterButton.addEventListener("click", selectCharacterFromDetail);
  els.closeCharacterLockedButton.addEventListener("click", closeLockedCharacterHint);
  document.querySelectorAll(".back-button").forEach((button) => {
    button.addEventListener("click", () => showScreen(button.dataset.target));
  });
  document.querySelectorAll(".home-button").forEach((button) => {
    button.addEventListener("click", restart);
  });
  els.startButton.addEventListener("click", startPlayerRun);
  els.restartButton.addEventListener("click", restart);
  els.retryButton.addEventListener("click", handleEndPrimaryAction);
  els.viewLogButton.addEventListener("click", closeEndPanel);
  els.revealStoryButton.addEventListener("click", revealStoryText);
  els.finishStoryButton.addEventListener("click", completePlainsStory);
  els.revealAnpingArrivalButton.addEventListener("click", revealAnpingArrivalPage);
  els.continueAnpingArrivalButton.addEventListener("click", continueAnpingArrivalStory);
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
  els.closeAchievementDetailButton.addEventListener("click", closeAchievementDetailPanel);
  els.achievementDetailBackdrop.addEventListener("click", closeAchievementDetailPanel);
  els.closeAchievementUnlockToastButton.addEventListener("click", () => closeAchievementUnlockToast());
  els.closeMerchantSaleButton.addEventListener("click", merchantController.closeSaleDialog);
  els.closeBlacksmithCraftButton.addEventListener("click", blacksmithController.closeCraftDialog);
  [
    [els.merchantSalePanel, merchantController.closeSaleDialog],
    [els.blacksmithCraftPanel, blacksmithController.closeCraftDialog],
    [els.abilityInfoPanel, closeAbilityInfoPanel],
    [els.blessingInfoPanel, closeBlessingInfoPanel],
    [els.exportSaveCodePanel, closeExportSaveCodeDialog],
    [els.importSaveCodePanel, closeImportSaveCodeDialog]
  ].forEach(([panel, closePanel]) => bindBackdropClose(panel, closePanel));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && uiState.achievementDetailOpen) {
      closeAchievementDetailPanel();
    }
  });
  document.addEventListener("click", () => {
    void musicManager.handleUserInteraction();
    void ambientManager.handleUserInteraction();
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
  beginBattleRuntime,
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
    resetAchievementUiRuntime();
    syncSafeAreaUiFromSave();
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
  beginBattleRuntime,
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
  returnToSafeArea,
  showAnpingArrivalStory,
  showSafeAreaTravelScreen,
  syncSafeAreaUiFromSave,
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
