import assert from "node:assert/strict";

import { applyHeroEndOfTurnNegativeEffects } from "../src/core/combat.js";
import {
  assertRegionPreparations,
  createRunPreparation,
  getPreparationSummary,
  resolvePostEncounterPreparation,
  resolvePreparationPoisonDamage
} from "../src/core/preparations.js";
import { forestRegion } from "../src/data/regions/forest.js";
import { plainsRegion } from "../src/data/regions/plains.js";

assert.equal(assertRegionPreparations(plainsRegion), true);
assert.equal(assertRegionPreparations(forestRegion), true);
assert.equal(plainsRegion.preparations[0].id, "simple-bandage");
assert.equal(forestRegion.preparations[0].id, "insect-repellent-powder");

{
  const preparation = createRunPreparation(plainsRegion, "simple-bandage");
  const hero = { hp: 60, maxHp: 100 };
  assert.deepEqual(resolvePostEncounterPreparation({ preparation, hero }), { triggered: false, healing: 0 });
  assert.equal(preparation.remainingCharges, 1);

  hero.hp = 59;
  assert.deepEqual(resolvePostEncounterPreparation({ preparation, hero }), { triggered: true, healing: 6 });
  assert.equal(hero.hp, 65);
  assert.equal(preparation.remainingCharges, 0);
  assert.equal(preparation.triggerCount, 1);
  assert.equal(preparation.healing, 6);

  hero.hp = 20;
  assert.deepEqual(resolvePostEncounterPreparation({ preparation, hero }), { triggered: false, healing: 0 });
  assert.equal(hero.hp, 20);
}

{
  const preparation = createRunPreparation(plainsRegion, "simple-bandage");
  const hero = { hp: 50, maxHp: 100 };
  hero.hp = Math.min(hero.maxHp, hero.hp + 10); // 模擬既有冒險者步調先結算。
  assert.deepEqual(resolvePostEncounterPreparation({ preparation, hero }), { triggered: false, healing: 0 });
  assert.equal(hero.hp, 60, "既有 victory skill 拉回門檻後，整備不應再搶著發動");
  assert.equal(preparation.remainingCharges, 1);
}

{
  const firstRun = createRunPreparation(plainsRegion, "simple-bandage");
  firstRun.remainingCharges = 0;
  const nextRun = createRunPreparation(plainsRegion, "simple-bandage");
  assert.equal(nextRun.remainingCharges, 1, "新 Run 必須由 definition 重新初始化 charges");
}

{
  const preparation = createRunPreparation(plainsRegion, "simple-bandage");
  const hero = { hp: 99, maxHp: 100 };
  preparation.effect.hpThresholdRatio = 1;
  const result = resolvePostEncounterPreparation({ preparation, hero });
  assert.equal(result.healing, 1);
  assert.equal(hero.hp, 100);
}

{
  const preparation = createRunPreparation(forestRegion, "insect-repellent-powder");
  const tiny = resolvePreparationPoisonDamage({ preparation, damage: 1 });
  assert.deepEqual(tiny, { triggered: false, damage: 1, preventedDamage: 0 });
  assert.equal(preparation.remainingCharges, 4);

  for (let index = 0; index < 4; index += 1) {
    const result = resolvePreparationPoisonDamage({ preparation, damage: 8 });
    assert.deepEqual(result, { triggered: true, damage: 6, preventedDamage: 2 });
  }
  assert.equal(preparation.remainingCharges, 0);
  assert.equal(preparation.triggerCount, 4);
  assert.equal(preparation.damagePrevented, 8);
  assert.deepEqual(resolvePreparationPoisonDamage({ preparation, damage: 8 }), {
    triggered: false,
    damage: 8,
    preventedDamage: 0
  });
  assert.deepEqual(getPreparationSummary(preparation), {
    id: "insect-repellent-powder",
    name: "驅蟲藥粉",
    triggerCount: 4,
    healing: 0,
    damagePrevented: 8
  });
}

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

assert.throws(() => createRunPreparation(plainsRegion, "missing"), /不屬於地區/);
assert.throws(() => assertRegionPreparations({
  id: "broken",
  preparations: [{ id: "x", cost: 1, effect: { type: "unknown", charges: 1 } }]
}), /未知 effect.type/);
assert.throws(() => assertRegionPreparations({
  id: "broken",
  preparations: [
    { id: "x", cost: 1, effect: { type: "postEncounterLowHpHeal", hpThresholdRatio: 0.6, healMaxHpRatio: 0.06, charges: 1 } },
    { id: "x", cost: 1, effect: { type: "postEncounterLowHpHeal", hpThresholdRatio: 0.6, healMaxHpRatio: 0.06, charges: 1 } }
  ]
}), /重複 preparation id/);

console.log("Preparation and poison modifier isolation tests passed.");
