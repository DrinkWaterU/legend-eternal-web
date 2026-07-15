import assert from "node:assert/strict";

import {
  areDialogueConditionsMet,
  assertDialogueDefinitions,
  evaluateDialogueCondition,
  getVisibleDialogueChoices,
  resolveDialogueEntryNode
} from "../src/core/dialogue.js";
import { dialogueDefinitions } from "../src/data/dialogues.js";
import {
  assertNpcDefinitions,
  npcDefinitions,
  resolveNpcDisplayName
} from "../src/data/npcs.js";
import { facilityDefinitions } from "../src/data/facilities.js";
import { createDefaultSave, migrateSave } from "../src/core/storage.js";

const storyFlagKeys = Object.keys(createDefaultSave().storyFlags);
assert.equal(assertNpcDefinitions(npcDefinitions, { storyFlagKeys, dialogueDefinitions }), true);
assert.equal(assertDialogueDefinitions(dialogueDefinitions, {
  npcDefinitions,
  storyFlagKeys,
  facilityDefinitions
}), true);

const dialogue = dialogueDefinitions["anping-blacksmith-main"];
const npc = npcDefinitions["anping-blacksmith"];

assert.equal(resolveDialogueEntryNode(dialogue, {
  storyFlags: { metAnpingBlacksmith: false, knowsAnpingBlacksmithName: false }
}), "first-meeting");
assert.equal(resolveDialogueEntryNode(dialogue, {
  storyFlags: { metAnpingBlacksmith: true, knowsAnpingBlacksmithName: false }
}), "default-greeting");
assert.equal(resolveDialogueEntryNode(dialogue, {
  storyFlags: { metAnpingBlacksmith: true, knowsAnpingBlacksmithName: true }
}), "known-name-greeting");

assert.equal(resolveNpcDisplayName(npc, { storyFlags: {} }), "安平鎮的鐵匠");
assert.equal(resolveNpcDisplayName(npc, { storyFlags: { metAnpingBlacksmith: true } }), "鐵匠");
assert.equal(resolveNpcDisplayName(npc, {
  storyFlags: { metAnpingBlacksmith: true, knowsAnpingBlacksmithName: true }
}), "羅根");

assert.equal(evaluateDialogueCondition({
  type: "storyFlag",
  key: "metAnpingBlacksmith",
  operator: "equals",
  value: true
}, { storyFlags: { metAnpingBlacksmith: true } }), true);
assert.equal(evaluateDialogueCondition({
  type: "storyFlag",
  key: "metAnpingBlacksmith",
  operator: "notEquals",
  value: true
}, { storyFlags: { metAnpingBlacksmith: false } }), true);
assert.equal(areDialogueConditionsMet([
  { type: "storyFlag", key: "metAnpingBlacksmith", operator: "equals", value: true },
  { type: "storyFlag", key: "knowsAnpingBlacksmithName", operator: "equals", value: false }
], { storyFlags: { metAnpingBlacksmith: true, knowsAnpingBlacksmithName: false } }), true);

const principleNode = dialogue.nodes["about-craft-principle"];
assert.deepEqual(
  getVisibleDialogueChoices(principleNode, {
    storyFlags: { knowsAnpingBlacksmithName: false }
  }).map((choice) => choice.id),
  ["ask-name", "return-after-principle-unknown"]
);
assert.deepEqual(
  getVisibleDialogueChoices(principleNode, {
    storyFlags: { knowsAnpingBlacksmithName: true }
  }).map((choice) => choice.id),
  ["return-after-principle-known"]
);

const oldSave = createDefaultSave();
delete oldSave.storyFlags.metAnpingBlacksmith;
delete oldSave.storyFlags.knowsAnpingBlacksmithName;
const migrated = migrateSave(oldSave);
assert.equal(migrated.storyFlags.metAnpingBlacksmith, false);
assert.equal(migrated.storyFlags.knowsAnpingBlacksmithName, false);

const inconsistentOldSave = createDefaultSave();
inconsistentOldSave.storyFlags.metAnpingBlacksmith = false;
inconsistentOldSave.storyFlags.knowsAnpingBlacksmithName = true;
const normalizedIdentitySave = migrateSave(inconsistentOldSave);
assert.equal(normalizedIdentitySave.storyFlags.knowsAnpingBlacksmithName, true);
assert.equal(normalizedIdentitySave.storyFlags.metAnpingBlacksmith, true);

assert.throws(() => assertDialogueDefinitions({
  broken: {
    id: "broken",
    npcId: "anping-blacksmith",
    fallbackNodeId: "missing",
    nodes: {}
  }
}), /fallbackNodeId 無效/);

console.log("Dialogue definitions, entry rules, choice conditions, identity, and migration tests passed.");
