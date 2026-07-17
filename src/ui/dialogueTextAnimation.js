const DEFAULT_TYPEWRITER_OPTIONS = Object.freeze({
  characterDelay: 30,
  commaPause: 70,
  sentencePause: 130,
  ellipsisPause: 95,
  minimumDelay: 12,
  maxDuration: 3200
});

const activeTextAnimations = new WeakMap();

export function revealDialogueTextImmediately(els) {
  const animation = activeTextAnimations.get(els?.dialogueText);
  if (!animation) return false;
  finishDialogueTextAnimation(els, animation);
  return true;
}

export function cancelDialogueTextAnimation(els) {
  const textElement = els?.dialogueText;
  const animation = textElement && activeTextAnimations.get(textElement);
  if (!animation) return false;
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

export function prepareDialogueTextAnimation({
  els,
  fullText,
  pageKey,
  animateText,
  typewriterOptions,
  applyCompletedControls,
  applyTypingControls,
  preserveExisting = false
}) {
  const existingAnimation = activeTextAnimations.get(els.dialogueText);
  if (existingAnimation?.pageKey === pageKey && preserveExisting) {
    existingAnimation.applyCompletedControls = applyCompletedControls;
    applyTypingControls({ focus: false });
    return true;
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
    return false;
  }

  startDialogueTextAnimation({
    els,
    fullText,
    pageKey,
    animationConfig,
    applyCompletedControls,
    applyTypingControls
  });
  return true;
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
    if (activeTextAnimations.get(els.dialogueText) !== animation) return;
    els.dialogueText.textContent += characters[animation.index] || "";
    animation.index += 1;
    if (animation.index >= characters.length) {
      finishDialogueTextAnimation(els, animation);
      return;
    }
    animation.timerId = animation.setTimeoutFn(typeNextCharacter, delays[animation.index - 1]);
  };
  typeNextCharacter();
}

function finishDialogueTextAnimation(els, animation) {
  if (activeTextAnimations.get(els.dialogueText) !== animation) return;
  animation.clearTimeoutFn(animation.timerId);
  activeTextAnimations.delete(els.dialogueText);
  els.dialogueTextRegion.setAttribute?.("aria-live", "polite");
  els.dialogueText.textContent = animation.fullText;
  animation.applyCompletedControls();
}

function buildCharacterDelays(characters, options) {
  const rawDelays = characters.map((character) => {
    if (/[。！？!?]/u.test(character)) return options.characterDelay + options.sentencePause;
    if (/[，、；：,;:]/u.test(character)) return options.characterDelay + options.commaPause;
    if (character === "…") return options.characterDelay + options.ellipsisPause;
    return options.characterDelay;
  });
  const rawDuration = rawDelays.reduce((total, delay) => total + delay, 0);
  const scale = options.maxDuration > 0 && rawDuration > options.maxDuration
    ? options.maxDuration / rawDuration
    : 1;
  return rawDelays.map((delay) => Math.max(options.minimumDelay, Math.round(delay * scale)));
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
