import assert from "node:assert/strict";

import { createDefaultSave, migrateSave } from "../src/core/storage.js";
import {
  STORY_QUEST_STATUSES,
  makeAvailableStoryQuests,
  normalizeStoryQuestState
} from "../src/core/storyQuestRules.js";
import { applyStoryQuestRewards } from "../src/core/storyQuestRewards.js";
import { characterDefinitions } from "../src/data/characters/index.js";
import { materialDefinitions } from "../src/data/materials.js";
import { npcDefinitions } from "../src/data/npcs.js";
import { storyQuestDefinitions } from "../src/data/storyQuests.js";
import { weaponDefinitions } from "../src/data/weapons.js";
import { createStoryQuestRuntime } from "../src/features/storyQuest/storyQuestRuntime.js";

const QUEST_ID = "kaige-challenge";
const VISITED_AT = "2026-07-24T12:00:00.000Z";
const KAIGE_PORTRAIT = "assets/images/characters/kaige/kaige.png";

assert.equal(characterDefinitions.kaige.portrait, KAIGE_PORTRAIT);
assert.equal(npcDefinitions.kaige.portrait, KAIGE_PORTRAIT);
assert.equal(
  characterDefinitions.kaige.portraitFocus,
  npcDefinitions.kaige.portraitFocus,
  "凱哥角色與 NPC 必須共用圖片裁切焦點"
);

const save = createDefaultSave();
assert.equal(save.schemaVersion, 10);
assert.equal(save.progression.characters.kaige.unlocked, false);
assert.deepEqual(save.storyQuests, { records: {} });

save.progression.characters.adventurer.level = 20;
assert.deepEqual(makeAvailableStoryQuests(save, storyQuestDefinitions), []);
save.progression.safeAreas["anping-town"] = {
  unlocked: true,
  unlockedAt: VISITED_AT,
  visitedAt: VISITED_AT
};
assert.deepEqual(makeAvailableStoryQuests(save, storyQuestDefinitions), []);
save.statistics.regions.forest.routeClears.main = 1;
assert.deepEqual(makeAvailableStoryQuests(save, storyQuestDefinitions), [QUEST_ID]);
assert.deepEqual(makeAvailableStoryQuests(save, storyQuestDefinitions), [], "任務不得重複建立");

const normalized = normalizeStoryQuestState({
  records: {
    [QUEST_ID]: { status: "active", stageId: "unknown-stage" },
    unknown: { status: "completed", stageId: "anything" }
  }
}, storyQuestDefinitions);
assert.deepEqual(normalized, {
  records: {
    [QUEST_ID]: { status: STORY_QUEST_STATUSES.ACTIVE, stageId: "defeat-kaige" }
  }
});

let persisted = true;
const saveStore = {
  current: save,
  replace(nextSave) {
    this.current = nextSave;
  }
};
const runtime = createStoryQuestRuntime({
  saveStore,
  storyQuestDefinitions,
  characterDefinitions,
  weaponDefinitions,
  materialDefinitions,
  saveGameSafe: () => persisted
});

persisted = false;
const beforeFailedStart = structuredClone(saveStore.current);
assert.equal(runtime.startQuest(QUEST_ID), false);
assert.deepEqual(saveStore.current, beforeFailedStart, "任務開始寫檔失敗時應回滾");

persisted = true;
assert.equal(runtime.startQuest(QUEST_ID), true);
assert.deepEqual(runtime.getRecord(QUEST_ID), {
  status: STORY_QUEST_STATUSES.ACTIVE,
  stageId: "defeat-kaige"
});

persisted = false;
const beforeFailedCompletion = structuredClone(saveStore.current);
assert.equal(runtime.completeQuest(QUEST_ID), false);
assert.deepEqual(saveStore.current, beforeFailedCompletion, "任務完成與獎勵寫檔失敗時應一起回滾");

persisted = true;
assert.equal(runtime.completeQuest(QUEST_ID), true);
assert.equal(runtime.getRecord(QUEST_ID).status, STORY_QUEST_STATUSES.COMPLETED);
assert.equal(saveStore.current.progression.characters.kaige.unlocked, true);
assert.equal(saveStore.current.inventory.weapons["worn-battle-axe"], true);
assert.equal(saveStore.current.progression.characters.kaige.equipment.weaponId, "worn-battle-axe");
assert.equal(runtime.completeQuest(QUEST_ID), true, "已完成任務重入應維持冪等");

const repaired = migrateSave({
  schemaVersion: 9,
  storyQuests: {
    records: {
      [QUEST_ID]: { status: STORY_QUEST_STATUSES.COMPLETED, stageId: "defeat-kaige" }
    }
  }
});
assert.equal(repaired.schemaVersion, 10);
assert.equal(repaired.progression.characters.kaige.unlocked, true);
assert.equal(repaired.inventory.weapons["worn-battle-axe"], true);
assert.equal(repaired.progression.characters.kaige.equipment.weaponId, "worn-battle-axe");

const whitelistRewardSave = createDefaultSave();
applyStoryQuestRewards({
  saveData: whitelistRewardSave,
  definition: {
    id: "whitelist-reward-test",
    rewards: {
      gold: 7,
      materials: [{ id: "slime_gel", quantity: 2 }],
      storyFlags: [{ key: "metKaige", value: true }]
    }
  },
  characterDefinitions,
  weaponDefinitions,
  materialDefinitions
});
assert.equal(whitelistRewardSave.inventory.gold, 7);
assert.equal(whitelistRewardSave.inventory.materials.slime_gel.quantity, 2);
assert.equal(whitelistRewardSave.storyFlags.metKaige, true);

console.log("v0.2.7.3 story quest rules, atomic save and reward migration tests passed.");
