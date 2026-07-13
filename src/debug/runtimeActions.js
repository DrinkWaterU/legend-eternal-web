import { DEFAULT_CHARACTER_ID, DEFAULT_REGION_ID } from "../config.js";
import { applyBlessingEffects } from "../core/blessings.js";
import { buildScaledEnemy } from "../core/combat.js";
import { scheduleRegionEvent } from "../core/events.js";
import {
  buildHeroFromProgression as buildHeroFromProgressionCore,
  getCharacterMaxLevel,
  getExpToNextLevel,
  getSkillsForLevel
} from "../core/progression.js";
import {
  applyRewardsToInventory,
  createEmptyRewards,
  normalizeInventory
} from "../core/rewards.js";
import {
  getCurrentSafeAreaId,
  isSafeAreaUnlocked,
  isSafeAreaVisited,
  markSafeAreaVisited,
  setCurrentSafeArea
} from "../core/safeAreaProgression.js";
import { createDefaultSave, deleteStoredSave } from "../core/storage.js";
import { getAllIndependentBlessings } from "../data/blessings/index.js";
import { characterDefinitions } from "../data/characters/index.js";
import { getEventEnemyDefinition } from "../data/events/index.js";
import { materialDefinitions } from "../data/materials.js";
import { weaponDefinitions } from "../data/weapons.js";
import { regionDefinitions } from "../data/regions/index.js";
import {
  ANPING_TOWN_SAFE_AREA_ID,
  DEFAULT_SAFE_AREA_ID,
  getSafeAreaDefinition,
  getSafeAreaDefinitions
} from "../data/safeAreas.js";
import { getRouteDefinition } from "../data/routes/index.js";
import {
  createDebugBuildProfile,
  getDebugBuildProfiles,
  getDebugMidChoices,
  getDebugRouteEntryOptions,
  getDebugScenarioBuildSlots,
  getDebugScenarioCatalog,
  getDebugScenarioDefinition
} from "./scenarios.js";
import { clone } from "../utils.js";

export function createDebugRuntimeActions(host) {
  const {
    state,
    els,
    getSaveData,
    replaceSaveData,
    isDebugModeEnabled,
    getCharacterDefinition,
    buildHeroFromProgression,
    unlockAchievement,
    plainsTrialAchievementId,
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
    runStartingFlees
  } = host;

  function getCharacterProgress(characterId = state.selectedHeroId) {
    return getSaveData().progression.characters[characterId];
  }

  function getDebugCharacterOptions() {
    return Object.entries(characterDefinitions).map(([id, character]) => ({
      id,
      name: character.name
    }));
  }

  function setDebugCharacterLevel(level) {
    const character = getCharacterDefinition();
    const progress = getCharacterProgress();
    const maxLevel = getCharacterMaxLevel(character);
    progress.level = clampDebugInteger(level, 1, maxLevel);
    const expToNext = getExpToNextLevel(progress.level, character);
    if (expToNext !== "MAX") {
      progress.exp = Math.min(progress.exp, Math.max(0, expToNext - 1));
    }
    progress.learnedSkills = getSkillsForLevel(character, progress.level).map((skill) => skill.id);
    rebuildDebugHero();
    saveGameSafe();
    refreshAfterDebugChange();
    return `已設定等級為 Lv. ${progress.level}。`;
  }

  function setDebugCharacterExp(exp) {
    const character = getCharacterDefinition();
    const progress = getCharacterProgress();
    const expToNext = getExpToNextLevel(progress.level, character);
    const maxExp = expToNext === "MAX" ? 999999 : Math.max(0, expToNext - 1);
    progress.exp = clampDebugInteger(exp, 0, maxExp);
    rebuildDebugHero();
    saveGameSafe();
    refreshAfterDebugChange();
    return `已設定 EXP 為 ${progress.exp}。`;
  }

  function healDebugHero() {
    if (!state.hero) {
      return "目前沒有戰鬥角色。";
    }
    state.hero.hp = state.hero.maxHp;
    state.hero.poison = 0;
    state.hero.shield = state.hero.shield || 0;
    render();
    return "已補滿目前 HP 並清除中毒。";
  }

  function unlockDebugPhoenix() {
    const saveData = getSaveData();
    saveData.storyFlags.phoenixBlessingUnlocked = true;
    saveData.storyFlags.achievementSystemUnlocked = true;
    unlockAchievement(plainsTrialAchievementId);
    saveGameSafe();
    refreshAfterDebugChange();
    return "已解鎖鳳凰加護。";
  }

  function removeDebugPhoenix() {
    const saveData = getSaveData();
    saveData.storyFlags.phoenixBlessingUnlocked = false;
    saveData.storyFlags.plainsBossStorySeen = false;
    saveData.storyFlags.achievementSystemUnlocked = false;
    Object.keys(saveData.achievements).forEach((achievementId) => {
      saveData.achievements[achievementId] = {
        unlocked: false,
        unlockedAt: null
      };
    });
    saveGameSafe();
    refreshAfterDebugChange();
    return "已移除鳳凰加護並重置平原劇情旗標。";
  }

  function getDebugMaterialGroups() {
    return [
      { id: "plains", name: "平原" },
      { id: "forest-main", name: "森林主路線" },
      { id: "goblin", name: "哥布林" }
    ];
  }

  function giveDebugMaterialsByGroup(groupId) {
    const group = getDebugMaterialGroups().find((candidate) => candidate.id === groupId);
    if (!group) {
      throw new Error("找不到指定素材來源。");
    }

    const rewards = createEmptyRewards();
    Object.entries(materialDefinitions)
      .filter(([, material]) => matchesDebugMaterialGroup(material, group.id))
      .forEach(([materialId, material]) => {
        rewards.materials[materialId] = {
          id: materialId,
          name: material.name,
          quantity: material.rarity === "rare" ? 1 : 3
        };
      });
    applyRewardsToInventory(getSaveData().inventory, rewards);
    saveGameSafe();
    refreshAfterDebugChange();
    return `已給予少量${group.name}素材。`;
  }

  function matchesDebugMaterialGroup(material, groupId) {
    const tags = Array.isArray(material?.tags) ? material.tags : [];
    if (groupId === "plains") {
      return tags.includes("plains");
    }
    if (groupId === "forest-main") {
      return tags.includes("forest") && !tags.includes("goblin");
    }
    if (groupId === "goblin") {
      return tags.includes("goblin");
    }
    return false;
  }

  function clearDebugInventory() {
    const inventory = getSaveData().inventory;
    inventory.gold = 0;
    inventory.materials = {};
    normalizeInventory(inventory);
    saveGameSafe();
    refreshAfterDebugChange();
    return "已清空金幣與素材。";
  }

  function giveDebugBlacksmithResources() {
    const saveData = getSaveData();
    const rewards = createEmptyRewards();
    rewards.gold = 1000;
    Object.values(weaponDefinitions).forEach((weapon) => {
      (weapon.recipe?.materialCosts || []).forEach((cost) => {
        const material = materialDefinitions[cost.materialId];
        if (!material) {
          return;
        }
        const current = rewards.materials[cost.materialId]?.quantity || 0;
        rewards.materials[cost.materialId] = {
          id: cost.materialId,
          name: material.name,
          quantity: current + cost.quantity
        };
      });
    });
    applyRewardsToInventory(saveData.inventory, rewards);
    saveGameSafe();
    refreshAfterDebugChange();
    return "已給予 1000 金幣與製作四把武器所需素材。";
  }

  function giveAllDebugWeapons() {
    const saveData = getSaveData();
    saveData.inventory.weapons = Object.fromEntries(
      Object.keys(weaponDefinitions).map((weaponId) => [weaponId, true])
    );
    saveGameSafe();
    refreshAfterDebugChange();
    return `已取得全部 ${Object.keys(weaponDefinitions).length} 把武器。`;
  }

  function clearAllDebugWeapons() {
    const saveData = getSaveData();
    saveData.inventory.weapons = {};
    Object.values(saveData.progression.characters || {}).forEach((progress) => {
      progress.equipment = { weaponId: null };
    });
    saveGameSafe();
    refreshAfterDebugChange();
    return "已清空全部武器並卸下角色裝備。";
  }

  function startDebugScenario(options = {}) {
    if (!isDebugModeEnabled()) {
      throw new Error("冒險場景測試僅能在 ?debug=1 使用。");
    }

    const scenario = getDebugScenarioDefinition(options.scenarioId);
    if (!scenario) {
      throw new Error("找不到指定 Debug 場景。");
    }

    const scenarioOptions = {
      routeEntryEncounter: clampDebugInteger(Number(options.routeEntryEncounter), 6, 8),
      midChoice: options.midChoice === "blessing" ? "blessing" : "heal"
    };
    const buildSlots = getDebugScenarioBuildSlots(scenario.id, scenarioOptions);
    const selections = validateDebugScenarioSelections(buildSlots, options.selections);
    const debugCharacterId = characterDefinitions[options.characterId]
      ? options.characterId
      : state.selectedHeroId;
    const debugHero = buildDebugMaxLevelHero(debugCharacterId);

    if (scenario.kind === "regionBoss") {
      prepareDebugRunForRegion(scenario.regionId, getBossEncounterIndex(scenario.regionId), {
        bossId: scenario.bossId || null,
        hero: debugHero,
        debugBuildRun: true,
        persistSelection: false
      });
      applyDebugScenarioBuild(buildSlots, selections);
      setDebugScenarioHp(options.hpPercent);
      startEncounter();
      addFixedLog("system", `調試：Sandbox Build 直接進入${state.selectedBoss?.name || "首領"}。`);
      return `已進入「${scenario.name}」；正式存檔不會記錄本次結果。`;
    }

    if (scenario.kind === "forestCampfire") {
      const triggerBeforeEncounter = 6;
      prepareDebugRunForRegion("forest", triggerBeforeEncounter - 1, {
        hero: debugHero,
        debugBuildRun: true,
        persistSelection: false
      });
      applyDebugScenarioBuild(buildSlots, selections);
      setDebugScenarioHp(options.hpPercent);
      state.eventSchedule = {
        eventId: "forest-campfire",
        triggerBeforeEncounter
      };
      state.log = [];
      enterSafeState({ canRest: false });
      addFixedLog("system", "調試：Sandbox 已準備林間營火；下一次繼續前進觸發事件。");
      return "已準備林間營火；請按「繼續前進」。正式存檔不會記錄本次結果。";
    }

    if (scenario.kind === "multiEnemy") {
      prepareDebugMultiEnemyScenario(debugHero, options.hpPercent);
      return "已進入多敵人基礎測試；正式存檔不會記錄本次結果。";
    }

    if (scenario.kind === "goblinRouteEncounter" || scenario.kind === "goblinMidEvent") {
      const entryEncounterIndex = scenarioOptions.routeEntryEncounter - 1;
      const scheduleEvent = scenario.id === "goblin-route-start" || scenario.kind === "goblinMidEvent";
      prepareDebugGoblinRouteAt(scenario.routeEncounterIndex, {
        entryEncounterIndex,
        scheduleEvent,
        hero: debugHero
      });
      applyDebugScenarioBuild(buildSlots, selections);
      setDebugScenarioHp(options.hpPercent);

      if (scenario.kind === "goblinMidEvent") {
        enterSafeState({ canRest: false });
        addFixedLog("system", "調試：Sandbox 視為已完成哥布林營地第 4 場；下一次繼續前進觸發中段補給事件。");
        return "已準備「掠奪來的補給」；請按「繼續前進」。正式存檔不會記錄本次結果。";
      }

      startEncounter();
      addFixedLog("system", `調試：Sandbox Build 直接進入「${scenario.name}」。`);
      return `已進入「${scenario.name}」；正式存檔不會記錄本次結果。`;
    }

    if (scenario.kind === "plainsStory") {
      prepareDebugRunForRegion("plains", getBossEncounterIndex("plains"), {
        hero: debugHero,
        debugBuildRun: true,
        persistSelection: false
      });
      state.defeatedBoss = true;
      showPlainsStory();
      return "已觸發平原星神劇情 Sandbox；完成後不會解鎖鳳凰。";
    }

    if (scenario.kind === "goblinEnding") {
      const route = getRouteDefinition("goblin-camp");
      prepareDebugGoblinRouteAt(route.encounterPlan.length - 1, {
        entryEncounterIndex: scenarioOptions.routeEntryEncounter - 1,
        scheduleEvent: false,
        hero: debugHero
      });
      showRouteEnding(route);
      return "已開啟弓箭手 Route Ending Sandbox；不會救援角色或記錄通關。";
    }

    throw new Error(`尚未支援 Debug 場景類型：${scenario.kind}`);
  }

  function prepareDebugMultiEnemyScenario(debugHero, hpPercent) {
    const enemyDefinition = getEventEnemyDefinition("goblin-warrior");
    if (!enemyDefinition) {
      throw new Error("找不到哥布林戰士敵人。");
    }

    prepareDebugRunForRegion("forest", 5, {
      hero: debugHero,
      debugBuildRun: true,
      persistSelection: false
    });
    setDebugScenarioHp(hpPercent);
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

  function prepareDebugGoblinRouteAt(routeEncounterIndex, options = {}) {
    const route = getRouteDefinition("goblin-camp");
    if (!route) {
      throw new Error("找不到哥布林營地 Route。");
    }
    const routeIndex = clampDebugInteger(routeEncounterIndex, 0, route.encounterPlan.length - 1);
    const entryEncounterIndex = clampDebugInteger(Number(options.entryEncounterIndex), 5, 7);
    prepareDebugRunForRegion(route.regionId, entryEncounterIndex + routeIndex, {
      hero: options.hero || buildDebugMaxLevelHero(state.selectedHeroId),
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

  function validateDebugScenarioSelections(buildSlots, rawSelections) {
    const slotsById = new Map(buildSlots.map((slot) => [slot.id, slot]));
    const selections = new Map();
    (Array.isArray(rawSelections) ? rawSelections : []).forEach((selection) => {
      const slotId = String(selection?.slotId || "").trim();
      const blessingId = String(selection?.blessingId || "").trim();
      const slot = slotsById.get(slotId);
      if (!slot) {
        throw new Error(`找不到 Blessing 取得位置：${slotId || "(empty)"}`);
      }
      if (selections.has(slotId)) {
        throw new Error(`Blessing 取得位置重複：${slotId}`);
      }
      if (!slot.blessings.some((blessing) => blessing.id === blessingId)) {
        throw new Error(`「${slot.label}」不可取得 Blessing：${blessingId || "(empty)"}`);
      }
      selections.set(slotId, blessingId);
    });
    return selections;
  }

  function applyDebugScenarioBuild(buildSlots, selections) {
    buildSlots.forEach((slot) => {
      const blessingId = selections.get(slot.id);
      if (blessingId) {
        const blessing = getDebugBlessingDefinition(blessingId);
        applyBlessingEffects(state.hero, blessing);
        state.hero.blessings.push(blessing.name);
      }
      for (let victory = 0; victory < slot.battleVictoriesAfter; victory += 1) {
        consumeBattleLimitedEffects();
      }
    });
  }

  function getDebugBlessingDefinition(blessingId) {
    const definitions = [
      ...Object.values(regionDefinitions).flatMap((region) => region.blessings || []),
      ...getAllIndependentBlessings()
    ];
    const blessing = definitions.find((candidate) => candidate.id === blessingId);
    if (!blessing) {
      throw new Error(`找不到 Blessing：${blessingId}`);
    }
    return blessing;
  }

  function setDebugScenarioHp(hpPercent) {
    const resolvedPercent = Math.max(1, Math.min(100, Number(hpPercent) || 100));
    state.hero.hp = Math.max(1, Math.round(state.hero.maxHp * resolvedPercent / 100));
    return resolvedPercent;
  }

  function buildDebugMaxLevelHero(characterId) {
    const character = characterDefinitions[characterId];
    return buildHeroFromProgressionCore(character, {
      level: getCharacterMaxLevel(character),
      exp: 0,
      learnedSkills: []
    });
  }

  function getDebugSafeAreaOptions() {
    const saveData = getSaveData();
    const currentSafeAreaId = getCurrentSafeAreaId(saveData);
    return getSafeAreaDefinitions().map((safeArea) => ({
      id: safeArea.id,
      name: safeArea.name,
      current: safeArea.id === currentSafeAreaId,
      unlocked: isSafeAreaUnlocked(saveData, safeArea.id),
      visited: isSafeAreaVisited(saveData, safeArea.id)
    }));
  }

  function prepareDebugSafeArea(safeAreaId) {
    const safeArea = getSafeAreaDefinition(safeAreaId);
    if (!safeArea || safeArea.id === DEFAULT_SAFE_AREA_ID) {
      throw new Error("請選擇可重設的非預設據點。");
    }
    const saveData = getSaveData();
    const now = new Date().toISOString();
    const progress = saveData.progression.safeAreas[safeArea.id];
    progress.unlocked = true;
    progress.unlockedAt ||= now;
    progress.visitedAt = null;
    setCurrentSafeArea(saveData, DEFAULT_SAFE_AREA_ID);
    if (!saveGameSafe()) {
      throw new Error("無法保存安全區 Debug 狀態。");
    }
    syncSafeAreaUiFromSave();
    returnToSafeArea(DEFAULT_SAFE_AREA_ID);
    return `已將${safeArea.name}設為「已解鎖、未造訪」，並回到冒險營地。`;
  }

  function visitDebugSafeArea(safeAreaId) {
    const safeArea = getSafeAreaDefinition(safeAreaId);
    if (!safeArea) {
      throw new Error("找不到指定安全區。");
    }
    const saveData = getSaveData();
    markSafeAreaVisited(saveData, safeArea.id);
    setCurrentSafeArea(saveData, safeArea.id);
    if (!saveGameSafe()) {
      throw new Error("無法保存安全區 Debug 狀態。");
    }
    syncSafeAreaUiFromSave();
    returnToSafeArea(safeArea.id);
    return `已將${safeArea.name}標記為已造訪並直接前往。`;
  }

  function travelDebugSafeArea(safeAreaId) {
    const safeArea = getSafeAreaDefinition(safeAreaId);
    if (!safeArea) {
      throw new Error("找不到指定安全區。");
    }
    const saveData = getSaveData();
    if (!isSafeAreaVisited(saveData, safeArea.id)) {
      throw new Error(`${safeArea.name}尚未造訪；請先標記已造訪或播放首次抵達。`);
    }
    setCurrentSafeArea(saveData, safeArea.id);
    if (!saveGameSafe()) {
      throw new Error("無法保存安全區 Debug 狀態。");
    }
    syncSafeAreaUiFromSave();
    returnToSafeArea(safeArea.id);
    return `已前往${safeArea.name}。`;
  }

  function resetDebugSafeArea(safeAreaId) {
    const safeArea = getSafeAreaDefinition(safeAreaId);
    if (!safeArea || safeArea.id === DEFAULT_SAFE_AREA_ID) {
      throw new Error("冒險營地是預設據點，不能重設為鎖定。");
    }
    const saveData = getSaveData();
    const progress = saveData.progression.safeAreas[safeArea.id];
    progress.unlocked = false;
    progress.unlockedAt = null;
    progress.visitedAt = null;
    setCurrentSafeArea(saveData, DEFAULT_SAFE_AREA_ID);
    if (!saveGameSafe()) {
      throw new Error("無法保存安全區 Debug 狀態。");
    }
    syncSafeAreaUiFromSave();
    returnToSafeArea(DEFAULT_SAFE_AREA_ID);
    return `已重設${safeArea.name}，目前只保留冒險營地。`;
  }

  function playDebugAnpingArrival() {
    prepareDebugSafeArea(ANPING_TOWN_SAFE_AREA_ID);
    if (!showAnpingArrivalStory({ source: "debug" })) {
      throw new Error("無法開啟安平鎮首次抵達演出。");
    }
    return "已準備並播放安平鎮首次抵達；本次完成會寫入正式存檔。";
  }

  function openDebugSafeAreaTravel() {
    showSafeAreaTravelScreen();
    return "已開啟通用據點移動頁。";
  }

  function returnDebugToCamp() {
    returnToCamp();
    return "已回到營地。";
  }

  function deleteDebugSave() {
    try {
      deleteStoredSave();
    } catch {
      // Keep the in-memory reset usable if storage is blocked.
    }
    replaceSaveData(createDefaultSave());
    saveGameSafe();
    syncSelectionFromSave();
    restart();
    syncMusicSettingsFromSave();
    return "已刪除存檔並建立空白存檔。";
  }

  function prepareDebugRunForRegion(regionId, encounterIndex, options = {}) {
    const saveData = getSaveData();
    if (options.persistSelection === false) {
      const runtimeCharacterId = options.characterId || options.hero?.characterId || saveData.settings.selectedCharacterId;
      setRuntimeSelection(regionId, runtimeCharacterId);
    } else {
      saveData.settings.selectedRegionId = regionId;
      saveGameSafe();
      syncSelectionFromSave();
    }

    initializeRunRuntime({
      hero: options.hero || buildHeroFromProgression(state.selectedHeroId),
      encounterIndex,
      debugBuildRun: options.debugBuildRun,
      bossId: options.bossId
    });
    closeTransientUiPanels();
    els.nextButton.disabled = false;
    showScreen("gameScreen");
  }

  function getBossEncounterIndex(regionId) {
    const region = regionDefinitions[regionId];
    const bossIndex = region.encounterPlan.findIndex((encounterType) => encounterType === "boss");
    return bossIndex >= 0 ? bossIndex : region.encounterPlan.length - 1;
  }

  function setRuntimeSelection(regionId, characterId) {
    const resolvedRegionId = regionDefinitions[regionId] ? regionId : DEFAULT_REGION_ID;
    const resolvedCharacterId = characterDefinitions[characterId] ? characterId : DEFAULT_CHARACTER_ID;
    state.selectedRegionId = resolvedRegionId;
    state.selectedHeroId = resolvedCharacterId;
    state.selectedRegion = regionDefinitions[resolvedRegionId].name;
    state.selectedHero = characterDefinitions[resolvedCharacterId].name;
  }

  function rebuildDebugHero() {
    if (!state.hero) {
      return;
    }
    const fleesRemaining = state.hero.fleesRemaining;
    const poison = state.hero.poison || 0;
    state.hero = buildHeroFromProgression(state.selectedHeroId);
    state.hero.fleesRemaining = fleesRemaining ?? runStartingFlees;
    state.hero.poison = poison;
  }

  function refreshAfterDebugChange() {
    const activeScreen = document.querySelector(".screen.is-active")?.id;
    if (activeScreen === "gameScreen" && state.hero) {
      render();
      return;
    }
    if (activeScreen) {
      showScreen(activeScreen);
    }
  }

  function clampDebugInteger(value, min, max) {
    const parsed = Number.isFinite(value) ? Math.floor(value) : min;
    return Math.max(min, Math.min(max, parsed));
  }

  return {
    setLevel: setDebugCharacterLevel,
    setExp: setDebugCharacterExp,
    healHero: healDebugHero,
    unlockPhoenix: unlockDebugPhoenix,
    removePhoenix: removeDebugPhoenix,
    getMaterialGroups: getDebugMaterialGroups,
    giveMaterials: giveDebugMaterialsByGroup,
    clearInventory: clearDebugInventory,
    giveBlacksmithResources: giveDebugBlacksmithResources,
    giveAllWeapons: giveAllDebugWeapons,
    clearAllWeapons: clearAllDebugWeapons,
    getScenarioCatalog: getDebugScenarioCatalog,
    getCharacterOptions: getDebugCharacterOptions,
    getRouteEntryOptions: getDebugRouteEntryOptions,
    getMidChoices: getDebugMidChoices,
    getBuildProfiles: getDebugBuildProfiles,
    getScenarioBuildSlots: getDebugScenarioBuildSlots,
    createBuildProfile: createDebugBuildProfile,
    startScenario: startDebugScenario,
    getSafeAreaOptions: getDebugSafeAreaOptions,
    prepareSafeArea: prepareDebugSafeArea,
    visitSafeArea: visitDebugSafeArea,
    travelSafeArea: travelDebugSafeArea,
    openSafeAreaTravel: openDebugSafeAreaTravel,
    resetSafeArea: resetDebugSafeArea,
    playAnpingArrival: playDebugAnpingArrival,
    returnToCamp: returnDebugToCamp,
    deleteSave: deleteDebugSave
  };
}
