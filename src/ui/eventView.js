import { normalizeRouteEndingRole, normalizeRouteEndingTone, ROUTE_ENDING_TONES } from "../data/routes/endingSemantics.js";
import { renderChoiceList } from "./renderHelpers.js";

export function showCombatLayout(els) {
  resetRouteEndingPresentation(els);
  els.combatLayout.hidden = false;
  els.eventLayout.hidden = true;
}

export function showEventLayout(els) {
  els.combatLayout.hidden = true;
  els.eventLayout.hidden = false;
}

export function showEventTransition(els, text) {
  els.eventTransition.classList.add("is-visible");
  els.eventTransitionText.classList.remove("is-changing");
  els.eventTransitionText.textContent = text;
}

export function setEventTransitionChanging(els, changing) {
  els.eventTransitionText.classList.toggle("is-changing", Boolean(changing));
}

export function setEventTransitionText(els, text) {
  els.eventTransitionText.textContent = text;
}

export function hideEventTransition(els) {
  els.eventTransition.classList.remove("is-visible");
  els.eventTransitionText.classList.remove("is-changing");
  els.eventTransitionText.textContent = "";
}

export function renderEventChoicesView({ els, event, onChoice }) {
  resetRouteEndingPresentation(els);
  showEventLayout(els);
  els.eventEyebrow.textContent = event.eyebrow || "冒險事件";
  els.eventTitle.textContent = event.title || "未知事件";
  renderEventNarrative(els, event.narrative);
  els.eventPrompt.textContent = event.prompt || "你打算怎麼做？";
  els.eventPrompt.hidden = false;
  renderEventRewardLines(els, []);
  els.eventContinueButton.hidden = true;

  renderChoiceList(els.eventChoices, (event.choices || []).map((choice) => ({
    title: choice.title,
    meta: choice.meta || "",
    description: choice.description || "",
    action: choice.action || "選擇",
    onClick: () => onChoice(choice.id)
  })));
}

export function renderEventResultView({ els, event, narrative, rewardLines, followUpChoices, onFollowUp, hasDefaultTarget = true, defaultActionLabel = "繼續冒險" }) {
  resetRouteEndingPresentation(els);
  showEventLayout(els);
  els.eventEyebrow.textContent = event.eyebrow || "冒險事件";
  els.eventTitle.textContent = event.title || "未知事件";
  renderEventNarrative(els, narrative);
  els.eventPrompt.hidden = true;
  els.eventChoices.replaceChildren();
  renderEventRewardLines(els, rewardLines);

  if (followUpChoices.length > 0) {
    renderChoiceList(els.eventChoices, followUpChoices.map((choice) => ({
      title: choice.title,
      meta: choice.meta || "",
      description: choice.description || "",
      action: choice.action || "選擇",
      onClick: () => onFollowUp(choice)
    })));
  }

  els.eventContinueButton.hidden = !hasDefaultTarget;
  els.eventContinueButton.disabled = false;
  els.eventContinueButton.textContent = defaultActionLabel;
  return followUpChoices.length > 0;
}

export function renderRouteEndingView({ els, eyebrow = "冒險結尾", title, narrative, tone = "cold", actionLabel = "繼續" }) {
  applyRouteEndingPresentation(els, tone);
  showEventLayout(els);
  els.eventEyebrow.textContent = eyebrow;
  els.eventTitle.textContent = title || "旅途結尾";
  renderRouteEndingNarrative(els, narrative);
  els.eventPrompt.hidden = true;
  els.eventChoices.replaceChildren();
  renderEventRewardLines(els, []);
  els.eventContinueButton.hidden = false;
  els.eventContinueButton.disabled = false;
  els.eventContinueButton.textContent = actionLabel;
}

export function setEventChoiceButtonsDisabled(els, disabled) {
  els.eventChoices.querySelectorAll("button").forEach((button) => {
    button.disabled = disabled;
  });
}

function applyRouteEndingPresentation(els, tone) {
  resetRouteEndingPresentation(els);
  const normalizedTone = normalizeRouteEndingTone(tone);
  const panel = els.eventNarrative.closest(".event-panel");
  panel?.classList.add("route-ending-panel", `route-ending-tone-${normalizedTone}`);
  els.eventNarrative.classList.add("route-ending-narrative");
}

function resetRouteEndingPresentation(els) {
  const panel = els.eventNarrative?.closest(".event-panel");
  if (panel) {
    panel.classList.remove("route-ending-panel");
    ROUTE_ENDING_TONES.forEach((tone) => {
      panel.classList.remove(`route-ending-tone-${tone}`);
    });
  }
  els.eventNarrative?.classList.remove("route-ending-narrative");
}

function renderRouteEndingNarrative(els, lines = []) {
  els.eventNarrative.replaceChildren();
  (Array.isArray(lines) ? lines : []).forEach((line) => {
    const paragraph = document.createElement("p");
    const role = normalizeRouteEndingRole(line?.role);
    paragraph.classList.add("route-ending-line", `route-ending-line-${role}`);
    paragraph.textContent = typeof line === "string" ? line : (line?.text || "");
    els.eventNarrative.append(paragraph);
  });
}

function renderEventNarrative(els, paragraphs = []) {
  els.eventNarrative.replaceChildren();
  (Array.isArray(paragraphs) ? paragraphs : []).forEach((text, index, items) => {
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    if (index === items.length - 1 && items.length > 1) {
      paragraph.classList.add("event-narrative-emphasis");
    }
    els.eventNarrative.append(paragraph);
  });
}

function renderEventRewardLines(els, rewardLines = []) {
  els.eventReward.replaceChildren();
  if (rewardLines.length === 0) {
    els.eventReward.hidden = true;
    return;
  }

  rewardLines.forEach((text) => {
    const item = document.createElement("p");
    item.textContent = text;
    els.eventReward.append(item);
  });
  els.eventReward.hidden = false;
}
