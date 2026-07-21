import { createBlessingInstance, syncBlessingInstanceRuntime } from "../adventure/blessingInstances.js";
import { applyBlessingEffects } from "../core/blessings.js";
import { createRunPreparation } from "../core/preparations.js";
import { getAllIndependentBlessings } from "../data/blessings/index.js";
import { regionDefinitions } from "../data/regions/index.js";
import { prepareDebugRouteAt } from "./routeScenarioActions.js";
import { clone } from "../utils.js";

export function createDebugCoastScenarioActions(host) {
  const {
    state,
    prepareRunForRegion,
    getRouteBossDefinition,
    recordSelectedBossInRunStats,
    applySceneContext,
    clampInteger,
    buildMaxLevelHero,
    runStartingFlees,
    openCampSelection,
    startEncounter,
    enterSafeState,
    addFixedLog,
    setScenarioHp,
    consumeBattleLimitedEffects
  } = host;

  function startCoastCaveScenario({ scenario, options, buildSlots, selections, debugHero }) {
    prepareCoastCaveRouteAt(scenario.routeEncounterIndex, { hero: debugHero });
    applyScenarioBuild(buildSlots, selections);
    setScenarioHp(options.hpPercent);

    if (scenario.kind === "coastCaveEvent") {
      state.eventSchedule = {
        eventId: scenario.eventId,
        triggerBeforeEncounter: state.routeEncounterIndex + 1
      };
      enterSafeState({ canRest: false });
      addFixedLog("system", `調試：Sandbox 已準備「${scenario.name}」；下一次繼續前進固定觸發事件。`);
      return `已準備「${scenario.name}」；請按「繼續前進」。正式存檔不會記錄本次結果。`;
    }

    startEncounter();
    addFixedLog("system", `調試：已套用海灘 16 場、扎營 8 張與洞穴前置，直接進入「${scenario.name}」。`);
    return `已進入「${scenario.name}」；正式存檔不會記錄本次結果。`;
  }

  function startCoastCampTransition({ buildSlots, selections, debugHero }) {
    const encounterCount = regionDefinitions.beach?.encounterPlan?.length || 16;
    prepareRunForRegion("beach", encounterCount, {
      hero: debugHero,
      debugBuildRun: true,
      persistSelection: false
    });
    applyScenarioBuild(buildSlots, selections);
    state.runPreparation = createRunPreparation(
      regionDefinitions.beach,
      "reef-anchor-tether",
      { enhanced: true }
    );
    state.coastSegmentCheckpoint = {
      run: state.run,
      regionId: "beach",
      encounterIndex: state.encounterIndex,
      routeEncounterIndex: 0,
      activeRouteId: null
    };
    state.phase = "segmentChoice";
    state.ended = false;
    state.activeRouteId = null;
    state.routeEncounterIndex = 0;
    state.adventureProgressLocked = true;
    if (typeof openCampSelection !== "function" || !openCampSelection()) {
      throw new Error("無法開啟正式海岸扎營選擇。");
    }
    return "已開啟海灘 Boss 後正式扎營 Sandbox；固定使用強化礁釘繫索，正式存檔不會記錄本次結果。";
  }

  function prepareCoastCaveRouteAt(routeEncounterIndex, options = {}) {
    const beachEncounterCount = regionDefinitions.beach?.encounterPlan?.length || 16;
    return prepareDebugRouteAt({
      state,
      routeId: "coast-cave",
      routeEncounterIndex,
      baseEncounterIndex: beachEncounterCount,
      hero: options.hero || buildMaxLevelHero(state.selectedHeroId),
      prepareRunForRegion,
      getRouteBossDefinition,
      recordSelectedBossInRunStats,
      applySceneContext,
      clampInteger
    });
  }

  function applyScenarioBuild(buildSlots, selections) {
    const acquiredBySlotId = new Map();
    buildSlots.forEach((slot) => {
      if (slot.stage === "campRetained") {
        rebuildHeroForCoastCamp(slot, selections, acquiredBySlotId);
        if (slot.id === "coast-camp-retained-8") {
          for (let victory = 0; victory < slot.battleVictoriesAfter; victory += 1) {
            consumeBattleLimitedEffects();
          }
        }
        return;
      }
      const blessingId = selections.get(slot.id);
      if (blessingId) {
        const blessing = getBlessingDefinition(blessingId);
        const instance = createBlessingInstance({
          state,
          blessing,
          sourceLabel: state.selectedRegionId === "beach" ? "海灘途中" : "冒險途中"
        });
        applyBlessingEffects(state.hero, blessing, { instanceId: instance.instanceId });
        state.hero.blessings.push(blessing.name);
        syncBlessingInstanceRuntime(instance, state.hero);
        state.blessingInstances = Array.isArray(state.blessingInstances)
          ? state.blessingInstances
          : [];
        state.blessingInstances.push(instance);
        acquiredBySlotId.set(slot.id, instance);
      }
      for (let victory = 0; victory < slot.battleVictoriesAfter; victory += 1) {
        consumeBattleLimitedEffects();
      }
    });
  }

  function rebuildHeroForCoastCamp(slot, selections, acquiredBySlotId) {
    if (slot.id !== "coast-camp-retained-1") return;
    const campSlots = [...selections.keys()]
      .filter((slotId) => String(slotId).startsWith("coast-camp-retained-"))
      .sort();
    if (campSlots.length !== 8) {
      throw new Error("海岸洞穴 Sandbox 必須選出剛好 8 張扎營保留 Blessing。");
    }

    const usedSourceSlots = new Set();
    const retained = campSlots.map((campSlotId) => {
      const blessingId = selections.get(campSlotId);
      const sourceSlotId = (slot.retainedFromSlotIds || []).find((candidateId) => {
        const instance = acquiredBySlotId.get(candidateId);
        return !usedSourceSlots.has(candidateId) && instance?.definition?.id === blessingId;
      });
      if (!sourceSlotId) {
        throw new Error(`扎營保留的 Blessing 不在已選海灘取得位置中：${blessingId}`);
      }
      usedSourceSlots.add(sourceSlotId);
      return acquiredBySlotId.get(sourceSlotId);
    });

    retained.forEach((instance) => syncBlessingInstanceRuntime(instance, state.hero));
    const rebuiltHero = buildMaxLevelHero(state.selectedHeroId);
    rebuiltHero.blessings = [];
    retained.forEach((instance) => {
      applyBlessingEffects(rebuiltHero, instance.definition, {
        instanceId: instance.instanceId,
        skipImmediate: true,
        runtimeState: instance.runtime
      });
      rebuiltHero.blessings.push(instance.definition.name);
    });
    clearRebuiltHeroBattleState(rebuiltHero);
    rebuiltHero.fleesRemaining = Number.isInteger(runStartingFlees) ? runStartingFlees : 2;
    rebuiltHero.hp = Math.max(1, Math.round(rebuiltHero.maxHp * 0.5));
    state.hero = rebuiltHero;
    state.blessingInstances = clone(retained);
  }

  function getBlessingDefinition(blessingId) {
    const definitions = [
      ...Object.values(regionDefinitions).flatMap((region) => region.blessings || []),
      ...getAllIndependentBlessings()
    ];
    const blessing = definitions.find((candidate) => candidate.id === blessingId);
    if (!blessing) throw new Error(`找不到 Blessing：${blessingId}`);
    return blessing;
  }

  return {
    applyScenarioBuild,
    startCoastCaveScenario,
    startCoastCampTransition
  };
}

function clearRebuiltHeroBattleState(hero) {
  hero.poison = 0;
  hero.entangle = null;
  hero.saltErosion = null;
  hero.paralysis = null;
  hero.battleAttackBonus = 0;
  hero.battleCritBonus = 0;
  hero.hasAttackedThisBattle = false;
  hero.activeEnemyCount = 0;
  hero.activePreparation = null;
  hero.shield = 0;
}
