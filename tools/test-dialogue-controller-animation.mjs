import assert from "node:assert/strict";

import { createDialogueController } from "../src/ui/dialogueController.js";
import { dialogueDefinitions } from "../src/data/dialogues.js";
import { npcDefinitions } from "../src/data/npcs.js";
import { TestNode, installTestDocument } from "./dom-test-stub.mjs";

installTestDocument();

globalThis.window = {
  scrollY: 180,
  scrollTo() {},
  matchMedia: () => ({ matches: false })
};

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

const scheduler = createFakeScheduler();
const els = createElements();
const storyFlags = {
  metAnpingBlacksmith: false,
  knowsAnpingBlacksmithName: false
};
const controller = createDialogueController({
  els,
  npcDefinitions,
  dialogueDefinitions,
  getStoryFlags: () => storyFlags,
  setStoryFlag: (key, value) => {
    storyFlags[key] = value;
    return true;
  },
  onOpenFacility: () => {},
  onReturnToFacilityList: () => {},
  textAnimationOptions: {
    setTimeoutFn: scheduler.setTimeoutFn,
    clearTimeoutFn: scheduler.clearTimeoutFn,
    reducedMotion: false
  }
});

controller.open("anping-blacksmith");
assert.equal(controller.getState().pageIndex, 0);
assert.notEqual(els.dialogueText.textContent, "……有事？");
assert.equal(els.dialogueAdvanceButton.hidden, true);
assert.equal(els.dialogueSkipButton.hidden, false);

controller.advance();
assert.equal(controller.getState().pageIndex, 0, "第一次推進只應顯示全文");
assert.equal(els.dialogueText.textContent, "……有事？");

controller.advance();
assert.equal(controller.getState().pageIndex, 1, "全文顯示後再次推進才換頁");
assert.notEqual(els.dialogueText.textContent, "要打造武器，就把材料放到桌上。別靠爐子太近。");
assert.equal(controller.choose("leave"), false, "文字動畫期間不得提前執行選項");

scheduler.runAll();
assert.equal(els.dialogueText.textContent, "要打造武器，就把材料放到桌上。別靠爐子太近。");
controller.reset();
assert.equal(controller.getState().npcId, null);

delete globalThis.window;
console.log("Dialogue controller typewriter skip, guarded choices, and cleanup tests passed.");
