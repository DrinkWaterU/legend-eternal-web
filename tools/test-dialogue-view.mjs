import assert from "node:assert/strict";

import {
  cancelDialogueTextAnimation,
  isDialogueTextAnimating,
  renderDialogueView,
  revealDialogueTextImmediately
} from "../src/ui/dialogueView.js";
import { TestNode, installTestDocument } from "./dom-test-stub.mjs";

installTestDocument();

function createElements() {
  return {
    dialogueNpcName: new TestNode(),
    dialogueNpcTitle: new TestNode(),
    dialogueText: new TestNode(),
    dialoguePageIndicator: new TestNode(),
    dialogueNotice: new TestNode(),
    dialoguePortraitImage: new TestNode("img"),
    dialoguePortraitFallback: new TestNode(),
    dialogueChoices: new TestNode(),
    dialogueSkipButton: new TestNode("button"),
    dialogueAdvanceButton: new TestNode("button"),
    dialogueTextRegion: new TestNode()
  };
}

function createFakeScheduler() {
  const jobs = [];
  return {
    setTimeoutFn(callback, delay) {
      const job = { callback, delay, cancelled: false };
      jobs.push(job);
      return job;
    },
    clearTimeoutFn(job) {
      if (job) job.cancelled = true;
    },
    runAll() {
      while (jobs.length > 0) {
        const job = jobs.shift();
        if (!job.cancelled) job.callback();
      }
    }
  };
}

const npc = { title: "安平鎮的鐵匠", portrait: "" };
const choices = [
  { id: "forge", label: "進行鍛造" },
  { id: "leave", label: "離開" }
];
const scheduler = createFakeScheduler();
const els = createElements();
let advanced = 0;
let chosen = null;

renderDialogueView({
  els,
  npc,
  displayName: "羅根",
  node: { pages: [{ text: "材料帶了？" }], choices },
  pageIndex: 0,
  visibleChoices: choices,
  onAdvance: () => { advanced += 1; },
  onChoice: (choiceId) => { chosen = choiceId; },
  animateText: true,
  pageKey: "logan:greeting:0",
  typewriterOptions: {
    setTimeoutFn: scheduler.setTimeoutFn,
    clearTimeoutFn: scheduler.clearTimeoutFn,
    reducedMotion: false
  }
});

assert.equal(isDialogueTextAnimating(els), true);
assert.notEqual(els.dialogueText.textContent, "材料帶了？");
assert.equal(els.dialogueChoices.hidden, true);
assert.equal(els.dialogueAdvanceButton.hidden, true);
assert.equal(els.dialogueSkipButton.hidden, false);
assert.equal(typeof els.dialogueSkipButton.onclick, "function");
assert.equal(els.dialogueTextRegion.classList.contains("is-typing"), true);

const partialText = els.dialogueText.textContent;
renderDialogueView({
  els,
  npc,
  displayName: "羅根",
  node: { pages: [{ text: "材料帶了？" }], choices },
  pageIndex: 0,
  visibleChoices: choices,
  onAdvance: () => { advanced += 1; },
  onChoice: (choiceId) => { chosen = choiceId; },
  animateText: false,
  pageKey: "logan:greeting:0",
  typewriterOptions: {
    setTimeoutFn: scheduler.setTimeoutFn,
    clearTimeoutFn: scheduler.clearTimeoutFn,
    reducedMotion: false
  }
});
assert.equal(els.dialogueText.textContent, partialText, "相同頁面的重繪不得重啟或跳過動畫");
assert.equal(isDialogueTextAnimating(els), true);

els.dialogueSkipButton.onclick({ stopPropagation() {} });
assert.equal(els.dialogueText.textContent, "材料帶了？");
assert.equal(els.dialogueSkipButton.hidden, true);
assert.equal(els.dialogueChoices.hidden, false);
assert.equal(els.dialogueAdvanceButton.hidden, true);
assert.equal(els.dialogueTextRegion.classList.contains("is-typing"), false);
assert.equal(isDialogueTextAnimating(els), false);
assert.equal(revealDialogueTextImmediately(els), false);
assert.equal(advanced, 0, "跳過動畫不得同時翻頁");

els.dialogueChoices.children[0].listeners.get("click")();
assert.equal(chosen, "forge");

renderDialogueView({
  els,
  npc,
  displayName: "羅根",
  node: { pages: [{ text: "活著回來。" }] },
  pageIndex: 0,
  visibleChoices: [],
  onAdvance: () => { advanced += 1; },
  onChoice: () => {},
  animateText: true,
  pageKey: "logan:warning:0",
  typewriterOptions: {
    setTimeoutFn: scheduler.setTimeoutFn,
    clearTimeoutFn: scheduler.clearTimeoutFn,
    reducedMotion: false
  }
});
scheduler.runAll();
assert.equal(els.dialogueText.textContent, "活著回來。");
assert.equal(els.dialogueSkipButton.hidden, true);
assert.equal(els.dialogueAdvanceButton.hidden, false);
assert.equal(els.dialogueAdvanceButton.textContent, "結束對話");
assert.equal(isDialogueTextAnimating(els), false);
els.dialogueAdvanceButton.onclick();
assert.equal(advanced, 1);

renderDialogueView({
  els,
  npc,
  displayName: "羅根",
  node: { pages: [{ text: "減少動態效果時直接顯示。" }] },
  pageIndex: 0,
  visibleChoices: [],
  onAdvance: () => {},
  onChoice: () => {},
  animateText: true,
  pageKey: "logan:reduced-motion:0",
  typewriterOptions: {
    reducedMotion: true,
    setTimeoutFn: scheduler.setTimeoutFn,
    clearTimeoutFn: scheduler.clearTimeoutFn
  }
});
assert.equal(els.dialogueText.textContent, "減少動態效果時直接顯示。");
assert.equal(isDialogueTextAnimating(els), false);

renderDialogueView({
  els,
  npc,
  displayName: "羅根",
  node: { pages: [{ text: "即將離開畫面。" }] },
  pageIndex: 0,
  visibleChoices: [],
  onAdvance: () => {},
  onChoice: () => {},
  animateText: true,
  pageKey: "logan:cancel:0",
  typewriterOptions: {
    setTimeoutFn: scheduler.setTimeoutFn,
    clearTimeoutFn: scheduler.clearTimeoutFn,
    reducedMotion: false
  }
});
assert.equal(cancelDialogueTextAnimation(els), true);
assert.equal(els.dialogueSkipButton.hidden, true);
assert.equal(isDialogueTextAnimating(els), false);

console.log("Dialogue typewriter animation, skip, reduced-motion, rerender, and cleanup tests passed.");
