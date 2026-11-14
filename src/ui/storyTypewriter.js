// Typewriter reveal for story panels. Lines are HTML; an element carrying data-beat
// and/or data-fx is a cue. When typing reaches its first character the scene switches
// to that beat (persistent) and plays that effect (one-shot).

const PUNCTUATION_PAUSE = Object.freeze({ "，": 0.35, "、": 0.3, "；": 0.4, "：": 0.35, "。": 0.6, "！": 0.6, "？": 0.6, "—": 0.15 });

// Wraps every character of a rendered paragraph in a span and returns one step per character.
export function prepareTypewriterParagraph(paragraph, documentRef = paragraph.ownerDocument) {
  const steps = [];
  const walker = documentRef.createTreeWalker(paragraph, 4 /* NodeFilter.SHOW_TEXT */);
  const textNodes = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) textNodes.push(node);
  const seenCues = new Set();
  textNodes.forEach((textNode) => {
    // Only cues inside this paragraph count; the story panel itself also carries data-beat.
    const found = textNode.parentElement?.closest?.("[data-beat], [data-fx]");
    const cue = found && found !== paragraph && paragraph.contains(found) ? found : null;
    const fragment = documentRef.createDocumentFragment();
    const chars = [...textNode.data];
    chars.forEach((char, index) => {
      const span = documentRef.createElement("span");
      span.className = "story-char";
      span.textContent = char;
      fragment.append(span);
      const cueStart = cue && !seenCues.has(cue) ? cue : null;
      if (cueStart) seenCues.add(cue);
      const isLastOfCue = Boolean(cue) && index === chars.length - 1 && cue.lastChild === textNode;
      steps.push({
        element: span,
        char,
        cue: cueStart,
        beat: cueStart?.dataset.beat || "",
        fx: cueStart?.dataset.fx || "",
        cueEnd: isLastOfCue
      });
    });
    textNode.replaceWith(fragment);
  });
  return steps;
}

// Pure timeline: when each character appears, when beats fire, and when typing is done.
export function planTypewriterTimeline(lineSteps, { charDelayMs, linePauseMs, cueHoldMs, finishDelayMs }) {
  const events = [];
  let time = 0;
  lineSteps.forEach((steps, lineIndex) => {
    steps.forEach((step, stepIndex) => {
      events.push({ at: time, lineIndex, stepIndex, beat: step.beat || "", fx: step.fx || "" });
      time += charDelayMs * (1 + (PUNCTUATION_PAUSE[step.char] || 0) * 4);
      if (step.cueEnd) time += cueHoldMs;
    });
    if (lineIndex < lineSteps.length - 1) time += linePauseMs;
  });
  return { events, finishAt: time + finishDelayMs };
}
