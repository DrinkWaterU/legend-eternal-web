import assert from "node:assert/strict";

import { getBlessingPool } from "../src/data/blessings/index.js";
import { achievementDefinitions } from "../src/data/achievements.js";
import { applyBlessingEffects } from "../src/core/blessings.js";
import { eventDefinitions, getEventDefinition } from "../src/data/events/index.js";
import { regionDefinitions } from "../src/data/regions/index.js";
import { getRegionEncounterGroupOption } from "../src/data/regions/regionDefinition.js";
import { createRuntimeEnemyGroup } from "../src/core/enemyGroups.js";
import { scheduleRegionEvent, shouldTriggerScheduledEvent } from "../src/core/events.js";
import { createRunPreparation } from "../src/core/preparations.js";
import {
  applyParalysis,
  applySaltErosion,
  advanceHeroCombatStatuses,
  getHeroAttackDamageMultiplier,
  getHeroBattleHealingAmount,
  getHeroBattleHealingMultiplier,
  buildEnemyGroup
} from "../src/core/combat.js";

const silentLog = {
  fixed() {}
};

const beach = regionDefinitions.beach;
assert.ok(beach, "應註冊海灘地區");
assert.equal(beach.regionName, "海岸", "海灘資料的玩家可見第三地區名稱應為海岸");
assert.equal(beach.segmentName, "海灘", "海灘資料應保留段落名稱");
assert.equal(beach.encounterCount, 16, "海灘應有 16 場戰鬥");
assert.equal(beach.encounterPlan.at(-1).type, "boss", "海灘最後一場應為 Boss");
assert.equal(beach.recommendedLevel, "Lv.20+");
assert.equal(
  beach.description,
  "穿過森林的盡頭，迎面而來的是無邊的開闊海岸。乾涸鹽痕、噬人礁岩與莫測的漲退潮線交織成網，使每一步前行都充滿未知的變數。"
);
assert.equal(beach.note, undefined, "玩家地區描述不可暴露內部施工資訊");
assert.equal(achievementDefinitions.beach_trial.displayRegionName, "海灘");
assert.equal(achievementDefinitions.coast_trial.displayRegionName, "海岸");
assert.equal(achievementDefinitions.coast_trial.conditionText, "擊敗海岸洞穴首領");
assert.deepEqual(beach.preparations.map((preparation) => preparation.id), [
  "freshwater-dressing",
  "insulated-gloves",
  "reef-anchor-tether"
]);

const beachBlessings = getBlessingPool("beach");
assert.ok(beachBlessings, "應註冊海灘 Blessing 池");
assert.equal(beachBlessings.blessings.length, 10, "海灘應有 10 個 Blessing");
assert.equal(beachBlessings.blessings.filter((blessing) => blessing.rarity === "common").length, 4);
assert.equal(beachBlessings.blessings.filter((blessing) => blessing.rarity === "uncommon").length, 4);
assert.equal(beachBlessings.blessings.filter((blessing) => blessing.rarity === "rare").length, 2);
const saltward = beachBlessings.blessings.find((blessing) => blessing.id === "beach-saltward");
const saltwardHero = { saltHealingReduction: 0.3 };
applyBlessingEffects(saltwardHero, saltward);
applyBlessingEffects(saltwardHero, saltward);
assert.equal(saltwardHero.saltHealingReduction, 0.2, "淬鹽傲骨重複取得不可疊加");

const rareAttack = beachBlessings.blessings.find((blessing) => blessing.id === "beach-fishman-hunt");
const rareDefense = beachBlessings.blessings.find((blessing) => blessing.id === "beach-tide-counter");
assert.equal(
  rareDefense.effectText,
  "防禦力 +2，每場戰鬥開始獲得 8 點護盾。\n面對 2 名敵人以上時，造成的傷害固定提高 10%（唯一，不可疊加）。"
);
assert.ok(rareAttack.effects.some((effect) => effect.stat === "attack" && effect.amount === 5));
assert.ok(rareAttack.effects.some((effect) => (
  effect.type === "addFamilyDamageBonus"
  && effect.family === "fishman"
  && effect.amount === 0.08
)));
assert.ok(rareDefense.effects.some((effect) => effect.stat === "defense" && effect.amount === 2));
assert.ok(rareDefense.effects.some((effect) => effect.stat === "shieldStart" && effect.amount === 8));
const rareDefenseHero = {};
applyBlessingEffects(rareDefenseHero, rareDefense);
applyBlessingEffects(rareDefenseHero, rareDefense);
assert.equal(rareDefenseHero.multiEnemyDamageBonus, 0.1, "怒濤反噬群體傷害重複取得不可疊加");
assert.equal(rareDefenseHero.defense, 4, "怒濤反噬防禦應正常疊加");
assert.equal(rareDefenseHero.shieldStart, 16, "怒濤反噬開戰護盾應正常疊加");

const eventIds = [
  "beach-stranded-ship",
  "beach-jelly-pool",
  "beach-storm-watchtower"
];
assert.deepEqual(beach.events.pool, eventIds);
assert.equal(beach.events.scheduleChance, 0.6);
assert.deepEqual(beach.events.triggerBeforeEncounters, [5, 9, 13]);
eventIds.forEach((eventId) => {
  const event = getEventDefinition(eventId);
  assert.ok(event, `${eventId} 應存在`);
  assert.equal(eventDefinitions[eventId], event);
  assert.ok(event.triggerBeforeEncounter > 0);
});

const scheduledEvents = [0.01, 0.34, 0.67].map((eventRoll) => scheduleRegionEvent(
  beach,
  sequenceRandom(0.1, eventRoll)
));
assert.deepEqual(scheduledEvents.map((schedule) => schedule.eventId), eventIds);
assert.deepEqual(scheduledEvents.map((schedule) => schedule.triggerBeforeEncounter), [5, 9, 13]);
assert.equal(shouldTriggerScheduledEvent(scheduledEvents[0], 4), true);
assert.equal(shouldTriggerScheduledEvent(scheduledEvents[0], 5), false);

const selectedGroupOption = getRegionEncounterGroupOption(beach.encounterPlan[9], () => 0.8);
assert.equal(selectedGroupOption.count, 2, "0.8 應抽到海灘雙敵人方案");
const testHero = { encounterBiases: [] };
const groupEntries = buildEnemyGroup(beach, 9, testHero, {
  count: 2,
  statScale: 0.9,
  attackScale: 1.55,
  rewardScale: 0.55
});
const runtimeGroup = createRuntimeEnemyGroup(groupEntries);
assert.equal(runtimeGroup.length, 2);
assert.ok(runtimeGroup.every((enemy) => (
  enemy.statScale === 0.9
  && enemy.attackScale === 1.55
  && enemy.rewardScale === 0.55
)));
assert.ok(runtimeGroup.every((enemy) => enemy.maxHp > 0 && enemy.attack > 0));
assert.ok(runtimeGroup.filter((enemy) => enemy.family === "fishman").length <= 1);

const statusHero = { name: "測試冒險者", hp: 50, maxHp: 100 };
assert.equal(getHeroBattleHealingMultiplier(statusHero), 1);
applySaltErosion(statusHero, silentLog);
assert.equal(statusHero.saltErosion.remainingTurns, 5);
assert.equal(getHeroBattleHealingMultiplier(statusHero), 0.7);
assert.equal(getHeroBattleHealingAmount(statusHero, 20), 14);
statusHero.saltHealingReduction = 0.2;
assert.equal(getHeroBattleHealingMultiplier(statusHero), 0.8);
applySaltErosion(statusHero, silentLog);
assert.equal(statusHero.saltErosion.remainingTurns, 6);
for (let index = 0; index < 6; index += 1) advanceHeroCombatStatuses(statusHero);
assert.equal(statusHero.saltErosion, null);

applyParalysis(statusHero, silentLog);
assert.equal(statusHero.paralysis.remainingTurns, 2);
const originalRandom = Math.random;
Math.random = () => 0.1;
try {
  assert.equal(getHeroAttackDamageMultiplier(statusHero, silentLog), 0.8);
} finally {
  Math.random = originalRandom;
}
advanceHeroCombatStatuses(statusHero);
advanceHeroCombatStatuses(statusHero);
assert.equal(statusHero.paralysis, null);

const dressingHero = {
  name: "測試冒險者",
  hp: 50,
  maxHp: 100,
  activePreparation: createRunPreparation(beach, "freshwater-dressing")
};
applySaltErosion(dressingHero, silentLog);
assert.equal(dressingHero.saltErosion.remainingTurns, 3, "淡水藥布應將首次鹽蝕由 5 回合縮短為 3 回合");
applySaltErosion(dressingHero, silentLog);
assert.equal(dressingHero.saltErosion.remainingTurns, 4, "鹽蝕再次附著仍應只增加 1 回合");

const insulatedHero = {
  name: "測試冒險者",
  hp: 50,
  maxHp: 100,
  activePreparation: createRunPreparation(beach, "insulated-gloves")
};
applyParalysis(insulatedHero, silentLog);
const insulatedOriginalRandom = Math.random;
Math.random = () => 0.1;
try {
  assert.equal(getHeroAttackDamageMultiplier(insulatedHero, silentLog), 1);
  assert.equal(insulatedHero.activePreparation.remainingCharges, 2);
} finally {
  Math.random = insulatedOriginalRandom;
}

console.log("v0.2.7.0.1 海灘資料、整備、事件、敵群與狀態驗證：全部通過");

function sequenceRandom(...values) {
  let index = 0;
  return () => values[index++] ?? 0;
}
