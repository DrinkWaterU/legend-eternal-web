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
  prepareEnemyAction = () => {},
  completeEnemyAction = () => {},
  winEncounter,
  loseRun,
  render
}) {
  function playTurn(action = "attack") {
    if (state.ended || state.awaitingBlessing || getLivingEnemies(state.enemies).length === 0 || state.phase === "safe") return;

    const playerAction = action === "guard" ? "guard" : "attack";
    const log = createCombatLogger();
    state.phase = "combat";
    state.turn += 1;
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
      if (playerAction === "guard") {
        const guard = beginGuard(state.hero, DEFAULT_GUARD_DAMAGE_REDUCTION);
        log.fixed(
          "status",
          `你採取守勢，本回合直接傷害降低 ${Math.round(guard.damageReduction * 100)}%。`
        );
      }

      const target = currentTargetEnemy();
      if (playerAction === "attack") {
        if (!target) return;
        runHeroPlayerAction({ target, log });
      }
      settleDefeatedEnemies();
      if (getLivingEnemies(state.enemies).length === 0) {
        clearGuard(state.hero);
        winEncounter();
        return;
      }
    }

    const actingEnemies = [...getLivingEnemies(state.enemies)];
    for (const enemy of actingEnemies) {
      if (enemy.hp <= 0 || state.ended) continue;
      prepareEnemyAction(enemy);
      const supportActed = resolveEnemySupportAction({
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
      const enemyAction = resolveEnemyAction({
        hero: state.hero,
        enemy,
        turn: state.turn,
        log,
        modifyDirectDamage: modifyIncomingDirectDamage
      });
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
    clearGuard(state.hero);
    render();
  }

  return Object.freeze({ playTurn });
}
