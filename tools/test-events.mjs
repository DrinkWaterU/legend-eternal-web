import assert from "node:assert/strict";

import { applyBlessingEffects, inferBlessingFlows } from "../src/core/blessings.js";
import { buildScaledEnemy, resolveHeroAction } from "../src/core/combat.js";
import {
  applyEventEffects,
  appendRunEventRecord,
  createEventContext,
  getAvailableFollowUpChoices,
  hasRunEventResults,
  scheduleRegionEvent,
  shouldTriggerScheduledEvent,
  validateEventTarget
} from "../src/core/events.js";
import { migrateSave } from "../src/core/storage.js";
import { getBlessingPool, goblinBlessings } from "../src/data/blessings/index.js";
import { isBlessingFlowId } from "../src/data/blessingFlows.js";
import { eventDefinitions, getEventDefinition, getEventEnemyDefinition } from "../src/data/events/index.js";
import { forestRegion } from "../src/data/regions/forest.js";
import { regionDefinitions } from "../src/data/regions/index.js";
import adventurerData from "../src/data/characters/adventurer.json" with { type: "json" };

function sequenceRandom(values) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

const campfire = getEventDefinition("forest-campfire");
assert.ok(campfire, "forest-campfire 應存在於事件 registry");
assert.equal(campfire.choices.length, 3, "林間營火應有三個正式選項");
assert.ok(getEventEnemyDefinition("goblin-warrior"), "哥布林戰士應存在於事件敵人 registry");
assert.deepEqual(createEventContext("forest-campfire"), {
  eventId: "forest-campfire",
  choiceId: null,
  battleIndex: 0
});

Object.values(regionDefinitions).forEach((region) => {
  const config = region.events;
  if (!config) return;

  assert.ok(Number(config.scheduleChance) >= 0 && Number(config.scheduleChance) <= 1, `${region.id} 事件機率必須介於 0 到 1`);
  assert.ok(Array.isArray(config.triggerBeforeEncounters) && config.triggerBeforeEncounters.length > 0, `${region.id} 事件觸發場次不可為空`);
  config.triggerBeforeEncounters.forEach((encounterNumber) => {
    assert.ok(Number.isInteger(encounterNumber) && encounterNumber >= 1 && encounterNumber <= region.encounterCount, `${region.id} 事件觸發場次超出主線範圍：${encounterNumber}`);
  });
  assert.ok(Array.isArray(config.pool) && config.pool.length > 0, `${region.id} 事件 pool 不可為空`);
  config.pool.forEach((eventId) => {
    assert.ok(getEventDefinition(eventId), `${region.id} 事件 pool 找不到 definition：${eventId}`);
  });
});

Object.values(eventDefinitions).forEach((event) => {
  assert.ok(Array.isArray(event.choices) && event.choices.length > 0, `${event.id} 至少需要一個選項`);
  const choiceIds = event.choices.map((choice) => choice.id);
  assert.equal(new Set(choiceIds).size, choiceIds.length, `${event.id} choice id 不可重複`);

  event.choices.forEach((choice) => {
    (choice.battleSequence || []).forEach((battle) => {
      assert.ok(getEventEnemyDefinition(battle.enemyId), `${event.id}/${choice.id} 找不到事件敵人：${battle.enemyId}`);
    });

    const result = choice.result || {};
    assert.doesNotThrow(() => validateEventTarget(result.defaultTarget), `${event.id}/${choice.id} defaultTarget 必須有效`);
    (result.effects || []).forEach((effect) => {
      if (effect.type !== "grantBlessing") return;
      const pool = getBlessingPool(effect.poolId);
      assert.ok(pool, `${event.id}/${choice.id} 找不到 Blessing Pool：${effect.poolId}`);
      assert.ok(pool.blessings.some((blessing) => blessing.rarity === effect.rarity), `${event.id}/${choice.id} Blessing Pool 沒有 ${effect.rarity} 候選`);
    });
  });
});

const scheduled = scheduleRegionEvent(forestRegion, sequenceRandom([0.29, 0, 0]));
assert.deepEqual(scheduled, {
  eventId: "forest-campfire",
  triggerBeforeEncounter: 6
});
assert.equal(scheduleRegionEvent(forestRegion, sequenceRandom([0.3])), null, "30% 邊界不應被重複解讀");
assert.equal(shouldTriggerScheduledEvent(scheduled, 5), true, "encounterIndex 5 應代表第 6 場前");
assert.equal(shouldTriggerScheduledEvent(scheduled, 4), false);
assert.equal(shouldTriggerScheduledEvent(scheduled, 6), false);

const records = [];
appendRunEventRecord(records, {
  eventId: "forest-campfire",
  choiceId: "attack-goblins",
  resultIds: ["campfire-goblins-defeated", "goblin-trail-discovered", "goblin-trail-discovered"]
});
appendRunEventRecord(records, {
  eventId: "other-event",
  choiceId: "leave",
  resultIds: []
});
assert.equal(records.length, 2, "事件紀錄應依完成順序追加");
assert.deepEqual(records[0].resultIds, ["campfire-goblins-defeated", "goblin-trail-discovered"]);
assert.equal(hasRunEventResults(records, ["goblin-trail-discovered"]), true);
assert.equal(hasRunEventResults(records, ["goblin-trail-discovered", "missing-result"]), false, "requiresResults 應採 all-of");

const conditionalResult = {
  followUpChoices: [
    { id: "follow", requiresResults: ["goblin-trail-discovered"] },
    { id: "locked", requiresResults: ["missing-result"] },
    { id: "leave", target: { type: "returnAdventure" } }
  ]
};
assert.deepEqual(
  getAvailableFollowUpChoices(conditionalResult, records).map((choice) => choice.id),
  ["follow", "leave"]
);
assert.doesNotThrow(() => validateEventTarget({ type: "returnAdventure" }));
assert.throws(() => validateEventTarget({ type: "rotue", id: "goblin-camp" }), /尚未支援/);

const effectHero = { hp: 40, maxHp: 100 };
let blessingCallbackCount = 0;
let materialCallbackCount = 0;
const effectRun = applyEventEffects({
  hero: effectHero,
  effects: [
    { type: "recoverHp", amount: 80 },
    { type: "loseHp", amount: 25 },
    { type: "grantMaterials", materials: [{ id: "x", quantity: 1 }] },
    { type: "grantBlessing", poolId: "goblin", rarity: "common" }
  ],
  grantMaterials: () => { materialCallbackCount += 1; return { materials: {} }; },
  grantBlessing: () => { blessingCallbackCount += 1; return { name: "測試祝福" }; }
});
assert.equal(effectHero.hp, 75, "回血應受 maxHp 上限限制，扣血應套用於正式 hero HP");
assert.equal(effectRun.heroDefeated, false);
assert.equal(materialCallbackCount, 1);
assert.equal(blessingCallbackCount, 1);
const fatalHero = { hp: 10, maxHp: 100 };
const fatalEffect = applyEventEffects({ hero: fatalHero, effects: [{ type: "loseHp", amount: 10 }] });
assert.equal(fatalEffect.heroDefeated, true, "事件扣血到 0 應回報正式死亡邊界");

assert.equal(goblinBlessings.length, 6, "第一批哥布林 Blessing 應為 6 個");
assert.equal(goblinBlessings.filter((item) => item.rarity === "common").length, 3);
assert.equal(goblinBlessings.filter((item) => item.rarity === "uncommon").length, 3);
goblinBlessings.forEach((blessing) => {
  assert.ok(isBlessingFlowId(blessing.primaryFlow), `${blessing.id} primaryFlow 必須有效`);
  assert.ok(inferBlessingFlows(blessing).length > 0, `${blessing.id} 應可推斷實際 Flow`);
});
assert.ok(inferBlessingFlows(goblinBlessings.find((item) => item.id === "knife-in-the-back")).includes("crit"));
assert.ok(inferBlessingFlows(goblinBlessings.find((item) => item.id === "pick-the-wound")).includes("crit"));

const testHero = { defense: 4, blessings: [], blessingFlows: [], blessingFlowMomentum: {} };
applyBlessingEffects(testHero, goblinBlessings.find((item) => item.id === "reckless-gamble"));
assert.equal(testHero.attack, 4, "add effect 應能從未定義 attack 安全加值");
assert.equal(testHero.defense, 2, "鋌而走險應套用防禦 -2");

const scaledGoblin = buildScaledEnemy(getEventEnemyDefinition("goblin-warrior"), forestRegion, 6);
assert.equal(scaledGoblin.maxHp, 184);
assert.equal(scaledGoblin.attack, 28);
assert.equal(scaledGoblin.defense, 5);

const logger = { template() {}, fixed() {} };
const originalRandom = Math.random;
try {
  Math.random = () => 0.5;
  const openingHero = {
    name: "測試者", attack: 10, critChance: 0, critDamageMultiplier: 2,
    openingCritChance: 1, woundedTargetCritChance: 0, hasAttackedThisBattle: false,
    skills: [], familyDamageBonus: {}, poisonPower: 0
  };
  const openingEnemy = { name: "木樁", family: "test", hp: 100, maxHp: 100, defense: 0, dodgeChance: 0, poison: 0 };
  resolveHeroAction({ hero: openingHero, enemy: openingEnemy, log: logger });
  assert.equal(openingEnemy.hp, 80, "第一次實際攻擊應套用 openingCritChance");
  openingEnemy.hp = 100;
  resolveHeroAction({ hero: openingHero, enemy: openingEnemy, log: logger });
  assert.equal(openingEnemy.hp, 90, "第二次攻擊不應再次套用 openingCritChance");

  const woundedHero = {
    name: "測試者", attack: 10, critChance: 0, critDamageMultiplier: 2,
    openingCritChance: 0, woundedTargetCritChance: 1, hasAttackedThisBattle: true,
    skills: [], familyDamageBonus: {}, poisonPower: 0
  };
  const woundedEnemy = { name: "木樁", family: "test", hp: 49, maxHp: 100, defense: 0, dodgeChance: 0, poison: 0 };
  resolveHeroAction({ hero: woundedHero, enemy: woundedEnemy, log: logger });
  assert.equal(woundedEnemy.hp, 29, "低於 50% 應套用 woundedTargetCritChance");
  const halfEnemy = { name: "木樁", family: "test", hp: 50, maxHp: 100, defense: 0, dodgeChance: 0, poison: 0 };
  resolveHeroAction({ hero: woundedHero, enemy: halfEnemy, log: logger });
  assert.equal(halfEnemy.hp, 40, "剛好 50% 不應套用 woundedTargetCritChance");

  const dodgeHero = {
    name: "測試者", attack: 10, critChance: 0, critDamageMultiplier: 2,
    openingCritChance: 1, woundedTargetCritChance: 0, hasAttackedThisBattle: false,
    skills: [], familyDamageBonus: {}, poisonPower: 0
  };
  const dodgeEnemy = { name: "木樁", family: "test", hp: 100, maxHp: 100, defense: 0, dodgeChance: 1, poison: 0 };
  resolveHeroAction({ hero: dodgeHero, enemy: dodgeEnemy, log: logger });
  assert.equal(dodgeHero.hasAttackedThisBattle, true, "攻擊被閃避仍應消耗 opening 攻擊");
  dodgeEnemy.dodgeChance = 0;
  resolveHeroAction({ hero: dodgeHero, enemy: dodgeEnemy, log: logger });
  assert.equal(dodgeEnemy.hp, 90, "被閃避後下一擊不應再取得 opening 暴擊加成");
} finally {
  Math.random = originalRandom;
}

const expeditionPace = adventurerData.skills.find((skill) => skill.id === "expedition-pace");
assert.equal(expeditionPace.targetSkillId, "adventurer-pace", "遠征步調應標記為冒險者步調強化");

const migrated = migrateSave({
  schemaVersion: 5,
  storyFlags: {
    phoenixBlessingUnlocked: true,
    plainsBossStorySeen: false,
    achievementSystemUnlocked: false
  }
});
assert.equal(migrated.storyFlags.plainsBossStorySeen, true, "鳳凰已解鎖應補正平原劇情旗標");
assert.equal(migrated.storyFlags.achievementSystemUnlocked, true, "鳳凰已解鎖應補正成就系統旗標");

console.log("事件系統隔離驗證：全部通過");
