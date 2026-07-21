import { buildScaledEnemy } from "../core/combat.js";
import {
  appendRunEventRecord,
  createEventContext,
  getAvailableFollowUpChoices,
  getEventChoice,
  validateEventTarget
} from "../core/events.js";
import { createEventRewards } from "./eventRewards.js";
import { getEventDefinition, getEventEnemyDefinition } from "../data/events/index.js";
import {
  hideEventTransition,
  renderEventChoicesView,
  renderEventResultView,
  setEventChoiceButtonsDisabled,
  setEventTransitionChanging,
  setEventTransitionText,
  showCombatLayout,
  showEventTransition
} from "../ui/eventView.js";

const EVENT_TRANSITION_FIRST_LINE_MS = 850;
const EVENT_TRANSITION_SECOND_LINE_MS = 950;
const EVENT_TRANSITION_FADE_MS = 320;

export function createEventRuntime(host) {
  const {
    state,
    els,
    getSaveData,
    currentRegion,
    getAdventureSourceName,
    clearEnemyGroup,
    setCombatActionState,
    applySceneContext,
    beginBattleRuntime,
    addFixedLog,
    logCurrentEnemyGroupEncounter,
    applyEnemyAmbushes,
    addLog,
    render,
    grantBlessing,
    hasPhoenixBlessing,
    saveGameSafe,
    loseRun,
    startEncounter,
    enterAdventureRoute,
    showBlessings
  } = host;

  const eventRewards = createEventRewards({
    state,
    getSaveData,
    grantBlessing,
    hasPhoenixBlessing,
    saveGameSafe,
    addLog,
    addFixedLog
  });

  function resetEventRunState() {
    state.eventSchedule = null;
    state.eventContext = null;
    state.runEventRecords = [];
    state.eventInputLocked = false;
    state.adventureProgressLocked = false;
    state.eventTransitionToken += 1;
    hideEventTransition(els);
    showCombatLayout(els);
  }

  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function isCurrentEventTransition(token, eventId) {
    return token === state.eventTransitionToken
      && state.eventContext?.eventId === eventId
      && !state.ended;
  }

  async function beginScheduledEvent() {
    const schedule = state.eventSchedule;
    const event = getEventDefinition(schedule?.eventId);
    if (!event) {
      state.adventureProgressLocked = false;
      throw new Error(`找不到排程事件：${schedule?.eventId || "(empty)"}`);
    }

    state.eventSchedule = null;
    state.eventContext = createEventContext(event.id);
    state.eventInputLocked = true;
    state.phase = "event";
    clearEnemyGroup();
    setCombatActionState();

    const token = state.eventTransitionToken + 1;
    state.eventTransitionToken = token;
    const lines = Array.isArray(event.transitionText) ? event.transitionText.slice(0, 2) : [];
    showEventTransition(els, lines[0] || "你繼續前進……");

    await delay(EVENT_TRANSITION_FIRST_LINE_MS);
    if (!isCurrentEventTransition(token, event.id)) return;
    setEventTransitionChanging(els, true);
    await delay(EVENT_TRANSITION_FADE_MS);
    if (!isCurrentEventTransition(token, event.id)) return;
    setEventTransitionText(els, lines[1] || "前方似乎有些動靜。");
    setEventTransitionChanging(els, false);

    await delay(EVENT_TRANSITION_SECOND_LINE_MS);
    if (!isCurrentEventTransition(token, event.id)) return;
    hideEventTransition(els);
    renderEventChoices(event);
  }

  function renderEventChoices(event) {
    state.eventInputLocked = true;
    renderEventChoicesView({
      els,
      event,
      onChoice: chooseEventChoice
    });

    state.eventInputLocked = false;
    state.adventureProgressLocked = false;
    setEventChoiceButtonsDisabled(els, false);
    els.resultLabel.textContent = event.title || "冒險事件";
    els.encounterLabel.textContent = `${getAdventureSourceName()}事件`;
  }

  function chooseEventChoice(choiceId) {
    if (!state.eventContext || state.eventInputLocked || state.ended) return;

    const event = getEventDefinition(state.eventContext.eventId);
    const choice = getEventChoice(event, choiceId);
    if (!choice) {
      throw new Error(`找不到事件選項：${choiceId}`);
    }

    state.eventInputLocked = true;
    state.adventureProgressLocked = true;
    setEventChoiceButtonsDisabled(els, true);
    state.eventContext.choiceId = choice.id;
    state.eventContext.battleIndex = 0;

    if (Array.isArray(choice.battleSequence) && choice.battleSequence.length > 0) {
      startEventBattle(choice.battleSequence[0]);
      return;
    }

    completeEventChoice(event, choice);
  }

  function startEventBattle(battleStep) {
    const enemyDefinition = getEventEnemyDefinition(battleStep?.enemyId);
    if (!enemyDefinition) {
      throw new Error(`找不到事件敵人：${battleStep?.enemyId || "(empty)"}`);
    }

    showCombatLayout(els);
    applySceneContext("gameScreen");
    const enemy = buildScaledEnemy(enemyDefinition, currentRegion(), state.encounterIndex);
    enemy.poison = 0;
    beginBattleRuntime({
      enemies: [enemy],
      source: "event",
      encounterType: "event"
    });

    (battleStep.introText || []).forEach((text) => addFixedLog("system", text));
    logCurrentEnemyGroupEncounter();
    applyEnemyAmbushes();
    if (state.hero.shield > 0) {
      addLog("status", "shield", { target: state.hero.name, amount: state.hero.shield });
    }
    state.eventInputLocked = false;
    state.adventureProgressLocked = false;
    render();
  }

  function finishEventBattleVictory() {
    const event = getEventDefinition(state.eventContext?.eventId);
    const choice = getEventChoice(event, state.eventContext?.choiceId);
    const battles = Array.isArray(choice?.battleSequence) ? choice.battleSequence : [];
    state.eventContext.battleIndex += 1;

    if (state.eventContext.battleIndex < battles.length) {
      startEventBattle(battles[state.eventContext.battleIndex]);
      return;
    }

    completeEventChoice(event, choice);
  }

  function completeEventChoice(event, choice) {
    const result = choice?.result || {};
    const effectResult = eventRewards.applyChoiceEffects(result.effects);

    if (effectResult.heroDefeated) {
      state.deathCause = { type: "event", label: event?.title || "冒險事件" };
      loseRun();
      return;
    }

    appendRunEventRecord(state.runEventRecords, {
      eventId: event.id,
      choiceId: choice.id,
      resultIds: result.resultIds
    });
    state.eventContext.defaultTarget = result.defaultTarget;
    renderEventResult(event, result, effectResult);
  }

  function renderEventResult(event, result, effectResult) {
    state.eventInputLocked = true;
    state.phase = "event";
    clearEnemyGroup();
    state.battleSource = "main";
    state.battleEncounterType = null;

    const followUpChoices = getAvailableFollowUpChoices(result, state.runEventRecords);
    const hasFollowUpChoices = renderEventResultView({
      els,
      event,
      narrative: [
        ...(Array.isArray(result.narrative) ? result.narrative : []),
        ...(Array.isArray(result.postEffectNarrative) ? result.postEffectNarrative : [])
      ],
      rewardLines: eventRewards.buildRewardLines(effectResult.applied),
      followUpChoices,
      onFollowUp: chooseEventFollowUp,
      hasDefaultTarget: Boolean(result.defaultTarget),
      defaultActionLabel: result.continueLabel || "繼續冒險"
    });

    state.eventInputLocked = false;
    if (hasFollowUpChoices) {
      setEventChoiceButtonsDisabled(els, false);
    }
    state.adventureProgressLocked = false;
    els.resultLabel.textContent = "事件結果";
    els.encounterLabel.textContent = event.title || "冒險事件";
  }

  function chooseEventFollowUp(choice) {
    if (state.eventInputLocked || state.ended) return;
    state.eventInputLocked = true;
    state.adventureProgressLocked = true;
    setEventChoiceButtonsDisabled(els, true);
    resolveEventTarget(choice.target);
  }

  function continueEventResult() {
    if (!state.eventContext || state.eventInputLocked || state.ended) return;
    state.eventInputLocked = true;
    state.adventureProgressLocked = true;
    els.eventContinueButton.disabled = true;
    resolveEventTarget(state.eventContext.defaultTarget);
  }

  function resolveEventTarget(target) {
    validateEventTarget(target, ["returnAdventure", "enterRoute", "chooseBlessing"]);
    if (target.type === "returnAdventure") {
      state.eventContext = null;
      state.eventInputLocked = false;
      state.adventureProgressLocked = false;
      els.eventContinueButton.disabled = false;
      showCombatLayout(els);
      startEncounter();
      return;
    }
    if (target.type === "enterRoute") {
      els.eventContinueButton.disabled = false;
      enterAdventureRoute(target.routeId);
      return;
    }
    if (target.type === "chooseBlessing") {
      state.blessingPoolOverrideId = target.poolId || null;
      showBlessings("eventChoice", {
        poolId: target.poolId,
        count: Math.max(1, Math.floor(Number(target.count) || 3)),
        rarity: target.rarity || null
      });
    }
  }

  return {
    resetEventRunState,
    beginScheduledEvent,
    finishEventBattleVictory,
    continueEventResult
  };
}
