import assert from "node:assert/strict";

import {
  areDialogueConditionsMet,
  assertDialogueDefinitions,
  evaluateDialogueCondition,
  getVisibleDialogueChoices,
  getVisibleDialoguePages,
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

const blacksmithChatMenu = dialogue.nodes["chat-menu"];
assert.deepEqual(
  getVisibleDialogueChoices(blacksmithChatMenu, {
    storyFlags: { knowsAnpingBlacksmithName: false }
  }).map((choice) => choice.id),
  ["talk-weapons", "talk-anping", "chat-return-unknown"]
);
assert.deepEqual(
  getVisibleDialogueChoices(blacksmithChatMenu, {
    storyFlags: { knowsAnpingBlacksmithName: true }
  }).map((choice) => choice.id),
  ["talk-weapons", "talk-anping", "talk-past", "chat-return-known"]
);


const guildDialogue = dialogueDefinitions["anping-guild-receptionist-main"];
const guildNpc = npcDefinitions["anping-guild-receptionist"];
assert.equal(resolveDialogueEntryNode(guildDialogue, { storyFlags: {} }), "first-meeting");
assert.equal(resolveDialogueEntryNode(guildDialogue, {
  storyFlags: { metAnpingGuildReceptionist: true }
}), "experience-check");
assert.equal(resolveDialogueEntryNode(guildDialogue, {
  storyFlags: { knowsAnpingGuildReceptionistName: true }
}), "feature-introduction");
assert.equal(resolveDialogueEntryNode(guildDialogue, {
  storyFlags: { registeredAtAnpingGuild: true }
}), "default-greeting");
assert.equal(resolveNpcDisplayName(guildNpc, { storyFlags: {} }), "公會接待員");
assert.equal(resolveNpcDisplayName(guildNpc, {
  storyFlags: { metAnpingGuildReceptionist: true }
}), "接待員小姐");
assert.equal(resolveNpcDisplayName(guildNpc, {
  storyFlags: { knowsAnpingGuildReceptionistName: true }
}), "瑟琳");

assert.equal(evaluateDialogueCondition({
  type: "regionRouteClear",
  regionId: "forest",
  routeClearKey: "goblinCamp",
  minimumClears: 1
}, { statistics: { regions: { forest: { routeClears: { goblinCamp: 1 } } } } }), true);
assert.equal(evaluateDialogueCondition({
  type: "regionRouteClear",
  regionId: "forest",
  routeClearKey: "goblinCamp",
  minimumClears: 2
}, { statistics: { regions: { forest: { routeClears: { goblinCamp: 1 } } } } }), false);

const experienceNode = guildDialogue.nodes["experience-check"];
assert.equal(getVisibleDialoguePages(experienceNode, { storyFlags: {}, statistics: {} }).length, 1);
assert.equal(getVisibleDialoguePages(experienceNode, {
  storyFlags: { archerRescued: true },
  statistics: { regions: { forest: { routeClears: { goblinCamp: 1 } } } }
}).length, 3);
assert.equal(guildDialogue.nodes["first-feature-overview"].pages.length, 4);
assert.equal(guildDialogue.nodes["about-guild"].pages.length, 5);
assert.equal(guildDialogue.nodes["about-work"].pages.length, 4);
assert.equal(guildDialogue.nodes["about-anping"].pages.length, 4);
assert.equal(
  guildDialogue.nodes["default-greeting"].choices.find((choice) => choice.id === "ask-about-guild")?.label,
  "介紹冒險者公會"
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


const inconsistentGuildSave = createDefaultSave();
inconsistentGuildSave.storyFlags.metAnpingGuildReceptionist = false;
inconsistentGuildSave.storyFlags.knowsAnpingGuildReceptionistName = false;
inconsistentGuildSave.storyFlags.registeredAtAnpingGuild = true;
const normalizedGuildSave = migrateSave(inconsistentGuildSave);
assert.equal(normalizedGuildSave.storyFlags.registeredAtAnpingGuild, true);
assert.equal(normalizedGuildSave.storyFlags.knowsAnpingGuildReceptionistName, true);
assert.equal(normalizedGuildSave.storyFlags.metAnpingGuildReceptionist, true);

assert.throws(() => assertDialogueDefinitions({
  broken: {
    id: "broken",
    npcId: "anping-blacksmith",
    fallbackNodeId: "missing",
    nodes: {}
  }
}), /fallbackNodeId 無效/);

console.log("Dialogue JSON definitions, conditional pages, identity, and migration tests passed.");
