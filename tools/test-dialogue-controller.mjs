import assert from "node:assert/strict";

import { createDialogueController } from "../src/ui/dialogueController.js";
import { dialogueDefinitions } from "../src/data/dialogues.js";
import { npcDefinitions } from "../src/data/npcs.js";
import { TestNode, installTestDocument } from "./dom-test-stub.mjs";

installTestDocument();

globalThis.window = {
  scrollY: 420,
  scrollCalls: [],
  scrollTo(options) { this.scrollCalls.push(options); }
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

const storyFlags = {
  metAnpingBlacksmith: false,
  knowsAnpingBlacksmithName: false
};
const els = createElements();
const openedFacilities = [];
let returned = 0;
let saveShouldSucceed = true;
const controller = createDialogueController({
  els,
  npcDefinitions,
  dialogueDefinitions,
  getStoryFlags: () => storyFlags,
  setStoryFlag: (key, value) => {
    if (!saveShouldSucceed) return false;
    storyFlags[key] = value;
    return true;
  },
  onOpenFacility: (facilityId, npcId) => openedFacilities.push({ facilityId, npcId }),
  onReturnToFacilityList: () => { returned += 1; },
  textAnimationOptions: { enabled: false }
});

assert.equal(controller.open("anping-blacksmith"), "first-meeting");
assert.equal(els.dialogueNpcName.textContent, "安平鎮的鐵匠");
assert.equal(els.dialogueText.textContent, "……有事？");
controller.advance();
controller.advance();
assert.equal(controller.getState().pageIndex, 2);

saveShouldSucceed = false;
controller.advance();
assert.equal(storyFlags.metAnpingBlacksmith, false);
assert.equal(controller.getState().nodeId, "first-meeting");
assert.match(els.dialogueNotice.textContent, /無法保存/);

saveShouldSucceed = true;
controller.advance();
assert.equal(storyFlags.metAnpingBlacksmith, true);
assert.equal(controller.getState().nodeId, "default-greeting");
assert.equal(els.dialogueNpcName.textContent, "鐵匠");

controller.choose("talk-logan");
assert.equal(controller.getState().nodeId, "chat-menu");
controller.choose("talk-weapons");
controller.advance();
controller.advance();
assert.equal(controller.getState().nodeId, "about-weapons");
controller.choose("ask-why-care");
controller.advance();
assert.equal(controller.getState().nodeId, "about-craft-principle");
controller.choose("ask-name");
controller.advance();
controller.advance();
saveShouldSucceed = false;
controller.advance();
assert.equal(storyFlags.knowsAnpingBlacksmithName, false);
assert.equal(controller.getState().nodeId, "ask-name");

saveShouldSucceed = true;
controller.advance();
assert.equal(storyFlags.knowsAnpingBlacksmithName, true);
assert.equal(controller.getState().nodeId, "chat-menu");
assert.equal(els.dialogueNpcName.textContent, "羅根");
controller.choose("chat-return-known");
assert.equal(controller.getState().nodeId, "known-name-greeting");
controller.choose("open-smithing-known");
assert.deepEqual(openedFacilities, [{ facilityId: "blacksmith", npcId: "anping-blacksmith" }]);
controller.choose("leave-known");
assert.equal(returned, 1);

assert.ok(window.scrollCalls.length > 0);
assert.ok(window.scrollCalls.every((call) => call.top === 420), "對話切換不得讓頁面跳到頂端");
assert.ok(window.scrollCalls.every((call) => call.behavior === "instant"));

delete globalThis.window;
console.log("Dialogue controller progression, save rollback, facility action, naming, and scroll tests passed.");
