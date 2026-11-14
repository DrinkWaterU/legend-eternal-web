// Review experiments use production battle entry, skills, turn and settlement.
// Levels stay fixed: no EXP, events, preparations or retreat simulation.
import { createAdventureRuntimeState } from '../src/app/runtimeState.js';
import { characterDefinitions } from '../src/data/characters/index.js';
import { regionDefinitions } from '../src/data/regions/index.js';
import { weaponDefinitions } from '../src/data/weapons.js';
import { buildHeroFromProgression } from '../src/core/progression.js';
import { getRouteDefinition, getRouteGroup } from '../src/data/routes/index.js';
import { getEnemyDefinition } from '../src/data/enemies/index.js';
import { buildEnemy, buildEnemyGroup, buildScaledEnemy } from '../src/core/combat.js';
import { createBattleState } from '../src/features/battle/battleState.js';
import { createBattleSkills } from '../src/features/battle/battleSkills.js';
import { createPreparationBattleEffects } from '../src/features/battle/preparationBattleEffects.js';
import { createBattleTurnController } from '../src/features/battle/battleTurnController.js';
import { createBattleSettlement } from '../src/features/battle/battleSettlement.js';
import { createDefaultSave } from '../src/core/saveDefaults.js';
import { recordHammerBreak } from '../src/core/hammerTraining.js';
import { recordSwordTraining } from '../src/core/weaponTraining.js';
import { applyBlessingEffects } from '../src/core/blessings.js';
import { highlandPathChoices } from '../src/data/highlandPaths.js';
import { withRunRandom } from '../src/core/runSnapshot.js';

export function reviewHarness({region='highlands', level=28, weapon='cairn-warhammer', mode='steady', unlocked=false, seed=42, path='shelter', blessings=[]}={}) {
  const state=createAdventureRuntimeState({regionDefinitions,characterDefinitions});
  Object.assign(state,{selectedRegionId:region,selectedHeroId:'adventurer',activeRouteId:region==='highlands'?'windbreak-ascent':null,runRandomState:seed,
    highlandChoices:{0:path,4:path,8:path},runStats:{levelUps:[],learnedSkills:[],unlockedCharacters:[],rewards:{gold:0,materials:{}},fleeFailures:0}});
  state.hero=buildHeroFromProgression(characterDefinitions.adventurer,{level,exp:0,learnedSkills:[],equipment:{weaponId:weapon}},
    {inventory:{weapons:{[weapon]:true}},weaponDefinitions});
  Object.assign(state.hero.equipment,{trainingMode:mode,hammerTechniqueUnlocked:unlocked});
  const messages=[], trainingEvents=[], permanent=createDefaultSave();
  const log={fixed:(type,text)=>messages.push({type,text}),template:(type,key,values)=>messages.push({type,key,values})};
  const skills=createBattleSkills({state,hasHeroSkill:id=>state.hero.skills.includes(id),addLog:log.template,addFixedLog:log.fixed,lastBagFlowWeightMultiplier:.6});
  const route=region==='highlands'?getRouteDefinition('windbreak-ascent'):null;
  const battle=createBattleState({state,counterEscapeScalingOffset:1,currentRoute:()=>route,getAdventureEncounterType:()=>state.battleEncounterType,
    addLog:log.template,addFixedLog:log.fixed,applyBattleStartSkills:skills.applyBattleStartSkills,runSaveOperation:action=>withRunRandom(state,action),render(){}});
  const effects=createPreparationBattleEffects({state,addFixedLog:log.fixed});
  const settlement=createBattleSettlement({state,saveStore:{current:permanent},counterEscapeHealRatio:.1,addLog:log.template,addFixedLog:log.fixed,
    gainCharacterExp(){},settleCharacterProgression(){},recordEnemyDefeated(){},hasPhoenixBlessing:()=>true,saveGameSafe(){},
    applyVictorySkills:skills.applyVictorySkills,consumeBattleLimitedEffects:skills.consumeBattleLimitedEffects,render(){},showBlessings(){}});
  const controller=createBattleTurnController({state,currentTargetEnemy:battle.currentTargetEnemy,createCombatLogger:()=>log,
    runSaveOperation:action=>withRunRandom(state,action),
    runHeroPlayerAction:effects.runHeroPlayerAction,modifyIncomingDirectDamage:effects.modifyIncomingDirectDamage,
    consumeEntangleRetry:effects.consumeEntangleRetry,recordEntangleRetryResult:effects.recordEntangleRetryResult,
    modifyPoisonDamage:effects.modifyPoisonDamage,settleDefeatedEnemies:settlement.settleDefeatedEnemies,
    applyEmergencyBandage:skills.applyEmergencyBandage,tryLastStand:skills.tryLastStand,
    recordHammerBreak(event){if(recordHammerBreak(permanent,event))trainingEvents.push({kind:'hammer',turn:state.turn,living:state.enemies.filter(e=>e.hp>0).length,event});},
    recordSwordRiposte(event){if(recordSwordTraining(permanent,event))trainingEvents.push({kind:'sword',turn:state.turn,event});},
    winEncounter(){state.ended=true;state.outcome='victory';},loseRun(){state.ended=true;state.outcome='defeat';},render(){}});
  function bless(id){const b=regionDefinitions[region].blessings.find(b=>b.id===id);if(!b)throw new Error(`Illegal ${region} blessing ${id}`);applyBlessingEffects(state.hero,b,{instanceId:`review-${id}-${state.hero.blessings?.length||0}`});}
  blessings.forEach(bless);
  function begin(index,optionIndex=0){return withRunRandom(state,()=>{
    Object.assign(state,{ended:false,outcome:null,encounterIndex:index,routeEncounterIndex:index});
    const def=regionDefinitions[region],entry=(route||def).encounterPlan[index],type=typeof entry==='string'?entry:entry.type;
    let enemies;
    if(route){const choice=highlandPathChoices[index]?.find(c=>c.id===path);enemies=getRouteGroup(route,choice?.groupId||entry.groupId).members.map(m=>({enemy:buildScaledEnemy(getEnemyDefinition(m.enemyId),def,index),statScale:m.statScale,rewardScale:m.rewardScale}));}
    else if(type==='boss')enemies=[{enemy:buildEnemy(def,index,state.hero)}];
    else enemies=buildEnemyGroup(def,index,state.hero,entry.groupOptions?.[optionIndex]||{});
    battle.beginBattleRuntime({enemies,encounterType:type});
  });}
  return {state,messages,trainingEvents,permanent,controller,battle,skills,begin,bless};
}

export function withReviewRandom(seed, callback){
  const old=Math.random;let current=seed>>>0;
  Math.random=()=>{current=(Math.imul(current,1664525)+1013904223)>>>0;return current/4294967296;};
  try{return callback(()=>current);}finally{Math.random=old;}
}
