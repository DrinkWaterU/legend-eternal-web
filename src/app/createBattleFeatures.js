import {
  COUNTER_ESCAPE_HEAL_RATIO,
  COUNTER_ESCAPE_SCALING_OFFSET,
  LAST_BAG_FLOW_WEIGHT_MULTIPLIER,
  RUN_STARTING_FLEES
} from "./runtimeConstants.js";
import { createRunRecords } from "../features/adventure/runRecords.js";
import { createBossSelection } from "../features/adventure/bossSelection.js";
import { createEncounterController } from "../features/adventure/encounterController.js";
import { createBattleLog } from "../features/battle/battleLog.js";
import { createBattleState } from "../features/battle/battleState.js";
import { createBattleSkills } from "../features/battle/battleSkills.js";
import { createPreparationBattleEffects } from "../features/battle/preparationBattleEffects.js";
import { createBattleSettlement } from "../features/battle/battleSettlement.js";
import { createBattleTurnController } from "../features/battle/battleTurnController.js";
import { createCombatRenderer } from "../features/battle/combatRenderer.js";
import { templates } from "../data/templates.js";

export function createBattleFeatures({
  foundation,
  world,
  els,
  showBlessings,
  winEncounter,
  loseRun
}) {
  const {
    state,
    saveStore,
    currentRegion,
    currentRoute,
    getAdventureEncounterType,
    getAdventureEncounterEntry,
    getAdventureEncounterCount,
    getAdventureEncounterIndex,
    getAdventureSourceName,
    saveGameSafe,
    gainCharacterExp,
    hasPhoenixBlessing,
    hasHeroSkill,
    applySceneContext
  } = foundation;

  const runRecords = createRunRecords({
    state,
    saveStore,
    currentRegion,
    currentRoute,
    questRuntime: world?.questRuntime,
    saveGameSafe
  });
  const bossSelection = createBossSelection({ state });
  let battleState;

  const combatRenderer = createCombatRenderer({
    state,
    els,
    runStartingFlees: RUN_STARTING_FLEES,
    getAdventureEncounterCount,
    getAdventureEncounterIndex,
    getAdventureSourceName,
    hasPendingThreat: (...args) => battleState.hasPendingThreat(...args),
    selectEnemyTarget: (...args) => battleState.selectEnemyTarget(...args),
    questRuntime: world?.questRuntime
  });

  const battleLog = createBattleLog({ state, templates, renderLog: combatRenderer.renderLog });
  const battleSkills = createBattleSkills({
    state,
    hasHeroSkill,
    addLog: battleLog.addLog,
    addFixedLog: battleLog.addFixedLog,
    lastBagFlowWeightMultiplier: LAST_BAG_FLOW_WEIGHT_MULTIPLIER
  });
  const preparationBattleEffects = createPreparationBattleEffects({
    state,
    addFixedLog: battleLog.addFixedLog
  });

  battleState = createBattleState({
    state,
    counterEscapeScalingOffset: COUNTER_ESCAPE_SCALING_OFFSET,
    currentRoute,
    getAdventureEncounterType,
    addLog: battleLog.addLog,
    addFixedLog: battleLog.addFixedLog,
    applyBattleStartSkills: battleSkills.applyBattleStartSkills,
    render: combatRenderer.render
  });

  const battleSettlement = createBattleSettlement({
    state,
    saveStore,
    counterEscapeHealRatio: COUNTER_ESCAPE_HEAL_RATIO,
    addLog: battleLog.addLog,
    addFixedLog: battleLog.addFixedLog,
    gainCharacterExp,
    recordEnemyDefeated: runRecords.recordEnemyDefeated,
    hasPhoenixBlessing,
    saveGameSafe,
    applyVictorySkills: battleSkills.applyVictorySkills,
    consumeBattleLimitedEffects: battleSkills.consumeBattleLimitedEffects,
    render: combatRenderer.render,
    showBlessings
  });

  const encounterController = createEncounterController({
    state,
    els,
    currentRegion,
    currentRoute,
    getAdventureEncounterEntry,
    getAdventureEncounterType,
    getAdventureSourceName,
    beginBattleRuntime: battleState.beginBattleRuntime,
    setCombatActionState: combatRenderer.setCombatActionState,
    applySceneContext,
    addLog: battleLog.addLog,
    addFixedLog: battleLog.addFixedLog,
    logCurrentEnemyGroupEncounter: battleState.logCurrentEnemyGroupEncounter,
    render: combatRenderer.render
  });

  const battleTurnController = createBattleTurnController({
    state,
    createCombatLogger: battleLog.createCombatLogger,
    currentTargetEnemy: battleState.currentTargetEnemy,
    runHeroPlayerAction: preparationBattleEffects.runHeroPlayerAction,
    modifyIncomingDirectDamage: preparationBattleEffects.modifyIncomingDirectDamage,
    consumeEntangleRetry: preparationBattleEffects.consumeEntangleRetry,
    recordEntangleRetryResult: preparationBattleEffects.recordEntangleRetryResult,
    modifyPoisonDamage: preparationBattleEffects.modifyPoisonDamage,
    settleDefeatedEnemies: battleSettlement.settleDefeatedEnemies,
    applyEmergencyBandage: battleSkills.applyEmergencyBandage,
    tryLastStand: battleSkills.tryLastStand,
    winEncounter,
    loseRun,
    render: combatRenderer.render
  });

  return Object.freeze({
    runRecords,
    bossSelection,
    battleState,
    combatRenderer,
    battleLog,
    battleSkills,
    preparationBattleEffects,
    battleSettlement,
    encounterController,
    battleTurnController,
    ...runRecords,
    ...bossSelection,
    ...battleState,
    ...combatRenderer,
    ...battleLog,
    ...battleSkills,
    ...preparationBattleEffects,
    ...battleSettlement,
    ...encounterController,
    ...battleTurnController
  });
}
