import { resetAdventureRunState } from "../../adventure/runLifecycle.js";
import { spendInventoryCost } from "../../core/commerce.js";
import { createRunPreparation, getRegionPreparation } from "../../core/preparations.js";
import { createEmptyRewards } from "../../core/rewards.js";
import { canEnterSafeArea, getCurrentSafeAreaId } from "../../core/safeAreaProgression.js";
import { scheduleRegionEvent } from "../../core/events.js";
import { DEFAULT_SAFE_AREA_ID } from "../../data/safeAreas.js";
import { getRouteDefinition } from "../../data/routes/index.js";
import { showCombatLayout } from "../../ui/eventView.js";
import { clone } from "../../utils.js";
import {
  captureAdventureRouteState,
  createAdventureRouteHandoff,
  createBeachSegmentCheckpoint,
  restoreAdventureRouteState
} from "../../adventure/coastSegment.js";

export function createRunLifecycleController({
  state,
  uiState,
  saveStore,
  els,
  windowRef = window,
  materialDefinitions,
  runStartingFlees,
  currentRegion,
  currentRoute,
  currentAdventureSource,
  getRouteBossDefinition,
  resetRouteRuntime,
  clearEnemyGroup,
  clearPendingThreat,
  getEventRuntime,
  clearAnpingArrivalTimers,
  selectRunBoss,
  recordSelectedBossInRunStats,
  recordBeachSegmentCompleted,
  buildHeroFromProgression,
  hasPhoenixBlessing,
  captureRunStartPermanentState,
  restoreRunStartPermanentState,
  recordRunStarted,
  saveGameSafe,
  syncSelectionFromSave,
  resetPreparationUiState,
  resetFacilityUiState,
  activateSafeArea,
  setNavigationContext,
  showScreen,
  showScreenInContext,
  renderRegionScreen,
  closeTransientUiPanels,
  setCombatActionState,
  render,
  showBeachSegmentChoice,
  flushAchievementUnlockQueue,
  showAnpingArrivalStory,
  applySceneContext,
  startEncounter
}) {
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
    getEventRuntime()?.resetEventRunState();
    resetRouteRuntime();
  }

  function initializeRunRuntime({
    hero,
    preparation = null,
    encounterIndex = 0,
    debugBuildRun = false,
    bossId = null
  } = {}) {
    if (!hero) {
      throw new Error("Run runtime 初始化需要 Hero。");
    }

    resetAdventureRunRuntime();
    state.debugBuildRun = Boolean(debugBuildRun);
    state.run += 1;
    state.encounterIndex = encounterIndex;
    state.hero = hero;
    state.hero.fleesRemaining = runStartingFlees;
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

  function enterAdventureRoute(routeId) {
    const route = getRouteDefinition(routeId);
    const handoff = createAdventureRouteHandoff({ state, route });
    const snapshot = captureAdventureRouteState(state);

    try {
      state.activeRouteId = handoff.routeId;
      state.routeEncounterIndex = handoff.routeEncounterIndex;
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
      return handoff;
    } catch (error) {
      restoreAdventureRouteState(state, snapshot);
      setCombatActionState();
      renderAfterRouteStateChange();
      throw error;
    }
  }

  function openBeachSegmentCheckpoint() {
    const checkpoint = createBeachSegmentCheckpoint({
      state,
      encounterCount: currentRegion().encounterCount
    });
    const existingCheckpoint = state.coastSegmentCheckpoint;
    const isSameCheckpoint = existingCheckpoint
      && existingCheckpoint.run === checkpoint.run
      && existingCheckpoint.regionId === checkpoint.regionId
      && existingCheckpoint.encounterIndex === checkpoint.encounterIndex
      && existingCheckpoint.routeEncounterIndex === checkpoint.routeEncounterIndex
      && existingCheckpoint.activeRouteId === checkpoint.activeRouteId;
    if (isSameCheckpoint && state.phase === "segmentChoice" && !state.ended) {
      return clone(existingCheckpoint);
    }

    recordBeachSegmentCompleted?.();
    clearEnemyGroup();
    clearPendingThreat();
    state.coastSegmentCheckpoint = checkpoint;
    state.ended = false;
    state.phase = "segmentChoice";
    state.awaitingBlessing = false;
    state.blessingContext = "normal";
    state.blessingPoolOverrideId = null;
    state.blessingInputLocked = false;
    state.eventInputLocked = false;
    state.adventureProgressLocked = true;
    state.routeEndingContext = null;
    state.campSelection = null;
    renderAfterRouteStateChange();
    showBeachSegmentChoice?.();
    return clone(checkpoint);
  }

  function getCoastSegmentCheckpoint() {
    return state.coastSegmentCheckpoint ? clone(state.coastSegmentCheckpoint) : null;
  }

  function renderAfterRouteStateChange() {
    try {
      render();
    } catch {
      // Preserve the original Route error; UI recovery must not mask it.
    }
  }

  function startPlayerRun() {
    if (uiState.runStartLocked) return;

    uiState.runStartLocked = true;
    uiState.runStartNotice = "";
    renderRegionScreen();
    let runStarted = false;
    let permanentMutationStarted = false;
    let permanentSnapshot = null;
    const navigationContextBeforeStart = uiState.navigationContext;

    try {
      const startContext = prepareRunStart();
      permanentSnapshot = captureRunStartPermanentState();
      initializeRunRuntime({ hero: startContext.hero, preparation: startContext.preparation });
      state.runOriginSafeAreaId = startContext.runOriginSafeAreaId;
      state.eventSchedule = scheduleRegionEvent(currentAdventureSource(), Math.random, {
        scheduleChance: getAdventureEventScheduleChance()
      });

      permanentMutationStarted = true;
      spendPreparationCost(startContext);
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

  function prepareRunStart() {
    syncSelectionFromSave();
    const region = currentRegion();
    const requestedPreparationId = hasPhoenixBlessing()
      ? uiState.selectedPreparationId
      : null;
    const definition = getRegionPreparation(region, requestedPreparationId);
    if (requestedPreparationId && !definition) {
      throw new Error("目前選擇的整備不屬於這個地區。");
    }
    if (definition && saveStore.current.inventory.gold < definition.cost) {
      throw new Error("金幣不足，無法使用目前整備。");
    }
    const requestedEnhanced = Boolean(definition && uiState.enhancedPreparationId === definition.id);
    if (requestedEnhanced && !definition.enhancement) {
      throw new Error("目前整備沒有素材強化。");
    }
    return {
      definition,
      requestedEnhanced,
      preparation: createRunPreparation(region, requestedPreparationId, { enhanced: requestedEnhanced }),
      hero: buildHeroFromProgression(state.selectedHeroId),
      runOriginSafeAreaId: getCurrentSafeAreaId(saveStore.current)
    };
  }

  function spendPreparationCost({ definition, requestedEnhanced, preparation }) {
    if (!preparation) return;
    const spentCost = spendInventoryCost({
      inventory: saveStore.current.inventory,
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

  function resetFailedPlayerRunStart() {
    resetAdventureRunRuntime();
    setCombatActionState();
  }

  function getAdventureEventScheduleChance() {
    if (state.selectedRegionId === "forest" && !saveStore.current.storyFlags.archerRescued) {
      return 0.5;
    }
    return undefined;
  }

  function restart() {
    resetAdventureRunRuntime();
    resetPreparationUiState();
    resetFacilityUiState();
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
    const targetSafeAreaId = canEnterSafeArea(saveStore.current, safeAreaId)
      ? safeAreaId
      : DEFAULT_SAFE_AREA_ID;
    if (!activateSafeArea(targetSafeAreaId)) return false;

    resetAdventureRunRuntime();
    resetPreparationUiState();
    syncSelectionFromSave();
    closeTransientUiPanels();
    showScreenInContext("campScreen", "camp");
    setCombatActionState();
    windowRef.requestAnimationFrame(flushAchievementUnlockQueue);
    return true;
  }

  function returnToRunOriginSafeArea() {
    return returnToSafeArea(state.runOriginSafeAreaId);
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

  return Object.freeze({
    createRunStats,
    resetAdventureRunRuntime,
    initializeRunRuntime,
    enterAdventureRoute,
    openBeachSegmentCheckpoint,
    getCoastSegmentCheckpoint,
    startPlayerRun,
    restart,
    returnToSafeArea,
    returnToRunOriginSafeArea,
    returnToCamp,
    handleEndPrimaryAction
  });
}
