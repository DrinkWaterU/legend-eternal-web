import { renderChoiceList } from "./renderHelpers.js";

export function showCombatLayout(els) {
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

export function renderEventResultView({ els, event, narrative, rewardLines, followUpChoices, onFollowUp }) {
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
    els.eventContinueButton.hidden = true;
    return true;
  }

  els.eventContinueButton.hidden = false;
  els.eventContinueButton.disabled = false;
  els.eventContinueButton.textContent = "繼續冒險";
  return false;
}

export function setEventChoiceButtonsDisabled(els, disabled) {
  els.eventChoices.querySelectorAll("button").forEach((button) => {
    button.disabled = disabled;
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
