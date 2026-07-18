import assert from "node:assert/strict";

import {
  applyEnemyEndOfTurnNegativeEffects,
  applyEnemyEndOfTurnRecoveryEffects,
  applyHeroEndOfTurnNegativeEffects,
  applyHeroEndOfTurnRecoveryEffects,
  getHeroPendingHpLoss
} from "../src/core/combat.js";
import {
  createRuntimeEnemyGroup,
  getEnemyGroupThreatKind,
  getLivingEnemies,
  resolveTargetEnemy,
  resolveTargetEnemyId,
  restoreRuntimeEnemyGroup
} from "../src/core/enemyGroups.js";
import { rollEnemyRewards } from "../src/core/rewards.js";

function sequenceRandom(values) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

const logger = {
  template() {},
  fixed() {}
};

const baseEnemy = {
  id: "test-goblin",
  name: "測試哥布林",
  kind: "普通",
  hp: 50,
  maxHp: 100,
  attack: 20,
  defense: 5,
  critChance: 0.12,
  poison: 0,
  expReward: 100,
  rewards: {
    gold: 10,
    materials: [
      { id: "test-material", chance: 0.8, min: 2, max: 4 }
    ]
  }
};

const group = createRuntimeEnemyGroup([
  baseEnemy,
  { enemy: baseEnemy, statScale: 0.5 }
]);
assert.equal(group.length, 2);
assert.notEqual(group[0].runtimeId, group[1].runtimeId, "runtimeId 必須唯一");
assert.equal(group[0].displayName, "測試哥布林 A");
assert.equal(group[1].displayName, "測試哥布林 B");
assert.equal(group[1].maxHp, 50, "statScale 應縮放 maxHp");
assert.equal(group[1].hp, 25, "statScale 應保留目前 HP 比例");
assert.equal(group[1].attack, 10, "statScale 應縮放 attack");
assert.equal(group[1].defense, 5, "第一版 statScale 不應縮放 defense");
assert.equal(group[1].critChance, 0.12, "第一版 statScale 不應縮放 critChance");
assert.equal(group[1].rewardScale, 0.5, "未明寫 rewardScale 時應沿用 statScale");

const restored = restoreRuntimeEnemyGroup(group);
assert.equal(restored[1].maxHp, 50, "restore 不可重複套用 statScale");
assert.equal(restored[1].attack, 10, "restore 不可重複縮放 attack");
assert.equal(restored[1].displayName, "測試哥布林 B", "restore 應保留 runtime 顯示名稱");

const independentAttackScaleGroup = createRuntimeEnemyGroup([
  { enemy: baseEnemy, statScale: 0.5, attackScale: 0.8, rewardScale: 0.5 }
]);
assert.equal(independentAttackScaleGroup[0].maxHp, 50, "statScale 應獨立縮放 maxHp");
assert.equal(independentAttackScaleGroup[0].attack, 16, "attackScale 應獨立縮放 attack");
assert.equal(independentAttackScaleGroup[0].attackScale, 0.8);
const restoredIndependentScaleGroup = restoreRuntimeEnemyGroup(independentAttackScaleGroup);
assert.equal(restoredIndependentScaleGroup[0].attack, 16, "restore 不可重複套用 attackScale");

assert.equal(resolveTargetEnemyId(group, null), group[0].runtimeId, "沒有目標時應選第一名存活敵人");
assert.equal(resolveTargetEnemy(group, group[1].runtimeId), group[1]);
group[1].hp = 0;
assert.equal(resolveTargetEnemyId(group, group[1].runtimeId), group[0].runtimeId, "目標死亡時應 fallback 第一名存活敵人");
assert.equal(getLivingEnemies(group).length, 1);

assert.equal(getEnemyGroupThreatKind([
  { hp: 1, kind: "普通" },
  { hp: 1, kind: "精英" }
]), "精英");
assert.equal(getEnemyGroupThreatKind([
  { hp: 1, kind: "精英" },
  { hp: 1, kind: "首領" }
]), "首領");
assert.equal(getEnemyGroupThreatKind([
  { hp: 1, kind: "普通" },
  { hp: 0, kind: "首領" }
]), "普通", "死亡首領不應影響目前敵群逃跑難度");

const hero = {
  name: "測試者",
  hp: 80,
  maxHp: 100,
  poison: 10,
  damageReduction: 0.2,
  regenEvery: 1,
  regenAmount: 5,
  timedRegens: []
};
const endTurnEnemies = [
  { name: "敵人 A", hp: 50, maxHp: 50, poison: 2, regenEvery: 1, regenAmount: 1 },
  { name: "敵人 B", hp: 50, maxHp: 50, poison: 2, regenEvery: 1, regenAmount: 1 },
  { name: "敵人 C", hp: 50, maxHp: 50, poison: 2, regenEvery: 1, regenAmount: 1 }
];
const previewLoss = getHeroPendingHpLoss(hero);
const beforeHeroHp = hero.hp;
const heroNegative = applyHeroEndOfTurnNegativeEffects({ hero, log: logger });
assert.equal(heroNegative.heroDeathCause, null);
assert.equal(beforeHeroHp - hero.hp, previewLoss, "生命條預覽必須與正式玩家負面狀態扣血一致");
endTurnEnemies.forEach((enemy) => applyEnemyEndOfTurnNegativeEffects({ enemy, log: logger }));
applyHeroEndOfTurnRecoveryEffects({ hero, turn: 1, log: logger });
endTurnEnemies.forEach((enemy) => applyEnemyEndOfTurnRecoveryEffects({ enemy, turn: 1, log: logger }));
assert.equal(hero.hp, 77, "三名敵人時玩家中毒與 regen 都只能各結算一次");
assert.deepEqual(endTurnEnemies.map((enemy) => enemy.hp), [49, 49, 49], "敵人負面與 regen 應逐名結算");

const rewardEnemy = structuredClone(baseEnemy);
rewardEnemy.rewardScale = 0.5;
const originalChance = rewardEnemy.rewards.materials[0].chance;
const scaledRewards = rollEnemyRewards(rewardEnemy, sequenceRandom([0.3, 0]));
assert.equal(scaledRewards.gold, 5, "gold 應套用 rewardScale");
assert.equal(scaledRewards.materials["test-material"].quantity, 2, "素材數量 min/max 第一版不縮放");
assert.equal(rewardEnemy.rewards.materials[0].chance, originalChance, "rewardScale 不可永久改寫素材 chance");
const missedRewards = rollEnemyRewards(rewardEnemy, {}, sequenceRandom([0.5]));
assert.equal(missedRewards.materials["test-material"], undefined, "素材 chance 應乘 rewardScale");
const zeroScaleRewards = rollEnemyRewards({
  rewardScale: 0,
  rewards: {
    gold: 10,
    materials: [{ id: "zero-drop", chance: 1, min: 1, max: 1 }]
  }
}, () => 0);
assert.equal(zeroScaleRewards.gold, 0, "rewardScale 0 時金幣必須為 0");
assert.equal(Object.keys(zeroScaleRewards.materials).length, 0, "rewardScale 0 時素材必須永遠不掉落");

console.log("多敵人核心隔離驗證：全部通過");
