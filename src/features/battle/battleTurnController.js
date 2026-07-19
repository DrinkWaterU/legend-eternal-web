import {
  advanceHeroCombatStatuses,
  applyEnemyEndOfTurnNegativeEffects,
  applyEnemyEndOfTurnRecoveryEffects,
  applyHeroEndOfTurnNegativeEffects,
  applyHeroEndOfTurnRecoveryEffects,
  resolveEnemyAction,
  resolveHeroEntangle
} from "../../core/combat.js";
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
  winEncounter,
  loseRun,
  render
}) {
  function playTurn() {
    if (state.ended || state.awaitingBlessing || getLivingEnemies(state.enemies).length === 0 || state.phase === "safe") return;

    const log = createCombatLogger();
    state.phase = "combat";
    state.turn += 1;
    advanceHeroCombatStatuses(state.hero);
    state.hero.activeEnemyCount = getLivingEnemies(state.enemies).length;
    const heroEntangled = resolveHeroEntangle({
      hero: state.hero,
      log,
      retryOnFailure: () => consumeEntangleRetry(log),
      onRetryResult: recordEntangleRetryResult
    });
    if (!heroEntangled) {
      const target = currentTargetEnemy();
      if (!target) return;
      runHeroPlayerAction({ target, log });
      settleDefeatedEnemies();
      if (getLivingEnemies(state.enemies).length === 0) {
        winEncounter();
        return;
      }
    }

    const actingEnemies = [...getLivingEnemies(state.enemies)];
    for (const enemy of actingEnemies) {
      if (enemy.hp <= 0 || state.ended) continue;
      const enemyAction = resolveEnemyAction({
        hero: state.hero,
        enemy,
        turn: state.turn,
        log,
        modifyDirectDamage: modifyIncomingDirectDamage
      });
      applyEmergencyBandage();
      if (state.hero.hp <= 0) {
        state.deathCause = enemyAction;
        if (!tryLastStand()) {
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
    getLivingEnemies(state.enemies).forEach((enemy) => applyEnemyEndOfTurnNegativeEffects({ enemy, log }));
    applyHeroEndOfTurnRecoveryEffects({ hero: state.hero, turn: state.turn, log });
    state.enemies.forEach((enemy) => applyEnemyEndOfTurnRecoveryEffects({ enemy, turn: state.turn, log }));

    if (state.hero.hp <= 0) {
      state.deathCause = endOfTurn.heroDeathCause || { type: "other", label: "回合結束效果" };
      if (!tryLastStand()) {
        loseRun();
        return;
      }
    }

    settleDefeatedEnemies();
    if (getLivingEnemies(state.enemies).length === 0) {
      winEncounter();
      return;
    }
    render();
  }

  return Object.freeze({ playTurn });
}
