import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { applyHeroEndOfTurnNegativeEffects, resolveHeroEntangle } from "../src/core/combat.js";
import {
  assertRegionPreparations,
  beginPreparationBattle,
  consumePreparationEntangleRetry,
  createRunPreparation,
  getPreparationCombatStatus,
  getPreparationSummary,
  recordPreparationEntangleRetryResult,
  resolvePostEncounterPreparation,
  resolvePreparationIncomingDirectDamage,
  resolvePreparationPoisonDamage,
  runPreparationOpeningAction
} from "../src/core/preparations.js";
import { forestRegion } from "../src/data/regions/forest.js";
import { plainsRegion } from "../src/data/regions/plains.js";

assert.equal(assertRegionPreparations(plainsRegion), true);
assert.equal(assertRegionPreparations(forestRegion), true);
for (const region of [plainsRegion, forestRegion]) {
  region.preparations.forEach((preparation) => {
    assert.ok(preparation.summary.trim(), `${preparation.id} 應提供玩家短文案 summary`);
    assert.equal("summary" in createRunPreparation(region, preparation.id), false, "Run Preparation 不應保存 UI summary");
  });
}
assert.deepEqual(plainsRegion.preparations.map((entry) => entry.id), [
  "simple-bandage",
  "beast-repellent-herb",
  "weapon-maintenance"
]);
assert.deepEqual(forestRegion.preparations.map((entry) => entry.id), [
  "insect-repellent-powder",
  "forest-bandage",
  "web-cutting-knife"
]);

// 簡易繃帶：80% 門檻、角色勝利效果優先、最終戰不觸發。
{
  const preparation = createRunPreparation(plainsRegion, "simple-bandage");
  const hero = { hp: 80, maxHp: 100 };
  assert.deepEqual(resolvePostEncounterPreparation({ preparation, hero }), { triggered: false, healing: 0 });
  assert.equal(preparation.remainingCharges, 1);

  hero.hp = 79;
  assert.deepEqual(resolvePostEncounterPreparation({ preparation, hero }), { triggered: true, healing: 6 });
  assert.equal(hero.hp, 85);
  assert.equal(preparation.remainingCharges, 0);
  assert.equal(preparation.triggerCount, 1);
  assert.equal(preparation.healing, 6);

  hero.hp = 20;
  assert.deepEqual(resolvePostEncounterPreparation({ preparation, hero }), { triggered: false, healing: 0 });
  assert.equal(hero.hp, 20);
}

{
  const preparation = createRunPreparation(plainsRegion, "simple-bandage");
  const hero = { hp: 70, maxHp: 100 };
  hero.hp = Math.min(hero.maxHp, hero.hp + 10); // 模擬既有冒險者步調先結算。
  assert.deepEqual(resolvePostEncounterPreparation({ preparation, hero }), { triggered: false, healing: 0 });
  assert.equal(hero.hp, 80, "既有 victory skill 拉回門檻後，整備不應再搶著發動");
  assert.equal(preparation.remainingCharges, 1);
}

{
  const preparation = createRunPreparation(plainsRegion, "simple-bandage");
  const hero = { hp: 30, maxHp: 100 };
  assert.deepEqual(resolvePostEncounterPreparation({ preparation, hero, isFinalEncounter: true }), {
    triggered: false,
    healing: 0
  });
  assert.equal(preparation.remainingCharges, 1, "最終戰後不可消耗簡易繃帶");
}

{
  const firstRun = createRunPreparation(plainsRegion, "simple-bandage");
  firstRun.remainingCharges = 0;
  const nextRun = createRunPreparation(plainsRegion, "simple-bandage");
  assert.equal(nextRun.remainingCharges, 1, "新 Run 必須由 definition 重新初始化 charges");
}

// 驅獸香草：每場一次、角色 modifier 後再處理、實際無減傷不消耗本場資格。
{
  const preparation = createRunPreparation(plainsRegion, "beast-repellent-herb");
  assert.equal("remainingCharges" in preparation, false, "每場型效果不應建立假的 remainingCharges");
  const beast = { family: "beast", hp: 10 };
  const slime = { family: "slime", hp: 10 };

  beginPreparationBattle(preparation);
  assert.deepEqual(resolvePreparationIncomingDirectDamage({ preparation, enemy: slime, damage: 10 }), {
    triggered: false,
    damage: 10,
    preventedDamage: 0
  });
  assert.equal(preparation.usedThisBattle, false);

  assert.deepEqual(resolvePreparationIncomingDirectDamage({ preparation, enemy: beast, damage: 1 }), {
    triggered: false,
    damage: 1,
    preventedDamage: 0
  });
  assert.equal(preparation.usedThisBattle, false, "1 → 1 時不可標記本場已使用");

  // 模擬角色 modifier 已先把 20 傷害降為 10，整備只能再處理這個 10。
  assert.deepEqual(resolvePreparationIncomingDirectDamage({ preparation, enemy: beast, damage: 10 }), {
    triggered: true,
    damage: 8,
    preventedDamage: 2
  });
  assert.equal(preparation.usedThisBattle, true);
  assert.equal(preparation.triggerCount, 1);
  assert.equal(preparation.damagePrevented, 2);

  assert.deepEqual(resolvePreparationIncomingDirectDamage({ preparation, enemy: beast, damage: 30 }), {
    triggered: false,
    damage: 30,
    preventedDamage: 0
  }, "同場第二隻或後續野獸傷害不可再次發動");

  beginPreparationBattle(preparation);
  assert.equal(preparation.usedThisBattle, false, "新 Battle Session 必須恢復本場資格");
  assert.equal(preparation.triggerCount, 1, "Battle lifecycle 不可清除 run-level contribution");
}

// 武器保養：只有強敵戰第一次實際出手，暫時 bonus 必須 finally 還原。
{
  const preparation = createRunPreparation(plainsRegion, "weapon-maintenance");
  const hero = { battleAttackBonus: 3 };
  assert.equal("remainingCharges" in preparation, false, "每場型效果不應建立假的 remainingCharges");

  let observedBonus = null;
  runPreparationOpeningAction({
    preparation,
    hero,
    encounterType: "normal",
    action: () => {
      observedBonus = hero.battleAttackBonus;
      return "normal";
    }
  });
  assert.equal(observedBonus, 3);
  assert.equal(preparation.triggerCount, 0);
  assert.equal(preparation.usedThisBattle, false);

  beginPreparationBattle(preparation);
  const result = runPreparationOpeningAction({
    preparation,
    hero,
    encounterType: "elite",
    action: () => {
      observedBonus = hero.battleAttackBonus;
      return "handled-action";
    }
  });
  assert.equal(result.triggered, true);
  assert.equal(result.attackBonus, 2);
  assert.equal(result.result, "handled-action");
  assert.equal(observedBonus, 5);
  assert.equal(hero.battleAttackBonus, 3, "角色出手後必須還原原本 battleAttackBonus");
  assert.equal(preparation.triggerCount, 1);

  observedBonus = null;
  runPreparationOpeningAction({
    preparation,
    hero,
    encounterType: "elite",
    action: () => {
      observedBonus = hero.battleAttackBonus;
    }
  });
  assert.equal(observedBonus, 3, "同場第二次出手不可再次取得 +2");
  assert.equal(preparation.triggerCount, 1);

  beginPreparationBattle(preparation);
  assert.throws(() => runPreparationOpeningAction({
    preparation,
    hero,
    encounterType: "boss",
    action: () => {
      assert.equal(hero.battleAttackBonus, 5);
      throw new Error("action failed");
    }
  }), /action failed/);
  assert.equal(hero.battleAttackBonus, 3, "Action 例外後暫時 attack bonus 仍必須還原");

  beginPreparationBattle(preparation);
  assert.throws(() => runPreparationOpeningAction({
    preparation,
    hero,
    encounterType: "elite",
    onTrigger: () => {
      throw new Error("log failed");
    },
    action() {}
  }), /log failed/);
  assert.equal(hero.battleAttackBonus, 3, "Trigger callback 例外後暫時 attack bonus 仍必須還原");
}

// 驅蟲藥粉：6 次有效毒傷減免，第 7 次回到正式傷害。
{
  const preparation = createRunPreparation(forestRegion, "insect-repellent-powder");
  const tiny = resolvePreparationPoisonDamage({ preparation, damage: 1 });
  assert.deepEqual(tiny, { triggered: false, damage: 1, preventedDamage: 0 });
  assert.equal(preparation.remainingCharges, 6);

  for (let index = 0; index < 6; index += 1) {
    const result = resolvePreparationPoisonDamage({ preparation, damage: 8 });
    assert.deepEqual(result, { triggered: true, damage: 6, preventedDamage: 2 });
  }
  assert.equal(preparation.remainingCharges, 0);
  assert.equal(preparation.triggerCount, 6);
  assert.equal(preparation.damagePrevented, 12);
  assert.deepEqual(resolvePreparationPoisonDamage({ preparation, damage: 8 }), {
    triggered: false,
    damage: 8,
    preventedDamage: 0
  });
  assert.deepEqual(getPreparationSummary(preparation), {
    id: "insect-repellent-powder",
    name: "驅蟲藥粉",
    triggerCount: 6,
    damagePrevented: 12
  });
}

// 林地繃帶：第 5 / 10 次正式勝利里程碑；滿血時機會仍消耗且不延後補發。
{
  const preparation = createRunPreparation(forestRegion, "forest-bandage");
  const hero = { hp: 70, maxHp: 100 };
  assert.equal(preparation.formalVictoryCount, 0);
  assert.equal(preparation.remainingCharges, 2);

  for (let index = 1; index <= 4; index += 1) {
    assert.deepEqual(resolvePostEncounterPreparation({ preparation, hero }), { triggered: false, healing: 0 });
    assert.equal(preparation.formalVictoryCount, index);
  }
  assert.deepEqual(resolvePostEncounterPreparation({ preparation, hero }), { triggered: true, healing: 3 });
  assert.equal(hero.hp, 73);
  assert.equal(preparation.formalVictoryCount, 5);
  assert.equal(preparation.remainingCharges, 1);
  assert.equal(preparation.triggerCount, 1);
  assert.equal(preparation.healing, 3);

  for (let index = 6; index <= 9; index += 1) {
    assert.deepEqual(resolvePostEncounterPreparation({ preparation, hero }), { triggered: false, healing: 0 });
    assert.equal(preparation.formalVictoryCount, index);
  }
  hero.hp = 100;
  assert.deepEqual(resolvePostEncounterPreparation({ preparation, hero }), { triggered: false, healing: 0 });
  assert.equal(preparation.formalVictoryCount, 10);
  assert.equal(preparation.remainingCharges, 0, "滿血里程碑仍必須消耗該次包紮時機");
  assert.equal(preparation.triggerCount, 1);

  hero.hp = 50;
  assert.deepEqual(resolvePostEncounterPreparation({ preparation, hero }), { triggered: false, healing: 0 });
  assert.equal(hero.hp, 50, "第 10 次滿血錯過後，第 11 次不可補發");
  assert.equal(preparation.formalVictoryCount, 11);
}

// 割網短刀：正式失敗後同 chance 重試；成功不增加 attempts，失敗只增加一次。
{
  const preparation = createRunPreparation(forestRegion, "web-cutting-knife");
  const entries = [];
  const log = {
    template: (type, templateId, values) => entries.push({ type, templateId, values }),
    fixed: () => {}
  };

  // 第一次正式檢定直接成功：不消耗短刀。
  const heroSuccess = { name: "測試者", entangle: { attempts: 0 } };
  withRandomSequence([0.1], () => {
    assert.equal(resolveHeroEntangle({
      hero: heroSuccess,
      log,
      retryOnFailure: () => consumePreparationEntangleRetry(preparation)
    }), false);
  });
  assert.equal(heroSuccess.entangle, null);
  assert.equal(preparation.remainingCharges, 2);

  // 第一次失敗，短刀重試成功。
  const heroRetrySuccess = { name: "測試者", entangle: { attempts: 0 } };
  withRandomSequence([0.9, 0.1], () => {
    assert.equal(resolveHeroEntangle({
      hero: heroRetrySuccess,
      log,
      retryOnFailure: () => consumePreparationEntangleRetry(preparation),
      onRetryResult: ({ success }) => recordPreparationEntangleRetryResult({ preparation, success })
    }), false);
  });
  assert.equal(heroRetrySuccess.entangle, null);
  assert.equal(preparation.remainingCharges, 1);
  assert.equal(preparation.triggerCount, 1);
  assert.equal(preparation.retrySuccessCount, 1);

  // 第一次失敗，重試也失敗：正式 attempts 只增加一次。
  const heroRetryFailure = { name: "測試者", entangle: { attempts: 0 } };
  withRandomSequence([0.9, 0.9], () => {
    assert.equal(resolveHeroEntangle({
      hero: heroRetryFailure,
      log,
      retryOnFailure: () => consumePreparationEntangleRetry(preparation),
      onRetryResult: ({ success }) => recordPreparationEntangleRetryResult({ preparation, success })
    }), true);
  });
  assert.equal(heroRetryFailure.entangle.attempts, 1);
  assert.equal(preparation.remainingCharges, 0);
  assert.equal(preparation.triggerCount, 2);
  assert.equal(preparation.retrySuccessCount, 1);

  // 第三次失敗不再多 roll 一次。
  const heroNoCharges = { name: "測試者", entangle: { attempts: 0 } };
  let randomCalls = 0;
  const originalRandom = Math.random;
  Math.random = () => {
    randomCalls += 1;
    return 0.9;
  };
  try {
    assert.equal(resolveHeroEntangle({
      hero: heroNoCharges,
      log,
      retryOnFailure: () => consumePreparationEntangleRetry(preparation)
    }), true);
  } finally {
    Math.random = originalRandom;
  }
  assert.equal(randomCalls, 1, "短刀耗盡後不得進行額外 retry roll");
  assert.equal(heroNoCharges.entangle.attempts, 1);
  assert.deepEqual(getPreparationSummary(preparation), {
    id: "web-cutting-knife",
    name: "割網短刀",
    triggerCount: 2,
    retrySuccessCount: 1
  });
}

// 沒有新 callback 時，既有毒傷與纏繞行為維持原值。
{
  const hero = { name: "測試者", hp: 50, maxHp: 50, poison: 8, damageReduction: 0 };
  const entries = [];
  const log = {
    template: (type, templateId, values) => entries.push({ type, templateId, values }),
    fixed: () => {}
  };
  applyHeroEndOfTurnNegativeEffects({ hero, log });
  assert.equal(hero.hp, 42, "沒有整備 modifier 時，正式毒傷行為必須維持原值");
  assert.equal(entries.at(-1).values.amount, 8);
}

{
  const preparation = createRunPreparation(forestRegion, "insect-repellent-powder");
  const hero = { name: "測試者", hp: 50, maxHp: 50, poison: 8, damageReduction: 0 };
  const entries = [];
  const log = {
    template: (type, templateId, values) => entries.push({ type, templateId, values }),
    fixed: () => {}
  };
  const result = applyHeroEndOfTurnNegativeEffects({
    hero,
    log,
    modifyPoisonDamage: ({ damage }) => resolvePreparationPoisonDamage({ preparation, damage }).damage
  });
  assert.equal(result.heroDeathCause, null);
  assert.equal(hero.hp, 44);
  assert.equal(entries.at(-1).templateId, "poisonTick");
  assert.equal(entries.at(-1).values.amount, 6);
}

// Combat status 由 Preparation core 解讀，Combat View 不需要知道 effect.type。
{
  assert.equal(getPreparationCombatStatus({ preparation: null }), null);

  const bandage = createRunPreparation(plainsRegion, "simple-bandage");
  assert.deepEqual(getPreparationCombatStatus({ preparation: bandage }), {
    name: "簡易繃帶",
    label: "剩餘 1 次",
    isDepleted: false
  });
  bandage.remainingCharges = 0;
  assert.deepEqual(getPreparationCombatStatus({ preparation: bandage }), {
    name: "簡易繃帶",
    label: "已耗盡",
    isDepleted: true
  });

  const herb = createRunPreparation(plainsRegion, "beast-repellent-herb");
  beginPreparationBattle(herb);
  assert.equal(getPreparationCombatStatus({ preparation: herb, enemies: [{ family: "slime", hp: 10 }] }).label, "等待野獸");
  assert.equal(getPreparationCombatStatus({ preparation: herb, enemies: [{ family: "beast", hp: 10 }] }).label, "本場可用");
  resolvePreparationIncomingDirectDamage({ preparation: herb, enemy: { family: "beast" }, damage: 10 });
  assert.equal(getPreparationCombatStatus({ preparation: herb, enemies: [{ family: "beast", hp: 10 }] }).label, "本場已使用");

  const maintenance = createRunPreparation(plainsRegion, "weapon-maintenance");
  beginPreparationBattle(maintenance);
  assert.equal(getPreparationCombatStatus({ preparation: maintenance, encounterType: "normal" }).label, "等待強敵");
  assert.equal(getPreparationCombatStatus({ preparation: maintenance, encounterType: "elite" }).label, "本場可用");
  runPreparationOpeningAction({ preparation: maintenance, hero: { battleAttackBonus: 0 }, encounterType: "elite", action() {} });
  assert.equal(getPreparationCombatStatus({ preparation: maintenance, encounterType: "elite" }).label, "本場已使用");
}

// Definition contract 必須依 effect.type 驗證，不再強迫所有效果有 charges。
assert.throws(() => createRunPreparation(plainsRegion, "missing"), /不屬於地區/);
assert.throws(() => assertRegionPreparations({
  id: "broken",
  preparations: [{ id: "x", name: "X", summary: "測試", description: "測試", cost: 1, effect: { type: "unknown" } }]
}), /未知 effect.type/);
assert.throws(() => assertRegionPreparations({
  id: "broken",
  preparations: [{ id: "x", name: "X", summary: "測試", description: "", cost: 1, effect: { type: "entangleRetry", charges: 1 } }]
}), /description 無效/);
assert.throws(() => assertRegionPreparations({
  id: "broken",
  preparations: [{ id: "x", name: "X", summary: "", description: "測試", cost: 1, effect: { type: "entangleRetry", charges: 1 } }]
}), /summary 無效/);
assert.throws(() => assertRegionPreparations({
  id: "broken",
  preparations: [
    { id: "x", name: "X", summary: "測試", description: "測試", cost: 1, effect: { type: "postEncounterLowHpHeal", hpThresholdRatio: 0.8, healMaxHpRatio: 0.06, charges: 1 } },
    { id: "x", name: "X2", summary: "測試二", description: "測試二", cost: 1, effect: { type: "postEncounterLowHpHeal", hpThresholdRatio: 0.8, healMaxHpRatio: 0.06, charges: 1 } }
  ]
}), /重複 preparation id/);
assert.throws(() => assertRegionPreparations({
  id: "broken",
  preparations: [{ id: "x", name: "X", summary: "測試", description: "測試", cost: 1, effect: { type: "victoryMilestoneHeal", victoryMilestones: [10, 5], healMaxHpRatio: 0.03 } }]
}), /旅程包紮參數無效/);
assert.throws(() => assertRegionPreparations({
  id: "broken",
  preparations: [{ id: "x", name: "X", summary: "測試", description: "測試", cost: 1, effect: { type: "openingActionAttackBonus", encounterTypes: [], attackBonus: 2 } }]
}), /開局攻擊參數無效/);

const combatSource = await readFile(new URL("../src/core/combat.js", import.meta.url), "utf8");
const preparationSource = await readFile(new URL("../src/core/preparations.js", import.meta.url), "utf8");
assert.doesNotMatch(combatSource, /from ["']\.\/preparations\.js["']/, "Combat core 不得 import preparations.js");
assert.doesNotMatch(preparationSource, /ENTANGLE_ESCAPE_CHANCES|\broll\(/, "Preparation core 不得複製正式纏繞機率或自行 roll");

console.log("Six-preparation runtime, combat modifier, milestone, and retry isolation tests passed.");

function withRandomSequence(values, action) {
  const originalRandom = Math.random;
  let index = 0;
  Math.random = () => {
    if (index >= values.length) {
      throw new Error("測試亂數序列不足。");
    }
    const value = values[index];
    index += 1;
    return value;
  };
  try {
    return action();
  } finally {
    Math.random = originalRandom;
  }
}
