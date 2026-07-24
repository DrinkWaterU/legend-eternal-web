import { applyBlessingEffects } from "../../core/blessings.js";
import {
  sortBlessingInstancesByAcquisition,
  syncBlessingInstancesRuntime
} from "../../adventure/blessingInstances.js";
import { clearHeroBattleRuntimeState } from "../../core/heroBattleState.js";
import { getRouteDefinition } from "../../data/routes/index.js";
import { hideEventTransition, showCombatLayout } from "../../ui/eventView.js";
import {
  renderBeachSegmentChoice,
  renderCampReadyView,
  renderCampSelectionView
} from "../../ui/campTransitionView.js";
import { clone } from "../../utils.js";

const CAMP_HEAL_RATIO = 0.5;
const CAMP_BLESSING_COUNT = 8;
const COAST_CAVE_ROUTE_ID = "coast-cave";

export function createCampTransitionController({
  state,
  els,
  runStartingFlees,
  buildHeroFromProgression,
  clearEnemyGroup,
  clearPendingThreat,
  render,
  finishRun,
  enterAdventureRoute
}) {
  function getAvailableBlessingInstances() {
    return sortBlessingInstancesByAcquisition(state.blessingInstances);
  }

  function showBeachSegmentChoice() {
    if (state.phase !== "segmentChoice" || state.ended) return false;
    renderBeachSegmentChoice({
      els,
      onFinish: finishBeachSegment,
      onCamp: openCampSelection
    });
    return true;
  }

  function finishBeachSegment() {
    if (state.phase !== "segmentChoice" || state.ended || !state.coastSegmentCheckpoint) return false;
    state.adventureProgressLocked = true;
    state.eventInputLocked = true;
    showCombatLayout(els);
    finishRun("segmentClear");
    return true;
  }

  function openCampSelection() {
    if (state.phase !== "segmentChoice" || state.ended || !state.coastSegmentCheckpoint) return false;
    const instances = getAvailableBlessingInstances();
    syncBlessingInstancesRuntime(instances, state.hero);
    state.phase = "campSelection";
    state.campSelection = {
      selectedInstanceIds: [],
      locked: false,
      message: ""
    };
    state.awaitingBlessing = false;
    state.blessingInputLocked = true;
    state.eventInputLocked = true;
    state.adventureProgressLocked = true;
    renderCampSelection();
    return true;
  }

  function toggleCampBlessing(instanceId) {
    if (state.phase !== "campSelection" || state.campSelection?.locked) return false;
    const instances = getAvailableBlessingInstances();
    if (!instances.some((instance) => instance.instanceId === instanceId)) return false;

    const selected = new Set(state.campSelection.selectedInstanceIds);
    state.campSelection.message = "";
    if (selected.has(instanceId)) {
      selected.delete(instanceId);
    } else if (selected.size >= CAMP_BLESSING_COUNT) {
      state.campSelection.message = "已經選滿 8 個祝福；先取消已選項目，再更換配置。";
      renderCampSelection();
      return false;
    } else {
      selected.add(instanceId);
    }
    state.campSelection.selectedInstanceIds = [...selected];
    renderCampSelection();
    return true;
  }

  function returnToSegmentChoice() {
    if (state.phase !== "campSelection" || state.campSelection?.locked) return false;
    state.campSelection = null;
    state.phase = "segmentChoice";
    state.blessingInputLocked = false;
    state.eventInputLocked = false;
    showBeachSegmentChoice();
    return true;
  }

  function confirmCampSelection() {
    if (state.phase !== "campSelection" || state.campSelection?.locked) return false;
    const selectedIds = state.campSelection.selectedInstanceIds;
    if (selectedIds.length !== CAMP_BLESSING_COUNT) {
      state.campSelection.message = "請先選出 8 個要帶進海岸洞穴的祝福。";
      renderCampSelection();
      return false;
    }

    state.campSelection.locked = true;
    state.blessingInputLocked = true;
    state.eventInputLocked = true;
    const snapshot = clone(state);
    let transitionStage = "驗證保留祝福";

    try {
      const available = getAvailableBlessingInstances();
      const selected = sortBlessingInstancesByAcquisition(
        available.filter((instance) => selectedIds.includes(instance.instanceId))
      );
      if (selected.length !== CAMP_BLESSING_COUNT) {
        throw new Error("扎營祝福配置已失效，請重新選擇。");
      }

      transitionStage = "同步祝福狀態";
      syncBlessingInstancesRuntime(selected, state.hero);
      transitionStage = "重建角色能力";
      const rebuiltHero = buildHeroFromProgression(state.selectedHeroId);
      rebuiltHero.blessings = [];
      transitionStage = "重新套用保留祝福";
      selected.forEach((instance) => {
        const blessing = instance.definition;
        applyBlessingEffects(rebuiltHero, blessing, {
          instanceId: instance.instanceId,
          skipImmediate: true,
          runtimeState: instance.runtime
        });
        rebuiltHero.blessings.push(blessing.name);
      });
      clearHeroBattleRuntimeState(rebuiltHero);
      rebuiltHero.fleesRemaining = runStartingFlees;
      rebuiltHero.hp = Math.max(1, Math.round(rebuiltHero.maxHp * CAMP_HEAL_RATIO));

      state.hero = rebuiltHero;
      state.blessingInstances = clone(selected);
      state.campSelection = null;
      state.awaitingBlessing = false;
      state.blessingContext = "normal";
      state.blessingPoolOverrideId = null;
      state.blessingInputLocked = false;
      state.eventInputLocked = false;
      state.adventureProgressLocked = true;
      state.activeRouteId = null;
      state.routeEncounterIndex = 0;
      state.routeEndingContext = null;
      state.eventSchedule = null;
      state.eventContext = null;
      state.runEventRecords = [];
      state.eventTransitionToken += 1;
      state.battleSource = "main";
      state.battleEncounterType = null;
      state.turn = 0;
      clearEnemyGroup();
      clearPendingThreat();
      hideEventTransition(els);

      if (getRouteDefinition(COAST_CAVE_ROUTE_ID)) {
        transitionStage = "進入海岸洞穴";
        enterAdventureRoute(COAST_CAVE_ROUTE_ID);
      } else {
        state.phase = "campReady";
        render();
        renderCampReadyView({ els, hpRatio: CAMP_HEAL_RATIO * 100 });
      }
      return true;
    } catch (error) {
      console.error(`扎營配置失敗（${transitionStage}）`, error);
      restoreState(snapshot);
      state.campSelection = state.campSelection || {
        selectedInstanceIds: [...selectedIds],
        locked: false,
        message: ""
      };
      state.campSelection.locked = false;
      const reason = error instanceof Error && error.message
        ? error.message
        : "未知錯誤";
      state.campSelection.message = `扎營配置未能完成（${transitionStage}）：${reason}`;
      render();
      renderCampSelection();
      return false;
    }
  }

  function renderCampSelection() {
    const selection = state.campSelection || { selectedInstanceIds: [], message: "" };
    renderCampSelectionView({
      els,
      instances: getAvailableBlessingInstances(),
      selectedIds: selection.selectedInstanceIds,
      message: selection.message,
      onToggle: toggleCampBlessing
    });
  }

  function restoreState(snapshot) {
    Object.assign(state, clone(snapshot));
  }

  return Object.freeze({
    showBeachSegmentChoice,
    finishBeachSegment,
    openCampSelection,
    toggleCampBlessing,
    returnToSegmentChoice,
    confirmCampSelection
  });
}
