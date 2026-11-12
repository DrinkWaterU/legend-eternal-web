import {
  advanceHeroCombatStatuses,
  advanceParalysis,
  applyEnemyEndOfTurnNegativeEffects,
  applyEnemyEndOfTurnRecoveryEffects,
  applyHeroEndOfTurnNegativeEffects,
  applyHeroEndOfTurnRecoveryEffects,
  resolveEnemyAction,
  resolveEnemySupportAction,
  resolveHeroEntangle
} from "../../core/combat.js";
import { beginGuard, clearGuard, DEFAULT_GUARD_DAMAGE_REDUCTION } from "../../core/guard.js";
import { getLivingEnemies } from "../../core/enemyGroups.js";
import { getWeaponActions, resetWeaponTechnique, runWeaponAttack, finishWeaponTurn, isSwiftRiposte } from "../../core/weaponTechniques.js";
import { highlandActions, highlandIntents, canReachHighlandTarget, actOnHighland, resolveHighlandWind, resolveHighlandEnemyIntent, updateHighlandProtection, lockHighlandIntents, projectHighlandWind } from "../../core/highlandBattle.js";
import { canTakeBattleAction } from "../../core/battleActions.js";
import { HAMMER_TRAINING_WEAPON } from "../../core/hammerTraining.js";

export function createBattleTurnController({
  state,
  createCombatLogger,
  currentTargetEnemy,
  runHeroPlayerAction,
  modifyIncomingDirectDamage,
  consumeEntangleRetry,
  recordEntangleRetryResult,
  modifyPoisonDamage,
  settleDefeatedEnemies,
  applyEmergencyBandage,
  tryLastStand,
  recordTactic = () => {},
  recordSwordRiposte = () => {},
  recordHammerBreak = () => {},
  prepareEnemyAction = () => {},
  completeEnemyAction = () => {},
  withLogBatch = (action) => action(),
  runSaveOperation = (action) => action(),
  winEncounter,
  loseRun,
  render
}) {
  function playTurn(action = "attack") {
    if (!canTakeBattleAction(state)) return;
    const request = typeof action === "string" ? { type: action } : action;
    const target = currentTargetEnemy();
    const allowed = request && (["attack", "guard"].includes(request.type) || (state.highlandBattle && request.type === "flee-failure")
      || getWeaponActions(state.hero).some(a => a.type === request.type)
      || highlandActions(state).some(a => a.type === request.type && a.column === request.column));
    if (!allowed) return false;
    if (request.type === "breach" && (!target || target.weaponBreach || state.turn + 1 <= (target.breachCooldownUntil ?? -1))) return false;
    if (request.type === "breach-wave" && (getLivingEnemies(state.enemies).length < 2
      || state.hero.weaponRuntime?.impact !== 3
      || state.hero.equipment?.weaponId !== HAMMER_TRAINING_WEAPON
      || state.hero.equipment?.hammerTechniqueUnlocked !== true)) return false;
    if (["attack", "lunge", "sweep", "cleave", "breach", "breach-wave"].includes(request.type) && (!target || !canReachHighlandTarget(state, target, request.type))) return false;
    return runSaveOperation(() => withLogBatch(() => {
      if (["slip", "tool-step"].includes(request.type)) {
        if (state.highlandBattle.freeRepositionTurn !== state.turn) state.highlandBattle.freeRepositionOrigin = state.hero.battleColumn;
        if (request.type === "slip") { state.hero.battleColumn = request.column; state.highlandBattle.slipUsed = true; }
        else actOnHighland(state, request, createCombatLogger());
        state.highlandBattle.freeRepositionTurn = state.turn;
        state.turnActionId = (state.turnActionId || 0) + 1;
        render(); return;
      }
      return resolveTurn(request);
    }));
  }

  function resolveTurn(action) {

    const playerAction = action.type;
    const intents = highlandIntents(state);
    if (!state.hero.weaponRuntime) resetWeaponTechnique(state.hero);
    const log = createCombatLogger();
    state.phase = "combat";
    if (state.highlandBattle) {
      state.highlandBattle.actionOriginColumn = state.hero.battleColumn;
      state.highlandBattle.baselineWind = Object.fromEntries(projectHighlandWind(state).filter(p => p.unit !== state.hero).map(p => [p.unit.runtimeId, p.destination]));
    }
    state.turn += 1;
    state.turnActionId = (state.turnActionId || 0) + 1;
    state.lastPlayerAction = playerAction;
    clearGuard(state.hero);
    advanceHeroCombatStatuses(state.hero);
    state.hero.activeEnemyCount = getLivingEnemies(state.enemies).length;
    const heroEntangled = resolveHeroEntangle({
      hero: state.hero,
      log,
      retryOnFailure: () => consumeEntangleRetry(log),
      onRetryResult: recordEntangleRetryResult
    });
    if (!heroEntangled) {
      if (["guard", "hold"].includes(playerAction)) {
        const guard = beginGuard(state.hero, playerAction === "hold" || isSwiftRiposte(state.hero) ? .2 : DEFAULT_GUARD_DAMAGE_REDUCTION);
        log.fixed(
          "status",
          `你採取守勢，本回合直接傷害降低 ${Math.round(guard.damageReduction * 100)}%。`
        );
      }

      const target = currentTargetEnemy();
      if (["move", "ride", "break", "demolish", "gust-break", "shove", "tool-brace", "tool-rock"].includes(playerAction)) {
        actOnHighland(state, action, log);
        const brokeRock = ["break", "demolish", "gust-break"].includes(playerAction)
          || (playerAction === "shove" && state.highlandBattle.interruptedEnemyTurn === state.turn);
        if (brokeRock && !state.debugBuildRun) recordTactic({ regionId: state.selectedRegionId, tactic: "breakRock", debugBuildRun: false });
      }
      if (playerAction === "charge") {
        state.hero.weaponRuntime.charge = 3;
        log.fixed("status", "你開始蓄射，兩回合內可釋放；敵人仍會行動。");
      }
      if (["attack", "lunge", "sweep", "cleave", "breach"].includes(playerAction)) {
        if (!target) return;
        if (playerAction === "lunge") state.hero.battleColumn = target.battleColumn;
        const hammerTrainingReady = state.hero.equipment?.weaponId === HAMMER_TRAINING_WEAPON
          && state.selectedRegionId === "highlands"
          && state.hammerTrainingStartEnemyCount >= 2;
        const fullImpactBreach = playerAction === "breach" && hammerTrainingReady
          && state.hero.weaponRuntime.impact === 3;
        const followsFullImpactBreach = ["attack", "lunge"].includes(playerAction)
          && state.hammerTrainingBreachTargetId === target.runtimeId
          && target.weaponBreach?.strength === 3;
        const breachStrength = followsFullImpactBreach ? target.weaponBreach.strength : 0;
        const attackResult = runWeaponAttack({ state, action: playerAction, target, log, runAttack: () => runHeroPlayerAction({ target, log }) });
        if (["attack", "lunge"].includes(playerAction) && attackResult?.primaryHit
          && attackResult?.riposteDamage > 0 && attackResult.riposteFromStandardGuard) {
          recordSwordRiposte({
            regionId: state.selectedRegionId,
            weaponId: state.hero.equipment?.weaponId,
            battleSource: state.battleSource,
            debugBuildRun: state.debugBuildRun,
            playerAction,
            riposteDamage: attackResult.riposteDamage,
            riposteFromStandardGuard: attackResult.riposteFromStandardGuard
          });
        }
        if (fullImpactBreach && attackResult?.primaryHit && target.hp > 0 && target.weaponBreach?.strength === 3) {
          state.hammerTrainingBreachTargetId = target.runtimeId;
        }
        if (followsFullImpactBreach && attackResult?.primaryHit) {
          recordHammerBreak({
            regionId: state.selectedRegionId,
            weaponId: state.hero.equipment?.weaponId,
            battleSource: state.battleSource,
            debugBuildRun: state.debugBuildRun,
            battleStartEnemyCount: state.hammerTrainingStartEnemyCount,
            playerAction,
            breachTargetId: state.hammerTrainingBreachTargetId,
            targetId: target.runtimeId,
            breachStrength,
            primaryHit: true
          });
          state.hammerTrainingBreachTargetId = null;
        }
      }
      if (playerAction === "breach-wave") {
        if (!target) return;
        const attackResult = runWeaponAttack({ state, action: playerAction, target, log, runAttack: () => runHeroPlayerAction({ target, log }) });
        if (!attackResult?.primaryHit) log.fixed("status", "攻擊未命中，沒有發出裂陣震波。");
      }
      settleDefeatedEnemies();
      if (getLivingEnemies(state.enemies).length === 0) {
        clearGuard(state.hero);
        winEncounter();
        return;
      }
    }

    resolveHighlandWind(state, heroEntangled ? { type: "cancelled" } : action, intents, log);
    const actingEnemies = [...getLivingEnemies(state.enemies)];
    for (const enemy of actingEnemies) {
      if (enemy.hp <= 0 || state.ended) continue;
      prepareEnemyAction(enemy);
      const windIntent = intents.find(i => i.id === enemy.runtimeId);
      const collisionsBefore = state.highlandBattle?.inducedCollisions || 0;
      if (resolveHighlandEnemyIntent(state, enemy, windIntent, heroEntangled ? { type: "cancelled" } : action, log)) {
        if ((state.highlandBattle?.inducedCollisions || 0) > collisionsBefore && !state.debugBuildRun)
          recordTactic({ regionId: state.selectedRegionId, tactic: "inducedCollision", debugBuildRun: false });
        settleDefeatedEnemies(); completeEnemyAction(enemy); advanceParalysis(enemy); continue;
      }
      if ((state.highlandBattle?.inducedCollisions || 0) > collisionsBefore && !state.debugBuildRun)
        recordTactic({ regionId: state.selectedRegionId, tactic: "inducedCollision", debugBuildRun: false });
      settleDefeatedEnemies();
      const supportActed = !state.highlandBattle && resolveEnemySupportAction({
        enemies: state.enemies,
        actor: enemy,
        turn: state.turn,
        log,
        hero: state.hero
      });
      if (supportActed) {
        advanceParalysis(enemy);
        completeEnemyAction(enemy);
        continue;
      }
      const originalAttack = enemy.attack;
      if (windIntent && windIntent.kind !== "flurry") enemy.attack *= windIntent.attackRatio || 1;
      if (state.hero.windStagger) { enemy.attack += 8; state.hero.windStagger = false; }
      const enemyAction = resolveEnemyAction({
        hero: state.hero,
        enemy: state.highlandBattle ? { ...enemy, specialAttack: windIntent?.kind === "flurry" ? {
          id: "highland-double-strike", name: "雙段連斬", everyTurns: 1,
          hits: [{ label: "第一斬", attackRatio: .65 }, { label: "第二斬", attackRatio: .65 }]
        } : null, chargeEvery: null } : enemy,
        turn: state.turn,
        log,
        modifyDirectDamage: modifyIncomingDirectDamage
      });
      enemy.attack = originalAttack;
      completeEnemyAction(enemy);
      advanceParalysis(enemy);
      applyEmergencyBandage();
      if (state.hero.hp <= 0) {
        state.deathCause = enemyAction;
        if (!tryLastStand()) {
          clearGuard(state.hero);
          loseRun();
          return;
        }
      }
    }

    finishWeaponTurn(state);
    lockHighlandIntents(state);
    updateHighlandProtection(state);
    const endOfTurn = applyHeroEndOfTurnNegativeEffects({
      hero: state.hero,
      log,
      modifyPoisonDamage: ({ damage }) => modifyPoisonDamage(damage)
    });
    getLivingEnemies(state.enemies).forEach((enemy) => applyEnemyEndOfTurnNegativeEffects({
      enemy,
      enemies: state.enemies,
      log
    }));
    applyHeroEndOfTurnRecoveryEffects({ hero: state.hero, turn: state.turn, log });
    state.enemies.forEach((enemy) => applyEnemyEndOfTurnRecoveryEffects({ enemy, turn: state.turn, log }));

    if (state.hero.hp <= 0) {
      state.deathCause = endOfTurn.heroDeathCause || { type: "other", label: "回合結束效果" };
      if (!tryLastStand()) {
        clearGuard(state.hero);
        loseRun();
        return;
      }
    }

    settleDefeatedEnemies();
    if (getLivingEnemies(state.enemies).length === 0) {
      clearGuard(state.hero);
      winEncounter();
      return;
    }
    state.hero.activeEnemyCount = getLivingEnemies(state.enemies).length;
    if (state.hammerTrainingBreachTargetId && !getLivingEnemies(state.enemies).some(enemy =>
      enemy.runtimeId === state.hammerTrainingBreachTargetId && enemy.weaponBreach?.strength === 3)) {
      state.hammerTrainingBreachTargetId = null;
    }
    clearGuard(state.hero);
    render();
  }

  return Object.freeze({ playTurn });
}
