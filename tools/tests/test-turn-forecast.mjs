import assert from "node:assert/strict";

import {
  applyEnemyEndOfTurnNegativeEffects,
  applyEnemyEndOfTurnRecoveryEffects,
  applyHeroEndOfTurnNegativeEffects,
  applyHeroEndOfTurnRecoveryEffects,
  describeTurnForecast,
  getEnemyTurnForecast,
  getHeroTurnForecast
} from "../../src/core/combat.js";
import { resolvePreparationPoisonDamage } from "../../src/core/preparationEffects.js";
import { groupHeldBlessings, summarizeBlessingTotals } from "../../src/ui/blessingInfoView.js";
import { getEnemyCrest } from "../../src/ui/enemyRosterView.js";

const log = { fixed() {}, template() {} };
const clone = (value) => JSON.parse(JSON.stringify(value));

// 預計值必須等於實際回合結束的結果：逐一比對多種狀態組合。
function actualHeroEnd(hero, completedTurn) {
  const h = clone(hero);
  applyHeroEndOfTurnNegativeEffects({
    hero: h, log,
    modifyPoisonDamage: ({ damage }) => resolvePreparationPoisonDamage({ preparation: h.activePreparation, damage }).damage
  });
  applyHeroEndOfTurnRecoveryEffects({ hero: h, turn: completedTurn + 1, log });
  return h.hp;
}

const baseHero = { name: "測試", hp: 60, maxHp: 100, poison: 0, damageReduction: 0, regenEvery: 0, regenAmount: 0 };
const poisonPreparation = () => ({ name: "解毒", effect: { type: "poisonDamageReduction", reductionRatio: 0.5 }, remainingCharges: 1, triggerCount: 0, damagePrevented: 0 });
const heroCases = [
  { label: "無狀態", hero: {} },
  { label: "中毒", hero: { poison: 5 } },
  { label: "中毒＋苦味藥草減半", hero: { poison: 5, damageReduction: 0.5 } },
  { label: "中毒＋整備減毒", hero: { poison: 6, activePreparation: poisonPreparation() } },
  { label: "整備次數用完", hero: { poison: 6, activePreparation: { ...poisonPreparation(), remainingCharges: 0 } } },
  { label: "中毒致死不回復", hero: { hp: 3, poison: 5, regenEvery: 1, regenAmount: 9 } },
  { label: "基礎回復輪到", hero: { regenEvery: 3, regenAmount: 5 } },
  { label: "週期回復＋中毒", hero: { poison: 4, periodicRegens: [{ id: "a", everyTurns: 3, amount: 5 }, { id: "b", everyTurns: 1, amount: 2 }] } },
  { label: "回復不超過上限", hero: { hp: 98, regenEvery: 1, regenAmount: 9 } },
  { label: "鹽蝕降低回復", hero: { regenEvery: 1, regenAmount: 10, saltErosion: { remainingTurns: 2 } } },
  { label: "限時回復", hero: { timedRegens: [{ id: "t", remainingEncounters: 1, everyTurns: 2, maxHpRatio: 0.05, source: "營火" }] } }
];
for (const { label, hero } of heroCases) {
  for (const completedTurn of [0, 1, 2, 5]) {
    const state = { ...baseHero, ...hero };
    const forecast = getHeroTurnForecast(clone(state), completedTurn);
    assert.equal(forecast.hpAfter, actualHeroEnd(state, completedTurn), `${label}（已完成 ${completedTurn} 回合）`);
    assert.equal(state.hp - forecast.loss + forecast.gain, forecast.hpAfter, `${label}：loss／gain 與 hpAfter 一致`);
  }
}

// 預覽不可消耗整備次數。
{
  const preparation = poisonPreparation();
  getHeroTurnForecast({ ...baseHero, poison: 6, activePreparation: preparation }, 0);
  assert.equal(preparation.remainingCharges, 1);
}

// 敵人：中毒要先扣前衛保護，回復輪到才算。
function actualEnemyEnd(enemy, enemies, completedTurn) {
  const copies = clone(enemies);
  const target = copies.find(e => e.runtimeId === enemy.runtimeId);
  applyEnemyEndOfTurnNegativeEffects({ enemy: target, enemies: copies, log });
  applyEnemyEndOfTurnRecoveryEffects({ enemy: target, turn: completedTurn + 1, log });
  return target.hp;
}
{
  const front = { runtimeId: "f", name: "前衛", hp: 50, maxHp: 50, combatRole: "frontline", formationId: "g" };
  const rear = { runtimeId: "r", name: "後排", hp: 40, maxHp: 60, poison: 10, combatRole: "support", formationId: "g" };
  const slime = { runtimeId: "s", name: "變異史萊姆", hp: 30, maxHp: 68, poison: 2, regenEvery: 3, regenAmount: 6 };
  for (const completedTurn of [0, 1, 2]) {
    for (const [enemy, enemies] of [[rear, [front, rear]], [rear, [rear]], [slime, [slime]]]) {
      const forecast = getEnemyTurnForecast(enemy, enemies, completedTurn);
      assert.equal(forecast.hpAfter, actualEnemyEnd(enemy, enemies, completedTurn), `${enemy.name}（已完成 ${completedTurn} 回合）`);
    }
  }
  assert.equal(getEnemyTurnForecast(rear, [front, rear], 0).loss, 7, "受保護時中毒 10 點只扣 7 點");
  assert.equal(getEnemyTurnForecast(slime, [slime], 2).gain, 6);
}

assert.equal(describeTurnForecast({ loss: 0, gain: 0, hpAfter: 50 }), "");
assert.equal(describeTurnForecast({ loss: 3, gain: 5, hpAfter: 52 }), "回合結束：中毒 -3、回復 +5 → 52");

// 本局祝福：固定加成合計與同名合併。
{
  const blessings = [
    { name: "石刃打磨", effects: [{ type: "add", stat: "attack", amount: 1 }] },
    { name: "石刃打磨", effects: [{ type: "add", stat: "attack", amount: 1 }] },
    { name: "精準攻勢", effects: [{ type: "add", stat: "critChance", amount: 0.08 }] },
    { name: "野草繃帶", effects: [{ type: "addPeriodicRegen", everyTurns: 3, amount: 5 }] }
  ];
  assert.deepEqual(summarizeBlessingTotals(blessings), ["攻擊 +2", "暴擊率 +8%"]);
  assert.deepEqual(groupHeldBlessings(blessings).map(g => [g.blessing.name, g.count]), [["石刃打磨", 2], ["精準攻勢", 1], ["野草繃帶", 1]]);
  assert.deepEqual(summarizeBlessingTotals([]), []);
}

// 紋章：資料指定 > 名稱結尾的動物字 > 族群字。
assert.equal(getEnemyCrest({ name: "巨大野豬", family: "beast" }), "豬");
assert.equal(getEnemyCrest({ name: "史萊姆", family: "slime" }), "黏");
assert.equal(getEnemyCrest({ name: "魚人斥候", family: "fishman" }), "鱗");
assert.equal(getEnemyCrest({ name: "魔化野豬王", family: "beast", crest: "魔" }), "魔");

console.log("turn forecast, blessing totals, crest: ok");
