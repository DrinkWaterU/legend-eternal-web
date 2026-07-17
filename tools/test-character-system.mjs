import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildHeroFromProgression } from "../src/core/progression.js";
import { createDefaultSave, migrateSave } from "../src/core/storage.js";
import { scheduleRegionEvent } from "../src/core/events.js";
import { characterDefinitions } from "../src/data/characters/index.js";
import { forestRegion } from "../src/data/regions/forest.js";

function sequenceRandom(values) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)] ?? 0;
}

{
  const save = createDefaultSave();
  assert.equal(save.progression.characters.adventurer.unlocked, true, "冒險者應預設解鎖");
  assert.equal(save.progression.characters.archer.unlocked, false, "弓箭手應預設鎖定");
  assert.equal(save.progression.characters.archer.level, 1, "弓箭手應有獨立 Lv.1 進度");
}

{
  const raw = createDefaultSave();
  raw.schemaVersion = 6;
  raw.storyFlags.archerRescued = true;
  raw.progression.characters.archer.unlocked = false;
  raw.settings.selectedCharacterId = "archer";
  const migrated = migrateSave(raw);
  assert.equal(migrated.progression.characters.archer.unlocked, true, "Schema 6 已救援存檔應補正弓箭手解鎖");
  assert.equal(migrated.settings.selectedCharacterId, "archer", "已救援弓箭手應可維持目前角色選擇");
}

{
  const raw = createDefaultSave();
  raw.settings.selectedCharacterId = "archer";
  raw.progression.characters.archer.unlocked = false;
  const migrated = migrateSave(raw);
  assert.equal(migrated.settings.selectedCharacterId, "adventurer", "未解鎖角色不得透過 selectedCharacterId 繞過");
}

{
  const archer = characterDefinitions.archer;
  const hero = buildHeroFromProgression(archer, { level: 25, exp: 0, learnedSkills: [] });
  assert.equal(hero.characterId, "archer");
  assert.equal(hero.maxHp, 192);
  assert.equal(hero.attack, 18);
  assert.equal(hero.defense, 6);
  assert.equal(hero.critChance, 0.17);
  assert.equal(hero.skills.length, 12);
  assert.equal(archer.levelCurve.maxLevel, 25);
  assert.equal(archer.unlock?.storyFlag, "archerRescued", "弓箭手解鎖 migration 應由角色 definition 宣告故事旗標");
  assert.equal(archer.skills.find((skill) => skill.id === "venomous-arrowhead")?.targetSkillId, "poison-arrow");
  assert.equal(archer.skills.find((skill) => skill.id === "distance-control")?.targetSkillId, "keep-distance");
  assert.equal(archer.skills.find((skill) => skill.id === "archer-follow-up-plus")?.targetSkillId, "archer-follow-up");
  assert.equal(archer.skills.find((skill) => skill.id === "dense-arrow-rain")?.targetSkillId, "arrow-rain");
  assert.equal(archer.skills.find((skill) => skill.id === "hundred-step-shot")?.targetSkillId, undefined);
}

{
  const scheduled = scheduleRegionEvent(
    forestRegion,
    sequenceRandom([0.49, 0, 0]),
    { scheduleChance: 0.5 }
  );
  assert.equal(scheduled?.eventId, "forest-campfire", "未救援 50% override 應可排程林間營火");
  assert.equal(
    scheduleRegionEvent(forestRegion, sequenceRandom([0.5]), { scheduleChance: 0.5 }),
    null,
    "50% 邊界不應被重複解讀"
  );
  assert.equal(
    scheduleRegionEvent(forestRegion, sequenceRandom([0.45])),
    null,
    "救援後仍應沿用森林正式 45% 排程邊界"
  );
}

{
  const runtimeSources = [
    "../src/features/adventure/routeEndingController.js",
    "../src/features/character/characterController.js",
    "../src/app/eventBindings.js"
  ].map((path) => readFileSync(new URL(path, import.meta.url), "utf8")).join("\n");
  assert.match(
    runtimeSources,
    /archerProgress\.unlocked = true;/,
    "哥布林營地正式完成流程應立即寫入弓箭手 unlocked，不得只依賴 migration"
  );
  assert.match(
    runtimeSources,
    /isCharacterUnlocked\(characterId\)/,
    "runtime 角色選擇應驗證 unlocked 狀態"
  );
  assert.match(
    runtimeSources,
    /selectCharacterButton\.addEventListener\("click", selectCharacterFromDetail\)/,
    "使用角色按鈕應以角色詳情 id 正式切換角色"
  );
  assert.match(
    runtimeSources,
    /closeCharacterLockedButton\.addEventListener\("click", closeLockedCharacterHint\)/,
    "未知角色提示應綁定正式關閉按鈕"
  );
}

console.log("Character progression, unlock, and event schedule tests passed.");
