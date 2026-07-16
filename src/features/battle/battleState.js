import { resetBattleEntryState } from "../../adventure/battleLifecycle.js";
import { initializeCharacterBattleState } from "../../characters/skills/index.js";
import { createSkillState } from "../../core/progression.js";
import { beginPreparationBattle } from "../../core/preparations.js";
import {
  createRuntimeEnemyGroup,
  getEnemyDisplayName,
  getLivingEnemies,
  resolveTargetEnemy,
  resolveTargetEnemyId,
  restoreRuntimeEnemyGroup
} from "../../core/enemyGroups.js";
import { buildScaledEnemy } from "../../core/combat.js";
import { getEnemyDefinition } from "../../data/enemies/index.js";
import { clone, weightedRandomItem } from "../../utils.js";

export function createBattleState({
  state,
  counterEscapeScalingOffset,
  currentRoute,
  getAdventureEncounterType,
  addLog,
  addFixedLog,
  applyBattleStartSkills,
  render
}) {
  function clearEnemyGroup() {
    state.enemies = [];
    state.targetEnemyId = null;
  }

  function setEnemyGroup(entries, options = {}) {
    const { restore = false } = options;
    state.enemies = restore
      ? restoreRuntimeEnemyGroup(entries)
      : createRuntimeEnemyGroup(entries);
    state.targetEnemyId = resolveTargetEnemyId(state.enemies, null);
  }

  function currentTargetEnemy() {
    const target = resolveTargetEnemy(state.enemies, state.targetEnemyId);
    state.targetEnemyId = target?.runtimeId || null;
    return target;
  }

  function selectEnemyTarget(runtimeId) {
    const target = getLivingEnemies(state.enemies).find((enemy) => enemy.runtimeId === runtimeId);
    if (!target || state.ended || state.awaitingBlessing || state.phase === "safe") return;
    state.targetEnemyId = target.runtimeId;
    render();
  }

  function logCurrentEnemyGroupEncounter() {
    getLivingEnemies(state.enemies).forEach((enemy) => {
      addLog("system", "encounter", { enemy: getEnemyDisplayName(enemy) });
      if (enemy.intro) {
        addFixedLog("status", enemy.intro);
      }
    });
  }

  function clearPendingThreat() {
    state.pendingThreat = null;
  }

  function savePendingThreat(source) {
    const livingEnemies = getLivingEnemies(state.enemies);
    if (livingEnemies.length === 0) {
      clearPendingThreat();
      return;
    }
    state.pendingThreat = {
      enemies: clone(livingEnemies),
      encounterIndex: state.encounterIndex,
      routeEncounterIndex: state.routeEncounterIndex,
      activeRouteId: state.activeRouteId,
      battleEncounterType: state.battleEncounterType,
      turn: state.turn,
      source,
      battleSource: state.battleSource
    };
  }

  function hasPendingThreat(source = null) {
    return Boolean(state.pendingThreat && (!source || state.pendingThreat.source === source));
  }

  function resetHeroBattleState() {
    state.hero.poison = 0;
    state.hero.entangle = null;
    state.hero.battleAttackBonus = 0;
    state.hero.battleCritBonus = 0;
    state.hero.hasAttackedThisBattle = false;
    state.hero.statusFamiliarityLimitBonus = 0;
    state.hero.victoryHealBonusRatio = 0;
    state.hero.shield = state.hero.shieldStart;
    state.hero.skillState = createSkillState();
    initializeCharacterBattleState(state.hero);
  }

  function beginBattleRuntime(options = {}) {
    const {
      enemies = [],
      restoreEnemies = false,
      source = "main",
      encounterType = null,
      ambushAdvantage = false
    } = options;

    resetBattleEntryState(state, { source, encounterType, ambushAdvantage });
    setEnemyGroup(enemies, { restore: restoreEnemies });
    resetHeroBattleState();
    beginPreparationBattle(state.runPreparation);
    applyBattleStartSkills();
  }

  function healThreatEnemies(enemies, ratio) {
    return enemies.map((enemy) => {
      if (ratio <= 0 || enemy.hp <= 0) return { enemy, healed: 0 };
      const amount = Math.max(1, Math.round(enemy.maxHp * ratio));
      const before = enemy.hp;
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + amount);
      return { enemy, healed: enemy.hp - before };
    });
  }

  function resumePendingThreat(options = {}) {
    if (!Array.isArray(state.pendingThreat?.enemies) || state.pendingThreat.enemies.length === 0) {
      return false;
    }

    const { healRatio = 0, introText = "" } = options;
    const threat = state.pendingThreat;
    const restoredEnemies = restoreRuntimeEnemyGroup(threat.enemies);
    const healedEnemies = healThreatEnemies(restoredEnemies, healRatio);

    state.activeRouteId = threat.activeRouteId || null;
    state.routeEncounterIndex = Math.max(0, Number(threat.routeEncounterIndex) || 0);
    state.encounterIndex = threat.encounterIndex;
    clearPendingThreat();
    beginBattleRuntime({
      enemies: restoredEnemies,
      restoreEnemies: true,
      source: threat.battleSource || "main",
      encounterType: threat.battleEncounterType || getAdventureEncounterType()
    });

    if (introText) addFixedLog("system", introText);
    logCurrentEnemyGroupEncounter();
    healedEnemies.forEach(({ enemy, healed }) => {
      if (healed > 0) {
        addLog("heal", "enemyRecover", { enemy: getEnemyDisplayName(enemy), amount: healed });
      }
    });
    if (state.hero.shield > 0) {
      addLog("status", "shield", { target: state.hero.name, amount: state.hero.shield });
    }
    render();
    return true;
  }

  function buildCounterEnemy(region, encounterIndex) {
    const route = currentRoute();
    const scalingIndex = Math.max(0, encounterIndex - counterEscapeScalingOffset);
    if (route) {
      const candidates = (route.counterEnemyIds || []).map(getEnemyDefinition).filter(Boolean);
      const base = weightedRandomItem(candidates, () => 100);
      return buildScaledEnemy(base, region, scalingIndex);
    }
    const base = weightedRandomItem(region.enemies, (enemy) => Number(enemy.weight) || 100);
    return buildScaledEnemy(base, region, scalingIndex);
  }

  return Object.freeze({
    clearEnemyGroup,
    setEnemyGroup,
    currentTargetEnemy,
    selectEnemyTarget,
    logCurrentEnemyGroupEncounter,
    clearPendingThreat,
    savePendingThreat,
    hasPendingThreat,
    beginBattleRuntime,
    resumePendingThreat,
    buildCounterEnemy
  });
}
