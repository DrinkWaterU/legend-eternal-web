import { applyBlessingEffects } from "../core/blessings.js";
import { buildScaledEnemy } from "../core/combat.js";
import { scheduleRegionEvent } from "../core/events.js";
import {
  buildHeroFromProgression,
  getCharacterMaxLevel
} from "../core/progression.js";
import { getAllIndependentBlessings } from "../data/blessings/index.js";
import { characterDefinitions } from "../data/characters/index.js";
import { getEventEnemyDefinition } from "../data/events/index.js";
import { regionDefinitions } from "../data/regions/index.js";
import { getRouteDefinition } from "../data/routes/index.js";
import { createDebugRegionScenarioActions } from "./regionScenarioActions.js";
import {
  getDebugScenarioBuildSlots,
  getDebugScenarioDefinition
} from "./scenarios.js";
import { clone } from "../utils.js";

export function createDebugScenarioActions(host) {
  const {
    state,
    isDebugModeEnabled,
    prepareRunForRegion,
    currentRegion,
    beginBattleRuntime,
    addFixedLog,
    logCurrentEnemyGroupEncounter,
    addLog,
    render,
    enterSafeState,
    startEncounter,
    showPlainsStory,
    showRouteEnding,
    getRouteBossDefinition,
    recordSelectedBossInRunStats,
    applySceneContext,
    consumeBattleLimitedEffects,
    clampInteger
  } = host;
  const { startRegionEnemyScenario } = createDebugRegionScenarioActions({
    state,
    prepareRunForRegion,
    applyScenarioBuild,
    setScenarioHp,
    beginBattleRuntime,
    addFixedLog,
    logCurrentEnemyGroupEncounter,
    addLog,
    render
  });

  function startScenario(options = {}) {
    if (!isDebugModeEnabled()) {
      throw new Error("冒險場景測試僅能在 ?debug=1 使用。");
    }
    const scenario = getDebugScenarioDefinition(options.scenarioId);
    if (!scenario) {
      throw new Error("找不到指定 Debug 場景。");
    }

    const scenarioOptions = {
      routeEntryEncounter: clampInteger(Number(options.routeEntryEncounter), 6, 8),
      midChoice: options.midChoice === "blessing" ? "blessing" : "heal"
    };
    const buildSlots = getDebugScenarioBuildSlots(scenario.id, scenarioOptions);
    const selections = validateScenarioSelections(buildSlots, options.selections);
    const characterId = characterDefinitions[options.characterId] ? options.characterId : state.selectedHeroId;
    const debugHero = buildMaxLevelHero(characterId);

    switch (scenario.kind) {
      case "regionBoss":
        return startRegionBossScenario({ scenario, options, buildSlots, selections, debugHero });
      case "forestCampfire":
        return prepareForestCampfireScenario({ options, buildSlots, selections, debugHero });
      case "multiEnemy":
        prepareMultiEnemyScenario(debugHero, options.hpPercent);
        return "已進入多敵人基礎測試；正式存檔不會記錄本次結果。";
      case "regionEnemy":
      case "regionEnemyGroup":
        return startRegionEnemyScenario({ scenario, options, buildSlots, selections, debugHero });
      case "goblinRouteEncounter":
      case "goblinMidEvent":
        return startGoblinScenario({ scenario, scenarioOptions, options, buildSlots, selections, debugHero });
      case "plainsStory":
        prepareRunForRegion("plains", getBossEncounterIndex("plains"), {
          hero: debugHero,
          debugBuildRun: true,
          persistSelection: false
        });
        state.defeatedBoss = true;
        showPlainsStory();
        return "已觸發平原星神劇情 Sandbox；完成後不會解鎖鳳凰。";
      case "goblinEnding": {
        const route = getRouteDefinition("goblin-camp");
        prepareGoblinRouteAt(route.encounterPlan.length - 1, {
          entryEncounterIndex: scenarioOptions.routeEntryEncounter - 1,
          scheduleEvent: false,
          hero: debugHero
        });
        showRouteEnding(route);
        return "已開啟弓箭手 Route Ending Sandbox；不會救援角色或記錄通關。";
      }
      default:
        throw new Error(`尚未支援 Debug 場景類型：${scenario.kind}`);
    }
  }

  function startRegionBossScenario({ scenario, options, buildSlots, selections, debugHero }) {
    prepareRunForRegion(scenario.regionId, getBossEncounterIndex(scenario.regionId), {
      bossId: scenario.bossId || null,
      hero: debugHero,
      debugBuildRun: true,
      persistSelection: false
    });
    applyScenarioBuild(buildSlots, selections);
    setScenarioHp(options.hpPercent);
    startEncounter();
    addFixedLog("system", `調試：Sandbox Build 直接進入${state.selectedBoss?.name || "首領"}。`);
    return `已進入「${scenario.name}」；正式存檔不會記錄本次結果。`;
  }

  function prepareForestCampfireScenario({ options, buildSlots, selections, debugHero }) {
    const triggerBeforeEncounter = 6;
    prepareRunForRegion("forest", triggerBeforeEncounter - 1, {
      hero: debugHero,
      debugBuildRun: true,
      persistSelection: false
    });
    applyScenarioBuild(buildSlots, selections);
    setScenarioHp(options.hpPercent);
    state.eventSchedule = { eventId: "forest-campfire", triggerBeforeEncounter };
    state.log = [];
    enterSafeState({ canRest: false });
    addFixedLog("system", "調試：Sandbox 已準備林間營火；下一次繼續前進觸發事件。");
    return "已準備林間營火；請按「繼續前進」。正式存檔不會記錄本次結果。";
  }

  function startGoblinScenario({ scenario, scenarioOptions, options, buildSlots, selections, debugHero }) {
    const entryEncounterIndex = scenarioOptions.routeEntryEncounter - 1;
    const scheduleEvent = scenario.id === "goblin-route-start" || scenario.kind === "goblinMidEvent";
    prepareGoblinRouteAt(scenario.routeEncounterIndex, {
      entryEncounterIndex,
      scheduleEvent,
      hero: debugHero
    });
    applyScenarioBuild(buildSlots, selections);
    setScenarioHp(options.hpPercent);

    if (scenario.kind === "goblinMidEvent") {
      enterSafeState({ canRest: false });
      addFixedLog("system", "調試：Sandbox 視為已完成哥布林營地第 4 場；下一次繼續前進觸發中段補給事件。");
      return "已準備「掠奪來的補給」；請按「繼續前進」。正式存檔不會記錄本次結果。";
    }
    startEncounter();
    addFixedLog("system", `調試：Sandbox Build 直接進入「${scenario.name}」。`);
    return `已進入「${scenario.name}」；正式存檔不會記錄本次結果。`;
  }

  function prepareMultiEnemyScenario(debugHero, hpPercent) {
    const enemyDefinition = getEventEnemyDefinition("goblin-warrior");
    if (!enemyDefinition) throw new Error("找不到哥布林戰士敵人。");
    prepareRunForRegion("forest", 5, {
      hero: debugHero,
      debugBuildRun: true,
      persistSelection: false
    });
    setScenarioHp(hpPercent);
    const first = buildScaledEnemy(enemyDefinition, currentRegion(), state.encounterIndex);
    const second = buildScaledEnemy(enemyDefinition, currentRegion(), state.encounterIndex);
    first.poison = 0;
    second.poison = 0;
    beginBattleRuntime({
      enemies: [
        { enemy: first },
        { enemy: second, statScale: 0.75, rewardScale: 0.5 }
      ],
      source: "main",
      encounterType: "normal"
    });
    addFixedLog("system", "調試：多敵人基礎 Sandbox；第二名哥布林套用 statScale 0.75 / rewardScale 0.5。");
    logCurrentEnemyGroupEncounter();
    if (state.hero.shield > 0) {
      addLog("status", "shield", { target: state.hero.name, amount: state.hero.shield });
    }
    render();
  }

  function prepareGoblinRouteAt(routeEncounterIndex, options = {}) {
    const route = getRouteDefinition("goblin-camp");
    if (!route) throw new Error("找不到哥布林營地 Route。");
    const routeIndex = clampInteger(routeEncounterIndex, 0, route.encounterPlan.length - 1);
    const entryEncounterIndex = clampInteger(Number(options.entryEncounterIndex), 5, 7);
    prepareRunForRegion(route.regionId, entryEncounterIndex + routeIndex, {
      hero: options.hero || buildMaxLevelHero(state.selectedHeroId),
      debugBuildRun: true,
      persistSelection: false
    });
    state.activeRouteId = route.id;
    state.routeEncounterIndex = routeIndex;
    state.eventSchedule = options.scheduleEvent ? scheduleRegionEvent(route) : null;
    state.selectedBoss = clone(getRouteBossDefinition(route));
    recordSelectedBossInRunStats();
    state.battleEncounterType = null;
    state.runResultRecorded = false;
    applySceneContext("gameScreen");
    return route;
  }

  function validateScenarioSelections(buildSlots, rawSelections) {
    const slotsById = new Map(buildSlots.map((slot) => [slot.id, slot]));
    const selections = new Map();
    (Array.isArray(rawSelections) ? rawSelections : []).forEach((selection) => {
      const slotId = String(selection?.slotId || "").trim();
      const blessingId = String(selection?.blessingId || "").trim();
      const slot = slotsById.get(slotId);
      if (!slot) throw new Error(`找不到 Blessing 取得位置：${slotId || "(empty)"}`);
      if (selections.has(slotId)) throw new Error(`Blessing 取得位置重複：${slotId}`);
      if (!slot.blessings.some((blessing) => blessing.id === blessingId)) {
        throw new Error(`「${slot.label}」不可取得 Blessing：${blessingId || "(empty)"}`);
      }
      selections.set(slotId, blessingId);
    });
    return selections;
  }

  function applyScenarioBuild(buildSlots, selections) {
    buildSlots.forEach((slot) => {
      const blessingId = selections.get(slot.id);
      if (blessingId) {
        const blessing = getBlessingDefinition(blessingId);
        applyBlessingEffects(state.hero, blessing);
        state.hero.blessings.push(blessing.name);
      }
      for (let victory = 0; victory < slot.battleVictoriesAfter; victory += 1) {
        consumeBattleLimitedEffects();
      }
    });
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

  function setScenarioHp(hpPercent) {
    const resolvedPercent = Math.max(1, Math.min(100, Number(hpPercent) || 100));
    state.hero.hp = Math.max(1, Math.round(state.hero.maxHp * resolvedPercent / 100));
    return resolvedPercent;
  }

  function buildMaxLevelHero(characterId) {
    const character = characterDefinitions[characterId];
    return buildHeroFromProgression(character, {
      level: getCharacterMaxLevel(character),
      exp: 0,
      learnedSkills: []
    });
  }

  function getBossEncounterIndex(regionId) {
    const region = regionDefinitions[regionId];
    const bossIndex = region.encounterPlan.findIndex((encounterType) => encounterType === "boss");
    return bossIndex >= 0 ? bossIndex : region.encounterPlan.length - 1;
  }

  return { startScenario };
}
