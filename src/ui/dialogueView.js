const DEFAULT_TYPEWRITER_OPTIONS = Object.freeze({
  characterDelay: 30,
  commaPause: 70,
  sentencePause: 130,
  ellipsisPause: 95,
  minimumDelay: 12,
  maxDuration: 3200
});

const activeTextAnimations = new WeakMap();

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
    Boolean(node?.nextNodeId)
    || (node?.actionsOnComplete || []).length > 0
  );

  els.dialogueNpcName.textContent = displayName;
  els.dialogueNpcTitle.textContent = npc?.title || "人物";
  els.dialoguePageIndicator.textContent = pages.length > 1
    ? `${Math.min(pageIndex + 1, pages.length)} / ${pages.length}`
    : "";
  els.dialogueNotice.textContent = notice;
  els.dialogueNotice.dataset.type = noticeType;

  renderPortrait({ els, npc, displayName });
  renderChoices({ els, visibleChoices, onChoice });

  const finalAdvanceLabel = isLastPage
    ? hasCompletion
      ? "繼續"
      : "結束對話"
    : "繼續";
  const applyCompletedControls = ({ focus = true } = {}) => {
    els.dialogueTextRegion.classList.remove("is-typing");
    els.dialogueTextRegion.setAttribute?.("aria-busy", "false");
    els.dialogueTextRegion.setAttribute?.("aria-live", "polite");
    els.dialogueTextRegion.onclick = null;
    els.dialogueTextRegion.onkeydown = null;
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
    els.dialogueTextRegion.classList.add("is-typing");
    els.dialogueTextRegion.setAttribute?.("aria-busy", "true");
    els.dialogueTextRegion.setAttribute?.("aria-live", "off");
    els.dialogueChoices.hidden = true;
    els.dialogueAdvanceButton.hidden = true;

    const reveal = () => revealDialogueTextImmediately(els);
    els.dialogueSkipButton.hidden = false;
    els.dialogueSkipButton.onclick = (event) => {
      event?.stopPropagation?.();
      reveal();
    };
    els.dialogueTextRegion.onclick = reveal;
    els.dialogueTextRegion.onkeydown = (event) => {
      if (event?.key !== "Enter" && event?.key !== " " && event?.key !== "Spacebar") {
        return;
      }
      event.preventDefault?.();
      reveal();
    };

    if (focus) {
      focusWithoutScroll(els.dialogueSkipButton);
    }
  };

  const existingAnimation = activeTextAnimations.get(els.dialogueText);
  const preservesRunningAnimation = Boolean(
    existingAnimation
    && existingAnimation.pageKey === pageKey
    && !animateText
  );
  if (preservesRunningAnimation) {
    existingAnimation.applyCompletedControls = applyCompletedControls;
    applyTypingControls({ focus: false });
    return;
  }

  cancelDialogueTextAnimation(els);
  const animationConfig = resolveTypewriterOptions(typewriterOptions);
  const shouldAnimate = animateText
    && animationConfig.enabled
    && !animationConfig.reducedMotion
    && fullText.length > 0;

  if (!shouldAnimate) {
    els.dialogueText.textContent = fullText;
    applyCompletedControls();
    return;
  }

  startDialogueTextAnimation({
    els,
    fullText,
    pageKey,
    animationConfig,
    applyCompletedControls,
    applyTypingControls
  });
}

export function revealDialogueTextImmediately(els) {
  const animation = activeTextAnimations.get(els?.dialogueText);
  if (!animation) {
    return false;
  }
  finishDialogueTextAnimation(els, animation);
  return true;
}

export function cancelDialogueTextAnimation(els) {
  const textElement = els?.dialogueText;
  const animation = textElement && activeTextAnimations.get(textElement);
  if (!animation) {
    return false;
  }
  animation.clearTimeoutFn(animation.timerId);
  activeTextAnimations.delete(textElement);
  els.dialogueTextRegion?.classList?.remove("is-typing");
  els.dialogueTextRegion?.setAttribute?.("aria-busy", "false");
  if (els.dialogueTextRegion) {
    els.dialogueTextRegion.onclick = null;
    els.dialogueTextRegion.onkeydown = null;
  }
  if (els.dialogueSkipButton) {
    els.dialogueSkipButton.hidden = true;
    els.dialogueSkipButton.onclick = null;
  }
  return true;
}

export function isDialogueTextAnimating(els) {
  return Boolean(els?.dialogueText && activeTextAnimations.has(els.dialogueText));
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

function startDialogueTextAnimation({
  els,
  fullText,
  pageKey,
  animationConfig,
  applyCompletedControls,
  applyTypingControls
}) {
  const characters = Array.from(fullText);
  const delays = buildCharacterDelays(characters, animationConfig);
  const animation = {
    pageKey,
    fullText,
    characters,
    index: 0,
    timerId: null,
    setTimeoutFn: animationConfig.setTimeoutFn,
    clearTimeoutFn: animationConfig.clearTimeoutFn,
    applyCompletedControls
  };
  activeTextAnimations.set(els.dialogueText, animation);
  els.dialogueText.textContent = "";
  applyTypingControls();

  const typeNextCharacter = () => {
    if (activeTextAnimations.get(els.dialogueText) !== animation) {
      return;
    }
    els.dialogueText.textContent += characters[animation.index] || "";
    animation.index += 1;
    if (animation.index >= characters.length) {
      finishDialogueTextAnimation(els, animation);
      return;
    }
    animation.timerId = animation.setTimeoutFn(
      typeNextCharacter,
      delays[animation.index - 1]
    );
  };

  typeNextCharacter();
}

function finishDialogueTextAnimation(els, animation) {
  if (activeTextAnimations.get(els.dialogueText) !== animation) {
    return;
  }
  animation.clearTimeoutFn(animation.timerId);
  activeTextAnimations.delete(els.dialogueText);
  els.dialogueTextRegion.setAttribute?.("aria-live", "polite");
  els.dialogueText.textContent = animation.fullText;
  animation.applyCompletedControls();
}

function buildCharacterDelays(characters, options) {
  const rawDelays = characters.map((character) => {
    if (/[。！？!?]/u.test(character)) {
      return options.characterDelay + options.sentencePause;
    }
    if (/[，、；：,;:]/u.test(character)) {
      return options.characterDelay + options.commaPause;
    }
    if (character === "…") {
      return options.characterDelay + options.ellipsisPause;
    }
    return options.characterDelay;
  });
  const rawDuration = rawDelays.reduce((total, delay) => total + delay, 0);
  const scale = options.maxDuration > 0 && rawDuration > options.maxDuration
    ? options.maxDuration / rawDuration
    : 1;
  return rawDelays.map((delay) => Math.max(
    options.minimumDelay,
    Math.round(delay * scale)
  ));
}

function resolveTypewriterOptions(options) {
  const reducedMotion = typeof options.reducedMotion === "boolean"
    ? options.reducedMotion
    : globalThis.window?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
  return {
    ...DEFAULT_TYPEWRITER_OPTIONS,
    ...options,
    enabled: options.enabled !== false,
    reducedMotion,
    setTimeoutFn: options.setTimeoutFn || globalThis.setTimeout.bind(globalThis),
    clearTimeoutFn: options.clearTimeoutFn || globalThis.clearTimeout.bind(globalThis)
  };
}

function focusWithoutScroll(element) {
  try {
    element?.focus?.({ preventScroll: true });
  } catch {
    element?.focus?.();
  }
}

function renderPortrait({ els, npc, displayName }) {
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
