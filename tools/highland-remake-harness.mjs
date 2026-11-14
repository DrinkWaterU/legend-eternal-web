import { createAdventureRuntimeState } from "../src/app/runtimeState.js";
import { characterDefinitions } from "../src/data/characters/index.js";
import { regionDefinitions } from "../src/data/regions/index.js";
import { weaponDefinitions } from "../src/data/weapons.js";
import { buildHeroFromProgression } from "../src/core/progression.js";
import { getRouteDefinition, getRouteGroup } from "../src/data/routes/index.js";
import { getEnemyDefinition } from "../src/data/enemies/index.js";
import { buildScaledEnemy } from "../src/core/combat.js";
import { createBattleState } from "../src/features/battle/battleState.js";
import { createBattleSkills } from "../src/features/battle/battleSkills.js";
import { createPreparationBattleEffects } from "../src/features/battle/preparationBattleEffects.js";
import { createBattleTurnController } from "../src/features/battle/battleTurnController.js";
import { createBattleSettlement } from "../src/features/battle/battleSettlement.js";
import { createDefaultSave } from "../src/core/saveDefaults.js";

export function remakeHarness({ character = "adventurer", weapon = "adventurer-pathfinder-sword", region = "highlands", index = 2, level = 30, quiet = false, configure = () => ({}) } = {}) {
  const state = createAdventureRuntimeState({ regionDefinitions, characterDefinitions });
  Object.assign(state, { selectedRegionId: region, selectedHeroId: character, activeRouteId: region === "highlands" ? "windbreak-ascent" : null,
    routeEncounterIndex: index, encounterIndex: index, runStats: { levelUps: [], learnedSkills: [], unlockedCharacters: [], rewards: { gold: 0, materials: {} }, fleeFailures: 0 }, runRandomState: 42 });
  state.hero = buildHeroFromProgression(characterDefinitions[character], { level, exp: 0, learnedSkills: [], equipment: { weaponId: weapon } },
    { inventory: { weapons: { [weapon]: true } }, weaponDefinitions });
  const messages = [];
  const log = { fixed: (type, text) => { if (!quiet) messages.push({ type, text }); }, template: (type, key, values) => { if (!quiet) messages.push({ type, key, values }); } };
  const skills = createBattleSkills({ state, hasHeroSkill: id => state.hero.skills.includes(id), addLog: log.template, addFixedLog: log.fixed, lastBagFlowWeightMultiplier: .6 });
  const route = getRouteDefinition("windbreak-ascent");
  const battle = createBattleState({ state, counterEscapeScalingOffset: 1, currentRoute: () => route,
    getAdventureEncounterType: () => "normal", addLog: log.template, addFixedLog: log.fixed, applyBattleStartSkills: skills.applyBattleStartSkills, render: () => {} });
  const entry = route.encounterPlan[index];
  const enemies = getRouteGroup(route, entry.groupId).members.map(m => ({ enemy: buildScaledEnemy(getEnemyDefinition(m.enemyId), regionDefinitions.highlands, index), statScale: m.statScale, rewardScale: m.rewardScale }));
  battle.beginBattleRuntime({ enemies, encounterType: entry.type });
  const effects = createPreparationBattleEffects({ state, addFixedLog: log.fixed });
  const permanent = createDefaultSave();
  const settlement = createBattleSettlement({ state, saveStore: { current: permanent }, counterEscapeHealRatio: .1,
    addLog: log.template, addFixedLog: log.fixed, gainCharacterExp: () => {}, settleCharacterProgression: () => {}, recordEnemyDefeated: () => {},
    hasPhoenixBlessing: () => true, saveGameSafe: () => {}, applyVictorySkills: skills.applyVictorySkills, consumeBattleLimitedEffects: skills.consumeBattleLimitedEffects,
    render: () => {}, showBlessings: () => {} });
  const controller = createBattleTurnController({ state, currentTargetEnemy: battle.currentTargetEnemy, createCombatLogger: () => log,
    runHeroPlayerAction: effects.runHeroPlayerAction, modifyIncomingDirectDamage: effects.modifyIncomingDirectDamage,
    consumeEntangleRetry: effects.consumeEntangleRetry, recordEntangleRetryResult: effects.recordEntangleRetryResult,
    modifyPoisonDamage: effects.modifyPoisonDamage, settleDefeatedEnemies: settlement.settleDefeatedEnemies,
    applyEmergencyBandage: skills.applyEmergencyBandage, tryLastStand: skills.tryLastStand,
    winEncounter: () => { state.ended = true; state.outcome = "victory"; }, loseRun: () => { state.ended = true; state.outcome = "defeat"; }, render: () => {}, ...configure({ state, permanent }) });
  return { state, controller, battle, settlement, skills, permanent, messages };
}
