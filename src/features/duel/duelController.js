import { STORY_QUEST_STATUSES } from "../../core/storyQuestRules.js";
import { getDuelDefinition } from "../../data/duels/index.js";
import { showCombatLayout } from "../../ui/eventView.js";

const KAIGE_QUEST_ID = "kaige-challenge";
const KAIGE_NPC_ID = "kaige";
const REQUIRED_LEVEL = 20;

export function createDuelController({
  state,
  saveStore,
  els,
  storyQuestRuntime,
  buildHeroFromProgression,
  resetAdventureRunRuntime,
  beginBattleRuntime,
  settleBattleVictory,
  addFixedLog,
  logCurrentEnemyGroupEncounter,
  render,
  showScreen,
  showNpcDialogue,
  setNavigationContext,
  closeAbilityInfoPanel,
  closeBlessingInfoPanel
}) {
  function startDuel(duelId) {
    const duel = getDuelDefinition(duelId);
    if (!duel || duel.id !== KAIGE_QUEST_ID) {
      return { ok: false, message: "目前找不到這場切磋。" };
    }
    const record = storyQuestRuntime.getRecord(KAIGE_QUEST_ID);
    if (!record || record.status === STORY_QUEST_STATUSES.COMPLETED) {
      return { ok: false, message: "這場切磋已經結束。" };
    }
    const progress = saveStore.current.progression.characters[state.selectedHeroId];
    if (!progress?.unlocked || progress.level < REQUIRED_LEVEL) {
      return {
        ok: false,
        message: `目前選擇的角色必須達到 Lv.${REQUIRED_LEVEL}。請先到角色頁切換合格角色。`
      };
    }
    if (
      record.status === STORY_QUEST_STATUSES.AVAILABLE
      && !storyQuestRuntime.startQuest(KAIGE_QUEST_ID, { stageId: "defeat-kaige" })
    ) {
      return { ok: false, message: "目前無法保存任務進度，請稍後再試。" };
    }

    resetAdventureRunRuntime();
    state.hero = buildHeroFromProgression(state.selectedHeroId);
    state.hero.fleesRemaining = 0;
    state.runPreparation = null;
    state.ended = false;
    state.phase = "danger";
    state.specialDuelContext = {
      duelId,
      npcId: KAIGE_NPC_ID
    };
    beginBattleRuntime({
      enemies: [duel.opponent],
      source: "duel",
      encounterType: "duel"
    });
    initializeDuelOpponent();
    installDirectHitHook();
    showCombatLayout(els);
    closeAbilityInfoPanel();
    closeBlessingInfoPanel();
    addFixedLog("system", "這是一場點到為止的切磋，不會獲得冒險獎勵，也不會造成永久損失。");
    logCurrentEnemyGroupEncounter();
    showScreen("gameScreen");
    render();
    return { ok: true };
  }

  function initializeDuelOpponent() {
    const enemy = state.enemies[0];
    if (!enemy) return;
    enemy.duelBaseAttack = enemy.attack;
    enemy.duelFuryValue = 0;
    updateDuelOpponentAttack(enemy);
  }

  function installDirectHitHook() {
    state.hero.battleHooks = {
      onDirectAttackResolved: ({ enemy }) => {
        if (!isDuelActive() || enemy?.hp <= 0) {
          return;
        }
        const fury = enemy.duelFury;
        const hpRatio = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 1;
        const gain = hpRatio <= fury.lowHpThreshold ? fury.lowHpGain : fury.normalGain;
        enemy.duelFuryValue = Math.min(fury.max, enemy.duelFuryValue + gain);
        updateDuelOpponentAttack(enemy);
      }
    };
  }

  function updateDuelOpponentAttack(enemy) {
    const fury = enemy.duelFury;
    enemy.attack = enemy.duelBaseAttack + enemy.duelFuryValue;
    enemy.specialAttack = enemy.duelFuryValue >= fury.max
      ? {
          id: "double-axe-cleave",
          name: "雙刃重斬",
          everyTurns: 1,
          hits: [
            { label: "第一斬", attackRatio: fury.heavyMultiplier / 2 },
            { label: "第二斬", attackRatio: fury.heavyMultiplier / 2 }
          ]
        }
      : null;
  }

  function prepareEnemyAction(enemy) {
    if (!isDuelActive() || enemy !== state.enemies[0]) {
      return;
    }
    updateDuelOpponentAttack(enemy);
  }

  function completeEnemyAction(enemy) {
    if (!isDuelActive() || enemy !== state.enemies[0]) {
      return;
    }
    if (enemy.duelFuryValue >= enemy.duelFury.max) {
      enemy.duelFuryValue = 0;
      updateDuelOpponentAttack(enemy);
    }
  }

  function handleBattleVictory() {
    if (!isDuelActive()) {
      return false;
    }
    settleBattleVictory();
    const completed = storyQuestRuntime.completeQuest(KAIGE_QUEST_ID);
    finishDuel(completed ? "victory" : "save-failed");
    return true;
  }

  function handleBattleDefeat() {
    if (!isDuelActive()) {
      return false;
    }
    finishDuel("defeat");
    return true;
  }

  function requestExit() {
    if (!isDuelActive()) {
      return false;
    }
    els.duelExitPanel.classList.add("is-visible");
    return true;
  }

  function cancelExit() {
    els.duelExitPanel.classList.remove("is-visible");
  }

  function confirmExit() {
    if (!isDuelActive()) {
      cancelExit();
      return false;
    }
    finishDuel("withdraw");
    return true;
  }

  function finishDuel(nodeId) {
    const npcId = state.specialDuelContext?.npcId || KAIGE_NPC_ID;
    if (state.hero) {
      delete state.hero.battleHooks;
    }
    cancelExit();
    resetAdventureRunRuntime();
    setNavigationContext("camp");
    showNpcDialogue(npcId, {
      nodeId,
      animateText: true
    });
  }

  function isDuelActive() {
    return state.battleSource === "duel"
      && state.specialDuelContext?.duelId === KAIGE_QUEST_ID
      && !state.ended;
  }

  return Object.freeze({
    startDuel,
    prepareEnemyAction,
    completeEnemyAction,
    handleBattleVictory,
    handleBattleDefeat,
    requestExit,
    cancelExit,
    confirmExit,
    isDuelActive
  });
}
