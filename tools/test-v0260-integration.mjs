import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { access, readFile } from "node:fs/promises";

import { GAME_VERSION, SAVE_SCHEMA_VERSION } from "../src/config.js";
import { getFacilityDefinition } from "../src/data/facilities.js";
import { dialogueDefinitions } from "../src/data/dialogues.js";
import { npcDefinitions } from "../src/data/npcs.js";

const root = new URL("../", import.meta.url);
const [html, game, dom, componentsCss, responsiveCss, storage, dialogueView, dialogueController] = await Promise.all([
  readFile(new URL("index.html", root), "utf8"),
  readFile(new URL("game.js", root), "utf8"),
  readFile(new URL("src/ui/dom.js", root), "utf8"),
  readFile(new URL("src/styles/components.css", root), "utf8"),
  readFile(new URL("src/styles/responsive.css", root), "utf8"),
  readFile(new URL("src/core/storage.js", root), "utf8"),
  readFile(new URL("src/ui/dialogueView.js", root), "utf8"),
  readFile(new URL("src/ui/dialogueController.js", root), "utf8")
]);

assert.equal(GAME_VERSION, "v0.2.6.0-alpha");
assert.equal(SAVE_SCHEMA_VERSION, 8);
assert.equal(getFacilityDefinition("blacksmith").npcId, "anping-blacksmith");
assert.equal(npcDefinitions["anping-blacksmith"].name, "羅根");
assert.equal(dialogueDefinitions["anping-blacksmith-main"].fallbackNodeId, "default-greeting");

for (const id of [
  "facilityPanel",
  "dialogueView",
  "dialogueAreaLabel",
  "dialogueHeading",
  "dialogueBackButton",
  "dialoguePortraitImage",
  "dialoguePortraitFallback",
  "dialogueNpcTitle",
  "dialogueNpcName",
  "dialogueTextRegion",
  "dialogueSkipButton",
  "dialogueText",
  "dialoguePageIndicator",
  "dialogueNotice",
  "dialogueChoices",
  "dialogueAdvanceButton"
]) {
  assert.match(html, new RegExp(`id="${id}"`), `HTML 缺少 ${id}`);
  assert.match(dom, new RegExp(`#${id}`), `dom.js 缺少 ${id}`);
}

assert.match(storage, /metAnpingBlacksmith: false/);
assert.match(storage, /knowsAnpingBlacksmithName: false/);
assert.match(game, /function openFacility\(facility\)[\s\S]*facility\?\.npcId[\s\S]*showNpcDialogue/);
assert.match(game, /function dispatchFacilityAction\(facility, options = \{\}\)/);
assert.match(game, /function openFacilityFromDialogue\(facilityId, npcId\)/);
assert.match(game, /blacksmithReturnView/);
assert.match(game, /function handleBlacksmithBack\(\)/);
assert.match(game, /showNpcDialogue\(uiState\.blacksmithReturnNpcId, \{ animateText: false \}\)/);
assert.match(game, /dialogueController\.open\(npc\.id, \{[\s\S]*renderAfter: false/);
assert.match(game, /dialogueBackButton\.addEventListener/);
assert.doesNotMatch(game, /window\.scrollTo\(\{\s*top:\s*0/);

assert.match(componentsCss, /\.dialogue-layout[\s\S]*height: 615px/);
assert.match(componentsCss, /\.dialogue-portrait-card img[\s\S]*object-fit: cover/);
assert.match(componentsCss, /\.facility-panel\.is-dialogue-mode/);
assert.match(componentsCss, /\.dialogue-choice-list[\s\S]*overflow-y: auto/);
assert.match(componentsCss, /\.dialogue-text-region\.is-typing #dialogueText::after/);
assert.match(componentsCss, /\.dialogue-skip-button[\s\S]*backdrop-filter: blur\(10px\)/);
assert.match(responsiveCss, /\.dialogue-layout[\s\S]*grid-template-columns: 1fr[\s\S]*height: auto/);
assert.match(responsiveCss, /\.dialogue-content-card[\s\S]*height: 560px/);
assert.match(responsiveCss, /@media \(max-width: 520px\)[\s\S]*\.dialogue-content-card[\s\S]*height: 540px/);
assert.match(responsiveCss, /\.dialogue-portrait-card img[\s\S]*object-position/);
assert.match(dialogueView, /DEFAULT_TYPEWRITER_OPTIONS/);
assert.match(dialogueView, /dialogueSkipButton\.hidden = false/);
assert.match(dialogueView, /dialogueAdvanceButton\.hidden = true/);
assert.match(dialogueView, /revealDialogueTextImmediately/);
assert.match(dialogueView, /prefers-reduced-motion: reduce/);
assert.match(dialogueController, /revealDialogueTextImmediately\(els\)/);
assert.match(dialogueController, /isDialogueTextAnimating\(els\)/);

const portraitPath = npcDefinitions["anping-blacksmith"].portrait;
if (!existsSync(new URL("AI_PACKAGE_INFO.txt", root))) {
  await access(new URL(portraitPath, root));
}
assert.match(html, new RegExp(`styles\\.css\\?v=${GAME_VERSION.slice(1).replaceAll(".", "\\.")}`));
assert.match(html, new RegExp(`game\\.js\\?v=${GAME_VERSION.slice(1).replaceAll(".", "\\.")}`));

console.log("v0.2.6.0 NPC dialogue DOM, fixed layout, typewriter animation, facility wiring, portrait, save flags, and responsive integration tests passed.");
