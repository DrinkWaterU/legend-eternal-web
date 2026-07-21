import { resolveEnemyAction } from "../../core/combat.js";
import {
  getEnemyDisplayName,
  getEnemyGroupLabel,
  getEnemyGroupThreatKind,
  getLivingEnemies
} from "../../core/enemyGroups.js";
import { canFleeBattle, getBattleFleeChance } from "../../core/fleeRules.js";
import { shouldTriggerScheduledEvent } from "../../core/events.js";
import { randomItem, roll, weightedRandomItem } from "../../utils.js";

export function createEscapeController({
  state,
  normalFleeChance,
  eliteFleeChance,
  tacticalFleeResults,
  safeEscapeEnemyHealRatio,
  restHealRatio,
  createCombatLogger,
  modifyIncomingDirectDamage,
  applyEmergencyBandage,
  tryLastStand,
  loseRun,
  addLog,
  render,
  savePendingThreat,
  hasPendingThreat,
  clearPendingThreat,
  consumeBattleLimitedEffects,
  enterSafeState,
  buildCounterEnemy,
  currentRegion,
  currentRoute = () => null,
  currentTargetEnemy,
  beginBattleRuntime,
  finishRun,
  setCombatActionState,
  resumePendingThreat,
  getAdventureEncounterIndex,
  getEventRuntime,
  startEncounter
}) {
  function resolveFleeFailure() {
    const attacker = randomItem(getLivingEnemies(state.enemies));
    if (!attacker) return;
    state.runStats.fleeFailures += 1;
    addLog("system", "fleeFail", { enemy: getEnemyGroupLabel(state.enemies) });
    const log = createCombatLogger();
    resolveEnemyAction({
      hero: state.hero,
      enemy: attacker,
      turn: Math.max(1, state.turn),
      log,
      modifyDirectDamage: modifyIncomingDirectDamage
    });
    applyEmergencyBandage();
    if (state.hero.hp <= 0) {
      state.deathCause = {
        type: "fleeFailure",
        label: `逃跑失敗後被${getEnemyDisplayName(attacker)}擊倒`
      };
      if (!tryLastStand()) {
        loseRun();
        return;
      }
    }
    state.phase = "combat";
    render();
  }

  function resolveSafeEscape() {
    state.runStats.safeEscapes += 1;
    savePendingThreat("safeEscape");
    addLog("system", "safeEscape", { enemy: getEnemyGroupLabel(state.pendingThreat?.enemies || []) });
    consumeBattleLimitedEffects();
    enterSafeState({ canRest: true });
  }

  function resolveCounterEscape() {
    state.runStats.counterEscapes += 1;
    savePendingThreat("counterEscape");
    addLog("system", "counterEscape");
    consumeBattleLimitedEffects();
    const counterEnemy = buildCounterEnemy(currentRegion(), state.encounterIndex);
    counterEnemy.poison = 0;
    beginBattleRuntime({
      enemies: [counterEnemy],
      source: "counterEscape",
      encounterType: "counter",
      ambushAdvantage: true
    });
    const enemy = currentTargetEnemy();
    const reducedHp = Math.max(1, Math.round(enemy.maxHp * 0.85));
    const reducedAmount = enemy.maxHp - reducedHp;
    enemy.hp = reducedHp;
    addLog("system", "counterEscape");
    addLog("system", "encounter", { enemy: getEnemyDisplayName(enemy) });
    addLog("hero-damage", "ambushAdvantage", { enemy: getEnemyDisplayName(enemy), amount: reducedAmount });
    render();
  }

  function resolveEvacuationEscape() {
    state.runStats.evacuationEscapes += 1;
    state.runStats.evacuated = true;
    state.runStats.retreated = true;
    clearPendingThreat();
    addLog("system", "evacuationEscape");
    finishRun("retreat");
  }

  function tryFlee() {
    const livingEnemies = getLivingEnemies(state.enemies);
    if (!state.hero || livingEnemies.length === 0 || state.ended || state.awaitingBlessing || state.phase === "safe") return;
    const threatKind = getEnemyGroupThreatKind(livingEnemies);
    if (!canFleeBattle(state.battleEncounterType)) return;
    const hasTacticalFlees = state.hero.fleesRemaining > 0;
    if (hasTacticalFlees) state.hero.fleesRemaining -= 1;
    state.runStats.fleeAttempts += 1;
    addLog("system", "fleeAttempt", { enemy: getEnemyGroupLabel(livingEnemies) });
    const fleeChance = getBattleFleeChance({
      encounterType: state.battleEncounterType,
      threatKind,
      normalChance: normalFleeChance,
      eliteChance: eliteFleeChance,
      routeFleeChance: currentRoute()?.fleeChance
    });
    if (!roll(fleeChance)) {
      resolveFleeFailure();
      return;
    }
    if (!hasTacticalFlees) {
      resolveEvacuationEscape();
      return;
    }
    state.runStats.fleeSuccesses += 1;
    const result = weightedRandomItem(tacticalFleeResults, (item) => item.weight);
    if (result.id === "counter") resolveCounterEscape();
    else resolveSafeEscape();
  }

  function continueAdventure() {
    if (state.phase !== "safe" || state.ended || state.adventureProgressLocked) return;
    state.adventureProgressLocked = true;
    setCombatActionState();
    if (hasPendingThreat("safeEscape")) {
      resumePendingThreat({
        healRatio: safeEscapeEnemyHealRatio,
        introText: "你重新回到原本的戰鬥。"
      });
      state.adventureProgressLocked = false;
      return;
    }
    if (shouldTriggerScheduledEvent(state.eventSchedule, getAdventureEncounterIndex())) {
      getEventRuntime()?.beginScheduledEvent();
      return;
    }
    startEncounter();
  }

  function restAtSafeRoute() {
    if (state.phase !== "safe" || !state.canRest || state.hasRested || state.ended) return;
    const amount = Math.max(1, Math.round(state.hero.maxHp * restHealRatio));
    const before = state.hero.hp;
    state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + amount);
    state.hasRested = true;
    state.canRest = false;
    addLog("heal", "rest", { amount: state.hero.hp - before });
    render();
  }

  function retreatRun() {
    if (state.phase !== "safe" || state.ended) return;
    state.runStats.retreated = true;
    clearPendingThreat();
    addLog("system", "retreat");
    finishRun("retreat");
  }

  return Object.freeze({ tryFlee, continueAdventure, restAtSafeRoute, retreatRun });
}
