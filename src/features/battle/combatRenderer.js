import { renderTacticalBattle } from "../../ui/tacticalBattleView.js";
import { canReachHighlandTarget } from "../../core/highlandBattle.js";
import { canFleeBattle } from "../../core/fleeRules.js";
import { canTakeBattleAction } from "../../core/battleActions.js";
import { resolveTargetEnemyId } from "../../core/enemyGroups.js";
import { getPreparationCombatStatus } from "../../core/preparations.js";
import { getCharacterCombatStatusEntries } from "../../characters/skills/index.js";
import { getEventDefinition } from "../../data/events/index.js";
import { renderCombatView, renderCurrentAbilityView } from "../../ui/combatView.js";
import { renderBattleLog } from "../../ui/renderHelpers.js";

export function createCombatRenderer({
  state,
  els,
  runStartingFlees,
  getAdventureEncounterCount,
  getAdventureEncounterIndex,
  getAdventureSourceName,
  hasPendingThreat,
  selectEnemyTarget,
  questRuntime,
  choosePath
}) {
  function setCombatActionState() {
    const isBoss = !canFleeBattle(state.battleEncounterType);
    const inGame = state.hero && !state.ended && !state.awaitingBlessing && !state.eventInputLocked;
    const safe = state.phase === "safe";
    const canFight = canTakeBattleAction(state);
    const isDuel = state.battleSource === "duel";
    const canContinue = inGame && safe && !state.adventureProgressLocked
      && (!state.eventContext || hasPendingThreat("safeEscape"));
    const canRest = canContinue && state.canRest && !state.hasRested && state.hero.hp < state.hero.maxHp;
    const canViewBlessings = Boolean(state.hero) && !state.ended && !state.awaitingBlessing && state.phase !== "event";
    const canViewAbility = Boolean(state.hero) && state.phase !== "event";
    els.nextButton.disabled = !canFight;
    els.nextButton.hidden = !canFight;
    els.nextButton.textContent = "攻擊";
    if (canFight && state.highlandBattle && !canReachHighlandTarget(state, state.enemies.find(e => e.runtimeId === state.targetEnemyId))) {
      els.nextButton.disabled = true; els.nextButton.textContent = "距離不足・請移位";
    }
    if (els.guardButton) {
      els.guardButton.disabled = !canFight;
      els.guardButton.hidden = !canFight;
    }
    els.fleeButton.disabled = !(canFight && (isDuel || !isBoss));
    els.fleeButton.hidden = !canFight;
    els.fleeButton.textContent = isDuel
      ? "結束切磋"
      : isBoss
      ? "首領無法逃跑"
      : (state.hero?.fleesRemaining ?? 0) <= 0
        ? "撤離逃跑（需成功）"
        : `逃跑（剩餘 ${state.hero?.fleesRemaining ?? 0} / ${runStartingFlees}）`;
    els.continueButton.hidden = !canContinue;
    els.continueButton.disabled = !canContinue;
    els.continueButton.textContent = hasPendingThreat("safeEscape") ? "繼續挑戰" : "繼續前進";
    els.restButton.hidden = !canContinue;
    els.restButton.disabled = !canRest;
    els.restButton.textContent = state.canRest && !state.hasRested ? "原地修整" : "已修整";
    els.retreatButton.hidden = !canContinue;
    els.retreatButton.disabled = !canContinue;
    els.viewBlessingsButton.disabled = !canViewBlessings || isDuel;
    if (els.combatHomeButton) {
      els.combatHomeButton.hidden = isDuel;
    }
    els.openAbilityFromAttack.disabled = !canViewAbility;
    els.openAbilityFromDefense.disabled = !canViewAbility;
    els.openAbilityFromCrit.disabled = !canViewAbility;
    renderTacticalBattle({ state, els, canFight, choosePath });
  }

  function render() {
    const hero = state.hero;
    if (!hero) return;
    state.targetEnemyId = resolveTargetEnemyId(state.enemies, state.targetEnemyId);
    renderCombatView({
      els,
      hero,
      enemies: state.enemies,
      targetEnemyId: state.targetEnemyId,
      phase: state.phase,
      turn: state.turn,
      suppressRosterSummary: Boolean(state.highlandBattle),
      preparationStatus: getPreparationCombatStatus({
        preparation: state.runPreparation,
        encounterType: state.battleEncounterType,
        enemies: state.enemies
      }),
      characterStatusEntries: getCharacterCombatStatusEntries(hero),
      onTargetSelect: selectEnemyTarget,
      questSnapshot: state.battleSource === "duel" ? null : questRuntime?.getSnapshot()
    });
    renderCombatActionHint();
    if (els.abilityInfoPanel.classList.contains("is-visible")) {
      renderCurrentAbilityView(els.abilityInfoList, hero);
    }
    if (state.battleSource === "duel") {
      els.encounterLabel.textContent = "安平鎮｜特殊切磋";
      els.battleLogTitle.textContent = "切磋紀錄｜對手：凱哥";
      if (!state.ended) {
        els.resultLabel.textContent = state.turn === 0 ? "切磋開始" : `切磋第 ${state.turn} 回合`;
      }
      setCombatActionState();
      return;
    }
    const encounterTotal = getAdventureEncounterCount();
    const encounterNumber = Math.min(getAdventureEncounterIndex() + 1, encounterTotal);
    const sourceName = getAdventureSourceName();
    if (state.phase === "routeEnding") {
      els.encounterLabel.textContent = `${sourceName}｜旅途結尾`;
      els.battleLogTitle.textContent = `戰鬥紀錄｜${sourceName} ${encounterTotal} / ${encounterTotal}`;
    } else {
      els.encounterLabel.textContent = state.eventContext
        ? `${sourceName}事件｜第 ${encounterNumber} 場前`
        : `${sourceName}｜${encounterNumber} / ${encounterTotal} 場`;
      els.battleLogTitle.textContent = state.battleSource === "event"
        ? `事件戰鬥｜${sourceName}第 ${encounterNumber} 場前`
        : `戰鬥紀錄｜第 ${encounterNumber} / ${encounterTotal} 場`;
    }
    if (!state.ended) {
      if (state.eventContext && state.phase !== "event") {
        els.resultLabel.textContent = getEventDefinition(state.eventContext.eventId)?.title || "冒險事件";
      } else if (!state.eventContext) {
        els.resultLabel.textContent = state.awaitingBlessing
          ? "選擇祝福"
          : state.phase === "safe" ? "安全路段" : state.turn === 0 ? "遭遇開始" : `第 ${state.turn} 回合`;
      }
    }
    setCombatActionState();
  }

  function renderCombatActionHint() {
    if (!els.combatActionHint) return;
    if (state.phase === "highlandChoice") {
      els.combatActionHint.textContent = "先選擇山路，再開始下一段旅程。";
      els.combatActionHint.dataset.action = "path";
      return;
    }
    if (state.lastPlayerAction === "guard") {
      els.combatActionHint.textContent = "上回合採取守勢；本回合可重新選擇行動。";
      els.combatActionHint.dataset.action = "guard";
      return;
    }
    if (state.turn === 0) {
      els.combatActionHint.textContent = "選擇攻擊或守勢；守勢會放棄本回合攻擊。";
      els.combatActionHint.dataset.action = "ready";
      return;
    }
    els.combatActionHint.textContent = "選擇本回合行動，或點擊敵人卡片切換目標。";
    els.combatActionHint.dataset.action = "attack";
  }

  function renderLog() {
    renderBattleLog(els.battleLog, state.log);
  }

  return Object.freeze({ render, setCombatActionState, renderLog });
}
