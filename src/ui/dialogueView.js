import {
  cancelDialogueTextAnimation,
  isDialogueTextAnimating,
  prepareDialogueTextAnimation,
  revealDialogueTextImmediately
} from "./dialogueTextAnimation.js";

export {
  cancelDialogueTextAnimation,
  isDialogueTextAnimating,
  revealDialogueTextImmediately
} from "./dialogueTextAnimation.js";

export function renderDialogueView({
  els,
  npc,
  displayName,
  node,
  pageIndex,
  visibleChoices = [],
  notice = "",
  noticeType = "status",
  onAdvance,
  onChoice,
  animateText = false,
  pageKey = "",
  typewriterOptions = {}
}) {
  const pages = node?.pages || [];
  const page = pages[pageIndex] || pages[0] || { text: "……" };
  const fullText = String(page.text || "……");
  const isLastPage = pageIndex >= pages.length - 1;
  const hasChoices = isLastPage && visibleChoices.length > 0;
  const hasCompletion = isLastPage && !hasChoices && (
    Boolean(node?.nextNodeId) || (node?.actionsOnComplete || []).length > 0
  );

  els.dialogueNpcName.textContent = displayName;
  els.dialogueNpcTitle.textContent = npc?.title || "人物";
  els.dialoguePageIndicator.textContent = pages.length > 1
    ? `${Math.min(pageIndex + 1, pages.length)} / ${pages.length}`
    : "";
  els.dialogueNotice.textContent = notice;
  els.dialogueNotice.dataset.type = noticeType;
  renderPortrait({ els, npc, displayName, page });
  renderChoices({ els, visibleChoices, onChoice });

  const finalAdvanceLabel = isLastPage
    ? hasCompletion ? "繼續" : "結束對話"
    : "繼續";
  const applyCompletedControls = ({ focus = true } = {}) => {
    resetTextRegion(els);
    els.dialogueSkipButton.hidden = true;
    els.dialogueSkipButton.onclick = null;
    els.dialogueChoices.hidden = !hasChoices;
    els.dialogueAdvanceButton.hidden = hasChoices;
    els.dialogueAdvanceButton.textContent = finalAdvanceLabel;
    els.dialogueAdvanceButton.onclick = onAdvance;
    if (focus) {
      focusWithoutScroll(hasChoices
        ? els.dialogueChoices.querySelector?.("button")
        : els.dialogueAdvanceButton);
    }
  };
  const applyTypingControls = ({ focus = true } = {}) => {
    setTypingTextRegion(els);
    els.dialogueChoices.hidden = true;
    els.dialogueAdvanceButton.hidden = true;
    bindRevealControls(els);
    if (focus) focusWithoutScroll(els.dialogueSkipButton);
  };

  prepareDialogueTextAnimation({
    els,
    fullText,
    pageKey,
    animateText,
    typewriterOptions,
    applyCompletedControls,
    applyTypingControls,
    preserveExisting: !animateText
  });
}

export function renderStandaloneDialogueText({
  els,
  text,
  animateText = true,
  pageKey = "",
  typewriterOptions = {},
  onComplete = () => {}
}) {
  const fullText = String(text || "……");
  const applyCompletedControls = ({ focus = false } = {}) => {
    resetTextRegion(els);
    els.dialogueSkipButton.hidden = true;
    els.dialogueSkipButton.onclick = null;
    if (focus) focusWithoutScroll(els.dialogueTextRegion);
    onComplete();
  };
  const applyTypingControls = ({ focus = false } = {}) => {
    setTypingTextRegion(els);
    bindRevealControls(els);
    if (focus) focusWithoutScroll(els.dialogueSkipButton);
  };

  prepareDialogueTextAnimation({
    els,
    fullText,
    pageKey,
    animateText,
    typewriterOptions,
    applyCompletedControls,
    applyTypingControls,
    preserveExisting: true
  });
}

function renderChoices({ els, visibleChoices, onChoice }) {
  els.dialogueChoices.replaceChildren();
  visibleChoices.forEach((choice) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dialogue-choice-button";
    button.textContent = choice.label;
    button.dataset.choiceId = choice.id;
    button.addEventListener("click", () => onChoice(choice.id));
    els.dialogueChoices.append(button);
  });
}

function renderPortrait({ els, npc, displayName, page }) {
  renderSceneOverlay(els, page?.sceneStage);
  const portrait = String(npc?.portrait || "").trim();
  const fallback = () => {
    els.dialoguePortraitImage.hidden = true;
    els.dialoguePortraitFallback.hidden = false;
    els.dialoguePortraitFallback.textContent = displayName;
  };
  if (!portrait) {
    fallback();
    return;
  }
  els.dialoguePortraitImage.alt = `${displayName}的插圖`;
  els.dialoguePortraitImage.style.objectPosition = String(npc?.portraitFocus || "").trim() || "";
  els.dialoguePortraitImage.onload = () => {
    els.dialoguePortraitImage.hidden = false;
    els.dialoguePortraitFallback.hidden = true;
  };
  els.dialoguePortraitImage.onerror = fallback;
  if (els.dialoguePortraitImage.getAttribute?.("src") !== portrait) {
    els.dialoguePortraitImage.src = portrait;
  } else if (els.dialoguePortraitImage.complete && els.dialoguePortraitImage.naturalWidth > 0) {
    els.dialoguePortraitImage.hidden = false;
    els.dialoguePortraitFallback.hidden = true;
  }
}

function bindRevealControls(els) {
  const reveal = () => revealDialogueTextImmediately(els);
  els.dialogueSkipButton.hidden = false;
  els.dialogueSkipButton.onclick = (event) => {
    event?.stopPropagation?.();
    reveal();
  };
  els.dialogueTextRegion.onclick = reveal;
  els.dialogueTextRegion.onkeydown = (event) => {
    if (!["Enter", " ", "Spacebar"].includes(event?.key)) return;
    event.preventDefault?.();
    reveal();
  };
}

function setTypingTextRegion(els) {
  els.dialogueTextRegion.classList.add("is-typing");
  els.dialogueTextRegion.setAttribute?.("aria-busy", "true");
  els.dialogueTextRegion.setAttribute?.("aria-live", "off");
}

function resetTextRegion(els) {
  els.dialogueTextRegion.classList.remove("is-typing");
  els.dialogueTextRegion.setAttribute?.("aria-busy", "false");
  els.dialogueTextRegion.setAttribute?.("aria-live", "polite");
  els.dialogueTextRegion.onclick = null;
  els.dialogueTextRegion.onkeydown = null;
}

function focusWithoutScroll(element) {
  try {
    element?.focus?.({ preventScroll: true });
  } catch {
    element?.focus?.();
  }
}

const QUEST_BRIEFING_STAGES = Object.freeze([
  "papers",
  "sources",
  "single",
  "rarities",
  "warning",
  "board"
]);

function renderSceneOverlay(els, sceneStage) {
  const overlay = els.dialogueSceneOverlay;
  const portraitCard = els.dialoguePortraitCard;
  const layout = els.dialogueLayout;
  const progress = els.dialogueBriefingProgress;
  if (!overlay) return;

  const stage = String(sceneStage || "").trim();
  const stepIndex = QUEST_BRIEFING_STAGES.indexOf(stage);
  const isQuestBriefing = stepIndex >= 0;

  overlay.hidden = !isQuestBriefing;
  progress && (progress.hidden = !isQuestBriefing);
  layout?.classList.toggle("quest-intro-layout", isQuestBriefing);
  portraitCard?.classList.toggle("quest-intro-portrait-card", isQuestBriefing);

  if (!isQuestBriefing) {
    overlay.removeAttribute?.("data-scene-stage");
    portraitCard?.removeAttribute?.("data-intro-step");
    progress?.querySelectorAll?.("[data-scene-step]").forEach((item) => {
      item.classList.remove("is-active", "is-complete");
    });
    return;
  }

  progress?.querySelectorAll?.("[data-scene-step]").forEach((item, index) => {
    item.classList.toggle("is-active", index === stepIndex);
    item.classList.toggle("is-complete", index < stepIndex);
  });

  const previousStage = overlay.dataset.sceneStage || "";
  if (!previousStage) {
    portraitCard?.removeAttribute?.("data-intro-step");
    overlay.removeAttribute?.("data-scene-stage");
    void overlay.offsetWidth;
  }

  overlay.dataset.sceneStage = stage;
  portraitCard && (portraitCard.dataset.introStep = String(stepIndex));
}
