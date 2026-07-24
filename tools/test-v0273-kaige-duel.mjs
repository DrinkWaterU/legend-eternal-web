import assert from "node:assert/strict";

import { createSceneController } from "../src/app/sceneController.js";
import { createDefaultSave } from "../src/core/storage.js";
import { STORY_QUEST_STATUSES } from "../src/core/storyQuestRules.js";
import { createDuelController } from "../src/features/duel/duelController.js";

const save = createDefaultSave();
save.progression.characters.adventurer.unlocked = true;
save.progression.characters.adventurer.level = 20;
save.storyQuests.records["kaige-challenge"] = {
  status: STORY_QUEST_STATUSES.AVAILABLE,
  stageId: "meet-kaige"
};
const state = {
  selectedHeroId: "adventurer",
  battleSource: "main",
  ended: false,
  enemies: []
};
const dialogueCalls = [];
let questCompleted = false;
let settled = false;
let navigationContext = "adventure";
const duelExitPanel = {
  classList: {
    visible: false,
    add() { this.visible = true; },
    remove() { this.visible = false; }
  }
};

const controller = createDuelController({
  state,
  saveStore: { current: save },
  els: {
    duelExitPanel,
    combatLayout: { hidden: true },
    eventLayout: { hidden: false }
  },
  storyQuestRuntime: {
    getRecord: () => save.storyQuests.records["kaige-challenge"],
    startQuest: () => {
      save.storyQuests.records["kaige-challenge"] = {
        status: STORY_QUEST_STATUSES.ACTIVE,
        stageId: "defeat-kaige"
      };
      return true;
    },
    completeQuest: () => {
      questCompleted = true;
      return true;
    }
  },
  buildHeroFromProgression: () => ({ name: "冒險者", battleHooks: {} }),
  resetAdventureRunRuntime: () => {
    state.battleSource = "main";
    state.specialDuelContext = null;
    state.enemies = [];
  },
  beginBattleRuntime: ({ enemies, source }) => {
    state.battleSource = source;
    state.enemies = enemies.map((enemy) => ({
      ...structuredClone(enemy),
      runtimeId: enemy.id
    }));
  },
  settleBattleVictory: () => { settled = true; },
  addFixedLog() {},
  logCurrentEnemyGroupEncounter() {},
  render() {},
  showScreen() {},
  showNpcDialogue: (npcId, options) => dialogueCalls.push([npcId, options.nodeId]),
  setNavigationContext: (contextId) => { navigationContext = contextId; },
  closeAbilityInfoPanel() {},
  closeBlessingInfoPanel() {}
});

assert.deepEqual(controller.startDuel("missing"), {
  ok: false,
  message: "目前找不到這場切磋。"
});
assert.deepEqual(controller.startDuel("kaige-challenge"), { ok: true });
assert.equal(state.battleSource, "duel");
assert.equal(state.enemies[0].maxHp, 220);
assert.equal(state.hero.fleesRemaining, 0);
assert.equal(controller.isDuelActive(), true);

const sceneProperties = new Map();
const sceneDocument = {
  baseURI: "https://example.test/",
  body: {
    dataset: {},
    style: {
      setProperty: (name, value) => sceneProperties.set(name, value),
      removeProperty: (name) => sceneProperties.delete(name)
    }
  }
};
const sceneController = createSceneController({
  state,
  uiState: { navigationContext: "adventure" },
  documentRef: sceneDocument,
  defaultSafeAreaId: "camp",
  getNavigationContext: () => ({ scene: "region" }),
  getCurrentSafeArea: () => ({
    id: "anping-town",
    visual: {
      background: {
        mobile: "assets/images/anping-town/anping-town-mobile.jpg",
        desktop: "assets/images/anping-town/anping-town-desktop.jpg"
      }
    },
    audio: {}
  }),
  currentAdventureSource: () => ({
    visual: {
      background: {
        mobile: "assets/images/regions/coast/coast-beach-mobile.jpg",
        desktop: "assets/images/regions/coast/coast-beach.jpg"
      }
    }
  }),
  getAdventureEncounterIndex: () => 0,
  musicManager: { requestTrack: () => Promise.resolve() },
  ambientManager: { requestTrack: () => Promise.resolve() }
});
sceneController.applySceneContext("gameScreen");
assert.equal(sceneDocument.body.dataset.scene, "camp");
assert.equal(sceneDocument.body.dataset.safeArea, "anping-town");
assert.match(sceneProperties.get("--safe-area-bg-desktop"), /anping-town-desktop\.jpg/);
assert.equal(sceneProperties.has("--region-bg-desktop"), false);

const opponent = state.enemies[0];
state.hero.battleHooks.onDirectAttackResolved({ enemy: opponent });
assert.equal(opponent.duelFuryValue, 1);
opponent.hp = 100;
state.hero.battleHooks.onDirectAttackResolved({ enemy: opponent });
assert.equal(opponent.duelFuryValue, 3);
controller.prepareEnemyAction(opponent);
assert.equal(opponent.specialAttack.name, "雙刃重斬");
controller.completeEnemyAction(opponent);
assert.equal(opponent.duelFuryValue, 0);

assert.equal(controller.requestExit(), true);
assert.equal(duelExitPanel.classList.visible, true);
controller.cancelExit();
assert.equal(duelExitPanel.classList.visible, false);
assert.equal(controller.handleBattleVictory(), true);
assert.equal(settled, true);
assert.equal(questCompleted, true);
assert.deepEqual(dialogueCalls.at(-1), ["kaige", "victory"]);
assert.equal(navigationContext, "camp", "決鬥結束後必須恢復安全區導覽，返回安平鎮而非主選單");
assert.equal(controller.isDuelActive(), false);

console.log("v0.2.7.3 Kaige independent duel lifecycle and Fury opponent tests passed.");
