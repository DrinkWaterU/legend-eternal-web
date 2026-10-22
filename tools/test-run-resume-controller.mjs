import assert from "node:assert/strict";
import { createRunResumeController } from "../src/app/runResumeController.js";
import { createAdventureRuntimeState } from "../src/app/runtimeState.js";
import { createDefaultSave } from "../src/core/saveDefaults.js";
import { buildHeroFromProgression } from "../src/core/progression.js";
import { captureRunSnapshot } from "../src/core/runSnapshot.js";
import { createSaveStore } from "../src/app/saveStore.js";
import { createSaveTransactions } from "../src/app/saveTransactions.js";
import { characterDefinitions } from "../src/data/characters/index.js";
import { regionDefinitions } from "../src/data/regions/index.js";
import { TestNode } from "./dom-test-stub.mjs";

const state = createAdventureRuntimeState({ regionDefinitions, characterDefinitions });
state.hero = buildHeroFromProgression(characterDefinitions.adventurer, { level: 1, exp: 0, learnedSkills: [] });
state.phase = "combat";
state.runRandomState = 1;
state.runStats = { levelUps: [], learnedSkills: [], unlockedCharacters: [] };
const initial = createDefaultSave();
initial.activeRun = captureRunSnapshot(state);
const before = structuredClone(initial);
const store = createSaveStore({ initialSave: initial, persistSave: () => true });
const tx = createSaveTransactions({ saveStore: store, pendingView: { show() { assert.fail(); }, hide() {} } });
const hosts = [new TestNode(), new TestNode()];
const documentRef = { querySelector(selector) { return selector.startsWith("#menu") ? hosts[0] : hosts[1]; }, createElement: tag => new TestNode(tag) };
const screens = [];
const controller = createRunResumeController({ foundation: { state, saveStore: store, ...tx },
  battle: { render() { throw new Error("injected renderer failure"); } },
  adventure: { closeStoryPanel() {}, resetAdventureRunRuntime() {}, duelController: { restoreDuelRuntime() {} } },
  screen: { showScreen(id) { screens.push(id); } }, els: new Proxy({}, { get: () => new TestNode() }),
  documentRef, windowRef: { confirm: () => true } });
controller.resume();
assert.equal(screens.at(-1), "menuScreen");
assert.deepEqual(store.current, before, "A renderer error cannot rewrite or erase the stored journey");
assert.equal(hosts[0].children[0].children[2].disabled, true);
controller.discard();
assert.equal(store.current.activeRun, null);
assert.deepEqual(store.current.progression, before.progression);
assert.deepEqual(store.current.statistics, before.statistics);
assert.deepEqual(store.current.inventory, before.inventory);
console.log("Resume controller: failed restoration preserves progress, disables resume, and allows confirmed safe discard.");
